# MultiPlatformDentalApp

A secure, full-featured dental practice management system built with Node.js, Express, and PostgreSQL.

## Features

### Security
- ✅ JWT authentication with refresh tokens (15min access, 7 day refresh)
- ✅ Account lockout after failed login attempts (5 attempts, 15min lockout)
- ✅ Password strength validation and history tracking
- ✅ Email verification and password reset
- ✅ IP-based rate limiting
- ✅ Comprehensive audit logging
- ✅ Role-based access control (RBAC)

### User Management
- ✅ User CRUD operations
- ✅ Role management (admin, user)
- ✅ Password change functionality
- ✅ Email verification workflow

### Dental Features
- ✅ Patient management (CRUD with medical history)
- ✅ Appointment scheduling (with conflict detection)
- ✅ Treatment records and tracking
- ✅ Medical records system
- ✅ Soft delete for all entities

## Prerequisites

- Node.js 18+
- PostgreSQL running locally (or accessible remotely)
- (Optional) SMTP server for email verification/password reset

## Environment

1. Copy `.env.example` to `.env`
2. Adjust the configuration:

```env
# Server
PORT=3000
APP_URL=http://localhost:3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dentalappdb
DB_USER=dentaluser
DB_PASS=StrongPass123!

# Security
JWT_SECRET=your-secret-key-change-in-production
MAX_FAILED_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=15

# Email (optional - set EMAIL_ENABLED=true to activate)
EMAIL_ENABLED=false
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Admin User
ADMIN_EMAIL=admin@mail.com
ADMIN_PASSWORD=Admin@123456
```

## Installation & Database

```bash
# Install dependencies
npm install

# Apply database schema
npm run db:migrate

# Create admin user
npm run db:seed:admin
```

## Development

```bash
npm run dev
```

## Production

```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login (returns access + refresh tokens)
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout (revoke refresh token)
- `POST /api/auth/request-reset` - Request password reset email
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/auth/verify-email/:token` - Verify email address
- `POST /api/auth/resend-verification` - Resend verification email

### Users (Admin only for most)
- `GET /api/users` - List users (admin)
- `POST /api/users` - Create user (admin)
- `GET /api/users/:id` - Get user (self or admin)
- `PUT /api/users/:id` - Update user (self or admin)
- `DELETE /api/users/:id` - Delete user (admin)
- `PUT /api/users/:id/password` - Change password (self)
- `PUT /api/users/:id/roles` - Update roles (admin)

### Patients (Authenticated users)
- `GET /api/patients` - List patients
- `POST /api/patients` - Create patient
- `GET /api/patients/:id` - Get patient details
- `PUT /api/patients/:id` - Update patient
- `DELETE /api/patients/:id` - Delete patient (admin)

### Appointments (Authenticated users)
- `GET /api/appointments` - List appointments
- `POST /api/appointments` - Create appointment
- `GET /api/appointments/:id` - Get appointment details
- `PUT /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Cancel appointment

### Treatments (Authenticated users)
- `GET /api/treatments` - List treatments
- `POST /api/treatments` - Create treatment record
- `GET /api/treatments/:id` - Get treatment details
- `PUT /api/treatments/:id` - Update treatment

### Health & Admin
- `GET /healthz` - Health check
- `GET /readyz` - Readiness check (includes DB)
- `GET /admin/status` - Admin status (requires admin role)

## Testing

```bash
npm test
```

## Security Features

### Account Lockout
- Accounts are locked after 5 failed login attempts
- Lockout duration: 15 minutes
- Automatic unlock after duration expires

### Password Policy
- Minimum 8 characters
- Must contain: uppercase, lowercase, number, special character
- Cannot reuse last 3 passwords
- Common passwords are blocked

### Rate Limiting
- General: 300 requests / 15 minutes per IP
- Auth endpoints: 10 requests / 15 minutes per IP
- Password reset: 3 requests / hour per IP
- Email verification: 5 requests / hour per IP

### Audit Logging
All security events and data modifications are logged:
- Login attempts (success/failure)
- Password changes and resets
- User/patient/appointment/treatment modifications
- Admin actions

## Architecture

```
src/
├── config/          # Configuration management
├── controllers/     # Business logic
├── middlewares/     # Auth, security, rate limiting
├── routes/          # API routes
├── utils/           # Utilities (logger, validators, email)
└── db.js            # Database connection pool
```

## License

ISC
