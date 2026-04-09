import React, { useEffect, useState } from 'react';

import { apiBaseUrl } from './authConfig';

const workflowSteps = [
  'Seed the first clinic admin from the backend',
  'Create additional staff and admin accounts from the dashboard',
  'Sign in securely with your email and password',
];

function Login({ onAuthenticated, isCheckingSession }) {
  const [formValues, setFormValues] = useState({
    email: '',
    password: '',
  });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  function updateField(field) {
    return (event) => {
      setFormValues((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('submitting');
    setError('');

    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formValues),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Clinic sign-in failed.');
      }

      setStatus('idle');
      onAuthenticated(data);
    } catch (submitError) {
      setStatus('idle');
      setError(submitError.message);
    }
  }

  useEffect(() => {
    if (!isCheckingSession) {
      return;
    }

    setError('');
  }, [isCheckingSession]);

  const isBusy = status === 'submitting' || isCheckingSession;

  return (
    <main className="login-page">
      <section className="login-panel login-panel--brand" aria-hidden="true">
        <div className="login-brand-copy">
          <span className="login-badge">Clinic Operations Portal</span>
          <h1>Secure clinic access for seeded admins and admin-created staff.</h1>
          <p>
            The first clinic admin is bootstrapped from the backend, and every
            additional staff or admin account is created inside the application
            by an authenticated clinic admin.
          </p>
          <div className="login-feature-list">
            <div>
              <strong>Seeded first admin</strong>
              <span>The first clinic admin is created with the backend seed command instead of public registration.</span>
            </div>
            <div>
              <strong>Admin-created accounts</strong>
              <span>Clinic admins can create additional staff and admin users directly from the dashboard.</span>
            </div>
            <div>
              <strong>Role-based access</strong>
              <span>Clinic admins and clinic staff stay separated through the backend role model.</span>
            </div>
            <div>
              <strong>Protected sessions</strong>
              <span>JWT-backed login still powers the authenticated dashboard and clinic workflows.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="login-panel login-panel--form">
        <div className="login-card">
          <div className="login-card__header">
            <span className="login-eyebrow">Protected Access</span>
            <h2>Clinic sign in</h2>
            <p>Sign in with an existing clinic admin or clinic staff account.</p>
          </div>

          <div className="login-role-summary">
            <span className="login-role-summary__badge">Admin Managed</span>
            <h3>Account creation happens inside the clinic dashboard</h3>
            <p>
              This page is only for logging in. New clinic users should be
              created by a signed-in clinic admin after the first admin is
              seeded from the backend.
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <span>Email</span>
              <input
                type="email"
                placeholder="admin@clinic.org"
                value={formValues.email}
                onChange={updateField('email')}
                autoComplete="email"
                required
              />
            </label>

            <label className="login-field">
              <span>Password</span>
              <input
                type="password"
                placeholder="Enter your password"
                value={formValues.password}
                onChange={updateField('password')}
                autoComplete="current-password"
                required
              />
            </label>

            <div className="login-form__meta">
              <label className="login-checkbox">
                <input type="checkbox" defaultChecked />
                <span>Keep this device signed in</span>
              </label>
              <span className="login-endpoint-label">{apiBaseUrl}</span>
            </div>

            <div className="login-workflow-card">
              <strong>Access flow</strong>
              <ul className="login-workflow-list">
                {workflowSteps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            {error ? <p className="login-error">{error}</p> : null}

            <button type="submit" className="login-button" disabled={isBusy}>
              {isCheckingSession
                ? 'Checking Session...'
                : status === 'submitting'
                  ? 'Signing In...'
                  : 'Access Dashboard'}
            </button>

            <p className="login-helper-text">
              Configure
              <code> REACT_APP_API_BASE_URL </code>
              if your API is not running at
              <code> http://localhost:3000</code>.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

export default Login;
