"use strict";
/* core/save — 设置与存档持久化 */
/* ============================================================
   设置 / 难度 / 存档
   ============================================================ */
const SET_DEF={lang:'zh',diff:2,bgm:3,se:3,touch:'auto',
  pad:{mg:0,cannon:2,msl:3,strike:1,sprint:5,shield:4,pause:9,confirm:0,back:1}};
let SET=(function(){try{const s=JSON.parse(localStorage.getItem('trSet'));
  if(s&&s.pad)return Object.assign(JSON.parse(JSON.stringify(SET_DEF)),s);}catch(e){}
  return JSON.parse(JSON.stringify(SET_DEF));})();
function saveSet(){try{localStorage.setItem('trSet',JSON.stringify(SET));}catch(e){}}
const VOLS=[0,0.12,0.24,0.36,0.50], SEVOLS=[0,0.20,0.40,0.60,0.85];

/* ---------- 三机体 (v3计划 §17/§19/§20, 均衡型=基准100) ---------- */
const HULLS={
  assault:{i18n:'hullA',hp:0.90,taken:1.15,spd:1.10,accel:1.12,cannon:1.05,blast:1.00,
    mgDps:1.10,sprint:1.20,breach:1.25,mslN:3,mslCd:0.85,
    shield:{dur:0.22,perfect:0.08,cd:0.95}},
  balanced:{i18n:'hullB',hp:1.00,taken:1.00,spd:1.00,accel:1.00,cannon:1.00,blast:1.00,
    mgDps:1.00,sprint:1.00,breach:1.00,mslN:1,mslCd:1.00,
    shield:{dur:0.42,perfect:0.12,cd:0.75}},
  heavy:{i18n:'hullC',hp:1.25,taken:0.85,spd:0.88,accel:0.88,cannon:1.18,blast:1.20,
    mgDps:0.90,sprint:0.85,breach:1.10,mslN:1,mslCd:1.25,
    shield:{dur:4.0,perfect:0.18,cd:1.5,fortress:true}}};
const HULL_KEYS=['assault','balanced','heavy'];
/* §24 默认配对: 突击→防御, 均衡→自适应, 重装→突击 */
const HULL_M2W={assault:'guard',balanced:'flex',heavy:'assault'};
function hullCfg(){ return HULLS[RUN.hull]||HULLS.balanced; }
/* ---------- 僚机 (v3计划 §23: 火力/HP 比例) ---------- */
const WINGS={
  assault:{i18n:'wA',fire:0.78,hp:0.70},
  guard:{i18n:'wG',fire:0.60,hp:0.90,guard:true},
  flex:{i18n:'wF',fire:0.70,hp:0.80,adapt:true}};
const WING_KEYS=['assault','guard','flex','none'];

const DIFFS=[
 {ai:0.70,react:0.75,hp:0.80,acc:0.70,drop:0.70,reward:1.00},
 {ai:0.85,react:0.90,hp:0.95,acc:0.85,drop:0.85,reward:1.15},
 {ai:1.00,react:1.00,hp:1.10,acc:1.00,drop:1.00,reward:1.30},
 {ai:1.15,react:1.15,hp:1.30,acc:1.15,drop:1.25,reward:1.60},
 {ai:1.30,react:1.30,hp:1.55,acc:1.30,drop:1.50,reward:2.00}];

const RUN_DEF=()=>({lvl:0,score:0,kills:0,time:0,cycle:0,pts:0,
  up:{hp:0,spd:0,atk:0,def:0},eq:{armor:0,track:0,fire:0,comp:0},
  hull:'balanced',wing:'flex'});
let RUN=RUN_DEF(),lvlSnap=null;
function saveRun(){ if(ST&&ST.debugActive)return;   /* §27: Debug 会话不写正式存档 */
  try{localStorage.setItem('trSave',JSON.stringify(RUN));}catch(e){} }
function loadRun(){try{const s=localStorage.getItem('trSave');
  if(s){const r=JSON.parse(s);RUN=Object.assign(RUN_DEF(),r);RUN.up=Object.assign({hp:0,spd:0,atk:0,def:0},r.up||{});RUN.eq=Object.assign({armor:0,track:0,fire:0,comp:0},r.eq||{});return true;}}catch(e){}return false;}
function hasSave(){try{return !!localStorage.getItem('trSave');}catch(e){return false;}}
function calcStats(){const u=RUN.up,e=RUN.eq,h=hullCfg();
  const dbg=(typeof ST!=='undefined'&&ST.debugActive&&ST.dbg)||{};
  return{
    maxHp:Math.round((100+15*u.hp+10*e.armor)*h.hp)+(dbg.hpBonus|0),
    speed:88*(1+0.05*u.spd+0.03*e.track)*h.spd*(dbg.spd||1),
    atk:(1+0.08*u.atk+0.05*e.fire)*h.cannon*(dbg.atk||1),
    def:Math.min(0.85,0.06*u.def+0.04*e.comp+(dbg.defBonus||0))};}
function rewardMul(){return DIFFS[SET.diff].reward*(1+0.3*RUN.cycle);}
function refundAll(){RUN.pts+=RUN.up.hp+RUN.up.spd+RUN.up.atk+RUN.up.def;RUN.up={hp:0,spd:0,atk:0,def:0};}
