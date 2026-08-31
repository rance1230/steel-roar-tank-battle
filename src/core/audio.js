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
function sfxArgs(x,y,extra){
  const o=(typeof x==='object'&&x)?Object.assign({},x):{};
  if(typeof x==='number')o.x=x;
  if(typeof y==='number')o.y=y;
  if(extra)Object.assign(o,extra);
  return o;
}
function sfxOpt(o,extra){ return Object.assign({},o||{},extra||{}); }
function sfxSpatial(o){
  o=o||{};
  const lim=(typeof clamp==='function')?clamp:((v,a,b)=>v<a?a:v>b?b:v);
  let gain=o.gain===undefined?1:o.gain, pan=o.pan||0, lp=o.lp||9000;
  if(o.x!==undefined&&o.y!==undefined&&typeof player!=='undefined'&&player){
    const dx=o.x-player.x,dy=o.y-player.y,d=Math.hypot(dx,dy);
    const near=lim(1-d/520,0.18,1);
    gain*=0.32+near*0.68;
    pan=lim(pan+dx/260,-0.9,0.9);
    lp=Math.min(lp,1800+near*7200);
  }
  return {gain,pan,lp};
}
function sfxChain(o){
  const sp=sfxSpatial(o), g=AC.createGain();
  g.gain.value=sp.gain;
  const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=sp.lp; f.Q.value=o&&o.q?o.q:0.0001;
  g.connect(f);
  let tail=f;
  if(AC.createStereoPanner){
    const p=AC.createStereoPanner(); p.pan.value=sp.pan;
    tail.connect(p); tail=p;
  }
  tail.connect(seBus||AC.destination);
  return g;
}
function beep(f,d,type,v,slide,opts){ if(!AC||ST.muted)return; try{
  opts=opts||{};
  const o=AC.createOscillator(),g=AC.createGain(),t0=AC.currentTime+(opts.delay||0);
  o.type=type||'square'; o.frequency.setValueAtTime(f,t0);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t0+d);
  g.gain.setValueAtTime(v||0.06,t0);
  g.gain.exponentialRampToValueAtTime(0.0008,t0+d);
  o.connect(g);g.connect(sfxChain(opts));o.start(t0);o.stop(t0+d+0.02);
}catch(e){} }
function noiz(d,v,opts){ if(!AC||ST.muted)return; try{
  opts=opts||{};
  const n=(AC.sampleRate*d)|0,b=AC.createBuffer(1,n,AC.sampleRate),ch=b.getChannelData(0);
  for(let i=0;i<n;i++)ch[i]=(Math.random()*2-1)*(1-i/n);
  const s=AC.createBufferSource(),g=AC.createGain(),t0=AC.currentTime+(opts.delay||0);
  s.buffer=b; if(opts.rate)s.playbackRate.value=opts.rate;
  g.gain.value=v||0.15;
  s.connect(g);g.connect(sfxChain(opts));s.start(t0);s.stop(t0+d+0.02);
}catch(e){} }
const SFX_GATE={};
function sfxGate(k,d){
  const now=(typeof ST!=='undefined'&&ST)?ST.t:(AC?AC.currentTime:0);
  if(now-(SFX_GATE[k]||-99)<d)return false;
  SFX_GATE[k]=now; return true;
}
const SFX={
  mg:(x,y)=>{const o=sfxArgs(x,y,{lp:6500});beep(820+rnd(180),0.028,'square',0.022,-140,o);beep(1850+rnd(420),0.012,'square',0.012,-700,sfxOpt(o,{delay:0.01,lp:5600}));noiz(0.035,0.018,sfxOpt(o,{lp:4200}));},
  enemyMG:(x,y)=>{if(!sfxGate('enemyMG',0.045))return;const o=sfxArgs(x,y,{lp:5200,gain:0.78});beep(620+rnd(130),0.026,'square',0.018,-90,o);noiz(0.032,0.014,sfxOpt(o,{lp:3200}));},
  wingMG:(x,y)=>{if(!sfxGate('wingMG',0.07))return;const o=sfxArgs(x,y,{lp:6800,gain:0.7});beep(980+rnd(170),0.022,'square',0.017,-180,o);beep(2100,0.012,'square',0.009,-600,sfxOpt(o,{delay:0.008}));},
  cannon:(x,y)=>{const o=sfxArgs(x,y,{lp:7600});beep(118,0.20,'triangle',0.09,-58,o);beep(560,0.045,'square',0.035,-250,sfxOpt(o,{delay:0.012,lp:5200}));noiz(0.13,0.105,sfxOpt(o,{lp:3600}));noiz(0.34,0.045,sfxOpt(o,{delay:0.045,lp:1300}));},
  enemyCannon:(x,y,boss)=>{const o=sfxArgs(x,y,{lp:boss?6400:5200,gain:boss?1:0.76});beep(boss?92:128,boss?0.24:0.15,'square',boss?0.09:0.052,boss?-48:-64,o);noiz(boss?0.18:0.09,boss?0.08:0.045,sfxOpt(o,{lp:boss?2600:2200}));},
  missile:(x,y)=>{const o=sfxArgs(x,y,{lp:7200});beep(240,0.12,'sawtooth',0.055,360,o);beep(640,0.24,'sawtooth',0.04,-280,sfxOpt(o,{delay:0.035}));noiz(0.20,0.05,sfxOpt(o,{lp:4700,delay:0.025}));},
  airDrop:(x,y)=>{const o=sfxArgs(x,y,{lp:5200,gain:0.65});beep(520,0.10,'sawtooth',0.028,-220,o);noiz(0.05,0.025,sfxOpt(o,{lp:3600}));},
  hit:(kind,x,y)=>{const o=sfxArgs(x,y,{lp:7000});
    if(kind==='mg'){beep(1320+rnd(360),0.026,'square',0.024,-420,o);noiz(0.035,0.018,sfxOpt(o,{lp:5200}));}
    else if(kind==='armor'){beep(760,0.055,'triangle',0.045,-260,o);noiz(0.075,0.035,sfxOpt(o,{lp:2400}));}
    else if(kind==='metal'){beep(1800+rnd(280),0.035,'square',0.03,420,o);noiz(0.045,0.025,sfxOpt(o,{lp:6200}));}
    else {beep(520,0.055,'triangle',0.035,-180,o);noiz(0.06,0.028,sfxOpt(o,{lp:3000}));}},
  boom:(x,y)=>{const o=sfxArgs(x,y,{lp:5200});const t=Math.min(6,(typeof COMBO!=='undefined'?COMBO.tier:0));noiz(0.08,0.18+t*0.01,sfxOpt(o,{lp:4800}));beep(78+t*8,0.34,'triangle',0.13+t*0.01,-50,sfxOpt(o,{delay:0.012,lp:1400}));noiz(0.45,0.09+t*0.01,sfxOpt(o,{delay:0.04,lp:1900}));beep(240,0.11,'sawtooth',0.03,-120,sfxOpt(o,{delay:0.08,lp:2600}));},
  bigboom:(x,y)=>{const o=sfxArgs(x,y,{lp:4800});noiz(0.11,0.28,sfxOpt(o,{lp:5200}));beep(54,0.62,'triangle',0.19,-32,sfxOpt(o,{delay:0.014,lp:1100}));noiz(0.72,0.15,sfxOpt(o,{delay:0.06,lp:1600}));beep(96,0.28,'sawtooth',0.06,-44,sfxOpt(o,{delay:0.09,lp:1800}));},
  ram:(x,y)=>{const o=sfxArgs(x,y,{lp:4200});noiz(0.11,0.19,o);beep(116,0.13,'square',0.095,-66,sfxOpt(o,{delay:0.006,lp:1500}));beep(930,0.035,'square',0.035,-380,sfxOpt(o,{delay:0.018,lp:6500}));},
  reflect:(x,y,perfect)=>{if(typeof x==='boolean'){perfect=x;x=undefined;y=undefined;}const o=sfxArgs(x,y,{lp:8800});beep(perfect?1850:1150,0.08,'square',0.07,perfect?820:560,o);beep(perfect?2600:1650,0.055,'triangle',0.05,perfect?620:320,sfxOpt(o,{delay:0.04}));noiz(0.045,0.028,sfxOpt(o,{lp:7600}));},
  shield:(x,y)=>{const o=sfxArgs(x,y,{lp:8200});beep(520,0.08,'triangle',0.045,520,o);beep(1120,0.12,'square',0.035,360,sfxOpt(o,{delay:0.045}));},
  hurt:(x,y)=>{const o=sfxArgs(x,y,{lp:4200});beep(210,0.13,'sawtooth',0.08,-130,o);noiz(0.08,0.055,sfxOpt(o,{lp:2200}));},
  heal:()=>{beep(620,0.08,'square',0.06);beep(930,0.1,'square',0.06,120,{delay:0.07});},
  thunder:()=>{noiz(0.10,0.26,{lp:7200});beep(46,0.78,'triangle',0.17,-26,{delay:0.02,lp:900});noiz(0.8,0.11,{delay:0.08,lp:1300});},
  horn:()=>{beep(110,0.5,'sawtooth',0.14);beep(98,0.6,'sawtooth',0.14,-12,{delay:0.26});},
  strike:(x,y)=>{const o=sfxArgs(x,y,{lp:6000});beep(320,0.34,'sawtooth',0.07,-170,o);beep(660,0.11,'square',0.035,-300,sfxOpt(o,{delay:0.08}));noiz(0.28,0.045,sfxOpt(o,{delay:0.04,lp:2600}));},
  pick:()=>beep(1000,0.06,'square',0.05),
  combo:t=>{beep(480+t*140,0.1,'square',0.05+t*0.012);if(t>=3)beep(720+t*160,0.12,'square',0.05,200,{delay:0.045});},
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
