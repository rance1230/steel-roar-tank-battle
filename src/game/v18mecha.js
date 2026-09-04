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
V18M.layers=function(g,key,x,y,bodyA,ta,w){
  const m=V18M.meta[key], hull=V18M.imgs[key+'_hull'], turret=V18M.imgs[key+'_turret'];
  if(!m||!V18M.valid(key+'_hull')||!V18M.valid(key+'_turret'))return false;
  const idx=V18M.frameIndex(key,bodyA||0), cell=m.cellSize, W=w;
  g.save(); g.imageSmoothingEnabled=true;
  g.drawImage(hull,(idx%4)*cell,(idx>>2)*cell,cell,cell,x-W/2,y-W/2,W,W);
  g.translate(x,y); g.rotate(ta||0); g.drawImage(turret,-W/2,-W/2,W,W);
  g.restore(); return true;
};
V18M.ghostFrame=function(key,idx,lv){
  const id=key+':'+idx+':'+lv; if(V18M._gh.has(id))return V18M._gh.get(id);
  if(!V18M.valid(key+'_hull'))return null;
  const m=V18M.meta[key], im=V18M.imgs[key+'_hull'], cv=document.createElement('canvas');
  cv.width=cv.height=m.cellSize; const g=cv.getContext('2d'); g.imageSmoothingEnabled=false;
  g.drawImage(im,(idx%4)*m.cellSize,(idx>>2)*m.cellSize,m.cellSize,m.cellSize,0,0,m.cellSize,m.cellSize);
  g.globalCompositeOperation='source-in'; g.fillStyle=GHOST_COL[lv]||GHOST_COL[0]; g.fillRect(0,0,cv.width,cv.height);
  V18M._gh.set(id,cv); return cv;
};
V18M.playerLayers=function(g,x,y,bodyA,ta,w){ return V18M.layers(g,RUN.hull||'balanced',x,y,bodyA,ta,w); };
V18M.info=function(){ return {ok:V18M.ok,ready:V18M.ready,units:Object.keys(V18M.meta).filter(k=>V18M.valid(k+'_hull')&&V18M.valid(k+'_turret'))}; };
