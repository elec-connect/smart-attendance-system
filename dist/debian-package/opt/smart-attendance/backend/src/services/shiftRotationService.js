// backend/src/services/shiftRotationService.js
const db = require('../../config/db');

class ShiftRotationService {
  
  /**
   * Calculer le shift pour une semaine donnée en cycle continu
   * Cycle: Matin (0) → Après-midi (1) → Nuit (2) → Matin (3) → ...
   */
  calculateShiftForWeek(employeeSeed, weekNumber, baseWeek = 1) {
    const shifts = [
      "Shift Matin",      // Position 0
      "Shift Après-midi", // Position 1
      "Shift Nuit"        // Position 2
    ];
    
    // (seed + semaine - base) % 3
    const position = (employeeSeed + weekNumber - baseWeek) % 3;
    // Gérer les nombres négatifs
    const safePosition = ((position % 3) + 3) % 3;
    
    return shifts[safePosition];
  }

  /**
   * Obtenir le prochain shift dans le cycle
   */
  getNextShift(currentShift) {
    const cycle = {
      "Shift Matin": "Shift Après-midi",
      "Shift Après-midi": "Shift Nuit",
      "Shift Nuit": "Shift Matin",
      "Shift Standard": "Shift Standard"
    };
    return cycle[currentShift] || "Shift Matin";
  }

  /**
   * Obtenir le shift d'un employé pour une date donnée
   */
  async getEmployeeShiftForDate(employeeId, date = new Date()) {
    try {
      const targetDate = new Date(date);
      const year = targetDate.getFullYear();
      const weekNumber = this.getWeekNumber(targetDate);
      
      console.log(`🔄 [Rotation] Employé ${employeeId} - Semaine ${weekNumber}/${year}`);
      
      // 1. Vérifier si un shift manuel est défini pour cette semaine
      const manualResult = await db.query(`
        SELECT shift_name FROM employee_shifts 
        WHERE employee_id = $1 AND year = $2 AND week_number = $3
      `, [employeeId, year, weekNumber]);
      
      if (manualResult.rows.length > 0) {
        console.log(`✅ [Rotation] Shift manuel trouvé: ${manualResult.rows[0].shift_name}`);
        return {
          shiftName: manualResult.rows[0].shift_name,
          source: 'manual',
          weekNumber,
          year,
          nextShift: this.getNextShift(manualResult.rows[0].shift_name)
        };
      }
      
      // 2. Récupérer les infos de l'employé
      const employeeResult = await db.query(`
        SELECT 
          e.employee_id,
          e.department,
          es.start_week,
          es.start_year,
          es.start_shift
        FROM employees e
        LEFT JOIN employee_shift_start es ON e.employee_id = es.employee_id
        WHERE e.employee_id = $1
      `, [employeeId]);
      
      if (employeeResult.rows.length === 0) {
        throw new Error('Employé non trouvé');
      }
      
      const employee = employeeResult.rows[0];
      
      // 3. Déterminer la seed (position de départ dans le cycle)
      let employeeSeed;
      let startShift = employee.start_shift;
      
      if (startShift) {
        // Position basée sur le shift de départ
        if (startShift === "Shift Matin") employeeSeed = 0;
        else if (startShift === "Shift Après-midi") employeeSeed = 1;
        else if (startShift === "Shift Nuit") employeeSeed = 2;
        else employeeSeed = 0;
        
        console.log(`🎯 [Rotation] Seed basée sur start_shift: ${startShift} → ${employeeSeed}`);
      } else {
        // Fallback: seed basée sur l'ID (pour répartition automatique)
        const idNum = parseInt(employee.employee_id.replace(/\D/g, '')) || 0;
        employeeSeed = idNum % 3;
        console.log(`🎲 [Rotation] Seed basée sur ID: ${idNum} → ${employeeSeed}`);
      }
      
      // 4. Calculer le shift pour cette semaine
      const baseWeek = employee.start_week || 1;
      const shiftName = this.calculateShiftForWeek(employeeSeed, weekNumber, baseWeek);
      
      console.log(`✨ [Rotation] Résultat: Semaine ${weekNumber} → ${shiftName} (seed:${employeeSeed}, base:${baseWeek})`);
      
      return {
        shiftName,
        source: 'automatic',
        weekNumber,
        year,
        seed: employeeSeed,
        baseWeek,
        nextShift: this.getNextShift(shiftName)
      };
      
    } catch (error) {
      console.error('❌ [Rotation] Erreur:', error);
      // Fallback silencieux
      return {
        shiftName: 'Shift Standard',
        source: 'fallback',
        weekNumber: this.getWeekNumber(date),
        year: date.getFullYear()
      };
    }
  }

  /**
   * Obtenir le numéro de semaine ISO
   */
  getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // Jeudi de la semaine courante
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  }

  /**
   * Obtenir la date de début de semaine
   */
  getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }
}

module.exports = new ShiftRotationService();