using Newtonsoft.Json;
using Newtonsoft.Json.Converters;
using System.Linq;

namespace DentalApp.Desktop.Models
{
    public class User
    {
        [JsonProperty("id")]
        public int Id { get; set; }
        
        [JsonProperty("email")]
        public string Email { get; set; } = string.Empty;
        
        [JsonProperty("roles")]
        [JsonConverter(typeof(RolesConverter))]
        public List<string> Roles { get; set; } = new();
        
        [JsonProperty("emailVerified")]
        public bool EmailVerified { get; set; }
        
        [JsonProperty("lastLoginAt")]
        public DateTime? LastLoginAt { get; set; }
        
        [JsonProperty("firstName")]
        public string FirstName { get; set; } = string.Empty;
        
        [JsonProperty("lastName")]
        public string LastName { get; set; } = string.Empty;
        
        [JsonProperty("phone")]
        public string? Phone { get; set; }
        
        [JsonProperty("tcNo")]
        public string? TCNo { get; set; }
        
        [JsonProperty("createdAt")]
        public DateTime? CreatedAt { get; set; }
        
        [JsonIgnore]
        public string FullName => string.IsNullOrWhiteSpace(FirstName) && string.IsNullOrWhiteSpace(LastName) 
            ? Email 
            : $"{FirstName} {LastName}".Trim();
        
        [JsonIgnore]
        public string RoleDisplay => Roles.Count > 0 
            ? string.Join(", ", Roles.Select(r => r == "admin" ? "Patron" : r == "dentist" ? "Doktor" : r == "secretary" ? "Sekreter" : r))
            : "Kullanıcı";

        [JsonIgnore]
        public string CreatedAtDisplay => CreatedAt.HasValue ? CreatedAt.Value.ToString("dd.MM.yyyy HH:mm") : "—";

        [JsonIgnore]
        public string LastLoginAtDisplay => LastLoginAt.HasValue ? LastLoginAt.Value.ToString("dd.MM.yyyy HH:mm") : "—";
    }
    
    public class UsersResponse
    {
        [JsonProperty("users")]
        public List<User> Users { get; set; } = new();

        [JsonProperty("pagination")]
        public PaginationInfo Pagination { get; set; } = new();
    }

    /// <summary>GET /api/users/dentists yanıtı — dişhekimi seçicileri için.</summary>
    public class DentistsResponse
    {
        [JsonProperty("dentists")]
        public List<DentistDto> Dentists { get; set; } = new();
    }

    public class DentistDto
    {
        [JsonProperty("id")]
        public int Id { get; set; }

        [JsonProperty("email")]
        public string Email { get; set; } = string.Empty;

        [JsonProperty("firstName")]
        public string FirstName { get; set; } = string.Empty;

        [JsonProperty("lastName")]
        public string LastName { get; set; } = string.Empty;
    }

    public class RolesConverter : JsonConverter<List<string>>
    {
        public override List<string> ReadJson(JsonReader reader, Type objectType, List<string>? existingValue, bool hasExistingValue, JsonSerializer serializer)
        {
            if (reader.TokenType == JsonToken.String)
            {
                var str = reader.Value?.ToString() ?? "";
                return string.IsNullOrWhiteSpace(str) ? new List<string>() : str.Split(',').Select(r => r.Trim()).ToList();
            }
            else if (reader.TokenType == JsonToken.StartArray)
            {
                return serializer.Deserialize<List<string>>(reader) ?? new List<string>();
            }
            return new List<string>();
        }

        public override void WriteJson(JsonWriter writer, List<string>? value, JsonSerializer serializer)
        {
            if (value == null || value.Count == 0)
            {
                writer.WriteValue("");
            }
            else
            {
                writer.WriteValue(string.Join(",", value));
            }
        }
    }

    public class LoginResponse
    {
        [JsonProperty("accessToken")]
        public string AccessToken { get; set; } = string.Empty;
        
        [JsonProperty("refreshToken")]
        public string RefreshToken { get; set; } = string.Empty;
        
        [JsonProperty("user")]
        public User User { get; set; } = new();
    }

    public class Patient
    {
        [JsonProperty("id")]
        public int Id { get; set; }
        
        [JsonProperty("first_name")]
        public string FirstName { get; set; } = string.Empty;
        
        [JsonProperty("last_name")]
        public string LastName { get; set; } = string.Empty;
        
        [JsonProperty("date_of_birth")]
        public DateTime? DateOfBirth { get; set; }
        
        [JsonProperty("gender")]
        public string? Gender { get; set; }
        
        [JsonProperty("email")]
        public string? Email { get; set; }
        
        [JsonProperty("phone")]
        public string? Phone { get; set; }
        
        [JsonProperty("address")]
        public string? Address { get; set; }
        
        [JsonProperty("city")]
        public string? City { get; set; }
        
        [JsonProperty("postal_code")]
        public string? PostalCode { get; set; }
        
        [JsonProperty("country")]
        public string? Country { get; set; }
        
        [JsonProperty("blood_type")]
        public string? BloodType { get; set; }
        
