import React, { useMemo, useState } from 'react';

const wizardSteps = [
  { id: 'basic_info', label: 'Basic Info' },
  { id: 'role', label: 'Role' },
  { id: 'clinical_categories', label: 'Clinical Categories' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'experience', label: 'Experience' },
  { id: 'responsibilities', label: 'Responsibilities' },
  { id: 'availability', label: 'Availability' },
  { id: 'review', label: 'Review' },
];

const initialFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  startDate: '',
  status: 'pending',
  providerType: 'Physician',
  department: 'General Medicine',
  primaryRole: 'Treating provider',
  roleTitle: '',
  employmentType: 'Full Time',
  clinicalCategories: ['Preventive / Routine Care'],
  clinicalCategoryDetails: {
    'Preventive / Routine Care': [
      'Annual physical exam',
      'Wellness visit',
      'Vaccination encounter',
      'Blood pressure screening',
      'Cholesterol screening',
      'Diabetes screening',
      'Routine follow-up with no acute complaint',
      'Preventive counseling visit',
      'School or work clearance exam',
      'Medication refill follow-up',
      'Smoking cessation counseling',
      'Weight management counseling',
    ],
  },
  credentials: {
    licenseType: '',
    licenseNumber: '',
    issuingState: '',
    expirationDate: '',
    licenseStatus: 'active',
    degree: '',
    yearsOfExperience: '',
    specialTraining: '',
    boardCertification: '',
    npiNumber: '',
    deaNumber: '',
    supportingDocuments: [],
  },
  experience: {
    yearsInPractice: '',
    previousSpecialties: '',
    languagesSpoken: '',
    populationFocus: ['adults'],
    notes: '',
    internalNotes: '',
  },
  responsibilities: ['Can receive patient assignments', 'Can sign charts'],
  availability: {
    daysAvailable: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    startTime: '09:00',
    endTime: '17:00',
    maxPatientsPerDay: '20',
    visitTypesAllowed: ['New patient visit', 'Follow-up visit'],
    notes: '',
  },
};

