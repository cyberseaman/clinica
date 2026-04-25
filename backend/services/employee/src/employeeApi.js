const express = require('express');

const {
  normalizeEmail,
  parseBearerToken,
  parsePositiveInteger,
  sendJsonError,
} = require('../../../shared/http');
const { createJwtVerifier } = require('../../../shared/jwt');
const {
  ASSIGN_SCOPE_BY_ROLE,
  PERMISSIONS,
  ROLE_NAMES,
} = require('../../../shared/rbac');
const {
  CLINICAL_CATEGORY_DEFINITIONS,
  COMMUNICATION_CHANNELS,
  DAYS_OF_WEEK,
  DEPARTMENTS,
  EMPLOYEE_TYPES,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  LICENSE_STATUSES,
  OPERATIONAL_SERVICE_LINES,
  OPERATIONAL_SYSTEMS,
  POPULATION_FOCUSES,
  PRIMARY_ROLES,
  PROVIDER_TYPES,
  SHIFT_TYPES,
  STAFF_ROLE_DEFINITIONS,
  SYSTEM_PERMISSIONS,
  VISIT_TYPES,
  buildWizardDefaults,
} = require('./catalog');

const LICENSE_REQUIRED_PERMISSION_CODES = new Set([
  'chart.sign',
  'diagnosis.finalize',
  'labs.order.create',
  'labs.results.approve',
  'labs.results.review',
  'patient.discharge',
  'prescription.create',
  'vaccines.administer',
  'woundcare.perform',
]);

const LEGACY_RESPONSIBILITY_PERMISSION_MAP = new Map([
  ['patient.assign.receive', 'patient.assign'],
  ['Can receive patient assignments', 'patient.assign'],
  ['staff.supervise', 'staff.supervise'],
  ['Can supervise other staff', 'staff.supervise'],
  ['chart.sign', 'chart.sign'],
  ['Can sign charts', 'chart.sign'],
  ['labs.results.approve', 'labs.results.approve'],
  ['Can approve lab results', 'labs.results.approve'],
  ['diagnosis.finalize', 'diagnosis.finalize'],
  ['Can finalize diagnoses', 'diagnosis.finalize'],
  ['patient.discharge', 'patient.discharge'],
  ['Can discharge patients', 'patient.discharge'],
  ['vaccines.administer', 'vaccines.administer'],
  ['Can administer vaccines', 'vaccines.administer'],
  ['woundcare.perform', 'woundcare.perform'],
  ['Can perform wound care', 'woundcare.perform'],
  ['billing.codes.access', 'billing.codes.view'],
  ['Can access billing codes', 'billing.codes.view'],
  ['prescriptions.manage', 'prescription.create'],
  ['Can manage prescriptions', 'prescription.create'],
  ['triage.perform', 'triage.update'],
  ['Can triage patients', 'triage.update'],
  ['schedule.manage', 'schedule.manage'],
  ['Can manage schedules', 'schedule.manage'],
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueStrings(values) {
  return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

function normalizeStringOrNull(value) {
  const normalized = normalizeOptionalString(value);
  return normalized || null;
}

function normalizeIntegerString(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  return String(value).trim();
}

function toIntegerOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function isValidDateString(value) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTimeString(value) {
  return !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function normalizeSystemPermissions(value) {
  const input = Array.isArray(value) ? value : [];
  const normalized = new Map();

  for (const item of input) {
    if (typeof item === 'string') {
      const code = item.trim();
      if (code) {
        normalized.set(code, { code, allowed: true });
      }
      continue;
    }

    if (item && typeof item === 'object') {
      const code = normalizeOptionalString(item.code || item.permissionCode);
      if (code) {
        normalized.set(code, {
          code,
          allowed: item.allowed !== false,
        });
      }
    }
  }

  return [...normalized.values()];
}

function normalizeLegacyResponsibilitiesAsPermissions(value) {
  const rawValues = uniqueStrings(value);

  return rawValues.flatMap((rawValue) => {
    const mappedCode = LEGACY_RESPONSIBILITY_PERMISSION_MAP.get(rawValue);
    return mappedCode ? [{ code: mappedCode, allowed: true }] : [];
  });
}

function normalizeCategoryPermissions(value) {
  if (!value) {
    return [];
  }

  const normalized = new Map();

  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const categoryName = normalizeOptionalString(item.categoryName || item.category);
      const code = normalizeOptionalString(item.code || item.permissionCode);

      if (!categoryName || !code) {
        continue;
      }

      normalized.set(`${categoryName}::${code}`, {
        allowed: item.allowed !== false,
        categoryName,
        code,
      });
    }

    return [...normalized.values()];
  }

  if (typeof value === 'object') {
    for (const [categoryName, categoryValue] of Object.entries(value)) {
      const categoryLabel = normalizeOptionalString(categoryName);
      if (!categoryLabel) {
        continue;
      }

      const permissions = Array.isArray(categoryValue) ? categoryValue : [];
      for (const permission of permissions) {
        if (typeof permission === 'string') {
          normalized.set(`${categoryLabel}::${permission}`, {
            allowed: true,
            categoryName: categoryLabel,
            code: permission.trim(),
          });
        } else if (permission && typeof permission === 'object') {
          const code = normalizeOptionalString(permission.code || permission.permissionCode);
          if (code) {
            normalized.set(`${categoryLabel}::${code}`, {
              allowed: permission.allowed !== false,
              categoryName: categoryLabel,
              code,
            });
          }
        }
      }
    }
  }

  return [...normalized.values()];
}

function normalizeClinicalCategorySection(source = {}, detailSource = {}) {
  if (Array.isArray(source)) {
    return {
      categories: uniqueStrings(source),
      detailsByCategory: Object.fromEntries(
        Object.entries(detailSource || {}).map(([categoryName, details]) => [
          categoryName,
          uniqueStrings(details),
        ])
      ),
    };
  }

  const categories = uniqueStrings(source.categories || source.selected || []);
  const detailsByCategory = {};

  for (const [categoryName, details] of Object.entries(source.detailsByCategory || source.clinicalCategoryDetails || detailSource || {})) {
    const normalizedDetails = uniqueStrings(details);
    if (normalizedDetails.length > 0) {
      detailsByCategory[String(categoryName).trim()] = normalizedDetails;
    }
  }

  return {
    categories,
    detailsByCategory,
  };
}

function normalizeOperationalProfile(body = {}, defaults = {}) {
  const source = body.operationalProfile || body.staffOperations || {};

  return {
    communicationChannels: uniqueStrings(
      source.communicationChannels || body.communicationChannels || defaults.communicationChannels
    ),
    notes: normalizeOptionalString(source.notes || body.notes || defaults.notes),
    serviceLines: uniqueStrings(source.serviceLines || body.serviceLines || defaults.serviceLines),
    shiftType: normalizeOptionalString(source.shiftType || body.shiftType || defaults.shiftType),
    systems: uniqueStrings(source.systems || body.systems || defaults.systems),
    supervisor: normalizeOptionalString(source.supervisor || body.supervisor || defaults.supervisor),
    workLocation: normalizeOptionalString(source.workLocation || body.workLocation || defaults.workLocation),
  };
}

function normalizeCreatePayload(body = {}) {
  const defaults = buildWizardDefaults();
  const requestedEmployeeType = normalizeOptionalString(
    body.employeeType ||
    body.staffType ||
    body.basicInfo?.employeeType ||
    body.basicInfo?.staffType
  );
  const hasOperationalStaffData = Boolean(
    body.operationalProfile ||
    body.staffOperations ||
    body.staffRole ||
    body.serviceLines ||
    body.systems ||
    body.communicationChannels ||
    body.shiftType ||
    body.workLocation ||
    body.supervisor
  );

  defaults.basicInfo.employeeType =
    requestedEmployeeType || (hasOperationalStaffData ? 'non_clinical' : defaults.basicInfo.employeeType);

  const isLegacyAccountCreate =
    !!body &&
    !body.basicInfo &&
    !body.employmentProfile &&
    !body.credentials &&
    !body.experience &&
    !body.availability &&
    !body.systemPermissions &&
    !body.categoryPermissions &&
    !body.clinicalCategories &&
    Object.prototype.hasOwnProperty.call(body, 'password');

  if (isLegacyAccountCreate) {
    defaults.basicInfo.employeeType = 'non_clinical';
    defaults.clinicalCategories = {
      categories: [],
      detailsByCategory: {},
    };
    defaults.systemPermissions = [];
    defaults.employmentProfile = {
      ...defaults.employmentProfile,
      department: 'Administration',
      primaryRole: 'Administrative lead',
      providerType: 'Other',
      status: 'active',
    };
    defaults.availability = {
      daysAvailable: [],
      endTime: '',
      maxPatientsPerDay: '',
      notes: '',
      startTime: '',
      visitTypesAllowed: [],
    };
    defaults.operationalProfile = {
      communicationChannels: ['Email'],
      notes: '',
      serviceLines: ['Office coordination'],
      shiftType: 'Day',
      systems: ['Patient Messaging'],
      supervisor: 'Operations Manager',
      workLocation: 'Administration Office',
    };
  }

  if (defaults.basicInfo.employeeType === 'non_clinical') {
    defaults.clinicalCategories = {
      categories: [],
      detailsByCategory: {},
    };
    defaults.systemPermissions = [];
    defaults.employmentProfile = {
      ...defaults.employmentProfile,
      department: 'Administration',
      primaryRole: 'Administrative lead',
      providerType: 'Other',
      staffRole: 'Operations Coordinator',
    };
    defaults.availability = {
      daysAvailable: [],
      endTime: '',
      maxPatientsPerDay: '',
      notes: '',
      startTime: '',
      visitTypesAllowed: [],
    };
  }

  const payload = clone(defaults);

  payload.basicInfo = {
    ...payload.basicInfo,
    accountRole: normalizeOptionalString(body.accountRole || body.role || body.basicInfo?.accountRole) || payload.basicInfo.accountRole,
    email: normalizeOptionalString(body.email || body.basicInfo?.email || payload.basicInfo.email),
    employeeType: normalizeOptionalString(body.employeeType || body.staffType || body.basicInfo?.employeeType || payload.basicInfo.employeeType),
    firstName: normalizeOptionalString(body.firstName || body.basicInfo?.firstName || payload.basicInfo.firstName),
    lastName: normalizeOptionalString(body.lastName || body.basicInfo?.lastName || payload.basicInfo.lastName),
    password: normalizeOptionalString(body.password || body.basicInfo?.password || payload.basicInfo.password),
    phone: normalizeOptionalString(body.phone || body.basicInfo?.phone || payload.basicInfo.phone),
  };

  payload.employmentProfile = {
    ...payload.employmentProfile,
    clinicLocationName: normalizeOptionalString(
      body.clinicLocationName || body.employmentProfile?.clinicLocationName || payload.employmentProfile.clinicLocationName
    ),
    department: normalizeOptionalString(body.department || body.employmentProfile?.department || payload.employmentProfile.department),
    employmentType: normalizeOptionalString(
      body.employmentType || body.employmentProfile?.employmentType || payload.employmentProfile.employmentType
    ),
    primaryRole: normalizeOptionalString(body.primaryRole || body.employmentProfile?.primaryRole || payload.employmentProfile.primaryRole),
    providerType: normalizeOptionalString(body.providerType || body.employmentProfile?.providerType || payload.employmentProfile.providerType),
    roleTitle: normalizeOptionalString(body.roleTitle || body.employmentProfile?.roleTitle || payload.employmentProfile.roleTitle),
    staffRole: normalizeOptionalString(body.staffRole || body.employmentProfile?.staffRole || payload.employmentProfile.staffRole),
    startDate: normalizeOptionalString(body.startDate || body.employmentProfile?.startDate || payload.employmentProfile.startDate),
    status: normalizeOptionalString(body.status || body.employmentProfile?.status || payload.employmentProfile.status),
  };

  payload.clinicalCategories = normalizeClinicalCategorySection(
    body.clinicalCategories || body.clinicalCategoriesSection || defaults.clinicalCategories,
    body.clinicalCategoryDetails
  );

  payload.credentials = {
    ...payload.credentials,
    boardCertification: normalizeOptionalString(body.credentials?.boardCertification || payload.credentials.boardCertification),
    deaNumber: normalizeOptionalString(body.credentials?.deaNumber || payload.credentials.deaNumber),
    degree: normalizeOptionalString(body.credentials?.degree || payload.credentials.degree),
    expirationDate: normalizeOptionalString(body.credentials?.expirationDate || payload.credentials.expirationDate),
    issuingState: normalizeOptionalString(body.credentials?.issuingState || payload.credentials.issuingState),
    licenseNumber: normalizeOptionalString(body.credentials?.licenseNumber || payload.credentials.licenseNumber),
    licenseStatus: normalizeOptionalString(body.credentials?.licenseStatus || payload.credentials.licenseStatus),
    licenseType: normalizeOptionalString(body.credentials?.licenseType || payload.credentials.licenseType),
    npiNumber: normalizeOptionalString(body.credentials?.npiNumber || payload.credentials.npiNumber),
    specialTraining: normalizeOptionalString(body.credentials?.specialTraining || payload.credentials.specialTraining),
    supportingDocuments: uniqueStrings(body.credentials?.supportingDocuments || payload.credentials.supportingDocuments),
    yearsOfExperience: normalizeIntegerString(
      body.credentials?.yearsOfExperience || payload.credentials.yearsOfExperience
    ),
  };

  payload.experience = {
    ...payload.experience,
    internalNotes: normalizeOptionalString(body.experience?.internalNotes || payload.experience.internalNotes),
    languagesSpoken: normalizeOptionalString(body.experience?.languagesSpoken || payload.experience.languagesSpoken),
    notes: normalizeOptionalString(body.experience?.notes || payload.experience.notes),
    populationFocus: uniqueStrings(body.experience?.populationFocus || payload.experience.populationFocus),
    previousSpecialties: normalizeOptionalString(body.experience?.previousSpecialties || payload.experience.previousSpecialties),
    yearsInPractice: normalizeIntegerString(body.experience?.yearsInPractice || payload.experience.yearsInPractice),
  };

  payload.systemPermissions = normalizeSystemPermissions([
    ...(payload.systemPermissions || []),
    ...(body.systemPermissions || []),
    ...(body.accessPermissions || []),
    ...(body.permissions || []),
    ...normalizeLegacyResponsibilitiesAsPermissions(body.responsibilities),
  ]);
  payload.categoryPermissions = normalizeCategoryPermissions(body.categoryPermissions || payload.categoryPermissions);
  payload.operationalProfile = normalizeOperationalProfile(body, payload.operationalProfile);

  payload.availability = {
    ...payload.availability,
    daysAvailable: uniqueStrings(body.availability?.daysAvailable || payload.availability.daysAvailable),
    endTime: normalizeOptionalString(body.availability?.endTime || payload.availability.endTime),
    maxPatientsPerDay: normalizeIntegerString(
      body.availability?.maxPatientsPerDay || payload.availability.maxPatientsPerDay
    ),
    notes: normalizeOptionalString(body.availability?.notes || payload.availability.notes),
    startTime: normalizeOptionalString(body.availability?.startTime || payload.availability.startTime),
    visitTypesAllowed: uniqueStrings(
      body.availability?.visitTypesAllowed || payload.availability.visitTypesAllowed
    ),
  };

  return payload;
}

function pickPresentFields(source, fields) {
  const picked = {};

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      picked[field] = source[field];
    }
  }

  return picked;
}

