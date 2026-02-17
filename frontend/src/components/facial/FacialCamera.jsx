import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { 
  Camera, 
  RotateCw, 
  Circle, 
  Check, 
  X, 
  AlertCircle, 
  Zap, 
  Shield, 
  Loader2, 
  Timer,
  CameraOff,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  Upload,
  AlertTriangle,
  Sparkles
} from 'lucide-react';

const FacialCamera = ({ 
  onCapture, 
  onCancel,
  mode = 'capture',
  title = 'Reconnaissance Faciale',
  showInstructions = true,
  autoCapture = false,
  showDebug = false,
  autoCaptureDelay = 2000,
  enableFaceGuide = true,
  employeeId = null,
  onMultipleCapture,
  captureType = 'single'
}) => {
  const webcamRef = useRef(null);
  const streamRef = useRef(null);
  
  // Utiliser useRef pour les fonctions avec références circulaires
  const captureRef = useRef(null);
  const startAutoCaptureCountdownRef = useRef(null);
  const startMultipleCaptureRef = useRef(null);
  
  const [facingMode, setFacingMode] = useState('user');
  const [capturedImage, setCapturedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('initializing');
  const [captureAttempts, setCaptureAttempts] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [autoCaptureTimer, setAutoCaptureTimer] = useState(null);
  const [autoCaptureCountdown, setAutoCaptureCountdown] = useState(0);
  const [captureQuality, setCaptureQuality] = useState(null);
  
  // NOUVEAUX ÉTATS POUR CAPTURE MULTIPLE
  const [captureMode, setCaptureMode] = useState(captureType);
  const [multiplePhotos, setMultiplePhotos] = useState([]);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [registrationStatus, setRegistrationStatus] = useState('idle');
  const [isCapturingMultiple, setIsCapturingMultiple] = useState(false);
  
  // Instructions pour chaque étape de capture multiple
  const captureInstructions = [
    { 
      id: 1, 
      text: 'Position neutre - regardez droit devant',
      hint: 'Gardez une expression naturelle',
      angle: 'face'
    },
    { 
      id: 2, 
      text: 'Tournez légèrement la tête vers la gauche',
      hint: 'Environ 20 degrés',
      angle: 'left'
    },
    { 
      id: 3, 
      text: 'Tournez légèrement la tête vers la droite',
      hint: 'Environ 20 degrés',
      angle: 'right'
    },
    { 
      id: 4, 
      text: 'Regardez légèrement vers le haut',
      hint: 'Léger mouvement',
      angle: 'up'
    },
    { 
      id: 5, 
      text: 'Regardez légèrement vers le bas',
      hint: 'Léger mouvement',
      angle: 'down'
    }
  ];

  const videoConstraints = {
    width: { ideal: 640, min: 320, max: 1280 },
    height: { ideal: 480, min: 240, max: 720 },
    facingMode: facingMode,
    frameRate: { ideal: 15, max: 30 },
    aspectRatio: { ideal: 4/3 }
  };

  // ==================== FONCTIONS DE BASE ====================

  const detectCameras = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        return [];
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameraDevices(videoDevices);
      
      return videoDevices;
    } catch (err) {
      console.error('❌ Erreur détection caméras:', err);
      return [];
    }
  }, []);

  const evaluateCaptureQuality = (imageData) => {
    try {
      const sizeKB = Math.round(imageData.length / 1024);
      let qualityScore = 100;
      let feedback = [];
      
      if (sizeKB < 30) {
        qualityScore -= 30;
        feedback.push('Image trop petite');
      } else if (sizeKB > 300) {
        qualityScore -= 10;
        feedback.push('Image très volumineuse');
      }
      
      if (!imageData.startsWith('data:image/jpeg') && !imageData.startsWith('data:image/png')) {
        qualityScore = 0;
        feedback.push('Format d\'image non supporté');
      }
      
      let qualityLevel = 'excellent';
      if (qualityScore >= 80) qualityLevel = 'excellent';
      else if (qualityScore >= 60) qualityLevel = 'good';
      else if (qualityScore >= 40) qualityLevel = 'acceptable';
      else qualityLevel = 'poor';
      
      return {
        score: qualityScore,
        level: qualityLevel,
        sizeKB,
        feedback,
        isGood: qualityScore >= 60
      };
    } catch (err) {
      return {
        score: 0,
        level: 'unknown',
        sizeKB: 0,
        feedback: ['Erreur d\'évaluation'],
        isGood: false
      };
    }
  };

  const captureImage = useCallback(async () => {
    if (!webcamRef.current || !isCameraReady) {
      throw new Error('Caméra non prête');
    }

    try {
      const screenshot = webcamRef.current.getScreenshot({
        width: 640,
        height: 480,
        screenshotQuality: 0.9
      });

      if (!screenshot || !screenshot.startsWith('data:image/')) {
        throw new Error('Capture invalide');
      }

      const quality = evaluateCaptureQuality(screenshot);
      setCaptureQuality(quality);
      return screenshot;

    } catch (primaryError) {
      console.warn('⚠️ Méthode principale échouée:', primaryError);
      
      if (!webcamRef.current.video) {
        throw new Error('Élément vidéo non disponible');
      }
      
      const video = webcamRef.current.video;
      const canvas = document.createElement('canvas');
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Contexte canvas non disponible');
      }
      
      if (facingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      
      ctx.drawImage(video, 0, 0, width, height);
      
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * 1.1);
        data[i + 1] = Math.min(255, data[i + 1] * 1.1);
        data[i + 2] = Math.min(255, data[i + 2] * 1.1);
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const quality = evaluateCaptureQuality(imageDataUrl);
      setCaptureQuality(quality);
      return imageDataUrl;
    }
  }, [facingMode, isCameraReady]);

  // ==================== CAPTURE MULTIPLE ====================

  const captureMultiplePhotos = useCallback(async () => {
    if (!isCameraReady || cameraStatus !== 'ready') {
      throw new Error('Caméra non prête pour capture multiple');
    }

    setIsCapturingMultiple(true);
    setMultiplePhotos([]);
    setRegistrationStatus('capturing');
    setCaptureProgress(0);
    
    const capturedPhotos = [];
    const totalSteps = 5;
    
    try {
      for (let i = 0; i < totalSteps; i++) {
        setCurrentStep(i);
        setCaptureProgress(((i + 1) / totalSteps) * 100);
        
        if (i > 0) {
          setRegistrationStatus('waiting');
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        setRegistrationStatus('capturing');
        setFlash(true);
        
        const imageData = await captureImage();
        const quality = evaluateCaptureQuality(imageData);
        
        capturedPhotos.push({
          id: `photo_${i + 1}`,
          data: imageData,
          quality: quality,
          step: i + 1,
          instruction: captureInstructions[i],
          timestamp: new Date().toISOString()
        });
        
        setMultiplePhotos([...capturedPhotos]);
        setFlash(false);
        
        if (i < totalSteps - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      setRegistrationStatus('completed');
      setCaptureProgress(100);
      
      console.log(`✅ Capture multiple terminée: ${capturedPhotos.length} photos`);
      return capturedPhotos;
      
    } catch (error) {
      console.error('❌ Erreur capture multiple:', error);
      setRegistrationStatus('error');
      setError(`Échec capture multiple: ${error.message}`);
      return null;
    } finally {
      setIsCapturingMultiple(false);
    }
  }, [isCameraReady, cameraStatus, captureImage, captureInstructions]);

  // ==================== GESTION CAPTURE AUTOMATIQUE ====================

  const stopAutoCaptureCountdown = useCallback(() => {
    if (autoCaptureTimer) {
      clearInterval(autoCaptureTimer);
      setAutoCaptureTimer(null);
      setAutoCaptureCountdown(0);
    }
  }, [autoCaptureTimer]);

  // ==================== FONCTIONS PRINCIPALES ====================

  // Fonction de capture (stockée dans useRef pour éviter les références circulaires)
  const capture = useCallback(async () => {
    if (cameraStatus === 'error' || cameraStatus === 'denied' || cameraStatus === 'no-camera') {
      setError(`Caméra non disponible (${cameraStatus}). Veuillez réinitialiser.`);
      return;
    }

    if (!isCameraReady) {
      setError('Veuillez attendre que la caméra soit complètement initialisée.');
      return;
    }

    stopAutoCaptureCountdown();
    
    setFlash(true);
    setError(null);
    setIsLoading(true);
    setCaptureAttempts(prev => prev + 1);

    try {
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log(`📸 Tentative de capture #${captureAttempts + 1}`);
      
      const imageData = await captureImage();
      
      const debugData = {
        method: 'success',
        sizeKB: Math.round(imageData.length / 1024),
        timestamp: new Date().toISOString(),
        attempts: captureAttempts + 1,
        cameraStatus,
        isCameraReady,
        quality: captureQuality
      };
      
      if (showDebug) {
        setDebugInfo(debugData);
      }
      
      setCapturedImage(imageData);
      
      if (onCapture) {
        setTimeout(() => {
          onCapture(imageData, captureQuality);
        }, 300);
      }

    } catch (err) {
      console.error('❌ Capture échouée:', err);
      
      let userMessage = 'Échec de la capture. ';
      
      if (err.message.includes('non prête')) {
        userMessage = 'Caméra non prête. Veuillez réessayer.';
      } else if (err.message.includes('invalide')) {
        userMessage = 'Image invalide capturée.';
      } else if (err.message.includes('Élément')) {
        userMessage = 'Problème technique avec la caméra.';
      }
      
      userMessage += ' Veuillez réessayer.';
      
      setError(userMessage);
      
      if (autoCapture && !capturedImage) {
        setTimeout(() => {
          if (startAutoCaptureCountdownRef.current) {
            startAutoCaptureCountdownRef.current();
          }
        }, 3000);
      }
      
    } finally {
      setTimeout(() => setFlash(false), 300);
      setIsLoading(false);
    }
  }, [captureImage, onCapture, cameraStatus, isCameraReady, captureAttempts, showDebug, autoCapture, capturedImage, captureQuality, stopAutoCaptureCountdown]);

  // Fonction de démarrage capture multiple
  const startMultipleCapture = useCallback(async () => {
    if (!isCameraReady || cameraStatus !== 'ready') {
      setError('Caméra non prête. Veuillez réinitialiser.');
      return;
    }

    stopAutoCaptureCountdown();
    setError(null);
    setIsLoading(true);
    
    try {
      const photos = await captureMultiplePhotos();
      
      if (photos && photos.length > 0) {
        setCapturedImage(photos[photos.length - 1].data);
        
        if (onMultipleCapture) {
          onMultipleCapture(photos);
        } else if (onCapture) {
          onCapture(photos[photos.length - 1].data, photos[photos.length - 1].quality);
        }
      }
    } catch (error) {
      console.error('❌ Erreur capture multiple:', error);
      setError(`Échec capture multiple: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [isCameraReady, cameraStatus, stopAutoCaptureCountdown, captureMultiplePhotos, onMultipleCapture, onCapture]);

  // Fonction de démarrage compte à rebours
  const startAutoCaptureCountdown = useCallback(() => {
    if (!autoCapture || capturedImage || !isCameraReady) return;
    
    console.log('⏱️ Démarrage compte à rebours capture automatique...');
    
    let countdown = Math.floor(autoCaptureDelay / 1000);
    setAutoCaptureCountdown(countdown);
    
    const timer = setInterval(() => {
      setAutoCaptureCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setAutoCaptureTimer(null);
          
          if (!isLoading && !capturedImage) {
            console.log('🤖 Capture automatique déclenchée!');
            if (captureMode === 'multiple') {
              startMultipleCapture();
            } else {
              capture();
            }
          }
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    setAutoCaptureTimer(timer);
  }, [autoCapture, capturedImage, isCameraReady, isLoading, autoCaptureDelay, captureMode, startMultipleCapture, capture]);

  // ==================== STOCKER LES RÉFÉRENCES ====================

  useEffect(() => {
    // Stocker les références des fonctions
    captureRef.current = capture;
    startAutoCaptureCountdownRef.current = startAutoCaptureCountdown;
    startMultipleCaptureRef.current = startMultipleCapture;
  }, [capture, startAutoCaptureCountdown, startMultipleCapture]);

  // ==================== GESTION DU FLUX VIDÉO ====================

  const handleUserMedia = useCallback((stream) => {
    console.log('🎥 Flux média reçu via Webcam component');
    
    // Stocker la référence
    streamRef.current = stream;
    
    // Vérifier si la vidéo est déjà prête
    const checkVideoReady = () => {
      if (webcamRef.current?.video) {
        const video = webcamRef.current.video;
        
        if (video.readyState >= 2) { // HAVE_ENOUGH_DATA
          console.log('✅ Élément vidéo prêt, dimensions:', video.videoWidth, 'x', video.videoHeight);
          
          setIsCameraReady(true);
          setCameraStatus('ready');
          setError(null);
          
          if (autoCapture && !capturedImage) {
            startAutoCaptureCountdown();
          }
          
          return true;
        }
      }
      return false;
    };
    
    // Vérifier immédiatement
    if (checkVideoReady()) {
      return;
    }
    
    // Vérifier périodiquement
    const interval = setInterval(() => {
      if (checkVideoReady()) {
        clearInterval(interval);
      }
    }, 100);
    
    // Timeout de sécurité
    setTimeout(() => {
      clearInterval(interval);
      console.log('⚠️ Timeout vérification vidéo, forcer état prêt');
      setIsCameraReady(true);
      setCameraStatus('ready');
      
      if (autoCapture && !capturedImage) {
        startAutoCaptureCountdown();
      }
    }, 5000);
    
  }, [autoCapture, capturedImage, startAutoCaptureCountdown]);

  const handleUserMediaError = useCallback((error) => {
    console.error('❌ Erreur flux média:', error);
    setCameraStatus('error');
    setIsCameraReady(false);
    setHasPermission(false);
    
    let errorMessage = 'Erreur de flux vidéo. ';
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Accès à la caméra refusé. Veuillez autoriser l\'accès dans les paramètres de votre navigateur.';
      setCameraStatus('denied');
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'Aucune caméra trouvée. Vérifiez votre connexion.';
      setCameraStatus('no-camera');
    } else {
      errorMessage += error.message;
    }
    
    setError(errorMessage);
  }, []);

  const retake = () => {
    if (captureMode === 'multiple') {
      setMultiplePhotos([]);
      setCaptureProgress(0);
      setCurrentStep(0);
      setRegistrationStatus('idle');
    }
    
    setCapturedImage(null);
    setError(null);
    setDebugInfo(null);
    setCaptureQuality(null);
    
    if (autoCapture && isCameraReady) {
      startAutoCaptureCountdown();
    }
  };

  const switchCamera = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    setCapturedImage(null);
    setMultiplePhotos([]);
    setError(null);
    setDebugInfo(null);
    setCaptureQuality(null);
    setIsCameraReady(false);
    setCameraStatus('switching');
    setCaptureProgress(0);
    setCurrentStep(0);
    setRegistrationStatus('idle');
    
    stopAutoCaptureCountdown();
  };

  const handleConfirm = () => {
    if (captureMode === 'multiple' && multiplePhotos.length > 0) {
      if (onMultipleCapture) {
        onMultipleCapture(multiplePhotos);
      }
    } else if (capturedImage && onCapture) {
      onCapture(capturedImage, captureQuality);
    }
  };

  const resetCamera = async () => {
    setIsCameraReady(false);
    setCameraStatus('initializing');
    setError(null);
    setCapturedImage(null);
    setMultiplePhotos([]);
    setCaptureQuality(null);
    setCaptureAttempts(0);
    setCaptureProgress(0);
    setCurrentStep(0);
    setRegistrationStatus('idle');
    
    stopAutoCaptureCountdown();
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setTimeout(() => {
      setCameraStatus('ready');
      setIsCameraReady(true);
    }, 1000);
  };

  const toggleCaptureMode = () => {
    const newMode = captureMode === 'single' ? 'multiple' : 'single';
    setCaptureMode(newMode);
    setCapturedImage(null);
    setMultiplePhotos([]);
    setCaptureProgress(0);
    setCurrentStep(0);
    setRegistrationStatus('idle');
    setError(null);
    
    if (newMode === 'multiple' && autoCapture && isCameraReady && !capturedImage) {
      setTimeout(() => startMultipleCapture(), 1000);
    }
  };

  // ==================== RENDU DES PHOTOS MULTIPLES ====================

  const renderMultiplePhotosPreview = () => {
    if (multiplePhotos.length === 0) return null;

    return (
      <div className="mb-6 p-4 bg-gray-800/30 rounded-xl border border-gray-700/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-400" />
            Photos capturées ({multiplePhotos.length}/5)
          </h3>
          {captureProgress > 0 && captureProgress < 100 && (
            <div className="text-sm text-blue-300 font-medium">
              Progression: {Math.round(captureProgress)}%
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-5 gap-3">
          {captureInstructions.map((instruction, index) => {
            const photo = multiplePhotos.find(p => p.step === index + 1);
            const isCurrentStep = index === currentStep && isCapturingMultiple;
            
            return (
              <div 
                key={instruction.id} 
                className={`relative rounded-lg overflow-hidden border-2 ${
                  photo 
                    ? 'border-green-500/50' 
                    : isCurrentStep 
                      ? 'border-blue-500 animate-pulse' 
                      : 'border-gray-700/50'
                } ${isCurrentStep ? 'bg-blue-900/20' : 'bg-gray-900/50'}`}
              >
                {photo ? (
                  <div className="aspect-square relative">
                    <img 
                      src={photo.data} 
                      alt={`Photo ${instruction.id}`} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    {photo.quality && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm p-1">
                        <div className="text-xs text-center">
                          <span className={`font-medium ${
                            photo.quality.level === 'excellent' ? 'text-green-400' :
                            photo.quality.level === 'good' ? 'text-yellow-400' :
                            photo.quality.level === 'acceptable' ? 'text-orange-400' :
                            'text-red-400'
                          }`}>
                            {photo.quality.level.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-square flex flex-col items-center justify-center p-3 bg-gradient-to-br from-gray-800 to-gray-900">
                    <div className="w-8 h-8 mb-2 rounded-full bg-gray-700/50 flex items-center justify-center">
                      {isCurrentStep ? (
                        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                      ) : (
                        <div className="text-gray-500 font-bold text-lg">{index + 1}</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 text-center">
                      {isCurrentStep ? (
                        <span className="text-blue-300 font-medium">En cours...</span>
                      ) : (
                        instruction.angle
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {isCapturingMultiple && (
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="text-blue-300 font-medium">
                Étape {currentStep + 1}/5: {captureInstructions[currentStep].text}
              </div>
              <div className="text-sm text-blue-400">
                {captureInstructions[currentStep].hint}
              </div>
            </div>
            <div className="w-full bg-blue-900/30 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${captureProgress}%` }}
              ></div>
            </div>
          </div>
        )}
        
        {registrationStatus === 'completed' && multiplePhotos.length === 5 && (
          <div className="mt-4 p-3 bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-700/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-300 font-medium">
                <Check className="w-5 h-5" />
                Toutes les photos sont capturées avec succès!
              </div>
              <div className="text-sm text-green-400">
                Qualité moyenne: {(() => {
                  const avgScore = multiplePhotos.reduce((sum, p) => sum + (p.quality?.score || 0), 0) / multiplePhotos.length;
                  if (avgScore >= 80) return 'EXCELLENT';
                  if (avgScore >= 60) return 'BONNE';
                  if (avgScore >= 40) return 'ACCEPTABLE';
                  return 'INSUFFISANTE';
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==================== RENDU DU FLUX CAMÉRA ====================

  const renderCameraFeed = () => {
    if (cameraStatus === 'error' || cameraStatus === 'denied') {
      return (
        <div className="text-center p-10">
          <div className="w-20 h-20 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CameraOff className="w-10 h-10 text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-red-300 mb-2">Caméra non disponible</h3>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={resetCamera}
            className="px-6 py-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 rounded-lg text-white font-medium transition-all"
          >
            Réessayer
          </button>
        </div>
      );
    }

    if (cameraStatus === 'no-camera') {
      return (
        <div className="text-center p-10">
          <div className="w-20 h-20 bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-yellow-400" />
          </div>
          <h3 className="text-xl font-bold text-yellow-300 mb-2">Caméra non détectée</h3>
          <p className="text-gray-400 mb-4">Vérifiez que votre caméra est bien connectée.</p>
          <button
            onClick={resetCamera}
            className="px-6 py-2 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 rounded-lg text-white font-medium transition-all"
          >
            Rechercher à nouveau
          </button>
        </div>
      );
    }

    if (cameraStatus === 'initializing' || cameraStatus === 'switching') {
      return (
        <div className="text-center p-10">
          <div className="w-20 h-20 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-blue-300 mb-2">
            {cameraStatus === 'switching' ? 'Changement de caméra...' : 'Initialisation de la caméra...'}
          </h3>
          <p className="text-gray-400">Veuillez patienter</p>
        </div>
      );
    }

    if (cameraStatus === 'ready' && !isCameraReady) {
      return (
        <div className="text-center p-10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Camera className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Démarrage de la caméra</h3>
          <p className="text-gray-400 mb-4">Veuillez patienter quelques secondes...</p>
          <div className="inline-flex items-center gap-2 text-blue-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Chargement du flux vidéo</span>
          </div>
        </div>
      );
    }

    // Effet de flash
    const flashStyle = {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'white',
      opacity: flash ? 0.8 : 0,
      transition: 'opacity 0.3s',
      pointerEvents: 'none',
      zIndex: 10
    };

    return (
      <>
        <div style={flashStyle} />
        
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          onUserMedia={handleUserMedia}
          onUserMediaError={handleUserMediaError}
          className="w-full h-auto max-h-[400px] object-contain"
          mirrored={facingMode === 'user'}
        />
        
        {/* Cadre de guidage */}
        {enableFaceGuide && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-64 h-72">
              {/* Cadre principal */}
              <div className="absolute inset-0 border-2 border-blue-400/50 rounded-3xl"></div>
              
              {/* Points de guidage */}
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-blue-400 rounded-full"></div>
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-blue-400 rounded-full"></div>
              <div className="absolute top-1/2 -left-2 transform -translate-y-1/2 w-4 h-4 bg-blue-400 rounded-full"></div>
              <div className="absolute top-1/2 -right-2 transform -translate-y-1/2 w-4 h-4 bg-blue-400 rounded-full"></div>
              
              {/* Lignes de guidage */}
              <div className="absolute top-1/3 left-1/4 right-1/4 h-1 bg-blue-400/30 rounded-full"></div>
              <div className="absolute top-2/3 left-1/4 right-1/4 h-1 bg-blue-400/30 rounded-full"></div>
              <div className="absolute left-1/3 top-1/4 bottom-1/4 w-1 bg-blue-400/30 rounded-full"></div>
              <div className="absolute right-1/3 top-1/4 bottom-1/4 w-1 bg-blue-400/30 rounded-full"></div>
              
              {/* Indicateur de position faciale */}
              <div className="absolute top-1/3 left-1/3 right-1/3 bottom-1/3 border border-green-400/30 rounded-full"></div>
            </div>
            
            {/* Instructions en bas */}
            {captureMode === 'multiple' && isCapturingMultiple && (
              <div className="absolute bottom-8 left-0 right-0 text-center">
                <div className="inline-block bg-black/70 backdrop-blur-sm py-3 px-6 rounded-full animate-pulse">
                  <p className="text-white font-medium">
                    Étape {currentStep + 1}/5: {captureInstructions[currentStep]?.text}
                  </p>
                  <p className="text-gray-300 text-sm mt-1">
                    {captureInstructions[currentStep]?.hint}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Mode capture multiple - instructions */}
        {captureMode === 'multiple' && !isCapturingMultiple && multiplePhotos.length === 0 && (
          <div className="absolute bottom-8 left-0 right-0 text-center">
            <div className="inline-block bg-gradient-to-r from-blue-900/70 to-purple-900/70 backdrop-blur-sm py-3 px-6 rounded-xl border border-blue-500/30">
              <p className="text-white font-medium flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                Mode capture multiple activé
              </p>
              <p className="text-gray-300 text-sm mt-1">
                Le système capturera automatiquement 5 photos sous différents angles
              </p>
            </div>
          </div>
        )}
      </>
    );
  };

  // ==================== USE EFFECTS ====================

  // Vérifier les permissions et initialiser
  useEffect(() => {
    let mounted = true;
    let stream = null;
    
    const initializeCamera = async () => {
      try {
        console.log('🔍 Initialisation de la caméra...');
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Votre navigateur ne supporte pas l\'accès à la caméra');
        }

        // D'abord, vérifier les caméras disponibles
        const devices = await detectCameras();
        if (devices.length === 0 && mounted) {
          setCameraStatus('no-camera');
          setError('Aucune caméra détectée');
          return;
        }

        console.log(`📷 ${devices.length} caméra(s) disponible(s)`);

        // Obtenir le flux vidéo
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            facingMode: facingMode,
            width: { ideal: 640 },
            height: { ideal: 480 }
          } 
        });
        
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        console.log('✅ Flux vidéo obtenu avec succès');
        
        // Stocker la référence du stream
        streamRef.current = stream;
        
        // Marquer comme prêt
        setHasPermission(true);
        setCameraStatus('ready');
        setError(null);
        
        // Simuler un délai pour la préparation visuelle
        setTimeout(() => {
          if (mounted) {
            setIsCameraReady(true);
            console.log('🎥 Caméra prête à l\'utilisation');
          }
        }, 1000);
        
      } catch (err) {
        if (!mounted) return;
        
        console.error('❌ Erreur initialisation caméra:', err);
        
        let errorMessage = 'Erreur d\'accès à la caméra. ';
        let status = 'error';
        
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Permission refusée. Veuillez autoriser l\'accès à la caméra.';
          status = 'denied';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'Aucune caméra n\'a été trouvée.';
          status = 'no-camera';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'La caméra est déjà utilisée par une autre application.';
        } else {
          errorMessage += err.message;
        }
        
        setError(errorMessage);
        setCameraStatus(status);
      }
    };

    // Démarrer l'initialisation
    initializeCamera();
    
    return () => {
      console.log('🧹 Nettoyage du useEffect d\'initialisation');
      mounted = false;
      
      // Ne pas arrêter le stream ici, laissez-le pour le composant
      // Le nettoyage sera fait dans l'autre useEffect de nettoyage
    };
  }, [facingMode, detectCameras]);

  // Capture automatique
  useEffect(() => {
    if (autoCapture && !capturedImage && isCameraReady && cameraStatus === 'ready' && !autoCaptureTimer) {
      console.log('🤖 Activation capture automatique...');
      startAutoCaptureCountdown();
    }
    
    return () => {
      stopAutoCaptureCountdown();
    };
  }, [autoCapture, capturedImage, isCameraReady, cameraStatus, autoCaptureTimer, startAutoCaptureCountdown, stopAutoCaptureCountdown]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      console.log('🧹 Nettoyage complet du composant FacialCamera');
      
      // Arrêter le compte à rebours
      stopAutoCaptureCountdown();
      
      // Arrêter le flux vidéo seulement si le composant est démonté
      if (streamRef.current) {
        console.log('   - Arrêt du flux vidéo');
        streamRef.current.getTracks().forEach(track => {
          console.log(`     * Arrêt track: ${track.kind} (${track.label || 'sans nom'})`);
          track.stop();
        });
        streamRef.current = null;
      }
    };
  }, [stopAutoCaptureCountdown]);

  // ==================== RENDU PRINCIPAL ====================

  return (
    <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl max-w-2xl mx-auto border border-gray-800">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center">
            <Camera className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            {mode === 'attendance' && (
              <p className="text-gray-400 text-sm">Pointage par reconnaissance faciale</p>
            )}
            {employeeId && (
              <p className="text-blue-400 text-sm">Enregistrement pour: {employeeId}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Bouton pour changer le mode de capture */}
          <button
            onClick={toggleCaptureMode}
            disabled={isLoading || isCapturingMultiple || capturedImage}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              captureMode === 'multiple' 
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            } ${(isLoading || isCapturingMultiple || capturedImage) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {captureMode === 'single' ? (
              <>
                <Sparkles className="w-4 h-4 inline mr-2" />
                Mode Multiple (5 photos)
              </>
            ) : (
              <>
                <Camera className="w-4 h-4 inline mr-2" />
                Mode Simple
              </>
            )}
          </button>
          
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-2 rounded-full hover:bg-gray-800 transition-colors"
              disabled={isLoading}
              aria-label="Fermer"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Zone caméra */}
      <div className="relative bg-black rounded-xl overflow-hidden mb-6 min-h-[400px] flex items-center justify-center border border-gray-800">
        {capturedImage ? (
          <div className="relative w-full h-full">
            <img 
              src={capturedImage} 
              alt="Photo capturée" 
              className="w-full h-auto max-h-[400px] object-contain rounded-xl"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-xl"></div>
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <div className="inline-flex items-center gap-2 bg-black/70 backdrop-blur-sm py-2 px-4 rounded-full">
                <Check className="w-5 h-5 text-green-400" />
                <p className="text-white font-medium">
                  {captureMode === 'multiple' 
                    ? `${multiplePhotos.length} photos capturées avec succès` 
                    : 'Photo capturée avec succès'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          renderCameraFeed()
        )}
      </div>

      {/* Prévisualisation photos multiples */}
      {captureMode === 'multiple' && renderMultiplePhotosPreview()}

      {/* Debug info */}
      {showDebug && debugInfo && (
        <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
          <div className="text-xs font-mono text-gray-400 space-y-1">
            <div><strong>État:</strong> {cameraStatus}</div>
            <div><strong>Prêt:</strong> {isCameraReady ? '✅' : '❌'}</div>
            <div><strong>Mode:</strong> {captureMode}</div>
            <div><strong>Tentatives:</strong> {debugInfo.attempts}</div>
            <div><strong>Taille:</strong> {debugInfo.sizeKB} KB</div>
            <div><strong>Qualité:</strong> {debugInfo.quality?.level || 'N/A'}</div>
            <div><strong>Time:</strong> {new Date(debugInfo.timestamp).toLocaleTimeString()}</div>
          </div>
        </div>
      )}

      {/* Messages d'erreur */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-xl animate-pulse">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 font-medium">{error}</p>
              <p className="text-red-300/80 text-sm mt-1">
                Vérifiez que la caméra est bien connectée et que vous avez accordé les permissions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Boutons de contrôle */}
      <div className="flex flex-col sm:flex-row gap-4">
        {!capturedImage ? (
          <>
            {cameraDevices.length > 1 && (
              <button
                onClick={switchCamera}
                disabled={isLoading || cameraStatus !== 'ready' || !isCameraReady || isCapturingMultiple}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-all"
              >
                <RotateCw className="w-5 h-5" />
                Changer caméra
              </button>
            )}
            
            <button
              onClick={captureMode === 'multiple' ? startMultipleCapture : capture}
              disabled={isLoading || !isCameraReady || cameraStatus !== 'ready' || isCapturingMultiple}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 ${
                isCameraReady && cameraStatus === 'ready'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500'
                  : 'bg-blue-800 cursor-not-allowed'
              } disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold text-lg transition-all shadow-lg hover:shadow-xl active:scale-95`}
            >
              {isLoading || isCapturingMultiple ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {isCapturingMultiple 
                    ? `Capture ${currentStep + 1}/5...` 
                    : 'Capture en cours...'}
                </>
              ) : (
                <>
                  <Circle className="w-6 h-6" fill="white" />
                  {isCameraReady ? (
                    captureMode === 'multiple' 
                      ? 'Capturer 5 photos automatiquement' 
                      : (autoCapture ? 'Capturer maintenant' : 'Capturer la photo')
                  ) : 'Caméra en préparation...'}
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={retake}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-all"
            >
              <RotateCw className="w-5 h-5" />
              {captureMode === 'multiple' ? 'Reprendre toutes les photos' : 'Reprendre une photo'}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold text-lg transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              <Check className="w-6 h-6" />
              {captureMode === 'multiple' ? 'Confirmer et enregistrer' : 'Valider et continuer'}
            </button>
          </>
        )}
      </div>

      {/* Instructions */}
      {showInstructions && (
        <div className="mt-8 space-y-4">
          {captureMode === 'multiple' && multiplePhotos.length > 0 && multiplePhotos.length < 5 && (
            <div className="p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-xl">
              <h3 className="text-yellow-300 font-medium mb-2 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Enregistrement multiple en cours:
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-yellow-200">Progression:</span>
                  <span className="text-yellow-300 font-bold">{multiplePhotos.length}/5 photos</span>
                </div>
                <div className="w-full bg-yellow-900/30 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-yellow-500 to-yellow-300 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(multiplePhotos.length / 5) * 100}%` }}
                  ></div>
                </div>
                <p className="text-yellow-200/80 text-sm">
                  Continuez jusqu'à ce que les 5 photos soient capturées sous différents angles.
                </p>
              </div>
            </div>
          )}
          
          <div className="p-4 bg-blue-900/20 border border-blue-700/30 rounded-xl">
            <h3 className="text-blue-300 font-medium mb-2 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {captureMode === 'multiple' 
                ? 'Pour une meilleure reconnaissance multiple:' 
                : 'Pour une meilleure reconnaissance:'}
            </h3>
            <ul className="text-blue-200/80 text-sm space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>Éclairage uniforme sans contre-jour</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>Visage découvert (pas de lunettes de soleil)</span>
              </li>
              {captureMode === 'multiple' && (
                <>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span className="text-blue-300 font-medium">Le système capturera automatiquement 5 photos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Suivez les instructions pour chaque position</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Gardez une expression naturelle et détendue</span>
                  </li>
                </>
              )}
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>Distance de 50 à 80 cm de la caméra</span>
              </li>
            </ul>
          </div>
          
          {/* Bouton de débogage */}
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                console.log('🔄 Forcer réinitialisation manuelle');
                resetCamera();
              }}
              className="text-sm text-gray-400 hover:text-gray-300 underline"
            >
              Problème avec la caméra ? Cliquez ici
            </button>
          </div>
          
          {captureMode === 'multiple' && (
            <div className="p-4 bg-purple-900/20 border border-purple-700/30 rounded-xl">
              <h3 className="text-purple-300 font-medium mb-2 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Avantages du mode multiple:
              </h3>
              <ul className="text-purple-200/80 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-1">✓</span>
                  <span>5x plus de précision dans la reconnaissance</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-1">✓</span>
                  <span>Reconnaissance sous différents angles</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-1">✓</span>
                  <span>Meilleure tolérance aux variations d'éclairage</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-1">✓</span>
                  <span>Enregistrement unique, reconnaissance fiable</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Statut */}
      <div className="mt-6 pt-4 border-t border-gray-800/50">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              cameraStatus === 'error' || cameraStatus === 'denied' ? 'bg-red-500 animate-pulse' : 
              cameraStatus === 'ready' && isCameraReady ? 'bg-green-500' : 
              'bg-yellow-500 animate-pulse'
            }`} />
            <span className={`${
              cameraStatus === 'error' || cameraStatus === 'denied' ? 'text-red-400' : 
              cameraStatus === 'ready' && isCameraReady ? 'text-green-400' : 
              'text-yellow-400'
            }`}>
              {cameraStatus === 'error' ? 'Erreur' : 
               cameraStatus === 'denied' ? 'Permission refusée' :
               cameraStatus === 'no-camera' ? 'Caméra non trouvée' :
               cameraStatus === 'ready' && isCameraReady ? 'Système prêt' : 
               'Initialisation'}
            </span>
          </div>
          <span className="text-gray-500">
            {capturedImage ? (
              captureMode === 'multiple' 
                ? `✓ ${multiplePhotos.length} photos prêtes` 
                : '✓ Photo prête'
            ) : 
             isCameraReady ? (
               isCapturingMultiple 
                 ? `Capture multiple: Étape ${currentStep + 1}/5` 
                 : (autoCapture && autoCaptureCountdown > 0 
                   ? `Auto-capture: ${autoCaptureCountdown}s` 
                   : '✓ Caméra active')
             ) : 
             'Chargement...'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default FacialCamera;