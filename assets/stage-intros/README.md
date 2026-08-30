# 钢铁咆哮 · Stage Splash Art

这组素材来自用户指定的“坦克大战游戏”视觉方案，统一采用原创虚构坦克世界的 2.5D 战场立体画、写实材质、电影式光照和轻微像素节奏。所有图片均按 16:9 横版、无文字、无 Logo、无 HUD 生成，标题与关卡信息由游戏 UI 绘制。

| 用途 | 文件 | 叙事 / 主色 |
| --- | --- | --- |
| TITLE | `title-bg.png` | 七关连续战役、孤军突击 / 黑蓝 + 金 |
| STAGE 1 | `stage-01-dust-front.png` | 干旱前线、首次出征 / 土黄 |
| STAGE 2 | `stage-02-green-assault.png` | 绿野机动、速度与活力 / 绿色 |
| STAGE 3 | `stage-03-storm-crossing.png` | 暴雨渡河、自然与火力 / 蓝灰 |
| STAGE 4 | `stage-04-swamp-pit.png` | 沼泽迟滞、伏击压迫 / 墨绿 |
| STAGE 5 | `stage-05-desert-intercept.png` | 荒漠截击、高速包围 / 金橙 |
| STAGE 6 | `stage-06-storm-corridor.png` | 风暴走廊、精锐火力 / 深蓝黑 |
| STAGE 7 | `stage-07-doomsday-waste.png` | 末日决战、最终 Boss / 黑红 |

生成原图为 1672×941 RGB PNG。当前构建保留 PNG，以免本机缺少 WebP 编码器；浏览器通过 `src/game/render.js` 预加载并在标题页及 `intro` 状态使用，图片加载失败时回退到原有像素背景。

渲染编排：背景图轻微 1.02–1.055 倍 Ken Burns 缩放 + 暗色可读性渐变 + 主题粒子 + 原有暗角/扫描线；`title` 菜单、关卡标题、提示和多语言文字均不嵌入图片。
