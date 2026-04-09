import React, { useEffect, useState } from 'react';

import { apiBaseUrl } from './authConfig';

function ClinicStaffPage({ token, staffUser, clinic }) {
  const [staffMembers, setStaffMembers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [formStatus, setFormStatus] = useState('idle');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formValues, setFormValues] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'clinic_staff',
  });

  useEffect(() => {
    let ignore = false;

    async function loadUsers() {
      setStatus('loading');
      setError('');

      try {
        const response = await fetch(`${apiBaseUrl}/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Unable to load clinic users.');
        }

        if (!ignore) {
          setStaffMembers(data.users || []);
          setStatus('ready');
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message);
          setStatus('error');
        }
      }
    }

    loadUsers();

    return () => {
      ignore = true;
    };
  }, [token]);

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
    setFormStatus('submitting');
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${apiBaseUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formValues),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to create clinic user.');
      }

      setStaffMembers((current) => [data.user, ...current]);
      setFormValues({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'clinic_staff',
      });
      setSuccess('Clinic user account created successfully.');
      setFormStatus('idle');
    } catch (submitError) {
      setError(submitError.message);
      setFormStatus('idle');
    }
  }

  const canCreateAdmins = staffUser.role === 'clinic_admin';

  return (
    <section className="dashboard-content">
      <div className="dashboard-section-header">
        <span className="dashboard-section-eyebrow">Clinic Admin</span>
        <h2>Create clinic staff</h2>
        <p>
          Create staff and admin accounts directly inside {clinic?.name || 'your clinic'}.
          New users can sign in immediately after their account is created.
        </p>
      </div>

      <div className="staff-admin-layout">
        <section className="dashboard-card staff-form-card">
          <h3>Create a new clinic user</h3>
          <p className="dashboard-copy">
            This creates an active account immediately without any invitation email flow.
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="staff-form-grid">
              <label className="login-field">
                <span>First name</span>
                <input
                  type="text"
                  value={formValues.firstName}
                  onChange={updateField('firstName')}
                  placeholder="Avery"
                />
              </label>

              <label className="login-field">
                <span>Last name</span>
                <input
                  type="text"
                  value={formValues.lastName}
                  onChange={updateField('lastName')}
                  placeholder="Johnson"
                />
              </label>
            </div>

            <label className="login-field">
              <span>Email</span>
              <input
                type="email"
                value={formValues.email}
                onChange={updateField('email')}
                placeholder="staff@clinic.org"
                required
              />
            </label>

            <label className="login-field">
              <span>Password</span>
              <input
                type="password"
                value={formValues.password}
                onChange={updateField('password')}
                placeholder="Create a password"
                required
              />
            </label>

            <label className="login-field">
              <span>Role</span>
              <select
                className="staff-select"
                value={formValues.role}
                onChange={updateField('role')}
              >
                <option value="clinic_staff">Clinic staff</option>
                {canCreateAdmins ? (
                  <option value="clinic_admin">Clinic admin</option>
                ) : null}
              </select>
            </label>

            {success ? <p className="login-success">{success}</p> : null}
            {error ? <p className="login-error">{error}</p> : null}

            <button
              type="submit"
              className="login-button"
              disabled={formStatus === 'submitting'}
            >
              {formStatus === 'submitting' ? 'Creating User...' : 'Create User Account'}
            </button>
          </form>
        </section>

        <section className="dashboard-card staff-list-card">
          <div className="staff-list-header">
            <div>
              <h3>Active clinic users</h3>
              <p className="dashboard-copy">
                Existing staff and admin accounts for this clinic.
              </p>
            </div>
            <span className="login-endpoint-label">{staffMembers.length} users</span>
          </div>

          {status === 'loading' ? <p className="dashboard-copy">Loading clinic users...</p> : null}

          {status === 'ready' ? (
            <div className="staff-list">
              {staffMembers.map((member) => (
                <article key={member.id} className="staff-list-item">
                  <div>
                    <strong>
                      {[member.firstName, member.lastName].filter(Boolean).join(' ') || member.email}
                    </strong>
                    <span>{member.email}</span>
                  </div>
                  <div className="staff-list-meta">
                    <span className="staff-role-pill">{member.role.replace('_', ' ')}</span>
                    <span className={`staff-status-pill ${member.isActive ? 'is-active' : 'is-inactive'}`}>
                      {member.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}

export default ClinicStaffPage;
