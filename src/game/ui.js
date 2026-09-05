"use strict";
/* Bright Japanese tactical UI palette, isolated from combat/IFF colors. */
const UIC={ink:'#203e52',text:'#476276',muted:'#657e8b',cyan:'#007f9f',gold:'#a56b17',paper:'#edf3f2'};
/* game/ui — 菜单模型/触屏/整备画面 */
/* ============================================================
   菜单系统 (键盘/手柄/触屏通用)
   ============================================================ */
function openMenu(id,from){ MENU={id,sel:0,page:0,capture:null,from:from||null}; }
/* ---------- 输入方式感知提示 (手柄/触屏/键盘) ---------- */
function navHintDyn(){
  const m=inMode();
  if(m==='pad')return TF('navHintP',{c:padBtnName(SET.pad.confirm),b:padBtnName(SET.pad.back)});
  if(m==='touch')return T('navHintT');
  return T('navHint');
}
function skipDyn(){
  const m=inMode();
  if(m==='pad')return TF('skipP',{k:padBtnName(SET.pad.confirm)});
  if(m==='touch')return T('skipT');
  return T('skip');
}
function contDyn(){
  const m=inMode();
  if(m==='pad')return TF('contP',{k:padBtnName(SET.pad.confirm)});
  if(m==='touch')return T('contT');
  return T('pressCont');
}
/* 失败/通关画面提示: 随输入方式切换 (手柄 A/B/X · 触屏点按 · 键盘 R/Q/Enter) */
function overRDyn(){
  const m=inMode();
  if(m==='pad')return TF('overRP',{k:padBtnName(SET.pad.confirm)});
  if(m==='touch')return T('overTP');
  return T('overR');
}
function overQDyn(){
  const m=inMode();
  if(m==='touch')return '';
  if(m==='pad')return TF('overQP',{k:padBtnName(SET.pad.back)});
  return T('overQ');
}
function winOptDyn(){
  const m=inMode();
  if(m==='pad')return TF('winOptP',{c:padBtnName(SET.pad.confirm),x:padBtnName(SET.pad.cannon),b:padBtnName(SET.pad.back),n:RUN.cycle+2});
  if(m==='touch')return TF('winOptT',{n:RUN.cycle+2});
  return TF('winOpt',{n:RUN.cycle+2});
}
function menuBack(){
  if(!MENU)return;
  const from=MENU.from;
  if(MENU.id==='pause'){ MENU=null; return; }
  if(MENU.capture){ MENU.capture=null; return; }
  if(MENU.id==='controls'){openMenu('option',ST.state==='title'?'title':'pause');return;}
  if(from==='hull'){openMenu('hull',ST.flow==='ngplus'?'win':'title');return;}
  if(from==='win'){ST.flow=null;ST.state='win';MENU=null;return;}
  if(from==='pause')openMenu('pause');
  else openMenu('title');
}
function volBlocks(v){ if(v===0)return T('volOff'); return '▮'.repeat(v)+'▯'.repeat(4-v); }
/* padmap 行的动作名 (engine 改键成功 toast 也用它); 帮助页标题去掉 [J] 类后缀 */
function padActLabel(a){
  const lbls={mg:'h1t',cannon:'h2t',msl:'h3t',strike:'h4t',sprint:'h5t',shield:'h6t',lock:'mgLock',pause:'padPause'};
  return lbls[a]?T(lbls[a]).replace(/\s*\[.*/,''):(a==='confirm'?'⏎ OK':'⎋ '+T('back'));
}
function menuItems(id){
  const its=[];
  if(id==='title'){
    its.push({label:'mNew',enter:()=>startNewGame()});
    if(hasSave())its.push({label:'mCont',enter:()=>continueGame()});
    its.push({label:'mOpt',enter:()=>openMenu('option','title')});
    its.push({label:'mHelp',enter:()=>openMenu('help','title')});
    if(ST.debugActive)its.push({label:'mDebug',enter:()=>openMenu('debug','title')});
    return its;
  }
  if(id==='hull'){
    for(const k of HULL_KEYS)
      its.push({choice:1,enter:()=>{RUN.hull=k; openMenu('wingman','hull');
        MENU.sel=WING_KEYS.indexOf(HULL_M2W[RUN.hull]);},
        labelFn:()=>T(HULLS[k].i18n)+(k===RUN.hull?' ◀':''),
        value:()=>''});
    its.push({label:'back',enter:()=>menuBack()});
    return its;
  }
  if(id==='wingman'){
    for(const k of WING_KEYS)
      its.push({choice:1,enter:()=>{RUN.wing=k; enterCtrlIntro();},
        labelFn:()=>(k==='none'?T('wN'):T(WINGS[k].i18n))+(k===HULL_M2W[RUN.hull]?' ★':'')+(k===RUN.wing?' ◀':''),
        value:()=>''});
    its.push({label:'back',enter:()=>menuBack()});
    return its;
  }
  if(id==='debug'){
    if(!ST.dbg)ST.dbg={hpBonus:0,atk:1,defBonus:0,spd:1};
    its.push({label:'dbgGod',choice:1,value:()=>DBG.god?T('on'):T('off'),delta:()=>{DBG.god=!DBG.god;}});
    its.push({label:'dbgHp',choice:1,value:()=>'+'+(ST.dbg.hpBonus|0)+' → '+calcStats().maxHp,delta:d=>{ST.dbg.hpBonus=clamp(ST.dbg.hpBonus+d*50,0,900);}});
    its.push({label:'dbgAtk',choice:1,value:()=>'x'+ST.dbg.atk,delta:d=>{const a=[1,2,3,5];ST.dbg.atk=a[clamp(a.indexOf(ST.dbg.atk)+d,0,3)];}});
    its.push({label:'dbgDef',choice:1,value:()=>Math.round(ST.dbg.defBonus*100)+'%',delta:d=>{ST.dbg.defBonus=clamp(ST.dbg.defBonus+d*0.15,0,0.8);}});
    its.push({label:'dbgSpd',choice:1,value:()=>'x'+ST.dbg.spd,delta:d=>{const sp=[1,1.5,2];ST.dbg.spd=sp[clamp(sp.indexOf(ST.dbg.spd)+d,0,2)];}});
    its.push({label:'back',enter:()=>menuBack()});
    return its;
  }
  if(id==='pause'){
    its.push({label:'resume',enter:()=>{MENU=null;}});
    its.push({label:'mHelp',enter:()=>openMenu('help','pause')});
    its.push({label:'settings',enter:()=>openMenu('option','pause')});
    its.push({label:'quitTitle',enter:()=>toTitle()});
    return its;
  }
  if(id==='controls'){
    its.push({label:'aimSetting',choice:1,value:()=>T('aim_'+aimMode()),delta:d=>setAimMode(AIM_MODES[(AIM_MODES.indexOf(aimMode())+d+3)%3])});
    its.push({label:'autoFire',choice:1,value:()=>T(SET.autoFire?'on':'off'),delta:()=>{SET.autoFire=!SET.autoFire;saveSet();}});
    its.push({label:'shakeSetting',choice:1,value:()=>T(SET.shake===0?'off':SET.shake===0.5?'reduced':'standard'),delta:d=>{const a=[0,0.5,1];SET.shake=a[(a.indexOf(SET.shake)+d+3)%3];saveSet();}});
    its.push({label:'back',enter:()=>openMenu('option',ST.state==='title'?'title':'pause')});return its;
  }
  if(id==='option'){
    its.push({label:'lang',choice:1,value:()=>({zh:'中文',ja:'日本語',en:'EN'})[SET.lang],
      delta:d=>{const i=LANGS.indexOf(SET.lang);SET.lang=LANGS[(i+d+3)%3];saveSet();}});
    /* 触屏点按只会 +1: 选项一律循环 (与语言/虚拟按钮一致), 触屏用户才能往回调 (页面导览实测bug) */
    its.push({label:'diff',choice:1,value:()=>I18N[SET.lang].diffNames[SET.diff],
      delta:d=>{SET.diff=(SET.diff+d+5)%5;saveSet();}});
    its.push({label:'bgm',choice:1,value:()=>volBlocks(SET.bgm),delta:d=>{SET.bgm=(SET.bgm+d+5)%5;applyVolumes();saveSet();}});
    its.push({label:'se',choice:1,value:()=>volBlocks(SET.se),delta:d=>{SET.se=(SET.se+d+5)%5;applyVolumes();saveSet();if(SET.se>0)SFX.pick();}});
    its.push({label:'vtouch',choice:1,value:()=>SET.touch==='auto'?T('auto'):(SET.touch==='on'?T('on'):T('off')),
      delta:()=>{SET.touch=SET.touch==='auto'?'on':(SET.touch==='on'?'off':'auto');saveSet();}});
    its.push({label:'controls',enter:()=>openMenu('controls','option')});
    its.push({label:'padmap',enter:()=>openMenu('padmap',MENU.from)});
    its.push({label:'restore',enter:()=>{SET=JSON.parse(JSON.stringify(SET_DEF));applyVolumes();saveSet();showToast(T('restored'));}});
    its.push({label:'back',enter:()=>menuBack()});
    return its;
  }
  if(id==='padmap'){
    const acts=['mg','cannon','msl','strike','sprint','shield','lock','pause','confirm','back'];
    for(const a of acts){
      its.push({choice:1,act:a,
        labelFn:()=>padActLabel(a),
        value:()=>padBtnName(SET.pad[a]),
        delta:0,
        enter:()=>{MENU.capture={act:a};}});
    }
    its.push({label:'restore',enter:()=>{SET.pad=JSON.parse(JSON.stringify(SET_DEF.pad));saveSet();showToast(T('restored'));}});
    its.push({label:'back',enter:()=>menuBack()});
    return its;
  }
  return its;
}
function menuMove(d){ const n=menuItems(MENU.id).length; MENU.sel=(MENU.sel+d+n)%n; SFX.pick(); }
function menuAdjust(d){ const it=menuItems(MENU.id)[MENU.sel];
  if(MENU.id==='help'){ MENU.page=(MENU.page+d+HELP_PAGES)%HELP_PAGES; return; }
  if(it&&it.choice&&it.delta)it.delta(d); }
function menuActivate(){ const its=menuItems(MENU.id),it=its[MENU.sel];
  if(!it)return;
  if(it.choice&&it.delta){it.delta(1);return;}
  if(it.enter)it.enter();
}
function menuKey(code){
  if(MENU.capture){ if(code==='Escape')MENU.capture=null; return; }
  if(MENU.id==='help'){
    if(code==='ArrowLeft'||code==='KeyA')menuAdjust(-1);
    else if(code==='ArrowRight'||code==='KeyD')menuAdjust(1);
    else if(code==='Escape'||code==='Backspace'||code==='Enter')menuBack();
    return;
  }
  switch(code){
    case 'ArrowUp': case 'KeyW': menuMove(-1); break;
    case 'ArrowDown': case 'KeyS': menuMove(1); break;
    case 'ArrowLeft': case 'KeyA': menuAdjust(-1); break;
    case 'ArrowRight': case 'KeyD': menuAdjust(1); break;
    case 'Enter': case 'KeyJ': case 'Space': menuActivate(); break;
    case 'Escape': case 'Backspace': menuBack(); break;
    case 'KeyP': if(MENU.id==='pause')MENU=null; break;
  }
}
/* ---------- 整备(升级)画面输入 ---------- */
const UPG_KEYS=['hp','spd','atk','def','cdr','wgFire','wgHp','wgRate','wgIntercept'];
const UPG_MAP={wgFire:['firepower','wing'],wgHp:['health','wing'],wgRate:['rate','wing'],wgIntercept:['intercept','wing']};
const UPG_HOLD={key:null,delta:0,t:0,next:0};
function upgValue(key){const m=UPG_MAP[key];return m?(RUN.wingmanGrowth||wingGrowthDef())[m[0]]:RUN.up[key];}
function upgCap(key){
  if(key==='cdr')return 21;
  if(key==='def')return Math.max(0,Math.ceil((0.85-0.04*RUN.eq.comp-1e-9)/0.06));
  return 30;
}
function upgAdjust(key,d){
  const v=upgValue(key); if(d>0&&RUN.pts>0&&v<upgCap(key)){RUN.pts--;if(UPG_MAP[key])RUN.wingmanGrowth[UPG_MAP[key][0]]++;else RUN.up[key]++;SFX.pick();}
  if(d<0&&v>0){RUN.pts++;if(UPG_MAP[key])RUN.wingmanGrowth[UPG_MAP[key][0]]--;else RUN.up[key]--;SFX.pick();}
}
function startUpgradeHold(key,d,source,code){UPG_HOLD.source=source||'touch';UPG_HOLD.code=code;upgAdjust(key,d);UPG_HOLD.key=key;UPG_HOLD.delta=d;UPG_HOLD.t=0;UPG_HOLD.next=0.42;}
function stopUpgradeHold(){UPG_HOLD.key=null;UPG_HOLD.delta=0;}
function tickUpgradeHold(dt){if(!UPG_HOLD.key)return;if(ST.state!=='upgrade'||MENU||(UPG_HOLD.source==='keyboard'&&!keys.has(UPG_HOLD.code))||(UPG_HOLD.source==='pad'&&!PAD.hold[UPG_HOLD.code])){stopUpgradeHold();return;}UPG_HOLD.t+=dt;if(UPG_HOLD.t<UPG_HOLD.next)return;UPG_HOLD.next+=0.075;upgAdjust(UPG_HOLD.key,UPG_HOLD.delta);}
function upgKey(code){
  switch(code){
    case 'ArrowUp': case 'KeyW': stopUpgradeHold();ST.upg.sel=(ST.upg.sel+UPG_KEYS.length-1)%UPG_KEYS.length; SFX.pick(); break;
    case 'ArrowDown': case 'KeyS': stopUpgradeHold();ST.upg.sel=(ST.upg.sel+1)%UPG_KEYS.length; SFX.pick(); break;
    case 'ArrowRight': case 'KeyD': startUpgradeHold(UPG_KEYS[ST.upg.sel],1,'keyboard',code); break;
    case 'ArrowLeft': case 'KeyA': startUpgradeHold(UPG_KEYS[ST.upg.sel],-1,'keyboard',code); break;
    case 'Enter': case 'KeyJ': deployFromUpgrade(); break;
    case 'KeyR': refundAll(); SFX.heal(); break;
  }
}
addEventListener('keyup',e=>{if(UPG_HOLD.source==='keyboard'&&UPG_HOLD.code===e.code)stopUpgradeHold();});
addEventListener('pointerup',stopUpgradeHold); addEventListener('pointercancel',stopUpgradeHold); addEventListener('blur',stopUpgradeHold);

/* ---------- 菜单绘制 ---------- */
function drawTitleMenu(its){
  const im=window.V18UIR&&V18UIR.bg('title');
  if(im){uctx.save();uctx.imageSmoothingEnabled=true;uctx.drawImage(im,0,0,VW,VH);uctx.restore();}
  const shade=uctx.createLinearGradient(0,0,310,0);shade.addColorStop(0,'rgba(241,246,243,0.97)');shade.addColorStop(0.57,'rgba(238,245,243,0.85)');shade.addColorStop(1,'rgba(238,245,243,0)');uctx.fillStyle=shade;uctx.fillRect(0,0,VW,VH);
  txt('ARMORED COMBAT / 07',23,20,6,UIC.cyan);
  const metal=uctx.createLinearGradient(0,35,0,66);metal.addColorStop(0,'#526f82');metal.addColorStop(0.46,'#2b4b60');metal.addColorStop(0.5,'#203e52');metal.addColorStop(1,'#446579');
  uctx.save();uctx.font='italic 900 32px '+FONT;uctx.fillStyle=metal;uctx.fillText('STEEL ROAR',20,35,217);uctx.restore();
  txt(T('gameTitle'),24,72,11,UIC.ink);upx(24,91,24,1,UIC.gold);txt(T('tag'),55,88,6,UIC.text);
  const icons={mNew:1,mCont:4,mOpt:6,mHelp:7,mDebug:6},sub={mNew:'NEW CAMPAIGN',mCont:'RESUME MISSION',mOpt:'SYSTEM SETTINGS',mHelp:'FIELD MANUAL',mDebug:'DEBUG'};
  const row=its.length>4?25:29,y0=107;
  its.forEach((it,i)=>{const y=y0+i*row,c=i===0?UIC.gold:UIC.cyan,sel=MENU.sel===i;
    uPanel(23,y,181,row-4,c,0.96);
    if(sel){const gr=uctx.createLinearGradient(23,y,204,y);gr.addColorStop(0,rgba(c,0.26));gr.addColorStop(1,rgba(c,0.03));uctx.fillStyle=gr;uctx.fillRect(26,y+3,175,row-10);upx(23,y+7,2,row-18,c);}
    if(it.label==='mHelp')txt('?',38,y+5,12,UIC.cyan,'center');
    else if(it.label==='mOpt'){const cy=y+(row-4)/2;uctx.save();uctx.strokeStyle=UIC.cyan;uctx.lineWidth=1.5;uctx.beginPath();uctx.arc(38,cy,4,0,Math.PI*2);uctx.stroke();for(let k=0;k<8;k++){const a=k*Math.PI/4;uctx.beginPath();uctx.moveTo(38+Math.cos(a)*4,cy+Math.sin(a)*4);uctx.lineTo(38+Math.cos(a)*6,cy+Math.sin(a)*6);uctx.stroke();}uctx.restore();}
    else if(window.V18UIR)V18UIR.icon(uctx,icons[it.label],38,y+(row-4)/2,15,{variant:'tint',tint:c});
    txt(T(it.label).replace(/^▶\s*/,''),54,y+4,10,sel?c:UIC.ink);
    txt(sub[it.label]||'',55,y+16,4.8,sel?UIC.text:UIC.muted);
    txt('›',192,y+7,11,sel?c:UIC.muted,'center');
    MENU_RECTS.push({x:23,y,w:181,h:row-4,act:()=>{MENU.sel=i;it.enter();}});
  });
  txt(navHintDyn(),24,249,6,UIC.text);
  if(ST.best>0)txt(TF('best',{n:ST.best}),VW-18,249,6,UIC.gold,'right');
  else txt('STEEL / FIRE / SURVIVE',VW-18,249,6,UIC.text,'right');
  upx(24,241,VW-48,0.5,'rgba(151,177,181,0.3)');
}
function drawMenu(){
  MENU_RECTS=[];
  const id=MENU.id;
  if(id==='help'){ drawHelp(); return; }
  const its=menuItems(id);
  if(id==='title'){drawTitleMenu(its);return;}
  upx(0,0,VW,VH,'rgba(219,233,235,0.90)');
  const titles={title:'',option:'OPTION',padmap:T('padmap'),pause:T('pauseT'),hull:T('hullT'),wingman:T('wingT'),debug:T('mDebug')};
  const W=id==='controls'?350:id==='option'?330:300, rowH=id==='controls'?27:id==='padmap'?16:id==='option'?20:22, headH=28;
  const H=headH+its.length*rowH+(id==='controls'?32:24);
  const x=id==='title'?24:(VW-W)/2, y=id==='title'?118:(VH-H)/2+4;
  uPanel(x-3,y-3,W+6,H+6,id==='pause'?UIC.cyan:UIC.gold,id==='title'?0.66:0.82);   /* 标题选单: 低透明露出封面, 但保住玻璃渐变层次 */
  upx(x+7,y+headH-8,W-14,1,PAL.rail);
  const title=id==='controls'?T('controls'):id==='option'?'OPTION':T(id==='padmap'?'padmap':id==='pause'?'pauseT':id==='hull'?'hullT':id==='wingman'?'wingT':id==='debug'?'mDebug':id);
  if(id!=='title')txt(title,x+W/2,y+8,10,UIC.gold,'center');
  if(id==='title')txt(T('gameTitle'),VW/2,18,23,UIC.gold,'center');
  if(id==='title')txt(T('sub'),VW/2,43,11,UIC.ink,'center');
  if(id==='title')txt(T('tag'),VW/2,58,7,UIC.cyan,'center');
  if(id==='title'&&ST.best>0)txt(TF('best',{n:ST.best}),VW/2,67,7,UIC.gold,'center');
  const y0=y+headH;
  its.forEach((it,i)=>{
    const iy=y0+i*rowH;
    const lbl=(it.labelFn?it.labelFn():(it.label==='restore'?T('restore'):it.label==='back'?T('back'):T(it.label)));
    const sel=MENU.sel===i;
    upx(x+12,iy-3,W-24,rowH-2,sel?'rgba(0,132,170,0.12)':'rgba(255,255,255,0.32)');
    upx(x+12,iy+rowH-5,W-24,0.5,'rgba(165,190,196,0.12)');
    if(sel){upx(x+12,iy-3,2,rowH-2,UIC.cyan);txt('›',x+18,iy,8,UIC.cyan);}
    const label=lbl.startsWith('▶')?lbl.slice(1):lbl;
    txt(label,x+32,iy,8,sel?UIC.ink:UIC.text);
    MENU_RECTS.push({x:x+6,y:iy-3,w:W-12,h:rowH-3,act:p=>{
      MENU.sel=i;
      if(MENU.id==='padmap'&&it.act){MENU.capture={act:it.act};return;}
      if(it.choice&&it.delta){
        const d=p&&p.pointerType==='touch'&&p.x<x+W*0.56?-1:1;
        it.delta(d); return;
      }
      if(it.enter)it.enter();
    }});
    if(it.choice){
      /* 正在捕获绑定的行: 值闪烁为 ? */
      const waiting=MENU.id==='padmap'&&MENU.capture&&MENU.capture.act===it.act&&((performance.now()/300|0)%2===0);
      txt('‹ '+(waiting?'?':it.value())+' ›',x+W-20,iy,8,sel?UIC.cyan:UIC.text,'right');
    }
  });
  let foot='';
  if(id==='padmap')foot=PAD.gp?(PAD.gp.id||'').slice(0,26):T('padNone');
  if(MENU.capture)foot=T('padWait');
  if(id==='option'&&MENU.sel===1)foot=T('diffTip');
  if(id==='hull'&&HULL_KEYS[MENU.sel])foot=T(HULLS[HULL_KEYS[MENU.sel]].i18n+'_f');
  if(id==='wingman'){const k=WING_KEYS[MENU.sel];if(k)foot=T((k==='none'?'wN':WINGS[k].i18n)+'_f');}
  if(id==='controls')foot=T('aimHint_'+aimMode());
  txt(foot||navHintDyn(),x+W/2,y+H-22,8,foot&&MENU.capture?UIC.gold:UIC.text,'center');
  if(id==='title'){
    uPanel(VW/2-134,VH-28,268,20,UIC.cyan,0.58);
    /* 底部输入模式条: 高亮当前生效模式 */
    const m=inMode(),segs=[['KEYBOARD','key'],['GAMEPAD','pad'],['TOUCH','touch']];
    uctx.font='bold 7px '+FONT;
    let sx=VW/2;
    for(const s of segs)sx-=uctx.measureText(s[0]).width+9;
    for(const [label,mode] of segs){
      txt(label,sx,VH-22,7,mode===m?UIC.gold:UIC.text);
      sx+=uctx.measureText(label).width+9;
    }
  }
}
const HELP_PAGES=14;   /* v1.8 W8: 页数收口 (原4处硬编码) */
function drawHelp(){
  const pg=MENU.page;
  uctx.globalAlpha=0.82; upx(0,0,VW,VH,UIC.paper); uctx.globalAlpha=1;
  uPanel(22,8,VW-44,VH-22,UIC.cyan,0.68);
  /* 标题动态按键提示: 手柄模式显示手柄键名, 触屏模式不显示键名 */
  const HELP_ACTS={1:'mg',2:'cannon',3:'msl',4:'strike',5:'sprint',6:'shield',7:'lock'};
  let ht=T('h'+pg+'t').replace(/\s*\[.*\]/,'');
  const kh=keyHint(HELP_ACTS[pg]);
  if(kh)ht+=' ['+kh+']';
  txt(ht,VW/2,14,13,UIC.gold,'center');
  const hsx=VW/2-100,hsy=28,hsw=200,hsh=96;   /* v1.5: 场景窗扩大承载 v15 精绘 */
  drawGuideScene(uctx,pg,hsx,hsy,hsw,hsh);
  uctx.strokeStyle=UIC.muted; uctx.lineWidth=1;
  uctx.strokeRect(hsx+0.5,hsy+0.5,hsw-1,hsh-1);
  const lines=wrapTxt(T('h'+pg+'d'),306,9);
  uPanel(VW/2-172,130,344,lines.length*12+20,UIC.gold,0.72);
  lines.forEach((l,i)=>txt(l,VW/2,140+i*12,9,UIC.ink,'center'));
  /* v1.8 W8: 触屏=可见实体翻页钮+返回钮(全侧边隐形热区保留); 键盘/手柄=原文字箭头 */
  if(inMode()==='touch'){
    uPanel(24,VH/2-15,32,30,UIC.cyan,0.62); txt('‹',40,VH/2-7,15,UIC.ink,'center');
    uPanel(VW-56,VH/2-15,32,30,UIC.cyan,0.62); txt('›',VW-40,VH/2-7,15,UIC.ink,'center');
    uPanel(VW/2-44,VH-38,88,18,UIC.gold,0.62); txt('✕ '+T('back'),VW/2,VH-33,8,UIC.ink,'center');
    MENU_RECTS.push({x:VW/2-44,y:VH-38,w:88,h:18,act:()=>menuBack()});
  } else {
    txt('‹',36,VH/2,16,UIC.gold,'center');
    txt('›',VW-36,VH/2,16,UIC.gold,'center');
  }
  txt((pg+1)+'/'+HELP_PAGES,VW-72,VH-28,8,UIC.text,'center');
  const bk=inMode()==='pad'?(keyHint('back')||'B'):'Esc';
  if(inMode()!=='touch')txt(T('back')+': '+bk,VW/2,VH-14,7,UIC.muted,'center');
  MENU_RECTS.push({x:0,y:0,w:80,h:VH,act:()=>{MENU.page=(MENU.page+HELP_PAGES-1)%HELP_PAGES;}});
  MENU_RECTS.push({x:VW-80,y:0,w:80,h:VH,act:()=>{MENU.page=(MENU.page+1)%HELP_PAGES;}});
  MENU_RECTS.push({x:80,y:0,w:VW-160,h:30,act:()=>menuBack()});
}
/* ---------- 整备画面 ---------- */
function upgradeEffect(key){
  const v=upgValue(key),st=calcStats(),g=RUN.wingmanGrowth||wingGrowthDef(),w=WINGS[RUN.wing]||WINGS.flex;
  if(key==='hp')return st.maxHp+' HP';
  if(key==='spd')return Math.round(st.speed)+' px/s';
  if(key==='atk')return '×'+st.atk.toFixed(2);
  if(key==='def')return Math.round(st.def*100)+'%';
  if(key==='cdr')return (5*st.cdMul).toFixed(2)+'s '+T('skStrike');
  if(key==='wgFire')return '×'+(1+0.10*g.firepower).toFixed(2);
  if(key==='wgHp')return Math.round(st.maxHp*w.hp*(1+0.08*g.health))+' HP';
  if(key==='wgRate')return (6.25*(1+0.08*g.rate)).toFixed(1)+'/s';
  return (70+g.intercept*4)+' px';
}
function upgradeNext(key){
  if(upgValue(key)>=upgCap(key))return T('upMax');
  const map=UPG_MAP[key],obj=map?RUN.wingmanGrowth:RUN.up,k=map?map[0]:key;
  obj[k]++;try{return upgradeEffect(key);}finally{obj[k]--;}
}
function drawUpgrade(){
  TAP_RECTS=[];
  const dep=window.V18UIR&&V18UIR.bg('dep');
  if(dep){uctx.imageSmoothingEnabled=true;uctx.drawImage(dep,0,0,VW,VH);}else upx(0,0,VW,VH,UIC.paper);
  upx(0,0,VW,VH,'rgba(226,237,234,0.62)');
  txt('STEEL ROAR / FIELD REFIT',14,12,7,UIC.ink);
  const v=hullCfg().vis||{};
  txt(T(HULLS[RUN.hull].i18n),119,32,10,UIC.gold,'center');
  if(window.V18UIR)V18UIR.badge(uctx,119,131,174,{ta:-Math.PI/2+Math.sin(ST.t*0.6)*0.55});
  txt(v.callsign||'IRONCLAD-07',119,219,8,UIC.cyan,'center');
  const PX=242,PW=230,PCX=PX+PW/2;
  uPanel(PX,8,PW,254,UIC.gold,0.92);
  txt(T('upgT'),PCX,18,13,UIC.gold,'center');
  txt(T('upgPts')+': '+RUN.pts,PCX,38,10,UIC.ink,'center');
  const group=ST.upg.sel>=5?1:0;
  for(let i=0;i<2;i++){
    const x=PX+12+i*105;uPanel(x,57,100,23,i===group?UIC.gold:UIC.muted,0.8);
    txt(T(i?'upWing':'upHull'),x+50,65,8,i===group?UIC.gold:UIC.text,'center');
    TAP_RECTS.push({x,y:57,w:100,h:23,act:()=>{stopUpgradeHold();ST.upg.sel=i?5:0;}});
  }
  const labels=['upgHp','upgSpd','upgAtk','upgDef','upgCdr','upgWFire','upgWHp','upgWRate','upgWIntercept'];
  const start=group?5:0,end=group?9:5;
  for(let i=start;i<end;i++){
    const key=UPG_KEYS[i],lv=upgValue(key),cap=upgCap(key),y=86+(i-start)*19,sel=ST.upg.sel===i;
    upx(PX+10,y-1,PW-20,18,sel?'rgba(0,132,170,0.12)':'rgba(255,255,255,0.4)');
    for(let j=0;j<10;j++)upx(PX+17+j*9,y+14,7,1,j<Math.ceil(lv/cap*10)?UIC.cyan:PAL.rail);
    txt(T(labels[i]),PX+16,y+4,8,sel?UIC.ink:UIC.text);
    txt('Lv'+lv,PX+138,y+4,7,lv>=cap?UIC.gold:UIC.text,'right');
    const minus={x:PX+145,y:y-1,w:30,h:18},plus={x:PX+181,y:y-1,w:30,h:18};
    for(const [q,d] of [[minus,-1],[plus,1]]){
      const enabled=d<0?lv>0:RUN.pts>0&&lv<cap;
      upx(q.x,q.y,q.w,q.h,enabled?'rgba(0,137,169,0.18)':'rgba(173,188,192,0.28)');
      txt(d<0?'−':'+',q.x+q.w/2,y+1,12,enabled?UIC.ink:UIC.muted,'center');
      TAP_RECTS.push({...q,act:p=>{ST.upg.sel=i;if(p&&p.pointerType==='touch')startUpgradeHold(key,d);else upgAdjust(key,d);}});
    }
    TAP_RECTS.push({x:PX+10,y:y-1,w:132,h:18,act:()=>{stopUpgradeHold();ST.upg.sel=i;}});
  }
  const key=UPG_KEYS[ST.upg.sel];
  upx(PX+12,187,PW-24,1,PAL.rail);
  txt(upgradeEffect(key)+'  →  '+upgradeNext(key),PCX,194,8,UIC.cyan,'center');
  if(group&&key==='wgIntercept'&&RUN.wing==='assault')txt(T('guardOnly'),PCX,207,7,UIC.gold,'center');
  else if(ST.upg.from==='win')txt(TF('nextCycle',{n:RUN.cycle+2}),PCX,207,7,UIC.text,'center');
  txt(T('upHoldHint'),PCX,219,6,UIC.text,'center');
  uAction(PX+14,230,PW-28,23,T('deploy')+'  »',UIC.gold,true);
  TAP_RECTS.push({x:PX+14,y:230,w:PW-28,h:23,act:()=>deployFromUpgrade()});
  uPanel(10,240,216,22,UIC.cyan,0.85);txt(T('upgRefund'),118,247,8,UIC.ink,'center');
  TAP_RECTS.push({x:10,y:240,w:216,h:22,act:()=>{stopUpgradeHold();refundAll();SFX.heal();}});
}

/* Control introduction shares current unit art and all 9 actions. */
const CTRL_ACTS=[
  {id:'move',  t:'cMove',  scene:0},
  {id:'mg',    t:'cMg',    scene:1},
  {id:'cannon',t:'cCannon',scene:2},
  {id:'msl',   t:'cMsl',   scene:3},
  {id:'strike',t:'cStrike',scene:4},
  {id:'sprint',t:'cSprint',scene:5},
  {id:'shield',t:'cShield',scene:6},
  {id:'lock',  t:'mgLock', scene:1},
  {id:'pause', t:'cPause', scene:-1}];
function ctrlKeyOf(a,mode){
  if(mode===0){ const bi=SET.pad[a]; return bi>=0?padBtnName(bi):''; }
  if(mode===1)return '';
  return KEY_NAMES[a]||'';
}
function ctrlRing(cx,cy,r){
  const p=0.5+0.5*Math.sin(ST.t*6);
  uctx.strokeStyle=rgba(UIC.gold,0.35+0.55*p);
  uctx.lineWidth=1.5;
  uctx.beginPath(); uctx.arc(cx,cy,r+1.5+2.5*p,0,Math.PI*2); uctx.stroke();
}
function ctrlBtn(cx,cy,r,label,hot,dim){
  uctx.fillStyle=hot?rgba(UIC.gold,0.30):rgba(PAL.panel,0.92);
  uctx.beginPath(); uctx.arc(cx,cy,r,0,Math.PI*2); uctx.fill();
  uctx.strokeStyle=hot?UIC.gold:(dim?PAL.rail:UIC.muted); uctx.lineWidth=1;
  uctx.beginPath(); uctx.arc(cx,cy,r,0,Math.PI*2); uctx.stroke();
  txt(label,cx,cy-3,7,hot?UIC.ink:(dim?PAL.rail:UIC.text),'center');
  if(hot)ctrlRing(cx,cy,r);
}
function ctrlKeycap(cx,cy,w,h,label,hot){
  upx(cx,cy,w,h,hot?rgba(UIC.gold,0.30):PAL.panel);
  uctx.strokeStyle=hot?UIC.gold:UIC.muted; uctx.lineWidth=1;
  uctx.strokeRect(cx+0.5,cy+0.5,w-1,h-1);
  txt(label,cx+w/2,cy+h/2-3,7,hot?UIC.ink:UIC.text,'center');
  if(hot)ctrlRing(cx+w/2,cy+h/2,Math.max(w,h)/2);
}
/* 实况演示窗(边框, 不填充): 画面由 draw() 阶段1 直接画进 buf */
function ctrlWindow(x,y,w,h){
  uctx.strokeStyle=rgba(UIC.cyan,0.64); uctx.lineWidth=1;
  uctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
  upx(x,y,12,1,UIC.cyan); upx(x,y,1,12,UIC.cyan);
  upx(x+w-12,y+h-1,12,1,UIC.cyan); upx(x+w-1,y+h-12,1,12,UIC.cyan);
}
function drawCtrlIntro(){
  const mode=ST.ctrlMode||0;                      /* 0=pad 1=touch 2=key */
  const idx=ST.ctrlIdx%CTRL_ACTS.length;
  const act=CTRL_ACTS[idx], hot=act.id;
  uctx.globalAlpha=0.82; upx(0,0,VW,VH,UIC.paper); uctx.globalAlpha=1;
  /* 标题 */
  txt(T('ctrlT'),VW/2,8,14,UIC.gold,'center');
  txt(T('ctrlSwitch'),VW-12,12,6,UIC.text,'right');
  /* 布局切换标签 */
  const tabs=[T('ctrlModeP'),T('ctrlModeT'),T('ctrlModeK')];
  uctx.font='bold 8px '+FONT;
  let tx=VW/2; for(const t of tabs)tx-=uctx.measureText(t).width+14;
  tabs.forEach((t,i)=>{
    const w=uctx.measureText(t).width;
    txt(t,tx,26,8,i===mode?UIC.gold:UIC.muted);
    if(i===mode)upx(tx,35,w,1,UIC.gold);
    const sx=tx;
    TAP_RECTS.push({x:sx-4,y:24,w:w+8,h:14,act:()=>{if(ST.ctrlMode!==i){ST.ctrlMode=i;ST.ctrlT=ST.ctrlIdx*1.7;SFX.pick();}}});
    tx+=w+14;
  });
  /* 左: 布局图解面板 */
  const X=14,Y=44,W=272,H=152;
  uPanel(X,Y,W,H,UIC.cyan,0.86);
  uctx.save();
  uctx.translate(X+W/2,Y+H/2); uctx.scale(0.95,0.95); uctx.translate(-159,-138);
  if(mode===0)drawCtrlPad(hot);
  else if(mode===1)drawCtrlTouch(hot);
  else drawCtrlKeys(hot);
  uctx.restore();
  /* 右: 实况演示窗 + 动作说明 */
  const VX=294,VY=44,VW2=172,VH2=88;
  /* 演示窗区域回绘: 排除压暗遮罩, 与实况游戏画面同等亮度 (真机反馈) */
  if(act.scene>=0)drawGuideScene(uctx,act.scene,VX,VY,VW2,VH2);
  if(act.scene<0){   /* 暂停: 无实况场景, 画暂停样式 */
    upx(VX,VY,VW2,VH2,PAL.ink);
    uctx.globalAlpha=0.35; upx(VX,VY,VW2,VH2,PAL.panel); uctx.globalAlpha=1;
    txt('❚❚',VX+VW2/2,VY+22,22,UIC.gold,'center');
    txt(T('pauseT'),VX+VW2/2,VY+56,9,UIC.ink,'center');
  }
  ctrlWindow(VX,VY,VW2,VH2);
  /* 演示窗下方 文案三行分区: 标题/按键/说明 各自独立行带, 互不叠压 (页面导览实测bug) */
  txt(T(act.t),VX+VW2/2,VY+VH2+4,10,mode===1?UIC.ink:UIC.gold,'center');
  const k=ctrlKeyOf(act.id,mode);
  if(k)txt('['+k+']',VX+VW2/2,VY+VH2+17,8,UIC.muted,'center');
  const desc=T('brief_'+act.id);
  wrapTxt(desc,VW2-8,6).forEach((l,i)=>txt(l,VX+VW2/2,VY+VH2+27+i*9,6,UIC.text,'center'));
  /* 底部动作条: 8项, 当前高亮 */
  uPanel(8,196,VW-16,22,UIC.cyan,0.6);
  CTRL_ACTS.forEach((a,i)=>{
    const nm=T('short_'+a.id);
    const w=(VW-24)/CTRL_ACTS.length, cx=12+i*w;
    const sel=i===idx;
    if(sel)upx(cx,198,w-4,18,rgba(UIC.gold,0.25));
    txt(nm,cx+w/2-2,202,7,sel?UIC.ink:UIC.muted,'center');
    TAP_RECTS.push({x:cx,y:196,w:w-4,h:22,act:()=>{ST.ctrlT=i*1.7;SFX.pick();}});
  });
  /* 底部: 确认出击提示(闪烁) + 手柄别名注 */
  if((ST.t*2%1)<0.66)
    txt(mode===1?T('ctrlGoT'):TF('ctrlGoP',{k:mode===0?padBtnName(SET.pad.confirm):'ENTER'}),
      VW/2,236,10,UIC.ink,'center');
  if(mode===0)txt(T('ctrlAlias'),VW/2,252,6,UIC.muted,'center');
  TAP_RECTS.push({x:VW/2-90,y:230,w:180,h:22,act:()=>exitCtrlIntro()});
}
/* 手柄布局图解 (适配盖世小鸡X2S等标准安卓手柄) */
function drawCtrlPad(hot){
  const cx=159,cy=138;
  upx(cx-116,cy-42,232,104,rgba(PAL.panel,0.35));
  uctx.strokeStyle=UIC.muted; uctx.lineWidth=1; uctx.strokeRect(cx-115.5,cy-41.5,231,103);
  /* 肩键/扳机 */
  ctrlKeycap(cx-96,cy-40,34,9,'LT',hot==='shield');
  ctrlKeycap(cx-58,cy-40,34,9,'LB',hot==='shield');
  ctrlKeycap(cx+24,cy-40,34,9,'RB',hot==='sprint');
  ctrlKeycap(cx+62,cy-40,34,9,'RT',hot==='mg');
  /* 左摇杆 */
  ctrlBtn(cx-78,cy-14,13,'L',hot==='move');
  /* 十字键 (HAT轴/按钮12-15) — 箭头与触屏按钮统一为实心三角 ▲▼◀▶ */
  const dx=cx-78,dy=cy+34;
  ctrlKeycap(dx-6,dy-22,12,10,'▲',hot==='move');
  ctrlKeycap(dx-20,dy-5,12,10,'◀',hot==='move');
  ctrlKeycap(dx+8,dy-5,12,10,'▶',hot==='move');
  ctrlKeycap(dx-6,dy+12,12,10,'▼',hot==='move');
  /* ABXY (位置对应: A=南 B=东 X=西 Y=北) */
  const bx=cx+62,by=cy-2;
  ctrlBtn(bx,by-20,9,'Y',hot==='msl');
  ctrlBtn(bx-20,by,9,'X',hot==='cannon');
  ctrlBtn(bx+20,by,9,'B',hot==='strike');
  ctrlBtn(bx,by+20,9,'A',hot==='mg');
  /* Select/Start */
  ctrlKeycap(cx-30,cy+34,26,9,'SEL',false);
  ctrlKeycap(cx+6,cy+34,26,9,'STA',hot==='pause');
  txt('STICK / D-PAD',cx-78,cy+48,6,UIC.muted,'center');
  txt(T('cMove'),cx+62,cy+48,6,UIC.muted,'center');
}
/* 触屏布局图解 (对应虚拟按钮实际位置) */
/* v1.5 触屏布局图解: 摇杆圆环 + 圆形玻璃键 (与实机 #joy/.tbtn 同构) */
function ctrlGlassBtn(cx,cy,r,label,hot){
  const g=uctx.createRadialGradient(cx,cy-r*0.3,r*0.2,cx,cy,r);
  g.addColorStop(0,hot?rgba(UIC.gold,0.34):'rgba(126,158,198,0.15)');
  g.addColorStop(1,hot?rgba(PAL.ember,0.20):'rgba(5,8,13,0.22)');
  uctx.fillStyle=g; uctx.beginPath(); uctx.arc(cx,cy,r,0,Math.PI*2); uctx.fill();
  uctx.strokeStyle=hot?rgba(UIC.gold,0.85):'rgba(255,255,255,0.40)'; uctx.lineWidth=hot?1.5:1;
  uctx.beginPath(); uctx.arc(cx,cy,r,0,Math.PI*2); uctx.stroke();
  uctx.strokeStyle='rgba(255,255,255,0.12)'; uctx.lineWidth=1;
  uctx.beginPath(); uctx.arc(cx,cy,r-1.5,0,Math.PI*2); uctx.stroke();
  txt(label,cx,cy-3,7,hot?UIC.ink:'rgba(243,247,255,0.88)','center');
  if(hot)ctrlRing(cx,cy,r);
}
function ctrlJoy(cx,cy,r,hot){
  /* 外环: 近透填充感 (只画环线) + 四向箭头 + 摆动演示的摇杆头 */
  uctx.strokeStyle=hot?rgba(UIC.gold,0.85):'rgba(255,255,255,0.45)'; uctx.lineWidth=1.5;
  uctx.beginPath(); uctx.arc(cx,cy,r,0,Math.PI*2); uctx.stroke();
  uctx.strokeStyle='rgba(255,255,255,0.10)'; uctx.lineWidth=1;
  uctx.beginPath(); uctx.arc(cx,cy,r-2.5,0,Math.PI*2); uctx.stroke();
  const a=hot?UIC.gold:'rgba(243,247,255,0.60)';
  txt('▲',cx,cy-r-9,8,a,'center'); txt('▼',cx,cy+r+2,8,a,'center');
  txt('◀',cx-r-8,cy-4,8,a,'center'); txt('▶',cx+r+1,cy-4,8,a,'center');
  const an=-Math.PI/2+Math.sin(ST.t*1.3)*1.15, d=r*0.52, kr=r*0.34;
  const sx=cx+Math.cos(an)*d, sy=cy+Math.sin(an)*d;
  const g=uctx.createRadialGradient(sx,sy-kr*0.4,kr*0.2,sx,sy,kr);
  g.addColorStop(0,'rgba(243,247,255,0.28)'); g.addColorStop(1,'rgba(22,34,49,0.30)');
  uctx.fillStyle=g; uctx.beginPath(); uctx.arc(sx,sy,kr,0,Math.PI*2); uctx.fill();
  uctx.strokeStyle='rgba(255,255,255,0.45)'; uctx.lineWidth=1;
  uctx.beginPath(); uctx.arc(sx,sy,kr,0,Math.PI*2); uctx.stroke();
  if(hot)ctrlRing(cx,cy,r);
}
function drawCtrlTouch(hot){
  upx(30,70,255,134,rgba(PAL.panel,0.25));
  ctrlJoy(72,157,26,hot==='move');
  if(aimMode()!=='auto')ctrlJoy(172,170,20,hot==='lock');
  const button=(x,y,r,id,icon)=>{
    ctrlGlassBtn(x,y,r,'',hot===id);
    if(icon!==null&&window.V18UIR)V18UIR.icon(uctx,icon,x,y,r*1.1);
    else txt(id==='lock'?'◎':'Ⅱ',x,y-4,9,UIC.ink,'center');
  };
  if(aimMode()!=='manual')button(57,97,12,'lock',null);
  button(262,181,15,'mg',0);button(226,190,11,'cannon',1);
  button(226,159,11,'sprint',4);button(226,127,11,'msl',2);
  button(262,144,11,'shield',5);button(262,110,11,'strike',3);
  button(270,79,10,'pause',6);
}
/* 键盘布局图解 */
function drawCtrlKeys(hot){
  ctrlKeycap(88,82,20,18,'W',hot==='move');
  ctrlKeycap(66,104,20,18,'A',hot==='move');
  ctrlKeycap(88,104,20,18,'S',hot==='move');
  ctrlKeycap(110,104,20,18,'D',hot==='move');
  ctrlKeycap(160,96,22,18,'J',hot==='mg');
  ctrlKeycap(186,96,22,18,'K',hot==='cannon');
  ctrlKeycap(212,96,22,18,'L',hot==='msl');
  ctrlKeycap(238,96,22,18,'U',hot==='strike');
  ctrlKeycap(160,140,48,18,'SHIFT',hot==='sprint');
  ctrlKeycap(212,140,48,18,'SPACE',hot==='shield');
  ctrlKeycap(160,168,22,18,'P',hot==='pause');
  ctrlKeycap(186,168,60,18,'ENTER',false);
  txt('WASD',88,132,6,UIC.muted,'center');
  ctrlKeycap(92,169,20,16,'↑',hot==='lock');
  ctrlKeycap(69,188,20,16,'←',hot==='lock');ctrlKeycap(92,188,20,16,'↓',hot==='lock');ctrlKeycap(115,188,20,16,'→',hot==='lock');
  ctrlKeycap(242,168,20,18,'I',hot==='lock');
}
