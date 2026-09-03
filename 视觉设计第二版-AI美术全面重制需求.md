# 视觉设计第二版 —— AI 美术全面重制需求书

> 版本：v2.0 草案 · 2026-09-03
> 范围：**所有坦克类单位外观重制 + 界面（UI）美术化**，基于 v1.8.0 现状（分层双摇杆机体 / 多锁导弹 / 惯性漂移已上线）。
> 用途：AI 绘图（OpenRouter `google/gemini-3-pro-image`）批量生成 + 程序化处理管线的**直接可执行**需求规格。
> 姊妹文档：`视觉设计第一版.md`（v3.4 像素时代）、`CONTROL_CONTRACT_v1.8.md`（玩法契约，本需求不得改变任何玩法语义）。

---

## 0. 三条铁律（来自 v18 素材实战的已证实结论）

1. **禁止网格枚举旋转**。让模型画"4×4 网格、每帧转 22.5°"不可靠——中间帧会大量重复/跳变（v18 R1 六张全废的实测结论）。所有多方向素材一律采用：**单主体正典图（朝东）→ 程序化旋转合成 16 帧**。
2. **禁止在图上出现任何文字/字母/数字/水印**。模型会在装甲上写 "REAR" 之类的字（实测）。
3. **朝向不靠自动检测**。暖色/青色投票、饱和度加权投票均被实测证伪（各错一例）。正典图朝向 = 生成后由视觉审校确认一次，写入**确定性覆盖表**。

配套纪律：每张生成图必须过**自动校验**（方形画布、内容量级、连通域）；素材入库前过**三轮视觉审校**；游戏内 9 姿态截图终验（详见 §7）。

---

## 1. 现状盘点（重制对象与保留对象）

### 1.1 替换（本需求覆盖）

| 现资产 | 位置 | 现状 | 处置 |
|---|---|---|---|
| 玩家分层机体 3 套 | `src/data/v18.data.js`（6 张 512 atlas，388KB） | v18 正典+程序旋转，质量达标但风格为"首代试探" | **重制 P0**：新风格重生成，数据结构/运行时（`v15art.js` V18 模块）不变 |
| 敌坦克/敌卡车 | `v15.data.js` `enemy.*`（整帧 16 向，实测角表） | 购置图集，与玩家新风格脱节 | **重制 P0**：改走正典+旋转管线，淘汰实测角表 |
| BOSS 陆舰 | `v15.data.js` `boss.landship`（192px 帧） | 同上 | **重制 P0**：同管线，帧 192px |
| 僚机 ×3 | `v15.data.js` `wingman.*` | 同上 | **重制 P0**：同管线 |
| 空袭支援机 | `v15.data.js` `support.airstrike` | 同上 | **重制 P0**：同管线 |
| HUD 武器芯片图标 | `render.js drawHUD`（文字符号 ●◆»✈➤⬡） | 无图标 | **新增 P1** |
| 菜单/面板框 | `ui.js uPanel`（纯代码玻璃） | 无贴图 | **新增 P1**：9-slice 装饰框 |
| 标题主视觉 | `stage-intros/title-bg.webp` | 旧风格 | **重制 P1** |
| 触屏按钮图标 | `index.dev.html .tbtn`（文字符号） | 无图标 | **新增 P1** |
| 机体头像 | 无（选车用实车渲染） | — | **新增 P1**（可选，整备/结算用） |

### 1.2 保留（本需求不动）

- **地形图集**（`v15terrain.js`，7 主题 × 8 槽）：与单位风格协调即可，P2 视效果决定是否重制（见 §5.3）。
- **关卡开场图**（`assets/stage-intros/` 8 张 webp）：P2。
- **特效层**（爆炸 7 层/护盾球/漩涡/漂移拖印）：纯代码，本需求只要求新素材配色与特效调色板兼容（§2.4）。
- **App 图标**：用户明确选定过母版，除非用户再点名，不重制。
- 全部 UI 文本/三语/布局逻辑：AI 只出"底图/框/图标"，文字仍由代码渲染（i18n 不可绘图化）。

---

## 2. 全局风格圣经（所有 prompt 的公共头）

### 2.1 关键词（英文 prompt 公共段，直接复用）

```
Japanese tactical HD-2D game asset, hand-painted armor plate detail with bright
clean accents, strictly flat orthographic top-down view (camera directly
overhead), perfectly uniform ambient lighting from directly above, no
directional shadows, no drop shadows, solid uniform dark background #0a0f14,
absolutely NO text, NO letters, NO numbers, NO labels, NO decals resembling
writing, no watermark, no grid lines, no borders.
```

