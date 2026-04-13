ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT,
  ADD COLUMN IF NOT EXISTS insurance_provider TEXT,
  ADD COLUMN IF NOT EXISTS insurance_member_id TEXT,
  ADD COLUMN IF NOT EXISTS insurance_group_number TEXT,
  ADD COLUMN IF NOT EXISTS allergies TEXT,
  ADD COLUMN IF NOT EXISTS current_medications TEXT,
  ADD COLUMN IF NOT EXISTS chronic_conditions TEXT;
