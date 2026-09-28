const express = require('express');
const router = express.Router();
const multer = require('multer');
const facialRecognition = require('../../services/realFacialRecognition');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const db = require('../../config/db');

// ==================== CONFIGURATION ====================
const MIN_CHECKIN_DURATION_HOURS = 1; // Délai minimum entre checkin et checkout
const MIN_CHECKIN_DURATION_MS = MIN_CHECKIN_DURATION_HOURS * 60 * 60 * 1000;

// Messages en français avec variantes
const FRENCH_MESSAGES = {
  greetings: [
    `Bonjour {firstName} !`,
    `Salut {firstName} !`,
    `Bien le bonjour {firstName} !`,
    `Content de vous voir {firstName} !`
  ],
  checkin: [
    `Arrivée enregistrée à {time}`,
    `Pointage d'arrivée à {time}`,
    `Enregistrement d'arrivée à {time}`,
    `Heure d'arrivée : {time}`
  ],
  checkout: [
    `Départ enregistré à {time}`,
    `Pointage de départ à {time}`,
    `Enregistrement de départ à {time}`,
    `Heure de départ : {time}`
  ],
  farewells: [
    `Au revoir {firstName} !`,
    `Bonne fin de journée {firstName} !`,
    `À demain {firstName} !`,
    `Bonsoir {firstName} !`
  ]
};

// Fonction pour choisir un message aléatoire
const getRandomMessage = (category, data = {}) => {
  const messages = FRENCH_MESSAGES[category] || [];
  const message = messages[Math.floor(Math.random() * messages.length)] || messages[0];
  
  // Remplacer les variables
  return message
    .replace('{firstName}', data.firstName || '')
    .replace('{time}', data.time || '')
    .replace('{fullName}', data.fullName || '');
};

// Configuration multer
const storage = multer.memoryStorage();

// Config pour 1 fichier (compatibilité)
const uploadSingle = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  }
});

// Config pour MULTIPLES fichiers
const uploadMultiple = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max par fichier
    files: 5 // Jusqu'à 5 fichiers
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  }
});

/**
 * Middleware flexible qui accepte un fichier image dans n'importe quel champ
 */
const flexibleImageUpload = (req, res, next) => {
  uploadSingle.any()(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Fichier trop volumineux (max 10MB)',
          code: 'FILE_TOO_LARGE'
        });
      }
      
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          message: `Erreur upload: ${err.message}`,
          code: 'UPLOAD_ERROR'
        });
      }
      
      return res.status(400).json({
        success: false,
        message: err.message,
        code: 'INVALID_FILE_TYPE'
      });
    }
    
    // Debug: Log des fichiers reçus
    if (req.files && req.files.length > 0) {
      console.log('📦 Fichiers reçus:');
      req.files.forEach((file, index) => {
        console.log(`  ${index + 1}. Champ: "${file.fieldname}"`);
        console.log(`     Nom: ${file.originalname}`);
        console.log(`     Type: ${file.mimetype}`);
        console.log(`     Taille: ${file.size} bytes`);
      });
    }
    
    // Trouver le premier fichier image
    if (req.files && req.files.length > 0) {
      const imageFile = req.files.find(file => 
        file.mimetype.startsWith('image/')
      );
      
      if (imageFile) {
        req.file = imageFile;
        console.log(`✅ Fichier image sélectionné: "${imageFile.fieldname}" (${imageFile.mimetype})`);
      } else {
        const fileTypes = req.files.map(f => f.mimetype).join(', ');
        return res.status(400).json({
          success: false,
          message: 'Aucun fichier image trouvé. Types reçus: ' + fileTypes,
          code: 'NO_IMAGE_FILE'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier uploadé',
        code: 'NO_FILE_UPLOADED'
      });
    }
    
    next();
  });
};

/**
 * Middleware pour MULTIPLES fichiers
 */
const flexibleMultipleImageUpload = (req, res, next) => {
  uploadMultiple.any()(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Un fichier dépasse 10MB',
          code: 'FILE_TOO_LARGE'
        });
      }
      
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Maximum 5 fichiers autorisés',
          code: 'TOO_MANY_FILES'
        });
      }
      
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          message: `Erreur upload: ${err.message}`,
          code: 'UPLOAD_ERROR'
        });
      }
      
      return res.status(400).json({
        success: false,
        message: err.message,
        code: 'INVALID_FILE_TYPE'
      });
    }
    
    // Debug: Log des fichiers reçus
    if (req.files && req.files.length > 0) {
      console.log(`📦 ${req.files.length} fichiers reçus pour enregistrement multiple:`);
      req.files.forEach((file, index) => {
        console.log(`  ${index + 1}. Champ: "${file.fieldname}"`);
        console.log(`     Nom: ${file.originalname}`);
        console.log(`     Type: ${file.mimetype}`);
        console.log(`     Taille: ${file.size} bytes`);
      });
      
      // Filtrer uniquement les images
      const imageFiles = req.files.filter(file => 
        file.mimetype.startsWith('image/')
      );
      
      if (imageFiles.length === 0) {
        const fileTypes = req.files.map(f => f.mimetype).join(', ');
        return res.status(400).json({
          success: false,
          message: 'Aucun fichier image trouvé. Types reçus: ' + fileTypes,
          code: 'NO_IMAGE_FILE'
        });
      }
      
      // Stocker dans req.images pour distinction
      req.images = imageFiles;
      console.log(`✅ ${imageFiles.length} images sélectionnées pour l'enregistrement`);
      
    } else {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier uploadé',
        code: 'NO_FILE_UPLOADED'
      });
    }
    
    next();
  });
};

// ==================== FONCTIONS UTILITAIRES ====================

