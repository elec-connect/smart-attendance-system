import React from 'react';
import { FaUsers } from 'react-icons/fa';

const EmployeeChart = ({ data = {} }) => {
  // Si pas de données, utiliser des données d'exemple
  const chartData = Object.keys(data).length > 0 ? data : {
    'IT': 8,
    'RH': 4,
    'Finance': 5,
    'Marketing': 6,
    'Ventes': 7
  };

  const departments = Object.keys(chartData);
  const values = Object.values(chartData);
  const total = values.reduce((sum, val) => sum + val, 0);
  const maxValue = Math.max(...values);

  if (departments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <FaUsers className="h-16 w-16 mb-3" />
        <p>Aucun département trouvé</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-3">
        {departments.map((dept, index) => {
          const value = chartData[dept];
          const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
          const barWidth = maxValue > 0 ? (value / maxValue) * 100 : 0;

          return (
            <div key={dept} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-700">{dept}</span>
                <span className="text-gray-600">
                  {value} employé{value > 1 ? 's' : ''} ({percentage}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 text-center text-sm text-gray-500">
        Total: {total} employés
      </div>
    </div>
  );
};

export default EmployeeChart;