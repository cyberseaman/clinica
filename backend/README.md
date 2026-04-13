# Clinic Backend

Express + PostgreSQL backend for clinic authentication, clinic-scoped data access, and explicit RBAC permissions.

## What This Backend Does

- Authenticates clinic users with JWTs and expiring server-backed sessions
- Revokes tokens on logout through the `auth_sessions` table
- Stores clinics, users, patients, and medical records in PostgreSQL
- Restricts all patient and record access to the authenticated user’s clinic
- Uses explicit permissions per action instead of relying only on broad role checks
- Bootstraps the first clinic admin with a seed command instead of public registration

## Current Roles

The backend ships with these default roles:

- `clinic_admin`
- `clinic_staff`
- `front_desk`
- `billing_staff`

Each role is mapped to a collection of permissions in [migrations/003_rbac.sql](/Users/richelsantiago/Desktop/PROJECT/backend/migrations/003_rbac.sql).

### Default Permission Model

- `clinic_admin`
  - `users.read`
  - `users.create`
  - `users.assign.clinic_admin`
  - `users.assign.clinic_staff`
  - `users.assign.front_desk`
  - `users.assign.billing_staff`
  - `patients.read`
  - `patients.create`
  - `patients.update`
  - `records.read`
  - `records.create`

- `clinic_staff`
  - `patients.read`
  - `patients.create`
  - `patients.update`
  - `records.read`
  - `records.create`

- `front_desk`
  - `patients.read`
  - `patients.create`
  - `patients.update`

- `billing_staff`
  - `patients.read`

## Important Files

- [server.js](/Users/richelsantiago/Desktop/PROJECT/backend/server.js): server startup and route mounting
- [authApi.js](/Users/richelsantiago/Desktop/PROJECT/backend/authApi.js): login, logout, auth middleware, current-user lookup, role metadata
- [clinicApi.js](/Users/richelsantiago/Desktop/PROJECT/backend/clinicApi.js): users, patients, and records endpoints
- [rbac.js](/Users/richelsantiago/Desktop/PROJECT/backend/rbac.js): shared role and permission definitions
- [db.js](/Users/richelsantiago/Desktop/PROJECT/backend/db.js): PostgreSQL connection and migration runner
- [seedAdmin.js](/Users/richelsantiago/Desktop/PROJECT/backend/seedAdmin.js): first-admin bootstrap script
- [migrations/001_init.sql](/Users/richelsantiago/Desktop/PROJECT/backend/migrations/001_init.sql): base schema
- [migrations/003_rbac.sql](/Users/richelsantiago/Desktop/PROJECT/backend/migrations/003_rbac.sql): RBAC schema and default mappings

## Database Schema Overview

Primary tables:

- `clinics`
- `users`
- `patients`
- `medical_records`
- `auth_sessions`
- `audit_logs`
- `roles`
- `permissions`
- `role_permissions`

Important relationships:

- One clinic has many users
- One clinic has many patients
- Each patient belongs to exactly one clinic
- Each medical record belongs to exactly one patient
- Each auth session belongs to exactly one user
- Roles map to many permissions through `role_permissions`

## Environment Variables

You can use `DATABASE_URL` or the individual `PG*` variables.

### Core app config

```bash
PORT=3000
CLIENT_ORIGIN=http://localhost:3001
JWT_SECRET=replace-this-with-a-real-secret
JWT_EXPIRES_IN=1h
```

### Database config

```bash
PGHOST=127.0.0.1
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=clinic_backend
```

Or:

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/clinic_backend
```

### Optional bootstrap values

Used by `npm run seed-admin`:

```bash
SEED_CLINIC_NAME="Sunrise Family Clinic"
SEED_CLINIC_SLUG="sunrise-family-clinic"
SEED_ADMIN_EMAIL="admin@sunrise.test"
SEED_ADMIN_PASSWORD="Password123!"
SEED_ADMIN_FIRST_NAME="Alicia"
SEED_ADMIN_LAST_NAME="Admin"
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create the PostgreSQL database:

```sql
CREATE DATABASE clinic_backend;
```

3. Copy the env template:

```bash
cp .env.example .env
```

4. Load the env values:

```bash
set -a
source .env
set +a
```

5. Seed the first clinic admin:

```bash
npm run seed-admin
```

6. Start the backend:

```bash
npm start
```

Expected startup output:

```text
Server listening on port 3000
```

The backend runs on `http://localhost:3000` and is configured to accept the frontend origin `http://localhost:3001`.

Patient profiles now include additional structured fields for:

- address
- emergency contact
- insurance info
- health alerts: allergies, current medications, chronic conditions

These fields are added by [migrations/004_patient_profile_fields.sql](/Users/richelsantiago/Desktop/PROJECT/backend/migrations/004_patient_profile_fields.sql), so make sure the backend has started against your database after pulling the latest changes.

## Bootstrap Flow

Public self-registration is intentionally removed.

The current account flow is:

1. Seed the first `clinic_admin` with `npm run seed-admin`
2. Log in through `POST /auth/login`
3. Use `POST /users` to create additional users in one of the supported roles
4. New users can log in immediately with email and password

The seed script runs migrations first, then creates:

- the clinic
- the first admin user
- an audit log entry

## Postman Setup

Create a collection named `Clinic Backend`.

Recommended collection variables:

- `baseUrl` = `http://localhost:3000`
- `token` = blank initially
- `patientId` = blank initially

For authenticated requests:

- use Authorization type `Bearer Token`
- or send `Authorization: Bearer {{token}}`

## Endpoint Summary

### Public endpoints

- `GET /`
- `POST /auth/login`

### Authenticated auth endpoints

- `GET /auth/me`
- `GET /auth/roles`
- `POST /auth/logout`

### Permission-protected endpoints

- `GET /users` requires `users.read`
- `POST /users` requires `users.create` plus a role-assignment permission for the requested role
- `GET /patients` requires `patients.read`
- `POST /patients` requires `patients.create`
- `GET /patients/:patientId` requires `patients.read`
- `PUT /patients/:patientId` requires `patients.update`
- `DELETE /patients/:patientId` requires `patients.delete`
- `GET /patients/:patientId/records` requires `records.read`
- `POST /patients/:patientId/records` requires `records.create`

## Sample Postman Workflow

### 1. Seed the first admin

Before testing the API:

```bash
SEED_CLINIC_NAME="Sunrise Family Clinic" \
SEED_CLINIC_SLUG="sunrise-family-clinic" \
SEED_ADMIN_EMAIL="admin@sunrise.test" \
SEED_ADMIN_PASSWORD="Password123!" \
SEED_ADMIN_FIRST_NAME="Alicia" \
SEED_ADMIN_LAST_NAME="Admin" \
npm run seed-admin
```

### 2. Health check

- Method: `GET`
- URL: `{{baseUrl}}/`

Expected response:

```text
Server is running!
```

### 3. Log in as the seeded admin

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
    "isActive": true,
    "permissions": [
      "users.read",
      "users.create",
      "users.assign.clinic_admin",
      "users.assign.clinic_staff",
      "users.assign.front_desk",
      "users.assign.billing_staff",
      "patients.read",
      "patients.create",
      "patients.update",
      "records.read",
      "records.create"
    ]
  },
  "clinic": {
    "id": 1,
    "name": "Sunrise Family Clinic",
    "slug": "sunrise-family-clinic"
  }
}
```

Copy `token` into the Postman `token` variable.

### 4. Confirm the current user

- Method: `GET`
- URL: `{{baseUrl}}/auth/me`
- Authorization: `Bearer {{token}}`

This should return the signed-in user, clinic, and the live permission list resolved from the database.

### 5. Inspect available roles

- Method: `GET`
- URL: `{{baseUrl}}/auth/roles`
- Authorization: `Bearer {{token}}`

This returns the role catalog and permission mapping the frontend also uses.

### 6. Create a `clinic_staff` user

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
    "createdAt": "...",
    "permissions": [
      "patients.read",
      "patients.create",
      "patients.update",
      "records.read",
      "records.create"
    ]
  }
}
```

### 7. Create a `front_desk` user

- Method: `POST`
- URL: `{{baseUrl}}/users`
- Authorization: `Bearer {{token}}`
- Body:

```json
{
  "email": "desk@sunrise.test",
  "password": "Password123!",
  "firstName": "Frida",
  "lastName": "Desk",
  "role": "front_desk"
}
```

### 8. Create a `billing_staff` user

- Method: `POST`
- URL: `{{baseUrl}}/users`
- Authorization: `Bearer {{token}}`
- Body:

```json
{
  "email": "billing@sunrise.test",
  "password": "Password123!",
  "firstName": "Bianca",
  "lastName": "Billing",
  "role": "billing_staff"
}
```

### 9. List clinic users

- Method: `GET`
- URL: `{{baseUrl}}/users`
- Authorization: `Bearer {{token}}`

This response includes each user’s role and resolved permissions.

