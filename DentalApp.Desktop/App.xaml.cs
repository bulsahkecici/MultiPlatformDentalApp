using System.Windows;
using System.IO;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;

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
                try 
                {
                    var logMessage = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Unhandled Exception:\n" +
                                   $"Message: {args.Exception.Message}\n" +
                                   $"Type: {args.Exception.GetType().FullName}\n" +
                                   $"Stack Trace:\n{args.Exception.StackTrace}\n";
                    
                    if (args.Exception.InnerException != null)
                    {
                        logMessage += $"\nInner Exception:\n" +
                                    $"Message: {args.Exception.InnerException.Message}\n" +
                                    $"Stack Trace:\n{args.Exception.InnerException.StackTrace}\n";
                    }
                    
                    File.AppendAllText("crash_log.txt", logMessage + "\n" + new string('=', 80) + "\n\n");
                } 
                catch { }
                
                var errorMessage = $"Beklenmeyen bir hata oluştu:\n\n{args.Exception.Message}";
                if (args.Exception.InnerException != null)
                {
                    errorMessage += $"\n\nİç Hata: {args.Exception.InnerException.Message}";
                }
                errorMessage += "\n\nDetaylar crash_log.txt dosyasına kaydedildi.";
                
                MessageBox.Show(errorMessage, "Hata", MessageBoxButton.OK, MessageBoxImage.Error);
                args.Handled = true; // Uygulamanın kapanmasını önle
            };
            
            // TaskScheduler exception handler for async operations
            TaskScheduler.UnobservedTaskException += (s, args) =>
            {
                try
                {
                    var logMessage = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Unobserved Task Exception:\n" +
                                   $"Message: {args.Exception.Message}\n" +
                                   $"Type: {args.Exception.GetType().FullName}\n" +
                                   $"Stack Trace:\n{args.Exception.StackTrace}\n";
                    
                    File.AppendAllText("crash_log.txt", logMessage + "\n" + new string('=', 80) + "\n\n");
                }
                catch { }
                
                args.SetObserved(); // Exception'ı işaretle
            };

            base.OnStartup(e);
        }
    }
}

