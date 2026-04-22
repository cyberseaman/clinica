INSERT INTO permissions (code, name, description, is_category_scoped)
VALUES
  ('patient.assign', 'Assign patients', 'Assign patients to clinicians.', TRUE),
  ('staff.supervise', 'Supervise staff', 'Supervise other patient-care staff and oversee delegated work.', FALSE),
  ('chart.sign', 'Sign charts', 'Sign chart documentation.', TRUE),
  ('labs.results.approve', 'Approve lab results', 'Approve and finalize returned lab results.', TRUE),
  ('diagnosis.finalize', 'Finalize diagnoses', 'Finalize diagnosis outcomes for an encounter.', TRUE),
  ('patient.discharge', 'Discharge patients', 'Discharge patients from care workflows.', TRUE),
  ('vaccines.administer', 'Administer vaccines', 'Administer vaccine workflows.', TRUE),
  ('woundcare.perform', 'Perform wound care', 'Perform wound-care treatment workflows.', TRUE),
  ('billing.codes.view', 'View billing codes', 'View billing-code libraries.', FALSE),
  ('prescription.create', 'Create prescriptions', 'Create prescriptions.', TRUE),
  ('triage.update', 'Update triage', 'Update triage workflows.', TRUE),
  ('schedule.manage', 'Manage schedule', 'Manage schedules.', FALSE)
ON CONFLICT (code) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'employee_responsibilities'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'responsibilities'
  ) THEN
    INSERT INTO employee_permissions (employee_id, permission_id, allowed)
    SELECT
      er.employee_id,
      p.id,
      TRUE
    FROM employee_responsibilities er
    JOIN responsibilities r ON r.id = er.responsibility_id
    JOIN permissions p
      ON p.code = CASE r.code
        WHEN 'patient.assign.receive' THEN 'patient.assign'
        WHEN 'staff.supervise' THEN 'staff.supervise'
        WHEN 'chart.sign' THEN 'chart.sign'
        WHEN 'labs.results.approve' THEN 'labs.results.approve'
        WHEN 'diagnosis.finalize' THEN 'diagnosis.finalize'
        WHEN 'patient.discharge' THEN 'patient.discharge'
        WHEN 'vaccines.administer' THEN 'vaccines.administer'
        WHEN 'woundcare.perform' THEN 'woundcare.perform'
        WHEN 'billing.codes.access' THEN 'billing.codes.view'
        WHEN 'prescriptions.manage' THEN 'prescription.create'
        WHEN 'triage.perform' THEN 'triage.update'
        WHEN 'schedule.manage' THEN 'schedule.manage'
        ELSE NULL
      END
    ON CONFLICT (employee_id, permission_id) DO UPDATE
      SET allowed = EXCLUDED.allowed,
          updated_at = CURRENT_TIMESTAMP;
  END IF;
END $$;

DROP TABLE IF EXISTS employee_responsibilities;
DROP TABLE IF EXISTS responsibilities;
