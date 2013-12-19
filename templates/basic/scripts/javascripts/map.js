
/**
 * @brief Map with all the information of the network topology
 * @param el_id The id of the element to render map on
 * @param topology_url The url with network topology information.
 * @param options
 *  - topology_url: The url to download network topology
 * 	- bound_sw : The southwest point of the boundaries (lat,lng)
 *  - bound_ne	: The northeast point of the boundaries (lat,lng)
 *  - center : Center of the map (lat,lng)
 */
var NetworkMap = function(el_id, options) {
	// Private variables
	
	this._map_el_id = el_id;
	this._topology_url = 'topology_url' in options?options['topology_url']:null;
	this._default_filter = {
		p2p : true,
		ap: true,
		client : true,
		unlinked : false
	};
	this._filter = $.extend({}, this._default_filter);
	this._node_popup = null;
	this._olControls = {};
	this._olLayers = {};
	
	// Process options
	this._default_options = {
		bound_sw : [37.97152, 23.72664],
		bound_ne : [37.97152, 23.72664],
		center: null
	};
	this.options = $.extend({}, this._default_options, options);
	
	// Construct map
	this._constructMap();
	
	// Download topology
	this._downloadTopology();
};

/**
 * @brief Construct the complete map without topology
 */
NetworkMap.prototype._constructMap = function() {
	var networkMap = this;
	
	// Calculate boundaries
	var bounds = new OpenLayers.Bounds();
	bounds.extend(new OpenLayers.LonLat(this.options.bound_sw[1], this.options.bound_sw[0]));
	bounds.extend(new OpenLayers.LonLat(this.options.bound_ne[1], this.options.bound_ne[0]));
	bounds.transform('EPSG:4326', 'EPSG:3857');
	
	// Calculate center
	var center;
	if (this.options['center']) {
		center = new OpenLayers.LonLat(this.options.center[1], this.options.center[0])
			.transform('EPSG:4326', 'EPSG:3857');
	} else {
		center = bounds.getCenterLonLat();
	}
	
	// LAYER : Nodes
	//-------------------------------------------------------
	this._olLayers['nodes'] = new OpenLayers.Layer.Vector("Nodes", {
		styleMap : new OpenLayers.StyleMap({
			'default' : new OpenLayers.Style({
				'pointRadius' : 5,
				'strokeWidth' : 1,
				'strokeColor' : '#000000',
				'fillColor' : '${color}',
			}),
			'hover' : new OpenLayers.Style({
				label : '${name}',
				labelYOffset : +13,
				labelOutlineColor : "white",
				labelOutlineWidth : 4
			}),
			'select' : new OpenLayers.Style({
				'pointRadius' : 7,
			})
		})
	});
	
	// Highlight
	this._olControls['node_highlight'] = new OpenLayers.Control.SelectFeature(this._olLayers['nodes'], {
		hover : true,
		highlightOnly : true,
		renderIntent : "hover"
	});

	// Selection
	this._olControls['node_select']  = new OpenLayers.Control.SelectFeature(this._olLayers['nodes'], {
			onSelect : function(feature) {
				var popup_body = networkMap._constructNodePopup(feature);

				var popup = new OpenLayers.Popup("node",
						new OpenLayers.LonLat(feature.geometry.x, feature.geometry.y),
						new OpenLayers.Size(100, 100),
						popup_body.html(),
						false
				);

				popup.autoSize = true;
				popup.panMapIfOutOfView = true;
				networkMap._node_popup = popup;
				networkMap._olMap.addPopup(popup);

			},
			onUnselect : function(feature) {
				if (networkMap._node_popup)
					networkMap._olMap.removePopup(networkMap._node_popup);
				networkMap._node_popup = null;
			}
		}
	);

	// LAYER : Links
	//-------------------------------------------------------
	this._olLayers['links'] = new OpenLayers.Layer.Vector("Links", {
		styleMap : new OpenLayers.StyleMap({
			'default' : new OpenLayers.Style({
				'strokeWidth' : 1.2,
				'strokeColor' : '${color}',
			}),
		})
	});
	
	// LAYER : map
	//-------------------------------------------------------
	this._olLayers['osm'] = new OpenLayers.Layer.OSM("OpenStreetMaps");
	this._olLayers['google'] = new OpenLayers.Layer.Google("Google Satelite", {type: google.maps.MapTypeId.SATELLITE, visibility: false});
	
	// Finally connect all components under a map object
	this._olMap = new OpenLayers.Map({
		div : this._map_el_id,
		projection : 'EPSG:3857',
		layers : [
		          this._olLayers['osm'],
		          this._olLayers['google'],
		          this._olLayers['links'],
		          this._olLayers['nodes']
		         ],
		center : center,
		zoom : 10,
		zoomDuration: 10,
		numZoomLevels: 20
	});
	this._olMap.zoomToExtent(bounds);
	
	this._olControls['layer_switcher'] = new OpenLayers.Control.LayerSwitcher();
	this._olMap.addControl(this._olControls['node_highlight']);
	this._olMap.addControl(this._olControls['node_select']);
	this._olMap.addControl(this._olControls['layer_switcher']);
	this._olControls['node_highlight'].activate();
	this._olControls['node_select'].activate();
};

