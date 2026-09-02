/* vNext PHASE1/2 专项: 360°移动模型 + 连击规则 */
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
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file:///Volumes/vol1/像素小游戏/index.html'); await sleep(1000);
  /* v1.3+ 新游戏菜单链: 标题→hull→wingman→ctrl→intro→play (对齐 tanksmoke) */
  await page.evaluate(() => { window.G.start(); menuActivate(); menuActivate(); onKeyPress('Enter'); });
  await sleep(3200);
  await page.evaluate(() => { G.dbg.god = true; G.tp(480, 200); });
  await sleep(400);

  // --- 1) 模拟摇杆任意角度移动 (360°) ---
  await page.evaluate(() => {
    window.__fp = {index: 0, id: 'Pad', connected: true, axes: [0, 0],
      buttons: Array.from({length: 16}, () => ({pressed: false, value: 0})), mapping: 'standard'};
    navigator.getGamepads = () => [window.__fp];
    window.__fp.axes = [0.71, 0.42]; // 非八方向的任意角度
  });
  await sleep(1000);
  const m1 = await page.evaluate(() => {
    const sp = Math.hypot(player.vx, player.vy);
    return {va: Math.atan2(player.vy, player.vx), ba: player.bodyA, sp, max: player.speed, px: player.x, py: player.y};
  });
  const want = Math.atan2(0.42, 0.71);
  ok(Math.abs(m1.va - want) < 0.15, '速度向量=摇杆任意角度 (' + (m1.va * 57.3).toFixed(1) + '° vs ' + (want * 57.3).toFixed(1) + '°)');
  ok(Math.abs(m1.ba - want) < 0.2, '车体朝向平滑跟随 (' + (((m1.ba - want) * 57.3).toFixed(1)) + '°偏差)');
  ok(Math.abs(m1.sp - m1.max * 0.825) < m1.max * 0.12, '模拟轴按偏转比例变速 (' + m1.sp.toFixed(0) + ' ≈ ' + (m1.max*0.825).toFixed(0) + ')');
  await page.evaluate(() => { window.__fp.axes = [0, 0]; });

  // --- 2) 加速/摩擦曲线 ---
  await page.evaluate(() => { G.tp(200, 480); player.vx = 0; player.vy = 0; });
  await page.keyboard.down('KeyW');
  await sleep(60); // ~4逻辑帧 (v1.8基线: 0.16s 加速曲线, 100ms 采样已达 81% 无法区分)
  const s01 = await page.evaluate(() => Math.hypot(player.vx, player.vy));
  await sleep(500);
  const s06 = await page.evaluate(() => Math.hypot(player.vx, player.vy));
  await page.keyboard.up('KeyW');
  await sleep(300);
  const s0 = await page.evaluate(() => Math.hypot(player.vx, player.vy));
  ok(s01 < s06 * 0.75, '起步有加速过程 (' + s01.toFixed(0) + ' → ' + s06.toFixed(0) + ')');
  /* v1.8 W3 SUPERSEDED: 旧=松手<15px/s急停; 新契约§2=惯性制动(满速松0.3s仍>30%, 1.2s内停) */
  ok(s0 > s06 * 0.3, '松手0.3s惯性滑行>30% (SUPERSEDED急停) (' + (s0 / s06 * 100).toFixed(0) + '%)');
  await sleep(900);
  const s0b = await page.evaluate(() => Math.hypot(player.vx, player.vy));
  ok(s0b < 15, '松手1.2s内刹停 (' + s0b.toFixed(1) + ')');

  // --- 3) 键盘对角线 45° ---
  await page.evaluate(() => { G.tp(300, 300); player.vx = 0; player.vy = 0; });
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD');
  await sleep(700);
  const diag = await page.evaluate(() => Math.atan2(player.vy, player.vx) * 57.3);
  await page.keyboard.up('KeyW'); await page.keyboard.up('KeyD');
  ok(Math.abs(diag - (-45)) < 8, '键盘对角线45° (' + diag.toFixed(1) + '°)');

  // --- 4) 反弹生效(命中后+2连击) ---
  await page.evaluate(() => { enemies.length = 0; const t = G.dummy('truck', player.x + 80, player.y); t.stun = 99; G.reflectProbe(); });
  await sleep(600);
  let info = await page.evaluate(() => G.info());
  ok(info.combo >= 2, '反弹命中计入连击 (combo=' + info.combo + ')');
  // tier 升级触发
  await page.evaluate(() => { COMBO.n = 9; COMBO.tier = 0; COMBO.t = 5; });
  await page.evaluate(() => addCombo(1));
  info = await page.evaluate(() => G.info());
  ok(info.comboTier === 1 && info.combo >= 10, '10连阶段升级 (tier=' + info.comboTier + ')');
  // 掉落倍率分段
  const muls = await page.evaluate(() => [0, 10, 20, 30, 40].map(n => { COMBO.n = n; return comboMul(); }));
  ok(muls[0] === 1 && Math.abs(muls[1] - 1.1) < 1e-9 && Math.abs(muls[2] - 1.2) < 1e-9 &&
     Math.abs(muls[3] - 1.35) < 1e-9 && Math.abs(muls[4] - 1.5) < 1e-9, '掉落倍率分段 ' + JSON.stringify(muls));
  // 5秒归零 (冻结刷怪: 否则僚机自动射击命中会刷新连击; 勿动 bossSpawned/spawnedN — 敌清空+bossSpawned 会触发 levelClear 冻结后续测试)
  await page.evaluate(() => { shots.length = 0; enemies.length = 0; pickups.length = 0; planes.length = 0; bombs.length = 0;
    ST.spawnT = 1e9; COMBO.n = 15; COMBO.t = 5; });
  await sleep(5800);
  info = await page.evaluate(() => G.info());
  ok(info.combo === 0, '5秒未命中连击归零 (' + info.combo + ')');
  // Overdrive 60+
  await page.evaluate(() => { COMBO.n = 60; COMBO.t = 5; });
  await sleep(150);
  info = await page.evaluate(() => G.info());
  ok(info.od === true, '60+进入Overdrive');
  await page.evaluate(() => { COMBO.n = 0; COMBO.t = 1e9; }); // 基线(无OD)
  const maxFireM = () => page.evaluate(() => new Promise(res => {   /* 采样保持期内的满间隔值 */
    let mx = 0, n = 0; const iv = setInterval(() => { mx = Math.max(mx, player.fireM); if (++n >= 12) { clearInterval(iv); res(mx); } }, 16); }));
  await page.keyboard.down('KeyJ');
  const fmBase = await maxFireM();
  await page.keyboard.up('KeyJ');
  await page.evaluate(() => { COMBO.n = 60; }); // OD (od 每帧由 n>=60 派生)
  await sleep(150);
  await page.keyboard.down('KeyJ');
  const fmOd = await maxFireM();
  await page.keyboard.up('KeyJ');
  ok(fmBase > 0.07 && fmOd < fmBase * 0.92, 'Overdrive机枪间隔缩短 (基线 ' + fmBase.toFixed(4) + 's vs OD ' + fmOd.toFixed(4) + 's = ×' + (fmOd / fmBase).toFixed(3) + '; 60Hz帧量化下射速不可观测, 改测间隔比值)');
  // 击破事件: 冲撞BOSS +4
  await page.evaluate(() => { COMBO.n = 0; COMBO.tier = 0; });
  await page.evaluate(() => { G.boss(); }); await sleep(2800);
  await page.evaluate(() => { enemies.forEach(e => hurtEnemy(e, 1e6, 'ram')); });
  await sleep(400);
  info = await page.evaluate(() => G.info());
  ok(info.combo >= 4, '冲撞击破计入连击 (+' + info.combo + ')');
  // 连击HUD可见(截图)
  await page.evaluate(() => { COMBO.n = 27; COMBO.tier = 2; COMBO.t = 4; });
  await sleep(300);
  await page.screenshot({path: '/tmp/tankshots8/combo-hud.png'});
  log('ERRORS:', errors.length ? errors.slice(0, 3) : 'none');
  await browser.close();
  log(fails === 0 && errors.length === 0 ? '=== VNEXT PASS ===' : '=== ' + fails + ' FAILS ===');
  process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
