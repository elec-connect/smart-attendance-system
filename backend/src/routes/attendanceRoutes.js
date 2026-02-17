// backend/src/routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/auth');
const db = require('../../config/db');

// ==================== SECTION 1: ROUTES PUBLIQUES POUR POINTAGE ====================
// Routes utilisées par les bornes de pointage (pas d'authentification requise)

/**
 * Vérifier le statut du jour
 */
router.get('/check-today/:employeeId', attendanceController.checkTodayStatus);
router.get('/check-today-status/:employeeId', attendanceController.checkTodayStatus);

/**
 * Effectuer un pointage
 */
router.post('/mark', attendanceController.markAttendance);
router.post('/mark-attendance', attendanceController.markAttendance);

// ==================== SECTION 2: ROUTES DÉPRÉCIÉES (COMPATIBILITÉ) ====================
// Routes maintenues pour compatibilité - AVEC MIDDLEWARE D'AUTH

/**
 * Pointage d'arrivée (déprécié)
 */
router.post('/checkin', 
  authMiddleware.authenticateToken,
  attendanceController.checkIn
);
router.post('/check-in', 
  authMiddleware.authenticateToken,
  attendanceController.checkIn
);

/**
 * Pointage de départ (déprécié)
 */
router.post('/checkout', 
  authMiddleware.authenticateToken,
  attendanceController.checkOut
);
router.post('/check-out', 
  authMiddleware.authenticateToken,
  attendanceController.checkOut
);

/**
 * Pointage par reconnaissance faciale (déprécié)
 */
router.post('/facial-checkin', 
  authMiddleware.authenticateToken,
  attendanceController.facialCheckIn
);
router.post('/facial-check-in', 
  authMiddleware.authenticateToken,
  attendanceController.facialCheckIn
);

// ==================== SECTION 3: ROUTES DE POINTAGE MANUEL ====================

/**
 * Pointage manuel d'arrivée
 */
router.post('/manual-checkin', 
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin', 'manager'),
  async (req, res) => {
    try {
      const { employeeId, notes, timestamp } = req.body;
      
      console.log('📝 Pointage manuel arrivée:', {
        employeeId,
        performer: req.user.email,
        timestamp: timestamp || new Date().toISOString()
      });
      
      // Ajouter le type de pointage
      req.body.checkType = 'manual';
      return attendanceController.markAttendance(req, res);
      
    } catch (error) {
      console.error('❌ Erreur pointage manuel arrivée:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du pointage manuel',
        error: error.message
      });
    }
  }
);

/**
 * Pointage manuel de départ
 */
router.post('/manual-checkout', 
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin', 'manager'),
  async (req, res) => {
    try {
      console.log('📝 Départ manuel demandé par:', req.user.email);
      return attendanceController.checkOut(req, res);
    } catch (error) {
      console.error('❌ Erreur départ manuel:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du pointage manuel',
        error: error.message
      });
    }
  }
);

/**
 * Pointage rapide (combine checkin/checkout)
 */
router.post('/quick-check', 
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin', 'manager'),
  async (req, res) => {
    try {
      const { employeeId, action, notes } = req.body;
      
      console.log('⚡ Pointage rapide:', {
        employeeId,
        action,
        performer: req.user.email
      });
      
      // Valider les paramètres
      if (!employeeId || !action) {
        return res.status(400).json({
          success: false,
          message: 'employeeId et action sont requis'
        });
      }
      
      if (!['checkin', 'checkout'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Action doit être "checkin" ou "checkout"'
        });
      }
      
      // Rediriger vers la bonne méthode
      if (action === 'checkin') {
        req.body.checkType = 'manual';
        return attendanceController.markAttendance(req, res);
      } else {
        return attendanceController.checkOut(req, res);
      }
      
    } catch (error) {
      console.error('❌ Erreur pointage rapide:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du pointage rapide',
        error: error.message
      });
    }
  }
);

// ==================== SECTION 3.5: ROUTE DE POINTAGE GÉNÉRAL (UNIFIÉ) ====================attendanceQuery 

/**
 * Pointage général (unifié) - Route POST /attendance
 * Accepte à la fois les pointages d'arrivée et de départ
 */
