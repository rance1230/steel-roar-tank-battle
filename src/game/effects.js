"use strict";
/* game/effects — 粒子/飘字/爆炸/Decal层 */
const partPool=[];

/* ---------- Decal 层 (视觉设计第一版 §7 L5): 弹坑/履带痕迹/油渍, 关卡内持久 ---------- */
const decalBuf=document.createElement('canvas'); decalBuf.width=WORLDW; decalBuf.height=WORLDH;
const dctx=decalBuf.getContext('2d');
function clearDecals(){ dctx.clearRect(0,0,WORLDW,WORLDH); }
function stampScorch(x,y,r){
  dctx.globalAlpha=0.46;
  const g=dctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,'rgba(2,4,7,0.9)'); g.addColorStop(0.55,'rgba(2,4,7,0.45)'); g.addColorStop(1,'rgba(2,4,7,0)');
  dctx.fillStyle=g; dctx.fillRect(x-r,y-r,r*2,r*2);
  dctx.globalAlpha=0.5;                                  /* 放射状碎屑飞痕 */
  for(let i=0;i<7;i++){ const a=rnd(Math.PI*2),d=rnd(r*0.7,r*1.5);
    dctx.fillStyle='rgba(2,4,7,0.6)'; dctx.fillRect(x+Math.cos(a)*d-1,y+Math.sin(a)*d-1,rnd(1,3),rnd(1,2)); }
  for(let i=0;i<5;i++){ const a=rnd(Math.PI*2),d=rnd(r*0.2,r*0.8);   /* 灰白余烬点提对比 */
    dctx.fillStyle='rgba(96,92,88,0.28)'; dctx.fillRect(x+Math.cos(a)*d,y+Math.sin(a)*d,1,1); }
  dctx.globalAlpha=1;
}
function stampTracks(x,y,ang,heavy){
  const c=Math.cos(ang),s=Math.sin(ang),ox=-s,oy=c,gap=heavy?4.5:3.5,L=heavy?5:4;
  dctx.save(); dctx.translate(x,y); dctx.rotate(ang);
  dctx.globalAlpha=heavy?0.13:0.1; dctx.fillStyle='#020407';
  dctx.fillRect(-L/2,oy*gap-(heavy?1.2:1),L,heavy?2.4:2);   /* 沿行进方向的履带压痕短划 */
  dctx.fillRect(-L/2,-oy*gap-(heavy?1.2:1),L,heavy?2.4:2);
  dctx.restore(); dctx.globalAlpha=1;
}

function part(x,y,vx,vy,life,col,size,grav,baseA){
  const p=partPool.pop()||{};
  p.x=x;p.y=y;p.vx=vx;p.vy=vy;p.life=life;p.t=life;p.col=col;p.size=size;p.grav=grav||0;p.a=baseA||1;
  p.ring=false;p.core=false;p.ray=false;p.pool=false;
  parts.push(p);
  const cap=PERF.maxParts();
  if(parts.length>cap)parts.splice(0,parts.length-cap);
  return p;
}
function burst(x,y,n,cols,sp,life){ n=Math.max(1,Math.round(n*PERF.mul()));
  for(let i=0;i<n;i++){const a=rnd(Math.PI*2),s=rnd(sp*0.3,sp);
  part(x,y,Math.cos(a)*s,Math.sin(a)*s,rnd(life*0.5,life),cols[(rnd(cols.length))|0],rnd(1,2.5)); } }

/* ---------- 环境漂浮微粒 (§8 环境粒子, 屏幕空间; v1.5 改读 THEMES.mote) ---------- */
let motes=[];
function initMotes(){
  motes.length=0;
  if(!cfg||cfg.rain)return;                        /* 雨图以雨丝为主, 不叠加微粒 */
  const d=themeCfg().mote||{c:'#b98a4a',n:12,v:6};
  for(let i=0;i<d.n;i++)motes.push({x:rnd(VW),y:rnd(VH),vx:rnd(-d.v,d.v),
    vy:d.up?rnd(-d.v*1.8,-d.v*0.5):rnd(-d.v,d.v),
    s:rnd(1,2),a:rnd(0.06,0.16),ph:rnd(6)});
}
function floater(x,y,txt,col,size,life){ const l=life||0.9; floats.push({x,y,t:l,tm:l,txt,col,size:size||7}); }
/* ---------- v1.6: 地形行进特效 (玩家/敌军共用) ----------
   按行进所在 tile 与关卡主题出粒子: 水面溅花+涟漪 / 减速区搅动 / 地面扬尘(沙·雪·灰随主题) */
