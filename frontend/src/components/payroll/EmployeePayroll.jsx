// frontend/src/components/payroll/EmployeePayroll.jsx handleDownloadPayslip  
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

    // ==================== FONCTIONS UTILITAIRES ====================

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('fr-TN', {
            style: 'currency',
            currency: 'TND',
            minimumFractionDigits: 2,
            maximumFractionDigits: 3
        }).format(amount || 0);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        try {
            return new Date(dateString).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
        } catch (error) {
            return '-';
        }
    };

    // ==================== NORMALISATION DES DONNÉES ====================

    const normalizePayslip = (payslip) => {
        if (!payslip) return null;
        
        console.log('🔄 Normalisation fiche de paie:', payslip);
        
        // Extraction sécurisée des données
        const employeeId = payslip.employee_id || payslip.employee?.id || 'N/A';
        const monthYear = payslip.month_year || 'N/A';
        const monthName = payslip.month_name || 
                         payslip.period?.month_name || 
                         monthYear;
        
        return {
            // Identifiants
            id: payslip.id || null,
            employee_id: employeeId,
            month_year: monthYear,
            month_name: monthName,
            
            // Salaires
            base_salary: parseFloat(payslip.base_salary || 0),
            gross_salary: parseFloat(payslip.gross_salary || 0),
            net_salary: parseFloat(payslip.net_salary || 0),
            tax_amount: parseFloat(payslip.tax_amount || 0),
            deduction_amount: parseFloat(payslip.deduction_amount || 0),
            overtime_amount: parseFloat(payslip.overtime_amount || 0),
            bonus_amount: parseFloat(payslip.bonus_amount || 0),
            
            // Présence
            days_present: parseInt(payslip.days_present || 0),
            total_hours_worked: parseFloat(payslip.total_hours_worked || 0),
            
            // Statut
            payment_status: payslip.payment_status || 'pending',
            payment_date: payslip.payment_date || null,
            
            // Email
            email_sent: payslip.email_sent || false,
            email_sent_at: payslip.email_sent_at || null,
            
            // Informations employé (normalisées)
            first_name: payslip.first_name || payslip.employee?.first_name || '',
            last_name: payslip.last_name || payslip.employee?.last_name || '',
            department: payslip.department || 
                       payslip.employee?.department || 
                       'Non spécifié',
            position: payslip.position || 
                      payslip.employee?.position || 
                      'Non spécifié',
            email: payslip.email || 
                   payslip.employee?.email || '',
            
            // Données calculées
            full_name: `${payslip.first_name || payslip.employee?.first_name || ''} ${payslip.last_name || payslip.employee?.last_name || ''}`.trim() || 'Employé',
            
            // Résumé
            summary: {
                gross: `${parseFloat(payslip.gross_salary || 0).toFixed(2)} TND`,
                net: `${parseFloat(payslip.net_salary || 0).toFixed(2)} TND`,
                days: parseInt(payslip.days_present || 0),
                hours: parseFloat(payslip.total_hours_worked || 0).toFixed(2),
                status: payslip.payment_status === 'paid' ? 'Payé' : 
                        payslip.payment_status === 'pending' ? 'En attente' : 
                        payslip.payment_status === 'calculated' ? 'Calculé' : 'Inconnu'
            }
        };
    };

    const normalizeSalaryConfig = (config) => {
        if (!config) return null;
        
        console.log('🔄 Normalisation configuration salariale:', config);
        
        // Extraire les données employé
        const employee = config.employee || {};
        const salaryConfig = config.salary_config || {};
        const estimates = config.estimates || { monthly: {}, annual: {} };
        
        return {
            employee: {
                id: config.employee_id || employee.id || 'N/A',
                name: employee.name || config.name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Employé',
                department: employee.department || config.department || 'Non spécifié',
                position: employee.position || config.position || 'Non spécifié',
                hire_date: employee.hire_date || config.hire_date || null
            },
            salary_config: {
                base_salary: parseFloat(salaryConfig.base_salary || config.base_salary || 0),
                currency: salaryConfig.currency || config.currency || 'TND',
                tax_rate: parseFloat(salaryConfig.tax_rate || config.tax_rate || 0),
                social_security_rate: parseFloat(salaryConfig.social_security_rate || config.social_security_rate || 0),
                other_deductions: parseFloat(salaryConfig.other_deductions || config.other_deductions || 0),
                bonus_fixed: parseFloat(salaryConfig.bonus_fixed || config.bonus_fixed || 0),
                payment_method: salaryConfig.payment_method || config.payment_method || 'Virement bancaire',
                bank_details: {
                    bank_name: salaryConfig.bank_details?.bank_name || config.bank_name || 'Non spécifié',
                    bank_account: salaryConfig.bank_details?.bank_account || config.bank_account || 'Non spécifié',
                    iban: salaryConfig.bank_details?.iban || config.iban || 'Non spécifié'
                }
            },
            estimates: {
                monthly: {
                    gross_salary: parseFloat(estimates.monthly?.gross_salary || 0),
                    net_salary: parseFloat(estimates.monthly?.net_salary || 0),
                    total_deductions: parseFloat(estimates.monthly?.total_deductions || 0)
                },
                annual: {
                    gross_salary: parseFloat(estimates.annual?.gross_salary || 0),
                    net_salary: parseFloat(estimates.annual?.net_salary || 0)
                }
            }
        };
    };

    // ==================== CHARGEMENT DES DONNÉES ====================

    useEffect(() => {
        fetchPayrollData();
    }, []);

    const fetchPayrollData = async () => {
        try {
            setData(prev => ({ ...prev, loading: true, error: null }));
            
            console.log('📡 Chargement des données de paie...');
            
            // Récupérer toutes les données en parallèle
            const [payslipsRes, latestRes, configRes] = await Promise.all([
                axios.get(`${API_URL}/my-payslips`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).catch(err => {
                    console.warn('⚠️ Erreur récupération fiches:', err.response?.status);
                    return { data: { data: [] } };
                }),
                
                axios.get(`${API_URL}/my-latest-payslip`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).catch(err => {
                    console.warn('⚠️ Erreur récupération dernière fiche:', err.response?.status);
                    return { data: { data: null } };
                }),
                
                axios.get(`${API_URL}/my-salary-config`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).catch(err => {
                    console.warn('⚠️ Erreur récupération config:', err.response?.status);
                    return { data: { data: null } };
                })
            ]);

            console.log('✅ Données reçues:', {
                payslips: payslipsRes.data.data?.length || 0,
                latest: latestRes.data.data ? '✓' : '✗',
                config: configRes.data.data ? '✓' : '✗'
            });

            // Normaliser les données
            const normalizedPayslips = (payslipsRes.data.data || []).map(normalizePayslip);
            const normalizedLatest = normalizePayslip(latestRes.data.data);
            const normalizedConfig = normalizeSalaryConfig(configRes.data.data);

            setData({
                payslips: normalizedPayslips,
                latestPayslip: normalizedLatest,
                config: normalizedConfig,
                loading: false,
                error: null
            });

            if (normalizedPayslips.length > 0) {
                setSelectedMonth(normalizedPayslips[0].month_year);
            }

        } catch (error) {
            console.error('❌ Erreur récupération données paie:', error);
            setData({
                payslips: [],
                latestPayslip: null,
                config: null,
                loading: false,
                error: error.response?.data?.message || 'Erreur de connexion au serveur'
            });
        }
    };

    // ==================== ACTIONS ====================

    const handleDownloadPayslip = async (monthYear, format = 'pdf') => {
    try {
        console.log(`📥 Téléchargement fiche ${monthYear} en ${format}`);
        
        const response = await axios.get(
            `${API_URL}/my-payslips/${monthYear}/download/${format}`,
            {
                headers: { 'Authorization': `Bearer ${token}` },
                responseType: 'blob'
            }
        );
        
        // ✅ CORRECTION : Déterminer la bonne extension
        let fileExtension = format;
        if (format === 'excel') {
            fileExtension = 'xlsx';  // Remplacer 'excel' par 'xlsx'
        }
        
        // Créer un lien de téléchargement
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `fiche_paie_${monthYear}.${fileExtension}`);  // ← Utilise fileExtension
        document.body.appendChild(link);
        link.click();
        link.remove();
        
        // Nettoyer l'URL
        window.URL.revokeObjectURL(url);
        
        console.log('✅ Téléchargement réussi');
        
    } catch (error) {
        console.error('❌ Erreur téléchargement:', error);
        
        let errorMessage = 'Erreur lors du téléchargement';
        if (error.response?.status === 404) {
            errorMessage = 'Fiche de paie non trouvée';
        } else if (error.response?.status === 403) {
            errorMessage = 'Accès non autorisé';
        }
        
        alert(errorMessage);
    }
};

    const handleViewDetails = (payslip) => {
        setSelectedPayslip(payslip);
        setShowDetails(true);
    };

    // ==================== RENDU DES COMPOSANTS ====================

    const renderPaymentStatus = (status) => {
        const statusConfig = {
            'paid': { label: '✅ Payé', class: 'paid', icon: '✓' },
            'pending': { label: '⏳ En attente', class: 'pending', icon: '⏱️' },
            'calculated': { label: '📊 Calculé', class: 'calculated', icon: '📋' },
            'cancelled': { label: '❌ Annulé', class: 'cancelled', icon: '✗' }
        };
        
        const config = statusConfig[status] || { label: status || 'Inconnu', class: 'unknown', icon: '?' };
        
        return (
            <span className={`status-badge ${config.class}`}>
                {config.icon} {config.label}
            </span>
        );
    };

    const renderEmailStatus = (sent, sentAt) => {
        if (sent) {
            return (
                <span className="email-status sent" title={`Envoyé le ${formatDate(sentAt)}`}>
                    ✓ Envoyé
                </span>
            );
        }
        return (
            <span className="email-status not-sent" title="Email non envoyé">
                ✗ Non envoyé
            </span>
        );
    };

    // ==================== ÉTATS DE CHARGEMENT ====================

    if (data.loading) {
        return (
            <div className="payroll-loading">
                <div className="spinner"></div>
                <p>Chargement de vos données de paie...</p>
                <p className="loading-subtitle">Veuillez patienter</p>
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
                    🔄 Réessayer
                </button>
            </div>
        );
    }

    // ==================== RENDU PRINCIPAL ====================

    return (
        <div className="employee-payroll-container">
            {/* En-tête */}
            <div className="payroll-header">
                <h1>💰 Mes fiches de paie</h1>
                <p>Consultez et téléchargez vos fiches de paie</p>
                {data.payslips.length === 0 && (
                    <p className="header-note">
                        ℹ️ Les fiches de paie apparaîtront ici après le premier calcul de salaire
                    </p>
                )}
            </div>

            {/* Configuration salariale */}
            {data.config && (
                <div className="salary-config-card">
                    <div className="card-header">
                        <h2>⚙️ Configuration salariale</h2>
                        <span className="config-status active">Active</span>
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

            {/* Dernière fiche de paie - CORRIGÉ */}
            {data.latestPayslip && (
                <div className="latest-payslip-card">
                    <div className="card-header">
                        <h2>📄 Dernier paiement</h2>
                        {renderPaymentStatus(data.latestPayslip.payment_status)}
                    </div>
                    <div className="latest-payslip-content">
                        <div className="payslip-info">
                            <div className="info-item">
                                <label>Période</label>
                                <div className="info-value">
                                    {data.latestPayslip.month_name || data.latestPayslip.month_year}
                                </div>
                            </div>
                            <div className="info-item">
                                <label>Date de paiement</label>
                                <div className="info-value">
                                    {formatDate(data.latestPayslip.payment_date)}
                                </div>
                            </div>
                            <div className="info-item">
                                <label>Département</label>
                                <div className="info-value">
                                    {data.latestPayslip.department}
                                </div>
                            </div>
                            <div className="info-item">
                                <label>Jours travaillés</label>
                                <div className="info-value">
                                    {data.latestPayslip.days_present} jours
                                </div>
                            </div>
                        </div>
                        <div className="payslip-amount">
                            <div className="net-amount">
                                <label>Net à payer</label>
                                <div className="amount-value">
                                    {formatCurrency(data.latestPayslip.net_salary)}
                                </div>
                            </div>
                            <div className="action-buttons">
                                <button 
                                    className="btn-primary"
                                    onClick={() => handleDownloadPayslip(data.latestPayslip.month_year, 'pdf')}
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

            {/* Message si aucune fiche */}
            {!data.latestPayslip && data.payslips.length === 0 && (
                <div className="empty-state">
                    <div className="empty-icon">📄</div>
                    <h3>Aucune fiche de paie disponible</h3>
                    <p>Les fiches de paie apparaîtront ici après le premier calcul de salaire.</p>
                    <button 
                        className="btn-refresh"
                        onClick={fetchPayrollData}
                    >
                        🔄 Rafraîchir
                    </button>
                </div>
            )}

            {/* Historique des fiches de paie */}
            {data.payslips.length > 0 && (
                <div className="payslip-history-section">
                    <div className="section-header">
                        <h2>📋 Historique des paiements</h2>
                        <div className="stats-badge">
                            {data.payslips.length} fiche{data.payslips.length > 1 ? 's' : ''}
                        </div>
                    </div>

                    <div className="payslip-table-container">
                        <table className="payslip-table">
                            <thead>
                                <tr>
                                    <th>Période</th>
                                    <th>Salaire brut</th>
                                    <th>Salaire net</th>
                                    <th>Jours</th>
                                    <th>Statut</th>
                                    <th>Email</th>
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
                                        <td className="center-cell">
                                            {payslip.days_present}
                                        </td>
                                        <td>
                                            {renderPaymentStatus(payslip.payment_status)}
                                        </td>
                                        <td>
                                            {renderEmailStatus(payslip.email_sent, payslip.email_sent_at)}
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

                    {/* Résumé statistique */}
                    <div className="summary-stats">
                        <div className="stat-item">
                            <div className="stat-label">Total perçu</div>
                            <div className="stat-value">
                                {formatCurrency(data.payslips.reduce((sum, p) => sum + p.net_salary, 0))}
                            </div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-label">Moyenne mensuelle</div>
                            <div className="stat-value">
                                {formatCurrency(data.payslips.reduce((sum, p) => sum + p.net_salary, 0) / data.payslips.length)}
                            </div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-label">Paiements payés</div>
                            <div className="stat-value">
                                {data.payslips.filter(p => p.payment_status === 'paid').length} / {data.payslips.length}
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                                            <div>{selectedPayslip.full_name}</div>
                                        </div>
                                        <div className="detail-item">
                                            <label>Matricule</label>
                                            <div>{selectedPayslip.employee_id}</div>
                                        </div>
                                        <div className="detail-item">
                                            <label>Département</label>
                                            <div>{selectedPayslip.department}</div>
                                        </div>
                                        <div className="detail-item">
                                            <label>Poste</label>
                                            <div>{selectedPayslip.position}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="detail-section">
                                    <h4>Période</h4>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <label>Mois</label>
                                            <div>{selectedPayslip.month_name}</div>
                                        </div>
                                        <div className="detail-item">
                                            <label>Date de paiement</label>
                                            <div>{formatDate(selectedPayslip.payment_date)}</div>
                                        </div>
                                        <div className="detail-item">
                                            <label>Jours travaillés</label>
                                            <div>{selectedPayslip.days_present} jours</div>
                                        </div>
                                        <div className="detail-item">
                                            <label>Heures travaillées</label>
                                            <div>{selectedPayslip.total_hours_worked} heures</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="detail-section">
                                    <h4>Détails du paiement</h4>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <label>Salaire de base</label>
                                            <div>{formatCurrency(selectedPayslip.base_salary)}</div>
                                        </div>
                                        {selectedPayslip.overtime_amount > 0 && (
                                            <div className="detail-item">
                                                <label>Heures supplémentaires</label>
                                                <div className="positive">+ {formatCurrency(selectedPayslip.overtime_amount)}</div>
                                            </div>
                                        )}
                                        {selectedPayslip.bonus_amount > 0 && (
                                            <div className="detail-item">
                                                <label>Bonus</label>
                                                <div className="positive">+ {formatCurrency(selectedPayslip.bonus_amount)}</div>
                                            </div>
                                        )}
                                        <div className="detail-item">
                                            <label>Total gains</label>
                                            <div className="highlight">{formatCurrency(selectedPayslip.gross_salary)}</div>
                                        </div>
                                        <div className="detail-item">
                                            <label>Impôts</label>
                                            <div className="negative">- {formatCurrency(selectedPayslip.tax_amount)}</div>
                                        </div>
                                        {selectedPayslip.deduction_amount > 0 && (
                                            <div className="detail-item">
                                                <label>Autres retenues</label>
                                                <div className="negative">- {formatCurrency(selectedPayslip.deduction_amount)}</div>
                                            </div>
                                        )}
                                        <div className="detail-item total">
                                            <label>NET À PAYER</label>
                                            <div className="net-total">{formatCurrency(selectedPayslip.net_salary)}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="detail-section">
                                    <h4>Statut</h4>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <label>Statut paiement</label>
                                            <div>
                                                {renderPaymentStatus(selectedPayslip.payment_status)}
                                            </div>
                                        </div>
                                        <div className="detail-item">
                                            <label>Email envoyé</label>
                                            <div>
                                                {renderEmailStatus(selectedPayslip.email_sent, selectedPayslip.email_sent_at)}
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
                                📥 Télécharger PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeePayroll;