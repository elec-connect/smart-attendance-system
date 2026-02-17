// config/config.js
const fs = require('fs');
const path = require('path');

// Charger .env manuellement
const envPath = path.join(__dirname, '..', '.env');
const env = {};

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex !== -1) {
        const key = trimmed.substring(0, equalIndex).trim();
        const value = trimmed.substring(equalIndex + 1).trim();
        env[key] = value;
        process.env[key] = value;
      }
    }
  });
  console.log('✅ Fichier .env chargé manuellement');
}

// Configuration par défaut
const config = {
  // Database
  db: {
    host: env.DB_HOST || 'localhost',
    port: parseInt(env.DB_PORT) || 5432,
    database: env.DB_NAME || 'smart_attendance_db',
    user: env.DB_USER || 'postgres',
    password: env.DB_PASSWORD || 'Haouala18',
  },
  
  // JWT
  jwt: {
    secret: env.JWT_SECRET || 'development_jwt_secret_key_smart_attendance_system_2024_abcdef123456',
    expiresIn: '7d'
  },
  
  // Server
  server: {
    port: parseInt(env.PORT) || 5000,
    frontendUrl: env.FRONTEND_URL || 'http://localhost:5173',
    nodeEnv: env.NODE_ENV || 'development'
  },
  
  // Facial Recognition - NOUVELLE SECTION
  facialRecognition: {
    useReal: env.USE_REAL_FACIAL_RECOGNITION === 'true' || env.FACE_RECOGNITION_MODE === 'REAL' || false,
    mode: env.FACE_RECOGNITION_MODE || 'SIMULATION'
  }
};

// Validation
if (!config.jwt.secret || config.jwt.secret === 'development_jwt_secret_key_smart_attendance_system_2024_abcdef123456') {
  console.warn('⚠️ ATTENTION: Utilisation d\'un JWT_SECRET de développement');
}

module.exports = config;