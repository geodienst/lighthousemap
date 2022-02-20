/*
    lighthouse.js

    code to create and display lighthouses

    PJ 202202

*/

    
    // this mangles a set of tags from OSM data into an array of objects that looks like light_data below.
    // It's very ramshackle and plenty of room for tidying and improvement.

    const NM_IN_METRES = 1852; // https://en.wikipedia.org/wiki/Nautical_mile
    const MARKER_RADIUS = 200; // circle and marker radius in metres

    // get the entries where tags match "seamark:light:i:<something>" and create an object of {<something>: value ...} entries
    let light_entry = function (tags, light_seq) {
        // create regexp using light_seq
        let re = new RegExp("seamark:light:" + light_seq.toString() + ':(.+)$');

        // get the key-value pairs which match the regex - of the form "period", "3"
        the_entries = Object.entries(tags).filter((the_entry) => re.test(the_entry[0]));

        // process these entries into an object
        let one_light_data = {};
        the_entries.forEach(entry => {
            let new_key = entry[0].match(re);
            // change the names of a couple of them to match the expected naming
            switch(new_key[1]) {
                case 'sector_start':
                    key = 'start';
                    break;
                case 'sector_end':
                    key = 'end';
                    break;
                default:
                    key = new_key[1];
            } 
            one_light_data[key] = entry[1];
        });
        return one_light_data;
    };

    let lighthouse_data = function (geojson) {

         // iterate through all the lights to build a light_data object
        var light_data = [];

        var tags = geojson.properties;

        for (let light_seq = 1; light_seq < 9; light_seq++){
            let this_light = light_entry(tags, light_seq);
            if (Object.keys(this_light).length > 0)
                {
                	this_light.range = !this_light.range ? 5.0 : this_light.range;
					this_light.colour = !this_light.colour ? 'white' : this_light.colour;
					light_data.push(this_light);
                }
            else {break;}
        }

        // if this didn't result in anything, the lighthouse only has one light.
        if (!light_data.length) {
            // now we are just looking for tags looking like seamark:light:<something>
            let re2 = new RegExp("seamark:light:(.+)$");
            // get the key-value pairs
            the_entries = Object.entries(tags).filter((the_entry) => re2.test(the_entry[0]));

            // process these entries into an object
            let one_light_data = {};
            the_entries.forEach(entry => {
                let new_key = entry[0].match(re2);
                one_light_data[new_key[1]] = entry[1];
            });

            //check for missing range and default
            one_light_data.range = !one_light_data.range ? 5.0 : one_light_data.range;

            // check for missing colour and default to white
            one_light_data.colour = !one_light_data.colour ? 'white' : one_light_data.colour;

            // no start or end angles, so need to provide these to draw a circle: 0, 360
            one_light_data.start = '0';
            one_light_data.end = '360';

            light_data.push(one_light_data);
        }

        // get the location of the lighthouse as a latlong, using the centre if it's a polygon
        var latlong = L.GeoJSON.coordsToLatLng(
            geojson.geometry.type == "Polygon" 
            ? turf.centroid(geojson.geometry).geometry.coordinates
            : geojson.geometry.coordinates
            );

        // populate other attributes of the lighthouse
        var the_lighthouse = {};
        the_lighthouse.name = tags['seamark:name'] || tags['name'] || "unnamed";
        the_lighthouse.type = tags['seamark:type'];
        the_lighthouse.height = tags['seamark:light:height'] || tags['seamark:light:1:height'];
        the_lighthouse.latlong = latlong; 
        the_lighthouse.sectors = light_data;
        the_lighthouse.url = tags['url'];
        the_lighthouse.range_nm = light_data.reduce((prev, sector) => Math.max(prev, sector.range),0);  // max of the sector ranges
        the_lighthouse.sequence = tags['seamark:light:sequence'] || tags['seamark:light:1:sequence'];
        // default if no sequence found
        the_lighthouse.sequence = !the_lighthouse.sequence ? "1+(1)" : the_lighthouse.sequence;
 
        // build a sequence array from the light sequence string
        // it's series of comma- or plus-separated tokens comprising numbers
        // which are in brackets if dark, not if light
        // split the sequence

        // TODO - make this handle alternating coloured lights like "white;red". This means keep the beam colour.
        var seq_split = the_lighthouse.sequence.replace(/,/g,'+').split('+');
        var seq_steps = seq_split.map(element => {
            if(element.substring(0, 1) == '('){
                return [false, Number(element.substring(1, element.length-1))];
            }
            else {
                return ['yes', Number(element)];
            }
        });

        // some short-period lights will come from a slowly-rotating light with multiple beams
        // as the light can't rotate that fast.
        // (could be up to 6). This could be true of single or double flashes.
        // in these cases, multiply up our period so it's within a sensible range
        // and replicate the steps that many times. The light will appear with multiple beams

        // the sequence object is a duration and the array of steps
        var the_duration = seq_steps.reduce((total, step) => total+step[1], 0);
        var lit_duration = seq_steps.reduce((total, step) => total+(step[0] == 'yes' ? step[1] : 0), 0);
        var the_sequence = {
            duration: the_duration,
            lit_proportion: lit_duration / the_duration,
            steps: seq_steps
        };
        the_lighthouse.sequence_data = the_sequence;

        return the_lighthouse;
    };