const findEmployee = async (employeeId) => {
  try {
    const result = await db.query(
      'SELECT id, employee_id, first_name, last_name, department, email, is_active FROM employees WHERE employee_id = $1',
      [employeeId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('❌ Erreur recherche employé:', error);
    return null;
  }
};

const updateFaceRegistration = async (employeeId, hasFaceRegistered = true, descriptorsCount = 0) => {
  try {
    const registrationDate = hasFaceRegistered ? new Date().toISOString() : null;
    
    await db.query(
      `UPDATE employees 
       SET face_encoding_date = $1, 
           has_face_registered = $2,
           face_descriptors_count = $3,
           updated_at = NOW() 
       WHERE employee_id = $4`,
      [registrationDate, hasFaceRegistered, descriptorsCount, employeeId]
    );
    
    return true;
  } catch (error) {
    console.error('❌ Erreur mise à jour enregistrement facial:', error);
    return false;
  }
};

// ==================== FONCTION DE VÉRIFICATION DÉLAI ====================

/**
 * Vérifie si le checkout est autorisé (délai minimum de 1 heure respecté)
 */
async function canCheckout(employeeId, requestId) {
  try {
    const today = new Date();
    const todayDate = today.toISOString().split('T')[0];
    
    // Récupérer le dernier checkin de l'employé aujourd'hui
    const lastCheckin = await db.query(
      `SELECT id, check_in_time, check_out_time, record_date
       FROM attendance 
       WHERE employee_id = $1 
         AND record_date = $2
         AND check_in_time IS NOT NULL
         AND check_out_time IS NULL
       ORDER BY check_in_time DESC 
       LIMIT 1`,
      [employeeId, todayDate]
    );
    
    if (lastCheckin.rows.length === 0) {
      console.log(`⚠️ [${requestId}] Aucun checkin trouvé aujourd'hui pour ${employeeId}`);
      return {
        allowed: false,
        reason: 'NO_CHECKIN_FOUND',
        message: 'Aucun pointage d\'arrivée trouvé'
      };
    }
    
    const attendance = lastCheckin.rows[0];
    const checkinTimeStr = attendance.check_in_time;
    
    if (!checkinTimeStr) {
      return {
        allowed: false,
        reason: 'INVALID_CHECKIN_TIME',
        message: 'Heure d\'arrivée invalide'
      };
    }
    
    // Convertir le checkin time en Date
    const now = new Date();
    const checkinDate = new Date(`${todayDate}T${checkinTimeStr}`);
    
    // Calculer le temps écoulé
    const timeDiffMs = now.getTime() - checkinDate.getTime();
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
    
    console.log(`⏰ [${requestId}] Temps écoulé depuis checkin: ${timeDiffHours.toFixed(2)} heures`);
    
    // Vérifier le délai minimum
    if (timeDiffMs < MIN_CHECKIN_DURATION_MS) {
      const minutesRemaining = Math.ceil((MIN_CHECKIN_DURATION_MS - timeDiffMs) / (1000 * 60));
      const minutesElapsed = Math.floor(timeDiffMs / (1000 * 60));
      
      console.log(`⏳ [${requestId}] Checkout refusé: Seulement ${minutesElapsed} minutes écoulées`);
      console.log(`ℹ️ [${requestId}] Attendre encore ${minutesRemaining} minutes`);
      
      return {
        allowed: false,
        reason: 'MINIMUM_DURATION_NOT_REACHED',
        message: `Délai minimum non atteint`,
        details: {
          checkinTime: checkinTimeStr,
          currentTime: now.toTimeString().split(' ')[0].slice(0, 5),
          minutesElapsed: minutesElapsed,
          minutesRequired: MIN_CHECKIN_DURATION_HOURS * 60,
          minutesRemaining: minutesRemaining,
          timeDiffHours: timeDiffHours.toFixed(2)
        }
      };
    }
    
    return {
      allowed: true,
      details: {
        checkinTime: checkinTimeStr,
        currentTime: now.toTimeString().split(' ')[0].slice(0, 5),
        timeElapsedHours: timeDiffHours.toFixed(2),
        hoursWorked: timeDiffHours.toFixed(2)
      }
    };
    
  } catch (error) {
    console.error(`❌ [${requestId}] Erreur vérification délai:`, error);
    return {
      allowed: false,
      reason: 'CHECKOUT_VALIDATION_ERROR',
      message: 'Erreur lors de la vérification du délai'
    };
  }
}

// ==================== FONCTION POUR GÉNÉRER LES MESSAGES PERSONNALISÉS ====================

const generatePersonalizedMessages = (employee, action, time, options = {}) => {
  const { first_name, last_name, department } = employee;
  const timeFormatted = time.slice(0, 5);
  const fullName = `${first_name} ${last_name}`;
  
  const baseMessages = {
    checkin_success: {
      message: `✅ Bonjour ${first_name} ${last_name} ! Arrivée enregistrée à ${timeFormatted}`,
      userMessage: `Bienvenue ${first_name}, votre arrivée a été enregistrée avec succès.`,
      frontend: {
        title: `Bonjour ${first_name} !`,
        subtitle: `Arrivée enregistrée à ${timeFormatted}`,
        icon: '👋',
        color: 'success',
        employeeInfo: {
          firstName: first_name,
          lastName: last_name,
          fullName: fullName,
          department: department
        }
      }
    },
    checkout_success: {
      message: `✅ Au revoir ${first_name} ${last_name} ! Départ enregistré à ${timeFormatted}`,
      userMessage: `Merci pour votre travail ${first_name}, votre départ a été enregistré.`,
      frontend: {
        title: `Au revoir ${first_name} !`,
        subtitle: `Départ enregistré à ${timeFormatted}`,
        icon: '🚪',
        color: 'info',
        employeeInfo: {
          firstName: first_name,
          lastName: last_name,
          fullName: fullName,
          department: department
        }
      }
    },
    already_checked_in: {
      message: `ℹ️ ${first_name} ${last_name}, vous êtes déjà pointé(e) aujourd'hui.`,
      userMessage: `${first_name}, vous avez déjà pointé votre arrivée aujourd'hui.`,
      frontend: {
        title: `Déjà pointé(e)`,
        subtitle: `Bonjour ${first_name}, vous êtes déjà enregistré(e)`,
        icon: '✅',
        color: 'warning',
        employeeInfo: {
          firstName: first_name,
          lastName: last_name,
          fullName: fullName,
          department: department
        }
      }
    },
    checkout_waiting: {
      message: `⏳ ${first_name} ${last_name}, attendez encore ${options.minutesRemaining} minutes.`,
      userMessage: `${first_name}, veuillez attendre encore ${options.minutesRemaining} minutes avant de pointer le départ.`,
      frontend: {
        title: `Attente requise`,
        subtitle: `${first_name}, attendez ${options.minutesRemaining} minutes`,
        icon: '⏰',
        color: 'warning',
        employeeInfo: {
          firstName: first_name,
          lastName: last_name,
          fullName: fullName,
          department: department
        }
      }
    },
    not_recognized: {
      message: `❌ Visage non reconnu`,
      userMessage: 'Désolé, nous n\'avons pas pu vous identifier.',
      frontend: {
        title: `Non reconnu`,
        subtitle: `Veuillez réessayer ou contacter l'administration`,
        icon: '❓',
        color: 'error'
      }
    }
  };
  
  const key = options.key || `${action}_${options.status || 'success'}`;
  return baseMessages[key] || baseMessages.not_recognized;
};

// ==================== ROUTE AUTOMATIQUE AVEC DÉLAI MINIMUM ====================

// Reconnaître et pointer - VERSION AUTOMATIQUE avec délai minimum
router.post('/recognize-and-attend',
  flexibleImageUpload,
  async (req, res) => {
    const startTime = Date.now();
    const requestId = `attend_auto_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    console.log(`🤖 [${requestId}] ROUTE /recognize-and-attend (AVEC DÉLAI MINIMUM ${MIN_CHECKIN_DURATION_HOURS}h)`);
    console.log(`📁 [${requestId}] Image: ${req.file.originalname} (${req.file.size} bytes)`);
    
    try {
      // 1. Reconnaissance faciale
      let recognitionResult;
      try {
        recognitionResult = await facialRecognition.recognizeFace(req.file.buffer);
      } catch (recogError) {
        console.error(`❌ [${requestId}] Erreur reconnaissance:`, recogError.message);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la reconnaissance faciale',
          code: 'RECOGNITION_ERROR',
          processingTime: Date.now() - startTime + 'ms'
        });
      }
      
      // 2. Si visage non reconnu
      if (!recognitionResult.recognized) {
        const processingTime = Date.now() - startTime;
        return res.json({
          success: true,
          recognized: false,
          attendanceRecorded: false,
          message: recognitionResult.message || 'Visage non reconnu',
          processingTime: processingTime + 'ms',
          frontend: {
            showRetry: true,
            message: 'Visage non reconnu. Veuillez réessayer.',
            buttonText: 'Réessayer',
            statusColor: 'warning'
          }
        });
      }
      
      // 3. Récupérer l'employé reconnu
      const recognizedEmployeeId = recognitionResult.match.employeeId;
      const confidence = recognitionResult.match.confidence || 0.85;
      const employeeNameFromRecognition = `${recognitionResult.match.firstName || ''} ${recognitionResult.match.lastName || ''}`;
      
      console.log(`👤 [${requestId}] Employé reconnu: ${recognizedEmployeeId} - ${employeeNameFromRecognition} (${confidence}%)`);
      
      // 4. Vérifier l'employé dans la base
      const employee = await findEmployee(recognizedEmployeeId);
      if (!employee) {
        const processingTime = Date.now() - startTime;
        return res.status(404).json({
          success: false,
          recognized: true,
          attendanceRecorded: false,
          message: `Employé ${recognizedEmployeeId} non trouvé`,
          code: 'EMPLOYEE_NOT_FOUND',
          processingTime: processingTime + 'ms'
        });
      }
      
      const fullEmployeeName = `${employee.first_name} ${employee.last_name}`;
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().split(' ')[0].slice(0, 8); // HH:MM:SS
      const currentTimeFormatted = currentTime.slice(0, 5); // HH:MM
      
      // 5. Vérifier le statut actuel de l'employé
      console.log(`📊 [${requestId}] Vérification statut pour ${recognizedEmployeeId}`);
      
      const attendanceResult = await db.query(
        `SELECT id, check_in_time, check_out_time, status, hours_worked, record_date
         FROM attendance 
         WHERE employee_id = $1 
           AND record_date = $2
         ORDER BY check_in_time DESC 
         LIMIT 1`,
        [recognizedEmployeeId, today]
      );
      
      // ========== CAS A: Aucun pointage aujourd'hui → CHECKIN ==========
      if (attendanceResult.rows.length === 0) {
        console.log(`✅ [${requestId}] Aucun pointage → CHECKIN automatique`);
        
        try {
          // Déterminer le statut (en retard ou non)
          let status = 'present';
          const hour = now.getHours();
          const minute = now.getMinutes();
          
          if (hour > 9 || (hour === 9 && minute > 15)) {
            status = 'late';
          }
          
          // Insérer le pointage d'arrivée avec gestion de conflit
          const insertResult = await db.query(
            `INSERT INTO attendance (
              employee_id, 
              check_in_time, 
              record_date,
              status,
              verification_method,
              face_verified,
              face_confidence,
              employee_name,
              department,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            ON CONFLICT (employee_id, record_date) 
            DO UPDATE SET 
              check_in_time = EXCLUDED.check_in_time,
              status = EXCLUDED.status,
              verification_method = EXCLUDED.verification_method,
              face_verified = EXCLUDED.face_verified,
              face_confidence = EXCLUDED.face_confidence,
              employee_name = EXCLUDED.employee_name,
              department = EXCLUDED.department,
              updated_at = NOW()
            RETURNING id, check_in_time, record_date, status`,
            [
              recognizedEmployeeId,
              currentTime,
              today,
              status,
              'face_recognition',
              true,
              confidence,
              fullEmployeeName,
              employee.department
            ]
          );
          
          const attendanceRecord = insertResult.rows[0];
          const totalTime = Date.now() - startTime;
          
          console.log(`🎉 [${requestId}] CHECKIN réussi pour ${recognizedEmployeeId} à ${currentTimeFormatted}`);
          
          // Générer les messages personnalisés
          const personalized = generatePersonalizedMessages(employee, 'checkin', currentTime);
          
          return res.json({
            success: true,
            recognized: true,
            attendanceRecorded: true,
            action: 'checkin',
            message: personalized.message,
            userMessage: personalized.userMessage,
            match: {
              employeeId: recognizedEmployeeId,
              employeeName: fullEmployeeName,
              firstName: employee.first_name,
              lastName: employee.last_name,
              department: employee.department,
              confidence: confidence
            },
            attendance: {
              id: attendanceRecord.id,
              checkIn: currentTime,
              checkInFormatted: currentTimeFormatted,
              recordDate: attendanceRecord.record_date,
              status: attendanceRecord.status,
              nextAction: 'checkout',
              minimumWait: `${MIN_CHECKIN_DURATION_HOURS} heure(s)`,
              canCheckoutAfter: new Date(now.getTime() + MIN_CHECKIN_DURATION_MS).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            },
            processingTime: totalTime + 'ms',
            timestamp: now.toISOString(),
            frontend: {
              ...personalized.frontend,
              showSuccess: true,
              showCheckOutHint: true,
              nextStep: `Pour pointer le départ, attendez ${MIN_CHECKIN_DURATION_HOURS} heure(s) minimum`,
              statusColor: 'success',
              statusIcon: '✅',
              checkoutAvailableAt: new Date(now.getTime() + MIN_CHECKIN_DURATION_MS).toISOString()
            }
          });
          
        } catch (dbError) {
          console.error(`❌ [${requestId}] Erreur checkin:`, dbError);
          const processingTime = Date.now() - startTime;
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de l\'arrivée',
            code: 'DATABASE_ERROR',
            processingTime: processingTime + 'ms'
          });
        }
      }
      
      const attendance = attendanceResult.rows[0];
      const checkInTime = attendance.check_in_time;
      const checkOutTime = attendance.check_out_time;
      
      // ========== CAS B: Déjà pointé arrivée mais pas départ → VÉRIFIER DÉLAI ==========
      if (checkInTime && !checkOutTime) {
        console.log(`✅ [${requestId}] Arrivée pointée, pas de départ → VÉRIFICATION DÉLAI`);
        
        // Vérifier si le checkout est autorisé (délai minimum)
        const checkoutValidation = await canCheckout(recognizedEmployeeId, requestId);
        
        if (!checkoutValidation.allowed) {
          // Checkout NON AUTORISÉ (délai minimum non atteint)
          const totalTime = Date.now() - startTime;
          const checkInFormatted = checkInTime ? checkInTime.slice(0, 5) : '--:--';
          
          console.log(`⏳ [${requestId}] Checkout refusé: ${checkoutValidation.message}`);
          
          // Générer les messages personnalisés
          const personalized = generatePersonalizedMessages(employee, 'checkout', currentTime, {
            key: 'checkout_waiting',
            minutesRemaining: checkoutValidation.details?.minutesRemaining
          });
          
          return res.json({
            success: true,
            recognized: true,
            attendanceRecorded: false,
            action: 'checkout',
            checkoutAllowed: false,
            message: personalized.message,
            userMessage: personalized.userMessage,
            validation: {
              ...checkoutValidation,
              checkinTime: checkInTime,
              currentTime: currentTimeFormatted,
              minimumDuration: `${MIN_CHECKIN_DURATION_HOURS} heure(s)`
            },
            match: {
              employeeId: recognizedEmployeeId,
              employeeName: fullEmployeeName,
              firstName: employee.first_name,
              lastName: employee.last_name,
              department: employee.department,
              confidence: confidence
            },
            attendance: {
              id: attendance.id,
              checkIn: checkInTime,
              checkInFormatted: checkInFormatted,
              recordDate: attendance.record_date,
              status: 'checked_in'
            },
            processingTime: totalTime + 'ms',
            timestamp: now.toISOString(),
            frontend: {
              ...personalized.frontend,
              showInfo: true,
              showCheckInButton: false,
              showCheckOutButton: false,
              status: 'checked_in_waiting',
              waitMessage: `Attendez ${checkoutValidation.details?.minutesRemaining || MIN_CHECKIN_DURATION_HOURS*60} minutes avant de pointer le départ`,
              nextCheckoutTime: new Date(now.getTime() + (MIN_CHECKIN_DURATION_MS - (checkoutValidation.details?.minutesElapsed || 0)*60*1000)).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            }
          });
        }
        
        // ========== CHECKOUT AUTORISÉ (délai minimum atteint) ==========
        console.log(`✅ [${requestId}] Délai atteint → CHECKOUT automatique`);
        
        try {
          // Calculer les heures travaillées
          let hoursWorked = 0;
          if (checkInTime) {
            const [inHour, inMinute] = checkInTime.split(':').map(Number);
            const [outHour, outMinute] = currentTime.split(':').map(Number);
            const totalMinutes = (outHour * 60 + outMinute) - (inHour * 60 + inMinute);
            if (totalMinutes > 0) {
              hoursWorked = (totalMinutes / 60).toFixed(2);
            }
          }
          
          // Mettre à jour avec départ
          const updateResult = await db.query(
            `UPDATE attendance 
             SET 
               check_out_time = $1,
               hours_worked = $2,
               status = 'completed',
               verification_method = 'face_recognition',
               updated_at = NOW()
             WHERE id = $3
             RETURNING id, check_out_time, hours_worked, record_date`,
            [currentTime, hoursWorked, attendance.id]
          );
          
          const updatedRecord = updateResult.rows[0];
          const totalTime = Date.now() - startTime;
          
          const checkInFormatted = checkInTime ? checkInTime.slice(0, 5) : '--:--';
          
          console.log(`🎉 [${requestId}] CHECKOUT réussi pour ${recognizedEmployeeId} à ${currentTimeFormatted}`);
          console.log(`📊 [${requestId}] Durée travaillée: ${hoursWorked} heures`);
          
          // Générer les messages personnalisés
          const personalized = generatePersonalizedMessages(employee, 'checkout', currentTime);
          
          return res.json({
            success: true,
            recognized: true,
            attendanceRecorded: true,
            action: 'checkout',
            checkoutAllowed: true,
            message: personalized.message,
            userMessage: personalized.userMessage,
            match: {
              employeeId: recognizedEmployeeId,
              employeeName: fullEmployeeName,
              firstName: employee.first_name,
              lastName: employee.last_name,
              department: employee.department,
              confidence: confidence
            },
            attendance: {
              id: updatedRecord.id,
              checkIn: checkInTime,
              checkInFormatted: checkInFormatted,
              checkOut: currentTime,
              checkOutFormatted: currentTimeFormatted,
              hoursWorked: updatedRecord.hours_worked,
              recordDate: updatedRecord.record_date,
              status: 'completed',
              workedDuration: `${hoursWorked} heures`
            },
            processingTime: totalTime + 'ms',
            timestamp: now.toISOString(),
            frontend: {
              ...personalized.frontend,
              showSuccess: true,
              showSummary: true,
              summary: {
                employeeName: fullEmployeeName,
                arrivedAt: checkInFormatted,
                leftAt: currentTimeFormatted,
                hoursWorked: `${updatedRecord.hours_worked} heures`,
                duration: `${hoursWorked} heures`,
                status: 'Pointage complet'
              }
            }
          });
          
        } catch (dbError) {
          console.error(`❌ [${requestId}] Erreur checkout:`, dbError);
          const processingTime = Date.now() - startTime;
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement du départ',
            code: 'DATABASE_ERROR',
            processingTime: processingTime + 'ms'
          });
        }
      }
      
      // ========== CAS C: Pointage déjà complet ==========
      if (checkInTime && checkOutTime) {
        console.log(`ℹ️ [${requestId}] Pointage déjà complet`);
        
        const checkInFormatted = checkInTime ? checkInTime.slice(0, 5) : '--:--';
        const checkOutFormatted = checkOutTime ? checkOutTime.slice(0, 5) : '--:--';
        const processingTime = Date.now() - startTime;
        
        // Générer les messages personnalisés
        const personalized = generatePersonalizedMessages(employee, 'checkin', checkInTime, {
          key: 'already_checked_in'
        });
        
        return res.json({
          success: true,
          recognized: true,
          attendanceRecorded: false,
          alreadyChecked: true,
          message: personalized.message,
          userMessage: personalized.userMessage,
          match: {
            employeeId: recognizedEmployeeId,
            employeeName: fullEmployeeName,
            firstName: employee.first_name,
            lastName: employee.last_name,
            department: employee.department,
            confidence: confidence
          },
          attendance: {
            checkIn: checkInTime,
            checkOut: checkOutTime,
            checkInFormatted: checkInFormatted,
            checkOutFormatted: checkOutFormatted,
            hoursWorked: attendance.hours_worked || 0,
            recordDate: attendance.record_date,
            status: 'completed'
          },
          processingTime: processingTime + 'ms',
          timestamp: now.toISOString(),
          frontend: {
            ...personalized.frontend,
            showInfo: true,
            showSummary: true,
            summary: {
              employeeName: fullEmployeeName,
              arrivedAt: checkInFormatted,
              leftAt: checkOutFormatted,
              hoursWorked: `${attendance.hours_worked || 0} heures`,
              status: 'Terminé'
            }
          }
        });
      }
      
      // ========== CAS D: Situation inattendue ==========
      const processingTime = Date.now() - startTime;
      return res.json({
        success: false,
        recognized: true,
        attendanceRecorded: false,
        message: `État de pointage inattendu pour ${fullEmployeeName}`,
        match: {
          employeeId: recognizedEmployeeId,
          employeeName: fullEmployeeName,
          firstName: employee.first_name,
          lastName: employee.last_name,
          confidence: confidence
        },
        processingTime: processingTime + 'ms',
        frontend: {
          showError: true,
          message: 'Erreur: état de pointage inattendu',
          statusColor: 'error'
        }
      });
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ [${requestId}] Erreur route automatique:`, error.message);
      
      res.status(500).json({
        success: false,
        error: 'ATTENDANCE_AUTO_ERROR',
        message: 'Erreur lors du pointage automatique',
        processingTime: processingTime + 'ms',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// ==================== ROUTE POUR VÉRIFIER LE STATUT ====================

// 1. Route pour vérifier le statut actuel d'un employé
router.get('/attendance-status/:employeeId',
  authenticateToken,
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      const requestId = `status_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      console.log(`📊 [${requestId}] Vérification statut pour ${employeeId}`);
      
      if (!employeeId) {
        return res.status(400).json({
          success: false,
          message: 'ID employé requis',
          code: 'MISSING_EMPLOYEE_ID'
        });
      }
      
      // Vérifier si l'employé existe
      const employee = await findEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: `Employé ${employeeId} non trouvé`,
          code: 'EMPLOYEE_NOT_FOUND'
        });
      }
      
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      
      // Vérifier les pointages d'aujourd'hui
      const attendanceResult = await db.query(
        `SELECT id, check_in_time, check_out_time, status, hours_worked, record_date
         FROM attendance 
         WHERE employee_id = $1 
           AND record_date = $2
         ORDER BY check_in_time DESC 
         LIMIT 1`,
        [employeeId, today]
      );
      
      let canCheckIn = false;
      let canCheckOut = false;
      let message = '';
      let existingRecord = null;
      let checkInTime = null;
      let checkOutTime = null;
      let hoursWorked = 0;
      let checkoutValidation = { allowed: false };
      
      if (attendanceResult.rows.length === 0) {
        // Aucun pointage aujourd'hui
        canCheckIn = true;
        canCheckOut = false;
        message = 'Non pointé aujourd\'hui';
      } else {
        const attendance = attendanceResult.rows[0];
        checkInTime = attendance.check_in_time;
        checkOutTime = attendance.check_out_time;
        hoursWorked = attendance.hours_worked || 0;
        
        if (checkInTime && !checkOutTime) {
          // Déjà pointé arrivée, pas encore départ
          canCheckIn = false;
          
          // Vérifier le délai minimum pour checkout
          checkoutValidation = await canCheckout(employeeId, requestId);
          canCheckOut = checkoutValidation.allowed;
          
          const checkInFormatted = checkInTime ? checkInTime.slice(0, 5) : '--:--';
          
          if (canCheckOut) {
            message = `Arrivée pointée à ${checkInFormatted} - Départ autorisé`;
          } else {
            const minutesElapsed = checkoutValidation.details?.minutesElapsed || 0;
            const minutesRemaining = checkoutValidation.details?.minutesRemaining || MIN_CHECKIN_DURATION_HOURS * 60;
            message = `Arrivée pointée à ${checkInFormatted} - Attente requise: ${minutesRemaining} minutes`;
          }
          
          existingRecord = {
            id: attendance.id,
            checkIn: checkInTime,
            checkOut: null,
            status: attendance.status,
            recordDate: attendance.record_date
          };
          
        } else if (checkInTime && checkOutTime) {
          // Pointage complet (arrivée + départ)
          canCheckIn = false;
          canCheckOut = false;
          
          const checkInFormatted = checkInTime ? checkInTime.slice(0, 5) : '--:--';
          const checkOutFormatted = checkOutTime ? checkOutTime.slice(0, 5) : '--:--';
          
          message = `Pointage complet: ${checkInFormatted} → ${checkOutFormatted}`;
          existingRecord = {
            id: attendance.id,
            checkIn: checkInTime,
            checkOut: checkOutTime,
            hoursWorked: hoursWorked,
            status: attendance.status,
            recordDate: attendance.record_date
          };
        } else {
          // Cas spécial: check_in_time est NULL
          canCheckIn = true;
          canCheckOut = false;
          message = 'Erreur dans le pointage précédent';
        }
      }
      
      console.log(`📋 [${requestId}] Statut ${employeeId}: ${message}`);
      console.log(`📋 [${requestId}] canCheckIn: ${canCheckIn}, canCheckOut: ${canCheckOut}`);
      
      res.json({
        success: true,
        employee: {
          id: employee.id,
          employee_id: employee.employee_id,
          name: `${employee.first_name} ${employee.last_name}`,
          firstName: employee.first_name,
          lastName: employee.last_name,
          department: employee.department
        },
        attendance: {
          alreadyChecked: !canCheckIn,
          canCheckIn: canCheckIn,
          canCheckOut: canCheckOut,
          message: message,
          existingRecord: existingRecord,
          checkInTime: checkInTime,
          checkOutTime: checkOutTime,
          checkoutValidation: checkoutValidation
        },
        frontend: {
          showCheckInButton: canCheckIn,
          showCheckOutButton: canCheckOut,
          showStatus: true,
          statusColor: canCheckIn ? 'warning' : (canCheckOut ? 'primary' : 'success'),
          statusIcon: canCheckIn ? '⏰' : (canCheckOut ? '🚪' : '✅'),
          employeeInfo: {
            firstName: employee.first_name,
            lastName: employee.last_name,
            fullName: `${employee.first_name} ${employee.last_name}`,
            department: employee.department
          },
          waitMessage: !canCheckOut && checkoutValidation.details ? 
            `Attendez ${checkoutValidation.details.minutesRemaining} minutes` : null,
          nextCheckoutTime: !canCheckOut && checkoutValidation.details ? 
            new Date(now.getTime() + checkoutValidation.details.minutesRemaining * 60 * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : null
        },
        timestamp: now.toISOString()
      });
      
    } catch (error) {
      console.error('❌ Erreur checkAttendanceStatus:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la vérification du statut',
        code: 'SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// ==================== ROUTE POUR POINTAGE MANUEL ====================

// 2. Route pour pointage avec action spécifique
router.post('/attend-with-action',
  authenticateToken,
  flexibleImageUpload,
  async (req, res) => {
    const startTime = Date.now();
    const requestId = `attend_action_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    try {
      const { action, employeeId } = req.body;
      
      console.log(`🎯 [${requestId}] Pointage avec action: ${action} pour ${employeeId || 'auto'}`);
      
      if (!action || (action !== 'checkin' && action !== 'checkout')) {
        return res.status(400).json({
          success: false,
          message: 'Action invalide. Utilisez "checkin" ou "checkout"',
          code: 'INVALID_ACTION'
        });
      }
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Image requise pour la reconnaissance',
          code: 'NO_IMAGE'
        });
      }
      
      // Reconnaissance faciale
      let recognitionResult;
      try {
        recognitionResult = await facialRecognition.recognizeFace(req.file.buffer);
      } catch (recogError) {
        console.error(`❌ [${requestId}] Erreur reconnaissance:`, recogError.message);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la reconnaissance faciale',
          code: 'RECOGNITION_ERROR',
          details: process.env.NODE_ENV === 'development' ? recogError.message : undefined
        });
      }
      
      // Vérifier si visage reconnu
      if (!recognitionResult.recognized) {
        return res.json({
          success: true,
          recognized: false,
          attendanceRecorded: false,
          action: action,
          message: recognitionResult.message || 'Visage non reconnu',
          processingTime: Date.now() - startTime,
          frontend: {
            showRetry: true,
            message: 'Visage non reconnu. Veuillez réessayer.',
            statusColor: 'error'
          }
        });
      }
      
      const recognizedEmployeeId = recognitionResult.match.employeeId;
      const confidence = recognitionResult.match.confidence || 0.85;
      
      // Si employeeId fourni, vérifier qu'il correspond
      if (employeeId && employeeId !== recognizedEmployeeId) {
        console.log(`⚠️ [${requestId}] ID fourni (${employeeId}) ne correspond pas à ID reconnu (${recognizedEmployeeId})`);
        return res.json({
          success: false,
          recognized: true,
          attendanceRecorded: false,
          action: action,
          message: 'L\'employé reconnu ne correspond pas à l\'ID fourni',
          match: {
            employeeId: recognizedEmployeeId,
            employeeName: `${recognitionResult.match.firstName || ''} ${recognitionResult.match.lastName || ''}`,
            firstName: recognitionResult.match.firstName,
            lastName: recognitionResult.match.lastName,
            confidence: confidence
          },
          processingTime: Date.now() - startTime,
          frontend: {
            showError: true,
            message: 'Erreur: employé non correspondant',
            statusColor: 'error'
          }
        });
      }
      
      // Récupérer infos employé
      const employee = await findEmployee(recognizedEmployeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          recognized: true,
          attendanceRecorded: false,
          message: `L'employé ${recognizedEmployeeId} n'a pas été trouvé dans la base de données`,
          code: 'EMPLOYEE_NOT_FOUND',
          frontend: {
            showError: true,
            message: 'Employé non trouvé',
            subMessage: 'Veuillez contacter l\'administration'
          }
        });
      }
      
      const employeeName = `${employee.first_name} ${employee.last_name}`;
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().split(' ')[0].slice(0, 8);
      const currentTimeFormatted = currentTime.slice(0, 5);
      
      // ========== LOGIQUE CHECK-IN ==========
      if (action === 'checkin') {
        console.log(`📅 [${requestId}] Tentative CHECK-IN pour ${recognizedEmployeeId}`);
        
        // Vérifier si déjà check-in aujourd'hui
        const existingCheckIn = await db.query(
          `SELECT id, check_in_time, check_out_time, record_date
           FROM attendance 
           WHERE employee_id = $1 
           AND record_date = $2
           AND check_in_time IS NOT NULL`,
          [recognizedEmployeeId, today]
        );
        
        if (existingCheckIn.rows.length > 0) {
          const existing = existingCheckIn.rows[0];
          const checkInTime = existing.check_in_time;
          const checkInFormatted = checkInTime ? checkInTime.slice(0, 5) : '--:--';
          
          const elapsedTime = Date.now() - startTime;
          
          // Générer les messages personnalisés
          const personalized = generatePersonalizedMessages(employee, 'checkin', checkInTime, {
            key: 'already_checked_in'
          });
          
          return res.json({
            success: true,
            recognized: true,
            attendanceRecorded: false,
            alreadyChecked: true,
            action: 'checkin',
            message: personalized.message,
            userMessage: personalized.userMessage,
            match: {
              employeeId: recognizedEmployeeId,
              employeeName: employeeName,
              firstName: employee.first_name,
              lastName: employee.last_name,
              department: employee.department,
              confidence: confidence
            },
            existingRecord: {
              id: existing.id,
              checkIn: checkInTime,
              checkOut: existing.check_out_time,
              date: today,
              recordDate: existing.record_date
            },
            processingTime: elapsedTime,
            timestamp: now.toISOString(),
            frontend: {
              ...personalized.frontend,
              showCheckOutButton: true,
              showCheckInButton: false,
              status: 'already_checked_in'
            }
          });
        }
        
        // Faire le check-in
        try {
          let status = 'present';
          const hour = now.getHours();
          const minute = now.getMinutes();
          
          if (hour > 9 || (hour === 9 && minute > 15)) {
            status = 'late';
          }
          
          const insertResult = await db.query(
            `INSERT INTO attendance (
              employee_id, 
              check_in_time, 
              record_date,
              status,
              verification_method,
              face_verified,
              face_confidence,
              employee_name,
              //department,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            ON CONFLICT (employee_id, record_date) 
            DO UPDATE SET 
              check_in_time = EXCLUDED.check_in_time,
              status = EXCLUDED.status,
              verification_method = EXCLUDED.verification_method,
              face_verified = EXCLUDED.face_verified,
              face_confidence = EXCLUDED.face_confidence,
              employee_name = EXCLUDED.employee_name,
              department = EXCLUDED.department,
              updated_at = NOW()
            RETURNING id, check_in_time, record_date, status`,
            [
              recognizedEmployeeId,
              currentTime,
              today,
              status,
              'face_recognition',
              true,
              confidence,
              fullEmployeeName,
              employeeName,
              // employee.department
            ]
          );
          
          const attendanceRecord = insertResult.rows[0];
          const elapsedTime = Date.now() - startTime;
          
          console.log(`✅ [${requestId}] Check-in enregistré pour ${recognizedEmployeeId} à ${currentTimeFormatted}`);
          
          // Générer les messages personnalisés
          const personalized = generatePersonalizedMessages(employee, 'checkin', currentTime);
          
          return res.json({
            success: true,
            recognized: true,
            attendanceRecorded: true,
            action: 'checkin',
            message: personalized.message,
            userMessage: personalized.userMessage,
             displayDuration: 2000, // 2 secondes en millisecondes
             autoDismiss: true,
             nextAction: 'wait', // ou 'reset' ou 'show_summary'
            match: {
              employeeId: recognizedEmployeeId,
              employeeName: employeeName,
              firstName: employee.first_name,
              lastName: employee.last_name,
              department: employee.department,
              confidence: confidence
            },
            attendance: {
              id: attendanceRecord.id,
              checkIn: currentTime,
              checkInFormatted: currentTimeFormatted,
              recordDate: attendanceRecord.record_date,
              status: attendanceRecord.status,
              minimumWait: `${MIN_CHECKIN_DURATION_HOURS} heure(s)`
            },
            processingTime: elapsedTime,
            timestamp: now.toISOString(),
            frontend: {
              ...personalized.frontend,
              showSuccess: true,
              duration: 2000, // 2 secondes
              autoHide: true,
              showCheckOutButton: true,
              showCheckInButton: false,
              status: 'checked_in',
              waitMessage: `Attendez ${MIN_CHECKIN_DURATION_HOURS} heure(s) avant de pointer le départ`,
              showSuccess: true
            }
          });
          
        } catch (dbError) {
          console.error(`❌ [${requestId}] Erreur base de données check-in:`, dbError);
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de l\'arrivée',
            code: 'DATABASE_ERROR',
            details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
          });
        }
      }
      
      // ========== LOGIQUE CHECK-OUT (avec vérification délai) ==========
      if (action === 'checkout') {
        console.log(`📅 [${requestId}] Tentative CHECK-OUT pour ${recognizedEmployeeId}`);
        
        // Vérifier si a déjà check-in aujourd'hui
        const existingCheckIn = await db.query(
          `SELECT a.id, a.check_in_time, a.check_out_time, a.record_date, 
                  e.first_name, e.last_name
          FROM attendance a
          JOIN employees e ON a.employee_id = e.employee_id
          WHERE a.employee_id = $1 
            AND a.record_date = $2
            AND a.check_out_time IS NULL
            AND a.check_in_time IS NOT NULL
          ORDER BY a.check_in_time DESC
          LIMIT 1`,
          [recognizedEmployeeId, today]
        );
        
        if (existingCheckIn.rows.length === 0) {
          const anyAttendance = await db.query(
            `SELECT id, check_in_time, check_out_time, record_date
             FROM attendance 
             WHERE employee_id = $1 
             AND record_date = $2
             AND check_in_time IS NOT NULL`,
            [recognizedEmployeeId, today]
          );
          
          const elapsedTime = Date.now() - startTime;
          
          if (anyAttendance.rows.length === 0) {
            return res.json({
              success: false,
              recognized: true,
              attendanceRecorded: false,
              action: 'checkout',
              message: `⚠️ ${employee.first_name} ${employee.last_name}, vous n'avez pas encore pointé votre arrivée aujourd'hui`,
              match: {
                employeeId: recognizedEmployeeId,
                employeeName: employeeName,
                firstName: employee.first_name,
                lastName: employee.last_name,
                department: employee.department,
                confidence: confidence
              },
              processingTime: elapsedTime,
              timestamp: now.toISOString(),
              frontend: {
                showCheckInButton: true,
                showCheckOutButton: false,
                status: 'no_check_in',
                statusColor: 'warning',
                message: 'Arrivée non pointée',
                employeeInfo: {
                  firstName: employee.first_name,
                  lastName: employee.last_name,
                  fullName: employeeName,
                  department: employee.department
                }
              }
            });
          } else {
            const existing = anyAttendance.rows[0];
            const checkOutTime = existing.check_out_time;
            const checkOutFormatted = checkOutTime ? checkOutTime.slice(0, 5) : '--:--';
            
            // Générer les messages personnalisés
            const personalized = generatePersonalizedMessages(employee, 'checkout', checkOutTime, {
              key: 'already_checked_in'
            });
            
            return res.json({
              success: false,
              recognized: true,
              attendanceRecorded: false,
              action: 'checkout',
              message: personalized.message,
              userMessage: personalized.userMessage,
              match: {
                employeeId: recognizedEmployeeId,
                employeeName: employeeName,
                firstName: employee.first_name,
                lastName: employee.last_name,
                department: employee.department,
                confidence: confidence
              },
              existingRecord: {
                checkOut: checkOutTime,
                recordDate: existing.record_date
              },
              processingTime: elapsedTime,
              timestamp: now.toISOString(),
              frontend: {
                ...personalized.frontend,
                showCheckOutButton: false,
                showCheckInButton: false,
                status: 'already_checked_out'
              }
            });
          }
        }
        
        // Vérifier le délai minimum
        const checkoutValidation = await canCheckout(recognizedEmployeeId, requestId);
        
        if (!checkoutValidation.allowed) {
          const attendance = existingCheckIn.rows[0];
          const checkInFormatted = attendance.check_in_time ? attendance.check_in_time.slice(0, 5) : '--:--';
          const elapsedTime = Date.now() - startTime;
          
          // Générer les messages personnalisés
          const personalized = generatePersonalizedMessages(employee, 'checkout', currentTime, {
            key: 'checkout_waiting',
            minutesRemaining: checkoutValidation.details?.minutesRemaining
          });
          
          return res.json({
            success: false,
            recognized: true,
            attendanceRecorded: false,
            action: 'checkout',
            message: personalized.message,
            userMessage: personalized.userMessage,
            match: {
              employeeId: recognizedEmployeeId,
              employeeName: employeeName,
              firstName: employee.first_name,
              lastName: employee.last_name,
              department: employee.department,
              confidence: confidence
            },
            validation: checkoutValidation,
            processingTime: elapsedTime,
            timestamp: now.toISOString(),
            frontend: {
              ...personalized.frontend,
              showCheckOutButton: false,
              showCheckInButton: false,
              status: 'checked_in_waiting',
              waitMessage: `Départ autorisé dans ${checkoutValidation.details?.minutesRemaining || MIN_CHECKIN_DURATION_HOURS*60} minutes`
            }
          });
        }
        
        // Faire le check-out (délai respecté)
        try {
          const attendance = existingCheckIn.rows[0];
          const employeeName = `${attendance.first_name} ${attendance.last_name}`;
          
          let hoursWorked = 0;
          if (attendance.check_in_time) {
            const [inHour, inMinute, inSecond] = attendance.check_in_time.split(':').map(Number);
            const [outHour, outMinute, outSecond] = currentTime.split(':').map(Number);
            const totalMinutes = (outHour * 60 + outMinute) - (inHour * 60 + inMinute);
            if (totalMinutes > 0) {
              hoursWorked = (totalMinutes / 60).toFixed(2);
            }
          }
          
          const updateResult = await db.query(
            `UPDATE attendance 
             SET 
               check_out_time = $1,
               hours_worked = $2,
               status = 'completed',
               verification_method = 'face_recognition',
               updated_at = NOW()
             WHERE id = $3
             RETURNING id, check_out_time, hours_worked, record_date`,
            [currentTime, hoursWorked, attendance.id]
          );
          
          const updatedRecord = updateResult.rows[0];
          const elapsedTime = Date.now() - startTime;
          
          const checkInFormatted = attendance.check_in_time ? attendance.check_in_time.slice(0, 5) : '--:--';
          
          console.log(`✅ [${requestId}] Check-out enregistré pour ${recognizedEmployeeId} à ${currentTimeFormatted}`);
          
          // Générer les messages personnalisés
          const personalized = generatePersonalizedMessages(employee, 'checkout', currentTime);
          
          return res.json({
            success: true,
            recognized: true,
            attendanceRecorded: true,
            action: 'checkout',
            message: personalized.message,
            userMessage: personalized.userMessage,
            match: {
              employeeId: recognizedEmployeeId,
              employeeName: employeeName,
              firstName: employee.first_name,
              lastName: employee.last_name,
              department: employee.department,
              confidence: confidence
            },
            attendance: {
              id: updatedRecord.id,
              checkIn: attendance.check_in_time,
              checkInFormatted: checkInFormatted,
              checkOut: currentTime,
              checkOutFormatted: currentTimeFormatted,
              hoursWorked: updatedRecord.hours_worked,
              recordDate: updatedRecord.record_date,
              duration: `${hoursWorked} heures`
            },
            processingTime: elapsedTime,
            timestamp: now.toISOString(),
            frontend: {
              ...personalized.frontend,
              showCheckOutButton: false,
              showCheckInButton: false,
              status: 'checked_out',
              showSummary: true,
              summary: {
                employeeName: employeeName,
                arrivedAt: checkInFormatted,
                leftAt: currentTimeFormatted,
                hoursWorked: `${updatedRecord.hours_worked} heures`,
                duration: `${hoursWorked} heures`
              }
            }
          });
          
        } catch (dbError) {
          console.error(`❌ [${requestId}] Erreur base de données check-out:`, dbError);
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement du départ',
            code: 'DATABASE_ERROR',
            details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
          });
        }
      }
      
    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      console.error(`❌ [${requestId}] Erreur générale:`, error.message);
      
      return res.status(500).json({
        success: false,
        error: 'ATTENDANCE_ERROR',
        message: 'Erreur lors du pointage',
        processingTime: elapsedTime,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// ==================== ROUTE CHECKOUT AVEC VÉRIFICATION DÉLAI ====================

router.post('/checkout',
  authenticateToken,
  async (req, res) => {
    const startTime = Date.now();
    const requestId = `checkout_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    try {
      const { employeeId } = req.body;
      
      console.log(`🚪 [${requestId}] CHECKOUT - Départ pour ${employeeId}`);
      
      if (!employeeId) {
        return res.status(400).json({
          success: false,
          message: 'ID employé requis',
          code: 'MISSING_EMPLOYEE_ID'
        });
      }
      
      // Vérifier si l'employé existe
      const employee = await findEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: `Employé ${employeeId} non trouvé`,
          code: 'EMPLOYEE_NOT_FOUND'
        });
      }
      
      // Vérifier le délai minimum
      const checkoutValidation = await canCheckout(employeeId, requestId);
      
      if (!checkoutValidation.allowed) {
        return res.status(400).json({
          success: false,
          message: checkoutValidation.message || 'Checkout non autorisé',
          code: checkoutValidation.reason || 'CHECKOUT_NOT_ALLOWED',
          validation: checkoutValidation,
          frontend: {
            showWarning: true,
            message: checkoutValidation.details ? 
              `⏳ ${employee.first_name}, attendez encore ${checkoutValidation.details.minutesRemaining} minutes` : 
              `⚠️ ${employee.first_name}, checkout non autorisé`,
            employeeInfo: {
              firstName: employee.first_name,
              lastName: employee.last_name,
              fullName: `${employee.first_name} ${employee.last_name}`
            },
            waitTime: checkoutValidation.details?.minutesRemaining
          }
        });
      }
      
      // Checkout autorisé
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentTime = now.toTimeString().split(' ')[0].slice(0, 8);
      const currentTimeFormatted = currentTime.slice(0, 5);
      
      // Récupérer le pointage en cours
      const existingAttendance = await db.query(
        `SELECT id, check_in_time
         FROM attendance 
         WHERE employee_id = $1 
           AND record_date = $2
           AND check_in_time IS NOT NULL
           AND check_out_time IS NULL
         ORDER BY check_in_time DESC 
         LIMIT 1`,
        [employeeId, today]
      );
      
      if (existingAttendance.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Aucun pointage d\'arrivée trouvé pour aujourd\'hui',
          code: 'NO_CHECK_IN_FOUND',
          frontend: {
            showError: true,
            message: `${employee.first_name}, aucun pointage d'arrivée trouvé`,
            employeeInfo: {
              firstName: employee.first_name,
              lastName: employee.last_name
            }
          }
        });
      }
      
      const attendanceRecord = existingAttendance.rows[0];
      const checkInTime = attendanceRecord.check_in_time;
      
      // Calculer les heures travaillées
      let hoursWorked = 0;
      if (checkInTime) {
        const [inHour, inMinute] = checkInTime.split(':').map(Number);
        const [outHour, outMinute] = currentTime.split(':').map(Number);
        const totalMinutes = (outHour * 60 + outMinute) - (inHour * 60 + inMinute);
        if (totalMinutes > 0) {
          hoursWorked = (totalMinutes / 60).toFixed(2);
        }
      }
      
      // Enregistrer le départ
      const updateResult = await db.query(
        `UPDATE attendance 
         SET check_out_time = $1, 
             status = 'completed',
             hours_worked = $2,
             updated_at = NOW()
         WHERE id = $3 
         RETURNING id, check_in_time, check_out_time, status, hours_worked, record_date`,
        [currentTime, hoursWorked, attendanceRecord.id]
      );
      
      const updatedRecord = updateResult.rows[0];
      const elapsedTime = Date.now() - startTime;
      
      const checkInFormatted = checkInTime ? checkInTime.slice(0, 5) : '--:--';
      
      console.log(`✅ [${requestId}] Départ enregistré avec succès pour ${employeeId} en ${elapsedTime}ms`);
      
      // Générer les messages personnalisés
      const personalized = generatePersonalizedMessages(employee, 'checkout', currentTime);
      
      res.json({
        success: true,
        message: personalized.message,
        userMessage: personalized.userMessage,
        attendance: {
          id: updatedRecord.id,
          checkInTime: checkInTime,
          checkOutTime: currentTime,
          checkInFormatted: checkInFormatted,
          checkOutFormatted: currentTimeFormatted,
          hoursWorked: hoursWorked,
          totalHours: hoursWorked,
          status: 'completed',
          recordDate: updatedRecord.record_date,
          duration: `${hoursWorked} heures`
        },
        employee: {
          id: employee.id,
          employee_id: employee.employee_id,
          name: `${employee.first_name} ${employee.last_name}`,
          firstName: employee.first_name,
          lastName: employee.last_name,
          department: employee.department
        },
        validation: {
          minimumDurationRespected: true,
          minimumHours: MIN_CHECKIN_DURATION_HOURS,
          actualHours: (checkoutValidation.details?.timeElapsedHours || 0).toFixed(2)
        },
        frontend: {
          ...personalized.frontend,
          showSuccess: true,
          showSummary: true,
          summary: {
            employeeName: `${employee.first_name} ${employee.last_name}`,
            arrivedAt: checkInFormatted,
            leftAt: currentTimeFormatted,
            hoursWorked: `${hoursWorked} heures`,
            status: 'completed'
          },
          animation: 'success'
        },
        timestamp: now.toISOString(),
        processing: {
          time: elapsedTime,
          checkInFound: true,
          checkOutRecorded: true,
          hoursCalculated: true
        }
      });
      
    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      console.error(`❌ [${requestId}] Erreur checkout:`, error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors du pointage de départ',
        code: 'SERVER_ERROR',
        processingTime: elapsedTime
      });
    }
  }
);

// ==================== NOUVELLE MÉTHODE : ENREGISTRER MULTIPLES PHOTOS ====================

const registerMultiplePhotos = async (req, res) => {
  const startTime = Date.now();
  const requestId = `regmulti_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  console.log(`📸 [${requestId}] ENREGISTREMENT MULTIPLE DE VISAGE`);
  
  try {
    const { employeeId } = req.body;
    const files = req.images; // TABLEAU de photos
    
    console.log(`👤 [${requestId}] Employé: ${employeeId}`);
    console.log(`📷 [${requestId}] ${files ? files.length : 0} photos reçues`);

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_EMPLOYEE_ID',
        message: 'employeeId requis'
      });
    }
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'NO_PHOTOS',
        message: 'Au moins une photo est requise'
      });
    }

    // Vérifier employé
    const employee = await findEmployee(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'EMPLOYEE_NOT_FOUND',
        message: `Employé ${employeeId} non trouvé`
      });
    }

    if (!employee.is_active) {
      return res.status(400).json({
        success: false,
        error: 'EMPLOYEE_INACTIVE',
        message: `Employé ${employeeId} est inactif`
      });
    }

    const results = {
      total: files.length,
      successful: 0,
      failed: 0,
      photos: []
    };

    // 📊 Enregistrer CHAQUE photo
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const photoId = `photo_${i+1}`;
      
      console.log(`   🔄 [${requestId}] Traitement ${photoId} (${file.size} bytes)`);

      try {
        // Appeler le service d'enregistrement pour chaque photo
        const result = await facialRecognition.registerFace(employeeId, file.buffer);
        
        if (!result.success) {
          throw new Error(result.message || 'Échec enregistrement');
        }
        
        results.successful++;
        results.photos.push({
          id: photoId,
          index: i,
          filename: file.originalname,
          size: file.size,
          type: file.mimetype,
          success: true,
          service: 'realFacialRecognition',
          descriptorLength: result.descriptorLength,
          detector: result.detector || 'ssd'
        });
        
        console.log(`   ✅ [${requestId}] ${photoId} traité avec succès`);

      } catch (photoError) {
        console.error(`   ❌ [${requestId}] Échec ${photoId}:`, photoError.message);
        results.failed++;
        results.photos.push({
          id: photoId,
          index: i,
          filename: file.originalname,
          size: file.size,
          type: file.mimetype,
          success: false,
          error: photoError.message
        });
      }
    }

    // 💾 Mettre à jour la base de données
    console.log(`   💾 [${requestId}] Mise à jour base de données pour ${employeeId}`);
    
    try {
      await updateFaceRegistration(employeeId, true, results.successful);
      
      // Mettre à jour les statistiques de face encoding
      await db.query(
        `INSERT INTO face_encoding_stats (employee_id, total_photos, successful_registrations, failed_registrations, registration_date)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (employee_id) 
         DO UPDATE SET 
           total_photos = $2,
           successful_registrations = $3,
           failed_registrations = $4,
           updated_at = NOW()`,
        [employeeId, results.total, results.successful, results.failed]
      );

      const elapsedTime = Date.now() - startTime;
      
      // ✅ SUCCÈS
      return res.json({
        success: true,
        requestId: requestId,
        employee: {
          id: employee.id,
          employee_id: employee.employee_id,
          name: `${employee.first_name} ${employee.last_name}`,
          firstName: employee.first_name,
          lastName: employee.last_name,
          department: employee.department,
          has_face_registered: true,
          face_descriptors_count: results.successful,
          face_encoding_date: new Date().toISOString()
        },
        registration: {
          photosProcessed: results.total,
          successful: results.successful,
          failed: results.failed,
          successRate: results.total > 0 ? ((results.successful / results.total) * 100).toFixed(2) + '%' : '0%',
          recommendation: results.successful >= 3 
            ? '✅ Photos suffisantes pour une bonne reconnaissance'
            : results.successful >= 2
            ? '⚠️ Recommandé: prendre 1-2 photos supplémentaires'
            : '❌ Recommandé: prendre 3-5 photos pour une reconnaissance fiable'
        },
        details: {
          photos: results.photos,
          totalDescriptors: results.successful,
          averageConfidence: 'Calculé lors de la reconnaissance',
          bestPractice: 'Prendre des photos sous différents angles pour meilleure précision'
        },
        message: `Enregistrement facial réussi pour ${employee.first_name} ${employee.last_name} avec ${results.successful}/${results.total} photos`,
        processingTime: elapsedTime + 'ms',
        timestamp: new Date().toISOString(),
        tips: [
          `✅ ${employee.first_name}, votre enregistrement facial est terminé !`,
          '• Pour une meilleure reconnaissance:',
          '  - 3-5 photos sous différents angles',
          '  - Assurez un bon éclairage',
          '  - Gardez une expression neutre',
          '  - Positionnez-vous face à la caméra'
        ]
      });

    } catch (dbError) {
      console.error(`❌ [${requestId}] Erreur base de données:`, dbError);
      throw dbError;
    }

  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    console.error(`❌ [${requestId}] Erreur générale registerMultiplePhotos:`, error.message);
    
    res.status(500).json({
      success: false,
      error: 'REGISTRATION_ERROR',
      message: 'Erreur lors de l\'enregistrement facial multiple',
      details: error.message,
      processingTime: elapsedTime + 'ms'
    });
  }
};

// ==================== ROUTES DE SANTÉ ET DEBUG ====================

// Route health
router.get('/health', (req, res) => {
  try {
    const stats = facialRecognition.getStatistics ? facialRecognition.getStatistics() : {};
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'facial-recognition-optimized-with-minimum-duration',
      configuration: {
        MIN_CHECKIN_DURATION_HOURS: MIN_CHECKIN_DURATION_HOURS,
        MIN_CHECKIN_DURATION_MS: MIN_CHECKIN_DURATION_MS
      },
      capabilities: {
        register: typeof facialRecognition.registerFace === 'function',
        registerMultiple: 'ACTIVE',
        recognize: typeof facialRecognition.recognizeFace === 'function',
        recognizeAndAttend: 'SYSTEME AUTOMATIQUE AVEC DÉLAI MINIMUM ET NOM PERSONNALISÉ',
        checkRegistration: typeof facialRecognition.checkRegistration === 'function',
        deleteRegistration: typeof facialRecognition.deleteRegistration === 'function'
      },
      stats: {
        registeredFaces: facialRecognition.getRegisteredFaces ? facialRecognition.getRegisteredFaces().length : 0,
        modelsLoaded: stats.modelsLoaded || false,
        mode: stats.mode || 'ultra-optimized',
        detector: stats.detector || 'TinyFaceDetector + SSD fallback',
        performance: stats.performance || {}
      },
      features: [
        'Enregistrement multiple (3-5 photos)',
        'Reconnaissance optimisée', 
        'Cache mémoire',
        'Système automatique avec délai minimum (NOUVEAU)',
        `Délai minimum checkin→checkout: ${MIN_CHECKIN_DURATION_HOURS} heure(s)`,
        'Gestion intelligente des pointages',
        'Messages personnalisés avec nom et prénom (NOUVEAU)'
      ],
      routes: {
        status: 'GET /attendance-status/:employeeId',
        attendWithAction: 'POST /attend-with-action (2 boutons)',
        recognizeAndAttend: 'POST /recognize-and-attend (SYSTEME AUTOMATIQUE AVEC NOM)',
        checkout: 'POST /checkout',
        registerMultiple: 'POST /register-multiple',
        health: 'GET /health'
      },
      automaticSystem: {
        enabled: true,
        description: 'Système automatique avec délai minimum et messages personnalisés',
        logic: [
          '1. Reconnaissance faciale → identifie l\'employé',
          '2. Vérifie le statut actuel → a-t-il pointé aujourd\'hui?',
          '3. Vérifie délai minimum → 1 heure minimum entre checkin et checkout',
          '4. Messages personnalisés avec nom et prénom de l\'employé',
          '5. Décision intelligente:',
          '   • Aucun pointage → CHECKIN',
          '   • Arrivée pointée + délai respecté → CHECKOUT', 
          '   • Arrivée pointée + délai NON respecté → Message attente',
          '   • Pointage complet → Message d\'information'
        ],
        benefits: [
          'Simple: une seule action pour tout',
          'Intelligent: comprend le contexte',
          'Professionnel: délai minimum respecté',
          'Personnel: messages avec nom et prénom',
          'User-friendly: messages clairs'
        ]
      },
      twoButtonSystem: {
        enabled: true,
        description: 'Alternative avec boutons séparés'
      }
    });
  } catch (error) {
    console.error('❌ Erreur route health:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

// ==================== NOUVELLE ROUTE : ENREGISTRER MULTIPLES PHOTOS ====================

router.post('/register-multiple',
  authenticateToken,
  authorizeRoles(['admin', 'manager']),
  flexibleMultipleImageUpload,
  registerMultiplePhotos
);

// Enregistrer un visage (UNE SEULE photo - pour compatibilité)
router.post('/register',
  authenticateToken,
  authorizeRoles(['admin', 'manager']),
  flexibleImageUpload,
  async (req, res) => {
    const startTime = Date.now();
    try {
      console.log('📸 Route /register (single) appelée');
      
      const { employeeId } = req.body;
      
      if (!employeeId) {
        return res.status(400).json({
          success: false,
          message: 'employeeId requis'
        });
      }
      
      // Vérifier l'employé
      const employee = await findEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: `Employé ${employeeId} non trouvé`
        });
      }
      
      if (!employee.is_active) {
        return res.status(400).json({
          success: false,
          message: `Employé ${employeeId} est inactif`
        });
      }
      
      console.log(`📸 Enregistrement pour ${employeeId} - ${employee.first_name} ${employee.last_name}`);
      
      // Enregistrer le visage
      const result = await facialRecognition.registerFace(employeeId, req.file.buffer);
      const processingTime = Date.now() - startTime;
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
          processingTime: processingTime + 'ms'
        });
      }
      
      // Mettre à jour la base
      await updateFaceRegistration(employeeId, true, 1);
      
      console.log(`✅ Visage enregistré en ${processingTime}ms`);
      
      res.json({
        success: true,
        message: `Visage enregistré avec succès pour ${employee.first_name} ${employee.last_name}`,
        employee: {
          id: employee.id,
          employee_id: employee.employee_id,
          name: `${employee.first_name} ${employee.last_name}`,
          firstName: employee.first_name,
          lastName: employee.last_name,
          department: employee.department,
          has_face_registered: true,
          face_descriptors_count: 1
        },
        recommendation: 'Pour une meilleure reconnaissance, utilisez /register-multiple avec 3-5 photos',
        processingTime: processingTime + 'ms',
        descriptorLength: result.descriptorLength,
        detector: result.detector || 'ssd-precise',
        nextSteps: [
          `✅ ${employee.first_name}, votre photo est enregistrée`,
          '⚠️ Pour améliorer la précision:',
          '   • Utilisez /register-multiple avec 3-5 photos',
          '   • Photos sous différents angles',
          '   • Bon éclairage requis'
        ]
      });
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('❌ Erreur enregistrement:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur enregistrement: ' + error.message,
        processingTime: processingTime + 'ms'
      });
    }
  }
);

// Reconnaître un visage (simple)
router.post('/recognize',
  flexibleImageUpload,
  async (req, res) => {
    const startTime = Date.now();
    try {
      console.log('🔍 Route /recognize appelée');
      
      if (typeof facialRecognition.recognizeFace !== 'function') {
        return res.status(500).json({
          success: false,
          message: 'Service non disponible'
        });
      }
      
      const result = await facialRecognition.recognizeFace(req.file.buffer);
      const processingTime = Date.now() - startTime;
      
      // Ajouter infos employé si reconnu
      if (result.recognized) {
        const employee = await findEmployee(result.match.employeeId);
        if (employee) {
          result.employee = {
            id: employee.id,
            employee_id: employee.employee_id,
            name: `${employee.first_name} ${employee.last_name}`,
            firstName: employee.first_name,
            lastName: employee.last_name,
            department: employee.department
          };
          
          // Ajouter message personnalisé
          result.personalizedMessage = `Bonjour ${employee.first_name} ${employee.last_name} ! Vous avez été reconnu avec ${result.match.confidence ? Math.round(result.match.confidence * 100) : 85}% de confiance.`;
          result.frontend = {
            showSuccess: true,
            message: `Bonjour ${employee.first_name} !`,
            subMessage: `Reconnu avec ${result.match.confidence ? Math.round(result.match.confidence * 100) : 85}% de confiance`,
            employeeInfo: {
              firstName: employee.first_name,
              lastName: employee.last_name,
              fullName: `${employee.first_name} ${employee.last_name}`,
              department: employee.department
            }
          };
        }
      }
      
      res.json({
        ...result,
        processingTime: processingTime + 'ms',
        performance: {
          time: processingTime + 'ms',
          detector: result.detector || 'unknown',
          attempts: result.attempts || 1,
          optimization: 'TinyFaceDetector + SSD fallback'
        }
      });
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('❌ Erreur reconnaissance:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur reconnaissance: ' + error.message,
        processingTime: processingTime + 'ms'
      });
    }
  }
);

// Vérifier enregistrement
router.get('/check/:employeeId',
  authenticateToken,
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      console.log(`🔍 Vérification pour ${employeeId}`);
      
      const employee = await findEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: `Employé ${employeeId} non trouvé`
        });
      }
      
      // Vérifier dans la base
      const faceResult = await db.query(
        'SELECT face_encoding_date, has_face_registered, face_descriptors_count FROM employees WHERE employee_id = $1',
        [employeeId]
      );
      
      const hasFaceRegistered = faceResult.rows.length > 0 && 
                               faceResult.rows[0].face_encoding_date !== null &&
                               faceResult.rows[0].has_face_registered === true;
      
      const descriptorsCount = faceResult.rows[0]?.face_descriptors_count || 0;
      
      // Vérifier dans le service
      let serviceResult = { hasFaceRegistered: false };
      try {
        if (typeof facialRecognition.checkRegistration === 'function') {
          serviceResult = await facialRecognition.checkRegistration(employeeId);
        }
      } catch (serviceError) {
        console.error('⚠️ Erreur service checkRegistration:', serviceError);
      }
      
      const isRegistered = hasFaceRegistered || serviceResult.hasFaceRegistered;
      
      res.json({
        success: true,
        employee: {
          id: employee.id,
          employee_id: employee.employee_id,
          name: `${employee.first_name} ${employee.last_name}`,
          firstName: employee.first_name,
          lastName: employee.last_name,
          has_face_registered: isRegistered,
          face_descriptors_count: descriptorsCount,
          registration_date: faceResult.rows[0]?.face_encoding_date || serviceResult.registrationDate,
          is_active: employee.is_active
        },
        recommendations: {
          status: isRegistered 
            ? descriptorsCount >= 3 
              ? `✅ ${employee.first_name}, bon enregistrement` 
              : descriptorsCount > 0 
                ? `⚠️ ${employee.first_name}, amélioration possible` 
                : `❌ ${employee.first_name}, enregistrement minimal`
            : `❌ ${employee.first_name}, non enregistré`,
          action: descriptorsCount < 3 && isRegistered
            ? `Utilisez /register-multiple pour ajouter des photos pour ${employee.first_name}`
            : !isRegistered
            ? `Utilisez /register ou /register-multiple pour l'enregistrement de ${employee.first_name}`
            : `Aucune action requise pour ${employee.first_name}`
        },
        sources: {
          database: hasFaceRegistered,
          service: serviceResult.hasFaceRegistered,
          descriptors_count: descriptorsCount
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur vérification:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur vérification: ' + error.message
      });
    }
  }
);

