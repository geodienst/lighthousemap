function getBoundsWithPadding(map, padding) {
	const bounds = map.getPixelBounds(),
		sw = map.unproject(bounds.getBottomLeft().add([-padding, padding])),
		ne = map.unproject(bounds.getTopRight().add([padding, -padding]));

	return new L.LatLngBounds(sw, ne);
}

Object.assign(L.LatLngBounds.prototype, {
	toMinMax: function() {
		return {
			minX: this.getWest(),
			minY: this.getSouth(),
			maxX: this.getEast(),
			maxY: this.getNorth()
		};
	}
});

L.LayerGroup.include({
	updateLayers: function(layers) {
		var _layers = {};

		for (var i = 0; i < layers.length; ++i)
			_layers[this.getLayerId(layers[i])] = layers[i];

		var toRemove = [];

		for (var id in this._layers) {
			if (!(id in _layers))
				toRemove.push(this._layers[id]);
		}

		toRemove.forEach(this.removeLayer, this);

		for (var id in _layers) {
			if (!(id in this._layers))
				this.addLayer(_layers[id]);
		}

		return this;
	}
});

L.IndexedFeatureLayer = L.GeoJSON.extend({
	options: {
		padding: 30 // in pixels
	},

	initialize: function (geojson, options) {
		L.Util.setOptions(this, options);

		this._layers = {};

		this._visible = L.layerGroup([]);

		this._rbush = rbush(9);

		if (geojson) {
			this.addData(geojson);
		}
	},

	search: function(bounds) {
		return this._rbush.search(bounds.toMinMax()).map(result => result.layer);
	},

	getLayerId: function(layer) {
		return layer.feature.id;
	},

	addLayer: function (layer) {
		const id = this.getLayerId(layer);

		if (id in this._layers)
			return this;

		this._layers[id] = layer;

		// Necessary for circle markers I use here
		layer._map = this._map;
		layer._project();
		
		const xy = layer.getBounds().toMinMax();
		this._rbush.insert(Object.assign({layer: layer}, xy));
		
		if (this._map
			&& !this._visible.hasLayer(layer)
			&& this._layerInView(layer)) {
			layer._map = null;
			this._visible.addLayer(layer);
		} else {
			layer._map = null;
		}

		return this;
	},

	onAdd: function (map) {
		this._visible.addTo(map);
		map.on('moveend', this._redraw, this);
		this._redraw();
	},

	onRemove: function(map) {
		this._visible.removeFrom(map);
	},

	eachVisibleLayer: function(callback) {
		return this._visible.eachLayer(callback);
	},

	_getBounds: function() {
		return getBoundsWithPadding(this._map, this.options.padding);
	},

	_redraw: function() {
		const layers = this.search(this._getBounds());
		this._visible.updateLayers(layers);
	},

	_layerInView: function(layer) {
		return layer.getBounds().intersects(this._getBounds());
	}
});

L.indexedGeoJSON = function(geojson, options) {
	return new L.IndexedFeatureLayer(geojson, options);
};