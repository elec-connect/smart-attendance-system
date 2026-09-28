// backend/src/routes/shiftRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const shiftRotationService = require('../services/shiftRotationService');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

/**
 * GET /api/shifts/available
 * Récupérer tous les shifts disponibles depuis settings
 */
router.get('/available', async (req, res) => {
  try {
    console.log('🔍 [GET /api/shifts/available] Récupération des shifts disponibles');
    
    const result = await db.query(
      'SELECT config->\'shifts\' as shifts FROM settings WHERE id = 1'
    );
    
    let shifts = {};
    if (result.rows.length > 0 && result.rows[0].shifts) {
      shifts = result.rows[0].shifts;
    } else {
      // Shifts par défaut
      shifts = {
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
      };
    }
    
    // Transformer en tableau pour le frontend
    const shiftsArray = Object.entries(shifts).map(([key, value]) => ({
      key,
      ...value
    }));
    
    res.json({
      success: true,
      data: shiftsArray,
      raw: shifts
    });
    
  } catch (error) {
    console.error('❌ Erreur get available shifts:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/shifts/employee/:employeeId
 * Récupérer les informations de shift d'un employé
 */
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    console.log(`🔍 [GET /api/shifts/employee/${employeeId}] Récupération info shift`);
    
    // Récupérer le shift actuel via le service
    const currentShift = await shiftRotationService.getEmployeeShiftForDate(employeeId, new Date());
    
    // Récupérer l'historique des shifts manuels
    const historyResult = await db.query(`
      SELECT 
        id,
        shift_name,
        week_number,
        year,
        start_date,
        end_date,
        created_at,
        created_by,
        reason
      FROM employee_shifts 
      WHERE employee_id = $1 
      ORDER BY year DESC, week_number DESC
      LIMIT 20
    `, [employeeId]);
    
    // Récupérer la configuration de départ
    const startConfigResult = await db.query(`
      SELECT start_week, start_year, start_shift, updated_at
      FROM employee_shift_start 
      WHERE employee_id = $1
    `, [employeeId]);
    
    res.json({
      success: true,
      data: {
        current: currentShift,
        history: historyResult.rows,
        startConfig: startConfigResult.rows[0] || null
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur get employee shift info:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/shifts/employee/:employeeId/history
 * Récupérer l'historique des shifts d'un employé
 */
router.get('/employee/:employeeId/history', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { limit = 20 } = req.query;
    
    console.log(`🔍 [GET /api/shifts/employee/${employeeId}/history] Récupération historique`);
    
    const result = await db.query(`
      SELECT 
        id,
        shift_name,
        week_number,
        year,
        start_date,
        end_date,
        created_at,
        created_by,
        reason
      FROM employee_shifts 
      WHERE employee_id = $1 
      ORDER BY year DESC, week_number DESC
      LIMIT $2
    `, [employeeId, parseInt(limit)]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('❌ Erreur get shift history:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/shifts/employee/:employeeId/manual
 * Assigner un shift manuellement pour une semaine spécifique
 */
router.post('/employee/:employeeId/manual', authorizeRoles('admin'), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { shiftName, weekNumber, year, reason, type } = req.body;
    
    console.log(`📝 [POST /api/shifts/employee/${employeeId}/manual] Assignation manuelle`);
    console.log('📦 Données:', { shiftName, weekNumber, year, reason, type });
    
    if (!shiftName || !weekNumber || !year) {
      return res.status(400).json({
        success: false,
        message: 'shiftName, weekNumber et year sont requis'
      });
    }
    
    // Calculer les dates de début et fin de semaine
    const startDate = getDateFromWeek(weekNumber, year);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    
    // Vérifier si un shift existe déjà pour cette semaine
    const existing = await db.query(`
      SELECT id FROM employee_shifts 
      WHERE employee_id = $1 AND week_number = $2 AND year = $3
    `, [employeeId, weekNumber, year]);
    
    let result;
    
    if (existing.rows.length > 0) {
      // Mise à jour
      result = await db.query(`
        UPDATE employee_shifts 
        SET shift_name = $1, 
            reason = COALESCE($2, reason),
            updated_at = NOW(),
            updated_by = $3
        WHERE employee_id = $4 AND week_number = $5 AND year = $6
        RETURNING *
      `, [shiftName, reason, req.user.email, employeeId, weekNumber, year]);
    } else {
      // Insertion
      result = await db.query(`
        INSERT INTO employee_shifts 
          (employee_id, shift_name, week_number, year, start_date, end_date, created_by, reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [employeeId, shiftName, weekNumber, year, startDate, endDate, req.user.email, reason]);
    }
    
    // Ajouter un log dans l'historique des modifications (table séparée optionnelle)
    try {
      await db.query(`
        INSERT INTO shift_modification_log 
          (employee_id, action, details, performed_by)
        VALUES ($1, 'manual_assignment', $2, $3)
      `, [employeeId, JSON.stringify({ shiftName, weekNumber, year, reason }), req.user.email]);
    } catch (logError) {
      console.warn('⚠️ Erreur lors du log:', logError.message);
    }
    
    res.json({
      success: true,
      message: `Shift assigné pour semaine ${weekNumber}/${year}`,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Erreur assign manual shift:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * DELETE /api/shifts/manual/:id
 * Supprimer une assignation manuelle
 */
router.delete('/manual/:id', authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ [DELETE /api/shifts/manual/${id}] Suppression assignation manuelle`);
    
    // Récupérer l'assignation avant de la supprimer pour le log
    const beforeResult = await db.query(`
      SELECT employee_id, shift_name, week_number, year 
      FROM employee_shifts WHERE id = $1
    `, [id]);
    
    const result = await db.query(`
      DELETE FROM employee_shifts WHERE id = $1 RETURNING *
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Assignation non trouvée'
      });
    }
    
    // Log de la suppression
    if (beforeResult.rows.length > 0) {
      try {
        await db.query(`
          INSERT INTO shift_modification_log 
            (employee_id, action, details, performed_by)
          VALUES ($1, 'delete_manual', $2, $3)
        `, [
          beforeResult.rows[0].employee_id,
          JSON.stringify(beforeResult.rows[0]),
          req.user.email
        ]);
      } catch (logError) {
        console.warn('⚠️ Erreur lors du log:', logError.message);
      }
    }
    
    res.json({
      success: true,
      message: 'Assignation manuelle supprimée',
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Erreur delete manual assignment:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * PUT /api/shifts/employee/:employeeId/start-config
 * Modifier la configuration de départ d'un employé
 */
router.put('/employee/:employeeId/start-config', authorizeRoles('admin'), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startWeek, startYear, startShift } = req.body;
    
    console.log(`📝 [PUT /api/shifts/employee/${employeeId}/start-config] Mise à jour config départ`);
    
    if (!startWeek || !startYear || !startShift) {
      return res.status(400).json({
        success: false,
        message: 'startWeek, startYear et startShift sont requis'
      });
    }
    
    await db.query(`
      INSERT INTO employee_shift_start 
        (employee_id, start_week, start_year, start_shift, updated_at, updated_by)
      VALUES ($1, $2, $3, $4, NOW(), $5)
      ON CONFLICT (employee_id) 
      DO UPDATE SET 
        start_week = EXCLUDED.start_week,
        start_year = EXCLUDED.start_year,
        start_shift = EXCLUDED.start_shift,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
    `, [employeeId, startWeek, startYear, startShift, req.user.email]);
    
    // Log de la modification
    try {
      await db.query(`
        INSERT INTO shift_modification_log 
          (employee_id, action, details, performed_by)
        VALUES ($1, 'update_start_config', $2, $3)
      `, [employeeId, JSON.stringify({ startWeek, startYear, startShift }), req.user.email]);
    } catch (logError) {
      console.warn('⚠️ Erreur lors du log:', logError.message);
    }
    
    res.json({
      success: true,
      message: 'Configuration de départ mise à jour'
    });
    
  } catch (error) {
    console.error('❌ Erreur update start config:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/shifts/stats
 * Récupérer les statistiques par shift
 */
router.get('/stats', async (req, res) => {
  try {
    const { date } = req.query;
    const statsDate = date || new Date().toISOString().split('T')[0];
    
    console.log(`📊 [GET /api/shifts/stats] Statistiques pour le ${statsDate}`);
    
    const shiftStats = await db.query(`
      SELECT 
        COALESCE(e.shift_name, 'Shift Standard') as shift_name,
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
    
    // Formater les résultats
    const formattedStats = {};
    shiftStats.rows.forEach(row => {
      formattedStats[row.shift_name] = {
        count: parseInt(row.total_employees),
        present: parseInt(row.present_count),
        late: parseInt(row.late_count),
        halfDay: parseInt(row.half_day_count),
        absent: parseInt(row.absent_count),
        attendanceRate: row.total_employees > 0 
          ? ((row.present_count / row.total_employees) * 100).toFixed(1)
          : 0,
        avgHours: parseFloat(row.avg_hours).toFixed(2),
        totalHours: parseFloat(row.total_hours).toFixed(2)
      };
    });
    
    res.json({
      success: true,
      data: formattedStats,
      date: statsDate
    });
    
  } catch (error) {
    console.error('❌ Erreur get shift stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/shifts/forecast/:year
 * Obtenir le calendrier prévisionnel pour une année
 */
router.get('/forecast/:year', authorizeRoles('admin'), async (req, res) => {
  try {
    const { year } = req.params;
    const { department } = req.query;
    
    console.log(`📅 [GET /api/shifts/forecast/${year}] Calendrier prévisionnel`);
    
    let query = `
      SELECT 
        e.employee_id,
        e.first_name,
        e.last_name,
        e.department,
        COALESCE(es.shift_name, 'Shift Standard') as shift_name,
        COALESCE(es.week_number, 0) as week_number,
        COALESCE(es.year, $1) as year,
        es.start_date,
        es.end_date,
        CASE WHEN es.id IS NOT NULL THEN 'manual' ELSE 'automatic' END as source
      FROM employees e
      LEFT JOIN employee_shifts es ON e.employee_id = es.employee_id AND es.year = $1
      WHERE e.is_active = true
    `;
    
    const params = [year];
    
    if (department) {
      query += ` AND e.department = $2`;
      params.push(department);
    }
    
    query += ` ORDER BY e.last_name, e.first_name, es.week_number`;
    
    const result = await db.query(query, params);
    
    // Grouper par semaine
    const groupedByWeek = {};
    result.rows.forEach(row => {
      const weekKey = `S${row.week_number}`;
      if (!groupedByWeek[weekKey]) {
        groupedByWeek[weekKey] = [];
      }
      groupedByWeek[weekKey].push(row);
    });
    
    res.json({
      success: true,
      data: groupedByWeek,
      raw: result.rows
    });
    
  } catch (error) {
    console.error('❌ Erreur get forecast:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/shifts/initialize-starts
 * Initialiser les positions de départ pour un département
 */
router.post('/initialize-starts', authorizeRoles('admin'), async (req, res) => {
  try {
    const { department, startWeek = 1, startYear = 2026 } = req.body;
    
    console.log(`🔄 [POST /api/shifts/initialize-starts] Initialisation pour ${department}`);
    
    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'department est requis'
      });
    }
    
    // Récupérer tous les employés actifs du département
    const employees = await db.query(`
      SELECT employee_id, first_name, last_name 
      FROM employees 
      WHERE department = $1 AND is_active = true
      ORDER BY employee_id
    `, [department]);
    
    const results = [];
    
    // Répartir équitablement sur les 3 shifts de départ
    for (let i = 0; i < employees.rows.length; i++) {
      const employee = employees.rows[i];
      
      // Distribution cyclique: 0,1,2,0,1,2,...
      const seed = i % 3;
      let startShift;
      
      if (seed === 0) startShift = "Shift Matin";
      else if (seed === 1) startShift = "Shift Après-midi";
      else startShift = "Shift Nuit";
      
      // Sauvegarder ou mettre à jour
      await db.query(`
        INSERT INTO employee_shift_start 
          (employee_id, start_week, start_year, start_shift, created_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (employee_id) 
        DO UPDATE SET 
          start_week = EXCLUDED.start_week,
          start_year = EXCLUDED.start_year,
          start_shift = EXCLUDED.start_shift,
          updated_at = NOW(),
          updated_by = EXCLUDED.created_by
      `, [employee.employee_id, startWeek, startYear, startShift, req.user.email]);
      
      results.push({
        employeeId: employee.employee_id,
        name: `${employee.first_name} ${employee.last_name}`,
        startShift,
        seed
      });
    }
    
    res.json({
      success: true,
      message: `${results.length} employés initialisés dans ${department}`,
      data: results
    });
    
  } catch (error) {
    console.error('❌ Erreur initialize starts:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Fonction utilitaire pour obtenir la date à partir du numéro de semaine
function getDateFromWeek(week, year) {
  const date = new Date(year, 0, 1);
  date.setDate(date.getDate() + (week - 1) * 7);
  return date;
}

module.exports = router;