#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
archive=.build/node-v22.23.3-win-x64.zip
checksum=2b0ff57b049cda1bbcea2240eec20467018713c1efe1f7360c2681859b90ed71
mkdir -p .build dist
if [[ ! -f "$archive" ]]; then
  curl -fsSL --retry 2 -o "$archive" https://nodejs.org/dist/v22.23.3/node-v22.23.3-win-x64.zip
fi
printf '%s  %s\n' "$checksum" "$archive" | shasum -a 256 -c -
bundle="dist/豆包动态启动-Windows"
rm -rf "$bundle" "${bundle}.zip"
mkdir -p "$bundle/Windows" "$bundle/assets" "$bundle/extension" "$bundle/runtime"
cp Windows/launch.ps1 Windows/豆包动态启动.cmd "$bundle/Windows/"
cp README.md index.html style.css animation.js image-settings.js "$bundle/"
cp assets/sample-*.svg "$bundle/assets/"
for name in artwork.jpg avatar.jpg startup.mp4; do
  if [[ -f "assets/$name" ]]; then cp "assets/$name" "$bundle/assets/"; fi
done
cp extension/{cdp,payload,renderer,run-win,drive}.mjs extension/{wallpaper,drive}.css "$bundle/extension/"
unzip -p "$archive" node-v22.23.3-win-x64/node.exe > "$bundle/runtime/node.exe"
unzip -p "$archive" node-v22.23.3-win-x64/LICENSE > "$bundle/runtime/NODE-LICENSE.txt"
python3 - "$bundle" <<'PY'
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import sys

bundle = Path(sys.argv[1])
with ZipFile(f'{bundle}.zip', 'w', ZIP_DEFLATED) as archive:
    for path in bundle.rglob('*'):
        if path.is_file():
            archive.write(path, path.relative_to(bundle.parent))
PY
printf 'Built: %s\n' "$PWD/${bundle}.zip"
