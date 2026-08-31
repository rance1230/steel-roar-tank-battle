"use strict";
/* game/assetpipeline — P3.5 资产驱动渲染原型
   3D 预渲染 Sprite(16方向 hull/turret × diffuse/normal/emissive/shadow)
   + Canvas 法线动态光照(环境光/方向光/点光源) + Emissive Bloom
   + 分层工业场景(per-prop y-sort 遮挡) + 资产纹理七层爆炸
   资产由 art-pipeline 管线烘焙, 经 src/data/assets.data.js 内嵌。 */
window.AP = {
  active:false, ok:false, lights:[], fx:[], sceneRect:[0,0,480,270],
  SEED:(function(){ try{ const s=new URLSearchParams(location.search).get('seed'); return s?parseInt(s)||42:42; }catch(e){ return 42; } })(),
  debug:{frameH:0, frameT:0, litMs:0},
};
(function(){
  if(typeof ASSET_MANIFEST==='undefined'||!ASSET_MANIFEST)return;
  const M=window.ASSET_MANIFEST;
  AP.M=M;
  const keys=Object.keys(M.images); let left=keys.length;
  AP.imgs={};
  for(const k of keys){
    const im=new Image();
    im.onload=()=>{ if(--left===0){ AP.ok=true; if(AP.pending&&window.G){ const p=AP.pending; AP.pending=null; G.visualScene(p); } } };
    im.onerror=()=>{ if(--left===0)AP.ok=false; };
    im.src=M.images[k];
    AP.imgs[k]=im;
  }
})();

/* ---------- 工具 ---------- */
AP.rng=(function(){ let s=AP.SEED>>>0;
  return function(){ s|=0; s=(s+0x6D2B79F5)|0; let t=Math.imul(s^(s>>>15),1|s);
    t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; };})();
AP.rndf=(a,b)=>AP.rng()*(b-a)+a;
/* 烘焙帧朝向实测: 帧 k 面向游戏角 PI+22.5k (帧0炮管朝左) → idx = mod(round(a/22.5°)-8, 16) */
AP.frameOf=a=>{ let k=Math.round(a/(Math.PI/8))-8; k%=16; if(k<0)k+=16; return k; };
const TANK_LAYERS=['hulldiff','hullnorm','hullemis','turdiff','turnorm','turemis','shadow'];

/* ---------- 光照合成缓冲 ---------- */
const LB=128;
const cvLit=document.createElement('canvas'); cvLit.width=cvLit.height=LB;
const xLit=cvLit.getContext('2d',{willReadFrequently:true});
const cvNrm=document.createElement('canvas'); cvNrm.width=cvNrm.height=LB;
const xNrm=cvNrm.getContext('2d',{willReadFrequently:true});
const cvEmi=document.createElement('canvas'); cvEmi.width=cvEmi.height=LB;
const xEmi=cvEmi.getContext('2d',{willReadFrequently:true});
const cvBloom=document.createElement('canvas'); cvBloom.width=cvBloom.height=LB>>1;
const xBloom=cvBloom.getContext('2d');

/* 光照参数: 环境/方向光(屏幕空间, yUP 向上为正)/点光源 —— 光比压窄保两侧细节 */
AP.LIGHT={amb:0.54, sunI:0.62, sunCol:[1,0.97,0.9], sunTo:[-0.44,0.62,0.65], emisGain:1.5};

function drawFrame(x2d,k,layer,dx,dy,dw){
  const M=AP.M.tank, im=AP.imgs[layer];
  x2d.drawImage(im,k*M.fw,0,M.fw,M.fh,dx,dy,dw,dw);
}
/* 核心: 逐像素 N·L 光照合成 (仅玩家, ~16k px, 性能可控) */
AP.drawLitTank=function(wx,wy,hAng,tAng,o,dyOff){
  const M=AP.M.tank, draw=M.draw, sc=draw/M.fw;
  const off=(LB-draw)/2, t0=performance.now();
  const kH=AP.frameOf(hAng), kT=AP.frameOf(tAng);
  AP.debug.frameH=kH; AP.debug.frameT=kT;
  xLit.clearRect(0,0,LB,LB); xNrm.clearRect(0,0,LB,LB); xEmi.clearRect(0,0,LB,LB);
  xLit.imageSmoothingEnabled=true; xNrm.imageSmoothingEnabled=true; xEmi.imageSmoothingEnabled=true;
  drawFrame(xLit,kH,'hulldiff',off,off,draw); drawFrame(xLit,kT,'turdiff',off,off,draw);
  drawFrame(xNrm,kH,'hullnorm',off,off,draw); drawFrame(xNrm,kT,'turnorm',off,off,draw);
  drawFrame(xEmi,kH,'hullemis',off,off,draw); drawFrame(xEmi,kT,'turemis',off,off,draw);
  const di=xLit.getImageData(0,0,LB,LB), ni=xNrm.getImageData(0,0,LB,LB), ei=xEmi.getImageData(0,0,LB,LB);
  const dd=di.data, nd=ni.data, ed=ei.data;
  const L=AP.LIGHT, amb=L.amb, sI=L.sunI, sC=L.sunCol;
  const sTo=L.sunTo;   /* yUP */
  const lights=[];
  for(const li of AP.lights){
    const lx=(li.x-wx)/sc+LB/2, ly=(li.y-wy)/sc+LB/2;   /* 世界y即屏幕y(down) */
    lights.push([lx,ly,(li.r||60)/sc,li.color,li.i*(li.t!==undefined?Math.min(1,li.t/li.ttl*3):1)]);
  }
  for(let i=0;i<dd.length;i+=4){
    const a=dd[i+3]; if(a<8){continue;}
    /* 法线: 贴图 +x右 +y上(zUP), 翻到像素空间 y取反 */
    let nx=nd[i]*0.00392157*2-1, ny=-(nd[i+1]*0.00392157*2-1), nz=nd[i+2]*0.00392157*2-1;
    const nl=Math.hypot(nx,ny,nz)||1; nx/=nl;ny/=nl;nz/=nl;
    let r=amb, g2=amb, b=amb;
    /* sunTo 是 yUP 屏幕空间, 像素空间 y 向下 → y 分量取反 */
    const ndl0=Math.max(0,nx*sTo[0]-ny*sTo[1]+nz*sTo[2]);
    const s=ndl0*sI; r+=sC[0]*s; g2+=sC[1]*s; b+=sC[2]*s;
    const px=(i>>2)%LB, py=(i>>2)/LB|0;
    for(let q=0;q<lights.length;q++){
      const lg=lights[q], dx=lg[0]-px, dy=lg[1]-py, rad=lg[2];
      const d=Math.hypot(dx,dy); if(d>rad)continue;
      const att=(1-d/rad); const att2=att*att*lg[4];
      const iz=10/sc;                                  /* 光源近似高度(局部空间) */
      const dl=Math.hypot(dx,dy,iz)||1;
      const ndl=Math.max(0,(nx*dx+ny*dy+nz*iz)/dl);    /* 法线y为像素空间down, 与dy同向 */
      r+=lg[3][0]*att2*ndl; g2+=lg[3][1]*att2*ndl; b+=lg[3][2]*att2*ndl;
    }
    const eg=L.emisGain;
    dd[i]  =Math.min(255, dd[i]  *r + ed[i]  *eg);
    dd[i+1]=Math.min(255, dd[i+1]*g2 + ed[i+1]*eg);
    dd[i+2]=Math.min(255, dd[i+2]*b + ed[i+2]*eg);
  }
  xLit.putImageData(di,0,0);
  const wy2=(dyOff!==undefined)?dyOff:(wy-LB/2*sc);   /* 调用方已算好含锚点的绘制y */
  ctx.drawImage(cvLit, 0,0,LB,LB, wx-LB/2*sc, wy2, LB*sc, LB*sc);
  /* bloom: emissive 半分辨率模糊后叠加 (只对 emissive 层, 非整屏) */
  if(PERF.qLevel>0){
    xBloom.clearRect(0,0,LB>>1,LB>>1);
    xBloom.imageSmoothingEnabled=true;
    xBloom.drawImage(cvEmi,0,0,LB,LB,0,0,LB>>1,LB>>1);
    ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=0.85;
    ctx.filter='blur(2px)';
    ctx.drawImage(cvBloom, 0,0,LB>>1,LB>>1, wx-LB/2*sc, wy2, LB*sc, LB*sc);
    ctx.filter='none'; ctx.restore();
  }
  AP.debug.litMs=AP.debug.litMs*0.9+(performance.now()-t0)*0.1;
};
AP.debugLit=function(){
  const d=xLit.getImageData(0,0,LB,LB).data, n=xNrm.getImageData(0,0,LB,LB).data;
  let op=0,sr=0,sn=0,mid=null;
  for(let i=0;i<d.length;i+=4){ if(d[i+3]>150){op++;sr+=d[i];sn+=n[i];
    if(!mid&&i>(LB*LB*2)){ mid={lit:[d[i],d[i+1],d[i+2]],nrm:[n[i],n[i+1],n[i+2]]}; } } }
  return {opaque:op,avgR:op?+(sr/op).toFixed(1):0,avgN:op?+(sn/op).toFixed(1):0,mid};
};

/* ---------- 玩家绘制 (资产路径) ---------- */
function drawPlayerAP(){
  const p=player;
  if(p.inv>0&&Math.floor(ST.t*10)%2===0)return;
  const pxp=IPx(p), pyp=IPy(p);
  const M=AP.M.tank, draw=M.draw, sc=draw/M.fw;
  const ayOff=(M.anchor[1]-M.fh/2)*sc;          /* 地面锚点对齐: 帧 80,~103 → 世界y即脚点 */
  const dy=pyp-LB/2*sc-ayOff;
  if(p.ta===undefined)p.ta=p.a;
  /* shadow */
  ctx.save(); ctx.imageSmoothingEnabled=true; ctx.globalAlpha=0.94;
  const sk=AP.frameOf(p.a);
  ctx.drawImage(AP.imgs.shadow, sk*M.fw,0,M.fw,M.fh, pxp-LB/2*sc, dy, LB*sc, LB*sc);
  ctx.restore();
  if(p.sprintG<0.95||COMBO.od)glow(pxp,pyp,26,COMBO.od?PAL.gold:PAL.blue,COMBO.od?0.16:0.11);
  AP.drawLitTank(pxp,pyp,p.a,p.ta,{},dy);
  if(p.flash>0){ ctx.save(); ctx.globalAlpha=0.5*p.flash/0.25; ctx.globalCompositeOperation='lighter';
    ctx.fillStyle=PAL.white; ctx.fillRect(pxp-draw*0.42,pyp-draw*0.42,draw*0.84,draw*0.84); ctx.restore(); }
  if(p.shieldT>0||p.shieldGrace>0){
    const al=clamp(p.shieldT/0.5,0.25,1);
    glow(pxp,pyp,28,PAL.aqua,0.18*al);
    ctx.save(); ctx.translate(pxp,pyp); ctx.rotate(ST.t*3);
    ctx.globalAlpha=al;
    ctx.strokeStyle=PAL.aqua; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(0,0,draw*0.5,0,Math.PI*2); ctx.stroke();
    for(let i=0;i<6;i++){ const an=i/6*Math.PI*2;
      px(Math.cos(an)*draw*0.45-2,Math.sin(an)*draw*0.45-2,4,4,i%2?PAL.white:PAL.aqua); }
    ctx.globalAlpha=1; ctx.restore();
  }
}

/* ---------- 资产纹理七层爆炸 ---------- */
function ape(x,y,vx,vy,life,tex,size,rot,al,add,grav){
  const f={x,y,vx,vy,life,t:life,tex:'fx_'+tex,size,rot:rot||0,vr:AP.rndf(-2,2),al:al||1,add:!!add,grav:grav||0,grow:5.5};
  AP.fx.push(f); return f;
}
AP.explode=function(x,y,r,big){
  const R=big?1.7:1;
  ape(x,y,0,0,0.13,'flash',r*1.35*R,0,1,true);                                       /* 1 白闪 */
  for(let i=0,n=big?9:6;i<n;i++){ const a=AP.rng()*6.283,d=AP.rng()*r*0.3;           /* 2 火球 */
    ape(x+Math.cos(a)*d,y+Math.sin(a)*d,AP.rndf(-18,18),AP.rndf(-18,18),AP.rndf(0.32,0.6),'fire',AP.rndf(r*0.85,r*1.3)*R,AP.rng()*6.283,1,true); }
  const ring=ape(x,y,0,0,big?0.4:0.3,'ring',r*1.2,0,1,true);                         /* 3 冲击波 */
  ring.grow=big?7.5:5.5;
  for(let i=0,n=big?14:9;i<n;i++){ const a=AP.rng()*6.283,s=AP.rndf(80,big?190:130); /* 4 火花 */
    ape(x,y,Math.cos(a)*s,Math.sin(a)*s,AP.rndf(0.18,0.36),'spark',AP.rndf(9,15),AP.rng()*6.283,1,true,150); }
  for(let i=0,n=big?8:5;i<n;i++){ const a=AP.rng()*6.283,s=AP.rndf(40,big?120:85);   /* 5 碎片 */
    part(x,y,Math.cos(a)*s,Math.sin(a)*s-30,AP.rndf(0.35,0.7),[PAL.steel,PAL.dark][(AP.rng()*2)|0],AP.rndf(1.5,3),220); }
  for(let i=0,n=big?6:4;i<n;i++)                                                      /* 6 烟雾 */
    ape(x+AP.rndf(-r*0.4,r*0.4),y+AP.rndf(-r*0.4,r*0.4),AP.rndf(-8,8),AP.rndf(-30,-12),AP.rndf(1.1,2.2),'smoke',AP.rndf(26,46)*(big?1.3:1),AP.rng()*6.283,0.5,false);
  const sc=AP.imgs.fx_scorch, sw=r*2.9;                                               /* 7 地面焦痕 */
  dctx.globalAlpha=0.8; dctx.drawImage(sc,x-sw/2,y-sw*0.31,sw,sw*0.62); dctx.globalAlpha=1;
  AP.lights.push({x,y,r:r*4.4,color:[1,0.55,0.22],i:big?2.1:1.5,ttl:big?0.55:0.42,t:0});
  addLight(x,y,r*(big?4.4:3.2),big?PAL.orange:PAL.gold,big?0.46:0.32,big?0.42:0.28);
  part(x,y,0,0,0.4,PAL.orange,r*1.8,0).pool=true;
  cameraKick(big?7:3,rnd(Math.PI*2),big?0.036:0.012);
  if(big)SFX.bigboom(x,y);else SFX.boom(x,y);
};
AP.updFx=function(dt){
  for(let i=AP.fx.length-1;i>=0;i--){ const f=AP.fx[i];
    f.life-=dt; if(f.life<=0){AP.fx.splice(i,1);continue;}
    f.x+=f.vx*dt; f.y+=f.vy*dt; f.vy+=f.grav*dt; f.rot+=f.vr*dt; }
  for(let i=AP.lights.length-1;i>=0;i--){ const l=AP.lights[i];
    l.t+=dt; if(l.t>=l.ttl)AP.lights.splice(i,1); }
};
AP.drawFx=function(){
  ctx.save(); ctx.imageSmoothingEnabled=true;
  for(const f of AP.fx){ if(f.add)continue;                                     /* 烟雾+实色火球(普通alpha, 保饱和) */
    const g=1-f.life/f.t, sz=f.size*(0.8+g*1.3);
    if(f.tex==='fx_fire'){
      ctx.globalAlpha=f.al*0.95*(1-g*0.55);
      ctx.drawImage(AP.imgs[f.tex],f.x-sz/2,f.y-sz/2,sz,sz);
      continue;
    }
    ctx.globalAlpha=f.al*(1-g)*(g<0.12?g/0.12:1);
    ctx.drawImage(AP.imgs[f.tex],f.x-sz/2,f.y-sz/2,sz,sz); }
  ctx.globalCompositeOperation='lighter';                                       /* 加色层: 闪/环/火花/火光 */
  for(const f of AP.fx){ if(!f.add)continue;
    const g=1-f.life/f.t; let sz=f.size, al=f.al*(1-g);
    if(f.tex==='ring'){ sz=f.size+g*(f.grow||5)*f.t*10; al=f.al*(1-g*g); }
    if(f.tex==='flash')sz=f.size*(1-g*0.3);
    if(f.tex==='fire'){ al*=0.55; }
    ctx.globalAlpha=Math.max(0,al);
    ctx.drawImage(AP.imgs[f.tex],f.x-sz/2,f.y-sz/2,sz,sz); }
  ctx.restore(); ctx.globalAlpha=1;
};

