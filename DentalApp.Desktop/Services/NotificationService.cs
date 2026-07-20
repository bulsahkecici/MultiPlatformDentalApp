using System.Text.Json;
using SocketIOClient;

namespace DentalApp.Desktop.Services
{
    /// <summary>
    /// Gerçek zamanlı bildirim istemcisi (Socket.IO).
    /// Backend sözleşmesi (src/services/notificationHub.js):
    ///  - Kimlik doğrulama: handshake auth.token içinde JWT
    ///  - Eventler: 'connected', 'notification' ({type,title,message,data,timestamp})
    /// </summary>
    public class NotificationService
    {
        private SocketIOClient.SocketIO? _client;
        private readonly string _baseUrl;

        public event EventHandler<NotificationPayload>? NotificationReceived;
        public event EventHandler? Connected;

        public NotificationService(string baseUrl = "http://localhost:3000")
        {
            _baseUrl = baseUrl;
        }

        public async Task ConnectAsync(string accessToken)
        {
            await DisconnectAsync();

            _client = new SocketIOClient.SocketIO(_baseUrl, new SocketIOOptions
            {
                Path = "/socket.io/",
                Auth = new { token = accessToken },
                Reconnection = true,
                ReconnectionDelay = 2000,
            });

            _client.On("notification", response =>
            {
                try
                {
                    var element = response.GetValue<JsonElement>();
                    var payload = new NotificationPayload
                    {
                        Type = GetString(element, "type"),
                        Title = GetString(element, "title"),
                        Message = GetString(element, "message"),
                        Timestamp = GetString(element, "timestamp"),
                        RawJson = element.GetRawText(),
                    };
                    NotificationReceived?.Invoke(this, payload);
                }
                catch
                {
                    // Bozuk payload'ı yut — bildirim akışı uygulamayı düşürmemeli
                }
            });

            _client.On("connected", _ => Connected?.Invoke(this, EventArgs.Empty));

            await _client.ConnectAsync();
        }

        public async Task DisconnectAsync()
        {
            if (_client != null)
            {
                try
                {
                    await _client.DisconnectAsync();
                }
                catch
                {
                    // Bağlantı zaten kopmuş olabilir
                }
                _client.Dispose();
                _client = null;
            }
        }

        private static string GetString(JsonElement element, string property)
        {
            return element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
                ? value.GetString() ?? string.Empty
                : string.Empty;
        }
    }

    public class NotificationPayload
    {
        public string Type { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string Timestamp { get; set; } = string.Empty;
        public string RawJson { get; set; } = string.Empty;
    }
}
