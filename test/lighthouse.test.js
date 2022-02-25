// tests for lighthouses.js



import {
	multi_light_entry, 
	single_light_entry,
	set_light_defaults
} 
from'../lighthouses.js';

describe('lighthouse data parsing', function () {

	// tests of light data parsing from geojson

	describe('tags for a single light', function () {
		it('should return an object with the details of un-numbered light of a lighthouse, such as "seamark:light:character"', function () {
			chai.expect(single_light_entry({"seamark:light:character": "Fl"}))
				.to.be.an('object', 'not returning an object');
			});

		it('should set bearing for start to 0 degrees', function () {
			chai.expect(single_light_entry({"seamark:light:character": "Fl"}))
				.to.have.property("start", "0")
			});

		it('should set bearing for end to 360 degrees', function () {
			chai.expect(single_light_entry({"seamark:light:character": "Fl"}))
				.to.include({"end": "360"})
			});
	});

	describe('tags for multi-light lighthouse', function () {
		it('should return an object for a specified numbered light of a lighthouse, such as "seamark:light:1:character"', function () {
			chai.expect(multi_light_entry({"seamark:light:1:character": "Fl"}, 1))
				.to.be.an('object', 'not returning an object');
			});

		it('should return an empty object for an un-numbered light of a lighthouse, such as "seamark:light:character"', function () {
			chai.expect(multi_light_entry({"seamark:light:character": "Fl"}, 1))
				.to.be.empty;
			});

		it("should return the correct light's data", function () {
			chai.expect(multi_light_entry({"seamark:light:1:character": "Fl", "seamark:light:2:character": "Oc"}, 2))
				.to.eql({"character": "Oc"});
			});

		it('should change sector_start key to "start"', function () {
			chai.expect(multi_light_entry({"seamark:light:1:sector_start": "100"}, 1))
				.to.eql({"start": "100"});
			});

		it('should change sector_end key to "end"', function () {
			chai.expect(multi_light_entry({"seamark:light:1:sector_end": "100"}, 1))
				.to.eql({"end": "100"});
			});
	});

	describe('filling in light defaults if not specified', function () {
		it('should default range to 5 miles if no range specified', function() {
			chai.expect(set_light_defaults({"colour": "white"}))
				.to.have.property("range", "5")
		});
		it('should respect actual range if specified', function () {
			chai.expect(set_light_defaults({"colour": "white", "range": "12"}))
				.to.have.property("range", "12")
		});
		it('should default colour to white if no colour specified', function () {
			chai.expect(set_light_defaults({"range": "10"}))
				.to.have.property("colour", "white")
		});
		it('should respect actual colour if specified', function () {
			chai.expect(set_light_defaults({"range": "10", "colour": "red"}))
				.to.have.property("colour", "red")
		});
		it('should default period to 30s if no period specified', function () {
			chai.expect(set_light_defaults({"colour": "white"}))
				.to.have.property("period", "30")
		});
		it('should respect actual period if specified', function () {
			chai.expect(set_light_defaults({"range": "10", "period": "15"}))
				.to.have.property("period", "15")
		});
	});

	describe('populating lighthouse data object', function () {

		describe('populating a multi-light lighthouse without defaults', function () {

			// tags expected in a multi-light lighthouse
			const tags_multi_no_default = {
				"name": "Multi Lighthouse",
				"seamark:name": "multi no default",
				"seamark:light:1:range": "10",
				"seamark:light:1:colour": "white",
				"seamark:light:1:height": "23",
				"seamark:light:1:period": "60",
				"seamark:light:1:character": "Fl",
				"seamark:light:1:sector_start": "200",
				"seamark:light:1:sector_end": "320"
			};

		});


		it('should set the lighthouse range to the longest of the constituent light ranges'); 
		it('should set the lighthouse height to the greatest of the constituent light heights'); 
		it('should use the seamark:name if available');
		it("should use the name if seamark:name not available");

		it('');
	});





});






describe('lighthouse sequence and colour calculation', function () {
	// b
	it('should ');
});
