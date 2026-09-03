"use strict";
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
  if(from==='pause')openMenu('pause');
  else openMenu('title');
}
function volBlocks(v){ if(v===0)return T('volOff'); return '▮'.repeat(v)+'▯'.repeat(4-v); }
/* padmap 行的动作名 (engine 改键成功 toast 也用它); 帮助页标题去掉 [J] 类后缀 */
function padActLabel(a){
  const lbls={mg:'h1t',cannon:'h2t',msl:'h3t',strike:'h4t',sprint:'h5t',shield:'h6t',pause:'padPause'};
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
    its.push({label:'padmap',enter:()=>openMenu('padmap',MENU.from)});
    its.push({label:'restore',enter:()=>{SET=JSON.parse(JSON.stringify(SET_DEF));applyVolumes();saveSet();showToast(T('restored'));}});
    its.push({label:'back',enter:()=>menuBack()});
    return its;
  }
  if(id==='padmap'){
    const acts=['mg','cannon','msl','strike','sprint','shield','pause','confirm','back'];
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
const UPG_KEYS=['hp','spd','atk','def','cdr'];   /* v1.8 W5: CDR 培养项 */
function upgKey(code){
  switch(code){
    case 'ArrowUp': case 'KeyW': ST.upg.sel=(ST.upg.sel+UPG_KEYS.length-1)%UPG_KEYS.length; SFX.pick(); break;
    case 'ArrowDown': case 'KeyS': ST.upg.sel=(ST.upg.sel+1)%UPG_KEYS.length; SFX.pick(); break;
    case 'ArrowRight': case 'KeyD': if(RUN.pts>0&&RUN.up[UPG_KEYS[ST.upg.sel]]<30){RUN.pts--;RUN.up[UPG_KEYS[ST.upg.sel]]++;SFX.pick();} break;
    case 'ArrowLeft': case 'KeyA': if(RUN.up[UPG_KEYS[ST.upg.sel]]>0){RUN.pts++;RUN.up[UPG_KEYS[ST.upg.sel]]--;SFX.pick();} break;
    case 'Enter': case 'KeyJ': deployFromUpgrade(); break;
    case 'KeyR': refundAll(); SFX.heal(); break;
  }
}

/* ---------- 菜单绘制 ---------- */
function drawMenu(){
  MENU_RECTS=[];
  const id=MENU.id;
  if(id==='help'){ drawHelp(); return; }
  const its=menuItems(id);
  const titles={title:'',option:'OPTION',padmap:T('padmap'),pause:T('pauseT'),hull:T('hullT'),wingman:T('wingT'),debug:T('mDebug')};
  const W=id==='title'?196:250, rowH=16, headH=id==='title'?16:24;
  const H=headH+its.length*rowH+20;
  const x=id==='title'?24:(VW-W)/2, y=id==='title'?118:(VH-H)/2+4;
  uPanel(x-3,y-3,W+6,H+6,id==='pause'?PAL.cyan:PAL.gold,id==='title'?0.66:0.82);   /* 标题选单: 低透明露出封面, 但保住玻璃渐变层次 */
  upx(x+7,y+headH-8,W-14,1,PAL.rail);
  const title=id==='option'?'OPTION':T(id==='padmap'?'padmap':id==='pause'?'pauseT':id==='hull'?'hullT':id==='wingman'?'wingT':id==='debug'?'mDebug':id);
  if(id!=='title')txt(title,x+W/2,y+8,10,PAL.gold,'center');
  if(id==='title')txtO(T('gameTitle'),VW/2,18,23,PAL.gold,'center');
  if(id==='title')txtO(T('sub'),VW/2,43,11,PAL.white,'center');
  if(id==='title')txtO(T('tag'),VW/2,58,7,PAL.cyan,'center');
  if(id==='title'&&ST.best>0)txt(TF('best',{n:ST.best}),VW/2,67,7,PAL.gold,'center');
  const y0=y+headH;
  its.forEach((it,i)=>{
    const iy=y0+i*rowH;
    const lbl=(it.labelFn?it.labelFn():(it.label==='restore'?T('restore'):it.label==='back'?T('back'):T(it.label)));
    const sel=MENU.sel===i;
    if(sel){ upx(x+12,iy-3,W-24,rowH-2,PAL.panel2); upx(x+12,iy-3,2,rowH-2,PAL.gold); txt('▶',x+18,iy,8,PAL.gold); }
    const label=lbl.startsWith('▶')?lbl.slice(1):lbl;
    txt(label,x+32,iy,8,sel?PAL.white:PAL.lite);
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
      txt('‹ '+(waiting?'?':it.value())+' ›',x+W-14,iy,8,sel?PAL.gold:PAL.steel,'right');
    }
  });
  let foot='';
  if(id==='padmap')foot=PAD.gp?(PAD.gp.id||'').slice(0,26):T('padNone');
  if(MENU.capture)foot=T('padWait');
  if(id==='option'&&MENU.sel===1)foot=T('diffTip');
  if(id==='hull'&&HULL_KEYS[MENU.sel])foot=T(HULLS[HULL_KEYS[MENU.sel]].i18n+'_f');
  if(id==='wingman'){const k=WING_KEYS[MENU.sel];if(k)foot=T((k==='none'?'wN':WINGS[k].i18n)+'_f');}
  txt(foot||navHintDyn(),x+W/2,y+H-14,8,foot&&MENU.capture?PAL.gold:PAL.lite,'center');
  if(id==='title'){
    uPanel(VW/2-134,VH-28,268,20,PAL.cyan,0.58);
    /* 底部输入模式条: 高亮当前生效模式 */
    const m=inMode(),segs=[['KEYBOARD','key'],['GAMEPAD','pad'],['TOUCH','touch']];
    uctx.font='bold 7px '+FONT;
    let sx=VW/2;
    for(const s of segs)sx-=uctx.measureText(s[0]).width+9;
    for(const [label,mode] of segs){
      txt(label,sx,VH-22,7,mode===m?PAL.gold:PAL.lite);
      sx+=uctx.measureText(label).width+9;
    }
  }
}
const HELP_PAGES=13;   /* v1.8 W8: 页数收口 (原4处硬编码) */
function drawHelp(){
  const pg=MENU.page;
  uctx.globalAlpha=0.82; upx(0,0,VW,VH,PAL.ink); uctx.globalAlpha=1;
  uPanel(22,8,VW-44,VH-22,PAL.cyan,0.68);
  /* 标题动态按键提示: 手柄模式显示手柄键名, 触屏模式不显示键名 */
  const HELP_ACTS={1:'mg',2:'cannon',3:'msl',4:'strike',5:'sprint',6:'shield'};
  let ht=T('h'+pg+'t').replace(/\s*\[.*\]/,'');
  const kh=keyHint(HELP_ACTS[pg]);
  if(kh)ht+=' ['+kh+']';
  txtO(ht,VW/2,14,13,PAL.gold,'center');
  const hsx=VW/2-100,hsy=28,hsw=200,hsh=96;   /* v1.5: 场景窗扩大承载 v15 精绘 */
  uctx.imageSmoothingEnabled=false;
  uctx.drawImage(buf,hsx,hsy,hsw,hsh,hsx,hsy,hsw,hsh);
  uctx.strokeStyle=PAL.steel; uctx.lineWidth=1;
  uctx.strokeRect(hsx+0.5,hsy+0.5,hsw-1,hsh-1);
  const lines=wrapTxt(T('h'+pg+'d'),330,9);
  uPanel(VW/2-172,128,344,lines.length*12+8,PAL.gold,0.55);
  lines.forEach((l,i)=>txt(l,VW/2,133+i*12,9,PAL.white,'center'));
  /* v1.8 W8: 触屏=可见实体翻页钮+返回钮(全侧边隐形热区保留); 键盘/手柄=原文字箭头 */
  if(inMode()==='touch'){
    uPanel(24,VH/2-15,32,30,PAL.cyan,0.62); txt('‹',40,VH/2+3,15,PAL.white,'center');
    uPanel(VW-56,VH/2-15,32,30,PAL.cyan,0.62); txt('›',VW-40,VH/2+3,15,PAL.white,'center');
    uPanel(VW/2-44,VH-38,88,18,PAL.gold,0.62); txt('✕ '+T('back'),VW/2,VH-33,8,PAL.white,'center');
    MENU_RECTS.push({x:VW/2-44,y:VH-38,w:88,h:18,act:()=>menuBack()});
  } else {
    txt('‹',36,VH/2,16,PAL.gold,'center');
    txt('›',VW-36,VH/2,16,PAL.gold,'center');
  }
  txt((pg+1)+'/'+HELP_PAGES,VW/2,VH-26,8,PAL.lite,'center');
  const bk=inMode()==='pad'?(keyHint('back')||'B'):'Esc';
  if(inMode()!=='touch')txt(T('back')+': '+bk,VW/2,VH-14,7,PAL.steel,'center');
  MENU_RECTS.push({x:0,y:0,w:80,h:VH,act:()=>{MENU.page=(MENU.page+HELP_PAGES-1)%HELP_PAGES;}});
  MENU_RECTS.push({x:VW-80,y:0,w:80,h:VH,act:()=>{MENU.page=(MENU.page+1)%HELP_PAGES;}});
  MENU_RECTS.push({x:80,y:0,w:VW-160,h:30,act:()=>menuBack()});
}
/* ---------- 整备画面 ---------- */
function drawUpgrade(){
  TAP_RECTS=[];
  /* v1.8 UI 新布局 (doc§13): 整备背景大图 + 左中维修台实时坦克(徽章框) + 右侧35%安全区面板;
     V18UI 缺失时回退旧布局. 输入逻辑 (upgKey/TAP_RECTS/acts) 与旧版完全一致. */
  const nu=window.V18UIR&&V18UIR.ok('badge');
  if(nu){
    const dep=V18UIR.bg('dep');
    if(dep){ uctx.imageSmoothingEnabled=true; uctx.drawImage(dep,0,0,VW,VH); }
    else { uctx.globalAlpha=0.84; upx(0,0,VW,VH,PAL.ink); uctx.globalAlpha=1; }
    uctx.save();                                       /* 可读性压暗: 右侧面板带 + 底部 + 顶部轻角 */
    const rg=uctx.createLinearGradient(VW*0.55,0,VW,0);
    rg.addColorStop(0,'rgba(5,8,13,0)'); rg.addColorStop(1,'rgba(5,8,13,0.66)');
    uctx.fillStyle=rg; uctx.fillRect(0,0,VW,VH);
    const bg=uctx.createLinearGradient(0,VH*0.72,0,VH);
    bg.addColorStop(0,'rgba(5,8,13,0)'); bg.addColorStop(1,'rgba(5,8,13,0.55)');
    uctx.fillStyle=bg; uctx.fillRect(0,0,VW,VH);
    uctx.restore();
    /* 左中维修台: 徽章框 + 实时分层坦克 (车体朝上, 炮塔侧摆展示立体感; 不烘焙进背景) */
    const ax=Math.round(0.34*VW), ay=Math.round(0.72*VH);
    const v=hullCfg().vis||{};
    V18UIR.badge(uctx,ax,ay,116,{ta:-Math.PI/2+0.7+Math.sin(ST.t*0.35)*0.45});
    txtO(T(HULLS[RUN.hull].i18n),ax,ay-70,9,PAL.gold,'center');
    txt(v.callsign||'IRONCLAD-07',ax,ay+64,6,rgba(v.trim||PAL.cyan,0.95),'center');
    upx(ax-22,ay+72,44,2,v.trim||PAL.cyan);           /* 机体职业色条 (阵营色仍走 IFF) */
    /* 右侧安全区面板 (statsSafe x≥0.62VW) */
    const PX=292,PW=178,PCX=PX+PW/2;
    uPanel(PX,6,PW,258,PAL.gold,0.80);
    txtO(T('upgT'),PCX,12,13,PAL.gold,'center');
    txt(T('upgPts')+': '+RUN.pts,PCX,30,10,PAL.gold,'center');
    const rows=[['upgHp','hp'],['upgSpd','spd'],['upgAtk','atk'],['upgDef','def'],['upgCdr','cdr']];
    rows.forEach((r,i)=>{
      const y=46+i*22, sel=ST.upg.sel===i;
      const lv=RUN.up[r[1]];
      if(sel){ upx(PX+8,y-5,PW-16,18,PAL.panel2); upx(PX+8,y-5,2,18,PAL.gold); txt('▶',PX+14,y,9,PAL.gold); }
      txt(T(r[0]),PX+26,y,9,sel?PAL.white:PAL.lite);
      uMiniBar(PX+70,y+2,48,6,Math.min(1,lv/30),lv>=30?PAL.gold:PAL.acid);
      txt('Lv'+lv,PX+122,y,8,sel?PAL.gold:PAL.lite);
      txt('-',PX+148,y,11,sel&&lv>0?PAL.red:PAL.lite,'center');
      txt('+',PX+162,y,11,sel&&RUN.pts>0?PAL.lime:PAL.lite,'center');
      TAP_RECTS.push({x:PX+6,y:y-4,w:130,h:20,act:()=>{ST.upg.sel=i;}});
      TAP_RECTS.push({x:PX+141,y:y-6,w:14,h:20,act:()=>{if(lv>0){RUN.pts++;RUN.up[r[1]]--;SFX.pick();}}});
      TAP_RECTS.push({x:PX+155,y:y-6,w:14,h:20,act:()=>{if(RUN.pts>0&&lv<30){RUN.pts--;RUN.up[r[1]]++;SFX.pick();}}});
    });
    const st=calcStats();
    wrapTxt(TF('upgStat',{a:Math.round(st.maxHp),s:Math.round((st.speed/88-1)*100),k:Math.round((st.atk-1)*100),d:Math.round(st.def*100),c:Math.round((1-st.cdMul)*100)}),PW-26,8)
      .forEach((l,i)=>txt(l,PCX,146+i*11,8,PAL.acid,'center'));
    if(ST.upg.from==='win')txt(TF('winOpt',{n:RUN.cycle+2}),PCX,170,7,PAL.white,'center');
    const touchU=inMode()==='touch';
    uPanel(PX+18,236,142,20,PAL.gold,0.72);
    txtO(touchU?T('ctrlGoT'):TF('ctrlGoP',{k:'⏎/A'}),PCX,241,8,PAL.white,'center');
    TAP_RECTS.push({x:PX+18,y:234,w:142,h:24,act:()=>deployFromUpgrade()});
    uPanel(6,VH-28,118,20,PAL.cyan,0.66);
    txt((touchU?'':'R: ')+T('upgRefund'),65,VH-23,7,PAL.lite,'center');
    TAP_RECTS.push({x:6,y:VH-28,w:118,h:20,act:()=>{refundAll();SFX.heal();}});
    return;
  }
  uctx.globalAlpha=0.84; upx(0,0,VW,VH,PAL.ink); uctx.globalAlpha=1;
  uPanel(48,8,VW-96,VH-28,PAL.gold,0.72);
  txtO(T('upgT'),VW/2,12,13,PAL.gold,'center');
  txt(T('upgPts')+': '+RUN.pts,VW/2,30,10,PAL.gold,'center');
  const rows=[['upgHp','hp'],['upgSpd','spd'],['upgAtk','atk'],['upgDef','def'],['upgCdr','cdr']];   /* v1.8 W5: 5行 */
  rows.forEach((r,i)=>{
    const y=46+i*21, sel=ST.upg.sel===i;
    const lv=RUN.up[r[1]];
    if(sel){ upx(66,y-5,250,18,PAL.panel2); upx(66,y-5,2,18,PAL.gold); txt('▶',60,y,9,PAL.gold); }
    txt(T(r[0]),74,y,9,sel?PAL.white:PAL.lite);
    uMiniBar(150,y+2,100,6,Math.min(1,lv/30),lv>=30?PAL.gold:PAL.acid);
    txt('Lv'+lv,256,y,8,sel?PAL.gold:PAL.steel);
    txt('-',290,y,11,sel&&lv>0?PAL.red:PAL.steel,'center');
    txt('+',310,y,11,sel&&RUN.pts>0?PAL.lime:PAL.steel,'center');
    TAP_RECTS.push({x:56,y:y-4,w:230,h:20,act:()=>{ST.upg.sel=i;}});
    TAP_RECTS.push({x:280,y:y-6,w:20,h:20,act:()=>{if(lv>0){RUN.pts++;RUN.up[r[1]]--;SFX.pick();}}});
    TAP_RECTS.push({x:300,y:y-6,w:20,h:20,act:()=>{if(RUN.pts>0&&lv<30){RUN.pts--;RUN.up[r[1]]++;SFX.pick();}}});
  });
  const st=calcStats();
  txt(TF('upgStat',{a:Math.round(st.maxHp),s:Math.round((st.speed/88-1)*100),k:Math.round((st.atk-1)*100),d:Math.round(st.def*100),c:Math.round((1-st.cdMul)*100)}),VW/2,162,9,PAL.acid,'center');
  if(ST.upg.from==='win')txt(TF('winOpt',{n:RUN.cycle+2}),VW/2,166,7,PAL.white,'center');
  const blink=(ST.t%1.2)<0.86;
  if(blink)txtO(T('upgHint'),VW/2,VH-40,7,PAL.lite,'center');
  TAP_RECTS.push({x:VW/2-70,y:VH-26,w:140,h:18,act:()=>deployFromUpgrade()});
  if(blink)txt('[ ⏎ / A ]',VW/2,VH-22,9,PAL.gold,'center');
  TAP_RECTS.push({x:6,y:VH-26,w:90,h:18,act:()=>{refundAll();SFX.heal();}});
  txt('R: '+T('upgRefund'),10,VH-22,7,PAL.lite);
}

/* ============================================================
   战前键位速览 (ctrl 状态): 布局图解 + 实况游戏画面演示 + 动作条
   ============================================================ */
/* scene: 对应引擎实况小场景(drawHelpScene)页号, -1=暂停(无场景) */
const CTRL_ACTS=[
  {id:'move',  t:'cMove',  scene:0},
  {id:'mg',    t:'cMg',    scene:1},
  {id:'cannon',t:'cCannon',scene:2},
  {id:'msl',   t:'cMsl',   scene:3},
  {id:'strike',t:'cStrike',scene:4},
  {id:'sprint',t:'cSprint',scene:5},
  {id:'shield',t:'cShield',scene:6},
  {id:'pause', t:'cPause', scene:-1}];
function ctrlKeyOf(a,mode){
  if(mode===0){ const bi=SET.pad[a]; return bi>=0?padBtnName(bi):''; }
  if(mode===1)return '';
  return KEY_NAMES[a]||'';
}
function ctrlRing(cx,cy,r){
  const p=0.5+0.5*Math.sin(ST.t*6);
  uctx.strokeStyle=rgba(PAL.gold,0.35+0.55*p);
  uctx.lineWidth=1.5;
  uctx.beginPath(); uctx.arc(cx,cy,r+1.5+2.5*p,0,Math.PI*2); uctx.stroke();
}
function ctrlBtn(cx,cy,r,label,hot,dim){
  uctx.fillStyle=hot?rgba(PAL.gold,0.30):rgba(PAL.panel,0.92);
  uctx.beginPath(); uctx.arc(cx,cy,r,0,Math.PI*2); uctx.fill();
  uctx.strokeStyle=hot?PAL.gold:(dim?PAL.rail:PAL.steel); uctx.lineWidth=1;
  uctx.beginPath(); uctx.arc(cx,cy,r,0,Math.PI*2); uctx.stroke();
  txt(label,cx,cy-3,7,hot?PAL.white:(dim?PAL.rail:PAL.lite),'center');
  if(hot)ctrlRing(cx,cy,r);
}
function ctrlKeycap(cx,cy,w,h,label,hot){
  upx(cx,cy,w,h,hot?rgba(PAL.gold,0.30):PAL.panel);
  uctx.strokeStyle=hot?PAL.gold:PAL.steel; uctx.lineWidth=1;
  uctx.strokeRect(cx+0.5,cy+0.5,w-1,h-1);
  txt(label,cx+w/2,cy+h/2-3,7,hot?PAL.white:PAL.lite,'center');
  if(hot)ctrlRing(cx+w/2,cy+h/2,Math.max(w,h)/2);
}
/* 实况演示窗(边框, 不填充): 画面由 draw() 阶段1 直接画进 buf */
function ctrlWindow(x,y,w,h){
  uctx.strokeStyle=rgba(PAL.cyan,0.64); uctx.lineWidth=1;
  uctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
  upx(x,y,12,1,PAL.cyan); upx(x,y,1,12,PAL.cyan);
  upx(x+w-12,y+h-1,12,1,PAL.cyan); upx(x+w-1,y+h-12,1,12,PAL.cyan);
}
function drawCtrlIntro(){
  const mode=ST.ctrlMode||0;                      /* 0=pad 1=touch 2=key */
  const idx=ST.ctrlIdx%CTRL_ACTS.length;
  const act=CTRL_ACTS[idx], hot=act.id;
  uctx.globalAlpha=0.82; upx(0,0,VW,VH,PAL.ink); uctx.globalAlpha=1;
  /* 标题 */
  txtO(T('ctrlT'),VW/2,8,14,PAL.gold,'center');
  txt(T('ctrlSwitch'),VW-12,12,6,PAL.lite,'right');
  /* 布局切换标签 */
  const tabs=[T('ctrlModeP'),T('ctrlModeT'),T('ctrlModeK')];
  uctx.font='bold 8px '+FONT;
  let tx=VW/2; for(const t of tabs)tx-=uctx.measureText(t).width+14;
  tabs.forEach((t,i)=>{
    const w=uctx.measureText(t).width;
    txt(t,tx,26,8,i===mode?PAL.gold:PAL.steel);
    if(i===mode)upx(tx,35,w,1,PAL.gold);
    const sx=tx;
    TAP_RECTS.push({x:sx-4,y:24,w:w+8,h:14,act:()=>{if(ST.ctrlMode!==i){ST.ctrlMode=i;ST.ctrlT=ST.ctrlIdx*1.7;SFX.pick();}}});
    tx+=w+14;
  });
  /* 左: 布局图解面板 */
  const X=14,Y=44,W=272,H=152;
  uPanel(X,Y,W,H,PAL.cyan,0.86);
  uctx.save();
  uctx.translate(X+W/2,Y+H/2); uctx.scale(0.95,0.95); uctx.translate(-159,-138);
  if(mode===0)drawCtrlPad(hot);
  else if(mode===1)drawCtrlTouch(hot);
  else drawCtrlKeys(hot);
  uctx.restore();
  /* 右: 实况演示窗 + 动作说明 */
  const VX=294,VY=44,VW2=172,VH2=88;
  /* 演示窗区域回绘: 排除压暗遮罩, 与实况游戏画面同等亮度 (真机反馈) */
  uctx.imageSmoothingEnabled=false;
  uctx.drawImage(buf,VX,VY,VW2,VH2,VX,VY,VW2,VH2);
  if(act.scene<0){   /* 暂停: 无实况场景, 画暂停样式 */
    upx(VX,VY,VW2,VH2,PAL.ink);
    uctx.globalAlpha=0.35; upx(VX,VY,VW2,VH2,PAL.panel); uctx.globalAlpha=1;
    txt('❚❚',VX+VW2/2,VY+22,22,PAL.gold,'center');
    txt(T('pauseT'),VX+VW2/2,VY+56,9,PAL.white,'center');
  }
  ctrlWindow(VX,VY,VW2,VH2);
  /* 演示窗下方 文案三行分区: 标题/按键/说明 各自独立行带, 互不叠压 (页面导览实测bug) */
  txtO(T(act.t),VX+VW2/2,VY+VH2+4,10,mode===1?PAL.white:PAL.gold,'center');
  const k=ctrlKeyOf(act.id,mode);
  if(k)txt('['+k+']',VX+VW2/2,VY+VH2+17,8,PAL.steel,'center');
  const desc=act.scene>=0?T('h'+act.scene+'d'):T('cPauseD');
  wrapTxt(desc,VW2-8,6).forEach((l,i)=>txt(l,VX+VW2/2,VY+VH2+27+i*9,6,PAL.lite,'center'));
  /* 底部动作条: 8项, 当前高亮 */
  uPanel(8,196,VW-16,22,PAL.cyan,0.6);
  CTRL_ACTS.forEach((a,i)=>{
    const nm=a.id==='pause'?T('pauseT'):T('h'+a.scene+'t').replace(/\s*\[.*/,'');
    const w=76, cx=12+i*((VW-24)/8);
    const sel=i===idx;
    if(sel)upx(cx,198,w-4,18,rgba(PAL.gold,0.25));
    txt(nm,cx+w/2-2,202,7,sel?PAL.white:PAL.steel,'center');
    TAP_RECTS.push({x:cx,y:196,w:w-4,h:22,act:()=>{ST.ctrlT=i*1.7;SFX.pick();}});
  });
  /* 底部: 确认出击提示(闪烁) + 手柄别名注 */
  if((ST.t*2%1)<0.66)
    txtO(mode===1?T('ctrlGoT'):TF('ctrlGoP',{k:mode===0?padBtnName(SET.pad.confirm):'ENTER'}),
      VW/2,236,10,PAL.white,'center');
  if(mode===0)txt(T('ctrlAlias'),VW/2,252,6,PAL.steel,'center');
  TAP_RECTS.push({x:VW/2-90,y:230,w:180,h:22,act:()=>exitCtrlIntro()});
}
/* 手柄布局图解 (适配盖世小鸡X2S等标准安卓手柄) */
function drawCtrlPad(hot){
  const cx=159,cy=138;
  upx(cx-116,cy-42,232,104,rgba(PAL.panel,0.35));
  uctx.strokeStyle=PAL.steel; uctx.lineWidth=1; uctx.strokeRect(cx-115.5,cy-41.5,231,103);
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
  txt('STICK / D-PAD',cx-78,cy+48,6,PAL.steel,'center');
  txt(T('cMove'),cx+62,cy+48,6,PAL.steel,'center');
}
/* 触屏布局图解 (对应虚拟按钮实际位置) */
/* v1.5 触屏布局图解: 摇杆圆环 + 圆形玻璃键 (与实机 #joy/.tbtn 同构) */
function ctrlGlassBtn(cx,cy,r,label,hot){
  const g=uctx.createRadialGradient(cx,cy-r*0.3,r*0.2,cx,cy,r);
  g.addColorStop(0,hot?rgba(PAL.gold,0.34):'rgba(126,158,198,0.15)');
  g.addColorStop(1,hot?rgba(PAL.ember,0.20):'rgba(5,8,13,0.22)');
  uctx.fillStyle=g; uctx.beginPath(); uctx.arc(cx,cy,r,0,Math.PI*2); uctx.fill();
  uctx.strokeStyle=hot?rgba(PAL.gold,0.85):'rgba(255,255,255,0.40)'; uctx.lineWidth=hot?1.5:1;
  uctx.beginPath(); uctx.arc(cx,cy,r,0,Math.PI*2); uctx.stroke();
  uctx.strokeStyle='rgba(255,255,255,0.12)'; uctx.lineWidth=1;
  uctx.beginPath(); uctx.arc(cx,cy,r-1.5,0,Math.PI*2); uctx.stroke();
  txt(label,cx,cy-3,7,hot?PAL.white:'rgba(243,247,255,0.88)','center');
  if(hot)ctrlRing(cx,cy,r);
}
function ctrlJoy(cx,cy,r,hot){
  /* 外环: 近透填充感 (只画环线) + 四向箭头 + 摆动演示的摇杆头 */
  uctx.strokeStyle=hot?rgba(PAL.gold,0.85):'rgba(255,255,255,0.45)'; uctx.lineWidth=1.5;
  uctx.beginPath(); uctx.arc(cx,cy,r,0,Math.PI*2); uctx.stroke();
  uctx.strokeStyle='rgba(255,255,255,0.10)'; uctx.lineWidth=1;
  uctx.beginPath(); uctx.arc(cx,cy,r-2.5,0,Math.PI*2); uctx.stroke();
  const a=hot?PAL.gold:'rgba(243,247,255,0.60)';
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
  upx(40,58,240,158,rgba(PAL.panel,0.30));
  uctx.strokeStyle=PAL.steel; uctx.strokeRect(40.5,58.5,239,157);
  ctrlJoy(92,120,32,hot==='move');
  txt('DRAG',92,166,6,PAL.steel,'center');
  /* 右簇: 圆形玻璃键, 布局与实机一致 (机枪大键贴右下, 左列主炮/加速/导弹, 右列护盾/空袭) */
  ctrlGlassBtn(238,166,17,T('cMg').slice(0,2),hot==='mg');
  ctrlGlassBtn(200,188,12,T('cCannon').slice(0,2),hot==='cannon');
  ctrlGlassBtn(200,110,12,T('cMsl').slice(0,2),hot==='msl');
  ctrlGlassBtn(200,149,12,T('cSprint').slice(0,2),hot==='sprint');
  ctrlGlassBtn(238,88,12,T('cStrike').slice(0,2),hot==='strike');
  ctrlGlassBtn(238,120,12,T('cShield').slice(0,2),hot==='shield');
  ctrlGlassBtn(260,68,10,'❚❚',hot==='pause');
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
  txt('WASD / ARROWS',99,132,6,PAL.steel,'center');
}
