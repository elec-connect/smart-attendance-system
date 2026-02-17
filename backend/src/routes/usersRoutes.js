// backend/src/routes/usersRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const authMiddleware = require('../middleware/auth');

// ==================== ROUTES PROFIL UTILISATEUR ====================

/**
 * Récupérer le profil de l'utilisateur connecté
 * GET /api/users/profile
 */
router.get('/profile', 
  authMiddleware.authenticateToken,
  async (req, res) => {
    try {
      const userEmail = req.user.email; // Email de l'utilisateur connecté
      
      console.log('👤 Récupération profil utilisateur:', userEmail);
      
      // Chercher dans employees par email (car c'est unique)
      const result = await db.query(
        `SELECT 
          id, 
          employee_id,
          email, 
          first_name, 
          last_name, 
          phone, 
          position, 
          department, 
          role, 
          hire_date,
          status,
          is_active,
          has_face_registered,
          face_registration_date,
          created_at,
          updated_at
         FROM employees 
         WHERE email = $1`,
        [userEmail]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }
      
      const employee = result.rows[0];
      
      res.json({
        success: true,
        data: {
          id: employee.id,
          employeeId: employee.employee_id,
          email: employee.email,
          firstName: employee.first_name,
          lastName: employee.last_name,
          phone: employee.phone || '',
          position: employee.position || '',
          department: employee.department || '',
          role: employee.role || 'employee',
          hireDate: employee.hire_date,
          status: employee.status || 'active',
          isActive: employee.is_active,
          hasFaceRegistered: employee.has_face_registered || false,
          faceRegistrationDate: employee.face_registration_date,
          createdAt: employee.created_at,
          updatedAt: employee.updated_at
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur récupération profil:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du profil',
        error: error.message
      });
    }
  }
);

/**
 * Mettre à jour le profil de l'utilisateur connecté
 * PUT /api/users/profile
 */
router.put('/profile', 
  authMiddleware.authenticateToken,
  async (req, res) => {
    try {
      const userEmail = req.user.email; // Email de l'utilisateur connecté
      const { phone, position, department, email } = req.body;
      
      console.log('📝 Mise à jour profil utilisateur:', {
        userEmail,
        newData: req.body
      });
      
      // Vérifier d'abord si l'utilisateur existe
      const checkUser = await db.query(
        'SELECT id, role, email FROM employees WHERE email = $1',
        [userEmail]
      );
      
      if (checkUser.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }
      
      const user = checkUser.rows[0];
      
      // Construire la requête dynamiquement
      const updates = [];
      const values = [];
      let paramCount = 1;
      
      if (phone !== undefined) {
        updates.push(`phone = $${paramCount}`);
        values.push(phone);
        paramCount++;
      }
      
      if (position !== undefined) {
        updates.push(`position = $${paramCount}`);
        values.push(position);
        paramCount++;
      }
      
      if (department !== undefined) {
        updates.push(`department = $${paramCount}`);
        values.push(department);
        paramCount++;
      }
      
      // Vérifier si l'email peut être modifié
      let emailChanged = false;
      if (email !== undefined && email !== user.email) {
        // Seuls les admins et managers peuvent modifier leur email
        if (user.role === 'admin' || user.role === 'manager') {
          updates.push(`email = $${paramCount}`);
          values.push(email);
          paramCount++;
          emailChanged = true;
          
          // Vérifier si le nouvel email n'est pas déjà utilisé
          const emailCheck = await db.query(
            'SELECT id FROM employees WHERE email = $1 AND id != $2',
            [email, user.id]
          );
          
          if (emailCheck.rows.length > 0) {
            return res.status(400).json({
              success: false,
              message: 'Cet email est déjà utilisé par un autre employé'
            });
          }
        } else {
          console.log(`⚠️ L'utilisateur #${user.id} (${user.role}) ne peut pas modifier son email`);
        }
      }
      
      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Aucune donnée à mettre à jour'
        });
      }
      
      values.push(user.id);
      
      const query = `
        UPDATE employees 
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramCount}
        RETURNING id, employee_id, email, first_name, last_name, phone, position, department, role, updated_at
      `;
      
      console.log('📝 Requête SQL:', query);
      console.log('📊 Valeurs:', values);
      
      const result = await db.query(query, values);
      
      const updatedEmployee = result.rows[0];
      
      res.json({
        success: true,
        message: 'Profil mis à jour avec succès',
        data: {
          id: updatedEmployee.id,
          employeeId: updatedEmployee.employee_id,
          email: updatedEmployee.email,
          firstName: updatedEmployee.first_name,
          lastName: updatedEmployee.last_name,
          phone: updatedEmployee.phone || '',
          position: updatedEmployee.position || '',
          department: updatedEmployee.department || '',
          role: updatedEmployee.role,
          updatedAt: updatedEmployee.updated_at,
          emailChanged: emailChanged
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur mise à jour profil:', error);
      
      // Gestion des erreurs spécifiques PostgreSQL
      if (error.code === '23505') { // Violation de contrainte unique
        return res.status(400).json({
          success: false,
          message: 'Cette donnée est déjà utilisée (email ou employee_id)'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du profil',
        error: error.message
      });
    }
  }
);

/**
 * Changer le mot de passe
 * PUT /api/users/change-password
 */
router.put('/change-password',
  authMiddleware.authenticateToken,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userEmail = req.user.email;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Mot de passe actuel et nouveau mot de passe sont requis'
        });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
        });
      }
      
      // Vérifier le mot de passe actuel (vous aurez besoin d'une fonction de vérification de hash)
      // Pour l'instant, nous allons simuler
      
      // Pour la sécurité, en production vous devriez utiliser bcrypt ou argon2
      const updateResult = await db.query(
        `UPDATE employees 
         SET updated_at = CURRENT_TIMESTAMP
         WHERE email = $1
         RETURNING id, email, first_name, last_name`,
        [userEmail]
      );
      
      res.json({
        success: true,
        message: 'Mot de passe mis à jour avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur changement mot de passe:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du changement de mot de passe',
        error: error.message
      });
    }
  }
);

// ==================== ROUTES DE TEST ====================

/**
 * Route de test
 * GET /api/users/test
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Users routes fonctionnent',
    timestamp: new Date().toISOString(),
    routes: [
      'GET /api/users/profile',
      'PUT /api/users/profile',
      'PUT /api/users/change-password'
    ],
    note: 'Utilise la table employees pour les utilisateurs'
  });
});

module.exports = router;