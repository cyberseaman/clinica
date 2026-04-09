const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const STAFF_ROLES = ['clinic_staff', 'clinic_admin'];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function parseBearerToken(headerValue) {
  if (!headerValue || !headerValue.startsWith('Bearer ')) {
    return null;
  }

  return headerValue.slice('Bearer '.length).trim();
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
  };
}

function sanitizeClinic(row) {
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
  };
}

function buildAuthResponse({ token, expiresIn, user, clinic }) {
  return {
    token,
    expiresIn,
    user: sanitizeUser(user),
    clinic: clinic ? sanitizeClinic(clinic) : undefined,
  };
}

function toInteger(value) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue)) {
    return null;
  }

  return parsedValue;
}

function createAuthApi(options = {}) {
  const router = express.Router();
  const db = options.db;
  const jwtSecret = options.jwtSecret || 'development-secret-change-me';
  const jwtExpiresIn = options.jwtExpiresIn || '1h';

  if (!db) {
    throw new Error('createAuthApi requires a database instance.');
  }

  function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
      if (!req.auth || !allowedRoles.includes(req.auth.role)) {
        return res.status(403).json({
          error: 'You do not have permission to perform this action.',
        });
      }

      return next();
    };
  }

  async function createSessionToken(queryable, user) {
    const sessionId = crypto.randomUUID();
    const token = jwt.sign(
      {
        sub: String(user.id),
        clinicId: user.clinic_id,
        role: user.role,
        sessionId,
      },
      jwtSecret,
      { expiresIn: jwtExpiresIn }
    );

    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000);

    await queryable.query(
      `INSERT INTO auth_sessions (id, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [sessionId, user.id, expiresAt]
    );

    return {
      token,
      expiresIn: jwtExpiresIn,
      sessionId,
    };
  }

  async function authenticateToken(req, res, next) {
    const token = parseBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        error: 'Authorization token is required.',
      });
    }

    let payload;

    try {
      payload = jwt.verify(token, jwtSecret);
    } catch (error) {
      return res.status(401).json({
        error: 'Invalid or expired token.',
      });
    }

    const result = await db.query(
      `SELECT
         s.id AS session_id,
         s.expires_at,
         s.revoked_at,
         u.id,
         u.clinic_id,
         u.email,
         u.first_name,
         u.last_name,
         u.role,
         u.is_active
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1
         AND s.user_id = $2`,
      [payload.sessionId, Number(payload.sub)]
    );

    const sessionUser = result.rows[0];
    const sessionUserId = sessionUser ? toInteger(sessionUser.id) : null;
    const sessionClinicId = sessionUser ? toInteger(sessionUser.clinic_id) : null;
    const payloadUserId = toInteger(payload.sub);
    const payloadClinicId = toInteger(payload.clinicId);

    if (
      !sessionUser ||
      !sessionUserId ||
      !sessionClinicId ||
      !payloadUserId ||
      !payloadClinicId ||
      sessionUser.revoked_at ||
      !sessionUser.is_active ||
      payloadUserId !== sessionUserId ||
      payloadClinicId !== sessionClinicId ||
      payload.role !== sessionUser.role ||
      new Date(sessionUser.expires_at) <= new Date()
    ) {
      return res.status(401).json({
        error: 'Invalid or expired token.',
      });
    }

    req.auth = {
      userId: sessionUserId,
      sessionId: sessionUser.session_id,
      clinicId: sessionClinicId,
      email: sessionUser.email,
      role: sessionUser.role,
      firstName: sessionUser.first_name,
      lastName: sessionUser.last_name,
    };

    return next();
  }

  router.post('/auth/login', async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'email and password are required.',
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const result = await db.query(
      `SELECT
         u.id,
         u.clinic_id,
         u.email,
         u.password_hash,
         u.first_name,
         u.last_name,
         u.role,
         u.is_active,
         c.id AS clinic_id_value,
         c.name AS clinic_name,
         c.slug AS clinic_slug
       FROM users u
       JOIN clinics c ON c.id = u.clinic_id
       WHERE u.email = $1`,
      [normalizedEmail]
    );

    const user = result.rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({
        error: 'Invalid credentials.',
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        error: 'Invalid credentials.',
      });
    }

    try {
      const session = await createSessionToken(db, user);

      await db.query(
        `INSERT INTO audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'login', 'user', $2, $3::jsonb)`,
        [
          user.clinic_id,
          user.id,
          JSON.stringify({ email: user.email }),
        ]
      );

      return res.status(200).json(
        buildAuthResponse({
          ...session,
          user,
          clinic: {
            id: user.clinic_id_value,
            name: user.clinic_name,
            slug: user.clinic_slug,
          },
        })
      );
    } catch (error) {
      return next(error);
    }
  });

  router.post('/auth/logout', authenticateToken, async (req, res, next) => {
    try {
      await db.query(
        `UPDATE auth_sessions
         SET revoked_at = CURRENT_TIMESTAMP,
             revoked_by_user_id = $2
         WHERE id = $1
           AND revoked_at IS NULL`,
        [req.auth.sessionId, req.auth.userId]
      );

      await db.query(
        `INSERT INTO audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'logout', 'session', NULL, $3::jsonb)`,
        [
          req.auth.clinicId,
          req.auth.userId,
          JSON.stringify({ sessionId: req.auth.sessionId }),
        ]
      );

      return res.status(200).json({
        message: 'Logged out successfully.',
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/auth/me', authenticateToken, async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT
           u.id,
           u.clinic_id,
           u.email,
           u.first_name,
           u.last_name,
           u.role,
           u.is_active,
           c.id AS clinic_id_value,
           c.name AS clinic_name,
           c.slug AS clinic_slug
         FROM users u
         JOIN clinics c ON c.id = u.clinic_id
         WHERE u.id = $1`,
        [req.auth.userId]
      );

      const user = result.rows[0];

      return res.status(200).json({
        user: sanitizeUser(user),
        clinic: {
          id: Number(user.clinic_id_value),
          name: user.clinic_name,
          slug: user.clinic_slug,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  return {
    router,
    authenticateToken,
    authorizeRoles,
    STAFF_ROLES,
  };
}

module.exports = {
  STAFF_ROLES,
  createAuthApi,
};
