// src/components/payroll/PayrollDashboard.jsx - VERSION AVEC LOGS DE DÉBOGAGE  
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  Calendar, 
  CreditCard, 
  DollarSign, 
  FileText, 
  PieChart, 
  Users,
  Download,
  Filter,
  RefreshCw,
  PlusCircle,
  AlertTriangle,
  Receipt
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Card from '../ui/Card';
import Button from '../ui/Button';
import PayMonthList from './PayMonthList';
import PayMonthModal from './PayMonthModal';
import CalculateSalariesModal from './CalculateSalariesModal';
import api from '../../services/api';

const PayrollDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [payMonths, setPayMonths] = useState([]);
  const [monthlyPayments, setMonthlyPayments] = useState([]);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [payrollStats, setPayrollStats] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [error, setError] = useState(null);
  const [showPayMonthModal, setShowPayMonthModal] = useState(false);
  const [showCalculateModal, setShowCalculateModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const eventListenersAddedRef = useRef(false);
  const abortControllerRef = useRef(null);
  const lastPaymentLoadRef = useRef(0);
  const lastRefreshRef = useRef(0);

  // ==================== LOGS DE DÉBOGAGE ====================
  useEffect(() => {
    console.log('🔍 PAYROLL DASHBOARD - COMPOSANT MONTÉ');
    console.log('🔍 PayMonthList importé:', PayMonthList);
    console.log('🔍 PayMonthList nom:', PayMonthList.name || 'Anonymous');
    console.log('🔍 PayMonthList type:', typeof PayMonthList);
    
    // Vérifier la source du composant
    try {
      console.log('🔍 PayMonthList source (partiel):', 
        PayMonthList.toString().substring(0, 200) + '...');
    } catch (e) {
      console.log('🔍 Impossible de lire la source de PayMonthList');
    }
  }, []);

  // ==================== FONCTIONS DE CHARGEMENT ====================
  const loadPayMonths = useCallback(async (signal) => {
    try {
      console.log('📅 Chargement mois...');
      
      const response = await api.get('/payroll/pay-months', {
        skipCache: true,
        signal
      });
      
      console.log('📊 Réponse API mois:', response);
      
      if (response && response.success && Array.isArray(response.data)) {
        const months = response.data;
        console.log(`✅ ${months.length} mois chargés`);
        
        setPayMonths(months);
        
        if (!selectedMonth && months.length > 0) {
          const firstMonth = months[0];
          console.log('🎯 Auto-sélection:', firstMonth.month_year);
          setSelectedMonth(firstMonth.month_year);
        }
        
        return months;
      } else {
        console.warn('Structure réponse inattendue:', response);
        setPayMonths([]);
        return [];
      }
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Erreur chargement mois:', error);
      }
      return [];
    }
  }, [selectedMonth]);
  
  const loadMonthlyPayments = useCallback(async (monthYear) => {
    if (!monthYear) {
      console.log('⚠️ Mois invalide pour paiements');
      return;
    }
    
    const now = Date.now();
    if (lastPaymentLoadRef.current && (now - lastPaymentLoadRef.current < 1000)) {
      console.log('⏸️  Chargement paiements trop rapide, skip');
      return;
    }
    lastPaymentLoadRef.current = now;
    
    try {
      console.log('💰 Chargement paiements pour:', monthYear);
      const response = await api.get(`/payroll/payments/${monthYear}`, {
        skipCache: true
      });
      
      if (response.success) {
        const payments = response.data?.payments || response.data || [];
        console.log('✅ Paiements chargés:', payments.length);
        setMonthlyPayments(payments);
      }
    } catch (error) {
      console.error('Erreur paiements:', error);
    }
  }, []);
  
  const loadAvailableEmployees = async () => {
    try {
      console.log('🔄 Chargement employés...');
      
      const result = await api.get('/payroll/employees');
      console.log('📊 Résultat API:', result);
      
      if (result && result.success) {
        if (Array.isArray(result.data)) {
          console.log(`✅ ${result.data.length} employés (array)`);
          setAvailableEmployees(result.data);
        }
        else if (result.data && Array.isArray(result.data.data)) {
          console.log(`✅ ${result.data.data.length} employés (nested)`);
          setAvailableEmployees(result.data.data);
        }
        else if (Array.isArray(result)) {
          console.log(`✅ ${result.length} employés (direct array)`);
          setAvailableEmployees(result);
        } else {
          console.error('❌ Structure inattendue:', result);
          setAvailableEmployees([]);
        }
      } else {
        console.error('❌ Réponse non successful:', result);
        setAvailableEmployees([]);
      }
      
    } catch (error) {
      console.error('❌ Erreur:', error);
      const mockEmployees = [
        {
          id: 1,
          employee_id: 'EMP001',
          first_name: 'Test',
          last_name: 'Employé',
          department: 'IT',
          has_salary_config: true
        }
      ];
      console.log('🔄 Utilisation données mock');
      setAvailableEmployees(mockEmployees);
    }
  };
  
  const loadPayrollStats = useCallback(async () => {
    try {
      const response = await api.get('/payroll/stats');
      
      if (response.data.success) {
        setPayrollStats(response.data.data);
        console.log('📊 Statistiques chargées');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Erreur chargement stats:', error);
      }
    }
  }, []);
  
  const refreshData = useCallback(async (force = false) => {
    if (refreshing && !force) {
      console.log('⏸️  Rafraîchissement déjà en cours, skip...');
      return;
    }
    
    try {
      console.log('🔄 Début du rafraîchissement des données');
      setRefreshing(true);
      setError(null);
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      await Promise.all([
        loadPayMonths(),
        loadAvailableEmployees(),
        loadPayrollStats()
      ]);
      
      console.log('✅ Données rafraîchies');
      
      toast.success('Données actualisées', {
        icon: '✅',
        duration: 2000
      });
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Erreur rafraîchissement:', error);
        toast.error('Erreur lors de l\'actualisation', {
          icon: '❌',
          duration: 3000
        });
      }
    } finally {
      setRefreshing(false);
      console.log('🏁 Rafraîchissement terminé');
    }
  }, [loadPayMonths, loadAvailableEmployees, loadPayrollStats, refreshing]);

  const checkMonthExists = useCallback((monthYear) => {
    const existsLocally = payMonths.some(month => month.month_year === monthYear);
    if (existsLocally) {
      console.log(`❌ Mois ${monthYear} existe déjà localement`);
      return true;
    }
    return false;
  }, [payMonths]);

  // ==================== GESTION DES MOIS ====================
  const handleCreateMonth = useCallback(async (monthData) => {
    try {
      console.log('📝 Vérification création du mois:', monthData.month_year);
      
      const exists = checkMonthExists(monthData.month_year);
      if (exists) {
        toast.error(`Le mois ${monthData.month_year} existe déjà !`, {
          icon: '⚠️',
          duration: 5000,
          style: {
            background: '#fef3c7',
            color: '#92400e',
            border: '1px solid #fbbf24'
          }
        });
        
        const existingMonth = payMonths.find(m => m.month_year === monthData.month_year);
        if (existingMonth) {
          setTimeout(() => {
            if (window.confirm(`Le mois ${monthData.month_year} existe déjà. Voulez-vous le sélectionner ?`)) {
              setSelectedMonth(existingMonth.month_year);
              toast.success(`Mois ${existingMonth.month_name} sélectionné`, {
                icon: '🎯',
                duration: 3000
              });
            }
          }, 1000);
        }
        
        return;
      }
      
      console.log('✅ Création du mois:', monthData);
      const response = await api.post('/payroll/pay-months', monthData);
      
      if (response.data.success) {
        toast.success('Mois de paie créé avec succès', {
          icon: '🎉',
          duration: 3000,
          style: {
            background: '#d1fae5',
            color: '#065f46',
            border: '1px solid #10b981'
          }
        });
        
        setShowPayMonthModal(false);
        
        setTimeout(() => {
          refreshData();
        }, 500);
      }
    } catch (error) {
      console.error('❌ Erreur création mois:', error);
      
      if (error.response?.status === 409) {
        const errorMessage = error.response?.data?.message || `Le mois ${monthData.month_year} existe déjà`;
        
        toast.error(errorMessage, {
          icon: '⚠️',
          duration: 6000,
          style: {
            background: '#fef3c7',
            color: '#92400e',
            border: '1px solid #fbbf24'
          }
        });
        
        const [year, month] = monthData.month_year.split('-');
        const nextMonth = parseInt(month) === 12 
          ? `${parseInt(year) + 1}-01`
          : `${year}-${String(parseInt(month) + 1).padStart(2, '0')}`;
        
        setTimeout(() => {
          toast.info(`Essayez le mois ${nextMonth}`, {
            icon: '💡',
            duration: 4000
          });
        }, 2000);
        
      } else {
        toast.error(error.response?.data?.message || 'Erreur lors de la création du mois', {
          icon: '❌',
          duration: 4000
        });
      }
    }
  }, [checkMonthExists, payMonths, refreshData]);

  // ==================== GESTION DES CALCULS ====================
  // Dans PayrollDashboard.jsx, REMPLACEZ la fonction handleCalculateSalaries par :

const handleCalculateSalaries = useCallback(async (monthYear) => {
  try {
    // 🔴 LOGS DE DÉBOGAGE
    console.log('💰 PAYROLL DASHBOARD - handleCalculateSalaries APPELÉE!');
    console.log('💰 Paramètre reçu:', monthYear);
    console.log('💰 Type du paramètre:', typeof monthYear);
    
    // ============================================
    // PHASE 1: DÉTECTION DES NOTIFICATIONS DE PAIEMENT
    // ============================================
    if (typeof monthYear === 'object' && monthYear !== null) {
      console.log('🔍 PHASE 1: Analyse de l\'objet reçu...');
      
      // 🔥 DÉTECTION AMÉLIORÉE DES NOTIFICATIONS DE PAIEMENT
      const isPaymentNotification = 
        // Flags de type
        monthYear.type === 'PAYMENT_COMPLETED' ||
        monthYear.type === 'payment-complete' ||
        monthYear.type === 'already-paid-notification' ||
        monthYear.type === 'PAYMENT_COMPLETED_DO_NOT_RECALCULATE' ||
        
        // Flags d'action
        monthYear.action === 'MARKED_AS_PAID' ||
        monthYear.action === 'marked-as-paid' ||
        
        // Flags explicites de contrôle
        monthYear._shouldNotRecalculate === true ||
        monthYear._isPaymentNotification === true ||
        monthYear._doNotCalculate === true ||
        monthYear.shouldNotRecalculate === true ||
        
        // Message explicite
        (monthYear.message && monthYear.message.includes('PAYMENT_NOTIFICATION'));
      
      if (isPaymentNotification) {
        console.log('🚫 NOTIFICATION DE PAIEMENT DÉTECTÉE - ARRÊT IMMÉDIAT');
        console.log('📊 Type:', monthYear.type);
        console.log('📊 Action:', monthYear.action);
        console.log('📊 Mois:', monthYear.month_year);
        console.log('📊 Flags détectés:', {
          _shouldNotRecalculate: monthYear._shouldNotRecalculate,
          _isPaymentNotification: monthYear._isPaymentNotification,
          _doNotCalculate: monthYear._doNotCalculate,
          shouldNotRecalculate: monthYear.shouldNotRecalculate
        });
        
        // 🔥 ARRÊTER IMMÉDIATEMENT avec return
        return; // ⬅️ CECI EST CRITIQUE - NE PAS CONTINUER
      }
      
      // 🔥 VÉRIFICATION SUPPLÉMENTAIRE : Si c'est une réponse API de paiement
      const isApiPaymentResponse = 
        monthYear.success === true &&
        monthYear.message && (
          monthYear.message.includes('marqué comme payé') ||
          monthYear.message.includes('marked as paid') ||
          monthYear.message.includes('already paid') ||
          monthYear.message.includes('déjà payé')
        );
      
      if (isApiPaymentResponse) {
        console.log('🚫 RÉPONSE API DE PAIEMENT DÉTECTÉE - ARRÊT IMMÉDIAT');
        return; // ⬅️ ARRÊTER IMMÉDIATEMENT
      }
    }
    
    // ============================================
    // PHASE 2: EXTRACTION DU MOIS (SEULEMENT SI PAS UN PAIEMENT)
    // ============================================
    console.log('🔍 PHASE 2: Extraction du mois pour calcul...');
    
    let monthString;
    
    // Extraction du mois
    if (typeof monthYear === 'string') {
      monthString = monthYear.trim();
    } else if (typeof monthYear === 'object' && monthYear !== null) {
      // 🔥 VÉRIFICATION DOUBLE : S'assurer que ce n'est PAS une notification
      if (monthYear.type && monthYear.type.includes('PAYMENT')) {
        console.error('❌ ERREUR CRITIQUE: Une notification de paiement a passé la phase 1!');
        console.error('❌ Objet problématique:', monthYear);
        return;
      }
      
      // Extraction sécurisée
      monthString = monthYear.month_year || 
                   (monthYear.data && monthYear.data.month_year) || 
                   monthYear.id || 
                   monthYear.value;
      
      if (!monthString) {
        console.error('❌ Impossible d\'extraire le mois de l\'objet:', monthYear);
        toast.error('Format de mois invalide');
        return;
      }
    } else {
      monthString = String(monthYear).trim();
    }
    
    // ============================================
    // PHASE 3: VALIDATION ET CALCUL
    // ============================================
    console.log('✅ Mois pour calcul (après filtrage):', monthString);
    
    // Validation du format
    if (!/^\d{4}-\d{2}$/.test(monthString)) {
      console.error('❌ Format de mois invalide:', monthString);
      toast.error('Format de mois invalide. Attendu: AAAA-MM');
      return;
    }
    
    // Vérifier si le mois est déjà payé
    try {
      const monthStatus = await api.get(`/payroll/pay-months/${monthString}`, {
        skipCache: true,
        timeout: 2000
      });
      
      if (monthStatus.data?.status === 'paid') {
        const confirmRecalc = window.confirm(
          `⚠️ ATTENTION\n\n` +
          `Le mois ${monthString} est déjà marqué comme PAYÉ.\n\n` +
          `Voulez-vous vraiment recalculer les salaires ?\n\n` +
          `✓ Cela va réinitialiser le statut à "calculated"\n` +
          `✓ Les emails ne seront pas renvoyés\n` +
          `✓ Le paiement devra être revalidé`
        );
        
        if (!confirmRecalc) {
          return;
        }
      }
    } catch (statusError) {
      console.warn('Impossible de vérifier le statut du mois:', statusError.message);
    }
    
    // Demander confirmation
    const confirmMessage = `Voulez-vous calculer les salaires pour ${monthString} ?\n\n` +
                          `✓ Calculer les salaires nets\n` +
                          `✓ Générer les fiches de paie\n` +
                          `✓ Préparer le paiement\n\n` +
                          `Cette opération peut prendre quelques instants.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    // Appel API
    const response = await api.post('/payroll/calculate', { 
      month_year: monthString 
    });
    
    console.log('✅ Réponse API:', response);
    
    if (response.data.success) {
      toast.success('Salaires calculés avec succès', {
        icon: '✅',
        duration: 3000
      });
      
      // Fermer le modal
      setShowCalculateModal(false);
      
      // Rafraîchir les données
      setTimeout(() => {
        refreshData();
      }, 500);
    } else {
      toast.error(response.data.message || 'Erreur lors du calcul', {
        icon: '❌',
        duration: 5000
      });
    }
  } catch (error) {
    console.error('❌ Erreur dans handleCalculateSalaries:', error);
    
    let errorMessage = 'Erreur lors du calcul des salaires';
    
    if (error.response?.status === 400) {
      errorMessage = error.response.data?.message || 'Erreur de validation';
    } else if (error.response?.status === 500) {
      errorMessage = 'Erreur serveur lors du calcul';
    }
    
    toast.error(errorMessage, {
      icon: '❌',
      duration: 5000
    });
  }
}, [refreshData]);

  // ==================== ÉCOUTEURS D'ÉVÉNEMENTS ====================
  useEffect(() => {
    console.log('🔧 PayrollDashboard: Configuration des écouteurs d\'événements');
    
    const handleOpenPayMonthModal = (event) => {
      console.log('✅ ÉVÉNEMENT CAPTURÉ: open-paymonth-modal');
      setShowPayMonthModal(true);
      toast.success('Création d\'un nouveau mois de paie', {
        icon: '📅',
        duration: 2000
      });
    };

    const handleOpenCalculateModal = (event) => {
      console.log('✅ ÉVÉNEMENT CAPTURÉ: open-calculate-modal');
      
      if (!selectedMonth) {
        if (payMonths.length > 0) {
          const firstMonth = payMonths[0];
          setSelectedMonth(firstMonth.month_year);
          
          toast.info(`Mois ${firstMonth.month_name} sélectionné`, {
            icon: '🎯',
            duration: 2000
          });
          setTimeout(() => {
            setShowCalculateModal(true);
          }, 300);
        } else {
          toast.error('Veuillez d\'abord créer un mois de paie', {
            icon: '⚠️',
            duration: 3000
          });
          
          setTimeout(() => {
            setShowPayMonthModal(true);
          }, 1000);
        }
        return;
      }
      
      setShowCalculateModal(true);
    };

    if (!eventListenersAddedRef.current) {
      document.addEventListener('open-paymonth-modal', handleOpenPayMonthModal);
      document.addEventListener('open-calculate-modal', handleOpenCalculateModal);
      eventListenersAddedRef.current = true;
    }

    return () => {
      document.removeEventListener('open-paymonth-modal', handleOpenPayMonthModal);
      document.removeEventListener('open-calculate-modal', handleOpenCalculateModal);
      eventListenersAddedRef.current = false;
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedMonth, payMonths]);

  // CHARGEMENT INITIAL UNIQUEMENT
  useEffect(() => {
    console.log('🚀 Chargement initial...');
    
    const loadInitialData = async () => {
      try {
        setLoading(true);
        await refreshData(true);
      } catch (error) {
        setError('Impossible de charger les données initiales');
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // CHARGEMENT PAIEMENTS QUAND MOIS CHANGE
  useEffect(() => {
    if (selectedMonth) {
      console.log('📅 Mois changé:', selectedMonth);
      const timer = setTimeout(() => {
        loadMonthlyPayments(selectedMonth);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [selectedMonth, loadMonthlyPayments]);
  
  // ==================== CALCUL DES STATISTIQUES ====================
  const stats = React.useMemo(() => {
    const totalPaidThisMonth = monthlyPayments.reduce((sum, p) => sum + (parseFloat(p?.net_salary) || 0), 0) || 0;
    const totalWithConfig = availableEmployees.filter(e => e.has_salary_config).length || 0;
    const totalEmployees = availableEmployees.length || 0;
    
    return {
      totalEmployees,
      totalWithConfig,
      totalPaidThisMonth,
      averageSalary: monthlyPayments.length > 0 
        ? totalPaidThisMonth / monthlyPayments.length
        : 0,
      totalPayments: payrollStats?.general?.total_payments || 0,
      totalPaidOverall: payrollStats?.general?.total_paid_amount || 0,
      configuredPercentage: totalEmployees > 0 
        ? (totalWithConfig / totalEmployees * 100)
        : 0,
      pendingMonths: payMonths.filter(m => m.status === 'draft').length || 0,
      paidMonths: payMonths.filter(m => m.status === 'paid').length || 0,
      calculatedMonths: payMonths.filter(m => m.status === 'calculated').length || 0
    };
  }, [monthlyPayments, availableEmployees, payrollStats, payMonths]);
  
  // ==================== GESTION DES ERREURS ====================
  if (error && payMonths.length === 0 && availableEmployees.length === 0) {
    return (
      <div className="p-6">
        <div className="border-red-200 bg-red-50 rounded-lg p-6">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-800">Erreur de chargement</h3>
            <p className="text-red-600 mt-2">{error}</p>
            <Button 
              onClick={refreshData}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Réessayer
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  if (loading && !refreshing) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
        <div className="animate-pulse">
          <div className="h-64 bg-gray-200 rounded w-full mb-6"></div>
        </div>
      </div>
    );
  }
  
  // ==================== RENDU PRINCIPAL ====================
  return (
    <div className="p-4" data-component="payroll-dashboard">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tableau de Bord Paie</h2>
          <p className="text-gray-600 mt-1">Vue d'ensemble des activités et statistiques de paie</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              const now = Date.now();
              if (now - lastRefreshRef.current < 2000) {
                toast.info('Veuillez patienter avant de rafraîchir à nouveau');
                return;
              }
              lastRefreshRef.current = now;
              refreshData();
            }}
            variant="outline"
            size="sm"
            disabled={refreshing}
            className="flex items-center"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Actualisation...' : 'Actualiser'}
          </Button>
          
          <Button
            onClick={() => setShowPayMonthModal(true)}
            variant="primary"
            size="sm"
            className="flex items-center bg-blue-600 hover:bg-blue-700"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Nouveau mois
          </Button>
          
          <Button
            onClick={() => {
              if (!selectedMonth) {
                toast.error('Veuillez d\'abord sélectionner un mois', {
                  icon: '⚠️',
                  duration: 3000
                });
                return;
              }
              setShowCalculateModal(true);
            }}
            variant="success"
            size="sm"
            disabled={!selectedMonth}
            className="flex items-center bg-green-600 hover:bg-green-700"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Calculer
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Employés actifs</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalEmployees}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.totalWithConfig} configurés</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>
        
        <Card className="p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Configuration</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.configuredPercentage.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Taux de configuration</p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <PieChart className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>
        
        <Card className="p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Mois créés</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{payMonths.length}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.paidMonths} payés • {stats.pendingMonths} en attente
              </p>
            </div>
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </Card>
        
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Fiches de Paie</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">Accès</p>
              <p className="text-xs text-gray-500 mt-1">Voir toutes les fiches</p>
            </div>
            <div className="p-2 bg-purple-100 rounded-lg">
              <Receipt className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <button 
            onClick={() => window.location.href = '/payroll/payslips'}
            className="w-full mt-3 px-3 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-md font-medium hover:from-purple-500 hover:to-purple-600 transition-all shadow-sm hover:shadow"
          >
            Consulter les fiches
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-4 h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Mois de paie</h3>
                <p className="text-sm text-gray-600">Gérez les périodes de paie</p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => setShowPayMonthModal(true)} variant="outline" size="sm">
                  <Calendar className="w-4 h-4 mr-2" /> Nouveau
                </Button>
                <Button variant="ghost" size="sm" title="Filtrer">
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>

                        
            {payMonths.length > 0 ? (
              <>
                {/* LOGS DE DÉBOGAGE */}
                <div style={{ display: 'none' }} data-debug="payroll-dashboard-state">
                  <script type="application/json">
                    {JSON.stringify({
                      payMonthsCount: payMonths.length,
                      selectedMonth: selectedMonth,
                      payMonthListComponent: PayMonthList?.name || 'Unknown'
                    })}
                  </script>
                </div>
                
                <PayMonthList
                  payMonths={payMonths}
                  selectedMonth={selectedMonth}
                  onSelectMonth={setSelectedMonth}
                  onCalculate={(monthYear) => {
                    console.log('🚨🚨🚨 PAYROLL DASHBOARD - ONCALCULATE APPELÉ!');
                    console.log('=== DÉBOGAGE DÉTAILLÉ ===');
                    console.log('1. Paramètre reçu:', monthYear);
                    console.log('2. Type du paramètre:', typeof monthYear);
                    console.log('3. Est une chaîne?', typeof monthYear === 'string');
                    console.log('4. Est un objet?', monthYear && typeof monthYear === 'object');
                    console.log('5. Valeur brute:', monthYear);
                    
                    if (typeof monthYear === 'object' && monthYear !== null) {
                      console.log('6. Clés de l\'objet:', Object.keys(monthYear));
                      console.log('7. month_year dans l\'objet:', monthYear.month_year);
                      console.log('8. Objet complet:', JSON.stringify(monthYear, null, 2));
                    }
                    
                    // LOGIQUE DE CONVERSION ROBUSTE
                    let monthYearString;
                    
                    if (typeof monthYear === 'string') {
                      // Cas 1: Déjà une chaîne
                      monthYearString = monthYear;
                      console.log('✅ Cas 1: Déjà une chaîne ->', monthYearString);
                    } 
                    else if (typeof monthYear === 'object' && monthYear !== null) {
                      // Cas 2: Objet, on extrait month_year
                      monthYearString = monthYear.month_year;
                      console.log('🔧 Cas 2: Extraction depuis objet ->', monthYearString);
                      
                      // Si month_year n'existe pas, essayer d'autres propriétés
                      if (!monthYearString) {
                        monthYearString = monthYear.id || monthYear.month || monthYear.name;
                        console.log('⚠️  month_year non trouvé, essai autre ->', monthYearString);
                      }
                    }
                    else {
                      // Cas 3: Autre type (number, etc.)
                      monthYearString = String(monthYear);
                      console.log('🔄 Cas 3: Conversion en chaîne ->', monthYearString);
                    }
                    
                    console.log('📌 Chaîne extraite finale:', monthYearString);
                    console.log('📌 Type final:', typeof monthYearString);
                    
                    // VALIDATION
                    if (!monthYearString || typeof monthYearString !== 'string') {
                      console.error('❌ ERREUR CRITIQUE: Impossible d\'obtenir une chaîne valide');
                      console.error('Données originales:', monthYear);
                      toast.error('Erreur interne: impossible de déterminer le mois');
                      return;
                    }
                    
                    // Vérifier le format
                    if (!/^\d{4}-\d{2}$/.test(monthYearString)) {
                      console.warn('⚠️  Format de mois suspect:', monthYearString);
                    }
                    
                    console.log('🎯 Mois sélectionné pour calcul:', monthYearString);
                    
                    // Mettre à jour l'état
                    setSelectedMonth(monthYearString);
                    
                    // Ouvrir le modal avec un délai
                    setTimeout(() => {
                      console.log('📋 Ouverture du modal de calcul pour:', monthYearString);
                      setShowCalculateModal(true);
                    }, 100);
                  }}
                />
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-gray-400" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Aucun mois de paie</h4>
                <p className="text-gray-600 mb-4">Commencez par créer votre premier mois de paie</p>
                <Button onClick={() => setShowPayMonthModal(true)} variant="primary">
                  <PlusCircle className="w-4 h-4 mr-2" /> Créer un mois
                </Button>
              </div>
            )}
          </Card>
        </div>
        
        <div>
          <Card className="p-4 h-full">
            <div className="mb-4">
  <h3 className="text-lg font-semibold text-gray-900">
    {selectedMonth ? `Paiements ${selectedMonth}` : 'Paiements'}
  </h3>
  <p className="text-sm text-gray-600">
    {selectedMonth 
      ? `${monthlyPayments.length} paiements trouvés` 
      : 'Sélectionnez un mois'
    }
  </p>
</div>
            
            {selectedMonth ? (
              monthlyPayments.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {monthlyPayments.slice(0, 5).map((payment, index) => (
                    <div key={payment.id || index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">
                            {payment.first_name} {payment.last_name}
                          </p>
                          <p className="text-sm text-gray-600">{payment.department}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            {parseFloat(payment.net_salary || 0).toLocaleString('fr-FR', {
                              style: 'currency',
                              currency: 'TND',
                              minimumFractionDigits: 0
                            })}
                          </p>
                          <p className="text-xs text-gray-500">net</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {monthlyPayments.length > 5 && (
                    <div className="text-center pt-2">
                      <p className="text-sm text-gray-500">
                        + {monthlyPayments.length - 5} paiements supplémentaires
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CreditCard className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-600 mb-2">Aucun paiement pour ce mois</p>
                  <Button onClick={() => setShowCalculateModal(true)} variant="outline" size="sm">
                    Calculer les salaires
                  </Button>
                </div>
              )
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-gray-600">Sélectionnez un mois pour voir les paiements</p>
              </div>
            )}
            
            {selectedMonth && monthlyPayments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total du mois:</span>
                  <span className="font-bold text-lg text-green-600">
                    {stats.totalPaidThisMonth.toLocaleString('fr-FR', {
                      style: 'currency',
                      currency: 'TND',
                      minimumFractionDigits: 0
                    })}
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
      
      <div className="mt-6">
        <Card className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Statut du système</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center mb-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-sm font-medium text-blue-800">API Paie</span>
              </div>
              <p className="text-xs text-blue-700">Connectée et fonctionnelle</p>
            </div>
            
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center mb-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm font-medium text-green-800">Base de données</span>
              </div>
              <p className="text-xs text-green-700">
                {availableEmployees.length} employés, {payMonths.length} mois
              </p>
            </div>
            
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center mb-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                <span className="text-sm font-medium text-purple-800">Configuration</span>
              </div>
              <p className="text-xs text-purple-700">
                {stats.totalWithConfig}/{stats.totalEmployees} employés configurés
              </p>
            </div>
          </div>
        </Card>
      </div>
      
      {showPayMonthModal && (
        <PayMonthModal
          isOpen={showPayMonthModal}
          onClose={() => setShowPayMonthModal(false)}
          onSave={handleCreateMonth}
          existingMonths={payMonths.map(m => m.month_year)}
        />
      )}
      
      {showCalculateModal && (
        <CalculateSalariesModal
          isOpen={showCalculateModal}
          onClose={() => setShowCalculateModal(false)}
          monthYear={selectedMonth}
          onSuccess={handleCalculateSalaries}
        />
      )}
    </div>
  );
};

export default PayrollDashboard; 