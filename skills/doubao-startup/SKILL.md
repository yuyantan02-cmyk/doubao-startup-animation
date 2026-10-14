---
name: doubao-startup
description: Install, customize, or build the open-source Doubao dynamic startup launcher on macOS or Windows. Use when a user wants its animated startup, replaceable wallpaper, or appearance settings.
---

# 豆包动态启动

项目：https://github.com/yuyantan02-cmyk/doubao-startup-animation

这是独立启动器，不是豆包插件。必须安装官方豆包并从启动器进入，原版豆包图标不会加载动画。先查看项目 README 和当前 Release，按实际系统选择安装包；不要把源码 ZIP 当作可直接运行的安装包。

## 安装与使用

- Windows x64：下载 Release 中的 `doubao-startup-windows-x64.zip`，解压后运行 `Windows/豆包动态启动.cmd`，首次选择官方 `Doubao.exe`。在豆包中按 `Ctrl+Alt+B` 更换图片、视频和文字。
- macOS：下载 Release 中的 `doubao-startup-macos-intel.zip`，解压并打开 `.app`。需要官方豆包及 Node.js 20+；此包在 Intel Mac 构建，Apple 芯片机型需 Rosetta，尚未实机验收。按 `⌘⌥B` 更换素材；按住 `⌥` 点击启动器可更换圆角 Dock 图标。
- 启动前提醒用户保存未发送的内容；启动动画需要关闭并重新打开豆包。不要静默结束正在运行的豆包。按 `Esc` 跳过动画。
- 若 macOS 阻止打开未公证应用，使用系统提供的“仍要打开”流程；不要要求关闭 Gatekeeper。

## 开发者定制

克隆项目后，按 README 的格式替换 `assets/avatar.jpg`、`assets/artwork.jpg`、`assets/startup.mp4`，或在豆包内用快捷键打开素材设置。媒体素材默认只保存在本机；发布前检查构建包，避免把个人照片和视频上传 GitHub。

在源码目录运行 `node --test tools/extension.test.mjs`。macOS 用 `./tools/build.sh` 构建 `.app`；在 macOS 构建 Windows x64 压缩包用 `./tools/build-windows.sh`。只有在实际目标系统打开并确认启动动画、动态壁纸和相关页面的可读性后，才称该系统已验收。
