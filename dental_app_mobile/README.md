# Flutter Mobile Application - Dental Management System

## Overview
Cross-platform mobile application (iOS & Android) for dental practice management built with Flutter.

## Prerequisites
- Flutter SDK 3.x
- Dart SDK 3.x
- Android Studio / Xcode for emulators
- Backend API running on http://localhost:3000

## Installation

```bash
cd dental_app_mobile
flutter pub get
```

## Running the App

```bash
# Run on connected device/emulator
flutter run

# Run on specific device
flutter devices
flutter run -d <device-id>

# Run in release mode
flutter run --release
```

## Building

```bash
# Android APK
flutter build apk

# Android App Bundle (for Play Store)
flutter build appbundle

# iOS (requires macOS)
flutter build ios
```

## Project Structure

```
dental_app_mobile/
├── lib/
│   ├── main.dart
│   ├── models/
│   │   └── models.dart          # Data models
│   ├── services/
│   │   ├── api_service.dart     # HTTP API client
│   │   └── signalr_service.dart # Real-time notifications
│   ├── providers/
│   │   ├── auth_provider.dart   # Authentication state
│   │   ├── patient_provider.dart
│   │   └── appointment_provider.dart
│   ├── screens/
│   │   ├── auth/
│   │   │   └── login_screen.dart
│   │   ├── patients/
│   │   │   ├── patient_list_screen.dart
│   │   │   └── patient_details_screen.dart
│   │   ├── appointments/
│   │   │   └── appointment_list_screen.dart
│   │   └── dashboard/
│   │       └── dashboard_screen.dart
│   ├── widgets/
│   │   ├── custom_app_bar.dart
│   │   ├── patient_card.dart
│   │   └── loading_indicator.dart
│   └── utils/
│       ├── constants.dart
│       └── validators.dart
├── pubspec.yaml
└── android/ios/
```

## Features Implemented

### ✅ Core Infrastructure
- **Models**: User, Patient, Appointment, Treatment
- **API Service**: HTTP client with token management
- **Auth Provider**: State management for authentication
- **Project Structure**: Organized folder structure

### 📋 To Be Implemented

#### Screens
- **Auth Screens**: Login, Register
- **Patient Screens**: List, Details, Form
- **Appointment Screens**: List, Calendar, Form
- **Treatment Screens**: List, Form
- **Dashboard**: Statistics and overview

#### Providers
- `PatientProvider` - Patient state management
- `AppointmentProvider` - Appointment state management
- `TreatmentProvider` - Treatment state management
- `NotificationProvider` - Notification handling

#### Services
- `SignalRService` - Real-time notifications
- `NotificationService` - Push notifications (FCM)

#### Widgets
- Custom app bar
- Patient card
- Appointment card
- Loading indicators
- Error dialogs

## Dependencies

### Core
- **flutter**: SDK
- **provider**: ^6.1.1 - State management

### Networking
- **http**: ^1.1.0 - HTTP client
- **signalr_netcore**: ^1.3.6 - SignalR client

### Storage
- **shared_preferences**: ^2.2.2 - Local storage

### Utilities
- **json_annotation**: ^4.8.1 - JSON serialization
- **intl**: ^0.18.1 - Internationalization

## Configuration

Update API URL in `lib/services/api_service.dart`:
```dart
ApiService({this.baseUrl = 'http://10.0.2.2:3000'}) // Android emulator
// or
ApiService({this.baseUrl = 'http://localhost:3000'}) // iOS simulator
```

## Usage Examples

### Authentication
```dart
final authProvider = Provider.of<AuthProvider>(context, listen: false);

await authProvider.login(email, password);

if (authProvider.isAuthenticated) {
  Navigator.pushReplacementNamed(context, '/dashboard');
}
```

### Fetch Patients
```dart
final apiService = ApiService();
final response = await apiService.get('/api/patients', params: {'limit': '20'});
final patients = (response['patients'] as List)
    .map((json) => Patient.fromJson(json))
    .toList();
```

### Provider Setup
```dart
void main() {
  final apiService = ApiService();
  
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider(apiService)),
        ChangeNotifierProvider(create: (_) => PatientProvider(apiService)),
      ],
      child: MyApp(),
    ),
  );
}
```

## Material Design

The app uses Material Design 3:
```dart
MaterialApp(
  theme: ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
  ),
  home: LoginScreen(),
);
```

## State Management

Using Provider pattern:
```dart
class PatientProvider with ChangeNotifier {
  List<Patient> _patients = [];
  
  List<Patient> get patients => _patients;
  
  Future<void> fetchPatients() async {
    // Fetch from API
    _patients = fetchedPatients;
    notifyListeners();
  }
}
```

## Navigation

```dart
MaterialApp(
  initialRoute: '/login',
  routes: {
    '/login': (context) => LoginScreen(),
    '/dashboard': (context) => DashboardScreen(),
    '/patients': (context) => PatientListScreen(),
    '/appointments': (context) => AppointmentListScreen(),
  },
);
```

## Push Notifications (Firebase)

1. Add Firebase to your project
2. Configure `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
3. Add `firebase_messaging` dependency
4. Implement notification handling

## Testing

```bash
# Run tests
flutter test

# Run integration tests
flutter test integration_test
```

## Deployment

### Android
1. Update `android/app/build.gradle` with signing config
2. Build: `flutter build appbundle`
3. Upload to Google Play Console

### iOS
1. Configure signing in Xcode
2. Build: `flutter build ios`
3. Archive and upload to App Store Connect

## Next Steps

1. **Implement Screens**: Create UI for all features
2. **Add Providers**: Implement state management for all entities
3. **SignalR Integration**: Real-time notifications
4. **Push Notifications**: Firebase Cloud Messaging
5. **Offline Support**: Local database with sqflite
6. **Testing**: Unit and widget tests
7. **CI/CD**: Automated builds and deployments

## License
ISC
