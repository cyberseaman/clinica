const {
  CLINICAL_CATEGORY_DEFINITIONS,
  COMMUNICATION_CHANNELS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  OPERATIONAL_SERVICE_LINES,
  OPERATIONAL_SYSTEMS,
  POPULATION_FOCUSES,
  PRIMARY_ROLES,
  PROVIDER_TYPES,
  SHIFT_TYPES,
  STAFF_ROLE_DEFINITIONS,
  SYSTEM_PERMISSIONS,
  VISIT_TYPES,
} = require('./catalog');

async function upsertNamedRows(db, tableName, values) {
  for (const value of values) {
    await db.query(
      `INSERT INTO ${tableName} (name)
       VALUES ($1)
       ON CONFLICT (name) DO NOTHING`,
      [value]
    );
  }
}

async function upsertClinicalCategories(db) {
  for (const category of CLINICAL_CATEGORY_DEFINITIONS) {
    await db.query(
      `INSERT INTO clinical_categories (name, description)
       VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE
       SET description = EXCLUDED.description`,
      [category.name, category.description]
    );
  }
}

async function upsertPermissions(db) {
  for (const permission of SYSTEM_PERMISSIONS) {
    await db.query(
      `INSERT INTO permissions (code, name, description, is_category_scoped)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO UPDATE
       SET name = EXCLUDED.name,
           description = EXCLUDED.description,
           is_category_scoped = EXCLUDED.is_category_scoped`,
      [
        permission.code,
        permission.name,
        permission.description,
        permission.isCategoryScoped,
      ]
    );
  }
}

async function upsertStaffRoles(db) {
  for (const role of STAFF_ROLE_DEFINITIONS) {
    await db.query(
      `INSERT INTO staff_roles (department_id, name)
       VALUES ((SELECT id FROM departments WHERE name = $1 LIMIT 1), $2)
       ON CONFLICT (name) DO UPDATE
       SET department_id = EXCLUDED.department_id`,
      [role.department, role.name]
    );
  }
}

async function seedReferenceData(db) {
  await upsertNamedRows(db, 'employment_types', EMPLOYMENT_TYPES);
  await upsertNamedRows(db, 'provider_types', PROVIDER_TYPES);
  await upsertNamedRows(db, 'departments', DEPARTMENTS);
  await upsertNamedRows(db, 'primary_roles', PRIMARY_ROLES);
  await upsertNamedRows(db, 'population_focuses', POPULATION_FOCUSES);
  await upsertNamedRows(db, 'visit_types', VISIT_TYPES);
  await upsertNamedRows(db, 'shift_types', SHIFT_TYPES);
  await upsertNamedRows(db, 'operational_service_lines', OPERATIONAL_SERVICE_LINES);
  await upsertNamedRows(db, 'operational_systems', OPERATIONAL_SYSTEMS);
  await upsertNamedRows(db, 'communication_channels', COMMUNICATION_CHANNELS);
  await upsertStaffRoles(db);
  await upsertClinicalCategories(db);
  await upsertPermissions(db);
}

module.exports = {
  seedReferenceData,
};
