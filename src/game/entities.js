"use strict";
/* game/entities — 玩家/敌军/弹药/掉落与全部模拟 */

/* ---------- PHASE 2: 空间网格(敌军候选查询) ---------- */
const Grid={cell:64,m:new Map(),
  clear(){this.m.clear();},
  insert(e){const k=((e.x/this.cell)|0)+'_'+((e.y/this.cell)|0);
    let a=this.m.get(k); if(!a){a=[];this.m.set(k,a);} a.push(e);},
  query(x,y,r,out){out.length=0;const c=this.cell;
    const x0=Math.floor((x-r)/c),x1=Math.floor((x+r)/c),y0=Math.floor((y-r)/c),y1=Math.floor((y+r)/c);
    for(let gy=y0;gy<=y1;gy++)for(let gx=x0;gx<=x1;gx++){
      const a=this.m.get(gx+'_'+gy); if(a)for(let j=0;j<a.length;j++)out.push(a[j]); }
    return out;}};
const _gqSep=[],_gqShot=[],_gqBoom=[];


/* ---------- vNext PHASE 2: 连击系统 ----------
   5秒内持续命中/击破维持连击; 权重: 机枪+1 主炮/导弹+2 击破+3
   冲撞+4 BOSS+5 反弹+3; 每10连升级表现段位; 掉落率随段位提升。 */
const COMBO={n:0,t:0,tier:0,flash:0,od:false};
function comboMul(){ return COMBO.n>=40?1.5:COMBO.n>=30?1.35:COMBO.n>=20?1.2:COMBO.n>=10?1.1:1; }
function addCombo(v){
  if(v<=0)return;
  const before=COMBO.tier;
  COMBO.n+=v; COMBO.t=5; COMBO.flash=0.35;
  COMBO.tier=Math.min(6,Math.floor(COMBO.n/10));
  COMBO.od=COMBO.n>=60;
  if(COMBO.tier>before){
    floater(player.x,player.y-34,TF('comboUp',{n:COMBO.tier*10}),COMBO.tier>=4?PAL.red:PAL.gold,10);
    SFX.combo(COMBO.tier);
    if(COMBO.tier>=2)kickTier(1);   /* v1.7: 连击升段→轻档震动 */
    burst(player.x,player.y,12+COMBO.tier*4,[PAL.gold,PAL.white],80+COMBO.tier*15,0.4);
  }
}
function updCombo(dt){
  if(COMBO.t>0){ COMBO.t-=dt;
    if(COMBO.t<=0){ COMBO.n=0; COMBO.tier=0; COMBO.t=0; } }
  COMBO.od=COMBO.n>=60;   /* od 每帧由连击值派生, 避免状态不同步 */
  COMBO.flash=Math.max(0,COMBO.flash-dt);
}
let shotsFired=0;
/* v1.7: 冲刺残影 — 位置历史环(60Hz采样, 留~1s), 冲刺时恒显3条深色同形剪影;
   按距离回溯采样(不受河道减速影响), 空间间距恒定 ≈ 一车身长 */
function trailRec(p){ p.trail=p.trail||[]; p.trail.push({x:p.x,y:p.y,a:p.a}); if(p.trail.length>90)p.trail.shift(); }
function trailAtDist(p,distBack){
  const t=p.trail; if(!t||t.length<2)return null;
  let need=distBack;
  for(let i=t.length-1;i>0;i--){
    const dx=t[i].x-t[i-1].x, dy=t[i].y-t[i-1].y, d=Math.hypot(dx,dy);
    if(d>0&&need<=d){ const k=need/d;
      return {x:t[i].x+(t[i-1].x-t[i].x)*k, y:t[i].y+(t[i-1].y-t[i].y)*k, a:t[i].a}; }
    need-=d;
  }
  return t[0];
}

/* ---------- 玩家 ---------- */
function makePlayer(){
  const s=calcStats();
  return {x:WORLDW/2,y:WORLDH/2,ox:WORLDW/2,oy:WORLDH/2,a:-Math.PI/2,hp:s.maxHp,maxHp:s.maxHp,r:9,speed:s.speed,
    vx:0,vy:0,px:0,py:0,dist:0,moving:false,
    fireM:0,fireC:0,charge:0,charging:false,strikeCd:0,
    shieldT:0,shieldCd:0,shieldGrace:0,shieldAge:9,lastShieldWasActive:false,breach:null,shieldFlash:0,
    sprintG:1,sprintLock:false,inv:1.4,dustT:0,flash:0,ghostA:0,trail:[]};
}
function shieldActive(){ return player.shieldT>0||player.shieldGrace>0; }

/* ---------- 敌人 ---------- */
function diffMul(){ return DIFFS[SET.diff]; }
function cycHp(){ return 1+0.5*RUN.cycle; }
function cycDmg(){ return 1+0.25*RUN.cycle; }
function edgePoint(){
  for(let t=0;t<30;t++){
    let x,y; const s=(Math.random()*4)|0;
    if(s===0){x=rnd(30,WORLDW-30);y=24;}
    else if(s===1){x=rnd(30,WORLDW-30);y=WORLDH-24;}
    else if(s===2){x=24;y=rnd(30,WORLDH-30);}
    else {x=WORLDW-24;y=rnd(30,WORLDH-30);}
    if(dist2(x,y,player.x,player.y)>240*240&&!blockedAt(x,y,12))return {x,y};
  }
  return {x:24,y:24};
}
function spawnEnemyAt(kind,boss,x,y){
  const dm=diffMul(); const isTank=kind==='tank';
  const base={kind,boss:!!boss,x:x,y:y,ox:x,oy:y,a:0,
    stun:0,flash:0,ramCd:0,touchCd:0,dist:0,jitter:0,flying:null,
    mass:boss?'fortress':(isTank?'medium':'light')};
  if(isTank) enemies.push(Object.assign(base,{r:9,
    hp:26*cfg.hp*dm.hp*cycHp(),maxHp:26*cfg.hp*dm.hp*cycHp(),speed:44,
    prefMin:120,prefMax:200,range:250,fireT:rnd(1,2.4),fireCd:2.6/cfg.rate/dm.react,
    dmg:11*cfg.dmg*cycDmg(),orb:rnd()<0.5?1:-1,orbT:rnd(2,5)/dm.ai,
    spr:0.09/dm.acc,lead:0.6*dm.ai,strafe:0.7*dm.ai,smart:dm.ai,score:100}));
  else enemies.push(Object.assign(base,{r:8,
    hp:17*cfg.hp*dm.hp*cycHp(),maxHp:17*cfg.hp*dm.hp*cycHp(),speed:78,
    prefMin:80,prefMax:160,range:210,fireT:rnd(1,2),fireCd:2.0/cfg.rate/dm.react,burst:0,burstT:0,
    dmg:3*cfg.dmg*cycDmg(),orb:rnd()<0.5?1:-1,orbT:rnd(2,5)/dm.ai,
    spr:0.12/dm.acc,lead:0.35*dm.ai,strafe:0.7*dm.ai,smart:dm.ai,score:80}));

  Grid.clear(); for(const e of enemies)Grid.insert(e);
}
function spawnEnemy(){
  const isTank=Math.random()<cfg.tankR;
  const pt=edgePoint();
  spawnEnemyAt(isTank?'tank':'truck',false,pt.x,pt.y);
}
function spawnBoss(){
  /* 出生在镜头视野内的 HUD 安全区: 避开顶部状态条(~62px)/底部技能连击面板(~55px)/左右余量,
     候选含"玩家对侧"两点, 取离玩家最远且不卡地形者 —— 保证 BOSS 全身可见 */
  const mX=52,mTop=84,mBot=72;
  const sx0=cam.x+mX, sx1=cam.x+VW-mX, sy0=cam.y+mTop, sy1=cam.y+VH-mBot;
  let best=null,bs=-1;
  for(let i=0;i<14;i++){
    let x,y;
    if(i===0){ x=player.x<cam.x+VW/2?sx1:sx0; y=(sy0+sy1)/2; }
    else if(i===1){ x=(sx0+sx1)/2; y=player.y<cam.y+VH/2?sy1:sy0; }
    else { x=rnd(sx0,sx1); y=rnd(sy0,sy1); }
    x=clamp(x,sx0,sx1); y=clamp(y,sy0,sy1);
    if(blockedAt(x,y,20))continue;
    const sc=dist2(x,y,player.x,player.y);
    if(sc>bs){bs=sc;best={x,y};}
  }
  const p=best||{x:(sx0+sx1)/2,y:(sy0+sy1)/2},isTank=cfg.boss==='tank',dm=diffMul();
  enemies.push({kind:isTank?'tank':'truck',boss:true,x:p.x,y:p.y,ox:p.x,oy:p.y,a:0,mass:'fortress',jitter:0,flying:null,
    r:isTank?20:19,hp:cfg.bossHp*dm.hp*cycHp(),maxHp:cfg.bossHp*dm.hp*cycHp(),speed:isTank?62:95,
    prefMin:isTank?110:150,prefMax:isTank?220:260,range:300,
    fireT:1.2,fireCd:(isTank?1.3/cfg.rate:1.0/cfg.rate)/dm.react,burst:0,burstT:0,
    dmg:(isTank?14:4)*cfg.dmg*cycDmg(),orb:rnd()<0.5?1:-1,orbT:rnd(1.5,3),
    spr:(isTank?0.06:0.1)/dm.acc,lead:0.8*dm.ai,strafe:0.9*dm.ai,smart:dm.ai,
    stun:0,flash:0,ramCd:0,touchCd:0,dist:0,score:800});
  ST.bossSpawned=true; ST.bossWarn=-1;
  floater(player.x,player.y-30,T('bossWarn'),PAL.red,12);
  floater(player.x,player.y-44,T('bossSquad'),PAL.gold,9);   /* v1.6: 护卫队随行 */
  /* ---- v1.6: 精英战术护卫队随行围剿 (BOSS 不再单独登场) ----
     4 + min(周目,2) + (后期关卡+1) 个; 2/3 坦克 + 1/3 压制卡车, 环布 BOSS 周身 */
  const sqN=4+Math.min(2,RUN.cycle)+(RUN.lvl>=4?1:0);
  for(let i=0;i<sqN;i++){
    const kind=(i%3===2)?'truck':'tank';
    const an=(i/sqN)*Math.PI*2+rnd(0.5);
    const ex=clamp(p.x+Math.cos(an)*(isTank?88:74),28,WORLDW-28);
    const ey=clamp(p.y+Math.sin(an)*(isTank?88:74),28,WORLDH-28);
    spawnEnemyAt(kind,false,ex,ey);
    const s2=enemies[enemies.length-1];
    s2.escort=true; s2.angOff=an; s2.orbDir=rnd()<0.5?1:-1; s2.ph=rnd(6);
    s2.hp=s2.maxHp=Math.round(s2.maxHp*1.25);          /* 精英化 */
    s2.fireCd*=0.85; s2.speed*=1.08; s2.score=Math.round(s2.score*1.5);
    s2.a=Math.atan2(player.y-ey,player.x-ex);
  }
  kickTier(2); SFX.horn(); BGM.play('boss',true);   /* v1.7: BOSS登场→中档 */
}
function hurtEnemy(e,dmg,cause){ return applyDamage(e,dmg,cause); }  /* 兼容旧入口 */
function onEnemyDead(e,cause,ev){
  ev=ev||{chainDepth:0,id:0};
  addCombo(e.boss?5:1);
  STATS.kills++;
  explodeAt(e.x,e.y,e.boss?34:16,0,e.boss,cause,0,3);   /* v1.7: 击破=最大档震动(封顶) */
  if((cause==='breach'||cause==='knockback'||cause==='collision'||cause==='chainExplosion')&&ev.chainDepth<CHAIN_MAX){
    const stc=calcStats();
    STATS.chainBoom++;
    explodeAt(e.x,e.y,30,16*stc.atk,true,'chainExplosion',ev.chainDepth+1,2);
  }
  burst(e.x,e.y,e.boss?24:10,[PAL.steel,PAL.dark,PAL.lite],e.boss?120:70,0.6);
  RUN.score+=Math.round(e.score*rewardMul()); RUN.kills++; ST.killsLevel++;
  floater(e.x,e.y-24,'+'+Math.round(e.score*rewardMul()),e.boss?PAL.gold:PAL.lite,e.boss?12:8);
  if(e.boss){ shakeHold(0.35); floater(e.x,e.y-30,'BOSS DOWN!',PAL.gold,13); }   /* 震动延长不增强 */
  rollDrops(e,cause);
}
/* ---------- 掉落 ---------- */
const EQ_KEYS=['armor','track','fire','comp'];
function rollDrops(e,cause){
  const dm=diffMul(), bonus=(cause==='ram'||cause==='reflect');
  const mul=dm.drop*(bonus?3.2:1)*comboMul();
  const drop=(kind,extra)=>{ if(pickups.length>12)pickups.shift();
    pickups.push(Object.assign({x:e.x+rnd(-10,10),y:e.y+rnd(-10,10),t:16,bob:rnd(6),kind},extra||{})); SFX.drop(); };
  if(e.boss){
    const n=2+RUN.cycle+Math.round(dm.reward);
    for(let i=0;i<Math.min(n,7);i++)drop('part',{val:(bonus?2:1)});
    drop('eq',{eqk:EQ_KEYS[(rnd(4))|0]});
    if(rnd()<0.5)drop('heal');
    floater(e.x,e.y-40,T('itemPart')+' x'+n,PAL.gold,10);
    return;
  }
  if(Math.random()<0.16*mul)drop('heal');
  if(Math.random()<0.22*mul)drop('part',{val:(bonus&&Math.random()<0.5)?2:1});
  if(Math.random()<0.06*mul*(bonus?2:1)*(COMBO.n>=40?1.5:1))drop('eq',{eqk:EQ_KEYS[(rnd(4))|0]});
}
function pickupName(pk){
  if(pk.kind==='heal')return T('itemHeal');
  if(pk.kind==='part')return T('itemPart');
  return T('eqNames')[pk.eqk];
}

/* ---------- 弹药 ---------- */
const shotPool=[];
function releaseShot(i){ shotPool.push(shots[i]); shots.splice(i,1); }
function shot(x,y,ang,spd,dmg,friendly,kind,extra){
  const s=Object.assign(shotPool.pop()||{},{x,y,ox:x,oy:y,ang,spd,dmg,friendly,kind,cause:'shot',
    vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,
    r:kind==='mg'?1.6:kind==='missile'?3:2.5,
    life:kind==='missile'?3.5:1.5,refl:false,trailT:0},extra||{});
  shots.push(s); return s;
}
function fireMG(){ shotsFired++; const st=calcStats(); const a=player.a+rnd(-0.05,0.05);
  const mx=player.x+Math.cos(player.a)*15,my=player.y+Math.sin(player.a)*15;
  shot(mx,my,a,430,3*st.atk,true,'mg');
  part(mx,my,rnd(-15,15),rnd(-15,15),0.08,PAL.gold,2);
  part(mx,my,0,0,0.05,PAL.gold,3.2,0).core=true;     /* 枪口焰芯 */
  addLight(mx,my,12,PAL.gold,0.18,0.055);
  if(ST.t-mgSndT>0.055){ SFX.mg(mx,my); mgSndT=ST.t; } }
function fireCannon(){ const st=calcStats(); const a=player.a+rnd(-0.02,0.02);
  const mx=player.x+Math.cos(player.a)*17,my=player.y+Math.sin(player.a)*17;
  shot(mx,my,a,320,24*st.atk,true,'shell',{cause:'shot'});
  player.x-=Math.cos(a)*1.5;player.y-=Math.sin(a)*1.5;
  flashFx(mx,my,9);                                   /* 炮口火光 (§VFX) */
  addLight(mx,my,22,PAL.gold,0.28,0.11);
  cameraKick(0.5,a,0.0015);                           /* v1.7: 后坐力仅微踢, 不再震屏 */
  part(mx,my,Math.cos(a)*40,Math.sin(a)*40,0.09,PAL.gold,3); SFX.cannon(mx,my); }
function fireMissile(){
  const st=calcStats(), h=hullCfg();
  /* §18 突击型三枚分锁: ≥3敌 各锁其一; 单体时按 100/65/50 衰减 */
  const alive=enemies.filter(e=>!e.dead).sort((a,b)=>dist2(player.x,player.y,a.x,a.y)-dist2(player.x,player.y,b.x,b.y));
  const fall=[1,0.65,0.5];
  for(let i=0;i<h.mslN;i++){
    const mx=player.x+Math.cos(player.a)*15,my=player.y+Math.sin(player.a)*15;
    const dmg=46*st.atk*(alive.length===1?fall[i]:1);
    const tgt=alive.length>0?alive[i%Math.max(1,Math.min(alive.length,3))]:null;
    const s=shot(mx,my,player.a+rnd(-0.15,0.15),200,dmg,true,'missile',{accel:520});
    if(tgt)s.lock=tgt;
    part(mx,my,0,0,0.08,PAL.white,4,0).core=true;       /* 发射烟闪 */
    addLight(mx,my,18,PAL.white,0.24,0.1);
  }
  cameraKick(0.45,player.a,0.0015);   /* v1.7: 发射微踢 */
  SFX.missile(player.x,player.y);
}
function callAirstrike(){
  let tx=player.x,ty=player.y,n=0;
  for(const e of enemies){tx+=e.x;ty+=e.y;n++;}
  if(n>0){tx/=n;ty/=n;}
  const fromLeft=rnd()<0.5;
  planes.push({ox:fromLeft?-40:WORLDW+40,oy:clamp(ty+rnd(-30,30),40,WORLDH-40),x:fromLeft?-40:WORLDW+40,y:clamp(ty+rnd(-30,30),40,WORLDH-40),dir:fromLeft?1:-1,dropT:0.1,drops:7});
  SFX.strike(player.x,player.y); floater(player.x,player.y-26,T('strikeMsg'),PAL.gold,9);
}

/* ============================================================
   更新逻辑
   ============================================================ */
function updPlayer(dt){
  const p=player;
  p.ox=p.x; p.oy=p.y;   /* 插值快照 */
  /* ---- Breach 锁定: 顶住目标, 按主炮零距离炮击 ---- */
  if(p.breach){
    const be=p.breach.e;
    if(be.dead||p.breach.t<=0){ if(!be.dead)be.stun=Math.max(be.stun,0.2); p.breach=null; }
    else{
      p.breach.t-=dt;
      const dx=p.x-be.x,dy=p.y-be.y,l=Math.hypot(dx,dy)||1;
      const hold=be.r+p.r-4;
      p.x=be.x+dx/l*hold; p.y=be.y+dy/l*hold;
      p.vx=0; p.vy=0; p.a=Math.atan2(-dy,-dx);
      be.stun=Math.max(be.stun,0.15); be.jitter=0.08;
      if(Math.random()<0.9)part(be.x-dx/l*be.r,be.y-dy/l*be.r,rnd(-55,55),rnd(-55,55),0.22,Math.random()<0.5?PAL.white:PAL.gold,2.4);
      if(IN.cannon()){ const tgt=be,stag=p.breach.stagger; p.breach=null; breachFire(tgt,stag); }
      else if(p.breach){
        p.inv=Math.max(0,p.inv-dt); p.flash=Math.max(0,p.flash-dt);
        p.shieldT=Math.max(0,p.shieldT-dt); p.shieldCd=Math.max(0,p.shieldCd-dt); p.shieldAge+=dt;
        p.strikeCd=Math.max(0,p.strikeCd-dt);
        p.ghostA=Math.max(0,(p.ghostA||0)-dt*4);   /* v1.7: 锁定期间残影淡出 */
        return;   /* 锁定期间只等待主炮指令 */
      }
    }
  }
  /* ---- vNext PHASE 1: 360° 速度向量移动 ----
     输入向量(键盘叠加或手柄模拟轴) → 目标速度, 加速/摩擦推进,
     车体朝向以10rad/s平滑跟随速度方向。 */
  let ix=(IN.right()?1:0)-(IN.left()?1:0), iy=(IN.down()?1:0)-(IN.up()?1:0);
  let im=Math.hypot(ix,iy);
  const am=Math.hypot(PAD.ax,PAD.ay);
  if(am>0.01){ ix=PAD.ax; iy=PAD.ay; im=Math.min(1,am); if(am>1){ix/=am;iy/=am;} }
  else if(im>0){ ix/=im; iy/=im; im=1; }
  const tid0=tileAtPx(p.x,p.y);
  const mul=slowMul(tid0);
  let sprint=false;
  if(IN.sprint()&&!p.sprintLock&&p.sprintG>0){ sprint=true; p.sprintG-=dt/2.6; if(p.sprintG<=0){p.sprintG=0;p.sprintLock=true;} }
  else { p.sprintG=Math.min(1,p.sprintG+dt/3); if(p.sprintLock&&p.sprintG>0.45)p.sprintLock=false; }
  const maxSpd=p.speed*mul*(sprint?1.9*hullCfg().sprint:1)*(COMBO.od?1.1:1);
  const ACCEL=maxSpd/0.16*hullCfg().accel, FRICT=maxSpd/0.2;
  const tvx=ix*maxSpd, tvy=iy*maxSpd;
  const dv=(im>0.01?ACCEL:FRICT)*dt;
  p.vx+=clamp(tvx-p.vx,-dv,dv);
  p.vy+=clamp(tvy-p.vy,-dv,dv);
  const spd=Math.hypot(p.vx,p.vy);
  p.moving=spd>15;
  moveCirc(p,p.vx*dt,p.vy*dt,p.r);
  if(spd>1)p.dist+=spd*dt;
  if(p.moving){ const ta=Math.atan2(p.vy,p.vx);
    p.a+=clamp(angDiff(p.a,ta),-10*dt,10*dt); }
  p.inv=Math.max(0,p.inv-dt); p.flash=Math.max(0,p.flash-dt);
  p.shieldT=Math.max(0,p.shieldT-dt); p.shieldCd=Math.max(0,p.shieldCd-dt);
  p.shieldAge+=dt;
  p.shieldGrace=Math.max(0,p.shieldGrace-dt);
  if(p.shieldFlash>1)p.shieldFlash=Math.max(1,p.shieldFlash);   /* >1=摆拍冻结 */ 
  else p.shieldFlash=Math.max(0,p.shieldFlash-dt);
  if(p.shieldT===0&&p.shieldGrace===0&&p.lastShieldWasActive){p.shieldGrace=0.18;p.lastShieldWasActive=false;}
  if(p.shieldT>0)p.lastShieldWasActive=true;
  p.strikeCd=Math.max(0,p.strikeCd-dt);
  p.fireM-=dt; p.fireC-=dt;
  if(p.maxHp!==calcStats().maxHp){ const ns=calcStats(); p.hp=Math.min(p.hp+Math.max(0,ns.maxHp-p.maxHp),ns.maxHp); p.maxHp=ns.maxHp; }
  if(IN.mg()&&p.fireM<=0){ p.fireM=0.085*(COMBO.od?0.87:1)/hullCfg().mgDps; fireMG(); }
  if(IN.cannon()&&p.fireC<=0){ p.fireC=0.55*(COMBO.od?0.9:1); fireCannon(); }
  if(IN.msl()){ p.charging=true; p.charge=Math.min(1.2,p.charge+dt); }
  else if(p.charging){ if(p.charge>=0.45*hullCfg().mslCd)fireMissile(); p.charging=false; p.charge=0; }
  if(PAD.just.strike&&p.strikeCd<=0){ p.strikeCd=5; callAirstrike(); }
  if(PAD.just.shield&&p.shieldCd<=0){ const sc=hullCfg().shield; p.shieldT=sc.dur; p.shieldCd=sc.cd; p.shieldAge=0; SFX.shield(p.x,p.y); }
  const tid=tileAtPx(p.x,p.y);
  p.dustT-=dt;
  if(p.moving&&p.dustT<=0){
    p.dustT=sprint?0.03:0.09;
    stampTracks(p.x-Math.cos(p.a)*10,p.y-Math.sin(p.a)*10,p.a,sprint);   /* §7 履带痕迹 decal */
    terrainMoveFx(p.x,p.y,p.a,tid,sprint,false);   /* v1.6: 主题行进特效(扬尘/水花/雪沫) */
  }
  /* v1.7: 冲刺残影 — 冲刺中恒显3条深色剪影(见 v15art/render), 松开 0.25s 淡出 */
  if(sprint&&p.moving)p.ghostA=Math.min(1,p.ghostA+dt*8);
  else p.ghostA=Math.max(0,p.ghostA-dt*4);
  if(sprint&&p.moving&&Math.random()<0.5)part(p.x-Math.cos(p.a)*12,p.y-Math.sin(p.a)*12,-Math.cos(p.a)*30+rnd(-10,10),-Math.sin(p.a)*30+rnd(-10,10),0.25,PAL.gold,2);
  if(COMBO.od&&p.moving&&Math.random()<0.7)part(p.x-Math.cos(p.a)*11,p.y-Math.sin(p.a)*11,-Math.cos(p.a)*45+rnd(-12,12),-Math.sin(p.a)*45+rnd(-12,12),0.3,PAL.gold,rnd(1.5,2.5));
  trailRec(p);   /* v1.7: 残影位置历史 */
}

/* 接触/Breach 判定(对被晕单位同样生效) */
function tryContact(e){
  const pl=player;
  if(dist2(e.x,e.y,pl.x,pl.y)<(e.r+pl.r+3)*(e.r+pl.r+3)){
    if(e.ramCd<=0){
      e.ramCd=0.55;
      const sp2=Math.hypot(pl.vx,pl.vy);
      const nx2=pl.x-e.x,ny2=pl.y-e.y,nl=Math.hypot(nx2,ny2)||1;
      const facing=Math.abs(angDiff(pl.a,Math.atan2(-ny2,-nx2)))<Math.PI/3;
      if(sp2>120&&facing&&!pl.breach&&!e.flying){ enterBreach(e); }
      else if(sp2>40){
        const crit=Math.random()<0.6;
        const st=calcStats();
        const dmg=(crit?40:20)*st.atk;
        applyDamage(e,dmg,'ram');
        floater(e.x,e.y-16,(crit?'CRIT ':'')+Math.round(dmg),crit?PAL.gold:PAL.white,crit?11:8);
        const kb=e.boss?4:26;
        e.x+=nx2/nl*kb; e.y+=ny2/nl*kb;
        pl.x-=nx2/nl*(e.boss?10:6); pl.y-=ny2/nl*(e.boss?10:6);
        burst((e.x+pl.x)/2,(e.y+pl.y)/2,crit?16:8,[PAL.gold,PAL.white,PAL.lite],crit?110:70,0.4);
        if(crit)RUN.score+=25;
        SFX.ram((e.x+pl.x)/2,(e.y+pl.y)/2);
        kickTier(crit?2:1,Math.atan2(e.y-pl.y,e.x-pl.x));   /* v1.7: 冲撞分级 */
      } else if(e.touchCd<=0&&pl.inv<=0){
        e.touchCd=1.2; damagePlayer(6,Math.atan2(ny2,nx2),true);
      }
    }
  }
}

