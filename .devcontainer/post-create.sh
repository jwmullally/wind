#!/bin/sh
set -ex

# Create writable folder for WIND server
mkdir -p \
	config \
	files/photos \
	files/srtm \
	templates/_compiled \
	templates/_compiled/basic \
	