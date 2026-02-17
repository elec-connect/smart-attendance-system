import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import FacialCamera from '../facial/FacialCamera';
import { 
  User, Camera, Check, AlertCircle, Shield, Upload, 
  XCircle, Loader, X, UserCheck, RefreshCw 
} from 'lucide-react';

const EmployeeFacialRegistration = ({ employee, onComplete, onCancel }) => {
  // Normaliser l'objet employee
  const employeeData = {
    employee_id: employee.employee_id || employee.employeeId || employee.id,
    first_name: employee.first_name || employee.firstName || 'Employé',
    last_name: employee.last_name || employee.lastName || '',
    email: employee.email || ''
  };

  const [step, setStep] = useState('initial');
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [hasExistingFace, setHasExistingFace] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Références
  const abortControllerRef = useRef(null);
  
  // CORRECTION : Construire correctement l'URL de base
  const getApiBaseUrl = () => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    
    // Si l'URL se termine déjà par /api, ne pas en ajouter un autre
    if (baseUrl.endsWith('/api')) {
      return baseUrl;
    }
    
    // Sinon, ajouter /api
    return `${baseUrl}/api`;
  };
  
  const apiBaseUrl = getApiBaseUrl();
  
  console.log('🔄 URL API configurée:', apiBaseUrl);

  // Vérifier si l'employé a déjà un visage enregistré
  useEffect(() => {
    if (employeeData.employee_id) {
      checkExistingFace();
    }
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [employeeData.employee_id]);

  const checkExistingFace = async () => {
    if (!employeeData.employee_id) {
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    
    // Annuler toute requête précédente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Session expirée');
      }

      // CORRECTION : URL correcte sans double /api
      const checkUrl = `${apiBaseUrl}/facial/check/${employeeData.employee_id}`;
      console.log('🔍 URL vérification:', checkUrl);
      
      const response = await axios.get(checkUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
        timeout: 10000
      });

      console.log('✅ Réponse vérification:', response.data);
      setHasExistingFace(response.data.hasFaceRegistered || response.data.success);
      
    } catch (error) {
      // Ignorer les erreurs d'annulation
      if (axios.isCancel(error)) {
        console.log('⚠️ Requête annulée');
        return;
      }
      
      console.error('❌ Erreur vérification:', error);
      
      // Pour les erreurs 404, considérer qu'il n'y a pas d'enregistrement
      if (error.response?.status === 404) {
        console.log('⚠️ Route non trouvée, aucun visage enregistré');
        setHasExistingFace(false);
      } else {
        console.warn('⚠️ Vérification visage échouée:', error.message);
        // Continuer quand même, l'utilisateur pourra essayer d'enregistrer
        setHasExistingFace(false);
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleCapture = async (imageData) => {
    if (!imageData || imageData.length < 10000) {
      setResult({
        success: false,
        message: 'Image trop petite ou invalide',
        type: 'image_error'
      });
      setStep('result');
      return;
    }

    setCapturedImage(imageData);
    setStep('processing');
    setIsProcessing(true);
    setUploadProgress(0);

    try {
      console.log('🔄 Début traitement image...');
      setUploadProgress(10);
      
      // Convertir base64 en Blob
      const base64Data = imageData.split(',')[1] || imageData;
      const byteCharacters = atob(base64Data);
      const byteArrays = [];
      
      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        
        byteArrays.push(new Uint8Array(byteNumbers));
      }
      
      setUploadProgress(30);
      
      const blob = new Blob(byteArrays, { type: 'image/jpeg' });
      const fileName = `face_${employeeData.employee_id}_${Date.now()}.jpg`;
      console.log('📁 Blob créé:', { 
        name: fileName, 
        size: blob.size, 
        type: blob.type 
      });

      // Vérifier la taille
      if (blob.size > 10 * 1024 * 1024) { // 10MB max
        throw new Error('Image trop volumineuse (max 10MB)');
      }

      // Utiliser fetch directement pour éviter les problèmes Axios
      setUploadProgress(50);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token non trouvé. Veuillez vous reconnecter.');
      }

      const registerUrl = `${apiBaseUrl}/facial/register`;
      console.log('📤 Envoi à:', registerUrl);
      
      const formData = new FormData();
      formData.append('photo', blob, fileName);
      formData.append('employeeId', employeeData.employee_id);

      // Créer un timeout pour la requête
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        throw new Error('Timeout: La requête a pris trop de temps');
      }, 90000); // 90 secondes max

      setUploadProgress(60);
      
      const response = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // NE PAS ajouter Content-Type pour FormData
        },
        body: formData,
        signal: controller.signal,
        credentials: 'include' // Important pour les cookies CORS
      });

      clearTimeout(timeoutId);
      
      console.log('📡 Réponse reçue:', response.status, response.statusText);
      
      if (!response.ok) {
        let errorMessage = `Erreur ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // Ignorer si pas de JSON
        }
        throw new Error(errorMessage);
      }

      setUploadProgress(80);
      
      const responseData = await response.json();
      console.log('✅ Réponse API:', responseData);
      
      setUploadProgress(100);

      if (responseData.success) {
        setResult({
          success: true,
          message: responseData.message || 'Visage enregistré avec succès !',
          employeeId: employeeData.employee_id,
          data: responseData,
          employee: responseData.employee || employeeData
        });
        setHasExistingFace(true);
      } else {
        setResult({
          success: false,
          message: responseData.message || 'Erreur lors de l\'enregistrement',
          data: responseData,
          type: 'api_error'
        });
      }
    } catch (error) {
      console.error('❌ Erreur enregistrement:', error);
      
      let errorMessage = 'Erreur lors de l\'enregistrement';
      
      if (error.name === 'AbortError') {
        errorMessage = 'La requête a été interrompue (timeout)';
      } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
        errorMessage = 'Erreur réseau. Vérifiez votre connexion.';
      } else if (error.message.includes('token')) {
        errorMessage = 'Session expirée. Veuillez vous reconnecter.';
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      setResult({
        success: false,
        message: errorMessage,
        type: 'network_error'
      });
    } finally {
      setIsProcessing(false);
      setStep('result');
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const startCapture = () => {
    setStep('capturing');
    setCapturedImage(null);
    setResult(null);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setResult({
        success: false,
        message: 'Veuillez sélectionner une image (JPG, PNG, JPEG)',
        type: 'format_error'
      });
      setStep('result');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setResult({
        success: false,
        message: 'L\'image est trop volumineuse (maximum 10MB)',
        type: 'size_error'
      });
      setStep('result');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      handleCapture(e.target.result);
    };
    reader.onerror = () => {
      setResult({
        success: false,
        message: 'Erreur lors de la lecture du fichier',
        type: 'read_error'
      });
      setStep('result');
    };
    reader.readAsDataURL(file);
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete(result?.success || false, employeeData, result?.data);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    if (onCancel) {
      onCancel();
    }
  };

  const resetForm = () => {
    setStep('initial');
    setCapturedImage(null);
    setResult(null);
    setUploadProgress(0);
  };

  const retryCheck = () => {
    checkExistingFace();
  };

  // Rendu selon l'étape
  const renderContent = () => {
    switch (step) {
      case 'initial':
        return (
          <div className="space-y-6">
            {/* En-tête employé */}
            <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-xl p-6 border border-blue-700/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600/20 rounded-xl">
                  <User className="w-8 h-8 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">
                    {employeeData.first_name} {employeeData.last_name}
                  </h3>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="text-gray-300 text-sm">
                      ID: <span className="font-mono font-bold">{employeeData.employee_id}</span>
                    </div>
                    <div className={`flex items-center gap-2 ${hasExistingFace ? 'text-green-400' : 'text-yellow-400'}`}>
                      {isChecking ? (
                        <>
                          <Loader className="w-3 h-3 animate-spin" />
                          <span className="text-xs">Vérification...</span>
                        </>
                      ) : hasExistingFace ? (
                        <>
                          <UserCheck className="w-4 h-4" />
                          <span className="text-xs">Visage déjà enregistré</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-xs">Aucun visage enregistré</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {!isChecking && !hasExistingFace && (
                  <button
                    onClick={retryCheck}
                    className="p-2 hover:bg-blue-900/30 rounded-lg transition-colors"
                    title="Re-vérifier"
                  >
                    <RefreshCw className="w-5 h-5 text-blue-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-900/30 rounded-lg">
                  <Camera className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-medium mb-4">
                    Comment capturer une bonne photo ?
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-4">
                      <div className="text-green-400 font-medium mb-2 flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        À FAIRE
                      </div>
                      <ul className="text-gray-300 text-sm space-y-2">
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-1.5 flex-shrink-0"></div>
                          <span>Éclairage uniforme devant vous</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-1.5 flex-shrink-0"></div>
                          <span>Regardez directement la caméra</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-1.5 flex-shrink-0"></div>
                          <span>Visage découvert, expression neutre</span>
                        </li>
                      </ul>
                    </div>
                    <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
                      <div className="text-red-400 font-medium mb-2 flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        À ÉVITER
                      </div>
                      <ul className="text-gray-300 text-sm space-y-2">
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-1.5 flex-shrink-0"></div>
                          <span>Éclairage dans votre dos</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-1.5 flex-shrink-0"></div>
                          <span>Lunettes de soleil/casquettes</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-1.5 flex-shrink-0"></div>
                          <span>Sourire ou grimaces</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="bg-blue-900/10 rounded-lg p-4">
                    <p className="text-gray-300 text-sm">
                      💡 <strong>Distance idéale:</strong> 50-80 cm de la caméra
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Avertissement si déjà enregistré */}
            {hasExistingFace && !isChecking && (
              <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-5">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
                  <div>
                    <p className="text-yellow-300 font-bold">⚠️ ATTENTION</p>
                    <p className="text-yellow-200/90 text-sm mt-1">
                      Un visage est déjà enregistré pour cet employé. 
                      <br />
                      <span className="font-semibold">Une nouvelle capture remplacera l'ancienne.</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Options d'enregistrement */}
            <div className="space-y-6">
              <div className="bg-gray-800/20 rounded-xl p-6 border border-gray-700/50">
                <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-blue-400" />
                  Option 1: Utiliser la webcam
                </h4>
                <p className="text-gray-300 text-sm mb-4">
                  Capturez votre visage en temps réel avec votre webcam
                </p>
                <button
                  onClick={startCapture}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-xl text-white font-bold transition-all duration-200 flex items-center justify-center gap-3 shadow-lg"
                  disabled={isChecking}
                >
                  <Camera className="w-6 h-6" />
                  {isChecking ? 'Vérification en cours...' : 'Commencer la capture'}
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700/50"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-gray-900 text-gray-500">OU</span>
                </div>
              </div>

              <div className="bg-gray-800/20 rounded-xl p-6 border border-gray-700/50">
                <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-purple-400" />
                  Option 2: Téléverser une photo
                </h4>
                <p className="text-gray-300 text-sm mb-4">
                  Téléversez une photo existante depuis votre appareil
                </p>
                <label className="block w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 rounded-xl text-white font-bold transition-all duration-200 flex items-center justify-center gap-3 shadow-lg cursor-pointer">
                  <Upload className="w-6 h-6" />
                  Choisir une photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
                <p className="text-gray-500 text-xs text-center mt-3">
                  Formats: JPG, PNG, JPEG • Taille max: 10MB
                </p>
              </div>
            </div>

            {/* Sécurité */}
            <div className="bg-gray-800/30 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-purple-900/30 rounded-lg">
                  <Shield className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium mb-2">
                    🔒 Sécurité des données
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Votre photo est convertie en une empreinte mathématique cryptée. 
                    L'image originale n'est pas stockée sur nos serveurs.
                  </p>
                </div>
              </div>
            </div>

            {/* Bouton Annuler */}
            <div className="pt-2">
              <button
                onClick={handleCancel}
                className="w-full py-3 px-6 bg-gray-800 hover:bg-gray-700 rounded-xl text-white font-medium transition-all duration-200"
                disabled={isProcessing}
              >
                Annuler et retourner
              </button>
            </div>
          </div>
        );

      case 'capturing':
        return (
          <FacialCamera
            onCapture={handleCapture}
            onCancel={() => setStep('initial')}
            title={`Capture pour ${employeeData.first_name}`}
            employeeName={`${employeeData.first_name} ${employeeData.last_name}`}
            autoCapture={false}
          />
        );

      case 'processing':
        return (
          <div className="text-center py-12">
            <div className="inline-flex flex-col items-center max-w-md">
              <div className="relative w-32 h-32 mb-10">
                <div className="absolute inset-0 rounded-full border-8 border-blue-500/10"></div>
                <div className="absolute inset-4 rounded-full border-8 border-blue-500 border-t-transparent animate-spin"></div>
                <div className="absolute inset-8 rounded-full bg-blue-900/30 flex items-center justify-center">
                  <Loader className="w-12 h-12 text-blue-400 animate-pulse" />
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-4">
                {uploadProgress < 50 ? 'Analyse de l\'image...' : 
                 uploadProgress < 80 ? 'Traitement facial...' : 
                 'Finalisation...'}
              </h3>
              
              <p className="text-gray-400 mb-8">
                Veuillez patienter pendant le traitement de votre image.
              </p>
              
              <div className="w-full max-w-sm bg-gray-800 rounded-full h-3 mb-6 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 h-full transition-all duration-500"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              
              <div className="text-gray-400 text-sm mb-10">
                {uploadProgress}% complété
              </div>
              
              <div className="text-gray-500 text-xs">
                ⏱️ Cette opération peut prendre jusqu'à 1 minute
              </div>
            </div>
          </div>
        );

      case 'result':
        if (!result) return null;
        
        return (
          <div className="text-center py-8">
            {result.success ? (
              <>
                <div className="inline-flex items-center justify-center w-28 h-28 bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-3xl mb-8 border border-green-700/30">
                  <Check className="w-16 h-16 text-green-400" />
                </div>
                
                <h3 className="text-3xl font-bold text-white mb-4">
                  ✅ Enregistrement réussi !
                </h3>
                
                <p className="text-green-300 text-xl mb-10">
                  {result.message}
                </p>
                
                <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-2xl p-8 mb-10 border border-gray-700 max-w-md mx-auto shadow-xl">
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="text-gray-400 text-sm mb-2">EMPLOYÉ</div>
                      <div className="text-white font-bold text-2xl">
                        {employeeData.first_name} {employeeData.last_name}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="text-center">
                        <div className="text-gray-400 text-xs mb-1">ID</div>
                        <div className="text-white font-mono font-bold text-lg">
                          {employeeData.employee_id}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400 text-xs mb-1">STATUT</div>
                        <div className="text-green-400 font-bold text-lg flex items-center justify-center gap-2">
                          <UserCheck className="w-5 h-5" />
                          Enregistré
                        </div>
                      </div>
                    </div>
                    
                    {capturedImage && (
                      <div className="pt-6 border-t border-gray-700">
                        <div className="text-gray-400 text-sm mb-3">PHOTO CAPTURÉE</div>
                        <img 
                          src={capturedImage} 
                          alt="Visage enregistré" 
                          className="w-48 h-48 object-cover rounded-xl mx-auto border-2 border-gray-600 shadow-lg"
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-4 pt-6">
                  <button
                    onClick={resetForm}
                    className="flex-1 py-4 px-6 bg-gray-800 hover:bg-gray-700 rounded-xl text-white font-medium transition-all duration-200 shadow-lg"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Camera className="w-5 h-5" />
                      Nouvel enregistrement
                    </div>
                  </button>
                  <button
                    onClick={handleComplete}
                    className="flex-1 py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-xl text-white font-bold transition-all duration-200 shadow-lg"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Check className="w-6 h-6" />
                      Terminer
                    </div>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-28 h-28 bg-gradient-to-br from-red-900/30 to-rose-900/30 rounded-3xl mb-8 border border-red-700/30">
                  <AlertCircle className="w-16 h-16 text-red-400" />
                </div>
                
                <h3 className="text-3xl font-bold text-white mb-4">
                  ❌ Échec de l'enregistrement
                </h3>
                
                <p className="text-red-300 text-lg mb-8">
                  {result.message}
                </p>
                
                <div className="bg-gray-800/50 rounded-2xl p-8 mb-10 max-w-md mx-auto border border-gray-700">
                  <h4 className="text-white font-medium mb-4 text-lg">
                    💡 Conseils pour réussir :
                  </h4>
                  <ul className="text-gray-300 space-y-3 text-left">
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-blue-400 text-sm">1</span>
                      </div>
                      <span>Assurez un bon éclairage sur votre visage</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-blue-400 text-sm">2</span>
                      </div>
                      <span>Positionnez-vous à 50-80 cm de la caméra</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-blue-400 text-sm">3</span>
                      </div>
                      <span>Retirez lunettes de soleil et casquettes</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-blue-400 text-sm">4</span>
                      </div>
                      <span>Vérifiez votre connexion internet</span>
                    </li>
                  </ul>
                </div>
                
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={resetForm}
                    className="flex-1 py-4 px-6 bg-gray-800 hover:bg-gray-700 rounded-xl text-white font-medium transition-all duration-200"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5" />
                      Réessayer
                    </div>
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 py-4 px-6 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 rounded-xl text-white font-medium transition-all duration-200"
                  >
                    Annuler
                  </button>
                </div>
              </>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl">
                <User className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Enregistrement Faciale
                </h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-gray-400 text-sm">
                    Employé: {employeeData.first_name} {employeeData.last_name}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="p-3 hover:bg-gray-800 rounded-xl transition-colors duration-200"
              disabled={isProcessing}
              aria-label="Fermer"
            >
              <X className="w-6 h-6 text-gray-400 hover:text-white" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {renderContent()}
        </div>

        <div className="p-4 border-t border-gray-800 text-xs text-gray-500 bg-gray-900/50">
          <div className="text-center">
            <div className="font-medium mb-1">Serveur API</div>
            <div className="text-gray-400 truncate">{apiBaseUrl}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeFacialRegistration;