// services/realFacialRecognition.js - VERSION AVEC RÉPONSE FRONTEND AMÉLIORÉE
const faceapi = require('face-api.js');
const canvas = require('canvas');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');

// Configurer canvas pour face-api.js
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// Variables globales pour le cache
let MODELS_LOADED = false;
let MODEL_LOAD_TIME = 0;
let REGISTERED_FACES = [];
let FACE_CACHE = new Map();
let REGISTRATION_STATS = {
  totalRegistrations: 0,
  successfulRegistrations: 0,
  failedRegistrations: 0
};

// ==================== CONFIGURATION ULTRA OPTIMISÉE ====================

// Paramètres TinyFaceDetector OPTIMISÉS pour meilleure détection
const TINY_CONFIGS = [
  { inputSize: 224, scoreThreshold: 0.08 },
  { inputSize: 160, scoreThreshold: 0.05 },
  { inputSize: 320, scoreThreshold: 0.10 }
];

// Configuration SSD pour fallback
const SSD_CONFIG = {
  minConfidence: 0.15,
  maxResults: 1
};

// Configuration pour enregistrement
const SSD_REGISTRATION_CONFIG = {
  minConfidence: 0.3,
  maxResults: 1
};

// Seuils de reconnaissance
const RECOGNITION_THRESHOLD = 0.65;
const MIN_CONFIDENCE_THRESHOLD = 0.50;

// ==================== CHARGEMENT DES MODÈLES ====================

const loadModelsOnce = async () => {
  if (MODELS_LOADED) {
    console.log(`📦 Modèles déjà chargés (${MODEL_LOAD_TIME}ms)`);
    return true;
  }
  
  console.log('📦 Début chargement des modèles ULTRA OPTIMISÉS...');
  const startTime = Date.now();
  
  try {
    const MODEL_DIR = path.join(__dirname, '../models');
    
    if (!fs.existsSync(MODEL_DIR)) {
      console.error(`❌ Dossier modèles introuvable: ${MODEL_DIR}`);
      throw new Error(`Dossier modèles introuvable: ${MODEL_DIR}`);
    }
    
    console.log('   → Chargement TinyFaceDetector...');
    await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_DIR);
    
    console.log('   → Chargement faceLandmark68TinyNet...');
    await faceapi.nets.faceLandmark68TinyNet.loadFromDisk(MODEL_DIR);
    
    console.log('   → Chargement faceRecognitionNet...');
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR);
    
    console.log('   → Chargement ssdMobilenetv1...');
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR);
    
    console.log('   → Chargement faceLandmark68Net...');
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR);
    
    MODELS_LOADED = true;
    MODEL_LOAD_TIME = Date.now() - startTime;
    
    console.log(`✅ Modèles chargés en ${MODEL_LOAD_TIME}ms`);
    return true;
    
  } catch (error) {
    console.error('❌ Erreur chargement modèles:', error.message);
    MODELS_LOADED = false;
    throw error;
  }
};

// Charger les modèles au démarrage
loadModelsOnce().catch(err => {
  console.error('❌ Impossible de charger les modèles:', err.message);
});

// ==================== GESTION DES DESCRIPTEURS ====================

const saveDescriptorToDisk = async (employeeId, descriptor, quality = 'high') => {
  try {
    const descriptorsDir = path.join(__dirname, '../data/face_descriptors');
    
    if (!fs.existsSync(descriptorsDir)) {
      fs.mkdirSync(descriptorsDir, { recursive: true });
    }
    
    const filePath = path.join(descriptorsDir, `${employeeId}.json`);
    const data = {
      employeeId,
      descriptor: Array.from(descriptor),
      timestamp: Date.now(),
      version: '2.0',
      quality,
      source: 'optimized-registration'
    };
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`💾 Descripteur sauvegardé: ${employeeId} (qualité: ${quality})`);
    
    FACE_CACHE.set(employeeId, {
      descriptor,
      timestamp: Date.now(),
      quality,
      source: 'optimized'
    });
    
    REGISTRATION_STATS.successfulRegistrations++;
    
    return true;
  } catch (error) {
    console.error('❌ Erreur sauvegarde descripteur:', error);
    REGISTRATION_STATS.failedRegistrations++;
    return false;
  }
};

const loadAllDescriptors = async () => {
  try {
    const descriptorsDir = path.join(__dirname, '../data/face_descriptors');
    
    if (!fs.existsSync(descriptorsDir)) {
      console.log('📁 Aucun dossier descripteurs trouvé');
      return [];
    }
    
    const files = fs.readdirSync(descriptorsDir).filter(f => f.endsWith('.json'));
    console.log(`📁 Chargement de ${files.length} descripteurs...`);
    
    const loadedFaces = [];
    let loadedCount = 0;
    
    for (const file of files) {
      try {
        const filePath = path.join(descriptorsDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (data.employeeId && data.descriptor) {
          const descriptor = new Float32Array(data.descriptor);
          
          loadedFaces.push(new faceapi.LabeledFaceDescriptors(
            data.employeeId,
            [descriptor]
          ));
          
          FACE_CACHE.set(data.employeeId, {
            descriptor,
            timestamp: data.timestamp || Date.now(),
            quality: data.quality || 'standard',
            source: data.source || 'legacy'
          });
          
          loadedCount++;
          console.log(`   ✓ ${data.employeeId} (${data.quality || 'standard'})`);
        }
      } catch (fileError) {
        console.error(`   ❌ ${file}:`, fileError.message);
      }
    }
    
    REGISTERED_FACES = loadedFaces;
    REGISTRATION_STATS.totalRegistrations = loadedCount;
    console.log(`✅ ${loadedCount} descripteurs chargés en mémoire`);
    return loadedFaces;
    
  } catch (error) {
    console.error('❌ Erreur chargement descripteurs:', error);
    return [];
  }
};

loadAllDescriptors().catch(console.error);

const getRegisteredFaces = () => {
  if (REGISTERED_FACES.length === 0 && FACE_CACHE.size > 0) {
    REGISTERED_FACES = [];
    FACE_CACHE.forEach((value, key) => {
      REGISTERED_FACES.push(new faceapi.LabeledFaceDescriptors(key, [value.descriptor]));
    });
  }
  return REGISTERED_FACES;
};

// ==================== FONCTIONS UTILITAIRES ====================

const calculateConfidence = (distance) => {
  const confidence = Math.max(0, Math.min(100, (1 - distance) * 100));
  return {
    percentage: confidence,
    level: confidence >= 70 ? 'high' : confidence >= 50 ? 'medium' : 'low',
    isAcceptable: confidence >= MIN_CONFIDENCE_THRESHOLD * 100
  };
};

const evaluateDetectionQuality = (detection, imageSize) => {
  const box = detection.detection.box;
  const faceSize = Math.max(box.width, box.height);
  const imageArea = imageSize.width * imageSize.height;
  const faceArea = box.width * box.height;
  const coverage = (faceArea / imageArea) * 100;
  
  return {
    faceSize,
    coverage,
    isGoodSize: faceSize >= 100,
    isGoodCoverage: coverage >= 10 && coverage <= 50,
    score: Math.min(100, (faceSize / 200 * 50) + (Math.min(coverage, 30) / 30 * 50))
  };
};

// ==================== ENREGISTREMENT FACIAL ====================

/**
 * Fonction d'enregistrement facial avec multiples images
 */
exports.registerFace = async (employeeId, images, userInfo) => {
  const startTime = Date.now();
  console.log(`📸 [registerFace] Début enregistrement pour ${employeeId}...`);
  console.log(`📁 Nombre d'images reçues: ${Array.isArray(images) ? images.length : 1}`);
  
  try {
    // Vérifier que les modèles sont chargés
    if (!MODELS_LOADED) {
      console.log('🔄 Chargement des modèles pour enregistrement...');
      await loadModelsOnce();
    }
    
    // Charger les informations de l'employé depuis la base de données
    const employeeResult = await db.query(
      `SELECT id, first_name, last_name, department, position 
       FROM employees 
       WHERE employee_id = $1`,
      [employeeId]
    );
    
    if (employeeResult.rows.length === 0) {
      throw new Error(`Employé ${employeeId} non trouvé dans la base de données`);
    }
    
    const employee = employeeResult.rows[0];
    const employeeName = `${employee.first_name} ${employee.last_name}`;
    console.log(`👤 Employé trouvé: ${employeeName} (${employee.department})`);
    
    // Traiter les images (support single ou multiple)
    const imagesArray = Array.isArray(images) ? images : [images];
    let successfulRegistrations = 0;
    let descriptors = [];
    let qualities = [];
    
    console.log(`🔄 Traitement de ${imagesArray.length} image(s)...`);
    
    for (let i = 0; i < imagesArray.length; i++) {
      const imageBuffer = imagesArray[i];
      console.log(`   📷 Traitement image ${i + 1}/${imagesArray.length}...`);
      
      try {
        // Charger l'image
        const img = await canvas.loadImage(imageBuffer);
        const imageSize = { width: img.width, height: img.height };
        
        console.log(`   📐 Taille image: ${imageSize.width}x${imageSize.height}`);
        
        // Détection de visage avec SSD pour qualité maximale
        console.time(`   ⏱️  Détection image ${i + 1}`);
        const detections = await faceapi
          .detectAllFaces(img, new faceapi.SsdMobilenetv1Options(SSD_REGISTRATION_CONFIG))
          .withFaceLandmarks()
          .withFaceDescriptors();
        console.timeEnd(`   ⏱️  Détection image ${i + 1}`);
        
        if (!detections || detections.length === 0) {
          console.log(`   ⚠️  Aucun visage détecté dans l'image ${i + 1}`);
          continue;
        }
        
        // Prendre la détection la plus confidente
        let bestDetection = detections[0];
        if (detections.length > 1) {
          bestDetection = detections.reduce((best, current) => {
            return current.detection.score > best.detection.score ? current : best;
          });
        }
        
        // Évaluer la qualité
        const quality = evaluateDetectionQuality(bestDetection, imageSize);
        console.log(`   📊 Qualité détection: ${quality.score.toFixed(1)}/100`);
        
        // Sauvegarder le descripteur
        const qualityLevel = quality.score >= 70 ? 'high' : quality.score >= 50 ? 'medium' : 'low';
        const saved = await saveDescriptorToDisk(employeeId, bestDetection.descriptor, qualityLevel);
        
        if (saved) {
          successfulRegistrations++;
          descriptors.push(bestDetection.descriptor);
          qualities.push({
            index: i + 1,
            qualityScore: quality.score,
            qualityLevel: qualityLevel,
            faceSize: quality.faceSize,
            coverage: quality.coverage
          });
          
          console.log(`   ✅ Image ${i + 1} enregistrée (qualité: ${qualityLevel})`);
        } else {
          console.log(`   ❌ Échec sauvegarde image ${i + 1}`);
        }
        
      } catch (imageError) {
        console.error(`   ❌ Erreur traitement image ${i + 1}:`, imageError.message);
      }
    }
    
    // Vérifier si au moins une image a été enregistrée
    if (successfulRegistrations === 0) {
      throw new Error('Aucune image n\'a pu être enregistrée (aucun visage détecté)');
    }
    
    // Recharger les descripteurs pour inclure le nouvel enregistrement
    await loadAllDescriptors();
    
    // Mettre à jour l'employé dans la base de données
    try {
      await db.query(
        `UPDATE employees 
         SET has_face_registered = true, 
             face_registered_at = NOW(),
             updated_at = NOW()
         WHERE employee_id = $1`,
        [employeeId]
      );
      console.log(`✅ Base de données mise à jour pour ${employeeId}`);
    } catch (dbError) {
      console.warn(`⚠️ Impossible de mettre à jour la base de données:`, dbError.message);
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Enregistrement terminé en ${totalTime}ms`);
    console.log(`📊 Statistiques: ${successfulRegistrations}/${imagesArray.length} images enregistrées`);
    
    return {
      success: true,
      message: 'Enregistrement facial réussi',
      employeeId,
      employeeName,
      totalImages: imagesArray.length,
      successfulImages: successfulRegistrations,
      failedImages: imagesArray.length - successfulRegistrations,
      qualities,
      averageQualityScore: qualities.reduce((sum, q) => sum + q.qualityScore, 0) / qualities.length,
      bestQuality: Math.max(...qualities.map(q => q.qualityScore)),
      processingTime: totalTime,
      timestamp: new Date().toISOString(),
      frontend: {
        showSuccess: true,
        showQualityReport: true,
        suggestions: [
          '✅ Visage enregistré avec succès',
          'Vous pouvez maintenant utiliser la reconnaissance faciale',
          'Pour meilleurs résultats, prenez des photos sous différents angles'
        ]
      }
    };
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement facial:', error.message);
    
    return {
      success: false,
      message: `Échec de l'enregistrement: ${error.message}`,
      employeeId,
      totalImages: Array.isArray(images) ? images.length : 1,
      successfulImages: 0,
      error: error.message,
      timestamp: new Date().toISOString(),
      frontend: {
        showRetryButton: true,
        showErrorDetails: true,
        suggestions: [
          'Assurez-vous que votre visage est bien visible',
          'Éclairage suffisant',
          'Face à la caméra'
        ]
      }
    };
  }
};

/**
 * Fonction pour pointer le départ
 */
const recordCheckOut = async (employeeId) => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].slice(0, 8);
    
    // Trouver le pointage d'arrivée sans départ
    const result = await db.query(`
      SELECT a.id, a.check_in_time, e.first_name, e.last_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.employee_id
      WHERE a.employee_id = $1 
        AND a.record_date = $2
        AND a.check_out_time IS NULL
        AND a.check_in_time IS NOT NULL
      ORDER BY a.check_in_time DESC
      LIMIT 1
    `, [employeeId, today]);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        message: 'Aucun pointage d\'arrivée trouvé pour aujourd\'hui',
        canCheckOut: false
      };
    }
    
    const attendance = result.rows[0];
    const employeeName = `${attendance.first_name} ${attendance.last_name}`;
    
    // Calculer les heures travaillées
    let hoursWorked = 0;
    if (attendance.check_in_time) {
      const checkInStr = attendance.check_in_time;
      const checkOutStr = currentTime;
      
      const timeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const parts = timeStr.split(':').map(Number);
        return parts[0] * 60 + parts[1];
      };
      
      const checkInMinutes = timeToMinutes(checkInStr);
      const checkOutMinutes = timeToMinutes(checkOutStr);
      let totalMinutes = checkOutMinutes - checkInMinutes;
      if (totalMinutes < 0) totalMinutes += 24 * 60;
      hoursWorked = totalMinutes / 60;
    }
    
    // Mettre à jour avec départ
    const updateResult = await db.query(`
      UPDATE attendance 
      SET 
        check_out_time = $1,
        hours_worked = $2,
        status = 'checked_out',
        updated_at = NOW()
      WHERE id = $3
      RETURNING id, check_out_time, hours_worked
    `, [currentTime, hoursWorked.toFixed(2), attendance.id]);
    
    const updatedRecord = updateResult.rows[0];
    
    console.log(`✅ Départ enregistré pour ${employeeId} à ${currentTime.slice(0, 5)}`);
    
    return {
      success: true,
      message: `Départ pointé avec succès à ${currentTime.slice(0, 5)}`,
      attendanceId: updatedRecord.id,
      checkOutTime: updatedRecord.check_out_time,
      hoursWorked: updatedRecord.hours_worked,
      employeeName: employeeName,
      checkInTime: attendance.check_in_time?.slice(0, 5) || '--:--',
      totalHours: hoursWorked.toFixed(2),
      canCheckOut: false
    };
    
  } catch (error) {
    console.error('❌ Erreur enregistrement départ:', error);
    return {
      success: false,
      message: 'Erreur lors de l\'enregistrement du départ',
      canCheckOut: true
    };
  }
};

/**
 * Fonction pour enregistrer un pointage d'arrivée avec réponse enrichie
 */
const recordAttendance = async (employeeId, confidence, verificationMethod = 'face_recognition') => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].slice(0, 8);
    const currentTimeFormatted = currentTime.slice(0, 5);
    
    // Vérifier l'employé dans la base
    const employeeCheck = await db.query(
      'SELECT id, first_name, last_name, department, position FROM employees WHERE employee_id = $1 AND is_active = true',
      [employeeId]
    );
    
    if (employeeCheck.rows.length === 0) {
      return {
        success: false,
        message: 'Employé non trouvé ou inactif',
        userMessage: '❌ Employé non trouvé dans le système',
        canRetry: false
      };
    }
    
    const employee = employeeCheck.rows[0];
    const employeeName = `${employee.first_name} ${employee.last_name}`;
    
    // ========== VÉRIFICATION DOUBLE POINTAGE ==========
    const existingCheck = await db.query(
      `SELECT id, check_in_time, check_out_time, status 
       FROM attendance 
       WHERE employee_id = $1 
       AND record_date = $2`,
      [employeeId, today]
    );
    
    if (existingCheck.rows.length > 0) {
      const existing = existingCheck.rows[0];
      const checkInTime = existing.check_in_time?.slice(0, 8) || '--:--:--';
      const checkOutTime = existing.check_out_time?.slice(0, 8) || null;
      const checkInTimeFormatted = checkInTime.slice(0, 5);
      
      console.log(`🚨 [REAL] BLOCAGE DOUBLE POINTAGE: ${employeeId} déjà pointé à ${checkInTimeFormatted}`);
      
      // Calculer le temps écoulé depuis le pointage
      const checkInDateTime = new Date(`${today}T${checkInTime}`);
      const hoursSinceCheckIn = ((now - checkInDateTime) / (1000 * 60 * 60)).toFixed(1);
      const minutesSinceCheckIn = Math.floor(((now - checkInDateTime) / (1000 * 60)) % 60);
      
      // Message personnalisé selon la situation
      let userMessage, emoji, statusType;
      let showCheckOutButton = false;
      let showCheckInInfo = true;
      
      if (checkOutTime) {
        const checkOutTimeFormatted = checkOutTime.slice(0, 5);
        userMessage = `✅ ${employeeName}, vous avez déjà complété votre pointage aujourd'hui !`;
        emoji = '✅';
        statusType = 'completed';
        showCheckOutButton = false;
        showCheckInInfo = true;
      } else {
        userMessage = `🔄 ${employeeName}, vous êtes déjà pointé aujourd'hui à ${checkInTimeFormatted}`;
        emoji = '🔄';
        statusType = 'checked_in_only';
        showCheckOutButton = true;
        showCheckInInfo = true;
      }
      
      return {
        success: false,
        alreadyChecked: true,
        shouldNotRecord: true,
        message: userMessage,
        emoji: emoji,
        statusType: statusType,
        existingRecord: {
          id: existing.id,
          checkIn: checkInTime,
          checkOut: checkOutTime,
          checkInFormatted: checkInTimeFormatted,
          checkOutFormatted: checkOutTime ? checkOutTime.slice(0, 5) : null,
          date: today,
          status: existing.status,
          canCheckOut: checkOutTime === null,
          hoursSinceCheckIn: checkOutTime ? null : hoursSinceCheckIn,
          minutesSinceCheckIn: checkOutTime ? null : minutesSinceCheckIn,
          timeElapsedText: checkOutTime ? null : `Il y a ${hoursSinceCheckIn}h${minutesSinceCheckIn > 0 ? ` ${minutesSinceCheckIn}min` : ''}`
        },
        employee: {
          id: employee.id,
          employeeId: employeeId,
          name: employeeName,
          firstName: employee.first_name,
          lastName: employee.last_name,
          department: employee.department,
          position: employee.position
        },
        frontend: {
          showCheckOutButton: showCheckOutButton,
          showCheckInInfo: showCheckInInfo,
          showSuccessAnimation: false,
          showWarningAnimation: true,
          buttonText: checkOutTime ? 'Pointage Complet' : 'Pointer le Départ',
          buttonColor: checkOutTime ? 'success' : 'primary',
          icon: checkOutTime ? 'check_circle' : 'logout',
          suggestions: checkOutTime === null ? [
            "Souhaitez-vous pointer votre départ maintenant?",
            "Cliquez sur 'Pointer le départ' ci-dessous"
          ] : [
            "Votre pointage est complet pour aujourd'hui",
            "Merci et bonne journée !"
          ]
        },
        timestamp: now.toISOString(),
        currentTime: currentTimeFormatted
      };
    }
    
    // Déterminer le statut
    let status = 'present';
    const hour = now.getHours();
    const minute = now.getMinutes();
    if (hour > 9 || (hour === 9 && minute > 15)) {
      status = 'late';
    }
    
    const statusText = status === 'late' ? 'en retard' : 'à l\'heure';
    console.log(`🕐 [REAL] Pointage: ${status} à ${currentTimeFormatted}`);
    
    // Insérer le pointage
    const result = await db.query(`
      INSERT INTO attendance (
        employee_id,
        check_in_time,
        record_date,
        attendance_date,
        status,
        verification_method,
        face_verified,
        face_confidence,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING id, employee_id, check_in_time, record_date, status
    `, [
      employeeId,
      currentTime,
      today,
      today,
      status,
      verificationMethod,
      true,
      confidence
    ]);
    
    const attendanceRecord = result.rows[0];
    
    console.log('✅ [REAL] Pointage enregistré:', {
      id: attendanceRecord.id,
      employee_id: attendanceRecord.employee_id,
      check_in_time: attendanceRecord.check_in_time,
      status: attendanceRecord.status
    });
    
    return {
      success: true,
      alreadyChecked: false,
      attendanceId: attendanceRecord.id,
      checkInTime: attendanceRecord.check_in_time,
      checkInTimeFormatted: currentTimeFormatted,
      employeeName: employeeName,
      message: `✅ ${employeeName}, bonjour ! Arrivée enregistrée à ${currentTimeFormatted} (${statusText})`,
      emoji: '✅',
      statusType: 'new_check_in',
      attendance: attendanceRecord,
      employee: {
        id: employee.id,
        employeeId: employeeId,
        name: employeeName,
        firstName: employee.first_name,
        lastName: employee.last_name,
        department: employee.department,
        position: employee.position
      },
      frontend: {
        showCheckOutButton: true,
        showCheckInInfo: true,
        showSuccessAnimation: true,
        showWarningAnimation: false,
        buttonText: 'Pointer le Départ',
        buttonColor: 'primary',
        icon: 'logout',
        suggestions: [
          "N'oubliez pas de pointer votre départ en fin de journée",
          "Vous pouvez pointer votre départ depuis cette interface"
        ]
      },
      timestamp: now.toISOString(),
      welcomeMessage: `Bonjour ${employee.first_name} !`,
      arrivalTime: currentTimeFormatted,
      status: statusText
    };
    
  } catch (error) {
    console.error('❌ [REAL] Erreur enregistrement pointage:', error.message);
    return {
      success: false,
      message: 'Erreur technique lors de l\'enregistrement',
      userMessage: '❌ Une erreur est survenue, veuillez réessayer',
      canRetry: true,
      error: error.message
    };
  }
};

// ==================== RECONNAISSANCE FACIALE ====================

exports.recognizeFace = async (imageBuffer) => {
  const startTime = Date.now();
  let detectorUsed = 'tiny';
  let attempts = 0;
  let detectionQuality = null;
  
  try {
    console.log('🚀 DÉBUT RECONNAISSANCE INTELLIGENTE...');
    
    if (!MODELS_LOADED) {
      console.log('⚠️ Modèles non chargés, tentative de chargement...');
      await loadModelsOnce();
    }
    
    console.time('   ⏱️  Chargement image');
    const img = await canvas.loadImage(imageBuffer);
    const imageSize = { width: img.width, height: img.height };
    console.timeEnd('   ⏱️  Chargement image');
    
    console.log(`📐 Taille image: ${imageSize.width}x${imageSize.height}`);
    
    let detections = null;
    let bestDetection = null;
    
    console.time('   ⏱️  Détection intelligente');
    
    for (let i = 0; i < TINY_CONFIGS.length; i++) {
      attempts++;
      const config = TINY_CONFIGS[i];
      
      console.log(`   🔄 Essai ${i+1}/3: inputSize=${config.inputSize}, threshold=${config.scoreThreshold}`);
      
      try {
        detections = await faceapi
          .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions(config))
          .withFaceLandmarks()
          .withFaceDescriptors();
        
        if (detections && detections.length > 0) {
          detectionQuality = evaluateDetectionQuality(detections[0], imageSize);
          bestDetection = detections[0];
          
          console.log(`   ✅ Détection réussie avec config ${i+1}`);
          console.log(`   📊 Qualité: ${detectionQuality.score.toFixed(1)}/100`);
          break;
        }
      } catch (err) {
        console.log(`   ⚠️  Erreur config ${i+1}:`, err.message);
      }
    }
    
    console.timeEnd('   ⏱️  Détection intelligente');
    
    if (!detections || detections.length === 0) {
      console.log('⚠️  AUCUNE détection avec TinyFaceDetector');
      console.log('🔄 Fallback vers SSD...');
      
      console.time('   ⏱️  Détection SSD (fallback)');
      detectorUsed = 'ssd';
      
      try {
        detections = await faceapi
          .detectAllFaces(img, new faceapi.SsdMobilenetv1Options(SSD_CONFIG))
          .withFaceLandmarks()
          .withFaceDescriptors();
        
        if (detections && detections.length > 0) {
          detectionQuality = evaluateDetectionQuality(detections[0], imageSize);
          bestDetection = detections[0];
        }
        
        console.timeEnd('   ⏱️  Détection SSD (fallback)');
      } catch (ssdError) {
        console.error('❌ Erreur SSD:', ssdError.message);
        console.timeEnd('   ⏱️  Détection SSD (fallback)');
      }
      
      if (!detections || detections.length === 0) {
        const totalTime = Date.now() - startTime;
        
        return {
          recognized: false,
          success: true,
          message: 'Aucun visage détecté',
          userMessage: '❌ Aucun visage détecté. Assurez-vous que votre visage est bien visible.',
          processingTime: totalTime,
          detector: detectorUsed,
          attempts: attempts,
          frontend: {
            showRetryButton: true,
            showCameraHelp: true,
            suggestions: [
              "Assurez-vous que votre visage est bien visible",
              "Éclairage suffisant",
              "Face à la caméra",
              "Pas de masque ni lunettes de soleil"
            ]
          }
        };
      }
    }
    
    console.log(`✅ ${detections.length} visage(s) détecté(s) avec ${detectorUsed.toUpperCase()}`);
    console.log(`⏱️  Temps détection: ${Date.now() - startTime}ms`);
    console.log(`🎯 Essais nécessaires: ${attempts}`);
    
    const registeredFaces = getRegisteredFaces();
    
    if (registeredFaces.length === 0) {
      const totalTime = Date.now() - startTime;
      
      return {
        recognized: false,
        success: true,
        message: 'Aucun visage enregistré',
        userMessage: '❌ Aucun visage enregistré dans le système',
        processingTime: totalTime,
        detector: detectorUsed,
        attempts: attempts,
        registeredFacesCount: 0
      };
    }
    
    console.time('   ⏱️  Comparaison');
    const faceMatcher = new faceapi.FaceMatcher(registeredFaces, RECOGNITION_THRESHOLD);
    const bestMatch = faceMatcher.findBestMatch(bestDetection.descriptor);
    console.timeEnd('   ⏱️  Comparaison');
    
    const totalTime = Date.now() - startTime;
    console.log(`⏱️  Temps total: ${totalTime}ms`);
    
    const confidence = calculateConfidence(bestMatch.distance);
    
    const isRecognized = (
      bestMatch.label !== 'unknown' && 
      bestMatch.distance < RECOGNITION_THRESHOLD &&
      confidence.isAcceptable
    );
    
    if (isRecognized) {
      console.log(`✅ VISAGE RECONNU: ${bestMatch.label}`);
      console.log(`📊 Confiance: ${confidence.percentage.toFixed(1)}% (${confidence.level})`);
      
      return {
        recognized: true,
        success: true,
        match: {
          employeeId: bestMatch.label,
          confidence: confidence.percentage,
          distance: bestMatch.distance,
          confidenceLevel: confidence.level,
          isHighConfidence: confidence.level === 'high'
        },
        processingTime: totalTime,
        detector: detectorUsed,
        attempts: attempts,
        detectionQuality: detectionQuality
      };
    }
    
    console.log(`❌ Visage NON reconnu`);
    console.log(`📊 Meilleure correspondance: ${bestMatch.label}`);
    console.log(`📏 Distance: ${bestMatch.distance.toFixed(4)} (seuil: ${RECOGNITION_THRESHOLD})`);
    
    return {
      recognized: false,
      success: true,
      bestMatch: {
        label: bestMatch.label,
        distance: bestMatch.distance,
        confidence: confidence.percentage,
        confidenceLevel: confidence.level,
        isAcceptable: confidence.isAcceptable
      },
      processingTime: totalTime,
      detector: detectorUsed,
      attempts: attempts,
      detectionQuality: detectionQuality,
      message: 'Visage non reconnu',
      userMessage: confidence.isAcceptable ? 
        `⚠️ Visage proche mais non reconnu (confiance: ${confidence.percentage.toFixed(1)}%)` :
        `❌ Confiance trop faible (${confidence.percentage.toFixed(1)}%)`,
      frontend: {
        showRetryButton: true,
        suggestions: !confidence.isAcceptable ? [
          `Améliorer la qualité d'enregistrement`,
          'Prendre plusieurs photos sous différents angles',
          'Assurer un bon éclairage'
        ] : []
      }
    };
    
  } catch (error) {
    console.error('❌ ERREUR CRITIQUE reconnaissance:', error.message);
    
    const totalTime = Date.now() - startTime;
    return {
      recognized: false,
      success: false,
      message: 'Erreur technique',
      userMessage: '❌ Erreur technique, veuillez réessayer',
      processingTime: totalTime,
      detector: detectorUsed,
      attempts: attempts,
      error: true,
      frontend: {
        showRetryButton: true,
        showContactAdmin: true
      }
    };
  }
};

