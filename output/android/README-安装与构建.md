# 钢铁咆哮·坦克大战 — Android APK

## 产物

- `钢铁咆哮-坦克大战-v1.3.3.apk` — 自签名 release 包,可直接覆盖升级
  - v1.3.3:**v14 高清 AI 立绘接入**——我方三机体/僚机/敌军坦克·运兵车/BOSS 陆舰 换为手绘级高清裁切立绘(HD 层平滑全向旋转+阵营辉光+受击闪白,立绘资产内嵌打包);渲染健壮性修复(单个坐标异常的单位跳过绘制,不再炸掉整帧并累积错误);战斗系截图全部以 v14 画面重拍
  - v1.3.2:可读性强化——帮助 13 页插图全面提亮并补全「我方机体/僚机系统」专属插图、键位速览演示窗提亮至战斗画面亮度、标题选单半透明露出封面坦克且画面整体调亮一档、帮助文字断行规则修复(行首标点悬挂/西文整词换行)
  - v1.3.1:「页面与按钮导览」全交互实测发现的修复——菜单关闭后残留点击区导致失效+报错条(失败画面中央点按重试正中招)、键位速览页演示窗下方文字叠压、OPTION 难度/音量触屏只能调高不能调低(改循环切换)
  - v1.1:盖世小鸡 X2S 等安卓手柄适配(十字键 HAT 轴、RT=机枪/LT=护盾扳机别名)、按键提示随手柄/触屏/键盘自动切换、新增开局「战前键位速览」动态演示页(见说明书 3.4)
  - v1.2:失败/通关画面提示输入感知化(手柄显示 A/B/X、触屏显示点按),失败/通关/结算画面补齐手柄与触屏操作(A=重试/继续、B=回标题、X=重分配),键位速览页十字键箭头统一为实心三角
  - v1.3:三机体选择(突击/均衡/重装,参数表+三种护盾+突击三枚分锁导弹)、僚机系统(突击/防御/自适应/无,默认配对)、键位速览页新增实况游戏画面演示窗、魂斗罗式秘籍开启 DEBUG MODE(标题页 ↑↑↓↓←→←→JKENTER,含 God/调参菜单,不写存档不刷最高分)、帮助扩至 13 页
  - 包名 `com.rance.steelroar`,versionName 1.3.3 (versionCode 7)
  - minSdk 24(Android 7.0+)/ targetSdk 35,横屏锁定、沉浸全屏
  - 已整合 `assets/stage-intros/` 标题图 + 7 张关卡图(title-bg + stage-01~07,游戏按相对路径加载);v14 立绘经 `src/data/ai_assets.data.js` 内嵌,无需额外拷贝资产
  - App 图标采用「像素坦克大战 iOS 母版图标.png」(基础版)
- `钢铁咆哮-坦克大战-v1.3.apk`、`钢铁咆哮-坦克大战-v1.3.1.apk`、`钢铁咆哮-坦克大战-v1.3.2.apk` — 历版留档
- `screenshots/` — 模拟器(pixel_6 · API 34)验证截图:标题写实战场图 → 第 1 关 intro(尘土前线 + STAGE 1 标题)→ 战斗画面(氛围底图 + 触屏按钮)
- `页面导览/` — **面向普通玩家的页面·按钮·路径图文导览**(模拟器 CDP 实测 27 张截图,v1.3.3 画面复拍)
- `游戏说明书/` — **详细游戏介绍与操作说明**(真机截图):触屏/键盘/手柄三模式操作、手柄默认映射与自定义教程、核心系统、七关图鉴、HUD 图解;`img/help/` 含游戏内 13 页操作说明原始截图

## 安装

手机开启"允许安装未知来源应用"后,直接安装 APK:

```
adb install -r 钢铁咆哮-坦克大战-v1.3.3.apk
```

或把 APK 传到手机(微信/AirDroid/USB)点击安装。

## 重新构建

游戏源文件更新后(`index.html` 重新构建过),需要同步拷贝游戏与图片资源再构建:

```
cp ../index.html android/app/src/main/assets/index.html
cp -R ../assets/stage-intros android/app/src/main/assets/assets/
cd android && gradle assembleRelease
```

产物在 `android/app/build/outputs/apk/release/app-release.apk`。

## 签名(重要)

- Release APK 使用本机私有签名材料构建;`android/keystore/` 已被 `.gitignore` 排除,不会上传到 GitHub 或 Release
- 升级版本时**必须使用同一私有 keystore 签名**,否则老用户无法覆盖安装;发 Google Play 前建议换正式 keystore
- 签名配置应通过本机安全存储或 CI Secrets 提供,不要把密码写入文档、代码或仓库
- 升级版本号:改 `android/app/build.gradle` 里 `versionCode` / `versionName`

## 项目结构

`android/` 为零外部依赖的原生 WebView 壳(纯 `android.app.Activity`,无 androidx/Capacitor):
- `MainActivity.java` — WebView 配置(JS/localStorage/自动播放音频/沉浸全屏/双击返回退出)
- `AndroidManifest.xml` — 横屏锁定、保持屏幕常亮由 Activity 内 flag 实现
- 图标由 `像素坦克大战 iOS 母版图标.png`(基础版)生成(adaptive icon 满幅背景方案)
