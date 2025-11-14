# MultiPlatformDentalApp

## Prerequisites

- Node.js 18+
- PostgreSQL running locally (or accessible remotely)

## Environment

1. Copy `.env.example` to `.env`.
2. Adjust the PostgreSQL credentials if they differ from the defaults:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dentalappdb
DB_USER=dentaluser
DB_PASS=StrongPass123!
DB_SSL=false
JWT_SECRET=dev-secret
```

## Install & Database

```bash
npm install
npm run db:migrate
npm run db:seed:admin
```

`db:migrate` applies `db/schema_postgres.sql`.  
`db:seed:admin` inserts the admin user defined by `ADMIN_EMAIL` / `ADMIN_PASSWORD` (defaults: `admin@mail.com` / `123456`).

## Development

```bash
npm run dev
```

## Production Run

```bash
npm start
```

## Testing

```bash
npm test
```