function normalizePatchSections(body = {}) {
  const explicitSections = [
    'basicInfo',
    'employmentProfile',
    'clinicalCategories',
    'credentials',
    'experience',
    'systemPermissions',
    'categoryPermissions',
    'operationalProfile',
    'availability',
  ].filter((section) => Object.prototype.hasOwnProperty.call(body, section));

  if (Object.prototype.hasOwnProperty.call(body, 'responsibilities')) {
    explicitSections.push('systemPermissions');
  }

  if (Object.prototype.hasOwnProperty.call(body, 'permissions')) {
    explicitSections.push('systemPermissions');
  }

  if (Object.prototype.hasOwnProperty.call(body, 'accessPermissions')) {
    explicitSections.push('systemPermissions');
  }

  if (
    Object.prototype.hasOwnProperty.call(body, 'serviceLines') ||
    Object.prototype.hasOwnProperty.call(body, 'systems') ||
    Object.prototype.hasOwnProperty.call(body, 'communicationChannels') ||
    Object.prototype.hasOwnProperty.call(body, 'shiftType') ||
    Object.prototype.hasOwnProperty.call(body, 'workLocation') ||
    Object.prototype.hasOwnProperty.call(body, 'supervisor')
  ) {
    explicitSections.push('operationalProfile');
  }

  if (explicitSections.length === 0) {
    const payload = normalizeCreatePayload(body);
    return {
      payload,
      sections: Object.keys(payload),
    };
  }

  const payload = {};

  if (explicitSections.includes('basicInfo')) {
    const source = pickPresentFields(body.basicInfo, [
      'accountRole',
      'employeeType',
      'role',
      'email',
      'firstName',
      'lastName',
      'password',
      'phone',
    ]);
    payload.basicInfo = {
      ...(Object.prototype.hasOwnProperty.call(source, 'accountRole') ||
      Object.prototype.hasOwnProperty.call(source, 'role')
        ? { accountRole: normalizeOptionalString(source.accountRole || source.role) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'employeeType')
        ? { employeeType: normalizeOptionalString(source.employeeType) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'email')
        ? { email: normalizeOptionalString(source.email) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'firstName')
        ? { firstName: normalizeOptionalString(source.firstName) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'lastName')
        ? { lastName: normalizeOptionalString(source.lastName) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'password')
        ? { password: normalizeOptionalString(source.password) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'phone')
        ? { phone: normalizeOptionalString(source.phone) }
        : {}),
    };
  }

  if (explicitSections.includes('employmentProfile')) {
    const source = pickPresentFields(body.employmentProfile, [
      'clinicLocationName',
      'department',
      'employmentType',
      'primaryRole',
      'providerType',
      'roleTitle',
      'staffRole',
      'startDate',
      'status',
    ]);
    payload.employmentProfile = {
      ...(Object.prototype.hasOwnProperty.call(source, 'clinicLocationName')
        ? { clinicLocationName: normalizeOptionalString(source.clinicLocationName) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'department')
        ? { department: normalizeOptionalString(source.department) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'employmentType')
        ? { employmentType: normalizeOptionalString(source.employmentType) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'primaryRole')
        ? { primaryRole: normalizeOptionalString(source.primaryRole) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'providerType')
        ? { providerType: normalizeOptionalString(source.providerType) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'roleTitle')
        ? { roleTitle: normalizeOptionalString(source.roleTitle) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'staffRole')
        ? { staffRole: normalizeOptionalString(source.staffRole) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'startDate')
        ? { startDate: normalizeOptionalString(source.startDate) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'status')
        ? { status: normalizeOptionalString(source.status) }
        : {}),
    };
  }

  if (explicitSections.includes('clinicalCategories')) {
    payload.clinicalCategories = normalizeClinicalCategorySection(body.clinicalCategories);
  }

  if (explicitSections.includes('credentials')) {
    const source = pickPresentFields(body.credentials, [
      'boardCertification',
      'deaNumber',
      'degree',
      'expirationDate',
      'issuingState',
      'licenseNumber',
      'licenseStatus',
      'licenseType',
      'npiNumber',
      'specialTraining',
      'supportingDocuments',
      'yearsOfExperience',
    ]);
    payload.credentials = {
      ...(Object.prototype.hasOwnProperty.call(source, 'boardCertification')
        ? { boardCertification: normalizeOptionalString(source.boardCertification) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'deaNumber')
        ? { deaNumber: normalizeOptionalString(source.deaNumber) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'degree')
        ? { degree: normalizeOptionalString(source.degree) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'expirationDate')
        ? { expirationDate: normalizeOptionalString(source.expirationDate) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'issuingState')
        ? { issuingState: normalizeOptionalString(source.issuingState) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'licenseNumber')
        ? { licenseNumber: normalizeOptionalString(source.licenseNumber) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'licenseStatus')
        ? { licenseStatus: normalizeOptionalString(source.licenseStatus) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'licenseType')
        ? { licenseType: normalizeOptionalString(source.licenseType) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'npiNumber')
        ? { npiNumber: normalizeOptionalString(source.npiNumber) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'specialTraining')
        ? { specialTraining: normalizeOptionalString(source.specialTraining) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'supportingDocuments')
        ? { supportingDocuments: uniqueStrings(source.supportingDocuments) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'yearsOfExperience')
        ? { yearsOfExperience: normalizeIntegerString(source.yearsOfExperience) }
        : {}),
    };
  }

  if (explicitSections.includes('experience')) {
    const source = pickPresentFields(body.experience, [
      'internalNotes',
      'languagesSpoken',
      'notes',
      'populationFocus',
      'previousSpecialties',
      'yearsInPractice',
    ]);
    payload.experience = {
      ...(Object.prototype.hasOwnProperty.call(source, 'internalNotes')
        ? { internalNotes: normalizeOptionalString(source.internalNotes) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'languagesSpoken')
        ? { languagesSpoken: normalizeOptionalString(source.languagesSpoken) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'notes')
        ? { notes: normalizeOptionalString(source.notes) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'populationFocus')
        ? { populationFocus: uniqueStrings(source.populationFocus) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'previousSpecialties')
        ? { previousSpecialties: normalizeOptionalString(source.previousSpecialties) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'yearsInPractice')
        ? { yearsInPractice: normalizeIntegerString(source.yearsInPractice) }
        : {}),
    };
  }

  if (explicitSections.includes('systemPermissions')) {
    payload.systemPermissions = normalizeSystemPermissions([
      ...(body.systemPermissions || []),
      ...(body.accessPermissions || []),
      ...(body.permissions || []),
      ...normalizeLegacyResponsibilitiesAsPermissions(body.responsibilities),
    ]);
  }

  if (explicitSections.includes('categoryPermissions')) {
    payload.categoryPermissions = normalizeCategoryPermissions(body.categoryPermissions);
  }

  if (explicitSections.includes('operationalProfile')) {
    payload.operationalProfile = normalizeOperationalProfile(body);
  }

  if (explicitSections.includes('availability')) {
    const source = pickPresentFields(body.availability, [
      'daysAvailable',
      'endTime',
      'maxPatientsPerDay',
      'notes',
      'startTime',
      'visitTypesAllowed',
    ]);
    payload.availability = {
      ...(Object.prototype.hasOwnProperty.call(source, 'daysAvailable')
        ? { daysAvailable: uniqueStrings(source.daysAvailable) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'endTime')
        ? { endTime: normalizeOptionalString(source.endTime) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'maxPatientsPerDay')
        ? { maxPatientsPerDay: normalizeIntegerString(source.maxPatientsPerDay) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'notes')
        ? { notes: normalizeOptionalString(source.notes) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'startTime')
        ? { startTime: normalizeOptionalString(source.startTime) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(source, 'visitTypesAllowed')
        ? { visitTypesAllowed: uniqueStrings(source.visitTypesAllowed) }
        : {}),
    };
  }

  return {
    payload,
    sections: [...new Set(explicitSections)],
  };
}

function mergeWizardData(currentWizardData, patchPayload, sections) {
  const merged = clone(currentWizardData);

  for (const section of sections) {
    if (
      patchPayload[section] &&
      typeof patchPayload[section] === 'object' &&
      !Array.isArray(patchPayload[section])
    ) {
      merged[section] = {
        ...merged[section],
        ...clone(patchPayload[section]),
      };
    } else {
      merged[section] = clone(patchPayload[section]);
    }
  }

  return merged;
}

function hasActiveLicense(credentials) {
  if (
    !credentials.licenseType ||
    !credentials.licenseNumber ||
    credentials.licenseStatus !== 'active'
  ) {
    return false;
  }

  if (!credentials.expirationDate) {
    return true;
  }

  const expirationDate = new Date(`${credentials.expirationDate}T23:59:59Z`);
  return !Number.isNaN(expirationDate.getTime()) && expirationDate >= new Date();
}

async function loadLookupMaps(queryable) {
  const [
    employmentTypesResult,
    providerTypesResult,
    departmentsResult,
    primaryRolesResult,
    staffRolesResult,
    clinicalCategoriesResult,
    permissionsResult,
    visitTypesResult,
    populationFocusesResult,
    shiftTypesResult,
    operationalServiceLinesResult,
    operationalSystemsResult,
    communicationChannelsResult,
  ] = await Promise.all([
    queryable.query('SELECT id, name FROM employment_types ORDER BY name ASC'),
    queryable.query('SELECT id, name FROM provider_types ORDER BY name ASC'),
    queryable.query('SELECT id, name FROM departments ORDER BY name ASC'),
    queryable.query('SELECT id, name FROM primary_roles ORDER BY name ASC'),
    queryable.query('SELECT id, name, department_id FROM staff_roles ORDER BY name ASC'),
    queryable.query('SELECT id, name, description FROM clinical_categories ORDER BY name ASC'),
    queryable.query('SELECT id, code, name, is_category_scoped FROM permissions ORDER BY code ASC'),
    queryable.query('SELECT id, name FROM visit_types ORDER BY name ASC'),
    queryable.query('SELECT id, name FROM population_focuses ORDER BY name ASC'),
    queryable.query('SELECT id, name FROM shift_types ORDER BY name ASC'),
    queryable.query('SELECT id, name FROM operational_service_lines ORDER BY name ASC'),
    queryable.query('SELECT id, name FROM operational_systems ORDER BY name ASC'),
    queryable.query('SELECT id, name FROM communication_channels ORDER BY name ASC'),
  ]);

  const mapByName = (rows) =>
    new Map(rows.map((row) => [row.name, { id: Number(row.id), ...row }]));
  const mapByCode = (rows) =>
    new Map(rows.map((row) => [row.code, { id: Number(row.id), ...row }]));

  return {
    clinicalCategories: mapByName(clinicalCategoriesResult.rows),
    communicationChannels: mapByName(communicationChannelsResult.rows),
    departments: mapByName(departmentsResult.rows),
    employmentTypes: mapByName(employmentTypesResult.rows),
    operationalServiceLines: mapByName(operationalServiceLinesResult.rows),
    operationalSystems: mapByName(operationalSystemsResult.rows),
    permissionsByCode: mapByCode(permissionsResult.rows),
    populationFocuses: mapByName(populationFocusesResult.rows),
    primaryRoles: mapByName(primaryRolesResult.rows),
    providerTypes: mapByName(providerTypesResult.rows),
    shiftTypes: mapByName(shiftTypesResult.rows),
    staffRoles: mapByName(staffRolesResult.rows),
    visitTypes: mapByName(visitTypesResult.rows),
  };
}

function validateWizardPayload(payload, lookupMaps) {
  const errors = [];

  const accountRole = payload.basicInfo.accountRole || 'clinic_staff';
  if (!ROLE_NAMES.includes(accountRole)) {
    errors.push(`accountRole must be one of: ${ROLE_NAMES.join(', ')}.`);
  }

  if (!EMPLOYEE_TYPES.includes(payload.basicInfo.employeeType)) {
    errors.push(`employeeType must be one of: ${EMPLOYEE_TYPES.join(', ')}.`);
  }

  if (!payload.basicInfo.firstName) {
    errors.push('firstName is required.');
  }

  if (!payload.basicInfo.lastName) {
    errors.push('lastName is required.');
  }

  if (!payload.basicInfo.email) {
    errors.push('email is required.');
  }

  if (!EMPLOYMENT_STATUSES.includes(payload.employmentProfile.status)) {
    errors.push(`status must be one of: ${EMPLOYMENT_STATUSES.join(', ')}.`);
  }

  if (!lookupMaps.providerTypes.has(payload.employmentProfile.providerType)) {
    errors.push(`providerType must be one of: ${PROVIDER_TYPES.join(', ')}.`);
  }

  if (!lookupMaps.departments.has(payload.employmentProfile.department)) {
    errors.push(`department must be one of: ${DEPARTMENTS.join(', ')}.`);
  }

  if (!lookupMaps.primaryRoles.has(payload.employmentProfile.primaryRole)) {
    errors.push(`primaryRole must be one of: ${PRIMARY_ROLES.join(', ')}.`);
  }

  if (
    payload.basicInfo.employeeType === 'non_clinical' &&
    payload.employmentProfile.staffRole &&
    !lookupMaps.staffRoles.has(payload.employmentProfile.staffRole)
  ) {
    errors.push(`Unknown staffRole: ${payload.employmentProfile.staffRole}.`);
  }

  if (!lookupMaps.employmentTypes.has(payload.employmentProfile.employmentType)) {
    errors.push(`employmentType must be one of: ${EMPLOYMENT_TYPES.join(', ')}.`);
  }

  if (!isValidDateString(payload.employmentProfile.startDate)) {
    errors.push('startDate must be a valid YYYY-MM-DD date.');
  }

  for (const categoryName of payload.clinicalCategories.categories) {
    if (!lookupMaps.clinicalCategories.has(categoryName)) {
      errors.push(`Unknown clinical category: ${categoryName}.`);
    }
  }

  for (const [categoryName, details] of Object.entries(payload.clinicalCategories.detailsByCategory)) {
    if (!lookupMaps.clinicalCategories.has(categoryName)) {
      errors.push(`Unknown clinical category detail group: ${categoryName}.`);
    }

    if (!payload.clinicalCategories.categories.includes(categoryName)) {
      errors.push(`Clinical category details were submitted for ${categoryName}, but the category is not assigned.`);
    }

    if (!Array.isArray(details)) {
      errors.push(`Clinical category details for ${categoryName} must be an array.`);
    }
  }

  if (!LICENSE_STATUSES.includes(payload.credentials.licenseStatus)) {
    errors.push(`licenseStatus must be one of: ${LICENSE_STATUSES.join(', ')}.`);
  }

  if (!isValidDateString(payload.credentials.expirationDate)) {
    errors.push('credentials.expirationDate must be a valid YYYY-MM-DD date.');
  }

  if (payload.credentials.yearsOfExperience !== '' && toIntegerOrNull(payload.credentials.yearsOfExperience) === null) {
    errors.push('credentials.yearsOfExperience must be an integer.');
  }

  if (payload.experience.yearsInPractice !== '' && toIntegerOrNull(payload.experience.yearsInPractice) === null) {
    errors.push('experience.yearsInPractice must be an integer.');
  }

  for (const focus of payload.experience.populationFocus) {
    if (!lookupMaps.populationFocuses.has(focus)) {
      errors.push(`Unknown populationFocus: ${focus}.`);
    }
  }

  for (const permission of payload.systemPermissions) {
    if (!lookupMaps.permissionsByCode.has(permission.code)) {
      errors.push(`Unknown system permission: ${permission.code}.`);
    }
  }

  for (const permission of payload.categoryPermissions) {
    const permissionRecord = lookupMaps.permissionsByCode.get(permission.code);
    if (!lookupMaps.clinicalCategories.has(permission.categoryName)) {
      errors.push(`Unknown category permission category: ${permission.categoryName}.`);
    }
    if (!permissionRecord) {
      errors.push(`Unknown category permission: ${permission.code}.`);
    } else if (!permissionRecord.is_category_scoped) {
      errors.push(`${permission.code} is not category-scoped and cannot be saved under categoryPermissions.`);
    }
    if (!payload.clinicalCategories.categories.includes(permission.categoryName)) {
      errors.push(`Category permission ${permission.code} targets ${permission.categoryName}, but that category is not assigned.`);
    }
  }

  for (const day of payload.availability.daysAvailable) {
    if (!DAYS_OF_WEEK.includes(day)) {
      errors.push(`Unknown availability day: ${day}.`);
    }
  }

  if (!isValidTimeString(payload.availability.startTime)) {
    errors.push('availability.startTime must be a valid HH:MM time.');
  }

  if (!isValidTimeString(payload.availability.endTime)) {
    errors.push('availability.endTime must be a valid HH:MM time.');
  }

  if (
    payload.availability.startTime &&
    payload.availability.endTime &&
    payload.availability.startTime >= payload.availability.endTime
  ) {
    errors.push('availability.endTime must be later than availability.startTime.');
  }

  if (payload.availability.maxPatientsPerDay !== '' && toIntegerOrNull(payload.availability.maxPatientsPerDay) === null) {
    errors.push('availability.maxPatientsPerDay must be an integer.');
  }

  for (const visitType of payload.availability.visitTypesAllowed) {
    if (!lookupMaps.visitTypes.has(visitType)) {
      errors.push(`Unknown visit type: ${visitType}.`);
    }
  }

  if (
    payload.basicInfo.employeeType === 'non_clinical' &&
    payload.operationalProfile.shiftType &&
    !lookupMaps.shiftTypes.has(payload.operationalProfile.shiftType)
  ) {
    errors.push(`Unknown shiftType: ${payload.operationalProfile.shiftType}.`);
  }

  for (const serviceLine of payload.operationalProfile.serviceLines) {
    if (!lookupMaps.operationalServiceLines.has(serviceLine)) {
      errors.push(`Unknown serviceLine: ${serviceLine}.`);
    }
  }

  for (const system of payload.operationalProfile.systems) {
    if (!lookupMaps.operationalSystems.has(system)) {
      errors.push(`Unknown operational system: ${system}.`);
    }
  }

  for (const channel of payload.operationalProfile.communicationChannels) {
    if (!lookupMaps.communicationChannels.has(channel)) {
      errors.push(`Unknown communication channel: ${channel}.`);
    }
  }

  const grantedPermissionCodes = new Set();
  for (const permission of payload.systemPermissions) {
    if (permission.allowed !== false) {
      grantedPermissionCodes.add(permission.code);
    }
  }
  for (const permission of payload.categoryPermissions) {
    if (permission.allowed !== false) {
      grantedPermissionCodes.add(permission.code);
    }
  }

  const licenseRequired =
    [...grantedPermissionCodes].some((code) => LICENSE_REQUIRED_PERMISSION_CODES.has(code));

  if (licenseRequired && !hasActiveLicense(payload.credentials)) {
    errors.push('An active non-expired primary license is required for the selected permissions.');
  }

  const deaRequired = grantedPermissionCodes.has('prescription.create');

  if (deaRequired && !payload.credentials.deaNumber) {
    errors.push('DEA number is required when prescription authority is granted.');
  }

  return {
    accountRole,
    errors,
  };
}

async function ensureClinicLocation(queryable, clinicId, clinicLocationName) {
  const normalizedName = normalizeStringOrNull(clinicLocationName);

  if (!normalizedName) {
    return null;
  }

  const existing = await queryable.query(
    `SELECT id
     FROM clinic_locations
     WHERE clinic_id = $1
       AND name = $2`,
    [clinicId, normalizedName]
  );

  if (existing.rows[0]) {
    return Number(existing.rows[0].id);
  }

  const created = await queryable.query(
    `INSERT INTO clinic_locations (clinic_id, name, is_default)
     VALUES ($1, $2, FALSE)
     RETURNING id`,
    [clinicId, normalizedName]
  );

  return Number(created.rows[0].id);
}

async function upsertBasicInfoSection(queryable, options) {
  const {
    actorUserId,
    authUserId,
    clinicId,
    employeeId,
    section,
  } = options;
  const clinicLocationId = await ensureClinicLocation(queryable, clinicId, section.clinicLocationName);

  if (employeeId) {
    await queryable.query(
      `UPDATE employees
       SET clinic_location_id = $2,
           email = $3,
           first_name = $4,
           last_name = $5,
           phone = $6,
           employee_type = $7,
           updated_by_auth_user_id = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [
        employeeId,
        clinicLocationId,
        normalizeEmail(section.email),
        normalizeStringOrNull(section.firstName),
        normalizeStringOrNull(section.lastName),
        normalizeStringOrNull(section.phone),
        section.employeeType || 'clinical',
        actorUserId,
      ]
    );
  } else {
    const created = await queryable.query(
      `INSERT INTO employees (
         auth_user_id,
         clinic_id,
         clinic_location_id,
         email,
         first_name,
         last_name,
         phone,
         employee_type,
         created_by_auth_user_id,
         updated_by_auth_user_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING id`,
      [
        authUserId,
        clinicId,
        clinicLocationId,
        normalizeEmail(section.email),
        normalizeStringOrNull(section.firstName),
        normalizeStringOrNull(section.lastName),
        normalizeStringOrNull(section.phone),
        section.employeeType || 'clinical',
        actorUserId,
      ]
    );

    return Number(created.rows[0].id);
  }

  return employeeId;
}

async function upsertAccessProfileSection(queryable, employeeId, accountRole) {
  if (!accountRole) {
    return;
  }

  await queryable.query(
    `INSERT INTO employee_access_profiles (employee_id, account_role)
     VALUES ($1, $2)
     ON CONFLICT (employee_id) DO UPDATE
     SET account_role = EXCLUDED.account_role,
         updated_at = CURRENT_TIMESTAMP`,
    [employeeId, accountRole]
  );
}

async function upsertEmploymentProfileSection(queryable, employeeId, section, lookupMaps) {
  await queryable.query(
    `INSERT INTO employee_employment_profiles (
       employee_id,
       start_date,
       status,
       employment_type_id,
       provider_type_id,
       department_id,
       primary_role_id,
       staff_role_id,
       role_title
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (employee_id) DO UPDATE
     SET start_date = EXCLUDED.start_date,
         status = EXCLUDED.status,
         employment_type_id = EXCLUDED.employment_type_id,
         provider_type_id = EXCLUDED.provider_type_id,
         department_id = EXCLUDED.department_id,
         primary_role_id = EXCLUDED.primary_role_id,
         staff_role_id = EXCLUDED.staff_role_id,
         role_title = EXCLUDED.role_title,
         updated_at = CURRENT_TIMESTAMP`,
    [
      employeeId,
      normalizeStringOrNull(section.startDate),
      section.status,
      lookupMaps.employmentTypes.get(section.employmentType)?.id || null,
      lookupMaps.providerTypes.get(section.providerType)?.id || null,
      lookupMaps.departments.get(section.department)?.id || null,
      lookupMaps.primaryRoles.get(section.primaryRole)?.id || null,
      lookupMaps.staffRoles.get(section.staffRole)?.id || null,
      normalizeStringOrNull(section.roleTitle),
    ]
  );
}

async function replaceClinicalCategoriesSection(queryable, employeeId, section, lookupMaps) {
  await queryable.query('DELETE FROM employee_clinical_category_details WHERE employee_id = $1', [employeeId]);
  await queryable.query('DELETE FROM employee_clinical_categories WHERE employee_id = $1', [employeeId]);

  for (const categoryName of section.categories) {
    const categoryId = lookupMaps.clinicalCategories.get(categoryName)?.id;
    if (!categoryId) {
      continue;
    }

    await queryable.query(
      `INSERT INTO employee_clinical_categories (employee_id, category_id)
       VALUES ($1, $2)`,
      [employeeId, categoryId]
    );

    const details = uniqueStrings(section.detailsByCategory[categoryName] || []);
    for (const detail of details) {
      await queryable.query(
        `INSERT INTO employee_clinical_category_details (employee_id, category_id, detail_name)
         VALUES ($1, $2, $3)`,
        [employeeId, categoryId, detail]
      );
    }
  }
}

async function replaceSystemPermissionsSection(queryable, employeeId, values, lookupMaps) {
  await queryable.query('DELETE FROM employee_permissions WHERE employee_id = $1', [employeeId]);

  for (const permission of values) {
    const permissionId = lookupMaps.permissionsByCode.get(permission.code)?.id;
    if (permissionId) {
      await queryable.query(
        `INSERT INTO employee_permissions (employee_id, permission_id, allowed)
         VALUES ($1, $2, $3)`,
        [employeeId, permissionId, permission.allowed !== false]
      );
    }
  }
}

async function replaceCategoryPermissionsSection(queryable, employeeId, values, lookupMaps) {
  await queryable.query('DELETE FROM employee_category_permissions WHERE employee_id = $1', [employeeId]);

  for (const permission of values) {
    const categoryId = lookupMaps.clinicalCategories.get(permission.categoryName)?.id;
    const permissionId = lookupMaps.permissionsByCode.get(permission.code)?.id;

    if (categoryId && permissionId) {
      await queryable.query(
        `INSERT INTO employee_category_permissions (employee_id, category_id, permission_id, allowed)
         VALUES ($1, $2, $3, $4)`,
        [employeeId, categoryId, permissionId, permission.allowed !== false]
      );
    }
  }
}

async function replaceCredentialsSection(queryable, employeeId, section) {
  await queryable.query(
    `INSERT INTO employee_qualification_profiles (
       employee_id,
       degree,
       years_of_experience,
       special_training,
       board_certification
     )
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (employee_id) DO UPDATE
     SET degree = EXCLUDED.degree,
         years_of_experience = EXCLUDED.years_of_experience,
         special_training = EXCLUDED.special_training,
         board_certification = EXCLUDED.board_certification,
         updated_at = CURRENT_TIMESTAMP`,
    [
      employeeId,
      normalizeStringOrNull(section.degree),
      toIntegerOrNull(section.yearsOfExperience),
      normalizeStringOrNull(section.specialTraining),
      normalizeStringOrNull(section.boardCertification),
    ]
  );

  await queryable.query('DELETE FROM employee_licenses WHERE employee_id = $1', [employeeId]);

  if (
    section.licenseType ||
    section.licenseNumber ||
    section.issuingState ||
    section.expirationDate
  ) {
    await queryable.query(
      `INSERT INTO employee_licenses (
         employee_id,
         license_type,
         license_number,
         issuing_state,
         expiration_date,
         status,
         is_primary
       )
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
      [
        employeeId,
        normalizeStringOrNull(section.licenseType),
        normalizeStringOrNull(section.licenseNumber),
        normalizeStringOrNull(section.issuingState),
        normalizeStringOrNull(section.expirationDate),
        section.licenseStatus || 'active',
      ]
    );
  }

  await queryable.query(
    `INSERT INTO employee_regulatory_identifiers (employee_id, npi_number, dea_number)
     VALUES ($1, $2, $3)
     ON CONFLICT (employee_id) DO UPDATE
     SET npi_number = EXCLUDED.npi_number,
         dea_number = EXCLUDED.dea_number,
         updated_at = CURRENT_TIMESTAMP`,
    [
      employeeId,
      normalizeStringOrNull(section.npiNumber),
      normalizeStringOrNull(section.deaNumber),
    ]
  );

  await queryable.query('DELETE FROM employee_supporting_documents WHERE employee_id = $1', [employeeId]);
  for (const documentName of uniqueStrings(section.supportingDocuments)) {
    await queryable.query(
      `INSERT INTO employee_supporting_documents (employee_id, document_name)
       VALUES ($1, $2)`,
      [employeeId, documentName]
    );
  }
}

async function replaceExperienceSection(queryable, employeeId, section, lookupMaps) {
  await queryable.query(
    `INSERT INTO employee_experience_profiles (
       employee_id,
       years_in_practice,
       previous_specialties,
       languages_spoken,
       notes,
       internal_notes
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (employee_id) DO UPDATE
     SET years_in_practice = EXCLUDED.years_in_practice,
         previous_specialties = EXCLUDED.previous_specialties,
         languages_spoken = EXCLUDED.languages_spoken,
         notes = EXCLUDED.notes,
         internal_notes = EXCLUDED.internal_notes,
         updated_at = CURRENT_TIMESTAMP`,
    [
      employeeId,
      toIntegerOrNull(section.yearsInPractice),
      normalizeStringOrNull(section.previousSpecialties),
      normalizeStringOrNull(section.languagesSpoken),
      normalizeStringOrNull(section.notes),
      normalizeStringOrNull(section.internalNotes),
    ]
  );

  await queryable.query('DELETE FROM employee_population_focuses WHERE employee_id = $1', [employeeId]);
  for (const focus of uniqueStrings(section.populationFocus)) {
    const focusId = lookupMaps.populationFocuses.get(focus)?.id;
    if (focusId) {
      await queryable.query(
        `INSERT INTO employee_population_focuses (employee_id, population_focus_id)
         VALUES ($1, $2)`,
        [employeeId, focusId]
      );
    }
  }
}

async function replaceAvailabilitySection(queryable, employeeId, section, lookupMaps) {
  await queryable.query(
    `INSERT INTO employee_availability_profiles (
       employee_id,
       start_time,
       end_time,
       max_patients_per_day,
       notes
     )
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (employee_id) DO UPDATE
     SET start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time,
         max_patients_per_day = EXCLUDED.max_patients_per_day,
         notes = EXCLUDED.notes,
         updated_at = CURRENT_TIMESTAMP`,
    [
      employeeId,
      normalizeStringOrNull(section.startTime),
      normalizeStringOrNull(section.endTime),
      toIntegerOrNull(section.maxPatientsPerDay),
      normalizeStringOrNull(section.notes),
    ]
  );

  await queryable.query('DELETE FROM employee_availability_days WHERE employee_id = $1', [employeeId]);
  for (const day of uniqueStrings(section.daysAvailable)) {
    await queryable.query(
      `INSERT INTO employee_availability_days (employee_id, day_of_week)
       VALUES ($1, $2)`,
      [employeeId, day]
    );
  }

  await queryable.query('DELETE FROM employee_visit_type_permissions WHERE employee_id = $1', [employeeId]);
  for (const visitType of uniqueStrings(section.visitTypesAllowed)) {
    const visitTypeId = lookupMaps.visitTypes.get(visitType)?.id;
    if (visitTypeId) {
      await queryable.query(
        `INSERT INTO employee_visit_type_permissions (employee_id, visit_type_id, allowed)
         VALUES ($1, $2, TRUE)`,
        [employeeId, visitTypeId]
      );
    }
  }
}

async function replaceOperationalProfileSection(queryable, employeeId, section, lookupMaps) {
  await queryable.query(
    `INSERT INTO employee_operational_profiles (
       employee_id,
       shift_type_id,
       work_location_name,
       supervisor_name,
       notes
     )
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (employee_id) DO UPDATE
     SET shift_type_id = EXCLUDED.shift_type_id,
         work_location_name = EXCLUDED.work_location_name,
         supervisor_name = EXCLUDED.supervisor_name,
         notes = EXCLUDED.notes,
         updated_at = CURRENT_TIMESTAMP`,
    [
      employeeId,
      lookupMaps.shiftTypes.get(section.shiftType)?.id || null,
      normalizeStringOrNull(section.workLocation),
      normalizeStringOrNull(section.supervisor),
      normalizeStringOrNull(section.notes),
    ]
  );

  await queryable.query('DELETE FROM employee_operational_service_lines WHERE employee_id = $1', [employeeId]);
  for (const serviceLine of uniqueStrings(section.serviceLines)) {
    const serviceLineId = lookupMaps.operationalServiceLines.get(serviceLine)?.id;
    if (serviceLineId) {
      await queryable.query(
        `INSERT INTO employee_operational_service_lines (employee_id, service_line_id)
         VALUES ($1, $2)`,
        [employeeId, serviceLineId]
      );
    }
  }

  await queryable.query('DELETE FROM employee_operational_systems WHERE employee_id = $1', [employeeId]);
  for (const system of uniqueStrings(section.systems)) {
    const systemId = lookupMaps.operationalSystems.get(system)?.id;
    if (systemId) {
      await queryable.query(
        `INSERT INTO employee_operational_systems (employee_id, system_id)
         VALUES ($1, $2)`,
        [employeeId, systemId]
      );
    }
  }

  await queryable.query('DELETE FROM employee_communication_channels WHERE employee_id = $1', [employeeId]);
  for (const channel of uniqueStrings(section.communicationChannels)) {
    const channelId = lookupMaps.communicationChannels.get(channel)?.id;
    if (channelId) {
      await queryable.query(
        `INSERT INTO employee_communication_channels (employee_id, communication_channel_id)
         VALUES ($1, $2)`,
        [employeeId, channelId]
      );
    }
  }
}

async function writeAuditLog(queryable, clinicId, actorUserId, action, entityId, metadata) {
  await queryable.query(
    `INSERT INTO audit_logs (clinic_id, actor_auth_user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, 'employee', $4, $5::jsonb)`,
    [clinicId, actorUserId, action, entityId, JSON.stringify(metadata || {})]
  );
}

async function loadEmployeeSummary(queryable, clinicId, employeeId = null) {
  const result = await queryable.query(
    `SELECT
       e.id,
       e.uid,
       e.auth_user_id,
       e.clinic_id,
       e.clinic_location_id,
       cl.name AS clinic_location_name,
       e.email,
       e.first_name,
       e.last_name,
       e.phone,
       e.employee_type,
       e.created_at,
       e.updated_at,
       ap.account_role,
       ep.status,
       et.name AS employment_type,
       pt.name AS provider_type,
       d.name AS department,
       pr.name AS primary_role,
       sr.name AS staff_role,
       ep.role_title,
       ep.start_date,
       COALESCE(perm.permission_count, 0) AS permission_count,
       COALESCE(cat.category_count, 0) AS category_count
     FROM employees e
     LEFT JOIN clinic_locations cl ON cl.id = e.clinic_location_id
     LEFT JOIN employee_access_profiles ap ON ap.employee_id = e.id
     LEFT JOIN employee_employment_profiles ep ON ep.employee_id = e.id
     LEFT JOIN employment_types et ON et.id = ep.employment_type_id
     LEFT JOIN provider_types pt ON pt.id = ep.provider_type_id
     LEFT JOIN departments d ON d.id = ep.department_id
     LEFT JOIN primary_roles pr ON pr.id = ep.primary_role_id
     LEFT JOIN staff_roles sr ON sr.id = ep.staff_role_id
     LEFT JOIN (
       SELECT employee_id, COUNT(*)::INT AS permission_count
       FROM employee_permissions
       GROUP BY employee_id
     ) perm ON perm.employee_id = e.id
     LEFT JOIN (
       SELECT employee_id, COUNT(*)::INT AS category_count
       FROM employee_clinical_categories
       GROUP BY employee_id
     ) cat ON cat.employee_id = e.id
     WHERE e.clinic_id = $1
       AND ($2::BIGINT IS NULL OR e.id = $2)
     ORDER BY e.created_at DESC`,
    [clinicId, employeeId]
  );

  return result.rows.map((row) => ({
    accountRole: row.account_role || '',
    authUserId: row.auth_user_id ? Number(row.auth_user_id) : null,
    categoryCount: Number(row.category_count || 0),
    clinicId: Number(row.clinic_id),
    clinicLocationId: row.clinic_location_id ? Number(row.clinic_location_id) : null,
    clinicLocationName: row.clinic_location_name || '',
    createdAt: row.created_at,
    department: row.department || '',
    email: row.email,
    employeeType: row.employee_type || 'clinical',
    employmentStatus: row.status || 'pending',
    employmentType: row.employment_type || '',
    firstName: row.first_name || '',
    hasAccessAccount: Boolean(row.auth_user_id),
    id: Number(row.id),
    lastName: row.last_name || '',
    phone: row.phone || '',
    permissionCount: Number(row.permission_count || 0),
    primaryRole: row.primary_role || '',
    providerType: row.provider_type || '',
    responsibilityCount: Number(row.permission_count || 0),
    role: row.account_role || '',
    roleTitle: row.role_title || '',
    startDate: row.start_date,
    staffRole: row.staff_role || '',
    updatedAt: row.updated_at,
    uid: row.uid,
  }));
}

async function loadEmployeeWizardData(queryable, clinicId, employeeId) {
  const summary = (await loadEmployeeSummary(queryable, clinicId, employeeId))[0];

  if (!summary) {
    return null;
  }

  const [
    categoriesResult,
    systemPermissionsResult,
    categoryPermissionsResult,
    qualificationResult,
    licenseResult,
    regulatoryResult,
    documentsResult,
    experienceResult,
    populationFocusResult,
    availabilityResult,
    availabilityDaysResult,
    visitTypesResult,
    operationalProfileResult,
    operationalServiceLinesResult,
    operationalSystemsResult,
    communicationChannelsResult,
  ] = await Promise.all([
    queryable.query(
      `SELECT c.name, c.description, d.detail_name
       FROM employee_clinical_categories ecc
       JOIN clinical_categories c ON c.id = ecc.category_id
       LEFT JOIN employee_clinical_category_details d
         ON d.employee_id = ecc.employee_id
        AND d.category_id = ecc.category_id
       WHERE ecc.employee_id = $1
       ORDER BY c.name ASC, d.detail_name ASC`,
      [employeeId]
    ),
    queryable.query(
      `SELECT p.code, p.name, ep.allowed
       FROM employee_permissions ep
       JOIN permissions p ON p.id = ep.permission_id
       WHERE ep.employee_id = $1
       ORDER BY p.code ASC`,
      [employeeId]
    ),
    queryable.query(
      `SELECT c.name AS category_name, p.code, p.name, ecp.allowed
       FROM employee_category_permissions ecp
       JOIN clinical_categories c ON c.id = ecp.category_id
       JOIN permissions p ON p.id = ecp.permission_id
       WHERE ecp.employee_id = $1
       ORDER BY c.name ASC, p.code ASC`,
      [employeeId]
    ),
    queryable.query(
      `SELECT degree, years_of_experience, special_training, board_certification
       FROM employee_qualification_profiles
       WHERE employee_id = $1`,
      [employeeId]
    ),
    queryable.query(
      `SELECT license_type, license_number, issuing_state, expiration_date, status
       FROM employee_licenses
       WHERE employee_id = $1
       ORDER BY is_primary DESC, id ASC
       LIMIT 1`,
      [employeeId]
    ),
    queryable.query(
      `SELECT npi_number, dea_number
       FROM employee_regulatory_identifiers
       WHERE employee_id = $1`,
      [employeeId]
    ),
    queryable.query(
      `SELECT document_name
       FROM employee_supporting_documents
       WHERE employee_id = $1
       ORDER BY id ASC`,
      [employeeId]
    ),
    queryable.query(
      `SELECT years_in_practice, previous_specialties, languages_spoken, notes, internal_notes
       FROM employee_experience_profiles
       WHERE employee_id = $1`,
      [employeeId]
    ),
    queryable.query(
      `SELECT pf.name
       FROM employee_population_focuses epf
       JOIN population_focuses pf ON pf.id = epf.population_focus_id
       WHERE epf.employee_id = $1
       ORDER BY pf.name ASC`,
      [employeeId]
    ),
    queryable.query(
      `SELECT start_time, end_time, max_patients_per_day, notes
       FROM employee_availability_profiles
       WHERE employee_id = $1`,
      [employeeId]
    ),
    queryable.query(
      `SELECT day_of_week
       FROM employee_availability_days
       WHERE employee_id = $1
       ORDER BY day_of_week ASC`,
      [employeeId]
    ),
    queryable.query(
      `SELECT vt.name
       FROM employee_visit_type_permissions evtp
       JOIN visit_types vt ON vt.id = evtp.visit_type_id
       WHERE evtp.employee_id = $1
         AND evtp.allowed = TRUE
       ORDER BY vt.name ASC`,
      [employeeId]
    ),
    queryable.query(
      `SELECT
         st.name AS shift_type,
         eop.work_location_name,
         eop.supervisor_name,
         eop.notes
       FROM employee_operational_profiles eop
       LEFT JOIN shift_types st ON st.id = eop.shift_type_id
       WHERE eop.employee_id = $1`,
      [employeeId]
    ),
    queryable.query(
      `SELECT osl.name
       FROM employee_operational_service_lines eosl
       JOIN operational_service_lines osl ON osl.id = eosl.service_line_id
       WHERE eosl.employee_id = $1
       ORDER BY osl.name ASC`,
      [employeeId]
    ),
    queryable.query(
      `SELECT os.name
       FROM employee_operational_systems eos
       JOIN operational_systems os ON os.id = eos.system_id
       WHERE eos.employee_id = $1
       ORDER BY os.name ASC`,
      [employeeId]
    ),
    queryable.query(
      `SELECT cc.name
       FROM employee_communication_channels ecc
       JOIN communication_channels cc ON cc.id = ecc.communication_channel_id
       WHERE ecc.employee_id = $1
       ORDER BY cc.name ASC`,
      [employeeId]
    ),
  ]);

  const categories = [];
  const detailsByCategory = {};
  const seenCategories = new Set();

  for (const row of categoriesResult.rows) {
    if (!seenCategories.has(row.name)) {
      seenCategories.add(row.name);
      categories.push(row.name);
    }

    if (row.detail_name) {
      if (!detailsByCategory[row.name]) {
        detailsByCategory[row.name] = [];
      }
      detailsByCategory[row.name].push(row.detail_name);
    }
  }

  const qualifications = qualificationResult.rows[0] || {};
  const primaryLicense = licenseResult.rows[0] || {};
  const regulatory = regulatoryResult.rows[0] || {};
  const experience = experienceResult.rows[0] || {};
  const availability = availabilityResult.rows[0] || {};
  const operationalProfile = operationalProfileResult.rows[0] || {};

  return {
    employee: summary,
    wizardData: {
      basicInfo: {
        accountRole: summary.accountRole,
        email: summary.email,
        employeeType: summary.employeeType,
        firstName: summary.firstName,
        lastName: summary.lastName,
        password: '',
        phone: summary.phone || '',
      },
      categoryPermissions: categoryPermissionsResult.rows.map((row) => ({
        allowed: row.allowed,
        categoryName: row.category_name,
        code: row.code,
        name: row.name,
      })),
      clinicalCategories: {
        categories,
        detailsByCategory,
      },
      credentials: {
        boardCertification: qualifications.board_certification || '',
        deaNumber: regulatory.dea_number || '',
        degree: qualifications.degree || '',
        expirationDate: primaryLicense.expiration_date || '',
        issuingState: primaryLicense.issuing_state || '',
        licenseNumber: primaryLicense.license_number || '',
        licenseStatus: primaryLicense.status || 'active',
        licenseType: primaryLicense.license_type || '',
        npiNumber: regulatory.npi_number || '',
        specialTraining: qualifications.special_training || '',
        supportingDocuments: documentsResult.rows.map((row) => row.document_name),
        yearsOfExperience:
          qualifications.years_of_experience === null || qualifications.years_of_experience === undefined
            ? ''
            : String(qualifications.years_of_experience),
      },
      employmentProfile: {
        clinicLocationName: summary.clinicLocationName || '',
        department: summary.department || '',
        employmentType: summary.employmentType || '',
        primaryRole: summary.primaryRole || '',
        providerType: summary.providerType || '',
        roleTitle: summary.roleTitle || '',
        startDate: summary.startDate || '',
        status: summary.employmentStatus || 'pending',
        staffRole: summary.staffRole || '',
      },
      experience: {
        internalNotes: experience.internal_notes || '',
        languagesSpoken: experience.languages_spoken || '',
        notes: experience.notes || '',
        populationFocus: populationFocusResult.rows.map((row) => row.name),
        previousSpecialties: experience.previous_specialties || '',
        yearsInPractice:
          experience.years_in_practice === null || experience.years_in_practice === undefined
            ? ''
            : String(experience.years_in_practice),
      },
      systemPermissions: systemPermissionsResult.rows.map((row) => ({
        allowed: row.allowed,
        code: row.code,
        name: row.name,
      })),
      availability: {
        daysAvailable: availabilityDaysResult.rows.map((row) => row.day_of_week),
        endTime: availability.end_time ? String(availability.end_time).slice(0, 5) : '',
        maxPatientsPerDay:
          availability.max_patients_per_day === null || availability.max_patients_per_day === undefined
            ? ''
            : String(availability.max_patients_per_day),
        notes: availability.notes || '',
        startTime: availability.start_time ? String(availability.start_time).slice(0, 5) : '',
        visitTypesAllowed: visitTypesResult.rows.map((row) => row.name),
      },
      operationalProfile: {
        communicationChannels: communicationChannelsResult.rows.map((row) => row.name),
        notes: operationalProfile.notes || '',
        serviceLines: operationalServiceLinesResult.rows.map((row) => row.name),
        shiftType: operationalProfile.shift_type || '',
        systems: operationalSystemsResult.rows.map((row) => row.name),
        supervisor: operationalProfile.supervisor_name || '',
        workLocation: operationalProfile.work_location_name || '',
      },
    },
  };
}

function createEmployeeApi(options = {}) {
  const router = express.Router();
  const db = options.db;
  const authClient = options.authClient;
  const jwtVerifier = createJwtVerifier({
    audience: options.jwtAudience,
    issuer: options.jwtIssuer,
    publicKeyPath: options.jwtPublicKeyPath,
  });

  if (!db || !authClient) {
    throw new Error('createEmployeeApi requires db and authClient.');
  }

  async function authenticateRequest(req, res, next) {
    const accessToken = parseBearerToken(req.headers.authorization);

    if (!accessToken) {
      return sendJsonError(res, 401, 'Authorization token is required.');
    }

    try {
      jwtVerifier.verifyAccessToken(accessToken);
    } catch (error) {
      return sendJsonError(res, 401, 'Invalid or expired token.');
    }

    try {
      const introspection = await authClient.introspectAccessToken(accessToken);

      if (!introspection.active) {
        return sendJsonError(res, 401, 'Invalid or expired token.');
      }

      req.accessToken = accessToken;
      req.auth = introspection.principal;
      return next();
    } catch (error) {
      const status = error.status && error.status >= 400 && error.status < 500 ? error.status : 503;
      const message = status === 503
        ? 'Authentication service is unavailable.'
        : error.payload?.error || 'Unable to validate token.';

      return sendJsonError(res, status, message);
    }
  }

  function requireScopes(...requiredScopes) {
    return (req, res, next) => {
      const userScopes = req.auth?.scopes || [];
      const hasAllScopes = requiredScopes.every((scope) => userScopes.includes(scope));

      if (!hasAllScopes) {
        return sendJsonError(res, 403, 'You do not have permission to perform this action.');
      }

      return next();
    };
  }

  function assertClinicAdminAuthority(req, targetClinicId) {
    if (!req.auth) {
      return 'Authorization context is missing.';
    }

    if (req.auth.role !== 'clinic_admin') {
      return 'Only clinic admins can access employee data.';
    }

    if (!req.auth.scopes.includes(PERMISSIONS.EMPLOYEES_ADMIN)) {
      return 'You do not have the employee admin scope.';
    }

    if (Number(req.auth.clinicId) !== Number(targetClinicId)) {
      return 'You are not allowed to access another clinic.';
    }

    return null;
  }

  router.get('/', (req, res) => {
    res.json({
      service: 'employee-service',
      status: 'ok',
    });
  });

  router.get('/health', (req, res) => {
    res.json({
      service: 'employee-service',
      status: 'healthy',
    });
  });

  router.use(authenticateRequest);

  router.get('/employees/metadata', requireScopes(PERMISSIONS.EMPLOYEES_READ), (req, res) => {
    const authorizationError = assertClinicAdminAuthority(req, req.auth.clinicId);

    if (authorizationError) {
      return sendJsonError(res, 403, authorizationError);
    }

    return res.status(200).json({
      accountRoles: ROLE_NAMES,
      clinicalCategories: CLINICAL_CATEGORY_DEFINITIONS,
      communicationChannels: COMMUNICATION_CHANNELS,
      daysOfWeek: DAYS_OF_WEEK,
      departments: DEPARTMENTS,
      employeeTypes: EMPLOYEE_TYPES,
      employmentStatuses: EMPLOYMENT_STATUSES,
      employmentTypes: EMPLOYMENT_TYPES,
      licenseStatuses: LICENSE_STATUSES,
      operationalServiceLines: OPERATIONAL_SERVICE_LINES,
      operationalSystems: OPERATIONAL_SYSTEMS,
      permissions: SYSTEM_PERMISSIONS,
      populationFocuses: POPULATION_FOCUSES,
      primaryRoles: PRIMARY_ROLES,
      providerTypes: PROVIDER_TYPES,
      shiftTypes: SHIFT_TYPES,
      staffRoles: STAFF_ROLE_DEFINITIONS,
      visitTypes: VISIT_TYPES,
    });
  });

  router.get('/employees', requireScopes(PERMISSIONS.EMPLOYEES_READ), async (req, res, next) => {
    const authorizationError = assertClinicAdminAuthority(req, req.auth.clinicId);

    if (authorizationError) {
      return sendJsonError(res, 403, authorizationError);
    }

    try {
      const employees = await loadEmployeeSummary(db, req.auth.clinicId);
      return res.status(200).json({ employees });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/employees/:employeeId', requireScopes(PERMISSIONS.EMPLOYEES_READ), async (req, res, next) => {
    const employeeId = parsePositiveInteger(req.params.employeeId);

    if (!employeeId) {
      return sendJsonError(res, 400, 'employeeId must be a positive integer.');
    }

    const authorizationError = assertClinicAdminAuthority(req, req.auth.clinicId);

    if (authorizationError) {
      return sendJsonError(res, 403, authorizationError);
    }

    try {
      const employee = await loadEmployeeWizardData(db, req.auth.clinicId, employeeId);

      if (!employee) {
        return sendJsonError(res, 404, 'Employee not found.');
      }

      return res.status(200).json(employee);
    } catch (error) {
      return next(error);
    }
  });

  router.post('/employees', requireScopes(PERMISSIONS.EMPLOYEES_WRITE), async (req, res, next) => {
    const authorizationError = assertClinicAdminAuthority(req, req.auth.clinicId);

    if (authorizationError) {
      return sendJsonError(res, 403, authorizationError);
    }

    try {
      const payload = normalizeCreatePayload(req.body);
      const lookupMaps = await loadLookupMaps(db);
      const validation = validateWizardPayload(payload, lookupMaps);

      if (validation.errors.length > 0) {
        return sendJsonError(res, 400, validation.errors.join(' '));
      }

      const employeeId = await db.withTransaction(async (client) => {
        const employeeIdentitySection = {
          ...payload.basicInfo,
          clinicLocationName: payload.employmentProfile.clinicLocationName,
        };

        const createdEmployeeId = await upsertBasicInfoSection(client, {
          actorUserId: req.auth.userId,
          authUserId: null,
          clinicId: req.auth.clinicId,
          section: employeeIdentitySection,
        });

        await upsertEmploymentProfileSection(client, createdEmployeeId, payload.employmentProfile, lookupMaps);
        await replaceClinicalCategoriesSection(client, createdEmployeeId, payload.clinicalCategories, lookupMaps);
        await replaceSystemPermissionsSection(client, createdEmployeeId, payload.systemPermissions, lookupMaps);
        await replaceCategoryPermissionsSection(client, createdEmployeeId, payload.categoryPermissions, lookupMaps);
        await replaceCredentialsSection(client, createdEmployeeId, payload.credentials);
        await replaceExperienceSection(client, createdEmployeeId, payload.experience, lookupMaps);
        await replaceAvailabilitySection(client, createdEmployeeId, payload.availability, lookupMaps);
        await replaceOperationalProfileSection(client, createdEmployeeId, payload.operationalProfile, lookupMaps);
        await writeAuditLog(client, req.auth.clinicId, req.auth.userId, 'create_employee_record', createdEmployeeId, {
          email: normalizeEmail(payload.basicInfo.email),
          employeeType: payload.basicInfo.employeeType,
          providerType: payload.employmentProfile.providerType,
        });

        return createdEmployeeId;
      });

      const employee = await loadEmployeeWizardData(db, req.auth.clinicId, employeeId);

      return res.status(201).json(employee);
    } catch (error) {
      if (error.status) {
        return sendJsonError(res, error.status, error.payload?.error || error.message);
      }

      if (error.code === '23505') {
        return sendJsonError(res, 409, 'An employee with that email already exists.');
      }

      return next(error);
    }
  });

  router.post('/employees/:employeeId/access-account', requireScopes(PERMISSIONS.EMPLOYEES_WRITE), async (req, res, next) => {
    const employeeId = parsePositiveInteger(req.params.employeeId);

    if (!employeeId) {
      return sendJsonError(res, 400, 'employeeId must be a positive integer.');
    }

    const authorizationError = assertClinicAdminAuthority(req, req.auth.clinicId);

    if (authorizationError) {
      return sendJsonError(res, 403, authorizationError);
    }

    const requestedRole = normalizeOptionalString(req.body.role) || 'clinic_staff';
    const password = normalizeOptionalString(req.body.password);

    if (!ROLE_NAMES.includes(requestedRole)) {
      return sendJsonError(res, 400, `role must be one of: ${ROLE_NAMES.join(', ')}.`);
    }

    if (!password) {
      return sendJsonError(res, 400, 'password is required.');
    }

    const requiredAssignScope = ASSIGN_SCOPE_BY_ROLE[requestedRole];
    if (!req.auth.scopes.includes(requiredAssignScope)) {
      return sendJsonError(res, 403, `You do not have permission to assign the ${requestedRole} role.`);
    }

    let provisionedUser = null;

    try {
      const existingEmployee = (await loadEmployeeSummary(db, req.auth.clinicId, employeeId))[0];

      if (!existingEmployee) {
        return sendJsonError(res, 404, 'Employee not found.');
      }

      if (existingEmployee.authUserId) {
        return sendJsonError(res, 409, 'This employee already has an access account.');
      }

      const accessEmail = normalizeEmail(req.body.email || existingEmployee.email);

      provisionedUser = (
        await authClient.provisionEmployeeIdentity(req.accessToken, {
          email: accessEmail,
          firstName: existingEmployee.firstName,
          lastName: existingEmployee.lastName,
          password,
          role: requestedRole,
        })
      ).user;

      await db.withTransaction(async (client) => {
        await client.query(
          `UPDATE employees
           SET auth_user_id = $2,
               email = $3,
               updated_by_auth_user_id = $4,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1
             AND clinic_id = $5`,
          [
            employeeId,
            provisionedUser.id,
            provisionedUser.email,
            req.auth.userId,
            req.auth.clinicId,
          ]
        );

        await upsertAccessProfileSection(client, employeeId, requestedRole);
        await writeAuditLog(client, req.auth.clinicId, req.auth.userId, 'create_employee_access_account', employeeId, {
          authUserId: provisionedUser.id,
          email: provisionedUser.email,
          role: requestedRole,
        });
      });

      const employee = (await loadEmployeeSummary(db, req.auth.clinicId, employeeId))[0];
      return res.status(201).json({ employee });
    } catch (error) {
      if (provisionedUser?.id) {
        try {
          await authClient.rollbackEmployeeIdentity(req.accessToken, provisionedUser.id);
        } catch (rollbackError) {
          console.error('Failed to rollback provisioned auth user:', rollbackError);
        }
      }

      if (error.status) {
        return sendJsonError(res, error.status, error.payload?.error || error.message);
      }

      if (error.code === '23505') {
        return sendJsonError(res, 409, 'An employee or user with that email already exists.');
      }

      return next(error);
    }
  });

  router.patch('/employees/:employeeId', requireScopes(PERMISSIONS.EMPLOYEES_WRITE), async (req, res, next) => {
    const employeeId = parsePositiveInteger(req.params.employeeId);

    if (!employeeId) {
      return sendJsonError(res, 400, 'employeeId must be a positive integer.');
    }

    const authorizationError = assertClinicAdminAuthority(req, req.auth.clinicId);

    if (authorizationError) {
      return sendJsonError(res, 403, authorizationError);
    }

    let previousIdentity = null;
    let identityWasUpdated = false;

    try {
      const existing = await loadEmployeeWizardData(db, req.auth.clinicId, employeeId);

      if (!existing) {
        return sendJsonError(res, 404, 'Employee not found.');
      }

      const { payload: patchPayload, sections } = normalizePatchSections(req.body);
      const mergedPayload = mergeWizardData(existing.wizardData, patchPayload, sections);
      const lookupMaps = await loadLookupMaps(db);
      const validation = validateWizardPayload(mergedPayload, lookupMaps);

      if (validation.errors.length > 0) {
        return sendJsonError(res, 400, validation.errors.join(' '));
      }

      previousIdentity = existing.employee.authUserId ? {
        email: existing.wizardData.basicInfo.email,
        firstName: existing.wizardData.basicInfo.firstName,
        lastName: existing.wizardData.basicInfo.lastName,
        role: existing.wizardData.basicInfo.accountRole || 'clinic_staff',
      } : null;

      const nextIdentity = existing.employee.authUserId ? {
        email: mergedPayload.basicInfo.email,
        firstName: mergedPayload.basicInfo.firstName,
        lastName: mergedPayload.basicInfo.lastName,
        role: mergedPayload.basicInfo.accountRole || existing.wizardData.basicInfo.accountRole || 'clinic_staff',
      } : null;

      if (
        existing.employee.authUserId &&
        nextIdentity &&
        previousIdentity &&
        (
          nextIdentity.email !== previousIdentity.email ||
          nextIdentity.firstName !== previousIdentity.firstName ||
          nextIdentity.lastName !== previousIdentity.lastName ||
          nextIdentity.role !== previousIdentity.role
        )
      ) {
        await authClient.updateEmployeeIdentity(req.accessToken, existing.employee.authUserId, nextIdentity);
        identityWasUpdated = true;
      }

      await db.withTransaction(async (client) => {
        if (sections.includes('basicInfo')) {
          const employeeIdentitySection = {
            ...mergedPayload.basicInfo,
            clinicLocationName: mergedPayload.employmentProfile.clinicLocationName,
          };

          await upsertBasicInfoSection(client, {
            actorUserId: req.auth.userId,
            clinicId: req.auth.clinicId,
            employeeId,
            section: employeeIdentitySection,
          });
        }

        if (sections.includes('employmentProfile')) {
          await upsertEmploymentProfileSection(client, employeeId, mergedPayload.employmentProfile, lookupMaps);

          if (!sections.includes('basicInfo')) {
            await upsertBasicInfoSection(client, {
              actorUserId: req.auth.userId,
              clinicId: req.auth.clinicId,
              employeeId,
              section: {
                ...mergedPayload.basicInfo,
                clinicLocationName: mergedPayload.employmentProfile.clinicLocationName,
              },
            });
          }
        }

        if (sections.includes('clinicalCategories')) {
          await replaceClinicalCategoriesSection(client, employeeId, mergedPayload.clinicalCategories, lookupMaps);
        }

        if (sections.includes('systemPermissions')) {
          await replaceSystemPermissionsSection(client, employeeId, mergedPayload.systemPermissions, lookupMaps);
        }

        if (sections.includes('categoryPermissions')) {
          await replaceCategoryPermissionsSection(client, employeeId, mergedPayload.categoryPermissions, lookupMaps);
        }

        if (sections.includes('credentials')) {
          await replaceCredentialsSection(client, employeeId, mergedPayload.credentials);
        }

        if (sections.includes('experience')) {
          await replaceExperienceSection(client, employeeId, mergedPayload.experience, lookupMaps);
        }

        if (sections.includes('availability')) {
          await replaceAvailabilitySection(client, employeeId, mergedPayload.availability, lookupMaps);
        }

        if (sections.includes('operationalProfile')) {
          await replaceOperationalProfileSection(client, employeeId, mergedPayload.operationalProfile, lookupMaps);
        }

        await writeAuditLog(client, req.auth.clinicId, req.auth.userId, 'update_employee_wizard_profile', employeeId, {
          sections,
        });
      });

      const employee = await loadEmployeeWizardData(db, req.auth.clinicId, employeeId);
      return res.status(200).json(employee);
    } catch (error) {
      if (identityWasUpdated && previousIdentity) {
        try {
          const existing = await loadEmployeeWizardData(db, req.auth.clinicId, employeeId);
          if (existing?.employee?.authUserId) {
            await authClient.updateEmployeeIdentity(
              req.accessToken,
              existing.employee.authUserId,
              previousIdentity
            );
          }
        } catch (rollbackError) {
          console.error('Failed to rollback employee identity update:', rollbackError);
        }
      }

      if (error.status) {
        return sendJsonError(res, error.status, error.payload?.error || error.message);
      }

      if (error.code === '23505') {
        return sendJsonError(res, 409, 'An employee with that email already exists.');
      }

      return next(error);
    }
  });

  return {
    router,
  };
}

module.exports = {
  createEmployeeApi,
};
