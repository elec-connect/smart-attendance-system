// backend/src/controllers/attendanceController.js
const db = require('../../config/db');
const NotificationHelper = require('../utils/notificationHelper');

class AttendanceController {
  constructor() {
    console.log('📋 Initialisation du AttendanceController...');
    
    // Liaison des méthodes au contexte
    this.markAttendance = this.markAttendance.bind(this);
    this.checkIn = this.checkIn.bind(this);
    this.checkOut = this.checkOut.bind(this);
    this.getAllAttendance = this.getAllAttendance.bind(this);
    this.getAttendanceStats = this.getAttendanceStats.bind(this);
    this.getTodayAttendance = this.getTodayAttendance.bind(this);
    this.updateAttendance = this.updateAttendance.bind(this);
    this.checkTodayStatus = this.checkTodayStatus.bind(this);
    this.resetTodayAttendance = this.resetTodayAttendance.bind(this);
    this.facialCheckIn = this.facialCheckIn.bind(this);
    this.calculateHoursDifference = this.calculateHoursDifference.bind(this);
    this.handleFullAttendance = this.handleFullAttendance.bind(this);
    this.handleExistingRecord = this.handleExistingRecord.bind(this);
    this.calculateHoursBetween = this.calculateHoursBetween.bind(this);
    this.getEmployeeTodayStatus = this.getEmployeeTodayStatus.bind(this);
    this.processCheckOut = this.processCheckOut.bind(this);
    this.processAttendanceUpdate = this.processAttendanceUpdate.bind(this);
    this.processAttendanceReset = this.processAttendanceReset.bind(this);
    this.processCheckOutFromRecord = this.processCheckOutFromRecord.bind(this);
    
    // Nouvelles méthodes pour les shifts
    this.getEmployeeShiftConfig = this.getEmployeeShiftConfig.bind(this);
    this.determineAttendanceStatus = this.determineAttendanceStatus.bind(this);
    this.getShiftStats = this.getShiftStats.bind(this);
    this.formatAttendanceDataWithShifts = this.formatAttendanceDataWithShifts.bind(this);
    
    // ⭐ NOUVELLE MÉTHODE DE VÉRIFICATION
    this.isManualCheckinEnabled = this.isManualCheckinEnabled.bind(this);
    
    console.log('✅ AttendanceController initialisé avec succès');
  }

  // ==================== ⭐ VÉRIFICATION POINTAGE MANUEL ====================

