import React from 'react';

import EmployeeProviderPage from './EmployeeProviderPage';

function ClinicEmployeePage({ clinic, staffUser }) {
  if (staffUser?.role !== 'clinic_admin') {
    return (
      <section className="dashboard-content">
        <div className="dashboard-section-header">
          <span className="dashboard-section-eyebrow">Employee Setup</span>
          <h2>Provider access is restricted</h2>
          <p>
            Only clinic admins can add or configure providers in this workspace. If you need
            access, please contact your clinic administrator.
          </p>
        </div>
      </section>
    );
  }

  return <EmployeeProviderPage clinic={clinic} />;
}

export default ClinicEmployeePage;
