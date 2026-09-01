/* 坦克大战视觉回归截图 (v1.7): node tools/tankshot.js <tag> [--base-only]
   - 静态摆拍: title/combat/boss/units/explosion/weather/hud
   - 护罩等离子球: 三机体 shield + 弹反白闪 shieldHit
   - 冲刺残影/地形特效: free 场景 + 键盘驱动 (水面/冰面/熔岩/减速区/扬尘)
   - 震动分级数值断言: T0机枪 < T1主炮 < T2导弹 < T3击破(=3.0 封顶)
   输出: output/visual/<tag>/*.png + results.json */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('/Users/rancequan/.hermes/hermes-agent/node_modules/playwright-core');

const CHROME_CANDIDATES = [
  process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac/chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
];
const exe = CHROME_CANDIDATES.find(p => fs.existsSync(p));
if (!exe) { console.error('no chromium found'); process.exit(1); }

const GAME = path.join(__dirname, '..', 'index.html');
const STATIC_SCENES = [
  ['title', 900], ['combat', 420], ['boss', 600], ['units', 500],
  ['explosion', 170], ['weather', 450], ['hud', 450],
];
/* [名称, 关卡, tileId(可选,tp 到该 tile), 驾驶方向] — 河道为横向 3 格, 用 D 沿河行驶 */
const TERRAIN = [
  ['terrain-water', 2, 3, 'KeyD'],
  ['terrain-ice', 4, 3, 'KeyD'],
  ['terrain-lava', 6, 3, 'KeyD'],
  ['terrain-slow', 3, 4, 'KeyW'],
  ['terrain-dust', 0, null, 'KeyW'],
];

function assert(cond, msg, results) {
  results.push({ pass: !!cond, msg });
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + msg);
}

