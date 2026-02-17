const facialRecognition = require('../../services/realFacialRecognition');
const facialRecognitionFast = require('../../services/facialRecognitionFast');
const db = require('../../config/db');

class FacialController {
  constructor() {
    console.log('🎭 FacialController initialisé (VERSION COMPLÈTE)');
  }

  // ==================== MÉTHODES UTILITAIRES ====================

  async findEmployee(employeeId) {
    try {
      const result = await db.query(
        'SELECT id, employee_id, first_name, last_name, department, position, email, is_active FROM employees WHERE employee_id = $1',
        [employeeId]
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('❌ Erreur recherche employé:', error);
      return null;
    }
  }

  async recordCheckIn(employeeId, confidence = 0.85, verificationMethod = 'face_recognition') {
    try {
      const employee = await this.findEmployee(employeeId);
      if (!employee || !employee.is_active) {
        return {
          success: false,
          message: 'Employé non trouvé ou inactif'
        };
      }

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().split(' ')[0].slice(0, 8);

      // Vérifier si déjà check-in aujourd'hui
      const existingCheckIn = await db.query(
        `SELECT id, check_in_time, check_out_time FROM attendance 
         WHERE employee_id = $1 
         AND record_date = $2
         AND check_in_time IS NOT NULL`,
        [employeeId, today]
      );

      // Si déjà check-in aujourd'hui
      if (existingCheckIn.rows.length > 0) {
        const existing = existingCheckIn.rows[0];
        const checkInTime = existing.check_in_time?.slice(0, 5) || '--:--';
        
        return {
          success: false,
          alreadyChecked: true,
          message: `Déjà pointé(e) aujourd'hui à ${checkInTime}`,
          existingRecord: {
            id: existing.id,
            checkInTime: checkInTime,
            checkOutTime: existing.check_out_time,
            date: today
          }
        };
      }

      // Déterminer le statut
      let status = 'present';
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      if (hour > 9 || (hour === 9 && minute > 15)) {
        status = 'late';
      }

      // Nouveau pointage d'arrivée
      const result = await db.query(`
        INSERT INTO attendance (
          employee_id, check_in_time, record_date, attendance_date,
          status, verification_method, face_verified, face_confidence,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id, check_in_time, record_date, status
      `, [employeeId, currentTime, today, today, status, verificationMethod, true, confidence]);
      
      const attendanceRecord = result.rows[0];
      
      console.log(`✅ Arrivée enregistrée pour ${employeeId} à ${currentTime.slice(0, 5)}`);
      
      return {
        success: true,
        alreadyChecked: false,
        attendanceId: attendanceRecord.id,
        checkInTime: attendanceRecord.check_in_time,
        employeeName: `${employee.first_name} ${employee.last_name}`,
        message: 'Arrivée enregistrée',
        attendance: attendanceRecord
      };
      
    } catch (error) {
      console.error('❌ Erreur enregistrement pointage:', error);
      return {
        success: false,
        message: 'Erreur lors de l\'enregistrement'
      };
    }
  }

  async recordCheckOut(employeeId, verificationMethod = 'manual') {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().split(' ')[0].slice(0, 8);
      
      // Vérifier si a check-in aujourd'hui
      const existingCheckIn = await db.query(
        `SELECT a.id, a.check_in_time, e.first_name, e.last_name
        FROM attendance a
        JOIN employees e ON a.employee_id = e.employee_id
        WHERE a.employee_id = $1 
          AND a.record_date = $2
          AND a.check_out_time IS NULL
          AND a.check_in_time IS NOT NULL
        ORDER BY a.check_in_time DESC
        LIMIT 1`,
        [employeeId, today]
      );
      
      if (existingCheckIn.rows.length === 0) {
        // Vérifier si jamais check-in aujourd'hui
        const anyAttendance = await db.query(
          `SELECT id, check_in_time, check_out_time 
           FROM attendance 
           WHERE employee_id = $1 
           AND record_date = $2`,
          [employeeId, today]
        );
        
        if (anyAttendance.rows.length === 0) {
          // Jamais pointé aujourd'hui
          return {
            success: false,
            message: 'Vous n\'avez pas encore pointé votre arrivée aujourd\'hui',
            canCheckIn: true
          };
        } else {
          // Déjà check-out
          const existing = anyAttendance.rows[0];
          const checkOutTime = existing.check_out_time?.slice(0, 5) || '--:--';
          
          return {
            success: false,
            message: `Votre départ a déjà été pointé à ${checkOutTime}`,
            alreadyCheckedOut: true,
            existingRecord: {
              checkOutTime: checkOutTime
            }
          };
        }
      }
      
      // Faire le check-out
      const attendance = existingCheckIn.rows[0];
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
          verification_method = $3,
          updated_at = NOW()
        WHERE id = $4
        RETURNING id, check_out_time, hours_worked
      `, [currentTime, hoursWorked.toFixed(2), verificationMethod, attendance.id]);
      
      const updatedRecord = updateResult.rows[0];
      
      console.log(`✅ Départ enregistré pour ${employeeId} à ${currentTime.slice(0, 5)}`);
      
      return {
        success: true,
        attendanceId: updatedRecord.id,
        checkOutTime: updatedRecord.check_out_time,
        hoursWorked: updatedRecord.hours_worked,
        employeeName: employeeName,
        message: `Départ pointé à ${currentTime.slice(0, 5)}`,
        attendance: updatedRecord
      };
      
    } catch (error) {
      console.error('❌ Erreur enregistrement départ:', error);
      return {
        success: false,
        message: 'Erreur lors de l\'enregistrement du départ'
      };
    }
  }

  // ==================== NOUVELLE MÉTHODE : RECONNAÎTRE ET POINTER AVEC ACTION ====================

  async recognizeAndAttendWithAction(req, res) {
    const startTime = Date.now();
    const requestId = `attend_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    console.log(`🎯 [${requestId}] RECONNAISSANCE + POINTAGE AVEC ACTION`);
    
    try {
      let imageData;
      const { action } = req.body; // 'checkin' ou 'checkout'
      
      console.log(`🎯 [${requestId}] Action demandée: ${action}`);
      
      // Récupérer l'image
      if (req.file) {
        imageData = req.file.buffer;
        console.log(`📸 [${requestId}] Image reçue: ${req.file.originalname} (${req.file.size} bytes)`);
      } else if (req.body.photo) {
        const base64String = req.body.photo.includes(',') 
          ? req.body.photo.split(',')[1] 
          : req.body.photo;
        imageData = Buffer.from(base64String, 'base64');
        console.log(`📸 [${requestId}] JSON - Base64 converti en ${imageData.length} bytes`);
      } else {
        return res.status(400).json({
          success: false,
          error: 'NO_IMAGE',
          message: 'Image requise'
        });
      }
      
      // Vérifier l'action
      if (!action || (action !== 'checkin' && action !== 'checkout')) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_ACTION',
          message: 'Action invalide. Utilisez "checkin" ou "checkout"'
        });
      }

      // Reconnaissance faciale
      console.log(`🔍 [${requestId}] Reconnaissance faciale...`);
      let recognitionResult;
      
      try {
        recognitionResult = await facialRecognitionFast.recognizeFace(imageData);
      } catch (recogError) {
        console.error(`❌ [${requestId}] Erreur reconnaissance fast:`, recogError.message);
        // Fallback au service principal
        recognitionResult = await facialRecognition.recognizeFace(imageData);
      }
      
      if (!recognitionResult.recognized) {
        return res.json({
          success: true,
          recognized: false,
          attendanceRecorded: false,
          action: action,
          message: recognitionResult.message || 'Visage non reconnu',
          processingTime: Date.now() - startTime
        });
      }

      const employeeId = recognitionResult.match.employeeId;
      const confidence = recognitionResult.match.confidence || 0.85;
      
      // Récupérer infos employé
      const employee = await this.findEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: `Employé ${employeeId} non trouvé`
        });
      }
      
      const employeeName = `${employee.first_name} ${employee.last_name}`;
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().split(' ')[0].slice(0, 8);
      const currentTimeFormatted = currentTime.slice(0, 5);
      
      // ========== LOGIQUE SELON ACTION ==========
      
      if (action === 'checkin') {
        // ========== CHECK-IN ==========
        console.log(`📅 [${requestId}] Tentative CHECK-IN pour ${employeeId}`);
        
        // Vérifier si déjà check-in aujourd'hui
        const existingCheckIn = await db.query(
          `SELECT id, check_in_time, check_out_time 
           FROM attendance 
           WHERE employee_id = $1 
           AND record_date = $2
           AND check_in_time IS NOT NULL`,
          [employeeId, today]
        );
        
        if (existingCheckIn.rows.length > 0) {
          const existing = existingCheckIn.rows[0];
          const checkInTime = existing.check_in_time?.slice(0, 5) || '--:--';
          
          const elapsedTime = Date.now() - startTime;
          
          return res.json({
            success: true,
            recognized: true,
            attendanceRecorded: false,
            alreadyChecked: true,
            action: 'checkin',
            message: `🔄 ${employeeName}, vous êtes déjà pointé(e) aujourd'hui à ${checkInTime}`,
            match: {
              employeeId: employeeId,
              employeeName: employeeName,
              firstName: employee.first_name,  // AJOUTER
              lastName: employee.last_name,    // AJOUTER
              confidence: confidence
            },
            existingRecord: {
              id: existing.id,
              checkIn: checkInTime,
              date: today
            },
            processingTime: elapsedTime,
            timestamp: now.toISOString(),
            frontend: {
              showCheckOutButton: true,
              showCheckInButton: false,
              status: 'already_checked_in'
            }
          });
        }
        
        // Faire le check-in
        const checkInResult = await this.recordCheckIn(employeeId, confidence, 'face_recognition');
        
        const elapsedTime = Date.now() - startTime;
        
        if (!checkInResult.success) {
          return res.json({
            success: true,
            recognized: true,
            attendanceRecorded: false,
            action: 'checkin',
            message: checkInResult.message,
            match: {
              employeeId: employeeId,
              employeeName: employeeName,
              firstName: employee.first_name,  // AJOUTER
              lastName: employee.last_name,    // AJOUTER
              confidence: confidence
            },
            processingTime: elapsedTime,
            timestamp: now.toISOString()
          });
        }
        
        return res.json({
          success: true,
          recognized: true,
          attendanceRecorded: true,
          action: 'checkin',
          message: `✅ ${employeeName}, bonjour ! Arrivée enregistrée à ${currentTimeFormatted}`,
          match: {
            employeeId: employeeId,
            employeeName: employeeName,
            firstName: employee.first_name,  // AJOUTER
            lastName: employee.last_name,    // AJOUTER
            confidence: confidence
          },
          attendance: {
            id: checkInResult.attendanceId,
            checkIn: currentTimeFormatted,
            date: today
          },
          processingTime: elapsedTime,
          timestamp: now.toISOString(),
          frontend: {
            showCheckOutButton: true,
            showCheckInButton: false,
            status: 'checked_in'
          }
        });
        
      } else if (action === 'checkout') {
        // ========== CHECK-OUT ==========
        console.log(`📅 [${requestId}] Tentative CHECK-OUT pour ${employeeId}`);
        
        // Faire le check-out
        const checkOutResult = await this.recordCheckOut(employeeId, 'face_recognition');
        
        const elapsedTime = Date.now() - startTime;
        
        if (!checkOutResult.success) {
          return res.json({
            success: true,
            recognized: true,
            attendanceRecorded: false,
            action: 'checkout',
            message: checkOutResult.message,
            match: {
              employeeId: employeeId,
              employeeName: employeeName,
              firstName: employee.first_name,  // AJOUTER
              lastName: employee.last_name,    // AJOUTER
              confidence: confidence
            },
            processingTime: elapsedTime,
            timestamp: now.toISOString(),
            frontend: {
              showCheckOutButton: checkOutResult.canCheckIn ? false : true,
              showCheckInButton: checkOutResult.canCheckIn || false,
              status: checkOutResult.alreadyCheckedOut ? 'already_checked_out' : 'no_check_in'
            }
          });
        }
        
        return res.json({
          success: true,
          recognized: true,
          attendanceRecorded: true,
          action: 'checkout',
          message: `✅ ${employeeName}, bonsoir ! Départ enregistré à ${currentTimeFormatted}`,
          match: {
            employeeId: employeeId,
            employeeName: employeeName,
            firstName: employee.first_name,  // AJOUTER
            lastName: employee.last_name,    // AJOUTER
            confidence: confidence
          },
          attendance: {
            id: checkOutResult.attendanceId,
            checkOut: currentTimeFormatted,
            hoursWorked: checkOutResult.hoursWorked,
            date: today
          },
          processingTime: elapsedTime,
          timestamp: now.toISOString(),
          frontend: {
            showCheckOutButton: false,
            showCheckInButton: false,
            status: 'checked_out'
          }
        });
      }
      
    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      console.error(`❌ [${requestId}] Erreur:`, error.message);
      
      return res.status(500).json({
        success: false,
        error: 'ATTENDANCE_ERROR',
        message: 'Erreur lors du pointage',
        processingTime: elapsedTime,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ==================== MÉTHODES EXISTANTES ====================

  async recognize(req, res) {
    const startTime = Date.now();
    const requestId = `facerec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    console.log(`🔍 [${requestId}] RECONNAISSANCE FACIALE`);
    
    try {
      let imageData;
      
      if (req.file) {
        imageData = req.file.buffer;
        console.log(`📸 [${requestId}] Image reçue: ${req.file.originalname} (${req.file.size} bytes)`);
      } else if (req.body.image) {
        const base64String = req.body.image.includes(',') 
          ? req.body.image.split(',')[1] 
          : req.body.image;
        
        imageData = Buffer.from(base64String, 'base64');
        console.log(`📊 [${requestId}] Buffer créé: ${imageData.length} bytes`);
      } else {
        return res.status(400).json({
          success: false,
          error: 'NO_IMAGE',
          message: 'Image requise'
        });
      }

      let recognitionResult;
      
      try {
        recognitionResult = await facialRecognitionFast.recognizeFace(imageData);
      } catch (fastError) {
        console.error(`❌ [${requestId}] Erreur reconnaissance fast:`, fastError.message);
        recognitionResult = await facialRecognition.recognizeFace(imageData);
      }
      
      const elapsedTime = Date.now() - startTime;
      console.log(`⏱️ [${requestId}] Reconnaissance terminée en ${elapsedTime}ms`);
      
      if (!recognitionResult.recognized) {
        return res.json({
          success: true,
          recognized: false,
          message: recognitionResult.message || 'Visage non reconnu',
          processingTime: elapsedTime,
          bestMatch: recognitionResult.bestMatch || null
        });
      }

      const employee = await this.findEmployee(recognitionResult.match.employeeId);
      
      if (!employee) {
        return res.status(404).json({
          success: true,
          recognized: false,
          message: `Employé ${recognitionResult.match.employeeId} non trouvé`
        });
      }

      // Vérifier présence actuelle
      const today = new Date().toISOString().split('T')[0];
      const currentAttendance = await db.query(
        `SELECT id, check_in_time, check_out_time, status 
         FROM attendance 
         WHERE employee_id = $1 AND record_date = $2`,
        [employee.employee_id, today]
      );

      let checkInTime = null;
      let checkOutTime = null;
      let attendanceStatus = 'not_checked';
      let alreadyChecked = false;
      
      if (currentAttendance.rows.length > 0) {
        const att = currentAttendance.rows[0];
        checkInTime = att.check_in_time;
        checkOutTime = att.check_out_time;
        attendanceStatus = att.status;
        alreadyChecked = true;
      }

      res.json({
        success: true,
        recognized: true,
        match: {
          employeeId: recognitionResult.match.employeeId,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          firstName: employee.first_name,  // AJOUTER
          lastName: employee.last_name,    // AJOUTER
          department: employee.department,
          position: employee.position,
          email: employee.email,
          confidence: recognitionResult.match.confidence,
          simulated: recognitionResult.match.simulated || false
        },
        currentAttendance: {
          alreadyChecked: alreadyChecked,
          status: attendanceStatus,
          checkIn: checkInTime,
          checkOut: checkOutTime
        },
        message: alreadyChecked 
          ? `Bonjour ${employee.first_name} ${employee.last_name} (Déjà pointé)`
          : `Bonjour ${employee.first_name} ${employee.last_name}`,
        processingTime: elapsedTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      console.error(`❌ [${requestId}] Erreur reconnaissance:`, error.message);
      
      res.status(500).json({
        success: false,
        error: 'RECOGNITION_ERROR',
        message: 'Erreur lors de la reconnaissance faciale',
        processingTime: elapsedTime
      });
    }
  }

  async recognizeAndAttend(req, res) {
    const startTime = Date.now();
    const requestId = `attend_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    console.log(`🎯 [${requestId}] RECONNAISSANCE + POINTAGE (VERSION SIMPLE)`);
    
    try {
      let imageData;
      
      // Récupérer l'image
      if (req.file) {
        imageData = req.file.buffer;
        console.log(`📸 [${requestId}] Image reçue: ${req.file.originalname} (${req.file.size} bytes)`);
      } else if (req.body.photo) {
        const base64String = req.body.photo.includes(',') 
          ? req.body.photo.split(',')[1] 
          : req.body.photo;
        imageData = Buffer.from(base64String, 'base64');
        console.log(`📸 [${requestId}] JSON - Base64 converti en ${imageData.length} bytes`);
      } else if (req.body.image) {
        const base64String = req.body.image.includes(',') 
          ? req.body.image.split(',')[1] 
          : req.body.image;
        imageData = Buffer.from(base64String, 'base64');
        console.log(`📸 [${requestId}] JSON - Base64 converti en ${imageData.length} bytes`);
      } else {
        return res.status(400).json({
          success: false,
          error: 'NO_IMAGE',
          message: 'Image requise'
        });
      }

      // Reconnaissance faciale
      console.log(`🔍 [${requestId}] Reconnaissance faciale...`);
      let recognitionResult;
      
      try {
        recognitionResult = await facialRecognitionFast.recognizeFace(imageData);
      } catch (fastError) {
        console.error(`❌ [${requestId}] Erreur reconnaissance fast:`, fastError.message);
        recognitionResult = await facialRecognition.recognizeFace(imageData);
      }
      
      console.log(`🔍 [${requestId}] Résultat reconnaissance:`, {
        recognized: recognitionResult.recognized,
        employeeId: recognitionResult.match?.employeeId,
        confidence: recognitionResult.match?.confidence
      });
      
      if (!recognitionResult.recognized) {
        return res.json({
          success: true,
          recognized: false,
          attendanceRecorded: false,
          message: recognitionResult.message || 'Visage non reconnu',
          processingTime: Date.now() - startTime
        });
      }

      const employeeId = recognitionResult.match.employeeId;
      const confidence = recognitionResult.match.confidence || 0.85;
      
      // Récupérer infos employé
      const employee = await this.findEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: `Employé ${employeeId} non trouvé`
        });
      }
      
      const today = new Date().toISOString().split('T')[0];
      
      // Vérifier si déjà pointé aujourd'hui
      const existingCheck = await db.query(
        `SELECT id, check_in_time, check_out_time, status 
         FROM attendance 
         WHERE employee_id = $1 
         AND record_date = $2`,
        [employeeId, today]
      );
      
      // Si déjà pointé aujourd'hui
      if (existingCheck.rows.length > 0) {
        const existing = existingCheck.rows[0];
        const checkInTime = existing.check_in_time?.slice(0, 5) || '--:--';
        const checkOutTime = existing.check_out_time?.slice(0, 5) || null;
        
        const elapsedTime = Date.now() - startTime;
        
        if (checkOutTime === null) {
          // Déjà pointé arrivée mais pas départ
          return res.json({
            success: true,
            recognized: true,
            attendanceRecorded: false,
            alreadyChecked: true,
            canCheckOut: true,
            match: {
              employeeId: employeeId,
              employeeName: `${employee.first_name} ${employee.last_name}`,
              firstName: employee.first_name,  // AJOUTER
              lastName: employee.last_name,    // AJOUTER
              confidence: confidence
            },
            existingRecord: {
              id: existing.id,
              checkIn: checkInTime,
              checkOut: null,
              date: today,
              status: existing.status
            },
            message: `🔄 Déjà pointé(e) aujourd'hui à ${checkInTime}`,
            processingTime: elapsedTime,
            timestamp: new Date().toISOString(),
            frontend: {
              showCheckOutButton: true,
              showCheckInButton: false
            }
          });
        } else {
          // Déjà pointé entrée ET sortie
          return res.json({
            success: true,
            recognized: true,
            attendanceRecorded: false,
            alreadyChecked: true,
            canCheckOut: false,
            match: {
              employeeId: employeeId,
              employeeName: `${employee.first_name} ${employee.last_name}`,
              firstName: employee.first_name,  // AJOUTER
              lastName: employee.last_name,    // AJOUTER
              confidence: confidence
            },
            existingRecord: {
              id: existing.id,
              checkIn: checkInTime,
              checkOut: checkOutTime,
              date: today,
              status: existing.status
            },
            message: `✅ Pointage complet aujourd'hui: arrivée ${checkInTime}, départ ${checkOutTime}`,
            processingTime: elapsedTime,
            timestamp: new Date().toISOString(),
            frontend: {
              showCheckOutButton: false,
              showCheckInButton: false
            }
          });
        }
      }
      
      // Nouveau pointage (check-in seulement)
      console.log(`📅 [${requestId}] Nouveau pointage pour ${employeeId}...`);
      const checkInResult = await this.recordCheckIn(employeeId, confidence, 'face_recognition');
      
      const elapsedTime = Date.now() - startTime;
      
      if (!checkInResult.success) {
        return res.json({
          success: true,
          recognized: true,
          attendanceRecorded: false,
          alreadyChecked: checkInResult.alreadyChecked,
          match: {
            employeeId: employeeId,
            employeeName: `${employee.first_name} ${employee.last_name}`,
            firstName: employee.first_name,  // AJOUTER
            lastName: employee.last_name,    // AJOUTER
            confidence: confidence
          },
          message: checkInResult.message,
          processingTime: elapsedTime,
          timestamp: new Date().toISOString()
        });
      }

      // Dans la réponse quand c'est un succès :
      return res.json({
        success: true,
        recognized: true,
        attendanceRecorded: true,
        alreadyChecked: false,
        match: {
          employeeId: employeeId,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          firstName: employee.first_name,  // AJOUTER
          lastName: employee.last_name,    // AJOUTER
          confidence: confidence
        },
        attendance: {
          id: checkInResult.attendanceId,
          checkInTime: checkInResult.checkInTime,
          date: today
        },
        message: `✅ Pointage enregistré pour ${employeeId}`,
        processingTime: elapsedTime,
        timestamp: new Date().toISOString(),
        frontend: {
          showCheckOutButton: true,
          showCheckInButton: false
        }
      });

    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      console.error(`❌ [${requestId}] Erreur:`, error.message);
      
      res.status(500).json({
        success: false,
        error: 'ATTENDANCE_ERROR',
        message: 'Erreur lors du pointage',
        processingTime: elapsedTime,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async checkAttendanceStatus(req, res) {
    try {
      const { employeeId } = req.params;
      
      if (!employeeId) {
        return res.status(400).json({
          success: false,
          message: 'ID employé requis'
        });
      }
      
      const today = new Date().toISOString().split('T')[0];
      
      const result = await db.query(
        `SELECT id, check_in_time, check_out_time, status, record_date
         FROM attendance 
         WHERE employee_id = $1 
         AND record_date = $2
         ORDER BY check_in_time DESC
         LIMIT 1`,
        [employeeId, today]
      );
      
      const employee = await this.findEmployee(employeeId);
      
      if (result.rows.length === 0) {
        return res.json({
          success: true,
          alreadyChecked: false,
          canCheckIn: true,
          canCheckOut: false,
          message: 'Non pointé aujourd\'hui',
          employee: employee ? {
            id: employee.id,
            employeeId: employee.employee_id,
            name: `${employee.first_name} ${employee.last_name}`,
            firstName: employee.first_name,  // AJOUTER
            lastName: employee.last_name     // AJOUTER
          } : null,
          frontend: {
            showCheckInButton: true,
            showCheckOutButton: false
          }
        });
      }
      
      const record = result.rows[0];
      const checkInTime = record.check_in_time?.slice(0, 5) || '--:--';
      const checkOutTime = record.check_out_time?.slice(0, 5) || null;
      
      return res.json({
        success: true,
        alreadyChecked: true,
        canCheckIn: false,
        canCheckOut: checkOutTime === null,
        message: checkOutTime 
          ? `Pointage complet: arrivée ${checkInTime}, départ ${checkOutTime}`
          : `Déjà pointé: arrivée ${checkInTime}`,
        record: {
          id: record.id,
          checkIn: checkInTime,
          checkOut: checkOutTime,
          date: record.record_date,
          status: record.status
        },
        employee: employee ? {
          id: employee.id,
          employeeId: employee.employee_id,
          name: `${employee.first_name} ${employee.last_name}`,
          firstName: employee.first_name,  // AJOUTER
          lastName: employee.last_name     // AJOUTER
        } : null,
        frontend: {
          showCheckInButton: false,
          showCheckOutButton: checkOutTime === null
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur checkAttendanceStatus:', error.message);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }

  async getHealth(req, res) {
    try {
      let fastHealth, mainHealth;
      
      try {
        fastHealth = await facialRecognitionFast.getHealth();
      } catch (fastError) {
        fastHealth = {
          status: 'UNHEALTHY',
          error: fastError.message,
          timestamp: new Date().toISOString()
        };
      }
      
      try {
        mainHealth = facialRecognition.getStatistics ? facialRecognition.getStatistics() : {};
      } catch (mainError) {
        mainHealth = {
          status: 'UNHEALTHY',
          error: mainError.message
        };
      }
      
      res.json({
        ...fastHealth,
        services: {
          fast: fastHealth.status,
          main: mainHealth.modelsLoaded ? 'HEALTHY' : 'UNKNOWN',
          multiple_registration: 'ACTIVE'
        },
        main_service: mainHealth
      });
    } catch (error) {
      console.error('❌ Erreur getHealth:', error);
      res.status(500).json({
        status: 'UNHEALTHY',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async checkout(req, res) {
    try {
      const { employeeId } = req.body;
      console.log('🚪 Pointage départ manuel pour:', employeeId);
      
      if (!employeeId) {
        return res.status(400).json({
          success: false,
          message: 'ID employé requis'
        });
      }
      
      const result = await this.recordCheckOut(employeeId, 'manual');
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
          canCheckIn: result.canCheckIn || false,
          alreadyCheckedOut: result.alreadyCheckedOut || false
        });
      }
      
      res.json({
        success: true,
        message: result.message,
        attendance: {
          id: result.attendanceId,
          checkOutTime: result.checkOutTime,
          hoursWorked: result.hoursWorked
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur checkout:', error.message);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors du pointage de départ'
      });
    }
  }

  async registerFace(req, res) {
    try {
      const { employeeId } = req.body;
      console.log('📸 [FACIAL] Enregistrement visage (single) pour:', employeeId);
      
      if (!employeeId) {
        return res.status(400).json({
          success: false,
          message: 'employeeId requis'
        });
      }
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Image requise'
        });
      }

      const employee = await this.findEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: `Employé ${employeeId} non trouvé`
        });
      }

      let result;
      try {
        result = await facialRecognition.registerFace(employeeId, req.file.buffer);
      } catch (error) {
        console.log('⚠️ Service legacy échoué, génération simulée');
        const simulatedEncoding = Array.from({ length: 128 }, () => Math.random());
        
        await db.query(
          `INSERT INTO facial_encodings (employee_id, encoding_data, simulated, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (employee_id) 
           DO UPDATE SET encoding_data = $2, simulated = $3, updated_at = NOW()`,
          [employeeId, JSON.stringify(simulatedEncoding), true]
        );

        try {
          await facialRecognitionFast.loadFaceEncodings();
        } catch (loadError) {
          console.error('⚠️ Erreur chargement encodings fast:', loadError.message);
        }
        
        result = {
          success: true,
          descriptorLength: 128,
          simulated: true
        };
      }

      await db.query(
        'UPDATE employees SET face_encoding_date = NOW(), has_face_registered = true, updated_at = NOW() WHERE employee_id = $1',
        [employeeId]
      );

      res.json({
        success: true,
        message: 'Visage enregistré avec succès (1 photo)',
        employee: {
          id: employee.id,
          employee_id: employee.employee_id,
          name: `${employee.first_name} ${employee.last_name}`,
          firstName: employee.first_name,  // AJOUTER
          lastName: employee.last_name,    // AJOUTER
          has_face_registered: true,
          encoding_generated: true,
          simulated: result.simulated || false
        }
      });

    } catch (error) {
      console.error('❌ Erreur registerFace:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'enregistrement'
      });
    }
  }

  async getFacialStats(req, res) {
    try {
      let serviceStats = {};
      
      try {
        serviceStats = await facialRecognitionFast.getStatistics();
      } catch (error) {
        console.error('❌ Erreur stats fast:', error);
        serviceStats = facialRecognition.getStatistics ? facialRecognition.getStatistics() : {};
      }
      
      const dbStats = await db.query(`
        SELECT 
          COUNT(DISTINCT e.employee_id) as total_employees,
          COUNT(DISTINCT fe.employee_id) as employees_with_face,
          SUM(fe.descriptors_count) as total_descriptors,
          AVG(fe.descriptors_count) as avg_descriptors_per_employee,
          COUNT(DISTINCT CASE WHEN a.verification_method = 'face_recognition' THEN a.id END) as face_attendance_today
        FROM employees e
        LEFT JOIN facial_encodings fe ON e.employee_id = fe.employee_id
        LEFT JOIN attendance a ON e.employee_id = a.employee_id AND DATE(a.created_at) = CURRENT_DATE
        WHERE e.is_active = true
      `);
      
      const stats = dbStats.rows[0];
      
      res.json({
        success: true,
        data: {
          recognition_service: serviceStats.statistics || serviceStats,
          database: {
            total_employees: parseInt(stats.total_employees) || 0,
            employees_with_face: parseInt(stats.employees_with_face) || 0,
            total_descriptors: parseInt(stats.total_descriptors) || 0,
            avg_descriptors_per_employee: parseFloat(stats.avg_descriptors_per_employee) || 0,
            face_coverage: parseInt(stats.total_employees) > 0 
              ? ((parseInt(stats.employees_with_face) / parseInt(stats.total_employees)) * 100).toFixed(2) + '%'
              : '0%',
            face_attendance_today: parseInt(stats.face_attendance_today) || 0
          },
          system: {
            timestamp: new Date().toISOString(),
            version: '2.0.0',
            services: {
              fast: 'active',
              legacy: 'active',
              multiple_registration: 'active',
              two_button_system: 'active'
            }
          }
        }
      });

    } catch (error) {
      console.error('❌ Erreur getFacialStats:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques'
      });
    }
  }
}

module.exports = new FacialController();