"use strict";
/* game/render — 像素层与高清UI层渲染 */
/* ============================================================
   渲 染
   ============================================================ */
function px(x,y,w,h,c){ ctx.fillStyle=c; ctx.fillRect(x,y,w,h); }
function upx(x,y,w,h,c){ uctx.fillStyle=c; uctx.fillRect(x,y,w,h); }
/* 高清UI层文字 (720P+) */
function txt(t,x,y,s,c,align,bold){
  uctx.font=(bold===false?'':'bold ')+s+'px '+FONT;
  uctx.fillStyle=c; uctx.textAlign=align||'left'; uctx.textBaseline='top'; uctx.fillText(t,x,y);
}
function txtO(t,x,y,s,c,align){
  uctx.font='bold '+s+'px '+FONT;
  uctx.textAlign=align||'left'; uctx.textBaseline='top';
  uctx.fillStyle=PAL.ink;
  uctx.fillText(t,x+1,y+1);uctx.fillText(t,x-1,y+1);uctx.fillText(t,x+1,y-1);uctx.fillText(t,x-1,y-1);
  uctx.fillStyle=c; uctx.fillText(t,x,y);
}
/* 像素层文字 (帮助小场景内装饰) */
function gtxt(t,x,y,s,c,align,bold){
  ctx.font=(bold===false?'':'bold ')+s+'px '+FONT;
  ctx.fillStyle=c; ctx.textAlign=align||'left'; ctx.textBaseline='top'; ctx.fillText(t,x,y);
}
function ubar(x,y,w,h,frac,c,bg){
  upx(x-1,y-1,w+2,h+2,PAL.ink); upx(x,y,w,h,bg||PAL.dark);
  if(frac>0)upx(x,y,Math.round(w*clamp(frac,0,1)),h,c);
}
function bar(x,y,w,h,frac,c,bg){
  px(x-1,y-1,w+2,h+2,PAL.ink); px(x,y,w,h,bg||PAL.dark);
  if(frac>0)px(x,y,Math.round(w*clamp(frac,0,1)),h,c);
}
function wrapTxt(s,maxW,size){
  uctx.font='bold '+size+'px '+FONT;
  const out=[]; let line='';
  for(const ch of s){ if(ch==='\n'){out.push(line);line='';continue;}
    if(uctx.measureText(line+ch).width>maxW){out.push(line);line=ch;} else line+=ch; }
  out.push(line); return out;
}
const _rgbCache={};
function rgb(c){
  if(_rgbCache[c])return _rgbCache[c];
  const h=(c||PAL.white).replace('#','');
  return _rgbCache[c]=[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
}
function rgba(c,a){ const r=rgb(c); return 'rgba('+r[0]+','+r[1]+','+r[2]+','+a+')'; }

/* ---------- Stage Splash Art (AI-generated 16:9 campaign plates) ---------- */
const SPLASH_ART={
  sources:{
    title:'assets/stage-intros/title-bg.png',
    levels:[
      'assets/stage-intros/stage-01-dust-front.png',
      'assets/stage-intros/stage-02-green-assault.png',
      'assets/stage-intros/stage-03-storm-crossing.png',
      'assets/stage-intros/stage-04-swamp-pit.png',
      'assets/stage-intros/stage-05-desert-intercept.png',
      'assets/stage-intros/stage-06-storm-corridor.png',
      'assets/stage-intros/stage-07-doomsday-waste.png',
    ],
  },
  images:{title:null,levels:Array(7).fill(null)},
  failed:{title:false,levels:Array(7).fill(false)},
};
window.SPLASH_ART=SPLASH_ART;
(function preloadSplashArt(){
  const load=(src,onload,onerror)=>{
    const im=new Image();
    im.onload=()=>onload(im);
    im.onerror=onerror;
    im.src=src;
  };
  load(SPLASH_ART.sources.title,im=>{SPLASH_ART.images.title=im;},()=>{SPLASH_ART.failed.title=true;});
  SPLASH_ART.sources.levels.forEach((src,i)=>load(src,im=>{SPLASH_ART.images.levels[i]=im;},()=>{SPLASH_ART.failed.levels[i]=true;}));
})();
function splashImage(kind,level){
  const im=kind==='title'?SPLASH_ART.images.title:SPLASH_ART.images.levels[clamp(level|0,0,6)];
  return im&&im.complete&&im.naturalWidth>0?im:null;
}
function drawSplashArt(kind,level){
  const im=splashImage(kind,level); if(!im)return false;
  const phase=kind==='title'?0:(level|0)*0.67;
  const z=1.02+0.035*(0.5+0.5*Math.sin(ST.t*0.18+phase));
  const dw=VW*z,dh=VH*z;
  const pxn=Math.sin(ST.t*0.09+phase)*1.8,pyn=Math.cos(ST.t*0.07+phase)*0.8;
  ctx.save(); ctx.imageSmoothingEnabled=true;
  ctx.drawImage(im,(VW-dw)/2+pxn,(VH-dh)/2+pyn,dw,dh);
  ctx.restore();
  return true;
}
function drawSplashOverlay(kind){
  ctx.save();
  const shade=ctx.createLinearGradient(0,0,0,VH);
  shade.addColorStop(0,kind==='title'?'rgba(5,8,13,0.44)':'rgba(5,8,13,0.42)');
  shade.addColorStop(0.42,'rgba(5,8,13,0.16)');
  shade.addColorStop(1,'rgba(5,8,13,0.36)');
  ctx.fillStyle=shade; ctx.fillRect(0,0,VW,VH);
  const side=ctx.createLinearGradient(0,0,VW,0);
  side.addColorStop(0,'rgba(5,8,13,0.30)');
  side.addColorStop(0.34,'rgba(5,8,13,0.08)');
  side.addColorStop(1,'rgba(5,8,13,0)');
  ctx.fillStyle=side; ctx.fillRect(0,0,VW,VH);
  ctx.restore();
}
function drawSplashMotes(kind,level){
  const colors=kind==='title'?[PAL.gold,PAL.orange,PAL.cyan]:
    ((level===2||level===5)?[PAL.aqua,PAL.white,PAL.orange]:
      (level===6?[PAL.gold,PAL.orange,PAL.red]:[PAL.gold,PAL.lite,PAL.white]));
  const n=kind==='title'?22:18;
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for(let i=0;i<n;i++){
    const h=hsh(i+17,(level|0)+91), drift=ST.t*(0.7+(i%4)*0.18);
    const x=((h*VW+drift*(i%2?1:-1))%VW+VW)%VW;
    const y=(hsh(i+37,(level|0)+19)*VH+Math.sin(ST.t*(0.3+(i%3)*0.12)+i)*3)%VH;
    ctx.globalAlpha=0.12+0.18*(0.5+0.5*Math.sin(ST.t*1.6+i));
    px(x,y,i%3?1:2,i%3?1:2,colors[i%colors.length]);
  }
  ctx.restore(); ctx.globalAlpha=1;
}
function glow(x,y,r,c,a){
  if(PERF.qLevel===0)return;
  const g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,rgba(c,a)); g.addColorStop(0.45,rgba(c,a*0.28)); g.addColorStop(1,rgba(c,0));
  ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.fillStyle=g; ctx.fillRect(x-r,y-r,r*2,r*2); ctx.restore();
}
function uPanel(x,y,w,h,c,a){
  uctx.save();
  uctx.globalAlpha=a||0.76; upx(x,y,w,h,PAL.panel);
  uctx.globalAlpha=1; uctx.strokeStyle=rgba(c||PAL.cyan,0.64); uctx.lineWidth=1; uctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
  upx(x,y,12,1,c||PAL.cyan); upx(x,y,1,12,c||PAL.cyan);
  upx(x+w-12,y+h-1,12,1,c||PAL.cyan); upx(x+w-1,y+h-12,1,12,c||PAL.cyan);
  uctx.restore();
}
function uMiniBar(x,y,w,h,frac,c,bg){
  upx(x,y,w,h,bg||PAL.panel2);
  if(frac>0)upx(x,y,Math.max(1,Math.round(w*clamp(frac,0,1))),h,c);
  upx(x,y,w,1,rgba(PAL.white,0.18));
}
function unitShadow(x,y,w,h,a){
  ctx.save(); ctx.translate(Math.round(x),Math.round(y)); ctx.globalAlpha=a||0.35; ctx.fillStyle=PAL.shadow;
  ctx.beginPath(); ctx.ellipse(0,h*0.33,w,h,0,0,Math.PI*2); ctx.fill(); ctx.restore();
}
function unitHealth(x,y,w,frac,c){
  ctx.save(); ctx.globalAlpha=0.86;
  px(x-1,y-1,w+2,4,PAL.shadow); px(x,y,w,2,PAL.panel2); if(frac>0)px(x,y,Math.round(w*clamp(frac,0,1)),2,c);
  ctx.restore();
}
/* ---------- 地形绘制 ---------- */
function drawTerrain(){
  const tx0=Math.max(0,Math.floor(cam.x/TS)),ty0=Math.max(0,Math.floor(cam.y/TS));
  const tx1=Math.min(MAPW-1,Math.ceil((cam.x+VW)/TS)),ty1=Math.min(MAPH-1,Math.ceil((cam.y+VH)/TS));
  const tm=Math.floor(ST.t*3);
  const dry=cfg.ground==='dry'||cfg.ground==='waste';
  const rainy=!!cfg.rain;
  const gBase=rainy?'#1c2f19':PAL.green, gSpeck=rainy?PAL.green:PAL.lime;   /* 雨图绿收敛 (审查C5) */
  for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
    const id=terr.m[ty*MAPW+tx],X=tx*TS,Y=ty*TS,h=hsh(tx,ty);
    if(id===0){
      px(X,Y,TS,TS,dry?PAL.brown:gBase);
      px(X,Y,TS,1,rgba(PAL.steel,0.14)); px(X,Y,1,TS,rgba(PAL.steel,0.10));   /* 中性勾边, 不与玩家蓝抢色 */
      if(h<0.34)px(X+((h*53)|0)%13,Y+((h*97)|0)%13,2,2,dry?PAL.sand:gSpeck);
      if(h>0.78)px(X+((h*31)|0)%14,Y+((h*71)|0)%14,5,1,PAL.grid);
    }
    else if(id===1){
      px(X,Y,TS,TS,dry?'#3a2d22':PAL.sand);
      if(h<0.42)px(X+((h*47)|0)%13,Y+((h*89)|0)%13,3,1,PAL.brown);
      if(h>0.72){ px(X+1,Y+((h*61)|0)%12,12,1,PAL.rail); px(X+((h*29)|0)%12,Y+2,1,10,PAL.grid); }
      if(h>0.92)px(X+((h*29)|0)%14,Y+((h*67)|0)%14,2,2,PAL.gold);
    }
    else if(id===2){
      px(X,Y,TS,TS,PAL.smoke);
      px(X+1,Y+1,14,1,PAL.rail); px(X+1,Y+14,14,1,PAL.shadow);
      if(h<0.32)px(X+((h*41)|0)%13,Y+((h*83)|0)%13,4,1,PAL.dark);
      if(h>0.82)px(X+((h*37)|0)%12,Y+((h*73)|0)%12,3,2,PAL.sand);
    }
    else if(id===3){
      px(X,Y,TS,TS,'#102b3b');
      const w=(h*10+tm)%10;
      px(X,Y,TS,1,rgba(PAL.aqua,0.32)); px(X,Y+15,TS,1,rgba(PAL.blue,0.28));
      if(w<3)px(X+((h*53)|0)%12,Y+((h*97)|0)%12,6,1,PAL.cyan);
      if(w>7)px(X+((h*31)|0)%12,Y+((h*71)|0)%12,4,1,PAL.aqua);
    }
    else if(id===4){
      px(X,Y,TS,TS,'#172316');
      px(X+2,Y+3,6,4,PAL.shadow); px(X+9,Y+9,5,4,PAL.shadow);
      const b=(h*10+tm)%10; if(b<2)px(X+4,Y+4,2,2,PAL.blue); if(b>8)px(X+11,Y+10,2,2,PAL.acid);
      if(h>0.8)px(X+((h*43)|0)%14,Y+((h*79)|0)%14,2,1,PAL.lime);
    }
    else if(id===5){
      px(X,Y,TS,TS,dry?'#30251b':'#1a241f');
      ctx.globalAlpha=0.35; px(X+3,Y+7,12,8,PAL.shadow); ctx.globalAlpha=1;
      px(X+2,Y+4,12,10,'#3a3f45'); px(X+4,Y+2,8,12,'#2e343b');   /* 板条箱压暗去蓝 (审查C1/C5) */
      px(X+3,Y+5,4,3,PAL.lite); px(X+8,Y+9,5,4,PAL.dark);
      if(h>0.52){ px(X+2,Y+3,3,1,PAL.gold); px(X+6,Y+3,3,1,PAL.gold); px(X+10,Y+3,3,1,PAL.gold); }
      ctx.strokeStyle=PAL.shadow; ctx.strokeRect(X+1.5,Y+1.5,13,13);
    }
  }
  ctx.save();
  ctx.globalAlpha=0.18; ctx.strokeStyle=PAL.cyan; ctx.lineWidth=1;
  for(let x=Math.floor(cam.x/64)*64;x<cam.x+VW+64;x+=64){ ctx.beginPath(); ctx.moveTo(x,cam.y); ctx.lineTo(x+48,cam.y+VH); ctx.stroke(); }
  ctx.globalAlpha=0.22; ctx.strokeStyle=PAL.gold;
  for(let y=Math.floor(cam.y/96)*96;y<cam.y+VH+96;y+=96){ ctx.beginPath(); ctx.moveTo(cam.x,y); ctx.lineTo(cam.x+VW,y-26); ctx.stroke(); }
  ctx.restore();
  px(0,0,WORLDW,8,PAL.panel2); px(0,WORLDH-8,WORLDW,8,PAL.panel2);
  px(0,0,8,WORLDH,PAL.panel2); px(WORLDW-8,0,8,WORLDH,PAL.panel2);
}
/* ---------- Decal 层绘制 (§7 L5): 弹坑/履带压在地形上、单位下 ---------- */
function drawDecals(){
  ctx.drawImage(decalBuf,0,0);
}
/* ---------- 载具绘制 ---------- */
function drawTank(x,y,ang,o){
  const s=o.s===undefined?1:o.s, accent=o.trim||PAL.cyan;   /* s 缺省=1: 修 drawHelpScene 场景 NaN */
  unitShadow(x,y,(o.boss?20:13)*s,(o.boss?8:5)*s,o.boss?0.55:0.38);
  glow(x+Math.cos(ang+Math.PI)*9*s,y+Math.sin(ang+Math.PI)*9*s,12*s,accent,0.13);
  ctx.save(); ctx.translate(Math.round(x),Math.round(y));
  ctx.rotate(Math.round(ang/(Math.PI/24))*(Math.PI/24));
  px(-11*s,-9*s,22*s,5*s,PAL.shadow); px(-11*s,4*s,22*s,5*s,PAL.shadow);
  const off=Math.floor((o.dist||0)/3)%3;
  for(let i=-10;i<10;i+=3){
    px((i+off)*s,-8*s,Math.max(1,1*s),4*s,o.track||PAL.steel);
    px((i+off)*s,5*s,Math.max(1,1*s),3*s,o.track||PAL.steel);
  }
  px(-9*s,-6*s,17*s,12*s,o.hull);
  px(-8*s,-7*s,13*s,2*s,o.hi);
  px(-6*s,-4*s,5*s,3*s,PAL.panel2); px(-1*s,2*s,6*s,3*s,o.hullDk||PAL.dark);
  px(6*s,-5*s,3*s,10*s,accent);
  px(-10*s,-2*s,3*s,4*s,o.hullDk||PAL.rail);
  if(o.boss){ px(2*s,-4*s,5*s,8*s,PAL.gold);
    px(-8*s,-3*s,3*s,6*s,o.turret);
    px(-11.5*s,-3*s,1.5*s,2*s,PAL.ember); px(-11.5*s,1*s,1.5*s,2*s,PAL.ember);   /* 尾部排气光点 */
  }
  px(-5*s,-4*s,9*s,8*s,o.turret);
  px(-2*s,-2*s,4*s,4*s,o.hi);
  if(o.core)px(-1.2*s,-1.2*s,2.4*s,2.4*s,PAL.cyan);   /* 蓝色能量核心 (§五) */
  if(o.twin){
    px(2*s,-4*s,16*s,2*s,o.barrel); px(2*s,2*s,16*s,2*s,o.barrel);
    px(17*s,-4.5*s,3*s,3*s,o.muzzle||accent); px(17*s,1.5*s,3*s,3*s,o.muzzle||accent);
  }
  else { px(3*s,-1.5*s,16*s,3*s,o.barrel); px(18*s,-2.5*s,3*s,5*s,o.muzzle||accent); }
  px(-9*s,-7*s,2*s,2*s,accent); px(-9*s,5*s,2*s,2*s,accent);
  if(o.antenna){ px(-7*s,-8*s,1*s,5*s,PAL.lite); px(-8*s,-9*s,3*s,1*s,accent); }
  if(o.flash>0){ ctx.globalAlpha=0.62; px(-11*s,-9*s,22*s,18*s,PAL.white); ctx.globalAlpha=1; }
  ctx.restore();
}
function drawTruck(x,y,ang,o){
  const s=o.s, accent=o.trim||PAL.red;
  unitShadow(x,y,(o.boss?18:11)*s,(o.boss?7:5)*s,o.boss?0.5:0.34);
  glow(x+Math.cos(ang)*10*s,y+Math.sin(ang)*10*s,9*s,accent,0.11);
  ctx.save(); ctx.translate(Math.round(x),Math.round(y));
  ctx.rotate(Math.round(ang/(Math.PI/24))*(Math.PI/24));
  px(-7*s,-8*s,5*s,4*s,PAL.shadow); px(3*s,-8*s,5*s,4*s,PAL.shadow);
  px(-7*s,4*s,5*s,4*s,PAL.shadow); px(3*s,4*s,5*s,4*s,PAL.shadow);
  px(-10*s,-5*s,10*s,10*s,o.hull);
  px(-10*s,-6*s,10*s,2*s,o.hi);
  px(0*s,-5*s,9*s,10*s,o.boss?PAL.red:o.hull);
  px(3*s,-3*s,4*s,6*s,PAL.lite);
  px(0*s,-5*s,2*s,10*s,accent);
  px(-5*s,-2*s,3*s,4*s,PAL.panel2);
  px(-1*s,-1.2*s,13*s,2.4*s,PAL.rail);
  px(10*s,-2*s,3*s,4*s,o.boss?PAL.gold:accent);
  px(-9*s,-4*s,2*s,2*s,accent); px(-9*s,2*s,2*s,2*s,accent);
  if(o.flash>0){ ctx.globalAlpha=0.62; px(-10*s,-8*s,20*s,16*s,PAL.white); ctx.globalAlpha=1; }
  ctx.restore();
}
function drawEnemy(e){
  const jx=e.jitter>0?rnd(-1.3,1.3):0, jy=e.jitter>0?rnd(-1.3,1.3):0;
  const ex=IPx(e)+jx, ey=IPy(e)+jy;
  if(e.kind==='tank') drawTank(ex,ey,e.a,{s:e.boss?2.3:1,
    hull:e.boss?'#3a1715':PAL.rust,hi:e.boss?PAL.gold:PAL.rustHi,hullDk:PAL.rustDk,track:PAL.rustDk,
    trim:e.boss?PAL.gold:PAL.ember,turret:e.boss?PAL.red:PAL.rustDk,barrel:e.boss?'#4a4f55':PAL.lite,muzzle:e.boss?'#ff9a32':PAL.gold,
    twin:e.boss,dist:e.dist,flash:e.flash,boss:e.boss});
  else drawTruck(ex,ey,e.a,{s:e.boss?2.2:1,
    hull:e.boss?'#3a1715':PAL.rust,hi:e.boss?PAL.gold:PAL.rustHi,
    trim:e.boss?PAL.gold:PAL.ember,boss:e.boss,dist:e.dist,flash:e.flash});
  if(!e.boss)glow(ex,ey,8,PAL.red,0.10);                             /* 敌军红色阵营光 */
  else glow(ex,ey,12+Math.sin(ST.t*4)*2,PAL.red,0.18);               /* BOSS 核心灯脉动 (审查C6) */
  if(!e.boss&&e.hp<e.maxHp){ unitHealth(IPx(e)-11,IPy(e)-e.r-9,22,e.hp/e.maxHp,PAL.red); }
  if(e.flying){ ctx.globalAlpha=0.5; px(IPx(e)-e.r,IPy(e)+e.r,e.r*2,2,PAL.shadow); ctx.globalAlpha=1; }
}
function drawPlayer(){
  const p=player;
  if(p.inv>0&&Math.floor(ST.t*10)%2===0)return;
  const pxp=IPx(p), pyp=IPy(p);
  if(p.sprintG<0.95||COMBO.od)glow(pxp,pyp,24,COMBO.od?PAL.gold:PAL.blue,COMBO.od?0.18:0.12);
  glow(pxp+Math.cos(p.a)*2,pyp+Math.sin(p.a)*2,7+Math.sin(ST.t*5)*1.6,PAL.cyan,0.13);   /* 能量核心脉动光 */
  drawTank(pxp,pyp,p.a,{s:1,hull:PAL.steel,hi:PAL.white,trim:PAL.cyan,turret:PAL.lite,barrel:PAL.steel,antenna:true,core:true,dist:p.dist,flash:0});
  if(p.shieldT>0||p.shieldGrace>0){
    const a=clamp(p.shieldT/0.5,0.25,1);
    glow(pxp,pyp,28,PAL.aqua,0.18*a);
    ctx.save(); ctx.translate(pxp,pyp); ctx.rotate(ST.t*3);
    ctx.globalAlpha=a;
    ctx.strokeStyle=PAL.aqua; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(0,0,17,0,Math.PI*2); ctx.stroke();
    for(let i=0;i<6;i++){ const an=i/6*Math.PI*2;
      px(Math.cos(an)*15-2,Math.sin(an)*15-2,4,4,i%2?PAL.white:PAL.aqua); }
    ctx.globalAlpha=1; ctx.restore();
  }
}
function drawShots(){
  for(const s of shots){
    const sx=IPx(s),sy=IPy(s);
    const col=s.refl?PAL.gold:(s.friendly?PAL.cyan:PAL.orange);
    ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=s.kind==='mg'?0.6:0.5;
    ctx.strokeStyle=col; ctx.lineWidth=s.kind==='mg'?1:2;
    ctx.beginPath(); ctx.moveTo(sx-Math.cos(s.ang)*14,sy-Math.sin(s.ang)*14); ctx.lineTo(sx+Math.cos(s.ang)*3,sy+Math.sin(s.ang)*3); ctx.stroke();
    ctx.restore();
    if(s.kind==='mg'){ glow(sx,sy,6,col,0.3); px(sx-1,sy-1,3,3,s.friendly?PAL.gold:PAL.red); }
    else if(s.kind==='shell'){
      glow(sx,sy,9,s.friendly?PAL.cyan:PAL.orange,0.3);
      ctx.save();ctx.translate(sx,sy);ctx.rotate(s.ang);
      px(-5,-2,10,4,s.friendly?PAL.lite:PAL.red); px(2,-1,5,2,PAL.white);
      ctx.restore(); }
    else { glow(sx,sy,13,s.refl?PAL.gold:PAL.aqua,0.28); ctx.save();ctx.translate(sx,sy);ctx.rotate(s.ang);
      px(-5,-2,10,4,s.refl?PAL.gold:PAL.white); px(-7,-1,4,2,PAL.gold); px(4,-2,3,4,PAL.red);
      ctx.restore(); }
  }
}
function drawPlaneI(pl){
  glow(IPx(pl)-pl.dir*10,IPy(pl),20,PAL.cyan,0.08);
  ctx.save(); ctx.translate(IPx(pl),IPy(pl)); ctx.scale(pl.dir,1);
  px(-16,-3,32,6,PAL.rail); px(-5,-13,10,26,PAL.rail);
  px(-16,-3,32,2,PAL.lite); px(-5,-13,2,26,PAL.lite);
  px(-18,-1,5,2,PAL.ember); px(10,-2,5,4,PAL.cyan);
  px(-20,-7,6,3,PAL.dark);
  ctx.restore();
}
function drawPickup(pk){
  const by=Math.sin(pk.bob)*2;
  if(pk.t<3&&Math.floor(ST.t*8)%2===0)return;
  const y=pk.y+by;
  const c=pk.kind==='heal'?PAL.acid:pk.kind==='part'?PAL.gold:(pk.eqk==='fire'?PAL.violet:pk.eqk==='track'?PAL.aqua:PAL.blue);
  /* 垂直信标光柱 (审查C3): 核心3px+外辉9px, 高40px, 底亮顶透, 顶端光点 */
  ctx.save(); ctx.globalCompositeOperation='lighter';
  const gg=ctx.createLinearGradient(0,y-40,0,y);
  gg.addColorStop(0,rgba(c,0)); gg.addColorStop(1,rgba(c,0.5));
  ctx.fillStyle=gg; ctx.fillRect(pk.x-1.5,y-40,3,40);
  const go=ctx.createLinearGradient(0,y-40,0,y);
  go.addColorStop(0,rgba(c,0)); go.addColorStop(1,rgba(c,0.16));
  ctx.fillStyle=go; ctx.fillRect(pk.x-4.5,y-40,9,40);
  px(pk.x-1,y-41,2,2,PAL.white); glow(pk.x,y-40,5,c,0.5);
  glow(pk.x,y,16,c,0.2);
  ctx.restore();
  ctx.globalAlpha=0.3+0.1*Math.sin(ST.t*3);           /* 呼吸地圈 */
  ctx.strokeStyle=c; ctx.lineWidth=1;
  ctx.beginPath(); ctx.ellipse(pk.x,y+2,9,3.5,0,0,Math.PI*2); ctx.stroke();
  ctx.globalAlpha=1;
  if(pk.kind==='heal'){ px(pk.x-6,y-5,12,10,PAL.white); px(pk.x-6,y-5,12,3,PAL.acid);
    px(pk.x-2,y-3,4,6,PAL.red); px(pk.x-4,y-1,8,2,PAL.red); }
  else if(pk.kind==='part'){ px(pk.x-6,y-5,12,10,PAL.gold); px(pk.x-4,y-3,8,6,PAL.dark);
    px(pk.x-3,y-2,2,2,PAL.gold); px(pk.x+1,y-2,2,2,PAL.gold); px(pk.x-3,y+1,6,2,PAL.gold); }
  else { px(pk.x-7,y-5,14,10,c); px(pk.x-7,y-5,14,2,PAL.lite);
    px(pk.x-5,y-1,3,3,PAL.gold); px(pk.x+1,y-1,3,3,PAL.gold); }
}
function drawParts(){
  for(const p of parts){
    const f=1-p.life/p.t;
    if(p.ring){
      glow(p.x,p.y,p.size*(0.9+f),p.col||PAL.gold,0.08*(1-f));
      ctx.globalAlpha=(1-f)*(p.a||1); ctx.strokeStyle=p.col||PAL.gold; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size*(0.55+f*0.45),0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1; }
    else if(p.core){                          /* 白芯冲击闪光: glow+实心圆 */
      glow(p.x,p.y,p.size*(1.2-f),p.col||PAL.white,0.5*(1-f));
      ctx.globalAlpha=(1-f)*0.95*(p.a||1); ctx.fillStyle=p.col||PAL.white;
      ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(1,p.size*(1-f*0.35)),0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
    else if(p.ray){                           /* 放射光线: 沿速度方向的拖尾光束 */
      const sp=Math.hypot(p.vx,p.vy)||1, ln=8+p.size*2.4;
      ctx.globalAlpha=(1-f)*0.9; ctx.strokeStyle=p.col; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-p.vx/sp*ln,p.y-p.vy/sp*ln); ctx.stroke(); ctx.globalAlpha=1; }
    else if(p.pool){                          /* 爆炸地面光池: 大范围暖光衰减 */
      glow(p.x,p.y,p.size*(0.8+f*0.6),p.col||PAL.orange,0.28*(1-f)); }
    else { ctx.globalAlpha=clamp(p.life/p.t,0,1)*(p.a||1); if(p.size>2)glow(p.x,p.y,p.size*3,p.col,0.07); px(p.x-p.size/2,p.y-p.size/2,p.size,p.size,p.col); ctx.globalAlpha=1; }
  }
}
function drawFloats(){
  uctx.save(); uctx.translate(-Math.round(IPx(cam)),-Math.round(IPy(cam)));
  for(const f of floats){ uctx.globalAlpha=0.3+0.7*clamp(f.t/(f.tm||0.9),0,1); txtO(f.txt,IPx(f),IPy(f),f.size,f.col,'center'); }
  uctx.globalAlpha=1; uctx.restore();
}
/* ---------- HUD ---------- */
function drawRadar(x,y,w,h){
  uctx.save();
  uctx.beginPath(); uctx.rect(x,y,w,h); uctx.clip();
  uctx.globalAlpha=0.35; upx(x,y,w,h,PAL.shadow); uctx.globalAlpha=1;
  uctx.strokeStyle=rgba(PAL.cyan,0.16); uctx.lineWidth=1;
  for(let i=1;i<4;i++){ const gx=x+i*w/4; uctx.beginPath(); uctx.moveTo(gx,y); uctx.lineTo(gx,y+h); uctx.stroke(); }
  for(let i=1;i<3;i++){ const gy=y+i*h/3; uctx.beginPath(); uctx.moveTo(x,gy); uctx.lineTo(x+w,gy); uctx.stroke(); }
  const sx=o=>x+o.x/WORLDW*w, sy=o=>y+o.y/WORLDH*h;
  for(const pk of pickups){ upx(sx(pk)-1,sy(pk)-1,2,2,PAL.gold); }
  for(const e of enemies){ upx(sx(e)-1,sy(e)-1,e.boss?3:2,e.boss?3:2,e.boss?PAL.gold:PAL.red); }
  if(player){ upx(sx(player)-1,sy(player)-1,3,3,PAL.cyan); }
  uctx.restore();
}
function drawWingman(){
  if(!wingman||wingman.downT>0||!player)return;
  const w=wingman;
  const wx=IPx(w), wy=IPy(w);
  const cols={assault:{hull:'#8a4f2f',hi:PAL.white,trim:PAL.gold,turret:'#b06a3a',barrel:PAL.steel},
              guard:{hull:'#2f5a8a',hi:PAL.white,trim:PAL.cyan,turret:'#4a7ab0',barrel:PAL.steel},
              flex:{hull:'#3f7a4f',hi:PAL.white,trim:PAL.lime,turret:'#5aa06a',barrel:PAL.steel}};
  const c=cols[w.type]||cols.flex;
  glow(wx,wy,16,PAL.cyan,0.10+0.06*Math.sin(ST.t*4));
  ctx.save(); ctx.translate(wx,wy); ctx.scale(0.72,0.72);
  drawTank(0,0,w.a,{s:1,hull:c.hull,hi:c.hi,trim:c.trim,turret:c.turret,barrel:c.barrel,antenna:true,dist:0,flash:0});
  ctx.restore();
  px(wx-10,wy-15,20,2,PAL.panel2);
  px(wx-10,wy-15,Math.max(1,Math.round(20*w.hp/w.maxHp)),2,PAL.cyan);
}
function drawHudSkill(x,y,w,label,key,frac,c,ready){
  uPanel(x,y,w,16,c,0.78);
  upx(x+4,y+4,8,8,ready?c:PAL.steel);
  upx(x+6,y+6,4,4,ready?PAL.white:PAL.panel2);
  txt(label,x+16,y+3,6,ready?PAL.white:PAL.lite);
  txt(key,x+w-5,y+3,7,ready?c:PAL.steel,'right');
  uMiniBar(x+16,y+11,w-22,2,frac,c,PAL.panel2);
}
/* BOSS ghost 条状态 (drawHUD用) */
let _bossRef=null,_bossGhost=1;
/* 连击段位词 (审查任务8 / §11) */
const COMBO_WORDS=['','GREAT','SUPERB','DOMINATING','RAMPAGE','UNSTOPPABLE','UNSTOPPABLE'];
function drawHUD(){
  const p=player;
  const touchOn=(SET.touch==='on'||(SET.touch==='auto'&&hasTouch));
  uctx.globalAlpha=0.38; upx(0,0,VW,62,PAL.shadow); upx(0,VH-50,VW,50,PAL.shadow); uctx.globalAlpha=1;
  uPanel(5,5,135,50,PAL.cyan,0.85);
  txt('IRONCLAD-07',35,9,9,PAL.white);
  txt(T('armor'),35,20,7,PAL.lite);
  uMiniBar(74,21,54,4,p.hp/p.maxHp,p.hp>30?PAL.acid:PAL.red,PAL.panel2);
  txt(Math.ceil(p.hp)+'/'+Math.ceil(p.maxHp),131,18,7,PAL.white,'right');
  txt('ENERGY',35,31,7,PAL.gold);
  uMiniBar(74,32,54,4,p.sprintG,p.sprintLock?PAL.red:PAL.gold,PAL.panel2);
  const sReady=p.shieldCd<=0;
  upx(12,13,16,18,PAL.panel2); upx(14,15,12,2,sReady?PAL.cyan:PAL.rail);
  upx(15,18,10,8,sReady?PAL.lite:PAL.rail); upx(18,20,4,4,sReady?PAL.white:PAL.panel2);
  txt(T('ptsLab')+' '+RUN.pts,35,40,7,PAL.gold);

  uPanel(148,5,180,36,PAL.gold,0.8);
  txt((RUN.cycle>0?('#'+(RUN.lvl+1)+' · '+(RUN.cycle+1)+T('cycle')+' · '):'')+I18N[SET.lang].lvNames[RUN.lvl],238,9,9,PAL.white,'center');
  const remain=cfg.quota-ST.killsLevel;
  txt(T('remain')+' '+remain+'  ·  '+fmtTime(ST.levelTime),238,22,8,PAL.lite,'center');

  const rx=touchOn?350:333, rw=touchOn?74:142;
  uPanel(rx,5,rw,touchOn?36:58,PAL.cyan,0.8);
  txt(T('score'),rx+7,9,7,PAL.lite);
  txtO(''+RUN.score,rx+rw-7,8,10,PAL.gold,'right');
  txt(T('kills')+' '+RUN.kills,rx+7,22,7,PAL.lite);
  if(!touchOn)drawRadar(rx+62,24,70,30);

  if(COMBO.n>0){
    const tier=COMBO.tier;
    const col=tier>=4?PAL.red:tier>=1?PAL.gold:PAL.white;   /* 白→金→红, 不与地形色撞车 */
    const sz=9+tier*2.4+(COMBO.flash>0?2:0)+(COMBO.od?Math.sin(ST.t*8)*1.5:0); /* 段位字号阶梯(每档≥16%)+OD脉动 */
    const bw=Math.min(148,Math.max(92,sz*5.8));   /* 不越过两侧技能面板(x186/x340) */
    uPanel(VW/2-bw/2,VH-39,bw,30,col,0.82);
    txtO(T('hitsLab')+' x'+COMBO.n,VW/2,VH-36,sz,col,'center');
    if(tier>=1)txt(COMBO_WORDS[tier],VW/2,VH-47,5,col,'center');   /* 段位词: 面板上方, 不与大字重叠 */
    uMiniBar(VW/2-bw/2+8,VH-15,bw-16,4,COMBO.t/5,(COMBO.t<1.25&&(ST.t*6%1<0.6))?PAL.red:col);
  }
  const boss=enemies.find(e=>e.boss);
  if(boss){
    if(boss!==_bossRef){ _bossRef=boss; _bossGhost=1; }
    const frac=clamp(boss.hp/boss.maxHp,0,1);
    _bossGhost+=(frac-_bossGhost)*0.015; if(frac>_bossGhost)_bossGhost=frac;   /* 白色ghost滞后条 (~12%/s) */
    uPanel(160,43,160,15,PAL.red,0.82);
    txt('BOSS',165,46,7,PAL.gold);
    upx(188,48,124,5,PAL.panel2);
    upx(188,48,Math.round(124*_bossGhost),5,'rgba(243,247,255,0.75)');
    upx(188,48,Math.round(124*frac),5,PAL.red);
    upx(188+31,48,1,5,PAL.ink); upx(188+62,48,1,5,PAL.ink); upx(188+93,48,1,5,PAL.ink);   /* 25% 分段刻度 */
  }
  drawHudSkill(6,VH-47,92,T('skStrike'),keyHint('strike')||'—',1-p.strikeCd/5,PAL.gold,p.strikeCd<=0);
  drawHudSkill(6,VH-29,92,T('skMsl'),keyHint('msl')||'—',p.charging?clamp(p.charge/0.45,0,1):(p.charge>0?p.charge/0.45:0),p.charge>=0.45?PAL.white:PAL.aqua,p.charging||p.charge>0);
  drawHudSkill(102,VH-47,84,T('skTurbo'),keyHint('sprint')||'—',p.sprintG,p.sprintLock?PAL.red:PAL.acid,!p.sprintLock);
  uPanel(VW-134,VH-47,128,42,PAL.gold,0.78);
  txt('LOADOUT',VW-126,VH-42,7,PAL.lite);
  const eqn=(RUN.eq.armor+RUN.eq.track+RUN.eq.fire+RUN.eq.comp);
  txt(T('ptsLab')+' '+RUN.pts,VW-66,VH-42,7,PAL.gold,'right');
  txt('ARM '+RUN.eq.armor,VW-126,VH-29,7,PAL.steel);
  txt('TRK '+RUN.eq.track,VW-86,VH-29,7,PAL.cyan);
  txt('FIR '+RUN.eq.fire,VW-46,VH-29,7,PAL.red);
  txt('EQ '+eqn,VW-66,VH-16,8,PAL.white,'right');
}
function drawWorldGrade(mode){
  ctx.save();
  /* 环境色调分级 (视觉设计第一版 §8): 干旱暖沙/荒原铁锈/雨图冷蓝/沼泽阴绿/绿野微冷 */
  const g=mode==='title'?null:(cfg?cfg.ground:'dry');
  let tint=null,a=0;
  if(mode!=='title'&&cfg&&cfg.rain){ tint='24,52,96'; a=0.10; }
  else if(g==='dry'){ tint='196,128,44'; a=0.05; }
  else if(g==='waste'){ tint='150,62,30'; a=0.07; }
  else if(g==='swamp'){ tint='52,84,40'; a=0.08; }
  else if(g==='grass'){ tint='40,96,52'; a=0.04; }
  if(tint){ ctx.globalCompositeOperation='multiply'; ctx.globalAlpha=a; ctx.fillStyle='rgb('+tint+')'; ctx.fillRect(0,0,VW,VH); }
  ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
  /* 顶部远景压暗 (审查C4): 空气透视 */
  const tg=ctx.createLinearGradient(0,0,0,44);
  tg.addColorStop(0,'rgba(0,0,0,0.30)'); tg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=tg; ctx.fillRect(0,0,VW,44);
  /* 暗角: 加强明暗对比 (0.68) */
  const g2=ctx.createRadialGradient(VW*0.52,VH*0.48,36,VW*0.52,VH*0.48,VW*0.72);
  g2.addColorStop(0,'rgba(255,255,255,0)');
  g2.addColorStop(0.6,'rgba(5,8,13,0.10)');
  g2.addColorStop(1,'rgba(0,0,0,0.68)');
  ctx.fillStyle=g2; ctx.fillRect(0,0,VW,VH);
  ctx.globalAlpha=0.05; ctx.fillStyle=PAL.white;
  for(let y=(Math.floor(ST.t*20)%4);y<VH;y+=4)ctx.fillRect(0,y,VW,1);
  ctx.globalAlpha=0.08; ctx.fillStyle=PAL.gold; ctx.fillRect(0,VH-38,VW,38);
  ctx.restore();
}
/* ---------- 环境漂浮微粒 (§8 环境粒子): 干旱沙尘/荒原余烬/绿野萤光/沼泽湿气 ---------- */
function drawMotes(){
  if(!motes.length)return;
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for(const m of motes){
    ctx.globalAlpha=m.a*(0.6+0.4*Math.sin(m.ph*3+m.x));
    px(m.x,m.y,m.s,m.s,m.c);
  }
  ctx.restore(); ctx.globalAlpha=1;
}
function drawWorld(){
  ctx.save();
  const shx=ST.shake>0?rnd(-ST.shake,ST.shake):0, shy=ST.shake>0?rnd(-ST.shake,ST.shake):0;
  ctx.translate(-Math.round(IPx(cam)+shx),-Math.round(IPy(cam)+shy));
  drawTerrain();
  drawDecals();
  for(const lp of lightPools)glow(lp.x,lp.y,lp.r+Math.sin(ST.t*1.3+lp.ph)*3,PAL.orange,0.10);   /* 战场暖光池 */
  for(const pk of pickups)drawPickup(pk);
  for(const e of enemies)drawEnemy(e);
  if(ST.state!=='over')drawPlayer();
  if(ST.state!=='over')drawWingman();
  drawShots();
  for(const b of bombs){ glow(IPx(b),IPy(b),12,PAL.ember,0.18); px(IPx(b)-2,IPy(b)-2,4,4,PAL.dark); px(IPx(b)-1,IPy(b)-4,2,3,PAL.red); }
  for(const pl of planes)drawPlaneI(pl);
  drawParts();
  ctx.restore();
  if(cfg&&cfg.rain){
    ctx.globalAlpha=0.35;
    for(const r of rains){ px(r.x,r.y,1,5*r.s,PAL.blue); }
    ctx.globalAlpha=1;
    if(ST.flash>0.05&&ST.bolt){
      ctx.save(); ctx.globalCompositeOperation='lighter';
      ctx.strokeStyle='rgba(191,217,255,0.4)'; ctx.lineWidth=4;         /* 闪电辉光底层 */
      ctx.beginPath();
      for(let i=0;i<ST.bolt.pts.length;i++){ const pt=ST.bolt.pts[i];
        if(i===0)ctx.moveTo(pt[0],pt[1]); else ctx.lineTo(pt[0],pt[1]); }
      ctx.stroke(); ctx.restore();
      ctx.strokeStyle=PAL.white; ctx.lineWidth=2;
      ctx.beginPath();
      for(let i=0;i<ST.bolt.pts.length;i++){ const pt=ST.bolt.pts[i];
        if(i===0)ctx.moveTo(pt[0],pt[1]); else ctx.lineTo(pt[0],pt[1]); }
      ctx.stroke();
    }
  }
  drawWorldGrade();
  drawMotes();
  if(ST.flash>0){ ctx.globalAlpha=clamp(ST.flash,0,0.5); px(0,0,VW,VH,PAL.white); ctx.globalAlpha=1; }
  if(player&&player.flash>0&&ST.state==='play'){ ctx.globalAlpha=0.25*player.flash/0.25; px(0,0,VW,VH,PAL.red); ctx.globalAlpha=1; }
}
/* ---------- 帮助页小场景 ---------- */
function drawHelpScene(pg,x,y,w,h){
  ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  px(x,y,w,h,PAL.ink);
  const cx=x+w/2, cy=y+h/2;
  const P=(dx,dy)=>{ctx.save();ctx.translate(cx+dx,cy+dy);ctx.scale(0.9,0.9);ctx.restore();};
  const tankAt=(dx,dy,ang,o)=>{ctx.save();ctx.translate(cx+dx,cy+dy);ctx.scale(0.85,0.85);
    drawTank(0,0,ang,Object.assign({s:1,hull:PAL.lite,hi:PAL.white,trim:PAL.gold,turret:PAL.steel,barrel:PAL.steel,antenna:true,dist:ST.t*40,flash:0},o||{}));ctx.restore();};
  const truckAt=(dx,dy,ang)=>{ctx.save();ctx.translate(cx+dx,cy+dy);ctx.scale(0.85,0.85);
    drawTruck(0,0,ang,{s:1,hull:PAL.brown,hi:PAL.sand,trim:PAL.red,dist:0,flash:0});ctx.restore();};
  const t=ST.t;
  if(pg===0){ px(x,y+h-10,w,10,PAL.sand);
    tankAt(Math.sin(t*1.2)*w*0.25,-6,-Math.PI/2);
    for(const [ax,ay,gx,gy] of [[-40,-24,'◀',0],[40,-24,'▶',0],[0,-38,'▲',0],[-0,22,'▼',0]])
      gtxt(gx||'',cx+ax,cy+ay,10,PAL.gold,'center');
  }
  else if(pg===1){ truckAt(52,10,Math.PI);
    tankAt(-40,-6,0);
    for(let i=0;i<5;i++){ const bx=cx-16+i*14; px(bx,cy-8+i%2*3,5,2,PAL.gold); }
  }
  else if(pg===2){ truckAt(56,16,Math.PI); drawEnemyMiniTank(cx+52,cy-16);
    tankAt(-44,-8,0);
    px(cx-6,cy-9,8,3,PAL.lite);
    parts.length&&0; drawRingMini(cx+34,cy+2,10);
  }
  else if(pg===3){ truckAt(58,18,Math.PI);
    tankAt(-46,-10,0);
    for(let i=0;i<6;i++){ const f=(t*0.6+i/6)%1;
      const mx=cx-30+Math.sin(f*2.4)*22+f*70, my=cy-6-Math.sin(f*3)*14;
      px(mx,my,4,3,PAL.white); px(mx-3,my,3,2,PAL.gold); }
  }
  else if(pg===4){ drawPlaneMini(cx-20,cy-22,1);
    for(let i=0;i<4;i++){ const f=(t*0.8+i*0.25)%1;
      px(cx-6+f*56,cy+2+i*6,3,4,PAL.red); drawRingMini(cx+10+f*46,cy+6+i*6,7+f*4); }
  }
  else if(pg===5){ tankAt(-10+((t*30)%14),-4,0);
    for(let i=0;i<4;i++)px(cx-52-i*12,cy-14+i%2*8,7,2,PAL.gold);
    bar(cx-20,cy+18,60,4,0.6+Math.sin(t*3)*0.3,PAL.lime);
  }
  else if(pg===6){ tankAt(0,-2,0);
    ctx.save();ctx.translate(cx,cy-2);ctx.rotate(t*3);
    for(let i=0;i<6;i++){const an=i/6*Math.PI*2;px(Math.cos(an)*15-2,Math.sin(an)*15-2,4,4,i%2?PAL.white:PAL.lite);}
    ctx.restore();
    px(cx-38,cy-4,7,3,PAL.red); px(cx-30,cy-4,6,3,PAL.gold); px(cx-24,cy-5,2,5,PAL.gold);
  }
  else if(pg===7){ truckAt(34,6,-0.5);
    tankAt(-30,-6,-0.35);
    gtxt('CRIT!',cx+10,cy-22,9,PAL.gold,'center');
    burstMini(cx+26,cy+4);
    for(let i=0;i<3;i++)px(cx+40+i*8,cy-30+i*4,6,2,PAL.white);
  }
  else if(pg===8){
    const cols=[PAL.green,PAL.sand,PAL.blue,PAL.green,PAL.steel];
    for(let i=0;i<5;i++)px(x+6+i*(w-12)/5,y+h-26,(w-12)/5-2,22,cols[i]);
    px(x+6,y+h-6,w-12,4,PAL.dark);
    ctx.globalAlpha=0.5;for(let i=0;i<14;i++)px(x+8+i*9,y+8+((i*13)%20),1,7,PAL.blue);ctx.globalAlpha=1;
    ctx.strokeStyle=PAL.white;ctx.lineWidth=2;ctx.beginPath();
    let bx=x+w*0.3,by=y;ctx.moveTo(bx,by);
    for(let i=0;i<4;i++){bx+=rnd(-6,6)|0;by+=10;ctx.lineTo(bx,by);}ctx.stroke();
    tankAt(w*0.2,h*0.2,-Math.PI/2);
  }
  else if(pg===9){ drawPickupMini(cx-46,cy,'heal');drawPickupMini(cx,cy,'part');drawPickupMini(cx+46,cy,'eq');
    gtxt('x3.2',cx+52,cy-26,8,PAL.gold,'center');
    drawEnemyMiniTank(cx+62,cy+18); gtxt('BIG!',cx+62,cy-2,8,PAL.red,'center');
  }
  else { px(x+8,y+8,w-16,h-40,PAL.dark);
    gtxt(T('upgPts')+' 12',cx,y+12,8,PAL.gold,'center');
    for(let i=0;i<4;i++){ px(x+16,y+26+i*10,90,6,PAL.ink); px(x+16,y+26+i*10,(30+i*12)%90,6,[PAL.green,PAL.lime,PAL.red,PAL.steel][i]); }
    tankAt(w*0.28,h*0.16,0);
  }
  ctx.restore();
  ctx.strokeStyle=PAL.steel; ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
}
function drawRingMini(x,y,r){ ctx.strokeStyle=PAL.gold;ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(x,y,r*(0.6+0.4*Math.sin(ST.t*4)),0,Math.PI*2);ctx.stroke(); }
function burstMini(x,y){ for(let i=0;i<8;i++){const a=i/8*Math.PI*2;
  px(x+Math.cos(a)*7,y+Math.sin(a)*7,3,3,i%2?PAL.gold:PAL.red);} }
function drawEnemyMiniTank(x,y){ ctx.save();ctx.translate(x,y);
  drawTank(0,0,Math.PI,{s:0.8,hull:PAL.steel,hi:PAL.lite,trim:PAL.red,turret:PAL.dark,barrel:PAL.lite,dist:0,flash:0});ctx.restore(); }
function drawPlaneMini(x,y,d){ ctx.save();ctx.translate(x,y);ctx.scale(d*0.7,0.7);
  px(-14,-3,28,6,PAL.steel);px(-4,-11,8,22,PAL.steel);px(-14,-3,28,2,PAL.lite);ctx.restore(); }
function drawPickupMini(x,y,kind){ ctx.save();ctx.translate(x,y);
  drawPickup({x:0,y:0,bob:ST.t*3,t:99,kind,eqk:'armor'});ctx.restore(); }

/* ---------- 各画面 ---------- */
const CREDITS=[
 '','','',
 '《钢铁咆哮 · 坦克大战》','','',
 '制  作  —  像素铁匠铺 PIXEL FORGE','',
 '程  序  —  螺丝刀骑士','',
 '像素美术  —  十六色画匠','',
 '音  效  —  蜂鸣器乐队 (WebAudio)','',
 '音  乐  —  OpenGameArt.org CC0','',
 '    关卡/BOSS曲 — NES Shooter Pack','',
 '    标题曲 — 8Bit Title Screen · Joth','',
 '特别感谢  —  每一位按住 W 不放的车长','',
 '2026 · 完结撒花!','','',
 ''];
