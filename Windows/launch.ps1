$ErrorActionPreference = 'Stop'
try {
    $root = Split-Path -Parent $PSScriptRoot
    $saved = Join-Path $env:APPDATA 'DoubaoStartup\doubao-path.txt'
    $selected = if (Test-Path -LiteralPath $saved) { (Get-Content -LiteralPath $saved -Raw).Trim() } else { '' }
    if (-not $selected -or -not (Test-Path -LiteralPath $selected -PathType Leaf)) {
        Add-Type -AssemblyName System.Windows.Forms
        $picker = New-Object System.Windows.Forms.OpenFileDialog
        $picker.Title = '选择官方豆包安装目录中的 Doubao.exe'
        $picker.Filter = '豆包程序 (Doubao.exe)|Doubao.exe'
        if ($picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }
        $selected = $picker.FileName
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $saved) | Out-Null
        Set-Content -LiteralPath $saved -Value $selected -NoNewline -Encoding UTF8
    }
    $exe = Join-Path (Split-Path -Parent $selected) 'app\Doubao.exe'
    if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { $exe = $selected }
    if ((Split-Path -Leaf $exe) -ine 'Doubao.exe') { throw '请选择官方豆包的 Doubao.exe。' }
    if ((Get-AuthenticodeSignature -LiteralPath $exe).Status -ne 'Valid') { throw '豆包程序的 Windows 签名无效，请从官网重新安装。' }
    if (Get-Process -Name Doubao -ErrorAction SilentlyContinue) { throw '豆包已运行。请保存未发送的内容，完全退出豆包后再双击启动器。' }
    $node = Join-Path $root 'runtime\node.exe'
    if (-not (Test-Path -LiteralPath $node -PathType Leaf)) { $node = (Get-Command node.exe -ErrorAction Stop).Source }
    if ([int](& $node -p 'process.versions.node.split(".")[0]') -lt 22) { throw '需要 Node.js 22 或更新版本。' }
    & $node (Join-Path $root 'extension\run-win.mjs') --exe $exe
    if ($LASTEXITCODE -ne 0) { exit 1 }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
