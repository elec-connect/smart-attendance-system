// backend/server.js - VERSION COMPLÈTE PROPRE (SANS DOUBLONS)
const path = require('path');
const exportRoutes = require('./src/routes/exportRoutes');
const payrollRoutes = require('./src/routes/payrollRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const usersRoutes = require('./src/routes/usersRoutes');

// ==================== CHARGEMENT .env EN PREMIER ====================
const envPath = path.join(__dirname, '.env');
console.log(`🔧 Chargement .env depuis: ${envPath}`);

const dotenvResult = require('dotenv').config({ path: envPath });

if (dotenvResult.error) {
    console.error('❌ Erreur chargement .env:', dotenvResult.error);
    console.log('⚠️  Définition des variables par défaut...');
    
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'smart_attendance_system_2026_fallback_secret_key_default';
    process.env.JWT_EXPIRE = process.env.JWT_EXPIRE || '24h';
    process.env.PORT = process.env.PORT || '5000';
    process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
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
}

// ==================== CONFIGURATION RENDER ====================
const isRender = !!process.env.RENDER || !!process.env.DATABASE_URL;

if (isRender) {
  console.log('🚀 Déploiement sur Render détecté');
  process.env.NODE_ENV = 'production';
  
  if (process.env.DATABASE_URL) {
    console.log('📦 Utilisation de DATABASE_URL fournie par Render');
  }
  
  if (!process.env.FRONTEND_URL) {
    process.env.FRONTEND_URL = 'https://smart-attendance-system.onrender.com';
  }
  
  process.env.SHOW_ERROR_DETAILS = 'false';
}

console.log(`🔧 Environnement: ${process.env.NODE_ENV || 'development'}`);

// ==================== VÉRIFICATION DES CONTRÔLEURS ====================
console.log('\n🔍 VÉRIFICATION DES CONTRÔLEURS ET ROUTES...');
console.log('='.repeat(50));

// Vérifier et logger chaque contrôleur
try {
  const employeeController = require('./src/controllers/employeeController');
  console.log('✅ EmployeeController chargé');
  console.log('   📋 Méthodes disponibles:', Object.keys(employeeController).join(', '));
  
  const criticalMethods = ['getAllEmployees', 'getEmployeeStats', 'getEmployeeById'];
  criticalMethods.forEach(method => {
    if (typeof employeeController[method] === 'function') {
      console.log(`   ✓ ${method}(): Disponible`);
    } else {
      console.log(`   ❌ ${method}(): NON DISPONIBLE - Problème de chargement!`);
    }
  });
} catch (error) {
  console.error('❌ Erreur chargement EmployeeController:', error.message);
}

try {
  const attendanceController = require('./src/controllers/attendanceController');
  console.log('\n✅ AttendanceController chargé');
  console.log('   📋 Méthodes disponibles:', Object.keys(attendanceController).join(', '));
} catch (error) {
  console.error('❌ Erreur chargement AttendanceController:', error.message);
}

try {
  const settingsController = require('./src/controllers/settingsController');
  console.log('\n✅ SettingsController chargé');
  console.log('   📋 Méthodes disponibles:', Object.keys(settingsController).join(', '));
} catch (error) {
  console.error('❌ Erreur chargement SettingsController:', error.message);
}

try {
  const authMiddleware = require('./src/middleware/auth');
  console.log('\n✅ AuthMiddleware chargé');
  console.log('   ✓ authenticateToken:', typeof authMiddleware.authenticateToken);
  console.log('   ✓ authorizeRoles:', typeof authMiddleware.authorizeRoles);
} catch (error) {
  console.error('❌ Erreur chargement AuthMiddleware:', error.message);
}

try {
  const employeeRoutes = require('./src/routes/employeeRoutes');
  const attendanceRoutes = require('./src/routes/attendanceRoutes');
  const authRoutes = require('./src/routes/authRoutes');
  const facialRoutes = require('./src/routes/facialRoutes');
  const settingsRoutes = require('./src/routes/settingsRoutes');
  
  console.log('\n✅ Routes chargées:');
  console.log('   ✓ /api/employees');
  console.log('   ✓ /api/attendance');
  console.log('   ✓ /api/auth');
  console.log('   ✓ /api/facial');
  console.log('   ✓ /api/settings');
} catch (error) {
  console.error('❌ Erreur chargement des routes:', error.message);
}

// Vérifier la base de données
try {
  const db = require('./config/db');
  console.log('\n✅ Configuration DB chargée');
} catch (error) {
  console.error('❌ Erreur chargement configuration DB:', error.message);
}

console.log('='.repeat(50));

// ==================== IMPORTS EXPRESS ====================
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Imports des routes (déjà fait en haut, mais on les récupère pour les utiliser)
const authRoutes = require('./src/routes/authRoutes');
const attendanceRoutes = require('./src/routes/attendanceRoutes');
const employeeRoutes = require('./src/routes/employeeRoutes');
const facialRoutes = require('./src/routes/facialRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');

// Imports des services
const facialRecognitionService = require('./services/facialRecognition');
const db = require('./config/db');

// Importer le middleware d'authentification
const { authenticateToken } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== MIDDLEWARE ====================

// Configuration CORS COMPLÈTE et CORRECTE
const corsOptions = {
  origin: function (origin, callback) {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev') {
      return callback(null, true);
    }
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174', 
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL,
      'https://smart-attendance-system-8hcr.onrender.com'
    ].filter(Boolean);
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ Origine bloquée par CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: [
    'Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Origin',
    'Cache-Control', 'If-Modified-Since', 'Pragma', 'X-Optimized-Mode',
    'X-Response-Target', 'Access-Control-Allow-Headers', 'X-Ping-Only'
  ],
  exposedHeaders: ['Content-Length', 'Content-Type', 'Authorization', 'X-Powered-By'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  optionsSuccessStatus: 200,
  maxAge: 86400,
  preflightContinue: false
};

// Appliquer CORS avant tous les autres middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ==================== MIDDLEWARE DE PARSING ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==================== ROUTE DE DIAGNOSTIC ULTIME ====================
app.post('/api/auth/login-debug', (req, res) => {
  console.log('\n🔍 ====== ROUTE DEBUG LOGIN ======');
  console.log('1. Headers reçus:', req.headers);
  console.log('2. Body reçu:', req.body);
  console.log('3. Type de req.body:', typeof req.body);
  console.log('4. Clés de req.body:', req.body ? Object.keys(req.body) : 'aucune');
  
  if (req.body && req.body.email && req.body.password) {
    console.log('✅ Données valides reçues');
    return res.json({
      success: true,
      message: 'Route de debug fonctionne',
      received: {
        email: req.body.email,
        password: req.body.password ? '***' : 'non fourni'
      },
      timestamp: new Date().toISOString()
    });
  } else {
    console.log('❌ Données invalides ou manquantes');
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      received: req.body,
      expected: { email: 'string', password: 'string' }
    });
  }
});

