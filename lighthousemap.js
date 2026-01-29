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

// --- URL hash state ---
// Format: #map=zoom/lat/lng (e.g. #map=4/39/-91)
function parseHash() {
	var match = window.location.hash.match(/^#map=([\d.]+)\/([-\d.]+)\/([-\d.]+)$/);
	if (match) {
		var zoom = parseFloat(match[1]);
		var lat = parseFloat(match[2]);
		var lng = parseFloat(match[3]);
		if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lng)) {
			return { zoom: zoom, center: [lng, lat] };
		}
	}
	return { zoom: 3, center: [2.6, 54.2] };
}

function updateHash() {
	var center = map.getCenter();
	var zoom = map.getZoom();
	var hash = '#map=' + zoom.toFixed(2) +
		'/' + center.lat.toFixed(4) +
		'/' + center.lng.toFixed(4);
	history.replaceState(null, '', hash);
}

// --- Map initialization ---
var initialView = parseHash();
var map = new maplibregl.Map({
	container: 'seamap',
	style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
	center: initialView.center,
	zoom: initialView.zoom,
	attributionControl: false
});

map.addControl(new maplibregl.AttributionControl());

map.addControl(new maplibregl.NavigationControl(), 'top-left');
map.addControl(new maplibregl.GlobeControl(), 'top-left');

// Enable globe projection once style is loaded
map.on('style.load', function() {
	map.setProjection({ type: 'globe' });
	map.setSky({
		'sky-color': '#000010',
		'sky-horizon-blend': 0.5,
		'horizon-color': '#000020',
		'horizon-fog-blend': 0.8,
		'fog-color': '#000010',
		'fog-ground-blend': 1.0,
		'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 12, 0]
	});
});

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
		if (!el.tags['seamark:light:sequence'] && !el.tags['seamark:light:1:sequence']
			&& !el.tags['seamark:light:character'] && !el.tags['seamark:light:1:character']) continue;

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

function getVisibleLights() {
	// In globe mode at low zoom, getBounds() is unreliable — it returns a
	// lat/lng box that doesn't properly represent the circular globe viewport,
	// especially near the antimeridian. At low zoom the total light count is
	// manageable after occlusion culling, so just return all lights and let
	// the draw loop handle occlusion + screen-bounds checks.
	if (map.getZoom() < 6 && map.getProjection().type === 'globe') {
		return lights;
	}

	var bounds = map.getBounds();
	var result = [];
	var minY = Math.floor(bounds.getSouth() / GRID_SIZE) - 1;
	var maxY = Math.floor(bounds.getNorth() / GRID_SIZE) + 1;
	var minX = Math.floor(bounds.getWest() / GRID_SIZE) - 1;
	var maxX = Math.floor(bounds.getEast() / GRID_SIZE) + 1;

	for (var x = minX; x <= maxX; x++) {
		// Wrap grid x into [-180, 179] so that unwrapped bounds
		// (e.g. east=190 or west=-200) map back to the stored key.
		var wx = ((x % 360) + 540) % 360 - 180;
		for (var y = minY; y <= maxY; y++) {
			var cell = spatialGrid[wx + ',' + y];
			if (cell) {
				for (var i = 0; i < cell.length; i++) {
					result.push(cell[i]);
				}
			}
		}
	}

	return result;
}

// Compute which world copy offsets are visible (e.g. [-1, 0, 1]).
// In mercator, the map wraps so tiles repeat; we need to draw lights
// on each visible copy by offsetting lng by N * 360.
function getWorldOffsets() {
	var bounds = map.getBounds();
	var west = bounds.getWest();
	var east = bounds.getEast();
	var x1 = -Math.ceil((Math.abs(west) - 180) / 360);
	var x2 = Math.ceil((Math.abs(east) - 180) / 360);
	var offsets = [];
	for (var i = x1; i <= x2; i++) {
		offsets.push(i * 360);
	}
	return offsets;
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

		var visible = getVisibleLights();
		var isGlobe = map.getProjection().type === 'globe';
		var offsets = isGlobe ? [0] : getWorldOffsets();

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

			// Skip lights on the back side of the globe
			if (isGlobe && map.transform.isLocationOccluded(new maplibregl.LngLat(light.lng, light.lat))) continue;

			var radius = getRadius(light.range);

			// Draw on each visible world copy
			for (var oi = 0; oi < offsets.length; oi++) {
				var point = map.project([light.lng + offsets[oi], light.lat]);

				// Skip lights that project outside the canvas
				if (point.x < -50 || point.x > width + 50 || point.y < -50 || point.y > height + 50) continue;

				overlayCtx.beginPath();
				overlayCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
				overlayCtx.fillStyle = color;
				overlayCtx.fill();
			}
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

map.on('moveend', updateHash);
map.on('zoomend', updateHash);
