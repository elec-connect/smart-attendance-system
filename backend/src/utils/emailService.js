// utils/emailService.js - VERSION PRODUCTION
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.init();
  }

  async init() {
    try {
      console.log('[EMAIL] Initialisation du service email...');
      
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
      
      console.log('[EMAIL] ✅ Service initialisé');
      
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

  async sendEmail(to, subject, html) {
    try {
      if (!this.initialized) {
        throw new Error('Service email non initialisé');
      }

      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Smart Attendance'}" <${process.env.EMAIL_FROM}>`,
        to: to,
        subject: subject,
        html: html
      };

      const info = await this.transporter.sendMail(mailOptions);
      
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
      await fs.writeFile(logFile, JSON.stringify(logs, null, 2));
      
    } catch (error) {
      // Silencieux en production
      if (process.env.NODE_ENV === 'development') {
        console.warn('[EMAIL] Erreur journalisation:', error.message);
      }
    }
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
            <div style="background: #fff5f5; padding: 10px; border: 1px dashed #dc3545; border-radius: 4px; font-family: monospace;">
              ${password}
            </div>
          </div>
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p><strong>⚠️ IMPORTANT :</strong> Changez votre mot de passe après la première connexion.</p>
          </div>
          
          <div style="background: #e8f4fd; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <h3>Comment se connecter :</h3>
            <ol>
              <li>Accédez à : ${process.env.FRONTEND_URL}</li>
              <li>Utilisez votre email et le mot de passe ci-dessus</li>
              <li>Changez votre mot de passe dans "Mon compte → Sécurité"</li>
            </ol>
          </div>
        </div>
        
        <div style="text-align: center; color: #6c757d; font-size: 12px; padding: 20px;">
          <p>Smart Attendance System © ${new Date().getFullYear()}</p>
        </div>
      </body>
      </html>
    `;
    
    return this.sendEmail(email, 'Bienvenue - Smart Attendance System', html);
  }

  async sendPasswordResetEmail(email, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 30px;">
        <div style="background: #4CAF50; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Réinitialisation de mot de passe</h1>
        </div>
        
        <div style="padding: 30px; background: white;">
          <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          
          <p style="color: #666;">Ce lien expirera dans 1 heure.</p>
        </div>
      </div>
    `;
    
    return this.sendEmail(email, 'Réinitialisation de mot de passe', html);
  }
}

module.exports = new EmailService();