### 10. Create a patient

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
  "address": "123 Main St, Springfield, CA 90000",
  "emergencyContact": {
    "name": "Jane Doe",
    "phone": "555-777-8888",
    "relationship": "Spouse"
  },
  "insuranceInfo": {
    "provider": "Blue Shield",
    "memberId": "ABC1234567",
    "groupNumber": "GRP-1001"
  },
  "healthAlerts": {
    "allergies": "Penicillin, peanuts",
    "currentMedications": "Metformin 500mg twice daily",
    "chronicConditions": "Type 2 diabetes"
  },
  "notes": "Diabetic patient. Schedule regular follow-up."
}
```

Save the returned patient `id` to `patientId`.

### 11. List patients

- Method: `GET`
- URL: `{{baseUrl}}/patients`
- Authorization: `Bearer {{token}}`

### 12. Get one patient

- Method: `GET`
- URL: `{{baseUrl}}/patients/{{patientId}}`
- Authorization: `Bearer {{token}}`

### 13. Update a patient

- Method: `PUT`
- URL: `{{baseUrl}}/patients/{{patientId}}`
- Authorization: `Bearer {{token}}`
- Body:

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1988-05-10",
  "sex": "male",
  "email": "john.doe@example.com",
  "phone": "555-333-4444",
  "address": "500 Wellness Ave, Springfield, CA 90000",
  "emergencyContact": {
    "name": "Jane Doe",
    "phone": "555-777-8888",
    "relationship": "Spouse"
  },
  "insuranceInfo": {
    "provider": "Blue Shield",
    "memberId": "ABC1234567",
    "groupNumber": "GRP-1002"
  },
  "healthAlerts": {
    "allergies": "Penicillin, peanuts",
    "currentMedications": "Metformin 500mg twice daily; Lisinopril 10mg daily",
    "chronicConditions": "Type 2 diabetes, hypertension"
  },
  "notes": "Diabetic patient. Last visit showed improved blood sugar control."
}
```

### 14. Create a medical record

- Method: `POST`
- URL: `{{baseUrl}}/patients/{{patientId}}/records`
- Authorization: `Bearer {{token}}`
- Body:

```json
{
  "recordType": "follow_up",
  "summary": "Quarterly diabetes follow-up",
  "details": "A1C improving. Continue current treatment plan.",
  "visitDate": "2026-04-09"
}
```

### 15. List medical records

- Method: `GET`
- URL: `{{baseUrl}}/patients/{{patientId}}/records`
- Authorization: `Bearer {{token}}`

### 16. Log out

- Method: `POST`
- URL: `{{baseUrl}}/auth/logout`
- Authorization: `Bearer {{token}}`

After logout, that same token should fail on `GET /auth/me`.

## Good Permission Tests To Run In Postman

These are useful to confirm RBAC is actually working.

### Front desk cannot read records

1. Log in as a `front_desk` user
2. Call `GET /patients/{{patientId}}/records`

Expected:

```json
{
  "error": "You do not have permission to perform this action."
}
```

### Billing staff can read patients but cannot create records

1. Log in as a `billing_staff` user
2. Call `GET /patients`
3. Then call `POST /patients/{{patientId}}/records`

Expected on the record-creation call:

```json
{
  "error": "You do not have permission to perform this action."
}
```

### Token required

Try `GET {{baseUrl}}/patients` without a bearer token.

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

### Cross-clinic access stays hidden

If a user from another clinic requests a patient from a different clinic:

```json
{
  "error": "Patient not found."
}
```

## Notes For The Next Developer

- The app no longer uses public registration
- The first admin is created with `npm run seed-admin`
- Permissions are resolved live from the database on login and `GET /auth/me`
- Route protection now checks explicit permission keys instead of broad role tests
- The frontend should treat `user.permissions` as the source of truth for feature visibility
- Users are still scoped to one clinic, and patient/record access is always filtered by clinic
- [migrations/002_user_invitations.sql](/Users/richelsantiago/Desktop/PROJECT/backend/migrations/002_user_invitations.sql) remains in the repo, but invitation onboarding is not currently wired into the app

## Quick Smoke Test Order

1. `npm run seed-admin`
2. `npm start`
3. `POST /auth/login`
4. `GET /auth/me`
5. `GET /auth/roles`
6. `POST /users`
7. `GET /users`
8. `POST /patients`
9. `GET /patients`
10. `PUT /patients/:patientId`
11. `DELETE /patients/:patientId` as an admin-only check
12. `POST /patients/:patientId/records`
13. `GET /patients/:patientId/records`
14. `POST /auth/logout`
