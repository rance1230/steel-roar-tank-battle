#!/bin/zsh
# 项目级 Blender 启动器 —— 通过 BLENDER_USER_SCRIPTS 把插件目录指向本项目,
# 不污染全局 Blender 配置。用法:
#   ./scripts/blender-pipeline.sh                # 打开 GUI
#   ./scripts/blender-pipeline.sh -b scene.blend # 无头渲染
export BLENDER_USER_SCRIPTS="/Volumes/vol1/像素小游戏/art-pipeline/blender-user-scripts"
exec /Applications/Blender.app/Contents/MacOS/Blender "$@"