(async () => {
  const tag = process.argv[2] || 'v17';
  const baseOnly = process.argv.includes('--base-only');
  const outDir = path.join(__dirname, '..', 'output', 'visual', tag);
  fs.mkdirSync(outDir, { recursive: true });
  const results = [];
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto(pathToFileURL(GAME).href);
  await page.waitForTimeout(900);

  /* A. 静态摆拍场景 */
  for (const [s, wait] of STATIC_SCENES) {
    const r = await page.evaluate(n => window.G.visualScene(n), s);
    await page.waitForTimeout(wait);
    await page.screenshot({ path: outDir + '/' + s + '.png' });
    console.log(s, '->', r);
  }
  if (baseOnly) { await browser.close(); return; }

  /* B. 护罩等离子球: 三机体 + 弹反白闪帧 */
  for (const hull of ['assault', 'balanced', 'heavy']) {
    await page.evaluate(k => { window.G.hull(k); return window.G.visualScene('shield'); }, hull);
    await page.waitForTimeout(500);
    await page.screenshot({ path: outDir + '/shield-' + hull + '.png' });
  }
  await page.evaluate(() => { window.G.hull('balanced'); return window.G.visualScene('shieldHit'); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: outDir + '/shield-hit.png' });

  /* C. 冲刺残影彗尾 (雪原冰面河道: 增长中的彗尾+冰花同框) */
  await page.evaluate(() => {   /* 关卡保持 lvl4; 找河道最平直的 7 格段, 页内跟随钳回河带(防驶出) */
    window.G.visualScene('free');
    const bandY = tx => { for (let ty = 1; ty < MAPH - 1; ty++) if (terr.m[ty * MAPW + tx] === 3) return ty; return -1; };
    let bx = -1, bs = 1e9;
    for (let tx = 3; tx < MAPW - 9; tx++) {
      const ys = []; for (let k = 0; k < 7; k++) ys.push(bandY(tx + k));
      if (ys.some(y => y < 0)) continue;
      const v = Math.max(...ys) - Math.min(...ys);
      if (v < bs) { bs = v; bx = tx; }
    }
    if (bx >= 0) window.G.tp((bx + 1) * TS + 8, bandY(bx + 1) * TS + TS + 2);   /* 段左端起跑 */
    window.__follow = setInterval(() => { const tx = Math.floor(player.x / TS); const by = bandY(tx);
      if (by > 0) player.y += clamp(by * TS + TS + 2 - player.y, -30, 30); }, 150);
    window.__keep = setInterval(() => { player.sprintG = 1; player.sprintLock = false; }, 200);   /* 摆拍保能量, 摆脱 2.6s 窗 */
  });
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyD');   /* 沿平直河道行驶: 停留在冰面带内 */
  await page.waitForTimeout(650);
  const ramp1 = await page.evaluate(() => window.G.perf());   /* 彗尾增长中: 1~3 条 (冰面起步含加速期) */
  await page.waitForTimeout(1600);   /* 冰面冲刺减速50%, 满尾需 ~2s (156px/83px/s) */
  const sprintPerf = await page.evaluate(() => window.G.perf());   /* 满尾: 5~6 条 */
  await page.screenshot({ path: outDir + '/sprint-ghosts.png' });
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyW');   /* 改向上顶墙 */
  await page.evaluate(() => { clearInterval(window.__follow); clearInterval(window.__keep); window.G.tp(480, 34); });   /* 停跟随/保能量, 贴上边缘: 能量满但位移≈0 */
  await page.waitForTimeout(900);
  const stuckPerf = await page.evaluate(() => window.G.perf());   /* 卡住: 尾巴应收缩归零 */
  await page.screenshot({ path: outDir + '/sprint-stuck.png' });
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  assert(sprintPerf.ghost > 0.9, '冲刺残影可见度 ghost=' + sprintPerf.ghost + ' (期望>0.9)', results);
  assert(ramp1.ghostN >= 1 && ramp1.ghostN < 5, '残影随冲刺增长 ramp@0.65s=' + ramp1.ghostN + '条 (期望1~4)', results);
  assert(sprintPerf.ghostN >= 5, '满尾条数 ghostN=' + sprintPerf.ghostN + ' (期望>=5)', results);
  assert(stuckPerf.ghostN === 0, '卡住后残影归零 ghostN=' + stuckPerf.ghostN + ' len=' + stuckPerf.ghostLen + ' (期望0)', results);
  assert(sprintPerf.trail >= 20, '残影位置历史 trail=' + sprintPerf.trail + ' (期望>=20)', results);

  /* D. 地形行进特效 */
  for (const [name, lvl, tid, dirKey] of TERRAIN) {
    const placed = await page.evaluate(([l, t]) => {
      window.G.skipTo(l); window.G.visualScene('free');
      if (t !== null) { const f = window.G.findTile(t); if (f) window.G.tp(f.x, f.y); return !!f; }
      return true;
    }, [lvl, tid]);
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down(dirKey);
    await page.waitForTimeout(1100);
    await page.screenshot({ path: outDir + '/' + name + '.png' });
    await page.keyboard.up(dirKey);
    await page.keyboard.up('ShiftLeft');
    console.log(name, '-> lvl', lvl, 'tile', tid, placed ? 'placed' : 'NOT FOUND');
  }

  /* E. 震动分级数值断言 */
  await page.evaluate(() => {   /* 记录 cameraKick 强度序列 */
    window.__kicks = [];
    const orig = cameraKick;
    cameraKick = (p, a, z) => { window.__kicks.push(+p.toFixed(2)); return orig(p, a, z); };
  });
  await page.evaluate(() => {   /* 沙漠空场, 玩家上方 56px 放高血量靶车, 炮口朝上 */
    window.G.skipTo(0); window.G.visualScene('free');
    const e = window.G.dummy('tank', player.x, player.y - 56);
    e.hp = e.maxHp = 3000; e.stun = 99; player.a = -Math.PI / 2;
    window.__kicks.length = 0;
  });
  await page.keyboard.down('KeyJ');           /* T0: 机枪命中 */
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyJ');
  await page.waitForTimeout(300);
  await page.keyboard.down('KeyK');           /* T1: 主炮命中 (另含 0.5 后坐微踢) */
  await page.waitForTimeout(80);
  await page.keyboard.up('KeyK');
  await page.waitForTimeout(500);
  await page.keyboard.down('KeyL');           /* T2: 导弹命中 */
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyL');
  await page.waitForTimeout(900);
  const hitKicks = await page.evaluate(() => window.__kicks.slice());
  const killLog = await page.evaluate(() => {  /* T3: 击破 */
    const e = enemies[0];
    window.__kicks.length = 0;
    hurtEnemy(e, e.hp + 1, 'shot');
    return { kicks: window.__kicks.slice(), shake: ST.shake, hold: ST.shakeHold };
  });
  const T = { mg: 0.35, cannon: 0.9, missile: 1.8, kill: 3.0 };
  const uniq = a => [...new Set(a)];
  assert(hitKicks.includes(T.mg), '机枪命中震动 T0=' + T.mg + ' (记录:' + uniq(hitKicks) + ')', results);
  assert(hitKicks.includes(T.cannon), '主炮命中震动 T1=' + T.cannon, results);
  assert(hitKicks.includes(T.missile), '导弹命中震动 T2=' + T.missile, results);
  const maxHit = Math.max(...hitKicks);
  assert(maxHit <= T.missile, '命中震动不超过 T2 (max=' + maxHit + ')', results);
  assert(killLog.kicks.includes(T.kill), '击破震动 T3=' + T.kill + ' (记录:' + killLog.kicks + ')', results);
  assert(killLog.shake >= T.kill, '击破后 ST.shake=' + killLog.shake.toFixed(2) + ' >= 3', results);
  await page.waitForTimeout(250);
  await page.screenshot({ path: outDir + '/shake-kill.png' });   /* 击破帧 (震动中) */

  /* F. 性能 */
  const perf = await page.evaluate(() => new Promise(res => {
    window.G.visualScene('combat');
    setTimeout(() => res(window.G.perf()), 1500);
  }));
  console.log('perf:', JSON.stringify(perf));
  assert(perf.fps >= 50, '战斗场景 fps=' + perf.fps + ' (期望>=50)', results);

  const failed = results.filter(r => !r.pass).length;
  fs.writeFileSync(path.join(outDir, 'results.json'),
    JSON.stringify({ tag, results, perf, sprintPerf, hitKicks, killLog, errors }, null, 2));
  console.log('console errors:', JSON.stringify(errors));
  console.log(failed === 0 ? 'ALL ' + results.length + ' ASSERTS PASS' : failed + ' ASSERTS FAILED');
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
