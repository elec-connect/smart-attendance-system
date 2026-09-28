// backend/src/controllers/settingsController.js 
const logger = require('../utils/logger');
const db = require('../../config/db');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { exec } = require('child_process');

class SettingsController {
  constructor() {
    console.log('⚙️  SettingsController initialisé');
    
    // Chemins des fichiers de configuration réseau
    this.ENV_PATH = path.join(__dirname, '..', '..', '.env');
    this.CONFIG_JSON_PATH = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'config.json');
    
    // Configuration par défaut avec paramètres par shift
    this.defaultSettings = {
      company: {
        name: '',
        address: '',
        contactEmail: '',
        phone: ''
      },
      features: {
        qrCodeCheckin: false,
        facialRecognition: true,
        geoLocation: false,
        multiShift: true,
        manualCheckin: true
      },
      attendance: {
        workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        overtimeEnabled: false,
        overtimeThreshold: 8,
        globalBreakDuration: 60
      },
      shifts: {
        shift1: {
          name: 'Shift Standard',
          start: '08:00',
          end: '17:00',
          lateThreshold: '08:14',
          halfDayThreshold: '12:00',
          breakDuration: 60,
          enabled: true,
          color: 'blue'
        },
        shift2: {
          name: 'Shift Matin',
          start: '06:00',
          end: '14:00',
          lateThreshold: '06:14',
          halfDayThreshold: '10:00',
          breakDuration: 45,
          enabled: true,
          color: 'green'
        },
        shift3: {
          name: 'Shift Après-midi',
          start: '14:00',
          end: '22:00',
          lateThreshold: '14:14',
          halfDayThreshold: '18:00',
          breakDuration: 45,
          enabled: true,
          color: 'orange'
        },
        shift4: {
          name: 'Shift Nuit',
          start: '22:00',
          end: '06:00',
          lateThreshold: '22:14',
          halfDayThreshold: '02:00',
          breakDuration: 30,
          enabled: true,
          color: 'purple'
        }
      },
      notifications: {
        emailReminders: true,
        pushNotifications: true,
        checkInReminderTime: '08:45',
        monthlyReport: true,
        weeklySummary: true
      }
    };
    
    // Bind des méthodes
    this.getSettings = this.getSettings.bind(this);
    this.updateSettings = this.updateSettings.bind(this);
    this.getShifts = this.getShifts.bind(this);
    this.updateShift = this.updateShift.bind(this);
    this.resetSettings = this.resetSettings.bind(this);
    
    // ⭐ Bind des nouvelles méthodes réseau
    this.getNetworkConfig = this.getNetworkConfig.bind(this);
    this.updateNetworkConfig = this.updateNetworkConfig.bind(this);
    this.testNetworkConfig = this.testNetworkConfig.bind(this);
    this.restartServiceManually = this.restartServiceManually.bind(this);
    