// Supprimer enregistrement
router.delete('/:employeeId',
  authenticateToken,
  authorizeRoles(['admin']),
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      console.log(`🗑️ Suppression pour ${employeeId}`);
      
      const employee = await findEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: `Employé ${employeeId} non trouvé`
        });
      }
      
      if (typeof facialRecognition.deleteRegistration !== 'function') {
        return res.status(500).json({
          success: false,
          message: 'Service non disponible'
        });
      }
      
      // Supprimer du service
      const serviceResult = await facialRecognition.deleteRegistration(employeeId);
      
      if (!serviceResult.success) {
        return res.status(400).json(serviceResult);
      }
      
      // Mettre à jour la base
      await db.query(
        `UPDATE employees 
         SET face_encoding_date = NULL, 
             has_face_registered = false,
             face_descriptors_count = 0,
             updated_at = NOW() 
         WHERE employee_id = $1`,
        [employeeId]
      );
      
      // Supprimer les stats
      await db.query(
        'DELETE FROM face_encoding_stats WHERE employee_id = $1',
        [employeeId]
      );
      
      res.json({
        success: true,
        message: `Enregistrement facial supprimé pour ${employee.first_name} ${employee.last_name}`,
        employee: {
          id: employee.id,
          employee_id: employee.employee_id,
          name: `${employee.first_name} ${employee.last_name}`,
          firstName: employee.first_name,
          lastName: employee.last_name,
          has_face_registered: false,
          face_descriptors_count: 0
        },
        deleted_from: ['service', 'database', 'stats']
      });
      
    } catch (error) {
      console.error('❌ Erreur suppression:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur suppression: ' + error.message
      });
    }
  }
);

