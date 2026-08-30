"use strict";
/* game/world — 地形生成与碰撞 */
/* ---------- 地形 ---------- */
const MAPW=60,MAPH=34, WORLDW=MAPW*TS, WORLDH=MAPH*TS;
function tileAt(tx,ty){ if(tx<0||ty<0||tx>=MAPW||ty>=MAPH)return 5; return terr.m[ty*MAPW+tx]; }
function tileAtPx(x,y){ return tileAt(Math.floor(x/TS),Math.floor(y/TS)); }
function slowMul(id){ return id===3?0.5 : id===4?0.45 : 1; }
function genMap(){
  const m=new Uint8Array(MAPW*MAPH);
  const base=(cfg.ground==='dry'||cfg.ground==='waste')?1:0;
  m.fill(base);
  const put=(cx,cy,r,t)=>{ for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++){
    if(x<1||y<1||x>=MAPW-1||y>=MAPH-1)continue;
    if((x-cx)*(x-cx)+(y-cy)*(y-cy)<=r*r+rnd(r)) m[y*MAPW+x]=t; } };
  if(cfg.ground==='grass'){ for(let i=0;i<16;i++)put(rnd(4,MAPW-4)|0,rnd(4,MAPH-4)|0,rnd(2,4)|0,rnd()<0.5?2:1); }
  else if(cfg.ground==='dry'){ for(let i=0;i<18;i++)put(rnd(4,MAPW-4)|0,rnd(4,MAPH-4)|0,rnd(2,4)|0,rnd()<0.6?2:0); }
  else if(cfg.ground==='swamp'){ for(let i=0;i<44;i++)put(rnd(3,MAPW-3)|0,rnd(3,MAPH-3)|0,rnd(2,4)|0,4);
    for(let i=0;i<10;i++)put(rnd(4,MAPW-4)|0,rnd(4,MAPH-4)|0,rnd(1,3)|0,2); }
  else if(cfg.ground==='waste'){ for(let i=0;i<20;i++)put(rnd(3,MAPW-3)|0,rnd(3,MAPH-3)|0,rnd(2,4)|0,rnd()<0.5?4:2);
    for(let i=0;i<10;i++)put(rnd(4,MAPW-4)|0,rnd(4,MAPH-4)|0,rnd(2,3)|0,0); }
  if(cfg.river){ const mid=MAPH/2+rnd(-4,4)|0, seed=rnd(10);
    for(let x=1;x<MAPW-1;x++){ const yy=Math.round(mid+Math.sin(x*0.22+seed)*2.4);
      for(let k=0;k<3;k++){ const y=yy+k; if(y>0&&y<MAPH-1) m[y*MAPW+x]=3; } } }
  const rockN=cfg.ground==='waste'?18:10;
  for(let i=0;i<rockN;i++){ let x,y,tries=0;
    do{x=rnd(2,MAPW-2)|0;y=rnd(2,MAPH-2)|0;tries++;}while(tries<30&&(m[y*MAPW+x]===5||Math.abs(x-MAPW/2)<4&&Math.abs(y-MAPH/2)<4));
    m[y*MAPW+x]=5; }
  terr={m};
}
function blockedAt(x,y,r){
  if(x<r+10||y<r+10||x>WORLDW-r-10||y>WORLDH-r-10)return true;
  const x0=Math.floor((x-r)/TS),x1=Math.floor((x+r)/TS),y0=Math.floor((y-r)/TS),y1=Math.floor((y+r)/TS);
  for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
    if(tileAt(tx,ty)===5){
      const cx=clamp(x,tx*TS,tx*TS+TS),cy=clamp(y,ty*TS,ty*TS+TS);
      if((x-cx)*(x-cx)+(y-cy)*(y-cy)<r*r)return true; } }
  return false;
}
function moveCirc(o,dx,dy,r){
  if(!blockedAt(o.x+dx,o.y+dy,r)){o.x+=dx;o.y+=dy;return true;}
  if(dx!==0&&!blockedAt(o.x+dx,o.y,r)){o.x+=dx;return true;}
  if(dy!==0&&!blockedAt(o.x,o.y+dy,r)){o.y+=dy;return true;}
  return false;
}
