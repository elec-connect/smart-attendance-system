// src/context/PayrollContext.jsx - VERSION COMPLÈTE
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import payrollService from '../services/payrollService'; // Import par défaut
import { toast } from 'react-hot-toast';

console.log('🚀 PayrollContext.jsx est chargé!');

const PayrollContext = createContext();

export const usePayroll = () => {
  const context = useContext(PayrollContext);
  if (!context) {
    throw new Error('usePayroll doit être utilisé dans PayrollProvider');
  }
  return context;
};

export const PayrollProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payMonths, setPayMonths] = useState([]);
  const [monthlyPayments, setMonthlyPayments] = useState([]);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [payrollStats, setPayrollStats] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const initialized = useRef(false);

  // Fonctions de chargement des données
  const loadPayMonths = async () => {
  console.log('🔍 PAYROLL CONTEXT: loadPayMonths appelée!');
  try {
    setLoading(true);
    console.log('📞 PAYROLL CONTEXT: Appel à payrollService.getPayMonths()...');
    
    const data = await payrollService.getPayMonths();
    console.log('📦 PAYROLL CONTEXT: Résultat reçu:', data);
    console.log('📊 PAYROLL CONTEXT: Type:', typeof data);
    console.log('📊 PAYROLL CONTEXT: Est array?', Array.isArray(data));
    console.log('📊 PAYROLL CONTEXT: Longueur:', data?.length);
    
    if (Array.isArray(data)) {
      console.log('✅ PAYROLL CONTEXT: Données valides, mise à jour state...');
      console.log('📋 PAYROLL CONTEXT: Exemple de mois:', data[0]);
      setPayMonths(data);
      return data;
    } else {
      console.error('❌ PAYROLL CONTEXT: Données invalides (pas un array):', data);
      setPayMonths([]);
      return [];
    }
  } catch (error) {
    console.error('❌ PAYROLL CONTEXT: Erreur:', error);
    return [];
  } finally {
    setLoading(false);
  }
};

  const loadMonthlyPayments = async (monthYear) => {
    try {
      if (!monthYear) return [];
      setLoading(true);
      const result = await payrollService.getMonthlyPayments(monthYear);
      if (result.success) {
        setMonthlyPayments(result.data?.payments || []);
        return result.data?.payments || [];
      }
      return [];
    } catch (error) {
      console.error('Erreur chargement paiements:', error);
      toast.error('Erreur chargement paiements');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableEmployees = async () => {
  try {
    console.log('🔍 PAYROLL CONTEXT: loadAvailableEmployees appelée!');
    setLoading(true);
    
    const token = localStorage.getItem('token');
    console.log('🔑 Token disponible?', !!token);
    
    if (!token) {
      console.error('❌ Aucun token trouvé!');
      toast.error('Veuillez vous reconnecter');
      setAvailableEmployees([]);
      return [];
    }
    
    const data = await payrollService.getAvailableEmployees();
    console.log('📦 PAYROLL CONTEXT: Employés reçus:', data);
    
    if (data && data.success === false && data.message?.includes('authentification')) {
      console.error('❌ Erreur authentification détectée');
      toast.error('Session expirée. Veuillez vous reconnecter.');
      // Rediriger vers login
      window.location.href = '/login';
      return [];
    }
    
    if (Array.isArray(data)) {
      console.log('✅ PAYROLL CONTEXT: Employés valides');
      setAvailableEmployees(data);
      return data;
    } else if (data && data.success && Array.isArray(data.data)) {
      console.log('✅ PAYROLL CONTEXT: Format {success, data}');
      setAvailableEmployees(data.data);
      return data.data;
    } else {
      console.error('❌ PAYROLL CONTEXT: Format inconnu:', data);
      setAvailableEmployees([]);
      return [];
    }
  } catch (error) {
    console.error('❌ PAYROLL CONTEXT: Erreur:', error);
    
    if (error.response?.status === 401) {
      toast.error('Session expirée. Veuillez vous reconnecter.');
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else {
      toast.error('Erreur chargement employés');
    }
    
    setAvailableEmployees([]);
    return [];
  } finally {
    setLoading(false);
  }
};

  const loadPayrollStats = async () => {
    try {
      setLoading(true);
      const result = await payrollService.getPayrollStats();
      if (result.success) {
        setPayrollStats(result.data);
        return result.data;
      }
      return null;
    } catch (error) {
      console.error('Erreur chargement stats:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Initialisation des données
  const initializeData = async () => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      setLoading(true);
      
      // Charger les données en parallèle
      const [months, employees, stats] = await Promise.allSettled([
        loadPayMonths(),
        loadAvailableEmployees(),
        loadPayrollStats()
      ]);

      // Gérer les résultats
      const monthsData = months.status === 'fulfilled' ? months.value : [];
      const employeesData = employees.status === 'fulfilled' ? employees.value : [];
      const statsData = stats.status === 'fulfilled' ? stats.value : null;

      // Sélectionner le premier mois si disponible
      if (monthsData.length > 0 && !selectedMonth) {
        setSelectedMonth(monthsData[0].month_year);
        // Charger les paiements pour ce mois
        setTimeout(() => loadMonthlyPayments(monthsData[0].month_year), 100);
      }

      setError(null);
    } catch (error) {
      console.error('Erreur initialisation paie:', error);
      setError('Erreur chargement données paie');
    } finally {
      setLoading(false);
    }
  };

  // Rafraîchir toutes les données
  const refreshData = async () => {
    initialized.current = false;
    return initializeData();
  };

  // Effet d'initialisation
  useEffect(() => {
    initializeData();
  }, []);

  // Charger les paiements quand le mois change
  useEffect(() => {
    if (selectedMonth) {
      loadMonthlyPayments(selectedMonth);
    }
  }, [selectedMonth]);

  // Contexte value
  const contextValue = {
    // États
    loading,
    error,
    payMonths,
    monthlyPayments,
    availableEmployees,
    payrollStats,
    selectedMonth,
    
    // Setters
    setSelectedMonth,
    setError,
    
    // Actions
    loadPayMonths,
    loadMonthlyPayments,
    loadAvailableEmployees,
    loadPayrollStats,
    refreshData,
    
    // Service methods (exposées pour utilisation directe)
    createPayMonth: payrollService.createPayMonth,
    updatePayMonth: payrollService.updatePayMonth,
    deletePayMonth: payrollService.deletePayMonth,
    getSalaryConfig: payrollService.getSalaryConfig,
    configureSalary: payrollService.configureSalary,
    updateSalaryConfig: payrollService.updateSalaryConfig,
    calculateSalaries: payrollService.calculateSalaries,
    approvePayment: payrollService.approvePayment,
    markAsPaid: payrollService.markAsPaid,
    getEmployeePayHistory: payrollService.getEmployeePayHistory,
    getQuickStats: payrollService.getQuickStats,
    formatCurrency: payrollService.formatCurrency,
    formatDate: payrollService.formatDate
  };

  return (
    <PayrollContext.Provider value={contextValue}>
      {children}
    </PayrollContext.Provider>
  );
};

// Export par défaut du provider
export default PayrollProvider;