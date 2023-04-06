import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';
import { Database } from 'sqlite3';
import * as fs from 'node:fs';
import * as util from 'node:util';

type ToiebaRow = {
	term1: string;
	term2: string;
	score: number;
};

export default class extends Module {
	public readonly name = 'toieba';

	@autobind
	public install() {
		return {
			mentionHook: this.mentionHook
		};
	}

	@autobind
	private async mentionHook(msg: Message) {
		if (msg.text == null) return false;

		const query = msg.text.match(/\s+([^\s]+?)\s*と(い|言|云)えば(\?|？)?/);

		if (query == null) return false;

		const keyword = query[1];

		let retstr = "";

		if (fs.existsSync("sqlite3/toieba.sqlite3")){
			const database = new Database('sqlite3/toieba.sqlite3');
			try{
				let tryrows = (await util
					.promisify(database.all.bind(database, 'select term1,term2,score from related where term1 = ? order by score desc limit 50', keyword))
					.call(database)) as ToiebaRow[];
					if (tryrows.length > 0){
					}else{
						const ekeyword = keyword.replace(/(\%|\_|\!)/g,'!$1') + "%";
						this.ai.log(ekeyword);
						tryrows = (await util
							.promisify(database.all.bind(database, 'select term1,term2,score from related where term1 like ? escape \'!\' order by score desc limit 50', ekeyword))
							.call(database)) as ToiebaRow[];
				}
				let rows : ToiebaRow[] = [];
				//this.ai.log(keyword + String(tryrows.length));
				for (let i = 0; i < tryrows.length; i++){
					if (tryrows[i].term2.match(/^[A-Za-z0-9]*$/) == null){
						rows.push(tryrows[i]);
					}
				}
				if (rows.length < 1){
					retstr = "なんでしょう？";
				}else{
					let toieba = rows[Math.floor(Math.random() * rows.length)];
					if (toieba.term1 == keyword){
						retstr = (toieba.score < 1 ? "多分" : "きっと") + toieba.term2 + "とか？";
					}else{
						retstr = (toieba.score < 1 ? "多分" : "きっと") + toieba.term2 + "と何か関係が……？";
					}
				}
			}catch(e){
				this.ai.log(e.toString());
				// DO NOTHHING
			}
			await util.promisify(database.close).call(database);
		}else{
			retstr = "分かりません……";
		}
		
		msg.reply(retstr);

		return true;
	}
}
