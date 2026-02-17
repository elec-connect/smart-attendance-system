// models/payrollModel.js - VERSION CORRIGÉE
const db = require('../../config/db');

class PayrollModel {
    // Configuration des salaires - CORRIGÉE
    static async createSalaryConfig(data) {
        // 1. VÉRIFIER SI L'EMPLOYÉ EXISTE D'ABORD
        try {
            const employeeCheck = await db.query(
                'SELECT employee_id, first_name, last_name FROM employees WHERE employee_id = $1',
                [data.employee_id]
            );
            
            if (employeeCheck.rows.length === 0) {
                throw new Error(`EMPLOYEE_NOT_FOUND: Employé avec ID "${data.employee_id}" non trouvé`);
            }
            
            console.log('✅ Employé trouvé:', employeeCheck.rows[0]);
            
            // 2. Vérifier si une configuration existe déjà
            const existingConfig = await db.query(
                'SELECT id FROM salary_configs WHERE employee_id = $1',
                [data.employee_id]
            );
            
            let query, values;
            
            if (existingConfig.rows.length > 0) {
                // Mise à jour de la configuration existante
                query = `
                    UPDATE salary_configs SET
                        base_salary = $2, 
                        currency = $3, 
                        payment_method = $4,
                        bank_name = $5, 
                        bank_account = $6, 
                        iban = $7, 
                        tax_rate = $8,
                        social_security_rate = $9, 
                        other_deductions = $10, 
                        bonus_fixed = $11, 
                        bonus_variable = $12,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE employee_id = $1
                    RETURNING *
                `;
            } else {
                // Insertion nouvelle configuration
                query = `
                    INSERT INTO salary_configs (
                        employee_id, base_salary, currency, payment_method,
                        bank_name, bank_account, iban, tax_rate,
                        social_security_rate, other_deductions, 
                        bonus_fixed, bonus_variable,
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING *
                `;
            }
            
            values = [
                data.employee_id, 
                data.base_salary, 
                data.currency || 'TND',
                data.payment_method || 'bank_transfer', 
                data.bank_name || '',
                data.bank_account || '', 
                data.iban || '', 
                data.tax_rate || 0,
                data.social_security_rate || 0, 
                data.other_deductions || 0,
                data.bonus_fixed || 0, 
                data.bonus_variable || 0
            ];
            
            console.log('📤 Exécution requête SQL:', query.substring(0, 200) + '...');
            console.log('📋 Valeurs:', values);
            
            const { rows } = await db.query(query, values);
            
            console.log('✅ Résultat:', rows[0]);
            return rows[0];
            
        } catch (error) {
            console.error('❌ Erreur dans createSalaryConfig:', error.message);
            
            // Vérifier si c'est une erreur de clé étrangère
            if (error.code === '23503' || error.message.includes('EMPLOYEE_NOT_FOUND')) {
                throw new Error(`EMPLOYEE_NOT_FOUND: Employé avec ID "${data.employee_id}" non trouvé dans la base de données`);
            }
            
            throw error;
        }
    }

    // Mettre à jour une configuration existante
    static async updateSalaryConfig(employeeId, data) {
        try {
            // Vérifier si la configuration existe
            const existing = await this.getSalaryConfig(employeeId);
            if (!existing || !existing.exists) {
                throw new Error(`Configuration non trouvée pour l'employé ${employeeId}`);
            }
            
            // Construire dynamiquement la requête UPDATE
            const updates = [];
            const values = [];
            let index = 1;
            
            // Ajouter chaque champ à mettre à jour
            const fields = [
                'base_salary', 'currency', 'payment_method', 'bank_name',
                'bank_account', 'iban', 'tax_rate', 'social_security_rate',
                'other_deductions', 'bonus_fixed', 'bonus_variable',
                'deductions', 'allowances', 'bank_details',
                'contract_type', 'is_active', 'updated_at'
            ];
            
            for (const field of fields) {
                if (data[field] !== undefined) {
                    updates.push(`${field} = $${index}`);
                    values.push(data[field]);
                    index++;
                }
            }
            
            if (updates.length === 0) {
                throw new Error('Aucune donnée à mettre à jour');
            }
            
            // Ajouter l'employee_id à la fin
            values.push(employeeId);
            
            const query = `
                UPDATE salary_configs 
                SET ${updates.join(', ')}
                WHERE employee_id = $${index}
                RETURNING *
            `;
            
            console.log('📤 UPDATE Query:', query);
            console.log('📋 Values:', values);
            
            const { rows } = await db.query(query, values);
            
            if (rows.length === 0) {
                throw new Error('Configuration non trouvée');
            }
            
            return rows[0];
            
        } catch (error) {
            console.error('Erreur updateSalaryConfig:', error);
            throw error;
        }
    }