// ==================== MIDDLEWARE DE DEBUG ====================
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  
  console.log('\n' + '='.repeat(80));
  console.log(`🔍 [${timestamp}] REQUÊTE DÉTECTÉE`);
  console.log('='.repeat(80));
  console.log(`📌 Méthode: ${req.method}`);
  console.log(`📌 URL complète: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
  console.log(`📌 Chemin: ${req.path}`);
  console.log(`📌 IP: ${req.ip || req.connection.remoteAddress}`);
  
  console.log('\n📋 HEADERS:');
  console.log(`   User-Agent: ${req.headers['user-agent'] || 'non spécifié'}`);
  console.log(`   Origin: ${req.headers.origin || '❌ AUCUN'}`);
  console.log(`   Referer: ${req.headers.referer || '❌ AUCUN'}`);
  console.log(`   Accept: ${req.headers.accept || 'non spécifié'}`);
  console.log(`   Content-Type: ${req.headers['content-type'] || 'non spécifié'}`);
  console.log(`   Authorization: ${req.headers.authorization ? '✅ Présent' : '❌ Absent'}`);
  
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`\n📦 BODY REÇU (${JSON.stringify(req.body).length} caractères):`);
    console.log(JSON.stringify(req.body, null, 2));
  }
  
  if (req.path.includes('/auth/login')) {
    console.log('\n⚠️ ⚠️ ⚠️ TENTATIVE DE LOGIN DÉTECTÉE ⚠️ ⚠️ ⚠️');
    console.log('🔐 Cette requête est TRÈS IMPORTANTE !');
  }
  
  console.log('='.repeat(80) + '\n');
  req.requestTimestamp = timestamp;
  next();
});

// Sécurité
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Trop de requêtes depuis cette IP, veuillez réessayer dans une minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});
app.use('/api/', limiter);

// Logging middleware amélioré
app.use((req, res, next) => {
  req.startTime = Date.now();
  req.requestId = Date.now() + Math.random().toString(36).substr(2, 9);
  
  const logInfo = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    requestId: req.requestId,
    origin: req.headers.origin || 'no-origin',
    userAgent: req.headers['user-agent']?.substring(0, 50) || 'no-agent'
  };
  
  console.log(`[${logInfo.timestamp}] ${logInfo.method} ${logInfo.url} [${logInfo.requestId}]`);
  console.log(`   Origin: ${logInfo.origin}, Agent: ${logInfo.userAgent}`);
  
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - req.startTime;
    const status = res.statusCode;
    
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${status} - ${duration}ms [${req.requestId}]`);
    
    const enhancedData = {
      ...data,
      performance: {
        requestId: req.requestId,
        processingTime: duration,
        timestamp: new Date().toISOString(),
        cors: 'enabled'
      }
    };
    
    return originalJson.call(this, enhancedData);
  };
  
  next();
});

// ==================== ROUTES STATIQUES ====================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/temp_images', express.static(path.join(__dirname, 'temp_images')));

// ==================== ROUTES DE BASE ====================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Serveur Smart Attendance System opérationnel',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: 'PostgreSQL',
    cors: { enabled: true, origins: 'all in dev, restricted in prod' },
    dotenvLoaded: !dotenvResult.error,
    jwtSecretDefined: !!process.env.JWT_SECRET
  });
});

app.get('/api/ping', (req, res) => {
  res.json({ 
    success: true, 
    message: 'pong', 
    timestamp: new Date().toISOString(),
    database: 'PostgreSQL',
    cors: 'enabled'
  });
});

// ==================== MONTER LES ROUTES API ====================
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/facial', facialRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/payroll', payrollRoutes);

// ==================== ROUTES UTILITAIRES ====================
app.get('/api/debug/env', (req, res) => {
  res.json({
    success: true,
    dotenv: {
      loaded: !dotenvResult.error,
      error: dotenvResult.error ? dotenvResult.error.message : null,
      path: envPath
    },
    env: {
      JWT_SECRET: process.env.JWT_SECRET ? '✓ Défini' : '✗ Non défini',
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: process.env.PORT || '5000',
      DB_HOST: process.env.DB_HOST || 'localhost',
      DB_NAME: process.env.DB_NAME || 'smart_attendance_db',
      FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173'
    },
    timestamp: new Date().toISOString(),
    database: 'PostgreSQL',
    cors: 'enabled'
  });
});

app.get('/api/debug/db', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW() as current_time, version() as version');
    res.json({
      success: true,
      database: {
        connected: true,
        time: result.rows[0].current_time,
        version: result.rows[0].version,
        employeesCount: (await db.query('SELECT COUNT(*) FROM employees')).rows[0].count,
        attendanceCount: (await db.query('SELECT COUNT(*) FROM attendance')).rows[0].count,
        type: 'PostgreSQL'
      },
      timestamp: new Date().toISOString(),
      cors: 'enabled'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur base de données',
      error: error.message,
      database: 'PostgreSQL',
      cors: 'enabled'
    });
  }
});

app.get('/api/debug/controllers', (req, res) => {
  const controllers = {};
  
  try {
    const employeeController = require('./src/controllers/employeeController');
    controllers.employeeController = {
      loaded: true,
      type: typeof employeeController,
      methods: Object.keys(employeeController),
      criticalMethods: {
        getAllEmployees: typeof employeeController.getAllEmployees === 'function',
        getEmployeeStats: typeof employeeController.getEmployeeStats === 'function',
        getEmployeeById: typeof employeeController.getEmployeeById === 'function'
      }
    };
  } catch (error) {
    controllers.employeeController = { loaded: false, error: error.message };
  }
  
  try {
    const attendanceController = require('./src/controllers/attendanceController');
    controllers.attendanceController = {
      loaded: true,
      type: typeof attendanceController,
      methods: Object.keys(attendanceController)
    };
  } catch (error) {
    controllers.attendanceController = { loaded: false, error: error.message };
  }
  
  res.json({
    success: true,
    message: 'État des contrôleurs',
    data: controllers,
    timestamp: new Date().toISOString(),
    database: 'PostgreSQL',
    cors: 'enabled'
  });
});

