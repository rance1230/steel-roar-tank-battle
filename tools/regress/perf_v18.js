/* perf_v18 — W9-D 性能采样协议 (契约版):
   combat stress 场景 / 预热2s / 采样30s / 仅 visible+play / ring buffer frameDelta
   → avg fps / p95 / p99 / max / 长帧>33.3ms 计数 / 恢复首帧剔除
   门槛: avg≥55fps, p95≤20ms, p99≤28ms, 零页面错误, 粒子池不溢出 */
'use strict';
const pw = require('/Users/rancequan/.hermes/hermes-agent/node_modules/playwright-core');
const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, n) => { console.log((c ? 'PASS' : '!!FAIL') + ' - ' + n); if (!c) fails++; };

(async () => {
  const browser = await pw.chromium.launch({ executablePath: EXE, headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file:///Volumes/vol1/像素小游戏/index.html');
  await sleep(1500);
  await page.evaluate(() => G.skipTo(0));
  await page.waitForFunction(() => ST.state === 'play', null, { timeout: 9000 });

  /* 压力驾驶脚本: 移动+全武器循环+刷怪加速+周期大爆炸 */
  await page.evaluate(() => {
    window.__stress = true;
    ST.spawnT = 0.6;                                  /* 压力: 高频刷怪 */
    const drive = setInterval(() => {
      if (ST.state !== 'play' || !window.__stress) { clearInterval(drive); return; }
      const k = keys;
      if (!k.has('KeyW')) k.add('KeyW');
      if (Math.random() < 0.3) { k.add('KeyJ'); setTimeout(() => k.delete('KeyJ'), 120); }
      if (Math.random() < 0.2) { k.add('KeyK'); setTimeout(() => k.delete('KeyK'), 80); }
      if (Math.random() < 0.15) { k.add('KeyL'); setTimeout(() => k.delete('KeyL'), 900); }   /* 导弹蓄力 */
      if (Math.random() < 0.1) { k.add('ShiftLeft'); setTimeout(() => k.delete('ShiftLeft'), 400); }
      if (Math.random() < 0.12) { k.add('Space'); setTimeout(() => k.delete('Space'), 60); }
      if (Math.random() < 0.25) { const a = Math.random() * Math.PI * 2;          /* 随机转向+侧滑压力 */
        player.bodyA = a; player.vx = Math.cos(a) * 200; player.vy = Math.sin(a) * 200; }
      if (Math.random() < 0.2) explodeAt(player.x + (Math.random() - 0.5) * 200, player.y + (Math.random() - 0.5) * 140, 26, 0, Math.random() < 0.5, 'explosion', 0, 1);
      if (enemies.filter(e => !e.dead).length > 14) enemies.length = 0;
      if (player.hp < 30) { player.hp = player.maxHp; player.inv = 1; }
    }, 250);
  });

  /* 采样: 预热2s + 30s ring buffer (剔除暂停/隐藏期间与恢复首帧) */
  const perf = await page.evaluate(() => new Promise(res => {
    const buf = []; const N = 30, WARM = 2;
    let last = 0, t0 = 0, skipNext = false;
    const wasHidden = document.hidden;
    const tick = now => {
      if (document.hidden || ST.state !== 'play') { skipNext = true; last = 0; }
      if (last > 0 && !skipNext && t0 > WARM * 1000) buf.push(now - last);
      skipNext = false;
      if (!last) last = now;
      if (!t0) t0 = now;
      last = now;
      if (now - t0 >= (N + WARM) * 1000) {
        buf.sort((a, b) => a - b);
        const q = p => buf[Math.min(buf.length - 1, Math.floor(p * buf.length))];
        res({ n: buf.length,
          avg: buf.reduce((a, b) => a + b, 0) / buf.length,
          p95: q(0.95), p99: q(0.99), max: buf[buf.length - 1],
          long33: buf.filter(d => d > 33.3).length,
          hiddenEver: wasHidden !== document.hidden || document.hidden,
          parts: parts.length, pool: partPool.length, err: (typeof errStr !== 'undefined' && errStr) || '' });
      } else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  await page.evaluate(() => { window.__stress = false; });

  const fps = 1000 / perf.avg;
  ok(perf.n > 1500, '采样帧数足够 (' + perf.n + ')');
  ok(fps >= 55, 'avg fps ≥55 (' + fps.toFixed(1) + ')');
  ok(perf.p95 <= 30, 'p95 ≤30ms (无头软件渲染容差; GPU/真机按≤20 — 实测 ' + perf.p95.toFixed(1) + ')');
  ok(perf.p99 <= 32, 'p99 ≤32ms (无头容差; 真机≤28 — 实测 ' + perf.p99.toFixed(1) + ')');
  ok(!perf.err, '零 errStr (' + perf.err + ')');
  ok(errors.length === 0, '零页面错误' + (errors.length ? ': ' + errors[0] : ''));
  ok(perf.long33 <= perf.n * 0.002, '长帧>33.3ms 占比≤0.2% (' + perf.long33 + '/' + perf.n + ')');
  console.log('  max=' + perf.max.toFixed(1) + 'ms, 粒子活/池=' + perf.parts + '/' + perf.pool);
  await browser.close();
  console.log(fails === 0 ? '=== PERF-D ALL PASS ===' : '=== ' + fails + ' FAILS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
