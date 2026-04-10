import React, { useEffect, useState } from 'react';

import { apiBaseUrl } from './authConfig';
import { formatRoleLabel, getAssignableRoles, hasPermission, permissions, roleLabels } from './rbac';

function ClinicStaffPage({ token, staffUser, clinic }) {
  const [staffMembers, setStaffMembers] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
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
  const canReadUsers = hasPermission(staffUser, permissions.USERS_READ);
  const canCreateUsers = hasPermission(staffUser, permissions.USERS_CREATE);

  useEffect(() => {
    let ignore = false;

    async function loadUsersAndRoles() {
      setStatus('loading');
      setError('');

      try {
        const requests = [];

        if (canReadUsers) {
          requests.push(
            fetch(`${apiBaseUrl}/users`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }).then(async (response) => {
              const data = await response.json();

              if (!response.ok) {
                throw new Error(data.error || 'Unable to load clinic users.');
              }

              return data.users || [];
            })
          );
        } else {
          requests.push(Promise.resolve([]));
        }

        requests.push(
          fetch(`${apiBaseUrl}/auth/roles`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          }).then(async (response) => {
            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || 'Unable to load available roles.');
            }

            return data.roles || [];
          })
        );

        const [users, roles] = await Promise.all(requests);

        if (!ignore) {
          const assignableRoles = getAssignableRoles(staffUser);
          const filteredRoles = roles.filter((role) => assignableRoles.includes(role.name));

          setStaffMembers(users);
          setAvailableRoles(filteredRoles);
          setFormValues((current) => ({
            ...current,
            role: filteredRoles[0]?.name || current.role,
          }));
          setStatus('ready');
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message);
          setStatus('error');
        }
      }
    }

    loadUsersAndRoles();

    return () => {
      ignore = true;
    };
  }, [canReadUsers, staffUser, token]);

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
        role: availableRoles[0]?.name || 'clinic_staff',
      });
      setSuccess('Clinic user account created successfully.');
      setFormStatus('idle');
    } catch (submitError) {
      setError(submitError.message);
      setFormStatus('idle');
    }
  }

  return (
    <section className="dashboard-content">
      <div className="dashboard-section-header">
        <span className="dashboard-section-eyebrow">Role-Based Access</span>
        <h2>Manage clinic users</h2>
        <p>
          Create role-based accounts inside {clinic?.name || 'your clinic'} and review which
          users currently have access to your clinic workspace.
        </p>
      </div>

      <div className="staff-admin-layout">
        <section className="dashboard-card staff-form-card">
          <h3>Create a new clinic user</h3>
          <p className="dashboard-copy">
            This creates an active account immediately without any invitation email flow.
          </p>

          {!canCreateUsers ? (
            <p className="dashboard-copy">
              Your account can view clinic users but cannot create or assign new ones.
            </p>
          ) : (
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
                {availableRoles.map((role) => (
                  <option key={role.name} value={role.name}>
                    {roleLabels[role.name] || formatRoleLabel(role.name)}
                  </option>
                ))}
              </select>
            </label>

            {formValues.role ? (
              <p className="dashboard-copy">
                {
                  availableRoles.find((role) => role.name === formValues.role)?.description
                  || 'This role inherits a predefined set of clinic permissions.'
                }
              </p>
            ) : null}

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
          )}
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

          {status === 'ready' && canReadUsers ? (
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
                    <span className="staff-role-pill">{formatRoleLabel(member.role)}</span>
                    <span className={`staff-status-pill ${member.isActive ? 'is-active' : 'is-inactive'}`}>
                      {member.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {status === 'ready' && !canReadUsers ? (
            <p className="dashboard-copy">
              Your account cannot view the full clinic user roster.
            </p>
          ) : null}
        </section>
      </div>
    </section>
  );
}

export default ClinicStaffPage;
