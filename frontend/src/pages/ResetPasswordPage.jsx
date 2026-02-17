import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../services/api';

const ResetPasswordPage = () => {
  const { token } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenFromUrl, setTokenFromUrl] = useState(null);
  const [tokenValid, setTokenValid] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);

  // Fonction pour extraire le token de l'URL manuellement
  const extractTokenFromUrl = () => {
    const path = location.pathname;
    
    // Méthode 1: Depuis useParams (si la route est correcte)
    if (token) {
      console.log('✅ Token from useParams:', token);
      return token;
    }
    
    // Méthode 2: Depuis l'URL manuellement
    if (path.startsWith('/reset-password/')) {
      const extractedToken = path.replace('/reset-password/', '');
      if (extractedToken && extractedToken.length > 10) {
        console.log('✅ Token extrait manuellement:', extractedToken);
        return extractedToken;
      }
    }
    
    console.log('❌ Aucun token trouvé dans l\'URL');
    return null;
  };

  useEffect(() => {
    const validateToken = async () => {
      const extractedToken = extractTokenFromUrl();
      setTokenFromUrl(extractedToken);
      
      if (!extractedToken) {
        setValidatingToken(false);
        setTokenValid(false);
        return;
      }

      try {
        setValidatingToken(true);
        console.log('🔍 Validation du token via API...');
        
        // Utiliser la bonne méthode : api.verifyResetToken()
        const response = await api.verifyResetToken(extractedToken);
        
        console.log('📊 Réponse validation token:', response);
        
        if (response.success) {
          setTokenValid(true);
          console.log('✅ Token valide');
        } else {
          setTokenValid(false);
          console.log('❌ Token invalide:', response.message);
          toast.error('Token invalide ou expiré');
        }
      } catch (error) {
        console.error('❌ Erreur validation token:', error);
        setTokenValid(false);
        
        // Afficher un message d'erreur plus spécifique
        const errorMsg = error.response?.data?.message || 
                        error.message || 
                        'Erreur de validation du token';
        
        console.log('📌 Détails erreur:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        
        toast.error(`Erreur: ${errorMsg}`);
      } finally {
        setValidatingToken(false);
      }
    };

    validateToken();
  }, [location.pathname, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!tokenFromUrl) {
      toast.error('Token manquant ou invalide');
      return;
    }
    
    if (!tokenValid) {
      toast.error('Token invalide ou expiré');
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    
    if (password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('🔄 Envoi demande réinitialisation avec token:', tokenFromUrl);
      
      // CORRECTION ICI : Utiliser directement api.resetPassword()  
      const response = await api.resetPassword(tokenFromUrl, password);
      
      console.log('✅ Réponse réinitialisation:', response);
      
      if (response.success) {
        toast.success('Mot de passe réinitialisé avec succès !');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        toast.error(response.message || 'Erreur lors de la réinitialisation');
      }
    } catch (error) {
      console.error('❌ Erreur API resetPassword:', error);
      
      // Détails de l'erreur
      console.log('📌 Détails erreur:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        config: error.config
      });
      
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Erreur de connexion au serveur';
      
      toast.error(`Erreur: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (validatingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-gray-300 text-lg">Validation du token...</p>
          <p className="text-gray-500 text-sm mt-2">Vérification en cours</p>
          <p className="text-xs text-gray-600 mt-4">
            Token: {tokenFromUrl ? `${tokenFromUrl.substring(0, 20)}...` : 'null'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
        <div className="text-center mb-8">
          <div className={`w-20 h-20 ${tokenValid ? 'bg-gradient-to-br from-green-600/20 to-green-400/20' : 'bg-gradient-to-br from-red-600/20 to-red-400/20'} rounded-2xl flex items-center justify-center mx-auto mb-6`}>
            <i className={`fas ${tokenValid ? 'fa-key' : 'fa-exclamation-triangle'} text-3xl ${tokenValid ? 'text-green-400' : 'text-red-400'}`}></i>
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-2">
            {tokenValid ? 'Nouveau mot de passe' : 'Lien invalide'}
          </h1>
          
          <p className="text-gray-300">
            {tokenValid 
              ? 'Entrez votre nouveau mot de passe' 
              : tokenFromUrl 
                ? 'Token invalide ou expiré'
                : 'Lien incorrect'
            }
          </p>
        </div>
                
        {tokenValid ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Entrez votre nouveau mot de passe"
                required
                minLength="6"
                disabled={loading}
              />
              <p className="text-xs text-gray-400 mt-1">
                Minimum 6 caractères
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Confirmez votre mot de passe"
                required
                minLength="6"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !tokenValid}
              className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Réinitialisation...
                </span>
              ) : (
                'Réinitialiser le mot de passe'
              )}
            </button>
          </form>
        ) : (
          <div className="text-center py-6">
            <div className="mb-6">
              <p className="text-gray-300 mb-4">
                {tokenFromUrl 
                  ? 'Ce lien de réinitialisation est invalide ou a expiré.'
                  : 'Aucun token trouvé dans l\'URL.'
                }
              </p>
              <p className="text-sm text-gray-400 mb-6">
                Les liens de réinitialisation expirent après 1 heure.
              </p>
            </div>
            
            <div className="space-y-4">
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 px-6 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl transition-all"
              >
                <i className="fas fa-arrow-left mr-2"></i>
                Retour à la connexion
              </button>
              
              <button
                onClick={() => navigate('/forgot-password')}
                className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl transition-all"
              >
                <i className="fas fa-redo mr-2"></i>
                Demander un nouveau lien
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-700">
          <p className="text-center text-sm text-gray-400">
            <i className="fas fa-shield-alt mr-2"></i>
            Smart Attendance System • Sécurité maximale
          </p>
          
          </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;