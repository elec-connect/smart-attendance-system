// frontend/src/pages/mobile/ReadOnlyApp.jsx
import React, { useState, useEffect } from 'react';
import {
  IonApp,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonBadge,
  IonPage,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonList,
  IonItem,
  IonAvatar,
  IonChip,
  IonProgressBar,
  IonGrid,
  IonRow,
  IonCol
} from '@ionic/react';
import {
  statsChart,
  people,
  time,
  business,
  personCircle
} from 'ionicons/icons';
import './ReadOnlyApp.css';

const ReadOnlyApp = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState([]);

  useEffect(() => {
    loadDashboardData();
    loadTodayAttendance();
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/mobile/dashboard');
      const data = await response.json();
      setDashboardData(data.stats);
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    }
  };

  const loadTodayAttendance = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/mobile/attendance/today');
      const data = await response.json();
      setTodayAttendance(data.attendance || []);
    } catch (error) {
      console.error('Erreur chargement pointages:', error);
    }
  };

  const DashboardTab = () => (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Tableau de Bord</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {dashboardData && (
          <>
            <IonGrid>
              <IonRow>
                <IonCol size="6">
                  <IonCard className="stat-card">
                    <IonCardHeader>
                      <IonCardTitle className="stat-number">
                        {dashboardData.total_employees}
                      </IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                      <IonLabel>Employés</IonLabel>
                    </IonCardContent>
                  </IonCard>
                </IonCol>
                <IonCol size="6">
                  <IonCard className="stat-card">
                    <IonCardHeader>
                      <IonCardTitle className="stat-number">
                        {dashboardData.today_checkins}
                      </IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                      <IonLabel>Pointages Aujourd'hui</IonLabel>
                    </IonCardContent>
                  </IonCard>
                </IonCol>
              </IonRow>
              <IonRow>
                <IonCol size="12">
                  <IonCard>
                    <IonCardHeader>
                      <IonCardTitle>Présents Actuellement</IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                      <div className="present-count">
                        <h1>{dashboardData.currently_present}</h1>
                        <p>sur {dashboardData.total_employees} employés</p>
                      </div>
                      <IonProgressBar 
                        value={dashboardData.currently_present / dashboardData.total_employees}
                        color="primary"
                      />
                    </IonCardContent>
                  </IonCard>
                </IonCol>
              </IonRow>
            </IonGrid>

            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Derniers Pointages</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonList lines="full">
                  {todayAttendance.slice(0, 5).map((record) => (
                    <IonItem key={record.id}>
                      <IonAvatar slot="start">
                        {record.first_name.charAt(0)}
                      </IonAvatar>
                      <IonLabel>
                        <h2>{record.first_name} {record.last_name}</h2>
                        <p>{record.department}</p>
                        <p className="time-info">
                          Arrivée: {record.checkin_hour}h{record.checkin_minute}
                          {record.check_out_time && ` - Départ: ${new Date(record.check_out_time).getHours()}h${new Date(record.check_out_time).getMinutes()}`}
                        </p>
                      </IonLabel>
                      <IonChip 
                        color={record.check_out_time ? "success" : "primary"}
                        slot="end"
                      >
                        {record.check_out_time ? 'Terminé' : 'Présent'}
                      </IonChip>
                    </IonItem>
                  ))}
                </IonList>
              </IonCardContent>
            </IonCard>
          </>
        )}
      </IonContent>
    </IonPage>
  );

  const AttendanceTab = () => (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Pointages Aujourd'hui</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          {todayAttendance.map((record) => (
            <IonItem key={record.id} className="attendance-item">
              <div slot="start" className="time-indicator">
                <div className="checkin-time">
                  {record.checkin_hour}h{record.checkin_minute.toString().padStart(2, '0')}
                </div>
                {record.check_out_time && (
                  <div className="checkout-time">
                    → {new Date(record.check_out_time).getHours()}h{new Date(record.check_out_time).getMinutes().toString().padStart(2, '0')}
                  </div>
                )}
              </div>
              <IonLabel>
                <h2>{record.first_name} {record.last_name}</h2>
                <p>{record.department}</p>
              </IonLabel>
              <IonBadge 
                color={
                  record.check_out_time ? "medium" : 
                  record.status === 'late' ? "warning" : "success"
                }
                slot="end"
              >
                {record.check_out_time ? 'Départ' : 'Présent'}
              </IonBadge>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  );

  return (
    <IonApp>
      <IonTabs>
        <IonTabBar slot="bottom">
          <IonTabButton tab="dashboard" selected={activeTab === 'dashboard'}>
            <IonIcon icon={statsChart} />
            <IonLabel>Dashboard</IonLabel>
          </IonTabButton>
          
          <IonTabButton tab="attendance" selected={activeTab === 'attendance'}>
            <IonIcon icon={time} />
            <IonLabel>Pointages</IonLabel>
          </IonTabButton>
          
          <IonTabButton tab="employees" selected={activeTab === 'employees'}>
            <IonIcon icon={people} />
            <IonLabel>Employés</IonLabel>
          </IonTabButton>
          
          <IonTabButton tab="departments" selected={activeTab === 'departments'}>
            <IonIcon icon={business} />
            <IonLabel>Départements</IonLabel>
          </IonTabButton>
        </IonTabBar>
        
        <IonContent>
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'attendance' && <AttendanceTab />}
          {/* Ajoutez les autres onglets ici */}
        </IonContent>
      </IonTabs>
      
      <div className="read-only-banner">
        <IonChip color="warning">
          <IonIcon icon="eye" />
          <IonLabel>Mode Lecture Seule</IonLabel>
        </IonChip>
      </div>
    </IonApp>
  );
};

export default ReadOnlyApp;
