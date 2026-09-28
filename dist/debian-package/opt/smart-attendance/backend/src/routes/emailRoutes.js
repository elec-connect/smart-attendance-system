// backend/src/routes/emailRoutes.js
const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware.authenticateToken);
router.use(authMiddleware.authorizeRoles('admin'));

// CRUD
router.get('/', emailController.getAllAccounts);
router.get('/settings', emailController.getSettings);
router.put('/settings', emailController.updateSettings);
router.get('/:id', emailController.getAccountById);
router.post('/', emailController.createAccount);
router.put('/:id', emailController.updateAccount);
router.delete('/:id', emailController.deleteAccount);
router.patch('/:id/toggle', emailController.toggleActive);

// Tests
router.post('/test', emailController.testAccount);
router.post('/:id/test', emailController.testAccountById);

module.exports = router;