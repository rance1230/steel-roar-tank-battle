"use strict";
/* game/v15terrain — v15 地形图集接入层
   assets/ai-v15-topdown 地形条带 (每 stage 8 槽×32px, 见 tools/assemble_v15_data.py
   TERRAIN_SLOTS) → 启动时一次性烘焙为 16×16 (TS) 像素 tile, drawTerrain 逐格
   drawImage 替换原程序化填色。tile id 语义/玩法 (减速/阻挡) 不变:
     id0/id1 = 地面基底 (grass 图 id0 主/干径 id1; dry/waste 图反之), hsh 选 A/B 变体
     id2     = 残骸补丁 (槽14/15 变体)
     id3     = 水面/冰面/熔岩 (槽6; 上邻非水时用槽7 岸线过渡)
     id4     = 减速区 油污/能量地板/熔岩 (槽6 同源, 主题自洽)
     id5     = 岩石障碍 (槽8)
   烘焙失败/未加载 → drawTerrain 自动回退原像素分支。 */
window.V15T={ok:false,ready:false,sets:null};
(function(){
  const M=window.V15_MANIFEST;
  if(!M||!M.terrain||!M.terrain.stages||!M.terrain.stages.length)return;
  const T=M.terrain, stages=T.stages;
  V15T.sets=new Array(stages.length);
  function bakeSet(im){
    /* 条带 8 槽横排; 顺序 = TERRAIN_SLOTS [0,1,2,6,7,8,14,15] */
    const src=im.naturalWidth/8, sh=im.naturalHeight;
    const mk=j=>{ const c=document.createElement('canvas'); c.width=TS; c.height=TS;
      const g=c.getContext('2d'); g.imageSmoothingEnabled=true;
      g.drawImage(im,j*src,0,src,sh,0,0,TS,TS); return c; };
    return {g0:mk(0),g1:mk(1),path:mk(2),water:mk(3),wedge:mk(4),rock:mk(5),d0:mk(6),d1:mk(7)};
  }
  let left=stages.length;
  for(let i=0;i<stages.length;i++){
    const im=new Image();
    im.onload=()=>{ try{ V15T.sets[i]=bakeSet(im); }catch(e){}
      if(--left===0){ V15T.ok=V15T.sets.some(Boolean); V15T.ready=true; } };
    im.onerror=()=>{ if(--left===0){ V15T.ok=V15T.sets.some(Boolean); V15T.ready=true; } };
    im.src=M.images[stages[i].img];
  }
})();
/* 取当前关卡主题的烘焙集; 不带参则按 cfg.th 解析 */
V15T.set=function(atlasIdx){
  if(!V15T.ok)return null;
  return V15T.sets[atlasIdx!==undefined?atlasIdx:(cfg?themeCfg().atlas:0)]||null;
};
/* 供 drawTerrain/帮助页使用: 在 (X,Y) 画 16px 地形 tile */
V15T.draw=function(set,id,tx,ty,X,Y,h,tm,fx){
  let c;
  if(id===0) c=cfg.ground==='grass'?(h<0.5?set.g0:set.g1):set.path;
  else if(id===1) c=cfg.ground==='grass'?set.path:(h<0.5?set.g0:set.g1);
  else if(id===2) c=h<0.5?set.d0:set.d1;
  else if(id===3||id===4){
    const up=ty>0?terr.m[(ty-1)*MAPW+tx]:3;
    c=(id===3&&up!==3&&up!==4)?set.wedge:set.water;
  }
  else c=set.rock;
  ctx.drawImage(c,X,Y);
  if(id===3||id===4){                      /* 水面/减速区动效: 主题色微光 */
    const col=id===4?fx.slow:fx.water, w=(h*10+tm)%10;
    if(w<3)px(X+((h*53)|0)%10,Y+((h*97)|0)%12,5,1,rgba(col,0.42));
    else if(w>7)px(X+((h*31)|0)%10,Y+((h*71)|0)%12,4,1,rgba(col,0.30));
  }
  else if(id===5){                         /* 障碍勾边, 保证可读性 */
    ctx.strokeStyle=rgba('#020407',0.55); ctx.lineWidth=1;
    ctx.strokeRect(X+0.5,Y+0.5,TS-1,TS-1);
  }
};
/* 帮助页 pg8 地形展示: 画某主题 ground 基底 tile */
V15T.helpGround=function(atlasIdx,x,y){
  const s=V15T.set(atlasIdx);
  if(s)ctx.drawImage(s.g0,x,y);
  return !!s;
};
