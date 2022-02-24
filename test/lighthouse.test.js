// tests for lighthouses.js



import {
	multi_light_entry, 
	single_light_entry
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

	describe('filling in light defaults', function () {
		it('should default range to 5 miles if no range specified', function() {
			chai.expect(multi_light_entry({"seamark:1:colour": "white"}, 1))
				.to.have.property("range", "5")
		});
			
		it('should default colour to white if no colour specified');
		it('should default period to 30s if no period specified');
	});

	describe('populating lighthouse data object', function () {
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
