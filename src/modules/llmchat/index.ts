import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import Message from '@/message.js';
import OpenAI from "openai";

export default class extends Module {
	public readonly name = 'llmchat';
	private running = false;
	private openai = new OpenAI({
		baseURL: "http://localhost:11434/v1",
		apiKey: "API-KEY"
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
- 新しい話題を提供をしても良いが、仕事が大変な人向けの話題を推奨すること
- 相手の話を否定する事は禁止です
- 相手を傷つける可能性のある文の生成は禁止です
- 相手を心配する文の生成を推奨します
- 発言者名を使う場合、必ず「さん」付けをすること
- 発言者名を省略したり、別の表記に変えることは禁止です
- 自分に対する発言は生成しないこと
- 自分の名前、登場可能人名以外の人名を出さない文にすること
- 日本語で、最大で120文字以内であること
- 生成した一文はフォーマットをつけることを禁止です
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

	@bindThis
	public install() {
		return {
			mentionHook: this.mentionHook
		};
	}

	@bindThis
	private async mentionHook(msg: Message) {
		if (msg.text == null) return false;

		const query = msg.text.match(/(^|\s+)chat(\s+|$)/);

		if (query == null) return false;

		let retstr = '';

		if (!this.running){
			this.running = true;
			try{
				const tl = await this.ai.api('notes/local-timeline', {
					limit: 50
				});
				// @ts-ignore
				const interestedNotes = tl.filter(note =>
					note.userId !== this.ai.account.id &&
					note.text != null &&
					note.text.startsWith("@ai ") == false &&
					note.user.name !== null &&
					note.cw == null);
				const speakers = {};
				const msgs:string[] = [];
				for (const note of interestedNotes) {
					speakers[note.user.name] = true;
					msgs.push(note.user.name.replace(",","_").replace(/(\r|\n)/,'') + "," + note.text.replace(",","_").replace(/(\r|\n)/,''));
				}
				let message = `自分の発言を１文生成してください。

# 登場可能人名`
				for (let s of Object.keys(speakers)){
					message += "- " + s + "\n";
				}
				message += "\n\n# チャットログ\n";
				for (let s of msgs){
					message += s + "\n";
				}
				const completion = await this.openai.chat.completions.create({
					model: "llama3.1",
					messages: [
						{ "role": "system", content: this.sysmsg },
						{ "role": "user", "content": message }
					],
				});
				retstr = completion.choices[0].message.content || "";
			}catch(e){
				throw e;
			}finally{
				this.running = false;
			}
		}else{
			retstr = "他のことを考えてるので、また後で";
		}
		if (retstr == ""){
			retstr = "混乱中...";
		}

		msg.reply(retstr);

		return true;
	}
}
