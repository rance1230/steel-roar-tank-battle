# V1.8 日系机甲战斗单位素材包

状态：`wired-v1.9.0`（已接入：`tools/assemble_v18_mecha_data.py` → `src/data/v18_mecha.data.js` + `src/game/v18mecha.js`，V18M 优先渲染，旧 V18 分层与 v15 整图逐级回退；回归门 verify6/7/8/18+tankshot 全绿）。

本包是上一版战斗单位素材的重新设计候选，参考 `assets/ai-v15-topdown/` 的严格俯视、16 方向和 256px 单元规范。视觉上升级为原创日系真实系机甲风格：夸张轮廓、推进器、装甲挂点、能量环和机械分层，但不复刻任何具体高达机体、Logo、标志或专属部件。

最重要的技术契约：

> 底盘使用 V15 风格 16 方向图集；炮塔是独立透明层，以中心 pivot 按 `ta` 连续旋转 360 度。

上一版 `assets/ai-v18-units/` 保留不动。本包是新的评审候选，接入 agent 应以本目录为准，评审通过后再替换玩家三款机体。

## 文件结构

| 目录 | 内容 | 用途 |
|---|---|---|
| `source/canonical-pairs/` | 三张原始正典对图，左侧底盘、右侧独立炮塔 | 人工评审，不直接加载 |
| `processed/layers/<key>/` | 512px RGBA 底盘与炮塔透明层 | 调试、重新烘焙和 pivot 核对 |
| `runtime/hulls/` | 4 x 4、16 方向底盘图集，每格 256px | 战斗运行时 |
| `runtime/turrets/` | 512px RGBA 独立炮塔母图 | 战斗运行时连续旋转 |
| `runtime/assembled/` | 底盘与炮塔同向拼装的 16 方向整机图集 | 资源失败回退、人工对比，不作为首选绘制路径 |
| `preview/` | 正典、16 方向、拼装和 360 旋转检查图 | 人工评审 |

总预览：[mecha-contact-sheet.png](/Volumes/vol1/像素小游戏/assets/ai-v18-mecha/preview/mecha-contact-sheet.png)。

## 三台我方机体

| key | 机体定位 | 主色系 | 设计语言 |
|---|---|---|---|
| `assault` | 高机动突击机 | 橙锈 + 金色 + 冷青 IFF | 尖锐装甲、双后推力器、单长炮，突出速度和攻击性 |
| `balanced` | 均衡指挥机 | 钢蓝 + 冷白 + 冷青 IFF | 指挥传感器、分区装甲、环形能量炮塔，突出可靠和识别度 |
| `heavy` | 重装堡垒机 | 铁黑 + 石墨 + 冷青 IFF + 琥珀能量 | 宽履带、厚重护盾、八角炮座、双炮，突出防御和火力 |

三台机体的底盘 canonical 车头都朝南，即屏幕坐标角度 `90°`；上方是推进器/后部。三款共用这一方向基准，接入时不得再分别为 assault、balanced、heavy 添加不同的角度偏移。

## 切图和旋转契约

### 底盘 16 方向

- 文件：`runtime/hulls/<key>-hull-16dir.png`。
- 尺寸：1024 x 1024 RGBA，4 x 4 格，每格 256 x 256。
- 格中心 pivot：`(128,128)`。
- `frame-00` 为车头南向 `90°`；之后每帧顺时针增加 `22.5°`。
- manifest 中的 `frameAnglesDeg` 是唯一角度真值，不要根据文件名猜方向。
- 保持 `bodyA` 的玩法和碰撞逻辑不变，只替换视觉绘制。

### 炮塔连续 360 度

- 文件：`runtime/turrets/<key>-turret-canonical.png`。
- 尺寸：512 x 512 RGBA。
- pivot：`(256,256)`；炮口 canonical 朝画面右方，即 `0° = east`。
- 不能用 `V18.frameIndex()` 为炮塔选最近帧；该函数只适用于旧版离散炮塔。
- 炮塔必须围绕 `(x,y)` 连续旋转，允许任意 `ta`，不限制为 16 个角度。

推荐绘制逻辑：

```js
const frame = nearestAngleIndex(bodyA, unit.frameAnglesDeg);
ctx.drawImage(unit.hullSheet,
  (frame % 4) * 256, Math.floor(frame / 4) * 256, 256, 256,
  x - w / 2, y - w / 2, w, w);

ctx.save();
ctx.translate(x, y);
ctx.rotate(normalizeAngle(ta));
ctx.drawImage(unit.turretImage, -w / 2, -w / 2, w, w);
ctx.restore();
```

