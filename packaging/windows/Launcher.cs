using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;
using Timer = System.Windows.Forms.Timer;

internal sealed class Launcher : Form
{
    private readonly Label status = new Label();
    private readonly Button open = new Button();
    private readonly Timer timer = new Timer();
    private readonly Stopwatch elapsed = new Stopwatch();
    private readonly string data = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "HCM Practice Lab Data");
    private Process server;
    private string address;
    private bool ready;
    private readonly bool smokeTest;
    public int Result { get; private set; }

    [STAThread]
    private static int Main(string[] args)
    {
        using (var mutex = new Mutex(false, @"Local\HCMPracticeLabLauncher"))
        {
            try
            {
                if (!mutex.WaitOne(0))
                {
                    MessageBox.Show("HCM Practice Lab is already running. Use its window to open the app.", "HCM Practice Lab");
                    return 1;
                }
            }
            catch (AbandonedMutexException) { }

            Application.EnableVisualStyles();
            using (var launcher = new Launcher(args.Length == 1 && args[0] == "--smoke-test"))
            {
                Application.Run(launcher);
                return launcher.Result;
            }
        }
    }

    private Launcher(bool smokeTest)
    {
        this.smokeTest = smokeTest;
        Text = "HCM Practice Lab";
        ClientSize = new Size(420, 144);
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        status.SetBounds(18, 20, 384, 48);
        status.Text = "Starting the local practice environment...";
        open.SetBounds(18, 86, 178, 32);
        open.Text = "Open in browser";
        open.Enabled = false;
        open.Click += (sender, args) => OpenBrowser();
        var stop = new Button { Text = "Stop and close" };
        stop.SetBounds(222, 86, 178, 32);
        stop.Click += (sender, args) => Close();
        Controls.AddRange(new Control[] { status, open, stop });
        timer.Interval = 400;
        timer.Tick += (sender, args) => CheckServer();
        Shown += (sender, args) => StartServer();
        FormClosed += (sender, args) =>
        {
            timer.Dispose();
            if (server != null)
            {
                if (!server.HasExited)
                {
                    server.Kill();
                    server.WaitForExit(5000);
                }
                server.Dispose();
            }
        };
    }

    private void StartServer()
    {
        try
        {
            var home = AppDomain.CurrentDomain.BaseDirectory;
            Directory.CreateDirectory(data);
            var database = Path.Combine(data, "practice.db");
            if (!File.Exists(database))
                File.Copy(Path.Combine(home, "seed.db"), database);

            var listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            var port = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            address = "http://127.0.0.1:" + port;
            var info = new ProcessStartInfo(Path.Combine(home, "node.exe"), "server.js")
            {
                WorkingDirectory = home,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            info.EnvironmentVariables.Remove("NODE_OPTIONS");
            info.EnvironmentVariables.Remove("NODE_PATH");
            info.EnvironmentVariables["HOSTNAME"] = "127.0.0.1";
            info.EnvironmentVariables["PORT"] = port.ToString();
            info.EnvironmentVariables["DATABASE_URL"] = "file:" + database.Replace('\\', '/');
            info.EnvironmentVariables["NEXT_TELEMETRY_DISABLED"] = "1";
            server = Process.Start(info);
            elapsed.Start();
            timer.Start();
        }
        catch (Exception error) { Fail(error.Message); }
    }

    private void CheckServer()
    {
        if (server.HasExited)
        {
            Fail("The local server stopped. Close the launcher and try opening it again.");
            return;
        }
        if (ready) return;
        try
        {
            var request = WebRequest.CreateHttp(address + "/api/session");
            request.Proxy = null;
            request.Timeout = 350;
            request.ReadWriteTimeout = 350;
            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
                ready = response.StatusCode == HttpStatusCode.OK &&
                    reader.ReadToEnd().Contains("\"HR Administrator\"");
        }
        catch (WebException) { }
        if (ready)
        {
            if (smokeTest) { Close(); return; }
            status.Text = "HCM Practice Lab is running. Leave this window open while you practise.";
            open.Enabled = true;
            OpenBrowser();
        }
        else if (elapsed.ElapsedMilliseconds > 35000)
            Fail("The local server did not become ready within 35 seconds.");
    }

    private void OpenBrowser()
    {
        try { Process.Start(new ProcessStartInfo(address) { UseShellExecute = true }); }
        catch (Exception) { status.Text = "Open this address in your browser: " + address; }
    }

    private void Fail(string message)
    {
        timer.Stop();
        Result = 1;
        open.Enabled = false;
        status.Text = message;
        if (smokeTest) Close();
    }
}