function d2p(e){ return Math.hypot(player.x-e.x,player.y-e.y); }
function updEnemies(dt){
  const aliveReg=enemies.filter(e=>!e.boss).length;
  if(ST.spawnedN<cfg.quota-1){
    ST.spawnT-=dt;
    if(ST.spawnT<=0&&aliveReg<cfg.conc+Math.min(2,Math.floor(RUN.cycle/2))){ spawnEnemy(); ST.spawnedN++;
      ST.spawnT=Math.max(1.0,2.4-0.12*RUN.lvl); } }
  if(!ST.bossSpawned&&ST.bossWarn===0&&ST.spawnedN>=cfg.quota-1&&enemies.length===0){
    ST.bossWarn=1.6; SFX.horn(); BGM.play('bossintro',false); }
  if(ST.bossWarn>0){ ST.bossWarn-=dt; if(ST.bossWarn<=0)spawnBoss(); }

  Grid.clear(); for(const e of enemies)Grid.insert(e);   /* 移动前网格(分离用) */
  for(const e of enemies){
    e.ox=e.x; e.oy=e.y;   /* 插值快照 */
    e.flash=Math.max(0,e.flash-dt); e.ramCd=Math.max(0,e.ramCd-dt); e.touchCd=Math.max(0,e.touchCd-dt);
    e.jitter=Math.max(0,(e.jitter||0)-dt);
    /* ---- 被击飞: 直线飞行/敌敌碰撞/撞墙终止 ---- */
    if(e.flying){
      const f=e.flying;
      e.a+=11*dt;
      const nx=e.x+f.vx*dt, ny=e.y+f.vy*dt;
      if(blockedAt(nx,ny,e.r)){ applyDamage(e,8,'knockback'); endFlight(e); }
      else { e.x=nx; e.y=ny; }
      if(Math.random()<0.7)part(e.x,e.y,rnd(-20,20),rnd(-20,20),0.3,PAL.dark,rnd(1,2.5));
      if(e.flying){
        Grid.query(e.x,e.y,e.r+26,_gqShot);
        for(const o of _gqShot){
          if(o===e||o.dead)continue;
          if(dist2(e.x,e.y,o.x,o.y)<(e.r+o.r+2)*(e.r+o.r+2)){
            const stc=calcStats();
            applyDamage(o,16*stc.atk,'collision');
            applyDamage(e,12,'knockback');
            STATS.knockHits++;
            const mx2=(e.x+o.x)/2,my2=(e.y+o.y)/2;
            flashFx(mx2,my2,18);                                   /* 撞击白闪+分离位移 */
            burst(mx2,my2,12,[PAL.white,PAL.gold],100,0.45);
            const sdx=(o.x-e.x),sdy=(o.y-e.y),sl=Math.hypot(sdx,sdy)||1;
            o.x+=sdx/sl*12; o.y+=sdy/sl*12; o.ox=o.x; o.oy=o.y;
            e.x-=sdx/sl*8; e.y-=sdy/sl*8;
            SFX.ram(mx2,my2); kickTier(1,Math.atan2(o.y-e.y,o.x-e.x));   /* v1.7: 连撞→轻档 */
            endFlight(e);
            break;
          } }
      }
      if(e.flying){ f.t-=dt; if(f.t<=0)endFlight(e); }
      continue;
    }
    tryContact(e);                    /* 接触/Breach(对被晕单位同样生效) */
    if(e.stun>0){e.stun-=dt; if(e.boss&&e.chgPhase){e.chgPhase=null;e.chg=rnd(4,6);}continue;}
    /* ---- BOSS 蓄力冲锋(坦克型): 周期性 0.7s 预警 → 3.2x 速冲刺 0.9s ---- */
    let bossDash=false,bossHold=false;
    if(e.boss&&e.kind==='tank'){
      if(e.chgPhase==='wind'){
        bossHold=true; e.windT-=dt; e.jitter=0.1;
        if(e.windT<=0){ e.chgPhase='dash'; e.dashT=0.9;
          const a2=Math.atan2(player.y-e.y,player.x-e.x); e.a=a2;
          e.dashVx=Math.cos(a2)*e.speed*3.2; e.dashVy=Math.sin(a2)*e.speed*3.2;
          SFX.horn(); kickTier(0); }   /* v1.7: 起跑微震 */
      } else if(e.chgPhase==='dash'){
        bossDash=true; e.dashT-=dt;
        const nx=e.x+e.dashVx*dt, ny=e.y+e.dashVy*dt;
        if(!blockedAt(nx,ny,e.r)){ e.x=nx; e.y=ny; e.dist+=e.speed*3.2*dt; }
        else e.dashT=0;
        if(Math.random()<0.6)part(e.x,e.y,rnd(-24,24),rnd(-24,24),0.35,PAL.dark,rnd(2,4));
        tryContact(e);
        if(e.dashT<=0){ e.chgPhase=null; e.chg=rnd(5,8); kickTier(1); }
      } else {
        e.chg=(e.chg===undefined?rnd(3,5):e.chg)-dt;
        if(e.chg<=0&&d2p(e)<420&&d2p(e)>150){ e.chgPhase='wind'; e.windT=0.7;
          floater(e.x,e.y-30,'!!',PAL.red,13); }
      }
    }
    e.orbT-=dt; if(e.orbT<=0){e.orb*=-1;e.orbT=rnd(2,5)/diffMul().ai;}
    const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy)||1,nx=dx/d,ny=dy/d;
    /* 预判瞄准(难度越高预判越强) */
    const sp=e.kind==='truck'?260:160, tta=d/sp;
    const ax=player.x+player.vx*tta*e.lead, ay=player.y+player.vy*tta*e.lead;
    const ta=Math.atan2(ay-e.y,ax-e.x);
    e.a+=clamp(angDiff(e.a,ta),-3*dt,3*dt);
    let mx=0,my=0;
    let wantFar=d>e.prefMax, wantNear=d<e.prefMin;
    if(e.smart>1.05&&e.hp<e.maxHp*0.25){ wantFar=true; wantNear=false; } /* 高难度残血后撤 */
    if(wantFar){mx=nx;my=ny;} else if(wantNear){mx=-nx;my=-ny;} else {mx=-ny*e.orb*e.strafe;my=nx*e.orb*e.strafe;}
    if(e.escort){   /* v1.6 护卫围剿: 各占玩家环形阵位缓慢旋转移位; Boss蓄力时收口袋, Boss亡则溃散 */
      const bo=enemies.find(b=>b.boss&&!b.dead);
      if(bo){
        e.angOff+=dt*0.3*(e.orbDir||1);
        const R=(bo.chgPhase==='wind'?86:136)+Math.sin(ST.t*0.7+(e.ph||0))*14;
        const gx=player.x+Math.cos(e.angOff)*R-e.x, gy=player.y+Math.sin(e.angOff)*R-e.y;
        const gl=Math.hypot(gx,gy)||1;
        mx=gx/gl; my=gy/gl;
      } else e.escort=false;
    }
    Grid.query(e.x,e.y,e.r+18,_gqSep);
    for(const o of _gqSep){ if(o===e)continue;
      const ddx=e.x-o.x,ddy=e.y-o.y,dd=Math.hypot(ddx,ddy);
      if(dd>0&&dd<e.r+o.r+10){mx+=ddx/dd*0.8;my+=ddy/dd*0.8;} }
    const ml=Math.hypot(mx,my)||1;
    const spd=e.speed*slowMul(tileAtPx(e.x,e.y));
    moveCirc(e,mx/ml*spd*dt,my/ml*spd*dt,e.r);
    e.dist+=spd*dt;
    if(Math.random()<0.15){ const tid=tileAtPx(e.x,e.y);
      if(Math.random()<0.8)stampTracks(e.x,e.y,e.a,e.boss);   /* §7 敌军履带/轮迹 */
      terrainMoveFx(e.x,e.y,e.a,tid,false,e.boss);            /* v1.6: 主题行进特效 */ }
    e.fireT-=dt;
    const facing=Math.abs(angDiff(e.a,ta))<0.7;
    if(!bossDash&&!bossHold&&d<e.range&&facing){
      if(e.kind==='tank'){
        if(e.fireT<=0){ e.fireT=e.fireCd*rnd(0.85,1.2);
          flashFx(e.x+Math.cos(ta)*(e.r+4),e.y+Math.sin(ta)*(e.r+4),e.boss?11:6);   /* 敌炮口火光 */
          if(e.boss){ for(const off of[-0.22,0,0.22]){
              const aa=ta+off+rnd(-1,1)*e.spr;
              shot(e.x+Math.cos(aa)*e.r,e.y+Math.sin(aa)*e.r,aa,165,e.dmg,false,'shell'); }
            SFX.enemyCannon(e.x,e.y,true);
          } else { const aa=ta+rnd(-1,1)*e.spr;
            shot(e.x+Math.cos(aa)*e.r,e.y+Math.sin(aa)*e.r,aa,150,e.dmg,false,'shell');
            SFX.enemyCannon(e.x,e.y,false); }
        }
      } else {
        if(e.burst>0){ e.burstT-=dt;
          if(e.burstT<=0){ e.burstT=0.09; e.burst--;
            const aa=ta+rnd(-1,1)*e.spr;
            shot(e.x+Math.cos(aa)*e.r,e.y+Math.sin(aa)*e.r,aa,260,e.dmg,false,'mg');
            const mx=e.x+Math.cos(aa)*(e.r+2),my=e.y+Math.sin(aa)*(e.r+2);
            part(mx,my,0,0,0.05,PAL.gold,2.4,0).core=true;
            addLight(mx,my,10,PAL.orange,0.13,0.05);
            SFX.enemyMG(mx,my); } }
        else if(e.fireT<=0){ e.fireT=e.fireCd*rnd(0.85,1.2);
          e.burst=e.boss?12:5; e.burstT=0; }
      }
    }
  }
  enemies=enemies.filter(e=>!e.dead);
  Grid.clear(); for(const e of enemies)Grid.insert(e);   /* 移动后网格 */
  if(ST.state==='play'&&ST.bossSpawned&&enemies.length===0&&!DBG.lab){ levelClear(); }
}
function damagePlayer(dmg,ang,noShield){
  if(player.inv>0||DBG.god)return;
  const h=hullCfg(), sc=h.shield;
  /* §19 要塞盾: 冲撞/地雷/AOE/Boss近战(noShield类)不能完全免疫, 持盾期间减伤60% */
  if(noShield&&shieldActive()&&sc.fortress&&player.shieldAge>sc.perfect)dmg*=0.4;
  if(!noShield&&shieldActive()){
    player.shieldFlash=0.12;   /* v1.7: 护罩弹反白闪 */
    floater(player.x,player.y-22,T('parry'),PAL.lite,9); SFX.reflect(player.x,player.y,false); return;
  }
  const st=calcStats();
  player.hp-=dmg*(1-st.def)*h.taken; player.flash=0.25; SFX.hurt(player.x,player.y);
  addLight(player.x,player.y,26,PAL.red,0.16,0.18);
  kickTier(2,ang);            /* v1.7: 受伤→中档 */
  burst(player.x,player.y,6,[PAL.red,PAL.white],60,0.3);
  if(player.hp<=0){ player.hp=0; playerDie(); }
}
function playerDie(){
  explodeAt(player.x,player.y,40,0,true,'shot',0,3);   /* v1.7: 最大档+延长 */
  shakeHold(0.35);
  burst(player.x,player.y,30,[PAL.steel,PAL.dark,PAL.red,PAL.gold],140,0.9);
  ST.state='over'; ST.overT=0;
  BGM.play('lose',false);
}
function updShots(dt){
  for(let i=shots.length-1;i>=0;i--){
    const s=shots[i];
    s.ox=s.x; s.oy=s.y;   /* PHASE 2: 插值快照 */
    if(s.kind==='missile'&&s.friendly){
      /* §18: 优先追踪分锁目标, 目标死亡则回退最近敌 */
      let best=(s.lock&&!s.lock.dead)?s.lock:null;
      if(!best){ let bd=1e9;
        for(const e of enemies){const d=dist2(s.x,s.y,e.x,e.y);if(d<bd){bd=d;best=e;}} }
      if(best){ const want=Math.atan2(best.y-s.y,best.x-s.x);
        s.ang+=clamp(angDiff(s.ang,want),-4.5*dt,4.5*dt); }
      s.spd=Math.min(400,s.spd+(s.accel||500)*dt);
      s.vx=Math.cos(s.ang)*s.spd; s.vy=Math.sin(s.ang)*s.spd;
      s.trailT-=dt; if(s.trailT<=0){s.trailT=0.02;part(s.x,s.y,rnd(-12,12),rnd(-12,12),0.3,Math.random()<0.5?PAL.gold:PAL.white,2);}
    }
    s.x+=s.vx*dt; s.y+=s.vy*dt; s.life-=dt;
    let dead=false;
    if(s.life<=0||s.x<0||s.y<0||s.x>WORLDW||s.y>WORLDH)dead=true;
    else if(tileAtPx(s.x,s.y)===5){ dead=true;
      if(s.kind==='mg'){ hitFx(s.x,s.y,'metal',s.ang); kickTier(0); }
      else explodeAt(s.x,s.y,s.kind==='missile'?30:16,s.friendly?s.dmg:0,false,s.cause,0,s.kind==='missile'?2:1); }
    if(!dead){
      if(s.friendly){
        Grid.query(s.x,s.y,s.r+22,_gqShot);
        for(const e of _gqShot){
          if(!e.dead&&dist2(s.x,s.y,e.x,e.y)<(e.r+s.r)*(e.r+s.r)){
            if(s.kind==='mg'){ applyDamage(e,s.dmg,'machinegun'); hitFx(s.x,s.y,'mg',s.ang); burst(s.x,s.y,3,[PAL.gold,PAL.white],50,0.2); kickTier(0); }
            else if(s.kind==='shell'){ hitFx(s.x,s.y,'armor',s.ang); explodeAt(s.x,s.y,18*hullCfg().blast,s.dmg,false,'cannon',0,1); }
            else { hitFx(s.x,s.y,s.refl?'metal':'armor',s.ang); explodeAt(s.x,s.y,30,s.dmg,false,s.refl?'reflect':'missile',0,2); }
            dead=true; break;
          } }
      } else {
        if(dist2(s.x,s.y,player.x,player.y)<(player.r+s.r+2)*(player.r+s.r+2)){
          if(shieldActive()){
            const sc=hullCfg().shield;
            const perfect=(player.shieldAge<=sc.perfect);
            let best=null,bd=1e9;
            for(const e of enemies){const d=dist2(s.x,s.y,e.x,e.y);if(d<bd){bd=d;best=e;}}
            const na=best?Math.atan2(best.y-s.y,best.x-s.x):s.ang+Math.PI;
            s.friendly=true; s.refl=true; s.para=perfect; s.ang=na;
            if(sc.fortress&&!perfect){   /* §19 要塞盾: 持续期反弹伤害 75% */
              s.spd*=1.6; s.dmg*=0.75; s.cause='reflect';
            } else {
              s.spd*=perfect?2.1:1.7; s.dmg*=perfect?2.5:2; s.cause='reflect';
            }
            s.vx=Math.cos(na)*s.spd; s.vy=Math.sin(na)*s.spd; s.life=1.6;
            RUN.score+=30;
            player.shieldFlash=0.12;   /* v1.7: 弹反护罩白闪 */
            parryFeedback(perfect,s);
          } else if(player.inv<=0){
            hitFx(s.x,s.y,'armor',s.ang);
            damagePlayer(s.dmg,s.ang);
            if(s.kind!=='mg')explodeAt(s.x,s.y,12,0,false,null,0,1);
            dead=true;
          }
        }
        /* 僚机承伤: 敌弹撞僚机 */
        else if(wingman&&wingman.downT<=0&&dist2(s.x,s.y,wingman.x,wingman.y)<(wingman.r+s.r)*(wingman.r+s.r)){
          wingman.hp-=s.dmg*0.6; hitFx(s.x,s.y,'armor',s.ang); burst(s.x,s.y,4,[PAL.gold,PAL.white],60,0.25);
          if(wingman.hp<=0){ wingmanDown(); }
          dead=true;
        }
      }
    }
    if(dead)releaseShot(i);
  }
}
function updPlanes(dt){
  for(let i=planes.length-1;i>=0;i--){ const pl=planes[i];
    pl.ox=pl.x; pl.oy=pl.y;
    pl.x+=pl.dir*270*dt; pl.dropT-=dt;
    if(pl.dropT<=0&&pl.drops>0){ pl.drops--; pl.dropT=0.15;
      const bx=pl.x+rnd(-8,8),by=pl.y+rnd(-2,10);
      bombs.push({x:bx,y:by,ox:pl.x,oy:pl.y,t:0.34}); SFX.airDrop(bx,by); }
    if(pl.x<-60||pl.x>WORLDW+60)planes.splice(i,1);
  }
  for(let i=bombs.length-1;i>=0;i--){ const b=bombs[i]; b.ox=b.x; b.oy=b.y; b.t-=dt;
    if(b.t<=0){ explodeAt(b.x,b.y,30,34,false,'shot',0,2); bombs.splice(i,1); } }   /* v1.7: 空袭→中档 */
}
function updPickups(dt){
  for(let i=pickups.length-1;i>=0;i--){ const pk=pickups[i];
    pk.t-=dt; pk.bob+=dt*4;
    if(pk.t<=0){pickups.splice(i,1);continue;}
    if(dist2(pk.x,pk.y,player.x,player.y)<16*16){
      if(pk.kind==='heal'){ player.hp=Math.min(player.maxHp,player.hp+16);
        floater(player.x,player.y-20,T('healMsg'),PAL.lime,9); SFX.heal(); }
      else if(pk.kind==='part'){ RUN.pts+=pk.val;
        floater(player.x,player.y-20,T('ptsMsg')+pk.val,PAL.gold,9); SFX.pick(); }
      else { RUN.eq[pk.eqk]++;
        floater(player.x,player.y-20,T('eqGet')+pickupName(pk),PAL.white,9); SFX.heal(); }
      burst(pk.x,pk.y,8,[PAL.gold,PAL.white],60,0.4);
      pickups.splice(i,1);
    } }
}
function updParts(dt){
  for(let i=parts.length-1;i>=0;i--){ const p=parts[i];
    p.life-=dt; if(p.life<=0){parts.splice(i,1);continue;}
    if(!p.ring){ p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.grav||0)*dt;p.vx*=0.98;p.vy*=0.98; } }
  for(let i=floats.length-1;i>=0;i--){ const f=floats[i];
    f.oy=f.y; f.t-=dt; f.y-=22*dt;
    if(f.y<cam.y+34)f.y=cam.y+34;   /* v1.7: 飘字不越过顶部 HUD 条 */
    if(f.t<=0)floats.splice(i,1); }
}
function updWeather(dt){
  for(const m of motes){ m.x+=m.vx*dt; m.y+=m.vy*dt; m.ph=(m.ph||0);
    if(m.x<-4)m.x=VW+4; if(m.x>VW+4)m.x=-4; if(m.y<-4)m.y=VH+4; if(m.y>VH+4)m.y=-4; }
  if(cfg.rain){
    for(const r of rains){ r.y+=440*r.s*dt; r.x-=110*r.s*dt;
      if(r.y>VH+8){r.y=-8;r.x=rnd(-20,VW+40);} if(r.x<-24)r.x+=VW+48; }
    ST.lightT-=dt;
    if(ST.lightT<=0){ ST.lightT=rnd(4,9);
      ST.flash=0.25; ST.bolt=genBolt(); kickTier(1); SFX.thunder();   /* v1.7: 落雷→轻档 */
      if(ST.bolt&&Math.random()<0.6){ const bx=ST.bolt.gx+cam.x,by=ST.bolt.gy+cam.y;
        let best=null,bd=90*90;
        for(const e of enemies){const d=dist2(bx,by,e.x,e.y);if(d<bd){bd=d;best=e;}}
        if(best){hurtEnemy(best,25,'shot');floater(best.x,best.y-18,T('punish'),PAL.gold,10);} }
    }
    ST.flash=Math.max(0,ST.flash-dt);
  }
}
function genBolt(){
  const x0=rnd(40,VW-40);
  const pts=[[x0,0]];
  let x=x0,y=0;
  while(y<VH*0.75){ y+=rnd(18,34); x+=rnd(-16,16); pts.push([x,y]); }
  return {pts,gx:x,gy:y};
}

