# CONTROL_CONTRACT_v1.8 — 操控/战斗核心契约（冻结版）

> 本文件是 v1.8「核心驾驶与战斗系统 2.0」的设计契约与版本化基线。`BASELINE.md` 原样保留作历史事实；
> 旧回归套件（tools/regress/verify6-9、tanksmoke、tools/tankshot）中与本契约冲突的断言按 §8 标注 SUPERSEDED，不计回退。
> 评审三轮合并冻结（2026-09-03）。scope 封闭：不加雷达/僚机战术/新敌种/剧情。

## §1 版本化基线：继承项与有意替代项

**继承项**（回退=BUG）：WASD 移动；左摇杆移动；D-pad/菜单导航；三端全部菜单可操作；手柄改键（v1.7.2）；触屏菜单点按+最近目标吸附；存档/NG+；三语言；难度/音量设置；状态机全部转换；秘籍。

**有意替代项**（旧断言 SUPERSEDED，按本契约新断言验收）：

| 项 | 旧基线 | v1.8 契约 | 受影响旧断言 |
|---|---|---|---|
| Play 态方向键 | 移动 | **瞄准**（8向数字量） | verify6 #12 前 WASD/方向键并列移动的隐含断言 |
| 松键刹停 | 0.2s 摩擦近似急停（verify8 `s0<15`） | 动量制动按速度插值，满速 0.3s 后速度>30% | verify8 #2 松手摩擦刹停 |
| 11 按钮触屏 | D-pad 4 向钮（v1.4 前） | 7 钮+摇杆环（v1.5 已替代，verify7 已重写） | 原 verify7 |
| 重装护盾永久覆盖 | cd<dur 可 100% 覆盖 | §4 硬不变量禁止 | （无旧断言，bug 修复） |
| 导弹 | mslN 固定数量松发即出 | 多锁定+数量∝蓄力+真冷却+弹幕队列 | verify6 #15（松发即出→队列出膛，断言更新为"松发后进入队列"） |
| 伤害 atk² | explodeAt 二次乘算 | §3 只乘一次 | （无旧断言依赖此 bug） |

## §2 移动数学契约（路线 B：惯性 twin-stick）

左摇杆 = **desired velocity**（保留 v3.2 的 360° 全向移动，不做汽车式"转车头再走"）：

```
desiredV = moveVec × maxSpeed × 地形速度乘数
velocity    以 accel 朝 desiredV 逼近（每帧 clamp 增量）
bodyA       以 turnRate 朝 moveAngle 平滑转动（无输入时不转）
velocity    投影到 body frame: forwardV = v·facing, lateralV = v·lateral
lateralV    以 lateralGrip 指数衰减 → 车身跟不上运动方向即侧滑(slip)
制动        松键时 brakeDrag 按当前速度插值（低速快停、高速长滑），禁止瞬清
```

- slip 幅度 > 阈值 → 甩尾表现（履带印加浓 + 侧向扬尘/溅水）；冰面 grip×0.3 / 泥沼 speed×0.55 / 河流 grip×0.6
- 冲撞判定（速度+朝向门控）不变；**冲量只改 vx/vy，位移统一经 moveCircEx**（禁止 `x+=impulse` 直写坐标）
- 状态字段：`p.bodyA / p.ta / p.vx,vy / p.moveAx,Ay`；**W2 完成后玩家路径禁止出现 `p.a`**（enemy 保留 `e.a`）；QA 静态检查
- 炮塔松手规则：**永久保持最后瞄准方向**，新瞄准输入才更新（twin-stick 标准）；`p.ta` 以 `turret.rate` 平滑

## §3 DAMAGE_MATRIX（cause × statPolicy，从代码枚举冻结）

DamageEvent 为唯一伤害真相源：`{cause, rawDamage, statPolicy}` → resolve 统一应用；**stat 乘算在事件形成时恰好执行一次**；effects.js 只管表现不参与计算。

运行时真实 cause 全表（applyDamage/hurtEnemy 调用点枚举；CAUSE_COMBO 中 `wingman/lightning/perfectParry` 为遗留未用，冻结为 UNUSED）：