// ==================== RECONNAISSANCE AVEC POINTAGE AMÉLIORÉE ====================

exports.recognizeAndAttend = async (imageBuffer) => {
  const startTime = Date.now();
  const requestId = `attend_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  try {
    console.log(`🎯 [${requestId}] Reconnaissance + Pointage avec réponse enrichie`);
    
    // 1. Reconnaissance faciale
    const recognitionResult = await exports.recognizeFace(imageBuffer);
    
    if (!recognitionResult.success) {
      return {
        ...recognitionResult,
        timestamp: new Date().toISOString(),
        operation: 'recognize-and-attend',
        attendanceRecorded: false,
        requestId: requestId
      };
    }
    
    // Si non reconnu
    if (!recognitionResult.recognized || !recognitionResult.match) {
      return {
        ...recognitionResult,
        timestamp: new Date().toISOString(),
        operation: 'recognize-and-attend',
        attendanceRecorded: false,
        requestId: requestId,
        frontend: {
          ...recognitionResult.frontend,
          showTryAgain: true,
          showRegisterFace: recognitionResult.bestMatch?.isAcceptable
        }
      };
    }
    
    const { employeeId, confidence } = recognitionResult.match;
    console.log(`✅ [${requestId}] Visage reconnu: ${employeeId} - ${confidence.toFixed(1)}%`);
    
    // 2. Enregistrer le pointage avec vérification
    console.log(`📅 [${requestId}] Tentative de pointage pour ${employeeId}...`);
    const attendanceResult = await recordAttendance(employeeId, confidence);
    
    // 3. Récupérer infos employé
    const employeeInfo = await db.query(
           'SELECT first_name, last_name, department, position FROM employees WHERE employee_id = $1 AND is_active = true',
     [employeeId]
    );
    
    const employee = employeeInfo.rows[0] || {};
    const employeeName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employeeId;
    
    const totalTime = Date.now() - startTime;
    
    // Si déjà pointé
    if (attendanceResult.alreadyChecked) {
      console.log(`🚨 [${requestId}] ${employeeId} déjà pointé: ${attendanceResult.message}`);
      
      return {
        ...recognitionResult,
        timestamp: new Date().toISOString(),
        operation: 'recognize-and-attend',
        attendanceRecorded: false,
        alreadyChecked: true,
        requestId: requestId,
        match: {
          ...recognitionResult.match,
          employeeId: employeeId,
          employeeName: employeeName,
          confidence: confidence
        },
        ...attendanceResult,
        processingTime: totalTime,
        totalProcessingTime: totalTime,
        frontend: {
          ...attendanceResult.frontend,
          showEmployeeInfo: true,
          showTimeDetails: true,
          showActionButtons: true,
          primaryAction: attendanceResult.existingRecord?.canCheckOut ? 'checkout' : 'none',
          secondaryAction: 'close'
        }
      };
    }
    
    // Si pointage réussi
    if (attendanceResult.success) {
      console.log(`✅ [${requestId}] Pointage réussi pour ${employeeId} en ${totalTime}ms`);
      
      return {
        ...recognitionResult,
        timestamp: new Date().toISOString(),
        operation: 'recognize-and-attend',
        attendanceRecorded: true,
        alreadyChecked: false,
        requestId: requestId,
        match: {
          ...recognitionResult.match,
          employeeId: employeeId,
          employeeName: employeeName,
          confidence: confidence
        },
        ...attendanceResult,
        processingTime: totalTime,
        totalProcessingTime: totalTime,
        frontend: {
          ...attendanceResult.frontend,
          showConfetti: true,
          showWelcomeMessage: true,
          showNextAction: true,
          primaryAction: 'checkout_later',
          secondaryAction: 'close'
        }
      };
    }
    
    // Si autre erreur
    console.log(`❌ [${requestId}] Erreur pointage pour ${employeeId}: ${attendanceResult.message}`);
    
    return {
      ...recognitionResult,
      timestamp: new Date().toISOString(),
      operation: 'recognize-and-attend',
      attendanceRecorded: false,
      alreadyChecked: false,
      requestId: requestId,
      match: {
        ...recognitionResult.match,
        employeeId: employeeId,
        employeeName: employeeName,
        confidence: confidence
      },
      message: attendanceResult.message || 'Erreur lors du pointage',
      userMessage: attendanceResult.userMessage || '❌ Erreur lors de l\'enregistrement',
      processingTime: totalTime,
      totalProcessingTime: totalTime,
      error: true,
      frontend: {
        showRetryButton: true,
        showContactSupport: true,
        suggestions: ['Veuillez réessayer', 'Si le problème persiste, contactez le support']
      }
    };
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${requestId}] Erreur recognizeAndAttend:`, error.message);
    
    return {
      recognized: false,
      success: false,
      message: 'Erreur système',
      userMessage: '❌ Erreur système, veuillez réessayer',
      timestamp: new Date().toISOString(),
      processingTime: totalTime,
      totalProcessingTime: totalTime,
      error: true,
      frontend: {
        showRetryButton: true,
        showSystemError: true,
        suggestions: ['Veuillez réessayer dans quelques instants']
      }
    };
  }
};

