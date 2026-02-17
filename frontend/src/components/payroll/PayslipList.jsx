// src/components/payroll/PayslipList.jsx 
import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Calendar, 
  User,
  FileText,
  ChevronRight
} from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Input from '../ui/Input';
import api from '../../services/api';

const PayslipList = ({ employeeId = null }) => {
  const [loading, setLoading] = useState(false);
  const [payslips, setPayslips] = useState([]);
  const [filteredPayslips, setFilteredPayslips] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Charger les fiches de paie
  useEffect(() => {
    loadPayslips();
  }, [employeeId]);

  const loadPayslips = async () => {
    try {
      setLoading(true);
      
      let response;
      if (employeeId) {
        // Historique pour un employé spécifique
        response = await api.get(`/payroll/employee/${employeeId}/history`);
        if (response.data.success) {
          const formatted = response.data.data.payments.map(payment => ({
            id: payment.id,
            month_year: payment.month_year,
            month_name: payment.month_name || `Mois ${payment.month_year}`,
            status: payment.payment_status,
            net_salary: payment.net_salary,
            payment_date: payment.payment_date,
            employee_name: `${payment.first_name} ${payment.last_name}`,
            employee_id: payment.employee_id,
            type: 'payment'
          }));
          setPayslips(formatted);
          setFilteredPayslips(formatted);
        }
      } else {
        // Toutes les fiches (admin)
        const paymentsRes = await api.get('/payroll/history', { params: { limit: 50 } });
        if (paymentsRes.data.success) {
          const formatted = paymentsRes.data.data.payments.map(payment => ({
            id: payment.id,
            month_year: payment.month_year,
            month_name: payment.month_name || `Mois ${payment.month_year}`,
            status: payment.payment_status,
            net_salary: payment.net_salary,
            payment_date: payment.payment_date,
            employee_name: `${payment.first_name} ${payment.last_name}`,
            employee_id: payment.employee_id,
            department: payment.department,
            type: 'payment'
          }));
          setPayslips(formatted);
          setFilteredPayslips(formatted);
        }
      }
    } catch (error) {
      console.error('Erreur chargement fiches:', error);
    } finally {
      setLoading(false);
    }
  };

  // Appliquer les filtres
  useEffect(() => {
    let results = payslips;
    
    // Filtrer par recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      results = results.filter(p => 
        p.employee_name.toLowerCase().includes(term) ||
        p.employee_id.toLowerCase().includes(term) ||
        p.month_name.toLowerCase().includes(term) ||
        p.month_year.includes(term)
      );
    }
    
    // Filtrer par statut
    if (filterStatus !== 'all') {
      results = results.filter(p => p.status === filterStatus);
    }
    
    // Filtrer par année
    if (selectedYear) {
      results = results.filter(p => p.month_year.startsWith(selectedYear.toString()));
    }
    
    setFilteredPayslips(results);
  }, [searchTerm, filterStatus, selectedYear, payslips]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const config = {
      paid: { color: 'green', label: 'Payé' },
      pending: { color: 'yellow', label: 'En attente' },
      approved: { color: 'blue', label: 'Approuvé' },
      draft: { color: 'gray', label: 'Brouillon' }
    };
    
    const { color = 'gray', label = status } = config[status] || {};
    
    return <Badge color={color} size="sm">{label}</Badge>;
  };

  const handleViewPayslip = (payslip) => {
    // Ouvrir dans une nouvelle fenêtre
    const url = `/payroll/payslip/${payslip.employee_id}/${payslip.month_year}`;
    window.open(url, '_blank');
  };

  const handleDownload = async (payslip, format = 'pdf') => {
    try {
      const response = await api.get(`/payroll/payslip/export/${payslip.employee_id}/${payslip.month_year}/${format}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `fiche_paie_${payslip.employee_id}_${payslip.month_year}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Erreur téléchargement:', error);
    }
  };

  // Années disponibles pour le filtre
  const availableYears = Array.from(
    new Set(payslips.map(p => p.month_year?.split('-')[0]).filter(Boolean))
  ).sort((a, b) => b - a);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/3"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec filtres */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Fiches de Paie</h2>
          <p className="text-gray-600">
            {employeeId ? 'Historique personnel' : 'Toutes les fiches de paie'}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button onClick={loadPayslips} variant="outline" size="sm">
            Actualiser
          </Button>
        </div>


      </div>

      {/* Filtres */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recherche</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Nom, ID employé ou mois..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Année</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Toutes les années</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Total fiches</div>
          <div className="text-2xl font-bold text-gray-900">{filteredPayslips.length}</div>
        </Card>
        
        <Card className="p-4">
          <div className="text-sm text-gray-600">Payées</div>
          <div className="text-2xl font-bold text-green-600">
            {filteredPayslips.filter(p => p.status === 'paid').length}
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="text-sm text-gray-600">Montant total</div>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(filteredPayslips.reduce((sum, p) => sum + (parseFloat(p.net_salary) || 0), 0))}
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="text-sm text-gray-600">Employés</div>
          <div className="text-2xl font-bold text-purple-600">
            {new Set(filteredPayslips.map(p => p.employee_id)).size}
          </div>
        </Card>
      </div>

      {/* Liste des fiches */}
      {filteredPayslips.length > 0 ? (
        <div className="space-y-4">
          {filteredPayslips.map((payslip) => (
            <Card key={`${payslip.employee_id}-${payslip.month_year}`} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {payslip.employee_name}
                        <span className="text-gray-600 text-sm ml-2">({payslip.employee_id})</span>
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span className="text-sm text-gray-600">{payslip.month_name}</span>
                        {getStatusBadge(payslip.status)}
                      </div>
                    </div>
                  </div>
                  
                  {payslip.department && (
                    <div className="text-sm text-gray-500 mt-2">
                      Département: {payslip.department}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency(payslip.net_salary)}
                    </div>
                    <div className="text-sm text-gray-500">
                      Payé le {formatDate(payslip.payment_date)}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => handleViewPayslip(payslip)}
                      size="sm"
                      variant="outline"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDownload(payslip)}
                      size="sm"
                      variant="outline"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || filterStatus !== 'all' || selectedYear ? 'Aucune fiche correspondante' : 'Aucune fiche de paie'}
          </h3>
          <p className="text-gray-600">
            {searchTerm || filterStatus !== 'all' || selectedYear 
              ? 'Essayez de modifier vos critères de recherche'
              : employeeId 
                ? 'Votre historique de paie apparaîtra ici'
                : 'Les fiches de paie apparaîtront ici après paiement'}
          </p>
        </Card>
      )}

      {/* Pagination */}
      {filteredPayslips.length > 0 && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Affichage de {filteredPayslips.length} fiches
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              Précédent
            </Button>
            <Button variant="outline" size="sm">
              Suivant
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayslipList;
