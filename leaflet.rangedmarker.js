L.RangedMarker = L.Marker.extend({
	options: {
		range: 1
	}, 
	initialize: function(latlng, options) {
		L.Marker.prototype.initialize.call(this, latlng, options);

		const updateIconSize = this.updateIconSize.bind(this);
		this.updateCallback = function() {
			updateIconSize(this);
		};
	},
	onAdd: function(map) {
		L.Marker.prototype.onAdd.call(this, map);
		map.on('zoomend', this.updateCallback);
		this.updateIconSize(map);
	},
	onRemove: function(map) {
		map.off('zoomend', this.updateCallback);
		L.Marker.prototype.onRemove.call(this, map);
	},
	updateIconSize: function(map) {
		let size = this._getSizeOnMap(map);
		this._icon.style.width = size + 'px';
		this._icon.style.height = size + 'px';
	},
	_getSizeOnMap: function (map) {
		return this.options.range / this._getMetersPerPixel(map);
	},
	_getMetersPerPixel: function(map) {
		var centerLatLng = map.getCenter(); // get map center
		var pointC = map.latLngToContainerPoint(centerLatLng); // convert to containerpoint (pixels)
		var pointX = L.point(pointC.x + 10, pointC.y); // add 10 pixels to x

		// convert containerpoints to latlng's
		var latLngX = map.containerPointToLatLng(pointX);
		return centerLatLng.distanceTo(latLngX) / 10; // calculate distance between c and x (latitude)
	}
});