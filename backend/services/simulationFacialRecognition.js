// services/facialRecognition.js - VERSION SIMPLE SANS TENSORFLOW
const db = require('../config/db');
const crypto = require('crypto');

class FacialRecognitionService {
  constructor() {
    this.faceEncodings = {};
    this.modelsLoaded = true;
    this.mode = 'simulation';
    
    console.log('🧠 Service de reconnaissance faciale initialisé (mode simulation)');
    
    this.loadFaceEncodings();
  }

  async loadFaceEncodings() {
    try {
      console.log('📦 Chargement des encodings depuis la base de données...');
      
      const { rows } = await db.query(`
        SELECT employee_id, encoding_data, simulated, registered_at, image_size, updated_at
        FROM facial_encodings
      `);
      
      let loadedCount = 0;
      this.faceEncodings = {};
      
      for (const row of rows) {
        try {
          let encoding;
          
          if (typeof row.encoding_data === 'string') {
            if (row.encoding_data.startsWith('[')) {
              encoding = JSON.parse(row.encoding_data);
            } else {
              try {
                encoding = JSON.parse(row.encoding_data);
              } catch {
                encoding = [];
              }
            }
          } else if (Array.isArray(row.encoding_data)) {
            encoding = row.encoding_data;
          } else if (row.encoding_data && typeof row.encoding_data === 'object') {
            encoding = row.encoding_data;
          }
          
          if (encoding && (Array.isArray(encoding) || typeof encoding === 'object')) {
            this.faceEncodings[row.employee_id] = {
              encoding: encoding,
              simulated: row.simulated || false,
              registered_at: row.registered_at || new Date().toISOString(),
              image_size: row.image_size || 0,
              updated_at: row.updated_at || new Date().toISOString()
            };
            loadedCount++;
          }
        } catch (error) {
          console.warn(`⚠️ Erreur parsing encoding pour ${row.employee_id}:`, error.message);
        }
      }
      
      console.log(`✅ ${loadedCount}/${rows.length} encodings faciaux chargés depuis la DB`);
      console.log(`   📊 Visages enregistrés: ${Object.keys(this.faceEncodings).length}`);
      
    } catch (error) {
      console.error("❌ Erreur chargement encodings:", error.message);
      this.faceEncodings = {};
    }
  }

  // Générer un hash stable pour une image
  getImageHash(imageBuffer) {
    return crypto.createHash('md5').update(imageBuffer).digest('hex');
  }

