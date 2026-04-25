import React from 'react';

import EmployeeAccessAccountsPage from './EmployeeAccessAccountsPage';
import EmployeeProviderPage from './EmployeeProviderPage';
import EmployeeStaffPage from './EmployeeStaffPage';
import ManageEmployeesPage from './ManageEmployeesPage';

function EmployeesWorkspace({ activeView, clinic, staffUser, token }) {
  if (activeView === 'clinical') {
    return <EmployeeProviderPage clinic={clinic} token={token} />;
  }

  if (activeView === 'non_clinical') {
    return <EmployeeStaffPage clinic={clinic} token={token} />;
  }

  if (activeView === 'access_accounts') {
    return <EmployeeAccessAccountsPage clinic={clinic} staffUser={staffUser} token={token} />;
  }

  return <ManageEmployeesPage clinic={clinic} token={token} />;
}

export default EmployeesWorkspace;
