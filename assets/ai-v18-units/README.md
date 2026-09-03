# V1.8 战斗单位分层重设计包

状态：`candidate-awaiting-review`（三款玩家坦克已生成、已切出可用透明层，暂未接入游戏代码）。

本包将《V1.8视觉配套优化.md》的单位要求和 V15 资产的俯视方向规范合并为一个可执行契约：

> 底盘负责移动朝向，使用 V15 风格的 16 方向帧；炮塔是独立层，以中心 pivot 按任意角度连续旋转。

这不是把炮塔再做一套 16 帧。后续 agent 必须使用独立炮塔层的 `ctx.rotate(ta)`，否则仍然会回到旧的离散选帧问题。

## 包内内容

| 目录 | 内容 | 是否运行时输入 |
|---|---|---|
| `source/canonical-pairs/` | 三款坦克的原始正典对图：左底盘、右炮塔，保留用于人工评审 | 否 |
| `processed/layers/<unit>/` | 已去除黑色底、对齐 pivot 的 512px 透明底盘/炮塔层 | 可作为调试源 |
| `runtime/hulls/` | 4 x 4、共 16 帧的 1024px 底盘图集，每格 256px | 是 |
| `runtime/turrets/` | 中心 pivot 固定的 512px 炮塔母图，可连续旋转 | 是 |
| `preview/` | 正典对图、16 向底盘、360 度炮塔预览 | 否 |

预览图：[unit-modular-contact-sheet.png](/Volumes/vol1/像素小游戏/assets/ai-v18-units/preview/unit-modular-contact-sheet.png)。

## 三款坦克设计定位

| key | 设计识别 | 主要特征 | 颜色边界 |
|---|---|---|---|
| `assault` | 快速突击型 | 窄体、低矮、单长炮、橙锈装甲、青色 IFF 灯 | 橙锈是职业色；友方仍以 `#35C8FF` 识别 |
| `balanced` | 均衡指挥型 | 中型矩形底盘、指挥天线、环形指挥炮塔、钢蓝装甲 | 钢蓝是职业色；不可代替阵营色 |
| `heavy` | 重装堡垒型 | 宽体、双履带、八角炮座、双炮、铁黑装甲、琥珀能量环 | 铁黑/琥珀是职业色；友方仍保留青色 IFF |

三款单位均为同一套俯视 HD-2D 质感：无地平线、无三分之四角度、无文字/Logo、无烘焙 HUD。尺寸可随运行时 `w` 缩放，逻辑碰撞半径和伤害数值不因图片变化。

## 运行时契约

### 底盘

- 图集：`runtime/hulls/<key>-hull-16dir.png`。
- 图集尺寸：1024 x 1024，4 x 4 格，每格 256 x 256，中心 pivot 为格中心 `(128,128)`。
- 16 帧是每 22.5 度顺时针一帧，帧的实际零度由 `manifest.json` 的 `baseAngleDeg` 给出。
- 由于三款正典底盘原本的车头方向不同，禁止假设三款 `frame-00` 都是同一罗盘方向。必须读取 manifest 中的 `frameAnglesDeg`。
- 车体方向用 `bodyA` 就近取帧；帧间不再对底盘做额外旋转，避免像素边缘抖动。

建议绘制逻辑：

```js
const frame = nearestAngleIndex(bodyA, spec.frameAnglesDeg);
ctx.drawImage(hullSheet,
  (frame % 4) * 256, Math.floor(frame / 4) * 256, 256, 256,
  x - w / 2, y - w / 2, w, w);
```

### 炮塔

- 母图：`runtime/turrets/<key>-turret-canonical.png`。
- 尺寸：512 x 512 RGBA，视觉 pivot 固定在 `(256,256)`。
- 正典炮管朝画面右方，即 `zeroAngle = 0` 为东向。
- 用 `ta` 做连续旋转，角度范围允许任意实数并在绘制前归一化到 `0..2π`。
- 炮塔必须使用独立 `save -> translate -> rotate -> drawImage -> restore`，不能从底盘帧中取炮塔。

建议绘制逻辑：

```js
ctx.save();
ctx.translate(x, y);
ctx.rotate(normalizeAngle(ta));
ctx.drawImage(turretImage, -w / 2, -w / 2, w, w);
ctx.restore();
```

图像中心存在 pivot 视觉标记，但不代表需要在代码里画第二个圆盘。底盘中心 socket 和炮塔中心必须重合；若炮管旋转时出现圆周抖动，先检查 drawImage 的中心、图片缩放和 `ta` 是否被重复加上车体角度。

