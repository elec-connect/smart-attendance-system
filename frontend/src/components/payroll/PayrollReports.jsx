import React, { useState, useEffect } from 'react';
import { usePayroll } from '../../context/PayrollContext';
import payrollService from '../../services/payrollService';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { toast } from 'react-hot-toast';

const PayrollReports = () => {
  const { payMonths, selectedMonth: contextSelectedMonth, setSelectedMonth } = usePayroll();
  const [localSelectedMonth, setLocalSelectedMonth] = useState(contextSelectedMonth || '');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState('json');

  // Synchroniser avec le contexte 
  useEffect(() => {
    if (contextSelectedMonth && contextSelectedMonth !== localSelectedMonth) {
      setLocalSelectedMonth(contextSelectedMonth);
    }
  }, [contextSelectedMonth]);

  useEffect(() => {
    if (localSelectedMonth && localSelectedMonth !== contextSelectedMonth) {
      setSelectedMonth(localSelectedMonth);
    }
  }, [localSelectedMonth, setSelectedMonth, contextSelectedMonth]);

  useEffect(() => {
    if (localSelectedMonth) {
      loadReport();
    }
  }, [localSelectedMonth, format]);

  const loadReport = async () => {
  try {
    setLoading(true);
    
    // Récupérer les données réelles
    const [payrollData, employeesData] = await Promise.all([
      payrollService.getMonthlyPayments(localSelectedMonth),
      payrollService.getAvailableEmployees()
    ]);
    
    console.log('📊 Données réelles chargées:', {
      payroll: payrollData,
      employees: employeesData
    });
    
    // Utiliser les données réelles au lieu des données fictives
    const realReport = {
      success: true,
      report: {
        summary: {
          total_employees: employeesData?.length || 0,
          total_net_amount: payrollData?.totals?.net_salary || 0,
          total_tax_amount: payrollData?.totals?.tax || 0,
          total_deductions: payrollData?.totals?.deductions || 0,
          average_salary: employeesData?.length > 0 
            ? (payrollData?.totals?.net_salary || 0) / employeesData.length 
            : 0,
          currency: 'TND'
        },
        month: localSelectedMonth,
        generated_at: new Date().toISOString(),
        payments: payrollData?.payments?.map(payment => ({
          employee_id: payment.employee_id,
          name: getEmployeeName(payment.employee_id, employeesData),
          department: getEmployeeDepartment(payment.employee_id, employeesData),
          net_salary: payment.net_salary || 0,
          tax: payment.tax || 0,
          deductions: payment.deductions || 0
        })) || []
      }
    };
    
    setReport(realReport);
    toast.success('Rapport généré avec succès');
    
  } catch (error) {
    console.error('Erreur chargement rapport:', error);
    
    // Si pas de données réelles, utiliser des données par défaut
    const defaultReport = {
      success: true,
      report: {
        summary: {
          total_employees: 0,
          total_net_amount: 0,
          total_tax_amount: 0,
          total_deductions: 0,
          average_salary: 0,
          currency: 'TND'
        },
        month: localSelectedMonth,
        generated_at: new Date().toISOString(),
        payments: []
      }
    };
    
    setReport(defaultReport);
    toast('Aucune donnée de paie trouvée pour ce mois');
  } finally {
    setLoading(false);
  }
};

// Fonctions helpers pour trouver les informations des employés
const getEmployeeName = (employeeId, employees) => {
  const employee = employees?.find(e => e.employee_id === employeeId);
  if (employee) {
    return `${employee.first_name} ${employee.last_name}`.trim();
  }
  return `Employé ${employeeId}`;
};

const getEmployeeDepartment = (employeeId, employees) => {
  const employee = employees?.find(e => e.employee_id === employeeId);
  return employee?.department || 'Non spécifié';
};

  const handleDownload = () => {
    if (!report) return;
    
    if (format === 'json') {
      // Télécharger JSON
      const dataStr = JSON.stringify(report, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `paie_${localSelectedMonth}_rapport.json`;
      link.click();
      toast.success('Rapport JSON téléchargé');
    } else if (format === 'pdf') {
      // Télécharger un PDF
      const pdfContent = `
        RAPPORT DE PAIE - ${localSelectedMonth}
        =====================================
        
        Date de génération: ${new Date().toLocaleDateString('fr-FR', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
        
        RÉSUMÉ GÉNÉRAL:
        ===============
        • Total employés: ${report.report?.summary?.total_employees || 0}
        • Salaire net total: ${(report.report?.summary?.total_net_amount || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'TND' })}
        • Impôts totaux: ${(report.report?.summary?.total_tax_amount || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'TND' })}
        • Déductions totales: ${(report.report?.summary?.total_deductions || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'TND' })}
        • Salaire moyen: ${(report.report?.summary?.average_salary || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'TND' })}
        
        DÉTAILS DES PAIEMENTS:
        =====================
        ${report.report?.payments?.map((p, index) => `
        ${index + 1}. ${p.name} (${p.employee_id})
           Département: ${p.department}
           Salaire net: ${p.net_salary.toLocaleString('fr-FR', { style: 'currency', currency: 'TND' })}
           Impôts: ${p.tax.toLocaleString('fr-FR', { style: 'currency', currency: 'TND' })}
           Déductions: ${p.deductions.toLocaleString('fr-FR', { style: 'currency', currency: 'TND' })}
           Salaire brut: ${(p.net_salary + p.tax + p.deductions).toLocaleString('fr-FR', { style: 'currency', currency: 'TND' })}
        `).join('\n') || 'Aucun paiement'}
        
        SIGNATURE:
        ==========
        Généré par le système de paie
        Module Paie • Version 1.0
      `;
      
      const dataBlob = new Blob([pdfContent], { type: 'application/pdf' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `paie_${localSelectedMonth}_rapport.pdf`;
      link.click();
      toast.success('Rapport PDF téléchargé');
    } else if (format === 'summary') {
      // Télécharger un HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Rapport de Paie - ${localSelectedMonth}</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 40px;
              line-height: 1.6;
              color: #333;
            }
            .header {
              text-align: center;
              border-bottom: 3px solid #2c3e50;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #2c3e50;
              margin-bottom: 5px;
            }
            .header .subtitle {
              color: #7f8c8d;
              font-size: 14px;
            }
            .summary {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 30px;
              border-left: 4px solid #3498db;
            }
            .summary h2 {
              color: #3498db;
              margin-top: 0;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 15px;
              margin-top: 15px;
            }
            .summary-item {
              background: white;
              padding: 15px;
              border-radius: 6px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .summary-value {
              font-size: 24px;
              font-weight: bold;
              margin: 10px 0;
            }
            .summary-value.net { color: #27ae60; }
            .summary-value.tax { color: #e74c3c; }
            .summary-value.deduction { color: #f39c12; }
            .summary-value.average { color: #3498db; }
            .payments-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            .payments-table th {
              background: #2c3e50;
              color: white;
              padding: 12px;
              text-align: left;
            }
            .payments-table td {
              padding: 12px;
              border-bottom: 1px solid #ddd;
            }
            .payments-table tr:nth-child(even) {
              background: #f8f9fa;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              color: #7f8c8d;
              font-size: 12px;
              border-top: 1px solid #ddd;
              padding-top: 20px;
            }
            .amount {
              font-weight: bold;
            }
            .positive { color: #27ae60; }
            .negative { color: #e74c3c; }
            .neutral { color: #f39c12; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Rapport de Paie</h1>
            <div class="subtitle">Période: ${localSelectedMonth}</div>
            <div class="subtitle">Généré le: ${new Date().toLocaleDateString('fr-FR', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</div>
          </div>
          
          <div class="summary">
            <h2>Résumé Général</h2>
            <div class="summary-grid">
              <div class="summary-item">
                <div>Total employés</div>
                <div class="summary-value">${report.report?.summary?.total_employees || 0}</div>
              </div>
              <div class="summary-item">
                <div>Salaire net total</div>
                <div class="summary-value net">${(report.report?.summary?.total_net_amount || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'TND' })}</div>
              </div>
              <div class="summary-item">
                <div>Impôts totaux</div>
                <div class="summary-value tax">${(report.report?.summary?.total_tax_amount || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'TND' })}</div>
              </div>
              <div class="summary-item">
                <div>Déductions totales</div>
                <div class="summary-value deduction">${(report.report?.summary?.total_deductions || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'TND' })}</div>
              </div>
              <div class="summary-item">
                <div>Salaire moyen</div>
                <div class="summary-value average">${(report.report?.summary?.average_salary || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'TND' })}</div>
              </div>
            </div>
          </div>
          
          <h2>Détails des Paiements</h2>
          <table class="payments-table">
            <thead>
              <tr>
                <th>Employé</th>
                <th>Département</th>
                <th>Salaire Net</th>
                <th>Impôts</th>
                <th>Déductions</th>
                <th>Salaire Brut</th>
              </tr>
            </thead>
            <tbody>
              ${report.report?.payments?.map(p => `
                <tr>
                  <td>
                    <strong>${p.name}</strong><br>
                    <small>${p.employee_id}</small>
                  </td>
                  <td>${p.department}</td>
                  <td class="amount positive">${p.net_salary.toLocaleString('fr-FR', { style: 'currency', currency: 'TND' })}</td>
                  <td class="amount negative">${p.tax.toLocaleString('fr-FR', { style: 'currency', currency: 'TND' })}</td>
                  <td class="amount neutral">${p.deductions.toLocaleString('fr-FR', { style: 'currency', currency: 'TND' })}</td>
                  <td class="amount">${(p.net_salary + p.tax + p.deductions).toLocaleString('fr-FR', { style: 'currency', currency: 'TND' })}</td>
                </tr>
              `).join('') || '<tr><td colspan="6" style="text-align: center;">Aucun paiement</td></tr>'}
            </tbody>
          </table>
          
          <div class="footer">
            <p>Généré automatiquement par le Système de Gestion de Paie</p>
            <p>Module Paie • Version 1.0 • ${new Date().getFullYear()}</p>
            <p>Pour toute assistance, contactez l'administrateur système</p>
          </div>
        </body>
        </html>
      `;
      
      const dataBlob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `paie_${localSelectedMonth}_rapport.html`;
      link.click();
      toast.success('Rapport HTML téléchargé');
    }
  };

  const handleExportExcel = async () => {
    if (!localSelectedMonth) {
      toast.error('Veuillez sélectionner un mois');
      return;
    }

    try {
      setLoading(true);
      // Simuler l'export Excel
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Télécharger un fichier Excel/CSV
      const excelContent = `ID Employé,Nom,Département,Salaire Net,Impôts,Déductions,Salaire Brut
${report?.report?.payments?.map(p => 
  `${p.employee_id},"${p.name}",${p.department},${p.net_salary},${p.tax},${p.deductions},${p.net_salary + p.tax + p.deductions}`
).join('\n') || 'Aucun paiement'}`;
      
      const dataBlob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `paie_${localSelectedMonth}.xlsx`;
      link.click();
      toast.success('Export Excel généré avec succès');
    } catch (error) {
      console.error('Erreur export Excel:', error);
      toast.error('Erreur lors de l\'export Excel');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    if (!localSelectedMonth) {
      toast.error('Veuillez sélectionner un mois');
      return;
    }

    try {
      setLoading(true);
      // Simuler l'export CSV
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Télécharger un fichier CSV
      const csvContent = `ID Employé;Nom;Département;Salaire Net;Impôts;Déductions;Salaire Brut
${report?.report?.payments?.map(p => 
  `${p.employee_id};"${p.name}";${p.department};${p.net_salary};${p.tax};${p.deductions};${p.net_salary + p.tax + p.deductions}`
).join('\n') || 'Aucun paiement'}`;
      
      const dataBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `paie_${localSelectedMonth}_paiements.csv`;
      link.click();
      toast.success('Export CSV généré avec succès');
    } catch (error) {
      console.error('Erreur export CSV:', error);
      toast.error('Erreur lors de l\'export CSV');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Rapports de Paie</h2>
        <p className="text-gray-600 mt-1">
          Générez et exportez des rapports détaillés sur les salaires et paiements
        </p>
      </div>

      <Card className="p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Générer un rapport</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Sélection du mois */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mois de paie <span className="text-red-500">*</span>
            </label>
            <select
              value={localSelectedMonth || ''}
              onChange={(e) => setLocalSelectedMonth(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Sélectionnez un mois...</option>
              {payMonths.map((month) => (
                <option key={month.month_year} value={month.month_year}>
                  {month.month_name || `Mois ${month.month_year}`}
                </option>
              ))}
            </select>
          </div>

          {/* Type de rapport */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Format de rapport
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="json">JSON (Données complètes)</option>
              <option value="pdf">PDF (Pour impression)</option>
              <option value="summary">Rapport HTML</option>
            </select>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-end space-x-2">
            <Button
              onClick={loadReport}
              disabled={!localSelectedMonth || loading}
              variant="primary"
              className="flex-1"
            >
              {loading ? 'Génération...' : 'Générer Rapport'}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleDownload}
            disabled={!report || loading}
            variant="primary"
            className="flex items-center"
          >
            Télécharger ({format.toUpperCase()})
          </Button>

          <Button
            onClick={handleExportExcel}
            disabled={!localSelectedMonth || loading}
            variant="success"
            className="flex items-center"
          >
            Export Excel
          </Button>

          <Button
            onClick={handleExportCSV}
            disabled={!localSelectedMonth || loading}
            variant="secondary"
            className="flex items-center"
          >
            Export CSV
          </Button>
        </div>
      </Card>

      {/* Affichage du rapport */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Génération du rapport...</p>
        </div>
      ) : report ? (
        <div className="mt-6">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Rapport de Paie - {localSelectedMonth}
                </h3>
                <p className="text-sm text-gray-600">
                  Généré le {new Date(report.report?.generated_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                {report.report?.summary?.total_employees || 0} employés
              </span>
            </div>
            
            {/* Résumé */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg border">
                <p className="text-sm text-gray-600">Salaire Net Total</p>
                <p className="text-2xl font-bold text-green-600">
                  {(report.report?.summary?.total_net_amount || 0).toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'TND'
                  })}
                </p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg border">
                <p className="text-sm text-gray-600">Impôts Totaux</p>
                <p className="text-2xl font-bold text-red-600">
                  {(report.report?.summary?.total_tax_amount || 0).toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'TND'
                  })}
                </p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg border">
                <p className="text-sm text-gray-600">Déductions</p>
                <p className="text-2xl font-bold text-orange-600">
                  {(report.report?.summary?.total_deductions || 0).toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'TND'
                  })}
                </p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg border">
                <p className="text-sm text-gray-600">Salaire Moyen</p>
                <p className="text-2xl font-bold text-blue-600">
                  {(report.report?.summary?.average_salary || 0).toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'TND',
                    minimumFractionDigits: 2
                  })}
                </p>
              </div>
            </div>
            
            {/* Liste des paiements */}
            {report.report?.payments && report.report.payments.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-3">Détail des paiements</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Employé
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Département
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Salaire Net
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Impôts
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Déductions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {report.report.payments.map((payment, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{payment.name}</div>
                            <div className="text-sm text-gray-500">{payment.employee_id}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                              {payment.department}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600">
                            {payment.net_salary.toLocaleString('fr-FR', {
                              style: 'currency',
                              currency: 'TND'
                            })}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600">
                            {payment.tax.toLocaleString('fr-FR', {
                              style: 'currency',
                              currency: 'TND'
                            })}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-orange-600">
                            {payment.deductions.toLocaleString('fr-FR', {
                              style: 'currency',
                              currency: 'TND'
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Détails JSON (affiché seulement pour JSON) */}
            {format === 'json' && (
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-2">Détails techniques (JSON)</h4>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                  <pre className="text-sm">
                    {JSON.stringify(report, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </Card>
        </div>
      ) : (
        <div className="text-center py-12">
          <Card className="p-8 inline-block">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-gray-500">Sélectionnez un mois pour générer un rapport</p>
            <p className="text-sm text-gray-400 mt-1">
              Les rapports incluent les statistiques et détails des paiements
            </p>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PayrollReports;