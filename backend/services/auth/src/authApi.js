const crypto = require('crypto');

const bcrypt = require('bcryptjs');
const express = require('express');

const {
  normalizeEmail,
  parseBearerToken,
  sendJsonError,
} = require('../../../shared/http');
const {
  ASSIGN_SCOPE_BY_ROLE,
  ROLE_NAMES,
  scopesForRole,
} = require('../../../shared/rbac');

function sanitizeUser(row) {
  return {
    id: Number(row.id),
    clinicId: Number(row.clinic_id),
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    isActive: row.is_active,
    scopes: Array.isArray(row.scopes) ? row.scopes.filter(Boolean) : [],
  };
}

function sanitizeClinic(row) {
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
  };
}

function sanitizeRole(row) {
  return {
    name: row.name,
    description: row.description,
    scopes: Array.isArray(row.scopes) ? row.scopes.filter(Boolean) : [],
  };
}

function sortScopes(scopes) {
  return [...new Set((scopes || []).filter(Boolean))].sort();
}

function generateTemporaryPassword() {
  return `Temp-${crypto.randomBytes(9).toString('base64url')}`;
}

function scopesMatch(left, right) {
  const leftScopes = sortScopes(left);
  const rightScopes = sortScopes(right);

  return JSON.stringify(leftScopes) === JSON.stringify(rightScopes);
}

