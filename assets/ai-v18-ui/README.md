# V1.8 UI 视觉资产包

状态：`wired-v1.8.1`（已按本 README 接入：`tools/assemble_v18_ui.py` → `src/data/v18_ui.data.js` + `src/game/v18ui.js`，桌面/Pages/Android 单文件构建共用同一份内联资源；标题图保留 `assets/stage-intros/title-bg.webp` 回退链；GLM-5.3-Flash 视觉 QA 四轮整改后 19/19 ALL PASS，证据 `output/visual/v18ui/`，记录见 CHANGELOG v1.8.1）。

本目录依据 `/Volumes/vol1/像素小游戏/V1.8视觉配套优化.md` 生成，面向标题页、车库/整备页、战斗 HUD 和单位徽章。

玩家三款坦克的最新日系机甲底盘/独立炮塔资产另见：[V1.8 日系机甲战斗单位素材包](../ai-v18-mecha/README.md)；上一版分层候选仍保留在 `../ai-v18-units/`。

## 资产清单

| ID | 文件 | 主尺寸 | 用途 |
|---|---|---:|---|
| `UI-TITLE` | `source/ui-title.png` | 1536 x 864 RGB | 标题/开始画面背景；左侧留给标题和菜单，右下为三种友方坦克 |
| `UI-FRM-BASE` | `source/ui-frame-base.png` | 1024 x 1024 RGBA | 中性石墨银 UI 母框；9-slice，不含面板填充 |
| `UI-ICO-MASTER` | `source/ui-ico-master.png` | 1024 x 1024 RGBA | 4 x 2 图标母图，实际 7 个图标，第 8 格保留 |
| `UI-BADGE` | `source/ui-badge-frame.png` | 1024 x 1024 RGBA | 单一中性单位徽章框；中间透明，叠加实时坦克图像 |
| `UI-BG-DEP` | `source/ui-bg-dep.png` | 1536 x 864 RGB | 车库/战地整备背景；左侧维修台放实时坦克，右侧留给属性面板 |

`runtime/` 是对应的 512px 透明 UI 副本和 1536 x 864 WebP 背景。`preview/` 只用于人工评审，不得作为运行时输入。

## 图标切片契约

主图为 4 列 x 2 行，单格 256 x 256；运行副本为单格 128 x 128。索引固定如下：

| index | row/col | 名称 | 语义 |
|---:|---|---|---|
| 0 | 0/0 | `MG` | 机枪 |
| 1 | 0/1 | `CANNON` | 主炮 |
| 2 | 0/2 | `MISSILE` | 导弹/锁定 |
| 3 | 0/3 | `AIRSTRIKE` | 空袭 |
| 4 | 1/0 | `TURBO` | 加速 |
| 5 | 1/1 | `SHIELD` | 护盾 |
| 6 | 1/2 | `PAUSE` | 暂停 |
| 7 | 1/3 | `RESERVED` | 必须保持透明，暂不使用 |

取图方式：`sx = (index % 4) * cell`，`sy = floor(index / 4) * cell`，`cell` 为 256 或 128。UI 小图标按 24-36px 绘制；不要把整张母图当成一个图标使用。

## 给接入 agent 的实施指示

### 1. 保留现有素材和加载边界

以下目录属于已有资产，不得覆盖、删除或改名：

- `assets/stage-intros/`：现有标题图和 7 个关卡开场 WebP。
- `assets/ai-v15-topdown/`：16 方向俯视单位和地形素材。
- `assets/ai-v18-layers/`：三种底盘/炮塔及其 16 帧方向层。

本包只补齐 V1.8 的 UI 母资产。标题图不替换现有关卡开场图；整备背景不包含坦克，战斗单位仍由现有 `V18.playerLayers()` / `V18.paint()` 运行时绘制。

### 2. 建议加载位置

按当前嵌入式构建顺序新增一个 UI 数据模块，例如 `src/data/v18_ui.data.js`，再新增一个 UI 适配模块，例如 `src/game/v18ui.js`。数据模块应把本包运行时资产转为 data URL 或沿用现有 `src/game/assetpipeline.js` 的 manifest 机制，使 `index.html` 单文件构建、Android WebView 和本地开发使用同一份资源。

建议脚本顺序：

1. `src/data/v18.data.js`
2. `src/data/v18_ui.data.js`
3. `src/game/v18ui.js`
4. `src/game/ui.js`
5. `src/game/main.js`

不要在 `src/game/render.js` 中散落硬编码文件路径；如果采用外部文件懒加载，必须同时补齐 Pages、Android 和单文件构建的失败回退。

### 3. `UI-FRM-BASE` 9-slice

- 主图推荐切片边宽：`96px`；512px 副本对应 `48px`。
- 九宫格中心必须保持透明，由代码决定面板底色和透明度。
- 推荐绘制顺序：代码面板底色 -> 九宫格边框 -> 文字/图标/数值。
- 不要为 Ready、Pressed、Cooldown、Disabled 分别生成新框图；使用代码缩放、亮度、色调和环形进度表达状态。

