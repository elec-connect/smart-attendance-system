import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FaFileExcel, 
  FaFilePdf, 
  FaDownload, 
  FaCalendarAlt, 
  FaFilter,
  FaUsers,
  FaChartBar,
  FaSpinner,
  FaFileInvoiceDollar,
  FaCheckCircle,
  FaExclamationTriangle,
  FaFileArchive,
  FaUser,
  FaIdCard,
  FaBuilding,
  FaUserTie,
  FaUserCog,
  FaInfoCircle,
  FaArrowLeft
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { ExportService } from '../../services/exportService';
import { employeeService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

/**
 * ✅ PANEL D'EXPORT CORRIGÉ - ADMIN VOIT TOUS LES EMPLOYÉS
 * ✅ CORRECTION: employee_id (snake_case) pour PostgreSQL
 * ✅ CORRECTION: Admin sans filtre employé → TOUS les employés
 * 
 * ADMIN:        Téléchargement TOUT + ses propres fiches
 * MANAGER:      Téléchargement SES propres fiches + département
 * EMPLOYÉ:      Téléchargement SES propres fiches uniquement
 */

const ExportPanel = () => {
  // ===== AUTH =====                                                           
  const { user, isAdmin, isManager, isEmployee } = useAuth();
  
  // ===== ÉTATS =====
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportType, setExportType] = useState('payslip');
  const [format, setFormat] = useState('pdf');
  const [activeTab, setActiveTab] = useState('personal');
  
  // ===== FILTRES =====
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    department: '',
    employeeId: '',      // Pour l'UI (camelCase)
    employee_id: '',     // Pour le backend (snake_case)
    monthYear: '2026-10'
  });
  
  // ===== DONNÉES =====
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState({ connected: true, testing: false });
  
  // ===== BATCH =====
  const [batchInfo, setBatchInfo] = useState(null);

  // ============================================
  // ✅ MÉMOÏSATION DES DONNÉES CALCULÉES
  // ============================================
  
  const userEmployeeId = useMemo(() => {
    if (user?.employee_id) return user.employee_id;
    if (user?.employee_code) return user.employee_code;
    if (user?.email) return user.email;
    if (user?.id) return user.id;
    return null;
  }, [user]);

  const userEmployeeName = useMemo(() => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user?.name) return user.name;
    if (user?.email) return user.email.split('@')[0];
    return 'Vous';
  }, [user]);

  // ============================================
  // ✅ UTILS - RÉCUPÉRATION ID EMPLOYÉ
  // ============================================
  
  const getEmployeeFullName = useCallback((emp) => {
    if (!emp) return 'N/A';
    const firstName = emp.firstName || emp.first_name || '';
    const lastName = emp.lastName || emp.last_name || '';
    const name = emp.name || '';
    if (name) return name;
    if (firstName || lastName) return `${firstName} ${lastName}`.trim();
    return emp.employee_id || 'Employé inconnu';
  }, []);

  const getEmployeeId = useCallback((emp) => {
    return emp.employee_id || emp.id || 'N/A';
  }, []);

  // ============================================
  // ✅ FILTRAGE DES EMPLOYÉS SELON LE RÔLE
  // ============================================
  
  const filteredEmployees = useMemo(() => {
    if (isAdmin()) return employees;
    return employees.filter(emp => 
      emp.employee_id === userEmployeeId || 
      emp.id === userEmployeeId ||
      emp.email === user?.email
    );
  }, [employees, userEmployeeId, user?.email, isAdmin]);

  // ============================================
  // ✅ VALIDATION DES PERMISSIONS
  // ============================================
  
  const validateExportPermission = useCallback((type, targetEmployeeId = null) => {
    if (isAdmin()) return { allowed: true, message: null };
    
    if (isManager()) {
      if (type === 'department') {
        return { allowed: true, message: 'Export du département' };
      }
      if (targetEmployeeId && targetEmployeeId !== userEmployeeId) {
        return { 
          allowed: false, 
          message: 'Vous ne pouvez exporter que vos propres données' 
        };
      }
    }
    
    if (isEmployee()) {
      if (targetEmployeeId && targetEmployeeId !== userEmployeeId) {
        return { 
          allowed: false, 
          message: 'Vous ne pouvez exporter que vos propres données' 
        };
      }
    }
    
    return { allowed: true, message: null };
  }, [isAdmin, isManager, isEmployee, userEmployeeId]);

  // ============================================
  // ✅ CHARGEMENT INITIAL
  // ============================================
  
  useEffect(() => {
    fetchEmployeesAndDepartments();
    fetchAvailableMonths();
    checkConnection();
    
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    setFilters(prev => ({
      ...prev,
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0]
    }));
    
    if (!isAdmin()) {
      if (userEmployeeId) {
        setFilters(prev => ({ 
          ...prev, 
          employeeId: userEmployeeId,
          employee_id: userEmployeeId
        }));
      }
    }
    
    if (isManager() && user?.department) {
      setFilters(prev => ({ 
        ...prev, 
        department: user.department 
      }));
    }
  }, []);

  useEffect(() => {
    if (isAdmin() && exportType === 'payslip' && filters.monthYear) {
      checkBatchInfo();
    }
  }, [exportType, filters.monthYear]);

  // ============================================
  // ✅ REQUÊTES API
  // ============================================
  
  const checkConnection = async () => {
    setConnectionStatus(prev => ({ ...prev, testing: true }));
    try {
      const isConnected = await ExportService.testConnection();
      setConnectionStatus({ connected: isConnected, testing: false });
      if (!isConnected) toast.error('Service d\'export temporairement indisponible');
    } catch (error) {
      setConnectionStatus({ connected: false, testing: false });
    }
  };

  const fetchEmployeesAndDepartments = async () => {
    try {
      const response = await employeeService.getAllEmployees();
      let employeesData = [];
      
      if (response?.success && Array.isArray(response.data)) employeesData = response.data;
      else if (Array.isArray(response)) employeesData = response;
      else if (response?.data && Array.isArray(response.data)) employeesData = response.data;
      
      setEmployees(employeesData);
      
      if (Array.isArray(employeesData) && employeesData.length > 0) {
        const uniqueDepts = [...new Set(
          employeesData
            .filter(emp => emp?.department)
            .map(emp => emp.department)
        )].sort();
        setDepartments(uniqueDepts);
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des données');
      setEmployees([]);
      setDepartments([]);
    }
  };

  const fetchAvailableMonths = async () => {
    try {
      const months = await ExportService.getAvailableMonths();
      if (Array.isArray(months) && months.length > 0) {
        setAvailableMonths(months);
        setFilters(prev => ({ ...prev, monthYear: months[0].month_year }));
      } else {
        const defaultMonths = [
          { month_year: '2026-10', month_name: 'Octobre 2026' },
          { month_year: '2026-09', month_name: 'Septembre 2026' },
          { month_year: '2026-08', month_name: 'Août 2026' }
        ];
        setAvailableMonths(defaultMonths);
        setFilters(prev => ({ ...prev, monthYear: '2026-10' }));
      }
    } catch (error) {
      const defaultMonths = [
        { month_year: '2026-10', month_name: 'Octobre 2026' },
        { month_year: '2026-09', month_name: 'Septembre 2026' },
        { month_year: '2026-08', month_name: 'Août 2026' }
      ];
      setAvailableMonths(defaultMonths);
      setFilters(prev => ({ ...prev, monthYear: '2026-10' }));
    }
  };

  const checkBatchInfo = async () => {
    if (!isAdmin() || !filters.monthYear) return;
    try {
      const info = await ExportService.getPayslipsBatchInfo(filters.monthYear);
      if (info?.success) setBatchInfo(info.data);
    } catch (error) {
      console.warn('Erreur récupération info batch:', error);
    }
  };

  // ============================================
  // ✅ GESTIONNAIRE D'EXPORT PRINCIPAL
  // ============================================
  
  const handleExport = useCallback(async (forcedFormat = null, customParams = null) => {
    try {
      setExportLoading(true);
      
      const exportFormat = forcedFormat || format;
      
      if (exportType === 'attendance' && (!filters.startDate || !filters.endDate)) {
        toast.error('Veuillez sélectionner une période');
        setExportLoading(false);
        return;
      }
      
      if (exportType === 'payslip' && !filters.monthYear) {
        toast.error('Veuillez sélectionner un mois');
        setExportLoading(false);
        return;
      }

      // Validation des permissions
      let permissionCheck = { allowed: true };
      
      if (exportType === 'payslip') {
        if (isAdmin() && activeTab === 'all') {
          permissionCheck = validateExportPermission('all');
        } else {
          permissionCheck = validateExportPermission('individual', userEmployeeId);
        }
      }
      
      if (exportType === 'attendance') {
        if (isAdmin() && activeTab === 'all') {
          permissionCheck = validateExportPermission('all');
        } else {
          permissionCheck = validateExportPermission('individual', userEmployeeId);
        }
      }
      
      if (!permissionCheck.allowed) {
        toast.error(permissionCheck.message);
        setExportLoading(false);
        return;
      }

      console.log(`[EXPORT] Type: ${exportType}, Format: ${exportFormat}, Tab: ${activeTab}, Rôle: ${user?.role}`);

      if (exportType === 'payslip') {
        if (isAdmin() && activeTab === 'all') {
          if (exportFormat === 'pdf') {
            await ExportService.exportAllPayslipsPDF(filters.monthYear);
            toast.success('✅ PDF de toutes les fiches de paie généré');
          } 
          else if (exportFormat === 'excel') {
            await ExportService.exportAllPayslipsExcel(filters.monthYear);
            toast.success('✅ Excel de toutes les fiches de paie généré');
          }
          else if (exportFormat === 'csv') {
            await ExportService.exportAllPayslipsCSV(filters.monthYear);
            toast.success('✅ CSV de toutes les fiches de paie généré');
          }
        }
        else {
          const employeeId = userEmployeeId;
          
          if (!employeeId) {
            toast.error('Impossible de déterminer votre identifiant employé');
            setExportLoading(false);
            return;
          }
          
          await ExportService.exportSinglePayslipPDF({
            employee_id: employeeId,
            month_year: filters.monthYear
          });
          
          toast.success('✅ Votre fiche de paie a été téléchargée');
        }
      }
      
      else if (exportType === 'attendance') {
        // ✅ ADMIN - TOUTES LES DONNÉES
        if (isAdmin() && activeTab === 'all') {
          // Utiliser les paramètres personnalisés s'ils existent, sinon construire
          let params = customParams;
          
          if (!params) {
            params = {
              startDate: filters.startDate,
              endDate: filters.endDate,
              department: filters.department || undefined
            };
            // ✅ SEULEMENT si un employé spécifique est sélectionné
            if (filters.employee_id) {
              params.employee_id = filters.employee_id;
            }
          }
          
          if (exportFormat === 'excel') {
            await ExportService.exportAttendanceExcel(params);
            toast.success('✅ Export Excel des pointages terminé');
          } 
          else {
            await ExportService.exportAttendancePDF(params);
            toast.success('✅ Export PDF des pointages terminé');
          }
        }
        // ✅ NON-ADMIN - DONNÉES PERSONNELLES
        else {
          const employeeId = userEmployeeId;
          
          if (!employeeId) {
            toast.error('Impossible de déterminer votre identifiant employé');
            setExportLoading(false);
            return;
          }
          
          if (exportFormat === 'excel') {
            await ExportService.exportAttendanceExcel({
              startDate: filters.startDate,
              endDate: filters.endDate,
              employee_id: employeeId
            });
            toast.success('✅ Vos pointages ont été exportés (Excel)');
          } 
          else {
            await ExportService.exportAttendancePDF({
              startDate: filters.startDate,
              endDate: filters.endDate,
              employee_id: employeeId
            });
            toast.success('✅ Vos pointages ont été exportés (PDF)');
          }
        }
      }
      
      else if (exportType === 'employees' && isAdmin()) {
        await ExportService.exportEmployees();
        toast.success('✅ Liste des employés exportée');
      }

      setConnectionStatus({ connected: true, testing: false });

    } catch (error) {
      console.error('❌ Erreur export:', error);
      
      if (error.status === 403) {
        toast.error('Opération non autorisée pour votre rôle');
      }
      else if (error.status === 401 || error.name === 'AuthError') {
        toast.error('Session expirée, veuillez vous reconnecter');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setTimeout(() => window.location.href = '/login', 2000);
      }
      else if (error.name === 'NetworkError' || error.message?.includes('fetch')) {
        toast.error('Erreur de connexion au serveur');
        setConnectionStatus({ connected: false, testing: false });
      }
      else if (error.message?.includes('MONTH_NOT_FOUND')) {
        toast.error('Le mois sélectionné n\'existe pas');
      }
      else if (error.message?.includes('NO_PAYMENTS_FOUND')) {
        toast.error('Aucune fiche de paie trouvée pour ce mois');
      }
      else if (error.message?.includes('vide') || error.message?.includes('empty')) {
        toast.error('Aucune donnée à exporter');
      }
      else {
        toast.error(`Erreur: ${error.message || 'Erreur inconnue'}`);
      }
      
    } finally {
      setExportLoading(false);
    }
  }, [exportType, format, activeTab, filters, user, isAdmin, userEmployeeId, validateExportPermission]);

  // ============================================
  // ✅ GESTIONNAIRES SPÉCIALISÉS PAR TYPE
  // ============================================

  const handleAttendanceExport = useCallback((selectedFormat, customParams = null) => {
    setFormat(selectedFormat);
    setExportType('attendance');
    handleExport(selectedFormat, customParams);
  }, [handleExport]);

  const handlePayslipExport = useCallback((selectedFormat) => {
    setFormat(selectedFormat);
    setExportType('payslip');
    handleExport(selectedFormat);
  }, [handleExport]);

  // ============================================
  // ✅ EXPORT ZIP ADMIN
  // ============================================
  
  const handleExportAllPayslipsZip = useCallback(async (zipType = 'zip') => {
    if (!isAdmin()) {
      toast.error('Export ZIP réservé aux administrateurs');
      return;
    }
    
    try {
      if (!filters.monthYear) {
        toast.error('Veuillez sélectionner un mois');
        return;
      }

      setLoading(true);
      
      if (zipType === 'zip-advanced') {
        await ExportService.exportAllPayslipsZipAdvanced(filters.monthYear);
        toast.success(`✅ Archive ZIP complète générée`);
      } else {
        await ExportService.exportAllPayslipsZip(filters.monthYear);
        toast.success(`✅ Archive ZIP générée`);
      }
      
    } catch (error) {
      if (error.message.includes('NO_PAYMENTS_FOUND')) {
        toast.error('Aucune fiche de paie trouvée pour ce mois');
      } else if (error.message.includes('MONTH_NOT_FOUND')) {
        toast.error('Le mois sélectionné n\'existe pas');
      } else if (error.name === 'NetworkError') {
        toast.error('Erreur de connexion au serveur');
        setConnectionStatus({ connected: false, testing: false });
      } else {
        toast.error(`Erreur: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [isAdmin, filters.monthYear]);

  // ============================================
  // ✅ UTILITAIRES
  // ============================================
  
  const setDefaultDates = useCallback(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    setFilters(prev => ({
      ...prev,
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0]
    }));
    
    toast.success('Dates définies pour le mois en cours');
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      startDate: '',
      endDate: '',
      department: isManager() ? user?.department : '',
      employeeId: !isAdmin() ? userEmployeeId : '',
      employee_id: !isAdmin() ? userEmployeeId : '',
      monthYear: availableMonths.length > 0 ? availableMonths[0].month_year : '2026-10'
    });
    toast.success('Filtres réinitialisés');
  }, [isManager, isAdmin, user?.department, userEmployeeId, availableMonths]);

  // ============================================
  // ✅ RENDU PRINCIPAL
  // ============================================
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      
      {/* ===== EN-TÊTE AVEC RÔLE ===== */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {isAdmin() && <FaUserCog className="mr-3 text-purple-600 text-2xl" />}
            {isManager() && <FaUserTie className="mr-3 text-blue-600 text-2xl" />}
            {isEmployee() && <FaUser className="mr-3 text-green-600 text-2xl" />}
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isAdmin() && 'Administration des exports'}
                {isManager() && `Gestion des exports - ${user?.department || 'Département'}`}
                {isEmployee() && 'Mes exports personnels'}
              </h2>
              <p className="text-gray-600 mt-1">
                {isAdmin() && 'Exportez toutes les données ou vos fiches personnelles'}
                {isManager() && 'Consultez et exportez les données de votre département'}
                {isEmployee() && 'Téléchargez vos fiches de paie et vos pointages'}
              </p>
              {isManager() && user?.department && (
                <div className="mt-2 inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  <FaBuilding className="mr-2" />
                  Département: {user.department}
                </div>
              )}
            </div>
          </div>
          
          <div className={`flex items-center px-3 py-1 rounded-full text-sm ${
            connectionStatus.connected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {connectionStatus.testing ? (
              <><FaSpinner className="animate-spin mr-2" /> Vérification...</>
            ) : connectionStatus.connected ? (
              <><FaCheckCircle className="mr-2" /> Service disponible</>
            ) : (
              <><FaExclamationTriangle className="mr-2" /> Service indisponible</>
            )}
          </div>
        </div>
      </div>

      {/* ===== ADMIN - ONGLETS PERSONNEL / TOUT LE MONDE ===== */}
      {isAdmin() && (
        <div className="mb-6 border-b border-gray-200">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('personal')}
              className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'personal'
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FaUser className="inline mr-2" />
              Mes exports personnels
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'all'
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FaUsers className="inline mr-2" />
              Toutes les données
            </button>
          </div>
        </div>
      )}

      {/* ===== SECTION MES EXPORTS PERSONNELS ===== */}
      {(activeTab === 'personal' || !isAdmin()) && (
        <div className="space-y-6">
          
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
            <div className="flex items-start">
              <FaIdCard className="h-6 w-6 text-blue-600 mt-0.5 mr-3" />
              <div>
                <h3 className="font-semibold text-blue-900">Vos exports personnels</h3>
                <p className="text-sm text-blue-800 mt-1">
                  Vous êtes connecté en tant que <span className="font-bold">{userEmployeeName}</span>
                  {userEmployeeId && <span className="ml-1 text-xs bg-blue-200 px-2 py-0.5 rounded-full">ID: {userEmployeeId}</span>}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Vous ne pouvez exporter que vos propres données.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Type de document à exporter
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              
              <button
                type="button"
                onClick={() => { 
                  setExportType('payslip'); 
                  setFormat('pdf');
                }}
                className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                  exportType === 'payslip'
                    ? 'bg-red-50 border-red-400 text-red-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FaFileInvoiceDollar className={`h-8 w-8 mb-2 ${exportType === 'payslip' ? 'text-red-600' : 'text-gray-600'}`} />
                <span className="font-medium">Fiche de paie</span>
                <span className="text-xs text-gray-500 mt-1">PDF - Format officiel</span>
                <span className="text-xs font-medium mt-2 px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                  Votre fiche uniquement
                </span>
              </button>
              
              <button
                type="button"
                onClick={() => { 
                  setExportType('attendance'); 
                  setFormat('excel');
                }}
                className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                  exportType === 'attendance'
                    ? 'bg-green-50 border-green-400 text-green-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FaChartBar className={`h-8 w-8 mb-2 ${exportType === 'attendance' ? 'text-green-600' : 'text-gray-600'}`} />
                <span className="font-medium">Mes pointages</span>
                <span className="text-xs text-gray-500 mt-1">Excel ou PDF</span>
                <span className="text-xs font-medium mt-2 px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                  Vos présences uniquement
                </span>
              </button>
            </div>
          </div>

          {/* FILTRES FICHE DE PAIE PERSONNELLE */}
          {exportType === 'payslip' && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center mb-3">
                <FaFileInvoiceDollar className="h-4 w-4 text-red-500 mr-2" />
                <h3 className="font-medium text-gray-800">Télécharger votre fiche de paie</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mois *
                  </label>
                  <select
                    value={filters.monthYear}
                    onChange={(e) => setFilters({...filters, monthYear: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    required
                  >
                    <option value="">Sélectionner un mois</option>
                    {availableMonths.map((month, index) => (
                      <option key={index} value={month.month_year}>
                        {month.month_name || month.month_year}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Format: YYYY-MM (ex: 2026-10)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handlePayslipExport('pdf')}
                  disabled={exportLoading || !filters.monthYear}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm"
                >
                  {exportLoading && exportType === 'payslip' ? (
                    <><FaSpinner className="animate-spin" /> Génération en cours...</>
                  ) : (
                    <><FaFilePdf className="text-white" /> Télécharger ma fiche de paie (PDF)</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* FILTRES POINTAGES PERSONNELS */}
          {exportType === 'attendance' && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <FaChartBar className="h-4 w-4 text-green-500 mr-2" />
                  <h3 className="font-medium text-gray-800">Exporter vos pointages</h3>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={setDefaultDates} 
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center"
                  >
                    <FaCalendarAlt className="mr-1" /> Mois en cours
                  </button>
                  <button 
                    onClick={clearFilters} 
                    className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    Effacer
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de début *
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    max={filters.endDate || new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de fin *
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    min={filters.startDate}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleAttendanceExport('excel')}
                  disabled={exportLoading || !filters.startDate || !filters.endDate}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm"
                >
                  {exportLoading && format === 'excel' && exportType === 'attendance' ? (
                    <><FaSpinner className="animate-spin" /> Génération...</>
                  ) : (
                    <><FaFileExcel className="text-white" /> Excel - Mes pointages</>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => handleAttendanceExport('pdf')}
                  disabled={exportLoading || !filters.startDate || !filters.endDate}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm"
                >
                  {exportLoading && format === 'pdf' && exportType === 'attendance' ? (
                    <><FaSpinner className="animate-spin" /> Génération...</>
                  ) : (
                    <><FaFilePdf className="text-white" /> PDF - Mes pointages</>
                  )}
                </button>
              </div>
              
              {filters.startDate && filters.endDate && (
                <div className="mt-3 p-2 bg-white rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-700 flex items-center">
                    <FaCalendarAlt className="mr-2 text-green-600" />
                    <span className="font-medium">Période sélectionnée:</span>
                    <span className="ml-2">
                      {new Date(filters.startDate).toLocaleDateString('fr-FR')} - {new Date(filters.endDate).toLocaleDateString('fr-FR')}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== SECTION ADMIN - TOUTES LES DONNÉES ===== */}
      {isAdmin() && activeTab === 'all' && (
        <div className="space-y-6">
          
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg border border-purple-200">
            <div className="flex items-start">
              <FaUsers className="h-6 w-6 text-purple-600 mt-0.5 mr-3" />
              <div>
                <h3 className="font-semibold text-purple-900">Export de toutes les données</h3>
                <p className="text-sm text-purple-800 mt-1">
                  Vous avez accès à l'ensemble des données de l'entreprise.
                </p>
                <p className="text-xs text-purple-700 mt-1 flex items-center">
                  <FaExclamationTriangle className="mr-1" />
                  Ces exports contiennent des informations confidentielles.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Type de données à exporter
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              <button
                type="button"
                onClick={() => { 
                  setExportType('payslip'); 
                  setFormat('pdf');
                }}
                className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                  exportType === 'payslip'
                    ? 'bg-red-50 border-red-400 text-red-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FaFileInvoiceDollar className="h-8 w-8 mb-2" />
                <span className="font-medium">Fiches de paie</span>
                <span className="text-xs text-gray-500 mt-1">PDF / Excel / ZIP</span>
              </button>
              
              <button
                type="button"
                onClick={() => { 
                  setExportType('attendance'); 
                  setFormat('excel');
                }}
                className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                  exportType === 'attendance'
                    ? 'bg-green-50 border-green-400 text-green-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FaChartBar className="h-8 w-8 mb-2" />
                <span className="font-medium">Pointages</span>
                <span className="text-xs text-gray-500 mt-1">Excel / PDF</span>
              </button>
              
              <button
                type="button"
                onClick={() => { 
                  setExportType('employees'); 
                  setFormat('excel');
                }}
                className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                  exportType === 'employees'
                    ? 'bg-purple-50 border-purple-400 text-purple-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FaUsers className="h-8 w-8 mb-2" />
                <span className="font-medium">Employés</span>
                <span className="text-xs text-gray-500 mt-1">Excel uniquement</span>
              </button>
            </div>
          </div>

          {/* FILTRES FICHES DE PAIE ADMIN */}
          {exportType === 'payslip' && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center mb-3">
                <FaFileInvoiceDollar className="h-4 w-4 text-red-500 mr-2" />
                <h3 className="font-medium text-gray-800">Export des fiches de paie</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mois *
                  </label>
                  <select
                    value={filters.monthYear}
                    onChange={(e) => setFilters({...filters, monthYear: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Sélectionner un mois</option>
                    {availableMonths.map((month, index) => (
                      <option key={index} value={month.month_year}>
                        {month.month_name || month.month_year}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handlePayslipExport('pdf')}
                    disabled={exportLoading || !filters.monthYear}
                    className="bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {exportLoading && format === 'pdf' && exportType === 'payslip' ? (
                      <><FaSpinner className="animate-spin" /> PDF...</>
                    ) : (
                      <><FaFilePdf /> PDF - Toutes les fiches</>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handlePayslipExport('excel')}
                    disabled={exportLoading || !filters.monthYear}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {exportLoading && format === 'excel' && exportType === 'payslip' ? (
                      <><FaSpinner className="animate-spin" /> Excel...</>
                    ) : (
                      <><FaFileExcel /> Excel - Toutes les fiches</>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleExportAllPayslipsZip('zip')}
                    disabled={loading || !filters.monthYear}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <><FaSpinner className="animate-spin" /> ZIP...</>
                    ) : (
                      <><FaFileArchive /> ZIP standard</>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleExportAllPayslipsZip('zip-advanced')}
                    disabled={loading || !filters.monthYear}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <><FaSpinner className="animate-spin" /> ZIP...</>
                    ) : (
                      <><FaFileArchive /> ZIP complet</>
                    )}
                  </button>
                </div>

                {batchInfo && batchInfo.total_payslips > 0 && (
                  <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                    <p className="text-xs text-yellow-800">
                      <span className="font-bold">{batchInfo.total_payslips}</span> fiches de paie disponibles
                      {batchInfo.total_payslips > 100 && ' - Export par lots recommandé'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ✅ FILTRES POINTAGES ADMIN - CORRIGÉ */}
          {exportType === 'attendance' && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <FaChartBar className="h-4 w-4 text-green-500 mr-2" />
                  <h3 className="font-medium text-gray-800">Export des pointages</h3>
                </div>
                <button onClick={setDefaultDates} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                  <FaCalendarAlt className="inline mr-1" /> Mois en cours
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date début *</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date fin *</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
                  <select
                    value={filters.department}
                    onChange={(e) => setFilters({...filters, department: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Tous les départements</option>
                    {departments.map((dept, index) => (
                      <option key={index} value={dept}>{dept}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Laissez vide pour TOUS les départements
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employé (optionnel)</label>
                  <select
                    value={filters.employeeId}
                    onChange={(e) => {
                      const empId = e.target.value;
                      setFilters({
                        ...filters, 
                        employeeId: empId,
                        employee_id: empId
                      });
                    }}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Tous les employés</option>
                    {employees.slice(0, 50).map((emp, index) => (
                      <option key={index} value={getEmployeeId(emp)}>
                        {getEmployeeFullName(emp)} ({getEmployeeId(emp)})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    ✅ Laissez vide pour voir TOUS les employés
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFormat('excel');
                    setExportType('attendance');
                    // ✅ ADMIN: Pas de employee_id → TOUS les employés
                    const params = {
                      startDate: filters.startDate,
                      endDate: filters.endDate,
                      department: filters.department || undefined
                    };
                    // ✅ SEULEMENT si un employé spécifique est sélectionné
                    if (filters.employee_id) {
                      params.employee_id = filters.employee_id;
                    }
                    handleAttendanceExport('excel', params);
                  }}
                  disabled={exportLoading || !filters.startDate || !filters.endDate}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {exportLoading && format === 'excel' && exportType === 'attendance' ? (
                    <><FaSpinner className="animate-spin" /> Excel...</>
                  ) : (
                    <><FaFileExcel /> Excel - Pointages</>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setFormat('pdf');
                    setExportType('attendance');
                    // ✅ ADMIN: Pas de employee_id → TOUS les employés
                    const params = {
                      startDate: filters.startDate,
                      endDate: filters.endDate,
                      department: filters.department || undefined
                    };
                    // ✅ SEULEMENT si un employé spécifique est sélectionné
                    if (filters.employee_id) {
                      params.employee_id = filters.employee_id;
                    }
                    handleAttendanceExport('pdf', params);
                  }}
                  disabled={exportLoading || !filters.startDate || !filters.endDate}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {exportLoading && format === 'pdf' && exportType === 'attendance' ? (
                    <><FaSpinner className="animate-spin" /> PDF...</>
                  ) : (
                    <><FaFilePdf /> PDF - Pointages</>
                  )}
                </button>
              </div>
              
              <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                <p className="text-xs text-blue-700 flex items-center">
                  <FaInfoCircle className="mr-1" />
                  <span className="font-medium">Mode actuel:</span>
                  <span className="ml-1">
                    {filters.employee_id ? `Employé spécifique: ${filters.employee_id}` : '✅ TOUS les employés'}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* EXPORT EMPLOYÉS ADMIN */}
          {exportType === 'employees' && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center mb-3">
                <FaUsers className="h-4 w-4 text-purple-500 mr-2" />
                <h3 className="font-medium text-gray-800">Export de la liste des employés</h3>
              </div>
              
              <button
                type="button"
                onClick={handleExport}
                disabled={exportLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2"
              >
                {exportLoading ? (
                  <><FaSpinner className="animate-spin" /> Génération...</>
                ) : (
                  <><FaFileExcel /> Excel - Liste des employés</>
                )}
              </button>
              
              <p className="text-xs text-gray-500 mt-2">
                {employees.length} employés au total
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===== SECTION MANAGER - DÉPARTEMENT ===== */}
      {isManager() && !isAdmin() && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center mb-3">
            <FaBuilding className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="font-semibold text-blue-800">Export du département</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setExportType('attendance');
                setFormat('excel');
                toast.info('Fonctionnalité en cours de développement');
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2"
            >
              <FaFileExcel /> Pointages du département
            </button>
            
            <button
              type="button"
              onClick={() => {
                setExportType('payslip');
                setFormat('pdf');
                toast.info('Fonctionnalité en cours de développement');
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2"
            >
              <FaFilePdf /> Fiches du département
            </button>
          </div>
          
          <p className="text-xs text-blue-700 mt-2 flex items-center">
            <FaInfoCircle className="mr-1" />
            Département: <span className="font-bold ml-1">{user?.department}</span>
          </p>
        </div>
      )}

      {/* ===== INFORMATIONS GÉNÉRALES ===== */}
      <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center">
          <span className="mr-2">💡</span>
          Informations importantes
        </h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li className="flex items-start">
            <span className="mr-1">•</span>
            <span>L'export peut prendre quelques secondes selon le volume de données</span>
          </li>
          <li className="flex items-start">
            <span className="mr-1">•</span>
            <span>Le fichier sera téléchargé automatiquement une fois généré</span>
          </li>
          {isAdmin() && (
            <li className="flex items-start">
              <span className="mr-1">•</span>
              <span className="font-medium">Admin:</span> ✅ Vous voyez TOUS les employés (sauf filtre spécifique)
            </li>
          )}
          {isManager() && (
            <li className="flex items-start">
              <span className="mr-1">•</span>
              <span className="font-medium">Manager:</span> Vos exports sont limités à votre département
            </li>
          )}
          {isEmployee() && (
            <li className="flex items-start">
              <span className="mr-1">•</span>
              <span className="font-medium">Employé:</span> Vous ne pouvez exporter que vos propres données
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default ExportPanel;