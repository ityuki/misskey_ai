import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import serifs from '@/serifs.js';
import { genItem } from '@/vocabulary.js';
import config from '@/config.js';

export default class extends Module {
	public readonly name = 'noting';

	private last_msg_date = '';

	@bindThis
	public install() {
		if (config.notingEnabled === false) return {};

		setInterval(() => {
			if ((new Date()).toDateString() == this.last_msg_date) return;
			if (Math.random() < 0.04) {
				this.last_msg_date = (new Date()).toDateString();
				this.post();
			}
		}, 1000 * 60 * 10);

		return {};
	}

	@bindThis
	private post() {
		const notes = [
			...serifs.noting.notes,
			() => {
				const item = genItem();
				return serifs.noting.want(item);
			},
			() => {
				const item = genItem();
				return serifs.noting.see(item);
			},
			() => {
				const item = genItem();
				return serifs.noting.expire(item);
			},
		];

		const note = notes[Math.floor(Math.random() * notes.length)];

		// TODO: 季節に応じたセリフ

		this.ai.post({
			text: typeof note === 'function' ? note() : note
		});
	}
}
