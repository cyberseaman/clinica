CREATE TABLE IF NOT EXISTS clinics (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('clinic_admin', 'clinic_staff', 'front_desk', 'billing_staff')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id)
);

INSERT INTO roles (name, description)
VALUES
  ('clinic_admin', 'Clinic administrator with employee and patient management access.'),
  ('clinic_staff', 'Clinical staff with patient and medical-record access.'),
  ('front_desk', 'Front desk staff with patient intake access.'),
  ('billing_staff', 'Billing staff with read-only patient access.')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO permissions (key, description)
VALUES
  ('employees.read', 'Read employee profiles inside the current clinic.'),
  ('employees.write', 'Create employee profiles and provision staff identities.'),
  ('employees.admin', 'Perform employee-admin actions inside the current clinic.'),
  ('employees.assign.clinic_admin', 'Assign clinic_admin to an employee.'),
  ('employees.assign.clinic_staff', 'Assign clinic_staff to an employee.'),
  ('employees.assign.front_desk', 'Assign front_desk to an employee.'),
  ('employees.assign.billing_staff', 'Assign billing_staff to an employee.'),
  ('patients.read', 'Read patient profiles inside the current clinic.'),
  ('patients.create', 'Create patient profiles.'),
  ('patients.update', 'Update patient profiles.'),
  ('patients.delete', 'Delete patient profiles.'),
  ('records.read', 'Read patient medical records.'),
  ('records.create', 'Create patient medical records.')
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON (
    (r.name = 'clinic_admin' AND p.key IN (
      'employees.read',
      'employees.write',
      'employees.admin',
      'employees.assign.clinic_admin',
      'employees.assign.clinic_staff',
      'employees.assign.front_desk',
      'employees.assign.billing_staff',
      'patients.read',
      'patients.create',
      'patients.update',
      'patients.delete',
      'records.read',
      'records.create'
    )) OR
    (r.name = 'clinic_staff' AND p.key IN (
      'patients.read',
      'patients.create',
      'patients.update',
      'records.read',
      'records.create'
    )) OR
    (r.name = 'front_desk' AND p.key IN (
      'patients.read',
      'patients.create',
      'patients.update'
    )) OR
    (r.name = 'billing_staff' AND p.key IN (
      'patients.read'
    ))
  )
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_users_clinic_id ON users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_clinic_id ON audit_logs(clinic_id);
