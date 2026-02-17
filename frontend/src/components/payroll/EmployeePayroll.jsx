// frontend/src/components/payroll/EmployeePayroll.jsx 
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './EmployeePayroll.css';

const EmployeePayroll = () => {
    const [data, setData] = useState({
        payslips: [],
        latestPayslip: null,
        config: null,
        loading: true,
        error: null
    });

    const [selectedMonth, setSelectedMonth] = useState('');
    const [showDetails, setShowDetails] = useState(false);
    const [selectedPayslip, setSelectedPayslip] = useState(null);

    const API_URL = 'http://localhost:5000/api/payroll';
    const token = localStorage.getItem('token');

    useEffect(() => {
        fetchPayrollData();
    }, []);

    const fetchPayrollData = async () => {
        try {
            setData(prev => ({ ...prev, loading: true, error: null }));
            
            // Récupérer toutes les données en parallèle
            const [payslipsRes, latestRes, configRes] = await Promise.all([
                axios.get(`${API_URL}/my-payslips`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                axios.get(`${API_URL}/my-latest-payslip`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                axios.get(`${API_URL}/my-salary-config`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            setData({
                payslips: payslipsRes.data.data || [],
                latestPayslip: latestRes.data.data,
                config: configRes.data.data,
                loading: false,
                error: null
            });

            if (payslipsRes.data.data?.length > 0) {
                setSelectedMonth(payslipsRes.data.data[0].month_year);
            }

        } catch (error) {
            console.error('Erreur récupération données paie:', error);
            setData({
                payslips: [],
                latestPayslip: null,
                config: null,
                loading: false,
                error: error.response?.data?.message || 'Erreur de connexion au serveur'
            });
        }
    };

    const handleDownloadPayslip = async (monthYear, format = 'pdf') => {
        try {
            const response = await axios.get(
                `${API_URL}/my-payslips/${monthYear}/download/${format}`,
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                    responseType: 'blob'
                }
            );
            
            // Créer un lien de téléchargement
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `fiche_paie_${monthYear}.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            
            // Nettoyer l'URL
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Erreur téléchargement:', error);
            alert('Erreur lors du téléchargement de la fiche de paie');
        }
    };

    const handleViewDetails = (payslip) => {
        setSelectedPayslip(payslip);
        setShowDetails(true);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('fr-TN', {
            style: 'currency',
            currency: 'TND',
            minimumFractionDigits: 2
        }).format(amount || 0);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    };

    if (data.loading) {
        return (
            <div className="payroll-loading">
                <div className="spinner"></div>
                <p>Chargement de vos données de paie...</p>
            </div>
        );
    }

    if (data.error) {
        return (
            <div className="payroll-error">
                <div className="error-icon">⚠️</div>
                <h3>Impossible de charger les données</h3>
                <p>{data.error}</p>
                <button 
                    className="btn-retry"
                    onClick={fetchPayrollData}
                >
                    Réessayer
                </button>
            </div>
        );
    }

    return (
        <div className="employee-payroll-container">
            {/* En-tête */}
            <div className="payroll-header">
                <h1>Mes fiches de paie</h1>
                <p>Consultez et téléchargez vos fiches de paie</p>
            </div>

            {/* Configuration salariale */}
            {data.config && (
                <div className="salary-config-card">
                    <div className="card-header">
                        <h2>💰 Configuration salariale</h2>
                        <span className="config-status">Active</span>
                    </div>
                    <div className="config-details">
                        <div className="config-row">
                            <div className="config-item">
                                <label>Salaire de base</label>
                                <div className="config-value highlight">
                                    {formatCurrency(data.config.salary_config.base_salary)}
                                </div>
                            </div>
                            <div className="config-item">
                                <label>Net mensuel estimé</label>
                                <div className="config-value highlight">
                                    {formatCurrency(data.config.estimates.monthly.net_salary)}
                                </div>
                            </div>
                            <div className="config-item">
                                <label>Taux d'imposition</label>
                                <div className="config-value">
                                    {data.config.salary_config.tax_rate}%
                                </div>
                            </div>
                        </div>
                        <div className="config-row">
                            <div className="config-item">
                                <label>Méthode de paiement</label>
                                <div className="config-value">
                                    {data.config.salary_config.payment_method}
                                </div>
                            </div>
                            <div className="config-item">
                                <label>Banque</label>
                                <div className="config-value">
                                    {data.config.salary_config.bank_details?.bank_name || 'Non spécifié'}
                                </div>
                            </div>
                            <div className="config-item">
                                <label>Date d'embauche</label>
                                <div className="config-value">
                                    {formatDate(data.config.employee.hire_date)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Dernière fiche de paie */}
            {data.latestPayslip && (
                <div className="latest-payslip-card">
                    <div className="card-header">
                        <h2>📄 Dernier paiement</h2>
                        <div className="payment-badge paid">
                            {data.latestPayslip.status.payment_status === 'paid' ? 'Payé' : 'En attente'}
                        </div>
                    </div>
                    <div className="latest-payslip-content">
                        <div className="payslip-info">
                            <div className="info-item">
                                <label>Période</label>
                                <div className="info-value">
                                    {data.latestPayslip.period.month_name}
                                </div>
                            </div>
                            <div className="info-item">
                                <label>Date de paiement</label>
                                <div className="info-value">
                                    {formatDate(data.latestPayslip.period.payment_date)}
                                </div>
                            </div>
                            <div className="info-item">
                                <label>Département</label>
                                <div className="info-value">
                                    {data.latestPayslip.employee.department}
                                </div>
                            </div>
                        </div>
                        <div className="payslip-amount">
                            <div className="net-amount">
                                <label>Net à payer</label>
                                <div className="amount-value">
                                    {formatCurrency(data.latestPayslip.salary.net_salary)}
                                </div>
                            </div>
                            <div className="action-buttons">
                                <button 
                                    className="btn-primary"
                                    onClick={() => handleDownloadPayslip(data.latestPayslip.period.month_year, 'pdf')}
                                >
                                    📥 Télécharger PDF
                                </button>
                                <button 
                                    className="btn-secondary"
                                    onClick={() => handleViewDetails(data.latestPayslip)}
                                >
                                    📋 Voir détails
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Historique des fiches de paie */}
            <div className="payslip-history-section">
                <div className="section-header">
                    <h2>📋 Historique des paiements</h2>
                    <div className="stats-badge">
                        {data.payslips.length} fiches
                    </div>
                </div>

                {data.payslips.length === 0 ? (
                    <div className="empty-history">
                        <div className="empty-icon">📄</div>
                        <p>Aucune fiche de paie disponible</p>
                    </div>
                ) : (
                    <div className="payslip-table-container">
                        <table className="payslip-table">
                            <thead>
                                <tr>
                                    <th>Mois</th>
                                    <th>Salaire brut</th>
                                    <th>Salaire net</th>
                                    <th>Statut</th>
                                    <th>Email envoyé</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.payslips.map((payslip, index) => (
                                    <tr key={index} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                                        <td className="month-cell">
                                            <div className="month-name">{payslip.month_name}</div>
                                            <div className="month-year">{payslip.month_year}</div>
                                        </td>
                                        <td className="amount-cell">
                                            {formatCurrency(payslip.base_salary)}
                                        </td>
                                        <td className="amount-cell net-cell">
                                            <strong>{formatCurrency(payslip.net_salary)}</strong>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${payslip.payment_status}`}>
                                                {payslip.payment_status === 'paid' ? 'Payé' : 
                                                 payslip.payment_status === 'pending' ? 'En attente' : 
                                                 payslip.payment_status}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`email-status ${payslip.email_sent ? 'sent' : 'not-sent'}`}>
                                                {payslip.email_sent ? 
                                                    <span className="sent-status">
                                                        ✓ {formatDate(payslip.email_sent_at)}
                                                    </span> : 
                                                    <span className="not-sent-status">Non envoyé</span>
                                                }
                                            </span>
                                        </td>
                                        <td className="actions-cell">
                                            <div className="action-buttons">
                                                <button 
                                                    className="btn-icon"
                                                    title="Télécharger PDF"
                                                    onClick={() => handleDownloadPayslip(payslip.month_year, 'pdf')}
                                                >
                                                    📄
                                                </button>
                                                <button 
                                                    className="btn-icon"
                                                    title="Télécharger Excel"
                                                    onClick={() => handleDownloadPayslip(payslip.month_year, 'excel')}
                                                >
                                                    📊
                                                </button>
                                                <button 
                                                    className="btn-icon"
                                                    title="Voir détails"
                                                    onClick={() => handleViewDetails(payslip)}
                                                >
                                                    👁️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Résumé statistique */}
                {data.payslips.length > 0 && (
                    <div className="summary-stats">
                        <div className="stat-item">
                            <div className="stat-label">Total perçu</div>
                            <div className="stat-value">
                                {formatCurrency(data.payslips.reduce((sum, p) => sum + (parseFloat(p.net_salary) || 0), 0))}
                            </div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-label">Moyenne mensuelle</div>
                            <div className="stat-value">
                                {formatCurrency(data.payslips.reduce((sum, p) => sum + (parseFloat(p.net_salary) || 0), 0) / data.payslips.length)}
                            </div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-label">Paiements payés</div>
                            <div className="stat-value">
                                {data.payslips.filter(p => p.payment_status === 'paid').length} / {data.payslips.length}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de détails */}
            {showDetails && selectedPayslip && (
                <div className="modal-overlay" onClick={() => setShowDetails(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Détails de la fiche de paie</h3>
                            <button 
                                className="modal-close"
                                onClick={() => setShowDetails(false)}
                            >
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="payslip-details">
                                <div className="detail-section">
                                    <h4>Informations employé</h4>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <label>Nom</label>
                                            <div>{selectedPayslip.employee?.name || `${selectedPayslip.first_name} ${selectedPayslip.last_name}`}</div>
                                        </div>
                                        <div className="detail-item">
                                            <label>Matricule</label>
                                            <div>{selectedPayslip.employee_id}</div>
                                        </div>
                                        <div className="detail-item">
                                            <label>Département</label>
                                            <div>{selectedPayslip.employee?.department || selectedPayslip.department}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="detail-section">
                                    <h4>Détails du paiement</h4>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <label>Salaire brut</label>
                                            <div>{formatCurrency(selectedPayslip.base_salary)}</div>
                                        </div>
                                        <div className="detail-item">
                                            <label>Impôts</label>
                                            <div className="negative">{formatCurrency(selectedPayslip.tax_amount)}</div>
                                        </div>
                                        <div className="detail-item">
                                            <label>Autres retenues</label>
                                            <div className="negative">{formatCurrency(selectedPayslip.deduction_amount)}</div>
                                        </div>
                                        <div className="detail-item">
                                            <label>Salaire net</label>
                                            <div className="positive highlight">{formatCurrency(selectedPayslip.net_salary)}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="detail-section">
                                    <h4>Statut</h4>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <label>Statut paiement</label>
                                            <div>
                                                <span className={`status-badge ${selectedPayslip.payment_status}`}>
                                                    {selectedPayslip.payment_status === 'paid' ? 'Payé' : selectedPayslip.payment_status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="detail-item">
                                            <label>Date de paiement</label>
                                            <div>{formatDate(selectedPayslip.payment_date)}</div>
                                        </div>
                                        <div className="detail-item">
                                            <label>Email envoyé</label>
                                            <div>
                                                {selectedPayslip.email_sent ? 
                                                    <span className="positive">✓ {formatDate(selectedPayslip.email_sent_at)}</span> : 
                                                    <span className="negative">Non envoyé</span>
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button 
                                className="btn-secondary"
                                onClick={() => setShowDetails(false)}
                            >
                                Fermer
                            </button>
                            <button 
                                className="btn-primary"
                                onClick={() => {
                                    handleDownloadPayslip(selectedPayslip.month_year, 'pdf');
                                    setShowDetails(false);
                                }}
                            >
                                Télécharger PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeePayroll;// JavaScript source code
