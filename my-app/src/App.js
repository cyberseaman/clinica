import { useEffect, useState } from 'react';

import ClinicDashboard from './ClinicDashboard';
import Login from './Login';
import {
  apiBaseUrl,
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

function App() {
  const [page, setPage] = useState(() =>
    window.location.pathname === '/dashboard' ? 'dashboard' : 'login'
  );
  const [token, setToken] = useState(() => localStorage.getItem(tokenStorageKey) || '');
  const [staffUser, setStaffUser] = useState(() => parseStoredJson(userStorageKey));
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
        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Unable to verify session.');
        }

        if (!ignore) {
          setStaffUser(data.user || null);
          setClinic(data.clinic || null);
          localStorage.setItem(userStorageKey, JSON.stringify(data.user || null));
          localStorage.setItem(clinicStorageKey, JSON.stringify(data.clinic || null));
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
    localStorage.setItem(tokenStorageKey, data.token);
    localStorage.setItem(userStorageKey, JSON.stringify(data.user));
    localStorage.setItem(clinicStorageKey, JSON.stringify(data.clinic || null));
    setToken(data.token);
    setStaffUser(data.user);
    setClinic(data.clinic || null);
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
      await fetch(`${apiBaseUrl}/auth/logout`, {
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
