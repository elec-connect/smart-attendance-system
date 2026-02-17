import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  UserCheck, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Maximize2,
  Minimize2,
  RefreshCw,
  Home,
  Clock,
  Shield,
  Users,
  ArrowRight,
  Sun,
  Moon,
  Coffee,
  Sunrise,
  Pause,
  Play,
  Power,
  X,
  Smile,
  User,
  BadgeCheck,
  Calendar,
  CheckSquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FullScreenRecognition = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isRecognitionActive, setIsRecognitionActive] = useState(true);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [status, setStatus] = useState('Initialisation de la caméra...');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [lastScanTime, setLastScanTime] = useState(null);
  const [nextScanAvailable, setNextScanAvailable] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [employeeQueue, setEmployeeQueue] = useState([]);
  const [currentShift, setCurrentShift] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const processingLock = useRef(false);
  
  // États pour la confirmation plein écran
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState({
    name: '',
    surname: '',
    employeeId: '',
    time: '',
    type: 'entrée',
    confidence: 0,
    shift: '',
    date: ''
  });
  const [confirmationTimeout, setConfirmationTimeout] = useState(null);

  // Fonction pour déterminer le shift actuel
  const getCurrentShift = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentTime = now.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    // Déterminer le shift en fonction de l'heure actuelle
    if (currentHour >= 8 && currentHour < 17) {
      return {
        id: 1,
        name: 'Shift Standard',
        start: '08:00',
        end: '17:00',
        description: '8h00 - 17h00',
        icon: <Sun className="w-5 h-5" />,
        color: 'text-green-400',
        bgColor: 'bg-green-900/20',
        borderColor: 'border-green-700/30',
        iconColor: 'text-green-400'
      };
    } else if (currentHour >= 6 && currentHour < 14) {
      return {
        id: 2,
        name: 'Shift Matin',
        start: '06:00',
        end: '14:00',
        description: '6h00 - 14h00',
        icon: <Sunrise className="w-5 h-5" />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-900/20',
        borderColor: 'border-blue-700/30',
        iconColor: 'text-blue-400'
      };
    } else if (currentHour >= 14 && currentHour < 22) {
      return {
        id: 3,
        name: 'Shift Après-midi',
        start: '14:00',
        end: '22:00',
        description: '14h00 - 22h00',
        icon: <Coffee className="w-5 h-5" />,
        color: 'text-orange-400',
        bgColor: 'bg-orange-900/20',
        borderColor: 'border-orange-700/30',
        iconColor: 'text-orange-400'
      };
    } else {
      return {
        id: 4,
        name: 'Shift Nuit',
        start: '22:00',
        end: '06:00',
        description: '22h00 - 6h00',
        icon: <Moon className="w-5 h-5" />,
        color: 'text-purple-400',
        bgColor: 'bg-purple-900/20',
        borderColor: 'border-purple-700/30',
        iconColor: 'text-purple-400'
      };
    }
  };

  // Fonction pour afficher la confirmation plein écran
  const showAttendanceConfirmation = (employeeData) => {
    // Nettoyer tout timeout existant
    if (confirmationTimeout) {
      clearTimeout(confirmationTimeout);
    }

    console.log('📋 Données employé reçues:', employeeData);
    
    // Variables pour stocker les noms extraits
    let firstName = '';
    let lastName = '';
    let fullName = '';
    
    // Vérifier si les données contiennent une correspondance (match)
    if (employeeData.match) {
      // Données avec structure match
      const match = employeeData.match;
      
      // Essayer d'abord avec firstName/lastName séparés
      if (match.firstName && match.lastName) {
        firstName = match.firstName.trim();
        lastName = match.lastName.trim();
        fullName = `${firstName} ${lastName}`.trim();
      }
      // Sinon utiliser employeeName
      else if (match.employeeName) {
        const nameStr = match.employeeName.trim();
        const parts = nameStr.split(' ');
        if (parts.length >= 1) {
          firstName = parts[0];
          if (parts.length >= 2) {
            lastName = parts.slice(1).join(' ');
          }
        }
        fullName = nameStr;
      }
    }
    // Sinon, vérifier les données directes
    else if (employeeData.firstName || employeeData.lastName) {
      firstName = employeeData.firstName || '';
      lastName = employeeData.lastName || '';
      fullName = `${firstName} ${lastName}`.trim();
    }
    // Sinon, vérifier employeeName direct
    else if (employeeData.employeeName) {
      const nameStr = employeeData.employeeName.trim();
      const parts = nameStr.split(' ');
      if (parts.length >= 1) {
        firstName = parts[0];
        if (parts.length >= 2) {
          lastName = parts.slice(1).join(' ');
        }
      }
      fullName = nameStr;
    }
    // Fallback si aucun nom n'est trouvé
    else {
      firstName = 'Employé';
      lastName = '';
      fullName = 'Employé';
    }

    console.log('📝 Noms extraits:', { firstName, lastName, fullName });

    // Déterminer le type de pointage (matin = entrée, après-midi = sortie)
    const currentHour = new Date().getHours();
    const attendanceType = currentHour < 12 ? 'entrée' : 'sortie';

    // Formater la date et l'heure
    const now = new Date();
    const formattedDate = now.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const formattedTime = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // Obtenir le confidence score
    const confidenceScore = employeeData.match?.confidence || 
                          employeeData.confidence || 
                          employeeData.score || 
                          0.85;

    // Mettre à jour les données de confirmation
    setConfirmationData({
      name: firstName,
      surname: lastName,
      fullName: fullName,
      employeeId: employeeData.match?.employeeId || 
                 employeeData.employeeId || 
                 employeeData.id || 
                 'N/A',
      time: formattedTime,
      date: formattedDate,
      type: attendanceType,
      confidence: Math.round(confidenceScore * 100),
      shift: currentShift?.name || 'N/A',
      rawData: employeeData // Pour debug
    });

    // Afficher la confirmation
    setShowConfirmation(true);

    // Masquer automatiquement après 5 secondes
    const timeout = setTimeout(() => {
      setShowConfirmation(false);
    }, 5000);

    setConfirmationTimeout(timeout);
  };

  // Mettre à jour le shift toutes les minutes
  useEffect(() => {
    setCurrentShift(getCurrentShift());
    
    const interval = setInterval(() => {
      setCurrentShift(getCurrentShift());
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Démarrer la webcam
  const startCamera = async () => {
    try {
      setStatus('Démarrage de la caméra...');
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          const shift = getCurrentShift();
          setStatus(`Prêt - ${shift.name} (${shift.description})`);
        };
      }

    } catch (error) {
      console.error('Erreur webcam:', error);
      setStatus('❌ Erreur d\'accès à la caméra');
      setIsRecognitionActive(false);
    }
  };

  // Capturer une image
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Ajuster la taille du canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Dessiner l'image de la webcam
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convertir en base64
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  // Fonction utilitaire pour convertir base64 en Blob
  const dataURLtoBlob = (dataURL) => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new Blob([u8arr], { type: mime });
  };

  // Vérifier si on peut scanner
  const canScan = () => {
    if (!isRecognitionActive || isProcessing || processingLock.current || isPaused) {
      return false;
    }

    if (recognitionResult && recognitionResult.success) {
      const timeSinceResult = Date.now() - new Date(recognitionResult.timestamp).getTime();
      if (timeSinceResult < 1500) {
        return false;
      }
    }

    if (lastScanTime) {
      const timeSinceLastScan = Date.now() - lastScanTime.getTime();
      if (timeSinceLastScan < 1500) {
        return false;
      }
    }

    return true;
  };

  // Fonction pour traiter le résultat de la reconnaissance
  const handleRecognitionResult = async (result) => {
    if (result.success && result.recognized) {
      // Ajouter à l'historique des employés reconnus
      setEmployeeQueue(prev => {
        const newEmployee = {
          id: result.employeeId,
          name: result.employeeName,
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          confidence: result.confidence,
          shift: currentShift?.name || 'N/A'
        };
        return [newEmployee, ...prev.slice(0, 4)];
      });

      setRecognitionResult({
        success: true,
        recognized: true,
        employeeId: result.employeeId,
        employeeName: result.employeeName,
        message: `Bonjour ${result.employeeName}`,
        timestamp: new Date().toISOString(),
        confidence: result.confidence || 0.85,
        checkInTime: result.checkInTime,
        attendanceRecorded: result.attendanceRecorded || false,
        shift: currentShift?.name || 'N/A'
      });

      setStatus(`✅ ${result.employeeName} - Pointage ${currentShift?.name} enregistré`);

      // AFFICHER LA CONFIRMATION PLEIN ÉCRAN
      showAttendanceConfirmation(result);

      // Message disparaît automatiquement après 2.5 secondes
      setTimeout(() => {
        if (recognitionResult && recognitionResult.employeeId === result.employeeId) {
          setRecognitionResult(null);
          setStatus(`Prêt - ${currentShift?.name} (${currentShift?.description})`);
        }
      }, 2500);

      // Réactiver la reconnaissance après 2 secondes
      setTimeout(() => {
        processingLock.current = false;
        setIsProcessing(false);
      }, 2000);

    } else {
      setRecognitionResult({
        success: false,
        recognized: false,
        message: result.message || 'Visage non reconnu'
      });

      setStatus('❌ Visage non reconnu');
      
      // Message disparaît après 1.5 secondes pour les échecs
      setTimeout(() => {
        setRecognitionResult(null);
        setStatus(`Prêt - ${currentShift?.name} (${currentShift?.description})`);
        processingLock.current = false;
        setIsProcessing(false);
      }, 1500);
    }
  };

  // Reconnaissance faciale
  const performRecognition = async () => {
    if (!canScan()) {
      return;
    }

    processingLock.current = true;
    setIsProcessing(true);

    try {
      const imageData = captureImage();
      if (!imageData) {
        processingLock.current = false;
        setIsProcessing(false);
        return;
      }

      setStatus('Analyse en cours...');
      setLastScanTime(new Date());
      setScanCount(prev => prev + 1);

      console.log('📸 Image capturée');

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token non trouvé');
      }

      // Convertir base64 en Blob
      const blob = dataURLtoBlob(imageData);
      
      // Créer FormData
      const formData = new FormData();
      formData.append('photo', blob, 'face_capture.jpg');
      
      console.log('🚀 Envoi avec FormData, taille blob:', blob.size, 'bytes');

      // Essayer d'abord avec l'endpoint recognize-and-attend
      let response;
      try {
        response = await fetch('http://localhost:5000/api/facial/recognize-and-attend', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
      } catch (fetchError) {
        console.error('❌ Erreur fetch:', fetchError);
        throw new Error(`Erreur réseau: ${fetchError.message}`);
      }

      console.log('📊 Réponse status:', response.status);

      if (!response.ok) {
        // Si l'endpoint principal échoue, essayer avec l'endpoint de secours
        console.log('🔄 Essai avec endpoint /recognize...');
        
        response = await fetch('http://localhost:5000/api/facial/recognize', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erreur HTTP:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const result = await response.json();
      console.log('✅ Réponse API:', result);

      // Traiter le résultat
      await handleRecognitionResult(result);

    } catch (error) {
      console.error('❌ Erreur reconnaissance:', error);
      
      // En cas d'erreur, essayer une méthode alternative
      try {
        console.log('🔄 Essai méthode alternative (base64 direct)...');
        
        const fallbackResponse = await fetch('http://localhost:5000/api/facial/recognize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            image: imageData.split(',')[1]
          })
        });
        
        if (fallbackResponse.ok) {
          const fallbackResult = await fallbackResponse.json();
          console.log('✅ Réponse alternative:', fallbackResult);
          await handleRecognitionResult(fallbackResult);
          return;
        }
      } catch (fallbackError) {
        console.error('❌ Méthode alternative aussi échouée:', fallbackError);
      }
      
      setRecognitionResult({
        success: false,
        recognized: false,
        message: 'Erreur de connexion',
        error: error.message
      });
      setStatus('❌ Erreur de connexion');
      
      // Réessayer après 2 secondes en cas d'erreur
      setTimeout(() => {
        setRecognitionResult(null);
        setStatus(`Prêt - ${currentShift?.name} (${currentShift?.description})`);
        processingLock.current = false;
        setIsProcessing(false);
      }, 2000);
    } finally {
      setTimeout(() => {
        processingLock.current = false;
        setIsProcessing(false);
      }, 1000);
    }
  };

  // Démarrer la reconnaissance automatique
  const startAutoRecognition = () => {
    const interval = setInterval(() => {
      if (canScan()) {
        performRecognition();
      }
    }, 2000);

    return () => clearInterval(interval);
  };

  // Reset manuel pour l'employé suivant
  const quickResetForNextEmployee = () => {
    setRecognitionResult(null);
    setIsRecognitionActive(true);
    setNextScanAvailable(0);
    setStatus(`Prêt - ${currentShift?.name} (${currentShift?.description})`);
    processingLock.current = false;
    setIsProcessing(false);
  };

  // Activer/désactiver le plein écran
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
        .then(() => setIsFullScreen(true))
        .catch(err => console.log('Erreur fullscreen:', err));
    } else {
      document.exitFullscreen()
        .then(() => setIsFullScreen(false))
        .catch(err => console.log('Erreur exit fullscreen:', err));
    }
  };

  // Bouton Pause/Play
  const togglePause = () => {
    setIsPaused(!isPaused);
    if (!isPaused) {
      setStatus('⏸️ Système en pause');
    } else {
      setStatus(`Prêt - ${currentShift?.name} (${currentShift?.description})`);
    }
  };

  // Bouton Stop - Fermer la fenêtre
  const handleStop = () => {
    // Arrêter la webcam
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    // Sortir du plein écran si actif
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    
    // Rediriger vers l'accueil
    navigate('/dashboard');
  };

  // Retour à l'accueil
  const goToHome = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    navigate('/dashboard');
  };

  // Effet d'initialisation
  useEffect(() => {
    startCamera();

    // Activer le plein écran automatiquement
    const enterFullScreen = () => {
      const elem = document.documentElement;
      if (!document.fullscreenElement && elem.requestFullscreen) {
        elem.requestFullscreen()
          .then(() => setIsFullScreen(true))
          .catch(err => console.log('Erreur auto fullscreen:', err));
      }
    };

    setTimeout(enterFullScreen, 1000);

    // Nettoyage
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (confirmationTimeout) {
        clearTimeout(confirmationTimeout);
      }
    };
  }, []);

  // Effet pour la reconnaissance automatique
  useEffect(() => {
    const cleanup = startAutoRecognition();
    return cleanup;
  }, [isRecognitionActive, recognitionResult, isProcessing, isPaused]);

  // Formater l'heure actuelle
  const currentTime = new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // Composant de confirmation plein écran
  const ConfirmationOverlay = () => {
    if (!showConfirmation) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 animate-in fade-in duration-500">
        <div className="relative w-full h-full flex flex-col items-center justify-center p-8">
          {/* Effet de fond animé */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -inset-[100px] bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-500/10 animate-pulse"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-green-900/20 via-transparent to-transparent"></div>
          </div>

          {/* Contenu principal */}
          <div className="relative z-10 text-center max-w-6xl">
            {/* Icône de succès */}
            <div className="mb-8">
              <div className="relative inline-block">
                <div className="w-40 h-40 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-2xl animate-bounce">
                  <CheckSquare className="w-24 h-24 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-lg font-bold px-6 py-2 rounded-full shadow-xl animate-pulse">
                  {confirmationData.confidence}%
                </div>
              </div>
            </div>

            {/* Nom et prénom en grand */}
            <div className="mb-6">
              <h1 className="text-8xl font-bold text-white mb-4 tracking-tight">
                {confirmationData.name}
              </h1>
              <h2 className="text-6xl font-bold text-emerald-300 mb-8 tracking-tight">
                {confirmationData.surname}
              </h2>
            </div>

            {/* Détails du pointage */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* ID Employé */}
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-700">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <BadgeCheck className="w-8 h-8 text-blue-400" />
                  <h3 className="text-2xl font-bold text-blue-400">ID</h3>
                </div>
                <p className="text-4xl font-bold text-white">
                  {confirmationData.employeeId}
                </p>
              </div>

              {/* Type de pointage */}
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-700">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <User className="w-8 h-8 text-emerald-400" />
                  <h3 className="text-2xl font-bold text-emerald-400">Pointage</h3>
                </div>
                <p className="text-4xl font-bold text-white">
                  {confirmationData.type.toUpperCase()}
                </p>
              </div>

              {/* Shift */}
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-700">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <Clock className="w-8 h-8 text-purple-400" />
                  <h3 className="text-2xl font-bold text-purple-400">Shift</h3>
                </div>
                <p className="text-4xl font-bold text-white">
                  {confirmationData.shift}
                </p>
              </div>
            </div>

            {/* Date et heure */}
            <div className="space-y-4 mb-12">
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-700">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <Calendar className="w-8 h-8 text-yellow-400" />
                  <h3 className="text-2xl font-bold text-yellow-400">Date et heure</h3>
                </div>
                <div className="space-y-3">
                  <p className="text-3xl font-bold text-white">
                    {confirmationData.date}
                  </p>
                  <p className="text-4xl font-bold text-emerald-300">
                    {confirmationData.time}
                  </p>
                </div>
              </div>
            </div>

            {/* Message de confirmation */}
            <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 backdrop-blur-sm p-8 rounded-2xl border border-emerald-700/50">
              <div className="flex items-center justify-center gap-4 mb-4">
                <Smile className="w-10 h-10 text-emerald-300" />
                <h3 className="text-3xl font-bold text-emerald-300">
                  Pointage enregistré avec succès !
                </h3>
              </div>
              <p className="text-xl text-gray-300">
                Bonne journée de travail {confirmationData.name} !
              </p>
            </div>

            {/* Timer de fermeture */}
            <div className="mt-8">
              <div className="inline-flex items-center gap-3 bg-black/50 px-6 py-3 rounded-full">
                <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                <p className="text-gray-400 text-lg">
                  Fermeture automatique dans 5 secondes
                </p>
              </div>
            </div>
          </div>

          {/* Bouton pour fermer manuellement */}
          <button
            onClick={() => setShowConfirmation(false)}
            className="absolute top-8 right-8 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-6 py-3 rounded-lg font-bold text-lg flex items-center gap-2 transition-all hover:scale-105"
          >
            <X className="w-5 h-5" />
            Fermer
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Overlay de confirmation */}
      <ConfirmationOverlay />

      {/* En-tête */}
      <div className="bg-black/80 backdrop-blur-sm border-b border-gray-800 p-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Pointage Multi-Shifts - Mode Plein Écran
              </h1>
              <p className="text-gray-400 text-sm">
                Système de pointage pour 4 horaires de travail
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Affichage du shift actuel */}
            {currentShift && (
              <div className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-lg 
                           ${currentShift.bgColor} border ${currentShift.borderColor}`}>
                <div className={currentShift.iconColor}>
                  {currentShift.icon}
                </div>
                <div>
                  <div className={`text-sm font-bold ${currentShift.color}`}>
                    {currentShift.name}
                  </div>
                  <div className="text-gray-300 text-xs">
                    {currentShift.description}
                  </div>
                </div>
              </div>
            )}
            
            {/* Boutons de contrôle */}
            <div className="flex items-center gap-2">
              {/* Bouton Pause/Play */}
              <button
                onClick={togglePause}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  isPaused 
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                    : 'bg-gray-800 hover:bg-gray-700 text-white'
                }`}
                title={isPaused ? 'Reprendre la reconnaissance' : 'Mettre en pause'}
              >
                {isPaused ? (
                  <>
                    <Play className="w-4 h-4" />
                    <span className="hidden sm:inline">Reprendre</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4" />
                    <span className="hidden sm:inline">Pause</span>
                  </>
                )}
              </button>
              
              {/* Bouton Stop */}
              <button
                onClick={handleStop}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white flex items-center gap-2"
                title="Arrêter et fermer"
              >
                <Power className="w-4 h-4" />
                <span className="hidden sm:inline">Stop</span>
              </button>
              
              {/* Bouton Plein écran */}
              <button
                onClick={toggleFullScreen}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white flex items-center gap-2"
              >
                {isFullScreen ? (
                  <>
                    <Minimize2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Plein écran</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Plein écran</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Caméra - Prend 2 colonnes */}
          <div className="lg:col-span-2">
            <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Camera className="w-5 h-5 text-blue-400" />
                    Positionnez-vous ici
                    {isPaused && (
                      <span className="ml-2 px-3 py-1 bg-yellow-900/50 text-yellow-400 text-sm rounded-full animate-pulse">
                        ⏸️ PAUSE
                      </span>
                    )}
                  </h2>
                  {currentShift && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className={`px-3 py-1 rounded-lg text-sm ${currentShift.bgColor}`}>
                        <span className={`font-medium ${currentShift.color}`}>
                          {currentShift.name}: {currentShift.description}
                        </span>
                      </div>
                      <div className="text-gray-400 text-sm">
                        Heure actuelle: {currentTime}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isProcessing && (
                    <div className="bg-blue-900/50 px-3 py-1 rounded-lg">
                      <span className="text-blue-400 text-sm font-medium animate-pulse">
                        ⚡ Analyse en cours
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative bg-black rounded-xl overflow-hidden">
                {/* Vidéo */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-[500px] object-cover"
                />

                {/* Overlay de scan */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    {/* Cercle de scan principal */}
                    <div className={`w-80 h-80 border-4 rounded-full animate-pulse ${
                      isPaused ? 'border-yellow-500/40' : 'border-green-500/40'
                    }`}></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-64 h-64 border-2 border-blue-500/30 rounded-full"></div>
                    </div>
                    {/* Point central */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <div className="w-8 h-8 bg-white/20 rounded-full"></div>
                    </div>
                  </div>
                </div>

                {/* Canvas caché */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Indicateurs en bas */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-white text-lg font-bold">
                        Scan #{scanCount}
                      </div>
                      <div className="text-gray-400 text-sm">
                        {lastScanTime ? 
                          `Dernier: ${lastScanTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}` : 
                          'En attente...'}
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-xl font-bold animate-pulse ${
                        isPaused ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        ↓
                      </div>
                      <div className="text-gray-300 text-sm">Placez-vous ici</div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={quickResetForNextEmployee}
                        className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 
                                 hover:from-green-500 hover:to-emerald-500 
                                 rounded-lg text-white font-medium flex items-center gap-2"
                        disabled={isPaused}
                      >
                        <ArrowRight className="w-4 h-4" />
                        Employé suivant
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Barre de statut */}
              <div className="mt-6">
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${
                      isPaused ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                      isProcessing 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse' 
                        : 'bg-gradient-to-r from-green-500 to-emerald-500'
                    }`}
                    style={{ 
                      width: isProcessing ? '100%' : '100%'
                    }}
                  ></div>
                </div>
                <div className="mt-3 text-center">
                  <p className={`text-xl font-bold ${
                    isPaused ? 'text-yellow-400 animate-pulse' :
                    recognitionResult?.success ? 'text-green-400' :
                    recognitionResult?.success === false ? 'text-red-400' :
                    isProcessing ? 'text-blue-400' : 'text-white'
                  }`}>
                    {status}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Panneau de droite - Résultats et informations */}
          <div className="space-y-8">
            {/* Résultat actuel */}
            {recognitionResult ? (
              <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm 
                           rounded-2xl p-6 border border-gray-700 animate-in slide-in-from-right duration-300">
                <div className="text-center">
                  {recognitionResult.success ? (
                    <>
                      <div className="relative inline-block mb-4">
                        <div className="w-24 h-24 bg-gradient-to-br from-green-600/20 to-green-400/20 
                                     rounded-2xl flex items-center justify-center shadow-2xl">
                          <CheckCircle className="w-16 h-16 text-green-400" />
                        </div>
                        <div className="absolute -top-2 -right-2 bg-green-600 text-white 
                                     text-xs font-bold px-3 py-1 rounded-full">
                          {Math.round(recognitionResult.confidence * 100)}%
                        </div>
                      </div>
                      
                      <h3 className="text-2xl font-bold text-white mb-2">
                        {recognitionResult.employeeName}
                      </h3>
                      
                      {/* Info du shift */}
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg mb-4 ${currentShift?.bgColor}`}>
                        {currentShift?.icon}
                        <span className={`text-sm font-medium ${currentShift?.color}`}>
                          {currentShift?.name}
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="bg-gray-900/50 p-3 rounded-lg">
                          <div className="text-gray-400 text-sm">ID Employé</div>
                          <div className="text-blue-400 font-bold text-xl">
                            {recognitionResult.employeeId}
                          </div>
                        </div>
                        
                        {recognitionResult.attendanceRecorded && (
                          <div className="bg-green-900/30 p-3 rounded-lg border border-green-800/30">
                            <div className="flex items-center justify-center gap-2">
                              <Clock className="w-5 h-5 text-green-400" />
                              <div>
                                <div className="text-green-300 font-medium">Pointage enregistré</div>
                                <div className="text-green-400/80 text-sm">
                                  {recognitionResult.checkInTime && 
                                    new Date(recognitionResult.checkInTime).toLocaleTimeString('fr-FR', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  }
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-24 h-24 bg-gradient-to-br from-red-600/20 to-red-400/20 
                                   rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <XCircle className="w-16 h-16 text-red-400" />
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">
                        Non reconnu
                      </h3>
                      <p className="text-red-300 mb-4">
                        {recognitionResult.message}
                      </p>
                      <div className="bg-gray-900/50 p-3 rounded-lg">
                        <p className="text-gray-300 text-sm">
                          Veuillez vous positionner correctement face à la caméra
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm 
                           rounded-2xl p-6 border border-gray-700">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-600/20 to-purple-600/20 
                               rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <UserCheck className="w-12 h-12 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {isPaused ? 'Système en pause' : 'En attente d\'employé'}
                  </h3>
                  <p className="text-gray-400 mb-3">
                    {isPaused ? 'La reconnaissance est temporairement suspendue' : 'Positionnez-vous devant la caméra'}
                  </p>
                  {currentShift && (
                    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${currentShift.bgColor}`}>
                      {currentShift.icon}
                      <div>
                        <div className={`text-sm font-bold ${currentShift.color}`}>
                          {currentShift.name}
                        </div>
                        <div className="text-gray-300 text-xs">
                          {currentShift.description}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Historique des employés pointés */}
            {employeeQueue.length > 0 && (
              <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm 
                           rounded-2xl p-6 border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-400" />
                  Pointages récents
                </h3>
                
                <div className="space-y-3">
                  {employeeQueue.map((employee, index) => (
                    <div key={index} 
                         className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                      <div>
                        <div className="text-white font-medium">{employee.name}</div>
                        <div className="text-gray-400 text-sm">{employee.id}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400 font-bold">{employee.time}</div>
                        <div className="text-blue-400 text-xs">
                          {Math.round(employee.confidence * 100)}%
                        </div>
                        <div className="text-gray-500 text-xs">
                          {employee.shift}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-700 text-center">
                  <p className="text-gray-500 text-sm">
                    {employeeQueue.length} employé(s) pointé(s) ce shift
                  </p>
                </div>
              </div>
            )}

            {/* Boutons de contrôle secondaires */}
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm 
                         rounded-2xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Power className="w-5 h-5 text-red-400" />
                Contrôles système
              </h3>
              
              <div className="space-y-4">
                {/* Bouton Pause/Play */}
                <button
                  onClick={togglePause}
                  className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-3 ${
                    isPaused 
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                      : 'bg-gray-800 hover:bg-gray-700 text-white'
                  }`}
                >
                  {isPaused ? (
                    <>
                      <Play className="w-5 h-5" />
                      <span className="font-semibold">Reprendre la reconnaissance</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-5 h-5" />
                      <span className="font-semibold">Mettre en pause</span>
                    </>
                  )}
                </button>
                
                {/* Bouton Stop */}
                <button
                  onClick={handleStop}
                  className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 
                           hover:from-red-500 hover:to-red-600 
                           rounded-xl text-white font-semibold 
                           flex items-center justify-center gap-3"
                >
                  <X className="w-5 h-5" />
                  <span>Arrêter et fermer</span>
                </button>
                
                {/* Bouton Accueil */}
                <button
                  onClick={goToHome}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 
                           hover:from-blue-500 hover:to-blue-600 
                           rounded-xl text-white font-semibold 
                           flex items-center justify-center gap-3"
                >
                  <Home className="w-5 h-5" />
                  <span>Retour à l'accueil</span>
                </button>
              </div>

              {/* Info sécurité */}
              <div className="mt-6 pt-6 border-t border-gray-700">
                <div className="flex items-start gap-3 p-3 bg-blue-900/20 rounded-lg">
                  <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-blue-300 text-sm">
                      Mode de contrôle activé • Boutons de gestion disponibles
                    </p>
                    <p className="text-blue-400/70 text-xs mt-1">
                      Pause pour interruption temporaire • Stop pour fermeture complète
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tous les horaires de travail */}
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm 
                         rounded-2xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-400" />
                Horaires de travail
              </h3>
              
              <div className="space-y-3">
                {/* Shift 1 */}
                <div className={`flex items-center justify-between p-3 rounded-lg ${
                  currentShift?.id === 1 ? 'bg-green-900/30 border border-green-700/30' : 'bg-gray-900/50'
                }`}>
                  <div className="flex items-center gap-3">
                    <Sun className="w-5 h-5 text-green-400" />
                    <div>
                      <div className={`font-medium ${currentShift?.id === 1 ? 'text-green-300' : 'text-white'}`}>
                        Shift Standard
                      </div>
                      <div className="text-gray-400 text-sm">8h00 - 17h00</div>
                    </div>
                  </div>
                  {currentShift?.id === 1 && (
                    <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                      Actuel
                    </span>
                  )}
                </div>
                
                {/* Shift 2 */}
                <div className={`flex items-center justify-between p-3 rounded-lg ${
                  currentShift?.id === 2 ? 'bg-blue-900/30 border border-blue-700/30' : 'bg-gray-900/50'
                }`}>
                  <div className="flex items-center gap-3">
                    <Sunrise className="w-5 h-5 text-blue-400" />
                    <div>
                      <div className={`font-medium ${currentShift?.id === 2 ? 'text-blue-300' : 'text-white'}`}>
                        Shift Matin
                      </div>
                      <div className="text-gray-400 text-sm">6h00 - 14h00</div>
                    </div>
                  </div>
                  {currentShift?.id === 2 && (
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                      Actuel
                    </span>
                  )}
                </div>
                
                {/* Shift 3 */}
                <div className={`flex items-center justify-between p-3 rounded-lg ${
                  currentShift?.id === 3 ? 'bg-orange-900/30 border border-orange-700/30' : 'bg-gray-900/50'
                }`}>
                  <div className="flex items-center gap-3">
                    <Coffee className="w-5 h-5 text-orange-400" />
                    <div>
                      <div className={`font-medium ${currentShift?.id === 3 ? 'text-orange-300' : 'text-white'}`}>
                        Shift Après-midi
                      </div>
                      <div className="text-gray-400 text-sm">14h00 - 22h00</div>
                    </div>
                  </div>
                  {currentShift?.id === 3 && (
                    <span className="px-2 py-1 bg-orange-600 text-white text-xs rounded-full">
                      Actuel
                    </span>
                  )}
                </div>
                
                {/* Shift 4 */}
                <div className={`flex items-center justify-between p-3 rounded-lg ${
                  currentShift?.id === 4 ? 'bg-purple-900/30 border border-purple-700/30' : 'bg-gray-900/50'
                }`}>
                  <div className="flex items-center gap-3">
                    <Moon className="w-5 h-5 text-purple-400" />
                    <div>
                      <div className={`font-medium ${currentShift?.id === 4 ? 'text-purple-300' : 'text-white'}`}>
                        Shift Nuit
                      </div>
                      <div className="text-gray-400 text-sm">22h00 - 6h00</div>
                    </div>
                  </div>
                  {currentShift?.id === 4 && (
                    <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded-full">
                      Actuel
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pied de page */}
        <div className="mt-8 text-center">
          <div className="inline-flex flex-col md:flex-row items-center gap-4 bg-gray-800/50 backdrop-blur-sm 
                        px-6 py-3 rounded-xl border border-gray-700">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                isPaused ? 'bg-yellow-500' : 'bg-green-500'
              }`}></div>
              <span className="text-gray-300 text-sm">
                {isPaused ? 'Système en pause' : 'Système multi-shifts actif'}
              </span>
            </div>
            <div className="hidden md:block h-4 w-px bg-gray-700"></div>
            <div className="text-gray-500 text-sm">
              Shift: {currentShift?.name} • Scans: {scanCount} • Réussite: {scanCount > 0 ? 
                Math.round((employeeQueue.length / scanCount) * 100) : 0}%
            </div>
            <div className="hidden md:block h-4 w-px bg-gray-700"></div>
            <div className="text-gray-600 text-sm">
              {currentTime} • [Pause: {isPaused ? 'ON' : 'OFF'}]
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullScreenRecognition;