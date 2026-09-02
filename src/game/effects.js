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
function stampTracks(x,y,ang,heavy,skid){
  const c=Math.cos(ang),s=Math.sin(ang),ox=-s,oy=c,gap=heavy?4.5:3.5,L=skid?6.5:(heavy?5:4),W=skid?3:(heavy?2.4:2);
  dctx.save(); dctx.translate(x,y); dctx.rotate(ang);
  dctx.globalAlpha=skid?0.16:(heavy?0.10:0.09); dctx.fillStyle='#020407';   /* v1.7.1: 冲刺印降一档; v1.8 W3: 甩尾印加浓拉长 */
  dctx.fillRect(-L/2,oy*gap-W/2,L,W);   /* 沿行进方向的履带压痕短划 */
  dctx.fillRect(-L/2,-oy*gap-W/2,L,W);
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
   v1.7 增强: 粒子量/尺寸/寿命上调, 涟漪双圈错峰, 减速区涡旋搅动, 冲刺速度线;
   河面语义随关卡分化: L3雨=水花 L5雪=冰晶 L7终战=熔岩 (tid3), 按 RUN.lvl 区分 */
let _rippleTgl=false;   /* 涟漪错峰: 相邻两次触发交替内圈/外圈, 避免高频叠加成涂抹 */
function terrainMoveFx(x,y,ang,tid,sprint,heavy){
  const fx=themeCfg().fx, sc=(heavy?1.6:1)*(sprint?1.6:1), m=PERF.mul();
  const bx=x-Math.cos(ang)*10, by=y-Math.sin(ang)*10;
  const cB=-Math.cos(ang), sB=-Math.sin(ang);   /* 车尾方向单位向量 */
  if(tid===3){                                   /* 水面/冰面/熔岩: 向后上溅花 + 双圈涟漪 */
    const lava=RUN.lvl===6, ice=RUN.lvl===4;
    if(ice){   /* 冰面: 碎晶向车体两侧崩飞 — v15 残影在HD层盖住车后像素层粒子, 侧溅需飞出残影带(高≈50px) */
      const n=Math.max(5,Math.round(5*sc*m));
      for(let i=0;i<n;i++){
        const side=(i%2?1:-1)*rnd(13,24), ox=-Math.sin(ang)*side, oy=Math.cos(ang)*side;
        const p=part(x+ox+rnd(-3,3),y+oy+rnd(-3,3),
          cB*rnd(6,20)+ox*rnd(1.2,2.2)+rnd(-9,9), sB*rnd(6,20)+oy*rnd(1.2,2.2)-rnd(6,20),
          rnd(0.32,0.6), i%3?fx.water:PAL.white, rnd(1.8,3.4)*sc, 150);
        if(i%6===0)p.core=true;                    /* 白芯圆: 1/6 */
        else if(i%6===3)p.ray=true;                /* 短亮线: 1/6 (core/ray 分离, else-if 链不吞) */
      }
    } else {
      const n=Math.max(5,Math.round(8*sc*m));
      for(let i=0;i<n;i++){
        const p=part(bx+rnd(-5,5),by+rnd(-5,5),
          cB*rnd(16,44)+rnd(-14,14), sB*rnd(16,44)+rnd(lava?-54:-80,lava?-26:-32),
          rnd(0.34,0.62), i%3?fx.water:PAL.white, rnd(1.8,3.8)*sc, lava?90:240);
        if(i%4===0)p.core=true;                    /* 亮芯水珠/岩浆滴 (抗瓦片噪点) */
      }
    }
    if(_rippleTgl=!_rippleTgl){ const r1=part(bx,by,0,0,0.6,lava?PAL.gold:PAL.white,10*sc,0); r1.ring=true; r1.a=0.8; r1.lw=3; }   /* 涟漪双圈: 错峰发射保圆环可读, 描边加实 */
    else { const r2=part(bx,by,0,0,0.42,fx.water,14*sc,0); r2.ring=true; r2.a=0.65; r2.lw=3; }
    if(sprint&&Math.random()<0.4){ const r3=part(bx,by,0,0,0.44,PAL.white,11*sc,0); r3.ring=true; r3.a=0.45;
      const c=part(bx,by,0,0,0.22,PAL.white,4*sc,0); c.core=true; }
    if(lava){ addLight(bx,by,17,PAL.ember,0.34,0.22);                      /* 岩浆橙光 */
      for(let i=0;i<3;i++){ const e=part(bx+rnd(-6,6),by+rnd(-6,6),rnd(-10,10),rnd(-52,-24),rnd(0.6,1.2),
        i%2?PAL.white:PAL.gold,rnd(1.4,2.4)*sc,-26); e.core=true; } }      /* 余烬白金芯 */
  } else if(tid===4){                            /* 减速区: 油污/能量/熔岩涡旋搅动 + 亮色火花(白/金保对比) */
    const n=Math.max(5,Math.round(5*sc*m));
    for(let i=0;i<n;i++){
      const a=rnd(Math.PI*2), rr=rnd(6,15);      /* 绕车尾切向速度 → 涡旋感 */
      const p=part(bx+Math.cos(a)*rr,by+Math.sin(a)*rr,
        -Math.sin(a)*rnd(30,70), Math.cos(a)*rnd(30,70)-rnd(12,36),
        rnd(0.5,1), [fx.slow,PAL.white,PAL.gold][i%3], rnd(1.6,3.4)*sc, -22);
      if(i%3===0)p.core=true;
    }
    const r0=part(bx,by,0,0,0.4,fx.slow,7*sc,0); r0.ring=true; r0.a=0.45;   /* 搅动光环 */
    if(sprint){ const r=part(bx,by,0,0,0.36,PAL.white,9*sc,0); r.ring=true; r.a=0.5; }
    addLight(bx,by,15,RUN.lvl===3?PAL.gold:fx.slow,0.3,0.22);
  } else {                                       /* 地面: 扬尘/雪沫/灰烬, 冲刺烟团+速度线 */
    const snow=RUN.lvl===4, ash=RUN.lvl===6;
    const n=Math.max(3,Math.round(4*sc*m));
    for(let i=0;i<n;i++){
      const p=part(bx+rnd(-4,4),by+rnd(-4,4),
        cB*rnd(14,34)+rnd(-16,16), sB*rnd(14,34)+(snow?rnd(-18,-6):rnd(-30,-10)),
        rnd(snow?0.5:0.4,snow?0.95:0.8), i%4===0?PAL.smoke:fx.dust,
        (snow?rnd(1.8,3.4):rnd(1.4,3))*sc, snow?36:0);
      if(snow&&i%4===1)p.core=true;              /* 雪沫白芯 */
      if(ash&&i%5===0){ p.col=PAL.ember; p.core=true; p.grav=-14; }   /* 灰烬火星 */
      if(RUN.lvl===0&&i%2===0)p.col='#d9a860';   /* 沙漠暖色高光 (真机审校: 提频保醒目) */
    }
    if(sprint){
      for(let i=0;i<2;i++)part(bx+rnd(-5,5),by+rnd(-5,5),cB*rnd(20,44)+rnd(-10,10),sB*rnd(20,44)-rnd(6,16),
        rnd(0.7,1.1),i?fx.dust:PAL.smoke,rnd(3.6,6)*sc,0,0.42);      /* 大烟团 ×2 */
      for(let i=0;i<2;i++){ const p=part(bx,by,cB*rnd(90,150),sB*rnd(90,150),0.16,fx.dust,rnd(1.6,2.4));
        p.ray=true; }                                                /* 冲刺速度线 */
      if(Math.random()<0.3)part(bx,by,cB*rnd(40,80)+rnd(-20,20),sB*rnd(40,80)-rnd(10,40),0.4,PAL.lite,rnd(1,1.8),260); /* 碎石 */
    }
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
/* ---------- v1.7: 震动分级 ----------
   原普通爆炸强度(kick 3)=最大档, 仅战斗单位击破触发; 命中按弹药分级:
   T0机枪命中 < T1主炮命中/冲撞 < T2导弹/空袭/受伤 < T3单位击破(封顶)。
   shakeHold: 击破瞬间暂停衰减(延长不增强), BOSS击破/玩家阵亡用。 */
const SHAKE_T=[
  {p:0.35,z:0},       /* T0 微 */
  {p:0.9, z:0.004},   /* T1 轻 */
  {p:1.8, z:0.009},   /* T2 中 */
  {p:3.0, z:0.014},   /* T3 最大 = 原爆炸档 */
];
function kickTier(t,ang){
  const d=SHAKE_T[clamp(t|0,0,3)];
  cameraKick(d.p,ang,d.z);
  return d.p;
}
function shakeHold(sec){ ST.shakeHold=Math.max(ST.shakeHold||0,sec); }
function updCameraFX(dt){
  if(!cam)return;
  if(ST.shakeHold>0)ST.shakeHold-=dt;            /* hold 期间震动不衰减 */
  else ST.shake=Math.max(0,ST.shake-dt*11);
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
function explodeAt(x,y,r,dmg,big,cause,chainDepth,kick){
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
  kickTier(kick===undefined?(big?3:1):kick,rnd(Math.PI*2));   /* v1.7: 震动按档位, 命中轻/击破重 */
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
