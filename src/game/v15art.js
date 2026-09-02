"use strict";
/* game/v15art — v15 top-down 16方向单位资产接入层
   assets/ai-v15-topdown (正交俯视 4x4 方向图) → 全方向帧替换 v1.4 斜视立绘.
   帧序 E→ESE→…→ENE 顺时针 22.5°/帧, idx=round(ang/22.5°) mod 16 (屏幕系 y 向下).
   单位走 uctx 高清层, 相机偏移/落影/辉光/血条与 aiart 管线一致;
   本层在 aiart.js 之后加载并外层接管, v15 缺图时逐单位回退 v14/像素层. */
window.V15={ok:false,ready:false,enabled:true,imgs:{},M:null,queue:[]};
(function(){
  if(typeof V15_MANIFEST==='undefined')return;
  const M=window.V15_MANIFEST; V15.M=M;
  const keys=Object.keys(M.images); let left=keys.length,loaded=0;
  for(const k of keys){
    const im=new Image();
    im.onload=()=>{ loaded++; if(--left===0){V15.ok=loaded>0;V15.ready=true;} };
    im.onerror=()=>{ if(--left===0){V15.ok=loaded>0;V15.ready=true;} };
    im.src=M.images[k];
    V15.imgs[k]=im;
  }
})();
/* ---------- v1.8 W2: 分层机体素材 (hull@bodyA + turret@ta; 6 张 512 atlas, pivot=帧中心) ---------- */
window.V18={ok:false,ready:false,imgs:{},meta:{}};
(function(){
  if(typeof V18L==='undefined')return;
  let left=0;
  for(const kind of ['hulls','turrets'])for(const key of Object.keys(V18L[kind]||{})){
    const d=V18L[kind][key], im=new Image(); left++;
    im.onload=im.onerror=()=>{ if(--left===0){V18.ok=true;V18.ready=true;} };
    im.src=d.img;
    V18.imgs[kind+'_'+key]=im;
    V18.meta[kind+'_'+key]={angles:d.angles,scales:d.scales};
  }
})();
V18.frameIndex=function(id,ang){
  const m=V18.meta[id]; if(!m)return 0;
  let best=0,bd=1e9;
  for(let i=0;i<16;i++){
    const a=m.angles[i], d=Math.abs(Math.atan2(Math.sin(ang-a),Math.cos(ang-a)));
    if(d<bd){bd=d;best=i;}
  }
  return best;
};
V18.paint=function(g,id,x,y,ang,w){   /* w=参考车宽; ×scale 保持 hull/turret 生成期源比例 */
  const im=V18.imgs[id];
  if(!im||!im.complete||im.naturalWidth===0)return false;
  const m=V18.meta[id], idx=V18.frameIndex(id,ang), W=w*m.scales[idx];
  g.drawImage(im,(idx%4)*128,(idx>>2)*128,128,128,x-W/2,y-W/2,W,W);
  return true;
};
V18.playerLayers=function(g,x,y,bodyA,ta,w){
  const hk=RUN.hull||'balanced';
  return V18.paint(g,'hulls_'+hk,x,y,bodyA,w)&&V18.paint(g,'turrets_'+hk,x,y,ta,w);
};
/* v1.7 残影: v18 hull 帧 → 纯色剪影 (与 V15.ghostFrame 同技法) */
V18.ghostFrame=function(id,idx,lv){
  if(!V18._gh)V18._gh=new Map();
  const key=id+':'+idx+':'+lv;
  if(V18._gh.has(key))return V18._gh.get(key);
  const im=V18.imgs[id];
  if(!im||!im.complete||im.naturalWidth===0)return null;
  const cv2=document.createElement('canvas'); cv2.width=128; cv2.height=128;
  const g2=cv2.getContext('2d');
  g2.imageSmoothingEnabled=false;
  g2.drawImage(im,(idx%4)*128,(idx>>2)*128,128,128,0,0,128,128);
  g2.globalCompositeOperation='source-in';
  g2.fillStyle=GHOST_COL[lv]||GHOST_COL[0];
  g2.fillRect(0,0,128,128);
  V18._gh.set(key,cv2);
  return cv2;
};
/* ---------- 规格与帧选择 ----------
   生成 sheet 的帧序不统一: 各单位顺/逆时针混用、步进不均、部分方向缺失
   (逐帧实测见 tools/assemble_v15_data.py FRAME_ANGLES), 故按 manifest
   angles 表做最近角度选帧; 无表时按逆时针均匀 22.5° 兜底. */
