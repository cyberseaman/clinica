function normalizeBaseUrl(value, fallback) {
  const candidate = String(value || fallback || '').trim();
  return candidate.replace(/\/$/, '');
}

const sharedApiBaseUrl = process.env.REACT_APP_API_BASE_URL;

export const authApiBaseUrl = normalizeBaseUrl(
  process.env.REACT_APP_AUTH_API_URL || sharedApiBaseUrl,
  'http://localhost:3000'
);
export const employeeApiBaseUrl = normalizeBaseUrl(
  process.env.REACT_APP_EMPLOYEE_API_URL || sharedApiBaseUrl,
  sharedApiBaseUrl || 'http://localhost:3001'
);
export const patientApiBaseUrl = normalizeBaseUrl(
  process.env.REACT_APP_PATIENT_API_URL || sharedApiBaseUrl,
  sharedApiBaseUrl || 'http://localhost:3002'
);
export const tokenStorageKey = 'clinicPortalToken';
export const userStorageKey = 'clinicPortalUser';
export const clinicStorageKey = 'clinicPortalClinic';
