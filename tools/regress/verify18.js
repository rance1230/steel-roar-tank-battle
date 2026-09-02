/* verify18 — v1.8 专项断言套件 (W9 Layer B; 按 CONTROL_CONTRACT_v1.8)
   [G0-5] 旧存档迁移: v1.7/v1.3 trSave 无 cdr → backfill cdr=0 / 其余不变 / refundAll 守恒 / retry 兜底 */
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
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto('file:///Volumes/vol1/像素小游戏/index.html'); await sleep(1000);
  const ev = fn => page.evaluate(fn);

  /* ---- A. v1.7 旧存档 (up 无 cdr) 加载 backfill ---- */
  const A = await ev(() => {
    localStorage.setItem('trSave', JSON.stringify({lvl: 3, score: 1234, kills: 56, time: 78.5, cycle: 1, pts: 2,
      up: {hp: 3, spd: 1, atk: 4, def: 2}, eq: {armor: 1, track: 0, fire: 2, comp: 1}, hull: 'heavy', wing: 'guard'}));
    loadRun();
    return {cdr: RUN.up.cdr, hp: RUN.up.hp, atk: RUN.up.atk, def: RUN.up.def, spd: RUN.up.spd,
      cycle: RUN.cycle, lvl: RUN.lvl, hull: RUN.hull, wing: RUN.wing, eq: RUN.eq, pts: RUN.pts};
  });
  ok(A.cdr === 0, 'A1 v1.7 存档 up.cdr backfill=0');
  ok(A.hp === 3 && A.atk === 4 && A.def === 2 && A.spd === 1, 'A2 其余点数原样 (' + JSON.stringify([A.hp, A.spd, A.atk, A.def]) + ')');
  ok(A.cycle === 1 && A.lvl === 3 && A.hull === 'heavy' && A.wing === 'guard', 'A3 周目/关卡/机体/僚机不变');
  ok(A.eq.armor === 1 && A.eq.fire === 2, 'A4 装备不变');

  /* ---- B. refundAll 点数守恒 (含 cdr) ---- */
  const B = await ev(() => {
    RUN.pts = 5; RUN.up = {hp: 2, spd: 1, atk: 3, def: 0, cdr: 4};
    const before = RUN.pts + 2 + 1 + 3 + 0 + 4;
    refundAll();
    return {after: RUN.pts, before, up: JSON.parse(JSON.stringify(RUN.up))};
  });
  ok(B.after === B.before, 'B1 refundAll 守恒 (' + B.before + '→' + B.after + ')');
  ok(B.up.cdr === 0 && B.up.atk === 0, 'B2 五维全清零');

  /* ---- C. retry 兜底: lvlSnap.up 无 cdr (旧快照) ---- */
  await ev(() => { window.G.start(); menuActivate(); menuActivate(); onKeyPress('Enter'); }); await sleep(3400);
  const C = await ev(() => {
    RUN.up = {hp: 2, spd: 0, atk: 1, def: 0, cdr: 0};
    delete lvlSnap.up.cdr;                      /* 模拟旧版快照缺 cdr */
    lvlSnap.up.hp = 2; lvlSnap.up.atk = 1;
    window.G.hurt();                            /* → over */
    return true;
  }); await sleep(500);
  await page.keyboard.press('KeyR'); await sleep(3400);
  const C2 = await ev(() => ({state: ST.state, cdr: RUN.up.cdr, hp: RUN.up.hp, atk: RUN.up.atk}));
  ok(C && C2.state === 'play' && C2.cdr === 0 && C2.hp === 2 && C2.atk === 1, 'C1 重试兜底 cdr=0 且点数保留 (' + JSON.stringify(C2) + ')');

  /* ---- D. 实体身份: enemyId 关内递增不复用, 关卡重开重置 ---- */
  const D = await ev(() => { ST.spawnT = 1e9; enemies.length = 0; ST.nextEnemyId = 0;
    const a = G.dummy('truck', 200, 100), b = G.dummy('tank', 300, 100), c = G.dummy('truck', 400, 100);
    return {ids: [a.id, b.id, c.id], next: ST.nextEnemyId}; });
  ok(D.ids[0] === 1 && D.ids[1] === 2 && D.ids[2] === 3 && D.next === 3, 'D1 enemyId 1,2,3 递增 (' + JSON.stringify(D.ids) + ')');
  const D2 = await ev(() => { startLevel(); return ST.nextEnemyId; });   /* 关卡重开 → 重置 */
  ok(D2 === 0, 'D2 关卡重开 nextEnemyId 重置 (' + D2 + ')');
  await page.keyboard.press('Escape'); await ev(() => { MENU = null; });  /* 退出 intro 干扰 */

  /* ---- E. 冷却契约: cdr=0 时行为不变 + cdMul 公式 ---- */
  const E = await ev(() => { RUN.up.cdr = 0; const s0 = calcStats(); RUN.up.cdr = 10; const s10 = calcStats(); RUN.up.cdr = 30; const s30 = calcStats(); RUN.up.cdr = 0;
    return {m0: s0.cdMul, w0: s0.wcdMul, m10: +s10.cdMul.toFixed(3), w10: +s10.wcdMul.toFixed(3), m30: s30.cdMul, w30: +s30.wcdMul.toFixed(3)}; });
  ok(E.m0 === 1 && E.w0 === 1, 'E1 cdr=0 → 双乘数=1 (行为不变)');
  ok(Math.abs(E.m10 - 0.714) < 0.002 && Math.abs(E.w10 - 0.9) < 0.002, 'E2 cdr=10 → 技能0.714/武器0.90 (' + E.m10 + '/' + E.w10 + ')');
  ok(E.m30 === 0.55 && Math.abs(E.w30 - 0.843) < 0.002, 'E3 cdr=30 → 技能0.55/武器0.84 (' + E.m30 + '/' + E.w30 + ')');

  /* ---- F. 护盾硬不变量: cdr 任意值 × 三机体 ---- */
  const F = await ev(() => { const out = [];
    for (const hk of ['assault', 'balanced', 'heavy']) { RUN.hull = hk;
      for (const cdr of [0, 10, 30]) { RUN.up.cdr = cdr; const st = calcStats(), sc = HULLS[hk].shield;
        out.push({hk, cdr, eff: Math.max(sc.cd * st.cdMul, sc.dur + SHIELD_GRACE + 0.25), need: sc.dur + SHIELD_GRACE + 0.25}); } }
    RUN.hull = 'balanced'; RUN.up.cdr = 0; return out; });
  ok(F.every(o => o.eff >= o.need - 1e-9), 'F1 三机体×cdr{0,10,30} 有效CD≥dur+grace+0.25 (' +
     F.filter(o => o.eff < o.need - 1e-9).length + ' 违例)');
  const Fh = F.find(o => o.hk === 'heavy' && o.cdr === 0);
  ok(Fh.eff > 4, 'F2 重装旧数值下不变量生效 (有效CD ' + Fh.eff.toFixed(2) + 's > 旧实际1.5s, 永久盾bug已封)');

  /* ---- G. W1 双摇杆输入: 三通道瞄准轴 ---- */
  await ev(() => { window.G.start(); menuActivate(); menuActivate(); onKeyPress('Enter'); }); await sleep(3400);
  await ev(() => { ST.spawnT = 1e9; G.tp(240, 135); player.vx = 0; player.vy = 0; });
  /* G1 手柄右杆 axes[2]/[3] */
  const G1 = await ev(() => {
    window.__fp = {index: 0, id: 'Pad', connected: true, mapping: 'standard',
      buttons: Array.from({length: 16}, () => ({pressed: false, value: 0})), axes: [0, 0, 0, 0]};
    Object.defineProperty(navigator, 'getGamepads', {value: () => [window.__fp], configurable: true});
    return true;
  });
  await ev(() => { window.__fp.axes = [0, 0, 0.6, -0.3]; }); await sleep(200);
  let g = await ev(() => ({rax: +PAD.rax.toFixed(2), ray: +PAD.ray.toFixed(2)}));
  ok(G1 && Math.abs(g.rax - 0.6) < 0.03 && Math.abs(g.ray + 0.3) < 0.03, 'G1 手柄右杆→PAD.rax/ray (原值模拟量, ' + g.rax + ',' + g.ray + ')');
  await ev(() => { window.__fp.axes = [0, 0, 0.05, 0.05]; }); await sleep(150);
  g = await ev(() => ({rax: PAD.rax, ray: PAD.ray}));
  ok(g.rax === 0 && g.ray === 0, 'G1b 右杆死区0.18内归零');
  await ev(() => { window.__fp.axes = [0, 0, 0, 0]; }); await sleep(150);
  /* G2 键盘方向键=瞄准且不再移动 */
  await page.keyboard.down('ArrowRight'); await sleep(200);
  g = await ev(() => ({rax: +PAD.rax.toFixed(2), ray: +PAD.ray.toFixed(2), vx: Math.round(player.vx), vy: Math.round(player.vy)}));
  await page.keyboard.up('ArrowRight');
  ok(g.rax === 1 && g.ray === 0 && Math.abs(g.vx) < 1 && Math.abs(g.vy) < 1, 'G2 方向键→瞄准轴且不产生移动 (' + g.rax + ', v=' + g.vx + ',' + g.vy + ')');
  await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowRight'); await sleep(200);
  g = await ev(() => ({rax: +PAD.rax.toFixed(2), ray: +PAD.ray.toFixed(2)}));
  await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowRight');
  ok(Math.abs(g.rax - 0.707) < 0.02 && Math.abs(g.ray + 0.707) < 0.02, 'G2b 对角瞄准归一化 (45°)');
  /* G3 触屏右摇杆 (#rjoy → VR → PAD.rax/ray) — 强制显示触屏层(桌面无头默认隐藏, 零尺寸会 0/0=NaN) */
  await ev(() => { SET.touch = 'on'; }); await sleep(200);
  const G3 = await page.evaluate(() => { const j = document.getElementById('rjoy'); if (!j) return null;
    const r = j.getBoundingClientRect();
    window.__rc = {x: r.left + r.width / 2, y: r.top + r.height / 2, max: r.width / 2 * 0.62};
    j.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, pointerId: 21, clientX: __rc.x, clientY: __rc.y}));
    j.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, pointerId: 21, clientX: __rc.x + __rc.max * 0.9, clientY: __rc.y}));
    return true; });
  await sleep(200);
  g = await ev(() => ({rax: +PAD.rax.toFixed(2), ray: +PAD.ray.toFixed(2)}));
  ok(G3 && g.rax > 0.7 && Math.abs(g.ray) < 0.15, 'G3 #rjoy 推右→PAD 瞄准轴 (' + g.rax + ')');
  await page.evaluate(() => document.getElementById('rjoy').dispatchEvent(new PointerEvent('pointerup', {bubbles: true, pointerId: 21})));
  let g3b = null;                                            /* 无头偶发节流: 重试读数 */
  for (let i = 0; i < 8; i++) { await sleep(120); g3b = await ev(() => ({rax: PAD.rax, ray: PAD.ray})); if (g3b.rax === 0 && g3b.ray === 0) break; }
  ok(g3b.rax === 0 && g3b.ray === 0, 'G3b 松开右杆归零');
  /* G4 双杆指针独立: 左杆持住(id 31), 右杆 cancel(id 32) 不影响左杆 */
  const G4 = await page.evaluate(() => {
    const jl = document.getElementById('joy'), jr = document.getElementById('rjoy');
    const rl = jl.getBoundingClientRect(), rr = jr.getBoundingClientRect();
    const lc = {x: rl.left + rl.width / 2, y: rl.top + rl.height / 2}, rc = {x: rr.left + rr.width / 2, y: rr.top + rr.height / 2};
    jl.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, pointerId: 31, clientX: lc.x, clientY: lc.y}));
    jl.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, pointerId: 31, clientX: lc.x, clientY: lc.y - rl.width * 0.3}));
    jr.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, pointerId: 32, clientX: rc.x, clientY: rc.y}));
    jr.dispatchEvent(new PointerEvent('pointercancel', {bubbles: true, pointerId: 32}));
    return {vax: +VJ.ax.toFixed(2), vay: +VJ.ay.toFixed(2), vr: Math.abs(VR.ax) + Math.abs(VR.ay)};
  });
  ok(G4.vay < -0.4 && G4.vr === 0, 'G4 右杆 pointercancel 不影响左杆 (VJ ' + G4.vax + ',' + G4.vay + ', VR清零)');
  await page.evaluate(() => document.getElementById('joy').dispatchEvent(new PointerEvent('pointerup', {bubbles: true, pointerId: 31})));
  await ev(() => { SET.touch = 'auto'; }); await sleep(200);
  /* G5 resetTransientInput 全清 */
  await page.keyboard.down('KeyJ'); await page.keyboard.down('ArrowLeft');
  await page.evaluate(() => { const jl = document.getElementById('joy'); const r = jl.getBoundingClientRect();
    jl.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, pointerId: 41, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2})); });
  await sleep(150);
  const G5 = await ev(() => { resetTransientInput();
    return {keys: keys.size, vkeys: VKEYS.size, vj: Math.abs(VJ.ax) + Math.abs(VJ.ay), rax: PAD.rax, cls: document.getElementById('joy').className}; });
  await page.keyboard.up('KeyJ'); await page.keyboard.up('ArrowLeft');
  ok(G5.keys === 0 && G5.vkeys === 0 && G5.vj === 0 && G5.rax === 0 && G5.cls.indexOf('on') < 0, 'G5 resetTransientInput 清 keys/VKEYS/双杆/瞄准轴/视觉态');
  /* G6 visibilitychange hidden → 取消蓄力不放弹 */
  await ev(() => { enemies.length = 0; if (typeof wingman !== 'undefined' && wingman) wingman.downT = 99;   /* 僚机会持续开火产生友方mg */
    player.charging = true; player.charge = 0.8; window.__shots0 = shots.filter(x => x.friendly).length; });   /* 只计友方弹 */
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', {value: true, configurable: true});
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', {value: false, configurable: true}); });
  await sleep(300);
  g = await ev(() => ({chg: player.charging, c0: player.charge, sn: shots.filter(x => x.friendly).length - window.__shots0}));
  ok(g.chg === false && g.c0 === 0 && g.sn <= 0, 'G6 后台取消蓄力不发射 (charging=' + g.chg + ', 新弹' + g.sn + ')');
  await ev(() => { window.__fp.connected = false; });

  /* ---- H. W2 炮塔模型: bodyA/ta 分离 + 沿ta开火 + 松手保持 ---- */
  const H1 = await ev(() => ({noA: !('a' in player), hasBody: typeof player.bodyA === 'number', hasTa: typeof player.ta === 'number'}));
  ok(H1.noA && H1.hasBody && H1.hasTa, 'H1 玩家角度字段= bodyA/ta, p.a 已消灭 (契约§2)');
  const b0 = await ev(() => player.bodyA);
  await page.keyboard.down('ArrowRight'); await sleep(450);
  const H2 = await ev(() => ({ta: +player.ta.toFixed(3), bodyA: +player.bodyA.toFixed(3)}));
  await page.keyboard.up('ArrowRight');
  ok(Math.abs(H2.ta) < 0.15 && Math.abs(H2.bodyA - b0) < 0.01, 'H2 方向键驱动炮塔且车身不动 (ta=' + H2.ta + ' bodyA=' + H2.bodyA + ')');
  await ev(() => { window.__fp.connected = true; window.__fp.axes = [0, 0, 0, 1]; }); await sleep(450);
  const H3 = await ev(() => +player.ta.toFixed(3));
  await ev(() => { window.__fp.axes = [0, 0, 0, 0]; window.__fp.connected = false; });
  ok(Math.abs(H3 - Math.PI / 2) < 0.15, 'H3 手柄右杆驱动炮塔向下 (ta=' + H3 + '≈π/2)');
  await sleep(650);
  const H5 = await ev(() => +player.ta.toFixed(3));
  ok(Math.abs(H5 - Math.PI / 2) < 0.15, 'H5 松手永久保持瞄准角 (ta=' + H5 + ')');
  await ev(() => { player.bodyA = 0; player.ta = Math.PI / 2; player.vx = player.vy = 0; });
  await page.keyboard.down('KeyJ'); await sleep(120); await page.keyboard.up('KeyJ'); await sleep(80);
  const H4 = await ev(() => { const m = shots.filter(x => x.friendly && x.kind === 'mg').slice(-1)[0];
    return m ? +Math.atan2(m.vy, m.vx).toFixed(3) : null; });
  ok(H4 !== null && Math.abs(H4 - Math.PI / 2) < 0.12, 'H4 机枪沿炮塔角发射 (弹角=' + H4 + '≈π/2, 车身=0)');
  const H6 = await page.evaluate(() => new Promise(res => {      /* Breach 锁定: 车身+炮塔同轴指敌 */
    player.bodyA = 0; player.ta = 0; player.vx = 190; player.vy = 0;
    const t = G.dummy('tank', player.x + 40, player.y); t.stun = 99;
    let n = 0; const iv = setInterval(() => {
      if ((player.breach && player.vx === 0) || ++n > 90) { clearInterval(iv);
        res({lock: !!player.breach, bodyA: +player.bodyA.toFixed(3), ta: +player.ta.toFixed(3)}); } }, 16); }));
  ok(H6.lock && Math.abs(H6.bodyA - 0) < 0.05 && Math.abs(H6.ta - H6.bodyA) < 0.01, 'H6 Breach锁定→车身/炮塔同轴指敌 (bodyA=' + H6.bodyA + ' ta=' + H6.ta + ')');

  /* ---- I. W3 移动/漂移 (契约§2: 惯性制动/侧滑grip/机体差异/泥地乘数) ---- */
  await ev(() => { ST.spawnT = 1e9; if (ST.enemies) ST.enemies.length = 0; if (wingman) wingman.downT = 99; });
  const slipProbe = async () => {          /* 满速东行→急转南: 采样 0.5s 内最大侧滑 */
    await ev(() => { G.tp(200, 200); player.bodyA = 0; player.ta = 0; player.vx = 230; player.vy = 0; player.slip = 0; });
    await page.keyboard.down('KeyS');
    const mx = await page.evaluate(() => new Promise(res => { let m = 0, n = 0;
      const iv = setInterval(() => { m = Math.max(m, player.slip || 0);
        if (++n > 30) { clearInterval(iv); res(Math.round(m)); } }, 16); }));
    await page.keyboard.up('KeyS');
    return mx;
  };
  await ev(() => { RUN.hull = 'assault'; });
  const slipA = await slipProbe();
  ok(slipA > 50, 'I1 突击(grip0.78)急转侧滑 slip>50 (' + slipA + ')');
  await ev(() => { RUN.hull = 'heavy'; });
  const slipH = await slipProbe();
  ok(slipH < slipA, 'I2 机体差异: 突击侧滑 > 重装 (' + slipA + ' > ' + slipH + ')');
  await ev(() => { RUN.hull = 'balanced'; });
  const mud = await page.evaluate(() => {              /* 跨关找 tile4 泥地格 (L1 沙漠无泥地) */
    for (let lv = 0; lv < LEVELS.length; lv++) { RUN.lvl = lv; startLevel();
      ST.state = 'play'; ST.introT = 0; ST.spawnT = 1e9;
      for (let i = 0; i < terr.m.length; i++) if (terr.m[i] === 4)
        return {x: (i % MAPW) * TS + 16, y: ((i / MAPW) | 0) * TS + 16, lv}; }
    return null; });
  if (mud) {
    const sm = await page.evaluate(mm => new Promise(res => {   /* 页内原子: tp→按W, 50ms 采样速度比 (格小, 0.7s末已冲出泥地) */
      G.tp(mm.x, mm.y); player.vx = 0; player.vy = 0;
      keys.add('KeyW'); const rs = [];
      const iv = setInterval(() => rs.push(Math.hypot(player.vx, player.vy) / player.speed), 50);
      setTimeout(() => { keys.delete('KeyW'); clearInterval(iv);
        res(Math.min(...rs)); }, 700); }), mud);
    ok(sm < 0.68, 'I3 泥地减速≈0.55× (L' + (mud.lv + 1) + ', 采样最小 ' + (sm * 100).toFixed(0) + '%)');
  } else ok(false, 'I3 泥地: 全关卡无 tile4');

  log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
  await browser.close();
  log(fails === 0 && errors.length === 0 ? '=== V18 (G0-5+W0) ALL PASS ===' : '=== ' + fails + ' FAILS ===');
  process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
