import autobind from 'autobind-decorator';
import Module from '@/module';
import serifs from '@/serifs';
import { genItem } from '@/vocabulary';
import config from '@/config';

export default class extends Module {
	public readonly name = 'noting';

	private last_msg_date = '';

	@autobind
	public install() {
		if (config.notingEnabled === false) return {};

		if ((new Date()).toDateString() == this.last_msg_date) return {};

		setInterval(() => {
			if (Math.random() < 0.04) {
				this.last_msg_date = (new Date()).toDateString();
				this.post();
			}
		}, 1000 * 60 * 10);

		return {};
	}

	@autobind
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