function drawTitleBg(){
  if(drawSplashArt('title')){
    drawSplashOverlay('title');
    drawSplashMotes('title',0);
    drawWorldGrade('title');
    return;
  }
  px(0,0,VW,VH,PAL.ink);
  /* 两层废墟城市剪影 + 窗光 (审查任务10): 远景#14161B / 近景#1C1F26 */
  for(let i=0;i<30;i++){ const h=hsh(i,31),x=i*17+((h*22)|0),hh=34+((h*52)|0);
    px(x,VH-20-hh,9,hh,'#191d25');
    if(h>0.5)px(x+2,VH-24-hh,5,2,'#191d25'); }
  for(let i=0;i<40;i++){ const h=hsh(i,7),x=i*13+((h*18)|0),hh=16+((h*44)|0);
    px(x,VH-16-hh,8,hh,'#1c1f26');
    if(h>0.62)px(x+1,VH-20-hh,4,2,'#1c1f26'); }
  for(let i=0;i<18;i++){ const h=hsh(i,55);                       /* 窗光 */
    ctx.globalAlpha=0.5; px(6+i*26+((h*14)|0),VH-26-((h*46)|0),2,1,h>0.5?PAL.orange:PAL.gold); ctx.globalAlpha=1; }
  ctx.globalAlpha=0.28; px(0,VH-66,VW,66,PAL.shadow); ctx.globalAlpha=1;
  /* 两道旋转探照灯扇形 (alpha 0.06) */
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for(const [ox,spd] of [[VW*0.2,0.13],[VW*0.8,-0.1]]){
    const a0=-Math.PI/2+Math.sin(ST.t*spd)*0.5;
    ctx.globalAlpha=0.06; ctx.fillStyle=PAL.cyan;
    ctx.beginPath(); ctx.moveTo(ox,VH-20); ctx.lineTo(ox+Math.cos(a0-0.16)*210,VH-20+Math.sin(a0-0.16)*210);
    ctx.lineTo(ox+Math.cos(a0+0.16)*210,VH-20+Math.sin(a0+0.16)*210); ctx.closePath(); ctx.fill(); }
  ctx.restore(); ctx.globalAlpha=1;
  glow(VW*0.34,VH*0.60,70,PAL.cyan,0.16); glow(VW*0.68,VH*0.54,64,PAL.ember,0.12);
  drawTank(VW*0.42,VH*0.61,-0.1,{s:1.9,hull:PAL.steel,hi:PAL.white,trim:PAL.cyan,turret:PAL.lite,barrel:PAL.steel,antenna:true,core:true,dist:ST.t*30,flash:0});
  drawTruck(VW*0.66,VH*0.58,Math.PI+0.08,{s:1.45,hull:PAL.rust,hi:PAL.rustHi,trim:PAL.ember,dist:ST.t*20,flash:0});
  ctx.globalAlpha=0.4; drawParts(); ctx.globalAlpha=1;
  drawWorldGrade('title');
}
function drawStageIntroBg(){
  if(!drawSplashArt('stage',RUN.lvl)){ drawWorld(); return; }
  drawSplashOverlay('stage');
  drawSplashMotes('stage',RUN.lvl);
  drawWorldGrade();
}
function drawIntroCard(){
  uctx.globalAlpha=0.34; upx(0,0,VW,VH,PAL.ink); uctx.globalAlpha=1;
  uPanel(VW/2-112,62,224,118,PAL.gold,0.78);
  const lv=RUN.cycle>0?' #'+(RUN.lvl+1)+' · '+(RUN.cycle+1)+T('cycle'):'';
  txtO((RUN.cycle>0?'#':'')+TF('{x}',{x:RUN.lvl+1})+(RUN.cycle>0?' · '+(RUN.cycle+1)+T('cycle'):''),VW/2,74,18,PAL.gold,'center');
  txtO(I18N[SET.lang].lvNames[RUN.lvl],VW/2,101,15,PAL.white,'center');
  const hint=I18N[SET.lang].lvHints[RUN.lvl];
  if(hint)txt(hint,VW/2,128,9,PAL.acid,'center');
  txt(TF('introQuota',{n:cfg.quota}),VW/2,150,8,PAL.white,'center');
  txt(T('diff')+': '+I18N[SET.lang].diffNames[SET.diff],VW/2,164,8,PAL.gold,'center');
  if((ST.t%1.2)<0.86)txt(skipDyn(),VW/2,VH-24,7,PAL.lite,'center');
}
function drawClearCard(){
  uctx.globalAlpha=0.58; upx(0,0,VW,VH,PAL.ink); uctx.globalAlpha=1;
  uPanel(VW/2-106,58,212,118,PAL.gold,0.78);
  txtO(T('clearT'),VW/2,64,16,PAL.gold,'center');
  txt(TF('clearStats',{n:ST.killsLevel,t:fmtTime(ST.levelTime)}),VW/2,98,10,PAL.white,'center');
  txt(TF('clearBonus',{n:ST.clearBonus}),VW/2,114,9,PAL.acid,'center');
  txt(T('score')+' '+RUN.score,VW/2,130,10,PAL.gold,'center');
  if((ST.t%1.2)<0.86)txtO(contDyn(),VW/2,164,9,PAL.white,'center');
}
function drawOver(){
  uctx.globalAlpha=0.64; upx(0,0,VW,VH,PAL.ink); uctx.globalAlpha=1;
  uPanel(VW/2-104,72,208,104,PAL.red,0.78);
  txtO(T('overT'),VW/2,80,20,PAL.red,'center');
  txtO(T('overS'),VW/2,110,12,PAL.white,'center');
  if(ST.overT>0.3&&(ST.t%1.2)<0.86)txtO(overRDyn(),VW/2,150,11,PAL.gold,'center');
  const oq=overQDyn();
  if(ST.overT>0.8&&oq)txt(oq,VW/2,172,9,PAL.white,'center');
}
function drawWinBG(){
  px(0,0,VW,VH,PAL.ink);
  glow(VW/2,VH*0.38,90,PAL.gold,0.18);
  drawParts();
  drawWorldGrade();
}
function drawWin(){
  uPanel(VW/2-126,14,252,96,PAL.gold,0.72);
  txtO(T('winT'),VW/2,20,20,PAL.gold,'center');
  txt(T('win1'),VW/2,50,9,PAL.white,'center');
  txt(TF('winStats',{n:RUN.kills,t:fmtTime(RUN.time),s:RUN.score}),VW/2,64,9,PAL.acid,'center');
  if(ST.best>0)txt(TF('best',{n:ST.best}),VW/2,78,8,PAL.gold,'center');
  txt(TF('upgPts')+': '+RUN.pts,VW/2,94,9,PAL.gold,'center');
  if(ST.winT>2&&(ST.t%1.2)<0.86)txtO(winOptDyn(),VW/2,106,8,PAL.white,'center');
  uctx.save(); uctx.beginPath(); uctx.rect(0,118,VW,VH-126); uctx.clip();
  const scroll=ST.winT*13;
  for(let i=0;i<CREDITS.length;i++){
    const y=VH+i*15-scroll;
    if(y>112&&y<VH+8){ const line=CREDITS[i];
      txt(line,VW/2,y,line.indexOf('《')===0?10:8,i<5?PAL.gold:PAL.lite,'center'); }
  }
  uctx.restore();
  upx(0,118,VW,1,PAL.gold); upx(0,VH-8,VW,1,PAL.dark);
}
function drawPauseHint(){
  txt(T('pauseHint'),VW/2,VH-12,7,PAL.steel,'center');
}
