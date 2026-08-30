/* P3.5 资产管线验收: 无头 Chrome 实测
   用法: node art-pipeline/scripts/verify_ap.js */
const pw = require('/Users/rancequan/.hermes/hermes-agent/node_modules/playwright-core');
const fs = require('fs');
const EXE = '/Users/rancequan/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const BASE = 'file:///Volumes/vol1/像素小游戏/';
const OUTDIR = '/Volumes/vol1/像素小游戏/artifacts/visual';
fs.mkdirSync(OUTDIR, { recursive: true });
const results = []; const R = (name, pass, detail) => { results.push({ name, pass, detail }); console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name + ' | ' + detail); };

(async () => {
  const browser = await pw.chromium.launch({ executablePath: EXE, headless: true,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror:' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console:' + m.text()); });
  const shot = async name => { const el = await page.$('#game'); await el.screenshot({ path: OUTDIR + '/' + name }); };

  /* ---------- 1. 资产管线场景 ---------- */
  await page.goto(BASE + 'index.dev.html?scene=asset-pipeline&seed=42');
  await page.waitForFunction(() => window.G && G.ap && G.ap.info().ok, null, { timeout: 15000 });
  await page.waitForFunction(() => ST.state === 'play', null, { timeout: 10000 });
  await page.waitForTimeout(420);   // 首次脚本爆炸在1.1s, 先拍静态帧
  const apInfo = await page.evaluate(() => G.ap.info());
  R('assets-ready', apInfo.ok && apInfo.active && apInfo.props > 0, JSON.stringify(apInfo));
  R('tank-dims', apInfo.draw >= 40 && Array.isArray(apInfo.anchor), 'draw=' + apInfo.draw + ' anchor=' + JSON.stringify(apInfo.anchor));
  await shot('asset-pipeline.png');

  /* ---------- 2. 法线光照像素检验: 左侧爆炸 → 左亮右暗 → 熄灭后恢复 ---------- */
  const sample = () => page.evaluate(() => {
    const S = 36;
    const d = buf.getContext('2d').getImageData(player.x - S, player.y - S, S * 2, S * 2).data;
    let L = 0, Rc = 0, Ln = 0, Rn = 0;
    for (let y = 0; y < S*2; y++) for (let x = 0; x < S*2; x++) {
      const i = (y * S*2 + x) * 4;
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (x < S-2) { L += lum; Ln++; } else if (x >= S+2) { Rc += lum; Rn++; }
    }
    return { dl: L / Ln, dr: Rc / Rn, delta: L / Ln - Rc / Rn };
  });
  await page.evaluate(() => { AP.nextBoom = 99; });   // 暂停周期性脚本爆炸, 避免污染采样
  const before = await sample();
  await page.evaluate(() => { G.ap.boom(-92, 46); });
  /* 帧时序有抖动: 窗口内多次采样取光照峰值 (灯光ttl≈0.55s) */
  let during = await sample();
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(40);
    const s = await sample();
    if (s.dl - s.dr > during.dl - during.dr) during = s;
    if (i === 2) await shot('new-asset-render.png');   // 爆炸中的新管线画面
  }
  await page.waitForTimeout(1300);              // 灯光ttl≈0.55s
  const after = await sample();
  /* 点光源效果 = 左侧亮度增量 显著大于 右侧亮度增量 (扣除整体波动) */
  const lGain = during.dl - before.dl, rGain = during.dr - before.dr;
  R('normal-light-left', lGain > rGain + 8,
    `左+${lGain.toFixed(1)} vs 右+${rGain.toFixed(1)} (爆炸后亮度增量)`);
  R('light-restores', Math.abs(after.dl - before.dl) < 8 && Math.abs(after.delta - before.delta) < 8,
    `after delta=${after.delta.toFixed(1)} vs before=${before.delta.toFixed(1)}`);
  const lightInfo = await page.evaluate(() => G.ap.info());
  R('pointlight-count', lightInfo.litMs > 0, 'litMs=' + lightInfo.litMs + 'ms(逐像素光照在跑)');

  /* ---------- 3. hull/turret 独立 ---------- */
  const fr = await page.evaluate(() => { G.ap.setTurret(player.a + 1.6); return G.ap.info(); });
  await page.waitForTimeout(120);
  const fr2 = await page.evaluate(() => G.ap.info());
  R('turret-independent', fr2.frameT !== fr2.frameH, `hull=${fr2.frameH} turret=${fr2.frameT}`);

  /* ---------- 4. 移动不回退 ---------- */
  const y0 = await page.evaluate(() => player.y);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(600); await page.keyboard.up('KeyW');
  const y1 = await page.evaluate(() => player.y);
  R('moves', Math.abs(y1 - y0) > 8, `dy=${(y1 - y0).toFixed(1)}`);

  /* ---------- 5. FPS ---------- */
  await page.waitForTimeout(2600);
  const perf = await page.evaluate(() => G.perf());
  R('fps60', perf.fps >= 50, 'fps=' + perf.fps + ' renderMs=' + perf.renderMs + ' q=' + PERF_QUALITY(perf));

  /* ---------- 6. 旧渲染器对照(current-render) ---------- */
  await page.goto(BASE + 'index.dev.html?scene=combat');
  await page.waitForFunction(() => ST.state === 'play', null, { timeout: 10000 });
  await page.waitForTimeout(600);
  await shot('current-render.png');
  R('old-renderer-intact', errors.length === 0, 'consoleErrors=' + errors.length);

  /* ---------- 7. 常规流程回归(不动玩法) ---------- */
  await page.goto(BASE + 'index.dev.html');
  await page.waitForFunction(() => ST.state === 'title', null, { timeout: 10000 });
  await page.evaluate(() => G.start());
  await page.waitForFunction(() => ST.state === 'intro', null, { timeout: 5000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => ST.state === 'play', null, { timeout: 5000 });
  await page.evaluate(() => G.dummy('tank', 300, 120));
  await page.keyboard.down('KeyJ'); await page.waitForTimeout(700); await page.keyboard.up('KeyJ');
  const info = await page.evaluate(() => G.info());
  R('gameplay-regression', info.state === 'play' && info.shotsFired > 0 && info.enemies >= 1,
    `state=${info.state} shots=${info.shotsFired} enemies=${info.enemies}`);
  R('no-console-errors', errors.length === 0, errors.slice(0, 3).join(' ; ') || 'clean');

  /* ---------- 8. 单文件构建版可跑 ---------- */
  const errs2 = [];
  const p2 = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  p2.on('pageerror', e => errs2.push(e.message));
  await p2.goto(BASE + 'index.html');
  await p2.waitForFunction(() => typeof ST !== 'undefined' && ST.state === 'title', null, { timeout: 20000 });
  R('dist-boots', errs2.length === 0, 'errors=' + errs2.length);

  await browser.close();
  const np = results.filter(r => r.pass).length;
  console.log(`\nSUMMARY: ${np}/${results.length} PASS`);
  fs.writeFileSync(OUTDIR + '/verify_results.json', JSON.stringify(results, null, 1));
  process.exit(np === results.length ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
function PERF_QUALITY(p) { return p.quality + p.qLevel; }
