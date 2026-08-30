"use strict";
/* core/engine — 输入(键/柄/触) */

/* ---------- PHASE 2: 60Hz 固定步长循环 + 性能管理 ----------
   逻辑固定 60Hz(与刷新率解耦), 渲染随 rAF 自适应 60/75/120/144Hz,
   render(alpha) 使用插值坐标; 性能不足时 AUTO 档只降特效不降逻辑。 */
const PERF={
  show:false,fps:60,_frames:0,_ft:0,updateMs:0,renderMs:0,updates:0,
  quality:'AUTO',qLevel:2,_qT:0,
  mul(){ return [0.4,0.7,1][this.qLevel]; },
  maxParts(){ return [200,320,420][this.qLevel]; },
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
  initAudio();
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
function pollPad(){
  const gps=navigator.getGamepads?navigator.getGamepads():[];
  let gp=null; for(const g of gps){ if(g&&g.connected){gp=g;break;} }
  PAD.gp=gp;
  const h={};
  if(gp){
    const b=i=>gp.buttons[i]&&gp.buttons[i].pressed;
    const ax=gp.axes[0]||0,ay=gp.axes[1]||0,DZ=0.35;
    const am=Math.hypot(ax,ay);   /* vNext: 模拟轴原生360°输入(死区0.18) */
    PAD.ax=am>0.18?ax:0; PAD.ay=am>0.18?ay:0;
    if(ax<-DZ||b(14))h.left=true; if(ax>DZ||b(15))h.right=true;
    if(ay<-DZ||b(12))h.up=true;   if(ay>DZ||b(13))h.down=true;
    for(const a in SET.pad){ const bi=SET.pad[a]; if(bi>=0&&gp.buttons[bi])h[a]=!!gp.buttons[bi].pressed; }
    if(!PAD.seen){ PAD.seen=true; showToast(T('padConn')); SFX.pick(); }
    if(MENU&&MENU.capture){ for(let i=0;i<gp.buttons.length;i++)
      if(gp.buttons[i].pressed){ SET.pad[MENU.capture]=i; MENU.capture=null; saveSet(); SFX.pick(); break; } }
  }
  if(!gp){PAD.ax=0;PAD.ay=0;}
  PAD.just={}; for(const k in h)PAD.just[k]=h[k]&&!PAD.prev[k];
  for(const k in PAD.prev)if(!(k in h))PAD.just[k]=false;
  PAD.hold=h; PAD.prev=h;
}
addEventListener('gamepadconnected',()=>{ pollPad(); if(PAD.gp)showToast(T('padConn')); });
/* ---------- 触屏虚拟按键 ---------- */
const hasTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0||matchMedia('(pointer:coarse)').matches;
const OVL=document.getElementById('touchovl');
const TBTNS=[];
function tbtn(label,ic,css,code,press){
  const el=document.createElement('div'); el.className='tbtn';
  el.innerHTML=(ic?'<span class="ic">'+ic+'</span>':'')+'<span>'+label+'</span>';
  for(const k in css)el.style[k]=css[k];
  const down=e=>{ e.preventDefault(); el.classList.add('on');
    if(press){ onKeyPress(code); VKEYS.add(code); } else { VKEYS.add(code); } };
  const up=e=>{ e.preventDefault(); el.classList.remove('on'); VKEYS.delete(code); };
  el.addEventListener('pointerdown',down);
  el.addEventListener('pointerup',up); el.addEventListener('pointercancel',up); el.addEventListener('pointerleave',up);
  el.addEventListener('contextmenu',e=>e.preventDefault());
  OVL.appendChild(el); TBTNS.push(el);
  return el;
}
(function buildTouch(){
  const S='clamp(46px,12vmin,68px)', L='clamp(56px,15vmin,84px)';
  const pos=(r,b,s)=>({right:'calc('+r+' )',bottom:'calc('+b+')',width:s,height:s});
  tbtn('上','▲',{left:'clamp(12px,7vmin,96px)',bottom:'clamp(140px,34vmin,220px)',width:S,height:S},'KeyW');
  tbtn('下','▼',{left:'clamp(12px,7vmin,96px)',bottom:'clamp(8px,4vmin,40px)',width:S,height:S},'KeyS');
  tbtn('左','◀',{left:'clamp(76px,2vmin,20px)',bottom:'clamp(72px,19vmin,128px)',width:S,height:S},'KeyA');
  tbtn('右','▶',{left:'calc(clamp(12px,7vmin,96px) + clamp(52px,13vmin,74px))',bottom:'clamp(72px,19vmin,128px)',width:S,height:S},'KeyD');
  tbtn('机枪','●',{right:'clamp(10px,4vmin,44px)',bottom:'clamp(64px,16vmin,116px)',width:L,height:L},'KeyJ');
  tbtn('主炮','◆',{right:'clamp(76px,18vmin,128px)',bottom:'clamp(8px,4vmin,40px)',width:S,height:S},'KeyK');
  tbtn('导弹','▲',{right:'clamp(76px,18vmin,128px)',bottom:'clamp(120px,29vmin,200px)',width:S,height:S},'KeyL');
  tbtn('空袭','✈',{right:'clamp(10px,4vmin,44px)',bottom:'clamp(148px,36vmin,240px)',width:S,height:S},'KeyU',true);
  tbtn('加速','»',{right:'clamp(142px,32vmin,220px)',bottom:'clamp(64px,16vmin,116px)',width:S,height:S},'ShiftLeft');
  tbtn('护盾','⬡',{right:'clamp(142px,32vmin,220px)',bottom:'clamp(148px,36vmin,240px)',width:S,height:S},'Space',true);
  tbtn('暂停','❚❚',{right:'8px',top:'8px',width:'clamp(40px,9vmin,54px)',height:'clamp(40px,9vmin,54px)'},'KeyP',true);
})();
function updOvl(){
  const show=(SET.touch==='on'||(SET.touch==='auto'&&hasTouch))&&!MENU&&(ST.state==='play'||ST.state==='intro');
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
  initAudio();
  const r=cv.getBoundingClientRect();
  const x=(e.clientX-r.left)/r.width*VW, y=(e.clientY-r.top)/r.height*VH;
  const rects=MENU_RECTS.concat(TAP_RECTS);
  for(let i=rects.length-1;i>=0;i--){ const q=rects[i];
    if(x>=q.x&&x<=q.x+q.w&&y>=q.y&&y<=q.y+q.h){ q.act(); return; } }
  if(!MENU){ // 无菜单时的快捷点击
    if(ST.state==='clear'||ST.state==='intro')onKeyPress('Enter');
    else if(ST.state==='over')onKeyPress('KeyR');
  }
});
document.addEventListener('touchmove',e=>{ if(OVL.style.display==='block')e.preventDefault(); },{passive:false});