router.post('/', 
  authMiddleware.authenticateToken,
  async (req, res) => {
    try {
      console.log('📝 Route POST /attendance appelée par:', req.user.email);
      console.log('📊 Données reçues:', req.body);
      
      // Rediriger vers markAttendance pour un traitement unifié
      return attendanceController.markAttendance(req, res);
      
    } catch (error) {
      console.error('❌ Erreur route POST /attendance:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du pointage',
        error: error.message
      });
    }
  }
);

// ==================== SECTION 4: ROUTES DE GESTION (Interface Web) ====================

/**
 * Récupérer toutes les présences
 */
router.get('/', 
  authMiddleware.authenticateToken,
  attendanceController.getAllAttendance
);

/**
 * Récupérer les statistiques
 */
router.get('/stats', 
  authMiddleware.authenticateToken,
  attendanceController.getAttendanceStats
);

/**
 * Récupérer les présences du jour
 */
router.get('/today', 
  authMiddleware.authenticateToken,
  attendanceController.getTodayAttendance
);

/**
 * Modifier un pointage
 */
router.put('/:id', 
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin', 'manager'),
  attendanceController.updateAttendance
);

/**
 * Réinitialiser le pointage du jour
 */
router.delete('/reset-today/:employeeId', 
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin'),
  attendanceController.resetTodayAttendance
);

// ==================== SECTION 5: ROUTES SPÉCIFIQUES ====================

/**
 * Vérifier le statut d'un employé
 */
router.get('/employee-status/:employeeId',
  authMiddleware.authenticateToken,
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      req.params.employeeId = employeeId;
      return attendanceController.checkTodayStatus(req, res);
      
    } catch (error) {
      console.error('❌ Erreur vérification statut:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification',
        error: error.message
      });
    }
  }
);

/**
 * Statistiques par département
 */