const providerTypes = [
  'Physician',
  'Nurse Practitioner',
  'Physician Assistant',
  'Therapist',
  'Registered Nurse',
  'Medical Assistant',
  'Lab Technician',
  'Other',
];
const employmentTypes = ['Full Time', 'Part Time', 'Contract'];
const providerStatuses = ['active', 'inactive', 'pending'];
const departmentOptions = [
  'General Medicine',
  'Urgent Care',
  'Vaccination',
  'Lab Services',
  'Wound Care',
  'Chronic Care',
];
const primaryRoleOptions = [
  'Treating provider',
  'Supervising provider',
  'Procedure-only provider',
  'Lab-only staff',
  'Intake-only staff',
];
const clinicalCategoryDefinitions = [
  {
    name: 'Respiratory',
    description: 'Airways, breathing, lung, nose, throat, and sinus outpatient conditions.',
    conditions: [
      'Acute upper respiratory infection (URI)',
      'Common cold',
      'Influenza',
      'COVID-19',
      'Acute bronchitis',
      'Sinusitis',
      'Pharyngitis',
      'Strep throat',
      'Tonsillitis',
      'Allergic rhinitis',
      'Asthma follow-up',
      'Mild asthma exacerbation',
      'Cough, unspecified',
      'Shortness of breath, mild outpatient evaluation',
      'Viral syndrome',
    ],
    meaning: [
      'This category covers conditions involving the airways, breathing, lungs, throat, nose, and sinuses, especially outpatient cases that a clinic commonly sees.',
      'This is one of the most common primary-care and urgent-care categories.',
    ],
  },
  {
    name: 'Musculoskeletal / Injury',
    description: 'Bones, joints, muscles, tendons, ligaments, and soft-tissue injuries.',
    conditions: [
      'Sprain',
      'Strain',
      'Fracture, suspected or confirmed',
      'Contusion',
      'Joint pain',
      'Back pain',
      'Neck pain',
      'Shoulder injury',
      'Knee injury',
      'Ankle injury',
      'Tendonitis',
      'Repetitive strain injury',
      'Muscle spasm',
      'Wrist pain',
      'Foot injury',
      'Minor fall injury',
    ],
    meaning: [
      'This category covers bones, joints, muscles, tendons, ligaments, and soft-tissue injuries, especially outpatient injuries that can be evaluated, stabilized, or referred.',
      'This is especially useful in urgent-care-style clinic workflows.',
    ],
  },
  {
    name: 'Infectious Diseases',
    description: 'General outpatient infection management across body systems.',
    conditions: [
      'Influenza',
      'COVID-19',
      'Strep throat',
      'Urinary tract infection',
      'Cellulitis',
      'Gastroenteritis',
      'Otitis media',
      'Conjunctivitis',
      'Skin abscess',
      'Viral syndrome',
      'Viral pharyngitis',
      'Bacterial pharyngitis',
      'Folliculitis',
      'Fungal skin infection',
      'Mild dehydration due to infection',
      'Parasitic suspicion, depending on clinic scope',
    ],
    meaning: [
      'This category covers conditions caused by infectious agents, such as bacteria, viruses, fungi, or parasites, as handled in an outpatient clinic environment.',
      'This category overlaps with Respiratory, Gastrointestinal, Dermatology, and sometimes Lab-Driven Conditions. In the platform, this category should represent the provider’s ability to manage infections generally.',
    ],
  },
  {
    name: 'Chronic Conditions',
    description: 'Ongoing disease management, repeat follow-up, and medication monitoring.',
    conditions: [
      'Diabetes',
      'Hypertension',
      'Hyperlipidemia',
      'Hypothyroidism',
      'Asthma, long-term management',
      'Chronic kidney disease, outpatient monitoring depending on clinic scope',
      'Obesity',
      'Prediabetes',
      'GERD, long-term management',
      'Chronic pain follow-up, depending on clinic scope',
    ],
    meaning: [
      'This category covers long-term medical conditions that require ongoing monitoring, medication management, periodic labs, and repeat follow-up visits.',
      'This category is central to primary care clinics.',
    ],
  },
  {
    name: 'Preventive / Routine Care',
    description: 'Wellness, screening, follow-up, and preventive outpatient visits.',
    conditions: [
      'Annual physical exam',
      'Wellness visit',
      'Vaccination encounter',
      'Blood pressure screening',
      'Cholesterol screening',
      'Diabetes screening',
      'Routine follow-up with no acute complaint',
      'Preventive counseling visit',
      'School or work clearance exam',
      'Medication refill follow-up',
      'Smoking cessation counseling',
      'Weight management counseling',
    ],
    meaning: [
      'This category covers non-acute, routine, wellness, screening, and preventive services. These visits are usually lower urgency and often more structured than acute illness visits.',
      'This is important because many providers will need access to this category even if they do not handle urgent illness or injuries.',
    ],
  },
  {
    name: 'Gastrointestinal',
    description: 'Digestive complaints and common outpatient GI presentations.',
    conditions: [
      'Gastroenteritis',
      'Abdominal pain, unspecified',
      'Dyspepsia',
      'GERD',
      'Constipation',
      'Diarrhea',
      'Nausea/vomiting',
      'Viral gastroenteritis',
      'Food-related GI upset',
      'Gastritis',
      'Peptic ulcer disease suspicion',
      'H. pylori-related dyspepsia, depending on testing workflow',
      'IBS-type symptoms / functional GI complaint',
      'Hemorrhoid complaint, if clinic handles basic evaluation',
      'Dehydration, mild outpatient',
    ],
    meaning: [
      'This category covers digestive-system complaints commonly handled in outpatient care, especially abdominal pain, reflux, nausea, vomiting, diarrhea, constipation, bloating, and dyspepsia.',
      'Acute abdominal pain and dyspepsia are common outpatient presentations, and many clinics also manage common functional GI complaints such as gas and bloating.',
    ],
  },
  {
    name: 'Dermatology',
    description: 'Skin, rash, and minor outpatient dermatologic concerns.',
    conditions: [
      'Atopic dermatitis / eczema',
      'Contact dermatitis',
      'Rash, unspecified',
      'Urticaria / hives',
      'Acne',
      'Fungal skin infection',
      'Cellulitis',
      'Impetigo',
      'Folliculitis',
      'Furuncle / boil',
      'Abscess',
      'Psoriasis follow-up',
      'Insect bite reaction',
      'Seborrheic dermatitis',
      'Skin lesion requiring evaluation',
      'Warts',
      'Pityriasis rosea',
    ],
    meaning: [
      'This category covers skin, hair, nail, and superficial soft-tissue complaints that are commonly evaluated and managed in an outpatient clinic.',
      'In primary care, this usually includes rashes, eczema, minor skin infections, acne, allergic skin reactions, fungal conditions, and selected office skin procedures.',
    ],
  },
  {
    name: 'Mental Health',
    description: 'Behavioral health screening, follow-up, basic management, or referral.',
    conditions: [
      'Anxiety',
      'Depression',
      'Adjustment disorder',
      'Insomnia',
      'Stress-related symptoms',
      'Panic symptoms',
      'Mood symptoms',
      'Behavioral health follow-up',
      'Medication follow-up for mental health, depending on clinic scope',
    ],
    meaning: [
      'This category covers outpatient mental and behavioral health concerns that a clinic may screen, document, manage at a basic level, or refer.',
      'This category is important because not every provider should automatically have access to all mental-health-related case handling, depending on clinic design and privacy rules.',
    ],
  },
  {
    name: 'Minor Procedures / Wound Care',
    description: 'Simple procedures, wound evaluation, and outpatient treatment tasks.',
    conditions: [
      'Laceration',
      'Abrasion',
      'Minor burn',
      'Wound check',
      'Dressing change',
      'Skin tear',
      'Puncture wound',
      'Bite wound evaluation',
      'Abscess',
      'Draining wound',
      'Superficial wound infection',
      'Post-procedure wound follow-up',
      'Embedded splinter / simple foreign body, depending on clinic scope',
    ],
    meaning: [
      'This category covers simple office-based procedures and wound management typically performed in outpatient care, such as laceration care, dressing changes, minor burns, abscess management, simple drainage, splint support documentation, and follow-up wound checks.',
      'CDC guidance emphasizes prompt cleaning and management of traumatic or bite wounds to help prevent secondary infection, and AAFP notes that many burns can be managed in outpatient settings.',
    ],
  },
  {
    name: 'Lab-Driven Conditions',
    description: 'Cases where lab interpretation and follow-up are a major workflow driver.',
    conditions: [
      'Anemia',
      'Prediabetes',
      'Diabetes diagnosed by lab criteria',
      'Hyperlipidemia',
      'Electrolyte imbalance',
      'Thyroid disorder',
      'Abnormal liver function tests requiring follow-up',
      'Kidney function abnormality requiring outpatient follow-up',
      'Iron deficiency suspicion',
      'Abnormal CBC review',
      'Abnormal urinalysis review',
      'Infection confirmed or clarified by lab findings',
      'Medication monitoring abnormality',
    ],
    meaning: [
      'This category covers visits where lab values are central to diagnosis, monitoring, or treatment decisions.',
      'It can include either diagnosis discovered mainly through testing or ongoing disease-management workflows built around repeated labs. Common outpatient labs used in screening and monitoring include CBC, metabolic panels, HbA1c, lipids, thyroid tests, and urinalysis.',
    ],
  },
];
const responsibilityOptions = [
  'Can receive patient assignments',
  'Can supervise other staff',
  'Can sign charts',
  'Can approve lab results',
  'Can finalize diagnoses',
  'Can discharge patients',
  'Can administer vaccines',
  'Can perform wound care',
  'Can access billing codes',
  'Can manage prescriptions',
];
const populationFocusOptions = ['pediatrics', 'adults', 'geriatrics'];
const dayOptions = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const visitTypeOptions = [
  'New patient visit',
  'Follow-up visit',
  'Same-day sick visit',
  'Preventive / wellness visit',
  'Chronic care follow-up',
  'Vaccination visit',
  'Lab review visit',
  'Procedure visit',
  'Telehealth visit',
];

