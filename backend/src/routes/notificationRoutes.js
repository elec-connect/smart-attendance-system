// backend/src/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(authMiddleware.authenticateToken);

// Récupérer les notifications de l'utilisateur
router.get('/', notificationController.getUserNotifications);

// Compter les notifications non lues
router.get('/unread-count', notificationController.getUnreadCount);

// Créer une notification (admin/manager)
router.post('/', 
    authMiddleware.authorizeRoles(['admin', 'manager']), 
    notificationController.createNotification
);

// Créer notification pour tous les employés (admin/manager)
router.post('/broadcast',
    authMiddleware.authorizeRoles(['admin', 'manager']),
    notificationController.createNotificationForAllEmployees
);

// Marquer une notification comme lue
router.put('/:id/read', notificationController.markAsRead);

// Marquer toutes comme lues
router.put('/read-all', notificationController.markAllAsRead);

// Supprimer une notification
router.delete('/:id', notificationController.deleteNotification);

// Nettoyer anciennes notifications (admin seulement)
router.delete('/cleanup',
    authMiddleware.authorizeRoles(['admin']),
    notificationController.cleanupOldNotifications
);

module.exports = router;