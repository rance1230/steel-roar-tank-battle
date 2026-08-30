"use strict";
/* game/main — 状态机/流程/调试钩子/引导 */
/* ---------- 全局状态 ---------- */
let ST,cfg,terr,player,enemies,shots,bombs,planes,pickups,parts,floats,rains,cam,lightPools=[];
let MENU=null, MENU_RECTS=[], TAP_RECTS=[];
function newGame(){ ST={state:'title',t:0,levelTime:0,killsLevel:0,introT:0,clearT:0,winT:0,creditsBgm:false,
  bossSpawned:false,bossWarn:0,spawnedN:0,spawnT:0,paused:false,muted:false,
  shake:0,flash:0,bolt:null,lightT:5,clearBonus:0,overT:0,best:0,
  upg:{sel:0,from:'clear'},padNavT:0,ctrlT:0,ctrlIdx:0,ctrlMode:null};
  try{ST.best=parseInt(localStorage.getItem('trBest')||'0')||0;}catch(e){}
  enemies=[];shots=[];bombs=[];planes=[];pickups=[];parts=[];floats=[];rains=[];cam={x:0,y:0}; }
newGame(); openMenu('title');

/* ---------- 关卡流程 ---------- */
function startLevel(){
  cfg=LEVELS[RUN.lvl]; genMap();
  player=makePlayer(); enemies=[];shots=[];bombs=[];planes=[];pickups=[];parts=[];floats=[];rains=[];
  clearDecals(); initMotes();
  /* 战场暖光池锚定掩体/岩石 (审查C4): 'lighter' 呼吸暖光 */
  lightPools=[];
  for(let i=0;i<3;i++){ let bx=0,by=0,ok=false;
    for(let t=0;t<30&&!ok;t++){ bx=rnd(2,MAPW-2)|0; by=rnd(2,MAPH-2)|0; if(tileAt(bx,by)===5)ok=true; }
    lightPools.push({x:bx*TS+8,y:by*TS+8,r:rnd(36,54),ph:rnd(6)}); }
  ST.killsLevel=0;ST.levelTime=0;ST.spawnT=0.8;ST.bossSpawned=false;ST.bossWarn=0;ST.spawnedN=0;
  ST.shake=0;ST.flash=0;ST.bolt=null;ST.lightT=rnd(3,7);
  cam={x:clamp(player.x-VW/2,0,WORLDW-VW),y:clamp(player.y-VH/2,0,WORLDH-VH)};
  lvlSnap=JSON.parse(JSON.stringify({score:RUN.score,kills:RUN.kills,time:RUN.time,pts:RUN.pts,up:RUN.up,eq:RUN.eq}));
  COMBO.n=0; COMBO.t=0; COMBO.tier=0; COMBO.od=false;   /* vNext: 连击重置 */
  MENU=null; ST.state='intro'; ST.introT=2.4;
  BGM.play('introj',false);
  for(let i=0;i<110;i++)rains.push({x:rnd(VW),y:rnd(VH),s:rnd(0.7,1.3)});
}
function retryLevel(){
  const s=JSON.parse(lvlSnap?JSON.stringify(lvlSnap):'{}');
  RUN.score=s.score||0;RUN.kills=s.kills||0;RUN.time=s.time||0;RUN.pts=s.pts||0;
  RUN.up=s.up||{hp:0,spd:0,atk:0,def:0};RUN.eq=s.eq||{armor:0,track:0,fire:0,comp:0};
  startLevel();
}
function levelClear(){
  ST.state='clear'; ST.clearT=0;
  const bonus=200+Math.max(0,Math.round((90-ST.levelTime))*10);
  RUN.score+=bonus; RUN.time+=ST.levelTime; ST.clearBonus=bonus; saveRun();
  try{ if(RUN.score>ST.best){ST.best=RUN.score;localStorage.setItem('trBest',''+ST.best);} }catch(e){}
  BGM.play('warp',false);
}
function afterClear(){ // clear卡 → 整备或通关
  if(RUN.lvl>=LEVELS.length-1){ ST.state='win'; ST.winT=0; ST.creditsBgm=false; saveRun(); BGM.play('win',false); }
  else { ST.state='upgrade'; ST.upg={sel:0,from:'clear'}; }
}
function deployFromUpgrade(){
  if(ST.upg.from==='win'){ RUN.cycle++; RUN.lvl=0; }
  else RUN.lvl++;
  saveRun(); startLevel();
}
function toTitle(){ ST.state='title'; openMenu('title'); BGM.play('title',true); }
/* 战前键位速览页: 进入新游戏时展示, 动态演示当前输入方式的按键布局, 确认跳过 */
const CTRL_MODES=['pad','touch','key'];
function enterCtrlIntro(){
  ST.state='ctrl'; ST.ctrlT=0; ST.ctrlIdx=0;
  const detected=CTRL_MODES.indexOf(inMode());
  ST.ctrlMode=detected>=0?detected:2;
  MENU=null; BGM.play('title',true);
}
function exitCtrlIntro(){ startLevel(); }
function startNewGame(){ RUN=RUN_DEF(); enterCtrlIntro(); }
function continueGame(){ if(loadRun())startLevel(); else startNewGame(); }

function onKeyPress(code){
  if(code==='F3'){ PERF.show=!PERF.show; return; }
  if(code==='KeyM'){ ST.muted=!ST.muted; if(master)master.gain.value=ST.muted?0:1; return; }
  initAudio();
  if(MENU){ menuKey(code); return; }
  switch(ST.state){
    case 'title': if(code==='Enter')menuActivate(); break;
    case 'ctrl':
      if(code==='ArrowLeft'||code==='KeyA'){ ST.ctrlMode=(ST.ctrlMode+2)%3; ST.ctrlT=ST.ctrlIdx*1.7; SFX.pick(); break; }
      if(code==='ArrowRight'||code==='KeyD'){ ST.ctrlMode=(ST.ctrlMode+1)%3; ST.ctrlT=ST.ctrlIdx*1.7; SFX.pick(); break; }
      if(code==='Enter'||code==='KeyJ'||code==='Space'||code==='Escape'||code==='KeyR')exitCtrlIntro();
      break;
    case 'intro': if(code==='Enter')ST.introT=0; break;
    case 'clear': if(code==='Enter'||code==='KeyJ'||code==='Space')afterClear(); break;
    case 'upgrade': upgKey(code); break;
    case 'over':
      if(code==='KeyR')retryLevel();
      else if(code==='KeyQ')toTitle();
      break;
    case 'win':
      if(code==='Enter'){ RUN.cycle++; RUN.lvl=0; saveRun(); startLevel(); }
      else if(code==='KeyR'){ refundAll(); ST.state='upgrade'; ST.upg={sel:0,from:'win'}; }
      else if(code==='KeyQ')toTitle();
      break;
    case 'play':
      if(code==='KeyP'||code==='Escape'){ openMenu('pause'); }
      if(code==='Space'){ if(player.shieldCd<=0){ player.shieldT=0.42; player.shieldCd=0.75; player.shieldAge=0; SFX.pick(); } }
      if(code==='KeyU'&&player.strikeCd<=0){ player.strikeCd=5; callAirstrike(); }
      break;
  }
}

/* ---------- 主更新 ---------- */
function tick(dt){
  ST.t+=dt; pollPad(); updOvl();
  // 手柄菜单导航(长按重复)
  if(MENU&&!MENU.capture&&MENU.id!=='help'){
    if(PAD.just.up)menuMove(-1); if(PAD.just.down)menuMove(1);
    if(PAD.just.left)menuAdjust(-1); if(PAD.just.right)menuAdjust(1);
    if(PAD.just.confirm)menuActivate(); if(PAD.just.back)menuBack();
    if(PAD.just.pause&&MENU.id==='pause')MENU=null;
    ST.padNavT-=dt;
    if(PAD.hold.up||PAD.hold.down){ if(ST.padNavT<=0){menuMove(PAD.hold.down?1:-1);ST.padNavT=0.22;} }
    else ST.padNavT=0.4;
  }
  if(MENU&&MENU.id==='help'){ if(PAD.just.left)menuAdjust(-1); if(PAD.just.right)menuAdjust(1);
    if(PAD.just.confirm||PAD.just.back)menuBack(); }
  if(MENU&&MENU.capture&&PAD.gp){ /* pollPad内处理 */ }
  if(ST.state==='upgrade'){
    if(PAD.just.up){ST.upg.sel=(ST.upg.sel+3)%4;SFX.pick();}
    if(PAD.just.down){ST.upg.sel=(ST.upg.sel+1)%4;SFX.pick();}
    if(PAD.just.right&&RUN.pts>0){RUN.pts--;RUN.up[UPG_KEYS[ST.upg.sel]]++;SFX.pick();}
    if(PAD.just.left&&RUN.up[UPG_KEYS[ST.upg.sel]]>0){RUN.pts++;RUN.up[UPG_KEYS[ST.upg.sel]]--;SFX.pick();}
    if(PAD.just.confirm)deployFromUpgrade();
    updParts(dt); return;
  }
  if(ST.state==='ctrl'){ ST.ctrlT+=dt; ST.ctrlIdx=Math.floor(ST.ctrlT/1.7);
    if(PAD.just.left){ ST.ctrlMode=(ST.ctrlMode+2)%3; ST.ctrlT=ST.ctrlIdx*1.7; SFX.pick(); }
    if(PAD.just.right){ ST.ctrlMode=(ST.ctrlMode+1)%3; ST.ctrlT=ST.ctrlIdx*1.7; SFX.pick(); }
    if(PAD.just.confirm||PAD.just.back||PAD.just.pause)exitCtrlIntro();
    updParts(dt); return; }
  if(ST.state==='intro'){ ST.introT-=dt; if(ST.introT<=0){ST.state='play'; BGM.play(STAGE_MUSIC[RUN.lvl],true);} updParts(dt); return; }
  if(ST.state==='play'&&!MENU){
    if(window.AP&&AP.active)AP.tick(dt);   /* P3.5 资产场景: 爆炸脚本/炮塔随动/炮口灯 */
    cam.ox=cam.x; cam.oy=cam.y;   /* 相机插值快照 */
    updCombo(dt);
    ST.levelTime+=dt;
    if(PAD.just.pause){ openMenu('pause'); return; }
    updPlayer(dt); updEnemies(dt); updShots(dt); updPlanes(dt); updPickups(dt); updParts(dt); updWeather(dt);
    cam.x+=((clamp(player.x-VW/2,0,WORLDW-VW))-cam.x)*Math.min(1,dt*5);
    cam.y+=((clamp(player.y-VH/2,0,WORLDH-VH))-cam.y)*Math.min(1,dt*5);
    ST.shake=Math.max(0,ST.shake-dt*11);
  }
  else if(ST.state==='clear'){ ST.clearT+=dt; updParts(dt);
    if(PAD.just.confirm)afterClear();
    if(ST.clearT>4)afterClear(); }
  else if(ST.state==='over'){ ST.overT+=dt; updParts(dt); ST.shake=Math.max(0,ST.shake-dt*11);
    if(PAD.just.confirm)retryLevel();          /* A=重试本关 */
    else if(PAD.just.back)toTitle(); }         /* B=回标题 */
  else if(ST.state==='win'){ ST.winT+=dt; updWinFx(dt);
    if(PAD.just.confirm){ RUN.cycle++; RUN.lvl=0; saveRun(); startLevel(); }  /* A=下一周目 */
    else if(PAD.just.cannon){ refundAll(); ST.state='upgrade'; ST.upg={sel:0,from:'win'}; }  /* X=重分配 */
    else if(PAD.just.back)toTitle();           /* B=回标题 */
    if(!ST.creditsBgm&&ST.winT>4.8){ ST.creditsBgm=true; BGM.play('credits',true); } }
  else if(ST.state==='title'){ updTitleFx(dt); updParts(dt); }
}
let fwT=0;
function updWinFx(dt){
  fwT-=dt;
  if(fwT<=0){ fwT=rnd(0.25,0.6);
    const cols=[PAL.gold,PAL.red,PAL.blue,PAL.lime,PAL.white];
    const x=rnd(40,VW-40),y=rnd(30,VH*0.6);
    for(let i=0;i<36;i++){const a=rnd(Math.PI*2),s=rnd(20,85);
      part(x,y,Math.cos(a)*s,Math.sin(a)*s,rnd(0.6,1.3),cols[(rnd(cols.length))|0],rnd(1,2.5),26);} }
  updParts(dt);
}
let titleT=0;
function updTitleFx(dt){
  titleT+=dt;
  if(Math.random()<0.1){const x=rnd(20,VW-20);
    part(x,VH+4,rnd(-8,8),rnd(-30,-14),rnd(0.8,1.6),PAL.sand,rnd(1,2.5));}
}

/* ---------- 主绘制 ---------- */
function draw(alpha){
  gAlpha=alpha||0;
  TAP_RECTS=[];
  const hs=(MENU&&MENU.id==='help');
  /* 阶段1: 像素世界 → 离屏缓冲 */
  if(ST.state==='title'||ST.state==='ctrl'){ drawTitleBg(); if(hs)drawHelpScene(MENU.page,VW/2-80,34,160,84); }
  else if(ST.state==='intro'){ drawStageIntroBg(); }
  else { drawWorld(); if(ST.state==='win')drawWinBG(); }
  /* 阶段2: nearest-neighbor 放大到显示画布 */
  uctx.setTransform(1,0,0,1,0,0);
  uctx.imageSmoothingEnabled=false;
  uctx.drawImage(buf,0,0,cv.width,cv.height);
  uctx.setTransform(cv.width/VW,0,0,cv.height/VH,0,0);
  uctx.textBaseline='top';
  /* 阶段3: 高清UI层 */
  if(ST.state==='title'){ if(MENU)drawMenu(); if(errStr)txt('ERR:'+errStr,4,VH-30,8,PAL.red); return; }
  if(ST.state==='ctrl'){ drawCtrlIntro(); return; }
  drawFloats();
  if(ST.state==='play'||ST.state==='clear')drawHUD();
  if(ST.state==='intro')drawIntroCard();
  if(ST.state==='clear')drawClearCard();
  if(ST.state==='upgrade')drawUpgrade();
  if(ST.state==='over')drawOver();
  if(ST.state==='win'){ drawWin(); if(MENU)drawMenu(); return; }
  if(MENU){ uctx.globalAlpha=0.35; upx(0,0,VW,VH,PAL.ink); uctx.globalAlpha=1; drawMenu();
    if(MENU.id==='pause')drawPauseHint(); }
  if(errStr){ txt('ERR:'+errStr,4,VH-30,7,PAL.red); }
}
/* ---------- 调试/测试钩子 ---------- */
const DBG={god:false};
window.G={
  info(){ return {state:ST.state,menu:MENU?MENU.id:null,lang:SET.lang,diff:SET.diff,bgm:SET.bgm,se:SET.se,touch:SET.touch,
    hp:player?Math.round(player.hp):0,maxHp:player?Math.round(player.maxHp):0,
    combo:COMBO.n,comboTier:COMBO.tier,comboT:+COMBO.t.toFixed(2),od:COMBO.od,comboMul:+comboMul().toFixed(2),shotsFired,
    enemies:enemies.length,kills:ST.killsLevel,quota:cfg?cfg.quota:0,time:ST.levelTime,
    score:RUN.score,runKills:RUN.kills,pts:RUN.pts,cycle:RUN.cycle,lvl:RUN.lvl,
    up:JSON.parse(JSON.stringify(RUN.up)),eq:JSON.parse(JSON.stringify(RUN.eq)),
    bgmName:BGM.name,pad:PAD.gp?PAD.gp.index:-1,
    vkeys:[...VKEYS], alive:enemies.map(e=>({k:e.kind,b:e.boss,hp:Math.round(e.hp),x:Math.round(e.x),y:Math.round(e.y)}))}; },
  start(){ startNewGame(); },
  ctrl(){ enterCtrlIntro(); },
  dbg:DBG,
  skipTo(i){ RUN.lvl=clamp(i,0,6); startLevel(); },
  boss(){ ST.spawnedN=cfg.quota-1; enemies.filter(e=>!e.boss).forEach(e=>hurtEnemy(e,1e6,'shot')); },
  win(){ ST.killsLevel=cfg.quota; levelClear(); },
  hurt(){ player.hp=0; playerDie(); },
  reflectProbe(){ shot(player.x-46,player.y,0,150,10,false,'shell'); player.shieldT=0.42; player.shieldAge=0.42; return true; },
  parryProbe(perfect){ const s=shot(player.x-(perfect?14:46),player.y,0,150,10,false,'shell');
    player.shieldT=0.42; player.shieldAge=0; player.shieldCd=0; return s; },
  stats(){ return Object.assign({},STATS,{maxCombo:STATS.maxCombo,dmg:Object.assign({},STATS.dmg)}); },
  dummy(kind,x,y){ spawnEnemyAt(kind||'tank',false,x,y); return enemies[enemies.length-1]; },
  checkReflected(){ return shots.some(s=>s.refl&&s.friendly); },
  tp(x,y){ player.x=clamp(x,24,WORLDW-24); player.y=clamp(y,24,WORLDH-24); player.ox=player.x; player.oy=player.y;
    cam.x=clamp(player.x-VW/2,0,WORLDW-VW); cam.y=clamp(player.y-VH/2,0,WORLDH-VH); cam.ox=cam.x; cam.oy=cam.y; },
  perf(){ return {fps:PERF.fps,updateMs:+PERF.updateMs.toFixed(2),renderMs:+PERF.renderMs.toFixed(2),
    updates:PERF.updates,quality:PERF.quality,qLevel:PERF.qLevel,
    counts:{enemies:enemies.length,shots:shots.length,parts:parts.length,pickups:pickups.length}}; },
  set(k,v){ SET[k]=v; applyVolumes(); saveSet(); },
  dropTest(kind,eqk){ pickups.push({x:player.x+30,y:player.y,kind:kind||'part',eqk:eqk||'armor',val:1,t:30,bob:0}); },
  wipe(){ try{localStorage.removeItem('trSave');localStorage.removeItem('trSet');}catch(e){} },
  save(){ saveRun(); },
  run(){ return JSON.parse(JSON.stringify(RUN)); },
  menu(id){ openMenu(id,'title'); },
  /* ---------- 视觉回归固定场景 (视觉设计第一版 §15): 冻结刷兵/摆位/特效, 供自动截图 ---------- */
  visualScene(name){
    DBG.lab=true;
    if(name==='asset-pipeline')return AP.setupScene();   /* P3.5 资产管线验证场景 */
    if(name==='title'){ toTitle(); return 'title'; }
    const LV={combat:4,boss:0,units:4,explosion:4,hud:4,weather:2}[name];
    if(LV===undefined)return 'unknown:'+name;
    if(ST.state!=='play'||!cfg||RUN.lvl!==LV){ RUN.lvl=LV; startLevel(); }
    MENU=null; ST.state='play'; ST.introT=0; ST.spawnT=1e9; ST.spawnedN=cfg.quota-1;
    ST.shake=0; ST.flash=0; ST.bolt=null; ST.bossWarn=0; ST.bossSpawned=false;
    enemies.length=0; pickups.length=0; parts.length=0; floats.length=0; planes.length=0; bombs.length=0; shots.length=0;
    COMBO.n=0; COMBO.t=0; COMBO.tier=0; COMBO.od=false;
    const CX=WORLDW/2, CY=WORLDH/2;
    this.tp(CX,CY);
    player.vx=player.vy=0; player.a=-Math.PI/2; player.inv=0; player.flash=0;
    player.hp=player.maxHp=100; player.maxHp=100; player.shieldT=0; player.shieldGrace=0; player.breach=null;
    const pose=(kind,boss,dx,dy,a)=>{ spawnEnemyAt(kind,!!boss,CX+dx,CY+dy);
      const e=enemies[enemies.length-1]; e.a=a; e.stun=99; e.jitter=0;
      if(boss){ e.r=kind==='tank'?20:19; e.hp=e.maxHp=cfg.bossHp; } };
    const drop=(dx,dy,kind,eqk)=>pickups.push({x:CX+dx,y:CY+dy,kind,eqk:eqk||'armor',val:1,t:30,bob:rnd(6)});
    if(name==='combat'){
      pose('tank',0,0,-115,Math.PI/2); pose('tank',0,-135,-45,0);
      pose('truck',0,125,-75,Math.PI); pose('truck',0,75,95,Math.PI*0.85);
      pose('tank',0,-95,85,0.4); pose('truck',0,185,35,Math.PI);
      drop(-42,52,'heal'); drop(45,40,'part'); drop(10,-62,'eq','track'); drop(-70,-72,'part');
      shot(CX+30,CY-28,-0.6,150,10,true,'shell');
      shot(CX-58,CY-82,2.6,150,10,false,'shell');
      shot(CX+90,CY+40,Math.PI,260,3,true,'mg');
      COMBO.n=27; COMBO.tier=2; COMBO.t=5;
      for(let i=0;i<4;i++)part(CX+70+rnd(-8,8),CY-60+rnd(-8,8),rnd(2,6),rnd(-12,-6),2.2,PAL.dark,rnd(2.5,3.5));
      for(let i=0;i<16;i++)stampTracks(CX-14-i*6,CY+34-i*2.4,-0.38,false);   /* 玩家行驶轨迹压痕 */
      for(let i=0;i<8;i++)stampTracks(CX+118-i*5,CY-88+i*1.8,Math.PI*0.85,true);
      stampScorch(CX+128,CY+26,11); stampScorch(CX-142,CY-34,8);             /* 旧弹坑 */
    }
    else if(name==='boss'){
      pose('tank',1,95,55,Math.PI*0.8); pose('tank',0,-120,-60,0.2); pose('truck',0,135,-35,Math.PI);
      const b=enemies[0]; applyDamage(b,cfg.bossHp*0.38,'shot');             /* 打到62%: 验证ghost条 */
      COMBO.n=12; COMBO.tier=1; COMBO.t=5;
      ST.bossSpawned=true;
    }
    else if(name==='units'){
      player.shieldT=99;
      pose('tank',0,-150,-75,0); pose('truck',0,150,-75,Math.PI);
      pose('tank',1,-155,75,0.5); pose('truck',1,155,75,Math.PI*0.9);
      drop(-50,82,'heal'); drop(-20,82,'part'); drop(10,82,'eq','armor'); drop(40,82,'eq','fire'); drop(70,82,'eq','comp');
      shot(CX+22,CY-6,-0.3,120,46,true,'missile',{accel:200});
      COMBO.n=27; COMBO.tier=2; COMBO.t=5;
    }
    else if(name==='explosion'){
      pose('tank',0,-160,-90,0.3); pose('truck',0,170,80,Math.PI);
      flashFx(CX-110,CY+55,26,true);
      explodeAt(CX+80,CY-55,26,0,true);
      explodeAt(CX+96,CY-38,16,0,false);
      drop(20,60,'part');
    }
    else if(name==='hud'){
      pose('tank',0,-70,-100,Math.PI/2); pose('truck',0,120,-40,Math.PI); pose('tank',0,-125,60,0.2);
      pose('tank',1,215,-135,Math.PI*0.75); ST.bossSpawned=true;
      drop(50,50,'part'); drop(-40,40,'heal');
      COMBO.n=63; COMBO.tier=6; COMBO.t=5; COMBO.od=true;
    }
    else if(name==='weather'){
      pose('tank',0,-20,-110,Math.PI/2); pose('truck',0,130,60,Math.PI);
      drop(-55,35,'heal');
      ST.lightT=0.3;
    }
    cam.ox=cam.x; cam.oy=cam.y;
    return name+' lvl'+RUN.lvl+' enemies:'+enemies.length;
  },
};
try{ const _q=new URLSearchParams(location.search).get('scene'); if(_q)window.G.visualScene(_q); }catch(e){}
let errStr=null;
addEventListener('error',e=>{ errStr=(e.message||'unknown').slice(0,60); });
/* ---------- 主循环 (PHASE 2: 60Hz 固定逻辑 + rAF 插值渲染) ---------- */
function drawPerfOverlay(){
  txt('FPS '+PERF.fps+'  U '+PERF.updateMs.toFixed(2)+'ms  R '+PERF.renderMs.toFixed(2)+'ms',VW-6,58,8,PAL.white,'right');
  txt('E'+enemies.length+' S'+shots.length+' P'+parts.length+' PK'+pickups.length+'  Q'+PERF.qLevel+'('+PERF.quality+')',VW-6,68,8,PAL.lite,'right');
  txt('updates '+PERF.updates,VW-6,78,8,PAL.lite,'right');
}
startGameLoop(function(dt){ tick(dt); }, function(alpha){ draw(alpha); if(PERF.show)drawPerfOverlay(); });
