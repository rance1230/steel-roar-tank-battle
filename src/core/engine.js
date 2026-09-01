"use strict";
/* core/engine — 输入(键/柄/触) */

/* ---------- PHASE 2: 60Hz 固定步长循环 + 性能管理 ----------
   逻辑固定 60Hz(与刷新率解耦), 渲染随 rAF 自适应 60/75/120/144Hz,
   render(alpha) 使用插值坐标; 性能不足时 AUTO 档只降特效不降逻辑。 */
const PERF={
  show:false,fps:60,_frames:0,_ft:0,updateMs:0,renderMs:0,updates:0,
  quality:'AUTO',qLevel:2,_qT:0,
  mul(){ return [0.4,0.7,1][this.qLevel]; },
  maxParts(){ return [240,380,560][this.qLevel]; },   /* v1.7: 地形特效增强后上调 */
};
const STEP=1000/60;
let _last=0,_acc=0,_UPDATE=null,_RENDER=null;
function gameFrame(now){
  requestAnimationFrame(gameFrame);
  let delta=now-_last; _last=now;
  if(!(delta>0)||delta>100)delta=100;
  if(typeof HITSTOP!=='undefined'&&HITSTOP>0){
    HITSTOP-=delta;                       /* 顿帧: 冻结逻辑, 仅渲染 */
    if(HITSTOP<0)HITSTOP=0;
    _acc=0;
  }
  else{
  _acc+=delta;
  const u0=performance.now();
  let n=0;
  while(_acc>=STEP&&n<5){ _UPDATE(1/60); _acc-=STEP; n++; PERF.updates++; }
  if(n===5)_acc=0; /* 防死亡螺旋: 丢弃积压, 逻辑节奏仍为60Hz */
  }
  PERF.updateMs=PERF.updateMs*0.9+(performance.now()-(typeof u0!=='undefined'?u0:performance.now()))*0.1;
  const r0=performance.now();
  _RENDER(_acc/STEP);
  PERF.renderMs=PERF.renderMs*0.9+(performance.now()-r0)*0.1;
  PERF._frames++; PERF._ft+=delta;
  if(PERF._ft>=500){ PERF.fps=Math.round(PERF._frames*1000/PERF._ft); PERF._frames=0; PERF._ft=0; }
  if(PERF.quality==='AUTO'){
    PERF._qT+=delta;
    if(PERF._qT>2000){ PERF._qT=0;
      const ft=1000/Math.max(1,PERF.fps);
      if(ft>20&&PERF.qLevel>0)PERF.qLevel--;
      else if(ft<12.5&&PERF.qLevel<2)PERF.qLevel++; } }
}
function startGameLoop(updateFn,renderFn){
  _UPDATE=updateFn; _RENDER=renderFn;
  requestAnimationFrame(t=>{ _last=t; requestAnimationFrame(gameFrame); });
}

/* ============================================================
   输入: 键盘 + 虚拟键 + 手柄
   ============================================================ */
const keys=new Set(), VKEYS=new Set();
const GAME_CODES=new Set(['F3','KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyJ','KeyK','KeyL','KeyU','Space','ShiftLeft','ShiftRight','Enter','KeyR','KeyQ','KeyP','KeyM','Escape','Backspace']);
addEventListener('keydown',e=>{
  if(GAME_CODES.has(e.code))e.preventDefault();
  initAudio(); setInMode('key');
  if(e.repeat)return;
  keys.add(e.code);
  onKeyPress(e.code);
});
addEventListener('keyup',e=>keys.delete(e.code));
function anyHold(c){ return keys.has(c)||VKEYS.has(c); }
const IN={
  up:()=>anyHold('KeyW')||anyHold('ArrowUp')||PAD.hold.up,
  down:()=>anyHold('KeyS')||anyHold('ArrowDown')||PAD.hold.down,
  left:()=>anyHold('KeyA')||anyHold('ArrowLeft')||PAD.hold.left,
  right:()=>anyHold('KeyD')||anyHold('ArrowRight')||PAD.hold.right,
  mg:()=>anyHold('KeyJ')||PAD.hold.mg,
  cannon:()=>anyHold('KeyK')||PAD.hold.cannon,
  msl:()=>anyHold('KeyL')||PAD.hold.msl,
  strike:()=>anyHold('KeyU')||PAD.hold.strike,
  sprint:()=>anyHold('ShiftLeft')||anyHold('ShiftRight')||PAD.hold.sprint,
};
/* ---------- 手柄 (Gamepad API: 蓝牙/有线统一) ---------- */
const PAD={hold:{},just:{},prev:{},gp:null,seen:false,ax:0,ay:0};
/* 扳机别名: 未自定义该动作时,扳机键同步生效(适配盖世小鸡X2S等带ZL/ZR的手柄) */
const PAD_ALIAS={mg:[7],shield:[6]};
const PAD_BTN_NAMES=['A','B','X','Y','LB','RB','LT','RT','SEL','STA','L3','R3','↑','↓','←','→'];
function padBtnName(i){ return (i>=0&&i<PAD_BTN_NAMES.length)?PAD_BTN_NAMES[i]:('BTN'+i); }
/* ---------- 输入方式感知 (pad/touch/key): 最后使用的输入决定界面提示 ---------- */
let INMODE=null;
function inMode(){ if(INMODE)return INMODE;
  return PAD.gp?'pad':((SET.touch!=='off'&&hasTouch)?'touch':'key'); }