// ==================== FONCTION POUR POINTER LE DÉPART ====================

exports.recordCheckOut = async (employeeId) => {
  return await recordCheckOut(employeeId);
};

// ==================== FONCTIONS UTILITAIRES ====================

exports.checkRegistration = async (employeeId) => {
  try {
    const cached = FACE_CACHE.get(employeeId);
    let hasFaceRegistered = !!cached;
    
    if (!hasFaceRegistered) {
      const filePath = path.join(__dirname, '../data/face_descriptors', `${employeeId}.json`);
      hasFaceRegistered = fs.existsSync(filePath);
    }
    
    return {
      hasFaceRegistered,
      employeeId,
      registrationDate: cached?.timestamp || null,
      quality: cached?.quality || 'unknown',
      source: cached?.source || 'file',
      inCache: !!cached,
      isOptimized: cached?.source === 'optimized'
    };
    
  } catch (error) {
    console.error(`❌ Erreur vérification ${employeeId}:`, error);
    return {
      hasFaceRegistered: false,
      employeeId,
      error: error.message
    };
  }
};

exports.deleteRegistration = async (employeeId) => {
  try {
    const wasCached = FACE_CACHE.has(employeeId);
    FACE_CACHE.delete(employeeId);
    
    const filePath = path.join(__dirname, '../data/face_descriptors', `${employeeId}.json`);
    let fileDeleted = false;
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      fileDeleted = true;
      console.log(`🗑️  Fichier supprimé: ${filePath}`);
    }
    
    REGISTERED_FACES = REGISTERED_FACES.filter(face => face.label !== employeeId);
    
    REGISTRATION_STATS.totalRegistrations = Math.max(0, REGISTRATION_STATS.totalRegistrations - 1);
    
    console.log(`✅ Enregistrement supprimé pour ${employeeId}`);
    
    return {
      success: true,
      message: `Enregistrement facial supprimé pour ${employeeId}`,
      timestamp: new Date().toISOString(),
      details: {
        wasCached,
        fileDeleted,
        remainingRegistrations: FACE_CACHE.size
      }
    };
    
  } catch (error) {
    console.error(`❌ Erreur suppression ${employeeId}:`, error);
    return {
      success: false,
      message: 'Erreur lors de la suppression: ' + error.message
    };
  }
};