function getCredentialAlerts(credentials) {
  const alerts = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!credentials.licenseType || !credentials.licenseNumber || !credentials.expirationDate) {
    alerts.push({
      type: 'missing',
      title: 'Missing required credential',
      message: 'License type, license number, and expiration date are required to validate scope.',
    });
  }

  if (credentials.licenseStatus === 'inactive') {
    alerts.push({
      type: 'inactive',
      title: 'Inactive license',
      message: 'This provider should not be assigned clinical responsibilities until the license is active.',
    });
  }

  if (credentials.expirationDate) {
    const expirationDate = new Date(credentials.expirationDate);
    expirationDate.setHours(0, 0, 0, 0);

    if (!Number.isNaN(expirationDate.getTime())) {
      const diffInDays = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffInDays >= 0 && diffInDays <= 60) {
        alerts.push({
          type: 'warning',
          title: 'Expiring soon',
          message: `Primary license expires in ${diffInDays} day${diffInDays === 1 ? '' : 's'}.`,
        });
      }
    }
  }

  return alerts;
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
            <span className="dashboard-section-eyebrow">Scope Setup</span>
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

function formatDayRange(days) {
  if (!days.length) {
    return 'No schedule set';
  }

  return days.length > 1 ? `${days[0]}-${days[days.length - 1]}` : days[0];
}

