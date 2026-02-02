using System.Windows;
using System.IO;
using System.Globalization;
using System.Threading;

namespace DentalApp.Desktop
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            // Set Turkish culture for DatePicker and other UI elements
            var turkishCulture = new CultureInfo("tr-TR");
            Thread.CurrentThread.CurrentCulture = turkishCulture;
            Thread.CurrentThread.CurrentUICulture = turkishCulture;
            CultureInfo.DefaultThreadCurrentCulture = turkishCulture;
            CultureInfo.DefaultThreadCurrentUICulture = turkishCulture;

            DispatcherUnhandledException += (s, args) =>
            {
                try {
                    File.WriteAllText("crash_log.txt", args.Exception.ToString());
                } catch { }
                MessageBox.Show("Beklenmeyen bir hata oluştu: " + args.Exception.Message);
                args.Handled = true;
                Shutdown();
            };

            base.OnStartup(e);
        }
    }
}

