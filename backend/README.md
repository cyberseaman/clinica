# Clinic Backend

Express + PostgreSQL backend for clinic authentication, seeded admin bootstrap, clinic-scoped user management, patient profiles, and medical records.

## Features

- JWT-based authentication with expiration
- Logout via server-side session revocation
- Role-based access for `clinic_admin` and `clinic_staff`
- Bootstrap script for the first clinic admin
- Clinic-scoped patient access so staff only see patients in their own clinic
- Audit log entries for key actions

## Project Files

- [server.js](/Users/richelsantiago/Desktop/PROJECT/backend/server.js): app startup and route wiring
- [authApi.js](/Users/richelsantiago/Desktop/PROJECT/backend/authApi.js): login, logout, token validation, current-user lookup
- [clinicApi.js](/Users/richelsantiago/Desktop/PROJECT/backend/clinicApi.js): clinic users, patients, and records
- [seedAdmin.js](/Users/richelsantiago/Desktop/PROJECT/backend/seedAdmin.js): bootstrap script for creating the first clinic admin
- [.env.example](/Users/richelsantiago/Desktop/PROJECT/backend/.env.example): starter local environment template
- [db.js](/Users/richelsantiago/Desktop/PROJECT/backend/db.js): PostgreSQL connection and migration runner
- [migrations/001_init.sql](/Users/richelsantiago/Desktop/PROJECT/backend/migrations/001_init.sql): base schema
- [migrations/002_user_invitations.sql](/Users/richelsantiago/Desktop/PROJECT/backend/migrations/002_user_invitations.sql): unused legacy invitation table from the previous iteration

## Schema Overview

The schema includes these main tables:

- `clinics`
- `users`
- `patients`
- `medical_records`
- `auth_sessions`
- `audit_logs`

There is also a `user_invitations` table left over from an earlier iteration, but the current backend no longer uses invitation-based onboarding.

Key relationships:

- One `clinic` has many `patients`
- Each `patient` belongs to exactly one `clinic`
- Each `user` belongs to exactly one `clinic`
- Each `medical_record` belongs to exactly one `patient`

## Requirements

- Node.js 18+ recommended
- PostgreSQL 14+ recommended

## Environment Variables

You can use either `DATABASE_URL` or the individual `PG*` variables.

### Required for real usage

```bash
JWT_SECRET=replace-this-with-a-real-secret
```

### Database options

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/clinic_backend
```

Or:

```bash
PGHOST=127.0.0.1
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=clinic_backend
```

### Application options

```bash
PORT=3000
CLIENT_ORIGIN=http://localhost:3001
JWT_EXPIRES_IN=1h
PGSSLMODE=require
```

### First admin bootstrap options

Use these with `npm run seed-admin`:

```bash
SEED_CLINIC_NAME=Sunrise Family Clinic
SEED_CLINIC_SLUG=sunrise-family-clinic
SEED_ADMIN_EMAIL=admin@sunrise.test
SEED_ADMIN_PASSWORD=Password123!
SEED_ADMIN_FIRST_NAME=Alicia
SEED_ADMIN_LAST_NAME=Admin
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create the PostgreSQL database if it does not already exist:

```sql
CREATE DATABASE clinic_backend;
```

3. Copy the example environment file:

```bash
cp .env.example .env
```

4. Export your environment variables or load them from your shell.

One simple `zsh` option:

```bash
set -a
source .env
set +a
```

5. Seed the first clinic admin:

```bash
npm run seed-admin
```

6. Start the server:

```bash
npm start
```

7. Expected startup output:

```bash
Server listening on port 3000
```

All SQL files in [migrations](/Users/richelsantiago/Desktop/PROJECT/backend/migrations) run automatically on startup in filename order.

## Base URL

```text
http://localhost:3000
```

## Current User Creation Flow

Open self-registration is removed.

That means:

- The first clinic admin is created with `npm run seed-admin`
- After that, a signed-in `clinic_admin` can create additional staff or admin accounts directly with `POST /users`
- New users can sign in immediately with their email and password

## Bootstrapping the First Clinic Admin

Because public self-registration is removed, you need to create the very first clinic admin yourself once per environment.

The easiest way is the built-in bootstrap script:

```bash
npm run seed-admin
```

What the script does:

- runs all migrations first
- creates the clinic
- creates the first user with role `clinic_admin`
- writes an audit log entry

What it prevents:

- seeding a user if that email already exists
- seeding a clinic if that slug already exists

After the seed succeeds, you can log in through `POST /auth/login` and then create additional staff/admin accounts through the app or `POST /users`.

## Postman Setup

Create a Postman collection named `Clinic Backend`.

For authenticated requests, use either:

- Authorization tab -> `Bearer Token`
- Or a header: `Authorization: Bearer {{token}}`

Helpful collection variables:

- `baseUrl` = `http://localhost:3000`
- `token` = leave blank at first
- `patientId` = leave blank at first

## Endpoint Summary

### Public auth endpoints

- `POST /auth/login`

### Authenticated auth endpoints

- `GET /auth/me`
- `POST /auth/logout`

### Clinic admin endpoints

- `POST /users`

### Authenticated clinic endpoints

- `GET /users`
- `POST /patients`
- `GET /patients`
- `GET /patients/:patientId`
- `PUT /patients/:patientId`
- `POST /patients/:patientId/records`
- `GET /patients/:patientId/records`

## Sample Workflow

### 1. Seed the First Clinic Admin

Before using the API, create the first clinic admin:

```bash
SEED_CLINIC_NAME="Sunrise Family Clinic" \
SEED_CLINIC_SLUG="sunrise-family-clinic" \
SEED_ADMIN_EMAIL="admin@sunrise.test" \
SEED_ADMIN_PASSWORD="Password123!" \
SEED_ADMIN_FIRST_NAME="Alicia" \
SEED_ADMIN_LAST_NAME="Admin" \
npm run seed-admin
```

### 2. Health Check

Request:

- Method: `GET`
- URL: `{{baseUrl}}/`

Expected response:

```text
Server is running!
```

### 3. Login as the Seeded Admin

Request:

- Method: `POST`
- URL: `{{baseUrl}}/auth/login`
- Body:

```json
{
  "email": "admin@sunrise.test",
  "password": "Password123!"
}
```

Expected response shape:

```json
{
  "token": "JWT_HERE",
  "expiresIn": "1h",
  "user": {
    "id": 1,
    "clinicId": 1,
    "email": "admin@sunrise.test",
    "firstName": "Alicia",
    "lastName": "Admin",
    "role": "clinic_admin",
    "isActive": true
  },
  "clinic": {
    "id": 1,
    "name": "Sunrise Family Clinic",
    "slug": "sunrise-family-clinic"
  }
}
```

Copy the `token` into your Postman `token` variable.

### 4. Check the Current Authenticated User

Request:

- Method: `GET`
- URL: `{{baseUrl}}/auth/me`
- Authorization: `Bearer {{token}}`

### 5. Create Another Staff or Admin User

Only an authenticated clinic user can do this. Only a `clinic_admin` can create another admin.

Request:

- Method: `POST`
- URL: `{{baseUrl}}/users`
- Authorization: `Bearer {{token}}`
- Body:

```json
{
  "email": "nurse@sunrise.test",
  "password": "Password123!",
  "firstName": "Nina",
  "lastName": "Nurse",
  "role": "clinic_staff"
}
```

Expected result:

```json
{
  "user": {
    "id": 2,
    "clinicId": 1,
    "email": "nurse@sunrise.test",
    "firstName": "Nina",
    "lastName": "Nurse",
    "role": "clinic_staff",
    "isActive": true,
    "createdAt": "..."
  }
}
```

### 6. List Clinic Users

Request:

- Method: `GET`
- URL: `{{baseUrl}}/users`
- Authorization: `Bearer {{token}}`

### 7. Create a Patient

Request:

- Method: `POST`
- URL: `{{baseUrl}}/patients`
- Authorization: `Bearer {{token}}`
- Body:

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1988-05-10",
  "sex": "male",
  "email": "john.doe@example.com",
  "phone": "555-111-2222",
  "notes": "Diabetic patient. Schedule regular follow-up."
}
```

Save the returned patient `id` into the Postman `patientId` variable.

### 8. List Patients

Request:

- Method: `GET`
- URL: `{{baseUrl}}/patients`
- Authorization: `Bearer {{token}}`

### 9. Get One Patient

Request:

- Method: `GET`
- URL: `{{baseUrl}}/patients/{{patientId}}`
- Authorization: `Bearer {{token}}`

### 10. Update a Patient

Request:

- Method: `PUT`
- URL: `{{baseUrl}}/patients/{{patientId}}`
- Authorization: `Bearer {{token}}`

### 11. Create a Medical Record

Request:

- Method: `POST`
- URL: `{{baseUrl}}/patients/{{patientId}}/records`
- Authorization: `Bearer {{token}}`

```json
{
  "recordType": "follow_up",
  "summary": "Quarterly diabetes follow-up",
  "details": "A1C improving. Continue current treatment plan.",
  "visitDate": "2026-04-05"
}
```

### 12. List a Patient’s Medical Records

Request:

- Method: `GET`
- URL: `{{baseUrl}}/patients/{{patientId}}/records`
- Authorization: `Bearer {{token}}`

### 13. Logout

Request:

- Method: `POST`
- URL: `{{baseUrl}}/auth/logout`
- Authorization: `Bearer {{token}}`

## Common Error Cases to Test

### Missing token

Try `GET {{baseUrl}}/patients` without Authorization.

Expected:

```json
{
  "error": "Authorization token is required."
}
```

### Invalid token

Use `Bearer abc123`

Expected:

```json
{
  "error": "Invalid or expired token."
}
```

### Duplicate seeded admin email or clinic slug

If you run `npm run seed-admin` again with the same values, the script will stop with an error instead of duplicating data.

### Duplicate staff email

Try creating the same user twice with `POST /users`.

Expected:

```json
{
  "error": "A user with that email already exists."
}
```

### Patient outside clinic scope

If a user from another clinic tries to fetch `/patients/{{patientId}}`, the API should respond as if the patient does not exist:

```json
{
  "error": "Patient not found."
}
```

## Notes for the Next Developer

- Public self-registration is intentionally removed
- The first clinic admin should be provisioned with `npm run seed-admin`
- Additional users are created directly by a signed-in clinic admin through `POST /users`
- Users are global by email, so the same email cannot be reused across clinics
- Sessions are stored in `auth_sessions`, which is why logout invalidates a token server-side
- Migrations run from every `.sql` file in the `migrations` directory in sorted order
- The `user_invitations` table remains in the schema from a previous iteration, but the current app does not use it

## Quick Smoke Test Order

1. `npm run seed-admin`
2. `GET /`
3. `POST /auth/login`
4. `GET /auth/me`
5. `POST /users`
6. `GET /users`
7. `POST /patients`
8. `GET /patients`
9. `POST /patients/:patientId/records`
10. `GET /patients/:patientId/records`
11. `POST /auth/logout`
