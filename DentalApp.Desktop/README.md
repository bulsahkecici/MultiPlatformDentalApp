# WPF Desktop Application - Dental Management System

## Overview
This is a WPF desktop application built with MVVM pattern for managing dental practice operations.

## Prerequisites
- .NET 8.0 SDK or later
- Visual Studio 2022 (recommended) or Visual Studio Code
- Backend API running on http://localhost:3000

## Project Structure

```
DentalApp.Desktop/
├── Models/              # Data models
│   └── Models.cs        # User, Patient, Appointment, Treatment, Notification
├── ViewModels/          # MVVM ViewModels (to be implemented)
│   ├── LoginViewModel.cs
│   ├── MainViewModel.cs
│   ├── PatientListViewModel.cs
│   └── ...
├── Views/               # XAML Views (to be implemented)
│   ├── LoginWindow.xaml
│   ├── MainWindow.xaml
│   ├── PatientListView.xaml
│   └── ...
├── Services/            # Business services
│   ├── ApiService.cs    # HTTP API client
│   ├── AuthService.cs   # Authentication
│   └── NotificationService.cs  # SignalR notifications
├── Helpers/             # MVVM helpers
│   ├── ObservableObject.cs  # Base class for ViewModels
│   └── RelayCommand.cs      # ICommand implementation
└── App.xaml             # Application entry point
```

## Features Implemented

### ✅ Core Infrastructure
- **MVVM Pattern**: ObservableObject and RelayCommand helpers
- **Data Models**: User, Patient, Appointment, Treatment, Notification
- **API Service**: HTTP client for backend communication
- **Auth Service**: Login/logout functionality
- **Notification Service**: SignalR client for real-time updates

### 📋 To Be Implemented

#### ViewModels
- `LoginViewModel` - Handle login form and authentication
- `MainViewModel` - Main window navigation and state
- `PatientListViewModel` - Display and manage patients
- `PatientDetailsViewModel` - View/edit patient details
- `AppointmentViewModel` - Schedule and manage appointments
- `TreatmentViewModel` - Record and view treatments
- `DashboardViewModel` - Statistics and overview

#### Views (XAML)
- `LoginWindow.xaml` - Login form
- `MainWindow.xaml` - Main application window with navigation
- `PatientListView.xaml` - Patient list with search
- `PatientDetailsView.xaml` - Patient details form
- `AppointmentView.xaml` - Appointment calendar and form
- `TreatmentView.xaml` - Treatment records
- `DashboardView.xaml` - Dashboard with charts

## Building and Running

### 1. Restore NuGet Packages
```bash
cd DentalApp.Desktop
dotnet restore
```

### 2. Build the Project
```bash
dotnet build
```

### 3. Run the Application
```bash
dotnet run
```

Or open in Visual Studio and press F5.

## NuGet Packages

- **Microsoft.AspNetCore.SignalR.Client** (8.0.0) - SignalR client for real-time notifications
- **Newtonsoft.Json** (13.0.3) - JSON serialization
- **MaterialDesignThemes** (5.0.0) - Material Design UI components
- **MaterialDesignColors** (3.0.0) - Material Design color palette

## Configuration

Update `ApiService.cs` to change the backend URL:
```csharp
public string BaseUrl { get; set; } = "http://localhost:3000";
```

## Example Usage

### Login
```csharp
var apiService = new ApiService();
var authService = new AuthService(apiService);

bool success = await authService.LoginAsync("admin@mail.com", "Admin@123456");
if (success)
{
    // Navigate to main window
}
```

### Fetch Patients
```csharp
var response = await apiService.GetAsync<PatientsResponse>("/api/patients?limit=20");
var patients = response.Patients;
```

### Real-time Notifications
```csharp
var notificationService = new NotificationService();
notificationService.NotificationReceived += (sender, notification) =>
{
    // Handle notification
    MessageBox.Show(notification);
};

await notificationService.ConnectAsync(accessToken);
```

## Next Steps

1. **Implement ViewModels**: Create ViewModels for each view
2. **Create XAML Views**: Design UI with Material Design
3. **Add Navigation**: Implement navigation service
4. **Data Binding**: Bind ViewModels to Views
5. **Error Handling**: Add try-catch and user feedback
6. **Testing**: Unit tests for ViewModels and Services

## Material Design Integration

The project includes MaterialDesignThemes. To use it:

1. Add to App.xaml:
```xaml
<Application.Resources>
    <ResourceDictionary>
        <ResourceDictionary.MergedDictionaries>
            <materialDesign:BundledTheme BaseTheme="Light" PrimaryColor="DeepPurple" SecondaryColor="Lime" />
            <ResourceDictionary Source="pack://application:,,,/MaterialDesignThemes.Wpf;component/Themes/MaterialDesignTheme.Defaults.xaml" />
        </ResourceDictionary.MergedDictionaries>
    </ResourceDictionary>
</Application.Resources>
```

2. Use Material Design controls in XAML:
```xaml
<materialDesign:Card Padding="32" Margin="16">
    <TextBox materialDesign:HintAssist.Hint="Email" />
</materialDesign:Card>
```

## License
ISC
