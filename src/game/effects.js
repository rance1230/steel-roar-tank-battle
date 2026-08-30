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

/* ---------- 环境漂浮微粒 (视觉设计第一版 §8 环境粒子, 屏幕空间) ---------- */
let motes=[];
const MOTE_DEF={ dry:{c:()=>PAL.sand,n:16,v:6}, waste:{c:()=>PAL.ember,n:16,v:8},
  grass:{c:()=>PAL.lime,n:10,v:4}, swamp:{c:()=>PAL.aqua,n:12,v:5} };
function initMotes(){
  motes.length=0;
  if(!cfg||cfg.rain)return;                        /* 雨图以雨丝为主, 不叠加微粒 */
  const d=MOTE_DEF[cfg.ground]||MOTE_DEF.dry;
  for(let i=0;i<d.n;i++)motes.push({x:rnd(VW),y:rnd(VH),vx:rnd(-d.v,d.v),vy:cfg.ground==='waste'?rnd(-14,-4):rnd(-d.v,d.v),
    s:rnd(1,2),a:rnd(0.06,0.16),ph:rnd(6)});
}
function floater(x,y,txt,col,size,life){ const l=life||0.9; floats.push({x,y,t:l,tm:l,txt,col,size:size||7}); }
/* ---------- 七层爆炸 (视觉设计第一版 §10):
   1白闪 2火球 3冲击波 4火花 5碎片 6烟雾 7地面弹坑(decal) ---------- */
function explodeAt(x,y,r,dmg,big,cause,chainDepth){
  const q=PERF.mul(), R=big?1.7:1;
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
  ST.shake=Math.min(10,ST.shake+(big?7:3));
  if(big)SFX.bigboom();else SFX.boom();
  chainDepth=chainDepth||0;
  if(dmg>0&&chainDepth<=CHAIN_MAX){ const st=calcStats();   /* 连锁深度上限 */
    Grid.query(x,y,r+24,_gqBoom);
    for(const e of _gqBoom){ if(!e.dead&&dist2(x,y,e.x,e.y)<(r+e.r)*(r+e.r))
      applyDamage(e,dmg*st.atk,chainDepth>=1?'chainExplosion':(cause||'explosion'),{chainDepth}); } }
}


/* 白芯冲击闪光 (Breach炮口/撞击); big=true → 扩散冲击波+白芯+10根放射光线 */
function flashFx(x,y,r,big){
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
