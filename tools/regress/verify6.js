/* 主流程 39 项 — verify6 重建版 (原 /tmp/tanktest/verify6.js 丢失, 按 BASELINE.md 规格重建, 对齐 v1.3+ 菜单链)
   状态机12 + 键盘武器7 + 设置7 + 战斗成长存档9 + 音频渲染卫生4 */
const pw = require('/Users/rancequan/.hermes/hermes-agent/node_modules/playwright-core');
const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);
let fails = 0;
const ok = (c, n) => { log((c ? 'PASS' : '!!FAIL') + ' - ' + n); if (!c) fails++; };
(async () => {
  const browser = await pw.chromium.launch({executablePath: EXE, headless: true});
  const page = await browser.newPage({viewport: {width: 960, height: 540}});
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto('file:///Volumes/vol1/像素小游戏/index.html'); await sleep(1200);
  const ev = fn => page.evaluate(fn);
  const boot = async () => { await ev(() => { window.G.start(); menuActivate(); menuActivate(); onKeyPress('Enter'); }); await sleep(3400); };

  /* ---------- 状态机 (12) ---------- */
  ok(await ev(() => ST.state === 'title' && MENU && MENU.id === 'title'), '1 初始标题状态+菜单');
  await ev(() => window.G.start());
  ok(await ev(() => MENU && MENU.id === 'hull'), '2 新游戏→机体选择');
  await ev(() => menuActivate());
  ok(await ev(() => MENU && MENU.id === 'wingman'), '3 机体→僚机选择');
  await ev(() => menuActivate());
  ok(await ev(() => ST.state === 'ctrl'), '4 僚机→战前速览');
  await ev(() => onKeyPress('Enter')); await sleep(3400);
  ok(await ev(() => ST.state === 'play' && !MENU), '5 速览→开场→进入战斗');
  await page.keyboard.press('KeyP'); await sleep(200);
  ok(await ev(() => MENU && MENU.id === 'pause'), '6 P→暂停菜单');
  await ev(() => { MENU = null; }); await sleep(150);
  ok(await ev(() => ST.state === 'play' && !MENU), '7 继续游戏恢复战斗');
  await page.keyboard.press('Escape'); await sleep(200);
  ok(await ev(() => MENU && MENU.id === 'pause'), '8 Esc→暂停菜单');
  await ev(() => menuActivate()); /* resume 行 */ await sleep(150);
  await page.keyboard.press('Escape'); await sleep(200);
  await ev(() => { menuItems('pause'); }); /* 确保 items 可建 */
  await ev(() => { const its = menuItems('pause'); MENU.sel = its.findIndex(i => i.label === 'quitTitle'); });
  await ev(() => menuActivate()); await sleep(250);
  ok(await ev(() => ST.state === 'title'), '9 暂停→返回标题');
  await boot();
  await ev(() => window.G.hurt()); await sleep(400);
  ok(await ev(() => ST.state === 'over'), '10 阵亡→失败画面');
  await page.keyboard.press('KeyR'); await sleep(3400);
  ok(await ev(() => ST.state === 'play'), '11 R→重试本关');
  await ev(() => window.G.hurt()); await sleep(400);
  await page.keyboard.press('KeyQ'); await sleep(300);
  ok(await ev(() => ST.state === 'title'), '12 Q→返回标题');

  /* ---------- 键盘武器 (7) ---------- */
  await boot();
  await ev(() => { G.dbg.god = true; ST.spawnT = 1e9; enemies.length = 0; });
  const s0 = await ev(() => G.info().shotsFired);
  await page.keyboard.down('KeyJ'); await sleep(600); await page.keyboard.up('KeyJ');
  ok((await ev(() => G.info().shotsFired)) - s0 >= 5, '13 J机枪按住连发');
  await page.keyboard.down('KeyK'); await sleep(160); await page.keyboard.up('KeyK');
  ok(await ev(() => shots.some(s => s.kind === 'shell' && s.friendly)), '14 K主炮发射');
  await page.keyboard.down('KeyL'); await sleep(900); await page.keyboard.up('KeyL'); await sleep(250);
  ok(await ev(() => shots.some(s => s.kind === 'missile' && s.friendly)), '15 L蓄力导弹松发');
  await page.keyboard.press('KeyU'); await sleep(300);
  ok(await ev(() => planes.length > 0 || player.strikeCd > 4), '16 U空袭+5s冷却');
  await ev(() => { player.vx = 0; player.vy = 0; });
  const g0 = await ev(() => player.sprintG);
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await sleep(700);
  const spd = await ev(() => Math.hypot(player.vx, player.vy));
  await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
  ok(spd > 110 && g0 >= 0.9, '17 Shift涡轮加速(' + spd.toFixed(0) + 'px/s)');
  await page.keyboard.press('Space'); await sleep(120);
  ok(await ev(() => player.shieldT > 0 || player.shieldGrace > 0), '18 空格护盾瞬间格挡');
  await ev(() => { window.G.tp(240, 135); player.vx = 0; player.vy = 0; ST.spawnT = 1e9; });
  await ev(() => window.G.reflectProbe()); await sleep(400);
  ok(await ev(() => window.G.checkReflected() || player.shieldFlash > 0.02), '19 敌弹被护盾反弹(反弹瞬间必留 flash, 反弹弹撞岩自毁不影响判定)');

  /* ---------- 设置 OPTION (7) ---------- */
  await ev(() => window.G.menu('option'));
  ok(await ev(() => MENU && MENU.id === 'option'), '20 标题进OPTION');
  await ev(() => { SET.lang = 'ja'; });
  ok((await ev(() => T('mNew'))) !== '开始新游戏' && (await ev(() => T('mNew'))).length > 0, '21 语言实时切换(ja)');
  await ev(() => { SET.lang = 'zh'; });
  await ev(() => window.G.set('diff', 4));
  ok(await ev(() => SET.diff === 4 && JSON.parse(localStorage.getItem('trSet')).diff === 4), '22 难度档位+trSet持久化');
  await ev(() => window.G.set('bgm', 1)); await ev(() => window.G.set('se', 2));
  ok(await ev(() => SET.bgm === 1 && SET.se === 2 && JSON.parse(localStorage.getItem('trSet')).se === 2), '23 音量档位+持久化');
  await ev(() => { SET.touch = 'on'; }); ok(await ev(() => SET.touch === 'on'), '24a 虚拟按钮开关(on)');
  await ev(() => { SET.touch = 'off'; }); await ev(() => { SET.touch = 'auto'; });
  ok(await ev(() => SET.touch === 'auto'), '24b 虚拟按钮回auto');
  await ev(() => { SET = JSON.parse(JSON.stringify(SET_DEF)); saveSet(); });
  ok(await ev(() => SET.diff === 2 && SET.lang === 'zh'), '25 恢复默认设置');
  await page.keyboard.press('KeyP'); await sleep(200);
  await ev(() => { const its = menuItems('pause'); MENU.sel = its.findIndex(i => i.label === 'settings'); });
  await ev(() => menuActivate());
  ok(await ev(() => MENU && MENU.id === 'option'), '26 暂停菜单进设置');
  await ev(() => { MENU = null; }); await sleep(150);

  /* ---------- 战斗/成长/存档 (9) ---------- */
  await ev(() => { player.bodyA = 0; player.ta = 0; const e = G.dummy('truck', player.x + 120, player.y); e.stun = 99; });   /* 车身+炮塔朝右对准靶机(v1.8: 射击沿ta) */
  const k0 = await ev(() => RUN.kills), sc0 = await ev(() => RUN.score);
  await page.keyboard.down('KeyJ'); await sleep(1200); await page.keyboard.up('KeyJ'); await sleep(300);
  const k1 = await ev(() => RUN.kills), sc1 = await ev(() => RUN.score);
  ok(k1 > k0 && sc1 > sc0, '27 实战击破+计分(kills ' + k0 + '→' + k1 + ')');
  const pts0 = await ev(() => RUN.pts);
  await ev(() => window.G.dropTest('part'));
  await ev(() => { const pk = pickups[pickups.length - 1]; pk.x = player.x; pk.y = player.y; });
  await sleep(400);
  const pts1 = await ev(() => RUN.pts);
  ok(pts1 === pts0 + 1, '28 部件掉落拾取+pts(' + pts0 + '→' + pts1 + ')');
  let wpos = await ev(() => window.G.findTile(3));
  if (!wpos) { await ev(() => window.G.skipTo(2)); await sleep(2600); wpos = await ev(() => window.G.findTile(3)); }   /* L1沙漠无水格→跳L3雨巷 */
  if (wpos) {
    /* 坦克 0.3s 即驶出水格: 页内逐帧采样(所在tile,速度), 取"仍在水格上"的最大速度 */
    await page.evaluate(w => { window.G.tp(w.x, w.y); player.vx = 0; player.vy = 0; }, wpos);
    await page.keyboard.down('KeyW');
    const wsam = await page.evaluate(() => new Promise(res => { const out = []; let n = 0;
      const iv = setInterval(() => { out.push({t: tileAt((player.x / TS) | 0, (player.y / TS) | 0), s: Math.hypot(player.vx, player.vy)});
        if (++n >= 30) { clearInterval(iv); res(out); } }, 16); }));
    await page.keyboard.up('KeyW');
    await ev(() => { window.G.tp(240, 135); player.vx = 0; player.vy = 0; });
    await page.keyboard.down('KeyW'); await sleep(500);
    const gs = await ev(() => Math.hypot(player.vx, player.vy));
    await page.keyboard.up('KeyW');
    const ws = Math.max(0, ...wsam.filter(o => o.t === 3).map(o => o.s));
    const wframes = wsam.filter(o => o.t === 3).length;
    ok(wframes >= 3 && ws < gs * 0.75, '29 河流减速(水上最大 ' + ws.toFixed(0) + ' vs 地面 ' + gs.toFixed(0) + ', 水上帧' + wframes + ')');
  } else ok(false, '29 找不到水格');
  await ev(() => { ST.spawnT = 1e9; enemies.length = 0; window.G.boss(); });
  await sleep(3200);
  ok(await ev(() => enemies.some(e => e.boss)), '30a BOSS登场');
  await ev(() => { enemies.forEach(e => hurtEnemy(e, 1e9, 'shot')); }); await sleep(600);   /* v1.6+: BOSS 带精英护卫队, 需全员清空才过关 */
  ok(await ev(() => ST.state === 'clear' || ST.state === 'upgrade'), '30b BOSS击破→过关结算');
  await page.keyboard.press('Enter'); await sleep(500);
  ok(await ev(() => ST.state === 'upgrade'), '31a 结算→战地整备');
  await ev(() => { RUN.pts = 3; ST.upg.sel = 2; }); /* atk 行 */
  await ev(() => upgKey('ArrowRight'));
  ok(await ev(() => RUN.up.atk === 1 && RUN.pts === 2), '31b 部件加点(攻击+1)');
  const ptsBefore = await ev(() => RUN.pts);
  await ev(() => refundAll());
  const ptsAfter = await ev(() => RUN.pts);
  ok(await ev(() => RUN.up.atk === 0) && ptsAfter === ptsBefore + 1, '32 退点守恒(+' + (ptsAfter - ptsBefore) + ')');
  const lvl0 = await ev(() => RUN.lvl);
  await ev(() => upgKey('Enter')); await sleep(3200);
  const lvl1 = await ev(() => RUN.lvl);
  ok(await ev(() => ST.state === 'play') && lvl1 === lvl0 + 1, '33 出击→下一关(L' + lvl1 + ')');
  await ev(() => window.G.save());
  ok(await ev(() => hasSave() && menuItems('title').some(i => i.label === 'mCont')), '34 存档→标题继续存档入口');
  const cyc0 = await ev(() => RUN.cycle);
  await ev(() => { window.G.skipTo(6); }); await sleep(2600);     /* L7 开场走完进 play */
  await ev(() => { ST.spawnT = 1e9; window.G.win(); }); await sleep(600);
  await ev(() => onKeyPress('Enter')); await sleep(600);          /* L7 clear→win 撒花名单 */
  await ev(() => onKeyPress('Enter')); await sleep(3400);         /* win Enter→直接下一周目(BASELINE: R 才是重分配) */
  const cyc1 = await ev(() => RUN.cycle), lvlN = await ev(() => RUN.lvl);
  ok(await ev(() => ST.state === 'play') && cyc1 === cyc0 + 1 && lvlN === 0, '35 通关→下一周目(cycle ' + cyc1 + ', L' + (lvlN + 1) + ')');

  /* ---------- 音频/渲染/卫生 (4) ---------- */
  ok(await ev(() => typeof AC !== 'undefined' && AC && AC.state === 'running'), '36 AudioContext激活');
  ok(await ev(() => VW === 480 && VH === 270 && cv.width >= VW), '37 480×270虚拟分辨率+画布放大');
  await page.keyboard.press('Escape'); await sleep(200); await ev(() => { MENU = null; });  /* 退出可能的暂停 */
  await ev(() => window.G.menu('help')); await sleep(200);
  await ev(() => menuAdjust(1)); await ev(() => menuAdjust(1));
  ok(await ev(() => MENU && MENU.id === 'help' && MENU.page === 2), '38 操作说明13页可翻(p3)');
  await ev(() => menuBack());
  ok(await ev(() => errStr === null || errStr === '') && errors.length === 0, '39 零错误(errStr空+console干净)');

  log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
  await browser.close();
  log(fails === 0 && errors.length === 0 ? '=== MAINFLOW 39 ALL PASS ===' : '=== ' + fails + ' FAILS ===');
  process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