        [JsonProperty("allergies")]
        public string? Allergies { get; set; }
        
        [JsonProperty("medical_conditions")]
        public string? MedicalConditions { get; set; }
        
        [JsonProperty("current_medications")]
        public string? CurrentMedications { get; set; }
        
        [JsonProperty("emergency_contact_name")]
        public string? EmergencyContactName { get; set; }
        
        [JsonProperty("emergency_contact_phone")]
        public string? EmergencyContactPhone { get; set; }
        
        [JsonProperty("insurance_provider")]
        public string? InsuranceProvider { get; set; }
        
        [JsonProperty("insurance_policy_number")]
        public string? InsurancePolicyNumber { get; set; }
        
        [JsonProperty("notes")]
        public string? Notes { get; set; }
        
        [JsonProperty("institution_agreement_id")]
        public int? InstitutionAgreementId { get; set; }
        
        [JsonProperty("institution_name")]
        public string? InstitutionName { get; set; }
        
        [JsonProperty("category_discounts")]
        public Dictionary<string, decimal>? CategoryDiscounts { get; set; }
        
        [JsonProperty("created_at")]
        public DateTime CreatedAt { get; set; }
        
        [JsonIgnore]
        public string FullName => $"{FirstName} {LastName}";
    }

    public class Appointment
    {
        [JsonProperty("id")]
        public int Id { get; set; }
        
        [JsonProperty("patient_id")]
        public int PatientId { get; set; }
        
        [JsonProperty("dentist_id")]
        public int? DentistId { get; set; }
        
        [JsonProperty("appointment_date")]
        public DateTime AppointmentDate { get; set; }
        
        [JsonProperty("start_time")]
        public TimeSpan StartTime { get; set; }
        
        [JsonProperty("end_time")]
        public TimeSpan EndTime { get; set; }
        
        [JsonProperty("appointment_type")]
        public string? AppointmentType { get; set; }
        
        [JsonProperty("status")]
        public string Status { get; set; } = "scheduled";
        
        [JsonProperty("notes")]
        public string? Notes { get; set; }
        
        [JsonProperty("cancellation_reason")]
        public string? CancellationReason { get; set; }
        
        // Joined data
        [JsonProperty("patient_first_name")]
        public string? PatientFirstName { get; set; }
        
        [JsonProperty("patient_last_name")]
        public string? PatientLastName { get; set; }
        
        [JsonProperty("dentist_email")]
        public string? DentistEmail { get; set; }

        [JsonProperty("dentist_first_name")]
        public string? DentistFirstName { get; set; }

        [JsonProperty("dentist_last_name")]
        public string? DentistLastName { get; set; }

        [JsonIgnore]
        public string PatientFullName => $"{PatientFirstName} {PatientLastName}".Trim();

        /// <summary>Ad/soyad varsa "Ad Soyad", yoksa e-postaya düşer (backend eski kayıtlarda isim döndürmeyebilir).</summary>
        [JsonIgnore]
        public string DentistDisplayName
        {
            get
            {
                var fullName = $"{DentistFirstName} {DentistLastName}".Trim();
                return string.IsNullOrWhiteSpace(fullName) ? (DentistEmail ?? "-") : fullName;
            }
        }

        [JsonIgnore]
        public DateTime AppointmentDateTime => AppointmentDate.Date.Add(StartTime);
    }

    public class Treatment
    {
        [JsonProperty("id")]
        public int Id { get; set; }
        
        [JsonProperty("patient_id")]
        public int PatientId { get; set; }
        
        [JsonProperty("appointment_id")]
        public int? AppointmentId { get; set; }
        
        [JsonProperty("dentist_id")]
        public int? DentistId { get; set; }
        
        [JsonProperty("treatment_date")]
        public DateTime TreatmentDate { get; set; }
        
        [JsonProperty("treatment_type")]
        public string TreatmentType { get; set; } = string.Empty;
        
        [JsonProperty("tooth_number")]
        public string? ToothNumber { get; set; }
        
        [JsonProperty("description")]
        public string? Description { get; set; }
        
        [JsonProperty("diagnosis")]
        public string? Diagnosis { get; set; }
        
        [JsonProperty("procedure_notes")]
        public string? ProcedureNotes { get; set; }
        
        [JsonProperty("cost")]
        public decimal? Cost { get; set; }
        
        [JsonProperty("currency")]
        public string Currency { get; set; } = "USD";
        
        [JsonProperty("status")]
        public string Status { get; set; } = "completed";
        
        // Joined data
        [JsonProperty("patient_first_name")]
        public string? PatientFirstName { get; set; }
        
        [JsonProperty("patient_last_name")]
        public string? PatientLastName { get; set; }
        
        [JsonProperty("dentist_email")]
        public string? DentistEmail { get; set; }
        
        [JsonIgnore]
        public string PatientFullName => $"{PatientFirstName} {PatientLastName}".Trim();
    }

    public class Notification
    {
        [JsonProperty("id")]
        public int Id { get; set; }
        
        [JsonProperty("user_id")]
        public int UserId { get; set; }
        
        [JsonProperty("type")]
        public string Type { get; set; } = string.Empty;
        
        [JsonProperty("title")]
        public string Title { get; set; } = string.Empty;
        
        [JsonProperty("message")]
        public string Message { get; set; } = string.Empty;
        
        [JsonProperty("data")]
        public object? Data { get; set; }
        
        [JsonProperty("is_read")]
        public bool IsRead { get; set; }
        
        [JsonProperty("created_at")]
        public DateTime CreatedAt { get; set; }
    }

    // Pagination models
    public class PaginationInfo
    {
        [JsonProperty("page")]
        public int Page { get; set; }
        
        [JsonProperty("limit")]
        public int Limit { get; set; }
        
        [JsonProperty("total")]
        public int Total { get; set; }
        
        [JsonProperty("pages")]
        public int Pages { get; set; }
    }

    public class PaginatedResponse<T>
    {
        [JsonProperty("pagination")]
        public PaginationInfo Pagination { get; set; } = new();
    }

    public class PatientsResponse : PaginatedResponse<Patient>
    {
        [JsonProperty("patients")]
        public List<Patient> Patients { get; set; } = new();
    }

    public class AppointmentsResponse : PaginatedResponse<Appointment>
    {
        [JsonProperty("appointments")]
        public List<Appointment> Appointments { get; set; } = new();
    }

    public class TreatmentsResponse : PaginatedResponse<Treatment>
    {
        [JsonProperty("treatments")]
        public List<Treatment> Treatments { get; set; } = new();
    }

    public class PatientResponse
    {
        [JsonProperty("patient")]
        public Patient Patient { get; set; } = new();
    }

    public class AppointmentResponse
    {
        [JsonProperty("appointment")]
        public Appointment Appointment { get; set; } = new();
    }

    public class TreatmentResponse
    {
        [JsonProperty("treatment")]
        public Treatment Treatment { get; set; } = new();
    }

    /// <summary>API yanıtı: GET /institution-agreements</summary>
    public class InstitutionAgreementsResponse
    {
        [JsonProperty("agreements")]
        public List<InstitutionAgreement> Agreements { get; set; } = new();
    }

    public class InstitutionAgreement
    {
        [JsonProperty("id")]
        public int Id { get; set; }
        
        [JsonProperty("institution_name")]
        public string InstitutionName { get; set; } = string.Empty;
        
        [JsonProperty("contact_person")]
        public string? ContactPerson { get; set; }
        
        [JsonProperty("contact_phone")]
        public string? ContactPhone { get; set; }
        
        [JsonProperty("contact_email")]
        public string? ContactEmail { get; set; }
        
        [JsonProperty("discount_percentage")]
        [JsonConverter(typeof(FlexibleDecimalConverter))]
        public decimal DiscountPercentage { get; set; }
        
        [JsonProperty("is_active")]
        public bool IsActive { get; set; }
        
        [JsonProperty("notes")]
        public string? Notes { get; set; }
        
        [JsonProperty("category_discounts")]
        public Dictionary<string, decimal>? CategoryDiscounts { get; set; }

        [JsonProperty("created_at")]
        public DateTime? CreatedAt { get; set; }

        [JsonProperty("updated_at")]
        public DateTime? UpdatedAt { get; set; }

        /// <summary>
        /// Kategori bazlı indirimler tanımlı değilse DiscountPercentage'ı, hepsi aynı
        /// orandaysa o ortak oranı, kategoriler arasında farklı oranlar varsa "Değişken"
        /// metnini gösterir (tek bir "genel indirim" sayısı artık yanıltıcı olur).
        /// </summary>
        [JsonIgnore]
        public string GeneralDiscountDisplay
        {
            get
            {
                if (CategoryDiscounts == null || CategoryDiscounts.Count == 0)
                    return $"{DiscountPercentage.ToString("0.##", System.Globalization.CultureInfo.CurrentCulture)}%";

                var distinctValues = CategoryDiscounts.Values.Distinct().ToList();
                return distinctValues.Count == 1
                    ? $"{distinctValues[0].ToString("0.##", System.Globalization.CultureInfo.CurrentCulture)}%"
                    : "Değişken";
            }
        }
    }

    public class CategoryDiscount
    {
        public string CategoryName { get; set; } = string.Empty;
        public decimal DiscountPercentage { get; set; }
    }

    /// <summary>JSON'da sayı veya string gelse de decimal'e çevirir (PostgreSQL/Node bazen string döner).</summary>
    public class FlexibleDecimalConverter : JsonConverter<decimal>
    {
        public override decimal ReadJson(JsonReader reader, Type objectType, decimal existingValue, bool hasExistingValue, JsonSerializer serializer)
        {
            if (reader.TokenType == JsonToken.Integer || reader.TokenType == JsonToken.Float)
                return Convert.ToDecimal(reader.Value);
            if (reader.TokenType == JsonToken.String && decimal.TryParse(reader.Value?.ToString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var d))
                return d;
            return 0m;
        }
        public override void WriteJson(JsonWriter writer, decimal value, JsonSerializer serializer) => writer.WriteValue(value);
    }
}