function createAuthApi(options = {}) {
  const router = express.Router();
  const db = options.db;
  const jwtSigner = options.jwtSigner;
  const jwtVerifier = options.jwtVerifier;
  const jwtExpiresIn = options.jwtExpiresIn || '15m';
  const internalServiceToken = options.internalServiceToken;

  if (!db || !jwtSigner || !jwtVerifier) {
    throw new Error('createAuthApi requires db, jwtSigner, and jwtVerifier.');
  }

  async function findUserByEmail(email) {
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
         c.slug AS clinic_slug,
         COALESCE(
           ARRAY_AGG(DISTINCT p.key ORDER BY p.key)
             FILTER (WHERE p.key IS NOT NULL),
           ARRAY[]::TEXT[]
         ) AS scopes
       FROM users u
       JOIN clinics c ON c.id = u.clinic_id
       LEFT JOIN roles r ON r.name = u.role
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       WHERE u.email = $1
       GROUP BY u.id, c.id`,
      [email]
    );

    return result.rows[0] || null;
  }

  async function findUserById(userId) {
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
         c.slug AS clinic_slug,
         COALESCE(
           ARRAY_AGG(DISTINCT p.key ORDER BY p.key)
             FILTER (WHERE p.key IS NOT NULL),
           ARRAY[]::TEXT[]
         ) AS scopes
       FROM users u
       JOIN clinics c ON c.id = u.clinic_id
       LEFT JOIN roles r ON r.name = u.role
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       WHERE u.id = $1
       GROUP BY u.id, c.id`,
      [userId]
    );

    return result.rows[0] || null;
  }

  async function findSessionBackedUser(sessionId, userId) {
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
         u.is_active,
         c.name AS clinic_name,
         c.slug AS clinic_slug,
         COALESCE(
           ARRAY_AGG(DISTINCT p.key ORDER BY p.key)
             FILTER (WHERE p.key IS NOT NULL),
           ARRAY[]::TEXT[]
         ) AS scopes
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       JOIN clinics c ON c.id = u.clinic_id
       LEFT JOIN roles r ON r.name = u.role
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       WHERE s.id = $1
         AND s.user_id = $2
       GROUP BY s.id, u.id, c.id`,
      [sessionId, userId]
    );

    return result.rows[0] || null;
  }

  async function authenticateToken(req, res, next) {
    const token = parseBearerToken(req.headers.authorization);

    if (!token) {
      return sendJsonError(res, 401, 'Authorization token is required.');
    }

    let payload;

    try {
      payload = jwtVerifier.verifyAccessToken(token);
    } catch (error) {
      return sendJsonError(res, 401, 'Invalid or expired token.');
    }

    const userId = Number(payload.sub);
    const clinicId = Number(payload.clinicId);
    const sessionId = payload.sessionId;
    const sessionUser = await findSessionBackedUser(sessionId, userId);

    if (
      !sessionUser ||
      !Number.isInteger(userId) ||
      !Number.isInteger(clinicId) ||
      sessionUser.revoked_at ||
      !sessionUser.is_active ||
      Number(sessionUser.clinic_id) !== clinicId ||
      sessionUser.role !== payload.role ||
      new Date(sessionUser.expires_at) <= new Date() ||
      !scopesMatch(sessionUser.scopes, payload.scopes)
    ) {
      return sendJsonError(res, 401, 'Invalid or expired token.');
    }

    req.accessToken = token;
    req.auth = {
      clinic: sanitizeClinic({
        id: sessionUser.clinic_id,
        name: sessionUser.clinic_name,
        slug: sessionUser.clinic_slug,
      }),
      clinicId: Number(sessionUser.clinic_id),
      email: sessionUser.email,
      firstName: sessionUser.first_name,
      lastName: sessionUser.last_name,
      role: sessionUser.role,
      scopes: sortScopes(sessionUser.scopes),
      sessionId: sessionUser.session_id,
      userId: Number(sessionUser.id),
    };

    return next();
  }

  function authenticateServiceRequest(req, res, next) {
    if (req.headers['x-service-token'] !== internalServiceToken) {
      return sendJsonError(res, 403, 'Invalid service credentials.');
    }

    return next();
  }

  function requireAdminProvisioningAccess(req, res, next) {
    const requestedRole = req.body.role || 'clinic_staff';
    const requiredAssignScope = ASSIGN_SCOPE_BY_ROLE[requestedRole];

    if (!ROLE_NAMES.includes(requestedRole)) {
      return sendJsonError(res, 400, `role must be one of: ${ROLE_NAMES.join(', ')}.`);
    }

    if (req.auth.role !== 'clinic_admin') {
      return sendJsonError(res, 403, 'Only clinic admins can manage employee identities.');
    }

    if (!req.auth.scopes.includes('employees.admin') || !req.auth.scopes.includes('employees.write')) {
      return sendJsonError(res, 403, 'You do not have permission to manage employees.');
    }

    if (!req.auth.scopes.includes(requiredAssignScope)) {
      return sendJsonError(res, 403, `You do not have permission to assign the ${requestedRole} role.`);
    }

    return next();
  }

  router.get('/', (req, res) => {
    res.json({
      service: 'auth-service',
      status: 'ok',
    });
  });

  router.get('/health', (req, res) => {
    res.json({
      service: 'auth-service',
      status: 'healthy',
    });
  });

  router.post('/auth/login', async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendJsonError(res, 400, 'email and password are required.');
    }

    try {
      const normalizedEmail = normalizeEmail(email);
      const user = await findUserByEmail(normalizedEmail);

      if (!user || !user.is_active) {
        return sendJsonError(res, 401, 'Invalid credentials.');
      }

      const passwordMatches = await bcrypt.compare(password, user.password_hash);

      if (!passwordMatches) {
        return sendJsonError(res, 401, 'Invalid credentials.');
      }

      const sessionId = crypto.randomUUID();
      const token = jwtSigner.signAccessToken({
        clinicId: Number(user.clinic_id),
        email: user.email,
        role: user.role,
        scopes: sortScopes(user.scopes),
        sessionId,
        sub: String(user.id),
      });
      const decodedToken = jwtVerifier.decodeToken(token);
      const expiresAt = new Date(decodedToken.exp * 1000);

      await db.query(
        `INSERT INTO auth_sessions (id, user_id, expires_at)
         VALUES ($1, $2, $3)`,
        [sessionId, user.id, expiresAt]
      );

      await db.query(
        `INSERT INTO audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'login', 'session', NULL, $3::jsonb)`,
        [
          user.clinic_id,
          user.id,
          JSON.stringify({ email: user.email, sessionId }),
        ]
      );

      return res.status(200).json({
        accessToken: token,
        clinic: sanitizeClinic({
          id: user.clinic_id_value,
          name: user.clinic_name,
          slug: user.clinic_slug,
        }),
        expiresIn: jwtExpiresIn,
        scopes: sortScopes(user.scopes),
        tokenType: 'Bearer',
        user: sanitizeUser(user),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/auth/me', authenticateToken, async (req, res) => {
    return res.status(200).json({
      clinic: req.auth.clinic,
      user: {
        clinicId: req.auth.clinicId,
        email: req.auth.email,
        firstName: req.auth.firstName,
        id: req.auth.userId,
        lastName: req.auth.lastName,
        role: req.auth.role,
        scopes: req.auth.scopes,
      },
    });
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

  router.get('/auth/roles', authenticateToken, async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT
           r.name,
           r.description,
           COALESCE(
             ARRAY_AGG(DISTINCT p.key ORDER BY p.key)
               FILTER (WHERE p.key IS NOT NULL),
             ARRAY[]::TEXT[]
           ) AS scopes
         FROM roles r
         LEFT JOIN role_permissions rp ON rp.role_id = r.id
         LEFT JOIN permissions p ON p.id = rp.permission_id
         GROUP BY r.id
         ORDER BY r.name ASC`
      );

      return res.status(200).json({
        roles: result.rows.map(sanitizeRole),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post(
    '/internal/introspect',
    authenticateServiceRequest,
    authenticateToken,
    (req, res) => {
      return res.status(200).json({
        active: true,
        principal: {
          clinic: req.auth.clinic,
          clinicId: req.auth.clinicId,
          email: req.auth.email,
          firstName: req.auth.firstName,
          lastName: req.auth.lastName,
          role: req.auth.role,
          scopes: req.auth.scopes,
          sessionId: req.auth.sessionId,
          userId: req.auth.userId,
        },
      });
    }
  );

  router.post(
    '/internal/users',
    authenticateServiceRequest,
    authenticateToken,
    requireAdminProvisioningAccess,
    async (req, res, next) => {
      const {
        email,
        firstName,
        lastName,
        password,
        role = 'clinic_staff',
      } = req.body;

      if (!email) {
        return sendJsonError(res, 400, 'email is required.');
      }

      try {
        const temporaryPassword = password ? null : generateTemporaryPassword();
        const passwordHash = await bcrypt.hash(password || temporaryPassword, 10);
        const normalizedEmail = normalizeEmail(email);
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
           RETURNING id`,
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

        const user = await findUserById(result.rows[0].id);

        await db.query(
          `INSERT INTO audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, $2, 'provision_user_identity', 'user', $3, $4::jsonb)`,
          [
            req.auth.clinicId,
            req.auth.userId,
            user.id,
            JSON.stringify({ email: user.email, role: user.role }),
          ]
        );

        return res.status(201).json({
          temporaryPassword,
          user: sanitizeUser(user),
        });
      } catch (error) {
        if (error.code === '23505') {
          return sendJsonError(res, 409, 'A user with that email already exists.');
        }

        return next(error);
      }
    }
  );

  router.patch(
    '/internal/users/:userId',
    authenticateServiceRequest,
    authenticateToken,
    async (req, res, next) => {
      const userId = Number(req.params.userId);
      const {
        email,
        firstName,
        lastName,
        role,
      } = req.body;

      if (!Number.isInteger(userId) || userId <= 0) {
        return sendJsonError(res, 400, 'userId must be a positive integer.');
      }

      if (req.auth.role !== 'clinic_admin' || !req.auth.scopes.includes('employees.admin')) {
        return sendJsonError(res, 403, 'Only clinic admins can update employee identities.');
      }

      const nextRole = role || 'clinic_staff';

      if (!ROLE_NAMES.includes(nextRole)) {
        return sendJsonError(res, 400, `role must be one of: ${ROLE_NAMES.join(', ')}.`);
      }

      const requiredAssignScope = ASSIGN_SCOPE_BY_ROLE[nextRole];

      if (!req.auth.scopes.includes(requiredAssignScope)) {
        return sendJsonError(res, 403, `You do not have permission to assign the ${nextRole} role.`);
      }

      try {
        const result = await db.query(
          `UPDATE users
           SET email = COALESCE($3, email),
               first_name = COALESCE($4, first_name),
               last_name = COALESCE($5, last_name),
               role = COALESCE($6, role),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1
             AND clinic_id = $2
           RETURNING id`,
          [
            userId,
            req.auth.clinicId,
            email ? normalizeEmail(email) : null,
            firstName !== undefined ? (firstName ? String(firstName).trim() : null) : null,
            lastName !== undefined ? (lastName ? String(lastName).trim() : null) : null,
            role || null,
          ]
        );

        if (!result.rows[0]) {
          return sendJsonError(res, 404, 'User not found.');
        }

        const user = await findUserById(result.rows[0].id);

        await db.query(
          `INSERT INTO audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, $2, 'update_user_identity', 'user', $3, $4::jsonb)`,
          [
            req.auth.clinicId,
            req.auth.userId,
            user.id,
            JSON.stringify({ email: user.email, role: user.role }),
          ]
        );

        return res.status(200).json({
          user: sanitizeUser(user),
        });
      } catch (error) {
        if (error.code === '23505') {
          return sendJsonError(res, 409, 'A user with that email already exists.');
        }

        return next(error);
      }
    }
  );

  router.delete(
    '/internal/users/:userId',
    authenticateServiceRequest,
    authenticateToken,
    async (req, res, next) => {
      const userId = Number(req.params.userId);

      if (!Number.isInteger(userId) || userId <= 0) {
        return sendJsonError(res, 400, 'userId must be a positive integer.');
      }

      if (req.auth.role !== 'clinic_admin' || !req.auth.scopes.includes('employees.admin')) {
        return sendJsonError(res, 403, 'Only clinic admins can delete employee identities.');
      }

      try {
        const result = await db.query(
          `DELETE FROM users
           WHERE id = $1
             AND clinic_id = $2
           RETURNING id, email, role`,
          [userId, req.auth.clinicId]
        );

        const deletedUser = result.rows[0];

        if (!deletedUser) {
          return sendJsonError(res, 404, 'User not found.');
        }

        await db.query(
          `INSERT INTO audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, $2, 'delete_user_identity', 'user', $3, $4::jsonb)`,
          [
            req.auth.clinicId,
            req.auth.userId,
            deletedUser.id,
            JSON.stringify({ email: deletedUser.email, role: deletedUser.role }),
          ]
        );

        return res.sendStatus(204);
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
  createAuthApi,
};
