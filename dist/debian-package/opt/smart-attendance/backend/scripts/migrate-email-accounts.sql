-- ============================================
-- TABLE: email_accounts
-- Comptes SMTP configurables avec chiffrement AES-256-GCM
-- ============================================

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

CREATE INDEX IF NOT EXISTS idx_email_accounts_active 
    ON email_accounts(is_active, priority);

COMMENT ON COLUMN email_accounts.smtp_password IS 
    'Mot de passe SMTP chiffré AES-256-GCM (format: iv:authTag:ciphertext en base64)';

-- ============================================
-- TABLE: email_settings
-- Configuration globale
-- ============================================
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

-- ============================================
-- Vérification
-- ============================================
SELECT 
    'email_accounts' as table_name,
    count(*) as row_count
FROM email_accounts
UNION ALL
SELECT 
    'email_settings' as table_name,
    count(*) as row_count
FROM email_settings;