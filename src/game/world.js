"use strict";
/* game/world — 地形生成与碰撞 */
/* ---------- 地形 ---------- */
const MAPW=60,MAPH=34, WORLDW=MAPW*TS, WORLDH=MAPH*TS;
function tileAt(tx,ty){ if(tx<0||ty<0||tx>=MAPW||ty>=MAPH)return 5; return terr.m[ty*MAPW+tx]; }
function tileAtPx(x,y){ return tileAt(Math.floor(x/TS),Math.floor(y/TS)); }
function slowMul(id){ return id===3?0.5 : id===4?0.55 : 1; }   /* v1.8 W3: 泥地 0.45→0.55 (契约§2) */
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
/* v1.8 W3.5: 扩展碰撞移动 — 返回 hit/表面法线(朝外)/法向冲击速度/剩余位移;
   冲量语义由调用方处理(只改 vx/vy, 禁 x+= 直改)。vx/vy 可选: 提供则算 impact。 */
function moveCircEx(o,dx,dy,r,vx,vy){
  if(!blockedAt(o.x+dx,o.y+dy,r)){ o.x+=dx; o.y+=dy;
    return {hit:false,moved:true,nx:0,ny:0,impact:0,rdx:0,rdy:0}; }
  const hd=Math.hypot(dx,dy)||1e-9;
  let m1=false,m2=false;
  if(dx!==0&&!blockedAt(o.x+dx,o.y,r)){ o.x+=dx; m1=true; }
  if(dy!==0&&!blockedAt(o.x,o.y+dy,r)){ o.y+=dy; m2=true; }
  let nx,ny;
  if(!m1&&!m2){ nx=-dx/hd; ny=-dy/hd; }              /* 正撞: 法线=运动反方向 */
  else if(!m1){ nx=dx>0?-1:1; ny=0; }                /* X 轴被挡 */
  else { nx=0; ny=dy>0?-1:1; }                       /* Y 轴被挡 */
  const impact=(vx===undefined)?0:Math.max(0,-(vx*nx+vy*ny));
  return {hit:true,moved:m1||m2,nx,ny,impact,rdx:m1?0:dx,rdy:m2?0:dy};
}
/* 兼容包装: 旧行为=是否产生位移 */
function moveCirc(o,dx,dy,r){ return moveCircEx(o,dx,dy,r).moved; }
