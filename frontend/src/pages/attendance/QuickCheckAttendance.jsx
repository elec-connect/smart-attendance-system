// src/pages/attendance/QuickCheckAttendance.jsx - VERSION CORRIGÉE (Solution 3)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth.jsx';
import { employeeService, attendanceService } from '../../services/api.jsx';
import {
  FaClock,
  FaSearch,
  FaUserCheck,
  FaUserTimes,
  FaCalendarAlt,
  FaTimes,
  FaCheckCircle,
  FaExclamationTriangle,
  FaArrowLeft,
  FaSync,
  FaIdCard,
  FaEnvelope,
  FaPhone,
  FaBuilding,
  FaBriefcase,
  FaDoorOpen,
  FaDoorClosed,
  FaHistory,
  FaUserCircle,
  FaCalendarDay,
  FaStopwatch,
  FaPlusCircle,
  FaMinusCircle,
  FaCommentAlt,
  FaPaperPlane,
  FaEdit,
  FaTrash,
  FaCog,
  FaList,
  FaUserClock,
  FaUsers,
  FaRedo,
  FaInfoCircle,
  FaExclamationCircle,
  FaCheck,
  FaTimesCircle
} from 'react-icons/fa';

const QuickCheckAttendance = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // États principaux
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [actionType, setActionType] = useState('checkin');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetEmployee, setResetEmployee] = useState(null);
  
  // NOUVEAU : État pour suivre le statut de chaque employé
  const [attendanceStatus, setAttendanceStatus] = useState({});
  
  // Vérifier si l'utilisateur est admin
  const isAdmin = user?.role === 'admin';
  
  // Vérifier les permissions
  useEffect(() => {
    if (!isAdmin) {
      toast.error('Accès réservé aux administrateurs');
      navigate('/dashboard');
    }
  }, [isAdmin, navigate]);

  // Charger les données
  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  // NOUVEAU : Fonction pour rafraîchir le statut d'un employé
  const refreshEmployeeStatus = async (employeeId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await attendanceService.getAttendance({ 
        employeeId: employeeId, 
        date: today 
      });
      
      const attendanceData = response.data || [];
      const todayRecord = attendanceData.find(a => a.date === today);
      
      setAttendanceStatus(prev => ({
        ...prev,
        [employeeId]: {
          hasCheckIn: !!todayRecord?.checkIn,
          hasCheckOut: !!todayRecord?.checkOut,
          checkInTime: todayRecord?.checkIn || null,
          checkOutTime: todayRecord?.checkOut || null,
          fullRecord: todayRecord || null
        }
      }));
      
      return todayRecord;
    } catch (error) {
      console.error('❌ Erreur rafraîchissement statut:', error);
      return null;
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Charger les employés
      const employeesResponse = await employeeService.getAllEmployees();
      const employeesData = employeesResponse.data || [];
      setEmployees(employeesData);
      setFilteredEmployees(employeesData);
      
      // Charger les pointages d'aujourd'hui
      const attendanceResponse = await attendanceService.getAttendance({ 
        date: selectedDate,
        limit: 100 
      });
      const attendanceData = attendanceResponse.data || [];
      setTodayAttendance(attendanceData);
      
      // NOUVEAU : Initialiser le statut de chaque employé
      const statusMap = {};
      employeesData.forEach(employee => {
        const employeeId = employee.employeeId || employee.id;
        const attendance = attendanceData.find(a => 
          a.employeeId === employeeId || a.employee_id === employeeId
        );
        
        statusMap[employeeId] = {
          hasCheckIn: !!attendance?.checkIn,
          hasCheckOut: !!attendance?.checkOut,
          checkInTime: attendance?.checkIn || null,
          checkOutTime: attendance?.checkOut || null,
          fullRecord: attendance || null
        };
      });
      
      setAttendanceStatus(statusMap);
      
    } catch (error) {
      console.error('❌ Erreur chargement données:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // Recherche d'employés
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredEmployees(employees);
      return;
    }
    
    const term = searchTerm.toLowerCase().trim();
    const filtered = employees.filter(emp => {
      const searchFields = [
        emp.firstName || '',
        emp.lastName || '',
        emp.email || '',
        emp.employeeId || '',
        emp.phone || '',
        emp.department || '',
        emp.position || ''
      ].map(field => field.toLowerCase());
      
      return searchFields.some(field => field.includes(term));
    });
    
    setFilteredEmployees(filtered);
  }, [searchTerm, employees]);

  // NOUVEAU : Obtenir le statut actuel d'un employé
  const getEmployeeCurrentStatus = (employeeId) => {
    return attendanceStatus[employeeId] || {
      hasCheckIn: false,
      hasCheckOut: false,
      checkInTime: null,
      checkOutTime: null,
      fullRecord: null
    };
  };

  // NOUVEAU : Vérification avant pointage d'arrivée
  const canCheckIn = (employeeId) => {
    const status = getEmployeeCurrentStatus(employeeId);
    
    // Ne peut pointer l'arrivée que si :
    // 1. Pas encore pointé l'arrivée aujourd'hui
    // 2. Ou si l'arrivée est pointée mais le départ aussi (pour réinitialisation)
    if (!status.hasCheckIn) {
      return { allowed: true, reason: '' };
    } else if (status.hasCheckOut) {
      return { 
        allowed: false, 
        reason: 'Pointage complet déjà effectué. Voulez-vous réinitialiser ?' 
      };
    } else {
      return { 
        allowed: false, 
        reason: 'Arrivée déjà pointée aujourd\'hui. Vous pouvez pointer le départ.' 
      };
    }
  };

  // NOUVEAU : Vérification avant pointage de départ
  const canCheckOut = (employeeId) => {
    const status = getEmployeeCurrentStatus(employeeId);
    
    // Ne peut pointer le départ que si :
    // 1. A déjà pointé l'arrivée
    // 2. N'a pas encore pointé le départ
    if (!status.hasCheckIn) {
      return { allowed: false, reason: 'Aucune arrivée pointée aujourd\'hui' };
    } else if (status.hasCheckOut) {
      return { allowed: false, reason: 'Départ déjà pointé aujourd\'hui' };
    } else {
      return { allowed: true, reason: '' };
    }
  };

  // Fonction pour réinitialiser le pointage
  const handleResetAttendance = async (employeeId, employeeName) => {
    try {
      setSubmitting(true);
      
      const response = await attendanceService.resetTodayAttendance(employeeId);
      
      if (response.success) {
        toast.success(`✅ Pointage réinitialisé pour ${employeeName}`);
        
        // Rafraîchir le statut de cet employé
        await refreshEmployeeStatus(employeeId);
        
        // Rafraîchir toutes les données
        fetchData();
        
        setShowResetConfirm(false);
        setResetEmployee(null);
        
        // Si un employé était sélectionné, on le désélectionne
        if (selectedEmployee && (selectedEmployee.employeeId === employeeId || selectedEmployee.id === employeeId)) {
          setSelectedEmployee(null);
        }
      } else {
        toast.error(response.message || 'Erreur lors de la réinitialisation');
      }
    } catch (error) {
      console.error('❌ Erreur réinitialisation:', error);
      toast.error('Erreur lors de la réinitialisation du pointage');
    } finally {
      setSubmitting(false);
    }
  };

  // Gérer le pointage avec vérifications
  const handleCheckAction = async () => {
    if (!selectedEmployee) {
      toast.error('Veuillez sélectionner un employé');
      return;
    }

    const employeeId = selectedEmployee.employeeId || selectedEmployee.id;
    const employeeName = `${selectedEmployee.firstName} ${selectedEmployee.lastName}`;
    
    // NOUVEAU : Vérification avant l'action
    let checkResult;
    if (actionType === 'checkin') {
      checkResult = canCheckIn(employeeId);
    } else {
      checkResult = canCheckOut(employeeId);
    }
    
    // Si non autorisé, afficher le message et proposer la réinitialisation si nécessaire
    if (!checkResult.allowed) {
      toast.error(checkResult.reason);
      
      // Si c'est un checkin et que le pointage est complet, proposer la réinitialisation
      if (actionType === 'checkin' && checkResult.reason.includes('Pointage complet')) {
        const status = getEmployeeCurrentStatus(employeeId);
        setResetEmployee({
          id: employeeId,
          name: employeeName,
          attendance: status.fullRecord
        });
        setShowResetConfirm(true);
      }
      return;
    }

    try {
      setSubmitting(true);
      
      const checkData = {
        employeeId: employeeId,
        type: actionType,
        notes: notes.trim() || null,
        timestamp: new Date().toISOString(),
        manual: true,
        performedBy: user.email
      };
      
      let response;
      
      if (actionType === 'checkin') {
        response = await attendanceService.checkIn(checkData);
      } else {
        response = await attendanceService.checkOut(checkData);
      }
      
      if (response.success) {
        toast.success(
          actionType === 'checkin' 
            ? `✅ Arrivée pointée pour ${employeeName}`
            : `✅ Départ pointé pour ${employeeName}`
        );
        
        // Rafraîchir le statut de cet employé
        await refreshEmployeeStatus(employeeId);
        
        // Rafraîchir toutes les données
        fetchData();
        
        // Réinitialiser
        setSelectedEmployee(null);
        setNotes('');
      } else {
        toast.error(response.message || 'Erreur lors du pointage');
      }
      
    } catch (error) {
      console.error('❌ Erreur pointage:', error);
      
      // Gestion spécifique des erreurs
      if (error.message && (
        error.message.includes('déjà pointé') || 
        error.message.includes('déjà effectué') ||
        error.message.includes('Pointage complet')
      )) {
        const status = getEmployeeCurrentStatus(employeeId);
        setResetEmployee({
          id: employeeId,
          name: employeeName,
          attendance: status.fullRecord
        });
        setShowResetConfirm(true);
      } else {
        toast.error('Erreur lors du pointage manuel');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Formater l'heure
  const formatTime = (timeStr) => {
    if (!timeStr) return '--:--';
    try {
      return timeStr.substring(0, 5);
    } catch {
      return timeStr;
    }
  };

  // Rendu du modal de confirmation de réinitialisation
  const renderResetConfirmModal = () => {
    if (!showResetConfirm || !resetEmployee) return null;
    
    const { name, attendance } = resetEmployee;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-md w-full p-6">
          <div className="flex items-center gap-3 mb-4">
            <FaExclamationCircle className="h-6 w-6 text-yellow-500" />
            <h3 className="text-lg font-bold text-gray-900">Pointage déjà effectué</h3>
          </div>
          
          <div className="space-y-4">
            <p className="text-gray-700">
              <strong>{name}</strong> a déjà effectué son pointage aujourd'hui :
            </p>
            
            {attendance && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm text-gray-500">Arrivée</p>
                    <p className="font-medium text-green-600">
                      {formatTime(attendance.checkIn) || '--:--'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Départ</p>
                    <p className="font-medium text-blue-600">
                      {formatTime(attendance.checkOut) || '--:--'}
                    </p>
                  </div>
                </div>
                {attendance.notes && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-500">Notes</p>
                    <p className="text-sm text-gray-700">{attendance.notes}</p>
                  </div>
                )}
              </div>
            )}
            
            <p className="text-gray-600">
              Voulez-vous réinitialiser ce pointage pour en créer un nouveau ?
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetEmployee(null);
                }}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Annuler
              </button>
              
              <button
                onClick={() => handleResetAttendance(resetEmployee.id, resetEmployee.name)}
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Traitement...
                  </>
                ) : (
                  <>
                    <FaRedo className="h-4 w-4" />
                    Réinitialiser et pointer
                  </>
                )}
              </button>
            </div>
            
            <p className="text-xs text-gray-500 text-center mt-4">
              Cette action supprimera le pointage existant et créera un nouveau pointage.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // NOUVEAU : Rendu du bouton avec vérification
  const renderActionButton = () => {
    if (!selectedEmployee) return null;
    
    const employeeId = selectedEmployee.employeeId || selectedEmployee.id;
    let canProceed = false;
    let buttonText = '';
    let buttonColor = '';
    let icon = null;
    
    if (actionType === 'checkin') {
      const checkResult = canCheckIn(employeeId);
      canProceed = checkResult.allowed;
      buttonText = 'Pointer l\'arrivée';
      buttonColor = 'bg-green-500 hover:bg-green-600';
      icon = <FaPlusCircle className="h-5 w-5" />;
      
      if (!canProceed) {
        return (
          <div className="space-y-3">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <FaExclamationTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">{checkResult.reason}</p>
                  {checkResult.reason.includes('Pointage complet') && (
                    <button
                      onClick={() => {
                        const status = getEmployeeCurrentStatus(employeeId);
                        setResetEmployee({
                          id: employeeId,
                          name: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
                          attendance: status.fullRecord
                        });
                        setShowResetConfirm(true);
                      }}
                      className="mt-2 text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                    >
                      <FaRedo className="h-3 w-3" />
                      Réinitialiser le pointage
                    </button>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleCheckAction}
              disabled={true}
              className="w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 bg-gray-300 text-gray-500 cursor-not-allowed"
            >
              <FaTimesCircle className="h-5 w-5" />
              Non disponible
            </button>
          </div>
        );
      }
    } else {
      const checkResult = canCheckOut(employeeId);
      canProceed = checkResult.allowed;
      buttonText = 'Pointer le départ';
      buttonColor = 'bg-red-500 hover:bg-red-600';
      icon = <FaMinusCircle className="h-5 w-5" />;
      
      if (!canProceed) {
        return (
          <div className="space-y-3">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <FaExclamationTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium text-yellow-800">{checkResult.reason}</p>
              </div>
            </div>
            <button
              onClick={handleCheckAction}
              disabled={true}
              className="w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 bg-gray-300 text-gray-500 cursor-not-allowed"
            >
              <FaTimesCircle className="h-5 w-5" />
              Non disponible
            </button>
          </div>
        );
      }
    }
    
    return (
      <button
        onClick={handleCheckAction}
        disabled={submitting}
        className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 text-white transition-colors ${
          submitting ? 'opacity-70 cursor-not-allowed' : buttonColor
        }`}
      >
        {submitting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Traitement en cours...
          </>
        ) : (
          <>
            {icon}
            {buttonText}
          </>
        )}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600 font-medium ml-4">Chargement du pointage...</p>
      </div>
    );
  }

  return (
    <>
      {renderResetConfirmModal()}
      
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              title="Retour"
            >
              <FaArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <FaUserClock className="text-blue-600" />
                Pointage Manuel Rapide
              </h1>
              <p className="text-gray-600 mt-1 flex items-center gap-2">
                <FaCalendarDay className="h-4 w-4" />
                {new Date(selectedDate).toLocaleDateString('fr-FR', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-2"
            >
              <FaHistory className="h-4 w-4" />
              {showHistory ? 'Cacher l\'historique' : 'Voir l\'historique'}
            </button>
            <button
              onClick={fetchData}
              disabled={submitting}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-70"
            >
              <FaSync className={`h-4 w-4 ${submitting ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </div>

        {/* Panneau d'action principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Section de sélection et action */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recherche employés */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FaSearch className="text-blue-500" />
                Rechercher un employé
              </h3>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nom, prénom, ID, email..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {filteredEmployees.length} employé{filteredEmployees.length !== 1 ? 's' : ''} trouvé{filteredEmployees.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Liste des employés */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FaUsers className="text-blue-500" />
                  Liste des employés
                </h3>
              </div>
              
              <div className="divide-y divide-gray-200 max-h-[500px] overflow-y-auto">
                {filteredEmployees.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <FaUserTimes className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>Aucun employé trouvé</p>
                    <p className="text-sm mt-1">{searchTerm && `pour "${searchTerm}"`}</p>
                  </div>
                ) : (
                  filteredEmployees.map(employee => {
                    const employeeId = employee.employeeId || employee.id;
                    const status = getEmployeeCurrentStatus(employeeId);
                    
                    return (
                      <div
                        key={employee.id}
                        className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                          selectedEmployee?.id === employee.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                        }`}
                        onClick={() => setSelectedEmployee(employee)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                              {(employee.firstName?.charAt(0) || '')}{(employee.lastName?.charAt(0) || '')}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">
                                {employee.firstName} {employee.lastName}
                              </div>
                              <div className="text-sm text-gray-500 flex items-center gap-2">
                                <FaIdCard className="h-3 w-3" />
                                {employee.employeeId || employee.id}
                                <span className="text-gray-300">•</span>
                                <FaBriefcase className="h-3 w-3" />
                                {employee.position || 'Non spécifié'}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              {status.hasCheckIn && !status.hasCheckOut && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <FaDoorOpen className="h-3 w-3 mr-1" />
                                  Présent
                                </span>
                              )}
                              {status.hasCheckIn && status.hasCheckOut && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                  <FaDoorClosed className="h-3 w-3 mr-1" />
                                  Sorti
                                </span>
                              )}
                              {!status.hasCheckIn && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  <FaUserTimes className="h-3 w-3 mr-1" />
                                  Absent
                                </span>
                              )}
                            </div>
                            
                            {status.hasCheckIn && (
                              <div className="text-xs text-gray-500 mt-1 space-y-1">
                                <div className="flex gap-2">
                                  {status.checkInTime && (
                                    <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded">
                                      Arrivée: {formatTime(status.checkInTime)}
                                    </span>
                                  )}
                                  {status.checkOutTime && (
                                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                                      Départ: {formatTime(status.checkOutTime)}
                                    </span>
                                  )}
                                </div>
                                {status.fullRecord?.notes && (
                                  <div className="text-gray-600 truncate max-w-[200px]" title={status.fullRecord.notes}>
                                    📝 {status.fullRecord.notes}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Bouton de réinitialisation rapide */}
                        {status.hasCheckIn && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setResetEmployee({
                                  id: employeeId,
                                  name: `${employee.firstName} ${employee.lastName}`,
                                  attendance: status.fullRecord
                                });
                                setShowResetConfirm(true);
                              }}
                              className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                              title="Réinitialiser le pointage"
                            >
                              <FaRedo className="h-3 w-3" />
                              Réinitialiser le pointage
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Panneau d'action */}
          <div className="space-y-6">
            {/* Sélection de l'action */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FaCog className="text-blue-500" />
                Type de pointage
              </h3>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => setActionType('checkin')}
                  disabled={submitting}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                    actionType === 'checkin' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                  } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <FaPlusCircle className={`h-6 w-6 mb-2 ${
                    actionType === 'checkin' ? 'text-green-600' : 'text-gray-500'
                  }`} />
                  <span className={`font-medium ${
                    actionType === 'checkin' ? 'text-green-700' : 'text-gray-700'
                  }`}>Arrivée</span>
                </button>
                
                <button
                  onClick={() => setActionType('checkout')}
                  disabled={submitting}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                    actionType === 'checkout' 
                      ? 'border-red-500 bg-red-50' 
                      : 'border-gray-200 hover:border-red-300 hover:bg-red-50'
                  } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <FaMinusCircle className={`h-6 w-6 mb-2 ${
                    actionType === 'checkout' ? 'text-red-600' : 'text-gray-500'
                  }`} />
                  <span className={`font-medium ${
                    actionType === 'checkout' ? 'text-red-700' : 'text-gray-700'
                  }`}>Départ</span>
                </button>
              </div>
              
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <FaInfoCircle className="h-4 w-4 text-blue-500" />
                {actionType === 'checkin' 
                  ? 'Pointer l\'arrivée d\'un employé' 
                  : 'Pointer le départ d\'un employé'}
              </div>
            </div>

            {/* Employé sélectionné */}
            {selectedEmployee ? (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FaUserCircle className="text-blue-500" />
                  Employé sélectionné
                </h3>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                      {(selectedEmployee.firstName?.charAt(0) || '')}{(selectedEmployee.lastName?.charAt(0) || '')}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">
                        {selectedEmployee.firstName} {selectedEmployee.lastName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {selectedEmployee.position || 'Non spécifié'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <FaIdCard className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">ID:</span>
                      <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                        {selectedEmployee.employeeId || selectedEmployee.id}
                      </code>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <FaEnvelope className="h-4 w-4 text-gray-400" />
                      <span className="truncate">{selectedEmployee.email || 'N/A'}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <FaPhone className="h-4 w-4 text-gray-400" />
                      <span>{selectedEmployee.phone || 'N/A'}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <FaBuilding className="h-4 w-4 text-gray-400" />
                      <span>{selectedEmployee.department || 'Non spécifié'}</span>
                    </div>
                  </div>
                  
                  {/* Statut actuel */}
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Statut aujourd'hui:</span>
                      {(() => {
                        const employeeId = selectedEmployee.employeeId || selectedEmployee.id;
                        const status = getEmployeeCurrentStatus(employeeId);
                        
                        if (status.hasCheckIn && !status.hasCheckOut) {
                          return (
                            <div className="text-right">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <FaDoorOpen className="h-3 w-3 mr-1" />
                                Présent
                              </span>
                              {status.checkInTime && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Arrivé à {formatTime(status.checkInTime)}
                                </div>
                              )}
                            </div>
                          );
                        } else if (status.hasCheckIn && status.hasCheckOut) {
                          return (
                            <div className="text-right">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                <FaDoorClosed className="h-3 w-3 mr-1" />
                                Sorti
                              </span>
                              {status.checkInTime && status.checkOutTime && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {formatTime(status.checkInTime)} → {formatTime(status.checkOutTime)}
                                </div>
                              )}
                            </div>
                          );
                        } else {
                          return (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              <FaUserTimes className="h-3 w-3 mr-1" />
                              Non pointé
                            </span>
                          );
                        }
                      })()}
                    </div>
                  </div>
                  
                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                      <FaCommentAlt className="h-4 w-4" />
                      Notes (optionnel)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Raison du pointage manuel..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      rows="3"
                    />
                  </div>
                  
                  {/* Bouton d'action avec vérification */}
                  {renderActionButton()}
                  
                  {/* Annuler la sélection */}
                  <button
                    onClick={() => setSelectedEmployee(null)}
                    className="w-full py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
                  >
                    Changer d'employé
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <FaUserCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">Sélectionnez un employé</p>
                <p className="text-sm text-gray-500 mt-1">
                  Cliquez sur un employé dans la liste pour effectuer un pointage
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Historique du jour */}
        {showHistory && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <FaHistory className="text-blue-500" />
                Pointages d'aujourd'hui ({todayAttendance.length})
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Arrivée</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Départ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durée</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {todayAttendance.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                        Aucun pointage aujourd'hui
                      </td>
                    </tr>
                  ) : (
                    todayAttendance.map(record => {
                      // Trouver l'employé
                      const employee = employees.find(emp => 
                        emp.employeeId === (record.employeeId || record.employee_id)
                      );
                      
                      // Calculer la durée
                      const calculateDuration = (checkIn, checkOut) => {
                        if (!checkIn || !checkOut) return '--';
                        try {
                          const [inHour, inMinute] = checkIn.split(':').map(Number);
                          const [outHour, outMinute] = checkOut.split(':').map(Number);
                          const totalMinutes = (outHour * 60 + outMinute) - (inHour * 60 + inMinute);
                          if (totalMinutes <= 0) return '--';
                          const hours = Math.floor(totalMinutes / 60);
                          const minutes = totalMinutes % 60;
                          return `${hours}h${minutes.toString().padStart(2, '0')}`;
                        } catch {
                          return '--';
                        }
                      };
                      
                      const duration = calculateDuration(record.checkIn, record.checkOut);
                      
                      return (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs mr-3">
                                {(employee?.firstName?.charAt(0) || '')}{(employee?.lastName?.charAt(0) || '')}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {employee ? `${employee.firstName} ${employee.lastName}` : `Employé ${record.employeeId}`}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {employee?.employeeId || record.employeeId}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium text-green-600">
                              {formatTime(record.checkIn) || '--:--'}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium text-blue-600">
                              {formatTime(record.checkOut) || '--:--'}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-700">
                              {duration}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              record.checkIn && !record.checkOut
                                ? 'bg-yellow-100 text-yellow-800'
                                : record.checkIn && record.checkOut
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {record.checkIn && !record.checkOut ? 'Présent' : 
                               record.checkIn && record.checkOut ? 'Terminé' : 'Non pointé'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setResetEmployee({
                                  id: record.employeeId || record.employee_id,
                                  name: employee ? `${employee.firstName} ${employee.lastName}` : `Employé ${record.employeeId}`,
                                  attendance: record
                                });
                                setShowResetConfirm(true);
                              }}
                              className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                              title="Réinitialiser ce pointage"
                            >
                              <FaRedo className="h-3 w-3" />
                              Réinitialiser
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default QuickCheckAttendance;