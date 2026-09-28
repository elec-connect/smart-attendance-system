// utils/emailService.js - VERSION PRODUCTION AVEC ROTATEUR ET LOTS PARALLÈLES
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const emailRotator = require('./emailRotator');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.useRotator = false;
    this.init();
  }

  async init() {
    try {
      console.log('[EMAIL] Initialisation du service email...');
      
      // Vérifier si on utilise le rotateur (plusieurs comptes)
      const hasMultipleAccounts = process.env.SMTP_HOST_2 || process.env.SMTP_HOST_3;
      
      if (hasMultipleAccounts) {
        console.log('[EMAIL] ✅ Mode ROTATEUR activé (plusieurs comptes)');
        this.useRotator = true;
        this.initialized = true;
        const stats = emailRotator.getStats();
        console.log(`📧 ${stats.accountsCount} comptes email chargés`);
        console.log(`📊 Capacité: ${stats.totalCapacity} emails/jour`);
        console.log(`📦 Lots de ${stats.batchSize} emails, pause ${stats.batchDelay/1000}s entre lots`);
        return;
      }
      
      // Mode standard (un seul compte)
      if (!this.validateConfig()) {
        console.warn('[EMAIL] Configuration incomplète - emails désactivés');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      await this.transporter.verify();
      this.initialized = true;
      
      console.log('[EMAIL] ✅ Service initialisé (mode standard)');
      
    } catch (error) {
      console.error('[EMAIL] ❌ Erreur initialisation:', error.message);
      this.initialized = false;
    }
  }

  validateConfig() {
    const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM'];
    
    for (const key of required) {
      if (!process.env[key] || process.env[key].trim() === '') {
        console.warn(`[EMAIL] Variable manquante: ${key}`);
        return false;
      }
    }
    
    return true;
  }

  // ⭐ Envoi simple (1 email) - compatible avec rotateur
  async sendEmail(to, subject, html, attachments = []) {
    try {
      if (!this.initialized) {
        throw new Error('Service email non initialisé');
      }

      let info;
      
      if (this.useRotator) {
        // Utiliser le rotateur
        const account = emailRotator.getNextAvailableAccount();
        info = await emailRotator.sendEmailWithAccount(account, to, subject, html, attachments);
      } else {
        // Mode standard
        const mailOptions = {
          from: `"${process.env.EMAIL_FROM_NAME || 'Smart Attendance'}" <${process.env.EMAIL_FROM}>`,
          to: to,
          subject: subject,
          html: html,
          attachments: attachments
        };
        info = await this.transporter.sendMail(mailOptions);
      }
      
      await this.logEmail(to, subject, true, info.messageId);
      
      return {
        success: true,
        messageId: info.messageId
      };
      
    } catch (error) {
      console.error(`[EMAIL] Erreur envoi à ${to}:`, error.message);
      
      await this.logEmail(to, subject, false, null, error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ⭐⭐ ENVOI PAR LOTS DE 100 EN PARALLÈLE (RECOMMANDÉ POUR MASSE)
  async sendBatchByLots(employees, subject, getHtmlFunction, onProgress = null) {
    if (!this.initialized) {
      throw new Error('Service email non initialisé');
    }
    
    if (!this.useRotator) {
      console.warn('[EMAIL] Mode rotateur non activé, bascule automatique');
      // Forcer l'utilisation du rotateur même avec un seul compte
      this.useRotator = true;
    }
    
    return await emailRotator.sendBatchByLots(employees, subject, getHtmlFunction, onProgress);
  }

  // ⭐ Envoi des fiches de paie en masse (alias)
  async sendPayrollEmails(employees, month, year, getHtmlFunction, onProgress = null) {
    const subject = `Fiche de paie ${month}/${year}`;
    return await this.sendBatchByLots(employees, subject, getHtmlFunction, onProgress);
  }

  async logEmail(to, subject, success, messageId = null, error = null) {
    try {
      const logDir = path.join(__dirname, '../logs');
      await fs.mkdir(logDir, { recursive: true });
      
      const logFile = path.join(logDir, 'email_logs.json');
      const logEntry = {
        timestamp: new Date().toISOString(),
        to: to,
        subject: subject,
        success: success,
        messageId: messageId,
        error: error
      };
      
      let logs = [];
      try {
        const data = await fs.readFile(logFile, 'utf8');
        logs = JSON.parse(data);
      } catch (e) {
        // Fichier n'existe pas
      }
      
      logs.push(logEntry);
      
      // Garder seulement les 10000 derniers logs
      if (logs.length > 10000) {
        logs = logs.slice(-10000);
      }
      
      await fs.writeFile(logFile, JSON.stringify(logs, null, 2));
      
    } catch (error) {
      // Silencieux en production
      if (process.env.NODE_ENV === 'development') {
        console.warn('[EMAIL] Erreur journalisation:', error.message);
      }
    }
  }

  // ⭐ Récupérer les statistiques des comptes email
  getEmailStats() {
    if (this.useRotator) {
      return emailRotator.getStats();
    }
    return {
      accounts: [{
        user: process.env.SMTP_USER,
        sent: 0,
        remaining: 500,
        limit: 500
      }],
      totalSent: 0,
      totalCapacity: 500,
      accountsCount: 1,
      batchSize: 100,
      batchDelay: 3000
    };
  }

  async sendWelcomeEmail(email, fullName, password) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenue - Smart Attendance</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: #667eea; color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0;">Bienvenue ${fullName} !</h1>
        </div>
        
        <div style="padding: 30px; background: white;">
          <h2>Vos identifiants de connexion</h2>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Email :</strong> ${email}</p>
            <p><strong>Mot de passe temporaire :</strong></p>
            <div style="background: #fff5f5; padding: 10px; border: 1px dashed #dc3545; border-radius: 4px; font-family: monospace; font-size: 16px;">
              ${password}
            </div>
          </div>
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p><strong>⚠️ IMPORTANT :</strong> Changez votre mot de passe après la première connexion.</p>
          </div>
          
          <div style="background: #e8f4fd; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <h3>Comment se connecter :</h3>
            <ol>
              <li>Accédez à : ${process.env.FRONTEND_URL || 'https://entreprise-1.smart-haouala.com'}</li>
              <li>Utilisez votre email et le mot de passe ci-dessus</li>
              <li>Changez votre mot de passe dans "Mon compte → Sécurité"</li>
            </ol>
          </div>
        </div>
        
        <div style="text-align: center; color: #6c757d; font-size: 12px; padding: 20px;">
          <p>Smart Attendance System © ${new Date().getFullYear()}</p>
          <p style="font-size: 10px;">Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
        </div>
      </body>
      </html>
    `;
    
    return this.sendEmail(email, 'Bienvenue - Smart Attendance System', html);
  }

  async sendPasswordResetEmail(email, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL || 'https://entreprise-1.smart-haouala.com'}/reset-password/${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Réinitialisation - Smart Attendance</title>
      </head>
      <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; background: #f5f5f5;">
        
        <!-- En-tête -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">🔐 Smart Attendance</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">Système de gestion des présences</p>
        </div>
        
        <!-- Corps -->
        <div style="padding: 40px 30px; background: white; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
          
          <p style="font-size: 16px; margin-bottom: 20px;">Bonjour,</p>
          
          <p style="margin-bottom: 25px;">Nous avons reçu une demande de réinitialisation de votre mot de passe pour votre compte Smart Attendance.</p>
          
          <!-- Bouton principal -->
          <div style="text-align: center; margin: 35px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
              🔄 Réinitialiser mon mot de passe
            </a>
          </div>
          
          <!-- Lien de secours -->
          <p style="color: #666; font-size: 13px; text-align: center; margin: 20px 0;">
            Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
            <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
          </p>
          
          <!-- Informations de sécurité -->
          <div style="background: #fff3cd; padding: 15px 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>🔒 Sécurité :</strong> Ce lien est valable <strong>1 heure</strong>. 
              Si vous n'êtes pas à l'origine de cette demande, veuillez contacter votre administrateur.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0 20px;">
          
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            📧 Cet email a été envoyé automatiquement, merci de ne pas y répondre.
          </p>
        </div>
        
        <!-- Pied de page -->
        <div style="text-align: center; color: #999; font-size: 11px; padding: 20px; margin-top: 20px;">
          <p style="margin: 0;">Smart Attendance System - Gestion des présences</p>
          <p style="margin: 5px 0;">
            📞 Support: <a href="tel:+21629328870" style="color: #667eea; text-decoration: none;">+216 29 328 870</a> | 
            ✉️ Email: <a href="mailto:support@smart-attendance.com" style="color: #667eea; text-decoration: none;">support@smart-attendance.com</a>
          </p>
          <p style="margin: 10px 0 0;">© ${new Date().getFullYear()} Smart Attendance System. Tous droits réservés.</p>
        </div>
      </body>
      </html>
    `;
    
    return this.sendEmail(email, '🔐 Réinitialisation de votre mot de passe', html);
}

  // ⭐ Envoyer une notification de fiche de paie
  async sendPayslipNotification(email, fullName, month, year) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Fiche de paie - Smart Attendance</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: #3498db; color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0;">Fiche de paie disponible</h1>
        </div>
        
        <div style="padding: 30px; background: white;">
          <p>Bonjour <strong>${fullName}</strong>,</p>
          
          <p>Votre fiche de paie pour la période <strong>${month}/${year}</strong> est disponible.</p>
          
          <div style="background: #e8f4fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p>📄 Connectez-vous à votre espace pour consulter et télécharger votre fiche de paie.</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://entreprise-1.smart-haouala.com'}/payroll" style="display: inline-block; padding: 12px 24px; background: #3498db; color: white; text-decoration: none; border-radius: 5px;">
              Accéder à mes fiches de paie
            </a>
          </div>
        </div>
        
        <div style="text-align: center; color: #6c757d; font-size: 12px; padding: 20px;">
          <p>Smart Attendance System © ${new Date().getFullYear()}</p>
        </div>
      </body>
      </html>
    `;
    
    return this.sendEmail(email, `Fiche de paie ${month}/${year}`, html);
  }
}

module.exports = new EmailService();