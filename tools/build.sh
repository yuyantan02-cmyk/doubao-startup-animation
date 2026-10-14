#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
target=${1:-x86_64}
case "$target" in
  x86_64) bundle="dist/豆包动态启动.app" ;;
  arm64) bundle="dist/豆包动态启动-AppleSilicon.app" ;;
  *) echo "用法：$0 [x86_64|arm64]" >&2; exit 2 ;;
esac
rm -rf "$bundle"
mkdir -p "$bundle/Contents/MacOS" "$bundle/Contents/Resources/web/assets" "$bundle/Contents/Resources/web/extension" ".build/module-cache-$target" .build/module-cache-host
swiftc -O -parse-as-library -target "$target-apple-macos12" -module-cache-path ".build/module-cache-$target" Native/Launcher.swift Native/Icon.swift -o "$bundle/Contents/MacOS/DoubaoStartup" -framework AppKit
cp index.html style.css animation.js image-settings.js "$bundle/Contents/Resources/web/"
cp assets/sample-artwork.svg assets/sample-avatar.svg "$bundle/Contents/Resources/web/assets/"
for name in artwork.jpg avatar.jpg startup.mp4; do
  if [[ -f "assets/$name" ]]; then cp "assets/$name" "$bundle/Contents/Resources/web/assets/"; fi
done
cp extension/*.mjs "$bundle/Contents/Resources/web/extension/"
cp extension/*.css "$bundle/Contents/Resources/web/extension/"
swiftc -O -parse-as-library -D ICON_RENDER_MAIN -module-cache-path .build/module-cache-host Native/Icon.swift -o .build/icon-render -framework AppKit
icon="assets/sample-avatar.svg"
if [[ -f assets/avatar.jpg ]]; then icon="assets/avatar.jpg"; fi
.build/icon-render "$icon" "$bundle/Contents/Resources/DoubaoStartup.icns"
cp "$bundle/Contents/Resources/DoubaoStartup.icns" "$bundle/Contents/Resources/OriginalIcon.icns"
cat > "$bundle/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>DoubaoStartup</string>
<key>CFBundleIdentifier</key><string>local.doubao.startup</string>
<key>CFBundleName</key><string>豆包动态启动</string>
<key>CFBundleDisplayName</key><string>豆包动态启动</string>
<key>CFBundleIconFile</key><string>DoubaoStartup.icns</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.2.1</string>
<key>CFBundleVersion</key><string>3</string>
<key>LSMinimumSystemVersion</key><string>12.0</string>
<key>LSUIElement</key><true/>
</dict></plist>
PLIST
codesign --force --sign - "$bundle"
printf 'Built: %s\n' "$PWD/$bundle"
