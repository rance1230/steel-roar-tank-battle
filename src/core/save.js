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

const DIFFS=[
 {ai:0.70,react:0.75,hp:0.80,acc:0.70,drop:0.70,reward:1.00},
 {ai:0.85,react:0.90,hp:0.95,acc:0.85,drop:0.85,reward:1.15},
 {ai:1.00,react:1.00,hp:1.10,acc:1.00,drop:1.00,reward:1.30},
 {ai:1.15,react:1.15,hp:1.30,acc:1.15,drop:1.25,reward:1.60},
 {ai:1.30,react:1.30,hp:1.55,acc:1.30,drop:1.50,reward:2.00}];

const RUN_DEF=()=>({lvl:0,score:0,kills:0,time:0,cycle:0,pts:0,
  up:{hp:0,spd:0,atk:0,def:0},eq:{armor:0,track:0,fire:0,comp:0}});
let RUN=RUN_DEF(),lvlSnap=null;
function saveRun(){try{localStorage.setItem('trSave',JSON.stringify(RUN));}catch(e){}}
function loadRun(){try{const s=localStorage.getItem('trSave');
  if(s){const r=JSON.parse(s);RUN=Object.assign(RUN_DEF(),r);RUN.up=Object.assign({hp:0,spd:0,atk:0,def:0},r.up||{});RUN.eq=Object.assign({armor:0,track:0,fire:0,comp:0},r.eq||{});return true;}}catch(e){}return false;}
function hasSave(){try{return !!localStorage.getItem('trSave');}catch(e){return false;}}
function calcStats(){const u=RUN.up,e=RUN.eq;return{
  maxHp:100+15*u.hp+10*e.armor, speed:88*(1+0.05*u.spd+0.03*e.track),
  atk:1+0.08*u.atk+0.05*e.fire, def:Math.min(0.6,0.06*u.def+0.04*e.comp)};}
function rewardMul(){return DIFFS[SET.diff].reward*(1+0.3*RUN.cycle);}
function refundAll(){RUN.pts+=RUN.up.hp+RUN.up.spd+RUN.up.atk+RUN.up.def;RUN.up={hp:0,spd:0,atk:0,def:0};}
