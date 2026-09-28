// backend/src/controllers/emailController.js
// ⚠️ VERSION SÉCURISÉE - Chiffrement AES-256-GCM
const db = require('../../config/db');
const { encrypt, decrypt } = require('../utils/crypto');
const nodemailer = require('nodemailer');

class EmailController {
  constructor() {
    console.log('📧 EmailController initialisé (chiffrement AES-256-GCM)');
    
    this.getAllAccounts = this.getAllAccounts.bind(this);
    this.getAccountById = this.getAccountById.bind(this);
    this.createAccount = this.createAccount.bind(this);
    this.updateAccount = this.updateAccount.bind(this);
    this.deleteAccount = this.deleteAccount.bind(this);
    this.testAccount = this.testAccount.bind(this);
    this.testAccountById = this.testAccountById.bind(this);
    this.getSettings = this.getSettings.bind(this);
    this.updateSettings = this.updateSettings.bind(this);
    this.toggleActive = this.toggleActive.bind(this);
    this.reloadEmailRotator = this.reloadEmailRotator.bind(this);
  }

  // ═══════════════════════════════════════════════════
  // LISTER TOUS LES COMPTES (jamais le mot de passe)
  // ═══════════════════════════════════════════════════
  async getAllAccounts(req, res) {
    try {
      console.log('📧 [EMAIL] getAllAccounts');
      const result = await db.query(`
        SELECT 
          id, name, email, smtp_host, smtp_port, smtp_secure,
          smtp_user, from_name, is_active, priority,
          last_used_at, emails_sent_today, last_reset_date,
          created_at, updated_at
        FROM email_accounts
        ORDER BY priority ASC, id ASC
      `);
      
      res.json({
        success: true,
        accounts: result.rows,
        count: result.rows.length,
      });
    } catch (err) {
      console.error('❌ getAllAccounts:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ═══════════════════════════════════════════════════
  // RÉCUPÉRER UN COMPTE
  // ═══════════════════════════════════════════════════
  async getAccountById(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(`
        SELECT 
          id, name, email, smtp_host, smtp_port, smtp_secure,
          smtp_user, from_name, is_active, priority,
          last_used_at, emails_sent_today, last_reset_date,
          created_at, updated_at
        FROM email_accounts WHERE id = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Compte introuvable' });
      }
      
      res.json({ success: true, account: result.rows[0] });
    } catch (err) {
      console.error('❌ getAccountById:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ═══════════════════════════════════════════════════
  // CRÉER UN COMPTE
  // ═══════════════════════════════════════════════════
  async createAccount(req, res) {
    try {
      const {
        name, email, smtp_host, smtp_port, smtp_secure,
        smtp_user, smtp_password, from_name, priority
      } = req.body;

      if (!email || !smtp_host || !smtp_user || !smtp_password) {
        return res.status(400).json({
          success: false,
          error: 'Champs requis : email, smtp_host, smtp_user, smtp_password'
        });
      }

      // 🔐 Chiffrer le mot de passe
      const encryptedPassword = encrypt(smtp_password);

      const result = await db.query(`
        INSERT INTO email_accounts 
        (name, email, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, from_name, priority)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, name, email, smtp_host, smtp_port, is_active, priority, created_at
      `, [
        name || `Compte ${email}`,
        email,
        smtp_host,
        smtp_port || 587,
        smtp_secure || false,
        smtp_user,
        encryptedPassword,
        from_name || 'Smart Attendance',
        priority || 0
      ]);

      console.log(`✅ [EMAIL] Compte créé: ${email} (password chiffré)`);

      await this.reloadEmailRotator();

      res.status(201).json({
        success: true,
        message: 'Compte email créé avec succès',
        account: result.rows[0],
      });
    } catch (err) {
      console.error('❌ createAccount:', err);
      if (err.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'Cet email existe déjà'
        });
      }
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ═══════════════════════════════════════════════════
  // METTRE À JOUR UN COMPTE
  // ═══════════════════════════════════════════════════
  async updateAccount(req, res) {
    try {
      const { id } = req.params;
      const {
        name, email, smtp_host, smtp_port, smtp_secure,
        smtp_user, smtp_password, from_name, priority, is_active
      } = req.body;

      const updates = [];
      const values = [];
      let idx = 1;

      if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
      if (email !== undefined) { updates.push(`email = $${idx++}`); values.push(email); }
      if (smtp_host !== undefined) { updates.push(`smtp_host = $${idx++}`); values.push(smtp_host); }
      if (smtp_port !== undefined) { updates.push(`smtp_port = $${idx++}`); values.push(smtp_port); }
      if (smtp_secure !== undefined) { updates.push(`smtp_secure = $${idx++}`); values.push(smtp_secure); }
      if (smtp_user !== undefined) { updates.push(`smtp_user = $${idx++}`); values.push(smtp_user); }
      if (smtp_password !== undefined && smtp_password !== '') {
        // 🔐 Chiffrer
        updates.push(`smtp_password = $${idx++}`);
        values.push(encrypt(smtp_password));
      }
      if (from_name !== undefined) { updates.push(`from_name = $${idx++}`); values.push(from_name); }
      if (priority !== undefined) { updates.push(`priority = $${idx++}`); values.push(priority); }
      if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(is_active); }

      if (updates.length === 0) {
        return res.status(400).json({ success: false, error: 'Aucune modification' });
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const result = await db.query(`
        UPDATE email_accounts
        SET ${updates.join(', ')}
        WHERE id = $${idx}
        RETURNING id, name, email, smtp_host, smtp_port, is_active, priority, updated_at
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Compte introuvable' });
      }

      console.log(`✅ [EMAIL] Compte ${id} mis à jour`);

      await this.reloadEmailRotator();

      res.json({
        success: true,
        message: 'Compte mis à jour',
        account: result.rows[0],
      });
    } catch (err) {
      console.error('❌ updateAccount:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ═══════════════════════════════════════════════════
  // SUPPRIMER UN COMPTE
  // ═══════════════════════════════════════════════════
  async deleteAccount(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        'DELETE FROM email_accounts WHERE id = $1 RETURNING email',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Compte introuvable' });
      }

      console.log(`🗑️ [EMAIL] Compte supprimé: ${result.rows[0].email}`);
      await this.reloadEmailRotator();

      res.json({
        success: true,
        message: 'Compte supprimé',
        email: result.rows[0].email,
      });
    } catch (err) {
      console.error('❌ deleteAccount:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ═══════════════════════════════════════════════════
  // ACTIVER / DÉSACTIVER
  // ═══════════════════════════════════════════════════
  async toggleActive(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(`
        UPDATE email_accounts 
        SET is_active = NOT is_active, updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, is_active
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Compte introuvable' });
      }

      await this.reloadEmailRotator();

      res.json({
        success: true,
        message: `Compte ${result.rows[0].is_active ? 'activé' : 'désactivé'}`,
        account: result.rows[0],
      });
    } catch (err) {
      console.error('❌ toggleActive:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ═══════════════════════════════════════════════════
  // TESTER UN COMPTE (données brutes, avant sauvegarde)
  // ═══════════════════════════════════════════════════
  async testAccount(req, res) {
    try {
      const { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password } = req.body;

      if (!smtp_host || !smtp_user || !smtp_password) {
        return res.status(400).json({
          success: false,
          error: 'smtp_host, smtp_user et smtp_password requis'
        });
      }

      console.log(`🔍 [EMAIL] Test SMTP: ${smtp_user}@${smtp_host}:${smtp_port}`);

      const transporter = nodemailer.createTransport({
        host: smtp_host,
        port: parseInt(smtp_port) || 587,
        secure: smtp_secure === true,
        auth: {
          user: smtp_user,
          pass: smtp_password,
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
      });

      const start = Date.now();
      await transporter.verify();
      const duration = Date.now() - start;

      console.log(`✅ [EMAIL] Test OK (${duration}ms)`);

      res.json({
        success: true,
        message: 'Connexion SMTP réussie',
        duration,
      });
    } catch (err) {
      console.error('❌ testAccount:', err.message);
      res.status(400).json({
        success: false,
        error: `Échec : ${err.message}`,
      });
    }
  }

  // ═══════════════════════════════════════════════════
  // TESTER UN COMPTE EXISTANT (par ID)
  // ═══════════════════════════════════════════════════
  async testAccountById(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(
        'SELECT * FROM email_accounts WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Compte introuvable' });
      }

      const account = result.rows[0];
      // 🔐 Déchiffrer
      const password = decrypt(account.smtp_password);

      const transporter = nodemailer.createTransport({
        host: account.smtp_host,
        port: account.smtp_port,
        secure: account.smtp_secure,
        auth: {
          user: account.smtp_user,
          pass: password,
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
      });

      const start = Date.now();
      await transporter.verify();
      const duration = Date.now() - start;

      console.log(`✅ [EMAIL] Test compte #${id} (${account.email}): OK (${duration}ms)`);

      res.json({
        success: true,
        message: `Compte ${account.email} fonctionnel`,
        duration,
        email: account.email,
      });
    } catch (err) {
      console.error(`❌ testAccountById #${req.params.id}:`, err.message);
      res.status(400).json({
        success: false,
        error: `Échec : ${err.message}`,
      });
    }
  }

  // ═══════════════════════════════════════════════════
  // PARAMÈTRES GLOBAUX
  // ═══════════════════════════════════════════════════
  async getSettings(req, res) {
    try {
      const result = await db.query('SELECT * FROM email_settings WHERE id = 1');
      res.json({ success: true, settings: result.rows[0] || {} });
    } catch (err) {
      console.error('❌ getSettings:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async updateSettings(req, res) {
    try {
      const {
        daily_capacity_per_account,
        batch_size,
        batch_pause_seconds,
        rotation_enabled,
        notifications_enabled
      } = req.body;

      const result = await db.query(`
        UPDATE email_settings 
        SET daily_capacity_per_account = COALESCE($1, daily_capacity_per_account),
            batch_size = COALESCE($2, batch_size),
            batch_pause_seconds = COALESCE($3, batch_pause_seconds),
            rotation_enabled = COALESCE($4, rotation_enabled),
            notifications_enabled = COALESCE($5, notifications_enabled),
            updated_at = NOW()
        WHERE id = 1
        RETURNING *
      `, [
        daily_capacity_per_account,
        batch_size,
        batch_pause_seconds,
        rotation_enabled,
        notifications_enabled
      ]);

      await this.reloadEmailRotator();

      res.json({
        success: true,
        message: 'Paramètres mis à jour',
        settings: result.rows[0],
      });
    } catch (err) {
      console.error('❌ updateSettings:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ═══════════════════════════════════════════════════
  // RECHARGER LE ROTATEUR
  // ═══════════════════════════════════════════════════
  async reloadEmailRotator() {
    try {
      const { emailRotator } = require('../utils/emailRotator');
      if (emailRotator && typeof emailRotator.reloadFromDatabase === 'function') {
        await emailRotator.reloadFromDatabase();
        console.log('🔄 [EMAIL] Rotateur rechargé');
      }
    } catch (err) {
      console.warn('⚠️ [EMAIL] Impossible de recharger le rotateur:', err.message);
    }
  }
}

module.exports = new EmailController();