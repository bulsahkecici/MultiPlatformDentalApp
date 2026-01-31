using Microsoft.AspNetCore.SignalR.Client;

namespace DentalApp.Desktop.Services
{
    public class NotificationService
    {
        private HubConnection? _connection;
        private readonly string _hubUrl;

        public event EventHandler<string>? NotificationReceived;

        public NotificationService(string baseUrl = "http://localhost:3000")
        {
            _hubUrl = $"{baseUrl}/socket.io/";
        }

        public async Task ConnectAsync(string accessToken)
        {
            _connection = new HubConnectionBuilder()
                .WithUrl(_hubUrl, options =>
                {
                    options.AccessTokenProvider = () => Task.FromResult<string?>(accessToken);
                })
                .WithAutomaticReconnect()
                .Build();

            _connection.On<object>("notification", (notification) =>
            {
                NotificationReceived?.Invoke(this, notification.ToString() ?? "");
            });

            await _connection.StartAsync();
        }

        public async Task DisconnectAsync()
        {
            if (_connection != null)
            {
                await _connection.StopAsync();
                await _connection.DisposeAsync();
                _connection = null;
            }
        }
    }
}
