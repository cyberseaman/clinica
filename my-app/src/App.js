import { useEffect, useState } from 'react';

import ClinicDashboard from './ClinicDashboard';
import Login from './Login';
import {
  authApiBaseUrl,
  clinicStorageKey,
  tokenStorageKey,
  userStorageKey,
} from './authConfig';

function parseStoredJson(key) {
  const value = localStorage.getItem(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    localStorage.removeItem(key);
    return null;
  }
}

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  const scopes = Array.isArray(user.scopes) && user.scopes.length > 0
    ? user.scopes.filter(Boolean)
    : Array.isArray(user.permissions)
      ? user.permissions.filter(Boolean)
      : [];

  return {
    ...user,
    permissions: scopes,
    scopes,
  };
}

function normalizeAuthPayload(payload) {
  const user = normalizeUser(payload?.user);

  return {
    clinic: payload?.clinic || null,
    token: payload?.accessToken || payload?.token || '',
    user,
  };
}

function App() {
  const [page, setPage] = useState(() =>
    window.location.pathname === '/dashboard' ? 'dashboard' : 'login'
  );
  const [token, setToken] = useState(() => localStorage.getItem(tokenStorageKey) || '');
  const [staffUser, setStaffUser] = useState(() => normalizeUser(parseStoredJson(userStorageKey)));
  const [clinic, setClinic] = useState(() => parseStoredJson(clinicStorageKey));
  const [authStatus, setAuthStatus] = useState(() => (token ? 'checking' : 'idle'));

  useEffect(() => {
    function handlePopState() {
      setPage(window.location.pathname === '/dashboard' ? 'dashboard' : 'login');
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setAuthStatus('idle');
      setStaffUser(null);
      setClinic(null);

      if (page === 'dashboard') {
        window.history.replaceState({}, '', '/');
        setPage('login');
      }

      return;
    }

    let ignore = false;

    async function verifySession() {
      setAuthStatus('checking');

      try {
        const response = await fetch(`${authApiBaseUrl}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Unable to verify session.');
        }

        if (!ignore) {
          const nextSession = normalizeAuthPayload(data);

          setStaffUser(nextSession.user);
          setClinic(nextSession.clinic);
          localStorage.setItem(userStorageKey, JSON.stringify(nextSession.user));
          localStorage.setItem(clinicStorageKey, JSON.stringify(nextSession.clinic));
          setAuthStatus('authenticated');
        }
      } catch (error) {
        if (!ignore) {
          localStorage.removeItem(tokenStorageKey);
          localStorage.removeItem(userStorageKey);
          localStorage.removeItem(clinicStorageKey);
          setToken('');
          setStaffUser(null);
          setClinic(null);
          setAuthStatus('idle');
          window.history.replaceState({}, '', '/');
          setPage('login');
        }
      }
    }

    verifySession();

    return () => {
      ignore = true;
    };
  }, [page, token]);

  function navigateToDashboard() {
    if (window.location.pathname !== '/dashboard') {
      window.history.pushState({}, '', '/dashboard');
    }
    setPage('dashboard');
  }

  function navigateToLogin() {
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    setPage('login');
  }

  function handleAuthenticated(data) {
    const nextSession = normalizeAuthPayload(data);

    localStorage.setItem(tokenStorageKey, nextSession.token);
    localStorage.setItem(userStorageKey, JSON.stringify(nextSession.user));
    localStorage.setItem(clinicStorageKey, JSON.stringify(nextSession.clinic));
    setToken(nextSession.token);
    setStaffUser(nextSession.user);
    setClinic(nextSession.clinic);
    setAuthStatus('authenticated');
    navigateToDashboard();
  }

  async function handleLogout() {
    const existingToken = token;

    localStorage.removeItem(tokenStorageKey);
    localStorage.removeItem(userStorageKey);
    localStorage.removeItem(clinicStorageKey);
    setToken('');
    setStaffUser(null);
    setClinic(null);
    setAuthStatus('idle');
    navigateToLogin();

    if (!existingToken) {
      return;
    }

    try {
      await fetch(`${authApiBaseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${existingToken}`,
        },
      });
    } catch (error) {
      // Logout should still complete locally even if the network call fails.
    }
  }

  if (page === 'dashboard' && staffUser && authStatus !== 'checking') {
    return (
      <ClinicDashboard
        clinic={clinic}
        staffUser={staffUser}
        token={token}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <Login
      onAuthenticated={handleAuthenticated}
      isCheckingSession={authStatus === 'checking'}
    />
  );
}

export default App;
