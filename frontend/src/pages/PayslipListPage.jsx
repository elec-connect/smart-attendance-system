import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { downloadPayslipPDF } from '../utils/ProfessionalPayslipPDF';
import { 
  FileText, 
  ArrowLeft, 
  Search, 
  Filter, 
  Calendar,
  Users,
  DollarSign,
  Eye,
  Download
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const PayslipListPage = () => {
  const navigate = useNavigate();
  const [filterYear, setFilterYear] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [loading, setLoading] = useState(true);
  const [payslips, setPayslips] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    paid: 0,
    totalAmount: 0,
    uniqueEmployees: 0
  });

  // Générer les 5 dernières années handleDownloadPayslip 
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Charger les données
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        console.log('🔍 Chargement des fiches de paie...');
        
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5000/api/payroll/history?limit=100', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📊 Données reçues:', data);
        
        // Extraire les paiements - structure simple
        const extractedPayments = data.payments || data.data?.payments || [];
        console.log(`✅ ${extractedPayments.length} paiements trouvés`);
        
        setPayslips(extractedPayments);
        
        // Calculer les statistiques
        const paidCount = extractedPayments.filter(p => p.payment_status === 'paid').length;
        const totalAmount = extractedPayments.reduce((sum, p) => sum + (Number(p.net_salary) || 0), 0);
        const uniqueEmployees = [...new Set(extractedPayments.map(p => p.employee_id))].length;
        
        setStats({
          total: extractedPayments.length,
          paid: paidCount,
          totalAmount: totalAmount,
          uniqueEmployees: uniqueEmployees
        });
        
        toast.success(`${extractedPayments.length} fiches chargées`);
        
      } catch (error) {
        console.error('❌ Erreur:', error);
        toast.error('Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Fonction pour voir une fiche
  const handleViewPayslip = (employeeId, monthYear) => {
    const url = `/payroll/payslip/${employeeId}/${monthYear}`;
    window.open(url, '_blank');
  };

  // Fonction pour télécharger une fiche
  const handleDownloadPayslip = async (employeeId, monthYear) => {
  try {
    toast.loading('Préparation du téléchargement...', { id: 'download' });
    
    const token = localStorage.getItem('token');
    
    // UTILISEZ LE NOUVEL ENDPOINT
    const response = await fetch(
      `http://localhost:5000/api/exports/payslip/single-pdf?employee_id=${employeeId}&month_year=${monthYear}`, 
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur serveur:', errorText);
      throw new Error(`Erreur ${response.status}: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    // Vérifier que c'est bien un PDF
    if (blob.type !== 'application/pdf') {
      console.warn('⚠️  Type de fichier inattendu:', blob.type);
    }
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fiche_paie_${employeeId}_${monthYear}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    // Libérer l'URL
    setTimeout(() => window.URL.revokeObjectURL(url), 100);
    
    toast.success('Fiche téléchargée !', {
      id: 'download',
      duration: 3000
    });
    
  } catch (error) {
    console.error('❌ Erreur téléchargement:', error);
    toast.error(`Erreur: ${error.message}`, {
      id: 'download',
      duration: 4000
    });
    
    // Fallback : ouvrir la vue
    handleViewPayslip(employeeId, monthYear);
  }
};

  // Filtrer les données
  const filteredPayslips = payslips.filter(payslip => {
    // Filtre année
    if (filterYear !== 'all') {
      const payslipYear = payslip.month_year?.split('-')[0];
      if (payslipYear !== filterYear.toString()) return false;
    }
    
    // Filtre statut
    if (filterStatus !== 'all') {
      if (payslip.payment_status !== filterStatus) return false;
    }
    
    // Filtre employé
    if (filterEmployee) {
      const searchTerm = filterEmployee.toLowerCase();
      const fullName = `${payslip.first_name || ''} ${payslip.last_name || ''}`.toLowerCase();
      const employeeId = payslip.employee_id?.toLowerCase() || '';
      
      if (!fullName.includes(searchTerm) && !employeeId.includes(searchTerm)) {
        return false;
      }
    }
    
    return true;
  });

  // Formater la monnaie
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  // Formater la date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* En-tête */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              Fiches de Paie
            </h1>
            <p className="text-gray-600 mt-2">
              Historique et gestion des fiches de paie des employés
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => navigate('/payroll')}
              variant="outline"
              className="flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour à la paie
            </Button>
            <Button
              onClick={() => navigate('/exports')}
              className="flex items-center bg-green-600 hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Exporter
            </Button>
          </div>
        </div>

        {/* Filtres */}
        <Card className="p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                  Année
                </div>
              </label>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Toutes les années</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center">
                  <Filter className="w-4 h-4 mr-2 text-gray-400" />
                  Statut
                </div>
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="paid">Payé</option>
                <option value="pending">En attente</option>
                <option value="approved">Approuvé</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-2 text-gray-400" />
                  Employé
                </div>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un employé..."
                  value={filterEmployee}
                  onChange={(e) => setFilterEmployee(e.target.value)}
                  className="w-full pl-10 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
          
          <div className="flex items-end mt-4">
            <Button
              onClick={() => {
                setFilterYear('all');
                setFilterStatus('all');
                setFilterEmployee('');
              }}
              variant="outline"
              className="w-full"
            >
              Réinitialiser
            </Button>
          </div>
        </Card>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Fiches totales</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {loading ? '-' : stats.total}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Fiches payées</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {loading ? '-' : stats.paid}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Montant total</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {loading ? '-' : formatCurrency(stats.totalAmount)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Employés</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {loading ? '-' : stats.uniqueEmployees}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Liste des fiches */}
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Toutes les fiches de paie</h2>
              <p className="text-gray-600 mt-1">
                {filteredPayslips.length} fiche(s) trouvée(s)
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Bouton Actualiser */}
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="border-gray-300"
              >
                Actualiser
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Chargement des fiches de paie...</p>
            </div>
          ) : filteredPayslips.length > 0 ? (
            <div className="space-y-4">
              {filteredPayslips.map((payslip, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center">
                            <h3 className="font-medium text-gray-900">
                              {payslip.first_name} {payslip.last_name}
                            </h3>
                            <span className="text-gray-600 text-sm ml-2">({payslip.employee_id})</span>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-600">{payslip.month_name || payslip.month_year}</span>
                            <span className={`px-2 py-1 text-xs rounded ${
                              payslip.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                              payslip.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {payslip.payment_status}
                            </span>
                          </div>
                          
                          {payslip.department && (
                            <p className="text-sm text-gray-500 mt-1">Département: {payslip.department}</p>
                          )}
                          
                          {payslip.payment_date && (
                            <p className="text-xs text-gray-500 mt-1">
                              Payé le: {formatDate(payslip.payment_date)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(payslip.net_salary)}
                      </div>
                      
                      {/* BOUTONS D'ACTION */}
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewPayslip(payslip.employee_id, payslip.month_year)}
                          className="flex items-center"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Voir
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadPayslip(payslip.employee_id, payslip.month_year)}
                          className="flex items-center"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Télécharger
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {payslips.length === 0 ? 'Aucune fiche de paie' : 'Aucune fiche correspondante'}
              </h3>
              <p className="text-gray-600">
                {payslips.length === 0 
                  ? 'Les fiches de paie apparaîtront ici après calcul et paiement des salaires'
                  : 'Essayez de modifier vos critères de recherche'}
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PayslipListPage;