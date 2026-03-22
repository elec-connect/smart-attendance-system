import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { ExportService } from '../services/exportService';
import { useAuth } from '../hooks/useAuth';
import { 
  FaSearch, 
  FaSync, 
  FaFilePdf,
  FaSpinner,
  FaUser, 
  FaEnvelope,
  FaUserClock,
  FaSignInAlt,
  FaSignOutAlt,
  FaCalendarAlt
} from 'react-icons/fa';

const AttendancePage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isManager, isEmployee } = useAuth();
  
  const [attendance, setAttendance] = useState([]);
  const [filteredAttendance, setFilteredAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // États pour les filtres handleExportPDF 
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date()
  });
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Début chargement des données...');
      
      const [attendanceResponse, employeesResponse] = await Promise.all([
        api.getAttendance({ 
          limit: 100,
          startDate: dateRange.start.toISOString().split('T')[0],
          endDate: dateRange.end.toISOString().split('T')[0]
        }),
        api.getAllEmployees()
      ]);

      console.log('📊 Données chargées:', {
        attendanceCount: attendanceResponse.data?.length || 0,
        employeesCount: employeesResponse.data?.length || 0
      });

      // Debug: Afficher les premiers employés
      if (employeesResponse.data?.length > 0) {
        console.log('👥 Premier employé:', {
          id: employeesResponse.data[0].id,
          employee_id: employeesResponse.data[0].employee_id,
          first_name: employeesResponse.data[0].first_name,
          last_name: employeesResponse.data[0].last_name,
          email: employeesResponse.data[0].email,
          phone: employeesResponse.data[0].phone
        });
      }

      setAttendance(attendanceResponse.data || []);
      setEmployees(employeesResponse.data || []);
      
    } catch (err) {
      console.error('❌ Erreur lors du chargement des données:', err);
      setError('Impossible de charger les données. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  // Fonction pour trouver un employé
  const findEmployee = (employeeCode) => {
    if (!employeeCode || employees.length === 0) return null;
    
    // Essayer plusieurs clés possibles
    return employees.find(emp => {
      // Vérifier toutes les clés possibles pour l'ID
      const possibleIds = [
        emp.employee_id,
        emp.employeeId,
        emp.id,
        emp.employeeNumber,
        emp.code
      ];
      
      return possibleIds.some(id => id && id.toString() === employeeCode.toString());
    });
  };

  // Fonction pour obtenir le nom d'un employé
  const getEmployeeName = (employeeCode) => {
    const employee = findEmployee(employeeCode);
    
    if (!employee) {
      console.warn('⚠️ Employé non trouvé:', employeeCode);
      return `Employé ${employeeCode}`;
    }
    
    // Essayer plusieurs formats de nom
    const firstName = employee.first_name || employee.firstName || employee.nom || '';
    const lastName = employee.last_name || employee.lastName || employee.prenom || '';
    
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || `Employé ${employeeCode}`;
  };

  // Fonction pour obtenir l'email d'un employé
  const getEmployeeEmail = (employeeCode) => {
    const employee = findEmployee(employeeCode);
    if (employee) {
      return employee.email || 'N/A';
    }
    return 'N/A';
  };

  // Fonction pour obtenir les initiales
  const getEmployeeInitials = (employeeCode) => {
    const name = getEmployeeName(employeeCode);
    if (name.startsWith('Employé ')) {
      return name.replace('Employé ', '').substring(0, 2).toUpperCase();
    }
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  // Fonction pour obtenir l'ID employé
  const getEmployeeDisplayId = (employeeCode) => {
    const employee = findEmployee(employeeCode);
    if (employee) {
      return employee.employee_id || employee.employeeId || employee.employeeNumber || employeeCode;
    }
    return employeeCode;
  };

  // Fonction pour obtenir le téléphone
  const getEmployeePhone = (employeeCode) => {
    const employee = findEmployee(employeeCode);
    if (employee) {
      return employee.phone || 'N/A';
    }
    return 'N/A';
  };

  // Fonction pour la recherche
  const searchInAttendance = (term, attendanceRecords, employeeList) => {
    if (!term.trim()) return attendanceRecords;
    
    const searchLower = term.toLowerCase().trim();
    
    return attendanceRecords.filter(record => {
      const employeeIdFromRecord = record.employeeId || record.employee_id;
      const employee = findEmployee(employeeIdFromRecord);
      
      if (!employee) {
        // Si pas d'employé trouvé, vérifier si l'ID du record correspond
        return employeeIdFromRecord?.toLowerCase().includes(searchLower);
      }
      
      // Créer différentes versions du nom
      const firstName = (employee.first_name || employee.firstName || '').toLowerCase();
      const lastName = (employee.last_name || employee.lastName || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();
      const fullNameReversed = `${lastName} ${firstName}`.trim();
      
      // Champs à rechercher
      const searchFields = [
        firstName,
        lastName,
        fullName,
        fullNameReversed,
        employee.employee_id || '',
        employee.employeeId || '',
        employee.email || '',
        employee.phone || '',
        employee.position || '',
        employee.department || '',
        record.notes || ''
      ].filter(field => field && field !== '');
      
      // Recherche dans tous les champs
      return searchFields.some(field => {
        const cleanField = field.replace(/\s+/g, ' ').toLowerCase();
        const cleanSearch = searchLower.replace(/\s+/g, ' ').toLowerCase();
        return cleanField.includes(cleanSearch);
      });
    });
  };

  useEffect(() => {
    let filtered = [...attendance];

    // Filtre par date
    filtered = filtered.filter(record => {
      const recordDate = new Date(record.date || record.createdAt);
      return recordDate >= dateRange.start && recordDate <= dateRange.end;
    });

    // Filtre par statut
    if (statusFilter !== 'all') {
      filtered = filtered.filter(record => {
        if (!record.status) return false;
        return record.status.toLowerCase() === statusFilter.toLowerCase();
      });
    }

    // Filtre par recherche
    if (searchTerm.trim() !== '') {
      filtered = searchInAttendance(searchTerm, filtered, employees);
    }

    setFilteredAttendance(filtered);
    
  }, [attendance, dateRange, statusFilter, searchTerm, employees]);

  const handleRefresh = () => {
    fetchAttendanceData();
  };

  // ✅ NOUVELLE FONCTION D'EXPORT PDF (adaptée au rôle)
const handleExportPDF = async () => {
  try {
    setExportLoading(true);
    
    // Paramètres de base (période)
    const params = {
      startDate: dateRange.start.toISOString().split('T')[0],
      endDate: dateRange.end.toISOString().split('T')[0]
    };
    
    // 👇 LOGIQUE SELON LE RÔLE
    if (isAdmin()) {
      // ADMIN : pas de filtre → tous les employés
      console.log('📤 Admin - Export PDF de TOUS les pointages');
      // Pas de employee_id, pas de department → tous les employés
      
    } else if (isManager()) {
      // MANAGER : vérifier qu'il a un département
      if (!user?.department) {
        toast.error('Vous n\'êtes pas associé à un département');
        setExportLoading(false);
        return;
      }
      
      console.log(`📤 Manager - Export PDF du département ${user.department}`);
      params.department = user.department;  // ← FILTRE PAR DÉPARTEMENT
      
    } else if (isEmployee()) {
      // EMPLOYÉ : vérifier qu'il a un identifiant
      const employeeId = user?.employee_id || user?.email;
      
      if (!employeeId) {
        toast.error('Identifiant employé non trouvé');
        setExportLoading(false);
        return;
      }
      
      console.log(`📤 Employé - Export PDF de ses pointages`);
      params.employee_id = employeeId;
    }
    
    console.log('📤 Export PDF des pointages:', params);
    
    // Appeler le service d'export PDF
    await ExportService.exportAttendancePDF(params);
    
    toast.success('✅ Export PDF des pointages réussi');
    
  } catch (error) {
    console.error('❌ Erreur export PDF:', error);
    
    // Gestion des erreurs spécifiques
    if (error.status === 403) {
      toast.error('Vous n\'avez pas les droits pour exporter ces données');
    } else if (error.status === 404) {
      toast.info('Aucun pointage trouvé pour cette période');
    } else if (error.name === 'NetworkError') {
      toast.error('Erreur de connexion au serveur');
    } else if (error.message?.includes('department')) {
      toast.error('Erreur lors du filtrage par département');
    } else {
      toast.error(error.message || 'Erreur lors de l\'export PDF');
    }
  } finally {
    setExportLoading(false);
  }
};

  const getStatusLabel = (status) => {
    if (!status) return 'Non spécifié';
    
    const labels = {
      present: 'Présent',
      absent: 'Absent',
      late: 'En retard',
      vacation: 'Vacances',
      sick: 'Maladie',
      checked_out: 'Départ',
      completed: 'Terminé',
      not_checked: 'Non pointé'
    };
    return labels[status.toLowerCase()] || status;
  };

  const getStatusColor = (status) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    const colors = {
      present: 'bg-green-100 text-green-800',
      absent: 'bg-red-100 text-red-800',
      late: 'bg-yellow-100 text-yellow-800',
      vacation: 'bg-blue-100 text-blue-800',
      sick: 'bg-purple-100 text-purple-800',
      checked_out: 'bg-indigo-100 text-indigo-800',
      completed: 'bg-teal-100 text-teal-800',
      not_checked: 'bg-gray-100 text-gray-800'
    };
    return colors[status.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  // Fonction pour gérer le pointage rapide (admin uniquement)
  const handleQuickCheck = (action) => {
    navigate(`/attendance/manual?type=${action}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-4 text-gray-600">Chargement des données...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p className="font-bold">Erreur</p>
        <p>{error}</p>
        <button 
          onClick={fetchAttendanceData}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* En-tête avec boutons */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Gestion des Présences</h1>
        
        {/* SECTION BOUTONS - UNIQUEMENT POUR ADMIN */}
        {isAdmin() && (
          <div className="flex space-x-3">
            <button
              onClick={() => navigate('/attendance/manual')}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 flex items-center transition-all duration-200 shadow-md hover:shadow-lg"
              title="Accéder au pointage manuel"
            >
              <FaUserClock className="w-5 h-5 mr-2" />
              Pointage Manuel
            </button>
            
            <button
              onClick={() => handleQuickCheck('checkin')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center transition-all duration-200"
              title="Pointer une arrivée rapide"
            >
              <FaSignInAlt className="w-5 h-5 mr-2" />
              Arrivée
            </button>
            
            <button
              onClick={() => handleQuickCheck('checkout')}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center transition-all duration-200"
              title="Pointer un départ rapide"
            >
              <FaSignOutAlt className="w-5 h-5 mr-2" />
              Départ
            </button>
          </div>
        )}

        {/* BOUTONS COMMUNS À TOUS (Actualiser et Export PDF) */}
        <div className="flex space-x-2">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center transition-colors duration-200"
          >
            <FaSync className="w-5 h-5 mr-2" />
            Actualiser
          </button>
          
          <button
            onClick={handleExportPDF}
            disabled={exportLoading}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex items-center transition-colors duration-200 disabled:opacity-50"
          >
            {exportLoading ? (
              <FaSpinner className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <FaFilePdf className="w-5 h-5 mr-2" />
            )}
            Exporter PDF
          </button>
        </div>
      </div>

      {/* Section Pointage Rapide - UNIQUEMENT POUR ADMIN */}
      {isAdmin() && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <FaUserClock className="w-5 h-5 mr-2 text-purple-600" />
              Pointage Manuel Rapide
            </h3>
            <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full">
              Administrateur uniquement
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Carte Pointage Complet */}
            <div 
              onClick={() => navigate('/attendance/manual')}
              className="bg-white p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-3 group-hover:bg-purple-200 transition-colors">
                  <FaUserClock className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Pointage Complet</h4>
                  <p className="text-sm text-gray-500">Interface complète de pointage</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-purple-600 font-medium">
                Sélectionner un employé pour pointer
              </div>
            </div>
            
            {/* Carte Arrivée Rapide */}
            <div 
              onClick={() => handleQuickCheck('checkin')}
              className="bg-white p-4 rounded-lg border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mr-3 group-hover:bg-emerald-200 transition-colors">
                  <FaSignInAlt className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Arrivée Rapide</h4>
                  <p className="text-sm text-gray-500">Pointer l'arrivée uniquement</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-emerald-600 font-medium">
                Pour les employés arrivant tardivement
              </div>
            </div>
            
            {/* Carte Départ Rapide */}
            <div 
              onClick={() => handleQuickCheck('checkout')}
              className="bg-white p-4 rounded-lg border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mr-3 group-hover:bg-orange-200 transition-colors">
                  <FaSignOutAlt className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Départ Rapide</h4>
                  <p className="text-sm text-gray-500">Pointer le départ uniquement</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-orange-600 font-medium">
                Pour les oublis de pointage de départ
              </div>
            </div>
          </div>
          
          <div className="mt-4 text-sm text-gray-600 flex items-center">
            <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center mr-2">
              <span className="text-xs text-blue-600">!</span>
            </div>
            <p>Les pointages manuels sont réservés aux administrateurs pour corriger les erreurs ou compléter les oublis</p>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Période
            </label>
            <div className="flex space-x-2">
              <input
                type="date"
                value={dateRange.start.toISOString().split('T')[0]}
                onChange={(e) => setDateRange({...dateRange, start: new Date(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
              <span className="self-center text-gray-500">à</span>
              <input
                type="date"
                value={dateRange.end.toISOString().split('T')[0]}
                onChange={(e) => setDateRange({...dateRange, end: new Date(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statut
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              <option value="all">Tous les statuts</option>
              <option value="present">Présent</option>
              <option value="absent">Absent</option>
              <option value="late">En retard</option>
              <option value="vacation">Vacances</option>
              <option value="sick">Maladie</option>
              <option value="checked_out">Départ</option>
              <option value="completed">Terminé</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recherche employé
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaSearch className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nom, prénom, email, ID..."
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600 transition-colors"
                >
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Recherche par nom, prénom, email, ID employé, téléphone...
            </p>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total présences</div>
          <div className="text-2xl font-bold">
            {filteredAttendance.length}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Présents</div>
          <div className="text-2xl font-bold text-green-600">
            {filteredAttendance.filter(a => a.status?.toLowerCase() === 'present').length}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Absents</div>
          <div className="text-2xl font-bold text-red-600">
            {filteredAttendance.filter(a => a.status?.toLowerCase() === 'absent').length}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">En retard</div>
          <div className="text-2xl font-bold text-yellow-600">
            {filteredAttendance.filter(a => a.status?.toLowerCase() === 'late').length}
          </div>
        </div>
      </div>

      {/* Tableau des présences AVEC EMAIL */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employé
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID Employé
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check-in
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check-out
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                {/* ✅ COLONNE ACTIONS - UNIQUEMENT POUR ADMIN */}
                {isAdmin() && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAttendance.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin() ? 9 : 8} className="px-6 py-12 text-center text-gray-500">
                    Aucune donnée de présence trouvée pour les filtres sélectionnés
                  </td>
                </tr>
              ) : (
                filteredAttendance.map((record) => {
                  const employeeId = record.employeeId || record.employee_id;
                  const employeeName = getEmployeeName(employeeId);
                  const employeeDisplayId = getEmployeeDisplayId(employeeId);
                  const employeeEmail = getEmployeeEmail(employeeId);
                  const initials = getEmployeeInitials(employeeId);
                  
                  return (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(record.date || record.createdAt), 'dd/MM/yyyy', { locale: fr })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs mr-3">
                            {initials}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {employeeName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {getEmployeePhone(employeeId)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {employeeDisplayId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FaEnvelope className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900 truncate max-w-xs">
                            {employeeEmail}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.status)}`}>
                          {getStatusLabel(record.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.checkIn ? (
                          <span className="text-green-600 font-medium">{record.checkIn}</span>
                        ) : (
                          <span className="text-gray-400">--:--</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.checkOut ? (
                          <span className="text-blue-600 font-medium">{record.checkOut}</span>
                        ) : (
                          <span className="text-gray-400">--:--</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={record.notes || ''}>
                        {record.notes || ''}
                      </td>
                      {/* ✅ BOUTON CORRIGER - UNIQUEMENT POUR ADMIN */}
                      {isAdmin() && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => navigate(`/attendance/correction/${employeeId}`)}
                              className="text-xs px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors flex items-center"
                              title="Corriger les pointages du mois"
                            >
                              <FaCalendarAlt className="w-3 h-3 mr-2" />
                              Corriger
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {filteredAttendance.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-500">
            Affichage de {filteredAttendance.length} pointage{filteredAttendance.length !== 1 ? 's' : ''}
            {searchTerm && ` pour la recherche "${searchTerm}"`}
          </div>
        )}
      </div>

      {/* Section d'aide - UNIQUEMENT POUR ADMIN */}
      {isAdmin() && (
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <FaUserClock className="w-5 h-5 mr-2 text-blue-600" />
            Comment utiliser le pointage manuel ?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <p className="font-medium mb-1">1. Pointage Complet</p>
              <p>Utilisez le bouton "Pointage Manuel" pour accéder à l'interface complète avec recherche d'employés.</p>
            </div>
            <div>
              <p className="font-medium mb-1">2. Arrivée/Départ Rapide</p>
              <p>Utilisez les boutons "Arrivée" ou "Départ" pour pointer rapidement sans passer par la recherche.</p>
            </div>
            <div>
              <p className="font-medium mb-1">3. Correction Mensuelle</p>
              <p>Utilisez le bouton "Corriger" pour ajuster tous les pointages d'un employé pour un mois donné.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;