// src/components/payroll/PayslipViewer.jsx - VERSION COMPLÈTE 
import React, { useState, useEffect } from 'react';
import { makeRequest } from '../../services/api';
import { 
  Download, 
  Printer, 
  Mail, 
  FileText, 
  User, 
  Calendar,
  DollarSign,
  CreditCard,
  Building,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import api from '../../services/api';

const PayslipViewer = ({ employeeId, monthYear, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payslip, setPayslip] = useState(null);
  const [downloadFormat, setDownloadFormat] = useState('pdf');

  // Charger la fiche de paie
  useEffect(() => {
    if (employeeId && monthYear) {
      loadPayslip();
    }
  }, [employeeId, monthYear]);

  const loadPayslip = async () => {
  try {
    setLoading(true);
    setError(null);
    
    // MODIFIÉ : utilisez makeRequest directement
    const response = await makeRequest(
      'GET', 
      `/payroll/payslip/${employeeId}/${monthYear}`
    );
    
    console.log('📥 Réponse fiche de paie:', response);
    
    if (response.success) {
      setPayslip(response.data);
    } else {
      setError(response.message || 'Erreur lors du chargement');
    }
  } catch (error) {
    console.error('Erreur chargement fiche de paie:', error);
    setError(error.message || 'Erreur de connexion');
  } finally {
    setLoading(false);
  }
};

  const handleDownload = async (format) => {
    try {
      const response = await api.get(`/payroll/payslip/export/${employeeId}/${monthYear}/${format}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `fiche_paie_${employeeId}_${monthYear}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      alert('Erreur lors du téléchargement');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendEmail = async () => {
    try {
      const response = await api.post('/payroll/payslip/email', {
        employee_id: employeeId,
        month_year: monthYear,
        email: payslip.employee.email
      });
      
      if (response.data.success) {
        alert('Fiche de paie envoyée par email');
      }
    } catch (error) {
      console.error('Erreur envoi email:', error);
      alert('Erreur lors de l\'envoi par email');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: payslip?.summary?.currency || 'TND',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Chargement de la fiche de paie...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="bg-red-50 border-red-200 p-6">
          <div className="flex items-center mb-4">
            <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
            <h3 className="text-lg font-semibold text-red-800">Erreur</h3>
          </div>
          <p className="text-red-700 mb-4">{error}</p>
          <Button onClick={loadPayslip} variant="outline" className="border-red-300 text-red-700">
            Réessayer
          </Button>
        </Card>
      </div>
    );
  }

  if (!payslip) {
    return (
      <div className="p-6 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune fiche de paie trouvée</h3>
        <p className="text-gray-600">Vérifiez l'ID employé et le mois</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-6">
      {/* En-tête avec actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fiche de Paie</h1>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center text-gray-600">
              <User className="w-4 h-4 mr-2" />
              <span>{payslip.employee.name}</span>
            </div>
            <div className="flex items-center text-gray-600">
              <Calendar className="w-4 h-4 mr-2" />
              <span>{payslip.period.month_name}</span>
            </div>
            <Badge color={payslip.summary.payment_status === 'paid' ? 'green' : 'yellow'}>
              {payslip.summary.payment_status === 'paid' ? 'Payé' : 'En attente'}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex items-center border rounded-md">
            <select
              value={downloadFormat}
              onChange={(e) => setDownloadFormat(e.target.value)}
              className="px-3 py-2 border-0 bg-transparent focus:ring-0 focus:outline-none text-sm"
            >
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
              <option value="html">HTML</option>
            </select>
            <Button
              onClick={() => handleDownload(downloadFormat)}
              variant="outline"
              size="sm"
              className="border-l rounded-l-none"
            >
              <Download className="w-4 h-4 mr-2" />
              Télécharger
            </Button>
          </div>

          <Button onClick={handlePrint} variant="outline" size="sm">
            <Printer className="w-4 h-4 mr-2" />
            Imprimer
          </Button>

          <Button onClick={handleSendEmail} variant="outline" size="sm">
            <Mail className="w-4 h-4 mr-2" />
            Envoyer
          </Button>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche - Informations */}
        <div className="lg:col-span-2">
          <Card className="mb-6">
            <div className="p-6">
              {/* En-tête fiche */}
              <div className="text-center mb-8">
                <div className="flex items-center justify-center mb-4">
                  <Building className="w-8 h-8 text-blue-600 mr-3" />
                  <h2 className="text-2xl font-bold text-gray-900">{payslip.company_info.name}</h2>
                </div>
                <div className="text-gray-600 space-y-1">
                  <p>{payslip.company_info.address}</p>
                  <p>{payslip.company_info.email} • {payslip.company_info.phone}</p>
                  <p className="text-sm mt-2">Fiche de paie N°: {payslip.metadata.payslip_id}</p>
                </div>
              </div>

              {/* Informations employé et période */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    Informations employé
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Nom:</span>
                      <span className="font-medium">{payslip.employee.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">ID:</span>
                      <span className="font-medium">{payslip.employee.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Département:</span>
                      <span className="font-medium">{payslip.employee.department}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Poste:</span>
                      <span className="font-medium">{payslip.employee.position}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date d'embauche:</span>
                      <span className="font-medium">{formatDate(payslip.employee.hire_date)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    Période de paie
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mois:</span>
                      <span className="font-medium">{payslip.period.month_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Période:</span>
                      <span className="font-medium">
                        {formatDate(payslip.period.start_date)} - {formatDate(payslip.period.end_date)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date de paiement:</span>
                      <span className="font-medium">{formatDate(payslip.period.payment_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Méthode de paiement:</span>
                      <span className="font-medium">{payslip.summary.payment_method}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Statut:</span>
                      <Badge color={payslip.summary.payment_status === 'paid' ? 'green' : 'yellow'} size="sm">
                        {payslip.summary.payment_status === 'paid' ? 'Payé' : 'En attente'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Résumé présence */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Résumé de présence</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-blue-600 mb-1">Jours présents</div>
                    <div className="text-2xl font-bold text-gray-900">{payslip.attendance_summary.present_days}</div>
                    <div className="text-xs text-gray-500">sur {payslip.attendance_summary.total_days} jours</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-green-600 mb-1">Taux présence</div>
                    <div className="text-2xl font-bold text-gray-900">{payslip.attendance_summary.attendance_rate}%</div>
                    <div className="text-xs text-gray-500">Performance</div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="text-sm text-yellow-600 mb-1">Heures totales</div>
                    <div className="text-2xl font-bold text-gray-900">{payslip.attendance_summary.total_hours_worked.toFixed(1)}</div>
                    <div className="text-xs text-gray-500">heures travaillées</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="text-sm text-red-600 mb-1">Absences</div>
                    <div className="text-2xl font-bold text-gray-900">{payslip.attendance_summary.absent_days}</div>
                    <div className="text-xs text-gray-500">jours absents</div>
                  </div>
                </div>
              </div>

              {/* Gains et déductions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Gains */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Gains</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-gray-700">Salaire de base</span>
                      <span className="font-bold text-green-700">{formatCurrency(payslip.earnings.base_salary)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-gray-700">Bonus fixe</span>
                      <span className="font-bold text-green-700">{formatCurrency(payslip.earnings.bonus_fixed)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-gray-700">Heures supplémentaires</span>
                      <span className="font-bold text-green-700">{formatCurrency(payslip.earnings.overtime)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border-t-2 border-green-200">
                      <span className="font-semibold text-gray-900">Total gains</span>
                      <span className="font-bold text-green-700 text-lg">{formatCurrency(payslip.earnings.total_earnings)}</span>
                    </div>
                  </div>
                </div>

                {/* Déductions */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Déductions</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                      <span className="text-gray-700">Impôts ({payslip.breakdown.tax_rate}%)</span>
                      <span className="font-bold text-red-700">{formatCurrency(payslip.deductions.tax)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                      <span className="text-gray-700">Sécurité sociale ({payslip.breakdown.social_security_rate}%)</span>
                      <span className="font-bold text-red-700">{formatCurrency(payslip.deductions.social_security)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                      <span className="text-gray-700">Autres déductions</span>
                      <span className="font-bold text-red-700">{formatCurrency(payslip.deductions.other_deductions)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border-t-2 border-red-200">
                      <span className="font-semibold text-gray-900">Total déductions</span>
                      <span className="font-bold text-red-700 text-lg">{formatCurrency(payslip.deductions.total_deductions)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Colonne droite - Résumé */}
        <div className="space-y-6">
          {/* Résumé paiement */}
          <Card className="sticky top-6">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Résumé du paiement</h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Salaire brut:</span>
                  <span className="font-medium">{formatCurrency(payslip.summary.gross_salary)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total déductions:</span>
                  <span className="font-medium text-red-600">{formatCurrency(payslip.summary.total_deductions)}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold text-gray-900">Net à payer:</span>
                    <span className="font-bold text-green-600">{formatCurrency(payslip.summary.net_salary)}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {payslip.summary.currency}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Taux horaire:</span>
                  <span className="font-medium">{formatCurrency(payslip.breakdown.hourly_rate)}/h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Taux journalier:</span>
                  <span className="font-medium">{formatCurrency(payslip.breakdown.daily_rate)}/jour</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="text-center">
                  <div className="mb-3">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                  </div>
                  <p className="text-sm text-gray-600">
                    Cette fiche de paie a été générée le {formatDate(payslip.metadata.generated_at)}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Informations complémentaires */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations complémentaires</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Coordonnées bancaires</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Méthode: {payslip.summary.payment_method}</div>
                    <div>Devise: {payslip.summary.currency}</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Statistiques du mois</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Jours de retard: {payslip.attendance_summary.late_days}</div>
                    <div>Départs anticipés: {payslip.attendance_summary.early_leave_days}</div>
                    <div>Heures moyennes/jour: {payslip.attendance_summary.avg_daily_hours.toFixed(2)}h</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Identifiants</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>ID fiche: {payslip.metadata.payslip_id}</div>
                    <div>Version: {payslip.metadata.version}</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Boutons d'action */}
          <div className="flex flex-col gap-2">
            <Button onClick={() => handleDownload('pdf')} variant="primary" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Télécharger PDF
            </Button>
            <Button onClick={handlePrint} variant="outline" className="w-full">
              <Printer className="w-4 h-4 mr-2" />
              Imprimer la fiche
            </Button>
            <Button onClick={handleSendEmail} variant="outline" className="w-full">
              <Mail className="w-4 h-4 mr-2" />
              Envoyer par email
            </Button>
            {onClose && (
              <Button onClick={onClose} variant="ghost" className="w-full text-gray-600">
                Retour
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-gray-200 text-center">
        <div className="text-sm text-gray-500 space-y-1">
          <p>{payslip.company_info.name} • {payslip.company_info.siret}</p>
          <p>{payslip.company_info.address} • Téléphone: {payslip.company_info.phone}</p>
          <p className="text-xs mt-4">
            Ce document est confidentiel et destiné uniquement à l'employé concerné.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PayslipViewer;
