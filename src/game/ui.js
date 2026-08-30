"use strict";
/* game/ui — 菜单模型/触屏/整备画面 */
/* ============================================================
   菜单系统 (键盘/手柄/触屏通用)
   ============================================================ */
function openMenu(id,from){ MENU={id,sel:0,page:0,capture:null,from:from||null}; }
function menuBack(){
  if(!MENU)return;
  const from=MENU.from;
  if(MENU.id==='pause'){ MENU=null; return; }
  if(MENU.capture){ MENU.capture=null; return; }
  if(from==='pause')openMenu('pause');
  else openMenu('title');
}
function volBlocks(v){ if(v===0)return T('volOff'); return '▮'.repeat(v)+'▯'.repeat(4-v); }
function menuItems(id){
  const its=[];
  if(id==='title'){
    its.push({label:'mNew',enter:()=>startNewGame()});
    if(hasSave())its.push({label:'mCont',enter:()=>continueGame()});
    its.push({label:'mOpt',enter:()=>openMenu('option','title')});
    its.push({label:'mHelp',enter:()=>openMenu('help','title')});
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
    its.push({label:'diff',choice:1,value:()=>I18N[SET.lang].diffNames[SET.diff],
      delta:d=>{SET.diff=clamp(SET.diff+d,0,4);saveSet();}});
    its.push({label:'bgm',choice:1,value:()=>volBlocks(SET.bgm),delta:d=>{SET.bgm=clamp(SET.bgm+d,0,4);applyVolumes();saveSet();}});
    its.push({label:'se',choice:1,value:()=>volBlocks(SET.se),delta:d=>{SET.se=clamp(SET.se+d,0,4);applyVolumes();saveSet();if(SET.se>0)SFX.pick();}});
    its.push({label:'vtouch',choice:1,value:()=>SET.touch==='auto'?T('auto'):(SET.touch==='on'?T('on'):T('off')),
      delta:()=>{SET.touch=SET.touch==='auto'?'on':(SET.touch==='on'?'off':'auto');saveSet();}});
    its.push({label:'padmap',enter:()=>openMenu('padmap',MENU.from)});
    its.push({label:'restore',enter:()=>{SET=JSON.parse(JSON.stringify(SET_DEF));applyVolumes();saveSet();showToast(T('restored'));}});
    its.push({label:'back',enter:()=>menuBack()});
    return its;
  }
  if(id==='padmap'){
    const acts=['mg','cannon','msl','strike','sprint','shield','pause','confirm','back'];
    const lbls={mg:'h1t',cannon:'h2t',msl:'h3t',strike:'h4t',sprint:'h5t',shield:'h6t',pause:'pauseT'};
    for(const a of acts){
      its.push({choice:1,act:a,
        labelFn:()=>lbls[a]?T(lbls[a]).replace(/\s*\[.*/,''):(a==='confirm'?'⏎ OK':'⎋ '+T('back')),
        value:()=>TF('padBtn',{n:SET.pad[a]}),
        delta:0,
        enter:()=>{MENU.capture=a;}});
    }
    its.push({label:'restore',enter:()=>{SET.pad=JSON.parse(JSON.stringify(SET_DEF.pad));saveSet();showToast(T('restored'));}});
    its.push({label:'back',enter:()=>menuBack()});
    return its;
  }
  return its;
}
function menuMove(d){ const n=menuItems(MENU.id).length; MENU.sel=(MENU.sel+d+n)%n; SFX.pick(); }
function menuAdjust(d){ const it=menuItems(MENU.id)[MENU.sel];
  if(MENU.id==='help'){ MENU.page=(MENU.page+d+11)%11; return; }
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
const UPG_KEYS=['hp','spd','atk','def'];
function upgKey(code){
  switch(code){
    case 'ArrowUp': case 'KeyW': ST.upg.sel=(ST.upg.sel+3)%4; SFX.pick(); break;
    case 'ArrowDown': case 'KeyS': ST.upg.sel=(ST.upg.sel+1)%4; SFX.pick(); break;
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
  const titles={title:'',option:'OPTION',padmap:T('padmap'),pause:T('pauseT')};
  const W=id==='title'?196:250, rowH=16, headH=id==='title'?16:24;
  const H=headH+its.length*rowH+20;
  const x=id==='title'?24:(VW-W)/2, y=id==='title'?118:(VH-H)/2+4;
  uPanel(x-3,y-3,W+6,H+6,id==='pause'?PAL.cyan:PAL.gold,0.82);
  upx(x+7,y+headH-8,W-14,1,PAL.rail);
  const title=id==='option'?'OPTION':T(id==='padmap'?'padmap':id==='pause'?'pauseT':id);
  if(id!=='title')txt(title,x+W/2,y+8,10,PAL.gold,'center');
  if(id==='title')txtO(T('gameTitle'),VW/2,18,23,PAL.gold,'center');
  if(id==='title')txtO(T('sub'),VW/2,43,11,PAL.white,'center');
  if(id==='title')txt(T('tag'),VW/2,58,7,PAL.cyan,'center');
  if(id==='title'&&ST.best>0)txt(TF('best',{n:ST.best}),VW/2,67,7,PAL.gold,'center');
  const y0=y+headH;
  its.forEach((it,i)=>{
    const iy=y0+i*rowH;
    const lbl=(it.labelFn?it.labelFn():(it.label==='restore'?T('restore'):it.label==='back'?T('back'):T(it.label)));
    const sel=MENU.sel===i;
    if(sel){ upx(x+12,iy-3,W-24,rowH-2,PAL.panel2); upx(x+12,iy-3,2,rowH-2,PAL.gold); txt('▶',x+18,iy,8,PAL.gold); }
    const label=lbl.startsWith('▶')?lbl.slice(1):lbl;
    txt(label,x+32,iy,8,sel?PAL.white:PAL.lite);
    MENU_RECTS.push({x:x+6,y:iy-3,w:W-12,h:rowH-3,act:()=>{
      MENU.sel=i;
      if(MENU.id==='padmap'&&it.act){MENU.capture=it.act;return;}
      if(it.choice&&it.delta){it.delta(1);return;}
      if(it.enter)it.enter();
    }});
    if(it.choice){ txt('‹ '+it.value()+' ›',x+W-14,iy,8,sel?PAL.gold:PAL.steel,'right'); }
  });
  let foot='';
  if(id==='padmap')foot=PAD.gp?(PAD.gp.id||'').slice(0,26):T('padNone');
  if(MENU.capture)foot=T('padWait');
  if(id==='option'&&MENU.sel===1)foot=T('diffTip');
  txt(foot||T('navHint'),x+W/2,y+H-14,8,foot&&MENU.capture?PAL.gold:PAL.lite,'center');
  if(id==='title'){
    uPanel(VW/2-134,VH-28,268,20,PAL.cyan,0.58);
    txt('KEYBOARD · GAMEPAD · TOUCH',VW/2,VH-22,7,PAL.lite,'center');
  }
}
function drawHelp(){
  const pg=MENU.page;
  uctx.globalAlpha=0.82; upx(0,0,VW,VH,PAL.ink); uctx.globalAlpha=1;
  uPanel(22,8,VW-44,VH-22,PAL.cyan,0.68);
  txtO(T('h'+pg+'t'),VW/2,14,13,PAL.gold,'center');
  const hsx=VW/2-80,hsy=34,hsw=160,hsh=84;
  uctx.imageSmoothingEnabled=false;
  uctx.drawImage(buf,hsx,hsy,hsw,hsh,hsx,hsy,hsw,hsh);
  uctx.strokeStyle=PAL.steel; uctx.lineWidth=1;
  uctx.strokeRect(hsx+0.5,hsy+0.5,hsw-1,hsh-1);
  const lines=wrapTxt(T('h'+pg+'d'),330,9);
  uPanel(VW/2-172,122,344,lines.length*12+8,PAL.gold,0.55);
  lines.forEach((l,i)=>txt(l,VW/2,127+i*12,9,PAL.white,'center'));
  txt('‹',36,VH/2,16,PAL.gold,'center');
  txt('›',VW-36,VH/2,16,PAL.gold,'center');
  txt((pg+1)+'/11',VW/2,VH-26,8,PAL.lite,'center');
  txt(T('back')+': Esc',VW/2,VH-14,7,PAL.steel,'center');
  MENU_RECTS.push({x:0,y:0,w:80,h:VH,act:()=>{MENU.page=(MENU.page+10)%11;}});
  MENU_RECTS.push({x:VW-80,y:0,w:80,h:VH,act:()=>{MENU.page=(MENU.page+1)%11;}});
  MENU_RECTS.push({x:80,y:0,w:VW-160,h:30,act:()=>menuBack()});
}
/* ---------- 整备画面 ---------- */
function drawUpgrade(){
  uctx.globalAlpha=0.84; upx(0,0,VW,VH,PAL.ink); uctx.globalAlpha=1;
  TAP_RECTS=[];
  uPanel(48,8,VW-96,VH-28,PAL.gold,0.72);
  txtO(T('upgT'),VW/2,12,13,PAL.gold,'center');
  txt(T('upgPts')+': '+RUN.pts,VW/2,30,10,PAL.gold,'center');
  const rows=[['upgHp','hp'],['upgSpd','spd'],['upgAtk','atk'],['upgDef','def']];
  rows.forEach((r,i)=>{
    const y=52+i*24, sel=ST.upg.sel===i;
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
  txt(TF('upgStat',{a:Math.round(st.maxHp),s:Math.round((st.speed/88-1)*100),k:Math.round((st.atk-1)*100),d:Math.round(st.def*100)}),VW/2,152,9,PAL.acid,'center');
  if(ST.upg.from==='win')txt(TF('winOpt',{n:RUN.cycle+2}),VW/2,166,7,PAL.white,'center');
  const blink=(ST.t%1.2)<0.86;
  if(blink)txtO(T('upgHint'),VW/2,VH-40,7,PAL.lite,'center');
  TAP_RECTS.push({x:VW/2-70,y:VH-26,w:140,h:18,act:()=>deployFromUpgrade()});
  if(blink)txt('[ ⏎ / A ]',VW/2,VH-22,9,PAL.gold,'center');
  TAP_RECTS.push({x:6,y:VH-26,w:90,h:18,act:()=>{refundAll();SFX.heal();}});
  txt('R: '+T('upgRefund'),10,VH-22,7,PAL.lite);
}
