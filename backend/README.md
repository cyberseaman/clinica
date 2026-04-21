# Clinic Backend Compose Stack

Backend-only Docker Compose implementation with three application containers and one PostgreSQL database per service:

- `auth-service`: authentication, session handling, JWT issuance, role/scope metadata
- `employee-service`: employee resource server and final authority over employee data
- `patient-service`: patient resource server and final authority over patient data

## Architecture

### Containers

- `auth-service` on `http://localhost:3000`
- `employee-service` on `http://localhost:3001`
- `patient-service` on `http://localhost:3002`
- `auth-db` on `localhost:5433`
- `employee-db` on `localhost:5434`
- `patient-db` on `localhost:5435`

### Defense In Depth

- `auth-service` authenticates the user and issues a short-lived RS256 access token.
- Tokens carry `sub`, `role`, `scopes`, `clinicId`, and `sessionId`.
- `employee-service` and `patient-service` validate the JWT locally with the public key before trusting any claim.
- Both resource services then call `auth-service /internal/introspect` with a service credential to confirm the session is still active.
- `employee-service` still performs its own clinic-boundary and action-level authorization before any employee database query.
- `patient-service` does the same for patient and record actions.

That means the auth layer can reject obviously bad tokens early, but the resource service still remains the final authority for its own data.

## Service Boundaries

### Auth Database

- `clinics`
- `users`
- `auth_sessions`
- `roles`
- `permissions`
- `role_permissions`
- `audit_logs`

### Employee Database

- `employees`
- `audit_logs`

### Patient Database

- `patients`
- `medical_records`
- `audit_logs`

## Role and Scope Model

Default roles:

- `clinic_admin`
- `clinic_staff`
- `front_desk`
- `billing_staff`

Important employee scopes:

- `employees.read`
- `employees.write`
- `employees.admin`
- `employees.assign.clinic_admin`
- `employees.assign.clinic_staff`
- `employees.assign.front_desk`
- `employees.assign.billing_staff`

Important patient scopes:

- `patients.read`
- `patients.create`
- `patients.update`
- `patients.delete`
- `records.read`
- `records.create`

## Local Run

1. Copy the env template if needed:

```bash
cp .env.example .env
```

2. Start the stack:

```bash
docker compose up --build
```

3. Bootstrap the first clinic admin after the databases and services are up:

```bash
docker compose exec auth-service npm run bootstrap-admin
```

## JWT Keys

Development RSA keys are included in [certs/dev-private.pem](/Users/richelsantiago/Desktop/PROJECT/backend/certs/dev-private.pem) and [certs/dev-public.pem](/Users/richelsantiago/Desktop/PROJECT/backend/certs/dev-public.pem) so the stack works out of the box locally.

For real environments, replace those files and rotate `INTERNAL_SERVICE_TOKEN`.

## Main Files

- [docker-compose.yml](/Users/richelsantiago/Desktop/PROJECT/backend/docker-compose.yml)
- [shared/rbac.js](/Users/richelsantiago/Desktop/PROJECT/backend/shared/rbac.js)
- [shared/jwt.js](/Users/richelsantiago/Desktop/PROJECT/backend/shared/jwt.js)
- [services/auth/src/authApi.js](/Users/richelsantiago/Desktop/PROJECT/backend/services/auth/src/authApi.js)
- [services/employee/src/employeeApi.js](/Users/richelsantiago/Desktop/PROJECT/backend/services/employee/src/employeeApi.js)
- [services/patient/src/patientApi.js](/Users/richelsantiago/Desktop/PROJECT/backend/services/patient/src/patientApi.js)
- [scripts/bootstrapAdmin.js](/Users/richelsantiago/Desktop/PROJECT/backend/scripts/bootstrapAdmin.js)

## Endpoint Summary

### Auth Service

- `POST /auth/login`
- `GET /auth/me`
- `GET /auth/roles`
- `POST /auth/logout`
- `POST /internal/introspect`
- `POST /internal/users`
- `DELETE /internal/users/:userId`

### Employee Service

- `GET /employees`
- `GET /employees/:employeeId`
- `POST /employees`

### Patient Service

- `GET /patients`
- `POST /patients`
- `GET /patients/:patientId`
- `PUT /patients/:patientId`
- `DELETE /patients/:patientId`
- `GET /patients/:patientId/records`
- `POST /patients/:patientId/records`

## Example Flow

1. Log in against `auth-service`.
2. Receive a signed access token with clinic context and scopes.
3. Call `employee-service` or `patient-service` with `Authorization: Bearer <token>`.
4. The resource service validates the JWT locally, introspects it with `auth-service`, enforces its own rules, and only then touches its database.