/**
 * @brief Construct and return DOM Element for a node popup
 */
NetworkMap.prototype._constructNodePopup = function(feature) {
	
	var popup_body = $(
		'<div><div class="nodePopup" ><span class="title"/><span class="id"/>'
			+ '<ul class="attributes" />'
			+ '<a>Node info</a>'
			+ '</div></div>'
			);
	
	popup_body.find('.nodePopup').addClass(feature.attributes['type']);
	popup_body.find('.title').text(feature.attributes['name']);
	popup_body.find('.id').text('#'+String(feature.attributes['id']));
	popup_body.find('a').attr('href', feature.attributes['url']);
	var ul = popup_body.find('ul');
	var displayAttribute = function(key, value) {
		var li = $('<li><span class="key"></span>: <span class="value"></span></li>');
		li.find('.key').text(key);
		li.find('.value').text(value);
		ul.append(li);
	};
	if (feature.attributes['area']) {
		ul.append($('<li class="area"/>').text(feature.attributes['area']));
	}
	
	// Generate links description
	var total_links = String(feature.attributes['total_p2p']
		+ feature.attributes['total_ap_subscriptions']
		+ feature.attributes['total_clients']);
	var extra_info = [];
	if (feature.attributes['total_p2p'] > 0)
		extra_info.push("PtP: " + feature.attributes['total_p2p']);
	if (feature.attributes['total_clients'] > 0)
		extra_info.push("Clients: " + feature.attributes['total_clients']);
	if (feature.attributes['total_ap_subscriptions'] > 0)
		extra_info.push("AP client: " + feature.attributes['total_ap_subscriptions']);
	if (extra_info.length)
		total_links += ' (' + extra_info.join(", ") + ')';
	displayAttribute("Links", total_links);

	return popup_body;
};

/**
 * @brief Download network topology and update map
 * @param focus_selected It will focus to selected node
 * 	if it is found. (default True)
 */
NetworkMap.prototype._downloadTopology = function(focus_selected) {
	var networkMap = this;
	
	if (!this._topology_url)
		return false;	// There is no known resource to download topology
	
	// Process parameters
	if (typeof(focus_selected) == 'undefined') {
		focus_selected = true;
	}
	
	// Clear map
	this._olLayers['nodes'].removeAllFeatures();
	this._olLayers['links'].removeAllFeatures();
	if (networkMap._node_popup){
		networkMap._olMap.removePopup(this._node_popup);
		networkMap._node_popup = null;
	}
	
	// Try to load nodes
	$.get(this._topologyUrl(), function(topology) {
		networkMap._topology = topology;
		
		var GeoJSONParser = new OpenLayers.Format.GeoJSON({
			'internalProjection' : "EPSG:900913",
			'externalProjection' : "EPSG:4326"
		});

		// Convert nodes to GeoJSON
		var nodeFeatures = $.map(topology.nodes, function(node, node_id) {

			// Color mapping for nodes
			var colors_per_type = {
				'p2p' : '#f5c70c',
				'p2p-ap' : '#f5c70c',
				'ap' : '#61d961',
				'client' : '#5858ff',
				'unlinked' : '#ff3f4f',
			};

			// GeoJSON inherits all properties + extra
			var properties = jQuery.extend({}, node);
			
			properties['color'] = colors_per_type[properties['type']];
			if ('selected' in properties)
				properties['color'] = '#000000';

			return {
				'type' : "Feature",
				'id' : node['id'],
				'geometry' : {
					'type' : 'Point',
					'coordinates' : [ node['lon'], node['lat'] ]
				},
				'properties' : properties,
			};
		});
		var nodesGeoJSON = {
			"type" : "FeatureCollection",
			"features" : nodeFeatures
		};

		// Convert links to GeoJSON
		var linkFeatures = $.map(topology.links, function(link, link_id) {
			
			// GeoJSON inherits all properties + extra
			var properties = jQuery.extend({}, link);
			properties['color'] = (link['status'] == 'active')
				?'#00ff00'
				:'#ff0000';
			
			return {
				'type' : "Feature",
				'id' : link['id'],
				'geometry' : {
					'type' : 'LineString',
					'coordinates' : [
					        [ link['lon1'], link['lat1'] ],
							[ link['lon2'], link['lat2'] ] ]
				},
				'properties' : properties
			};
		});
		var linksGeoJSON = {
			"type" : "FeatureCollection",
			"features" : linkFeatures
		};

		// Load features on map
		networkMap._olLayers['nodes'].addFeatures(GeoJSONParser.read(nodesGeoJSON));
		networkMap._olLayers['links'].addFeatures(GeoJSONParser.read(linksGeoJSON));
		
		// Check if there is selected
		if (focus_selected && ('selected' in topology['meta'])) {
			networkMap.focusAtNode(topology['meta']['selected']);
		}

	});
};

