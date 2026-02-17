// src/components/payroll/SalaryConfig.jsx - VERSION COMPLÈTE AVEC PARAMÈTRES INTÉGRÉS    
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const SalaryConfig = ({ employeeId, onConfigSaved }) => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(employeeId || '');
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState({});
  
  // État intégré pour tous les paramètres de calcul
  const [config, setConfig] = useState({
    base_salary: '',
    daily_rate: '',
    hourly_rate: '',
    overtime_rate: '',
    tax_rate: '',
    social_security_rate: '',
    payment_method: 'bank_transfer',
    contract_type: 'permanent',
    is_active: true,
    deductions: [],
    allowances: [],
    // ⭐ PARAMÈTRES DE CALCUL 
    working_days: 22,
    daily_hours: 8,
    overtime_multiplier: 1.5,
    bank_details: {
      bank_name: '',
      bank_account: '',
      iban: ''
    }
  });

  // Charger la liste des employés
  useEffect(() => {
    loadEmployees();
  }, []);

  // Charger la configuration quand l'employé est sélectionné
  useEffect(() => {
    if (selectedEmployee) {
      loadSalaryConfig();
    } else {
      resetForm();
    }
  }, [selectedEmployee]);

  // Réinitialiser les erreurs lors du changement d'employé
  useEffect(() => {
    setErrors({});
  }, [selectedEmployee]);

  // Debug: surveiller les changements d'allocations/déductions
  useEffect(() => {
    console.log('🔄 Config state mis à jour:', {
      allowancesCount: config.allowances.length,
      deductionsCount: config.deductions.length,
      allowances: config.allowances,
      deductions: config.deductions,
      workingDays: config.working_days,
      dailyHours: config.daily_hours,
      overtimeMultiplier: config.overtime_multiplier
    });
  }, [config.allowances, config.deductions, config.working_days, config.daily_hours, config.overtime_multiplier]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      
      const response = await api.get('/employees');
      
      let employeesData = [];
      
      if (Array.isArray(response.data)) {
        employeesData = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        employeesData = response.data.data;
      } else if (response.data && Array.isArray(response.data.employees)) {
        employeesData = response.data.employees;
      } else {
        console.error('Format de données employés non reconnu:', response);
        toast.error('Format de données employés incorrect');
        return;
      }
      
      const validEmployees = employeesData
        .filter(emp => {
          if (!emp) return false;
          
          const hasEmployeeId = (emp.employeeId || emp.employee_id) && 
                               typeof (emp.employeeId || emp.employee_id) === 'string' && 
                               (emp.employeeId || emp.employee_id).trim() !== '';
          
          if (!hasEmployeeId) {
            console.warn('Employé ignoré (pas d\'employeeId):', emp);
            return false;
          }
          
          return true;
        })
        .map(emp => {
          const empId = emp.employeeId || emp.employee_id;
          const firstName = emp.firstName || emp.first_name || '';
          const lastName = emp.lastName || emp.last_name || '';
          const email = emp.email || '';
          const department = emp.department || '';
          const position = emp.position || '';
          const hireDate = emp.hireDate || emp.hire_date;
          const isActive = emp.isActive !== false && emp.is_active !== false;
          
          return {
            ...emp,
            id: emp.id || empId,
            employee_id: empId,
            first_name: firstName,
            last_name: lastName,
            email: email,
            department: department,
            position: position,
            hire_date: hireDate,
            is_active: isActive
          };
        });
      
      setEmployees(validEmployees);
      
      if (validEmployees.length === 0) {
        toast('Aucun employé trouvé dans le système', {
          icon: '📭',
          duration: 4000,
        });
      }
      
      if (!selectedEmployee && validEmployees.length > 0) {
        const firstEmployee = validEmployees[0];
        setSelectedEmployee(firstEmployee.employee_id);
      }
      
    } catch (error) {
      console.error('Erreur chargement employés:', error);
      toast.error('Impossible de charger la liste des employés');
    } finally {
      setLoading(false);
    }
  };

  // SalaryConfig.jsx - Fonction loadSalaryConfig compatible
