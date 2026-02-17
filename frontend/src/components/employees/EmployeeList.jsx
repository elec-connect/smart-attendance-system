// =============================================================================
// EmployeeList.jsx - Version corrigée avec CNSS
// =============================================================================handleDelete  

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth.jsx';
import { employeeService } from '../../services/api.jsx';
import { formatDate, safeFormatDate } from '../../utils/helpers.jsx';
import EmployeeFacialRegistration from './EmployeeFacialRegistration.jsx';
import { FaSyncAlt } from 'react-icons/fa';
import {
  FaUsers,
  FaPlus,
  FaEdit,
  FaTrash,
  FaSearch,
  FaFilter,
  FaUserPlus,
  FaUserCheck,
  FaUserTimes,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaEnvelope,
  FaPhone,
  FaBuilding,
  FaBriefcase,
  FaCalendarAlt,
  FaTimes,
  FaExclamationTriangle,
  FaDatabase,
  FaCheckCircle,
  FaCamera,
  FaSave,
  FaBan,
  FaIdCard,
  FaLock
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
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [updatingEmployee, setUpdatingEmployee] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(true);
  const [storageAvailable, setStorageAvailable] = useState(true);
  
  // États pour enregistrement facial
  const [showFacialModal, setShowFacialModal] = useState(false);
  const [selectedEmployeeForFace, setSelectedEmployeeForFace] = useState(null);
  
  // État pour le nouvel employé (avec CIN et CNSS)
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
    role: 'employee'
  });
  
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // ==================== FONCTION DE NORMALISATION AVEC CNSS ====================
  const normalizeEmployee = (emp) => {
    if (!emp) return null;
    
    console.log('🔄 Normalisation employé:', emp);
    
    // ✅ IMPORTANT: Récupérer cnss_number de la BD (snake_case)
    const cnssValue = emp.cnssNumber || emp.cnss_number || '';
    
    return {
      id: emp.id,
      employeeId: emp.employeeId || emp.employee_id || '',
      firstName: emp.firstName || emp.first_name || '',
      lastName: emp.lastName || emp.last_name || '',
      cin: emp.cin || '',
      cnssNumber: cnssValue, // ← Toujours utiliser cnssNumber en camelCase dans le frontend
      email: emp.email || '',
      phone: emp.phone || '',
      department: emp.department || '',
      position: emp.position || '',
      status: emp.status || 'active',
      role: emp.role || 'employee',
      isActive: emp.isActive || emp.is_active || true,
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
  }, []);

  useEffect(() => {
    filterAndSortEmployees();
  }, [employees, searchTerm, statusFilter, departmentFilter, sortField, sortDirection]);

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
      
      // Vérifier que le CNSS est bien présent
      const employeesWithCNSS = normalized.filter(e => e.cnssNumber).length;
      console.log(`✅ ${employeesWithCNSS} employés ont un numéro CNSS`);
      
      setEmployees(normalized);
      setApiAvailable(true);
      
      // TOUJOURS sauvegarder dans localStorage avec les dernières données
      if (storageAvailable) {
        localStorage.setItem('employees', JSON.stringify(normalized));
        localStorage.setItem('employees_api_backup', JSON.stringify({
          data: normalized,
          timestamp: new Date().toISOString(),
          source: 'api'
        }));
        console.log('💾 Données API sauvegardées dans localStorage');
      }
    } else {
      console.warn('⚠️ Réponse API invalide');
      setApiAvailable(false);
      
      // En cas d'échec API, charger depuis localStorage
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
    // Essayer de charger depuis le backup API d'abord (le plus récent)
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
    
    // Sinon charger depuis employees
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
    
    // Données par défaut
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
        cnss_number: '123456789012345678', // 18 caractères
        email: 'admin@entreprise.com',
        department: 'Administration',
        position: 'Administrateur',
        hire_date: '2023-01-01',
        status: 'active',
        phone: '+33 1 23 45 67 89',
        role: 'admin'
      },
      {
        id: 2,
        employee_id: 'EMP002',
        first_name: 'Sahnoun',
        last_name: 'BEN HAOUALA',
        cin: '06798539',
        cnss_number: '987654321098765432', // 18 caractères
        email: 'haouala18@gmail.com',
        department: 'Direction',
        position: 'Manager',
        hire_date: '2026-01-05',
        status: 'active',
        phone: '+216 58 547 340',
        role: 'admin'
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
          (emp.cnssNumber || '').toLowerCase().includes(term)
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

  // ==================== GESTION DES EMPLOYÉS ====================
  const handleAddEmployee = async () => {
    if (!newEmployee.firstName || !newEmployee.lastName || !newEmployee.email || !newEmployee.department || !newEmployee.position) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setAddingEmployee(true);
      
      // ✅ Envoyer cnss_number à l'API (snake_case)
      const employeeData = {
        first_name: newEmployee.firstName,
        last_name: newEmployee.lastName,
        cin: newEmployee.cin || null,
        cnss_number: newEmployee.cnssNumber || null, // ← Important: snake_case pour la BD
        email: newEmployee.email,
        phone: newEmployee.phone || null,
        department: newEmployee.department,
        position: newEmployee.position,
        hire_date: newEmployee.hireDate,
        status: newEmployee.status,
        role: newEmployee.role,
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
          cnss_number: newEmployee.cnssNumber, // ← Important: garder cnss_number
          email: newEmployee.email,
          phone: newEmployee.phone,
          department: newEmployee.department,
          position: newEmployee.position,
          hire_date: newEmployee.hireDate,
          status: newEmployee.status,
          role: newEmployee.role
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
        role: 'employee'
      });
      
      setShowAddModal(false);
      
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast.error('Erreur lors de l\'ajout');
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
      
      // ✅ Envoyer cnss_number à l'API (snake_case)
      const employeeData = {
        first_name: selectedEmployee.firstName,
        last_name: selectedEmployee.lastName,
        cin: selectedEmployee.cin || null,
        cnss_number: selectedEmployee.cnssNumber || null, // ← Important: snake_case pour la BD
        email: selectedEmployee.email,
        phone: selectedEmployee.phone || null,
        department: selectedEmployee.department,
        position: selectedEmployee.position,
        hire_date: selectedEmployee.hireDate,
        status: selectedEmployee.status,
        role: selectedEmployee.role,
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
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setUpdatingEmployee(false);
    }
  };

  // ✅ FONCTION SUPPRIMER
  const handleDelete = async (employee) => {
    if (!isAdmin) {
      toast.error('Seul l\'administrateur peut supprimer des employés');
      return;
    }

    const confirmed = window.confirm(
      `Voulez-vous vraiment supprimer définitivement l'employé ${employee.firstName} ${employee.lastName} ?\n\n` +
      `⚠️ Cette action est IRREVERSIBLE !`
    );
    
    if (!confirmed) return;
    
    const confirmText = prompt(
      `Pour confirmer, tapez "DELETE" :`
    );
    
    if (confirmText !== 'DELETE') {
      toast.error('Suppression annulée');
      return;
    }
    
    try {
      setDeletingEmployee(true);
      
      if (!apiAvailable) {
        const updated = employees.filter(e => e.id !== employee.id);
        setEmployees(updated);
        saveToLocalStorage(updated);
        toast.success('Employé supprimé (mode local)');
        return;
      }
      
      const response = await fetch(`/api/employees/${employee.id}/force`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        toast.success('✅ Employé supprimé');
        fetchEmployees();
      } else {
        toast.error(result.message || 'Erreur lors de la suppression');
      }
      
    } catch (error) {
      console.error('❌ Erreur suppression:', error);
      const updated = employees.filter(e => e.id !== employee.id);
      setEmployees(updated);
      saveToLocalStorage(updated);
      toast.success('Employé supprimé localement');
    } finally {
      setDeletingEmployee(false);
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
      active: { color: 'bg-green-100 text-green-800', label: 'Actif' },
      inactive: { color: 'bg-red-100 text-red-800', label: 'Inactif' },
      suspended: { color: 'bg-yellow-100 text-yellow-800', label: 'Suspendu' }
    };
    const c = config[status] || config.inactive;
    return <span className={`px-2 py-1 rounded-full text-xs ${c.color}`}>{c.label}</span>;
  };

  const getRoleBadge = (role) => {
    const config = {
      admin: { color: 'bg-purple-100 text-purple-800', label: 'Admin' },
      manager: { color: 'bg-blue-100 text-blue-800', label: 'Manager' },
      employee: { color: 'bg-gray-100 text-gray-800', label: 'Employé' }
    };
    const c = config[role] || config.employee;
    return <span className={`px-2 py-1 rounded-full text-xs ${c.color}`}>{c.label}</span>;
  };

  // ==================== RENDU ====================
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

          <button
            onClick={() => fetchEmployees(true)}
            className="px-4 py-2 bg-blue-300 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors flex items-center ml-2"
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

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher
            </label>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Nom, email, CIN, CNSS..."
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
              <option value="all">Tous</option>
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
              <option value="all">Tous</option>
              {[...new Set(employees.map(e => e.department).filter(Boolean))].map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tableau avec largeurs fixes */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                  Employé
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-56">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                  <div className="flex items-center">
                    <FaIdCard className="mr-1" />
                    CIN
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                  <div className="flex items-center">
                    <FaIdCard className="mr-1" />
                    CNSS
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Département
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                  Statut & Rôle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Actions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                  Date embauche
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                    Aucun employé trouvé
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {employee.employeeId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold flex-shrink-0">
                          {employee.firstName?.[0]}{employee.lastName?.[0]}
                        </div>
                        <div className="ml-3 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {employee.firstName} {employee.lastName}
                          </div>
                          <div className="text-sm text-gray-500 truncate">
                            {employee.position}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="truncate max-w-[200px]" title={employee.email}>
                        {employee.email}
                      </div>
                      <div className="text-gray-500 truncate" title={employee.phone}>
                        {employee.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center">
                        <FaIdCard className="mr-2 text-gray-400 flex-shrink-0" />
                        <span className="truncate max-w-[100px]" title={employee.cin}>
                          {employee.cin || '—'}
                        </span>
                      </div>
                    </td>
                    {/* ✅ COLONNE CNSS AVEC LARGEUR SUFFISANTE */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                      <div className="flex items-center">
                        <FaIdCard className="mr-2 text-gray-400 flex-shrink-0" />
                        <span className="truncate max-w-[180px]" title={employee.cnssNumber}>
                          {employee.cnssNumber || '—'}
                        </span>
                      </div>
                      {/* Affichage temporaire pour debug */}
                      {employee.cnssNumber && (
                        <div className="text-xs text-green-600 mt-1">
                          ✓ CNSS
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {employee.department}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-x-1">
                        {getStatusBadge(employee.status)}
                        {getRoleBadge(employee.role)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleEdit(employee)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Modifier"
                        >
                          <FaEdit size={18} />
                        </button>
                        <button
                          onClick={() => handleFacialRegistration(employee)}
                          className="text-purple-600 hover:text-purple-900"
                          title="Enregistrer le visage"
                        >
                          <FaCamera size={18} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(employee)}
                            className="text-red-600 hover:text-red-900"
                            title="Supprimer"
                            disabled={deletingEmployee}
                          >
                            <FaTrash size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {safeFormatDate(employee.hireDate, '-')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL D'AJOUT */}
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
                  <label className="block text-sm font-medium mb-1">N° CNSS </label>
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

      {/* MODAL D'ÉDITION */}
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
                  <label className="block text-sm font-medium mb-1">N° CNSS </label>
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

      {/* MODAL ENREGISTREMENT FACIAL */}
      {showFacialModal && selectedEmployeeForFace && (
        <EmployeeFacialRegistration
          employee={selectedEmployeeForFace}
          onComplete={() => {
            setShowFacialModal(false);
            setSelectedEmployeeForFace(null);
            toast.success('Visage enregistré');
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