### 2.2 阵营色彩体系（重制核心——比 v18 更鲜明的阵营识别）

| 阵营 | 主装甲 | 强调色 | 辨识目标（验收硬指标） |
|---|---|---|---|
| 玩家·突击 RAIJIN | 锈橙 #c9702a + 分层侧裙 | 金 #f6b94e | 任何背景下 3 秒内认出"我方橙色快攻" |
| 玩家·均衡 IRONCLAD | 钢蓝灰 + 焊缝 | 青 #22c0ff | 我方标准型，青色能量条 |
| 玩家·重装 BASTION | 暗铁 #3d4652 宽履带 | 青绿 #8fd8e8 + 红热 #ff7a5c 核心 | 我方重甲，明显比另两型宽大 |
| 敌军 CRIMSON | 暗砖红 #8f2f26 | 警红 #ff4c3f | 一眼敌对（暖红系 = 敌） |
| BOSS 陆舰 | 近黑铁 + 深红纹章 | 猩红 #ff543f | 压迫感，比敌坦克大 2.5× |
| 僚机 | 黄铜/无人机灰 | 各自能量色（金/青/翠） | 小一号、轻盈、伴飞感 |
| 支援机 | 银灰机身 | 天青 #9bdcff | 高空掠过感 |

**硬规则**：玩家三型之间只靠"装甲色+轮廓"可分（无 HUD 辅助时）；敌我色相轴分离（敌暖红 vs 我冷钢/橙金），延续"敌暖我冷" doctrine；所有单位尾部必须有**高饱和标记灯**（排气/能量条，颜色按阵营）——它是朝向校验与读向的锚点。

### 2.3 比例尺（正典图内，生成时写进 prompt）

- 玩家车体：长 ≈ 车宽 1.45×（俯视坦克比例）；炮塔盘径 ≈ 车宽 60%，炮管长 ≈ 1 车宽。
- 敌坦克略小（0.9×），卡车窄长（1.6×），BOSS 2.6× 宽，僚机 0.55×。
- 同一张正典图内主体占画布约 **78% 宽**（四周留边，防旋转裁切）。

### 2.4 与代码特效的兼容约束

新装甲色不得与以下调色冲突：爆炸（金/橙/白）、护盾漩涡（蓝白 #7ec8ff）、锁定框（金/青 + 深藏青描边）、扬尘/喷雪。**重制后需各跑一次 §7.2 特效同屏验收**。

---

## 3. 生成与处理管线（复用 v18 已验证工具链）

```
生成(OpenRouter gemini-3-pro-image) → 自动校验(方形画布≥1024/内容量级/连通域)
→ 连通性 alpha 切割(边界洪泛: 近底色+暗晕; ≥120px 连通域保留, 微小碎块剔除)
→ pivot 居中(炮塔=腐蚀法圆盘中心 / 车体=bbox中心)
→ 半径+边距画布 → 源分辨率单次插值旋转 16 帧(22.5°/帧, BICUBIC→LANCZOS 降采样)
→ 终帧 despeckle → 512×512 atlas(WebP q82) → src/data/*.data.js(角表精确/比例表)
```

- 工具：`tools/gen_v18_layers.py` 扩展为 **`tools/gen_art_v2.py`**（新增整单位模式：无炮塔分层，单正典直接旋转）。
- 朝向覆盖表：`FACING = {<assetId>: <deg>}`（审校确认后手填，自动投票仅作缺省）。
- 炮塔/车体比例：审校标定值写入 `RATIO` 表（v18 经验：0.95–1.05）。
- **生成成本参考**：每张正典 ~1-1.5MB PNG、1-2 分钟；整轮 P0 共 14 张，预算 3 次重试/张。

---

## 4. 素材总清单

### P0 —— 单位重制（14 张正典图 → 14 张 atlas）

| ID | 素材 | 正典构图 | 帧规格 | atlas | 集成点 |
|---|---|---|---|---|---|
| PL-HUL-AS | 突击·车体（无炮塔，空炮塔环+尾部双暖色排气） | 单体朝东 | 128px×16 | 512² | `v18.data.js hulls.assault` |
| PL-TUR-AS | 突击·炮塔（单长管+制退器） | 单体朝东 | 128×16 | 512² | `turrets.assault` |
| PL-HUL-BA | 均衡·车体（尾部青色反应堆条） | 同上 | 128×16 | 512² | `hulls.balanced` |
| PL-TUR-BA | 均衡·炮塔（单中管+传感器桅） | 同上 | 128×16 | 512² | `turrets.balanced` |
| PL-HUL-HV | 重装·车体（宽履带+尾部双红色标灯） | 同上 | 128×16 | 512² | `hulls.heavy` |
| PL-TUR-HV | 重装·炮塔（**双管**+红热核心） | 同上 | 128×16 | 512² | `turrets.heavy` |
| EN-TK | 敌坦克（整单位，含炮塔） | 单体朝东 | 128×16 | 512² | `v15.data.js enemy.tank`（换新管线） |
| EN-TRK | 敌卡车（整单位） | 同上 | 128×16 | 512² | `enemy.truck` |
| BS-LAND | BOSS 陆舰（整单位） | 同上 | **192px×16** | 768² | `boss.landship` |
| WG-AS | 僚机·突击型 | 同上 | 96×16 | 384² | `wingman.assault` |
| WG-GU | 僚机·护卫型 | 同上 | 96×16 | 384² | `wingman.guard` |
| WG-FL | 僚机·多能型 | 同上 | 96×16 | 384² | `wingman.flex` |
| SUP-PL | 空袭支援机 | 同上 | 128×16 | 512² | `support.airstrike` |
| —（共用） | 正典对图布局 | 玩家 6 张走"左 hull 右 turret 同比例"对图（v18 已验证）；其余 8 张单主体 | — | — | — |

> 玩家对图（3 张 1024²）+ 单体图（8 张 1024²）= **11 次生成调用，产出 13 个单位/14 atlas**（对图一张产 2 素材）。

### P1 —— UI 美术化（12 张生成图）

| ID | 素材 | 规格 | 集成点 |
|---|---|---|---|
| UI-TITLE | 标题主视觉（新封面：三机体迎敌群像，敌我阵营色对撞） | 1024²，全幅插画 | `assets/stage-intros/title-bg` 替换 |
| UI-FRM-G | 菜单玻璃框·金边（华丽金属饰边、**中心全空**供 9-slice） | 1024² 空心方框 | `ui.js uPanel` 9-slice 模式 |
| UI-FRM-C | 菜单玻璃框·青边（暂停/帮助用） | 同上 | 同上 |
| UI-FRM-R | 结算框·红边（失败/BOSS 警告） | 同上 | 同上 |
| UI-ICO-WPN | 武器图标组·6 枚（机枪/主炮/导弹/空袭/加速/护盾，单图 2×3 排列、格间距大） | 1024² | `render.js hudChip` |
| UI-ICO-ACT | 触屏按钮图标组·7 枚（同上 6 + 暂停 ‖） | 1024² 2×4 | `index.dev.html .tbtn` |
| UI-POR-AS/BA/HV | 机体徽章/头像 ×3（盾徽式，用于整备页与结算） | 1024² 各 1 | `ui.js drawUpgrade` / 结算卡 |
| UI-BG-DEP | 整备页背景（车库检修场景，暗调、四边可裁） | 1024² | `drawUpgrade` 底图（0.8 压暗） |

> 图标组采用"一图多枚+格间距"而非逐枚生成：同图内风格绝对一致；旋转一致性无关紧要（无旋转语义），风险远低于单位网格。切割按审校确认的格线坐标表 `ICO_GRID`。

### P2 —— 可选扩展（68 张，视 P0/P1 效果再启动）

| ID | 素材 | 数量 | 说明 |
|---|---|---|---|
| TR-T1..T7 | 地形主题图集（每主题 8 槽：地面 A/B/路径/水/水缘/岩石/碎屑×2） | 7×8=56 | 替换 `v15terrain.js` 烘焙源；每主题 1-2 张"纹理拼盘图"再程序切槽（不做 8 张单独生成） |
| INTRO-S1..S7 | 关卡开场图（新风格，7 关） | 7 | WebP q85，单张 ≤300KB |
| UI-LOAD | 加载/首次进入底图 | 1 | 可选 |

---

## 5. 逐素材详细规格

### 5.1 P0 单位正典 —— prompt 模板与要点

**玩家对图模板**（每型一张，替换 §2 色彩/比例占位）：

