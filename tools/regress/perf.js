/* PHASE 2 性能验证: 60Hz逻辑完整性 / 帧耗时 / 插值 / 池化 / dev加载器 */
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
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file:///Volumes/vol1/像素小游戏/index.html'); await sleep(1000);

  // dev 加载器 (file:// 经典 script 多文件)
  const dpage = await browser.newPage({viewport: {width: 960, height: 540}});
  const derr = [];
  dpage.on('pageerror', e => derr.push(e.message));
  await dpage.goto('file:///Volumes/vol1/像素小游戏/index.dev.html'); await sleep(1200);
  ok((await dpage.evaluate(() => ST.state)) === 'title' && derr.length === 0, 'dev加载器可用 (错误:' + (derr[0] || '无') + ')');
  await dpage.close();

  // 性能场景: 开局+无敌+持续战斗45秒
  await page.keyboard.press('Enter'); await sleep(2600);
  await page.evaluate(() => { G.dbg.god = true; });
  await page.keyboard.down('KeyJ');
  const t0 = Date.now(); const u0 = (await page.evaluate(() => G.perf())).updates; const samples = [];
  while (Date.now() - t0 < 45000) {
    await page.keyboard.down('KeyK'); await sleep(300); await page.keyboard.up('KeyK');
    await sleep(700);
    samples.push(await page.evaluate(() => G.perf()));
  }
  await page.keyboard.up('KeyJ');
  const wallSec = (Date.now() - t0) / 1000;
  const last = samples[samples.length - 1];
  const avg = k => samples.reduce((a, b) => a + b[k], 0) / samples.length;
  const logicRate = (last.updates - u0) / wallSec;
  ok(logicRate > 57 && logicRate < 63, '逻辑固定60Hz完整性 (' + logicRate.toFixed(1) + 'Hz/45s, updates=' + last.updates + ')');
  ok(avg('fps') >= 50, '平均FPS ' + avg('fps').toFixed(1));
  ok(avg('updateMs') < 8, '平均逻辑耗时 ' + avg('updateMs').toFixed(2) + 'ms < 8ms');
  ok(avg('renderMs') < 12, '平均渲染耗时 ' + avg('renderMs').toFixed(2) + 'ms < 12ms');
  ok(last.counts.parts <= 420 && last.counts.shots < 60, '池上限受控 (P=' + last.counts.parts + ' S=' + last.counts.shots + ' E=' + last.counts.enemies + ')');

  // 插值生效: 战斗中敌人有插值快照
  const interp = await page.evaluate(() => enemies.filter(e => e.ox !== undefined).length + '/' + enemies.length);
  ok(interp.split('/')[0] === interp.split('/')[1] && interp !== '0/0', '敌军插值快照 ' + interp);

  // F3 面板
  await page.keyboard.press('F3'); await sleep(300);
  ok(await page.evaluate(() => PERF.show === true), 'F3性能面板开关');
  await page.screenshot({path: '/tmp/tankshots6/18-perf-overlay.png'});
  await page.keyboard.press('F3');

  // 画质档 AUTO 生效范围
  ok(last.qLevel >= 0 && last.qLevel <= 2 && last.quality === 'AUTO', 'AUTO画质档 (' + last.qLevel + ')');

  log('ERRORS:', errors.length ? errors.slice(0, 3) : 'none');
  await browser.close();
  log(fails === 0 && errors.length === 0 ? '=== PERF PASS ===' : '=== ' + fails + ' FAILS ===');
  process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