// Statistiques
router.get('/stats',
  authenticateToken,
  authorizeRoles(['admin', 'manager']),
  async (req, res) => {
    try {
      console.log('📊 Statistiques');
      
      // Statistiques base
      const dbStats = await db.query(`
        SELECT 
          COUNT(*) as total_employees,
          COUNT(CASE WHEN face_encoding_date IS NOT NULL AND has_face_registered = true THEN 1 END) as employees_with_face,
          SUM(face_descriptors_count) as total_descriptors,
          AVG(face_descriptors_count) FILTER (WHERE face_descriptors_count > 0) as avg_descriptors_per_employee,
          COUNT(CASE WHEN face_descriptors_count >= 3 THEN 1 END) as well_registered
        FROM employees 
        WHERE is_active = true
      `);
      
      const stats = dbStats.rows[0];
      const totalEmployees = parseInt(stats.total_employees) || 0;
      const withFace = parseInt(stats.employees_with_face) || 0;
      const totalDescriptors = parseInt(stats.total_descriptors) || 0;
      const wellRegistered = parseInt(stats.well_registered) || 0;
      const avgDescriptors = parseFloat(stats.avg_descriptors_per_employee) || 0;
      
      // Statistiques service
      const registeredFaces = facialRecognition.getRegisteredFaces ? facialRecognition.getRegisteredFaces() : [];
      const serviceStats = facialRecognition.getStatistics ? facialRecognition.getStatistics() : {};
      
      // Détails d'enregistrement
      const registrationDetails = await db.query(`
        SELECT 
          COUNT(*) as total_registrations,
          AVG(total_photos) as avg_photos_per_registration,
          SUM(successful_registrations) as total_successful_photos,
          SUM(failed_registrations) as total_failed_photos
        FROM face_encoding_stats
      `);
      
      const regDetails = registrationDetails.rows[0];
      
      // Statistiques pointage aujourd'hui
      const today = new Date().toISOString().split('T')[0];
      const attendanceStats = await db.query(
        `SELECT 
          COUNT(*) as total_today,
          COUNT(CASE WHEN check_out_time IS NOT NULL THEN 1 END) as completed_today,
          COUNT(CASE WHEN check_out_time IS NULL THEN 1 END) as pending_checkout,
          AVG(hours_worked) as avg_hours_worked
        FROM attendance 
        WHERE record_date = $1`,
        [today]
      );
      
      const todayStats = attendanceStats.rows[0];
      
      res.json({
        success: true,
        employees: {
          total: totalEmployees,
          with_face: withFace,
          without_face: totalEmployees - withFace,
          well_registered: wellRegistered,
          needs_more_photos: withFace - wellRegistered,
          coverage: totalEmployees > 0 ? ((withFace / totalEmployees) * 100).toFixed(2) + '%' : '0%',
          quality_rate: withFace > 0 ? ((wellRegistered / withFace) * 100).toFixed(2) + '%' : '0%'
        },
        descriptors: {
          total: totalDescriptors,
          average_per_employee: avgDescriptors.toFixed(2),
          recommendation: avgDescriptors < 3 ? 'Amélioration nécessaire' : 'Niveau optimal',
          breakdown: {
            optimal: '≥ 3 descripteurs',
            good: '2 descripteurs', 
            minimal: '1 descripteur'
          }
        },
        attendance_today: {
          total: parseInt(todayStats.total_today) || 0,
          completed: parseInt(todayStats.completed_today) || 0,
          pending_checkout: parseInt(todayStats.pending_checkout) || 0,
          average_hours: todayStats.avg_hours_worked ? parseFloat(todayStats.avg_hours_worked).toFixed(2) + 'h' : '0h'
        },
        registration_quality: {
          avg_photos_per_registration: parseFloat(regDetails.avg_photos_per_registration || 0).toFixed(2),
          success_rate: regDetails.total_successful_photos > 0 
            ? ((regDetails.total_successful_photos / (parseInt(regDetails.total_successful_photos) + parseInt(regDetails.total_failed_photos))) * 100).toFixed(2) + '%'
            : '0%'
        },
        service: {
          registered_faces: registeredFaces.length,
          models_loaded: serviceStats.modelsLoaded || false,
          detector: serviceStats.detector || 'TinyFaceDetector + SSD',
          mode: serviceStats.mode || 'ultra-optimized',
          performance: serviceStats.performance || '2-3 secondes (optimisé)'
        },
        configuration: {
          MIN_CHECKIN_DURATION_HOURS: MIN_CHECKIN_DURATION_HOURS,
          description: `Délai minimum entre checkin et checkout: ${MIN_CHECKIN_DURATION_HOURS} heure(s)`
        },
        optimization: {
          primary: 'TinyFaceDetector (10x plus rapide)',
          fallback: 'SSD si nécessaire',
          attempts: '3 configurations différentes',
          target: '2-3 secondes pour 95% des reconnaissances',
          multiple_registration: 'Activé (3-5 photos recommandées)',
          arrival_departure: 'Gestion automatique avec délai minimum (NOUVEAU)',
          automatic_system: 'Activé avec /recognize-and-attend',
          personalized_messages: 'Activé - Affichage nom et prénom sur écran'
        },
        timestamp: new Date().toISOString(),
        recommendations: [
          '✅ Pour améliorer la reconnaissance:',
          '• Utilisez /register-multiple avec 3-5 photos',
          '• Photos sous angles variés',
          '• Bon éclairage et fond neutre',
          '• Expression faciale naturelle',
          '✅ Système de pointage amélioré:',
          `• Délai minimum checkin→checkout: ${MIN_CHECKIN_DURATION_HOURS} heure(s)`,
          '• POST /recognize-and-attend → gère automatiquement avec délai minimum',
          '• Affichage du nom et prénom de l\'employé sur l\'écran',
          '• Le système comprend votre statut et agit intelligemment'
        ]
      });
      
    } catch (error) {
      console.error('❌ Erreur stats:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur statistiques: ' + error.message
      });
    }
  }
);

// ==================== ROUTES DE TEST ====================

// Test upload multiple
router.post('/test-upload-multiple',
  flexibleMultipleImageUpload,
  (req, res) => {
    res.json({
      success: true,
      message: 'Upload multiple test réussi',
      uploadInfo: {
        totalFiles: req.images.length,
        files: req.images.map((file, index) => ({
          index: index + 1,
          fieldName: file.fieldname,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype
        }))
      }
    });
  }
);

// Test upload single
router.post('/test-upload',
  flexibleImageUpload,
  (req, res) => {
    res.json({
      success: true,
      message: 'Upload test réussi',
      uploadInfo: {
        fieldUsed: req.file.fieldname,
        fileName: req.file.originalname,
        fileSize: req.file.size
      }
    });
  }
);

// Configuration
router.get('/config', (req, res) => {
  res.json({
    success: true,
    service: 'facial-recognition-optimized-with-minimum-duration-and-personalized-messages',
    version: '3.2.0',
    configuration: {
      MIN_CHECKIN_DURATION_HOURS: MIN_CHECKIN_DURATION_HOURS,
      MIN_CHECKIN_DURATION_MS: MIN_CHECKIN_DURATION_MS,
      description: `Délai minimum obligatoire entre checkin et checkout: ${MIN_CHECKIN_DURATION_HOURS} heure(s)`
    },
    tableStructure: {
      attendance: {
        check_in_time: 'time without time zone',
        check_out_time: 'time without time zone',
        record_date: 'date (NOT NULL)',
        attendance_date: 'date (nullable - legacy)',
        important: 'Utilisez record_date pour toutes les requêtes par date'
      }
    },
    uploadConfig: {
      single: {
        mode: 'flexible',
        maxFileSize: '10MB',
        maxFiles: 1
      },
      multiple: {
        mode: 'flexible-multiple',
        maxFileSize: '10MB per file',
        maxFiles: 5,
        recommendation: '3-5 photos optimales'
      }
    },
    optimization: {
      detector: 'TinyFaceDetector (primary) + SSD (fallback)',
      strategy: '3 attempts with different configurations',
      targetSpeed: '2-3 seconds',
      features: [
        'Intelligent detection',
        'Memory cache', 
        'Automatic fallback',
        'Multiple face registration',
        'Automatic arrival/departure management with minimum duration',
        'Personalized messages with employee name (NEW)'
      ]
    },
    automaticSystem: {
      enabled: true,
      route: 'POST /recognize-and-attend',
      description: `Système intelligent avec délai minimum de ${MIN_CHECKIN_DURATION_HOURS} heure(s) et messages personnalisés`,
      workflow: [
        '1. Reconnaissance faciale → identifie l\'employé',
        '2. Vérification statut → regarde s\'il a déjà pointé',
        `3. Vérification délai → ${MIN_CHECKIN_DURATION_HOURS} heure(s) minimum entre checkin et checkout`,
        '4. Messages personnalisés avec nom et prénom de l\'employé',
        '5. Action intelligente:',
        '   • Non pointé → enregistre l\'arrivée (CHECKIN)',
        '   • Arrivée pointée + délai respecté → enregistre le départ (CHECKOUT)',
        '   • Arrivée pointée + délai NON respecté → message d\'attente',
        '   • Pointage complet → message informatif'
      ],
      benefits: [
        'Simple: une seule action pour l\'utilisateur',
        'Intelligent: comprend le contexte',
        'Professionnel: délai minimum respecté',
        'Personnel: messages avec nom et prénom',
        'Robuste: évite les doublons',
        'User-friendly: messages clairs'
      ]
    },
    twoButtonSystem: {
      enabled: true,
      routes: {
        checkStatus: 'GET /attendance-status/:employeeId',
        attendWithAction: 'POST /attend-with-action?action=checkin|checkout'
      },
      description: 'Alternative avec boutons séparés pour plus de contrôle'
    },
    routes: [
      'GET  /attendance-status/:employeeId - Vérifier statut',
      'POST /recognize-and-attend - Reconnaissance et pointage AUTOMATIQUE (AVEC DÉLAI ET NOM)',
      'POST /attend-with-action - Pointage avec action spécifique',
      'POST /checkout - Pointer le départ manuel',
      'POST /register-multiple - Enregistrer 3-5 photos',
      'POST /register - Enregistrer 1 photo (compatibilité)',
      'POST /recognize - Reconnaissance simple',
      'GET  /check/:employeeId - Vérifier enregistrement',
      'GET  /stats - Statistiques améliorées',
      'GET  /health - Santé du service'
    ],
    bestPractices: [
      'Pour pointage: utilisez /recognize-and-attend (système automatique avec délai et nom)',
      'Pour contrôle précis: utilisez /attend-with-action avec action=checkin|checkout',
      'Pour enregistrement: utilisez /register-multiple avec 3-5 photos',
      'Photos: bon éclairage, angles variés, expression neutre',
      `Délai minimum: ${MIN_CHECKIN_DURATION_HOURS} heure(s) entre checkin et checkout`,
      'IMPORTANT: Utilisez record_date (pas check_in_time) pour les requêtes par date',
      'NOUVEAU: Le système affiche maintenant le nom et prénom de l\'employé sur l\'écran'
    ]
  });
});

// ==================== ROUTE DE DEBUG ====================

router.get('/debug/table-structure', async (req, res) => {
  try {
    const structure = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'attendance'
      ORDER BY ordinal_position
    `);
    
    const sampleData = await db.query(`
      SELECT employee_id, check_in_time, check_out_time, record_date, attendance_date, employee_name
      FROM attendance 
      WHERE record_date = CURRENT_DATE 
      LIMIT 5
    `);
    
    const constraints = await db.query(`
      SELECT conname, contype, consrc
      FROM pg_constraint 
      WHERE conrelid = (
        SELECT oid FROM pg_class WHERE relname = 'attendance'
      )
    `);
    
    res.json({
      success: true,
      structure: structure.rows,
      sample_data_today: sampleData.rows,
      constraints: constraints.rows,
      note: 'Utilisez record_date pour filtrer par date (check_in_time est de type TIME)'
    });
    
  } catch (error) {
    console.error('❌ Erreur debug table:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;