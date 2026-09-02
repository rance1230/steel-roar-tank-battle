"use strict";
/* core/gfx — 画布/缓冲/自适应 (v3 PHASE1 自 index.html 拆分) */
const VW=480, VH=270, TS=16;
const cv=document.getElementById('game');
/* 双层渲染: 像素世界画进480x270离屏缓冲(ctx), 再整帧放大到显示画布(uctx)绘制高清UI */
const buf=document.createElement('canvas'); buf.width=VW; buf.height=VH;
const ctx=buf.getContext('2d');
ctx.imageSmoothingEnabled=false;
const uctx=cv.getContext('2d');
const FONT='"DIN Condensed","Arial Narrow","Roboto Condensed","PingFang SC","Hiragino Sans","Noto Sans CJK SC","Microsoft YaHei",monospace';


function fit(){const vp=window.visualViewport;
  const vw=vp?vp.width:innerWidth, vh=vp?vp.height:innerHeight;
  let s=Math.min(vw/VW,vh/VH); s=s>=2?Math.floor(s):Math.max(0.5,s);
  cv.style.width=(VW*s)+'px';cv.style.height=(VH*s)+'px';
  const d=window.devicePixelRatio||1;
  cv.width=Math.max(VW,Math.round(VW*s*d)); cv.height=Math.max(VH,Math.round(VH*s*d));}
addEventListener('resize',fit); addEventListener('orientationchange',fit);
if(window.visualViewport)visualViewport.addEventListener('resize',fit);
fit();

/* ---------- PHASE 2: 渲染插值 ---------- */
let gAlpha=0; /* 当前渲染处于两个逻辑步之间的比例(0~1) */
function IPx(o){ return o.ox===undefined?o.x:o.ox+(o.x-o.ox)*gAlpha; }
function IPy(o){ return o.oy===undefined?o.y:o.oy+(o.y-o.oy)*gAlpha; }

/* v1.7: 颜色压暗 — 向深蓝黑 #0d121c 混合 (k=保留原色比例), 冲刺残影剪影用 */
function shade(c,k){
  if(typeof c!=='string'||c[0]!=='#')return c;
  const h=c.slice(1), n=h.length===3?h.split('').map(x=>x+x).join(''):h;
  const r=parseInt(n.slice(0,2),16),g=parseInt(n.slice(2,4),16),b=parseInt(n.slice(4,6),16);
  const m=(v,d)=>Math.round(v*k+d*(1-k));
  return '#'+[m(r,13),m(g,18),m(b,28)].map(v=>('0'+v.toString(16)).slice(-2)).join('');
}
