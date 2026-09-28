// controllers/employeeController.js - VERSION CORRIGÉE forceDeleteEmployee
const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const emailService = require('../utils/emailService');

class EmployeeController {
  constructor() {
    this.init();
  }

  init() {
    // Bind toutes les méthodes
    const methods = [
      'getAllEmployees', 'getEmployeeStats', 'getEmployeeById',
      'createEmployee', 'updateEmployee', 'deleteEmployee',
      'activateEmployee', 'deactivateEmployee', 'forceDeleteEmployee',
      'generateEmployeeId', 'transformEmployeeToCamelCase',
      'transformEmployeeToSnakeCase', 'generateDefaultPassword',
      'getAllActiveEmployees'
    ];
    
    methods.forEach(method => {
      this[method] = this[method].bind(this);
    });
  }

  // ==================== HELPERS ====================  

  // ✅ VERSION CORRIGÉE - avec employee au lieu de emp
  transformEmployeeToCamelCase(employee) {
    if (!employee) return null;
    
    try {
      return {
        id: employee.id,
        employeeId: employee.employee_id,
        firstName: employee.first_name,
        lastName: employee.last_name,
        cin: employee.cin || '',                 // ← CORRIGÉ: employee au lieu de emp
        cnssNumber: employee.cnss_number || '',   // ← CORRIGÉ: employee au lieu de emp
        email: employee.email,
        phone: employee.phone,
        department: employee.department,
        position: employee.position,
        role: employee.role,
        status: employee.status,
        isActive: employee.is_active,
        hasFaceRegistered: employee.has_face_registered,
        hireDate: employee.hire_date,
        createdAt: employee.created_at,
        updatedAt: employee.updated_at,
        fullName: `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
      };
    } catch (error) {
      console.error('❌ Erreur transformation employé:', error);
      console.error('Données reçues:', employee);
      return null;
    }
  }

  transformEmployeeToSnakeCase(employeeData) {
    if (!employeeData) return {};
    
    return {
      employee_id: employeeData.employeeId || employeeData.employee_id,
      first_name: employeeData.firstName || employeeData.first_name,
      last_name: employeeData.lastName || employeeData.last_name,
      cin: employeeData.cin,                     // ← AJOUT
      cnss_number: employeeData.cnssNumber,       // ← AJOUT
      email: employeeData.email,
      phone: employeeData.phone,
      department: employeeData.department,
      position: employeeData.position,
      role: employeeData.role,
      status: employeeData.status,
      is_active: employeeData.isActive !== undefined ? employeeData.isActive : true,
      has_face_registered: employeeData.hasFaceRegistered !== undefined ? employeeData.hasFaceRegistered : false,
      hire_date: employeeData.hireDate || employeeData.hire_date
    };
  }

  async generateEmployeeId() {
    try {
      const result = await db.query(`
        SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id FROM 4) AS INTEGER)), 0) as max_num 
        FROM employees 
        WHERE employee_id ~ '^EMP[0-9]+$'
      `);
      
      const nextNum = parseInt(result.rows[0].max_num) + 1;
      return `EMP${String(nextNum).padStart(3, '0')}`;
      
    } catch (error) {
      console.error('[EMPLOYEE] Erreur génération ID:', error.message);
      return `EMP${Date.now().toString().slice(-6)}`;
    }
  }

  generateDefaultPassword(firstName, lastName) {
    if (!firstName) return 'Employe123';
    
    const cleanFirstName = firstName
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z]/g, '')
      .substring(0, 10);
    
    let cleanLastName = '';
    if (lastName) {
      cleanLastName = lastName
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z]/g, '')
        .substring(0, 10);
    }
    
    let defaultPassword = cleanLastName && cleanLastName.length > 1
      ? `${cleanFirstName}-${cleanLastName}123`
      : `${cleanFirstName}123`;
    
    return defaultPassword.substring(0, 20);
  }

  // ==================== MÉTHODE POUR LA PAIE ====================

  async getAllActiveEmployees() {
    try {
      console.log('[EMPLOYEE] Récupération des employés actifs...');
      const result = await db.query(`
        SELECT employee_id, first_name, last_name, email, 
               department, position, hire_date, base_salary
        FROM employees 
        WHERE is_active = true
        ORDER BY last_name, first_name
      `);
      
      console.log(`[EMPLOYEE] ${result.rows.length} employés actifs trouvés`);
      return result.rows;
    } catch (error) {
      console.error('[EMPLOYEE] Erreur getAllActiveEmployees:', error.message);
      return [];
    }
  }

  // ==================== API METHODS ====================

  // ✅ VERSION AMÉLIORÉE AVEC LOGS
  async getAllEmployees(req, res) {
    try {
      console.log('📋 getAllEmployees - Début');
      console.log('👤 req.user:', req.user);
      
      const { role, department, id, email } = req.user;
      
      let query = `
        SELECT id, employee_id, first_name, last_name, cin, cnss_number, email, 
               department, position, hire_date, status, phone, 
               role, has_face_registered, is_active,
               created_at, updated_at
        FROM employees
      `;
      
      let params = [];
      let conditions = [];
      
      if (role === 'employee') {
        conditions.push(`(email = $1 OR id = $2)`);
        params.push(email, id);
        conditions.push(`is_active = true`);
      } else if (role === 'manager' && department) {
        conditions.push(`(department = $1 OR role = 'employee')`);
        params.push(department);
        conditions.push(`is_active = true`);
      }
      
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' ORDER BY last_name, first_name';
      
      console.log('📝 Requête SQL:', query);
      console.log('📊 Paramètres:', params);
      
      const result = await db.query(query, params);
      
      console.log(`✅ ${result.rows.length} employés trouvés en base`);
      
      // Vérifier les données brutes pour EMP002
      if (result.rows.length > 0) {
        const emp2 = result.rows.find(e => e.employee_id === 'EMP002');
        if (emp2) {
          console.log('📦 EMP002 (brut):', {
            id: emp2.id,
            employee_id: emp2.employee_id,
            first_name: emp2.first_name,
            last_name: emp2.last_name,
            cin: emp2.cin,
            cnss_number: emp2.cnss_number
          });
        }
      }
      
      const employees = result.rows.map(emp => {
        try {
          return this.transformEmployeeToCamelCase(emp);
        } catch (error) {
          console.error('❌ Erreur transformation:', error);
          console.error('Employé problématique:', emp);
          return null;
        }
      }).filter(emp => emp !== null);
      
      // Statistiques des CIN/CNSS
      const withCIN = employees.filter(e => e.cin && e.cin !== '').length;
      const withCNSS = employees.filter(e => e.cnssNumber && e.cnssNumber !== '').length;
      console.log(`📊 Statistiques: Total=${employees.length}, CIN=${withCIN}, CNSS=${withCNSS}`);
      
      res.json({
        success: true,
        data: employees,
        count: employees.length
      });

    } catch (error) {
      console.error('[EMPLOYEE] Erreur getAllEmployees:', error);
      console.error('Stack:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des employés'
      });
    }
  }

  async getEmployeeStats(req, res) {
    try {
      const { role, department } = req.user;
      let baseQuery = 'FROM employees';
      let params = [];
      
      if (role === 'manager' && department) {
        baseQuery += ' WHERE department = $1';
        params.push(department);
      }
      
      const result = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active,
          COUNT(CASE WHEN is_active = false THEN 1 END) as inactive
        ${baseQuery}
      `, params);
      
      const stats = result.rows[0];
      
      res.json({
        success: true,
        data: {
          total: parseInt(stats.total),
          active: parseInt(stats.active),
          inactive: parseInt(stats.inactive)
        }
      });

    } catch (error) {
      console.error('[EMPLOYEE] Erreur getEmployeeStats:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques'
      });
    }
  }

  async getEmployeeById(req, res) {
    try {
      const { id } = req.params;
      const { role, department, email } = req.user;
      
      // Vérifier si c'est un ID numérique ou employee_id
      const isNumericId = !isNaN(id) && id.trim() !== '';
      
      let result;
      if (isNumericId) {
        result = await db.query('SELECT * FROM employees WHERE id = $1', [parseInt(id)]);
      } else {
        result = await db.query('SELECT * FROM employees WHERE employee_id = $1', [id]);
      }
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employé non trouvé'
        });
      }
      
      const employee = result.rows[0];
      
      // Vérifier les permissions
      if (role === 'employee' && employee.email !== email) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }
      
      if (role === 'manager' && employee.department !== department) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }
      
      res.json({
        success: true,
        data: this.transformEmployeeToCamelCase(employee)
      });

    } catch (error) {
      console.error('[EMPLOYEE] Erreur getEmployeeById:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de l\'employé'
      });
    }
  }

  async createEmployee(req, res) {
    try {
      const { role } = req.user;
      
      if (!['admin', 'manager'].includes(role)) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }
      
      const employeeData = this.transformEmployeeToSnakeCase(req.body);
      
      // Validation
      if (!employeeData.first_name || !employeeData.last_name || !employeeData.email) {
        return res.status(400).json({
          success: false,
          message: 'Le prénom, le nom et l\'email sont obligatoires'
        });
      }
      
      // Vérifier email unique
      const emailCheck = await db.query(
        'SELECT id FROM employees WHERE email = $1',
        [employeeData.email]
      );
      
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cet email est déjà utilisé'
        });
      }
      
      // Générer ID et mot de passe
      const employeeId = await this.generateEmployeeId();
      const plainPassword = this.generateDefaultPassword(
        employeeData.first_name, 
        employeeData.last_name
      );
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      
      // Insertion avec CIN et CNSS
      const result = await db.query(`
        INSERT INTO employees (
          employee_id, first_name, last_name, cin, cnss_number, email, department, 
          position, hire_date, status, phone, password_hash, 
          role, has_face_registered, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `, [
        employeeId,
        employeeData.first_name,
        employeeData.last_name,
        employeeData.cin || null,           // ← AJOUT
        employeeData.cnss_number || null,    // ← AJOUT
        employeeData.email,
        employeeData.department || 'IT',
        employeeData.position || 'Employé',
        employeeData.hire_date || new Date().toISOString().split('T')[0],
        employeeData.status || 'active',
        employeeData.phone,
        hashedPassword,
        employeeData.role || 'employee',
        employeeData.has_face_registered !== undefined ? employeeData.has_face_registered : false,
        employeeData.is_active !== undefined ? employeeData.is_active : true
      ]);
      
      const newEmployee = result.rows[0];
      
      // Envoyer email de bienvenue (si le service existe)
      try {
        const fullName = `${newEmployee.first_name} ${newEmployee.last_name}`;
        await emailService.sendWelcomeEmail(
          newEmployee.email, 
          fullName, 
          plainPassword
        );
        console.log(`[EMPLOYEE] Email envoyé à ${newEmployee.email}`);
      } catch (emailError) {
        console.warn('[EMPLOYEE] Email non envoyé:', emailError.message);
      }
      
      const responseData = this.transformEmployeeToCamelCase(newEmployee);
      
      // Retourner la réponse
      const response = {
        success: true,
        message: 'Employé créé avec succès',
        data: responseData
      };
      
      // En production, ne pas retourner le mot de passe
      if (process.env.NODE_ENV === 'development') {
        response.temporaryPassword = plainPassword;
      }
      
      res.status(201).json(response);

    } catch (error) {
      console.error('[EMPLOYEE] Erreur createEmployee:', error);
      
      let message = 'Erreur lors de la création de l\'employé';
      if (error.code === '23505') {
        if (error.constraint?.includes('cin')) message = 'Ce CIN est déjà utilisé';
        else if (error.constraint?.includes('cnss_number')) message = 'Ce numéro CNSS est déjà utilisé';
        else if (error.constraint?.includes('email')) message = 'Cet email est déjà utilisé';
        else message = 'Cette valeur existe déjà';
      }
      if (error.code === '23502') message = 'Champ obligatoire manquant';
      
      res.status(500).json({
        success: false,
        message: message
      });
    }
  }

  // ✅ VERSION CORRIGÉE DE updateEmployee
  async updateEmployee(req, res) {
    console.log('\n' + '🔥'.repeat(50));
    console.log('🔥 updateEmployee EXÉCUTÉ');
    console.log('📦 Body reçu (original):', req.body);

    try {
      const { role, department } = req.user;
      const { id } = req.params;
      
      // ✅ CRÉER UN OBJET NORMALISÉ avec les bons noms de champs pour la BD
      const dbData = {};
      
      // Mapping des champs (quel que soit le format reçu)
      const fieldMappings = {
        // camelCase
        'firstName': 'first_name',
        'lastName': 'last_name',
        'cin': 'cin',
        'cnssNumber': 'cnss_number',
        'email': 'email',
        'phone': 'phone',
        'department': 'department',
        'position': 'position',
        'status': 'status',
        'role': 'role',
        'isActive': 'is_active',
        'hireDate': 'hire_date',
        
        // snake_case
        'first_name': 'first_name',
        'last_name': 'last_name',
        'cin': 'cin',
        'cnss_number': 'cnss_number',
        'email': 'email',
        'phone': 'phone',
        'department': 'department',
        'position': 'position',
        'status': 'status',
        'role': 'role',
        'is_active': 'is_active',
        'hire_date': 'hire_date'
      };

      // Parcourir toutes les clés reçues
      Object.keys(req.body).forEach(key => {
        if (fieldMappings[key] && req.body[key] !== undefined) {
          dbData[fieldMappings[key]] = req.body[key];
          console.log(`✅ Mapping: ${key} -> ${fieldMappings[key]} =`, req.body[key]);
        }
      });

      console.log('📦 Données pour la BD:', dbData);

      // Vérifier les permissions
      if (!['admin', 'manager'].includes(role)) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }

      // Déterminer le type d'ID
      const isNumericId = /^\d+$/.test(id);

      // Vérifier l'employé existe
      let employee;
      if (isNumericId) {
        const result = await db.query(
          'SELECT * FROM employees WHERE id = $1',
          [parseInt(id)]
        );
        employee = result.rows[0];
      } else {
        const result = await db.query(
          'SELECT * FROM employees WHERE employee_id = $1',
          [id]
        );
        employee = result.rows[0];
      }

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employé non trouvé'
        });
      }

      // Vérifier les permissions du manager
      if (role === 'manager' && employee.department !== department) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez modifier que les employés de votre département'
        });
      }

      // Construire la requête UPDATE avec dbData
      const updates = [];
      const values = [];
      let paramCount = 1;

      Object.keys(dbData).forEach(field => {
        if (dbData[field] !== undefined && dbData[field] !== null) {
          updates.push(`${field} = $${paramCount}`);
          values.push(dbData[field]);
          paramCount++;
        }
      });

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Aucune donnée à mettre à jour'
        });
      }

      updates.push('updated_at = NOW()');

      let whereClause;
      if (isNumericId) {
        whereClause = `id = $${paramCount}`;
        values.push(parseInt(id));
      } else {
        whereClause = `employee_id = $${paramCount}`;
        values.push(id);
      }

      const query = `
        UPDATE employees 
        SET ${updates.join(', ')}
        WHERE ${whereClause}
        RETURNING *
      `;

      console.log('📝 Requête SQL:', query);
      console.log('📊 Valeurs:', values);

      const result = await db.query(query, values);
      const updatedEmployee = result.rows[0];

      console.log('✅ Employé mis à jour:', updatedEmployee);
      console.log('📊 CIN:', updatedEmployee.cin);
      console.log('📊 CNSS:', updatedEmployee.cnss_number);

      // Transformer la réponse en camelCase pour le frontend
      const responseData = {
        id: updatedEmployee.id,
        employeeId: updatedEmployee.employee_id,
        firstName: updatedEmployee.first_name,
        lastName: updatedEmployee.last_name,
        cin: updatedEmployee.cin,
        cnssNumber: updatedEmployee.cnss_number,
        email: updatedEmployee.email,
        phone: updatedEmployee.phone,
        department: updatedEmployee.department,
        position: updatedEmployee.position,
        status: updatedEmployee.status,
        role: updatedEmployee.role,
        isActive: updatedEmployee.is_active,
        hireDate: updatedEmployee.hire_date
      };

      res.json({
        success: true,
        message: 'Employé mis à jour avec succès',
        data: responseData
      });

    } catch (error) {
      console.error('❌ Erreur updateEmployee:', error);
      
      if (error.code === '23505') {
        if (error.constraint?.includes('cin')) {
          return res.status(400).json({
            success: false,
            message: 'Ce CIN est déjà utilisé par un autre employé'
          });
        }
        if (error.constraint?.includes('email')) {
          return res.status(400).json({
            success: false,
            message: 'Cet email est déjà utilisé'
          });
        }
        if (error.constraint?.includes('cnss_number')) {
          return res.status(400).json({
            success: false,
            message: 'Ce numéro CNSS est déjà utilisé'
          });
        }
      }

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour'
      });
    }
  }

  async deleteEmployee(req, res) {
    try {
      const { role } = req.user;
      const { id } = req.params;
      
      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }
      
      // Vérifier si c'est un ID numérique ou employee_id
      const isNumericId = !isNaN(id) && id.trim() !== '';
      
      let query;
      if (isNumericId) {
        query = `
          UPDATE employees 
          SET is_active = false, status = 'inactive', updated_at = NOW()
          WHERE id = $1 AND is_active = true
          RETURNING employee_id, first_name, last_name
        `;
      } else {
        query = `
          UPDATE employees 
          SET is_active = false, status = 'inactive', updated_at = NOW()
          WHERE employee_id = $1 AND is_active = true
          RETURNING employee_id, first_name, last_name
        `;
      }
      
      const result = await db.query(query, [isNumericId ? parseInt(id) : id]);
      
      if (result.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Employé non trouvé ou déjà désactivé'
        });
      }
      
      res.json({
        success: true,
        message: 'Employé désactivé avec succès'
      });

    } catch (error) {
      console.error('[EMPLOYEE] Erreur deleteEmployee:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la désactivation'
      });
    }
  }

  async activateEmployee(req, res) {
    try {
      const { role } = req.user;
      const { id } = req.params;
      
      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }
      
      // Vérifier si c'est un ID numérique ou employee_id
      const isNumericId = !isNaN(id) && id.trim() !== '';
      
      let query;
      if (isNumericId) {
        query = `
          UPDATE employees 
          SET is_active = true, status = 'active', updated_at = NOW()
          WHERE id = $1 AND is_active = false
          RETURNING employee_id, first_name, last_name
        `;
      } else {
        query = `
          UPDATE employees 
          SET is_active = true, status = 'active', updated_at = NOW()
          WHERE employee_id = $1 AND is_active = false
          RETURNING employee_id, first_name, last_name
        `;
      }
      
      const result = await db.query(query, [isNumericId ? parseInt(id) : id]);
      
      if (result.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Employé non trouvé ou déjà actif'
        });
      }
      
      res.json({
        success: true,
        message: 'Employé réactivé avec succès'
      });

    } catch (error) {
      console.error('[EMPLOYEE] Erreur activateEmployee:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la réactivation'
      });
    }
  }

  async deactivateEmployee(req, res) {
    return this.deleteEmployee(req, res);
  }

  async forceDeleteEmployee(req, res) {
    try {
      const { role } = req.user;
      const { id } = req.params;
      const { confirm, reason } = req.body;
      
      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }
      
      // Vérifier si c'est un ID numérique ou employee_id
      const isNumericId = !isNaN(id) && id.trim() !== '';
      
      // ========== ÉTAPE 1: DEMANDE DE CONFIRMATION ==========
      if (confirm !== true) {
        // Récupérer les informations de l'employé
        let employee;
        if (isNumericId) {
          const result = await db.query(
            'SELECT * FROM employees WHERE id = $1',
            [parseInt(id)]
          );
          employee = result.rows[0];
        } else {
          const result = await db.query(
            'SELECT * FROM employees WHERE employee_id = $1',
            [id]
          );
          employee = result.rows[0];
        }
        
        if (!employee) {
          return res.status(404).json({
            success: false,
            message: 'Employé non trouvé'
          });
        }
        
        // Compter les enregistrements liés
        const attendanceCount = await db.query(
          'SELECT COUNT(*) as count FROM attendance WHERE employee_id = $1',
          [employee.employee_id]
        );
        
        return res.json({
          success: true,
          requiresConfirmation: true,
          message: 'Êtes-vous sûr de vouloir supprimer définitivement cet employé ?',
          employeeInfo: {
            id: employee.id,
            employeeId: employee.employee_id,
            name: `${employee.first_name} ${employee.last_name}`,
            email: employee.email,
            department: employee.department,
            position: employee.position
          },
          details: {
            attendanceRecords: parseInt(attendanceCount.rows[0]?.count || 0)
          },
          warning: '⚠️ Cette action est irréversible !'
        });
      }
      
      // ========== ÉTAPE 2: SUPPRESSION ==========
      
      // Démarrer une transaction
      await db.query('BEGIN');
      
      try {
        // Récupérer l'employé avant suppression
        let employee;
        if (isNumericId) {
          const result = await db.query(
            'SELECT * FROM employees WHERE id = $1',
            [parseInt(id)]
          );
          employee = result.rows[0];
        } else {
          const result = await db.query(
            'SELECT * FROM employees WHERE employee_id = $1',
            [id]
          );
          employee = result.rows[0];
        }
        
        if (!employee) {
          throw new Error('Employé non trouvé');
        }
        
        const employeeId = employee.employee_id;
        
        // 1. Supprimer les enregistrements de présence
        await db.query('DELETE FROM attendance WHERE employee_id = $1', [employeeId]);
        
        // 2. Supprimer les logs de reconnaissance faciale (si la table existe)
        try {
          await db.query('DELETE FROM facial_recognition_logs WHERE employee_id = $1', [employeeId]);
        } catch (error) {
          // Table peut ne pas exister
        }
        
        // 3. Supprimer les encodages faciaux (si la table existe)
        try {
          await db.query('DELETE FROM facial_encodings WHERE employee_id = $1', [employeeId]);
        } catch (error) {
          // Table peut ne pas exister
        }
        
        // 4. Supprimer l'employé
        let deleteResult;
        if (isNumericId) {
          deleteResult = await db.query(
            'DELETE FROM employees WHERE id = $1 RETURNING *',
            [parseInt(id)]
          );
        } else {
          deleteResult = await db.query(
            'DELETE FROM employees WHERE employee_id = $1 RETURNING *',
            [id]
          );
        }
        
        if (deleteResult.rows.length === 0) {
          throw new Error('Aucun employé supprimé');
        }
        
        // 5. Journaliser (si la table existe)
        try {
          await db.query(
            `INSERT INTO audit_logs (user_id, action, details, created_at) 
             VALUES ($1, $2, $3, NOW())`,
            [
              req.user.id,
              'EMPLOYEE_FORCE_DELETE',
              JSON.stringify({
                employee_id: employeeId,
                employee_name: `${employee.first_name} ${employee.last_name}`,
                deleted_by: req.user.email,
                reason: reason || 'Non spécifiée'
              })
            ]
          );
        } catch (error) {
          // Table peut ne pas exister
        }
        
        // Valider la transaction
        await db.query('COMMIT');
        
        res.json({
          success: true,
          message: 'Employé supprimé définitivement avec succès'
        });
        
      } catch (transactionError) {
        // Annuler en cas d'erreur
        await db.query('ROLLBACK');
        throw transactionError;
      }
      
    } catch (error) {
      console.error('[EMPLOYEE] Erreur forceDeleteEmployee:', error.message);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression définitive'
      });
    }
  }
}

module.exports = new EmployeeController();