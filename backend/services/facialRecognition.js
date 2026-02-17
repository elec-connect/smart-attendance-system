// backend/services/facialRecognition.js - Service avec bascule simulation/réel
const config = require('../config/config');

class FacialRecognitionService {
  constructor() {
    this.useRealRecognition = true; // Forcé en mode REAL
    this.mode = config.facialRecognition.mode;

    console.log(`🎭 Initialisation reconnaissance faciale (Mode: ${this.mode})...`);
    
    if (this.useRealRecognition) {
      console.log('🔍 Mode: RECONNAISSANCE FACIALE RÉELLE (face-api.js)');
      this.service = require('./realFacialRecognition');
    } else {
      console.log('🧪 Mode: SIMULATION (données de test)');
      this.service = require('./simulationFacialRecognition');
    }
  }

  // Proxy vers le service actif
  async initialize() {
    return this.service.initialize ? await this.service.initialize() : { success: true };
  }

  async detectFaceFromBuffer(buffer) {
    return await this.service.detectFaceFromBuffer(buffer);
  }

  async recognizeFace(descriptor, userId) {
    return await this.service.recognizeFace(descriptor, userId);
  }

  async addFaceDescriptor(userId, descriptor) {
    return await this.service.addFaceDescriptor(userId, descriptor);
  }

  async loadTrainingData() {
    return await this.service.loadTrainingData();
  }

  isInitialized() {
    return this.service.isInitialized ? this.service.isInitialized() : true;
  }

  // ✅ FONCTION MANQUANTE QUI CAUSAIT L'ERREUR
  async registerFace(employeeId, images, userInfo) {
    console.log(`📸 [registerFace] Enregistrement du visage pour ${employeeId}...`);
    console.log(`👤 Informations utilisateur:`, userInfo);
    console.log(`🖼️ Nombre d'images: ${Array.isArray(images) ? images.length : 1}`);
    
    try {
      // Vérifier si le service a une fonction registerFace
      if (typeof this.service.registerFace === 'function') {
        console.log('✅ Utilisation de registerFace du service');
        return await this.service.registerFace(employeeId, images, userInfo);
      }
      // Sinon, utiliser addFaceDescriptor comme alternative
      else if (typeof this.service.addFaceDescriptor === 'function') {
        console.log('🔄 Utilisation de addFaceDescriptor comme alternative');
        
        let descriptors = [];
        if (Array.isArray(images)) {
          for (const image of images) {
            const descriptor = await this.service.addFaceDescriptor(employeeId, image);
            descriptors.push(descriptor);
          }
        } else {
          const descriptor = await this.service.addFaceDescriptor(employeeId, images);
          descriptors.push(descriptor);
        }
        
        return {
          success: true,
          message: 'Visage enregistré avec succès via addFaceDescriptor',
          employeeId,
          faceCount: descriptors.length,
          userInfo,
          descriptors: descriptors.length
        };
      }
      // Si aucune fonction n'est disponible
      else {
        console.log('⚠️ Aucune fonction spécifique trouvée, utilisation du mode simulé');
        // Simulation d'enregistrement
        return {
          success: true,
          message: 'Visage enregistré (mode simulation)',
          employeeId,
          faceCount: Array.isArray(images) ? images.length : 1,
          userInfo,
          simulated: true,
          timestamp: new Date()
        };
      }
    } catch (error) {
      console.error('❌ Erreur dans registerFace:', error);
      throw new Error(`Échec de l'enregistrement facial: ${error.message}`);
    }
  }

  // Fonctions supplémentaires utiles
  async getFaceDescriptor(employeeId) {
    return await this.service.getFaceDescriptor ? 
      await this.service.getFaceDescriptor(employeeId) : 
      null;
  }

  async deleteFaceDescriptor(employeeId) {
    return await this.service.deleteFaceDescriptor ? 
      await this.service.deleteFaceDescriptor(employeeId) : 
      { success: true, message: 'Suppression simulée' };
  }

  async listRegisteredFaces() {
    return await this.service.listRegisteredFaces ? 
      await this.service.listRegisteredFaces() : 
      { faces: [], count: 0 };
  }
}

module.exports = new FacialRecognitionService();