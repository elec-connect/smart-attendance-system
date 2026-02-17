// src/components/payroll/PaymentList.jsx  
import React, { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { toast } from 'react-hot-toast';
import api from '../../services/api';

const PaymentList = ({ 
  payments = [], 
  loading = false, 
  monthYear,
  onRefresh,
  showActions = true 
}) => {
  const [approvingId, setApprovingId] = useState(null);
  const [markingPaidId, setMarkingPaidId] = useState(null);

  const getPaymentStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'yellow', label: 'En attente', icon: '⏳' },
      calculated: { color: 'blue', label: 'Calculé', icon: '🧮' },
      approved: { color: 'green', label: 'Approuvé', icon: '✅' },
      paid: { color: 'purple', label: 'Payé', icon: '💰' },
      failed: { color: 'red', label: 'Échoué', icon: '❌' }
    };
    
    const config = statusConfig[status] || { color: 'gray', label: status, icon: '❓' };
    
    return (
      <Badge color={config.color} className="flex items-center gap-1">
        <span>{config.icon}</span>
        <span>{config.label}</span>
      </Badge>
    );
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'N/A';
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Non défini';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleApprovePayment = async (paymentId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir approuver ce paiement ?')) {
      return;
    }

    try {
      setApprovingId(paymentId);
      
      const response = await api.put(`/payroll/approve/${paymentId}`, {
        approved_by: 'admin' // Remplacer par l'utilisateur réel
      });

      toast.success('Paiement approuvé avec succès');
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Erreur approbation paiement:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de l\'approbation');
    } finally {
      setApprovingId(null);
    }
  };

  const handleMarkAsPaid = async (paymentId) => {
    if (!window.confirm('Marquer ce paiement comme payé ?')) {
      return;
    }

    try {
      setMarkingPaidId(paymentId);
      
      const response = await api.put(`/payroll/mark-paid/${paymentId}`, {
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'bank_transfer',
        paid_by: 'admin' // Remplacer par l'utilisateur réel
      });

      toast.success('Paiement marqué comme payé');
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Erreur marquage payé:', error);
      toast.error(error.response?.data?.message || 'Erreur lors du marquage');
    } finally {
      setMarkingPaidId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 bg-gray-200 rounded w-1/4 animate-pulse"></div>
          <div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>
        </div>
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="p-4">
            <div className="animate-pulse">
              <div className="flex justify-between mb-3">
                <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                <div className="h-6 bg-gray-200 rounded w-24"></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="text-gray-500 mb-4">
          <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Aucun paiement trouvé
        </h3>
        <p className="text-gray-600 mb-6">
          {monthYear 
            ? `Aucun paiement pour le mois ${monthYear}`
            : 'Les paiements apparaîtront après calcul des salaires'}
        </p>
        {onRefresh && (
          <Button onClick={onRefresh} variant="outline">
            Actualiser
          </Button>
        )}
      </Card>
    );
  }

  // Calculer les totaux
  const totals = payments.reduce((acc, payment) => {
    return {
      totalNet: acc.totalNet + (parseFloat(payment.net_salary) || 0),
      totalTax: acc.totalTax + (parseFloat(payment.tax_amount) || 0),
      totalDeductions: acc.totalDeductions + (parseFloat(payment.deduction_amount) || 0),
      count: acc.count + 1,
      paidCount: acc.paidCount + (payment.payment_status === 'paid' ? 1 : 0),
      pendingCount: acc.pendingCount + (payment.payment_status === 'pending' ? 1 : 0)
    };
  }, { 
    totalNet: 0, 
    totalTax: 0, 
    totalDeductions: 0, 
    count: 0,
    paidCount: 0,
    pendingCount: 0
  });

  return (
    <div className="space-y-6">
      {/* En-tête avec totaux */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {monthYear ? `Paiements - ${monthYear}` : 'Liste des paiements'}
            </h3>
            <p className="text-sm text-gray-600">
              {payments.length} paiements trouvés
            </p>
          </div>
          
          {onRefresh && (
            <Button 
              onClick={onRefresh} 
              size="sm" 
              variant="outline"
            >
              Actualiser
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-white p-3 rounded border">
            <div className="text-gray-500">Salaire net total</div>
            <div className="text-lg font-semibold text-green-600">
              {formatCurrency(totals.totalNet)}
            </div>
          </div>
          
          <div className="bg-white p-3 rounded border">
            <div className="text-gray-500">Impôts totaux</div>
            <div className="text-lg font-semibold text-red-600">
              {formatCurrency(totals.totalTax)}
            </div>
          </div>
          
          <div className="bg-white p-3 rounded border">
            <div className="text-gray-500">Statut</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                {totals.paidCount} payés
              </span>
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                {totals.pendingCount} en attente
              </span>
            </div>
          </div>
          
          <div className="bg-white p-3 rounded border">
            <div className="text-gray-500">Déductions totales</div>
            <div className="text-lg font-semibold text-orange-600">
              {formatCurrency(totals.totalDeductions)}
            </div>
          </div>
        </div>
      </div>

      {/* Liste des paiements */}
      <div className="space-y-4">
        {payments.map((payment) => (
          <Card key={payment.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-gray-900">
                    {payment.first_name} {payment.last_name}
                  </h4>
                  {getPaymentStatusBadge(payment.payment_status)}
                </div>
                <p className="text-sm text-gray-600">
                  {payment.department} • {payment.position || 'N/A'}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span>ID: {payment.employee_id}</span>
                  {payment.payment_date && (
                    <>
                      <span>•</span>
                      <span>Payé le: {formatDate(payment.payment_date)}</span>
                    </>
                  )}
                  {payment.payment_method && (
                    <>
                      <span>•</span>
                      <span>Méthode: {payment.payment_method}</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">
                  {formatCurrency(payment.net_salary)}
                </div>
                <div className="text-sm text-gray-500">
                  net
                </div>
              </div>
            </div>
            
            {/* Détails du paiement */}
            <div className="border-t pt-3 mt-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Salaire de base:</span>
                  <div className="font-medium">
                    {formatCurrency(payment.base_salary)}
                  </div>
                </div>
                
                <div>
                  <span className="text-gray-500">Impôts:</span>
                  <div className="font-medium text-red-600">
                    {formatCurrency(payment.tax_amount)}
                  </div>
                </div>
                
                <div>
                  <span className="text-gray-500">Déductions:</span>
                  <div className="font-medium text-orange-600">
                    {formatCurrency(payment.deduction_amount)}
                  </div>
                </div>
                
                <div>
                  <span className="text-gray-500">Date calcul:</span>
                  <div className="font-medium">
                    {formatDate(payment.updated_at || payment.created_at)}
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              {showActions && (
                <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
                  {payment.payment_status === 'pending' && (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => handleApprovePayment(payment.id)}
                      disabled={approvingId === payment.id}
                    >
                      {approvingId === payment.id ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Approbation...
                        </span>
                      ) : 'Approuver'}
                    </Button>
                  )}
                  
                  {payment.payment_status === 'approved' && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleMarkAsPaid(payment.id)}
                      disabled={markingPaidId === payment.id}
                    >
                      {markingPaidId === payment.id ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Marquage...
                        </span>
                      ) : 'Marquer comme payé'}
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // Voir les détails du paiement
                      toast('Détails du paiement: ' + payment.id, {
                        icon: '👁️',
                      });
                    }}
                  >
                    Détails
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Résumé */}
      <div className="bg-gray-50 rounded-lg p-4 border">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Affichage de {payments.length} paiements
          </div>
          <div className="text-sm font-medium">
            Total: <span className="text-green-600">{formatCurrency(totals.totalNet)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentList;
