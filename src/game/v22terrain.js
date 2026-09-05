"use strict";
/* Daylight atlas: crop once at decode; world-aligned 128px material repeats across
   16px gameplay cells. Collision ids, hazards and pickup behavior are unchanged. */
window.V22T={ready:false,sets:[],draws:0};
(function(){
  if(!window.V22ART)return;
  const im=new Image();
  im.onload=()=>{
    const w=im.naturalWidth/4,h=im.naturalHeight/2;
    for(let i=0;i<8;i++){
      const c=document.createElement('canvas');c.width=c.height=128;
      const g=c.getContext('2d');g.imageSmoothingEnabled=true;
      g.drawImage(im,(i%4)*w,Math.floor(i/4)*h,w,h,0,0,128,128);
      V22T.sets[i]=c;
    }
    V22T.ready=true;
  };
  im.src=V22ART.terrain;
})();
V22T.draw=function(id,X,Y){
  if(!V22T.ready||id>2)return false;
  const i=themeCfg().atlas,im=V22T.sets[i];
  ctx.drawImage(im,X%128,Y%128,TS,TS,X,Y,TS,TS);
  if(id===1){ctx.fillStyle='rgba(191,176,143,0.10)';ctx.fillRect(X,Y,TS,TS);}
  if(id===2){ctx.globalAlpha=0.30;ctx.drawImage(V22T.sets[7],X%128,Y%128,TS,TS,X,Y,TS,TS);ctx.globalAlpha=1;}
  V22T.draws++;return true;
};
/* Static ground is baked once per map (about 2 MiB), then one viewport blit.
   Water/ice/lava and obstacles stay in the live pass above this transparent layer. */
V22T.world=function(){
  if(!V22T.ready)return false;
  const atlas=themeCfg().atlas;
  if(V22T.map!==terr.m||V22T.atlas!==atlas){
    const c=document.createElement('canvas');c.width=WORLDW;c.height=WORLDH;
    const g=c.getContext('2d'),im=V22T.sets[atlas];
    for(let ty=0;ty<MAPH;ty++)for(let tx=0;tx<MAPW;tx++){
      const id=terr.m[ty*MAPW+tx],x=tx*TS,y=ty*TS;if(id>2)continue;
      g.drawImage(im,x%128,y%128,TS,TS,x,y,TS,TS);
      if(id===1){g.fillStyle='rgba(191,176,143,0.10)';g.fillRect(x,y,TS,TS);}
      if(id===2){g.globalAlpha=.30;g.drawImage(V22T.sets[7],x%128,y%128,TS,TS,x,y,TS,TS);g.globalAlpha=1;}
    }
    V22T.map=terr.m;V22T.atlas=atlas;V22T.cache=c;
  }
  ctx.drawImage(V22T.cache,0,0);V22T.draws++;
  return true;
};