exports.getStatistics = () => {
  const stats = {
    modelsLoaded: MODELS_LOADED,
    modelLoadTime: MODEL_LOAD_TIME,
    registeredFaces: FACE_CACHE.size,
    cacheSize: FACE_CACHE.size,
    mode: 'ultra-optimized-v2-enhanced',
    detector: 'TinyFaceDetector + SSD fallback',
    config: {
      tinyConfigs: TINY_CONFIGS,
      ssdConfig: SSD_CONFIG,
      ssdRegistrationConfig: SSD_REGISTRATION_CONFIG,
      recognitionThreshold: RECOGNITION_THRESHOLD,
      minConfidenceThreshold: MIN_CONFIDENCE_THRESHOLD
    },
    performance: {
      target: '2-3 secondes (95% des cas)',
      fallback: 'SSD si Tiny échoue',
      strategy: '3 essais avec différentes configurations'
    },
    registrationStats: REGISTRATION_STATS,
    features: {
      recognition: 'Détection intelligente avec validation de qualité',
      registration: 'SSD pour qualité maximale avec évaluation',
      enhancedRegistration: 'Enregistrement multiple disponible',
      cache: 'Mémoire avancé avec métadonnées',
      doubleAttendanceCheck: 'VÉRIFICATION INTÉGRÉE DES DOUBLES POINTAGES',
      enhancedFrontendResponse: 'RÉPONSE FRONTEND ENRICHIE AVEC ACTIONS'
    },
    lastUpdate: new Date().toISOString(),
    version: '2.3-enhanced-frontend'
  };
  
  return stats;
};

