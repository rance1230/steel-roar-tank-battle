# v1.8 W2 分层机体素材 (hull@bodyA + turret@ta)

## 生成管线 (tools/gen_v18_layers.py)
R1 (4×4 网格枚举) 失败: gemini-3-pro-image 无法维持 22.5°/帧旋转, 中间帧大量重复/跳变
(轴角实测 2026-09-02)。R2 改为: 每机体一张"正典对图"(左 hull / 右 turret, 同比例, 朝东)
→ 边界洪泛 alpha 切割(保留被包围暗部, 剔≥120px 碎块) → pivot 居中(炮塔=腐蚀法圆盘中心,
车体=bbox 中心) → 源分辨率单次插值旋转合成 16 帧(22.5°/帧, 角度表精确) → 512 atlas WebP。

- 朝向: FACING 覆盖表(两轮视觉审校确证源图朝向: assault 东 / balanced 北 / heavy 南),
  自动投票仅兜底 —— 质量投票错 assault, 饱和度加权错 balanced, 均不可靠。
- 炮塔比例 RATIO: assault 1.05 / balanced 1.00 / heavy 1.02 (炮尖越出车头 10-25%, R2 标定)。

## 视觉验收 (3 轮, 2026-09-02)
- R1: 网格方案 6 张仅 1 张可用 → 弃网格。
- R2: 正典对图 3 张 PASS(朝向/留白/薄特征 3 项装配修复)。
- R3: 游戏内 9 姿态(3 机体 × 对齐/90°分离/对角分离) 全部确认: 车体随 bodyA、炮塔独立随
  ta 旋转, pivot 零漂移, alpha 干净, 家族配色正确。结论 SHIP。
- 假警报 2 次的教训: ①截图脚本把玩家传送到随机地形的地图中心被淹死回出生点(中心自然没
  坦克); ②出生无敌闪烁(inv)在 100ms 相位上隐藏玩家。均已固化进 tools/regress/shot_v18.js。

## 资产预算 (Asset QA)
| 指标 | 基线 v1.7.1 | v1.8 | Δ |
|---|---|---|---|
| index.html | 6,934,641 B | 7,469,702 B | +535 KB (+7.7%) |
| v18.data.js 源文本 | — | 519 KB | (内联) |
| atlas WebP 载荷 | — | 388 KB / 6 张 | 满足"禁止 96 张独立帧图"契约 |
| 解码纹理内存 | — | 6×512×512×4 = 6.0 MB | |
| 首载 (本地文件) | — | load 90ms / V18 ready 116ms | |
| 帧规格 | — | 128px 正方, pivot=帧中心, 4×4 atlas | 固定帧尺寸/固定 pivot 契约 ✓ |

## 渲染接入 (src/game/v15art.js)
V18 模块: 6 Image + 实测角表就近选帧; 玩家分支 hull@bodyA + turret@ta, 失败回退
v15Paint 整图 + drawTurretOverlay(ctx 原语炮塔帽); 残影用 v18 hull 帧剪影; 选车预览分层。