  /**
   * Vérifie si le pointage manuel est activé dans la configuration
   */
  async isManualCheckinEnabled() {
    try {
      const result = await db.query('SELECT config FROM settings WHERE id = 1');
      const config = result.rows[0]?.config || {};
      const isEnabled = config.features?.manualCheckin !== false;
      console.log(`⚙️ Pointage manuel: ${isEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
      return isEnabled;
    } catch (error) {
      console.error('❌ Erreur récupération config manualCheckin:', error);
      return true; // Par défaut, autorisé
    }
  }

  // ==================== CONFIGURATION DES RÔLES ==================== 
  
  getRolePermissions(role) {
    const permissions = {
      admin: {
        canViewAll: true,
        canViewAllDepartments: true,
        canEditAttendance: true,
        canEditSettings: true,
        canManageEmployees: true,
        canManagePayroll: true,
        canCheckInOthers: true,
        canCheckOutOthers: true,
        canViewReports: true,
        canViewPayroll: true,
        canViewStats: true,
        canDoFacialCheckIn: true,
        canDoManualCheckIn: true,
        filterDepartment: null
      },
      manager: {
        canViewAll: false,
        canViewAllDepartments: false,
        canEditAttendance: false,
        canEditSettings: false,
        canManageEmployees: false,
        canManagePayroll: false,
        canCheckInOthers: false,
        canCheckOutOthers: false,
        canViewReports: false,
        canViewPayroll: false,
        canViewStats: false,
        canDoFacialCheckIn: false,
        canDoManualCheckIn: false,
        filterDepartment: true
      },
      employee: {
        canViewAll: false,
        canViewAllDepartments: false,
        canEditAttendance: false,
        canEditSettings: false,
        canManageEmployees: false,
        canManagePayroll: false,
        canCheckInOthers: false,
        canCheckOutOthers: false,
        canViewReports: false,
        canViewPayroll: false,
        canViewStats: false,
        canDoFacialCheckIn: false,
        canDoManualCheckIn: false,
        filterDepartment: false
      }
    };
    
    return permissions[role] || permissions.employee;
  }

  // ==================== ⭐ MÉTHODES POUR LES SHIFTS ====================

  /**
   * Récupérer la configuration du shift d'un employé
   */
  async getEmployeeShiftConfig(employeeId) {
    try {
      // 1. Récupérer le shift de l'employé
      const employeeResult = await db.query(
        'SELECT shift_name FROM employees WHERE employee_id = $1 OR id::text = $1',
        [employeeId]
      );
      
      const employeeShift = employeeResult.rows[0]?.shift_name || 'Shift Standard';
      
      // 2. Récupérer les configurations des shifts depuis settings
      const settingsResult = await db.query(
        'SELECT config->\'shifts\' as shifts FROM settings WHERE id = 1'
      );
      
      const shifts = settingsResult.rows[0]?.shifts || {};
      
      // 3. Trouver la configuration correspondant au shift de l'employé
      let shiftConfig = null;
      for (const [key, config] of Object.entries(shifts)) {
        if (config.name === employeeShift && config.enabled !== false) {
          shiftConfig = config;
          break;
        }
      }
      
      // Fallback sur shift1 si non trouvé
      if (!shiftConfig) {
        shiftConfig = shifts.shift1 || {
          name: 'Shift Standard',
          start: '08:00',
          lateThreshold: '08:14',
          halfDayThreshold: '12:00',
          breakDuration: 60,
          color: 'blue'
        };
      }
      
      return {
        shiftName: employeeShift,
        config: shiftConfig
      };
      
    } catch (error) {
      console.error('❌ Erreur getEmployeeShiftConfig:', error);
      return {
        shiftName: 'Shift Standard',
        config: {
          name: 'Shift Standard',
          start: '08:00',
          lateThreshold: '08:14',
          halfDayThreshold: '12:00',
          breakDuration: 60,
          color: 'blue'
        }
      };
    }
  }

  /**
   * Déterminer le statut de présence en fonction du shift de l'employé
   */
  async determineAttendanceStatus(employeeId, checkInTime, recordDate) {
    try {
      console.log(`📊 Détermination du statut pour employé ${employeeId} à ${checkInTime}`);
      
      const { shiftName, config } = await this.getEmployeeShiftConfig(employeeId);
      
      console.log(`👤 Shift employé: ${shiftName}`);
      console.log(`⚙️ Configuration: start=${config.start}, late=${config.lateThreshold}, half=${config.halfDayThreshold}`);
      
      const checkIn = new Date(`1970-01-01T${checkInTime}`);
      const shiftStart = new Date(`1970-01-01T${config.start}`);
      const lateThreshold = new Date(`1970-01-01T${config.lateThreshold}`);
      const halfDayThreshold = new Date(`1970-01-01T${config.halfDayThreshold}`);
      
      let status, label, color;
      
      if (checkIn <= shiftStart) {
        status = 'present';
        label = 'Présent';
        color = 'green';
      } else if (checkIn <= lateThreshold) {
        status = 'late';
        label = 'En retard';
        color = 'yellow';
      } else if (checkIn <= halfDayThreshold) {
        status = 'half-day';
        label = 'Demi-journée';
        color = 'orange';
      } else {
        status = 'absent';
        label = 'Absent';
        color = 'red';
      }
      
      console.log(`📊 Statut déterminé: ${label} (${status})`);
      
      return {
        status,
        label,
        color,
        shiftName,
        shiftConfig: config,
        breakDuration: config.breakDuration || 60,
        isLate: status === 'late',
        isHalfDay: status === 'half-day',
        isAbsent: status === 'absent'
      };
      
    } catch (error) {
      console.error('❌ Erreur determineAttendanceStatus:', error);
      return {
        status: 'present',
        label: 'Présent',
        color: 'green',
        shiftName: 'Shift Standard',
        shiftConfig: {
          start: '08:00',
          lateThreshold: '08:14',
          halfDayThreshold: '12:00',
          breakDuration: 60
        },
        breakDuration: 60,
        isLate: false,
        isHalfDay: false,
        isAbsent: false
      };
    }
  }

  /**
   * Récupérer les statistiques par shift
   */
  async getShiftStats(date) {
    try {
      const statsDate = date || new Date().toISOString().split('T')[0];
      
      const shiftStats = await db.query(`
        SELECT 
          e.shift_name,
          COUNT(DISTINCT e.id) as total_employees,
          COUNT(DISTINCT a.id) as total_attendance,
          COUNT(DISTINCT CASE WHEN a.status = 'present' THEN a.id END) as present_count,
          COUNT(DISTINCT CASE WHEN a.status = 'late' THEN a.id END) as late_count,
          COUNT(DISTINCT CASE WHEN a.status = 'half-day' THEN a.id END) as half_day_count,
          COUNT(DISTINCT CASE WHEN a.status = 'absent' OR a.id IS NULL THEN e.id END) as absent_count,
          COALESCE(AVG(a.hours_worked), 0) as avg_hours,
          COALESCE(SUM(CASE WHEN a.check_out_time IS NOT NULL THEN a.hours_worked ELSE 0 END), 0) as total_hours
        FROM employees e
        LEFT JOIN attendance a ON e.employee_id = a.employee_id 
          AND a.attendance_date = $1
        WHERE e.is_active = true
        GROUP BY e.shift_name
        ORDER BY 
          CASE 
            WHEN e.shift_name = 'Shift Standard' THEN 1
            WHEN e.shift_name = 'Shift Matin' THEN 2
            WHEN e.shift_name = 'Shift Après-midi' THEN 3
            WHEN e.shift_name = 'Shift Nuit' THEN 4
            ELSE 5
          END
      `, [statsDate]);
      
      return shiftStats.rows;
      
    } catch (error) {
      console.error('❌ Erreur getShiftStats:', error);
      return [];
    }
  }

  // ==================== MÉTHODES DE RÉCUPÉRATION ====================

  async getAllAttendance(req, res) {
    try {
      console.log('📅 ========== getAllAttendance ==========');
      console.log('📅 Query params:', req.query);
      console.log(`👤 Utilisateur: ${req.user?.email} - Rôle: ${req.user?.role} - Département: ${req.user?.department}`);

      const { limit = 50, startDate, endDate, status, employeeId, employeeCode, date } = req.query;

      if (!req.user) {
        return this.sendUnauthorizedResponse(res);
      }

      const permissions = this.getRolePermissions(req.user.role);

      let query = `
        SELECT 
          a.id as attendance_id,
          a.employee_id as attendance_employee_code,
          a.check_in_time,
          a.check_out_time,
          a.hours_worked,
          a.record_date,
          a.attendance_date,
          a.status,
          a.notes,
          a.shift_name,
          a.created_at,
          a.updated_at,
          e.id as employee_db_id,
          e.employee_id as employee_code,
          e.first_name,
          e.last_name,
          e.email,
          e.department,
          e.position,
          e.role,
          e.is_active,
          e.has_face_registered,
          e.phone,
          e.shift_name as employee_shift
        FROM attendance a
        LEFT JOIN employees e ON e.employee_id = a.employee_id
        WHERE 1=1
      `;

      const params = [];
      let paramCount = 1;
      
      // ========== GESTION DES EMPLOYÉS ==========
      if (req.user.role === 'employee') {
        const employeeResult = await db.query(
          'SELECT employee_id FROM employees WHERE id = $1',
          [req.user.id]
        );
        
        const employeeDbId = employeeResult.rows[0]?.employee_id;
        
        if (!employeeDbId) {
          console.error(`❌ Employee ID non trouvé pour l'utilisateur ID: ${req.user.id}`);
          return res.status(404).json({
            success: false,
            message: 'Employé non trouvé dans la base de données'
          });
        }
        
        console.log(`🔍 Employee ID récupéré depuis la DB: ${employeeDbId}`);
        
        query += ` AND e.employee_id = $${paramCount}`;
        params.push(employeeDbId);
        paramCount++;
      }
      else if (req.user.role === 'manager' && req.user.department) {
        query += ` AND e.department = $${paramCount}`;
        params.push(req.user.department);
        paramCount++;
      }
      
      // ========== FILTRES DE DATE ==========
      if (date) {
        query += ` AND DATE(a.record_date) = DATE($${paramCount})`;
        params.push(date);
        paramCount++;
      }
      else if (startDate && endDate) {
        query += ` AND DATE(a.record_date) BETWEEN DATE($${paramCount}) AND DATE($${paramCount + 1})`;
        params.push(startDate, endDate);
        paramCount += 2;
      }

      // ========== AUTRES FILTRES ==========
      if (status && status !== 'all') {
        query += ` AND a.status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      if (employeeCode && !employeeId) {
        query += ` AND (e.employee_id ILIKE $${paramCount} OR e.email ILIKE $${paramCount + 1})`;
        params.push(`%${employeeCode}%`, `%${employeeCode}%`);
        paramCount += 2;
      }

      // ========== TRI ET LIMITE ==========
      query += ` ORDER BY a.record_date DESC, a.check_in_time DESC`;
      if (limit) {
        query += ` LIMIT $${paramCount}`;
        params.push(parseInt(limit));
      }

      console.log('📝 Requête SQL finale:', query);
      console.log('📊 Paramètres finaux:', params);

      const result = await db.query(query, params);
      console.log(`📅 ${result.rows.length} enregistrements trouvés`);

      const formattedData = await this.formatAttendanceDataWithShifts(result.rows);

      let shiftStats = [];
      if (req.user.role === 'admin') {
        shiftStats = await this.getShiftStats(date || new Date().toISOString().split('T')[0]);
      }

      res.json({
        success: true,
        data: formattedData,
        meta: {
          count: formattedData.length,
          userRole: req.user.role,
          userDepartment: req.user.department,
          dateRange: startDate && endDate ? `${startDate} à ${endDate}` : "Aujourd'hui",
          permissions: permissions,
          shiftStats: shiftStats
        }
      });

    } catch (error) {
      console.error('❌ ERREUR getAllAttendance:', error);
      console.error('Stack:', error.stack);
      this.sendServerError(res, 'Erreur lors de la récupération des présences', error);
    }
  }

  async getAttendanceStats(req, res) {
    try {
      console.log('✅ getAttendanceStats appelé');

      if (!req.user) {
        return this.sendUnauthorizedResponse(res);
      }

      const permissions = this.getRolePermissions(req.user.role);
      
      if (req.user.role === 'employee' || req.user.role === 'manager') {
        return this.sendForbiddenResponse(res, {
          message: 'Accès non autorisé aux statistiques',
          error: 'STATS_ACCESS_DENIED',
          requiredRole: 'admin'
        });
      }

      const currentDate = new Date().toISOString().split('T')[0];

      const totalEmployeesResult = await db.query(
        'SELECT COUNT(*) as total FROM employees WHERE is_active = true',
        []
      );

      const presentTodayResult = await db.query(`
        SELECT COUNT(DISTINCT a.employee_id) as present_count
        FROM attendance a
        INNER JOIN employees e ON a.employee_id = e.employee_id
        WHERE a.record_date = $1
          AND a.check_in_time IS NOT NULL
          AND e.is_active = true
      `, [currentDate]);

      const checkedOutTodayResult = await db.query(`
        SELECT COUNT(DISTINCT a.employee_id) as checked_out_count
        FROM attendance a
        INNER JOIN employees e ON a.employee_id = e.employee_id
        WHERE a.record_date = $1
          AND a.check_out_time IS NOT NULL
          AND e.is_active = true
      `, [currentDate]);

      const lateTodayResult = await db.query(`
        SELECT COUNT(DISTINCT a.employee_id) as late_count
        FROM attendance a
        INNER JOIN employees e ON a.employee_id = e.employee_id
        WHERE a.record_date = $1
          AND a.status = 'late'
          AND e.is_active = true
      `, [currentDate]);

      const shiftStats = await this.getShiftStats(currentDate);

      const totalEmployees = parseInt(totalEmployeesResult.rows[0].total) || 0;
      const presentToday = parseInt(presentTodayResult.rows[0].present_count) || 0;
      const checkedOutToday = parseInt(checkedOutTodayResult.rows[0].checked_out_count) || 0;
      const lateToday = parseInt(lateTodayResult.rows[0].late_count) || 0;

      const stats = this.calculateStats(totalEmployees, presentToday, checkedOutToday, lateToday);

      res.json({
        success: true,
        data: {
          ...stats,
          byShift: shiftStats
        }
      });

    } catch (error) {
      console.error('❌ ERREUR getAttendanceStats:', error.message);
      this.sendServerError(res, 'Erreur serveur', error);
    }
  }

  async getTodayAttendance(req, res) {
    try {
      console.log('✅ getTodayAttendance appelé');
      req.query.date = new Date().toISOString().split('T')[0];
      return await this.getAllAttendance(req, res);
    } catch (error) {
      console.error('❌ ERREUR getTodayAttendance:', error.message);
      this.sendServerError(res, 'Erreur serveur', error);
    }
  }

  // ==================== ⭐ MÉTHODE processCheckOutFromRecord ====================

  /**
   * Traiter un check-out à partir d'un enregistrement existant
   */
  async processCheckOutFromRecord(existingRecord, employee, currentTime, checkType, confidence, authorizedBy) {
    try {
      console.log('🔄 processCheckOutFromRecord appelé pour:', employee.employee_id);

      // Calculer les heures travaillées
      let hoursWorked = '0.00';
      if (existingRecord.check_in_time) {
        hoursWorked = this.calculateHoursBetween(
          existingRecord.check_in_time.slice(0, 5),
          currentTime.slice(0, 5)
        );
      }

      // Mettre à jour le pointage
      const result = await db.query(`
        UPDATE attendance 
        SET 
          check_out_time = $1,
          hours_worked = $2,
          status = 'checked_out',
          verification_method = $3,
          face_confidence = $4,
          updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `, [
        currentTime,
        hoursWorked,
        checkType === 'facial' ? 'facial_recognition' : 'manual',
        confidence || null,
        existingRecord.id
      ]);

      // Récupérer le shift pour la notification
      const shiftInfo = await this.getEmployeeShiftConfig(employee.employee_id);

      // Notification
      try {
        await NotificationHelper.createAttendanceNotification(
          employee.id,
          'check_out',
          currentTime.slice(0, 5),
          {
            method: checkType === 'facial' ? 'facial_recognition' : 'manual',
            check_in_time: existingRecord.check_in_time?.slice(0, 5),
            hours_worked: hoursWorked,
            shift_name: shiftInfo.shiftName,
            authorized_by: authorizedBy
          }
        );
      } catch (notificationError) {
        console.warn('⚠️ Erreur création notification:', notificationError.message);
      }

      return {
        success: true,
        message: `Départ pointé à ${currentTime.slice(0, 5)} (${hoursWorked}h)`,
        checkType: 'check_out',
        employeeName: `${employee.first_name} ${employee.last_name}`,
        authorizedBy: authorizedBy,
        data: {
          id: result.rows[0].id,
          employeeId: employee.employee_id,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          employeeEmail: employee.email,
          employeeDepartment: employee.department,
          checkIn: existingRecord.check_in_time?.slice(0, 5) || '--:--',
          checkOut: currentTime.slice(0, 5),
          date: new Date().toISOString().split('T')[0],
          hoursWorked: hoursWorked,
          status: 'checked_out',
          shiftName: shiftInfo.shiftName,
          method: checkType === 'facial' ? 'facial_recognition' : 'manual'
        }
      };
      
    } catch (error) {
      console.error('❌ Erreur processCheckOutFromRecord:', error);
      throw error;
    }
  }

  // ==================== MÉTHODES DE POINTAGE ====================

  async markAttendance(req, res) {
    try {
      console.log('✅ markAttendance appelé');
      const { 
        employeeId, 
        checkType = 'auto', 
        confidence, 
        photo,
        date: targetDate
      } = req.body;
      
      console.log('📅 Pointage pour:', employeeId, '- Type:', checkType);
      console.log('📊 Données reçues:', req.body);
      
      if (!req.user) {
        return this.sendUnauthorizedResponse(res);
      }

      // ⭐ VÉRIFICATION DU POINTAGE MANUEL
      if (checkType === 'manual') {
        const isManualAllowed = await this.isManualCheckinEnabled();
        if (!isManualAllowed) {
          return res.status(403).json({
            success: false,
            message: '❌ Le pointage manuel est désactivé par l\'administrateur. Veuillez utiliser la reconnaissance faciale.'
          });
        }
      }

      const permissions = this.getRolePermissions(req.user.role);
      
      if (req.user.role === 'employee' || req.user.role === 'manager') {
        return this.sendForbiddenResponse(res, {
          message: 'Pointage non autorisé',
          error: 'ATTENDANCE_DENIED',
          requiredRole: 'admin'
        });
      }

      if (!employeeId || employeeId.trim() === '') {
        return this.sendBadRequestResponse(res, 'ID employé requis');
      }

      const now = new Date();
      const currentTime = now.toTimeString().split(' ')[0].slice(0, 8);
      
      let recordDate;
      if (targetDate) {
        const parsedDate = new Date(targetDate);
        if (isNaN(parsedDate.getTime())) {
          return this.sendBadRequestResponse(res, 'Date invalide');
        }
        recordDate = parsedDate.toISOString().split('T')[0];
      } else {
        recordDate = now.toISOString().split('T')[0];
      }
      
      console.log('📅 Date de pointage utilisée:', {
        dateFournie: targetDate,
        dateUtilisee: recordDate,
        aujourdHui: now.toISOString().split('T')[0]
      });

      const employee = await this.getEmployeeById(employeeId);
      if (!employee) {
        return this.sendNotFoundResponse(res, 'Employé non trouvé ou non actif');
      }

      const shiftInfo = await this.getEmployeeShiftConfig(employeeId);
      console.log(`👤 Shift employé: ${shiftInfo.shiftName}`);

      const existingRecord = await this.getAttendanceRecordByDate(employeeId, recordDate);

      if (existingRecord) {
        return await this.handleExistingRecord(
          req, res, existingRecord, employee, currentTime, recordDate, checkType, confidence, shiftInfo
        );
      } else {
        return await this.handleNewCheckIn(
          req, res, employee, currentTime, recordDate, checkType, confidence, shiftInfo
        );
      }

    } catch (error) {
      console.error('❌ ERREUR markAttendance:', error.message);
      this.sendServerError(res, 'Erreur serveur lors du pointage', error);
    }
  }

  async checkIn(req, res) {
    try {
      console.log('✅ checkIn appelé');

      if (!req.user) {
        return this.sendUnauthorizedResponse(res);
      }

      // ⭐ VÉRIFICATION DU POINTAGE MANUEL
      const isManualAllowed = await this.isManualCheckinEnabled();
      
      if (!isManualAllowed) {
        return res.status(403).json({
          success: false,
          message: '❌ Le pointage manuel est désactivé par l\'administrateur. Veuillez utiliser la reconnaissance faciale.'
        });
      }

      const permissions = this.getRolePermissions(req.user.role);
      
      if (req.user.role === 'employee' || req.user.role === 'manager') {
        return this.sendForbiddenResponse(res, {
          message: 'Pointage d\'arrivée non autorisé',
          error: 'CHECKIN_DENIED',
          requiredRole: 'admin'
        });
      }

      req.body.checkType = 'manual';
      return await this.markAttendance(req, res);

    } catch (error) {
      console.error('❌ ERREUR checkIn:', error.message);
      this.sendServerError(res, 'Erreur serveur', error);
    }
  }

  async checkOut(req, res) {
    try {
      const { employeeId } = req.body;
      console.log('✅ checkOut appelé pour:', employeeId);

      if (!req.user) {
        return this.sendUnauthorizedResponse(res);
      }

      // ⭐ VÉRIFICATION DU POINTAGE MANUEL
      const isManualAllowed = await this.isManualCheckinEnabled();
      
      if (!isManualAllowed) {
        return res.status(403).json({
          success: false,
          message: '❌ Le pointage manuel est désactivé par l\'administrateur.'
        });
      }

      const permissions = this.getRolePermissions(req.user.role);
      
      if (req.user.role === 'employee' || req.user.role === 'manager') {
        return this.sendForbiddenResponse(res, {
          message: 'Pointage de départ non autorisé',
          error: 'CHECKOUT_DENIED',
          requiredRole: 'admin'
        });
      }

      if (!employeeId) {
        return this.sendBadRequestResponse(res, 'ID employé requis');
      }

      const result = await this.processCheckOut(employeeId, req.user.email);
      
      res.json({
        success: true,
        message: `Départ pointé à ${result.checkOutTime} (${result.data.hoursWorked}h)`,
        authorizedBy: req.user.email,
        userRole: req.user.role,
        data: result.data
      });

    } catch (error) {
      console.error('❌ ERREUR checkOut:', error.message);
      this.sendServerError(res, 'Erreur serveur lors du pointage de départ', error);
    }
  }

  async facialCheckIn(req, res) {
    try {
      console.log('✅ facialCheckIn appelé');

      if (!req.user) {
        return this.sendUnauthorizedResponse(res);
      }

      const permissions = this.getRolePermissions(req.user.role);
      
      if (req.user.role === 'employee' || req.user.role === 'manager') {
        return this.sendForbiddenResponse(res, {
          message: 'Reconnaissance faciale non autorisée',
          error: 'FACIAL_CHECKIN_DENIED',
          requiredRole: 'admin'
        });
      }
      
      req.body.checkType = 'facial';
      return await this.markAttendance(req, res);

    } catch (error) {
      console.error('❌ ERREUR facialCheckIn:', error.message);
      this.sendServerError(res, 'Erreur serveur', error);
    }
  }

  async handleFullAttendance(req, res) {
    try {
      console.log('✅ handleFullAttendance appelé');
      
      // ⭐ VÉRIFICATION DU POINTAGE MANUEL
      const isManualAllowed = await this.isManualCheckinEnabled();
      
      if (!isManualAllowed) {
        return res.status(403).json({
          success: false,
          message: '❌ Le pointage manuel est désactivé par l\'administrateur.'
        });
      }
      
      const {
        employeeId,
        checkIn,
        checkOut,
        date: targetDate,
        checkType = 'manual',
        notes = '',
        shiftName = 'Standard',
        status: customStatus
      } = req.body;

      console.log('📊 Données pointage complet:', {
        employeeId,
        checkIn,
        checkOut,
        date: targetDate,
        checkType
      });

      if (!req.user) {
        return this.sendUnauthorizedResponse(res);
      }

      const permissions = this.getRolePermissions(req.user.role);
      
      if (req.user.role === 'employee' || req.user.role === 'manager') {
        return this.sendForbiddenResponse(res, {
          message: 'Création de pointage complet non autorisée',
          error: 'FULL_ATTENDANCE_DENIED',
          requiredRole: 'admin'
        });
      }

      if (!employeeId || !checkIn || !checkOut || !targetDate) {
        return this.sendBadRequestResponse(res, 'employeeId, checkIn, checkOut et date sont requis');
      }

      const parsedDate = new Date(targetDate);
      if (isNaN(parsedDate.getTime())) {
        return this.sendBadRequestResponse(res, 'Date invalide');
      }
      const recordDate = parsedDate.toISOString().split('T')[0];

      const employee = await this.getEmployeeById(employeeId);
      if (!employee) {
        return this.sendNotFoundResponse(res, 'Employé non trouvé ou non actif');
      }

      if (!this.isValidTimeFormat(checkIn) || !this.isValidTimeFormat(checkOut)) {
        return this.sendBadRequestResponse(res, 'Format d\'heure invalide. Utilisez HH:MM');
      }

      const hoursWorked = this.calculateHoursBetween(checkIn, checkOut);
      console.log('⏰ Heures calculées:', { checkIn, checkOut, hoursWorked });
      
      if (hoursWorked <= 0 || hoursWorked > 24) {
        return this.sendBadRequestResponse(res, 
          `Heures travaillées invalides: ${hoursWorked}h. Vérifiez les horaires (${checkIn} → ${checkOut})`
        );
      }

      const statusInfo = await this.determineAttendanceStatus(
        employee.employee_id,
        checkIn,
        recordDate
      );

      const existingRecord = await this.getAttendanceRecordByDate(employeeId, recordDate);

      if (existingRecord) {
        await db.query(
          `UPDATE attendance 
           SET check_in_time = $1, 
               check_out_time = $2, 
               hours_worked = $3,
               status = $4,
               notes = $5,
               shift_name = $6,
               verification_method = $7,
               updated_at = NOW()
           WHERE id = $8`,
          [checkIn, checkOut, hoursWorked, statusInfo.status, notes, shiftName, checkType, existingRecord.id]
        );
        
        console.log('🔄 Pointage existant mis à jour');
      } else {
        await db.query(
          `INSERT INTO attendance (
            employee_id, employee_name, department, check_in_time, check_out_time,
            record_date, attendance_date, status, notes, shift_name, hours_worked,
            verification_method, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
          [
            employee.employee_id,
            `${employee.first_name} ${employee.last_name}`,
            employee.department,
            checkIn,
            checkOut,
            recordDate,
            recordDate,
            statusInfo.status,
            notes,
            shiftName,
            hoursWorked,
            checkType
          ]
        );
        
        console.log('✅ Nouveau pointage complet créé');
      }

      try {
        await NotificationHelper.createAttendanceNotification(
          employee.id,
          'full_attendance',
          null,
          {
            method: checkType,
            check_in: checkIn,
            check_out: checkOut,
            hours_worked: hoursWorked,
            shift_name: shiftName,
            status: statusInfo.status,
            authorized_by: req.user.email,
            date: recordDate
          }
        );
      } catch (notificationError) {
        console.warn('⚠️ Erreur création notification:', notificationError.message);
      }

      return res.status(201).json({
        success: true,
        message: `Pointage complet enregistré le ${recordDate}: ${checkIn} - ${checkOut} (${hoursWorked}h) - ${statusInfo.label}`,
        checkType: 'full_attendance',
        employeeName: `${employee.first_name} ${employee.last_name}`,
        authorizedBy: req.user.email,
        userRole: req.user.role,
        data: {
          employeeId: employee.employee_id,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          employeeEmail: employee.email,
          employeeDepartment: employee.department,
          checkIn: checkIn,
          checkOut: checkOut,
          date: recordDate,
          hoursWorked: hoursWorked,
          status: statusInfo.status,
          statusLabel: statusInfo.label,
          shiftName: shiftName,
          method: checkType
        }
      });

    } catch (error) {
      console.error('❌ ERREUR handleFullAttendance:', error.message);
      this.sendServerError(res, 'Erreur serveur lors du pointage complet', error);
    }
  }

  async handleExistingRecord(req, res, existingRecord, employee, currentTime, recordDate, checkType, confidence, shiftInfo) {
    const hasCheckIn = existingRecord.check_in_time !== null;
    const hasCheckOut = existingRecord.check_out_time !== null;

    console.log('🔍 État du pointage existant:', {
      hasCheckIn,
      hasCheckOut,
      checkIn: existingRecord.check_in_time,
      checkOut: existingRecord.check_out_time,
      status: existingRecord.status,
      shiftName: existingRecord.shift_name
    });

    console.log('📊 Données reçues dans la requête:', {
      checkIn: req.body.checkIn,
      checkOut: req.body.checkOut,
      checkType: req.body.checkType,
      date: req.body.date
    });

    // CAS 1: Si checkIn ET checkOut sont fournis → Mise à jour complète
    if (req.body.checkIn && req.body.checkOut) {
      console.log('📝 Pointage complet fourni - Mise à jour de l\'existant');
      
      if (!this.isValidTimeFormat(req.body.checkIn) || !this.isValidTimeFormat(req.body.checkOut)) {
        return this.sendBadRequestResponse(res, 'Format d\'heure invalide. Utilisez HH:MM');
      }
      
      const hoursWorked = this.calculateHoursBetween(
        req.body.checkIn.slice(0, 5),
        req.body.checkOut.slice(0, 5)
      );
      
      console.log('⏰ Heures calculées:', { 
        checkIn: req.body.checkIn, 
        checkOut: req.body.checkOut, 
        hoursWorked 
      });
      
      if (hoursWorked <= 0 || hoursWorked > 24) {
        return this.sendBadRequestResponse(res, 
          `Heures travaillées invalides: ${hoursWorked}h. Vérifiez les horaires (${req.body.checkIn} → ${req.body.checkOut})`
        );
      }
      
      const statusInfo = await this.determineAttendanceStatus(
        employee.employee_id,
        req.body.checkIn,
        recordDate
      );
      
      const updateResult = await db.query(`
        UPDATE attendance 
        SET 
          check_in_time = $1,
          check_out_time = $2,
          hours_worked = $3,
          status = $4,
          shift_name = COALESCE($5, shift_name),
          notes = COALESCE($6, notes),
          verification_method = $7,
          updated_at = NOW(),
          corrected_by = $8,
          correction_date = NOW()
        WHERE id = $9
        RETURNING *
      `, [
        req.body.checkIn,
        req.body.checkOut,
        hoursWorked,
        statusInfo.status,
        shiftInfo.shiftName,
        req.body.notes || existingRecord.notes,
        'manual_correction',
        req.user.email,
        existingRecord.id
      ]);
      
      const updatedRecord = updateResult.rows[0];
      
      try {
        await NotificationHelper.createAttendanceNotification(
          employee.id,
          'attendance_updated',
          null,
          {
            method: 'manual_correction',
            original_check_in: existingRecord.check_in_time?.slice(0, 5),
            original_check_out: existingRecord.check_out_time?.slice(0, 5),
            new_check_in: req.body.checkIn,
            new_check_out: req.body.checkOut,
            hours_worked: hoursWorked,
            shift_name: shiftInfo.shiftName,
            status: statusInfo.status,
            authorized_by: req.user.email,
            date: recordDate
          }
        );
      } catch (notificationError) {
        console.warn('⚠️ Erreur création notification:', notificationError.message);
      }
      
      await db.query(
        `INSERT INTO attendance_corrections 
         (attendance_id, corrected_by, original_check_in, original_check_out, original_date, 
          new_check_in, new_check_out, new_date, correction_reason, corrected_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          existingRecord.id,
          req.user.email,
          existingRecord.check_in_time,
          existingRecord.check_out_time,
          recordDate,
          req.body.checkIn,
          req.body.checkOut,
          recordDate,
          `Mise à jour via markAttendance (shift: ${shiftInfo.shiftName})`
        ]
      );
      
      return res.json({
        success: true,
        message: `Pointage mis à jour: ${req.body.checkIn} - ${req.body.checkOut} (${hoursWorked}h) - ${statusInfo.label}`,
        checkType: 'full_update',
        employeeName: `${employee.first_name} ${employee.last_name}`,
        authorizedBy: req.user.email,
        userRole: req.user.role,
        data: {
          id: updatedRecord.id,
          employeeId: employee.employee_id,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          employeeEmail: employee.email,
          employeeDepartment: employee.department,
          checkIn: req.body.checkIn,
          checkOut: req.body.checkOut,
          date: recordDate,
          hoursWorked: hoursWorked,
          status: statusInfo.status,
          statusLabel: statusInfo.label,
          shiftName: shiftInfo.shiftName,
          method: 'manual_correction',
          originalCheckIn: existingRecord.check_in_time?.slice(0, 5),
          originalCheckOut: existingRecord.check_out_time?.slice(0, 5)
        }
      });
    }
    
    // CAS 2: Déjà check-in mais PAS check-out ET on fournit un check-out → Faire check-out
    else if (hasCheckIn && !hasCheckOut && req.body.checkOut) {
      console.log('🔄 Check-out pour un pointage existant');
      
      if (!this.isValidTimeFormat(req.body.checkOut)) {
        return this.sendBadRequestResponse(res, 'Format d\'heure de départ invalide');
      }
      
      const hoursWorked = this.calculateHoursBetween(
        existingRecord.check_in_time.slice(0, 5),
        req.body.checkOut.slice(0, 5)
      );
      
      console.log('⏰ Heures calculées:', { 
        checkIn: existingRecord.check_in_time.slice(0, 5), 
        checkOut: req.body.checkOut, 
        hoursWorked 
      });
      
      const updateResult = await db.query(`
        UPDATE attendance 
        SET 
          check_out_time = $1,
          hours_worked = $2,
          status = 'checked_out',
          verification_method = $3,
          updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `, [
        req.body.checkOut,
        hoursWorked,
        checkType === 'facial' ? 'facial_recognition' : 'manual',
        existingRecord.id
      ]);
      
      const updatedRecord = updateResult.rows[0];
      
      try {
        await NotificationHelper.createAttendanceNotification(
          employee.id,
          'check_out',
          req.body.checkOut.slice(0, 5),
          {
            method: checkType === 'facial' ? 'facial_recognition' : 'manual',
            check_in_time: existingRecord.check_in_time?.slice(0, 5),
            hours_worked: hoursWorked,
            shift_name: shiftInfo.shiftName,
            authorized_by: req.user.email
          }
        );
      } catch (notificationError) {
        console.warn('⚠️ Erreur création notification check-out:', notificationError.message);
      }
      
      return res.json({
        success: true,
        message: `Départ pointé à ${req.body.checkOut.slice(0, 5)} (${hoursWorked}h)`,
        checkType: 'check_out',
        employeeName: `${employee.first_name} ${employee.last_name}`,
        authorizedBy: req.user.email,
        userRole: req.user.role,
        data: {
          id: updatedRecord.id,
          employeeId: employee.employee_id,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          employeeEmail: employee.email,
          employeeDepartment: employee.department,
          checkIn: existingRecord.check_in_time?.slice(0, 5),
          checkOut: req.body.checkOut.slice(0, 5),
          date: recordDate,
          hoursWorked: hoursWorked,
          status: 'checked_out',
          shiftName: shiftInfo.shiftName,
          method: checkType === 'facial' ? 'facial_recognition' : 'manual'
        }
      });
    }
    
    // CAS 3: Déjà check-in ET check-out → Pointage complet
    else if (hasCheckIn && hasCheckOut) {
      console.log('⚠️ Pointage complet déjà existant');
      
      const hoursWorked = this.calculateHoursBetween(
        existingRecord.check_in_time.slice(0, 5),
        existingRecord.check_out_time.slice(0, 5)
      );
      
      return this.sendBadRequestResponse(res, {
        message: `Pointage complet déjà effectué: arrivée ${existingRecord.check_in_time?.slice(0, 5) || '--:--'}, départ ${existingRecord.check_out_time?.slice(0, 5) || '--:--'} (${hoursWorked}h)`,
        alreadyChecked: true,
        checkType: 'completed',
        employeeName: `${employee.first_name} ${employee.last_name}`,
        shiftName: existingRecord.shift_name || shiftInfo.shiftName,
        existingRecord: {
          id: existingRecord.id,
          employeeId: employee.employee_id,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          checkIn: existingRecord.check_in_time?.slice(0, 5),
          checkOut: existingRecord.check_out_time?.slice(0, 5),
          date: recordDate,
          hoursWorked: hoursWorked,
          status: existingRecord.status,
          shiftName: existingRecord.shift_name || shiftInfo.shiftName
        }
      });
    }
    
    // CAS 4: Pas de check-in mais on en fournit un → Mettre à jour le check-in
    else if (!hasCheckIn && req.body.checkIn) {
      console.log('🔄 Mise à jour du check-in pour un enregistrement existant');
      
      if (!this.isValidTimeFormat(req.body.checkIn)) {
        return this.sendBadRequestResponse(res, 'Format d\'heure d\'arrivée invalide');
      }
      
      const statusInfo = await this.determineAttendanceStatus(
        employee.employee_id,
        req.body.checkIn,
        recordDate
      );
      
      const updateResult = await db.query(`
        UPDATE attendance 
        SET 
          check_in_time = $1,
          status = $2,
          shift_name = $3,
          verification_method = $4,
          updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `, [
        req.body.checkIn,
        statusInfo.status,
        shiftInfo.shiftName,
        checkType === 'facial' ? 'facial_recognition' : 'manual',
        existingRecord.id
      ]);
      
      const updatedRecord = updateResult.rows[0];
      
      try {
        await NotificationHelper.createAttendanceNotification(
          employee.id,
          'check_in',
          req.body.checkIn.slice(0, 5),
          {
            method: checkType === 'facial' ? 'facial_recognition' : 'manual',
            status: statusInfo.status,
            is_late: statusInfo.isLate,
            shift_name: shiftInfo.shiftName,
            authorized_by: req.user.email
          }
        );
      } catch (notificationError) {
        console.warn('⚠️ Erreur création notification:', notificationError.message);
      }
      
      return res.json({
        success: true,
        message: `Arrivée mise à jour à ${req.body.checkIn.slice(0, 5)} (check-in) - ${statusInfo.label}`,
        checkType: 'check_in',
        employeeName: `${employee.first_name} ${employee.last_name}`,
        authorizedBy: req.user.email,
        userRole: req.user.role,
        data: {
          id: updatedRecord.id,
          employeeId: employee.employee_id,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          employeeEmail: employee.email,
          employeeDepartment: employee.department,
          checkIn: req.body.checkIn.slice(0, 5),
          date: recordDate,
          status: updatedRecord.status,
          statusLabel: statusInfo.label,
          shiftName: shiftInfo.shiftName,
          method: checkType === 'facial' ? 'facial_recognition' : 'manual',
          isLate: statusInfo.isLate
        }
      });
    }
    
    // CAS 5: Aucune action possible
    else {
      console.log('⚠️ Aucune action possible avec les données fournies');
      
      return this.sendBadRequestResponse(res, {
        message: 'Action non valide pour l\'état actuel du pointage',
        currentStatus: {
          hasCheckIn,
          hasCheckOut,
          checkIn: existingRecord.check_in_time?.slice(0, 5),
          checkOut: existingRecord.check_out_time?.slice(0, 5),
          shiftName: existingRecord.shift_name || shiftInfo.shiftName
        },
        requiredAction: !hasCheckIn ? 'Fournir checkIn' : (hasCheckIn && !hasCheckOut ? 'Fournir checkOut' : 'Utiliser la route de correction')
      });
    }
  }

  async handleNewCheckIn(req, res, employee, currentTime, recordDate, checkType, confidence, shiftInfo) {
    console.log('🔄 Auto check-in pour:', employee.employee_id, 'le', recordDate);
    console.log(`👤 Shift: ${shiftInfo.shiftName}`);

    const statusInfo = await this.determineAttendanceStatus(
      employee.employee_id,
      currentTime,
      recordDate
    );

    const result = await db.query(`
      INSERT INTO attendance (
        employee_id,
        employee_name,
        department,
        check_in_time,
        record_date,
        attendance_date,
        status,
        shift_name,
        verification_method,
        face_confidence,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING id, employee_id, check_in_time, record_date, status, shift_name
    `, [
      employee.employee_id,
      `${employee.first_name} ${employee.last_name}`,
      employee.department,
      currentTime,
      recordDate,
      recordDate,
      statusInfo.status,
      shiftInfo.shiftName,
      checkType === 'facial' ? 'facial_recognition' : 'manual',
      confidence || null
    ]);

    const newRecord = result.rows[0];

    try {
      await NotificationHelper.createAttendanceNotification(
        employee.id,
        'check_in',
        currentTime.slice(0, 5),
        {
          method: checkType === 'facial' ? 'facial_recognition' : 'manual',
          status: statusInfo.status,
          is_late: statusInfo.isLate,
          shift_name: shiftInfo.shiftName,
          shift_start: shiftInfo.config.start,
          late_threshold: shiftInfo.config.lateThreshold,
          authorized_by: req.user.email,
          date: recordDate
        }
      );
    } catch (notificationError) {
      console.warn('⚠️ Erreur création notification:', notificationError.message);
    }

    return res.status(201).json({
      success: true,
      message: `Arrivée pointée à ${currentTime.slice(0, 5)} (check-in) le ${recordDate}`,
      checkType: 'check_in',
      employeeName: `${employee.first_name} ${employee.last_name}`,
      authorizedBy: req.user.email,
      userRole: req.user.role,
      data: {
        id: newRecord.id,
        employeeId: newRecord.employee_id,
        employeeName: `${employee.first_name} ${employee.last_name}`,
        employeeEmail: employee.email,
        employeeDepartment: employee.department,
        checkIn: currentTime.slice(0, 5),
        date: recordDate,
        status: newRecord.status,
        statusLabel: statusInfo.label,
        shiftName: shiftInfo.shiftName,
        method: checkType === 'facial' ? 'facial_recognition' : 'manual',
        confidence: confidence || null,
        isLate: statusInfo.isLate,
        isHalfDay: statusInfo.isHalfDay
      }
    });
  }

  async updateAttendance(req, res) {
    try {
      const { id } = req.params;
      const { checkIn, checkOut, status } = req.body;

      console.log('✅ updateAttendance appelé pour ID:', id);

      if (!req.user) {
        return this.sendUnauthorizedResponse(res);
      }

      const permissions = this.getRolePermissions(req.user.role);
      
      if (req.user.role === 'employee' || req.user.role === 'manager') {
        return this.sendForbiddenResponse(res, {
          message: 'Modification de pointage non autorisée',
          error: 'UPDATE_ATTENDANCE_DENIED',
          requiredRole: 'admin'
        });
      }
      
      const result = await this.processAttendanceUpdate(id, checkIn, checkOut, status, req.user.email);
      
      res.json({
        success: true,
        message: 'Présence mise à jour',
        userRole: req.user.role,
        data: result
      });

    } catch (error) {
      console.error('❌ ERREUR updateAttendance:', error.message);
      this.sendServerError(res, 'Erreur serveur', error);
    }
  }

  async checkTodayStatus(req, res) {
    try {
      const { employeeId } = req.params;
      console.log('✅ checkTodayStatus appelé pour:', employeeId);

      if (!req.user) {
        return this.sendUnauthorizedResponse(res);
      }

      const permissions = this.getRolePermissions(req.user.role);
      
      if (req.user.role === 'employee') {
        const userEmployeeId = req.user.employee_code || req.user.employee_id;
        if (employeeId !== userEmployeeId) {
          return this.sendForbiddenResponse(res, {
            message: 'Vous ne pouvez vérifier que votre propre statut',
            error: 'SELF_STATUS_ONLY'
          });
        }
      }
      
      if (req.user.role === 'manager') {
        const employee = await this.getEmployeeById(employeeId);
        if (!employee) {
          return this.sendNotFoundResponse(res, 'Employé non trouvé');
        }
        
        if (employee.department !== req.user.department) {
          return this.sendForbiddenResponse(res, {
            message: `Vous ne pouvez vérifier que les employés du département ${req.user.department}`,
            error: 'DEPARTMENT_RESTRICTION'
          });
        }
      }

      if (!employeeId || employeeId.trim() === '') {
        return this.sendBadRequestResponse(res, 'ID employé requis');
      }

      const result = await this.getEmployeeTodayStatus(employeeId);
      
      const shiftInfo = await this.getEmployeeShiftConfig(employeeId);
      
      res.json({
        success: true,
        message: result.message,
        alreadyChecked: result.alreadyChecked,
        checkType: result.checkType,
        employeeName: result.employeeName,
        canCheckIn: result.canCheckIn,
        canCheckOut: result.canCheckOut,
        shiftInfo: {
          name: shiftInfo.shiftName,
          config: shiftInfo.config
        },
        existingRecord: result.existingRecord,
        employee: result.employee,
        userRole: req.user.role
      });

    } catch (error) {
      console.error('❌ ERREUR checkTodayStatus:', error.message);
      this.sendServerError(res, 'Erreur serveur lors de la vérification', error);
    }
  }

  async resetTodayAttendance(req, res) {
    try {
      const { employeeId } = req.params;
      console.log('✅ resetTodayAttendance appelé pour:', employeeId);

      if (!req.user) {
        return this.sendUnauthorizedResponse(res);
      }

      const permissions = this.getRolePermissions(req.user.role);
      
      if (req.user.role === 'employee' || req.user.role === 'manager') {
        return this.sendForbiddenResponse(res, {
          message: 'Réinitialisation de pointage non autorisée',
          error: 'RESET_ATTENDANCE_DENIED',
          requiredRole: 'admin'
        });
      }
      
      if (!employeeId || employeeId.trim() === '') {
        return this.sendBadRequestResponse(res, 'ID employé requis');
      }

      const result = await this.processAttendanceReset(employeeId, req.user.email);
      
      res.json({
        success: true,
        message: result.message,
        action: result.action,
        employeeName: result.employeeName,
        deletedRecord: result.deletedRecord,
        userRole: req.user.role
      });

    } catch (error) {
      console.error('❌ ERREUR resetTodayAttendance:', error.message);
      this.sendServerError(res, 'Erreur serveur lors de la réinitialisation', error);
    }
  }

  // ==================== MÉTHODES DE TRAITEMENT ====================

  async processCheckOut(employeeId, authorizedBy) {
    const currentTime = new Date().toTimeString().split(' ')[0].slice(0, 8);
    const currentDate = new Date().toISOString().split('T')[0];

    const checkInResult = await db.query(`
      SELECT id, check_in_time 
      FROM attendance 
      WHERE employee_id = $1 
        AND record_date = $2
        AND check_out_time IS NULL
        AND check_in_time IS NOT NULL
      ORDER BY check_in_time DESC
      LIMIT 1
    `, [employeeId, currentDate]);

    if (checkInResult.rows.length === 0) {
      throw new Error("Aucun pointage d'arrivée trouvé pour aujourd'hui");
    }

    const attendanceRecord = checkInResult.rows[0];

    let hoursWorked = '0.00';
    if (attendanceRecord.check_in_time) {
      hoursWorked = this.calculateHoursBetween(
        attendanceRecord.check_in_time.slice(0, 5),
        currentTime.slice(0, 5)
      );
    }

    console.log('⏰ Heures calculées check-out:', {
      checkIn: attendanceRecord.check_in_time.slice(0, 5),
      checkOut: currentTime.slice(0, 5),
      hoursWorked
    });

    const updateResult = await db.query(`
      UPDATE attendance 
      SET 
        check_out_time = $1,
        hours_worked = $2,
        status = 'checked_out',
        verification_method = 'manual',
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [currentTime, hoursWorked, attendanceRecord.id]);

    const employeeResult = await db.query(
      'SELECT id, first_name, last_name, email, department FROM employees WHERE employee_id = $1',
      [employeeId]
    );

    const employee = employeeResult.rows[0] || {};
    const employeeName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim();

    const shiftInfo = await this.getEmployeeShiftConfig(employeeId);

    try {
      await NotificationHelper.createAttendanceNotification(
        employee.id,
        'check_out',
        currentTime.slice(0, 5),
        {
          method: 'manual',
          check_in_time: attendanceRecord.check_in_time?.slice(0, 5),
          hours_worked: hoursWorked,
          shift_name: shiftInfo.shiftName,
          authorized_by: authorizedBy
        }
      );
    } catch (notificationError) {
      console.warn('⚠️ Erreur création notification check-out manuel:', notificationError.message);
    }

    return {
      checkOutTime: currentTime.slice(0, 5),
      data: {
        id: updateResult.rows[0].id,
        employeeId: employeeId,
        employeeName: employeeName,
        employeeEmail: employee.email,
        employeeDepartment: employee.department,
        checkIn: attendanceRecord.check_in_time?.slice(0, 5) || '--:--',
        checkOut: currentTime.slice(0, 5),
        date: currentDate,
        hoursWorked: hoursWorked,
        status: 'checked_out',
        shiftName: shiftInfo.shiftName,
        method: 'manual'
      }
    };
  }

  async processAttendanceUpdate(id, checkIn, checkOut, status, authorizedBy) {
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (checkIn !== undefined) {
      updates.push(`check_in_time = $${paramCount}`);
      params.push(checkIn);
      paramCount++;
    }

    if (checkOut !== undefined) {
      updates.push(`check_out_time = $${paramCount}`);
      params.push(checkOut);
      paramCount++;
    }

    if (status !== undefined) {
      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (checkIn !== undefined && checkOut !== undefined) {
      const hoursWorked = this.calculateHoursBetween(checkIn, checkOut);
      updates.push(`hours_worked = $${paramCount}`);
      params.push(hoursWorked);
      paramCount++;
    }

    if (updates.length === 0) {
      throw new Error('Aucune donnée à mettre à jour');
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    const query = `
      UPDATE attendance 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, params);
    const attendanceRecord = result.rows[0];

    if (attendanceRecord) {
      try {
        const employeeResult = await db.query(
          'SELECT id, first_name, last_name FROM employees WHERE employee_id = $1',
          [attendanceRecord.employee_id]
        );

        if (employeeResult.rows[0]) {
          const employee = employeeResult.rows[0];
          const employeeName = `${employee.first_name} ${employee.last_name}`;

          await NotificationHelper.createSystemNotification(
            'Pointage modifié',
            `Le pointage de ${employeeName} a été modifié par ${authorizedBy}`,
            'medium',
            employee.id
          );
        }
      } catch (notificationError) {
        console.warn('⚠️ Erreur création notification modification:', notificationError.message);
      }
    }

    return attendanceRecord;
  }

  async processAttendanceReset(employeeId, authorizedBy) {
    const currentDate = new Date().toISOString().split('T')[0];

    const employeeResult = await db.query(
      'SELECT id, employee_id, first_name, last_name FROM employees WHERE employee_id = $1',
      [employeeId]
    );

    if (employeeResult.rows.length === 0) {
      throw new Error('Employé non trouvé');
    }

    const employee = employeeResult.rows[0];
    const employeeName = `${employee.first_name} ${employee.last_name}`;

    const deleteResult = await db.query(
      'DELETE FROM attendance WHERE employee_id = $1 AND record_date = $2 RETURNING *',
      [employeeId, currentDate]
    );

    if (deleteResult.rows.length > 0) {
      const deleted = deleteResult.rows[0];

      try {
        await NotificationHelper.createSystemNotification(
          'Pointage réinitialisé',
          `Le pointage de ${employeeName} pour aujourd'hui a été réinitialisé par ${authorizedBy}`,
          'high',
          employee.id
        );
      } catch (notificationError) {
        console.warn('⚠️ Erreur création notification réinitialisation:', notificationError.message);
      }

      return {
        message: `Pointage réinitialisé pour ${employeeName}`,
        action: 'deleted',
        employeeName: employeeName,
        deletedRecord: {
          id: deleted.id,
          employeeId: deleted.employee_id,
          checkIn: deleted.check_in_time?.slice(0, 5) || null,
          checkOut: deleted.check_out_time?.slice(0, 5) || null,
          date: currentDate,
          status: deleted.status,
          shiftName: deleted.shift_name
        }
      };
    } else {
      return {
        message: "Aucun pointage trouvé pour aujourd'hui",
        employeeName: employeeName
      };
    }
  }

  async getEmployeeTodayStatus(employeeId) {
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().split(' ')[0].slice(0, 8);

    const employeeResult = await db.query(
      'SELECT id, employee_id, first_name, last_name FROM employees WHERE employee_id = $1 AND is_active = true',
      [employeeId]
    );

    if (employeeResult.rows.length === 0) {
      return {
        success: false,
        message: 'Employé non trouvé ou non actif',
        alreadyChecked: false,
        checkType: 'employee_not_found'
      };
    }

    const employee = employeeResult.rows[0];
    const employeeName = `${employee.first_name} ${employee.last_name}`;

    const existingCheck = await db.query(
      `SELECT id, check_in_time, check_out_time, status, shift_name FROM attendance 
       WHERE employee_id = $1 
       AND record_date = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [employeeId, currentDate]
    );

    if (existingCheck.rows.length > 0) {
      const existingRecord = existingCheck.rows[0];
      const checkInTime = existingRecord.check_in_time?.slice(0, 5) || '--:--';
      const checkOutTime = existingRecord.check_out_time?.slice(0, 5) || null;

      let message = `Déjà pointé aujourd'hui à ${checkInTime}`;
      let checkType = 'check_in_only';

      if (checkOutTime) {
        const hoursWorked = this.calculateHoursBetween(checkInTime, checkOutTime);
        message = `Pointage complet: arrivée ${checkInTime}, départ ${checkOutTime} (${hoursWorked}h) - Shift: ${existingRecord.shift_name || 'Standard'}`;
        checkType = 'completed';
      } else {
        const hoursSinceCheckIn = this.calculateHoursBetween(
          checkInTime,
          currentTime.slice(0, 5)
        );
        message = `Arrivée pointée à ${checkInTime} - Prêt pour le départ (${hoursSinceCheckIn}h depuis) - Shift: ${existingRecord.shift_name || 'Standard'}`;
        checkType = 'ready_for_check_out';
      }

      const hoursSinceCheckIn = checkOutTime ? null : this.calculateHoursBetween(
        checkInTime,
        currentTime.slice(0, 5)
      );

      return {
        message,
        alreadyChecked: true,
        checkType,
        employeeName: employeeName,
        canCheckIn: false,
        canCheckOut: false,
        existingRecord: {
          id: existingRecord.id,
          employeeId: employee.employee_id,
          employeeName: employeeName,
          checkIn: checkInTime,
          checkOut: checkOutTime,
          date: currentDate,
          status: existingRecord.status,
          shiftName: existingRecord.shift_name,
          currentTime: currentTime.slice(0, 5),
          canCheckOut: false,
          hoursSinceCheckIn: hoursSinceCheckIn
        }
      };
    }

    const shiftInfo = await this.getEmployeeShiftConfig(employeeId);

    return {
      message: `Prêt pour le pointage d'arrivée - Aucun pointage trouvé pour aujourd'hui (Shift: ${shiftInfo.shiftName})`,
      alreadyChecked: false,
      checkType: 'not_checked',
      canCheckIn: true,
      canCheckOut: false,
      employeeName: employeeName,
      shiftInfo: {
        name: shiftInfo.shiftName,
        config: shiftInfo.config
      },
      employee: {
        id: employee.id,
        employeeId: employee.employee_id,
        employeeName: employeeName,
        currentTime: currentTime.slice(0, 5),
        currentDate: currentDate
      }
    };
  }

  // ==================== MÉTHODES UTILITAIRES ====================

  async getEmployeeById(employeeId) {
    const result = await db.query(
      'SELECT id, employee_id, first_name, last_name, email, department FROM employees WHERE employee_id = $1 AND is_active = true',
      [employeeId]
    );
    return result.rows[0] || null;
  }

  async getAttendanceRecordByDate(employeeId, date) {
    const result = await db.query(
      `SELECT id, check_in_time, check_out_time, status, shift_name FROM attendance 
       WHERE employee_id = $1 
       AND record_date = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [employeeId, date]
    );
    return result.rows[0] || null;
  }

  async formatAttendanceDataWithShifts(rows) {
    const formattedRows = [];
    
    for (const row of rows) {
      const firstName = row.first_name || '';
      const lastName = row.last_name || '';
      let employeeName = `${firstName} ${lastName}`.trim();
      const employeeCode = row.employee_code || row.attendance_employee_code || 'N/D';

      if (!employeeName || employeeName === '' || employeeName === 'À identifier') {
        if (row.email) {
          employeeName = row.email.split('@')[0];
        } else {
          employeeName = `Employé ${employeeCode}`;
        }
      }

      const checkIn = row.check_in_time ? row.check_in_time.slice(0, 5) : null;
      const checkOut = row.check_out_time ? row.check_out_time.slice(0, 5) : null;
      
      let hoursWorked = '0.00';
      if (checkIn && checkOut) {
        hoursWorked = this.calculateHoursBetween(checkIn, checkOut);
      }

      let shiftName = row.shift_name || row.employee_shift || 'Shift Standard';
      
      if (!shiftName || shiftName === 'Shift Standard') {
        try {
          const shiftInfo = await this.getEmployeeShiftConfig(row.employee_code);
          shiftName = shiftInfo.shiftName;
        } catch (error) {
          // Ignorer
        }
      }

      formattedRows.push({
        id: row.attendance_id,
        employeeId: employeeCode,
        employeeName: employeeName,
        firstName: firstName,
        lastName: lastName,
        email: row.email || '',
        phone: row.phone || '',
        department: row.department || 'Non spécifié',
        position: row.position || '',
        role: row.role || 'employee',
        date: row.record_date || row.attendance_date,
        checkIn: checkIn,
        checkOut: checkOut,
        hoursWorked: hoursWorked,
        status: row.status || 'not_checked',
        notes: row.notes || '',
        shiftName: shiftName,
        employeeStatus: row.is_active ? 'Actif' : 'Inactif',
        hasFaceRegistered: row.has_face_registered || false,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
    }
    
    return formattedRows;
  }

  formatAttendanceData(rows) {
    return rows.map(row => {
      const firstName = row.first_name || '';
      const lastName = row.last_name || '';
      let employeeName = `${firstName} ${lastName}`.trim();
      const employeeCode = row.employee_code || row.attendance_employee_code || 'N/D';

      if (!employeeName || employeeName === '' || employeeName === 'À identifier') {
        if (row.email) {
          employeeName = row.email.split('@')[0];
        } else {
          employeeName = `Employé ${employeeCode}`;
        }
      }

      const checkIn = row.check_in_time ? row.check_in_time.slice(0, 5) : null;
      const checkOut = row.check_out_time ? row.check_out_time.slice(0, 5) : null;
      
      let hoursWorked = '0.00';
      if (checkIn && checkOut) {
        hoursWorked = this.calculateHoursBetween(checkIn, checkOut);
      }

      return {
        id: row.attendance_id,
        employeeId: employeeCode,
        employeeName: employeeName,
        firstName: firstName,
        lastName: lastName,
        email: row.email || '',
        phone: row.phone || '',
        department: row.department || 'Non spécifié',
        position: row.position || '',
        role: row.role || 'employee',
        date: row.record_date || row.attendance_date,
        checkIn: checkIn,
        checkOut: checkOut,
        hoursWorked: hoursWorked,
        status: row.status || 'not_checked',
        notes: row.notes || '',
        shiftName: row.shift_name || '',
        employeeStatus: row.is_active ? 'Actif' : 'Inactif',
        hasFaceRegistered: row.has_face_registered || false,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });
  }

  isValidTimeFormat(time) {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  calculateHoursBetween(startTime, endTime) {
    try {
      if (!startTime || !endTime) return '0.00';
      
      const [inHour, inMinute] = startTime.split(':').map(Number);
      const [outHour, outMinute] = endTime.split(':').map(Number);
      
      let inMinutes = inHour * 60 + inMinute;
      let outMinutes = outHour * 60 + outMinute;
      
      if (outMinutes < inMinutes) {
        outMinutes += 24 * 60;
      }
      
      const totalMinutes = outMinutes - inMinutes;
      const hours = (totalMinutes / 60).toFixed(2);
      const hoursFloat = parseFloat(hours);
      
      if (hoursFloat <= 0 || hoursFloat > 24) {
        console.warn('⚠️ Heures invalides calculées:', { startTime, endTime, hours });
        return '0.00';
      }
      
      return hours;
      
    } catch (error) {
      console.error('❌ Erreur calculateHoursBetween:', error);
      return '0.00';
    }
  }

  calculateHoursDifference(startTime, endTime) {
    return this.calculateHoursBetween(startTime, endTime);
  }

  calculateStats(totalEmployees, presentToday, checkedOutToday, lateToday) {
    const currentlyInOffice = Math.max(0, presentToday - checkedOutToday);
    const absent = Math.max(0, totalEmployees - presentToday);
    const onTime = Math.max(0, presentToday - lateToday);
    
    let attendanceRate = '0.00';
    if (totalEmployees > 0) {
      const rate = (presentToday / totalEmployees) * 100;
      attendanceRate = Math.min(100, rate).toFixed(2);
    }

    return {
      today: {
        date: new Date().toISOString().split('T')[0],
        total_employees: totalEmployees,
        present: presentToday,
        checked_out: checkedOutToday,
        currently_in_office: currentlyInOffice,
        absent: absent,
        late: lateToday,
        on_time: onTime,
        attendance_rate: attendanceRate
      }
    };
  }

  // ==================== MÉTHODES DE RÉPONSE ====================

  sendUnauthorizedResponse(res) {
    return res.status(401).json({
      success: false,
      message: 'Non autorisé'
    });
  }

  sendForbiddenResponse(res, data) {
    if (typeof data === 'string') {
      return res.status(403).json({
        success: false,
        message: data
      });
    }
    return res.status(403).json({
      success: false,
      ...data
    });
  }

  sendBadRequestResponse(res, message) {
    return res.status(400).json({
      success: false,
      message
    });
  }

  sendNotFoundResponse(res, message) {
    return res.status(404).json({
      success: false,
      message
    });
  }

  sendServerError(res, message, error) {
    return res.status(500).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Exporter l'instance du contrôleur
module.exports = new AttendanceController();