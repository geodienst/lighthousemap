// tests for lighthouses.js



import {light_entry} from'../lighthouses.js';


// tests of light data parsing from geojson
describe('light_entry', function () {
	it('should return an object for a specified numbered light of a lighthouse, such as "seamark:light:1:character"', function () {
		chai.expect(light_entry({"seamark:light:1:character": "Fl"}, 1))
			.to.be.an('object', 'not returning an object');
		});

	it('should return an empty object for an un-numbered light of a lighthouse, such as "seamark:light:character"', function () {
		chai.expect(light_entry({"seamark:light:character": "Fl"}, 1))
			.to.be.empty;
		});

	it("should return the correct light's data", function () {
		chai.expect(light_entry({"seamark:light:1:character": "Fl", "seamark:light:2:character": "Oc"}, 2))
			.to.deep.equal({"character": "Oc"});
		});

	it('should change sector_start to start', function () {
		chai.expect(light_entry({"seamark:light:1:sector_start": "100"}, 1))
			.to.deep.equal({"start": "100"});
		});

	it('should change sector_end to end', function () {
		chai.expect(light_entry({"seamark:light:1:sector_end": "100"}, 1))
			.to.deep.equal({"end": "100"});
		});
});

