const bcrypt = require('bcryptjs');
const express = require('express');

const ALLOWED_USER_ROLES = ['clinic_staff', 'clinic_admin'];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeUser(row) {
  return {
    id: Number(row.id),
    clinicId: Number(row.clinic_id),
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function sanitizePatient(row) {
  return {
    id: Number(row.id),
    clinicId: Number(row.clinic_id),
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    sex: row.sex,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sanitizeMedicalRecord(row) {
  return {
    id: Number(row.id),
    patientId: Number(row.patient_id),
    recordType: row.record_type,
    summary: row.summary,
    details: row.details,
    visitDate: row.visit_date,
    createdAt: row.created_at,
  };
}

function parseId(value) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

function createClinicApi({ db, authenticateToken, authorizeRoles, staffRoles }) {
  const router = express.Router();

  router.use(authenticateToken);
  router.use(authorizeRoles(...staffRoles));

  router.post('/users', async (req, res, next) => {
    const {
      email,
      password,
      firstName,
      lastName,
      role = 'clinic_staff',
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'email and password are required.',
      });
    }

    if (!ALLOWED_USER_ROLES.includes(role)) {
      return res.status(400).json({
        error: `role must be one of: ${ALLOWED_USER_ROLES.join(', ')}.`,
      });
    }

    if (role === 'clinic_admin' && req.auth.role !== 'clinic_admin') {
      return res.status(403).json({
        error: 'Only clinic admins can create additional clinic admins.',
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const result = await db.query(
        `INSERT INTO users (
           clinic_id,
           email,
           password_hash,
           first_name,
           last_name,
           role,
           created_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, clinic_id, email, first_name, last_name, role, is_active, created_at`,
        [
          req.auth.clinicId,
          normalizedEmail,
          passwordHash,
          firstName ? String(firstName).trim() : null,
          lastName ? String(lastName).trim() : null,
          role,
          req.auth.userId,
        ]
      );

      const user = result.rows[0];

      await db.query(
        `INSERT INTO audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'create_user', 'user', $3, $4::jsonb)`,
        [
          req.auth.clinicId,
          req.auth.userId,
          user.id,
          JSON.stringify({ email: user.email, role: user.role }),
        ]
      );

      return res.status(201).json({
        user: sanitizeUser(user),
      });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'A user with that email already exists.',
        });
      }

      return next(error);
    }
  });

  router.get('/users', async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT id, clinic_id, email, first_name, last_name, role, is_active, created_at
         FROM users
         WHERE clinic_id = $1
         ORDER BY created_at DESC`,
        [req.auth.clinicId]
      );

      return res.status(200).json({
        users: result.rows.map(sanitizeUser),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/patients', async (req, res, next) => {
    const {
      firstName,
      lastName,
      dateOfBirth,
      sex,
      email,
      phone,
      notes,
    } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({
        error: 'firstName and lastName are required.',
      });
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
           notes,
           created_by,
           updated_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
         RETURNING id, clinic_id, first_name, last_name, date_of_birth, sex, email, phone, notes, created_at, updated_at`,
        [
          req.auth.clinicId,
          String(firstName).trim(),
          String(lastName).trim(),
          dateOfBirth || null,
          sex || null,
          email ? normalizeEmail(email) : null,
          phone ? String(phone).trim() : null,
          notes ? String(notes).trim() : null,
          req.auth.userId,
        ]
      );

      const patient = result.rows[0];

      await db.query(
        `INSERT INTO audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, metadata)
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

  router.get('/patients', async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT id, clinic_id, first_name, last_name, date_of_birth, sex, email, phone, notes, created_at, updated_at
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

  router.get('/patients/:patientId', async (req, res, next) => {
    const patientId = parseId(req.params.patientId);

    if (!patientId) {
      return res.status(400).json({
        error: 'patientId must be a positive integer.',
      });
    }

    try {
      const result = await db.query(
        `SELECT id, clinic_id, first_name, last_name, date_of_birth, sex, email, phone, notes, created_at, updated_at
         FROM patients
         WHERE id = $1
           AND clinic_id = $2`,
        [patientId, req.auth.clinicId]
      );

      const patient = result.rows[0];

      if (!patient) {
        return res.status(404).json({
          error: 'Patient not found.',
        });
      }

      return res.status(200).json({
        patient: sanitizePatient(patient),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.put('/patients/:patientId', async (req, res, next) => {
    const patientId = parseId(req.params.patientId);
    const {
      firstName,
      lastName,
      dateOfBirth,
      sex,
      email,
      phone,
      notes,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        error: 'patientId must be a positive integer.',
      });
    }

    if (!firstName || !lastName) {
      return res.status(400).json({
        error: 'firstName and lastName are required.',
      });
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
             notes = $9,
             updated_by = $10,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND clinic_id = $2
         RETURNING id, clinic_id, first_name, last_name, date_of_birth, sex, email, phone, notes, created_at, updated_at`,
        [
          patientId,
          req.auth.clinicId,
          String(firstName).trim(),
          String(lastName).trim(),
          dateOfBirth || null,
          sex || null,
          email ? normalizeEmail(email) : null,
          phone ? String(phone).trim() : null,
          notes ? String(notes).trim() : null,
          req.auth.userId,
        ]
      );

      const patient = result.rows[0];

      if (!patient) {
        return res.status(404).json({
          error: 'Patient not found.',
        });
      }

      await db.query(
        `INSERT INTO audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, metadata)
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

  router.post('/patients/:patientId/records', async (req, res, next) => {
    const patientId = parseId(req.params.patientId);
    const {
      recordType,
      summary,
      details,
      visitDate,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        error: 'patientId must be a positive integer.',
      });
    }

    if (!recordType || !summary) {
      return res.status(400).json({
        error: 'recordType and summary are required.',
      });
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
        return res.status(404).json({
          error: 'Patient not found.',
        });
      }

      const result = await db.query(
        `INSERT INTO medical_records (
           patient_id,
           author_user_id,
           record_type,
           summary,
           details,
           visit_date
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, patient_id, record_type, summary, details, visit_date, created_at`,
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
        `INSERT INTO audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, metadata)
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
  });

  router.get('/patients/:patientId/records', async (req, res, next) => {
    const patientId = parseId(req.params.patientId);

    if (!patientId) {
      return res.status(400).json({
        error: 'patientId must be a positive integer.',
      });
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
        return res.status(404).json({
          error: 'Patient not found.',
        });
      }

      const result = await db.query(
        `SELECT id, patient_id, record_type, summary, details, visit_date, created_at
         FROM medical_records
         WHERE patient_id = $1
         ORDER BY created_at DESC`,
        [patientId]
      );

      return res.status(200).json({
        records: result.rows.map(sanitizeMedicalRecord),
      });
    } catch (error) {
      return next(error);
    }
  });

  return {
    router,
  };
}

module.exports = {
  createClinicApi,
};
