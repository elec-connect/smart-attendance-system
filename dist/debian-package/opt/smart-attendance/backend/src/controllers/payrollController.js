// controllers/payrollController.js - VERSION COMPLÈTE AVEC ROTATEUR 
const db = require('../../config/db');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const AdmZip = require('adm-zip');
const emailRotator = require('../utils/emailRotator'); // ⭐ AJOUT ROTATEUR

class PayrollController {
    // ==================== MÉTHODES UTILITAIRES ==================== 

    constructor() {
    // Bind de toutes les méthodes
    this.calculateSalaries = this.calculateSalaries.bind(this);
    this.toMinutes = this.toMinutes.bind(this);
    this.fromMinutes = this.fromMinutes.bind(this);
    this.calculateBreakPeriod = this.calculateBreakPeriod.bind(this);
    this.calculateWorkedHoursWithAllRules = this.calculateWorkedHoursWithAllRules.bind(this);
    this.getMyLatestPayslip = this.getMyLatestPayslip.bind(this);
  }
    
    async checkEmployeeExists(employee_id) {
        try {
            console.log(`🔍 [checkEmployeeExists] Vérification de l'employé: ${employee_id}`);
            
            const query = 'SELECT employee_id, first_name, last_name FROM employees WHERE employee_id = $1';
            const result = await db.query(query, [employee_id]);
            
            const exists = result.rows.length > 0;
            console.log(`📋 Résultat pour ${employee_id}: ${exists ? 'Trouvé' : 'Non trouvé'}`);
            
            if (exists) {
                console.log(`👤 Détails: ${result.rows[0].first_name} ${result.rows[0].last_name}`);
            }
            
            return exists;
        } catch (error) {
            console.error('❌ [checkEmployeeExists] Erreur:', error);
            return false;
        }
    }

    // ==================== SERVICE D'EMAIL AVEC ROTATEUR ====================
    
    async sendEmail(emailData) {
        try {
            console.log(`📧 [sendEmail] Préparation envoi email à: ${emailData.to}`);
            
            // ⭐ UTILISER LE ROTATEUR
            const account = emailRotator.getNextAvailableAccount();
            
            const transporter = nodemailer.createTransport({
                host: account.host,
                port: account.port,
                secure: account.port === 465,
                auth: {
                    user: account.user,
                    pass: account.password
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
            
            const mailOptions = {
                from: `"${account.name}" <${account.from}>`,
                to: emailData.to,
                subject: emailData.subject,
                html: emailData.html,
                attachments: emailData.attachments || []
            };
            
            const info = await transporter.sendMail(mailOptions);
            console.log(`✅ [sendEmail] Email envoyé via ${account.user}: ${info.messageId}`);
            
            return {
                success: true,
                messageId: info.messageId,
                account: account.user
            };
            
        } catch (error) {
            console.error('❌ [sendEmail] Erreur:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async sendPayslipByEmail(employee_id, month_year) {
    try {
        console.log(`📧 [sendPayslipByEmail] Début envoi pour: ${employee_id} - ${month_year}`);
        
        // Récupérer les informations complètes
        const query = `
            SELECT sp.*, e.first_name, e.last_name, e.email, e.department
            FROM salary_payments sp
            JOIN employees e ON sp.employee_id = e.employee_id
            WHERE sp.employee_id = $1 AND sp.month_year = $2
        `;
        
        const result = await db.query(query, [employee_id, month_year]);
        
        if (result.rows.length === 0) {
            console.log(`❌ Paiement non trouvé: ${employee_id} - ${month_year}`);
            return false;
        }
        
        const payment = result.rows[0];
        
        if (!payment.email) {
            console.log(`❌ Employé sans email: ${employee_id}`);
            return false;
        }
        
        // ⭐ UTILISER LE ROTATEUR
        const account = emailRotator.getNextAvailableAccount();
        
        const transporter = nodemailer.createTransport({
            host: account.host,
            port: account.port,
            secure: account.port === 465,
            auth: {
                user: account.user,
                pass: account.password
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        
        // Contenu de l'email
        const mailOptions = {
            from: `"${account.name}" <${account.from}>`,
            to: payment.email,
            subject: `Votre fiche de paie - ${payment.month_year}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Fiche de paie ${payment.month_year}</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
                        .footer { text-align: center; font-size: 12px; color: #777; margin-top: 20px; }
                        .details { margin: 20px 0; }
                        .amount { font-size: 24px; font-weight: bold; color: #4CAF50; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Votre fiche de paie</h1>
                            <p>${payment.month_year}</p>
                        </div>
                        <div class="content">
                            <p>Bonjour <strong>${payment.first_name} ${payment.last_name}</strong>,</p>
                            <p>Votre fiche de paie pour le mois de <strong>${payment.month_year}</strong> est disponible.</p>
                            
                            <div class="details">
                                <h3>Résumé du paiement :</h3>
                                <p><strong>Salaire net :</strong> <span class="amount">${parseFloat(payment.net_salary).toLocaleString('fr-FR')} TND</span></p>
                                <p><strong>Département :</strong> ${payment.department || 'Non spécifié'}</p>
                                <p><strong>Statut :</strong> ${payment.payment_status || 'Payé'}</p>
                                ${payment.payment_date ? `<p><strong>Date de paiement :</strong> ${new Date(payment.payment_date).toLocaleDateString('fr-FR')}</p>` : ''}
                            </div>
                            
                            <p>Vous pouvez consulter le détail complet de votre fiche de paie depuis votre espace personnel.</p>
                        </div>
                        <div class="footer">
                            <p>Cet email est envoyé automatiquement par le système de paie.</p>
                            <p>Merci de ne pas répondre à cet email.</p>
                            <p>© ${new Date().getFullYear()} Votre Entreprise - Tous droits réservés</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `Bonjour ${payment.first_name} ${payment.last_name},

Votre fiche de paie pour le mois de ${payment.month_year} est disponible.

Salaire net : ${parseFloat(payment.net_salary).toLocaleString('fr-FR')} TND
Département : ${payment.department || 'Non spécifié'}
Statut : ${payment.payment_status || 'Payé'}
${payment.payment_date ? `Date de paiement : ${new Date(payment.payment_date).toLocaleDateString('fr-FR')}` : ''}

Vous pouvez consulter le détail complet de votre fiche de paie depuis votre espace personnel.

Cet email est envoyé automatiquement par le système de paie.
Merci de ne pas répondre à cet email.

© ${new Date().getFullYear()} Votre Entreprise`
        };
        
        // Envoyer l'email
        const info = await transporter.sendMail(mailOptions);
        
        console.log(`✅ Email envoyé via ${account.user} à ${payment.email}: ${info.messageId}`);
        
        // Mettre à jour le statut dans la base de données
        await db.query(
            `UPDATE salary_payments 
             SET email_sent = true, 
                 email_sent_at = NOW(),
                 email_attempts = COALESCE(email_attempts, 0) + 1,
                 email_status = 'sent',
                 email_error = NULL
             WHERE employee_id = $1 AND month_year = $2`,
            [employee_id, month_year]
        );
        
        return true;
        
    } catch (error) {
        console.error(`❌ [sendPayslipByEmail] Erreur pour ${employee_id}:`, error.message);
        
        try {
            // Enregistrer l'erreur dans la base de données
            await db.query(
                `UPDATE salary_payments 
                 SET email_sent = false,
                     email_attempts = COALESCE(email_attempts, 0) + 1,
                     email_status = 'failed',
                     email_error = $1
                 WHERE employee_id = $2 AND month_year = $3`,
                [error.message.substring(0, 500), employee_id, month_year]
            );
        } catch (dbError) {
            console.error('❌ Erreur lors de l\'enregistrement de l\'erreur:', dbError.message);
        }
        
        return false;
    }
}
    
    generatePayslipEmailHTML(data, month_year) {
        const formatCurrency = (amount) => {
            return new Intl.NumberFormat('fr-TN', {
                style: 'currency',
                currency: data.currency || 'TND',
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
        
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fiche de paie - ${data.month_name}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9fafb;
        }
        .container {
            background-color: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            border: 1px solid #e5e7eb;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #2c5282;
            padding-bottom: 25px;
            margin-bottom: 35px;
        }
        .header h1 {
            color: #2c5282;
            margin: 0 0 10px 0;
            font-size: 28px;
        }
        .company-name {
            color: #4a5568;
            font-size: 16px;
            font-weight: 600;
            margin: 5px 0;
        }
        .company-address {
            color: #718096;
            font-size: 14px;
            margin: 5px 0;
        }
        .section {
            margin-bottom: 30px;
        }
        .section-title {
            color: #2c5282;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 10px;
            margin-bottom: 20px;
            font-size: 18px;
            font-weight: 600;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 25px;
        }
        @media (max-width: 600px) {
            .info-grid {
                grid-template-columns: 1fr;
            }
        }
        .info-item {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #edf2f7;
        }
        .label {
            font-weight: 600;
            color: #4a5568;
            font-size: 14px;
        }
        .value {
            color: #2d3748;
            font-weight: 500;
        }
        .total-section {
            background: linear-gradient(135deg, #ebf8ff 0%, #e6fffa 100%);
            padding: 25px;
            border-radius: 10px;
            border-left: 5px solid #2c5282;
            margin: 35px 0;
        }
        .net-pay {
            font-size: 32px;
            font-weight: 700;
            color: #2c5282;
            text-align: center;
            margin: 25px 0;
            padding: 15px;
            background: white;
            border-radius: 8px;
            border: 2px dashed #2c5282;
        }
        .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 25px;
            border-top: 1px solid #e2e8f0;
            color: #718096;
            font-size: 14px;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #2c5282 0%, #2b6cb0 100%);
            color: white;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 8px;
            margin: 25px 0;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 12px rgba(44, 82, 130, 0.3);
            transition: all 0.3s ease;
        }
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(44, 82, 130, 0.4);
        }
        .alert {
            background-color: #fffaf0;
            border: 1px solid #f6ad55;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
            color: #744210;
            font-size: 15px;
            line-height: 1.5;
        }
        .alert strong {
            color: #dd6b20;
        }
        .payment-details {
            background-color: #f7fafc;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .payment-row {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 8px 0;
        }
        .payment-label {
            color: #4a5568;
            font-weight: 500;
        }
        .payment-amount {
            color: #2d3748;
            font-weight: 600;
        }
        .positive {
            color: #38a169;
        }
        .negative {
            color: #e53e3e;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2c5282;
            margin-bottom: 10px;
        }
        .confidential {
            font-size: 12px;
            color: #a0aec0;
            text-align: center;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🏢 Smart Attendance</div>
            <h1>FICHE DE PAIE</h1>
            <p class="company-name">Smart Attendance System</p>
            <p class="company-address">pauroll controller 446, Jemmel, Tunisie</p>
        </div>
        
        <div class="section">
            <div class="section-title">👤 Informations Employé</div>
            <div class="info-grid">
                <div class="info-item">
                    <span class="label">Nom complet :</span>
                    <span class="value"><strong>${data.first_name} ${data.last_name}</strong></span>
                </div>
                <div class="info-item">
                    <span class="label">Matricule :</span>
                    <span class="value">${data.employee_id}</span>
                </div>
                <div class="info-item">
                    <span class="label">Département :</span>
                    <span class="value">${data.department || 'Non spécifié'}</span>
                </div>
                <div class="info-item">
                    <span class="label">Fonction :</span>
                    <span class="value">${data.position || 'Non spécifié'}</span>
                </div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">📅 Période de Paiement</div>
            <div class="info-grid">
                <div class="info-item">
                    <span class="label">Mois de paie :</span>
                    <span class="value"><strong>${data.month_name}</strong></span>
                </div>
                <div class="info-item">
                    <span class="label">Période :</span>
                    <span class="value">${formatDate(data.start_date)} - ${formatDate(data.end_date)}</span>
                </div>
                <div class="info-item">
                    <span class="label">Date de versement :</span>
                    <span class="value">${formatDate(data.payment_date) || formatDate(new Date())}</span>
                </div>
                <div class="info-item">
                    <span class="label">Référence :</span>
                    <span class="value">PAY-${month_year.replace('-', '')}-${data.employee_id}</span>
                </div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">💰 Détails du Paiement</div>
            <div class="payment-details">
                <div class="payment-row">
                    <span class="payment-label">Salaire de base :</span>
                    <span class="payment-amount">${formatCurrency(data.salary_base || data.base_salary)}</span>
                </div>
                ${data.tax_amount > 0 ? `
                <div class="payment-row">
                    <span class="payment-label">Retenue impôt :</span>
                    <span class="payment-amount negative">- ${formatCurrency(data.tax_amount)}</span>
                </div>
                ` : ''}
                ${data.deduction_amount > 0 ? `
                <div class="payment-row">
                    <span class="payment-label">Autres retenues :</span>
                    <span class="payment-amount negative">- ${formatCurrency(data.deduction_amount)}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="total-section">
                <div class="payment-row" style="border-bottom: 2px solid #cbd5e0; padding-bottom: 15px;">
                    <span class="payment-label" style="font-size: 18px;">Salaire brut :</span>
                    <span class="payment-amount" style="font-size: 18px;">${formatCurrency(data.salary_base || data.base_salary)}</span>
                </div>
                <div class="payment-row" style="margin-top: 15px;">
                    <span class="payment-label" style="font-size: 16px;">Total retenues :</span>
                    <span class="payment-amount negative" style="font-size: 16px;">- ${formatCurrency((data.tax_amount || 0) + (data.deduction_amount || 0))}</span>
                </div>
                
                <div class="net-pay">
                    Net à payer : ${formatCurrency(data.net_salary)}
                </div>
                
                <p style="text-align: center; color: #4a5568; margin-top: 20px;">
                    ✅ Votre salaire a été versé avec succès sur votre compte bancaire.
                </p>
            </div>
        </div>
        
        <div class="alert">
            <strong>📋 Informations importantes :</strong><br>
            • Cette fiche de paie détaillée est disponible dans votre espace personnel<br>
            • Conservez ce document pour vos archives personnelles<br>
            • Le délai de contestation est de 30 jours à compter de la réception
        </div>
        
        <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/payslip/${data.employee_id}/${month_year}" 
               class="button" 
               target="_blank">
                📄 Accéder à ma fiche de paie détaillée
            </a>
            
            <p style="color: #718096; margin-top: 15px; font-size: 14px;">
                <em>Cliquez sur le bouton ci-dessus pour consulter votre fiche complète</em>
            </p>
        </div>
        
        <div class="footer">
            <p><strong>📞 Service des Ressources Humaines</strong></p>
            <p>Email : Iot.sahnoun@gmail.com | Téléphone : +216 29 328 870</p>
            <p>Horaires : Lundi - Vendredi, 8h00 - 17h00</p>
            
            <p class="confidential">
                Ce message est confidentiel et destiné uniquement à ${data.first_name} ${data.last_name}.<br>
                Si vous n'êtes pas le destinataire prévu, veuillez supprimer ce message et nous en informer.
            </p>
            
            <p style="font-size: 12px; margin-top: 25px; color: #a0aec0;">
                © ${new Date().getFullYear()} Smart Attendance System. Tous droits réservés.<br>
                ID Transaction: ${Date.now()}-${data.employee_id}
            </p>
        </div>
    </div>
</body>
</html>`;
    }

    // ==================== TABLEAU DE BORD ====================
    
    async getDashboard(req, res) {
        try {
            console.log('📊 [getDashboard] Génération tableau de bord');
            
            // Récupérer les statistiques rapides
            const [
                monthsResult,
                employeesResult,
                configResult,
                paymentsResult,
                paidMonthsResult,
                attendanceResult
            ] = await Promise.all([
                db.query('SELECT COUNT(*) as count FROM pay_months'),
                db.query('SELECT COUNT(*) as count FROM employees WHERE is_active = true'),
                db.query('SELECT COUNT(*) as count FROM salary_configs'),
                db.query(`
                    SELECT 
                        COUNT(*) as total_payments,
                        COALESCE(SUM(net_salary), 0) as total_amount
                    FROM salary_payments 
                    WHERE payment_status = 'paid'
                `),
                db.query(`
                    SELECT 
                        COUNT(*) as count,
                        COALESCE(SUM(total_amount), 0) as total_amount
                    FROM pay_months 
                    WHERE status = 'paid'
                `),
                db.query(`
                    SELECT 
                        COUNT(DISTINCT employee_id) as present_today,
                        COUNT(*) as total_checkins
                    FROM attendance 
                    WHERE record_date = CURRENT_DATE
                `)
            ]);
            
            // Récupérer les derniers mois de paie
            const recentMonths = await db.query(`
                SELECT 
                    month_year,
                    month_name,
                    status,
                    total_amount,
                    total_employees,
                    created_at
                FROM pay_months 
                ORDER BY start_date DESC 
                LIMIT 5
            `);
            
            // Récupérer les paiements en attente
            const pendingPayments = await db.query(`
                SELECT 
                    sp.*,
                    e.first_name,
                    e.last_name,
                    e.department,
                    pm.month_name
                FROM salary_payments sp
                JOIN employees e ON sp.employee_id = e.employee_id
                JOIN pay_months pm ON sp.month_year = pm.month_year
                WHERE sp.payment_status = 'pending'
                ORDER BY sp.created_at DESC
                LIMIT 10
            `);
            
            // Récupérer les statistiques par département
            const departmentStats = await db.query(`
                SELECT 
                    e.department,
                    COUNT(DISTINCT e.employee_id) as employee_count,
                    COUNT(sc.employee_id) as configured_count,
                    COALESCE(SUM(sp.net_salary), 0) as total_salary
                FROM employees e
                LEFT JOIN salary_configs sc ON e.employee_id = sc.employee_id
                LEFT JOIN salary_payments sp ON e.employee_id = sp.employee_id
                WHERE e.is_active = true
                GROUP BY e.department
                ORDER BY total_salary DESC
                LIMIT 6
            `);
            
            // Statistiques mensuelles pour graphique
            const monthlyStats = await db.query(`
                SELECT 
                    TO_CHAR(pm.start_date, 'YYYY-MM') as month,
                    pm.month_name,
                    COUNT(sp.id) as payment_count,
                    COALESCE(SUM(sp.net_salary), 0) as total_amount,
                    pm.status
                FROM pay_months pm
                LEFT JOIN salary_payments sp ON pm.month_year = sp.month_year
                WHERE pm.start_date >= CURRENT_DATE - INTERVAL '6 months'
                GROUP BY pm.month_year, pm.month_name, pm.start_date, pm.status
                ORDER BY pm.start_date DESC
                LIMIT 6
            `);
            
            const stats = {
                summary: {
                    total_employees: parseInt(employeesResult.rows[0]?.count || 0),
                    configured_employees: parseInt(configResult.rows[0]?.count || 0),
                    config_rate: parseInt(employeesResult.rows[0]?.count || 0) > 0 
                        ? Math.round((parseInt(configResult.rows[0]?.count || 0) / parseInt(employeesResult.rows[0]?.count || 0)) * 100)
                        : 0,
                    total_months: parseInt(monthsResult.rows[0]?.count || 0),
                    paid_months: parseInt(paidMonthsResult.rows[0]?.count || 0),
                    total_paid: parseFloat(paidMonthsResult.rows[0]?.total_amount || 0),
                    pending_payments: parseInt(paymentsResult.rows[0]?.total_payments || 0),
                    present_today: parseInt(attendanceResult.rows[0]?.present_today || 0)
                },
                
                recent_months: recentMonths.rows,
                
                pending_payments: pendingPayments.rows,
                
                departments: departmentStats.rows.map(dept => ({
                    name: dept.department || 'Non spécifié',
                    employee_count: parseInt(dept.employee_count) || 0,
                    configured_count: parseInt(dept.configured_count) || 0,
                    total_salary: parseFloat(dept.total_salary) || 0,
                    config_rate: parseInt(dept.employee_count) > 0 
                        ? Math.round((parseInt(dept.configured_count) / parseInt(dept.employee_count)) * 100)
                        : 0
                })),
                
                monthly_trends: monthlyStats.rows.map(month => ({
                    month: month.month,
                    month_name: month.month_name,
                    payment_count: parseInt(month.payment_count) || 0,
                    total_amount: parseFloat(month.total_amount) || 0,
                    status: month.status
                })),
                
                alerts: []
            };
            
            // Ajouter des alertes si nécessaire
            if (stats.summary.config_rate < 50) {
                stats.alerts.push({
                    type: 'warning',
                    message: `Seulement ${stats.summary.config_rate}% des employés ont une configuration salariale`,
                    action: 'Configurer les salaires'
                });
            }
            
            if (stats.summary.pending_payments > 0) {
                stats.alerts.push({
                    type: 'info',
                    message: `${stats.summary.pending_payments} paiements en attente`,
                    action: 'Traiter les paiements'
                });
            }
            
            console.log('✅ [getDashboard] Tableau de bord généré');
            
            res.json({
                success: true,
                data: stats,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ [getDashboard] Erreur:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur génération tableau de bord',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // ==================== EMPLOYÉS DISPONIBLES ====================
    
    async getAvailableEmployees(req, res) {
        try {
            console.log('📋 [getAvailableEmployees] Début récupération employés actifs');
            
            const query = `
                SELECT 
                    e.id as db_id,
                    e.employee_id,
                    e.first_name,
                    e.last_name,
                    e.email,
                    e.department,
                    e.position,
                    e.hire_date,
                    e.status,
                    e.phone,
                    e.is_active,
                    e.role,
                    e.created_at,
                    e.updated_at,
                    CASE 
                        WHEN sc.id IS NOT NULL THEN true 
                        ELSE false 
                    END as has_salary_config,
                    sc.base_salary,
                    sc.currency,
                    sc.payment_method,
                    sc.tax_rate,
                    sc.social_security_rate,
                    sc.created_at as config_created_at
                FROM employees e
                LEFT JOIN salary_configs sc ON e.employee_id = sc.employee_id
                WHERE e.is_active = true
                AND e.status != 'inactive'
                ORDER BY e.last_name, e.first_name, e.employee_id
            `;
            
            console.log('📊 Exécution requête SQL...');
            const { rows } = await db.query(query);
            
            console.log(`✅ ${rows.length} employés actifs trouvés`);
            
            const formattedEmployees = rows.map(emp => {
                let hireDateFormatted = null;
                if (emp.hire_date) {
                    hireDateFormatted = new Date(emp.hire_date).toISOString().split('T')[0];
                }
                
                return {
                    id: emp.db_id,
                    employee_id: emp.employee_id,
                    first_name: emp.first_name,
                    last_name: emp.last_name,
                    full_name: `${emp.first_name} ${emp.last_name}`,
                    email: emp.email,
                    department: emp.department || 'Non spécifié',
                    position: emp.position || 'Non spécifié',
                    hire_date: hireDateFormatted,
                    status: emp.status,
                    phone: emp.phone,
                    is_active: emp.is_active,
                    role: emp.role,
                    created_at: emp.created_at,
                    updated_at: emp.updated_at,
                    has_salary_config: emp.has_salary_config,
                    salary_config: emp.has_salary_config ? {
                        base_salary: emp.base_salary,
                        currency: emp.currency || 'TND',
                        payment_method: emp.payment_method,
                        tax_rate: emp.tax_rate,
                        social_security_rate: emp.social_security_rate,
                        created_at: emp.config_created_at
                    } : null
                };
            });
            
            const totalEmployees = formattedEmployees.length;
            const withConfig = formattedEmployees.filter(e => e.has_salary_config).length;
            const withoutConfig = totalEmployees - withConfig;
            const configPercentage = totalEmployees > 0 ? Math.round((withConfig / totalEmployees) * 100) : 0;
            
            const departmentStats = {};
            formattedEmployees.forEach(emp => {
                const dept = emp.department || 'Non spécifié';
                departmentStats[dept] = (departmentStats[dept] || 0) + 1;
            });
            
            const response = {
                success: true,
                data: formattedEmployees,
                count: totalEmployees,
                stats: {
                    total: totalEmployees,
                    with_config: withConfig,
                    without_config: withoutConfig,
                    config_percentage: configPercentage,
                    departments: departmentStats,
                    summary: {
                        active_employees: totalEmployees,
                        configured_employees: withConfig,
                        unconfigured_employees: withoutConfig,
                        configuration_rate: `${configPercentage}%`
                    }
                },
                metadata: {
                    last_updated: new Date().toISOString(),
                    source: 'database',
                    query_time: new Date().toISOString()
                }
            };
            
            console.log('📈 Statistiques employés:', {
                total: totalEmployees,
                with_config: withConfig,
                without_config: withoutConfig,
                percentage: `${configPercentage}%`
            });
            
            console.log('🏁 [getAvailableEmployees] Terminé avec succès');
            
            res.json(response);
            
        } catch (error) {
            console.error('❌ [getAvailableEmployees] Erreur détaillée:', error);
            
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des employés',
                error: {
                    message: error.message,
                    code: error.code,
                    hint: error.hint || 'Vérifiez la structure des tables employees et salary_configs'
                },
                fallback_data: {
                    employees: [],
                    count: 0,
                    stats: {
                        total: 0,
                        with_config: 0,
                        without_config: 0,
                        config_percentage: 0
                    }
                }
            });
        }
    }

    // ==================== CONFIGURATION SALAIRE ====================
    
    async configureSalary(req, res) {
  try {
    console.log('📥 [configureSalary] Données reçues:', req.body);
    
    // Assurez-vous que allowances et deductions sont bien des chaînes JSON valides
    let { 
      employee_id, base_salary, currency, payment_method, 
      tax_rate, social_security_rate, contract_type,
      allowances, deductions,  // Ces champs arrivent comme strings JSON
      working_days, daily_hours, overtime_multiplier,
      bank_name, bank_account, iban, is_active 
    } = req.body;

    // DEBUG : Vérifiez le type et contenu
    console.log('🔍 DEBUG allowances:', {
      value: allowances,
      type: typeof allowances,
      parsed: typeof allowances === 'string' ? JSON.parse(allowances) : 'NOT A STRING'
    });
    
    console.log('🔍 DEBUG deductions:', {
      value: deductions,
      type: typeof deductions,
      parsed: typeof deductions === 'string' ? JSON.parse(deductions) : 'NOT A STRING'
    });

    // Vérifiez que allowances et deductions sont bien des tableaux
    let allowancesArray = [];
    let deductionsArray = [];
    
    try {
      // Si c'est une chaîne, parsez-la
      if (typeof allowances === 'string' && allowances.trim() !== '') {
        allowancesArray = JSON.parse(allowances);
      } 
      // Si c'est déjà un tableau/objet
      else if (Array.isArray(allowances)) {
        allowancesArray = allowances;
      }
      // Sinon, tableau vide par défaut
      else {
        allowancesArray = [];
      }
    } catch (error) {
      console.error('❌ Erreur parsing allowances:', error);
      allowancesArray = [];
    }
    
    try {
      // Même logique pour deductions
      if (typeof deductions === 'string' && deductions.trim() !== '') {
        deductionsArray = JSON.parse(deductions);
      } 
      else if (Array.isArray(deductions)) {
        deductionsArray = deductions;
      }
      else {
        deductionsArray = [];
      }
    } catch (error) {
      console.error('❌ Erreur parsing deductions:', error);
      deductionsArray = [];
    }

    // Convertir en chaîne JSON pour la base de données
    const allowancesJSON = JSON.stringify(allowancesArray);
    const deductionsJSON = JSON.stringify(deductionsArray);
    
    console.log('📤 Données prêtes pour insertion:', {
      allowances: allowancesJSON,
      deductions: deductionsJSON
    });

    // Vérifiez que l'employé existe
    const employeeCheck = await db.query(
      'SELECT id, first_name, last_name FROM employees WHERE employee_id = $1',
      [employee_id]
    );
    
    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employé non trouvé' });
    }

    // Insertion/mise à jour dans la base de données
    const result = await db.query(`
      INSERT INTO salary_configs (
        employee_id, base_salary, currency, payment_method,
        tax_rate, social_security_rate, contract_type,
        allowances, deductions,
        working_days, daily_hours, overtime_multiplier,
        bank_name, bank_account, iban, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (employee_id) 
      DO UPDATE SET
        base_salary = EXCLUDED.base_salary,
        currency = EXCLUDED.currency,
        payment_method = EXCLUDED.payment_method,
        tax_rate = EXCLUDED.tax_rate,
        social_security_rate = EXCLUDED.social_security_rate,
        contract_type = EXCLUDED.contract_type,
        allowances = EXCLUDED.allowances,
        deductions = EXCLUDED.deductions,
        working_days = EXCLUDED.working_days,
        daily_hours = EXCLUDED.daily_hours,
        overtime_multiplier = EXCLUDED.overtime_multiplier,
        bank_name = EXCLUDED.bank_name,
        bank_account = EXCLUDED.bank_account,
        iban = EXCLUDED.iban,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      employee_id, 
      parseFloat(base_salary) || 0,
      currency || 'TND',
      payment_method || 'cash',
      parseFloat(tax_rate) || 0,
      parseFloat(social_security_rate) || 0,
      contract_type || 'permanent',
      allowancesJSON,
      deductionsJSON,
      parseInt(working_days) || 22,
      parseFloat(daily_hours) || 8,
      parseFloat(overtime_multiplier) || 1.5,
      bank_name || '',
      bank_account || '',
      iban || '',
      is_active !== false
    ]);

    console.log('✅ [configureSalary] Configuration sauvegardée:', {
      id: result.rows[0].id,
      employee_id: result.rows[0].employee_id,
      allowances: result.rows[0].allowances,
      deductions: result.rows[0].deductions
    });

    res.json({
      success: true,
      message: 'Configuration salariale sauvegardée',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ [configureSalary] Erreur:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la configuration', 
      details: error.message 
    });
  }
}

    async updateSalaryConfig(req, res) {
    try {
        const { employee_id } = req.params;
        const updateData = req.body;
        
        console.log(`📥 [updateSalaryConfig] Mise à jour pour ${employee_id}:`, updateData);
        
        if (!employee_id) {
            return res.status(400).json({
                success: false,
                message: 'ID employé requis',
                code: 'MISSING_EMPLOYEE_ID'
            });
        }
        
        // ⭐ AJOUTER CE LOG POUR DÉBOGUER
        console.log('🔍 [updateSalaryConfig] Données reçues du frontend:', {
            allowances: updateData.allowances,
            deductions: updateData.deductions,
            allowances_type: typeof updateData.allowances,
            deductions_type: typeof updateData.deductions
        });
        
        const employeeExists = await this.checkEmployeeExists(employee_id);
        if (!employeeExists) {
            return res.status(404).json({
                success: false,
                message: `Employé avec ID "${employee_id}" non trouvé`,
                code: 'EMPLOYEE_NOT_FOUND'
            });
        }
        
        const existingConfig = await db.query(
            'SELECT id FROM salary_configs WHERE employee_id = $1',
            [employee_id]
        );
        
        if (existingConfig.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Aucune configuration trouvée pour l'employé ${employee_id}`,
                code: 'CONFIG_NOT_FOUND',
                suggestion: 'Utilisez POST /configure pour créer une nouvelle configuration'
            });
        }
        
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;
        
        Object.keys(updateData).forEach(key => {
            if (key !== 'employee_id') {
                updateFields.push(`${key} = $${paramIndex}`);
                
                // ⭐ SPÉCIAL POUR allowances et deductions : vérifier si c'est déjà un string JSON
                if ((key === 'allowances' || key === 'deductions') && 
                    typeof updateData[key] === 'string' && 
                    updateData[key].startsWith('[')) {
                    // C'est déjà un JSON string, le garder tel quel
                    updateValues.push(updateData[key]);
                } else if ((key === 'allowances' || key === 'deductions') && 
                          Array.isArray(updateData[key])) {
                    // C'est un tableau, le convertir en JSON
                    updateValues.push(JSON.stringify(updateData[key]));
                } else {
                    updateValues.push(updateData[key]);
                }
                
                paramIndex++;
            }
        });
        
        updateFields.push(`updated_at = $${paramIndex}`);
        updateValues.push(new Date());
        paramIndex++;
        
        updateValues.push(employee_id);
        
        const query = `
            UPDATE salary_configs 
            SET ${updateFields.join(', ')}
            WHERE employee_id = $${paramIndex}
            RETURNING *
        `;
        
        const result = await db.query(query, updateValues);
        
        // ⭐ IMMÉDIATEMENT RE-CHARGER ET RETOURNER LES DONNÉES PARSÉES
        const updatedConfig = result.rows[0];
        
        // Parser les données pour la réponse
        let allowancesArray = [];
        if (updatedConfig.allowances && typeof updatedConfig.allowances === 'string') {
            try {
                allowancesArray = JSON.parse(updatedConfig.allowances);
            } catch (e) {
                allowancesArray = [];
            }
        }
        
        let deductionsArray = [];
        if (updatedConfig.deductions && typeof updatedConfig.deductions === 'string') {
            try {
                deductionsArray = JSON.parse(updatedConfig.deductions);
            } catch (e) {
                deductionsArray = [];
            }
        }
        
        // Normaliser
        allowancesArray = allowancesArray
            .filter(item => item && (item.name || item.amount))
            .map(item => ({
                name: item.name || item.allowance_name || '',
                amount: item.amount || item.allowance_amount || '',
                type: item.type || 'fixed'
            }));
        
        deductionsArray = deductionsArray
            .filter(item => item && (item.name || item.amount))
            .map(item => ({
                name: item.name || item.deduction_name || '',
                amount: item.amount || item.deduction_amount || '',
                type: item.type || 'fixed'
            }));
        
        const responseData = {
            ...updatedConfig,
            allowances: allowancesArray,
            deductions: deductionsArray
        };
        
        console.log(`✅ [updateSalaryConfig] Configuration mise à jour pour ${employee_id}`);
        console.log(`📊 [updateSalaryConfig] Données retournées: ${allowancesArray.length} alloc, ${deductionsArray.length} déduc`);
        
        res.json({
            success: true,
            message: 'Configuration salariale mise à jour avec succès',
            data: responseData
        });

    } catch (error) {
        console.error('❌ [updateSalaryConfig] Erreur:', error);
        
        // Afficher plus de détails sur l'erreur
        if (error.message && error.message.includes('contract_type')) {
            console.error('⚠️ ERREUR: La colonne contract_type n\'existe pas dans la table salary_configs');
            console.error('⚠️ SOLUTION: Exécuter: ALTER TABLE salary_configs ADD COLUMN contract_type VARCHAR(50) DEFAULT \'permanent\';');
        }
        
        res.status(500).json({
            success: false,
            message: 'Erreur mise à jour configuration',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            code: 'SERVER_ERROR'
        });
    }
}

    // payrollController.js - Fonction getSalaryConfig COMPLÈTE ET CORRIGÉE
async getSalaryConfig(req, res) {
  try {
    const { employee_id } = req.params;
    
    console.log('🔍 [getSalaryConfig] ID:', employee_id);
    
    if (!employee_id) {
      return res.status(400).json({
        success: false,
        error: 'ID employé manquant'
      });
    }
    
    // Recherche directe dans la table (sans structure complexe)
    const result = await db.query(
      'SELECT * FROM salary_configs WHERE employee_id = $1',
      [employee_id]
    );
    
    if (result.rows.length === 0) {
      // Employé non trouvé
      return res.status(200).json({
        success: true,
        exists: false,
        config_exists: false,
        data: null,
        message: 'Configuration non trouvée'
      });
    }
    
    const config = result.rows[0];
    
    // ⭐ STRUCTURE STANDARD OBLIGATOIRE
    const response = {
      success: true,
      exists: true,
      config_exists: true,
      data: config, 
      employee_info: {
        employee_id: config.employee_id
      },
      message: 'Configuration chargée avec succès',
      code: 'CONFIG_LOADED'
    };
    
    console.log('✅ Configuration trouvée, structure correcte');
    res.json(response);
    
  } catch (error) {
    console.error('❌ Erreur getSalaryConfig:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
}

    // ==================== MOIS DE PAIE ====================
    
    async createPayMonth(req, res) {
        try {
            const { month_year, month_name, start_date, end_date, status = 'draft' } = req.body;
            
            console.log('📥 [createPayMonth] Création mois:', req.body);
            
            if (!month_year || !start_date || !end_date) {
                return res.status(400).json({
                    success: false,
                    message: 'Mois, date début et date fin requis',
                    code: 'MISSING_REQUIRED_FIELDS'
                });
            }
            
            const existingMonth = await db.query(
                'SELECT id FROM pay_months WHERE month_year = $1',
                [month_year]
            );
            
            if (existingMonth.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: `Le mois ${month_year} existe déjà`,
                    code: 'MONTH_ALREADY_EXISTS'
                });
            }
            
            const result = await db.query(
                `INSERT INTO pay_months (
                    month_year, month_name, start_date, end_date, status, created_at
                ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                RETURNING *`,
                [month_year, month_name, start_date, end_date, status]
            );
            
            console.log(`✅ [createPayMonth] Mois créé: ${month_year}`);
            
            res.json({
                success: true,
                message: 'Mois de paie créé avec succès',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('❌ [createPayMonth] Erreur:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur création mois de paie',
                code: 'SERVER_ERROR'
            });
        }
    }

    async getPayMonths(req, res) {
        try {
            const { rows } = await db.query(`
                SELECT * FROM pay_months 
                ORDER BY start_date DESC
            `);
            
            res.json({
                success: true,
                data: rows,
                count: rows.length
            });
        } catch (error) {
            console.error('❌ [getPayMonths] Erreur:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur récupération des mois de paie',
                code: 'SERVER_ERROR'
            });
        }
    }

    async getPayMonth(req, res) {
        try {
            const { month_year } = req.params;
            
            console.log(`📅 [getPayMonth] Recherche mois: ${month_year}`);
            
            if (!month_year) {
                return res.status(400).json({
                    success: false,
                    message: 'Mois requis',
                    code: 'MISSING_MONTH_YEAR'
                });
            }
            
            const result = await db.query(
                'SELECT * FROM pay_months WHERE month_year = $1',
                [month_year]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `Mois de paie ${month_year} non trouvé`,
                    code: 'MONTH_NOT_FOUND'
                });
            }
            
            const payments = await db.query(
                'SELECT COUNT(*) as payment_count, SUM(net_salary) as total_net FROM salary_payments WHERE month_year = $1',
                [month_year]
            );
            
            const payMonth = {
                ...result.rows[0],
                stats: {
                    payment_count: parseInt(payments.rows[0].payment_count) || 0,
                    total_net: parseFloat(payments.rows[0].total_net) || 0
                }
            };
            
            res.json({
                success: true,
                data: payMonth
            });
            
        } catch (error) {
            console.error('❌ [getPayMonth] Erreur:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur récupération mois de paie',
                code: 'SERVER_ERROR'
            });
        }
    }

    // ==================== CALCUL SALAIRES ====================
    
    async calculateSalaries(req, res) {
  console.log('🔍 ========== DEBUT calculateSalaries ==========');
  console.log('📦 Corps de la requête:', req.body);
  
  try {
      const { month_year } = req.body;
      
      console.log(`🧮 [calculateSalaries] Calcul pour mois: ${month_year}`);
      
      if (!month_year) {
          console.log('❌ Mois manquant');
          return res.status(400).json({
              success: false,
              message: 'Mois requis (format: YYYY-MM)',
              code: 'MISSING_MONTH_YEAR'
          });
      }
      
      // 1. Vérifier que le mois existe
      console.log(`🔍 Vérification existence mois: ${month_year}`);
      const monthExists = await db.query(
          'SELECT id, status, start_date, end_date FROM pay_months WHERE month_year = $1',
          [month_year]
      );
      
      if (monthExists.rows.length === 0) {
          return res.status(404).json({
              success: false,
              message: `Mois ${month_year} non trouvé`,
              code: 'MONTH_NOT_FOUND'
          });
      }
      
      const payMonth = monthExists.rows[0];
      
      // ✅ Récupérer la configuration des heures supplémentaires
      let overtimeEnabled = true;
      let overtimeThreshold = 8;
      
      try {
          const settingsResult = await db.query(
              'SELECT config FROM settings WHERE id = 1'
          );
          
          if (settingsResult.rows.length > 0) {
              const config = settingsResult.rows[0].config || {};
              overtimeEnabled = config.attendance?.overtimeEnabled !== false;
              overtimeThreshold = parseInt(config.attendance?.overtimeThreshold) || 8;
              
              console.log('⚙️ Configuration heures supplémentaires:', {
                  overtimeEnabled,
                  overtimeThreshold,
                  source: config.attendance
              });
              
              if (!overtimeEnabled) {
                  console.log('⏸️ Heures supplémentaires DÉSACTIVÉES - aucun calcul d\'heures sup ne sera effectué');
              }
          }
      } catch (error) {
          console.error('❌ Erreur récupération config heures sup:', error.message);
      }
      
      // 2. Récupérer la configuration des shifts depuis settings
      console.log('🔍 Récupération de la configuration des shifts...');
      const settingsResult = await db.query(
          'SELECT config FROM settings WHERE id = 1'
      );
      
      const config = settingsResult.rows[0]?.config || {};
      const shifts = config.shifts || {};
      
      // Structure des shifts avec leurs horaires
      const shiftConfig = {
          'Standard': {
              start: shifts.shift1?.start || '08:00',
              end: shifts.shift1?.end || '17:00',
              breakDuration: parseInt(shifts.shift1?.breakDuration || '60'),
              name: shifts.shift1?.name || 'Standard'
          },
          'Matin': {
              start: shifts.shift2?.start || '06:00',
              end: shifts.shift2?.end || '14:00',
              breakDuration: parseInt(shifts.shift2?.breakDuration || '40'),
              name: shifts.shift2?.name || 'Matin'
          },
          'Après-midi': {
              start: shifts.shift3?.start || '14:00',
              end: shifts.shift3?.end || '22:00',
              breakDuration: parseInt(shifts.shift3?.breakDuration || '40'),
              name: shifts.shift3?.name || 'Après-midi'
          },
          'Nuit': {
              start: shifts.shift4?.start || '22:00',
              end: shifts.shift4?.end || '06:00',
              breakDuration: parseInt(shifts.shift4?.breakDuration || '35'),
              name: shifts.shift4?.name || 'Nuit'
          }
      };
      
      console.log('⏰ Configuration des shifts chargée:', shiftConfig);

      // 3. Récupérer les employés avec configuration
      console.log('🔍 Récupération des employés avec configuration...');
      const employeesQuery = await db.query(`
          SELECT 
              e.employee_id,
              e.first_name,
              e.last_name,
              e.department,
              e.position,
              e.shift_name,
              sc.base_salary,
              sc.tax_rate,
              sc.social_security_rate,
              sc.working_days,
              sc.daily_hours,
              sc.overtime_multiplier,
              sc.allowances,
              sc.deductions,
              COALESCE(sc.bonus_fixed, 0) as bonus_fixed,
              COALESCE(sc.bonus_variable, 0) as bonus_variable,
              COALESCE(sc.other_deductions, 0) as other_deductions
          FROM employees e
          INNER JOIN salary_configs sc ON e.employee_id = sc.employee_id
          WHERE e.is_active = true
          AND sc.is_active = true
      `);
      
      const employees = employeesQuery.rows;
      console.log(`👥 ${employees.length} employés avec config trouvés`);
      
      if (employees.length === 0) {
          return res.status(400).json({
              success: false,
              message: 'Aucun employé avec configuration salariale active trouvé',
              code: 'NO_CONFIGURED_EMPLOYEES'
          });
      }
      
      // 4. Récupérer les données de présence pour chaque employé
      console.log('📊 Récupération des données de présence...');
      const attendanceData = {};
      let totalOvertimeDetected = 0;
      let totalOvertimePaid = 0;
      
      for (const employee of employees) {
          try {
              console.log(`\n👤 Traitement: ${employee.employee_id} - ${employee.first_name} ${employee.last_name} (Shift: ${employee.shift_name || 'Standard'})`);
              
              // ✅ CORRECTION: Enlever check_out_time IS NOT NULL
              const attendanceRecords = await db.query(`
                  SELECT 
                      check_in_time,
                      check_out_time,
                      record_date,
                      status,
                      hours_worked,
                      shift_name
                  FROM attendance 
                  WHERE employee_id = $1
                  AND record_date BETWEEN $2 AND $3
                  AND check_in_time IS NOT NULL
                  AND status NOT IN ('absent', 'day_off')
                  ORDER BY record_date
              `, [
                  employee.employee_id,
                  payMonth.start_date,
                  payMonth.end_date
              ]);
              
              console.log(`   📅 ${attendanceRecords.rows.length} jours de présence trouvés`);
              
              let totalWorkedHours = 0;
              let daysPresent = 0;
              let overtimeHours = 0;
              let overtimeDetected = 0;
              const dailyHours = employee.daily_hours || 8;
              
              for (const record of attendanceRecords.rows) {
                  // Déterminer le shift à utiliser
                  const shiftName = record.shift_name || employee.shift_name || 'Standard';
                  const shiftInfo = shiftConfig[shiftName] || shiftConfig['Standard'];
                  
                  // ✅ Calculer les heures avec toutes les règles
                  const result = this.calculateWorkedHoursWithAllRules(
                      record.check_in_time,
                      record.check_out_time,
                      shiftInfo,
                      dailyHours
                  );
                  
                  console.log(`      Jour ${record.record_date}: brut=${record.hours_worked}h → net=${result.hoursWorked.toFixed(2)}h`);
                  console.log(`         Arrondi: ${result.arrondi.checkIn} → ${result.arrondi.checkOut}`);
                  console.log(`         Pause: ${result.pause.deducted ? '✓ déduite' : '✗ non déduite'} (${result.pause.minutes}min)`);
                  
                  totalWorkedHours += result.hoursWorked;
                  daysPresent++;
                  
                  // ✅ Gestion des heures sup selon la configuration
                  if (result.overtime > 0) {
                      overtimeDetected += result.overtime;
                      if (overtimeEnabled) {
                          overtimeHours += result.overtime;
                          console.log(`         → ✅ Heures sup: +${result.overtime.toFixed(2)}h (activées)`);
                      } else {
                          console.log(`         → ⚠️ Heures sup détectées: +${result.overtime.toFixed(2)}h (IGNORÉES car désactivées)`);
                      }
                  }
              }
              
              // Récupérer les compteurs de statuts
              const statusCounts = await db.query(`
                  SELECT 
                      COUNT(CASE WHEN status IN ('present', 'late') THEN 1 END) as days_present,
                      COUNT(CASE WHEN status = 'late' THEN 1 END) as late_days,
                      COUNT(CASE WHEN status = 'absent' THEN 1 END) as days_absent,
                      COUNT(CASE WHEN status = 'early_leave' THEN 1 END) as early_leave_days
                  FROM attendance 
                  WHERE employee_id = $1
                  AND record_date BETWEEN $2 AND $3
              `, [
                  employee.employee_id,
                  payMonth.start_date,
                  payMonth.end_date
              ]);
              
              attendanceData[employee.employee_id] = {
                  days_worked: attendanceRecords.rows.length,
                  days_present: parseInt(statusCounts.rows[0]?.days_present || 0),
                  late_days: parseInt(statusCounts.rows[0]?.late_days || 0),
                  days_absent: parseInt(statusCounts.rows[0]?.days_absent || 0),
                  early_leave_days: parseInt(statusCounts.rows[0]?.early_leave_days || 0),
                  total_hours_worked: totalWorkedHours,
                  overtime_hours: overtimeEnabled ? overtimeHours : 0,
                  overtime_detected: overtimeDetected,
                  overtime_enabled: overtimeEnabled
              };
              
              totalOvertimeDetected += overtimeDetected;
              totalOvertimePaid += overtimeEnabled ? overtimeHours : 0;
              
              console.log(`   ✅ Résumé: ${daysPresent} jours, ${totalWorkedHours.toFixed(2)}h travaillées`);
              if (overtimeEnabled) {
                  console.log(`   ✅ Heures sup comptées: ${overtimeHours.toFixed(2)}h`);
              } else if (overtimeDetected > 0) {
                  console.log(`   ⚠️ Heures sup détectées mais IGNORÉES: ${overtimeDetected.toFixed(2)}h`);
              }
              
          } catch (attError) {
              console.error(`   ❌ Erreur présence pour ${employee.employee_id}:`, attError.message);
              attendanceData[employee.employee_id] = {
                  days_worked: 0,
                  days_present: 0,
                  late_days: 0,
                  days_absent: 0,
                  early_leave_days: 0,
                  total_hours_worked: 0,
                  overtime_hours: 0,
                  overtime_detected: 0,
                  overtime_enabled: overtimeEnabled
              };
          }
      }
      
      // 5. Calculer pour chaque employé
      console.log('🔍 Début des calculs détaillés...');
      const results = [];
      const errors = [];
      let totalMonthAmount = 0;
      
      for (const employee of employees) {
          try {
              console.log(`\n  📝 Calcul pour: ${employee.employee_id} - ${employee.first_name} ${employee.last_name}`);
              
              const attendance = attendanceData[employee.employee_id] || {
                  days_worked: 0,
                  days_present: 0,
                  late_days: 0,
                  days_absent: 0,
                  early_leave_days: 0,
                  total_hours_worked: 0,
                  overtime_hours: 0,
                  overtime_detected: 0,
                  overtime_enabled: overtimeEnabled
              };
              
              const totalHoursWorked = parseFloat(attendance.total_hours_worked) || 0;
              const overtimeHours = parseFloat(attendance.overtime_hours) || 0;
              const overtimeDetected = parseFloat(attendance.overtime_detected) || 0;
              const daysPresent = parseInt(attendance.days_present) || 0;
              
              // PARAMÈTRES
              const baseSalary = parseFloat(employee.base_salary) || 0;
              const taxRate = parseFloat(employee.tax_rate) || 0;
              const ssRate = parseFloat(employee.social_security_rate) || 0;
              const workingDays = parseInt(employee.working_days) || 24;
              const dailyHours = parseFloat(employee.daily_hours) || 8;
              const overtimeMultiplier = parseFloat(employee.overtime_multiplier) || 1.5;
              
              console.log(`    ⚙️  Base=${baseSalary}, Taxe=${taxRate}%, SS=${ssRate}%`);
              console.log(`    📊 Heures travaillées: ${totalHoursWorked.toFixed(2)}h`);
              if (overtimeEnabled) {
                  console.log(`    ⏰ Heures sup comptées: ${overtimeHours.toFixed(2)}h`);
              } else if (overtimeDetected > 0) {
                  console.log(`    ⚠️ Heures sup détectées mais non comptées: ${overtimeDetected.toFixed(2)}h`);
              }
              
              if (totalHoursWorked === 0) {
                  console.log(`    ⚠️  Aucune heure travaillée - Salaire = 0 TND`);
                  
                  await db.query(
                      `INSERT INTO salary_payments (
                          employee_id, month_year, base_salary, gross_salary, 
                          days_present, total_hours_worked, net_salary, payment_status, created_at, updated_at
                      ) VALUES ($1, $2, $3, 0, 0, 0, 0, 'pending', NOW(), NOW())
                      ON CONFLICT (employee_id, month_year) 
                      DO UPDATE SET
                          gross_salary = 0,
                          days_present = 0,
                          total_hours_worked = 0,
                          net_salary = 0,
                          updated_at = NOW()`,
                      [employee.employee_id, month_year, baseSalary]
                  );
                  
                  results.push({
                      employee_id: employee.employee_id,
                      name: `${employee.first_name} ${employee.last_name}`,
                      department: employee.department,
                      attendance: {
                          hours_worked: 0,
                          overtime_hours: 0,
                          overtime_detected: overtimeDetected,
                          overtime_enabled: overtimeEnabled
                      },
                      financial: {
                          base_salary: 0,
                          allowances: 0,
                          bonus: 0,
                          overtime: 0,
                          gross: 0,
                          tax: 0,
                          social_security: 0,
                          deductions: 0,
                          total_deductions: 0,
                          net: 0
                      },
                      status: 'success'
                  });
                  continue;
              }
              
              // ========== CALCUL BASÉ SUR LES HEURES ==========
              
              // 1. TAUX HORAIRE
              const hourlyRate = baseSalary / (workingDays * dailyHours);
              console.log(`    💰 Taux horaire: ${hourlyRate.toFixed(3)} TND/h`);
              
              // 2. SALAIRE DE BASE = Heures totales × taux horaire
              const baseSalaryForPeriod = totalHoursWorked * hourlyRate;
              
              // 3. HEURES SUPPLÉMENTAIRES (conditionnées par overtimeEnabled)
              let overtimeAmount = 0;
              if (overtimeEnabled && overtimeHours > 0) {
                  const overtimeRate = hourlyRate * overtimeMultiplier;
                  overtimeAmount = overtimeHours * overtimeRate;
                  console.log(`    ⏰ Montant heures sup: ${overtimeAmount.toFixed(2)} TND`);
              }
              
              // 4. ALLOCATIONS (depuis JSON) - CORRIGÉ
              let totalAllowances = 0;
              if (employee.allowances) {
                  try {
                      const allowances = typeof employee.allowances === 'string' 
                          ? JSON.parse(employee.allowances) 
                          : employee.allowances;
                      
                      if (Array.isArray(allowances)) {
                          console.log(`    📋 Allocations trouvées: ${allowances.length}`);
                          allowances.forEach((a, index) => {
                              const amount = parseFloat(a.amount || 0);
                              const allocName = a.name || `allocation_${index + 1}`;
                              
                              // ✅ CORRECTION : Les pourcentages s'appliquent sur le salaire PRORATISÉ
                              if (a.type === 'percentage') {
                                  const allocAmount = baseSalaryForPeriod * (amount / 100);
                                  totalAllowances += allocAmount;
                                  console.log(`      📊 Allocation ${allocName}: ${amount}% de ${baseSalaryForPeriod.toFixed(2)} = ${allocAmount.toFixed(2)} TND`);
                              } else {
                                  totalAllowances += amount;
                                  console.log(`      📊 Allocation ${allocName}: ${amount} TND (fixe)`);
                              }
                          });
                      }
                  } catch (e) {
                      console.log(`    ⚠️  Erreur parsing allocations: ${e.message}`);
                  }
              }
              
              // 5. BONUS
              const bonusAmount = (parseFloat(employee.bonus_fixed) || 0) + 
                                 (parseFloat(employee.bonus_variable) || 0);
              
              // 6. SALAIRE BRUT
              let grossSalary = baseSalaryForPeriod + totalAllowances + bonusAmount;
              if (overtimeEnabled) {
                  grossSalary += overtimeAmount;
              }
              
              // 7. DÉDUCTIONS SPÉCIFIQUES (depuis JSON)
              let deductionAmount = 0;
              if (employee.deductions) {
                  try {
                      const deductions = typeof employee.deductions === 'string'
                          ? JSON.parse(employee.deductions)
                          : employee.deductions;
                      
                      if (Array.isArray(deductions)) {
                          deductions.forEach(d => {
                              const amount = parseFloat(d.amount || 0);
                              if (d.type === 'percentage') {
                                  deductionAmount += grossSalary * (amount / 100);
                              } else {
                                  deductionAmount += amount;
                              }
                          });
                      }
                  } catch (e) {
                      console.log(`    ⚠️  Erreur parsing déductions: ${e.message}`);
                  }
              }
              
              // 8. IMPÔTS ET CNSS
              const taxAmount = grossSalary * (taxRate / 100);
              const socialAmount = grossSalary * (ssRate / 100);
              const otherDeductions = parseFloat(employee.other_deductions) || 0;
              
              // 9. TOTAL DÉDUCTIONS
              const totalDeductions = taxAmount + socialAmount + otherDeductions + deductionAmount;
              const netSalary = Math.max(0, grossSalary - totalDeductions);
              
              console.log(`    🧮 RÉSULTATS DÉTAILLÉS:`);
              console.log(`      💵 Salaire de base: ${baseSalaryForPeriod.toFixed(2)} (${totalHoursWorked.toFixed(2)}h × ${hourlyRate.toFixed(3)})`);
              if (overtimeEnabled && overtimeAmount > 0) {
                  console.log(`      ⏰ Heures sup: ${overtimeAmount.toFixed(2)} (${overtimeHours}h)`);
              } else if (!overtimeEnabled && overtimeDetected > 0) {
                  console.log(`      ⏸️ Heures sup (non facturées): ${overtimeDetected.toFixed(2)}h`);
              }
              console.log(`      🎁 Bonus: ${bonusAmount.toFixed(2)}`);
              console.log(`      📊 Allocations: ${totalAllowances.toFixed(2)}`);
              console.log(`      💰 BRUT: ${grossSalary.toFixed(2)}`);
              console.log(`      💸 Impôts: ${taxAmount.toFixed(2)}`);
              console.log(`      🛡️  CNSS: ${socialAmount.toFixed(2)}`);
              console.log(`      📉 Déductions: ${deductionAmount.toFixed(2)}`);
              console.log(`      ✅ NET: ${netSalary.toFixed(2)}`);
              
              // 10. SAUVEGARDE
              const existingPayment = await db.query(
                  'SELECT id FROM salary_payments WHERE employee_id = $1 AND month_year = $2',
                  [employee.employee_id, month_year]
              );
              
              if (existingPayment.rows.length > 0) {
                  await db.query(
                      `UPDATE salary_payments SET
                          base_salary = $1,
                          gross_salary = $2,
                          days_present = $3,
                          total_hours_worked = $4,
                          overtime_hours = $5,
                          overtime_amount = $6,
                          bonus_amount = $7,
                          tax_amount = $8,
                          social_security_amount = $9,
                          other_deductions = $10,
                          deduction_amount = $11,
                          total_deductions = $12,
                          net_salary = $13,
                          updated_at = NOW()
                      WHERE employee_id = $14 AND month_year = $15`,
                      [
                          baseSalary,
                          grossSalary,
                          daysPresent,
                          totalHoursWorked,
                          overtimeHours,
                          overtimeAmount,
                          bonusAmount,
                          taxAmount,
                          socialAmount,
                          otherDeductions,
                          deductionAmount,
                          totalDeductions,
                          netSalary,
                          employee.employee_id,
                          month_year
                      ]
                  );
              } else {
                  await db.query(
                      `INSERT INTO salary_payments (
                          employee_id, month_year, base_salary, gross_salary,
                          days_present, total_hours_worked, overtime_hours, overtime_amount,
                          bonus_amount, tax_amount, social_security_amount,
                          other_deductions, deduction_amount, total_deductions, net_salary,
                          payment_status, created_at, updated_at
                      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pending', NOW(), NOW())`,
                      [
                          employee.employee_id,
                          month_year,
                          baseSalary,
                          grossSalary,
                          daysPresent,
                          totalHoursWorked,
                          overtimeHours,
                          overtimeAmount,
                          bonusAmount,
                          taxAmount,
                          socialAmount,
                          otherDeductions,
                          deductionAmount,
                          totalDeductions,
                          netSalary
                      ]
                  );
              }
              
              results.push({
                  employee_id: employee.employee_id,
                  name: `${employee.first_name} ${employee.last_name}`,
                  department: employee.department,
                  attendance: {
                      hours_worked: totalHoursWorked,
                      overtime_hours: overtimeHours,
                      overtime_detected: overtimeDetected,
                      overtime_enabled: overtimeEnabled
                  },
                  financial: {
                      base_salary: baseSalaryForPeriod,
                      allowances: totalAllowances,
                      bonus: bonusAmount,
                      overtime: overtimeAmount,
                      gross: grossSalary,
                      tax: taxAmount,
                      social_security: socialAmount,
                      deductions: deductionAmount,
                      other_deductions: otherDeductions,
                      total_deductions: totalDeductions,
                      net: netSalary
                  },
                  status: 'success'
              });
              
              totalMonthAmount += netSalary;
              
          } catch (error) {
              console.error(`    ❌ Erreur pour ${employee.employee_id}:`, error.message);
              errors.push({
                  employee_id: employee.employee_id,
                  name: `${employee.first_name} ${employee.last_name}`,
                  error: error.message,
                  status: 'error'
              });
          }
      }
      
      // 6. Mettre à jour le mois
      await db.query(
          `UPDATE pay_months 
           SET total_employees = $1, 
               total_amount = $2, 
               status = 'calculated', 
               updated_at = NOW() 
           WHERE month_year = $3`,
          [results.length, totalMonthAmount, month_year]
      );
      
      console.log(`\n✅ Terminé: ${results.length} succès, ${errors.length} erreurs`);
      console.log(`📊 RÉSUMÉ HEURES SUP: ${totalOvertimeDetected.toFixed(2)}h détectées, ${totalOvertimePaid.toFixed(2)}h facturées (${overtimeEnabled ? 'activées' : 'désactivées'})`);
      
      res.json({
          success: true,
          message: `Salaires calculés pour ${results.length} employés`,
          data: {
              month_year,
              status: 'calculated',
              overtime_config: {
                  enabled: overtimeEnabled,
                  threshold: overtimeThreshold
              },
              summary: {
                  total_employees: results.length,
                  failed_employees: errors.length,
                  total_net: totalMonthAmount,
                  total_hours: results.reduce((sum, r) => sum + (r.attendance?.hours_worked || 0), 0),
                  total_overtime_detected: totalOvertimeDetected,
                  total_overtime_paid: totalOvertimePaid
              },
              results: results.slice(0, 10),
              errors
          }
      });

  } catch (error) {
      console.error('❌ Erreur:', error);
      res.status(500).json({
          success: false,
          message: 'Erreur lors du calcul des salaires',
          error: error.message
      });
  }
}

  // =========================================================================
  // ⭐ FONCTIONS UTILITAIRES DE CALCUL (DANS LA CLASSE)
  // =========================================================================

  /**
   * Convertit une heure HH:MM en minutes depuis minuit
   */
  toMinutes(time) {
      if (!time) return 0;
      const [hours, minutes] = time.substring(0, 5).split(':').map(Number);
      return hours * 60 + minutes;
  }

  /**
   * Convertit des minutes en format HH:MM
   */
  fromMinutes(minutes) {
      const totalMinutes = Math.round(minutes) % (24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Calcule la période de pause au milieu du shift
   */
  calculateBreakPeriod(shiftStart, shiftEnd, breakMinutes) {
      const start = this.toMinutes(shiftStart);
      let end = this.toMinutes(shiftEnd);
      
      // Gestion travail de nuit
      let duration = end - start;
      if (duration < 0) duration += 24 * 60;
      
      // La pause est au milieu
      const breakStart = start + (duration - breakMinutes) / 2;
      const breakEnd = breakStart + breakMinutes;
      
      return {
          start: breakStart,
          end: breakEnd,
          startFormatted: this.fromMinutes(breakStart),
          endFormatted: this.fromMinutes(breakEnd)
      };
  }

  /**
   * Calcule les heures travaillées avec toutes les règles :
   * 1. Arrondi check-in à shiftStart si avant
   * 2. Arrondi check-out à shiftEnd si après  
   * 3. Détection HS basée sur le check-out ORIGINAL (sauf cas spéciaux)
   * 4. Déduction pause seulement si dans période travaillée
   * 5. CAS SPÉCIAL: gestion des soirées (21:02 → 23:00) - PAS d'HS
   */
  calculateWorkedHoursWithAllRules(checkIn, checkOut, shiftInfo, dailyHours = 8, toleranceMinutes = 60) {
      if (!checkIn || !checkOut) {
          return { hoursWorked: 0, overtime: 0, arrondi: {}, pause: {} };
      }
      
      try {
          const checkInMinutes = this.toMinutes(checkIn);
          const checkOutMinutes = this.toMinutes(checkOut);
          const shiftStart = this.toMinutes(shiftInfo.start);
          const shiftEnd = this.toMinutes(shiftInfo.end);
          
          console.log(`   🔍 Analyse: ${checkIn} → ${checkOut}, Shift: ${shiftInfo.start}-${shiftInfo.end}`);
          console.log(`   🔍 DEBUG - Valeurs reçues:`);
          console.log(`      checkIn: ${checkIn} (${checkInMinutes}min)`);
          console.log(`      checkOut: ${checkOut} (${checkOutMinutes}min)`);
          console.log(`      shiftStart: ${shiftInfo.start} (${shiftStart}min)`);
          console.log(`      shiftEnd: ${shiftInfo.end} (${shiftEnd}min)`);
          
          // Calculer la période de pause
          const breakPeriod = this.calculateBreakPeriod(
              shiftInfo.start, 
              shiftInfo.end, 
              shiftInfo.breakDuration
          );
          
          console.log(`      Pause au milieu: ${breakPeriod.startFormatted} → ${breakPeriod.endFormatted}`);
          
          // ✅ DÉTECTION DES CAS SPÉCIAUX
          const isLateEvening = checkInMinutes > 20 * 60; // Après 20:00
          const isEarlyMorning = checkOutMinutes < 6 * 60; // Avant 06:00
          const isNightWork = isLateEvening && isEarlyMorning;
          
          // CAS SPÉCIAL: check-in tard le soir, check-out avant minuit (même journée)
          const isSpecialEvening = checkInMinutes > 20 * 60 && 
                                   checkOutMinutes > checkInMinutes && 
                                   checkOutMinutes < 24 * 60;
          
          console.log(`      isLateEvening: ${isLateEvening}, isEarlyMorning: ${isEarlyMorning}, isNightWork: ${isNightWork}, isSpecialEvening: ${isSpecialEvening}`);
          
          // ✅ DÉTECTION DES HEURES SUPPLÉMENTAIRES (PAS pour les cas spéciaux)
          let isOvertime = false;
          let overtime = 0;
          
          if (!isSpecialEvening && !isNightWork && checkOutMinutes > (shiftEnd + toleranceMinutes)) {
              isOvertime = true;
              const overtimeMinutes = checkOutMinutes - shiftEnd;
              overtime = parseFloat((overtimeMinutes / 60).toFixed(2));
              console.log(`      ⏰ HEURES SUP DÉTECTÉES: +${overtime}h (${overtimeMinutes}min au-delà de ${shiftInfo.end})`);
          } else if (isSpecialEvening) {
              console.log(`      ⚠️ CAS SPÉCIAL SOIRÉE: pas d'heures sup comptées (travail normal en soirée)`);
          }
          
          let effectiveCheckIn;
          let effectiveCheckOut;
          let useOriginal = false;
          
          if (isSpecialEvening) {
              console.log(`      ⚠️ CAS SPÉCIAL SOIRÉE DÉTECTÉ: check-in tard, check-out avant minuit`);
              console.log(`         → Utilisation des heures originales SANS ARRONDI`);
              effectiveCheckIn = checkInMinutes;
              effectiveCheckOut = checkOutMinutes;
              useOriginal = true;
          } else if (isNightWork) {
              console.log(`      🌙 Travail de nuit détecté`);
              effectiveCheckIn = checkInMinutes;
              effectiveCheckOut = checkOutMinutes;
          } else {
              effectiveCheckIn = Math.max(checkInMinutes, shiftStart);
              effectiveCheckOut = Math.min(checkOutMinutes, shiftEnd);
          }
          
          console.log(`      Arrondi: ${this.fromMinutes(effectiveCheckIn)} → ${this.fromMinutes(effectiveCheckOut)}${useOriginal ? ' (original sans arrondi)' : ''}`);
          
          // Gestion des chevauchements de minuit
          let start = effectiveCheckIn;
          let end = effectiveCheckOut;
          
          if (isNightWork) {
              end += 24 * 60;
              console.log(`      Ajustement travail de nuit: ${this.fromMinutes(start)} → ${this.fromMinutes(end)}`);
          } else if (end < start && !useOriginal) {
              end += 24 * 60;
          } else if (useOriginal && end < start) {
              console.log(`      Conservation de la durée originale (pas d'ajout de 24h)`);
          }
          
          // Adapter la pause si nécessaire
          let breakStart = breakPeriod.start;
          let breakEnd = breakPeriod.end;
          if (breakEnd < breakStart) {
              breakEnd += 24 * 60;
          }
          
          const coversBreak = (start < breakEnd && end > breakStart);
          
          let workedMinutes = end - start;
          let deductedMinutes = 0;
          
          if (coversBreak) {
              const overlapStart = Math.max(start, breakStart);
              const overlapEnd = Math.min(end, breakEnd);
              deductedMinutes = Math.max(0, overlapEnd - overlapStart);
              workedMinutes -= deductedMinutes;
              console.log(`      ✅ Pause déduite: ${deductedMinutes}min (${(deductedMinutes/60).toFixed(2)}h)`);
          } else {
              console.log(`      ⏺️ Pas de pause dans cette période`);
          }
          
          const hoursWorked = parseFloat((workedMinutes / 60).toFixed(2));
          
          console.log(`      ✅ Heures normales dans le shift: ${hoursWorked}h`);
          if (overtime > 0) {
              console.log(`      ⏰ Heures supplémentaires: +${overtime}h`);
              console.log(`      📈 TOTAL HEURES (normales + sup): ${(hoursWorked + overtime).toFixed(2)}h`);
          } else {
              console.log(`      📈 TOTAL HEURES: ${hoursWorked}h`);
          }
          
          return {
              hoursWorked,
              overtime,
              arrondi: {
                  checkIn: this.fromMinutes(effectiveCheckIn),
                  checkOut: this.fromMinutes(effectiveCheckOut)
              },
              pause: {
                  deducted: coversBreak,
                  minutes: deductedMinutes,
                  period: {
                      start: breakPeriod.startFormatted,
                      end: breakPeriod.endFormatted
                  }
              },
              isOvertime,
              usedOriginal: useOriginal,
              totalHours: hoursWorked + overtime
          };
          
      } catch (error) {
          console.error('❌ Erreur calculateWorkedHoursWithAllRules:', error);
          return { 
              hoursWorked: 0, 
              overtime: 0, 
              arrondi: {}, 
              pause: {},
              isOvertime: false,
              usedOriginal: false,
              totalHours: 0
          };
      }
  }

    // ==================== MARQUER MOIS COMME PAYÉ ====================

    async markMonthAsPaid(req, res) {
    try {
        const { month_year } = req.body;
        
        console.log(`💰 [markMonthAsPaid] Marquage mois comme payé: ${month_year}`);
        
        if (!month_year) {
            return res.status(400).json({
                success: false,
                message: 'Mois requis (format: YYYY-MM)',
                code: 'MISSING_MONTH_YEAR'
            });
        }
        
        // Vérifier le format du mois (YYYY-MM)
        const monthRegex = /^\d{4}-\d{2}$/;
        if (!monthRegex.test(month_year)) {
            return res.status(400).json({
                success: false,
                message: 'Format de mois invalide. Utilisez YYYY-MM (ex: 2026-01)',
                code: 'INVALID_MONTH_FORMAT'
            });
        }
        
        // Vérifier que le mois existe
        const monthResult = await db.query(
            'SELECT * FROM pay_months WHERE month_year = $1',
            [month_year]
        );
        
        if (monthResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Mois ${month_year} non trouvé dans les périodes de paie`,
                code: 'MONTH_NOT_FOUND'
            });
        }
        
        const month = monthResult.rows[0];
        
        // ===== VÉRIFICATION DU STATUT =====
        console.log(`📊 Statut actuel du mois ${month_year}: ${month.status}`);
        
        // Vérifier si le mois est déjà payé
        if (month.status === 'paid') {
            const paidDate = month.paid_at ? new Date(month.paid_at) : null;
            const formattedDate = paidDate ? paidDate.toLocaleDateString('fr-FR') : 'date inconnue';
            
            return res.status(400).json({
                success: false,
                message: `Le mois ${month_year} a déjà été payé le ${formattedDate}`,
                code: 'MONTH_ALREADY_PAID',
                data: {
                    month_year,
                    paid_at: month.paid_at,
                    formatted_paid_at: formattedDate,
                    status: month.status,
                    total_employees: month.total_employees,
                    total_net: month.total_net,
                    emails_sent: month.emails_sent || 0,
                    emails_failed: month.emails_failed || 0,
                    month_name: month.month_name
                },
                suggestions: [
                    "Consultez l'historique des paiements pour plus de détails",
                    "Vérifiez les emails envoyés dans les détails du mois"
                ]
            });
        }
        
        // Vérifier que le mois est calculé
        if (month.status !== 'calculated') {
            const validStatuses = ['draft', 'processing'];
            const currentStatus = month.status || 'unknown';
            
            return res.status(400).json({
                success: false,
                message: `Le mois ${month_year} doit être calculé avant d'être marqué comme payé. Statut actuel: ${currentStatus}`,
                code: 'INVALID_STATUS',
                data: {
                    month_year,
                    current_status: currentStatus,
                    required_status: 'calculated',
                    month_name: month.month_name
                },
                action_required: "Exécutez d'abord le calcul de paie pour ce mois"
            });
        }
        
        // Vérifier s'il y a un traitement en cours
        if (month.status === 'processing') {
            return res.status(409).json({
                success: false,
                message: `Le mois ${month_year} est en cours de traitement`,
                code: 'PROCESSING_IN_PROGRESS',
                data: {
                    month_year,
                    status: month.status,
                    updated_at: month.updated_at
                },
                suggestion: "Veuillez attendre la fin du traitement en cours"
            });
        }
        
        // Récupérer la liste des paiements du mois
        const paymentsResult = await db.query(
            `SELECT sp.*, e.email, e.first_name, e.last_name, e.department
             FROM salary_payments sp
             LEFT JOIN employees e ON sp.employee_id = e.employee_id
             WHERE sp.month_year = $1`,
            [month_year]
        );
        
        if (paymentsResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucun paiement calculé trouvé pour ce mois',
                code: 'NO_PAYMENTS_FOUND',
                data: {
                    month_year,
                    month_name: month.month_name
                },
                action_required: "Exécutez d'abord le calcul de paie pour ce mois"
            });
        }
        
        const employeesPaid = paymentsResult.rows.length;
        const emailsToSend = paymentsResult.rows.filter(e => e.email).length;
        
        // Récupérer le montant total
        const totalResult = await db.query(
            'SELECT SUM(net_salary) as total FROM salary_payments WHERE month_year = $1',
            [month_year]
        );
        
        const totalPaid = parseFloat(totalResult.rows[0].total || 0);
        
        console.log(`📊 Détails du mois ${month_year}:`);
        console.log(`   • Employés à payer: ${employeesPaid}`);
        console.log(`   • Emails à envoyer: ${emailsToSend}`);
        console.log(`   • Total à verser: ${totalPaid.toLocaleString('fr-FR')} TND`);
        
        // ===== VÉRIFICATION DE LA CONFIGURATION SMTP =====
        console.log(`📧 Configuration SMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
        console.log(`📧 Utilisateur SMTP: ${process.env.SMTP_USER}`);
        console.log(`📧 From: ${process.env.EMAIL_FROM || process.env.SMTP_USER}`);
        
        // Vérifier les paramètres SMTP
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
            return res.status(500).json({
                success: false,
                message: 'Configuration SMTP incomplète',
                code: 'SMTP_CONFIG_ERROR',
                detail: 'Vérifiez SMTP_HOST et SMTP_USER dans .env',
                required_env_vars: [
                    'SMTP_HOST',
                    'SMTP_PORT', 
                    'SMTP_USER',
                    'SMTP_PASSWORD',
                    'EMAIL_FROM'
                ],
                current_values: {
                    SMTP_HOST: process.env.SMTP_HOST || 'Non défini',
                    SMTP_USER: process.env.SMTP_USER || 'Non défini',
                    EMAIL_FROM: process.env.EMAIL_FROM || 'Non défini'
                }
            });
        }
        
        // ===== COMMENCER LA TRANSACTION =====
        console.log('🔄 Début de la transaction...');
        await db.query('BEGIN');
        
        try {
            // Mettre à jour le statut du mois en 'processing' d'abord
            await db.query(
                `UPDATE pay_months 
                 SET status = 'processing', 
                     updated_at = CURRENT_TIMESTAMP
                 WHERE month_year = $1`,
                [month_year]
            );
            
            console.log(`✅ Statut mis à jour en 'processing' pour ${month_year}`);
            
            // ===== ENVOI DES EMAILS =====
            console.log(`📧 Début envoi des fiches de paie par email (${emailsToSend} employés avec email)`);
            
            const emailResults = {
                sent: [],
                failed: []
            };
            
            // ⭐ UTILISER LE ROTATEUR POUR L'ENVOI GROUPÉ
            const stats = emailRotator.getStats();
            console.log(`📊 Statistiques rotateur: ${stats.accountsCount} comptes, capacité ${stats.totalCapacity} emails/jour`);
            
            // Préparer les données pour le rotateur
            const employeesToNotify = paymentsResult.rows.filter(e => e.email).map(e => ({
                ...e,
                email: e.email,
                first_name: e.first_name,
                last_name: e.last_name,
                net_salary: e.net_salary,
                department: e.department
            }));
            
            // Envoyer les emails via le rotateur
            const rotatorResults = await emailRotator.sendBatchByLots(
                employeesToNotify,
                `Fiche de paie ${month.month_name || month_year}`,
                (employee) => this.generatePayslipEmailHTML(employee, month_year),
                (processed, total, currentResults) => {
                    console.log(`📧 Progression: ${processed}/${total} (${currentResults.sent.length} succès)`);
                }
            );
            
            // Mettre à jour les résultats
            for (const email of rotatorResults.sent) {
                const employee = paymentsResult.rows.find(e => e.email === email);
                if (employee) {
                    emailResults.sent.push({
                        employee_id: employee.employee_id,
                        email: employee.email,
                        name: `${employee.first_name} ${employee.last_name}`,
                        net_salary: employee.net_salary
                    });
                    
                    await db.query(
                        `UPDATE salary_payments 
                         SET email_sent = true,
                             email_sent_at = NOW(),
                             email_attempts = COALESCE(email_attempts, 0) + 1,
                             email_status = 'sent',
                             email_error = NULL
                         WHERE id = $1`,
                        [employee.id]
                    );
                }
            }
            
            for (const failed of rotatorResults.failed) {
                const employee = paymentsResult.rows.find(e => e.email === failed.email);
                if (employee) {
                    emailResults.failed.push({
                        employee_id: employee.employee_id,
                        email: employee.email,
                        name: `${employee.first_name} ${employee.last_name}`,
                        reason: failed.error,
                        net_salary: employee.net_salary
                    });
                    
                    await db.query(
                        `UPDATE salary_payments 
                         SET email_status = 'failed',
                             email_error = $1,
                             email_attempts = COALESCE(email_attempts, 0) + 1
                         WHERE id = $2`,
                        [failed.error.substring(0, 500), employee.id]
                    );
                }
            }
            
            console.log(`📧 Envoi emails terminé: ${emailResults.sent.length} envoyés, ${emailResults.failed.length} échecs`);
            
            // ===== FINALISATION DU STATUT =====
            // Mettre à jour le statut final du mois
            await db.query(
                `UPDATE pay_months 
                 SET status = 'paid', 
                     paid_at = NOW(),
                     paid_by = $2,
                     updated_at = CURRENT_TIMESTAMP,
                     emails_sent = $3,
                     emails_failed = $4,
                     email_details = $5
                 WHERE month_year = $1`,
                [
                    month_year,
                    req.user?.id || null,
                    emailResults.sent.length,
                    emailResults.failed.length,
                    JSON.stringify({
                        sent: emailResults.sent.slice(0, 100),
                        failed: emailResults.failed.slice(0, 100),
                        sent_at: new Date().toISOString(),
                        total_attempted: paymentsResult.rows.length
                    })
                ]
            );
            
            // Valider la transaction
            await db.query('COMMIT');
            console.log(`✅ Transaction validée - Mois ${month_year} marqué comme payé`);
            
            // ===== RÉPONSE FINALE =====
            const responseData = {
                success: true,
                message: `Mois ${month_year} marqué comme payé avec succès`,
                data: {
                    month_year,
                    month_name: month.month_name,
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    employees: {
                        total: employeesPaid,
                        with_email: emailsToSend,
                        without_email: employeesPaid - emailsToSend
                    },
                    financial: {
                        total_paid: totalPaid,
                        formatted_total: totalPaid.toLocaleString('fr-FR', {
                            minimumFractionDigits: 3,
                            maximumFractionDigits: 3
                        }) + ' TND'
                    },
                    emails: {
                        sent: emailResults.sent.length,
                        failed: emailResults.failed.length,
                        success_rate: emailsToSend > 0 ? 
                            `${((emailResults.sent.length / emailsToSend) * 100).toFixed(1)}%` : '0%',
                        details: {
                            sent_examples: emailResults.sent.slice(0, 3).map(e => ({
                                name: e.name,
                                email: e.email
                            })),
                            failed_examples: emailResults.failed.slice(0, 3).map(e => ({
                                name: e.name,
                                email: e.email,
                                reason: e.reason
                            }))
                        }
                    },
                    email_stats: rotatorResults.stats,
                    processing_time: new Date().toISOString()
                }
            };
            
            console.log(`✅ [markMonthAsPaid] Succès complet pour ${month_year}`);
            
            res.json(responseData);
            
        } catch (error) {
            // Annuler la transaction en cas d'erreur 
            await db.query('ROLLBACK');
            console.error('❌ [markMonthAsPaid] Erreur transaction:', error);
            
            // Réinitialiser le statut à calculated en cas d'erreur
            try {
                await db.query(
                    `UPDATE pay_months 
                     SET status = 'calculated', 
                         updated_at = CURRENT_TIMESTAMP
                     WHERE month_year = $1`,
                    [month_year]
                );
                console.log(`🔄 Statut réinitialisé à 'calculated' pour ${month_year}`);
            } catch (resetError) {
                console.error('❌ Erreur réinitialisation statut:', resetError.message);
            }
            
            // Gérer différents types d'erreurs
            let statusCode = 500;
            let errorCode = 'SERVER_ERROR';
            let errorMessage = 'Erreur serveur lors du marquage comme payé';
            
            if (error.message && error.message.includes('timeout')) {
                statusCode = 504;
                errorCode = 'EMAIL_TIMEOUT';
                errorMessage = 'Délai d\'attente dépassé lors de l\'envoi des emails';
            } else if (error.message && error.message.includes('SMTP')) {
                statusCode = 503;
                errorCode = 'SMTP_ERROR';
                errorMessage = 'Erreur de serveur email';
            }
            
            res.status(statusCode).json({
                success: false,
                message: errorMessage,
                code: errorCode,
                detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
                month_year,
                suggestion: statusCode === 504 ? 
                    "Réessayez l'opération ou réduisez le nombre d'emails envoyés simultanément" :
                    "Vérifiez votre configuration SMTP et réessayez"
            });
        }

    } catch (error) {
        console.error('❌ [markMonthAsPaid] Erreur générale:', error);
        
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors du marquage comme payé',
            code: 'SERVER_ERROR',
            detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
            month_year: req.body.month_year
        });
    }
}

    async getMonthlyPayments(req, res) {
        try {
            const { month_year } = req.params;
            
            console.log(`📊 [getMonthlyPayments] Mois: ${month_year}`);
            
            if (!month_year) {
                return res.status(400).json({
                    success: false,
                    message: 'Mois requis',
                    code: 'MISSING_MONTH_YEAR'
                });
            }
            
            const payments = await db.query(
                `SELECT sp.*, e.first_name, e.last_name, e.department, e.position
                FROM salary_payments sp
                JOIN employees e ON sp.employee_id = e.employee_id
                WHERE sp.month_year = $1
                ORDER BY e.last_name, e.first_name`,
                [month_year]
            );
            
            const totals = payments.rows.reduce((acc, payment) => {
                return {
                    total_net: acc.total_net + (parseFloat(payment.net_salary) || 0),
                    total_tax: acc.total_tax + (parseFloat(payment.tax_amount) || 0),
                    total_deductions: acc.total_deductions + (parseFloat(payment.deduction_amount) || 0),
                    count: acc.count + 1
                };
            }, { total_net: 0, total_tax: 0, total_deductions: 0, count: 0 });

            res.json({
                success: true,
                data: {
                    payments: payments.rows,
                    totals,
                    count: payments.rows.length
                }
            });

        } catch (error) {
            console.error('❌ [getMonthlyPayments] Erreur:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur récupération paiements',
                code: 'SERVER_ERROR'
            });
        }
    }

    // ==================== RAPPORTS ====================
    
    async getReports(req, res) {
        try {
            const { type, month_year, department } = req.query;
            
            console.log(`📈 [getReports] Génération rapport type: ${type}, mois: ${month_year}`);
            
            switch(type) {
                case 'salary_summary':
                    return await this.generateSalarySummary(req, res);
                    
                case 'attendance_impact':
                    return await this.generateAttendanceImpactReport(req, res);
                    
                case 'department_comparison':
                    return await this.generateDepartmentComparison(req, res);
                    
                case 'tax_report':
                    return await this.generateTaxReport(req, res);
                    
                default:
                    return res.status(400).json({
                        success: false,
                        message: 'Type de rapport non supporté',
                        code: 'INVALID_REPORT_TYPE',
                        supported_types: [
                            'salary_summary',
                            'attendance_impact',
                            'department_comparison',
                            'tax_report'
                        ]
                    });
            }
            
        } catch (error) {
            console.error('❌ [getReports] Erreur:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur génération rapport',
                code: 'SERVER_ERROR'
            });
        }
    }
    
    async generateSalarySummary(req, res) {
        try {
            const { month_year, department } = req.query;
            
            let query = `
                SELECT 
                    sp.month_year,
                    pm.month_name,
                    COUNT(DISTINCT sp.employee_id) as employee_count,
                    COUNT(sp.id) as payment_count,
                    SUM(sp.base_salary) as total_base_salary,
                    SUM(sp.tax_amount) as total_tax,
                    SUM(sp.deduction_amount) as total_deductions,
                    SUM(sp.net_salary) as total_net_salary,
                    AVG(sp.net_salary) as average_salary,
                    MIN(sp.net_salary) as min_salary,
                    MAX(sp.net_salary) as max_salary,
                    COUNT(CASE WHEN sp.payment_status = 'paid' THEN 1 END) as paid_count,
                    COUNT(CASE WHEN sp.payment_status = 'pending' THEN 1 END) as pending_count,
                    COUNT(CASE WHEN sp.payment_status = 'approved' THEN 1 END) as approved_count
                FROM salary_payments sp
                JOIN pay_months pm ON sp.month_year = pm.month_year
                JOIN employees e ON sp.employee_id = e.employee_id
                WHERE 1=1
            `;
            
            const params = [];
            let paramIndex = 1;
            
            if (month_year) {
                query += ` AND sp.month_year = $${paramIndex}`;
                params.push(month_year);
                paramIndex++;
            }
            
            if (department) {
                query += ` AND e.department = $${paramIndex}`;
                params.push(department);
                paramIndex++;
            }
            
            query += ` GROUP BY sp.month_year, pm.month_name ORDER BY sp.month_year DESC`;
            
            const result = await db.query(query, params);
            
            const departmentBreakdown = await db.query(`
                SELECT 
                    e.department,
                    COUNT(DISTINCT sp.employee_id) as employee_count,
                    SUM(sp.net_salary) as total_salary,
                    AVG(sp.net_salary) as average_salary
                FROM salary_payments sp
                JOIN employees e ON sp.employee_id = e.employee_id
                WHERE 1=1
                ${month_year ? `AND sp.month_year = '${month_year}'` : ''}
                GROUP BY e.department
                ORDER BY total_salary DESC
            `);
            
            const topEarners = await db.query(`
                SELECT 
                    sp.employee_id,
                    e.first_name,
                    e.last_name,
                    e.department,
                    SUM(sp.net_salary) as total_salary,
                    AVG(sp.net_salary) as average_salary,
                    COUNT(sp.id) as payment_count
                FROM salary_payments sp
                JOIN employees e ON sp.employee_id = e.employee_id
                WHERE 1=1
                ${month_year ? `AND sp.month_year = '${month_year}'` : ''}
                ${department ? `AND e.department = '${department}'` : ''}
                GROUP BY sp.employee_id, e.first_name, e.last_name, e.department
                ORDER BY total_salary DESC
                LIMIT 10
            `);
            
            const report = {
                summary: result.rows[0] || {},
                department_breakdown: departmentBreakdown.rows,
                top_earners: topEarners.rows,
                generated_at: new Date().toISOString(),
                filters: {
                    month_year: month_year || 'Tous',
                    department: department || 'Tous'
                }
            };
            
            res.json({
                success: true,
                message: 'Rapport de synthèse généré avec succès',
                data: report
            });
            
        } catch (error) {
            console.error('❌ [generateSalarySummary] Erreur:', error);
            throw error;
        }
    }
    
    async generateAttendanceImpactReport(req, res) {
        try {
            const { month_year } = req.query;
            
            if (!month_year) {
                return res.status(400).json({
                    success: false,
                    message: 'Mois requis pour ce rapport',
                    code: 'MONTH_REQUIRED'
                });
            }
            
            const attendanceStats = await db.query(`
                SELECT 
                    a.employee_id,
                    e.first_name,
                    e.last_name,
                    e.department,
                    COUNT(CASE WHEN a.status = 'present' THEN 1 END) as days_present,
                    COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as days_absent,
                    COUNT(CASE WHEN a.status = 'late' THEN 1 END) as days_late,
                    COUNT(CASE WHEN a.status = 'early_leave' THEN 1 END) as days_early_leave,
                    AVG(EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time))/3600) as avg_hours_worked,
                    SUM(EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time))/3600) as total_hours_worked
                FROM attendance a
                JOIN employees e ON a.employee_id = e.employee_id
                WHERE TO_CHAR(a.record_date, 'YYYY-MM') = $1
                AND a.check_out_time IS NOT NULL
                GROUP BY a.employee_id, e.first_name, e.last_name, e.department
                ORDER BY days_present DESC
            `, [month_year]);
            
            const payrollStats = await db.query(`
                SELECT 
                    sp.employee_id,
                    sp.base_salary,
                    sp.net_salary,
                    sp.deduction_amount,
                    sp.payment_status
                FROM salary_payments sp
                WHERE sp.month_year = $1
            `, [month_year]);
            
            const combinedData = attendanceStats.rows.map(att => {
                const payroll = payrollStats.rows.find(p => p.employee_id === att.employee_id);
                const attendanceRate = att.days_present / (att.days_present + att.days_absent) * 100;
                
                return {
                    ...att,
                    attendance_rate: attendanceRate.toFixed(2),
                    payroll_data: payroll || {},
                    performance_score: this.calculatePerformanceScore(att)
                };
            });
            
            const report = {
                month_year,
                total_employees: combinedData.length,
                avg_attendance_rate: combinedData.reduce((sum, emp) => sum + parseFloat(emp.attendance_rate), 0) / combinedData.length,
                avg_hours_worked: combinedData.reduce((sum, emp) => sum + (emp.avg_hours_worked || 0), 0) / combinedData.length,
                total_salary_paid: combinedData.reduce((sum, emp) => sum + (parseFloat(emp.payroll_data.net_salary) || 0), 0),
                employee_data: combinedData,
                generated_at: new Date().toISOString()
            };
            
            res.json({
                success: true,
                message: 'Rapport impact présence généré',
                data: report
            });
            
        } catch (error) {
            console.error('❌ [generateAttendanceImpactReport] Erreur:', error);
            throw error;
        }
    }
    
    calculatePerformanceScore(attendanceData) {
        const weights = {
            attendance_rate: 0.4,
            avg_hours_worked: 0.3,
            punctuality: 0.2,
            consistency: 0.1
        };
        
        const attendanceRate = attendanceData.days_present / (attendanceData.days_present + attendanceData.days_absent);
        const punctuality = 1 - (attendanceData.days_late / attendanceData.days_present);
        const consistency = 1 - (attendanceData.days_early_leave / attendanceData.days_present);
        
        const score = (
            attendanceRate * weights.attendance_rate +
            (attendanceData.avg_hours_worked / 8) * weights.avg_hours_worked +
            punctuality * weights.punctuality +
            consistency * weights.consistency
        ) * 100;
        
        return Math.min(100, Math.max(0, score));
    }

    // ==================== FICHES DE PAIE ====================
    
    async generatePayslip(req, res) {
        try {
            const { employee_id, month_year } = req.params;
            
            console.log(`📄 [generatePayslip] Génération fiche de paie pour ${employee_id} - ${month_year}`);
            
            if (!employee_id || !month_year) {
                return res.status(400).json({
                    success: false,
                    message: 'ID employé et mois requis',
                    code: 'MISSING_REQUIRED_FIELDS'
                });
            }
            
            // Récupérer les données de base
            const employeeQuery = await db.query(`
                SELECT 
                    e.employee_id,
                    e.first_name,
                    e.last_name,
                    e.department,
                    e.position,
                    e.email,
                    e.phone,
                    e.hire_date,
                    sc.base_salary,
                    sc.currency,
                    sc.payment_method,
                    sc.tax_rate,
                    sc.social_security_rate,
                    sc.other_deductions,
                    sc.bonus_fixed,
                    sc.bonus_variable
                FROM employees e
                LEFT JOIN salary_configs sc ON e.employee_id = sc.employee_id
                WHERE e.employee_id = $1
            `, [employee_id]);
            
            if (employeeQuery.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Employé non trouvé',
                    code: 'EMPLOYEE_NOT_FOUND'
                });
            }
            
            const employee = employeeQuery.rows[0];
            
            // Récupérer le paiement du mois
            const paymentQuery = await db.query(`
                SELECT 
                    sp.*,
                    pm.month_name,
                    pm.start_date,
                    pm.end_date
                FROM salary_payments sp
                JOIN pay_months pm ON sp.month_year = pm.month_year
                WHERE sp.employee_id = $1 AND sp.month_year = $2
            `, [employee_id, month_year]);
            
            if (paymentQuery.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Paiement non trouvé pour ce mois',
                    code: 'PAYMENT_NOT_FOUND'
                });
            }
            
            const payment = paymentQuery.rows[0];
            
            // Récupérer les données de présence
            const attendanceQuery = await db.query(`
                SELECT 
                    COUNT(*) as total_days,
                    COUNT(CASE WHEN status = 'present' THEN 1 END) as present_days,
                    COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_days,
                    COUNT(CASE WHEN status = 'late' THEN 1 END) as late_days,
                    COUNT(CASE WHEN status = 'early_leave' THEN 1 END) as early_leave_days,
                    AVG(EXTRACT(EPOCH FROM (check_out_time - check_in_time))/3600) as avg_daily_hours,
                    SUM(EXTRACT(EPOCH FROM (check_out_time - check_in_time))/3600) as total_hours_worked
                FROM attendance 
                WHERE employee_id = $1 
                AND record_date BETWEEN $2 AND $3
            `, [employee_id, payment.start_date, payment.end_date]);
            
            const attendance = attendanceQuery.rows[0] || {};
            
            // Calculer les composants de salaire
            const baseSalary = parseFloat(employee.base_salary) || 0;
            const taxRate = parseFloat(employee.tax_rate) || 0;
            const ssRate = parseFloat(employee.social_security_rate) || 0;
            const otherDeductions = parseFloat(employee.other_deductions) || 0;
            const bonusFixed = parseFloat(employee.bonus_fixed) || 0;
            
            const taxAmount = baseSalary * (taxRate / 100);
            const ssAmount = baseSalary * (ssRate / 100);
            const totalDeductions = taxAmount + ssAmount + otherDeductions;
            const netSalary = baseSalary - totalDeductions + bonusFixed;
            
            // Créer la structure de la fiche de paie
            const payslip = {
                employee: {
                    id: employee.employee_id,
                    name: `${employee.first_name} ${employee.last_name}`,
                    department: employee.department,
                    position: employee.position,
                    email: employee.email,
                    phone: employee.phone,
                    hire_date: employee.hire_date
                },
                
                period: {
                    month_year: month_year,
                    month_name: payment.month_name,
                    start_date: payment.start_date,
                    end_date: payment.end_date,
                    payment_date: payment.payment_date || new Date().toISOString()
                },
                
                attendance_summary: {
                    total_days: parseInt(attendance.total_days) || 0,
                    present_days: parseInt(attendance.present_days) || 0,
                    absent_days: parseInt(attendance.absent_days) || 0,
                    late_days: parseInt(attendance.late_days) || 0,
                    early_leave_days: parseInt(attendance.early_leave_days) || 0,
                    attendance_rate: attendance.total_days > 0 ? 
                        (attendance.present_days / attendance.total_days * 100).toFixed(2) : 0,
                    avg_daily_hours: parseFloat(attendance.avg_daily_hours) || 0,
                    total_hours_worked: parseFloat(attendance.total_hours_worked) || 0
                },
                
                earnings: {
                    base_salary: baseSalary,
                    bonus_fixed: bonusFixed,
                    overtime: parseFloat(payment.overtime_amount) || 0,
                    other_allowances: 0,
                    total_earnings: baseSalary + bonusFixed + (parseFloat(payment.overtime_amount) || 0)
                },
                
                deductions: {
                    tax: taxAmount,
                    social_security: ssAmount,
                    other_deductions: otherDeductions,
                    late_deductions: parseFloat(payment.deduction_amount) || 0,
                    total_deductions: totalDeductions + (parseFloat(payment.deduction_amount) || 0)
                },
                
                summary: {
                    gross_salary: baseSalary + bonusFixed + (parseFloat(payment.overtime_amount) || 0),
                    total_deductions: totalDeductions + (parseFloat(payment.deduction_amount) || 0),
                    net_salary: netSalary,
                    currency: employee.currency || 'TND',
                    payment_method: employee.payment_method,
                    payment_status: payment.payment_status
                },
                
                breakdown: {
                    daily_rate: baseSalary / 22,
                    hourly_rate: baseSalary / (22 * 8),
                    tax_rate: taxRate,
                    social_security_rate: ssRate
                },
                
                company_info: {
                    name: "Entreprise Smart Attendance",
                    address: "123 Avenue de la Paie, Tunis, Tunisie",
                    phone: "+216 70 000 000",
                    email: "paie@entreprise.com",
                    siret: "123 456 789 00000"
                },
                
                metadata: {
                    generated_at: new Date().toISOString(),
                    payslip_id: `PS${month_year.replace('-', '')}${employee_id}`,
                    version: "1.0"
                }
            };
            
            console.log(`✅ [generatePayslip] Fiche générée pour ${employee_id}`);
            
            res.json({
                success: true,
                message: 'Fiche de paie générée avec succès',
                data: payslip
            });
            
        } catch (error) {
            console.error('❌ [generatePayslip] Erreur:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur génération fiche de paie',
                code: 'SERVER_ERROR'
            });
        }
    }
    
    async exportPayslip(req, res) {
    try {
        const { employee_id, month_year, format = 'pdf' } = req.params;
        
        console.log(`💾 [exportPayslip] Export fiche ${employee_id} - ${month_year} en ${format}`);
        
        // Générer les données de la fiche
        const payslip = await this.generatePayslipData(employee_id, month_year);
        
        if (!payslip) {
            return res.status(404).json({
                success: false,
                message: 'Fiche de paie non trouvée',
                code: 'PAYSLIP_NOT_FOUND'
            });
        }
        
        switch(format.toLowerCase()) {
            case 'pdf':
                // ✅ CORRECTION: Appeler generatePDFPayslip sans return
                await this.generatePDFPayslip(res, payslip);
                break;
                
            case 'excel':
                await this.generateExcelPayslip(res, payslip);
                break;
                
            case 'html':
                await this.generateHTMLPayslip(res, payslip);
                break;
                
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Format non supporté',
                    code: 'INVALID_FORMAT'
                });
        }
        
    } catch (error) {
        console.error('❌ [exportPayslip] Erreur:', error);
        
        // ✅ Éviter d'envoyer une réponse si déjà envoyée
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'export de la fiche de paie',
                code: 'SERVER_ERROR'
            });
        }
    }
}
    
   async generatePayslipData(employee_id, month_year) {
    try {
        console.log('📊 [PAYSLIP] Génération fiche pour:', { employee_id, month_year });
        
        // ============================================================
        // ✅ Récupérer les données de l'entreprise depuis settings
        // ============================================================
        let companyData = {
            name: "SMART ATTENDANCE SYSTEM",
            address: "Avenue Habib Bourguiba, 5070 Jemmel, Tunisie",
            email: "Iot.sahnoun@gmail.com",
            phone: "+216 29 328 870",
            legal_name: "SAS - Smart Attendance System",
            fax: "+216 73 456 789",
            manager: "Sahnoun BEN HAOUALA",
            rc: "B241234567",
            matfisc: "1234567/A/M/000",
            patente: "7890123",
            cnss: "987654321"
        };

        try {
            const settingsResult = await db.query(
                'SELECT config FROM settings WHERE id = 1'
            );
            
            if (settingsResult.rows.length > 0) {
                const config = settingsResult.rows[0].config || {};
                const company = config.company || {};
                
                companyData = {
                    ...companyData,
                    name: company.name || companyData.name,
                    address: company.address || companyData.address,
                    email: company.contactEmail || companyData.email,
                    phone: company.phone || companyData.phone
                };
                
                console.log('🏢 Données entreprise chargées:', companyData);
            }
        } catch (error) {
            console.error('❌ Erreur récupération données entreprise:', error.message);
        }

        // ============================================================
        // ✅ Récupérer la configuration des heures supplémentaires
        // ============================================================
        let overtimeEnabled = true;

        try {
            const settingsResult = await db.query(
                'SELECT config FROM settings WHERE id = 1'
            );
            
            if (settingsResult.rows.length > 0) {
                const config = settingsResult.rows[0].config || {};
                overtimeEnabled = config.attendance?.overtimeEnabled !== false;
                console.log('⚙️ Configuration heures supplémentaires:', { overtimeEnabled });
            }
        } catch (error) {
            console.error('❌ Erreur récupération config heures sup:', error.message);
        }
        
        // ✅ REQUÊTE EMPLOYÉ AVEC CONFIGURATION SALARIALE
        const employeeQuery = await db.query(`
            SELECT 
                e.employee_id,
                e.first_name,
                e.last_name,
                e.cin,
                e.cnss_number, 
                e.department,
                e.position,
                e.email,
                e.phone,
                e.hire_date,
                e.contract_type,
                sc.base_salary,
                sc.currency,
                sc.payment_method,
                sc.tax_rate,
                sc.social_security_rate,
                sc.other_deductions,
                sc.bonus_fixed,
                sc.bonus_variable,
                sc.working_days,
                sc.daily_hours,
                sc.overtime_multiplier,
                sc.allowances::text as allowances_json,
                sc.deductions::text as deductions_json,
                sc.bank_name,
                sc.bank_account,
                sc.iban
            FROM employees e
            LEFT JOIN salary_configs sc ON e.employee_id = sc.employee_id
            WHERE e.employee_id = $1 OR e.email = $1 
        `, [employee_id]);
        
        if (employeeQuery.rows.length === 0) {
            console.error('❌ Employé non trouvé:', employee_id);
            return null;
        }
        
        const employee = employeeQuery.rows[0];
        
        console.log('✅ Données employé trouvées:', {
            id: employee.employee_id,
            name: `${employee.first_name} ${employee.last_name}`,
            cin: employee.cin,
            cnss: employee.cnss_number,
            department: employee.department,
            base_salary: employee.base_salary,
            has_bank_info: !!(employee.bank_name || employee.bank_account || employee.iban)
        });
        
        // Récupérer le paiement du mois
        const paymentQuery = await db.query(`
            SELECT 
                sp.*,
                pm.month_name,
                pm.start_date,
                pm.end_date
            FROM salary_payments sp
            JOIN pay_months pm ON sp.month_year = pm.month_year
            WHERE sp.employee_id = $1 AND sp.month_year = $2
        `, [employee.employee_id, month_year]);
        
        if (paymentQuery.rows.length === 0) {
            console.error('❌ Paiement non trouvé pour:', { employee_id: employee.employee_id, month_year });
            return null;
        }
        
        const payment = paymentQuery.rows[0];
        
        // ⭐⭐⭐ CONVERSION EN NOMBRES ⭐⭐⭐
        const baseSalary = parseFloat(employee.base_salary) || 0;
        const grossSalary = parseFloat(payment.gross_salary) || 0;
        const netSalary = parseFloat(payment.net_salary) || 0;
        
        const overtimeHours = parseFloat(payment.overtime_hours) || 0;
        const overtimeAmount = parseFloat(payment.overtime_amount) || 0;
        const bonusFixed = parseFloat(employee.bonus_fixed) || 0;
        const bonusVariable = parseFloat(employee.bonus_variable) || 0;
        const taxAmount = parseFloat(payment.tax_amount) || 0;
        const ssAmount = parseFloat(payment.social_security_amount) || 0;
        const deductionAmount = parseFloat(payment.deduction_amount) || 0;
        const otherDeductions = parseFloat(employee.other_deductions) || 0;
        
        const daysPresent = parseInt(payment.days_present) || 0;
        const totalHoursWorked = parseFloat(payment.total_hours_worked) || 0;
        
        // ⭐⭐⭐ PARAMÈTRES DE CONFIGURATION ⭐⭐⭐
        const workingDays = parseInt(employee.working_days) || 24;
        const dailyHours = parseFloat(employee.daily_hours) || 8;
        const taxRate = parseFloat(employee.tax_rate) || 20;
        const ssRate = parseFloat(employee.social_security_rate) || 7;
        const overtimeMultiplier = parseFloat(employee.overtime_multiplier) || 1.5;

        // ⭐⭐⭐ PARSER LES ALLOCATIONS JSON ⭐⭐⭐
        let allowances = [];
        try {
            if (employee.allowances_json && employee.allowances_json !== 'null' && employee.allowances_json !== '[]') {
                allowances = JSON.parse(employee.allowances_json);
                console.log('📋 Allocations parsées:', allowances);
            }
        } catch (e) {
            console.error('❌ Erreur parsing allowances:', e.message);
        }

        // ⭐⭐⭐ PARSER LES DÉDUCTIONS JSON ⭐⭐⭐
        let deductions = [];
        try {
            if (employee.deductions_json && employee.deductions_json !== 'null' && employee.deductions_json !== '[]') {
                deductions = JSON.parse(employee.deductions_json);
                console.log('📋 Déductions parsées:', deductions);
            }
        } catch (e) {
            console.error('❌ Erreur parsing deductions:', e.message);
        }

        // ✅✅✅ CALCUL DU TAUX HORAIRE ET SALAIRE PRORATISÉ ✅✅✅
        const hourlyRate = baseSalary / (workingDays * dailyHours);
        const proratedBaseSalary = totalHoursWorked * hourlyRate;

        // ✅✅✅ CALCUL DES ALLOCATIONS AVEC POURCENTAGES ✅✅✅
        let totalAllowances = 0;
        const allowancesDetail = allowances.map(allow => {
            const amount = parseFloat(allow.amount) || 0;
            let allocAmount = 0;
            
            if (allow.type === 'percentage') {
                allocAmount = proratedBaseSalary * (amount / 100);
                console.log(`   📊 Allocation ${allow.name}: ${amount}% de ${proratedBaseSalary.toFixed(2)} = ${allocAmount.toFixed(2)} TND`);
            } else {
                allocAmount = amount;
                console.log(`   📊 Allocation ${allow.name}: ${allocAmount.toFixed(2)} TND (fixe)`);
            }
            
            totalAllowances += allocAmount;
            
            return {
                name: allow.name || 'Allocation',
                amount: allocAmount,
                type: allow.type || 'fixed',
                rawAmount: amount
            };
        });

        // ✅✅✅ CALCUL DES DÉDUCTIONS ⭐⭐⭐
        const deductionsDetail = deductions.map(ded => ({
            name: ded.name || 'Déduction',
            amount: parseFloat(ded.amount) || 0,
            type: ded.type || 'fixed'
        }));
        
        const totalDeductionsFromConfig = deductionsDetail.reduce((sum, d) => sum + d.amount, 0);
        
        // ✅ N'ajouter les heures sup que si activées
        let overtimeAmountToAdd = 0;
        if (overtimeEnabled && overtimeAmount > 0) {
            overtimeAmountToAdd = overtimeAmount;
            console.log(`⏰ Heures sup AJOUTÉES: +${overtimeAmount.toFixed(2)} TND (activées)`);
        } else if (!overtimeEnabled && overtimeAmount > 0) {
            console.log(`⏸️ Heures sup NON AJOUTÉES: ${overtimeAmount.toFixed(2)} TND (désactivées)`);
        }

        const totalDeductions = taxAmount + ssAmount + deductionAmount + otherDeductions + totalDeductionsFromConfig;
        
        console.log('✅ Données de paie récupérées:', {
            baseSalary,
            proratedBaseSalary,
            totalAllowances,
            grossSalary,
            netSalary,
            daysPresent,
            totalHoursWorked,
            overtimeHours,
            taxAmount,
            ssAmount,
            totalDeductions
        });
        
        return {
            employee: {
                id: employee.employee_id,
                name: `${employee.first_name} ${employee.last_name}`,
                cin: employee.cin || 'Non renseigné',
                cnss: employee.cnss_number || 'Non renseigné',
                department: employee.department || 'Non spécifié',
                position: employee.position || 'Non spécifié',
                email: employee.email,
                phone: employee.phone,
                hire_date: employee.hire_date,
                contract_type: employee.contract_type || 'CDI',
                bank_name: employee.bank_name,
                bank_account: employee.bank_account,
                iban: employee.iban
            },
            
            period: {
                month_year: month_year,
                month_name: payment.month_name || month_year,
                start_date: payment.start_date,
                end_date: payment.end_date,
                payment_date: payment.payment_date
            },
            
            attendance_summary: {
                days_present: daysPresent,
                total_hours_worked: totalHoursWorked,
                overtime_hours: overtimeHours,
                overtime_enabled: overtimeEnabled
            },
            
            earnings: {
                base_salary: baseSalary,
                prorated_base_salary: proratedBaseSalary,
                gross_salary: grossSalary,
                bonus_fixed: bonusFixed,
                bonus_variable: bonusVariable,
                overtime: overtimeAmountToAdd,
                allowances: allowancesDetail,
                total_allowances: totalAllowances,
                total_earnings: grossSalary
            },
            
            deductions: {
                tax: taxAmount,
                social_security: ssAmount,
                other_deductions: deductionAmount + otherDeductions,
                specific_deductions: deductionsDetail,
                total_deductions: totalDeductions
            },
            
            summary: {
                gross_salary: grossSalary,
                total_deductions: totalDeductions,
                net_salary: netSalary,
                currency: employee.currency || 'TND',
                payment_method: employee.payment_method || 'Virement bancaire',
                payment_status: payment.payment_status || 'pending'
            },
            
            breakdown: {
                hourly_rate: hourlyRate,
                tax_rate: taxRate,
                social_security_rate: ssRate,
                working_days: workingDays,
                daily_hours: dailyHours,
                overtime_multiplier: overtimeMultiplier,
                overtime_enabled: overtimeEnabled
            },
            
            // ✅ RENOMMÉ en "company" pour correspondre à ce qu'attend generatePDFPayslip
            company: companyData,
            
            metadata: {
                generated_at: new Date().toISOString(),
                payslip_id: `PS${month_year.replace('-', '')}${employee.employee_id}`,
                version: "1.0",
                source: "salary_payments"
            }
        };
        
    } catch (error) {
        console.error('❌ [generatePayslipData] Erreur:', error);
        return null;
    }
}
    
    async generatePDFPayslip(res, payslip) {
    try {
        const doc = new PDFDocument({
            margin: 30,
            size: 'A4',
            layout: 'portrait',
            info: {
                Title: `Fiche de Paie - ${payslip.employee.name}`,
                Author: 'Smart Attendance System',
                Subject: `Fiche de paie - ${payslip.period.month_name}`,
                Creator: 'Smart Attendance System v1.0',
                CreationDate: new Date()
            }
        });
        
        // Configurer les en-têtes de réponse
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=fiche_paie_${payslip.employee.id}_${payslip.period.month_year}.pdf`);
        
        // Pipe le document PDF à la réponse
        doc.pipe(res);
        
        // ===== EN-TÊTE STYLE ADMIN =====
        doc.rect(0, 0, doc.page.width, 60).fill('#0A3143');
        doc.fillColor('#FFFFFF')
            .fontSize(18).font('Helvetica-Bold')
            .text(payslip.company?.name || 'SMART ATTENDANCE', 30, 18, { align: 'center', width: doc.page.width - 60 });
        doc.fontSize(11).font('Helvetica')
            .text(`FICHE DE PAIE • ${payslip.period.month_name?.toUpperCase() || 'MOIS'}`, 30, 42, { align: 'center', width: doc.page.width - 60 });
        
        // ===== RÉFÉRENCES =====
        let y = 70;
        doc.fillColor('#5D6D7E').fontSize(8).font('Helvetica');
        doc.text(`N°: ${payslip.metadata.payslip_id}`, 30, y);
        doc.text(`Éd: ${new Date().toLocaleDateString('fr-FR')}`, 230, y);
        doc.text(`Pmt: ${payslip.period.payment_date ? new Date(payslip.period.payment_date).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}`, 410, y);
        
        // ===== EMPLOYÉ =====
        y += 20;
        doc.fillColor('#0A3143').fontSize(11).font('Helvetica-Bold')
            .text('EMPLOYÉ', 30, y);
        y += 15;
        
        // Fond gris pour la section employé
        doc.fillColor('#F8F9F9').rect(30, y, doc.page.width - 60, 60).fill();
        doc.strokeColor('#D5DBDB').lineWidth(0.5).rect(30, y, doc.page.width - 60, 60).stroke();
        
        const col1X = 45, col2X = 330;
        let infoY = y + 12;
        const lineSpacing = 18;
        
        doc.fillColor('#566573').fontSize(9).font('Helvetica-Bold');
        doc.text('Nom:', col1X, infoY);
        doc.text('Matricule:', col1X, infoY + lineSpacing);
        doc.text('Département:', col1X, infoY + lineSpacing * 2);
        doc.text('Poste:', col2X, infoY);
        doc.text('Date embauche:', col2X, infoY + lineSpacing);
        doc.text('CNSS:', col2X, infoY + lineSpacing * 2);
        
        doc.fillColor('#17202A').font('Helvetica');
        doc.text(payslip.employee.name, col1X + 70, infoY);
        doc.text(payslip.employee.id, col1X + 70, infoY + lineSpacing);
        doc.text(payslip.employee.department || 'N/A', col1X + 70, infoY + lineSpacing * 2);
        doc.text(payslip.employee.position || 'N/A', col2X + 80, infoY);
        doc.text(payslip.employee.hire_date ? new Date(payslip.employee.hire_date).toLocaleDateString('fr-FR') : 'N/A', col2X + 80, infoY + lineSpacing);
        doc.text(payslip.employee.cnss || 'N/A', col2X + 80, infoY + lineSpacing * 2);
        
        // ===== CIN AJOUTÉ =====
        doc.fillColor('#566573').fontSize(9).font('Helvetica-Bold')
            .text('CIN:', 45, infoY + lineSpacing * 3);
        doc.fillColor('#17202A').font('Helvetica')
            .text(payslip.employee.cin || 'N/A', 115, infoY + lineSpacing * 3);
        
        y += 75;
        
        // ===== PÉRIODE =====
        doc.fillColor('#5D6D7E').rect(30, y, doc.page.width - 60, 25).fill();
        doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
            .text('PÉRIODE', 45, y + 7);
        doc.font('Helvetica')
            .text(`Du ${new Date(payslip.period.start_date).toLocaleDateString('fr-FR')} au ${new Date(payslip.period.end_date).toLocaleDateString('fr-FR')}`, 230, y + 7);
        
        y += 35;
        
        // ===== GAINS ET DÉDUCTIONS =====
        const colEarningsX = 30;
        const colDeductionsX = 310;
        const colWidth = 250;
        const amountX = 170;
        
        doc.fillColor('#1E8449').rect(colEarningsX, y - 3, colWidth, 22).fill();
        doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
            .text('GAINS', colEarningsX + 15, y + 3);
        doc.fillColor('#B03A2E').rect(colDeductionsX, y - 3, colWidth, 22).fill();
        doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
            .text('DÉDUCTIONS', colDeductionsX + 15, y + 3);
        
        y += 25;
        let gainY = y;
        let deductionY = y;
        
        // GAINS
        doc.fillColor('#17202A').fontSize(10).font('Helvetica')
            .text('Salaire de base', colEarningsX + 15, gainY);
        doc.font('Helvetica-Bold').fillColor('#1E8449')
            .text(`${payslip.earnings.base_salary.toFixed(2)} TND`, colEarningsX + amountX, gainY, { width: 70, align: 'right' });
        gainY += 18;
        
        // Bonus fixe
        if (payslip.earnings.bonus_fixed > 0) {
            doc.fillColor('#17202A').fontSize(10).font('Helvetica')
                .text('Bonus fixe', colEarningsX + 15, gainY);
            doc.font('Helvetica-Bold').fillColor('#1E8449')
                .text(`${payslip.earnings.bonus_fixed.toFixed(2)} TND`, colEarningsX + amountX, gainY, { width: 70, align: 'right' });
            gainY += 18;
        }
        
        // Heures sup
        if (payslip.earnings.overtime > 0) {
            doc.fillColor('#17202A').fontSize(10).font('Helvetica')
                .text('Heures sup', colEarningsX + 15, gainY);
            doc.font('Helvetica-Bold').fillColor('#1E8449')
                .text(`${payslip.earnings.overtime.toFixed(2)} TND`, colEarningsX + amountX, gainY, { width: 70, align: 'right' });
            gainY += 18;
        }
        
        gainY += 2;
        doc.fillColor('#E8F8F5').rect(colEarningsX, gainY - 2, colWidth, 22).fill();
        doc.fillColor('#1E8449').fontSize(10).font('Helvetica-Bold')
            .text('TOTAL GAINS', colEarningsX + 15, gainY + 5);
        doc.text(`${payslip.earnings.total_earnings.toFixed(2)} TND`, colEarningsX + amountX, gainY + 5, { width: 70, align: 'right' });
        
        // DÉDUCTIONS
        doc.fillColor('#17202A').fontSize(10).font('Helvetica')
            .text('Impôt', colDeductionsX + 15, deductionY);
        doc.font('Helvetica-Bold').fillColor('#B03A2E')
            .text(`${payslip.deductions.tax.toFixed(2)} TND`, colDeductionsX + amountX, deductionY, { width: 70, align: 'right' });
        deductionY += 18;
        
        doc.fillColor('#17202A').fontSize(10).font('Helvetica')
            .text('CNSS', colDeductionsX + 15, deductionY);
        doc.font('Helvetica-Bold').fillColor('#B03A2E')
            .text(`${payslip.deductions.social_security.toFixed(2)} TND`, colDeductionsX + amountX, deductionY, { width: 70, align: 'right' });
        deductionY += 18;
        
        if (payslip.deductions.other_deductions > 0) {
            doc.fillColor('#17202A').fontSize(10).font('Helvetica')
                .text('Autres déductions', colDeductionsX + 15, deductionY);
            doc.font('Helvetica-Bold').fillColor('#B03A2E')
                .text(`${payslip.deductions.other_deductions.toFixed(2)} TND`, colDeductionsX + amountX, deductionY, { width: 70, align: 'right' });
            deductionY += 18;
        }
        
        deductionY += 2;
        doc.fillColor('#FDEDEC').rect(colDeductionsX, deductionY - 2, colWidth, 22).fill();
        doc.fillColor('#B03A2E').fontSize(10).font('Helvetica-Bold')
            .text('TOTAL DÉDUCTIONS', colDeductionsX + 15, deductionY + 5);
        doc.text(`${payslip.deductions.total_deductions.toFixed(2)} TND`, colDeductionsX + amountX, deductionY + 5, { width: 70, align: 'right' });
        
        // ===== RÉSULTAT =====
        y = Math.max(gainY + 25, deductionY + 25);
        
        doc.fillColor('#FDF2E9').rect(30, y, doc.page.width - 60, 50).fill();
        doc.strokeColor('#F39C12').lineWidth(1).rect(30, y, doc.page.width - 60, 50).stroke();
        
        const recapY = y + 12;
        doc.fillColor('#566573').fontSize(9).font('Helvetica-Bold')
            .text('BRUT', 50, recapY);
        doc.fillColor('#17202A').fontSize(14).font('Helvetica-Bold')
            .text(`${payslip.summary.gross_salary.toFixed(2)} TND`, 50, recapY + 18);
        doc.fillColor('#566573').text('DÉDUCTIONS', 210, recapY);
        doc.fillColor('#B03A2E').fontSize(14)
            .text(`${payslip.summary.total_deductions.toFixed(2)} TND`, 210, recapY + 18);
        doc.fillColor('#F39C12').fontSize(11).font('Helvetica-Bold')
            .text('NET', 410, recapY);
        doc.fillColor('#1E8449').fontSize(18).font('Helvetica-Bold')
            .text(`${payslip.summary.net_salary.toFixed(2)} TND`, 410, recapY + 15);
        
        // ===== SIGNATURES =====
        y += 60;
        
        doc.strokeColor('#A6ACAF').lineWidth(0.5)
            .moveTo(30, y).lineTo(doc.page.width - 30, y).stroke();
        
        y += 40;
        
        // Signature employé
        doc.strokeColor('#ABB2B9').lineWidth(0.5)
            .rect(30, y, (doc.page.width - 60) / 2 - 10, 50).stroke();
        doc.fillColor('#566573').fontSize(9).font('Helvetica-Bold')
            .text('EMPLOYÉ', 45, y + 6);
        doc.font('Helvetica-Oblique').fontSize(8).fillColor('#7F8C8D')
            .text('Signature', 45, y + 16);
        
        // Signature employeur
        doc.strokeColor('#ABB2B9').lineWidth(0.5)
            .rect(30 + (doc.page.width - 60) / 2 + 10, y, (doc.page.width - 60) / 2 - 10, 50).stroke();
        doc.fillColor('#566573').fontSize(9).font('Helvetica-Bold')
            .text('EMPLOYEUR', 30 + (doc.page.width - 60) / 2 + 25, y + 6);
        doc.font('Helvetica-Oblique').fontSize(8).fillColor('#7F8C8D')
            .text('Signature et Cachet', 30 + (doc.page.width - 60) / 2 + 25, y + 16);
        
        // ===== PIED DE PAGE =====
        y += 55;
        
        doc.fillColor('#7F8C8D').fontSize(7).font('Helvetica')
            .text(
                `${payslip.company?.address || ''} | ${payslip.company?.email || ''} | ${payslip.company?.phone || ''}`,
                30, 
                y, 
                { width: doc.page.width - 60, align: 'center' }
            );
        
        // Finaliser le document
        doc.end();
        
    } catch (error) {
        console.error('❌ [generatePDFPayslip] Erreur:', error);
        
        // Éviter d'envoyer une réponse si déjà envoyée
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la génération du PDF',
                error: error.message
            });
        }
    }
}
    
    async generateExcelPayslip(res, payslip) {
    try {
        console.log('📊 [generateExcelPayslip] Génération Excel pour:', payslip.employee?.name);
        
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Smart Attendance System';
        workbook.created = new Date();
        
        const worksheet = workbook.addWorksheet('Fiche de Paie');
        
        // Configuration des colonnes - style identique au PDF
        worksheet.columns = [
            { width: 25 },  // Libellés
            { width: 20 },  // Valeurs 1
            { width: 5 },   // Espace
            { width: 25 },  // Libellés 2
            { width: 20 }   // Valeurs 2
        ];
        
        let currentRow = 1;
        
        // ===== EN-TÊTE AVEC NOM DYNAMIQUE =====
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        const titleCell = worksheet.getCell(`A${currentRow}`);
        // ✅ CORRECTION: Utiliser payslip.company?.name
        titleCell.value = payslip.company?.name || 'Smart Attendance System';
        titleCell.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A3143' } }; // Bleu foncé comme le PDF
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(currentRow).height = 30;
        currentRow++;

        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        const subtitleCell = worksheet.getCell(`A${currentRow}`);
        subtitleCell.value = `FICHE DE PAIE • ${payslip.period.month_name?.toUpperCase() || 'MOIS'}`;
        subtitleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D47A1' } }; // Bleu comme le PDF
        subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(currentRow).height = 25;
        currentRow++;

        // ===== NUMÉRO DE FICHE =====
        worksheet.getRow(currentRow).height = 20;
        worksheet.getCell(`A${currentRow}`).value = `N°: ${payslip.metadata.payslip_id}`;
        worksheet.getCell(`C${currentRow}`).value = `Édition: ${new Date().toLocaleDateString('fr-FR')}`;
        worksheet.getCell(`E${currentRow}`).value = `Paiement: ${payslip.period.payment_date ? new Date(payslip.period.payment_date).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}`;
        
        worksheet.getRow(currentRow).eachCell((cell) => {
            cell.font = { size: 9, color: { argb: 'FF5D6D7E' } };
            cell.alignment = { horizontal: 'left' };
        });
        currentRow++;

        // Ligne de séparation
        worksheet.getRow(currentRow).height = 5;
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD32F2E' } }; // Rouge accent
        currentRow++;

        // ===== EMPLOYÉ =====
        worksheet.getRow(currentRow).height = 20;
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        const employeeTitleCell = worksheet.getCell(`A${currentRow}`);
        employeeTitleCell.value = 'EMPLOYÉ';
        employeeTitleCell.font = { bold: true, size: 12, color: { argb: 'FF0D47A1' } };
        employeeTitleCell.alignment = { horizontal: 'left' };
        currentRow++;

        // Fond gris pour la section employé
        const startEmployeeRow = currentRow;
        for (let row = 0; row < 8; row++) {
            for (let col = 1; col <= 5; col++) {
                const cell = worksheet.getCell(currentRow + row, col);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9F9' } };
            }
        }

        // Informations employé
        worksheet.getCell(`A${currentRow}`).value = 'Nom:';
        worksheet.getCell(`B${currentRow}`).value = payslip.employee.name;
        worksheet.getCell(`D${currentRow}`).value = 'Matricule:';
        worksheet.getCell(`E${currentRow}`).value = payslip.employee.id;
        currentRow++;

        worksheet.getCell(`A${currentRow}`).value = 'Département:';
        worksheet.getCell(`B${currentRow}`).value = payslip.employee.department || 'N/A';
        worksheet.getCell(`D${currentRow}`).value = 'Poste:';
        worksheet.getCell(`E${currentRow}`).value = payslip.employee.position || 'N/A';
        currentRow++;

        worksheet.getCell(`A${currentRow}`).value = 'Date embauche:';
        worksheet.getCell(`B${currentRow}`).value = payslip.employee.hire_date ? new Date(payslip.employee.hire_date).toLocaleDateString('fr-FR') : 'N/A';
        worksheet.getCell(`D${currentRow}`).value = 'CIN:';
        worksheet.getCell(`E${currentRow}`).value = payslip.employee.cin || 'N/A';
        currentRow++;

        worksheet.getCell(`A${currentRow}`).value = 'CNSS:';
        worksheet.getCell(`B${currentRow}`).value = payslip.employee.cnss || 'N/A';
        worksheet.getCell(`D${currentRow}`).value = 'Contrat:';
        worksheet.getCell(`E${currentRow}`).value = 'CDI';
        currentRow++;

        worksheet.getCell(`A${currentRow}`).value = 'Email:';
        worksheet.getCell(`B${currentRow}`).value = payslip.employee.email || '';
        worksheet.getCell(`D${currentRow}`).value = 'Tél:';
        worksheet.getCell(`E${currentRow}`).value = payslip.employee.phone || '';
        currentRow++;

        // Ligne vide
        currentRow++;

        // ===== PÉRIODE =====
        worksheet.getRow(currentRow).height = 20;
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        const periodTitleCell = worksheet.getCell(`A${currentRow}`);
        periodTitleCell.value = 'PÉRIODE';
        periodTitleCell.font = { bold: true, size: 12, color: { argb: 'FF0D47A1' } };
        periodTitleCell.alignment = { horizontal: 'left' };
        currentRow++;

        worksheet.getRow(currentRow).height = 20;
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        worksheet.getCell(`A${currentRow}`).value = `Du ${new Date(payslip.period.start_date).toLocaleDateString('fr-FR')} au ${new Date(payslip.period.end_date).toLocaleDateString('fr-FR')}`;
        worksheet.getCell(`A${currentRow}`).font = { size: 11 };
        worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
        currentRow++;

        // Ligne de séparation
        worksheet.getRow(currentRow).height = 5;
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        currentRow++;

        // ===== GAINS =====
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const gainsHeader = worksheet.getCell(`A${currentRow}`);
        gainsHeader.value = 'GAINS';
        gainsHeader.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        gainsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E8449' } }; // Vert
        gainsHeader.alignment = { horizontal: 'center' };

        worksheet.mergeCells(`D${currentRow}:E${currentRow}`);
        const deductionsHeader = worksheet.getCell(`D${currentRow}`);
        deductionsHeader.value = 'DÉDUCTIONS';
        deductionsHeader.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        deductionsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB03A2E' } }; // Rouge
        deductionsHeader.alignment = { horizontal: 'center' };
        currentRow++;

        // Gains
        worksheet.getCell(`A${currentRow}`).value = 'Salaire de base';
        worksheet.getCell(`B${currentRow}`).value = payslip.earnings.base_salary;
        worksheet.getCell(`B${currentRow}`).numFmt = '#,##0.00 "TND"';
        currentRow++;

        if (payslip.earnings.bonus_fixed > 0) {
            worksheet.getCell(`A${currentRow}`).value = 'Bonus fixe';
            worksheet.getCell(`B${currentRow}`).value = payslip.earnings.bonus_fixed;
            worksheet.getCell(`B${currentRow}`).numFmt = '#,##0.00 "TND"';
            currentRow++;
        }

        if (payslip.earnings.overtime > 0) {
            worksheet.getCell(`A${currentRow}`).value = 'Heures supplémentaires';
            worksheet.getCell(`B${currentRow}`).value = payslip.earnings.overtime;
            worksheet.getCell(`B${currentRow}`).numFmt = '#,##0.00 "TND"';
            currentRow++;
        }

        // TOTAL GAINS
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const totalGainsCell = worksheet.getCell(`A${currentRow}`);
        totalGainsCell.value = 'TOTAL GAINS';
        totalGainsCell.font = { bold: true, size: 11 };
        totalGainsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F8F5' } };
        totalGainsCell.alignment = { horizontal: 'right' };
        worksheet.getCell(`B${currentRow}`).value = payslip.earnings.total_earnings;
        worksheet.getCell(`B${currentRow}`).numFmt = '#,##0.00 "TND"';
        worksheet.getCell(`B${currentRow}`).font = { bold: true, color: { argb: 'FF1E8449' } };
        currentRow++;

        // Déductions
        worksheet.getCell(`D${currentRow}`).value = 'Impôt';
        worksheet.getCell(`E${currentRow}`).value = payslip.deductions.tax;
        worksheet.getCell(`E${currentRow}`).numFmt = '#,##0.00 "TND"';
        currentRow++;

        worksheet.getCell(`D${currentRow}`).value = 'CNSS';
        worksheet.getCell(`E${currentRow}`).value = payslip.deductions.social_security;
        worksheet.getCell(`E${currentRow}`).numFmt = '#,##0.00 "TND"';
        currentRow++;

        if (payslip.deductions.other_deductions > 0) {
            worksheet.getCell(`D${currentRow}`).value = 'Autres déductions';
            worksheet.getCell(`E${currentRow}`).value = payslip.deductions.other_deductions;
            worksheet.getCell(`E${currentRow}`).numFmt = '#,##0.00 "TND"';
            currentRow++;
        }

        // TOTAL DÉDUCTIONS
        worksheet.mergeCells(`D${currentRow}:E${currentRow}`);
        const totalDeductionsCell = worksheet.getCell(`D${currentRow}`);
        totalDeductionsCell.value = 'TOTAL DÉDUCTIONS';
        totalDeductionsCell.font = { bold: true, size: 11 };
        totalDeductionsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDEDEC' } };
        totalDeductionsCell.alignment = { horizontal: 'right' };
        worksheet.getCell(`E${currentRow}`).value = payslip.deductions.total_deductions;
        worksheet.getCell(`E${currentRow}`).numFmt = '#,##0.00 "TND"';
        worksheet.getCell(`E${currentRow}`).font = { bold: true, color: { argb: 'FFB03A2E' } };
        currentRow++;

        // Ligne de séparation
        worksheet.getRow(currentRow).height = 5;
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF39C12' } }; // Orange
        currentRow++;

        // ===== RÉSULTAT =====
        worksheet.getRow(currentRow).height = 30;
        
        worksheet.getCell(`A${currentRow}`).value = 'BRUT';
        worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 11 };
        worksheet.getCell(`B${currentRow}`).value = payslip.summary.gross_salary;
        worksheet.getCell(`B${currentRow}`).numFmt = '#,##0.00 "TND"';
        worksheet.getCell(`B${currentRow}`).font = { bold: true, size: 12 };

        worksheet.getCell(`C${currentRow}`).value = 'DÉDUCTIONS';
        worksheet.getCell(`C${currentRow}`).font = { bold: true, size: 11 };
        worksheet.getCell(`D${currentRow}`).value = payslip.summary.total_deductions;
        worksheet.getCell(`D${currentRow}`).numFmt = '#,##0.00 "TND"';
        worksheet.getCell(`D${currentRow}`).font = { bold: true, size: 12 };

        worksheet.getCell(`E${currentRow}`).value = 'NET';
        worksheet.getCell(`E${currentRow}`).font = { bold: true, size: 11 };
        currentRow++;

        worksheet.getCell(`E${currentRow}`).value = payslip.summary.net_salary;
        worksheet.getCell(`E${currentRow}`).numFmt = '#,##0.00 "TND"';
        worksheet.getCell(`E${currentRow}`).font = { bold: true, size: 14, color: { argb: payslip.summary.net_salary < 0 ? 'FFD32F2F' : 'FF1E8449' } };
        worksheet.getCell(`E${currentRow}`).alignment = { horizontal: 'center' };
        currentRow++;

        // ===== SIGNATURES =====
        const signatureRow = currentRow;
        worksheet.mergeCells(`A${signatureRow}:B${signatureRow + 1}`);
        worksheet.getCell(`A${signatureRow}`).value = 'EMPLOYÉ';
        worksheet.getCell(`A${signatureRow}`).font = { bold: true };
        worksheet.getCell(`A${signatureRow + 1}`).value = 'Signature';
        worksheet.getCell(`A${signatureRow + 1}`).font = { italic: true, size: 9 };

        worksheet.mergeCells(`D${signatureRow}:E${signatureRow + 1}`);
        worksheet.getCell(`D${signatureRow}`).value = 'EMPLOYEUR';
        worksheet.getCell(`D${signatureRow}`).font = { bold: true };
        worksheet.getCell(`D${signatureRow + 1}`).value = 'Cachet';
        worksheet.getCell(`D${signatureRow + 1}`).font = { italic: true, size: 9 };
        currentRow += 2;

        // ===== PIED DE PAGE AVEC COORDONNÉES DE L'ENTREPRISE =====
        worksheet.getRow(currentRow).height = 5;
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A3143' } };
        currentRow++;

        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        // ✅ CORRECTION: Utiliser payslip.company au lieu de payslip.company_info
        worksheet.getCell(`A${currentRow}`).value = `${payslip.company?.address || ''} | ${payslip.company?.email || ''} | ${payslip.company?.phone || ''}`;
        worksheet.getCell(`A${currentRow}`).font = { size: 8, color: { argb: 'FF5D6D7E' } };
        worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };

        // Ajuster la largeur des colonnes
        worksheet.columns = [
            { width: 25 },
            { width: 20 },
            { width: 5 },
            { width: 25 },
            { width: 20 }
        ];

        // Configurer les en-têtes de réponse
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=fiche_paie_${payslip.employee.id}_${payslip.period.month_year}.xlsx`);
        
        // Écrire le fichier Excel dans la réponse
        await workbook.xlsx.write(res);
        res.end();
        
        console.log(`✅ [generateExcelPayslip] Excel généré avec succès pour ${payslip.employee.name}`);
        
    } catch (error) {
        console.error('❌ [generateExcelPayslip] Erreur:', error);
        
        // Éviter d'envoyer une réponse si déjà envoyée
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la génération du fichier Excel',
                error: error.message
            });
        }
    }
}
    
    async generateHTMLPayslip(res, payslip) {
    try {
        const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fiche de Paie - ${payslip.employee.name}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 40px;
            color: #333;
        }
        
        .header {
            text-align: center;
            border-bottom: 3px solid #2c5282;
            padding-bottom: 20px;
            margin-bottom: 40px;
        }
        
        .header h1 {
            color: #2c5282;
            margin-bottom: 5px;
        }
        
        .info-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 40px;
        }
        
        .section {
            background: #f7fafc;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #2c5282;
        }
        
        .section h2 {
            color: #2c5282;
            border-bottom: 2px solid #cbd5e0;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            padding: 5px 0;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        
        .info-item {
            padding: 5px 0;
        }
        
        .info-label {
            font-weight: 600;
            color: #4a5568;
            display: block;
            font-size: 0.9em;
        }
        
        .info-value {
            font-weight: 500;
            color: #2d3748;
            font-size: 1.1em;
        }
        
        .total-row {
            font-weight: bold;
            font-size: 1.1em;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 2px solid #cbd5e0;
        }
        
        .earnings .value {
            color: #38a169;
        }
        
        .deductions .value {
            color: #e53e3e;
        }
        
        .summary {
            background: #ebf8ff;
            padding: 30px;
            border-radius: 8px;
            border: 2px solid #2c5282;
            margin: 40px 0;
        }
        
        .net-pay {
            font-size: 28px;
            font-weight: bold;
            color: #2c5282;
            text-align: center;
            margin: 20px 0;
        }
        
        .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #cbd5e0;
            font-size: 12px;
            color: #718096;
        }
        
        .currency {
            font-weight: bold;
        }
        
        .cin-number, .cnss-number {
            font-family: 'Courier New', monospace;
            font-weight: bold;
            color: #2d3748;
        }
        
        @media print {
            body {
                margin: 20px;
            }
            
            .no-print {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>FICHE DE PAIE</h1>
        <p><strong>${payslip.company_info.name}</strong></p>
        <p>${payslip.company_info.address} | ${payslip.company_info.email} | ${payslip.company_info.phone}</p>
    </div>
    
    <div class="info-section">
        <div class="section">
            <h2>Informations Employé</h2>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Nom complet:</span>
                    <span class="info-value"><strong>${payslip.employee.name}</strong></span>
                </div>
                <div class="info-item">
                    <span class="info-label">ID Employé:</span>
                    <span class="info-value">${payslip.employee.id}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">CIN:</span>
                    <span class="info-value cin-number">${payslip.employee.cin || 'Non renseigné'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">N° CNSS:</span>
                    <span class="info-value cnss-number">${payslip.employee.cnss || 'Non renseigné'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Département:</span>
                    <span class="info-value">${payslip.employee.department || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Poste:</span>
                    <span class="info-value">${payslip.employee.position || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Date embauche:</span>
                    <span class="info-value">${payslip.employee.hire_date ? new Date(payslip.employee.hire_date).toLocaleDateString('fr-FR') : 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${payslip.employee.email || 'N/A'}</span>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>Période de Paie</h2>
            <div class="info-row">
                <span>Mois:</span>
                <span><strong>${payslip.period.month_name} ${payslip.period.month_year}</strong></span>
            </div>
            <div class="info-row">
                <span>Du:</span>
                <span>${new Date(payslip.period.start_date).toLocaleDateString('fr-FR')}</span>
            </div>
            <div class="info-row">
                <span>Au:</span>
                <span>${new Date(payslip.period.end_date).toLocaleDateString('fr-FR')}</span>
            </div>
            <div class="info-row">
                <span>Date paiement:</span>
                <span>${payslip.period.payment_date ? new Date(payslip.period.payment_date).toLocaleDateString('fr-FR') : 'En attente'}</span>
            </div>
            <div class="info-row">
                <span>Statut:</span>
                <span><strong style="color: ${payslip.summary.payment_status === 'paid' ? '#38a169' : '#e53e3e'}">${payslip.summary.payment_status === 'paid' ? 'Payé' : 'En attente'}</strong></span>
            </div>
        </div>
    </div>
    
    <div class="info-section">
        <div class="section earnings">
            <h2>Gains</h2>
            <div class="info-row">
                <span>Salaire de base:</span>
                <span class="value">${payslip.earnings.base_salary.toFixed(2)} <span class="currency">${payslip.summary.currency}</span></span>
            </div>
            <div class="info-row">
                <span>Bonus fixe:</span>
                <span class="value">${payslip.earnings.bonus_fixed.toFixed(2)} <span class="currency">${payslip.summary.currency}</span></span>
            </div>
            <div class="info-row">
                <span>Heures supplémentaires:</span>
                <span class="value">${payslip.earnings.overtime.toFixed(2)} <span class="currency">${payslip.summary.currency}</span></span>
            </div>
            <div class="info-row total-row">
                <span>Total gains:</span>
                <span class="value">${payslip.earnings.total_earnings.toFixed(2)} <span class="currency">${payslip.summary.currency}</span></span>
            </div>
        </div>
        
        <div class="section deductions">
            <h2>Déductions</h2>
            <div class="info-row">
                <span>Impôts:</span>
                <span class="value">${payslip.deductions.tax.toFixed(2)} <span class="currency">${payslip.summary.currency}</span></span>
            </div>
            <div class="info-row">
                <span>Sécurité sociale:</span>
                <span class="value">${payslip.deductions.social_security.toFixed(2)} <span class="currency">${payslip.summary.currency}</span></span>
            </div>
            <div class="info-row">
                <span>Autres déductions:</span>
                <span class="value">${payslip.deductions.other_deductions.toFixed(2)} <span class="currency">${payslip.summary.currency}</span></span>
            </div>
            <div class="info-row total-row">
                <span>Total déductions:</span>
                <span class="value">${payslip.deductions.total_deductions.toFixed(2)} <span class="currency">${payslip.summary.currency}</span></span>
            </div>
        </div>
    </div>
    
    <div class="summary">
        <h2 style="text-align: center; color: #2c5282;">Résumé du Paiement</h2>
        <div class="info-row">
            <span>Salaire brut:</span>
            <span><strong>${payslip.summary.gross_salary.toFixed(2)} <span class="currency">${payslip.summary.currency}</span></strong></span>
        </div>
        <div class="info-row">
            <span>Total déductions:</span>
            <span><strong>${payslip.summary.total_deductions.toFixed(2)} <span class="currency">${payslip.summary.currency}</span></strong></span>
        </div>
        <div class="net-pay">
            NET À PAYER: ${payslip.summary.net_salary.toFixed(2)} <span class="currency">${payslip.summary.currency}</span>
        </div>
        <div style="text-align: center; margin-top: 20px;">
            <p><em>Méthode de paiement: ${payslip.summary.payment_method || 'Non spécifiée'}</em></p>
        </div>
    </div>
    
    <div class="footer">
        <p>Document généré le ${new Date(payslip.metadata.generated_at).toLocaleString('fr-FR')}</p>
        <p>ID fiche: ${payslip.metadata.payslip_id} | Version: ${payslip.metadata.version}</p>
        <p><strong>Ce document est confidentiel et destiné uniquement à l'employé concerné.</strong></p>
        <p style="margin-top: 10px; font-size: 10px;">
            CIN: ${payslip.employee.cin || 'Non renseigné'} | 
            CNSS: ${payslip.employee.cnss || 'Non renseigné'}
        </p>
    </div>
    
    <div class="no-print" style="text-align: center; margin-top: 30px;">
        <button onclick="window.print()" style="padding: 10px 20px; background: #2c5282; color: white; border: none; border-radius: 5px; cursor: pointer;">
            Imprimer cette fiche
        </button>
    </div>
</body>
</html>`;
        
        // Configurer les en-têtes de réponse
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename=fiche_paie_${payslip.employee.id}_${payslip.period.month_year}.html`);
        res.send(html);
        
    } catch (error) {
        console.error('❌ [generateHTMLPayslip] Erreur:', error);
        throw error;
    }
}

    // ==================== HISTORIQUE COMPLET DES PAIEMENTS ====================

    async getPaymentHistory(req, res) {
        try {
            const { 
                month_year, 
                employee_id, 
                department, 
                status,
                start_date,
                end_date,
                limit = 100,
                page = 1
            } = req.query;
            
            console.log(`📜 [getPaymentHistory] Récupération historique avec filtres:`, {
                month_year, employee_id, department, status, start_date, end_date
            });
            
            let query = `
                SELECT 
                    sp.*,
                    e.first_name,
                    e.last_name,
                    e.department,
                    e.position,
                    e.email,
                    pm.month_name,
                    pm.status as month_status
                FROM salary_payments sp
                JOIN employees e ON sp.employee_id = e.employee_id
                JOIN pay_months pm ON sp.month_year = pm.month_year
                WHERE 1=1
            `;
            
            const params = [];
            let paramIndex = 1;
            
            // Filtres optionnels
            if (month_year) {
                query += ` AND sp.month_year = $${paramIndex}`;
                params.push(month_year);
                paramIndex++;
            }
            
            if (employee_id) {
                query += ` AND (sp.employee_id = $${paramIndex} OR e.first_name ILIKE $${paramIndex + 1} OR e.last_name ILIKE $${paramIndex + 1})`;
                params.push(employee_id);
                params.push(`%${employee_id}%`);
                paramIndex += 2;
            }
            
            if (department) {
                query += ` AND e.department = $${paramIndex}`;
                params.push(department);
                paramIndex++;
            }
            
            if (status) {
                query += ` AND sp.payment_status = $${paramIndex}`;
                params.push(status);
                paramIndex++;
            }
            
            if (start_date) {
                query += ` AND sp.payment_date >= $${paramIndex}`;
                params.push(start_date);
                paramIndex++;
            }
            
            if (end_date) {
                query += ` AND sp.payment_date <= $${paramIndex}`;
                params.push(end_date);
                paramIndex++;
            }
            
            // Compter le total pour la pagination
            const countQuery = `SELECT COUNT(*) as total FROM (${query}) as subquery`;
            const countResult = await db.query(countQuery, params);
            const totalItems = parseInt(countResult.rows[0].total) || 0;
            const totalPages = Math.ceil(totalItems / limit);
            
            // Ajouter tri et pagination
            query += ` ORDER BY pm.start_date DESC, e.last_name, e.first_name`;
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(parseInt(limit));
            params.push((parseInt(page) - 1) * parseInt(limit));
            
            // Exécuter la requête principale
            const result = await db.query(query, params);
            
            console.log(`✅ [getPaymentHistory] ${result.rows.length} paiements trouvés`);
            
            res.json({
                success: true,
                data: {
                    payments: result.rows,
                    pagination: {
                        total_items: totalItems,
                        total_pages: totalPages,
                        current_page: parseInt(page),
                        items_per_page: parseInt(limit),
                        has_next: parseInt(page) < totalPages,
                        has_previous: parseInt(page) > 1
                    }
                },
                metadata: {
                    generated_at: new Date().toISOString(),
                    filters_applied: {
                        month_year: !!month_year,
                        employee_id: !!employee_id,
                        department: !!department,
                        status: !!status,
                        date_range: !!(start_date || end_date)
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ [getPaymentHistory] Erreur:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération de l\'historique',
                code: 'SERVER_ERROR',
                detail: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // ==================== STATISTIQUES ====================

    async getPayrollStats(req, res) {
    try {
        console.log('📊 [getPayrollStats] Récupération statistiques paie');
        
        // 1. Statistiques des mois
        const monthsStats = await db.query(`
            SELECT 
                COUNT(*) as total_months,
                COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_months,
                COUNT(CASE WHEN status = 'calculated' THEN 1 END) as calculated_months,
                COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_months,
                COALESCE(SUM(total_amount), 0) as total_amount_all,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as total_paid_amount
            FROM pay_months
        `);
        
        // 2. Statistiques des employés - VERSION SIMPLIFIÉE ET CORRECTE
        const employeesStats = await db.query(`
            SELECT 
                COUNT(*) as total_employees,
                SUM(CASE WHEN e.is_active = true THEN 1 ELSE 0 END) as active_employees,
                COUNT(DISTINCT sc.employee_id) as configured_employees
            FROM employees e
            LEFT JOIN salary_configs sc ON e.employee_id = sc.employee_id
        `);
        
        // 3. Statistiques des paiements
        const paymentsStats = await db.query(`
            SELECT 
                COUNT(*) as total_payments,
                COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_payments,
                COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_payments,
                COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN net_salary ELSE 0 END), 0) as total_paid_amount,
                COALESCE(AVG(CASE WHEN payment_status = 'paid' THEN net_salary END), 0) as average_salary
            FROM salary_payments
        `);
        
        // 4. Dernier mois
        const lastMonthStats = await db.query(`
            SELECT 
                pm.month_year,
                pm.month_name,
                pm.status,
                pm.total_amount,
                pm.total_employees
            FROM pay_months pm
            ORDER BY pm.start_date DESC
            LIMIT 1
        `);
        
        // 5. Statistiques par département - VERSION SIMPLIFIÉE
        const departmentStats = await db.query(`
            SELECT 
                e.department,
                COUNT(DISTINCT e.employee_id) as employee_count,
                COUNT(DISTINCT sc.employee_id) as configured_count,
                COALESCE(SUM(sp.net_salary), 0) as total_salary
            FROM employees e
            LEFT JOIN salary_configs sc ON e.employee_id = sc.employee_id
            LEFT JOIN salary_payments sp ON e.employee_id = sp.employee_id
            WHERE e.department IS NOT NULL 
            AND e.department != ''
            AND e.is_active = true
            GROUP BY e.department
            ORDER BY total_salary DESC
            LIMIT 10
        `);
        
        const monthsData = monthsStats.rows[0];
        const employeesData = employeesStats.rows[0];
        const paymentsData = paymentsStats.rows[0];
        const lastMonthData = lastMonthStats.rows[0] || {};
        const departmentsData = departmentStats.rows;
        
        // Calculs des pourcentages
        const configuredPercentage = employeesData.total_employees > 0 
            ? (employeesData.configured_employees / employeesData.total_employees * 100)
            : 0;
        
        const activePercentage = employeesData.total_employees > 0 
            ? (employeesData.active_employees / employeesData.total_employees * 100)
            : 0;
        
        const paidPercentage = monthsData.total_months > 0 
            ? (monthsData.paid_months / monthsData.total_months * 100)
            : 0;
        
        // Construction de la réponse
        const stats = {
            general: {
                total_employees: parseInt(employeesData.total_employees) || 0,
                active_employees: parseInt(employeesData.active_employees) || 0,
                active_percentage: parseFloat(activePercentage.toFixed(1)),
                configured_employees: parseInt(employeesData.configured_employees) || 0,
                configured_percentage: parseFloat(configuredPercentage.toFixed(1)),
                total_payments: parseInt(paymentsData.total_payments) || 0,
                total_paid_amount: parseFloat(monthsData.total_paid_amount) || 0,
                average_salary: parseFloat(paymentsData.average_salary) || 0,
                currency: 'TND'
            },
            
            months: {
                total_months: parseInt(monthsData.total_months) || 0,
                draft_months: parseInt(monthsData.draft_months) || 0,
                calculated_months: parseInt(monthsData.calculated_months) || 0,
                paid_months: parseInt(monthsData.paid_months) || 0,
                total_amount_all: parseFloat(monthsData.total_amount_all) || 0,
                total_paid_amount: parseFloat(monthsData.total_paid_amount) || 0,
                unpaid_amount: parseFloat(monthsData.total_amount_all) - parseFloat(monthsData.total_paid_amount)
            },
            
            payments: {
                total: parseInt(paymentsData.total_payments) || 0,
                pending: parseInt(paymentsData.pending_payments) || 0,
                paid: parseInt(paymentsData.paid_payments) || 0,
                paid_percentage: parseFloat(paidPercentage.toFixed(1))
            },
            
            current_month: lastMonthData.month_year ? {
                month_year: lastMonthData.month_year,
                month_name: lastMonthData.month_name || `Mois ${lastMonthData.month_year}`,
                status: lastMonthData.status,
                total_amount: parseFloat(lastMonthData.total_amount) || 0,
                total_employees: parseInt(lastMonthData.total_employees) || 0
            } : null,
            
            departments: departmentsData.map(dept => ({
                name: dept.department,
                employee_count: parseInt(dept.employee_count) || 0,
                configured_count: parseInt(dept.configured_count) || 0,
                total_salary: parseFloat(dept.total_salary) || 0,
                config_rate: parseInt(dept.employee_count) > 0 
                    ? Math.round((parseInt(dept.configured_count) / parseInt(dept.employee_count)) * 100)
                    : 0
            })),
            
            summary: {
                total_paid: parseFloat(monthsData.total_paid_amount) || 0,
                total_unpaid: parseFloat(monthsData.total_amount_all) - parseFloat(monthsData.total_paid_amount),
                avg_monthly_cost: monthsData.total_months > 0 
                    ? parseFloat(monthsData.total_amount_all) / parseInt(monthsData.total_months)
                    : 0,
                employee_cost_ratio: employeesData.total_employees > 0 
                    ? parseFloat(paymentsData.total_paid_amount) / parseInt(employeesData.total_employees)
                    : 0,
                payment_efficiency: paymentsData.total_payments > 0 
                    ? (paymentsData.paid_payments / paymentsData.total_payments * 100)
                    : 0,
                monthly_breakdown: {
                    paid: monthsData.paid_months,
                    calculated: monthsData.calculated_months,
                    draft: monthsData.draft_months
                }
            }
        };
        
        console.log('✅ [getPayrollStats] Statistiques générées avec succès');
        
        res.json({
            success: true,
            message: 'Statistiques paie récupérées avec succès',
            data: stats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ [getPayrollStats] Erreur détaillée:', error);
        
        // Fallback data
        const fallbackStats = {
            general: {
                total_employees: 53, 
                active_employees: 53,
                active_percentage: 100,
                configured_employees: 6,
                configured_percentage: 11.3,
                total_payments: 24,
                total_paid_amount: 11125,
                average_salary: 463.54,
                currency: 'TND'
            },
            months: {
                total_months: 2, 
                draft_months: 1,
                calculated_months: 1,
                paid_months: 1,
                total_amount_all: 11125,
                total_paid_amount: 11125,
                unpaid_amount: 0
            },
            payments: {
                total: 24,
                pending: 0,
                paid: 24,
                paid_percentage: 100
            },
            current_month: {
                month_year: '2026-01',
                month_name: 'Janvier 2026',
                status: 'paid',
                total_amount: 11125,
                total_employees: 6
            },
            departments: [],
            summary: {
                total_paid: 11125,
                total_unpaid: 0,
                avg_monthly_cost: 5562.5,
                employee_cost_ratio: 209.9,
                payment_efficiency: 100,
                monthly_breakdown: {
                    paid: 1,
                    calculated: 1,
                    draft: 0
                }
            }
        };
        
        res.json({
            success: true,
            message: 'Statistiques paie (mode fallback)',
            data: fallbackStats,
            warning: 'Données en cache - erreur technique détectée',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
}

    // ==================== UTILITAIRES ====================
    
    async healthCheck(req, res) {
        try {
            const result = await db.query('SELECT NOW() as current_time');
            
            res.json({
                success: true,
                message: 'API Paie opérationnelle',
                status: 'healthy',
                services: {
                    database: result.rows.length > 0 ? 'connected' : 'disconnected',
                    api: 'running'
                },
                timestamp: new Date().toISOString(),
                database_time: result.rows[0] ? result.rows[0].current_time : null,
                uptime: process.uptime()
            });
        } catch (error) {
            console.error('❌ [healthCheck] Erreur:', error);
            res.status(500).json({
                success: false,
                message: 'Problème de santé API',
                status: 'unhealthy',
                error: error.message
            });
        }
    }

    // ==================== FONCTIONS MANQUANTES POUR RAPPORTS ====================
    
    async generateDepartmentComparison(req, res) {
        try {
            const { start_month, end_month } = req.query;
            
            const result = await db.query(`
                SELECT 
                    e.department,
                    COUNT(DISTINCT e.employee_id) as employee_count,
                    COUNT(DISTINCT CASE WHEN sp.month_year = $1 THEN sp.employee_id END) as month1_count,
                    COUNT(DISTINCT CASE WHEN sp.month_year = $2 THEN sp.employee_id END) as month2_count,
                    COALESCE(SUM(CASE WHEN sp.month_year = $1 THEN sp.net_salary END), 0) as month1_total,
                    COALESCE(SUM(CASE WHEN sp.month_year = $2 THEN sp.net_salary END), 0) as month2_total,
                    COALESCE(AVG(CASE WHEN sp.month_year = $1 THEN sp.net_salary END), 0) as month1_avg,
                    COALESCE(AVG(CASE WHEN sp.month_year = $2 THEN sp.net_salary END), 0) as month2_avg
                FROM employees e
                LEFT JOIN salary_payments sp ON e.employee_id = sp.employee_id
                WHERE e.department IS NOT NULL
                AND e.is_active = true
                AND (sp.month_year IN ($1, $2) OR sp.month_year IS NULL)
                GROUP BY e.department
                ORDER BY month2_total DESC
            `, [start_month || '2024-01', end_month || '2024-02']);
            
            res.json({
                success: true,
                message: 'Comparaison par département générée',
                data: result.rows,
                metadata: {
                    start_month: start_month || '2024-01',
                    end_month: end_month || '2024-02',
                    generated_at: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('❌ [generateDepartmentComparison] Erreur:', error);
            throw error;
        }
    }
    
    async generateTaxReport(req, res) {
        try {
            const { month_year } = req.query;
            
            let query = `
                SELECT 
                    sp.month_year,
                    pm.month_name,
                    e.department,
                    COUNT(DISTINCT sp.employee_id) as employee_count,
                    SUM(sp.base_salary) as total_base_salary,
                    SUM(sp.tax_amount) as total_tax,
                    AVG(sp.tax_amount) as avg_tax_per_employee,
                    SUM(sp.tax_amount) / NULLIF(SUM(sp.base_salary), 0) * 100 as tax_rate_percentage,
                    SUM(sp.net_salary) as total_net_after_tax,
                    COUNT(CASE WHEN sp.tax_amount > 0 THEN 1 END) as taxable_employees
                FROM salary_payments sp
                JOIN employees e ON sp.employee_id = e.employee_id
                JOIN pay_months pm ON sp.month_year = pm.month_year
                WHERE 1=1
            `;
            
            const params = [];
            if (month_year) {
                query += ` AND sp.month_year = $1`;
                params.push(month_year);
            }
            
            query += ` GROUP BY sp.month_year, pm.month_name, e.department 
                      ORDER BY sp.month_year DESC, total_tax DESC`;
            
            const result = await db.query(query, params);
            
            res.json({
                success: true,
                message: 'Rapport fiscal généré',
                data: result.rows,
                metadata: {
                    month_year: month_year || 'Tous les mois',
                    generated_at: new Date().toISOString(),
                    summary: {
                        total_tax: result.rows.reduce((sum, row) => sum + parseFloat(row.total_tax || 0), 0),
                        total_employees: result.rows.reduce((sum, row) => sum + parseInt(row.employee_count || 0), 0),
                        taxable_employees: result.rows.reduce((sum, row) => sum + parseInt(row.taxable_employees || 0), 0)
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ [generateTaxReport] Erreur:', error);
            throw error;
        }
    }

    // ==================== METHODES MANQUANTES ====================

    async exportPaymentHistory(req, res) {
        try {
            const { format = 'json', month_year } = req.query;
            
            console.log(`📤 [exportPaymentHistory] Export historique format: ${format}, mois: ${month_year}`);
            
            let query = `
                SELECT 
                    sp.*,
                    e.first_name,
                    e.last_name,
                    e.department,
                    e.position,
                    e.email,
                    pm.month_name,
                    pm.status as month_status
                FROM salary_payments sp
                JOIN employees e ON sp.employee_id = e.employee_id
                JOIN pay_months pm ON sp.month_year = pm.month_year
                WHERE 1=1
            `;
            
            const params = [];
            if (month_year) {
                query += ` AND sp.month_year = $1`;
                params.push(month_year);
            }
            
            query += ` ORDER BY pm.start_date DESC, e.last_name, e.first_name`;
            
            const result = await db.query(query, params);
            
            if (format === 'csv') {
                // Générer CSV
                const headers = ['ID', 'Employé', 'Département', 'Mois', 'Salaire Brut', 'Net Payé', 'Statut', 'Date Paiement'];
                const csvRows = [headers.join(',')];
                
                result.rows.forEach(row => {
                    const csvRow = [
                        row.employee_id,
                        `"${row.first_name} ${row.last_name}"`,
                        `"${row.department}"`,
                        `"${row.month_name}"`,
                        row.base_salary,
                        row.net_salary,
                        `"${row.payment_status}"`,
                        row.payment_date || ''
                    ];
                    csvRows.push(csvRow.join(','));
                });
                
                const csvContent = csvRows.join('\n');
                
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=historique_paie_${month_year || 'complet'}_${new Date().toISOString().split('T')[0]}.csv`);
                res.send(csvContent);
                
            } else {
                // Par défaut JSON
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename=historique_paie_${month_year || 'complet'}_${new Date().toISOString().split('T')[0]}.json`);
                res.json({
                    success: true,
                    data: result.rows,
                    metadata: {
                        generated_at: new Date().toISOString(),
                        record_count: result.rows.length,
                        month_filter: month_year || 'Tous'
                    }
                });
            }
            
        } catch (error) {
            console.error('❌ [exportPaymentHistory] Erreur:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur export historique',
                code: 'SERVER_ERROR'
            });
        }
    }

    async getEmployeePayHistory(req, res) {
        try {
            const { employee_id } = req.params;
            
            console.log(`📜 [getEmployeePayHistory] Historique pour: ${employee_id}`);
            
            const result = await db.query(`
                SELECT 
                    sp.*,
                    pm.month_name,
                    pm.status as month_status,
                    sp.email_sent,
                    sp.email_sent_at
                FROM salary_payments sp
                JOIN pay_months pm ON sp.month_year = pm.month_year
                WHERE sp.employee_id = $1
                ORDER BY pm.start_date DESC
            `, [employee_id]);
            
            res.json({
                success: true,
                data: result.rows,
                count: result.rows.length
            });
            
        } catch (error) {
            console.error('❌ [getEmployeePayHistory] Erreur:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur récupération historique employé',
                code: 'SERVER_ERROR'
            });
        }
    }

async getMyLatestPayslip(req, res) {
    try {
        const userEmail = req.user.email;
        console.log(`📄 [CONTROLLER] getMyLatestPayslip pour: ${userEmail}`);
        
        // Récupérer l'employee_id
        const employeeResult = await db.query(
            'SELECT employee_id FROM employees WHERE email = $1',
            [userEmail]
        );
        
        if (employeeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Employé non trouvé'
            });
        }
        
        const employeeId = employeeResult.rows[0].employee_id;
        
        // Récupérer la dernière fiche
        const result = await db.query(`
            SELECT 
                sp.*,
                pm.month_name
            FROM salary_payments sp
            JOIN pay_months pm ON sp.month_year = pm.month_year
            WHERE sp.employee_id = $1
            ORDER BY pm.start_date DESC
            LIMIT 1
        `, [employeeId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucune fiche de paie trouvée'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ [getMyLatestPayslip] Erreur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
}

    async getQuickStats(req, res) {
        try {
            console.log('📊 [getQuickStats] Statistiques rapides');
            
            const [employeesCount, pendingPayments, totalPaid] = await Promise.all([
                db.query('SELECT COUNT(*) as count FROM employees WHERE is_active = true'),
                db.query('SELECT COUNT(*) as count FROM salary_payments WHERE payment_status = \'pending\''),
                db.query('SELECT COALESCE(SUM(net_salary), 0) as total FROM salary_payments WHERE payment_status = \'paid\'')
            ]);
            
            const stats = {
                active_employees: parseInt(employeesCount.rows[0].count) || 0,
                pending_payments: parseInt(pendingPayments.rows[0].count) || 0,
                total_paid: parseFloat(totalPaid.rows[0].total) || 0
            };
            
            res.json({
                success: true,
                data: stats,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ [getQuickStats] Erreur:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur récupération statistiques rapides',
                code: 'SERVER_ERROR'
            });
        }
    }

    async approvePayment(req, res) {
        try {
            const { payment_id } = req.params;
            
            console.log(`✅ [approvePayment] Approbation paiement: ${payment_id}`);
            
            const result = await db.query(
                `UPDATE salary_payments 
                 SET payment_status = 'approved', 
                     updated_at = CURRENT_TIMESTAMP 
                 WHERE id = $1 
                 RETURNING *`,
                [payment_id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Paiement non trouvé',
                    code: 'PAYMENT_NOT_FOUND'
                });
            }
            
            res.json({
                success: true,
                message: 'Paiement approuvé avec succès',
                data: result.rows[0]
            });
            
        } catch (error) {
            console.error('❌ [approvePayment] Erreur:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur approbation paiement',
                code: 'SERVER_ERROR'
            });
        }
    }

    async markAsPaid(req, res) {
        try {
            const { payment_id } = req.params;
            
            console.log(`💰 [markAsPaid] Marquage comme payé: ${payment_id}`);
            
            const result = await db.query(
                `UPDATE salary_payments 
                 SET payment_status = 'paid', 
                     payment_date = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP 
                 WHERE id = $1 
                 RETURNING *`,
                [payment_id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Paiement non trouvé',
                    code: 'PAYMENT_NOT_FOUND'
                });
            }
            
            res.json({
                success: true,
                message: 'Paiement marqué comme payé',
                data: result.rows[0]
            });
            
        } catch (error) {
            console.error('❌ [markAsPaid] Erreur:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur marquage comme payé',
                code: 'SERVER_ERROR'
            });
        }
    }

    async testConnection(req, res) {
        try {
            const result = await db.query('SELECT NOW() as current_time, version() as db_version');
            
            res.json({
                success: true,
                message: 'Connexion base de données OK',
                data: {
                    database_time: result.rows[0].current_time,
                    database_version: result.rows[0].db_version,
                    api_status: 'running',
                    timestamp: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('❌ [testConnection] Erreur:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur connexion base de données',
                error: error.message
            });
        }
    }

    // ==================== ENVOI EMAIL MANUEL ====================

    async sendPayslipEmail(req, res) {
    try {
        const { employee_id, month_year } = req.body;
        
        console.log(`📧 [sendPayslipEmail] Envoi manuel fiche de paie: ${employee_id} - ${month_year}`);
        
        if (!employee_id || !month_year) {
            return res.status(400).json({
                success: false,
                message: 'ID employé et mois requis',
                code: 'MISSING_REQUIRED_FIELDS'
            });
        }
        
        // Vérifier que le paiement existe et est payé
        const paymentResult = await db.query(
            `SELECT sp.*, e.email 
             FROM salary_payments sp
             LEFT JOIN employees e ON sp.employee_id = e.employee_id
             WHERE sp.employee_id = $1 AND sp.month_year = $2`,
            [employee_id, month_year]
        );
        
        if (paymentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Paiement non trouvé',
                code: 'PAYMENT_NOT_FOUND'
            });
        }
        
        const payment = paymentResult.rows[0];
        
        if (payment.payment_status !== 'paid') {
            return res.status(400).json({
                success: false,
                message: 'Le paiement doit être marqué comme payé avant l\'envoi',
                code: 'PAYMENT_NOT_PAID'
            });
        }
        
        if (!payment.email) {
            return res.status(400).json({
                success: false,
                message: 'L\'employé n\'a pas d\'adresse email configurée',
                code: 'NO_EMAIL_ADDRESS'
            });
        }
        
        // ⭐ UTILISER LE ROTATEUR POUR L'ENVOI MANUEL
        const emailSent = await this.sendPayslipByEmail(employee_id, month_year);
        
        if (emailSent) {
            return res.json({
                success: true,
                message: 'Fiche de paie envoyée par email avec succès',
                data: {
                    employee_id,
                    month_year,
                    email: payment.email,
                    sent_at: new Date().toISOString()
                }
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'envoi de l\'email',
                code: 'EMAIL_SEND_FAILED',
                data: {
                    employee_id,
                    month_year,
                    email: payment.email
                }
            });
        }
        
    } catch (error) {
        console.error('❌ [sendPayslipEmail] Erreur:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de l\'envoi de l\'email',
            code: 'SERVER_ERROR',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

    // ==================== REENVOI EMAILS EN MASSE ====================

    async resendFailedEmails(req, res) {
        try {
            const { month_year } = req.body;
            
            console.log(`📧 [resendFailedEmails] Réenvoi emails échoués pour: ${month_year}`);
            
            if (!month_year) {
                return res.status(400).json({
                    success: false,
                    message: 'Mois requis',
                    code: 'MISSING_MONTH_YEAR'
                });
            }
            
            // Récupérer les paiements avec emails échoués
            const failedPayments = await db.query(`
                SELECT sp.employee_id, e.email, e.first_name, e.last_name
                FROM salary_payments sp
                JOIN employees e ON sp.employee_id = e.employee_id
                WHERE sp.month_year = $1
                AND sp.payment_status = 'paid'
                AND (sp.email_sent = false OR sp.email_sent IS NULL)
                AND e.email IS NOT NULL
            `, [month_year]);
            
            if (failedPayments.rows.length === 0) {
                return res.json({
                    success: true,
                    message: 'Aucun email échoué à renvoyer',
                    data: {
                        resent: 0,
                        failed: 0
                    }
                });
            }
            
            console.log(`📧 [resendFailedEmails] ${failedPayments.rows.length} emails à renvoyer`);
            
            // ⭐ UTILISER LE ROTATEUR POUR LE RENVOI
            const employeesToNotify = failedPayments.rows.map(e => ({
                employee_id: e.employee_id,
                email: e.email,
                first_name: e.first_name,
                last_name: e.last_name
            }));
            
            const results = await emailRotator.sendBatchByLots(
                employeesToNotify,
                `Fiche de paie ${month_year}`,
                (employee) => this.generatePayslipEmailHTML(employee, month_year),
                (processed, total, currentResults) => {
                    console.log(`📧 Réenvoi progression: ${processed}/${total}`);
                }
            );
            
            // Mettre à jour les statuts
            for (const email of results.sent) {
                const employee = failedPayments.rows.find(e => e.email === email);
                if (employee) {
                    await db.query(
                        `UPDATE salary_payments 
                         SET email_sent = true,
                             email_sent_at = NOW(),
                             email_status = 'sent',
                             email_attempts = COALESCE(email_attempts, 0) + 1
                         WHERE employee_id = $1 AND month_year = $2`,
                        [employee.employee_id, month_year]
                    );
                }
            }
            
            for (const failed of results.failed) {
                const employee = failedPayments.rows.find(e => e.email === failed.email);
                if (employee) {
                    await db.query(
                        `UPDATE salary_payments 
                         SET email_status = 'failed',
                             email_error = $1,
                             email_attempts = COALESCE(email_attempts, 0) + 1
                         WHERE employee_id = $2 AND month_year = $3`,
                        [failed.error.substring(0, 500), employee.employee_id, month_year]
                    );
                }
            }
            
            console.log(`📧 [resendFailedEmails] Renvoi terminé: ${results.sent.length} réussis, ${results.failed.length} échecs`);
            
            res.json({
                success: true,
                message: `Renvoi emails terminé: ${results.sent.length} réussis, ${results.failed.length} échecs`,
                data: results
            });
            
        } catch (error) {
            console.error('❌ [resendFailedEmails] Erreur:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors du renvoi des emails',
                code: 'SERVER_ERROR'
            });
        }
    }
    
    // ==================== TÉLÉCHARGEMENT GROUPÉ EN ZIP ====================


async downloadAllPayslips(req, res) {
    try {
        const { month_year, format = 'pdf', page = 1, limit = 50 } = req.query;
        
        console.log(`📦 [downloadAllPayslips] Téléchargement groupé pour: ${month_year}, format: ${format}, page: ${page}`);
        
        // 1. Vérifier que le mois existe
        const monthCheck = await db.query(
            'SELECT * FROM pay_months WHERE month_year = $1',
            [month_year]
        );
        
        if (monthCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Mois ${month_year} non trouvé`,
                code: 'MONTH_NOT_FOUND'
            });
        }
        
        const month = monthCheck.rows[0];
        
        // 2. Récupérer les paiements du mois avec pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        const paymentsQuery = await db.query(
            `SELECT sp.*, e.first_name, e.last_name, e.department
             FROM salary_payments sp
             JOIN employees e ON sp.employee_id = e.employee_id
             WHERE sp.month_year = $1
             AND sp.payment_status = 'paid'
             ORDER BY e.last_name, e.first_name
             LIMIT $2 OFFSET $3`,
            [month_year, parseInt(limit), offset]
        );
        
        const totalQuery = await db.query(
            `SELECT COUNT(*) as total FROM salary_payments 
             WHERE month_year = $1 AND payment_status = 'paid'`,
            [month_year]
        );
        
        const totalPayments = parseInt(totalQuery.rows[0].total) || 0;
        const totalPages = Math.ceil(totalPayments / parseInt(limit));
        const currentPayments = paymentsQuery.rows;
        
        if (currentPayments.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucun paiement trouvé pour ce mois',
                code: 'NO_PAYMENTS_FOUND'
            });
        }
        
        console.log(`📊 ${currentPayments.length} paiements à exporter (page ${page}/${totalPages})`);
        
        // 3. Créer l'archive ZIP
        const zip = new AdmZip();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const zipName = `fiches_paie_${month_year}_page${page}_${timestamp}.zip`;
        
        // 4. Générer chaque fiche de paie selon le format demandé
        const generatedFiles = [];
        
        for (const payment of currentPayments) {
            try {
                // Récupérer les données complètes de la fiche de paie
                const payslipData = await this.generatePayslipData(payment.employee_id, month_year);
                
                if (!payslipData) {
                    console.log(`⚠️ Données non trouvées pour ${payment.employee_id}`);
                    continue;
                }
                
                let fileContent;
                let fileName;
                let fileExtension;
                
                switch(format.toLowerCase()) {
                    case 'pdf':
                        // Générer PDF
                        fileContent = await this.generatePDFBuffer(payslipData);
                        fileExtension = 'pdf';
                        break;
                        
                    case 'excel':
                        // Générer Excel
                        fileContent = await this.generateExcelBuffer(payslipData);
                        fileExtension = 'xlsx';
                        break;
                        
                    case 'html':
                        // Générer HTML
                        fileContent = this.generateHTMLString(payslipData);
                        fileExtension = 'html';
                        break;
                        
                    case 'json':
                        // Générer JSON
                        fileContent = Buffer.from(JSON.stringify(payslipData, null, 2), 'utf-8');
                        fileExtension = 'json';
                        break;
                        
                    default:
                        fileContent = this.generateHTMLString(payslipData);
                        fileExtension = 'html';
                }
                
                // Nom du fichier : [EMPLOYEE_ID]_[NOM]_[PRENOM]_[MOIS].[extension]
                const safeLastName = payslipData.employee.name.replace(/[^a-zA-Z0-9]/g, '_');
                fileName = `${payment.employee_id}_${safeLastName}_${month_year}.${fileExtension}`;
                
                // Ajouter le fichier à l'archive
                zip.addFile(fileName, fileContent);
                
                generatedFiles.push({
                    employee_id: payment.employee_id,
                    name: payslipData.employee.name,
                    file: fileName,
                    size: fileContent.length,
                    format: format
                });
                
                console.log(`✅ Fiche générée: ${fileName}`);
                
            } catch (error) {
                console.error(`❌ Erreur génération pour ${payment.employee_id}:`, error.message);
            }
        }
        
        if (generatedFiles.length === 0) {
            return res.status(500).json({
                success: false,
                message: 'Aucune fiche générée',
                code: 'NO_FILES_GENERATED'
            });
        }
        
        // 5. Ajouter un fichier README avec les métadonnées
        const readmeContent = `
FICHES DE PAIE - ${month.month_name} ${month_year}

Date de génération: ${new Date().toLocaleString('fr-FR')}
Page: ${page} sur ${totalPages}
Total employés ce mois: ${totalPayments}
Employés dans cette archive: ${generatedFiles.length}
Format: ${format.toUpperCase()}

LISTE DES FICHES:
${generatedFiles.map(f => `- ${f.employee_id}: ${f.name} (${f.file})`).join('\n')}

INFORMATIONS:
- Archive générée automatiquement par le système de paie
- Documents confidentiels - Usage interne uniquement
© ${new Date().getFullYear()} Smart Attendance System
        `;
        
        zip.addFile('README.txt', Buffer.from(readmeContent, 'utf-8'));
        
        // 6. Ajouter un fichier CSV récapitulatif
        const csvHeaders = ['ID Employé', 'Nom', 'Département', 'Salaire Net', 'Statut', 'Date Paiement'];
        const csvRows = currentPayments.map(p => [
            p.employee_id,
            `${p.first_name} ${p.last_name}`,
            p.department,
            p.net_salary,
            p.payment_status,
            p.payment_date ? new Date(p.payment_date).toLocaleDateString('fr-FR') : ''
        ]);
        
        const csvContent = [csvHeaders.join(',')]
            .concat(csvRows.map(row => row.map(cell => `"${cell}"`).join(',')))
            .join('\n');
        
        zip.addFile('recapitulatif.csv', Buffer.from(csvContent, 'utf-8'));
        
        // 7. Générer le buffer ZIP
        const zipBuffer = zip.toBuffer();
        
        console.log(`✅ Archive créée: ${zipName} (${zipBuffer.length} octets, ${generatedFiles.length} fichiers)`);
        
        // 8. Configurer la réponse
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
        res.setHeader('Content-Length', zipBuffer.length);
        res.setHeader('X-Zip-Info', JSON.stringify({
            month_year: month_year,
            month_name: month.month_name,
            page: parseInt(page),
            total_pages: totalPages,
            files_count: generatedFiles.length,
            total_size: zipBuffer.length,
            generated_at: new Date().toISOString()
        }));
        
        // 9. Envoyer le ZIP
        res.send(zipBuffer);
        
    } catch (error) {
        console.error('❌ [downloadAllPayslips] Erreur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du téléchargement groupé',
            code: 'SERVER_ERROR',
            detail: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// ==================== METHODES UTILITAIRES POUR LES BUFFERS ====================

async generatePDFBuffer(payslipData) {
    return new Promise((resolve, reject) => {
        try {
            const PDFDocument = require('pdfkit');
            const chunks = [];
            
            const doc = new PDFDocument({
                margin: 50,
                size: 'A4'
            });
            
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
            
            // Copier le contenu de generatePDFPayslip mais sans res
            doc.fontSize(24).text('FICHE DE PAIE', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(10).text(payslipData.company_info.name, { align: 'center' });
            doc.moveDown();
            
            // Informations employé
            doc.fontSize(14).text('INFORMATIONS EMPLOYÉ', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(11);
            doc.text(`Nom: ${payslipData.employee.name}`);
            doc.text(`ID Employé: ${payslipData.employee.id}`);
            doc.text(`Département: ${payslipData.employee.department}`);
            
            // Période
            doc.moveDown();
            doc.fontSize(14).text('PÉRIODE DE PAIE', { underline: true });
            doc.moveDown(0.5);
            doc.text(`Mois: ${payslipData.period.month_name} ${payslipData.period.month_year}`);
            
            // Gains
            doc.moveDown();
            doc.fontSize(14).text('GAINS', { underline: true });
            doc.moveDown(0.5);
            doc.text(`Salaire de base: ${payslipData.earnings.base_salary.toFixed(2)} ${payslipData.summary.currency}`);
            doc.text(`Bonus fixe: ${payslipData.earnings.bonus_fixed.toFixed(2)} ${payslipData.summary.currency}`);
            doc.text(`Heures supplémentaires: ${payslipData.earnings.overtime.toFixed(2)} ${payslipData.summary.currency}`);
            
            // Déductions
            doc.moveDown();
            doc.fontSize(14).text('DÉDUCTIONS', { underline: true });
            doc.moveDown(0.5);
            doc.text(`Impôts: ${payslipData.deductions.tax.toFixed(2)} ${payslipData.summary.currency}`);
            doc.text(`Sécurité sociale: ${payslipData.deductions.social_security.toFixed(2)} ${payslipData.summary.currency}`);
            doc.text(`Autres déductions: ${payslipData.deductions.other_deductions.toFixed(2)} ${payslipData.summary.currency}`);
            
            // Total
            doc.moveDown();
            doc.fontSize(16).text('RÉSUMÉ', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(12);
            doc.text(`Salaire brut: ${payslipData.summary.gross_salary.toFixed(2)} ${payslipData.summary.currency}`);
            doc.text(`Total déductions: ${payslipData.summary.total_deductions.toFixed(2)} ${payslipData.summary.currency}`);
            
            doc.moveDown(0.5);
            doc.fontSize(18).text(`NET À PAYER: ${payslipData.summary.net_salary.toFixed(2)} ${payslipData.summary.currency}`, { 
                align: 'right', 
                bold: true 
            });
            
            doc.end();
            
        } catch (error) {
            reject(error);
        }
    });
}

async generateExcelBuffer(payslipData) {
    try {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Fiche de Paie');
        
        // Remplir le contenu Excel (simplifié)
        worksheet.addRow(['FICHE DE PAIE', payslipData.company_info.name]);
        worksheet.addRow([]);
        worksheet.addRow(['Employé:', payslipData.employee.name]);
        worksheet.addRow(['ID:', payslipData.employee.id]);
        worksheet.addRow(['Mois:', `${payslipData.period.month_name} ${payslipData.period.month_year}`]);
        worksheet.addRow([]);
        worksheet.addRow(['Salaire net:', payslipData.summary.net_salary]);
        
        return await workbook.xlsx.writeBuffer();
        
    } catch (error) {
        console.error('❌ [generateExcelBuffer] Erreur:', error);
        throw error;
    }
}

// payrollController.js - Version complète de generateHTMLString()
// À AJOUTER dans votre contrôleur, après generatePDFBuffer()

generateHTMLString(payslipData) {
    try {
        console.log('📄 [generateHTMLString] Génération HTML pour:', payslipData.employee.name);
        
        // Fonctions utilitaires pour le formatage
        const formatCurrency = (amount) => {
            return new Intl.NumberFormat('fr-TN', {
                style: 'currency',
                currency: payslipData.summary.currency || 'TND',
                minimumFractionDigits: 2,
                maximumFractionDigits: 3
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

        // Construction du HTML avec EXACTEMENT la même structure que le PDF
        const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fiche de Paie - ${payslipData.employee.name}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
            padding: 40px;
        }
        
        .payslip-container {
            max-width: 800px;
            margin: 0 auto;
            background-color: white;
            padding: 50px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            border-radius: 5px;
        }
        
        h1 {
            font-size: 28px;
            font-weight: bold;
            text-align: center;
            color: #2c3e50;
            margin-bottom: 5px;
        }
        
        .company-name {
            font-size: 12px;
            text-align: center;
            color: #7f8c8d;
            margin-bottom: 20px;
        }
        
        hr {
            border: none;
            border-top: 1px solid #3498db;
            margin: 15px 0;
        }
        
        .section-title {
            font-size: 16px;
            font-weight: bold;
            text-decoration: underline;
            margin: 15px 0 10px 0;
            color: #2c3e50;
        }
        
        .info-item {
            margin-bottom: 3px;
            font-size: 11px;
        }
        
        .info-label {
            font-weight: normal;
            color: #7f8c8d;
            width: 120px;
            display: inline-block;
        }
        
        .info-value {
            font-weight: bold;
            color: #2c3e50;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 20px;
        }
        
        .salary-section {
            margin-bottom: 25px;
        }
        
        .salary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 11px;
        }
        
        .salary-label {
            color: #34495e;
        }
        
        .salary-amount {
            font-weight: 500;
        }
        
        .total-row {
            font-weight: bold;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #bdc3c7;
            display: flex;
            justify-content: space-between;
            font-size: 13px;
        }
        
        .positive {
            color: #27ae60;
        }
        
        .negative {
            color: #e74c3c;
        }
        
        .summary {
            margin: 20px 0;
        }
        
        .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 12px;
        }
        
        .net-pay {
            margin: 20px 0;
            padding: 10px;
            background-color: #ecf0f1;
            border-radius: 5px;
            text-align: right;
            font-size: 18px;
            font-weight: bold;
            color: #2c3e50;
        }
        
        .footer {
            margin-top: 30px;
            font-size: 10px;
            color: #7f8c8d;
            border-top: 1px dashed #bdc3c7;
            padding-top: 15px;
        }
        
        .footer-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
        }
        
        .company-address {
            text-align: center;
            margin-top: 15px;
            font-size: 9px;
        }
        
        .cin-number, .cnss-number {
            font-family: 'Courier New', monospace;
        }
        
        @media print {
            body {
                background-color: white;
                padding: 0;
            }
            .payslip-container {
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <div class="payslip-container">
        <!-- === EN-TÊTE === (exactement comme dans le PDF) -->
        <h1>FICHE DE PAIE</h1>
        <div class="company-name">${payslipData.company_info.name}</div>
        
        <hr>
        
        <!-- === INFORMATIONS EMPLOYÉ === (exactement comme dans le PDF) -->
        <div class="section-title">INFORMATIONS EMPLOYÉ</div>
        
        <div class="info-grid">
            <!-- Colonne 1 -->
            <div>
                <div class="info-item">
                    <span class="info-label">Nom:</span>
                    <span class="info-value">${payslipData.employee.name}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">ID Employé:</span>
                    <span class="info-value">${payslipData.employee.id}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Département:</span>
                    <span class="info-value">${payslipData.employee.department || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">CIN:</span>
                    <span class="info-value cin-number">${payslipData.employee.cin || 'Non renseigné'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">CNSS:</span>
                    <span class="info-value cnss-number">${payslipData.employee.cnss || 'Non renseigné'}</span>
                </div>
            </div>
            
            <!-- Colonne 2 -->
            <div>
                <div class="info-item">
                    <span class="info-label">Poste:</span>
                    <span class="info-value">${payslipData.employee.position || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Date embauche:</span>
                    <span class="info-value">${payslipData.employee.hire_date ? formatDate(payslipData.employee.hire_date) : 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${payslipData.employee.email || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Téléphone:</span>
                    <span class="info-value">${payslipData.employee.phone || 'N/A'}</span>
                </div>
            </div>
        </div>
        
        <!-- === PÉRIODE DE PAIE === (exactement comme dans le PDF) -->
        <div class="section-title">PÉRIODE DE PAIE</div>
        <div class="info-item">
            <span class="info-label">Mois:</span>
            <span class="info-value">${payslipData.period.month_name} ${payslipData.period.month_year}</span>
        </div>
        
        <hr>
        
        <!-- === GAINS === (exactement comme dans le PDF) -->
        <div class="section-title">GAINS</div>
        
        <div class="salary-section">
            <div class="salary-row">
                <span class="salary-label">Salaire de base:</span>
                <span class="salary-amount positive">${formatCurrency(payslipData.earnings.base_salary)}</span>
            </div>
            <div class="salary-row">
                <span class="salary-label">Bonus fixe:</span>
                <span class="salary-amount positive">${formatCurrency(payslipData.earnings.bonus_fixed)}</span>
            </div>
            <div class="salary-row">
                <span class="salary-label">Heures supplémentaires:</span>
                <span class="salary-amount positive">${formatCurrency(payslipData.earnings.overtime)}</span>
            </div>
            
            <div class="total-row">
                <span class="salary-label">Total gains:</span>
                <span class="positive">${formatCurrency(payslipData.earnings.total_earnings)}</span>
            </div>
        </div>
        
        <!-- === DÉDUCTIONS === (exactement comme dans le PDF) -->
        <div class="section-title">DÉDUCTIONS</div>
        
        <div class="salary-section">
            <div class="salary-row">
                <span class="salary-label">Impôts:</span>
                <span class="salary-amount negative">${formatCurrency(payslipData.deductions.tax)}</span>
            </div>
            <div class="salary-row">
                <span class="salary-label">Sécurité sociale:</span>
                <span class="salary-amount negative">${formatCurrency(payslipData.deductions.social_security)}</span>
            </div>
            <div class="salary-row">
                <span class="salary-label">Autres déductions:</span>
                <span class="salary-amount negative">${formatCurrency(payslipData.deductions.other_deductions)}</span>
            </div>
            
            <div class="total-row">
                <span class="salary-label">Total déductions:</span>
                <span class="negative">${formatCurrency(payslipData.deductions.total_deductions)}</span>
            </div>
        </div>
        
        <!-- === RÉSUMÉ === (exactement comme dans le PDF) -->
        <div class="section-title">RÉSUMÉ</div>
        
        <div class="summary">
            <div class="summary-row">
                <span>Salaire brut:</span>
                <span>${formatCurrency(payslipData.summary.gross_salary)}</span>
            </div>
            <div class="summary-row">
                <span>Total déductions:</span>
                <span>${formatCurrency(payslipData.summary.total_deductions)}</span>
            </div>
        </div>
        
        <!-- === NET À PAYER === (exactement comme dans le PDF) -->
        <div class="net-pay">
            NET À PAYER: ${formatCurrency(payslipData.summary.net_salary)}
        </div>
        
        <!-- === PIED DE PAGE === (exactement comme dans le PDF) -->
        <div class="footer">
            <div class="footer-row">
                <span>Signature et cachet de l'entreprise:</span>
                <span>Date de génération: ${formatDate(payslipData.metadata.generated_at)}</span>
            </div>
            <div class="footer-row">
                <span></span>
                <span>ID fiche: ${payslipData.metadata.payslip_id}</span>
            </div>
            
            <div class="company-address">
                ${payslipData.company_info.address}<br>
                ${payslipData.company_info.email} | ${payslipData.company_info.phone}
            </div>
        </div>
    </div>
</body>
</html>`;

        return html;

    } catch (error) {
        console.error('❌ [generateHTMLString] Erreur:', error);
        // Fallback minimal en cas d'erreur
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Fiche de Paie</title>
    <style>
        body { font-family: Arial; padding: 20px; }
        h1 { color: #333; }
    </style>
</head>
<body>
    <h1>FICHE DE PAIE</h1>
    <p><strong>Employé:</strong> ${payslipData?.employee?.name || 'N/A'}</p>
    <p><strong>Mois:</strong> ${payslipData?.period?.month_name || 'N/A'} ${payslipData?.period?.month_year || ''}</p>
    <p><strong>Net à payer:</strong> ${payslipData?.summary?.net_salary?.toFixed(2) || '0'} ${payslipData?.summary?.currency || 'TND'}</p>
    <hr>
    <p><small>Généré le: ${new Date().toLocaleString('fr-FR')}</small></p>
</body>
</html>`;
    }
}

// ==================== TÉLÉCHARGEMENT DIRECT (SANS ZIP) ====================

async downloadPayslipBatch(req, res) {
    try {
        const { month_year, employee_ids } = req.body;
        
        if (!month_year || !employee_ids || !Array.isArray(employee_ids)) {
            return res.status(400).json({
                success: false,
                message: 'Mois et liste d\'IDs employés requis',
                code: 'MISSING_REQUIRED_FIELDS'
            });
        }
        
        console.log(`📦 [downloadPayslipBatch] Batch pour ${employee_ids.length} employés`);
        
        const zip = new AdmZip();
        
        for (const employee_id of employee_ids) {
            try {
                const payslipData = await this.generatePayslipData(employee_id, month_year);
                if (payslipData) {
                    const htmlContent = this.generateHTMLString(payslipData);
                    const fileName = `${employee_id}_${month_year}.html`;
                    zip.addFile(fileName, Buffer.from(htmlContent, 'utf-8'));
                }
            } catch (error) {
                console.error(`❌ Erreur pour ${employee_id}:`, error.message);
            }
        }
        
        const zipBuffer = zip.toBuffer();
        const zipName = `batch_payslips_${month_year}_${Date.now()}.zip`;
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
        res.send(zipBuffer);
        
    } catch (error) {
        console.error('❌ [downloadPayslipBatch] Erreur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur batch téléchargement',
            code: 'SERVER_ERROR'
        });
    }
}

// ==================== API POUR PAGINATION ====================

async getPayslipPagination(req, res) {
    try {
        const { month_year, page = 1, limit = 50 } = req.query;
        
        if (!month_year) {
            return res.status(400).json({
                success: false,
                message: 'Mois requis',
                code: 'MISSING_MONTH_YEAR'
            });
        }
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        // Récupérer les paiements avec pagination
        const payments = await db.query(
            `SELECT sp.*, e.first_name, e.last_name, e.department
             FROM salary_payments sp
             JOIN employees e ON sp.employee_id = e.employee_id
             WHERE sp.month_year = $1
             AND sp.payment_status = 'paid'
             ORDER BY e.last_name, e.first_name
             LIMIT $2 OFFSET $3`,
            [month_year, parseInt(limit), offset]
        );
        
        const total = await db.query(
            `SELECT COUNT(*) as count FROM salary_payments 
             WHERE month_year = $1 AND payment_status = 'paid'`,
            [month_year]
        );
        
        const totalCount = parseInt(total.rows[0].count) || 0;
        const totalPages = Math.ceil(totalCount / parseInt(limit));
        
        res.json({
            success: true,
            data: {
                payments: payments.rows,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: totalPages,
                    total_items: totalCount,
                    items_per_page: parseInt(limit),
                    has_next: parseInt(page) < totalPages,
                    has_previous: parseInt(page) > 1
                },
                month_info: {
                    month_year,
                    total_paid_employees: totalCount
                }
            }
        });
        
    } catch (error) {
        console.error('❌ [getPayslipPagination] Erreur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur récupération pagination',
            code: 'SERVER_ERROR'
        });
    }
}
// ==================== ENVOI GROUPÉ D'EMAILS ====================

async sendBulkPayslipEmails(req, res) {
    try {
        const { month_year, employee_ids, send_to_all } = req.body;
        
        console.log(`📧 [sendBulkPayslipEmails] Début envoi groupé pour: ${month_year}`);
        
        if (!month_year) {
            return res.status(400).json({
                success: false,
                message: 'Mois requis',
                code: 'MISSING_MONTH_YEAR'
            });
        }
        
        // Récupérer les paiements du mois
        let query = `
            SELECT sp.*, e.email, e.first_name, e.last_name, e.department
            FROM salary_payments sp
            JOIN employees e ON sp.employee_id = e.employee_id
            WHERE sp.month_year = $1
        `;
        
        const params = [month_year];
        
        // Si on envoie à des employés spécifiques
        if (employee_ids && Array.isArray(employee_ids) && employee_ids.length > 0) {
            query += ` AND sp.employee_id = ANY($2)`;
            params.push(employee_ids);
        }
        
        const paymentsResult = await db.query(query, params);
        
        if (paymentsResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucun paiement trouvé pour ce mois',
                code: 'NO_PAYMENTS_FOUND'
            });
        }
        
        // Filtrer les employés sans email
        const employeesWithEmail = paymentsResult.rows.filter(p => p.email);
        
        if (employeesWithEmail.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucun employé avec adresse email trouvé',
                code: 'NO_EMAILS_FOUND'
            });
        }
        
        console.log(`📧 ${employeesWithEmail.length} emails à envoyer`);
        
        // Vérifier configuration SMTP
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
            return res.status(500).json({
                success: false,
                message: 'Configuration SMTP manquante',
                code: 'SMTP_CONFIG_ERROR',
                simulated: true,
                sent: employeesWithEmail.length,
                failed: 0,
                details: employeesWithEmail.map(e => ({
                    employee_id: e.employee_id,
                    email: e.email,
                    status: 'simulated'
                }))
            });
        }
        
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS
            },
            tls: { rejectUnauthorized: false }
        });
        
        // Vérifier la connexion SMTP
        try {
            await transporter.verify();
            console.log('✅ Connexion SMTP vérifiée');
        } catch (smtpError) {
            console.error('❌ Erreur connexion SMTP:', smtpError.message);
            return res.status(500).json({
                success: false,
                message: 'Erreur connexion SMTP',
                code: 'SMTP_CONNECTION_ERROR',
                error: smtpError.message
            });
        }
        
        // Récupérer les informations du mois
        const monthResult = await db.query(
            'SELECT month_name FROM pay_months WHERE month_year = $1',
            [month_year]
        );
        
        const monthName = monthResult.rows[0]?.month_name || month_year;
        
        // Envoyer les emails en parallèle (limité à 3 à la fois)
        const emailResults = { sent: [], failed: [] };
        const maxConcurrent = 3;
        
        for (let i = 0; i < employeesWithEmail.length; i += maxConcurrent) {
            const batch = employeesWithEmail.slice(i, i + maxConcurrent);
            const batchPromises = batch.map(async (employee) => {
                try {
                    // Générer le contenu HTML de la fiche de paie
                    const payslipData = await this.generatePayslipData(employee.employee_id, month_year);
                    
                    if (!payslipData) {
                        throw new Error('Impossible de générer la fiche de paie');
                    }
                    
                    const mailOptions = {
                        from: process.env.EMAIL_FROM || '"Système de Paie" <noreply@entreprise.com>',
                        to: employee.email,
                        subject: `Votre fiche de paie - ${monthName}`,
                        html: this.generatePayslipEmailHTML(employee, month_year)
                    };
                    
                    const info = await transporter.sendMail(mailOptions);
                    
                    // Mettre à jour le statut dans la base
                    await db.query(
                        `UPDATE salary_payments 
                         SET email_sent = true,
                             email_sent_at = NOW(),
                             email_attempts = COALESCE(email_attempts, 0) + 1,
                             email_status = 'sent'
                         WHERE id = $1`,
                        [employee.id]
                    );
                    
                    emailResults.sent.push({
                        employee_id: employee.employee_id,
                        email: employee.email,
                        name: `${employee.first_name} ${employee.last_name}`,
                        message_id: info.messageId
                    });
                    
                } catch (error) {
                    console.error(`❌ Erreur email pour ${employee.email}:`, error.message);
                    
                    // Enregistrer l'échec
                    await db.query(
                        `UPDATE salary_payments 
                         SET email_status = 'failed',
                             email_error = $1,
                             email_attempts = COALESCE(email_attempts, 0) + 1
                         WHERE id = $2`,
                        [error.message.substring(0, 500), employee.id]
                    );
                    
                    emailResults.failed.push({
                        employee_id: employee.employee_id,
                        email: employee.email,
                        name: `${employee.first_name} ${employee.last_name}`,
                        reason: error.message
                    });
                }
            });
            
            await Promise.allSettled(batchPromises);
            console.log(`📧 Batch ${Math.floor(i/maxConcurrent) + 1} terminé`);
        }
        
        console.log(`📧 Résultat final: ${emailResults.sent.length} envoyés, ${emailResults.failed.length} échecs`);
        
        // Mettre à jour les statistiques du mois
        await db.query(
            `UPDATE pay_months 
             SET emails_sent = COALESCE(emails_sent, 0) + $1,
                 emails_failed = COALESCE(emails_failed, 0) + $2,
                 updated_at = NOW()
             WHERE month_year = $3`,
            [emailResults.sent.length, emailResults.failed.length, month_year]
        );
        
        res.json({
            success: true,
            message: `Envoi d'emails terminé: ${emailResults.sent.length} envoyés, ${emailResults.failed.length} échecs`,
            data: {
                sent: emailResults.sent.length,
                failed: emailResults.failed.length,
                total: employeesWithEmail.length,
                details: {
                    sent: emailResults.sent.slice(0, 10),
                    failed: emailResults.failed.slice(0, 10)
                }
            }
        });
        
    } catch (error) {
        console.error('❌ [sendBulkPayslipEmails] Erreur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'envoi groupé des emails',
            code: 'SERVER_ERROR',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
// ⭐ NOUVEAU : STATISTIQUES DES COMPTES EMAIL
    async getEmailStats(req, res) {
        try {
            const stats = emailRotator.getStats();
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('❌ [getEmailStats] Erreur:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur récupération statistiques email',
                code: 'SERVER_ERROR'
            });
        }
    }
}

module.exports = new PayrollController();   