// ============================================
// SMART ATTENDANCE SYSTEM - SERVER PRODUCTION
// Configuration pour backend local + frontend Netlify
// AVEC SYSTÈME D'ACTIVATION 30 JOURS - CORRIGÉ
// ============================================
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// ==================== CHARGEMENT .env AVANT TOUT ====================
const envPath = path.join(__dirname, '.env');
console.log(`🔧 Chargement .env depuis: ${envPath}`);

const dotenvResult = require('dotenv').config({ path: envPath });

if (dotenvResult.error) {
    console.error('❌ Erreur chargement .env:', dotenvResult.error);
    console.log('⚠️  Utilisation des variables par défaut...');
    
    // Variables par défaut
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'smart_attendance_system_2026_fallback_secret_key';
    process.env.JWT_EXPIRE = process.env.JWT_EXPIRE || '24h';
    process.env.PORT = process.env.PORT || '5000';
    process.env.NODE_ENV = process.env.NODE_ENV || 'development';
    process.env.DB_HOST = process.env.DB_HOST || 'localhost';
    process.env.DB_PORT = process.env.DB_PORT || '5432';
    process.env.DB_NAME = process.env.DB_NAME || 'smart_attendance_db';
    process.env.DB_USER = process.env.DB_USER || 'postgres';
    process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'Haouala18';
} else {
    console.log('✅ Fichier .env chargé avec succès');
    console.log(`🔑 JWT_SECRET: ${process.env.JWT_SECRET ? '✓ Défini' : '✗ Non défini'}`);
    console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 FRONTEND_URL: ${process.env.FRONTEND_URL || 'Non défini'}`);
}

// ==================== SYSTÈME DE LICENCE UNIFIÉ (SANS FICHIERS EXTERNES) ====================
const SECRET_KEY = 'SmartAttendance_Pro_2026_Haouala_Super_Secure_Key_789456123';
const TRIAL_DAYS = 30;

// Fonction simple de hash (identique à activation.iss)
function simpleHash(data) {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5) - hash) + data.charCodeAt(i);
        hash = hash >>> 0;
    }
    return hash.toString(16).toUpperCase().padStart(8, '0');
}

function generateSignature(company, expirationDate) {
    return simpleHash(company + '|' + expirationDate + SECRET_KEY);
}

function validateLicenseKey(licenseKey) {
    const parts = licenseKey.split('|');
    if (parts.length !== 3) {
        return { valid: false, error: 'Format invalide' };
    }

    const [company, expirationDate, providedSignature] = parts;
    const expectedSignature = generateSignature(company, expirationDate);
    const isValidSignature = providedSignature === expectedSignature;
    
    const today = new Date().toISOString().split('T')[0];
    const isExpired = expirationDate < today;

    return {
        valid: isValidSignature && !isExpired,
        signatureValid: isValidSignature,
        expired: isExpired,
        company: company,
        expires: expirationDate,
        daysLeft: !isExpired ? Math.ceil((new Date(expirationDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0
    };
}

function getCurrentDateISO() {
    return new Date().toISOString().split('T')[0];
}

function addDaysToDate(dateISO, days) {
    const date = new Date(dateISO);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

function getLicenseStatus() {
    const licenseFile = path.join(__dirname, 'license.dat');
    const trialFile = path.join(__dirname, '.trial');
    
    // Vérifier la licence
    if (fs.existsSync(licenseFile)) {
        const licenseKey = fs.readFileSync(licenseFile, 'utf8').trim();
        const validation = validateLicenseKey(licenseKey);
        
        if (validation.valid) {
            return {
                valid: true,
                activated: true,
                trial: false,
                company: validation.company,
                expires: validation.expires,
                daysLeft: validation.daysLeft,
                message: `Licence valide pour ${validation.company}`
            };
        }
    }
    
    // Vérifier la période d'essai
    if (!fs.existsSync(trialFile)) {
        const firstRun = getCurrentDateISO();
        fs.writeFileSync(trialFile, firstRun, 'utf8');
        
        return {
            valid: true,
            activated: false,
            trial: true,
            daysLeft: TRIAL_DAYS,
            expires: addDaysToDate(firstRun, TRIAL_DAYS),
            message: `Période d'essai: ${TRIAL_DAYS} jours`
        };
    }
    
    const firstRun = fs.readFileSync(trialFile, 'utf8').trim();
    const currentDate = getCurrentDateISO();
    const daysUsed = Math.ceil((new Date(currentDate) - new Date(firstRun)) / (1000 * 60 * 60 * 24));
    const daysLeft = TRIAL_DAYS - daysUsed;
    
    if (daysLeft > 0) {
        return {
            valid: true,
            activated: false,
            trial: true,
            daysLeft: daysLeft,
            expires: addDaysToDate(firstRun, TRIAL_DAYS),
            message: `Période d'essai: ${daysLeft} jours restants`
        };
    }
    
    return {
        valid: false,
        activated: false,
        trial: false,
        daysLeft: 0,
        message: 'Licence expirée'
    };
}

// Middleware de licence
function licenseMiddleware(req, res, next) {
    const publicRoutes = ['/activate', '/license-status', '/health', '/ping', '/test-cors', '/network-info', '/test-db'];
    
    if (publicRoutes.some(route => req.path === route || req.path.endsWith(route))) {
        return next();
    }
    
    const status = getLicenseStatus();
    
    if (!status.valid) {
        return res.status(403).json({
            success: false,
            error: 'LICENSE_EXPIRED',
            message: 'Licence expirée. Veuillez activer le logiciel.',
            license: status
        });
    }
    
    req.license = status;
    next();
}

// ==================== IMPORTS DE VOS ROUTES EXISTANTES ====================
const exportRoutes = require('./src/routes/exportRoutes');
const payrollRoutes = require('./src/routes/payrollRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const usersRoutes = require('./src/routes/usersRoutes');
const authRoutes = require('./src/routes/authRoutes');
const attendanceRoutes = require('./src/routes/attendanceRoutes');
const employeeRoutes = require('./src/routes/employeeRoutes');
const facialRoutes = require('./src/routes/facialRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');
const shiftRoutes = require('./src/routes/shiftRoutes');
const emailRoutes = require('./src/routes/emailRoutes');

// ==================== IMPORTS DES SERVICES ====================
const facialRecognitionService = require('./services/facialRecognition');
const db = require('./config/db');
const { authenticateToken } = require('./src/middleware/auth');

// ==================== INITIALISATION EXPRESS ====================
const app = express();
const PORT = process.env.PORT || 5000;

// ==================== CRÉATION DES DOSSIERS NÉCESSAIRES ====================
const dirs = ['logs', 'uploads', 'temp_images', 'backups', 'uploads/faces', 'logs/attendance'];
dirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 Dossier créé: ${dir}`);
    }
});

// ==================== CONFIGURATION CORS POUR NETLIFY ====================
const YOUR_NETLIFY_URL = 'https://entreprise-1.smart-haouala.com';

const allowedOrigins = [
    'https://entreprise-1.smart-haouala.com',
    'https://www.entreprise-1.smart-haouala.com',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:3000',
    YOUR_NETLIFY_URL,
    'http://entreprise-1.smart-haouala.com',
    'https://entreprise-1.smart-haouala.ddns.net',
    'https://api.entreprise-1.smart-haouala.ddns.net',
    'http://10.240.129.187:5000',
    'http://192.168.1.101:5000',
    process.env.FRONTEND_URL
].filter(Boolean);

console.log('\n🌐 ORIGINES AUTORISÉES CORS:');
allowedOrigins.forEach(origin => console.log(`   - ${origin}`));

const corsOptions = {
    origin: function (origin, callback) {
        if (process.env.NODE_ENV === 'development' && !origin) {
            return callback(null, true);
        }
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`⚠️ CORS bloqué pour origine: ${origin}`);
            callback(new Error('Origine non autorisée par CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 'Authorization', 'Accept', 'X-Requested-With',
        'Origin', 'Cache-Control', 'If-Modified-Since', 'Pragma',
        'X-Optimized-Mode', 'X-Response-Target'
    ],
    exposedHeaders: ['Content-Length', 'Content-Type', 'Authorization'],
    maxAge: 86400
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ==================== MIDDLEWARE DE LOGGING ====================
app.use((req, res, next) => {
    req.startTime = Date.now();
    req.requestId = Date.now() + Math.random().toString(36).substr(2, 9);
    
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} [${req.requestId}]`);
    next();
});

// ==================== SÉCURITÉ ET PERFORMANCE ====================
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: false
}));

app.use(compression());

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 200,
    message: { success: false, message: 'Trop de requêtes, veuillez réessayer dans une minute' }
});
app.use('/api/', limiter);

app.use(express.json({ limit: process.env.UPLOAD_LIMIT || '50mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.UPLOAD_LIMIT || '50mb' }));

// ==================== ROUTES STATIQUES ====================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/temp_images', express.static(path.join(__dirname, 'temp_images')));

// ==================== ROUTES DE LICENCE (PUBLIQUES) ====================

// Route d'activation
app.post('/api/activate', (req, res) => {
    const { licenseKey } = req.body;
    
    if (!licenseKey) {
        return res.status(400).json({
            success: false,
            error: 'MISSING_LICENSE_KEY',
            message: 'Veuillez fournir une clé de licence'
        });
    }
    
    const validation = validateLicenseKey(licenseKey);
    
    if (validation.valid) {
        const licenseFile = path.join(__dirname, 'license.dat');
        fs.writeFileSync(licenseFile, licenseKey, 'utf8');
        
        const trialFile = path.join(__dirname, '.trial');
        if (fs.existsSync(trialFile)) {
            fs.unlinkSync(trialFile);
        }
        
        return res.json({
            success: true,
            message: 'Licence activée avec succès',
            license: {
                company: validation.company,
                expires: validation.expires,
                daysLeft: validation.daysLeft
            }
        });
    } else {
        return res.status(400).json({
            success: false,
            error: 'INVALID_LICENSE_KEY',
            message: 'Clé de licence invalide',
            details: validation
        });
    }
});

// Route d'état de la licence
app.get('/api/license-status', (req, res) => {
    const status = getLicenseStatus();
    res.json({
        success: true,
        license: status
    });
});

// ==================== MIDDLEWARE DE VÉRIFICATION DE LICENCE ====================
app.use('/api', licenseMiddleware);

// ==================== ROUTES DE TEST ====================

app.get('/api/health', (req, res) => {
    const licenseStatus = getLicenseStatus();
    res.json({
        success: true,
        message: 'Smart Attendance System API is running',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: 'PostgreSQL',
        license: licenseStatus,
        cors: { enabled: true, allowedOrigins: allowedOrigins }
    });
});

app.get('/api/ping', (req, res) => {
    res.json({ success: true, message: 'pong', timestamp: new Date().toISOString() });
});

app.get('/api/test-cors', (req, res) => {
    res.json({
        success: true,
        message: 'Test CORS réussi',
        yourOrigin: req.headers.origin || 'direct',
        allowedOrigins: allowedOrigins
    });
});

app.get('/api/test-db', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW() as time, current_database() as db');
        res.json({ success: true, database: { connected: true, time: result.rows[0].time, name: result.rows[0].db } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/network-info', (req, res) => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const addresses = [];
    
    for (const name in interfaces) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                addresses.push({ interface: name, address: net.address });
            }
        }
    }
    
    res.json({ success: true, hostname: os.hostname(), networkAddresses: addresses, port: PORT });
});

// ==================== MONTER LES ROUTES API ====================
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/facial', facialRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/email-accounts', emailRoutes);

console.log('✅ Routes des shifts chargées');
console.log('✅ Routes Export chargées');
console.log('✅ Routes Email Accounts chargées');

// ==================== ROUTE 404 ====================
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route API non trouvée',
        requestedUrl: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});

// ==================== GESTIONNAIRE D'ERREURS ====================
app.use((err, req, res, next) => {
    console.error('❌ Erreur globale:', err.message);
    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Erreur interne du serveur' : err.message,
        timestamp: new Date().toISOString()
    });
});

// ==================== DÉMARRAGE DU SERVEUR ====================
async function startServer() {
    try {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 DÉMARRAGE DU SERVEUR SMART ATTENDANCE');
        console.log('='.repeat(60));
        
        // Tester la base de données
        try {
            const dbResult = await db.query('SELECT NOW() as current_time');
            console.log(`✅ Base de données connectée: ${dbResult.rows[0].current_time}`);
        } catch (dbError) {
            console.error('❌ Erreur connexion base de données:', dbError.message);
        }
        
        // Obtenir l'IP locale
        const os = require('os');
        const interfaces = os.networkInterfaces();
        let localIP = 'localhost';
        
        for (const name in interfaces) {
            for (const net of interfaces[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    localIP = net.address;
                    break;
                }
            }
        }
        
        const http = require('http');
        const server = http.createServer(app);
        
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`\n📡 Serveur démarré sur:`);
            console.log(`   ➜ Local:   http://localhost:${PORT}`);
            console.log(`   ➜ Réseau:  http://${localIP}:${PORT}`);
            
            console.log(`\n🌍 Frontend Netlify: ${YOUR_NETLIFY_URL}`);
            console.log(`🔧 Environnement: ${process.env.NODE_ENV || 'development'}`);
            
            // Afficher le statut de la licence
            const licenseStatus = getLicenseStatus();
            console.log('\n🔐 STATUT DE LA LICENCE:');
            if (licenseStatus.valid && licenseStatus.activated) {
                console.log(`   ✅ Licence activée - ${licenseStatus.company}`);
                console.log(`   📅 Expire le: ${licenseStatus.expires}`);
                console.log(`   ⏱️  Jours restants: ${licenseStatus.daysLeft}`);
            } else if (licenseStatus.valid && licenseStatus.trial) {
                console.log(`   ⏳ Période d'essai: ${licenseStatus.daysLeft} jours restants`);
            } else {
                console.log(`   ❌ ${licenseStatus.message}`);
                console.log(`   🔑 Pour activer: POST /api/activate avec votre clé`);
            }
            
            console.log('\n📋 ROUTES API DISPONIBLES:');
            console.log(`   🔐 /api/auth/*           → Authentification`);
            console.log(`   📅 /api/attendance/*     → Gestion des présences`);
            console.log(`   👥 /api/employees/*      → Gestion des employés`);
            console.log(`   🔄 /api/shifts/*         → Gestion des shifts`);
            console.log(`   📊 /api/exports/*        → Export de données`);
            console.log(`   💰 /api/payroll/*        → Paie`);
            console.log(`   🔑 /api/activate         → Activation de licence`);
            console.log(`   🔍 /api/license-status   → Statut de la licence`);
            
            console.log('\n' + '='.repeat(60) + '\n');
        });
        
    } catch (error) {
        console.error('❌ Impossible de démarrer le serveur:', error);
        process.exit(1);
    }
}

// ==================== GESTION DES ARRÊTS ====================
process.on('SIGINT', () => {
    console.log('\n🔻 Arrêt du serveur (SIGINT)...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🔻 Arrêt du serveur (SIGTERM)...');
    process.exit(0);
});

// ==================== DÉMARRAGE ====================
startServer();