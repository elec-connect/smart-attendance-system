// =============================================================================handleDelete 
// EmployeeList.jsx - Version complète avec gestion des shifts
// =============================================================================

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth.jsx';
import { employeeService, shiftService } from '../../services/api.jsx';
import { formatDate, safeFormatDate } from '../../utils/helpers.jsx';
import EmployeeFacialRegistration from './EmployeeFacialRegistration.jsx';
import ShiftAssignmentModal from '../shifts/ShiftAssignmentModal.jsx';
import ShiftHistoryModal from '../shifts/ShiftHistoryModal.jsx';
import { FaSyncAlt } from 'react-icons/fa';
import {
  FaUsers,
  FaPlus,
  FaEdit,
  FaTrash,
  FaSearch,
  FaUserPlus,
  FaCamera,
  FaLock,
  FaToggleOn,
  FaToggleOff,
  FaPowerOff,
  FaCalendarAlt,
  FaHistory,
  FaIdCard,
  FaCheckCircle,
  FaBan,
  FaExclamationTriangle,
  FaTimes
} from 'react-icons/fa';

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [sortField, setSortField] = useState('firstName');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeToToggle, setEmployeeToToggle] = useState(null);
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [updatingEmployee, setUpdatingEmployee] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(true);
  const [storageAvailable, setStorageAvailable] = useState(true);
  
  // États pour enregistrement facial
  const [showFacialModal, setShowFacialModal] = useState(false);
  const [selectedEmployeeForFace, setSelectedEmployeeForFace] = useState(null);
  
  // ⭐ ÉTATS POUR LA GESTION DES SHIFTS
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showShiftHistoryModal, setShowShiftHistoryModal] = useState(false);
  const [selectedEmployeeForShift, setSelectedEmployeeForShift] = useState(null);
  const [employeeShiftInfo, setEmployeeShiftInfo] = useState(null);
  const [loadingShift, setLoadingShift] = useState(false);
  const [availableShifts, setAvailableShifts] = useState([]);
  const [shiftStats, setShiftStats] = useState({});
  
  // État pour le nouvel employé (avec CIN, CNSS et shift)
  const [newEmployee, setNewEmployee] = useState({
    firstName: '',
    lastName: '',
    cin: '',
    cnssNumber: '',
    email: '',
    department: 'IT',
    position: '',
    phone: '',
    hireDate: new Date().toISOString().split('T')[0],
    status: 'active',
    role: 'employee',
    shiftName: 'Shift Standard' // ⭐ NOUVEAU: shift par défaut
  });
  
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // ==================== FONCTION DE NORMALISATION ====================
  const normalizeEmployee = (emp) => {
    if (!emp) return null;
    
    console.log('🔄 Normalisation employé:', emp);
    
    const cnssValue = emp.cnssNumber || emp.cnss_number || '';
    
    return {
      id: emp.id,
      employeeId: emp.employeeId || emp.employee_id || '',
      firstName: emp.firstName || emp.first_name || '',
      lastName: emp.lastName || emp.last_name || '',
      cin: emp.cin || '',
      cnssNumber: cnssValue,
      email: emp.email || '',
      phone: emp.phone || '',
      department: emp.department || '',
      position: emp.position || '',
      status: emp.status || 'active',
      role: emp.role || 'employee',
      isActive: emp.isActive || emp.is_active || true,
      shiftName: emp.shiftName || emp.shift_name || 'Shift Standard', // ⭐ NOUVEAU
      hireDate: emp.hireDate || emp.hire_date || emp.dateEmbauche || emp.startDate || new Date().toISOString().split('T')[0],
      createdAt: emp.createdAt || emp.created_at || emp.dateCreation || new Date().toISOString(),
      updatedAt: emp.updatedAt || emp.updated_at || emp.dateModification || new Date().toISOString()
    };
  };

  const normalizeEmployees = (emps) => {
    if (!Array.isArray(emps)) return [];
    return emps.map(normalizeEmployee).filter(emp => emp !== null);
  };

  // ==================== CHARGEMENT DES DONNÉES ====================
  useEffect(() => {
    checkLocalStorage();
    fetchEmployees();
    loadAvailableShifts(); // ⭐ Charger les shifts disponibles
  }, []);

  useEffect(() => {
    filterAndSortEmployees();
  }, [employees, searchTerm, statusFilter, departmentFilter, sortField, sortDirection]);

  // ⭐ Charger les shifts disponibles depuis les paramètres
  const loadAvailableShifts = async () => {
    try {
      const response = await shiftService.getAvailableShifts();
      if (response.success) {
        setAvailableShifts(response.data);
        console.log('✅ Shifts disponibles chargés:', response.data.length);
      }
    } catch (error) {
      console.error('❌ Erreur chargement shifts:', error);
    }
  };

  // ⭐ Charger les statistiques des shifts
  const loadShiftStats = async () => {
    try {
      const response = await shiftService.getShiftStats();
      if (response.success) {
        setShiftStats(response.data);
      }
    } catch (error) {
      console.error('❌ Erreur chargement stats shifts:', error);
    }
  };

  const checkLocalStorage = () => {
    try {
      if (typeof window === 'undefined') return false;
      const testKey = '__localStorage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      setStorageAvailable(true);
      return true;
    } catch (error) {
      console.warn('localStorage non disponible:', error);
      setStorageAvailable(false);
      return false;
    }
  };

  const fetchEmployees = async (forceRefresh = false) => {
    try {
      setLoading(true);
      console.log('👥 Chargement depuis API...');
      
      const response = await employeeService.getAllEmployees();
      console.log('✅ Réponse API:', response);
      
      if (response?.success === true && Array.isArray(response.data)) {
        console.log('📦 Données brutes API:', response.data.length, 'employés');
        
        const normalized = normalizeEmployees(response.data);
        
        const employeesWithCNSS = normalized.filter(e => e.cnssNumber).length;
        console.log(`✅ ${employeesWithCNSS} employés ont un numéro CNSS`);
        
        setEmployees(normalized);
        setApiAvailable(true);
        
        if (storageAvailable) {
          localStorage.setItem('employees', JSON.stringify(normalized));
          localStorage.setItem('employees_api_backup', JSON.stringify({
            data: normalized,
            timestamp: new Date().toISOString(),
            source: 'api'
          }));
          console.log('💾 Données API sauvegardées dans localStorage');
        }
        
        // Charger les stats des shifts après les employés
        await loadShiftStats();
        
      } else {
        console.warn('⚠️ Réponse API invalide');
        setApiAvailable(false);
        loadLocalData();
      }
    } catch (error) {
      console.error('❌ Erreur API:', error);
      setApiAvailable(false);
      loadLocalData();
    } finally {
      setLoading(false);
    }
  };

  const loadLocalData = () => {
    try {
      const apiBackup = localStorage.getItem('employees_api_backup');
      if (apiBackup) {
        const parsed = JSON.parse(apiBackup);
        if (parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
          console.log('📁 Chargement depuis backup API du', parsed.timestamp);
          const normalized = normalizeEmployees(parsed.data);
          setEmployees(normalized);
          return;
        }
      }
      
      const saved = localStorage.getItem('employees');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log('📁 Chargement depuis localStorage:', parsed.length, 'employés');
          const normalized = normalizeEmployees(parsed);
          setEmployees(normalized);
          return;
        }
      }
      
      console.log('📁 Aucune donnée, chargement données par défaut');
      setDemoData();
      
    } catch (error) {
      console.error('❌ Erreur chargement local:', error);
      setDemoData();
    }
  };

  const saveToLocalStorage = (employeesList) => {
    if (!storageAvailable) return false;
    try {
      localStorage.setItem('employees', JSON.stringify(employeesList));
      console.log('💾 Données sauvegardées:', employeesList.length);
      return true;
    } catch (error) {
      console.error('❌ Erreur sauvegarde:', error);
      return false;
    }
  };

  const setDemoData = () => {
    const demo = normalizeEmployees([
      {
        id: 1,
        employee_id: 'EMP001',
        first_name: 'Admin',
        last_name: 'System',
        cin: '12345678',
        cnss_number: '123456789012345678',
        email: 'admin@entreprise.com',
        department: 'Administration',
        position: 'Administrateur',
        hire_date: '2023-01-01',
        status: 'active',
        phone: '+33 1 23 45 67 89',
        role: 'admin',
        shift_name: 'Shift Standard'
      },
      {
        id: 2,
        employee_id: 'EMP002',
        first_name: 'Sahnoun',
        last_name: 'BEN HAOUALA',
        cin: '06798539',
        cnss_number: '987654321098765432',
        email: 'haouala18@gmail.com',
        department: 'Direction',
        position: 'Manager',
        hire_date: '2026-01-05',
        status: 'active',
        phone: '+216 58 547 340',
        role: 'admin',
        shift_name: 'Shift Standard'
      },
      {
        id: 3,
        employee_id: 'EMP003',
        first_name: 'Marie',
        last_name: 'Martin',
        cin: '87654321',
        cnss_number: '112233445566778899',
        email: 'marie.martin@entreprise.com',
        department: 'Production',
        position: 'Opérateur',
        hire_date: '2026-02-15',
        status: 'active',
        phone: '+33 6 12 34 56 78',
        role: 'employee',
        shift_name: 'Shift Matin'
      },
      {
        id: 4,
        employee_id: 'EMP004',
        first_name: 'Pierre',
        last_name: 'Durand',
        cin: '13579246',
        cnss_number: '998877665544332211',
        email: 'pierre.durand@entreprise.com',
        department: 'Production',
        position: 'Opérateur',
        hire_date: '2026-02-20',
        status: 'active',
        phone: '+33 6 98 76 54 32',
        role: 'employee',
        shift_name: 'Shift Après-midi'
      }
    ]);
    setEmployees(demo);
    saveToLocalStorage(demo);
  };

  // ==================== FILTRES ET TRI ====================
  const filterAndSortEmployees = () => {
    let filtered = [...employees];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(emp => {
        if (!emp) return false;
        return (
          (emp.firstName || '').toLowerCase().includes(term) ||
          (emp.lastName || '').toLowerCase().includes(term) ||
          (emp.email || '').toLowerCase().includes(term) ||
          (emp.employeeId || '').toLowerCase().includes(term) ||
          (emp.department || '').toLowerCase().includes(term) ||
          (emp.position || '').toLowerCase().includes(term) ||
          (emp.cin || '').toLowerCase().includes(term) ||
          (emp.cnssNumber || '').toLowerCase().includes(term) ||
          (emp.shiftName || '').toLowerCase().includes(term) // ⭐ Ajout du shift
        );
      });
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(emp => emp?.status === statusFilter);
    }

    if (departmentFilter !== 'all') {
      filtered = filtered.filter(emp => emp?.department === departmentFilter);
    }

    // Tri
    filtered.sort((a, b) => {
      if (!a || !b) return 0;
      
      let aValue = a[sortField] || '';
      let bValue = b[sortField] || '';

      if (sortField === 'fullName') {
        aValue = `${a.firstName || ''} ${a.lastName || ''}`.trim();
        bValue = `${b.firstName || ''} ${b.lastName || ''}`.trim();
      }

      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredEmployees(filtered);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // ==================== GESTION DES SHIFTS ====================
  
  // ⭐ Fonction pour ouvrir le modal d'assignation de shift
  const handleShiftAssignment = async (employee) => {
    setSelectedEmployeeForShift(employee);
    setLoadingShift(true);
    
    try {
      const response = await shiftService.getEmployeeShiftInfo(employee.employeeId);
      if (response.success) {
        setEmployeeShiftInfo(response.data);
      }
      setShowShiftModal(true);
    } catch (error) {
      toast.error('Erreur lors du chargement des informations de shift');
      console.error('❌ Erreur chargement shift info:', error);
    } finally {
      setLoadingShift(false);
    }
  };

  // ⭐ Fonction pour voir l'historique des shifts
  const handleShiftHistory = async (employee) => {
    setSelectedEmployeeForShift(employee);
    setLoadingShift(true);
    
    try {
      const response = await shiftService.getEmployeeShiftHistory(employee.employeeId, 20);
      if (response.success) {
        setEmployeeShiftInfo(response.data);
      }
      setShowShiftHistoryModal(true);
    } catch (error) {
      toast.error('Erreur lors du chargement de l\'historique');
      console.error('❌ Erreur chargement historique:', error);
    } finally {
      setLoadingShift(false);
    }
  };

  // ⭐ Fonction pour assigner un shift manuellement
  const handleAssignShift = async (data) => {
    try {
      await shiftService.assignManualShift(
        selectedEmployeeForShift.employeeId,
        data
      );
      toast.success('Shift assigné avec succès');
      
      // Mettre à jour l'employé dans la liste
      const updatedEmployees = employees.map(emp => 
        emp.employeeId === selectedEmployeeForShift.employeeId
          ? { ...emp, shiftName: data.shiftName }
          : emp
      );
      setEmployees(updatedEmployees);
      
      // Recharger les infos de shift
      const response = await shiftService.getEmployeeShiftInfo(selectedEmployeeForShift.employeeId);
      if (response.success) {
        setEmployeeShiftInfo(response.data);
      }
      
    } catch (error) {
      toast.error('Erreur lors de l\'assignation');
      throw error;
    }
  };

  // ⭐ Fonction pour supprimer une assignation manuelle
  const handleDeleteManualAssignment = async (assignmentId) => {
    try {
      await shiftService.deleteManualAssignment(assignmentId);
      toast.success('Assignation supprimée');
      
      // Recharger l'historique
      const response = await shiftService.getEmployeeShiftHistory(
        selectedEmployeeForShift.employeeId,
        20
      );
      if (response.success) {
        setEmployeeShiftInfo(response.data);
      }
      
      // Recharger les employés pour mettre à jour le shift actuel
      fetchEmployees();
      
    } catch (error) {
      toast.error('Erreur lors de la suppression');
      console.error('❌ Erreur suppression:', error);
    }
  };

  // ==================== GESTION DES EMPLOYÉS ====================
  const handleAddEmployee = async () => {
    if (!newEmployee.firstName || !newEmployee.lastName || !newEmployee.email || !newEmployee.department || !newEmployee.position) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setAddingEmployee(true);
      
      const employeeData = {
        first_name: newEmployee.firstName,
        last_name: newEmployee.lastName,
        cin: newEmployee.cin || null,
        cnss_number: newEmployee.cnssNumber || null,
        email: newEmployee.email,
        phone: newEmployee.phone || null,
        department: newEmployee.department,
        position: newEmployee.position,
        hire_date: newEmployee.hireDate,
        status: newEmployee.status,
        role: newEmployee.role,
        shift_name: newEmployee.shiftName, // ⭐ Ajout du shift
        is_active: newEmployee.status === 'active'
      };
      
      console.log('📦 Données envoyées à l\'API:', employeeData);
      
      let savedEmployee = null;
      let success = false;
      
      if (apiAvailable) {
        try {
          const response = await employeeService.createEmployee(employeeData);
          console.log('📦 Réponse API création:', response);
          
          if (response?.success && response?.data) {
            savedEmployee = normalizeEmployee(response.data);
            success = true;
            toast.success('Employé ajouté avec succès');
          }
        } catch (error) {
          console.error('❌ Erreur API:', error);
          setApiAvailable(false);
        }
      }
      
      if (!success) {
        const nextId = employees.length > 0 ? Math.max(...employees.map(e => e.id || 0)) + 1 : 1;
        savedEmployee = normalizeEmployee({
          id: nextId,
          employee_id: `EMP${String(nextId).padStart(3, '0')}`,
          first_name: newEmployee.firstName,
          last_name: newEmployee.lastName,
          cin: newEmployee.cin,
          cnss_number: newEmployee.cnssNumber,
          email: newEmployee.email,
          phone: newEmployee.phone,
          department: newEmployee.department,
          position: newEmployee.position,
          hire_date: newEmployee.hireDate,
          status: newEmployee.status,
          role: newEmployee.role,
          shift_name: newEmployee.shiftName
        });
        success = true;
        toast.success('Employé ajouté (mode local)');
      }
      
      if (success && savedEmployee) {
        const updated = [...employees, savedEmployee];
        setEmployees(updated);
        saveToLocalStorage(updated);
      }
      
      setNewEmployee({
        firstName: '',
        lastName: '',
        cin: '',
        cnssNumber: '',
        email: '',
        department: 'IT',
        position: '',
        phone: '',
        hireDate: new Date().toISOString().split('T')[0],
        status: 'active',
        role: 'employee',
        shiftName: 'Shift Standard'
      });
      
      setShowAddModal(false);
      
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast.error(`Erreur lors de l'ajout: ${error.message}`);
    } finally {
      setAddingEmployee(false);
    }
  };

  const handleEdit = (employee) => {
    console.log('✏️ Modification employé:', employee);
    setSelectedEmployee({...employee});
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedEmployee) return;

    try {
      setUpdatingEmployee(true);
      
      const employeeData = {
        first_name: selectedEmployee.firstName,
        last_name: selectedEmployee.lastName,
        cin: selectedEmployee.cin || null,
        cnss_number: selectedEmployee.cnssNumber || null,
        email: selectedEmployee.email,
        phone: selectedEmployee.phone || null,
        department: selectedEmployee.department,
        position: selectedEmployee.position,
        hire_date: selectedEmployee.hireDate,
        status: selectedEmployee.status,
        role: selectedEmployee.role,
        shift_name: selectedEmployee.shiftName, // ⭐ Ajout du shift
        is_active: selectedEmployee.status === 'active'
      };
      
      console.log('📦 Données mise à jour:', employeeData);
      
      let updatedEmployee = null;
      let success = false;
      
      if (apiAvailable) {
        try {
          const employeeId = selectedEmployee.id || selectedEmployee.employeeId;
          const response = await employeeService.updateEmployee(employeeId, employeeData);
          console.log('📦 Réponse API mise à jour:', response);
          
          if (response?.success && response?.data) {
            updatedEmployee = normalizeEmployee(response.data);
            success = true;
            toast.success('Employé mis à jour');
          }
        } catch (error) {
          console.error('❌ Erreur API:', error);
          setApiAvailable(false);
        }
      }
      
      if (!success) {
        updatedEmployee = {
          ...selectedEmployee,
          updatedAt: new Date().toISOString()
        };
        success = true;
        toast.success('Employé mis à jour (mode local)');
      }
      
      if (success && updatedEmployee) {
        const updated = employees.map(emp => 
          emp.id === selectedEmployee.id ? updatedEmployee : emp
        );
        setEmployees(updated);
        saveToLocalStorage(updated);
      }
      
      setShowEditModal(false);
      setSelectedEmployee(null);
      
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast.error(`Erreur lors de la mise à jour: ${error.message}`);
    } finally {
      setUpdatingEmployee(false);
    }
  };

  const handleDelete = async (employee) => {
  if (!isAdmin) {
    toast.error('Seul l\'administrateur peut supprimer des employés');
    return;
  }

  try {
    setDeletingEmployee(true);
    
    // ========== ÉTAPE 1: DEMANDE DE CONFIRMATION ==========
    console.log('🔄 ÉTAPE 1: Demande de confirmation pour', employee.employeeId);
    
    const firstResponse = await fetch(`/api/employees/${employee.id}/force`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}) // Pas de confirm
    });

    const firstData = await firstResponse.json();
    console.log('📦 Réponse étape 1:', firstData);

    // Si l'API demande une confirmation
    if (firstData.requiresConfirmation) {
      // Afficher une boîte de dialogue détaillée
      const employeeInfo = firstData.employeeInfo;
      const details = firstData.details;
      
      // Construire le message de confirmation
      let message = `⚠️ SUPPRESSION DÉFINITIVE\n\n`;
      message += `Employé: ${employeeInfo.fullName}\n`;
      message += `Email: ${employeeInfo.email}\n`;
      message += `Département: ${employeeInfo.department}\n\n`;
      
      if (details.totalDependencies > 0) {
        message += `📋 Données qui seront supprimées:\n`;
        if (details.attendanceRecords > 0) message += `   • ${details.attendanceRecords} présence(s)\n`;
        if (details.facialLogs > 0) message += `   • ${details.facialLogs} log(s) facial(iaux)\n`;
        if (details.facialEncodings > 0) message += `   • ${details.facialEncodings} encodage(s)\n`;
        message += `\n`;
      }
      
      message += `🚨 CETTE ACTION EST IRREVERSIBLE !\n\n`;
      message += `Pour confirmer, tapez "SUPPRIMER" dans le champ ci-dessous:`;

      // Demander confirmation à l'utilisateur
      const confirmationInput = prompt(message, '');
      
      if (confirmationInput !== 'SUPPRIMER') {
        toast.error('Suppression annulée - confirmation incorrecte');
        setDeletingEmployee(false);
        return;
      }
      
      // Demander la raison (optionnelle)
      const reason = prompt('Raison de la suppression (optionnelle):', '');
      
      // ========== ÉTAPE 2: DEUXIÈME APPEL AVEC CONFIRMATION ==========
      console.log('🔄 ÉTAPE 2: Envoi de la confirmation');
      
      const secondResponse = await fetch(`/api/employees/${employee.id}/force`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          confirm: true,
          reason: reason || 'Non spécifiée'
        })
      });

      const secondData = await secondResponse.json();
      console.log('📦 Réponse étape 2:', secondData);

      if (secondResponse.ok && secondData.success) {
        toast.success(secondData.message || '✅ Employé supprimé définitivement');
        
        // Mise à jour de la liste locale
        const updatedEmployees = employees.filter(e => e.id !== employee.id);
        setEmployees(updatedEmployees);
        saveToLocalStorage(updatedEmployees);
        
        // Recharger depuis l'API pour être sûr
        setTimeout(() => fetchEmployees(), 500);
      } else {
        toast.error(secondData.message || 'Erreur lors de la suppression');
      }
      
    } else if (firstData.success) {
      // Cas où l'API supprime directement (peut-être pas de confirmation requise)
      toast.success(firstData.message || '✅ Employé supprimé');
      fetchEmployees();
    } else {
      toast.error(firstData.message || 'Erreur lors de la suppression');
    }
    
  } catch (error) {
    console.error('❌ Erreur suppression:', error);
    
    // Fallback: suppression locale
    if (window.confirm('Erreur de communication. Supprimer localement ?')) {
      const updated = employees.filter(e => e.id !== employee.id);
      setEmployees(updated);
      saveToLocalStorage(updated);
      toast.success('Employé supprimé localement');
    } else {
      toast.error('Erreur lors de la suppression');
    }
  } finally {
    setDeletingEmployee(false);
  }
};

  // ==================== ACTIVATION/DÉSACTIVATION ====================
  const handleActivateEmployee = async () => {
    if (!employeeToToggle) return;
    
    try {
      setTogglingStatus(true);
      
      if (!apiAvailable) {
        const updatedEmployees = employees.map(emp => 
          emp.id === employeeToToggle.id 
            ? { ...emp, status: 'active', isActive: true }
            : emp
        );
        setEmployees(updatedEmployees);
        saveToLocalStorage(updatedEmployees);
        toast.success(`✅ ${employeeToToggle.firstName} ${employeeToToggle.lastName} activé`);
        setShowActivateModal(false);
        setEmployeeToToggle(null);
        return;
      }
      
      const response = await employeeService.activateEmployee(employeeToToggle.id);
      
      if (response?.success) {
        const updatedEmployees = employees.map(emp => 
          emp.id === employeeToToggle.id 
            ? { ...emp, status: 'active', isActive: true }
            : emp
        );
        setEmployees(updatedEmployees);
        saveToLocalStorage(updatedEmployees);
        toast.success(`✅ ${employeeToToggle.firstName} ${employeeToToggle.lastName} activé`);
      } else {
        toast.error('Erreur lors de l\'activation');
      }
      
    } catch (error) {
      console.error('❌ Erreur activation:', error);
      toast.error('Erreur lors de l\'activation');
    } finally {
      setTogglingStatus(false);
      setShowActivateModal(false);
      setEmployeeToToggle(null);
    }
  };

  const handleDeactivateEmployee = async () => {
    if (!employeeToToggle) return;
    
    try {
      setTogglingStatus(true);
      
      if (!apiAvailable) {
        const updatedEmployees = employees.map(emp => 
          emp.id === employeeToToggle.id 
            ? { ...emp, status: 'inactive', isActive: false }
            : emp
        );
        setEmployees(updatedEmployees);
        saveToLocalStorage(updatedEmployees);
        toast.success(`⏸️ ${employeeToToggle.firstName} ${employeeToToggle.lastName} désactivé`);
        setShowDeactivateModal(false);
        setEmployeeToToggle(null);
        return;
      }
      
      const response = await employeeService.deactivateEmployee(employeeToToggle.id);
      
      if (response?.success) {
        const updatedEmployees = employees.map(emp => 
          emp.id === employeeToToggle.id 
            ? { ...emp, status: 'inactive', isActive: false }
            : emp
        );
        setEmployees(updatedEmployees);
        saveToLocalStorage(updatedEmployees);
        toast.success(`⏸️ ${employeeToToggle.firstName} ${employeeToToggle.lastName} désactivé`);
      } else {
        toast.error('Erreur lors de la désactivation');
      }
      
    } catch (error) {
      console.error('❌ Erreur désactivation:', error);
      toast.error('Erreur lors de la désactivation');
    } finally {
      setTogglingStatus(false);
      setShowDeactivateModal(false);
      setEmployeeToToggle(null);
    }
  };

  const confirmToggleStatus = (employee, action) => {
    setEmployeeToToggle(employee);
    if (action === 'activate') {
      setShowActivateModal(true);
    } else {
      setShowDeactivateModal(true);
    }
  };

  const handleFacialRegistration = (employee) => {
    setSelectedEmployeeForFace(employee);
    setShowFacialModal(true);
  };

  const clearLocalData = () => {
    if (window.confirm('Voulez-vous vraiment effacer toutes les données locales ?')) {
      localStorage.removeItem('employees');
      localStorage.removeItem('employees_api_backup');
      toast.success('Données locales effacées');
      setDemoData();
    }
  };

  // ==================== FONCTIONS D'AFFICHAGE ====================
  
  const getStatusBadge = (status) => {
    const config = {
      active: { 
        color: 'bg-green-100 text-green-800 border border-green-200', 
        label: 'Actif',
        icon: <FaCheckCircle className="inline mr-1 text-green-600" size={12} />
      },
      inactive: { 
        color: 'bg-red-100 text-red-800 border border-red-200', 
        label: 'Inactif',
        icon: <FaBan className="inline mr-1 text-red-600" size={12} />
      },
      suspended: { 
        color: 'bg-yellow-100 text-yellow-800 border border-yellow-200', 
        label: 'Suspendu',
        icon: <FaExclamationTriangle className="inline mr-1 text-yellow-600" size={12} />
      }
    };
    const c = config[status] || config.inactive;
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${c.color}`}>
        {c.icon}
        {c.label}
      </span>
    );
  };

  const getRoleBadge = (role) => {
    const config = {
      admin: { color: 'bg-purple-100 text-purple-800 border border-purple-200', label: 'Admin' },
      manager: { color: 'bg-blue-100 text-blue-800 border border-blue-200', label: 'Manager' },
      employee: { color: 'bg-gray-100 text-gray-800 border border-gray-200', label: 'Employé' }
    };
    const c = config[role] || config.employee;
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${c.color}`}>
        {c.label}
      </span>
    );
  };

  // ⭐ Fonction pour obtenir la couleur du badge shift
  const getShiftBadgeColor = (shiftName) => {
    if (shiftName?.includes('Matin')) return 'bg-green-100 text-green-800 border-green-200';
    if (shiftName?.includes('Après-midi')) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (shiftName?.includes('Nuit')) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (shiftName?.includes('Standard')) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // ⭐ Fonction pour obtenir l'icône du shift
  const getShiftIcon = (shiftName) => {
    if (shiftName?.includes('Matin')) return '🌅';
    if (shiftName?.includes('Après-midi')) return '☀️';
    if (shiftName?.includes('Nuit')) return '🌙';
    return '🕒';
  };

  // ==================== RENDU DES ACTIONS ====================
  const renderActions = (employee) => (
    <div className="flex space-x-2 items-center">
      {/* Bouton Activer/Désactiver */}
      {employee.status === 'active' ? (
        <button
          onClick={() => confirmToggleStatus(employee, 'deactivate')}
          className="text-orange-600 hover:text-orange-900 transition-colors"
          title="Désactiver l'employé"
        >
          <FaToggleOn size={20} className="text-green-600 hover:text-orange-600" />
        </button>
      ) : (
        <button
          onClick={() => confirmToggleStatus(employee, 'activate')}
          className="text-green-600 hover:text-green-900 transition-colors"
          title="Activer l'employé"
        >
          <FaToggleOff size={20} className="text-gray-400 hover:text-green-600" />
        </button>
      )}
      
      {/* ⭐ Bouton Assigner Shift */}
      <button
        onClick={() => handleShiftAssignment(employee)}
        className="text-indigo-600 hover:text-indigo-900 transition-colors"
        title="Gérer les shifts"
      >
        <FaCalendarAlt size={18} />
      </button>
      
      {/* ⭐ Bouton Historique des shifts */}
      <button
        onClick={() => handleShiftHistory(employee)}
        className="text-teal-600 hover:text-teal-900 transition-colors"
        title="Historique des shifts"
      >
        <FaHistory size={18} />
      </button>
      
      {/* Bouton Modifier */}
      <button
        onClick={() => handleEdit(employee)}
        className="text-blue-600 hover:text-blue-900 transition-colors"
        title="Modifier"
      >
        <FaEdit size={18} />
      </button>
      
      {/* Bouton Enregistrement facial */}
      <button
        onClick={() => handleFacialRegistration(employee)}
        className="text-purple-600 hover:text-purple-900 transition-colors"
        title="Enregistrer le visage"
      >
        <FaCamera size={18} />
      </button>
      
      {/* Bouton Supprimer (admin seulement) */}
      {isAdmin && (
        <button
          onClick={() => handleDelete(employee)}
          className="text-red-600 hover:text-red-900 transition-colors"
          title="Supprimer"
          disabled={deletingEmployee}
        >
          <FaTrash size={18} />
        </button>
      )}
    </div>
  );

  // ⭐ Rendu de la cellule shift
  const renderShiftCell = (employee) => {
    const shiftColor = getShiftBadgeColor(employee.shiftName);
    const shiftIcon = getShiftIcon(employee.shiftName);
    
    return (
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${shiftColor}`}>
            <span className="mr-1">{shiftIcon}</span>
            {employee.shiftName || 'Shift Standard'}
          </span>
          {employee.shiftSource === 'manual' && (
            <span className="text-xs text-gray-500" title="Assignation manuelle">
              📌
            </span>
          )}
        </div>
      </td>
    );
  };

  // ==================== RENDU PRINCIPAL ====================
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaLock className="text-red-600 text-3xl" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Accès Restreint</h2>
          <p className="text-gray-600 mb-6">
            Seuls les administrateurs peuvent accéder à la gestion des employés.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <p className="mt-4 text-gray-600">Chargement des employés...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-xl p-6 text-white">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center">
              <FaUsers className="mr-3" />
              Gestion des Employés
            </h1>
            <p className="opacity-90 mt-1">
              {filteredEmployees.length} employé{filteredEmployees.length !== 1 ? 's' : ''}
              {!apiAvailable && (
                <span className="ml-2 text-yellow-300 text-sm">(Mode local)</span>
              )}
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => fetchEmployees(true)}
              className="px-4 py-2 bg-white text-primary-600 font-medium rounded-lg hover:bg-gray-100 transition-colors flex items-center"
              title="Rafraîchir les données depuis le serveur"
            >
              <FaSyncAlt className="mr-2" />
              Rafraîchir
            </button>
            
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-white text-primary-600 font-medium rounded-lg hover:bg-gray-100 transition-colors flex items-center"
            >
              <FaUserPlus className="mr-2" />
              Ajouter un employé
            </button>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher
            </label>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Nom, email, CIN, CNSS, shift..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
              <option value="suspended">Suspendu</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Département
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Tous les départements</option>
              {[...new Set(employees.map(e => e.department).filter(Boolean))].map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Statistiques des shifts (optionnel) */}
      {Object.keys(shiftStats).length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Répartition par shift</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {availableShifts.map(shift => (
              <div key={shift.key} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{shift.name}</span>
                  <span className="text-xs text-gray-500">{shift.start} - {shift.end}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {shiftStats[shift.name]?.count || 0}
                  </span>
                  <span className="text-xs text-gray-500">
                    employés
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tableau des employés */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employé
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    <FaIdCard className="mr-1" />
                    CIN
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    <FaIdCard className="mr-1" />
                    CNSS
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Département
                </th>
                {/* ⭐ NOUVELLE COLONNE SHIFT */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shift Actuel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut & Rôle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date embauche
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-6 py-12 text-center text-gray-500">
                    Aucun employé trouvé
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {employee.employeeId}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold flex-shrink-0">
                          {employee.firstName?.[0]}{employee.lastName?.[0]}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {employee.firstName} {employee.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {employee.position}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{employee.email}</div>
                      <div className="text-sm text-gray-500">{employee.phone || '—'}</div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center">
                        <FaIdCard className="mr-2 text-gray-400 flex-shrink-0" />
                        <span className="truncate max-w-[100px]" title={employee.cin}>
                          {employee.cin || '—'}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                      <div className="flex items-center">
                        <FaIdCard className="mr-2 text-gray-400 flex-shrink-0" />
                        <span className="truncate max-w-[180px]" title={employee.cnssNumber}>
                          {employee.cnssNumber || '—'}
                        </span>
                      </div>
                      {employee.cnssNumber && (
                        <div className="text-xs text-green-600 mt-1">
                          ✓ CNSS
                        </div>
                      )}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {employee.department}
                    </td>
                    
                    {/* ⭐ CELLULE SHIFT */}
                    {renderShiftCell(employee)}
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        {getStatusBadge(employee.status)}
                        {getRoleBadge(employee.role)}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {renderActions(employee)}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {safeFormatDate(employee.hireDate, '-')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL D'AJOUT (modifié pour inclure le shift) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Ajouter un employé</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Prénom *</label>
                  <input
                    type="text"
                    value={newEmployee.firstName}
                    onChange={(e) => setNewEmployee({...newEmployee, firstName: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nom *</label>
                  <input
                    type="text"
                    value={newEmployee.lastName}
                    onChange={(e) => setNewEmployee({...newEmployee, lastName: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">CIN</label>
                  <input
                    type="text"
                    value={newEmployee.cin}
                    onChange={(e) => setNewEmployee({...newEmployee, cin: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    maxLength="20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">N° CNSS</label>
                  <input
                    type="text"
                    value={newEmployee.cnssNumber}
                    onChange={(e) => setNewEmployee({...newEmployee, cnssNumber: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg font-mono"
                    maxLength="18"
                    placeholder="123456789012345678"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={newEmployee.phone}
                  onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Département *</label>
                  <select
                    value={newEmployee.department}
                    onChange={(e) => setNewEmployee({...newEmployee, department: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Sélectionner</option>
                    <option value="IT">IT</option>
                    <option value="RH">RH</option>
                    <option value="Finance">Finance</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Ventes">Ventes</option>
                    <option value="Production ch1">Production ch1</option>
                    <option value="Production ch2">Production ch2</option>
                    <option value="Production ch3">Production ch3</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Administration">Administration</option>
                    <option value="Support">Support</option>
                    <option value="Direction">Direction</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Poste *</label>
                  <input
                    type="text"
                    value={newEmployee.position}
                    onChange={(e) => setNewEmployee({...newEmployee, position: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              {/* ⭐ NOUVEAU: Sélection du shift */}
              <div>
                <label className="block text-sm font-medium mb-1">Shift</label>
                <select
                  value={newEmployee.shiftName}
                  onChange={(e) => setNewEmployee({...newEmployee, shiftName: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {availableShifts.map(shift => (
                    <option key={shift.key} value={shift.name}>
                      {shift.name} ({shift.start} - {shift.end})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Le shift peut être modifié ultérieurement via le bouton calendrier
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date embauche</label>
                  <input
                    type="date"
                    value={newEmployee.hireDate}
                    onChange={(e) => setNewEmployee({...newEmployee, hireDate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Statut</label>
                  <select
                    value={newEmployee.status}
                    onChange={(e) => setNewEmployee({...newEmployee, status: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="active">Actif</option>
                    <option value="inactive">Inactif</option>
                    <option value="suspended">Suspendu</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rôle</label>
                  <select
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee({...newEmployee, role: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="employee">Employé</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-lg"
                  disabled={addingEmployee}
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddEmployee}
                  disabled={addingEmployee}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  {addingEmployee ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL D'ÉDITION (modifié pour inclure le shift) */}
      {showEditModal && selectedEmployee && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Modifier l'employé</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedEmployee(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Prénom *</label>
                  <input
                    type="text"
                    value={selectedEmployee.firstName || ''}
                    onChange={(e) => setSelectedEmployee({...selectedEmployee, firstName: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nom *</label>
                  <input
                    type="text"
                    value={selectedEmployee.lastName || ''}
                    onChange={(e) => setSelectedEmployee({...selectedEmployee, lastName: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">CIN</label>
                  <input
                    type="text"
                    value={selectedEmployee.cin || ''}
                    onChange={(e) => setSelectedEmployee({...selectedEmployee, cin: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    maxLength="20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">N° CNSS</label>
                  <input
                    type="text"
                    value={selectedEmployee.cnssNumber || ''}
                    onChange={(e) => setSelectedEmployee({...selectedEmployee, cnssNumber: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg font-mono"
                    maxLength="18"
                    placeholder="123456789012345678"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  value={selectedEmployee.email || ''}
                  onChange={(e) => setSelectedEmployee({...selectedEmployee, email: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={selectedEmployee.phone || ''}
                  onChange={(e) => setSelectedEmployee({...selectedEmployee, phone: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Département *</label>
                  <select
                    value={selectedEmployee.department || ''}
                    onChange={(e) => setSelectedEmployee({...selectedEmployee, department: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Sélectionner</option>
                    <option value="IT">IT</option>
                    <option value="RH">RH</option>
                    <option value="Finance">Finance</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Ventes">Ventes</option>
                    <option value="Production ch1">Production ch1</option>
                    <option value="Production ch2">Production ch2</option>
                    <option value="Production ch3">Production ch3</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Administration">Administration</option>
                    <option value="Support">Support</option>
                    <option value="Direction">Direction</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Poste *</label>
                  <input
                    type="text"
                    value={selectedEmployee.position || ''}
                    onChange={(e) => setSelectedEmployee({...selectedEmployee, position: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {/* ⭐ NOUVEAU: Sélection du shift */}
              <div>
                <label className="block text-sm font-medium mb-1">Shift</label>
                <select
                  value={selectedEmployee.shiftName || 'Shift Standard'}
                  onChange={(e) => setSelectedEmployee({...selectedEmployee, shiftName: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {availableShifts.map(shift => (
                    <option key={shift.key} value={shift.name}>
                      {shift.name} ({shift.start} - {shift.end})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Vous pouvez aussi utiliser le bouton calendrier pour une gestion avancée
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date embauche</label>
                  <input
                    type="date"
                    value={selectedEmployee.hireDate ? selectedEmployee.hireDate.split('T')[0] : ''}
                    onChange={(e) => setSelectedEmployee({...selectedEmployee, hireDate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Statut</label>
                  <select
                    value={selectedEmployee.status || 'active'}
                    onChange={(e) => setSelectedEmployee({...selectedEmployee, status: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="active">Actif</option>
                    <option value="inactive">Inactif</option>
                    <option value="suspended">Suspendu</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rôle</label>
                  <select
                    value={selectedEmployee.role || 'employee'}
                    onChange={(e) => setSelectedEmployee({...selectedEmployee, role: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="employee">Employé</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedEmployee(null);
                  }}
                  className="px-4 py-2 border rounded-lg"
                  disabled={updatingEmployee}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={updatingEmployee}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  {updatingEmployee ? 'Mise à jour...' : 'Mettre à jour'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMATION ACTIVATION */}
      {showActivateModal && employeeToToggle && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-green-700 flex items-center">
                <FaToggleOn className="mr-2" />
                Confirmation d'activation
              </h3>
              <button 
                onClick={() => {
                  setShowActivateModal(false);
                  setEmployeeToToggle(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                Êtes-vous sûr de vouloir <span className="font-bold text-green-600">activer</span> l'employé suivant ?
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium">{employeeToToggle.firstName} {employeeToToggle.lastName}</p>
                <p className="text-sm text-gray-600">{employeeToToggle.email}</p>
                <p className="text-sm text-gray-600">{employeeToToggle.department} - {employeeToToggle.shiftName}</p>
              </div>
              <p className="text-sm text-gray-500 mt-3">
                L'employé pourra à nouveau se connecter et pointer.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowActivateModal(false);
                  setEmployeeToToggle(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                disabled={togglingStatus}
              >
                Annuler
              </button>
              <button
                onClick={handleActivateEmployee}
                disabled={togglingStatus}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
              >
                {togglingStatus ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Activation...
                  </>
                ) : (
                  <>
                    <FaToggleOn className="mr-2" />
                    Activer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMATION DÉSACTIVATION */}
      {showDeactivateModal && employeeToToggle && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-orange-700 flex items-center">
                <FaPowerOff className="mr-2" />
                Confirmation de désactivation
              </h3>
              <button 
                onClick={() => {
                  setShowDeactivateModal(false);
                  setEmployeeToToggle(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                Êtes-vous sûr de vouloir <span className="font-bold text-orange-600">désactiver</span> l'employé suivant ?
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium">{employeeToToggle.firstName} {employeeToToggle.lastName}</p>
                <p className="text-sm text-gray-600">{employeeToToggle.email}</p>
                <p className="text-sm text-gray-600">{employeeToToggle.department} - {employeeToToggle.shiftName}</p>
              </div>
              <p className="text-sm text-red-500 mt-3">
                ⚠️ L'employé ne pourra plus se connecter ni pointer tant qu'il ne sera pas réactivé.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeactivateModal(false);
                  setEmployeeToToggle(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                disabled={togglingStatus}
              >
                Annuler
              </button>
              <button
                onClick={handleDeactivateEmployee}
                disabled={togglingStatus}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center"
              >
                {togglingStatus ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Désactivation...
                  </>
                ) : (
                  <>
                    <FaPowerOff className="mr-2" />
                    Désactiver
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ MODAL ASSIGNATION SHIFT */}
      {showShiftModal && selectedEmployeeForShift && (
        <ShiftAssignmentModal
          employee={selectedEmployeeForShift}
          shiftInfo={employeeShiftInfo}
          availableShifts={availableShifts}
          onClose={() => {
            setShowShiftModal(false);
            setSelectedEmployeeForShift(null);
            setEmployeeShiftInfo(null);
          }}
          onSave={handleAssignShift}
        />
      )}

      {/* ⭐ MODAL HISTORIQUE SHIFTS */}
      {showShiftHistoryModal && selectedEmployeeForShift && (
        <ShiftHistoryModal
          employee={selectedEmployeeForShift}
          history={employeeShiftInfo?.history || []}
          onClose={() => {
            setShowShiftHistoryModal(false);
            setSelectedEmployeeForShift(null);
            setEmployeeShiftInfo(null);
          }}
          onDeleteManual={handleDeleteManualAssignment}
        />
      )}

      {/* MODAL ENREGISTREMENT FACIAL */}
      {showFacialModal && selectedEmployeeForFace && (
        <EmployeeFacialRegistration
          employee={selectedEmployeeForFace}
          onComplete={() => {
            setShowFacialModal(false);
            setSelectedEmployeeForFace(null);
            toast.success('Visage enregistré');
            fetchEmployees(); // Recharger pour mettre à jour le statut facial
          }}
          onCancel={() => {
            setShowFacialModal(false);
            setSelectedEmployeeForFace(null);
          }}
        />
      )}
    </div>
  );
};

export default EmployeeList;