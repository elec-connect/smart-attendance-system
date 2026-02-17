// backend/src/controllers/settingsController.js - VERSION COMPLÈTE CORRIGÉE
const logger = require('../utils/logger');
const db = require('../../config/db');

class SettingsController {
  constructor() {
    console.log('⚙️  SettingsController initialisé');
    // ⭐ CORRECTION: Initialiser defaultSettings ici
    this.defaultSettings = {
      shifts: {
        shift1: { name: "Shift Standard", start: "08:00", end: "17:00" },
        shift2: { name: "Shift Matin", start: "06:00", end: "14:00" },
        shift3: { name: "Shift Après-midi", start: "14:00", end: "22:00" },
        shift4: { name: "Shift Nuit", start: "22:00", end: "06:00" }
      },
      company: { name: "", address: "", contactEmail: "", phone: "" },
      features: {
        qrCodeCheckin: false,
        facialRecognition: true,
        geoLocation: false,
        multiShift: true,
        manualCheckin: true
      },
      attendance: {
        workStartTime: "08:00",
        workEndTime: "17:00",
        lateThreshold: "08:15",
        halfDayThreshold: "12:00",
        workDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
        breakDuration: 60,
        overtimeEnabled: false,
        overtimeThreshold: 8
      },
      notifications: {
        emailReminders: true,
        pushNotifications: true,
        checkInReminderTime: "08:45",
        monthlyReport: true,
        weeklySummary: true
      }
    };
    
    // Bind des méthodes
    this.getSettings = this.getSettings.bind(this);
    this.updateSettings = this.updateSettings.bind(this);
  }

  // Vérifier et initialiser la base de données
  async initializeDefaultSettings() {
    try {
      console.log('🔄 Vérification/initialisation de la table settings...');
      
      // Créer la table si elle n'existe pas
      await db.query(`
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY DEFAULT 1,
          config JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✅ Table settings vérifiée/créée');
      
      // Vérifier si un enregistrement existe
      const result = await db.query('SELECT COUNT(*) as count FROM settings WHERE id = 1');
      const count = parseInt(result.rows[0].count);
      
      if (count === 0) {
        console.log('📝 Insertion des paramètres par défaut...');
        await db.query(`
          INSERT INTO settings (id, config) 
          VALUES (1, $1)
        `, [this.defaultSettings]);
        console.log('✅ Paramètres par défaut insérés');
      } else {
        console.log('✅ Paramètres existants trouvés dans la base');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation:', error);
      return false;
    }
  }

  // Récupérer les paramètres
  async getSettings(req, res) {
    try {
      console.log('\n🔧 [GET /api/settings] Requête reçue');
      
      // Initialiser si nécessaire
      await this.initializeDefaultSettings();
      
      // Récupérer les paramètres depuis la base
      const result = await db.query(
        'SELECT config, updated_at FROM settings WHERE id = 1'
      );
      
      let settingsData;
      let source;
      
      if (result.rows.length > 0) {
        settingsData = result.rows[0].config || this.defaultSettings;
        source = 'database';
        console.log('✅ Paramètres chargés depuis la base de données');
        console.log('📅 Dernière mise à jour:', result.rows[0].updated_at);
      } else {
        settingsData = this.defaultSettings;
        source = 'default';
        console.log('⚠️  Utilisation des paramètres par défaut');
      }
      
      // Log pour debug
      console.log('📊 Features actuelles:', JSON.stringify(settingsData.features, null, 2));
      
      res.json({
        success: true,
        data: settingsData,
        message: 'Paramètres chargés avec succès',
        meta: {
          source: source,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur dans getSettings:', error);
      
      // Fallback garanti
      res.json({
        success: true,
        data: this.defaultSettings,
        message: 'Erreur serveur, utilisation des paramètres par défaut',
        meta: {
          source: 'error_fallback',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // ⭐⭐ CORRECTION PRINCIPALE ICI - Méthode updateSettings corrigée ⭐⭐
  async updateSettings(req, res) {
    try {
      console.log('\n💾 [PUT /api/settings] Début de la mise à jour');
      console.log('📦 Données reçues depuis le frontend:', JSON.stringify(req.body, null, 2));
      
      // Vérifier que la table existe
      await this.initializeDefaultSettings();
      
      // CORRECTION: On utilise directement les données du frontend
      const newConfig = req.body;
      
      console.log('📊 Nouvelle configuration:', JSON.stringify(newConfig.features, null, 2));
      
      // 3. SAUVEGARDER DANS LA BASE DE DONNÉES - CORRECTION SIMPLIFIÉE
      console.log('\n💿 Étape 3: Sauvegarde dans la base de données...');
      
      const updateQuery = `
        INSERT INTO settings (id, config, updated_at)
        VALUES (1, $1::jsonb, NOW())
        ON CONFLICT (id) 
        DO UPDATE SET config = $1::jsonb, updated_at = NOW()
        RETURNING id, updated_at;
      `;
      
      console.log('📝 Exécution de la requête UPSERT...');
      const updateResult = await db.query(updateQuery, [newConfig]);
      
      console.log('✅ Configuration sauvegardée avec succès');
      console.log('📅 Nouvel horodatage:', updateResult.rows[0].updated_at);
      
      // 4. VÉRIFICATION FINALE
      console.log('\n🔍 Étape 4: Vérification de la sauvegarde...');
      const verifyResult = await db.query(
        'SELECT config->\'features\' as features, updated_at FROM settings WHERE id = 1'
      );
      
      if (verifyResult.rows.length > 0) {
        const savedFeatures = verifyResult.rows[0].features;
        console.log('✅ Features sauvegardées dans la base:');
        console.log(JSON.stringify(savedFeatures, null, 2));
        console.log('✅ Dernière mise à jour:', verifyResult.rows[0].updated_at);
      }
      
      // 5. RÉPONSE AU FRONTEND
      res.json({
        success: true,
        data: newConfig,
        message: 'Paramètres mis à jour avec succès',
        saved: true,
        meta: {
          updatedAt: new Date().toISOString(),
          rowsAffected: updateResult.rowCount || 1
        }
      });
      
      console.log('\n✅ Mise à jour terminée avec succès!\n');
      
    } catch (error) {
      console.error('\n❌ ERREUR CRITIQUE dans updateSettings:');
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
      console.error('Code erreur:', error.code);
      
      res.status(500).json({
        success: false,
        message: `Erreur lors de la mise à jour: ${error.message}`,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
}

// Exporter une instance
const settingsController = new SettingsController();

module.exports = settingsController;