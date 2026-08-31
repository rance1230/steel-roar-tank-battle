# 钢铁咆哮·坦克大战

当前版本：v1.3.3。双击 index.html 即可游玩（Chrome/Edge/Firefox/Safari，含手机浏览器）；HTML 单文件也会随 GitHub Release 发布为 `index.html`。GitHub Pages 当前受私有仓库计划限制，待仓库计划/可见性允许后再启用 `https://rance1230.github.io/steel-roar-tank-battle/`。

最新说明：

- [Android 安装与构建](output/android/README-安装与构建.md)
- [游戏介绍与操作说明](output/android/游戏说明书/游戏介绍与操作说明.md)
- [页面与按钮导览](output/android/页面导览/页面与按钮导览.md)

键盘 WASD移动 J机枪 K主炮 L蓄力导弹 U空袭 Shift涡轮 空格护盾(反弹) P暂停 M静音 F3性能面板。
手柄即插即用可在 OPTION 自定义映射；触屏自动显示半透明虚拟按钮；中/日/英三语，5 档难度。
击破掉落部件/装备，冲撞·反弹击破掉落大增；每关后战地整备强化，通关进入更高强度周目，无限循环。
360°速度向量移动（手柄模拟轴原生支持）；5秒连击链：连击越高掉落越好，60+进入Overdrive（射速/移速提升+金色尾焰）。
战斗地基：统一伤害归因与连锁（深度≤3）；护盾分普通反弹/完美格挡（≤0.12s，更强反弹+顿帧+保连击）；高速冲撞触发破门零距离炮击×1.35并按敌质量击飞/撞飞连锁，BOSS改大幅硬直。
v1.3.3 接入 v14 高清 AI 立绘与更完整武器/命中音效；v1.5 俯视多方向与可拼装地形资产包已生成在 `assets/ai-v15-topdown/`，待后续接入渲染层。
v3 架构：src/ 模块化源码（开发用 index.dev.html，file:// 直开），`node build.js` 构建单文件 index.html。
逻辑固定 60Hz 与刷新率解耦，渲染插值 + 对象池 + 空间网格；性能不足 AUTO 档只降特效不降逻辑。
功能基线见 BASELINE.md。
