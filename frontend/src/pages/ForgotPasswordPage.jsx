// src/pages/ForgotPasswordPage.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../services/api';

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Veuillez entrer votre adresse email');
      return;
    }
    
    // Validation simple de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Veuillez entrer une adresse email valide');
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('📧 Demande de réinitialisation pour:', email);
      
      const response = await api.forgotPassword(email);
      
      if (response.success) {
        setEmailSent(true);
        toast.success('Email de réinitialisation envoyé !');
        console.log('✅ Email envoyé avec succès');
        
        // En mode développement, afficher le lien de debug
        if (process.env.NODE_ENV === 'development' && response.debug?.resetLink) {
          console.log('🔗 Lien de réinitialisation (dev):', response.debug.resetLink);
        }
      } else {
        toast.error(response.message || 'Erreur lors de l\'envoi de l\'email');
      }
    } catch (error) {
      console.error('❌ Erreur forgot password:', error);
      
      // Gestion des erreurs spécifiques
      let errorMessage = 'Erreur lors de l\'envoi de l\'email';
      
      if (error.response?.status === 404) {
        errorMessage = 'Aucun compte trouvé avec cet email';
      } else if (error.response?.status === 429) {
        errorMessage = 'Trop de tentatives, veuillez réessayer plus tard';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      
      // Afficher le lien de debug en développement
      if (process.env.NODE_ENV === 'development' && error.response?.data?.debug?.resetLink) {
        console.log('🔗 Lien de réinitialisation (debug):', error.response.data.debug.resetLink);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600/20 to-blue-400/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {emailSent ? 'Email envoyé ✓' : 'Mot de passe oublié ?'}
            </h1>
            <p className="text-gray-300">
              {emailSent 
                ? 'Vérifiez votre boîte email' 
                : 'Entrez votre email pour réinitialiser votre mot de passe'}
            </p>
          </div>

          {emailSent ? (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                  </svg>
                </div>
                <p className="text-green-300 font-medium mb-2">Email envoyé avec succès !</p>
                <p className="text-gray-300 text-sm">
                  Un lien de réinitialisation a été envoyé à <strong className="text-white">{email}</strong>.
                </p>
                <p className="text-gray-400 text-xs mt-2">
                  Vérifiez votre boîte de réception (et les spams).
                  Le lien expire dans 1 heure.
                </p>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg transition-all shadow-lg hover:shadow-xl font-medium"
                >
                  Retour à la connexion
                </button>
                
                <button
                  onClick={() => setEmailSent(false)}
                  className="w-full py-3 px-6 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white rounded-lg transition-all font-medium"
                >
                  Renvoyer l'email
                </button>
              </div>
              
              {/* Instructions supplémentaires */}
              <div className="bg-gray-800/30 rounded-lg p-4 mt-4">
                <h3 className="text-gray-300 font-medium text-sm mb-2">💡 Problèmes courants :</h3>
                <ul className="text-gray-400 text-xs space-y-1">
                  <li>• Vérifiez votre dossier spam/courriers indésirables</li>
                  <li>• L'email peut prendre quelques minutes à arriver</li>
                  <li>• Assurez-vous d'avoir entré l'email correct</li>
                </ul>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Adresse email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                  autoComplete="email"
                />
                <p className="text-gray-400 text-xs mt-1">
                  Vous recevrez un lien de réinitialisation par email
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-xl disabled:hover:shadow-lg flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Envoi en cours...
                  </>
                ) : 'Envoyer le lien de réinitialisation'}
              </button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                >
                  ← Retour à la connexion
                </Link>
              </div>
            </form>
          )}

          {/* Section debug (visible seulement en développement) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 pt-6 border-t border-gray-700/50">
              <details className="text-sm">
                <summary className="text-gray-400 cursor-pointer hover:text-gray-300">Debug Info</summary>
                <div className="mt-3 space-y-2 text-gray-500">
                  <p><strong>Email saisi:</strong> {email}</p>
                  <p><strong>Email envoyé:</strong> {emailSent ? '✅ Oui' : '❌ Non'}</p>
                  <p><strong>Chargement:</strong> {loading ? 'En cours...' : 'Terminé'}</p>
                  <p><strong>API URL:</strong> {import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}</p>
                </div>
              </details>
            </div>
          )}
        </div>

        <div className="text-center text-gray-400 text-sm mt-8">
          <p>Smart Attendance System • Sécurité maximale</p>
          <p className="mt-1">Si vous rencontrez des problèmes, contactez le support.</p>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;