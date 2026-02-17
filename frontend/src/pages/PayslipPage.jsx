// src/pages/PayslipPage.jsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PayslipViewer from '../components/payroll/PayslipViewer';

const PayslipPage = () => {
  const { employeeId, monthYear } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <PayslipViewer
        employeeId={employeeId}
        monthYear={monthYear}
        onClose={() => navigate(-1)}
      />
    </div>
  );
};

export default PayslipPage;
