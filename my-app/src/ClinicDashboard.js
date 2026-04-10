import React, { useMemo, useState } from 'react';

import { apiBaseUrl } from './authConfig';
import ClinicStaffPage from './ClinicStaffPage';
import { formatRoleLabel, hasPermission, permissions } from './rbac';

function ClinicDashboard({ clinic, staffUser, token, onLogout }) {
  const canManageUsers =
    hasPermission(staffUser, permissions.USERS_READ) ||
    hasPermission(staffUser, permissions.USERS_CREATE);
  const [activePage, setActivePage] = useState('overview');

  const navigationItems = useMemo(() => {
    const baseItems = [
      { id: 'overview', label: 'Overview' },
    ];

    if (canManageUsers) {
      baseItems.push({ id: 'staff', label: 'Staff Management' });
    }

    return baseItems;
  }, [canManageUsers]);

  function renderOverview() {
    return (
      <section className="dashboard-content">
        <div className="dashboard-grid">
          <section className="dashboard-card">
            <span className="dashboard-card__label">1. Patient Selection</span>
            <h3>Choose a patient</h3>
            <p>
              The frontend is ready for a patient roster panel, but the backend
              still needs a patient-list endpoint.
            </p>
          </section>

          <section className="dashboard-card">
            <span className="dashboard-card__label">2. Identity Verification</span>
            <h3>Verify patient ID</h3>
            <p>
              Add a backend verification endpoint so staff can confirm the
              patient ID before any record upload proceeds.
            </p>
          </section>

          <section className="dashboard-card">
            <span className="dashboard-card__label">3. PDF Upload</span>
            <h3>Upload care documents</h3>
            <p>
              The login is connected, but PDF upload still needs secure storage
              and an authenticated upload route on the server.
            </p>
          </section>

          <section className="dashboard-card">
            <span className="dashboard-card__label">4. Audit & Alerts</span>
            <h3>Support compliance</h3>
            <p>
              Audit logging and patient notifications are not in the backend
              yet, so those requirements still need server work.
            </p>
          </section>
        </div>
      </section>
    );
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <span className="login-badge">{clinic?.name || 'Clinic Portal'}</span>
        <h1>{formatRoleLabel(staffUser.role)} dashboard</h1>
        <p>
          Signed in as <strong>{staffUser.firstName || staffUser.email}</strong>.
          Manage your clinic workspace, protect patient records, and move into
          the next workflow from one secure dashboard.
        </p>
      </section>

      <section className="dashboard-shell">
        <div className="dashboard-topbar">
          <div className="dashboard-meta">
            <span className="login-endpoint-label">{clinic?.slug || 'clinic'}</span>
            <span className="login-endpoint-label">{formatRoleLabel(staffUser.role)}</span>
            <span className="login-endpoint-label">Connected to {apiBaseUrl}</span>
          </div>
          <button
            type="button"
            className="login-button login-button--secondary"
            onClick={onLogout}
          >
            Sign Out
          </button>
        </div>

        <div className="dashboard-layout">
          <aside className="dashboard-sidebar">
            <div className="dashboard-sidebar__section">
              <span className="dashboard-section-eyebrow">Navigation</span>
              <div className="dashboard-nav">
                {navigationItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`dashboard-nav__item ${activePage === item.id ? 'is-active' : ''}`}
                    onClick={() => setActivePage(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="dashboard-sidebar__section dashboard-sidebar__note">
              <span className="dashboard-section-eyebrow">Current User</span>
              <strong>
                {[staffUser.firstName, staffUser.lastName].filter(Boolean).join(' ') || staffUser.email}
              </strong>
              <p>{staffUser.email}</p>
            </div>
          </aside>

          <div className="dashboard-main">
            {activePage === 'overview' ? renderOverview() : null}
            {activePage === 'staff' && canManageUsers ? (
              <ClinicStaffPage token={token} staffUser={staffUser} clinic={clinic} />
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

export default ClinicDashboard;
