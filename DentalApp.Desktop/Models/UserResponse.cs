using Newtonsoft.Json;

namespace DentalApp.Desktop.Models
{
    public class UserResponse
    {
        [JsonProperty("user")]
        public User User { get; set; } = new();
    }
}
