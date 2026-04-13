import React, { useEffect, useMemo, useState } from 'react';

import { apiBaseUrl } from './authConfig';
import { hasPermission, permissions } from './rbac';

const emptyPatientForm = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  sex: '',
  email: '',
  phone: '',
  address: '',
  emergencyContact: {
    name: '',
    phone: '',
    relationship: '',
  },
  insuranceInfo: {
    provider: '',
    memberId: '',
    groupNumber: '',
  },
  healthAlerts: {
    allergies: '',
    currentMedications: '',
    chronicConditions: '',
  },
  notes: '',
};

function cloneEmptyPatientForm() {
  return {
    ...emptyPatientForm,
    emergencyContact: { ...emptyPatientForm.emergencyContact },
    insuranceInfo: { ...emptyPatientForm.insuranceInfo },
    healthAlerts: { ...emptyPatientForm.healthAlerts },
  };
}

function buildPatientFormValues(patient) {
  if (!patient) {
    return cloneEmptyPatientForm();
  }

  return {
    firstName: patient.firstName || '',
    lastName: patient.lastName || '',
    dateOfBirth: patient.dateOfBirth || '',
    sex: patient.sex || '',
    email: patient.email || '',
    phone: patient.phone || '',
    address: patient.address || '',
    emergencyContact: {
      name: patient.emergencyContact?.name || '',
      phone: patient.emergencyContact?.phone || '',
      relationship: patient.emergencyContact?.relationship || '',
    },
    insuranceInfo: {
      provider: patient.insuranceInfo?.provider || '',
      memberId: patient.insuranceInfo?.memberId || '',
      groupNumber: patient.insuranceInfo?.groupNumber || '',
    },
    healthAlerts: {
      allergies: patient.healthAlerts?.allergies || '',
      currentMedications: patient.healthAlerts?.currentMedications || '',
      chronicConditions: patient.healthAlerts?.chronicConditions || '',
    },
    notes: patient.notes || '',
  };
}

function sortPatients(patients) {
  return [...patients].sort((left, right) => {
    const leftKey = `${left.lastName} ${left.firstName}`.toLowerCase();
    const rightKey = `${right.lastName} ${right.firstName}`.toLowerCase();
    return leftKey.localeCompare(rightKey);
  });
}

const patientStatusOptions = [
  'checked_in',
  'triaged',
  'provider_in_progress',
  'labs_ordered',
  'pending_results',
  'treatment_complete',
  'discharged',
];

function formatPatientStatus(patientId) {
  const status = patientStatusOptions[(Number(patientId) - 1 + patientStatusOptions.length) % patientStatusOptions.length];
  return status.replaceAll('_', ' ');
}

function getPatientAge(dateOfBirth) {
  if (!dateOfBirth) {
    return '--';
  }

  const birthDate = new Date(dateOfBirth);

  if (Number.isNaN(birthDate.getTime())) {
    return '--';
  }

  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : '--';
}

function ModalShell({ title, children, onClose }) {
  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-card__header">
          <div>
            <span className="dashboard-section-eyebrow">Modal</span>
            <h3>{title}</h3>
          </div>
          <button
            type="button"
            className="login-button login-button--secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="modal-card__content">{children}</div>
      </div>
    </div>
  );
}

function PatientWorkspace({ token, staffUser, clinic }) {
  const canReadPatients = hasPermission(staffUser, permissions.PATIENTS_READ);
  const canCreatePatients = hasPermission(staffUser, permissions.PATIENTS_CREATE);
  const canUpdatePatients = hasPermission(staffUser, permissions.PATIENTS_UPDATE);
  const canDeletePatients = hasPermission(staffUser, permissions.PATIENTS_DELETE);
  const canReadRecords = hasPermission(staffUser, permissions.RECORDS_READ);
  const canCreateRecords = hasPermission(staffUser, permissions.RECORDS_CREATE);

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [rosterStatus, setRosterStatus] = useState('loading');
  const [casesStatus, setCasesStatus] = useState('idle');
  const [patientFormStatus, setPatientFormStatus] = useState('idle');
  const [patientError, setPatientError] = useState('');
  const [casesError, setCasesError] = useState('');
  const [patientFormValues, setPatientFormValues] = useState(cloneEmptyPatientForm());
  const [cases, setCases] = useState([]);
  const [activeModal, setActiveModal] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadPatients() {
      if (!canReadPatients) {
        setRosterStatus('restricted');
        return;
      }

      setRosterStatus('loading');
      setPatientError('');

      try {
        const response = await fetch(`${apiBaseUrl}/patients`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Unable to load patients.');
        }

        if (ignore) {
          return;
        }

        const nextPatients = sortPatients(data.patients || []);
        setPatients(nextPatients);
        setRosterStatus('ready');

        if (!selectedPatientId && nextPatients.length > 0) {
          setSelectedPatientId(nextPatients[0].id);
        }
      } catch (error) {
        if (!ignore) {
          setPatientError(error.message);
          setRosterStatus('error');
        }
      }
    }

    loadPatients();

    return () => {
      ignore = true;
    };
  }, [canReadPatients, selectedPatientId, token]);

  useEffect(() => {
    let ignore = false;

    async function loadSelectedPatient() {
      if (!selectedPatientId || !canReadPatients) {
        setSelectedPatient(null);
        setCases([]);
        setSelectedCaseId(null);
        setCasesStatus('idle');
        return;
      }

      setCasesStatus(canReadRecords ? 'loading' : 'restricted');
      setCasesError('');

      try {
        const patientResponse = await fetch(`${apiBaseUrl}/patients/${selectedPatientId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const patientData = await patientResponse.json();

        if (!patientResponse.ok) {
          throw new Error(patientData.error || 'Unable to load patient details.');
        }

        let nextCases = [];

        if (canReadRecords) {
          const recordsResponse = await fetch(`${apiBaseUrl}/patients/${selectedPatientId}/records`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const recordData = await recordsResponse.json();

          if (!recordsResponse.ok) {
            throw new Error(recordData.error || 'Unable to load patient visits.');
          }

          nextCases = (recordData.records || []).map((record) => ({
            id: record.id,
            number: record.id,
            caseNumber: `CASE-${record.id}`,
            status: record.recordType === 'closed' ? 'Closed' : 'Open',
            queue: 'General Review',
            description: record.summary || 'Untitled visit',
            assignedDepartment: 'Unassigned',
            assignedProvider: 'Unassigned',
          }));
        }

        if (!ignore) {
          setSelectedPatient(patientData.patient || null);
          setCases(nextCases);
          setSelectedCaseId((current) =>
            nextCases.some((caseItem) => caseItem.id === current) ? current : null
          );
          setCasesStatus(canReadRecords ? 'ready' : 'restricted');
        }
      } catch (error) {
        if (!ignore) {
          setCasesError(error.message);
          setCasesStatus(canReadRecords ? 'error' : 'restricted');
        }
      }
    }

    loadSelectedPatient();

    return () => {
      ignore = true;
    };
  }, [canReadPatients, canReadRecords, selectedPatientId, token]);

  const filteredPatients = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return patients;
    }

    return patients.filter((patient) =>
      [
        patient.firstName,
        patient.lastName,
        patient.email,
        patient.phone,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [patients, searchTerm]);

  const selectedCase = cases.find((caseItem) => caseItem.id === selectedCaseId) || null;

  function openCreatePatientModal() {
    setPatientFormValues(cloneEmptyPatientForm());
    setPatientError('');
    setActiveModal('create-patient');
  }

  function openEditPatientModal() {
    if (!selectedPatient) {
      return;
    }

    setPatientFormValues(buildPatientFormValues(selectedPatient));
    setPatientError('');
    setActiveModal('edit-patient');
  }

  function closeModal() {
    setActiveModal(null);
    setPatientError('');
  }

  function updatePatientField(field) {
    return (event) => {
      setPatientFormValues((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };
  }

  function updateNestedPatientField(section, field) {
    return (event) => {
      setPatientFormValues((current) => ({
        ...current,
        [section]: {
          ...current[section],
          [field]: event.target.value,
        },
      }));
    };
  }

  async function handleCreatePatient(event) {
    event.preventDefault();
    setPatientFormStatus('submitting');
    setPatientError('');

    try {
      const response = await fetch(`${apiBaseUrl}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patientFormValues),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to create patient.');
      }

      const nextPatient = data.patient;
      setPatients((current) => sortPatients([nextPatient, ...current]));
      setSelectedPatientId(nextPatient.id);
      setPatientFormStatus('idle');
      setActiveModal(null);
    } catch (error) {
      setPatientError(error.message);
      setPatientFormStatus('idle');
    }
  }

  async function handleUpdatePatient(event) {
    event.preventDefault();

    if (!selectedPatientId) {
      return;
    }

    setPatientFormStatus('submitting');
    setPatientError('');

    try {
      const response = await fetch(`${apiBaseUrl}/patients/${selectedPatientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patientFormValues),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to update patient.');
      }

      const nextPatient = data.patient;

      setSelectedPatient(nextPatient);
      setPatients((current) =>
        sortPatients(current.map((patient) => (
          patient.id === nextPatient.id ? nextPatient : patient
        )))
      );
      setPatientFormStatus('idle');
      setActiveModal(null);
    } catch (error) {
      setPatientError(error.message);
      setPatientFormStatus('idle');
    }
  }

  async function handleDeletePatient() {
    if (!selectedPatientId) {
      return;
    }

    setPatientFormStatus('submitting');
    setPatientError('');

    try {
      const response = await fetch(`${apiBaseUrl}/patients/${selectedPatientId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok && response.status !== 204) {
        const data = await response.json();
        throw new Error(data.error || 'Unable to delete patient.');
      }

      setPatients((current) => current.filter((patient) => patient.id !== selectedPatientId));
      setSelectedPatientId(null);
      setSelectedPatient(null);
      setCases([]);
      setSelectedCaseId(null);
      setPatientFormStatus('idle');
      setActiveModal(null);
    } catch (error) {
      setPatientError(error.message);
      setPatientFormStatus('idle');
    }
  }

  function renderPatientForm(onSubmit, submitLabel) {
    return (
      <form className="login-form" onSubmit={onSubmit}>
        <div className="staff-form-grid">
          <label className="login-field">
            <span>First name</span>
            <input
              type="text"
              value={patientFormValues.firstName}
              onChange={updatePatientField('firstName')}
              placeholder="John"
              required
            />
          </label>

          <label className="login-field">
            <span>Last name</span>
            <input
              type="text"
              value={patientFormValues.lastName}
              onChange={updatePatientField('lastName')}
              placeholder="Doe"
              required
            />
          </label>
        </div>

        <div className="staff-form-grid">
          <label className="login-field">
            <span>Date of birth</span>
            <input
              type="date"
              value={patientFormValues.dateOfBirth}
              onChange={updatePatientField('dateOfBirth')}
            />
          </label>

          <label className="login-field">
            <span>Sex</span>
            <select
              className="staff-select"
              value={patientFormValues.sex}
              onChange={updatePatientField('sex')}
            >
              <option value="">Select one</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </label>
        </div>

        <label className="login-field">
          <span>Email</span>
          <input
            type="email"
            value={patientFormValues.email}
            onChange={updatePatientField('email')}
            placeholder="john.doe@example.com"
          />
        </label>

        <label className="login-field">
          <span>Phone</span>
          <input
            type="text"
            value={patientFormValues.phone}
            onChange={updatePatientField('phone')}
            placeholder="555-111-2222"
          />
        </label>

        <label className="login-field">
          <span>Address</span>
          <textarea
            className="patient-textarea"
            value={patientFormValues.address}
            onChange={updatePatientField('address')}
            placeholder="123 Main St, Springfield, CA 90000"
            rows={3}
          />
        </label>

        <div className="patient-form-section">
          <span className="dashboard-card__label">Emergency Contact</span>
          <div className="staff-form-grid">
            <label className="login-field">
              <span>Name</span>
              <input
                type="text"
                value={patientFormValues.emergencyContact.name}
                onChange={updateNestedPatientField('emergencyContact', 'name')}
                placeholder="Jane Doe"
              />
            </label>

            <label className="login-field">
              <span>Phone</span>
              <input
                type="text"
                value={patientFormValues.emergencyContact.phone}
                onChange={updateNestedPatientField('emergencyContact', 'phone')}
                placeholder="555-777-8888"
              />
            </label>
          </div>

          <label className="login-field">
            <span>Relationship</span>
            <input
              type="text"
              value={patientFormValues.emergencyContact.relationship}
              onChange={updateNestedPatientField('emergencyContact', 'relationship')}
              placeholder="Spouse"
            />
          </label>
        </div>

        <div className="patient-form-section">
          <span className="dashboard-card__label">Insurance Info</span>
          <div className="staff-form-grid">
            <label className="login-field">
              <span>Provider</span>
              <input
                type="text"
                value={patientFormValues.insuranceInfo.provider}
                onChange={updateNestedPatientField('insuranceInfo', 'provider')}
                placeholder="Blue Shield"
              />
            </label>

            <label className="login-field">
              <span>Member ID</span>
              <input
                type="text"
                value={patientFormValues.insuranceInfo.memberId}
                onChange={updateNestedPatientField('insuranceInfo', 'memberId')}
                placeholder="ABC1234567"
              />
            </label>
          </div>

          <label className="login-field">
            <span>Group number</span>
            <input
              type="text"
              value={patientFormValues.insuranceInfo.groupNumber}
              onChange={updateNestedPatientField('insuranceInfo', 'groupNumber')}
              placeholder="GRP-1001"
            />
          </label>
        </div>

        <div className="patient-form-section">
          <span className="dashboard-card__label">Basic Health Alerts</span>
          <label className="login-field">
            <span>Allergies</span>
            <textarea
              className="patient-textarea"
              value={patientFormValues.healthAlerts.allergies}
              onChange={updateNestedPatientField('healthAlerts', 'allergies')}
              placeholder="Penicillin, peanuts"
              rows={3}
            />
          </label>

          <label className="login-field">
            <span>Current medications</span>
            <textarea
              className="patient-textarea"
              value={patientFormValues.healthAlerts.currentMedications}
              onChange={updateNestedPatientField('healthAlerts', 'currentMedications')}
              placeholder="Metformin 500mg twice daily"
              rows={3}
            />
          </label>

          <label className="login-field">
            <span>Chronic conditions</span>
            <textarea
              className="patient-textarea"
              value={patientFormValues.healthAlerts.chronicConditions}
              onChange={updateNestedPatientField('healthAlerts', 'chronicConditions')}
              placeholder="Type 2 diabetes, hypertension"
              rows={3}
            />
          </label>
        </div>

        <label className="login-field">
          <span>Notes</span>
          <textarea
            className="patient-textarea"
            value={patientFormValues.notes}
            onChange={updatePatientField('notes')}
            placeholder="Medical, administrative, or intake notes"
            rows={4}
          />
        </label>

        {patientError ? <p className="login-error">{patientError}</p> : null}

        <button
          type="submit"
          className="login-button"
          disabled={patientFormStatus === 'submitting'}
        >
          {patientFormStatus === 'submitting' ? 'Saving...' : submitLabel}
        </button>
      </form>
    );
  }

  return (
    <section className="dashboard-content">
      <div className="dashboard-section-header">
        <span className="dashboard-section-eyebrow">Patient Workspace</span>
        <h2>Manage patients and visit placeholders</h2>
        <p>
          Use the left panel to search and select patients. The right panel is reserved
          for visit-oriented workflow and is intentionally lightweight for now.
        </p>
      </div>

      <div className="patient-split-layout">
        <section className="dashboard-card patient-left-panel">
          <div className="patient-panel-toolbar">
            <button
              type="button"
              className="login-button"
              onClick={openCreatePatientModal}
              disabled={!canCreatePatients}
            >
              + Patient
            </button>
            <button
              type="button"
              className="login-button login-button--secondary"
              onClick={openEditPatientModal}
              disabled={!selectedPatient || !canUpdatePatients}
            >
              Edit
            </button>
          </div>

          <label className="login-field">
            <span>Search patients</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, email, or phone"
            />
          </label>

          {rosterStatus === 'loading' ? <p className="dashboard-copy">Loading patient roster...</p> : null}
          {rosterStatus === 'restricted' ? (
            <p className="dashboard-copy">Your account does not have permission to view patients.</p>
          ) : null}
          {rosterStatus === 'error' ? <p className="login-error">{patientError}</p> : null}

          {rosterStatus === 'ready' ? (
            <div className="patient-roster-list">
              {filteredPatients.length === 0 ? (
                <p className="dashboard-copy">
                  {searchTerm ? 'No patients match your search.' : 'No patient profiles yet.'}
                </p>
              ) : (
                filteredPatients.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    className={`patient-roster-item ${selectedPatientId === patient.id ? 'is-active' : ''}`}
                    onClick={() => {
                      setSelectedPatientId(patient.id);
                      setSelectedCaseId(null);
                    }}
                  >
                    <div className="patient-roster-item__header">
                      <strong>{[patient.firstName, patient.lastName].filter(Boolean).join(' ')}</strong>
                      <span className="patient-roster-item__meta">AGE: {getPatientAge(patient.dateOfBirth)}</span>
                    </div>
                    <div className="patient-roster-item__footer">
                      <span>STATUS: {formatPatientStatus(patient.id)}</span>
                      <span className="patient-roster-item__meta">ID: {patient.id}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </section>

        <section className="dashboard-card patient-right-panel">
          <div className="patient-panel-header">
            <div>
              <span className="dashboard-card__label">Cases / Visits</span>
              <h3>
                {selectedPatient
                  ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
                  : 'Select a patient'}
              </h3>
              <p className="dashboard-copy">
                {selectedPatient
                  ? 'Visit placeholders are shown in a simple row-based table for future expansion.'
                  : 'Choose a patient from the roster to load related cases or visits.'}
              </p>
            </div>
          </div>

          <div className="case-action-bar">
            <div className="case-action-bar__group">
              {(canCreateRecords || staffUser.role === 'clinic_admin' || staffUser.role === 'clinic_staff') ? (
                <button
                  type="button"
                  className="login-button login-button--secondary"
                  disabled={!selectedPatient}
                  onClick={() => setActiveModal('create-case')}
                >
                  + Case
                </button>
              ) : null}
              <button
                type="button"
                className="login-button login-button--secondary"
                disabled={!selectedCase}
                onClick={() => setActiveModal('view-case')}
              >
                View
              </button>
            </div>
            {canDeletePatients ? (
              <div className="case-action-bar__group case-action-bar__group--danger">
                <button
                  type="button"
                  className="login-button login-button--danger"
                  disabled={!selectedCase}
                  onClick={() => setActiveModal('delete-case')}
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>

          {!selectedPatient ? (
            <p className="dashboard-copy">No patient selected yet.</p>
          ) : null}
          {selectedPatient && casesStatus === 'loading' ? (
            <p className="dashboard-copy">Loading cases and visits...</p>
          ) : null}
          {selectedPatient && casesStatus === 'error' ? <p className="login-error">{casesError}</p> : null}
          {selectedPatient && casesStatus === 'restricted' ? (
            <p className="dashboard-copy">Your account cannot view cases or visits.</p>
          ) : null}

          {selectedPatient && casesStatus === 'ready' ? (
            <div className="case-table-shell">
              <table className="case-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Case ID</th>
                    <th>Status</th>
                    <th>Queue</th>
                    <th>Description</th>
                    <th>Assigned Department</th>
                    <th>Assigned Provider</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="case-table__empty">
                        No cases or visits yet for this patient.
                      </td>
                    </tr>
                  ) : (
                    cases.map((caseItem) => (
                      <tr
                        key={caseItem.id}
                        className={selectedCaseId === caseItem.id ? 'is-selected' : ''}
                        onClick={() => setSelectedCaseId(caseItem.id)}
                      >
                        <td>{caseItem.number}</td>
                        <td>{caseItem.caseNumber}</td>
                        <td>{caseItem.status}</td>
                        <td>{caseItem.queue}</td>
                        <td>{caseItem.description}</td>
                        <td>{caseItem.assignedDepartment}</td>
                        <td>{caseItem.assignedProvider}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>

      {activeModal === 'create-patient' ? (
        <ModalShell title="Create Patient" onClose={closeModal}>
          {renderPatientForm(handleCreatePatient, 'Create Patient')}
        </ModalShell>
      ) : null}

      {activeModal === 'edit-patient' && selectedPatient ? (
        <ModalShell title="Edit Patient" onClose={closeModal}>
          {renderPatientForm(handleUpdatePatient, 'Save Changes')}
        </ModalShell>
      ) : null}

      {activeModal === 'delete-patient' && selectedPatient ? (
        <ModalShell title="Delete Patient" onClose={closeModal}>
          <p className="dashboard-copy">
            Are you sure you want to delete{' '}
            <strong>{[selectedPatient.firstName, selectedPatient.lastName].filter(Boolean).join(' ')}</strong>?
          </p>
          {patientError ? <p className="login-error">{patientError}</p> : null}
          <div className="modal-actions">
            <button
              type="button"
              className="login-button login-button--secondary"
              onClick={closeModal}
            >
              No
            </button>
            <button
              type="button"
              className="login-button"
              onClick={handleDeletePatient}
              disabled={patientFormStatus === 'submitting'}
            >
              {patientFormStatus === 'submitting' ? 'Deleting...' : 'Yes, Delete'}
            </button>
          </div>
        </ModalShell>
      ) : null}

      {activeModal === 'view-case' && selectedCase ? (
        <ModalShell title="View Case" onClose={closeModal}>
          <p className="dashboard-copy">
            Placeholder modal. Case details for <strong>{selectedCase.caseNumber}</strong> will be implemented in a future iteration.
          </p>
        </ModalShell>
      ) : null}

      {activeModal === 'create-case' ? (
        <ModalShell title="Create Case" onClose={closeModal}>
          <p className="dashboard-copy">
            Placeholder modal. Case creation flow will be implemented in a future iteration.
          </p>
        </ModalShell>
      ) : null}

      {activeModal === 'delete-case' && selectedCase ? (
        <ModalShell title="Delete Case" onClose={closeModal}>
          <p className="dashboard-copy">
            Placeholder modal. Case deletion for <strong>{selectedCase.caseNumber}</strong> will be implemented in a future iteration.
          </p>
        </ModalShell>
      ) : null}
    </section>
  );
}

export default PatientWorkspace;
