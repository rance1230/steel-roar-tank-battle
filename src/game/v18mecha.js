"use strict";
/* V18M: runtime contract for the three new mecha. Hulls use nearest 16-dir
   frames; turrets remain a canonical layer with continuous rotation. */
window.V18M = { ok: false, ready: false, imgs: {}, meta: {}, _gh: new Map() };
(function loadV18M(){
  if(typeof V18MECHA === 'undefined') return;
  const keys=Object.keys(V18MECHA.units||{}); let pending=keys.length*2;
  for(const key of keys){
    const spec=V18MECHA.units[key];
    for(const part of ['hull','turret']){
      const im=new Image();
      im.onload=im.onerror=()=>{ pending--; V18M.ready=pending===0; V18M.ok=Object.keys(V18M.imgs).some(id=>V18M.valid(id)); };
      im.src=spec[part]; V18M.imgs[key+'_'+part]=im;
    }
    V18M.meta[key]=spec;
  }
})();
V18M.valid=function(id){ const im=V18M.imgs[id]; return !!(im&&im.complete&&im.naturalWidth>0); };
// Heavy atlas alpha was derived from dark plate colors. Restore solid material
// once at decode time while retaining transparent background and edge coverage.
V18M._material=new Map();
V18M.material=function(key,part){
  const id=key+'_'+part,im=V18M.imgs[id];
  if(key!=='heavy'||!V18M.valid(id))return im;
  if(V18M._material.has(id))return V18M._material.get(id);
  const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
  const g=c.getContext('2d');g.drawImage(im,0,0);const pixels=g.getImageData(0,0,c.width,c.height),d=pixels.data;
  for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;
    d[i+3]=Math.min(255,Math.round(d[i+3]*255/32));
    for(let ch=0;ch<3;ch++)d[i+ch]=Math.min(255,Math.round(d[i+ch]*1.18+10));
  }
  // Recover erased plate interiors, not just their surviving outline pixels.
  // Flood only from each frame's exterior; turret socket/deck holes stay solid.
  const cell=part==='hull'?V18M.meta[key].cellSize:c.width;
  for(let oy=0;oy<c.height;oy+=cell)for(let ox=0;ox<c.width;ox+=cell){
    const exterior=new Uint8Array(cell*cell),queue=new Int32Array(cell*cell);let head=0,tail=0;
    const visit=(x,y)=>{const n=y*cell+x,i=((oy+y)*c.width+ox+x)*4;
      if(!exterior[n]&&d[i+3]<24){exterior[n]=1;queue[tail++]=n;}};
    for(let k=0;k<cell;k++){visit(k,0);visit(k,cell-1);visit(0,k);visit(cell-1,k);}
    while(head<tail){const n=queue[head++],x=n%cell,y=(n/cell)|0;
      if(x)visit(x-1,y);if(x+1<cell)visit(x+1,y);if(y)visit(x,y-1);if(y+1<cell)visit(x,y+1);}
    for(let y=0;y<cell;y++)for(let x=0;x<cell;x++){
      const n=y*cell+x,i=((oy+y)*c.width+ox+x)*4;if(exterior[n]||d[i+3]===255)continue;
      const a=d[i+3]/255;
      d[i]=Math.round(d[i]*a+48*(1-a));d[i+1]=Math.round(d[i+1]*a+61*(1-a));d[i+2]=Math.round(d[i+2]*a+70*(1-a));d[i+3]=255;
    }
  }
  g.putImageData(pixels,0,0);V18M._material.set(id,c);return c;
};
V18M.frameIndex=function(key,ang){
  const m=V18M.meta[key]; if(!m)return 0;
  let best=0,bd=1e9;
  for(let i=0;i<16;i++){
    const a=m.frameAnglesDeg[i]*Math.PI/180;
    const d=Math.abs(Math.atan2(Math.sin(ang-a),Math.cos(ang-a)));
    if(d<bd){bd=d;best=i;}
  }
  return best;
};
/* Cached alpha silhouettes keep shadows attached to the actual hull instead of
   a world-horizontal oval. Light direction is fixed upper-left in every view. */
