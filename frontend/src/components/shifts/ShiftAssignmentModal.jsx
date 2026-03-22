// src/components/shifts/ShiftAssignmentModal.jsx
import React, { useState } from 'react';
import { FaTimes, FaCalendarAlt, FaSave, FaUndo, FaInfoCircle } from 'react-icons/fa';
import Button from '../ui/Button.jsx';

const ShiftAssignmentModal = ({ 
  employee, 
  shiftInfo, 
  availableShifts, 
  onClose, 
  onSave 
}) => {
  const [selectedShift, setSelectedShift] = useState(
    shiftInfo?.current?.shiftName || employee?.shiftName || 'Shift Standard'
  );
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeekNumber());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [assignmentType, setAssignmentType] = useState('manual');

  const weeks = Array.from({ length: 52 }, (_, i) => i + 1);
  const years = [2025, 2026, 2027, 2028];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (assignmentType === 'manual') {
        await onSave({
          shiftName: selectedShift,
          weekNumber: selectedWeek,
          year: selectedYear,
          reason,
          type: 'manual'
        });
      } else {
        await onSave({
          shiftName: selectedShift,
          type: 'permanent',
          reason: reason || 'Modification permanente du shift'
        });
      }
      onClose();
    } catch (error) {
      console.error('❌ Erreur sauvegarde:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetToAuto = async () => {
    if (window.confirm('Retour au cycle automatique pour cette semaine ?')) {
      setLoading(true);
      try {
        await onSave({
          resetToAuto: true,
          weekNumber: selectedWeek,
          year: selectedYear,
          type: 'reset'
        });
        onClose();
      } catch (error) {
        console.error('❌ Erreur reset:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const getCurrentShiftDisplay = () => {
    const current = shiftInfo?.current;
    if (!current) return employee?.shiftName || 'Shift Standard';
    
    return (
      <div className="flex items-center">
        <span className="font-medium">{current.shiftName}</span>
        {current.source === 'manual' && (
          <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
            Manuel
          </span>
        )}
        {current.source === 'automatic' && (
          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
            Auto
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold flex items-center">
            <FaCalendarAlt className="mr-2 text-primary-600" />
            Gestion du shift
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <FaTimes />
          </button>
        </div>

        {/* Informations employé */}
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-blue-800 font-medium mb-1">
            {employee.firstName} {employee.lastName}
          </p>
          <p className="text-xs text-blue-600">
            {employee.employeeId} • {employee.department}
          </p>
        </div>

        {/* Informations actuelles */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-gray-600 mb-2 flex items-center">
            <FaInfoCircle className="mr-1 text-gray-400" />
            Shift actuel (cette semaine):
          </p>
          <div className="flex items-center justify-between">
            {getCurrentShiftDisplay()}
            <span className="text-xs text-gray-500">
              Semaine {shiftInfo?.current?.weekNumber || getCurrentWeekNumber()} - {shiftInfo?.current?.year || new Date().getFullYear()}
            </span>
          </div>
          {shiftInfo?.current?.source === 'automatic' && shiftInfo?.current?.nextShift && (
            <p className="text-xs text-gray-500 mt-2">
              Prochain shift: {shiftInfo.current.nextShift}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type d'assignation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type d'assignation
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="manual"
                  checked={assignmentType === 'manual'}
                  onChange={(e) => setAssignmentType(e.target.value)}
                  className="mr-2"
                  disabled={loading}
                />
                <span className="text-sm">Semaine spécifique</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="permanent"
                  checked={assignmentType === 'permanent'}
                  onChange={(e) => setAssignmentType(e.target.value)}
                  className="mr-2"
                  disabled={loading}
                />
                <span className="text-sm">Configuration permanente</span>
              </label>
            </div>
          </div>

          {assignmentType === 'manual' ? (
            <>
              {/* Sélection de la semaine */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Semaine
                  </label>
                  <select
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    disabled={loading}
                  >
                    {weeks.map(w => (
                      <option key={w} value={w}>Semaine {w}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Année
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    disabled={loading}
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-700">
                ⚙️ Modifier la configuration de départ changera le cycle pour toutes les semaines futures.
              </p>
            </div>
          )}

          {/* Sélection du shift */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shift à assigner
            </label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              disabled={loading}
            >
              {availableShifts.map(shift => (
                <option key={shift.key} value={shift.name}>
                  {shift.name} ({shift.start} - {shift.end})
                </option>
              ))}
            </select>
          </div>

          {/* Raison (optionnel) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Raison (optionnel)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Ex: Congés, Formation, Remplacement, etc."
              disabled={loading}
            />
          </div>

          {/* Boutons d'action */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            {assignmentType === 'manual' && (
              <Button
                type="button"
                variant="outline"
                onClick={handleResetToAuto}
                disabled={loading}
                className="flex items-center"
              >
                <FaUndo className="mr-2" />
                Retour auto
              </Button>
            )}
            
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Annuler
            </Button>
            
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="flex items-center"
            >
              <FaSave className="mr-2" />
              {assignmentType === 'manual' ? 'Assigner' : 'Modifier permanent'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Fonction utilitaire pour obtenir le numéro de semaine actuel
function getCurrentWeekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now - start;
  const oneWeek = 604800000;
  return Math.floor(diff / oneWeek) + 1;
}

export default ShiftAssignmentModal;