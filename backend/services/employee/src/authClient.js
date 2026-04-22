async function parseServiceResponse(response) {
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const error = new Error(payload?.error || `Auth service error (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function createAuthClient(options = {}) {
  const authServiceUrl = options.authServiceUrl;
  const internalServiceToken = options.internalServiceToken;

  if (!authServiceUrl || !internalServiceToken) {
    throw new Error('authServiceUrl and internalServiceToken are required.');
  }

  async function introspectAccessToken(accessToken) {
    const response = await fetch(`${authServiceUrl}/internal/introspect`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Service-Token': internalServiceToken,
      },
      body: JSON.stringify({}),
    });

    return parseServiceResponse(response);
  }

  async function provisionEmployeeIdentity(accessToken, payload) {
    const response = await fetch(`${authServiceUrl}/internal/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Service-Token': internalServiceToken,
      },
      body: JSON.stringify(payload),
    });

    return parseServiceResponse(response);
  }

  async function updateEmployeeIdentity(accessToken, userId, payload) {
    const response = await fetch(`${authServiceUrl}/internal/users/${userId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Service-Token': internalServiceToken,
      },
      body: JSON.stringify(payload),
    });

    return parseServiceResponse(response);
  }

  async function rollbackEmployeeIdentity(accessToken, userId) {
    const response = await fetch(`${authServiceUrl}/internal/users/${userId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Service-Token': internalServiceToken,
      },
    });

    if (response.status === 404) {
      return null;
    }

    return parseServiceResponse(response);
  }

  return {
    introspectAccessToken,
    provisionEmployeeIdentity,
    rollbackEmployeeIdentity,
    updateEmployeeIdentity,
  };
}

module.exports = {
  createAuthClient,
};