function terrainMoveFx(x,y,ang,tid,sprint,heavy){
  const fx=themeCfg().fx, sc=(heavy?1.5:1)*(sprint?1.5:1);
  const bx=x-Math.cos(ang)*10, by=y-Math.sin(ang)*10;
  if(tid===3){                                   /* 水面/冰面/熔岩: 向后上溅花 + 扩散涟漪 */
    const n=Math.max(4,Math.round(4*sc*PERF.mul()));
    for(let i=0;i<n;i++)part(bx+rnd(-4,4),by+rnd(-4,4),
      rnd(-20,20)-Math.cos(ang)*24,rnd(-46,-14),rnd(0.28,0.5),i%3?fx.water:PAL.white,rnd(1.2,2.6)*sc,180);
    const r=part(bx,by,0,0,0.42,fx.water,7*sc,0); r.ring=true; r.a=0.45;
    if(sprint){ const c=part(bx,by,0,0,0.2,PAL.white,3.5,0); c.core=true; }
  } else if(tid===4){                            /* 减速区: 油污/能量/熔岩搅动 (亮色火花保证可见度) */
    const n=Math.max(2,Math.round(2*sc*PERF.mul()));
    for(let i=0;i<n;i++)part(bx+rnd(-5,5),by+rnd(-5,5),rnd(-10,10),rnd(-30,-12),rnd(0.4,0.8),
      i%2?fx.slow:PAL.white,rnd(1.4,3)*sc);
  } else {                                       /* 地面: 扬尘/雪沫, 冲刺拖尾烟团 */
    const n=Math.max(2,Math.round(2*sc*PERF.mul()));
    for(let i=0;i<n;i++)part(bx+rnd(-3,3),by+rnd(-3,3),
      rnd(-14,14)-Math.cos(ang)*16,rnd(-26,-8),rnd(0.3,0.6),i%4===0?PAL.smoke:fx.dust,rnd(1.2,2.4)*sc);
    if(sprint)part(bx,by,rnd(-8,8)-Math.cos(ang)*10,rnd(-18,-8),rnd(0.5,0.9),fx.dust,rnd(3,4.6),0,0.35);
  }
}
function addLight(x,y,r,col,a,life){
  if(typeof dynLights==='undefined'||!dynLights)return;
  const l={x,y,r:r||28,col:col||PAL.gold,a:a||0.35,life:life||0.18,t:life||0.18};
  dynLights.push(l);
  const cap=PERF.qLevel===0?10:26;
  if(dynLights.length>cap)dynLights.splice(0,dynLights.length-cap);
  return l;
}
function updDynamicLights(dt){
  if(typeof dynLights==='undefined'||!dynLights)return;
  for(let i=dynLights.length-1;i>=0;i--){ const l=dynLights[i];
    l.life-=dt; if(l.life<=0)dynLights.splice(i,1); }
}
function cameraKick(power,ang,zoom){
  if(!cam)return;
  power=power||1; ang=ang===undefined?rnd(Math.PI*2):ang+Math.PI;
  ST.shake=Math.min(12,ST.shake+power);
  cam.kickX=(cam.kickX||0)+Math.cos(ang)*power*0.45;
  cam.kickY=(cam.kickY||0)+Math.sin(ang)*power*0.45;
  cam.zoom=Math.min(0.075,(cam.zoom||0)+(zoom===undefined?power*0.003:zoom));
}
function updCameraFX(dt){
  if(!cam)return;
  const k=Math.max(0,1-dt*8.5), z=Math.max(0,1-dt*5.5);
  cam.kickX=(cam.kickX||0)*k; cam.kickY=(cam.kickY||0)*k; cam.zoom=(cam.zoom||0)*z;
  if(Math.abs(cam.kickX)<0.03)cam.kickX=0;
  if(Math.abs(cam.kickY)<0.03)cam.kickY=0;
  if(cam.zoom<0.001)cam.zoom=0;
}
function hitFx(x,y,kind,ang){
  const heavy=kind==='armor'||kind==='metal';
  const col=kind==='mg'?PAL.gold:(kind==='metal'?PAL.white:PAL.orange);
  addLight(x,y,heavy?22:14,col,heavy?0.24:0.16,heavy?0.12:0.08);
  const back=ang===undefined?rnd(Math.PI*2):ang+Math.PI;
  for(let i=0,n=Math.round((heavy?7:4)*PERF.mul());i<n;i++){
    const a=back+rnd(-0.72,0.72),s=rnd(42,heavy?105:72);
    const p=part(x,y,Math.cos(a)*s,Math.sin(a)*s,rnd(0.12,heavy?0.28:0.2),i%2?PAL.white:col,rnd(1,heavy?2.5:1.8),heavy?90:0);
    if(i<Math.max(1,n/2))p.ray=true;
  }
  if(heavy)part(x,y,0,0,0.055,PAL.white,5,0).core=true;
  SFX.hit(kind,x,y);
}
/* ---------- 七层爆炸 (视觉设计第一版 §10):
   1白闪 2火球 3冲击波 4火花 5碎片 6烟雾 7地面弹坑(decal) ---------- */
