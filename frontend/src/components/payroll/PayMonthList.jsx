// src/components/payroll/PayMonthList.jsx - VERSION AVEC RECALCULER 
import React from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

const PayMonthList = ({ payMonths = [], loading = false, onViewDetails, onCreateNew, onCalculate, onSelectMonth, selectedMonth }) => {
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

  if (payMonths.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="text-gray-500 mb-4">
          <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun mois de paie trouvé</h3>
        <p className="text-gray-600 mb-6">Commencez par créer un nouveau mois de paie pour calculer les salaires.</p>
        {onCreateNew && (
          <Button onClick={onCreateNew} variant="primary">
            Créer un mois de paie
          </Button>
        )}
      </Card>
    );
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { color: 'gray', label: 'Brouillon' },
      calculated: { color: 'blue', label: 'Calculé' },
      approved: { color: 'green', label: 'Approuvé' },
      paid: { color: 'purple', label: 'Payé' },
      closed: { color: 'red', label: 'Clôturé' }
    };
    
    const config = statusConfig[status] || { color: 'gray', label: status };
    
    return (
      <Badge color={config.color}>
        {config.label}
      </Badge>
    );
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Mois de paie</h3>
        {onCreateNew && (
          <Button onClick={onCreateNew} size="sm" variant="primary">
            Nouveau mois
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        {payMonths.map((month) => (
          <Card 
            key={month.id || month.month_year} 
            className={`p-4 hover:shadow-md transition-shadow ${selectedMonth === month.month_year ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => onSelectMonth && onSelectMonth(month.month_year)}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-gray-900">
                    {month.month_name || `Mois ${month.month_year}`}
                  </h4>
                  {getStatusBadge(month.status)}
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  {formatDate(month.start_date)} - {formatDate(month.end_date)}
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">ID:</span>
                    <span className="font-medium">{month.month_year}</span>
                  </div>
                  {month.total_employees !== undefined && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Employés:</span>
                      <span className="font-medium">{month.total_employees}</span>
                    </div>
                  )}
                  {month.total_amount !== undefined && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Montant total:</span>
                      <span className="font-medium">{formatAmount(month.total_amount)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {onViewDetails && (
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetails(month.month_year);
                    }}
                    size="sm" 
                    variant="outline"
                  >
                    Détails
                  </Button>
                )}
                
                {/* BOUTON CALCULER - pour les mois en brouillon */}
                {onCalculate && month.status === 'draft' && (
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('🟢 PayMonthList - Calculer cliqué pour:', month.month_year);
                      onCalculate(month.month_year);
                    }}
                    size="sm" 
                    variant="primary"
                  >
                    Calculer
                  </Button>
                )}
                
                {/* BOUTON RECALCULER - pour les mois calculés OU payés */}
                {onCalculate && (month.status === 'calculated' || month.status === 'paid') && (
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('🟡 PayMonthList - Recalculer cliqué pour:', month.month_year);
                      console.log('🟡 Statut du mois:', month.status);
                      onCalculate(month.month_year);
                    }}
                    size="sm" 
                    variant="secondary"
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Recalculer
                  </Button>
                )}
              </div>
            </div>

            {month.stats && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Salaire net total:</span>
                    <div className="font-medium">
                      {formatAmount(month.stats.total_net || month.total_amount)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Impôts totaux:</span>
                    <div className="font-medium">
                      {formatAmount(month.stats.total_tax)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Paiements:</span>
                    <div className="font-medium">
                      {month.stats.payment_count || 0}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {payMonths.length > 0 && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Affichage de {payMonths.length} mois de paie
          </p>
          <div className="text-xs text-gray-500 mt-1">
            • {payMonths.filter(m => m.status === 'draft').length} brouillons
            • {payMonths.filter(m => m.status === 'calculated').length} calculés
            • {payMonths.filter(m => m.status === 'paid').length} payés
          </div>
        </div>
      )}
    </div>
  );
};

export default PayMonthList;