"use strict";
/* game/combat — vNext Combat Foundation
   A. DamageEvent 统一伤害归因 (cause/chainDepth/comboEligible)
   B. Parry 分级 (普通反弹 / Perfect Parry 窗口)
   C. Breach Ram 状态机 (锁定→零距离炮击→击飞→连锁) + 质量分级 */

let HITSTOP=0;              /* 全局顿帧(秒): 期间逻辑冻结, 仅渲染 */
const SHIELD_PERFECT=0.12;  /* Perfect Parry 精准窗口(秒, 均衡型基准) */
const CHAIN_MAX=3;          /* 连锁深度上限, 防止无限连锁 */

/* 连击权重表 (第三版计划·第六章) */
const CAUSE_COMBO={
  machinegun:1, cannon:2, missile:2, reflect:2, perfectParry:0,
  ram:2, breach:3, knockback:0, collision:2,
  explosion:0, chainExplosion:1, wingman:1, lightning:1, shot:0,
};

/* 战斗统计 (供验收/平衡QA) */
const STATS={dmg:{},kills:0,parryN:0,parryP:0,hitstopN:0,breachLocks:0,breachFires:0,
  breachStaggers:0,knockHits:0,chainBoom:0,maxCombo:0};

let DEVID=1;
/* 统一伤害入口: 构造 DamageEvent 并归因 */
function applyDamage(e,dmg,cause,opts){
  opts=opts||{};
  const ev={id:DEVID++,cause:cause||'shot',dmg,
    parentId:opts.parentId||0,chainDepth:opts.chainDepth||0,
    comboEligible:opts.comboEligible!==false};
  if(e.dead)return ev;
  e.hp-=dmg; e.flash=0.1;
  STATS.dmg[ev.cause]=(STATS.dmg[ev.cause]||0)+dmg;
  if(ev.comboEligible&&CAUSE_COMBO[ev.cause])addCombo(CAUSE_COMBO[ev.cause]);
  if(opts.extraCombo)addCombo(opts.extraCombo);
  if(dmg>=15)floater(e.x+rnd(-4,4),e.y-12,''+Math.round(dmg),PAL.white,7);
  if(e.hp<=0){ e.dead=true; onEnemyDead(e,ev.cause,ev); }
  return ev;
}

/* 质量分级击飞参数 (light/medium/heavy/fortress) */
const KNOCK={light:{v:400,t:0.55},medium:{v:300,t:0.42},heavy:{v:160,t:0.3},fortress:{v:0,t:0}};

/* ---- C. Breach Ram ---- */
function enterBreach(e){
  const p=player;
  const stag=!!e.boss;
  p.breach={e,t:0.34,stagger:stag};
  p.vx*=0.05; p.vy*=0.05;
  e.stun=Math.max(e.stun,0.5);
  STATS.breachLocks++;
  ST.shake=Math.min(10,ST.shake+3);
  burst((p.x+e.x)/2,(p.y+e.y)/2,10,[PAL.white,PAL.gold],90,0.3);
  SFX.ram();
  floater(e.x,e.y-e.r-10,T('breachMsg'),PAL.gold,8,0.35);
}
function breachFire(e,stagger){
  const p=player, st=calcStats();
  if(p.breach&&p.breach.e===e)p.breach=null;   /* 防御: 清掉锁定, 避免残pin拖拽玩家 */
  const dmg=24*st.atk*1.35;                    /* 零距离炮击 ×1.35 */
  HITSTOP=0.05;
  STATS.breachFires++;
  ST.shake=Math.min(12,ST.shake+7);
  const fx=p.x+Math.cos(p.a)*(p.r+10), fy=p.y+Math.sin(p.a)*(p.r+10);   /* 特效前移到接触点, 不糊玩家 */
  flashFx(fx,fy,26,true);
  burst(fx,fy,12,[PAL.gold,PAL.white,PAL.red],130,0.45);
  SFX.cannon(); SFX.bigboom();
  const ev=applyDamage(e,dmg,'breach');
  if(stagger||e.boss){                          /* Fortress: 不可击飞, 大幅硬直 */
    e.stun=1.5; STATS.breachStaggers++;
    floater(e.x,e.y-e.r-14,T('staggerMsg'),PAL.red,9);
    return;
  }
  if(e.dead){ return; }   /* 殉爆连锁已由 onEnemyDead 的归因链处理, 不重复爆炸 */
  const kp=KNOCK[e.mass||'medium'];             /* 击飞 */
  e.flying={vx:Math.cos(p.a)*kp.v,vy:Math.sin(p.a)*kp.v,t:kp.t};
  e.stun=kp.t+0.3; e.jitter=0;
  floater(e.x,e.y-e.r-12,T('launchMsg'),PAL.red,9,0.5);
}
function endFlight(e){ e.flying=null; e.stun=Math.max(e.stun,0.35); }

/* ---- B. Parry 分级反馈 ---- */
function parryFeedback(perfect,s){
  const cx=s.x, cy=s.y;
  if(perfect){
    STATS.parryP++;
    HITSTOP=0.055; STATS.hitstopN++;
    COMBO.t=Math.max(COMBO.t,1.2);              /* Combo grace 保连 */
    floater(player.x,player.y-26,T('parryMsg'),PAL.white,10,0.28);
    for(let i=0;i<4;i++){ /* 十字闪光: 4根放射光束 */
      const an=i*Math.PI/2;
      const p1=part(cx+Math.cos(an)*8,cy+Math.sin(an)*8,Math.cos(an)*120,Math.sin(an)*120,0.18,PAL.white,4.5); p1.ray=true;
      const p2=part(cx+Math.cos(an+0.78)*6,cy+Math.sin(an+0.78)*6,Math.cos(an+0.78)*90,Math.sin(an+0.78)*90,0.15,PAL.lite,3.5); p2.ray=true; }
    burst(cx,cy,8,[PAL.white,PAL.lite],110,0.3);
    beep(2100,0.07,'square',0.08); beep(2650,0.05,'square',0.06);
  }else{
    STATS.parryN++;
    HITSTOP=0.035; STATS.hitstopN++;
    for(let i=0;i<6;i++){ const a=rnd(Math.PI*2);   /* 小型白蓝接触环 */
      part(cx+Math.cos(a)*5,cy+Math.sin(a)*5,Math.cos(a)*46,Math.sin(a)*46,0.12,i%2?PAL.white:PAL.lite,2); }
    beep(1500,0.045,'square',0.06);
  }
}
