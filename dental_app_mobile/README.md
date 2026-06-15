# Flutter Mobile Application — BULKA DENTAL

Cross-platform mobile app (Android & iOS) for dental practice management, aligned with the web panel's core workflows.

## Prerequisites

- Flutter SDK 3.x
- Dart SDK 3.x
- Android Studio / Xcode for emulators
- Backend API running on `http://localhost:3000`

## Setup

```bash
cd dental_app_mobile

# Generate android/ios folders if missing
flutter create . --project-name dental_app_mobile

flutter pub get
```

## Running

```bash
flutter run
flutter run -d <device-id>   # specific device
flutter run --release
```

## API Configuration

Base URL is defined in `lib/utils/constants.dart`:

| Platform | URL |
|----------|-----|
| Android emulator | `http://10.0.2.2:3000` |
| iOS simulator / desktop | `http://localhost:3000` |

## Project Structure

```
dental_app_mobile/
├── lib/
│   ├── main.dart
│   ├── models/
│   │   └── models.dart
│   ├── services/
│   │   └── api_service.dart
│   ├── providers/
│   │   ├── auth_provider.dart
│   │   ├── patient_provider.dart
│   │   └── appointment_provider.dart
│   ├── screens/
│   │   ├── login_screen.dart
│   │   ├── home_screen.dart
│   │   ├── main_shell.dart
│   │   ├── dashboard_screen.dart
│   │   ├── patient_list_screen.dart
│   │   ├── patient_form_screen.dart
│   │   ├── appointment_list_screen.dart
│   │   ├── treatment_list_screen.dart
│   │   ├── payments_screen.dart
│   │   ├── earnings_screen.dart
│   │   └── admin_screen.dart
│   └── utils/
│       └── constants.dart
├── pubspec.yaml
└── android/ ios/
```

## Features

### Authentication
- Login via `/api/auth/login`
- Session restore via `/api/auth/me`
- Refresh token rotation on 401 (`/api/auth/refresh`)
- Logout with token revocation

### Role-based navigation (drawer)
| Role | Screens |
|------|---------|
| Admin | Kontrol Paneli, Hastalar, Randevular, Tedaviler, Ödemeler, Kullanıcı Yönetimi |
| Secretary | Kontrol Paneli, Hastalar, Randevular, Tedaviler, Ödemeler |
| Dentist | Kontrol Paneli, Hastalar, Randevular, Tedaviler, Kazançlarım |

### Screens
- **Dashboard** — Admin stats from `/api/admin/statistics`; secretary/dentist upcoming appointments
- **Patients** — List, search, create/edit (CRUD via `/api/patients`)
- **Appointments** — Daily list from `/api/appointments`
- **Treatments** — Filterable list from `/api/treatments`
- **Payments** — Pending plans from `/api/payments/pending-plans` with approve/reject
- **Earnings** — Dentist earnings from `/api/dentist/earnings`
- **Admin** — User list from `/api/users`

## Dependencies

- `provider` — state management
- `http` — REST API client
- `shared_preferences` — token storage
- `intl` — Turkish date/currency formatting

## Building

```bash
flutter build apk
flutter build appbundle
flutter build ios   # requires macOS
```

## Not yet in mobile (~20% gap vs web)

- Appointment/treatment create forms and calendar scheduler
- Institution agreements and full payment tabs
- Admin user creation form
- SignalR real-time notifications
- Tooth chart / tariff selector

## License

ISC