炮塔朝向使用 `ta`，底盘朝向使用 `bodyA`。禁止把 `bodyA + ta` 叠加两次，也禁止在绘制炮塔前再次按底盘方向取帧。

## 给其他 agent 的接入步骤

1. 新增 `src/data/v18_mecha.data.js`，把 `manifest.json` 中的运行时 PNG 转为 data URL，或接入现有 `src/game/assetpipeline.js`。
2. 新增 `src/game/v18mecha.js`，只负责图像加载、方向选择、连续炮塔绘制和失败回退。
3. 把 `v18mecha.js` 放在 `v15art.js` 之后或由同一单位绘制接管层调用，确保旧 V18/V15 仍可作为 fallback。
4. 第一阶段只替换玩家 `assault`、`balanced`、`heavy`，不改变 `bodyA`、`ta`、碰撞、血量、武器和技能逻辑。
5. 选车预览、标题页、车库和战斗页都调用同一套底盘/炮塔绘制函数，避免预览图与实战图再次不一致。
6. 新资源加载失败时按“新 mecha -> 旧 V18 分层 -> V15 整机 -> 原程序化绘制”逐单位回退；不能因一张图失败而隐藏玩家或阻断开局。
7. `runtime/assembled/` 只用于 fallback 和 QA 对比，正常战斗优先使用底盘图集 + 独立炮塔。

建议脚本顺序：

1. `src/data/v18.data.js`
2. `src/data/v18_mecha.data.js`
3. `src/game/v18mecha.js`
4. `src/game/v15art.js` 的玩家绘制接管点

不要覆盖或删除：

- `assets/ai-v15-topdown/`
- `assets/ai-v18-layers/`
- `assets/ai-v18-units/`
- `src/data/v15.data.js`
- `src/data/v18.data.js`

## 其他战斗单位处理边界

本包先解决玩家三台需要独立炮塔瞄准的核心机体。已有 V15 正交俯视资产的僚机、敌军、Boss 和支援飞机暂时继续使用原 16 方向整机：

- 僚机只有在玩法上出现独立瞄准轴时，才拆出独立武器层。
- 普通敌军坦克如果后续也需要 360 度炮塔，应复制本包的“红色 IFF + 独立炮塔”结构，而不是直接使用友方职业色。
- 敌方运输车、Boss 陆战舰和空袭飞机继续保持 V15 整机图集；Boss 多炮口优先用武器挂点和代码效果表达。
- 所有新增单位必须沿用 256px 单元、统一光向、中心 pivot、严格俯视和无地平线规则。

## 视觉和性能验收

- [ ] 0、45、90、135、180、225、270、315 度下，三台底盘车头和推进器方向正确。
- [ ] 炮塔从 0 到 360 度连续拖动时 pivot 不漂移、双炮/长炮不裁切。
- [ ] 车体旋转时炮塔保持自己的 `ta`；炮塔旋转时车体不跟随转动。
- [ ] 64-128px 战斗尺寸下，三种机体仍可一眼区分。
- [ ] 橙锈、钢蓝、铁黑是职业色；友方识别优先使用冷青 IFF，敌方使用红色。
- [ ] 透明边缘无黑色底、棋盘格、白边和孤立残线。
- [ ] 新三台机体与 V15 僚机、敌军和 Boss 同屏时，尺度、描边和光照不冲突。
- [ ] 标题页/车库预览与战斗绘制使用同一套实时图层。
- [ ] 本地 `index.html`、Pages 和 Android WebView 都能加载；fallback 可验证。
- [ ] 标题和整备大图不在战斗页常驻，记录新素材解码峰值。

## 生成与版权边界

本批使用内置 `imagegen.imagegen`，以现有 V15 玩家单位和上一版 V18 分层对图为参考，再用 Pillow 进行黑底去除、中心 pivot 对齐、底盘 16 方向旋转合成和炮塔 360 度预览。视觉要求是原创日系真实系机甲语言，不复制具体 Gundam 机体、Logo、标志性外形或命名元素。

本目录是候选素材包，不代表已经接入或发布。评审通过后，其他 agent 才能按本文件修改游戏数据和绘制接管层。
