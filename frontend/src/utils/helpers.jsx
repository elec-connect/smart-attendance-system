// utils/helpers.jsx

/**
 * Formate une date selon différents formats
 * @param {Date|string|number} date - Date à formater
 * @param {string} format - Format souhaité
 * @returns {string} Date formatée
 */
export const formatDate = (date, format = 'dd/MM/yyyy') => {
  // Vérifications initiales
  if (date === undefined || date === null || date === '') {
    console.warn('Date invalide dans formatDate:', date);
    return '--/--/----';
  }

  try {
    let d;
    
    if (date instanceof Date && !isNaN(date.getTime())) {
      d = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
      d = new Date(date);
      
      // Vérifier si c'est un timestamp numérique (secondes)
      if (typeof date === 'number' && date < 10000000000) {
        d = new Date(date * 1000); // Convertir les secondes en millisecondes
      }
    } else {
      console.warn('Type de date non supporté:', typeof date, date);
      return '--/--/----';
    }
    
    if (isNaN(d.getTime())) {
      console.warn('Date invalide dans formatDate:', date);
      return '--/--/----';
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const dayOfWeek = d.getDay(); // 0 (dimanche) à 6 (samedi)
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

    switch (format) {
      case 'dd/MM/yyyy':
        return `${day}/${month}/${year}`;
      
      case 'dd/MM/yy':
      case 'short':
        return `${day}/${month}/${year.toString().slice(-2)}`;
      
      case 'yyyy-MM-dd':
        return `${year}-${month}-${day}`;
      
      case 'MM/dd/yyyy':
        return `${month}/${day}/${year}`;
      
      case 'full':
        return d.toLocaleDateString('fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      
      case 'fullDateTime':
        return d.toLocaleDateString('fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      
      case 'time':
        return `${hours}:${minutes}`;
      
      case 'datetime':
      case 'dd/MM/yyyy HH:mm':
        return `${day}/${month}/${year} ${hours}:${minutes}`;
      
      case 'datetimeWithSeconds':
      case 'dd/MM/yyyy HH:mm:ss':
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
      
      case 'ISO':
        return d.toISOString();
      
      case 'relative':
        const now = new Date();
        const diffMs = now - d;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        const diffWeek = Math.floor(diffDay / 7);
        const diffMonth = Math.floor(diffDay / 30);
        const diffYear = Math.floor(diffDay / 365);
        
        if (diffYear > 0) return `il y a ${diffYear} an${diffYear > 1 ? 's' : ''}`;
        if (diffMonth > 0) return `il y a ${diffMonth} mois`;
        if (diffWeek > 0) return `il y a ${diffWeek} semaine${diffWeek > 1 ? 's' : ''}`;
        if (diffDay > 0) return `il y a ${diffDay} jour${diffDay > 1 ? 's' : ''}`;
        if (diffHour > 0) return `il y a ${diffHour} heure${diffHour > 1 ? 's' : ''}`;
        if (diffMin > 0) return `il y a ${diffMin} minute${diffMin > 1 ? 's' : ''}`;
        if (diffSec > 10) return `il y a ${diffSec} secondes`;
        return 'à l\'instant';
      
      case 'dayMonth':
        return `${day} ${monthNames[d.getMonth()]}`;
      
      case 'weekday':
        return dayNames[dayOfWeek];
      
      case 'weekdayShort':
        return dayNames[dayOfWeek].substring(0, 3);
      
      default:
        return `${day}/${month}/${year}`;
    }
  } catch (error) {
    console.error('Erreur lors du formatage de la date:', error, 'date:', date);
    return '--/--/----';
  }
};

/**
 * Formate une date de manière sécurisée avec valeur par défaut
 * @param {Date|string} date - Date à formater
 * @param {string} defaultValue - Valeur par défaut si la date est invalide
 * @returns {string} Date formatée ou valeur par défaut
 */
export const safeFormatDate = (date, defaultValue = '--/--/----') => {
  try {
    if (!date) return defaultValue;
    
    const formatted = formatDate(date);
    return formatted === '--/--/----' ? defaultValue : formatted;
  } catch {
    return defaultValue;
  }
};

/**
 * Formate l'heure (HH:MM)
 * @param {string} time - Heure au format HH:MM ou HH:MM:SS
 * @returns {string} Heure formatée
 */
export const formatTime = (time) => {
  if (!time || typeof time !== 'string') return '--:--';
  
  try {
    // Si c'est déjà une date, extraire l'heure
    if (time.includes('T') || time.includes(' ')) {
      const date = new Date(time);
      if (!isNaN(date.getTime())) {
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      }
    }
    
    // Supprimer les secondes si présentes
    const timeParts = time.split(':');
    if (timeParts.length >= 2) {
      const hours = timeParts[0].padStart(2, '0');
      const minutes = timeParts[1].padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return '--:--';
  } catch (error) {
    console.error('Erreur formatage heure:', error);
    return '--:--';
  }
};

/**
 * Calcule les heures travaillées entre check-in et check-out
 * @param {string} checkIn - Heure d'arrivée
 * @param {string} checkOut - Heure de départ
 * @param {number} breakMinutes - Minutes de pause (défaut: 60)
 * @returns {number} Nombre d'heures travaillées
 */
export const calculateWorkHours = (checkIn, checkOut, breakMinutes = 60) => {
  if (!checkIn || !checkOut) return 0;
  
  try {
    // Fonction helper pour parser les dates
    const parseDate = (timeStr) => {
      if (!timeStr) return null;
      
      // Si c'est déjà une date complète
      if (timeStr.includes('T') || timeStr.includes(' ') || timeStr.includes('-')) {
        const date = new Date(timeStr);
        if (!isNaN(date.getTime())) return date;
      }
      
      // Sinon, traiter comme une heure
      const timeParts = timeStr.split(':');
      const hours = parseInt(timeParts[0]) || 0;
      const minutes = parseInt(timeParts[1]) || 0;
      const seconds = parseInt(timeParts[2]) || 0;
      
      const date = new Date();
      date.setHours(hours, minutes, seconds, 0);
      return date;
    };
    
    const inDate = parseDate(checkIn);
    const outDate = parseDate(checkOut);
    
    if (!inDate || !outDate || isNaN(inDate.getTime()) || isNaN(outDate.getTime())) {
      return 0;
    }
    
    // Si outDate est avant inDate (travail de nuit), ajouter un jour
    let adjustedOutDate = new Date(outDate);
    if (adjustedOutDate < inDate) {
      adjustedOutDate = new Date(adjustedOutDate.getTime() + 24 * 60 * 60 * 1000);
    }
    
    const totalMs = adjustedOutDate.getTime() - inDate.getTime();
    const totalMinutes = totalMs / (1000 * 60);
    
    // Soustraire les pauses
    const workedMinutes = Math.max(0, totalMinutes - breakMinutes);
    
    return parseFloat((workedMinutes / 60).toFixed(2));
  } catch (error) {
    console.error('Erreur calcul heures:', error);
    return 0;
  }
};

/**
 * Obtient le statut de présence avec couleur
 * @param {string} status - Statut de présence
 * @returns {object} {text, color, icon, badgeClass}
 */
export const getAttendanceStatus = (status) => {
  const statusMap = {
    present: { 
      text: 'Présent', 
      color: 'bg-green-100 text-green-800 border-green-200',
      icon: '✅',
      badgeClass: 'badge-success'
    },
    absent: { 
      text: 'Absent', 
      color: 'bg-red-100 text-red-800 border-red-200',
      icon: '❌',
      badgeClass: 'badge-error'
    },
    late: { 
      text: 'En retard', 
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: '⏰',
      badgeClass: 'badge-warning'
    },
    half_day: { 
      text: 'Demi-journée', 
      color: 'bg-orange-100 text-orange-800 border-orange-200',
      icon: '⏳',
      badgeClass: 'badge-warning'
    },
    leave: { 
      text: 'Congé', 
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: '🏖️',
      badgeClass: 'badge-info'
    },
    holiday: { 
      text: 'Férié', 
      color: 'bg-purple-100 text-purple-800 border-purple-200',
      icon: '🎉',
      badgeClass: 'badge-primary'
    },
    remote: {
      text: 'Télétravail',
      color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      icon: '🏠',
      badgeClass: 'badge-info'
    },
    sick: {
      text: 'Maladie',
      color: 'bg-pink-100 text-pink-800 border-pink-200',
      icon: '🏥',
      badgeClass: 'badge-secondary'
    },
    training: {
      text: 'Formation',
      color: 'bg-teal-100 text-teal-800 border-teal-200',
      icon: '📚',
      badgeClass: 'badge-accent'
    },
    business_trip: {
      text: 'Déplacement',
      color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      icon: '✈️',
      badgeClass: 'badge-info'
    }
  };
  
  return statusMap[status] || { 
    text: 'Inconnu', 
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: '❓',
    badgeClass: 'badge-neutral'
  };
};

/**
 * Vérifie si une date est aujourd'hui
 * @param {Date|string} dateString - Date à vérifier
 * @returns {boolean} True si c'est aujourd'hui
 */
export const isToday = (dateString) => {
  if (!dateString) return false;
  
  try {
    const today = new Date();
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) return false;
    
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  } catch (error) {
    console.error('Erreur vérification date:', error);
    return false;
  }
};

/**
 * Vérifie si une date est dans le passé
 * @param {Date|string} date - Date à vérifier
 * @returns {boolean} True si dans le passé
 */
export const isPastDate = (date) => {
  if (!date) return false;
  
  try {
    const today = new Date();
    const checkDate = new Date(date);
    
    if (isNaN(checkDate.getTime())) return false;
    
    // Réinitialiser l'heure pour comparer uniquement les dates
    today.setHours(0, 0, 0, 0);
    checkDate.setHours(0, 0, 0, 0);
    
    return checkDate < today;
  } catch (error) {
    console.error('Erreur vérification date passée:', error);
    return false;
  }
};

/**
 * Vérifie si une date est dans le futur
 * @param {Date|string} date - Date à vérifier
 * @returns {boolean} True si dans le futur
 */
export const isFutureDate = (date) => {
  if (!date) return false;
  
  try {
    const today = new Date();
    const checkDate = new Date(date);
    
    if (isNaN(checkDate.getTime())) return false;
    
    // Réinitialiser l'heure pour comparer uniquement les dates
    today.setHours(0, 0, 0, 0);
    checkDate.setHours(0, 0, 0, 0);
    
    return checkDate > today;
  } catch (error) {
    console.error('Erreur vérification date future:', error);
    return false;
  }
};

/**
 * Génère un ID unique
 * @returns {string} ID unique
 */
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

/**
 * Valide une adresse email
 * @param {string} email - Email à valider
 * @returns {boolean} True si email valide
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  
  const trimmedEmail = email.trim();
  if (!trimmedEmail) return false;
  
  // Regex améliorée pour la validation d'email
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(trimmedEmail);
};

/**
 * Valide un numéro de téléphone français
 * @param {string} phone - Numéro à valider
 * @returns {boolean} True si numéro valide
 */
export const isValidPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  
  // Supprimer tous les caractères non numériques
  const cleaned = phone.replace(/\D/g, '');
  
  // Numéro français : 10 chiffres commençant par 0
  // ou format international : +33
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return true;
  }
  
  // Format international (sans le +)
  if (cleaned.length === 12 && cleaned.startsWith('33')) {
    return true;
  }
  
  return false;
};

/**
 * Tronque un texte
 * @param {string} text - Texte à tronquer
 * @param {number} maxLength - Longueur maximale
 * @param {boolean} addEllipsis - Ajouter "..." à la fin
 * @returns {string} Texte tronqué
 */
export const truncateText = (text, maxLength = 50, addEllipsis = true) => {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  
  const truncated = text.substring(0, maxLength).trim();
  return addEllipsis ? truncated + '...' : truncated;
};

/**
 * Formate un numéro de téléphone français
 * @param {string} phone - Numéro à formater
 * @returns {string} Numéro formaté
 */
export const formatPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  
  try {
    // Supprimer tous les caractères non numériques
    const cleaned = phone.replace(/\D/g, '');
    
    // Format français : 01 23 45 67 89
    if (cleaned.length === 10 && cleaned.startsWith('0')) {
      return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    }
    
    // Format international : +33 1 23 45 67 89
    if (cleaned.length === 12 && cleaned.startsWith('33')) {
      const withoutCountry = cleaned.substring(2);
      return `+33 ${withoutCountry.replace(/(\d{1})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5')}`;
    }
    
    // Format avec indicatif international complet
    if (cleaned.length > 10) {
      const countryCode = cleaned.substring(0, cleaned.length - 10);
      const nationalNumber = cleaned.substring(countryCode.length);
      return `+${countryCode} ${nationalNumber.replace(/(\d{2})(?=\d)/g, '$1 ')}`;
    }
    
    // Retourner le numéro original si format non reconnu
    return phone;
  } catch (error) {
    console.error('Erreur formatage téléphone:', error);
    return phone || '';
  }
};

