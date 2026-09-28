// backend/src/routes/settingsRoutes.js
const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/auth');

// ============================================
// Toutes les routes nécessitent une authentification
// ============================================
router.use(authMiddleware.authenticateToken);

// ============================================
// PARAMÈTRES GÉNÉRAUX
// ============================================

// Récupérer tous les paramètres (accessible à tous les utilisateurs authentifiés)
router.get('/', settingsController.getSettings);

// Mettre à jour les paramètres (admin uniquement)
router.put(
  '/',
  authMiddleware.authorizeRoles('admin'),
  settingsController.updateSettings
);

// Réinitialiser les paramètres (admin uniquement)
router.post(
  '/reset',
  authMiddleware.authorizeRoles('admin'),
  settingsController.resetSettings
);

// ============================================
// SHIFTS
// ============================================

// Récupérer les shifts (accessible à tous les utilisateurs authentifiés)
router.get('/shifts', settingsController.getShifts);

// Mettre à jour un shift spécifique (admin uniquement)
router.put(
  '/shifts/:shiftKey',
  authMiddleware.authorizeRoles('admin'),
  settingsController.updateShift
);

// ============================================
// ⭐ CONFIGURATION RÉSEAU (admin uniquement)
// ============================================

// Récupérer la configuration réseau actuelle
router.get(
  '/network',
  authMiddleware.authorizeRoles('admin'),
  settingsController.getNetworkConfig
);

// Mettre à jour la configuration réseau (IP, port, URL frontend)
router.post(
  '/network',
  authMiddleware.authorizeRoles('admin'),
  settingsController.updateNetworkConfig
);

// Tester la connexion vers une IP/port donnée
router.post(
  '/network/test',
  authMiddleware.authorizeRoles('admin'),
  settingsController.testNetworkConfig
);

// Redémarrer manuellement le service
router.post(
  '/network/restart',
  authMiddleware.authorizeRoles('admin'),
  settingsController.restartServiceManually
);

module.exports = router;