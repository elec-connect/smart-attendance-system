import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth.jsx';
import { employeeService, attendanceService } from '../../services/api.jsx';
import { formatDate } from '../../utils/helpers.jsx';
import { 
  FaUsers, 
  FaCheckCircle, 
  FaClock, 
  FaChartLine,
  FaCalendarAlt,
  FaUserCheck,
  FaUserTimes,
  FaExclamationTriangle,
  FaCamera,
  FaArrowRight,
  FaSync,
  FaIdCard,
  FaFileAlt,
  FaEye,
  FaHistory,
  FaUserCircle,
  FaDoorOpen,
  FaDoorClosed,
  FaCalendarCheck,
  FaCalendarTimes,
  FaRegClock,
  FaEnvelope,
  FaPhone,
  FaIdBadge
} from 'react-icons/fa';
import StatCard from './StatCard.jsx';
import EmployeeChart from './EmployeeChart.jsx';
import AttendanceChart from './AttendanceChart.jsx';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    employees: { total: 0, active: 0, inactive: 0 },
    attendance: { present: 0, absent: 0, rate: 0 },
    today: { present: 0, late: 0, absent: 0 }
  });
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departmentStats, setDepartmentStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { user } = useAuth();
  
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchDashboardData();
  }, []);

  // Fonction pour obtenir les initiales
  const getInitials = (name) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Fonction pour formater le téléphone
  const formatPhone = (phone) => {
    if (!phone || phone === 'N/A') return 'N/A';
    // Format français: +33 X XX XX XX XX
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '+33 $1 $2 $3 $4 $5');
    }
    return phone;
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setHasError(false);
      
      console.log('📊 Chargement des données du dashboard...');
      
      // Utilisez l'API stats pour obtenir les chiffres corrects
      const [statsResponse, employeesResponse, attendanceResponse, todayAttendanceResponse] = await Promise.all([
        attendanceService.getAttendanceStats().catch(err => {
          console.error('❌ Erreur statistiques:', err);
          return { data: { today: { present: 0, late: 0, absent: 0, attendance_rate: 0 } } };
        }),
        employeeService.getAllEmployees().catch(err => {
          console.error('❌ Erreur employés:', err);
          return { data: [] };
        }),
        attendanceService.getAttendance({ limit: 10 }).catch(err => {
          console.error('❌ Erreur présences:', err);
          return { data: [] };
        }),
        attendanceService.getAttendance({ 
          date: new Date().toISOString().split('T')[0]
        }).catch(err => {
          console.error('❌ Erreur présences aujourd\'hui:', err);
          return { data: [] };
        })
      ]);
      
      const employeesData = employeesResponse.data || [];
      const allAttendance = attendanceResponse.data || [];
      const todayAttendance = todayAttendanceResponse.data || [];
      const attendanceStats = statsResponse.data?.today || {};
      
      console.log('📈 Données chargées:', {
        employees: employeesData.length,
        attendances: allAttendance.length,
        todayAttendances: todayAttendance.length,
        stats: attendanceStats
      });
      
      // Stocker les employés
      setEmployees(employeesData);
      
      // Utiliser les statistiques du backend (CORRECTES)
      const totalEmployees = employeesData.length;
      const activeEmployees = employeesData.filter(emp => 
        emp.status === 'active' || emp.isActive === true || emp.employeeStatus === 'Actif'
      ).length;
      const inactiveEmployees = Math.max(0, totalEmployees - activeEmployees);
      
      // Chiffres du backend - CORRECTS car calculés avec COUNT(DISTINCT)
      const presentToday = attendanceStats.present || 0;
      const lateToday = attendanceStats.late || 0;
      const attendanceRateFromBackend = attendanceStats.attendance_rate || '0.00';
      
      // Si le backend retourne un taux > 100, on le limite manuellement
      let attendanceRateValue = parseFloat(attendanceRateFromBackend);
      if (attendanceRateValue > 100) {
        console.warn('⚠️ Taux de présence > 100% du backend, limité à 100%');
        attendanceRateValue = 100;
      }
      
      // Calculs basés sur les chiffres CORRECTS du backend
      const attendanceRateDisplay = activeEmployees > 0 ? 
        Math.min(100, Math.round((presentToday / activeEmployees) * 100)) : 0;
      
      console.log('📊 Statistiques calculées:', {
        totalEmployees,
        activeEmployees,
        presentToday,
        lateToday,
        attendanceRateBackend: attendanceRateFromBackend,
        attendanceRateDisplay
      });
      
      // Calculer la distribution par département
      const realDepartmentStats = {};
      employeesData.forEach(emp => {
        const dept = emp.department || 'Non spécifié';
        realDepartmentStats[dept] = (realDepartmentStats[dept] || 0) + 1;
      });
      
      setStats({
        employees: { 
          total: totalEmployees, 
          active: activeEmployees, 
          inactive: inactiveEmployees 
        },
        attendance: { 
          present: presentToday, 
          absent: Math.max(0, activeEmployees - presentToday), 
          rate: attendanceRateDisplay
        },
        today: {
          present: presentToday,
          late: lateToday,
          absent: Math.max(0, activeEmployees - presentToday)
        }
      });
      
      // Créer un dictionnaire des employés
      const employeeDict = {};
      employeesData.forEach(emp => {
        const empId = emp.employee_id || emp.employeeId || emp.id;
        if (empId) {
          employeeDict[empId.toUpperCase()] = {
            name: `${emp.first_name || emp.firstName || ''} ${emp.last_name || emp.lastName || ''}`.trim(),
            email: emp.email || '',
            phone: emp.phone || '',
            department: emp.department || '',
            position: emp.position || '',
            employeeId: empId // Stocker l'ID original
          };
        }
      });
      
      console.log('📚 Dictionnaire employés:', Object.keys(employeeDict).length, 'entrées');
      
      // Préparer les présences récentes AVEC TOUTES LES INFORMATIONS
      const recentWithNames = allAttendance.slice(0, 5).map(record => {
        const employeeId = record.employeeId || record.employee_id;
        const employeeKey = employeeId ? employeeId.toUpperCase() : null;
        
        // Chercher dans le dictionnaire
        const employeeInfo = employeeKey ? employeeDict[employeeKey] : null;
        
        // Déterminer le nom
        let employeeName = record.employeeName;
        
        // Si pas de nom dans le record ou nom générique
        if (!employeeName || employeeName.includes('Employé') || employeeName === 'À identifier') {
          if (employeeInfo && employeeInfo.name) {
            employeeName = employeeInfo.name;
          } else if (record.firstName && record.lastName) {
            employeeName = `${record.firstName} ${record.lastName}`.trim();
          } else if (record.email) {
            employeeName = record.email.split('@')[0];
          } else {
            employeeName = `Employé ${employeeId || 'N/A'}`;
          }
        }
        
        // Déterminer les initiales
        let initials = '??';
        if (employeeInfo && employeeInfo.name) {
          initials = getInitials(employeeInfo.name);
        } else if (record.firstName && record.lastName) {
          initials = getInitials(`${record.firstName} ${record.lastName}`);
        } else {
          initials = getInitials(employeeName);
        }
        
        // Téléphone
        const phone = employeeInfo?.phone || record.phone || '';
        const formattedPhone = formatPhone(phone);
        
        return {
          ...record,
          employeeName: employeeName,
          employeeEmail: employeeInfo?.email || record.email || '',
          employeePhone: phone,
          employeeFormattedPhone: formattedPhone,
          employeeInitials: initials,
          employeeId: employeeId,
          employeeDisplayId: employeeInfo?.employeeId || employeeId || 'N/A',
          department: employeeInfo?.department || record.department || 'Non spécifié'
        };
      });
      
      console.log('📋 Présences formatées:', recentWithNames.map(r => ({
        name: r.employeeName,
        id: r.employeeDisplayId,
        phone: r.employeeFormattedPhone
      })));
      
      setRecentAttendance(recentWithNames);
      setDepartmentStats(realDepartmentStats);
      
      toast.success('Données actualisées', { 
        icon: '✅',
        duration: 3000 
      });
      
    } catch (error) {
      console.error('❌ Erreur dashboard:', error);
      setHasError(true);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    console.log('🔄 Actualisation des données...');
    hasFetched.current = false;
    fetchDashboardData();
  };

  // Déterminer le rôle de l'utilisateur
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isEmployee = user?.role === 'employee';
  
  // Titre selon le rôle
  const getRoleTitle = () => {
    if (isAdmin) return 'Administrateur';
    if (isManager) return 'Manager';
    if (isEmployee) return 'Employé';
    return 'Utilisateur';
  };

  // Fonctions pour le tableau
  const getStatusColor = (status, checkOut) => {
    if (checkOut === '--:--' && status !== 'checked_out') return 'bg-blue-100 text-blue-800';
    if (status === 'late') return 'bg-red-100 text-red-800';
    if (status === 'present') return 'bg-green-100 text-green-800';
    if (status === 'checked_out') return 'bg-indigo-100 text-indigo-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatStatus = (status, checkOut) => {
    if (checkOut === '--:--' && status !== 'checked_out') return 'En retard';
    if (status === 'late') return 'Retard';
    if (status === 'present') return 'Présent';
    if (status === 'checked_out') return 'Sorti';
    return 'Inconnu';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
        <p className="text-gray-600 font-medium">Chargement des données...</p>
        <p className="text-gray-400 text-sm mt-1">Connexion à la base de données</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-2xl mx-auto">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <FaExclamationTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-red-800 font-semibold text-lg mb-2">Erreur de connexion</h3>
            <p className="text-red-600 mb-4">
              Impossible de charger les données. Vérifiez votre connexion.
            </p>
            <button
              onClick={refreshData}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              <FaSync className="inline mr-2" />
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Tableau de Bord {getRoleTitle()}
            </h1>
            <p className="text-gray-600 mt-1 flex items-center">
              <FaCalendarAlt className="mr-2" />
              {formatDate(new Date(), 'full')}
            </p>
          </div>
          
          <button
            onClick={refreshData}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg flex items-center gap-2 text-sm shadow-sm"
          >
            <FaSync className="w-4 h-4" />
            Actualiser
          </button>
        </div>

        {/* Boutons actions - MODIFIÉ: SEULEMENT Admin pour Pointage Manuel et Reconnaissance Faciale */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Bouton Historique - POUR TOUS */}
          <button
            onClick={() => navigate(isEmployee ? '/my-attendance' : '/attendance')}
            className="flex-1 group p-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl border border-blue-600 hover:shadow-md transition-all flex items-center justify-between"
          >
            <div className="flex items-center">
              <div className="p-3 bg-white/20 rounded-lg mr-4">
                <FaHistory className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-lg">
                  {isEmployee ? 'Mes Pointages' : 'Historique'}
                </div>
              </div>
            </div>
            <FaArrowRight className="opacity-80 group-hover:opacity-100" />
          </button>

          {/* Bouton Profil - POUR TOUS */}
          <button
            onClick={() => navigate('/profile')}
            className="flex-1 group p-4 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-xl border border-teal-600 hover:shadow-md transition-all flex items-center justify-between"
          >
            <div className="flex items-center">
              <div className="p-3 bg-white/20 rounded-lg mr-4">
                <FaUserCircle className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-lg">Mon Profil</div>
              </div>
            </div>
            <FaArrowRight className="opacity-80 group-hover:opacity-100" />
          </button>

          {/* Bouton Pointage Manuel - SEULEMENT pour Admin */}
          {isAdmin && (
            <button
              onClick={() => navigate('/attendance/quick-check')}
              className="flex-1 group p-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl border border-green-600 hover:shadow-md transition-all flex items-center justify-between"
            >
              <div className="flex items-center">
                <div className="p-3 bg-white/20 rounded-lg mr-4">
                  <FaRegClock className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-lg">Pointage Manuel</div>
                </div>
              </div>
              <FaArrowRight className="opacity-80 group-hover:opacity-100" />
            </button>
          )}

          {/* Bouton Reconnaissance Faciale - SEULEMENT pour Admin */}
          {isAdmin && (
            <button
              onClick={() => navigate('/facial-attendance')}
              className="flex-1 group p-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl border border-purple-600 hover:shadow-md transition-all flex items-center justify-between"
            >
              <div className="flex items-center">
                <div className="p-3 bg-white/20 rounded-lg mr-4">
                  <FaCamera className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-lg">Reconnaissance Faciale</div>
                </div>
              </div>
              <FaArrowRight className="opacity-80 group-hover:opacity-100" />
            </button>
          )}
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Employés actifs"
          value={stats.employees.active || 0}
          subtitle={`Total: ${stats.employees.total || 0}`}
          icon={FaUsers}
          color="blue"
        />
        
        <StatCard
          title="Présents aujourd'hui"
          value={stats.today.present || 0}
          subtitle={`Retards: ${stats.today.late || 0}`}
          icon={FaUserCheck}
          color="green"
        />
        
        {(isAdmin || isManager) ? (
          <>
            <StatCard
              title="Absents aujourd'hui"
              value={stats.today.absent || 0}
              subtitle={`Sur ${stats.employees.active || 0} actifs`}
              icon={FaUserTimes}
              color="red"
            />
            
            <StatCard
              title="Taux de présence"
              value={`${stats.attendance.rate || 0}%`}
              subtitle="Aujourd'hui"
              icon={FaChartLine}
              color="purple"
            />
          </>
        ) : (
          <>
            <StatCard
              title="Mes heures"
              value="0h"
              subtitle="Ce mois"
              icon={FaClock}
              color="orange"
            />
            
            <StatCard
              title="Pointages"
              value="0/0"
              subtitle="Validés"
              icon={FaCheckCircle}
              color="teal"
            />
          </>
        )}
      </div>

      {/* Présences récentes - AVEC ID ET TÉLÉPHONE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {isEmployee ? 'Mes présences récentes' : 'Présences récentes'}
              </h3>
              <p className="text-sm text-gray-500">
                {isEmployee 
                  ? 'Mes dernières présences'
                  : 'Les dernières présences enregistrées'}
              </p>
            </div>
            <button
              onClick={() => navigate(isEmployee ? '/my-attendance' : '/attendance')}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-2 text-sm"
            >
              Voir tout
              <FaArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
        
        <div className="p-5">
          {recentAttendance.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID Employé</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Téléphone</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Arrivée</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Départ</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Heures</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentAttendance.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs mr-3">
                            {record.employeeInitials}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {record.employeeName}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center">
                              <FaEnvelope className="h-3 w-3 mr-1" />
                              {record.employeeEmail || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FaIdBadge className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm font-mono font-medium text-gray-900">
                            {record.employeeDisplayId}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FaPhone className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">
                            {record.employeeFormattedPhone}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.date ? new Date(record.date).toLocaleDateString('fr-FR') : 'N/D'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.checkIn || '--:--'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.checkOut || '--:--'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${getStatusColor(record.status, record.checkOut)}`}>
                          {formatStatus(record.status, record.checkOut)}
                        </span>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.hoursWorked && record.hoursWorked !== '0.00' ? `${record.hoursWorked}h` : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-10 text-center text-gray-500">
              <FaClock className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-600 font-medium">Aucune présence enregistrée</p>
            </div>
          )}
        </div>
      </div>

      {/* Informations rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`border rounded-xl p-4 ${
          isAdmin ? 'bg-purple-50 border-purple-100' :
          isManager ? 'bg-blue-50 border-blue-100' :
          'bg-green-50 border-green-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isAdmin ? 'bg-purple-100' :
              isManager ? 'bg-blue-100' :
              'bg-green-100'
            }`}>
              <FaIdCard className={`h-5 w-5 ${
                isAdmin ? 'text-purple-600' :
                isManager ? 'text-blue-600' :
                'text-green-600'
              }`} />
            </div>
            <div>
              <h4 className={`font-medium ${
                isAdmin ? 'text-purple-800' :
                isManager ? 'text-blue-800' :
                'text-green-800'
              }`}>
                {user?.firstName} {user?.lastName}
              </h4>
              <p className={`text-sm ${
                isAdmin ? 'text-purple-600' :
                isManager ? 'text-blue-600' :
                'text-green-600'
              }`}>
                {getRoleTitle()}
                {user?.department ? ` • ${user.department}` : ''}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <FaCalendarCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h4 className="font-medium text-green-800">Présence du jour</h4>
              <p className="text-sm text-green-600">
                {stats.today.present || 0} présents / {stats.employees.active || 0} actifs
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FaFileAlt className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h4 className="font-medium text-purple-800">Données à jour</h4>
              <p className="text-sm text-purple-600">
                Source: PostgreSQL
                <br />
                Actualisé: {new Date().toLocaleTimeString('fr-FR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;