### 绘制层顺序

1. 地形和单位阴影。
2. 底盘 16 向帧。
3. 独立炮塔连续旋转层。
4. IFF 灯、护盾、受击闪白、残影等代码效果。
5. 生命条、锁定节点和命中飘字。

炮塔朝向应由瞄准方向 `ta` 决定，底盘朝向应由移动/车体方向 `bodyA` 决定；两者不应互相覆盖。

## 接入 agent 的明确指示

### 1. 数据与加载

建议新增 `src/data/v18_units.data.js` 和 `src/game/v18units.js`，沿用当前 `src/game/assetpipeline.js` 的 data URL / manifest 思路，使 `index.html`、本地开发、Pages 和 Android WebView 共用同一份资源。

建议脚本位置：

1. `src/data/v18.data.js`
2. `src/data/v18_units.data.js`
3. `src/game/v18units.js`
4. `src/game/v15art.js` 的单位绘制接管点

不要直接在 `src/game/render.js` 内硬编码多组文件路径。不要删除或覆盖：

- `assets/ai-v15-topdown/`
- `assets/ai-v18-layers/`
- `src/data/v15.data.js`
- `src/data/v18.data.js`

新资产接入失败时必须逐单位回退到当前 V18，再回退到 V15；不得因单张新图加载失败而隐藏玩家或阻断开局。

### 2. 替换边界

第一阶段只替换玩家三款坦克的绘制：`assault`、`balanced`、`heavy`。保持以下内容不变：

- `bodyA`、`ta`、碰撞半径、血量、武器参数和技能逻辑。
- 现有 V15 地形、关卡、敌军 AI、僚机编队和 Boss 行为。
- 现有残影、护盾、受击、锁定和命中反馈的玩法时机。

僚机和敌军当前继续使用 V15 的 16 向整图，因为它们已有一致的正交俯视资产。不要强行把僚机拆成炮塔层：只有实际存在独立瞄准轴的单位才采用本包的分层契约。

### 3. 其他战斗单位的后续规则

- `wingman_assault`：V15 16 向整机；若后续加入独立导弹舱，再只拆出武器舱层。
- `wingman_guard`：V15 16 向整机；护盾球、发光环和状态均由代码绘制。
- `wingman_flex`：V15 16 向整机；传感器/武器挂点是否独立旋转，先以玩法数据确认。
- `enemy tank`：后续若需要独立炮塔，复制“敌方红色 IFF + 本包两层结构”，不要复用友方职业色。
- `enemy carrier`、`boss landship`、`support aircraft`：继续使用 V15 16 向整机；Boss 多炮口优先做代码挂点或独立武器层，不制作大量整机角度图片。

后续批次若重做这些单位，必须继续使用 256px 单元、统一光向、统一 pivot 和 V15 方向顺序，不能重新引入斜视立绘。

## 评审重点

- [ ] 三款底盘在 0、45、90、135、180、225、270、315 度移动时，形状和车头方向正确。
- [ ] 炮塔在 0-360 度连续转动时，pivot 不漂移、不裁切，炮管长度稳定。
- [ ] `bodyA` 和 `ta` 分离：车体转弯时炮塔不被强制对齐，炮塔瞄准时底盘不跟着旋转。
- [ ] 三款职业特征在 64-128px 战斗尺寸下仍可区分。
- [ ] 友方青色 IFF、敌方红色警示和职业色没有混淆。
- [ ] 战斗单位不出现透明黑底、棋盘格、白边或生成背景残留。
- [ ] 现有 V15 僚机、敌军、Boss 与新坦克同屏时，光照、描边和尺度不冲突。
- [ ] 选车预览可同时显示车体方向和炮塔独立方向。
- [ ] Pages、本地 `index.html`、Android WebView 均能加载新资源；失败回退可见且不阻断开局。
- [ ] 记录新图解码峰值；战斗页不同时常驻标题/整备大图。

## 生成与处理说明

三张正典对图使用内置 `imagegen.imagegen`，分别以现有 `assets/ai-v18-layers/source/*_pair.png` 为设计参考；随后用确定性 Pillow 处理：去除近黑背景、保留底盘中心 socket、对齐炮塔中心 pivot、生成 16 方向底盘图集和 360 度预览。原始对图保存在 `source/canonical-pairs/`，处理后的可接入文件以 `manifest.json` 为准。

本包是“新战斗单位候选设计”，不是已经完成的运行时接入。评审通过后，下一位 agent 才能修改数据模块和绘制接管层。
