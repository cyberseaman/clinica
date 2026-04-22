ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS clinic_location_id BIGINT;

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employment_status_check;
ALTER TABLE employees DROP COLUMN IF EXISTS role;
ALTER TABLE employees DROP COLUMN IF EXISTS employment_status;

CREATE TABLE IF NOT EXISTS clinic_locations (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (clinic_id, name)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'employees_clinic_location_id_fkey'
      AND table_name = 'employees'
  ) THEN
    ALTER TABLE employees
      ADD CONSTRAINT employees_clinic_location_id_fkey
      FOREIGN KEY (clinic_location_id) REFERENCES clinic_locations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS employment_types (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS provider_types (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS primary_roles (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_access_profiles (
  employee_id BIGINT PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  account_role TEXT NOT NULL CHECK (account_role IN ('clinic_admin', 'clinic_staff', 'front_desk', 'billing_staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_employment_profiles (
  employee_id BIGINT PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  start_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending')),
  employment_type_id BIGINT REFERENCES employment_types(id) ON DELETE SET NULL,
  provider_type_id BIGINT REFERENCES provider_types(id) ON DELETE SET NULL,
  department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL,
  primary_role_id BIGINT REFERENCES primary_roles(id) ON DELETE SET NULL,
  role_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clinical_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_clinical_categories (
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES clinical_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id, category_id)
);

CREATE TABLE IF NOT EXISTS employee_clinical_category_details (
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES clinical_categories(id) ON DELETE CASCADE,
  detail_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id, category_id, detail_name)
);

CREATE TABLE IF NOT EXISTS permissions (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_category_scoped BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_permissions (
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  allowed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id, permission_id)
);

CREATE TABLE IF NOT EXISTS employee_category_permissions (
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES clinical_categories(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  allowed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id, category_id, permission_id)
);

CREATE TABLE IF NOT EXISTS employee_qualification_profiles (
  employee_id BIGINT PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  degree TEXT,
  years_of_experience INTEGER,
  special_training TEXT,
  board_certification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_licenses (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  license_type TEXT,
  license_number TEXT,
  issuing_state TEXT,
  expiration_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending_verification')),
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_regulatory_identifiers (
  employee_id BIGINT PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  npi_number TEXT,
  dea_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_supporting_documents (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_kind TEXT NOT NULL DEFAULT 'supporting_document',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS population_focuses (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_experience_profiles (
  employee_id BIGINT PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  years_in_practice INTEGER,
  previous_specialties TEXT,
  languages_spoken TEXT,
  notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_population_focuses (
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  population_focus_id BIGINT NOT NULL REFERENCES population_focuses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id, population_focus_id)
);

CREATE TABLE IF NOT EXISTS employee_availability_profiles (
  employee_id BIGINT PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  start_time TIME,
  end_time TIME,
  max_patients_per_day INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_availability_days (
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS visit_types (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_visit_type_permissions (
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  visit_type_id BIGINT NOT NULL REFERENCES visit_types(id) ON DELETE CASCADE,
  allowed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id, visit_type_id)
);

CREATE INDEX IF NOT EXISTS idx_employees_clinic_location_id ON employees(clinic_location_id);
CREATE INDEX IF NOT EXISTS idx_clinic_locations_clinic_id ON clinic_locations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_employee_clinical_categories_category_id ON employee_clinical_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_employee_category_permissions_category_id ON employee_category_permissions(category_id);
CREATE INDEX IF NOT EXISTS idx_employee_permissions_permission_id ON employee_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_employee_licenses_employee_id ON employee_licenses(employee_id);
