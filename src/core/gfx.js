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


function fit(){let s=Math.min(innerWidth/VW,innerHeight/VH); s=s>=2?Math.floor(s):Math.max(0.5,s);
  cv.style.width=(VW*s)+'px';cv.style.height=(VH*s)+'px';
  const d=window.devicePixelRatio||1;
  cv.width=Math.max(VW,Math.round(VW*s*d)); cv.height=Math.max(VH,Math.round(VH*s*d));}
addEventListener('resize',fit);fit();

/* ---------- PHASE 2: 渲染插值 ---------- */
let gAlpha=0; /* 当前渲染处于两个逻辑步之间的比例(0~1) */
function IPx(o){ return o.ox===undefined?o.x:o.ox+(o.x-o.ox)*gAlpha; }
function IPy(o){ return o.oy===undefined?o.y:o.oy+(o.y-o.oy)*gAlpha; }