### 4. `UI-ICO-MASTER` 状态和着色

母图只提供轮廓和中性金属质感。建议代码颜色 token：

- 友方/可用：`#35C8FF`
- 敌方/危险：`#FF4C3F`
- 完成/强化：`#F6B94E`
- 高亮文字：`#EEF6FF`
- 场景底色：`#0A0F14`

通过离屏画布 `source-in`、`globalCompositeOperation` 或等效 tint 逻辑着色，不复制出 7 x N 张状态图片。状态行为固定为：

- `Ready`：原始亮度，100% 尺寸。
- `Pressed`：短暂 1.05 倍缩放和白色闪光。
- `Charging`：顺时针环形进度由代码绘制。
- `Full`：金白脉冲。
- `Cooldown`：降饱和，并以反向环形进度表示剩余时间。
- `Disabled`：约 35% 亮度。
- `Perfect`：青白色短脉冲。
- `Overdrive`：金色外环，不修改母图。

战斗 HUD 保持简洁：触屏按钮本身就是 HUD，不要再叠加一条重复武器栏。导弹锁定使用一个主目标框加外围节点，命中数量用代码文字 `xN` 表示，不要堆叠多个完整瞄准框。

### 5. `UI-BADGE` 单位徽章

使用单一中性徽章框，禁止为三种坦克制作三套彩色框。绘制顺序：

1. 代码面板底色。
2. `UI-BADGE` 框。
3. 现有坦克底盘层。
4. 现有炮塔层，并按实际朝向旋转。
5. 代码绘制的生命、类型、状态标记。

三款玩家坦克只通过现有实时外观和职业色区分：突击型偏锈橙、均衡型偏钢蓝、重装型偏铁黑；友方识别仍优先使用冷青色 IFF 光，不要用职业色代替阵营色。徽章只用于标题页、车库选择、升级和结算，不用于战斗中的重复头像。

### 6. `UI-TITLE` 标题页背景

- 目标画布按 1536 x 864 处理；左侧约 35% 是标题/菜单安全区。
- 在画面上绘制标题、版本和菜单文字，图片内没有任何文字、Logo 或 HUD。
- 三种坦克位于右下和中右区域，作为可见的首屏单位识别。
- 标题页进入时懒加载；离开标题页后释放该大图，避免战斗峰值内存上升。
- 保留现有 `assets/stage-intros/title-bg.webp` 的回退路径，直到新图在 Pages、Android 和本地构建全部验证通过。

### 7. `UI-BG-DEP` 车库/整备页背景

- 只在车库、升级或战地整备页加载。
- 将实时坦克放在左中维修台，建议归一化锚点约为 `(0.34 * viewportWidth, 0.72 * viewportHeight)`，实际尺寸随视口计算。
- 右侧约 35% 保持低细节，用于代码绘制升级项、数值和按钮。
- 不在背景图上再绘制一辆“假坦克”；炮塔必须能独立旋转，且三款底盘共享同一绘制管线。
- 离开整备页后释放背景图。

## 验收清单

素材接入前由评审人确认：

- [ ] `source/` 五张主资产尺寸、模式与 `manifest.json` 一致。
- [ ] 框体和徽章四角、中心孔为真实 alpha 透明，无棋盘格残留。
- [ ] 图标 0-6 均有内容，图标 7 完全透明；24px 预览仍可区分。
- [ ] 标题图左侧能放标题和菜单；三款坦克没有被裁切。
- [ ] 整备图维修台无遮挡，右侧文字区没有高对比机械细节。
- [ ] 任何单位都没有被烘焙进 `UI-BADGE` 或 `UI-BG-DEP`。
- [ ] 不新增独立的 Ready/Pressed/Cooldown/Disabled 图片变体。
- [ ] 接入后至少检查桌面 16:9、窄屏横屏、刘海/安全区和本地 `index.html`。
- [ ] 战斗实测：HUD 0.5 秒内可定位；导弹 Ready/Charging/Cooldown、锁定节点、护盾、命中数字和 Boss 多导弹同时出现时不互相遮挡。
- [ ] 记录解码峰值；标题图和整备图不在战斗页常驻，图标和框体可共享纹理。

## 生成与版权边界

本批使用内置 `imagegen.imagegen` 生成原创候选图，再对透明资产做确定性去棋盘格、裁切、缩放和拼版。提示词核心是：明亮日式 HD-2D 战术场景、原创虚构机械、无文字无 Logo；透明 UI 资产要求真实 RGBA alpha。生成源文件保留在 Codex 生成目录，项目内以本目录的规范化文件为准。

当前状态是“候选待评审”，不是“已接入”或“已发布”。评审通过后，再由另一位 agent 按本文件接入并做浏览器、Android 和 Pages 验证。
