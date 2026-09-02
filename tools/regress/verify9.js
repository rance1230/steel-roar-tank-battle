/* vNext Combat Foundation 专项: DamageEvent归因 / Parry分级 / Breach链 / 连锁上限 / mass */
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
  await page.goto('file:///Volumes/vol1/像素小游戏/index.html'); await sleep(1000);
  /* v1.3+ 新游戏菜单链: 标题→hull→wingman→ctrl→intro→play (对齐 tanksmoke) */
  await page.evaluate(() => { window.G.start(); menuActivate(); menuActivate(); onKeyPress('Enter'); });
  await sleep(3200);
  const waitLock = async () => { for (let i = 0; i < 25; i++) { if (await page.evaluate(() => !!player.breach)) return true; await sleep(30); } return false; };
  const setup = `() => { G.dbg.god = true; G.dbg.lab = true; enemies.length = 0; shots.length = 0; pickups.length = 0;
      parts.length = 0; floats.length = 0; COMBO.n = 0; COMBO.t = 0; planes.length=0; bombs.length=0;
      cfg.quota=1; ST.spawnedN=1; ST.bossSpawned=true; ST.bossWarn=-1;
      terr.m.fill(0); G.tp(240, 135); player.bodyA = 0; player.ta = 0; player.vx = 0; player.vy = 0; player.breach = null; }`;
  await page.evaluate('(' + setup + ')()'); await sleep(200);

  // 1) DamageEvent 归因: 机枪击杀 = 命中+1 + 击破+1
  await page.evaluate(() => { const e = G.dummy('truck', 400, 135); e.stun = 99; hurtEnemy(e, 999, 'machinegun'); });
  await sleep(200);
  let info = await page.evaluate(() => G.info());
  let stats = await page.evaluate(() => G.stats());
  ok(info.combo === 2, '机枪击杀归因 命中+1+击破+1 (combo=' + info.combo + ')');
  ok((stats.dmg.machinegun || 0) >= 999, 'STATS按cause统计伤害 (machinegun=' + stats.dmg.machinegun + ')');

  // 2) 普通Parry: ×2伤害/×1.7速度, STATS.parryN
  await page.evaluate('(' + setup + ')()');
  const sN = await page.evaluate(() => G.parryProbe(false));
  await sleep(400);
  let st = await page.evaluate(() => G.stats());
  const refl = await page.evaluate(() => shots.find(x => x.refl));
  ok(st.parryN >= 1, '普通Parry计数 (parryN=' + st.parryN + ')');
  ok(refl && refl.dmg === 20 && Math.abs(refl.spd - 255) < 1, '普通反弹 ×2伤害 ×1.7速度 (dmg=' + (refl && refl.dmg) + ',spd=' + (refl && Math.round(refl.spd)) + ')');

  // 3) Perfect Parry: ×2.5伤害, combo grace 保持
  await page.evaluate('(' + setup + ')()');
  await page.evaluate(() => { COMBO.n = 5; COMBO.t = 0.3; });
  await page.evaluate(() => G.parryProbe(true));
  await sleep(400);
  st = await page.evaluate(() => G.stats());
  const sP = await page.evaluate(() => shots.find(x => x.refl));
  info = await page.evaluate(() => G.info());
  ok(st.parryP >= 1, 'Perfect Parry计数 (parryP=' + st.parryP + ')');
  ok(sP && sP.dmg === 25, 'Perfect反弹 ×2.5伤害 (dmg=' + (sP && sP.dmg) + ')');
  ok(info.comboT >= 0.7, 'Perfect Parry延长combo grace (t=' + info.comboT + 's)');

  // 4) Breach 全链: 击杀路径(击飞目标死亡→连锁爆炸)
  await page.evaluate('(' + setup + ')()');
  const pre = await page.evaluate(() => new Promise(res => {   // 页内原子轮询: 桥往返>0.34s保持窗会读到释放后状态
    player.bodyA = 0; player.vx = 170; player.vy = 0;              // v1.8 W2: bodyA 迁移; 先给速度同帧生成目标 → 首帧即高速接触
    const t1 = G.dummy('tank', 258, 135); t1.stun = 99; t1.hp = t1.maxHp = 20;   // v1.8 W6平衡: 敌耐久增强, 测试用低血目标保证击杀路径(与平衡数值解耦)
    const t3 = G.dummy('truck', 290, 130); t3.stun = 99;          // 连锁爆炸受害者
    let n = 0; const iv = setInterval(() => {
      if ((player.breach && player.vx === 0 && player.vy === 0) || ++n > 90) { clearInterval(iv); res({lock: !!player.breach, locks: STATS.breachLocks, vx: player.vx}); } }, 16);   /* 首帧仅×0.05, 保持帧才归零 */
  }));
  const locked4 = pre.lock;
  ok(locked4 && pre.locks >= 1, 'Breach锁定 (locks=' + pre.locks + ')');
  ok(pre.vx === 0, '锁定期间玩家速度归零');
  const post = await page.evaluate(() => {          // 同步零距离炮击: 消除按键往返竞态
    breachFire(player.breach.e, player.breach.stagger);
    return { fires: STATS.breachFires, chain: STATS.chainBoom,
      alive: enemies.filter(e => !e.dead).map(e => ({k: e.kind, hp: Math.round(e.hp), max: Math.round(e.maxHp)})),
      combo: COMBO.n };
  });
  await sleep(150);
  await page.screenshot({path: '/tmp/tankshots9/breach-chain.png'});
  ok(post.fires >= 1, '零距离炮击发动 (fires=' + post.fires + ')');
  ok(post.chain >= 1, '击杀触发连锁爆炸 (chain=' + post.chain + ')');
  ok(post.alive.length === 1 && post.alive[0].hp < post.alive[0].max, '目标阵亡+旁及单位受伤 ' + JSON.stringify(post.alive));
  ok(post.combo >= 5, 'Breach全链连击≥5 (combo=' + post.combo + ')');
  await page.screenshot({path: '/tmp/tankshots9/breach-chain.png'});

  // 5) 击飞路径: 高血量目标存活→飞行→敌敌碰撞
  await page.evaluate('(' + setup + ')()');
  await page.evaluate(() => {
    player.bodyA = 0; player.vx = 170; player.vy = 0;
    const t1 = G.dummy('tank', 258, 135); t1.stun = 99; t1.hp = t1.maxHp = 600;
    const t2 = G.dummy('tank', 340, 135); t2.stun = 99; t2.hp = t2.maxHp = 600;  // 飞行路径上的受害者
  });
  await waitLock();
  await page.evaluate(() => { breachFire(player.breach.e, player.breach.stagger); });
  await sleep(120);
  await page.screenshot({path: '/tmp/tankshots9/breach-launch.png'});
  await sleep(600);
  st = await page.evaluate(() => G.stats());
  const fly = await page.evaluate(() => ({
    knock: G.stats().knockHits,
    units: enemies.map(e => ({hp: Math.round(e.hp), flying: !!e.flying})) }));
  ok(fly.knock >= 1, '被击飞敌军撞友军 (knockHits=' + fly.knock + ')');
  ok(fly.units.length === 2 && fly.units.every(u => u.hp < 600) && !fly.units.some(u => u.flying),
     '敌敌碰撞双方受伤且飞行终止 ' + JSON.stringify(fly.units));

  // 6) Fortress(Boss): 不可击飞, 改为大幅硬直
  await page.evaluate('(' + setup + ')()');
  await page.evaluate(() => { ST.bossSpawned=false; ST.bossWarn=0; G.boss(); });
  await sleep(2600);
  await page.evaluate(() => {           // 直接设定双方位置: 排除Boss提前走近消耗ramCd的随机性
    const b = enemies.find(e => e.boss);
    b.x = b.ox = 400; b.y = b.oy = 135; b.stun = 0; b.fireT = 99; b.ramCd = 0;
    G.tp(374, 135); player.bodyA = 0; player.vx = 170; player.vy = 0;
  });
  await waitLock();
  await page.evaluate(() => { breachFire(player.breach.e, player.breach.stagger); });
  await sleep(400);
  st = await page.evaluate(() => G.stats());
  const bs = await page.evaluate(() => { const b = enemies.find(e => e.boss);
    return {stag: G.stats().breachStaggers, stun: b ? +b.stun.toFixed(2) : -1, fly: b ? !!b.flying : null}; });
  ok(bs.stag >= 1, 'Boss被Breach硬直 (staggers=' + bs.stag + ')');
  ok(bs.fly === false, 'Boss不可被击飞');

  // 7) 连锁深度上限: depth>3 不再造成伤害
  await page.evaluate('(' + setup + ')()');
  const deep = await page.evaluate(() => {
    const e = G.dummy('truck', 400, 135); e.stun = 99;
    const hp0 = e.hp;
    explodeAt(400, 135, 60, 999, false, 'chainExplosion', 4);   // 超上限
    const hpDeep = e.hp;
    const e2 = G.dummy('truck', 500, 135); e2.stun = 99;
    explodeAt(500, 135, 60, 50, false, 'chainExplosion', 3);    // 恰在上限内
    return {hp0, hpDeep, e2hurt: e2.hp < e2.maxHp};
  });
  ok(deep.hpDeep === deep.hp0, 'depth=4 超过连锁上限不造成伤害');
  ok(deep.e2hurt, 'depth=3 上限内正常伤害');

  // 8) HITSTOP 冻结逻辑(Perfect Parry后逻辑帧短暂停滞)
  await page.evaluate('(' + setup + ')()');
  await page.evaluate(() => G.parryProbe(true));
  const hs = await page.evaluate(() => G.stats().hitstopN >= 2);   /* 普通+完美各一次 */
  ok(hs, 'Parry触发顿帧 (hitstopN=' + await page.evaluate(() => G.stats().hitstopN) + ')');

  log('ERRORS:', errors.length ? errors.slice(0, 3) : 'none');
  await browser.close();
  log(fails === 0 && errors.length === 0 ? '=== COMBAT PASS ===' : '=== ' + fails + ' FAILS ===');
  process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