function EmployeeProviderPage({ clinic }) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [formValues, setFormValues] = useState(initialFormValues);
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [activeScopeCategory, setActiveScopeCategory] = useState(null);

  const activeStep = wizardSteps[activeStepIndex];
  const completionRatio = ((activeStepIndex + 1) / wizardSteps.length) * 100;
  const activeScopeDefinition = clinicalCategoryDefinitions.find(
    (category) => category.name === activeScopeCategory
  );
  const credentialAlerts = useMemo(
    () => getCredentialAlerts(formValues.credentials),
    [formValues.credentials]
  );
  const providerDisplayName =
    [formValues.firstName, formValues.lastName].filter(Boolean).join(' ') || 'New Provider';
  const reviewAvailabilitySummary = [
    formatDayRange(formValues.availability.daysAvailable),
    formValues.availability.startTime && formValues.availability.endTime
      ? `${formValues.availability.startTime}-${formValues.availability.endTime}`
      : null,
  ]
    .filter(Boolean)
    .join(', ');

  const reviewItems = useMemo(
    () => [
      {
        label: 'Provider',
        value:
          [formValues.firstName, formValues.lastName].filter(Boolean).join(' ') || 'Not provided yet',
      },
      {
        label: 'Contact',
        value: formValues.email || formValues.phone || 'Not provided yet',
      },
      {
        label: 'Role',
        value:
          [
            formValues.providerType,
            formValues.primaryRole,
            formValues.department,
            formValues.roleTitle,
            formValues.status && `Status: ${formValues.status}`,
            formValues.startDate && `Starts ${formValues.startDate}`,
          ]
            .filter(Boolean)
            .join(' • ') || 'Not provided yet',
      },
      {
        label: 'Clinical Categories',
        value:
          formValues.clinicalCategories
            .map((category) => {
              const selectedDetails = formValues.clinicalCategoryDetails[category] || [];
              return selectedDetails.length > 0
                ? `${category} (${selectedDetails.length} selected details)`
                : category;
            })
            .join(', ') || 'None selected',
      },
      {
        label: 'Credentials',
        value:
          [
            formValues.credentials.licenseType,
            formValues.credentials.licenseNumber && `License ${formValues.credentials.licenseNumber}`,
            formValues.credentials.npiNumber && `NPI ${formValues.credentials.npiNumber}`,
            formValues.credentials.boardCertification && formValues.credentials.boardCertification,
          ]
            .filter(Boolean)
            .join(', ') || 'Not provided yet',
      },
      {
        label: 'Availability',
        value:
          [
            formValues.availability.daysAvailable.length > 0 &&
              `Days: ${formValues.availability.daysAvailable.join(', ')}`,
            formValues.availability.startTime &&
              formValues.availability.endTime &&
              `Hours: ${formValues.availability.startTime} - ${formValues.availability.endTime}`,
            formValues.availability.maxPatientsPerDay &&
              `Max ${formValues.availability.maxPatientsPerDay} patients/day`,
            formValues.availability.visitTypesAllowed.length > 0 &&
              `Visit types: ${formValues.availability.visitTypesAllowed.join(', ')}`,
          ]
            .filter(Boolean)
            .join(' • ') || 'Not provided yet',
      },
      {
        label: 'Experience / Focus',
        value:
          [
            formValues.experience.yearsInPractice &&
              `${formValues.experience.yearsInPractice} years in practice`,
            formValues.experience.previousSpecialties,
            formValues.experience.languagesSpoken && `Languages: ${formValues.experience.languagesSpoken}`,
            formValues.experience.populationFocus.length > 0 &&
              `Population focus: ${formValues.experience.populationFocus.join(', ')}`,
          ]
            .filter(Boolean)
            .join(' • ') || 'Not provided yet',
      },
      {
        label: 'Clinic Responsibilities',
        value: formValues.responsibilities.join(', ') || 'None selected',
      },
    ],
    [formValues]
  );

  function updateField(field) {
    return (event) => {
      const { value } = event.target;
      setSubmissionMessage('');
      setFormValues((current) => ({
        ...current,
        [field]: value,
      }));
    };
  }

  function updateNestedField(group, field) {
    return (event) => {
      const { value } = event.target;
      setSubmissionMessage('');
      setFormValues((current) => ({
        ...current,
        [group]: {
          ...current[group],
          [field]: value,
        },
      }));
    };
  }

  function toggleNestedListValue(group, field, value) {
    setSubmissionMessage('');
    setFormValues((current) => {
      const values = current[group][field];
      const hasValue = values.includes(value);

      return {
        ...current,
        [group]: {
          ...current[group],
          [field]: hasValue ? values.filter((item) => item !== value) : [...values, value],
        },
      };
    });
  }

  function handleSupportingDocumentsChange(event) {
    const files = Array.from(event.target.files || []);
    setSubmissionMessage('');
    setFormValues((current) => ({
      ...current,
      credentials: {
        ...current.credentials,
        supportingDocuments: files.map((file) => file.name),
      },
    }));
  }

  function toggleListValue(field, value) {
    setSubmissionMessage('');
    setFormValues((current) => {
      const values = current[field];
      const hasValue = values.includes(value);

      return {
        ...current,
        [field]: hasValue ? values.filter((item) => item !== value) : [...values, value],
      };
    });
  }

  function handleCategoryToggle(categoryDefinition) {
    const categoryName = categoryDefinition.name;
    const defaultDetails = categoryDefinition.conditions || [];

    setSubmissionMessage('');
    setFormValues((current) => {
      const isSelected = current.clinicalCategories.includes(categoryName);

      if (isSelected) {
        const nextDetails = { ...current.clinicalCategoryDetails };
        delete nextDetails[categoryName];

        return {
          ...current,
          clinicalCategories: current.clinicalCategories.filter((item) => item !== categoryName),
          clinicalCategoryDetails: nextDetails,
        };
      }

      return {
        ...current,
        clinicalCategories: [...current.clinicalCategories, categoryName],
        clinicalCategoryDetails: {
          ...current.clinicalCategoryDetails,
          [categoryName]: defaultDetails,
        },
      };
    });

    setActiveScopeCategory((current) => (current === categoryName ? null : categoryName));

    if (!formValues.clinicalCategories.includes(categoryName)) {
      setActiveScopeCategory(categoryName);
    }
  }

  function toggleCategoryDetail(categoryName, detail) {
    setSubmissionMessage('');
    setFormValues((current) => {
      const existingDetails = current.clinicalCategoryDetails[categoryName] || [];
      const hasDetail = existingDetails.includes(detail);

      return {
        ...current,
        clinicalCategoryDetails: {
          ...current.clinicalCategoryDetails,
          [categoryName]: hasDetail
            ? existingDetails.filter((item) => item !== detail)
            : [...existingDetails, detail],
        },
      };
    });
  }

  function goToStep(stepIndex) {
    setActiveStepIndex(stepIndex);
    setSubmissionMessage('');
  }

  function handleNext() {
    setActiveStepIndex((current) => Math.min(current + 1, wizardSteps.length - 1));
    setSubmissionMessage('');
  }

  function handleBack() {
    setActiveStepIndex((current) => Math.max(current - 1, 0));
    setSubmissionMessage('');
  }

  function handleCreateProvider() {
    setSubmissionMessage(
      'Provider setup flow is scaffolded. Next we can wire each step to real validation and API submission.'
    );
  }

  function renderStepBody() {
    switch (activeStep.id) {
      case 'basic_info':
        return (
          <div className="provider-form-grid provider-form-grid--two-column">
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
                placeholder="Morgan"
              />
            </label>
            <label className="login-field">
              <span>Email</span>
              <input
                type="email"
                value={formValues.email}
                onChange={updateField('email')}
                placeholder="provider@clinic.org"
              />
            </label>
            <label className="login-field">
              <span>Phone</span>
              <input
                type="tel"
                value={formValues.phone}
                onChange={updateField('phone')}
                placeholder="(555) 555-0123"
              />
            </label>
          </div>
        );
      case 'role':
        return (
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
                {providerStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="login-field">
              <span>Provider type</span>
              <select
                className="staff-select"
                value={formValues.providerType}
                onChange={updateField('providerType')}
              >
                {providerTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="login-field">
              <span>Department</span>
              <select
                className="staff-select"
                value={formValues.department}
                onChange={updateField('department')}
              >
                {departmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
            <label className="login-field">
              <span>Primary role</span>
              <select
                className="staff-select"
                value={formValues.primaryRole}
                onChange={updateField('primaryRole')}
              >
                {primaryRoleOptions.map((role) => (
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
                {employmentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="login-field provider-form-grid__full">
              <span>Role title</span>
              <input
                type="text"
                value={formValues.roleTitle}
                onChange={updateField('roleTitle')}
                placeholder="Lead Family Medicine Provider"
              />
            </label>
            <p className="dashboard-copy provider-form-grid__full">
              Primary role controls which operational queues this employee should appear in, so
              lab-only and intake-only staff can stay out of treating-provider workflows.
            </p>
          </div>
        );
      case 'clinical_categories':
        return (
          <div className="provider-category-stage">
            <div className="provider-scope-intro">
              <span className="dashboard-card__label">Scope Of Practice</span>
              <h4>Assign providers to clinical categories first</h4>
              <p className="dashboard-copy">
                This is the most important step. Instead of assigning diagnoses one by one, set
                the provider&apos;s scope by category so routing, permissions, and future case
                handling stay manageable.
              </p>
            </div>

            <div className="provider-category-grid">
              {clinicalCategoryDefinitions.map((category) => {
                const isSelected = formValues.clinicalCategories.includes(category.name);
                const selectedDetailCount = (formValues.clinicalCategoryDetails[category.name] || []).length;

                return (
                  <article
                    key={category.name}
                    className={`provider-category-card ${isSelected ? 'is-selected' : ''}`}
                  >
                    <label className="provider-category-card__toggle">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleCategoryToggle(category)}
                      />
                      <div>
                        <strong>{category.name}</strong>
                        <span>{category.description}</span>
                      </div>
                    </label>

                    {isSelected ? (
                      <div className="provider-category-card__footer">
                        <span className="login-endpoint-label">
                          {selectedDetailCount > 0
                            ? `${selectedDetailCount} scope details selected`
                            : 'Category assigned'}
                        </span>
                        <button
                          type="button"
                          className="login-button login-button--secondary"
                          onClick={() => setActiveScopeCategory(category.name)}
                        >
                          Edit Scope of Practice
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        );
      case 'credentials':
        return (
          <div className="provider-credentials-layout">
            {credentialAlerts.length > 0 ? (
              <div className="provider-alert-stack">
                {credentialAlerts.map((alert) => (
                  <article
                    key={`${alert.type}-${alert.title}`}
                    className={`provider-alert provider-alert--${alert.type}`}
                  >
                    <strong>{alert.title}</strong>
                    <span>{alert.message}</span>
                  </article>
                ))}
              </div>
            ) : (
              <p className="login-success">
                Credentials look complete enough for this scaffolded step. We can add stricter
                validation next.
              </p>
            )}

            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Education</span>
                <h4>Qualifications and training</h4>
              </div>
              <div className="provider-form-grid provider-form-grid--two-column">
                <label className="login-field provider-form-grid__full">
                  <span>Degree / educational background</span>
                  <input
                    type="text"
                    value={formValues.credentials.degree}
                    onChange={updateNestedField('credentials', 'degree')}
                    placeholder="MD, University of Washington School of Medicine"
                  />
                </label>
                <label className="login-field">
                  <span>Years of experience</span>
                  <input
                    type="number"
                    min="0"
                    value={formValues.credentials.yearsOfExperience}
                    onChange={updateNestedField('credentials', 'yearsOfExperience')}
                    placeholder="8"
                  />
                </label>
                <label className="login-field provider-form-grid__full">
                  <span>Special training</span>
                  <textarea
                    className="patient-textarea"
                    value={formValues.credentials.specialTraining}
                    onChange={updateNestedField('credentials', 'specialTraining')}
                    placeholder="Urgent care procedures, asthma management, wound closure, behavioral health screening..."
                  />
                </label>
              </div>
            </section>

            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">License</span>
                <h4>Primary license details</h4>
              </div>
              <div className="provider-form-grid provider-form-grid--two-column">
                <label className="login-field">
                  <span>License type</span>
                  <input
                    type="text"
                    value={formValues.credentials.licenseType}
                    onChange={updateNestedField('credentials', 'licenseType')}
                    placeholder="MD, DO, NP, PA, RN"
                  />
                </label>
                <label className="login-field">
                  <span>License number</span>
                  <input
                    type="text"
                    value={formValues.credentials.licenseNumber}
                    onChange={updateNestedField('credentials', 'licenseNumber')}
                    placeholder="LIC-204859"
                  />
                </label>
                <label className="login-field">
                  <span>Issuing state</span>
                  <input
                    type="text"
                    value={formValues.credentials.issuingState}
                    onChange={updateNestedField('credentials', 'issuingState')}
                    placeholder="California"
                  />
                </label>
                <label className="login-field">
                  <span>Expiration date</span>
                  <input
                    type="date"
                    value={formValues.credentials.expirationDate}
                    onChange={updateNestedField('credentials', 'expirationDate')}
                  />
                </label>
                <label className="login-field provider-form-grid__full">
                  <span>License status</span>
                  <select
                    className="staff-select"
                    value={formValues.credentials.licenseStatus}
                    onChange={updateNestedField('credentials', 'licenseStatus')}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending_verification">Pending verification</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Certifications</span>
                <h4>Board certifications and supporting proof</h4>
              </div>
              <div className="provider-form-grid provider-form-grid--two-column">
                <label className="login-field provider-form-grid__full">
                  <span>Board certifications</span>
                  <input
                    type="text"
                    value={formValues.credentials.boardCertification}
                    onChange={updateNestedField('credentials', 'boardCertification')}
                    placeholder="Family Medicine, ACLS, BLS"
                  />
                </label>
                <label className="login-field provider-form-grid__full">
                  <span>Upload supporting documents</span>
                  <input
                    type="file"
                    multiple
                    onChange={handleSupportingDocumentsChange}
                  />
                </label>
                {formValues.credentials.supportingDocuments.length > 0 ? (
                  <div className="provider-document-list provider-form-grid__full">
                    {formValues.credentials.supportingDocuments.map((documentName) => (
                      <span key={documentName} className="login-endpoint-label">
                        {documentName}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Regulatory IDs</span>
                <h4>Identifiers used for claims and prescribing</h4>
              </div>
              <div className="provider-form-grid provider-form-grid--two-column">
                <label className="login-field">
                  <span>NPI number</span>
                  <input
                    type="text"
                    value={formValues.credentials.npiNumber}
                    onChange={updateNestedField('credentials', 'npiNumber')}
                    placeholder="1234567890"
                  />
                </label>
                <label className="login-field">
                  <span>DEA number, if applicable</span>
                  <input
                    type="text"
                    value={formValues.credentials.deaNumber}
                    onChange={updateNestedField('credentials', 'deaNumber')}
                    placeholder="AB1234567"
                  />
                </label>
              </div>
            </section>
          </div>
        );
      case 'experience':
        return (
          <div className="provider-credentials-layout">
            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Experience</span>
                <h4>Practical background and focus areas</h4>
              </div>
              <p className="dashboard-copy">
                This helps the system route cases more intelligently later. For example, a provider
                may be assigned to respiratory and infectious disease, but still be especially
                strong in pediatric cases.
              </p>

              <div className="provider-form-grid provider-form-grid--two-column">
                <label className="login-field">
                  <span>Years in practice</span>
                  <input
                    type="number"
                    min="0"
                    value={formValues.experience.yearsInPractice}
                    onChange={updateNestedField('experience', 'yearsInPractice')}
                    placeholder="8"
                  />
                </label>
                <label className="login-field">
                  <span>Languages spoken</span>
                  <input
                    type="text"
                    value={formValues.experience.languagesSpoken}
                    onChange={updateNestedField('experience', 'languagesSpoken')}
                    placeholder="English, Spanish"
                  />
                </label>
                <label className="login-field provider-form-grid__full">
                  <span>Previous specialties</span>
                  <textarea
                    className="patient-textarea"
                    value={formValues.experience.previousSpecialties}
                    onChange={updateNestedField('experience', 'previousSpecialties')}
                    placeholder="Pediatric urgent care, family medicine, chronic disease management..."
                  />
                </label>
              </div>
            </section>

            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Population Focus</span>
                <h4>Patient groups this employee works with best</h4>
              </div>
              <div className="provider-chip-grid">
                {populationFocusOptions.map((population) => (
                  <button
                    key={population}
                    type="button"
                    className={`provider-chip ${formValues.experience.populationFocus.includes(population) ? 'is-selected' : ''}`}
                    onClick={() => toggleNestedListValue('experience', 'populationFocus', population)}
                  >
                    {population}
                  </button>
                ))}
              </div>
            </section>

            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Routing Notes</span>
                <h4>Additional experience context</h4>
              </div>
              <div className="provider-form-grid">
                <label className="login-field">
                  <span>Notes on experience</span>
                  <textarea
                    className="patient-textarea"
                    value={formValues.experience.notes}
                    onChange={updateNestedField('experience', 'notes')}
                    placeholder="Strong with same-day respiratory visits, pediatric infectious complaints, and routine follow-up care."
                  />
                </label>
                <label className="login-field">
                  <span>Internal notes</span>
                  <textarea
                    className="patient-textarea"
                    value={formValues.experience.internalNotes}
                    onChange={updateNestedField('experience', 'internalNotes')}
                    placeholder="Prefers pediatric queue on weekdays. Good fit for chronic care callbacks."
                  />
                </label>
              </div>
            </section>
          </div>
        );
      case 'responsibilities':
        return (
          <div className="provider-credentials-layout">
            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Operations Setup</span>
                <h4>Translate this provider profile into platform behavior</h4>
              </div>
              <p className="dashboard-copy">
                This page controls what the employee can actually do inside clinic workflows, not
                just what appears in their HR profile. These selections will shape assignments,
                chart handling, approvals, and downstream operational access.
              </p>

              <div className="provider-responsibility-grid">
                {responsibilityOptions.map((responsibility) => (
                  <label key={responsibility} className="provider-scope-checklist__item">
                    <input
                      type="checkbox"
                      checked={formValues.responsibilities.includes(responsibility)}
                      onChange={() => toggleListValue('responsibilities', responsibility)}
                    />
                    <span>{responsibility}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Current Operational Access</span>
                <h4>Selected responsibilities</h4>
              </div>
              {formValues.responsibilities.length > 0 ? (
                <div className="provider-chip-grid">
                  {formValues.responsibilities.map((responsibility) => (
                    <span key={responsibility} className="login-endpoint-label">
                      {responsibility}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="dashboard-copy">
                  No operational permissions selected yet. This employee will not participate in
                  clinic workflows until at least one responsibility is assigned.
                </p>
              )}
            </section>
          </div>
        );
      case 'availability':
        return (
          <div className="provider-credentials-layout">
            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Scheduling Setup</span>
                <h4>Availability for patient-facing scheduling</h4>
              </div>
              <p className="dashboard-copy">
                This will eventually assist with the future scheduling module, so the admin can
                define when this provider should appear as available for patient visits.
              </p>

              <div className="provider-form-grid provider-form-grid--two-column">
                <label className="login-field provider-form-grid__full">
                  <span>Days available</span>
                  <div className="provider-chip-grid">
                    {dayOptions.map((day) => (
                      <button
                        key={day}
                        type="button"
                        className={`provider-chip ${formValues.availability.daysAvailable.includes(day) ? 'is-selected' : ''}`}
                        onClick={() => toggleNestedListValue('availability', 'daysAvailable', day)}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="login-field">
                  <span>Start time</span>
                  <input
                    type="time"
                    value={formValues.availability.startTime}
                    onChange={updateNestedField('availability', 'startTime')}
                  />
                </label>
                <label className="login-field">
                  <span>End time</span>
                  <input
                    type="time"
                    value={formValues.availability.endTime}
                    onChange={updateNestedField('availability', 'endTime')}
                  />
                </label>
                <label className="login-field">
                  <span>Max patients per day</span>
                  <input
                    type="number"
                    min="0"
                    value={formValues.availability.maxPatientsPerDay}
                    onChange={updateNestedField('availability', 'maxPatientsPerDay')}
                    placeholder="20"
                  />
                </label>
              </div>
            </section>

            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Visit Access</span>
                <h4>Visit types allowed</h4>
              </div>
              <div className="provider-responsibility-grid">
                {visitTypeOptions.map((visitType) => (
                  <label key={visitType} className="provider-scope-checklist__item">
                    <input
                      type="checkbox"
                      checked={formValues.availability.visitTypesAllowed.includes(visitType)}
                      onChange={() =>
                        toggleNestedListValue('availability', 'visitTypesAllowed', visitType)
                      }
                    />
                    <span>{visitType}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="provider-group-card">
              <div className="provider-group-card__header">
                <span className="dashboard-card__label">Scheduling Notes</span>
                <h4>Additional availability notes</h4>
              </div>
              <label className="login-field">
                <span>Notes</span>
                <textarea
                  className="patient-textarea"
                  value={formValues.availability.notes}
                  onChange={updateNestedField('availability', 'notes')}
                  placeholder="Available for morning clinic only on Tuesdays, prefers telehealth on Fridays, not available for procedure blocks."
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
              <h4>{providerDisplayName}</h4>
              <div className="provider-review-hero__meta">
                <span>Provider Type: {formValues.providerType || 'Not provided yet'}</span>
                <span>Department: {formValues.department || 'Not provided yet'}</span>
              </div>

              <div className="provider-review-hero__section">
                <strong>Categories</strong>
                {formValues.clinicalCategories.length > 0 ? (
                  <ul className="provider-review-bullets">
                    {formValues.clinicalCategories.map((category) => (
                      <li key={category}>{category}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="dashboard-copy">No categories selected.</p>
                )}
              </div>

              <div className="provider-review-hero__section">
                <strong>Permissions</strong>
                {formValues.responsibilities.length > 0 ? (
                  <ul className="provider-review-bullets">
                    {formValues.responsibilities.map((responsibility) => (
                      <li key={responsibility}>{responsibility}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="dashboard-copy">No permissions selected.</p>
                )}
              </div>

              <div className="provider-review-hero__section">
                <strong>Credentials</strong>
                <ul className="provider-review-bullets">
                  {formValues.credentials.licenseType ? (
                    <li>{formValues.credentials.licenseType}</li>
                  ) : null}
                  {formValues.credentials.expirationDate ? (
                    <li>
                      License {formValues.credentials.licenseStatus} through{' '}
                      {formValues.credentials.expirationDate}
                    </li>
                  ) : (
                    <li>License date not provided yet</li>
                  )}
                </ul>
              </div>

              <div className="provider-review-hero__section">
                <strong>Availability</strong>
                <p className="dashboard-copy">
                  {reviewAvailabilitySummary || 'Availability not configured yet'}
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
    <>
      <section className="dashboard-content">
        <div className="dashboard-section-header">
          <span className="dashboard-section-eyebrow">Employee Setup</span>
          <h2>Add New Provider</h2>
          <p>
            Clinic admins can onboard providers into {clinic?.name || 'the clinic'} with a guided
            step-by-step flow. Each step is intentionally separated so we can keep refining the
            details without turning this into one long page.
          </p>
        </div>

        <div className="provider-wizard-layout">
          <aside className="dashboard-card provider-progress-card">
            <div className="provider-progress-card__header">
              <span className="dashboard-card__label">Setup Flow</span>
              <h3>Add New Provider</h3>
              <p>{activeStepIndex + 1} of 8 completed steps in progress.</p>
            </div>

            <div className="provider-progress-bar" aria-hidden="true">
              <span style={{ width: `${completionRatio}%` }} />
            </div>

            <nav className="provider-step-nav" aria-label="Provider setup steps">
              {wizardSteps.map((step, index) => {
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
                  This is the initial scaffold for the provider onboarding wizard. We can now tune
                  validation, fields, and backend actions step by step.
                </p>
              </div>
              <span className="login-endpoint-label">Admin Only</span>
            </div>

            {renderStepBody()}

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

              {activeStepIndex === wizardSteps.length - 1 ? (
                <button type="button" className="login-button" onClick={handleCreateProvider}>
                  Create Provider Profile
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

      {activeScopeDefinition ? (
        <ModalShell
          title={`Scope of Practice: ${activeScopeDefinition.name}`}
          onClose={() => setActiveScopeCategory(null)}
        >
          <p className="dashboard-copy">
            Category-level assignment is already granted. Use these checkboxes to optionally refine
            exactly which diagnoses or visit types this employee can treat.
          </p>

          {activeScopeDefinition.conditions?.length ? (
            <div className="provider-scope-checklist">
              {activeScopeDefinition.conditions.map((condition) => (
                <label key={condition} className="provider-scope-checklist__item">
                  <input
                    type="checkbox"
                    checked={(formValues.clinicalCategoryDetails[activeScopeDefinition.name] || []).includes(
                      condition
                    )}
                    onChange={() => toggleCategoryDetail(activeScopeDefinition.name, condition)}
                  />
                  <span>{condition}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="dashboard-copy">
              Detailed diagnosis-level refinement has not been defined for this category yet. The
              category itself is still assigned to this employee.
            </p>
          )}

          <div className="provider-category-details__section">
            <h5>What this category means</h5>
            {activeScopeDefinition.meaning?.length ? (
              activeScopeDefinition.meaning.map((paragraph) => (
                <p key={paragraph} className="dashboard-copy">
                  {paragraph}
                </p>
              ))
            ) : (
              <p className="dashboard-copy">
                Detailed scope guidance for this category can be added next as we continue refining
                the wizard.
              </p>
            )}
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}

export default EmployeeProviderPage;
