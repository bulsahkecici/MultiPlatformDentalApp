using System.Windows;
using System.IO;

namespace DentalApp.Desktop
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            DispatcherUnhandledException += (s, args) =>
            {
                try {
                    File.WriteAllText("crash_log.txt", args.Exception.ToString());
                } catch { }
                MessageBox.Show("An unexpected error occurred: " + args.Exception.Message);
                args.Handled = true;
                Shutdown();
            };

            base.OnStartup(e);
        }
    }
}