/**
 * Formate un montant en euros
 * @param {number} amount - Montant à formater
 * @param {boolean} withSymbol - Inclure le symbole €
 * @returns {string} Montant formaté
 */
export const formatCurrency = (amount, withSymbol = true) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return withSymbol ? '0,00 €' : '0,00';
  }
  
  try {
    const formatter = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    const formatted = formatter.format(amount);
    return withSymbol ? `${formatted} €` : formatted;
  } catch (error) {
    console.error('Erreur formatage montant:', error);
    return withSymbol ? '0,00 €' : '0,00';
  }
};

/**
 * Télécharge un fichier
 * @param {any} content - Contenu à télécharger
 * @param {string} filename - Nom du fichier
 * @param {string} contentType - Type MIME du fichier
 */
export const downloadFile = (content, filename, contentType = 'application/octet-stream') => {
  try {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Nettoyer l'URL après un délai
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (error) {
    console.error('Erreur téléchargement fichier:', error);
    throw new Error(`Échec du téléchargement: ${error.message}`);
  }
};

/**
 * Exporte des données en CSV
 * @param {Array} data - Données à exporter
 * @param {string} filename - Nom du fichier
 * @param {Array} headers - En-têtes personnalisés
 */
export const exportToCSV = (data, filename = 'export.csv', headers = null) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn('Aucune donnée à exporter');
    return;
  }
  
  try {
    // Utiliser les headers personnalisés ou extraire des clés du premier objet
    const headerKeys = headers ? headers.map(h => h.key) : Object.keys(data[0]);
    const headerLabels = headers ? headers.map(h => h.label || h.key) : headerKeys;
    
    // Créer la ligne d'en-tête
    const csvHeaders = headerLabels
      .map(label => {
        const stringLabel = String(label || '');
        if (stringLabel.includes(',') || stringLabel.includes('"') || stringLabel.includes('\n')) {
          return `"${stringLabel.replace(/"/g, '""')}"`;
        }
        return stringLabel;
      })
      .join(',');
    
    // Créer les lignes de données
    const rows = data.map(row => {
      return headerKeys
        .map(key => {
          const value = row[key];
          const stringValue = String(value !== undefined && value !== null ? value : '');
          
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(',');
    }).join('\n');
    
    const csv = `${csvHeaders}\n${rows}`;
    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
  } catch (error) {
    console.error('Erreur export CSV:', error);
  }
};

/**
 * Calcule l'âge à partir d'une date de naissance
 * @param {Date|string} birthDate - Date de naissance
 * @returns {number} Âge
 */
export const calculateAge = (birthDate) => {
  if (!birthDate) return 0;
  
  try {
    const today = new Date();
    const birth = new Date(birthDate);
    
    // Vérifier si la date est valide
    if (isNaN(birth.getTime())) return 0;
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    // Ajuster si l'anniversaire n'est pas encore passé cette année
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return Math.max(0, age);
  } catch (error) {
    console.error('Erreur calcul âge:', error);
    return 0;
  }
};

/**
 * Formate une durée en heures et minutes
 * @param {number} minutes - Durée en minutes
 * @param {boolean} showMinutes - Toujours afficher les minutes
 * @returns {string} Durée formatée
 */
export const formatDuration = (minutes, showMinutes = true) => {
  if (!minutes && minutes !== 0) return '0h';
  if (isNaN(minutes)) return '0h';
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (hours === 0) return `${mins}min`;
  if (mins === 0 && !showMinutes) return `${hours}h`;
  
  return `${hours}h${mins.toString().padStart(2, '0')}`;
};

/**
 * Convertit une chaîne en slug URL-friendly
 * @param {string} text - Texte à convertir
 * @returns {string} Slug
 */
export const slugify = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/\s+/g, '-') // Remplace les espaces par des tirets
    .replace(/[^\w\-]+/g, '') // Supprime les caractères non alphanumériques
    .replace(/\-\-+/g, '-') // Remplace les tirets multiples par un seul
    .replace(/^-+/, '') // Supprime les tirets au début
    .replace(/-+$/, ''); // Supprime les tirets à la fin
};

