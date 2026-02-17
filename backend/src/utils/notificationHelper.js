// backend/src/utils/notificationHelper.js - VERSION FINALE CORRIGÉE getUserNotifications
const db = require('../../config/db');

class NotificationHelper {
    
    /**
     * Créer une notification personnalisée
     */
    static async createNotification(userId, title, message, type = 'info', metadata = {}) {
        try {
            console.log(`📢 Création notification: ${title} pour userId: ${userId} (type: ${typeof userId})`);
            
            // Vérifier si userId est valide (non-null et numérique)
            const validUserId = userId && !isNaN(parseInt(userId)) ? parseInt(userId) : null;
            
            if (!validUserId) {
                console.log('⚠️ userId invalide ou null, création notification système');
                return await this.createSystemNotification(title, message, type, 'medium', metadata);
            }
            
            const query = `
                INSERT INTO notifications (
                    user_id,
                    title,
                    message,
                    type,
                    metadata,
                    read_status,
                    created_at,
                    updated_at
                ) VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
                RETURNING *
            `;
            
            const result = await db.query(query, [
                validUserId, 
                title, 
                message, 
                type, 
                JSON.stringify(metadata)
            ]);
            
            console.log(`✅ Notification créée avec ID: ${result.rows[0].id} pour user ${validUserId}`);
            return {
                success: true,
                notification: result.rows[0]
            };
            
        } catch (error) {
            console.error('❌ Erreur création notification:', error.message);
            // Retourner une notification système en cas d'erreur
            return await this.createSystemNotification(
                title, 
                message, 
                type, 
                'medium', 
                metadata
            );
        }
    }
    
    /**
     * Créer une notification système
     */
    static async createSystemNotification(title, message, type = 'system', priority = 'medium', metadata = {}) {
        try {
            console.log(`📢 Notification système: ${title}`);
            
            const query = `
                INSERT INTO notifications (
                    title,
                    message,
                    type,
                    priority,
                    read_status,
                    is_system,
                    metadata,
                    created_at,
                    updated_at
                ) VALUES ($1, $2, $3, $4, false, true, $5, NOW(), NOW())
                RETURNING *
            `;
            
            const result = await db.query(query, [
                title, 
                message, 
                type, 
                priority,
                JSON.stringify(metadata)
            ]);
            
            console.log(`✅ Notification système créée avec ID: ${result.rows[0].id}`);
            return {
                success: true,
                notification: result.rows[0]
            };
            
        } catch (error) {
            console.error('❌ Erreur notification système:', error.message);
            // Même en cas d'erreur, retourner un succès pour ne pas bloquer
            return {
                success: true,
                warning: 'Notification simulée',
                notification: {
                    id: Date.now(),
                    title: title,
                    message: message,
                    created_at: new Date()
                }
            };
        }
    }
    
    /**
     * Notification quand un pointage est créé - VERSION CORRIGÉE DÉFINITIVE
     */
    static async attendanceCreated(employeeIdentifier, checkType, time = null) {
        try {
            console.log(`📢 Notification pointage: ${checkType} pour ${employeeIdentifier}`);
            
            // 1. TOUJOURS convertir en nombre si possible (car employees.id est integer)
            let employeeId = null;
            
            if (typeof employeeIdentifier === 'number') {
                employeeId = employeeIdentifier;
            } else if (typeof employeeIdentifier === 'string' && !isNaN(parseInt(employeeIdentifier))) {
                employeeId = parseInt(employeeIdentifier);
            }
            
            // 2. Si on a un ID numérique, chercher directement par id
            if (employeeId !== null) {
                console.log(`🔍 Recherche par ID numérique: ${employeeId}`);
                const result = await db.query(
                    'SELECT id, employee_id, first_name, last_name, email FROM employees WHERE id = $1',
                    [employeeId]
                );
                
                if (result.rows.length > 0) {
                    return await this.createEmployeeNotification(result.rows[0], checkType, time);
                }
            }
            
            // 3. Sinon, chercher par employee_id (EMP009)
            console.log(`🔍 Recherche par employee_id: ${employeeIdentifier}`);
            const result = await db.query(
                'SELECT id, employee_id, first_name, last_name, email FROM employees WHERE employee_id = $1',
                [employeeIdentifier.toString()]
            );
            
            if (result.rows.length > 0) {
                return await this.createEmployeeNotification(result.rows[0], checkType, time);
            }
            
            // 4. Si aucun employé trouvé, créer une notification système
            console.warn(`⚠️ Employé non trouvé: ${employeeIdentifier}`);
            return await this.createSystemNotification(
                `Pointage ${checkType === 'check_in' ? 'd\'arrivée' : 'de départ'}`,
                `Pointage enregistré pour ${employeeIdentifier} à ${time || '--:--'}`,
                'attendance',
                'medium',
                {
                    employeeIdentifier: employeeIdentifier,
                    checkType: checkType,
                    time: time
                }
            );
            
        } catch (error) {
            console.error('❌ Erreur notification pointage:', error.message);
            // Ne pas bloquer le flux en cas d'erreur
            return {
                success: true,
                warning: 'Notification non créée mais pointage enregistré',
                error: error.message
            };
        }
    }
    
    /**
     * Helper pour créer la notification employé
     */
    static async createEmployeeNotification(employee, checkType, time = null) {
        console.log(`👤 Notification pour: ${employee.first_name} ${employee.last_name} (ID: ${employee.id})`);
        
        const currentTime = time || new Date().toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        let title, message;
        if (checkType === 'check_in' || checkType === 'arrival') {
            title = '📅 Arrivée enregistrée';
            message = `Bonjour ${employee.first_name}, votre arrivée a été enregistrée à ${currentTime}`;
        } else if (checkType === 'check_out' || checkType === 'departure') {
            title = '🏠 Départ enregistré';
            message = `Au revoir ${employee.first_name}, votre départ a été enregistré à ${currentTime}`;
        } else {
            title = '📊 Pointage enregistré';
            message = `Votre pointage a été enregistré à ${currentTime}`;
        }
        
        // Utiliser l'ID numérique de l'employé (employee.id est integer)
        return await this.createNotification(
            employee.id,  // ← C'EST LÀ QU'IL FAUT L'ID NUMÉRIQUE !
            title,
            message,
            'attendance',
            {
                employeeId: employee.employee_id,
                employeeName: `${employee.first_name} ${employee.last_name}`,
                checkType: checkType,
                time: currentTime,
                date: new Date().toISOString().split('T')[0]
            }
        );
    }
    
    /**
     * Alias pour compatibilité
     */
    static async createAttendanceNotification(employeeId, type, time = null, metadata = {}) {
        console.log(`📢 [Alias] createAttendanceNotification pour ${employeeId}, type: ${type}`);
        
        let mappedType = type;
        if (type === 'checkin' || type === 'checkin_manual') {
            mappedType = 'check_in';
        } else if (type === 'checkout' || type === 'checkout_manual') {
            mappedType = 'check_out';
        }
        
        return this.attendanceCreated(employeeId, mappedType, time);
    }
    
    /**
     * Récupérer les notifications d'un utilisateur
     */
    static async getUserNotifications(userId, limit = 50, includeSystem = true, userRole = null, userDepartment = null) {
    try {
        console.log(`📢 Récupération notifications pour userId: ${userId}, rôle: ${userRole}, département: ${userDepartment}`);
        
        const validUserId = userId && !isNaN(parseInt(userId)) ? parseInt(userId) : null;
        
        let query;
        let params = [];
        
        // ===== CAS 1: ADMIN - voit toutes les notifications =====
        if (userRole === 'admin') {
            console.log('👑 ADMIN - Accès à TOUTES les notifications');
            query = `
                SELECT n.*, e.first_name, e.last_name, e.department, e.employee_id
                FROM notifications n
                LEFT JOIN employees e ON n.user_id = e.id
                ORDER BY n.created_at DESC
                LIMIT $1
            `;
            params = [limit];
        }
        
        // ===== CAS 2: MANAGER - voit uniquement son département =====
        else if (userRole === 'manager' && userDepartment) {
            console.log(`👔 MANAGER - Accès aux notifications du département: ${userDepartment}`);
            query = `
                SELECT n.*, e.first_name, e.last_name, e.department, e.employee_id
                FROM notifications n
                LEFT JOIN employees e ON n.user_id = e.id
                WHERE e.department = $1  -- FILTRE CRITIQUE !
                   OR (n.is_system = true AND n.user_id IS NULL)  -- Notifications système
                ORDER BY n.created_at DESC
                LIMIT $2
            `;
            params = [userDepartment, limit];
        }
        
        // ===== CAS 3: EMPLOYÉ - voit ses propres notifications =====
        else if (validUserId) {
            console.log(`👤 EMPLOYÉ - Accès à ses propres notifications`);
            query = `
                SELECT n.*, e.first_name, e.last_name, e.department, e.employee_id
                FROM notifications n
                LEFT JOIN employees e ON n.user_id = e.id
                WHERE n.user_id = $1
                   OR (n.is_system = true AND n.user_id IS NULL)
                ORDER BY n.created_at DESC
                LIMIT $2
            `;
            params = [validUserId, limit];
        }
        
        // ===== CAS 4: FALLBACK - notifications système seulement =====
        else {
            console.log('⚠️ FALLBACK - Notifications système uniquement');
            query = `
                SELECT n.*, e.first_name, e.last_name, e.department, e.employee_id
                FROM notifications n
                LEFT JOIN employees e ON n.user_id = e.id
                WHERE n.is_system = true
                ORDER BY n.created_at DESC
                LIMIT $1
            `;
            params = [limit];
        }
        
        const result = await db.query(query, params);
        
        console.log(`📋 ${result.rows.length} notifications récupérées pour ${userRole || 'utilisateur'} ${userRole === 'manager' ? `(département: ${userDepartment})` : ''}`);
        
        return {
            success: true,
            notifications: result.rows,
            totalCount: result.rows.length
        };
        
    } catch (error) {
        console.error('❌ Erreur récupération notifications:', error.message);
        return { 
            success: false, 
            error: error.message,
            notifications: [] 
        };
    }
}
    
    /**
     * Marquer une notification comme lue
     */
    static async markAsRead(notificationId, userId) {
        try {
            const validUserId = userId && !isNaN(parseInt(userId)) ? parseInt(userId) : null;
            
            if (!validUserId) {
                return { success: false, message: 'User ID invalide' };
            }
            
            const query = `
                UPDATE notifications 
                SET read_status = true,
                    read_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1 AND (user_id = $2 OR is_system = true)
                RETURNING *
            `;
            
            const result = await db.query(query, [notificationId, validUserId]);
            
            if (result.rows.length === 0) {
                return { success: false, message: 'Notification non trouvée ou non autorisée' };
            }
            
            return { success: true, notification: result.rows[0] };
            
        } catch (error) {
            console.error('❌ Erreur marquer comme lu:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = NotificationHelper;