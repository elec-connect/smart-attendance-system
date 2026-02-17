// routes/payrollRoutes.js - VERSION COMPLÈTE AVEC EMAILS AUTOMATIQUES ET ROUTES EMPLOYÉS
const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Import direct de la configuration DB depuis le bon chemin
const db = require('../../config/db');

// Routes protégées par authentification
router.use(authenticateToken);

// DEBUG : Afficher quand on entre dans les routes
console.log('🔍 [ROUTES] Routes payrol chargées - Début');
console.log('🔍 [ROUTES] Nombre de layers:', router.stack.length);

// Route de test AVANT tout
router.get('/test-first-route', (req, res) => {
    console.log('✅ Route test-first-route appelée (PREMIÈRE)');
    res.json({ success: true, message: 'Première route test' });
});

// Fonction utilitaire pour récupérer l'employee_id si manquant
const getEmployeeIdFromEmail = async (email) => {
  try {
    console.log(`🔍 Recherche employee_id pour email: ${email}`);
    const result = await db.query(
      'SELECT employee_id FROM employees WHERE email = $1',
      [email]
    );
    
    if (result.rows.length > 0) {
      const employeeId = result.rows[0].employee_id;
      console.log(`✅ Employee_id trouvé: ${employeeId}`);
      return employeeId;
    }
    
    console.log(`⚠️ Aucun employee_id trouvé pour email: ${email}`);
    return null;
  } catch (error) {
    console.error('❌ Erreur récupération employee_id:', error.message);
    return null;
  }
};

// Route racine
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'API Paie - Smart Attendance System',
        version: '4.0.0',
        basePath: '/api/payroll',
        availableEndpoints: [
            // Tableau de bord
            { method: 'GET', path: '/dashboard', description: 'Tableau de bord complet', roles: ['admin', 'hr', 'manager'] },
            
            // Configuration salaire
            { method: 'POST', path: '/configure', description: 'Configurer salaire employé', roles: ['admin', 'hr'] },
            { method: 'GET', path: '/config/:employeeId', description: 'Obtenir configuration salaire', roles: ['admin', 'hr', 'manager'] },
            { method: 'PUT', path: '/config/:employee_id', description: 'Mettre à jour configuration', roles: ['admin', 'hr'] },
            
            // Employés
            { method: 'GET', path: '/employees', description: 'Liste employés disponibles', roles: ['admin', 'hr', 'manager'] },
            
            // Mois de paie
            { method: 'POST', path: '/pay-months', description: 'Créer mois de paie', roles: ['admin', 'hr'] },
            { method: 'GET', path: '/pay-months', description: 'Liste des mois de paie', roles: ['admin', 'hr', 'manager'] },
            { method: 'GET', path: '/pay-months/:month_year', description: 'Détails mois de paie', roles: ['admin', 'hr', 'manager'] },
            
            // Calcul et paiements
            { method: 'POST', path: '/calculate', description: 'Calculer salaires', roles: ['admin', 'hr'] },
            { method: 'POST', path: '/mark-month-as-paid', description: 'Marquer mois comme payé (ENVOIE EMAILS AUTO)', roles: ['admin', 'hr'] },
            { method: 'GET', path: '/payments/:month_year', description: 'Paiements du mois', roles: ['admin', 'hr', 'manager'] },
            
            // Rapports
            { method: 'GET', path: '/reports', description: 'Générer rapports (salary_summary, attendance_impact, department_comparison, tax_report)', roles: ['admin', 'hr', 'manager'] },
            
            // Fiches de paie
            { method: 'GET', path: '/payslip/:employee_id/:month_year', description: 'Générer fiche de paie', roles: ['admin', 'hr', 'employee (self)'] },
            { method: 'GET', path: '/payslip/export/:employee_id/:month_year/:format', description: 'Exporter fiche de paie (pdf/excel/html)', roles: ['admin', 'hr'] },
            
            // Historique
            { method: 'GET', path: '/history', description: 'Historique complet des paiements avec filtres', roles: ['admin', 'hr', 'manager'] },
            { method: 'GET', path: '/history/export', description: 'Exporter historique (JSON/CSV)', roles: ['admin', 'hr', 'manager'] },
            { method: 'GET', path: '/employee/:employee_id/history', description: 'Historique paie employé', roles: ['admin', 'hr', 'manager', 'employee (self)'] },
            
            // Gestion paiements
            { method: 'PUT', path: '/approve/:payment_id', description: 'Approuver paiement', roles: ['admin', 'hr'] },
            { method: 'PUT', path: '/mark-paid/:payment_id', description: 'Marquer paiement comme payé', roles: ['admin', 'hr'] },
            
            // Emails
            { method: 'POST', path: '/payslip/send-email', description: 'Envoyer fiche de paie par email', roles: ['admin', 'hr'] },
            { method: 'POST', path: '/resend-failed-emails', description: 'Renvoyer les emails échoués', roles: ['admin', 'hr'] },
            
            // Statistiques
            { method: 'GET', path: '/stats', description: 'Statistiques complètes', roles: ['admin', 'hr', 'manager'] },
            { method: 'GET', path: '/stats/quick', description: 'Statistiques rapides', roles: ['admin', 'hr', 'manager', 'employee'] },
            
            // Utilitaires
            { method: 'GET', path: '/test-connection', description: 'Tester connexion BD', roles: ['all'] },
            { method: 'GET', path: '/health', description: 'Vérifier santé API', roles: ['all'] },
            { method: 'GET', path: '/test', description: 'Test API', roles: ['all'] },
            
            // NOUVEAU: Routes pour profil employé
            { method: 'GET', path: '/my-payslips', description: 'Mes fiches de paie (pour employé)', roles: ['employee'] },
            { method: 'GET', path: '/my-latest-payslip', description: 'Ma dernière fiche de paie', roles: ['employee'] },
            { method: 'GET', path: '/my-salary-config', description: 'Ma configuration salariale', roles: ['employee'] },
            { method: 'GET', path: '/my-stats', description: 'Mes statistiques personnelles', roles: ['employee'] },
            { method: 'GET', path: '/my-payslips/:month_year/download/:format', description: 'Télécharger ma fiche de paie (pdf/excel/html)', roles: ['employee'] },
            { method: 'GET', path: '/my-payslips/:month_year/download-simple/:format', description: 'Téléchargement simplifié', roles: ['employee'] },
            
            // NOUVEAU: Routes de téléchargement groupé
            { method: 'GET', path: '/download-all', description: 'Télécharger toutes les fiches de paie (admin)', roles: ['admin', 'hr'] },
            { method: 'POST', path: '/download-batch', description: 'Télécharger un lot de fiches de paie', roles: ['admin', 'hr'] },
            { method: 'GET', path: '/pagination', description: 'Pagination pour téléchargement', roles: ['admin', 'hr', 'manager'] }
        ],
        note: 'Toutes les routes nécessitent un token JWT valide',
        email_feature: 'Les fiches de paie sont automatiquement envoyées par email lorsque le mois est marqué comme payé',
        timestamp: new Date().toISOString()
    });
});

// ==================== TABLEAU DE BORD ====================
router.get('/dashboard', authorizeRoles(['admin', 'hr', 'manager']), (req, res) => 
    payrollController.getDashboard(req, res)
);

// ==================== CONFIGURATION SALAIRE ====================
router.post('/configure', authorizeRoles(['admin', 'hr']), (req, res) => 
    payrollController.configureSalary(req, res)
);

router.get('/config/:employee_id', authorizeRoles(['admin', 'hr', 'manager']), (req, res) => 
  payrollController.getSalaryConfig(req, res)
);

router.put('/config/:employee_id', authorizeRoles(['admin', 'hr']), (req, res) => 
    payrollController.updateSalaryConfig(req, res)
);

// ==================== EMPLOYÉS DISPONIBLES ====================
router.get('/employees', authorizeRoles(['admin', 'hr', 'manager']), (req, res) => 
    payrollController.getAvailableEmployees(req, res)
);

// ==================== MOIS DE PAIE ====================
router.post('/pay-months', authorizeRoles(['admin', 'hr']), (req, res) => 
    payrollController.createPayMonth(req, res)
);

router.get('/pay-months', authorizeRoles(['admin', 'hr', 'manager']), (req, res) => 
    payrollController.getPayMonths(req, res)
);

router.get('/pay-months/:month_year', authorizeRoles(['admin', 'hr', 'manager']), (req, res) => 
    payrollController.getPayMonth(req, res)
);

// ==================== CALCUL SALAIRES ====================
router.post('/calculate', authorizeRoles(['admin', 'hr']), (req, res) => 
    payrollController.calculateSalaries(req, res)
);

// ==================== MARQUER MOIS COMME PAYÉ (ENVOI EMAILS AUTO) ====================
router.post('/mark-month-as-paid', authorizeRoles(['admin', 'hr']), (req, res) => 
    payrollController.markMonthAsPaid(req, res)
);

router.get('/payments/:month_year', authorizeRoles(['admin', 'hr', 'manager']), (req, res) => 
    payrollController.getMonthlyPayments(req, res)
);

// ==================== RAPPORTS ====================
router.get('/reports', authorizeRoles(['admin', 'hr', 'manager']), (req, res) => 
    payrollController.getReports(req, res)
);

// ==================== FICHES DE PAIE ====================
router.get('/payslip/:employee_id/:month_year', (req, res, next) => {
    const userRole = req.user?.role;
    const userId = req.user?.employee_id || req.user?.id;
    const requestedId = req.params.employee_id;
    
    // Admin/HR/Manager peuvent voir tout
    if (['admin', 'hr', 'manager'].includes(userRole)) {
        return next();
    }
    
    // Employé peut voir sa propre fiche
    if (userRole === 'employee' && userId === requestedId) {
        return next();
    }
    
    return res.status(403).json({
        success: false,
        message: 'Accès non autorisé - Vous ne pouvez voir que votre propre fiche de paie'
    });
}, (req, res) => payrollController.generatePayslip(req, res));

router.get('/payslip/export/:employee_id/:month_year/:format', authorizeRoles(['admin', 'hr']), (req, res) => 
    payrollController.exportPayslip(req, res)
);

// ==================== HISTORIQUE ====================
router.get('/history', authorizeRoles(['admin', 'hr', 'manager']), (req, res) => 
    payrollController.getPaymentHistory(req, res)
);

router.get('/history/export', authorizeRoles(['admin', 'hr', 'manager']), (req, res) => 
    payrollController.exportPaymentHistory(req, res)
);

// ==================== HISTORIQUE EMPLOYÉ ====================
router.get('/employee/:employee_id/history', (req, res, next) => {
    const userRole = req.user?.role;
    const userId = req.user?.employee_id || req.user?.id;
    const requestedId = req.params.employee_id;
    
    // Admin/HR/Manager peuvent voir tout
    if (['admin', 'hr', 'manager'].includes(userRole)) {
        return next();
    }
    
    // Employé peut voir son propre historique
    if (userRole === 'employee' && userId === requestedId) {
        return next();
    }
    
    return res.status(403).json({
        success: false,
        message: 'Accès non autorisé - Vous ne pouvez voir que votre propre historique'
    });
}, (req, res) => payrollController.getEmployeePayHistory(req, res));

// ==================== STATISTIQUES ====================
router.get('/stats', authorizeRoles(['admin', 'hr', 'manager']), (req, res) => 
    payrollController.getPayrollStats(req, res)
);

router.get('/stats/quick', authorizeRoles(['admin', 'hr', 'manager', 'employee']), (req, res) => 
    payrollController.getQuickStats(req, res)
);

// ==================== GESTION PAIEMENTS ====================
router.put('/approve/:payment_id', authorizeRoles(['admin', 'hr']), (req, res) => 
    payrollController.approvePayment(req, res)
);

router.put('/mark-paid/:payment_id', authorizeRoles(['admin', 'hr']), (req, res) => 
    payrollController.markAsPaid(req, res)
);

// ==================== ENVOI EMAILS ====================

// Envoi manuel d'une fiche de paie par email
router.post('/payslip/send-email', authorizeRoles(['admin', 'hr']), (req, res) => 
    payrollController.sendPayslipEmail(req, res)
);

// Renvoi des emails échoués
router.post('/resend-failed-emails', authorizeRoles(['admin', 'hr']), (req, res) => 
    payrollController.resendFailedEmails(req, res)
);

// ==================== UTILITAIRES ====================
router.get('/test-connection', (req, res) => 
    payrollController.testConnection(req, res)
);

router.get('/health', (req, res) => 
    payrollController.healthCheck(req, res)
);

// ==================== ROUTES DE TÉLÉCHARGEMENT GROUPÉ ====================
router.get('/download-all', authorizeRoles(['admin', 'hr']), (req, res) => {
    console.log('🔗 [ROUTE] /download-all appelée');
    return payrollController.downloadAllPayslips(req, res);
});

router.post('/download-batch', authorizeRoles(['admin', 'hr']), (req, res) => {
    console.log('🔗 [ROUTE] /download-batch appelée');
    return payrollController.downloadPayslipBatch(req, res);
});

router.get('/pagination', authorizeRoles(['admin', 'hr', 'manager']), (req, res) => {
    console.log('🔗 [ROUTE] /pagination appelée');
    return payrollController.getPayslipPagination(req, res);
});

// ==================== ROUTE DE TEST ====================
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'API Paie fonctionne correctement',
        timestamp: new Date().toISOString(),
        user: req.user || 'non authentifié',
        features: {
            email_auto_send: true,
            payslip_export: true,
            payroll_calculation: true,
            batch_download: true
        }
    });
});

// ==================== ROUTE DE DEBUG ====================
router.get('/debug/me', (req, res) => {
    console.log('👤 [debug/me] User object complet:', req.user);
    
    res.json({
        success: true,
        user: req.user,
        headers: req.headers,
        has_token: !!req.headers.authorization,
        timestamp: new Date().toISOString(),
        suggestions: [
            'Vérifiez que req.user.employee_id existe',
            'Vérifiez que le token contient les bonnes informations',
            'Vérifiez le rôle de l\'utilisateur'
        ]
    });
});

// Route de debug pour vérifier le token
router.get('/debug/token', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.json({
            success: false,
            message: 'Pas de token'
        });
    }
    
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return res.json({
                success: false,
                message: 'Token invalide',
                token_length: token.length
            });
        }
        
        const payload = JSON.parse(atob(parts[1]));
        
        res.json({
            success: true,
            payload: payload,
            has_employee_id: !!payload.employee_id,
            is_expired: payload.exp ? (new Date(payload.exp * 1000) < new Date()) : true,
            expiration: payload.exp ? new Date(payload.exp * 1000).toISOString() : null
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// ==================== ROUTES SPÉCIFIQUES POUR PROFIL EMPLOYÉ ====================

// 1. Route pour que l'employé voie SES PROPRES fiches de paie
router.get('/my-payslips', async (req, res) => {
    try {
        const userRole = req.user?.role;
        const userEmail = req.user?.email;
        let userEmployeeId = req.user?.employee_id;

        console.log(`👤 [my-payslips] Requête de: ${userEmail} (${userRole}) - ID: ${userEmployeeId}`);

        // Si employee_id manquant, le récupérer depuis la BD
        if (!userEmployeeId && userEmail) {
            console.log(`🔍 Récupération employee_id pour: ${userEmail}`);
            userEmployeeId = await getEmployeeIdFromEmail(userEmail);
            console.log(`✅ Employee_id trouvé: ${userEmployeeId}`);
        }

        // Vérifier si l'utilisateur a le droit
        if (userRole === 'employee' && userEmployeeId) {
            // L'employé voit ses propres fiches
            req.params.employee_id = userEmployeeId;
            return payrollController.getEmployeePayHistory(req, res);
        } else if (['admin', 'hr', 'manager'].includes(userRole)) {
            // Admin peut voir toutes les fiches (mais via une autre route)
            return res.status(400).json({
                success: false,
                message: 'Utilisez /history pour voir tous les paiements',
                suggestion: 'GET /api/payroll/history'
            });
        } else {
            return res.status(403).json({
                success: false,
                message: 'Accès non autorisé - Réservé aux employés'
            });
        }
    } catch (error) {
        console.error('❌ [my-payslips] Erreur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 2. Route pour que l'employé télécharge SA fiche de paie (version corrigée)
router.get('/my-payslips/:month_year/download/:format', async (req, res) => {
    try {
        const userRole = req.user?.role;
        const userEmail = req.user?.email;
        let userEmployeeId = req.user?.employee_id;
        const { month_year, format } = req.params;

        console.log(`📄 [my-payslips/download] ${userEmail} demande fiche ${month_year} en ${format} - ID: ${userEmployeeId}`);

        // Si employee_id manquant, le récupérer depuis la BD
        if (!userEmployeeId && userEmail) {
            console.log(`🔍 Récupération employee_id pour: ${userEmail}`);
            userEmployeeId = await getEmployeeIdFromEmail(userEmail);
            console.log(`✅ Employee_id trouvé pour téléchargement: ${userEmployeeId}`);
        }

        if (!userEmployeeId) {
            return res.status(400).json({
                success: false,
                message: 'ID employé non trouvé',
                suggestion: 'Veuillez vous reconnecter'
            });
        }

        // Vérifier les permissions
        if (userRole === 'employee') {
            // Employé peut télécharger sa propre fiche
            // Préparer les paramètres pour exportPayslip
            req.params.employee_id = userEmployeeId;
            return payrollController.exportPayslip(req, res);
        } else if (['admin', 'hr', 'manager'].includes(userRole)) {
            // Admin peut spécifier un ID différent via query param
            const adminRequestedId = req.query.employee_id;
            if (adminRequestedId) {
                req.params.employee_id = adminRequestedId;
                return payrollController.exportPayslip(req, res);
            }
            return res.status(400).json({
                success: false,
                message: 'Pour les admins, spécifiez employee_id dans les paramètres de requête',
                example: '?employee_id=EMP005'
            });
        } else {
            return res.status(403).json({
                success: false,
                message: 'Accès non autorisé'
            });
        }
    } catch (error) {
        console.error('❌ [my-payslips/download] Erreur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du téléchargement',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 3. Route simplifiée pour que l'employé télécharge SA fiche de paie
router.get('/my-payslips/:month_year/download-simple/:format', async (req, res) => {
    try {
        const userRole = req.user?.role;
        const userEmail = req.user?.email;
        let userEmployeeId = req.user?.employee_id;
        const { month_year, format } = req.params;

        console.log(`📥 [download-simple] ${userEmail} télécharge fiche ${month_year} en ${format}`);

        // Vérifier si c'est un employé
        if (userRole !== 'employee') {
            return res.status(403).json({
                success: false,
                message: 'Réservé aux employés'
            });
        }

        // Si employee_id manquant, le récupérer
        if (!userEmployeeId && userEmail) {
            userEmployeeId = await getEmployeeIdFromEmail(userEmail);
        }

        if (!userEmployeeId) {
            return res.status(400).json({
                success: false,
                message: 'ID employé non trouvé'
            });
        }

        // Vérifier que la fiche de paie existe
        const checkQuery = await db.query(`
            SELECT COUNT(*) as count 
            FROM salary_payments 
            WHERE employee_id = $1 AND month_year = $2
        `, [userEmployeeId, month_year]);

        if (checkQuery.rows[0].count === 0) {
            return res.status(404).json({
                success: false,
                message: 'Fiche de paie non trouvée',
                employee_id: userEmployeeId,
                month_year: month_year
            });
        }

        // Simuler les paramètres pour exportPayslip
        req.params.employee_id = userEmployeeId;
        
        // Appeler le contrôleur d'export
        return payrollController.exportPayslip(req, res);
        
    } catch (error) {
        console.error('❌ [download-simple] Erreur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du téléchargement',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 4. Route pour que l'employé voie SES STATISTIQUES
router.get('/my-stats', (req, res) => {
    const userRole = req.user?.role;
    const userEmail = req.user?.email;
    const userEmployeeId = req.user?.employee_id;

    console.log(`📊 [my-stats] Requête de: ${userEmail}`);

    if (!userEmployeeId) {
        return res.status(400).json({
            success: false,
            message: 'ID employé non trouvé dans le token'
        });
    }

    if (userRole !== 'employee') {
        return res.status(403).json({
            success: false,
            message: 'Réservé aux employés'
        });
    }

    // Récupérer les statistiques personnelles
    req.params.employee_id = userEmployeeId;
    return payrollController.getEmployeePayHistory(req, res);
});

// 5. Route pour que l'employé voit SA DERNIÈRE fiche de paie
router.get('/my-latest-payslip', async (req, res) => {
    try {
        const userRole = req.user?.role;
        const userEmail = req.user?.email;
        let userEmployeeId = req.user?.employee_id;

        console.log(`📄 [my-latest-payslip] Recherche dernière fiche pour: ${userEmail}`);

        // Si employee_id manquant, le récupérer
        if (!userEmployeeId && userEmail) {
            userEmployeeId = await getEmployeeIdFromEmail(userEmail);
        }

        if (!userEmployeeId) {
            return res.status(400).json({
                success: false,
                message: 'ID employé non trouvé dans le token',
                suggestion: 'Veuillez vous reconnecter'
            });
        }

        if (userRole !== 'employee') {
            return res.status(403).json({
                success: false,
                message: 'Réservé aux employés'
            });
        }

        // Récupérer la dernière fiche de paie
        const result = await db.query(`
            SELECT 
                sp.*,
                pm.month_name,
                pm.status as month_status,
                e.first_name,
                e.last_name,
                e.department
            FROM salary_payments sp
            JOIN pay_months pm ON sp.month_year = pm.month_year
            JOIN employees e ON sp.employee_id = e.employee_id
            WHERE sp.employee_id = $1
            AND sp.payment_status = 'paid'
            ORDER BY pm.start_date DESC
            LIMIT 1
        `, [userEmployeeId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucune fiche de paie trouvée',
                employee_id: userEmployeeId
            });
        }

        const latestPayslip = result.rows[0];

        // Formater la réponse
        const payslip = {
            employee: {
                id: latestPayslip.employee_id,
                name: `${latestPayslip.first_name} ${latestPayslip.last_name}`,
                department: latestPayslip.department
            },
            period: {
                month_year: latestPayslip.month_year,
                month_name: latestPayslip.month_name,
                payment_date: latestPayslip.payment_date
            },
            salary: {
                net_salary: parseFloat(latestPayslip.net_salary) || 0,
                base_salary: parseFloat(latestPayslip.base_salary) || 0,
                tax_amount: parseFloat(latestPayslip.tax_amount) || 0,
                deduction_amount: parseFloat(latestPayslip.deduction_amount) || 0
            },
            status: {
                payment_status: latestPayslip.payment_status,
                month_status: latestPayslip.month_status,
                email_sent: latestPayslip.email_sent,
                email_sent_at: latestPayslip.email_sent_at
            },
            metadata: {
                generated_at: new Date().toISOString(),
                payslip_id: latestPayslip.id,
                download_urls: {
                    pdf: `/api/payroll/my-payslips/${latestPayslip.month_year}/download/pdf`,
                    excel: `/api/payroll/my-payslips/${latestPayslip.month_year}/download/excel`,
                    html: `/api/payroll/my-payslips/${latestPayslip.month_year}/download/html`
                }
            }
        };

        res.json({
            success: true,
            message: 'Dernière fiche de paie récupérée',
            data: payslip
        });

    } catch (error) {
        console.error('❌ [my-latest-payslip] Erreur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur récupération dernière fiche'
        });
    }
});

// 6. Route pour que l'employé voie SA CONFIGURATION
router.get('/my-salary-config', async (req, res) => {
    try {
        const userRole = req.user?.role;
        const userEmail = req.user?.email;
        let userEmployeeId = req.user?.employee_id;

        console.log(`⚙️ [my-salary-config] Configuration pour: ${userEmail}`);

        // Si employee_id manquant, le récupérer
        if (!userEmployeeId && userEmail) {
            userEmployeeId = await getEmployeeIdFromEmail(userEmail);
        }

        if (!userEmployeeId) {
            return res.status(400).json({
                success: false,
                message: 'ID employé non trouvé'
            });
        }

        // Vérifier si l'utilisateur a le droit
        if (userRole !== 'employee') {
            return res.status(403).json({
                success: false,
                message: 'Réservé aux employés'
            });
        }

        // Récupérer la configuration
        const result = await db.query(`
            SELECT 
                sc.*,
                e.first_name,
                e.last_name,
                e.department,
                e.position,
                e.hire_date
            FROM salary_configs sc
            JOIN employees e ON sc.employee_id = e.employee_id
            WHERE sc.employee_id = $1
        `, [userEmployeeId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Configuration salariale non trouvée',
                employee_id: userEmployeeId
            });
        }

        const config = result.rows[0];

        // Calculer quelques estimations
        const baseSalary = parseFloat(config.base_salary) || 0;
        const taxRate = parseFloat(config.tax_rate) || 0;
        const ssRate = parseFloat(config.social_security_rate) || 0;
        const otherDeductions = parseFloat(config.other_deductions) || 0;
        const bonusFixed = parseFloat(config.bonus_fixed) || 0;

        const monthlyEstimate = {
            gross_salary: baseSalary + bonusFixed,
            tax_amount: baseSalary * (taxRate / 100),
            ss_amount: baseSalary * (ssRate / 100),
            total_deductions: (baseSalary * (taxRate / 100)) + (baseSalary * (ssRate / 100)) + otherDeductions,
            net_salary: baseSalary - ((baseSalary * (taxRate / 100)) + (baseSalary * (ssRate / 100)) + otherDeductions) + bonusFixed
        };

        const response = {
            success: true,
            data: {
                employee: {
                    id: config.employee_id,
                    name: `${config.first_name} ${config.last_name}`,
                    department: config.department,
                    position: config.position,
                    hire_date: config.hire_date
                },
                salary_config: {
                    base_salary: baseSalary,
                    currency: config.currency || 'TND',
                    tax_rate: taxRate,
                    social_security_rate: ssRate,
                    other_deductions: otherDeductions,
                    bonus_fixed: bonusFixed,
                    payment_method: config.payment_method,
                    bank_details: {
                        bank_name: config.bank_name,
                        bank_account: config.bank_account,
                        iban: config.iban
                    },
                    created_at: config.created_at,
                    updated_at: config.updated_at
                },
                estimates: {
                    monthly: monthlyEstimate,
                    annual: {
                        gross_salary: monthlyEstimate.gross_salary * 12,
                        total_deductions: monthlyEstimate.total_deductions * 12,
                        net_salary: monthlyEstimate.net_salary * 12
                    },
                    daily: {
                        rate: baseSalary / 22
                    },
                    hourly: {
                        rate: baseSalary / (22 * 8)
                    }
                },
                metadata: {
                    retrieved_at: new Date().toISOString(),
                    payslip_download_example: `/api/payroll/my-payslips/2026-03/download/pdf`
                }
            }
        };

        res.json(response);

    } catch (error) {
        console.error('❌ [my-salary-config] Erreur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur récupération configuration'
        });
    }
});

// ==================== GESTION ERREURS 404 ====================
router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route non trouvée',
        requestedPath: req.originalUrl,
        suggestion: 'Utilisez GET /api/payroll pour voir toutes les routes disponibles',
        commonRoutes: [
            '/dashboard',
            '/configure',
            '/config/:employeeId',
            '/employees',
            '/pay-months',
            '/calculate',
            '/mark-month-as-paid',
            '/payments/:month_year',
            '/reports',
            '/payslip/:employee_id/:month_year',
            '/payslip/send-email',
            '/history',
            '/stats/quick',
            '/my-payslips',
            '/my-latest-payslip',
            '/my-salary-config',
            '/my-payslips/:month_year/download/:format',
            '/my-payslips/:month_year/download-simple/:format',
            '/download-all',      // AJOUTÉ
            '/download-batch',    // AJOUTÉ
            '/pagination',        // AJOUTÉ
            '/test-connection',
            '/debug/me',
            '/debug/token'
        ]
    });
});

module.exports = router;