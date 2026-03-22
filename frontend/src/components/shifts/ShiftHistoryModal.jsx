// src/components/shifts/ShiftHistoryModal.jsx
import React from 'react';
import { FaTimes, FaHistory, FaTrash, FaCalendarAlt } from 'react-icons/fa';
import { formatDate } from '../../utils/helpers.jsx';

const ShiftHistoryModal = ({ employee, history, onClose, onDeleteManual }) => {
  const getShiftColor = (shiftName) => {
    if (shiftName?.includes('Matin')) return 'bg-green-100 text-green-800 border-green-200';
    if (shiftName?.includes('Après-midi')) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (shiftName?.includes('Nuit')) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (shiftName?.includes('Standard')) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getShiftIcon = (shiftName) => {
    if (shiftName?.includes('Matin')) return '🌅';
    if (shiftName?.includes('Après-midi')) return '☀️';
    if (shiftName?.includes('Nuit')) return '🌙';
    return '🕒';
  };

  // Grouper par année/semaine
  const groupedHistory = history.reduce((acc, item) => {
    const key = `${item.year}-S${item.week_number}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 sticky top-0 bg-white pb-2 border-b">
          <h3 className="text-xl font-bold flex items-center">
            <FaHistory className="mr-2 text-primary-600" />
            Historique des shifts
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 transition-colors p-2"
          >
            <FaTimes />
          </button>
        </div>

        {/* Informations employé */}
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="font-medium text-blue-900">
            {employee.firstName} {employee.lastName}
          </p>
          <p className="text-sm text-blue-700">
            {employee.employeeId} • {employee.department}
          </p>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FaHistory className="mx-auto text-4xl mb-3 text-gray-300" />
            <p>Aucun historique de shift manuel</p>
            <p className="text-sm mt-2">
              Les shifts automatiques n'apparaissent pas dans l'historique.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedHistory).map(([key, items]) => (
              <div key={key} className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b flex items-center">
                  <FaCalendarAlt className="text-gray-400 mr-2" />
                  <span className="font-medium text-sm">{key.replace('-', ' - ')}</span>
                </div>
                <div className="divide-y">
                  {items.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getShiftColor(item.shift_name)}`}>
                              <span className="mr-1">{getShiftIcon(item.shift_name)}</span>
                              {item.shift_name}
                            </span>
                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                              Manuel
                            </span>
                          </div>
                          
                          <div className="text-sm text-gray-600 space-y-1">
                            <p>
                              <span className="font-medium">Période:</span>{' '}
                              Du {formatDate(item.start_date)} au {formatDate(item.end_date)}
                            </p>
                            {item.created_by && (
                              <p className="text-xs text-gray-500">
                                Assigné par: {item.created_by} le {formatDate(item.created_at)}
                              </p>
                            )}
                            {item.reason && (
                              <p className="text-xs text-gray-500 mt-1 italic">
                                "{item.reason}"
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => {
                            if (window.confirm('Supprimer cette assignation manuelle ?\n\nLe retour au cycle automatique se fera automatiquement.')) {
                              onDeleteManual(item.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors ml-4"
                          title="Supprimer cette assignation"
                        >
                          <FaTrash size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end sticky bottom-0 bg-white pt-4 border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftHistoryModal;