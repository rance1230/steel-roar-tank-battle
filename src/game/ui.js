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
  txt(foot||navHintDyn(),x+W/2,y+H-14,8,foot&&MENU.capture?PAL.gold:PAL.lite,'center');
  if(id==='title'){
    uPanel(VW/2-134,VH-28,268,20,PAL.cyan,0.58);
    /* 底部输入模式条: 高亮当前生效模式 */
    const m=inMode(),segs=[['KEYBOARD','key'],['GAMEPAD','pad'],['TOUCH','touch']];
    uctx.font='bold 7px '+FONT;
    let sx=VW/2;
    for(const s of segs)sx-=uctx.measureText(s[0]).width+9;
    for(const [label,mode] of segs){
      txt(label,sx,VH-22,7,mode===m?PAL.gold:PAL.steel);
      sx+=uctx.measureText(label).width+9;
    }
  }
}
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

/* ============================================================
   战前键位速览 (ctrl 状态): 动态演示手柄/触屏/键盘布局
   ============================================================ */
const CTRL_ACTS=[
  {id:'move',  t:'cMove'},
  {id:'mg',    t:'cMg'},
  {id:'cannon',t:'cCannon'},
  {id:'msl',   t:'cMsl'},
  {id:'strike',t:'cStrike'},
  {id:'sprint',t:'cSprint'},
  {id:'shield',t:'cShield'},
  {id:'pause', t:'cPause'}];
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
  const X=16,Y=44,W=286,H=186;
  uPanel(X,Y,W,H,PAL.cyan,0.86);
  if(mode===0)drawCtrlPad(hot);
  else if(mode===1)drawCtrlTouch(hot);
  else drawCtrlKeys(hot);
  /* 右: 动作列表(当前项高亮, 动态步进) */
  const RX=308,RY=44,RW=156,RH=186;
  uPanel(RX,RY,RW,RH,PAL.gold,0.86);
  CTRL_ACTS.forEach((a,i)=>{
    const ry=RY+8+i*22, sel=i===idx;
    if(sel){ upx(RX+6,ry,RW-12,20,rgba(PAL.gold,0.22)); txt('▶',RX+10,ry+6,7,PAL.gold); }
    txt(T(a.t),RX+22,ry+6,8,sel?PAL.white:PAL.lite);
    const k=ctrlKeyOf(a.id,mode);
    if(k)txt(k,RX+RW-10,ry+6,8,sel?PAL.gold:PAL.steel,'right');
    TAP_RECTS.push({x:RX+4,y:ry-2,w:RW-8,h:22,act:()=>{ST.ctrlT=i*1.7;SFX.pick();}});
  });
  /* 底部: 确认出击提示(闪烁) + 手柄别名注 */
  if((ST.t*2%1)<0.66)
    txtO(mode===1?T('ctrlGoT'):TF('ctrlGoP',{k:mode===0?padBtnName(SET.pad.confirm):'ENTER'}),
      VW/2,238,10,PAL.white,'center');
  if(mode===0)txt(T('ctrlAlias'),VW/2,254,6,PAL.steel,'center');
  TAP_RECTS.push({x:VW/2-90,y:232,w:180,h:22,act:()=>exitCtrlIntro()});
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
  /* 十字键 (HAT轴/按钮12-15) */
  const dx=cx-78,dy=cy+34;
  ctrlKeycap(dx-6,dy-22,12,10,'↑',hot==='move');
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
function drawCtrlTouch(hot){
  /* 手机屏幕框 */
  upx(40,58,240,158,rgba(PAL.panel,0.30));
  uctx.strokeStyle=PAL.steel; uctx.strokeRect(40.5,58.5,239,157);
  /* 方向键(左) */
  ctrlKeycap(96,96,20,18,'▲',hot==='move');
  ctrlKeycap(72,120,20,18,'◀',hot==='move');
  ctrlKeycap(120,120,20,18,'▶',hot==='move');
  ctrlKeycap(96,144,20,18,'▼',hot==='move');
  /* 动作键(右) */
  ctrlBtn(238,168,15,T('cMg').slice(0,2),hot==='mg');
  ctrlBtn(204,190,11,T('cCannon').slice(0,2),hot==='cannon');
  ctrlBtn(204,108,11,T('cMsl').slice(0,2),hot==='msl');
  ctrlBtn(238,84,11,T('cStrike').slice(0,2),hot==='strike');
  ctrlBtn(176,150,11,T('cSprint').slice(0,2),hot==='sprint');
  ctrlBtn(176,108,11,T('cShield').slice(0,2),hot==='shield');
  ctrlKeycap(252,66,20,12,'❚❚',hot==='pause');
  txt('TAP',96,178,6,PAL.steel,'center');
}
/* 键盘布局图解 */
function drawCtrlKeys(hot){
  /* WASD 方向 */
  ctrlKeycap(88,82,20,18,'W',hot==='move');
  ctrlKeycap(66,104,20,18,'A',hot==='move');
  ctrlKeycap(88,104,20,18,'S',hot==='move');
  ctrlKeycap(110,104,20,18,'D',hot==='move');
  /* 武器键 */
  ctrlKeycap(160,96,22,18,'J',hot==='mg');
  ctrlKeycap(186,96,22,18,'K',hot==='cannon');
  ctrlKeycap(212,96,22,18,'L',hot==='msl');
  ctrlKeycap(238,96,22,18,'U',hot==='strike');
  /* 功能键 */
  ctrlKeycap(160,140,48,18,'SHIFT',hot==='sprint');
  ctrlKeycap(212,140,48,18,'SPACE',hot==='shield');
  ctrlKeycap(160,168,22,18,'P',hot==='pause');
  ctrlKeycap(186,168,60,18,'ENTER',false);
  txt('WASD / ARROWS',99,132,6,PAL.steel,'center');
}
