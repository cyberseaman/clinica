const express = require('express');

const {
  normalizeEmail,
  parseBearerToken,
  parsePositiveInteger,
  sendJsonError,
} = require('../../../shared/http');
const { createJwtVerifier } = require('../../../shared/jwt');
const { PERMISSIONS } = require('../../../shared/rbac');

function sanitizePatient(row) {
  return {
    address: row.address,
    clinicId: Number(row.clinic_id),
    createdAt: row.created_at,
    dateOfBirth: row.date_of_birth,
    email: row.email,
    emergencyContact: {
      name: row.emergency_contact_name,
      phone: row.emergency_contact_phone,
      relationship: row.emergency_contact_relationship,
    },
    firstName: row.first_name,
    healthAlerts: {
      allergies: row.allergies,
      chronicConditions: row.chronic_conditions,
      currentMedications: row.current_medications,
    },
    id: Number(row.id),
    insuranceInfo: {
      groupNumber: row.insurance_group_number,
      memberId: row.insurance_member_id,
      provider: row.insurance_provider,
    },
    lastName: row.last_name,
    notes: row.notes,
    phone: row.phone,
    sex: row.sex,
    updatedAt: row.updated_at,
  };
}

function sanitizeMedicalRecord(row) {
  return {
    createdAt: row.created_at,
    details: row.details,
    id: Number(row.id),
    patientId: Number(row.patient_id),
    recordType: row.record_type,
    summary: row.summary,
    visitDate: row.visit_date,
  };
}

function createPatientApi(options = {}) {
  const router = express.Router();
  const db = options.db;
  const authClient = options.authClient;
  const jwtVerifier = createJwtVerifier({
    audience: options.jwtAudience,
    issuer: options.jwtIssuer,
    publicKeyPath: options.jwtPublicKeyPath,
  });

  if (!db || !authClient) {
    throw new Error('createPatientApi requires db and authClient.');
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

  function assertClinicAccess(req, targetClinicId) {
    if (!req.auth) {
      return 'Authorization context is missing.';
    }

    if (Number(req.auth.clinicId) !== Number(targetClinicId)) {
      return 'You are not allowed to access another clinic.';
    }

    return null;
  }

  router.get('/', (req, res) => {
    res.json({
      service: 'patient-service',
      status: 'ok',
    });
  });

  router.get('/health', (req, res) => {
    res.json({
      service: 'patient-service',
      status: 'healthy',
    });
  });

  router.use(authenticateRequest);

  router.get('/patients', requireScopes(PERMISSIONS.PATIENTS_READ), async (req, res, next) => {
    const authorizationError = assertClinicAccess(req, req.auth.clinicId);

    if (authorizationError) {
      return sendJsonError(res, 403, authorizationError);
    }

    try {
      const result = await db.query(
        `SELECT
           id,
           clinic_id,
           first_name,
           last_name,
           date_of_birth,
           sex,
           email,
           phone,
           address,
           emergency_contact_name,
           emergency_contact_phone,
           emergency_contact_relationship,
           insurance_provider,
           insurance_member_id,
           insurance_group_number,
           allergies,
           current_medications,
           chronic_conditions,
           notes,
           created_at,
           updated_at
         FROM patients
         WHERE clinic_id = $1
         ORDER BY last_name ASC, first_name ASC`,
        [req.auth.clinicId]
      );

      return res.status(200).json({
        patients: result.rows.map(sanitizePatient),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/patients', requireScopes(PERMISSIONS.PATIENTS_CREATE), async (req, res, next) => {
    const authorizationError = assertClinicAccess(req, req.auth.clinicId);

    if (authorizationError) {
      return sendJsonError(res, 403, authorizationError);
    }

    const {
      address,
      dateOfBirth,
      email,
      emergencyContact,
      firstName,
      healthAlerts,
      insuranceInfo,
      lastName,
      notes,
      phone,
      sex,
    } = req.body;

    if (!firstName || !lastName) {
      return sendJsonError(res, 400, 'firstName and lastName are required.');
    }

    try {
      const result = await db.query(
        `INSERT INTO patients (
           clinic_id,
           first_name,
           last_name,
           date_of_birth,
           sex,
           email,
           phone,
           address,
           emergency_contact_name,
           emergency_contact_phone,
           emergency_contact_relationship,
           insurance_provider,
           insurance_member_id,
           insurance_group_number,
           allergies,
           current_medications,
           chronic_conditions,
           notes,
           created_by_auth_user_id,
           updated_by_auth_user_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $19)
         RETURNING
           id,
           clinic_id,
           first_name,
           last_name,
           date_of_birth,
           sex,
           email,
           phone,
           address,
           emergency_contact_name,
           emergency_contact_phone,
           emergency_contact_relationship,
           insurance_provider,
           insurance_member_id,
           insurance_group_number,
           allergies,
           current_medications,
           chronic_conditions,
           notes,
           created_at,
           updated_at`,
        [
          req.auth.clinicId,
          String(firstName).trim(),
          String(lastName).trim(),
          dateOfBirth || null,
          sex || null,
          email ? normalizeEmail(email) : null,
          phone ? String(phone).trim() : null,
          address ? String(address).trim() : null,
          emergencyContact?.name ? String(emergencyContact.name).trim() : null,
          emergencyContact?.phone ? String(emergencyContact.phone).trim() : null,
          emergencyContact?.relationship ? String(emergencyContact.relationship).trim() : null,
          insuranceInfo?.provider ? String(insuranceInfo.provider).trim() : null,
          insuranceInfo?.memberId ? String(insuranceInfo.memberId).trim() : null,
          insuranceInfo?.groupNumber ? String(insuranceInfo.groupNumber).trim() : null,
          healthAlerts?.allergies ? String(healthAlerts.allergies).trim() : null,
          healthAlerts?.currentMedications ? String(healthAlerts.currentMedications).trim() : null,
          healthAlerts?.chronicConditions ? String(healthAlerts.chronicConditions).trim() : null,
          notes ? String(notes).trim() : null,
          req.auth.userId,
        ]
      );

      const patient = result.rows[0];

      await db.query(
        `INSERT INTO audit_logs (clinic_id, actor_auth_user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'create_patient', 'patient', $3, $4::jsonb)`,
        [
          req.auth.clinicId,
          req.auth.userId,
          patient.id,
          JSON.stringify({ firstName: patient.first_name, lastName: patient.last_name }),
        ]
      );

      return res.status(201).json({
        patient: sanitizePatient(patient),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/patients/:patientId', requireScopes(PERMISSIONS.PATIENTS_READ), async (req, res, next) => {
    const patientId = parsePositiveInteger(req.params.patientId);

    if (!patientId) {
      return sendJsonError(res, 400, 'patientId must be a positive integer.');
    }

    const authorizationError = assertClinicAccess(req, req.auth.clinicId);

    if (authorizationError) {
      return sendJsonError(res, 403, authorizationError);
    }

    try {
      const result = await db.query(
        `SELECT
           id,
           clinic_id,
           first_name,
           last_name,
           date_of_birth,
           sex,
           email,
           phone,
           address,
           emergency_contact_name,
           emergency_contact_phone,
           emergency_contact_relationship,
           insurance_provider,
           insurance_member_id,
           insurance_group_number,
           allergies,
           current_medications,
           chronic_conditions,
           notes,
           created_at,
           updated_at
         FROM patients
         WHERE id = $1
           AND clinic_id = $2`,
        [patientId, req.auth.clinicId]
      );

      const patient = result.rows[0];

      if (!patient) {
        return sendJsonError(res, 404, 'Patient not found.');
      }

      return res.status(200).json({
        patient: sanitizePatient(patient),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.put('/patients/:patientId', requireScopes(PERMISSIONS.PATIENTS_UPDATE), async (req, res, next) => {
    const patientId = parsePositiveInteger(req.params.patientId);

    if (!patientId) {
      return sendJsonError(res, 400, 'patientId must be a positive integer.');
    }

    const authorizationError = assertClinicAccess(req, req.auth.clinicId);

    if (authorizationError) {
      return sendJsonError(res, 403, authorizationError);
    }

    const {
      address,
      dateOfBirth,
      email,
      emergencyContact,
      firstName,
      healthAlerts,
      insuranceInfo,
      lastName,
      notes,
      phone,
      sex,
    } = req.body;

    if (!firstName || !lastName) {
      return sendJsonError(res, 400, 'firstName and lastName are required.');
    }

    try {
      const result = await db.query(
        `UPDATE patients
         SET first_name = $3,
             last_name = $4,
             date_of_birth = $5,
             sex = $6,
             email = $7,
             phone = $8,
             address = $9,
             emergency_contact_name = $10,
             emergency_contact_phone = $11,
             emergency_contact_relationship = $12,
             insurance_provider = $13,
             insurance_member_id = $14,
             insurance_group_number = $15,
             allergies = $16,
             current_medications = $17,
             chronic_conditions = $18,
             notes = $19,
             updated_by_auth_user_id = $20,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND clinic_id = $2
         RETURNING
           id,
           clinic_id,
           first_name,
           last_name,
           date_of_birth,
           sex,
           email,
           phone,
           address,
           emergency_contact_name,
           emergency_contact_phone,
           emergency_contact_relationship,
           insurance_provider,
           insurance_member_id,
           insurance_group_number,
           allergies,
           current_medications,
           chronic_conditions,
           notes,
           created_at,
           updated_at`,
        [
          patientId,
          req.auth.clinicId,
          String(firstName).trim(),
          String(lastName).trim(),
          dateOfBirth || null,
          sex || null,
          email ? normalizeEmail(email) : null,
          phone ? String(phone).trim() : null,
          address ? String(address).trim() : null,
          emergencyContact?.name ? String(emergencyContact.name).trim() : null,
          emergencyContact?.phone ? String(emergencyContact.phone).trim() : null,
          emergencyContact?.relationship ? String(emergencyContact.relationship).trim() : null,
          insuranceInfo?.provider ? String(insuranceInfo.provider).trim() : null,
          insuranceInfo?.memberId ? String(insuranceInfo.memberId).trim() : null,
          insuranceInfo?.groupNumber ? String(insuranceInfo.groupNumber).trim() : null,
          healthAlerts?.allergies ? String(healthAlerts.allergies).trim() : null,
          healthAlerts?.currentMedications ? String(healthAlerts.currentMedications).trim() : null,
          healthAlerts?.chronicConditions ? String(healthAlerts.chronicConditions).trim() : null,
          notes ? String(notes).trim() : null,
          req.auth.userId,
        ]
      );

      const patient = result.rows[0];

      if (!patient) {
        return sendJsonError(res, 404, 'Patient not found.');
      }

      await db.query(
        `INSERT INTO audit_logs (clinic_id, actor_auth_user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'update_patient', 'patient', $3, $4::jsonb)`,
        [
          req.auth.clinicId,
          req.auth.userId,
          patient.id,
          JSON.stringify({ firstName: patient.first_name, lastName: patient.last_name }),
        ]
      );

      return res.status(200).json({
        patient: sanitizePatient(patient),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/patients/:patientId', requireScopes(PERMISSIONS.PATIENTS_DELETE), async (req, res, next) => {
    const patientId = parsePositiveInteger(req.params.patientId);

    if (!patientId) {
      return sendJsonError(res, 400, 'patientId must be a positive integer.');
    }

    const authorizationError = assertClinicAccess(req, req.auth.clinicId);

    if (authorizationError) {
      return sendJsonError(res, 403, authorizationError);
    }

    try {
      const result = await db.query(
        `DELETE FROM patients
         WHERE id = $1
           AND clinic_id = $2
         RETURNING id, first_name, last_name`,
        [patientId, req.auth.clinicId]
      );

      const patient = result.rows[0];

      if (!patient) {
        return sendJsonError(res, 404, 'Patient not found.');
      }

      await db.query(
        `INSERT INTO audit_logs (clinic_id, actor_auth_user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'delete_patient', 'patient', $3, $4::jsonb)`,
        [
          req.auth.clinicId,
          req.auth.userId,
          patient.id,
          JSON.stringify({ firstName: patient.first_name, lastName: patient.last_name }),
        ]
      );

      return res.sendStatus(204);
    } catch (error) {
      return next(error);
    }
  });

  router.get(
    '/patients/:patientId/records',
    requireScopes(PERMISSIONS.RECORDS_READ),
    async (req, res, next) => {
      const patientId = parsePositiveInteger(req.params.patientId);

      if (!patientId) {
        return sendJsonError(res, 400, 'patientId must be a positive integer.');
      }

      const authorizationError = assertClinicAccess(req, req.auth.clinicId);

      if (authorizationError) {
        return sendJsonError(res, 403, authorizationError);
      }

      try {
        const patientResult = await db.query(
          `SELECT id
           FROM patients
           WHERE id = $1
             AND clinic_id = $2`,
          [patientId, req.auth.clinicId]
        );

        if (!patientResult.rows[0]) {
          return sendJsonError(res, 404, 'Patient not found.');
        }

        const result = await db.query(
          `SELECT
             id,
             patient_id,
             record_type,
             summary,
             details,
             visit_date,
             created_at
           FROM medical_records
           WHERE patient_id = $1
           ORDER BY visit_date DESC NULLS LAST, created_at DESC`,
          [patientId]
        );

        return res.status(200).json({
          records: result.rows.map(sanitizeMedicalRecord),
        });
      } catch (error) {
        return next(error);
      }
    }
  );

  router.post(
    '/patients/:patientId/records',
    requireScopes(PERMISSIONS.RECORDS_CREATE),
    async (req, res, next) => {
      const patientId = parsePositiveInteger(req.params.patientId);
      const { details, recordType, summary, visitDate } = req.body;

      if (!patientId) {
        return sendJsonError(res, 400, 'patientId must be a positive integer.');
      }

      if (!recordType || !summary) {
        return sendJsonError(res, 400, 'recordType and summary are required.');
      }

      const authorizationError = assertClinicAccess(req, req.auth.clinicId);

      if (authorizationError) {
        return sendJsonError(res, 403, authorizationError);
      }

      try {
        const patientResult = await db.query(
          `SELECT id
           FROM patients
           WHERE id = $1
             AND clinic_id = $2`,
          [patientId, req.auth.clinicId]
        );

        if (!patientResult.rows[0]) {
          return sendJsonError(res, 404, 'Patient not found.');
        }

        const result = await db.query(
          `INSERT INTO medical_records (
             patient_id,
             author_auth_user_id,
             record_type,
             summary,
             details,
             visit_date
           )
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING
             id,
             patient_id,
             record_type,
             summary,
             details,
             visit_date,
             created_at`,
          [
            patientId,
            req.auth.userId,
            String(recordType).trim(),
            String(summary).trim(),
            details ? String(details).trim() : null,
            visitDate || null,
          ]
        );

        const record = result.rows[0];

        await db.query(
          `INSERT INTO audit_logs (clinic_id, actor_auth_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, $2, 'create_medical_record', 'medical_record', $3, $4::jsonb)`,
          [
            req.auth.clinicId,
            req.auth.userId,
            record.id,
            JSON.stringify({ patientId, recordType: record.record_type }),
          ]
        );

        return res.status(201).json({
          record: sanitizeMedicalRecord(record),
        });
      } catch (error) {
        return next(error);
      }
    }
  );

  return {
    router,
  };
}

module.exports = {
  createPatientApi,
};
