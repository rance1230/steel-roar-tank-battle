"use strict";
/* Wave director: regular budget excludes the mid-stage ace and final boss.
   All state is level-local. No save schema or score side channel. */
const ENCOUNTER_FORMS=['wedge','line','pincer'];
function resetEncounter(){ST.enc={phase:'ready',wave:0,timer:1.1,regular:0,midDone:false,group:null};}
function duelActive(){return !!(ST.enc&&(ST.enc.phase==='duel'||ST.enc.phase==='duelWarn'));}
function tacticalMove(o,vx,vy,dt){
  if(Math.hypot(vx,vy)<.01)return;
  const ox=o.x,oy=o.y;
  moveCirc(o,vx*dt,vy*dt,o.r);
  if(Math.hypot(o.x-ox,o.y-oy)>Math.hypot(vx,vy)*dt*.4)return;
  // Deterministic sliding detour for a blocked approach; keep the same side briefly.
  const speed=Math.hypot(vx,vy),a=Math.atan2(vy,vx),side=o.detourSide||((o.id||0)%2?1:-1);
  for(const off of [side*.8,side*1.4,-side*.8,-side*1.4]){
    const nx=o.x+Math.cos(a+off)*speed*dt,ny=o.y+Math.sin(a+off)*speed*dt;
    if(!blockedAt(nx,ny,o.r)){o.x=nx;o.y=ny;o.detourSide=Math.sign(off);return;}
  }
}
function formationSlots(n,form){
  return Array.from({length:n},(_,i)=>{
    if(form==='line')return {back:i%2*10,side:(i-(n-1)/2)*34};
    if(form==='pincer')return {back:Math.floor(i/2)*34,side:(i%2?1:-1)*(40+Math.floor(i/2)*8)};
    return i===0?{back:0,side:0}:{back:Math.ceil(i/2)*30,side:(i%2?1:-1)*Math.ceil(i/2)*30};
  });
}
function planFormation(n,form){
  const slots=formationSlots(n,form);
  for(let trial=0;trial<50;trial++){
    const p=edgePoint(),a=Math.atan2(player.y-p.y,player.x-p.x);
    // Offset the apex inward so rear ranks remain inside the battlefield.
    const x=p.x+Math.cos(a)*90,y=p.y+Math.sin(a)*90;
    const points=slots.map(s=>({x:x-Math.cos(a)*s.back-Math.sin(a)*s.side,y:y-Math.sin(a)*s.back+Math.cos(a)*s.side}));
    if(points.every(q=>!blockedAt(q.x,q.y,13)&&dist2(q.x,q.y,player.x,player.y)>155*155))return{x,y,a,slots,points};
  }
  return null; // Retry the warning, never force a spawn into solid terrain.
}
function spawnFormation(n,form){
  const plan=planFormation(n,form);if(!plan)return false;
  const e=ST.enc,group={x:plan.x,y:plan.y,a:plan.a,r:13,id:e.wave+1,form,age:0};
  plan.points.forEach((p,i)=>{
    spawnEnemyAt(i%3===2?'truck':'tank',false,p.x,p.y);const unit=enemies[enemies.length-1];
    unit.formation=group;unit.slot=plan.slots[i];unit.a=plan.a;
    unit.fireCd*=.88;unit.speed*=1.15;unit.lead=Math.min(1.1,unit.lead*1.15);unit.fireT=.65+i*.18;
  });
  e.group=group;e.wave++;e.regular+=n;ST.spawnedN+=n;e.phase='wave';
  return true;
}
function aceStats(){
  const s=calcStats(),h=hullCfg();
  return {maxHp:Math.round(s.maxHp*.8),speed:s.speed*.8,atk:s.atk*.8,def:Math.min(.65,s.def*.8),
    mgCd:.085*s.wcdMul/h.mgDps/.8,cannonCd:.55*s.wcdMul/.8,
    shieldDur:h.shield.dur*.8,shieldCooldown:Math.max(h.shield.dur*.8+1,h.shield.cd*s.cdMul/.8),
    dashDuration:2.6*.8,dashCooldown:3/.8,dashMul:1+.9*h.move.sprint*.8};
}
function spawnAce(){
  let p=null,best=-1;
  for(let i=0;i<40;i++){
    const a=i*Math.PI*.618,x=clamp(player.x+Math.cos(a)*180,40,WORLDW-40),y=clamp(player.y+Math.sin(a)*115,45,WORLDH-45);
    const d=dist2(x,y,player.x,player.y);if(d>best&&!blockedAt(x,y,14)){best=d;p={x,y};}
  }
  if(!p)return false;
  const s=aceStats();spawnEnemyAt('tank',false,p.x,p.y);const e=enemies[enemies.length-1];
  Object.assign(e,s,{hp:s.maxHp,elite:true,hullKey:RUN.hull||'balanced',r:9,mass:'heavy',score:450+RUN.lvl*60,
    a:Math.atan2(player.y-p.y,player.x-p.x),ta:Math.atan2(player.y-p.y,player.x-p.x),
    shieldT:0,shieldCd:.2,shieldAge:0,shieldWind:0,dashT:0,dashCd:2.3,dashWind:0,
    fireM:.6,fireC:1.2,age:0,orb:RUN.lvl%2?1:-1});
  ST.enc.phase='duel';ST.enc.aceId=e.id;ST.spawnedN++;
  return true;
}
function clearDuelProjectiles(){
  shots.length=0;bombs.length=0;planes.length=0;player.mslVolley.length=0;
  player.lockSlots.length=0;player.charging=false;player.charge=0;player.mgLockId=0;
}
function updateEncounter(dt){
  if(DBG.lab||ST.bossSpawned)return;
  if(!ST.enc)resetEncounter();const e=ST.enc;
  const alive=enemies.some(x=>!x.dead),budget=cfg.quota-2,mid=Math.floor(budget/2);
  if(e.phase==='wave'&&alive){
    const g=e.group;if(g){g.age+=dt;const dx=player.x-g.x,dy=player.y-g.y,d=Math.hypot(dx,dy)||1;
      g.a+=clamp(angDiff(g.a,Math.atan2(dy,dx)),-dt*.5,dt*.5);
      const a=Math.atan2(dy,dx)+(d<155?Math.PI/2:0);tacticalMove(g,Math.cos(a)*49,Math.sin(a)*49,dt);}
    return;
  }
  if(e.phase==='duel'){
    if(alive)return;e.midDone=true;e.phase='ready';e.timer=1.7;e.aceId=0;return;
  }
  if(alive)return;
  if(e.phase==='wave'){e.phase='ready';e.timer=1.2;e.group=null;}
  e.timer-=dt;if(e.timer>0)return;
  if(e.phase==='duelWarn'){if(!spawnAce())e.timer=.5;return;}
  if(e.phase==='waveWarn'){
    if(!spawnFormation(e.pending,ENCOUNTER_FORMS[e.wave%3]))e.timer=.5;
    return;
  }
  if(!e.midDone&&e.regular>=mid){e.phase='duelWarn';e.timer=1.6;clearDuelProjectiles();SFX.horn();return;}
  if(e.regular>=budget){ST.spawnedN=cfg.quota-1;return;}
  const limit=e.midDone?budget:mid;
  e.pending=Math.min(6,3+Math.floor(RUN.lvl/2)+Math.floor(SET.diff/3)+Math.min(1,RUN.cycle),limit-e.regular);
  e.phase='waveWarn';e.timer=1.0;SFX.lock();
}
function updateAce(e,dt){
  e.age+=dt;e.shieldAge+=dt;e.shieldT=Math.max(0,e.shieldT-dt);e.shieldCd=Math.max(0,e.shieldCd-dt);
  e.dashCd=Math.max(0,e.dashCd-dt);e.fireM-=dt;e.fireC-=dt;
  if(e.stun>0){e.stun=Math.max(0,e.stun-dt);e.dashT=0;e.dashWind=0;moveCirc(e,(e.kvx||0)*dt,(e.kvy||0)*dt,e.r);e.kvx*=Math.exp(-6*dt);e.kvy*=Math.exp(-6*dt);return;}
  const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy)||1;
  const target=Math.atan2(dy+player.vy*(d/320)*.55,dx+player.vx*(d/320)*.55);
  e.ta+=clamp(angDiff(e.ta,target),-hullCfg().turret.rate*.8*dt,hullCfg().turret.rate*.8*dt);
  if(e.shieldWind>0){e.shieldWind-=dt;if(e.shieldWind<=0){e.shieldT=e.shieldDur;e.shieldCd=e.shieldCooldown;e.shieldAge=0;SFX.shield(e.x,e.y);}}
  else if(e.shieldCd<=0&&shots.some(s=>s.friendly&&dist2(s.x,s.y,e.x,e.y)<120*120)){e.shieldWind=.28;e.shieldCd=.3;}
  if(e.dashWind>0){e.dashWind-=dt;if(e.dashWind<=0){e.dashT=e.dashDuration;e.dashCd=e.dashCooldown+e.dashDuration;}}
  else if(e.dashT<=0&&e.dashCd<=0){e.dashWind=.4;e.dashCd=.5;}
  const dash=e.dashT>0;e.dashT=Math.max(0,e.dashT-dt);
  let moveA=Math.atan2(dy,dx)+(d<95?Math.PI:d>190?0:Math.PI/2*e.orb);
  const speed=e.speed*(dash?e.dashMul:1)*(e.dashWind>0?.25:1)*slowMul(tileAtPx(e.x,e.y));
  e.a+=clamp(angDiff(e.a,moveA),-7*dt,7*dt);
  const ox=e.x,oy=e.y;tacticalMove(e,Math.cos(moveA)*speed+(e.kvx||0),Math.sin(moveA)*speed+(e.kvy||0),dt);
  e.kvx*=Math.exp(-6*dt);e.kvy*=Math.exp(-6*dt);e.dist+=Math.hypot(e.x-ox,e.y-oy);
  if(dash&&Math.floor(e.age*15)!==Math.floor((e.age-dt)*15))part(e.x-Math.cos(e.a)*13,e.y-Math.sin(e.a)*13,-Math.cos(e.a)*25,-Math.sin(e.a)*25,.18,PAL.red,1.5);
  tryContact(e);if(e.dead)return;
  if(d<285&&Math.abs(angDiff(e.ta,target))<.22&&e.dashWind<=0){
    const x=e.x+Math.cos(e.ta)*16,y=e.y+Math.sin(e.ta)*16;
    // Short controlled bursts retain player-like weapon cadence with readable gaps.
    if(e.fireM<=0&&e.age%1.4<.7){e.fireM=e.mgCd;shot(x,y,e.ta+rnd(-.07,.07),344,2.2*e.atk,false,'mg');SFX.enemyMG(x,y);}
    if(e.fireC<=0){e.fireC=e.cannonCd;shot(x,y,e.ta,256,18*e.atk,false,'shell');flashFx(x,y,6);SFX.enemyCannon(x,y,false);}
  }
}
function encounterLabel(){
  const e=ST.enc;if(!e)return '';
  const z=SET.lang==='zh',j=SET.lang==='ja';
  if(e.phase==='duelWarn')return z?'精英接近 · 准备单挑':j?'エース接近 · 一騎討ち':'ACE INBOUND · DUEL';
  if(e.phase==='duel')return z?'精英对决 · 僚机待命':j?'エース対決 · 僚機待機':'ACE DUEL · WING STANDBY';
  const form=ENCOUNTER_FORMS[e.wave%3],names=z?{wedge:'楔形',line:'横列',pincer:'双翼'}:j?{wedge:'楔形',line:'横陣',pincer:'挟撃'}:{wedge:'WEDGE',line:'LINE',pincer:'PINCER'};
  return e.phase==='waveWarn'?(z?'编队来袭 ':j?'編隊接近 ':'INCOMING ')+names[form]:'';
}
