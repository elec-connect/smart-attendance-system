import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import notificationService from "../services/notificationService";
import { 
  FaBell, 
  FaUserCircle, 
  FaCog, 
  FaSignOutAlt, 
  FaBars, 
  FaTimes, 
  FaCamera,
  FaDollarSign,
  FaFileInvoiceDollar,
  FaChartBar,
  FaUsers,
  FaCalendarCheck,
  FaHome,
  FaDownload // AJOUTÉ: Icône pour les exports
} from 'react-icons/fa';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Charger les notifications
  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationService.getNotificationsWithFallback();
      if (response.success) {
        setNotifications(response.data || []);
      }
    } catch (error) {
      console.warn('Erreur chargement notifications:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const markAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === id ? { ...notif, read: true } : notif
        )
      );
    } catch (error) {
      console.warn('Erreur marquer comme lu:', error.message);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, read: true }))
      );
    } catch (error) {
      console.warn('Erreur tout marquer comme lu:', error.message);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // Définir les permissions selon le rôle
  const getPermissions = () => {
    if (!user) return {};
    
    switch(user.role) {
      case 'admin':
        return {
          canViewEmployees: true,
          canViewPayroll: true,
          canViewReports: true,
          canViewSettings: true,
          canDoFacialAttendance: true,
          canViewDashboard: true,
          canViewAttendance: true,
          canViewExports: true // AJOUTÉ: Admin peut voir les exports
        };
      case 'manager':
        return {
          canViewEmployees: false,
          canViewPayroll: false,
          canViewReports: false,
          canViewSettings: false,
          canDoFacialAttendance: false,
          canViewDashboard: true,
          canViewAttendance: true,
          canViewExports: true // AJOUTÉ: Manager peut voir les exports
        };
      case 'employee':
        return {
          canViewEmployees: false,
          canViewPayroll: false,
          canViewReports: false,
          canViewSettings: false,
          canDoFacialAttendance: false,
          canViewDashboard: true,
          canViewAttendance: true,
          canViewExports: false // AJOUTÉ: Employé NE PEUT PAS voir les exports
        };
      default:
        return {};
    }
  };

  const permissions = getPermissions();

  // Navigation principale basée sur les permissions
  const getMainNavigation = () => {
    const navItems = [];
    
    // Tableau de bord - visible pour tous
    navItems.push({ 
      name: 'Tableau de bord', 
      href: '/dashboard',
      icon: <FaHome className="h-4 w-4" />
    });
    
    // Employés - visible seulement pour admin
    if (permissions.canViewEmployees) {
      navItems.push({ 
        name: 'Employés', 
        href: '/employees',
        icon: <FaUsers className="h-4 w-4" />
      });
    }
    
    // Présences - visible pour tous
    navItems.push({ 
      name: 'Présences', 
      href: '/attendance',
      icon: <FaCalendarCheck className="h-4 w-4" />
    });
    
    // Paie - visible seulement pour admin
    if (permissions.canViewPayroll) {
      navItems.push({ 
        name: 'Paie', 
        href: '/payroll',
        icon: <FaDollarSign className="h-4 w-4" />
      });
    }
    
    // Rapports - visible seulement pour admin
    if (permissions.canViewReports) {
      navItems.push({ 
        name: 'Rapports', 
        href: '/reports',
        icon: <FaChartBar className="h-4 w-4" />
      });
    }
    
    // AJOUTÉ: Exports - visible seulement pour admin et manager
    if (permissions.canViewExports) {
      navItems.push({ 
        name: 'Exports', 
        href: '/exports',
        icon: <FaDownload className="h-4 w-4" />
      });
    }
    
    // Paramètres - visible seulement pour admin
    if (permissions.canViewSettings) {
      navItems.push({ 
        name: 'Paramètres', 
        href: '/settings',
        icon: <FaCog className="h-4 w-4" />
      });
    }
    
    return navItems;
  };

  const mainNavigation = getMainNavigation();

  const formatTimeAgo = (date) => {
    try {
      const now = new Date();
      const notificationDate = new Date(date);
      
      if (isNaN(notificationDate.getTime())) {
        return 'Récemment';
      }
      
      const diffMs = now - notificationDate;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'À l\'instant';
      if (diffMins < 60) return `Il y a ${diffMins} min`;
      if (diffHours < 24) return `Il y a ${diffHours} h`;
      if (diffDays < 7) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
      
      return notificationDate.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short'
      });
    } catch (error) {
      return 'Récemment';
    }
  };

  // Composant NavItem pour la barre de navigation
  const NavItem = ({ to, icon, label }) => (
    <Link
      to={to}
      className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-100 rounded-md transition-all duration-200"
    >
      {icon && <span className="mr-2">{icon}</span>}
      {label}
    </Link>
  );

  // Obtenir l'icône pour le type de notification
  const getNotificationIcon = (type) => {
    switch(type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo et navigation principale */}
          <div className="flex items-center">
            <button
              className="md:hidden mr-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Menu"
            >
              {isMenuOpen ? (
                <FaTimes className="h-6 w-6 text-gray-600" />
              ) : (
                <FaBars className="h-6 w-6 text-gray-600" />
              )}
            </button>
            
            <div className="flex-shrink-0 flex items-center">
              <Link to="/dashboard" className="flex items-center">
                <div className="h-8 w-8 bg-gradient-to-br from-primary-600 to-primary-800 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">SA</span>
                </div>
                <span className="ml-3 text-xl font-bold text-gray-900 hidden md:block">
                  Smart Attendance
                </span>
              </Link>
            </div>
            
            <div className="hidden md:ml-10 md:flex md:space-x-2">
              {mainNavigation.map((item) => (
                <NavItem 
                  key={item.name}
                  to={item.href}
                  icon={item.icon}
                  label={item.name}
                />
              ))}
            </div>
          </div>

          {/* Actions de droite */}
          <div className="flex items-center space-x-3">
            {/* Bouton Pointage Facial - Icône seulement (pas de texte) */}
            {permissions.canDoFacialAttendance && (
              <Link
                to="/facial-attendance"
                className="hidden lg:flex items-center justify-center w-10 h-10 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors shadow-sm"
                title="Pointage Facial"
                aria-label="Pointage Facial"
              >
                <FaCamera className="h-5 w-5" />
              </Link>
            )}

            {/* Notifications */}
            <div className="relative">
              <button 
                className="p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none transition-colors relative"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                aria-label="Notifications"
              >
                <FaBell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                )}
              </button>

              {isNotificationsOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsNotificationsOpen(false)}
                  />
                  
                  <div className="origin-top-right absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-sm text-primary-600 hover:text-primary-800"
                          >
                            Tout marquer comme lu
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                      {loading ? (
                        <div className="p-4 text-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          <FaBell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                          <p>Aucune notification</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {notifications.map((notification) => (
                            <div
                              key={notification.id}
                              className={`p-4 hover:bg-gray-50 cursor-pointer ${!notification.read ? 'bg-blue-50' : ''}`}
                              onClick={() => markAsRead(notification.id)}
                            >
                              <div className="flex items-start">
                                <div className="mr-3 text-lg">
                                  {getNotificationIcon(notification.type)}
                                </div>
                                <div className="flex-1">
                                  <div className="flex justify-between">
                                    <h4 className="font-medium text-gray-900">{notification.title}</h4>
                                    <span className="text-xs text-gray-500">
                                      {formatTimeAgo(notification.createdAt)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                                </div>
                                {!notification.read && (
                                  <div className="ml-2">
                                    <span className="h-2 w-2 bg-primary-500 rounded-full block"></span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-3 border-t border-gray-200 bg-gray-50">
                      <button
                        onClick={() => {
                          setIsNotificationsOpen(false);
                          navigate('/notifications');
                        }}
                        className="text-sm text-primary-600 hover:text-primary-800 w-full text-center"
                      >
                        Voir toutes les notifications
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Menu profil */}
            <div className="relative">
              <button
                className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                aria-label="Menu utilisateur"
              >
                <span className="sr-only">Ouvrir le menu utilisateur</span>
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center border-2 border-gray-200 hover:border-primary-500 transition-colors">
                  <FaUserCircle className="h-7 w-7 text-gray-600" />
                </div>
                <span className="ml-2 hidden md:block text-gray-700 font-medium">
                  {user?.firstName} {user?.lastName?.charAt(0)}.
                </span>
              </button>

              {/* Dropdown menu */}
              {isProfileMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsProfileMenuOpen(false)}
                  />
                  
                  <div className="origin-top-right absolute right-0 mt-2 w-64 rounded-lg shadow-lg py-2 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50 border border-gray-100">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                          <FaUserCircle className="h-10 w-10 text-primary-600" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-semibold text-gray-900">
                            {user?.firstName} {user?.lastName}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {user?.email}
                          </p>
                          <div className="flex items-center mt-1">
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                              {user?.role === 'admin' ? '👑 Administrateur' : 
                               user?.role === 'manager' ? '👔 Manager' : 
                               '👨‍💼 Employé'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="py-2">
                      <Link
                        to="/profile"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors"
                        onClick={() => setIsProfileMenuOpen(false)}
                      >
                        <FaUserCircle className="mr-3 text-gray-400" />
                        Mon profil
                      </Link>
                      
                      {/* AJOUTÉ: Lien vers les exports dans le menu profil */}
                      {permissions.canViewExports && (
                        <Link
                          to="/exports"
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors"
                          onClick={() => setIsProfileMenuOpen(false)}
                        >
                          <FaDownload className="mr-3 text-blue-400" />
                          <span>Exports de données</span>
                        </Link>
                      )}

                      {/* Lien Mes fiches de paie pour TOUS les utilisateurs */}
                      {user?.role !== 'manager' && (
                        <Link
                          to="/my-payslips"
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors"
                          onClick={() => setIsProfileMenuOpen(false)}
                        >
                          <FaFileInvoiceDollar className="mr-3 text-blue-400" />
                          <span>Mes fiches de paie</span>
                        </Link>
                      )}

                      {/* Pointage Facial dans le menu profil (avec texte complet) */}
                      {permissions.canDoFacialAttendance && (
                        <Link
                          to="/facial-attendance"
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors"
                          onClick={() => setIsProfileMenuOpen(false)}
                        >
                          <FaCamera className="mr-3 text-purple-400" />
                          <span>Pointage Facial</span>
                        </Link>
                      )}

                      {/* Lien vers la paie dans le menu profil - SEULEMENT pour admin */}
                      {permissions.canViewPayroll && (
                        <Link
                          to="/payroll"
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors"
                          onClick={() => setIsProfileMenuOpen(false)}
                        >
                          <FaDollarSign className="mr-3 text-green-400" />
                          <span>Gestion de la Paie</span>
                        </Link>
                      )}
                      
                      {/* Lien vers les paramètres - SEULEMENT pour admin */}
                      {permissions.canViewSettings && (
                        <Link
                          to="/settings"
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors"
                          onClick={() => setIsProfileMenuOpen(false)}
                        >
                          <FaCog className="mr-3 text-gray-400" />
                          Paramètres
                        </Link>
                      )}
                    </div>
                    
                    <div className="border-t border-gray-100 my-2"></div>
                    
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                    >
                      <FaSignOutAlt className="mr-3" />
                      Se déconnecter
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Menu mobile */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-200 pt-4 pb-3 bg-white">
            <div className="flex items-center px-4 mb-4">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                <FaUserCircle className="h-8 w-8 text-primary-600" />
              </div>
              <div className="ml-3">
                <div className="text-base font-semibold text-gray-800">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-sm font-medium text-gray-500">
                  {user?.email}
                </div>
                <div className="text-xs text-primary-600 font-medium mt-1">
                  {user?.role === 'admin' ? 'Administrateur' : 
                   user?.role === 'manager' ? 'Manager' : 
                   'Employé'}
                </div>
              </div>
            </div>
            
            <div className="space-y-1">
              {mainNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className="flex items-center px-4 py-3 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="mr-3">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              ))}

              {/* AJOUTÉ: Lien Mes fiches de paie pour TOUS les utilisateurs dans le menu mobile */}
              {user?.role !== 'manager' && (
                <Link
                  to="/my-payslips"
                  className="flex items-center px-4 py-3 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FaFileInvoiceDollar className="mr-3 text-blue-500" />
                  <span>Mes fiches de paie</span>
                </Link>
              )}

              {/* AJOUTÉ: Exports dans le menu mobile (pour admin et manager) */}
              {permissions.canViewExports && (
                <Link
                  to="/exports"
                  className="flex items-center px-4 py-3 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FaDownload className="mr-3 text-green-500" />
                  <span>Exports</span>
                </Link>
              )}

              {/* Pointage Facial dans le menu mobile */}
              {permissions.canDoFacialAttendance && (
                <Link
                  to="/facial-attendance"
                  className="flex items-center px-4 py-3 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FaCamera className="mr-3 text-purple-500" />
                  <span>Pointage Facial</span>
                </Link>
              )}

              <button
                onClick={() => {
                  handleLogout();
                  setIsMenuOpen(false);
                }}
                className="block w-full text-left px-4 py-3 text-base font-medium text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100 mt-2"
              >
                <FaSignOutAlt className="inline mr-3" />
                Se déconnecter
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;