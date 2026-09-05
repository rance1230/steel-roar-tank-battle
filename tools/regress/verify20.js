/* Focused v1.9 follow-up: real browser state, independent expected outcomes. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const {pw,executablePath}=require('./runtime.cjs');
const out = path.join(root, 'output/optimization-20260905');
const entry = require('./runtime.cjs').gameURL;
(async () => {
  const browser = await pw.chromium.launch({executablePath, headless:true});
  const page = await browser.newPage({viewport:{width:960,height:432}});
  const errors=[], results=[];
  page.on('pageerror', e=>errors.push(e.message));
  const check=(name, pass, detail)=>{results.push({name,pass:!!pass,detail});console.log((pass?'PASS ':'FAIL ')+name+' '+JSON.stringify(detail));};
  try {
    await page.goto(entry);
    await page.waitForFunction(()=>window.V18M && V18M.ready && window.V18UIR);
    await page.evaluate(()=>{ST.debugActive=true;SET.touch='on';startLevel();ST.state='play';ST.spawnT=1e9;player.inv=0;});
    const ng=await page.evaluate(()=>{RUN=RUN_DEF();RUN.cycle=3;RUN.pts=7;RUN.up.atk=10;RUN.wingmanGrowth.firepower=5;RUN.eq.fire=2;ST.state='win';beginNgPlus();return {cycle:RUN.cycle,total:RUN.pts+RUN.up.atk+RUN.wingmanGrowth.firepower,eq:RUN.eq.fire,state:ST.state};});
    check('NG+ preserves cycle, equipment and all earned points',ng.cycle===3&&ng.total===22&&ng.eq===2,ng);
    check('NG+ leaves completed-results rendering',ng.state!=='win',ng.state);
    const cap=await page.evaluate(()=>{RUN=RUN_DEF();RUN.up.cdr=21;RUN.pts=9;for(let i=0;i<9;i++)upgAdjust('cdr',1);return {pts:RUN.pts,lv:RUN.up.cdr};});
    check('capped cooldown never consumes points',cap.pts===9&&cap.lv===21,cap);
    const air=await page.evaluate(()=>{RUN=RUN_DEF();startLevel();ST.state='play';ST.spawnT=1e9;enemies.length=0;onKeyPress('KeyU');return {cd:player.strikeCd,planes:planes.length};});
    check('empty airstrike does not consume cooldown',air.cd===0,air);
    const modes=await page.evaluate(()=>{
      if(typeof setAimMode!=='function')return {missing:true};
      const result={};enemies.length=0;G.dummy('tank',player.x,player.y-100);PAD.just={};
      setAimMode('manual');player.ta=0;PAD.rax=0;PAD.ray=0;for(let i=0;i<60;i++)updateMgAim(1/60);result.manual=player.ta;
      setAimMode('auto');player.ta=0;PAD.rax=1;PAD.ray=0;for(let i=0;i<60;i++)updateMgAim(1/60);result.auto=player.ta;
      setAimMode('hybrid');player.ta=0;PAD.rax=1;PAD.ray=0;updateMgAim(1/60);result.takeover=player.mgAimMode;
      PAD.rax=0;PAD.ray=0;for(let i=0;i<120;i++)updateMgAim(1/60);result.resume=player.ta;
      return result;
    });
    check('manual retains heading without target takeover',!modes.missing&&Math.abs(modes.manual)<0.001,modes);
    check('auto ignores manual axis and tracks enemy',!modes.missing&&Math.abs(modes.auto+Math.PI/2)<0.02,modes);
    check('hybrid accepts axis then resumes tracking',modes.takeover==='manual'&&Math.abs(modes.resume+Math.PI/2)<0.02,modes);
    const sticky=await page.evaluate(()=>{enemies.length=0;setAimMode('hybrid');const a=G.dummy('tank',player.x+100,player.y),b=G.dummy('tank',player.x+95,player.y);player.mgAutoId=a.id;PAD.rax=PAD.ray=0;PAD.just={};updateMgAim(1/60);cycleMgLock();const first=player.mgLockId;cycleMgLock();return {first,second:player.mgLockId,a:a.id,b:b.id};});
    check('first lock preserves current reticle before cycling',sticky.first===sticky.a&&sticky.second===sticky.b,sticky);
    const release=await page.evaluate(()=>{
      keys.add('ArrowRight');pollPad();const down=PAD.rax;keys.delete('ArrowRight');pollPad();const up=PAD.rax;
      VR.ax=1;pollPad();const touchDown=PAD.rax;VR.ax=0;pollPad();const touchUp=PAD.rax;
      const original=navigator.getGamepads;
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[{connected:true,axes:[0,0,0.7,0],buttons:Array.from({length:17},()=>({pressed:false}))}]});pollPad();const padDown=PAD.rax;
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[{connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false}))}]});pollPad();const padUp=PAD.rax;
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:original});pollPad();return {down,up,touchDown,touchUp,padDown,padUp};
    });
    check('keyboard, touch and controller axes release completely',release.down===1&&release.up===0&&release.touchDown===1&&release.touchUp===0&&release.padDown===0.7&&release.padUp===0,release);
    const next=await page.evaluate(()=>{RUN=RUN_DEF();RUN.pts=12;RUN.up.atk=4;RUN.eq.fire=2;const seq=[];for(let i=0;i<3;i++){ST.state='win';beginNgPlus();RUN.hull='heavy';RUN.wing='guard';enterCtrlIntro();exitCtrlIntro();deployFromUpgrade();seq.push({cycle:RUN.cycle,pts:RUN.pts,eq:RUN.eq.fire});}return seq;});
    check('three NG+ deployments increment exactly once and preserve assets',next.every((r,i)=>r.cycle===i+1&&r.pts===16&&r.eq===2),next);
    const targeting=await page.evaluate(()=>{
      startLevel();ST.state='play';ST.spawnT=1e9;enemies.length=0;const a=G.dummy('tank',player.x+40,player.y),b=G.dummy('tank',player.x+90,player.y);player.mgLockId=b.id;
      tryAirstrike();const target=planes[0].targetId;enemies.length=0;for(let i=0;i<60;i++)updPlanes(1/60);const remaining=planes[0].drops;for(let i=0;i<480;i++)updPlanes(1/60);
      return {target,expected:b.id,remaining,expired:planes.length};
    });
    check('airstrike honors explicit lock, retains bombs while waiting and expires',targeting.target===targeting.expected&&targeting.remaining===7&&targeting.expired===0,targeting);
    const visibility=await page.evaluate(()=>{
      SET.touch='on';MENU=null;ST.state='play';VR.ax=1;setAimMode('auto');const hidden=getComputedStyle(document.getElementById('rjoy')).display==='none',zero=VR.ax===0;
      setAimMode('manual');const manualVisible=getComputedStyle(document.getElementById('rjoy')).display!=='none',noLock=getComputedStyle(document.querySelector('[data-action="KeyI"]')).display==='none';
      return {hidden,zero,manualVisible,noLock};
    });
    check('mode switch updates controls and clears transient input',Object.values(visibility).every(Boolean),visibility);
    await page.evaluate(()=>{if(typeof setAimMode==='function')setAimMode('hybrid');SET.touch='on';MENU=null;ST.state='play';updOvl();});
    const overlap=await page.evaluate(()=>{const a=document.querySelector('[data-action="KeyI"]').getBoundingClientRect(), b=document.querySelector('[data-action="KeyU"]').getBoundingClientRect();return {a:a.toJSON(),b:b.toJSON(),hit:a.width>0&&Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)};});
    check('lock and airstrike have separate touch targets',!overlap.hit&&overlap.a.width>0,overlap);
    const guide=await page.evaluate(()=>{const old=V18M.layers;let calls=0;V18M.layers=function(...args){calls++;return old(...args);};const errs=[];try{for(const lang of ['zh','ja','en']){SET.lang=lang;for(let pg=0;pg<HELP_PAGES;pg++){openMenu('help','title');MENU.page=pg;drawHelp();}for(let mode=0;mode<3;mode++){MENU=null;ST.state='ctrl';ST.ctrlMode=mode;for(let i=0;i<CTRL_ACTS.length;i++){ST.ctrlIdx=i;drawCtrlIntro();}}}}catch(e){errs.push(e.message);}finally{V18M.layers=old;SET.lang='zh';}return {calls,errs};});
    check('all guide pages and three control layouts use current art without errors',guide.calls>60&&guide.errs.length===0,guide);
    await page.evaluate(()=>{setAimMode('manual');});await page.reload();
    const persistence=await page.evaluate(()=>({mode:aimMode(),valid:SET.pad.lock===11}));
    check('aim mode persists on reload',persistence.mode==='manual'&&persistence.valid,persistence);
    await page.evaluate(()=>localStorage.setItem('trSet',JSON.stringify({lang:'en',bgm:2,se:2,pad:{mg:0}})));await page.reload();
    const migration=await page.evaluate(()=>({mode:aimMode(),lock:SET.pad.lock,bgm:SET.bgm}));
    check('old settings keep preferences and receive safe defaults',migration.mode==='hybrid'&&migration.lock===11&&migration.bgm===2,migration);
    check('browser has no uncaught errors',errors.length===0,errors);
  } finally {
    fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,process.env.RESULT_NAME||'behavior-results.json'),JSON.stringify({entry,results,errors},null,2));
    await browser.close();
  }
  if(results.some(r=>!r.pass)||errors.length)process.exitCode=1;
})();
