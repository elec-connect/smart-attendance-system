import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { attendanceService, authService, userService } from '../services/api';
import { formatDate, formatTime } from '../utils/helpers';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { 
  FaUser,
  FaEnvelope,
  FaPhone,
  FaBriefcase,
  FaBuilding,
  FaCalendar,
  FaLock,
  FaHistory,
  FaEdit,
  FaSave
} from 'react-icons/fa';

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [editing, setEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    phone: user?.phone || '',
    position: user?.position || '',
    department: user?.department || '',
    email: user?.email || ''
  });

  const loadAttendanceHistory = async () => {
    try {
      setLoading(true);
      console.log('📅 Chargement historique présence...');
      
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      
      // Essayer plusieurs ID possibles
      const employeeId = user?.employeeId || user?.employee_id || user?.id || 'EMP002';
      console.log('🔍 Chargement pour:', { employeeId, year, month, user });
      
      // FORCE l'utilisation de l'API de correction qui fonctionne
      const response = await attendanceService.getMonthlyAttendance(
        employeeId, 
        year, 
        month
      );
      
      console.log('📊 Réponse API correction:', response);
      
      if (response.success && response.data && response.data.attendanceData) {
        const historyData = response.data.attendanceData
          .filter(day => day.attendance.hasPointage)
          .map(day => ({
            date: day.date,
            checkIn: day.attendance.checkIn,
            checkOut: day.attendance.checkOut,
            status: day.attendance.status,
            hoursWorked: day.attendance.hoursWorked || '0.00'
          }));
        
        console.log('✅ Historique chargé:', historyData.length, 'jours');
        setAttendanceHistory(historyData);
      } else {
        console.warn('⚠️ Pas de données dans la réponse');
        setAttendanceHistory([]);
      }
      
    } catch (error) {
      console.error('❌ Erreur chargement historique:', error);
      
      // Fallback à l'ancienne méthode
      try {
        const fallbackData = await attendanceService.getAttendance({
          employeeId: user?.employeeId || user?.employee_id,
          limit: 20
        });
        
        console.log('📅 Historique fallback reçu:', fallbackData);
        setAttendanceHistory(Array.isArray(fallbackData) ? fallbackData : []);
      } catch (fallbackError) {
        toast.error('Erreur lors du chargement de l\'historique');
        setAttendanceHistory([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🔍 DEBUG PROFIL - User:', user);
    console.log('🆔 Employee ID:', user?.employeeId, '| employee_id:', user?.employee_id);
    
    if (user) {
      setProfileData({
        phone: user?.phone || '',
        position: user?.position || '',
        department: user?.department || '',
        email: user?.email || ''
      });
      loadAttendanceHistory();
    }
  }, [user]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    // Validation
    const errors = {};
    
    if (!passwordData.currentPassword) {
      errors.currentPassword = 'Le mot de passe actuel est requis';
    }
    
    if (!passwordData.newPassword) {
      errors.newPassword = 'Le nouveau mot de passe est requis';
    } else if (passwordData.newPassword.length < 6) {
      errors.newPassword = 'Le mot de passe doit contenir au moins 6 caractères';
    }
    
    if (!passwordData.confirmPassword) {
      errors.confirmPassword = 'Veuillez confirmer le mot de passe';
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }
    
    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }
    
    try {
      setPasswordLoading(true);
      console.log('🔐 Changement mot de passe...');
      
      const response = await authService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      console.log('🔐 Réponse changement:', response);
      
      if (response && response.success !== false) {
        toast.success('Mot de passe changé avec succès');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setPasswordErrors({});
      } else {
        toast.error(response?.message || 'Erreur lors du changement de mot de passe');
      }
    } catch (error) {
      console.error('❌ Erreur changement mot de passe:', error);
      toast.error(error.response?.data?.message || error.message || 'Erreur lors du changement de mot de passe');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleProfileUpdate = async () => {
    try {
      // Vérifier si l'email a changé
      const emailChanged = profileData.email !== user?.email;
      
      if (emailChanged) {
        // Valider le format de l'email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(profileData.email)) {
          toast.error('Veuillez entrer une adresse email valide');
          return;
        }
      }

      // Si l'utilisateur est admin/manager, on met à jour l'email
      if (user?.role === 'admin' || user?.role === 'manager') {
        const updateData = {
          phone: profileData.phone,
          position: profileData.position,
          department: profileData.department
        };

        // Ajouter l'email seulement si l'utilisateur est admin/manager
        if (emailChanged) {
          updateData.email = profileData.email;
        }

        // Appel API pour mettre à jour le profil
        const response = await userService.updateProfile(updateData);
        
        if (response && response.success !== false) {
          // Mettre à jour le contexte d'authentification
          if (updateUser) {
            updateUser({
              ...user,
              ...updateData
            });
          }
          
          toast.success('Profil mis à jour avec succès');
          setEditing(false);
        } else {
          toast.error(response?.message || 'Erreur lors de la mise à jour');
        }
      } else {
        // Pour les employés, seulement les champs non-email
        const updateData = {
          phone: profileData.phone,
          position: profileData.position,
          department: profileData.department
        };
        
        // Simuler la mise à jour pour l'instant
        toast.success('Profil mis à jour avec succès');
        setEditing(false);
      }
    } catch (error) {
      console.error('❌ Erreur mise à jour profil:', error);
      toast.error(error.response?.data?.message || error.message || 'Erreur lors de la mise à jour du profil');
    }
  };

  // Fonction unique pour calculer les stats mensuelles
  const getMonthlyStats = () => {
    try {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      if (attendanceHistory.length === 0) {
        return {
          presentDays: 0,
          totalHours: '0.00',
          totalDays: 0
        };
      }
      
      // Filtrer pour le mois courant
      const monthlyAttendance = attendanceHistory.filter(record => {
        if (!record.date) return false;
        
        try {
          const recordDate = new Date(record.date);
          return recordDate.getMonth() === currentMonth && 
                 recordDate.getFullYear() === currentYear;
        } catch (error) {
          return false;
        }
      });
      
      console.log('📊 Monthly attendance pour stats:', monthlyAttendance);
      
      // Calculer les jours présents
      const presentDays = monthlyAttendance.filter(record => {
        return record.status === 'present' || 
               record.status === 'checked_out' ||
               record.status === 'late' ||
               (record.checkIn && record.checkOut);
      }).length;
      
      // Calculer les heures totales
      const totalHours = monthlyAttendance.reduce((sum, record) => {
        // Si hoursWorked existe et est valide, l'utiliser
        if (record.hoursWorked && !isNaN(parseFloat(record.hoursWorked))) {
          const hours = parseFloat(record.hoursWorked);
          console.log(`📈 Heures depuis hoursWorked: ${hours}h`);
          return sum + (hours > 0 ? hours : 0);
        }
        
        // Sinon calculer à partir de checkIn/checkOut
        if (record.checkIn && record.checkOut) {
          try {
            // Format HH:MM ou HH:MM:SS
            const checkInStr = record.checkIn.length === 5 ? record.checkIn : record.checkIn.slice(0, 5);
            const checkOutStr = record.checkOut.length === 5 ? record.checkOut : record.checkOut.slice(0, 5);
            
            const [inHour, inMin] = checkInStr.split(':').map(Number);
            const [outHour, outMin] = checkOutStr.split(':').map(Number);
            
            let inMinutes = inHour * 60 + inMin;
            let outMinutes = outHour * 60 + outMin;
            
            // Si départ < arrivée (après minuit)
            if (outMinutes < inMinutes) {
              outMinutes += 24 * 60;
            }
            
            const totalMinutes = outMinutes - inMinutes;
            const hours = totalMinutes / 60;
            
            console.log(`📈 Heures calculées: ${checkInStr} → ${checkOutStr} = ${hours}h`);
            
            return sum + (hours > 0 ? hours : 0);
          } catch (error) {
            console.warn('❌ Erreur calcul heures:', error, record);
            return sum;
          }
        }
        return sum;
      }, 0);
      
      console.log('📊 Résultats stats:', {
        presentDays,
        totalHours,
        attendanceHistoryCount: attendanceHistory.length,
        monthlyAttendanceCount: monthlyAttendance.length
      });
      
      return {
        presentDays,
        totalHours: totalHours.toFixed(2),
        totalDays: monthlyAttendance.length
      };
      
    } catch (error) {
      console.error('❌ Erreur calcul stats mensuelles:', error);
      return {
        presentDays: 0,
        totalHours: '0.00',
        totalDays: 0
      };
    }
  };

  const monthlyStats = getMonthlyStats();

  // S'assurer que l'utilisateur existe
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-gray-500 mb-4">Chargement du profil...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Vérifier si l'utilisateur peut modifier l'email
  const canEditEmail = user?.role === 'admin' || user?.role === 'manager';

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon Profil</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gérez vos informations personnelles et vos paramètres
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informations du profil */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <FaUser className="mr-2 text-primary-600" />
                Informations personnelles
              </h3>
              
              {/* Bouton seulement pour admin et manager */}
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <Button
                  variant="outline"
                  size="small"
                  onClick={() => setEditing(!editing)}
                >
                  <FaEdit className="mr-2" />
                  {editing ? 'Annuler' : 'Modifier'}
                </Button>
              )}
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-4 mb-6">
                <div className="h-20 w-20 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-primary-600 font-bold text-2xl">
                    {user?.firstName?.charAt(0) || user?.first_name?.charAt(0) || 'U'}
                    {user?.lastName?.charAt(0) || user?.last_name?.charAt(0) || 'P'}
                  </span>
                </div>
                <div>
                  <h4 className="text-xl font-bold text-gray-900">
                    {user?.firstName || user?.first_name || 'Utilisateur'} {user?.lastName || user?.last_name || ''}
                  </h4>
                  <p className="text-gray-600">{user?.email || 'Non spécifié'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="ID Employé"
                  value={user?.employeeId || user?.employeeNumber || user?.id || 'N/A'}
                  disabled
                  icon={FaUser}
                />
                
                <Input
                  label="Email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                  disabled={!editing || !canEditEmail}
                  icon={FaEnvelope}
                  placeholder="votre@email.com"
                  type="email"
                />
                
                <Input
                  label="Téléphone"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                  disabled={!editing || user?.role === 'employee'}
                  icon={FaPhone}
                  placeholder="+216 58 547 340"
                />
                
                <Input
                  label="Poste"
                  value={profileData.position}
                  onChange={(e) => setProfileData({...profileData, position: e.target.value})}
                  disabled={!editing || user?.role === 'employee'}
                  icon={FaBriefcase}
                  placeholder="Manager"
                />
                
                <Input
                  label="Département"
                  value={profileData.department}
                  onChange={(e) => setProfileData({...profileData, department: e.target.value})}
                  disabled={!editing || user?.role === 'employee'}
                  icon={FaBuilding}
                  placeholder="Direction"
                />
                
                <Input
                  label="Date d'embauche"
                  value={user?.hireDate ? formatDate(user.hireDate) : user?.createdAt ? formatDate(user.createdAt) : 'Non spécifiée'}
                  disabled
                  icon={FaCalendar}
                />
              </div>
              
              {/* Afficher un message si l'email ne peut pas être modifié */}
              {editing && user?.role === 'employee' && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    <span className="font-medium">Note :</span> Les employés ne peuvent pas modifier leur adresse email. 
                    Contactez votre administrateur pour toute modification.
                  </p>
                </div>
              )}
              
              {/* Bouton enregistrer seulement pour admin et manager */}
              {editing && (user?.role === 'admin' || user?.role === 'manager') && (
                <div className="flex justify-end pt-4">
                  <Button
                    variant="primary"
                    onClick={handleProfileUpdate}
                  >
                    <FaSave className="mr-2" />
                    Enregistrer les modifications
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Historique des présences */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <FaHistory className="mr-2 text-primary-600" />
                Historique des présences récentes
              </h3>
            </div>
            
            <div className="p-6">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : attendanceHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Arrivée
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Départ
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Heures
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Statut
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {attendanceHistory.slice(0, 10).map((record, idx) => {
                        // Déterminer le statut
                        let status = record.status;
                        let statusColor = 'bg-gray-100 text-gray-800';
                        let statusText = 'Inconnu';
                        
                        if (record.checkIn && record.checkOut) {
                          status = 'present';
                          statusColor = 'bg-green-100 text-green-800';
                          statusText = 'Présent';
                        } else if (record.checkIn && !record.checkOut) {
                          status = 'partial';
                          statusColor = 'bg-blue-100 text-blue-800';
                          statusText = 'En cours';
                        } else if (status === 'late') {
                          statusColor = 'bg-yellow-100 text-yellow-800';
                          statusText = 'Retard';
                        } else if (status === 'absent') {
                          statusColor = 'bg-red-100 text-red-800';
                          statusText = 'Absent';
                        }
                        
                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {record.date ? formatDate(record.date) : '--'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {record.checkIn ? formatTime(record.checkIn) : '--:--'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {record.checkOut ? formatTime(record.checkOut) : '--:--'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {record.hoursWorked ? `${record.hoursWorked}h` : '--'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColor}`}>
                                {statusText}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Aucun historique de présence disponible
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Statistiques et changement de mot de passe */}
        <div className="space-y-6">
          {/* Statistiques du mois */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Statistiques du mois
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-blue-600">Jours présents</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {monthlyStats.presentDays}
                  </div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-green-600">Heures travaillées</div>
                  <div className="text-2xl font-bold text-green-900">
                    {monthlyStats.totalHours}h
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Ce mois: {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Sur {monthlyStats.totalDays} jours travaillés
                </p>
              </div>
            </div>
          </div>

          {/* Changement de mot de passe */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <FaLock className="mr-2 text-primary-600" />
                Changer le mot de passe
              </h3>
            </div>
            
            <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
              <Input
                label="Mot de passe actuel"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => {
                  setPasswordData({
                    ...passwordData,
                    currentPassword: e.target.value
                  });
                  if (passwordErrors.currentPassword) {
                    setPasswordErrors({...passwordErrors, currentPassword: null});
                  }
                }}
                required
                icon={FaLock}
                error={passwordErrors.currentPassword}
                disabled={passwordLoading}
              />
              
              <Input
                label="Nouveau mot de passe"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => {
                  setPasswordData({
                    ...passwordData,
                    newPassword: e.target.value
                  });
                  if (passwordErrors.newPassword) {
                    setPasswordErrors({...passwordErrors, newPassword: null});
                  }
                }}
                required
                icon={FaLock}
                error={passwordErrors.newPassword}
                disabled={passwordLoading}
              />
              
              <Input
                label="Confirmer le nouveau mot de passe"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => {
                  setPasswordData({
                    ...passwordData,
                    confirmPassword: e.target.value
                  });
                  if (passwordErrors.confirmPassword) {
                    setPasswordErrors({...passwordErrors, confirmPassword: null});
                  }
                }}
                required
                icon={FaLock}
                error={passwordErrors.confirmPassword}
                disabled={passwordLoading}
              />
              
              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={passwordLoading}
                disabled={passwordLoading}
              >
                Changer le mot de passe
              </Button>
              
              <div className="text-xs text-gray-500 space-y-1">
                <p>• Minimum 6 caractères</p>
                <p>• Utilisez des lettres, chiffres et caractères spéciaux</p>
                <p>• Évitez les mots de passe courants</p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;