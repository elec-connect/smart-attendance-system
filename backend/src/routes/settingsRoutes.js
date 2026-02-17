const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(authMiddleware.authenticateToken);

router.get('/', settingsController.getSettings);

// Routes admin uniquement
router.put(
  '/',
  authMiddleware.authorizeRoles('admin'),
  settingsController.updateSettings
);

module.exports = router;