/**
 * Capitalise la première lettre d'une chaîne
 * @param {string} text - Texte à capitaliser
 * @returns {string} Texte capitalisé
 */
export const capitalize = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Capitalise chaque mot d'une phrase
 * @param {string} text - Texte à capitaliser
 * @returns {string} Texte capitalisé
 */
export const capitalizeWords = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .split(/\s+/)
    .map(word => {
      if (word.length <= 2) return word.toLowerCase(); // Garder les petits mots en minuscule
      return capitalize(word);
    })
    .join(' ');
};

/**
 * Débounce une fonction
 * @param {Function} func - Fonction à débouncer
 * @param {number} wait - Temps d'attente en ms
 * @param {boolean} immediate - Exécuter immédiatement
 * @returns {Function} Fonction débouncée
 */
export const debounce = (func, wait = 300, immediate = false) => {
  let timeout;
  return function executedFunction(...args) {
    const context = this;
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
};

/**
 * Vérifie si un objet est vide
 * @param {Object} obj - Objet à vérifier
 * @returns {boolean} True si l'objet est vide
 */
export const isEmptyObject = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return true;
  return Object.keys(obj).length === 0;
};

/**
 * Clone profond d'un objet
 * @param {Object} obj - Objet à cloner
 * @returns {Object} Clone de l'objet
 */
export const deepClone = (obj) => {
  if (!obj) return obj;
  
  // Gérer les primitives, null et undefined
  if (obj === null || typeof obj !== 'object') return obj;
  
  // Gérer les dates
  if (obj instanceof Date) return new Date(obj.getTime());
  
  // Gérer les tableaux
  if (Array.isArray(obj)) {
    const arrCopy = [];
    for (let i = 0; i < obj.length; i++) {
      arrCopy[i] = deepClone(obj[i]);
    }
    return arrCopy;
  }
  
  // Gérer les objets
  if (obj instanceof Object) {
    const objCopy = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        objCopy[key] = deepClone(obj[key]);
      }
    }
    return objCopy;
  }
  
  throw new Error("Impossible de cloner l'objet. Type non supporté.");
};

/**
 * Masque une partie d'un email (ex: te**@gmail.com)
 * @param {string} email - Email à masquer
 * @returns {string} Email masqué
 */
export const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  
  const [username, domain] = email.split('@');
  if (!username || !domain) return email;
  
  if (username.length <= 2) {
    return '*'.repeat(username.length) + '@' + domain;
  }
  
  const firstChar = username.charAt(0);
  const lastChar = username.charAt(username.length - 1);
  const maskedMiddle = '*'.repeat(Math.max(2, username.length - 2));
  
  return `${firstChar}${maskedMiddle}${lastChar}@${domain}`;
};

/**
 * Masque une partie d'un numéro de téléphone
 * @param {string} phone - Numéro à masquer
 * @returns {string} Numéro masqué
 */
export const maskPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 4) return phone;
  
  const visibleDigits = 2;
  const maskedDigits = cleaned.length - visibleDigits;
  
  return '*'.repeat(maskedDigits) + cleaned.slice(-visibleDigits);
};

/**
 * Retourne l'URL absolue
 * @param {string} path - Chemin relatif
 * @returns {string} URL absolue
 */
export const getAbsoluteUrl = (path) => {
  if (typeof window === 'undefined') return path; // Pour SSR
  
  const baseUrl = window.location.origin;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

/**
 * Formate une taille de fichier
 * @param {number} bytes - Taille en bytes
 * @returns {string} Taille formatée
 */
export const formatFileSize = (bytes) => {
  if (isNaN(bytes) || bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Extrait l'extension d'un fichier
 * @param {string} filename - Nom du fichier
 * @returns {string} Extension
 */
export const getFileExtension = (filename) => {
  if (!filename || typeof filename !== 'string') return '';
  
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

/**
 * Vérifie si un fichier est une image
 * @param {string} filename - Nom du fichier
 * @returns {boolean} True si c'est une image
 */
export const isImageFile = (filename) => {
  const extension = getFileExtension(filename);
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'ico'];
  return imageExtensions.includes(extension);
};

/**
 * Formate un nombre avec séparateurs de milliers
 * @param {number} number - Nombre à formater
 * @param {number} decimals - Nombre de décimales
 * @returns {string} Nombre formaté
 */
export const formatNumber = (number, decimals = 0) => {
  if (number === null || number === undefined || isNaN(number)) {
    return '0';
  }
  
  try {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(number);
  } catch (error) {
    console.error('Erreur formatage nombre:', error);
    return number.toString();
  }
};

/**
 * Vérifie si on est en environnement de développement
 * @returns {boolean} True si en développement
 */
export const isDevEnvironment = () => {
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) {
    return process.env.NODE_ENV === 'development';
  }
  
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname.includes('.local') ||
           window.location.hostname === '[::1]' ||
           window.location.port === '3000' ||
           window.location.port === '5173';
  }
  
  return false;
};

/**
 * Génère une couleur aléatoire
 * @returns {string} Code couleur hexadécimal
 */
export const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

/**
 * Ajoute des zéros devant un nombre
 * @param {number} num - Nombre
 * @param {number} size - Taille totale
 * @returns {string} Nombre avec zéros
 */
export const padNumber = (num, size = 2) => {
  let s = String(num);
  while (s.length < size) {
    s = '0' + s;
  }
  return s;
};

/**
 * Obtient les dates de début et fin de la semaine pour une date donnée
 * @param {Date|string} date - Date de référence
 * @param {number} startOfWeek - Premier jour de la semaine (0=dimanche, 1=lundi)
 * @returns {Object} {start, end}
 */
export const getWeekRange = (date = new Date(), startOfWeek = 1) => {
  const currentDate = new Date(date);
  if (isNaN(currentDate.getTime())) {
    currentDate.setDate(currentDate.getDate() - currentDate.getDay() + startOfWeek);
  }
  
  const start = new Date(currentDate);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : startOfWeek);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
};

