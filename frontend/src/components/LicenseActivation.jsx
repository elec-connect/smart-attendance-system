import React, { useState, useEffect } from 'react';
import { FaLock, FaUnlock, FaCalendarAlt, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import api from '../services/api';

const LicenseActivation = ({ onActivated }) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [status, setStatus] = useState('checking');
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkLicenseStatus();
  }, []);

  const checkLicenseStatus = async () => {
    try {
      const response = await api.get('/license-status');
      setInfo(response.data);
      
      if (response.data.valid) {
        setStatus('valid');
      } else if (response.data.trial) {
        setStatus('trial');
      } else {
        setStatus('expired');
      }
    } catch (error) {
      setStatus('error');
    }
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError('Veuillez entrer votre clé de licence');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/activate', { licenseKey });
      
      if (response.data.success) {
        setStatus('valid');
        setInfo({ expires: response.data.expires });
        if (onActivated) onActivated();
      } else {
        setError('Clé de licence invalide');
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de l\'activation');
    } finally {
      setLoading(false);
    }
  };

  const getDaysLeft = () => {
    if (!info?.daysLeft) return null;
    return (
      <div className="mt-2 flex items-center text-sm">
        <FaCalendarAlt className="mr-2 text-blue-500" />
        <span>Il vous reste <strong>{info.daysLeft} jour{info.daysLeft > 1 ? 's' : ''}</strong> d'essai</span>
      </div>
    );
  };

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Vérification de la licence...</p>
        </div>
      </div>
    );
  }

  if (status === 'valid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaCheckCircle className="text-green-600 text-4xl" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Licence Active</h2>
            <p className="text-gray-600 mt-2">
              Votre licence est valide jusqu'au {new Date(info?.expires).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Accéder à l'application
          </button>
        </div>
      </div>
    );
  }

  if (status === 'trial') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaLock className="text-blue-600 text-4xl" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Version d'essai</h2>
            <p className="text-gray-600 mt-2">
              Vous utilisez actuellement la version d'essai
            </p>
            {getDaysLeft()}
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="font-semibold text-gray-700 mb-4">Activer votre licence</h3>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="Entrez votre clé de licence"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              onClick={handleActivate}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? (
                <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> Activation...</>
              ) : (
                <><FaUnlock className="mr-2" /> Activer ma licence</>
              )}
            </button>

            <p className="text-xs text-gray-500 text-center mt-4">
              Pour obtenir votre clé de licence, contactez votre administrateur
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Licence expirée
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaExclamationTriangle className="text-red-600 text-4xl" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Licence expirée</h2>
          <p className="text-gray-600 mt-2">
            Votre période d'essai de 30 jours est terminée
          </p>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="font-semibold text-gray-700 mb-4">Activer votre licence</h3>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <input
            type="text"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="Entrez votre clé de licence"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={handleActivate}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? (
              <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> Activation...</>
            ) : (
              <><FaUnlock className="mr-2" /> Activer ma licence</>
            )}
          </button>

          <p className="text-xs text-gray-500 text-center mt-4">
            Pour acheter une licence, contactez votre fournisseur
          </p>
        </div>
      </div>
    </div>
  );
};

export default LicenseActivation;
