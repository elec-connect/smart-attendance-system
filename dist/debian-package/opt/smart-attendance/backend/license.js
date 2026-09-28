// ============================================
// SYSTÈME DE LICENCE - Backend
// Gère l'activation et la période d'essai
// ============================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config(); // ⭐ Charge les variables depuis .env

class LicenseManager {
  constructor() {
    this.licenseFile = path.join(__dirname, 'license.dat');
    this.trialFile = path.join(__dirname, '.trial');
    
    // ⭐ Lire la clé depuis .env, avec une valeur par défaut sécurisée
    this.secretKey = process.env.LICENSE_SECRET_KEY || 'SmartAttendance_Pro_2026_Haouala_Super_Secure_Key_789456123';
    this.trialDays = parseInt(process.env.LICENSE_TRIAL_DAYS) || 30;
    
    console.log(`🔐 Système de licence initialisé - Période d'essai: ${this.trialDays} jours`);
  }

  // ============================================
  // GÉNÉRER UNE CLÉ D'ACTIVATION (POUR VOUS)
  // ============================================
  generateLicenseKey(companyName, expiresInDays = 365) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + expiresInDays);
    
    const data = {
      company: companyName,
      expires: expirationDate.toISOString(),
      product: 'SmartAttendanceSystem',
      version: '2.0.0',
      created: new Date().toISOString()
    };
    
    // Créer la signature
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(JSON.stringify(data))
      .digest('hex');
    
    const licenseKey = Buffer.from(JSON.stringify({
      ...data,
      signature
    })).toString('base64');
    
    return licenseKey;
  }

  // ============================================
  // VALIDER LA LICENCE (BACKEND)
  // ============================================
  validateLicense() {
    try {
      // Vérifier si le fichier de licence existe
      if (!fs.existsSync(this.licenseFile)) {
        console.log('📋 Aucune licence trouvée, vérification période d\'essai...');
        return this.checkTrialPeriod();
      }

      // Lire et décoder la licence
      const licenseData = fs.readFileSync(this.licenseFile, 'utf8');
      const decoded = JSON.parse(Buffer.from(licenseData, 'base64').toString());
      
      // Vérifier la signature
      const { signature, ...data } = decoded;
      const expectedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(JSON.stringify(data))
        .digest('hex');
      
      if (signature !== expectedSignature) {
        console.log('❌ Signature de licence invalide');
        return { valid: false, reason: 'INVALID_SIGNATURE' };
      }

      // Vérifier l'expiration
      const expirationDate = new Date(data.expires);
      const now = new Date();

      if (now > expirationDate) {
        console.log('❌ Licence expirée');
        return { valid: false, reason: 'EXPIRED' };
      }

      const daysLeft = Math.floor((expirationDate - now) / (1000 * 60 * 60 * 24));
      console.log(`✅ Licence valide - ${data.company} - Expire dans ${daysLeft} jours`);
      
      return { 
        valid: true, 
        company: data.company,
        expires: expirationDate,
        daysLeft: daysLeft
      };

    } catch (error) {
      console.error('❌ Erreur lecture licence:', error.message);
      return { valid: false, reason: 'INVALID_LICENSE' };
    }
  }

  // ============================================
  // PÉRIODE D'ESSAI
  // ============================================
  checkTrialPeriod() {
    // Premier lancement : créer le fichier de trial
    if (!fs.existsSync(this.trialFile)) {
      const trialData = {
        firstRun: new Date().toISOString(),
        lastRun: new Date().toISOString()
      };
      fs.writeFileSync(this.trialFile, JSON.stringify(trialData));
      console.log(`📅 Début de la période d'essai - ${this.trialDays} jours`);
      
      return { 
        trial: true, 
        daysUsed: 0,
        daysLeft: this.trialDays,
        firstRun: new Date()
      };
    }

    // Lire les données de trial
    const trialData = JSON.parse(fs.readFileSync(this.trialFile, 'utf8'));
    const firstRun = new Date(trialData.firstRun);
    const now = new Date();
    
    // Calculer les jours écoulés
    const daysUsed = Math.floor((now - firstRun) / (1000 * 60 * 60 * 24));
    const daysLeft = this.trialDays - daysUsed;

    if (daysLeft <= 0) {
      console.log('❌ Période d\'essai expirée');
      return { 
        trial: false, 
        expired: true,
        message: 'Période d\'essai terminée'
      };
    }

    console.log(`⏳ Période d'essai - ${daysLeft} jours restants sur ${this.trialDays}`);
    
    return {
      trial: true,
      daysUsed,
      daysLeft,
      firstRun
    };
  }

  // ============================================
  // ACTIVER LA LICENCE
  // ============================================
  activateLicense(licenseKey) {
    try {
      // Vérifier le format
      const decoded = JSON.parse(Buffer.from(licenseKey, 'base64').toString());
      
      // Vérifier la signature
      const { signature, ...data } = decoded;
      const expectedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(JSON.stringify(data))
        .digest('hex');
      
      if (signature !== expectedSignature) {
        return { success: false, message: 'Clé de licence invalide' };
      }

      // Sauvegarder la licence
      fs.writeFileSync(this.licenseFile, licenseKey);
      
      // Supprimer le fichier de trial
      if (fs.existsSync(this.trialFile)) {
        fs.unlinkSync(this.trialFile);
      }

      console.log(`✅ Licence activée pour ${data.company} jusqu'au ${new Date(data.expires).toLocaleDateString()}`);
      
      return { 
        success: true, 
        message: 'Licence activée avec succès',
        expires: data.expires,
        company: data.company
      };

    } catch (error) {
      console.error('❌ Erreur activation:', error.message);
      return { success: false, message: 'Clé de licence invalide' };
    }
  }

  // ============================================
  // OBTENIR LE STATUT DE LA LICENCE
  // ============================================
  getStatus() {
    const validation = this.validateLicense();
    
    if (validation.valid) {
      return {
        status: 'active',
        type: validation.trial ? 'trial' : 'licensed',
        company: validation.company,
        expires: validation.expires,
        daysLeft: validation.daysLeft
      };
    } else if (validation.trial === false && validation.expired === true) {
      return {
        status: 'expired',
        type: 'trial',
        message: 'Période d\'essai expirée'
      };
    } else {
      return {
        status: 'invalid',
        message: 'Licence invalide'
      };
    }
  }
}

module.exports = new LicenseManager();