  async registerFace(employeeId, imageBuffer) {
    try {
      console.log(`📸 Enregistrement simulation pour ${employeeId}`);
      
      const employeeCheck = await db.query(
        'SELECT employee_id FROM employees WHERE employee_id = $1 AND is_active = true',
        [employeeId]
      );
      
      if (employeeCheck.rows.length === 0) {
        return {
          success: false,
          message: 'Employé non trouvé ou inactif'
        };
      }
      
      // Générer un encodage simulé basé sur le hash de l'image
      const imageHash = this.getImageHash(imageBuffer);
      const hashArray = Array.from(imageHash).map(char => parseInt(char, 16) / 16);
      
      // Limiter à 128 valeurs pour simuler un descripteur facial
      const simulatedEncoding = hashArray.slice(0, 128);
      
      try {
        const existing = await db.query(
          'SELECT employee_id FROM facial_encodings WHERE employee_id = $1',
          [employeeId]
        );
        
        if (existing.rows.length > 0) {
          await db.query(`
            UPDATE facial_encodings 
            SET encoding_data = $1, 
                image_size = $2,
                simulated = true,
                updated_at = CURRENT_TIMESTAMP
            WHERE employee_id = $3
          `, [JSON.stringify(simulatedEncoding), imageBuffer.length, employeeId]);
        } else {
          await db.query(`
            INSERT INTO facial_encodings 
            (employee_id, encoding_data, image_size, simulated, registered_at, updated_at) 
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [employeeId, JSON.stringify(simulatedEncoding), imageBuffer.length, true]);
        }
        
        await db.query(
          'UPDATE employees SET face_encoding_date = CURRENT_TIMESTAMP WHERE employee_id = $1',
          [employeeId]
        );
        
        this.faceEncodings[employeeId] = {
          encoding: simulatedEncoding,
          simulated: true,
          registered_at: new Date().toISOString(),
          image_size: imageBuffer.length,
          image_hash: imageHash
        };
        
        console.log(`✅ Visage simulé enregistré pour ${employeeId}`);
        
        return {
          success: true,
          message: 'Visage enregistré avec succès (simulation)',
          descriptorLength: simulatedEncoding.length,
          imageSize: imageBuffer.length,
          imageSaved: true,
          mode: this.mode
        };
        
      } catch (dbError) {
        console.error('❌ Erreur base de données:', dbError.message);
        return {
          success: false,
          message: 'Erreur lors de la sauvegarde: ' + dbError.message
        };
      }
      
    } catch (error) {
      console.error('❌ Erreur registerFace:', error.message);
      return {
        success: false,
        message: 'Erreur lors de l\'enregistrement: ' + error.message
      };
    }
  }

  async recognizeFace(imageBuffer) {
    try {
      console.log('🔍 Début reconnaissance faciale (simulation)');
      
      if (Object.keys(this.faceEncodings).length === 0) {
        console.log('📭 Aucun visage enregistré');
        return {
          success: true,
          recognized: false,
          message: 'Aucun visage enregistré dans la base de données'
        };
      }
      
      // Générer l'encodage de l'image reçue
      const imageHash = this.getImageHash(imageBuffer);
      const hashArray = Array.from(imageHash).map(char => parseInt(char, 16) / 16);
      const queryEncoding = hashArray.slice(0, 128);
      
      console.log(`📊 Visages disponibles: ${Object.keys(this.faceEncodings).join(', ')}`);
      console.log(`   Nombre d'encodings: ${Object.keys(this.faceEncodings).length}`);
      
      // Trouver la meilleure correspondance
      let bestMatch = null;
      let minDistance = Infinity;
      
      for (const [employeeId, data] of Object.entries(this.faceEncodings)) {
        if (!data.encoding || !Array.isArray(data.encoding)) {
          console.log(`   ${employeeId}: encoding invalide`);
          continue;
        }
        
        // Calculer la distance entre les encodages
        let distance = 0;
        const maxLength = Math.min(queryEncoding.length, data.encoding.length);
        
        for (let i = 0; i < maxLength; i++) {
          const diff = queryEncoding[i] - data.encoding[i];
          distance += diff * diff;
        }
        distance = Math.sqrt(distance / maxLength);
        
        // Calculer la confiance
        const confidence = Math.max(0, Math.min(100, Math.round(100 - distance * 100)));
        
        console.log(`   ${employeeId}: distance=${distance.toFixed(4)}, confidence=${confidence}%`);
        
        if (distance < minDistance) {
          minDistance = distance;
          bestMatch = {
            employeeId,
            distance,
            confidence,
            image_size: data.image_size || 0,
            registered_at: data.registered_at
          };
        }
      }
      
      // Seuil de reconnaissance (distance < 0.5 = 50% de confiance minimum)
      const RECOGNITION_THRESHOLD = 0.5;
      
      console.log(`📊 Meilleur match: ${bestMatch?.employeeId || 'aucun'}, distance=${minDistance.toFixed(4)}`);
      
      if (bestMatch && minDistance < RECOGNITION_THRESHOLD) {
        console.log(`✅ VISAGE RECONNU: ${bestMatch.employeeId} (${bestMatch.confidence}%)`);
        
        // Récupérer les infos de l'employé
        const employeeResult = await db.query(
          'SELECT first_name, last_name FROM employees WHERE employee_id = $1',
          [bestMatch.employeeId]
        );
        
        const employeeName = employeeResult.rows.length > 0 
          ? `${employeeResult.rows[0].first_name} ${employeeResult.rows[0].last_name}`
          : bestMatch.employeeId;
        
        return {
          success: true,
          recognized: true,
          match: {
            employeeId: bestMatch.employeeId,
            confidence: bestMatch.confidence,
            distance: bestMatch.distance,
            image_size: bestMatch.image_size,
            registered_at: bestMatch.registered_at,
            simulated: true
          },
          employeeName: employeeName,
          message: `Visage reconnu (simulation): ${employeeName}`
        };
      } else {
        console.log('❌ Visage non reconnu (distance trop élevée ou pas de match)');
        return {
          success: true,
          recognized: false,
          bestMatch: bestMatch,
          message: 'Visage non reconnu'
        };
      }
      
    } catch (error) {
      console.error('❌ Erreur recognizeFace:', error.message);
      return {
        success: false,
        recognized: false,
        message: 'Erreur lors de la reconnaissance: ' + error.message
      };
    }
  }

  async recognizeAndAttend(imageBuffer) {
    const result = await this.recognizeFace(imageBuffer);
    return {
      ...result,
      attendanceRecorded: result.recognized
    };
  }

  async checkRegistration(employeeId) {
    try {
      const faceData = this.faceEncodings[employeeId];
      
      if (faceData) {
        return {
          hasFaceRegistered: true,
          registrationDate: faceData.registered_at || new Date().toISOString(),
          descriptorLength: faceData.encoding ? faceData.encoding.length : 0,
          imageSize: faceData.image_size || 0,
          imageFileName: null
        };
      }
      
      try {
        const result = await db.query(
          'SELECT registered_at, image_size FROM facial_encodings WHERE employee_id = $1',
          [employeeId]
        );
        
        if (result.rows.length > 0) {
          return {
            hasFaceRegistered: true,
            registrationDate: result.rows[0].registered_at,
            descriptorLength: 128,
            imageSize: result.rows[0].image_size || 0,
            imageFileName: null
          };
        }
      } catch (dbError) {
        console.warn('Erreur vérification DB:', dbError.message);
      }
      
      return {
        hasFaceRegistered: false,
        registrationDate: null,
        descriptorLength: 0,
        imageSize: 0,
        imageFileName: null
      };
      
    } catch (error) {
      console.error('❌ Erreur checkRegistration:', error.message);
      return {
        hasFaceRegistered: false,
        registrationDate: null,
        descriptorLength: 0,
        imageSize: 0,
        imageFileName: null,
        error: error.message
      };
    }
  }

  async deleteRegistration(employeeId) {
    try {
      await db.query(
        'DELETE FROM facial_encodings WHERE employee_id = $1',
        [employeeId]
      );
      
      await db.query(
        'UPDATE employees SET face_encoding_date = NULL WHERE employee_id = $1',
        [employeeId]
      );
      
      delete this.faceEncodings[employeeId];
      
      return {
        success: true,
        message: `Enregistrement facial supprimé pour ${employeeId}`
      };
      
    } catch (error) {
      console.error('❌ Erreur deleteRegistration:', error.message);
      return {
        success: false,
        message: 'Erreur lors de la suppression'
      };
    }
  }

  getRegisteredFaces() {
    return Object.keys(this.faceEncodings).map(employeeId => {
      const data = this.faceEncodings[employeeId];
      return {
        employeeId,
        simulated: data.simulated || false,
        descriptorLength: data.encoding ? data.encoding.length : 0,
        imageSize: data.image_size || 0,
        registeredAt: data.registered_at
      };
    });
  }

  getStatistics() {
    return {
      modelsLoaded: this.modelsLoaded,
      mode: this.mode,
      registeredFaces: Object.keys(this.faceEncodings).length,
      similarityThreshold: 0.5,
      confidenceThreshold: 50,
      version: '1.0.0'
    };
  }
}

// Créer et exporter une instance
const facialRecognitionService = new FacialRecognitionService();
module.exports = facialRecognitionService;// JavaScript source code
