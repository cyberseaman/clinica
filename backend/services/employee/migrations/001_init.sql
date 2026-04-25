CREATE SEQUENCE IF NOT EXISTS employee_uid_seq START WITH 100000;

CREATE TABLE IF NOT EXISTS employees (
  id BIGSERIAL PRIMARY KEY,
  uid TEXT NOT NULL DEFAULT ('EMP-' || LPAD(nextval('employee_uid_seq')::TEXT, 8, '0')),
  auth_user_id BIGINT UNIQUE,
  clinic_id BIGINT NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  employee_type TEXT NOT NULL DEFAULT 'clinical' CHECK (employee_type IN ('clinical', 'non_clinical')),
  role TEXT NOT NULL CHECK (role IN ('clinic_admin', 'clinic_staff', 'front_desk', 'billing_staff')),
  employment_status TEXT NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active', 'inactive')),
  created_by_auth_user_id BIGINT,
  updated_by_auth_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (clinic_id, email)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL,
  actor_auth_user_id BIGINT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employees_clinic_id ON employees(clinic_id);
CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id ON employees(auth_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_uid ON employees(uid);
CREATE INDEX IF NOT EXISTS idx_employee_audit_logs_clinic_id ON audit_logs(clinic_id);