```
{§2.1 公共头}. Single square 1024x1024 image. Exactly TWO separate game assets
side by side at IDENTICAL scale: LEFT HALF a tank HULL facing EAST (front points
right), centered in the left half, occupying ~78% of that half's width, no
turret no gun barrel, flat empty recessed circular turret ring with bolts at
deck center, rear engine deck with {阵营尾部标记: two glowing warm orange
exhausts / one cyan #22c0ff reactor strip / two red-hot #ff7a5c marker lights},
pointed front glacis clearly different from the flat rear. RIGHT HALF that
hull's TURRET floating alone: {炮塔描述: ONE long slim high-velocity cannon
with muzzle brake + small commander hatch / ONE medium cannon + sensor mast /
TWIN parallel heavy cannons + red-hot core glow + wide mantlet}, barrel points
exactly east, rotation pivot = disc center, occupying ~78%. Both parts fully
inside their half with clear margin, never touching. {§2.2 阵容装甲描述}.
```

**敌/僚/BOSS 单体模板**：

```
{§2.1 公共头}. Single square 1024x1024 image, ONE {unit} centered, facing EAST
(front/barrel points right), occupying ~78% of canvas width. {单位描述: 敌坦克
= 暗砖红 #8f2f26 装甲、警红 #ff4c3f 炮口与观察窗、粗糙铆接、单中管炮塔;
敌卡车 = 窄长 1.6×、无炮塔、货斗多管火箭巢; BOSS 陆舰 = 近黑铁多层甲板、
猩红纹章与能量核心、三联巨炮、宽体 2.6×、四履带; 僚机 = 无人机/轻型装甲车
混合体 0.55×、黄铜色、小型能量炮; 支援机 = 银灰喷气攻击机、天青引擎光}.
```

**处理要点**（gen_art_v2.py 落实）：
- 玩家 6 件走对图分割 + 炮塔腐蚀 pivot + `RATIO` 比例表；
- 整单位 8 件：pivot=bbox 中心（近对称），单次旋转合成；
- BOSS 帧 192px、僚机 96px，其余 128px；终帧 despeckle 阈值同 v18；
- 角表一律**构造精确**（frame i = -22.5°×i），不再需要实测角表。

**验收**（每件）：①自动校验过；②正典图视觉审校（朝东、无文字、阵营色对、比例尺）；③游戏内 9 姿态截图（3 单位×对齐/90°/对角）方向正确；④与特效同屏不冲突；⑤BOSS 双管、重装双管、突击单长管等"检哨特征"逐项确认。

### 5.2 P1 UI —— prompt 模板与要点

**9-slice 框**（关键：中心必须空）：

```
{§2.1 公共头 except top-down} — 替换视角句为 "ornate UI frame artwork". A
square 1024x1024 ornate metal-and-glass frame for a game dialog, {金/青/红}
accent trim, sci-fi military style, beveled edges with rivets and subtle glow,
the ENTIRE CENTER of the frame is empty flat dark #0a0f14 (content area), frame
band width roughly 90-110px on all four sides, corners slightly reinforced,
perfectly symmetric.
```
处理：中心挖空 → 3×3 切片 → 代码 9-slice（`uPanel` 增加 `uPanelTex(frame,c,w,h)` 分支，边带拉伸、四角原样）。**回归**：所有现有面板文字可读性不降级（对比度抽检）。

**图标组**（一图 6-7 枚）：

```
{§2.1 公共头 except top-down}. A neat 2x3 (or 2x4) grid of SEPARATE game UI
icons on the dark background, each icon inside its own generous margin, never
touching: 1 machine-gun (belt-fed triple barrel) 2 main cannon shell 3 homing
missile with seeker eye 4 airstrike jet silhouette 5 turbo flame chevron 6
circular energy shield. Flat bold silhouette style with {金} accent, readable
at 24px, strong dark outline around each shape.
```
处理：审校确认每枚的包围盒 → 坐标表 → 运行时按 hudChip/按钮尺寸 drawImage；触屏按钮保留现有玻璃底 + 图标叠加（`.tbtn .ic` 从文字符号换 `<img>`/canvas 绘制）。

**机体徽章 ×3**：盾徽构图（上 2/3 图案 + 下 1/3 空色带供代码写字），各含机体剪影 + 阵营色 + 编号位留空。

**整备背景**：`{车库检修场景, 顶灯光锥, 三分之一下方留空地台(供五行数据面板), 整体≤25%亮度` —— 运行时压暗 0.8 叠面板。

### 5.3 P2 地形拼盘（仅说明风险）

每主题 1 张"纹理拼盘"（1024² 内 4-6 种地表纹理块 + 岩石个体若干，**不做网格承诺**，由审校标定每块的采样矩形）→ 程序切块烘焙 16px tile（复用 `v15terrain.js` 烘焙器）。岩石/碎屑需单独个体（透明切割同单位管线）。

