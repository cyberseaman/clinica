export const permissions = {
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_ASSIGN_CLINIC_ADMIN: 'users.assign.clinic_admin',
  USERS_ASSIGN_CLINIC_STAFF: 'users.assign.clinic_staff',
  USERS_ASSIGN_FRONT_DESK: 'users.assign.front_desk',
  USERS_ASSIGN_BILLING_STAFF: 'users.assign.billing_staff',
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
  return Boolean(user?.permissions?.includes(permission));
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
