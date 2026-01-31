# Angular Web Application - Dental Management System

## Overview
Modern Angular web application for dental practice management with real-time notifications.

## Prerequisites
- Node.js 18+ and npm
- Angular CLI (`npm install -g @angular/cli`)
- Backend API running on http://localhost:3000

## Installation

```bash
cd dental-app-web
npm install
```

## Development Server

```bash
npm start
# or
ng serve
```

Navigate to `http://localhost:4200/`

## Build

```bash
# Development build
ng build

# Production build
ng build --configuration production
```

## Project Structure

```
dental-app-web/
├── src/
│   ├── app/
│   │   ├── core/                 # Core module (singleton services)
│   │   │   ├── services/
│   │   │   │   ├── api.service.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── signalr.service.ts
│   │   │   ├── guards/
│   │   │   │   └── auth.guard.ts
│   │   │   ├── interceptors/
│   │   │   │   └── auth.interceptor.ts
│   │   │   └── models/
│   │   │       └── models.ts
│   │   ├── features/             # Feature modules (to be implemented)
│   │   │   ├── auth/
│   │   │   ├── patients/
│   │   │   ├── appointments/
│   │   │   ├── treatments/
│   │   │   └── dashboard/
│   │   └── shared/               # Shared module (to be implemented)
│   │       ├── components/
│   │       └── pipes/
│   ├── assets/
│   ├── environments/
│   └── styles.scss
├── angular.json
├── package.json
└── tsconfig.json
```

## Features Implemented

### ✅ Core Services
- **ApiService**: HTTP client wrapper for backend API
- **AuthService**: Authentication with JWT tokens
- **SignalRService**: Real-time notifications via SignalR
- **AuthInterceptor**: Automatic token injection
- **AuthGuard**: Route protection

### ✅ Models
- User, Patient, Appointment, Treatment, Notification interfaces
- PaginatedResponse generic type

### 📋 To Be Implemented

#### Feature Modules

**Auth Module**
- Login component
- Register component
- Password reset component

**Patients Module**
- Patient list component
- Patient details component
- Patient form component
- Patient service

**Appointments Module**
- Appointment list component
- Appointment calendar component
- Appointment form component
- Appointment service

**Treatments Module**
- Treatment list component
- Treatment form component
- Treatment service

**Dashboard Module**
- Dashboard component with statistics
- Charts and graphs

#### Shared Components
- Navbar
- Sidebar
- Notification toast
- Loading spinner
- Confirmation dialog

## Dependencies

### Core
- **@angular/core** ^17.0.0
- **@angular/router** ^17.0.0
- **@angular/forms** ^17.0.0
- **@angular/common** ^17.0.0

### UI
- **@angular/material** ^17.0.0 - Material Design components

### Real-time
- **@microsoft/signalr** ^8.0.0 - SignalR client

### Utilities
- **rxjs** ~7.8.0 - Reactive programming

## Configuration

### Environment Variables

**development** (`src/environments/environment.ts`):
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  socketUrl: 'http://localhost:3000'
};
```

**production** (`src/environments/environment.prod.ts`):
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://your-api.com',
  socketUrl: 'https://your-api.com'
};
```

## Usage Examples

### Authentication
```typescript
constructor(private authService: AuthService) {}

login() {
  this.authService.login(email, password).subscribe({
    next: (response) => {
      console.log('Logged in:', response.user);
      // Navigate to dashboard
    },
    error: (error) => {
      console.error('Login failed:', error);
    }
  });
}
```

### API Calls
```typescript
constructor(private apiService: ApiService) {}

getPatients() {
  this.apiService.get<any>('/api/patients', { limit: 20 }).subscribe({
    next: (response) => {
      this.patients = response.patients;
    }
  });
}
```

### Real-time Notifications
```typescript
constructor(
  private signalrService: SignalrService,
  private authService: AuthService
) {}

ngOnInit() {
  const token = this.authService.getAccessToken();
  if (token) {
    this.signalrService.connect(token);
    
    this.signalrService.notification$.subscribe(notification => {
      console.log('New notification:', notification);
      // Show toast notification
    });
  }
}
```

## Material Design Setup

Add to `app.component.ts` or `app.module.ts`:
```typescript
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
// ... other material modules
```

## Routing Example

```typescript
const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    canActivate: [AuthGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'patients', component: PatientListComponent },
      { path: 'appointments', component: AppointmentListComponent },
      { path: 'treatments', component: TreatmentListComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];
```

## Next Steps

1. **Create Feature Modules**: Implement auth, patients, appointments, treatments modules
2. **Build Components**: Create UI components with Material Design
3. **Add Routing**: Configure routing with lazy loading
4. **Implement Forms**: Reactive forms for data entry
5. **Add State Management**: Consider NgRx or Akita for complex state
6. **Testing**: Unit tests and E2E tests
7. **Deployment**: Build and deploy to hosting (Netlify, Vercel, etc.)

## License
ISC
