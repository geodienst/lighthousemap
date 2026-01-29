// lighthousemap.js - Main application logic
// MapLibre GL JS map with Canvas 2D overlay for animated lighthouse lights

// --- Color mapping ---
var COLOR_MAP = {
	'white': '#FFFFFF',
	'red': '#FF0000',
	'green': '#00FF00',
	'yellow': '#FFFF00',
	'blue': '#0000FF',
	'orange': '#FFA500',
	'violet': '#EE82EE',
	'amber': '#FFBF00'
};

function resolveColor(color) {
	if (!color) return false;
	if (color === true) return '#FFFF00';
	var lower = color.toLowerCase();
	return COLOR_MAP[lower] || color;
}

// --- State ---
var lights = [];       // Array of {lng, lat, sequence, name, range}
var spatialGrid = {};  // Grid-based spatial index
var GRID_SIZE = 1;     // 1 degree cells
var useRealColors = true;
var overlayCanvas, overlayCtx;

// --- Map initialization ---
var map = new maplibregl.Map({
	container: 'seamap',
	style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
	center: [2.6, 54.2],
	zoom: 6,
	attributionControl: false
});

map.addControl(new maplibregl.AttributionControl({
	customAttribution: 'Made by <a href="https://www.geodienst.xyz/">Geodienst</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution/">CartoDB</a>'
}));

map.addControl(new maplibregl.NavigationControl(), 'top-left');

// --- Data loading ---
function loadData() {
	var remoteUrl = 'https://raw.githubusercontent.com/geodienst/lighthousemap/master/data-full.json';
	var localUrl = 'data-full.json';

	return fetch(remoteUrl)
		.then(function(response) {
			if (!response.ok) throw new Error('Remote fetch failed: ' + response.status);
			return response.json();
		})
		.catch(function(err) {
			console.warn('Remote data fetch failed, falling back to local:', err);
			return fetch(localUrl).then(function(r) { return r.json(); });
		})
		.then(function(json) {
			processElements(json.elements);
		});
}

function processElements(elements) {
	// Build node coordinate lookup for way centroid computation
	var nodeCoords = {};

	for (var i = 0; i < elements.length; i++) {
		var el = elements[i];
		if (el.type === 'node') {
			nodeCoords[el.id] = [el.lon, el.lat];
		}
	}

	// Process all elements
	for (var i = 0; i < elements.length; i++) {
		var el = elements[i];

		if (!el.tags) continue;
		if (!el.tags['seamark:light:sequence'] && !el.tags['seamark:light:1:sequence']) continue;

		var lng, lat;

		if (el.type === 'node') {
			lng = el.lon;
			lat = el.lat;
		} else if (el.type === 'way' && el.nodes) {
			// Compute centroid from node coordinates
			var sumLng = 0, sumLat = 0, count = 0;
			for (var j = 0; j < el.nodes.length; j++) {
				var coord = nodeCoords[el.nodes[j]];
				if (coord) {
					sumLng += coord[0];
					sumLat += coord[1];
					count++;
				}
			}
			if (count === 0) continue;
			lng = sumLng / count;
			lat = sumLat / count;
		} else {
			continue;
		}

		var sequence;
		try {
			sequence = LightSequence.parse(el.tags, '#FF0');
		} catch (e) {
			console.error('Error parsing sequence:', e, el.tags);
			try {
				sequence = LightSequence.parse({'seamark:light:sequence': '1+(1)'});
			} catch (e2) {
				continue;
			}
		}

		lights.push({
			lng: lng,
			lat: lat,
			sequence: sequence,
			name: el.tags['name'] || el.tags['seamark:name'] || '',
			range: parseFloat(el.tags['seamark:light:range']) || 1
		});
	}

	console.log('Loaded ' + lights.length + ' lights');
}

// --- Spatial index ---
function buildSpatialIndex() {
	spatialGrid = {};
	for (var i = 0; i < lights.length; i++) {
		var light = lights[i];
		var key = Math.floor(light.lng / GRID_SIZE) + ',' + Math.floor(light.lat / GRID_SIZE);
		if (!spatialGrid[key]) spatialGrid[key] = [];
		spatialGrid[key].push(light);
	}
}

function getVisibleLights(bounds) {
	var result = [];
	var minX = Math.floor(bounds.getWest() / GRID_SIZE) - 1;
	var maxX = Math.floor(bounds.getEast() / GRID_SIZE) + 1;
	var minY = Math.floor(bounds.getSouth() / GRID_SIZE) - 1;
	var maxY = Math.floor(bounds.getNorth() / GRID_SIZE) + 1;

	for (var x = minX; x <= maxX; x++) {
		for (var y = minY; y <= maxY; y++) {
			var cell = spatialGrid[x + ',' + y];
			if (cell) {
				for (var i = 0; i < cell.length; i++) {
					result.push(cell[i]);
				}
			}
		}
	}
	return result;
}

// --- Canvas overlay ---
function setupCanvasOverlay() {
	var container = map.getCanvasContainer();
	overlayCanvas = document.createElement('canvas');
	overlayCanvas.style.position = 'absolute';
	overlayCanvas.style.top = '0';
	overlayCanvas.style.left = '0';
	overlayCanvas.style.pointerEvents = 'none';
	container.appendChild(overlayCanvas);

	overlayCtx = overlayCanvas.getContext('2d');
	resizeCanvas();
}

function resizeCanvas() {
	var dpr = window.devicePixelRatio || 1;
	var mapCanvas = map.getCanvas();
	var width = mapCanvas.clientWidth;
	var height = mapCanvas.clientHeight;
	overlayCanvas.width = width * dpr;
	overlayCanvas.height = height * dpr;
	overlayCanvas.style.width = width + 'px';
	overlayCanvas.style.height = height + 'px';
	overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// --- Rendering ---
function getRadius(range) {
	var zoom = map.getZoom();
	var baseRadius = Math.max(2, Math.min(range, 10));
	return baseRadius * Math.pow(1.15, zoom - 6);
}

function startAnimation() {
	function draw(timestamp) {
		var t = timestamp / 1000;
		var dpr = window.devicePixelRatio || 1;
		var width = overlayCanvas.width / dpr;
		var height = overlayCanvas.height / dpr;

		overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
		overlayCtx.clearRect(0, 0, width, height);

		var bounds = map.getBounds();
		var visible = getVisibleLights(bounds);

		overlayCtx.globalAlpha = 0.9;

		for (var i = 0; i < visible.length; i++) {
			var light = visible[i];

			var state;
			try {
				state = light.sequence.state(t);
			} catch (e) {
				continue;
			}

			if (!state) continue;

			var color = useRealColors ? resolveColor(state) : '#FFFF00';
			if (!color) continue;

			var point = map.project([light.lng, light.lat]);
			var radius = getRadius(light.range);

			overlayCtx.beginPath();
			overlayCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
			overlayCtx.fillStyle = color;
			overlayCtx.fill();
		}

		overlayCtx.globalAlpha = 1.0;

		requestAnimationFrame(draw);
	}

	requestAnimationFrame(draw);
}

// --- Controls ---
var realColorsCheckbox = document.querySelector('input[name=real-colors]');
if (realColorsCheckbox) {
	realColorsCheckbox.checked = useRealColors;
	realColorsCheckbox.addEventListener('change', function() {
		useRealColors = this.checked;
	});
}

// --- Initialization ---
map.on('load', function() {
	setupCanvasOverlay();

	loadData()
		.then(function() {
			buildSpatialIndex();
			startAnimation();
		})
		.catch(function(err) {
			console.error('Failed to load lighthouse data:', err);
		});
});

map.on('resize', function() {
	if (overlayCanvas) resizeCanvas();
});
