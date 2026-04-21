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

function sanitizeEmployee(row) {
  return {
    authUserId: Number(row.auth_user_id),
    clinicId: Number(row.clinic_id),
    createdAt: row.created_at,
    email: row.email,
    employmentStatus: row.employment_status,
    firstName: row.first_name,
    id: Number(row.id),
    lastName: row.last_name,
    role: row.role,
    updatedAt: row.updated_at,
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

  router.get(
    '/employees',
    requireScopes(PERMISSIONS.EMPLOYEES_READ),
    async (req, res, next) => {
      const authorizationError = assertClinicAdminAuthority(req, req.auth.clinicId);

      if (authorizationError) {
        return sendJsonError(res, 403, authorizationError);
      }

      try {
        const result = await db.query(
          `SELECT
             id,
             auth_user_id,
             clinic_id,
             email,
             first_name,
             last_name,
             role,
             employment_status,
             created_at,
             updated_at
           FROM employees
           WHERE clinic_id = $1
           ORDER BY created_at DESC`,
          [req.auth.clinicId]
        );

        return res.status(200).json({
          employees: result.rows.map(sanitizeEmployee),
        });
      } catch (error) {
        return next(error);
      }
    }
  );

  router.get(
    '/employees/:employeeId',
    requireScopes(PERMISSIONS.EMPLOYEES_READ),
    async (req, res, next) => {
      const employeeId = parsePositiveInteger(req.params.employeeId);

      if (!employeeId) {
        return sendJsonError(res, 400, 'employeeId must be a positive integer.');
      }

      const authorizationError = assertClinicAdminAuthority(req, req.auth.clinicId);

      if (authorizationError) {
        return sendJsonError(res, 403, authorizationError);
      }

      try {
        const result = await db.query(
          `SELECT
             id,
             auth_user_id,
             clinic_id,
             email,
             first_name,
             last_name,
             role,
             employment_status,
             created_at,
             updated_at
           FROM employees
           WHERE id = $1
             AND clinic_id = $2`,
          [employeeId, req.auth.clinicId]
        );

        const employee = result.rows[0];

        if (!employee) {
          return sendJsonError(res, 404, 'Employee not found.');
        }

        return res.status(200).json({
          employee: sanitizeEmployee(employee),
        });
      } catch (error) {
        return next(error);
      }
    }
  );

  router.post(
    '/employees',
    requireScopes(PERMISSIONS.EMPLOYEES_WRITE),
    async (req, res, next) => {
      const {
        email,
        firstName,
        lastName,
        password,
        role = 'clinic_staff',
      } = req.body;

      if (!email || !password) {
        return sendJsonError(res, 400, 'email and password are required.');
      }

      if (!ROLE_NAMES.includes(role)) {
        return sendJsonError(res, 400, `role must be one of: ${ROLE_NAMES.join(', ')}.`);
      }

      const authorizationError = assertClinicAdminAuthority(req, req.auth.clinicId);

      if (authorizationError) {
        return sendJsonError(res, 403, authorizationError);
      }

      const requiredAssignScope = ASSIGN_SCOPE_BY_ROLE[role];

      if (!req.auth.scopes.includes(requiredAssignScope)) {
        return sendJsonError(res, 403, `You do not have permission to assign the ${role} role.`);
      }

      let provisionedUser = null;

      try {
        const authResponse = await authClient.provisionEmployeeIdentity(req.accessToken, {
          email: normalizeEmail(email),
          firstName,
          lastName,
          password,
          role,
        });

        provisionedUser = authResponse.user;

        const result = await db.query(
          `INSERT INTO employees (
             auth_user_id,
             clinic_id,
             email,
             first_name,
             last_name,
             role,
             created_by_auth_user_id,
             updated_by_auth_user_id
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
           RETURNING
             id,
             auth_user_id,
             clinic_id,
             email,
             first_name,
             last_name,
             role,
             employment_status,
             created_at,
             updated_at`,
          [
            provisionedUser.id,
            req.auth.clinicId,
            provisionedUser.email,
            firstName ? String(firstName).trim() : null,
            lastName ? String(lastName).trim() : null,
            role,
            req.auth.userId,
          ]
        );

        const employee = result.rows[0];

        await db.query(
          `INSERT INTO audit_logs (clinic_id, actor_auth_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, $2, 'create_employee', 'employee', $3, $4::jsonb)`,
          [
            req.auth.clinicId,
            req.auth.userId,
            employee.id,
            JSON.stringify({ authUserId: employee.auth_user_id, email: employee.email, role }),
          ]
        );

        return res.status(201).json({
          employee: sanitizeEmployee(employee),
        });
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
          return sendJsonError(res, 409, 'An employee with that email already exists.');
        }

        return next(error);
      }
    }
  );

  return {
    router,
  };
}

module.exports = {
  createEmployeeApi,
};