function explodeAt(x,y,r,dmg,big,cause,chainDepth){
  const q=PERF.mul(), R=big?1.7:1;
  addLight(x,y,r*(big?4.4:3.2),big?PAL.orange:PAL.gold,big?0.54:0.38,big?0.48:0.32);
  part(x,y,0,0,big?0.09:0.06,PAL.white,r*0.55*R,0).core=true;              /* 1 白闪 */
  for(let i=0,n=Math.round((big?7:4)*q);i<n;i++){ const a=rnd(Math.PI*2),d=rnd(r*0.35);
    part(x+Math.cos(a)*d,y+Math.sin(a)*d,rnd(-24,24),rnd(-24,24),rnd(0.16,0.3),i%2?PAL.orange:PAL.ember,rnd(r*0.26,r*0.42)*R).core=true; } /* 2 火球 */
  part(x,y,0,0,big?0.36:0.26,PAL.gold,r*(big?2.1:1.5)*R,0).ring=true;      /* 3 冲击波 */
  part(x,y,0,0,0.4,PAL.orange,r*1.8,0).pool=true;                          /* 地面光池 (审查C2) */
  for(let i=0,n=Math.round((big?16:9)*q);i<n;i++){ const a=rnd(Math.PI*2),s=rnd(90,(big?200:140));  /* 4 火花射线 */
    const p=part(x,y,Math.cos(a)*s,Math.sin(a)*s,rnd(0.15,0.32),i%3?PAL.gold:PAL.white,rnd(1.5,2.5)); p.ray=true; }
  for(let i=0,n=Math.round((big?9:5)*q);i<n;i++){ const a=rnd(Math.PI*2),s=rnd(40,big?130:90);      /* 5 碎片(受重力) */
    part(x,y,Math.cos(a)*s,Math.sin(a)*s-30,rnd(0.35,0.7),[PAL.steel,PAL.dark][(rnd(2))|0],rnd(1.5,3),220); }
  for(let i=0,n=Math.round((big?7:4)*q);i<n;i++)                                                    /* 6 烟雾(缓升久留, α0.4起) */
    part(x+rnd(-r*0.4,r*0.4),y+rnd(-r*0.4,r*0.4),rnd(-8,8),rnd(-26,-10),rnd(1.2,2.4),i%3?PAL.steel:PAL.smoke,rnd(2.5,(big?5:3.5)),0,0.4);
  for(let i=0,n=Math.round((big?5:3)*q);i<n;i++)                                                    /* 余烬闪烁 */
    part(x+rnd(-r*0.5,r*0.5),y+rnd(-r*0.5,r*0.5),rnd(-6,6),rnd(-20,-8),rnd(0.8,1.6),PAL.ember,rnd(1,1.8));
  stampScorch(x,y,r*(big?1.8:1.2));                                                        /* 7 弹坑 */
  cameraKick(big?7:3,rnd(Math.PI*2),big?0.038:0.014);
  if(big)SFX.bigboom(x,y);else SFX.boom(x,y);
  chainDepth=chainDepth||0;
  if(dmg>0&&chainDepth<=CHAIN_MAX){ const st=calcStats();   /* 连锁深度上限 */
    Grid.query(x,y,r+24,_gqBoom);
    for(const e of _gqBoom){ if(!e.dead&&dist2(x,y,e.x,e.y)<(r+e.r)*(r+e.r))
      applyDamage(e,dmg*st.atk,chainDepth>=1?'chainExplosion':(cause||'explosion'),{chainDepth}); } }
}


/* 白芯冲击闪光 (Breach炮口/撞击); big=true → 扩散冲击波+白芯+10根放射光线 */
function flashFx(x,y,r,big){
  addLight(x,y,r*(big?2.6:1.9),big?PAL.gold:PAL.white,big?0.34:0.24,big?0.16:0.08);
  if(big){
    const w1=part(x,y,0,0,0.2,PAL.white,r*1.7,0); w1.ring=true;
    const w2=part(x,y,0,0,0.14,PAL.gold,r*1.05,0); w2.ring=true;
    const c=part(x,y,0,0,0.15,PAL.white,r*0.95,0); c.core=true;
    for(let i=0;i<10;i++){ const an=i/10*Math.PI*2, off=r*0.95;   /* 光线从白芯边缘射出 */
      const p=part(x+Math.cos(an)*off,y+Math.sin(an)*off,Math.cos(an)*rnd(140,190),Math.sin(an)*rnd(140,190),rnd(0.2,0.26),i%2?PAL.white:PAL.gold,rnd(3.5,5),0);
      p.ray=true; }
    return;
  }
  const a=part(x,y,0,0,0.09,PAL.white,r,0); a.ring=true;
  const b=part(x,y,0,0,0.07,PAL.gold,r*0.62,0); b.ring=true;
  const c=part(x,y,0,0,0.07,PAL.white,r*0.4,0); c.core=true;
}
