import React, { useMemo, useState } from 'react';

import { parseApiResponse } from './apiResponse';
import { employeeApiBaseUrl } from './authConfig';

const staffWizardSteps = [
  { id: 'basic_info', label: 'Basic Info' },
  { id: 'role', label: 'Role' },
  { id: 'department', label: 'Department' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'operations', label: 'Operations' },
  { id: 'review', label: 'Review' },
];

const staffDepartmentDefinitions = [
  {
    name: 'Front Desk',
    description: 'Reception, patient arrival, basic intake support, and visitor coordination.',
    roles: ['Front Desk Coordinator', 'Receptionist', 'Patient Access Associate'],
    serviceLines: ['Reception', 'Patient arrival', 'Wayfinding'],
  },
  {
    name: 'Scheduling',
    description: 'Appointment booking, calendar adjustments, provider coverage coordination, and reminders.',
    roles: ['Scheduler', 'Referral Scheduling Specialist', 'Template Coordinator'],
    serviceLines: ['Appointment scheduling', 'Referral coordination', 'Reminder calls'],
  },
  {
    name: 'Billing',
    description: 'Billing intake, coding support, claims follow-up, payment handling, and reconciliation.',
    roles: ['Billing Specialist', 'Revenue Cycle Associate', 'Payment Posting Clerk'],
    serviceLines: ['Claims review', 'Payment intake', 'Billing follow-up'],
  },
  {
    name: 'Medical Records',
    description: 'Chart requests, release-of-information processing, scanning, indexing, and document control.',
    roles: ['Medical Records Specialist', 'Release Of Information Clerk', 'Document Control Coordinator'],
    serviceLines: ['Records requests', 'Chart indexing', 'Document scanning'],
  },
  {
    name: 'Human Resources',
    description: 'Onboarding, staffing support, employee records, compliance tracking, and workforce coordination.',
    roles: ['HR Coordinator', 'Recruiting Assistant', 'Workforce Operations Specialist'],
    serviceLines: ['Onboarding', 'Employee records', 'Staffing support'],
  },
  {
    name: 'Finance',
    description: 'Budgets, payroll coordination, financial reporting support, and expense controls.',
    roles: ['Finance Analyst', 'Payroll Coordinator', 'Accounts Specialist'],
    serviceLines: ['Payroll support', 'Expense review', 'Financial reporting'],
  },
  {
    name: 'IT Support',
    description: 'Help desk operations, account support, workstation setup, and system troubleshooting.',
    roles: ['IT Support Technician', 'Help Desk Specialist', 'Systems Support Analyst'],
    serviceLines: ['Help desk', 'Device setup', 'System troubleshooting'],
  },
  {
    name: 'Maintenance',
    description: 'Facility upkeep, equipment requests, environmental repairs, and work-order management.',
    roles: ['Maintenance Technician', 'Facilities Coordinator', 'Work Order Dispatcher'],
    serviceLines: ['Repairs', 'Facility rounds', 'Equipment requests'],
  },
  {
    name: 'Housekeeping',
    description: 'Environmental services, cleaning coverage, room turnover support, and sanitation tracking.',
    roles: ['Environmental Services Associate', 'Housekeeping Lead', 'Sanitation Coordinator'],
    serviceLines: ['Cleaning coverage', 'Room turnover', 'Sanitation checks'],
  },
  {
    name: 'Security',
    description: 'Access control, incident logging, visitor safety, and after-hours coverage.',
    roles: ['Security Officer', 'Security Dispatcher', 'Access Control Specialist'],
    serviceLines: ['Access control', 'Incident response', 'Visitor safety'],
  },
  {
    name: 'Supply Chain',
    description: 'Inventory replenishment, vendor receiving, stock movement, and supply-room coordination.',
    roles: ['Supply Coordinator', 'Inventory Associate', 'Materials Management Clerk'],
    serviceLines: ['Stock replenishment', 'Receiving', 'Inventory counts'],
  },
  {
    name: 'Pharmacy Support',
    description: 'Medication delivery support, stock handling, refill coordination, and order routing.',
    roles: ['Pharmacy Support Clerk', 'Medication Runner', 'Inventory Support Technician'],
    serviceLines: ['Medication routing', 'Refill follow-up', 'Pharmacy stock support'],
  },
  {
    name: 'Customer Service',
    description: 'Call center support, service recovery, complaint intake, and patient communications.',
    roles: ['Customer Service Representative', 'Patient Relations Coordinator', 'Call Center Associate'],
    serviceLines: ['Call handling', 'Escalations', 'Service recovery'],
  },
  {
    name: 'Administration',
    description: 'Executive support, secretarial tasks, office coordination, compliance paperwork, and general operations.',
    roles: ['Administrative Assistant', 'Office Secretary', 'Operations Coordinator'],
    serviceLines: ['Executive support', 'Office coordination', 'Internal reporting'],
  },
];

const staffPermissionGroups = [
  {
    id: 'access_service',
    title: 'Access And Service Desk',
    description: 'Front-line permissions for reception, arrivals, messaging, and customer service.',
    permissions: [
      {
        code: 'patient.checkin.manage',
        name: 'Manage patient check-in',
        description: 'Handle arrivals, registration status, and front-desk intake transitions.',
      },
      {
        code: 'staff.queue.view',
        name: 'View staff queues',
        description: 'Monitor operational queues for handoffs, coverage, and support tasks.',
      },
      {
        code: 'reception.desk.manage',
        name: 'Manage reception desk',
        description: 'Coordinate reception coverage, lobby flow, and visitor assistance.',
      },
      {
        code: 'visitors.checkin.manage',
        name: 'Manage visitor check-in',
        description: 'Track guests, badge issuance, and visitor access checkpoints.',
      },
      {
        code: 'customer.service.cases.manage',
        name: 'Manage service cases',
        description: 'Open, triage, and resolve service requests or complaints.',
      },
    ],
  },
  {
    id: 'records_scheduling',
    title: 'Scheduling And Records',
    description: 'Permissions for calendars, records requests, and operational document flow.',
    permissions: [
      {
        code: 'schedule.manage',
        name: 'Manage scheduling',
        description: 'Adjust schedules, templates, and appointment-related workflow rules.',
      },
      {
        code: 'medical.records.view',
        name: 'View medical records work queue',
        description: 'Access release, indexing, and chart-request workflow queues.',
      },
      {
        code: 'medical.records.edit',
        name: 'Update records workflow',
        description: 'Process document requests, indexing, and release-of-information tasks.',
      },
      {
        code: 'documents.scan.upload',
        name: 'Scan and upload documents',
        description: 'Add scanned paperwork and support files into document workflows.',
      },
      {
        code: 'referrals.coordinate',
        name: 'Coordinate referrals',
        description: 'Manage non-clinical referral routing and appointment follow-up tasks.',
      },
    ],
  },
  {
    id: 'billing_admin',
    title: 'Billing, Finance, And Admin',
    description: 'Permissions for billing operations, HR support, and administrative workflows.',
    permissions: [
      {
        code: 'billing.codes.view',
        name: 'View billing codes',
        description: 'Access charge, code, and fee-reference libraries.',
      },
      {
        code: 'billing.invoice.edit',
        name: 'Edit billing invoices',
        description: 'Update billing details, payment notes, and claim preparation tasks.',
      },
      {
        code: 'finance.reports.view',
        name: 'View finance reports',
        description: 'Open budget, reporting, and reconciliation dashboards.',
      },
      {
        code: 'payroll.manage',
        name: 'Manage payroll support',
        description: 'Coordinate payroll inputs, audits, and workforce pay processing tasks.',
      },
      {
        code: 'hr.employee.records.view',
        name: 'View employee records',
        description: 'Access personnel record workflows and onboarding documentation.',
      },
      {
        code: 'hr.employee.records.edit',
        name: 'Update employee records',
        description: 'Maintain HR files, onboarding steps, and internal staffing records.',
      },
      {
        code: 'employee.create',
        name: 'Create employees',
        description: 'Create new employee accounts and start onboarding profiles.',
      },
      {
        code: 'employee.edit',
        name: 'Edit employees',
        description: 'Update employee account details, profiles, and operational assignments.',
      },
    ],
  },
  {
    id: 'it_facilities',
    title: 'IT, Facilities, And Support Services',
    description: 'Permissions for infrastructure support, security, inventory, and physical operations.',
    permissions: [
      {
        code: 'it.support.tickets.manage',
        name: 'Manage IT tickets',
        description: 'Handle support requests, triage incidents, and assign technical work.',
      },
      {
        code: 'it.assets.manage',
        name: 'Manage IT assets',
        description: 'Track workstations, peripherals, software setup, and replacement requests.',
      },
      {
        code: 'inventory.edit',
        name: 'Edit inventory',
        description: 'Update supply, stock, and inventory control records.',
      },
      {
        code: 'supply.orders.manage',
        name: 'Manage supply orders',
        description: 'Submit, receive, and reconcile operational supply requests.',
      },
      {
        code: 'facilities.workorders.manage',
        name: 'Manage facilities work orders',
        description: 'Dispatch repairs, maintenance requests, and environmental service jobs.',
      },
      {
        code: 'security.incident.manage',
        name: 'Manage security incidents',
        description: 'Log incidents, access events, and security response activity.',
      },
      {
        code: 'housekeeping.assign',
        name: 'Assign housekeeping coverage',
        description: 'Coordinate cleaning assignments, room turnover, and sanitation work.',
      },
      {
        code: 'pharmacy.support.inventory',
        name: 'Support pharmacy inventory',
        description: 'Assist with pharmacy stock flow, routing, and replenishment tasks.',
      },
    ],
  },
];

