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
const GAME_CODES=new Set(['F3','KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyI','KeyJ','KeyK','KeyL','KeyU','Space','ShiftLeft','ShiftRight','Enter','KeyR','KeyQ','KeyP','KeyM','Escape','Backspace']);
addEventListener('keydown',e=>{
  if(GAME_CODES.has(e.code))e.preventDefault();
  initAudio(); setInMode('key');
  if(e.repeat)return;
  keys.add(e.code);
  onKeyPress(e.code);
});
addEventListener('keyup',e=>keys.delete(e.code));
function anyHold(c){ return keys.has(c)||VKEYS.has(c); }
const IN={   /* v1.8 契约§1: 方向键由移动改为瞄准(8向数字量→pollPad 合入 PAD.rax/ray), 移动=WASD/左摇杆 */
  up:()=>anyHold('KeyW')||PAD.hold.up,
  down:()=>anyHold('KeyS')||PAD.hold.down,
  left:()=>anyHold('KeyA')||PAD.hold.left,
  right:()=>anyHold('KeyD')||PAD.hold.right,
  mg:()=>anyHold('KeyJ')||PAD.hold.mg,
  cannon:()=>anyHold('KeyK')||PAD.hold.cannon,
  msl:()=>anyHold('KeyL')||PAD.hold.msl,
  strike:()=>anyHold('KeyU')||PAD.hold.strike,
  lock:()=>anyHold('KeyI')||PAD.hold.lock,
  sprint:()=>anyHold('ShiftLeft')||anyHold('ShiftRight')||PAD.hold.sprint,
};
/* ---------- 手柄 (Gamepad API: 蓝牙/有线统一) ---------- */
const PAD={hold:{},just:{},prev:{},gp:null,seen:false,ax:0,ay:0,rax:0,ray:0};   /* rax/ray: 右摇杆瞄准轴(v1.8) */
/* 扳机别名: 未自定义该动作时,扳机键同步生效(适配盖世小鸡X2S等带ZL/ZR的手柄) */
const PAD_ALIAS={mg:[7],shield:[6]};
const PAD_BTN_NAMES=['A','B','X','Y','LB','RB','LT','RT','SEL','STA','L3','R3','↑','↓','←','→'];
function padBtnName(i){ return (i>=0&&i<PAD_BTN_NAMES.length)?PAD_BTN_NAMES[i]:('BTN'+i); }
/* ---------- 输入方式感知 (pad/touch/key): 最后使用的输入决定界面提示 ---------- */
let INMODE=null;
function inMode(){ if(INMODE)return INMODE;
  return PAD.gp?'pad':((SET.touch!=='off'&&hasTouch)?'touch':'key'); }