app.get('/api/debug/cors', (req, res) => {
  res.json({
    success: true,
    message: 'Test CORS réussi',
    corsInfo: {
      origin: req.headers.origin || 'no-origin',
      allowed: true,
      headers: req.headers,
      method: req.method
    },
    timestamp: new Date().toISOString(),
    database: 'PostgreSQL'
  });
});

app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      const prefix = middleware.regexp.source
        .replace('\\/?(?=\\/|$)', '')
        .replace(/\\\//g, '/')
        .replace(/\^/g, '')
        .replace(/\?/g, '');
      
      middleware.handle.stack.forEach(handler => {
        if (handler.route) {
          routes.push({
            path: prefix + handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  
  res.json({
    success: true,
    totalRoutes: routes.length,
    routes: routes.sort((a, b) => a.path.localeCompare(b.path))
  });
});

// ==================== ROUTES DE NOTIFICATIONS ====================
app.get('/api/notifications', authenticateToken, (req, res) => {
  try {
    console.log(`📱 Notifications demandées par: ${req.user.email} (${req.user.role})`);
    
    const notifications = [
      { id: 1, title: 'Smart Attendance', message: 'Bienvenue sur le tableau de bord administrateur', type: 'success', read: false, createdAt: new Date().toISOString(), icon: 'dashboard', priority: 'high' },
      { id: 2, title: 'Statistiques', message: '5 employés actifs dans le système', type: 'info', read: true, createdAt: new Date(Date.now() - 3600000).toISOString(), icon: 'users', priority: 'medium' },
      { id: 3, title: 'Pointage facial', message: 'La reconnaissance faciale est activée', type: 'warning', read: false, createdAt: new Date(Date.now() - 7200000).toISOString(), icon: 'camera', priority: 'medium' },
      { id: 4, title: 'Base de données', message: 'Connexion PostgreSQL établie', type: 'success', read: true, createdAt: new Date(Date.now() - 10800000).toISOString(), icon: 'database', priority: 'low' },
      { id: 5, title: 'Maintenance', message: 'Le système est à jour', type: 'info', read: false, createdAt: new Date(Date.now() - 14400000).toISOString(), icon: 'settings', priority: 'low' }
    ];
    
    let filteredNotifications = [...notifications];
    
    if (req.user.role === 'employee') {
      filteredNotifications = notifications.filter(n => n.priority !== 'high' && !n.title.includes('Administrateur'));
    } else if (req.user.role === 'manager') {
      filteredNotifications = notifications.filter(n => n.id !== 4);
    }
    
    res.json({
      success: true,
      data: filteredNotifications,
      count: filteredNotifications.length,
      unreadCount: filteredNotifications.filter(n => !n.read).length,
      timestamp: new Date().toISOString(),
      user: { id: req.user.id, email: req.user.email, role: req.user.role, department: req.user.department }
    });
  } catch (error) {
    console.error('❌ Erreur notifications:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
  const { id } = req.params;
  try {
    console.log(`📝 Notification marquée comme lue: ${id} par ${req.user.email}`);
    res.json({ success: true, message: 'Notification marquée comme lue', notificationId: parseInt(id), timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('❌ Erreur marquer comme lu:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

app.put('/api/notifications/read-all', authenticateToken, (req, res) => {
  try {
    console.log(`📝 Toutes les notifications marquées comme lues par ${req.user.email}`);
    res.json({ success: true, message: 'Toutes les notifications marquées comme lues', timestamp: new Date().toISOString(), user: { id: req.user.id, email: req.user.email } });
  } catch (error) {
    console.error('❌ Erreur tout marquer comme lu:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

app.get('/api/notifications/unread-count', authenticateToken, (req, res) => {
  try {
    console.log(`🔢 Demande compte notifications non lues: ${req.user.email}`);
    res.json({ success: true, count: 2, timestamp: new Date().toISOString(), user: { id: req.user.id, email: req.user.email } });
  } catch (error) {
    console.error('❌ Erreur comptage non lues:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== GESTION DES ERREURS ====================
app.use('/api/*', (req, res) => {
  console.log(`❌ Route API non trouvée: ${req.originalUrl}`);
  
  const availableRoutes = [
    '/api/health', '/api/ping', '/api/debug/controllers', '/api/debug/env',
    '/api/debug/db', '/api/debug/cors', '/api/debug/routes', '/api/notifications',
    '/api/notifications/:id/read', '/api/notifications/read-all',
    '/api/notifications/unread-count', '/api/auth/login', '/api/auth/verify',
    '/api/auth/login-debug', '/api/attendance', '/api/employees',
    '/api/facial/recognize', '/api/settings', '/api/payroll',
    '/api/exports', '/api/export', '/api/users'
  ];
  
  res.status(404).json({
    success: false,
    message: 'Route API non trouvée',
    requestedUrl: req.originalUrl,
    availableRoutes,
    timestamp: new Date().toISOString(),
    database: 'PostgreSQL',
    cors: 'enabled'
  });
});

app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    console.warn(`❌ CORS Error: ${req.headers.origin} blocked`);
    return res.status(403).json({
      success: false,
      message: 'Origine non autorisée',
      origin: req.headers.origin,
      allowedOrigins: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', process.env.FRONTEND_URL],
      timestamp: new Date().toISOString()
    });
  }
  next(err);
});

app.use((err, req, res, next) => {
  console.error('❌ Erreur globale:', err.message);
  console.error('📌 Stack trace:', err.stack);
  
  const errorResponse = {
    success: false,
    message: err.message || 'Erreur interne du serveur',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    database: 'PostgreSQL',
    cors: 'enabled',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  };
  
  res.status(err.status || 500).json(errorResponse);
});

// ==================== DÉMARRAGE DU SERVEUR ====================
async function startServer() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 DÉMARRAGE DU SERVEUR SMART ATTENDANCE (PostgreSQL)');
    console.log('='.repeat(60));
    
    try {
      const dbResult = await db.query('SELECT NOW() as current_time');
      console.log(`✅ Base de données connectée: ${dbResult.rows[0].current_time}`);
      console.log(`🗄️  Type: PostgreSQL`);
    } catch (dbError) {
      console.error('❌ Erreur connexion base de données:', dbError.message);
    }
    
    // MODIFICATION ICI - Écoute sur 0.0.0.0 au lieu de l'interface par défaut
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`📡 Serveur démarré sur: http://localhost:${PORT} (et toutes les interfaces)`);
      console.log(`🌍 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      console.log(`🔧 Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️  Base de données: PostgreSQL`);
      console.log(`🔑 JWT_SECRET: ${process.env.JWT_SECRET ? '✓ Défini' : '✗ Utilisation fallback'}`);
      console.log(`🌐 CORS: ✅ Activé`);
      console.log('');
      console.log('📋 ROUTES DISPONIBLES:');
      console.log('   GET  /api/health');
      console.log('   GET  /api/debug/controllers');
      console.log('   GET  /api/debug/env');
      console.log('   GET  /api/debug/db');
      console.log('   GET  /api/debug/cors');
      console.log('   GET  /api/debug/routes');
      console.log('   GET  /api/notifications');
      console.log('   PUT  /api/notifications/:id/read');
      console.log('   PUT  /api/notifications/read-all');
      console.log('   GET  /api/notifications/unread-count');
      console.log('   POST /api/auth/login');
      console.log('   POST /api/auth/login-debug');
      console.log('   GET  /api/auth/verify');
      console.log('   GET  /api/attendance');
      console.log('   GET  /api/employees');
      console.log('   POST /api/facial/recognize');
      console.log('   GET  /api/settings');
      console.log('   GET  /api/payroll');
      console.log('   GET  /api/exports');
      console.log('   GET  /api/users');
      console.log('='.repeat(60));
    });
    
  } catch (error) {
    console.error('❌ Impossible de démarrer le serveur:', error);
    process.exit(1);
  }
}
process.on('SIGINT', () => {
  console.log('\n🔻 Arrêt du serveur...');
  process.exit(0);
});

startServer();