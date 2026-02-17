// backend/src/controllers/notificationController.js 
const db = require('../../config/db');

class NotificationController {
    // ============================================
    // CRÉER UNE NOTIFICATION
    // ============================================
    async createNotification(req, res) {
        try {
            const { userId, title, message, type = 'info', link, priority = 'medium', metadata = {} } = req.body;
            
            console.log('🔔 Création notification:', { userId, title, type });
            
            // Validation
            if (!userId || !title || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'userId, title et message sont requis'
                });
            }
            
            // Vérifier si l'utilisateur existe
            const userCheck = await db.query('SELECT id FROM employees WHERE id = $1', [userId]);
            if (userCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Utilisateur non trouvé'
                });
            }
            
            // Insertion
            const result = await db.query(`
                INSERT INTO notifications 
                (user_id, title, message, type, link, read_status, priority, metadata, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, false, $6, $7, NOW(), NOW())
                RETURNING *
            `, [
                userId, 
                title, 
                message, 
                type, 
                link || null,
                priority,
                JSON.stringify(metadata)
            ]);
            
            // WebSocket pour notifications en temps réel
            if (global.io) {
                global.io.to(`user_${userId}`).emit('new_notification', result.rows[0]);
            }
            
            res.status(201).json({
                success: true,
                message: 'Notification créée avec succès',
                data: result.rows[0]
            });
            
        } catch (error) {
            console.error('❌ Erreur création notification:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la création de la notification',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // ============================================
    // RÉCUPÉRER LES NOTIFICATIONS
    // ============================================
    async getUserNotifications(req, res) {
    try {
        const userId = req.user?.id || req.user?.user_id;
        const userRole = req.user?.role;
        const userDepartment = req.user?.department;
        const userEmail = req.user?.email;
        
        console.log(`📱 Notifications demandées par: ${userEmail} (${userRole})`);
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Utilisateur non identifié'
            });
        }
        
        const { limit = 50, offset = 0, unreadOnly = false } = req.query;
        
        let query;
        let params = [];
        let paramIndex = 1;
        
        // ===== CAS 1: ADMIN - voit TOUTES les notifications =====
        if (userRole === 'admin') {
            console.log(`👑 ADMIN ${userEmail} - Accès à TOUTES les notifications`);
            
            query = `
                SELECT 
                    n.*,
                    e.email as user_email,
                    e.first_name,
                    e.last_name,
                    e.employee_id,
                    e.department,
                    e.position,
                    e.status
                FROM notifications n
                LEFT JOIN employees e ON n.user_id = e.id
                WHERE 1=1
            `;
            
            if (unreadOnly === 'true') {
                query += ' AND n.read_status = false';
            }
            
            query += ' ORDER BY n.created_at DESC LIMIT $1 OFFSET $2';
            params = [parseInt(limit), parseInt(offset)];
        }
        
        // ===== CAS 2: MANAGER - voit UNIQUEMENT son département =====
        else if (userRole === 'manager') {
            console.log(`👔 MANAGER ${userEmail} - Accès aux notifications du département: ${userDepartment}`);
            
            if (!userDepartment) {
                console.warn('⚠️ Manager sans département - notifications système uniquement');
                query = `
                    SELECT 
                        n.*,
                        e.email as user_email,
                        e.first_name,
                        e.last_name,
                        e.employee_id,
                        e.department,
                        e.position,
                        e.status
                    FROM notifications n
                    LEFT JOIN employees e ON n.user_id = e.id
                    WHERE n.is_system = true  -- Notifications système seulement
                `;
            } else {
                // ===== FILTRE CRITIQUE =====
                query = `
                    SELECT 
                        n.*,
                        e.email as user_email,
                        e.first_name,
                        e.last_name,
                        e.employee_id,
                        e.department,
                        e.position,
                        e.status
                    FROM notifications n
                    LEFT JOIN employees e ON n.user_id = e.id
                    WHERE e.department = $${paramIndex}  -- FILTRE PAR DÉPARTEMENT
                       OR (n.is_system = true AND n.user_id IS NULL)  -- Notifications système
                `;
                params.push(userDepartment);
                paramIndex++;
                
                if (unreadOnly === 'true') {
                    query += ` AND n.read_status = false`;
                }
                
                query += ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
                params.push(parseInt(limit), parseInt(offset));
            }
        }
        
        // ===== CAS 3: EMPLOYÉ - voit seulement ses notifications =====
        else {
            console.log(`👤 Employé ${userEmail} - Accès à ses notifications seulement`);
            
            query = `
                SELECT 
                    n.*,
                    e.email as user_email,
                    e.first_name,
                    e.last_name,
                    e.employee_id,
                    e.department,
                    e.position,
                    e.status
                FROM notifications n
                LEFT JOIN employees e ON n.user_id = e.id
                WHERE n.user_id = $${paramIndex}
            `;
            params.push(userId);
            paramIndex++;
            
            if (unreadOnly === 'true') {
                query += ` AND n.read_status = false`;
            }
            
            query += ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(parseInt(limit), parseInt(offset));
        }
        
        const result = await db.query(query, params);
        
        // ===== COMPTER LES NON LUES AVEC LE MÊME FILTRE =====
        let unreadQuery;
        let unreadParams = [];
        
        if (userRole === 'admin') {
            unreadQuery = 'SELECT COUNT(*) as count FROM notifications WHERE read_status = false';
            unreadParams = [];
        }
        else if (userRole === 'manager' && userDepartment) {
            unreadQuery = `
                SELECT COUNT(*) as count 
                FROM notifications n
                LEFT JOIN employees e ON n.user_id = e.id
                WHERE e.department = $1 
                   OR (n.is_system = true AND n.user_id IS NULL)
                AND n.read_status = false
            `;
            unreadParams = [userDepartment];
        }
        else {
            unreadQuery = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read_status = false';
            unreadParams = [userId];
        }
        
        const unreadResult = await db.query(unreadQuery, unreadParams);
        const unreadCount = parseInt(unreadResult.rows[0].count) || 0;
        
        console.log(`📋 ${result.rows.length} notifications récupérées (${unreadCount} non lues) pour ${userRole} ${userEmail} ${userRole === 'manager' ? `(dépt: ${userDepartment})` : ''}`);
        
        // Headers pour empêcher la cache
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        res.json({
            success: true,
            data: result.rows,
            meta: {
                total: result.rows.length,
                unreadCount: unreadCount,
                limit: parseInt(limit),
                offset: parseInt(offset),
                userRole: userRole,
                userDepartment: userDepartment,
                viewType: userRole === 'admin' ? 'all' : (userRole === 'manager' ? 'department' : 'personal'),
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur récupération notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des notifications',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

    // ============================================
    // MARQUER UNE NOTIFICATION COMME LUE
    // ============================================
    async markAsRead(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user?.id || req.user?.user_id;
            const userRole = req.user?.role;
            
            console.log('🔔 Marquer comme lu:', { id, userId, role: userRole });
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Utilisateur non identifié'
                });
            }
            
            // Convertir l'ID
            let notificationId = parseInt(id);
            if (isNaN(notificationId)) {
                const numericId = id.replace(/\D/g, '');
                if (!numericId) {
                    return res.status(400).json({
                        success: false,
                        message: 'ID de notification invalide'
                    });
                }
                notificationId = parseInt(numericId);
            }
            
            // Vérifier si la notification existe et les permissions
            const checkQuery = 'SELECT id, user_id, read_status FROM notifications WHERE id = $1';
            const checkResult = await db.query(checkQuery, [notificationId]);
            
            if (checkResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Notification non trouvée'
                });
            }
            
            const notification = checkResult.rows[0];
            
            // Vérifier les permissions
            if (userRole !== 'admin' && userRole !== 'manager' && notification.user_id !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Non autorisé à modifier cette notification'
                });
            }
            
            // Si déjà lue, retourner succès
            if (notification.read_status === true) {
                return res.json({
                    success: true,
                    message: 'Notification déjà lue',
                    data: notification
                });
            }
            
            // Mettre à jour
            const query = `
                UPDATE notifications 
                SET read_status = true, read_at = NOW(), updated_at = NOW()
                WHERE id = $1
                RETURNING *
            `;
            
            const result = await db.query(query, [notificationId]);
            
            console.log(`✅ Notification ${notificationId} marquée comme lue`);
            
            res.json({
                success: true,
                message: 'Notification marquée comme lue',
                data: result.rows[0],
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Erreur marquer comme lu:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors du marquage de la notification',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // ============================================
    // MARQUER TOUTES LES NOTIFICATIONS COMME LUES
    // ============================================
    async markAllAsRead(req, res) {
        try {
            const userId = req.user?.id || req.user?.user_id;
            const userRole = req.user?.role;
            
            console.log(`🔔 Marquer toutes comme lues pour: ${userId} (${userRole})`);
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Utilisateur non identifié'
                });
            }
            
            let query;
            let countQuery;
            let params;
            
            if (userRole === 'admin' || userRole === 'manager') {
                countQuery = 'SELECT COUNT(*) as count FROM notifications WHERE read_status = false';
                query = `
                    UPDATE notifications 
                    SET read_status = true, read_at = NOW(), updated_at = NOW()
                    WHERE read_status = false
                `;
                params = [];
            } else {
                countQuery = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read_status = false';
                query = `
                    UPDATE notifications 
                    SET read_status = true, read_at = NOW(), updated_at = NOW()
                    WHERE user_id = $1 AND read_status = false
                `;
                params = [userId];
            }
            
            // 1. Compter combien de notifications seront mises à jour
            const countResult = await db.query(countQuery, params);
            const rowsToUpdate = parseInt(countResult.rows[0].count) || 0;
            
            console.log(`📊 ${rowsToUpdate} notifications à marquer comme lues`);
            
            // 2. Mettre à jour si nécessaire
            let updatedCount = 0;
            if (rowsToUpdate > 0) {
                await db.query(query, params);
                updatedCount = rowsToUpdate;
            }
            
            console.log(`✅ ${updatedCount} notifications marquées comme lues`);
            
            res.json({
                success: true,
                message: `${updatedCount} notification(s) marquée(s) comme lue(s)`,
                data: {
                    updatedCount: updatedCount,
                    timestamp: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('❌ Erreur marquer toutes comme lues:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors du marquage des notifications',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // ============================================
    // COMPTER LES NOTIFICATIONS NON LUES
    // ============================================
    async getUnreadCount(req, res) {
        try {
            const userId = req.user?.id || req.user?.user_id;
            const userRole = req.user?.role;
            
            console.log('🔔 Compter non lues pour:', { userId, role: userRole });
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Utilisateur non identifié'
                });
            }
            
            let query;
            let params;
            
            if (userRole === 'admin' || userRole === 'manager') {
                query = 'SELECT COUNT(*) as count FROM notifications WHERE read_status = false';
                params = [];
            } else {
                query = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read_status = false';
                params = [userId];
            }
            
            const result = await db.query(query, params);
            
            const unreadCount = parseInt(result.rows[0].count) || 0;
            
            console.log(`📊 ${unreadCount} notifications non lues`);
            
            res.json({
                success: true,
                data: {
                    unreadCount: unreadCount,
                    hasUnread: unreadCount > 0,
                    timestamp: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('❌ Erreur comptage non lues:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors du comptage des notifications',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // ============================================
    // SUPPRIMER UNE NOTIFICATION
    // ============================================
    async deleteNotification(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user?.id || req.user?.user_id;
        const userRole = req.user?.role;
        
        console.log('🔔 SUPPRIMER NOTIFICATION - Début');
        console.log('📌 ID reçu:', id);
        console.log('👤 Utilisateur:', { userId, userRole });
        
        if (!userId) {
            console.log('❌ Erreur: Utilisateur non identifié');
            return res.status(400).json({
                success: false,
                message: 'Utilisateur non identifié'
            });
        }
        
        // Convertir l'ID
        const notificationId = parseInt(id);
        console.log('📌 ID converti:', notificationId);
        
        if (isNaN(notificationId)) {
            console.log('❌ Erreur: ID invalide');
            return res.status(400).json({
                success: false,
                message: 'ID de notification invalide'
            });
        }
        
        // Vérifier si la notification existe
        console.log('🔍 Vérification existence notification...');
        const checkQuery = 'SELECT id, user_id, title FROM notifications WHERE id = $1';
        const checkResult = await db.query(checkQuery, [notificationId]);
        
        console.log('📊 Résultat vérification:', checkResult.rows);
        
        if (checkResult.rows.length === 0) {
            console.log('❌ Notification non trouvée');
            return res.status(404).json({
                success: false,
                message: 'Notification non trouvée'
            });
        }
        
        const notification = checkResult.rows[0];
        console.log('📌 Notification trouvée:', notification);
        
        // Vérifier les permissions
        if (userRole !== 'admin' && userRole !== 'manager' && notification.user_id !== userId) {
            console.log('❌ Permission refusée');
            return res.status(403).json({
                success: false,
                message: 'Non autorisé à supprimer cette notification'
            });
        }
        
        // Supprimer
        let query;
        let params;
        
        if (userRole === 'admin' || userRole === 'manager') {
            query = 'DELETE FROM notifications WHERE id = $1 RETURNING *';
            params = [notificationId];
        } else {
            query = 'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *';
            params = [notificationId, userId];
        }
        
        console.log('🔍 Exécution DELETE:', query);
        console.log('🔍 Paramètres:', params);
        
        const result = await db.query(query, params);
        
        console.log('✅ DELETE réussi');
        console.log('📊 Lignes affectées:', result.rows.length);
        console.log('📌 Notification supprimée:', result.rows[0]);
        
        res.json({
            success: true,
            message: 'Notification supprimée',
            data: result.rows[0],
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Erreur suppression notification:', error);
        console.error('📌 Détails erreur:', {
            message: error.message,
            code: error.code,
            detail: error.detail
        });
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de la notification',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

    // ============================================
    // CRÉER UNE NOTIFICATION SYSTÈME (INTERNE)
    // ============================================
    async createSystemNotification(notificationData) {
        try {
            const { userId, title, message, type = 'info', link, priority = 'medium', metadata = {} } = notificationData;
            
            console.log('🤖 Création notification système:', { userId, title, type });
            
            if (!userId || !title || !message) {
                throw new Error('Paramètres manquants pour notification système');
            }
            
            // Vérifier si l'utilisateur existe
            const userCheck = await db.query('SELECT id FROM employees WHERE id = $1', [userId]);
            if (userCheck.rows.length === 0) {
                throw new Error(`Utilisateur ${userId} non trouvé`);
            }
            
            const result = await db.query(`
                INSERT INTO notifications 
                (user_id, title, message, type, link, read_status, priority, is_system, metadata, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, false, $6, true, $7, NOW(), NOW())
                RETURNING *
            `, [
                userId, 
                title, 
                message, 
                type, 
                link || null,
                priority,
                JSON.stringify(metadata)
            ]);
            
            // WebSocket
            if (global.io) {
                global.io.to(`user_${userId}`).emit('new_notification', result.rows[0]);
            }
            
            return result.rows[0];
            
        } catch (error) {
            console.error('❌ Erreur notification système:', error);
            return null;
        }
    }

    // ============================================
    // CRÉER DES NOTIFICATIONS POUR TOUS LES EMPLOYÉS
    // ============================================
    async createNotificationForAllEmployees(req, res) {
        try {
            const { title, message, type = 'info', link, priority = 'medium' } = req.body;
            const userRole = req.user?.role;
            
            console.log('🌍 Création notification pour tous les employés:', { title, type });
            
            // Seuls les admins/managers peuvent faire ça
            if (!['admin', 'manager'].includes(userRole)) {
                return res.status(403).json({
                    success: false,
                    message: 'Non autorisé'
                });
            }
            
            if (!title || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'title et message sont requis'
                });
            }
            
            // Récupérer tous les employés actifs
            const employees = await db.query(`
                SELECT id FROM employees 
                WHERE status = 'active' 
                AND deleted_at IS NULL
            `);
            
            const notificationsCreated = [];
            
            // Créer une notification pour chaque employé
            for (const employee of employees.rows) {
                const notification = await this.createSystemNotification({
                    userId: employee.id,
                    title,
                    message,
                    type,
                    link,
                    priority,
                    metadata: { broadcast: true }
                });
                
                if (notification) {
                    notificationsCreated.push(notification.id);
                }
            }
            
            res.json({
                success: true,
                message: `${notificationsCreated.length} notification(s) créée(s) pour tous les employés`,
                data: {
                    count: notificationsCreated.length,
                    notificationIds: notificationsCreated
                }
            });
            
        } catch (error) {
            console.error('❌ Erreur création notifications pour tous:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la création des notifications',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // ============================================
    // NETTOYER LES ANCIENNES NOTIFICATIONS
    // ============================================
    async cleanupOldNotifications(req, res) {
        try {
            const userRole = req.user?.role;
            const { days = 30 } = req.query;
            
            console.log(`🗑️  Nettoyage notifications > ${days} jours`);
            
            // Seuls les admins
            if (userRole !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin seulement'
                });
            }
            
            const result = await db.query(`
                DELETE FROM notifications 
                WHERE created_at < NOW() - INTERVAL '${days} days'
                AND is_system = true
                RETURNING COUNT(*) as deleted_count
            `);
            
            const deletedCount = parseInt(result.rows[0].deleted_count) || 0;
            
            console.log(`✅ ${deletedCount} anciennes notifications supprimées`);
            
            res.json({
                success: true,
                message: `${deletedCount} ancienne(s) notification(s) supprimée(s)`,
                data: {
                    deletedCount,
                    days
                }
            });
            
        } catch (error) {
            console.error('❌ Erreur nettoyage notifications:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors du nettoyage',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = new NotificationController();