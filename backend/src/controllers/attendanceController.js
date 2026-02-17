// backend/src/controllers/attendanceController. 
const db = require('../../config/db');
const NotificationHelper = require('../utils/notificationHelper');

class AttendanceController {
  constructor() {
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
    this.handleNewCheckIn = this.handleNewCheckIn.bind(this);
  }

  // ==================== CONFIGURATION DES RÔLES ==================== 
  
  /**
   * Configuration des permissions par rôle
   */
  getRolePermissions(role) {
    const permissions = {
      admin: {
        // Admin a tous les droits
        canViewAll: true,
        canViewAllDepartments: true,
        canEditAttendance: true,
        canEditSettings: true,
        canManageEmployees: true,
        canManagePayroll: true,
        canCheckInOthers: true, // Admin peut pointer les autres
        canCheckOutOthers: true, // Admin peut pointer les autres
        canViewReports: true, // Admin voit les rapports
        canViewPayroll: true, // Admin voit la paie
        canViewStats: true, // Admin voit les statistiques
        canDoFacialCheckIn: true, // Admin peut faire reconnaissance faciale
        canDoManualCheckIn: true, // Admin peut faire pointage manuel
        filterDepartment: null // Pas de filtre
      },
      manager: {
        // Manager = Lecture seule de son département
        canViewAll: false,
        canViewAllDepartments: false, // Voir uniquement son département
        canEditAttendance: false, // Pas de modification
        canEditSettings: false,
        canManageEmployees: false,
        canManagePayroll: false,
        canCheckInOthers: false, // Ne peut pointer personne
        canCheckOutOthers: false, // Ne peut pointer personne
        canViewReports: false, // Pas d'accès aux rapports
        canViewPayroll: false, // Pas d'accès à la paie
        canViewStats: false, // Pas d'accès aux statistiques
        canDoFacialCheckIn: false, // Pas de reconnaissance faciale
        canDoManualCheckIn: false, // Pas de pointage manuel
        filterDepartment: true // Filtrer par son département
      },
      employee: {
        // Employé standard
        canViewAll: false,
        canViewAllDepartments: false, // Voir uniquement ses données
        canEditAttendance: false,
        canEditSettings: false,
        canManageEmployees: false,
        canManagePayroll: false,
        canCheckInOthers: false,
        canCheckOutOthers: false,
        canViewReports: false,
        canViewPayroll: false,
        canViewStats: false,
        canDoFacialCheckIn: false, // Uniquement sur terminal dédié
        canDoManualCheckIn: false,
        filterDepartment: false // Pas de département à filtrer (juste soi-même)
      }
    };
    
    return permissions[role] || permissions.employee;
  }

  // ==================== MÉTHODES DE RÉCUPÉRATION ====================

  /**
   * Récupérer tous les enregistrements de présence
   */
  async getAllAttendance(req, res) {
    try {
      console.log('📅 ========== getAllAttendance ==========');
      console.log('📅 Query params:', req.query);
      console.log(`👤 Utilisateur: ${req.user?.email} - Rôle: ${req.user?.role} - Département: ${req.user?.department}`);

      const { limit = 50, startDate, endDate, status, employeeId, employeeCode, date } = req.query;

      if (!req.user) {
        return this.sendUnauthorizedResponse(res);
      }

      // Récupérer les permissions selon le rôle
      const permissions = this.getRolePermissions(req.user.role);

      // Construire la requête de base avec jointure
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
          e.phone
        FROM attendance a
        LEFT JOIN employees e ON e.employee_id = a.employee_id
        WHERE 1=1
      `;

      const params = [];
      let paramCount = 1;

      // ========== APPLIQUER LES FILTRES PAR RÔLE ==========
      
      // EMPLOYÉ : Ne peut voir que ses propres données
      if (req.user.role === 'employee') {
        query += ` AND e.employee_id = $${paramCount}`;
        params.push(req.user.employee_code || req.user.employee_id || req.user.id);
        paramCount++;
      }
      
      // MANAGER : Ne peut voir que les employés de son département
      else if (req.user.role === 'manager' && req.user.department) {
        query += ` AND e.department = $${paramCount}`;
        params.push(req.user.department);
        paramCount++;
      }
      
      // ADMIN : Pas de filtre supplémentaire

      // ========== FILTRES GÉNÉRAUX ==========
      
      // Filtre par date spécifique (prioritaire sur startDate/endDate)
      if (date) {
        query += ` AND DATE(a.record_date) = DATE($${paramCount})`;
        params.push(date);
        paramCount++;
      }
      
      // Filtre par plage de dates
      else if (startDate && endDate) {
        query += ` AND DATE(a.record_date) BETWEEN DATE($${paramCount}) AND DATE($${paramCount + 1})`;
        params.push(startDate, endDate);
        paramCount += 2;
      }

      // Filtre par statut
      if (status && status !== 'all') {
        query += ` AND a.status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      // Filtre par code employé (pour la recherche)
      if (employeeCode && !employeeId) {
        query += ` AND (e.employee_id ILIKE $${paramCount} OR e.email ILIKE $${paramCount + 1})`;
        params.push(`%${employeeCode}%`, `%${employeeCode}%`);
        paramCount += 2;
      }

      // Ordonner et limiter
      query += ` ORDER BY a.record_date DESC, a.check_in_time DESC`;
      if (limit) {
        query += ` LIMIT $${paramCount}`;
        params.push(parseInt(limit));
      }

      console.log('📝 Requête SQL:', query);
      console.log('📊 Paramètres:', params);

      const result = await db.query(query, params);
      console.log(`📅 ${result.rows.length} enregistrements trouvés`);

      // Formater les données
      const formattedData = this.formatAttendanceData(result.rows);

      res.json({
        success: true,
        data: formattedData,
        meta: {
          count: formattedData.length,
          userRole: req.user.role,
          userDepartment: req.user.department,
          dateRange: startDate && endDate ? `${startDate} à ${endDate}` : "Aujourd'hui",
          permissions: permissions
        }
      });

    } catch (error) {
      console.error('❌ ERREUR getAllAttendance:', error.message);
      this.sendServerError(res, 'Erreur lors de la récupération des présences', error);
    }
  }