    // VALIDATION DES DONNÉES
    static validateSalaryConfig(data) {
        const errors = [];
        
        // Validation obligatoire
        if (!data.employee_id || data.employee_id.trim() === '') {
            errors.push('ID employé requis');
        }
        
        if (!data.base_salary || isNaN(data.base_salary) || data.base_salary <= 0) {
            errors.push('Salaire de base doit être un nombre positif');
        }
        
        // Validation optionnelle
        if (data.tax_rate && (isNaN(data.tax_rate) || data.tax_rate < 0 || data.tax_rate > 100)) {
            errors.push('Taux de taxe doit être entre 0 et 100%');
        }
        
        if (data.social_security_rate && (isNaN(data.social_security_rate) || data.social_security_rate < 0 || data.social_security_rate > 100)) {
            errors.push('Taux sécurité sociale doit être entre 0 et 100%');
        }
        
        if (data.bonus_variable && (isNaN(data.bonus_variable) || data.bonus_variable < 0 || data.bonus_variable > 100)) {
            errors.push('Bonus variable doit être entre 0 et 100%');
        }
        
        if (errors.length > 0) {
            throw new Error(`VALIDATION_ERROR: ${errors.join(', ')}`);
        }
        
        return true;
    }

    // RÉCUPÉRER LA CONFIGURATION D'UN EMPLOYÉ
    static async getSalaryConfig(employeeId) {
        try {
            const { rows } = await db.query(
                `SELECT sc.*, 
                    e.first_name, e.last_name, e.department, e.position,
                    e.email, e.status as employee_status
                FROM salary_configs sc
                LEFT JOIN employees e ON sc.employee_id = e.employee_id
                WHERE sc.employee_id = $1`,
                [employeeId]
            );
            
            if (rows.length === 0) {
                // Vérifier si l'employé existe quand même
                const employeeCheck = await db.query(
                    'SELECT employee_id, first_name, last_name FROM employees WHERE employee_id = $1',
                    [employeeId]
                );
                
                if (employeeCheck.rows.length === 0) {
                    return {
                        exists: false,
                        employee_exists: false,
                        message: `Employé avec ID "${employeeId}" non trouvé`
                    };
                }
                
                // Employé existe mais pas de configuration
                return {
                    exists: false,
                    employee_exists: true,
                    employee: employeeCheck.rows[0],
                    message: 'Aucune configuration salariale trouvée'
                };
            }
            
            return {
                ...rows[0],
                exists: true,
                employee_exists: true
            };
            
        } catch (error) {
            console.error('Erreur getSalaryConfig:', error);
            throw error;
        }
    }

    // RÉCUPÉRER TOUS LES EMPLOYÉS AVEC CONFIGURATION
    static async getAvailableEmployees() {
        const query = `
            SELECT 
                e.id, 
                e.employee_id, 
                e.first_name, 
                e.last_name, 
                e.department, 
                e.position,
                e.email, 
                e.status, 
                e.is_active,
                sc.id as config_id,
                sc.base_salary,
                CASE 
                    WHEN sc.id IS NOT NULL THEN true 
                    ELSE false 
                END as has_salary_config
            FROM employees e
            LEFT JOIN salary_configs sc ON e.employee_id = sc.employee_id
            WHERE e.is_active = true
            ORDER BY e.last_name, e.first_name
        `;
        
        try {
            const { rows } = await db.query(query);
            return rows;
        } catch (error) {
            console.error('Erreur getAvailableEmployees:', error);
            throw error;
        }
    }

    // Créer un mois de paie
    static async createPayMonth(data) {
        const query = `
            INSERT INTO pay_months (
                month_year, month_name, start_date, end_date, status,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (month_year) DO UPDATE SET
                month_name = EXCLUDED.month_name,
                start_date = EXCLUDED.start_date,
                end_date = EXCLUDED.end_date,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;
        
        const values = [
            data.month_year, 
            data.month_name || `Mois ${data.month_year}`,
            data.start_date, 
            data.end_date, 
            data.status || 'draft'
        ];
        
        const { rows } = await db.query(query, values);
        return rows[0];
    }

    // Calculer le salaire pour un employé
    static async calculateSalary(employeeId, monthYear) {
        // Récupérer la configuration du salaire
        const salaryConfig = await this.getSalaryConfig(employeeId);
        if (!salaryConfig || !salaryConfig.exists) {
            throw new Error(`Configuration salariale non trouvée pour ${employeeId}`);
        }

        // Récupérer les pointages du mois
        const attendance = await this.getMonthlyAttendance(employeeId, monthYear);
        
        // Calculer les composants
        const calculations = this.calculateSalaryComponents(salaryConfig, attendance);
        
        // Créer l'enregistrement de paiement
        const payment = await this.createSalaryPayment({
            employee_id: employeeId,
            month_year: monthYear,
            ...calculations
        });

        return payment;
    }

    // Récupérer les pointages mensuels
    static async getMonthlyAttendance(employeeId, monthYear) {
        const query = `
            SELECT 
                COUNT(*) as total_days,
                SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
                SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
                SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days,
                SUM(CASE WHEN check_out_time IS NULL THEN 1 ELSE 0 END) as incomplete_days,
                AVG(hours_worked) as avg_hours_worked,
                SUM(hours_worked) as total_hours_worked
            FROM attendance 
            WHERE employee_id = $1 
            AND DATE_TRUNC('month', record_date) = DATE_TRUNC('month', $2::DATE)
        `;
        
        try {
            const { rows } = await db.query(query, [employeeId, monthYear + '-01']);
            return rows[0] || {
                total_days: 0,
                present_days: 0,
                absent_days: 0,
                late_days: 0,
                incomplete_days: 0,
                avg_hours_worked: 0,
                total_hours_worked: 0
            };
        } catch (error) {
            console.error('Erreur getMonthlyAttendance:', error);
            return {
                total_days: 0,
                present_days: 0,
                absent_days: 0,
                late_days: 0,
                incomplete_days: 0,
                avg_hours_worked: 0,
                total_hours_worked: 0
            };
        }
    }

    // Calculer les composants du salaire
    static calculateSalaryComponents(config, attendance) {
        const baseSalary = parseFloat(config.base_salary) || 0;
        const daysInMonth = 22; // Jours ouvrables standard
        
        // Jours travaillés
        const daysWorked = parseInt(attendance.present_days) || 0;
        const daysAbsent = parseInt(attendance.absent_days) || 0;
        
        // Salaire de base proportionnel
        const baseAmount = (baseSalary / daysInMonth) * daysWorked;
        
        // Heures supplémentaires
        const overtimeHours = parseFloat(attendance.total_hours_worked) - (daysWorked * 8);
        const overtimeRate = 1.5; // Taux heures supp (150%)
        const overtimeAmount = overtimeHours > 0 ? 
            (overtimeHours * (baseSalary / (daysInMonth * 8)) * overtimeRate) : 0;
        
        // Bonus
        const bonusAmount = (config.bonus_fixed || 0) + 
            ((config.bonus_variable || 0) / 100 * baseAmount);
        
        // Déductions pour absences
        const absenceDeduction = daysAbsent * (baseSalary / daysInMonth);
        
        // Taxes et charges
        const taxRate = config.tax_rate || 0;
        const ssRate = config.social_security_rate || 0;
        const otherDeductions = config.other_deductions || 0;
        
        const taxAmount = (baseAmount * taxRate) / 100;
        const ssAmount = (baseAmount * ssRate) / 100;
        const totalDeductions = absenceDeduction + taxAmount + ssAmount + otherDeductions;
        
        // Salaire net
        const netSalary = baseAmount + overtimeAmount + bonusAmount - totalDeductions;
        
        return {
            base_salary: baseSalary,
            days_worked: daysWorked,
            days_absent: daysAbsent,
            days_present: daysWorked,
            late_days: attendance.late_days || 0,
            overtime_hours: overtimeHours > 0 ? overtimeHours : 0,
            overtime_amount: overtimeAmount,
            bonus_amount: bonusAmount,
            deduction_amount: totalDeductions,
            tax_amount: taxAmount,
            net_salary: netSalary > 0 ? netSalary : 0
        };
    }

    // Créer un paiement
    static async createSalaryPayment(data) {
        const query = `
            INSERT INTO salary_payments (
                employee_id, month_year, base_salary, days_worked,
                days_absent, days_present, late_days, overtime_hours,
                overtime_amount, bonus_amount, deduction_amount,
                tax_amount, net_salary, payment_status,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (employee_id, month_year) DO UPDATE SET
                base_salary = EXCLUDED.base_salary,
                days_worked = EXCLUDED.days_worked,
                days_absent = EXCLUDED.days_absent,
                days_present = EXCLUDED.days_present,
                late_days = EXCLUDED.late_days,
                overtime_hours = EXCLUDED.overtime_hours,
                overtime_amount = EXCLUDED.overtime_amount,
                bonus_amount = EXCLUDED.bonus_amount,
                deduction_amount = EXCLUDED.deduction_amount,
                tax_amount = EXCLUDED.tax_amount,
                net_salary = EXCLUDED.net_salary,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;
        
        const values = [
            data.employee_id, 
            data.month_year, 
            data.base_salary,
            data.days_worked, 
            data.days_absent, 
            data.days_present,
            data.late_days, 
            data.overtime_hours, 
            data.overtime_amount,
            data.bonus_amount, 
            data.deduction_amount, 
            data.tax_amount,
            data.net_salary, 
            data.payment_status || 'pending'
        ];
        
        const { rows } = await db.query(query, values);
        
        // Ajouter les composants détaillés
        if (rows[0]) {
            await this.addSalaryComponents(rows[0].id, data);
        }
        
        return rows[0];
    }

    // Ajouter des composants détaillés
    static async addSalaryComponents(paymentId, data) {
        try {
            const components = [
                { type: 'base', name: 'Salaire de base', amount: data.base_salary },
                { type: 'overtime', name: 'Heures supplémentaires', amount: data.overtime_amount || 0 },
                { type: 'bonus', name: 'Bonus', amount: data.bonus_amount || 0 },
                { type: 'deduction', name: 'Déductions', amount: data.deduction_amount || 0 },
                { type: 'tax', name: 'Impôts', amount: data.tax_amount || 0 }
            ];
            
            for (const comp of components) {
                if (comp.amount > 0) {
                    await db.query(`
                        INSERT INTO salary_components 
                        (payment_id, component_type, component_name, amount, created_at)
                        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                    `, [paymentId, comp.type, comp.name, comp.amount]);
                }
            }
        } catch (error) {
            console.error('Erreur addSalaryComponents:', error);
            // Ne pas bloquer le processus principal
        }
    }

    // AUTRES MÉTHODES UTILES
    static async getPayMonth(monthYear) {
        const { rows } = await db.query(
            'SELECT * FROM pay_months WHERE month_year = $1',
            [monthYear]
        );
        return rows[0];
    }

    static async getEmployeePayments(employeeId, limit = 12) {
        const query = `
            SELECT sp.*, 
                   pm.month_name, pm.start_date, pm.end_date,
                   e.first_name, e.last_name, e.department, e.position,
                   e.email as employee_email
            FROM salary_payments sp
            JOIN pay_months pm ON sp.month_year = pm.month_year
            JOIN employees e ON sp.employee_id = e.employee_id
            WHERE sp.employee_id = $1
            ORDER BY pm.start_date DESC
            LIMIT $2
        `;
        
        const { rows } = await db.query(query, [employeeId, limit]);
        return rows;
    }

    static async getMonthlyPayments(monthYear) {
        const query = `
            SELECT sp.*, 
                   e.first_name, e.last_name, e.department, 
                   e.position, e.email as employee_email,
                   sc.base_salary as base_salary_rate
            FROM salary_payments sp
            JOIN employees e ON sp.employee_id = e.employee_id
            LEFT JOIN salary_configs sc ON sp.employee_id = sc.employee_id
            WHERE sp.month_year = $1
            ORDER BY e.last_name, e.first_name
        `;
        
        const { rows } = await db.query(query, [monthYear]);
        return rows;
    }

    // MÉTHODE POUR TESTER LA CONNEXION À LA BASE
    static async testConnection() {
        try {
            const result = await db.query('SELECT NOW() as current_time');
            console.log('✅ Connexion BD OK:', result.rows[0].current_time);
            return true;
        } catch (error) {
            console.error('❌ Erreur connexion BD:', error.message);
            return false;
        }
    }
}

module.exports = PayrollModel;