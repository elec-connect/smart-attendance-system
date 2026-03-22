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
    employeeId: '', 
    employee_id: '',  
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
  // ✅ IDENTIFICATION PAR EMAIL (PAS BESOIN DE employee_id)
  // ============================================
  
  const userEmail = useMemo(() => {
    return user?.email || null;
  }, [user]);

  const userCIN = useMemo(() => {
    // Chercher le CIN dans la liste des employés
    if (userEmail && employees.length > 0) {
      const foundEmployee = employees.find(emp => emp.email === userEmail);
      return foundEmployee?.cin || null;
    }
    return null;
  }, [userEmail, employees]);

  const userIdentifier = useMemo(() => {
    // PRIORITÉ 1: Email (toujours disponible et unique)
    if (userEmail) return userEmail;
    
    // PRIORITÉ 2: CIN (si trouvé)
    if (userCIN) return userCIN;
    
    // FALLBACK: Autres identifiants
    return user?.employee_id || user?.email || user?.id || null;
  }, [userEmail, userCIN, user]);

  const userDisplayName = useMemo(() => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user?.name) return user.name;
    return userEmail || 'Vous';
  }, [user, userEmail]);

  // ============================================
  // ✅ FILTRAGE DES EMPLOYÉS SELON LE RÔLE
  // ============================================
  
  const filteredEmployees = useMemo(() => {
    if (isAdmin()) return employees;
    return employees.filter(emp => 
      emp.email === userEmail || 
      emp.cin === userCIN ||
      emp.employee_id === userIdentifier
    );
  }, [employees, userEmail, userCIN, userIdentifier, isAdmin]);

  // ============================================
  // ✅ VALIDATION DES PERMISSIONS
  // ============================================
  
  const validateExportPermission = useCallback((type, targetIdentifier = null) => {
    if (isAdmin()) return { allowed: true, message: null };
    
    if (isManager()) {
      if (type === 'department') {
        return { allowed: true, message: 'Export du département' };
      }
      // Vérification par email
      if (targetIdentifier && targetIdentifier !== userEmail) {
        return { 
          allowed: false, 
          message: 'Vous ne pouvez exporter que vos propres données' 
        };
      }
    }
    
    if (isEmployee()) {
      if (targetIdentifier && targetIdentifier !== userEmail) {
        return { 
          allowed: false, 
          message: 'Vous ne pouvez exporter que vos propres données' 
        };
      }
    }
    
    return { allowed: true, message: null };
  }, [isAdmin, isManager, isEmployee, userEmail]);

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
    
    // Initialisation des dates
    const baseFilters = {
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0],
      employeeId: '',
      employee_id: '',
      department: ''
    };
    
    // ✅ CAS ADMIN : tout vide
    if (isAdmin()) {
      setFilters(baseFilters);
    }
    // ✅ CAS MANAGER : avec son département et son email
    else if (isManager() && userEmail) {
      setFilters({
        ...baseFilters,
        employeeId: userEmail,
        employee_id: userEmail,
        department: user?.department || ''
      });
    }
    // ✅ CAS EMPLOYÉ : seulement son email
    else if (userEmail) {
      setFilters({
        ...baseFilters,
        employeeId: userEmail,
        employee_id: userEmail
      });
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

      // ✅ Log pour déboguer
      if (userEmail) {
        const foundEmployee = employeesData.find(emp => emp.email === userEmail);
        console.log('🔍 Employé trouvé:', foundEmployee);
        if (foundEmployee) {
          console.log('   Email:', foundEmployee.email);
          console.log('   CIN:', foundEmployee.cin);
          console.log('   employee_id:', foundEmployee.employee_id);
        }
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
          permissionCheck = validateExportPermission('individual', userEmail);
        }
      }
      
      if (exportType === 'attendance') {
        if (isAdmin() && activeTab === 'all') {
          permissionCheck = validateExportPermission('all');
        } else {
          permissionCheck = validateExportPermission('individual', userEmail);
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
          // ✅ UTILISATION DE L'EMAIL COMME IDENTIFIANT PRINCIPAL
          const identifier = userEmail;
          
          if (!identifier) {
            toast.error('Impossible de déterminer votre identifiant');
            setExportLoading(false);
            return;
          }
          
          console.log(`[EXPORT] Fiche individuelle:`, {
            employee_id: identifier,  // On envoie l'email
            month_year: filters.monthYear
          });
          
          await ExportService.exportSinglePayslipPDF({
            employee_id: identifier,
            month_year: filters.monthYear
          });
          
          toast.success('✅ Votre fiche de paie a été téléchargée');
        }
      }
      
      else if (exportType === 'attendance') {
        // ✅ ADMIN - TOUTES LES DONNÉES
        if (isAdmin() && activeTab === 'all') {
          let params = customParams;
          
          if (!params) {
            params = {
              startDate: filters.startDate,
              endDate: filters.endDate,
              department: filters.department || undefined
            };
            // SEULEMENT si un employé spécifique est sélectionné
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
        // ✅ NON-ADMIN - DONNÉES PERSONNELLES (par EMAIL)
        else {
          const identifier = userEmail;
          
          if (!identifier) {
            toast.error('Impossible de déterminer votre identifiant');
            setExportLoading(false);
            return;
          }
          
          if (exportFormat === 'excel') {
            await ExportService.exportAttendanceExcel({
              startDate: filters.startDate,
              endDate: filters.endDate,
              employee_id: identifier  // On envoie l'email
            });
            toast.success('✅ Vos pointages ont été exportés (Excel)');
          } 
          else {
            await ExportService.exportAttendancePDF({
              startDate: filters.startDate,
              endDate: filters.endDate,
              employee_id: identifier  // On envoie l'email
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
  }, [exportType, format, activeTab, filters, user, isAdmin, userEmail, validateExportPermission]);

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
      employeeId: !isAdmin() ? userEmail : '',
      employee_id: !isAdmin() ? userEmail : '',
      monthYear: availableMonths.length > 0 ? availableMonths[0].month_year : '2026-10'
    });
    toast.success('Filtres réinitialisés');
  }, [isManager, isAdmin, user?.department, userEmail, availableMonths]);

  // ============================================
  // ✅ RENDU PRINCIPAL
  // ============================================
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      
      {/* ===== EN-TÊTE AVEC RÔLE - STYLE PROFESSIONNEL ===== */}
      <div className="mb-8">
        {/* Bannière de rôle */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                {isAdmin() && <FaUserCog className="text-3xl" />}
                {isManager() && <FaUserTie className="text-3xl" />}
                {isEmployee() && <FaUser className="text-3xl" />}
              </div>
              <div>
                <h1 className="text-2xl font-bold">Centre d'Exportation</h1>
                <p className="text-blue-100 mt-1">Exportez vos données au format Excel, PDF ou ZIP</p>
              </div>
            </div>
            
            {/* Badge de statut */}
            <div className={`flex items-center px-4 py-2 rounded-lg backdrop-blur-sm ${
              connectionStatus.connected ? 'bg-green-500/30 text-white' : 'bg-red-500/30 text-white'
            }`}>
              {connectionStatus.testing ? (
                <><FaSpinner className="animate-spin mr-2" /> Vérification...</>
              ) : connectionStatus.connected ? (
                <><FaCheckCircle className="mr-2" /> Service connecté</>
              ) : (
                <><FaExclamationTriangle className="mr-2" /> Service indisponible</>
              )}
            </div>
          </div>
        </div>

        {/* Cartes de rôles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {/* Admin Card */}
          {isAdmin() && (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-5 rounded-xl border border-purple-200 shadow-sm">
              <div className="flex items-center mb-3">
                <div className="bg-purple-600 p-2 rounded-lg mr-3">
                  <FaUserCog className="text-white text-lg" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Administration</h3>
                  <p className="text-sm text-gray-600">Accès complet à toutes les données</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Département:</span>
                <span className="font-semibold text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
                  {user?.department || 'Direction'}
                </span>
              </div>
            </div>
          )}

          {/* Manager Card */}
          {isManager() && (
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-5 rounded-xl border border-blue-200 shadow-sm">
              <div className="flex items-center mb-3">
                <div className="bg-blue-600 p-2 rounded-lg mr-3">
                  <FaUserTie className="text-white text-lg" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Gestion départementale</h3>
                  <p className="text-sm text-gray-600">Accès aux données de votre département</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Département:</span>
                <span className="font-semibold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
                  {user?.department || 'Non spécifié'}
                </span>
              </div>
            </div>
          )}

          {/* Employee Card */}
          {isEmployee() && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-5 rounded-xl border border-green-200 shadow-sm">
              <div className="flex items-center mb-3">
                <div className="bg-green-600 p-2 rounded-lg mr-3">
                  <FaUser className="text-white text-lg" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Espace personnel</h3>
                  <p className="text-sm text-gray-600">Accès à vos données uniquement</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Identification:</span>
                <span className="font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full">
                  {userEmail}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Indicateur de département pour admin (quand dans l'onglet "Toutes les données") */}
        {isAdmin() && activeTab === 'all' && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center">
            <FaInfoCircle className="text-amber-600 mr-2 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-medium">Mode "Toutes les données" :</span> Vous pouvez exporter l'ensemble des données de l'entreprise. 
              Utilisez les filtres ci-dessous pour affiner votre sélection.
            </p>
          </div>
        )}
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
                  Vous êtes connecté en tant que <span className="font-bold">{userDisplayName}</span>
                </p>
                <div className="flex items-center mt-1 text-xs text-blue-700">
                  <span className="bg-blue-200 px-2 py-0.5 rounded-full mr-2">
                    Email: {userEmail}
                  </span>
                  {userCIN && (
                    <span className="bg-blue-200 px-2 py-0.5 rounded-full">
                      CIN: {userCIN}
                    </span>
                  )}
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  ✅ Vos exports sont identifiés par votre <span className="font-bold">email</span> (et votre CIN si disponible)
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
                  Identifié par email
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
                  Identifié par email
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
                </div>

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-sm text-blue-800">
                    <span className="font-bold">Identification par email:</span> {userEmail}
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

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 mb-3">
                <p className="text-sm text-blue-800">
                  <span className="font-bold">Identification par email:</span> {userEmail}
                </p>
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
                      <option key={index} value={emp.employee_id || emp.email}>
                        {emp.first_name} {emp.last_name} - {emp.cin || ''}
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
            <h3 className="font-semibold text-blue-800">Export du département {user?.department}</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* BOUTON EXCEL */}
            <button
              type="button"
              onClick={async () => {
                try {
                  setExportLoading(true);
                  
                  // Période par défaut : mois en cours
                  const today = new Date();
                  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                  
                  const startDate = firstDay.toISOString().split('T')[0];
                  const endDate = lastDay.toISOString().split('T')[0];
                  
                  console.log(`📤 Export EXCEL pointages du département ${user?.department} du ${startDate} au ${endDate}`);
                  
                  await ExportService.exportAttendanceExcel({
                    startDate: startDate,
                    endDate: endDate,
                    department: user?.department
                  });
                  
                  toast.success(`✅ Export EXCEL des pointages du département ${user?.department} réussi`);
                  
                } catch (error) {
                  console.error('❌ Erreur export département (Excel):', error);
                  
                  if (error.status === 404) {
                    toast.info(`Aucun pointage trouvé pour ${user?.department} sur cette période`);
                  } else if (error.name === 'NetworkError') {
                    toast.error('Erreur de connexion au serveur');
                  } else {
                    toast.error(`Erreur: ${error.message || 'Export échoué'}`);
                  }
                } finally {
                  setExportLoading(false);
                }
              }}
              disabled={exportLoading}
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {exportLoading ? (
                <><FaSpinner className="animate-spin" /> Export Excel en cours...</>
              ) : (
                <><FaFileExcel /> Excel - Pointages {user?.department}</>
              )}
            </button>

            {/* BOUTON PDF */}
            <button
              type="button"
              onClick={async () => {
                try {
                  setExportLoading(true);
                  
                  // Période par défaut : mois en cours
                  const today = new Date();
                  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                  
                  const startDate = firstDay.toISOString().split('T')[0];
                  const endDate = lastDay.toISOString().split('T')[0];
                  
                  console.log(`📤 Export PDF pointages du département ${user?.department} du ${startDate} au ${endDate}`);
                  
                  await ExportService.exportAttendancePDF({
                    startDate: startDate,
                    endDate: endDate,
                    department: user?.department
                  });
                  
                  toast.success(`✅ Export PDF des pointages du département ${user?.department} réussi`);
                  
                } catch (error) {
                  console.error('❌ Erreur export département (PDF):', error);
                  
                  if (error.status === 404) {
                    toast.info(`Aucun pointage trouvé pour ${user?.department} sur cette période`);
                  } else if (error.name === 'NetworkError') {
                    toast.error('Erreur de connexion au serveur');
                  } else {
                    toast.error(`Erreur: ${error.message || 'Export échoué'}`);
                  }
                } finally {
                  setExportLoading(false);
                }
              }}
              disabled={exportLoading}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {exportLoading ? (
                <><FaSpinner className="animate-spin" /> Export PDF en cours...</>
              ) : (
                <><FaFilePdf /> PDF - Pointages {user?.department}</>
              )}
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
          <li className="flex items-start">
            <span className="mr-1">•</span>
            <span className="font-medium">Identification:</span> Vos exports sont liés à votre email <span className="font-mono bg-blue-100 px-1 rounded">{userEmail}</span>
          </li>
          {userCIN && (
            <li className="flex items-start">
              <span className="mr-1">•</span>
              <span className="font-medium">CIN détecté:</span> {userCIN} (utilisé comme fallback)
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default ExportPanel;