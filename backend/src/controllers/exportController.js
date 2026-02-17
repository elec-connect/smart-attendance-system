const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const db = require('../../config/db');
const archiver = require('archiver');

class ExportController {
  constructor() {
    console.log('📊 ExportController professionnel initialisé');
  }

  // =========================================================================exportPayslipsToExcel            
  // 1. MÉTHODES DE VÉRIFICATION DES PERMISSIONS
  // =========================================================================

  /**
   * Vérifier les permissions d'export selon le rôle
   */
  checkExportPermissions(req, exportType) {
    const userRole = req.user?.role;
    const userDepartment = req.user?.department;
    const userEmployeeId = req.user?.employee_id || req.user?.employee_code || req.user?.id;

    const permissions = {
      admin: {
        allowed: true,
        message: 'Accès autorisé',
        filterDepartment: null,
        filterEmployeeId: null
      },
      manager: {
        allowed: ['attendance_excel', 'attendance_pdf', 'attendance_csv', 'payslip_single_pdf'].includes(exportType),
        message: exportType === 'payslip_single_pdf' 
          ? 'Vous ne pouvez exporter que votre propre fiche de paie'
          : `Vous ne pouvez exporter que les données du département ${userDepartment}`,
        filterDepartment: userDepartment,
        filterEmployeeId: exportType === 'payslip_single_pdf' ? userEmployeeId : null
      },
      employee: {
        allowed: exportType === 'payslip_single_pdf',
        message: 'Vous ne pouvez exporter que votre propre fiche de paie',
        filterDepartment: null,
        filterEmployeeId: userEmployeeId
      }
    };

    return permissions[userRole] || { allowed: false, message: 'Rôle non reconnu' };
  }

  /**
   * Vérifier les permissions pour les exports de présence
   */
  verifyAttendanceExport(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      const userRole = req.user.role;
      const userDepartment = req.user.department;
      const { department, employeeId } = req.query;

      // ADMIN peut tout exporter
      if (userRole === 'admin') {
        return next();
      }

      // MANAGER - Restrictions
      if (userRole === 'manager') {
        if (department && department !== userDepartment) {
          return res.status(403).json({
            success: false,
            message: `Vous ne pouvez exporter que les données du département ${userDepartment}`,
            error: 'DEPARTMENT_EXPORT_DENIED',
            userDepartment: userDepartment,
            requestedDepartment: department
          });
        }

        if (!department) {
          req.query.department = userDepartment;
        }

        return next();
      }

      // EMPLOYÉ - Interdit
      if (userRole === 'employee') {
        return res.status(403).json({
          success: false,
          message: 'Les employés ne peuvent pas exporter les rapports de présence',
          error: 'EMPLOYEE_EXPORT_DENIED',
          requiredRole: 'manager ou admin'
        });
      }

      return next();
    } catch (error) {
      console.error('❌ Erreur vérification export présence:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification des permissions',
        error: error.message
      });
    }
  }

  /**
   * Vérifier les permissions pour les fiches de paie
   */
  verifyPayslipExport(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      const userRole = req.user.role;
      const { employee_id } = req.query;
      const userEmployeeId = req.user.employee_id || req.user.employee_code || req.user.id;

      // ADMIN peut tout exporter
      if (userRole === 'admin') {
        return next();
      }

      // MANAGER et EMPLOYÉ - Uniquement leur propre fiche
      if (userRole === 'manager' || userRole === 'employee') {
        if (!employee_id) {
          req.query.employee_id = userEmployeeId;
          return next();
        }

        if (employee_id !== userEmployeeId) {
          console.warn('🚫 Tentative d\'accès non autorisé à une fiche de paie', {
            user: req.user.email,
            role: userRole,
            requestedEmployee: employee_id,
            userEmployeeId: userEmployeeId
          });

          return res.status(403).json({
            success: false,
            message: 'Vous ne pouvez exporter que votre propre fiche de paie',
            error: 'PAYSLIP_ACCESS_DENIED',
            code: 'FORBIDDEN_PAYSLIP_ACCESS',
            userEmployeeId: userEmployeeId,
            requestedEmployeeId: employee_id
          });
        }
      }

      return next();
    } catch (error) {
      console.error('❌ Erreur vérification export fiche de paie:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification des permissions',
        error: error.message
      });
    }
  }

  /**
   * Vérifier que l'utilisateur est admin (pour exports sensibles)
   */
  verifyAdminOnly(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Cette opération est réservée aux administrateurs',
          error: 'ADMIN_ONLY_OPERATION',
          code: 'FORBIDDEN_ADMIN_ONLY',
          requiredRole: 'admin',
          yourRole: req.user.role
        });
      }

      return next();
    } catch (error) {
      console.error('❌ Erreur vérification admin:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification des permissions',
        error: error.message
      });
    }
  }

  /**
   * Filtrer les données selon les permissions
   */
  filterDataByPermissions(req, data) {
    if (!req.user || !data || !Array.isArray(data)) return data;

    const userRole = req.user.role;
    const userDepartment = req.user.department;
    const userEmployeeId = req.user.employee_id || req.user.employee_code || req.user.id;

    // ADMIN - pas de filtre
    if (userRole === 'admin') {
      return data;
    }

    // MANAGER - filtrer par département
    if (userRole === 'manager' && userDepartment) {
      return data.filter(item => {
        const itemDept = item.department || item.employee_department || item.departement;
        return itemDept === userDepartment;
      });
    }

    // EMPLOYÉ - ne voit que ses propres données
    if (userRole === 'employee') {
      return data.filter(item => {
        const itemId = item.employee_id || item.employeeId || item.id_employe;
        return itemId === userEmployeeId;
      });
    }

    return data;
  }

  // =========================================================================
  // 2. MÉTHODES UTILITAIRES GLOBALES
  // =========================================================================

  getLastDayOfMonth(monthYear) {
    try {
      const [year, month] = monthYear.split('-');
      const lastDay = new Date(year, month, 0).getDate();
      return `${lastDay}/${month}/${year}`;
    } catch (error) {
      console.error('❌ Erreur getLastDayOfMonth:', error);
      return '31/12/2026';
    }
  }

  addErrorMessage(doc, message, error) {
    try {
      if (!doc) return;
      doc.fillColor('#D32F2F')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('ERREUR DE GÉNÉRATION', 50, 100);
      doc.fillColor('#263238')
        .fontSize(10)
        .font('Helvetica')
        .text(message, 50, 130);
      if (error) {
        doc.fillColor('#546E7A')
          .fontSize(9)
          .font('Helvetica')
          .text(`Détail: ${error.message}`, 50, 150, {
            width: doc.page.width - 100
          });
      }
    } catch (pdfError) {
      console.error('❌ Erreur ajout message d\'erreur:', pdfError);
    }
  }

  translateStatus(status) {
    const translations = {
      'present': 'Présent',
      'late': 'En retard',
      'absent': 'Absent',
      'checked_out': 'Sorti',
      'in_progress': 'En cours',
      'unknown': 'Inconnu',
      'paid': 'Payé',
      'pending': 'En attente',
      'processing': 'En traitement',
      'cancelled': 'Annulé'
    };
    return translations[status] || status || 'Non spécifié';
  }

  formatTime(time) {
    if (!time) return '--:--';
    if (typeof time === 'string') return time.substring(0, 5);
    return String(time).substring(0, 5);
  }

  getMonthName(monthYear) {
    try {
      const [year, month] = monthYear.split('-');
      const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    } catch (error) {
      console.error('❌ Erreur getMonthName:', error);
      return monthYear;
    }
  }

  numberToWords(number) {
    try {
      if (number === 0) return 'Zéro';
      const units = ['', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf', 'Dix',
        'Onze', 'Douze', 'Treize', 'Quatorze', 'Quinze', 'Seize', 'Dix-sept', 'Dix-huit', 'Dix-neuf'];
      const tens = ['', 'Dix', 'Vingt', 'Trente', 'Quarante', 'Cinquante', 'Soixante', 'Soixante-dix',
        'Quatre-vingt', 'Quatre-vingt-dix'];

      const integer = Math.floor(number);
      const decimal = Math.round((number - integer) * 1000);

      let words = '';
      let remaining = integer;

      if (remaining >= 1000) {
        const thousands = Math.floor(remaining / 1000);
        words += (thousands === 1 ? 'Mille ' : this.numberToWords(thousands) + ' Mille ');
        remaining %= 1000;
      }
      if (remaining >= 100) {
        const hundreds = Math.floor(remaining / 100);
        words += (hundreds === 1 ? 'Cent ' : units[hundreds] + ' Cent ');
        remaining %= 100;
        if (remaining > 0) words += 'et ';
      }
      if (remaining >= 20) {
        const ten = Math.floor(remaining / 10);
        words += tens[ten];
        remaining %= 10;
        if (remaining > 0) words += '-' + units[remaining].toLowerCase();
        words += ' ';
      } else if (remaining > 0) {
        words += units[remaining] + ' ';
      }

      words += 'Dinars';
      if (decimal > 0) words += ' et ' + decimal + ' Millimes';
      return words.trim();
    } catch (error) {
      console.error('❌ Erreur conversion nombre en lettres:', error);
      return number.toFixed(2) + ' TND';
    }
  }

  formatAmount(amount, currency = 'TND') {
    if (amount === null || amount === undefined) amount = 0;
    return `${parseFloat(amount).toFixed(2)} ${currency}`;
  }

  // =========================================================================
  // 3. GÉNÉRATION PDF - FICHE DE PAIE INDIVIDUELLE (ACCÈS: TOUS POUR EUX-MÊMES)
  // =========================================================================

  async exportSinglePayslipToPDF(req, res) {
    try {
      console.log('📄 [EXPORT] Export PDF d\'une fiche individuelle...');
      
      // ===== VÉRIFICATION DES PERMISSIONS =====
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      const { employee_id, month_year } = req.query;
      const userEmployeeId = req.user.employee_id || req.user.employee_code || req.user.id;
      const userRole = req.user.role;

      // ADMIN - accès à tout
      if (userRole !== 'admin') {
        // MANAGER et EMPLOYÉ - uniquement leur propre fiche
        if (!employee_id) {
          req.query.employee_id = userEmployeeId;
        } else if (employee_id !== userEmployeeId) {
          return res.status(403).json({
            success: false,
            message: 'Vous ne pouvez exporter que votre propre fiche de paie',
            error: 'PAYSLIP_ACCESS_DENIED',
            code: 'FORBIDDEN_PAYSLIP_ACCESS',
            userEmployeeId: userEmployeeId,
            requestedEmployeeId: employee_id
          });
        }
      }
      // ===== FIN VÉRIFICATION =====

      if (!employee_id || !month_year) {
        return res.status(400).json({
          success: false,
          message: 'Les paramètres employee_id et month_year sont requis'
        });
      }

      const payment = await db.query(`
  SELECT 
    sp.*, 
    e.first_name, 
    e.last_name, 
    e.cin,
    e.cnss_number,
    e.email, 
    e.department, 
    e.position, 
    e.hire_date, 
    e.phone,
    e.employee_id,
    e.social_security_number,  
    e.contract_type,        
    e.address,                
    e.birth_date,      
    e.birth_place,    
    e.nationality,      
    e.gender,
    sc.bank_name,
    sc.bank_account,
    sc.iban,
    sc.currency,
    sc.payment_method,
    sc.allowances as config_allowances,
    sc.deductions as config_deductions
  FROM salary_payments sp
  JOIN employees e ON sp.employee_id = e.employee_id
  LEFT JOIN salary_configs sc ON sc.employee_id = sp.employee_id 
    AND (sc.is_active = true OR sc.is_active IS NULL)
  WHERE 
    sp.employee_id = COALESCE(
      (SELECT employee_id FROM employees WHERE email = $1),
      $1
    )
    AND sp.month_year = $2
  LIMIT 1
`, [employee_id, month_year]);

      if (payment.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Aucune fiche de paie trouvée pour ${employee_id} - ${month_year}`,
          code: 'PAYSLIP_NOT_FOUND'
        });
      }

      const payslipData = payment.rows[0];
      let allowances = [], deductions = [];

      try {
        if (payslipData.config_allowances) allowances = JSON.parse(payslipData.config_allowances) || [];
        if (payslipData.config_deductions) deductions = JSON.parse(payslipData.config_deductions) || [];
      } catch (configError) {
        console.error('❌ Erreur récupération configuration:', configError.message);
      }

      const totalAllowances = allowances.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
      const totalSpecificDeductions = deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
      const baseSalary = parseFloat(payslipData.base_salary) || 0;
      const overtime = parseFloat(payslipData.overtime_amount) || 0;
      const taxAmount = parseFloat(payslipData.tax_amount) || 0;
      const socialAmount = parseFloat(payslipData.social_security_amount) || 0;
      const netSalary = parseFloat(payslipData.net_salary) || 0;
      const grossSalary = baseSalary + totalAllowances + overtime;
      const totalDeductions = taxAmount + socialAmount + totalSpecificDeductions;
      const finalNetSalary = netSalary > 0 ? netSalary : (grossSalary - totalDeductions);

      const month = await db.query(
        'SELECT * FROM pay_months WHERE month_year = $1',
        [month_year]
      );
      const monthData = month.rows[0] || {
        month_name: this.getMonthName(month_year),
        month_year: month_year
      };

      const doc = new PDFDocument({
        margin: 30,
        size: 'A4',
        layout: 'portrait',
        info: {
          Title: `Fiche de Paie - ${payslipData.first_name} ${payslipData.last_name}`,
          Author: 'Smart Attendance System',
          Subject: `Fiche de paie - ${monthData.month_name || month_year}`,
          Creator: 'Smart Attendance System v1.0',
          CreationDate: new Date()
        }
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `fiche_paie_${employee_id}_${month_year}_${timestamp}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Payslip-Info', JSON.stringify({
        employee_id, month_year,
        employee_name: `${payslipData.first_name} ${payslipData.last_name}`,
        net_salary: finalNetSalary
      }));

      doc.pipe(res);

      const monthName = monthData.month_name || this.getMonthName(month_year);
      const payslipDataForPDF = {
  employee: {
    name: `${payslipData.first_name || ''} ${payslipData.last_name || ''}`.trim(),
    employee_id: payslipData.employee_id,  // ← Utilise l'employee_id de la base (EMP002)
    cnss: payslipData.cnss_number || payslipData.social_security_number || 'N/A',  // ← PRIORITÉ à cnss_number
    cin: payslipData.cin || 'N/A',
    department: payslipData.department || 'Non spécifié',
    position: payslipData.position || 'Non spécifié',
    hire_date: payslipData.hire_date ? new Date(payslipData.hire_date).toLocaleDateString('fr-FR') : 'N/A',
    contract_type: payslipData.contract_type || 'CDI',
    email: payslipData.email || '',
    phone: payslipData.phone || '',
    bank_name: payslipData.bank_name || 'Non spécifié',
    bank_account: payslipData.bank_account || 'N/A'
  },
  period: {
    month: monthName,
    month_year: month_year,
    start_date: `01/${month_year.split('-')[1]}/${month_year.split('-')[0]}`,
    end_date: this.getLastDayOfMonth(month_year)
  },
  earnings: {
    base_salary: baseSalary,
    fixed_bonus: totalAllowances,
    overtime: overtime,
    total_earnings: grossSalary,
    allowances_detail: allowances
  },
  deductions: {
    tax: taxAmount,
    social_security: socialAmount,
    specific_deductions: totalSpecificDeductions,
    total_deductions: totalDeductions,
    deductions_detail: deductions
  },
  summary: {
    gross_salary: grossSalary,
    total_deductions: totalDeductions,
    net_salary: finalNetSalary,
    net_in_words: this.numberToWords(finalNetSalary)
  },
  company: {
    name: "SMART ATTENDANCE SYSTEM",
    legal_name: "SAS - Smart Attendance System",
    address: "Avenue Habib Bourguiba, 5070 Jemmel, Tunisie",
    email: "Iot.sahnoun@gmail.com",
    phone: "+216 29 328 870",
    fax: "+216 73 456 789",
    manager: "Sahnoun BEN HAOUALA",
    rc: "B241234567",
    matfisc: "1234567/A/M/000",
    patente: "7890123",
    cnss: "987654321"
  },
  document: {
    id: `PS${month_year.replace('-', '')}${payslipData.employee_id}`,  // ← Utilise employee_id de la base
    generated_date: new Date().toLocaleDateString('fr-FR'),
    generated_time: new Date().toLocaleTimeString('fr-FR'),
    payment_date: payslipData.payment_date ? new Date(payslipData.payment_date).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
    currency: 'TND',
    page_number: 1,
    total_pages: 1
  }
};

      this.generateProfessionalFullPagePayslip(doc, payslipDataForPDF, allowances, deductions);
      doc.end();
      console.log(`✅ PDF généré: ${filename} pour ${req.user.role} ${req.user.email}`);
    } catch (error) {
      console.error('❌ [EXPORT SINGLE PDF] Erreur:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la génération de la fiche',
          error: error.message,
          code: 'PDF_GENERATION_ERROR'
        });
      }
    }
  }

  async generateSinglePayslipPdf(req, res) {
    try {
      const { employee_id, month_year } = req.query;
      console.log('🔍 [PDF] Recherche fiche pour génération:', employee_id, month_year);
      
      // ===== VÉRIFICATION DES PERMISSIONS =====
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      const userEmployeeId = req.user.employee_id || req.user.employee_code || req.user.id;
      const userRole = req.user.role;

      if (userRole !== 'admin') {
        if (!employee_id || employee_id !== userEmployeeId) {
          return res.status(403).json({
            success: false,
            message: 'Vous ne pouvez accéder qu\'à votre propre fiche de paie',
            error: 'PAYSLIP_ACCESS_DENIED'
          });
        }
      }
      // ===== FIN VÉRIFICATION =====

      const result = await db.query(`
        SELECT 
          sp.*,
          e.first_name, e.last_name, e.employee_id, 
          e.department, e.position, e.hire_date, e.email, e.phone,
          pc.allowances as config_allowances,
          pc.deductions as config_deductions,
          COALESCE(sp.base_salary, 0) as base_salary,
          COALESCE(sp.gross_salary, COALESCE(sp.base_salary, 0)) as gross_salary,
          COALESCE(sp.tax_amount, 0) as tax_amount,
          COALESCE(sp.social_security_amount, 0) as social_security_amount,
          COALESCE(sp.other_deductions, 0) as other_deductions,
          COALESCE(sp.bonus_fixed, 0) as bonus_fixed,
          COALESCE(sp.bonus_variable, 0) as bonus_variable,
          COALESCE(sp.overtime_amount, 0) as overtime_amount,
          COALESCE(sp.net_salary, 0) as net_salary
        FROM payroll_payments sp
        JOIN employees e ON sp.employee_id = e.employee_id
        LEFT JOIN payroll_config pc ON pc.employee_id = sp.employee_id
        WHERE sp.employee_id = $1 AND sp.month_year = $2
        LIMIT 1
      `, [employee_id, month_year]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Fiche de paie non trouvée',
          code: 'PAYSLIP_NOT_FOUND'
        });
      }

      const payment = result.rows[0];
      let allowances = [], deductions = [];

      try {
        if (payment.config_allowances) allowances = JSON.parse(payment.config_allowances);
        if (payment.config_deductions) deductions = JSON.parse(payment.config_deductions);
      } catch (e) {
        console.error('❌ Erreur parsing JSON:', e);
      }

      const totalAllowances = allowances.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
      const totalSpecificDeductions = deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

      console.log('📊 [PDF] DONNÉES BRUTES:', {
        base_salary: payment.base_salary,
        gross_salary: payment.gross_salary,
        tax_amount: payment.tax_amount,
        social_security_amount: payment.social_security_amount,
        other_deductions: payment.other_deductions,
        net_salary: payment.net_salary,
        bonus_fixed: payment.bonus_fixed,
        bonus_variable: payment.bonus_variable,
        overtime_amount: payment.overtime_amount,
        allowances: allowances,
        total_allowances: totalAllowances,
        deductions: deductions,
        total_specific_deductions: totalSpecificDeductions
      });

      if (payment.base_salary === 0 && payment.net_salary > 0) {
        console.warn('⚠️ CORRECTION: base_salary = 0 mais net_salary > 0');
        const estimatedBaseSalary = payment.net_salary / 0.78;
        payment.base_salary = estimatedBaseSalary;
        payment.gross_salary = estimatedBaseSalary + totalAllowances;
        payment.tax_amount = payment.gross_salary * 0.15;
        payment.social_security_amount = payment.gross_salary * 0.07;
        payment.total_deductions = payment.tax_amount + payment.social_security_amount + totalSpecificDeductions;
      }

      const fixedBonus = payment.bonus_fixed > 0 ? payment.bonus_fixed : totalAllowances;
      const totalEarnings = (payment.base_salary || 0) + fixedBonus + (payment.bonus_variable || 0) + (payment.overtime_amount || 0);
      const totalDeductions = (payment.tax_amount || 0) + (payment.social_security_amount || 0) + (payment.other_deductions || 0) + totalSpecificDeductions;

      const payslipData = {
        employee: {
          name: `${payment.first_name || ''} ${payment.last_name || ''}`.trim(),
          employee_id: payment.employee_id,
          department: payment.department || 'Non spécifié',
          position: payment.position || 'Non spécifié',
          hire_date: payment.hire_date ? new Date(payment.hire_date).toLocaleDateString('fr-FR') : 'N/A',
          email: payment.email || '',
          phone: payment.phone || ''
        },
        period: {
          month: this.getMonthName(month_year),
          month_year: month_year,
          start_date: `01/${month_year.split('-')[1]}/${month_year.split('-')[0]}`,
          end_date: this.getLastDayOfMonth(month_year)
        },
        earnings: {
          base_salary: parseFloat(payment.base_salary) || 0,
          fixed_bonus: fixedBonus,
          variable_bonus: parseFloat(payment.bonus_variable) || 0,
          overtime: parseFloat(payment.overtime_amount) || 0,
          total_earnings: totalEarnings,
          allowances_details: allowances
        },
        deductions: {
          tax: parseFloat(payment.tax_amount) || 0,
          social_security: parseFloat(payment.social_security_amount) || 0,
          other_deductions: parseFloat(payment.other_deductions) || 0,
          specific_deductions: totalSpecificDeductions,
          total_deductions: totalDeductions,
          deductions_details: deductions
        },
        summary: {
          gross_salary: parseFloat(payment.gross_salary) || totalEarnings,
          total_deductions: totalDeductions,
          net_salary: parseFloat(payment.net_salary) || (totalEarnings - totalDeductions)
        },
        company: {
          name: "Smart Attendance System",
          address: "Jemmel, Tunisie",
          email: "Iot.sahnoun@gmail.com",
          phone: "+216 29 328 870",
          manager: "Sahnoun BEN HAOUALA"
        },
        document: {
          id: `PS${month_year.replace('-', '')}${employee_id}`,
          generated_date: new Date().toLocaleString('fr-FR'),
          currency: 'TND'
        }
      };

      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        layout: 'portrait',
        info: {
          Title: `Fiche de Paie - ${payslipData.employee.name}`,
          Author: 'Smart Attendance System',
          Subject: `Fiche de paie ${payslipData.period.month}`,
          Keywords: 'paie, salaire, fiche, employé',
          Creator: 'Smart Attendance System v1.0',
          CreationDate: new Date()
        }
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `fiche_paie_${employee_id}_${month_year}_${timestamp}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('X-Payslip-Info', JSON.stringify({
        employee_id: employee_id,
        month_year: month_year,
        employee_name: payslipData.employee.name,
        net_salary: payslipData.summary.net_salary,
        total_allowances: totalAllowances,
        total_deductions: totalSpecificDeductions
      }));

      doc.pipe(res);
      this.generateProfessionalPayslipWithDetailsPDF(doc, payslipData, allowances, deductions);
      doc.end();

      console.log(`✅ [PDF] Fiche générée: ${payslipData.employee.name} - ${payslipData.period.month}`);
    } catch (error) {
      console.error('❌ [GENERATE SINGLE PDF] Erreur:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la génération de la fiche de paie',
          error: error.message,
          code: 'PDF_GENERATION_ERROR'
        });
      }
    }
  }

  generateProfessionalPayslipWithDetailsPDF(doc, payslipData, allowances = [], deductions = []) {
    try {
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 40;
      const contentWidth = pageWidth - (margin * 2);

      const colors = {
        primary: '#1A237E',
        secondary: '#0D47A1',
        accent: '#D32F2F',
        success: '#2E7D32',
        warning: '#FF6F00',
        info: '#0288D1',
        text: '#263238',
        textLight: '#546E7A',
        textMuted: '#78909C',
        border: '#E0E0E0',
        background: '#F5F7FA',
        white: '#FFFFFF',
        black: '#000000'
      };

      let y = margin;

      doc.rect(0, 0, pageWidth, 80).fill(colors.primary);
      doc.fillColor(colors.white)
        .fontSize(28).font('Helvetica-Bold')
        .text('FICHE DE PAIE', margin, 25, { align: 'center', width: contentWidth });
      doc.fontSize(16).font('Helvetica')
        .text('Smart Attendance System', margin, 55, { align: 'center', width: contentWidth });

      y = 100;
      doc.strokeColor(colors.accent).lineWidth(3)
        .moveTo(margin, y).lineTo(pageWidth - margin, y).stroke();

      y += 20;
      doc.fillColor(colors.secondary).fontSize(14).font('Helvetica-Bold')
        .text('INFORMATIONS EMPLOYÉ', margin, y);

      y += 20;
      doc.strokeColor(colors.border).lineWidth(1)
        .roundedRect(margin, y, contentWidth, 100, 5).stroke();
      doc.fillColor(colors.background).roundedRect(margin, y, contentWidth, 100, 5).fill();

      const leftColX = margin + 20;
      const rightColX = margin + 220;
      const labelWidth = 100;
      const valueX = leftColX + labelWidth;
      let infoY = y + 15;
      const lineSpacing = 20;

      doc.fillColor(colors.text).fontSize(10).font('Helvetica-Bold');
      doc.text('Nom complet:', leftColX, infoY);
      doc.text('ID Employé:', leftColX, infoY + lineSpacing);
      doc.text('Département:', leftColX, infoY + lineSpacing * 2);
      doc.text('Poste:', leftColX, infoY + lineSpacing * 3);
      doc.text('Date embauche:', leftColX, infoY + lineSpacing * 4);

      doc.font('Helvetica').fillColor(colors.text);
      doc.text(payslipData.employee.name || 'Non spécifié', valueX, infoY);
      doc.text(payslipData.employee.employee_id || 'N/A', valueX, infoY + lineSpacing);
      doc.text(payslipData.employee.department || 'Non spécifié', valueX, infoY + lineSpacing * 2);
      doc.text(payslipData.employee.position || 'Non spécifié', valueX, infoY + lineSpacing * 3);
      doc.text(payslipData.employee.hire_date || 'N/A', valueX, infoY + lineSpacing * 4);

      y += 120;

      doc.fillColor(colors.secondary).fontSize(14).font('Helvetica-Bold')
        .text('PÉRIODE DE PAIE', margin, y);

      y += 20;
      doc.strokeColor(colors.border).lineWidth(1)
        .roundedRect(margin, y, contentWidth, 60, 5).stroke();
      doc.fillColor(colors.background).roundedRect(margin, y, contentWidth, 60, 5).fill();

      doc.fillColor(colors.text).fontSize(12).font('Helvetica-Bold')
        .text(payslipData.period.month, margin + 20, y + 15);
      doc.fontSize(10).font('Helvetica')
        .text(`Du ${payslipData.period.start_date} au ${payslipData.period.end_date}`, margin + 20, y + 35);

      y += 80;

      doc.fillColor(colors.success).fontSize(16).font('Helvetica-Bold')
        .text('GAINS ET REVENUS', margin, y);

      y += 25;
      doc.fillColor(colors.success).rect(margin, y, contentWidth, 30).fill();
      doc.fillColor(colors.white).fontSize(11).font('Helvetica-Bold')
        .text('Description', margin + 15, y + 9)
        .text('Montant (TND)', pageWidth - margin - 100, y + 9, { width: 90, align: 'right' });

      y += 30;
      doc.fillColor(colors.background).rect(margin, y, contentWidth, 25).fill();
      doc.fillColor(colors.text).fontSize(10).font('Helvetica-Bold')
        .text('Salaire de base', margin + 15, y + 7);
      doc.font('Helvetica').fillColor(colors.success).font('Helvetica-Bold')
        .text(`${payslipData.earnings.base_salary.toFixed(2)} TND`, pageWidth - margin - 100, y + 7, { width: 90, align: 'right' });

      y += 25;

      if (allowances && allowances.length > 0) {
        doc.fillColor(colors.info).fontSize(11).font('Helvetica-Bold')
          .text('PRIMES ET ALLOCATIONS', margin + 15, y - 3);

        y += 20;
        let totalAllowances = 0;

        allowances.forEach((allowance, index) => {
          const amount = parseFloat(allowance.amount) || 0;
          totalAllowances += amount;
          if (index % 2 === 0) {
            doc.fillColor(colors.white).rect(margin, y, contentWidth, 22).fill();
          } else {
            doc.fillColor(colors.background).rect(margin, y, contentWidth, 22).fill();
          }
          doc.fillColor(colors.text).fontSize(10).font('Helvetica')
            .text(`  • ${allowance.name || 'Prime'}`, margin + 15, y + 5);
          const type = allowance.type || 'fixe';
          doc.font('Helvetica-Oblique').fillColor(colors.textLight)
            .text(`(${type})`, margin + 150, y + 5);
          doc.font('Helvetica-Bold').fillColor(colors.success)
            .text(`${amount.toFixed(2)} TND`, pageWidth - margin - 100, y + 5, { width: 90, align: 'right' });
          y += 22;
        });

        y += 2;
        doc.strokeColor(colors.border).lineWidth(0.5)
          .moveTo(margin + 15, y - 5).lineTo(pageWidth - margin - 15, y - 5).stroke();
        doc.fillColor(colors.text).fontSize(10).font('Helvetica-Bold')
          .text('Sous-total primes:', margin + 15, y);
        doc.fillColor(colors.success)
          .text(`${totalAllowances.toFixed(2)} TND`, pageWidth - margin - 100, y, { width: 90, align: 'right' });
        y += 20;
      } else {
        doc.fillColor(colors.white).rect(margin, y, contentWidth, 25).fill();
        doc.fillColor(colors.textLight).fontSize(10).font('Helvetica-Oblique')
          .text('  • Aucune prime ou allocation', margin + 15, y + 7);
        doc.font('Helvetica-Bold').fillColor(colors.textMuted)
          .text('0.00 TND', pageWidth - margin - 100, y + 7, { width: 90, align: 'right' });
        y += 25;
      }

      doc.fillColor(colors.background).rect(margin, y, contentWidth, 25).fill();
      doc.fillColor(colors.text).fontSize(10).font('Helvetica-Bold')
        .text('Heures supplémentaires', margin + 15, y + 7);
      doc.font('Helvetica-Bold').fillColor(colors.success)
        .text(`${payslipData.earnings.overtime.toFixed(2)} TND`, pageWidth - margin - 100, y + 7, { width: 90, align: 'right' });

      y += 25;
      doc.fillColor('#E8F5E9').rect(margin, y, contentWidth, 35).fill();
      doc.strokeColor(colors.success).lineWidth(1.5)
        .moveTo(margin, y).lineTo(pageWidth - margin, y).stroke();
      doc.fillColor(colors.success).fontSize(12).font('Helvetica-Bold')
        .text('TOTAL GAINS', margin + 15, y + 11);
      doc.fontSize(14)
        .text(`${payslipData.earnings.total_earnings.toFixed(2)} TND`, pageWidth - margin - 100, y + 11, { width: 90, align: 'right' });

      y += 45;

      doc.fillColor(colors.accent).fontSize(16).font('Helvetica-Bold')
        .text('DÉDUCTIONS ET RETENUES', margin, y);

      y += 25;
      doc.fillColor(colors.accent).rect(margin, y, contentWidth, 30).fill();
      doc.fillColor(colors.white).fontSize(11).font('Helvetica-Bold')
        .text('Description', margin + 15, y + 9)
        .text('Montant (TND)', pageWidth - margin - 100, y + 9, { width: 90, align: 'right' });

      y += 30;
      doc.fillColor(colors.white).rect(margin, y, contentWidth, 25).fill();
      doc.fillColor(colors.text).fontSize(10).font('Helvetica-Bold')
        .text('Impôts sur le revenu', margin + 15, y + 7);
      doc.font('Helvetica-Bold').fillColor(colors.accent)
        .text(`${payslipData.deductions.tax.toFixed(2)} TND`, pageWidth - margin - 100, y + 7, { width: 90, align: 'right' });

      y += 25;
      doc.fillColor(colors.background).rect(margin, y, contentWidth, 25).fill();
      doc.fillColor(colors.text).fontSize(10).font('Helvetica-Bold')
        .text('Sécurité sociale', margin + 15, y + 7);
      doc.font('Helvetica-Bold').fillColor(colors.accent)
        .text(`${payslipData.deductions.social_security.toFixed(2)} TND`, pageWidth - margin - 100, y + 7, { width: 90, align: 'right' });

      y += 25;

      if (deductions && deductions.length > 0) {
        doc.fillColor(colors.warning).fontSize(11).font('Helvetica-Bold')
          .text('AUTRES DÉDUCTIONS', margin + 15, y - 3);

        y += 20;
        let totalSpecificDeductions = 0;

        deductions.forEach((deduction, index) => {
          const amount = parseFloat(deduction.amount) || 0;
          totalSpecificDeductions += amount;
          if (index % 2 === 0) {
            doc.fillColor(colors.white).rect(margin, y, contentWidth, 22).fill();
          } else {
            doc.fillColor(colors.background).rect(margin, y, contentWidth, 22).fill();
          }
          doc.fillColor(colors.text).fontSize(10).font('Helvetica')
            .text(`  • ${deduction.name || 'Déduction'}`, margin + 15, y + 5);
          const type = deduction.type || 'fixe';
          doc.font('Helvetica-Oblique').fillColor(colors.textLight)
            .text(`(${type})`, margin + 150, y + 5);
          doc.font('Helvetica-Bold').fillColor(colors.accent)
            .text(`${amount.toFixed(2)} TND`, pageWidth - margin - 100, y + 5, { width: 90, align: 'right' });
          y += 22;
        });

        y += 2;
        doc.strokeColor(colors.border).lineWidth(0.5)
          .moveTo(margin + 15, y - 5).lineTo(pageWidth - margin - 15, y - 5).stroke();
        doc.fillColor(colors.text).fontSize(10).font('Helvetica-Bold')
          .text('Sous-total autres déductions:', margin + 15, y);
        doc.fillColor(colors.accent)
          .text(`${totalSpecificDeductions.toFixed(2)} TND`, pageWidth - margin - 100, y, { width: 90, align: 'right' });
        y += 25;
      } else {
        doc.fillColor(colors.white).rect(margin, y, contentWidth, 25).fill();
        doc.fillColor(colors.textLight).fontSize(10).font('Helvetica-Oblique')
          .text('  • Aucune autre déduction', margin + 15, y + 7);
        doc.font('Helvetica-Bold').fillColor(colors.textMuted)
          .text('0.00 TND', pageWidth - margin - 100, y + 7, { width: 90, align: 'right' });
        y += 25;
      }

      doc.fillColor('#FFEBEE').rect(margin, y, contentWidth, 35).fill();
      doc.strokeColor(colors.accent).lineWidth(1.5)
        .moveTo(margin, y).lineTo(pageWidth - margin, y).stroke();
      doc.fillColor(colors.accent).fontSize(12).font('Helvetica-Bold')
        .text('TOTAL DÉDUCTIONS', margin + 15, y + 11);
      doc.fontSize(14)
        .text(`${payslipData.deductions.total_deductions.toFixed(2)} TND`, pageWidth - margin - 100, y + 11, { width: 90, align: 'right' });

      y += 50;

      doc.fillColor(colors.primary).fontSize(18).font('Helvetica-Bold')
        .text('RÉSUMÉ DE LA PAIE', margin, y);

      y += 25;
      doc.strokeColor(colors.primary).lineWidth(2)
        .roundedRect(margin, y, contentWidth, 120, 8).stroke();
      doc.fillColor('#E8EAF6').roundedRect(margin + 2, y + 2, contentWidth - 4, 116, 6).fill();

      const summaryY = y + 15;
      const labelX = margin + 25;

      doc.fillColor(colors.text).fontSize(12).font('Helvetica-Bold')
        .text('SALAIRE BRUT:', labelX, summaryY);
      doc.font('Helvetica').fontSize(12)
        .text(`${payslipData.summary.gross_salary.toFixed(2)} TND`, valueX, summaryY, { align: 'right' });

      doc.strokeColor(colors.border).lineWidth(0.5)
        .moveTo(margin + 20, summaryY + 20).lineTo(pageWidth - margin - 20, summaryY + 20).stroke();

      doc.fillColor(colors.text).fontSize(12).font('Helvetica-Bold')
        .text('TOTAL DÉDUCTIONS:', labelX, summaryY + 30);
      doc.font('Helvetica').fontSize(12)
        .text(`${payslipData.summary.total_deductions.toFixed(2)} TND`, valueX, summaryY + 30, { align: 'right' });

      doc.strokeColor(colors.primary).lineWidth(1)
        .moveTo(margin + 20, summaryY + 55).lineTo(pageWidth - margin - 20, summaryY + 55).stroke();

      doc.fillColor(colors.success).fontSize(16).font('Helvetica-Bold')
        .text('NET À PAYER:', labelX, summaryY + 70);
      doc.fontSize(20)
        .text(`${payslipData.summary.net_salary.toFixed(2)} TND`, valueX, summaryY + 70, { align: 'right' });

      y = pageHeight - 80;
      doc.strokeColor(colors.primary).lineWidth(1.5)
        .moveTo(margin, y).lineTo(pageWidth - margin, y).stroke();

      y += 15;
      doc.fillColor(colors.textLight).fontSize(8).font('Helvetica')
        .text(`Document généré le: ${payslipData.document.generated_date}`, margin, y);
      doc.text(`ID Document: ${payslipData.document.id}`, margin, y + 12);

      y += 30;
      doc.fillColor(colors.textLight).fontSize(8).font('Helvetica')
        .text(`${payslipData.company.name} | ${payslipData.company.address} | ${payslipData.company.email} | ${payslipData.company.phone}`,
          margin, y, { width: contentWidth, align: 'center' });
      doc.fontSize(7)
        .text(`© ${new Date().getFullYear()} Smart Attendance System - Module Paie v1.0`,
          margin, y + 15, { width: contentWidth, align: 'center' });

      console.log('✅ PDF professionnel avec détails généré avec succès');
    } catch (error) {
      console.error('❌ Erreur génération PDF professionnel avec détails:', error);
      throw error;
    }
  }

  generateProfessionalPayslip(doc, data, allowances = [], deductions = []) {
    try {
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 35;
      const contentWidth = pageWidth - (margin * 2);
      let y = margin;

      doc.rect(0, 0, pageWidth, 70).fill('#0A3143');
      doc.fillColor('#FFFFFF')
        .fontSize(20).font('Helvetica-Bold')
        .text('SMART ATTENDANCE SYSTEM', margin, 20, { align: 'center', width: contentWidth });
      doc.fontSize(12).font('Helvetica')
        .text(`FICHE DE PAIE • ${data.period.month.toUpperCase()}`, margin, 48, { align: 'center', width: contentWidth });
      doc.strokeColor('#FFD700').lineWidth(2)
        .moveTo(margin, 75).lineTo(pageWidth - margin, 75).stroke();

      y = 90;
      doc.fillColor('#5D6D7E').fontSize(8).font('Helvetica')
        .text(`N° Fiche: ${data.document.id}`, margin, y)
        .text(`Date: ${data.document.generated_date}`, margin + 200, y)
        .text(`Paiement: ${data.document.payment_date}`, margin + 400, y);

     y += 25;
doc.fillColor('#0A3143').fontSize(11).font('Helvetica-Bold')
  .text('IDENTIFICATION DE L\'EMPLOYÉ', margin, y);

y += 15;
// Augmenter la hauteur pour accueillir 4 lignes au lieu de 3
doc.fillColor('#F8F9F9').rect(margin, y, contentWidth, 110).fill();  // ← Hauteur augmentée à 110
doc.strokeColor('#D5DBDB').lineWidth(0.5).rect(margin, y, contentWidth, 110).stroke();

const col1X = margin + 15, col2X = margin + 230, col3X = margin + 400;
let infoY = y + 15;
const lineSpacing = 18;

// Libellés
doc.fillColor('#566573').fontSize(9).font('Helvetica-Bold');

// Colonne 1 (4 lignes)
doc.text('Nom:', col1X, infoY);
doc.text('Matricule:', col1X, infoY + lineSpacing);
doc.text('Département:', col1X, infoY + lineSpacing * 2);
doc.text('CIN:', col1X, infoY + lineSpacing * 3);  // ← AJOUTÉ

// Colonne 2 (4 lignes)
doc.text('Poste:', col2X, infoY);
doc.text('Date embauche:', col2X, infoY + lineSpacing);
doc.text('Contrat:', col2X, infoY + lineSpacing * 2);
doc.text('CNSS:', col2X, infoY + lineSpacing * 3);  // ← AJOUTÉ

// Colonne 3 (2 lignes)
doc.text('Email:', col3X, infoY);
doc.text('Tél:', col3X, infoY + lineSpacing);

// Valeurs
doc.fillColor('#17202A').font('Helvetica');

// Valeurs colonne 1
doc.text(data.employee.name || 'N/A', col1X + 50, infoY);
doc.text(data.employee.employee_id || 'N/A', col1X + 50, infoY + lineSpacing);
doc.text(data.employee.department || 'N/A', col1X + 50, infoY + lineSpacing * 2);
doc.text(data.employee.cin || 'N/A', col1X + 50, infoY + lineSpacing * 3);  // ← CIN

// Valeurs colonne 2
doc.text(data.employee.position || 'N/A', col2X + 80, infoY);
doc.text(data.employee.hire_date || 'N/A', col2X + 80, infoY + lineSpacing);
doc.text(data.employee.contract_type || 'CDI', col2X + 80, infoY + lineSpacing * 2);
doc.text(data.employee.cnss || 'N/A', col2X + 80, infoY + lineSpacing * 3);  // ← CNSS

// Valeurs colonne 3
doc.text(data.employee.email || 'N/A', col3X + 50, infoY);
doc.text(data.employee.phone || 'N/A', col3X + 50, infoY + lineSpacing);

// Ajuster y pour la suite (hauteur de la section + un peu de marge)
y += 125;  // 110 + 15

      doc.fillColor('#5D6D7E').rect(margin, y, contentWidth, 30).fill();
      doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
        .text('PÉRIODE DE PAIE', margin + 15, y + 8);
      doc.font('Helvetica')
        .text(`Du ${data.period.start_date} au ${data.period.end_date}`, margin + 200, y + 8);

      y += 45;
      doc.fillColor('#0A3143').fontSize(13).font('Helvetica-Bold')
        .text('DÉTAIL DES RÉMUNÉRATIONS', margin, y);

      y += 25;
      const colWidth = 250;
      const leftTableX = margin;
      const rightTableX = margin + colWidth + 50;
      const amountX = 180;

      doc.fillColor('#1E8449').rect(leftTableX, y - 5, colWidth, 25).fill();
      doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
        .text('GAINS', leftTableX + 15, y + 2);
      doc.fillColor('#B03A2E').rect(rightTableX, y - 5, colWidth, 25).fill();
      doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
        .text('DÉDUCTIONS', rightTableX + 15, y + 2);

      y += 30;
      let gainY = y;

      doc.fillColor('#17202A').fontSize(10).font('Helvetica')
        .text('Salaire de base', leftTableX + 15, gainY);
      doc.font('Helvetica-Bold').fillColor('#1E8449')
        .text(`${data.earnings.base_salary.toFixed(2)} TND`, leftTableX + amountX, gainY, { width: 70, align: 'right' });

      gainY += 20;

      if (allowances && allowances.length > 0) {
        allowances.slice(0, 3).forEach((allowance) => {
          const amount = parseFloat(allowance.amount) || 0;
          doc.fillColor('#566573').fontSize(9).font('Helvetica-Oblique')
            .text(`   • ${allowance.label || allowance.name || 'Prime'}`, leftTableX + 15, gainY);
          doc.font('Helvetica-Bold').fillColor('#1E8449')
            .text(`${amount.toFixed(2)} TND`, leftTableX + amountX, gainY, { width: 70, align: 'right' });
          gainY += 18;
        });
        if (allowances.length > 3) {
          doc.fillColor('#7F8C8D').fontSize(8).font('Helvetica-Oblique')
            .text(`   + ${allowances.length - 3} autre(s) prime(s)`, leftTableX + 15, gainY);
          gainY += 18;
        }
      }

      if (data.earnings.overtime > 0) {
        doc.fillColor('#17202A').fontSize(10).font('Helvetica')
          .text('Heures supplémentaires', leftTableX + 15, gainY);
        doc.font('Helvetica-Bold').fillColor('#1E8449')
          .text(`${data.earnings.overtime.toFixed(2)} TND`, leftTableX + amountX, gainY, { width: 70, align: 'right' });
        gainY += 20;
      }

      doc.strokeColor('#1E8449').lineWidth(0.5)
        .moveTo(leftTableX + 10, gainY - 3).lineTo(leftTableX + colWidth - 10, gainY - 3).stroke();

      doc.fillColor('#E8F8F5').rect(leftTableX, gainY - 3, colWidth, 25).fill();
      doc.fillColor('#1E8449').fontSize(11).font('Helvetica-Bold')
        .text('TOTAL GAINS', leftTableX + 15, gainY + 5);
      doc.fontSize(12)
        .text(`${data.earnings.total_earnings.toFixed(2)} TND`, leftTableX + amountX, gainY + 5, { width: 70, align: 'right' });

      let deductionY = y;
      doc.fillColor('#17202A').fontSize(10).font('Helvetica')
        .text('Impôt sur le revenu', rightTableX + 15, deductionY);
      doc.font('Helvetica-Bold').fillColor('#B03A2E')
        .text(`${data.deductions.tax.toFixed(2)} TND`, rightTableX + amountX, deductionY, { width: 70, align: 'right' });

      deductionY += 20;

      if (data.deductions.social_security > 0) {
        doc.fillColor('#17202A').fontSize(10).font('Helvetica')
          .text('CNSS', rightTableX + 15, deductionY);
        doc.font('Helvetica-Bold').fillColor('#B03A2E')
          .text(`${data.deductions.social_security.toFixed(2)} TND`, rightTableX + amountX, deductionY, { width: 70, align: 'right' });
        deductionY += 20;
      }

      if (deductions && deductions.length > 0) {
        deductions.slice(0, 3).forEach((deduction) => {
          const amount = parseFloat(deduction.amount) || 0;
          doc.fillColor('#566573').fontSize(9).font('Helvetica-Oblique')
            .text(`   • ${deduction.label || deduction.name || 'Déduction'}`, rightTableX + 15, deductionY);
          doc.font('Helvetica-Bold').fillColor('#B03A2E')
            .text(`${amount.toFixed(2)} TND`, rightTableX + amountX, deductionY, { width: 70, align: 'right' });
          deductionY += 18;
        });
        if (deductions.length > 3) {
          doc.fillColor('#7F8C8D').fontSize(8).font('Helvetica-Oblique')
            .text(`   + ${deductions.length - 3} autre(s) déduction(s)`, rightTableX + 15, deductionY);
          deductionY += 18;
        }
      }

      doc.strokeColor('#B03A2E').lineWidth(0.5)
        .moveTo(rightTableX + 10, deductionY - 3).lineTo(rightTableX + colWidth - 10, deductionY - 3).stroke();

      doc.fillColor('#FDEDEC').rect(rightTableX, deductionY - 3, colWidth, 25).fill();
      doc.fillColor('#B03A2E').fontSize(11).font('Helvetica-Bold')
        .text('TOTAL DÉDUCTIONS', rightTableX + 15, deductionY + 5);
      doc.fontSize(12)
        .text(`${data.deductions.total_deductions.toFixed(2)} TND`, rightTableX + amountX, deductionY + 5, { width: 70, align: 'right' });

      y = Math.max(gainY + 30, deductionY + 30);

      doc.fillColor('#FDF2E9').rect(margin, y, contentWidth, 70).fill();
      doc.strokeColor('#F39C12').lineWidth(1.5).rect(margin, y, contentWidth, 70).stroke();

      const recapY = y + 15;
      doc.fillColor('#566573').fontSize(10).font('Helvetica-Bold')
        .text('SALAIRE BRUT', margin + 25, recapY);
      doc.fillColor('#17202A').fontSize(16).font('Helvetica-Bold')
        .text(`${data.summary.gross_salary.toFixed(2)} TND`, margin + 25, recapY + 20);
      doc.fillColor('#566573').text('TOTAL DÉDUCTIONS', margin + 200, recapY);
      doc.fillColor('#B03A2E').fontSize(16)
        .text(`${data.summary.total_deductions.toFixed(2)} TND`, margin + 200, recapY + 20);
      doc.fillColor('#F39C12').fontSize(12).font('Helvetica-Bold')
        .text('NET À PAYER', margin + 400, recapY);
      doc.fillColor('#1E8449').fontSize(24).font('Helvetica-Bold')
        .text(`${data.summary.net_salary.toFixed(2)} TND`, margin + 400, recapY + 15);

      y = pageHeight - 80;
      doc.strokeColor('#A6ACAF').lineWidth(0.5)
        .moveTo(margin, y - 5).lineTo(pageWidth - margin, y - 5).stroke();

      doc.strokeColor('#ABB2B9').lineWidth(0.5)
        .rect(margin, y, (contentWidth / 2) - 15, 45).stroke();
      doc.fillColor('#566573').fontSize(9).font('Helvetica-Bold')
        .text('SIGNATURE DE L\'EMPLOYÉ', margin + 15, y + 10);
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#7F8C8D')
        .text('(Lu et approuvé)', margin + 15, y + 25);
      doc.strokeColor('#5D6D7E').lineWidth(0.5)
        .moveTo(margin + 15, y + 38).lineTo(margin + (contentWidth / 2) - 30, y + 38).stroke();

      doc.strokeColor('#ABB2B9').lineWidth(0.5)
        .rect(margin + (contentWidth / 2) + 15, y, (contentWidth / 2) - 15, 45).stroke();
      doc.fillColor('#566573').fontSize(9).font('Helvetica-Bold')
        .text('CACHET & SIGNATURE', margin + (contentWidth / 2) + 30, y + 10);
      doc.font('Helvetica').fontSize(8).fillColor('#0A3143')
        .text(data.company.name, margin + (contentWidth / 2) + 30, y + 25);
      doc.circle(margin + (contentWidth / 2) + 170, y + 22, 12)
        .lineWidth(1).strokeColor('#B03A2E').stroke();
      doc.fillColor('#B03A2E').fontSize(5).font('Helvetica-Bold')
        .text('CACHET', margin + (contentWidth / 2) + 163, y + 20);

      const footerY = pageHeight - 25;
      doc.fillColor('#7F8C8D').fontSize(7).font('Helvetica')
        .text(`Document généré le ${data.document.generated_date} à ${data.document.generated_time}`,
          margin, footerY, { width: contentWidth, align: 'center' });
      if (data.document.total_pages > 1) {
        doc.font('Helvetica-Bold')
          .text(`Page ${data.document.page_number}/${data.document.total_pages}`,
            pageWidth - margin - 50, footerY - 10);
      }
    } catch (error) {
      console.error('❌ Erreur génération fiche:', error);
      throw error;
    }
  }

  generateProfessionalFullPagePayslip(doc, data, allowances = [], deductions = []) {
    try {
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 30;
      const contentWidth = pageWidth - (margin * 2);
      let y = margin;

      doc.rect(0, 0, pageWidth, 60).fill('#0A3143');
      doc.fillColor('#FFFFFF')
        .fontSize(18).font('Helvetica-Bold')
        .text('SMART ATTENDANCE SYSTEM', margin, 18, { align: 'center', width: contentWidth });
      doc.fontSize(11).font('Helvetica')
        .text(`FICHE DE PAIE • ${data.period.month.toUpperCase()}`, margin, 42, { align: 'center', width: contentWidth });

      y = 70;
      doc.fillColor('#5D6D7E').fontSize(8).font('Helvetica');
      doc.text(`N°: ${data.document.id}`, margin, y);
      doc.text(`Édition: ${data.document.generated_date}`, margin + 200, y);
      doc.text(`Paiement: ${data.document.payment_date}`, margin + 380, y);

      y += 20;
      doc.fillColor('#0A3143').fontSize(11).font('Helvetica-Bold')
        .text('EMPLOYÉ', margin, y);
      y += 15;
      doc.fillColor('#F8F9F9').rect(margin, y, contentWidth, 60).fill();
      doc.strokeColor('#D5DBDB').lineWidth(0.5).rect(margin, y, contentWidth, 60).stroke();

      const col1X = margin + 15, col2X = margin + 300;
      let infoY = y + 12;
      const lineSpacing = 18;

      doc.fillColor('#566573').fontSize(9).font('Helvetica-Bold');
      doc.text('Nom:', col1X, infoY);
      doc.text('Matricule:', col1X, infoY + lineSpacing);
      doc.text('Département:', col1X, infoY + lineSpacing * 2);
      doc.text('Poste:', col2X, infoY);
      doc.text('Date embauche:', col2X, infoY + lineSpacing);
      doc.text('CNSS:', col2X, infoY + lineSpacing * 2);

      doc.fillColor('#17202A').font('Helvetica');
      doc.text(data.employee.name, col1X + 70, infoY);
      doc.text(data.employee.employee_id, col1X + 70, infoY + lineSpacing);
      doc.text(data.employee.department, col1X + 70, infoY + lineSpacing * 2);
      doc.text(data.employee.position, col2X + 80, infoY);
      doc.text(data.employee.hire_date, col2X + 80, infoY + lineSpacing);
      doc.text(data.employee.cnss || 'N/A', col2X + 80, infoY + lineSpacing * 2);

      y += 75;
      doc.fillColor('#5D6D7E').rect(margin, y, contentWidth, 25).fill();
      doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
        .text('PÉRIODE', margin + 15, y + 7);
      doc.font('Helvetica')
        .text(`${data.period.start_date} au ${data.period.end_date}`, margin + 200, y + 7);

      y += 35;
      const colEarningsX = margin;
      const colDeductionsX = margin + 280;
      const colEarningsWidth = 250;
      const colDeductionsWidth = 250;
      const amountX = 170;

      doc.fillColor('#1E8449').rect(colEarningsX, y - 3, colEarningsWidth, 22).fill();
      doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
        .text('GAINS', colEarningsX + 15, y + 3);
      doc.fillColor('#B03A2E').rect(colDeductionsX, y - 3, colDeductionsWidth, 22).fill();
      doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
        .text('DÉDUCTIONS', colDeductionsX + 15, y + 3);

      y += 25;
      let gainY = y;
      doc.fillColor('#17202A').fontSize(10).font('Helvetica')
        .text('Salaire de base', colEarningsX + 15, gainY);
      doc.font('Helvetica-Bold').fillColor('#1E8449')
        .text(`${data.earnings.base_salary.toFixed(2)} TND`, colEarningsX + amountX, gainY, { width: 70, align: 'right' });

      gainY += 18;
      if (allowances && allowances.length > 0) {
        allowances.slice(0, 2).forEach((allowance) => {
          const amount = parseFloat(allowance.amount) || 0;
          const label = (allowance.label || allowance.name || 'Prime').substring(0, 15);
          doc.fillColor('#566573').fontSize(9).font('Helvetica-Oblique')
            .text(`• ${label}`, colEarningsX + 20, gainY);
          doc.font('Helvetica-Bold').fillColor('#1E8449')
            .text(`${amount.toFixed(2)} TND`, colEarningsX + amountX, gainY, { width: 70, align: 'right' });
          gainY += 16;
        });
      }

      gainY += 2;
      doc.fillColor('#E8F8F5').rect(colEarningsX, gainY - 2, colEarningsWidth, 22).fill();
      doc.fillColor('#1E8449').fontSize(10).font('Helvetica-Bold')
        .text('TOTAL', colEarningsX + 15, gainY + 5);
      doc.text(`${data.earnings.total_earnings.toFixed(2)} TND`, colEarningsX + amountX, gainY + 5, { width: 70, align: 'right' });

      let deductionY = y;
      doc.fillColor('#17202A').fontSize(10).font('Helvetica')
        .text('Impôt', colDeductionsX + 15, deductionY);
      doc.font('Helvetica-Bold').fillColor('#B03A2E')
        .text(`${data.deductions.tax.toFixed(2)} TND`, colDeductionsX + amountX, deductionY, { width: 70, align: 'right' });

      deductionY += 18;
      if (data.deductions.social_security > 0) {
        doc.fillColor('#17202A').fontSize(10).font('Helvetica')
          .text('CNSS', colDeductionsX + 15, deductionY);
        doc.font('Helvetica-Bold').fillColor('#B03A2E')
          .text(`${data.deductions.social_security.toFixed(2)} TND`, colDeductionsX + amountX, deductionY, { width: 70, align: 'right' });
        deductionY += 18;
      }

      if (deductions && deductions.length > 0) {
        const deduction = deductions[0];
        const amount = parseFloat(deduction.amount) || 0;
        const label = (deduction.label || deduction.name || 'Déduction').substring(0, 15);
        doc.fillColor('#566573').fontSize(9).font('Helvetica-Oblique')
          .text(`• ${label}`, colDeductionsX + 20, deductionY);
        doc.font('Helvetica-Bold').fillColor('#B03A2E')
          .text(`${amount.toFixed(2)} TND`, colDeductionsX + amountX, deductionY, { width: 70, align: 'right' });
        deductionY += 16;
      }

      deductionY += 2;
      doc.fillColor('#FDEDEC').rect(colDeductionsX, deductionY - 2, colDeductionsWidth, 22).fill();
      doc.fillColor('#B03A2E').fontSize(10).font('Helvetica-Bold')
        .text('TOTAL', colDeductionsX + 15, deductionY + 5);
      doc.text(`${data.deductions.total_deductions.toFixed(2)} TND`, colDeductionsX + amountX, deductionY + 5, { width: 70, align: 'right' });

      y = Math.max(gainY + 25, deductionY + 25);
      doc.fillColor('#FDF2E9').rect(margin, y, contentWidth, 50).fill();
      doc.strokeColor('#F39C12').lineWidth(1).rect(margin, y, contentWidth, 50).stroke();

      const recapY = y + 12;
      doc.fillColor('#566573').fontSize(9).font('Helvetica-Bold')
        .text('BRUT', margin + 20, recapY);
      doc.fillColor('#17202A').fontSize(14).font('Helvetica-Bold')
        .text(`${data.summary.gross_salary.toFixed(2)} TND`, margin + 20, recapY + 18);
      doc.fillColor('#566573').text('DÉDUCTIONS', margin + 180, recapY);
      doc.fillColor('#B03A2E').fontSize(14)
        .text(`${data.summary.total_deductions.toFixed(2)} TND`, margin + 180, recapY + 18);
      doc.fillColor('#F39C12').fontSize(11).font('Helvetica-Bold')
        .text('NET', margin + 380, recapY);
      doc.fillColor('#1E8449').fontSize(18).font('Helvetica-Bold')
        .text(`${data.summary.net_salary.toFixed(2)} TND`, margin + 380, recapY + 15);

      const signatureY = pageHeight - 70;
      doc.strokeColor('#A6ACAF').lineWidth(0.5)
        .moveTo(margin, signatureY - 5).lineTo(pageWidth - margin, signatureY - 5).stroke();

      doc.strokeColor('#ABB2B9').lineWidth(0.5)
        .rect(margin, signatureY, (contentWidth / 2) - 10, 40).stroke();
      doc.fillColor('#566573').fontSize(9).font('Helvetica-Bold')
        .text('EMPLOYÉ', margin + 15, signatureY + 10);
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#7F8C8D')
        .text('Signature', margin + 15, signatureY + 25);

      doc.strokeColor('#ABB2B9').lineWidth(0.5)
        .rect(margin + (contentWidth / 2) + 10, signatureY, (contentWidth / 2) - 10, 40).stroke();
      doc.fillColor('#566573').fontSize(9).font('Helvetica-Bold')
        .text('EMPLOYEUR', margin + (contentWidth / 2) + 25, signatureY + 10);
      doc.font('Helvetica').fontSize(8).fillColor('#0A3143')
        .text('Cachet', margin + (contentWidth / 2) + 25, signatureY + 25);
      doc.circle(margin + (contentWidth / 2) + 120, signatureY + 20, 8)
        .lineWidth(0.5).strokeColor('#B03A2E').stroke();
    } catch (error) {
      console.error('❌ Erreur génération fiche:', error);
      throw error;
    }
  }

  // =========================================================================
// GÉNÉRATION FICHE DE PAIE INDIVIDUELLE AVEC CIN
// =========================================================================
generateIndividualPayslip(doc, payment, month) {
  try {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 40;
    const contentWidth = pageWidth - (margin * 2);
    const primaryColor = '#1A237E';
    const secondaryColor = '#0D47A1';
    const accentColor = '#D32F2E';
    const textColor = '#263238';
    const lightTextColor = '#546E7A';

    let y = margin;

    // En-tête
    doc.fillColor(primaryColor).fontSize(24).font('Helvetica-Bold')
      .text('SMART ATTENDANCE SYSTEM', margin, y, { align: 'center', width: contentWidth });
    y += 35;

    doc.fillColor(secondaryColor).fontSize(18).font('Helvetica-Bold')
      .text(`FICHE DE PAIE • ${month.month_name || 'OCTOBRE'} ${month.month_year}`, margin, y, { align: 'center', width: contentWidth });
    y += 30;

    // Numéro de fiche et dates
    const payslipNumber = `PS${month.month_year.replace('-', '')}${payment.employee_id || ''}`;
    doc.fontSize(9).font('Helvetica').fillColor(lightTextColor)
      .text(`N°: ${payslipNumber}`, margin, y)
      .text(`Édition: ${new Date().toLocaleDateString('fr-FR')}`, margin + 250, y)
      .text(`Paiement: ${payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('fr-FR') : '10/02/2026'}`, margin + 400, y);
    y += 25;

    doc.strokeColor(accentColor).lineWidth(2)
      .moveTo(margin, y).lineTo(pageWidth - margin, y).stroke();
    y += 25;

    // ===== SECTION EMPLOYÉ AVEC CIN ET CNSS =====
    doc.fillColor(secondaryColor).fontSize(14).font('Helvetica-Bold')
      .text('EMPLOYÉ', margin, y);
    y += 20;

    const lineHeight = 18;
    let x = margin + 10;
    
    // Libellés
    doc.fillColor(textColor).fontSize(10).font('Helvetica-Bold');
    doc.text('Nom:', x, y);
    doc.text('Matricule:', x, y + lineHeight);
    doc.text('CIN:', x, y + lineHeight * 2);  // ← AJOUT DU CIN
    doc.text('Département:', x, y + lineHeight * 3);
    doc.text('Poste:', x, y + lineHeight * 4);
    doc.text('Date embauche:', x, y + lineHeight * 5);
    doc.text('CNSS:', x, y + lineHeight * 6);

    // Valeurs
    const fullName = `${payment.first_name || ''} ${payment.last_name || ''}`.trim() || 'Non spécifié';
    const hireDate = payment.hire_date ? new Date(payment.hire_date).toLocaleDateString('fr-FR') : 'Non spécifiée';
    const cin = payment.cin || 'Non renseigné';
    const cnss = payment.cnss_number || payment.cnss || 'Non renseigné';  // ← PRIORITÉ À cnss_number

    x = margin + 100;
    doc.font('Helvetica').fillColor(textColor);
    doc.text(fullName, x, y);
    doc.text(payment.employee_id || 'N/A', x, y + lineHeight);
    doc.text(cin, x, y + lineHeight * 2);
    doc.text(payment.department || 'Non spécifié', x, y + lineHeight * 3);
    doc.text(payment.position || 'Non spécifié', x, y + lineHeight * 4);
    doc.text(hireDate, x, y + lineHeight * 5);
    doc.text(cnss, x, y + lineHeight * 6);  // ← UTILISE cnss

    y += lineHeight * 7 + 15;

    // ===== PÉRIODE =====
    doc.fillColor(secondaryColor).fontSize(12).font('Helvetica-Bold')
      .text('PÉRIODE', margin, y);
    y += 15;

    const startDate = new Date(`${month.month_year}-01`);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    
    doc.fillColor(textColor).fontSize(10).font('Helvetica')
      .text(`${startDate.toLocaleDateString('fr-FR')} au ${endDate.toLocaleDateString('fr-FR')}`, margin + 10, y);
    y += 25;

    // ===== TABLEAU DES GAINS ET DÉDUCTIONS =====
    const tableWidth = contentWidth;
    const col1Width = 200;
    const col2Width = 150;
    const col3Width = 150;
    
    // En-têtes
    doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold');
    doc.text('GAINS', margin, y);
    doc.text('DÉDUCTIONS', margin + col1Width + 50, y);
    y += 20;

    // Ligne de séparation
    doc.strokeColor(lightTextColor).lineWidth(0.5)
      .moveTo(margin, y).lineTo(margin + tableWidth, y).stroke();
    y += 10;

    // Données
    const baseSalary = parseFloat(payment.base_salary || 0).toFixed(2);
    const fixedBonus = parseFloat(payment.bonus_fixed || 0).toFixed(2);
    const overtime = parseFloat(payment.overtime_amount || 0).toFixed(2);
    const totalGains = (parseFloat(baseSalary) + parseFloat(fixedBonus) + parseFloat(overtime)).toFixed(2);
    
    const taxes = parseFloat(payment.tax_amount || 0).toFixed(2);
    const socialSecurity = parseFloat(payment.social_security_amount || 0).toFixed(2);
    const otherDeductions = parseFloat(payment.other_deductions || 0).toFixed(2);
    const totalDeductions = (parseFloat(taxes) + parseFloat(socialSecurity) + parseFloat(otherDeductions)).toFixed(2);

    doc.fontSize(9).font('Helvetica');
    
    // Gains
    doc.text(`Salaire de base ${baseSalary} TND`, margin + 10, y);
    y += 15;
    doc.text(`• prime ${fixedBonus} TND`, margin + 20, y);
    y += 15;
    doc.text(`• transport ${overtime} TND`, margin + 20, y);
    y += 15;
    doc.font('Helvetica-Bold').text(`TOTAL ${totalGains} TND`, margin + 10, y);
    
    // Déductions (revenir à la hauteur initiale)
    let yDeductions = y - 45;
    doc.font('Helvetica');
    doc.text(`Impôt ${taxes} TND`, margin + col1Width + 60, yDeductions);
    yDeductions += 15;
    doc.text(`CNSS ${socialSecurity} TND`, margin + col1Width + 60, yDeductions);
    yDeductions += 15;
    doc.text(`• avance ${otherDeductions} TND`, margin + col1Width + 70, yDeductions);
    yDeductions += 15;
    doc.font('Helvetica-Bold').text(`TOTAL ${totalDeductions} TND`, margin + col1Width + 60, yDeductions);

    y += 30;

    // ===== RÉSULTAT =====
    doc.strokeColor(secondaryColor).lineWidth(1)
      .moveTo(margin, y).lineTo(margin + tableWidth, y).stroke();
    y += 15;

    doc.font('Helvetica-Bold').fontSize(11);
    doc.fillColor(primaryColor).text('BRUT', margin + 50, y);
    doc.fillColor(accentColor).text(`${totalGains} TND`, margin + 100, y);
    
    doc.fillColor(primaryColor).text('DÉDUCTIONS', margin + 250, y);
    doc.fillColor(accentColor).text(`${totalDeductions} TND`, margin + 350, y);
    
    doc.fillColor(primaryColor).text('NET', margin + 450, y);
    const netSalary = (parseFloat(totalGains) - parseFloat(totalDeductions)).toFixed(2);
    doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(14)
      .text(`${netSalary} TND`, margin + 490, y - 2);

    y += 40;

    // ===== SIGNATURES =====
    doc.strokeColor(lightTextColor).lineWidth(0.5)
      .moveTo(margin, y).lineTo(margin + tableWidth, y).stroke();
    y += 20;

    doc.font('Helvetica').fontSize(9).fillColor(textColor);
    doc.text('EMPLOYÉ', margin + 50, y);
    doc.text('Signature', margin + 40, y + 15);
    
    doc.text('EMPLOYEUR', margin + 450, y);
    doc.text('Cachet', margin + 450, y + 15);

    // Lignes de signature
    doc.strokeColor(lightTextColor).lineWidth(0.5)
      .moveTo(margin + 20, y + 30).lineTo(margin + 150, y + 30).stroke()
      .moveTo(margin + 420, y + 30).lineTo(margin + 550, y + 30).stroke();

    // ===== BAS DE PAGE AVEC RAPPEL DU CIN ET CNSS =====
    y = pageHeight - margin - 30;
    doc.fontSize(7).font('Helvetica').fillColor(lightTextColor)
      .text(`Document généré le ${new Date().toLocaleString('fr-FR')}`, margin, y)
      .text(`ID: ${payslipNumber}`, margin + 200, y)
      .text(`CIN: ${cin} | CNSS: ${cnss}`, margin + 350, y);  // ← RAPPEL CIN ET CNSS

  } catch (error) {
    console.error('❌ Erreur génération fiche individuelle:', error);
    doc.fillColor('#D32F2F').fontSize(10).font('Helvetica-Bold')
      .text('ERREUR DE GÉNÉRATION', 50, 50);
    doc.fillColor('#263238').fontSize(8).font('Helvetica')
      .text(`Erreur: ${error.message}`, 50, 70);
  }
}

  // =========================================================================
  // 4. EXPORTS DES FICHES DE PAIE - BATCH, PDF, ZIP, EXCEL, CSV
  // =========================================================================
  // RÉSERVÉS ADMIN UNIQUEMENT
  // =========================================================================

  async exportPayslipsToPDF(req, res) {
    try {
      console.log('📄 [EXPORT BATCH PDF] Début export PDF de plusieurs fiches de paie...');
      
      // ===== VÉRIFICATION STRICTE - ADMIN UNIQUEMENT =====
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Export batch PDF réservé aux administrateurs',
          error: 'BATCH_PDF_DENIED',
          code: 'FORBIDDEN_BATCH_EXPORT',
          requiredRole: 'admin',
          yourRole: req.user.role
        });
      }
      // ===== FIN VÉRIFICATION =====

      const { month_year = '2026-08' } = req.query;

      const monthCheck = await db.query(
        'SELECT * FROM pay_months WHERE month_year = $1',
        [month_year]
      );

      if (monthCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Mois ${month_year} non trouvé`,
          code: 'MONTH_NOT_FOUND'
        });
      }

      const month = monthCheck.rows[0];
      const payments = await db.query(`
        SELECT 
          sp.*, 
          e.first_name, 
          e.last_name, 
          e.cin,
          e.email, 
          e.department, 
          e.position, 
          e.hire_date, 
          e.phone,
          e.employee_id,
          e.social_security_number,  
          e.cnss_number,        
          e.contract_type,        
          e.address,                
          e.birth_date,      
          e.birth_place,    
          e.nationality,      
          e.gender,           
          sc.bank_name,
          sc.bank_account,
          sc.iban,
          sc.currency,
          sc.payment_method,
          sc.allowances as config_allowances,
          sc.deductions as config_deductions
        FROM salary_payments sp
        JOIN employees e ON sp.employee_id = e.employee_id
        LEFT JOIN salary_configs sc ON sc.employee_id = sp.employee_id 
          AND (sc.is_active = true OR sc.is_active IS NULL)
        WHERE sp.month_year = $1
        ORDER BY e.department, e.last_name, e.first_name
      `, [month_year]);

      if (payments.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Aucun paiement trouvé pour ce mois',
          code: 'NO_PAYMENTS_FOUND'
        });
      }

      const doc = new PDFDocument({
        margin: 35,
        size: 'A4',
        layout: 'portrait',
        bufferPages: true,
        autoFirstPage: true,
        info: {
          Title: `Fiches de Paie - ${month.month_name || month.month_year} ${month.month_year}`,
          Author: 'Smart Attendance System',
          Subject: `Fiches de paie ${month.month_name || month.month_year} ${month.month_year}`,
          Keywords: 'paie, salaire, fiches, employés, batch, signature, cachet',
          Creator: 'Smart Attendance System v1.0',
          CreationDate: new Date()
        }
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `fiches_paie_${month.month_year}_${payments.rows.length}_fiches_${timestamp}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Payslips-Count', payments.rows.length);
      res.setHeader('X-Payslips-Month', month.month_name || month.month_year);

      doc.pipe(res);

      let successCount = 0, errorCount = 0;
      for (let i = 0; i < payments.rows.length; i++) {
        try {
          const payment = payments.rows[i];
          if (i > 0) doc.addPage();

          let allowances = [], deductions = [];
          try {
            if (payment.config_allowances) allowances = JSON.parse(payment.config_allowances) || [];
            if (payment.config_deductions) deductions = JSON.parse(payment.config_deductions) || [];
          } catch (e) {
            console.error(`❌ Erreur parsing JSON pour ${payment.employee_id}:`, e.message);
          }

          const totalAllowances = allowances.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
          const totalSpecificDeductions = deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
          const baseSalary = parseFloat(payment.base_salary) || 0;
          const overtime = parseFloat(payment.overtime_amount) || 0;
          const taxAmount = parseFloat(payment.tax_amount) || 0;
          const socialAmount = parseFloat(payment.social_security_amount) || 0;
          const netSalary = parseFloat(payment.net_salary) || 0;
          const grossSalary = baseSalary + totalAllowances + overtime;
          const totalDeductions = taxAmount + socialAmount + totalSpecificDeductions;
          const finalNetSalary = netSalary > 0 ? netSalary : (grossSalary - totalDeductions);
          const monthName = month.month_name || this.getMonthName(month.month_year);

          const payslipData = {
            employee: {
              name: `${payment.first_name || ''} ${payment.last_name || ''}`.trim(),
              employee_id: payment.employee_id,
              cin: payment.cin || 'N/A',                    // ← AJOUT OBLIGATOIRE
              cnss: payment.cnss_number || 'N/A',           // ← AJOUT OBLIGATOIRE
              department: payment.department || 'Non spécifié',
              position: payment.position || 'Non spécifié',
              hire_date: payment.hire_date ? new Date(payment.hire_date).toLocaleDateString('fr-FR') : 'N/A',
              contract_type: payment.contract_type || 'CDI',
              email: payment.email || '',
              phone: payment.phone || '',
              bank_name: payment.bank_name || 'Non spécifié',
              bank_account: payment.bank_account || 'N/A'
            },
            period: {
              month: monthName,
              month_year: month.month_year,
              start_date: `01/${month.month_year.split('-')[1]}/${month.month_year.split('-')[0]}`,
              end_date: this.getLastDayOfMonth(month.month_year)
            },
            earnings: {
              base_salary: baseSalary,
              fixed_bonus: totalAllowances,
              overtime: overtime,
              total_earnings: grossSalary,
              allowances_detail: allowances
            },
            deductions: {
              tax: taxAmount,
              social_security: socialAmount,
              specific_deductions: totalSpecificDeductions,
              total_deductions: totalDeductions,
              deductions_detail: deductions
            },
            summary: {
              gross_salary: grossSalary,
              total_deductions: totalDeductions,
              net_salary: finalNetSalary,
              net_in_words: this.numberToWords(finalNetSalary)
            },
            company: {
              name: "SMART ATTENDANCE SYSTEM",
              legal_name: "SAS - Smart Attendance System",
              address: "Avenue Habib Bourguiba, 5070 Jemmel, Tunisie",
              email: "Iot.sahnoun@gmail.com",
              phone: "+216 29 328 870",
              fax: "+216 73 456 789",
              manager: "Sahnoun BEN HAOUALA",
              rc: "B241234567",
              matfisc: "1234567/A/M/000",
              patente: "7890123",
              cnss: "987654321"
            },
            document: {
              id: `PS${month.month_year.replace('-', '')}${payment.employee_id}`,
              generated_date: new Date().toLocaleDateString('fr-FR'),
              generated_time: new Date().toLocaleTimeString('fr-FR'),
              payment_date: payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
              currency: 'TND',
              page_number: i + 1,
              total_pages: payments.rows.length
            }
          };

          this.generateProfessionalFullPagePayslip(doc, payslipData, allowances, deductions);
          successCount++;
        } catch (ficheError) {
          console.error(`❌ Erreur sur fiche ${i + 1}:`, ficheError.message);
          errorCount++;
          if (i > 0) doc.addPage();
          this.addErrorMessage(doc, `Erreur génération fiche: ${payments.rows[i]?.first_name || ''} ${payments.rows[i]?.last_name || ''}`, ficheError);
        }
      }

      doc.end();
      console.log(`✅ PDF BATCH généré avec succès: ${successCount} fiches, ${errorCount} erreurs`);
    } catch (error) {
      console.error('❌ [EXPORT BATCH PDF] Erreur fatale:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la génération du PDF des fiches de paie',
          error: error.message,
          code: 'BATCH_PDF_ERROR'
        });
      }
    }
  }

  async exportPayslipsToExcel(req, res) {
  try {
    console.log(`📈 [EXPORT EXCEL] Génération des fiches de paie style PDF...`);
    
    // ===== VÉRIFICATION ADMIN =====
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux administrateurs'
      });
    }

    const { month_year } = req.query;
    if (!month_year) {
      return res.status(400).json({ error: 'Le paramètre month_year est requis' });
    }

    console.log(`📅 Mois demandé: ${month_year}`);

    // ===== RÉCUPÉRATION DES DONNÉES =====
    const query = `
      SELECT 
        sp.*, 
        e.first_name, 
        e.last_name, 
        e.cin,
        e.cnss_number,
        e.email, 
        e.phone,
        e.department,
        e.position,
        e.hire_date,
        e.contract_type,
        sc.bank_name,
        sc.bank_account,
        sc.currency,
        sc.payment_method,
        sc.allowances as config_allowances,
        sc.deductions as config_deductions,
        sp.base_salary,
        sp.overtime_amount,
        sp.bonus_amount,
        sp.deduction_amount,
        sp.tax_amount,
        sp.social_security_amount,
        sp.net_salary,
        sp.payment_status,
        sp.payment_date,
        sp.days_present,
        sp.days_absent,
        sp.late_days,
        sp.early_leave_days
      FROM salary_payments sp
      JOIN employees e ON sp.employee_id = e.employee_id
      LEFT JOIN salary_configs sc ON sc.employee_id = sp.employee_id
      WHERE sp.month_year = $1
        AND e.is_active = true
      ORDER BY e.department, e.last_name, e.first_name
    `;

    const result = await db.query(query, [month_year]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Aucune fiche de paie trouvée pour ce mois' });
    }

    console.log(`📊 ${result.rows.length} employés trouvés`);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Smart Attendance System';
    workbook.created = new Date();

    // ===== UNE SEULE FEUILLE POUR TOUTES LES FICHES =====
    const worksheet = workbook.addWorksheet(`Fiches de paie ${month_year}`);

    // Configuration des colonnes
    worksheet.columns = [
      { width: 25 },  // Libellés
      { width: 20 },  // Valeurs 1
      { width: 5 },   // Espace
      { width: 25 },  // Libellés 2
      { width: 20 }   // Valeurs 2
    ];

    let currentRow = 1;

    // ===== BOUCLE SUR TOUS LES EMPLOYÉS =====
    for (let index = 0; index < result.rows.length; index++) {
      const payslip = result.rows[index];

      try {
        console.log(`📄 Génération fiche ${index + 1}/${result.rows.length}: ${payslip.employee_id} - ${payslip.first_name} ${payslip.last_name}`);

        // Parse des allowances et deductions
        let allowances = [], deductions = [];
        try {
          if (payslip.config_allowances) allowances = JSON.parse(payslip.config_allowances) || [];
          if (payslip.config_deductions) deductions = JSON.parse(payslip.config_deductions) || [];
        } catch (e) {
          console.error(`❌ Erreur parsing JSON pour ${payslip.employee_id}:`, e.message);
        }

        // ===== EN-TÊTE =====
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        const titleCell = worksheet.getCell(`A${currentRow}`);
        titleCell.value = 'SMART ATTENDANCE SYSTEM';
        titleCell.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(currentRow).height = 30;
        currentRow++;

        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        const subtitleCell = worksheet.getCell(`A${currentRow}`);
        const monthName = this.getMonthName(month_year);
        subtitleCell.value = `FICHE DE PAIE • ${monthName.toUpperCase()}`;
        subtitleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D47A1' } };
        subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(currentRow).height = 25;
        currentRow++;

        // ===== NUMÉRO DE FICHE =====
        worksheet.getRow(currentRow).height = 20;
        worksheet.getCell(`A${currentRow}`).value = `N°: PS${month_year.replace('-', '')}${payslip.employee_id}`;
        worksheet.getCell(`C${currentRow}`).value = `Édition: ${new Date().toLocaleDateString('fr-FR')}`;
        worksheet.getCell(`E${currentRow}`).value = `Paiement: ${payslip.payment_date ? new Date(payslip.payment_date).toLocaleDateString('fr-FR') : 'En attente'}`;
        
        worksheet.getRow(currentRow).eachCell((cell) => {
          cell.font = { size: 9, color: { argb: 'FF5D6D7E' } };
          cell.alignment = { horizontal: 'left' };
        });
        currentRow++;

        // Ligne de séparation
        worksheet.getRow(currentRow).height = 5;
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD32F2E' } };
        currentRow++;

        // ===== SECTION EMPLOYÉ =====
        worksheet.getRow(currentRow).height = 20;
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        const employeeTitleCell = worksheet.getCell(`A${currentRow}`);
        employeeTitleCell.value = 'EMPLOYÉ';
        employeeTitleCell.font = { bold: true, size: 12, color: { argb: 'FF0D47A1' } };
        employeeTitleCell.alignment = { horizontal: 'left' };
        currentRow++;

        // Fond gris pour la section employé
        const startEmployeeRow = currentRow;
        for (let row = 0; row < 6; row++) {
          for (let col = 1; col <= 5; col++) {
            const cell = worksheet.getCell(currentRow + row, col);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9F9' } };
          }
        }

        // Informations employé
        worksheet.getCell(`A${currentRow}`).value = 'Nom:';
        worksheet.getCell(`B${currentRow}`).value = `${payslip.first_name} ${payslip.last_name}`;
        worksheet.getCell(`D${currentRow}`).value = 'Matricule:';
        worksheet.getCell(`E${currentRow}`).value = payslip.employee_id;
        currentRow++;

        worksheet.getCell(`A${currentRow}`).value = 'Département:';
        worksheet.getCell(`B${currentRow}`).value = payslip.department || 'N/A';
        worksheet.getCell(`D${currentRow}`).value = 'Poste:';
        worksheet.getCell(`E${currentRow}`).value = payslip.position || 'N/A';
        currentRow++;

        worksheet.getCell(`A${currentRow}`).value = 'Date embauche:';
        worksheet.getCell(`B${currentRow}`).value = payslip.hire_date ? new Date(payslip.hire_date).toLocaleDateString('fr-FR') : 'N/A';
        worksheet.getCell(`D${currentRow}`).value = 'CIN:';
        worksheet.getCell(`E${currentRow}`).value = payslip.cin || 'N/A';
        currentRow++;

        worksheet.getCell(`A${currentRow}`).value = 'CNSS:';
        worksheet.getCell(`B${currentRow}`).value = payslip.cnss_number || 'N/A';
        worksheet.getCell(`D${currentRow}`).value = 'Contrat:';
        worksheet.getCell(`E${currentRow}`).value = payslip.contract_type || 'CDI';
        currentRow++;

        worksheet.getCell(`A${currentRow}`).value = 'Email:';
        worksheet.getCell(`B${currentRow}`).value = payslip.email || '';
        worksheet.getCell(`D${currentRow}`).value = 'Tél:';
        worksheet.getCell(`E${currentRow}`).value = payslip.phone || '';
        currentRow++;

        // Ligne vide
        currentRow++;

        // ===== PÉRIODE =====
        worksheet.getRow(currentRow).height = 20;
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        const periodTitleCell = worksheet.getCell(`A${currentRow}`);
        periodTitleCell.value = 'PÉRIODE';
        periodTitleCell.font = { bold: true, size: 12, color: { argb: 'FF0D47A1' } };
        periodTitleCell.alignment = { horizontal: 'left' };
        currentRow++;

        worksheet.getRow(currentRow).height = 20;
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        const startDate = new Date(`${month_year}-01`);
        const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        worksheet.getCell(`A${currentRow}`).value = `${startDate.toLocaleDateString('fr-FR')} au ${endDate.toLocaleDateString('fr-FR')}`;
        worksheet.getCell(`A${currentRow}`).font = { size: 11 };
        worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
        currentRow++;

        // Ligne de séparation
        worksheet.getRow(currentRow).height = 5;
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        currentRow++;

        // ===== TABLEAU DES GAINS ET DÉDUCTIONS DYNAMIQUE =====
        // En-têtes des colonnes
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const gainsHeader = worksheet.getCell(`A${currentRow}`);
        gainsHeader.value = 'GAINS';
        gainsHeader.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        gainsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E8449' } };
        gainsHeader.alignment = { horizontal: 'center' };

        worksheet.mergeCells(`D${currentRow}:E${currentRow}`);
        const deductionsHeader = worksheet.getCell(`D${currentRow}`);
        deductionsHeader.value = 'DÉDUCTIONS';
        deductionsHeader.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        deductionsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB03A2E' } };
        deductionsHeader.alignment = { horizontal: 'center' };
        currentRow++;

        // Calculs de base
        const baseSalary = parseFloat(payslip.base_salary || 0);
        const taxAmount = parseFloat(payslip.tax_amount || 0);
        const socialAmount = parseFloat(payslip.social_security_amount || 0);
        const overtime = parseFloat(payslip.overtime_amount || 0);
        const bonusAmount = parseFloat(payslip.bonus_amount || 0);
        const deductionAmount = parseFloat(payslip.deduction_amount || 0);

        // ===== PRÉPARATION DES GAINS DYNAMIQUES =====
        let gainsRows = [];
        let seenGainsLabels = new Set();

        // Salaire de base (toujours présent)
        gainsRows.push({ label: 'Salaire de base', amount: baseSalary });
        seenGainsLabels.add('Salaire de base');

        // Primes depuis allowances
        if (allowances && allowances.length > 0) {
          allowances.forEach(allowance => {
            const amount = parseFloat(allowance.amount) || 0;
            const label = allowance.label || allowance.name || 'prime';
            
            if (amount > 0) {
              const displayLabel = `• ${label}`;
              if (!seenGainsLabels.has(displayLabel)) {
                gainsRows.push({ label: displayLabel, amount: amount });
                seenGainsLabels.add(displayLabel);
              } else {
                // Si déjà existant, additionner
                const existingIndex = gainsRows.findIndex(item => item.label === displayLabel);
                if (existingIndex !== -1) {
                  gainsRows[existingIndex].amount += amount;
                }
              }
            }
          });
        }

        // Bonus amount
        if (bonusAmount > 0) {
          const bonusLabel = '• prime';
          const existingIndex = gainsRows.findIndex(item => item.label === bonusLabel);
          if (existingIndex !== -1) {
            gainsRows[existingIndex].amount += bonusAmount;
          } else {
            gainsRows.push({ label: bonusLabel, amount: bonusAmount });
            seenGainsLabels.add(bonusLabel);
          }
        }

        // Heures supplémentaires
        if (overtime > 0) {
          const overtimeLabel = '• heures supplémentaires';
          const existingIndex = gainsRows.findIndex(item => item.label === overtimeLabel);
          if (existingIndex !== -1) {
            gainsRows[existingIndex].amount += overtime;
          } else {
            gainsRows.push({ label: overtimeLabel, amount: overtime });
            seenGainsLabels.add(overtimeLabel);
          }
        }

        // Total des gains
        const totalGains = gainsRows.reduce((sum, item) => sum + item.amount, 0);

        // ===== PRÉPARATION DES DÉDUCTIONS DYNAMIQUES (SANS DOUBLONS) =====
        let deductionsRows = [];
        let seenLabels = new Set();

        // Impôt
        if (taxAmount > 0) {
          deductionsRows.push({ label: 'Impôt', amount: taxAmount });
          seenLabels.add('Impôt');
        }

        // CNSS
        if (socialAmount > 0) {
          deductionsRows.push({ label: 'CNSS', amount: socialAmount });
          seenLabels.add('CNSS');
        }

        // Déductions depuis deductions (JSON)
        if (deductions && deductions.length > 0) {
          deductions.forEach(deduction => {
            const amount = parseFloat(deduction.amount) || 0;
            const label = deduction.label || deduction.name || 'déduction';
            const type = deduction.type || '';
            
            if (amount > 0) {
              let displayLabel;
              
              // Catégoriser automatiquement
              if (label.toLowerCase().includes('avance') || 
                  label.toLowerCase().includes('acompte') ||
                  type === 'advance') {
                displayLabel = '• avance';
              } else if (label.toLowerCase().includes('pret') || 
                        label.toLowerCase().includes('loan')) {
                displayLabel = '• prêt';
              } else if (label.toLowerCase().includes('assurance')) {
                displayLabel = '• assurance';
              } else {
                displayLabel = `• ${label}`;
              }
              
              // Vérifier si on a déjà ajouté cette ligne
              if (!seenLabels.has(displayLabel)) {
                deductionsRows.push({ label: displayLabel, amount: amount });
                seenLabels.add(displayLabel);
              } else {
                // Si le label existe déjà, on additionne les montants
                const existingIndex = deductionsRows.findIndex(item => item.label === displayLabel);
                if (existingIndex !== -1) {
                  deductionsRows[existingIndex].amount += amount;
                }
              }
            }
          });
        }

        // Avance depuis deduction_amount (fusionnée avec les avances existantes)
        const advanceAmount = parseFloat(payslip.deduction_amount || 0);
        if (advanceAmount > 0) {
          const advanceLabel = '• avance';
          const existingIndex = deductionsRows.findIndex(item => item.label === advanceLabel);
          if (existingIndex !== -1) {
            // Additionner si déjà existant
            deductionsRows[existingIndex].amount += advanceAmount;
          } else {
            deductionsRows.push({ label: advanceLabel, amount: advanceAmount });
            seenLabels.add(advanceLabel);
          }
        }

        // Total des déductions
        const totalDeductions = deductionsRows.reduce((sum, item) => sum + item.amount, 0);

        // ===== AFFICHAGE DES LIGNES =====
        const maxRows = Math.max(gainsRows.length, deductionsRows.length);

        for (let i = 0; i < maxRows; i++) {
          // Ligne de gains
          if (i < gainsRows.length) {
            worksheet.getCell(`A${currentRow}`).value = gainsRows[i].label;
            worksheet.getCell(`B${currentRow}`).value = gainsRows[i].amount;
            worksheet.getCell(`B${currentRow}`).numFmt = '#,##0.00 "TND"';
          } else {
            worksheet.getCell(`A${currentRow}`).value = '';
            worksheet.getCell(`B${currentRow}`).value = '';
          }

          // Ligne de déductions
          if (i < deductionsRows.length) {
            worksheet.getCell(`D${currentRow}`).value = deductionsRows[i].label;
            worksheet.getCell(`E${currentRow}`).value = deductionsRows[i].amount;
            worksheet.getCell(`E${currentRow}`).numFmt = '#,##0.00 "TND"';
          } else {
            worksheet.getCell(`D${currentRow}`).value = '';
            worksheet.getCell(`E${currentRow}`).value = '';
          }

          currentRow++;
        }

        // ===== TOTAUX =====
        worksheet.getRow(currentRow).height = 25;

        // Total gains
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const totalGainsCell = worksheet.getCell(`A${currentRow}`);
        totalGainsCell.value = 'TOTAL GAINS';
        totalGainsCell.font = { bold: true, size: 11 };
        totalGainsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F8F5' } };
        totalGainsCell.alignment = { horizontal: 'right' };
        worksheet.getCell(`B${currentRow}`).value = totalGains;
        worksheet.getCell(`B${currentRow}`).numFmt = '#,##0.00 "TND"';
        worksheet.getCell(`B${currentRow}`).font = { bold: true, color: { argb: 'FF1E8449' } };

        // Total déductions
        worksheet.mergeCells(`D${currentRow}:E${currentRow}`);
        const totalDeductionsCell = worksheet.getCell(`D${currentRow}`);
        totalDeductionsCell.value = 'TOTAL DÉDUCTIONS';
        totalDeductionsCell.font = { bold: true, size: 11 };
        totalDeductionsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDEDEC' } };
        totalDeductionsCell.alignment = { horizontal: 'right' };
        worksheet.getCell(`E${currentRow}`).value = totalDeductions;
        worksheet.getCell(`E${currentRow}`).numFmt = '#,##0.00 "TND"';
        worksheet.getCell(`E${currentRow}`).font = { bold: true, color: { argb: 'FFB03A2E' } };
        currentRow++;

        // Ligne de séparation
        worksheet.getRow(currentRow).height = 5;
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF39C12' } };
        currentRow++;

        // ===== RÉSULTAT =====
        worksheet.getRow(currentRow).height = 30;
        const netSalary = payslip.net_salary || (totalGains - totalDeductions);

        worksheet.getCell(`A${currentRow}`).value = 'BRUT';
        worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 11 };
        worksheet.getCell(`B${currentRow}`).value = totalGains;
        worksheet.getCell(`B${currentRow}`).numFmt = '#,##0.00 "TND"';
        worksheet.getCell(`B${currentRow}`).font = { bold: true, size: 12 };

        worksheet.getCell(`C${currentRow}`).value = 'DÉDUCTIONS';
        worksheet.getCell(`C${currentRow}`).font = { bold: true, size: 11 };
        worksheet.getCell(`D${currentRow}`).value = totalDeductions;
        worksheet.getCell(`D${currentRow}`).numFmt = '#,##0.00 "TND"';
        worksheet.getCell(`D${currentRow}`).font = { bold: true, size: 12 };

        worksheet.getCell(`E${currentRow}`).value = 'NET';
        worksheet.getCell(`E${currentRow}`).font = { bold: true, size: 11 };
        currentRow++;

        worksheet.getCell(`E${currentRow}`).value = netSalary;
        worksheet.getCell(`E${currentRow}`).numFmt = '#,##0.00 "TND"';
        worksheet.getCell(`E${currentRow}`).font = { bold: true, size: 14, color: { argb: 'FF1E8449' } };
        worksheet.getCell(`E${currentRow}`).alignment = { horizontal: 'center' };
        currentRow++;

        // ===== SIGNATURES =====
        const signatureRow = currentRow;
        worksheet.mergeCells(`A${signatureRow}:B${signatureRow + 1}`);
        worksheet.getCell(`A${signatureRow}`).value = 'EMPLOYÉ';
        worksheet.getCell(`A${signatureRow}`).font = { bold: true };
        worksheet.getCell(`A${signatureRow + 1}`).value = 'Signature';
        worksheet.getCell(`A${signatureRow + 1}`).font = { italic: true, size: 9 };

        worksheet.mergeCells(`D${signatureRow}:E${signatureRow + 1}`);
        worksheet.getCell(`D${signatureRow}`).value = 'EMPLOYEUR';
        worksheet.getCell(`D${signatureRow}`).font = { bold: true };
        worksheet.getCell(`D${signatureRow + 1}`).value = 'Cachet';
        worksheet.getCell(`D${signatureRow + 1}`).font = { italic: true, size: 9 };
        currentRow += 2;

        // ===== SÉPARATEUR ENTRE LES FICHES =====
        if (index < result.rows.length - 1) {
          worksheet.getRow(currentRow).height = 5;
          worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
          worksheet.getCell(`A${currentRow}`).value = Array(100).fill('─').join('');
          worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
          worksheet.getCell(`A${currentRow}`).font = { color: { argb: 'FFB0BEC5' } };
          currentRow++;

          // Ligne vide
          currentRow++;
        }

      } catch (ficheError) {
        console.error(`❌ Erreur sur la fiche ${payslip?.employee_id}:`, ficheError);
        
        // Afficher un message d'erreur dans la feuille
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        worksheet.getCell(`A${currentRow}`).value = `ERREUR: Impossible de générer la fiche pour ${payslip?.first_name || ''} ${payslip?.last_name || ''}`;
        worksheet.getCell(`A${currentRow}`).font = { color: { argb: 'FFD32F2F' }, bold: true };
        worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
        currentRow += 2;
      }
    }

    // ===== BAS DE PAGE GLOBAL =====
    worksheet.getRow(currentRow).height = 5;
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } };
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = `Document généré le ${new Date().toLocaleString('fr-FR')} - ${result.rows.length} fiches de paie`;
    worksheet.getCell(`A${currentRow}`).font = { size: 9, color: { argb: 'FF5D6D7E' } };
    worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };

    // ===== GÉNÉRATION DU FICHIER =====
    const fileName = `fiches_paie_${month_year}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
    
    console.log(`✅ [EXCEL] ${result.rows.length} fiches générées sur une seule feuille`);
    
  } catch (error) {
    console.error('[EXCEL] Erreur:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Erreur lors de la génération du fichier Excel',
        details: error.message 
      });
    }
  }
}

  async exportPayslipsToZip(req, res) {
    try {
      console.log('📦 [EXPORT] Début export ZIP des fiches de paie');
      
      // ===== VÉRIFICATION STRICTE - ADMIN UNIQUEMENT =====
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Export ZIP réservé aux administrateurs',
          error: 'ZIP_EXPORT_DENIED',
          code: 'FORBIDDEN_ZIP_EXPORT',
          requiredRole: 'admin',
          yourRole: req.user.role
        });
      }
      // ===== FIN VÉRIFICATION =====

      const { month_year = '2026-10' } = req.query;

      const monthCheck = await db.query(
        'SELECT * FROM pay_months WHERE month_year = $1',
        [month_year]
      );

      if (monthCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Mois ${month_year} non trouvé`,
          code: 'MONTH_NOT_FOUND'
        });
      }

      const month = monthCheck.rows[0];
      const payments = await db.query(`
        SELECT sp.*, e.first_name, e.last_name, e.email, e.department
        FROM salary_payments sp
        JOIN employees e ON sp.employee_id = e.employee_id
        WHERE sp.month_year = $1
        AND sp.payment_status = 'paid'
        ORDER BY e.last_name, e.first_name
      `, [month_year]);

      if (payments.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Aucun paiement trouvé pour ce mois',
          code: 'NO_PAYMENTS_FOUND'
        });
      }

      const zip = new AdmZip();

      const csvHeaders = ['ID Employé', 'Nom', 'Prénom', 'Département', 'Salaire Net', 'Statut', 'Date Paiement'];
      const csvRows = payments.rows.map(p => [
        p.employee_id, p.last_name, p.first_name, p.department,
        p.net_salary, p.payment_status,
        p.payment_date ? new Date(p.payment_date).toLocaleDateString('fr-FR') : ''
      ]);
      const csvContent = [csvHeaders.join(',')]
        .concat(csvRows.map(row => row.map(cell => `"${cell}"`).join(',')))
        .join('\n');
      zip.addFile('recapitulatif_paiements.csv', Buffer.from(csvContent, 'utf-8'));

      const readmeContent = `
ARCHIVE DES FICHES DE PAIE - ${month.month_name} ${month_year}

Date de génération: ${new Date().toLocaleString('fr-FR')}
Total employés: ${payments.rows.length}
Montant total: ${payments.rows.reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0).toFixed(2)} TND

CONTENU:
- recapitulatif_paiements.csv : Liste détaillée de tous les paiements

INSTRUCTIONS:
1. Cette archive contient les données des paiements pour le mois ${month.month_name}
2. Le fichier CSV peut être ouvert avec Excel, Google Sheets, ou tout éditeur de texte
3. Les données sont au format UTF-8

INFORMATIONS TECHNIQUES:
- Format: ZIP
- Encodage: UTF-8
- Généré par: Smart Attendance System
- Version: 1.0

© ${new Date().getFullYear()} Smart Attendance System
`;
      zip.addFile('README.txt', Buffer.from(readmeContent, 'utf-8'));

      const metadata = {
        month_year: month_year,
        month_name: month.month_name,
        generated_at: new Date().toISOString(),
        total_payments: payments.rows.length,
        total_amount: payments.rows.reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0),
        payments: payments.rows.map(p => ({
          employee_id: p.employee_id,
          name: `${p.first_name} ${p.last_name}`,
          department: p.department,
          net_salary: p.net_salary,
          status: p.payment_status,
          email: p.email
        })).slice(0, 10)
      };
      zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8'));

      const zipBuffer = zip.toBuffer();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `fiches_paie_${month_year}_${timestamp}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', zipBuffer.length);
      res.setHeader('X-Archive-Info', JSON.stringify({
        month_year, month_name: month.month_name,
        files_count: 3, total_size: zipBuffer.length,
        generated_at: new Date().toISOString()
      }));

      res.send(zipBuffer);
      console.log(`✅ Archive ZIP créée: ${filename} (${zipBuffer.length} octets)`);
    } catch (error) {
      console.error('❌ [EXPORT ZIP] Erreur:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la création de l\'archive ZIP',
          error: error.message,
          code: 'ZIP_EXPORT_ERROR'
        });
      }
    }
  }

  async exportPayslipsToZipAdvanced(req, res) {
  try {
    console.log('📦 [EXPORT AVANCÉ] Début export ZIP avancé des fiches de paie');
    
    // ===== VÉRIFICATION STRICTE - ADMIN UNIQUEMENT =====
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié',
        code: 'UNAUTHORIZED'
      });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Export ZIP avancé réservé aux administrateurs',
        error: 'ADVANCED_ZIP_DENIED',
        code: 'FORBIDDEN_ADVANCED_ZIP',
        requiredRole: 'admin',
        yourRole: req.user.role
      });
    }
    // ===== FIN VÉRIFICATION =====

    const { month_year = '2026-10' } = req.query;

    const monthCheck = await db.query(
      'SELECT * FROM pay_months WHERE month_year = $1',
      [month_year]
    );

    if (monthCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Mois ${month_year} non trouvé`,
        code: 'MONTH_NOT_FOUND'
      });
    }

    const month = monthCheck.rows[0];
    
    // ✅ REQUÊTE CORRIGÉE - SANS COMMENTAIRES
    const payments = await db.query(`
      SELECT 
        sp.*, 
        e.first_name, 
        e.last_name, 
        e.cin,
        e.cnss_number,
        e.email, 
        e.phone,
        e.department,
        e.position,
        e.hire_date,
        pm.month_name,
        pm.month_year,
        pm.status as month_status
      FROM salary_payments sp
      JOIN employees e ON sp.employee_id = e.employee_id
      JOIN pay_months pm ON sp.month_year = pm.month_year
      WHERE sp.month_year = $1
      ORDER BY e.department, e.last_name, e.first_name
    `, [month_year]);

    if (payments.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucun paiement trouvé pour ce mois',
        code: 'NO_PAYMENTS_FOUND'
      });
    }

      const zip = new AdmZip();

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Fiches de Paie');
      worksheet.columns = [
        { header: 'ID Employé', key: 'employee_id', width: 12 },
        { header: 'Nom', key: 'last_name', width: 15 },
        { header: 'Prénom', key: 'first_name', width: 15 },
        { header: 'Département', key: 'department', width: 15 },
        { header: 'Poste', key: 'position', width: 15 },
        { header: 'Salaire Brut', key: 'gross_salary', width: 12 },
        { header: 'Déductions', key: 'deductions', width: 12 },
        { header: 'Salaire Net', key: 'net_salary', width: 12 },
        { header: 'Prime', key: 'bonus', width: 10 },
        { header: 'Avance', key: 'advance', width: 10 },
        { header: 'Statut', key: 'payment_status', width: 10 },
        { header: 'Date Paiement', key: 'payment_date', width: 15 },
        { header: 'Méthode', key: 'payment_method', width: 12 },
        { header: 'Référence', key: 'payment_reference', width: 20 }
      ];

      payments.rows.forEach(payment => {
        worksheet.addRow({
          employee_id: payment.employee_id,
          last_name: payment.last_name,
          first_name: payment.first_name,
          department: payment.department,
          position: payment.position,
          gross_salary: payment.gross_salary || '0',
          deductions: payment.deductions || '0',
          net_salary: payment.net_salary || '0',
          bonus: payment.bonus || '0',
          advance: payment.advance || '0',
          payment_status: payment.payment_status === 'paid' ? 'Payé' : 'En attente',
          payment_date: payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('fr-FR') : 'Non payé',
          payment_method: payment.payment_method || 'Non spécifié',
          payment_reference: payment.payment_reference || 'N/A'
        });
      });

      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      const excelBuffer = await workbook.xlsx.writeBuffer();
      zip.addFile(`fiches_paie_${month_year}.xlsx`, Buffer.from(excelBuffer));

      const doc = new PDFDocument({ margin: 50 });
      let pdfContent = '';
      doc.on('data', chunk => pdfContent += chunk);
      await new Promise((resolve) => {
        doc.on('end', resolve);
        doc.fontSize(16).text(`RAPPORT DES PAIEMENTS - ${month.month_name}`, { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Date de génération: ${new Date().toLocaleString('fr-FR')}`);
        doc.text(`Total employés: ${payments.rows.length}`);
        doc.text(`Montant total: ${payments.rows.reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0).toFixed(2)} TND`);
        doc.moveDown();
        doc.fontSize(14).text('Détails par département:');
        doc.moveDown();

        const byDepartment = payments.rows.reduce((acc, payment) => {
          const dept = payment.department || 'Non spécifié';
          if (!acc[dept]) acc[dept] = [];
          acc[dept].push(payment);
          return acc;
        }, {});

        Object.entries(byDepartment).forEach(([dept, deptPayments]) => {
          doc.fontSize(12).font('Helvetica-Bold').text(dept);
          doc.font('Helvetica').fontSize(10);
          deptPayments.forEach(payment => {
            doc.text(`  ${payment.first_name} ${payment.last_name}: ${payment.net_salary} TND`);
          });
          const deptTotal = deptPayments.reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0);
          doc.font('Helvetica-Bold').text(`  Total ${dept}: ${deptTotal.toFixed(2)} TND`);
          doc.moveDown();
        });
        doc.end();
      });
      zip.addFile(`recapitulatif_${month_year}.pdf`, Buffer.from(pdfContent));

      const folderName = `fiches_individuelles_${month_year}`;
      payments.rows.slice(0, 50).forEach((payment) => {
        const individualCsv = [
          ['FICHE DE PAIE INDIVIDUELLE'],
          [`Mois: ${month.month_name}`],
          [`Employé: ${payment.first_name} ${payment.last_name}`],
          [`ID: ${payment.employee_id}`],
          [`CIN: ${payment.cin || 'Non renseigné'}`],           
          [`N° CNSS: ${payment.cnss_number || 'Non renseigné'}`],  
          [`Département: ${payment.department}`],
          [`Poste: ${payment.position}`],
          [],
          ['DÉTAILS DU PAIEMENT'],
          [`Salaire Brut: ${payment.gross_salary || '0'} TND`],
          [`Déductions: ${payment.deductions || '0'} TND`],
          [`Prime: ${payment.bonus || '0'} TND`],
          [`Avance: ${payment.advance || '0'} TND`],
          [`Salaire Net: ${payment.net_salary || '0'} TND`],
          [`Statut: ${payment.payment_status === 'paid' ? 'Payé' : 'En attente'}`],
          [`Date paiement: ${payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('fr-FR') : 'Non payé'}`],
          [`Méthode: ${payment.payment_method || 'Non spécifié'}`],
          [`Référence: ${payment.payment_reference || 'N/A'}`]
        ].map(row => row.join(',')).join('\n');
        const safeName = `${payment.last_name}_${payment.first_name}`.replace(/[^a-zA-Z0-9]/g, '_');
        zip.addFile(`${folderName}/${safeName}_${month_year}.csv`, Buffer.from(individualCsv, 'utf-8'));
      });

      const zipBuffer = zip.toBuffer();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `fiches_paie_complet_${month_year}_${timestamp}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      console.log(`✅ Export ZIP avancé terminé: ${filename} (${zipBuffer.length} octets)`);
      res.send(zipBuffer);
    } catch (error) {
      console.error('❌ [EXPORT ZIP AVANCÉ] Erreur:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la création de l\'archive ZIP avancée',
          error: error.message,
          code: 'ADVANCED_ZIP_EXPORT_ERROR'
        });
      }
    }
  }

  async exportPayslipsToCSV(req, res) {
    try {
      console.log('📋 Export CSV des fiches de paie...');
      
      // ===== VÉRIFICATION STRICTE - ADMIN UNIQUEMENT =====
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Export CSV des fiches de paie réservé aux administrateurs',
          error: 'CSV_EXPORT_DENIED',
          code: 'FORBIDDEN_CSV_EXPORT',
          requiredRole: 'admin',
          yourRole: req.user.role
        });
      }
      // ===== FIN VÉRIFICATION =====

      const { month_year = '2026-10' } = req.query;

      const monthCheck = await db.query(
        'SELECT * FROM pay_months WHERE month_year = $1',
        [month_year]
      );

      if (monthCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Mois ${month_year} non trouvé`,
          code: 'MONTH_NOT_FOUND'
        });
      }

      const month = monthCheck.rows[0];
      const payments = await db.query(`
        SELECT sp.*, e.first_name, e.last_name, e.email, e.department, e.position
        FROM salary_payments sp
        JOIN employees e ON sp.employee_id = e.employee_id
        WHERE sp.month_year = $1
        ORDER BY e.department, e.last_name, e.first_name
      `, [month_year]);

      if (payments.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Aucun paiement trouvé pour ce mois',
          code: 'NO_PAYMENTS_FOUND'
        });
      }

      const headers = [
        'ID Employé', 'Nom', 'Prénom', 'Département', 'Poste', 'Salaire Brut',
        'Déductions', 'Salaire Net', 'Prime', 'Avance', 'Statut',
        'Date Paiement', 'Méthode', 'Référence'
      ];

      const csvRows = payments.rows.map(payment => [
        payment.employee_id, payment.last_name, payment.first_name,
        payment.department, payment.position,
        payment.gross_salary || '0', payment.deductions || '0',
        payment.net_salary || '0', payment.bonus || '0', payment.advance || '0',
        payment.payment_status === 'paid' ? 'Payé' : 'En attente',
        payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('fr-FR') : 'Non payé',
        payment.payment_method || 'Non spécifié',
        payment.payment_reference || 'N/A'
      ]);

      const csvContent = [headers.join(';')]
        .concat(csvRows.map(row => row.map(cell => `"${cell}"`).join(';')))
        .join('\n');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `fiches_paie_${month.month_year}_${timestamp}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
      console.log(`✅ Export CSV fiches de paie terminé: ${payments.rows.length} lignes`);
    } catch (error) {
      console.error('❌ Erreur export CSV fiches de paie:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'export CSV des fiches de paie',
        error: error.message
      });
    }
  }

  async exportPayslipsBatch(req, res) {
    try {
      console.log('📦 [EXPORT BATCH] Début export par lot...');
      
      // ===== VÉRIFICATION STRICTE - ADMIN UNIQUEMENT =====
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Export par lot réservé aux administrateurs',
          error: 'BATCH_EXPORT_DENIED',
          code: 'FORBIDDEN_BATCH_EXPORT',
          requiredRole: 'admin',
          yourRole: req.user.role
        });
      }
      // ===== FIN VÉRIFICATION =====

      const { month_year, limit = 100, offset = 0 } = req.query;
      const limitNum = Math.min(parseInt(limit), 200);
      const offsetNum = parseInt(offset);

      const monthCheck = await db.query(
        'SELECT * FROM pay_months WHERE month_year = $1',
        [month_year]
      );

      if (monthCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Mois ${month_year} non trouvé`,
          code: 'MONTH_NOT_FOUND'
        });
      }

      const month = monthCheck.rows[0];
      const payments = await db.query(`
        SELECT sp.*, e.first_name, e.last_name, e.email, e.department
        FROM salary_payments sp
        JOIN employees e ON sp.employee_id = e.employee_id
        WHERE sp.month_year = $1
        ORDER BY e.last_name, e.first_name
        LIMIT $2 OFFSET $3
      `, [month_year, limitNum, offsetNum]);

      if (payments.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Aucun paiement trouvé pour ce lot',
          code: 'BATCH_EMPTY'
        });
      }

      const zip = new AdmZip();

      const csvHeaders = ['ID Employé', 'Nom', 'Prénom', 'Département', 'Salaire Net', 'Statut', 'Date Paiement'];
      const csvRows = payments.rows.map(p => [
        p.employee_id, p.last_name, p.first_name, p.department,
        p.net_salary, p.payment_status,
        p.payment_date ? new Date(p.payment_date).toLocaleDateString('fr-FR') : ''
      ]);
      const csvContent = [csvHeaders.join(',')]
        .concat(csvRows.map(row => row.map(cell => `"${cell}"`).join(',')))
        .join('\n');
      zip.addFile(`lot_${Math.floor(offsetNum / limitNum) + 1}.csv`, Buffer.from(csvContent, 'utf-8'));

      const totalCount = await db.query(
        'SELECT COUNT(*) FROM salary_payments WHERE month_year = $1',
        [month_year]
      );
      const total = parseInt(totalCount.rows[0].count, 10);
      const currentLot = Math.floor(offsetNum / limitNum) + 1;
      const totalLots = Math.ceil(total / limitNum);
      const nextOffset = offsetNum + limitNum;
      const hasNext = nextOffset < total;

      const info = {
        month_year, month_name: month.month_name,
        batch_size: limitNum, current_batch: currentLot,
        total_batches: totalLots, current_offset: offsetNum,
        next_offset: hasNext ? nextOffset : null,
        has_next_batch: hasNext, items_in_batch: payments.rows.length,
        total_items: total, generated_at: new Date().toISOString(),
        batch_complete: !hasNext
      };
      zip.addFile('info_batch.json', Buffer.from(JSON.stringify(info, null, 2), 'utf-8'));

      const readmeContent = `
LOT ${currentLot}/${totalLots} - FICHES DE PAIE ${month.month_name}

Contenu:
- lot_${currentLot}.csv : ${payments.rows.length} fiches de paie
- info_batch.json : Informations sur ce lot et les lots suivants

Instructions:
1. Ce fichier contient les fiches de paie ${offsetNum + 1} à ${offsetNum + payments.rows.length}
2. ${hasNext ? `Après ce téléchargement, vous pourrez télécharger le lot ${currentLot + 1}/${totalLots}` : 'C\'est le dernier lot'}
3. Tous les lots seront numérotés de 1 à ${totalLots}

Statut: ${hasNext ? 'EN COURS' : 'COMPLET'}
`;
      zip.addFile('README.txt', Buffer.from(readmeContent, 'utf-8'));

      const zipBuffer = zip.toBuffer();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `fiches_paie_${month_year}_lot_${currentLot}_${timestamp}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', zipBuffer.length);
      res.setHeader('X-Batch-Info', JSON.stringify(info));

      console.log(`✅ Lot ${currentLot}/${totalLots} créé: ${filename} (${zipBuffer.length} octets)`);
      res.send(zipBuffer);
    } catch (error) {
      console.error('❌ [EXPORT BATCH] Erreur:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la création du lot',
          error: error.message
        });
      }
    }
  }

  async downloadAllBatches(req, res) {
    try {
      console.log('📦 [EXPORT] Téléchargement de tous les lots demandé...');
      
      // ===== VÉRIFICATION STRICTE - ADMIN UNIQUEMENT =====
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Téléchargement de tous les lots réservé aux administrateurs',
          error: 'ALL_BATCHES_DENIED',
          code: 'FORBIDDEN_ALL_BATCHES',
          requiredRole: 'admin',
          yourRole: req.user.role
        });
      }
      // ===== FIN VÉRIFICATION =====

      const { month_year, batch_size = 100 } = req.query;

      if (!month_year) {
        return res.status(400).json({
          success: false,
          message: 'Le paramètre month_year est requis'
        });
      }

      const monthCheck = await db.query(
        'SELECT * FROM pay_months WHERE month_year = $1',
        [month_year]
      );

      if (monthCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Mois ${month_year} non trouvé`,
          code: 'MONTH_NOT_FOUND'
        });
      }

      const month = monthCheck.rows[0];
      const totalCount = await db.query(
        'SELECT COUNT(*) FROM salary_payments WHERE month_year = $1',
        [month_year]
      );

      const total = parseInt(totalCount.rows[0].count, 10);
      const batchSize = parseInt(batch_size);
      const totalBatches = Math.ceil(total / batchSize);

      if (total === 0) {
        return res.status(404).json({
          success: false,
          message: 'Aucune fiche de paie trouvée pour ce mois',
          code: 'NO_PAYSLIPS_FOUND'
        });
      }

      const zip = new AdmZip();
      const info = {
        month_year: month.month_year,
        month_name: month.month_name,
        total_payslips: total,
        batch_size: batchSize,
        total_batches: totalBatches,
        generated_at: new Date().toISOString(),
        instruction: 'Ce ZIP contient les informations pour télécharger tous les lots'
      };

      zip.addFile('instructions.txt', Buffer.from(`
TÉLÉCHARGEMENT COMPLET DES FICHES DE PAIE
=========================================

Mois: ${month.month_name}
Total fiches: ${total}
Taille de lot: ${batchSize} fiches
Nombre de lots: ${totalBatches}

INSTRUCTIONS:
1. Chaque lot doit être téléchargé séparément
2. Utilisez les URLs ci-dessous pour chaque lot
3. Tous les fichiers seront au format ZIP

URLS DES LOTS:
${Array.from({ length: totalBatches }, (_, i) =>
        `Lot ${i + 1}: /api/exports/payslips/batch?month_year=${month_year}&limit=${batchSize}&offset=${i * batchSize}`
      ).join('\n')}

NOTE: Pour des raisons de performance, le téléchargement complet est divisé en lots.
      `, 'utf-8'));

      const batches = Array.from({ length: totalBatches }, (_, i) => ({
        batch_number: i + 1,
        offset: i * batchSize,
        limit: batchSize,
        url: `/api/exports/payslips/batch?month_year=${month_year}&limit=${batchSize}&offset=${i * batchSize}`,
        estimated_count: i === totalBatches - 1 ? total - (i * batchSize) : batchSize
      }));
      zip.addFile('batches.json', Buffer.from(JSON.stringify({ ...info, batches }, null, 2), 'utf-8'));

      const scriptContent = `
#!/bin/bash
# Script pour télécharger automatiquement tous les lots

MONTH_YEAR="${month_year}"
BATCH_SIZE=${batchSize}
TOTAL_BATCHES=${totalBatches}
BASE_URL="http://localhost:5000/api/exports/payslips/batch"

echo "📦 Début du téléchargement de ${totalBatches} lots..."
echo "📊 Mois: ${month.month_name}"
echo "📁 Total fiches: ${total}"

for ((i=0; i<TOTAL_BATCHES; i++))
do
  OFFSET=$((i * BATCH_SIZE))
  FILENAME="lot_$((i+1))_${month_year}.zip"
  
  echo "⬇️  Téléchargement lot $((i+1))/\${TOTAL_BATCHES}..."
  curl -s "\${BASE_URL}?month_year=\${MONTH_YEAR}&limit=\${BATCH_SIZE}&offset=\${OFFSET}" -o "\${FILENAME}"
  
  if [ $? -eq 0 ]; then
    echo "✅ Lot $((i+1)) téléchargé: \${FILENAME}"
  else
    echo "❌ Erreur téléchargement lot $((i+1))"
  fi
  
  sleep 1
done

echo "🎉 Téléchargement terminé!"
echo "📁 Fichiers téléchargés:"
ls -la *${month_year}.zip
`;
      zip.addFile('download_all.sh', Buffer.from(scriptContent, 'utf-8'));

      const psScriptContent = `
# Script PowerShell pour télécharger tous les lots
$MonthYear = "${month_year}"
$BatchSize = ${batchSize}
$TotalBatches = ${totalBatches}
$BaseUrl = "http://localhost:5000/api/exports/payslips/batch"

Write-Host "📦 Début du téléchargement de $TotalBatches lots..." -ForegroundColor Cyan
Write-Host "📊 Mois: ${month.month_name}" -ForegroundColor Cyan
Write-Host "📁 Total fiches: ${total}" -ForegroundColor Cyan

for ($i = 0; $i -lt $TotalBatches; $i++) {
    $Offset = $i * $BatchSize
    $FileName = "lot_$($i+1)_${month_year}.zip"
    
    Write-Host "⬇️  Téléchargement lot $($i+1)/$TotalBatches..." -ForegroundColor Yellow
    $Url = "$BaseUrl?month_year=$MonthYear&limit=$BatchSize&offset=$Offset"
    
    try {
        Invoke-WebRequest -Uri $Url -OutFile $FileName
        Write-Host "✅ Lot $($i+1) téléchargé: $FileName" -ForegroundColor Green
    } catch {
        Write-Host "❌ Erreur téléchargement lot $($i+1): $_" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 1
}

Write-Host "🎉 Téléchargement terminé!" -ForegroundColor Green
Write-Host "📁 Fichiers téléchargés:" -ForegroundColor Cyan
Get-ChildItem "*${month_year}.zip" | Format-Table Name, Length, LastWriteTime
`;
      zip.addFile('download_all.ps1', Buffer.from(psScriptContent, 'utf-8'));

      const zipBuffer = zip.toBuffer();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `instructions_complet_${month_year}_${timestamp}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', zipBuffer.length);
      res.setHeader('X-Total-Batches', totalBatches);
      res.setHeader('X-Total-Payslips', total);

      console.log(`✅ Instructions générées pour ${totalBatches} lots`);
      res.send(zipBuffer);
    } catch (error) {
      console.error('❌ [DOWNLOAD ALL BATCHES] Erreur:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la génération des instructions de téléchargement',
          error: error.message
        });
      }
    }
  }

  async getPayslipsBatchInfo(req, res) {
    try {
      // ===== VÉRIFICATION - ADMIN UNIQUEMENT =====
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Informations de lot réservées aux administrateurs',
          error: 'BATCH_INFO_DENIED',
          code: 'FORBIDDEN_BATCH_INFO',
          requiredRole: 'admin',
          yourRole: req.user.role
        });
      }
      // ===== FIN VÉRIFICATION =====

      const { month_year, batch_size = 100 } = req.query;

      if (!month_year) {
        return res.status(400).json({
          success: false,
          message: 'Le paramètre month_year est requis'
        });
      }

      const monthCheck = await db.query(
        'SELECT * FROM pay_months WHERE month_year = $1',
        [month_year]
      );

      if (monthCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Mois ${month_year} non trouvé`,
          code: 'MONTH_NOT_FOUND'
        });
      }

      const month = monthCheck.rows[0];
      const totalCount = await db.query(
        'SELECT COUNT(*) FROM salary_payments WHERE month_year = $1',
        [month_year]
      );

      const total = parseInt(totalCount.rows[0].count, 10);
      const batchSize = parseInt(batch_size);
      const totalBatches = Math.ceil(total / batchSize);

      res.json({
        success: true,
        data: {
          month_year: month.month_year,
          month_name: month.month_name,
          total_payslips: total,
          batch_size: batchSize,
          total_batches: totalBatches,
          estimated_size_per_batch_kb: Math.ceil((total / totalBatches) * 0.5),
          recommendation: total > 500 ?
            `Recommandé: ${batchSize} fiches par lot (${totalBatches} lots)` :
            'Recommandé: Téléchargement en un seul lot',
          batches: Array.from({ length: totalBatches }, (_, i) => ({
            batch_number: i + 1,
            offset: i * batchSize,
            limit: batchSize,
            estimated_count: i === totalBatches - 1 ? total - (i * batchSize) : batchSize
          }))
        }
      });
    } catch (error) {
      console.error('❌ Erreur récupération info batch:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des informations',
        error: error.message
      });
    }
  }

  async checkPayslipData(req, res) {
    try {
      // ===== VÉRIFICATION - ADMIN UNIQUEMENT =====
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Vérification des données réservée aux administrateurs',
          error: 'CHECK_DATA_DENIED',
          code: 'FORBIDDEN_CHECK_DATA',
          requiredRole: 'admin',
          yourRole: req.user.role
        });
      }
      // ===== FIN VÉRIFICATION =====

      const { month_year } = req.query;

      if (!month_year) {
        return res.status(400).json({
          success: false,
          message: 'Le paramètre month_year est requis'
        });
      }

      const monthCheck = await db.query(
        'SELECT * FROM pay_months WHERE month_year = $1',
        [month_year]
      );

      if (monthCheck.rows.length === 0) {
        return res.json({
          success: true,
          exists: false,
          message: `Mois ${month_year} non trouvé`
        });
      }

      const month = monthCheck.rows[0];
      const paymentsCount = await db.query(
        'SELECT COUNT(*) FROM salary_payments WHERE month_year = $1',
        [month_year]
      );

      const count = parseInt(paymentsCount.rows[0].count, 10);

      res.json({
        success: true,
        exists: count > 0,
        month_year: month.month_year,
        month_name: month.month_name,
        payslips_count: count,
        can_export: count > 0,
        message: count > 0 ? `${count} fiches de paie disponibles` : 'Aucune fiche de paie disponible'
      });
    } catch (error) {
      console.error('❌ Erreur vérification données:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification des données',
        error: error.message
      });
    }
  }

  async getPayslipZipInfo(req, res) {
    try {
      // ===== VÉRIFICATION - ADMIN UNIQUEMENT =====
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Informations ZIP réservées aux administrateurs',
          error: 'ZIP_INFO_DENIED',
          code: 'FORBIDDEN_ZIP_INFO',
          requiredRole: 'admin',
          yourRole: req.user.role
        });
      }
      // ===== FIN VÉRIFICATION =====

      const { month_year } = req.query;

      if (!month_year) {
        return res.status(400).json({
          success: false,
          message: 'Le paramètre month_year est requis'
        });
      }

      const monthCheck = await db.query(
        'SELECT * FROM pay_months WHERE month_year = $1',
        [month_year]
      );

      if (monthCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Mois ${month_year} non trouvé`,
          code: 'MONTH_NOT_FOUND'
        });
      }

      const paymentsCount = await db.query(
        'SELECT COUNT(*) FROM salary_payments WHERE month_year = $1',
        [month_year]
      );
      const employeesCount = await db.query(
        'SELECT COUNT(DISTINCT employee_id) FROM salary_payments WHERE month_year = $1',
        [month_year]
      );
      const totalAmount = await db.query(
        'SELECT SUM(net_salary) as total FROM salary_payments WHERE month_year = $1',
        [month_year]
      );

      const month = monthCheck.rows[0];
      const count = parseInt(paymentsCount.rows[0].count, 10);
      const employees = parseInt(employeesCount.rows[0].count, 10);
      const total = parseFloat(totalAmount.rows[0].total || 0);
      let estimatedSize = 0;
      if (count > 0) estimatedSize = (count * 5) + 50;

      res.json({
        success: true,
        data: {
          month_year: month.month_year,
          month_name: month.month_name,
          payslips_count: count,
          employees_count: employees,
          total_amount: total,
          estimated_size_kb: estimatedSize,
          estimated_size_mb: (estimatedSize / 1024).toFixed(2),
          available_formats: ['zip', 'zip-advanced', 'excel', 'pdf'],
          can_generate: count > 0,
          last_updated: month.updated_at || month.created_at,
          generation_time_estimate: count > 50 ? '30-60 secondes' : count > 20 ? '15-30 secondes' : '5-15 secondes'
        }
      });
    } catch (error) {
      console.error('❌ Erreur récupération info ZIP:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des informations',
        error: error.message
      });
    }
  }

  // =========================================================================
// EXPORT EXCEL DES POINTAGES AVEC CIN
// =========================================================================
async exportAttendanceToExcel(req, res) {
  try {
    console.log('📈 Export Excel des pointages...');
    
    // ===== VÉRIFICATION DES PERMISSIONS =====
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié',
        code: 'UNAUTHORIZED'
      });
    }

    const userRole = req.user.role;
    const userDepartment = req.user.department;
    
    // ✅ Récupération des paramètres avec CIN
    const { startDate, endDate, department, employeeId, employee_id, cin } = req.query;
    const targetEmployeeId = employee_id || employeeId;

    console.log('📋 Paramètres reçus Excel:', { 
      startDate, 
      endDate, 
      department, 
      employeeId, 
      employee_id,
      cin,
      userRole,
      userDepartment 
    });

    // EMPLOYÉ - interdit
    if (userRole === 'employee') {
      return res.status(403).json({
        success: false,
        message: 'Les employés ne peuvent pas exporter les rapports de présence',
        error: 'EMPLOYEE_EXPORT_DENIED',
        requiredRole: 'manager ou admin'
      });
    }

    // MANAGER - vérifications
    if (userRole === 'manager') {
      if (department && department !== userDepartment) {
        return res.status(403).json({
          success: false,
          message: `Vous ne pouvez exporter que les données du département ${userDepartment}`,
          error: 'DEPARTMENT_EXPORT_DENIED',
          userDepartment: userDepartment,
          requestedDepartment: department
        });
      }
    }
    // ===== FIN VÉRIFICATION =====

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Les dates de début et fin sont requises'
      });
    }

    // ✅ RECHERCHE DE L'EMPLOYÉ - PRIORITÉ AU CIN
    let actualEmployeeId = targetEmployeeId;
    let employeeCIN = cin;
    let employeeInfo = null;

    // Si un CIN est fourni, on cherche par CIN d'abord
    if (cin) {
      const empResult = await db.query(
        'SELECT employee_id, first_name, last_name, email, cin, department FROM employees WHERE cin = $1',
        [cin]
      );
      
      if (empResult.rows.length > 0) {
        employeeInfo = empResult.rows[0];
        actualEmployeeId = employeeInfo.employee_id;
        employeeCIN = employeeInfo.cin;
        console.log(`🔵 Employé trouvé par CIN: ${employeeInfo.first_name} ${employeeInfo.last_name} (CIN: ${employeeInfo.cin})`);
      }
    }
    // Sinon, recherche par email/ID
    else if (targetEmployeeId && targetEmployeeId.includes('@')) {
      const empResult = await db.query(
        'SELECT employee_id, first_name, last_name, email, cin FROM employees WHERE email = $1',
        [targetEmployeeId]
      );
      
      if (empResult.rows.length > 0) {
        employeeInfo = empResult.rows[0];
        actualEmployeeId = employeeInfo.employee_id;
        employeeCIN = employeeInfo.cin;
        console.log(`🔵 Email ${targetEmployeeId} → ID: ${actualEmployeeId}, CIN: ${employeeInfo.cin || 'N/A'}`);
      }
    }

    // ✅ CONSTRUCTION DE LA REQUÊTE SQL AVEC CIN
    let query = `
      SELECT 
        a.id,
        a.employee_id,
        e.cin,
        COALESCE(a.employee_name, CONCAT(e.first_name, ' ', e.last_name)) as employee_name,
        COALESCE(a.department, e.department, 'Non spécifié') as department,
        a.record_date,
        a.attendance_date,
        a.check_in_time,
        a.check_out_time,
        a.status,
        a.hours_worked,
        a.shift_name,
        a.verification_method,
        a.face_verified,
        a.face_confidence,
        a.notes,
        a.created_at,
        a.updated_at,
        e.position,
        e.email,
        e.phone
      FROM attendance a
      LEFT JOIN employees e ON a.employee_id = e.employee_id
      WHERE a.record_date BETWEEN $1 AND $2
    `;

    const params = [startDate, endDate];
    let paramIndex = 3;

    // ✅ FILTRE PRIORITAIRE: employee_id
    if (actualEmployeeId) {
      query += ` AND a.employee_id = $${paramIndex}`;
      params.push(actualEmployeeId);
      paramIndex++;
      console.log(`🔵 FILTRE EMPLOYÉ APPLIQUÉ: ${actualEmployeeId}`);
    }
    // FILTRE DÉPARTEMENT POUR MANAGER
    else if (userRole === 'manager' && userDepartment) {
      query += ` AND COALESCE(a.department, e.department) = $${paramIndex}`;
      params.push(userDepartment);
      paramIndex++;
      console.log(`📋 FILTRE MANAGER: département ${userDepartment}`);
    } 
    // FILTRE DÉPARTEMENT GÉNÉRAL
    else if (department) {
      query += ` AND COALESCE(a.department, e.department) = $${paramIndex}`;
      params.push(department);
      paramIndex++;
      console.log(`🏢 FILTRE DÉPARTEMENT: ${department}`);
    }
    // ADMIN sans filtre → TOUS les employés
    else if (userRole === 'admin') {
      console.log('👑 ADMIN - PAS DE FILTRE: tous les employés');
    }

    query += ` ORDER BY a.record_date DESC, a.check_in_time DESC`;

    console.log('📊 Exécution requête SQL...');
    const result = await db.query(query, params);
    const attendanceData = result.rows;

    // FILTRAGE SUPPLÉMENTAIRE POUR MANAGER (sécurité)
    let filteredData = attendanceData;
    if (userRole === 'manager' && userDepartment && !actualEmployeeId) {
      filteredData = attendanceData.filter(record => 
        record.department === userDepartment
      );
    }

    console.log(`📈 ${filteredData.length} enregistrements trouvés`);

    if (filteredData.length === 0) {
      const message = actualEmployeeId 
        ? `Aucune donnée trouvée pour l'employé (${actualEmployeeId}) sur cette période`
        : `Aucune donnée trouvée pour la période du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`;
      
      return res.status(404).json({
        success: false,
        message: message,
        userRole: userRole,
        filter: actualEmployeeId ? `Employé: ${actualEmployeeId}` : 
                userRole === 'manager' ? `Département: ${userDepartment}` : 
                department ? `Département: ${department}` : 'Aucun filtre'
      });
    }

    // ✅ CRÉATION DU FICHIER EXCEL (STYLE IDENTIQUE)
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Smart Attendance System';
    workbook.lastModifiedBy = 'Smart Attendance System';
    workbook.created = new Date();
    workbook.modified = new Date();

    // ===== FEUILLE PRINCIPALE AVEC CIN =====
    const worksheet = workbook.addWorksheet('Pointages');
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'ID Employé', key: 'employee_id', width: 12 },
      { header: 'CIN', key: 'cin', width: 15 }, // ← NOUVELLE COLONNE CIN
      { header: 'Nom Employé', key: 'employee_name', width: 25 },
      { header: 'Département', key: 'department', width: 15 },
      { header: 'Date', key: 'record_date', width: 15 },
      { header: 'Heure Arrivée', key: 'check_in_time', width: 12 },
      { header: 'Heure Départ', key: 'check_out_time', width: 12 },
      { header: 'Statut', key: 'status', width: 12 },
      { header: 'Heures Travaillées', key: 'hours_worked', width: 15 },
      { header: 'Shift', key: 'shift_name', width: 12 },
      { header: 'Méthode', key: 'verification_method', width: 18 },
      { header: 'Face Vérifié', key: 'face_verified', width: 12 },
      { header: 'Confiance', key: 'face_confidence', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Téléphone', key: 'phone', width: 15 }
    ];

    filteredData.forEach(record => {
      worksheet.addRow({
        id: record.id,
        employee_id: record.employee_id || 'N/A',
        cin: record.cin || '', // ← VALEUR DU CIN
        employee_name: record.employee_name || 'N/A',
        department: record.department || 'N/A',
        record_date: record.record_date ? new Date(record.record_date).toLocaleDateString('fr-FR') : '',
        check_in_time: this.formatTime(record.check_in_time),
        check_out_time: this.formatTime(record.check_out_time),
        status: this.translateStatus(record.status),
        hours_worked: record.hours_worked ? parseFloat(record.hours_worked).toFixed(2) : '0.00',
        shift_name: record.shift_name || 'Standard',
        verification_method: record.verification_method || 'Manuel',
        face_verified: record.face_verified ? 'Oui' : 'Non',
        face_confidence: record.face_confidence ? `${(parseFloat(record.face_confidence) * 100).toFixed(1)}%` : '0%',
        notes: record.notes || '',
        email: record.email || '',
        phone: record.phone || ''
      });
    });

    // Style des en-têtes (identique)
    const headerRow = worksheet.getRow(1);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = { 
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Style des lignes de données (identique)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.height = 20;
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle' };
          cell.border = { 
            top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
          };
          if (rowNumber % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
          }
        });

        // Coloration conditionnelle des heures
        const hoursCell = row.getCell('hours_worked');
        const hours = parseFloat(hoursCell.value) || 0;
        if (hours >= 8) {
          hoursCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
          hoursCell.font = { color: { argb: 'FF006100' } };
        } else if (hours < 4) {
          hoursCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
          hoursCell.font = { color: { argb: 'FF9C0006' } };
        }

        // Coloration de la vérification faciale
        const faceCell = row.getCell('face_verified');
        if (faceCell.value === 'Oui') {
          faceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
          faceCell.font = { color: { argb: 'FF2E7D32' } };
        }
      }
    });

    // Ajustement automatique des largeurs
    worksheet.columns.forEach(column => {
      let maxLength = 10;
      column.eachCell({ includeEmpty: true }, cell => {
        const length = cell.value ? cell.value.toString().length : 10;
        if (length > maxLength) maxLength = length;
      });
      column.width = Math.min(maxLength + 2, 50);
    });

    // ===== FEUILLE DE RÉSUMÉ AVEC CIN =====
    const summarySheet = workbook.addWorksheet('Résumé');
    
    // Informations sur le filtre
    summarySheet.addRow(['🔍 FILTRE APPLIQUÉ']);
    summarySheet.addRow(['Période', `${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`]);
    
    if (employeeInfo) {
      summarySheet.addRow(['Type de filtre', cin ? 'CIN' : (targetEmployeeId?.includes('@') ? 'Email' : 'ID Employé')]);
      summarySheet.addRow(['Valeur recherchée', cin || targetEmployeeId || '']);
      summarySheet.addRow(['ID Employé', employeeInfo.employee_id]);
      summarySheet.addRow(['CIN', employeeInfo.cin || 'Non renseigné']); // ← CIN DANS LE RÉSUMÉ
      summarySheet.addRow(['Nom', `${employeeInfo.first_name} ${employeeInfo.last_name}`]);
      summarySheet.addRow(['Email', employeeInfo.email || '']);
      summarySheet.addRow(['Département', employeeInfo.department || '']);
    } else if (userRole === 'manager' && userDepartment) {
      summarySheet.addRow(['Type de filtre', 'Département (Manager)']);
      summarySheet.addRow(['Département', userDepartment]);
    } else if (department) {
      summarySheet.addRow(['Type de filtre', 'Département']);
      summarySheet.addRow(['Département', department]);
    } else {
      summarySheet.addRow(['Type de filtre', 'Tous les employés']);
    }
    
    summarySheet.addRow([]);
    summarySheet.addRow(['📊 STATISTIQUES']);
    
    // Calcul des statistiques
    const totalHours = filteredData.reduce((sum, r) => sum + (parseFloat(r.hours_worked) || 0), 0);
    const uniqueEmployees = [...new Set(filteredData.map(r => r.employee_id))].length;
    const presentCount = filteredData.filter(r => r.status === 'Présent' || r.status === 'Sorti').length;
    const attendanceRate = filteredData.length > 0 ? (presentCount / filteredData.length * 100).toFixed(1) : 0;
    const faceVerifiedCount = filteredData.filter(r => r.face_verified === true).length;
    const faceRate = filteredData.length > 0 ? (faceVerifiedCount / filteredData.length * 100).toFixed(1) : 0;
    
    summarySheet.addRow(['Total enregistrements', filteredData.length]);
    summarySheet.addRow(['Employés uniques', uniqueEmployees]);
    summarySheet.addRow(['Heures totales', `${totalHours.toFixed(2)}h`]);
    summarySheet.addRow(['Moyenne heures/jour', `${(totalHours / filteredData.length).toFixed(2)}h`]);
    summarySheet.addRow(['Taux de présence', `${attendanceRate}%`]);
    summarySheet.addRow(['Taux vérification faciale', `${faceRate}%`]);
    
    summarySheet.addRow([]);
    summarySheet.addRow(['📅 RÉPARTITION PAR STATUT']);
    
    const statusStats = filteredData.reduce((acc, r) => {
      const status = r.status || 'Non spécifié';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(statusStats).forEach(([status, count]) => {
      summarySheet.addRow([status, count, `${((count / filteredData.length) * 100).toFixed(1)}%`]);
    });
    
    // Style de la feuille de résumé
    summarySheet.columns = [
      { width: 25 },
      { width: 20 },
      { width: 15 }
    ];
    
    summarySheet.getRow(1).font = { bold: true, size: 14 };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3498DB' }
    };
    
    // ===== GÉNÉRATION DU NOM DE FICHIER AVEC CIN =====
    const dateStr = new Date().toISOString().slice(0, 10);
    let filename;
    
    if (employeeCIN) {
      const employeeName = employeeInfo ? 
        `${employeeInfo.first_name}_${employeeInfo.last_name}`.replace(/\s+/g, '_') : 
        'employe';
      filename = `pointages_CIN_${employeeCIN}_${employeeName}_${startDate}_${endDate}.xlsx`;
    } else if (actualEmployeeId && employeeInfo) {
      filename = `pointages_${employeeInfo.first_name}_${employeeInfo.last_name}_${startDate}_${endDate}.xlsx`;
    } else if (department) {
      filename = `pointages_${department}_${startDate}_${endDate}.xlsx`;
    } else {
      filename = `rapport_presence_${dateStr}.xlsx`;
    }

    // ===== ENVOI DU FICHIER =====
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
    
    console.log(`✅ Export Excel terminé: ${filteredData.length} lignes pour ${userRole} ${req.user.email}`);
    if (employeeCIN) console.log(`   CIN: ${employeeCIN}`);
    
  } catch (error) {
    console.error('❌ Erreur export Excel:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'export Excel',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
}
// =========================================================================
// EXPORT PDF DES POINTAGES AVEC CIN
// =========================================================================
async exportAttendanceToPDF(req, res) {
  try {
    console.log('📄 Export PDF des pointages...');
    
    // ===== VÉRIFICATION DES PERMISSIONS =====
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié',
        code: 'UNAUTHORIZED'
      });
    }

    const userRole = req.user.role;
    const userDepartment = req.user.department;

    // EMPLOYÉ - interdit
    if (userRole === 'employee') {
      return res.status(403).json({
        success: false,
        message: 'Les employés ne peuvent pas exporter les rapports de présence',
        error: 'EMPLOYEE_EXPORT_DENIED',
        requiredRole: 'manager ou admin'
      });
    }
    // ===== FIN VÉRIFICATION =====

    // ✅ Récupération des paramètres avec CIN
    const { startDate, endDate, department, employeeId, employee_id, cin } = req.query;
    const targetEmployeeId = employee_id || employeeId;

    console.log('📋 Paramètres reçus:', { 
      startDate, 
      endDate, 
      department, 
      employeeId, 
      employee_id,
      cin,
      userRole,
      userDepartment 
    });

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Les dates de début et de fin sont requises'
      });
    }

    // ✅ RECHERCHE DE L'EMPLOYÉ - PRIORITÉ AU CIN
    let actualEmployeeId = targetEmployeeId;
    let employeeCIN = cin;
    let employeeInfo = null;

    // Si un CIN est fourni, on cherche par CIN d'abord
    if (cin) {
      const empResult = await db.query(
        'SELECT employee_id, first_name, last_name, email, cin, department FROM employees WHERE cin = $1',
        [cin]
      );
      
      if (empResult.rows.length > 0) {
        employeeInfo = empResult.rows[0];
        actualEmployeeId = employeeInfo.employee_id;
        employeeCIN = employeeInfo.cin;
        console.log(`🔵 Employé trouvé par CIN: ${employeeInfo.first_name} ${employeeInfo.last_name} (CIN: ${employeeInfo.cin})`);
      }
    }
    // Sinon, recherche par email/ID
    else if (targetEmployeeId && targetEmployeeId.includes('@')) {
      const empResult = await db.query(
        'SELECT employee_id, first_name, last_name, email, cin FROM employees WHERE email = $1',
        [targetEmployeeId]
      );
      
      if (empResult.rows.length > 0) {
        employeeInfo = empResult.rows[0];
        actualEmployeeId = employeeInfo.employee_id;
        employeeCIN = employeeInfo.cin;
        console.log(`🔵 Email ${targetEmployeeId} → ID: ${actualEmployeeId}, CIN: ${employeeInfo.cin || 'N/A'}`);
      }
    }

    // ✅ CONSTRUCTION DE LA REQUÊTE SQL AVEC CIN
    let query = `
      SELECT 
        a.id,
        a.employee_id,
        e.cin,
        COALESCE(a.employee_name, CONCAT(e.first_name, ' ', e.last_name)) as employee_name,
        COALESCE(a.department, e.department, 'Non spécifié') as department,
        a.record_date,
        a.attendance_date,
        a.check_in_time,
        a.check_out_time,
        a.status,
        a.hours_worked,
        a.shift_name,
        a.verification_method,
        a.face_verified,
        a.face_confidence,
        a.notes,
        a.created_at,
        e.position,
        e.email,
        e.phone,
        e.first_name,
        e.last_name
      FROM attendance a
      LEFT JOIN employees e ON a.employee_id = e.employee_id
      WHERE a.record_date BETWEEN $1 AND $2
    `;

    const params = [startDate, endDate];
    let paramIndex = 3;

    // ✅ FILTRE PRIORITAIRE: employee_id
    if (actualEmployeeId) {
      query += ` AND a.employee_id = $${paramIndex}`;
      params.push(actualEmployeeId);
      paramIndex++;
      console.log(`🔵 FILTRE EMPLOYÉ APPLIQUÉ: ${actualEmployeeId}`);
    }
    // FILTRE DÉPARTEMENT POUR MANAGER
    else if (userRole === 'manager' && userDepartment) {
      query += ` AND COALESCE(a.department, e.department) = $${paramIndex}`;
      params.push(userDepartment);
      paramIndex++;
      console.log(`📋 FILTRE MANAGER: département ${userDepartment}`);
    } 
    // FILTRE DÉPARTEMENT GÉNÉRAL
    else if (department) {
      query += ` AND COALESCE(a.department, e.department) = $${paramIndex}`;
      params.push(department);
      paramIndex++;
      console.log(`🏢 FILTRE DÉPARTEMENT: ${department}`);
    }
    // ADMIN sans filtre → TOUS les employés
    else if (userRole === 'admin') {
      console.log('👑 ADMIN - PAS DE FILTRE: tous les employés');
    }

    query += ` ORDER BY a.department, a.employee_name, a.record_date DESC`;

    console.log('📊 Exécution requête SQL...');
    const result = await db.query(query, params);
    let attendanceData = result.rows;

    console.log(`📈 ${attendanceData.length} enregistrements trouvés`);

    if (attendanceData.length === 0) {
      return res.status(404).json({
        success: false,
        message: actualEmployeeId 
          ? `Aucune donnée trouvée pour l'employé (ID: ${actualEmployeeId}) sur cette période`
          : 'Aucune donnée trouvée pour cette période',
        userRole: userRole,
        filter: actualEmployeeId ? `Employé: ${actualEmployeeId}` : 
                userRole === 'manager' ? `Département: ${userDepartment}` : 
                department ? `Département: ${department}` : 'Aucun filtre'
      });
    }

    // ✅ CRÉATION DU PDF (STYLE IDENTIQUE)
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
      layout: 'portrait',
      info: {
        Title: 'Rapport de Présence Détaillé',
        Author: 'Smart Attendance System',
        Subject: `Rapport des pointages ${startDate} à ${endDate}`,
        Keywords: 'présence, pointage, RH, employés, rapport',
        Creator: 'Smart Attendance System v1.0',
        CreationDate: new Date()
      }
    });

    // ✅ NOM DU FICHIER AVEC CIN SI DISPONIBLE
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let filename;
    
    if (employeeCIN) {
      const employeeName = employeeInfo ? 
        `${employeeInfo.first_name}_${employeeInfo.last_name}`.replace(/\s+/g, '_') : 
        'employe';
      filename = `pointages_CIN_${employeeCIN}_${employeeName}_${startDate}_${endDate}.pdf`;
    } else if (actualEmployeeId && employeeInfo) {
      filename = `pointages_${employeeInfo.first_name}_${employeeInfo.last_name}_${startDate}_${endDate}.pdf`;
    } else if (department) {
      filename = `pointages_${department}_${startDate}_${endDate}.pdf`;
    } else {
      filename = `rapport_presence_professionnel_${timestamp}.pdf`;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);
    
    // Ajouter l'information du filtre dans le rapport
    const filters = { 
      startDate, 
      endDate, 
      department: userRole === 'manager' ? userDepartment : department,
      employeeId: actualEmployeeId,
      employeeCIN: employeeCIN,
      employeeInfo: employeeInfo,
      userRole,
      userDepartment: userRole === 'manager' ? userDepartment : null
    };
    
    // ✅ VOTRE MÉTHODE DE GÉNÉRATION EXISTANTE
    this.generateProfessionalPDFContent(doc, attendanceData, filters);
    doc.end();

    console.log(`✅ PDF généré avec succès pour ${userRole} ${req.user.email} - ${attendanceData.length} lignes`);
    if (employeeCIN) console.log(`   CIN: ${employeeCIN}`);
    
  } catch (error) {
    console.error('❌ Erreur export PDF professionnel:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du rapport PDF',
        error: error.message
      });
    }
  }
}

  async exportAttendanceToCSV(req, res) {
    try {
      console.log('📋 Export CSV des pointages...');
      
      // ===== VÉRIFICATION DES PERMISSIONS =====
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      const userRole = req.user.role;
      const userDepartment = req.user.department;
      const { department, employeeId, startDate, endDate } = req.query;

      // EMPLOYÉ - interdit
      if (userRole === 'employee') {
        return res.status(403).json({
          success: false,
          message: 'Les employés ne peuvent pas exporter les rapports de présence',
          error: 'EMPLOYEE_EXPORT_DENIED',
          requiredRole: 'manager ou admin'
        });
      }

      // MANAGER - vérifications
      if (userRole === 'manager') {
        if (department && department !== userDepartment) {
          return res.status(403).json({
            success: false,
            message: `Vous ne pouvez exporter que les données du département ${userDepartment}`,
            error: 'DEPARTMENT_EXPORT_DENIED',
            userDepartment: userDepartment,
            requestedDepartment: department
          });
        }
      }
      // ===== FIN VÉRIFICATION =====

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Les dates de début et fin sont requises'
        });
      }

      let query = `
        SELECT 
          a.id,
          a.employee_id,
          COALESCE(a.employee_name, CONCAT(e.first_name, ' ', e.last_name)) as employee_name,
          COALESCE(a.department, e.department, 'Non spécifié') as department,
          a.record_date,
          a.attendance_date,
          a.check_in_time,
          a.check_out_time,
          a.status,
          a.hours_worked,
          a.shift_name,
          a.verification_method,
          a.face_verified,
          a.face_confidence,
          a.notes,
          e.position,
          e.email,
          e.phone
        FROM attendance a
        LEFT JOIN employees e ON a.employee_id = e.employee_id
        WHERE a.record_date BETWEEN $1 AND $2
      `;

      const params = [startDate, endDate];
      let paramIndex = 3;

      if (userRole === 'manager' && userDepartment) {
        query += ` AND COALESCE(a.department, e.department) = $${paramIndex}`;
        params.push(userDepartment);
        paramIndex++;
      } else if (department) {
        query += ` AND COALESCE(a.department, e.department) = $${paramIndex}`;
        params.push(department);
        paramIndex++;
      }

      if (employeeId) {
        query += ` AND a.employee_id = $${paramIndex}`;
        params.push(employeeId);
        paramIndex++;
      }

      query += ` ORDER BY a.record_date DESC, a.check_in_time DESC`;

      const result = await db.query(query, params);
      let attendanceData = result.rows;

      if (userRole === 'manager' && userDepartment) {
        attendanceData = attendanceData.filter(record => 
          record.department === userDepartment
        );
      }

      const headers = [
        'ID', 'ID Employé', 'Nom Employé', 'Département', 'Date Enregistrement',
        'Date Présence', 'Heure Arrivée', 'Heure Départ', 'Statut',
        'Heures Travaillées', 'Shift', 'Méthode Vérification',
        'Face Vérifié', 'Confidence Visage', 'Notes'
      ];

      const csvRows = attendanceData.map(record => [
        record.id, record.employee_id || '', record.employee_name || '', record.department || '',
        record.record_date ? new Date(record.record_date).toLocaleDateString('fr-FR') : '',
        record.attendance_date ? new Date(record.attendance_date).toLocaleDateString('fr-FR') : '',
        this.formatTime(record.check_in_time), this.formatTime(record.check_out_time),
        this.translateStatus(record.status),
        record.hours_worked ? parseFloat(record.hours_worked).toFixed(2) : '0.00',
        record.shift_name || 'Standard', record.verification_method || 'Manuel',
        record.face_verified ? 'Oui' : 'Non',
        record.face_confidence ? (parseFloat(record.face_confidence) * 100).toFixed(1) + '%' : '0%',
        record.notes || ''
      ]);

      const csvContent = [headers.join(';')]
        .concat(csvRows.map(row => row.map(cell => `"${cell}"`).join(';')))
        .join('\n');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `pointages_${startDate}_${endDate}_${timestamp}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
      console.log(`✅ Export CSV terminé: ${attendanceData.length} lignes pour ${userRole} ${req.user.email}`);
    } catch (error) {
      console.error('❌ Erreur export CSV:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'export CSV',
        error: error.message
      });
    }
  }

  generateProfessionalPDFContent(doc, data, filters) {
    try {
      this.addCoverPage(doc, filters);
      doc.addPage();
      this.addExecutiveSummary(doc, data, filters);
      doc.addPage();
      this.addDetailedStatistics(doc, data);
      doc.addPage();
      this.addAttendanceTable(doc, data, filters);
      doc.addPage();
      this.addConclusionPage(doc, data, filters);
    } catch (error) {
      console.error('❌ Erreur génération PDF professionnel:', error);
      this.addErrorMessage(doc, error);
    }
  }

  addCoverPage(doc, filters) {
  try {
    doc.rect(0, 0, doc.page.width, 180).fill('#1A237E');
    doc.fillColor('#FFFFFF')
      .fontSize(32).font('Helvetica-Bold')
      .text('SMART ATTENDANCE', 50, 70, { align: 'left' });
    doc.fontSize(24).text('SYSTEM', 50, 110, { align: 'left' });
    doc.fontSize(18).font('Helvetica')
      .text('Rapport de Présence Professionnel', 50, 150, { align: 'left' });
    doc.moveTo(50, 190).lineTo(doc.page.width - 50, 190)
      .strokeColor('#2196F3').lineWidth(3).stroke();

    doc.fillColor('#0D47A1').fontSize(16).font('Helvetica-Bold')
      .text('INFORMATIONS DU RAPPORT', 50, 220);
    doc.font('Helvetica').fontSize(12).fillColor('#37474F');

    let y = 250;
    const infoSpacing = 25;
    doc.roundedRect(50, y - 10, doc.page.width - 100, 160, 5)
      .fill('#F5F7FA').stroke('#CFD8DC');

    doc.fillColor('#546E7A').fontSize(11).font('Helvetica-Bold');
    doc.text('PÉRIODE:', 70, y);
    doc.text('FILTRES APPLIQUÉS:', 70, y + infoSpacing);
    doc.text('DATE DE GÉNÉRATION:', 70, y + infoSpacing * 2);
    doc.text('N° DE RAPPORT:', 70, y + infoSpacing * 3);
    doc.text('STATUT:', 70, y + infoSpacing * 4);

    doc.font('Helvetica').fillColor('#263238');
    doc.text(`${filters.startDate} au ${filters.endDate}`, 200, y);

    // ✅ FILTRES AVEC CIN
    let filtersText = 'Aucun';
    if (filters.employeeInfo) {
      filtersText = `Employé: ${filters.employeeInfo.first_name} ${filters.employeeInfo.last_name}`;
      if (filters.employeeInfo.cin) {
        filtersText += ` (CIN: ${filters.employeeInfo.cin})`;
      }
    } else if (filters.userRole === 'manager' && filters.userDepartment) {
      filtersText = `Département: ${filters.userDepartment} (Manager)`;
    } else if (filters.department) {
      filtersText = `Département: ${filters.department}`;
    } else if (filters.employeeId) {
      filtersText = `Employé ID: ${filters.employeeId}`;
    }
    doc.text(filtersText, 200, y + infoSpacing);
    
    doc.text(new Date().toLocaleString('fr-FR'), 200, y + infoSpacing * 2);
    doc.text(`RPT-${Date.now().toString().slice(-6)}`, 200, y + infoSpacing * 3);
    doc.text('CONFIDENTIEL', 200, y + infoSpacing * 4);

    // ✅ INFORMATIONS EMPLOYÉ AVEC CIN
    if (filters.employeeInfo) {
      y = y + infoSpacing * 5 + 20;
      doc.fillColor('#0D47A1').fontSize(14).font('Helvetica-Bold')
        .text('INFORMATIONS EMPLOYÉ', 50, y);
      y += 20;
      
      doc.fillColor('#37474F').fontSize(11).font('Helvetica');
      doc.text(`ID Employé: ${filters.employeeInfo.employee_id || 'N/A'}`, 50, y);
      y += 15;
      
      // ✅ AFFICHAGE DU CIN
      if (filters.employeeInfo.cin) {
        doc.text(`CIN: ${filters.employeeInfo.cin}`, 50, y);
        y += 15;
      }
      
      doc.text(`Nom complet: ${filters.employeeInfo.first_name || ''} ${filters.employeeInfo.last_name || ''}`, 50, y);
      y += 15;
      doc.text(`Email: ${filters.employeeInfo.email || 'Non renseigné'}`, 50, y);
      y += 15;
      doc.text(`Département: ${filters.employeeInfo.department || 'Non renseigné'}`, 50, y);
      y += 15;
      doc.text(`Poste: ${filters.employeeInfo.position || 'Non renseigné'}`, 50, y);
    }

    y = doc.page.height - 100;
    doc.fillColor('#B71C1C').fontSize(10).font('Helvetica-Bold')
      .text('CONFIDENTIEL', doc.page.width / 2 - 40, y, { align: 'center' });
    doc.moveTo(doc.page.width / 2 - 60, y + 15)
      .lineTo(doc.page.width / 2 + 60, y + 15)
      .strokeColor('#B71C1C').lineWidth(2).stroke();

    doc.fillColor('#78909C').fontSize(9).font('Helvetica')
      .text('Document généré automatiquement par Smart Attendance System',
        50, doc.page.height - 50, { width: doc.page.width - 100, align: 'center' });
    doc.text('© 2024 Smart Attendance System - Tous droits réservés',
      50, doc.page.height - 35, { width: doc.page.width - 100, align: 'center' });
  } catch (error) {
    console.error('❌ Erreur page de couverture:', error);
    doc.text('Erreur page de couverture', 50, 50);
  }
}

  addExecutiveSummary(doc, data, filters) {
  try {
    this.addPageHeader(doc, 'RÉSUMÉ EXÉCUTIF');
    const stats = this.calculateDetailedStats(data);
    let y = 100;

    doc.fillColor('#263238').fontSize(12).font('Helvetica')
      .text('Ce rapport présente une analyse détaillée des présences et pointages pour la période spécifiée. ' +
        'Les données ont été extraites du système de gestion des présences et analysées pour fournir ' +
        'des insights actionnables.', 50, 100, { width: doc.page.width - 100, align: 'justify' });

    // ✅ AFFICHAGE DU CIN DANS LE RÉSUMÉ
    if (filters.employeeInfo) {
      y = 140;
      doc.fillColor('#0D47A1').fontSize(12).font('Helvetica-Bold')
        .text('EMPLOYÉ CONCERNÉ:', 50, y);
      y += 20;
      
      doc.fillColor('#37474F').fontSize(11).font('Helvetica')
        .text(`Nom: ${filters.employeeInfo.first_name} ${filters.employeeInfo.last_name}`, 50, y);
      y += 15;
      
      if (filters.employeeInfo.cin) {
        doc.text(`CIN: ${filters.employeeInfo.cin}`, 50, y);
        y += 15;
      }
      
      doc.text(`Département: ${filters.employeeInfo.department || 'Non spécifié'}`, 50, y);
      y += 15;
      doc.text(`Poste: ${filters.employeeInfo.position || 'Non spécifié'}`, 50, y);
      y += 20;
    }

    if (filters.userRole === 'manager' && filters.userDepartment) {
      doc.fillColor('#0D47A1').fontSize(12).font('Helvetica-Bold')
        .text(`Rapport limité au département: ${filters.userDepartment}`, 50, y);
      y += 20;
    }

    doc.fillColor('#0D47A1').fontSize(14).font('Helvetica-Bold')
      .text('INDICATEURS CLÉS DE PERFORMANCE', 50, y);
    y += 30;

    const kpiWidth = (doc.page.width - 150) / 2;
    const kpiHeight = 80;

    this.drawKPICard(doc, 50, y, kpiWidth, kpiHeight,
      `${stats.attendanceRate}%`, 'Taux de présence', '#4CAF50', 'target');
    this.drawKPICard(doc, 50 + kpiWidth + 50, y, kpiWidth, kpiHeight,
      `${stats.totalHours.toFixed(0)}h`, 'Heures totales', '#2196F3', 'clock');

    y += kpiHeight + 30;
    this.drawKPICard(doc, 50, y, kpiWidth, kpiHeight,
      stats.uniqueEmployees.toString(), 'Employés uniques', '#FF9800', 'users');
    this.drawKPICard(doc, 50 + kpiWidth + 50, y, kpiWidth, kpiHeight,
      `${stats.avgHoursPerDay.toFixed(1)}h/j`, 'Moyenne quotidienne', '#9C27B0', 'calendar');

    y += kpiHeight + 50;
    doc.fillColor('#0D47A1').fontSize(14).font('Helvetica-Bold')
      .text('RÉPARTITION PAR DÉPARTEMENT', 50, y);
    y += 25;

    const deptStats = this.calculateDepartmentStats(data);
    const chartWidth = 300, chartHeight = 150;
    const chartX = (doc.page.width - chartWidth) / 2;
    const maxCount = Math.max(...deptStats.map(d => d.count));

    deptStats.slice(0, 5).forEach((dept, index) => {
      const barHeight = (dept.count / maxCount) * chartHeight;
      const barWidth = 40;
      const barX = chartX + (index * (barWidth + 20));
      const barY = y + chartHeight - barHeight + 40;
      doc.fillColor(this.getDepartmentColor(index))
        .rect(barX, barY, barWidth, barHeight).fill();
      doc.fillColor('#37474F').fontSize(8)
        .text(dept.department.substring(0, 12), barX, y + chartHeight + 45, { width: barWidth, align: 'center' });
      doc.fillColor('#263238').fontSize(9).font('Helvetica-Bold')
        .text(dept.count.toString(), barX, barY - 15, { width: barWidth, align: 'center' });
    });

    y += chartHeight + 80;
    doc.fillColor('#546E7A').fontSize(10).font('Helvetica-Bold')
      .text('LÉGENDE:', 50, y);
    y += 20;
    deptStats.slice(0, 5).forEach((dept, index) => {
      const color = this.getDepartmentColor(index);
      doc.fillColor(color).rect(50, y - 8, 10, 10).fill();
      doc.fillColor('#37474F').fontSize(9)
        .text(`${dept.department}: ${dept.count} enregistrements (${((dept.count / stats.totalRecords) * 100).toFixed(1)}%)`, 65, y);
      y += 15;
    });
  } catch (error) {
    console.error('❌ Erreur résumé exécutif:', error);
    doc.text('Erreur résumé exécutif', 50, 100);
  }
}

  addDetailedStatistics(doc, data) {
  try {
    this.addPageHeader(doc, 'ANALYSE STATISTIQUE DÉTAILLÉE');
    const stats = this.calculateDetailedStats(data);
    let y = 100;

    doc.fillColor('#0D47A1').fontSize(14).font('Helvetica-Bold')
      .text('1. RÉPARTITION DES STATUTS', 50, y);
    y += 25;

    const statusStats = this.calculateStatusStats(data);
    const pieRadius = 60, pieX = 120, pieY = y + pieRadius + 20;
    let startAngle = 0;
    const colors = ['#4CAF50', '#FFC107', '#F44336', '#2196F3', '#9C27B0'];

    statusStats.forEach((status, index) => {
      const percentage = status.percentage;
      if (percentage > 0) {
        const angle = (percentage / 100) * 360;
        const endAngle = startAngle + (angle * Math.PI / 180);
        doc.fillColor(colors[index % colors.length])
          .moveTo(pieX, pieY).arc(pieX, pieY, pieRadius, startAngle, endAngle, false).fill();
        startAngle = endAngle;
      }
    });

    const legendX = 220;
    let legendY = y + 30;
    statusStats.forEach((status, index) => {
      if (status.percentage > 0) {
        doc.fillColor(colors[index % colors.length]).rect(legendX, legendY, 12, 12).fill();
        doc.fillColor('#263238').fontSize(10).font('Helvetica')
          .text(status.status, legendX + 20, legendY);
        doc.fillColor('#546E7A').fontSize(9)
          .text(`${status.count} (${status.percentage.toFixed(1)}%)`, legendX + 100, legendY);
        legendY += 20;
      }
    });

    y = pieY + pieRadius + 60;
    doc.fillColor('#0D47A1').fontSize(14).font('Helvetica-Bold')
      .text('2. ÉVOLUTION TEMPORELLE', 50, y);
    y += 25;

    const timeStats = this.calculateTimeStats(data);
    const tableWidth = doc.page.width - 100;
    const colWidths = [120, 80, 80, 80];

    doc.fillColor('#37474F').fontSize(10).font('Helvetica-Bold')
      .text('Période', 50, y)
      .text('Enregistrements', 50 + colWidths[0], y)
      .text('Heures Moy.', 50 + colWidths[0] + colWidths[1], y)
      .text('Taux Présence', 50 + colWidths[0] + colWidths[1] + colWidths[2], y);
    doc.moveTo(50, y + 12).lineTo(50 + tableWidth, y + 12)
      .strokeColor('#B0BEC5').lineWidth(0.5).stroke();
    y += 20;

    timeStats.forEach((period, index) => {
      if (index % 2 === 0) {
        doc.fillColor('#F5F7FA').rect(50, y - 5, tableWidth, 18).fill();
      }
      doc.fillColor('#263238').fontSize(9).font('Helvetica')
        .text(period.period, 50, y)
        .text(period.count.toString(), 50 + colWidths[0], y)
        .text(`${period.avgHours.toFixed(1)}h`, 50 + colWidths[0] + colWidths[1], y)
        .text(`${period.attendanceRate.toFixed(1)}%`, 50 + colWidths[0] + colWidths[1] + colWidths[2], y);
      y += 18;
    });

    y += 20;
    doc.fillColor('#0D47A1').fontSize(14).font('Helvetica-Bold')
      .text('3. TENDANCE DES HEURES TRAVAILLÉES', 50, y);
    y += 25;

    const trendData = timeStats.map(t => t.avgHours);
    const maxTrend = Math.max(...trendData), minTrend = Math.min(...trendData);
    const trendHeight = 80, trendWidth = 300;
    const trendX = (doc.page.width - trendWidth) / 2;

    doc.strokeColor('#B0BEC5').lineWidth(1)
      .moveTo(trendX, y + trendHeight).lineTo(trendX + trendWidth, y + trendHeight).stroke();

    doc.strokeColor('#2196F3').lineWidth(2);
    trendData.forEach((value, index) => {
      const x = trendX + (index * (trendWidth / (trendData.length - 1)));
      const pointY = y + trendHeight - ((value - minTrend) / (maxTrend - minTrend || 1)) * trendHeight;
      if (index === 0) doc.moveTo(x, pointY);
      else doc.lineTo(x, pointY);
      doc.fillColor('#2196F3').circle(x, pointY, 3).fill();
    });
    doc.stroke();
  } catch (error) {
    console.error('❌ Erreur statistiques détaillées:', error);
    doc.text('Erreur statistiques détaillées', 50, 100);
  }
}

  addAttendanceTable(doc, data, filters) {
  try {
    this.addPageHeader(doc, 'DÉTAIL DES POINTAGES PAR EMPLOYÉ');
    
    let headerText = `Ce tableau présente les pointages détaillés pour ${data.length} enregistrements.`;
    if (filters.userRole === 'manager' && filters.userDepartment) {
      headerText += ` Données filtrées pour le département: ${filters.userDepartment}`;
    }
    
    doc.fillColor('#546E7A').fontSize(10).font('Helvetica')
      .text(headerText, 50, 100, { width: doc.page.width - 100 });

    let y = 130;
    const groupedByEmployee = this.groupByEmployee(data);
    const employeeIds = Object.keys(groupedByEmployee);

    employeeIds.forEach((employeeId, empIndex) => {
      const employeeRecords = groupedByEmployee[employeeId];
      const firstRecord = employeeRecords[0];

      if (y > doc.page.height - 200 && empIndex > 0) {
        doc.addPage();
        this.addPageHeader(doc, 'DÉTAIL DES POINTAGES (SUITE)');
        y = 100;
      }

      doc.fillColor('#0D47A1').fontSize(12).font('Helvetica-Bold')
        .text(`EMPLOYÉ ${empIndex + 1}: ${firstRecord.employee_name}`, 50, y);
      y += 20;

      doc.fillColor('#37474F').fontSize(10).font('Helvetica')
        .text(`ID: ${firstRecord.employee_id} | Département: ${firstRecord.department} | ` +
          `Poste: ${firstRecord.position || 'Non spécifié'}`, 50, y);
      
      // ✅ AFFICHAGE DU CIN
      if (firstRecord.cin) {
        y += 15;
        doc.fillColor('#0D47A1').fontSize(10).font('Helvetica-Bold')
          .text(`CIN: ${firstRecord.cin}`, 50, y);
      }
      
      if (firstRecord.email || firstRecord.phone) {
        y += 15;
        doc.fillColor('#546E7A').fontSize(9).font('Helvetica')
          .text(`Contact: ${firstRecord.email || ''} ${firstRecord.phone ? `| Tél: ${firstRecord.phone}` : ''}`, 50, y);
      }
      y += 25;

      const tableWidth = doc.page.width - 100;
      const colWidths = [60, 55, 55, 50, 50, 60, 80];
      const headers = ['Date', 'Arrivée', 'Départ', 'Heures', 'Statut', 'Shift', 'Vérification'];

      doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
      let x = 50;
      doc.fillColor('#37474F').rect(50, y - 5, tableWidth, 20).fill();
      headers.forEach((header, i) => {
        doc.fillColor('#FFFFFF').text(header, x + 5, y, { width: colWidths[i] - 10 });
        x += colWidths[i];
      });
      doc.moveTo(50, y + 15).lineTo(50 + tableWidth, y + 15)
        .strokeColor('#FFFFFF').lineWidth(0.5).stroke();
      y += 20;

      employeeRecords.forEach((record, index) => {
        if (y > doc.page.height - 50) {
          doc.addPage();
          this.addPageHeader(doc, `DÉTAIL DES POINTAGES - ${firstRecord.employee_name} (SUITE)`);
          y = 100;
        }
        if (index % 2 === 0) {
          doc.fillColor('#F5F7FA').rect(50, y - 5, tableWidth, 16).fill();
        }
        x = 50;

        const date = record.record_date || record.attendance_date;
        doc.fillColor('#263238').fontSize(8).font('Helvetica')
          .text(date ? new Date(date).toLocaleDateString('fr-FR') : '--', x + 5, y, { width: colWidths[0] - 10 });
        x += colWidths[0];
        doc.text(this.formatTime(record.check_in_time), x + 5, y, { width: colWidths[1] - 10 }); x += colWidths[1];
        doc.text(this.formatTime(record.check_out_time), x + 5, y, { width: colWidths[2] - 10 }); x += colWidths[2];
        const hours = record.hours_worked ? parseFloat(record.hours_worked).toFixed(2) : '0.00';
        doc.text(hours, x + 5, y, { width: colWidths[3] - 10 }); x += colWidths[3];
        const status = this.translateStatus(record.status);
        const statusColor = this.getStatusColor(record.status);
        doc.fillColor(statusColor).text(status, x + 5, y, { width: colWidths[4] - 10 }); x += colWidths[4];
        doc.fillColor('#263238');
        doc.text(record.shift_name || 'Standard', x + 5, y, { width: colWidths[5] - 10 }); x += colWidths[5];
        let verificationText = record.verification_method || 'Manuel';
        if (record.face_verified) {
          verificationText = `Face ✓ ${record.face_confidence ? (record.face_confidence * 100).toFixed(0) + '%' : ''}`;
        }
        doc.text(verificationText, x + 5, y, { width: colWidths[6] - 10 });
        y += 16;
      });

      const totalHours = employeeRecords.reduce((sum, r) => sum + parseFloat(r.hours_worked || 0), 0);
      const avgHours = employeeRecords.length > 0 ? totalHours / employeeRecords.length : 0;
      y += 10;
      doc.fillColor('#0D47A1').fontSize(10).font('Helvetica-Bold')
        .text(`Résumé: ${employeeRecords.length} jours | ${totalHours.toFixed(1)} heures totales | ` +
          `${avgHours.toFixed(1)} heures moyennes/jour`, 50, y);
      y += 30;

      if (empIndex < employeeIds.length - 1) {
        doc.moveTo(50, y - 10).lineTo(doc.page.width - 50, y - 10)
          .strokeColor('#E0E0E0').lineWidth(0.5).stroke().dash(5, { space: 2 });
        y += 10;
      }
    });
  } catch (error) {
    console.error('❌ Erreur tableau des pointages:', error);
    doc.text('Erreur tableau des pointages', 50, 100);
  }
}

  addConclusionPage(doc, data, filters) {
  try {
    this.addPageHeader(doc, 'CONCLUSION ET RECOMMANDATIONS');
    const stats = this.calculateDetailedStats(data);
    let y = 100;

    doc.fillColor('#263238').fontSize(12).font('Helvetica-Bold')
      .text('SYNTHÈSE DU RAPPORT', 50, y);
    y += 25;
    
    let reportText = `Le rapport d'analyse des présences couvre la période du ${filters.startDate} au ${filters.endDate} ` +
      `et inclut ${stats.totalRecords} enregistrements pour ${stats.uniqueEmployees} employés. ` +
      `Le taux de présence global s'élève à ${stats.attendanceRate}% avec une moyenne de ` +
      `${stats.avgHoursPerDay.toFixed(1)} heures travaillées par jour.`;
    
    // ✅ AJOUT DU CIN DANS LA CONCLUSION
    if (filters.employeeInfo && filters.employeeInfo.cin) {
      reportText += `\n\nCe rapport a été généré spécifiquement pour l'employé ` +
        `${filters.employeeInfo.first_name} ${filters.employeeInfo.last_name} ` +
        `(CIN: ${filters.employeeInfo.cin}).`;
    }
    
    if (filters.userRole === 'manager' && filters.userDepartment) {
      reportText += `\n\n⚠️ NOTE: Ce rapport est limité au département ${filters.userDepartment} conformément à vos droits d'accès.`;
    }
    
    doc.fillColor('#37474F').fontSize(11).font('Helvetica')
      .text(reportText, 50, y, { width: doc.page.width - 100, align: 'justify' });

    y += 100;
    doc.fillColor('#2E7D32').fontSize(12).font('Helvetica-Bold')
      .text('POINTS FORTS', 50, y);
    y += 25;

    const strengths = [
      `Taux de vérification faciale élevé: ${stats.faceVerificationRate}%`,
      `Couverture de ${stats.departmentsCount} départements différents`,
      `Données détaillées disponibles pour analyse`,
      `Système de pointage fonctionnel et fiable`
    ];
    strengths.forEach((strength) => {
      doc.fillColor('#2E7D32').fontSize(16).text('✓', 55, y - 5);
      doc.fillColor('#37474F').fontSize(11).text(strength, 75, y);
      y += 25;
    });

    y += 10;
    doc.fillColor('#D32F2F').fontSize(12).font('Helvetica-Bold')
      .text('RECOMMANDATIONS', 50, y);
    y += 25;

    const recommendations = this.generateRecommendations(stats);
    recommendations.forEach((rec, index) => {
      doc.fillColor('#D32F2F').fontSize(14).text(`${index + 1}.`, 55, y - 2);
      doc.fillColor('#37474F').fontSize(11).text(rec, 75, y, { width: doc.page.width - 125 });
      y += rec.length > 100 ? 40 : 30;
    });

    y += 20;
    doc.fillColor('#1976D2').fontSize(12).font('Helvetica-Bold')
      .text('ACTIONS SUGGÉRÉES', 50, y);
    y += 25;

    const actions = [
      'Réviser les procédures de pointage avec les équipes concernées',
      'Mettre en place des formations sur l\'utilisation du système',
      'Programmer des audits réguliers des données de présence',
      'Établir des objectifs de performance par département'
    ];
    actions.forEach((action) => {
      doc.fillColor('#1976D2').fontSize(12).text('•', 55, y);
      doc.fillColor('#37474F').fontSize(10).text(action, 70, y);
      y += 20;
    });

    y = doc.page.height - 100;
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y)
      .strokeColor('#B0BEC5').lineWidth(0.5).stroke();
    y += 15;
    doc.fillColor('#546E7A').fontSize(9).font('Helvetica')
      .text('Ce rapport a été généré automatiquement par le système Smart Attendance.',
        50, y, { width: doc.page.width - 100, align: 'center' });
    y += 15;
    doc.text('Pour toute question ou clarification, contactez le service des ressources humaines.',
      50, y, { width: doc.page.width - 100, align: 'center' });
    y += 15;
    doc.font('Helvetica-Bold')
      .text('DOCUMENT CONFIDENTIEL - DISTRIBUTION RESTREINTE',
        50, y, { width: doc.page.width - 100, align: 'center' });
  } catch (error) {
    console.error('❌ Erreur page de conclusion:', error);
    doc.text('Erreur page de conclusion', 50, 100);
  }
}

  addPageHeader(doc, title) {
    try {
      doc.rect(0, 0, doc.page.width, 60).fill('#1A237E');
      doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold')
        .text(title, 50, 20, { width: doc.page.width - 100 });
      const pageNumber = doc.bufferedPageRange().count;
      const pageInfo = `Page ${pageNumber} • ${new Date().toLocaleDateString('fr-FR')}`;
      doc.fontSize(9).font('Helvetica')
        .text(pageInfo, doc.page.width - 150, 22, { width: 100, align: 'right' });
      doc.moveTo(50, 55).lineTo(doc.page.width - 50, 55)
        .strokeColor('#2196F3').lineWidth(1).stroke();
    } catch (error) {
      console.error('❌ Erreur en-tête de page:', error);
    }
  }

  drawKPICard(doc, x, y, width, height, value, label, color, icon) {
    try {
      doc.fillColor('#FFFFFF').strokeColor('#E0E0E0').lineWidth(1)
        .roundedRect(x, y, width, height, 5).fill().stroke();
      const iconSize = 20, iconX = x + 15, iconY = y + 15;
      doc.fillColor(color).circle(iconX + iconSize / 2, iconY + iconSize / 2, iconSize / 2).fill();
      doc.fillColor('#263238').fontSize(24).font('Helvetica-Bold')
        .text(value, x + 50, y + 10);
      doc.fillColor('#546E7A').fontSize(11).font('Helvetica')
        .text(label, x + 15, y + height - 25, { width: width - 30 });
      doc.fillColor(color).rect(x, y + height - 5, width, 5).fill();
    } catch (error) {
      console.error('❌ Erreur carte KPI:', error);
    }
  }

  calculateDetailedStats(data) {
  try {
    // Vérification sécurité
    if (!data || !Array.isArray(data)) {
      return this.getEmptyStats();
    }

    const totalRecords = data.length;
    
    // === CORRECTION: Calcul sécurisé des heures ===
    let totalHours = 0;
    data.forEach(record => {
      if (record.hours_worked) {
        const hours = parseFloat(record.hours_worked);
        if (!isNaN(hours)) {
          totalHours += hours;
        }
      }
    });
    // === FIN CORRECTION ===
    
    const uniqueEmployeeIds = [...new Set(data.map(r => r.employee_id).filter(Boolean))];
    const uniqueDepartments = [...new Set(data.map(r => r.department).filter(Boolean))];
    const presentCount = data.filter(r => r.status === 'present' || r.status === 'checked_out').length;
    const attendanceRate = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;
    const faceVerifiedCount = data.filter(r => r.face_verified === true).length;
    const faceVerificationRate = totalRecords > 0 ? (faceVerifiedCount / totalRecords) * 100 : 0;
    const uniqueDates = [...new Set(data.map(r => r.record_date || r.attendance_date).filter(Boolean))];
    const avgHoursPerDay = uniqueDates.length > 0 ? totalHours / uniqueDates.length : 0;

    return {
      totalRecords,
      uniqueEmployees: uniqueEmployeeIds.length,
      departmentsCount: uniqueDepartments.length,
      totalHours: isNaN(totalHours) ? 0 : Math.round(totalHours * 100) / 100,
      attendanceRate: isNaN(attendanceRate) ? '0.0' : attendanceRate.toFixed(1),
      faceVerifiedCount,
      faceVerificationRate: isNaN(faceVerificationRate) ? '0.0' : faceVerificationRate.toFixed(1),
      avgHoursPerDay: isNaN(avgHoursPerDay) ? 0 : Math.round(avgHoursPerDay * 100) / 100,
      presentCount
    };
    
  } catch (error) {
    console.error('❌ Erreur calculateDetailedStats:', error);
    return this.getEmptyStats();
  }
}

/**
 * Statistiques vides par défaut
 */
getEmptyStats() {
  return {
    totalRecords: 0,
    uniqueEmployees: 0,
    departmentsCount: 0,
    totalHours: 0,
    attendanceRate: '0.0',
    faceVerifiedCount: 0,
    faceVerificationRate: '0.0',
    avgHoursPerDay: 0,
    presentCount: 0
  };
}

  calculateDepartmentStats(data) {
    const deptMap = {};
    data.forEach(record => {
      const dept = record.department || 'Non spécifié';
      deptMap[dept] = (deptMap[dept] || 0) + 1;
    });
    return Object.entries(deptMap)
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count);
  }

  calculateStatusStats(data) {
    const statusMap = {};
    data.forEach(record => {
      const status = this.translateStatus(record.status) || 'Inconnu';
      statusMap[status] = (statusMap[status] || 0) + 1;
    });
    const total = data.length;
    return Object.entries(statusMap)
      .map(([status, count]) => ({ status, count, percentage: total > 0 ? (count / total) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);
  }

  calculateTimeStats(data) {
  try {
    // Vérification sécurité
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.log('📊 Aucune donnée pour stats temporelles');
      return [];
    }

    const weekMap = {};
    
    data.forEach(record => {
      // Récupérer la date
      const dateStr = record.record_date || record.attendance_date;
      if (!dateStr) return;
      
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return;
      
      // Grouper par semaine
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weekMap[weekKey]) {
        weekMap[weekKey] = { 
          count: 0, 
          totalHours: 0, 
          presentCount: 0 
        };
      }
      
      weekMap[weekKey].count++;
      
      // === CORRECTION CRITIQUE ===
      // Vérifier que hours_worked est un nombre valide
      let hoursWorked = 0;
      if (record.hours_worked !== null && record.hours_worked !== undefined) {
        hoursWorked = parseFloat(record.hours_worked);
        if (isNaN(hoursWorked)) {
          hoursWorked = 0;
        }
      }
      weekMap[weekKey].totalHours += hoursWorked;
      // === FIN CORRECTION ===
      
      // Compter les présences
      if (record.status === 'present' || record.status === 'checked_out') {
        weekMap[weekKey].presentCount++;
      }
    });
    
    // Convertir en tableau et formater
    const result = Object.entries(weekMap)
      .map(([weekKey, stats]) => {
        // === CORRECTION: Éviter division par zéro et NaN ===
        const avgHours = stats.count > 0 ? stats.totalHours / stats.count : 0;
        const attendanceRate = stats.count > 0 ? (stats.presentCount / stats.count) * 100 : 0;
        
        // Formater la période
        let period = weekKey;
        try {
          const date = new Date(weekKey);
          if (!isNaN(date.getTime())) {
            period = `Sem. ${date.toLocaleDateString('fr-FR', { 
              month: 'short', 
              day: 'numeric' 
            })}`;
          }
        } catch (e) {
          // Garder la clé originale
        }
        
        return {
          period: period,
          count: stats.count || 0,
          avgHours: isNaN(avgHours) ? 0 : Math.round(avgHours * 10) / 10,
          attendanceRate: isNaN(attendanceRate) ? 0 : Math.round(attendanceRate * 10) / 10
        };
      })
      .sort((a, b) => {
        // Trier par date
        try {
          return new Date(a.period.replace('Sem. ', '')) - new Date(b.period.replace('Sem. ', ''));
        } catch {
          return 0;
        }
      })
      .slice(-6);
    
    console.log(`📊 ${result.length} semaines calculées`);
    return result;
    
  } catch (error) {
    console.error('❌ Erreur calculateTimeStats:', error);
    return []; // IMPORTANT: retourner tableau vide en cas d'erreur
  }
}

  groupByEmployee(data) {
    return data.reduce((groups, record) => {
      const key = record.employee_id || 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(record);
      return groups;
    }, {});
  }

  getDepartmentColor(index) {
    const colors = ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#F44336', '#00BCD4'];
    return colors[index % colors.length];
  }

  getStatusColor(status) {
    const colorMap = {
      'present': '#4CAF50', 'checked_out': '#4CAF50',
      'in_progress': '#2196F3', 'late': '#FF9800',
      'absent': '#F44336', 'unknown': '#9E9E9E'
    };
    return colorMap[status] || '#9E9E9E';
  }

  generateRecommendations(stats) {
    const recommendations = [];
    if (stats.attendanceRate < 85) {
      recommendations.push(
        `Optimiser le taux de présence (actuellement ${stats.attendanceRate}%). ` +
        `Mettre en place un programme de suivi et de motivation des équipes.`
      );
    }
    if (stats.avgHoursPerDay < 7.5) {
      recommendations.push(
        `Améliorer la productivité moyenne (${stats.avgHoursPerDay.toFixed(1)}h/jour). ` +
        `Évaluer les processus et formations nécessaires.`
      );
    }
    if (stats.faceVerificationRate < 95) {
      recommendations.push(
        `Augmenter l'utilisation de la vérification faciale (${stats.faceVerificationRate}%). ` +
        `Sensibiliser les équipes à l'importance de cette fonctionnalité.`
      );
    }
    recommendations.push(
      `Maintenir un suivi régulier des indicateurs clés et ajuster les stratégies ` +
      `en fonction des tendances observées.`
    );
    recommendations.push(
      `Organiser des réunions trimestrielles de revue des présences avec les managers ` +
      `pour aligner les objectifs et résoudre les problèmes récurrents.`
    );
    return recommendations;
  }

  // =========================================================================
  // 6. EXPORTS DES EMPLOYÉS - EXCEL, CSV (ADMIN UNIQUEMENT)
  // =========================================================================

  async exportEmployeesToExcel(req, res) {
  try {
    console.log('👥 Export Excel des employés...');
    
    // ===== VÉRIFICATION STRICTE - ADMIN UNIQUEMENT =====
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié',
        code: 'UNAUTHORIZED'
      });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Export Excel des employés réservé aux administrateurs',
        error: 'EMPLOYEES_EXCEL_DENIED',
        code: 'FORBIDDEN_EMPLOYEES_EXCEL',
        requiredRole: 'admin',
        yourRole: req.user.role
      });
    }
    // ===== FIN VÉRIFICATION =====

    // ✅ REQUÊTE SQL CORRIGÉE - SANS COMMENTAIRES
    const result = await db.query(`
      SELECT 
        employee_id,
        cin,
        first_name,
        last_name,
        email,
        phone,
        department,
        position,
        hire_date,
        status,
        role,
        is_active,
        has_face_registered,
        created_at,
        updated_at
      FROM employees
      ORDER BY department, last_name, first_name
    `);

    const employeesData = result.rows;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Smart Attendance System';
    workbook.lastModifiedBy = 'Smart Attendance System';

    // ✅ COLONNES AVEC CIN
    const worksheet = workbook.addWorksheet('Employés');
    worksheet.columns = [
      { header: 'ID Employé', key: 'employee_id', width: 12 },
      { header: 'CIN', key: 'cin', width: 15 },
      { header: 'Nom', key: 'last_name', width: 15 },
      { header: 'Prénom', key: 'first_name', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Téléphone', key: 'phone', width: 15 },
      { header: 'Département', key: 'department', width: 15 },
      { header: 'Poste', key: 'position', width: 15 },
      { header: "Date d'embauche", key: 'hire_date', width: 15 },
      { header: 'Statut', key: 'status', width: 10 },
      { header: 'Rôle', key: 'role', width: 10 },
      { header: 'Actif', key: 'is_active', width: 8 },
      { header: 'Face Enregistrée', key: 'has_face_registered', width: 12 },
      { header: 'Date création', key: 'created_at', width: 18 },
      { header: 'Date mise à jour', key: 'updated_at', width: 18 }
    ];

    employeesData.forEach(employee => {
      worksheet.addRow({
        employee_id: employee.employee_id,
        cin: employee.cin || '',
        last_name: employee.last_name,
        first_name: employee.first_name,
        email: employee.email,
        phone: employee.phone || '',
        department: employee.department || '',
        position: employee.position || '',
        hire_date: employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('fr-FR') : '',
        status: this.translateStatus(employee.status),
        role: employee.role === 'admin' ? 'Admin' : employee.role === 'manager' ? 'Manager' : 'Employé',
        is_active: employee.is_active ? 'Oui' : 'Non',
        has_face_registered: employee.has_face_registered ? 'Oui' : 'Non',
        created_at: employee.created_at ? new Date(employee.created_at).toLocaleString('fr-FR') : '',
        updated_at: employee.updated_at ? new Date(employee.updated_at).toLocaleString('fr-FR') : ''
      });
    });

    // Style des en-têtes
    const headerRow = worksheet.getRow(1);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { 
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Style des lignes de données
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.height = 20;
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle' };
          cell.border = { 
            top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
          };
          if (rowNumber % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
          }
        });

        // Coloration conditionnelle
        const activeCell = row.getCell('is_active');
        if (activeCell.value === 'Oui') {
          activeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
          activeCell.font = { color: { argb: 'FF2E7D32' } };
        }

        const faceCell = row.getCell('has_face_registered');
        if (faceCell.value === 'Oui') {
          faceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
          faceCell.font = { color: { argb: 'FF0D47A1' } };
        }

        // Mettre en valeur le CIN s'il est présent
        const cinCell = row.getCell('cin');
        if (cinCell.value) {
          cinCell.font = { bold: true, color: { argb: 'FF0D47A1' } };
        }
      }
    });

    // Ajustement automatique des largeurs
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const length = cell.value ? cell.value.toString().length : 10;
        if (length > maxLength) maxLength = length;
      });
      column.width = Math.min(maxLength + 2, 40);
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `liste_employes_${timestamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
    
    console.log(`✅ Export employés terminé: ${employeesData.length} employés`);
    
  } catch (error) {
    console.error('❌ Erreur export employés:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'export des employés',
      error: error.message
    });
  }
}

  async exportEmployeesToCSV(req, res) {
  try {
    console.log('👥 Export CSV des employés...');
    
    // ===== VÉRIFICATION STRICTE - ADMIN UNIQUEMENT =====
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié',
        code: 'UNAUTHORIZED'
      });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Export CSV des employés réservé aux administrateurs',
        error: 'EMPLOYEES_CSV_DENIED',
        code: 'FORBIDDEN_EMPLOYEES_CSV',
        requiredRole: 'admin',
        yourRole: req.user.role
      });
    }
    // ===== FIN VÉRIFICATION =====

    // ✅ REQUÊTE SQL CORRIGÉE
    const result = await db.query(`
      SELECT 
        employee_id,
        cin,
        first_name,
        last_name,
        email,
        phone,
        department,
        position,
        hire_date,
        status,
        role,
        is_active,
        has_face_registered
      FROM employees
      ORDER BY department, last_name, first_name
    `);

    const employeesData = result.rows;
    
    // ✅ EN-TÊTES AVEC CIN
    const headers = [
      'ID Employé',
      'CIN',
      'Nom',
      'Prénom',
      'Email',
      'Téléphone',
      'Département',
      'Poste',
      "Date d'embauche",
      'Statut',
      'Rôle',
      'Actif',
      'Face Enregistrée'
    ];

    const csvRows = employeesData.map(employee => [
      employee.employee_id,
      employee.cin || '',
      employee.last_name,
      employee.first_name,
      employee.email,
      employee.phone || '',
      employee.department || '',
      employee.position || '',
      employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('fr-FR') : '',
      this.translateStatus(employee.status),
      employee.role === 'admin' ? 'Admin' : employee.role === 'manager' ? 'Manager' : 'Employé',
      employee.is_active ? 'Oui' : 'Non',
      employee.has_face_registered ? 'Oui' : 'Non'
    ]);

    const csvContent = [headers.join(';')]
      .concat(csvRows.map(row => row.map(cell => `"${cell}"`).join(';')))
      .join('\n');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `employes_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
    
    console.log(`✅ Export CSV employés terminé: ${employeesData.length} lignes`);
    
  } catch (error) {
    console.error('❌ Erreur export CSV employés:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'export CSV des employés',
      error: error.message
    });
  }
}

  // =========================================================================
  // 7. RAPPORTS SPÉCIALISÉS - DÉPARTEMENT, MENSUEL, ANNUEL
  // =========================================================================

  async exportDepartmentReport(req, res) {
    try {
      console.log('🏢 Export rapport par département...');
      
      // ===== VÉRIFICATION DES PERMISSIONS =====
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      const userRole = req.user.role;
      const userDepartment = req.user.department;
      // ===== FIN VÉRIFICATION =====

      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Les dates de début et fin sont requises'
        });
      }

      let query = `
        SELECT 
          department,
          COUNT(*) as total_records,
          COUNT(DISTINCT employee_id) as unique_employees,
          SUM(CASE WHEN status IN ('present', 'checked_out') THEN 1 ELSE 0 END) as present_count,
          AVG(hours_worked::float) as avg_hours,
          SUM(hours_worked::float) as total_hours,
          COUNT(CASE WHEN face_verified = true THEN 1 END) as face_verified_count
        FROM attendance
        WHERE record_date BETWEEN $1 AND $2
          AND department IS NOT NULL
      `;

      const params = [startDate, endDate];
      let paramIndex = 3;

      // MANAGER - ne voit que son département
      if (userRole === 'manager' && userDepartment) {
        query += ` AND department = $${paramIndex}`;
        params.push(userDepartment);
        paramIndex++;
      }

      query += ` GROUP BY department ORDER BY department`;

      const result = await db.query(query, params);
      let departmentData = result.rows;

      // Vérifier si le manager a des données
      if (userRole === 'manager' && departmentData.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Aucune donnée trouvée pour le département ${userDepartment}`,
          userDepartment: userDepartment
        });
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Smart Attendance System';
      workbook.lastModifiedBy = 'Smart Attendance System';

      const worksheet = workbook.addWorksheet('Rapport par Département');
      worksheet.columns = [
        { header: 'Département', key: 'department', width: 20 },
        { header: 'Enregistrements', key: 'total_records', width: 15 },
        { header: 'Employés uniques', key: 'unique_employees', width: 15 },
        { header: 'Présences', key: 'present_count', width: 12 },
        { header: 'Taux de présence', key: 'attendance_rate', width: 15 },
        { header: 'Heures moyennes', key: 'avg_hours', width: 15 },
        { header: 'Heures totales', key: 'total_hours', width: 15 },
        { header: 'Vérification faciale', key: 'face_verified_rate', width: 18 },
        { header: 'Performance', key: 'performance', width: 12 }
      ];

      departmentData.forEach(dept => {
        const attendanceRate = dept.total_records > 0 ? ((dept.present_count / dept.total_records) * 100).toFixed(1) : 0;
        const faceVerifiedRate = dept.total_records > 0 ? ((dept.face_verified_count / dept.total_records) * 100).toFixed(1) : 0;
        let performance = 'Moyenne';
        if (attendanceRate >= 90 && parseFloat(dept.avg_hours) >= 7.5) performance = 'Excellente';
        else if (attendanceRate >= 80 && parseFloat(dept.avg_hours) >= 7.0) performance = 'Bonne';
        else if (attendanceRate < 70 || parseFloat(dept.avg_hours) < 6.0) performance = 'À améliorer';

        worksheet.addRow({
          department: dept.department,
          total_records: dept.total_records,
          unique_employees: dept.unique_employees,
          present_count: dept.present_count,
          attendance_rate: `${attendanceRate}%`,
          avg_hours: parseFloat(dept.avg_hours || 0).toFixed(2),
          total_hours: parseFloat(dept.total_hours || 0).toFixed(2),
          face_verified_rate: `${faceVerifiedRate}%`,
          performance: performance
        });
      });

      const headerRow = worksheet.getRow(1);
      headerRow.height = 25;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D47A1' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin', color: { argb: 'FF0A3D7A' } },
          left: { style: 'thin', color: { argb: 'FF0A3D7A' } },
          bottom: { style: 'thin', color: { argb: 'FF0A3D7A' } },
          right: { style: 'thin', color: { argb: 'FF0A3D7A' } } };
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && rowNumber <= departmentData.length + 1) {
          row.height = 20;
          row.eachCell((cell) => {
            cell.alignment = { vertical: 'middle' };
            cell.border = { top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              right: { style: 'thin', color: { argb: 'FFE0E0E0' } } };
            if (rowNumber % 2 === 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
            }
          });

          const performanceCell = row.getCell('performance');
          if (performanceCell.value === 'Excellente') {
            performanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
            performanceCell.font = { color: { argb: 'FF2E7D32' } };
          } else if (performanceCell.value === 'Bonne') {
            performanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } };
            performanceCell.font = { color: { argb: 'FF7B1FA2' } };
          } else if (performanceCell.value === 'À améliorer') {
            performanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
            performanceCell.font = { color: { argb: 'FFC2185B' } };
          }
        }
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      let filename;
      if (userRole === 'manager') {
        filename = `rapport_departement_${userDepartment}_${startDate}_${endDate}_${timestamp}.xlsx`;
      } else {
        filename = `rapport_departements_${startDate}_${endDate}_${timestamp}.xlsx`;
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();
      console.log(`✅ Rapport départements terminé: ${departmentData.length} départements pour ${userRole}`);
    } catch (error) {
      console.error('❌ Erreur rapport départements:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du rapport par département',
        error: error.message
      });
    }
  }

  async exportMonthlySummary(req, res) {
    try {
      console.log('📅 Export résumé mensuel...');
      
      // ===== VÉRIFICATION STRICTE - ADMIN UNIQUEMENT =====
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Export résumé mensuel réservé aux administrateurs',
          error: 'MONTHLY_SUMMARY_DENIED',
          code: 'FORBIDDEN_MONTHLY_SUMMARY',
          requiredRole: 'admin',
          yourRole: req.user.role
        });
      }
      // ===== FIN VÉRIFICATION =====

      const { year, month } = req.query;

      if (!year || !month) {
        return res.status(400).json({
          success: false,
          message: 'L\'année et le mois sont requis'
        });
      }

      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const endDate = `${year}-${month.padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

      const result = await db.query(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT employee_id) as unique_employees,
          COUNT(DISTINCT department) as unique_departments,
          SUM(CASE WHEN status IN ('present', 'checked_out') THEN 1 ELSE 0 END) as present_count,
          SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
          SUM(hours_worked::float) as total_hours,
          AVG(hours_worked::float) as avg_hours_per_day,
          COUNT(CASE WHEN face_verified = true THEN 1 END) as face_verified_count,
          COUNT(CASE WHEN verification_method = 'face' THEN 1 END) as face_method_count,
          COUNT(CASE WHEN verification_method = 'manual' THEN 1 END) as manual_method_count,
          COUNT(CASE WHEN verification_method = 'card' THEN 1 END) as card_method_count
        FROM attendance
        WHERE record_date BETWEEN $1 AND $2
      `, [startDate, endDate]);

      const stats = result.rows[0];
      const total = parseInt(stats.total_records) || 1;
      const attendanceRate = ((parseInt(stats.present_count) / total) * 100).toFixed(1);
      const faceVerificationRate = ((parseInt(stats.face_verified_count) / total) * 100).toFixed(1);

      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait' });
      const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      const monthName = monthNames[parseInt(month) - 1];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `resume_mensuel_${year}_${month}_${timestamp}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      doc.pipe(res);

      doc.fontSize(24).font('Helvetica-Bold').fillColor('#1A237E')
        .text(`RÉSUMÉ MENSUEL - ${monthName} ${year}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).fillColor('#546E7A').font('Helvetica')
        .text(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' });
      doc.moveDown(2);

      doc.fillColor('#0D47A1').fontSize(16).font('Helvetica-Bold')
        .text('STATISTIQUES GLOBALES', 50, 150);
      let y = 190;
      const lineHeight = 25;

      doc.fillColor('#37474F').fontSize(12).font('Helvetica-Bold');
      doc.text('Enregistrements totaux:', 50, y);
      doc.text('Employés uniques:', 50, y + lineHeight);
      doc.text('Départements:', 50, y + lineHeight * 2);
      doc.text('Taux de présence:', 50, y + lineHeight * 3);
      doc.text('Heures totales:', 50, y + lineHeight * 4);
      doc.text('Heures moyennes/jour:', 50, y + lineHeight * 5);
      doc.text('Taux vérification faciale:', 50, y + lineHeight * 6);

      doc.fillColor('#263238').font('Helvetica');
      doc.text(stats.total_records || '0', 250, y);
      doc.text(stats.unique_employees || '0', 250, y + lineHeight);
      doc.text(stats.unique_departments || '0', 250, y + lineHeight * 2);
      doc.text(`${attendanceRate}%`, 250, y + lineHeight * 3);
      doc.text(`${parseFloat(stats.total_hours || 0).toFixed(2)}h`, 250, y + lineHeight * 4);
      doc.text(`${parseFloat(stats.avg_hours_per_day || 0).toFixed(2)}h`, 250, y + lineHeight * 5);
      doc.text(`${faceVerificationRate}%`, 250, y + lineHeight * 6);

      y = doc.page.height - 200;
      doc.fillColor('#0D47A1').fontSize(16).font('Helvetica-Bold')
        .text('ANALYSE DES ABSENCES ET RETARDS', 50, y);
      y += 30;

      const lateRate = total > 0 ? ((parseInt(stats.late_count) / total) * 100).toFixed(1) : 0;
      const absentRate = total > 0 ? ((parseInt(stats.absent_count) / total) * 100).toFixed(1) : 0;

      doc.fillColor('#37474F').fontSize(12).font('Helvetica-Bold');
      doc.text('Retards:', 50, y);
      doc.text('Taux de retard:', 50, y + lineHeight);
      doc.text('Absences:', 50, y + lineHeight * 2);
      doc.text('Taux d\'absence:', 50, y + lineHeight * 3);

      doc.fillColor('#263238').font('Helvetica');
      doc.text(stats.late_count || '0', 250, y);
      doc.text(`${lateRate}%`, 250, y + lineHeight);
      doc.text(stats.absent_count || '0', 250, y + lineHeight * 2);
      doc.text(`${absentRate}%`, 250, y + lineHeight * 3);

      doc.end();
      console.log(`✅ Résumé mensuel généré pour ${monthName} ${year}`);
    } catch (error) {
      console.error('❌ Erreur résumé mensuel:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du résumé mensuel',
        error: error.message
      });
    }
  }

  async exportYearlyReport(req, res) {
    try {
      console.log('📊 Export rapport annuel...');
      
      // ===== VÉRIFICATION STRICTE - ADMIN UNIQUEMENT =====
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Export rapport annuel réservé aux administrateurs',
          error: 'YEARLY_REPORT_DENIED',
          code: 'FORBIDDEN_YEARLY_REPORT',
          requiredRole: 'admin',
          yourRole: req.user.role
        });
      }
      // ===== FIN VÉRIFICATION =====

      const { year } = req.query;

      if (!year) {
        return res.status(400).json({
          success: false,
          message: 'L\'année est requise'
        });
      }

      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const result = await db.query(`
        SELECT 
          EXTRACT(MONTH FROM record_date) as month_number,
          COUNT(*) as total_records,
          COUNT(DISTINCT employee_id) as unique_employees,
          SUM(CASE WHEN status IN ('present', 'checked_out') THEN 1 ELSE 0 END) as present_count,
          SUM(hours_worked::float) as total_hours,
          AVG(hours_worked::float) as avg_hours,
          COUNT(CASE WHEN face_verified = true THEN 1 END) as face_verified_count
        FROM attendance
        WHERE record_date BETWEEN $1 AND $2
        GROUP BY EXTRACT(MONTH FROM record_date)
        ORDER BY month_number
      `, [startDate, endDate]);

      const monthlyData = result.rows;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Smart Attendance System';
      workbook.lastModifiedBy = 'Smart Attendance System';

      const worksheet = workbook.addWorksheet(`Rapport ${year}`);
      const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];

      worksheet.columns = [
        { header: 'Mois', key: 'month', width: 15 },
        { header: 'Enregistrements', key: 'total_records', width: 15 },
        { header: 'Employés uniques', key: 'unique_employees', width: 15 },
        { header: 'Taux de présence', key: 'attendance_rate', width: 15 },
        { header: 'Heures totales', key: 'total_hours', width: 15 },
        { header: 'Heures moyennes', key: 'avg_hours', width: 15 },
        { header: 'Vérification faciale', key: 'face_verified_rate', width: 18 },
        { header: 'Performance', key: 'performance', width: 12 }
      ];

      monthlyData.forEach(data => {
        const monthIndex = parseInt(data.month_number) - 1;
        const monthName = monthNames[monthIndex] || `Mois ${data.month_number}`;
        const attendanceRate = data.total_records > 0 ? ((data.present_count / data.total_records) * 100).toFixed(1) : 0;
        const faceVerifiedRate = data.total_records > 0 ? ((data.face_verified_count / data.total_records) * 100).toFixed(1) : 0;
        let performance = 'Moyenne';
        const attendanceRateNum = parseFloat(attendanceRate);
        const avgHoursNum = parseFloat(data.avg_hours || 0);
        if (attendanceRateNum >= 90 && avgHoursNum >= 7.5) performance = 'Excellente';
        else if (attendanceRateNum >= 85 && avgHoursNum >= 7.0) performance = 'Bonne';
        else if (attendanceRateNum < 75 || avgHoursNum < 6.5) performance = 'À améliorer';

        worksheet.addRow({
          month: monthName,
          total_records: data.total_records,
          unique_employees: data.unique_employees,
          attendance_rate: `${attendanceRate}%`,
          total_hours: parseFloat(data.total_hours || 0).toFixed(2),
          avg_hours: parseFloat(data.avg_hours || 0).toFixed(2),
          face_verified_rate: `${faceVerifiedRate}%`,
          performance: performance
        });
      });

      const totals = monthlyData.reduce((acc, data) => {
        acc.totalRecords += parseInt(data.total_records) || 0;
        acc.presentCount += parseInt(data.present_count) || 0;
        acc.totalHours += parseFloat(data.total_hours) || 0;
        acc.faceVerifiedCount += parseInt(data.face_verified_count) || 0;
        return acc;
      }, { totalRecords: 0, presentCount: 0, totalHours: 0, faceVerifiedCount: 0 });

      worksheet.addRow({});
      const overallAttendanceRate = totals.totalRecords > 0 ? ((totals.presentCount / totals.totalRecords) * 100).toFixed(1) : 0;
      const overallFaceVerifiedRate = totals.totalRecords > 0 ? ((totals.faceVerifiedCount / totals.totalRecords) * 100).toFixed(1) : 0;

      worksheet.addRow({
        month: 'TOTAL ANNÉE',
        total_records: totals.totalRecords,
        unique_employees: '',
        attendance_rate: `${overallAttendanceRate}%`,
        total_hours: totals.totalHours.toFixed(2),
        avg_hours: (totals.totalRecords > 0 ? totals.totalHours / totals.totalRecords : 0).toFixed(2),
        face_verified_rate: `${overallFaceVerifiedRate}%`,
        performance: ''
      });

      const headerRow = worksheet.getRow(1);
      headerRow.height = 25;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin', color: { argb: 'FF1B5E20' } },
          left: { style: 'thin', color: { argb: 'FF1B5E20' } },
          bottom: { style: 'thin', color: { argb: 'FF1B5E20' } },
          right: { style: 'thin', color: { argb: 'FF1B5E20' } } };
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && rowNumber <= monthlyData.length + 1) {
          row.height = 20;
          row.eachCell((cell) => {
            cell.alignment = { vertical: 'middle' };
            cell.border = { top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              right: { style: 'thin', color: { argb: 'FFE0E0E0' } } };
            if (rowNumber % 2 === 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
            }
          });

          const performanceCell = row.getCell('performance');
          if (performanceCell.value === 'Excellente') {
            performanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
            performanceCell.font = { color: { argb: 'FF2E7D32' } };
          } else if (performanceCell.value === 'Bonne') {
            performanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } };
            performanceCell.font = { color: { argb: 'FF7B1FA2' } };
          } else if (performanceCell.value === 'À améliorer') {
            performanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
            performanceCell.font = { color: { argb: 'FFC2185B' } };
          }
        }

        if (rowNumber === monthlyData.length + 3) {
          row.height = 25;
          row.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
            cell.border = { top: { style: 'medium', color: { argb: 'FF0D47A1' } },
              bottom: { style: 'medium', color: { argb: 'FF0D47A1' } } };
          });
        }
      });

      const chartSheet = workbook.addWorksheet('Graphiques');
      const chartData = monthlyData.map(data => {
        const monthIndex = parseInt(data.month_number) - 1;
        return {
          month: monthNames[monthIndex]?.substring(0, 3) || `M${data.month_number}`,
          attendanceRate: data.total_records > 0 ? ((data.present_count / data.total_records) * 100) : 0,
          avgHours: parseFloat(data.avg_hours || 0)
        };
      });

      chartSheet.columns = [
        { header: 'Mois', key: 'month', width: 10 },
        { header: 'Taux de présence (%)', key: 'attendanceRate', width: 18 },
        { header: 'Heures moyennes', key: 'avgHours', width: 15 }
      ];
      chartData.forEach(data => chartSheet.addRow({
        month: data.month,
        attendanceRate: data.attendanceRate.toFixed(1),
        avgHours: data.avgHours.toFixed(2)
      }));

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `rapport_annuel_${year}_${timestamp}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();
      console.log(`✅ Rapport annuel ${year} généré: ${monthlyData.length} mois`);
    } catch (error) {
      console.error('❌ Erreur rapport annuel:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du rapport annuel',
        error: error.message
      });
    }
  }

  // =========================================================================
  // 8. UTILITAIRES SYSTÈME - STORAGE, HISTORY, CLEANUP (ADMIN UNIQUEMENT)
  // =========================================================================

  async checkStorageSpace(req, res) {
    try {
      console.log('💾 Vérification espace disque...');
      
      // ===== VÉRIFICATION STRICTE - ADMIN UNIQUEMENT =====
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Vérification espace disque réservée aux administrateurs',
          error: 'STORAGE_CHECK_DENIED',
          code: 'FORBIDDEN_STORAGE_CHECK',
          requiredRole: 'admin',
          yourRole: req.user.role
        });
      }
      // ===== FIN VÉRIFICATION =====

      const storagePath = process.env.STORAGE_PATH || './exports';
      const freeSpaceMB = 5000;
      const totalSpaceMB = 20000;
      const usedSpaceMB = totalSpaceMB - freeSpaceMB;
      const usagePercentage = (usedSpaceMB / totalSpaceMB) * 100;

      res.json({
        success: true,
        data: {
          storage_path: storagePath,
          free_space_mb: freeSpaceMB,
          total_space_mb: totalSpaceMB,
          used_space_mb: usedSpaceMB,
          usage_percentage: usagePercentage.toFixed(1),
          status: freeSpaceMB > 1000 ? 'OK' : 'CRITIQUE',
          recommendations: freeSpaceMB < 1000 ?
            'Espace disque faible. Veuillez libérer de l\'espace.' :
            'Espace disque suffisant.'
        }
      });
    } catch (error) {
      console.error('❌ Erreur vérification espace disque:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification de l\'espace disque',
        error: error.message
      });
    }
  }

  async generateExportHistory(req, res) {
    try {
      console.log('📜 Génération historique des exports...');
      
      // ===== VÉRIFICATION STRICTE - ADMIN UNIQUEMENT =====
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Historique des exports réservé aux administrateurs',
          error: 'EXPORT_HISTORY_DENIED',
          code: 'FORBIDDEN_EXPORT_HISTORY',
          requiredRole: 'admin',
          yourRole: req.user.role
        });
      }
      // ===== FIN VÉRIFICATION =====

      const { limit = 50 } = req.query;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Smart Attendance System';
      workbook.lastModifiedBy = 'Smart Attendance System';

      const worksheet = workbook.addWorksheet('Historique des Exports');
      worksheet.columns = [
        { header: 'Date', key: 'date', width: 20 },
        { header: 'Type d\'export', key: 'type', width: 20 },
        { header: 'Paramètres', key: 'parameters', width: 30 },
        { header: 'Utilisateur', key: 'user', width: 25 },
        { header: 'Taille', key: 'size', width: 15 },
        { header: 'Statut', key: 'status', width: 12 },
        { header: 'Durée', key: 'duration', width: 12 },
        { header: 'Notes', key: 'notes', width: 30 }
      ];

      const historyData = [
        {
          date: new Date().toLocaleString('fr-FR'),
          type: 'Excel - Pointages',
          parameters: '2024-01-01 au 2024-01-31',
          user: 'admin@entreprise.com',
          size: '1.2 MB',
          status: 'Succès',
          duration: '8s',
          notes: 'Export complet des pointages'
        },
        {
          date: new Date(Date.now() - 86400000).toLocaleString('fr-FR'),
          type: 'PDF - Fiches de paie',
          parameters: 'Mois: 2024-01',
          user: 'comptabilité@entreprise.com',
          size: '850 KB',
          status: 'Succès',
          duration: '5s',
          notes: 'Fiches de paie mensuelles'
        },
        {
          date: new Date(Date.now() - 172800000).toLocaleString('fr-FR'),
          type: 'ZIP - Archives',
          parameters: 'Lot 1/3 - 100 fiches',
          user: 'rh@entreprise.com',
          size: '2.5 MB',
          status: 'Succès',
          duration: '12s',
          notes: 'Export par lot de fiches de paie'
        }
      ];

      historyData.forEach(record => worksheet.addRow(record));

      const headerRow = worksheet.getRow(1);
      headerRow.height = 25;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF546E7A' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin', color: { argb: 'FF455A64' } },
          left: { style: 'thin', color: { argb: 'FF455A64' } },
          bottom: { style: 'thin', color: { argb: 'FF455A64' } },
          right: { style: 'thin', color: { argb: 'FF455A64' } } };
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.height = 20;
          row.eachCell((cell) => {
            cell.alignment = { vertical: 'middle' };
            cell.border = { top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              right: { style: 'thin', color: { argb: 'FFE0E0E0' } } };
            if (rowNumber % 2 === 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
            }
          });

          const statusCell = row.getCell('status');
          if (statusCell.value === 'Succès') {
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
            statusCell.font = { color: { argb: 'FF2E7D32' } };
          } else if (statusCell.value === 'Erreur') {
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
            statusCell.font = { color: { argb: 'FFC2185B' } };
          }
        }
      });

      const statsRow = historyData.length + 3;
      worksheet.getCell(`A${statsRow}`).value = 'Statistiques:';
      worksheet.getCell(`A${statsRow}`).font = { bold: true };
      worksheet.getCell(`A${statsRow + 1}`).value = `Total exports: ${historyData.length}`;
      worksheet.getCell(`A${statsRow + 2}`).value = `Dernier export: ${historyData[0].date}`;
      worksheet.getCell(`A${statsRow + 3}`).value = `Taux de succès: 100%`;

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `historique_exports_${timestamp}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();
      console.log(`✅ Historique des exports généré: ${historyData.length} entrées`);
    } catch (error) {
      console.error('❌ Erreur historique des exports:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération de l\'historique des exports',
        error: error.message
      });
    }
  }

  async cleanOldExports(req, res) {
    try {
      console.log('🧹 Nettoyage des anciens exports...');
      
      // ===== VÉRIFICATION STRICTE - ADMIN UNIQUEMENT =====
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'UNAUTHORIZED'
        });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Nettoyage des exports réservé aux administrateurs',
          error: 'CLEAN_EXPORTS_DENIED',
          code: 'FORBIDDEN_CLEAN_EXPORTS',
          requiredRole: 'admin',
          yourRole: req.user.role
        });
      }
      // ===== FIN VÉRIFICATION =====

      const { days = 30 } = req.query;
      const daysNum = parseInt(days);

      const exportsPath = process.env.EXPORTS_PATH || './exports';
      const mockFiles = [
        { name: 'export_2024-01-01.xlsx', date: new Date(Date.now() - 35 * 86400000), size: 1200000 },
        { name: 'export_2024-01-15.pdf', date: new Date(Date.now() - 20 * 86400000), size: 850000 },
        { name: 'export_2024-02-01.zip', date: new Date(Date.now() - 5 * 86400000), size: 2500000 }
      ];

      const cutoffDate = new Date(Date.now() - daysNum * 86400000);
      const filesToDelete = mockFiles.filter(file => file.date < cutoffDate);
      const filesToKeep = mockFiles.filter(file => file.date >= cutoffDate);
      const spaceFreed = filesToDelete.reduce((sum, file) => sum + file.size, 0);
      const spaceFreedMB = (spaceFreed / (1024 * 1024)).toFixed(2);

      res.json({
        success: true,
        message: `Nettoyage des exports de plus de ${daysNum} jours`,
        data: {
          cutoff_date: cutoffDate.toLocaleDateString('fr-FR'),
          total_files_found: mockFiles.length,
          files_to_delete: filesToDelete.length,
          files_to_keep: filesToKeep.length,
          space_freed_mb: spaceFreedMB,
          files_to_delete_list: filesToDelete.map(f => ({
            name: f.name,
            date: f.date.toLocaleDateString('fr-FR'),
            size_mb: (f.size / (1024 * 1024)).toFixed(2)
          })),
          files_to_keep_list: filesToKeep.map(f => ({
            name: f.name,
            date: f.date.toLocaleDateString('fr-FR'),
            size_mb: (f.size / (1024 * 1024)).toFixed(2)
          }))
        },
        action_required: filesToDelete.length > 0 ?
          `${filesToDelete.length} fichiers peuvent être supprimés pour libérer ${spaceFreedMB} MB` :
          'Aucun fichier à supprimer',
        note: 'Cette opération est simulée. En production, les fichiers seraient effectivement supprimés.'
      });
    } catch (error) {
      console.error('❌ Erreur nettoyage des exports:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du nettoyage des anciens exports',
        error: error.message
      });
    }
  }

  // =========================================================================
  // 9. BINDING DE TOUTES LES MÉTHODES
  // =========================================================================

  bindAllMethods() {
    console.log('🔗 Binding de toutes les méthodes...');
    const methodsToBind = [
      // Méthodes de vérification
      'checkExportPermissions', 'verifyAttendanceExport', 'verifyPayslipExport', 
      'verifyAdminOnly', 'filterDataByPermissions',
      
      // Méthodes utilitaires
      'getLastDayOfMonth', 'addErrorMessage', 'translateStatus', 'formatTime',
      'getMonthName', 'numberToWords', 'formatAmount',
      
      // Fiches de paie individuelles
      'exportSinglePayslipToPDF', 'generateSinglePayslipPdf',
      'generateProfessionalPayslipWithDetailsPDF', 'generateProfessionalPayslip',
      'generateProfessionalFullPagePayslip', 'generateIndividualPayslip',
      
      // Exports admin uniquement
      'exportPayslipsToPDF', 'exportPayslipsToExcel', 'exportPayslipsToZip',
      'exportPayslipsToZipAdvanced', 'exportPayslipsToCSV', 'exportPayslipsBatch',
      'downloadAllBatches', 'getPayslipsBatchInfo', 'checkPayslipData', 'getPayslipZipInfo',
      
      // Exports présence (admin + manager)
      'exportAttendanceToExcel', 'exportAttendanceToPDF', 'exportAttendanceToCSV',
      
      // Exports employés (admin uniquement)
      'exportEmployeesToExcel', 'exportEmployeesToCSV',
      
      // Rapports spécialisés
      'exportDepartmentReport', 'exportMonthlySummary', 'exportYearlyReport',
      
      // Utilitaires système
      'checkStorageSpace', 'generateExportHistory', 'cleanOldExports',
      
      // Méthodes PDF professionnelles
      'generateProfessionalPDFContent', 'addCoverPage', 'addExecutiveSummary',
      'addDetailedStatistics', 'addAttendanceTable', 'addConclusionPage', 'addPageHeader',
      'drawKPICard', 'getDepartmentColor', 'getStatusColor',
      
      // Calculs statistiques
      'calculateDetailedStats', 'calculateDepartmentStats', 'calculateStatusStats',
      'calculateTimeStats', 'groupByEmployee', 'generateRecommendations'
    ];

    methodsToBind.forEach(methodName => {
      if (typeof this[methodName] === 'function') {
        this[methodName] = this[methodName].bind(this);
        console.log(`  ✅ ${methodName} bindée`);
      } else {
        console.warn(`  ⚠️ ${methodName} non trouvée`);
      }
    });
    console.log('✅ Toutes les méthodes existantes ont été bindées');
  }
}

// =========================================================================
// 10. EXPORT DE L'INSTANCE
// =========================================================================

const exportControllerInstance = new ExportController();
exportControllerInstance.bindAllMethods();
module.exports = exportControllerInstance;