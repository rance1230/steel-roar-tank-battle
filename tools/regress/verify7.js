/* 触屏专项 12 项 — v1.8 基线版 (对齐 v1.5+ 摇杆环触屏, 原 11 按钮 D-pad 方案标 SUPERSEDED) */
const pw = require('/Users/rancequan/.hermes/hermes-agent/node_modules/playwright-core');
const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);
let fails = 0;
const ok = (c, n) => { log((c ? 'PASS' : '!!FAIL') + ' - ' + n); if (!c) fails++; };
const OUT = __dirname + '/../../output/visual/regress-pre';
(async () => {
  fs.mkdirSync(OUT, {recursive: true});
  const browser = await pw.chromium.launch({executablePath: EXE, headless: true});
  const ctx = await browser.newContext({viewport: {width: 700, height: 360}, hasTouch: true, isMobile: true});
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto('file:///Volumes/vol1/像素小游戏/index.html'); await sleep(1500);

  // 1) 虚拟按钮(v1.5+): 7 个动作钮 + 摇杆环
  const btns = await page.evaluate(() => [...document.querySelectorAll('.tbtn')].map(b => b.innerText.trim()));
  ok(btns.length === 7, '虚拟按钮数量 7 (' + btns.length + ')');
  ok(btns.every(t => t && t.length > 0), '每个按钮都有文字说明');
  log('  按钮文字:', JSON.stringify(btns));
  ok(await page.evaluate(() => { const j = document.getElementById('joy'); return !!j && !!j.querySelector('.jstick'); }), '模拟摇杆环 #joy 存在(含摇杆头)');

  // 2) 标题菜单点触 → hull → wingman → ctrl → play 全触屏链
  const cr = await page.evaluate(() => { const b = cv.getBoundingClientRect(); return {l: b.left, t: b.top, w: b.width, h: b.height}; });
  const tapCv = async (x, y) => page.touchscreen.tap(cr.l + x / 480 * cr.w, cr.t + y / 270 * cr.h);
  const rowTap = async () => { const r = await page.evaluate(() => { const q = MENU_RECTS[0]; return q ? {x: q.x + q.w / 2, y: q.y + q.h / 2} : null; }); if (r) await tapCv(r.x, r.y); };
  await rowTap(); await sleep(400);                       // 开始新游戏 → hull
  ok((await page.evaluate(() => MENU && MENU.id)) === 'hull', '触屏点标题进入机体选择');
  await rowTap(); await sleep(400);                       // hull → wingman
  ok((await page.evaluate(() => MENU && MENU.id)) === 'wingman', '触屏选机体进入僚机选择');
  await rowTap(); await sleep(400);                       // wingman → ctrl
  ok((await page.evaluate(() => ST.state)) === 'ctrl', '触屏选僚机进入战前速览');
  await tapCv(240, 135); await sleep(3400);               // ctrl 点任意处 → intro → play
  ok((await page.evaluate(() => ST.state)) === 'play', '触屏全链进入战斗');

  // 3) 战斗中虚拟按钮显示
  ok(await page.evaluate(() => document.getElementById('touchovl').style.display === 'block'), '战斗中虚拟按钮可见');
  await page.screenshot({path: OUT + '/13-touch-play.png'});

  // 4) 摇杆环: 推上 → VJ 轴 + VKEYS KeyW + 上移 (真实 pointer 事件链)
  await page.evaluate(() => { const r = document.getElementById('joy').getBoundingClientRect();
    window.joyCx = r.left + r.width / 2; window.joyCy = r.top + r.height / 2; window.joyMax = r.width / 2 * 0.62; });
  const joyDown = () => page.evaluate(() => document.getElementById('joy').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, pointerId: 7, clientX: joyCx, clientY: joyCy})));
  const joyMove = (dx, dy) => page.evaluate(([dx, dy]) => document.getElementById('joy').dispatchEvent(new PointerEvent('pointermove', {bubbles: true, pointerId: 7, clientX: joyCx + dx, clientY: joyCy + dy})), [dx, dy]);
  const joyUp = () => page.evaluate(() => document.getElementById('joy').dispatchEvent(new PointerEvent('pointerup', {bubbles: true, pointerId: 7})));
  const p0 = await page.evaluate(() => ({x: Math.round(player.x), y: Math.round(player.y)}));
  const jm = await page.evaluate(() => joyMax);
  await joyDown();
  await joyMove(0, -jm * 0.9);
  await sleep(800);
  const vk = await page.evaluate(() => [...VKEYS]);
  const vj = await page.evaluate(() => ({ax: VJ.ax, ay: VJ.ay}));
  const p1 = await page.evaluate(() => ({x: Math.round(player.x), y: Math.round(player.y)}));
  await joyUp();
  ok(vj.ay < -0.5 && Math.abs(vj.ax) < 0.2, '摇杆上推 VJ 轴 (' + vj.ax.toFixed(2) + ',' + vj.ay.toFixed(2) + ')');
  ok(vk.includes('KeyW') && p1.y < p0.y - 25, '摇杆上推→VKEYS+坦克上移 (' + p0.y + '→' + p1.y + ')');

  // 5) 摇杆 45°: 同步 KeyW+KeyD
  await joyDown(); await joyMove(jm * 0.8, -jm * 0.8); await sleep(300);
  const vk45 = await page.evaluate(() => [...VKEYS]);
  await joyUp();
  ok(vk45.includes('KeyW') && vk45.includes('KeyD'), '摇杆45°→W+D 同步 (' + vk45.join(',') + ')');

  // 6) 机枪长按连发
  await page.evaluate(() => { const b = [...document.querySelectorAll('.tbtn')].find(x => x.innerText.includes('机枪'));
    b.dispatchEvent(new Event('pointerdown', {bubbles: true})); });
  await sleep(700);
  const shots = await page.evaluate(() => shots.length);
  await page.evaluate(() => { const b = [...document.querySelectorAll('.tbtn')].find(x => x.innerText.includes('机枪'));
    b.dispatchEvent(new Event('pointerup', {bubbles: true})); });
  ok(shots >= 3, '虚拟机枪连发 (' + shots + '发)');

  // 7) 空袭(点按型)
  await page.evaluate(() => { const b = [...document.querySelectorAll('.tbtn')].find(x => x.innerText.includes('空袭'));
    b.dispatchEvent(new Event('pointerdown', {bubbles: true}));
    b.dispatchEvent(new Event('pointerup', {bubbles: true})); });
  await sleep(400);
  ok(await page.evaluate(() => planes.length > 0 || player.strikeCd > 4), '虚拟空袭触发');

  // 8) 暂停按钮
  await page.evaluate(() => { const b = [...document.querySelectorAll('.tbtn')].find(x => x.innerText.includes('暂停'));
    b.dispatchEvent(new Event('pointerdown', {bubbles: true}));
    b.dispatchEvent(new Event('pointerup', {bubbles: true})); });
  await sleep(300);
  ok((await page.evaluate(() => MENU && MENU.id)) === 'pause', '虚拟暂停按钮');
  await page.screenshot({path: OUT + '/14-touch-pause.png'});

  // 9) 关闭虚拟按钮
  await page.evaluate(() => { MENU = null; });
  await page.evaluate(() => G.set('touch', 'off'));
  await sleep(300);
  ok(await page.evaluate(() => document.getElementById('touchovl').style.display === 'none'), '设置关闭虚拟按钮');
  await page.evaluate(() => G.set('touch', 'auto'));
  await sleep(200);

  log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
  await browser.close();
  log(fails === 0 && errors.length === 0 ? '=== TOUCH ALL PASS ===' : '=== ' + fails + ' FAILS ===');
  process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
