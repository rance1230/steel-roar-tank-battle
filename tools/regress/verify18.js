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
  const hv = await ev(() => HULLS.heavy.shield);   /* v1.8 W7: 重装 4.0/1.5→2.6/3.4 */
  ok(hv.dur === 2.6 && hv.cd === 3.4 && Fh.eff >= hv.dur + 0.43 - 1e-9 && Fh.eff - hv.dur >= 0.4,
     'F2 重装 dur2.6/cd3.4: 有效CD ' + Fh.eff.toFixed(2) + ' ≥ dur+grace+0.25, 真空≥0.4s (连发非永久盾)');

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
    keys.add('KeyL'); player.charging = true; player.charge = 0.8;   /* 按住键再置charging: 不按键的松键语义下一帧即释放(竞态) */
    window.__shots0 = shots.filter(x => x.friendly && x.kind === 'missile').length; });   /* 只计友方导弹 */
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', {value: true, configurable: true});
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', {value: false, configurable: true}); });
  await ev(() => keys.delete('KeyL'));
  await sleep(300);
  g = await ev(() => ({chg: player.charging, c0: player.charge, sn: shots.filter(x => x.friendly && x.kind === 'missile').length - window.__shots0}));
  ok(g.chg === false && g.c0 === 0 && g.sn <= 0, 'G6 后台取消蓄力不发射 (charging=' + g.chg + ', 新弹' + g.sn + ')');
  await ev(() => { window.__fp.connected = false; });

  /* ---- H. W2 炮塔模型: bodyA/ta 分离 + 沿ta开火 + 松手保持 ---- */
  await ev(() => {                      /* 随机地图 flake 防御: 找 5×5 干净空地做测试锚点 (H6/I 共用) */
    window.__open = () => { for (let y = 8; y < MAPH - 8; y += 3) for (let x = 8; x < MAPW - 8; x += 3) {
      let ok = true;
      for (let dy = -3; dy <= 3 && ok; dy++) for (let dx = -3; dx <= 3; dx++) {
        const t = tileAt(x + dx, y + dy); if (t === 5 || t === 3 || t === 4) { ok = false; break; } }
      if (ok) return {x: x * TS + 16, y: y * TS + 16}; } return {x: 200, y: 200}; }; });
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
    const s = window.__open ? window.__open() : {x: player.x, y: player.y};
    G.tp(s.x, s.y); player.bodyA = 0; player.ta = 0; player.vx = 190; player.vy = 0;
    const t = G.dummy('tank', s.x + 40, s.y); t.stun = 99;
    let n = 0; const iv = setInterval(() => {
      if ((player.breach && player.vx === 0) || ++n > 90) { clearInterval(iv);
        res({lock: !!player.breach, bodyA: +player.bodyA.toFixed(3), ta: +player.ta.toFixed(3)}); } }, 16); }));
  ok(H6.lock && Math.abs(H6.bodyA - 0) < 0.05 && Math.abs(H6.ta - H6.bodyA) < 0.01, 'H6 Breach锁定→车身/炮塔同轴指敌 (bodyA=' + H6.bodyA + ' ta=' + H6.ta + ')');

  /* ---- I. W3 移动/漂移 (契约§2: 惯性制动/侧滑grip/机体差异/泥地乘数) ---- */
  await ev(() => { ST.spawnT = 1e9; if (ST.enemies) ST.enemies.length = 0; if (wingman) wingman.downT = 99; });
  const slipProbe = async () => {          /* 满速东行→急转南: 采样 0.5s 内最大侧滑 */
    await ev(() => { const s = window.__open(); G.tp(s.x, s.y); player.bodyA = 0; player.ta = 0; player.vx = 230; player.vy = 0; player.slip = 0; });
    await page.keyboard.down('KeyS');
    const mx = await page.evaluate(() => new Promise(res => { let m = 0, n = 0;
      const iv = setInterval(() => { m = Math.max(m, player.slip || 0);
        if (++n > 30) { clearInterval(iv); res(Math.round(m)); } }, 16); }));
    await page.keyboard.up('KeyS');
    return mx;
  };
  await ev(() => { RUN.hull = 'assault'; });
  const slipA = await slipProbe();
  ok(slipA > 35, 'I1 突击(grip0.78)急转侧滑 slip>35 (' + slipA + ')');
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

  /* ---- J. W3.5 碰撞冲量: moveCircEx 法线/冲击 + ram速度化 + 撞墙反弹 ---- */
  const J1 = await ev(() => { const o = {x: 26, y: 200};
    const m = moveCircEx(o, -30, 0, 12);          /* 撞世界左边界 */
    return {hit: m.hit, nx: m.nx, ny: m.ny, moved: m.moved}; });
  ok(J1.hit && J1.nx === 1 && J1.ny === 0 && !J1.moved, 'J1 moveCircEx 边界正撞: 法线(+1,0) 零位移 (' + J1.nx + ',' + J1.ny + ')');
  const J1b = await ev(() => { const o = {x: 26, y: 200};
    const m = moveCircEx(o, -30, 20, 12);         /* 斜撞: X挡Y滑 */
    return {hit: m.hit, nx: m.nx, moved: m.moved, dy: o.y - 200}; });
  ok(J1b.hit && J1b.nx === 1 && J1b.moved && J1b.dy === 20, 'J1b 斜撞滑动: X挡Y过, 法线(+1,0)');
  const J2 = await page.evaluate(() => new Promise(res => {   /* ram: 击退走 kv 速度场(禁位移直改) */
    const s = window.__open(); G.tp(s.x, s.y);
    const t = G.dummy('truck', s.x + 18, s.y); t.ramCd = 0; t.stun = 99; t.hp = t.maxHp = 9999;
    const px0 = t.x;
    player.bodyA = 0; player.vx = 100; player.vy = 0;          /* 接触距离内, 40<sp<120 → ram 分支 */
    let n = 0; const iv = setInterval(() => { if (++n > 6 || t.dead) { clearInterval(iv);
      res({kvx: Math.round(t.kvx || 0), moved: Math.round(t.x - px0)}); } }, 16); }));
  ok(J2.kvx > 50 && J2.moved > 3, 'J2 ram 击退=速度场驱动 (' + J2.kvx + 'px/s, ' + J2.moved + 'px/0.1s)');
  const J3 = await page.evaluate(() => new Promise(res => {    /* 撞墙: 法向反弹, 速度反向 (采样窗口最大vx防衰减偶发) */
    G.tp(40, 200); player.bodyA = Math.PI; player.vx = -260; player.vy = 0;
    let n = 0, mx = 0; const iv = setInterval(() => { mx = Math.max(mx, player.vx);
      if (++n > 10) { clearInterval(iv); res({vx: Math.round(mx)}); } }, 16); }));
  ok(J3.vx > 30, 'J3 撞墙反弹: 西向全速→东向回弹 (max ' + J3.vx + 'px/s)');

  /* ---- K. W6 Damage Matrix: ATK-scaled 比值2.0 / ATK-independent 比值1.0 (契约§3) ---- */
  const K = await ev(() => {
    const scaled = ['machinegun','cannon','missile','explosion','chainExplosion','ram','breach','collision','airstrike'];
    const flat = ['shot','reflect','knockback'];
    const saveHull = RUN.hull; RUN.hull = 'balanced'; RUN.up.atk = 0; RUN.eq.fire = 0;
    const hit = c => { const t = G.dummy('truck', 300, 300); t.hp = t.maxHp = 1e9;
      applyDamage(t, 10, c); const d = 1e9 - t.hp; enemies.length = 0; return d; };
    ST.debugActive = true; ST.dbg = {atk: 1}; const r1 = {}; for (const c of scaled.concat(flat)) r1[c] = hit(c);
    ST.dbg = {atk: 2}; const r2 = {}; for (const c of scaled.concat(flat)) r2[c] = hit(c);
    ST.dbg = {}; ST.debugActive = false; RUN.hull = saveHull;
    return {scaled, flat, ratios: scaled.concat(flat).reduce((m, c) => (m[c] = r2[c] / r1[c], m), {})};
  });
  const kBadS = K.scaled.filter(c => Math.abs(K.ratios[c] - 2) > 0.05);
  const kBadF = K.flat.filter(c => Math.abs(K.ratios[c] - 1) > 0.05);
  ok(kBadS.length === 0, 'K1 ATK-scaled 9类 atk1vs2 比值2.0±0.05 (' +
     K.scaled.map(c => c + ':' + K.ratios[c].toFixed(2)).join(' ') + ')');
  ok(kBadF.length === 0, 'K2 ATK-independent 3类 比值1.0±0.05 (' +
     K.flat.map(c => c + ':' + K.ratios[c].toFixed(2)).join(' ') + ')');

  /* ---- L. W4 多锁导弹: 数量公式/首锁边界/冷却禁蓄力/单目标叠锁/队列暂停冻结/无目标dumb ---- */
  const L1 = await ev(() => { RUN.hull = 'assault';
    return {c03: mslCount(0.3), c06: mslCount(0.6), c12: mslCount(1.2),
            first: mslCount(0.20), pre: mslCount(0.199), zero: mslCount(0)}; });
  ok(L1.c03 === 1 && L1.c06 === 3 && L1.c12 === 6, 'L1 数量∝蓄力 0.3s→' + L1.c03 + ' 0.6s→' + L1.c06 + ' 1.2s→' + L1.c12);
  ok(L1.first === 1 && L1.pre === 0 && L1.zero === 0, 'L2 首锁边界: 0.20→' + L1.first + ' 0.199→' + L1.pre + ' 0→' + L1.zero);
  await ev(() => { enemies.length = 0;
    const s = window.__open(); G.tp(s.x, s.y);
    player.charging = false; player.charge = 0; player.lockSlots.length = 0; player.mslVolley.length = 0; });
  const L3 = await page.evaluate(() => new Promise(res => {      /* 冷却期禁蓄力 */
    player.mslCd = 1; keys.add('KeyL');
    setTimeout(() => { keys.delete('KeyL');
      res({chg: player.charging, c0: player.charge}); }, 260); }));
  ok(!L3.chg && L3.c0 === 0, 'L3 冷却期禁蓄力 (charging=' + L3.chg + ', charge=' + L3.c0 + ')');
  const L4 = await page.evaluate(() => new Promise(res => {      /* 单目标叠锁→6弹队列→暂停冻结 */
    player.mslCd = 0;
    const s = window.__open(); G.tp(s.x, s.y);
    const t = G.dummy('tank', s.x + 60, s.y); t.stun = 99; t.hp = t.maxHp = 99999;
    enemies.length = 0; enemies.push(t);
    keys.add('KeyL');
    setTimeout(() => {                                          /* 仍在蓄力: 读锁定快照 */
      const id0 = player.lockSlots.length ? player.lockSlots[0].id : -1;
      const n = player.lockSlots.length;
      const stack = id0 > 0 && player.lockSlots.every(x => x.id === id0);
      keys.delete('KeyL');                                      /* 松手 */
      setTimeout(() => {                                        /* 60ms: 等 release 入队(首发或已出膛) */
        const vlen = player.mslVolley.length;
        MENU = true; const tb = JSON.stringify(player.mslVolley.map(v => +v.t.toFixed(3)));   /* 暂停 0.25s */
        setTimeout(() => { const ta = JSON.stringify(player.mslVolley.map(v => +v.t.toFixed(3)));
          MENU = null;
          res({stack, n, vlen, frozen: tb === ta && vlen > 0}); }, 250); }, 60); }, 1500); }));
  ok(L4.n === 6 && L4.stack, 'L4 单目标6锁同id叠锁 (n=' + L4.n + ', stack=' + L4.stack + ')');
  ok(L4.vlen >= 4, 'L4b 松手→6发弹幕队列(首发±0.07s错峰, 60ms时待发' + L4.vlen + ')');
  ok(L4.frozen, 'L4c 暂停期间队列冻结 (t 不递减)');
  await sleep(700);                                /* 等 L4 残留弹幕全部出膛 */
  await ev(() => { player.mslVolley.length = 0; player.lockSlots.length = 0; enemies.length = 0; });
  const L5 = await page.evaluate(() => new Promise(res => {      /* 无目标→沿ta直射 (插桩计数, 不依赖弹数组存量) */
    enemies.length = 0; player.mslCd = 0; player.ta = 0;
    window.__dumbN = 0; window.__lockN = 0;
    const _fm = fireMissileAt;
    window.fireMissileAt = fireMissileAt = function(t) { if (t) window.__lockN++; else window.__dumbN++; return _fm(t); };
    keys.add('KeyL');
    setTimeout(() => { keys.delete('KeyL');
      setTimeout(() => { fireMissileAt = _fm; window.fireMissileAt = _fm;
        res({n: window.__dumbN, dumb: window.__lockN === 0 && window.__dumbN > 0}); }, 300); }, 1000); }));
  ok(L5.n >= 1 && L5.dumb, 'L5 无目标沿ta直射 dumb-fire (dumb=' + L5.n + ', 全部无lock=' + L5.dumb + ')');
  await ev(() => { player.mslVolley.length = 0; player.lockSlots.length = 0; RUN.hull = 'balanced'; });

  /* ---- M. W7 护盾: 同帧批量弹反合并 + 漩涡质量分级 ---- */
  const M1 = await page.evaluate(() => new Promise(res => {   /* 3发同帧撞盾: 全反弹+合并反馈 */
    enemies.length = 0; shots.length = 0;                     /* 清残留弹防污染 */
    player.inv = 0; player.shieldT = 0.42; player.shieldGrace = 0; player.shieldAge = 0.4;
    player.shieldFlash = 0; player._parry = null;
    const parry0 = STATS.parryN + STATS.parryP;
    for (let i = 0; i < 3; i++)                               /* 3发敌弹同距同速 → 同帧命中 */
      shot(player.x - 30, player.y - 6 + i * 6, 0, 300, 9, false, 'shell');
    let n = 0; const iv = setInterval(() => { const refl = shots.filter(s => s.friendly && s.refl).length;
      if (refl >= 3 || ++n > 18) { clearInterval(iv);
        res({refl, feedback: parry0 < STATS.parryN + STATS.parryP}); } }, 30); }));
  ok(M1.refl >= 3 && M1.feedback, 'M1 同帧3发全反弹+合并反馈 (refl=' + M1.refl + ', 反馈触发=' + M1.feedback + ')');
  const M2 = await ev(() => {                                 /* 漩涡质量分级: q2 粒子≫q0 */
    const c = q => { const n0 = parts.length; shieldSwirl(player.x, player.y, false, q);
      return parts.length - n0; };
    return {q2: c(2), q1: c(1), q0: c(0), perf: (() => { const n0 = parts.length; shieldSwirl(player.x, player.y, true, 2); return parts.length - n0; })()};
  });
  ok(M2.q2 >= 18 && M2.q0 <= 5 && M2.q1 < M2.q2, 'M2 漩涡分级 q2(' + M2.q2 + ')>q1(' + M2.q1 + ')>q0(' + M2.q0 + ')');
  ok(M2.perf > M2.q2, 'M2b Perfect 增强 (perf=' + M2.perf + ' > q2=' + M2.q2 + ')');
  await ev(() => { player.shieldT = 0; player._parry = null; shots.length = 0; });

  /* ---- N. W6平衡: 冲撞规则 + 坦克侧闪 ---- */
  const N1 = await page.evaluate(() => new Promise(res => {   /* 非BOSS: 55×atk 即杀 CRUSH! */
    const s = window.__open(); G.tp(s.x, s.y);
    const t = G.dummy('truck', s.x + 18, s.y); t.ramCd = 0; t.stun = 99; t.hp = t.maxHp = 40;   /* 40>旧40暴击线, <55 */
    player.bodyA = 0; player.vx = 100; player.vy = 0;
    let n = 0; const iv = setInterval(() => { if (t.dead || ++n > 8) { clearInterval(iv);
      res({dead: t.dead, hp: Math.round(t.hp)}); } }, 20); }));
  ok(N1.dead, 'N1 冲撞非BOSS即杀 CRUSH! (40hp 卡车被 55×atk 秒杀)');
  const N2 = await page.evaluate(() => new Promise(res => {   /* BOSS: 60×atk 大伤害+stagger, 永不即杀 */
    const s = window.__open(); G.tp(s.x, s.y);
    const b = G.dummy('tank', s.x + 18, s.y); b.boss = true; b.mass = 'fortress';   /* G.dummy 无boss参, 手动标记 */
    b.ramCd = 0; b.stun = 0; b.hp = b.maxHp = 80;
    player.bodyA = 0; player.vx = 100; player.vy = 0;
    let n = 0; const iv = setInterval(() => { if (b.hp < b.maxHp || ++n > 8) { clearInterval(iv);
      res({hp: Math.round(b.hp), stun: +(b.stun || 0).toFixed(2)}); } }, 20); }));
  ok(N2.hp >= 1 && N2.hp < 60 && N2.stun >= 1, 'N2 BOSS大伤害+stagger 永不即杀 (hp ' + N2.hp + ', stun ' + N2.stun + ')');
  const N3 = await page.evaluate(() => new Promise(res => {   /* 坦克侧闪: 来弹→前兆辉光→横移 (85%门控, 3次尝试) */
    SET.diff = 4;
    let tg = false, moved = 0, tries = 0;
    const attempt = () => { if (++tries > 3) { SET.diff = 2; enemies.length = 0; return res({tg, moved}); }
      const s = window.__open(); G.tp(s.x, s.y);
      const t = G.dummy('tank', s.x + 90, s.y); t.stun = 0; t.hp = t.maxHp = 9999;
      shot(s.x, s.y, 0, 320, 10, true, 'shell');
      let n = 0; const iv = setInterval(() => { n++;
        if (t.telegraph > 0) tg = true;
        moved = Math.max(moved, Math.round(Math.abs(t.kvx || 0) + Math.abs(t.kvy || 0)));
        if (n > 36) { clearInterval(iv); t.dead = true; enemies.length = 0; attempt(); } }, 25); };
    attempt();
  }));
  ok(N3.tg && N3.moved > 60, 'N3 坦克侧闪: 前兆辉光+横移击退 (tg=' + N3.tg + ', kv=' + N3.moved + ')');

  /* ---- O. W9-B 补齐: MG 击杀节奏 + 静态零 p.a ---- */
  const O1 = await page.evaluate(() => new Promise(res => {   /* MG 单杀 truck ≥1.2s (削玩家后节奏) */
    RUN.hull = 'balanced'; RUN.up = {hp: 0, spd: 0, atk: 0, def: 0, cdr: 0}; RUN.eq = {armor: 0, track: 0, fire: 0, comp: 0};
    const s = window.__open(); G.tp(s.x, s.y);
    const t = G.dummy('truck', s.x + 60, s.y); t.stun = 99; t.kvx = 0; t.kvy = 0;
    player.ta = 0; player.bodyA = 0;
    keys.add('KeyJ'); const t0 = performance.now();
    const iv = setInterval(() => { if (t.dead) { clearInterval(iv); keys.delete('KeyJ');
        res({ms: Math.round(performance.now() - t0), hp: t.maxHp}); } }, 50); }));
  ok(O1.ms >= 1100 && O1.ms <= 4000, 'O1 MG 击杀节奏 1.1-4s (' + O1.ms + 'ms, hp' + O1.hp.toFixed(1) + ' — 本关cfg×难度后血量, 非秒杀)');

  /* ---- P. W9-C 交互: 双杆+武器钮同按 (三输入通道并发) ---- */
  await ev(() => { SET.touch = 'on'; });
  await sleep(250);   /* 触屏层显示稳定(零尺寸会 NaN, 见 G3 教训) */
  const P1 = await page.evaluate(() => {          /* 左杆驱动 + 右杆瞄准 + 机枪同时 */
    const jl = document.getElementById('joy'), jr = document.getElementById('rjoy');
    const rl = jl.getBoundingClientRect(), rr = jr.getBoundingClientRect();
    jl.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, pointerId: 51,
      clientX: rl.left + rl.width / 2, clientY: rl.top + rl.height / 2 - rl.width * 0.35}));
    jr.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, pointerId: 52,
      clientX: rr.left + rr.width / 2 + rr.width * 0.3, clientY: rr.top + rr.height / 2}));
    keys.add('KeyJ');
    return true; });
  await sleep(420);
  const P1r = await ev(() => {
    const m = shots.filter(x => x.friendly && x.kind === 'mg').length;
    const r = {vy: Math.round(player.vy), ta: +player.ta.toFixed(2), mg: m};
    document.getElementById('joy').dispatchEvent(new PointerEvent('pointerup', {bubbles: true, pointerId: 51}));
    document.getElementById('rjoy').dispatchEvent(new PointerEvent('pointerup', {bubbles: true, pointerId: 52}));
    keys.delete('KeyJ');
    return r; });
  await ev(() => { SET.touch = 'auto'; });
  ok(P1 && P1r.vy < -30 && Math.abs(P1r.ta) < 0.2 && P1r.mg > 0,
     'P1 双杆+武器并发: 左杆北移(vy' + P1r.vy + ') 右杆瞄准东(ta' + P1r.ta + ') 机枪' + P1r.mg + '发');

  log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
  await browser.close();
  log(fails === 0 && errors.length === 0 ? '=== V18 (G0-5+W0) ALL PASS ===' : '=== ' + fails + ' FAILS ===');
  process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
