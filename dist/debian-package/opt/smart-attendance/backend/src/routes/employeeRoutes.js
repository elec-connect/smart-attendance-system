// backend/src/routes/employeeRoutes.js
const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const authMiddleware = require('../middleware/auth');
const validationMiddleware = require('../middleware/validation');
const logger = require('../utils/logger');

// ==================== DEBUG MIDDLEWARE ====================validateEmployee
// Middleware de debug pour voir ce qui est chargé
router.use((req, res, next) => {
  console.log('🔍 DEBUG employeeRoutes:');
  console.log('  - employeeController:', typeof employeeController);
  console.log('  - Méthodes disponibles:', Object.keys(employeeController));
  console.log('  - Routes chargées:', {
    'GET /': '✓',
    'GET /stats': '✓',
    'GET /:id': '✓',
    'POST /': '✓',
    'PUT /:id': '✓',
    'PATCH /:id/activate': '✓',
    'PATCH /:id/deactivate': '✓',
    'DELETE /:id': '✓',
    'DELETE /:id/force': '✓'
  });
  console.log('  - Request URL:', req.originalUrl);
  console.log('  - Request Method:', req.method);
  next();
});

// ==================== ROUTES ====================

// Routes pour les employés (toutes protégées)
router.get('/', 
  authMiddleware.authenticateToken, 
  (req, res, next) => {
    console.log('📞 Appel GET /api/employees reçu');
    console.log('👤 Utilisateur authentifié:', req.user?.email);
    console.log('📋 EmployeeController.getAllEmployees existe:', typeof employeeController.getAllEmployees);
    
    if (typeof employeeController.getAllEmployees !== 'function') {
      console.error('❌ ERREUR: employeeController.getAllEmployees n\'est pas une fonction');
      console.error('📌 employeeController:', employeeController);
      return res.status(500).json({
        success: false,
        message: 'Erreur configuration serveur - Contrôleur non initialisé',
        debug: {
          controllerType: typeof employeeController,
          availableMethods: Object.keys(employeeController),
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Appel avec gestion d'erreur explicite
    employeeController.getAllEmployees(req, res).catch(error => {
      console.error('❌ Erreur dans getAllEmployees:', error);
      logger.error('Erreur route GET /employees:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des employés',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    });
  }
);

router.get('/stats', 
  authMiddleware.authenticateToken, 
  (req, res, next) => {
    console.log('📞 Appel GET /api/employees/stats reçu');
    console.log('👤 Utilisateur authentifié:', req.user?.email);
    console.log('📋 EmployeeController.getEmployeeStats existe:', typeof employeeController.getEmployeeStats);
    
    if (typeof employeeController.getEmployeeStats !== 'function') {
      return res.status(500).json({
        success: false,
        message: 'Erreur configuration serveur - Méthode getEmployeeStats non disponible'
      });
    }
    
    employeeController.getEmployeeStats(req, res).catch(error => {
      console.error('❌ Erreur dans getEmployeeStats:', error);
      logger.error('Erreur route GET /employees/stats:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des statistiques',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    });
  }
);

router.get('/:id', 
  authMiddleware.authenticateToken, 
  (req, res, next) => {
    console.log('📞 Appel GET /api/employees/:id reçu - ID:', req.params.id);
    
    if (typeof employeeController.getEmployeeById !== 'function') {
      return res.status(500).json({
        success: false,
        message: 'Erreur configuration serveur - Méthode getEmployeeById non disponible'
      });
    }
    
    employeeController.getEmployeeById(req, res).catch(error => {
      console.error('❌ Erreur dans getEmployeeById:', error);
      logger.error('Erreur route GET /employees/:id:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération de l\'employé',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    });
  }
);

// Routes admin uniquement
router.post('/',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin', 'manager'),
  validationMiddleware.validateEmployee,
  validationMiddleware.handleValidationErrors,
  (req, res, next) => {
    console.log('📞 Appel POST /api/employees reçu');
    console.log('👤 Utilisateur:', req.user?.email, '- Rôle:', req.user?.role);
    
    if (typeof employeeController.createEmployee !== 'function') {
      return res.status(500).json({
        success: false,
        message: 'Erreur configuration serveur - Méthode createEmployee non disponible'
      });
    }
    
    employeeController.createEmployee(req, res).catch(error => {
      console.error('❌ Erreur dans createEmployee:', error);
      logger.error('Erreur route POST /employees:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la création de l\'employé',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    });
  }
);

router.put('/:id',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin', 'manager'),
  validationMiddleware.validateEmployee,
  validationMiddleware.handleValidationErrors,
  (req, res, next) => {
    console.log('📞 Appel PUT /api/employees/:id reçu - ID:', req.params.id);
    
    if (typeof employeeController.updateEmployee !== 'function') {
      return res.status(500).json({
        success: false,
        message: 'Erreur configuration serveur - Méthode updateEmployee non disponible'
      });
    }
    
    employeeController.updateEmployee(req, res).catch(error => {
      console.error('❌ Erreur dans updateEmployee:', error);
      logger.error('Erreur route PUT /employees/:id:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la mise à jour de l\'employé',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    });
  }
);

// ==================== NOUVELLES ROUTES POUR ACTIVATION/DÉSACTIVATION ====================

// Réactiver un employé (admin seulement)
router.patch('/:id/activate',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin'),
  (req, res, next) => {
    console.log('📞 Appel PATCH /api/employees/:id/activate reçu - ID:', req.params.id);
    
    if (typeof employeeController.activateEmployee !== 'function') {
      console.error('❌ ERREUR: employeeController.activateEmployee n\'est pas une fonction');
      return res.status(500).json({
        success: false,
        message: 'Erreur configuration serveur - Méthode activateEmployee non disponible'
      });
    }
    
    employeeController.activateEmployee(req, res).catch(error => {
      console.error('❌ Erreur dans activateEmployee:', error);
      logger.error('Erreur route PATCH /employees/:id/activate:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la réactivation de l\'employé',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    });
  }
);

// Désactiver un employé (admin seulement)
router.patch('/:id/deactivate',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin'),
  (req, res, next) => {
    console.log('📞 Appel PATCH /api/employees/:id/deactivate reçu - ID:', req.params.id);
    
    if (typeof employeeController.deactivateEmployee !== 'function') {
      console.error('❌ ERREUR: employeeController.deactivateEmployee n\'est pas une fonction');
      return res.status(500).json({
        success: false,
        message: 'Erreur configuration serveur - Méthode deactivateEmployee non disponible'
      });
    }
    
    employeeController.deactivateEmployee(req, res).catch(error => {
      console.error('❌ Erreur dans deactivateEmployee:', error);
      logger.error('Erreur route PATCH /employees/:id/deactivate:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la désactivation de l\'employé',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    });
  }
);

// Suppression soft (désactivation) - gardé pour compatibilité
router.delete('/:id',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin'),
  (req, res, next) => {
    console.log('📞 Appel DELETE /api/employees/:id reçu - ID:', req.params.id);
    
    if (typeof employeeController.deleteEmployee !== 'function') {
      return res.status(500).json({
        success: false,
        message: 'Erreur configuration serveur - Méthode deleteEmployee non disponible'
      });
    }
    
    employeeController.deleteEmployee(req, res).catch(error => {
      console.error('❌ Erreur dans deleteEmployee:', error);
      logger.error('Erreur route DELETE /employees/:id:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la suppression de l\'employé',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    });
  }
);

// Suppression définitive avec confirmation
router.delete('/:id/force',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin'),
  (req, res, next) => {
    console.log('📞 Appel DELETE /api/employees/:id/force reçu - ID:', req.params.id);
    
    if (typeof employeeController.forceDeleteEmployee !== 'function') {
      return res.status(500).json({
        success: false,
        message: 'Erreur configuration serveur - Méthode forceDeleteEmployee non disponible'
      });
    }
    
    employeeController.forceDeleteEmployee(req, res).catch(error => {
      console.error('❌ Erreur dans forceDeleteEmployee:', error);
      logger.error('Erreur route DELETE /employees/:id/force:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la suppression définitive',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    });
  }
);

// ==================== ROUTES DE DEBUG ====================

// Route pour vérifier l'état du contrôleur (debug seulement)
router.get('/debug/controller-status', (req, res) => {
  const status = {
    controllerLoaded: !!employeeController,
    controllerType: typeof employeeController,
    availableMethods: Object.keys(employeeController),
    methodsDetails: {},
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV
  };

  // Vérifier chaque méthode
  const methods = [
    'getAllEmployees',
    'getEmployeeById', 
    'getEmployeeStats',
    'createEmployee',
    'updateEmployee',
    'deleteEmployee',
    'activateEmployee',
    'deactivateEmployee',
    'forceDeleteEmployee'
  ];

  methods.forEach(method => {
    status.methodsDetails[method] = {
      exists: typeof employeeController[method] === 'function',
      type: typeof employeeController[method]
    };
  });

  res.json({
    success: true,
    message: 'État du contrôleur employés',
    data: status
  });
});

module.exports = router;