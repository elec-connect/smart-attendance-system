import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // AJOUT: Link
import { toast } from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth.jsx';
import Button from '../common/Button.jsx';
import Input from '../common/Input.jsx';
import { FaUser, FaLock, FaEnvelope, FaKey } from 'react-icons/fa';

const LoginForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation des champs
    if (!formData.email || !formData.password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    
    // Validation email basique
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Veuillez entrer une adresse email valide');
      return;
    }
    
    setLoading(true);

    try {
      const result = await login(formData.email, formData.password);
      
      if (result && result.success) {
        toast.success('Connexion réussie !');
        
        // Redirection vers le tableau de bord
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 500);
        
      } else {
        toast.error(result?.message || 'Identifiants incorrects');
      }
      
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    if (!resetEmail) {
      toast.error('Veuillez entrer votre adresse email');
      return;
    }
    
    // Validation email basique
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resetEmail)) {
      toast.error('Veuillez entrer une adresse email valide');
      return;
    }
    
    setResetLoading(true);
    
    try {
      // Option 1: Utiliser l'API directement
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email: resetEmail })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.success) {
          toast.success('Un email de réinitialisation vous a été envoyé !');
          toast.success('Vérifiez votre boîte de réception.', { duration: 6000 });
          
          // Option: Rediriger vers la page de succès
          if (data.debug?.resetLink) {
            console.log('🔗 Lien de réinitialisation:', data.debug.resetLink);
          }
        } else {
          // Pour la sécurité, on montre un message générique
          toast.success('Si votre email est enregistré, vous recevrez un lien de réinitialisation.');
        }
        
        // Réinitialiser et revenir au mode login
        setResetEmail('');
        setForgotPasswordMode(false);
        
      } else {
        toast.error('Une erreur est survenue. Veuillez contacter le support.');
      }
      
    } catch (error) {
      console.error('Erreur réinitialisation:', error);
      toast.error('Service temporairement indisponible. Contactez le support.');
    } finally {
      setResetLoading(false);
    }
  };

  const showPasswordHints = () => {
    toast(
      <div className="text-left p-2">
        <p className="font-bold mb-2 text-gray-800">Recommandations de sécurité :</p>
        <ul className="list-disc pl-4 space-y-1 text-sm text-gray-700">
          <li>Utilisez un mot de passe unique</li>
          <li>Combinez lettres, chiffres et caractères spéciaux</li>
          <li>Évitez les informations personnelles évidentes</li>
          <li>Changez votre mot de passe régulièrement</li>
        </ul>
      </div>,
      { duration: 6000 }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
            {forgotPasswordMode ? (
              <FaKey className="h-8 w-8 text-white" />
            ) : (
              <FaUser className="h-8 w-8 text-white" />
            )}
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            {forgotPasswordMode ? 'Réinitialisation' : 'Connexion'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {forgotPasswordMode 
              ? 'Entrez votre email pour réinitialiser votre mot de passe' 
              : 'Accédez à votre espace sécurisé'}
          </p>
        </div>

        {forgotPasswordMode ? (
          // FORMULAIRE DE RÉINITIALISATION (mode intégré)
          <form className="mt-8 space-y-6" onSubmit={handleForgotPassword}>
            <div className="rounded-md shadow-sm space-y-4">
              <Input
                label="Email de votre compte"
                name="resetEmail"
                type="email"
                autoComplete="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                icon={FaEnvelope}
                placeholder="exemple@entreprise.com"
              />
            </div>

            <div className="space-y-4">
              <Button
                type="submit"
                variant="primary"
                size="large"
                fullWidth
                loading={resetLoading}
                disabled={resetLoading}
              >
                {resetLoading ? 'Traitement...' : 'Envoyer le lien'}
              </Button>
              
              {/* SECTION SUPPRIMÉE : Alternative: Lien vers page dédiée */}
              {/* <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">
                  Ou utilisez la page dédiée
                </p>
                <Link
                  to="/forgot-password"
                  className="inline-block text-blue-600 hover:text-blue-800 font-medium"
                >
                  Page de réinitialisation complète →
                </Link>
              </div> */}
              
              <Button
                type="button"
                variant="outline"
                size="large"
                fullWidth
                onClick={() => {
                  setForgotPasswordMode(false);
                  setResetEmail('');
                }}
              >
                Retour à la connexion
              </Button>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex">
                <div className="flex-shrink-0">
                  <FaEnvelope className="h-5 w-5 text-blue-500" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800">
                    Un lien sécurisé vous sera envoyé par email pour créer un nouveau mot de passe.
                  </p>
                </div>
              </div>
            </div>
          </form>
        ) : (
          // FORMULAIRE DE CONNEXION NORMAL
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm space-y-6">
              <Input
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                icon={FaUser}
                placeholder="votre@email.com"
              />
              
              <div>
                <Input
                  label="Mot de passe"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  icon={FaLock}
                  placeholder="Votre mot de passe"
                />
                {/* Lien "Mot de passe oublié" placé en dessous du champ */}
               
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={showPasswordHints}
                className="text-sm text-gray-600 hover:text-gray-800 flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                Conseils de sécurité
              </button>
              
              <div className="text-sm text-right">
                <button
                  type="button"
                  onClick={() => setForgotPasswordMode(true)}
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="large"
              fullWidth
              loading={loading}
              disabled={loading}
              className="shadow-md"
            >
              {loading ? 'Authentification...' : 'Se connecter'}
            </Button>

            {/* AJOUT: Lien vers page dédiée "Mot de passe oublié" */}
            

            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Pour toute assistance, contactez le support technique
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-medium text-gray-900">Iot.sahnoun@gmail.com</p>
                  <p className="text-xs text-gray-500">Lundi - Vendredi, 9h - 18h</p>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginForm;