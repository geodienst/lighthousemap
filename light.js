// light.js - Standalone light sequence parser
// Extracted from leaflet.light.js, no external dependencies
//
// Usage:
//   let seq = LightSequence.parse(tags, '#FF0');
//   let color = seq.state(timeInSeconds); // returns color string or false

window.LightSequence = {};

LightSequence.parse = function(tags, fallbackColor = '#FF0') {
	renameProperty = function(tags, property) {
		old_key = 'seamark:light:1:' + property
		new_key = 'seamark:light:' + property

		if (!(new_key in tags) && old_key in tags) {
			tags[new_key] = tags[old_key]
		}

		return tags
	}

	tags = renameProperty(tags, 'character')
	tags = renameProperty(tags, 'colour')
	tags = renameProperty(tags, 'group')
	tags = renameProperty(tags, 'height')
	tags = renameProperty(tags, 'period')
	tags = renameProperty(tags, 'range')
	tags = renameProperty(tags, 'sector_end')
	tags = renameProperty(tags, 'sector_start')
	tags = renameProperty(tags, 'sequence')

	let character = tags['seamark:light:character'] || 'Fl';

	// Normalize common misspellings in OSM data
	character = character
		.replace(/^FI$/, 'Fl')       // uppercase I instead of lowercase l
		.replace(/^LFI$/, 'LFl')
		.replace(/^FL$/, 'Fl')
		.replace(/^LFL$/, 'LFl')
		.replace(/^fl$/, 'Fl')
		.replace(/^flashing$/i, 'Fl')
		.replace(/^Fl_of\d+$/, 'Fl') // e.g. Fl_of1923
		.replace(/^Fl IMH$/, 'Fl')   // junk suffix
		.replace(/^AlFl$/, 'Al.Fl')  // missing dot
		.replace(/^AlQ$/, 'Al.Q')    // missing dot
		.replace(/^W$/, 'Fl');       // bare color used as character

	let colors = (tags['seamark:light:colour'] || fallbackColor).split(';');

	let sequence = tags['seamark:light:sequence'];

	if (character.match(/^Al\./)) {// Alternating color!
		character = character.substring(3);

		if (character == 'Iso' && sequence && sequence.match(/^\d+$/))
			sequence = sequence + '+(' + sequence + ')';
	}

	if (character == 'Iso' && !sequence && 'seamark:light:period' in tags) {
		const period = parseFloat(tags['seamark:light:period'], 10);
		sequence = (period / 2) + '+(' + (period / 2) + ')';
	}

	// Synthesize sequence from character + period when no explicit sequence is provided
	// Handles lights tagged with e.g. seamark:light:character=Fl + seamark:light:period=10
	if (!sequence && 'seamark:light:period' in tags) {
		const period = parseFloat(tags['seamark:light:period'], 10);
		const group = parseInt(tags['seamark:light:group'], 10) || 1;

		if (character == 'F') {
			// Fixed light, no sequence needed — will be handled by switch below
		} else if (character == 'Fl' || character == 'LFl') {
			const flash = character == 'LFl' ? 2.0 : 0.5;
			const totalFlash = group * flash + (group - 1) * flash;
			const dark = period - totalFlash;
			if (dark > 0) {
				sequence = Array(group).fill(flash + '+(' + flash + ')').join('+');
				// Replace last dark interval with the actual remainder
				var parts = sequence.split('+');
				parts[parts.length - 1] = '(' + dark + ')';
				sequence = parts.join('+');
			} else {
				sequence = flash + '+(' + (period - flash) + ')';
			}
		} else if (character == 'Oc') {
			const dark = 0.5;
			if (group > 1) {
				// Grouped occulting: multiple dark blinks per period
				const totalDark = group * dark + (group - 1) * dark;
				const light = period - totalDark;
				if (light > 0) {
					sequence = Array(group).fill('(' + dark + ')+' + dark).join('+');
					// Replace last light interval with the actual remainder
					var parts = sequence.split('+');
					parts[parts.length - 1] = light;
					sequence = parts.join('+');
				} else {
					sequence = (period - dark) + '+(' + dark + ')';
				}
			} else {
				sequence = (period - dark) + '+(' + dark + ')';
			}
		} else if (character == 'Q' || character == 'IQ') {
			const flash = 0.25;
			sequence = Array(group).fill(flash + '+(' + flash + ')').join('+');
			var parts = sequence.split('+');
			parts[parts.length - 1] = '(' + (period - group * flash * 2 + flash) + ')';
			sequence = parts.join('+');
		} else if (character == 'VQ' || character == 'IVQ') {
			// Very Quick: 120 flashes/min = 0.5s cycle (0.1s flash, 0.4s dark)
			const flash = 0.1;
			const cycle = 0.5;
			sequence = Array(group).fill(flash + '+(' + (cycle - flash) + ')').join('+');
			var parts = sequence.split('+');
			parts[parts.length - 1] = '(' + (period - group * cycle + (cycle - flash)) + ')';
			sequence = parts.join('+');
		} else if (character == 'UQ' || character == 'IUQ') {
			// Ultra Quick: 240 flashes/min = 0.25s cycle (0.05s flash, 0.2s dark)
			const flash = 0.05;
			const cycle = 0.25;
			sequence = Array(group).fill(flash + '+(' + (cycle - flash) + ')').join('+');
			var parts = sequence.split('+');
			parts[parts.length - 1] = '(' + (period - group * cycle + (cycle - flash)) + ')';
			sequence = parts.join('+');
		} else if (character == 'Q+LFl' || character == 'VQ+LFl' || character == 'UQ+LFl') {
			// Composite: quick flashes followed by a long flash (e.g. South Cardinal)
			const base = character.split('+')[0]; // Q, VQ, or UQ
			const flash = base == 'UQ' ? 0.05 : base == 'VQ' ? 0.1 : 0.2;
			const gap = base == 'UQ' ? 0.2 : base == 'VQ' ? 0.4 : 0.2;
			const longflash = 2.0;
			const remainder = period - (group * (flash + gap) + longflash);
			if (remainder > 0) {
				sequence = Array(group).fill(flash + '+(' + gap + ')').join('+') + '+' + longflash + '+(' + remainder + ')';
			} else {
				sequence = Array(group).fill(flash + '+(' + gap + ')').join('+') + '+' + longflash + '+(' + Math.max(0.5, gap) + ')';
			}
			character = 'Fl';
		}
	}

	// For those Flashing lights that have a single number sequence
	if (character.match(/^Fl|LFl|IQ$/) && sequence && sequence.match(/^\d+$/)) {
		const flash = parseFloat(sequence)
		const remainder = 'seamark:light:period' in tags ? (parseFloat(tags['seamark:light:period']) - flash) : flash;
		character = 'Fl';
		sequence = flash + '+(' + remainder + ')';
	}

	// Convert FFl (Fixed and Flashing) to Fl
	if (character == 'FFl') {
		character = 'Fl';
		if (sequence && sequence.match(/^\d+$/) && tags['seamark:light:period'] && tags['seamark:light:period'].match(/^\d+$/)) {
			sequence = parseFloat(sequence, 10) + '+(' + (parseFloat(tags['seamark:light:period'], 10) - parseFloat(sequence, 10)) + ')';
		}
	}

	// Convert FLFl (Fixed/Long Flash) and OcFl (Occulting/Flash) to Fl — they have standard sequences
	if ((character == 'FLFl' || character == 'OcFl') && sequence) {
		character = 'Fl';
	}

	// Convert Q/VQ/UQ with +LFL sequence to Fl
	if ((character == 'Q' || character == 'VQ' || character == 'UQ') && 'seamark:light:period' in tags && sequence && sequence.match(/^[VU]?Q(\(\d+\))?\s*\+\s*LFL/i)) {
		let qlfl = sequence.match(/^[VU]?Q(\((\d+)\))?\s*\+\s*LFL/i);
		const period = parseFloat(tags['seamark:light:period']);
		const short = parseFloat(qlfl[2] || tags['seamark:light:group'] || 1);
		const flash = character == 'UQ' ? 0.05 : character == 'VQ' ? 0.1 : 0.2;
		const gap = character == 'UQ' ? 0.2 : character == 'VQ' ? 0.4 : 0.2;
		const longflash = 1.0;
		const remainder = period - (short * (flash + gap) + longflash)

		if (remainder < 0)
			throw 'Could not convert ' + character + '+LFL to Fl: negative remainder';

		character = 'Fl';
		sequence = Array(short).fill(flash + '+(' + gap + ')').join('+') + '+' + longflash + '+(' + remainder + ')';
	}

	// Convert simple quick flashes which indicates how many with group and the total duration of that group with sequence into Fl.
	if (character == 'Q' && sequence && sequence.match(/^\d$/) && 'seamark:light:group' in tags) {
		const short = parseFloat(tags['seamark:light:group']);
		const flash = parseFloat(sequence) / short / 2;
		character = 'Fl';
		sequence = Array(short).fill(flash + '+(' + flash + ')').join('+');
	}

	// Strip outer parentheses wrapping entire sequence (OSM data quirk)
	// e.g. "(00.3+(04.7))" → "00.3+(04.7)"
	if (sequence && sequence.match(/^\(.*\)$/)) {
		const inner = sequence.substring(1, sequence.length - 1);
		// Only strip if the inner content looks like a valid sequence (has + separators)
		if (inner.includes('+')) {
			sequence = inner;
		}
	}

	// Strip bracket group notation e.g. "[2]5+(15)" → "5+(15)", "[3]8+(12)" → "8+(12)"
	// The group count is already in seamark:light:group
	if (sequence && sequence.match(/^\[\d+\]/)) {
		sequence = sequence.replace(/^\[\d+\]/, '');
	}

	// Strip bracket repeat notation e.g. "[00.5+(00.5)]9+(06.0)" → expand the repeated part
	if (sequence && sequence.match(/^\[[\d.+()]+\]\d+/)) {
		const m = sequence.match(/^\[([\d.+()]+)\](\d+)\+(.+)$/);
		if (m) {
			const repeatedPart = m[1];
			const count = parseInt(m[2]);
			const remainder = m[3];
			sequence = Array(count).fill(repeatedPart).join('+') + '+' + remainder;
		}
	}

	// Remove the 'second' suffix
	if (sequence) sequence = sequence.replace(/s$/, '');

	// Composite characters with explicit sequences can be treated as Fl
	if ((character == 'Q+LFl' || character == 'VQ+LFl' || character == 'UQ+LFl') && sequence) {
		character = 'Fl';
	}

	// Bare 'Al' without sub-type: treat as fixed alternating
	if (character == 'Al') {
		if (sequence) {
			character = 'Fl';
		} else {
			return new LightSequence.Fixed(colors[0]);
		}
	}

	// Handle Fl(N) where group count is embedded in character
	if (character.match(/^Fl\(\d+\)$/)) {
		character = 'Fl';
	}

	switch (character) {
		case 'F': // Fixed Light
			return new LightSequence.Fixed(colors[0]);

		case 'Iso':
			return new LightSequence.CombinedSequence(colors.map(color => {
				return new LightSequence.Sequence(sequence, color);
			}));

		case 'Oc': // Occulting Light
		case 'Fl': // Flashing Light
		case 'LFl': // Long Flash Light
		case 'Q': // Quick Flashing Light
		case 'VQ': // Very Quick Flashing Light
		case 'UQ': // Ultra Quick Flashing Light
		case 'IQ': // Interrupted Quick Flashing Light
		case 'IVQ': // Interrupted Very Quick Flashing Light
		case 'IUQ': // Interrupted Ultra Quick Flashing Light
		case 'Mo':
			if (!sequence || sequence.match(/^\d+$/))
				throw 'Unexpected sequence: ' + sequence;

			const sequences = sequence.split(',').map((sequence, i) => {
				let color = colors[i % colors.length];

				// Does the sequence start with the color?
				let letter = sequence.match(/^\[([A-Z]+)\.\](.+)$/);
				if (letter) {
					const expr = new RegExp('^' + letter[1], 'i');
					color = colors.find(color => color.match(expr));
					sequence = letter[2];
				}

				return new LightSequence.Sequence(sequence, color);
			});

			if (sequences.length < colors.length)
				console.warn('There are fewer sequences than colors', {character, sequence, colors}, tags);

			return new LightSequence.CombinedSequence(sequences);

	 	default:
			throw 'Unknown character: ' + character
	}
}

LightSequence.Fixed = class {
	constructor(color) {
		this.color = color;
	}

	state(time) {
		return this.color;
	}
}

LightSequence.CombinedSequence = class {
	constructor(sequences) {
		this.sequences = sequences;

		this.sequences.forEach(sequence => {
			sequence.offset = 0;
		});

		this.duration = this.sequences.reduce((sum, seq) => sum + seq.duration, 0);

		this.offset = Math.random() * this.duration;
	}

	state(time) {
		let dt = (this.offset + time) % this.duration;
		let i = 0;

		while (dt > this.sequences[i].duration) {
			dt -= this.sequences[i++].duration;
		}

		return this.sequences[i].state(dt);
	}
}

LightSequence.Sequence = class {
	constructor(seq, color=true) {
		this.setSequence(seq, color);
	}

	setSequence(seq, color) {
		this.text = seq;

		this.steps = seq.replace(/\s/g, '').split('+').map(step => {
			let state = color;
			if (/^\(\d*\.?\d+\)$/.test(step)) {
				state = false;
				step = step.substring(1, step.length - 1);
			}
			return [state, parseFloat(step.replace(',', '.'), 10)];
		});

		this.duration = this.steps.reduce((sum, step) => sum + step[1], 0);

		if (isNaN(this.duration))
			throw 'Cannot parse sequence "' + this.text + '"';

		this.offset = Math.random() * this.duration;
	}

	state(time) {
		let dt = (this.offset + time) % this.duration;

		for (let i = 0; i < this.steps.length; ++i) {
			if (dt < this.steps[i][1])
				return this.steps[i][0];
			else
				dt -= this.steps[i][1];
		}
		throw new Error('Ran out of steps while still inside duration?');
	}
}
