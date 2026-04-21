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

  return {
    introspectAccessToken,
  };
}

module.exports = {
  createAuthClient,
};
