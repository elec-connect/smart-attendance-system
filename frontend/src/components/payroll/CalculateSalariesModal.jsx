// src/components/payroll/CalculateSalariesModal.jsx - VERSION AVEC ENVOI EMAILS APRÈS CALCUL
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
  const [sendingEmails, setSendingEmails] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(monthYear || '');
  const [availableMonths, setAvailableMonths] = useState([]);
  const [results, setResults] = useState(null);
  const [emailResults, setEmailResults] = useState(null);
  const [paymentValidation, setPaymentValidation] = useState(null);
  const [activeStep, setActiveStep] = useState('select');
  const [calculationErrors, setCalculationErrors] = useState([]);
  
  const isCalculatingRef = useRef(false);
  const isSendingEmailsRef = useRef(false);

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
    setEmailResults(null);
    setPaymentValidation(null);
    setCalculationErrors([]);
    setActiveStep('select');
    isCalculatingRef.current = false;
    isSendingEmailsRef.current = false;
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
      
      const monthForRequest = String(selectedMonth).trim();
      
      const monthResponse = await api.get(`/payroll/pay-months/${monthForRequest}`);
      const employeesResponse = await api.get('/payroll/employees');
      const paymentsResponse = await api.get(`/payroll/payments/${monthForRequest}`);
      
      let monthData = null;
      if (monthResponse && monthResponse.success) {
        monthData = monthResponse.data || monthResponse.data?.data;
      }
      
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

  // ==================== FONCTION D'ENVOI DES EMAILS ====================
  const sendPayslipEmails = async () => {
    if (!selectedMonth || sendingEmails || isSendingEmailsRef.current) {
      console.log('⏸️ Envoi emails déjà en cours, skip...');
      return false;
    }

    try {
      isSendingEmailsRef.current = true;
      setSendingEmails(true);
      
      const toastId = toast.loading(
        `📧 Envoi des fiches de paie par email pour ${getSelectedMonthName()}...\n` +
        `⏳ Cette opération peut prendre quelques instants`,
        { duration: null, position: 'top-center' }
      );
      
      console.log('📧 Début envoi emails pour:', selectedMonth);
      
      // Appel à l'API d'envoi d'emails
      const response = await api.post('/payroll/payslip/send-bulk', {
        month_year: selectedMonth,
        send_to_all: true
      }, {
        timeout: 30000 // 30 secondes timeout
      });
      
      console.log('✅ Réponse envoi emails:', response);
      
      const data = response.data || response;
      
      const sentCount = data.sent || data.emails_sent || 0;
      const failedCount = data.failed || data.emails_failed || 0;
      const totalCount = data.total || (sentCount + failedCount) || 0;
      
      setEmailResults({
        sent: sentCount,
        failed: failedCount,
        total: totalCount,
        details: data.details || []
      });
      
      toast.dismiss(toastId);
      
      if (failedCount === 0) {
        toast.success(
          `📧 Tous les emails ont été envoyés avec succès !\n` +
          `✅ ${sentCount} fiche(s) de paie envoyée(s)`,
          { duration: 5000 }
        );
      } else {
        toast.success(
          `📧 Envoi des emails terminé\n` +
          `✅ ${sentCount} envoyés\n` +
          `❌ ${failedCount} échecs`,
          { duration: 5000 }
        );
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Erreur envoi emails:', error);
      
      const errorMessage = error.response?.data?.message || error.message;
      
      toast.error(
        `❌ Erreur lors de l'envoi des emails\n` +
        `${errorMessage}`,
        { duration: 5000 }
      );
      
      return false;
      
    } finally {
      isSendingEmailsRef.current = false;
      setSendingEmails(false);
    }
  };

  // ==================== FONCTION DE CALCUL ====================
  const handleCalculate = async () => {
    if (isCalculatingRef.current || calculating) {
      console.log('⏸️ Calcul déjà en cours, skip...');
      return;
    }

    if (!selectedMonth) {
      toast.error('Veuillez sélectionner un mois');
      return;
    }

    let monthYearToCalculate = selectedMonth;
    if (typeof selectedMonth === 'object' && selectedMonth !== null) {
      monthYearToCalculate = selectedMonth.month_year || selectedMonth.value || selectedMonth.id;
    }
    
    monthYearToCalculate = String(monthYearToCalculate).trim();
    
    if (!monthYearToCalculate || monthYearToCalculate === 'undefined' || monthYearToCalculate === 'null') {
      toast.error('Mois invalide sélectionné');
      return;
    }

    console.log('📤 Envoi calcul pour:', monthYearToCalculate);

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
      
      const resultData = response.data || response;
      setResults(resultData);
      
      if (resultData.data?.errors && Array.isArray(resultData.data.errors)) {
        setCalculationErrors(resultData.data.errors);
      }
      
      await loadPreview();
      
      toast.success(isMonthPaid() ? '✅ Recalcul terminé avec succès !' : '✅ Calcul terminé avec succès !', {
        duration: 4000,
        icon: '🎉'
      });
      
      // ===== DEMANDE D'ENVOI DES EMAILS =====
      const shouldSendEmails = window.confirm(
        `📧 Voulez-vous envoyer les fiches de paie par email maintenant ?\n\n` +
        `• Les employés recevront leur fiche dans leur boîte mail\n` +
        `• Cette opération peut prendre quelques instants\n` +
        `• Vous pourrez aussi le faire plus tard depuis cette fenêtre\n\n` +
        `Cliquez sur OK pour envoyer maintenant, ou Annuler pour plus tard.`
      );
      
      if (shouldSendEmails) {
        const emailsSent = await sendPayslipEmails();
        if (emailsSent) {
          setActiveStep('complete');
        } else {
          // En cas d'erreur, on demande quoi faire
          const continueAnyway = window.confirm(
            `⚠️ L'envoi des emails a rencontré des problèmes.\n\n` +
            `Voulez-vous quand même terminer le processus ?\n\n` +
            `Vous pourrez réessayer plus tard.`
          );
          if (continueAnyway) {
            setActiveStep('complete');
          }
        }
      } else {
        // L'utilisateur ne veut pas envoyer maintenant
        setActiveStep('complete');
      }
      
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
      
      if (error.response?.data?.calculated && error.response.data.calculated > 0) {
        // Même en cas d'erreur partielle, proposer les emails
        const shouldSendEmails = window.confirm(
          `⚠️ Le calcul a partiellement réussi.\n\n` +
          `Voulez-vous envoyer les fiches de paie pour les employés déjà calculés ?`
        );
        
        if (shouldSendEmails) {
          await sendPayslipEmails();
        }
        setActiveStep('complete');
      }
      
    } finally {
      isCalculatingRef.current = false;
      setCalculating(false);
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
                  Ce mois a déjà été calculé. Vous pouvez le recalculer.
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
              
              <Button
                onClick={() => {
                  if (monthIsPaid) {
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
                        <li>Conserver le statut "Payé"</li>
                        <li>Modifier les fiches de paie existantes</li>
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
                  <span className="text-gray-600">Employés calculés:</span>
                  <span className="font-bold text-blue-600">
                    {results?.data?.calculated || results?.calculated || previewData?.stats?.withConfig || 0}
                  </span>
                </div>
                
                {/* AFFICHAGE DES RÉSULTATS DES EMAILS */}
                {emailResults && (
                  <>
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-center mb-3">
                        <Mail className="w-5 h-5 text-green-500 mr-2" />
                        <span className="text-gray-700 font-medium">Résultat des emails</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-xl font-bold text-green-600">
                            {emailResults.sent}
                          </div>
                          <div className="text-xs text-gray-600">Envoyés</div>
                        </div>
                        
                        <div className="text-center p-3 bg-red-50 rounded-lg">
                          <div className="text-xl font-bold text-red-600">
                            {emailResults.failed}
                          </div>
                          <div className="text-xs text-gray-600">Échecs</div>
                        </div>
                      </div>
                      
                      {emailResults.failed > 0 && (
                        <div className="mt-3 text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
                          ⚠️ {emailResults.failed} email(s) non envoyés
                        </div>
                      )}
                    </div>
                  </>
                )}
                
                {/* BOUTON POUR ENVOYER LES EMAILS SI PAS ENCORE FAIT OU ÉCHEC */}
                {(!emailResults || emailResults.failed > 0) && (
                  <div className="mt-4">
                    <Button
                      onClick={sendPayslipEmails}
                      disabled={sendingEmails}
                      variant="outline"
                      className="w-full"
                    >
                      {sendingEmails ? (
                        <span className="flex items-center justify-center">
                          <Loader className="animate-spin w-4 h-4 mr-2" />
                          Envoi en cours...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center">
                          <Mail className="w-4 h-4 mr-2" />
                          {emailResults ? 'Renvoyer les emails échoués' : 'Envoyer les emails maintenant'}
                        </span>
                      )}
                    </Button>
                    
                    <p className="text-xs text-gray-500 mt-2">
                      Les employés recevront leur fiche de paie par email
                    </p>
                  </div>
                )}
              </div>
            </Card>
            
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
                    onSuccess({ 
                      ...results, 
                      emails: emailResults,
                      action: 'calculated_with_emails' 
                    });
                  }
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
              {isMonthPaid() ? 'Recalcul des salaires' : 'Calcul et envoi des fiches de paie'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={calculating || sendingEmails}
          >
            <XCircle className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
          {renderStepIndicator()}
          {renderContent()}
        </div>

        {/* Pied de page */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <span>Module Paie • Étape {['select', 'preview', 'calculate', 'complete'].indexOf(activeStep) + 1}/4</span>
            <span>{getSelectedMonthName() || 'Non sélectionné'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculateSalariesModal;