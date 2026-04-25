import React, { useEffect, useMemo, useState } from 'react';

import { parseApiResponse } from './apiResponse';
import { employeeApiBaseUrl } from './authConfig';
import { formatRoleLabel } from './rbac';

function formatEmployeeType(value) {
  return value === 'non_clinical' ? 'Non-Clinical' : 'Clinical';
}

function mapDetailToEditorState(detail) {
  return {
    basicInfo: {
      email: detail.wizardData.basicInfo.email || '',
      firstName: detail.wizardData.basicInfo.firstName || '',
      lastName: detail.wizardData.basicInfo.lastName || '',
      phone: detail.wizardData.basicInfo.phone || '',
    },
    employmentProfile: {
      department: detail.wizardData.employmentProfile.department || '',
      roleTitle: detail.wizardData.employmentProfile.roleTitle || '',
      startDate: detail.wizardData.employmentProfile.startDate || '',
      status: detail.wizardData.employmentProfile.status || 'pending',
    },
    employeeType: detail.employee.employeeType || 'clinical',
    systemPermissions: (detail.wizardData.systemPermissions || []).map((permission) => permission.code),
  };
}

function ManageEmployeesPage({ clinic, token }) {
  const [employees, setEmployees] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [editorState, setEditorState] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState('loading');
  const [detailStatus, setDetailStatus] = useState('idle');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      setStatus('loading');
      setError('');

      try {
        const [employeesResponse, metadataResponse] = await Promise.all([
          fetch(`${employeeApiBaseUrl}/employees`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${employeeApiBaseUrl}/employees/metadata`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const employeesPayload = await parseApiResponse(employeesResponse, 'Unable to load employees.');
        const metadataPayload = await parseApiResponse(metadataResponse, 'Unable to load employee metadata.');

        if (!employeesResponse.ok) {
          throw new Error(employeesPayload.error || 'Unable to load employees.');
        }

        if (!metadataResponse.ok) {
          throw new Error(metadataPayload.error || 'Unable to load employee metadata.');
        }

        if (!ignore) {
          const nextEmployees = employeesPayload.employees || [];
          setEmployees(nextEmployees);
          setMetadata(metadataPayload);
          setSelectedEmployeeId((current) => current || nextEmployees[0]?.id || null);
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
  }, [token]);

  useEffect(() => {
    let ignore = false;

    async function loadDetail() {
      if (!selectedEmployeeId) {
        setSelectedDetail(null);
        setEditorState(null);
        return;
      }

      setDetailStatus('loading');
      setError('');
      setSuccess('');

      try {
        const response = await fetch(`${employeeApiBaseUrl}/employees/${selectedEmployeeId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = await parseApiResponse(response, 'Unable to load employee details.');

        if (!response.ok) {
          throw new Error(payload.error || 'Unable to load employee details.');
        }

        if (!ignore) {
          setSelectedDetail(payload);
          setEditorState(mapDetailToEditorState(payload));
          setDetailStatus('ready');
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message);
          setDetailStatus('error');
        }
      }
    }

    loadDetail();

    return () => {
      ignore = true;
    };
  }, [selectedEmployeeId, token]);

  const filteredEmployees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return employees;
    }

    return employees.filter((employee) =>
      [
        employee.uid,
        employee.firstName,
        employee.lastName,
        employee.email,
        employee.department,
        employee.roleTitle,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [employees, searchQuery]);

  function updateBasicInfo(field) {
    return (event) => {
      const { value } = event.target;
      setSuccess('');
      setError('');
      setEditorState((current) => ({
        ...current,
        basicInfo: {
          ...current.basicInfo,
          [field]: value,
        },
      }));
    };
  }

  function updateEmployment(field) {
    return (event) => {
      const { value } = event.target;
      setSuccess('');
      setError('');
      setEditorState((current) => ({
        ...current,
        employmentProfile: {
          ...current.employmentProfile,
          [field]: value,
        },
      }));
    };
  }

  function togglePermission(code) {
    setSuccess('');
    setError('');
    setEditorState((current) => {
      const hasPermission = current.systemPermissions.includes(code);

      return {
        ...current,
        systemPermissions: hasPermission
          ? current.systemPermissions.filter((value) => value !== code)
          : [...current.systemPermissions, code],
      };
    });
  }

  async function handleSave() {
    if (!selectedEmployeeId || !editorState || !selectedDetail) {
      return;
    }

    setSaveStatus('submitting');
    setSuccess('');
    setError('');

    try {
      const response = await fetch(`${employeeApiBaseUrl}/employees/${selectedEmployeeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          basicInfo: editorState.basicInfo,
          employmentProfile: editorState.employmentProfile,
          systemPermissions: editorState.systemPermissions,
        }),
      });
      const payload = await parseApiResponse(response, 'Unable to update employee.');

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to update employee.');
      }

      setSelectedDetail(payload);
      setEditorState(mapDetailToEditorState(payload));
      setEmployees((current) =>
        current.map((employee) => (employee.id === payload.employee.id ? payload.employee : employee))
      );
      setSuccess('Employee profile updated successfully.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaveStatus('idle');
    }
  }

  return (
    <section className="dashboard-content">
      <div className="dashboard-section-header">
        <span className="dashboard-section-eyebrow">Employees</span>
        <h2>Manage Employees</h2>
        <p>
          Search and manage the workforce inside {clinic?.name || 'your clinic'}, including
          profiles created from both the Clinical Staff and Non-Clinical Staff wizards.
        </p>
      </div>

      <div className="employee-hub-layout">
        <section className="dashboard-card employee-hub-list">
          <div className="staff-list-header">
            <div>
              <h3>Employee Directory</h3>
              <p className="dashboard-copy">
                Search across clinical and non-clinical records, then open one employee to edit.
              </p>
            </div>
            <span className="login-endpoint-label">{employees.length} total</span>
          </div>

          <label className="login-field">
            <span>Search employees</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, UID, email, or department"
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
                  onClick={() => setSelectedEmployeeId(employee.id)}
                >
                  <div>
                    <strong>
                      {[employee.firstName, employee.lastName].filter(Boolean).join(' ') || employee.email}
                    </strong>
                    <span>{employee.uid}</span>
                    <small>
                      {employee.department || 'Department pending'} • {formatEmployeeType(employee.employeeType)}
                    </small>
                  </div>
                  <div className="employee-hub-result__meta">
                    <span className={`staff-status-pill ${employee.hasAccessAccount ? 'is-active' : 'is-inactive'}`}>
                      {employee.hasAccessAccount ? 'Access account' : 'No access account'}
                    </span>
                    <span className="staff-role-pill">
                      {employee.roleTitle || 'Role title pending'}
                    </span>
                  </div>
                </button>
              ))}

              {filteredEmployees.length === 0 ? (
                <p className="dashboard-copy">No employees matched your search.</p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="dashboard-card employee-hub-editor">
          <div className="staff-list-header">
            <div>
              <h3>Employee Editor</h3>
              <p className="dashboard-copy">
                Update core profile details and manage permission assignments from one place.
              </p>
            </div>
          </div>

          {detailStatus === 'loading' ? <p className="dashboard-copy">Loading employee details...</p> : null}

          {selectedDetail && editorState ? (
            <>
              <div className="employee-hub-summary">
                <span className="login-endpoint-label">{selectedDetail.employee.uid}</span>
                <span className="login-endpoint-label">
                  {formatEmployeeType(selectedDetail.employee.employeeType)}
                </span>
                <span className="login-endpoint-label">
                  {selectedDetail.employee.hasAccessAccount
                    ? `Access: ${formatRoleLabel(selectedDetail.employee.accountRole || 'clinic_staff')}`
                    : 'Access: not granted'}
                </span>
              </div>

              <div className="employee-hub-form-grid">
                <label className="login-field">
                  <span>First name</span>
                  <input
                    type="text"
                    value={editorState.basicInfo.firstName}
                    onChange={updateBasicInfo('firstName')}
                  />
                </label>
                <label className="login-field">
                  <span>Last name</span>
                  <input
                    type="text"
                    value={editorState.basicInfo.lastName}
                    onChange={updateBasicInfo('lastName')}
                  />
                </label>
                <label className="login-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={editorState.basicInfo.email}
                    onChange={updateBasicInfo('email')}
                  />
                </label>
                <label className="login-field">
                  <span>Phone</span>
                  <input
                    type="tel"
                    value={editorState.basicInfo.phone}
                    onChange={updateBasicInfo('phone')}
                  />
                </label>
                <label className="login-field">
                  <span>Department</span>
                  <select
                    className="staff-select"
                    value={editorState.employmentProfile.department}
                    onChange={updateEmployment('department')}
                  >
                    {metadata?.departments?.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="login-field">
                  <span>Status</span>
                  <select
                    className="staff-select"
                    value={editorState.employmentProfile.status}
                    onChange={updateEmployment('status')}
                  >
                    {metadata?.employmentStatuses?.map((statusValue) => (
                      <option key={statusValue} value={statusValue}>
                        {formatRoleLabel(statusValue)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="login-field">
                  <span>Start date</span>
                  <input
                    type="date"
                    value={editorState.employmentProfile.startDate}
                    onChange={updateEmployment('startDate')}
                  />
                </label>
                <label className="login-field">
                  <span>Role title</span>
                  <input
                    type="text"
                    value={editorState.employmentProfile.roleTitle}
                    onChange={updateEmployment('roleTitle')}
                  />
                </label>
              </div>

              <section className="employee-permissions-section">
                <div className="provider-group-card__header">
                  <span className="dashboard-card__label">Permissions</span>
                  <h4>Manage assigned permission codes</h4>
                </div>
                <p className="dashboard-copy">
                  Add or remove permissions here to adjust the employee&apos;s operational access
                  without reopening the original wizard.
                </p>

                <div className="employee-permissions-grid">
                  {(metadata?.permissions || []).map((permission) => (
                    <label key={permission.code} className="provider-scope-checklist__item">
                      <input
                        type="checkbox"
                        checked={editorState.systemPermissions.includes(permission.code)}
                        onChange={() => togglePermission(permission.code)}
                      />
                      <span>
                        <strong>{permission.name}</strong>
                        <code>{permission.code}</code>
                        <small>{permission.description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              {success ? <p className="login-success">{success}</p> : null}
              {error && detailStatus !== 'error' ? <p className="login-error">{error}</p> : null}

              <button
                type="button"
                className="login-button"
                onClick={handleSave}
                disabled={saveStatus === 'submitting'}
              >
                {saveStatus === 'submitting' ? 'Saving Employee...' : 'Save Employee Updates'}
              </button>
            </>
          ) : null}

          {!selectedDetail && detailStatus === 'idle' ? (
            <p className="dashboard-copy">Select an employee to start managing their profile.</p>
          ) : null}
        </section>
      </div>
    </section>
  );
}

export default ManageEmployeesPage;
