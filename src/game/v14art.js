"use strict";
/* game/v14art — v14 AI 立绘资产接入层
   assets/ai-v14 (日系战术HD-2D cutout) → 单位绘制替换。
   单方向朝右前立绘: 全向移动用 左右镜像(|yaw|<90°面右, 否则面左),
   俯视中保留立绘原透视(等距), 通过 anchor + shadow 对齐地面。 */
window.V14 = { ok:false, imgs:{}, M:null };
(function(){
  if(typeof V14_MANIFEST==='undefined')return;
  const M=window.V14_MANIFEST; V14.M=M;
  const keys=Object.keys(M.images); let left=keys.length;
  for(const k of keys){
    const im=new Image();
    im.onload=()=>{ if(--left===0)V14.ok=true; };
    im.onerror=()=>{ if(--left===0)V14.ok=false; };
    im.src=M.images[k];
    V14.imgs[k]=im;
  }
})();
/* 单位规格(与 asset-manifest.json units 段一致) */
V14.SPEC={
  player:{assault:{img:'player_raijin',w:52,ax:.53,ay:.56,glow:'#f6b94e'},
          balanced:{img:'player_balanced',w:50,ax:.53,ay:.56,glow:'#22c0ff'},
          heavy:{img:'player_genbu',w:62,ax:.54,ay:.58,glow:'#8fd8e8'}},
  wingman:{assault:{img:'wingman_assault',w:36,ax:.53,ay:.56,glow:'#f6b94e'},
           guard:{img:'wingman_guard',w:39,ax:.54,ay:.58,glow:'#22c0ff'},
           flex:{img:'wingman_tactical',w:34,ax:.53,ay:.57,glow:'#67f0c0'}},
  enemy:{tank:{img:'enemy_crimson_assault',w:48,bw:120,ax:.53,ay:.57},
         truck:{img:'enemy_crimson_carrier',w:46,bw:116,ax:.54,ay:.58}},
  boss:{img:'boss_landship',w:132,ax:.55,ay:.58}};
/* 绘制单位: face 右/左镜像, 落影 + 专属光晕; 返回实际绘制宽(供血条等) */
V14.drawUnit=function(grp,key,x,y,ang,alpha){
  const sp=(V14.SPEC[grp]||{})[key]||V14.SPEC[key]; if(!sp)return 0;
  const im=V14.imgs[sp.img]; if(!im||!im.width)return 0;
  const w=sp.w, h=w*im.height/im.width;
  const faceR=Math.abs(angDiff(ang,0))<=Math.PI/2;
  const dx=x-w*sp.ax, dy=y-h*sp.ay;
  ctx.save();
  ctx.globalAlpha=(alpha===undefined?1:alpha);
  /* 落影(椭圆, 对齐立绘底缘) */
  ctx.globalAlpha*=0.32; ctx.fillStyle=PAL.shadow;
  ctx.beginPath(); ctx.ellipse(x,y+2,w*0.42,h*0.10,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=(alpha===undefined?1:alpha);
  if(sp.glow){ glow(x,y-h*0.42,w*0.55,sp.glow,0.10); }
  if(faceR)ctx.drawImage(im,dx,dy,w,h);
  else{ ctx.translate(Math.round(2*x),0); ctx.scale(-1,1);
        ctx.drawImage(im,dx,dy,w,h); }
  ctx.restore();
  return w;
};
/* BOSS 独立入口(更大 + 慢速悬浮感) */
V14.drawBoss=function(x,y,ang,alpha){
  const sp=V14.SPEC.boss, im=V14.imgs[sp.img]; if(!im||!im.width)return 0;
  const w=sp.w,h=w*im.height/im.width;
  const faceR=Math.abs(angDiff(ang,0))<=Math.PI/2;
  const dx=x-w*sp.ax, dy=y-h*sp.ay;
  ctx.save(); ctx.globalAlpha=(alpha===undefined?1:alpha);
  ctx.globalAlpha*=0.4; ctx.fillStyle=PAL.shadow;
  ctx.beginPath(); ctx.ellipse(x,y+3,w*0.44,h*0.09,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=(alpha===undefined?1:alpha);
  glow(x,y-h*0.4,w*0.5,'#ff6a4a',0.12);
  if(faceR)ctx.drawImage(im,dx,dy,w,h);
  else{ ctx.translate(Math.round(2*x),0); ctx.scale(-1,1); ctx.drawImage(im,dx,dy,w,h); }
  ctx.restore(); return w;
};
/* 爆炸核心帧: 叠在像素爆炸中心, 随 ttl 淡出 */
V14.drawBoom=function(x,y,r,ttl,ttlMax){
  const im=V14.imgs['fx_explosion_core']; if(!im||!im.width)return;
  const f=1-ttl/ttlMax, sc=(0.7+0.9*Math.min(1,f*1.6))*(r/22);
  const w=128*sc*0.5;
  ctx.save(); ctx.globalAlpha=clamp(1.15-f*1.25,0,1);
  ctx.drawImage(im,x-w/2,y-w/2,w,w);
  ctx.restore();
};
