const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const authMiddleware = {
  // ============================================
  // VÉRIFICATION DU TOKEN JWT
  // ============================================
  authenticateToken: (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      logger.warn('Tentative d\'accès sans token', { 
        ip: req.ip, 
        method: req.method, 
        path: req.path 
      });
      return res.status(401).json({ 
        success: false, 
        message: 'Token d\'authentification requis' 
      });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          logger.warn('Token expiré', { user: user?.email });
          return res.status(401).json({ 
            success: false, 
            message: 'Session expirée, veuillez vous reconnecter',
            expired: true 
          });
        }
        
        logger.error('Token invalide', { error: err.message });
        return res.status(403).json({ 
          success: false, 
          message: 'Token invalide' 
        });
      }
      
      // Vérifier la structure du token
      if (!user || !user.id || !user.email) {
        logger.error('Token structure invalide', { tokenPayload: user });
        return res.status(403).json({ 
          success: false, 
          message: 'Token mal formé' 
        });
      }
      
      // Ajouter l'utilisateur à la requête
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role || 'employee',
        department: user.department,
        name: user.name || user.email
      };
      
      logger.info('Utilisateur authentifié', { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        path: req.path 
      });
      next();
    });
  },

  // ============================================
  // VÉRIFICATION DES RÔLES (PRINCIPALE)
  // ============================================
  authorizeRoles: (...roles) => {
    return (req, res, next) => {
      if (!req.user) {
        logger.warn('Tentative d\'accès sans authentification', { path: req.path });
        return res.status(401).json({ 
          success: false, 
          message: 'Non authentifié' 
        });
      }

      // Normaliser les rôles autorisés
      let allowedRoles = [];
      
      // Cas 1: Un tableau de rôles a été passé
      if (roles.length === 1 && Array.isArray(roles[0])) {
        allowedRoles = roles[0];
      } 
      // Cas 2: Plusieurs arguments individuels
      else if (roles.length > 0) {
        allowedRoles = roles;
      }
      // Cas 3: Aucun rôle spécifié -> tout le monde peut accéder
      else {
        return next();
      }

      // Normaliser tous les rôles (minuscules, sans espaces)
      const normalizedAllowedRoles = allowedRoles
        .filter(role => role != null)
        .map(role => String(role).trim().toLowerCase());
      
      const userRole = String(req.user.role || '').trim().toLowerCase();
      
      // Vérifier si l'utilisateur a l'un des rôles autorisés
      const hasAccess = normalizedAllowedRoles.includes(userRole);
      
      if (!hasAccess) {
        logger.warn('Accès refusé - Rôle insuffisant', { 
          userId: req.user.id, 
          userRole: req.user.role, 
          requiredRoles: normalizedAllowedRoles,
          path: req.path 
        });
        
        // Message d'erreur sécurisé
        let errorMessage = 'Accès non autorisé';
        if (process.env.NODE_ENV !== 'production') {
          errorMessage = `Accès non autorisé. Rôle requis: ${normalizedAllowedRoles.join(' ou ')}. Votre rôle: ${req.user.role || 'non défini'}`;
        }
        
        return res.status(403).json({ 
          success: false, 
          message: errorMessage,
          ...(process.env.NODE_ENV !== 'production' && {
            debug: {
              requiredRoles: normalizedAllowedRoles,
              userRole: req.user.role
            }
          })
        });
      }
      
      next();
    };
  },

  // ============================================
  // ALIAS POUR COMPATIBILITÉ (checkRole)
  // ============================================
  checkRole: (...roles) => {
    console.log('⚠️  DEPRECATED: Utilisez authorizeRoles au lieu de checkRole');
    return authMiddleware.authorizeRoles(...roles);
  },

  // ============================================
  // VÉRIFICATION DE RÔLE SPÉCIFIQUE
  // ============================================
  requireRole: (requiredRole) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Non authentifié' 
        });
      }
      
      if (!requiredRole) {
        logger.error('Middleware requireRole appelé sans rôle spécifié');
        return res.status(500).json({ 
          success: false, 
          message: 'Erreur de configuration serveur' 
        });
      }
      
      const userRole = String(req.user.role || '').toLowerCase();
      const normalizedRequiredRole = String(requiredRole).toLowerCase();
      
      if (userRole !== normalizedRequiredRole) {
        logger.warn('Accès refusé - Rôle spécifique requis', { 
          userId: req.user.id, 
          userRole: req.user.role, 
          requiredRole: requiredRole 
        });
        return res.status(403).json({ 
          success: false, 
          message: 'Permissions insuffisantes pour cette action' 
        });
      }
      
      next();
    };
  },

  // ============================================
  // VÉRIFICATION ADMIN
  // ============================================
  isAdmin: (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Non authentifié' 
      });
    }
    
    const userRole = String(req.user.role || '').toLowerCase();
    const isAdmin = ['admin', 'superadmin', 'administrator'].includes(userRole);
    
    if (!isAdmin) {
      logger.warn('Tentative d\'accès admin sans droits', { 
        userId: req.user.id, 
        userRole: req.user.role 
      });
      return res.status(403).json({ 
        success: false, 
        message: 'Accès réservé aux administrateurs' 
      });
    }
    
    next();
  },

  // ============================================
  // VÉRIFICATION MANAGER OU ADMIN
  // ============================================
  isManagerOrAdmin: (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Non authentifié' 
      });
    }
    
    const userRole = String(req.user.role || '').toLowerCase();
    const isAuthorized = ['admin', 'superadmin', 'administrator', 'manager', 'supervisor'].includes(userRole);
    
    if (!isAuthorized) {
      logger.warn('Tentative d\'accès manager sans droits', { 
        userId: req.user.id, 
        userRole: req.user.role 
      });
      return res.status(403).json({ 
        success: false, 
        message: 'Accès réservé aux managers et administrateurs' 
      });
    }
    
    next();
  },

  // ============================================
  // VÉRIFICATION PROPRIÉTÉ DES DONNÉES
  // ============================================
  isOwnerOrAdmin: (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Non authentifié' 
      });
    }
    
    const userRole = String(req.user.role || '').toLowerCase();
    const isAdmin = ['admin', 'superadmin', 'administrator'].includes(userRole);
    
    // Si c'est un admin, il peut tout voir
    if (isAdmin) {
      return next();
    }
    
    // Vérifier si l'utilisateur essaie d'accéder à ses propres données
    const requestedId = req.params.id || req.params.userId || req.body.userId;
    const isOwnData = requestedId && requestedId.toString() === req.user.id.toString();
    
    if (!isOwnData) {
      logger.warn('Tentative d\'accès aux données d\'un autre utilisateur', { 
        userId: req.user.id, 
        requestedId: requestedId 
      });
      return res.status(403).json({ 
        success: false, 
        message: 'Vous ne pouvez accéder qu\'à vos propres données' 
      });
    }
    
    next();
  },

  // ============================================
  // RATE LIMITING
  // ============================================
  rateLimiter: (options = {}) => {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      maxRequests = 100 // limite par IP
    } = options;
    
    const requests = new Map();
    
    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      
      if (!requests.has(ip)) {
        requests.set(ip, []);
      }
      
      const timestamps = requests.get(ip);
      
      // Supprimer les timestamps expirés
      const cutoff = now - windowMs;
      while (timestamps.length > 0 && timestamps[0] < cutoff) {
        timestamps.shift();
      }
      
      // Vérifier si la limite est dépassée
      if (timestamps.length >= maxRequests) {
        logger.warn('Rate limit dépassé', { 
          ip, 
          requests: timestamps.length,
          path: req.path 
        });
        
        return res.status(429).json({ 
          success: false, 
          message: 'Trop de requêtes, veuillez réessayer plus tard',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
      
      // Ajouter le timestamp actuel
      timestamps.push(now);
      requests.set(ip, timestamps);
      
      // Nettoyer périodiquement
      if (Math.random() < 0.01) { // 1% de chance à chaque requête
        const cutoffTime = now - (windowMs * 2);
        for (const [key, value] of requests.entries()) {
          if (value.length === 0 || value[value.length - 1] < cutoffTime) {
            requests.delete(key);
          }
        }
      }
      
      next();
    };
  },

  // ============================================
  // LOGGER DES REQUÊTES
  // ============================================
  requestLogger: (req, res, next) => {
    const start = Date.now();
    const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    // Stocker l'ID de requête pour le logging
    req.requestId = requestId;
    
    // Log de la requête entrante
    logger.info(`→ ${req.method} ${req.originalUrl}`, {
      requestId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id,
      contentType: req.headers['content-type']
    });
    
    // Hook pour logger la réponse
    const originalSend = res.send;
    res.send = function(data) {
      const duration = Date.now() - start;
      
      // Log de la réponse
      logger.info(`← ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
        requestId,
        statusCode: res.statusCode,
        duration,
        userId: req.user?.id
      });
      
      return originalSend.call(this, data);
    };
    
    next();
  },

  // ============================================
  // VALIDATION DES DONNÉES
  // ============================================
  validateRequest: (schema) => {
    return (req, res, next) => {
      try {
        const validationResult = schema.validate(req.body, { 
          abortEarly: false,
          stripUnknown: true 
        });
        
        if (validationResult.error) {
          const errors = validationResult.error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }));
          
          logger.warn('Validation échouée', { 
            errors, 
            path: req.path,
            userId: req.user?.id 
          });
          
          return res.status(400).json({ 
            success: false, 
            message: 'Données invalides',
            errors 
          });
        }
        
        // Remplacer req.body par les données validées et nettoyées
        req.body = validationResult.value;
        next();
      } catch (error) {
        logger.error('Erreur validation', { error: error.message });
        return res.status(500).json({ 
          success: false, 
          message: 'Erreur de validation serveur' 
        });
      }
    };
  },

  // ============================================
  // VÉRIFICATION SIMPLIFIÉE (DEBUG)
  // ============================================
  simpleCheckRole: (allowedRoles) => {
    console.log('🔐 [AUTH] Création simpleCheckRole');
    console.log('   Rôles reçus:', allowedRoles);
    
    return (req, res, next) => {
      console.log('🔐 [AUTH] Exécution simpleCheckRole');
      
      if (!req.user) {
        console.error('❌ [AUTH] Pas d\'utilisateur dans req.user');
        return res.status(401).json({ 
          success: false, 
          message: 'Non authentifié' 
        });
      }
      
      // S'assurer que allowedRoles est un tableau
      const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      const userRole = req.user.role ? req.user.role.toLowerCase() : '';
      
      console.log('   User role:', userRole);
      console.log('   Allowed roles:', rolesArray.map(r => r.toLowerCase()));
      
      const hasAccess = rolesArray.some(role => 
        role.toLowerCase() === userRole
      );
      
      if (!hasAccess) {
        console.log(`❌ Accès refusé: ${userRole} n'est pas dans`, rolesArray);
        return res.status(403).json({ 
          success: false, 
          message: 'Accès non autorisé' 
        });
      }
      
      console.log('✅ Accès autorisé');
      next();
    };
  }
};

module.exports = authMiddleware;