function setInMode(m){ if(m&&INMODE!==m){INMODE=m;} }
const KEY_NAMES={mg:'J',cannon:'K',msl:'L',strike:'U',sprint:'SHIFT',shield:'SPACE',pause:'P',confirm:'ENTER',back:'ESC'};
/* keyHint(a): 当前输入方式下动作 a 的提示按键名; 触屏模式返回 ''(虚拟按钮自带中文标签) */
function keyHint(a){
  const m=inMode();
  if(m==='pad'){ const bi=(SET.pad&&SET.pad[a]!==undefined)?SET.pad[a]:-1; return bi<0?'':padBtnName(bi); }
  if(m==='touch')return '';
  return KEY_NAMES[a]||'';
}
function pollPad(){
  const gps=navigator.getGamepads?navigator.getGamepads():[];
  let gp=null; for(const g of gps){ if(g&&g.connected){gp=g;break;} }
  PAD.gp=gp;
  const h={};
  if(gp){
    const b=i=>gp.buttons[i]&&gp.buttons[i].pressed;
    const ax=gp.axes[0]||0,ay=gp.axes[1]||0,DZ=0.35;
    /* HAT 轴十字键(安卓HID手柄如盖世小鸡X2S的Android模式以 axes[9]/axes[10] 上报方向) */
    const hx=gp.axes.length>10?(gp.axes[9]||0):0, hy=gp.axes.length>10?(gp.axes[10]||0):0, HDZ=0.5;
    const am=Math.hypot(ax,ay);   /* vNext: 模拟轴原生360°输入(死区0.18) */
    PAD.ax=am>0.18?ax:0; PAD.ay=am>0.18?ay:0;
    if(ax<-DZ||hx<-HDZ||b(14))h.left=true; if(ax>DZ||hx>HDZ||b(15))h.right=true;
    if(ay<-DZ||hy<-HDZ||b(12))h.up=true;   if(ay>DZ||hy>HDZ||b(13))h.down=true;
    for(const a in SET.pad){ const bi=SET.pad[a];
      let on=bi>=0&&gp.buttons[bi]&&gp.buttons[bi].pressed;
      if(!on&&PAD_ALIAS[a]&&bi===SET_DEF.pad[a])
        for(const ai of PAD_ALIAS[a]){ if(gp.buttons[ai]&&gp.buttons[ai].pressed){on=true;break;} }
      if(on)h[a]=true; }
    if(!PAD.seen){ PAD.seen=true; showToast(T('padConn')); SFX.pick(); }
    if(MENU&&MENU.capture){ for(let i=0;i<gp.buttons.length;i++)
      if(gp.buttons[i].pressed){ SET.pad[MENU.capture]=i; MENU.capture=null; saveSet(); SFX.pick(); break; } }
    /* 任一实体输入(按键/摇杆/十字键)即切换到手柄提示 */
    let act=am>0.3||Math.abs(hx)>HDZ||Math.abs(hy)>HDZ;
    if(!act)for(let i=0;i<gp.buttons.length;i++)if(gp.buttons[i]&&gp.buttons[i].pressed){act=true;break;}
    if(act)setInMode('pad');
  }
  if(!gp){PAD.ax=VJ.ax;PAD.ay=VJ.ay;}
  else if(Math.abs(VJ.ax)+Math.abs(VJ.ay)>0.02){PAD.ax=VJ.ax;PAD.ay=VJ.ay;}   /* 触屏摇杆优先于闲置手柄轴 */
  PAD.just={}; for(const k in h)PAD.just[k]=h[k]&&!PAD.prev[k];
  for(const k in PAD.prev)if(!(k in h))PAD.just[k]=false;
  PAD.hold=h; PAD.prev=h;
}
addEventListener('gamepadconnected',()=>{ pollPad(); if(PAD.gp){showToast(T('padConn')); setInMode('pad');} });
/* ---------- 触屏虚拟按键 (v1.5: 圆形玻璃按钮 + 模拟摇杆圆环) ---------- */
const hasTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0||matchMedia('(pointer:coarse)').matches;
const OVL=document.getElementById('touchovl');
const TBTNS=[];
/* 虚拟摇杆轴: [-1,1], 幅度=速度比例; pollPad 无手柄时合入 PAD.ax/ay */
const VJ={ax:0,ay:0};
function tbtn(label,ic,css,code,press,parent){
  const el=document.createElement('div'); el.className='tbtn';
  el.innerHTML=(ic?'<span class="ic">'+ic+'</span>':'')+'<span>'+label+'</span>';
  for(const k in css)el.style[k]=css[k];
  const down=e=>{ e.preventDefault(); el.classList.add('on'); setInMode('touch');
    if(press){ onKeyPress(code); VKEYS.add(code); } else { VKEYS.add(code); } };
  const up=e=>{ e.preventDefault(); el.classList.remove('on'); VKEYS.delete(code); };
  el.addEventListener('pointerdown',down);
  el.addEventListener('pointerup',up); el.addEventListener('pointercancel',up); el.addEventListener('pointerleave',up);
  el.addEventListener('contextmenu',e=>e.preventDefault());
  (parent||OVL).appendChild(el); TBTNS.push(el);
  return el;
}
(function buildTouch(){
  /* 双簇布局: 左(摇杆)与右(动作)各占 40% 屏宽, 物理隔离永不重叠; 中心 20% 留给画面 */
  const S='clamp(44px,11vmin,64px)', L='clamp(54px,13vmin,82px)';
  const mkCluster=(css)=>{ const d=document.createElement('div');
    d.style.cssText='position:absolute;bottom:0;height:100%;width:40%;pointer-events:none;'+css;
    OVL.appendChild(d); return d; };
  const cl=mkCluster('left:0;'), cr=mkCluster('right:0;');
  const B=(pa,label,ic,css,code,press)=>tbtn(label,ic,css,code,press,pa);
  /* ---- 左簇: 模拟摇杆圆环 (v1.5 替代四方向键; 360°+幅度, 数字方向仅作菜单兼容) ---- */
  const joy=document.createElement('div'); joy.id='joy';
  joy.innerHTML='<div class="jstick"></div>'+
    '<span class="jd jt">▲</span><span class="jd jb">▼</span>'+
    '<span class="jd jl">◀</span><span class="jd jr">▶</span>';
  cl.appendChild(joy);
  const stick=joy.querySelector('.jstick');
  const setStick=(dx,dy)=>{ stick.style.transform='translate('+dx.toFixed(1)+'px,'+dy.toFixed(1)+'px)'; };
  const jcenter=()=>{ const r=joy.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,max:r.width/2*0.62}; };
  let jid=null;
  const DIRS=['KeyW','KeyS','KeyA','KeyD'];
  const jmove=e=>{
    if(jid!==e.pointerId)return;
    const c=jcenter();
    let dx=e.clientX-c.x, dy=e.clientY-c.y;
    const d=Math.hypot(dx,dy);
    if(d>c.max){ dx*=c.max/d; dy*=c.max/d; }
    setStick(dx,dy);
    const m=Math.hypot(dx,dy)/c.max;
    if(m<0.12){ VJ.ax=0; VJ.ay=0; }                 /* 死区 */
    else { VJ.ax=dx/c.max; VJ.ay=dy/c.max; }
    DIRS.forEach(k=>VKEYS.delete(k));
    const on=VJ.ay<-0.38, down=VJ.ay>0.38, lf=VJ.ax<-0.38, rt=VJ.ax>0.38;
    if(on)VKEYS.add('KeyW'); if(down)VKEYS.add('KeyS'); if(lf)VKEYS.add('KeyA'); if(rt)VKEYS.add('KeyD');
    joy.classList.toggle('jU',on); joy.classList.toggle('jD',down);
    joy.classList.toggle('jL',lf); joy.classList.toggle('jR',rt);
  };
  joy.addEventListener('pointerdown',e=>{ e.preventDefault(); jid=e.pointerId;
    try{joy.setPointerCapture(jid);}catch(_){ }
    joy.classList.add('on'); setInMode('touch'); jmove(e); });
  joy.addEventListener('pointermove',jmove);
  const jend=e=>{ if(jid!==e.pointerId)return; jid=null;
    VJ.ax=0; VJ.ay=0; setStick(0,0); joy.classList.remove('on','jU','jD','jL','jR');
    DIRS.forEach(k=>VKEYS.delete(k)); };
  joy.addEventListener('pointerup',jend); joy.addEventListener('pointercancel',jend);
  joy.addEventListener('contextmenu',e=>e.preventDefault());
  /* ---- 右簇: 2列动作网格(贴最右缘, 全圆形玻璃) ---- */
  B(cr,'机枪','●',{right:'4px',bottom:'calc('+S+'/2 + 10px)',width:L,height:L},'KeyJ');
  B(cr,'主炮','◆',{right:'calc('+L+' + 14px)',bottom:'2px',width:S,height:S},'KeyK');
  B(cr,'加速','»',{right:'calc('+L+' + 14px)',bottom:'calc('+S+'*1.18)',width:S,height:S},'ShiftLeft');
  B(cr,'导弹','▲',{right:'calc('+L+' + 14px)',bottom:'calc('+S+'*2.36)',width:S,height:S},'KeyL');
  B(cr,'护盾','⬡',{right:'4px',bottom:'calc('+L+' + '+S+'*0.95)',width:S,height:S},'Space',true);
  B(cr,'空袭','✈',{right:'4px',bottom:'calc('+L+' + '+S+'*2.15)',width:S,height:S},'KeyU',true);
  /* 暂停: 右上角 */
  tbtn('暂停','❚❚',{right:'8px',top:'8px',width:'clamp(40px,9vmin,54px)',height:'clamp(40px,9vmin,54px)'},'KeyP',true);
})();
function updOvl(){
  /* 触屏按钮层: 虚拟按钮=开 时强制显示; auto 时触屏设备显示, 但当前用手柄则隐藏(回到触屏一点即恢复) */
  const show=((SET.touch==='on')||(SET.touch==='auto'&&hasTouch&&inMode()!=='pad'))&&!MENU&&(ST.state==='play'||ST.state==='intro');
  const d=show?'block':'none';
  if(OVL.style.display!==d)OVL.style.display=d;
}
let toastT=null;
function showToast(msg){ const el=document.getElementById('toast');
  el.textContent=msg; el.style.display='block';
  if(toastT)clearTimeout(toastT); toastT=setTimeout(()=>{el.style.display='none';},1800); }
/* ---------- 画布触控(菜单/整备点击) ---------- */
cv.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  if(e.pointerType==='touch')setInMode('touch');
  initAudio();
  const r=cv.getBoundingClientRect();
  const x=(e.clientX-r.left)/r.width*VW, y=(e.clientY-r.top)/r.height*VH;
  const rects=MENU_RECTS.concat(TAP_RECTS);
  for(let i=rects.length-1;i>=0;i--){ const q=rects[i];
    if(x>=q.x&&x<=q.x+q.w&&y>=q.y&&y<=q.y+q.h){ q.act(); return; } }
  if(!MENU){ // 无菜单时的快捷点击
    if(ST.state==='clear'||ST.state==='intro'||ST.state==='ctrl'||ST.state==='win')onKeyPress('Enter');
    else if(ST.state==='over')onKeyPress('KeyR');
  }
});
document.addEventListener('touchmove',e=>{ if(OVL.style.display==='block')e.preventDefault(); },{passive:false});
