import React from 'react';

const StatCard = ({ title, value, icon: Icon, color = 'primary', loading = false }) => {
  const colorClasses = {
    primary: 'bg-blue-100 text-blue-600',
    success: 'bg-green-100 text-green-600',
    danger: 'bg-red-100 text-red-600',
    warning: 'bg-yellow-100 text-yellow-600',
    info: 'bg-cyan-100 text-cyan-600',
    purple: 'bg-purple-100 text-purple-600'
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          {loading ? (
            <div className="mt-2 flex items-center">
              <div className="animate-pulse bg-gray-200 h-8 w-20 rounded"></div>
              <span className="ml-2 text-xs text-yellow-600">Chargement...</span>
            </div>
          ) : (
            <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
          )}
        </div>
        <div className={`${colorClasses[color]} p-3 rounded-full`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      {loading && (
        <div className="mt-3 text-xs text-yellow-600">
          ⚠️ Données temporairement indisponibles
        </div>
      )}
    </div>
  );
};

export default StatCard;