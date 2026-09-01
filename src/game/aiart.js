"use strict";
/* game/aiart — generated v1.4 art slice integration */
(function(){
const manifest=window.AI_ART_MANIFEST||null;
const AIART={
  enabled:true,
  ok:false,
  ready:false,
  manifest,
  imgs:{},
  total:0,
  loaded:0,
  errors:[],
  fx:[],
};
window.AIART=AIART;
if(!manifest||!manifest.images)return;

function refreshReady(){
  AIART.ready=AIART.loaded+AIART.errors.length>=AIART.total;
  AIART.ok=AIART.loaded>0;
}
function loadImages(){
  const imgs=manifest.images||{};
  for(const key of Object.keys(imgs)){
    AIART.total++;
    const im=new Image();
    im.onload=function(){AIART.loaded++;refreshReady();};
    im.onerror=function(){AIART.errors.push(key);refreshReady();};
    im.src=imgs[key];
    AIART.imgs[key]=im;
  }
}
function readyImage(key){
  const im=AIART.imgs[key];
  return im&&im.complete&&im.naturalWidth>0?im:null;
}
function apActive(){
  return !!(window.AP&&AP.active&&AP.ok);
}
function usable(){
  return AIART.enabled&&AIART.ok&&!apActive();
}
function unitSpec(group,key){
  return manifest.units&&manifest.units[group]&&manifest.units[group][key];
}
function drawSprite(imageKey,x,y,ang,w,opt){
  const im=readyImage(imageKey);
  if(!im)return false;
  opt=opt||{};
  const g=opt.ctx||ctx;
  const anchor=opt.anchor||[0.5,0.56];
  const h=w*im.naturalHeight/im.naturalWidth;
  if(opt.shadow!==false&&g===ctx){
    unitShadow(x,y,w*(opt.shadowW||0.34),h*(opt.shadowH||0.18),opt.shadowA||0.36);
  }else if(opt.shadow!==false){
    g.save(); g.globalAlpha=opt.shadowA||0.32; g.fillStyle=PAL.shadow;
    g.beginPath(); g.ellipse(x,y+2,w*(opt.shadowW||0.34),h*(opt.shadowH||0.18),0,0,Math.PI*2); g.fill(); g.restore();
  }
  g.save();
  /* 高清层(2x资产)支持平滑旋转; 像素层仍用镜像防糊 */
  g.imageSmoothingEnabled=true;
  if(opt.alpha!==undefined)g.globalAlpha=opt.alpha;
  if(opt.mode==='free'){
    g.translate(Math.round(x),Math.round(y)); g.rotate(ang||0);
    g.drawImage(im,-w*anchor[0],-h*anchor[1],w,h);
  }else{
    const faceR=Math.abs(angDiff(ang||0,0))<=Math.PI/2;
    const dx=x-w*anchor[0], dy=y-h*anchor[1];
    if(faceR)g.drawImage(im,Math.round(dx),Math.round(dy),w,h);
    else{ g.translate(Math.round(2*x),0); g.scale(-1,1);
          g.drawImage(im,Math.round(dx),Math.round(dy),w,h); }
  }
  if(opt.flash>0){
    g.globalCompositeOperation='lighter';
    g.globalAlpha=Math.min(0.5,opt.flash*1.7);
    g.fillStyle=PAL.white;
    g.beginPath();
    g.ellipse(0,0,w*0.38,h*0.38,0,0,Math.PI*2);
    g.fill();
  }
  g.restore();
  return true;
}
AIART.drawSprite=drawSprite;

function drawUnit(spec,x,y,ang,opt){
  if(!spec)return false;
  opt=opt||{};
  opt.anchor=spec.anchor||opt.anchor;
  const glowCol=spec.glow||opt.glow;
  if(glowCol&&opt.glow!==false){
    if(opt.ctx&&opt.ctx!==ctx)hGlow(x,y,(opt.glowR||18)+Math.sin(ST.t*4+(x+y)*0.01)*2,glowCol,opt.glowA||0.12);
    else glow(x,y,(opt.glowR||18)+Math.sin(ST.t*4+(x+y)*0.01)*2,glowCol,opt.glowA||0.12);
  }
  return drawSprite(spec.image,x,y,ang,spec.w*(opt.scale||1),opt);
}
AIART.drawUnit=drawUnit;

function drawGroundOverlay(){
  if(!usable()||!cfg||RUN.lvl!==0)return false;
  if(typeof V15T!=='undefined'&&V15T.ok)return false;   /* v1.5: v15 烘焙地形已全量接管, 停用旧叠图 */
  const key=manifest.environment&&manifest.environment.stage1Ground;
  const im=readyImage(key);
  if(!im)return false;
  const tile=192;
  const x0=Math.floor(cam.x/tile)*tile-tile;
  const y0=Math.floor(cam.y/tile)*tile-tile;
  ctx.save();
  ctx.imageSmoothingEnabled=true;
  ctx.globalAlpha=PERF&&PERF.qLevel>0?0.24:0.16;
  ctx.globalCompositeOperation='soft-light';
  for(let y=y0;y<cam.y+VH+tile;y+=tile){
    for(let x=x0;x<cam.x+VW+tile;x+=tile){
      ctx.drawImage(im,x,y,tile,tile);
    }
  }
  ctx.restore();
  return true;
}

/* 玩家/僚机走高清层(小尺寸立绘在像素buf中细节全失), 敌军/BOSS/爆炸留在像素层与场地统一 */
AIART.queue=[];
function drawPlayerAI(){
  if(!usable()||!player)return false;
  const p=player;
  if(p.inv>0&&Math.floor(ST.t*10)%2===0)return true;
  const spec=unitSpec('player',RUN.hull||'balanced');
  if(!spec||!readyImage(spec.image))return false;
  const v=hullCfg().vis||{}, sc2=hullCfg().shield;
  AIART.queue.push({spec,x:IPx(p),y:IPy(p),ang:p.a,flash:p.flash||0,
    shield:p.shieldT>0||p.shieldGrace>0,shieldA:clamp(p.shieldT/0.5,0.25,1),
    shieldAge:p.shieldAge,shieldFlash:p.shieldFlash||0,fortress:!!sc2.fortress,
    ringCol:v.ring||spec.glow||PAL.aqua,od:COMBO.od,sprintG:p.sprintG,kind:'player'});
  return true;
}

function drawEnemyAI(e){
  if(!usable()||!e)return false;
  const jx=e.jitter>0?rnd(-1.3,1.3):0, jy=e.jitter>0?rnd(-1.3,1.3):0;
  const base=e.boss?'boss':(e.kind==='tank'?'tank':'truck');
  const spec=unitSpec('enemy',base);
  if(!spec||!readyImage(spec.image))return false;
  AIART.queue.push({kind:'enemy',spec,x:IPx(e)+jx,y:IPy(e)+jy,ang:e.a,flash:e.flash||0,
    boss:!!e.boss,w:e.boss&&spec.bossW?spec.bossW:spec.w,
    hp:e.hp/e.maxHp,showHp:!e.boss&&e.hp<e.maxHp,r:e.r,flying:!!e.flying});
  return true;
}

function drawWingmanAI(){
  if(!usable())return false;
  if(!wingman||wingman.downT>0||!player)return true;
  const w=wingman;
  const spec=unitSpec('wingman',w.type||'flex');
  if(!spec||!readyImage(spec.image))return false;
  AIART.queue.push({spec,x:IPx(w),y:IPy(w),ang:w.a,flash:0,kind:'wing',
    hp:w.hp/w.maxHp});
  return true;
}
/* 高清层输出: 在 uctx(逻辑坐标 VW×VH) 上绘制队列; camOff=[ox,oy] 与像素层相机一致 */
AIART.flushHd=function(ox,oy){
  if(!AIART.queue.length)return;
  uctx.save();
  try{
  uctx.translate(-Math.round(ox),-Math.round(oy));
  uctx.imageSmoothingEnabled=true;
  for(const q of AIART.queue){
    if(!isFinite(q.x)||!isFinite(q.y))continue;   /* 坐标异常的单位跳过, 不让单点 NaN 炸掉整帧渲染 */
    const spec=q.spec, im=readyImage(spec.image); if(!im)continue;
    const w=q.w||spec.w, h=w*im.naturalHeight/im.naturalWidth;
    const ax=spec.anchor?spec.anchor[0]:0.53, ay=spec.anchor?spec.anchor[1]:0.56;
    /* 落影 */
    uctx.save(); uctx.globalAlpha=q.boss?0.42:0.30; uctx.fillStyle=PAL.shadow;
    uctx.beginPath(); uctx.ellipse(q.x,q.y+2,w*(q.boss?0.44:0.40),h*0.10,0,0,Math.PI*2); uctx.fill(); uctx.restore();
    /* 阵营辉光 */
    if(q.kind==='enemy'){ hGlow(q.x,q.y,q.boss?14+Math.sin(ST.t*4)*2:8,PAL.red,q.boss?0.16:0.10); }
    else if(spec.glow)hGlow(q.x,q.y-h*0.40,w*0.62,spec.glow,0.11+0.04*Math.sin(ST.t*4));
    if(q.kind==='player'&&q.od)hGlow(q.x,q.y,26,PAL.gold,0.16);
    /* 立绘: 高清层平滑旋转(全向) */
    uctx.save();
    uctx.translate(Math.round(q.x),Math.round(q.y)); uctx.rotate(q.ang||0);
    uctx.drawImage(im,-w*ax,-h*ay,w,h);
    if(q.flash>0){ uctx.globalCompositeOperation='lighter';
      uctx.globalAlpha=Math.min(0.5,q.flash*1.7); uctx.fillStyle=PAL.white;
      uctx.beginPath(); uctx.ellipse(0,0,w*0.36,h*0.30,0,0,Math.PI*2); uctx.fill(); }
    uctx.restore();
    if(q.kind==='player'){
      if(q.shield){   /* v1.7: 3D 等离子护罩球 (随机体适配) */
        const vv=(HULLS[RUN.hull]||HULLS.balanced).vis||{};
        drawShieldOrb(uctx,q.x,q.y,shieldOrbR(vv.s,w),q.ringCol,q.shieldA,
          {age:q.shieldAge,flash:q.shieldFlash,fortress:q.fortress});
      }
    } else if(q.kind==='wing'){
      uctx.globalAlpha=1; uctx.fillStyle=PAL.panel2; uctx.fillRect(q.x-10,q.y-h*0.52,20,2);
      uctx.fillStyle=spec.glow||PAL.cyan; uctx.fillRect(q.x-10,q.y-h*0.52,Math.max(1,Math.round(20*q.hp)),2);
    } else if(q.kind==='enemy'){
      if(q.showHp){ uctx.globalAlpha=1;
        uctx.fillStyle=PAL.panel2; uctx.fillRect(q.x-11,q.y-q.r-12,22,3);
        uctx.fillStyle=PAL.red; uctx.fillRect(q.x-11,q.y-q.r-12,Math.max(1,Math.round(22*q.hp)),3); }
      if(q.flying){ uctx.globalAlpha=0.5; uctx.fillStyle=PAL.shadow;
        uctx.fillRect(q.x-q.r,q.y+q.r,q.r*2,2); uctx.globalAlpha=1; }
    }
  }
  } finally {
    AIART.queue.length=0;   /* 即使绘制中途抛错也必须清队列, 否则旧项逐帧累积 */
    uctx.restore();
  }
};
/* uctx 版辉光(与像素层 glow 同视觉) */
function hGlow(x,y,r,c,a){
  const g=uctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,rgba(c,a)); g.addColorStop(0.45,rgba(c,a*0.28)); g.addColorStop(1,rgba(c,0));
  uctx.save(); uctx.globalCompositeOperation='lighter'; uctx.fillStyle=g;
  uctx.fillRect(x-r,y-r,r*2,r*2); uctx.restore();
}

function drawHullPreviewAI(k,x,y,w,h){
  if(!usable())return false;
  const spec=unitSpec('player',k);
  if(!spec||!readyImage(spec.image))return false;
  const v=HULLS[k].vis||{};
  uctx.save();
  uctx.beginPath(); uctx.rect(x,y,w,h); uctx.clip();
  upx(x,y,w,h,PAL.ink);
  upx(x,y+h-12,w,12,PAL.sand); upx(x+4,y+h-12,w-8,2,PAL.brown);
  const cx=x+w/2, cy=y+h/2-4;
  const pl=Math.sin(ST.t*1.1)*w*0.12;
  hGlow(cx,cy,24,spec.glow||v.glow||PAL.cyan,0.13);
  drawUnit(spec,cx+pl,cy,-Math.PI/2,{scale:1.35,shadowW:0.42,shadowH:0.19,shadowA:0.32,glow:false,ctx:uctx,mode:'free'});
  const rp=(ST.t*0.5)%1, col=spec.glow||v.trim||PAL.cyan;
  uctx.strokeStyle=rgba(col,0.6*(1-rp)); uctx.lineWidth=1;
  uctx.beginPath(); uctx.arc(cx,cy,9+rp*24,0,Math.PI*2); uctx.stroke();
  txt(v.callsign||spec.role||'IRONCLAD-07',x+w-6,y+6,7,rgba(col,0.95),'right');
  for(let i=0;i<HULLS[k].mslN;i++)txt('>',x+8+i*10,y+6,8,PAL.gold);
  uctx.restore();
  uctx.strokeStyle=PAL.steel; uctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
  return true;
}

function drawWingPreview(k,x,y,w,h){
  if(!usable()||k==='none')return false;
  const spec=unitSpec('wingman',k);
  if(!spec||!readyImage(spec.image))return false;
  ctx.save();
  ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  px(x,y,w,h,PAL.ink);
  px(x,y+h-11,w,11,PAL.panel2); px(x+4,y+h-11,w-8,2,PAL.steel);
  const cx=x+w/2, cy=y+h/2-3, col=spec.glow||PAL.cyan;
  glow(cx,cy,18,col,0.12);
  drawUnit(spec,cx+Math.sin(ST.t*1.2)*w*0.08,cy,-Math.PI/2,{scale:1.42,shadowW:0.40,shadowH:0.18,glow:false});
  ctx.globalAlpha=0.45;
  ctx.strokeStyle=rgba(col,0.7); ctx.lineWidth=1;
  ctx.beginPath(); ctx.ellipse(cx,cy+11,28,8,0,0,Math.PI*2); ctx.stroke();
  ctx.globalAlpha=1;
  ctx.restore();
  ctx.strokeStyle=PAL.steel; ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
  return true;
}
window.drawWingPreview=drawWingPreview;
window.drawHullPreviewAI=drawHullPreviewAI;   /* main.js 阶段3 预览调用 */
window.unitSpec=unitSpec; window.readyImage=readyImage; window.usable=usable;

function spawnExplosion(x,y,r,big){
  if(!usable())return;
  const key=manifest.fx&&manifest.fx.explosion;
  if(!readyImage(key))return;
  AIART.fx.push({x,y,r:r*(big?2.5:1.7),life:big?0.44:0.34,t:big?0.44:0.34,rot:rnd(Math.PI*2),vr:rnd(-1.4,1.4),big:!!big});
}
function updateFx(dt){
  for(let i=AIART.fx.length-1;i>=0;i--){
    const f=AIART.fx[i];
    f.life-=dt;
    f.rot+=f.vr*dt;
    if(f.life<=0)AIART.fx.splice(i,1);
  }
}
function drawFx(){
  if(!usable()||!AIART.fx.length)return;
  const key=manifest.fx&&manifest.fx.explosion;
  const im=readyImage(key);
  if(!im)return;
  ctx.save();
  ctx.imageSmoothingEnabled=true;
  ctx.globalCompositeOperation='lighter';
  for(const f of AIART.fx){
    const g=1-f.life/f.t;
    const sz=f.r*(0.75+g*1.05);
    ctx.save();
    ctx.translate(f.x,f.y);
    ctx.rotate(f.rot+g*0.35);
    ctx.globalAlpha=(1-g)*(f.big?0.82:0.66);
    ctx.drawImage(im,-sz/2,-sz/2,sz,sz);
    ctx.restore();
  }
  ctx.restore();
}

loadImages();

const _drawTerrainAI=drawTerrain;
drawTerrain=function(){
  _drawTerrainAI();
  drawGroundOverlay();
};
const _drawPlayerAI=drawPlayer;
drawPlayer=function(){
  if(!drawPlayerAI())_drawPlayerAI();
};
const _drawEnemyAI=drawEnemy;
drawEnemy=function(e){
  if(!drawEnemyAI(e))_drawEnemyAI(e);
};
const _drawWingmanAI=drawWingman;
drawWingman=function(){
  if(!drawWingmanAI())_drawWingmanAI();
};
const _drawHullPreviewAI=drawHullPreview;
drawHullPreview=function(k,x,y,w,h){
  if(!drawHullPreviewAI(k,x,y,w,h))_drawHullPreviewAI(k,x,y,w,h);
};
const _explodeAtAI=explodeAt;
explodeAt=function(x,y,r,dmg,big,cause,chainDepth){
  spawnExplosion(x,y,r,big);
  return _explodeAtAI.apply(this,arguments);
};
const _updPartsAI=updParts;
updParts=function(dt){
  _updPartsAI(dt);
  updateFx(dt);
};
const _drawPartsAI=drawParts;
drawParts=function(){
  _drawPartsAI();
  drawFx();
};

function stage1Showcase(hull,wing){
  if(!window.G)return 'G not ready';
  RUN.hull=hull||RUN.hull||'balanced';
  RUN.wing=wing||HULL_M2W[RUN.hull]||'flex';
  RUN.lvl=0;
  startLevel();
  MENU=null; ST.state='play'; ST.introT=0; ST.spawnT=1e9; ST.spawnedN=cfg.quota; ST.bossSpawned=true; ST.bossWarn=0;
  enemies.length=0; shots.length=0; bombs.length=0; planes.length=0; pickups.length=0; parts.length=0; floats.length=0; dynLights.length=0;
  clearDecals();
  player.x=420; player.y=285; player.ox=player.x; player.oy=player.y; player.a=-0.08; player.inv=0; player.shieldT=0.42; player.shieldAge=0;
  if(wingman){ wingman.x=player.x-56; wingman.y=player.y+40; wingman.ox=wingman.x; wingman.oy=wingman.y; wingman.a=-0.08; }
  spawnEnemyAt('tank',false,player.x+118,player.y-55);
  spawnEnemyAt('truck',false,player.x+132,player.y+64);
  spawnEnemyAt('tank',true,player.x+270,player.y+8);
  enemies[0].a=Math.PI; enemies[1].a=Math.PI+0.14; enemies[2].a=Math.PI;
  AIART.fx.length=0;
  spawnExplosion(player.x+74,player.y+54,22,true);
  cam.x=clamp(player.x-VW*0.45,0,WORLDW-VW); cam.y=clamp(player.y-VH*0.52,0,WORLDH-VH); cam.ox=cam.x; cam.oy=cam.y;
  return 'ai-art '+RUN.hull+'/'+RUN.wing+' assets:'+AIART.loaded+'/'+AIART.total;
}

function hookG(){
  if(!window.G){ requestAnimationFrame(hookG); return; }
  const oldVisual=G.visualScene&&G.visualScene.bind(G);
  G.visualScene=function(name){
    if(name==='ai-art'||name==='v14-ai'||name==='stage1-ai')return stage1Showcase('heavy','guard');
    return oldVisual?oldVisual(name):undefined;
  };
  G.aiart={
    info(){return {ok:AIART.ok,ready:AIART.ready,loaded:AIART.loaded,total:AIART.total,errors:AIART.errors.slice(),enabled:AIART.enabled,contactSheet:manifest.contactSheet};},
    enable(v){AIART.enabled=v!==false;return AIART.enabled;},
    stage(hull,wing){return stage1Showcase(hull,wing);},
    boom(){ if(player)spawnExplosion(player.x+58,player.y+22,22,true); return AIART.fx.length; },
  };
}
requestAnimationFrame(hookG);
})();
