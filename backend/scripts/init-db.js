// backend/scripts/init-db.js
// Script d'initialisation complet de la base de données pour Smart Attendance System
// Utilise votre structure de tables exacte

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// ============================================
// CONFIGURATION DE LA CONNEXION
// ============================================
async function getConnection() {
  // Détection de l'environnement
  const isProduction = process.env.NODE_ENV === 'production';
  const isRender = !!process.env.RENDER || !!process.env.DATABASE_URL;
  
  console.log('🚀 ========== INITIALISATION BASE DE DONNÉES ==========');
  console.log(`📅 Date: ${new Date().toLocaleString()}`);
  console.log(`🌍 Environnement: ${isProduction ? 'PRODUCTION' : 'DÉVELOPPEMENT'}`);
  console.log(`🖥️  Plateforme: ${isRender ? 'Render.com' : 'Locale'}`);
  
  let pool;
  
  // Mode Render (production avec DATABASE_URL)
  if (isProduction && process.env.DATABASE_URL) {
    console.log('📦 Connexion via DATABASE_URL (Render)');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  } 
  // Mode production personnalisé
  else if (isProduction) {
    console.log('📦 Connexion production personnalisée');
    pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'smart_attendance_db',
      password: process.env.DB_PASSWORD || 'Haouala18',
      port: parseInt(process.env.DB_PORT) || 5432,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });
  } 
  // Mode développement local
  else {
    console.log('📦 Connexion développement local');
    pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'smart_attendance_db',
      password: process.env.DB_PASSWORD || 'Haouala18',
      port: parseInt(process.env.DB_PORT) || 5432
    });
  }
  
  return pool;
}

// ============================================
// CRÉATION DE TOUTES LES TABLES
// ============================================

async function createTables(pool) {
  console.log('\n📋 CRÉATION DES TABLES...');
  
  // ========== TABLE employees ==========
  console.log('  → Création table: employees');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      employee_id VARCHAR(50) UNIQUE NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      full_name VARCHAR(200) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'employee',
      department VARCHAR(100),
      position VARCHAR(100),
      phone VARCHAR(20),
      
      -- Informations personnelles
      cin VARCHAR(20),
      cnss_number VARCHAR(50),
      social_security_number VARCHAR(50),
      birth_date DATE,
      birth_place VARCHAR(100),
      nationality VARCHAR(50) DEFAULT 'Tunisienne',
      gender VARCHAR(20),
      address TEXT,
      
      -- Contact d'urgence
      emergency_contact VARCHAR(100),
      emergency_phone VARCHAR(20),
      
      -- Emploi
      hire_date DATE,
      contract_type VARCHAR(50),
      status VARCHAR(50) DEFAULT 'active',
      is_active BOOLEAN DEFAULT true,
      
      -- Reconnaissance faciale
      has_face_registered BOOLEAN DEFAULT false,
      face_registration_date TIMESTAMP WITH TIME ZONE,
      face_encoding BYTEA,
      face_encoding_date TIMESTAMP WITHOUT TIME ZONE,
      face_descriptors_count INTEGER DEFAULT 0,
      
      -- Gestion des tokens
      reset_token VARCHAR(255),
      reset_token_expiry TIMESTAMP WITHOUT TIME ZONE,
      
      -- Timestamps
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // ========== TABLE attendance ==========
  console.log('  → Création table: attendance');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      employee_id VARCHAR(50) NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
      employee_name VARCHAR(200),
      department VARCHAR(100),
      record_date DATE NOT NULL,
      attendance_date DATE,
      check_in_time TIME WITHOUT TIME ZONE NOT NULL,
      check_out_time TIME WITHOUT TIME ZONE,
      hours_worked NUMERIC(5,2),
      status VARCHAR(50) DEFAULT 'present',
      notes TEXT,
      shift_name VARCHAR(50) DEFAULT 'Standard',
      verification_method VARCHAR(50),
      face_verified BOOLEAN DEFAULT false,
      face_confidence NUMERIC(5,2),
      corrected_by VARCHAR(255),
      correction_date TIMESTAMP WITHOUT TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // ========== TABLE attendance_backup ==========
  console.log('  → Création table: attendance_backup');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance_backup (
      id INTEGER,
      employee_id VARCHAR(50),
      employee_name VARCHAR(200),
      department VARCHAR(100),
      record_date DATE,
      attendance_date DATE,
      check_in_time TIME WITHOUT TIME ZONE,
      check_out_time TIME WITHOUT TIME ZONE,
      hours_worked NUMERIC(5,2),
      status VARCHAR(50),
      notes TEXT,
      shift_name VARCHAR(50),
      verification_method VARCHAR(50),
      face_verified BOOLEAN,
      face_confidence NUMERIC(5,2),
      corrected_by VARCHAR(255),
      correction_date TIMESTAMP WITHOUT TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE,
      updated_at TIMESTAMP WITH TIME ZONE,
      backed_up_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // ========== TABLE attendance_corrections ==========
  console.log('  → Création table: attendance_corrections');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance_corrections (
      id SERIAL PRIMARY KEY,
      attendance_id INTEGER REFERENCES attendance(id) ON DELETE SET NULL,
      corrected_by VARCHAR(255) NOT NULL,
      original_check_in TIME WITHOUT TIME ZONE,
      original_check_out TIME WITHOUT TIME ZONE,
      original_date DATE NOT NULL,
      new_check_in TIME WITHOUT TIME ZONE,
      new_check_out TIME WITHOUT TIME ZONE,
      new_date DATE NOT NULL,
      correction_reason TEXT,
      corrected_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )
  `);

  // ========== TABLE attendance_deletions ==========
  console.log('  → Création table: attendance_deletions');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance_deletions (
      id SERIAL PRIMARY KEY,
      attendance_id INTEGER,
      employee_id VARCHAR(50) NOT NULL,
      attendance_date DATE NOT NULL,
      check_in_time TIME WITHOUT TIME ZONE,
      check_out_time TIME WITHOUT TIME ZONE,
      deleted_by VARCHAR(255) NOT NULL,
      deleted_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      deletion_reason TEXT
    )
  `);

  // ========== TABLE company_info ==========
  console.log('  → Création table: company_info');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_info (
      id SERIAL PRIMARY KEY,
      company_name VARCHAR(255) NOT NULL,
      legal_name VARCHAR(255) NOT NULL,
      address TEXT NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      fax VARCHAR(50),
      manager VARCHAR(255) NOT NULL,
      rc VARCHAR(100),
      matfisc VARCHAR(100),
      patente VARCHAR(100),
      cnss VARCHAR(100),
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )
  `);

  // ========== TABLE face_encodings ==========
  console.log('  → Création table: face_encodings');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS face_encodings (
      id SERIAL PRIMARY KEY,
      employee_id VARCHAR(50) NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
      face_encoding TEXT NOT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )
  `);

  // ========== TABLE facial_encodings ==========
  console.log('  → Création table: facial_encodings');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS facial_encodings (
      employee_id VARCHAR(50) PRIMARY KEY REFERENCES employees(employee_id) ON DELETE CASCADE,
      encoding_data JSONB NOT NULL,
      registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      image_size INTEGER,
      simulated BOOLEAN DEFAULT false,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )
  `);

  // ========== TABLE face_encoding_stats ==========
  console.log('  → Création table: face_encoding_stats');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS face_encoding_stats (
      id SERIAL PRIMARY KEY,
      employee_id VARCHAR(50) NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
      total_photos INTEGER DEFAULT 0,
      successful_registrations INTEGER DEFAULT 0,
      failed_registrations INTEGER DEFAULT 0,
      registration_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )
  `);

  // ========== TABLE notifications ==========
  console.log('  → Création table: notifications');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'info',
      priority VARCHAR(20) DEFAULT 'medium',
      link VARCHAR(255),
      read_status BOOLEAN DEFAULT false,
      read_at TIMESTAMP WITHOUT TIME ZONE,
      is_system BOOLEAN DEFAULT false,
      metadata JSONB,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )
  `);

  // ========== TABLE settings ==========
  console.log('  → Création table: settings');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      config JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // ========== TABLE salary_configs ==========
  console.log('  → Création table: salary_configs');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS salary_configs (
      id SERIAL PRIMARY KEY,
      employee_id VARCHAR(50) NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
      base_salary NUMERIC(10,3) NOT NULL,
      daily_rate NUMERIC(10,3),
      hourly_rate NUMERIC(10,3),
      overtime_rate NUMERIC(10,3),
      overtime_multiplier NUMERIC(3,2) DEFAULT 1.5,
      working_days INTEGER DEFAULT 22,
      daily_hours NUMERIC(4,2) DEFAULT 8,
      currency VARCHAR(10) DEFAULT 'TND',
      tax_rate NUMERIC(5,2) DEFAULT 0,
      social_security_rate NUMERIC(5,2) DEFAULT 0,
      bonus_fixed NUMERIC(10,3) DEFAULT 0,
      bonus_variable NUMERIC(10,3) DEFAULT 0,
      other_deductions NUMERIC(10,3) DEFAULT 0,
      allowances TEXT,
      deductions TEXT,
      payment_method VARCHAR(50) DEFAULT 'bank',
      bank_name VARCHAR(255),
      bank_account VARCHAR(100),
      iban VARCHAR(50),
      contract_type VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )
  `);

  // ========== TABLE salary_payments ==========
  console.log('  → Création table: salary_payments');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS salary_payments (
      id SERIAL PRIMARY KEY,
      employee_id VARCHAR(50) NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
      month_year VARCHAR(7) NOT NULL,
      base_salary NUMERIC(10,3) NOT NULL,
      gross_salary NUMERIC(10,3),
      net_salary NUMERIC(10,3) NOT NULL,
      
      -- Présence
      days_worked INTEGER,
      days_absent INTEGER,
      days_present INTEGER,
      late_days INTEGER,
      early_leave_days INTEGER,
      overtime_hours NUMERIC(5,2),
      
      -- Montants
      overtime_amount NUMERIC(10,3) DEFAULT 0,
      bonus_amount NUMERIC(10,3) DEFAULT 0,
      bonus_fixed NUMERIC(10,3) DEFAULT 0,
      bonus_variable NUMERIC(10,3) DEFAULT 0,
      deduction_amount NUMERIC(10,3) DEFAULT 0,
      other_deductions NUMERIC(10,3) DEFAULT 0,
      tax_amount NUMERIC(10,3) DEFAULT 0,
      social_security_amount NUMERIC(10,3) DEFAULT 0,
      total_deductions NUMERIC(10,3) DEFAULT 0,
      
      -- Statut
      payment_status VARCHAR(50) DEFAULT 'pending',
      payment_date DATE,
      payment_method VARCHAR(50),
      notes TEXT,
      
      -- Validation
      paid_by INTEGER REFERENCES employees(id),
      approved_by INTEGER REFERENCES employees(id),
      
      -- Email
      email_sent BOOLEAN DEFAULT false,
      email_sent_at TIMESTAMP WITHOUT TIME ZONE,
      email_error TEXT,
      email_attempts INTEGER DEFAULT 0,
      email_status VARCHAR(50),
      
      -- Timestamps
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )
  `);

  // ========== TABLE pay_months ==========
  console.log('  → Création table: pay_months');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pay_months (
      id SERIAL PRIMARY KEY,
      month_year VARCHAR(7) UNIQUE NOT NULL,
      month_name VARCHAR(20) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      total_employees INTEGER DEFAULT 0,
      total_amount NUMERIC(12,3) DEFAULT 0,
      total_tax NUMERIC(12,3) DEFAULT 0,
      total_deductions NUMERIC(12,3) DEFAULT 0,
      total_net NUMERIC(12,3) DEFAULT 0,
      emails_sent INTEGER DEFAULT 0,
      emails_failed INTEGER DEFAULT 0,
      email_details JSONB,
      paid_at TIMESTAMP WITHOUT TIME ZONE,
      paid_by INTEGER REFERENCES employees(id),
      approved_by INTEGER REFERENCES employees(id),
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )
  `);

  // ========== TABLE salary_components ==========
  console.log('  → Création table: salary_components');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS salary_components (
      id SERIAL PRIMARY KEY,
      payment_id INTEGER NOT NULL REFERENCES salary_payments(id) ON DELETE CASCADE,
      component_type VARCHAR(50) NOT NULL,
      component_name VARCHAR(100) NOT NULL,
      amount NUMERIC(10,3) NOT NULL,
      rate NUMERIC(5,2),
      quantity NUMERIC(10,2),
      notes TEXT,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )
  `);

  // ========== TABLE payroll_settings ==========
  console.log('  → Création table: payroll_settings');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payroll_settings (
      id SERIAL PRIMARY KEY,
      setting_key VARCHAR(100) UNIQUE NOT NULL,
      setting_value TEXT NOT NULL,
      setting_type VARCHAR(50) DEFAULT 'string',
      category VARCHAR(50) DEFAULT 'general',
      description TEXT,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )
  `);

  // ========== TABLE refresh_tokens ==========
  console.log('  → Création table: refresh_tokens');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      device_info TEXT,
      ip_address VARCHAR(45),
      expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
      is_revoked BOOLEAN DEFAULT false,
      revoked_at TIMESTAMP WITHOUT TIME ZONE,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )
  `);

  console.log('✅ Toutes les tables ont été créées avec succès\n');
}

// ============================================
// CRÉATION DES INDEX POUR OPTIMISATION
// ============================================

async function createIndexes(pool) {
  console.log('📊 CRÉATION DES INDEX...');
  
  const indexes = [
    // Employees
    `CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id)`,
    `CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email)`,
    `CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department)`,
    `CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role)`,
    `CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active)`,
    
    // Attendance
    `CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id)`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_record_date ON attendance(record_date)`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status)`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, record_date)`,
    
    // Salary payments
    `CREATE INDEX IF NOT EXISTS idx_salary_payments_employee_id ON salary_payments(employee_id)`,
    `CREATE INDEX IF NOT EXISTS idx_salary_payments_month_year ON salary_payments(month_year)`,
    `CREATE INDEX IF NOT EXISTS idx_salary_payments_status ON salary_payments(payment_status)`,
    `CREATE INDEX IF NOT EXISTS idx_salary_payments_employee_month ON salary_payments(employee_id, month_year)`,
    
    // Notifications
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_read_status ON notifications(read_status)`,
    
    // Face encodings
    `CREATE INDEX IF NOT EXISTS idx_face_encodings_employee_id ON face_encodings(employee_id)`,
    
    // Refresh tokens
    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)`,
    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at)`
  ];
  
  for (const index of indexes) {
    try {
      await pool.query(index);
      console.log(`  ✅ Index créé`);
    } catch (error) {
      console.log(`  ⚠️  Erreur index: ${error.message.substring(0, 50)}`);
    }
  }
  
  console.log('✅ Index créés avec succès\n');
}

// ============================================
// CRÉATION DES VUES
// ============================================

async function createViews(pool) {
  console.log('👁️ CRÉATION DES VUES...');
  
  // Vue v_employee_payslip_full (d'après votre structure)
  await pool.query(`
    CREATE OR REPLACE VIEW v_employee_payslip_full AS
    SELECT 
      e.employee_id,
      e.first_name || ' ' || e.last_name AS employee_name,
      e.first_name,
      e.last_name,
      e.email,
      e.phone,
      e.department,
      e.position,
      e.hire_date,
      e.cnss_number AS cnss,
      e.contract_type,
      e.address,
      sc.bank_name,
      sc.bank_account,
      sc.iban,
      sp.month_year,
      sc.base_salary,
      sp.gross_salary,
      sp.net_salary,
      sp.overtime_amount,
      sp.bonus_amount,
      sp.deduction_amount,
      sp.tax_amount,
      sp.social_security_amount,
      sp.payment_status,
      sp.payment_date
    FROM employees e
    LEFT JOIN salary_configs sc ON e.employee_id = sc.employee_id
    LEFT JOIN salary_payments sp ON e.employee_id = sp.employee_id
  `);
  
  console.log('✅ Vues créées avec succès\n');
}

// ============================================
// INSERTION DES DONNÉES PAR DÉFAUT
// ============================================

async function insertDefaultData(pool) {
  console.log('📦 INSERTION DES DONNÉES PAR DÉFAUT...');
  
  // Vérifier si des employés existent déjà
  const employeeCount = await pool.query(`SELECT COUNT(*) FROM employees`);
  
  if (parseInt(employeeCount.rows[0].count) === 0) {
    console.log('  → Création de l\'administrateur par défaut');
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('admin123', salt);
    
    await pool.query(`
      INSERT INTO employees (
        employee_id, first_name, last_name, email, 
        password_hash, role, department, position, is_active
      ) VALUES (
        'ADMIN001', 'Admin', 'Système', 'admin@smart-attendance.com',
        $1, 'admin', 'Direction', 'Administrateur', true
      )
    `, [passwordHash]);
    
    console.log('  ✅ Administrateur créé: admin@smart-attendance.com / admin123');
  } else {
    console.log(`  → ${employeeCount.rows[0].count} employés existants, pas de création`);
  }
  
  // Vérifier les paramètres
  const settingsCount = await pool.query(`SELECT COUNT(*) FROM settings`);
  
  if (parseInt(settingsCount.rows[0].count) === 0) {
    console.log('  → Création des paramètres par défaut');
    
    await pool.query(`
      INSERT INTO settings (config) VALUES ($1)
    `, [JSON.stringify({
      companyName: 'Smart Attendance System',
      workStartTime: '08:00',
      workEndTime: '17:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      facialRecognitionEnabled: true,
      multiShiftEnabled: true,
      geoLocationEnabled: false,
      manualCheckinEnabled: true,
      qrCodeCheckinEnabled: false,
      theme: 'light',
      language: 'fr'
    })]);
    
    console.log('  ✅ Paramètres créés');
  }
  
  console.log('✅ Données par défaut insérées\n');
}

// ============================================
// FONCTION PRINCIPALE
// ============================================

async function initializeDatabase() {
  let pool;
  
  try {
    // Connexion
    pool = await getConnection();
    
    // Test de connexion
    await pool.query('SELECT 1');
    console.log('✅ Connexion à la base de données établie\n');
    
    // Création des tables
    await createTables(pool);
    
    // Création des index
    await createIndexes(pool);
    
    // Création des vues
    await createViews(pool);
    
    // Insertion des données par défaut
    await insertDefaultData(pool);
    
    // Vérification finale
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\n📋 RÉCAPITULATIF DES TABLES CRÉÉES:');
    tables.rows.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.table_name}`);
    });
    console.log(`\n✅ TOTAL: ${tables.rows.length} tables`);
    
    console.log('\n🎉 INITIALISATION TERMINÉE AVEC SUCCÈS !\n');
    
  } catch (error) {
    console.error('\n❌ ERREUR D\'INITIALISATION:');
    console.error(error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
      console.log('🔌 Connexion fermée');
    }
  }
}

// ============================================
// EXÉCUTION
// ============================================

// Si exécuté directement (node init-db.js)
if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = initializeDatabase;
