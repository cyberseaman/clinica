import React, { useEffect, useMemo, useState } from 'react';

import { authApiBaseUrl, employeeApiBaseUrl, patientApiBaseUrl } from './authConfig';
import EmployeesWorkspace from './EmployeesWorkspace';
import PatientWorkspace from './PatientWorkspace';
import { formatRoleLabel, hasPermission, permissions } from './rbac';

function ClinicDashboard({ clinic, staffUser, token, onLogout }) {
  const canManageUsers =
    hasPermission(staffUser, permissions.USERS_READ) ||
    hasPermission(staffUser, permissions.USERS_CREATE);
  const canAccessPatients =
    hasPermission(staffUser, permissions.PATIENTS_READ) ||
    hasPermission(staffUser, permissions.PATIENTS_CREATE) ||
    hasPermission(staffUser, permissions.PATIENTS_UPDATE) ||
    hasPermission(staffUser, permissions.RECORDS_READ) ||
    hasPermission(staffUser, permissions.RECORDS_CREATE);
  const canManageEmployees = staffUser?.role === 'clinic_admin';
  const canAccessEmployees = canManageEmployees || canManageUsers;
  const [activePage, setActivePage] = useState('overview');
  const [activeEmployeeView, setActiveEmployeeView] = useState('clinical');

  const employeeNavigationItems = useMemo(() => {
    const items = [];

    if (canManageEmployees) {
      items.push({ id: 'clinical', label: '+ Clinical Staff' });
      items.push({ id: 'non_clinical', label: '+ Non-Clinical Staff' });
    }

    if (canAccessEmployees) {
      items.push({ id: 'manage', label: '👥 Manage Employees' });
    }

    if (canManageUsers) {
      items.push({ id: 'access_accounts', label: '🔐 Create Access Account' });
    }

    return items;
  }, [canAccessEmployees, canManageEmployees, canManageUsers]);

  useEffect(() => {
    if (!employeeNavigationItems.length) {
      return;
    }

    if (!employeeNavigationItems.some((item) => item.id === activeEmployeeView)) {
      setActiveEmployeeView(employeeNavigationItems[0].id);
    }
  }, [activeEmployeeView, employeeNavigationItems]);

  const navigationItems = useMemo(() => {
    const baseItems = [
      { id: 'overview', label: 'Overview' },
    ];

    if (canAccessPatients) {
      baseItems.push({ id: 'patients', label: 'Patients' });
    }

    if (canAccessEmployees) {
      baseItems.push({ id: 'employees', label: 'Employees' });
    }

    return baseItems;
  }, [canAccessEmployees, canAccessPatients]);

  function renderOverview() {
    return (
      <section className="dashboard-content">
        <div className="dashboard-grid">
          <section className="dashboard-card">
            <span className="dashboard-card__label">1. Patient Selection</span>
            <h3>Patient workspace is live</h3>
            <p>
              Browse the roster, create a patient profile, and open the chart
              for patient-specific updates inside the new patient workspace.
            </p>
          </section>

          <section className="dashboard-card">
            <span className="dashboard-card__label">2. Identity Verification</span>
            <h3>Verify patient ID</h3>
            <p>
              Identity verification is still the next backend milestone once
              patient creation and charting are fully settled.
            </p>
          </section>

          <section className="dashboard-card">
            <span className="dashboard-card__label">3. PDF Upload</span>
            <h3>Upload care documents</h3>
            <p>
              Clinical notes can be created today, but document upload still
              needs secure storage and an authenticated upload route.
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
        <div className="dashboard-nav-bar">
          <div className="dashboard-nav-bar__inner">
            <span className="dashboard-section-eyebrow">Navigation</span>
            <div className="dashboard-nav dashboard-nav--horizontal">
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
            {activePage === 'employees' && employeeNavigationItems.length > 0 ? (
              <div className="dashboard-subnav dashboard-subnav--horizontal">
                {employeeNavigationItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`dashboard-subnav__item ${activeEmployeeView === item.id ? 'is-active' : ''}`}
                    onClick={() => setActiveEmployeeView(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="dashboard-topbar">
          <div className="dashboard-meta">
            <span className="login-endpoint-label">{clinic?.slug || 'clinic'}</span>
            <span className="login-endpoint-label">{formatRoleLabel(staffUser.role)}</span>
            <span className="login-endpoint-label">Auth: {authApiBaseUrl}</span>
            <span className="login-endpoint-label">Employee: {employeeApiBaseUrl}</span>
            <span className="login-endpoint-label">Patient: {patientApiBaseUrl}</span>
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
          <div key={activePage} className="dashboard-main dashboard-main--animated">
            {activePage === 'overview' ? renderOverview() : null}
            {activePage === 'patients' && canAccessPatients ? (
              <PatientWorkspace token={token} staffUser={staffUser} clinic={clinic} />
            ) : null}
            {activePage === 'employees' && canAccessEmployees ? (
              <EmployeesWorkspace
                activeView={activeEmployeeView}
                clinic={clinic}
                staffUser={staffUser}
                token={token}
              />
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

export default ClinicDashboard;
