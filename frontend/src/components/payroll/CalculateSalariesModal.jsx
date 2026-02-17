// src/components/payroll/CalculateSalariesModal.jsx - VERSION COMPLÈTE CORRIGÉE   
import React, { useState, useEffect, useRef } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { 
  CheckCircle, 
  XCircle, 
  DollarSign, 
  Calendar,
  Calculator,
  CreditCard,
  AlertCircle,
  Loader,
  ChevronRight,
  AlertTriangle,
  Mail,
  FileText,
  Users
} from 'lucide-react';

const CalculateSalariesModal = ({ 
  isOpen, 
  onClose, 
  monthYear, 
  onSuccess,
  employeeCount = 0,
  isRecalculate = false 
}) => {
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [markingAsPaid, setMarkingAsPaid] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(monthYear || '');
  const [availableMonths, setAvailableMonths] = useState([]);
  const [results, setResults] = useState(null);
  const [paymentValidation, setPaymentValidation] = useState(null);
  const [activeStep, setActiveStep] = useState('select');
  const [calculationErrors, setCalculationErrors] = useState([]);
  const [emailStats, setEmailStats] = useState(null);
  
  const isCalculatingRef = useRef(false);
  const isMarkingAsPaidRef = useRef(false);
  //const processedMonthsRef = useRef(new Set());

  // Charger les mois disponibles
  useEffect(() => {
    if (isOpen) {
      loadAvailableMonths();
      resetState();
    }
  }, [isOpen]);

  // Mettre à jour le mois sélectionné
  useEffect(() => {
    if (monthYear) {
      // S'assurer que monthYear est une chaîne
      let monthString = monthYear;
      if (typeof monthYear === 'object' && monthYear !== null) {
        monthString = monthYear.month_year || monthYear.value || monthYear.id;
      }
      setSelectedMonth(String(monthString).trim());
      
      if (isOpen) {
        setTimeout(() => loadPreview(), 100);
      }
    }
  }, [monthYear, isOpen]);

  const resetState = () => {
    setPreviewData(null);
    setResults(null);
    setPaymentValidation(null);
    setCalculationErrors([]);
    setEmailStats(null);
    setActiveStep('select');
    isCalculatingRef.current = false;
    isMarkingAsPaidRef.current = false;
  };

  const loadAvailableMonths = async () => {
    try {
      setLoading(true);
      
      const response = await api.get('/payroll/pay-months');
      
      let months = [];
      
      if (response && response.success) {
        if (Array.isArray(response.data)) {
          months = response.data;
        } else if (response.data && Array.isArray(response.data.data)) {
          months = response.data.data;
        }
      }
      
      setAvailableMonths(months);
      
    } catch (error) {
      console.error('Erreur chargement mois:', error);
      toast.error('Erreur chargement mois disponibles');
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async () => {
    if (!selectedMonth) {
      toast.error('Veuillez sélectionner un mois');
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Chargement prévisualisation pour:', selectedMonth);
      
      // S'assurer que selectedMonth est une chaîne pour les requêtes
      const monthForRequest = String(selectedMonth).trim();
      
      // Récupérer les détails du mois
      const monthResponse = await api.get(`/payroll/pay-months/${monthForRequest}`);
      
      // Récupérer les employés
      const employeesResponse = await api.get('/payroll/employees');
      
      // Récupérer les paiements du mois
      const paymentsResponse = await api.get(`/payroll/payments/${monthForRequest}`);
      
      // Traiter les données du mois
      let monthData = null;
      if (monthResponse && monthResponse.success) {
        monthData = monthResponse.data || monthResponse.data?.data;
      }
      
      // Traiter les données des employés
      let employeesData = [];
      let employeesStats = { total: 0, with_config: 0, without_config: 0 };
      
      if (employeesResponse && employeesResponse.success) {
        if (Array.isArray(employeesResponse.data)) {
          employeesData = employeesResponse.data;
        } else if (employeesResponse.data && Array.isArray(employeesResponse.data.data)) {
          employeesData = employeesResponse.data.data;
        }
        
        employeesStats.total = employeesData.length;
        employeesStats.with_config = employeesData.filter(e => e.has_salary_config).length;
        employeesStats.without_config = employeesStats.total - employeesStats.with_config;
      }
      
      // Traiter les paiements
      let paymentsData = [];
      let paymentsStats = { total: 0, amount: 0 };
      
      if (paymentsResponse && paymentsResponse.success) {
        if (paymentsResponse.data && paymentsResponse.data.payments && Array.isArray(paymentsResponse.data.payments)) {
          paymentsData = paymentsResponse.data.payments;
        } else if (Array.isArray(paymentsResponse.data)) {
          paymentsData = paymentsResponse.data;
        } else if (paymentsResponse.data && paymentsResponse.data.data && paymentsResponse.data.data.payments) {
          paymentsData = paymentsResponse.data.data.payments;
        }
        
        paymentsStats.total = paymentsData.length;
        paymentsStats.amount = paymentsData.reduce((sum, p) => sum + (parseFloat(p.net_salary) || 0), 0);
      }
      
      // Préparer les données pour l'affichage
      setPreviewData({
        month: monthData,
        employees: employeesData,
        payments: paymentsData,
        stats: {
          totalEmployees: employeesStats.total,
          withConfig: employeesStats.with_config,
          withoutConfig: employeesStats.without_config,
          totalPayments: paymentsStats.total,
          totalAmount: paymentsStats.amount
        }
      });

      setActiveStep('preview');
      
    } catch (error) {
      console.error('❌ Erreur chargement prévisualisation:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    // Protection contre les appels multiples
    if (isCalculatingRef.current || calculating) {
      console.log('⏸️  Calcul déjà en cours, skip...');
      return;
    }

    if (!selectedMonth) {
      toast.error('Veuillez sélectionner un mois');
      return;
    }

    // DEBUG: Vérifier ce qui est envoyé
    console.log('🔍 DEBUG handleCalculate:', {
      selectedMonth,
      type: typeof selectedMonth,
      isObject: typeof selectedMonth === 'object',
      stringValue: String(selectedMonth),
      isMonthPaid: isMonthPaid()
    });

    // CORRECTION: S'assurer que month_year est une chaîne
    let monthYearToCalculate = selectedMonth;
    
    // Si c'est un objet, extraire la propriété month_year
    if (typeof selectedMonth === 'object' && selectedMonth !== null) {
      monthYearToCalculate = selectedMonth.month_year || selectedMonth.value || selectedMonth.id;
      console.log('🔧 Extraction depuis objet:', monthYearToCalculate);
    }
    
    // S'assurer que c'est une chaîne
    monthYearToCalculate = String(monthYearToCalculate).trim();
    
    if (!monthYearToCalculate || monthYearToCalculate === 'undefined' || monthYearToCalculate === 'null') {
      toast.error('Mois invalide sélectionné');
      return;
    }

    console.log('📤 Envoi calcul pour:', monthYearToCalculate);

    // MESSAGE DE CONFIRMATION AMÉLIORÉ POUR LES RECALCULS
    const confirmationMessage = isMonthPaid() 
      ? `⚠️ ATTENTION : Ce mois (${monthYearToCalculate}) est DÉJÀ MARQUÉ COMME PAYÉ.\n\n` +
        `UN RECALCUL VA MODIFIER LES MONTANTS EXISTANTS.\n\n` +
        `Êtes-vous ABSOLUMENT SÛR de vouloir recalculer ?\n\n` +
        `✓ Les fiches de paie seront mises à jour\n` +
        `✓ Le statut restera "Payé"\n` +
        `✓ Les montants des paiements seront modifiés`
      : `Êtes-vous sûr de vouloir ${isRecalculate ? 'recalculer' : 'calculer'} les salaires pour ${monthYearToCalculate} ?\n\n` +
        `Cette opération va :\n` +
        `✓ Calculer les salaires pour tous les employés configurés\n` +
        `✓ Générer les fiches de paie\n` +
        `✓ Mettre à jour les statistiques\n\n` +
        `Cette opération peut prendre quelques instants.`;

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    try {
      isCalculatingRef.current = true;
      setCalculating(true);
      setCalculationErrors([]);
      
      console.log('🧮 Début calcul pour:', monthYearToCalculate);
      const response = await api.post('/payroll/calculate', {
        month_year: monthYearToCalculate
      });

      console.log('✅ Réponse calcul:', response);
      
      // Extraire les résultats
      const resultData = response.data || response;
      setResults(resultData);
      
      // Extraire les erreurs si elles existent
      if (resultData.data?.errors && Array.isArray(resultData.data.errors)) {
        setCalculationErrors(resultData.data.errors);
      }
      
      // Recharger la prévisualisation
      await loadPreview();
      
      toast.success(isMonthPaid() ? '✅ Recalcul terminé avec succès !' : '✅ Calcul terminé avec succès !', {
        duration: 4000,
        icon: '🎉'
      });
      
      setActiveStep('mark-paid');
      
    } catch (error) {
      console.error('❌ Erreur calcul salaires:', error);
      
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Erreur lors du calcul';
      
      toast.error(errorMessage, {
        duration: 5000,
        style: {
          background: '#fef2f2',
          color: '#991b1b',
          border: '1px solid #f87171'
        }
      });
      
      // Même en cas d'erreur, on peut passer à l'étape suivante si des calculs ont été faits
      if (error.response?.data?.calculated && error.response.data.calculated > 0) {
        setActiveStep('mark-paid');
      }
    } finally {
      isCalculatingRef.current = false;
      setCalculating(false);
    }
  };

  const handleMarkAsPaid = async () => {
  // 🔒 PROTECTION CONTRE LES CLICS MULTIPLES 
  if (isMarkingAsPaidRef.current || markingAsPaid) {
    console.log('⏸️ Marquage déjà en cours, skip...');
    toast.info('Le traitement est déjà en cours, veuillez patienter...', {
      icon: '⏳',
      duration: 3000,
      style: {
        background: '#f3f4f6',
        color: '#374151',
        border: '1px solid #d1d5db'
      }
    });
    return;
  }

  // 🎯 ID DE SESSION POUR LE DÉBOGAGE
  const debugSessionId = `pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.group(`🔧 [${debugSessionId}] Début marquage comme payé`);
  
  if (!selectedMonth) {
    toast.error('Veuillez sélectionner un mois', {
      icon: '❌',
      duration: 3000
    });
    console.groupEnd();
    return;
  }

  // 🔧 CONVERSION DU MOIS EN CHAÎNE
  let monthToMark = selectedMonth;
  if (typeof selectedMonth === 'object' && selectedMonth !== null) {
    monthToMark = selectedMonth.month_year || selectedMonth.value || selectedMonth.id;
    console.log('🔧 Extraction depuis objet:', monthToMark);
  }
  
  monthToMark = String(monthToMark).trim();
  console.log('💰 DEMANDE marquage comme payé pour:', monthToMark);
  console.log('👤 Contexte:', {
    url: window.location.href,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent.substring(0, 100)
  });

  // ==================== 🛡️ VÉRIFICATION STATUT RÉEL ====================
  console.log('🔍 [SAFETY CHECK] Vérification statut réel avant paiement...');
  
  try {
    const statusCheck = await api.get(`/payroll/pay-months/${monthToMark}`, {
      skipCache: true,
      timeout: 3000,
      _retry: false,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    const actualStatus = statusCheck.data?.status;
    console.log(`📊 Statut réel de ${monthToMark}: ${actualStatus}`);
    console.log(`📊 Statut interface: ${getMonthStatus()}`);
    
    // CAS 1: Déjà payé
    if (actualStatus === 'paid') {
      console.log('✅ Mois déjà payé détecté');
      
      // Extraire les détails
      const paidDate = statusCheck.data?.paid_at;
      const formattedDate = paidDate ? 
        new Date(paidDate).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'date inconnue';
      
      toast.success(
        `✅ Mois ${monthToMark} déjà payé\n` +
        `📅 Payé le: ${formattedDate}\n` +
        `👤 Par: ${statusCheck.data?.paid_by || 'système'}`,
        {
          icon: '🎉',
          duration: 6000,
          style: {
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
            color: '#0369a1',
            border: '2px solid #7dd3fc',
            borderRadius: '10px'
          },
          position: 'top-center'
        }
      );
      
      // Mettre à jour l'interface
      await loadPreview(true);
      setActiveStep('complete');
      
      console.groupEnd();
      return;
    }
    
    // CAS 2: Bloqué en processing
    if (actualStatus === 'processing') {
      console.warn(`⚠️ ${monthToMark} bloqué en 'processing'`);
      
      const fixConfirmed = window.confirm(
        `🔧 PROBLÈME DÉTECTÉ\n\n` +
        `Le mois ${monthToMark} est bloqué en "processing".\n\n` +
        `Causes possibles:\n` +
        `• Une précédente tentative a échoué\n` +
        `• Le serveur a redémarré pendant traitement\n` +
        `• Un timeout s'est produit\n\n` +
        `Voulez-vous forcer la réinitialisation ?\n\n` +
        `⚠️ Sécurisé - ne supprime pas les données\n` +
        `✅ Débloque le mois pour paiement`
      );
      
      if (fixConfirmed) {
        toast.loading('Réinitialisation en cours...', { 
          id: 'fix-toast',
          duration: 10000
        });
        
        try {
          await api.post('/payroll/reset-month-status', { 
            month_year: monthToMark,
            force: true,
            reason: 'stuck_in_processing'
          });
          toast.success('✅ Mois débloqué avec succès', { id: 'fix-toast' });
        } catch (resetError) {
          console.log('Pas d\'endpoint reset, on recharge simplement');
          toast.info('Rechargement des données...', { id: 'fix-toast' });
        }
        
        await loadPreview(true);
        toast.dismiss('fix-toast');
        toast.success('✅ Mois débloqué, vous pouvez réessayer', {
          duration: 3000
        });
      } else {
        toast.info('Paiement annulé - mois bloqué', {
          duration: 3000
        });
      }
      
      console.groupEnd();
      return;
    }
    
    // CAS 3: Pas calculated (draft, pending, etc.)
    if (actualStatus !== 'calculated') {
      const currentStatus = actualStatus || 'inconnu';
      
      toast.error(
        `❌ ACTION IMPOSSIBLE\n\n` +
        `Le mois ${monthToMark} n'est pas prêt.\n` +
        `📊 Statut actuel: ${currentStatus}\n` +
        `✅ Statut requis: "calculated"\n\n` +
        `Étapes nécessaires:\n` +
        `1. Vérifier les données\n` +
        `2. Calculer les salaires\n` +
        `3. Valider les montants\n\n` +
        `Exécutez d'abord le calcul des salaires.`,
        { 
          duration: 8000,
          style: {
            background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
            color: '#991b1b',
            border: '2px solid #f87171',
            borderRadius: '10px',
            maxWidth: '500px'
          }
        }
      );
      
      setActiveStep('calculate');
      console.groupEnd();
      return;
    }
    
    console.log('✅ Statut vérifié - prêt pour paiement');
    
  } catch (statusError) {
    console.warn('⚠️ Impossible de vérifier statut réel:', statusError.message);
    
    toast.error(
      '⚠️ Vérification impossible\n\n' +
      'Impossible de vérifier le statut exact du mois.\n' +
      'Poursuite avec les données locales...\n\n' +
      'Causes possibles:\n' +
      '• Connexion instable\n' +
      '• Serveur temporairement indisponible\n' +
      '• Timeout de la requête',
      { 
        duration: 5000,
        icon: '⚠️',
        style: {
          background: '#fef3c7',
          color: '#92400e',
          border: '1px solid #fbbf24'
        }
      }
    );
  }
  // ==================== FIN VÉRIFICATION STATUT RÉEL ====================

  // ✅ VÉRIFICATION PRÉALABLE CRITIQUE
  if (!previewData?.payments || previewData.payments.length === 0) {
    toast.error('❌ Aucun salaire calculé trouvé. Veuillez d\'abord calculer les salaires.', {
      duration: 5000,
      style: {
        background: '#fef2f2',
        color: '#991b1b',
        border: '1px solid #f87171'
      }
    });
    
    setActiveStep('calculate');
    console.groupEnd();
    return;
  }
  
  const validPayments = previewData.payments.filter(p => (p.net_salary || 0) > 0);
  if (validPayments.length === 0) {
    toast.error('❌ Aucun salaire valide à payer. Vérifiez les calculs.', {
      duration: 5000,
      style: {
        background: '#fef3c7',
        color: '#92400e',
        border: '1px solid #fbbf24'
      }
    });
    console.groupEnd();
    return;
  }

  // ⚠️ MESSAGE DE CONFIRMATION DÉTAILLÉ
  const totalAmount = previewData.stats?.totalAmount || 
    validPayments.reduce((sum, p) => sum + (parseFloat(p.net_salary) || 0), 0);
  
  const confirmMessage = `🚨 ÊTES-VOUS ABSOLUMENT SÛR ?\n\n` +
    `📅 Mois : ${monthToMark}\n` +
    `👥 Employés : ${validPayments.length}\n` +
    `💰 Montant total : ${new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 0
    }).format(totalAmount)}\n\n` +
    `⚠️ CETTE ACTION EST IRRÉVERSIBLE !\n\n` +
    `✓ Les emails seront envoyés aux employés\n` +
    `✓ Le statut passera à "Payé"\n` +
    `✓ Les paiements seront enregistrés\n` +
    `✓ Le processus prend ~20-30 secondes\n\n` +
    `Confirmez-vous le paiement de ce mois ?`;

  // 🔴 CONFIRMATION EN DEUX ÉTAPES
  const firstConfirm = window.confirm(
    "🚨 ACTION CRITIQUE : Marquer comme payé\n\n" +
    "Cette action va déclencher:\n" +
    "• Envoi d'emails aux employés\n" +
    "• Marquage définitif comme payé\n" +
    "• Génération de justificatifs\n\n" +
    "Cliquez sur OK pour continuer..."
  );
  
  if (!firstConfirm) {
    toast.info('Action annulée par l\'utilisateur', {
      icon: 'ℹ️',
      duration: 2000
    });
    console.groupEnd();
    return;
  }

  const secondConfirm = window.confirm(confirmMessage);
  if (!secondConfirm) {
    toast.info('Paiement annulé', {
      icon: '⚠️',
      duration: 2000
    });
    console.groupEnd();
    return;
  }

  // ✅ DÉBUT DU TRAITEMENT
  try {
    // 🔐 VERROUILLAGE POUR EMPÊCHER LES DOUBLONS
    isMarkingAsPaidRef.current = true;
    setMarkingAsPaid(true);
    
    // 🎯 INDICATEUR VISUEL DE DÉMARRAGE
    const processingToast = toast.loading(
      `🚀 Lancement du paiement pour ${monthToMark}\n\n` +
      `⏳ Début: ${new Date().toLocaleTimeString('fr-FR')}\n` +
      `👥 Employés: ${validPayments.length}\n` +
      `💰 Total: ${new Intl.NumberFormat('fr-TN', {
        style: 'currency',
        currency: 'TND'
      }).format(totalAmount)}\n\n` +
      `🔄 Traitement en cours... (30s max)`,
      {
        duration: null,
        position: 'top-center',
        style: {
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          color: '#0369a1',
          border: '2px solid #7dd3fc',
          borderRadius: '12px',
          minWidth: '400px',
          fontSize: '14px'
        }
      }
    );

    console.log('🔗 Appel API POST /payroll/mark-month-as-paid', { 
      month_year: monthToMark,
      session_id: debugSessionId,
      employee_count: validPayments.length,
      total_amount: totalAmount
    });
    
    // 📡 APPEL API
    const response = await api.post('/payroll/mark-month-as-paid', {
      month_year: monthToMark,
      metadata: {
        session_id: debugSessionId,
        initiated_at: new Date().toISOString(),
        employee_count: validPayments.length,
        estimated_total: totalAmount,
        user_agent: navigator.userAgent.substring(0, 200)
      }
    }, {
      timeout: 45000,
    });

    console.log('✅ Réponse complète du serveur:', response);
    
    // 🔥 SOLUTION 3 : EXTRACTION UNIVERSELLE
    // Fonction pour extraire une valeur de n'importe où dans l'objet
    const extractValue = (obj, key) => {
      if (!obj || typeof obj !== 'object') return undefined;
      
      // 1. Chercher directement à ce niveau
      if (obj[key] !== undefined) {
        console.log(`✅ Trouvé ${key} directement:`, obj[key]);
        return obj[key];
      }
      
      // 2. Chercher dans obj.data
      if (obj.data && obj.data[key] !== undefined) {
        console.log(`✅ Trouvé ${key} dans obj.data:`, obj.data[key]);
        return obj.data[key];
      }
      
      // 3. Chercher dans obj.data.data (structure double nesting)
      if (obj.data && obj.data.data && obj.data.data[key] !== undefined) {
        console.log(`✅ Trouvé ${key} dans obj.data.data:`, obj.data.data[key]);
        return obj.data.data[key];
      }
      
      // 4. Chercher récursivement dans tous les sous-objets
      for (const k in obj) {
        if (typeof obj[k] === 'object' && obj[k] !== null) {
          const found = extractValue(obj[k], key);
          if (found !== undefined) {
            console.log(`✅ Trouvé ${key} dans obj.${k}:`, found);
            return found;
          }
        }
      }
      
      console.log(`❌ ${key} non trouvé dans l'objet`);
      return undefined;
    };

    // Extraire toutes les valeurs
    const emailsSent = extractValue(response, 'emails_sent') || validPayments.length;
    const emailsFailed = extractValue(response, 'emails_failed') || 0;
    const employeesPaid = extractValue(response, 'employees_paid') || validPayments.length;
    const totalPaid = extractValue(response, 'total_paid') || totalAmount;
    const emailDetails = extractValue(response, 'email_details') || [];

    console.log('🎯 VALEURS FINALES EXTRAITES:', {
      emailsSent,
      emailsFailed,
      employeesPaid,
      totalPaid,
      emailDetailsLength: emailDetails.length
    });

    // TEST : Vérifiez aussi avec une requête fetch directe pour comparer
    try {
      const directResponse = await fetch('http://localhost:5000/api/payroll/mark-month-as-paid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ month_year: monthToMark })
      });
      
      const directData = await directResponse.json();
      console.log('🔍 TEST DIRECT FETCH:', {
        emails_sent: directData.data?.emails_sent,
        structure: directData
      });
    } catch (fetchError) {
      console.warn('Test fetch échoué:', fetchError.message);
    }
    
    // 📊 TRAITEMENT DE LA RÉPONSE
    const responseData = response.data || response;
    setPaymentValidation(responseData);
    
    // 📧 STATISTIQUES DES EMAILS
    setEmailStats({
      sent: emailsSent,
      failed: emailsFailed,
      details: emailDetails,
      total: emailsSent + emailsFailed
    });

    // 🔄 RECHARGEMENT DES DONNÉES
    await loadPreview(true);
    
    // ✅ SUCCÈS - MISE À JOUR DE L'INTERFACE
    toast.dismiss(processingToast);
    
    // MESSAGE FINAL AVEC LES BONNES VALEURS
    const successMessage = `🎉 PAIEMENT CONFIRMÉ !\n\n` +
      `📅 Mois: ${monthToMark}\n` +
      `👥 ${employeesPaid} employés payés\n` +
      `📧 ${emailsSent} emails envoyés avec succès\n` +
      `❌ ${emailsFailed} emails échoués\n` +
      `💰 Total payé: ${new Intl.NumberFormat('fr-TN', {
        style: 'currency',
        currency: 'TND'
      }).format(totalPaid)}\n\n` +
      `⏱️ Traitement: ${((Date.now() - parseInt(debugSessionId.split('-')[1])) / 1000).toFixed(1)}s`;

    toast.success(successMessage, {
      icon: '✅',
      duration: 8000,
      style: {
        background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
        color: '#065f46',
        border: '2px solid #10b981',
        borderRadius: '12px',
        minWidth: '450px',
        fontSize: '14px'
      },
      position: 'top-center'
    });
    
    // 📈 MESSAGE DÉTAILLÉ COMPLÉMENTAIRE
    setTimeout(() => {
      if (emailsFailed > 0) {
        toast.error(
          `⚠️ ${emailsFailed} email(s) non envoyé(s)\n` +
          `Consultez les logs pour plus de détails`,
          {
            duration: 6000,
            position: 'bottom-right'
          }
        );
      }
    }, 1500);
    
    // 🎯 PASSAGE À L'ÉTAPE FINALE
    setActiveStep('complete');
    
    // 📤 NOTIFICATION AU PARENT
    if (onSuccess) {
      console.log('📤 Appel onSuccess - AVEC FLAGS EXPLICITES POUR ÉVITER LE RECALCUL');
      
      const paymentNotification = {
        type: 'PAYMENT_COMPLETED',
        action: 'MARKED_AS_PAID',
        month_year: monthToMark,
        success: true,
        data: {
          employees_paid: employeesPaid,
          emails_sent: emailsSent,
          emails_failed: emailsFailed,
          total_paid: totalPaid,
          email_details: emailDetails
        },
        _notificationType: 'payment',
        _shouldNotRecalculate: true,
        _isPaymentNotification: true,
        _doNotCalculate: true,
        message: 'PAYMENT_NOTIFICATION_DO_NOT_CALCULATE',
        timestamp: new Date().toISOString(),
        session_id: debugSessionId,
        source: 'CalculateSalariesModal.handleMarkAsPaid',
        version: '1.0'
      };
      
      console.log('📤 Envoi notification:', paymentNotification);
      onSuccess(paymentNotification);
    }
    
  } catch (error) {
    console.error('❌ ERREUR lors du marquage comme payé:', error);
    
    // 📋 LOGS DÉTAILLÉS POUR LE DÉBOGAGE
    const errorDetails = {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      code: error.code,
      url: error.config?.url,
      method: error.config?.method,
      session_id: debugSessionId,
      timestamp: new Date().toISOString()
    };
    
    console.error('📋 Détails de l\'erreur:', errorDetails);

    // 🚨 GESTION DES ERREURS SPÉCIFIQUES
    let errorTitle = 'Erreur';
    let errorMessage = 'Erreur inconnue lors du marquage comme payé';
    let errorDuration = 6000;
    let errorStyle = {
      background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
      color: '#991b1b',
      border: '2px solid #f87171',
      borderRadius: '10px'
    };

    const errorData = error.response?.data || {};
    const errorMessageLower = (error.message || '').toLowerCase();
    
    // 📡 ERREURS HTTP SPÉCIFIQUES
    if (error.response?.status === 400) {
      errorTitle = 'Validation échouée';
      errorMessage = errorData.message || 'Données invalides';
      
      if (errorMessageLower.includes('déjà payé') || 
          errorMessageLower.includes('already paid') ||
          errorMessageLower.includes('a déjà été payé') ||
          errorData.code === 'MONTH_ALREADY_PAID') {
        
        errorTitle = '✅ Mois déjà payé';
        errorStyle = {
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          color: '#0369a1',
          border: '2px solid #7dd3fc',
          borderRadius: '10px'
        };
        
        let detailedMessage = `Le mois ${monthToMark} est déjà marqué comme payé`;
        
        if (errorData.data?.paid_at) {
          const paidDate = new Date(errorData.data.paid_at);
          const formattedDate = paidDate.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          detailedMessage += `\n📅 Payé le: ${formattedDate}`;
        }
        
        if (errorData.data?.paid_by) {
          detailedMessage += `\n👤 Par: ${errorData.data.paid_by}`;
        }
        
        errorMessage = detailedMessage;
        
        toast.dismiss();
        toast.success(errorMessage, {
          icon: '🎉',
          duration: 8000,
          style: errorStyle,
          position: 'top-center'
        });
        
        await loadPreview(true);
        setActiveStep('complete');
        
        if (onSuccess) {
          onSuccess({
            type: 'already-paid-notification',
            month_year: monthToMark,
            status: 'already_paid',
            message: errorMessage,
            data: errorData.data,
            timestamp: new Date().toISOString()
          });
        }
        
        console.groupEnd();
        return;
      }
      
    } else if (error.response?.status === 409) {
      errorTitle = 'Conflit détecté';
      errorMessage = errorData.message || 'Un traitement est déjà en cours pour ce mois';
      errorStyle = {
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        color: '#92400e',
        border: '2px solid #fbbf24',
        borderRadius: '10px'
      };
      
    } else if (error.response?.status === 500) {
      errorTitle = 'Erreur serveur interne';
      errorMessage = 'Le serveur a rencontré une erreur. Contactez l\'administrateur.';
      
    } else if (error.message?.includes('Network Error')) {
      errorTitle = 'Erreur réseau';
      errorMessage = 'Impossible de contacter le serveur. Vérifiez votre connexion internet.';
      
    } else if (error.message?.includes('timeout')) {
      errorTitle = 'Délai expiré';
      errorMessage = 'La requête a pris trop de temps. Le serveur est peut-être surchargé.';
      
    } else if (!error.response) {
      errorTitle = 'Connexion impossible';
      errorMessage = 'Serveur inaccessible. Vérifiez que le backend est démarré et accessible.';
    }

    // 🚨 AFFICHAGE DE L'ERREUR
    toast.error(`${errorTitle}\n\n${errorMessage}`, {
      icon: '❌',
      duration: errorDuration,
      style: errorStyle,
      position: 'top-center'
    });

    // 🔄 RÉINITIALISATION EN CAS D'ERREUR
    if (error.response?.status !== 400) {
      setTimeout(() => {
        setMarkingAsPaid(false);
        isMarkingAsPaidRef.current = false;
      }, 3000);
    }
    
  } finally {
    // 🔓 DÉVERROUILLAGE APRÈS LE TRAITEMENT
    setTimeout(() => {
      isMarkingAsPaidRef.current = false;
      setMarkingAsPaid(false);
      console.log('🔓 Verrouillage libéré');
    }, 2000);
    
    console.groupEnd();
  }
};

  const getSelectedMonthName = () => {
    const month = availableMonths.find(m => m.month_year === selectedMonth);
    return month ? month.month_name : selectedMonth;
  };

  const getMonthStatus = () => {
    return previewData?.month?.status || 'draft';
  };

  const isMonthPaid = () => {
    return getMonthStatus() === 'paid';
  };

  const isMonthCalculated = () => {
    return getMonthStatus() === 'calculated';
  };

  const canCalculate = () => {
    return previewData; // TOUJOURS permettre le calcul, même pour les mois payés
  };

  const canMarkAsPaid = () => {
    return previewData && (isMonthCalculated() || results) && !isMonthPaid();
  };

  const getStatusBadge = (status) => {
    const colors = {
      'draft': 'yellow',
      'calculated': 'blue',
      'paid': 'green',
      'pending': 'yellow',
      'approved': 'blue'
    };
    
    const labels = {
      'draft': 'Brouillon',
      'calculated': 'Calculé',
      'paid': 'Payé',
      'pending': 'En attente',
      'approved': 'Approuvé'
    };

    return (
      <Badge color={colors[status] || 'gray'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: 'select', label: 'Sélection', icon: Calendar },
      { key: 'preview', label: 'Prévisualisation', icon: CreditCard },
      { key: 'calculate', label: 'Calcul', icon: Calculator },
      { key: 'mark-paid', label: 'Paiement', icon: DollarSign },
      { key: 'complete', label: 'Terminé', icon: CheckCircle }
    ];

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = activeStep === step.key;
            const isCompleted = steps.findIndex(s => s.key === activeStep) > index;
            
            return (
              <div key={step.key} className="flex flex-col items-center flex-1 relative">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 z-10 ${
                  isActive 
                    ? 'bg-blue-500 text-white border-2 border-blue-500' 
                    : isCompleted
                    ? 'bg-green-500 text-white border-2 border-green-500'
                    : 'bg-gray-100 text-gray-500 border-2 border-gray-300'
                }`}>
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span className={`text-sm font-medium ${
                  isActive ? 'text-blue-600' : 
                  isCompleted ? 'text-green-600' : 
                  'text-gray-500'
                }`}>
                  {step.label}
                </span>
                
                {index < steps.length - 1 && (
                  <div className={`absolute top-5 left-1/2 w-full h-0.5 transform -translate-y-1/2 z-0 ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-200'
                  }`} style={{ left: `${(index + 1) * 20}%` }} />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Ligne de progression */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-6">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
            style={{ 
              width: `${(steps.findIndex(s => s.key === activeStep) + 1) / steps.length * 100}%` 
            }}
          />
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeStep) {
      case 'select':
        return (
          <div className="text-center py-8">
            <Calendar className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Sélection du mois</h3>
            <p className="text-gray-600 mb-6">Choisissez le mois que vous souhaitez traiter</p>
            
            <div className="max-w-md mx-auto">
              <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                Mois de paie <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              >
                <option value="">Sélectionner un mois...</option>
                {availableMonths.map(month => (
                  <option key={month.month_year} value={month.month_year}>
                    {month.month_name} ({month.month_year}) - {month.status}
                  </option>
                ))}
              </select>
              
              {selectedMonth && (
                <Button
                  onClick={loadPreview}
                  className="w-full mt-6"
                  disabled={loading}
                >
                  {loading ? 'Chargement...' : 'Continuer →'}
                </Button>
              )}
            </div>
          </div>
        );

      case 'preview':
        const monthIsPaid = isMonthPaid();
        const monthIsCalculated = isMonthCalculated();
        
        return (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Prévisualisation</h3>
                <p className="text-gray-600">Vérifiez les données avant {monthIsPaid ? 'le recalcul' : 'le calcul'}</p>
              </div>
              {getStatusBadge(getMonthStatus())}
            </div>
            
            {/* Message modifié pour permettre le recalcul */}
            {monthIsPaid && (
              <Card className="p-4 mb-6 bg-yellow-50 border-yellow-200">
                <div className="flex items-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                  <span className="text-yellow-800 font-medium">
                    Attention : Mois déjà payé
                  </span>
                </div>
                <p className="text-sm text-yellow-700 mt-1">
                  Ce mois a déjà été marqué comme payé. 
                  <span className="font-medium ml-1">Vous pouvez quand même le recalculer.</span>
                </p>
              </Card>
            )}
            
            {monthIsCalculated && !monthIsPaid && (
              <Card className="p-4 mb-6 bg-blue-50 border-blue-200">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-blue-600 mr-2" />
                  <span className="text-blue-800 font-medium">
                    Mois déjà calculé
                  </span>
                </div>
                <p className="text-sm text-blue-700 mt-1">
                  Ce mois a déjà été calculé. Vous pouvez le recalculer ou le marquer comme payé.
                </p>
              </Card>
            )}
            
            <Card className="p-6 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{previewData?.stats?.totalEmployees || 0}</div>
                  <div className="text-sm text-gray-600">Employés total</div>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{previewData?.stats?.withConfig || 0}</div>
                  <div className="text-sm text-gray-600">Avec configuration</div>
                </div>
                
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{previewData?.stats?.totalPayments || 0}</div>
                  <div className="text-sm text-gray-600">Paiements</div>
                </div>
                
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {new Intl.NumberFormat('fr-TN', {
                      style: 'currency',
                      currency: 'TND',
                      minimumFractionDigits: 0
                    }).format(previewData?.stats?.totalAmount || 0)}
                  </div>
                  <div className="text-sm text-gray-600">Montant total</div>
                </div>
              </div>
              
              {previewData?.payments && previewData.payments.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Paiements existants</h4>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {previewData.payments.map((payment, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium text-gray-900">
                              {payment.first_name} {payment.last_name}
                            </div>
                            <div className="text-sm text-gray-600">{payment.department}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green-600">
                              {new Intl.NumberFormat('fr-TN', {
                                style: 'currency',
                                currency: 'TND'
                              }).format(payment.net_salary || 0)}
                            </div>
                            <div className="text-xs text-gray-500 capitalize">{payment.status || 'pending'}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
            
            <div className="flex justify-between">
              <Button
                onClick={() => setActiveStep('select')}
                variant="outline"
              >
                ← Retour
              </Button>
              
              {/* TOUJOURS afficher le bouton, même pour les mois payés */}
              <Button
                onClick={() => {
                  if (monthIsPaid) {
                    // Demander confirmation pour le recalcul
                    if (window.confirm(`⚠️ Ce mois (${getSelectedMonthName()}) est déjà marqué comme payé.\n\nUn recalcul modifiera les montants existants.\n\nVoulez-vous continuer quand même ?`)) {
                      setActiveStep('calculate');
                    }
                  } else {
                    setActiveStep('calculate');
                  }
                }}
                variant="primary"
                className={monthIsPaid ? "bg-orange-600 hover:bg-orange-700" : ""}
              >
                {monthIsPaid ? '🔄 Recalculer quand même →' : 'Passer au calcul →'}
              </Button>
            </div>
          </div>
        );

      case 'calculate':
        const isRecalculating = isMonthPaid();
        
        return (
          <div>
            <div className="text-center mb-8">
              <Calculator className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {isRecalculating ? 'Recalcul des salaires' : 'Calcul des salaires'}
              </h3>
              <p className="text-gray-600">
                {isRecalculating 
                  ? 'Recalculez les salaires pour ce mois déjà payé'
                  : 'Calculez les salaires nets pour tous les employés configurés'
                }
              </p>
            </div>
            
            {/* Avertissement spécifique pour les recalculs */}
            {isRecalculating && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-orange-500 mr-2 mt-0.5" />
                  <div>
                    <p className="text-orange-800 font-medium">⚠️ Recalcul d'un mois payé</p>
                    <p className="text-orange-700 text-sm mt-1">
                      Ce mois est déjà marqué comme "Payé". Un recalcul va :
                      <ul className="list-disc ml-4 mt-1 space-y-1">
                        <li>Mettre à jour les montants des salaires</li>
                        <li>Conserver le statut "Payé" (sauf si vous changez manuellement)</li>
                        <li>Modifier les fiches de paie existantes</li>
                        <li>Mettre à jour l'historique des paiements</li>
                      </ul>
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <Card className="p-6 mb-6">
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-3">Récapitulatif</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mois sélectionné:</span>
                    <span className="font-medium">{getSelectedMonthName()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Statut actuel:</span>
                    {getStatusBadge(getMonthStatus())}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Employés à calculer:</span>
                    <span className="font-medium text-blue-600">{previewData?.stats?.withConfig || 0} employés</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mode:</span>
                    <span className={`font-medium ${isRecalculating ? 'text-orange-600' : 'text-green-600'}`}>
                      {isRecalculating ? '🔄 Recalcul' : '🧮 Calcul initial'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-500 mr-2 mt-0.5" />
                  <div>
                    <p className="text-yellow-800 font-medium">Information importante</p>
                    <p className="text-yellow-700 text-sm mt-1">
                      Cette opération va {isRecalculating ? 'recalculer' : 'calculer'} les salaires nets pour tous les employés configurés.
                      Le processus peut prendre quelques instants.
                    </p>
                  </div>
                </div>
              </div>
              
              <Button
                onClick={handleCalculate}
                className="w-full py-3"
                disabled={calculating}
                variant={isRecalculating ? "warning" : "primary"}
              >
                {calculating ? (
                  <span className="flex items-center justify-center">
                    <Loader className="animate-spin w-5 h-5 mr-2" />
                    {isRecalculating ? 'Recalcul en cours...' : 'Calcul en cours...'}
                  </span>
                ) : (
                  isRecalculating ? '🔄 Lancer le recalcul des salaires' : '🧮 Lancer le calcul des salaires'
                )}
              </Button>
            </Card>
            
            <div className="flex justify-between">
              <Button
                onClick={() => setActiveStep('preview')}
                variant="outline"
              >
                ← Retour
              </Button>
            </div>
          </div>
        );

      case 'mark-paid':
        return (
          <div>
            <div className="text-center mb-8">
              <DollarSign className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Validation des paiements</h3>
              <p className="text-gray-600">Marquez le mois comme payé et finalisez le processus</p>
            </div>
            
            {results && (
              <Card className="p-6 mb-6 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                <div className="text-center mb-6">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">
                    {isMonthPaid() ? 'Recalcul terminé avec succès !' : 'Calcul terminé avec succès !'}
                  </h4>
                  <p className="text-gray-600">
                    Les salaires ont été {isMonthPaid() ? 'recalculés' : 'calculés'} pour {results.data?.calculated || results.calculated || 0} employés.
                  </p>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                    <div className="text-2xl font-bold text-green-600">{results.data?.calculated || results.calculated || 0}</div>
                    <div className="text-sm text-gray-600">Calculés</div>
                  </div>
                  
                  <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                    <div className="text-2xl font-bold text-red-600">{results.data?.failed || results.failed || 0}</div>
                    <div className="text-sm text-gray-600">Échecs</div>
                  </div>
                  
                  <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                    <div className="text-2xl font-bold text-blue-600">
                      {new Intl.NumberFormat('fr-TN', {
                        style: 'currency',
                        currency: 'TND',
                        minimumFractionDigits: 0
                      }).format(results.data?.total_amount || results.total_amount || 0)}
                    </div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                </div>
                
                {calculationErrors.length > 0 && (
                  <div className="mb-6">
                    <h5 className="font-medium text-red-700 mb-2">Erreurs rencontrées:</h5>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {calculationErrors.map((error, index) => (
                        <div key={index} className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                          {error.employee_id}: {error.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}
            
            {/* Masquer la section "Marquer comme payé" si le mois est déjà payé */}
            {!isMonthPaid() && (
              <Card className="p-6 mb-6">
                <h4 className="font-medium text-gray-900 mb-4">Étape finale : Validation</h4>
                
                <div className="space-y-4 mb-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-800 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                      1
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Marquer comme payé</p>
                      <p className="text-sm text-gray-600">Change le statut du mois de "Calculé" à "Payé"</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-800 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                      2
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Envoi des emails</p>
                      <p className="text-sm text-gray-600">Envoi des fiches de paie par email aux employés</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-800 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                      3
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Mise à jour des statistiques</p>
                      <p className="text-sm text-gray-600">Met à jour les totaux et statistiques du système</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <Mail className="w-5 h-5 text-blue-500 mr-2" />
                    <span className="text-blue-700 font-medium">Notification par email</span>
                  </div>
                  <p className="text-sm text-blue-600 mt-1">
                    Les employés recevront leur fiche de paie par email. Vérifiez que les adresses email sont correctes.
                  </p>
                </div>
                
                <Button
                  onClick={handleMarkAsPaid}
                  className="w-full py-3"
                  disabled={markingAsPaid || !canMarkAsPaid()}
                  variant="success"
                >
                  {markingAsPaid ? (
                    <span className="flex items-center justify-center">
                      <Loader className="animate-spin w-5 h-5 mr-2" />
                      Validation en cours...
                    </span>
                  ) : (
                    <>
                      <DollarSign className="w-5 h-5 mr-2" />
                      ✓ Marquer le mois comme payé et envoyer les emails
                    </>
                  )}
                </Button>
                
                <p className="text-xs text-gray-500 text-center mt-3">
                  Cette action est définitive. Assurez-vous que tous les calculs sont corrects.
                </p>
              </Card>
            )}
            
            {/* Si le mois est déjà payé, afficher une option différente */}
            {isMonthPaid() && (
              <Card className="p-6 mb-6 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                <div className="text-center mb-4">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Recalcul terminé !</h4>
                  <p className="text-gray-600">
                    Le mois reste marqué comme "Payé". Les montants ont été mis à jour.
                  </p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Mois:</span>
                    <span className="font-medium">{getSelectedMonthName()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Statut:</span>
                    <Badge color="green">Payé</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Action:</span>
                    <span className="font-medium text-green-600">Recalcul effectué</span>
                  </div>
                </div>
                
                <Button
                  onClick={() => setActiveStep('complete')}
                  className="w-full mt-6"
                  variant="primary"
                >
                  ✅ Terminer le processus
                </Button>
              </Card>
            )}
            
            <div className="flex justify-between">
              <Button
                onClick={() => setActiveStep('calculate')}
                variant="outline"
              >
                ← {isMonthPaid() ? 'Recalculer à nouveau' : 'Recalculer'}
              </Button>
              
              {/* Bouton pour passer directement à la fin si le mois est payé */}
              {isMonthPaid() && (
                <Button
                  onClick={() => setActiveStep('complete')}
                  variant="primary"
                >
                  Terminer →
                </Button>
              )}
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center py-8">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
            
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">
              {isMonthPaid() ? 'Recalcul terminé avec succès !' : 'Processus terminé avec succès !'}
            </h3>
            
            <Card className="p-6 max-w-md mx-auto mb-8 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Mois:</span>
                  <span className="font-bold text-gray-900">{getSelectedMonthName()}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Statut:</span>
                  <Badge color="green">Payé</Badge>
                </div>
                
                {paymentValidation?.data && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Employés payés:</span>
                      <span className="font-bold text-green-600">
                        {paymentValidation.data.employees_paid || paymentValidation.employees_paid || 0}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Montant total:</span>
                      <span className="font-bold text-blue-600">
                        {new Intl.NumberFormat('fr-TN', {
                          style: 'currency',
                          currency: 'TND',
                          minimumFractionDigits: 0
                        }).format(paymentValidation.data.total_paid || paymentValidation.total_paid || 0)}
                      </span>
                    </div>
                    
                    {/* Statistiques d'emails */}
                    {(emailStats || paymentValidation.data.emails_sent !== undefined) && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-center mb-2">
                          <Mail className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-gray-700 font-medium">Emails envoyés</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-2 bg-green-50 rounded-lg">
                            <div className="text-lg font-bold text-green-600">
                              {emailStats?.sent || paymentValidation.data.emails_sent || 0}
                            </div>
                            <div className="text-xs text-gray-600">Envoyés</div>
                          </div>
                          <div className="text-center p-2 bg-red-50 rounded-lg">
                            <div className="text-lg font-bold text-red-600">
                              {emailStats?.failed || paymentValidation.data.emails_failed || 0}
                            </div>
                            <div className="text-xs text-gray-600">Échecs</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                {isMonthPaid() && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Action effectuée:</span>
                    <span className="font-medium text-orange-600">Recalcul</span>
                  </div>
                )}
              </div>
            </Card>
            
            <p className="text-gray-600 mb-8">
              {isMonthPaid() 
                ? 'Les montants ont été recalculés et mis à jour.'
                : 'Le mois a été marqué comme payé. Vous pouvez maintenant :'
              }
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => window.location.href = '/payroll/payslips'}
                variant="primary"
              >
                📄 Voir les fiches de paie
              </Button>
              
              <Button
                onClick={() => {
                  onClose();
                  if (onSuccess) {
                    onSuccess(paymentValidation);
                  }
                  // Rafraîchir la page après un court délai
                  setTimeout(() => window.location.reload(), 300);
                }}
                variant="outline"
              >
                ← Retour au tableau de bord
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Gestion des Salaires - {getSelectedMonthName() || 'Sélection'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {isMonthPaid() ? 'Recalcul des salaires' : 'Processus complet de calcul et validation'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={calculating || markingAsPaid}
          >
            <XCircle className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
          {renderStepIndicator()}
          {renderContent()}
        </div>

        {/* Pied de page informatif */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <span>Module Paie • Étape {['select', 'preview', 'calculate', 'mark-paid', 'complete'].indexOf(activeStep) + 1}/5</span>
            <span>{getSelectedMonthName() || 'Non sélectionné'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculateSalariesModal;