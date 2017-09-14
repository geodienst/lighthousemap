L.Light = L.Circle.extend({
	setState: function(state) {
		if (this._state !== state) {
			L.Path.prototype.setStyle.call(this, {fill: !!state});
			this._state = state;
		}
	}
});

L.Light.Sequence = class {
	constructor(seq) {
		this.setSequence(seq);
	}

	setSequence(seq) {
		this.text = seq;
		
		this.steps = seq.split('+').map(step => {
			let state = true;
			if (/^\(\d+(\.\d+)?\)$/.test(step)) {
				state = false;
				step = step.substring(1, step.length - 1);
			}
			return [state, parseFloat(step, 10)];
		});

		this.duration = this.steps.reduce((sum, step) => sum + step[1], 0);

		this.offset = Math.random() * this.duration;
	}

	isValid() {
		return this.steps.every(step => !isNaN(step[1]));
	}

	state(time) {
		if (isNaN(this.duration))
			return undefined;

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