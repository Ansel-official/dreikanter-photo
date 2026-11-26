# Dreikanter photo — HarmonyOS NEXT（鸿蒙 5.x）应用壳

> 目标设备：**HarmonyOS NEXT / HarmonyOS 5.x**（纯血鸿蒙，装不了 Android APK）。
> 做法：一个 ArkTS 原生壳，用 `Web` 组件加载打包进 `rawfile` 的网页版，功能与浏览器版一致。

---

## 1. 为什么要单独做 HAP

HarmonyOS NEXT 移除了安卓兼容层，`.apk` 根本不能装（安装器会直接拒绝，提示与备案/来源相关的笼统错误）。
NEXT 上能装的只有 **HAP**（HarmonyOS Ability Package），必须用 ArkTS + DevEco Studio 构建。

## 2. 工程结构

```
harmony/
├── AppScope/app.json5                    # bundleName = design.ansel.dreikanter
├── AppScope/resources/base/media/app_icon.png
├── build-profile.json5                   # compatibleSdkVersion 5.0.0(12)
├── hvigorfile.ts / oh-package.json5
├── hvigor/hvigor-config.json5
├── sync-assets.ps1                       # 把网页资源同步进 rawfile
└── entry/
    ├── build-profile.json5 / hvigorfile.ts / oh-package.json5
    └── src/main/
        ├── module.json5                  # Ability + 相册读取权限
        ├── ets/entryability/EntryAbility.ets   # 全屏沉浸、状态栏
        ├── ets/pages/Index.ets           # Web 组件 + 相册选择 + 返回键
        └── resources/
            ├── base/element/{string,color}.json
            ├── base/profile/main_pages.json
            ├── base/media/app_icon.png
            └── rawfile/                  # ← 由 sync-assets.ps1 生成（已 gitignore）
```

## 3. 三步跑起来

### ① 同步网页资源

```powershell
powershell -ExecutionPolicy Bypass -File .\harmony\sync-assets.ps1
```

会把 `index.html / css / js / icons / manifest / LICENSE` 复制到
`harmony/entry/src/main/resources/rawfile/`（约 48 个文件 / 790 KB）。

### ② 用 DevEco Studio 打开 `harmony/` 目录

- 需要 **DevEco Studio 5.0+**（自带 HarmonyOS SDK，装一次约 2 GB，Windows 版可用）；
- 首次打开会提示安装 SDK / 同步 hvigor，按提示点就行；
- **File → Project Structure → Signing Configs → 勾选 Automatically generate signature**，
  登录你的华为账号，DevEco 会自动生成调试证书（`.p7b`/`.cer`），不用手动配。

### ③ 连设备运行

1. 设备上：设置 → 关于手机 → 连点「版本号」7 次开启开发者模式；
2. 设置 → 系统 → 开发者选项 → 打开 **USB 调试**；
3. DevEco 顶部选中设备 → 点 ▶ Run；
   或者 Build → Build Hap(s) → 产物在 `entry/build/default/outputs/default/entry-default-signed.hap`，
   用命令行装：

```bash
hdc install entry/build/default/outputs/default/entry-default-signed.hap
```

> **调试签名 + hdc 安装不需要 App 备案**，也不经过应用市场审核。备案是「上架/公开分发」才要。

## 4. 打磨过的点

| 位置 | 处理 |
|---|---|
| `Index.ets` | `Web({ src: $rawfile('index.html') })` 加载本地网页，相对路径自动解析到 `resource://rawfile/` |
| 全屏 | `expandSafeArea` + `setWindowLayoutFullScreen(true)`，页面用 `env(safe-area-inset-*)` 让位 |
| 打开照片 | `onShowFileSelector` → 调 `PhotoViewPicker` 选图 → 复制到沙箱 → 交给 `<input type=file>` |
| 返回键 | `onBackPress()`：网页能后退就后退，否则退出应用 |
| 控制台 | `onConsole` / `onErrorReceive` 全部转发到 hilog，`hdc hilog | grep Dreikanter` 可看 |
| 暗色 | `WebDarkMode.On` + 页面自身深色，避免加载时白闪（`background #0f0f10`） |

## 5. 网页侧配合改动（v18.2）

- `js/pwa.js`：只有 `http(s)` 才注册 Service Worker。`resource://rawfile` 下没有 SW，
  之前只判 `file:` 会漏掉 `resource:`，导致控制台报错，现已改成协议白名单。
- `js/dialogs.js`：关于框的运行模式会显示「鸿蒙应用（resource://rawfile）」。

## 6. 已知限制

- **rawfile 只读**：网页版靠 IndexedDB 存存档，HAP 里同样可用（沙箱内），但导出的文件走系统下载/分享，位置不在相册；
- **Service Worker 不生效**：离线能力靠"资源本来就在包里"，无需缓存；
- **字体/主色**沿用系统字体，鸿蒙默认中文字体表现良好；
- 如果 `onShowFileSelector` 在你的机型上选完图没反应，先用浏览器版过渡（见下）。

## 7. 五分钟备选方案（不构建也行）

设备浏览器直接打开部署好的地址（Gitee Pages / 自建），菜单里选 **添加到桌面** ——
`manifest.webmanifest` + 192/512 图标 + cache-first 已就绪，装到桌面后断网也能开。
这条路**不需要 HAP、不需要备案**，适合先验证"手机上好不好用"，再决定要不要上架。
