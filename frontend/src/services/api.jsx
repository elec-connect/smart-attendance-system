import axios from 'axios';

// Configuration de base
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
console.log('🚀 API Base URL:', API_BASE_URL);

// Cache pour éviter les requêtes répétitives
const requestCache = new Map();
const CACHE_DURATION = 30000; // 30 secondes
let lastRequestTime = 0;
const MIN_REQUEST_DELAY = 1000; // 1000ms minimum entre requêtes

// Variables pour le refresh token
let isRefreshing = false;
let failedQueue = [];

// Variables pour la gestion de reconnexion
let isCheckingConnection = false;
let backendStatus = true;
const RECONNECTION_ATTEMPTS = 3;
const RECONNECTION_DELAY = 2000;

// Cooldown pour les vérifications backend
let lastBackendCheck = 0;
const BACKEND_CHECK_COOLDOWN = 10000;

// ==================== FONCTIONS UTILITAIRES ====================  

// Fonction utilitaire pour préparer les données pour l'API
const prepareApiData = (data) => {
  if (!data) return null;
  
  if (typeof data === 'object') {
    const prepared = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Traiter les types spéciaux
      if (value instanceof File || value instanceof Blob) {
        // Pour les fichiers, ne pas modifier
        prepared[key] = value;
      } else if (value === undefined) {
        // Ignorer les valeurs undefined
        continue;
      } else if (value === null) {
        prepared[key] = null;
      } else if (typeof value === 'number') {
        // Convertir les nombres en chaînes pour éviter les erreurs de parsing
        prepared[key] = String(value);
      } else if (typeof value === 'boolean') {
        prepared[key] = value;
      } else if (Array.isArray(value)) {
        prepared[key] = value.map(item => prepareApiData(item));
      } else if (typeof value === 'object') {
        prepared[key] = prepareApiData(value);
      } else {
        prepared[key] = value;
      }
    }
    
    return prepared;
  }
  
  // Pour les autres types
  return String(data);
};

// Fonction pour obtenir les headers d'authentification
const getAuthHeaders = () => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// Vérifier l'état du backend avec cooldown
const checkBackendStatus = async (force = false) => {
  const now = Date.now();
  
  if (!force && now - lastBackendCheck < BACKEND_CHECK_COOLDOWN) {
    return backendStatus;
  }
  
  if (isCheckingConnection) {
    return backendStatus;
  }

  isCheckingConnection = true;
  lastBackendCheck = now;
  
  try {
    const response = await axios.get(`${API_BASE_URL}/ping`, {
      timeout: 5000, // Augmenter le timeout
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    const isConnected = response.status === 200;
    backendStatus = isConnected;
    
    // SEULEMENT afficher si changement
    if (isConnected && !backendStatus) {
      console.log(`🌐 Backend reconnecté: ✅ Connecté`);
      requestCache.clear();
    }
    
    return isConnected;
    
  } catch (error) {
    // SEULEMENT afficher si vraiment déconnecté (pas juste timeout)
    const isRealError = !error.code || 
                       (error.code !== 'ECONNABORTED' && 
                        !error.message.includes('timeout'));
    
    if (isRealError) {
      console.warn(`⚠️ Problème backend détecté: ${error.message}`);
    }
    
    backendStatus = false;
    return false;
    
  } finally {
    isCheckingConnection = false;
  }
};

// Processus de la file d'attente
const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Nettoyer le cache
const cleanCache = () => {
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      requestCache.delete(key);
    }
  }
};

// Gestion des tokens
const getToken = () => localStorage.getItem('token');
const setToken = (token) => localStorage.setItem('token', token);
const removeToken = () => {
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
};

// Rafraîchir le token
const refreshToken = async () => {
  console.log('🔄 Tentative de rafraîchissement du token...');
  
  try {
    const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      throw new Error('Session expirée, veuillez vous reconnecter');
    }
    
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, 
      { refreshToken },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    
    if (response.data.success && response.data.token) {
      console.log('✅ Token rafraîchi avec succès');
      setToken(response.data.token);
      return response.data.token;
    } else {
      throw new Error(response.data.message || 'Erreur lors du rafraîchissement');
    }
  } catch (error) {
    console.error('❌ Erreur rafraîchissement token:', error.message);
    
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('🔐 Session expirée, déconnexion...');
      removeToken();
      
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    throw error;
  }
};

// Formater les données de réponse
const formatResponseData = (response, endpoint) => {
  if (!response) return null;
  
  const responseData = response.data || response;
  
  switch (endpoint) {
    case 'VERIFY':
      return responseData.success !== undefined ? responseData : { success: true, ...responseData };
      
    case 'EMPLOYEE_STATS':
      return responseData.data ? responseData : { success: true, data: responseData };
      
    case 'ATTENDANCE':
    case 'EMPLOYEES':
    case 'REPORTS':
      return Array.isArray(responseData) ? { success: true, data: responseData } : responseData;
      
    default:
      return responseData.success !== undefined ? responseData : { success: true, data: responseData };
  }
};

// Extraire les données d'erreur
const extractErrorData = (error) => {
  if (!error) return { message: 'Erreur inconnue' };
  
  if (error.response) {
    return {
      status: error.response.status,
      message: error.response.data?.message || `Erreur ${error.response.status}`,
      data: error.response.data,
      isNetworkError: false,
      isCorsError: error.response.status === 0 && error.message.includes('Network')
    };
  } else if (error.request) {
    return {
      status: 0,
      message: 'Serveur inaccessible ou erreur CORS',
      isNetworkError: true,
      isCorsError: true
    };
  } else {
    return {
      status: 0,
      message: error.message || 'Erreur de configuration',
      isNetworkError: false,
      isCorsError: error.message.includes('CORS') || error.message.includes('Network')
    };
  }
};

// ==================== FONCTION PRINCIPALE AVEC CACHE INTELLIGENT ====================

const makeRequestWithRetry = async (config, retries = RECONNECTION_ATTEMPTS, delay = RECONNECTION_DELAY) => {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      if (i > 0) {
        console.log(`🔍 Vérification connexion avant tentative ${i + 1}/${retries}...`);
        const isConnected = await checkBackendStatus(true);
        if (!isConnected) {
          console.warn(`⚠️ Backend déconnecté, attente ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      console.log(`🔄 Tentative ${i + 1}/${retries}...`);
      return await axios(config);
      
    } catch (error) {
      lastError = error;
      
      if (i === retries - 1) {
        console.log(`❌ Échec après ${retries} tentatives`);
        break;
      }
      
      const waitTime = delay * (i + 1);
      console.log(`⏳ Attente ${waitTime}ms avant prochaine tentative...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
};

// ==================== FONCTION DE REQUÊTE PRINCIPALE - CORRIGÉE ====================

const makeRequest = async (method, url, data = null, options = {}) => {
  const cacheKey = `${method}:${url}:${JSON.stringify(data)}`;
  const isGetRequest = method === 'GET';
  
  console.log(`📤 REQUÊTE API [${method}] ${url}`);
  if (data) {
    console.log(`📦 Données envoyées:`, data);
  }
  
  cleanCache();
  
  try {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < MIN_REQUEST_DELAY) {
      const waitTime = MIN_REQUEST_DELAY - timeSinceLastRequest;
      console.log(`⏳ Attente de ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    lastRequestTime = Date.now();
    
    // Vérifier la connexion si demandé
    if (options.checkConnection) {
      const isConnected = await checkBackendStatus();
      if (!isConnected && !options.failSilently) {
        throw new Error('Backend déconnecté');
      }
    }
    
    // Obtenir le token
    let token = getToken();
    
    // Configuration de la requête
    const config = {
      method,
      url: `${API_BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      },
      timeout: options.timeout || 15000,
      ...options
    };
    
    // Ajouter les données - CORRECTION CRITIQUE
    if (data && method !== 'GET') {
      // Préparer les données
      const preparedData = prepareApiData(data);
      
      // S'assurer que les données sont bien stringifiées en JSON
      config.data = JSON.stringify(preparedData);
      
      // Vérifier que le JSON est valide
      try {
        JSON.parse(config.data);
      } catch (jsonError) {
        console.error('❌ JSON invalide:', jsonError.message);
        console.error('❌ Données problématiques:', preparedData);
        throw new Error(`Données JSON invalides: ${jsonError.message}`);
      }
      
      console.log(`📤 Corps de la requête (${config.data.length} caractères):`, 
        config.data.length > 100 ? config.data.substring(0, 100) + '...' : config.data);
    }
    
    // Ajouter le token
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // ========== GESTION INTELLIGENTE DU CACHE POUR LES SETTINGS ==========
    const isSettingsRequest = url.includes('/settings');
    const shouldUseCache = isGetRequest && !options.skipCache && !isSettingsRequest;
    
    // Pour les settings, JAMAIS utiliser le cache sans skipCache explicit
    if (shouldUseCache) {
      const cached = requestCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
        console.log(`🔄 Utilisation cache: ${url}`);
        return cached.data;
      }
    }
    // ==============================================
    
    console.log(`🔗 Envoi requête à: ${config.url}`);
    const response = await makeRequestWithRetry(config, options.retries || RECONNECTION_ATTEMPTS);
    
    console.log(`✅ ${response.status} ${method} ${url}`);
    
    // Formater les données
    const endpoint = url.includes('verify') ? 'VERIFY' :
                    url.includes('stats') ? 'EMPLOYEE_STATS' :
                    url.includes('attendance') ? 'ATTENDANCE' :
                    url.includes('employees') ? 'EMPLOYEES' :
                    url.includes('reports') ? 'REPORTS' : 'DEFAULT';
    
    const formattedData = formatResponseData(response, endpoint);
    
    // Mettre en cache (sauf pour les settings sans skipCache)
    if (isGetRequest && !options.skipCache && !isSettingsRequest) {
      requestCache.set(cacheKey, {
        data: formattedData,
        timestamp: Date.now()
      });
    }
    
    return formattedData;
    
  } catch (error) {
    console.error(`❌ ERREUR API: ${method} ${url}`);
    
    const errorData = extractErrorData(error);
    console.error(`📊 Statut: ${errorData.status}, Message: ${errorData.message}`);
    
    // Gestion de l'erreur 401
    if (errorData.status === 401 && !options._retry) {
      console.log('🔐 Token expiré, tentative de rafraîchissement...');
      
      const originalRequest = {
        method,
        url,
        data,
        options: { ...options, _retry: true }
      };
      
      if (isRefreshing) {
        console.log('⏳ Refresh en cours, ajout à la file d\'attente...');
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.options.headers = {
            ...originalRequest.options.headers,
            'Authorization': `Bearer ${token}`
          };
          return makeRequest(originalRequest.method, originalRequest.url, 
                           originalRequest.data, originalRequest.options);
        }).catch(err => {
          throw err;
        });
      }
      
      isRefreshing = true;
      
      try {
        const newToken = await refreshToken();
        processQueue(null, newToken);
        
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`
        };
        options._retry = true;
        
        return makeRequest(method, url, data, options);
        
      } catch (refreshError) {
        console.error('❌ Échec du rafraîchissement du token:', refreshError.message);
        processQueue(refreshError, null);
        removeToken();
        
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        
        throw new Error('Session expirée, veuillez vous reconnecter');
      } finally {
        isRefreshing = false;
      }
    }
    
    // Erreurs CORS
    if (errorData.isCorsError) {
      console.error('🌐 ERREUR CORS DÉTECTÉE!');
    }
    
    // Rate limiting
    if (error.response?.status === 429) {
      console.warn('⚠️ Rate limit (429) - Attente 5 secondes...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      try {
        console.log('🔄 Nouvelle tentative après rate limit...');
        const retryResponse = await makeRequest(method, url, data, {
          ...options,
          skipCache: true,
          timeout: 15000,
          _retry: options._retry || false
        });
        return retryResponse;
      } catch (retryError) {
        throw retryError;
      }
    }
    
    // Mode hors ligne
    if (errorData.isNetworkError && options.failSilently) {
      console.log('🔇 Échec réseau silencieux');
      return {
        success: false,
        offline: true,
        message: 'Connexion au serveur perdue',
        data: []
      };
    }
    
    // Erreur formatée
    const formattedError = new Error(errorData.message);
    formattedError.status = errorData.status;
    formattedError.data = errorData.data;
    formattedError.isCorsError = errorData.isCorsError;
    formattedError.isNetworkError = errorData.isNetworkError;
    throw formattedError;
  }
};

// ==================== API COMPLÈTE ====================

const api = {
  // ==================== AUTHENTIFICATION ====================
  login: (email, password) => 
    makeRequest('POST', '/auth/login', { email, password }),
  
  forgotPassword: (email) => 
    makeRequest('POST', '/auth/forgot-password', { email }),
  
  resetPassword: (token, newPassword) => 
    makeRequest('POST', '/auth/reset-password', { token, password: newPassword }),
  
  verifyResetToken: (token) => 
    makeRequest('GET', `/auth/verify-reset-token/${token}`),
  
  verifyToken: () => 
    makeRequest('GET', '/auth/verify'),
  
  register: (userData) => 
    makeRequest('POST', '/auth/register', userData),
  
  logout: () => {
    removeToken();
    localStorage.removeItem('refreshToken');
    sessionStorage.removeItem('refreshToken');
    requestCache.clear();
    console.log('👋 Déconnexion effectuée');
  },
  
  changePassword: (passwordData) => 
    makeRequest('PUT', '/auth/password', passwordData),
  
  // ==================== EMPLOYÉS ====================
  getAllEmployees: (params = {}, options = {}) => 
    makeRequest('GET', `/employees${Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : ''}`, null, {
      failSilently: true,
      ...options
    }),
  
  getEmployeeStats: (options = {}) => 
    makeRequest('GET', '/employees/stats', null, {
      failSilently: true,
      ...options
    }),
  
  getEmployeeById: (id, options = {}) => 
    makeRequest('GET', `/employees/${id}`, null, {
      failSilently: true,
      ...options
    }),
  
  createEmployee: (employeeData) => 
    makeRequest('POST', '/employees', employeeData),
  
  updateEmployee: (id, employeeData) => 
    makeRequest('PUT', `/employees/${id}`, employeeData),
  
  deleteEmployee: (id) => 
    makeRequest('DELETE', `/employees/${id}`),
  
  searchEmployees: (query, options = {}) => 
    makeRequest('GET', `/employees/search?q=${encodeURIComponent(query)}`, null, {
      failSilently: true,
      ...options
    }),
  
  // ==================== PRÉSENCES ====================
  getAttendance: (params = {}, options = {}) => 
    makeRequest('GET', `/attendance${Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : ''}`, null, {
      failSilently: true,
      ...options
    }),
  
  getTodayAttendance: (options = {}) => 
    makeRequest('GET', '/attendance/today', null, {
      failSilently: true,
      ...options
    }),
  
  getMyAttendance: (options = {}) => 
    makeRequest('GET', '/attendance/my', null, {
      failSilently: true,
      ...options
    }),
  
  getAttendanceByEmployeeId: (employeeId, options = {}) => 
    makeRequest('GET', `/attendance/employee/${employeeId}`, null, {
      failSilently: true,
      ...options
    }),
  
  getAttendanceByDate: (date, options = {}) => 
    makeRequest('GET', `/attendance/date/${date}`, null, {
      failSilently: true,
      ...options
    }),
  
  // NOUVELLE FONCTION : Réinitialiser le pointage du jour
  resetTodayAttendance: (employeeId, options = {}) => 
    makeRequest('DELETE', `/attendance/reset-today/${employeeId}`, null, {
      showSuccess: true,
      ...options
    }),
  
  // ==================== POINTAGE MANUEL ====================
  // Pointage manuel unifié pour check-in et check-out
  manualAttendance: async (action, data) => {
    console.log(`📝 Pointage manuel - ${action}`, data);
    try {
      const endpoint = action === 'checkin' ? '/attendance/manual-checkin' : '/attendance/manual-checkout';
      const response = await axios.post(`${API_BASE_URL}${endpoint}`, data, {
        headers: getAuthHeaders(),
        timeout: 15000
      });
      console.log(`✅ ${action === 'checkin' ? 'Check-in' : 'Check-out'} manuel réussi`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur ${action} manuel:`, error);
      const errorData = extractErrorData(error);
      const formattedError = new Error(errorData.message);
      formattedError.status = errorData.status;
      throw formattedError;
    }
  },

  // Anciennes fonctions de pointage (pour compatibilité)
  manualCheckIn: async (data) => {
    return api.manualAttendance('checkin', data);
  },

  manualCheckOut: async (data) => {
    return api.manualAttendance('checkout', data);
  },

  // Fonctions de pointage standard
  checkIn: (data = {}) => 
    makeRequest('POST', '/attendance/checkin', data),
  
  checkOut: (data = {}) => 
    makeRequest('POST', '/attendance/checkout', data),
  
  updateAttendance: (id, data) => 
    makeRequest('PUT', `/attendance/${id}`, data),
  
  deleteAttendance: (id) => 
    makeRequest('DELETE', `/attendance/${id}`),
  
  getAttendanceStats: (params = {}, options = {}) => 
    makeRequest('GET', `/attendance/stats${Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : ''}`, null, {
      failSilently: true,
      ...options
    }),
  
  // ==================== RECONNAISSANCE FACIALE ====================
  facialRecognition: (photoData) => 
    makeRequest('POST', '/facial/recognize', photoData),
  
  facialRecognitionAndAttend: (photoData) => 
    makeRequest('POST', '/facial/recognize-and-attend', photoData),
  
  registerFace: (employeeId, photos) => 
    makeRequest('POST', `/facial/register/${employeeId}`, { photos }),
  
  checkFacialHealth: (options = {}) => 
    makeRequest('GET', '/facial/health', null, {
      failSilently: true,
      ...options
    }),
  
  getFacialStats: (options = {}) => 
    makeRequest('GET', '/facial/stats', null, {
      failSilently: true,
      ...options
    }),
  
  // ==================== RAPPORTS ====================
  generateReport: (params) => 
    makeRequest('POST', '/reports/generate', params),
  
  getReports: (options = {}) => 
    makeRequest('GET', '/reports', null, {
      failSilently: true,
      ...options
    }),
  
  getReportById: (id, options = {}) => 
    makeRequest('GET', `/reports/${id}`, null, {
      failSilently: true,
      ...options
    }),
  
  deleteReport: (id) => 
    makeRequest('DELETE', `/reports/${id}`),
  
  // ==================== UTILISATEURS ====================
  getMyProfile: (options = {}) => 
    makeRequest('GET', '/users/profile', null, {
      failSilently: true,
      ...options
    }),

  // NOUVELLE FONCTION : Mettre à jour un profil utilisateur par ID
  updateUserProfile: async (userId, userData) => {
    console.log(`📝 Mise à jour profil utilisateur #${userId}`, userData);
    
    // Nettoyer les données
    const cleanData = prepareApiData(userData);
    
    console.log('📦 Données nettoyées:', cleanData);
    
    try {
      const response = await makeRequest('PUT', `/users/${userId}/profile`, cleanData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
        skipCache: true
      });
      
      console.log('✅ Profil utilisateur mis à jour avec succès');
      return response;
    } catch (error) {
      console.error('❌ Erreur mise à jour profil utilisateur:', error);
      throw error;
    }
  },

  // Fonction existante (mise à jour du profil courant)
  updateProfile: async (userData) => {
    console.log('📝 Mise à jour profil - Données:', userData);
    
    // S'assurer que les données sont un objet valide
    if (!userData || typeof userData !== 'object') {
      throw new Error('Données de profil invalides');
    }
    
    // Nettoyer les données
    const cleanData = prepareApiData(userData);
    
    console.log('📦 Données nettoyées:', cleanData);
    
    try {
      // Utiliser une méthode PUT avec un timeout plus long
      const response = await makeRequest('PUT', '/users/profile', cleanData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 secondes pour le profil
        skipCache: true
      });
      
      console.log('✅ Profil mis à jour avec succès');
      return response;
    } catch (error) {
      console.error('❌ Erreur mise à jour profil:', error);
      throw error;
    }
  },

  // Fonction de secours pour updateProfile
  updateProfileFallback: async (userData) => {
    console.log('🔄 Utilisation méthode de secours pour mise à jour profil');
    
    const token = getToken();
    const url = `${API_BASE_URL}/users/profile`;
    
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erreur HTTP:', response.status, errorText);
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Mise à jour réussie (méthode de secours)');
      return data;
      
    } catch (error) {
      console.error('❌ Erreur méthode de secours:', error);
      throw error;
    }
  },
  
  // ==================== PARAMÈTRES - VERSION AMÉLIORÉE ====================
  getSettings: (options = {}) => {
    // Forcer skipCache pour les settings sauf si explicitement demandé autrement
    const finalOptions = {
      skipCache: true,
      failSilently: true,
      ...options
    };
    
    // Ajouter un timestamp pour éviter tout risque de cache
    const timestamp = Date.now();
    const url = `/settings?t=${timestamp}`;
    
    return makeRequest('GET', url, null, finalOptions);
  },
  
  updateSettings: async (settingsData) => {
    // Nettoyer le cache des settings AVANT la mise à jour
    api.clearSettingsCache();
    
    // Mettre à jour les settings
    const response = await makeRequest('PUT', '/settings', settingsData);
    
    // Nettoyer à nouveau après la mise à jour
    api.clearSettingsCache();
    
    return response;
  },
  
  // Nouvelle fonction pour récupérer des settings spécifiques
  getSetting: async (key, defaultValue = null, options = {}) => {
    try {
      const response = await api.getSettings(options);
      if (response.success && response.data && response.data[key] !== undefined) {
        return response.data[key];
      }
      return defaultValue;
    } catch (error) {
      console.warn(`⚠️ Impossible de récupérer le setting "${key}":`, error.message);
      return defaultValue;
    }
  },
  
  // ==================== SYSTÈME ====================
  getSystemHealth: () => 
    makeRequest('GET', '/health'),
  
  // ==================== UTILITAIRES ====================
  clearCache: () => {
    requestCache.clear();
    console.log('🧹 Cache API nettoyé');
  },
  
  clearSettingsCache: () => {
    let count = 0;
    for (const [key] of requestCache.entries()) {
      if (key.includes('/settings')) {
        requestCache.delete(key);
        count++;
      }
    }
    console.log(`🧹 ${count} entrées settings supprimées du cache`);
  },
  
  clearCacheByPattern: (pattern) => {
    let count = 0;
    for (const [key] of requestCache.entries()) {
      if (key.includes(pattern)) {
        requestCache.delete(key);
        count++;
      }
    }
    console.log(`🧹 ${count} entrées supprimées du cache (pattern: "${pattern}")`);
    return count;
  },
  
  // ==================== DEBUGGING ====================
  getCacheStats: () => {
    const stats = {
      total: requestCache.size,
      settings: 0,
      employees: 0,
      attendance: 0,
      others: 0
    };
    
    for (const [key] of requestCache.entries()) {
      if (key.includes('/settings')) {
        stats.settings++;
      } else if (key.includes('/employees')) {
        stats.employees++;
      } else if (key.includes('/attendance')) {
        stats.attendance++;
      } else {
        stats.others++;
      }
    }
    
    console.log('📊 Statistiques du cache:', stats);
    return stats;
  },
  
  getCacheKeys: () => {
    return Array.from(requestCache.keys());
  },
  
  ping: () => 
    makeRequest('GET', '/ping'),
  
  testConnection: async () => {
    try {
      const startTime = Date.now();
      
      const backendAvailable = await checkBackendStatus(true);
      
      if (!backendAvailable) {
        return {
          connected: false,
          backendAvailable: false,
          message: 'Backend inaccessible',
          responseTime: null
        };
      }
      
      const response = await makeRequest('GET', '/ping');
      const responseTime = Date.now() - startTime;
      
      return {
        connected: true,
        backendAvailable: true,
        responseTime,
        message: `Connecté en ${responseTime}ms`,
        data: response
      };
    } catch (error) {
      return {
        connected: false,
        backendAvailable: false,
        message: error.message,
        error,
        responseTime: null
      };
    }
  },

  // ==================== CORRECTION POINTAGE ====================
  getMonthlyAttendance: async (employeeId, year, month) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/attendance/correction/monthly/${employeeId}?year=${year}&month=${month}`,
        {
          headers: getAuthHeaders()
        }
      );
      return response.data;
    } catch (error) {
      console.error('Erreur récupération pointages mensuels:', error);
      throw error;
    }
  },

  updateAttendanceCorrection: async (attendanceId, data) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/attendance/correction/update/${attendanceId}`,
        data,
        {
          headers: getAuthHeaders()
        }
      );
      return response.data;
    } catch (error) {
      console.error('Erreur mise à jour pointage:', error);
      throw error;
    }
  },

  createAttendanceCorrection: async (data) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/attendance/correction/create`,
        data,
        {
          headers: getAuthHeaders()
        }
      );
      return response.data;
    } catch (error) {
      console.error('Erreur création pointage:', error);
      throw error;
    }
  },

  deleteAttendanceCorrection: async (attendanceId) => {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/attendance/correction/delete/${attendanceId}`,
        {
          headers: getAuthHeaders()
        }
      );
      return response.data;
    } catch (error) {
      console.error('Erreur suppression pointage:', error);
      throw error;
    }
  },

  getCorrectionHistory: async (employeeId, limit = 50) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/attendance/correction/history/${employeeId}?limit=${limit}`,
        {
          headers: getAuthHeaders()
        }
      );
      return response.data;
    } catch (error) {
      console.error('Erreur récupération historique:', error);
      throw error;
    }
  },
  
  // ==================== NOUVELLES FONCTIONS ====================
  checkBackendStatus: (force = false) => checkBackendStatus(force),
  
  getConnectionStatus: () => backendStatus,
  
  forceConnectionCheck: async () => {
    console.log('🔍 Forçage vérification connexion...');
    return await checkBackendStatus(true);
  },
  
  simulateOffline: (status = true) => {
    backendStatus = !status;
    console.log(status ? '🔌 Mode hors ligne simulé' : '🌐 Mode en ligne restauré');
  },
  
  // ==================== MÉTHODES HTTP GÉNÉRIQUES ====================
  get: (url, options) => makeRequest('GET', url, null, options),
  post: (url, data, options) => makeRequest('POST', url, data, options),
  put: (url, data, options) => makeRequest('PUT', url, data, options),
  patch: (url, data, options) => makeRequest('PATCH', url, data, options),
  delete: (url, options) => makeRequest('DELETE', url, null, options)
};

// ==================== INTERCEPTEURS AXIOS ====================

axios.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token && !config.url.includes('/auth/login') && !config.url.includes('/auth/refresh')) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('❌ Erreur intercepteur requête:', error);
    return Promise.reject(error);
  }
);

axios.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log('🔐 Intercepteur: Token expiré détecté');
      originalRequest._retry = true;
      
      try {
        const newToken = await refreshToken();
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        console.error('❌ Échec rafraîchissement token:', refreshError.message);
        
        removeToken();
        localStorage.removeItem('refreshToken');
        
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// ==================== FONCTIONS D'INITIALISATION ====================

export const checkApiStatus = async () => {
  try {
    const result = await api.testConnection();
    if (result.connected) {
      console.log('🌐 API Status: ✅ Connecté');
      return true;
    } else {
      console.log('🌐 API Status: ❌ Déconnecté');
      return false;
    }
  } catch (error) {
    console.log('🌐 API Status: ❌ Erreur de vérification');
    return false;
  }
};

export const initApi = async () => {
  console.log('🚀 Initialisation de l\'API...');
  
  const isConnected = await checkApiStatus();
  
  if (!isConnected) {
    console.warn('⚠️ Impossible de se connecter à l\'API');
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('api_offline', 'true');
      window.dispatchEvent(new CustomEvent('api-status', { 
        detail: { connected: false } 
      }));
    }
    
    return false;
  } else {
    localStorage.removeItem('api_offline');
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('api-status', { 
        detail: { connected: true } 
      }));
    }
  }
  
  const token = getToken();
  if (token) {
    try {
      await api.verifyToken();
      console.log('🔐 Token valide détecté');
    } catch (error) {
      console.log('🔐 Token invalide ou expiré');
      removeToken();
    }
  }
  
  console.log('✅ API initialisée avec succès');
  return true;
};

// ==================== SURVEILLANCE DE CONNEXION ====================

let connectionWatchdog = null;

export const startConnectionWatchdog = (interval = 60000) => {
  if (connectionWatchdog) {
    console.log('⚠️ Watchdog déjà en cours');
    return;
  }
  
  console.log(`🔍 Démarrage surveillance connexion (${interval}ms)`);
  
  connectionWatchdog = setInterval(async () => {
    const previousStatus = backendStatus;
    const currentStatus = await checkBackendStatus(true);
    
    if (previousStatus !== currentStatus) {
      console.log(`🔄 Changement statut connexion: ${previousStatus ? '✅' : '❌'} -> ${currentStatus ? '✅' : '❌'}`);
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('connection-change', {
          detail: { 
            connected: currentStatus,
            previous: previousStatus,
            timestamp: new Date().toISOString()
          }
        }));
      }
      
      if (currentStatus && !previousStatus) {
        console.log('🔄 Reconnexion détectée, réinitialisation...');
        requestCache.clear();
        await initApi();
      }
    }
  }, interval);
};

export const stopConnectionWatchdog = () => {
  if (connectionWatchdog) {
    console.log('🛑 Arrêt surveillance connexion');
    clearInterval(connectionWatchdog);
    connectionWatchdog = null;
  }
};

// ==================== ÉVÉNEMENTS NAVIGATEUR ====================

if (typeof window !== 'undefined') {
  setTimeout(() => {
    console.log('🔧 Démarrage initialisation différée API...');
    
    const hasInitialized = localStorage.getItem('api_initialized');
    const now = Date.now();
    const lastInit = localStorage.getItem('last_api_init');
    
    if (lastInit && (now - parseInt(lastInit) < 30000)) {
      console.log('⚡ API initialisée récemment, skip...');
      return;
    }
    
    localStorage.setItem('last_api_init', now.toString());
    
    initApi().then(success => {
      if (success) {
        localStorage.setItem('api_initialized', 'true');
        console.log('✅ API initialisation complète');
      }
    }).catch(error => {
      console.error('❌ Échec initialisation API:', error);
    });
    
    startConnectionWatchdog(120000);
    
    window.addEventListener('online', () => {
      console.log('🌐 Navigateur en ligne, vérification serveur différée...');
      setTimeout(() => {
        checkBackendStatus(true).then(() => {
          console.log('✅ Backend vérifié après connexion navigateur');
        }).catch(() => {});
      }, 5000);
    });
    
    window.addEventListener('offline', () => {
      console.warn('🔌 Navigateur hors ligne');
      backendStatus = false;
    });
  }, 3000);
}

// ==================== EXPORTS ====================

export default api;

export const authService = api;
export const employeeService = api;
export const attendanceService = api;
export const facialService = api;
export const reportService = api;
export const userService = api;
export const settingsService = api;

export { makeRequest, getToken, setToken, removeToken, makeRequestWithRetry, getAuthHeaders };

console.log('🚀 API Service initialisé');
console.log('🔐 Système de refresh token activé');
console.log('📊 Cache activé (sauf pour settings):', CACHE_DURATION, 'ms');
console.log('⏱️  Délai minimum:', MIN_REQUEST_DELAY, 'ms');
console.log('🔄 Reconnexion:', RECONNECTION_ATTEMPTS, 'tentatives');
console.log('✅ Fonctions de pointage manuel améliorées');
console.log('📋 Fonctions disponibles:', Object.keys(api).length);