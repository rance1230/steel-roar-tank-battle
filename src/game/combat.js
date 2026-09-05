"use strict";
/* game/combat — vNext Combat Foundation
   A. DamageEvent 统一伤害归因 (cause/chainDepth/comboEligible)
   B. Parry 分级 (普通反弹 / Perfect Parry 窗口)
   C. Breach Ram 状态机 (锁定→零距离炮击→击飞→连锁) + 质量分级 */

let HITSTOP=0;              /* 全局顿帧(秒): 期间逻辑冻结, 仅渲染 */
/* Perfect Parry 精准窗口改随机体读取 (原固定0.12=均衡型基准) */
const SHIELD_PERFECT_LEGACY=0.12;
const CHAIN_MAX=3;          /* 连锁深度上限, 防止无限连锁 */
const SHIELD_GRACE=0.18;    /* v1.8 §4: 护盾收尾宽限, 硬不变量用 */

/* 连击权重表 (第三版计划·第六章) */
const CAUSE_COMBO={
  machinegun:1, cannon:2, missile:2, reflect:2, perfectParry:0,
  ram:2, breach:3, knockback:0, collision:2,
  explosion:0, chainExplosion:1, wingman:1, lightning:1, shot:0, airstrike:0,
};

/* 战斗统计 (供验收/平衡QA) */
const STATS={dmg:{},kills:0,parryN:0,parryP:0,hitstopN:0,breachLocks:0,breachFires:0,
  breachStaggers:0,knockHits:0,chainBoom:0,maxCombo:0};

let DEVID=1;
/* §3 DAMAGE_MATRIX: atk 乘算统一在管线执行(恰好一次), 调用方传 rawDamage。
   true=PlayerAtk 类; false=ATK-independent 类(reflect=来袭×格挡倍率 /
   敌方伤害走 damagePlayer 的 def×taken / 闪电惩罚与调试击杀 flat / 空袭 34 flat)。
   UNUSED 遗留 cause(wingman/lightning/perfectParry) 不新增调用。 */
const DMG_ATK={machinegun:1,cannon:1,missile:1,explosion:1,chainExplosion:1,
  ram:1,breach:1,collision:1,airstrike:1,knockback:0,shot:0,reflect:0};
/* 统一伤害入口: DamageEvent {cause, rawDamage, statPolicy} → resolve */
function applyDamage(e,raw,cause,opts){
  opts=opts||{};
  const ev={id:DEVID++,cause:cause||'shot',rawDamage:raw,
    statPolicy:DMG_ATK[cause||'shot']===1,
    parentId:opts.parentId||0,chainDepth:opts.chainDepth||0,
    comboEligible:opts.comboEligible!==false};
  if(e.dead)return ev;
  const dmg=raw*(ev.statPolicy?calcStats().atk:1)*(e.elite?(1-(e.def||0))*(e.shieldT>0?.2:1):1);   /* atk 恰好乘一次 */
  ev.dmg=dmg;
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
  burst((p.x+e.x)/2,(p.y+e.y)/2,10,[PAL.white,PAL.gold],90,0.3);
  SFX.ram((p.x+e.x)/2,(p.y+e.y)/2);
  kickTier(1,Math.atan2(e.y-p.y,e.x-p.x));   /* v1.7: 顶入→轻档 */
  floater(e.x,e.y-e.r-10,T('breachMsg'),PAL.gold,8,0.35);
}
function breachFire(e,stagger){
  const p=player;
  if(p.breach&&p.breach.e===e)p.breach=null;   /* 防御: 清掉锁定, 避免残pin拖拽玩家 */
  const dmg=24*1.35*hullCfg().breach;          /* raw; atk 由 §3 管线统一乘 (×1.35 ×机型Breach倍率) */
  HITSTOP=0.05;
  STATS.breachFires++;
  const fx=p.x+Math.cos(p.bodyA)*(p.r+10), fy=p.y+Math.sin(p.bodyA)*(p.r+10);   /* 特效前移到接触点, 不糊玩家 */
  flashFx(fx,fy,26,true);
  burst(fx,fy,12,[PAL.gold,PAL.white,PAL.red],130,0.45);
  kickTier(2,p.bodyA);   /* v1.7: 零距炮击→中档; 若击杀由 onEnemyDead 补最大档 */
  SFX.cannon(fx,fy); SFX.bigboom(fx,fy);
  const ev=applyDamage(e,dmg,'breach');
  if(stagger||e.boss){                          /* Fortress: 不可击飞, 大幅硬直 */
    e.stun=1.5; STATS.breachStaggers++;
    floater(e.x,e.y-e.r-14,T('staggerMsg'),PAL.red,9);
    return;
  }
  if(e.dead){ return; }   /* 殉爆连锁已由 onEnemyDead 的归因链处理, 不重复爆炸 */
  const kp=KNOCK[e.mass||'medium'];             /* 击飞 */
  e.flying={vx:Math.cos(p.bodyA)*kp.v,vy:Math.sin(p.bodyA)*kp.v,t:kp.t};
  e.stun=kp.t+0.3; e.jitter=0;
  floater(e.x,e.y-e.r-12,T('launchMsg'),PAL.red,9,0.5);
}
function endFlight(e){ e.flying=null; e.stun=Math.max(e.stun,0.35); }