/* ---------- 分层工业场景 ---------- */
AP.drawSceneLow=function(){
  const S=AP.M.scene; if(!S)return;
  ctx.save(); ctx.imageSmoothingEnabled=true;
  ctx.drawImage(AP.imgs.ground, S.rect[0],S.rect[1],S.rect[2],S.rect[3]);
  ctx.restore();
};
/* 裁剪图已裁到内容, 源矩形 (0,0,w,h); 摆放 = 裁剪框原渲染坐标 * s; by 仅用于 y-sort */
AP.drawScenePropsAt=function(front){
  const S=AP.M.scene; if(!S||!S.props)return;
  const py=player?IPy(player):1e9;
  ctx.save(); ctx.imageSmoothingEnabled=true;
  for(const p of S.props){
    if((p.by>py)!==front)continue;
    const im=AP.imgs[p.k];
    ctx.drawImage(im, 0,0,p.c[2],p.c[3],
      S.rect[0]+p.c[0]*p.s, S.rect[1]+p.c[1]*p.s, p.c[2]*p.s, p.c[3]*p.s);
  }
  ctx.restore();
};

/* ---------- 世界绘制 (资产路径) ---------- */
function drawWorldAP(){
  ctx.save();
  const shx=ST.shake>0?rnd(-ST.shake,ST.shake):0, shy=ST.shake>0?rnd(-ST.shake,ST.shake):0;
  const z=1+(cam&&cam.zoom?cam.zoom:0), kx=cam&&cam.kickX?cam.kickX:0, ky=cam&&cam.kickY?cam.kickY:0;
  ctx.translate(VW/2,VH/2); ctx.scale(z,z); ctx.translate(-VW/2,-VH/2);
  ctx.translate(-Math.round(IPx(cam)+shx-kx),-Math.round(IPy(cam)+shy-ky));
  drawTerrain();
  drawDecals();
  AP.drawSceneLow();
  for(const lp of lightPools)glow(lp.x,lp.y,lp.r+Math.sin(ST.t*1.3+lp.ph)*3,PAL.orange,0.10);
  for(const pk of pickups)drawPickup(pk);
  for(const e of enemies)drawEnemy(e);
  AP.drawScenePropsAt(false);            /* 玩家身后(y靠上)的道具 */
  if(ST.state!=='over')drawPlayerAP();
  drawShots();
  for(const b of bombs){ glow(IPx(b),IPy(b),12,PAL.ember,0.18); px(IPx(b)-2,IPy(b)-2,4,4,PAL.dark); px(IPx(b)-1,IPy(b)-4,2,3,PAL.red); }
  for(const pl of planes)drawPlaneI(pl);
  drawParts();
  AP.drawFx();
  drawDynamicLights();
  AP.drawScenePropsAt(true);             /* 玩家身前(y靠下)的道具 → 遮挡 */
  ctx.restore();
  drawWorldGrade();
  drawMotes();
  drawScreenFX();
  if(ST.flash>0){ ctx.globalAlpha=clamp(ST.flash,0,0.5); px(0,0,VW,VH,PAL.white); ctx.globalAlpha=1; }
}

/* ---------- 场景脚本 (asset-pipeline debug scene) ---------- */
AP.setupScene=function(){
  DBG.lab=true;
  if(!AP.ok){ AP.pending='asset-pipeline'; return 'asset-pipeline assets loading…'; }
  RUN.lvl=0; startLevel();
  terr={m:new Uint8Array(MAPW*MAPH)};   /* 清空地形碰撞/减速, 地面由场景图承担 */
  lightPools=[];                        /* 去掉随机暖光池, 场景自带光照 */
  MENU=null; ST.state='play'; ST.introT=0; ST.spawnT=1e9; ST.spawnedN=cfg.quota;
  ST.shake=0; ST.flash=0; ST.bolt=null; ST.bossWarn=0; ST.bossSpawned=false;
  enemies.length=0; pickups.length=0; parts.length=0; floats.length=0; planes.length=0; bombs.length=0; shots.length=0;
  COMBO.n=0; COMBO.t=0; COMBO.tier=0; COMBO.od=false;
  clearDecals();
  AP.active=true; AP.fx.length=0; AP.lights.length=0;
  const CX=AP.sceneRect[0]+AP.sceneRect[2]/2, CY=AP.sceneRect[1]+AP.sceneRect[3]/2;
  window.G.tp(CX,CY);
  player.vx=player.vy=0; player.a=-Math.PI/2; player.ta=player.a+0.5;
  player.inv=0; player.flash=0; player.hp=player.maxHp=100; player.shieldT=0; player.shieldGrace=0; player.breach=null;
  AP.nextBoom=1.1; AP.boomT=3.4;
  cam.x=AP.sceneRect[0]; cam.y=AP.sceneRect[1]; cam.ox=cam.x; cam.oy=cam.y;
  return 'asset-pipeline props:'+(AP.M.scene.props||[]).length+' draw:'+AP.M.tank.draw+' anchor:'+AP.M.tank.anchor;
};
AP.tick=function(dt){
  if(!AP.active)return;
  /* 炮塔缓慢随动 + 演示摆动 */
  player.ta+=angDiff(player.ta,player.a)*Math.min(1,dt*1.6)+Math.sin(ST.t*0.7)*dt*0.22;
  /* 周期性炸弹: 玩家左侧爆炸 → 验证法线光照 */
  AP.nextBoom-=dt;
  if(AP.nextBoom<=0){ AP.nextBoom=AP.boomT;
    AP.explode(player.x-92, player.y+46, 22, true); }
  /* 炮口灯: 检测新射击 */
  if(shots.length&&shots._n!==shots.length){ shots._n=shots.length;
    const s=shots[shots.length-1];
    AP.lights.push({x:s.x-Math.cos(s.ang)*6,y:s.y-Math.sin(s.ang)*6,r:34,color:[1,0.8,0.4],i:1.3,ttl:0.12,t:0}); }
  if(!shots.length)shots._n=0;
  AP.updFx(dt);
};

/* ---------- 接入现有渲染路径 ---------- */
const _drawPlayer=drawPlayer;
drawPlayer=function(){ if(AP.active&&AP.ok)drawPlayerAP(); else _drawPlayer(); };
const _drawWorld=drawWorld;
drawWorld=function(){ if(AP.active&&AP.ok)drawWorldAP(); else _drawWorld(); };

/* ---------- 调试探针 (G 在 main.js 中定义, 延迟挂载) ---------- */
requestAnimationFrame(function(){
  if(!window.G)return;
  G.ap={
  info(){ return {ok:AP.ok,active:AP.active,frameH:AP.debug.frameH,frameT:AP.debug.frameT,
    lights:AP.lights.length,fx:AP.fx.length,draw:AP.M?AP.M.tank.draw:0,
    anchor:AP.M?AP.M.tank.anchor:null,litMs:+AP.debug.litMs.toFixed(2),
    props:AP.M&&AP.M.scene?AP.M.scene.props.length:0}; },
  setTurret(a){ player.ta=a; },
  setHull(a){ player.a=a; },
  boom(dx,dy){ AP.explode(player.x+(dx===undefined?-92:dx), player.y+(dy===undefined?46:dy), 22, true); },
  lightAt(x,y){ AP.lights.push({x,y,r:70,color:[0.4,0.8,1],i:2,ttl:2,t:0}); },
  };
});