const employmentTypeOptions = ['Full Time', 'Part Time', 'Contract', 'Per Diem'];
const staffStatusOptions = ['active', 'inactive', 'pending'];
const shiftTypeOptions = ['Day', 'Evening', 'Night', 'Weekend', 'Rotating'];
const serviceLineOptions = [
  'Reception',
  'Patient arrival',
  'Wayfinding',
  'Appointment scheduling',
  'Referral coordination',
  'Reminder calls',
  'Claims review',
  'Payment intake',
  'Billing follow-up',
  'Records requests',
  'Chart indexing',
  'Document scanning',
  'Onboarding',
  'Employee records',
  'Payroll support',
  'Help desk',
  'Device setup',
  'Repairs',
  'Facility rounds',
  'Cleaning coverage',
  'Access control',
  'Inventory counts',
  'Medication routing',
  'Call handling',
  'Office coordination',
];
const systemOptions = [
  'Phone Console',
  'Patient Messaging',
  'Scheduling Board',
  'Billing Work Queue',
  'Records Request Queue',
  'Document Scanner',
  'HRIS',
  'Payroll Dashboard',
  'Help Desk Portal',
  'Asset Tracker',
  'Security Desk',
  'Facilities Work Order Board',
  'Inventory Dashboard',
  'Visitor Management',
];
const communicationChannelOptions = [
  'Front desk phone',
  'Secure internal chat',
  'Email',
  'Ticket queue',
  'Radio',
  'Customer service line',
  'Visitor desk',
  'Shared operations inbox',
];

const initialFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  startDate: '',
  status: 'pending',
  department: staffDepartmentDefinitions[0].name,
  staffRole: staffDepartmentDefinitions[0].roles[0],
  employmentType: 'Full Time',
  shiftType: 'Day',
  workLocation: 'Main lobby',
  supervisor: 'Operations Manager',
  serviceLines: [...staffDepartmentDefinitions[0].serviceLines],
  systems: ['Phone Console', 'Patient Messaging'],
  communicationChannels: ['Front desk phone', 'Secure internal chat'],
  accessPermissions: ['patient.checkin.manage', 'staff.queue.view'],
  notes: '',
};

const permissionCatalog = staffPermissionGroups.flatMap((group) =>
  group.permissions.map((permission) => ({
    ...permission,
    groupTitle: group.title,
  }))
);

function getPermissionDefinition(code) {
  return (
    permissionCatalog.find((permission) => permission.code === code) || {
      code,
      description: 'Custom operational permission.',
      groupTitle: 'Custom',
      name: code,
    }
  );
}

