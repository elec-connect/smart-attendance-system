// ============================================
// ROUTES D'ACTIVATION DE LICENCE
// ============================================

const express = require('express');
const router = express.Router();
const licenseManager = require('../../license');
const { authenticateToken } = require('../middleware/auth');

// ==================== ROUTES PUBLIQUES ====================

/**
 * @route   GET /api/license-status
 * @desc    Vérifier le statut de la licence
 * @access  Public
 */
router.get('/license-status', (req, res) => {
  try {
    const status = licenseManager.validateLicense();
    
    // Formatage de la réponse
    const response = {
      success: true,
      ...status
    };

    // Ajouter des messages explicatifs
    if (status.valid) {
      response.message = 'Licence valide';
      response.daysLeft = Math.ceil((new Date(status.expires) - new Date()) / (1000 * 60 * 60 * 24));
    } else if (status.trial) {
      if (status.expired) {
        response.message = 'Période d\'essai expirée';
      } else {
        response.message = `Période d'essai: ${status.daysLeft} jours restants`;
      }
    } else {
      response.message = 'Licence non valide ou expirée';
    }

    res.json(response);
  } catch (error) {
    console.error('❌ Erreur vérification licence:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification de la licence',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/activate
 * @desc    Activer la licence avec une clé
 * @access  Public
 */
router.post('/activate', (req, res) => {
  try {
    const { licenseKey } = req.body;
    
    if (!licenseKey) {
      return res.status(400).json({
        success: false,
        message: 'Clé de licence requise'
      });
    }

    console.log('🔑 Tentative d\'activation avec clé:', licenseKey.substring(0, 30) + '...');
    
    const result = licenseManager.activateLicense(licenseKey);
    
    if (result.success) {
      console.log('✅ Licence activée avec succès');
      
      // Récupérer les infos de la licence pour la réponse
      const status = licenseManager.validateLicense();
      
      res.json({
        success: true,
        message: result.message,
        expires: result.expires,
        daysLeft: status.valid ? Math.ceil((new Date(status.expires) - new Date()) / (1000 * 60 * 60 * 24)) : null
      });
    } else {
      console.warn('❌ Échec activation:', result.message);
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('❌ Erreur activation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'activation',
      error: error.message
    });
  }
});

// ==================== ROUTES PROTÉGÉES (ADMIN SEULEMENT) ====================

/**
 * @route   POST /api/admin/generate-license
 * @desc    Générer une nouvelle licence (admin seulement)
 * @access  Private (Admin only)
 */
router.post('/admin/generate-license', authenticateToken, (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux administrateurs'
      });
    }

    const { companyName, days = 365 } = req.body;
    
    if (!companyName) {
      return res.status(400).json({
        success: false,
        message: 'Nom de la société requis'
      });
    }

    const licenseKey = licenseManager.generateLicenseKey(companyName, days);
    
    // Calculer la date d'expiration
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + days);
    
    res.json({
      success: true,
      message: 'Licence générée avec succès',
      licenseKey,
      companyName,
      expiresIn: days,
      expirationDate: expirationDate.toISOString()
    });
  } catch (error) {
    console.error('❌ Erreur génération licence:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération de la licence',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/admin/license-info
 * @desc    Obtenir les informations détaillées de la licence (admin seulement)
 * @access  Private (Admin only)
 */
router.get('/admin/license-info', authenticateToken, (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux administrateurs'
      });
    }

    const status = licenseManager.validateLicense();
    const licenseFile = require('path').join(__dirname, '../../license.dat');
    const fs = require('fs');
    
    let licenseData = null;
    let rawLicense = null;
    
    if (fs.existsSync(licenseFile)) {
      rawLicense = fs.readFileSync(licenseFile, 'utf8');
      try {
        licenseData = JSON.parse(Buffer.from(rawLicense, 'base64').toString());
      } catch (e) {
        // Ignorer les erreurs de parsing
      }
    }
    
    const trialFile = require('path').join(__dirname, '../../.trial');
    let trialData = null;
    
    if (fs.existsSync(trialFile)) {
      try {
        trialData = JSON.parse(fs.readFileSync(trialFile, 'utf8'));
      } catch (e) {
        // Ignorer les erreurs
      }
    }
    
    res.json({
      success: true,
      license: {
        ...status,
        rawLicense: rawLicense ? rawLicense.substring(0, 50) + '...' : null,
        licenseData: licenseData ? {
          company: licenseData.company,
          expires: licenseData.expires,
          created: licenseData.created,
          product: licenseData.product,
          version: licenseData.version
        } : null,
        trialData,
        files: {
          licenseExists: fs.existsSync(licenseFile),
          trialExists: fs.existsSync(trialFile)
        }
      }
    });
  } catch (error) {
    console.error('❌ Erreur récupération info licence:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des informations',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/reset-trial
 * @desc    Réinitialiser la période d'essai (admin seulement)
 * @access  Private (Admin only)
 */
router.post('/admin/reset-trial', authenticateToken, (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux administrateurs'
      });
    }

    const fs = require('fs');
    const path = require('path');
    const trialFile = path.join(__dirname, '../../.trial');
    const licenseFile = path.join(__dirname, '../../license.dat');
    
    // Supprimer les fichiers de licence et d'essai
    if (fs.existsSync(trialFile)) {
      fs.unlinkSync(trialFile);
    }
    if (fs.existsSync(licenseFile)) {
      fs.unlinkSync(licenseFile);
    }
    
    console.log('🔄 Période d\'essai réinitialisée par admin:', req.user.email);
    
    res.json({
      success: true,
      message: 'Période d\'essai réinitialisée avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur réinitialisation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réinitialisation',
      error: error.message
    });
  }
});

module.exports = router;