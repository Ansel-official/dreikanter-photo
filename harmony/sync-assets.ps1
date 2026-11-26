# 把 Web 资源同步进 HarmonyOS 工程的 rawfile
# 用法：在仓库根目录执行 powershell -ExecutionPolicy Bypass -File .\harmony\sync-assets.ps1
# 说明：rawfile 是只读资源区，Web 组件用 $rawfile('index.html') 加载，相对路径自动解析到 resource://rawfile/**

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot                                            # harmony/
$app = Split-Path -Parent $root                                  # 仓库根
$dst = Join-Path $root 'entry\src\main\resources\rawfile'

if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Force $dst | Out-Null

# 只同步运行期需要的东西：页面 / 样式 / 脚本 / 图标 / manifest
Copy-Item (Join-Path $app 'index.html') $dst
Copy-Item (Join-Path $app 'manifest.webmanifest') $dst
Copy-Item (Join-Path $app 'css') $dst -Recurse
Copy-Item (Join-Path $app 'js') $dst -Recurse
Copy-Item (Join-Path $app 'icons') $dst -Recurse
Copy-Item (Join-Path $app 'LICENSE') $dst

# sw.js 不进包：rawfile 下没有 Service Worker
$files = (Get-ChildItem $dst -Recurse -File | Measure-Object).Count
$size = [math]::Round(((Get-ChildItem $dst -Recurse -File | Measure-Object Length -Sum).Sum / 1KB), 0)
Write-Host "[sync] rawfile 就绪：$files 个文件 / $size KB -> $dst" -ForegroundColor Green
