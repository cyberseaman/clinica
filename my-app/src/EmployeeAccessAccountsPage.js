import React, { useEffect, useMemo, useState } from 'react';

import { parseApiResponse } from './apiResponse';
import { authApiBaseUrl, employeeApiBaseUrl } from './authConfig';
import { formatRoleLabel, getAssignableRoles, roleLabels } from './rbac';

function EmployeeAccessAccountsPage({ clinic, staffUser, token }) {
  const [employees, setEmployees] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState('loading');
  const [formStatus, setFormStatus] = useState('idle');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formValues, setFormValues] = useState({
    email: '',
    password: '',
    role: 'clinic_staff',
  });

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      setStatus('loading');
      setError('');

      try {
        const [employeesResponse, rolesResponse] = await Promise.all([
          fetch(`${employeeApiBaseUrl}/employees`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${authApiBaseUrl}/auth/roles`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const employeesPayload = await parseApiResponse(employeesResponse, 'Unable to load employees.');
        const rolesPayload = await parseApiResponse(rolesResponse, 'Unable to load access roles.');

        if (!employeesResponse.ok) {
          throw new Error(employeesPayload.error || 'Unable to load employees.');
        }

        if (!rolesResponse.ok) {
          throw new Error(rolesPayload.error || 'Unable to load access roles.');
        }

        if (!ignore) {
          const allEmployees = employeesPayload.employees || [];
          const assignableRoles = getAssignableRoles(staffUser);
          const filteredRoles = (rolesPayload.roles || []).filter((role) => assignableRoles.includes(role.name));

          setEmployees(allEmployees);
          setAvailableRoles(filteredRoles);
          setSelectedEmployeeId((current) => current || allEmployees.find((employee) => !employee.hasAccessAccount)?.id || null);
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

    loadData();

    return () => {
      ignore = true;
    };
  }, [staffUser, token]);

  const employeesWithoutAccess = useMemo(
    () => employees.filter((employee) => !employee.hasAccessAccount),
    [employees]
  );

  const selectedEmployee = useMemo(
    () => employeesWithoutAccess.find((employee) => employee.id === selectedEmployeeId) || null,
    [employeesWithoutAccess, selectedEmployeeId]
  );

  const filteredEmployees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return employeesWithoutAccess;
    }

    return employeesWithoutAccess.filter((employee) =>
      [
        employee.uid,
        employee.firstName,
        employee.lastName,
        employee.email,
        employee.department,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [employeesWithoutAccess, searchQuery]);

  useEffect(() => {
    if (!selectedEmployee) {
      return;
    }

    setFormValues((current) => ({
      ...current,
      email: selectedEmployee.email || '',
    }));
  }, [selectedEmployee]);

  function handleEmployeeSelect(employeeId) {
    setSelectedEmployeeId(employeeId);
    setSuccess('');
    setError('');
    setFormValues((current) => ({
      ...current,
      password: '',
    }));
  }

  function updateField(field) {
    return (event) => {
      setSuccess('');
      setError('');
      setFormValues((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedEmployee) {
      setError('Select an employee record before creating an access account.');
      return;
    }

    setFormStatus('submitting');
    setSuccess('');
    setError('');

    try {
      const response = await fetch(`${employeeApiBaseUrl}/employees/${selectedEmployee.id}/access-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formValues),
      });
      const payload = await parseApiResponse(response, 'Unable to create access account.');

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to create access account.');
      }

      setEmployees((current) =>
        current.map((employee) => (employee.id === payload.employee.id ? payload.employee : employee))
      );
      setSuccess(`Access account created for ${selectedEmployee.firstName || selectedEmployee.email}.`);
      setFormValues((current) => ({
        ...current,
        email: '',
        password: '',
        role: availableRoles[0]?.name || current.role,
      }));
      setSelectedEmployeeId(employeesWithoutAccess.find((employee) => employee.id !== selectedEmployee.id)?.id || null);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setFormStatus('idle');
    }
  }

  return (
    <section className="dashboard-content">
      <div className="dashboard-section-header">
        <span className="dashboard-section-eyebrow">Employees</span>
        <h2>Create Access Account</h2>
        <p>
          Grant system login access only after an employee record already exists in {clinic?.name || 'your clinic'}.
          This keeps workforce records separate from application accounts.
        </p>
      </div>

      <div className="employee-hub-layout">
        <section className="dashboard-card employee-hub-list">
          <div className="staff-list-header">
            <div>
              <h3>Employees Without Access</h3>
              <p className="dashboard-copy">
                Choose an employee record, then create the login account only when access should be granted.
              </p>
            </div>
            <span className="login-endpoint-label">{employeesWithoutAccess.length} pending</span>
          </div>

          <label className="login-field">
            <span>Search employee records</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, UID, or email"
            />
          </label>

          {status === 'loading' ? <p className="dashboard-copy">Loading employees...</p> : null}
          {error && status === 'error' ? <p className="login-error">{error}</p> : null}

          {status === 'ready' ? (
            <div className="employee-hub-results">
              {filteredEmployees.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  className={`employee-hub-result ${selectedEmployeeId === employee.id ? 'is-active' : ''}`}
                  onClick={() => handleEmployeeSelect(employee.id)}
                >
                  <div>
                    <strong>
                      {[employee.firstName, employee.lastName].filter(Boolean).join(' ') || employee.email}
                    </strong>
                    <span>{employee.uid}</span>
                    <small>{employee.department || 'Department pending'}</small>
                  </div>
                </button>
              ))}

              {filteredEmployees.length === 0 ? (
                <p className="dashboard-copy">No employee records are waiting for access accounts.</p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="dashboard-card employee-hub-editor">
          <div className="staff-list-header">
            <div>
              <h3>Access Account Setup</h3>
              <p className="dashboard-copy">
                Create login credentials for the selected employee without changing the employee record itself.
              </p>
            </div>
          </div>

          {selectedEmployee ? (
            <form className="login-form" onSubmit={handleSubmit}>
              <div className="employee-hub-summary">
                <span className="login-endpoint-label">{selectedEmployee.uid}</span>
                <span className="login-endpoint-label">{selectedEmployee.department || 'Department pending'}</span>
                <span className="login-endpoint-label">
                  {[selectedEmployee.firstName, selectedEmployee.lastName].filter(Boolean).join(' ') || selectedEmployee.email}
                </span>
              </div>

              <label className="login-field">
                <span>Login email</span>
                <input
                  type="email"
                  value={formValues.email}
                  onChange={updateField('email')}
                  required
                />
              </label>

              <label className="login-field">
                <span>Password</span>
                <input
                  type="password"
                  value={formValues.password}
                  onChange={updateField('password')}
                  placeholder="Create the initial password"
                  required
                />
              </label>

              <label className="login-field">
                <span>Access role</span>
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
                  {availableRoles.find((role) => role.name === formValues.role)?.description
                    || 'This role applies a predefined application access scope.'}
                </p>
              ) : null}

              {success ? <p className="login-success">{success}</p> : null}
              {error && status !== 'error' ? <p className="login-error">{error}</p> : null}

              <button
                type="submit"
                className="login-button"
                disabled={formStatus === 'submitting'}
              >
                {formStatus === 'submitting' ? 'Creating Access Account...' : 'Create Access Account'}
              </button>
            </form>
          ) : (
            <p className="dashboard-copy">
              Select an employee without access to create a new application login.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

export default EmployeeAccessAccountsPage;
