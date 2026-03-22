import React, { useState, useEffect, useRef } from 'react';
import { Camera, Home, UserCheck, CheckCircle, XCircle, Pause, Play, Settings, AlertCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FacialAttendancePage = () => {
  const navigate = useNavigate();
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const autoScanIntervalRef = useRef(null);
  const hasInitializedRef = useRef(false); // Nouveau: pour éviter les réinitialisations multiples
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Cliquez sur "Démarrer la caméra"');
  const [cameraError, setCameraError] = useState('');
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('default');
  const [isCameraReady, setIsCameraReady] = useState(false);

  // Détecter les caméras disponibles - UNE SEULE FOIS 
  useEffect(() => {
    if (hasInitializedRef.current) return;
    
    const detectCameras = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          setCameraDevices(videoDevices);
          console.log('📸 Caméras détectées:', videoDevices.length);
        }
      } catch (err) {
        console.error('❌ Erreur détection caméras:', err);
      }
    };
    
    detectCameras();
    hasInitializedRef.current = true;
    
    return () => {
      // Nettoyage propre
      console.log('🧹 Cleanup FacialAttendancePage');
      stopCamera();
    };
  }, []);

  // Initialiser la caméra de manière robuste
  const initCamera = async () => {
    console.log('🚀 Initialisation de la caméra...');
    
    // Arrêter la caméra si elle est déjà active
    if (isCameraActive) {
      stopCamera();
      await new Promise(resolve => setTimeout(resolve, 300)); // Pause pour libérer la ressource
      return;
    }
    
    try {
      setStatusMessage('Accès à la caméra...');
      setCameraError('');
      setIsCameraReady(false);

      // Configuration de la caméra
      const constraints = {
        video: {
          deviceId: selectedCameraId !== 'default' ? { exact: selectedCameraId } : undefined,
          facingMode: selectedCameraId === 'default' ? 'user' : undefined,
          width: { ideal: 640 }, // RÉDUIT pour meilleure performance
          height: { ideal: 480 },
          frameRate: { ideal: 15 } // RÉDUIT pour moins de charge
        },
        audio: false
      };

      // Demander l'accès à la caméra
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      // Attendre que l'élément vidéo soit disponible
      if (videoRef.current) {
        console.log('📹 Attachement du flux vidéo...');
        
        videoRef.current.srcObject = stream;
        
        // Attendre que la vidéo soit prête
        await new Promise((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error('Élément vidéo non disponible'));
            return;
          }
          
          const onLoadedMetadata = () => {
            console.log('✅ Métadonnées vidéo chargées');
            videoRef.current.removeEventListener('loadedmetadata', onLoadedMetadata);
            videoRef.current.removeEventListener('error', onError);
            resolve();
          };
          
          const onError = (err) => {
            console.error('❌ Erreur vidéo:', err);
            videoRef.current.removeEventListener('loadedmetadata', onLoadedMetadata);
            videoRef.current.removeEventListener('error', onError);
            reject(err);
          };
          
          videoRef.current.addEventListener('loadedmetadata', onLoadedMetadata);
          videoRef.current.addEventListener('error', onError);
          
          // Timeout de sécurité
          setTimeout(() => {
            videoRef.current.removeEventListener('loadedmetadata', onLoadedMetadata);
            videoRef.current.removeEventListener('error', onError);
            reject(new Error('Timeout chargement vidéo'));
          }, 5000);
        });
        
        // Démarrer la lecture
        try {
          await videoRef.current.play();
          console.log('▶️ Vidéo en lecture');
          
          // Marquer comme prêt après un court délai
          setTimeout(() => {
            setIsCameraActive(true);
            setIsCameraReady(true);
            setStatusMessage('Caméra active - Prêt à scanner');
            startAutoScan();
          }, 500);
          
        } catch (playError) {
          console.error('❌ Erreur lecture:', playError);
          // Forcer la lecture avec une approche différente
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {
            // Ignorer si autoplay est bloqué, continuer quand même
            setIsCameraActive(true);
            setIsCameraReady(true);
            setStatusMessage('Caméra active (autoplay bloqué)');
            startAutoScan();
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Erreur accès caméra:', error);
      handleCameraError(error);
      
      // Réinitialiser l'état
      setIsCameraActive(false);
      setIsCameraReady(false);
      setStatusMessage('Erreur caméra');
    }
  };

  // Gérer les erreurs de caméra
  const handleCameraError = (error) => {
    let errorMessage = 'Erreur inconnue';
    
    switch (error.name) {
      case 'NotAllowedError':
        errorMessage = 'Permission refusée. Autorisez l\'accès à la caméra.';
        break;
      case 'NotFoundError':
        errorMessage = 'Aucune caméra trouvée.';
        break;
      case 'NotReadableError':
        errorMessage = 'Caméra déjà utilisée.';
        break;
      case 'OverconstrainedError':
        errorMessage = 'Configuration non supportée. Essayez une autre caméra.';
        break;
      case 'TypeError':
        errorMessage = 'Paramètres invalides pour la caméra.';
        break;
      default:
        errorMessage = error.message || error.name;
    }
    
    setCameraError(errorMessage);
    setStatusMessage(`❌ ${errorMessage}`);
    setIsCameraActive(false);
    setIsCameraReady(false);
    
    // Suggestions selon l'erreur
    if (error.name === 'NotAllowedError') {
      setTimeout(() => {
        alert('Pour autoriser la caméra:\n1. Cliquez sur le cadenas dans la barre d\'adresse\n2. Cliquez sur "Permissions"\n3. Autorisez l\'accès à la caméra\n4. Rafraîchissez la page');
      }, 1000);
    }
  };

  // Démarrer le scan automatique - CORRIGÉ
  const startAutoScan = () => {
    console.log('🔍 Démarrage scan automatique');
    
    // Nettoyer tout intervalle existant
    if (autoScanIntervalRef.current) {
      clearInterval(autoScanIntervalRef.current);
      autoScanIntervalRef.current = null;
    }
    
    // Démarrer un nouvel intervalle
    autoScanIntervalRef.current = setInterval(() => {
      if (isCameraActive && !isProcessing && !isPaused && isCameraReady) {
        simulateRecognition();
      }
    }, 3000);
  };

  // Simuler la reconnaissance faciale
  const simulateRecognition = () => {
    if (!isCameraActive || isProcessing || isPaused || !isCameraReady) {
      console.log('⏸️ Scan ignoré - conditions non remplies');
      return;
    }
    
    console.log('🧠 Simulation reconnaissance...');
    setIsProcessing(true);
    setStatusMessage('Analyse faciale...');
    
    // Simulation après 1.5 secondes
    setTimeout(() => {
      const employees = [
        { id: 'EMP001', name: 'Jean Dupont' },
        { id: 'EMP002', name: 'Marie Martin' },
        { id: 'EMP003', name: 'Pierre Durand' },
      ];
      
      const randomEmployee = employees[Math.floor(Math.random() * employees.length)];
      const isRecognized = Math.random() > 0.3;
      
      if (isRecognized) {
        setRecognitionResult({
          success: true,
          employeeId: randomEmployee.id,
          employeeName: randomEmployee.name,
          message: `Pointage enregistré pour ${randomEmployee.name}`,
          timestamp: new Date().toLocaleTimeString('fr-FR')
        });
        setStatusMessage(`✅ ${randomEmployee.name} reconnu`);
      } else {
        setRecognitionResult({
          success: false,
          message: 'Visage non reconnu dans la base de données'
        });
        setStatusMessage('❌ Non reconnu');
      }
      
      setScanCount(prev => prev + 1);
      setIsProcessing(false);
      
      // Réinitialiser après 3 secondes
      setTimeout(() => {
        if (isCameraActive && !isPaused) {
          setRecognitionResult(null);
          setStatusMessage('Prêt à scanner - Placez votre visage dans le cadre');
        }
      }, 3000);
    }, 1500);
  };

  // Arrêter la caméra PROPRESSE - CORRIGÉ
  const stopCamera = () => {
    console.log('🛑 Arrêt propre de la caméra...');
    
    // Arrêter le scan automatique
    if (autoScanIntervalRef.current) {
      clearInterval(autoScanIntervalRef.current);
      autoScanIntervalRef.current = null;
    }
    
    // Arrêter le stream
    if (streamRef.current) {
      console.log('🔴 Arrêt des tracks vidéo');
      streamRef.current.getTracks().forEach(track => {
        console.log(`   - Arrêt track: ${track.kind} (${track.label})`);
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
    }
    
    // Nettoyer la référence vidéo
    if (videoRef.current) {
      console.log('🧹 Nettoyage élément vidéo');
      videoRef.current.srcObject = null;
      videoRef.current.load(); // Forcer le rechargement
    }
    
    // Mettre à jour l'état
    setIsCameraActive(false);
    setIsCameraReady(false);
    setIsProcessing(false);
    setStatusMessage('Caméra arrêtée');
    setCameraError('');
  };

  // Changer de caméra
  const switchCamera = async () => {
    if (cameraDevices.length < 2) {
      alert('Une seule caméra disponible');
      return;
    }
    
    console.log('🔄 Changement de caméra...');
    
    // Arrêter proprement la caméra actuelle
    stopCamera();
    
    // Attendre que la ressource soit libérée
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Trouver la caméra suivante
    const currentIndex = cameraDevices.findIndex(device => 
      device.deviceId === selectedCameraId || 
      (selectedCameraId === 'default' && device.deviceId)
    );
    
    const nextIndex = (currentIndex + 1) % cameraDevices.length;
    const nextCameraId = cameraDevices[nextIndex].deviceId;
    
    console.log(`📸 Passage à la caméra ${nextIndex + 1}/${cameraDevices.length}`);
    setSelectedCameraId(nextCameraId);
    setStatusMessage('Changement de caméra...');
    
    // Redémarrer avec la nouvelle caméra
    setTimeout(() => {
      initCamera();
    }, 300);
  };

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      console.log('🧹 Démontage FacialAttendancePage - Nettoyage complet');
      stopCamera();
    };
  }, []);

  // Rendu de la vue caméra
  const renderCameraView = () => {
    if (!isCameraActive) {
      return (
        <div className="w-full h-[400px] bg-gradient-to-br from-gray-900 to-black rounded-lg flex flex-col items-center justify-center p-6">
          <div className="w-24 h-24 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Camera className="w-12 h-12 text-gray-500" />
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2 text-center">
            Caméra désactivée
          </h3>
          
          {cameraError && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 mb-4 max-w-md w-full">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-red-300 text-sm">{cameraError}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-2 text-red-300 text-sm underline hover:text-red-200"
                  >
                    Recharger la page
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <p className="text-gray-400 text-center mb-6">
            Activez la caméra pour commencer la reconnaissance faciale
          </p>
          
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={initCamera}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={cameraDevices.length === 0}
            >
              <Camera className="w-5 h-5" />
              {cameraDevices.length === 0 ? 'Aucune caméra' : 'Démarrer la caméra'}
            </button>
            
            {cameraDevices.length > 0 && (
              <div className="flex items-center gap-2 text-gray-300 text-sm">
                <Camera className="w-4 h-4" />
                <span>{cameraDevices.length} caméra(s) détectée(s)</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="relative w-full h-[400px] bg-black rounded-lg overflow-hidden">
        {/* Élément vidéo */}
        <div className="relative w-full h-full">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          
          {/* Indicateur de chargement */}
          {!isCameraReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Camera className="w-8 h-8 text-blue-400 animate-pulse" />
                </div>
                <p className="text-white">Initialisation de la caméra...</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Overlay de guidage */}
        {isCameraReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative">
              <div className={`w-64 h-64 border-4 rounded-full ${
                isPaused ? 'border-yellow-500/40' : 'border-green-500/40'
              } ${isProcessing ? 'animate-pulse' : ''}`}></div>
            </div>
          </div>
        )}
        
        {/* Contrôles en bas */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
          <div className="flex justify-between items-center">
            <div className="text-white">
              <div className="text-sm opacity-80">
                {isCameraReady ? 'Caméra active' : 'Initialisation...'}
              </div>
              {videoRef.current?.videoWidth && (
                <div className="text-xs opacity-60">
                  {videoRef.current.videoWidth}x{videoRef.current.videoHeight}
                </div>
              )}
            </div>
            
            {cameraDevices.length > 1 && (
              <button
                onClick={switchCamera}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm flex items-center gap-2 transition-colors"
                title="Changer de caméra"
                disabled={!isCameraReady || isProcessing}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Caméra
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* En-tête */}
      <div className="bg-gray-800 p-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Pointage Facial</h1>
              <p className="text-gray-400 text-sm">Reconnaissance faciale automatique</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => isCameraActive ? stopCamera() : initCamera()}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                isCameraActive 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-green-600 hover:bg-green-700'
              } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
              disabled={cameraDevices.length === 0}
            >
              <Camera className="w-4 h-4" />
              {isCameraActive ? 'Arrêter' : 'Démarrer'} Caméra
            </button>
            
            <button
              onClick={() => navigate('/dashboard')}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white flex items-center gap-2 transition-colors"
            >
              <Home className="w-4 h-4" />
              Tableau de bord
            </button>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Zone caméra */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <div className="mb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Camera className="w-5 h-5 text-blue-400" />
                    Reconnaissance faciale
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-300 text-sm">
                      Scans: <span className="font-bold">{scanCount}</span>
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      isCameraActive && isCameraReady
                        ? 'bg-green-900/30 text-green-400' 
                        : 'bg-red-900/30 text-red-400'
                    }`}>
                      {isCameraActive && isCameraReady ? '● Active' : '● Inactive'}
                    </span>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mt-1">
                  Positionnez votre visage dans le cercle pour le scan
                </p>
              </div>

              {renderCameraView()}
              
              {/* Barre de statut */}
              <div className="mt-4">
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      !isCameraActive ? 'bg-gray-600' :
                      !isCameraReady ? 'bg-blue-600 animate-pulse' :
                      isPaused ? 'bg-yellow-500' :
                      isProcessing 
                        ? 'bg-blue-500 animate-pulse' 
                        : 'bg-green-500'
                    }`}
                    style={{ width: '100%' }}
                  ></div>
                </div>
                <div className="mt-2 text-center">
                  <p className={`font-bold text-lg flex items-center justify-center gap-2 ${
                    !isCameraActive ? 'text-gray-400' :
                    !isCameraReady ? 'text-blue-400' :
                    isPaused ? 'text-yellow-400' :
                    recognitionResult?.success 
                      ? 'text-green-400' 
                      : recognitionResult?.success === false 
                        ? 'text-red-400' 
                        : isProcessing 
                          ? 'text-blue-400' 
                          : 'text-white'
                  }`}>
                    {statusMessage}
                  </p>
                </div>

                {/* Boutons d'action */}
                <div className="mt-4 flex flex-wrap gap-3 justify-center">
                  <button
                    onClick={() => !isCameraActive ? initCamera() : simulateRecognition()}
                    disabled={isProcessing || (isCameraActive && !isCameraReady) || (isCameraActive && isPaused)}
                    className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
                      isProcessing || (isCameraActive && !isCameraReady) || (isCameraActive && isPaused)
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    {isProcessing 
                      ? 'Analyse...' 
                      : !isCameraActive 
                        ? 'Activer la caméra' 
                        : 'Scanner maintenant'}
                  </button>
                  
                  {isCameraActive && isCameraReady && (
                    <button
                      onClick={() => setIsPaused(!isPaused)}
                      className={`px-4 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
                        isPaused
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      }`}
                      disabled={isProcessing}
                    >
                      {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      {isPaused ? 'Reprendre' : 'Pause'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Panneau latéral */}
          <div className="space-y-4">
            {/* Résultat */}
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <div className="text-center">
                {recognitionResult ? (
                  recognitionResult.success ? (
                    <>
                      <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle className="w-8 h-8 text-green-400" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">
                        {recognitionResult.employeeName}
                      </h3>
                      <p className="text-gray-300 text-sm mb-2">
                        ID: {recognitionResult.employeeId}
                      </p>
                      <p className="text-green-300 text-sm bg-green-900/30 rounded-lg p-2">
                        {recognitionResult.message}
                      </p>
                      {recognitionResult.timestamp && (
                        <p className="text-gray-400 text-xs mt-2">
                          {recognitionResult.timestamp}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <XCircle className="w-8 h-8 text-red-400" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">
                        Non reconnu
                      </h3>
                      <p className="text-red-300 text-sm bg-red-900/30 rounded-lg p-2">
                        {recognitionResult.message}
                      </p>
                    </>
                  )
                ) : (
                  <>
                    <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <UserCheck className="w-8 h-8 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">
                      {isPaused ? 'En pause' : 
                       !isCameraReady ? 'Chargement...' : 
                       'En attente'}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {isCameraActive && isCameraReady
                        ? 'Positionnez votre visage'
                        : 'Activez la caméra pour commencer'}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Contrôles caméra */}
            {cameraDevices.length > 0 && (
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Paramètres caméra
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">
                      Caméra détectée
                    </label>
                    <div className="text-white text-sm bg-gray-900/50 p-2 rounded">
                      {cameraDevices.length} caméra(s) disponible(s)
                    </div>
                  </div>
                  
                  <button
                    onClick={switchCamera}
                    disabled={cameraDevices.length < 2 || !isCameraReady || isProcessing}
                    className={`w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                      cameraDevices.length < 2 || !isCameraReady || isProcessing
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Changer de caméra
                  </button>
                </div>
              </div>
            )}

            {/* Statut système */}
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <h3 className="text-lg font-bold text-white mb-3">Statut système</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Caméra:</span>
                  <span className={isCameraActive && isCameraReady ? 'text-green-400' : 'text-red-400'}>
                    {isCameraActive && isCameraReady ? '● Connectée' : '● Déconnectée'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">État:</span>
                  <span className={
                    !isCameraActive ? 'text-gray-400' :
                    !isCameraReady ? 'text-blue-400' :
                    isPaused ? 'text-yellow-400' : 'text-green-400'
                  }>
                    {!isCameraActive ? 'Arrêtée' :
                     !isCameraReady ? 'Initialisation' :
                     isPaused ? '⏸️ Pause' : '▶️ Prête'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Total scans:</span>
                  <span className="text-white font-semibold">{scanCount}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Dernier scan:</span>
                  <span className="text-gray-300 text-sm">
                    {recognitionResult ? 'À l\'instant' : 'En attente'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions rapides */}
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <h3 className="text-lg font-bold text-white mb-3">Actions</h3>
              
              <div className="space-y-2">
                <button
                  onClick={() => navigate('/employees/register')}
                  className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white flex items-center justify-center gap-2 transition-colors"
                >
                  <UserCheck className="w-4 h-4" />
                  Enregistrer un visage
                </button>
                
                <button
                  onClick={() => navigate('/attendance')}
                  className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-white flex items-center justify-center gap-2 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Voir les pointages
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacialAttendancePage;