import React, { useState, useEffect, useRef, useCallback } from 'react';
import FacialCamera from './FacialCamera';
import { 
  UserCheck, Clock, Calendar, CheckCircle, XCircle, 
  Loader, AlertCircle, Copy, Camera, Shield, Zap, 
  Maximize2, RefreshCw, Download, Activity, Wifi, 
  WifiOff, Database, AlertTriangle, Info, Sparkles,
  ZapOff, Users as UsersIcon, Target, Home, Settings,
  BarChart3, UserPlus, History, ShieldCheck, Cpu,
  LogOut, User, Smile, Meh, Frown, ChevronRight, Clock3,
  DoorOpen, DoorClosed, CheckSquare, XSquare, ArrowRightLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const AttendanceByFace = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('initial');
  const [capturedImage, setCapturedImage] = useState(null);
  const [attendanceResult, setAttendanceResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [cameraPermissions, setCameraPermissions] = useState('checking');
  const [cameraReady, setCameraReady] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [performanceStats, setPerformanceStats] = useState({
    fastest: 0,
    slowest: 0,
    average: 0,
    total: 0
  });
  
  // ==================== NOUVEAUX ÉTATS POUR LE SYSTÈME 2 BOUTONS ====================
  const [attendanceMode, setAttendanceMode] = useState('auto'); // 'auto', 'checkin', 'checkout'
  const [attendanceStatus, setAttendanceStatus] = useState({
    canCheckIn: true,
    canCheckOut: false,
    checkInTime: null,
    checkOutTime: null,
    hoursWorked: null,
    loading: false,
    employeeId: null,
    employeeName: null,
    lastCheckTime: null,
    status: 'not_checked'
  });
  
  // Stats optimisées avec cache
  const [stats, setStats] = useState({
    todayCount: 0,
    totalEmployees: 4,
    lastUpdated: new Date().toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    apiStatus: 'checking',
    facialStatus: 'unknown',
    averageResponseTime: 0,
    optimizedMode: true,
    registeredFaces: 0,
    cameraHealth: 'checking',
    systemLoad: 'normal',
    todayAttendance: {
      total: 0,
      completed: 0,
      pending: 0
    }
  });

  // Références pour éviter les appels multiples
  const processingLock = useRef(false);
  const hasInitializedRef = useRef(false);
  const responseTimesRef = useRef([]);
  const lastOptimizedImageRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const cameraTestRef = useRef(null);
  const cameraCheckedRef = useRef(false);

  // ==================== VÉRIFICATION DES PERMISSIONS CAMÉRA ====================
  useEffect(() => {
    if (cameraCheckedRef.current) {
      console.log('⏭️ Vérification caméra déjà effectuée');
      return;
    }
    
    const checkCameraPermissions = async () => {
      try {
        console.log('🔍 Vérification des permissions caméra...');
        cameraCheckedRef.current = true;
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn('⚠️ API MediaDevices non supportée');
          setCameraPermissions('unsupported');
          setStats(prev => ({ ...prev, cameraHealth: 'unsupported' }));
          return;
        }
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log('📸 Caméras détectées:', videoDevices.length);
        
        if (videoDevices.length === 0) {
          console.warn('⚠️ Aucune caméra détectée');
          setCameraPermissions('no-camera');
          setStats(prev => ({ ...prev, cameraHealth: 'no-camera' }));
          return;
        }
        
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'user',
              width: { ideal: 640 },
              height: { ideal: 480 }
            } 
          });
          
          console.log('✅ Permissions caméra accordées');
          
          if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            const settings = videoTrack.getSettings();
            console.log('📊 Paramètres caméra:', settings);
            
            setStats(prev => ({ 
              ...prev, 
              cameraHealth: 'healthy',
              systemLoad: settings.frameRate > 15 ? 'optimal' : 'normal'
            }));
          }
          
          stream.getTracks().forEach(track => track.stop());
          setCameraPermissions('granted');
          
        } catch (permissionError) {
          console.error('❌ Permissions refusées:', permissionError);
          
          if (permissionError.name === 'NotAllowedError') {
            setCameraPermissions('denied');
            setStats(prev => ({ ...prev, cameraHealth: 'blocked' }));
          } else {
            setCameraPermissions('error');
            setStats(prev => ({ ...prev, cameraHealth: 'error' }));
          }
        }
        
      } catch (err) {
        cameraCheckedRef.current = false;
        console.error('❌ Erreur vérification permissions:', err);
        setCameraPermissions('error');
        setStats(prev => ({ ...prev, cameraHealth: 'error' }));
      }
    };
    
    const timer = setTimeout(() => {
      checkCameraPermissions();
    }, 100);
    
    return () => {
      clearTimeout(timer);
      if (cameraTestRef.current) {
        cameraTestRef.current.getTracks?.().forEach(track => track.stop());
      }
    };
  }, []);

  // ==================== FONCTIONS UTILITAIRES ====================

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setStats(prev => ({ ...prev, apiStatus: 'disconnected' }));
        return;
      }
      
      const startTime = Date.now();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch('http://localhost:5000/api/employees/stats', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const responseTime = Date.now() - startTime;
          responseTimesRef.current.push(responseTime);
          if (responseTimesRef.current.length > 5) responseTimesRef.current.shift();
          
          const avgTime = responseTimesRef.current.length > 0 
            ? Math.round(responseTimesRef.current.reduce((a, b) => a + b) / responseTimesRef.current.length)
            : 0;
          
          setStats(prev => ({
            ...prev,
            todayCount: data.data?.today?.present || prev.todayCount,
            totalEmployees: data.data?.today?.totalEmployees || prev.totalEmployees,
            lastUpdated: new Date().toLocaleTimeString('fr-FR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            apiStatus: 'connected',
            averageResponseTime: avgTime,
            systemLoad: responseTime < 1000 ? 'optimal' : responseTime < 2000 ? 'normal' : 'high'
          }));
        }
      } else {
        setStats(prev => ({ ...prev, apiStatus: 'error' }));
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Erreur récupération stats:', error);
        setStats(prev => ({ 
          ...prev, 
          apiStatus: 'error',
          systemLoad: 'high'
        }));
      }
    }
  }, []);

  const checkFacialAPI = useCallback(async () => {
    try {
      const cached = localStorage.getItem('facialAPIStatus');
      const cacheTime = localStorage.getItem('facialAPIStatusTime');
      const now = Date.now();
      
      if (cached && cacheTime && (now - parseInt(cacheTime)) < 30000) {
        const data = JSON.parse(cached);
        setStats(prev => ({
          ...prev,
          facialStatus: data.status || 'active',
          registeredFaces: data.registeredFaces || 0
        }));
        return true;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      
      const response = await fetch('http://localhost:5000/api/facial/health', {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        
        localStorage.setItem('facialAPIStatus', JSON.stringify(data));
        localStorage.setItem('facialAPIStatusTime', now.toString());
        
        setStats(prev => ({
          ...prev,
          facialStatus: data.status || 'active',
          registeredFaces: data.registeredFaces || 0
        }));
        
        return true;
      } else {
        setStats(prev => ({ ...prev, facialStatus: 'error' }));
        return false;
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('API Faciale inaccessible:', error);
        setStats(prev => ({ ...prev, facialStatus: 'error' }));
      }
      return false;
    }
  }, []);

  // ==================== NOUVELLE FONCTION : VÉRIFIER ÉTAT POINTAGE (CORRIGÉE) ====================

  const fetchAttendanceStatus = async (employeeId = null) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('❌ Token non trouvé pour vérification pointage');
        return {
          canCheckIn: false,
          canCheckOut: false,
          checkInTime: null,
          checkOutTime: null,
          hoursWorked: null,
          status: 'error'
        };
      }
      
      // Si aucun employeeId n'est fourni, récupérer l'utilisateur connecté
      let targetEmployeeId = employeeId;
      if (!targetEmployeeId) {
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        targetEmployeeId = userData.employeeId;
      }
      
      if (!targetEmployeeId) {
        console.warn('❌ Aucun ID employé disponible');
        return {
          canCheckIn: true, // Par défaut, peut pointer l'arrivée
          canCheckOut: false,
          checkInTime: null,
          checkOutTime: null,
          hoursWorked: null,
          status: 'not_checked'
        };
      }
      
      const today = new Date().toISOString().split('T')[0];
      
      // ✅ CORRIGÉ : Utiliser la bonne route d'état de pointage
      try {
        const response = await fetch(`http://localhost:5000/api/attendance/check-today/${targetEmployeeId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            console.log('📊 Statut pointage:', data);
            
            // Mettre à jour l'état local
            const status = {
              canCheckIn: data.canCheckIn || false,
              canCheckOut: data.canCheckOut || false,
              checkInTime: data.existingRecord?.checkIn,
              checkOutTime: data.existingRecord?.checkOut,
              hoursWorked: data.existingRecord?.hoursWorked,
              loading: false,
              employeeId: targetEmployeeId,
              employeeName: data.employeeName,
              lastCheckTime: new Date().toISOString(),
              status: data.alreadyChecked ? 'already_checked' : 'not_checked'
            };
            
            setAttendanceStatus(status);
            return status;
          }
        }
      } catch (routeError) {
        console.log('⚠️ Route /check-today non disponible, utilisation backup:', routeError.message);
      }
      
      // Fallback: Requête directe vers la base
      const response = await fetch(`http://localhost:5000/api/attendance?employeeId=${targetEmployeeId}&date=${today}&limit=1`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.length > 0) {
          const latestAttendance = data.data[0];
          const hasCheckOut = !!latestAttendance.checkOut;
          
          const status = {
            canCheckIn: false, // Déjà pointé
            canCheckOut: !hasCheckOut, // Peut pointer le départ si pas encore fait
            checkInTime: latestAttendance.checkIn,
            checkOutTime: latestAttendance.checkOut,
            hoursWorked: latestAttendance.hoursWorked,
            loading: false,
            employeeId: targetEmployeeId,
            employeeName: latestAttendance.employeeName,
            lastCheckTime: new Date().toISOString(),
            status: hasCheckOut ? 'completed' : 'checked_in'
          };
          
          setAttendanceStatus(status);
          return status;
        }
      }
      
      // Aucun pointage trouvé - peut pointer l'arrivée
      const defaultStatus = {
        canCheckIn: true,
        canCheckOut: false,
        checkInTime: null,
        checkOutTime: null,
        hoursWorked: null,
        loading: false,
        employeeId: targetEmployeeId,
        employeeName: null,
        lastCheckTime: new Date().toISOString(),
        status: 'not_checked'
      };
      
      setAttendanceStatus(defaultStatus);
      return defaultStatus;
      
    } catch (error) {
      console.error('❌ Erreur vérification pointage:', error);
      const errorStatus = {
        canCheckIn: false,
        canCheckOut: false,
        checkInTime: null,
        checkOutTime: null,
        hoursWorked: null,
        loading: false,
        employeeId: null,
        employeeName: null,
        lastCheckTime: new Date().toISOString(),
        status: 'error'
      };
      setAttendanceStatus(errorStatus);
      return errorStatus;
    }
  };

  const optimizeImage = useCallback((imageData) => {
    return new Promise((resolve) => {
      if (lastOptimizedImageRef.current === imageData) {
        console.log('🔄 Utilisation image cache');
        resolve(imageData);
        return;
      }
      
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        
        lastOptimizedImageRef.current = optimizedDataUrl;
        
        console.log('🚀 Image optimisée:', {
          original: `${img.width}x${img.height}`,
          optimized: `${width}x${height}`,
          originalSize: Math.round(imageData.length / 1024) + 'KB',
          optimizedSize: Math.round(optimizedDataUrl.length / 1024) + 'KB',
          reduction: Math.round((1 - (optimizedDataUrl.length / imageData.length)) * 100) + '%'
        });
        
        resolve(optimizedDataUrl);
      };
      
      img.onerror = () => {
        console.warn('⚠️ Erreur optimisation, utilisation image originale');
        resolve(imageData);
      };
      
      img.src = imageData;
    });
  }, []);

  // ==================== NOUVELLE FONCTION : RECONNAISSANCE AVEC ACTION ====================

  const performRecognitionWithAction = useCallback(async (imageData, action = 'checkin', employeeId = null) => {
    if (processingLock.current) {
      console.log('⏳ Reconnaissance déjà en cours');
      return null;
    }
    
    processingLock.current = true;
    const recognitionStartTime = Date.now();
    let controller = null;
    let timeoutId = null;
    
    try {
      console.log(`🎯 LANCEMENT RECONNAISSANCE AVEC ACTION: ${action}...`);
      
      // 1. Vérifier que l'API est disponible
      if (stats.apiStatus === 'error' || stats.facialStatus === 'error') {
        throw new Error('Serveur backend non disponible. Vérifiez que le serveur est démarré.');
      }
      
      // 2. Optimiser l'image (seulement si nécessaire)
      let optimizedImage;
      if (imageData.length > 100000) {
        optimizedImage = await optimizeImage(imageData);
      } else {
        optimizedImage = imageData;
        console.log('✅ Image déjà petite, pas d\'optimisation nécessaire');
      }
      
      // 3. Convertir DataURL en Blob pour FormData
      const response = await fetch(optimizedImage);
      const blob = await response.blob();
      
      console.log('📦 Image convertie en Blob:', {
        type: blob.type,
        size: blob.size + ' bytes',
        isBlob: blob instanceof Blob
      });
      
      // 4. Vérifier token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token non trouvé. Veuillez vous reconnecter.');
      }
      
      // 5. Créer FormData
      const formData = new FormData();
      formData.append('photo', blob, 'capture.jpg');
      formData.append('action', action);
      
      if (employeeId) {
        formData.append('employeeId', employeeId);
      }
      
      console.log(`📋 FormData créé, action: ${action}`);
      
      // 6. Timeout strict de 3500ms
      controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 3500);
      
      console.log('📤 Envoi FormData au serveur...');
      
      // 7. Appel API avec FormData - NOUVELLE ROUTE
      const fetchResponse = await fetch('http://localhost:5000/api/facial/attend-with-action', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Optimized-Mode': 'true',
          'X-Response-Target': '2000ms'
        },
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const totalTime = Date.now() - recognitionStartTime;
      console.log(`⏱️  Temps total: ${totalTime}ms`);
      console.log(`📊 Réponse serveur: ${fetchResponse.status} ${fetchResponse.statusText}`);
      
      if (!fetchResponse.ok) {
        let errorText = 'Erreur inconnue';
        try {
          const errorData = await fetchResponse.json();
          errorText = errorData.message || JSON.stringify(errorData);
          console.error('❌ Erreur serveur détaillée:', errorData);
        } catch (e) {
          try {
            errorText = await fetchResponse.text();
          } catch (e2) {
            errorText = fetchResponse.statusText;
          }
        }
        
        throw new Error(`Erreur serveur (${fetchResponse.status}): ${errorText.substring(0, 200)}`);
      }
      
      const result = await fetchResponse.json();
      
      console.log('✅ Réponse serveur:', {
        success: result.success,
        recognized: result.recognized,
        attendanceRecorded: result.attendanceRecorded,
        action: result.action,
        message: result.message
      });
      
      // Mettre à jour les stats de performance
      responseTimesRef.current.push(totalTime);
      if (responseTimesRef.current.length > 5) responseTimesRef.current.shift();
      
      // Mettre à jour l'historique des scans
      setScanHistory(prev => {
        const newHistory = [{
          timestamp: new Date().toISOString(),
          success: result.success,
          time: totalTime,
          action: action,
          employeeName: result.match?.employeeName,
          message: result.message
        }, ...prev].slice(0, 10);
        
        return newHistory;
      });
      
      // Mettre à jour les stats de performance
      if (scanHistory.length > 0) {
        const times = [...scanHistory.map(s => s.time), totalTime];
        setPerformanceStats({
          fastest: Math.min(...times),
          slowest: Math.max(...times),
          average: Math.round(times.reduce((a, b) => a + b) / times.length),
          total: times.length
        });
      }
      
      // Retourner le résultat enrichi
      const enrichedResult = {
        ...result,
        processingTime: totalTime,
        success: result.success !== false,
        timestamp: new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        userMessage: result.message || result.userMessage,
        frontend: result.frontend || {},
        existingRecord: result.existingRecord,
        action: action,
        attendance: result.attendance
      };
      
      return enrichedResult;
      
    } catch (error) {
      console.error(`❌ Erreur reconnaissance ${action}:`, error.name || error.message);
      
      const totalTime = Date.now() - recognitionStartTime;
      
      // Gestion spécifique des timeouts
      if (error.name === 'AbortError') {
        return {
          success: false,
          recognized: false,
          message: 'Temps limite dépassé (3.5s)',
          userMessage: 'Le serveur a mis trop de temps à répondre',
          isTimeout: true,
          processingTime: totalTime,
          suggestions: [
            'Le serveur met trop de temps à répondre',
            'Vérifiez votre connexion réseau',
            'Réessayez dans quelques instants'
          ],
          timestamp: new Date().toLocaleTimeString('fr-FR')
        };
      }
      
      // Gestion des erreurs 400 (Bad Request)
      if (error.message.includes('400') || error.message.includes('Bad Request')) {
        console.error('❌ ERREUR 400 - Problème de format');
        
        return {
          success: false,
          recognized: false,
          message: 'Format d\'image incorrect',
          userMessage: 'Le format d\'image n\'est pas supporté',
          errorType: 'BAD_REQUEST',
          processingTime: totalTime,
          suggestions: [
            'Le serveur n\'a pas reçu l\'image correctement',
            'Le format doit être FormData avec fichier image',
            'Réessayez en recapturant l\'image'
          ],
          timestamp: new Date().toLocaleTimeString('fr-FR')
        };
      }
      
      if (error.message.includes('non disponible')) {
        return {
          success: false,
          recognized: false,
          message: 'Serveur backend non disponible',
          userMessage: 'Impossible de se connecter au serveur',
          processingTime: totalTime,
          suggestions: [
            'Démarrez le serveur backend avec: npm run dev',
            'Vérifiez que le port 5000 est libre',
            'Assurez-vous d\'être connecté au même réseau'
          ],
          timestamp: new Date().toLocaleTimeString('fr-FR')
        };
      }
      
      return {
        success: false,
        recognized: false,
        message: error.message || 'Erreur de connexion',
        userMessage: 'Erreur technique, veuillez réessayer',
        processingTime: totalTime,
        timestamp: new Date().toLocaleTimeString('fr-FR')
      };
      
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      processingLock.current = false;
    }
  }, [stats.apiStatus, stats.facialStatus, optimizeImage, scanHistory]);

  // ==================== GESTION DU CHECK-IN (CORRIGÉE) ====================

  const handleCheckIn = async (employeeId = null) => {
    try {
      setAttendanceStatus(prev => ({ ...prev, loading: true }));
      
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Veuillez vous reconnecter');
        setAttendanceStatus(prev => ({ ...prev, loading: false }));
        return;
      }

      console.log(`📍 Début pointage d'arrivée`);
      
      // ✅ CORRIGÉ : Utiliser la bonne route
      const response = await fetch('http://localhost:5000/api/attendance/mark', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          employeeId: employeeId || attendanceStatus.employeeId,
          checkType: 'manual'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        const checkInFormatted = data.data?.checkIn || 
          new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        
        toast.success(`✅ Arrivée enregistrée à ${checkInFormatted}`);
        
        // Mettre à jour l'état local
        setAttendanceStatus(prev => ({
          ...prev,
          canCheckIn: false,
          canCheckOut: true,
          checkInTime: data.data?.checkIn || new Date().toISOString(),
          loading: false,
          status: 'checked_in'
        }));
        
        // Mettre à jour les stats
        setStats(prev => ({
          ...prev,
          todayCount: prev.todayCount + 1,
          todayAttendance: {
            ...prev.todayAttendance,
            total: (prev.todayAttendance.total || 0) + 1,
            pending: (prev.todayAttendance.pending || 0) + 1
          }
        }));
        
        // Recharger le statut
        await fetchAttendanceStatus(employeeId || attendanceStatus.employeeId);
        
      } else {
        toast.error(data.message || 'Erreur lors du pointage d\'arrivée');
        setAttendanceStatus(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('❌ Erreur check-in:', error);
      toast.error('Erreur lors du pointage d\'arrivée');
      setAttendanceStatus(prev => ({ ...prev, loading: false }));
    }
  };

  // ==================== GESTION DU CHECK-OUT (CORRIGÉE) ====================

  const handleCheckOut = async (employeeId = null) => {
    try {
      setAttendanceStatus(prev => ({ ...prev, loading: true }));
      
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Veuillez vous reconnecter');
        setAttendanceStatus(prev => ({ ...prev, loading: false }));
        return;
      }

      console.log(`🚪 Début pointage de départ`);
      
      // ✅ CORRIGÉ : Utiliser la bonne route
      const response = await fetch('http://localhost:5000/api/attendance/mark', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          employeeId: employeeId || attendanceStatus.employeeId,
          checkType: 'manual'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        const checkOutFormatted = data.data?.checkOut || 
          new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        
        toast.success(`✅ Départ enregistré à ${checkOutFormatted}`);
        
        // Mettre à jour l'état local
        setAttendanceStatus(prev => ({
          ...prev,
          canCheckOut: false,
          checkOutTime: data.data?.checkOut || new Date().toISOString(),
          hoursWorked: data.data?.hoursWorked,
          loading: false,
          status: 'completed'
        }));
        
        // Mettre à jour les stats
        setStats(prev => ({
          ...prev,
          todayAttendance: {
            ...prev.todayAttendance,
            completed: (prev.todayAttendance.completed || 0) + 1,
            pending: (prev.todayAttendance.pending || 1) - 1
          }
        }));
        
        // Recharger le statut
        await fetchAttendanceStatus(employeeId || attendanceStatus.employeeId);
        
      } else {
        toast.error(data.message || 'Erreur lors du pointage de départ');
        setAttendanceStatus(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('❌ Erreur checkout:', error);
      toast.error('Erreur lors du pointage de départ');
      setAttendanceStatus(prev => ({ ...prev, loading: false }));
    }
  };

  // ==================== GESTION DE LA CAPTURE ====================

  const handleCapture = async (imageData) => {
    if (cameraPermissions !== 'granted') {
      setError('Permissions caméra non accordées. Veuillez autoriser l\'accès à la caméra.');
      setStep('initial');
      toast.error('Permissions caméra nécessaires');
      return;
    }
    
    if (stats.apiStatus === 'error') {
      setError('Serveur backend non disponible. Vérifiez que le serveur est démarré.');
      setStep('initial');
      toast.error('Serveur non disponible');
      return;
    }
    
    setCapturedImage(imageData);
    setStep('processing');
    setIsProcessing(true);
    setError(null);
    setAttendanceResult(null);
    
    console.log(`🎯 DÉBUT RECONNAISSANCE (Mode: ${attendanceMode})...`);
    
    try {
      let result;
      
      if (attendanceMode === 'auto') {
        // Mode auto: utiliser l'ancienne route
        result = await performRecognitionWithAction(imageData, 'checkin');
      } else {
        // Mode avec action spécifique
        result = await performRecognitionWithAction(
          imageData, 
          attendanceMode, 
          attendanceStatus.employeeId
        );
      }
      
      if (!result) {
        throw new Error('Reconnaissance annulée ou en cours');
      }
      
      setAttendanceResult(result);
      
      if (result.success) {
        if (result.recognized && result.attendanceRecorded) {
          // Pointage réussi
          showSuccessNotification(result.message || `Pointage enregistré`, true);
          
          // Mettre à jour le statut
          if (result.action === 'checkin') {
            setAttendanceStatus(prev => ({
              ...prev,
              canCheckIn: false,
              canCheckOut: true,
              checkInTime: result.attendance?.checkIn,
              employeeId: result.match?.employeeId,
              employeeName: result.match?.employeeName,
              status: 'checked_in'
            }));
          } else if (result.action === 'checkout') {
            setAttendanceStatus(prev => ({
              ...prev,
              canCheckOut: false,
              checkOutTime: result.attendance?.checkOut,
              hoursWorked: result.attendance?.hoursWorked,
              status: 'completed'
            }));
          }
          
          // Mettre à jour les stats
          setStats(prev => ({
            ...prev,
            todayCount: prev.todayCount + 1,
            lastUpdated: new Date().toLocaleTimeString('fr-FR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })
          }));
          
          // Recharger le statut
          await fetchAttendanceStatus(attendanceStatus.employeeId);
          
        } else if (result.recognized && result.alreadyChecked) {
          // Déjà pointé
          if (result.frontend?.showCheckOutButton) {
            showInfoNotification(`Vous pouvez pointer votre départ`, true);
            setAttendanceStatus(prev => ({
              ...prev,
              canCheckIn: false,
              canCheckOut: true,
              checkInTime: result.existingRecord?.checkIn,
              employeeId: result.match?.employeeId,
              employeeName: result.match?.employeeName,
              status: 'checked_in'
            }));
          } else if (result.frontend?.status === 'already_checked_out') {
            showInfoNotification(`Pointage complet pour aujourd'hui`, false);
            setAttendanceStatus(prev => ({
              ...prev,
              canCheckIn: false,
              canCheckOut: false,
              checkInTime: result.existingRecord?.checkIn,
              checkOutTime: result.existingRecord?.checkOut,
              status: 'completed'
            }));
          }
        }
      } else if (result.isTimeout) {
        toast.error('Timeout: Le serveur a mis trop de temps à répondre');
      } else if (!result.success) {
        toast.error(result.userMessage || result.message || 'Reconnaissance échouée');
      }
      
    } catch (err) {
      console.error('❌ Erreur dans handleCapture:', err);
      
      setError(err.message || 'Erreur technique');
      setAttendanceResult({
        success: false,
        recognized: false,
        message: 'Erreur lors de la reconnaissance',
        userMessage: 'Erreur technique, veuillez réessayer',
        errorDetails: err.message,
        processingTime: 0,
        suggestions: [
          'Vérifiez que le serveur backend est démarré',
          'Assurez-vous d\'avoir une connexion internet stable',
          'Réessayez dans quelques instants'
        ],
        timestamp: new Date().toLocaleTimeString('fr-FR')
      });
      
      toast.error('Erreur lors de la reconnaissance');
      
    } finally {
      setIsProcessing(false);
      setStep('result');
    }
  };

  // ==================== GESTION DES MODES ====================

  const startCaptureCheckIn = () => {
    setAttendanceMode('checkin');
    startCapture();
  };

  const startCaptureCheckOut = () => {
    setAttendanceMode('checkout');
    startCapture();
  };

  const startCapture = () => {
    if (cameraPermissions !== 'granted') {
      let errorMessage = '';
      let showAlert = true;
      
      switch (cameraPermissions) {
        case 'denied':
          errorMessage = 'Accès à la caméra refusé. Veuillez autoriser l\'accès dans les paramètres de votre navigateur.';
          break;
        case 'no-camera':
          errorMessage = 'Aucune caméra détectée. Vérifiez votre connexion.';
          break;
        case 'unsupported':
          errorMessage = 'Votre navigateur ne supporte pas la caméra. Essayez avec Chrome ou Firefox.';
          break;
        case 'error':
          errorMessage = 'Erreur lors de la vérification des permissions. Veuillez réessayer.';
          break;
        case 'checking':
          errorMessage = 'Permissions caméra en cours de vérification...';
          showAlert = false;
          break;
        default:
          errorMessage = 'État caméra inconnu.';
      }
      
      if (showAlert) {
        toast.error(errorMessage);
        
        if (cameraPermissions === 'denied') {
          setTimeout(() => {
            if (window.confirm('Souhaitez-vous voir les instructions pour autoriser la caméra ?')) {
              const instructions = `Pour autoriser la caméra :

1. Cliquez sur l'icône de cadenas 🔒 dans la barre d'adresse
2. Cliquez sur "Permissions" ou "Paramètres du site"
3. Trouvez "Caméra" et changez de "Demander" à "Autoriser"
4. Rafraîchissez cette page (F5)

Note : Si vous ne voyez pas l'icône, essayez :
- Chrome/Edge : 🔒 → "Paramètres du site" → "Caméra"
- Firefox : 🔒 → "Paramètres" → "Permissions"
- Safari : "Préférences" → "Sites Web" → "Caméra"`;
              
              alert(instructions);
            }
          }, 500);
        }
      }
      
      return;
    }
    
    if (stats.apiStatus === 'error') {
      toast.error('Le serveur backend n\'est pas disponible. Veuillez démarrer le serveur localhost:5000');
      return;
    }
    
    lastOptimizedImageRef.current = null;
    
    setStep('capturing');
    setCapturedImage(null);
    setAttendanceResult(null);
    setError(null);
    setCameraReady(false);
    
    toast.success(`Caméra activée - ${attendanceMode === 'checkin' ? 'Pointage d\'arrivée' : 'Pointage de départ'}`);
  };

  const reset = () => {
    setStep('initial');
    setCapturedImage(null);
    setAttendanceResult(null);
    setError(null);
    lastOptimizedImageRef.current = null;
    setCameraReady(false);
    setAttendanceMode('auto');
  };

  // ==================== NOTIFICATIONS ====================

  const showSuccessNotification = (message, showConfetti = false) => {
    toast.success(message, {
      duration: 4000,
      position: 'top-center',
      style: {
        background: '#10b981',
        color: 'white',
        fontWeight: 'bold'
      }
    });
    
    if (showConfetti) {
      console.log('🎉 Confetti animation!');
    }
  };

  const showInfoNotification = (message, showCheckOutButton = false) => {
    toast(message, {
      duration: 5000,
      position: 'top-center',
      icon: 'ℹ️',
      style: {
        background: '#3b82f6',
        color: 'white',
        fontWeight: 'bold'
      }
    });
  };

  const showErrorNotification = (message) => {
    toast.error(message, {
      duration: 4000,
      position: 'top-center'
    });
  };

  // ==================== FONCTIONS UTILITAIRES ====================

  const handleStartFullScreenRecognition = () => {
    if (cameraPermissions !== 'granted') {
      toast.error('Veuillez d\'abord autoriser l\'accès à la caméra dans le mode standard.');
      startCapture();
      return;
    }
    
    const width = window.screen.availWidth;
    const height = window.screen.availHeight;
    
    const fullScreenWindow = window.open(
      '/fullscreen-recognition',
      'ReconnaissanceFacialePleinEcran',
      `width=${width},height=${height},left=0,top=0,fullscreen=yes,toolbar=no,location=no,status=no,menubar=no,scrollbars=no`
    );
    
    if (!fullScreenWindow) {
      toast.error('Veuillez autoriser les fenêtres pop-up pour le mode plein écran');
      return;
    }
    
    toast.success('Mode plein écran activé');
  };

  const testAPIConnection = async () => {
    try {
      toast.loading('Test de connexion en cours...');
      console.log('🔗 Test connexion API ultra-rapide...');
      
      const startTime = Date.now();
      
      const [healthResponse, facialResponse] = await Promise.allSettled([
        fetch('http://localhost:5000/api/health', { 
          signal: AbortSignal.timeout(2000),
          headers: { 'Cache-Control': 'no-cache' }
        }),
        fetch('http://localhost:5000/api/facial/health', { 
          signal: AbortSignal.timeout(2000),
          headers: { 'Cache-Control': 'no-cache' }
        })
      ]);
      
      const totalTime = Date.now() - startTime;
      
      let healthData = null;
      let facialData = null;
      
      if (healthResponse.status === 'fulfilled' && healthResponse.value.ok) {
        healthData = await healthResponse.value.json();
      }
      
      if (facialResponse.status === 'fulfilled' && facialResponse.value.ok) {
        facialData = await facialResponse.value.json();
      }
      
      toast.dismiss();
      
      toast.success('Connexion API réussie!');
      
      setStats(prev => ({ 
        ...prev, 
        apiStatus: 'connected',
        facialStatus: facialData?.status || 'active',
        registeredFaces: facialData?.registeredFaces || 0,
        averageResponseTime: totalTime,
        systemLoad: totalTime < 1000 ? 'optimal' : 'normal'
      }));
      
      return true;
      
    } catch (error) {
      toast.dismiss();
      console.error('❌ Test API échoué:', error);
      
      toast.error('Connexion API échouée');
      
      setStats(prev => ({ 
        ...prev, 
        apiStatus: 'error',
        systemLoad: 'high'
      }));
      return false;
    }
  };

  const optimizeSystem = () => {
    localStorage.removeItem('facialAPIStatus');
    localStorage.removeItem('facialAPIStatusTime');
    lastOptimizedImageRef.current = null;
    responseTimesRef.current = [];
    
    setPerformanceStats({
      fastest: 0,
      slowest: 0,
      average: 0,
      total: 0
    });
    
    fetchStats();
    checkFacialAPI();
    
    toast.success('Système optimisé et caches nettoyés');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copié dans le presse-papier');
    }).catch(err => {
      toast.error('Erreur lors de la copie');
    });
  };

  // ==================== USEEFFECT OPTIMISÉS ====================

  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      
      console.log('🚀 Initialisation optimisée du composant');
      
      fetchStats().catch(() => {});
      checkFacialAPI().catch(() => {});
      
      // Charger le statut de pointage
      fetchAttendanceStatus();
      
      statsIntervalRef.current = setInterval(() => {
        fetchStats().catch(() => {});
      }, 120000);
    }
    
    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    };
  }, [fetchStats, checkFacialAPI]);

  // ==================== FONCTIONS UTILITAIRES ====================

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'present': 
      case 'checked_in':
      case 'à l\'heure': 
        return 'text-green-400 bg-green-900/30';
      case 'late': 
      case 'en retard': 
        return 'text-yellow-400 bg-yellow-900/30';
      case 'absent': 
        return 'text-red-400 bg-red-900/30';
      case 'already_checked': 
      case 'already checked': 
      case 'déjà pointé': 
        return 'text-blue-400 bg-blue-900/30';
      case 'completed':
        return 'text-purple-400 bg-purple-900/30';
      case 'not_checked':
        return 'text-gray-400 bg-gray-900/30';
      default: return 'text-gray-400 bg-gray-900/30';
    }
  };

  const getStatusText = (status) => {
    switch(status?.toLowerCase()) {
      case 'present': 
      case 'checked_in': 
        return 'Arrivée pointée';
      case 'late': return 'En retard';
      case 'absent': return 'Absent';
      case 'already_checked': 
      case 'already checked': 
        return 'Déjà pointé';
      case 'completed':
        return 'Pointage complet';
      case 'not_checked':
        return 'Non pointé';
      default: return status || 'Non défini';
    }
  };

  const getConnectionStatus = () => {
    switch(stats.apiStatus) {
      case 'connected': return { 
        color: 'text-green-400', 
        icon: <Wifi className="w-4 h-4" />, 
        text: 'Connecté',
        bg: 'bg-green-900/20',
        border: 'border-green-700/30'
      };
      case 'error': return { 
        color: 'text-red-400', 
        icon: <WifiOff className="w-4 h-4" />, 
        text: 'Déconnecté',
        bg: 'bg-red-900/20',
        border: 'border-red-700/30'
      };
      case 'checking': return { 
        color: 'text-yellow-400', 
        icon: <Database className="w-4 h-4" />, 
        text: 'Vérification...',
        bg: 'bg-yellow-900/20',
        border: 'border-yellow-700/30'
      };
      default: return { 
        color: 'text-gray-400', 
        icon: <Database className="w-4 h-4" />, 
        text: 'Inconnu',
        bg: 'bg-gray-900/20',
        border: 'border-gray-700/30'
      };
    }
  };

  const getCameraPermissionStatus = () => {
    switch(cameraPermissions) {
      case 'granted': return { 
        color: 'text-green-400', 
        icon: <CheckCircle className="w-4 h-4" />, 
        text: 'Autorisée',
        bg: 'bg-green-900/20',
        border: 'border-green-700/30'
      };
      case 'denied': return { 
        color: 'text-red-400', 
        icon: <XCircle className="w-4 h-4" />, 
        text: 'Refusée',
        bg: 'bg-red-900/20',
        border: 'border-red-700/30'
      };
      case 'no-camera': return { 
        color: 'text-red-400', 
        icon: <XCircle className="w-4 h-4" />, 
        text: 'Pas de caméra',
        bg: 'bg-red-900/20',
        border: 'border-red-700/30'
      };
      case 'unsupported': return { 
        color: 'text-yellow-400', 
        icon: <AlertCircle className="w-4 h-4" />, 
        text: 'Non supporté',
        bg: 'bg-yellow-900/20',
        border: 'border-yellow-700/30'
      };
      case 'error': return { 
        color: 'text-orange-400', 
        icon: <AlertTriangle className="w-4 h-4" />, 
        text: 'Erreur',
        bg: 'bg-orange-900/20',
        border: 'border-orange-700/30'
      };
      default: return { 
        color: 'text-blue-400', 
        icon: <Loader className="w-4 h-4 animate-spin" />, 
        text: 'Vérification...',
        bg: 'bg-blue-900/20',
        border: 'border-blue-700/30'
      };
    }
  };

  const getSystemLoadColor = () => {
    switch(stats.systemLoad) {
      case 'optimal': return 'text-green-400';
      case 'normal': return 'text-yellow-400';
      case 'high': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getEmojiForStatus = (status) => {
    switch(status?.toLowerCase()) {
      case 'present': 
      case 'checked_in': 
      case 'à l\'heure': 
        return <Smile className="w-6 h-6 text-green-400" />;
      case 'late': 
      case 'en retard': 
        return <Meh className="w-6 h-6 text-yellow-400" />;
      case 'absent': 
        return <Frown className="w-6 h-6 text-red-400" />;
      case 'completed':
        return <CheckSquare className="w-6 h-6 text-purple-400" />;
      default: return <User className="w-6 h-6 text-gray-400" />;
    }
  };

  const connectionStatus = getConnectionStatus();
  const cameraPermissionStatus = getCameraPermissionStatus();

  const formatTime = (timeString) => {
    if (!timeString) return '--:--';
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return timeString.slice(0, 5);
    }
  };

  // ==================== RENDER SECTION BOUTONS ====================

  const renderTwoButtonSystem = () => {
    return (
      <div className="space-y-6">
        {/* Carte de statut */}
        <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-blue-400" />
              Système à 2 Boutons
            </h3>
            <button
              onClick={() => fetchAttendanceStatus()}
              disabled={attendanceStatus.loading}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${attendanceStatus.loading ? 'animate-spin' : ''}`} />
              {attendanceStatus.loading ? 'Actualisation...' : 'Actualiser'}
            </button>
          </div>
          
          {/* État actuel */}
          <div className="mb-8">
            <div className={`p-5 rounded-xl mb-6 border ${
              attendanceStatus.canCheckIn 
                ? 'bg-yellow-900/20 border-yellow-700/30' 
                : attendanceStatus.canCheckOut
                ? 'bg-blue-900/20 border-blue-700/30'
                : 'bg-green-900/20 border-green-700/30'
            }`}>
              <div className="flex items-start">
                <span className="text-2xl mr-3 mt-1">
                  {attendanceStatus.canCheckIn ? '⏰' : 
                   attendanceStatus.canCheckOut ? '🚪' : 
                   '✅'}
                </span>
                <div>
                  <p className="font-medium text-white mb-2">
                    {attendanceStatus.canCheckIn 
                      ? 'Prêt pour le pointage d\'arrivée' 
                      : attendanceStatus.canCheckOut
                      ? 'Prêt pour le pointage de départ'
                      : 'Pointage complet pour aujourd\'hui'}
                  </p>
                  
                  {(attendanceStatus.checkInTime || attendanceStatus.checkOutTime) && (
                    <div className="mt-3 space-y-2 text-sm">
                      {attendanceStatus.checkInTime && (
                        <div className="flex items-center gap-2">
                          <DoorOpen className="w-4 h-4 text-green-400" />
                          <span className="text-gray-300">Arrivée:</span>
                          <span className="text-white font-mono">{formatTime(attendanceStatus.checkInTime)}</span>
                        </div>
                      )}
                      {attendanceStatus.checkOutTime && (
                        <div className="flex items-center gap-2">
                          <DoorClosed className="w-4 h-4 text-blue-400" />
                          <span className="text-gray-300">Départ:</span>
                          <span className="text-white font-mono">{formatTime(attendanceStatus.checkOutTime)}</span>
                        </div>
                      )}
                      {attendanceStatus.hoursWorked && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-purple-400" />
                          <span className="text-gray-300">Heures travaillées:</span>
                          <span className="text-white font-mono">{attendanceStatus.hoursWorked}h</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Boutons d'action */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bouton Arrivée */}
              <button
                onClick={startCaptureCheckIn}
                disabled={!attendanceStatus.canCheckIn || cameraPermissions !== 'granted' || stats.apiStatus === 'error'}
                className={`group relative overflow-hidden p-6 rounded-xl text-center transition-all duration-300 ${
                  attendanceStatus.canCheckIn && cameraPermissions === 'granted' && stats.apiStatus !== 'error'
                    ? 'bg-gradient-to-br from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-lg hover:shadow-xl hover:scale-[1.02]'
                    : 'bg-gray-800 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex flex-col items-center">
                  <div className="relative mb-4">
                    <DoorOpen className="w-12 h-12 text-white" />
                    <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {attendanceStatus.canCheckIn ? 'Actif' : 'Inactif'}
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2">Pointer l'arrivée</h3>
                  <p className="text-sm opacity-90">
                    {attendanceStatus.canCheckIn
                      ? 'Cliquez pour pointer votre arrivée'
                      : attendanceStatus.checkInTime
                      ? `Déjà pointé à ${formatTime(attendanceStatus.checkInTime)}`
                      : 'Non disponible'
                    }
                  </p>
                  
                  {!attendanceStatus.canCheckIn && attendanceStatus.checkInTime && (
                    <div className="mt-3 text-xs text-green-300 bg-green-900/30 px-3 py-1 rounded-full">
                      ✓ Arrivée déjà enregistrée
                    </div>
                  )}
                </div>
                
                {/* Effet hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </button>
              
              {/* Bouton Départ */}
              <button
                onClick={startCaptureCheckOut}
                disabled={!attendanceStatus.canCheckOut || cameraPermissions !== 'granted' || stats.apiStatus === 'error'}
                className={`group relative overflow-hidden p-6 rounded-xl text-center transition-all duration-300 ${
                  attendanceStatus.canCheckOut && cameraPermissions === 'granted' && stats.apiStatus !== 'error'
                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg hover:shadow-xl hover:scale-[1.02]'
                    : 'bg-gray-800 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex flex-col items-center">
                  <div className="relative mb-4">
                    <DoorClosed className="w-12 h-12 text-white" />
                    <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {attendanceStatus.canCheckOut ? 'Actif' : 'Inactif'}
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2">Pointer le départ</h3>
                  <p className="text-sm opacity-90">
                    {attendanceStatus.canCheckOut
                      ? 'Cliquez pour pointer votre départ'
                      : attendanceStatus.checkOutTime
                      ? `Déjà pointé à ${formatTime(attendanceStatus.checkOutTime)}`
                      : attendanceStatus.checkInTime
                      ? 'Arrivée non pointée'
                      : 'Non disponible'
                    }
                  </p>
                  
                  {attendanceStatus.checkOutTime && (
                    <div className="mt-3 text-xs text-blue-300 bg-blue-900/30 px-3 py-1 rounded-full">
                      ✓ Départ déjà enregistré
                    </div>
                  )}
                </div>
                
                {/* Effet hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </button>
            </div>
          </div>
          
          {/* Informations système */}
          <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-700">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-300 text-sm font-medium mb-2">
                  Comment fonctionne le système 2 boutons :
                </p>
                <ul className="text-gray-400 text-xs space-y-1">
                  <li>• <span className="text-green-400">Bouton vert</span> : Pointer votre arrivée (une fois par jour)</li>
                  <li>• <span className="text-blue-400">Bouton bleu</span> : Pointer votre départ (après l'arrivée)</li>
                  <li>• Les boutons s'activent/désactivent automatiquement</li>
                  <li>• Votre historique de pointage est sauvegardé</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bouton mode auto (compatibilité) */}
        <div className="text-center">
          <button
            onClick={() => {
              setAttendanceMode('auto');
              startCapture();
            }}
            disabled={cameraPermissions !== 'granted' || stats.apiStatus === 'error'}
            className="inline-flex items-center gap-3 py-3 px-6 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 rounded-xl text-white font-medium transition-all"
          >
            <UserCheck className="w-5 h-5" />
            Mode automatique (reconnaissance intelligente)
          </button>
          <p className="text-gray-500 text-sm mt-2">
            Le mode auto détecte automatiquement si vous devez pointer l'arrivée ou le départ
          </p>
        </div>
      </div>
    );
  };

  // ==================== RENDER RÉSULTAT AVEC NOM ET PRÉNOM ====================

  const renderAttendanceResult = () => {
    if (!attendanceResult) return null;

    const { 
      success, 
      recognized, 
      attendanceRecorded, 
      alreadyChecked, 
      action,
      match,
      attendance,
      frontend = {},
      userMessage,
      processingTime
    } = attendanceResult;

    // Extraire les informations de l'employé
    const employeeName = match?.employeeName || frontend?.employeeInfo?.fullName;
    const firstName = match?.firstName || frontend?.employeeInfo?.firstName || employeeName?.split(' ')[0];
    const lastName = match?.lastName || frontend?.employeeInfo?.lastName || employeeName?.split(' ').slice(1).join(' ');
    const department = match?.department || frontend?.employeeInfo?.department;

    // 1. CHECK-IN RÉUSSI
    if (success && recognized && attendanceRecorded && action === 'checkin') {
      return (
        <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 rounded-2xl p-8 border border-green-700/30 animate-fadeIn">
          <div className="text-center mb-8">
            {/* Avatar avec initiales */}
            <div className="relative inline-block mb-6">
              <div className="w-32 h-32 bg-gradient-to-br from-green-600/20 to-green-400/20 rounded-full flex items-center justify-center shadow-2xl mb-4">
                <div className="text-4xl text-white font-bold">
                  {firstName?.charAt(0)}{lastName?.charAt(0)}
                </div>
              </div>
              <div className="absolute -top-2 -right-2 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                Arrivée
              </div>
            </div>
            
            {/* Nom et prénom en grand */}
            <h2 className="text-3xl font-bold text-white mb-3">
              Bonjour {firstName} !
            </h2>
            
            {/* Message personnalisé */}
            <p className="text-green-400 text-xl font-medium mb-4">
              {employeeName}
            </p>
            
            {/* Détails */}
            <div className="bg-gray-900/50 p-6 rounded-xl mb-8">
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-gray-400 text-sm mb-1">Heure d'arrivée</div>
                  <div className="text-green-400 text-3xl font-bold font-mono">
                    {attendance?.checkInFormatted || formatTime(attendance?.checkIn) || '--:--'}
                  </div>
                </div>
                
                {department && (
                  <div className="text-center">
                    <div className="text-gray-400 text-sm mb-1">Département</div>
                    <div className="text-white text-lg font-semibold">{department}</div>
                  </div>
                )}
                
                {match?.employeeId && (
                  <div className="text-center">
                    <div className="text-gray-400 text-sm mb-1">ID Employé</div>
                    <div className="text-blue-400 font-mono">{match.employeeId}</div>
                  </div>
                )}
                
                {frontend.showCheckOutButton && (
                  <div className="mt-6 p-4 bg-green-900/30 rounded-lg">
                    <p className="text-green-300 text-center text-lg">
                      Vous pouvez maintenant pointer votre départ lorsque vous partez
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Bouton pour pointer le départ maintenant (optionnel) */}
            {frontend.showCheckOutButton && (
              <div className="mt-6">
                <button
                  onClick={() => {
                    setAttendanceMode('checkout');
                    startCapture();
                  }}
                  className="inline-flex items-center gap-3 py-3 px-8 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-xl text-white font-semibold transition-all shadow-lg hover:shadow-xl"
                >
                  <DoorClosed className="w-5 h-5" />
                  Pointer le Départ maintenant
                </button>
                <p className="text-gray-400 text-sm mt-3">
                  Vous pouvez pointer votre départ maintenant ou plus tard
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 2. CHECK-OUT RÉUSSI
    if (success && recognized && attendanceRecorded && action === 'checkout') {
      return (
        <div className="bg-gradient-to-br from-blue-900/20 to-indigo-900/20 rounded-2xl p-8 border border-blue-700/30 animate-fadeIn">
          <div className="text-center mb-8">
            {/* Avatar avec initiales */}
            <div className="relative inline-block mb-6">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-600/20 to-blue-400/20 rounded-full flex items-center justify-center shadow-2xl mb-4">
                <div className="text-4xl text-white font-bold">
                  {firstName?.charAt(0)}{lastName?.charAt(0)}
                </div>
              </div>
              <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                Départ
              </div>
            </div>
            
            {/* Nom et prénom en grand */}
            <h2 className="text-3xl font-bold text-white mb-3">
              Au revoir {firstName} !
            </h2>
            
            {/* Message personnalisé */}
            <p className="text-blue-400 text-xl font-medium mb-4">
              {employeeName}
            </p>
            
            {/* Détails */}
            <div className="bg-gray-900/50 p-6 rounded-xl mb-8">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-gray-400 text-sm mb-1">Arrivée</div>
                    <div className="text-green-400 text-2xl font-bold font-mono">
                      {attendance?.checkInFormatted || formatTime(attendance?.checkIn) || '--:--'}
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-gray-400 text-sm mb-1">Départ</div>
                    <div className="text-blue-400 text-2xl font-bold font-mono">
                      {attendance?.checkOutFormatted || formatTime(attendance?.checkOut) || '--:--'}
                    </div>
                  </div>
                </div>
                
                {department && (
                  <div className="text-center">
                    <div className="text-gray-400 text-sm mb-1">Département</div>
                    <div className="text-white text-lg font-semibold">{department}</div>
                  </div>
                )}
                
                {attendance?.hoursWorked && (
                  <div className="mt-4 p-4 bg-blue-900/30 rounded-lg">
                    <div className="text-center">
                      <div className="text-gray-400 text-sm mb-1">Total heures travaillées</div>
                      <div className="text-blue-300 text-3xl font-bold">
                        {parseFloat(attendance.hoursWorked).toFixed(2)} heures
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Message de fin */}
            <div className="p-4 bg-gradient-to-r from-blue-900/20 to-indigo-900/20 rounded-xl border border-blue-800/30">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-blue-300 font-medium">
                    Votre pointage est terminé pour aujourd'hui
                  </p>
                  <p className="text-blue-400/80 text-sm mt-1">
                    Merci pour votre travail aujourd'hui {firstName} !
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 3. DÉJÀ POINTÉ
    if (success && recognized && alreadyChecked) {
      return (
        <div className="bg-gradient-to-br from-yellow-900/20 to-amber-900/20 rounded-2xl p-8 border border-yellow-700/30">
          <div className="text-center mb-8">
            {/* Avatar avec initiales */}
            <div className="relative inline-block mb-6">
              <div className="w-32 h-32 bg-gradient-to-br from-yellow-600/20 to-yellow-400/20 rounded-full flex items-center justify-center shadow-2xl mb-4">
                <div className="text-4xl text-white font-bold">
                  {firstName?.charAt(0)}{lastName?.charAt(0)}
                </div>
              </div>
              <div className="absolute -top-2 -right-2 bg-yellow-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                Info
              </div>
            </div>
            
            {/* Nom et prénom en grand */}
            <h2 className="text-3xl font-bold text-white mb-3">
              Bonjour {firstName} !
            </h2>
            
            <p className="text-yellow-400 text-xl font-medium mb-6">
              {employeeName}
            </p>
            
            {/* Message */}
            <div className="bg-yellow-900/30 rounded-xl p-5 mb-6">
              <div className="text-center">
                <p className="text-yellow-300 text-lg mb-3">
                  {frontend.status === 'already_checked_out' 
                    ? 'Pointage complet pour aujourd\'hui' 
                    : 'Vous avez déjà pointé aujourd\'hui'}
                </p>
                
                {attendance?.checkInFormatted && attendance?.checkOutFormatted && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-center gap-4">
                      <div>
                        <div className="text-gray-400 text-sm">Arrivée</div>
                        <div className="text-green-400 font-bold">{attendance.checkInFormatted}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-sm">Départ</div>
                        <div className="text-blue-400 font-bold">{attendance.checkOutFormatted}</div>
                      </div>
                    </div>
                    {attendance.hoursWorked && (
                      <div className="mt-2">
                        <div className="text-gray-400 text-sm">Durée</div>
                        <div className="text-yellow-300 font-bold">{attendance.hoursWorked} heures</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <button
              onClick={reset}
              className="inline-flex items-center gap-3 py-3 px-8 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 rounded-xl text-white font-semibold transition-all shadow-lg hover:shadow-xl"
            >
              <RefreshCw className="w-5 h-5" />
              Réessayer
            </button>
          </div>
        </div>
      );
    }

    // 4. NON RECONNU
    if (!recognized) {
      return (
        <div className="bg-gradient-to-br from-red-900/20 to-pink-900/20 rounded-2xl p-8 border border-red-700/30 animate-shake">
          <div className="text-center mb-8">
            <div className="relative inline-block mb-6">
              <div className="w-32 h-32 bg-gradient-to-br from-red-600/20 to-red-400/20 rounded-2xl flex items-center justify-center shadow-2xl">
                <div className="text-4xl text-white">?</div>
              </div>
              <div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                Erreur
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-3">
              Visage non reconnu
            </h2>
            
            <p className="text-red-400 text-lg font-medium mb-6">
              {userMessage || 'Impossible de vous identifier'}
            </p>
            
            {/* Suggestions */}
            {frontend.suggestions && frontend.suggestions.length > 0 && (
              <div className="bg-red-900/30 rounded-xl p-5 mb-6">
                <h4 className="text-red-300 font-semibold mb-3">Suggestions :</h4>
                <ul className="space-y-2 text-left">
                  {frontend.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-red-400 mt-1">•</span>
                      <span className="text-red-200/80">{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <button
              onClick={reset}
              className="inline-flex items-center gap-3 py-3 px-8 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 rounded-xl text-white font-semibold transition-all shadow-lg hover:shadow-xl"
            >
              <RefreshCw className="w-5 h-5" />
              Réessayer
            </button>
          </div>
        </div>
      );
    }

    // 5. ERREUR GÉNÉRIQUE
    return (
      <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 rounded-2xl p-8 border border-yellow-700/30">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-3">
            Erreur de reconnaissance
          </h2>
          <p className="text-yellow-400 mb-6">
            {userMessage || 'Une erreur est survenue'}
          </p>
          <button
            onClick={reset}
            className="inline-flex items-center gap-3 py-3 px-8 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 rounded-xl text-white font-semibold transition-all"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  };

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-3xl mb-6 shadow-2xl">
            <UserCheck className="w-12 h-12 text-blue-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            Pointage par Reconnaissance Faciale
          </h1>
          <p className="text-gray-300 text-lg md:text-xl max-w-3xl mx-auto">
            Système à 2 boutons - Gestion complète Arrivée & Départ
          </p>
          
          {/* Stats rapides */}
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <div className="bg-gray-800/50 backdrop-blur-sm px-4 py-2 rounded-xl border border-gray-700 min-w-[140px]">
              <div className="text-blue-400 font-bold text-xl flex items-center gap-2">
                {stats.todayCount}
                <Activity className="w-4 h-4" />
              </div>
              <div className="text-gray-400 text-sm">Pointages aujourd'hui</div>
              <div className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {stats.lastUpdated}
              </div>
            </div>
            
            <div className="bg-gray-800/50 backdrop-blur-sm px-4 py-2 rounded-xl border border-gray-700 min-w-[140px]">
              <div className="text-green-400 font-bold text-xl">{stats.totalEmployees}</div>
              <div className="text-gray-400 text-sm">Employés total</div>
              <button 
                onClick={fetchStats}
                className="text-gray-500 text-xs mt-1 hover:text-gray-300 transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Actualiser
              </button>
            </div>
            
            <div className={`${connectionStatus.bg} backdrop-blur-sm px-4 py-2 rounded-xl border ${connectionStatus.border} min-w-[140px]`}>
              <div className={`font-bold text-xl flex items-center gap-2 ${connectionStatus.color}`}>
                {connectionStatus.icon}
                {connectionStatus.text}
              </div>
              <div className="text-gray-400 text-sm">État serveur</div>
              <button 
                onClick={testAPIConnection}
                className="text-gray-500 text-xs mt-1 hover:text-gray-300 transition-colors flex items-center gap-1"
              >
                <Wifi className="w-3 h-3" />
                Tester connexion
              </button>
            </div>
            
            <div className={`${cameraPermissionStatus.bg} backdrop-blur-sm px-4 py-2 rounded-xl border ${cameraPermissionStatus.border} min-w-[140px]`}>
              <div className={`font-bold text-xl flex items-center gap-2 ${cameraPermissionStatus.color}`}>
                {cameraPermissionStatus.icon}
                {cameraPermissionStatus.text}
              </div>
              <div className="text-gray-400 text-sm">Permission caméra</div>
              <button 
                onClick={() => window.location.reload()}
                className="text-gray-500 text-xs mt-1 hover:text-gray-300 transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Rafraîchir
              </button>
            </div>
            
            <div className="bg-gray-800/50 backdrop-blur-sm px-4 py-2 rounded-xl border border-gray-700 min-w-[140px]">
              <div className="text-purple-400 font-bold text-xl flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {stats.averageResponseTime}ms
              </div>
              <div className="text-gray-400 text-sm">Temps réponse</div>
              <div className={`text-xs mt-1 ${getSystemLoadColor()}`}>
                {stats.systemLoad === 'optimal' ? 'Optimal' : 
                 stats.systemLoad === 'normal' ? 'Normal' : 'Élevé'}
              </div>
            </div>
          </div>
          
          {/* Indicateur système 2 boutons */}
          <div className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-blue-900/30 to-indigo-900/30 px-4 py-2 rounded-full border border-blue-700/30">
            <ArrowRightLeft className="w-4 h-4 text-blue-400" />
            <span className="text-blue-300 text-sm font-medium">Système à 2 boutons activé • Arrivée/Départ séparés</span>
          </div>
          
          {/* Avertissement si API déconnectée */}
          {stats.apiStatus === 'error' && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg max-w-md mx-auto">
              <div className="flex items-center gap-2 text-red-300">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Serveur backend déconnecté</p>
                  <p className="text-red-300/80 text-sm">
                    Lancez le serveur avec: <code className="bg-red-900/50 px-2 py-1 rounded text-xs ml-1">npm run dev</code>
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Avertissement si caméra non autorisée */}
          {cameraPermissions === 'denied' && (
            <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg max-w-md mx-auto">
              <div className="flex items-center gap-2 text-yellow-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Accès caméra refusé</p>
                  <p className="text-yellow-300/80 text-sm">
                    Autorisez l'accès à la caméra dans les paramètres du navigateur
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Panel - Instructions et Boutons */}
          <div className="space-y-8">
            {/* Système 2 Boutons */}
            {renderTwoButtonSystem()}
            
            {/* Instructions */}
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <Info className="w-6 h-6 text-blue-400" />
                Mode d'emploi
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-gray-900/30 rounded-xl">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-900/30 rounded-lg flex items-center justify-center">
                    <span className="text-green-300 font-bold">1</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Bouton Arrivée (Vert)</h3>
                    <p className="text-gray-300 text-sm">
                      Cliquez une fois par jour pour pointer votre arrivée. Le bouton devient inactif après utilisation.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 bg-gray-900/30 rounded-xl">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <span className="text-blue-300 font-bold">2</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Bouton Départ (Bleu)</h3>
                    <p className="text-gray-300 text-sm">
                      Cliquez pour pointer votre départ. Disponible seulement après avoir pointé l'arrivée.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 bg-gray-900/30 rounded-xl">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <span className="text-purple-300 font-bold">3</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Mode Automatique</h3>
                    <p className="text-gray-300 text-sm">
                      Le système détecte automatiquement si vous devez pointer l'arrivée ou le départ.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Camera et résultats */}
          <div>
            {/* État initial - Système 2 boutons déjà affiché */}
            {step === 'initial' && (
              <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl p-10 text-center border border-gray-700 shadow-xl h-full flex flex-col justify-center">
                <div className="mb-10">
                  <div className="inline-flex items-center justify-center w-32 h-32 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 rounded-3xl mb-8 shadow-2xl">
                    <Camera className="w-16 h-16 text-blue-400" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-4">
                    Prêt à pointer ?
                  </h2>
                  <p className="text-gray-300 text-lg mb-8 max-w-md mx-auto">
                    Utilisez les boutons vert (arrivée) ou bleu (départ) pour commencer
                  </p>
                  
                  {/* Bouton Plein Écran */}
                  <div className="max-w-sm mx-auto space-y-4">
                    <button
                      onClick={handleStartFullScreenRecognition}
                      className="w-full inline-flex items-center justify-center gap-3 py-5 px-8 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl text-white font-bold text-lg transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Maximize2 className="w-6 h-6" />
                      Mode Plein Écran
                    </button>
                    
                    <p className="text-gray-500 text-sm mt-4">
                      Sélectionnez un mode ci-dessus ou utilisez le système à 2 boutons
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <p className="text-gray-500 text-sm flex items-center justify-center gap-2">
                    <Shield className="w-4 h-4" />
                    Système sécurisé • Reconnaissance faciale • Gestion complète
                  </p>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    <Home className="w-4 h-4" />
                    Retour au tableau de bord
                  </button>
                </div>
              </div>
            )}

            {/* Capture en cours */}
            {step === 'capturing' && (
              <div className="space-y-6">
                {cameraPermissions !== 'granted' && (
                  <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
                      <div>
                        <p className="text-red-300 font-medium">Accès caméra refusé</p>
                        <p className="text-red-300/80 text-sm">
                          Cliquez sur l'icône de cadenas dans la barre d'adresse pour autoriser l'accès à la caméra.
                        </p>
                        <button 
                          onClick={() => window.location.reload()}
                          className="mt-2 text-red-300 text-sm underline hover:text-red-200 transition-colors"
                        >
                          Rafraîchir la page après autorisation
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                <FacialCamera
                  onCapture={handleCapture}
                  onCancel={reset}
                  mode="attendance"
                  title={`Pointage ${attendanceMode === 'checkin' ? 'd\'Arrivée' : 'de Départ'} - Reconnaissance Faciale`}
                  showInstructions={true}
                  autoCapture={false}
                  showDebug={showAdvancedSettings}
                />
                
                {/* Indicateur de statut */}
                <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        cameraPermissions === 'granted' ? 'bg-green-500 animate-pulse' : 
                        cameraPermissions === 'denied' ? 'bg-red-500' : 
                        'bg-yellow-500 animate-pulse'
                      }`} />
                      <span className="text-gray-300">
                        {cameraPermissions === 'granted' ? 'Caméra autorisée' : 
                         cameraPermissions === 'denied' ? 'Caméra refusée' : 
                         'Vérification des permissions...'}
                      </span>
                    </div>
                    <div className="text-sm px-3 py-1 rounded-full bg-gray-700 text-gray-300">
                      {attendanceMode === 'checkin' ? 'Arrivée' : 'Départ'}
                    </div>
                    <button
                      onClick={reset}
                      className="text-gray-400 hover:text-white text-sm transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Traitement en cours */}
            {step === 'processing' && (
              <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl p-12 text-center border border-gray-700 shadow-xl h-full flex flex-col justify-center items-center">
                <div className="relative">
                  <div className="relative">
                    <Loader className="w-20 h-20 text-blue-400 animate-spin mb-8" />
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-full blur-xl"></div>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">
                  {attendanceMode === 'checkin' ? 'Enregistrement de l\'arrivée...' : 'Enregistrement du départ...'}
                </h2>
                <p className="text-gray-400 text-lg max-w-md">
                  Reconnaissance faciale en cours
                </p>
                <div className="mt-8 w-full max-w-sm">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full animate-pulse"></div>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-gray-500 text-sm">0s</span>
                    <span className="text-green-400 text-sm font-medium">Analyse...</span>
                    <span className="text-gray-500 text-sm">3.5s</span>
                  </div>
                </div>
              </div>
            )}

            {/* Résultat */}
            {step === 'result' && (
              <div className="space-y-6">
                {renderAttendanceResult()}
                
                {/* Performance metrics */}
                {attendanceResult?.processingTime && (
                  <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 rounded-xl p-6 border border-gray-700">
                    <div className="text-center mb-4">
                      <h3 className="text-white font-semibold mb-2 flex items-center justify-center gap-2">
                        <Activity className="w-5 h-5 text-purple-400" />
                        Performance de traitement
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="text-center">
                        <div className="text-gray-400 text-sm mb-2">Temps total</div>
                        <div className={`text-2xl font-bold font-mono ${
                          attendanceResult.processingTime < 2000 ? 'text-green-400' :
                          attendanceResult.processingTime < 3000 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {attendanceResult.processingTime}ms
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-gray-400 text-sm mb-2">Mode</div>
                        <div className={`text-2xl font-bold ${
                          attendanceResult.processingTime < 3000 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {attendanceResult.action === 'checkin' ? '📍 Arrivée' : '🚪 Départ'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Photo capturée */}
                {capturedImage && (
                  <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <Camera className="w-5 h-5 text-blue-400" />
                      Photo de reconnaissance
                    </h3>
                    <div className="relative rounded-xl overflow-hidden border-2 border-gray-700 shadow-lg">
                      <img 
                        src={capturedImage} 
                        alt="Visage capturé pour la reconnaissance" 
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
                
                {/* Boutons d'action après résultat */}
                <div className="text-center space-y-3">
                  <button
                    onClick={reset}
                    className="inline-flex items-center gap-3 py-3 px-8 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 rounded-xl text-white font-semibold transition-all shadow-lg hover:shadow-xl"
                  >
                    <UserCheck className="w-5 h-5" />
                    Nouvelle reconnaissance
                  </button>
                  
                  {/* Si départ réussi, montrer le bouton pour voir l'historique */}
                  {attendanceResult.success && attendanceResult.action === 'checkout' && (
                    <button
                      onClick={() => navigate('/attendance/history')}
                      className="inline-flex items-center gap-3 py-2 px-6 bg-gradient-to-r from-purple-700 to-purple-800 hover:from-purple-600 hover:to-purple-700 rounded-xl text-white font-medium transition-all"
                    >
                      <History className="w-5 h-5" />
                      Voir l'historique des pointages
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-800/50 text-center">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-gray-500 text-sm">
              <p>Système 2 Boutons • Version 5.0.0</p>
              <p className="text-gray-600 mt-1 flex items-center justify-center gap-2">
                <ArrowRightLeft className="w-3 h-3" />
                Arrivée/Départ séparés • Interface intuitive • Performance optimale
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  stats.apiStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
                  stats.apiStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                }`}></div>
                <span className="text-gray-400 text-sm">
                  {stats.apiStatus === 'connected' ? 'Serveur connecté' : 
                   stats.apiStatus === 'error' ? 'Serveur déconnecté' : 'Vérification...'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  cameraPermissions === 'granted' ? 'bg-green-500 animate-pulse' : 
                  cameraPermissions === 'denied' ? 'bg-red-500' : 
                  cameraPermissions === 'checking' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'
                }`}></div>
                <span className="text-gray-400 text-sm">
                  {cameraPermissions === 'granted' ? 'Caméra autorisée' : 
                   cameraPermissions === 'denied' ? 'Caméra refusée' : 
                   cameraPermissions === 'checking' ? 'Vérification...' : 'Caméra'}
                </span>
              </div>
              <div className="text-gray-600 text-sm">
                {new Date().toLocaleDateString('fr-FR', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
              <button 
                onClick={() => {
                  fetchStats();
                  fetchAttendanceStatus();
                }}
                className="text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Actualiser
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Styles CSS - CORRIGÉ : sans attribut jsx */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        
        .animate-slideIn {
          animation: slideIn 0.5s ease-out;
        }
        
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default AttendanceByFace;