  /**
   * Récupérer les statistiques de présence - INTERDIT POUR MANAGER ET EMPLOYÉ
   */
  async getAttendanceStats(req, res) {
    try {
      console.log('✅ getAttendanceStats appelé');

      if (!req.user) {
        return this.sendUnauthorizedResponse(res);
      }

      // ========== VÉRIFIER LES PERMISSIONS ==========
      const permissions = this.getRolePermissions(req.user.role);
      
      // EMPLOYÉ et MANAGER : Pas d'accès aux statistiques
      if (req.user.role === 'employee' || req.user.role === 'manager') {
        return this.sendForbiddenResponse(res, {
          message: 'Accès non autorisé aux statistiques',
          error: 'STATS_ACCESS_DENIED',
          requiredRole: 'admin'
        });
      }

      // Seul l'admin peut continuer
      const currentDate = new Date().toISOString().split('T')[0];

      // Requête pour tous les employés actifs
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

      // Extraire les résultats
      const totalEmployees = parseInt(totalEmployeesResult.rows[0].total) || 0;
      const presentToday = parseInt(presentTodayResult.rows[0].present_count) || 0;
      const checkedOutToday = parseInt(checkedOutTodayResult.rows[0].checked_out_count) || 0;
      const lateToday = parseInt(lateTodayResult.rows[0].late_count) || 0;

      // Calculer les statistiques
      const stats = this.calculateStats(totalEmployees, presentToday, checkedOutToday, lateToday);

      console.log('📊 Statistiques calculées:', {
        totalEmployees,
        presentToday,
        checkedOutToday,
        attendanceRate: stats.today.attendance_rate,
        userRole: req.user.role
      });

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('❌ ERREUR getAttendanceStats:', error.message);
      this.sendServerError(res, 'Erreur serveur', error);
    }
  }

  /**
   * Récupérer les présences du jour
   */
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

  // ==================== MÉTHODES DE POINTAGE ====================

  /**
   * Méthode unifiée de pointage - SEUL ADMIN AUTORISÉ
   */
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

      // ========== VÉRIFIER LES PERMISSIONS ==========
      const permissions = this.getRolePermissions(req.user.role);
      
      // EMPLOYÉ et MANAGER : Pas de permission de pointage
      if (req.user.role === 'employee' || req.user.role === 'manager') {
        return this.sendForbiddenResponse(res, {
          message: 'Pointage non autorisé',
          error: 'ATTENDANCE_DENIED',
          requiredRole: 'admin',
          instructions: 'Seuls les administrateurs peuvent effectuer des pointages'
        });
      }
      
      // Seul l'admin peut continuer
      // Admin peut pointer n'importe quel employé

      // Valider l'ID employé
      if (!employeeId || employeeId.trim() === '') {
        return this.sendBadRequestResponse(res, 'ID employé requis');
      }

      const now = new Date();
      const currentTime = now.toTimeString().split(' ')[0].slice(0, 8);
      
      // UTILISER LA DATE FOURNIE OU LA DATE COURANTE
      let recordDate;
      if (targetDate) {
        // Valider la date fournie
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

      // Vérifier l'employé
      const employee = await this.getEmployeeById(employeeId);
      if (!employee) {
        return this.sendNotFoundResponse(res, 'Employé non trouvé ou non actif');
      }

      // Vérifier le pointage existant POUR LA DATE SPÉCIFIÉE
      const existingRecord = await this.getAttendanceRecordByDate(employeeId, recordDate);

      // Gérer les différents cas de pointage
      if (existingRecord) {
        return await this.handleExistingRecord(
          req, res, existingRecord, employee, currentTime, recordDate, checkType, confidence
        );
      } else {
        return await this.handleNewCheckIn(
          req, res, employee, currentTime, recordDate, checkType, confidence
        );
      }

    } catch (error) {
      console.error('❌ ERREUR markAttendance:', error.message);
      this.sendServerError(res, 'Erreur serveur lors du pointage', error);
    }
  }

  /**
   * Gérer un pointage complet (check-in + check-out) - SEUL ADMIN AUTORISÉ
   */
  async handleFullAttendance(req, res) {
    try {
      console.log('✅ handleFullAttendance appelé');
      
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

      // ========== VÉRIFIER LES PERMISSIONS ==========
      const permissions = this.getRolePermissions(req.user.role);
      
      // EMPLOYÉ et MANAGER : Interdit
      if (req.user.role === 'employee' || req.user.role === 'manager') {
        return this.sendForbiddenResponse(res, {
          message: 'Création de pointage complet non autorisée',
          error: 'FULL_ATTENDANCE_DENIED',
          requiredRole: 'admin'
        });
      }
      
      // Seul l'admin peut continuer

      // Valider les données
      if (!employeeId || !checkIn || !checkOut || !targetDate) {
        return this.sendBadRequestResponse(res, 'employeeId, checkIn, checkOut et date sont requis');
      }

      // Valider la date
      const parsedDate = new Date(targetDate);
      if (isNaN(parsedDate.getTime())) {
        return this.sendBadRequestResponse(res, 'Date invalide');
      }
      const recordDate = parsedDate.toISOString().split('T')[0];

      // Vérifier l'employé
      const employee = await this.getEmployeeById(employeeId);
      if (!employee) {
        return this.sendNotFoundResponse(res, 'Employé non trouvé ou non actif');
      }

      // Vérifier les formats d'heure
      if (!this.isValidTimeFormat(checkIn) || !this.isValidTimeFormat(checkOut)) {
        return this.sendBadRequestResponse(res, 'Format d\'heure invalide. Utilisez HH:MM');
      }

      // Calculer les heures travaillées AVEC GESTION MINUIT
      const hoursWorked = this.calculateHoursBetween(checkIn, checkOut);
      console.log('⏰ Heures calculées:', { checkIn, checkOut, hoursWorked });
      
      // Validation améliorée
      if (hoursWorked <= 0 || hoursWorked > 24) {
        return this.sendBadRequestResponse(res, 
          `Heures travaillées invalides: ${hoursWorked}h. Vérifiez les horaires (${checkIn} → ${checkOut})`
        );
      }

      // Déterminer le statut
      let status = customStatus || 'checked_out';
      if (!customStatus) {
        const now = new Date();
        const todayDate = now.toISOString().split('T')[0];
        if (recordDate === todayDate) {
          const [checkInHour, checkInMinute] = checkIn.split(':').map(Number);
          if (checkInHour > 9 || (checkInHour === 9 && checkInMinute > 15)) {
            status = 'late';
          }
        }
      }

      // Vérifier si un pointage existe déjà
      const existingRecord = await this.getAttendanceRecordByDate(employeeId, recordDate);

      if (existingRecord) {
        // Mettre à jour l'enregistrement existant
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
          [checkIn, checkOut, hoursWorked, status, notes, shiftName, checkType, existingRecord.id]
        );
        
        console.log('🔄 Pointage existant mis à jour:', {
          employeeId,
          date: recordDate,
          checkIn,
          checkOut,
          hoursWorked
        });
      } else {
        // Créer un nouvel enregistrement
        await db.query(
          `INSERT INTO attendance (
            employee_id,
            check_in_time,
            check_out_time,
            record_date,
            attendance_date,
            status,
            notes,
            shift_name,
            hours_worked,
            verification_method,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
          [
            employee.employee_id,
            checkIn,
            checkOut,
            recordDate,
            recordDate,
            status,
            notes,
            shiftName,
            hoursWorked,
            checkType
          ]
        );
        
        console.log('✅ Nouveau pointage complet créé:', {
          employeeId,
          date: recordDate,
          checkIn,
          checkOut,
          hoursWorked
        });
      }

      // Notification
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
            authorized_by: req.user.email,
            date: recordDate,
            status: status
          }
        );
      } catch (notificationError) {
        console.warn('⚠️ Erreur création notification:', notificationError.message);
      }

      return res.status(201).json({
        success: true,
        message: `Pointage complet enregistré le ${recordDate}: ${checkIn} - ${checkOut} (${hoursWorked}h)`,
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
          status: status,
          method: checkType
        }
      });

    } catch (error) {
      console.error('❌ ERREUR handleFullAttendance:', error.message);
      this.sendServerError(res, 'Erreur serveur lors du pointage complet', error);
    }
  }

  /**
   * Pointage d'arrivée (interface web) - SEUL ADMIN AUTORISÉ
   */
  async checkIn(req, res) {
    try {
      console.log('✅ checkIn appelé');

      if (!req.user) {
        return this.sendUnauthorizedResponse(res);
      }

      // VÉRIFIER LES PERMISSIONS
      const permissions = this.getRolePermissions(req.user.role);
      
      // EMPLOYÉ et MANAGER : Pas de permission de pointage
      if (req.user.role === 'employee' || req.user.role === 'manager') {
        return this.sendForbiddenResponse(res, {
          message: 'Pointage d\'arrivée non autorisé',
          error: 'CHECKIN_DENIED',
          requiredRole: 'admin'
        });
      }

      // Seul l'admin peut continuer
      req.body.checkType = 'manual';
      return await this.markAttendance(req, res);

    } catch (error) {
      console.error('❌ ERREUR checkIn:', error.message);
      this.sendServerError(res, 'Erreur serveur', error);
    }
  }

  /**
   * Pointage de départ (interface web) - SEUL ADMIN AUTORISÉ
   */
  async checkOut(req, res) {
    try {
      const { employeeId } = req.body;
      console.log('✅ checkOut appelé pour:', employeeId);

      if (!req.user) {
        return this.sendUnauthorizedResponse(res);
      }

      // VÉRIFIER LES PERMISSIONS
      const permissions = this.getRolePermissions(req.user.role);
      
      // EMPLOYÉ et MANAGER : Pas de permission de pointage
      if (req.user.role === 'employee' || req.user.role === 'manager') {
        return this.sendForbiddenResponse(res, {
          message: 'Pointage de départ non autorisé',
          error: 'CHECKOUT_DENIED',
          requiredRole: 'admin'
        });
      }

      // Seul l'admin peut continuer
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

  /**
   * Pointage par reconnaissance faciale - SEUL ADMIN AUTORISÉ
   */
  async facialCheckIn(req, res) {
    try {
      console.log('✅ facialCheckIn appelé');

      if (!req.user) {
        return this.sendUnauthorizedResponse(res);
      }

      // VÉRIFIER LES PERMISSIONS
      const permissions = this.getRolePermissions(req.user.role);
      
      // EMPLOYÉ et MANAGER : Pas de permission de reconnaissance faciale
      if (req.user.role === 'employee' || req.user.role === 'manager') {
        return this.sendForbiddenResponse(res, {
          message: 'Reconnaissance faciale non autorisée',
          error: 'FACIAL_CHECKIN_DENIED',
          requiredRole: 'admin'
        });
      }
      
      // Seul l'admin peut continuer
      req.body.checkType = 'facial';
      return await this.markAttendance(req, res);

    } catch (error) {
      console.error('❌ ERREUR facialCheckIn:', error.message);
      this.sendServerError(res, 'Erreur serveur', error);
    }
  }

  // ==================== MÉTHODES DE GESTION ==================== 

  /**
   * Mettre à jour un enregistrement de présence - SEUL ADMIN AUTORISÉ
   */
  async updateAttendance(req, res) {
    try {
      const { id } = req.params;
      const { checkIn, checkOut, status } = req.body;

      console.log('✅ updateAttendance appelé pour ID:', id);

      if (!req.user) {
        return this.sendUnauthorizedResponse(res);
      }

      // VÉRIFIER LES PERMISSIONS
      const permissions = this.getRolePermissions(req.user.role);
      
      // EMPLOYÉ et MANAGER : Interdit
      if (req.user.role === 'employee' || req.user.role === 'manager') {
        return this.sendForbiddenResponse(res, {
          message: 'Modification de pointage non autorisée',
          error: 'UPDATE_ATTENDANCE_DENIED',
          requiredRole: 'admin'
        });
      }
      
      // Seul l'admin peut continuer
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

  /**
   * Vérifier le statut du jour pour un employé
   */
  async checkTodayStatus(req, res) {
    try {
      const { employeeId } = req.params;
      console.log('✅ checkTodayStatus appelé pour:', employeeId);

      if (!req.user) {
        return this.sendUnauthorizedResponse(res);
      }

      // VÉRIFIER LES PERMISSIONS
      const permissions = this.getRolePermissions(req.user.role);
      
      // EMPLOYÉ : Ne peut vérifier que son propre statut
      if (req.user.role === 'employee') {
        const userEmployeeId = req.user.employee_code || req.user.employee_id;
        if (employeeId !== userEmployeeId) {
          return this.sendForbiddenResponse(res, {
            message: 'Vous ne pouvez vérifier que votre propre statut',
            error: 'SELF_STATUS_ONLY'
          });
        }
      }
      
      // MANAGER : Ne peut vérifier que les employés de son département
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
      
      // ADMIN : Peut vérifier n'importe quel employé

      if (!employeeId || employeeId.trim() === '') {
        return this.sendBadRequestResponse(res, 'ID employé requis');
      }

      const result = await this.getEmployeeTodayStatus(employeeId);
      
      res.json({
        success: true,
        message: result.message,
        alreadyChecked: result.alreadyChecked,
        checkType: result.checkType,
        employeeName: result.employeeName,
        canCheckIn: result.canCheckIn,
        canCheckOut: result.canCheckOut,
        existingRecord: result.existingRecord,
        employee: result.employee,
        userRole: req.user.role
      });

    } catch (error) {
      console.error('❌ ERREUR checkTodayStatus:', error.message);
      this.sendServerError(res, 'Erreur serveur lors de la vérification', error);
    }
  }

  /**
   * Réinitialiser le pointage du jour - SEUL ADMIN AUTORISÉ
   */
  async resetTodayAttendance(req, res) {
    try {
      const { employeeId } = req.params;
      console.log('✅ resetTodayAttendance appelé pour:', employeeId);

      if (!req.user) {
        return this.sendUnauthorizedResponse(res);
      }

      // VÉRIFIER LES PERMISSIONS
      const permissions = this.getRolePermissions(req.user.role);
      
      // EMPLOYÉ et MANAGER : Interdit
      if (req.user.role === 'employee' || req.user.role === 'manager') {
        return this.sendForbiddenResponse(res, {
          message: 'Réinitialisation de pointage non autorisée',
          error: 'RESET_ATTENDANCE_DENIED',
          requiredRole: 'admin'
        });
      }
      
      // Seul l'admin peut continuer
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

  // ==================== MÉTHODES UTILITAIRES ====================

  /**
   * Calculer la différence d'heures entre deux horaires (GÈRE MINUIT)
   */
  calculateHoursDifference(startTime, endTime) {
    if (!startTime || !endTime) return null;

    try {
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);

      let startTotalMinutes = startHour * 60 + startMinute;
      let endTotalMinutes = endHour * 60 + endMinute;

      // Si l'heure de fin est avant l'heure de début (après minuit)
      if (endTotalMinutes < startTotalMinutes) {
        endTotalMinutes += 24 * 60; // Ajouter une journée
      }

      let diffMinutes = endTotalMinutes - startTotalMinutes;
      
      // S'assurer que c'est positif
      if (diffMinutes < 0) diffMinutes = 0;
      
      return (diffMinutes / 60).toFixed(2);
    } catch (error) {
      console.error('❌ Erreur calculateHoursDifference:', error);
      return null;
    }
  }

  /**
   * Calculer les heures entre deux horaires (GÈRE MINUIT - NOUVELLE VERSION)
   */
  calculateHoursBetween(startTime, endTime) {
    try {
      if (!startTime || !endTime) return '0.00';
      
      // Extraire heures et minutes
      const [inHour, inMinute] = startTime.split(':').map(Number);
      const [outHour, outMinute] = endTime.split(':').map(Number);
      
      // Convertir en minutes
      let inMinutes = inHour * 60 + inMinute;
      let outMinutes = outHour * 60 + outMinute;
      
      // Si l'heure de sortie est plus tôt (après minuit), ajouter 24h
      if (outMinutes < inMinutes) {
        outMinutes += 24 * 60; // Ajouter une journée complète
      }
      
      const totalMinutes = outMinutes - inMinutes;
      
      // Convertir en heures avec 2 décimales
      const hours = (totalMinutes / 60).toFixed(2);
      const hoursFloat = parseFloat(hours);
      
      // Validation
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

  // ==================== MÉTHODES PRIVÉES D'AIDE ====================

  /**
   * Récupérer le pointage pour une date spécifique
   */
  async getAttendanceRecordByDate(employeeId, date) {
    const result = await db.query(
      `SELECT id, check_in_time, check_out_time, status FROM attendance 
       WHERE employee_id = $1 
       AND record_date = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [employeeId, date]
    );
    return result.rows[0] || null;
  }

  /**
   * Formater les données de présence
   */
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
        // Utiliser la nouvelle méthode qui gère minuit
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

  /**
   * Vérifier le format d'heure
   */
  isValidTimeFormat(time) {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  /**
   * Calculer les statistiques
   */
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

  /**
   * Récupérer un employé par son ID
   */
  async getEmployeeById(employeeId) {
    const result = await db.query(
      'SELECT id, employee_id, first_name, last_name, email, department FROM employees WHERE employee_id = $1 AND is_active = true',
      [employeeId]
    );
    return result.rows[0] || null;
  }

  /**
   * Gérer un enregistrement existant
   */
  async handleExistingRecord(req, res, existingRecord, employee, currentTime, recordDate, checkType, confidence) {
    const hasCheckIn = existingRecord.check_in_time !== null;
    const hasCheckOut = existingRecord.check_out_time !== null;

    console.log('🔍 État du pointage existant:', {
      hasCheckIn,
      hasCheckOut,
      checkIn: existingRecord.check_in_time,
      checkOut: existingRecord.check_out_time,
      status: existingRecord.status
    });

    console.log('📊 Données reçues dans la requête:', {
      checkIn: req.body.checkIn,
      checkOut: req.body.checkOut,
      checkType: req.body.checkType,
      date: req.body.date
    });

    // CAS 1: Si checkIn ET checkOut sont fournis dans la requête → Mise à jour complète
    if (req.body.checkIn && req.body.checkOut) {
      console.log('📝 Pointage complet fourni - Mise à jour de l\'existant');
      
      // Valider les formats d'heure
      if (!this.isValidTimeFormat(req.body.checkIn) || !this.isValidTimeFormat(req.body.checkOut)) {
        return this.sendBadRequestResponse(res, 'Format d\'heure invalide. Utilisez HH:MM');
      }
      
      // Calculer les heures travaillées AVEC GESTION MINUIT
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
      
      // Déterminer le statut
      let status = req.body.status || 'checked_out';
      if (!req.body.status) {
        const now = new Date();
        const todayDate = now.toISOString().split('T')[0];
        if (recordDate === todayDate) {
          const [checkInHour, checkInMinute] = req.body.checkIn.split(':').map(Number);
          if (checkInHour > 9 || (checkInHour === 9 && checkInMinute > 15)) {
            status = 'late';
          }
        }
      }
      
      // Mettre à jour le pointage existant
      const updateResult = await db.query(`
        UPDATE attendance 
        SET 
          check_in_time = $1,
          check_out_time = $2,
          hours_worked = $3,
          status = $4,
          notes = COALESCE($5, notes),
          shift_name = COALESCE($6, shift_name),
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
        status,
        req.body.notes || existingRecord.notes,
        req.body.shiftName || existingRecord.shift_name || 'Standard',
        'manual_correction',
        req.user.email,
        existingRecord.id
      ]);
      
      const updatedRecord = updateResult.rows[0];
      
      // Notification
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
            authorized_by: req.user.email,
            date: recordDate
          }
        );
      } catch (notificationError) {
        console.warn('⚠️ Erreur création notification:', notificationError.message);
      }
      
      // Audit log
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
          'Mise à jour via markAttendance'
        ]
      );
      
      return res.json({
        success: true,
        message: `Pointage mis à jour: ${req.body.checkIn} - ${req.body.checkOut} (${hoursWorked}h)`,
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
          status: status,
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
      
      // Calculer les heures travaillées AVEC GESTION MINUIT
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
      
      // Notification
      try {
        await NotificationHelper.createAttendanceNotification(
          employee.id,
          'check_out',
          req.body.checkOut.slice(0, 5),
          {
            method: checkType === 'facial' ? 'facial_recognition' : 'manual',
            check_in_time: existingRecord.check_in_time?.slice(0, 5),
            hours_worked: hoursWorked,
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
          method: checkType === 'facial' ? 'facial_recognition' : 'manual'
        }
      });
    }
    
    // CAS 3: Déjà check-in ET check-out → Pointage complet
    else if (hasCheckIn && hasCheckOut) {
      console.log('⚠️ Pointage complet déjà existant');
      
      // Si on essaie d'ajouter un nouveau pointage complet, proposer la mise à jour
      if (req.body.checkIn && req.body.checkOut) {
        return this.sendBadRequestResponse(res, {
          message: `Pointage complet déjà existant: ${existingRecord.check_in_time?.slice(0, 5) || '--:--'} - ${existingRecord.check_out_time?.slice(0, 5) || '--:--'}`,
          suggestion: 'Utilisez la route de correction pour modifier ce pointage',
          existingRecordId: existingRecord.id,
          canUpdate: true
        });
      }
      
      // Sinon, simple message d'erreur
      return this.sendBadRequestResponse(res, {
        message: `Pointage complet déjà effectué: arrivée ${existingRecord.check_in_time?.slice(0, 5) || '--:--'}, départ ${existingRecord.check_out_time?.slice(0, 5) || '--:--'}`,
        alreadyChecked: true,
        checkType: 'completed',
        employeeName: `${employee.first_name} ${employee.last_name}`,
        existingRecord: {
          id: existingRecord.id,
          employeeId: employee.employee_id,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          checkIn: existingRecord.check_in_time?.slice(0, 5),
          checkOut: existingRecord.check_out_time?.slice(0, 5),
          date: recordDate,
          status: existingRecord.status
        }
      });
    }
    
    // CAS 4: Pas de check-in mais on en fournit un → Mettre à jour le check-in
    else if (!hasCheckIn && req.body.checkIn) {
      console.log('🔄 Mise à jour du check-in pour un enregistrement existant');
      
      if (!this.isValidTimeFormat(req.body.checkIn)) {
        return this.sendBadRequestResponse(res, 'Format d\'heure d\'arrivée invalide');
      }
      
      // Déterminer le statut (retard)
      const checkInTime = new Date(`${recordDate}T${req.body.checkIn}`);
      let status = 'present';
      let isLate = false;
      
      const now = new Date();
      const todayDate = now.toISOString().split('T')[0];
      if (recordDate === todayDate) {
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        if (currentHour > 9 || (currentHour === 9 && currentMinute > 15)) {
          status = 'late';
          isLate = true;
        }
      }
      
      const updateResult = await db.query(`
        UPDATE attendance 
        SET 
          check_in_time = $1,
          status = $2,
          verification_method = $3,
          updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `, [
        req.body.checkIn,
        status,
        checkType === 'facial' ? 'facial_recognition' : 'manual',
        existingRecord.id
      ]);
      
      const updatedRecord = updateResult.rows[0];
      
      // Notification
      try {
        await NotificationHelper.createAttendanceNotification(
          employee.id,
          'check_in',
          req.body.checkIn.slice(0, 5),
          {
            method: checkType === 'facial' ? 'facial_recognition' : 'manual',
            status: status,
            is_late: isLate,
            authorized_by: req.user.email
          }
        );
      } catch (notificationError) {
        console.warn('⚠️ Erreur création notification:', notificationError.message);
      }
      
      return res.json({
        success: true,
        message: `Arrivée mise à jour à ${req.body.checkIn.slice(0, 5)} (check-in)`,
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
          method: checkType === 'facial' ? 'facial_recognition' : 'manual',
          isLate: isLate
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
          checkOut: existingRecord.check_out_time?.slice(0, 5)
        },
        requiredAction: !hasCheckIn ? 'Fournir checkIn' : (hasCheckIn && !hasCheckOut ? 'Fournir checkOut' : 'Utiliser la route de correction')
      });
    }
  }

  /**
   * Gérer un nouveau check-in avec date spécifique
   */
  async handleNewCheckIn(req, res, employee, currentTime, recordDate, checkType, confidence) {
    console.log('🔄 Auto check-in pour:', employee.employee_id, 'le', recordDate);

    // Si c'est une date passée, on ne calculer pas le retard
    const now = new Date();
    const todayDate = now.toISOString().split('T')[0];
    let status = 'present';
    let isLate = false;
    
    // Ne calculer le retard que si c'est la date d'aujourd'hui
    if (recordDate === todayDate) {
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      if (currentHour > 9 || (currentHour === 9 && currentMinute > 15)) {
        status = 'late';
        isLate = true;
      }
    }

    const result = await db.query(`
      INSERT INTO attendance (
        employee_id,
        check_in_time,
        record_date,
        attendance_date,
        status,
        verification_method,
        face_confidence,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING id, employee_id, check_in_time, record_date, status
    `, [
      employee.employee_id,
      currentTime,
      recordDate,
      recordDate,
      status,
      checkType === 'facial' ? 'facial_recognition' : 'manual',
      confidence || null
    ]);

    const newRecord = result.rows[0];

    // Notification
    try {
      await NotificationHelper.createAttendanceNotification(
        employee.id,
        'check_in',
        currentTime.slice(0, 5),
        {
          method: checkType === 'facial' ? 'facial_recognition' : 'manual',
          status: status,
          is_late: isLate,
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
        method: checkType === 'facial' ? 'facial_recognition' : 'manual',
        confidence: confidence || null,
        isLate: isLate
      }
    });
  }

  /**
   * Traiter un check-out à partir d'un enregistrement existant
   */
  async processCheckOutFromRecord(existingRecord, employee, currentTime, checkType, confidence, authorizedBy) {
    console.log('🔄 Auto check-out pour:', employee.employee_id);

    // Calculer les heures travaillées AVEC GESTION MINUIT
    let hoursWorked = '0.00';
    if (existingRecord.check_in_time) {
      hoursWorked = this.calculateHoursBetween(
        existingRecord.check_in_time.slice(0, 5),
        currentTime.slice(0, 5)
      );
    }

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
        method: checkType === 'facial' ? 'facial_recognition' : 'manual'
      }
    };
  }

  /**
   * Traiter un check-out manuel
   */
  async processCheckOut(employeeId, authorizedBy) {
    const currentTime = new Date().toTimeString().split(' ')[0].slice(0, 8);
    const currentDate = new Date().toISOString().split('T')[0];

    // Vérifier le check-in du jour
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

    // Calculer les heures travaillées AVEC GESTION MINUIT
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

    // Mettre à jour le pointage
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

    // Récupérer les informations de l'employé
    const employeeResult = await db.query(
      'SELECT id, first_name, last_name, email, department FROM employees WHERE employee_id = $1',
      [employeeId]
    );

    const employee = employeeResult.rows[0] || {};
    const employeeName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim();

    // Notification
    try {
      await NotificationHelper.createAttendanceNotification(
        employee.id,
        'check_out',
        currentTime.slice(0, 5),
        {
          method: 'manual',
          check_in_time: attendanceRecord.check_in_time?.slice(0, 5),
          hours_worked: hoursWorked,
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
        method: 'manual'
      }
    };
  }

  /**
   * Traiter la mise à jour d'une présence
   */
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

    // Si checkIn et checkOut sont fournis, calculer les heures
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

    // Notification
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

  /**
   * Récupérer le statut du jour d'un employé
   */
  async getEmployeeTodayStatus(employeeId) {
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().split(' ')[0].slice(0, 8);

    // Vérifier l'employé
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

    // Vérifier le pointage existant
    const existingCheck = await db.query(
      `SELECT id, check_in_time, check_out_time, status FROM attendance 
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
        // Calculer les heures travaillées
        const hoursWorked = this.calculateHoursBetween(checkInTime, checkOutTime);
        message = `Pointage complet: arrivée ${checkInTime}, départ ${checkOutTime} (${hoursWorked}h)`;
        checkType = 'completed';
      } else {
        // Calculer les heures depuis le check-in
        const hoursSinceCheckIn = this.calculateHoursBetween(
          checkInTime,
          currentTime.slice(0, 5)
        );
        message = `Arrivée pointée à ${checkInTime} - Prêt pour le départ (${hoursSinceCheckIn}h depuis)`;
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
          currentTime: currentTime.slice(0, 5),
          canCheckOut: false,
          hoursSinceCheckIn: hoursSinceCheckIn
        }
      };
    }

    // Aucun pointage trouvé
    return {
      message: "Prêt pour le pointage d'arrivée - Aucun pointage trouvé pour aujourd'hui",
      alreadyChecked: false,
      checkType: 'not_checked',
      canCheckIn: true,
      canCheckOut: false,
      employeeName: employeeName,
      employee: {
        id: employee.id,
        employeeId: employee.employee_id,
        employeeName: employeeName,
        currentTime: currentTime.slice(0, 5),
        currentDate: currentDate
      }
    };
  }

  /**
   * Traiter la réinitialisation d'une présence
   */
  async processAttendanceReset(employeeId, authorizedBy) {
    const currentDate = new Date().toISOString().split('T')[0];

    // Vérifier l'employé
    const employeeResult = await db.query(
      'SELECT id, employee_id, first_name, last_name FROM employees WHERE employee_id = $1',
      [employeeId]
    );

    if (employeeResult.rows.length === 0) {
      throw new Error('Employé non trouvé');
    }

    const employee = employeeResult.rows[0];
    const employeeName = `${employee.first_name} ${employee.last_name}`;

    // Supprimer le pointage du jour
    const deleteResult = await db.query(
      'DELETE FROM attendance WHERE employee_id = $1 AND record_date = $2 RETURNING *',
      [employeeId, currentDate]
    );

    if (deleteResult.rows.length > 0) {
      const deleted = deleteResult.rows[0];

      // Notification
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
          status: deleted.status
        }
      };
    } else {
      return {
        message: "Aucun pointage trouvé pour aujourd'hui",
        employeeName: employeeName
      };
    }
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