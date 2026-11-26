# Dreikanter photo — WebView2 桌面端构建
# 用法：powershell -ExecutionPolicy Bypass -File .\desktop\webview2\build.ps1
# 产物：desktop\webview2\build\Dreikanter photo.exe（约 1.5 MB）

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot                       # desktop\webview2
$repo = Split-Path -Parent (Split-Path -Parent $here)   # 仓库根
$out = Join-Path $here 'build'
$lib = Join-Path $here 'lib'

$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { throw "找不到 csc.exe：$csc（需要 .NET Framework 4.x）" }

foreach ($dll in @('Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll', 'WebView2Loader.dll')) {
    if (-not (Test-Path (Join-Path $lib $dll))) { throw "缺少 $dll，请确认 desktop\webview2\lib 完整" }
}

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force $out, (Join-Path $out 'app') | Out-Null

Write-Host '[1/4] 编译 Program.cs' -ForegroundColor Cyan
& $csc /nologo /target:winexe /platform:x64 /optimize+ `
    "/out:$out\Dreikanter photo.exe" `
    /r:System.Windows.Forms.dll /r:System.Drawing.dll `
    "/r:$lib\Microsoft.Web.WebView2.Core.dll" `
    "/r:$lib\Microsoft.Web.WebView2.WinForms.dll" `
    (Join-Path $here 'Program.cs')
if ($LASTEXITCODE -ne 0) { throw 'csc 编译失败' }

Write-Host '[2/4] 拷运行时 DLL' -ForegroundColor Cyan
foreach ($dll in @('Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll', 'WebView2Loader.dll')) {
    Copy-Item (Join-Path $lib $dll) $out -Force
}

Write-Host '[3/4] 同步网页资源' -ForegroundColor Cyan
Copy-Item (Join-Path $repo 'index.html') (Join-Path $out 'app')
Copy-Item (Join-Path $repo 'manifest.webmanifest') (Join-Path $out 'app')
Copy-Item (Join-Path $repo 'LICENSE') (Join-Path $out 'app')
Copy-Item (Join-Path $repo 'css') (Join-Path $out 'app') -Recurse
Copy-Item (Join-Path $repo 'js') (Join-Path $out 'app') -Recurse
Copy-Item (Join-Path $repo 'icons') (Join-Path $out 'app') -Recurse
Remove-Item (Join-Path $out 'app\icons\icon.html') -ErrorAction SilentlyContinue

$files = Get-ChildItem $out -Recurse -File
$total = ($files | Measure-Object Length -Sum).Sum
$mb = [math]::Round($total / 1MB, 2)
Write-Host "[4/4] 完成：$out（$($files.Count) 个文件 / $mb MB）" -ForegroundColor Green
Write-Host "      双击 `"$out\Dreikanter photo.exe`" 即可运行" -ForegroundColor DarkGray
