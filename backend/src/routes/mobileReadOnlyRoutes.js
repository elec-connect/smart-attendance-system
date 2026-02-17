// backend/src/routes/mobileReadOnlyRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware lecture seule - bloque POST/PUT/DELETE
const readOnlyMiddleware = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(403).json({
      success: false,
      message: 'Application mobile en mode lecture seule',
      allowedMethods: ['GET']
    });
  }
  next();
};

router.use(readOnlyMiddleware);

// 1. Dashboard mobile (statistiques)
router.get('/mobile/dashboard', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const stats = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM employees WHERE is_active = true) as total_employees,
        (SELECT COUNT(*) FROM attendance WHERE DATE(check_in_time) = $1) as today_checkins,
        (SELECT COUNT(*) FROM attendance WHERE check_out_time IS NULL 
         AND DATE(check_in_time) = $1) as currently_present,
        (SELECT COUNT(DISTINCT employee_id) FROM attendance 
         WHERE DATE(check_in_time) = $1) as unique_attendees
    `, [today]);
    
    res.json({
      success: true,
      mobile: true,
      readOnly: true,
      stats: stats.rows[0],
      lastUpdate: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Liste des employés (mobile optimisé)
router.get('/mobile/employees', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const employees = await db.query(`
      SELECT 
        employee_id,
        first_name,
        last_name,
        department,
        position,
        is_active,
        has_face_registered,
        created_at
      FROM employees 
      WHERE is_active = true
      ORDER BY first_name
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    res.json({
      success: true,
      mobile: true,
      readOnly: true,
      employees: employees.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: (await db.query('SELECT COUNT(*) FROM employees WHERE is_active = true')).rows[0].count
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Pointages du jour
router.get('/mobile/attendance/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const attendance = await db.query(`
      SELECT 
        a.id,
        a.employee_id,
        a.check_in_time,
        a.check_out_time,
        a.status,
        e.first_name,
        e.last_name,
        e.department,
        EXTRACT(HOUR FROM a.check_in_time) as checkin_hour,
        EXTRACT(MINUTE FROM a.check_in_time) as checkin_minute
      FROM attendance a
      JOIN employees e ON e.employee_id = a.employee_id
      WHERE DATE(a.record_date) = $1
      ORDER BY a.check_in_time DESC
      LIMIT 50
    `, [today]);
    
    res.json({
      success: true,
      mobile: true,
      readOnly: true,
      date: today,
      attendance: attendance.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Détails employé
router.get('/mobile/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const employee = await db.query(`
      SELECT 
        employee_id,
        first_name,
        last_name,
        email,
        department,
        position,
        role,
        is_active,
        has_face_registered,
        created_at
      FROM employees 
      WHERE employee_id = $1
    `, [id]);
    
    if (employee.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employé non trouvé'
      });
    }
    
    // Historique des pointages (7 derniers jours)
    const attendanceHistory = await db.query(`
      SELECT 
        check_in_time,
        check_out_time,
        status,
        shift_name
      FROM attendance
      WHERE employee_id = $1
      AND record_date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY record_date DESC
    `, [id]);
    
    res.json({
      success: true,
      mobile: true,
      readOnly: true,
      employee: employee.rows[0],
      attendanceHistory: attendanceHistory.rows,
      stats: {
        totalCheckins: attendanceHistory.rows.length,
        lastCheckin: attendanceHistory.rows[0]?.check_in_time || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Statistiques par département
router.get('/mobile/stats/departments', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const stats = await db.query(`
      SELECT 
        e.department,
        COUNT(DISTINCT e.employee_id) as total_employees,
        COUNT(DISTINCT a.employee_id) as checked_in_today,
        ROUND(
          COUNT(DISTINCT a.employee_id) * 100.0 / NULLIF(COUNT(DISTINCT e.employee_id), 0), 
          1
        ) as attendance_rate
      FROM employees e
      LEFT JOIN attendance a ON e.employee_id = a.employee_id 
        AND DATE(a.check_in_time) = $1
      WHERE e.is_active = true
      GROUP BY e.department
      ORDER BY attendance_rate DESC
    `, [today]);
    
    res.json({
      success: true,
      mobile: true,
      readOnly: true,
      date: today,
      departments: stats.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Présence en temps réel
router.get('/mobile/presence/now', async (req, res) => {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    
    const presentEmployees = await db.query(`
      SELECT 
        e.employee_id,
        e.first_name,
        e.last_name,
        e.department,
        a.check_in_time,
        EXTRACT(HOUR FROM a.check_in_time) as checkin_hour,
        CASE 
          WHEN a.check_out_time IS NULL THEN 'Présent'
          ELSE 'Parti'
        END as status
      FROM attendance a
      JOIN employees e ON e.employee_id = a.employee_id
      WHERE DATE(a.check_in_time) = CURRENT_DATE
      AND (a.check_out_time IS NULL OR EXTRACT(HOUR FROM a.check_out_time) >= $1 - 1)
      ORDER BY a.check_in_time DESC
    `, [currentHour]);
    
    res.json({
      success: true,
      mobile: true,
      readOnly: true,
      timestamp: now,
      currentHour: currentHour,
      present: presentEmployees.rows.filter(e => e.status === 'Présent'),
      recentlyLeft: presentEmployees.rows.filter(e => e.status === 'Parti'),
      stats: {
        totalPresent: presentEmployees.rows.filter(e => e.status === 'Présent').length,
        totalRecentlyLeft: presentEmployees.rows.filter(e => e.status === 'Parti').length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
