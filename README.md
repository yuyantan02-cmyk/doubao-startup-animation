# 豆包动态启动

macOS 和 Windows 上的豆包启动动画与动态主界面。点击独立启动器后，它打开已安装的豆包，在豆包窗口内播放约 9 秒的开场动画；导入视频素材后，背景视频会在主界面循环播放。侧栏和输入框采用半透明粉灰色，豆包安装包和用户数据不会被改写。

下载可运行的安装包：[GitHub Releases](https://github.com/yuyantan02-cmyk/doubao-startup-animation/releases)。仓库首页的「Download ZIP」只有源码；公开安装包只含可替换的示例图，不含个人照片或视频。要显示动态角色，请在素材设置中导入自己的 MP4/WebM 视频。

## macOS 使用

1. 安装官方豆包和 Node.js 20+。从 Releases 下载 `豆包动态启动-macOS-Intel.zip`，解压后将 `.app` 放到「应用程序」文件夹。该包在 Intel Mac 构建；Apple 芯片机型需要 Rosetta，目前未在该机型实测。
2. 双击「豆包动态启动.app」，也可将它拖到 Dock。此应用采用本机临时签名、未经 Apple 公证；首次若被系统拦截，请在系统设置的隐私与安全性页面选择「仍要打开」。
3. 豆包已运行时，启动器会提示先保存未发送的内容，再退出并重开。
4. 在豆包窗口按 `⌘⌥B` 打开素材设置；可替换头像、主画面、动态视频和三处文字。点击「保存并预览」后，素材保存在本机的 IndexedDB，主界面背景随之更新。按 `Esc` 可跳过动画。
5. 按住 `⌥` 点击 Dock 上的「豆包动态启动」进入图标设置，可选择 PNG/JPEG/WebP 照片制作圆角图标，或恢复默认图标。这会重新签名本机启动器并刷新 Dock，不会修改豆包应用。

图片支持 PNG/JPEG/WebP，大小不超过 30 MB；视频支持 MP4/WebM，大小不超过 50 MB、最高 1080p、时长至少 1 秒。动态视频和主画面请使用同一场景，这样切换才自然。

## Windows 使用

1. 从[豆包官网](https://www.doubao.com/download/desktop)安装桌面版豆包。从 Releases 下载并解压 `豆包动态启动-Windows.zip` 到 Windows 本地磁盘；压缩包已包含 Windows x64 运行程序，无需另装 Node.js。
2. 双击解压目录中的 `Windows/豆包动态启动.cmd`。首次运行选择豆包安装目录中的 `Doubao.exe`；若存在 `app/Doubao.exe`，启动器会使用该主程序。以后会记住所选路径。
3. 如果豆包已经在运行，请先保存未发送的内容并完全退出，再双击启动器。进入豆包后按 `Ctrl+Alt+B` 更换头像、画面、视频和文字；按 `Esc` 跳过动画。

Windows 版与 macOS 版使用相同的页面样式和素材设置。公开压缩包只含示例图；可自行放入 `assets/avatar.jpg`、`assets/artwork.jpg`、`assets/startup.mp4`，或在豆包内用快捷键替换。首次运行的脚本会检查所选豆包程序的 Windows 签名，且只连接该程序在 `127.0.0.1` 打开的调试端口。启动器是普通批处理入口，首次运行可能出现终端窗口。当前版本尚未在 Windows 实机验证，豆包版本更新也可能改变内部页面地址；如果出现“尚未找到主窗口”，请反馈该版本号。

## 构建

macOS 构建需要 macOS 12+、Xcode 命令行工具和 Node.js 20+。Windows 压缩包的构建脚本会下载并校验官方 Node.js 22 Windows x64 运行程序。

```sh
node --test tools/extension.test.mjs
./tools/build.sh
./tools/build-windows.sh
```

产物在 `dist/豆包动态启动.app` 和 `dist/豆包动态启动-Windows.zip`。可选的本地默认素材是 `assets/avatar.jpg`、`assets/artwork.jpg` 和 `assets/startup.mp4`；没有这些文件时使用仓库内的示例 SVG，视频部分留空。个人媒体文件和构建产物被 `.gitignore` 排除，公开仓库只包含可替换的源码与示例素材。

## Codex Skill

公开 Skill 位于 [`skills/doubao-startup/SKILL.md`](skills/doubao-startup/SKILL.md)，用于指导安装、换素材和构建。将整个 `skills/doubao-startup` 文件夹复制到 `~/.codex/skills/`（Windows 为 `%USERPROFILE%\.codex\skills\`），重开 Codex 后可用 `$doubao-startup` 调用。Releases 也提供单独的 Skill ZIP。

## 原理与限制

启动器检查豆包的签名和安装路径，使用仅监听本机 `127.0.0.1` 的调试端口，在豆包主页面临时放入一个动画 iframe。动画结束即移除覆盖层，主界面保留动态壁纸。窗口隐藏时视频暂停，系统开启「减少动态效果」时只显示静态画面。豆包更新后，内部页面结构若发生变化，可能需要更新 `extension/cdp.mjs` 和 `extension/wallpaper.css`。从豆包原图标进入时不会加载这些效果，请从独立启动器进入。

此项目是非官方的本地扩展，不隶属豆包。发布他人创作的图片或视频前，请确认你拥有相应权利。
