FROM docker.io/library/php:5.6-apache-stretch
# Documentation: https://hub.docker.com/_/php
# devcontainer additions from: https://github.com/devcontainers/images/blob/main/src/php/.devcontainer/Dockerfile

# This provides a standard Debian PHP docker environment for WIND server.
# It is the same as a production environment, with some additional
# debug tools (like xdebug).

RUN pecl channel-update pecl.php.net \
    && yes | pecl install xdebug-2.5.5 \
    && echo "zend_extension=$(find /usr/local/lib/php/extensions/ -name xdebug.so)" > /usr/local/etc/php/conf.d/xdebug.ini \
    && echo "xdebug.mode = debug" >> /usr/local/etc/php/conf.d/xdebug.ini \
    && echo "xdebug.start_with_request = yes" >> /usr/local/etc/php/conf.d/xdebug.ini \
    && echo "xdebug.client_port = 9000" >> /usr/local/etc/php/conf.d/xdebug.ini \
    && rm -rf /tmp/pear

RUN curl -sSL https://getcomposer.org/installer | php \
    && chmod +x composer.phar \
    && mv composer.phar /usr/local/bin/composer

# Environment variables
ENV TZ="UTC"
ENV LANG="C.UTF-8"
ENV LC_ALL="C.UTF-8"
ENV DEBIAN_FRONTEND="noninteractive"
ENV COMPOSER_ALLOW_SUPERUSER="1"

# Debian packages
RUN echo "deb http://archive.debian.org/debian/ stretch main" > /etc/apt/sources.list

# Main dependencies
RUN apt-get update \
    && apt-get --yes upgrade --no-install-recommends \
    && apt-get --yes install --no-install-recommends \
        libpng-dev \
        mariadb-client \
        libzip-dev \
        unzip

# PHP Core extensions
RUN docker-php-ext-install \
        gd \
        mysql \
        mysqli \
        zip

# PHP Composer extensions
RUN mkdir -p \
        /tmp/composer \
        /usr/share/php/ \
    && cd /tmp/composer \
    && composer -n require \
        smarty/smarty==2.6.33 \
    && mv vendor/smarty/smarty/ /usr/share/php/ \
    && rm -rf /tmp/composer

# PHP Configuration
RUN echo 'date.timezone="Etc/UTC"' > /usr/local/etc/php/conf.d/timezone.ini

# Extra developer tools
RUN apt-get --yes install --no-install-recommends \
        less \
        nano \
        netcat