router.get('/department-stats/:department',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin', 'manager'),
  async (req, res) => {
    try {
      const { department } = req.params;
      const { date } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      // Total employés dans le département
      const totalQuery = await db.query(
        'SELECT COUNT(*) as total FROM employees WHERE department = $1 AND is_active = true',
        [department]
      );
      
      // Présents aujourd'hui
      const presentQuery = await db.query(
        `SELECT COUNT(DISTINCT a.employee_id) as present
         FROM attendance a
         JOIN employees e ON a.employee_id = e.employee_id
         WHERE e.department = $1 
           AND a.record_date = $2
           AND a.check_in_time IS NOT NULL`,
        [department, targetDate]
      );
      
      // En retard
      const lateQuery = await db.query(
        `SELECT COUNT(*) as late
         FROM attendance a
         JOIN employees e ON a.employee_id = e.employee_id
         WHERE e.department = $1 
           AND a.record_date = $2
           AND a.status = 'late'`,
        [department, targetDate]
      );
      
      // Déjà sortis
      const checkedOutQuery = await db.query(
        `SELECT COUNT(*) as checked_out
         FROM attendance a
         JOIN employees e ON a.employee_id = e.employee_id
         WHERE e.department = $1 
           AND a.record_date = $2
           AND a.check_out_time IS NOT NULL`,
        [department, targetDate]
      );
      
      const total = parseInt(totalQuery.rows[0].total) || 0;
      const present = parseInt(presentQuery.rows[0].present) || 0;
      const late = parseInt(lateQuery.rows[0].late) || 0;
      const checkedOut = parseInt(checkedOutQuery.rows[0].checked_out) || 0;
      const absent = Math.max(0, total - present);
      
      res.json({
        success: true,
        data: {
          department,
          date: targetDate,
          statistics: {
            total_employees: total,
            present_today: present,
            late_today: late,
            on_time_today: present - late,
            checked_out_today: checkedOut,
            still_in_office: present - checkedOut,
            absent_today: absent,
            attendance_rate: total > 0 ? ((present / total) * 100).toFixed(2) : 0
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur statistiques département:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        error: error.message
      });
    }
  }
);

/**
 * Pointages des derniers jours
 */
router.get('/recent-days/:days',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin', 'manager'),
  async (req, res) => {
    try {
      const { days } = req.params;
      const limit = parseInt(days) || 7;
      
      const query = await db.query(
        `SELECT 
          a.record_date as date,
          COUNT(DISTINCT a.employee_id) as present_count,
          COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
          COUNT(CASE WHEN a.check_out_time IS NOT NULL THEN 1 END) as checked_out_count,
          e.total_employees,
          ROUND((COUNT(DISTINCT a.employee_id)::float / NULLIF(e.total_employees, 0)) * 100, 2) as attendance_rate
         FROM attendance a
         CROSS JOIN (
           SELECT COUNT(*) as total_employees 
           FROM employees 
           WHERE is_active = true
         ) e
         WHERE a.record_date >= CURRENT_DATE - $1
         GROUP BY a.record_date, e.total_employees
         ORDER BY a.record_date DESC`,
        [limit - 1]
      );
      
      res.json({
        success: true,
        data: query.rows,
        days: limit
      });
      
    } catch (error) {
      console.error('❌ Erreur récupération jours récents:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération',
        error: error.message
      });
    }
  }
);

/**
 * Pointages d'un employé spécifique
 */
router.get('/employee/:employeeId',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin', 'manager'),
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { startDate, endDate, limit = 30 } = req.query;
      
      let query = `
        SELECT 
          a.id as attendance_id,
          a.employee_id,
          a.check_in_time,
          a.check_out_time,
          a.record_date,
          a.attendance_date,
          a.status,
          a.notes,
          a.shift_name,
          a.created_at,
          a.updated_at,
          e.first_name,
          e.last_name,
          e.email,
          e.department,
          e.position
        FROM attendance a
        LEFT JOIN employees e ON e.employee_id = a.employee_id
        WHERE a.employee_id = $1
      `;
      
      const params = [employeeId];
      let paramCount = 2;
      
      if (startDate && endDate) {
        query += ` AND a.record_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
        params.push(startDate, endDate);
        paramCount += 2;
      }
      
      query += ` ORDER BY a.record_date DESC, a.check_in_time DESC`;
      
      if (limit) {
        query += ` LIMIT $${paramCount}`;
        params.push(parseInt(limit));
      }
      
      const result = await db.query(query, params);
      
      // Formater les données
      const formattedData = result.rows.map(row => ({
        id: row.attendance_id,
        employeeId: row.employee_id,
        employeeName: `${row.first_name || ''} ${row.last_name || ''}`.trim() || `Employé ${row.employee_id}`,
        date: row.record_date || row.attendance_date,
        checkIn: row.check_in_time ? row.check_in_time.slice(0, 5) : null,
        checkOut: row.check_out_time ? row.check_out_time.slice(0, 5) : null,
        status: row.status || 'not_checked',
        notes: row.notes || '',
        shiftName: row.shift_name || '',
        department: row.department || 'Non spécifié',
        position: row.position || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      res.json({
        success: true,
        data: formattedData,
        meta: {
          count: formattedData.length,
          employeeId: employeeId,
          dateRange: startDate && endDate ? `${startDate} à ${endDate}` : 'Toutes dates'
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur récupération pointages employé:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des pointages',
        error: error.message
      });
    }
  }
);

/**
 * Exporter les pointages
 */
router.get('/export',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin'),
  async (req, res) => {
    try {
      const { startDate, endDate, format = 'csv' } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Les dates de début et de fin sont requises'
        });
      }
      
      const query = await db.query(
        `SELECT 
          a.employee_id,
          e.first_name,
          e.last_name,
          e.email,
          e.department,
          e.position,
          a.record_date,
          a.check_in_time,
          a.check_out_time,
          a.status,
          a.notes,
          a.shift_name,
          a.created_at
         FROM attendance a
         LEFT JOIN employees e ON e.employee_id = a.employee_id
         WHERE a.record_date BETWEEN $1 AND $2
         ORDER BY a.record_date DESC, e.last_name, e.first_name`,
        [startDate, endDate]
      );
      
      if (format === 'json') {
        res.json({
          success: true,
          data: query.rows,
          meta: {
            count: query.rows.length,
            startDate,
            endDate,
            exportedAt: new Date().toISOString()
          }
        });
      } else {
        // Format CSV
        const headers = [
          'ID Employé',
          'Nom',
          'Prénom',
          'Email',
          'Département',
          'Poste',
          'Date',
          'Heure arrivée',
          'Heure départ',
          'Statut',
          'Notes',
          'Shift',
          'Date création'
        ];
        
        const csvRows = [
          headers.join(','),
          ...query.rows.map(row => [
            row.employee_id || '',
            row.last_name || '',
            row.first_name || '',
            row.email || '',
            row.department || '',
            row.position || '',
            row.record_date || '',
            row.check_in_time ? row.check_in_time.slice(0, 5) : '',
            row.check_out_time ? row.check_out_time.slice(0, 5) : '',
            row.status || '',
            `"${(row.notes || '').replace(/"/g, '""')}"`,
            row.shift_name || '',
            row.created_at ? new Date(row.created_at).toISOString() : ''
          ].join(','))
        ];
        
        const csvContent = csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=pointages_${startDate}_${endDate}.csv`);
        res.send(csvContent);
      }
      
    } catch (error) {
      console.error('❌ Erreur export pointages:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'export des pointages',
        error: error.message
      });
    }
  }
);

/**
 * Résumé mensuel
 */
router.get('/monthly-summary/:year/:month',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin', 'manager'),
  async (req, res) => {
    try {
      const { year, month } = req.params;
      const { department } = req.query;
      
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      
      let baseQuery = `
        SELECT 
          e.employee_id,
          e.first_name,
          e.last_name,
          e.department,
          e.position,
          COUNT(a.id) as days_worked,
          COUNT(CASE WHEN a.status = 'late' THEN 1 END) as days_late,
          COUNT(CASE WHEN a.check_out_time IS NOT NULL THEN 1 END) as days_completed,
          SUM(
            CASE WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL 
            THEN 
              (EXTRACT(HOUR FROM (a.check_out_time::time - a.check_in_time::time)) * 60 + 
               EXTRACT(MINUTE FROM (a.check_out_time::time - a.check_in_time::time))) / 60.0
            ELSE 0 END
          ) as total_hours_worked
        FROM employees e
        LEFT JOIN attendance a ON a.employee_id = e.employee_id 
          AND a.record_date BETWEEN $1 AND $2
        WHERE e.is_active = true
      `;
      
      const params = [startDate, endDate];
      
      if (department) {
        baseQuery += ` AND e.department = $3`;
        params.push(department);
      }
      
      baseQuery += `
        GROUP BY e.employee_id, e.first_name, e.last_name, e.department, e.position
        ORDER BY e.department, e.last_name, e.first_name
      `;
      
      const result = await db.query(baseQuery, params);
      
      res.json({
        success: true,
        data: result.rows,
        meta: {
          year,
          month,
          startDate,
          endDate,
          count: result.rows.length,
          department: department || 'Tous'
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur résumé mensuel:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du résumé mensuel',
        error: error.message
      });
    }
  }
);

// ==================== SECTION 6: ROUTES DE CORRECTION DE POINTAGE ====================

/**
 * Obtenir tous les pointages d'un mois pour un employé - VERSION CORRIGÉE
 */
router.get('/correction/monthly/:employeeId',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin', 'manager'),
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { year, month } = req.query;
      
      console.log(`📅 Correction mensuelle demandée: ${employeeId} - ${year}-${month}`);
      
      // Valider les paramètres
      if (!year || !month) {
        const today = new Date();
        const targetYear = today.getFullYear();
        const targetMonth = String(today.getMonth() + 1).padStart(2, '0');
        
        return res.redirect(`/api/attendance/correction/monthly/${employeeId}?year=${targetYear}&month=${targetMonth}`);
      }
      
      // Vérifier l'employé
      const employeeResult = await db.query(
        'SELECT employee_id, first_name, last_name, department, position FROM employees WHERE employee_id = $1',
        [employeeId]
      );
      
      if (employeeResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employé non trouvé'
        });
      }
      
      const employee = employeeResult.rows[0];
      const employeeName = `${employee.first_name} ${employee.last_name}`;
      
      // Dates du mois
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month.padStart(2, '0')}-${lastDay}`;
      
      // Récupérer tous les pointages du mois - REQUÊTE CORRIGÉE
      const attendanceQuery = await db.query(
        `SELECT 
          id,
          employee_id,
          check_in_time,
          check_out_time,
          DATE(record_date) as record_date_formatted, -- CORRECTION ICI
          status,
          notes,
          shift_name,
          hours_worked,
          verification_method,
          created_at,
          updated_at
         FROM attendance 
         WHERE employee_id = $1 
           AND DATE(record_date) BETWEEN $2::date AND $3::date  -- CORRECTION ICI
         ORDER BY record_date ASC`,
        [employeeId, startDate, endDate]
      );
      
      console.log(`📊 ${attendanceQuery.rows.length} pointages trouvés pour ${employeeId}`);
      
      // Créer un tableau pour tous les jours du mois
const daysInMonth = lastDay;
const monthlyData = [];

for (let day = 1; day <= daysInMonth; day++) {
  const currentDate = `${year}-${month.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  
  // Trouver le pointage pour ce jour - LOGIQUE CORRIGÉE
  // CORRECTION - Comparaison directe sans conversion
const attendanceForDay = attendanceQuery.rows.find(record => {
  if (!record.record_date_formatted) return false;
  
  try {
    // Méthode 1: Comparaison directe si c'est déjà un string
    if (typeof record.record_date_formatted === 'string') {
      // Extraire juste la partie date (YYYY-MM-DD)
      const recordDateOnly = record.record_date_formatted.split('T')[0].split(' ')[0];
      return recordDateOnly === currentDate;
    }
    
    // Méthode 2: Si c'est un objet Date
    if (record.record_date_formatted instanceof Date) {
      const recordDateStr = formatPostgresDate(record.record_date_formatted);
      return recordDateStr === currentDate;
    }
    
    // Méthode 3: Pour les autres cas
    const recordDate = new Date(record.record_date_formatted);
    const recordDateStr = formatPostgresDate(recordDate);
    return recordDateStr === currentDate;
    
  } catch (error) {
    console.warn(`❌ Erreur date pour ${currentDate}:`, record.record_date_formatted, error);
    return false;
  }
});

// Fonction utilitaire pour formater une date en YYYY-MM-DD
function formatPostgresDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
  
  const dateObj = new Date(currentDate);
  const dayOfWeek = dateObj.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  // DÉTERMINER LE STATUT CORRECTEMENT
  let dayStatus = 'absent';
  let hoursWorked = '0.00';
  
  if (attendanceForDay) {
    console.log(`📝 Pointage trouvé pour ${currentDate}:`, {
      status: attendanceForDay.status,
      checkIn: attendanceForDay.check_in_time,
      checkOut: attendanceForDay.check_out_time,
      hours_worked: attendanceForDay.hours_worked
    });
    
    // Déterminer le statut basé sur le champ status
    if (attendanceForDay.status === 'present' || 
        attendanceForDay.status === 'checked_out' || 
        attendanceForDay.status === 'late') {
      dayStatus = attendanceForDay.status;
    } else if (attendanceForDay.check_in_time && attendanceForDay.check_out_time) {
      dayStatus = 'checked_out';
    } else if (attendanceForDay.check_in_time) {
      dayStatus = 'present';
    }
    
    // ========== CALCULER LES HEURES SI ELLES MANQUENT OU SONT INCORRECTES ==========
if (attendanceForDay.check_in_time && attendanceForDay.check_out_time) {
  // Utiliser les heures de la base si elles existent et sont valides
  if (attendanceForDay.hours_worked && parseFloat(attendanceForDay.hours_worked) > 0) {
    hoursWorked = attendanceForDay.hours_worked;
    console.log(`✅ Heures depuis base pour ${currentDate}: ${hoursWorked}h`);
  } else {
    // CALCUL DIRECT - SIMPLE ET SANS FONCTION EXTERNE
    try {
      const checkIn = attendanceForDay.check_in_time.slice(0, 5);
      const checkOut = attendanceForDay.check_out_time.slice(0, 5);
      
      console.log(`🔧 Calcul heures pour ${currentDate}: ${checkIn} → ${checkOut}`);
      
      const [inHour, inMin] = checkIn.split(':').map(Number);
      const [outHour, outMin] = checkOut.split(':').map(Number);
      
      let inMinutes = inHour * 60 + inMin;
      let outMinutes = outHour * 60 + outMin;
      
      // Si départ < arrivée (après minuit)
      if (outMinutes < inMinutes) {
        outMinutes += 24 * 60;
        console.log(`  ↪️ Passage minuit détecté, +24h`);
      }
      
      const totalMinutes = outMinutes - inMinutes;
      hoursWorked = (totalMinutes / 60).toFixed(2);
      
      console.log(`  ✅ Résultat: ${totalMinutes}min = ${hoursWorked}h`);
      
      // Validation
      if (parseFloat(hoursWorked) <= 0 || parseFloat(hoursWorked) > 24) {
        console.warn(`  ⚠️ Heures invalides: ${hoursWorked}h`);
        hoursWorked = '0.00';
      }
    } catch (error) {
      console.error(`  ❌ Erreur calcul: ${error.message}`);
      hoursWorked = '0.00';
    }
  }
} else {
  hoursWorked = attendanceForDay.hours_worked || '0.00';
}
  }
  
  monthlyData.push({
    date: currentDate,
    dayNumber: day,
    dayOfWeek: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][dayOfWeek],
    isWeekend: isWeekend,
    attendance: attendanceForDay ? {
      id: attendanceForDay.id,
      checkIn: attendanceForDay.check_in_time ? attendanceForDay.check_in_time.slice(0, 5) : null,
      checkOut: attendanceForDay.check_out_time ? attendanceForDay.check_out_time.slice(0, 5) : null,
      status: dayStatus, // Utiliser le statut déterminé
      notes: attendanceForDay.notes || '',
      shiftName: attendanceForDay.shift_name || 'Standard',
      hoursWorked: hoursWorked,
      hasPointage: true
    } : {
      id: null,
      checkIn: null,
      checkOut: null,
      status: 'absent',
      notes: '',
      shiftName: 'Standard',
      hoursWorked: '0.00',
      hasPointage: false
    }
  });
}
      
      // Statistiques du mois - CORRIGÉES
      const presentDays = monthlyData.filter(day => 
        day.attendance.status === 'present' || 
        day.attendance.status === 'checked_out'
      ).length;
      
      const lateDays = monthlyData.filter(day => 
        day.attendance.status === 'late'
      ).length;
      
      const absentDays = monthlyData.filter(day => 
        day.attendance.status === 'absent' && 
        !day.isWeekend
      ).length;
      
      const weekendDays = monthlyData.filter(day => day.isWeekend).length;
      
      // Total heures travaillées
      const totalHours = monthlyData.reduce((sum, day) => {
        if (day.attendance.hoursWorked) {
          return sum + parseFloat(day.attendance.hoursWorked);
        }
        return sum;
      }, 0);
      
      const workingDays = daysInMonth - weekendDays;
      const attendanceRate = workingDays > 0 ? ((presentDays + lateDays) / workingDays * 100).toFixed(2) : '0.00';
      
      res.json({
        success: true,
        data: {
          employee: {
            id: employeeId,
            name: employeeName,
            firstName: employee.first_name,
            lastName: employee.last_name,
            department: employee.department,
            position: employee.position
          },
          month: {
            year: year,
            month: month,
            monthName: new Date(`${year}-${month}-01`).toLocaleDateString('fr-FR', { month: 'long' }),
            startDate: startDate,
            endDate: endDate,
            daysInMonth: daysInMonth,
            workingDays: workingDays,
            weekendDays: weekendDays
          },
          attendanceData: monthlyData,
          statistics: {
            presentDays: presentDays,
            absentDays: absentDays,
            lateDays: lateDays,
            weekendDays: weekendDays,
            workingDays: workingDays,
            totalHours: totalHours.toFixed(2),
            averageHoursPerDay: (presentDays > 0 ? totalHours / presentDays : 0).toFixed(2),
            attendanceRate: attendanceRate
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur récupération pointages mensuels:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des pointages mensuels',
        error: error.message
      });
    }
  }
);
/**
 * Corriger un pointage spécifique
 */
router.post('/correction/update/:attendanceId',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin', 'manager'),
  async (req, res) => {
    try {
      const { attendanceId } = req.params;
      const { checkIn, checkOut, date, status, notes, shiftName } = req.body;
      
      console.log(`✏️ Correction pointage ${attendanceId}:`, { checkIn, checkOut, date });
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non autorisé'
        });
      }
      
      // Vérifier si le pointage existe
      const existingCheck = await db.query(
        'SELECT id, employee_id, record_date, check_in_time, check_out_time FROM attendance WHERE id = $1',
        [attendanceId]
      );
      
      if (existingCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pointage non trouvé'
        });
      }
      
      const existingRecord = existingCheck.rows[0];
      const targetDate = date || existingRecord.record_date;
      
      // Calculer les heures travaillées
      let hoursWorked = 0;
      if (checkIn && checkOut) {
        const timeToMinutes = (timeStr) => {
          const parts = timeStr.split(':').map(Number);
          return parts[0] * 60 + parts[1];
        };
        
        const checkInMinutes = timeToMinutes(checkIn);
        const checkOutMinutes = timeToMinutes(checkOut);
        let totalMinutes = checkOutMinutes - checkInMinutes;
        if (totalMinutes < 0) totalMinutes += 24 * 60;
        hoursWorked = totalMinutes / 60;
      }
      
      // Mettre à jour le pointage (seulement les colonnes qui existent)
      const updateResult = await db.query(`
        UPDATE attendance 
        SET 
          check_in_time = COALESCE($1, check_in_time),
          check_out_time = COALESCE($2, check_out_time),
          record_date = $3,
          attendance_date = $3,
          status = COALESCE($4, status),
          notes = COALESCE($5, notes),
          shift_name = COALESCE($6, shift_name),
          hours_worked = $7,
          updated_at = NOW()
        WHERE id = $8
        RETURNING *
      `, [
        checkIn || null,
        checkOut || null,
        targetDate,
        status || 'present',
        notes || '',
        shiftName || 'Standard',
        hoursWorked.toFixed(2),
        attendanceId
      ]);
      
      const updatedRecord = updateResult.rows[0];
      
      // Notification simple dans les logs
      console.log(`✅ Pointage ${attendanceId} corrigé par ${req.user.email}`);
      
      res.json({
        success: true,
        message: 'Pointage corrigé avec succès',
        data: {
          id: updatedRecord.id,
          employeeId: updatedRecord.employee_id,
          date: updatedRecord.record_date,
          checkIn: updatedRecord.check_in_time?.slice(0, 5) || null,
          checkOut: updatedRecord.check_out_time?.slice(0, 5) || null,
          status: updatedRecord.status,
          hoursWorked: updatedRecord.hours_worked,
          correctedBy: req.user.email,
          correctedAt: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur correction pointage:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la correction du pointage',
        error: error.message
      });
    }
  }
);

/**
 * Créer un nouveau pointage manuel
 */
router.post('/correction/create',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin', 'manager'),
  async (req, res) => {
    try {
      const { employeeId, date, checkIn, checkOut, status, notes, shiftName } = req.body;
      
      console.log(`➕ Création pointage manuel pour ${employeeId} le ${date}`, req.body);
      
      if (!employeeId || !date) {
        return res.status(400).json({
          success: false,
          message: 'employeeId et date sont requis'
        });
      }
      
      // Vérifier l'employé
      const employeeCheck = await db.query(
        'SELECT id, first_name, last_name FROM employees WHERE employee_id = $1 AND is_active = true',
        [employeeId]
      );
      
      if (employeeCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employé non trouvé ou non actif'
        });
      }
      
      const employee = employeeCheck.rows[0];
      
      // Vérifier si un pointage existe déjà
      const existingCheck = await db.query(
        'SELECT id FROM attendance WHERE employee_id = $1 AND record_date = $2',
        [employeeId, date]
      );
      
      if (existingCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Un pointage existe déjà pour cette date',
          existingId: existingCheck.rows[0].id
        });
      }
      
      // Calculer les heures travaillées
      let hoursWorked = 0;
      if (checkIn && checkOut) {
        const timeToMinutes = (timeStr) => {
          const parts = timeStr.split(':').map(Number);
          return parts[0] * 60 + parts[1];
        };
        
        const checkInMinutes = timeToMinutes(checkIn);
        const checkOutMinutes = timeToMinutes(checkOut);
        let totalMinutes = checkOutMinutes - checkInMinutes;
        if (totalMinutes < 0) totalMinutes += 24 * 60;
        hoursWorked = totalMinutes / 60;
      }
      
      // Créer le nouveau pointage (avec seulement les colonnes qui existent)
      const insertResult = await db.query(`
        INSERT INTO attendance (
          employee_id,
          check_in_time,
          check_out_time,
          record_date,
          attendance_date,
          status,
          notes,
          shift_name,
          hours_worked,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *
      `, [
        employeeId,
        checkIn || null,
        checkOut || null,
        date,
        date,
        status || (checkIn && !checkOut ? 'present' : (checkIn && checkOut ? 'checked_out' : 'absent')),
        notes || '',
        shiftName || 'Standard',
        hoursWorked.toFixed(2)
      ]);
      
      const newRecord = insertResult.rows[0];
      
      // Log simple dans la console
      console.log(`✅ Pointage créé: ${newRecord.id} pour ${employeeId} le ${date}`);
      
      res.status(201).json({
        success: true,
        message: 'Pointage créé avec succès',
        data: {
          id: newRecord.id,
          employeeId: newRecord.employee_id,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          date: newRecord.record_date,
          checkIn: newRecord.check_in_time?.slice(0, 5) || null,
          checkOut: newRecord.check_out_time?.slice(0, 5) || null,
          status: newRecord.status,
          hoursWorked: newRecord.hours_worked
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur création pointage manuel:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création du pointage',
        error: error.message
      });
    }
  }
);

/**
 * Supprimer un pointage
 */
router.delete('/correction/delete/:attendanceId',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin'),
  async (req, res) => {
    try {
      const { attendanceId } = req.params;
      
      console.log(`🗑️ Suppression pointage ${attendanceId} par ${req.user.email}`);
      
      // Récupérer les infos du pointage avant suppression
      const attendanceCheck = await db.query(
        'SELECT id, employee_id, record_date, check_in_time, check_out_time FROM attendance WHERE id = $1',
        [attendanceId]
      );
      
      if (attendanceCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pointage non trouvé'
        });
      }
      
      const attendanceRecord = attendanceCheck.rows[0];
      
      // Supprimer le pointage
      await db.query('DELETE FROM attendance WHERE id = $1', [attendanceId]);
      
      console.log(`✅ Pointage ${attendanceId} supprimé par ${req.user.email}`);
      
      res.json({
        success: true,
        message: 'Pointage supprimé avec succès',
        data: {
          id: attendanceId,
          employeeId: attendanceRecord.employee_id,
          date: attendanceRecord.record_date,
          deletedBy: req.user.email,
          deletedAt: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur suppression pointage:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression du pointage',
        error: error.message
      });
    }
  }
);

/**
 * Historique des corrections pour un employé (version simplifiée)
 */
router.get('/correction/history/:employeeId',
  authMiddleware.authenticateToken,
  authMiddleware.authorizeRoles('admin', 'manager'),
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { limit = 50 } = req.query;
      
      // Pour l'instant, retourner un historique vide car la table n'existe pas
      // Vous pourriez utiliser les logs de la table attendance si vous avez un champ updated_at
      const historyQuery = await db.query(
        `SELECT 
          id,
          employee_id,
          check_in_time,
          check_out_time,
          record_date,
          status,
          notes,
          updated_at
        FROM attendance 
        WHERE employee_id = $1 
          AND updated_at != created_at
        ORDER BY updated_at DESC
        LIMIT $2`,
        [employeeId, parseInt(limit)]
      );
      
      res.json({
        success: true,
        data: historyQuery.rows.map(row => ({
          id: row.id,
          correctedAt: row.updated_at,
          original: {
            date: row.record_date,
            checkIn: row.check_in_time?.slice(0, 5) || null,
            checkOut: row.check_out_time?.slice(0, 5) || null,
            status: row.status
          },
          new: {
            date: row.record_date,
            checkIn: row.check_in_time?.slice(0, 5) || null,
            checkOut: row.check_out_time?.slice(0, 5) || null,
            status: row.status
          },
          notes: row.notes
        }))
      });
      
    } catch (error) {
      console.error('❌ Erreur récupération historique:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de l\'historique',
        error: error.message
      });
    }
  }
);

// ==================== SECTION 7: ROUTES DE DEBUG ET TEST ==================== 

/**
 * Route de test
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Attendance routes fonctionnent',
    timestamp: new Date().toISOString()
  });
});

/**
 * Debug du contrôleur
 */
router.get('/debug/controller', (req, res) => {
  const controllerInfo = {
    attendanceController: {
      exists: !!attendanceController,
      type: typeof attendanceController,
      methods: attendanceController ? Object.keys(attendanceController) : [],
      hasCheckIn: attendanceController && typeof attendanceController.checkIn === 'function',
      hasMarkAttendance: attendanceController && typeof attendanceController.markAttendance === 'function',
      hasGetAllAttendance: attendanceController && typeof attendanceController.getAllAttendance === 'function'
    }
  };
  
  console.log('🔍 Debug attendanceController:', controllerInfo);
  
  res.json({
    success: true,
    message: 'Debug information',
    data: controllerInfo,
    timestamp: new Date().toISOString()
  });
});

// Exporter le routeur
module.exports = router;