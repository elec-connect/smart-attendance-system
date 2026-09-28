// authRoutes.js - VERSION SIMPLIFIÉE ET TESTÉE
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Vérifiez que le contrôleur a les méthodes nécessaires
console.log('🔍 authController chargé:', authController ? 'OUI' : 'NON');
console.log('🔍 authController.forgotPassword:', typeof authController.forgotPassword);
console.log('🔍 authController.resetPassword:', typeof authController.resetPassword);

// ============================================
// ROUTES SIMPLES (sans validation)
// ============================================

// POST /api/auth/login - Connexion utilisateur
router.post('/login', authController.login);

// POST /api/auth/forgot-password - Mot de passe oublié
router.post('/forgot-password', (req, res, next) => {
  if (typeof authController.forgotPassword === 'function') {
    return authController.forgotPassword(req, res, next);
  } else {
    console.error('❌ authController.forgotPassword n\'est pas une fonction');
    return res.status(501).json({
      success: false,
      message: 'Fonctionnalité non implémentée',
      debug: 'La méthode forgotPassword n\'existe pas dans authController'
    });
  }
});

// POST /api/auth/reset-password - Réinitialiser le mot de passe (CORRIGÉ)
router.post('/reset-password', (req, res, next) => {
  console.log('🔄 Route reset-password appelée (version corrigée)');
  console.log('Body reçu:', req.body);
  
  if (typeof authController.resetPassword === 'function') {
    return authController.resetPassword(req, res, next);
  } else {
    console.error('❌ authController.resetPassword n\'est pas une fonction');
    return res.status(501).json({
      success: false,
      message: 'Fonctionnalité non implémentée',
      debug: 'La méthode resetPassword n\'existe pas dans authController'
    });
  }
});

// GET /api/auth/verify-reset-token/:token - Vérifier la validité d'un token
router.get('/verify-reset-token/:token', (req, res, next) => {
  if (typeof authController.verifyResetToken === 'function') {
    return authController.verifyResetToken(req, res, next);
  } else {
    console.error('❌ authController.verifyResetToken n\'est pas une fonction');
    return res.status(501).json({
      success: false,
      message: 'Fonctionnalité non implémentée',
      debug: 'La méthode verifyResetToken n\'existe pas dans authController'
    });
  }
});

// ============================================
// ROUTES PROTÉGÉES
// ============================================

// PUT /api/auth/password - Changer le mot de passe
router.put('/password', authenticateToken, (req, res, next) => {
  if (typeof authController.changePassword === 'function') {
    return authController.changePassword(req, res, next);
  } else {
    return res.status(501).json({
      success: false,
      message: 'Fonctionnalité non implémentée'
    });
  }
});

// GET /api/auth/verify - Vérifier la validité du token
router.get('/verify', authenticateToken, (req, res, next) => {
  if (typeof authController.verifyToken === 'function') {
    return authController.verifyToken(req, res, next);
  } else {
    return res.status(501).json({
      success: false,
      message: 'Fonctionnalité non implémentée'
    });
  }
});

// GET /api/auth/profile - Obtenir le profil utilisateur
router.get('/profile', authenticateToken, (req, res, next) => {
  if (typeof authController.getProfile === 'function') {
    return authController.getProfile(req, res, next);
  } else {
    return res.status(501).json({
      success: false,
      message: 'Fonctionnalité non implémentée'
    });
  }
});

// PUT /api/auth/profile - Mettre à jour le profil utilisateur
router.put('/profile', authenticateToken, (req, res, next) => {
  if (typeof authController.updateProfile === 'function') {
    return authController.updateProfile(req, res, next);
  } else {
    return res.status(501).json({
      success: false,
      message: 'Fonctionnalité non implémentée'
    });
  }
});

// POST /api/auth/logout - Déconnexion
router.post('/logout', authenticateToken, (req, res, next) => {
  if (typeof authController.logout === 'function') {
    return authController.logout(req, res, next);
  } else {
    return res.status(501).json({
      success: false,
      message: 'Fonctionnalité non implémentée'
    });
  }
});

// ============================================
// ROUTES ADMIN
// ============================================

// GET /api/auth/users - Liste des utilisateurs (admin seulement)
router.get('/users', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res, next) => {
  if (typeof authController.getAllUsers === 'function') {
    return authController.getAllUsers(req, res, next);
  } else {
    return res.status(501).json({
      success: false,
      message: 'Fonctionnalité non implémentée'
    });
  }
});

// PUT /api/auth/users/:id/role - Modifier le rôle d'un utilisateur (admin seulement)
router.put('/users/:id/role', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res, next) => {
  if (typeof authController.updateUserRole === 'function') {
    return authController.updateUserRole(req, res, next);
  } else {
    return res.status(501).json({
      success: false,
      message: 'Fonctionnalité non implémentée'
    });
  }
});

// ============================================
// ROUTES DE TEST
// ============================================

// GET /api/auth/test - Route de test
router.get('/test', (req, res) => {
  const controllerMethods = {
    login: typeof authController.login,
    forgotPassword: typeof authController.forgotPassword,
    resetPassword: typeof authController.resetPassword,
    verifyResetToken: typeof authController.verifyResetToken,
    changePassword: typeof authController.changePassword,
    verifyToken: typeof authController.verifyToken,
    getProfile: typeof authController.getProfile,
    updateProfile: typeof authController.updateProfile,
    logout: typeof authController.logout,
    getAllUsers: typeof authController.getAllUsers,
    updateUserRole: typeof authController.updateUserRole
  };
  
  res.json({ 
    success: true, 
    message: 'Auth routes working',
    timestamp: new Date().toISOString(),
    controllerMethods,
    availableRoutes: [
      'POST /auth/login',
      'POST /auth/forgot-password',
      'POST /auth/reset-password (sans :token)',
      'GET  /auth/verify-reset-token/:token',
      'PUT  /auth/password (protégé)',
      'GET  /auth/verify (protégé)',
      'GET  /auth/profile (protégé)',
      'PUT  /auth/profile (protégé)',
      'POST /auth/logout (protégé)',
      'GET  /auth/users (admin)',
      'PUT  /auth/users/:id/role (admin)',
      'GET  /auth/test',
      'GET  /auth/ping'
    ],
    resetPasswordInfo: {
      method: 'POST',
      url: '/api/auth/reset-password',
      expectedBody: {
        token: 'string (token reçu par email)',
        password: 'string (minimum 8 caractères)'
      }
    }
  });
});

// GET /api/auth/ping - Test de connexion
router.get('/ping', (req, res) => {
  res.json({
    success: true,
    message: 'Auth API is alive',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// ROUTE 404
// ============================================

//router.use('*', (req, res) => {
  //res.status(404).json({
    //success: false,
    //message: `Route auth non trouvée: ${req.originalUrl}`,
    //availableRoutes: [
      //'/login',
      //'/forgot-password',
      //'/reset-password (sans :token)',
      //'/verify-reset-token/:token',
      //'/password',
      //'/verify',
      //'/profile',
      //'/logout',
      //'/users',
      //'/users/:id/role',
      //'/test',
      //'/ping'
    //]
  //});
//});

module.exports = router;