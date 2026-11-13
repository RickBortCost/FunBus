using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace FunBus;

public static class Program
{
    private static long _lastPing = Environment.TickCount64;
    private static bool _pinged;
    private const long IdleTimeoutMs = 150_000;

    public static void Main(string[] args)
    {
        var exeDir = Path.GetDirectoryName(Environment.ProcessPath) ?? AppContext.BaseDirectory;
        var contentDir = Path.Combine(exeDir, "content");
        // Cartella dati dell'utente (creata se manca); se non è disponibile si usa la cartella dell'exe, mai quella corrente.
        var dataRoot = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData, Environment.SpecialFolderOption.Create);
        if (string.IsNullOrEmpty(dataRoot)) dataRoot = exeDir;
        var stateDir = Path.Combine(dataRoot, "FunBus");
        Directory.CreateDirectory(stateDir);
        MigrateOldState(stateDir);
        var stateFile = Path.Combine(stateDir, "state.json");

        var embedded = new ManifestEmbeddedFileProvider(typeof(Program).Assembly, "wwwroot");

        if (args.Contains("--export-content"))
        {
            ExportContent(embedded, contentDir);
            return;
        }

        IFileProvider files = Directory.Exists(contentDir)
            ? new CompositeFileProvider(new PhysicalFileProvider(contentDir), embedded)
            : embedded;

        var port = PickPort(args);
        var url = $"http://127.0.0.1:{port}";

        try
        {
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args, ContentRootPath = exeDir });
            builder.WebHost.UseUrls(url);
            builder.Logging.ClearProviders();
            var app = builder.Build();

            app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = files });
            app.UseStaticFiles(new StaticFileOptions
            {
                FileProvider = files,
                OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "no-cache"
            });

            app.MapGet("/api/ping", () =>
            {
                _pinged = true;
                _lastPing = Environment.TickCount64;
                return Results.Ok();
            });

            var version = (typeof(Program).Assembly
                .GetCustomAttributes(typeof(System.Reflection.AssemblyInformationalVersionAttribute), false)
                .FirstOrDefault() as System.Reflection.AssemblyInformationalVersionAttribute)?.InformationalVersion ?? "dev";
            version = version.Split('+')[0];
            app.MapGet("/api/version", () => Results.Text(version, "text/plain"));

            app.MapGet("/api/state", () =>
                File.Exists(stateFile)
                    ? Results.Text(File.ReadAllText(stateFile, Encoding.UTF8), "application/json")
                    : Results.Text("{}", "application/json"));

            app.MapPut("/api/state", async (HttpRequest req) =>
            {
                using var reader = new StreamReader(req.Body, Encoding.UTF8);
                var body = await reader.ReadToEndAsync();
                if (body.Length > 1_000_000) return Results.BadRequest();
                var tmp = stateFile + ".tmp";
                await File.WriteAllTextAsync(tmp, body, Encoding.UTF8);
                File.Move(tmp, stateFile, true);
                return Results.Ok();
            });

            var lifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();
            _ = Task.Run(async () =>
            {
                while (!lifetime.ApplicationStopping.IsCancellationRequested)
                {
                    await Task.Delay(5000);
                    if (_pinged && Environment.TickCount64 - _lastPing > IdleTimeoutMs)
                        lifetime.StopApplication();
                }
            });

            if (!args.Contains("--no-browser"))
                lifetime.ApplicationStarted.Register(() => OpenUi(url));

            app.Run();
        }
        catch (Exception ex)
        {
            File.WriteAllText(Path.Combine(stateDir, "error.log"), ex.ToString());
        }
    }

    private static void MigrateOldState(string stateDir)
    {
        try
        {
            var dst = Path.Combine(stateDir, "state.json");
            var old = Path.Combine(Path.GetDirectoryName(stateDir)!, "IndustrialProtocolsLab", "state.json");
            if (!File.Exists(dst) && File.Exists(old)) File.Copy(old, dst);
        }
        catch { /* ignora */ }
    }

    private static int PickPort(string[] args)
    {
        var i = Array.IndexOf(args, "--port");
        if (i >= 0 && i + 1 < args.Length && int.TryParse(args[i + 1], out var p)) return p;
        foreach (var candidate in new[] { 5057, 0 })
        {
            try
            {
                var l = new TcpListener(IPAddress.Loopback, candidate);
                l.Start();
                var port = ((IPEndPoint)l.LocalEndpoint).Port;
                l.Stop();
                return port;
            }
            catch (SocketException) { }
        }
        return 5057;
    }

    private static void OpenUi(string url)
    {
        // Finestra "app" senza barra degli indirizzi: Edge (Windows 10/11), poi Chrome, infine il browser predefinito.
        foreach (var exe in new[] { "msedge", "chrome" })
        {
            try
            {
                Process.Start(new ProcessStartInfo(exe, $"--app={url} --window-size=1280,860") { UseShellExecute = true });
                return;
            }
            catch { /* prova il successivo */ }
        }
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
        catch { /* nessun browser disponibile */ }
    }

    private static void ExportContent(IFileProvider provider, string target)
    {
        CopyDir(provider, "", target);
    }

    private static void CopyDir(IFileProvider provider, string sub, string target)
    {
        Directory.CreateDirectory(target);
        // La radice va chiesta come "/": con la stringa vuota il provider dei file incorporati non restituisce nulla.
        foreach (var item in provider.GetDirectoryContents(string.IsNullOrEmpty(sub) ? "/" : sub))
        {
            var path = string.IsNullOrEmpty(sub) ? item.Name : sub + "/" + item.Name;
            if (item.IsDirectory)
            {
                CopyDir(provider, path, Path.Combine(target, item.Name));
            }
            else
            {
                using var src = item.CreateReadStream();
                using var dst = File.Create(Path.Combine(target, item.Name));
                src.CopyTo(dst);
            }
        }
    }
}
