/* V1.8 UI 资产接入截图套件: node tools/regress/shot_v18ui.js [tag]
   - 桌面 960x540: 新标题(zh/ja/en)/选车/整备新布局/结算徽章卡/暂停九宫格/
     键盘 HUD 芯片图标态(就绪/冷却)/多锁节点+×N/Boss 弹幕混战
   - 手机 700x360 hasTouch: 标题/整备/战斗按钮即 HUD(图标+环+×N)
   - 图标 24px/16px 可读性拼图 (V18UIR.icon 页内绘制)
   输出: output/visual/<tag>/*.png + v18ui-results.json (断言: 资产解码/皮肤/零错误) */
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

const results = [];
function assert(cond, msg) {
  results.push({ pass: !!cond, msg });
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + msg);
}
function dataUrlToFile(u, file) {
  fs.writeFileSync(file, Buffer.from(u.split(',')[1], 'base64'));
}

(async () => {
  const tag = process.argv[2] || 'v18ui';
  const outDir = path.join(__dirname, '..', '..', 'output', 'visual', tag);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const errors = [];

  /* ---------- 桌面 960x540 ---------- */
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto(pathToFileURL(GAME).href);
  await page.waitForTimeout(600);

  const info = await page.evaluate(() => window.G.v18ui.info());
  assert(info.hasData, 'V18UI 数据模块加载 (' + info.loaded.join(',') + ')');
  assert(info.loaded.includes('ico') && info.loaded.includes('frame') && info.loaded.includes('badge'),
    '小纹理(frame/ico/badge)常驻解码');

  /* 1. 标题页: 等新大图解码完成再拍 */
  await page.evaluate(() => window.G.visualScene('title'));
  await page.waitForFunction(() => window.G.v18ui.info().loaded.includes('title'), null, { timeout: 5000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: outDir + '/title-zh.png' });
  for (const lang of ['ja', 'en']) {
    await page.evaluate(l => { G.set('lang', l); }, lang);
    await page.waitForTimeout(400);
    await page.screenshot({ path: outDir + '/title-' + lang + '.png' });
  }
  await page.evaluate(() => { G.set('lang', 'zh'); });
  /* 内存纪律: 离开标题页释放解码位图 */
  await page.evaluate(() => window.G.skipTo(0));
  await page.waitForFunction(() => { const i = window.G.v18ui.info(); return ST.state !== 'title' && !i.loaded.includes('title'); }, null, { timeout: 3000 })
    .then(() => assert(true, '离开标题页释放 title 解码 (离页释放)'))
    .catch(() => assert(false, '离开标题页释放 title 解码 (离页释放)'));

  /* 2. 选车 (标题菜单+机体预览): 先回标题态, 防 intro 卡文字透出 (R1 QA 教训) */
  await page.evaluate(() => { toTitle(); window.G.start(); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: outDir + '/hull-select.png' });

  /* 3. 整备页新布局: 等整备大图解码 (MENU 必须清掉, 否则选车菜单叠在整备页上) */
  await page.evaluate(() => {
    MENU = null; RUN.pts = 8; RUN.up.hp = 5; RUN.up.spd = 2; RUN.up.atk = 12; RUN.up.def = 3; RUN.up.cdr = 7;
    ST.state = 'upgrade'; ST.upg = { sel: 1, from: 'clear' };
  });
  await page.waitForFunction(() => window.G.v18ui.info().loaded.includes('dep'), null, { timeout: 5000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: outDir + '/upgrade.png' });
  assert(true, '整备页 dep 背景解码+新布局');

  /* 4. 结算卡 (徽章+实时坦克) */
  await page.evaluate(() => { ST.state = 'play'; MENU = null; window.G.win(); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: outDir + '/clear-card.png' });

  /* 5. 键盘/手柄 HUD 芯片 (图标态: od 金环/满蓄脉冲/就绪) */
  await page.evaluate(() => window.G.visualScene('hud'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: outDir + '/hud-kb-od.png' });

  /* 6. 冷却态: 空袭+护盾进入 CD */
  await page.evaluate(() => window.G.visualScene('combat'));
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyU');
  await page.keyboard.press('Space');
  await page.waitForTimeout(600);
  await page.screenshot({ path: outDir + '/hud-kb-cooldown.png' });

  /* 7. 多锁: 双目标叠锁 (节点圆点 + ×N + 主锁定框) */
  await page.evaluate(() => {
    window.G.visualScene('free');
    const d1 = window.G.dummy('tank', player.x - 70, player.y - 20); d1.stun = 99; d1.hp = d1.maxHp = 3000;
    const d2 = window.G.dummy('truck', player.x + 78, player.y + 26); d2.stun = 99; d2.hp = d2.maxHp = 3000;
    player.mslCd = 0;
  });
  await page.waitForTimeout(200);
  await page.keyboard.down('KeyL');
  await page.waitForTimeout(950);            /* charge≈0.95s → 满蓄前: 6 锁跨 2 目标 */
  await page.screenshot({ path: outDir + '/locks-multitarget.png' });
  await page.keyboard.up('KeyL');            /* 放弹 → mslCd */
  await page.waitForTimeout(250);
  await page.screenshot({ path: outDir + '/hud-kb-msl-cd.png' });

  /* 8. Boss + 弹幕混战: 清掉护卫 → 6 锁全部叠在 BOSS 上; 玩家面向 BOSS 齐射 (R1 QA 教训) */
  await page.evaluate(() => {
    window.G.visualScene('boss'); window.G.boss();
    const b = enemies.find(e => e.boss);
    if (b) { const a = Math.atan2(b.y - player.y, b.x - player.x); player.bodyA = player.ta = a; }
  });
  await page.waitForTimeout(400);
  await page.keyboard.down('KeyL');
  await page.waitForTimeout(1300);           /* 满蓄 6 锁 */
  await page.screenshot({ path: outDir + '/boss-locks.png' });
  await page.keyboard.up('KeyL');
  await page.waitForTimeout(320);            /* 齐射命中 BOSS 瞬间 (R3 QA: 再早 0.2s 才见 BOSS 本体) */
  await page.screenshot({ path: outDir + '/boss-volley.png' });

  /* 9. 暂停菜单 (九宫格面板) */
  await page.evaluate(() => { MENU = null; openMenu('pause'); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: outDir + '/pause-menu.png' });

  /* 10. 图标可读性拼图: 24px(判读) + 16px(芯片实绘) */
  const strip = await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 8 * 30; cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = '#0A0F14'; g.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < 8; i++) {           /* 0-6 图标, 7=RESERVED 透明 */
      V18UIR.icon(g, i, 15 + i * 30, 14, 24, { variant: 'tint', tint: '#EEF6FF' });
      V18UIR.icon(g, i, 15 + i * 30, 48, 16, { variant: 'base' });
    }
    return cv.toDataURL('image/png');
  });
  dataUrlToFile(strip, outDir + '/icons-24px.png');
  assert(true, '图标 24px/16px 拼图输出');

  /* ---------- 手机 640x360 (16:9 无黑边, 排除 letterbox 干扰) hasTouch ---------- */
  const ph = await browser.newPage({ viewport: { width: 640, height: 360 }, hasTouch: true, isMobile: true });
  ph.on('console', m => { if (m.type() === 'error') errors.push('[phone] ' + m.text()); });
  ph.on('pageerror', e => errors.push('[phone] PAGEERROR: ' + e.message));
  await ph.goto(pathToFileURL(GAME).href);
  await ph.waitForTimeout(700);
  await ph.evaluate(() => { G.set('touch', 'on'); window.G.visualScene('title'); });
  await ph.waitForFunction(() => window.G.v18ui.info().loaded.includes('title'), null, { timeout: 5000 });
  await ph.waitForTimeout(1000);
  await ph.screenshot({ path: outDir + '/phone-title.png' });

  await ph.evaluate(() => { window.G.skipTo(0); });
  await ph.waitForFunction(() => ST.state === 'play', null, { timeout: 5000 });
  await ph.waitForTimeout(400);
  await ph.evaluate(() => window.G.visualScene('hud'));
  await ph.waitForTimeout(600);
  const skinned = await ph.evaluate(() => document.querySelectorAll('#touchovl .tbtn.v18').length);
  assert(skinned >= 7, '触屏按钮图标皮肤注入 (' + skinned + '/8)');
  await ph.screenshot({ path: outDir + '/phone-hud.png' });

  /* 导弹蓄力态: 环 + ×N (0.9s → 4-5 锁, act 亮度) */
  await ph.keyboard.down('KeyL');
  await ph.waitForTimeout(900);
  await ph.screenshot({ path: outDir + '/phone-msl-charge.png' });
  await ph.keyboard.up('KeyL');
  await ph.waitForTimeout(1200);             /* 冷却中段: 恢复环 ~50% 可读 */
  await ph.screenshot({ path: outDir + '/phone-msl-cd.png' });

  /* 整备页 (手机): 先用触摸把输入模式切回 touch (键盘蓄力测试把 INMODE 切成了 key) */
  await ph.touchscreen.tap(320, 60);
  await ph.evaluate(() => {
    RUN.pts = 6; ST.state = 'upgrade'; ST.upg = { sel: 2, from: 'clear' };
  });
  await ph.waitForFunction(() => window.G.v18ui.info().loaded.includes('dep'), null, { timeout: 5000 });
  await ph.waitForTimeout(600);
  await ph.screenshot({ path: outDir + '/phone-upgrade.png' });

  assert(errors.length === 0, '零页面错误' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  fs.writeFileSync(outDir + '/v18ui-results.json', JSON.stringify({ results, errors }, null, 2));
  const nPass = results.filter(r => r.pass).length;
  console.log('=== V18UI SHOTS ' + nPass + '/' + results.length + (nPass === results.length ? ' ALL PASS ===' : ' HAS FAIL ===') +
    '  dir: ' + outDir);
  await browser.close();
  process.exit(nPass === results.length ? 0 : 1);
})();
