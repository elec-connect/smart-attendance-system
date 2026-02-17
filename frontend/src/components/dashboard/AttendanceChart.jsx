import React from 'react';
import { FaChartBar } from 'react-icons/fa';

const AttendanceChart = ({ data = [] }) => {
  // Si pas de données, afficher un message
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <FaChartBar className="h-16 w-16 mb-3" />
        <p>Aucune donnée disponible</p>
        <p className="text-sm mt-1">Les statistiques de présence seront disponibles</p>
        <p className="text-sm">une fois la route /attendance/stats implémentée</p>
      </div>
    );
  }

  // Logique simple de chart (à remplacer par une vraie librairie de charts si nécessaire)
  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
  const sampleData = [65, 59, 80, 81, 56]; // Données d'exemple

  const maxValue = Math.max(...sampleData);

  return (
    <div className="h-64">
      <div className="flex items-end justify-between h-48 mt-4">
        {sampleData.map((value, index) => (
          <div key={index} className="flex flex-col items-center flex-1 mx-1">
            <div
              className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
              style={{ height: `${(value / maxValue) * 100}%` }}
              title={`${value}%`}
            ></div>
            <span className="mt-2 text-xs text-gray-600">{days[index]}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 text-center text-sm text-gray-500">
        Tendance des présences cette semaine
      </div>
    </div>
  );
};

export default AttendanceChart;