    // ⭐ Bind des méthodes utilitaires
    this.ensureSettingsTable = this.ensureSettingsTable.bind(this);
    this.isValidIP = this.isValidIP.bind(this);
    this.isValidPort = this.isValidPort.bind(this);
    this.restartService = this.restartService.bind(this);
  }

  // ============================================
  // TABLE SETTINGS
  // ============================================
  async ensureSettingsTable() {
    try {
      console.log('🔄 Vérification de la table settings...');
      
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'settings'
        );
      `);
      
      if (!tableCheck.rows[0].exists) {
        console.log('📝 Création de la table settings...');
        await db.query(`
          CREATE TABLE settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            config JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CONSTRAINT settings_single_row CHECK (id = 1)
          );
        `);
      }
      
      const result = await db.query('SELECT COUNT(*) as count FROM settings WHERE id = 1');
      const count = parseInt(result.rows[0].count);
      
      if (count === 0) {
        console.log('📝 Insertion des paramètres par défaut...');
        await db.query(`
          INSERT INTO settings (id, config) 
          VALUES (1, $1)
        `, [this.defaultSettings]);
        console.log('✅ Paramètres par défaut insérés');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erreur ensureSettingsTable:', error);
      return false;
    }
  }

  // ============================================
  // PARAMÈTRES GÉNÉRAUX
  // ============================================
  async getSettings(req, res) {
    try {
      console.log('\n🔧 [GET /api/settings] Requête reçue');
      
      await this.ensureSettingsTable();
      
      const result = await db.query(
        'SELECT config, updated_at FROM settings WHERE id = 1'
      );
      
      console.log('📦 RAW config from DB:', JSON.stringify(result.rows[0]?.config, null, 2));
      
      let settingsData;
      
      if (result.rows.length > 0 && result.rows[0].config) {
        const dbConfig = result.rows[0].config;
        
        settingsData = {
          company: { name: '', address: '', contactEmail: '', phone: '' },
          attendance: { workDays: ['monday','tuesday','wednesday','thursday','friday'], overtimeEnabled: false, overtimeThreshold: 8, globalBreakDuration: 60 },
          shifts: { ...this.defaultSettings.shifts },
          notifications: { emailReminders: true, pushNotifications: true, checkInReminderTime: '08:45', monthlyReport: true, weeklySummary: true },
          features: { qrCodeCheckin: false, facialRecognition: true, geoLocation: false, multiShift: true, manualCheckin: true },
          
          ...dbConfig,
          
          company: {
            ...this.defaultSettings.company,
            ...(dbConfig.company || {})
          },
          attendance: {
            ...this.defaultSettings.attendance,
            ...(dbConfig.attendance || {})
          },
          shifts: {
            ...this.defaultSettings.shifts,
            ...(dbConfig.shifts || {})
          },
          notifications: {
            ...this.defaultSettings.notifications,
            ...(dbConfig.notifications || {})
          },
          features: {
            ...this.defaultSettings.features,
            ...(dbConfig.features || {})
          }
        };
        
        console.log('✅ Company envoyée au frontend:', settingsData.company);
      } else {
        settingsData = this.defaultSettings;
        console.log('⚠️ Aucune config en base, utilisation des défauts');
      }
      
      res.json({
        success: true,
        data: settingsData,
        message: 'Paramètres chargés avec succès',
        meta: {
          lastUpdated: result.rows[0]?.updated_at || new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur getSettings:', error);
      res.status(500).json({
        success: false,
        message: error.message,
        data: this.defaultSettings
      });
    }
  }

  async updateSettings(req, res) {
    try {
      console.log('\n💾 [PUT /api/settings] Mise à jour');
      console.log('📦 Données reçues:', JSON.stringify(req.body, null, 2));
      console.log('📦 overtimeEnabled reçu:', req.body.attendance?.overtimeEnabled);
      
      await this.ensureSettingsTable();
      
      const currentResult = await db.query(
        'SELECT config FROM settings WHERE id = 1'
      );
      
      const currentConfig = currentResult.rows[0]?.config || {};
      
      const newConfig = {
        ...this.defaultSettings,
        ...currentConfig,
        ...req.body,
        shifts: req.body.shifts || currentConfig.shifts || this.defaultSettings.shifts,
        features: req.body.features || currentConfig.features || this.defaultSettings.features,
        attendance: { 
          ...this.defaultSettings.attendance, 
          ...(currentConfig.attendance || {}), 
          ...(req.body.attendance || {})
        },
        company: { 
          ...this.defaultSettings.company, 
          ...(currentConfig.company || {}), 
          ...(req.body.company || {}) 
        },
        notifications: { 
          ...this.defaultSettings.notifications, 
          ...(currentConfig.notifications || {}), 
          ...(req.body.notifications || {}) 
        }
      };
      
      console.log('✅ Nouvelle valeur overtimeEnabled:', newConfig.attendance.overtimeEnabled);
      
      await db.query(`
        INSERT INTO settings (id, config, updated_at)
        VALUES (1, $1::jsonb, NOW())
        ON CONFLICT (id) 
        DO UPDATE SET config = $1::jsonb, updated_at = NOW()
      `, [newConfig]);
      
      console.log('✅ Paramètres sauvegardés avec overtimeEnabled =', newConfig.attendance.overtimeEnabled);
      
      res.json({
        success: true,
        data: newConfig,
        message: 'Paramètres mis à jour avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur updateSettings:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // ============================================
  // SHIFTS
  // ============================================
  async getShifts(req, res) {
    try {
      const result = await db.query(
        'SELECT config->\'shifts\' as shifts FROM settings WHERE id = 1'
      );
      
      const shifts = result.rows[0]?.shifts || this.defaultSettings.shifts;
      
      res.json({
        success: true,
        data: shifts
      });
      
    } catch (error) {
      console.error('❌ Erreur getShifts:', error);
      res.status(500).json({
        success: false,
        message: error.message,
        data: this.defaultSettings.shifts
      });
    }
  }

  async updateShift(req, res) {
    try {
      const { shiftKey } = req.params;
      const shiftData = req.body;
      
      console.log(`✏️ Mise à jour du shift ${shiftKey}`);
      
      const currentResult = await db.query(
        'SELECT config FROM settings WHERE id = 1'
      );
      
      let currentConfig = currentResult.rows[0]?.config || this.defaultSettings;
      
      if (!currentConfig.shifts) {
        currentConfig.shifts = this.defaultSettings.shifts;
      }
      
      currentConfig.shifts[shiftKey] = {
        ...this.defaultSettings.shifts[shiftKey],
        ...currentConfig.shifts[shiftKey],
        ...shiftData
      };
      
      await db.query(`
        UPDATE settings 
        SET config = $1::jsonb, updated_at = NOW()
        WHERE id = 1
      `, [currentConfig]);
      
      res.json({
        success: true,
        data: currentConfig.shifts[shiftKey],
        message: `Shift ${shiftKey} mis à jour`
      });
      
    } catch (error) {
      console.error('❌ Erreur updateShift:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // ============================================
  // RESET
  // ============================================
  async resetSettings(req, res) {
    try {
      await db.query(`
        UPDATE settings 
        SET config = $1::jsonb, updated_at = NOW()
        WHERE id = 1
      `, [this.defaultSettings]);
      
      res.json({
        success: true,
        data: this.defaultSettings,
        message: 'Paramètres réinitialisés'
      });
      
    } catch (error) {
      console.error('❌ Erreur resetSettings:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // ============================================
  // ⭐ CONFIGURATION RÉSEAU
  // ============================================

  /**
   * Valide une adresse IP (IPv4) ou "localhost"
   */
  isValidIP(ip) {
    if (!ip || typeof ip !== 'string') return false;
    if (ip === 'localhost') return true;
    const regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return regex.test(ip);
  }

  /**
   * Valide un port (1-65535)
   */
  isValidPort(port) {
    const p = parseInt(port, 10);
    return !isNaN(p) && p >= 1 && p <= 65535;
  }

  /**
   * Détecte la meilleure IP locale (Wi-Fi > Ethernet > autres)
   */
  detectBestLocalIP() {
    const nets = os.networkInterfaces();
    const candidates = [];
    
    for (const [name, interfaces] of Object.entries(nets)) {
      for (const net of interfaces) {
        if (net.family === 'IPv4' && !net.internal) {
          let priority = 999;
          const lowerName = name.toLowerCase();
          
          if (lowerName.includes('wi-fi') || lowerName.includes('wlan') || lowerName.includes('wireless')) {
            priority = 1;
          } else if (lowerName.includes('ethernet') || lowerName.includes('eth')) {
            priority = 2;
          }
          
          candidates.push({ ip: net.address, interface: name, priority });
        }
      }
    }
    
    if (candidates.length === 0) return 'localhost';
    candidates.sort((a, b) => a.priority - b.priority);
    return candidates[0].ip;
  }

  /**
   * GET /api/settings/network
   * Retourne la configuration réseau actuelle
   */
  async getNetworkConfig(req, res) {
    try {
      console.log('\n🌐 [GET /api/settings/network] Requête reçue');
      
      let apiUrl = `http://localhost:5000/api`;
      let frontendUrl = `http://localhost:5173`;
      
      // Lire backend/.env
      if (fs.existsSync(this.ENV_PATH)) {
        const envContent = fs.readFileSync(this.ENV_PATH, 'utf8');
        const apiMatch = envContent.match(/^API_BASE_URL=(.+)$/m);
        const frontMatch = envContent.match(/^FRONTEND_URL=(.+)$/m);
        if (apiMatch) apiUrl = apiMatch[1].trim();
        if (frontMatch) frontendUrl = frontMatch[1].trim();
      }
      
      // Parser l'URL pour extraire host + port
      let host = 'localhost';
      let port = 5000;
      try {
        const url = new URL(apiUrl);
        host = url.hostname;
        port = parseInt(url.port, 10) || 5000;
      } catch (e) {
        console.warn('[SETTINGS] Impossible de parser API_BASE_URL:', apiUrl);
      }
      
      // Détecter IP locale actuelle (info utile pour l'UI)
      const localIP = this.detectBestLocalIP();
      
      res.json({
        success: true,
        config: {
          host,
          port,
          apiUrl,
          frontendUrl,
          localIP,          // ⭐ IP détectée automatiquement (info)
          envPath: this.ENV_PATH,
          configJsonPath: this.CONFIG_JSON_PATH,
          platform: process.platform,
        },
      });
      
    } catch (err) {
      console.error('❌ [SETTINGS] getNetworkConfig error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/settings/network
   * Body: { host, port, frontendUrl }
   * Met à jour backend/.env et frontend/public/config.json
   */
  async updateNetworkConfig(req, res) {
    try {
      console.log('\n🌐 [POST /api/settings/network] Mise à jour');
      console.log('📦 Body:', JSON.stringify(req.body, null, 2));
      
      const { host, port, frontendUrl } = req.body;
      
      // Validation
      if (!host || !this.isValidIP(host)) {
        return res.status(400).json({ success: false, error: 'IP invalide' });
      }
      if (!port || !this.isValidPort(port)) {
        return res.status(400).json({ success: false, error: 'Port invalide (1-65535)' });
      }
      
      const newApiUrl = `http://${host}:${port}/api`;
      const newFrontendUrl = frontendUrl || `http://${host}:5173`;
      
      // ---- Backup ----
      if (fs.existsSync(this.ENV_PATH)) {
        const backupPath = `${this.ENV_PATH}.bak.${Date.now()}`;
        try {
          fs.copyFileSync(this.ENV_PATH, backupPath);
          console.log(`[SETTINGS] Backup créé: ${backupPath}`);
        } catch (e) {
          console.warn('[SETTINGS] Backup échoué:', e.message);
        }
      }
      
      // ---- Mise à jour backend/.env ----
      let envContent = '';
      if (fs.existsSync(this.ENV_PATH)) {
        envContent = fs.readFileSync(this.ENV_PATH, 'utf8');
      }
      
      // Remplacer ou ajouter API_BASE_URL
      if (/^API_BASE_URL=/m.test(envContent)) {
        envContent = envContent.replace(/^API_BASE_URL=.*$/m, `API_BASE_URL=${newApiUrl}`);
      } else {
        envContent += `\nAPI_BASE_URL=${newApiUrl}`;
      }
      
      // Remplacer ou ajouter FRONTEND_URL
      if (/^FRONTEND_URL=/m.test(envContent)) {
        envContent = envContent.replace(/^FRONTEND_URL=.*$/m, `FRONTEND_URL=${newFrontendUrl}`);
      } else {
        envContent += `\nFRONTEND_URL=${newFrontendUrl}`;
      }
      
      // Remplacer ALLOWED_ORIGINS si présent
      if (/^ALLOWED_ORIGINS=/m.test(envContent)) {
        const origins = [
          `http://${host}:${port}`,
          `http://${host}:5173`,
          `http://localhost:5173`,
          `http://localhost:${port}`,
        ].join(',');
        envContent = envContent.replace(/^ALLOWED_ORIGINS=.*$/m, `ALLOWED_ORIGINS=${origins}`);
      }
      
      fs.writeFileSync(this.ENV_PATH, envContent, 'utf8');
      console.log(`[SETTINGS] backend/.env mis à jour: ${newApiUrl}`);
      
      // ---- Mise à jour frontend/public/config.json ----
      const configDir = path.dirname(this.CONFIG_JSON_PATH);
      if (fs.existsSync(configDir)) {
        let config = {};
        if (fs.existsSync(this.CONFIG_JSON_PATH)) {
          try {
            config = JSON.parse(fs.readFileSync(this.CONFIG_JSON_PATH, 'utf8'));
          } catch (e) {
            console.warn('[SETTINGS] config.json illisible, recréation');
          }
        }
        config.API_URL = newApiUrl;
        config.FRONTEND_URL = newFrontendUrl;
        config.LAST_UPDATE = new Date().toISOString();
        fs.writeFileSync(this.CONFIG_JSON_PATH, JSON.stringify(config, null, 2), 'utf8');
        console.log(`[SETTINGS] config.json mis à jour`);
      } else {
        console.warn(`[SETTINGS] Dossier config.json introuvable: ${configDir}`);
      }
      
      // ---- Redémarrer le service ----
      const restartResult = await this.restartService();
      
      res.json({
        success: true,
        message: 'Configuration mise à jour',
        config: {
          host,
          port,
          apiUrl: newApiUrl,
          frontendUrl: newFrontendUrl,
        },
        restart: restartResult,
        note: 'Redémarrez le navigateur pour appliquer les changements côté frontend.',
      });
      
    } catch (err) {
      console.error('❌ [SETTINGS] updateNetworkConfig error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/settings/network/test
   * Body: { host, port }
   * Teste la connexion vers l'IP/port fournie
   */
  async testNetworkConfig(req, res) {
    try {
      const { host, port } = req.body;
      
      if (!host || !this.isValidIP(host)) {
        return res.status(400).json({ success: false, error: 'IP invalide' });
      }
      if (!port || !this.isValidPort(port)) {
        return res.status(400).json({ success: false, error: 'Port invalide' });
      }
      
      const targetUrl = `http://${host}:${port}/api/health`;
      console.log(`[SETTINGS] Test de connexion vers ${targetUrl}`);
      
      const start = Date.now();
      
      const testResult = await new Promise((resolve) => {
        const httpReq = http.get(targetUrl, { timeout: 5000 }, (r) => {
          let data = '';
          r.on('data', chunk => data += chunk);
          r.on('end', () => {
            resolve({
              ok: r.statusCode >= 200 && r.statusCode < 400,
              status: r.statusCode,
              duration: Date.now() - start,
              response: data.substring(0, 200),
            });
          });
        });
        
        httpReq.on('error', (e) => {
          resolve({ ok: false, error: e.message, duration: Date.now() - start });
        });
        
        httpReq.on('timeout', () => {
          httpReq.destroy();
          resolve({ ok: false, error: 'Timeout (5s)', duration: Date.now() - start });
        });
      });
      
      res.json({ success: true, test: testResult });
      
    } catch (err) {
      console.error('❌ [SETTINGS] testNetworkConfig error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Redémarre le service SmartAttendance selon la plateforme
   */
  restartService() {
    return new Promise((resolve) => {
      const platform = process.platform;
      let cmd;
      
      if (platform === 'win32') {
        // Windows : via NSSM
        cmd = `net stop SmartAttendance && net start SmartAttendance`;
      } else if (platform === 'linux') {
        // Linux : via systemd
        cmd = `systemctl restart smart-attendance`;
      } else {
        return resolve({ ok: false, error: 'Plateforme non supportée' });
      }
      
      console.log(`[SETTINGS] Redémarrage du service: ${cmd}`);
      
      exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) {
          console.error('[SETTINGS] Restart failed:', err.message);
          resolve({
            ok: false,
            error: err.message,
            note: 'Redémarrage manuel requis',
          });
        } else {
          console.log('[SETTINGS] Service redémarré avec succès');
          resolve({ ok: true, output: stdout });
        }
      });
    });
  }

  /**
   * POST /api/settings/network/restart
   * Redémarre manuellement le service
   */
  async restartServiceManually(req, res) {
    try {
      const result = await this.restartService();
      res.json({ success: true, restart: result });
    } catch (err) {
      console.error('❌ [SETTINGS] restartServiceManually error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new SettingsController();