function setInMode(m){ if(m&&INMODE!==m){INMODE=m;} }
const KEY_NAMES={mg:'J',cannon:'K',msl:'L',strike:'U',lock:'I',sprint:'SHIFT',shield:'SPACE',pause:'P',confirm:'ENTER',back:'ESC'};
/* keyHint(a): 当前输入方式下动作 a 的提示按键名; 触屏模式返回 ''(虚拟按钮自带中文标签) */
function keyHint(a){
  const m=inMode();
  if(m==='pad'){ const bi=(SET.pad&&SET.pad[a]!==undefined)?SET.pad[a]:-1; return bi<0?'':padBtnName(bi); }
  if(m==='touch')return '';
  return KEY_NAMES[a]||'';
}
function pollPad(){
  PAD.rax=0; PAD.ray=0; // Recompute every frame: released keyboard/touch axes must not stick.
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
    const rax0=gp.axes[2]||0, ray0=gp.axes[3]||0, rmag=Math.hypot(rax0,ray0);   /* v1.8 W1: 右摇杆→瞄准 */
    PAD.rax=rmag>0.18?rax0:0; PAD.ray=rmag>0.18?ray0:0;
    if(ax<-DZ||hx<-HDZ||b(14))h.left=true; if(ax>DZ||hx>HDZ||b(15))h.right=true;
    if(ay<-DZ||hy<-HDZ||b(12))h.up=true;   if(ay>DZ||hy>HDZ||b(13))h.down=true;
    for(const a in SET.pad){ const bi=SET.pad[a];
      let on=bi>=0&&gp.buttons[bi]&&gp.buttons[bi].pressed;
      if(!on&&PAD_ALIAS[a]&&bi===SET_DEF.pad[a])
        for(const ai of PAD_ALIAS[a]){ if(gp.buttons[ai]&&gp.buttons[ai].pressed){on=true;break;} }
      if(on)h[a]=true; }
    if(!PAD.seen){ PAD.seen=true; showToast(T('padConn')); SFX.pick(); }
    /* 改键捕获: 先快照进入捕获时按住的按钮(如确认键A), 全部松开后才武装, 防止确认键被误绑 */
    if(MENU&&MENU.capture){
      const cap=MENU.capture;
      if(!cap.hold){ cap.hold=[];
        for(let i=0;i<gp.buttons.length;i++) if(gp.buttons[i]&&gp.buttons[i].pressed) cap.hold.push(i);
      } else if(!cap.hold.some(i=>gp.buttons[i]&&gp.buttons[i].pressed)){
        let bi=-1;
        for(let i=0;i<gp.buttons.length;i++) if(gp.buttons[i]&&gp.buttons[i].pressed){bi=i;break;}
        if(bi<0&&gp.axes.length>10){   /* HAT 十字键(安卓HID手柄走axes) → 虚拟按钮12-15 */
          if(hy<-HDZ)bi=12; else if(hy>HDZ)bi=13; else if(hx<-HDZ)bi=14; else if(hx>HDZ)bi=15;
        }
        if(bi>=0){ SET.pad[cap.act]=bi; MENU.capture=null; saveSet(); SFX.pick();
          showToast(TF('padSet',{a:padActLabel(cap.act),b:padBtnName(bi)})); }
      }
    }
    /* 任一实体输入(按键/摇杆/十字键)即切换到手柄提示 */
    let act=am>0.3||rmag>0.3||Math.abs(hx)>HDZ||Math.abs(hy)>HDZ;
    if(!act)for(let i=0;i<gp.buttons.length;i++)if(gp.buttons[i]&&gp.buttons[i].pressed){act=true;break;}
    if(act){setInMode('pad');
      const now=performance.now();
      if((!AC||AC.state!=='running')&&(!PAD.audioWakeAt||now-PAD.audioWakeAt>1000)){PAD.audioWakeAt=now;initAudio();}
    }
  }
  if(!gp){PAD.ax=VJ.ax;PAD.ay=VJ.ay;}
  else if(Math.abs(VJ.ax)+Math.abs(VJ.ay)>0.02){PAD.ax=VJ.ax;PAD.ay=VJ.ay;}   /* 触屏摇杆优先于闲置手柄轴 */
  /* v1.8 W1: 瞄准轴合并 — 手柄右杆 > 触屏右杆 > 键盘方向键(8向归一) */
  if(Math.abs(VR.ax)+Math.abs(VR.ay)>0.02){PAD.rax=VR.ax;PAD.ray=VR.ay;}
  else if(Math.abs(PAD.rax)+Math.abs(PAD.ray)<=0.02){
    const kx=(anyHold('ArrowRight')?1:0)-(anyHold('ArrowLeft')?1:0),
          ky=(anyHold('ArrowDown')?1:0)-(anyHold('ArrowUp')?1:0);
    if(kx||ky){const km=Math.hypot(kx,ky);PAD.rax=kx/km;PAD.ray=ky/km;}
  }
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
const VR={ax:0,ay:0};          /* v1.8 W1: 右虚拟摇杆(瞄准), 合入 PAD.rax/ray */
let RESET_JOY=()=>{};
const STICKS=[];               /* v1.8: 双摇杆统一登记, resetTransientInput 用 */
function tbtn(label,ic,css,code,press,parent){
  const el=document.createElement('button'); el.type='button'; el.className='tbtn';
  el.dataset.action=code; el.setAttribute('aria-label',label);
  el.innerHTML=(ic?'<span class="ic">'+ic+'</span>':'')+'<span>'+label+'</span>';
  for(const k in css)el.style[k]=css[k];
  let pid=null;
  const down=e=>{ e.preventDefault(); if(pid!==null)return; pid=e.pointerId;
    try{el.setPointerCapture(pid);}catch(_){ }
    el.classList.add('on'); setInMode('touch');
    if(press){ onKeyPress(code); VKEYS.add(code); } else { VKEYS.add(code); } };
  const up=(e,force=false)=>{ if(pid===null||(!force&&e.pointerId!==pid))return;
    if(e)e.preventDefault(); const old=pid; pid=null;
    el.classList.remove('on'); VKEYS.delete(code);
    try{if(el.hasPointerCapture(old))el.releasePointerCapture(old);}catch(_){ } };
  el._touchRelease=()=>up(null,true);
  el.addEventListener('pointerdown',down);
  el.addEventListener('pointerup',up); el.addEventListener('pointercancel',up); el.addEventListener('lostpointercapture',up);
  el.addEventListener('contextmenu',e=>e.preventDefault());
  (parent||OVL).appendChild(el); TBTNS.push(el);
  return el;
}
(function buildTouch(){
  /* 双簇布局: 左摇杆靠近拇指自然落点, 右动作区留出安全区并保持两列分层。 */
  const S='var(--touch-s)', L='var(--touch-l)';
  const mkCluster=(css)=>{ const d=document.createElement('div');
    d.style.cssText='position:absolute;bottom:0;height:100%;width:40%;pointer-events:none;'+css;
    OVL.appendChild(d); return d; };
  const cl=mkCluster('left:0;'), cr=mkCluster('right:0;');
  const B=(pa,label,ic,css,code,press)=>tbtn(label,ic,css,code,press,pa);
  /* ---- v1.8 W1: makeStick 摇杆工厂 (双摇杆共用, 完整 pointer ownership: id+capture+cancel+lostcapture) ---- */
  const makeStick=(parent,id,onAxis,onDirs)=>{
    const joy=document.createElement('div'); joy.id=id;
    joy.innerHTML='<div class="jstick"></div>'+
      '<span class="jd jt">▲</span><span class="jd jb">▼</span>'+
      '<span class="jd jl">◀</span><span class="jd jr">▶</span>';
    parent.appendChild(joy);
    const stick=joy.querySelector('.jstick');
    const setStick=(dx,dy)=>{ stick.style.transform='translate('+dx.toFixed(1)+'px,'+dy.toFixed(1)+'px)'; };
    const center=()=>{ const r=joy.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,max:r.width/2*0.62}; };
    let pid=null;
    const apply=(dx,dy,c)=>{
      const m=Math.hypot(dx,dy)/c, dead=m<0.12;      /* 死区 */
      const ax=dead?0:dx/c, ay=dead?0:dy/c;
      onAxis(ax,ay);
      const u=ay<-0.38, d=ay>0.38, l=ax<-0.38, r=ax>0.38;
      joy.classList.toggle('jU',u); joy.classList.toggle('jD',d);
      joy.classList.toggle('jL',l); joy.classList.toggle('jR',r);
      if(onDirs)onDirs(ax,ay,u,d,l,r);
    };
    const move=e=>{
      if(pid!==e.pointerId)return;
      const c=center();
      let dx=e.clientX-c.x, dy=e.clientY-c.y;
      const dd=Math.hypot(dx,dy);
      if(dd>c.max){ dx*=c.max/dd; dy*=c.max/dd; }
      setStick(dx,dy); apply(dx,dy,c.max);
    };
    const end=e=>{ if(e&&pid!==e.pointerId)return; pid=null;
      setStick(0,0); joy.classList.remove('on','jU','jD','jL','jR'); onAxis(0,0); if(onDirs)onDirs(0,0,false,false,false,false); };
    joy.addEventListener('pointerdown',e=>{ e.preventDefault(); if(pid!==null)return; pid=e.pointerId;
      try{joy.setPointerCapture(pid);}catch(_){ }
      joy.classList.add('on'); setInMode('touch'); move(e); });
    joy.addEventListener('pointermove',move);
    joy.addEventListener('pointerup',end); joy.addEventListener('pointercancel',end);
    joy.addEventListener('lostpointercapture',end);
    joy.addEventListener('contextmenu',e=>e.preventDefault());
    const api={reset(){ if(pid!==null){try{if(joy.hasPointerCapture(pid))joy.releasePointerCapture(pid);}catch(_){ }} end(null); }};
    STICKS.push(api);
    return joy;
  };
  /* 左簇: 移动摇杆 (v1.5 替代四方向键; 360°+幅度, 数字方向仅作菜单兼容) */
  const DIRS=['KeyW','KeyS','KeyA','KeyD'];
  makeStick(cl,'joy',
    (ax,ay)=>{ VJ.ax=ax; VJ.ay=ay; },
    (ax,ay,u,d,l,r)=>{ DIRS.forEach(k=>VKEYS.delete(k));
      if(u)VKEYS.add('KeyW'); if(d)VKEYS.add('KeyS'); if(l)VKEYS.add('KeyA'); if(r)VKEYS.add('KeyD'); });
  /* 右簇: 瞄准摇杆 (v1.8 W1: 置于按钮栈上方空带, 金色环) */
  makeStick(cr,'rjoy',(ax,ay)=>{ VR.ax=ax; VR.ay=ay; },null);
  /* ---- 右簇: 2列动作网格(贴最右缘, 全圆形玻璃) ---- */
  const edge='max(12px,calc(var(--safe-right) + 10px))';
  const inner='calc(var(--safe-right) + '+L+' + 20px)';
  B(cr,'机枪','●',{right:edge,bottom:'calc(var(--safe-bottom) + 16px)',width:L,height:L},'KeyJ');
  B(cl,'锁定','◎',{left:'max(12px,calc(var(--safe-left) + 10px))',bottom:'calc(var(--safe-bottom) + 190px)',width:S,height:S},'KeyI',true);
  B(cr,'主炮','◆',{right:inner,bottom:'calc(var(--safe-bottom) + 4px)',width:S,height:S},'KeyK');
  B(cr,'加速','»',{right:inner,bottom:'calc(var(--safe-bottom) + '+S+' + 12px)',width:S,height:S},'ShiftLeft');
  B(cr,'导弹','▲',{right:inner,bottom:'calc(var(--safe-bottom) + '+S+' + '+S+' + 20px)',width:S,height:S},'KeyL');
  B(cr,'护盾','⬡',{right:edge,bottom:'calc(var(--safe-bottom) + '+L+' + 16px)',width:S,height:S},'Space',true);
  B(cr,'空袭','✈',{right:edge,bottom:'calc(var(--safe-bottom) + '+L+' + '+S+' + 24px)',width:S,height:S},'KeyU',true);
  /* 暂停: 右上角 */
  tbtn('暂停','❚❚',{right:edge,top:'max(10px,calc(var(--safe-top) + 8px))',width:'clamp(44px,9vmin,56px)',height:'clamp(44px,9vmin,56px)'},'KeyP',true);
})();
function resetTransientInput(){
  for(const el of TBTNS)if(el._touchRelease)el._touchRelease();
  for(const st of STICKS)st.reset();
  VKEYS.clear(); keys.clear();
  VJ.ax=0; VJ.ay=0; VR.ax=0; VR.ay=0;
  PAD.ax=0; PAD.ay=0; PAD.rax=0; PAD.ray=0;
  /* 后台/失焦丢 pointerup 时取消本次导弹蓄力, 不允许自动放弹 (契约§1) */
  if(typeof player!=='undefined'&&player&&player.charging){ player.charging=false; player.charge=0; }
}
function resetTouchControls(){ resetTransientInput(); }   /* 兼容别名(updOvl/失焦监听沿用) */
function updOvl(){
  /* 触屏按钮层: 虚拟按钮=开 时强制显示; auto 时触屏设备显示, 但当前用手柄则隐藏(回到触屏一点即恢复) */
  const show=((SET.touch==='on')||(SET.touch==='auto'&&hasTouch&&inMode()!=='pad'))&&!MENU&&(ST.state==='play'||ST.state==='intro');
  const stick=document.getElementById('rjoy');
  if(stick)stick.style.display=aimMode()==='auto'?'none':'';
  const lock=TBTNS.find(b=>b.dataset.action==='KeyI');
  if(lock)lock.style.display=aimMode()==='manual'?'none':'';
  const d=show?'block':'none';
  if(OVL.style.display!==d){ if(d==='none')resetTouchControls(); OVL.style.display=d; }
}
let toastT=null;
function showToast(msg){ const el=document.getElementById('toast');
  el.textContent=msg; el.style.display='block';
  if(toastT)clearTimeout(toastT); toastT=setTimeout(()=>{el.style.display='none';},1800); }
