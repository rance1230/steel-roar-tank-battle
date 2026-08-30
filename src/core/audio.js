"use strict";
/* core/audio — 合成SE + 内嵌BGM */
/* ============================================================
   音频: 合成音效 + 内嵌BGM
   ============================================================ */
let AC=null,master=null,bgmBus=null,seBus=null,bgmBooted=false;
function initAudio(){ if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}
  if(AC){ if(AC.state==='suspended')AC.resume();
    if(!master){ master=AC.createGain(); master.gain.value=ST.muted?0:1; master.connect(AC.destination); }
    if(!bgmBus){ bgmBus=AC.createGain(); bgmBus.connect(master); }
    if(!seBus){ seBus=AC.createGain(); seBus.connect(master); }
    applyVolumes();
    if(!bgmBooted){ bgmBooted=true; if(ST.state==='title')BGM.play('title',true); } } }
function applyVolumes(){ if(bgmBus)bgmBus.gain.value=VOLS[SET.bgm]; if(seBus)seBus.gain.value=SEVOLS[SET.se]; }
function beep(f,d,type,v,slide){ if(!AC||ST.muted)return; try{
  const o=AC.createOscillator(),g=AC.createGain(),t0=AC.currentTime;
  o.type=type||'square'; o.frequency.setValueAtTime(f,t0);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t0+d);
  g.gain.setValueAtTime(v||0.06,t0); g.gain.exponentialRampToValueAtTime(0.0008,t0+d);
  o.connect(g);g.connect(seBus||AC.destination);o.start(t0);o.stop(t0+d);
}catch(e){} }
function noiz(d,v){ if(!AC||ST.muted)return; try{
  const n=(AC.sampleRate*d)|0,b=AC.createBuffer(1,n,AC.sampleRate),ch=b.getChannelData(0);
  for(let i=0;i<n;i++)ch[i]=(Math.random()*2-1)*(1-i/n);
  const s=AC.createBufferSource(),g=AC.createGain(); s.buffer=b; g.gain.value=v||0.15;
  s.connect(g);g.connect(seBus||AC.destination);s.start();
}catch(e){} }
const SFX={
  mg:()=>beep(760+rnd(120),0.035,'square',0.022),
  cannon:()=>{beep(150,0.16,'square',0.1,-90);noiz(0.12,0.08);},
  missile:()=>beep(500,0.28,'sawtooth',0.05,-240),
  boom:()=>{const t=Math.min(6,(typeof COMBO!=='undefined'?COMBO.tier:0));noiz(0.35,0.2+t*0.012);beep(85+t*9,0.28,'triangle',0.14+t*0.01,-55);},
  bigboom:()=>{noiz(0.6,0.28);beep(60,0.5,'triangle',0.18,-40);},
  ram:()=>{noiz(0.12,0.2);beep(120,0.1,'square',0.1,-60);},
  reflect:()=>beep(900,0.12,'square',0.07,700),
  hurt:()=>beep(200,0.12,'sawtooth',0.09,-120),
  heal:()=>{beep(620,0.08,'square',0.06);setTimeout(()=>beep(930,0.1,'square',0.06),70);},
  thunder:()=>{noiz(0.7,0.24);beep(55,0.6,'triangle',0.16,-30);},
  horn:()=>{beep(110,0.5,'sawtooth',0.14);setTimeout(()=>beep(98,0.6,'sawtooth',0.14),260);},
  strike:()=>{beep(300,0.4,'sawtooth',0.07,-160);},
  pick:()=>beep(1000,0.06,'square',0.05),
  combo:t=>{beep(480+t*140,0.1,'square',0.05+t*0.012);if(t>=3)beep(720+t*160,0.12,'square',0.05,200);},
  drop:()=>beep(500,0.1,'square',0.05,300),
};
let mgSndT=0;
const BGM={
  cur:null,name:'',token:0,bufs:{},
  async get(nm){
    if(this.bufs[nm])return this.bufs[nm];
    const b64=AU[nm]; if(!b64)throw new Error('no track');
    const bin=atob(b64),len=bin.length,u=new Uint8Array(len);
    for(let i=0;i<len;i++)u[i]=bin.charCodeAt(i);
    const ab=await new Promise((res,rej)=>{ try{ const p=AC.decodeAudioData(u.buffer,res,rej); if(p&&p.then)p.then(res,rej); }catch(e){rej(e);} });
    const d=ab.getChannelData(0),sr=ab.sampleRate,th=0.004;
    let s=0;while(s<d.length&&Math.abs(d[s])<th)s++;
    let e=d.length-1;while(e>s&&Math.abs(d[e])<th)e--;
    const pad=Math.round(sr*0.008);
    const info={buf:ab,ls:Math.max(0,s-pad)/sr,le:Math.min(d.length-1,e+pad)/sr};
    this.bufs[nm]=info;return info;
  },
  async play(nm,loop){
    if(!AC)return; const tk=++this.token;
    try{
      const t=await this.get(nm);
      if(tk!==this.token)return;
      this.stop();
      const src=AC.createBufferSource(); src.buffer=t.buf;
      if(loop){src.loop=true;src.loopStart=t.ls;src.loopEnd=t.le;}
      src.connect(bgmBus||master||AC.destination);
      src.start(0,t.ls);
      this.cur=src;this.name=nm;
    }catch(e){}
  },
  stop(){ if(this.cur){try{this.cur.stop();}catch(e){}} this.cur=null;this.name=''; },
};
const STAGE_MUSIC=['stage1','stage2','stage3','stage1','stage2','stage3','stage3'];
