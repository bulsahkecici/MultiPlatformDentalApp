namespace DentalApp.Desktop.Models
{
    public class User
    {
        public int Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public List<string> Roles { get; set; } = new();
        public bool EmailVerified { get; set; }
        public DateTime? LastLoginAt { get; set; }
    }

    public class LoginResponse
    {
        public string AccessToken { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
        public User User { get; set; } = new();
    }

    public class Patient
    {
        public int Id { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public DateTime? DateOfBirth { get; set; }
        public string? Gender { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? PostalCode { get; set; }
        public string? Country { get; set; }
        public string? BloodType { get; set; }
        public string? Allergies { get; set; }
        public string? MedicalConditions { get; set; }
        public string? CurrentMedications { get; set; }
        public string? EmergencyContactName { get; set; }
        public string? EmergencyContactPhone { get; set; }
        public string? InsuranceProvider { get; set; }
        public string? InsurancePolicyNumber { get; set; }
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class Appointment
    {
        public int Id { get; set; }
        public int PatientId { get; set; }
        public int DentistId { get; set; }
        public DateTime AppointmentDate { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
        public string? AppointmentType { get; set; }
        public string Status { get; set; } = "scheduled";
        public string? Notes { get; set; }
        public string? CancellationReason { get; set; }
        
        // Joined data
        public string? PatientFirstName { get; set; }
        public string? PatientLastName { get; set; }
        public string? DentistEmail { get; set; }
    }

    public class Treatment
    {
        public int Id { get; set; }
        public int PatientId { get; set; }
        public int? AppointmentId { get; set; }
        public int DentistId { get; set; }
        public DateTime TreatmentDate { get; set; }
        public string TreatmentType { get; set; } = string.Empty;
        public string? ToothNumber { get; set; }
        public string? Description { get; set; }
        public string? Diagnosis { get; set; }
        public string? ProcedureNotes { get; set; }
        public decimal? Cost { get; set; }
        public string Currency { get; set; } = "USD";
        public string Status { get; set; } = "completed";
        
        // Joined data
        public string? PatientFirstName { get; set; }
        public string? PatientLastName { get; set; }
        public string? DentistEmail { get; set; }
    }

    public class Notification
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public object? Data { get; set; }
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