/**
 * Ajoute des jours à une date
 * @param {Date|string} date - Date de départ
 * @param {number} days - Nombre de jours à ajouter
 * @returns {Date} Nouvelle date
 */
export const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Compare deux dates (sans l'heure)
 * @param {Date} date1 - Première date
 * @param {Date} date2 - Deuxième date
 * @returns {number} -1, 0, ou 1
 */
export const compareDates = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  if (d1 < d2) return -1;
  if (d1 > d2) return 1;
  return 0;
};

/**
 * Calcule la différence en jours entre deux dates
 * @param {Date|string} date1 - Première date
 * @param {Date|string} date2 - Deuxième date
 * @returns {number} Différence en jours
 */
export const daysBetween = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Retourne le premier jour du mois
 * @param {Date|string} date - Date de référence
 * @returns {Date} Premier jour du mois
 */
export const getFirstDayOfMonth = (date = new Date()) => {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

/**
 * Retourne le dernier jour du mois
 * @param {Date|string} date - Date de référence
 * @returns {Date} Dernier jour du mois
 */
export const getLastDayOfMonth = (date = new Date()) => {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
};

/**
 * Formate un intervalle de dates
 * @param {Date|string} startDate - Date de début
 * @param {Date|string} endDate - Date de fin
 * @returns {string} Intervalle formaté
 */
export const formatDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Date invalide';
  }
  
  if (start.getFullYear() === end.getFullYear()) {
    if (start.getMonth() === end.getMonth()) {
      if (start.getDate() === end.getDate()) {
        return formatDate(start, 'dd/MM/yyyy');
      }
      return `${formatDate(start, 'dd')}-${formatDate(end, 'dd/MM/yyyy')}`;
    }
    return `${formatDate(start, 'dd/MM')} - ${formatDate(end, 'dd/MM/yyyy')}`;
  }
  
  return `${formatDate(start, 'dd/MM/yyyy')} - ${formatDate(end, 'dd/MM/yyyy')}`;
};

/**
 * Valide une date
 * @param {Date|string} date - Date à valider
 * @returns {boolean} True si date valide
 */
export const isValidDate = (date) => {
  if (!date) return false;
  
  const d = new Date(date);
  return !isNaN(d.getTime());
};

/**
 * Retourne le mois et l'année formatés
 * @param {Date|string} date - Date de référence
 * @param {string} locale - Locale (défaut: fr-FR)
 * @returns {string} Mois et année formatés
 */
export const getMonthYear = (date = new Date(), locale = 'fr-FR') => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
};

// Export par défaut de toutes les fonctions
const helpers = {
  // Formatage
  formatDate,
  safeFormatDate,
  formatTime,
  formatCurrency,
  formatPhoneNumber,
  formatDuration,
  formatNumber,
  formatFileSize,
  formatDateRange,
  getMonthYear,
  
  // Calculs
  calculateWorkHours,
  calculateAge,
  daysBetween,
  compareDates,
  
  // Dates
  isToday,
  isPastDate,
  isFutureDate,
  isValidDate,
  addDays,
  getWeekRange,
  getFirstDayOfMonth,
  getLastDayOfMonth,
  
  // Génération
  generateId,
  getRandomColor,
  slugify,
  
  // Texte
  truncateText,
  capitalize,
  capitalizeWords,
  padNumber,
  
  // Validation
  isValidEmail,
  isValidPhone,
  
  // Fichiers
  getFileExtension,
  isImageFile,
  
  // UI/Statuts
  getAttendanceStatus,
  
  // Téléchargement
  downloadFile,
  exportToCSV,
  
  // Sécurité
  maskEmail,
  maskPhone,
  
  // Utilitaires
  debounce,
  isEmptyObject,
  deepClone,
  getAbsoluteUrl,
  isDevEnvironment
};

export default helpers;