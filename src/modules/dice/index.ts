import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';

export default class extends Module {
	public readonly name = 'dice';

	@autobind
	public install() {
		return {
			mentionHook: this.mentionHook
		};
	}

	@autobind
	private async mentionHook(msg: Message) {
		if (msg.text == null) return false;

		const query = msg.text.match(/([0-9]+)[dD]([0-9]+)(?:\s*(\<|\<\=|\>|\>\=|\=|\=\=|\!\=|\<\>)\s*([0-9]+))?/);

		if (query == null) return false;

		const times = parseInt(query[1], 10);
		const dice = parseInt(query[2], 10);
		const opt_test = query[3];
		const opt_val_str = query[4];
		let opt_val = -1;
		if (opt_val_str){ opt_val = parseInt(opt_val_str,10); }

		if (times < 1 || times > 10) return false;
		if (dice < 2 || dice > 1000) return false;

		const results: number[] = [];
		const opt_results : boolean[] = [];
		let opt_sum = 0

		for (let i = 0; i < times; i++) {
			let v = Math.floor(Math.random() * dice) + 1
			results.push(v);
			opt_sum += v;
		}
		if (times > 1) {
			results.push(opt_sum);
		}
		if (opt_val >= 0){
			for (let i = 0; i < results.length; i++){
				let v = results[i];
				switch(opt_test){
					case "<": opt_results.push(v < opt_val); break;
					case "<=": opt_results.push(v <= opt_val); break;
					case ">": opt_results.push(v > opt_val); break;
					case ">=": opt_results.push(v >= opt_val); break;
					case "=": case "==": opt_results.push(v == opt_val); break;
					case "!=": case "<>": opt_results.push(v != opt_val); break;
				}
			}
		}
		
		let opt_str = "";
		if (opt_val >= 0){
			if (times == 1){
				opt_str = opt_results[0] ? " 成功です！" : " 不成功です……";
			}else{
				let ok = 0;
				for(let i=0;i<times;i++){
					if (opt_results[i]){ ok++; }
				}
				let ng = times-ok;
				opt_str = "  成功 " + String(ok) + " 件,  不成功 " + String(ng) + " 件,  平均 " + String(Math.floor(100*ok/times)) + " % 位成功しました。\n合計は " + String(results[times]) + " です！　こちらは " + (opt_results[times] ? "成功です！": "不成功です……");
				results.pop();
				opt_results.pop();
			}
		}
		
		msg.reply(serifs.dice.done(results.join(' ')) + opt_str);

		return true;
	}
}
