import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaBell, FaArrowLeft, FaCheck, FaTrash, FaEnvelopeOpen, FaSync } from 'react-icons/fa';
import api from '../services/api';

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState(null);

  // DEBUG: Log des changements d'état
  useEffect(() => {
    console.log('📊 ÉTAT NOTIFICATIONS MIS À JOUR:', {
      total: notifications.length,
      nonLues: notifications.filter(n => !isRead(n)).length,
      détails: notifications.map(n => ({ 
        id: n.id, 
        title: n.title.substring(0, 20) + '...',
        read_status: n.read_status,
        read: n.read 
      }))
    });
  }, [notifications]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Chargement notifications depuis API...');
      const response = await api.get('/notifications');
      console.log('📊 RÉPONSE API COMPLÈTE:', response);
      
      if (response.success) {
        console.log(`✅ ${response.data?.length || 0} notifications reçues`);
        console.log('📋 PREMIÈRE NOTIFICATION:', response.data?.[0] ? {
          id: response.data[0].id,
          read_status: response.data[0].read_status,
          read: response.data[0].read,
          type: typeof response.data[0].read_status
        } : 'Aucune notification');
        
        setNotifications(response.data || []);
      } else {
        console.error('❌ Erreur dans la réponse:', response);
        setError(response.message || 'Erreur lors du chargement');
      }
    } catch (error) {
      console.error('❌ Erreur chargement notifications:', error);
      setError(error.message || 'Impossible de charger les notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const isRead = (notification) => {
    // Convertir en booléen de manière sûre
    const readStatus = notification.read_status;
    const readValue = notification.read;
    
    console.log('🔍 isRead check:', {
      id: notification.id,
      read_status: readStatus,
      read: readValue,
      bool_read_status: Boolean(readStatus),
      bool_read: Boolean(readValue),
      strict_true: readStatus === true,
      string_true: readStatus === 'true',
      number_true: readStatus === 1
    });
    
    return (
      readStatus === true ||
      readStatus === 'true' ||
      readStatus === 1 ||
      readValue === true ||
      readValue === 'true' ||
      readValue === 1
    );
  };

  const handleMarkAsRead = async (id) => {
    const notification = notifications.find(n => n.id === id);
    if (!notification) {
      console.error('❌ Notification non trouvée pour marquer comme lu:', id);
      return;
    }
    
    console.log('📝 MARQUER COMME LU - DÉBUT', {
      id,
      notificationActuelle: {
        id: notification.id,
        read_status: notification.read_status,
        read: notification.read
      }
    });
    
    try {
      setActionLoading(prev => ({ ...prev, [id]: true }));
      
      console.log('📤 Appel API PUT...');
      const response = await api.put(`/notifications/${id}/read`);
      console.log('✅ RÉPONSE API:', response);
      
      if (response.success) {
        console.log('📊 Données retournées:', {
          read_status: response.data?.read_status,
          read_at: response.data?.read_at
        });
        
        // Mise à jour optimiste
        setNotifications(prev => {
          const updated = prev.map(notif => {
            if (notif.id === id) {
              const nouvelleNotif = {
                ...notif,
                read_status: true,
                read_at: response.data?.read_at || new Date().toISOString()
              };
              console.log('🔄 Notification mise à jour:', {
                ancien: { read_status: notif.read_status },
                nouveau: { read_status: nouvelleNotif.read_status }
              });
              return nouvelleNotif;
            }
            return notif;
          });
          
          console.log('📋 Liste après mise à jour:', updated.map(n => ({
            id: n.id,
            read_status: n.read_status
          })));
          
          return updated;
        });
        
        console.log(`✅ Notification ${id} marquée comme lue avec succès`);
      } else {
        console.error('❌ Réponse API non réussie:', response.message);
        setError(response.message || 'Échec de l\'opération');
      }
    } catch (error) {
      console.error('❌ ERREUR marquer comme lu:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setError('Erreur lors du marquage comme lu');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleMarkAllAsRead = async () => {
    console.log('📝 MARQUER TOUTES COMME LUES - DÉBUT');
    
    try {
      setActionLoading(prev => ({ ...prev, 'all': true }));
      
      const response = await api.put('/notifications/read-all');
      console.log('✅ Réponse tout marquer comme lu:', response);
      
      if (response.success) {
        // Mise à jour optimiste de toutes les notifications
        setNotifications(prev => {
          const updated = prev.map(notif => ({
            ...notif,
            read_status: true,
            read_at: notif.read_at || new Date().toISOString()
          }));
          
          console.log('📋 Toutes les notifications mises à jour:', updated.length);
          return updated;
        });
        
        console.log(`✅ ${notifications.length} notifications marquées comme lues`);
      }
    } catch (error) {
      console.error('❌ Erreur tout marquer comme lu:', error);
      setError('Impossible de tout marquer comme lu');
    } finally {
      setActionLoading(prev => ({ ...prev, 'all': false }));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette notification ?')) return;
    
    console.log('🗑️  SUPPRESSION - DÉBUT', { id });
    
    try {
      setActionLoading(prev => ({ ...prev, [`delete_${id}`]: true }));
      
      const response = await api.delete(`/notifications/${id}`);
      console.log('✅ Réponse suppression:', response);
      
      if (response.success) {
        // Suppression optimiste
        setNotifications(prev => {
          const filtered = prev.filter(notif => notif.id !== id);
          console.log('📋 Après suppression:', filtered.length, 'notifications restantes');
          return filtered;
        });
        
        console.log(`✅ Notification ${id} supprimée avec succès`);
      }
    } catch (error) {
      console.error('❌ Erreur suppression:', error);
      setError('Impossible de supprimer la notification');
    } finally {
      setActionLoading(prev => ({ ...prev, [`delete_${id}`]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <span className="text-gray-600">Chargement des notifications...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Link to="/dashboard" className="mr-4 text-gray-600 hover:text-gray-900">
              <FaArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold flex items-center">
              <FaBell className="w-6 h-6 mr-3 text-blue-500" />
              Notifications
            </h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={loadNotifications}
              disabled={loading}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              title="Rafraîchir"
            >
              <FaSync className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            {notifications.length > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={actionLoading['all']}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center"
              >
                <FaEnvelopeOpen className="w-4 h-4 mr-2" />
                {actionLoading['all'] ? 'Traitement...' : 'Tout marquer comme lu'}
              </button>
            )}
          </div>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <div className="text-sm text-gray-600">
          {notifications.length} notification{notifications.length > 1 ? 's' : ''}
          {notifications.some(n => !isRead(n)) && (
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
              {notifications.filter(n => !isRead(n)).length} non lue(s)
            </span>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <FaBell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Aucune notification</h3>
          <p className="text-gray-500">Vous n'avez pas de notifications pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => {
            const read = isRead(notification);
            console.log('🎨 Rendu notification:', {
              id: notification.id,
              read,
              read_status: notification.read_status
            });
            
            return (
              <div
                key={notification.id}
                className={`border rounded-lg p-4 transition-all ${read ? 'bg-white' : 'bg-blue-50 border-blue-200'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <div className={`w-3 h-3 rounded-full mr-3 ${read ? 'bg-gray-300' : 'bg-blue-500 animate-pulse'}`} />
                      <h3 className="font-semibold text-gray-800">{notification.title}</h3>
                      <span className={`ml-3 px-2 py-1 text-xs rounded-full ${
                        notification.type === 'info' ? 'bg-blue-100 text-blue-800' :
                        notification.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        notification.type === 'error' ? 'bg-red-100 text-red-800' :
                        notification.type === 'success' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {notification.type}
                      </span>
                    </div>
                    
                    <p className="text-gray-600 mb-3">{notification.message}</p>
                    
                    <div className="text-xs text-gray-500">
                      {new Date(notification.created_at).toLocaleString('fr-FR')}
                      {notification.read_at && (
                        <span className="ml-2 text-green-600">
                          • Lu à {new Date(notification.read_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 ml-4">
                    {!read && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        disabled={actionLoading[notification.id]}
                        className="p-2 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                        title="Marquer comme lu"
                      >
                        {actionLoading[notification.id] ? (
                          <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <FaCheck className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleDelete(notification.id)}
                      disabled={actionLoading[`delete_${notification.id}`]}
                      className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                      title="Supprimer"
                    >
                      {actionLoading[`delete_${notification.id}`] ? (
                        <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FaTrash className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;