/* ---------- 画布触控(菜单/整备点击) ---------- */
cv.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  e.preventDefault();
  if(e.pointerType==='touch')setInMode('touch');
  initAudio();
  const r=cv.getBoundingClientRect();
  const x=(e.clientX-r.left)/r.width*VW, y=(e.clientY-r.top)/r.height*VH;
  const rects=MENU_RECTS.concat(TAP_RECTS);
  let hit=null;
  for(let i=rects.length-1;i>=0;i--){ const q=rects[i];
    if(x>=q.x&&x<=q.x+q.w&&y>=q.y&&y<=q.y+q.h){hit=q;break;} }
  /* 手机上的 Canvas 控件视觉尺寸较小: 命中失败时按最近目标吸附, 相邻目标以中心距离判定。 */
  if(!hit&&(e.pointerType==='touch'||e.pointerType==='pen')){
    const sx=22*VW/r.width, sy=22*VH/r.height;
    let best=Infinity;
    for(const q of rects){
      const dx=x<q.x?q.x-x:(x>q.x+q.w?x-q.x-q.w:0);
      const dy=y<q.y?q.y-y:(y>q.y+q.h?y-q.y-q.h:0);
      if(dx<=sx&&dy<=sy){ const score=(dx/sx)**2+(dy/sy)**2+Math.hypot(x-(q.x+q.w/2),y-(q.y+q.h/2))*0.0001;
        if(score<best){best=score;hit=q;} }
    }
  }
  if(hit){hit.act({x,y,pointerType:e.pointerType});return;}
  if(!MENU){ // 无菜单时的快捷点击
    if(ST.state==='clear'||ST.state==='intro'||ST.state==='ctrl'||(ST.state==='win'&&e.pointerType!=='touch'))onKeyPress('Enter');
    else if(ST.state==='over'&&e.pointerType!=='touch')onKeyPress('KeyR');
  }
});
document.addEventListener('touchmove',e=>{ if(OVL.style.display==='block')e.preventDefault(); },{passive:false});
addEventListener('blur',resetTouchControls);
addEventListener('pagehide',resetTouchControls);
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetTouchControls();});