/* ---- B. Parry 分级反馈 ---- */
/* v1.8 W7: 护盾弹反蓝白粒子漩涡 — 切向+向内速度=螺旋内卷; 质量分级 q2/q1/q0;
   Perfect: 半径×1.3 角速×1.3 亮度↑ (不堆粒子数, 靠运动与光强) */
function shieldSwirl(x,y,perfect,q){
  q=(q===undefined)?PERF.qLevel:q;
  const blue='#7ec8ff';
  const R=perfect?26:19;
  const n=q>=2?(perfect?26:18):q===1?(perfect?15:10):0;   /* q0=仅冲击环+3粒 */
  const spin=perfect?9.5:7;
  for(let i=0;i<n;i++){
    const a=(i*0.618)*Math.PI*2+rnd(0.25), r=R*(0.35+0.65*((i*0.381)%1));
    const va=a+Math.PI/2;                              /* 切向 → 漩涡 */
    part(x+Math.cos(a)*r,y+Math.sin(a)*r,
      Math.cos(va)*spin*R*0.5-Math.cos(a)*R*0.9, Math.sin(va)*spin*R*0.5-Math.sin(a)*R*0.9,
      rnd(0.3,0.55), i%3?blue:PAL.white, rnd(1.3,2.6)*(perfect?1.25:1), 0, perfect?1:0.85);
  }
  const ring=part(x,y,0,0,0.34,perfect?PAL.white:blue,R*1.5,0); ring.ring=true;   /* 冲击环 */
  if(q<=0)for(let i=0;i<3;i++){const a2=rnd(Math.PI*2);
    part(x+Math.cos(a2)*R,y+Math.sin(a2)*R,Math.cos(a2)*40,Math.sin(a2)*40,0.2,blue,1.6);}
  addLight(x,y,R*2.3,perfect?PAL.white:blue,perfect?0.42:0.27,0.2);
}
/* v1.8 W7: 弹反反馈批量化 — 同帧 N 发合并: N≥2 增强 hitstop/kick + ×N 浮字 + 大漩涡 */
function parryFeedback(perfect,s,n){
  n=n||1;
  const cx=s.x, cy=s.y;
  const batch=n>=2;
  if(perfect){
    STATS.parryP++;
    HITSTOP=batch?0.07:0.055; STATS.hitstopN++;
    COMBO.t=Math.max(COMBO.t,1.2);              /* Combo grace 保连 */
    floater(player.x,player.y-26,T('parryMsg')+(batch?' ×'+n:''),PAL.white,10,0.28);
    for(let i=0;i<4;i++){ /* 十字闪光: 4根放射光束 */
      const an=i*Math.PI/2;
      const p1=part(cx+Math.cos(an)*8,cy+Math.sin(an)*8,Math.cos(an)*120,Math.sin(an)*120,0.18,PAL.white,4.5); p1.ray=true;
      const p2=part(cx+Math.cos(an+0.78)*6,cy+Math.sin(an+0.78)*6,Math.cos(an+0.78)*90,Math.sin(an+0.78)*90,0.15,PAL.lite,3.5); p2.ray=true; }
  }else{
    STATS.parryN++;
    HITSTOP=batch?0.055:0.035; STATS.hitstopN++;
  }
  shieldSwirl(player.x,player.y,perfect||batch);         /* 漩涡以玩家为中心(护罩本体) */
  if(batch)burst(cx,cy,8,[PAL.white,'#7ec8ff'],130,0.32);
  kickTier(batch?3:(perfect?2:1),s.ang);   /* v1.7: Perfect弹反→中档; v1.8 W7 批量→强档 */
  SFX.reflect(cx,cy,perfect||batch);
}
