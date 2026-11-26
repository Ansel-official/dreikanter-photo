# 隐私政策 / Privacy Policy

**应用名称**：Dreikanter photo
**开发者**：Ansel Design（Apsis severs）
**版本**：18.2.0
**生效日期**：2026-11-26
**适用范围**：Windows 桌面版、Android 版、HarmonyOS（NEXT）版、Web 版

---

## 一、一句话说清楚

**Dreikanter photo 是一款完全在本地运行的图像编辑工具。我们不收集、不上传、不共享你的任何照片或个人信息。**

没有账号体系，没有登录，没有云同步，没有统计埋点，没有广告 SDK，没有第三方数据采集组件。

## 二、我们如何处理你的照片

| 环节 | 在哪里发生 | 是否离开设备 |
|---|---|---|
| 打开照片 | 你的设备内存 | 否 |
| 编辑（裁剪、调色、滤镜、曲线、图层合并…） | 你的设备 GPU/CPU | 否 |
| 存档（IndexedDB / 本地文件） | 你的设备存储 | 否 |
| 导出 JPG/PNG/WebP | 你的设备存储 | 否 |
| 批量处理 / 打包 ZIP | 你的设备 | 否 |

所有像素处理都在本机完成。应用**没有**任何把图片发往服务器的代码路径。

## 三、我们收集哪些信息

**我们不收集任何个人信息。**

具体来说，以下信息**均不收集**：

- 姓名、手机号、邮箱、身份证等身份信息；
- 位置、通讯录、日历、短信、通话记录；
- 设备标识符（IMEI / OAID / Android ID / IDFA 等）；
- 应用使用行为、点击埋点、崩溃日志（崩溃日志只写在本机内存，除非你主动「导出错误日志」并自己发送出去）；
- 你编辑的照片内容、文件名、元数据。

## 四、应用会请求的权限（以及为什么）

| 权限 | 触发时机 | 用途 | 拒绝后的影响 |
|---|---|---|---|
| 读取相册 / 照片（READ_IMAGEVIDEO / 照片选择器） | 你点「打开照片」时 | 让你选择一张本地图片进行编辑；选择由系统选择器完成，应用只能拿到你**主动选中**的那一张 | 无法从相册打开图片，但仍可新建画布、粘贴、或使用示例作品 |
| 写入存储 / 保存文件（导出） | 你点「导出」时 | 把编辑结果保存为图片文件 | 无法导出，其他编辑功能正常 |
| 剪贴板（粘贴图片） | 你按 Ctrl+V 时 | 从剪贴板读取图片作为图层 | 无法粘贴，其他功能正常 |

应用**不申请**：定位、相机、麦克风、通讯录、短信、后台常驻、自启动、悬浮窗等权限。

> 说明：Windows 与 Web 版不涉及系统权限申请（文件选择由系统对话框完成）。

## 五、数据的存储与删除

- **本地存储**：应用的存档（图层结构、历史快照、预设、动作、设置）存放在你设备的浏览器存储（localStorage / IndexedDB）或应用沙箱内。
- **保存位置**：全部在你自己的设备上，应用不做任何备份上传。
- **如何删除**：
  - 应用内：「存档」面板逐个删除，或「设置 → 清除本地数据」；
  - 系统层：卸载应用会一并清除沙箱数据；浏览器版可在站点设置里「清除站点数据」。

## 六、第三方服务

**本应用不接入任何第三方 SDK。** 不包含广告、统计、推送、社交分享、支付、地图等第三方组件。

界面中的外链（GitHub 仓库、ICP 备案查询）只在你主动点击时用系统浏览器打开，打开后适用对方网站的隐私政策，与本应用无关。

## 七、未成年人

本应用是通用图像编辑工具，不面向 14 周岁以下儿童单独设计，也不收集儿童个人信息。未成年人在监护人指导下使用即可。

## 八、数据出境

由于不收集、不上传任何数据，**不存在数据出境**。

## 九、政策变更

若未来版本新增联网功能（例如可选的云同步），我们会在应用内显著提示，并更新本政策、同步更新应用市场备案信息；在获得你明确同意前不会启用。

## 十、联系我们

- 邮箱：**Anselyoyo@outlook.com**
- 仓库 Issues：<https://github.com/Ansel-official/dreikanter-photo/issues>

我们会在收到请求后 15 个工作日内答复。

---

## English Summary

Dreikanter photo is a fully local image editor. It does **not** collect, transmit, or share any photos or personal data. There is no account system, no analytics, no ads, and no third-party SDKs. All image processing happens on your device. Permissions (photo library, file save, clipboard) are requested only when you actively use the corresponding feature, and denying them only disables that specific feature.

Contact: Anselyoyo@outlook.com

---

*本文件同时作为应用市场审核所需的「隐私政策」链接内容。部署到任意静态托管后，把 URL 填入应用市场后台即可（例如 GitHub Pages / Gitee Pages 的 `/PRIVACY.md` 或转成 HTML 的 `/privacy.html`）。*