/**
 * @brief Construct the topology url based on filter
 */
NetworkMap.prototype._topologyUrl = function() {
	var topology_url = this._topology_url;
	filter = [];
	$.each(this._filter, function(key, value){
		if (value)
			filter.push(key);
	});
	topology_url += '&filter=' + filter.join(',');
	return topology_url;
};

/**
 * @brief Set the node filtering
 */
NetworkMap.prototype.setFilter = function(visible_filter) {
	this._filter = $.extend({}, this._default_filter, visible_filter);
	
	this._downloadTopology(false);	// Redownload map
};

/**
 * @brief Get node filtering
 */
NetworkMap.prototype.getFilter = function() {
	return this._filter;
};

/**
 * @brief Focus on specific node (if exists)
 */
NetworkMap.prototype.focusAtNode = function(node_id) {
	if (!node_id in this._topology.nodes)
		return false;	// Cannot find node
	
	var node = this._topology.nodes[node_id];
	var point = new OpenLayers.LonLat(node['lon'], node['lat'])
		.transform('EPSG:4326', 'EPSG:3857');
	
	this._olMap.setCenter(point, 15, true);
	
	// Hack because setCenter does not call callbacks
	this._olLayers['nodes'].redraw();
	this._olLayers['links'].redraw();
};


/**
 * @brief Map control for selecting node filtering.
 * @param map The NetworkMap object to render and control filter.
 */
var NetworkMapControlNodeFilter = function(map, options) {
	var nodeFilterObject = this;
	
	this._map = map;
	this._valid_filters = {
		'p2p' : 'backbone',
		'ap' : 'ap',
		'client' : 'clients',
		'unlinked' : 'unlinked'
	};

	// Construct hud
	this._element = $('<div class="map-hud map-filter"><ul/></ul></div>');
	$.each(this._valid_filters, function(filter, lang_token){
		nodeFilterObject._element.find('ul').append($('<li class="button" />').addClass(filter).text(lang[lang_token]));
	});
	$('#' + this._map._map_el_id).append(this._element);
	
	// Load current state
	this._loadState();
	
	// Add hooks
	this._element.find('li').click(function(){
		$(this).toggleClass('active');
		nodeFilterObject._saveState();
	});
};

/**
 * @brief Load state of filters from map
 */
NetworkMapControlNodeFilter.prototype._loadState = function() {
	var nodeFilterObject = this;
	
	$.each(this._map.getFilter(), function(filter, state){
		var li = nodeFilterObject._element.find('li.' + filter);
		if (!state) {
			li.removeClass('active');
		} else {
			li.addClass('active');
		}
	});
};

/**
 * @brief Save state of filters to the map
 */
NetworkMapControlNodeFilter.prototype._saveState = function() {
	var nodeFilterObject = this;
	var filters = this._map.getFilter();
	
	// Loop around filters
	$.each(this._map.getFilter(), function(filter, state){
		var li = nodeFilterObject._element.find('li.' + filter);
		
		filters[filter] = false;
		if (li.hasClass('active')) {
			filters[filter] = true;
		}
	});
	
	nodeFilterObject._map.setFilter(filters);
};


/**
 * @brief Map control for enabling fullscreen mode
 * @param map The NetworkMap object to render and control filter.
 */