// SalaryConfig.jsx - NOUVELLE VERSION SIMPLIFIÉE
// SalaryConfig.jsx - REMPLACER TOUTE LA FONCTION loadSalaryConfig
const loadSalaryConfig = async () => {
  if (!selectedEmployee) return;
  
  try {
    setLoading(true);
    console.log(`🔄 Chargement config pour: "${selectedEmployee}"`);
    
    // Configuration par défaut
    const defaultConfig = {
      base_salary: '',
      daily_rate: '',
      hourly_rate: '',
      overtime_rate: '',
      tax_rate: '',
      social_security_rate: '',
      payment_method: 'bank_transfer',
      contract_type: 'permanent',
      is_active: true,
      working_days: 22,
      daily_hours: 8,
      overtime_multiplier: 1.5,
      allowances: [],
      deductions: [],
      bank_details: {
        bank_name: '',
        bank_account: '',
        iban: ''
      }
    };
    
    try {
      // ⭐ DÉSACTIVER LE CACHE POUR CETTE REQUÊTE
      const response = await api.get(`/payroll/config/${selectedEmployee}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      console.log('📥 Réponse brute:', response.data);
      
      const apiData = response.data;
      
      // VÉRIFIER SI C'EST NULL (problème de cache)
      if (apiData === null) {
        console.log('⚠️ Réponse null - Problème de cache, réessayer sans cache');
        
        // Réessayer sans cache
        const freshResponse = await api.get(`/payroll/config/${selectedEmployee}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          params: {
            _t: Date.now() // Timestamp pour éviter le cache
          }
        });
        
        if (freshResponse.data && freshResponse.data !== null) {
          // Traiter la nouvelle réponse
          return processSalaryConfig(freshResponse.data, selectedEmployee, defaultConfig);
        }
        
        // Toujours null = pas de configuration
        setConfig(defaultConfig);
        setIsCreating(true);
        showToast('info', 'Nouvelle configuration');
        return;
      }
      
      // Traiter la réponse normale
      return processSalaryConfig(apiData, selectedEmployee, defaultConfig);
      
    } catch (error) {
      console.error('❌ Erreur API:', error);
      
      if (error.response?.status === 404) {
        console.log('404 - Pas de config');
        setConfig(defaultConfig);
        setIsCreating(true);
        showToast('info', 'Nouvelle configuration');
      } else {
        showToast('error', 'Erreur de connexion');
        setConfig(defaultConfig);
        setIsCreating(true);
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    showToast('error', 'Erreur inattendue');
  } finally {
    setLoading(false);
  }
};

// ⭐ FONCTION HELPER POUR TRAITER LES DONNÉES
const processSalaryConfig = (apiData, employeeId, defaultConfig) => {
  console.log('🔍 Traitement données:', {
    type: typeof apiData,
    isObject: typeof apiData === 'object',
    keys: apiData ? Object.keys(apiData) : 'null'
  });
  
  // CAS 1: Structure correcte du backend
  if (apiData && typeof apiData === 'object') {
    if (apiData.success === true && apiData.exists === true && apiData.data) {
      // Configuration existante
      console.log('✅ Configuration existante (structure standard)');
      
      const serverData = apiData.data;
      const employeeInfo = apiData.employee_info || {};
      
      // Parser les données
      const parsedConfig = parseConfigFromServer(serverData);
      
      setConfig(parsedConfig);
      setIsCreating(false);
      
      const employeeName = employeeInfo.full_name || employeeInfo.first_name || employeeId;
      showToast('success', `Configuration chargée pour ${employeeName}`);
      return;
    }
    else if (apiData.success === true && apiData.exists === false) {
      // Pas de configuration
      console.log('ℹ️ Pas de config - Mode création (structure standard)');
      setConfig(defaultConfig);
      setIsCreating(true);
      showToast('info', 'Nouvelle configuration');
      return;
    }
    else if (apiData.employee_id && apiData.base_salary !== undefined) {
      // Données directes (ancien format)
      console.log('📥 Données directes (ancien format)');
      
      const parsedConfig = parseConfigFromServer(apiData);
      setConfig(parsedConfig);
      setIsCreating(false);
      showToast('success', 'Configuration chargée');
      return;
    }
  }
  
  // CAS 2: Données invalides
  console.log('⚠️ Données invalides ou format inconnu');
  setConfig(defaultConfig);
  setIsCreating(true);
  showToast('info', 'Nouvelle configuration');
};

// ⭐ FONCTION POUR PARSER LES DONNÉES DU SERVEUR
const parseConfigFromServer = (serverData) => {
  const parseArrayField = (field) => {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        console.warn('⚠️ Impossible de parser JSON');
        return [];
      }
    }
    return [];
  };
  
  return {
    base_salary: serverData.base_salary || '',
    daily_rate: serverData.daily_rate || '',
    hourly_rate: serverData.hourly_rate || '',
    overtime_rate: serverData.overtime_rate || '',
    tax_rate: serverData.tax_rate || '',
    social_security_rate: serverData.social_security_rate || '',
    payment_method: serverData.payment_method || 'bank_transfer',
    contract_type: serverData.contract_type || 'permanent',
    is_active: serverData.is_active !== false,
    working_days: serverData.working_days || 22,
    daily_hours: serverData.daily_hours || 8,
    overtime_multiplier: serverData.overtime_multiplier || 1.5,
    allowances: parseArrayField(serverData.allowances),
    deductions: parseArrayField(serverData.deductions),
    bank_details: {
      bank_name: serverData.bank_name || '',
      bank_account: serverData.bank_account || '',
      iban: serverData.iban || ''
    }
  };
};

// ⭐ FONCTION SAFE POUR LES TOASTS
const showToast = (type, message) => {
  try {
    if (typeof toast === 'function') {
      // react-hot-toast (import par défaut)
      if (type === 'success') toast.success(message);
      else if (type === 'error') toast.error(message);
      else if (type === 'info') toast(message, { icon: 'ℹ️' });
      else toast(message);
    } else if (toast && typeof toast[type] === 'function') {
      // react-toastify
      toast[type](message);
    } else {
      // Fallback
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  } catch (error) {
    console.error('❌ Erreur toast:', error);
    console.log(`[TOAST ${type}] ${message}`);
  }
};

  const resetForm = () => {
    setConfig({
      base_salary: '',
      daily_rate: '',
      hourly_rate: '',
      overtime_rate: '',
      tax_rate: '',
      social_security_rate: '',
      payment_method: 'bank_transfer',
      contract_type: 'permanent',
      is_active: true,
      deductions: [],
      allowances: [],
      // ⭐ CONSERVER LES NOUVEAUX CHAMPS AVEC VALEURS PAR DÉFAUT
      working_days: 22,
      daily_hours: 8,
      overtime_multiplier: 1.5,
      bank_details: {
        bank_name: '',
        bank_account: '',
        iban: ''
      }
    });
    setErrors({});
  };

  // Handlers pour les paramètres de calcul intégrés
  const handleWorkingDaysChange = (e) => {
    const days = parseFloat(e.target.value);
    if (days > 0 && days <= 31) {
      setConfig(prev => ({ 
        ...prev, 
        working_days: days 
      }));
      setErrors(prev => ({ ...prev, workingDays: '' }));
      
      // Recalculer automatiquement si salaire défini
      if (config.base_salary) {
        calculateRates();
      }
    } else {
      setErrors(prev => ({ ...prev, workingDays: 'Doit être entre 1 et 31 jours' }));
    }
  };

  const handleDailyHoursChange = (e) => {
    const hours = parseFloat(e.target.value);
    if (hours > 0 && hours <= 24) {
      setConfig(prev => ({ 
        ...prev, 
        daily_hours: hours 
      }));
      setErrors(prev => ({ ...prev, dailyHours: '' }));
      
      // Recalculer automatiquement si salaire défini
      if (config.base_salary) {
        calculateRates();
      }
    } else {
      setErrors(prev => ({ ...prev, dailyHours: 'Doit être entre 1 et 24 heures' }));
    }
  };

  const handleOvertimeMultiplierChange = (e) => {
    const multiplier = parseFloat(e.target.value);
    if (multiplier >= 1 && multiplier <= 3) {
      setConfig(prev => ({ 
        ...prev, 
        overtime_multiplier: multiplier 
      }));
      setErrors(prev => ({ ...prev, overtimeMultiplier: '' }));
      
      // Recalculer automatiquement si salaire défini
      if (config.base_salary) {
        calculateRates();
      }
    } else {
      setErrors(prev => ({ ...prev, overtimeMultiplier: 'Doit être entre 1 et 3' }));
    }
  };

  const validateField = (name, value) => {
    switch (name) {
      case 'base_salary':
        if (!value || parseFloat(value) <= 0) {
          return 'Le salaire de base est requis et doit être supérieur à 0';
        }
        break;
      case 'tax_rate':
      case 'social_security_rate':
        if (value && (parseFloat(value) < 0 || parseFloat(value) > 100)) {
          return 'Doit être entre 0 et 100%';
        }
        break;
      case 'working_days':
        if (value && (parseFloat(value) <= 0 || parseFloat(value) > 31)) {
          return 'Doit être entre 1 et 31 jours';
        }
        break;
      case 'daily_hours':
        if (value && (parseFloat(value) <= 0 || parseFloat(value) > 24)) {
          return 'Doit être entre 1 et 24 heures';
        }
        break;
      case 'overtime_multiplier':
        if (value && (parseFloat(value) < 1 || parseFloat(value) > 3)) {
          return 'Doit être entre 1 et 3';
        }
        break;
      case 'bank_name':
        if (config.payment_method === 'bank_transfer' && !value) {
          return 'Le nom de la banque est requis pour les virements';
        }
        break;
      case 'bank_account':
        if (config.payment_method === 'bank_transfer' && !value) {
          return 'Le numéro de compte est requis pour les virements';
        }
        break;
      default:
        return '';
    }
    return '';
  };

  const calculateRates = () => {
    const baseSalary = parseFloat(config.base_salary) || 0;
    if (baseSalary <= 0) {
      const errorMsg = 'Veuillez entrer un salaire de base valide avant de calculer';
      setErrors(prev => ({ ...prev, base_salary: errorMsg }));
      toast.error(errorMsg);
      return;
    }
    
    const workingDays = config.working_days || 22;
    const dailyHours = config.daily_hours || 8;
    const overtimeMultiplier = config.overtime_multiplier || 1.5;
    
    if (workingDays <= 0) {
      toast.error('Le nombre de jours travaillés doit être supérieur à 0');
      return;
    }
    
    if (dailyHours <= 0) {
      toast.error('Le nombre d\'heures par jour doit être supérieur à 0');
      return;
    }
    
    // Calcul des taux
    const dailyRate = baseSalary / workingDays;
    const hourlyRate = dailyRate / dailyHours;
    const overtimeRate = hourlyRate * overtimeMultiplier;
    
    setConfig(prev => ({
      ...prev,
      daily_rate: dailyRate.toFixed(2),
      hourly_rate: hourlyRate.toFixed(2),
      overtime_rate: overtimeRate.toFixed(2)
    }));
    
    toast.success('Taux calculés avec succès');
  };

  const handleEmployeeChange = (e) => {
    const newEmployeeId = e.target.value;
    console.log('👤 Changement employé:', newEmployeeId);
    setSelectedEmployee(newEmployeeId);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Valider le champ
    const error = validateField(name, value);
    if (error) {
      setErrors(prev => ({ ...prev, [name]: error }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    if (type === 'checkbox') {
      setConfig(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setConfig(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleBankDetailsChange = (e) => {
    const { name, value } = e.target;
    
    // Valider le champ
    const error = validateField(name, value);
    if (error) {
      setErrors(prev => ({ ...prev, [name]: error }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    setConfig(prev => ({
      ...prev,
      bank_details: {
        ...prev.bank_details,
        [name]: value
      }
    }));
  };

  const addAllowance = () => {
    setConfig(prev => ({
      ...prev,
      allowances: [
        ...prev.allowances,
        { 
          name: '', 
          amount: '', 
          type: 'fixed' 
        }
      ]
    }));
  };

  const updateAllowance = (index, field, value) => {
    setConfig(prev => {
      const newAllowances = [...prev.allowances];
      if (newAllowances[index]) {
        newAllowances[index] = {
          ...newAllowances[index],
          [field]: value
        };
      }
      return {
        ...prev,
        allowances: newAllowances
      };
    });
    
    // Valider si le montant est requis
    if (field === 'amount' && !value) {
      setErrors(prev => ({ 
        ...prev, 
        [`allowance_${index}_amount`]: 'Le montant est requis' 
      }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`allowance_${index}_amount`];
        return newErrors;
      });
    }
  };

  const removeAllowance = (index) => {
    console.log(`🗑️ Suppression allocation index ${index}`);
    
    const newAllowances = [...config.allowances];
    newAllowances.splice(index, 1);
    
    setConfig(prev => ({
      ...prev,
      allowances: newAllowances
    }));
    
    // Nettoyer les erreurs
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`allowance_${index}_amount`];
      delete newErrors[`allowance_${index}_name`];
      return newErrors;
    });
    
    if (toast && typeof toast.info === 'function') {
      toast.info('Allocation supprimée (cliquez "Mettre à Jour" pour sauvegarder)');
    } else if (toast && typeof toast === 'function') {
      toast('Allocation supprimée (cliquez "Mettre à Jour" pour sauvegarder)', {
        icon: '🗑️',
        duration: 3000,
      });
    } else {
      console.log('ℹ️ Allocation supprimée (toast non disponible)');
    }
  };

  const addDeduction = () => {
    setConfig(prev => ({
      ...prev,
      deductions: [
        ...prev.deductions,
        { 
          name: '', 
          amount: '', 
          type: 'fixed' 
        }
      ]
    }));
  };

  const updateDeduction = (index, field, value) => {
    setConfig(prev => {
      const newDeductions = [...prev.deductions];
      if (newDeductions[index]) {
        newDeductions[index] = {
          ...newDeductions[index],
          [field]: value
        };
      }
      return {
        ...prev,
        deductions: newDeductions
      };
    });
    
    // Valider si le montant est requis
    if (field === 'amount' && !value) {
      setErrors(prev => ({ 
        ...prev, 
        [`deduction_${index}_amount`]: 'Le montant est requis' 
      }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`deduction_${index}_amount`];
        return newErrors;
      });
    }
  };

  const removeDeduction = (index) => {
    console.log(`🗑️ Suppression déduction index ${index}`);
    
    const newDeductions = [...config.deductions];
    newDeductions.splice(index, 1);
    
    setConfig(prev => ({
      ...prev,
      deductions: newDeductions
    }));
    
    // Nettoyer les erreurs
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`deduction_${index}_amount`];
      delete newErrors[`deduction_${index}_name`];
      return newErrors;
    });
    
    if (toast && typeof toast.info === 'function') {
      toast.info('Déduction supprimée (cliquez "Mettre à Jour" pour sauvegarder)');
    } else if (toast && typeof toast === 'function') {
      toast('Déduction supprimée (cliquez "Mettre à Jour" pour sauvegarder)', {
        icon: '🗑️',
        duration: 3000,
      });
    } else {
      console.log('ℹ️ Déduction supprimée (toast non disponible)');
    }
  };

  const calculateTotalAllowances = () => {
    const baseSalary = parseFloat(config.base_salary) || 0;
    
    return config.allowances
      .filter(a => a.amount && !isNaN(parseFloat(a.amount)))
      .reduce((sum, a) => {
        const amount = parseFloat(a.amount);
        if (a.type === 'percentage') {
          return sum + (baseSalary * amount / 100);
        }
        return sum + amount;
      }, 0);
  };

  const calculateTotalDeductions = () => {
    const baseSalary = parseFloat(config.base_salary) || 0;
    
    return config.deductions
      .filter(d => d.amount && !isNaN(parseFloat(d.amount)))
      .reduce((sum, d) => {
        const amount = parseFloat(d.amount);
        if (d.type === 'percentage') {
          return sum + (baseSalary * amount / 100);
        }
        return sum + amount;
      }, 0);
  };

  const calculateBonusFixed = () => {
    return config.allowances
      .filter(a => a.type === 'fixed' && a.amount && !isNaN(parseFloat(a.amount)))
      .reduce((sum, a) => sum + parseFloat(a.amount), 0);
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Validation du salaire de base
    if (!config.base_salary || parseFloat(config.base_salary) <= 0) {
      newErrors.base_salary = 'Le salaire de base est requis et doit être supérieur à 0';
    }
    
    // Validation des paramètres de calcul
    if (config.working_days <= 0 || config.working_days > 31) {
      newErrors.workingDays = 'Le nombre de jours doit être entre 1 et 31';
    }
    
    if (config.daily_hours <= 0 || config.daily_hours > 24) {
      newErrors.dailyHours = 'Le nombre d\'heures doit être entre 1 et 24';
    }
    
    if (config.overtime_multiplier < 1 || config.overtime_multiplier > 3) {
      newErrors.overtimeMultiplier = 'Le multiplicateur doit être entre 1 et 3';
    }
    
    // Validation des allocations
    config.allowances.forEach((allowance, index) => {
      if (allowance.name && !allowance.amount) {
        newErrors[`allowance_${index}_amount`] = 'Le montant est requis';
      }
      if (!allowance.name && allowance.amount) {
        newErrors[`allowance_${index}_name`] = 'Le nom est requis';
      }
    });
    
    // Validation des déductions
    config.deductions.forEach((deduction, index) => {
      if (deduction.name && !deduction.amount) {
        newErrors[`deduction_${index}_amount`] = 'Le montant est requis';
      }
      if (!deduction.name && deduction.amount) {
        newErrors[`deduction_${index}_name`] = 'Le nom est requis';
      }
    });
    
    // Validation des infos bancaires si virement
    if (config.payment_method === 'bank_transfer') {
      if (!config.bank_details.bank_name) {
        newErrors.bank_name = 'Le nom de la banque est requis';
      }
      if (!config.bank_details.bank_account) {
        newErrors.bank_account = 'Le numéro de compte est requis';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (loading) return;
    
    try {
        setLoading(true);
        
        // Validation
        if (!selectedEmployee || !config.base_salary) {
            toast.error('Sélectionnez un employé et saisissez un salaire de base');
            return;
        }
        
        // Préparer les données
        const configData = {
            employee_id: selectedEmployee,
            base_salary: config.base_salary,
            currency: 'TND',
            payment_method: config.payment_method,
            tax_rate: parseFloat(config.tax_rate) || 0,
            social_security_rate: parseFloat(config.social_security_rate) || 0,
            contract_type: config.contract_type,
            allowances: JSON.stringify(config.allowances),
            deductions: JSON.stringify(config.deductions),
            working_days: config.working_days,
            daily_hours: config.daily_hours,
            overtime_multiplier: config.overtime_multiplier,
            bank_name: config.bank_details.bank_name,
            bank_account: config.bank_details.bank_account,
            iban: config.bank_details.iban,
            is_active: config.is_active
        };
        
        // Envoyer à l'API
        const response = await api.post('/payroll/configure', configData);
        
        // Succès
        toast.success(isCreating 
            ? '✅ Configuration créée avec succès' 
            : '✅ Configuration mise à jour avec succès'
        );
        
        setIsCreating(false);
        
        // Recharger automatiquement
        setTimeout(() => {
            loadSalaryConfig();
        }, 1000);
        
    } catch (error) {
        console.error('Erreur sauvegarde:', error);
        
        // Messages d'erreur personnalisés
        if (error.response?.status === 404) {
            toast.error('❌ Endpoint API non disponible');
        } else if (error.response?.status === 400) {
            toast.error('❌ Données invalides');
        } else {
            toast.error('❌ Erreur serveur');
        }
        
    } finally {
        setLoading(false);
    }
};

  const getSelectedEmployeeName = () => {
    const employee = employees.find(emp => emp.employee_id === selectedEmployee);
    if (!employee) return 'Non sélectionné';
    
    return `${employee.first_name} ${employee.last_name}`.trim();
  };

  const getSelectedEmployeeDetails = () => {
    const employee = employees.find(emp => emp.employee_id === selectedEmployee);
    if (!employee) return null;
    
    return {
      email: employee.email || '',
      department: employee.department || 'Non spécifié',
      position: employee.position || 'Non spécifié',
      hireDate: employee.hire_date || 'Non spécifié',
      isActive: employee.is_active !== false
    };
  };

  const employeeDetails = getSelectedEmployeeDetails();

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">
            Configuration Salariale
          </h2>
          {selectedEmployee && (
            <div className="flex items-center mt-1">
              <span className="text-sm text-gray-600 font-medium">
                {getSelectedEmployeeName()}
              </span>
              <span className="mx-2 text-gray-400">•</span>
              <span className="text-sm text-gray-500">
                ID: {selectedEmployee}
              </span>
              {employeeDetails && (
                <>
                  <span className="mx-2 text-gray-400">•</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${employeeDetails.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {employeeDetails.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        
        {employeeDetails && (
          <div className="text-right text-sm text-gray-600">
            <div className="font-medium">{employeeDetails.department}</div>
            <div>{employeeDetails.position}</div>
            <div className="text-xs text-gray-500 mt-1">
              Embauche: {employeeDetails.hireDate}
            </div>
          </div>
        )}
        
        {/* Bouton de rechargement */}
        <button
          type="button"
          onClick={async () => {
            toast.loading('Rechargement en cours...', { id: 'reload' });
            await loadSalaryConfig();
            toast.success('Configuration rechargée', { id: 'reload' });
          }}
          disabled={loading || !selectedEmployee}
          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors flex items-center ml-4"
          title="Recharger la configuration"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Recharger
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        {/* Sélection employé */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sélectionner un employé <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedEmployee}
            onChange={handleEmployeeChange}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={loading || !!employeeId}
          >
            <option value="">{loading ? 'Chargement...' : 'Choisir un employé...'}</option>
            {employees.map(emp => (
              <option 
                key={`emp-${emp.employee_id}`} 
                value={emp.employee_id}
                className="py-2"
              >
                {emp.first_name} {emp.last_name} ({emp.employee_id})
                {emp.department && ` - ${emp.department}`}
                {emp.is_active === false && ' [INACTIF]'}
              </option>
            ))}
          </select>
          
          {employees.length === 0 && !loading && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                ⚠️ Aucun employé trouvé dans le système
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Le format des données employés ne correspond pas au format attendu
              </p>
            </div>
          )}
        </div>
        
        {selectedEmployee && (
          <div className="space-y-6">
            {/* Indicateur création vs édition */}
            <div className={`p-3 rounded-md ${isCreating ? 'bg-blue-50 border border-blue-200' : 'bg-green-50 border border-green-200'}`}>
              <div className="flex items-center">
                <div className={`h-3 w-3 rounded-full mr-2 ${isCreating ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                <span className="text-sm font-medium">
                  {isCreating ? '📝 Nouvelle configuration' : '✅ Configuration existante'}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {isCreating 
                  ? `Cette configuration sera créée pour ${selectedEmployee}`
                  : `Configuration existante pour ${selectedEmployee}`}
              </p>
            </div>
            
            {/* PARAMÈTRES DE CALCUL */}
            <div className="border-b pb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Paramètres de Calcul 
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                ⭐ Ces paramètres seront sauvegardés
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jours travaillés/mois <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={config.working_days}
                      onChange={handleWorkingDaysChange}
                      className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.workingDays ? 'border-red-500' : 'border-gray-300'
                      }`}
                      min="1"
                      max="31"
                      step="0.5"
                    />
                    <span className="text-sm text-gray-500 whitespace-nowrap">jours</span>
                  </div>
                  {errors.workingDays && (
                    <p className="text-xs text-red-500 mt-1">{errors.workingDays}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {config.working_days} jours standard 
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Heures par jour <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={config.daily_hours}
                      onChange={handleDailyHoursChange}
                      className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.dailyHours ? 'border-red-500' : 'border-gray-300'
                      }`}
                      min="1"
                      max="24"
                      step="0.5"
                    />
                    <span className="text-sm text-gray-500 whitespace-nowrap">heures</span>
                  </div>
                  {errors.dailyHours && (
                    <p className="text-xs text-red-500 mt-1">{errors.dailyHours}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {config.daily_hours}h standard 
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taux heures sup <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={config.overtime_multiplier}
                      onChange={handleOvertimeMultiplierChange}
                      className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.overtimeMultiplier ? 'border-red-500' : 'border-gray-300'
                      }`}
                      min="1"
                      max="3"
                      step="0.1"
                    />
                    <span className="text-sm text-gray-500 whitespace-nowrap">× taux horaire</span>
                  </div>
                  {errors.overtimeMultiplier && (
                    <p className="text-xs text-red-500 mt-1">{errors.overtimeMultiplier}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {(config.overtime_multiplier * 100).toFixed(0)}% du taux horaire 
                  </p>
                </div>
              </div>
            </div>
            
            {/* Informations salariales de base */}
            <div className="border-b pb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Informations Salariales de Base
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Salaire de Base (TND) <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      name="base_salary"
                      value={config.base_salary}
                      onChange={handleChange}
                      className={`flex-1 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.base_salary ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="3000"
                      required
                      step="0.01"
                      min="0"
                    />
                    <button
                      type="button"
                      onClick={calculateRates}
                      className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-sm transition-colors whitespace-nowrap"
                      disabled={!config.base_salary}
                    >
                      Calculer taux
                    </button>
                  </div>
                  {errors.base_salary && (
                    <p className="text-xs text-red-500 mt-1">{errors.base_salary}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Salaire mensuel brut</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taux Journalier (TND)
                  </label>
                  <input
                    type="number"
                    name="daily_rate"
                    value={config.daily_rate}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="136.36"
                    step="0.01"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Basé sur {config.working_days} jours/mois
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taux Horaire (TND)
                  </label>
                  <input
                    type="number"
                    name="hourly_rate"
                    value={config.hourly_rate}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="17.05"
                    step="0.01"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Basé sur {config.daily_hours}h/jour
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taux Heures Sup (TND)
                  </label>
                  <input
                    type="number"
                    name="overtime_rate"
                    value={config.overtime_rate}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="25.57"
                    step="0.01"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {(config.overtime_multiplier * 100).toFixed(0)}% du taux horaire
                  </p>
                </div>
              </div>
            </div>
            
            {/* Taux et cotisations */}
            <div className="border-b pb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Taux et Cotisations
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taux d'Impôt (%)
                  </label>
                  <input
                    type="number"
                    name="tax_rate"
                    value={config.tax_rate}
                    onChange={handleChange}
                    className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.tax_rate ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="20"
                    step="0.1"
                    min="0"
                    max="100"
                  />
                  {errors.tax_rate && (
                    <p className="text-xs text-red-500 mt-1">{errors.tax_rate}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Pourcentage</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taux Sécurité Sociale (%)
                  </label>
                  <input
                    type="number"
                    name="social_security_rate"
                    value={config.social_security_rate}
                    onChange={handleChange}
                    className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.social_security_rate ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="7"
                    step="0.1"
                    min="0"
                    max="100"
                  />
                  {errors.social_security_rate && (
                    <p className="text-xs text-red-500 mt-1">{errors.social_security_rate}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Pourcentage</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type de Contrat
                  </label>
                  <select
                    name="contract_type"
                    value={config.contract_type}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="permanent">CDI</option>
                    <option value="fixed_term">CDD</option>
                    <option value="intern">Stage</option>
                    <option value="freelance">Freelance</option>
                  </select>
                </div>
                
                <div className="flex items-center pt-6">
                  <input
                    type="checkbox"
                    id="is_active"
                    name="is_active"
                    checked={config.is_active}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                    Configuration active
                  </label>
                </div>
              </div>
            </div>
            
            {/* Allocations */}
            <div className="border-b pb-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Allocations et Primes
                  </h3>
                  <p className="text-sm text-gray-500">
                    Primes fixes ou variables en pourcentage 
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addAllowance}
                  className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors"
                >
                  + Ajouter
                </button>
              </div>
              
              {config.allowances.length === 0 ? (
                <div className="text-center py-4 text-gray-500 italic">
                  Aucune allocation définie
                </div>
              ) : (
                <div className="space-y-3">
                  {config.allowances.map((allowance, index) => (
                    <div key={`allowance-${index}`} className="flex items-center gap-4 p-3 bg-gray-50 rounded-md">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={allowance.name}
                          onChange={(e) => updateAllowance(index, 'name', e.target.value)}
                          className={`w-full p-2 border rounded-md text-sm ${
                            errors[`allowance_${index}_name`] ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Nom de l'allocation"
                          required
                        />
                        {errors[`allowance_${index}_name`] && (
                          <p className="text-xs text-red-500 mt-1">{errors[`allowance_${index}_name`]}</p>
                        )}
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          value={allowance.amount}
                          onChange={(e) => updateAllowance(index, 'amount', e.target.value)}
                          className={`w-full p-2 border rounded-md text-sm ${
                            errors[`allowance_${index}_amount`] ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Montant"
                          step="0.01"
                          min="0"
                          required
                        />
                        {errors[`allowance_${index}_amount`] && (
                          <p className="text-xs text-red-500 mt-1">{errors[`allowance_${index}_amount`]}</p>
                        )}
                      </div>
                      <div className="w-32">
                        <select
                          value={allowance.type}
                          onChange={(e) => updateAllowance(index, 'type', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="fixed">Fixé (TND)</option>
                          <option value="percentage">Pourcentage (%)</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAllowance(index)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors whitespace-nowrap"
                      >
                        Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-blue-500 mt-2">
                💾 Ces allocations seront sauvegardées dans PostgreSQL
              </p>
            </div>
            
            {/* Déductions */}
            <div className="border-b pb-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Déductions
                  </h3>
                  <p className="text-sm text-gray-500">
                    Déductions fixes ou en pourcentage 
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addDeduction}
                  className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors"
                >
                  + Ajouter
                </button>
              </div>
              
              {config.deductions.length === 0 ? (
                <div className="text-center py-4 text-gray-500 italic">
                  Aucune déduction définie
                </div>
              ) : (
                <div className="space-y-3">
                  {config.deductions.map((deduction, index) => (
                    <div key={`deduction-${index}`} className="flex items-center gap-4 p-3 bg-gray-50 rounded-md">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={deduction.name}
                          onChange={(e) => updateDeduction(index, 'name', e.target.value)}
                          className={`w-full p-2 border rounded-md text-sm ${
                            errors[`deduction_${index}_name`] ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Nom de la déduction"
                          required
                        />
                        {errors[`deduction_${index}_name`] && (
                          <p className="text-xs text-red-500 mt-1">{errors[`deduction_${index}_name`]}</p>
                        )}
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          value={deduction.amount}
                          onChange={(e) => updateDeduction(index, 'amount', e.target.value)}
                          className={`w-full p-2 border rounded-md text-sm ${
                            errors[`deduction_${index}_amount`] ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Montant"
                          step="0.01"
                          min="0"
                          required
                        />
                        {errors[`deduction_${index}_amount`] && (
                          <p className="text-xs text-red-500 mt-1">{errors[`deduction_${index}_amount`]}</p>
                        )}
                      </div>
                      <div className="w-32">
                        <select
                          value={deduction.type}
                          onChange={(e) => updateDeduction(index, 'type', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="fixed">Fixé (TND)</option>
                          <option value="percentage">Pourcentage (%)</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDeduction(index)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors whitespace-nowrap"
                      >
                        Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-blue-500 mt-2">
                💾 Ces déductions seront sauvegardées dans PostgreSQL
              </p>
            </div>
            
            {/* Informations de paiement */}
            <div className="border-b pb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Informations de Paiement
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Méthode de Paiement
                  </label>
                  <select
                    name="payment_method"
                    value={config.payment_method}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="bank_transfer">Virement Bancaire</option>
                    <option value="check">Chèque</option>
                    <option value="cash">Espèces</option>
                    <option value="mobile_money">Mobile Money</option>
                  </select>
                </div>
                
                {config.payment_method === 'bank_transfer' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nom de la Banque
                      </label>
                      <input
                        type="text"
                        name="bank_name"
                        value={config.bank_details.bank_name}
                        onChange={handleBankDetailsChange}
                        className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          errors.bank_name ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Banque Centrale"
                      />
                      {errors.bank_name && (
                        <p className="text-xs text-red-500 mt-1">{errors.bank_name}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Numéro de Compte
                      </label>
                      <input
                        type="text"
                        name="bank_account"
                        value={config.bank_details.bank_account}
                        onChange={handleBankDetailsChange}
                        className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          errors.bank_account ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="123456789"
                      />
                      {errors.bank_account && (
                        <p className="text-xs text-red-500 mt-1">{errors.bank_account}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        IBAN
                      </label>
                      <input
                        type="text"
                        name="iban"
                        value={config.bank_details.iban}
                        onChange={handleBankDetailsChange}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="TN59 1234 5678 9012 3456 7890"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Résumé */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Résumé de la configuration</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Salaire de base:</span>
                  <span className="ml-2 font-medium">{config.base_salary || '0.00'} TND</span>
                </div>
                <div>
                  <span className="text-gray-600">Total allocations:</span>
                  <span className="ml-2 font-medium text-green-600">
                    {calculateTotalAllowances().toFixed(2)} TND
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Total déductions:</span>
                  <span className="ml-2 font-medium text-red-600">
                    {calculateTotalDeductions().toFixed(2)} TND
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Salaire net estimé:</span>
                  <span className="ml-2 font-medium">
                    {(
                      parseFloat(config.base_salary || 0) + 
                      calculateTotalAllowances() - 
                      calculateTotalDeductions() - 
                      (parseFloat(config.base_salary || 0) * (parseFloat(config.tax_rate || 0) / 100)) -
                      (parseFloat(config.base_salary || 0) * (parseFloat(config.social_security_rate || 0) / 100))
                    ).toFixed(2)} TND
                  </span>
                </div>
              </div>
              <div className="mt-2 text-xs text-blue-700">
                💰 {config.allowances.length} allocation(s), {config.deductions.length} déduction(s)
              </div>
              <div className="mt-1 text-xs text-gray-500">
                📅 Type de contrat: {config.contract_type === 'permanent' ? 'CDI' : 
                  config.contract_type === 'fixed_term' ? 'CDD' : 
                  config.contract_type === 'intern' ? 'Stage' : 'Freelance'}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                ⚙️ Calcul: {config.working_days}j/mois, {config.daily_hours}h/jour, heures sup ×{config.overtime_multiplier}
              </div>
              <div className="mt-2 text-xs text-green-600">
                ⭐ Les paramètres de calcul sont maintenant sauvegardés
              </div>
            </div>
            
            {/* Boutons d'action */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  if (selectedEmployee) {
                    loadSalaryConfig();
                    toast.info('Modifications annulées');
                  } else {
                    setSelectedEmployee('');
                    toast.info('Sélection annulée');
                  }
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isCreating ? 'Création...' : 'Mise à jour...'}
                  </span>
                ) : isCreating ? 'Créer Configuration' : 'Mettre à Jour'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default SalaryConfig;