const moment = require('moment');

class DateHelpers {
  // Formater une date
  static formatDate(date, format = 'YYYY-MM-DD') {
    return moment(date).format(format);
  }

  // Formater une heure
  static formatTime(time, format = 'HH:mm') {
    return moment(time, 'HH:mm').format(format);
  }

  // Obtenir la date actuelle
  static getCurrentDate() {
    return this.formatDate(new Date());
  }

  // Obtenir l'heure actuelle
  static getCurrentTime() {
    return moment().format('HH:mm');
  }

  // Calculer les heures travaillées
  static calculateHoursWorked(checkIn, checkOut) {
    try {
      const start = moment(checkIn, 'HH:mm');
      const end = moment(checkOut, 'HH:mm');
      
      if (!start.isValid() || !end.isValid()) {
        return 0;
      }
      
      // Vérifier si checkOut est avant checkIn (travaillé après minuit)
      if (end.isBefore(start)) {
        end.add(1, 'day');
      }
      
      const duration = moment.duration(end.diff(start));
      return parseFloat(duration.asHours().toFixed(2));
    } catch (error) {
      console.error('Erreur calcul heures travaillées:', error);
      return 0;
    }
  }

  // Vérifier si c'est le weekend
  static isWeekend(date) {
    const day = moment(date).day();
    return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
  }

  // Obtenir la plage de dates d'un mois
  static getMonthRange(month, year) {
    try {
      const startDate = moment(`${year}-${month.padStart(2, '0')}-01`, 'YYYY-MM-DD');
      const endDate = startDate.clone().endOf('month');
      
      return {
        start: startDate.format('YYYY-MM-DD'),
        end: endDate.format('YYYY-MM-DD'),
        month: month,
        year: year,
        daysInMonth: endDate.date()
      };
    } catch (error) {
      console.error('Erreur getMonthRange:', error);
      return {
        start: `${year}-${month.padStart(2, '0')}-01`,
        end: `${year}-${month.padStart(2, '0')}-28`,
        month: month,
        year: year,
        daysInMonth: 28
      };
    }
  }

  // NOUVEAU: Obtenir les 30 derniers jours
  static getLast30Days() {
    const dates = [];
    const today = moment();
    
    for (let i = 29; i >= 0; i--) {
      const date = today.clone().subtract(i, 'days');
      dates.push(date.format('YYYY-MM-DD'));
    }
    
    return dates;
  }

  // NOUVEAU: Obtenir les 7 derniers jours
  static getLast7Days() {
    const dates = [];
    const today = moment();
    
    for (let i = 6; i >= 0; i--) {
      const date = today.clone().subtract(i, 'days');
      dates.push({
        date: date.format('YYYY-MM-DD'),
        dayName: date.format('dddd'),
        shortDayName: date.format('ddd')
      });
    }
    
    return dates;
  }

  // NOUVEAU: Vérifier si une date est aujourd'hui
  static isToday(dateString) {
    return moment(dateString).isSame(moment(), 'day');
  }

  // NOUVEAU: Obtenir le nom du mois
  static getMonthName(monthNumber) {
    const months = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return months[parseInt(monthNumber) - 1] || '';
  }

  // NOUVEAU: Formater une date pour l'affichage
  static formatDisplayDate(dateString, format = 'DD/MM/YYYY') {
    return moment(dateString).format(format);
  }

  // NOUVEAU: Formater une heure pour l'affichage
  static formatDisplayTime(timeString, format = 'HH[h]mm') {
    return moment(timeString, 'HH:mm').format(format);
  }

  // NOUVEAU: Calculer l'âge à partir d'une date de naissance
  static calculateAge(birthDate) {
    return moment().diff(moment(birthDate), 'years');
  }

  // NOUVEAU: Vérifier si une heure est dans un intervalle
  static isTimeInRange(time, startTime, endTime) {
    const checkTime = moment(time, 'HH:mm');
    const start = moment(startTime, 'HH:mm');
    const end = moment(endTime, 'HH:mm');
    
    return checkTime.isBetween(start, end, null, '[]'); // inclusif
  }

  // NOUVEAU: Ajouter des minutes à une heure
  static addMinutesToTime(time, minutes) {
    return moment(time, 'HH:mm').add(minutes, 'minutes').format('HH:mm');
  }

  // NOUVEAU: Obtenir le jour de la semaine
  static getDayOfWeek(dateString) {
    const days = [
      'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 
      'Jeudi', 'Vendredi', 'Samedi'
    ];
    return days[moment(dateString).day()];
  }

  // NOUVEAU: Générer une plage de dates entre deux dates
  static getDateRange(startDate, endDate) {
    const dates = [];
    const start = moment(startDate);
    const end = moment(endDate);
    
    while (start.isSameOrBefore(end)) {
      dates.push(start.format('YYYY-MM-DD'));
      start.add(1, 'day');
    }
    
    return dates;
  }

  // NOUVEAU: Vérifier si une date est un jour férié (France)
  static isHoliday(dateString) {
    const date = moment(dateString);
    const year = date.year();
    
    // Jours fériés fixes en France
    const fixedHolidays = [
      `${year}-01-01`, // Nouvel An
      `${year}-05-01`, // Fête du Travail
      `${year}-05-08`, // Victoire 1945
      `${year}-07-14`, // Fête Nationale
      `${year}-08-15`, // Assomption
      `${year}-11-01`, // Toussaint
      `${year}-11-11`, // Armistice
      `${year}-12-25`  // Noël
    ];
    
    return fixedHolidays.includes(dateString);
  }

  // NOUVEAU: Obtenir le nombre de jours ouvrables entre deux dates
  static getWorkingDays(startDate, endDate) {
    let count = 0;
    const current = moment(startDate);
    const end = moment(endDate);
    
    while (current.isSameOrBefore(end)) {
      if (!this.isWeekend(current) && !this.isHoliday(current.format('YYYY-MM-DD'))) {
        count++;
      }
      current.add(1, 'day');
    }
    
    return count;
  }

  // NOUVEAU: Obtenir le timestamp actuel
  static getCurrentTimestamp() {
    return moment().format('YYYY-MM-DD HH:mm:ss');
  }

  // NOUVEAU: Formater un timestamp pour l'affichage
  static formatTimestamp(timestamp, format = 'DD/MM/YYYY HH:mm:ss') {
    return moment(timestamp).format(format);
  }

  // NOUVEAU: Vérifier si une date est valide
  static isValidDate(dateString) {
    return moment(dateString, 'YYYY-MM-DD', true).isValid();
  }

  // NOUVEAU: Vérifier si une heure est valide
  static isValidTime(timeString) {
    return moment(timeString, 'HH:mm', true).isValid();
  }

  // NOUVEAU: Comparer deux dates
  static compareDates(date1, date2) {
    const d1 = moment(date1);
    const d2 = moment(date2);
    
    if (d1.isBefore(d2)) return -1;
    if (d1.isAfter(d2)) return 1;
    return 0;
  }

  // NOUVEAU: Obtenir le début du mois
  static getStartOfMonth(dateString) {
    return moment(dateString).startOf('month').format('YYYY-MM-DD');
  }

  // NOUVEAU: Obtenir la fin du mois
  static getEndOfMonth(dateString) {
    return moment(dateString).endOf('month').format('YYYY-MM-DD');
  }

  // NOUVEAU: Calculer la durée entre deux dates en jours
  static getDaysBetween(date1, date2) {
    const d1 = moment(date1);
    const d2 = moment(date2);
    return Math.abs(d1.diff(d2, 'days'));
  }

  // NOUVEAU: Formater la durée en heures et minutes
  static formatDuration(hours) {
    const totalMinutes = Math.round(hours * 60);
    const hoursPart = Math.floor(totalMinutes / 60);
    const minutesPart = totalMinutes % 60;
    
    if (hoursPart === 0) {
      return `${minutesPart} min`;
    } else if (minutesPart === 0) {
      return `${hoursPart} h`;
    } else {
      return `${hoursPart} h ${minutesPart} min`;
    }
  }
}

module.exports = DateHelpers;