function EmployeeStaffPage({ clinic, token }) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [formValues, setFormValues] = useState(initialFormValues);
  const [formStatus, setFormStatus] = useState('idle');
  const [submissionError, setSubmissionError] = useState('');
  const [submissionMessage, setSubmissionMessage] = useState('');

  const activeStep = staffWizardSteps[activeStepIndex];
  const completionRatio = ((activeStepIndex + 1) / staffWizardSteps.length) * 100;
  const selectedDepartment = useMemo(
    () =>
      staffDepartmentDefinitions.find((department) => department.name === formValues.department)
      || staffDepartmentDefinitions[0],
    [formValues.department]
  );
  const selectedPermissionDetails = useMemo(
    () => formValues.accessPermissions.map((code) => getPermissionDefinition(code)),
    [formValues.accessPermissions]
  );
  const staffDisplayName =
    [formValues.firstName, formValues.lastName].filter(Boolean).join(' ') || 'New Staff Member';

  const reviewItems = useMemo(
    () => [
      {
        label: 'Staff Profile',
        value:
          [formValues.firstName, formValues.lastName].filter(Boolean).join(' ') || 'Not provided yet',
      },
      {
        label: 'Contact',
        value:
          [
            formValues.email,
            formValues.phone,
          ]
            .filter(Boolean)
            .join(' • ') || 'Not provided yet',
      },
      {
        label: 'Department And Role',
        value:
          [
            formValues.department,
            formValues.staffRole,
            formValues.employmentType,
            formValues.startDate && `Starts ${formValues.startDate}`,
            formValues.status && `Status: ${formValues.status}`,
          ]
            .filter(Boolean)
            .join(' • ') || 'Not provided yet',
      },
      {
        label: 'Operations Coverage',
        value: formValues.serviceLines.join(', ') || 'None selected',
      },
      {
        label: 'Systems',
        value: formValues.systems.join(', ') || 'None selected',
      },
      {
        label: 'Communication',
        value: formValues.communicationChannels.join(', ') || 'None selected',
      },
      {
        label: 'Permissions',
        value:
          selectedPermissionDetails
            .map((permission) => `${permission.name} (${permission.code})`)
            .join(', ') || 'None selected',
      },
      {
        label: 'Work Pattern',
        value:
          [
            formValues.shiftType,
            formValues.workLocation,
            formValues.supervisor && `Supervisor: ${formValues.supervisor}`,
          ]
            .filter(Boolean)
            .join(' • ') || 'Not provided yet',
      },
    ],
    [formValues, selectedPermissionDetails]
  );

  function updateField(field) {
    return (event) => {
      setSubmissionMessage('');
      setSubmissionError('');
      setFormValues((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };
  }

  function toggleListValue(field, value) {
    setSubmissionMessage('');
    setSubmissionError('');
    setFormValues((current) => {
      const values = current[field];
      const hasValue = values.includes(value);

      return {
        ...current,
        [field]: hasValue ? values.filter((item) => item !== value) : [...values, value],
      };
    });
  }

  function handleDepartmentChange(event) {
    const nextDepartmentName = event.target.value;
    const nextDepartment =
      staffDepartmentDefinitions.find((department) => department.name === nextDepartmentName)
      || staffDepartmentDefinitions[0];

    setSubmissionMessage('');
    setSubmissionError('');
    setFormValues((current) => ({
      ...current,
      department: nextDepartment.name,
      serviceLines:
        current.department === nextDepartment.name
          ? current.serviceLines
          : [...nextDepartment.serviceLines],
      staffRole: nextDepartment.roles.includes(current.staffRole)
        ? current.staffRole
        : nextDepartment.roles[0],
    }));
  }

  function goToStep(stepIndex) {
    setActiveStepIndex(stepIndex);
    setSubmissionMessage('');
    setSubmissionError('');
  }

  function handleNext() {
    setActiveStepIndex((current) => Math.min(current + 1, staffWizardSteps.length - 1));
    setSubmissionMessage('');
    setSubmissionError('');
  }

  function handleBack() {
    setActiveStepIndex((current) => Math.max(current - 1, 0));
    setSubmissionMessage('');
    setSubmissionError('');
  }

  async function handleCreateStaffProfile() {
    setFormStatus('submitting');
    setSubmissionMessage('');
    setSubmissionError('');

    const payload = {
      basicInfo: {
        accountRole: 'clinic_staff',
        email: formValues.email,
        employeeType: 'non_clinical',
        firstName: formValues.firstName,
        lastName: formValues.lastName,
        phone: formValues.phone,
      },
      employmentProfile: {
        department: formValues.department,
        employmentType: formValues.employmentType,
        primaryRole: 'Administrative lead',
        providerType: 'Other',
        roleTitle: formValues.staffRole,
        staffRole: formValues.staffRole,
        startDate: formValues.startDate,
        status: formValues.status,
      },
      operationalProfile: {
        communicationChannels: formValues.communicationChannels,
        notes: formValues.notes,
        serviceLines: formValues.serviceLines,
        shiftType: formValues.shiftType,
        systems: formValues.systems,
        supervisor: formValues.supervisor,
        workLocation: formValues.workLocation,
      },
      systemPermissions: formValues.accessPermissions,
    };

    try {
      const response = await fetch(`${employeeApiBaseUrl}/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await parseApiResponse(
        response,
        'Unable to create non-clinical staff profile.'
      );

      if (!response.ok) {
        throw new Error(data.error || 'Unable to create non-clinical staff profile.');
      }

      const uid = data.employee?.uid ? ` UID: ${data.employee.uid}.` : '';
      const temporaryPassword = data.temporaryPassword
        ? ` Temporary password: ${data.temporaryPassword}`
        : '';

      setSubmissionMessage(`Non-clinical staff profile created successfully.${uid}${temporaryPassword}`);
      setFormValues(initialFormValues);
      setActiveStepIndex(0);
    } catch (error) {
      setSubmissionError(error.message);
    } finally {
      setFormStatus('idle');
    }
  }

  function renderStepBody() {
    switch (activeStep.id) {
      case 'basic_info':
        return (
          <div className="provider-credentials-layout">
            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Identity</span>
                <h4>Set up the core staff profile</h4>
              </div>
              <p className="dashboard-copy">
                Use this wizard for non-patient-care departments such as billing, scheduling, front
                desk, HR, IT support, facilities, and other operational teams.
              </p>

              <div className="provider-form-grid provider-form-grid--two-column">
                <label className="login-field">
                  <span>First name</span>
                  <input
                    type="text"
                    value={formValues.firstName}
                    onChange={updateField('firstName')}
                    placeholder="Jordan"
                  />
                </label>
                <label className="login-field">
                  <span>Last name</span>
                  <input
                    type="text"
                    value={formValues.lastName}
                    onChange={updateField('lastName')}
                    placeholder="Lee"
                  />
                </label>
                <label className="login-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={formValues.email}
                    onChange={updateField('email')}
                    placeholder="jordan.lee@clinic.org"
                  />
                </label>
                <label className="login-field">
                  <span>Phone</span>
                  <input
                    type="tel"
                    value={formValues.phone}
                    onChange={updateField('phone')}
                    placeholder="(555) 555-0180"
                  />
                </label>
              </div>
            </section>
          </div>
        );
      case 'role':
        return (
          <div className="provider-credentials-layout">
            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Assignment</span>
                <h4>Define the staff member&apos;s department and role</h4>
              </div>

              <div className="provider-form-grid provider-form-grid--two-column">
                <label className="login-field">
                  <span>Start date</span>
                  <input
                    type="date"
                    value={formValues.startDate}
                    onChange={updateField('startDate')}
                  />
                </label>
                <label className="login-field">
                  <span>Status</span>
                  <select
                    className="staff-select"
                    value={formValues.status}
                    onChange={updateField('status')}
                  >
                    {staffStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="login-field">
                  <span>Department</span>
                  <select
                    className="staff-select"
                    value={formValues.department}
                    onChange={handleDepartmentChange}
                  >
                    {staffDepartmentDefinitions.map((department) => (
                      <option key={department.name} value={department.name}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="login-field">
                  <span>Role title</span>
                  <select
                    className="staff-select"
                    value={formValues.staffRole}
                    onChange={updateField('staffRole')}
                  >
                    {selectedDepartment.roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="login-field">
                  <span>Employment type</span>
                  <select
                    className="staff-select"
                    value={formValues.employmentType}
                    onChange={updateField('employmentType')}
                  >
                    {employmentTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="login-field">
                  <span>Primary shift</span>
                  <select
                    className="staff-select"
                    value={formValues.shiftType}
                    onChange={updateField('shiftType')}
                  >
                    {shiftTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Department Snapshot</span>
                <h4>{selectedDepartment.name}</h4>
              </div>
              <p className="dashboard-copy">{selectedDepartment.description}</p>
              <div className="provider-chip-grid">
                {selectedDepartment.roles.map((role) => (
                  <span key={role} className="login-endpoint-label">
                    {role}
                  </span>
                ))}
              </div>
            </section>
          </div>
        );
      case 'department':
        return (
          <div className="provider-credentials-layout">
            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Coverage</span>
                <h4>Choose the operational areas this staff member supports</h4>
              </div>
              <p className="dashboard-copy">
                These selections shape where the employee appears inside non-clinical workflows and
                which operational queues they are expected to cover.
              </p>

              <div className="provider-chip-grid">
                {serviceLineOptions.map((serviceLine) => (
                  <button
                    key={serviceLine}
                    type="button"
                    className={`provider-chip ${formValues.serviceLines.includes(serviceLine) ? 'is-selected' : ''}`}
                    onClick={() => toggleListValue('serviceLines', serviceLine)}
                  >
                    {serviceLine}
                  </button>
                ))}
              </div>
            </section>

            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Workspace</span>
                <h4>Set day-to-day operational context</h4>
              </div>

              <div className="provider-form-grid provider-form-grid--two-column">
                <label className="login-field">
                  <span>Work location</span>
                  <input
                    type="text"
                    value={formValues.workLocation}
                    onChange={updateField('workLocation')}
                    placeholder="Main lobby"
                  />
                </label>
                <label className="login-field">
                  <span>Supervisor</span>
                  <input
                    type="text"
                    value={formValues.supervisor}
                    onChange={updateField('supervisor')}
                    placeholder="Operations Manager"
                  />
                </label>
              </div>
            </section>
          </div>
        );
      case 'permissions':
        return (
          <div className="provider-credentials-layout">
            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Operational Access</span>
                <h4>Assign permissions for non-clinical work</h4>
              </div>
              <p className="dashboard-copy">
                These permissions are intended for billing, reception, records, HR, IT, finance,
                maintenance, security, supply chain, and similar hospital support teams.
              </p>

              {staffPermissionGroups.map((group) => (
                <section key={group.id} className="patient-form-section">
                  <div>
                    <span className="dashboard-card__label">{group.title}</span>
                    <p className="dashboard-copy">{group.description}</p>
                  </div>

                  <div className="provider-responsibility-grid">
                    {group.permissions.map((permission) => (
                      <label key={permission.code} className="provider-scope-checklist__item">
                        <input
                          type="checkbox"
                          checked={formValues.accessPermissions.includes(permission.code)}
                          onChange={() => toggleListValue('accessPermissions', permission.code)}
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
              ))}
            </section>

            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Current Operational Access</span>
                <h4>Selected permissions</h4>
              </div>
              <p className="dashboard-copy">
                Click any assigned permission to remove it from this staff member&apos;s current
                access profile.
              </p>
              {selectedPermissionDetails.length > 0 ? (
                <div className="provider-chip-grid">
                  {selectedPermissionDetails.map((permission) => (
                    <button
                      key={permission.code}
                      type="button"
                      className="provider-chip provider-chip--stacked is-selected"
                      onClick={() => toggleListValue('accessPermissions', permission.code)}
                    >
                      <span>{permission.name}</span>
                      <code>{permission.code}</code>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="dashboard-copy">
                  No operational permissions selected yet. This staff member will not be routed into
                  non-clinical workflows until at least one permission is assigned.
                </p>
              )}
            </section>
          </div>
        );
      case 'operations':
        return (
          <div className="provider-credentials-layout">
            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Systems</span>
                <h4>Select the systems this staff member works from</h4>
              </div>
              <div className="provider-chip-grid">
                {systemOptions.map((system) => (
                  <button
                    key={system}
                    type="button"
                    className={`provider-chip ${formValues.systems.includes(system) ? 'is-selected' : ''}`}
                    onClick={() => toggleListValue('systems', system)}
                  >
                    {system}
                  </button>
                ))}
              </div>
            </section>

            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Communication</span>
                <h4>Choose the channels used in daily operations</h4>
              </div>
              <div className="provider-chip-grid">
                {communicationChannelOptions.map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    className={`provider-chip ${formValues.communicationChannels.includes(channel) ? 'is-selected' : ''}`}
                    onClick={() => toggleListValue('communicationChannels', channel)}
                  >
                    {channel}
                  </button>
                ))}
              </div>
            </section>

            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Operational Notes</span>
                <h4>Capture context for supervisors and future routing logic</h4>
              </div>
              <label className="login-field">
                <span>Notes</span>
                <textarea
                  className="patient-textarea"
                  value={formValues.notes}
                  onChange={updateField('notes')}
                  placeholder="Covers afternoon scheduling queue, escalates billing disputes, supports the visitor desk on Fridays."
                />
              </label>
            </section>
          </div>
        );
      case 'review':
        return (
          <div className="provider-review-stage">
            <article className="provider-review-hero">
              <span className="dashboard-card__label">Review And Confirm</span>
              <h4>{staffDisplayName}</h4>
              <div className="provider-review-hero__meta">
                <span>Department: {formValues.department || 'Not provided yet'}</span>
                <span>Role: {formValues.staffRole || 'Not provided yet'}</span>
              </div>

              <div className="provider-review-hero__section">
                <strong>Coverage</strong>
                {formValues.serviceLines.length > 0 ? (
                  <ul className="provider-review-bullets">
                    {formValues.serviceLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="dashboard-copy">No coverage areas selected.</p>
                )}
              </div>

              <div className="provider-review-hero__section">
                <strong>Permissions</strong>
                {selectedPermissionDetails.length > 0 ? (
                  <ul className="provider-review-bullets">
                    {selectedPermissionDetails.map((permission) => (
                      <li key={permission.code}>
                        {permission.name} ({permission.code})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="dashboard-copy">No permissions selected.</p>
                )}
              </div>

              <div className="provider-review-hero__section">
                <strong>Systems</strong>
                <p className="dashboard-copy">
                  {formValues.systems.join(', ') || 'Systems not configured yet'}
                </p>
              </div>
            </article>

            <div className="provider-review-list">
              {reviewItems.map((item) => (
                <article key={item.label} className="provider-review-item">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <section className="dashboard-content">
      <div className="dashboard-section-header">
        <span className="dashboard-section-eyebrow">Staff Setup</span>
        <h2>Add Non-Clinical Staff</h2>
        <p>
          Clinic admins can onboard non-patient-care staff into {clinic?.name || 'the clinic'} with
          a dedicated wizard for administrative, operational, facilities, finance, support, and
          service teams.
        </p>
      </div>

      <div className="provider-wizard-layout">
        <aside className="dashboard-card provider-progress-card">
          <div className="provider-progress-card__header">
            <span className="dashboard-card__label">Setup Flow</span>
            <h3>Add New Staff Member</h3>
            <p>{activeStepIndex + 1} of {staffWizardSteps.length} steps in progress.</p>
          </div>

          <div className="provider-progress-bar" aria-hidden="true">
            <span style={{ width: `${completionRatio}%` }} />
          </div>

          <nav className="provider-step-nav" aria-label="Staff setup steps">
            {staffWizardSteps.map((step, index) => {
              const stateClass =
                index === activeStepIndex ? 'is-active' : index < activeStepIndex ? 'is-complete' : '';

              return (
                <button
                  key={step.id}
                  type="button"
                  className={`provider-step-nav__item ${stateClass}`}
                  onClick={() => goToStep(index)}
                >
                  <span className="provider-step-nav__index">{index + 1}</span>
                  <span className="provider-step-nav__label">{step.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="dashboard-card provider-step-card">
          <div className="provider-step-card__header">
            <div>
              <span className="dashboard-card__label">Current Step</span>
              <h3>{activeStep.label}</h3>
              <p className="dashboard-copy">
                This wizard is reserved for non-clinical teams such as billing, reception, records,
                scheduling, IT, HR, finance, maintenance, housekeeping, security, and supply chain.
              </p>
            </div>
            <span className="login-endpoint-label">Admin Only</span>
          </div>

          {renderStepBody()}

            {submissionError ? <p className="login-error">{submissionError}</p> : null}
            {submissionMessage ? <p className="login-success">{submissionMessage}</p> : null}

          <div className="provider-step-actions">
            <button
              type="button"
              className="login-button login-button--secondary"
              onClick={handleBack}
              disabled={activeStepIndex === 0}
            >
              Back
            </button>

              {activeStepIndex === staffWizardSteps.length - 1 ? (
                <button
                  type="button"
                  className="login-button"
                  onClick={handleCreateStaffProfile}
                  disabled={formStatus === 'submitting'}
                >
                  {formStatus === 'submitting' ? 'Creating Staff Profile...' : 'Create Staff Profile'}
                </button>
              ) : (
              <button type="button" className="login-button" onClick={handleNext}>
                Continue
              </button>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

export default EmployeeStaffPage;
