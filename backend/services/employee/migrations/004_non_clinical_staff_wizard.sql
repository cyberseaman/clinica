CREATE SEQUENCE IF NOT EXISTS employee_uid_seq START WITH 100000;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS uid TEXT,
  ADD COLUMN IF NOT EXISTS employee_type TEXT NOT NULL DEFAULT 'clinical' CHECK (employee_type IN ('clinical', 'non_clinical'));

UPDATE employees
SET uid = 'EMP-' || LPAD(nextval('employee_uid_seq')::TEXT, 8, '0')
WHERE uid IS NULL;

ALTER TABLE employees
  ALTER COLUMN uid SET NOT NULL,
  ALTER COLUMN uid SET DEFAULT ('EMP-' || LPAD(nextval('employee_uid_seq')::TEXT, 8, '0'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_uid ON employees(uid);
CREATE INDEX IF NOT EXISTS idx_employees_employee_type ON employees(employee_type);

CREATE TABLE IF NOT EXISTS shift_types (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operational_service_lines (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operational_systems (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS communication_channels (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_roles (
  id BIGSERIAL PRIMARY KEY,
  department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE employee_employment_profiles
  ADD COLUMN IF NOT EXISTS staff_role_id BIGINT REFERENCES staff_roles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS employee_operational_profiles (
  employee_id BIGINT PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  shift_type_id BIGINT REFERENCES shift_types(id) ON DELETE SET NULL,
  work_location_name TEXT,
  supervisor_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_operational_service_lines (
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  service_line_id BIGINT NOT NULL REFERENCES operational_service_lines(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id, service_line_id)
);

CREATE TABLE IF NOT EXISTS employee_operational_systems (
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  system_id BIGINT NOT NULL REFERENCES operational_systems(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id, system_id)
);

CREATE TABLE IF NOT EXISTS employee_communication_channels (
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  communication_channel_id BIGINT NOT NULL REFERENCES communication_channels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id, communication_channel_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_operational_profiles_shift_type_id ON employee_operational_profiles(shift_type_id);
CREATE INDEX IF NOT EXISTS idx_employee_operational_service_lines_service_line_id ON employee_operational_service_lines(service_line_id);
CREATE INDEX IF NOT EXISTS idx_employee_operational_systems_system_id ON employee_operational_systems(system_id);
CREATE INDEX IF NOT EXISTS idx_employee_communication_channels_channel_id ON employee_communication_channels(communication_channel_id);
CREATE INDEX IF NOT EXISTS idx_staff_roles_department_id ON staff_roles(department_id);
CREATE INDEX IF NOT EXISTS idx_employee_employment_profiles_staff_role_id ON employee_employment_profiles(staff_role_id);
