/* v1.8 W2 分层素材游戏内截图验证: node tools/regress/shot_v18.js <tag>
   三机体 × {对齐, 炮塔90°分离, 对角分离} 姿态 + V18 加载状态断言
   输出: output/visual/<tag>/v18-<hull>-<pose>.png + v18-results.json */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('/Users/rancequan/.hermes/hermes-agent/node_modules/playwright-core');

const CHROME = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const GAME = path.join(__dirname, '..', '..', 'index.html');

(async () => {
  const tag = process.argv[2] || 'v18';
  const outDir = path.join(__dirname, '..', '..', 'output', 'visual', tag);
  fs.mkdirSync(outDir, { recursive: true });
  const results = [];
  const ok = (c, m) => { results.push({ pass: !!c, msg: m }); console.log((c ? 'PASS' : 'FAIL') + '  ' + m); };
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(pathToFileURL(GAME).href);
  await page.waitForTimeout(1200);

  const v18 = await page.evaluate(() => (window.G && G.v18) ? G.v18.info() : null);
  ok(!!v18 && v18.imgs === 6, 'V18 6 atlas 全部解码 (' + JSON.stringify(v18) + ')');

  /* 直达 L1: skipTo 进 intro → 等倒计时结束到 play */
  await page.evaluate(() => G.skipTo(0));
  await page.waitForFunction(() => ST.state === 'play', null, { timeout: 9000 });
  ok(true, '进入 play 态');

  const POSES = [['aligned', 0, 0], ['t90', 0, -Math.PI / 2], ['diag', Math.PI * 0.75, -Math.PI / 4]];
  for (const hull of ['assault', 'balanced', 'heavy']) {
    await page.evaluate(h => { RUN.hull = h; }, hull);
    for (const [pose, bodyA, ta] of POSES) {
      await page.evaluate(([b, t]) => {
        ST.spawnT = 1e9;                       /* 冻结刷怪, 画面干净 */
        if (ST.enemies) ST.enemies.length = 0;
        player.bodyA = b; player.ta = t; player.vx = 0; player.vy = 0;
        player.inv = 0; player.flash = 0; player.shieldT = 0; player.shieldGrace = 0;   /* 出生无敌闪烁会随机隐藏玩家 */
        /* 不传送: 随机地形下地图中心可能是水/岩石 (r3 教训: 淹死回出生点), 玩家留在出生安全点 */
      }, [bodyA, ta]);
      await page.waitForTimeout(320);          /* 瞄准指示淡出+插值稳定 */
      await page.screenshot({ path: `${outDir}/v18-${hull}-${pose}.png` });
    }
  }
  ok(errors.length === 0, '零页面错误' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  fs.writeFileSync(outDir + '/v18-results.json', JSON.stringify(results, null, 2));
  await browser.close();
  const fails = results.filter(r => !r.pass).length;
  console.log(`shot_v18: ${results.length - fails}/${results.length} pass`);
  process.exit(fails ? 1 : 0);
})();
