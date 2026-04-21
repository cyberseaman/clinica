export const permissions = {
  USERS_READ: 'employees.read',
  USERS_CREATE: 'employees.write',
  USERS_ASSIGN_CLINIC_ADMIN: 'employees.assign.clinic_admin',
  USERS_ASSIGN_CLINIC_STAFF: 'employees.assign.clinic_staff',
  USERS_ASSIGN_FRONT_DESK: 'employees.assign.front_desk',
  USERS_ASSIGN_BILLING_STAFF: 'employees.assign.billing_staff',
  PATIENTS_READ: 'patients.read',
  PATIENTS_CREATE: 'patients.create',
  PATIENTS_UPDATE: 'patients.update',
  PATIENTS_DELETE: 'patients.delete',
  RECORDS_READ: 'records.read',
  RECORDS_CREATE: 'records.create',
};

export const roleLabels = {
  clinic_admin: 'Clinic Admin',
  clinic_staff: 'Clinic Staff',
  front_desk: 'Front Desk',
  billing_staff: 'Billing Staff',
};

export function formatRoleLabel(role) {
  return roleLabels[role] || role.replaceAll('_', ' ');
}

export function hasPermission(user, permission) {
  const grantedScopes = Array.isArray(user?.scopes) && user.scopes.length > 0
    ? user.scopes
    : Array.isArray(user?.permissions)
      ? user.permissions
      : [];
  const legacyPermission = permission.replace(/^employees\./, 'users.');
  const nextPermission = permission.replace(/^users\./, 'employees.');

  return grantedScopes.includes(permission)
    || grantedScopes.includes(legacyPermission)
    || grantedScopes.includes(nextPermission);
}

export function getAssignableRoles(user) {
  const availableRoles = [];

  if (hasPermission(user, permissions.USERS_ASSIGN_CLINIC_STAFF)) {
    availableRoles.push('clinic_staff');
  }

  if (hasPermission(user, permissions.USERS_ASSIGN_FRONT_DESK)) {
    availableRoles.push('front_desk');
  }

  if (hasPermission(user, permissions.USERS_ASSIGN_BILLING_STAFF)) {
    availableRoles.push('billing_staff');
  }

  if (hasPermission(user, permissions.USERS_ASSIGN_CLINIC_ADMIN)) {
    availableRoles.push('clinic_admin');
  }

  return availableRoles;
}
