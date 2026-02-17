// src/services/payrollService.jsx - VERSION COMPLÈTE
import api from './api';

// Fonction utilitaire pour gérer les erreurs
const handleApiError = (operation, error) => {
  console.error(`❌ [${operation}] Erreur:`, error);
  const errorMessage = error.response?.data?.message || error.message || 'Erreur inconnue';
  throw new Error(`${operation} échoué: ${errorMessage}`);
};

const payrollService = {
  // ==================== MOIS DE PAIE ====================
  getPayMonths: async () => {
    try {
      console.log('📅 [getPayMonths] Récupération des mois de paie...');
      const response = await api.get('/payroll/pay-months');
      console.log('✅ [getPayMonths] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('getPayMonths', error);
    }
  },

  createPayMonth: async (monthData) => {
    try {
      console.log('📅 [createPayMonth] Création mois:', monthData);
      const response = await api.post('/payroll/pay-months', monthData);
      console.log('✅ [createPayMonth] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('createPayMonth', error);
    }
  },

  updatePayMonth: async (monthYear, updateData) => {
    try {
      console.log(`📅 [updatePayMonth] Mise à jour ${monthYear}:`, updateData);
      const response = await api.put(`/payroll/pay-months/${monthYear}`, updateData);
      console.log('✅ [updatePayMonth] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('updatePayMonth', error);
    }
  },

  deletePayMonth: async (monthYear) => {
    try {
      console.log(`📅 [deletePayMonth] Suppression ${monthYear}`);
      const response = await api.delete(`/payroll/pay-months/${monthYear}`);
      console.log('✅ [deletePayMonth] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('deletePayMonth', error);
    }
  },

  getPayMonth: async (monthYear) => {
    try {
      console.log(`📅 [getPayMonth] Mois: ${monthYear}`);
      const response = await api.get(`/payroll/pay-months/${monthYear}`);
      console.log('✅ [getPayMonth] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('getPayMonth', error);
    }
  },

  // ==================== CONFIGURATION SALAIRE ====================
  getSalaryConfig: async (employeeId) => {
    try {
      console.log(`⚙️ [getSalaryConfig] Employé: ${employeeId}`);
      const response = await api.get(`/payroll/config/${employeeId}`);
      console.log('✅ [getSalaryConfig] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('getSalaryConfig', error);
    }
  },

  configureSalary: async (configData) => {
    try {
      console.log('⚙️ [configureSalary] Configuration:', configData);
      const response = await api.post('/payroll/configure', configData);
      console.log('✅ [configureSalary] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('configureSalary', error);
    }
  },

  updateSalaryConfig: async (employeeId, configData) => {
    try {
      console.log(`⚙️ [updateSalaryConfig] Employé ${employeeId}:`, configData);
      const response = await api.put(`/payroll/config/${employeeId}`, configData);
      console.log('✅ [updateSalaryConfig] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('updateSalaryConfig', error);
    }
  },

  deleteSalaryConfig: async (employeeId) => {
    try {
      console.log(`⚙️ [deleteSalaryConfig] Suppression config ${employeeId}`);
      const response = await api.delete(`/payroll/config/${employeeId}`);
      console.log('✅ [deleteSalaryConfig] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('deleteSalaryConfig', error);
    }
  },

  // ==================== EMPLOYÉS DISPONIBLES ====================
  getAvailableEmployees: async () => {
    try {
      console.log('👥 [getAvailableEmployees] Récupération employés...');
      const response = await api.get('/payroll/employees');
      console.log('✅ [getAvailableEmployees] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('getAvailableEmployees', error);
    }
  },

  getEmployeesWithoutConfig: async () => {
    try {
      console.log('👥 [getEmployeesWithoutConfig] Récupération employés non configurés...');
      const response = await api.get('/payroll/employees');
      if (response.data.success) {
        const employeesWithoutConfig = response.data.data.filter(emp => !emp.has_salary_config);
        return {
          success: true,
          data: employeesWithoutConfig,
          count: employeesWithoutConfig.length
        };
      }
      return response.data;
    } catch (error) {
      handleApiError('getEmployeesWithoutConfig', error);
    }
  },

  // ==================== CALCUL ET PAIEMENTS ====================
  calculateSalaries: async (monthYear) => {
    try {
      console.log(`🧮 [calculateSalaries] Calcul pour: ${monthYear}`);
      const response = await api.post('/payroll/calculate', { month_year: monthYear });
      console.log('✅ [calculateSalaries] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('calculateSalaries', error);
    }
  },

  getMonthlyPayments: async (monthYear) => {
    try {
      console.log(`💰 [getMonthlyPayments] Mois: ${monthYear}`);
      const response = await api.get(`/payroll/payments/${monthYear}`);
      console.log('✅ [getMonthlyPayments] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('getMonthlyPayments', error);
    }
  },

  getAllPayments: async (params = {}) => {
    try {
      console.log('💰 [getAllPayments] Tous les paiements');
      const response = await api.get('/payroll/payments', { params });
      console.log('✅ [getAllPayments] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('getAllPayments', error);
    }
  },

  // ==================== HISTORIQUE ====================
  getEmployeePayHistory: async (employeeId, limit = 12) => {
    try {
      console.log(`📜 [getEmployeePayHistory] Employé: ${employeeId}`);
      const response = await api.get(`/payroll/employee/${employeeId}/history`, {
        params: { limit }
      });
      console.log('✅ [getEmployeePayHistory] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('getEmployeePayHistory', error);
    }
  },

  // ==================== GESTION PAIEMENTS ====================
  approvePayment: async (paymentId, approvedBy = null) => {
    try {
      console.log(`✅ [approvePayment] Approbation paiement: ${paymentId}`);
      const data = approvedBy ? { approved_by: approvedBy } : {};
      const response = await api.put(`/payroll/approve/${paymentId}`, data);
      console.log('✅ [approvePayment] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('approvePayment', error);
    }
  },

  markAsPaid: async (paymentId, paymentData = {}) => {
    try {
      console.log(`💰 [markAsPaid] Paiement: ${paymentId}`);
      const response = await api.put(`/payroll/mark-paid/${paymentId}`, paymentData);
      console.log('✅ [markAsPaid] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('markAsPaid', error);
    }
  },

  getPayment: async (paymentId) => {
    try {
      console.log(`💰 [getPayment] Paiement: ${paymentId}`);
      const response = await api.get(`/payroll/payments/detail/${paymentId}`);
      console.log('✅ [getPayment] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('getPayment', error);
    }
  },

  // ==================== RAPPORTS ====================
  generatePayrollReport: async (monthYear, format = 'json') => {
    try {
      console.log(`📊 [generatePayrollReport] Rapport ${monthYear} format ${format}`);
      const response = await api.get(`/payroll/report/${monthYear}/${format}`);
      console.log('✅ [generatePayrollReport] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('generatePayrollReport', error);
    }
  },

  exportPaymentsToCSV: async (monthYear) => {
    try {
      console.log(`📊 [exportPaymentsToCSV] Export CSV ${monthYear}`);
      const response = await api.get(`/payroll/export/${monthYear}/csv`, {
        responseType: 'blob'
      });
      console.log('✅ [exportPaymentsToCSV] Succès');
      return response.data;
    } catch (error) {
      handleApiError('exportPaymentsToCSV', error);
    }
  },

  exportPaymentsToExcel: async (monthYear) => {
    try {
      console.log(`📊 [exportPaymentsToExcel] Export Excel ${monthYear}`);
      const response = await api.get(`/payroll/export/${monthYear}/excel`, {
        responseType: 'blob'
      });
      console.log('✅ [exportPaymentsToExcel] Succès');
      return response.data;
    } catch (error) {
      handleApiError('exportPaymentsToExcel', error);
    }
  },

  // ==================== UTILITAIRES ====================
  testConnection: async () => {
    try {
      console.log('🔌 [testConnection] Test connexion API Paie');
      const response = await api.get('/payroll/test-connection');
      console.log('✅ [testConnection] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('testConnection', error);
    }
  },

  healthCheck: async () => {
    try {
      console.log('🏥 [healthCheck] Vérification santé API Paie');
      const response = await api.get('/payroll/health');
      console.log('✅ [healthCheck] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('healthCheck', error);
    }
  },

  // ==================== STATISTIQUES ====================
  getPayrollStats: async () => {
    try {
      console.log('📊 [getPayrollStats] Récupération statistiques');
      
      // Si l'endpoint existe, utilisez-le
      try {
        const response = await api.get('/payroll/stats');
        console.log('✅ [getPayrollStats] Succès (endpoint dédié):', response.data);
        return response.data;
      } catch (endpointError) {
        // Fallback: calculer les stats localement
        console.log('⚠️ Endpoint /payroll/stats non disponible, calcul local...');
        
        // Récupérer les données nécessaires
        const [monthsRes, employeesRes, recentPaymentsRes] = await Promise.all([
          payrollService.getPayMonths(),
          payrollService.getAvailableEmployees(),
          payrollService.getAllPayments({ limit: 100 })
        ]);

        const payMonths = monthsRes.data || [];
        const employees = employeesRes.data || [];
        const recentPayments = recentPaymentsRes.data?.payments || [];

        // Calculer les statistiques
        const stats = {
          general: {
            total_payments: recentPayments.length,
            total_paid: recentPayments.reduce((sum, p) => sum + (parseFloat(p?.net_salary) || 0), 0),
            average_salary: recentPayments.length > 0 
              ? recentPayments.reduce((sum, p) => sum + (parseFloat(p?.net_salary) || 0), 0) / recentPayments.length
              : 0
          },
          configuration: {
            total_employees: employees.length,
            configured_employees: employees.filter(e => e.has_salary_config).length,
            configured_percentage: employees.length > 0 
              ? (employees.filter(e => e.has_salary_config).length / employees.length * 100)
              : 0
          },
          months: {
            total_months: payMonths.length,
            draft_months: payMonths.filter(m => m.status === 'draft').length,
            calculated_months: payMonths.filter(m => m.status === 'calculated').length,
            approved_months: payMonths.filter(m => m.status === 'approved').length,
            paid_months: payMonths.filter(m => m.status === 'paid').length,
            closed_months: payMonths.filter(m => m.status === 'closed').length
          }
        };

        console.log('✅ [getPayrollStats] Statistiques calculées:', stats);
        
        return {
          success: true,
          data: stats
        };
      }
    } catch (error) {
      console.error('❌ [getPayrollStats] Erreur:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  },

  getQuickStats: async () => {
    try {
      console.log('📈 [getQuickStats] Statistiques rapides');
      
      const [monthsRes, employeesRes] = await Promise.allSettled([
        payrollService.getPayMonths(),
        payrollService.getAvailableEmployees()
      ]);

      const payMonths = monthsRes.status === 'fulfilled' ? monthsRes.value.data : [];
      const employees = employeesRes.status === 'fulfilled' ? employeesRes.value.data : [];

      const quickStats = {
        months_count: payMonths.length,
        employees_count: employees.length,
        configured_count: employees.filter(e => e.has_salary_config).length,
        last_month: payMonths.length > 0 ? payMonths[0].month_year : null,
        pending_months: payMonths.filter(m => m.status === 'draft' || m.status === 'calculated').length
      };

      return {
        success: true,
        data: quickStats
      };
    } catch (error) {
      console.error('❌ [getQuickStats] Erreur:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  },

  // ==================== BULK OPERATIONS ====================
  bulkCalculate: async (monthYears) => {
    try {
      console.log('🧮 [bulkCalculate] Calcul multiple:', monthYears);
      const response = await api.post('/payroll/bulk/calculate', { month_years: monthYears });
      console.log('✅ [bulkCalculate] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('bulkCalculate', error);
    }
  },

  bulkApprove: async (paymentIds) => {
    try {
      console.log('✅ [bulkApprove] Approbation multiple:', paymentIds);
      const response = await api.post('/payroll/bulk/approve', { payment_ids: paymentIds });
      console.log('✅ [bulkApprove] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('bulkApprove', error);
    }
  },

  // ==================== SYNCHRONISATION ====================
  syncWithAttendance: async (monthYear) => {
    try {
      console.log('🔄 [syncWithAttendance] Synchronisation présence:', monthYear);
      const response = await api.post('/payroll/sync-attendance', { month_year: monthYear });
      console.log('✅ [syncWithAttendance] Succès:', response.data);
      return response.data;
    } catch (error) {
      handleApiError('syncWithAttendance', error);
    }
  },

  // ==================== MÉTHODES UTILITAIRES ====================
  formatCurrency: (amount, currency = 'TND') => {
    if (!amount && amount !== 0) return 'N/A';
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  },

  formatDate: (dateString, options = {}) => {
    if (!dateString) return 'N/A';
    const defaultOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    };
    return new Date(dateString).toLocaleDateString('fr-FR', { ...defaultOptions, ...options });
  },

  // ==================== VALIDATION ====================
  validateSalaryConfig: (config) => {
    const errors = [];
    
    if (!config.employee_id) {
      errors.push('ID employé requis');
    }
    
    if (!config.base_salary || parseFloat(config.base_salary) <= 0) {
      errors.push('Salaire de base doit être > 0');
    }
    
    if (config.tax_rate && (parseFloat(config.tax_rate) < 0 || parseFloat(config.tax_rate) > 100)) {
      errors.push('Taux d\'impôt invalide (0-100%)');
    }
    
    if (config.social_security_rate && (parseFloat(config.social_security_rate) < 0 || parseFloat(config.social_security_rate) > 100)) {
      errors.push('Taux sécurité sociale invalide (0-100%)');
    }
    
    return errors;
  }
};

// Exporter les fonctions individuellement pour les imports nommés
export const {
  getPayMonths,
  createPayMonth,
  updatePayMonth,
  deletePayMonth,
  getPayMonth,
  getSalaryConfig,
  configureSalary,
  updateSalaryConfig,
  deleteSalaryConfig,
  getAvailableEmployees,
  getEmployeesWithoutConfig,
  calculateSalaries,
  getMonthlyPayments,
  getAllPayments,
  getEmployeePayHistory,
  approvePayment,
  markAsPaid,
  getPayment,
  generatePayrollReport,
  exportPaymentsToCSV,
  exportPaymentsToExcel,
  testConnection,
  healthCheck,
  getPayrollStats,
  getQuickStats,
  bulkCalculate,
  bulkApprove,
  syncWithAttendance,
  formatCurrency,
  formatDate,
  validateSalaryConfig
} = payrollService;

// Export par défaut
export default payrollService;