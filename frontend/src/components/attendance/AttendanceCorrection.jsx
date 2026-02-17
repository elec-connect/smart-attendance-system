// src/components/attendance/AttendanceCorrection.jsx   
import React, { useState, useEffect } from 'react';
import { 
  FaCalendarAlt, 
  FaEdit, 
  FaTrash, 
  FaCheck, 
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaUser,
  FaDownload,
  FaHistory,
  FaClock,
  FaDoorOpen,
  FaExclamationTriangle,
  FaBan
} from 'react-icons/fa';
import { format, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../services/api';
import { useParams } from 'react-router-dom';

const AttendanceCorrection = () => {
  const { employeeId } = useParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [monthData, setMonthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    checkIn: '',
    checkOut: '',
    status: 'present',
    notes: '',
    shiftName: 'Standard'
  });
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);

  // Fonction pour vérifier si une date est future
 const isFutureDate = (dateString) => {
  const date = new Date(dateString + 'T12:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Une date est future si elle est >= demain
  return date >= tomorrow;
};

  // Fonction pour vérifier si c'est aujourd'hui
  const isTodayDate = (dateString) => {
    const date = new Date(dateString + 'T12:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return date >= today && date < tomorrow;
  };

  // Charger les données du mois
  const loadMonthData = async () => {
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      
      const response = await api.getMonthlyAttendance(employeeId, year, month);
      
      if (response.success) {
        setMonthData(response.data);
        setEmployeeInfo(response.data.employee);
      }
    } catch (error) {
      console.error('Erreur chargement données mensuelles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Charger l'historique des corrections
  const loadHistory = async () => {
    try {
      const response = await api.getCorrectionHistory(employeeId);
      if (response.success) {
        setHistory(response.data);
      }
    } catch (error) {
      console.error('Erreur chargement historique:', error);
    }
  };

  useEffect(() => {
    loadMonthData();
  }, [currentDate, employeeId]);

  // Navigation entre les mois
  const goToPreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  // Sélectionner un jour pour édition
  const handleDaySelect = (dayData) => {
    // Vérifier si c'est une date future
    if (isFutureDate(dayData.date)) {
      alert('❌ Vous ne pouvez pas corriger les dates futures !');
      return;
    }
    
    setSelectedDay(dayData);
    setFormData({
      checkIn: dayData.attendance.checkIn || '',
      checkOut: dayData.attendance.checkOut || '',
      status: dayData.attendance.status,
      notes: dayData.attendance.notes || '',
      shiftName: dayData.attendance.shiftName || 'Standard'
    });
    setEditing(true);
  };

  // Sauvegarder les modifications
  const handleSave = async () => {
    // Vérifier que la date n'est pas future
    if (isFutureDate(selectedDay.date)) {
      alert('❌ Impossible d\'enregistrer un pointage pour une date future !');
      return;
    }
    
    try {
      const data = {
        checkIn: formData.checkIn || null,
        checkOut: formData.checkOut || null,
        date: selectedDay.date,
        status: formData.status,
        notes: formData.notes,
        shiftName: formData.shiftName
      };

      let response;
      
      if (selectedDay.attendance.id) {
        response = await api.updateAttendanceCorrection(selectedDay.attendance.id, data);
      } else {
        response = await api.createAttendanceCorrection({
          employeeId: employeeId,
          ...data
        });
      }

      if (response.success) {
        await loadMonthData();
        setEditing(false);
        setSelectedDay(null);
        alert('Pointage enregistré avec succès !');
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde:', error);
      alert('Erreur lors de la sauvegarde: ' + error.message);
    }
  };

  // Supprimer un pointage
  const handleDelete = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce pointage ?')) {
      return;
    }

    try {
      const response = await api.deleteAttendanceCorrection(selectedDay.attendance.id);
      if (response.success) {
        await loadMonthData();
        if (showHistory) {
          await loadHistory();
        }
        setEditing(false);
        setSelectedDay(null);
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression: ' + error.message);
    }
  };

  // Exporter en CSV
  const handleExport = () => {
    if (!monthData) return;

    const csvContent = [
      ['Date', 'Jour', 'Statut', 'Arrivée', 'Départ', 'Heures', 'Notes'],
      ...monthData.attendanceData.map(day => [
        day.date,
        day.dayOfWeek,
        getStatusLabel(day.attendance.status),
        day.attendance.checkIn || '',
        day.attendance.checkOut || '',
        day.attendance.hoursWorked,
        day.attendance.notes
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pointage_${employeeId}_${format(currentDate, 'yyyy-MM')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Fonctions utilitaires
  const getStatusLabel = (status) => {
    const labels = {
      present: 'Présent',
      absent: 'Absent',
      late: 'En retard',
      checked_out: 'Départ',
      vacation: 'Vacances',
      sick: 'Maladie'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      present: 'bg-green-100 text-green-800 border-green-200',
      absent: 'bg-red-100 text-red-800 border-red-200',
      late: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      checked_out: 'bg-blue-100 text-blue-800 border-blue-200',
      vacation: 'bg-purple-100 text-purple-800 border-purple-200',
      sick: 'bg-pink-100 text-pink-800 border-pink-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getDayColor = (dayData) => {
    if (dayData.isWeekend) return 'bg-gray-50';
    if (dayData.attendance.status === 'absent') return 'bg-red-50';
    if (dayData.attendance.status === 'present' || dayData.attendance.status === 'checked_out') return 'bg-green-50';
    if (dayData.attendance.status === 'late') return 'bg-yellow-50';
    return 'bg-white';
  };

  // CALCULER LES CELLULES VIDES POUR L'ALIGNEMENT DU CALENDRIER
  const getCalendarStartOffset = () => {
    if (!monthData) return 0;
    
    const firstDayDate = new Date(monthData.attendanceData[0]?.date || currentDate);
    const dayOfWeek = firstDayDate.getDay();
    
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-4 text-gray-600">Chargement des données...</span>
      </div>
    );
  }

  if (!monthData) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 text-xl mb-4">Données non disponibles</div>
        <button 
          onClick={loadMonthData}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const startOffset = getCalendarStartOffset();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* En-tête avec informations employé */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border border-blue-200">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mr-4">
              <FaUser className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Correction de Pointage - {employeeInfo?.name}
              </h1>
              <p className="text-gray-600">
                {employeeInfo?.department} • {employeeInfo?.position}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                ID: {employeeInfo?.id} • Dernier mois: {monthData.statistics.presentDays} jours présents
              </p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center"
            >
              <FaDownload className="w-4 h-4 mr-2" />
              Exporter CSV
            </button>
            
            <button
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) loadHistory();
              }}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center"
            >
              <FaHistory className="w-4 h-4 mr-2" />
              Historique
            </button>
          </div>
        </div>
      </div>

      {/* Navigation du mois */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex justify-between items-center">
          <button
            onClick={goToPreviousMonth}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center"
          >
            <FaChevronLeft className="w-4 h-4 mr-2" />
            Mois précédent
          </button>
          
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-800">
              {format(currentDate, 'MMMM yyyy', { locale: fr })}
            </h2>
            <p className="text-sm text-gray-600">
              {monthData.month.startDate} au {monthData.month.endDate}
            </p>
          </div>
          
          <button
            onClick={goToNextMonth}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center"
          >
            Mois suivant
            <FaChevronRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>

      {/* Statistiques du mois */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Jours présents</div>
          <div className="text-2xl font-bold text-green-600">
            {monthData.statistics.presentDays}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Jours absents</div>
          <div className="text-2xl font-bold text-red-600">
            {monthData.statistics.absentDays}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Retards</div>
          <div className="text-2xl font-bold text-yellow-600">
            {monthData.statistics.lateDays}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Heures totales</div>
          <div className="text-2xl font-bold text-blue-600">
            {monthData.statistics.totalHours}h
          </div>
        </div>
      </div>

      {/* Calendrier */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="grid grid-cols-7 gap-1 p-4 bg-gray-50">
          {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(day => (
            <div key={day} className="text-center font-semibold text-gray-700 py-2">
              {day.slice(0, 3)}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1 p-4">
          {/* Cellules vides pour aligner le premier jour du mois */}
          {Array.from({ length: startOffset }).map((_, index) => (
            <div 
              key={`empty-start-${index}`} 
              className="p-3 opacity-20"
            ></div>
          ))}
          
          {/* Jours du mois */}
          {monthData.attendanceData.map((day) => {
            const isFuture = isFutureDate(day.date);
            const isToday = isTodayDate(day.date);
            
            return (
              <div
                key={day.date}
                className={`
                  p-3 border rounded-lg transition-all
                  ${getDayColor(day)}
                  ${day.isWeekend ? 'opacity-75' : ''}
                  ${isFuture ? 'opacity-40 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:shadow-md'}
                  ${isToday ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}
                `}
                onClick={() => {
                  if (!isFuture) {
                    handleDaySelect(day);
                  }
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className={`text-lg font-bold ${isFuture ? 'text-gray-400' : (day.isWeekend ? 'text-blue-600' : 'text-gray-800')}`}>
                      {day.dayNumber}
                      {isToday && <span className="ml-1 text-xs text-blue-600">(Auj)</span>}
                    </div>
                    <div className={`text-xs ${isFuture ? 'text-gray-400' : 'text-gray-500'}`}>
                      {day.dayOfWeek.slice(0, 3)}
                    </div>
                  </div>
                  
                  {/* Indicateur pour les jours futurs */}
                  {isFuture && (
                    <FaBan className="w-3 h-3 text-gray-400" />
                  )}
                  
                  {/* Icône d'édition pour les jours avec pointage (non futurs) */}
                  {!isFuture && day.attendance.hasPointage && (
                    <FaEdit className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                
                {/* Affichage des heures */}
                {day.attendance.checkIn ? (
                  <div className="text-xs space-y-1">
                    <div className="flex items-center text-green-600">
                      <FaClock className="w-3 h-3 mr-1" />
                      {day.attendance.checkIn}
                    </div>
                    {day.attendance.checkOut && (
                      <div className="flex items-center text-blue-600">
                        <FaDoorOpen className="w-3 h-3 mr-1" />
                        {day.attendance.checkOut}
                      </div>
                    )}
                  </div>
                ) : day.attendance.status === 'absent' ? (
                  <div className="text-xs text-red-500">
                    Absent
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">
                    Non pointé
                  </div>
                )}
                
                {/* Badge statut */}
                {day.attendance.status !== 'absent' && (
                  <div className="mt-2">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusColor(day.attendance.status)}`}>
                      {getStatusLabel(day.attendance.status)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Cellules vides à la fin si nécessaire */}
          {(() => {
            const totalCells = startOffset + monthData.attendanceData.length;
            const remainingCells = 42 - totalCells;
            
            if (remainingCells > 0) {
              return Array.from({ length: remainingCells }).map((_, index) => (
                <div 
                  key={`empty-end-${index}`} 
                  className="p-3 opacity-20"
                ></div>
              ));
            }
            return null;
          })()}
        </div>
      </div>

      {/* Modale d'édition */}
      {editing && selectedDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              {/* Avertissement pour dates futures */}
              {isFutureDate(selectedDay.date) && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center text-red-700">
                    <FaExclamationTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Attention : Date future</div>
                      <div className="text-sm mt-1">
                        La correction des dates futures n'est pas autorisée.
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">
                  {selectedDay.attendance.hasPointage ? 'Éditer' : 'Créer'} pointage
                  {isFutureDate(selectedDay.date) && ' (BLOQUÉ)'}
                </h3>
                <button
                  onClick={() => setEditing(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <div className="font-medium">{selectedDay.dayOfWeek} {selectedDay.dayNumber}</div>
                <div className="text-sm text-gray-600">{selectedDay.date}</div>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Arrivée</label>
                    <input
                      type="time"
                      value={formData.checkIn}
                      onChange={(e) => setFormData({...formData, checkIn: e.target.value})}
                      className="w-full p-2 border rounded"
                      disabled={isFutureDate(selectedDay.date)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Départ</label>
                    <input
                      type="time"
                      value={formData.checkOut}
                      onChange={(e) => setFormData({...formData, checkOut: e.target.value})}
                      className="w-full p-2 border rounded"
                      disabled={isFutureDate(selectedDay.date)}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Statut</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full p-2 border rounded"
                    disabled={isFutureDate(selectedDay.date)}
                  >
                    <option value="present">Présent</option>
                    <option value="absent">Absent</option>
                    <option value="late">En retard</option>
                    <option value="checked_out">Départ pointé</option>
                    <option value="vacation">Vacances</option>
                    <option value="sick">Maladie</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full p-2 border rounded"
                    rows="2"
                    placeholder="Raison de l'absence, retard, etc."
                    disabled={isFutureDate(selectedDay.date)}
                  />
                </div>
              </div>
              
              <div className="flex justify-between pt-6 mt-6 border-t">
                {selectedDay.attendance.hasPointage && !isFutureDate(selectedDay.date) && (
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg flex items-center"
                  >
                    <FaTrash className="w-4 h-4 mr-2" />
                    Supprimer
                  </button>
                )}
                
                <div className="flex space-x-2 ml-auto">
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    {isFutureDate(selectedDay.date) ? 'Fermer' : 'Annuler'}
                  </button>
                  
                  {!isFutureDate(selectedDay.date) ? (
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
                    >
                      <FaCheck className="w-4 h-4 mr-2" />
                      Enregistrer
                    </button>
                  ) : (
                    <button
                      disabled
                      className="px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed flex items-center"
                    >
                      <FaBan className="w-4 h-4 mr-2" />
                      Bloqué
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historique des corrections */}
      {showHistory && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Historique des corrections</h3>
            <button
              onClick={() => setShowHistory(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>
          
          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucune correction enregistrée
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((correction, index) => (
                <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">
                        {format(new Date(correction.correctedAt), 'dd/MM/yyyy HH:mm')}
                      </div>
                      <div className="text-sm text-gray-600">
                        Par {correction.correctedBy}
                      </div>
                    </div>
                    <div className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                      Correction
                    </div>
                  </div>
                  
                  <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Avant</div>
                      <div>
                        {correction.original.checkIn ? `Arrivée: ${correction.original.checkIn}` : 'Non pointé'}
                        {correction.original.checkOut && ` | Départ: ${correction.original.checkOut}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Après</div>
                      <div>
                        {correction.new.checkIn ? `Arrivée: ${correction.new.checkIn}` : 'Non pointé'}
                        {correction.new.checkOut && ` | Départ: ${correction.new.checkOut}`}
                      </div>
                    </div>
                  </div>
                  
                  {correction.reason && (
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">Raison:</span> {correction.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceCorrection;