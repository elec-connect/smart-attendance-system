// controllers/AuthController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../../config/db');
const logger = require('../utils/logger');
const emailService = require('../utils/emailService');

class AuthController {
  constructor() {
    console.log('🔐 AuthController initialisé avec PostgreSQL');
    this.ensureJwtSecret();
  }

  ensureJwtSecret() {
    if (!process.env.JWT_SECRET) {
      console.warn('⚠️  JWT_SECRET non défini dans .env, utilisation du fallback');
      process.env.JWT_SECRET = 'smart_attendance_system_2026_secure_fallback_key_for_development_only';
      process.env.JWT_EXPIRE = '24h';
    }
    console.log(`🔑 JWT_SECRET configuré: ${process.env.JWT_SECRET.substring(0, 10)}...`);
  }

  // ========== CONNEXION ==========
  async login(req, res) {
    console.log('\n🔐 ========== DÉBUT LOGIN API ==========');
    console.log(`⏱️  ${new Date().toISOString()}`);
    console.log(`📡 Request ID: ${req.requestId || 'N/A'}`);
    
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        console.log('❌ Données manquantes');
        return res.status(400).json({
          success: false,
          message: 'Email et mot de passe requis',
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`📧 Tentative de connexion: ${email}`);
      
      const JWT_SECRET = process.env.JWT_SECRET;
      const JWT_EXPIRE = process.env.JWT_EXPIRE || '24h';
      
      console.log(`🔑 Configuration JWT: ${JWT_SECRET.substring(0, 10)}..., Expire: ${JWT_EXPIRE}`);
      
      const query = `
        SELECT 
          id, employee_id, first_name, last_name, email, 
          department, position, role, status, password_hash,
          hire_date, phone, has_face_registered, 
          created_at, updated_at
        FROM employees 
        WHERE email = $1
        LIMIT 1
      `;
      
      const { rows } = await db.query(query, [email.trim().toLowerCase()]);
      
      if (rows.length === 0) {
        console.log('❌ Aucun employé trouvé avec cet email');
        return res.status(401).json({
          success: false,
          message: 'Email ou mot de passe incorrect',
          timestamp: new Date().toISOString()
        });
      }
      
      const employee = rows[0];
      console.log(`✅ Employé trouvé: ${employee.first_name} ${employee.last_name}`);
      
      if (employee.status !== 'active') {
        console.log(`❌ Compte non actif (statut: ${employee.status})`);
        return res.status(403).json({
          success: false,
          message: 'Votre compte n\'est pas actif',
          timestamp: new Date().toISOString()
        });
      }
      
      console.log('🔐 Vérification du mot de passe...');
      
      if (!employee.password_hash) {
        console.log('❌ Aucun mot de passe défini');
        return res.status(500).json({
          success: false,
          message: 'Erreur de configuration du compte',
          timestamp: new Date().toISOString()
        });
      }
      
      const isPasswordValid = await bcrypt.compare(password, employee.password_hash);
      
      if (!isPasswordValid) {
        console.log('❌ Mot de passe incorrect');
        return res.status(401).json({
          success: false,
          message: 'Email ou mot de passe incorrect',
          timestamp: new Date().toISOString()
        });
      }
      
      console.log('✅ Mot de passe correct !');
      
      const tokenPayload = {
        id: employee.id,
        employeeId: employee.employee_id,
        email: employee.email,
        firstName: employee.first_name,
        lastName: employee.last_name,
        department: employee.department,
        position: employee.position,
        role: employee.role || 'employee',
        hasFaceRegistered: employee.has_face_registered || false
      };
      
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRE });
      
      console.log('✅ Token JWT généré avec succès');
      
      const userResponse = {
        id: employee.id,
        employeeId: employee.employee_id,
        firstName: employee.first_name,
        lastName: employee.last_name,
        email: employee.email,
        department: employee.department,
        position: employee.position,
        role: employee.role || 'employee',
        hireDate: employee.hire_date,
        phone: employee.phone,
        hasFaceRegistered: employee.has_face_registered || false,
        status: employee.status
      };
      
      const response = {
        success: true,
        token,
        user: userResponse,
        message: 'Connexion réussie',
        expiresIn: JWT_EXPIRE,
        timestamp: new Date().toISOString()
      };
      
      console.log('✅ Login réussi, envoi de la réponse...');
      console.log('🔐 ========== FIN LOGIN SUCCÈS ==========\n');
      
      res.json(response);
      
    } catch (error) {
      console.error('💥 ERREUR dans login:', error.message);
      
      const errorResponse = {
        success: false,
        message: 'Erreur serveur lors de la connexion',
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      };
      
      res.status(500).json(errorResponse);
      console.log('🔐 ========== FIN LOGIN ERREUR ==========\n');
    }
  }

  // ========== MOT DE PASSE OUBLIÉ ==========
  async forgotPassword(req, res) {
    console.log('\n🔐 ========== FORGOT PASSWORD ==========');
    
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'L\'adresse email est requise',
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`📧 Demande de réinitialisation pour: ${email}`);
      
      // Vérifier si l'utilisateur existe
      const { rows } = await db.query(
        'SELECT id, email, first_name, last_name FROM employees WHERE email = $1',
        [email.toLowerCase()]
      );
      
      if (rows.length === 0) {
        console.log('❌ Email non trouvé dans la base de données');
        
        if (process.env.NODE_ENV === 'production') {
          return res.json({
            success: true,
            message: 'Si cet email existe, un lien de réinitialisation a été envoyé',
            timestamp: new Date().toISOString()
          });
        } else {
          return res.status(404).json({
            success: false,
            message: 'Aucun compte trouvé avec cet email',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      const user = rows[0];
      
      // Générer un token de réinitialisation
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 heure
      
      // Stocker le token dans la base de données
      await db.query(
        'UPDATE employees SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3',
        [resetToken, resetTokenExpiry, user.id]
      );
      
      console.log(`🔐 Token généré et stocké pour: ${user.email}`);
      console.log(`📤 Tentative d'envoi email à: ${user.email}`);
      
      try {
        await emailService.sendPasswordResetEmail(user.email, resetToken);
        console.log('✅ Email de réinitialisation envoyé avec succès');
        
        if (process.env.NODE_ENV === 'production') {
          return res.json({
            success: true,
            message: 'Si cet email existe, un lien de réinitialisation a été envoyé',
            timestamp: new Date().toISOString()
          });
        } else {
          return res.json({
            success: true,
            message: 'Email de réinitialisation envoyé',
            timestamp: new Date().toISOString(),
            debug: {
              emailSent: true,
              to: user.email,
              name: `${user.first_name} ${user.last_name}`,
              resetLink: `${process.env.FRONTEND_URL || 'https://localhost:5173'}/reset-password/${resetToken}`
            }
          });
        }
        
      } catch (emailError) {
        console.error('❌ Erreur envoi email:', emailError.message);
        
        if (process.env.NODE_ENV !== 'production') {
          return res.json({
            success: true,
            message: 'Email non envoyé (mode debug), voici le lien:',
            timestamp: new Date().toISOString(),
            debug: {
              emailError: emailError.message,
              resetLink: `${process.env.FRONTEND_URL || 'https://localhost:5173'}/reset-password/${resetToken}`,
              token: resetToken,
              expiry: resetTokenExpiry
            }
          });
        }
        
        return res.json({
          success: true,
          message: 'Si cet email existe, un lien de réinitialisation a été envoyé',
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('💥 ERREUR forgotPassword:', error.message);
      console.error('Stack:', error.stack);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la demande de réinitialisation',
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }

  // ========== VÉRIFIER TOKEN DE RÉINITIALISATION ==========
  async verifyResetToken(req, res) {
    console.log('\n🔐 ========== VERIFY RESET TOKEN ==========');
    
    try {
      const { token } = req.params;
      
      console.log(`🔍 Vérification token: ${token.substring(0, 20)}...`);
      
      const { rows } = await db.query(
        'SELECT id, email, reset_token_expiry FROM employees WHERE reset_token = $1',
        [token]
      );
      
      if (rows.length === 0) {
        console.log('❌ Token invalide');
        return res.status(400).json({
          success: false,
          message: 'Token invalide ou expiré',
          valid: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const user = rows[0];
      
      if (new Date() > user.reset_token_expiry) {
        console.log('❌ Token expiré');
        await db.query(
          'UPDATE employees SET reset_token = NULL, reset_token_expiry = NULL WHERE id = $1',
          [user.id]
        );
        
        return res.status(400).json({
          success: false,
          message: 'Token expiré',
          valid: false,
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`✅ Token valide pour: ${user.email}`);
      
      return res.json({
        success: true,
        message: 'Token valide',
        valid: true,
        email: user.email,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV !== 'production' && {
          debug: {
            token: token.substring(0, 20) + '...',
            email: user.email,
            valid: true
          }
        })
      });
      
    } catch (error) {
      console.error('💥 ERREUR verifyResetToken:', error.message);
      
      res.status(500).json({
        success: false,
        message: 'Erreur vérification token',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ========== RÉINITIALISER MOT DE PASSE ========== (CORRIGÉ)
  async resetPassword(req, res) {
    console.log('\n🔐 ========== RESET PASSWORD ==========');
    
    try {
      // CORRECTION IMPORTANTE : token vient du body, pas des params
      const { token, password } = req.body;
      
      console.log(`🔐 Réinitialisation demandée`);
      console.log(`   Token reçu: ${token ? token.substring(0, 20) + '...' : 'NON FOURNI'}`);
      console.log(`   Password reçu: ${password ? 'OUI (longueur: ' + password.length + ')' : 'NON'}`);
      
      // Validation
      if (!token || !password) {
        console.log('❌ Données manquantes');
        return res.status(400).json({
          success: false,
          message: 'Token et nouveau mot de passe requis',
          timestamp: new Date().toISOString()
        });
      }
      
      if (password.length < 8) {
        console.log('❌ Mot de passe trop court');
        return res.status(400).json({
          success: false,
          message: 'Le mot de passe doit contenir au moins 8 caractères',
          timestamp: new Date().toISOString()
        });
      }
      
      // Vérifier le token dans la base de données
      console.log(`🔍 Recherche du token dans la base...`);
      
      const { rows } = await db.query(
        'SELECT id, email, reset_token_expiry FROM employees WHERE reset_token = $1',
        [token]
      );
      
      if (rows.length === 0) {
        console.log('❌ Token non trouvé dans la base');
        return res.status(400).json({
          success: false,
          message: 'Token invalide ou expiré',
          timestamp: new Date().toISOString()
        });
      }
      
      const user = rows[0];
      
      // Vérifier l'expiration
      if (new Date() > user.reset_token_expiry) {
        console.log('❌ Token expiré');
        await db.query(
          'UPDATE employees SET reset_token = NULL, reset_token_expiry = NULL WHERE id = $1',
          [user.id]
        );
        
        return res.status(400).json({
          success: false,
          message: 'Token expiré',
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`✅ Token valide pour: ${user.email}`);
      
      // Hasher le nouveau mot de passe
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Mettre à jour le mot de passe et effacer le token
      await db.query(
        `UPDATE employees 
         SET password_hash = $1, 
             reset_token = NULL, 
             reset_token_expiry = NULL,
             updated_at = NOW()
         WHERE id = $2`,
        [hashedPassword, user.id]
      );
      
      console.log(`✅ Mot de passe réinitialisé pour: ${user.email}`);
      
      // Envoyer email de confirmation
      try {
        await emailService.sendEmail(
  user.email, 
  'Mot de passe modifié - Smart Attendance',
  '<p>Votre mot de passe a été modifié avec succès.</p>'
);
        console.log('✅ Email de confirmation envoyé');
      } catch (emailError) {
        console.warn('⚠️  Email de confirmation non envoyé:', emailError.message);
      }
      
      return res.json({
        success: true,
        message: 'Mot de passe réinitialisé avec succès',
        timestamp: new Date().toISOString(),
        debug: {
          email: user.email,
          passwordChanged: true
        }
      });
      
    } catch (error) {
      console.error('💥 ERREUR resetPassword:', error.message);
      console.error('Stack:', error.stack);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la réinitialisation',
        timestamp: new Date().toISOString(),
        debug: process.env.NODE_ENV !== 'production' ? { error: error.message } : undefined
      });
    }
  }

  // ========== VÉRIFICATION DU TOKEN ==========
  async verifyToken(req, res) {
    console.log('\n🔐 ========== VERIFY TOKEN ==========');
    
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Token invalide ou expiré',
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`✅ Token vérifié pour: ${req.user.email}`);
      
      const response = {
        success: true,
        user: req.user,
        valid: true,
        timestamp: new Date().toISOString()
      };
      
      console.log('✅ Verify token réussi');
      console.log('🔐 ========== VERIFY TOKEN SUCCÈS ==========\n');
      
      res.json(response);
      
    } catch (error) {
      console.error('💥 ERREUR verifyToken:', error.message);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification du token',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ========== CHANGEMENT DE MOT DE PASSE ==========
  async changePassword(req, res) {
    console.log('\n🔐 ========== CHANGE PASSWORD ==========');
    
    try {
      const { currentPassword, newPassword } = req.body;
      const { id, email } = req.user;
      
      console.log(`👤 Demande changement mot de passe pour: ${email}`);
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Les deux mots de passe sont requis',
          timestamp: new Date().toISOString()
        });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Le nouveau mot de passe doit contenir au moins 8 caractères',
          timestamp: new Date().toISOString()
        });
      }
      
      const { rows } = await db.query(
        'SELECT password_hash FROM employees WHERE id = $1',
        [id]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employé non trouvé',
          timestamp: new Date().toISOString()
        });
      }
      
      const currentHash = rows[0].password_hash;
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentHash);
      
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Mot de passe actuel incorrect',
          timestamp: new Date().toISOString()
        });
      }
      
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      
      const updateQuery = `
        UPDATE employees 
        SET password_hash = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, email, employee_id
      `;
      
      await db.query(updateQuery, [hashedNewPassword, id]);
      
      console.log('✅ Mot de passe mis à jour avec succès');
      
      try {
        await sendPasswordChangedEmail(email);
        console.log('✅ Email de confirmation envoyé');
      } catch (emailError) {
        console.warn('⚠️  Email de confirmation non envoyé:', emailError.message);
      }
      
      const response = {
        success: true,
        message: 'Mot de passe changé avec succès',
        changedAt: new Date().toISOString()
      };
      
      res.json(response);
      
    } catch (error) {
      console.error('💥 ERREUR changePassword:', error.message);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors du changement de mot de passe',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ========== PROFIL UTILISATEUR ==========
  async getProfile(req, res) {
    console.log('\n👤 ========== GET PROFILE ==========');
    
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          timestamp: new Date().toISOString()
        });
      }
      
      const { rows } = await db.query(
        `SELECT 
          id, employee_id, first_name, last_name, email,
          department, position, role, hire_date, phone,
          status, has_face_registered, created_at
        FROM employees WHERE id = $1`,
        [req.user.id]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé',
          timestamp: new Date().toISOString()
        });
      }
      
      const user = rows[0];
      
      const response = {
        success: true,
        user: {
          id: user.id,
          employeeId: user.employee_id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          department: user.department,
          position: user.position,
          role: user.role,
          hireDate: user.hire_date,
          phone: user.phone,
          hasFaceRegistered: user.has_face_registered,
          status: user.status,
          createdAt: user.created_at
        },
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Profil récupéré pour: ${user.email}`);
      
      res.json(response);
      
    } catch (error) {
      console.error('💥 ERREUR getProfile:', error.message);
      
      res.status(500).json({
        success: false,
        message: 'Erreur récupération profil',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ========== METTRE À JOUR PROFIL (CORRIGÉ) ==========
async updateProfile(req, res) {
  console.log('\n👤 ========== UPDATE PROFILE ==========');
  
  try {
    const { firstName, lastName, phone, position, department, email } = req.body;
    const { id, role } = req.user;
    
    console.log(`🔄 Mise à jour profil pour ID: ${id}, Rôle: ${role}`);
    console.log('📦 Données reçues:', { firstName, lastName, phone, position, department, email });
    
    // ✅ VÉRIFICATION CRITIQUE : Seul l'admin peut modifier certains champs
    const isAdmin = role === 'admin';
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    // Champs que tout le monde peut modifier
    if (firstName) {
      updates.push(`first_name = $${paramCount}`);
      values.push(firstName);
      paramCount++;
    }
    
    if (lastName) {
      updates.push(`last_name = $${paramCount}`);
      values.push(lastName);
      paramCount++;
    }
    
    if (phone) {
      updates.push(`phone = $${paramCount}`);
      values.push(phone);
      paramCount++;
    }
    
    // ✅ Champs réservés aux administrateurs
    if (position !== undefined) {
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Seuls les administrateurs peuvent modifier le poste',
          code: 'FORBIDDEN_POSITION_UPDATE',
          timestamp: new Date().toISOString()
        });
      }
      updates.push(`position = $${paramCount}`);
      values.push(position);
      paramCount++;
    }
    
    if (department !== undefined) {
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Seuls les administrateurs peuvent modifier le département',
          code: 'FORBIDDEN_DEPARTMENT_UPDATE',
          timestamp: new Date().toISOString()
        });
      }
      updates.push(`department = $${paramCount}`);
      values.push(department);
      paramCount++;
    }
    
    if (email !== undefined) {
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Seuls les administrateurs peuvent modifier l\'email',
          code: 'FORBIDDEN_EMAIL_UPDATE',
          timestamp: new Date().toISOString()
        });
      }
      updates.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour',
        timestamp: new Date().toISOString()
      });
    }
    
    updates.push('updated_at = NOW()');
    values.push(id);
    
    const query = `
      UPDATE employees 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, employee_id, first_name, last_name, email, phone, position, department, role
    `;
    
    console.log('📝 Requête SQL:', query);
    console.log('📊 Valeurs:', values);
    
    const { rows } = await db.query(query, values);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
        timestamp: new Date().toISOString()
      });
    }
    
    const updatedUser = rows[0];
    
    console.log(`✅ Profil mis à jour pour: ${updatedUser.email}`);
    
    const response = {
      success: true,
      message: 'Profil mis à jour avec succès',
      user: {
        id: updatedUser.id,
        employeeId: updatedUser.employee_id,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        position: updatedUser.position,
        department: updatedUser.department,
        role: updatedUser.role
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('💥 ERREUR updateProfile:', error.message);
    console.error('Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Erreur mise à jour profil',
      timestamp: new Date().toISOString()
    });
  }
}

  // ========== DÉCONNEXION ==========
  async logout(req, res) {
    console.log('\n🔐 ========== LOGOUT ==========');
    
    try {
      const { email } = req.user || {};
      
      if (email) {
        console.log(`👤 Déconnexion: ${email}`);
      }
      
      const response = {
        success: true,
        message: 'Déconnexion réussie',
        timestamp: new Date().toISOString()
      };
      
      res.json(response);
      
    } catch (error) {
      console.error('💥 ERREUR logout:', error.message);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la déconnexion',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ========== LISTE UTILISATEURS (ADMIN) ==========
  async getAllUsers(req, res) {
    console.log('\n👥 ========== GET ALL USERS ==========');
    
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Accès réservé aux administrateurs',
          timestamp: new Date().toISOString()
        });
      }
      
      const { rows } = await db.query(
        `SELECT 
          id, employee_id, first_name, last_name, email,
          department, position, role, status, hire_date,
          phone, has_face_registered, created_at
        FROM employees 
        ORDER BY created_at DESC
        LIMIT 100`
      );
      
      const users = rows.map(user => ({
        id: user.id,
        employeeId: user.employee_id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        department: user.department,
        position: user.position,
        role: user.role,
        status: user.status,
        hireDate: user.hire_date,
        phone: user.phone,
        hasFaceRegistered: user.has_face_registered,
        createdAt: user.created_at
      }));
      
      const response = {
        success: true,
        users,
        count: users.length,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ ${users.length} utilisateurs récupérés`);
      
      res.json(response);
      
    } catch (error) {
      console.error('💥 ERREUR getAllUsers:', error.message);
      
      res.status(500).json({
        success: false,
        message: 'Erreur récupération utilisateurs',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ========== METTRE À JOUR RÔLE (ADMIN) ==========
  async updateUserRole(req, res) {
    console.log('\n👑 ========== UPDATE USER ROLE ==========');
    
    try {
      const { id } = req.params;
      const { role } = req.body;
      
      if (!role || !['employee', 'manager', 'admin'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Rôle invalide',
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`🔄 Mise à jour rôle pour ID: ${id} -> ${role}`);
      
      const { rows } = await db.query(
        `UPDATE employees 
        SET role = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, employee_id, email, first_name, last_name, role`,
        [role, id]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé',
          timestamp: new Date().toISOString()
        });
      }
      
      const updatedUser = rows[0];
      
      console.log(`✅ Rôle mis à jour pour: ${updatedUser.email}`);
      
      const response = {
        success: true,
        message: 'Rôle mis à jour avec succès',
        user: {
          id: updatedUser.id,
          employeeId: updatedUser.employee_id,
          name: `${updatedUser.first_name} ${updatedUser.last_name}`,
          email: updatedUser.email,
          role: updatedUser.role
        },
        timestamp: new Date().toISOString()
      };
      
      res.json(response);
      
    } catch (error) {
      console.error('💥 ERREUR updateUserRole:', error.message);
      
      res.status(500).json({
        success: false,
        message: 'Erreur mise à jour rôle',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ========== ACTUALISER TOKEN ==========
  async refreshToken(req, res) {
    console.log('\n🔄 ========== REFRESH TOKEN ==========');
    
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token requis',
          timestamp: new Date().toISOString()
        });
      }
      
      console.log('🔐 Refresh token demandé');
      
      return res.json({
        success: true,
        message: 'Token rafraîchi (simulation)',
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV !== 'production' && {
          debug: {
            simulated: true
          }
        })
      });
      
    } catch (error) {
      console.error('💥 ERREUR refreshToken:', error.message);
      
      res.status(500).json({
        success: false,
        message: 'Erreur rafraîchissement token',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ========== STATISTIQUES AUTH ==========
  async getAuthStats(req, res) {
    console.log('\n📊 ========== AUTH STATS ==========');
    
    try {
      const [
        totalUsersResult,
        activeUsersResult,
        adminUsersResult
      ] = await Promise.all([
        db.query('SELECT COUNT(*) as count FROM employees'),
        db.query('SELECT COUNT(*) as count FROM employees WHERE status = $1', ['active']),
        db.query('SELECT COUNT(*) as count FROM employees WHERE role = $1', ['admin'])
      ]);
      
      const stats = {
        totalUsers: parseInt(totalUsersResult.rows[0].count),
        activeUsers: parseInt(activeUsersResult.rows[0].count),
        adminUsers: parseInt(adminUsersResult.rows[0].count),
        inactiveUsers: parseInt(totalUsersResult.rows[0].count) - parseInt(activeUsersResult.rows[0].count)
      };
      
      const response = {
        success: true,
        stats,
        timestamp: new Date().toISOString()
      };
      
      console.log(`📊 Statistiques: ${stats.totalUsers} utilisateurs`);
      
      res.json(response);
      
    } catch (error) {
      console.error('💥 ERREUR getAuthStats:', error.message);
      
      res.status(500).json({
        success: false,
        message: 'Erreur statistiques',
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = new AuthController();