exports.reloadModels = async () => {
  MODELS_LOADED = false;
  console.log('🔄 Rechargement des modèles...');
  return await loadModelsOnce();
};

exports.reloadDescriptors = async () => {
  console.log('🔄 Rechargement des descripteurs...');
  return await loadAllDescriptors();
};

exports.optimizeAllDescriptors = async () => {
  console.log('⚡ Optimisation de tous les descripteurs...');
  
  const descriptorsDir = path.join(__dirname, '../data/face_descriptors');
  if (!fs.existsSync(descriptorsDir)) {
    return { success: false, message: 'Dossier descripteurs introuvable' };
  }
  
  const files = fs.readdirSync(descriptorsDir).filter(f => f.endsWith('.json'));
  let optimized = 0;
  let errors = 0;
  
  for (const file of files) {
    try {
      const filePath = path.join(descriptorsDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (!data.version || data.version < '2.0') {
        data.version = '2.0';
        data.optimizedAt = Date.now();
        data.source = 'optimized-legacy';
        
        if (!data.quality) {
          data.quality = 'standard';
        }
        
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        optimized++;
        console.log(`   ⚡ Optimisé: ${data.employeeId || file}`);
      }
    } catch (error) {
      console.error(`   ❌ Erreur optimisation ${file}:`, error.message);
      errors++;
    }
  }
  
  await loadAllDescriptors();
  
  return {
    success: true,
    optimized,
    errors,
    total: files.length,
    message: `Optimisation terminée: ${optimized} fichiers optimisés, ${errors} erreurs`
  };
};

// ==================== EXPORTS ====================

exports.getRegisteredFaces = getRegisteredFaces;
exports.initialize = loadModelsOnce;
exports.isInitialized = () => MODELS_LOADED;

module.exports = exports;