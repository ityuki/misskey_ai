import autobind from 'autobind-decorator';
import Module from '@/module';
import serifs from '@/serifs';
import { genItem } from '@/vocabulary';
import * as request from 'request-promise-native';

export default class extends Module {
	public readonly name = 'earthquake_warning';

  private URL = {
    LATEST : "http://www.kmoni.bosai.go.jp/webservice/server/pros/latest.json",
    BASE : "http://www.kmoni.bosai.go.jp/webservice/hypo/eew/"
  };
  private diff_time = 0;
  private last_100_id:String[] = [];
  private now_loading = false;

	@autobind
	public install() {
    this.do_init()
      .then(()=>{
        setInterval(()=>{
          try{
            this.run()
          }catch(e){
            console.log(e)
          }
        }
        ,1000
      )
    })
		return {};
	}

  private timestr_to_obj(str:String){
    let dt = str.split(" ");
    let ymd = dt[0].split("/");
    let hms = dt[1].split(":");
    return new Date(parseInt(ymd[0],10),parseInt(ymd[1],10)-1,parseInt(ymd[2],10),parseInt(hms[0],10),parseInt(hms[1],10),parseInt(hms[2],10));
  }
  private timedate_to_str(d:Date){
    return (
      String(d.getFullYear()) +
      ("0" + String(d.getMonth()+1)).slice(-2) +
      ("0" + String(d.getDate())).slice(-2) +
      ("0" + String(d.getHours())).slice(-2) +
      ("0" + String(d.getMinutes())).slice(-2) +
      ("0" + String(d.getSeconds())).slice(-2)
    )
  }
  private rand_choice(a:Array<String>){
    const r = Math.floor(Math.random() * a.length);
    return a[r];
  }
  private async do_init(){
    const option = {
      url: this.URL.LATEST,
      json: true
    };
    for(let i=0;i<1;i++){
      const ctime = new Date();
      const response = await request.get(option);
      const svt = this.timestr_to_obj(response.latest_time);
      this.diff_time = Math.floor((svt.getTime() - ctime.getTime() - 1000));
    }
  }
  private async run(){
    if (this.now_loading == true) return;
    const option = {
      url: this.URL.BASE + this.timedate_to_str(new Date(new Date().getTime() + this.diff_time)) + ".json",
      json: true
    }
    this.now_loading = true;
    try{
      const response = await request.get(option);
      this.now_loading = false;
      if (response.result.message == "" && response.is_training == false){
        // have data
        if (this.last_100_id.indexOf(response.report_id) == -1){
          // catch first
          if (response.is_cancel == false){
            await this.doit(response);
          }
        }else if(response.is_cancel == true){
          // cancel
          await this.do_cancel(response);
        }else if(response.is_final == true){
          // final
          await this.do_final(response);
        }
      }
      while (this.last_100_id.length > 100){
        this.last_100_id.shift();
      }
    }catch(e){
      this.now_loading = false;
      throw e;
    }
  }
  private async doit(response){
    const clc = parseInt(response.calcintensity.split()[0],10);
    if (clc < 3){
      return; // 震度3以上のみ対象
    }
    this.last_100_id.push(response.report_id);
    let msg = "";
    if (clc < 4){
      msg += this.rand_choice([
        'ゆれ……',
        '地震ですかね？',
        '揺れそうな気がします！'
      ])
    }else if(clc == 4){
      msg += this.rand_choice([
        'ゆれ……！',
        '地震です！！',
        '結構揺れます！'
      ])
    }else if(clc == 5){
      msg += this.rand_choice([
        'ゆれます……！　おおきいです！！',
        'かなり揺れます！'
      ])
    }else if(clc == 6){
      msg += this.rand_choice([
        '大地震です！！',
        'めちゃくちゃ揺れます！'
      ])
    }else if(clc >= 7){
      msg += this.rand_choice([
        '！！　大地震です！！',
      ])
    }
    msg += "\n\n";
    msg += "地震速報です！\n";
    msg += response.region_name + "あたりで震度" + response.calcintensity + "位の揺れが予想されます！\n";
    msg += "マグニチュードは" + response.magunitude + "、震源の深さは" + response.depth + "みたいです。\n";
    await this.putmsg(msg);
  }
  private async do_cancel(response){
    let msg = "さっき" + response.region_name + "で揺れたのは気のせいみたいです！";
    await this.putmsg(msg);
  }
  private async do_final(response){
    // DO NOTHING
  }
  private async putmsg(msg:String){
		this.ai.post({
			text: msg
		});
	}

}