var NetworkMapControlFullScreen = function(map, options) {
	var fullScreenObject = this;
	
	this._map = map;
	this._map_element = $('#' + this._map._map_el_id);

	// Construct hud
	this._element = $('<div class="map-hud map-fullscreen"><span class="button"></span></div>');
	$('#' + this._map._map_el_id).append(this._element);
	
	// Add hooks
	this._element.find('span').click(function(){
		fullScreenObject.toggleFullscreen();
		return false;
	});
	$(document).keyup(function(e) {
	  if (e.keyCode == 27) { fullScreenObject.restore(); }   // esc
	});
};

/**
 * @brief Check if map is fullscreen
 */
NetworkMapControlFullScreen.prototype.isFullscreen = function() {
	return this._map_element.hasClass('fullscreen');
};

/**
 * @brief Set fullscreen mode of the map
 */
NetworkMapControlFullScreen.prototype.setFullscreen = function() {
	if (this.isFullscreen())
		return;	// Already fullscreen
	
	var olMap = this._map._olMap;
	this._map_element.addClass('fullscreen');
	olMap.updateSize();
};

/**
 * @brief Restore map to default size
 */
NetworkMapControlFullScreen.prototype.restore = function() {
	if (!this.isFullscreen())
		return;	// It is already restored
	
	var olMap = this._map._olMap;
	this._map_element.removeClass('fullscreen');
	olMap.updateSize();
};

/**
 * @brief Toggle fullscreen mode
 */
NetworkMapControlFullScreen.prototype.toggleFullscreen = function() {
	if (this.isFullscreen())
		this.restore();
	else
		this.setFullscreen();
};



/**
 * @brief Map control for selecting a place
 * @param map The NetworkMap object to render and control filter.
 * @param options
 *  - position: Starting position of the marker (default view center)
 *  - ok: Callback if user pressed ok
 *  - cancel: Callback if user pressed cancel.
 */
var NetworkMapControlSelectSpot = function(map, options) {
	var controlSelectObject = this;
	
	// Private variables
	this._map = map;
	this._default_options = { position: null, ok: null, cancel: null };
	this._options = $.extend({}, this._default_options, options);
	
	// Process options
	if (this._options['position']) {
		// Convert to LonLat object
		var pos = new OpenLayers.LonLat(this._options['position'][1], this._options['position'][0])
			.transform('EPSG:4326', 'EPSG:3857');
		this._options['position'] = pos;
	} else {
		this._options['position'] = this._map._olMap.getCenter();
		console.log("Center");
	}
	
	
	// LAYER: Selection 
	this._layer_selection = new OpenLayers.Layer.Vector("Selection", {
		styleMap : new OpenLayers.StyleMap({
			'default' : new OpenLayers.Style({
				'pointRadius' : 5,
				'strokeWidth' : 2,
				'strokeColor' : '#000000',
				'fillColor' : '#35df69',
			}),
		})
	});
	this._map._olMap.addLayer(this._layer_selection);
	
	// Add movable marker
	this._marker = new OpenLayers.Feature.Vector(
			 new OpenLayers.Geometry.Point(this._options['position'].lon, this._options['position'].lat),
			 {some:'data'});
	this._layer_selection.addFeatures(this._marker);
	
	this._map._olControls['node_select'].deactivate();
	this._map._olControls['node_highlight'].deactivate();
	
	this._drag_control = new OpenLayers.Control.DragFeature(this._layer_selection, {
		onComplete : function(feature){
			var pos = controlSelectObject.getPosition();
			controlSelectObject._element.find('.lat').text(pos.lat.toFixed(4));
			controlSelectObject._element.find('.lon').text(pos.lon.toFixed(4));
		}
	});
	this._map._olMap.addControl(this._drag_control);
	this._drag_control.activate();
	
	// Construct hud
	this._element = $('<div class="map-hud map-position">'
			+ '<span class="coordinates"><span class="lat"/>, <span class="lon"/></span>'
			+ '<span class="ok button">OK</span>'
			+ '<span class="cancel button">Cancel</span></div>');
	$('#' + this._map._map_el_id).append(this._element);
	
	// Add hooks
	this._element.find('span.ok').click(function(){
		if (controlSelectObject._options['ok'])
			controlSelectObject._options['ok'](controlSelectObject);
	});
	this._element.find('span.cancel').click(function(){
		if (controlSelectObject._options['cancel'])
			controlSelectObject._options['cancel'](controlSelectObject);
	});
};

NetworkMapControlSelectSpot.prototype.getPosition = function() {
	var pos = new OpenLayers.LonLat(this._marker.geometry.x, this._marker.geometry.y)
		.transform('EPSG:3857', 'EPSG:4326');
	return pos;
};