---

## 6. 数据与预算

| 项 | 现值 | 重制后预算（P0+P1） | 硬顶 |
|---|---|---|---|
| index.html 体积 | 7.12MB | +0.9MB（单位 atlas ~0.6MB + UI ~0.3MB） | ≤ 8.3MB |
| atlas 数量 | 6 | 14（单位）+ ~10（UI 切片打包 2 张 1024 拼盘） | — |
| 解码纹理内存 | 6.0MB | ~9MB | ≤ 12MB |
| 单帧规格 | 128 | 96/128/192 按单位分级 | — |
| 源资产目录 | assets/ai-v18-layers 6.3MB | assets/ai-art-v2/（正典+处理后，预计 ~15MB） | git 可入 |
| 首载（本地） | 90ms | ≤ 130ms | — |

每次入库跑 `tools/asset_budget.js`（新增：输出体积/纹理/帧规格对比表，超顶即 fail）。

---

## 7. 验收流程（每素材强制）

1. **自动校验**（管线内）：方形画布、内容占比、连通域、（单位）尾部标记灯色相在阵营区间。
2. **三轮视觉审校**（VisualInspector 代理）：
   - R1 正典图：朝向/无文字/阵营色/比例/风格一致性；
   - R2 合成 atlas：pivot 零漂移、无裁切、无碎块、帧间仅旋转；
   - R3 游戏内截图：9 姿态（对齐/炮塔 90°/对角）+ HUD 同屏 + 特效同屏（爆炸/漩涡/锁定框压在新装甲上的可读性）。
   三轮不过 → 该素材兜底策略：单位=沿用现 v18/v15 资产（玩法无感）；UI=回退纯代码面板。
3. **真机抽检**：每阵营 ≥1 单位 + 标题画面 + 触屏图标，Redmi debug 包 JS 桥截图（复用 `output/visual/v18-phone/` 流程，注意 §8 桥坑清单）。
4. **回归门**：verify6-9/18 + tankshot + perf_v18 全绿（`v15art.js` 改动后必跑）；性能采样 avg≥55fps 不回退。

---

## 8. 风险清单（已知坑与对策）

| 风险 | 实证 | 对策 |
|---|---|---|
| 网格枚举旋转失败 | v18 R1 全废 | §0 铁律 1 |
| 装甲嵌字 | heavy hull 出现 "REAR" | prompt 强禁 + R1 审校逐字检查 |
| 朝向投票误判 | 质量投票/饱和度投票各错一例 | 覆盖表 + 审校确认 |
| 非方形画布随机出现 | 2/6 张 1408×768 | 自动校验拒收重试（≤3 次） |
| 柔光晕切不净 | halo 40-60 亮度 | 边界洪泛连通性切割（勿用硬阈值） |
| 细特征丢失（天线） | balanced 炮塔 | 源分辨率单次插值旋转 + 降采样 |
| 旋转后光照随体 | 程序旋转固有 | prompt 锁"正上方均匀光"；接受轻微违和 |
| 比例失真（对图两件不同比例） | R2 审校发现 0.65 | `RATIO` 覆盖表标定（审校给值） |
| 图标格切割错位 | —（预防） | 审校标定坐标表 `ICO_GRID`，不做自动格检测 |
| 9-slice 中心被画满 | —（预防） | prompt "ENTIRE CENTER empty" + R1 检查 + 代码再挖空中心 60% |

---

## 9. 执行顺序与交付物

| 阶段 | 内容 | 产出 | 门 |
|---|---|---|---|
| 步骤 1 | `tools/gen_art_v2.py`（对图+单体两模式+资产预算脚本） | 工具 | 干跑（现正典重处理）零差异 |
| 步骤 2 | P0 玩家 3 对图 → 6 atlas | 新 v18.data.js | §7 全流程 |
| 步骤 3 | P0 敌/BOSS/僚/机 8 单体 → 8 atlas | 新 enemy/boss 数据 | §7 全流程 + 真机抽检 |
| 步骤 4 | P1 UI 12 张（框/图标/徽章/背景/标题） | ui 贴图数据 + uPanelTex/hudChip/按钮接入 | 对比度回归 + 触屏可用性 |
| 步骤 5 | README 截图全量重拍 + 发版 v1.9.0 | Release | 现行发版流水线 |
| 步骤 6（可选） | P2 地形/开场图 | — | 另立需求 |

每步独立提交、独立回归；全程不触碰 `CONTROL_CONTRACT_v1.8.md` 玩法语义。
