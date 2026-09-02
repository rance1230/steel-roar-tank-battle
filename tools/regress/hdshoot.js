const pw = require('/Users/rancequan/.hermes/hermes-agent/node_modules/playwright-core');
const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw.chromium.launch({executablePath: EXE, headless: true});
  const page = await browser.newPage({viewport: {width: 960, height: 540}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file:///Volumes/vol1/像素小游戏/index.html'); await sleep(1200);
  const S = '/tmp/tankshots6/';
  const wait = () => sleep(250);
  for (let i = 0; i < 8; i++) { if (await page.evaluate('(ST.t%1.2)<0.86')) break; await sleep(120); }
  await page.screenshot({path: S + '01-title.png'});
  // option 三语
  await page.evaluate(() => { MENU.sel = 1; }); await page.keyboard.press('Enter'); await wait();
  await page.screenshot({path: S + '02-option-zh.png'});
  await page.evaluate(() => { SET.lang = 'en'; saveSet(); }); await wait();
  await page.screenshot({path: S + '03-option-en.png'});
  await page.evaluate(() => { SET.lang = 'ja'; saveSet(); }); await wait();
  await page.screenshot({path: S + '04-option-ja.png'});
  await page.evaluate(() => { SET.lang = 'zh'; saveSet(); });
  // padmap
  await page.evaluate(() => { const its = menuItems('option'); MENU.sel = its.findIndex(i => i.label === 'padmap'); });
  await page.keyboard.press('Enter'); await wait();
  await page.screenshot({path: S + '05-padmap.png'});
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await wait();
  // help
  await page.evaluate(() => { openMenu('help', 'title'); }); await sleep(400);
  await page.screenshot({path: S + '06-help-p1.png'});
  await page.evaluate(() => { MENU.page = 3; }); await wait(); await page.screenshot({path: S + '07-help-p4.png'});
  await page.evaluate(() => { MENU.page = 10; }); await wait(); await page.screenshot({path: S + '08-help-p11.png'});
  await page.keyboard.press('Escape'); await wait();
  // 游戏进行中 (HUD/飘字/敌军)
  await page.evaluate(() => G.start()); await sleep(2700);
  await page.keyboard.down('KeyJ');
  await page.evaluate(() => { G.dbg.god = true; });
  await sleep(3500);
  await page.keyboard.up('KeyJ');
  await page.screenshot({path: S + '09-play-hud.png'});
  // 暂停
  await page.keyboard.press('KeyP'); await sleep(300);
  await page.screenshot({path: S + '10-pause.png'});
  await page.keyboard.press('Escape'); await wait();
  // BOSS血条
  await page.evaluate(() => G.boss()); await sleep(3000);
  await page.evaluate(() => { const b = enemies.find(e => e.b); if (b) G.tp(b.x - 100, b.y); });
  await sleep(800);
  await page.screenshot({path: S + '11-boss.png'});
  // 过关→整备
  await page.evaluate(() => { enemies.forEach(e => hurtEnemy(e, 1e6, 'ram')); }); await sleep(1200);
  await page.screenshot({path: S + '12-clear.png'});
  await page.keyboard.press('Enter'); await sleep(500);
  await page.screenshot({path: S + '13-upgrade.png'});
  // 失败
  await page.evaluate(() => G.hurt()); await sleep(900);
  await page.screenshot({path: S + '14-gameover.png'});
  await page.keyboard.press('KeyR'); await sleep(2700);
  // 通关
  await page.evaluate(() => G.skipTo(6)); await sleep(2700);
  await page.evaluate(() => G.win()); await sleep(700);
  await page.keyboard.press('Enter'); await sleep(1500);
  await page.screenshot({path: S + '15-victory.png'});
  await sleep(4000);
  await page.screenshot({path: S + '16-credits.png'});
  console.log('desktop errors:', errors.length ? errors : 'none');
  await page.close();
  // 触屏
  const ctx2 = await browser.newContext({viewport: {width: 700, height: 360}, hasTouch: true, isMobile: true});
  const tp = await ctx2.newPage();
  tp.on('pageerror', e => errors.push('T:' + e.message));
  await tp.goto('file:///Volumes/vol1/像素小游戏/index.html'); await sleep(1200);
  await tp.evaluate(() => G.start()); await sleep(2800);
  await tp.screenshot({path: S + '17-touch-play.png'});
  console.log('all errors:', errors.length ? errors : 'none');
  await browser.close(); console.log('DONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
