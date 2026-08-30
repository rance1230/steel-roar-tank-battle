# 视觉资产管线(Art Pipeline)

服务目标:把《钢铁咆哮·坦克大战》从"程序矩形绘制"升级为
**3D 预渲染 Sprite + Normal/Emissive 多层 + PixiJS 动态灯光**。
完整方案见 `../视觉优化+工具推荐.md`(P3.5 资产管线原型)。

## 已安装的桌面工具(/Applications,全部免费)

| 工具 | 版本 | 职责 | 安装方式 |
|---|---|---|---|
| Blender | 5.2.1 LTS | 模型修改/材质/灯光/AO/正交渲染 | `brew install --cask blender` |
| Laigter | 1.14.0 | 2D Sprite 生成 Normal/Specular/AO/Parallax | GitHub release |
| Effekseer | 1.80.7 (arm64) | 可视化粒子特效编辑(爆炸/炮口焰/护盾) | GitHub release |
| Pixelorama | 1.2.1 | 最终像素修正/轮廓/调色/Spritesheet | GitHub release |

> PixelOver 为付费软件($29.99),按计划用 **Blender + SpriteSheet 插件**替代,未购买。
> Effekseer 导出特效时,请把 Runtime 版本设为 **1.70e** 以匹配 `web-runtime/` 里的 Web 运行时。

## 项目内目录

```
art-pipeline/
├─ blender-addons/            两个 SpriteSheet 插件的可安装 zip(手动装全局时用)
│  ├─ spritesheetmaker.zip            (github.com/ManasMakde/SpriteSheetMaker)
│  └─ blender-sprite-generator.zip    (github.com/RubielGames/BlenderSpriteGenerator)
├─ blender-user-scripts/      项目级 Blender 插件挂载点(BLENDER_USER_SCRIPTS 指向这里)
│  ├─ addons/  spritesheetmaker, blender_sprite_generator
│  └─ modules/ Pillow 12.3(blender_sprite_generator 的依赖)
├─ scripts/
│  └─ blender-pipeline.sh     ★ 项目级 Blender 启动器(自动挂载上述插件)
├─ assets/                    全部 CC0,可商用,详见 docs/LICENSES.md
│  ├─ units/                  Quaternius Tank Pack(FBX/OBJ/Blend ×4)+ OGA 低模坦克
│  ├─ environment/            Kenney City Kit Industrial / Factory Kit / City Kit Roads
│  │                          + OGA PBR Industrial Pack(含烘焙版)
│  ├─ materials/              Poly Haven 9 组 PBR 材质 ×(diffuse/nor_gl/arm/displacement, 2k)
│  ├─ hdri/                   industrial_sunset_02_puresky + factory_yard(2k .hdr)
│  └─ vfx/                    Kenney Particle Pack(粒子纹理源)
├─ web-runtime/               游戏运行时依赖(离线可用)
│  ├─ pixi.min.js             PixiJS v8.14.2
│  └─ effekseer.{min.js,js,wasm,d.ts}   EffekseerForWebGL 1.70e
├─ renders/                   Blender 渲染输出(spritesheet、bake 等)
└─ docs/LICENSES.md           素材来源与许可证清单
```

## 快速上手

```zsh
# 启动带插件的 Blender(插件自动挂载,不污染全局配置)
./art-pipeline/scripts/blender-pipeline.sh

# 无头验证插件是否加载
./art-pipeline/scripts/blender-pipeline.sh -b --python-expr \
  "import addon_utils; print([m.__name__ for m in addon_utils.modules()])"
```

## 下一步(P3.5 原型工作流)

```text
1. blender-pipeline.sh 打开 assets/units/Tank Pack - June 2019/Blends/Tank.blend
2. 统一:相机俯角 / 灯光方向 / 色板 / 像素密度(四单位必须一致)
3. 用 spritesheetmaker 或 blender_sprite_generator 渲染 16 方向正交 Sprite Sheet
   → renders/IRONCLAD/hull_*.png, turret_*.png
4. Laigter 补生成 normal/specular(Blender 烘焙缺什么补什么)
5. Pixelorama 修边/调色 → assets/units/IRONCLAD/ 最终层
6. 游戏侧:AssetManifest 接入 web-runtime/pixi.min.js 多层渲染
   + effekseer.min.js 驱动爆炸七层结构
```

## 已知约束

- `BLENDER_USER_SCRIPTS` 会**替换**用户级 scripts 路径:用启动器打开时,你全局安装过的
  Blender 插件不会出现;想全局使用插件,改用 Blender 界面安装 `blender-addons/*.zip`。
- Effekseer Web 运行时(1.70e)落后编辑器一个大版本,新特效务必核对 Runtime 版本设置。
- OGA 工业包有两个版本:`oga_industrial_pack`(带贴图源文件)和
  `oga_industrial_baked`(烘焙后模型),做场景优先用后者。