V18M._masks=new Map();
V18M.mask=function(key,part,idx){
  const id=key+':'+part+':'+idx;if(V18M._masks.has(id))return V18M._masks.get(id);
  const m=V18M.meta[key],im=V18M.material(key,part);if(!m||!V18M.valid(key+'_'+part))return null;
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
  if(part==='hull')g.drawImage(im,(idx%4)*m.cellSize,(idx>>2)*m.cellSize,m.cellSize,m.cellSize,0,0,128,128);
  else g.drawImage(im,0,0,128,128);
  g.globalCompositeOperation='source-in';g.fillStyle='#142432';g.fillRect(0,0,128,128);
  V18M._masks.set(id,c);return c;
};
V18M.layers=function(g,key,x,y,bodyA,ta,w,enemy){
  const m=V18M.meta[key], hull=enemy?V18M.enemyMaterial(key,'hull'):V18M.material(key,'hull'), turret=enemy?V18M.enemyMaterial(key,'turret'):V18M.material(key,'turret');
  if(!m||!V18M.valid(key+'_hull')||!V18M.valid(key+'_turret'))return false;
  const idx=V18M.frameIndex(key,bodyA||0),cell=enemy?hull.width/4:m.cellSize,W=w;
  const mask=V18M.mask(key,'hull',idx),tm=V18M.mask(key,'turret',0),lift=W*0.025;
  g.save();g.imageSmoothingEnabled=true;
  // Short projected silhouette plus tight contact shadow; no floating oval.
  if(mask){g.save();g.globalAlpha*=0.28;g.drawImage(mask,x-W/2+W*0.045,y-W/2+W*0.065,W,W);g.globalAlpha*=0.65;g.drawImage(mask,x-W/2+W*0.02,y-W/2+W*0.03,W,W);g.restore();}
  // A shallow sidewall under the hull gives thickness without changing hitboxes.
  if(mask){g.save();g.globalAlpha*=0.80;g.drawImage(mask,x-W/2,y-W/2+lift,W,W);g.restore();}
  g.drawImage(hull,(idx%4)*cell,(idx>>2)*cell,cell,cell,x-W/2,y-W/2,W,W);
  if(tm){g.save();g.translate(x+W*0.018,y+W*0.035);g.rotate(ta||0);g.globalAlpha*=0.34;g.drawImage(tm,-W/2,-W/2,W,W);g.restore();}
  // Turret sits above hull; translation does not move the aiming pivot in logic.
  g.translate(x,y-lift);g.rotate(ta||0);g.drawImage(turret,-W/2,-W/2,W,W);
  g.restore();return true;
};
// A complete, repaired hull + independent turret silhouette. Bounded shared cache.
V18M.ghostFrame=function(key,idx,lv,ta){
  const ti=Math.round((ta||0)/(Math.PI/8)),id=key+':'+idx+':'+ti;
  if(V18M._gh.has(id))return V18M._gh.get(id);
  if(!V18M.valid(key+'_hull')||!V18M.valid(key+'_turret'))return null;
  const m=V18M.meta[key],im=V18M.material(key,'hull'),cv=document.createElement('canvas');
  cv.width=cv.height=128;const g=cv.getContext('2d');g.imageSmoothingEnabled=true;
  g.drawImage(im,(idx%4)*m.cellSize,(idx>>2)*m.cellSize,m.cellSize,m.cellSize,0,0,128,128);
  g.save();g.translate(64,64-128*.025);g.rotate(ti*Math.PI/8);g.drawImage(V18M.material(key,'turret'),-64,-64,128,128);g.restore();
  g.globalCompositeOperation='source-in';g.fillStyle='#69aabd';g.fillRect(0,0,128,128);
  if(V18M._gh.size>=64)V18M._gh.delete(V18M._gh.keys().next().value);
  V18M._gh.set(id,cv);return cv;
};
V18M.playerLayers=function(g,x,y,bodyA,ta,w){ return V18M.layers(g,RUN.hull||'balanced',x,y,bodyA,ta,w); };
V18M.info=function(){ return {ok:V18M.ok,ready:V18M.ready,units:Object.keys(V18M.meta).filter(k=>V18M.valid(k+'_hull')&&V18M.valid(k+'_turret'))}; };
/* Enemy faction livery derived from the same repaired geometry. Small cached
   atlases preserve alpha and panel relief, with charcoal armor and red sensors. */
V18M._enemy=new Map();
V18M.enemyMaterial=function(key,part){
  const id=key+':'+part;if(V18M._enemy.has(id))return V18M._enemy.get(id);
  if(!V18M.valid(key+'_'+part))return null;
  const im=V18M.material(key,part);if(!im)return null;
  const c=document.createElement('canvas');c.width=part==='hull'?512:256;c.height=c.width;
  const g=c.getContext('2d');g.drawImage(im,0,0,c.width,c.height);const data=g.getImageData(0,0,c.width,c.height),d=data.data;
  for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;const r=d[i],b=d[i+2],v=d[i+1],l=r*.299+v*.587+b*.114;
    const lamp=(b>r*1.25&&b>110)||(r>150&&v>80&&b<v*.7);
    d[i]=lamp?Math.min(250,l*.7+95):l*.53+20;d[i+1]=lamp?l*.18+14:l*.49+20;d[i+2]=lamp?l*.15+12:l*.53+27;
  }
  g.putImageData(data,0,0);V18M._enemy.set(id,c);return c;
};