V15.dirIndex=function(sp,ang){
  const T=sp&&sp.angles;
  if(!T)return (16-Math.round(ang/(Math.PI/8))%16)%16;
  if(!sp._ar)sp._ar=T.map(d=>d*Math.PI/180);
  let best=0,bd=1e9;
  for(let i=0;i<16;i++){
    const a=sp._ar[i];
    const d=Math.abs(Math.atan2(Math.sin(ang-a),Math.cos(ang-a)));
    if(d<bd){bd=d;best=i;}
  }
  return best;
};
function v15Spec(group,key){
  const u=V15.M&&V15.M.units;
  return (u&&u[group]&&u[group][key])||null;
}
function v15Image(key){
  const im=V15.imgs[key];
  return im&&im.complete&&im.naturalWidth>0?im:null;
}
function apActive15(){ return !!(window.AP&&AP.active&&AP.ok); }
function v15Active(){ return V15.enabled&&V15.ok&&!apActive15(); }
/* 在指定 ctx 上画一帧 (格为正方形, 宽=高); 返回是否成功 */
function v15Paint(g,sp,x,y,ang,w,alpha){
  const im=v15Image(sp.img); if(!im)return false;
  const idx=V15.dirIndex(sp,ang), cw=im.naturalWidth/4, ch=im.naturalHeight/4;
  g.save();
  if(alpha!==undefined)g.globalAlpha=alpha;
  g.imageSmoothingEnabled=true;
  g.drawImage(im,(idx%4)*cw,(idx>>2)*ch,cw,ch,x-w/2,y-w/2,w,w);
  g.restore();
  return true;
}
/* uctx 版辉光 (与 aiart.hGlow 同视觉) */
function v15Glow(x,y,r,c,a){
  if(PERF.qLevel===0)return;
  const g=uctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,rgba(c,a)); g.addColorStop(0.45,rgba(c,a*0.28)); g.addColorStop(1,rgba(c,0));
  uctx.save(); uctx.globalCompositeOperation='lighter'; uctx.fillStyle=g;
  uctx.fillRect(x-r,y-r,r*2,r*2); uctx.restore();
}
/* ---------- v1.7: 残影实心剪影帧缓存 ----------
   帧图 source-in 填深色 → 纯色坦克剪影(轮廓100%可读, 不依赖帧内明暗细节);
   三档色深随距离递减, 懒生成后缓存。绘制尺寸与本体一致 → 形象完全一致。 */
