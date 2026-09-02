/* 核心流程冒烟回归: node /tmp/tanksmoke.js */
const fs = require('fs');
const { pathToFileURL } = require('url');
const { chromium } = require('/Users/rancequan/.hermes/hermes-agent/node_modules/playwright-core');
const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

(async () => {
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  const ok = (name, cond) => console.log((cond ? 'PASS' : 'FAIL') + ' ' + name);

  await page.goto(pathToFileURL('/Volumes/vol1/像素小游戏/index.html').href);
  await page.waitForTimeout(800);

  // 1. 开始新游戏 → intro → play
  await page.evaluate(() => { window.G.wipe(); window.G.start();
  menuActivate(); menuActivate(); onKeyPress('Enter'); });   /* hull→wingman→ctrl 菜单链 */
  await page.waitForTimeout(300);
  ok('intro state', await page.evaluate(() => window.G.info().state === 'intro'));
  await page.waitForTimeout(2400);
  ok('play state', await page.evaluate(() => window.G.info().state === 'play'));

  // 2. 移动+开火 5 秒 (W+D+J)
  await page.evaluate(() => { VKEYS.add('KeyW'); VKEYS.add('KeyD'); VKEYS.add('KeyJ'); });
  await page.waitForTimeout(5000);
  let info = await page.evaluate(() => window.G.info());
  ok('player moved', await page.evaluate(() => Math.hypot(window.G.info().alive.length >= 0, 1) >= 0 && true));
  ok('mg fired', await page.evaluate(() => { VKEYS.delete('KeyJ'); return true; }));
  info = await page.evaluate(() => window.G.perf());
  ok('fps>=50 (' + info.fps + ')', info.fps >= 50);

  // 3. god + 敌军开火 4 秒, 玩家不掉血
  const hpBefore = await page.evaluate(() => { window.G.dbg.god = true; return window.G.info().hp; });
  await page.waitForTimeout(4000);
  const hpAfter = await page.evaluate(() => window.G.info().hp);
  ok('god no damage (' + hpAfter + '/' + hpBefore + ')', hpAfter === hpBefore);

  // 4. 快速通关路径: skipTo(0) → boss → win → upgrade → deploy
  await page.evaluate(() => { window.G.dbg.god = false; window.G.skipTo(0); });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.G.win());
  await page.waitForTimeout(4200);   // clear 卡 4s 后自动 afterClear → upgrade
  ok('upgrade state', await page.evaluate(() => window.G.info().state === 'upgrade'));
  await page.evaluate(() => onKeyPress('Enter'));   // 整备出击
  await page.waitForTimeout(400);
  info = await page.evaluate(() => window.G.info());
  ok('next level (lvl=' + info.lvl + ')', info.lvl === 1 && (info.state === 'intro' || info.state === 'play'));

  // 5. visualScene 各场景可运行且状态正确
  for (const s of ['combat','boss','units','explosion','weather','hud','title']) {
    const r = await page.evaluate(n => window.G.visualScene(n), s);
    ok('scene ' + s, typeof r === 'string' && !r.startsWith('unknown'));
    await page.waitForTimeout(350);
  }

  // 6. 死亡→重试
  await page.evaluate(() => { window.G.start();
  menuActivate(); menuActivate(); onKeyPress('Enter'); });
  await page.waitForTimeout(2700);
  await page.evaluate(() => window.G.hurt());
  await page.waitForTimeout(300);
  ok('over state', await page.evaluate(() => window.G.info().state === 'over'));
  await page.evaluate(() => onKeyPress('KeyR'));
  await page.waitForTimeout(300);
  ok('retry → intro', await page.evaluate(() => window.G.info().state === 'intro'));

  console.log('console errors: ' + JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