| cause | 来源 | PlayerAtk | Difficulty | 目标减伤 | 备注 |
|---|---|:---:|:---:|:---:|---|
| machinegun | 玩家机枪+僚机机枪(kind mg) | × | — | — | 僚机=装备延伸，**保持吃玩家 atk**（现状 3×atk×wing.fire） |
| cannon | 主炮直击 | × | — | — | |
| shot | 主炮AOE/空袭击中/反弹probe/闪电惩罚(25flat)/调试击杀 | AoE部分× | — | — | 闪电惩罚为环境 flat，**不吃 atk** |
| missile | 导弹命中 | × | — | — | |
| explosion | explodeAt 默认 | × | — | — | |
| chainExplosion | 连锁爆炸 | × | — | — | 16×atk，深度≤3 |
| ram | 接触冲撞 | × | — | — | v1.8: 暴击×55 atk，非BOSS≤血线即杀，BOSS 60×atk 永不即杀 |
| breach | Breach 零距炮 | × | — | — | 24×atk×1.35×hull.breach |
| knockback | 飞行撞墙/撞友军自伤 | ×(撞墙8flat不吃) | — | — | 撞墙自伤 8 flat |
| collision | 被击飞者撞及友军 | × | — | — | 16×atk |
| reflect | 反弹命中 | **×否** | — | — | **威力=来袭伤害×格挡倍率(2/2.5)，不吃玩家atk**（现状即如此，冻结）；impact 记名修复归因 |
| 敌方伤害 | 敌弹/接触 | **否** | — | 玩家def×taken | ×(1-st.def)×h.taken，等级/周目缩放 |
| UNUSED | wingman/lightning/perfectParry | — | — | — | 表内遗留，不新增调用 |

实现注记（W6 落地）：管线 `DMG_ATK` 表逐 cause 声明 statPolicy，`applyDamage(e,rawDamage,cause)` 统一乘算恰好一次；空袭炸弹拆为独立 cause `airstrike`（atk×，行为=原 explodeAt 隐式缩放，combo 权重 0 同 shot）；`shot` 冻结为 flat（probe/闪电惩罚/调试击杀）。

W9 两类断言：ATK-scaled cause 在 atk=1 vs 2 → 伤害比 2.0±0.05；ATK-independent（reflect/敌方/闪电flat/撞墙flat）→ 比 1.0±0.05。

## §4 冷却契约

```
cdMul      = clamp(1/(1+0.04×up.cdr), 0.55, 1)          // W5
技能CD     (导弹/空袭/护盾): interval × cdMul             // 全额
武器CD     (机枪/主炮):     interval × (0.65+0.35×cdMul)  // 弱化, 最高 ×1.19 射速
护盾硬不变量(机械规则): effectiveShieldCd = max(baseCd×cdMul, dur+grace+0.25)
```

W9 断言：cdr=0/10/30 × 三机体，effectiveShieldCd ≥ dur+grace+0.25。

## §5 固定时间原则（收窄措辞）

禁止 setTimeout/setInterval/Date.now/performance.now **直接改变 gameplay 模拟状态**（延迟生成实体/CD计时/弹幕出膛）。允许：引擎 accumulator/rAF/性能测量、UI toast、非状态性 SFX 序列。弹幕错峰出膛 = `p.mslVolley=[{t,targetId}]` 在 fixed update 递减。

## §6 实体身份

每关 `nextEnemyId=1`；spawnEnemy/spawnBoss 赋 `e.id=nextEnemyId++`，关内不复用；关卡重开重置（旧 locks/volley 全清）。导弹锁定/弹幕队列引用 **enemyId**，不长期持对象引用；发射时 resolve 失效目标→最近 candidate；无有效目标→沿 p.ta 直射（写死）。

## §7 存档迁移

```
RUN.up = Object.assign({hp:0,spd:0,atk:0,def:0,cdr:0}, saved.up||{})   // loadRun/retry/lvlSnap/NG+ 全位点
```

断言：v1.7/v1.3 旧 trSave（无 cdr）→ cdr=0、其余点数/装备/周目不变；refundAll 点数守恒。

## §8 版本化验收规则

- 旧套件除 §1 SUPERSEDED 项必须全 PASS；SUPERSEDED 项由本契约对应新断言替代验收
- 新断言归属：W9 Layer B 专项套件（tools/regress/verify18.js，随各 W 落地逐步补充）