/* ============================================================
   僚机系统 (v3计划 §23/§24): ASSAULT 索敌强攻 / GUARD 拦截护航 / FLEX 自适应
   ============================================================ */
let wingman=null, wingThreatT=0;   /* wingThreatT: 玩家近旁有来袭弹的剩余时间(FLEX 判据) */
function spawnWingman(){
  const w=WINGS[RUN.wing];
  if(!w||RUN.wing==='none'||!player){ wingman=null; return; }
  const st=calcStats(), mhp=Math.round(st.maxHp*w.hp);
  wingman={type:RUN.wing,x:player.x-34,y:player.y+26,ox:player.x-34,oy:player.y+26,
    vx:0,vy:0,a:0,r:9,hp:mhp,maxHp:mhp,downT:0,fireT:0,scanT:0.4,trailT:0};
}
function wingmanDown(){
  if(!wingman)return;
  wingman.downT=8;
  burst(wingman.x,wingman.y,14,[PAL.steel,PAL.gold,PAL.white],90,0.5);
  floater(wingman.x,wingman.y-20,T('wingDown'),PAL.red,8);
  SFX.hurt();
}
function updWingman(dt){
  if(!wingman||!player)return;
  const w=wingman, cfg=WINGS[w.type];
  w.ox=w.x; w.oy=w.y;
  wingThreatT=Math.max(0,wingThreatT-dt);
  if(w.downT>0){ w.downT-=dt;
    if(w.downT<=0){ w.hp=Math.round(w.maxHp*0.5); w.x=player.x-30; w.y=player.y+24; w.ox=w.x; w.oy=w.y;
      floater(w.x,w.y-18,T('wingBack'),PAL.acid,8); }
    return; }
  /* 威胁感知: 玩家110px内的敌弹 (FLEX 切换护航 / GUARD 拦截判据) */
  let threat=null;
  for(const s of shots){ if(!s.friendly&&dist2(s.x,s.y,player.x,player.y)<110*110){threat=s;break;} }
  if(threat)wingThreatT=0.8;
  const guarding=cfg.guard||(cfg.adapt&&wingThreatT>0);
  /* 位置目标: 护航时贴玩家右侧; 强攻时逼近最近敌人 */
  let tx=player.x+34,ty=player.y+18;
  let near=null,nd=1e9;
  for(const e of enemies){ if(e.dead)continue; const d=dist2(player.x,player.y,e.x,e.y); if(d<nd){nd=d;near=e;} }
  if(!guarding&&near&&nd<280*280){ tx=near.x-Math.cos(Math.atan2(near.y-player.y,near.x-player.x))*70;
    ty=near.y-Math.sin(Math.atan2(near.y-player.y,near.x-player.x))*70; }
  const dx=tx-w.x,dy=ty-w.y,dl=Math.hypot(dx,dy)||1;
  const wspd=Math.min(150,40+dl*3);
  w.vx+=(dx/dl*wspd-w.vx)*Math.min(1,dt*6);
  w.vy+=(dy/dl*wspd-w.vy)*Math.min(1,dt*6);
  w.x+=w.vx*dt; w.y+=w.vy*dt;
  w.x=clamp(w.x,10,WORLDW-10); w.y=clamp(w.y,10,WORLDH-10);
  /* ---- 玩家↔僚机 实体碰撞: 互不穿模, 相撞互相影响 (僚机质量小, 让位更多) ---- */
  w.bumpT=Math.max(0,(w.bumpT||0)-dt);
  {
    const cdx=w.x-player.x, cdy=w.y-player.y, cd=Math.hypot(cdx,cdy)||0.01;
    const minD=w.r+player.r+1.5;
    if(cd<minD){
      const nx=cdx/cd, ny=cdy/cd, push=minD-cd;
      const wShare=0.74, pShare=0.26;
      w.x+=nx*push*wShare; w.y+=ny*push*wShare;
      player.x-=nx*push*pShare; player.y-=ny*push*pShare;
      const rvx=w.vx-player.vx, rvy=w.vy-player.vy, rel=rvx*nx+rvy*ny;
      if(rel<0){
        const j=-rel;
        w.vx+=nx*j*0.9; w.vy+=ny*j*0.9;              /* 僚机被弹开 */
        player.vx-=nx*j*0.35; player.vy-=ny*j*0.35;  /* 玩家受少量推挤 */
        if(j>55&&w.bumpT<=0){ w.bumpT=0.4;
          burst((w.x+player.x)/2,(w.y+player.y)/2,4,[PAL.lite,PAL.cyan],50,0.2);
          SFX.pick(); }
      }
    }
  }
  /* 僚机↔敌军 实体互斥: 不穿模 (僚机被推出, 不造成伤害) */
  for(const e of enemies){
    if(e.dead)continue;
    const ex=w.x-e.x, ey=w.y-e.y, ed=Math.hypot(ex,ey)||0.01, em=e.r+w.r+1;
    if(ed<em){ w.x+=ex/ed*(em-ed); w.y+=ey/ed*(em-ed); }
  }
  /* 开火: 240px 内最近敌人, 机枪弹 ×机型火力系数 */
  w.fireT-=dt;
  if(near&&nd<240*240&&w.fireT<=0){
    w.fireT=0.16;
    const ta=Math.atan2(near.y-w.y,near.x-w.x)+rnd(-0.06,0.06);
    shot(w.x+Math.cos(ta)*10,w.y+Math.sin(ta)*10,ta,360,3*calcStats().atk*cfg.fire,true,'mg');
    part(w.x+Math.cos(ta)*11,w.y+Math.sin(ta)*11,rnd(-10,10),rnd(-10,10),0.06,PAL.gold,1.6);
    addLight(w.x+Math.cos(ta)*11,w.y+Math.sin(ta)*11,10,PAL.gold,0.12,0.05);
    SFX.wingMG(w.x,w.y);
  }
  if(Math.hypot(w.vx,w.vy)>12)w.a=Math.atan2(w.vy,w.vx);
  /* 拦截: 护航状态下每0.4s击落玩家90px内的一发敌弹 */
  if(guarding){
    w.scanT-=dt;
    if(w.scanT<=0){ w.scanT=0.4;
      for(let i=shots.length-1;i>=0;i--){ const s=shots[i];
        if(s.friendly)continue;
        if(dist2(s.x,s.y,player.x,player.y)<90*90&&dist2(s.x,s.y,w.x,w.y)<70*70){
          burst(s.x,s.y,5,[PAL.cyan,PAL.white],70,0.25); releaseShot(i); break; } }
    }
  }
  w.trailT-=dt;
  if(w.trailT<=0&&Math.hypot(w.vx,w.vy)>30){ w.trailT=0.06;
    part(w.x-Math.cos(w.a)*9,w.y-Math.sin(w.a)*9,rnd(-8,8),rnd(-8,8),0.25,PAL.cyan,1.4); }
}
