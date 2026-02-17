import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { authService } from '../services/api';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const navigate = useNavigate();
  
  // Références pour éviter les appels multiples
  const initInProgress = useRef(false);
  const tokenCheckTimeout = useRef(null);

  // Fonction pour mettre à jour le token
  const updateToken = useCallback((newToken) => {
    console.log('🔐 Mise à jour token:', newToken ? 'Nouveau token' : 'Suppression token');
    
    if (newToken) {
      localStorage.setItem('token', newToken);
    } else {
      localStorage.removeItem('token');
    }
    setToken(newToken);
  }, []);

  // Définir logout
  const logout = useCallback(() => {
    console.log('🚪 Déconnexion - Nettoyage en cours...');
    
    // Annuler les timeouts
    if (tokenCheckTimeout.current) {
      clearTimeout(tokenCheckTimeout.current);
      tokenCheckTimeout.current = null;
    }
    
    // Nettoyer le localStorage
    updateToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('lastApiCheck');
    
    // Réinitialiser l'état
    setUser(null);
    setInitialized(false);
    initInProgress.current = false;
    
    // Rediriger vers login
    navigate('/login', { replace: true });
    
    console.log('✅ Déconnexion terminée');
  }, [navigate, updateToken]);

  // Fonction pour vérifier les rôles
  const hasRole = useCallback((roles) => {
    if (!user || !user.role) return false;
    
    // Si roles est un tableau, vérifier si le rôle est inclus
    if (Array.isArray(roles)) {
      return roles.includes(user.role);
    }
    
    // Si roles est une chaîne, vérifier l'égalité
    return user.role === roles;
  }, [user]);

  // Fonctions utilitaires pour les rôles courants
  const isAdmin = useCallback(() => {
    return hasRole(['admin', 'superadmin']);
  }, [hasRole]);

  const isManager = useCallback(() => {
    return hasRole(['manager', 'admin', 'superadmin']);
  }, [hasRole]);

  const isEmployee = useCallback(() => {
    return hasRole(['employee', 'manager', 'admin', 'superadmin']);
  }, [hasRole]);

  // Vérifier le token localement (rapide, sans appel API)
  const checkTokenLocally = useCallback(() => {
    try {
      if (!token) {
        console.log('🔐 Aucun token trouvé');
        return { valid: false, reason: 'no-token' };
      }
      
      // Vérifier le format
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.log('🔐 Token mal formé');
        return { valid: false, reason: 'malformed' };
      }
      
      // Vérifier l'expiration
      try {
        const payload = JSON.parse(atob(parts[1]));
        const exp = new Date(payload.exp * 1000);
        const now = new Date();
        
        console.log('🔐 Vérification expiration:', {
          expiration: exp.toISOString(),
          maintenant: now.toISOString(),
          expiré: exp < now
        });
        
        if (exp < now) {
          console.log('🔐 Token expiré localement');
          return { valid: false, reason: 'expired' };
        }
        
        // Récupérer l'utilisateur du localStorage
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            return { 
              valid: true, 
              user: userData,
              payload: payload 
            };
          } catch (e) {
            console.warn('⚠️ Erreur parsing user localStorage');
          }
        }
        
        return { valid: true, payload: payload };
        
      } catch (e) {
        console.log('🔐 Erreur décodage token:', e.message);
        return { valid: false, reason: 'decode-error' };
      }
    } catch (error) {
      console.error('🔐 Erreur vérification locale token:', error);
      return { valid: false, reason: 'error' };
    }
  }, [token]);

  // Vérifier le token au démarrage - OPTIMISÉ
  const initAuth = useCallback(async () => {
    // Éviter les init multiples
    if (initInProgress.current || initialized) {
      console.log('⏸️ Init auth déjà en cours ou terminée');
      return;
    }
    
    initInProgress.current = true;
    console.log('🚀 Début initialisation auth...');
    
    try {
      setLoading(true);
      
      // 1. Vérification locale rapide
      const localCheck = checkTokenLocally();
      
      if (!localCheck.valid) {
        console.log(`🔐 Token local invalide: ${localCheck.reason}`);
        
        // Nettoyer si token invalide
        if (localCheck.reason !== 'no-token') {
          updateToken(null);
          localStorage.removeItem('user');
        }
        
        setUser(null);
        setInitialized(true);
        setLoading(false);
        initInProgress.current = false;
        return;
      }
      
      // 2. Si token local OK, mettre à jour l'état
      if (localCheck.user) {
        console.log('✅ Token local valide, utilisateur:', localCheck.user.email);
        setUser(localCheck.user);
      } else {
        // Récupérer l'utilisateur du localStorage
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            setUser(userData);
          } catch (e) {
            console.warn('⚠️ Erreur parsing user localStorage');
          }
        }
      }
      
      // 3. Vérification API en arrière-plan (avec délai pour éviter rate limit)
      tokenCheckTimeout.current = setTimeout(async () => {
        try {
          console.log('🔍 Vérification API token en arrière-plan...');
          const response = await authService.verifyToken();
          
          if (response.success && response.user) {
            console.log('✅ Token API valide');
            
            // Mettre à jour l'utilisateur si différent
            if (response.user.email !== user?.email) {
              setUser(response.user);
              localStorage.setItem('user', JSON.stringify(response.user));
            }
          } else {
            console.warn('⚠️ Token API invalide mais local OK - Garder session');
            // Ne pas déconnecter immédiatement pour l'UX
          }
        } catch (apiError) {
          console.warn('⚠️ Vérification API échouée:', apiError.message);
          // Ne pas déconnecter sur erreur réseau
        }
      }, 2000); // Délai de 2 secondes pour éviter rate limit
      
    } catch (error) {
      console.error('❌ Erreur initAuth:', error.message);
    } finally {
      setLoading(false);
      setInitialized(true);
      initInProgress.current = false;
      console.log('✅ Initialisation auth terminée');
    }
  }, [initialized, checkTokenLocally, updateToken, user]);

  // Fonction pour vérifier le token - OPTIMISÉE (éviter rate limit)
  const checkToken = useCallback(async (forceApiCheck = false) => {
    try {
      console.log('🔄 Vérification token demandée...');
      
      // 1. Vérification locale d'abord
      const localCheck = checkTokenLocally();
      
      if (!localCheck.valid) {
        console.log('🔐 Token local invalide, déconnexion...');
        logout();
        throw new Error('Token local invalide');
      }
      
      // 2. Vérification API seulement si demandée ou toutes les 5 minutes
      const lastApiCheck = localStorage.getItem('lastApiCheck');
      const now = Date.now();
      const shouldCheckApi = forceApiCheck || 
                           !lastApiCheck || 
                           (now - parseInt(lastApiCheck)) > 300000; // 5 minutes
      
      if (shouldCheckApi) {
        console.log('🔍 Vérification API token...');
        const response = await authService.verifyToken();
        
        if (!response.success) {
          console.log('🔐 Token API invalide');
          localStorage.setItem('lastApiCheck', now.toString());
          logout();
          throw new Error('Token API invalide');
        }
        
        // Mettre à jour l'utilisateur si nécessaire
        if (response.user) {
          setUser(response.user);
          localStorage.setItem('user', JSON.stringify(response.user));
        }
        
        localStorage.setItem('lastApiCheck', now.toString());
        console.log('✅ Token API vérifié avec succès');
      } else {
        console.log('⏩ Utilisation cache token (vérifié récemment)');
      }
      
      return true;
      
    } catch (error) {
      console.error('🔐 Erreur checkToken:', error.message);
      
      // Ne pas déconnecter sur erreur réseau, seulement sur token invalide
      if (error.message.includes('invalide') || error.message.includes('local invalide')) {
        logout();
      }
      
      throw error;
    }
  }, [checkTokenLocally, logout]);

  const login = async (email, password) => {
    try {
      console.log('🔐 Tentative de connexion:', email);
      
      // Annuler les vérifications en cours
      if (tokenCheckTimeout.current) {
        clearTimeout(tokenCheckTimeout.current);
        tokenCheckTimeout.current = null;
      }
      
      const response = await authService.login(email, password);
      
      if (response.success && response.token) {
        console.log('✅ Connexion réussie');
        
        // Mettre à jour le token
        updateToken(response.token);
        
        // Stocker l'utilisateur
        if (response.user) {
          localStorage.setItem('user', JSON.stringify(response.user));
          setUser(response.user);
        }
        
        // Réinitialiser le timestamp de vérification
        localStorage.setItem('lastApiCheck', Date.now().toString());
        
        // Réinitialiser l'état
        setInitialized(true);
        
        return { success: true, user: response.user };
      } else {
        console.log('❌ Connexion échouée:', response.message);
        return { 
          success: false, 
          message: response.message || 'Erreur de connexion' 
        };
      }
    } catch (error) {
      console.error('🔐 Erreur login:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Erreur de connexion au serveur' 
      };
    }
  };

  // Fonction pour mettre à jour l'utilisateur
  const updateUser = useCallback((newUserData) => {
    if (user) {
      const updatedUser = { ...user, ...newUserData };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  }, [user]);

  // Fonction pour obtenir le token actuel (compatibilité)
  const getToken = useCallback(() => {
    return token;
  }, [token]);

  // Initialisation au montage
  useEffect(() => {
    initAuth();
    
    // Nettoyage
    return () => {
      if (tokenCheckTimeout.current) {
        clearTimeout(tokenCheckTimeout.current);
      }
    };
  }, [initAuth]);

  // Écouter les changements de localStorage (pour les autres onglets)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        console.log('🔄 Token changé dans localStorage');
        setToken(e.newValue || null);
      }
      if (e.key === 'user') {
        console.log('🔄 User changé dans localStorage');
        try {
          setUser(e.newValue ? JSON.parse(e.newValue) : null);
        } catch (error) {
          console.error('Erreur parsing user:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token, // Token disponible directement
      getToken, // Fonction pour obtenir le token (compatibilité)
      isAuthenticated: !!user && !!token,
      loading,
      login,
      logout,
      checkToken,
      initialized,
      hasRole,
      isAdmin,
      isManager,
      isEmployee,
      updateUser,
      updateToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};