const GHOST_COL=['#141b2b','#1c2740','#243350','#2c3f60','#344b70','#3d5780'];   /* 深蓝黑系六级: 越靠尾越浅 */
V15.ghostFrame=function(sp,idx,lv){
  if(!V15._gh)V15._gh=new Map();
  const key=sp.img+':'+idx+':'+lv;
  if(V15._gh.has(key))return V15._gh.get(key);
  const im=v15Image(sp.img); if(!im)return null;
  const cw=im.naturalWidth/4, ch=im.naturalHeight/4;
  const cv2=document.createElement('canvas');
  cv2.width=Math.max(2,Math.ceil(cw)); cv2.height=Math.max(2,Math.ceil(ch));
  const g2=cv2.getContext('2d');
  g2.imageSmoothingEnabled=true;
  g2.drawImage(im,(idx%4)*cw,(idx>>2)*ch,cw,ch,0,0,cv2.width,cv2.height);
  g2.globalCompositeOperation='source-in';
  g2.fillStyle=GHOST_COL[lv]||GHOST_COL[0];
  g2.fillRect(0,0,cv2.width,cv2.height);
  V15._gh.set(key,cv2);
  return cv2;
};
/* ---------- 高清层输出: 队列在像素阶段收集, main.js 抬升像素层后统一绘制 ---------- */
V15.flushHd=function(ox,oy){
  if(!V15.queue.length)return;
  uctx.save();
  try{
    uctx.translate(-Math.round(ox),-Math.round(oy));
    uctx.imageSmoothingEnabled=true;
    for(const q of V15.queue){
      if(!isFinite(q.x)||!isFinite(q.y))continue;
      const sp=q.spec, w=q.w||sp.w;
      if(q.kind==='ghost'){   /* v1.7: 深色剪影帧, 无影无光, 关平滑保轮廓锐利; v1.8: 有 id 时用 v18 hull 帧 */
        let f=null, wg=w;
        if(q.id){
          const m=V18.meta[q.id];
          if(m){ const gi=V18.frameIndex(q.id,q.ang||0); f=V18.ghostFrame(q.id,gi,q.lv||0); wg=w*m.scales[gi]; }
        } else f=V15.ghostFrame(sp,V15.dirIndex(sp,q.ang||0),q.lv||0);
        uctx.save(); uctx.imageSmoothingEnabled=false;
        uctx.globalAlpha=q.alpha!==undefined?q.alpha:0.8;
        if(f)uctx.drawImage(f,Math.round(q.x-wg/2),Math.round(q.y-wg/2),wg,wg);
        else v15Paint(uctx,sp,q.x,q.y,q.ang||0,w,q.alpha);
        uctx.restore(); continue;
      }
      if(!v15Image(sp.img))continue;
      /* 落影: 俯视单位椭圆影贴脚 (小而淡, 别压过暖光池) */
      uctx.save(); uctx.globalAlpha=q.boss?0.36:0.26; uctx.fillStyle=PAL.shadow;
      uctx.beginPath(); uctx.ellipse(q.x,q.y+2,w*(q.boss?0.40:0.36),w*0.12,0,0,Math.PI*2); uctx.fill(); uctx.restore();
      /* 阵营辉光: 敌红/僚机与玩家机体色/空袭青 */
      if(q.kind==='enemy'){ v15Glow(q.x,q.y,q.boss?14+Math.sin(ST.t*4)*2:8,PAL.red,q.boss?0.16:((RUN.lvl===4||RUN.lvl===5)?0.2:0.10));   /* W9: 雪地白迷彩敌加红辉光 */
        if(q.tg)v15Glow(q.x,q.y,11,PAL.white,0.24); }   /* v1.8 W6平衡: 侧闪前兆履带亮光 */
      else if(q.kind==='plane'){ v15Glow(q.x,q.y,14,'#9bdcff',0.12);
        v15Glow(q.x-Math.cos(q.ang)*w*0.45,q.y-Math.sin(q.ang)*w*0.45,7,PAL.ember,0.20); }
      else if(sp.glow){ v15Glow(q.x+Math.cos(q.ang||0)*w*0.28,q.y+Math.sin(q.ang||0)*w*0.28,
        7+Math.sin(ST.t*5)*1.6,sp.glow,0.13); }
      if(q.kind==='player'&&(q.od||q.sprint))v15Glow(q.x,q.y,24,q.od?PAL.gold:PAL.blue,q.od?0.16:0.11);
      /* 16向帧: 就近方向, 不做旋转; v1.8 W2: 玩家=分层 hull@bodyA + turret@ta, 失败回退整图+ctx炮塔帽 */
      if(q.kind==='player'){
        if(!V18.playerLayers(uctx,q.x,q.y,q.ang||0,q.ta||0,w)){
          v15Paint(uctx,sp,q.x,q.y,q.ang||0,w);
          drawTurretOverlay(uctx,q.x,q.y,q.ang||0,q.ta,w/54,(HULLS[RUN.hull]||HULLS.balanced).vis);
        }
      } else v15Paint(uctx,sp,q.x,q.y,q.ang||0,w);
      if(q.flash>0){ uctx.save(); uctx.globalCompositeOperation='lighter';
        uctx.globalAlpha=Math.min(0.5,q.flash*1.7); uctx.fillStyle=PAL.white;
        uctx.beginPath(); uctx.ellipse(q.x,q.y,w*0.36,w*0.36,0,0,Math.PI*2); uctx.fill(); uctx.restore(); }
      if(q.kind==='player'){
        if(q.shield){   /* v1.7: 3D 等离子护罩球 (随机体适配) */
          const vv=(HULLS[RUN.hull]||HULLS.balanced).vis||{};
          drawShieldOrb(uctx,q.x,q.y,shieldOrbR(vv.s,w),q.ringCol,q.shieldA,
            {age:q.shieldAge,flash:q.shieldFlash,fortress:q.fortress});
        }
      } else if(q.kind==='wing'){
        uctx.globalAlpha=1; uctx.fillStyle=PAL.panel2; uctx.fillRect(q.x-10,q.y-Math.max(14,w*0.42),20,2);
        uctx.fillStyle=sp.glow||PAL.cyan; uctx.fillRect(q.x-10,q.y-Math.max(14,w*0.42),Math.max(1,Math.round(20*q.hp)),2);
        uctx.globalAlpha=1;
      } else if(q.kind==='enemy'){
        if(q.showHp){ uctx.globalAlpha=1;
          uctx.fillStyle=PAL.panel2; uctx.fillRect(q.x-11,q.y-q.r-12,22,3);
          uctx.fillStyle=PAL.red; uctx.fillRect(q.x-11,q.y-q.r-12,Math.max(1,Math.round(22*q.hp)),3);
          uctx.globalAlpha=1; }
        if(q.flying){ uctx.globalAlpha=0.5; uctx.fillStyle=PAL.shadow;
          uctx.fillRect(q.x-q.r,q.y+q.r,q.r*2,2); uctx.globalAlpha=1; }
      }
    }
  } finally {
    V15.queue.length=0;   /* 单点异常也不能让旧项逐帧累积 */
    uctx.restore();
  }
};
/* ---------- 单位绘制接管 (外层包住 aiart 的接管, v15 生效时内层不再触发) ---------- */
function v15Player(){
  if(!v15Active()||!player)return false;
  const p=player;
  if(p.inv>0&&Math.floor(ST.t*10)%2===0)return true;
  const sp=v15Spec('player',RUN.hull||'balanced');
  if(!sp||!v15Image(sp.img))return false;
  /* v1.7: 残影彗尾 — 条数随冲刺位移增长(ghostLen/GHOST_GAP, 封顶6), 逐条变浅变淡, 先于本体入队 */
  const gn=ghostCount();
  if(player.ghostA>0.02&&gn>0&&player.trail&&player.trail.length>4){
    const gid=V18.ready?('hulls_'+(RUN.hull||'balanced')):null;   /* v1.8: 残影用分层 hull 帧 */
    for(let i=0;i<gn;i++){
      const e=trailAtDist(player,(i+1)*GHOST_GAP); if(!e)break;
      V15.queue.push({kind:'ghost',id:gid,spec:sp,x:e.x,y:e.y,ang:e.a,w:sp.w,
        alpha:Math.max(0.35,0.85-i*0.1)*player.ghostA,lv:Math.min(5,i)});
    }
  }
  const v=hullCfg().vis||{}, sc2=hullCfg().shield;
  V15.queue.push({kind:'player',spec:sp,x:IPx(p),y:IPy(p),ang:p.bodyA,ta:p.ta,flash:p.flash||0,
    shield:p.shieldT>0||p.shieldGrace>0,shieldA:clamp(p.shieldT/0.5,0.25,1),
    shieldAge:p.shieldAge,shieldFlash:p.shieldFlash||0,fortress:!!sc2.fortress,
    ringCol:v.ring||sp.glow||PAL.aqua,od:COMBO.od,sprint:p.sprintG<0.95});
  return true;
}
function v15Enemy(e){
  if(!v15Active()||!e)return false;
  const jx=e.jitter>0?rnd(-1.3,1.3):0, jy=e.jitter>0?rnd(-1.3,1.3):0;
  const sp=e.boss?v15Spec('boss','landship'):v15Spec('enemy',e.kind==='tank'?'tank':'truck');
  if(!sp||!v15Image(sp.img))return false;
  V15.queue.push({kind:'enemy',spec:sp,x:IPx(e)+jx,y:IPy(e)+jy,ang:e.a,flash:e.flash||0,tg:e.telegraph>0,
    boss:!!e.boss,r:e.r,hp:e.hp/e.maxHp,showHp:!e.boss&&e.hp<e.maxHp,flying:!!e.flying});
  return true;
}
function v15Wing(){
  if(!v15Active())return false;
  if(!wingman||wingman.downT>0||!player)return true;
  const w=wingman;
  const sp=v15Spec('wingman',w.type||'flex');
  if(!sp||!v15Image(sp.img))return false;
  V15.queue.push({kind:'wing',spec:sp,x:IPx(w),y:IPy(w),ang:w.a,hp:w.hp/w.maxHp});
  return true;
}
function v15Plane(pl){
  const sp=v15Spec('support','airstrike');
  if(!sp||!v15Image(sp.img))return false;
  V15.queue.push({kind:'plane',spec:sp,x:IPx(pl),y:IPy(pl),ang:pl.dir>0?0:Math.PI,w:56});
  return true;
}
const _v15DrawPlayer=drawPlayer;
drawPlayer=function(){ if(!v15Player())_v15DrawPlayer(); };
const _v15DrawEnemy=drawEnemy;
drawEnemy=function(e){ if(!v15Enemy(e))_v15DrawEnemy(e); };
const _v15DrawWing=drawWingman;
drawWingman=function(){ if(!v15Wing())_v15DrawWing(); };
const _v15DrawPlane=drawPlaneI;
drawPlaneI=function(pl){ if(!v15Plane(pl))_v15DrawPlane(pl); };
/* ---------- 输出管线: 挂在 AIART.flushHd 前段 (main.js 每帧调用一次) ---------- */
if(window.AIART&&AIART.flushHd){
  const _v15FlushAI=AIART.flushHd;
  AIART.flushHd=function(ox,oy){ V15.flushHd(ox,oy); _v15FlushAI(ox,oy); };
  if(V15.ok&&!AIART.ok)AIART.ok=true;   /* v14 资产缺失时保证 main.js 仍会调用 flushHd */
}
/* ---------- 选车/选僚机预览: v15 帧正面朝上, 回退 aiart 版 ---------- */
const _v15HullPrevAI=window.drawHullPreviewAI;
window.drawHullPreviewAI=function(k,x,y,w,h){
  if(v15Active()){
    const sp=v15Spec('player',k);
    if(sp&&v15Image(sp.img)){
      const v=HULLS[k].vis||{}, col=sp.glow||v.trim||PAL.cyan;
      uctx.save();
      uctx.beginPath(); uctx.rect(x,y,w,h); uctx.clip();
      upx(x,y,w,h,PAL.ink);
      upx(x,y+h-12,w,12,PAL.sand); upx(x+4,y+h-12,w-8,2,PAL.brown);
      const cx=x+w/2, cy=y+h/2-4, dw=h-14;
      const pl=Math.sin(ST.t*1.1)*w*0.06;
      v15Glow(cx,cy,24,col,0.13);
      if(!V18.playerLayers(uctx,cx+pl,cy,-Math.PI/2,-Math.PI/2,dw)){   /* v1.8: 分层预览 */
        v15Paint(uctx,sp,cx+pl,cy,-Math.PI/2,dw);
        drawTurretOverlay(uctx,cx+pl,cy,-Math.PI/2,-Math.PI/2,dw/54,HULLS[k].vis);
      }
      const rp=(ST.t*0.5)%1;
      uctx.strokeStyle=rgba(col,0.85*(1-rp)); uctx.lineWidth=1;
      uctx.beginPath(); uctx.arc(cx+pl,cy,7+rp*19,0,Math.PI*2); uctx.stroke();
      txt(v.callsign||'IRONCLAD-07',x+w-6,y+6,7,rgba(col,0.95),'right');
      for(let i=0;i<HULLS[k].missile.maxLocks;i++)txt('>',x+8+i*10,y+6,8,PAL.gold);
      uctx.restore();
      uctx.strokeStyle=PAL.steel; uctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
      return true;
    }
  }
  return _v15HullPrevAI?_v15HullPrevAI(k,x,y,w,h):false;
};
/* 僚机预览: main.js 在 stage3 (菜单之后) 调用, 画在 uctx 上避免被菜单遮盖;
   v15 未生效时不回退旧像素版 (其在 stage1 绘制会被菜单盖住, 本就不可见) */
