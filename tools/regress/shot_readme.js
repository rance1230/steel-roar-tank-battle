/* README 截图重拍 (v1.8.1 UI): node tools/regress/shot_readme.js
   全部 1280x720 jpg (手机张 640x360) 直出 docs/img/。逐场景 try/catch, 结尾校验清单。 */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('/Users/rancequan/.hermes/hermes-agent/node_modules/playwright-core');

const CHROME_CANDIDATES = [
  process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac/chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
];
const exe = CHROME_CANDIDATES.find(p => fs.existsSync(p));
if (!exe) { console.error('no chromium found'); process.exit(1); }
const GAME = path.join(__dirname, '..', '..', 'index.html');
const IMG = path.join(__dirname, '..', '..', 'docs', 'img');

(async () => {
  fs.mkdirSync(IMG, { recursive: true });
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const shots = [];
  async function snap(page, name, qw, qh) {
    await page.screenshot({ type: 'jpeg', quality: 85, path: path.join(IMG, name) });
    shots.push(name);
    console.log('shot', name);
  }
  const waitPlay = (page) => page.waitForFunction(() => ST.state === 'play', null, { timeout: 9000 }).catch(() => console.log('WARN play timeout'));
  const waitImg = (page, key) => page.waitForFunction(k => window.G.v18ui.info().loaded.includes(k), key, { timeout: 5000 }).catch(() => console.log('WARN img ' + key));

  /* ---------- 桌面键盘 1280x720 ---------- */
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto(pathToFileURL(GAME).href);
  await page.waitForTimeout(700);

  // 1. 标题 (新大图)
  await page.evaluate(() => window.G.visualScene('title'));
  await waitImg(page, 'title');
  await page.waitForTimeout(1300);
  await snap(page, 'title.jpg');

  // 2. 选机体 (九宫格面板+实车预览)
  await page.evaluate(() => { toTitle(); window.G.start(); });
  await page.waitForTimeout(800);
  await snap(page, 'hull-select.jpg');

  // 3. 选僚机
  await page.evaluate(() => menuActivate());
  await page.waitForTimeout(600);
  await snap(page, 'wingman-select.jpg');

  // 4. 雪原战斗 (键盘图标芯片 HUD)
  await page.evaluate(() => window.G.visualScene('combat'));
  await page.waitForTimeout(700);
  await snap(page, 'battle-snow.jpg');

  // 5. 重装等离子护罩
  await page.evaluate(() => { window.G.hull('heavy'); window.G.visualScene('shield'); });
  await page.waitForTimeout(600);
  await snap(page, 'shield-orb.jpg');

  // 6. BOSS 与护卫队
  await page.evaluate(() => window.G.visualScene('boss'));
  await page.waitForTimeout(700);
  await snap(page, 'boss-escort.jpg');

  // 7. 战地整备 (新布局: 背景大图+维修台坦克+右侧面板)
  await page.evaluate(() => {
    MENU = null; RUN.pts = 8; RUN.up.hp = 5; RUN.up.spd = 2; RUN.up.atk = 12; RUN.up.def = 3; RUN.up.cdr = 7;
    ST.state = 'upgrade'; ST.upg = { sel: 1, from: 'clear' };
  });
  await waitImg(page, 'dep');
  await page.waitForTimeout(800);
  await snap(page, 'upgrade.jpg');

  // 8. 帮助页 (护盾页, 九宫格面板)
  await page.evaluate(() => { toTitle(); openMenu('help'); MENU.page = 6; });
  await page.waitForTimeout(600);
  await snap(page, 'help.jpg');

  // 9. 多锁导弹 (主锁定框+叠弹节点+×N)
  await page.evaluate(() => {
    window.G.visualScene('free');
    const d1 = window.G.dummy('tank', player.x - 70, player.y - 20); d1.stun = 99; d1.hp = d1.maxHp = 3000;
    const d2 = window.G.dummy('truck', player.x + 78, player.y + 26); d2.stun = 99; d2.hp = d2.maxHp = 3000;
    player.mslCd = 0;
  });
  await page.waitForTimeout(200);
  await page.keyboard.down('KeyL');
  await page.waitForTimeout(950);
  await snap(page, 'v18-multilock.jpg');
  await page.keyboard.up('KeyL');

  // 10. 护盾弹反粒子漩涡
  await page.evaluate(() => { window.G.visualScene('free'); player.shieldT = 2; window.G.parryProbe(true); });
  await page.waitForTimeout(500);
  await snap(page, 'v18-swirl.jpg');

  // 11. 冰面漂移 (彗尾+喷雪) — 沿冰河带行驶
  await page.evaluate(() => {
    window.G.skipTo(4);
  });
  await waitPlay(page);
  await page.evaluate(() => {
    window.G.visualScene('free');
    const bandY = tx => { for (let ty = 1; ty < MAPH - 1; ty++) if (terr.m[ty * MAPW + tx] === 3) return ty; return -1; };
    let bx = -1, bs = 1e9;
    for (let tx = 3; tx < MAPW - 9; tx++) {
      const ys = []; for (let k = 0; k < 7; k++) ys.push(bandY(tx + k));
      if (ys.some(y => y < 0)) continue;
      const spread = Math.max(...ys) - Math.min(...ys);
      if (spread < bs) { bs = spread; bx = tx; }
    }
    if (bx >= 0) { const ty = bandY(bx + 3); window.G.tp((bx + 1) * TS, ty * TS + TS / 2); player.bodyA = player.ta = 0; }
    window.__follow = setInterval(() => { const ty = bandY(Math.floor(player.x / TS)); if (ty > 0) player.y += ((ty * TS + TS / 2) - player.y) * 0.2; }, 30);
  });
  await page.keyboard.down('KeyD');
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(1500);
  await snap(page, 'v18-drift.jpg');
  await page.keyboard.up('KeyD');
  await page.keyboard.up('ShiftLeft');
  await page.evaluate(() => clearInterval(window.__follow));

  /* ---------- 触屏 1280x720 ---------- */
  const tp = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: true, isMobile: true });
  tp.on('pageerror', e => console.log('PAGEERROR(touch):', e.message));
  await tp.goto(pathToFileURL(GAME).href);
  await tp.waitForTimeout(700);
  await tp.evaluate(() => { G.set('touch', 'on'); window.G.skipTo(0); });
  await waitPlay(tp);

  // 12. 沙漠触屏战斗 (图标按钮+双摇杆)
  await tp.evaluate(() => {
    window.G.visualScene('free');
    const d1 = window.G.dummy('tank', player.x - 70, player.y - 40); d1.stun = 99; d1.hp = d1.maxHp = 900;
    const d2 = window.G.dummy('truck', player.x + 84, player.y + 20); d2.stun = 99; d2.hp = d2.maxHp = 700;
    window.G.dropTest('part'); window.G.dropTest('heal');
    COMBO.n = 27; COMBO.tier = 2; COMBO.t = 5;
  });
  await tp.waitForTimeout(600);
  await snap(tp, 'battle-desert.jpg');

  // 13. 双摇杆战斗 (工业废墟)
  await tp.evaluate(() => { window.G.visualScene('combat'); });
  await tp.waitForTimeout(700);
  await snap(tp, 'v18-dualstick.jpg');

  // 14. 帮助页触屏按钮
  await tp.evaluate(() => { toTitle(); openMenu('help'); MENU.page = 6; });
  await tp.touchscreen.tap(60, 360);           // 触发 inMode=touch (左翻页区)
  await tp.evaluate(() => { MENU.page = 6; });
  await tp.waitForTimeout(500);
  await snap(tp, 'v18-help-touch.jpg');

  /* ---------- 手机 640x360 ---------- */
  const ph = await browser.newPage({ viewport: { width: 640, height: 360 }, hasTouch: true, isMobile: true });
  ph.on('pageerror', e => console.log('PAGEERROR(phone):', e.message));
  await ph.goto(pathToFileURL(GAME).href);
  await ph.waitForTimeout(700);
  await ph.evaluate(() => { G.set('touch', 'on'); window.G.skipTo(0); });
  await waitPlay(ph);
  // 15. 手机触屏: 按钮即 HUD (图标+充能环+×N)
  await ph.evaluate(() => { window.G.visualScene('hud'); player.mslCd = 0; });
  await ph.waitForTimeout(500);
  await ph.keyboard.down('KeyL');
  await ph.waitForTimeout(900);
  await snap(ph, 'phone-battle.jpg');
  await ph.keyboard.up('KeyL');

  await browser.close();
  const expect = ['title.jpg', 'hull-select.jpg', 'wingman-select.jpg', 'battle-snow.jpg', 'shield-orb.jpg',
    'boss-escort.jpg', 'upgrade.jpg', 'help.jpg', 'v18-multilock.jpg', 'v18-swirl.jpg', 'v18-drift.jpg',
    'battle-desert.jpg', 'v18-dualstick.jpg', 'v18-help-touch.jpg', 'phone-battle.jpg'];
  const missing = expect.filter(f => !shots.includes(f));
  console.log('=== README SHOTS ' + shots.length + '/' + expect.length + (missing.length ? ' MISSING: ' + missing.join(',') : ' ALL OK ==='));
  process.exit(missing.length ? 1 : 0);
})();
