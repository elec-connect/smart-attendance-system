import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { settingsService, authService } from '../services/api';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Card from '../components/common/Card';
import HelpSection from '../components/settings/HelpSection';
import { 
  FaCog, 
  FaSave, 
  FaUndo, 
  FaBuilding, 
  FaClock, 
  FaBell,
  FaLaptop,
  FaUserShield,
  FaLock,
  FaCheckCircle,
  FaTimesCircle,
  FaLifeRing,
  FaSync
} from 'react-icons/fa';

const SettingsPage = () => {
  console.log('🎯 SettingsPage chargée');
  
  // État initial avec structure garantie
  const [settings, setSettings] = useState({
    company: {
      name: '',
      address: '',
      contactEmail: '',
      phone: ''
    },
    attendance: {
      workStartTime: '08:00',
      workEndTime: '17:00',
      lateThreshold: '09:15',
      halfDayThreshold: '12:00',
      workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      breakDuration: 60,
      overtimeEnabled: false,
      overtimeThreshold: 8
    },
    shifts: {
      shift1: { name: 'Shift Standard', start: '08:00', end: '17:00' },
      shift2: { name: 'Shift Matin', start: '06:00', end: '14:00' },
      shift3: { name: 'Shift Après-midi', start: '14:00', end: '22:00' },
      shift4: { name: 'Shift Nuit', start: '22:00', end: '06:00' }
    },
    notifications: {
      emailReminders: true,
      pushNotifications: true,
      checkInReminderTime: '08:45',
      monthlyReport: true,
      weeklySummary: true
    },
    features: {
      qrCodeCheckin: false,
      facialRecognition: true,
      geoLocation: false,
      multiShift: true,
      manualCheckin: true
    }
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [activeTab, setActiveTab] = useState('general');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Charger les paramètres
  useEffect(() => {
    console.log('🔄 useEffect - Chargement initial des paramètres');
    loadSettings(true); // Force le chargement initial
  }, []);

  // Fonction pour charger les paramètres avec option de force
  const loadSettings = async (force = false) => {
    console.log(`🔄 loadSettings appelé (force: ${force})`);
    
    if (refreshing) {
      console.log('⏳ Refresh déjà en cours, skip...');
      return;
    }

    setRefreshing(true);
    if (!force) setLoading(true);
    
    try {
      console.log('📡 Appel API pour les paramètres...');
      
      // Options pour l'appel API
      const options = force ? { skipCache: true } : {};
      
      // CORRECTION: Appel API avec gestion correcte de la réponse
      const response = await settingsService.getSettings(options);
      
      console.log('📥 Réponse API complète:', response);
      
      // 🔧 CORRECTION IMPORTANTE: Vérifier la structure de la réponse
      let settingsData;
      
      if (response && typeof response === 'object') {
        // Si response a une propriété 'data', c'est là que sont les settings
        if (response.data && typeof response.data === 'object') {
          settingsData = response.data;
        } 
        // Sinon, response est directement les settings
        else {
          settingsData = response;
        }
      } else {
        console.warn('⚠️ Réponse API invalide, utilisation des valeurs par défaut');
        settingsData = {};
      }
      
      console.log('📊 Données settings extraites:', settingsData);
      console.log('🎯 Features dans les données:', settingsData.features);
      
      // Mettre à jour l'état avec les données reçues
      const updatedSettings = {
        company: settingsData.company || settings.company,
        attendance: settingsData.attendance || settings.attendance,
        shifts: settingsData.shifts || settings.shifts,
        notifications: settingsData.notifications || settings.notifications,
        // CORRECTION: S'assurer que features a toujours toutes les propriétés
        features: {
          qrCodeCheckin: settingsData.features?.qrCodeCheckin ?? false,
          facialRecognition: settingsData.features?.facialRecognition ?? true,
          geoLocation: settingsData.features?.geoLocation ?? false,
          multiShift: settingsData.features?.multiShift ?? true,
          manualCheckin: settingsData.features?.manualCheckin ?? true
        }
      };
      
      console.log('🔄 Settings après mise à jour:', updatedSettings.features);
      
      setSettings(updatedSettings);
      setLastUpdated(new Date().toISOString());
      
      // Sauvegarder dans localStorage pour debug
      localStorage.setItem('last_settings_loaded', JSON.stringify(updatedSettings));
      
      toast.success('Paramètres chargés avec succès');
      
    } catch (error) {
      console.error('❌ Erreur chargement paramètres:', error);
      toast.error(`Erreur chargement: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleInputChange = (section, field, value) => {
    console.log(`✏️ Modification: ${section}.${field} =`, value);
    
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleDeepChange = (section, subsection, field, value) => {
    console.log(`✏️ Modification: ${section}.${subsection}.${field} =`, value);
    
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [subsection]: {
          ...prev[section][subsection],
          [field]: value
        }
      }
    }));
  };

  const handleFeatureToggle = (featureName, value) => {
    console.log(`🔄 Feature ${featureName} changé à:`, value);
    
    setSettings(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [featureName]: Boolean(value)
      }
    }));
  };

  const handleArrayChange = (section, field, value, index) => {
    const newArray = [...settings[section][field]];
    newArray[index] = value;
    
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: newArray
      }
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (passwordErrors[name]) {
      setPasswordErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validatePassword = () => {
    const errors = {};

    if (!passwordData.currentPassword) {
      errors.currentPassword = 'Le mot de passe actuel est requis';
    }

    if (!passwordData.newPassword) {
      errors.newPassword = 'Le nouveau mot de passe est requis';
    } else if (passwordData.newPassword.length < 6) {
      errors.newPassword = 'Le mot de passe doit contenir au moins 6 caractères';
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    return errors;
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    const errors = validatePassword();
    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    try {
      const response = await authService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      if (response.success) {
        toast.success('Mot de passe changé avec succès');
        setShowPasswordForm(false);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setPasswordErrors({});
      }
    } catch (error) {
      console.error('Erreur changement mot de passe:', error);
      toast.error(error.response?.data?.message || 'Erreur lors du changement de mot de passe');
    }
  };

  const handleSaveSettings = async () => {
    console.log('💾 Début sauvegarde paramètres...');
    console.log('📤 Données à sauvegarder:', settings);
    
    setSaving(true);
    try {
      // CORRECTION: Envoyer les settings dans le format attendu par le backend
      const dataToSend = {
        features: settings.features,
        company: settings.company,
        attendance: settings.attendance,
        shifts: settings.shifts,
        notifications: settings.notifications
      };
      
      console.log('📦 Données envoyées:', dataToSend);
      
      const response = await settingsService.updateSettings(dataToSend);
      
      console.log('✅ Réponse sauvegarde:', response);
      
      if (response && response.success !== false) {
        toast.success('Paramètres sauvegardés avec succès!');
        
        // ⭐ IMPORTANT: Recharger les settings APRÈS la sauvegarde
        setTimeout(() => {
          loadSettings(true); // Force le rechargement
        }, 1000);
        
      } else {
        toast.error(response?.message || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde paramètres:', error);
      toast.error(`Erreur sauvegarde: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetSettings = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir réinitialiser tous les paramètres aux valeurs par défaut ?')) {
      try {
        // Pour l'instant, on simule une réinitialisation côté frontend
        const defaultSettings = {
          company: {
            name: '',
            address: '',
            contactEmail: '',
            phone: ''
          },
          attendance: {
            workStartTime: '08:00',
            workEndTime: '17:00',
            lateThreshold: '09:15',
            halfDayThreshold: '12:00',
            workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
            breakDuration: 60,
            overtimeEnabled: false,
            overtimeThreshold: 8
          },
          shifts: {
            shift1: { name: 'Shift Standard', start: '08:00', end: '17:00' },
            shift2: { name: 'Shift Matin', start: '06:00', end: '14:00' },
            shift3: { name: 'Shift Après-midi', start: '14:00', end: '22:00' },
            shift4: { name: 'Shift Nuit', start: '22:00', end: '06:00' }
          },
          notifications: {
            emailReminders: true,
            pushNotifications: true,
            checkInReminderTime: '08:45',
            monthlyReport: true,
            weeklySummary: true
          },
          features: {
            qrCodeCheckin: false,
            facialRecognition: true,
            geoLocation: false,
            multiShift: true,
            manualCheckin: true
          }
        };
        
        setSettings(defaultSettings);
        toast.success('Paramètres réinitialisés localement');
        
        // Sauvegarder les valeurs par défaut
        await settingsService.updateSettings(defaultSettings);
        
        // Recharger pour confirmer
        loadSettings(true);
        
      } catch (error) {
        console.error('Erreur réinitialisation:', error);
        toast.error('Erreur lors de la réinitialisation');
      }
    }
  };

  // Fonction pour vérifier manuellement les paramètres
  const verifySettings = async () => {
    try {
      console.log('🔍 Vérification manuelle des paramètres...');
      const response = await settingsService.getSettings({ skipCache: true });
      
      console.log('🔍 Données API (fresh):', response?.data?.features || response?.features);
      console.log('🔍 Données locales:', settings.features);
      
      const apiFeatures = response?.data?.features || response?.features || {};
      const localFeatures = settings.features;
      
      // Comparer
      let allMatch = true;
      Object.keys(localFeatures).forEach(key => {
        if (apiFeatures[key] !== localFeatures[key]) {
          console.log(`   ❌ ${key}: API=${apiFeatures[key]}, Local=${localFeatures[key]}`);
          allMatch = false;
        } else {
          console.log(`   ✅ ${key}: ${localFeatures[key]} (match)`);
        }
      });
      
      if (allMatch) {
        toast.success('✅ Paramètres synchronisés avec le serveur');
      } else {
        toast.error('⚠️ Différence détectée, rechargement...');
        loadSettings(true);
      }
    } catch (error) {
      console.error('❌ Erreur vérification:', error);
    }
  };

  const workDaysOptions = [
    { value: 'monday', label: 'Lundi' },
    { value: 'tuesday', label: 'Mardi' },
    { value: 'wednesday', label: 'Mercredi' },
    { value: 'thursday', label: 'Jeudi' },
    { value: 'friday', label: 'Vendredi' },
    { value: 'saturday', label: 'Samedi' },
    { value: 'sunday', label: 'Dimanche' }
  ];

  const tabs = [
    { id: 'general', label: 'Général', icon: FaBuilding },
    { id: 'attendance', label: 'Présence', icon: FaClock },
    { id: 'shifts', label: 'Shifts', icon: FaClock },
    { id: 'notifications', label: 'Notifications', icon: FaBell },
    { id: 'features', label: 'Fonctionnalités', icon: FaLaptop },
    { id: 'security', label: 'Sécurité', icon: FaUserShield },
    { id: 'help', label: 'Aide', icon: FaLifeRing }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <Card>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Informations de l'entreprise</h3>
            <div className="space-y-4">
              <Input
                label="Nom de l'entreprise"
                value={settings.company.name}
                onChange={(e) => handleInputChange('company', 'name', e.target.value)}
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse
                </label>
                <textarea
                  value={settings.company.address}
                  onChange={(e) => handleInputChange('company', 'address', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              <Input
                label="Email de contact"
                type="email"
                value={settings.company.contactEmail}
                onChange={(e) => handleInputChange('company', 'contactEmail', e.target.value)}
              />
              
              <Input
                label="Téléphone"
                value={settings.company.phone}
                onChange={(e) => handleInputChange('company', 'phone', e.target.value)}
              />
            </div>
          </Card>
        );
      
      case 'attendance':
        return (
          <Card>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Paramètres de présence</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Heure de début"
                type="time"
                value={settings.attendance.workStartTime}
                onChange={(e) => handleInputChange('attendance', 'workStartTime', e.target.value)}
              />
              
              <Input
                label="Heure de fin"
                type="time"
                value={settings.attendance.workEndTime}
                onChange={(e) => handleInputChange('attendance', 'workEndTime', e.target.value)}
              />
              
              <Input
                label="Seuil de retard (HH:MM)"
                type="time"
                value={settings.attendance.lateThreshold}
                onChange={(e) => handleInputChange('attendance', 'lateThreshold', e.target.value)}
                helperText="Heure à partir de laquelle un employé est considéré en retard"
              />
              
              <Input
                label="Seuil demi-journée (HH:MM)"
                type="time"
                value={settings.attendance.halfDayThreshold}
                onChange={(e) => handleInputChange('attendance', 'halfDayThreshold', e.target.value)}
              />
            </div>
            
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jours de travail
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {workDaysOptions.map((day) => (
                  <label key={day.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.attendance.workDays.includes(day.value)}
                      onChange={(e) => {
                        const newWorkDays = e.target.checked
                          ? [...settings.attendance.workDays, day.value]
                          : settings.attendance.workDays.filter(d => d !== day.value);
                        handleInputChange('attendance', 'workDays', newWorkDays);
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{day.label}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <Input
                label="Durée de pause (minutes)"
                type="number"
                value={settings.attendance.breakDuration}
                onChange={(e) => handleInputChange('attendance', 'breakDuration', parseInt(e.target.value) || 60)}
                min={0}
                max={180}
              />
              
              <div className="flex items-center space-x-3 mt-6">
                <input
                  type="checkbox"
                  id="overtimeEnabled"
                  checked={settings.attendance.overtimeEnabled}
                  onChange={(e) => handleInputChange('attendance', 'overtimeEnabled', e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="overtimeEnabled" className="text-sm font-medium text-gray-700">
                  Activer les heures supplémentaires
                </label>
              </div>
              
              {settings.attendance.overtimeEnabled && (
                <Input
                  label="Seuil heures supplémentaires (heures)"
                  type="number"
                  value={settings.attendance.overtimeThreshold}
                  onChange={(e) => handleInputChange('attendance', 'overtimeThreshold', parseInt(e.target.value) || 8)}
                  min={1}
                  max={12}
                />
              )}
            </div>
          </Card>
        );
      
      case 'shifts':
        return (
          <Card>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Gestion des shifts</h3>
            <div className="space-y-6">
              {Object.entries(settings.shifts).map(([key, shift]) => (
                <div key={key} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="Nom du shift"
                      value={shift.name}
                      onChange={(e) => handleDeepChange('shifts', key, 'name', e.target.value)}
                    />
                    
                    <Input
                      label="Heure de début"
                      type="time"
                      value={shift.start}
                      onChange={(e) => handleDeepChange('shifts', key, 'start', e.target.value)}
                    />
                    
                    <Input
                      label="Heure de fin"
                      type="time"
                      value={shift.end}
                      onChange={(e) => handleDeepChange('shifts', key, 'end', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      
      case 'notifications':
        return (
          <Card>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Paramètres de notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Rappels par email</h4>
                  <p className="text-sm text-gray-500">Envoyer des rappels de pointage par email</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.emailReminders}
                    onChange={(e) => handleInputChange('notifications', 'emailReminders', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Notifications push</h4>
                  <p className="text-sm text-gray-500">Notifications en temps réel</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.pushNotifications}
                    onChange={(e) => handleInputChange('notifications', 'pushNotifications', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Rapport mensuel</h4>
                  <p className="text-sm text-gray-500">Envoyer un rapport mensuel par email</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.monthlyReport}
                    onChange={(e) => handleInputChange('notifications', 'monthlyReport', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Récapitulatif hebdomadaire</h4>
                  <p className="text-sm text-gray-500">Envoyer un récapitulatif hebdomadaire</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.weeklySummary}
                    onChange={(e) => handleInputChange('notifications', 'weeklySummary', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
              
              <Input
                label="Heure du rappel de pointage"
                type="time"
                value={settings.notifications.checkInReminderTime}
                onChange={(e) => handleInputChange('notifications', 'checkInReminderTime', e.target.value)}
              />
            </div>
          </Card>
        );
      
      case 'features':
        return (
          <Card>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Fonctionnalités du système</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">QR Code Check-in</h4>
                  <p className="text-sm text-gray-500">Permettre le pointage par QR code</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.features.qrCodeCheckin}
                    onChange={(e) => handleFeatureToggle('qrCodeCheckin', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Reconnaissance faciale</h4>
                  <p className="text-sm text-gray-500">Pointage par reconnaissance faciale</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.features.facialRecognition}
                    onChange={(e) => handleFeatureToggle('facialRecognition', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Géolocalisation</h4>
                  <p className="text-sm text-gray-500">Vérifier la localisation lors du pointage</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.features.geoLocation}
                    onChange={(e) => handleFeatureToggle('geoLocation', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Multi-shifts</h4>
                  <p className="text-sm text-gray-500">Support pour plusieurs shifts par jour</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.features.multiShift}
                    onChange={(e) => handleFeatureToggle('multiShift', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Pointage manuel</h4>
                  <p className="text-sm text-gray-500">Permettre le pointage manuel par les administrateurs</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.features.manualCheckin}
                    onChange={(e) => handleFeatureToggle('manualCheckin', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>
          </Card>
        );
      
      case 'security':
        return (
          <div className="space-y-6">
            <Card>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Changement de mot de passe</h3>
              
              {showPasswordForm ? (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <Input
                    label="Mot de passe actuel"
                    name="currentPassword"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    error={passwordErrors.currentPassword}
                    required
                    icon={FaLock}
                  />
                  
                  <Input
                    label="Nouveau mot de passe"
                    name="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    error={passwordErrors.newPassword}
                    required
                    icon={FaLock}
                    helperText="Minimum 6 caractères"
                  />
                  
                  <Input
                    label="Confirmer le nouveau mot de passe"
                    name="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    error={passwordErrors.confirmPassword}
                    required
                    icon={FaLock}
                  />
                  
                  <div className="flex space-x-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setPasswordData({
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: ''
                        });
                        setPasswordErrors({});
                      }}
                    >
                      Annuler
                    </Button>
                    
                    <Button
                      type="submit"
                      variant="primary"
                    >
                      Changer le mot de passe
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-8">
                  <FaLock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    Changer votre mot de passe
                  </h4>
                  <p className="text-gray-600 mb-6">
                    Pour des raisons de sécurité, nous vous recommandons de changer votre mot de passe régulièrement.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => setShowPasswordForm(true)}
                  >
                    Changer le mot de passe
                  </Button>
                </div>
              )}
            </Card>
            
            <Card>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Sessions actives</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">Session actuelle</p>
                    <p className="text-sm text-gray-500">Connecté depuis cet appareil</p>
                  </div>
                  <FaCheckCircle className="text-green-500" />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">Mobile</p>
                    <p className="text-sm text-gray-500">Dernière connexion: il y a 2 jours</p>
                  </div>
                  <FaTimesCircle className="text-red-500" />
                </div>
              </div>
              
              <div className="mt-6">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => toast.info('Cette fonctionnalité sera disponible prochainement')}
                >
                  Déconnecter toutes les autres sessions
                </Button>
              </div>
            </Card>
          </div>
        );
      
      case 'help':
        return null;
      
      default:
        return null;
    }
  };

  // Log de débogage
  console.log('🔍 État current settings.features:', settings.features);
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FaCog className="text-primary-600" />
              Paramètres du système
            </h1>
            <p className="mt-2 text-gray-600">
              Configurez les paramètres de votre système de gestion des présences
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-sm text-gray-500">
                Dernière mise à jour: {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadSettings(true)}
              loading={refreshing}
              className="flex items-center gap-2"
            >
              <FaSync className={refreshing ? 'animate-spin' : ''} />
              Actualiser
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={verifySettings}
              className="flex items-center gap-2"
            >
              <FaCheckCircle />
              Vérifier
            </Button>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <tab.icon />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu principal */}
      {activeTab === 'help' ? (
        <HelpSection />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contenu de l'onglet (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {renderTabContent()}
          </div>
          
          {/* Panneau latéral (1/3) */}
          <div className="space-y-6">
            {/* Cartes Actions */}
            <Card>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Actions</h3>
              <div className="space-y-3">
                <Button
                  variant="primary"
                  onClick={handleSaveSettings}
                  loading={saving}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <FaSave />
                  Sauvegarder les paramètres
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleResetSettings}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <FaUndo />
                  Réinitialiser aux valeurs par défaut
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    console.log('🔍 Débug:');
                    console.log('- Settings locales:', settings);
                    console.log('- Features locales:', settings.features);
                    console.log('- Dernière mise à jour:', lastUpdated);
                  }}
                  className="w-full flex items-center justify-center gap-2 text-sm"
                >
                  <FaCog />
                  Débug Console
                </Button>
              </div>
            </Card>

            {/* Statut du système */}
            <Card>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Statut des fonctionnalités</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">QR Code Check-in</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${settings.features.qrCodeCheckin ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {settings.features.qrCodeCheckin ? 'Activé' : 'Désactivé'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Reconnaissance faciale</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${settings.features.facialRecognition ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {settings.features.facialRecognition ? 'Activée' : 'Désactivée'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Géolocalisation</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${settings.features.geoLocation ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {settings.features.geoLocation ? 'Activée' : 'Désactivée'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Multi-shifts</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${settings.features.multiShift ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {settings.features.multiShift ? 'Activé' : 'Désactivé'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Pointage manuel</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${settings.features.manualCheckin ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {settings.features.manualCheckin ? 'Activé' : 'Désactivé'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Documentation rapide */}
            {activeTab !== 'help' && (
              <Card>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Documentation rapide</h3>
                <div className="space-y-2">
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveTab('help');
                      toast.info('Ouverture de la section Aide');
                    }}
                    className="block text-primary-600 hover:text-primary-700 hover:bg-gray-50 p-2 rounded transition-colors"
                  >
                    Guide de configuration
                  </a>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveTab('help');
                      toast.info('Ouverture de la section Aide');
                    }}
                    className="block text-primary-600 hover:text-primary-700 hover:bg-gray-50 p-2 rounded transition-colors"
                  >
                    Support technique
                  </a>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      toast.info('Ouverture de la documentation externe');
                    }}
                    className="block text-primary-600 hover:text-primary-700 hover:bg-gray-50 p-2 rounded transition-colors"
                  >
                    Documentation API
                  </a>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;