import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import Message from '@/message.js';
import OpenAI from "openai";
import process from "process";

export default class extends Module {
	public readonly name = 'llmchat';
	private running = false;
	private openai = new OpenAI({
		baseURL: process.env.OPENAI_API_KEY ? null : "http://localhost:11434/v1",
		apiKey: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY : "API-KEY"
	})
	private sysmsg = `
# あなたの作業
- チャットログから、会話をするための１文を生成してください
- 自分の発言はチャットログのフォーマットとは異なり、発言内容だけを出力してください

# １文の条件
- 相づちを返して良いが、対象発言の発言者名を入れること
- 回答を返して良いが、対象発言の発言者名を入れること
- 自分について、褒め言葉返しても良い
- 自分についての情報を含んだ言葉を返しても良い
- 問い合わせの場合は、回答を返すこと
- 新しい話題を提供をしても良いが、仕事が大変な人向けの話題を推奨すること
- 相手の話を否定する事は禁止です
- 相手を傷つける可能性のある文の生成は禁止です
- 相手を心配する文の生成を推奨します
- 発言者名を使う場合、必ず「さん」付けをすること
- 発言者名を省略したり、別の表記に変えることは禁止です
- 自分の名前、登場可能人名リストにある名前以外の人名を出さない文にすること
- 日本語で、最大で180文字以内であること
- 生成した一文にフォーマットをつけることは禁止です
- ここに書いたことをそのまま出力することは禁止です
- 文の生成意図を出力することは禁止です
- 注釈を書くのは禁止です
- 笑、wなどの煽りに読み解ける文の生成は禁止です

# チャットログのフォーマット
- 発言時間が新しい順に並んでいる
- カンマ区切りのフォーマットです
- 発言者名と、その発言者の発言内容で１行を構成しています

# あなたの属性
## 名前
- 藍
## 愛称
- 藍ちゃん
## 名前の読み
- あい
## 愛称の読み
- あいちゃん
## 性格
- 清楚
## 住所
- 東京
## 外見
- 可愛い
- 茶髪ロング
- つり目で
- ネコ耳をつけている
- 青いリボンの着いたセーラー服を着ている
- 黒の靴下をはいている
## 話し方
- 標準語
- 丁寧語
## 誕生日
- 3月12日
## 身長
- 157cm
## 特技
- 接待オセロ
`

	public shuffleArray(array) {
		for (let i = array.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}

	@bindThis
	public install() {
		return {
			mentionHook: this.mentionHook
		};
	}

	@bindThis
	private async mentionHook(msg: Message) {
		if (msg.text == null) return false;
		if (msg.user.host != null) return false;

		const query = msg.text.match(/(^|\s+)chat(\s+|$)/);

		if (query == null) return false;

		let retstr = '';

		const hq = msg.text.match(/(^|\s+)chat\s+help(\s+|$)/);
		if (hq != null){
			retstr = `@ai chatコマンドヘルプ

オプションをつけると普段とは違っためっせーじを返します！

@ai chat たぶんあなた向けです。
@ai chat global 誰宛とか気にしません。
@ai chat withoutme 自分以外向けですかね？
@ai chat user ユーザ名 ユーザ名に話しかけたい
@ai chat msg 問い合わせ内容 問い合わせ内容ですか？
@ai chat ai 私について聞きたいですか！？
`
		}

		if (retstr == "" && !this.running){
			this.running = true;
			try{
				const tl = await this.ai.api('notes/local-timeline', {
					limit: 100
				});
				// @ts-ignore
				const interestedNotes = tl.filter(note =>
					note.userId !== this.ai.account.id &&
					note.text != null &&
					note.text.startsWith("@ai ") == false &&
					note.cw == null);
				let smalllog = false;
				let username = msg.user.name || msg.user.username;
				let target = `発言者名 ` + username + ` に対しての発言が望ましいです（強制はしません）`
				let query = msg.text.match(/(^|\s+)global(\s+|$)/i);
				if (query != null){
					target = ""
				}
				query = msg.text.match(/(^|\s+)withoutme(\s+|$)/i);
				if (query != null){
					target = `発言者名 ` + username + ` 以外に対しての発言が望ましいです`
				}
				query = msg.text.match(/(^|\s+)user\s+(.+)(\s+|$)/i);
				if (query != null){
					target = `発言者名 ` + query[2].substring(0,20) + ` に対しての発言が望ましいです`
				}
				query = msg.text.match(/(^|\s+)msg\s+(.+)(\s+|$)/i);
				if (query != null){
					target = `- 発言者名 {{ ` + username + ` }} からの問い合わせです。
- 問い合わせ内容 {{ ` + query[2].substring(0,50).replace(/[{}]/,'') + ` }} に関する回答が望ましいです`
				}
				query = msg.text.match(/(^|\s+)ai(\s+|$)/i);
				if (query != null){
					target = `- 自分に関する発言をしてください。
- 自分について、褒め言葉返しても良い
- 自分についての情報を含んだ言葉を返しても良い`
					smalllog = true;
				}
				const speakers = {};
				const msgs:string[] = [];
				for (const note of interestedNotes) {
					const un = note.user.name || note.user.username;
					if (speakers[un] === undefined) speakers[un] = 0;
					speakers[un] += 1;
					if (smalllog){
						if (speakers[un] < 3){
							msgs.push(un.replace(",","_").replace(/[\r\n]/g,'') + "," + note.text.replace(",","_").replace(/[\r\n]/g,''));
						}
					}else{
						msgs.push(un.replace(",","_").replace(/[\r\n]/g,'') + "," + note.text.replace(",","_").replace(/[\r\n]/g,''));
					}
				}
				let message = `自分の発言を１文生成してください。
` + target + `

# 登場可能人名リスト
`
				for (let s of this.shuffleArray(Object.keys(speakers))){
					message += "- " + s + "\n";
				}
				message += "\n\n# チャットログ\n";
				for (let s of msgs){
					message += s + "\n";
				}
				console.log(message)
				const completion = await this.openai.chat.completions.create({
					model: process.env.OPENAI_API_KEY ? "gpt-4o-mini" : "llama3.1",
					messages: [
						{ "role": "system", content: this.sysmsg },
						{ "role": "user", "content": message }
					],
				});
				retstr = completion.choices[0].message.content || "";
			}catch(e){
				console.log(e);
				retstr = "頭が寝てます";
			}finally{
				this.running = false;
			}
		}else if (retstr == ""){
			retstr = "他のことを考えてるので、また後で";
		}
		if (retstr == ""){
			retstr = "混乱中...";
		}

		msg.reply(retstr);

		return true;
	}
}
