-- ============================================
-- SMART ATTENDANCE SYSTEM - SCHÉMA COMPLET
-- Créé automatiquement par l'installateur
-- ============================================

-- Extension pour bcrypt (crypt) et UUID
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════
-- 1. TABLE : employees (employés)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    cin VARCHAR(50),
    cnss_number VARCHAR(50),
    phone VARCHAR(30),
    department VARCHAR(100),
    position VARCHAR(100),
    role VARCHAR(50) DEFAULT 'employee',
    hire_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'active',
    has_face_registered BOOLEAN DEFAULT false,
    face_descriptor JSONB,
    shift_name VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);

-- ═══════════════════════════════════════════
-- 2. TABLE : attendance (présences)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    attendance_date DATE NOT NULL,
    record_date DATE DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    hours_worked NUMERIC(5,2) DEFAULT 0,
    overtime_hours NUMERIC(5,2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'present',
    shift_name VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

-- ═══════════════════════════════════════════
-- 3. TABLE : settings (paramètres globaux)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT settings_single_row CHECK (id = 1)
);

-- Insérer config par défaut
INSERT INTO settings (id, config) 
VALUES (1, '{
  "company": {
    "name": "",
    "address": "",
    "contactEmail": "",
    "phone": ""
  },
  "features": {
    "qrCodeCheckin": false,
    "facialRecognition": true,
    "geoLocation": false,
    "multiShift": true,
    "manualCheckin": true
  },
  "attendance": {
    "workDays": ["monday", "tuesday", "wednesday", "thursday", "friday"],
    "overtimeEnabled": false,
    "overtimeThreshold": 8,
    "globalBreakDuration": 60
  },
  "shifts": {
    "shift1": {
      "name": "Shift Standard",
      "start": "08:00",
      "end": "17:00",
      "lateThreshold": "08:14",
      "halfDayThreshold": "12:00",
      "breakDuration": 60,
      "enabled": true,
      "color": "blue"
    }
  },
  "notifications": {
    "emailReminders": true,
    "pushNotifications": true,
    "checkInReminderTime": "08:45",
    "monthlyReport": true,
    "weeklySummary": true
  }
}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════
-- 4. TABLE : notifications
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255),
    user_id INTEGER,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    priority VARCHAR(20) DEFAULT 'normal',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ═══════════════════════════════════════════
-- 5. TABLE : payroll (paie)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payroll (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    month_year VARCHAR(7) NOT NULL,     -- format 'YYYY-MM'
    base_salary NUMERIC(12,2) DEFAULT 0,
    worked_days INTEGER DEFAULT 0,
    worked_hours NUMERIC(7,2) DEFAULT 0,
    overtime_hours NUMERIC(7,2) DEFAULT 0,
    overtime_amount NUMERIC(12,2) DEFAULT 0,
    bonuses NUMERIC(12,2) DEFAULT 0,
    deductions NUMERIC(12,2) DEFAULT 0,
    tax_amount NUMERIC(12,2) DEFAULT 0,
    ss_amount NUMERIC(12,2) DEFAULT 0,      -- Sécurité sociale
    cnss_amount NUMERIC(12,2) DEFAULT 0,
    net_salary NUMERIC(12,2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'pending',
    paid_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_payroll_employee ON payroll(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_month ON payroll(month_year);
CREATE INDEX IF NOT EXISTS idx_payroll_status ON payroll(status);

-- ═══════════════════════════════════════════
-- 6. TABLE : payments (historique des paiements)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    payroll_id INTEGER REFERENCES payroll(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    payment_method VARCHAR(50),
    reference VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_employee ON payments(employee_id);

-- ═══════════════════════════════════════════
-- 7. TABLE : email_accounts (SMTP - chiffrés)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS email_accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_secure BOOLEAN NOT NULL DEFAULT false,
    smtp_user VARCHAR(255) NOT NULL,
    smtp_password TEXT NOT NULL,
    from_name VARCHAR(255) DEFAULT 'Smart Attendance',
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    emails_sent_today INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT email_accounts_email_unique UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_email_accounts_active ON email_accounts(is_active, priority);

-- ═══════════════════════════════════════════
-- 8. TABLE : email_settings
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS email_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    daily_capacity_per_account INTEGER DEFAULT 450,
    batch_size INTEGER DEFAULT 100,
    batch_pause_seconds INTEGER DEFAULT 3,
    rotation_enabled BOOLEAN DEFAULT true,
    notifications_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT email_settings_single_row CHECK (id = 1)
);

INSERT INTO email_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════
-- 9. TABLE : shift_assignments
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS shift_assignments (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    shift_key VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    week_number INTEGER,
    year INTEGER,
    is_manual BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_employee ON shift_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_shifts_dates ON shift_assignments(start_date, end_date);

-- ═══════════════════════════════════════════
-- 10. TABLE : corrections (historique corrections présences)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS attendance_corrections (
    id SERIAL PRIMARY KEY,
    attendance_id INTEGER REFERENCES attendance(id) ON DELETE CASCADE,
    corrected_by VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- MESSAGE FINAL
-- ═══════════════════════════════════════════
DO $$
BEGIN
    RAISE NOTICE '✅ Base de données Smart Attendance créée avec succès';
    RAISE NOTICE '   Tables : employees, attendance, settings, notifications,';
    RAISE NOTICE '           payroll, payments, email_accounts, email_settings,';
    RAISE NOTICE '           shift_assignments, attendance_corrections';
END $$;