window.drawWingPreview=function(k,x,y,w,h){
  if(k==='none'||!v15Active())return false;
  const sp=v15Spec('wingman',k);
  if(!sp||!v15Image(sp.img))return false;
  const col=sp.glow||PAL.cyan;
  uctx.save();
  uctx.beginPath(); uctx.rect(x,y,w,h); uctx.clip();
  upx(x,y,w,h,PAL.ink);
  upx(x,y+h-11,w,11,PAL.panel2); upx(x+4,y+h-11,w-8,2,PAL.steel);
  const cx=x+w/2, cy=y+h/2-3, dw=h-16;
  const pl=Math.sin(ST.t*1.2)*w*0.05;
  v15Glow(cx,cy,18,col,0.12);
  v15Paint(uctx,sp,cx+pl,cy,-Math.PI/2,dw);
  uctx.globalAlpha=0.45; uctx.strokeStyle=rgba(col,0.7); uctx.lineWidth=1;
  uctx.beginPath(); uctx.ellipse(cx+pl,cy+11,28,8,0,0,Math.PI*2); uctx.stroke();
  uctx.globalAlpha=1; uctx.restore();
  uctx.strokeStyle=PAL.steel; uctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
  return true;
};
V15.spec=v15Spec; V15.paint=v15Paint;   /* 供帮助页/预览等复用 (16向帧绘制) */
/* ---------- 调试钩子 ---------- */
function hookG15(){
  if(!window.G){ requestAnimationFrame(hookG15); return; }
  G.v15={
    info(){return {ok:V15.ok,ready:V15.ready,enabled:V15.enabled,version:V15.M&&V15.M.version,
      sheets:Object.keys(V15.imgs).length,queued:V15.queue.length};},
    enable(v){V15.enabled=v!==false;return V15.enabled;},
  };
  G.v18={
    info(){return {ok:V18.ok,ready:V18.ready,imgs:Object.keys(V18.imgs).length};},
  };
}
requestAnimationFrame(hookG15);
