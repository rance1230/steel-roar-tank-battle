"use strict";
/* game/v18ui — V1.8 UI 资产运行时层
   assets/ai-v18-ui (data/v18_ui.data.js) → 九宫格面板 / 图标八态 / 徽章+实时坦克 /
   大背景懒解码(标题·整备, 离页释放) / 触屏按钮皮肤(按钮即 HUD).
   全部功能带回退: 数据模块缺失或解码失败时调用方走原代码路径. */
window.V18UIR=(function(){
const M=(typeof V18UI!=='undefined')?V18UI:null;
const T={friendly:'#35C8FF',enemy:'#FF4C3F',gold:'#F6B94E',white:'#EEF6FF',bg:'#0A0F14'};
const imgs={};                 /* key -> Image (frame/ico/badge 常驻; title/dep 按页懒解码) */
const varCache=new Map();      /* idx|mode|tint -> 128px canvas 图标变体 */
const urlCache=new Map();      /* idx|tint|size -> dataURL (DOM 皮肤用) */
let lostFlash=[];              /* 锁定丢失红闪 {x,y,t} (drawLocks 用) */

/* ---------- 懒解码管理 ---------- */
function want(key){
  if(!M||!M.images[key])return null;
  let im=imgs[key];
  if(!im){ im=new Image(); im.src=M.images[key]; imgs[key]=im; }
  return im;
}
function ok(key){ const im=imgs[key]; return !!(im&&im.complete&&im.naturalWidth>0); }
function release(key){ delete imgs[key]; }   /* 解码位图随 Image 引用一起被 GC 回收 */
function bg(key){ return ok(key)?imgs[key]:null; }
if(M){ want('frame'); want('ico'); want('badge'); }   /* 小纹理常驻共享 (~3MB 解码) */

/* ---------- 九宫格 (UI-FRM-BASE): 中心透明, 底色由调用方代码填充 ---------- */
function frame9(g,x,y,w,h,o){
  if(!ok('frame'))return false;
  const S=M.meta.frame.size, B=M.meta.frame.border;
  const e=o&&o.edge?o.edge:Math.max(4,Math.min(14,Math.min(w,h)*0.22));
  if(w<e*2||h<e*2)return false;
  g.drawImage(imgs.frame,0,0,B,B, x,y,e,e);
  g.drawImage(imgs.frame,S-B,0,B,B, x+w-e,y,e,e);
  g.drawImage(imgs.frame,0,S-B,B,B, x,y+h-e,e,e);
  g.drawImage(imgs.frame,S-B,S-B,B,B, x+w-e,y+h-e,e,e);
  g.drawImage(imgs.frame,B,0,S-2*B,B, x+e,y,w-2*e,e);
  g.drawImage(imgs.frame,B,S-B,S-2*B,B, x+e,y+h-e,w-2*e,e);
  g.drawImage(imgs.frame,0,B,B,S-2*B, x,y+e,e,h-2*e);
  g.drawImage(imgs.frame,S-B,B,B,S-2*B, x+w-e,y+e,e,h-2*e);
  return true;
}
/* uPanel 升级皮肤: 九宫格金属框 + 保留原强调色发丝线 */
function panelFrame(g,x,y,w,h,c){
  if(!frame9(g,x,y,w,h))return false;
  g.strokeStyle=rgba(c||T.friendly,0.55); g.lineWidth=1;
  g.strokeRect(x+1.5,y+1.5,w-3,h-3);
  return true;
}

/* ---------- 图标变体 (source-atop/saturation 离屏着色, 缓存共享; 不生成状态图片) ---------- */
function iconVar(idx,mode,tint){
  if(!ok('ico'))return null;
  const key=idx+'|'+mode+'|'+(tint||'');
  if(varCache.has(key))return varCache.get(key);
  const im=imgs.ico, cx=(idx%4)*128, cy=(idx>>2)*128;
  const cv=document.createElement('canvas'); cv.width=128; cv.height=128;
  const g=cv.getContext('2d');
  g.imageSmoothingEnabled=true;
  g.drawImage(im,cx,cy,128,128,0,0,128,128);
  if(mode==='tint'&&tint){
    /* 白/近白 tint 在中性金属上会"消失": 按亮度自适应叠加强度 (白 0.72 / 彩色 0.45) */
    const h=tint.replace('#',''), lum=(parseInt(h.slice(0,2),16)+parseInt(h.slice(2,4),16)+parseInt(h.slice(4,6),16))/765;
    g.globalCompositeOperation='source-atop';
    g.globalAlpha=lum>0.82?0.72:0.45;
    g.fillStyle=tint; g.fillRect(0,0,128,128);
  }
  else if(mode==='gray'){ g.globalCompositeOperation='saturation'; g.fillStyle='#808080'; g.fillRect(0,0,128,128);
    g.globalCompositeOperation='destination-in'; g.globalAlpha=1; g.drawImage(im,cx,cy,128,128,0,0,128,128); }
  else if(mode==='dim'){ g.globalCompositeOperation='source-atop'; g.globalAlpha=0.65; g.fillStyle='#0A0F14'; g.fillRect(0,0,128,128); }
  g.globalCompositeOperation='source-over'; g.globalAlpha=1;
  varCache.set(key,cv);
  return cv;
}
/* 低层绘制: icon(g,idx,cx,cy,size,{variant,tint,alpha}) */
function icon(g,idx,cx,cy,size,o){
  o=o||{};
  const v=iconVar(idx,o.variant||'base',o.tint);
  if(!v)return false;
  const s=size*(o.scale||1);
  g.save();
  if(o.alpha!==undefined)g.globalAlpha=o.alpha;
  g.imageSmoothingEnabled=true;
  g.drawImage(v,cx-s/2,cy-s/2,s,s);
  g.restore();
  return true;
}
/* 键盘/手柄武器芯片 (Level 1 极简: 代码底+图标+细环+蒙版; 16px) */
function chip(x,y,idx,st,col,frac,od){
  const S=16, c=S/2;
  upx(x,y,S,S,rgba(PAL.panel,0.40));
  if(st==='cool'){                                   /* 冷却: 去饱和图标 + 暗蒙版 */
    icon(uctx,idx,x+c,y+c,S-3,{variant:'gray'});
    const rem=1-clamp(frac,0,1);
    if(rem>0){ uctx.globalAlpha=0.55; upx(x,y,S,Math.round(S*rem),PAL.ink); uctx.globalAlpha=1; }
  }
  else if(st==='disabled')icon(uctx,idx,x+c,y+c,S-3,{variant:'dim'});
  else icon(uctx,idx,x+c,y+c,S-3,{variant:'tint',tint:st==='charging'?undefined:col});
  /* 环形进度: 充能顺时针 / 冷却逆时针恢复 */
  if(st==='charging'||st==='cool'){
    const f=clamp(frac,0,1);
    uctx.strokeStyle=st==='charging'?(col||T.friendly):rgba(col||PAL.steel,0.8);
    uctx.lineWidth=1.4;
    uctx.beginPath();
    if(st==='charging')uctx.arc(x+c,y+c,S/2-0.5,-Math.PI/2,-Math.PI/2+f*Math.PI*2);
    else uctx.arc(x+c,y+c,S/2-0.5,-Math.PI/2,-Math.PI/2-(1-f)*Math.PI*2,true);
    uctx.stroke();
  }
  if(st==='full'){                                   /* 满蓄: 金白脉冲外环 */
    const p=0.5+0.5*Math.sin(ST.t*8);
    uctx.strokeStyle=rgba(PAL.white,0.35+0.5*p); uctx.lineWidth=1.2;
    uctx.beginPath(); uctx.arc(x+c,y+c,S/2+1.2+p*0.8,0,Math.PI*2); uctx.stroke();
  }
  if(od){                                            /* Overdrive: 金色外环 (doc §5) */
    uctx.strokeStyle=rgba(T.gold,0.75); uctx.lineWidth=1.2;
    uctx.beginPath(); uctx.arc(x+c,y+c,S/2+2.2,0,Math.PI*2); uctx.stroke();
  }
  uctx.strokeStyle=rgba(st==='cool'||st==='disabled'?PAL.steel:(col||PAL.steel),0.7);
  uctx.lineWidth=1;
  uctx.strokeRect(x+0.5,y+0.5,S-1,S-1);
}

/* ---------- 徽章 (UI-BADGE + V18 实时分层坦克; 不烘焙单位) ---------- */
function badge(g,cx,cy,size,o){
  o=o||{};
  g.save();
  g.globalAlpha=0.40; g.fillStyle=T.bg;                       /* 代码底色 (透明中心衬底) */
  g.beginPath(); g.arc(cx,cy,size*0.46,0,Math.PI*2); g.fill();
  g.restore();
  let framed=false;
  if(ok('badge')){ g.drawImage(imgs.badge,cx-size/2,cy-size/2,size,size); framed=true; }
  const w=size*0.58, bodyA=o.bodyA!==undefined?o.bodyA:-Math.PI/2;
  const ta=o.ta!==undefined?o.ta:bodyA;
  let painted=false;
  if(typeof V18!=='undefined'&&V18.ok)painted=V18.playerLayers(g,cx,cy,bodyA,ta,w);
  if(!painted&&typeof drawTank==='function'){                 /* 像素兜底 */
    const v=(typeof HULLS!=='undefined'&&HULLS[RUN.hull]&&HULLS[RUN.hull].vis)||{};
    g.save(); g.translate(cx,cy); g.scale(w/34,w/34);
    drawTank(0,0,bodyA,{s:1,ta,hull:v.hull||PAL.steel,hi:v.hi||PAL.white,trim:v.trim||PAL.cyan,
      turret:v.turret||PAL.lite,barrel:v.barrel||PAL.steel,twin:!!v.twin,antenna:true,core:true,dist:ST.t*20,flash:0});
    g.restore(); painted=true;
  }
  if(!framed){                                                /* 无框图兜底: 代码细环 */
    g.strokeStyle=rgba(T.friendly,0.7); g.lineWidth=1.5;
    g.beginPath(); g.arc(cx,cy,size*0.46,0,Math.PI*2); g.stroke();
  }
  return framed&&painted;
}

/* ---------- 多锁准星状态记录 (供 render.drawLocks: 丢失目标红闪) ---------- */
function noteLost(x,y){
  const now=ST.t;
  if(!lostFlash.length||now-lostFlash[lostFlash.length-1].t>0.05||Math.hypot(x-lostFlash[lostFlash.length-1].x,y-lostFlash[lostFlash.length-1].y)>8)
    lostFlash.push({x,y,t:now});
  if(lostFlash.length>12)lostFlash.shift();
}
function lostList(){ return lostFlash.filter(f=>ST.t-f.t<0.16); }

/* ---------- 触屏按钮皮肤: 图标 + 充能环 + ×N + 透明度态 (按钮即 HUD, doc §3/§11) ---------- */
const ACTION_ICO={KeyJ:0,KeyK:1,KeyL:2,KeyU:3,ShiftLeft:4,Space:5,KeyP:6};
function actionTint(a){
  if(a==='KeyL'||a==='Space')return T.friendly;
  if(a==='KeyU')return T.gold;
  if(a==='ShiftLeft')return (typeof PAL!=='undefined'&&PAL.acid)||'#7fe08f';
  return T.white;
}
function iconURL(idx,tint,size){
  const key=idx+'|'+tint+'|'+size;
  if(urlCache.has(key))return urlCache.get(key);
  const v=iconVar(idx,'tint',tint);
  if(!v)return null;
  const cv=document.createElement('canvas'); cv.width=cv.height=size;
  const g=cv.getContext('2d');
  g.imageSmoothingEnabled=true;
  g.drawImage(v,0,0,128,128,0,0,size,size);
  const url=cv.toDataURL('image/png');
  urlCache.set(key,url);
  return url;
}
let skinned=false;
function skinTouch(){
  if(skinned||!ok('ico'))return;
  const els=document.querySelectorAll('#touchovl .tbtn');
  if(!els.length)return;
  for(const el of els){
    const a=el.dataset.action, idx=ACTION_ICO[a];
    if(idx===undefined)continue;
    const ic=el.querySelector('.ic');
    if(ic){
      const url=iconURL(idx,actionTint(a),96);
      if(url){
        ic.innerHTML='';
        const im=document.createElement('img'); im.className='vic'; im.src=url; im.alt='';
        /* 大键(机枪 L 尺寸)配大图标, 小键(S)次之 — 图标占按钮可视主角 */
        im.style.width=(el.style.width||'').indexOf('touch-l')>=0?'clamp(26px,5.6vmin,36px)':'clamp(19px,4.3vmin,28px)';
        ic.appendChild(im);
      }
    }
    if(a!=='KeyJ'&&a!=='KeyK'){                    /* 可冷却/蓄能武器: 环 + ×N 角标 */
      const ring=document.createElement('span'); ring.className='vring';
      const cnt=document.createElement('span'); cnt.className='vcnt';
      el.appendChild(ring); el.appendChild(cnt);
      el._vring=ring; el._vcnt=cnt; el._vl={};
    }
    el._vact=a; el.classList.add('v18');
  }
  skinned=true;
}
function setRing(el,col,frac){
  const r=el._vring; if(!r)return;
  const v=el._vl, f=Math.round(clamp(frac,0,1)*100), key=col+f;
  if(v.ring===key)return; v.ring=key;
  if(f<=0){ r.style.display='none'; return; }
  r.style.display='block';
  r.style.background='conic-gradient(from -90deg,'+col+' 0 '+f+'%,transparent '+f+'% 100%)';
}
function setCnt(el,n,col){
  const c=el._vcnt; if(!c)return;
  const v=el._vl, key=n+'|'+col;
  if(v.cnt===key)return; v.cnt=key;
  if(!n){ c.style.display='none'; return; }
  c.style.display='block'; c.textContent='×'+n; c.style.color=col;
}
/* doc §11 透明度态: idle 0.5 / 主武器常亮 0.8 (真机审校: 0.65 在暗背景仍像禁用) /
   触摸·蓄力 0.75 / 战斗关键 0.9 / 冷却 0.55 */
function setBtnState(el,mode){
  const v=el._vl||{};
  const on=el.classList.contains('on');
  if(on)mode='act';
  const opacity=mode==='crit'?0.9:(mode==='act'?0.75:(mode==='fire'?0.8:(mode==='dim'?0.55:0.5)));
  if(v.op!==opacity){ v.op=opacity; el.style.opacity=(''+opacity); }
  const wantCrit=mode==='crit';
  if(!!v.crit!==wantCrit){ v.crit=wantCrit; el.classList.toggle('v18crit',wantCrit); }
}
function byAct(a){
  const els=document.querySelectorAll('#touchovl .tbtn');
  for(const el of els)if(el._vact===a)return el;
  return null;
}
function touchHud(state){
  if(!skinned)return;
  const show=(typeof SET!=='undefined')&&(SET.touch==='on'||(SET.touch==='auto'&&typeof hasTouch!=='undefined'&&hasTouch))
    &&!(typeof MENU!=='undefined'&&MENU)&&(state==='play'||state==='intro');
  if(!show||typeof player==='undefined'||!player)return;
  const p=player, h=(typeof hullCfg==='function')?hullCfg():null;
  const cdMul=(typeof calcStats==='function')?calcStats().cdMul:1;
  let el;
  /* 导弹: 蓄力环+×N (蓄力=激活亮度, 满蓄=关键脉冲) / 冷却逆环灰化(恢复弧用亮钢白, 真机审校: 暗钢不可读) / 就绪=关键 */
  if((el=byAct('KeyL'))){
    if(p.mslCd>0){ const mc=h?h.missile.cd*cdMul:6;
      setRing(el,rgba(PAL.lite,0.95),1-p.mslCd/mc); setCnt(el,0); setBtnState(el,'dim');
    } else if(p.charging){
      const f=p.charge/1.2, cnt=(typeof mslCount==='function')?mslCount(p.charge):0;
      setRing(el,T.friendly,f); setCnt(el,cnt,T.gold);
      setBtnState(el,(cnt>0&&cnt>=(h?h.missile.maxLocks:6)-0.5)||f>=1?'crit':'act');
    } else { setRing(el,T.friendly,0); setCnt(el,0); setBtnState(el,'crit'); }
  }
  /* 空袭 */
  if((el=byAct('KeyU'))){
    if(p.strikeCd>0){ setRing(el,rgba(PAL.lite,0.95),1-p.strikeCd/(5*cdMul)); setBtnState(el,'dim'); }
    else { setRing(el,T.gold,0); setBtnState(el,'crit'); }
  }
  /* 加速 (能量环; 锁定=红) */
  if((el=byAct('ShiftLeft'))){
    setRing(el,p.sprintLock?T.enemy:(typeof PAL!=='undefined'&&PAL.gold)||T.gold,p.sprintG);
    setBtnState(el,p.sprintLock?'dim':(p.sprintG>=0.98?'crit':'idle'));
  }
  /* 护盾: 激活中脉冲 / 冷却逆环 / 就绪 */
  if((el=byAct('Space'))){
    if(p.shieldT>0){ setRing(el,T.friendly,1); setBtnState(el,'crit'); }
    else if(p.shieldCd>0){ const sc=h?h.shield:{cd:1};
      setRing(el,rgba(PAL.lite,0.95),1-p.shieldCd/Math.max(0.5,sc.cd*cdMul)); setBtnState(el,'dim');
    } else { setRing(el,T.friendly,0); setBtnState(el,'crit'); }
  }
  /* 机枪/主炮: 主武器常亮 (0.65), 图标暗色底板保雪地可读 */
  if((el=byAct('KeyJ')))setBtnState(el,'fire');
  if((el=byAct('KeyK')))setBtnState(el,'fire');
}

/* ---------- 页面级懒解码/释放 (main.draw 每帧调用) ---------- */
function frame(state){
  if(!M)return;
  if(state==='title'||state==='ctrl'){ want('title'); release('dep'); }
  else if(state==='upgrade'){ want('dep'); release('title'); }
  else { release('title'); release('dep'); }
  skinTouch();
  touchHud(state);
}

/* ---------- 调试钩子 (G.v18ui) ---------- */
(function hook(){
  if(!window.G){ requestAnimationFrame(hook); return; }
  G.v18ui={
    info(){ return {hasData:!!M,
      loaded:Object.keys(imgs).filter(ok),
      decodedKB:Object.keys(imgs).filter(ok).reduce((s,k)=>{const im=imgs[k];return s+im.naturalWidth*im.naturalHeight*4;},0)/1024,
      skinned:skinned}; },
    want, release,
  };
})();

return {T:T, want:want, ok:ok, bg:bg, release:release, frame:frame,
  frame9:frame9, panelFrame:panelFrame, icon:icon, iconVar:iconVar, chip:chip,
  badge:badge, iconURL:iconURL, noteLost:noteLost, lostList:lostList,
  skinTouch:skinTouch};
})();
