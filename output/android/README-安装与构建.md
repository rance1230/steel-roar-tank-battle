# 钢铁咆哮·坦克大战 — Android APK

## 产物

- `钢铁咆哮-坦克大战-v1.2.apk` — 自签名 release 包,约 24.4MB(含标题图 + 7 张关卡立绘)
  - v1.1:盖世小鸡 X2S 等安卓手柄适配(十字键 HAT 轴、RT=机枪/LT=护盾扳机别名)、按键提示随手柄/触屏/键盘自动切换、新增开局「战前键位速览」动态演示页(见说明书 3.4)
  - v1.2:失败/通关画面提示输入感知化(手柄显示 A/B/X、触屏显示点按),失败/通关/结算画面补齐手柄与触屏操作(A=重试/继续、B=回标题、X=重分配),键位速览页十字键箭头统一为实心三角
  - 包名 `com.rance.steelroar`,versionName 1.2 (versionCode 3)
  - minSdk 24(Android 7.0+)/ targetSdk 35,横屏锁定、沉浸全屏
  - 已整合 `assets/stage-intros/` 标题图 + 7 张关卡图(title-bg + stage-01~07,游戏按相对路径加载)
  - App 图标采用「像素坦克大战 iOS 母版图标.png」(基础版)
- `screenshots/` — 模拟器(pixel_6 · API 34)验证截图:标题写实战场图 → 第 1 关 intro(尘土前线 + STAGE 1 标题)→ 战斗画面(氛围底图 + 触屏按钮)
- `游戏说明书/` — **详细游戏介绍与操作说明**(真机截图 23 张):触屏/键盘/手柄三模式操作、手柄默认映射与自定义教程、核心系统、七关图鉴、HUD 图解;`img/help/` 含游戏内 11 页操作说明原始截图

## 安装

手机开启"允许安装未知来源应用"后,直接安装 APK:

```
adb install -r 钢铁咆哮-坦克大战-v1.2.apk
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
