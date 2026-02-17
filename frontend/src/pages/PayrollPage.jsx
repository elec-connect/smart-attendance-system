// src/pages/PayrollPage.jsx - VERSION AVEC BOUTONS ACTIFS + SOLUTION 1
import React, { useState, useEffect } from 'react';
import { PayrollProvider } from "../context/PayrollContext";
import PayrollDashboard from "../components/payroll/PayrollDashboard";
import SalaryConfig from "../components/payroll/SalaryConfig";
import PayrollReports from "../components/payroll/PayrollReports";
import { 
  BarChart3, 
  CreditCard, 
  Settings, 
  History,
  DollarSign,
  Calendar,
  Users,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  FileText // AJOUTÉ pour l'icône des fiches
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import PaymentHistory from "../components/payroll/PaymentHistory";

const PayrollPage = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPayMonthModal, setShowPayMonthModal] = useState(false);
  const [showCalculateModal, setShowCalculateModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Vérifier l'authentification
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('🔐 Vérification authentification...');
        const token = localStorage.getItem('token');
        
        if (!token) {
          console.warn('⚠️ Aucun token trouvé dans localStorage');
          setIsAuthenticated(false);
          toast.error('Veuillez vous connecter pour accéder à la gestion de paie');
          
          // Redirection après délai
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
          return;
        }
        
        // Vérifier la validité du token via API
        const response = await fetch('http://localhost:5000/api/auth/verify', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Token valide:', data);
          setIsAuthenticated(true);
        } else {
          console.error('❌ Token invalide:', response.status);
          localStorage.removeItem('token');
          setIsAuthenticated(false);
          toast.error('Session expirée. Veuillez vous reconnecter.');
          
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        }
      } catch (error) {
        console.error('❌ Erreur vérification auth:', error);
        toast.error('Erreur de connexion au serveur');
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Fonction pour rafraîchir la page
  const handleRefresh = () => {
    window.location.reload();
  };

  // Fonction pour changer d'onglet
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    // Scroll vers le haut quand on change d'onglet
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Fonction utilitaire pour les notifications
  const showNotification = (message, type = 'info') => {
    switch(type) {
      case 'success':
        return toast.success(message);
      case 'error':
        return toast.error(message);
      case 'loading':
        return toast.loading(message);
      default:
        return toast(message); // Pour les notifications 'info'
    }
  };

  const tabs = [
    { 
      id: 'dashboard', 
      label: 'Tableau de Bord', 
      icon: BarChart3,
      description: 'Vue d\'ensemble des activités de paie et statistiques'
    },
    { 
      id: 'config', 
      label: 'Configuration', 
      icon: Settings,
      description: 'Configurer les salaires et paramètres des employés'
    },
    { 
      id: 'reports', 
      label: 'Rapports', 
      icon: CreditCard,
      description: 'Générez et exportez des rapports de paie'
    },
    { 
      id: 'history', 
      label: 'Historique', 
      icon: History,
      description: 'Consultation des paiements et activités passées'
    }
  ];

  // Page de chargement
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900">Vérification de l'authentification...</h2>
          <p className="text-gray-600 mt-2">Chargement du module de paie</p>
        </div>
      </div>
    );
  }

  // Page non authentifiée
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Authentification requise</h2>
          <p className="text-gray-600 mb-6">
            Vous devez être connecté pour accéder au module de gestion de paie.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.href = '/login'}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors"
            >
              Se connecter
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="w-full px-4 py-3 bg-gray-200 text-gray-800 rounded-md font-medium hover:bg-gray-300 transition-colors"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Page principale authentifiée
  return (
    <PayrollProvider>
      {/* Modal pour créer un mois (affiché globalement) */}
      {showPayMonthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Créer un nouveau mois de paie</h3>
              <p className="text-gray-600 mb-4">
                Cette action ouvrira la fenêtre de création de mois.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowPayMonthModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    // Envoyer un événement au composant enfant
                    document.dispatchEvent(new CustomEvent('open-paymonth-modal'));
                    setShowPayMonthModal(false);
                    showNotification('Ouverture du formulaire de création de mois', 'success');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Ouvrir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal pour calculer les salaires */}
      {showCalculateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Calculer les salaires</h3>
              <p className="text-gray-600 mb-4">
                Cette action ouvrira la fenêtre de calcul des salaires.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowCalculateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    // Envoyer un événement au composant enfant
                    document.dispatchEvent(new CustomEvent('open-calculate-modal'));
                    setShowCalculateModal(false);
                    showNotification('Ouverture du calcul des salaires', 'success');
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Ouvrir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-50">
        {/* Header principal */}
        <div className="bg-white border-b shadow-sm">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestion de la Paie</h1>
                <p className="text-gray-600 mt-1">
                  Gérez les salaires, calculs et paiements des employés
                </p>
              </div>
              <div className="mt-4 md:mt-0">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex items-center text-sm text-gray-500">
                    <div className="flex items-center mr-4">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                      <span className="font-medium">Système actif</span>
                    </div>
                    <div className="flex items-center bg-gray-100 px-3 py-1 rounded-full">
                      <DollarSign className="w-4 h-4 mr-2 text-green-600" />
                      <span className="font-medium">Devise: TND</span>
                    </div>
                  </div>
                  <button
                    onClick={handleRefresh}
                    className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    <span className="text-sm">Rafraîchir</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Navigation par onglets */}
          <div className="border-b border-gray-200 bg-white">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <nav className="flex space-x-1 overflow-x-auto">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`
                        flex items-center gap-2 px-5 py-3 font-medium text-sm whitespace-nowrap
                        transition-all relative border-b-2
                        ${activeTab === tab.id
                          ? 'border-blue-600 text-blue-600 bg-gradient-to-b from-blue-50 to-white'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
        
        {/* Contenu principal */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Description et actions rapides */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="mb-4 md:mb-0">
              <p className="text-gray-600 text-sm md:text-base">
                {tabs.find(t => t.id === activeTab)?.description}
              </p>
            </div>
            
            {/* Actions rapides selon l'onglet - SOLUTION 1 AJOUTÉE ICI */}
            <div className="flex flex-wrap gap-2">
              {activeTab === 'dashboard' && (
                <>
                  <button 
                    onClick={() => setShowPayMonthModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center shadow-sm active:scale-95 transform transition-transform"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Nouveau mois
                  </button>
                  <button 
                    onClick={() => setShowCalculateModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors flex items-center shadow-sm active:scale-95 transform transition-transform"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Calculer salaires
                  </button>
                  {/* SOLUTION 1 : BOUTON FICHES DE PAIE AJOUTÉ */}
                  <button 
                    onClick={() => window.location.href = '/payroll/payslips'}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 transition-colors flex items-center shadow-sm active:scale-95 transform transition-transform"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Fiches de paie
                  </button>
                </>
              )}
              
              {activeTab === 'config' && (
                <button 
                  onClick={() => {
                    // Rediriger vers la configuration avec un employé sélectionné
                    document.dispatchEvent(new CustomEvent('open-new-config'));
                    showNotification('Ouverture de la configuration', 'success');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm active:scale-95 transform transition-transform"
                >
                  Nouvelle configuration
                </button>
              )}
              
              {activeTab === 'reports' && (
                <button 
                  onClick={() => {
                    // Lancer la génération de rapport
                    document.dispatchEvent(new CustomEvent('generate-report'));
                    showNotification('Génération du rapport lancée', 'success');
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors shadow-sm active:scale-95 transform transition-transform"
                >
                  Générer rapport
                </button>
              )}
            </div>
          </div>
          
          {/* Contenu de l'onglet */}
          <div className="bg-white rounded-lg shadow-sm border min-h-[500px]">
            {activeTab === 'dashboard' && <PayrollDashboard />}
            {activeTab === 'config' && <SalaryConfig />}
            {activeTab === 'reports' && <PayrollReports />}
            {activeTab === 'history' && <PaymentHistory />}
          </div>
          
          {/* Pied de page informatif */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="text-center text-sm text-gray-500">
              <div className="flex flex-col md:flex-row md:items-center md:justify-center gap-2 mb-2">
                <span className="bg-gray-100 px-3 py-1 rounded-full">
                  Module Paie • Version 1.0 • {new Date().getFullYear()}
                </span>
                <span className="hidden md:inline">•</span>
                <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-medium">
                  Mode Production
                </span>
              </div>
              <p className="mt-2">
                Pour toute assistance, contactez l'administrateur système
              </p>
            </div>
          </div>
        </div>
      </div>
    </PayrollProvider>
  );
};

export default PayrollPage;