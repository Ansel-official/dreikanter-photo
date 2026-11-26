# WebView2 瘦身版桌面端（~1.5 MB，替代 71 MB 的 Electron 包）

用系统自带的 **Microsoft Edge WebView2** 运行时承载同一套网页，产物只有 exe + 3 个 DLL + 网页资源。

## 为什么小

| 方案 | 体积 | 原因 |
|---|---|---|
| Electron `electron-builder` | 71 MB | 打包整套 Chromium + Node |
| **WebView2（本方案）** | **1.5 MB** | 复用系统已装的 Edge 内核 |

前提：Win10 1803+ / Win11 一般自带 WebView2 Runtime；精简系统可能没有，首次运行会弹提示并给下载链接。

## 构建

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop\webview2\build.ps1
```

产出：`desktop\webview2\build\Dreikanter photo.exe`（双击即用）。

脚本做的事：
1. 用 `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` 编译 `Program.cs`
2. 拷 `lib/` 里的 3 个 WebView2 DLL
3. 把 `index.html / css / js / icons` 同步到 `build\app\`
4. 打印最终体积

## 实现要点

- `SetVirtualHostNameToFolderMapping("app.local", <webRoot>, Allow)` → 网页跑在 `https://app.local/`，
  `localStorage` / `IndexedDB` / 相对路径 / fetch 全按正常网页规则工作，不用改一行前端代码
- 站内跳转留在应用内，外链交给系统浏览器（`NewWindowRequested` + `NavigationStarting`）
- `<input type=file>` 直接弹系统文件选择框（WebView2 原生支持）
- 用户数据落在 `%LOCALAPPDATA%\Dreikanter photo\webview2`，卸载删目录即可清干净
- 关掉默认右键菜单、状态栏、浏览器快捷键，看起来像原生应用

## 已知限制

- 需要系统装有 WebView2 Runtime（Win11 100% 有，Win10 绝大多数有）
- 没有 Electron 的「自动更新」能力，升级靠重新下包

## 文件

```
desktop/webview2/
├── Program.cs               # 254 行，WinForms + WebView2
├── build.ps1                # 一键编译 + 组装
├── lib/                     # 3 个运行时 DLL（来自 NuGet Microsoft.Web.WebView2 1.0.2592.51）
│   ├── Microsoft.Web.WebView2.Core.dll
│   ├── Microsoft.Web.WebView2.WinForms.dll
│   └── WebView2Loader.dll
└── build/                   # 构建产物（gitignore）
```
