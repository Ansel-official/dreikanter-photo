# =============================================================================
#  Dreikanter photo — Android 手工打包（aapt2 + javac + d8 + zipalign + apksigner）
#  用法： powershell -ExecutionPolicy Bypass -File .\build.ps1 -JavaHome <JDK> -Sdk <SDK>
#  产物： ..\dist\android\Dreikanter-photo-<版本>-android.apk
# =============================================================================
param(
    [string]$JavaHome = 'E:\toolchain\jdk-17',
    [string]$Sdk = 'E:\toolchain\android-sdk',
    [string]$BuildTools = '34.0.0',
    [string]$Platform = 'android-34',
    [string]$Version = '18.0',
    [string]$OutDir = ''
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$app = Split-Path -Parent $root
if (-not $OutDir) { $OutDir = Join-Path $app 'dist\android' }

$bt = Join-Path $Sdk "build-tools\$BuildTools"
$androidJar = Join-Path $Sdk "platforms\$Platform\android.jar"
$javac = Join-Path $JavaHome 'bin\javac.exe'
$keytool = Join-Path $JavaHome 'bin\keytool.exe'

foreach ($p in @($bt, $androidJar, $javac)) {
    if (-not (Test-Path $p)) { throw "缺少依赖：$p" }
}

$work = Join-Path $root 'build'
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Force $work, "$work\gen", "$work\classes", "$work\dex" | Out-Null

# --- 1. 把 Web 应用同步进 assets ------------------------------------------------
$assets = Join-Path $root 'assets'
if (Test-Path $assets) { Remove-Item $assets -Recurse -Force }
New-Item -ItemType Directory -Force $assets | Out-Null
Copy-Item (Join-Path $app 'index.html') $assets
Copy-Item (Join-Path $app 'manifest.webmanifest') $assets
Copy-Item (Join-Path $app 'sw.js') $assets
Copy-Item (Join-Path $app 'css') $assets -Recurse
Copy-Item (Join-Path $app 'js') $assets -Recurse
Copy-Item (Join-Path $app 'icons') $assets -Recurse
New-Item -ItemType Directory -Force (Join-Path $assets 'tests') | Out-Null
Copy-Item (Join-Path $app 'tests\*.js') (Join-Path $assets 'tests')
Write-Host '[1/8] assets 同步完成' -ForegroundColor Cyan

# --- 2. 图标 -------------------------------------------------------------------
$mip = Join-Path $root 'res\mipmap-xhdpi'
New-Item -ItemType Directory -Force $mip | Out-Null
$iconDst = Join-Path $mip 'ic_launcher.png'
if (-not (Test-Path $iconDst)) {
    $src = Join-Path $app 'icons\icon-192.png'
    if (Test-Path $src) { Copy-Item $src $iconDst } else { throw "缺图标：$src" }
}

# --- 3. 资源编译 ---------------------------------------------------------------
& "$bt\aapt2.exe" compile --dir (Join-Path $root 'res') -o "$work\res.zip" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'aapt2 compile 失败' }
Write-Host '[2/8] aapt2 compile' -ForegroundColor Cyan

# --- 4. 链接（同时生成 R.java） -------------------------------------------------
& "$bt\aapt2.exe" link -o "$work\base.apk" -I $androidJar `
    --manifest (Join-Path $root 'AndroidManifest.xml') `
    -A $assets --java "$work\gen" "$work\res.zip" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'aapt2 link 失败' }
Write-Host '[3/8] aapt2 link' -ForegroundColor Cyan

# --- 5. javac（警告不算失败，按产物判断） --------------------------------------
$javaFiles = @()
$javaFiles += Get-ChildItem (Join-Path $root 'src') -Recurse -Filter *.java | ForEach-Object { $_.FullName }
$javaFiles += Get-ChildItem "$work\gen" -Recurse -Filter *.java | ForEach-Object { $_.FullName }
& $javac -source 8 -target 8 -bootclasspath $androidJar -encoding UTF-8 -nowarn -d "$work\classes" $javaFiles 2>&1 | Out-Null
$classCount = (Get-ChildItem "$work\classes" -Recurse -Filter *.class -ErrorAction SilentlyContinue | Measure-Object).Count
if ($classCount -lt 1) { throw "javac 没产出 class（$classCount）" }
Write-Host "[4/8] javac（$classCount 个 class）" -ForegroundColor Cyan

# --- 6. d8 ---------------------------------------------------------------------
$classFiles = Get-ChildItem "$work\classes" -Recurse -Filter *.class | ForEach-Object { $_.FullName }
& "$bt\d8.bat" --lib $androidJar --min-api 24 --output "$work\dex" $classFiles 2>&1 | Out-Null
if (-not (Test-Path "$work\dex\classes.dex")) { throw 'd8 没有产出 classes.dex' }
Write-Host '[5/8] d8' -ForegroundColor Cyan

# --- 7. 重新打包（解包 aapt2 产物 + 塞 classes.dex + jar cf0M） ---
# 说明：aapt2 在 Windows 上会把 assets 子目录写成反斜杠，且 resources.arsc 必须是
# 「不压缩 + 4 字节对齐」（Android 11+ 要求）。这里用 jar 的 -0（store）重打一遍最稳。
$payload = Join-Path $work 'payload'
New-Item -ItemType Directory -Force $payload | Out-Null
# tar 能直接读 zip
& tar -xf "$work\base.apk" -C $payload
if ($LASTEXITCODE -ne 0) { throw '解包 base.apk 失败' }
Copy-Item "$work\dex\classes.dex" $payload -Force
$jar = Join-Path $JavaHome 'bin\jar.exe'
& $jar cf0M "$work\unsigned.apk" -C $payload .
if ($LASTEXITCODE -ne 0 -or -not (Test-Path "$work\unsigned.apk")) { throw 'jar 重新打包失败' }
Write-Host '[6/8] 重新打包（store + 正斜杠）' -ForegroundColor Cyan

# --- 8. zipalign + 签名 --------------------------------------------------------
& "$bt\zipalign.exe" -f -p 4 "$work\unsigned.apk" "$work\aligned.apk" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'zipalign 失败' }

$ks = Join-Path $root 'debug.keystore'
if (-not (Test-Path $ks)) {
    & $keytool -genkeypair -keystore $ks -alias androiddebugkey -storepass android -keypass android `
        -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Android Debug,O=Android,C=US' 2>&1 | Out-Null
    Write-Host '      已生成 debug.keystore' -ForegroundColor DarkGray
}
& "$bt\apksigner.bat" sign --ks $ks --ks-pass pass:android --key-pass pass:android `
    --min-sdk-version 24 --out "$work\app.apk" "$work\aligned.apk" 2>&1 | Out-Null
if (-not (Test-Path "$work\app.apk")) { throw 'apksigner 失败' }

New-Item -ItemType Directory -Force $OutDir | Out-Null
$final = Join-Path $OutDir "Dreikanter-photo-$Version-android.apk"
Copy-Item "$work\app.apk" $final -Force
Write-Host '[7/8] zipalign + 签名' -ForegroundColor Cyan

# --- 校验 ---------------------------------------------------------------------
& "$bt\apksigner.bat" verify --verbose $final 2>&1 | Select-String 'Verified|v1 scheme|v2 scheme|v3 scheme' | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
$size = [math]::Round((Get-Item $final).Length / 1MB, 2)
Write-Host "[8/8] APK 完成：$final（$size MB）" -ForegroundColor Green