//    var date_fmt = new Date().toISOString().slice(0,10);

    // update the Canvas to handle how to draw a lighthouse
    L.Canvas.include({

    _updateLighthouse: function(layer, t) {

        var max_range = layer.options.range_nm;
        var p = layer._point,
          ctx = this._ctx,
          r = layer._radius * NM_IN_METRES / MARKER_RADIUS * max_range;
          width = this.width;
          height = this.height;
        var centre_opacity = layer.options.centre_opacity;
        var edge_opacity = layer.options.edge_opacity;
        var max_range = layer.options.range_nm;
        var offset = layer.options.time_offset;
        var lit_proportion = layer.options.sequence_data.lit_proportion;


        let draw_light_sector = function (light_to_draw, i) {
            // is it a circle?
            var start_from_deg;
            var end_from_deg;
            
            if (light_to_draw.start == '0' && light_to_draw.end == '360') {
                start_from_deg = 0;
                end_from_deg = 360;
            }
            else {            
                start_from_deg = (90 + parseInt(light_to_draw.start)) % 360;
                end_from_deg = (90 + parseInt(light_to_draw.end)) % 360;
            }
            var angle_s = start_from_deg / 180 * Math.PI;
            var angle_e = end_from_deg / 180 * Math.PI;
            var radius = light_to_draw.range * r / max_range; // in proportion to longest range sector

            // what colour is the sector?
            var colours = light_to_draw.colour.split(';');
            var this_colour = colours[i % colours.length];

            // draw the sector
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.arc(p.x, p.y, radius, angle_s, angle_e);
            ctx.lineTo(p.x, p.y);
            ctx.closePath();

            // do a gradient fill. Set the opacity depending on the proportion of the time the light is lit
            // - this is so the ones with long periods don't look too bright
            var _centre_opacity = 
                lit_proportion < .05 ? 0.9
                : lit_proportion < .1 ? 0.4
                : lit_proportion < .2 ? 0.2
                : lit_proportion < .5 ? 0.1
                : lit_proportion >= .5 ? 0.05
                : 0.3;

            var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
            grad.addColorStop(0, chroma(this_colour).alpha(_centre_opacity));
            grad.addColorStop(1, chroma(this_colour).alpha(edge_opacity));
            ctx.fillStyle = (grad);
            ctx.fill();
        };

        // draw the rotating shutters which define the lighthouse sequence, as a clipping path
        let draw_rotating_shutters_clip_path = function(sequence, t) {

            var the_time = t ? t : 0;

            // rotation angle in degrees based on time and duration
            var rotation_angle = ((the_time + sequence.time_offset) / sequence.duration * 360) % 360;

            // build the clipping path based on the light sequence steps
            var start_angle = 0;
            ctx.beginPath();
            for (let step = 0; step < sequence.steps.length; step++) {
                var clip_angle_s = (rotation_angle + start_angle) % 360;
                var clip_angle_e = (rotation_angle + start_angle + sequence.steps[step][1] * 360 / sequence.duration) % 360;
                if (sequence.steps[step][0]) {
                    ctx.moveTo(p.x, p.y);
                    ctx.arc(p.x, p.y, r, clip_angle_s / 180 * Math.PI, clip_angle_e / 180 * Math.PI);
                    ctx.lineTo(p.x, p.y);
                }
                start_angle = start_angle + sequence.steps[step][1] * 360 / sequence.duration;
            };
            ctx.clip();
        };

        ctx.save();
        // draw the shutters clip path
        draw_rotating_shutters_clip_path(layer.options.sequence_data, t);
        // draw the sectors of the lighthouse  
        layer.options.sectors.forEach(draw_light_sector);
        ctx.restore(); // to clear the clip path
      }
    });

    L.Lighthouse = L.Circle.extend({
        initialize: function(latlng, options) {
            options.renderer = lighthouseRenderer;
            options.radius = MARKER_RADIUS;  // fake radius so it's drawn in the right place
            options.radius_mm = options.range_nm * NM_IN_METRES;
            options.sequence_data.time_offset = Math.random() * options.sequence_data.duration; // random so they don't all linke up
            options.interactive = false;
            options.centre_opacity = 0.6;
            options.edge_opacity = 0.0;
 
            // and call the circle initialiser
            L.Circle.prototype.initialize.call(this, latlng, options, {});
        },

        _updatePath: function(t) {
            this._renderer._updateLighthouse(this, t);
        }

      });

    let lh_popup = function(the_light) {
        // text for lighthouse information popup

        const ROUND_PLACES = 4;
        const llFormat = new Intl.NumberFormat('en-GB', {style: 'decimal', usegrouping: false, maximumFractionDigits: ROUND_PLACES}); 

        let name = the_light.name;
        let lat = llFormat.format(the_light.latlong.lat);
        let long = llFormat.format(the_light.latlong.lng);
        let height = the_light.height;
        let url = the_light.url;

        let popup = `<div class="lh-popup">
            <div class="lh-popup-head">${name}</div>
            <p><span class="lh-popup-title">Location: </span><span class="lh-popup-text">${lat}, ${long}</span></p>
            <p><span class="lh-popup-title">Height: </span><span class="lh-popup-text">${height}m</span></p>
            </div>`;
        if (url) {
            popup += `<p><span class="lh-popup-title">URL: </span><span class="lh-popup-text"><a href="${url}" target="_blank">${name}</a></span></p>`
        };
        return popup;
    };

