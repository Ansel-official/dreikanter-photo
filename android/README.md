# Dreikanter photo — Android 构建说明

> 纯本地 WebView 外壳：`android/assets/` 里就是桌面版同一份纯前端应用。
> 不用 Gradle、不用 Android Studio —— 只用 JDK + Android SDK 的 build-tools 手工出包。

## 依赖

| 组件 | 版本 | 说明 |
|---|---|---|
| JDK | 17+ | `javac` / `keytool` |
| Android SDK build-tools | 34.0.0 | `aapt2` / `d8` / `zipalign` / `apksigner` |
| Android platform | android-34 | `android.jar` |

SDK 可用 `sdkmanager` 装：

```bash
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

## 构建

```powershell
# JDK 与 SDK 路径按本机改
powershell -ExecutionPolicy Bypass -File .\build.ps1 `
  -JavaHome "E:\toolchain\jdk-17" `
  -Sdk "E:\toolchain\android-sdk"
```

产物：`../dist/android/Dreikanter-photo-18.0-android.apk`

## 说明

- 这是 **debug 签名** 的 APK，可直接侧载安装；上架应用商店需要换成自己的正式 keystore。
- WebView 用 `file:///android_asset/index.html` 载入，因此 Service Worker 不启用、IndexedDB 取决于系统 WebView 版本（应用会自动降级为会话内存档）。
- 想要更完整的 PWA 体验可以用 `WebViewAssetLoader` 换成 `https://appassets.androidplatform.net` 源，或在壳里起一个本地静态服务。
