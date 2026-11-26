using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace DreikanterPhoto
{
    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm(args));
        }
    }

    internal sealed class MainForm : Form
    {
        private readonly WebView2 _web;
        private readonly string _webRoot;
        private readonly string _dataDir;

        public MainForm(string[] args)
        {
            Text = "Dreikanter photo";
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(1440, 900);
            MinimumSize = new Size(960, 640);
            BackColor = Color.FromArgb(15, 15, 16);
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

            _webRoot = ResolveWebRoot(args);
            _dataDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Dreikanter photo", "webview2");

            _web = new WebView2
            {
                Dock = DockStyle.Fill,
                DefaultBackgroundColor = Color.FromArgb(15, 15, 16)
            };
            Controls.Add(_web);

            Load += OnLoaded;
        }

        /// <summary>找网页资源：优先 exe 同级的 app\ 目录，其次 exe 所在目录</summary>
        private static string ResolveWebRoot(string[] args)
        {
            if (args != null && args.Length > 0 && Directory.Exists(args[0]) &&
                File.Exists(Path.Combine(args[0], "index.html")))
                return Path.GetFullPath(args[0]);

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string appDir = Path.Combine(baseDir, "app");
            if (File.Exists(Path.Combine(appDir, "index.html"))) return appDir;
            return baseDir;
        }

        private async void OnLoaded(object sender, EventArgs e)
        {
            try
            {
                Directory.CreateDirectory(_dataDir);
                var env = await CoreWebView2Environment.CreateAsync(null, _dataDir);
                await _web.EnsureCoreWebView2Async(env);

                var core = _web.CoreWebView2;

                // 把本地目录映射成 https://app.local/ —— 这样 localStorage / IndexedDB / 相对路径都按正常网页规则工作
                core.SetVirtualHostNameToFolderMapping(
                    "app.local", _webRoot, CoreWebView2HostResourceAccessKind.Allow);

                core.Settings.AreDefaultContextMenusEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.AreBrowserAcceleratorKeysEnabled = false;
                core.Settings.IsZoomControlEnabled = true;

                // 站内链接留在应用内，外链交给系统浏览器
                core.NewWindowRequested += (s2, ev) =>
                {
                    ev.Handled = true;
                    try { System.Diagnostics.Process.Start(ev.Uri); } catch { }
                };
                core.NavigationStarting += (s2, ev) =>
                {
                    if (!ev.Uri.StartsWith("https://app.local", StringComparison.OrdinalIgnoreCase))
                        ev.Cancel = true;
                    if (ev.Uri.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase) ||
                        ev.Uri.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                        ev.Uri.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                    {
                        if (!ev.Uri.StartsWith("https://app.local", StringComparison.OrdinalIgnoreCase))
                        {
                            try { System.Diagnostics.Process.Start(ev.Uri); } catch { }
                        }
                    }
                };

                // 网页里 <input type=file> 能正常弹系统选择框（WebView2 默认支持）
                core.Navigate("https://app.local/index.html");
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "无法启动 WebView2 运行时。" + Environment.NewLine + Environment.NewLine +
                    "请安装 Microsoft Edge WebView2 Runtime（Win10/11 一般自带）：" + Environment.NewLine +
                    "https://go.microsoft.com/fwlink/p/?LinkId=2124703" + Environment.NewLine + Environment.NewLine +
                    ex.Message,
                    "Dreikanter photo", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
            }
        }
    }
}
