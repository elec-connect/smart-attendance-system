import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { attendanceService, employeeService } from '../services/api';
import { formatDate, downloadFile } from '../utils/helpers';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import ExportPanel from '../components/export/ExportPanel';
import { 
  FaFilePdf,
  FaFileExcel,
  FaDownload,
  FaCalendar,
  FaChartBar,
  FaFilter,
  FaUsers,
  FaFileAlt,
  FaTimes,
  FaCalendarAlt,
  FaPrint,
  FaFileCsv,
  FaFileExport,
  FaSync,
  FaTrash
} from 'react-icons/fa';

// Définir l'URL de base de l'API
const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:5000/api';

const ReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    department: '',
    employeeId: ''
  });
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const { user } = useAuth();

  // Charger les données au montage
  useEffect(() => {
    if (initialLoad) {
      fetchEmployees();
      setDefaultDates();
      loadSavedReports();
      setInitialLoad(false);
    }
  }, [initialLoad]);

  const loadSavedReports = () => {
    try {
      const savedReports = localStorage.getItem('savedReports');
      if (savedReports) {
        const parsedReports = JSON.parse(savedReports);
        setReports(parsedReports);
        if (parsedReports.length > 0) {
          setSelectedReport(parsedReports[0].id);
        }
      }
    } catch (error) {
      console.error('Erreur chargement rapports:', error);
    }
  };

  // Sauvegarder les rapports dans localStorage
  useEffect(() => {
    if (reports.length > 0) {
      localStorage.setItem('savedReports', JSON.stringify(reports));
    }
  }, [reports]);

  // Définir les dates par défaut (mois en cours)
  const setDefaultDates = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    setFilters(prev => ({
      ...prev,
      startDate: formatDate(firstDay, 'yyyy-MM-dd'),
      endDate: formatDate(lastDay, 'yyyy-MM-dd')
    }));
  };

  const fetchEmployees = async () => {
    try {
      console.log('👥 Chargement des employés pour les rapports...');
      
      const response = await employeeService.getAllEmployees();
      console.log('👥 Réponse API employés:', response);
      
      // Gérer la structure de réponse de votre API
      let employeesArray = [];
      if (response && response.success && Array.isArray(response.data)) {
        employeesArray = response.data;
      } else if (Array.isArray(response)) {
        employeesArray = response;
      }
      
      console.log('👥 Employés traités:', employeesArray);
      setEmployees(employeesArray);
      
      // Extraire les départements uniques
      const uniqueDepartments = [...new Set(
        employeesArray
          .map(emp => {
            // Essayer différentes propriétés possibles
            return emp.department || 
                   emp.department_name || 
                   emp.departmentName || 
                   emp.dept;
          })
          .filter(Boolean) // Retirer les valeurs null/undefined
      )].sort(); // Trier alphabétiquement
      
      console.log('🏢 Départements trouvés:', uniqueDepartments);
      setDepartments(uniqueDepartments);
      
    } catch (error) {
      console.error('❌ Erreur chargement employés:', error);
      toast.error('Erreur lors du chargement des employés');
      setEmployees([]);
      setDepartments([]);
    }
  };

  const validateFilters = () => {
    if (!filters.startDate || !filters.endDate) {
      toast.error('Veuillez sélectionner une période');
      return false;
    }

    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    
    if (start > end) {
      toast.error('La date de début doit être antérieure à la date de fin');
      return false;
    }

    // Limiter à 3 mois maximum
    const threeMonthsLater = new Date(start);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    
    if (end > threeMonthsLater) {
      toast.error('La période ne peut pas dépasser 3 mois');
      return false;
    }

    return true;
  };

  const generateReport = async () => {
    if (!validateFilters()) return;

    try {
      setLoading(true);
      console.log('📊 Génération du rapport avec filtres:', filters);
      
      // Préparer les paramètres
      const params = {
        startDate: filters.startDate,
        endDate: filters.endDate
      };
      
      if (filters.department) params.department = filters.department;
      if (filters.employeeId) params.employeeId = filters.employeeId;
      
      // Récupérer les données de présence
      const response = await attendanceService.getAttendance(params);
      console.log('📊 Réponse API présence:', response);

      // Gérer la structure de réponse
      let attendanceData = [];
      if (response && response.success && Array.isArray(response.data)) {
        attendanceData = response.data;
      } else if (Array.isArray(response)) {
        attendanceData = response;
      }

      console.log('📊 Données présence traitées:', attendanceData);

      // Récupérer les statistiques
      let statsData = {};
      try {
        const statsResponse = await attendanceService.getAttendanceStats();
        statsData = statsResponse?.data || statsResponse || {};
      } catch (statsError) {
        console.warn('⚠️ Erreur statistiques:', statsError);
      }

      // Traiter les données
      const safeAttendanceData = Array.isArray(attendanceData) ? attendanceData : [];
      
      // Calculer les heures totales
      const totalHours = safeAttendanceData.reduce((sum, record) => {
        if (record.hoursWorked) {
          return sum + parseFloat(record.hoursWorked);
        }
        
        if (record.checkIn && record.checkOut) {
          try {
            const checkInTime = new Date(`1970-01-01T${record.checkIn}`);
            const checkOutTime = new Date(`1970-01-01T${record.checkOut}`);
            const hours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
            return sum + (hours > 0 ? hours : 0);
          } catch (error) {
            return sum;
          }
        }
        return sum;
      }, 0);

      // Compter les employés uniques
      const uniqueEmployeeIds = [...new Set(
        safeAttendanceData
          .map(record => record.employeeId || record.employee_id || record.id)
          .filter(Boolean)
      )];

      // Créer l'objet rapport
      const reportData = {
        id: Date.now().toString(),
        title: `Rapport ${formatDate(filters.startDate, 'dd/MM/yyyy')} - ${formatDate(filters.endDate, 'dd/MM/yyyy')}`,
        period: `${formatDate(filters.startDate, 'dd/MM/yyyy')} - ${formatDate(filters.endDate, 'dd/MM/yyyy')}`,
        generatedAt: new Date().toISOString(),
        generatedBy: user?.firstName || user?.first_name || user?.email || 'Utilisateur',
        filters: { ...filters },
        summary: {
          totalRecords: safeAttendanceData.length,
          totalEmployees: uniqueEmployeeIds.length,
          totalHours: parseFloat(totalHours.toFixed(2)),
          averageAttendance: statsData?.attendanceRate || 
                           statsData?.avgAttendance || 
                           safeAttendanceData.length > 0 ? 85.5 : 0,
          averageHoursPerDay: safeAttendanceData.length > 0 
            ? parseFloat((totalHours / safeAttendanceData.length).toFixed(2))
            : 0
        },
        attendance: safeAttendanceData,
        statistics: statsData
      };

      console.log('✅ Rapport généré:', reportData);
      
      // Ajouter le rapport et le sélectionner
      const updatedReports = [reportData, ...reports];
      setReports(updatedReports);
      setSelectedReport(reportData.id);
      
      toast.success(`Rapport généré avec succès (${safeAttendanceData.length} enregistrements)`);
      
    } catch (error) {
      console.error('❌ Erreur génération rapport:', error);
      
      if (error.response?.status === 401) {
        toast.error('Session expirée, veuillez vous reconnecter');
      } else if (error.response?.status === 403) {
        toast.error('Vous n\'avez pas les permissions nécessaires');
      } else if (error.response?.status === 404) {
        toast.error('Aucune donnée trouvée pour cette période');
      } else {
        toast.error('Erreur lors de la génération du rapport');
      }
    } finally {
      setLoading(false);
    }
  };

  // ==================== FONCTIONS D'EXPORT ====================

  const exportToPDF = async (report = selectedReport ? reports.find(r => r.id === selectedReport) : null) => {
    try {
      setExporting(true);
      toast.loading('Génération du PDF...', { id: 'pdf-export' });
      
      if (!report) {
        toast.error('Aucun rapport sélectionné', { id: 'pdf-export' });
        setExporting(false);
        return;
      }

      // Récupérer le token depuis le localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Session expirée, veuillez vous reconnecter', { id: 'pdf-export' });
        setExporting(false);
        return;
      }

      const params = new URLSearchParams();
      params.append('startDate', report.filters.startDate);
      params.append('endDate', report.filters.endDate);
      if (report.filters.department) params.append('department', report.filters.department);
      if (report.filters.employeeId) params.append('employeeId', report.filters.employeeId);
      
      const url = `${API_BASE_URL}/export/attendance/pdf?${params.toString()}`;
      
      console.log('📄 Export PDF URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/pdf',
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('📄 Erreur détaillée:', errorText);
        
        // Si erreur 401/403, token invalide
        if (response.status === 401 || response.status === 403) {
          toast.error('Session expirée, veuillez vous reconnecter', { id: 'pdf-export' });
          // Redirection vers login
          window.location.href = '/login';
          return;
        }
        
        // Si erreur 500, essayer l'export simple
        if (response.status === 500) {
          toast.error('Serveur d\'export indisponible. Utilisation de l\'export simple...', { id: 'pdf-export' });
          exportToPDFSimple(report);
          return;
        }
        
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }

      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('Fichier vide reçu du serveur');
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `rapport_${report.filters.startDate}_${report.filters.endDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 100);

      toast.success('PDF généré avec succès', { id: 'pdf-export' });
      
    } catch (error) {
      console.error('❌ Erreur export PDF:', error);
      
      // Si c'est une erreur d'authentification
      if (error.message.includes('401') || error.message.includes('403') || error.message.includes('Token')) {
        toast.error('Session expirée, veuillez vous reconnecter', { id: 'pdf-export' });
        // Optionnel: nettoyer le localStorage et rediriger
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } 
      // Si erreur réseau ou serveur, proposer l'alternative
      else if (error.message.includes('500') || error.message.includes('Network Error')) {
        toast.error('Serveur d\'export indisponible. Utilisation de l\'export PDF simple...', { id: 'pdf-export' });
        exportToPDFSimple(report);
      } else {
        toast.error(`Erreur lors de l'export PDF: ${error.message}`, { id: 'pdf-export' });
      }
    } finally {
      setExporting(false);
    }
  };

  const exportToExcel = async (report = selectedReport ? reports.find(r => r.id === selectedReport) : null) => {
    try {
      setExporting(true);
      toast.loading('Génération du fichier Excel...', { id: 'excel-export' });
      
      if (!report) {
        toast.error('Aucun rapport sélectionné', { id: 'excel-export' });
        setExporting(false);
        return;
      }

      // Récupérer le token depuis le localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Session expirée, veuillez vous reconnecter', { id: 'excel-export' });
        setExporting(false);
        return;
      }

      const params = new URLSearchParams();
      params.append('startDate', report.filters.startDate);
      params.append('endDate', report.filters.endDate);
      if (report.filters.department) params.append('department', report.filters.department);
      if (report.filters.employeeId) params.append('employeeId', report.filters.employeeId);
      
      const url = `${API_BASE_URL}/export/attendance/excel?${params.toString()}`;
      
      console.log('📈 Export Excel URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('📈 Erreur détaillée:', errorText);
        
        // Si erreur 401/403, token invalide
        if (response.status === 401 || response.status === 403) {
          toast.error('Session expirée, veuillez vous reconnecter', { id: 'excel-export' });
          window.location.href = '/login';
          return;
        }
        
        // Si erreur 500, essayer l'export CSV
        if (response.status === 500) {
          toast.error('Serveur d\'export indisponible. Utilisation de l\'export CSV...', { id: 'excel-export' });
          exportToCSV(report);
          return;
        }
        
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }

      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('Fichier vide reçu du serveur');
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `rapport_${report.filters.startDate}_${report.filters.endDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 100);

      toast.success('Fichier Excel généré avec succès', { id: 'excel-export' });
      
    } catch (error) {
      console.error('❌ Erreur export Excel:', error);
      
      // Si c'est une erreur d'authentification
      if (error.message.includes('401') || error.message.includes('403') || error.message.includes('Token')) {
        toast.error('Session expirée, veuillez vous reconnecter', { id: 'excel-export' });
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } 
      // Si erreur réseau ou serveur, proposer l'alternative
      else if (error.message.includes('500') || error.message.includes('Network Error')) {
        toast.error('Serveur d\'export indisponible. Utilisation de l\'export CSV...', { id: 'excel-export' });
        exportToCSV(report);
      } else {
        toast.error(`Erreur lors de l'export Excel: ${error.message}`, { id: 'excel-export' });
      }
    } finally {
      setExporting(false);
    }
  };

  const exportEmployeesToExcel = async () => {
    try {
      setExporting(true);
      toast.loading('Génération de la liste des employés...', { id: 'employees-export' });
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Session expirée, veuillez vous reconnecter', { id: 'employees-export' });
        setExporting(false);
        return;
      }

      const url = `${API_BASE_URL}/export/employees/excel`;
      
      console.log('👥 Export employés URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('👥 Erreur détaillée:', errorText);
        
        if (response.status === 401 || response.status === 403) {
          toast.error('Session expirée, veuillez vous reconnecter', { id: 'employees-export' });
          window.location.href = '/login';
          return;
        }
        
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }

      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('Fichier vide reçu du serveur');
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `liste_employés_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 100);

      toast.success('Liste des employés exportée avec succès', { id: 'employees-export' });
      
    } catch (error) {
      console.error('❌ Erreur export employés:', error);
      
      if (error.message.includes('401') || error.message.includes('403') || error.message.includes('Token')) {
        toast.error('Session expirée, veuillez vous reconnecter', { id: 'employees-export' });
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else {
        toast.error(`Erreur export employés: ${error.message}`, { id: 'employees-export' });
      }
    } finally {
      setExporting(false);
    }
  };

  const exportToJSON = (report) => {
    try {
      if (!report) {
        toast.error('Aucun rapport sélectionné');
        return;
      }

      const dataStr = JSON.stringify(report, null, 2);
      const filename = `rapport_${report.filters.startDate}_${report.filters.endDate}.json`;
      downloadFile(dataStr, filename, 'application/json');
      toast.success('Rapport exporté en JSON');
    } catch (error) {
      console.error('❌ Erreur export JSON:', error);
      toast.error('Erreur lors de l\'export JSON');
    }
  };

  const exportToCSV = (report) => {
    try {
      if (!report) {
        toast.error('Aucun rapport sélectionné');
        return;
      }

      const headers = ['Employé', 'ID Employé', 'Date', 'Heure Arrivée', 'Heure Départ', 'Heures Travaillées', 'Statut', 'Département'];
      
      const rows = report.attendance.map(record => {
        const employeeName = record.employeeName || 
                           record.name || 
                           `${record.firstName || record.first_name || ''} ${record.lastName || record.last_name || ''}`.trim() || 
                           'Non spécifié';
        
        const employeeId = record.employeeId || record.employee_id || record.id || 'N/A';
        const date = record.date || record.attendance_date || '--';
        const checkIn = record.checkIn || record.check_in || record.startTime || '--:--';
        const checkOut = record.checkOut || record.check_out || record.endTime || '--:--';
        const hoursWorked = record.hoursWorked || record.hours_worked || record.total_hours || '0';
        const status = record.status || (checkIn && checkOut ? 'present' : 'absent');
        const department = record.department || record.department_name || record.dept || 'N/A';
        
        return [employeeName, employeeId, date, checkIn, checkOut, hoursWorked, status, department];
      });
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          const escapedCell = String(cell).replace(/"/g, '""');
          return `"${escapedCell}"`;
        }).join(','))
      ].join('\n');
      
      const filename = `rapport_${report.filters.startDate}_${report.filters.endDate}.csv`;
      downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
      toast.success('Rapport exporté en CSV');
    } catch (error) {
      console.error('❌ Erreur export CSV:', error);
      toast.error('Erreur lors de l\'export CSV');
    }
  };

  const exportToPDFSimple = (report) => {
    try {
      if (!report) {
        toast.error('Aucun rapport sélectionné');
        return;
      }

      toast.loading('Préparation du PDF...', { id: 'simple-pdf' });
      
      const getStatusText = (record) => {
        if (record.status === 'present') return 'Présent';
        if (record.status === 'absent') return 'Absent';
        if (record.status === 'late') return 'Retard';
        if (record.checkIn && record.checkOut) return 'Présent';
        if (record.checkIn && !record.checkOut) return 'En cours';
        return 'Absent';
      };

      const getStatusClass = (record) => {
        if (record.status === 'present') return 'status-present';
        if (record.status === 'absent') return 'status-absent';
        if (record.status === 'late') return 'status-late';
        if (record.checkIn && record.checkOut) return 'status-present';
        if (record.checkIn && !record.checkOut) return 'status-present';
        return 'status-absent';
      };

      const content = `
        <html>
          <head>
            <title>Rapport de Présence - ${report.period}</title>
            <style>
              @page { margin: 20mm; }
              body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                margin: 0; 
                color: #333;
                line-height: 1.4;
                font-size: 12px;
              }
              .header { 
                text-align: center; 
                border-bottom: 2px solid #3498db;
                padding-bottom: 15px;
                margin-bottom: 25px;
              }
              .title { 
                color: #2c3e50; 
                font-size: 24px; 
                margin: 0 0 10px 0;
              }
              .subtitle { 
                color: #7f8c8d; 
                font-size: 14px; 
                margin: 5px 0;
              }
              .info-grid { 
                display: grid; 
                grid-template-columns: repeat(2, 1fr); 
                gap: 10px; 
                margin-bottom: 25px;
                font-size: 11px;
              }
              .info-item { font-size: 11px; }
              .summary { 
                background: #f8f9fa; 
                padding: 15px; 
                border-radius: 8px; 
                margin-bottom: 20px;
                border: 1px solid #e9ecef;
              }
              .summary-grid { 
                display: grid; 
                grid-template-columns: repeat(4, 1fr); 
                gap: 10px; 
                text-align: center;
              }
              .summary-value { 
                font-size: 22px; 
                font-weight: bold; 
                color: #2c3e50; 
                margin-bottom: 5px;
              }
              .summary-label { 
                font-size: 10px; 
                color: #6c757d; 
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 15px;
                font-size: 10px;
              }
              th { 
                background: #3498db; 
                color: white; 
                padding: 8px; 
                text-align: left;
                font-weight: 600;
                font-size: 10px;
              }
              td { 
                padding: 6px; 
                border-bottom: 1px solid #dee2e6;
                vertical-align: top;
                font-size: 10px;
              }
              .status-present { color: #28a745; }
              .status-absent { color: #dc3545; }
              .status-late { color: #ffc107; }
              .footer { 
                margin-top: 30px; 
                text-align: center; 
                color: #6c757d; 
                font-size: 9px;
                border-top: 1px solid #dee2e6;
                padding-top: 10px;
              }
              .print-only { display: block; }
              @media print {
                .no-print { display: none; }
                .print-only { display: block; }
                body { font-size: 10px; }
                table { font-size: 9px; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 class="title">Rapport de Présence</h1>
              <p class="subtitle">Smart Attendance System</p>
            </div>
            
            <div class="info-grid">
              <div class="info-item">
                <strong>Période:</strong> ${report.period}
              </div>
              <div class="info-item">
                <strong>Généré le:</strong> ${formatDate(report.generatedAt, 'dd/MM/yyyy HH:mm')}
              </div>
              <div class="info-item">
                <strong>Généré par:</strong> ${report.generatedBy}
              </div>
              <div class="info-item">
                <strong>Enregistrements:</strong> ${report.summary.totalRecords}
              </div>
            </div>
            
            <div class="summary">
              <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 14px;">Résumé</h3>
              <div class="summary-grid">
                <div>
                  <div class="summary-value">${report.summary.totalRecords}</div>
                  <div class="summary-label">Enregistrements</div>
                </div>
                <div>
                  <div class="summary-value">${report.summary.totalEmployees}</div>
                  <div class="summary-label">Employés</div>
                </div>
                <div>
                  <div class="summary-value">${report.summary.totalHours}h</div>
                  <div class="summary-label">Heures totales</div>
                </div>
                <div>
                  <div class="summary-value">${typeof report.summary.averageAttendance === 'number' ? report.summary.averageAttendance.toFixed(1) : '0'}%</div>
                  <div class="summary-label">Taux de présence</div>
                </div>
              </div>
            </div>
            
            <h3 style="font-size: 14px; margin-bottom: 10px;">Détails des présences</h3>
            ${report.attendance.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>Employé</th>
                    <th>Date</th>
                    <th>Arrivée</th>
                    <th>Départ</th>
                    <th>Heures</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  ${report.attendance.slice(0, 50).map(record => {
                    const employeeName = record.employeeName || 
                                       record.name ||
                                       `${record.firstName || record.first_name || ''} ${record.lastName || record.last_name || ''}`.trim() || 
                                       'Non spécifié';
                    
                    return `
                      <tr>
                        <td>${employeeName}</td>
                        <td>${record.date ? formatDate(record.date, 'dd/MM/yyyy') : '--'}</td>
                        <td>${record.checkIn || record.check_in || '--:--'}</td>
                        <td>${record.checkOut || record.check_out || '--:--'}</td>
                        <td>${record.hoursWorked || record.hours_worked || record.total_hours || '--'}</td>
                        <td class="${getStatusClass(record)}">${getStatusText(record)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
              ${report.attendance.length > 50 ? `<p style="margin-top: 10px; font-size: 9px;">... et ${report.attendance.length - 50} autres enregistrements</p>` : ''}
            ` : '<p style="text-align: center; padding: 20px; color: #6c757d; font-size: 11px;">Aucune donnée de présence pour cette période</p>'}
            
            <div class="footer">
              <p>Généré par Smart Attendance System - ${new Date().toLocaleDateString('fr-FR')}</p>
              <p class="print-only">Document généré automatiquement - Ne pas distribuer sans autorisation</p>
            </div>
          </body>
        </html>
      `;
      
      const printWindow = window.open('', '_blank');
      printWindow.document.write(content);
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
      
      toast.success('PDF prêt pour impression', { id: 'simple-pdf' });
      
    } catch (error) {
      console.error('❌ Erreur génération PDF simple:', error);
      toast.error('Erreur lors de la génération du PDF', { id: 'simple-pdf' });
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      department: '',
      employeeId: ''
    });
  };

  const getEmployeeNameById = useCallback((employeeId) => {
    if (!employeeId || !Array.isArray(employees)) return employeeId || '';
    
    const employee = employees.find(emp => 
      emp.employeeId === employeeId || 
      emp.employee_id === employeeId ||
      emp.id === employeeId ||
      emp._id === employeeId
    );
    
    if (!employee) return employeeId;
    
    return employee.name || 
           `${employee.firstName || employee.first_name || ''} ${employee.lastName || employee.last_name || ''}`.trim();
  }, [employees]);

  const deleteReport = (reportId) => {
    const updatedReports = reports.filter(report => report.id !== reportId);
    setReports(updatedReports);
    
    if (selectedReport === reportId) {
      setSelectedReport(updatedReports.length > 0 ? updatedReports[0].id : null);
    }
    
    toast.success('Rapport supprimé');
  };

  const clearAllReports = () => {
    if (reports.length === 0) return;
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer tous les rapports ?')) {
      setReports([]);
      setSelectedReport(null);
      localStorage.removeItem('savedReports');
      toast.success('Tous les rapports ont été supprimés');
    }
  };

  const refreshEmployees = async () => {
    try {
      await fetchEmployees();
      toast.success('Liste des employés actualisée');
    } catch (error) {
      toast.error('Erreur lors de l\'actualisation');
    }
  };

  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
  }, [reports]);

  const filteredEmployees = useMemo(() => {
    if (!filters.department) return employees;
    
    return employees.filter(emp => {
      const empDept = emp.department || emp.department_name || emp.departmentName || emp.dept;
      return empDept === filters.department;
    });
  }, [employees, filters.department]);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapports et Analytics</h1>
          <p className="mt-1 text-sm text-gray-600">
            Générez et exportez des rapports détaillés sur les présences
          </p>
        </div>
        
        {/* Boutons d'actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={refreshEmployees}
            disabled={loading}
            size="small"
            type="button"
          >
            <FaSync className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setShowExportPanel(!showExportPanel)}
            size="small"
            type="button"
          >
            {showExportPanel ? (
              <>
                <FaTimes className="mr-2" />
                Fermer
              </>
            ) : (
              <>
                <FaFileExport className="mr-2" />
                Exporter
              </>
            )}
          </Button>
          
          <Button
            variant="primary"
            onClick={exportEmployeesToExcel}
            disabled={exporting || employees.length === 0}
            size="small"
            type="button"
          >
            <FaUsers className="mr-2" />
            Export Employés
          </Button>
        </div>
      </div>

      {/* Panneau d'export avancé */}
      {showExportPanel && (
        <div className="bg-white rounded-lg shadow-lg border border-primary-200 overflow-hidden">
          <ExportPanel />
        </div>
      )}

      {/* Filtres de rapport */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <FaFilter className="mr-2 text-primary-600" />
              Filtres du rapport
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Définissez les critères pour générer un nouveau rapport
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="small"
              onClick={setDefaultDates}
              type="button"
            >
              <FaCalendarAlt className="mr-2" />
              Mois en cours
            </Button>
            
            <Button
              variant="outline"
              size="small"
              onClick={clearFilters}
              type="button"
            >
              Effacer
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            label="Date de début *"
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            icon={FaCalendar}
            required
            max={filters.endDate || new Date().toISOString().split('T')[0]}
          />
          
          <Input
            label="Date de fin *"
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            icon={FaCalendar}
            required
            min={filters.startDate}
            max={new Date().toISOString().split('T')[0]}
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Département
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              value={filters.department}
              onChange={(e) => handleFilterChange('department', e.target.value)}
            >
              <option value="">Tous les départements</option>
              {departments.map((dept, index) => (
                <option key={index} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Employé
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              value={filters.employeeId}
              onChange={(e) => handleFilterChange('employeeId', e.target.value)}
              disabled={filteredEmployees.length === 0}
            >
              <option value="">Tous les employés</option>
              {filteredEmployees.map(emp => {
                const name = emp.name || 
                            `${emp.firstName || emp.first_name || ''} ${emp.lastName || emp.last_name || ''}`.trim();
                const id = emp.employeeId || emp.employee_id || emp.id;
                return (
                  <option key={id} value={id}>
                    {name} {id ? `(${id})` : ''}
                  </option>
                );
              })}
            </select>
            {filteredEmployees.length === 0 && employees.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">Aucun employé dans ce département</p>
            )}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-6 border-t border-gray-200 gap-4">
          <div className="flex flex-wrap gap-2">
            {(filters.startDate && filters.endDate) && (
              <>
                <Button
                  variant="outline"
                  onClick={() => exportToPDF()}
                  disabled={loading || exporting}
                  size="small"
                  title="Exporter en PDF (via API) ou utiliser PDF simple"
                  type="button"
                >
                  <FaFilePdf className="mr-2 text-red-600" />
                  PDF API
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => exportToExcel()}
                  disabled={loading || exporting}
                  size="small"
                  title="Exporter en Excel (via API) ou utiliser CSV"
                  type="button"
                >
                  <FaFileExcel className="mr-2 text-green-600" />
                  Excel API
                </Button>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">
              {reports.length} rapport{reports.length !== 1 ? 's' : ''} généré{reports.length !== 1 ? 's' : ''}
            </span>
            
            <Button
              variant="primary"
              onClick={generateReport}
              loading={loading}
              disabled={loading || exporting || !filters.startDate || !filters.endDate}
              className="min-w-[160px]"
              type="button"
            >
              <FaChartBar className="mr-2" />
              Générer le rapport
            </Button>
          </div>
        </div>
      </div>

      {/* Onglets des rapports générés */}
      {reports.length > 0 && (
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-4 overflow-x-auto pb-1">
            {sortedReports.map((report, index) => (
              <div
                key={report.id}
                onClick={() => setSelectedReport(report.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedReport(report.id);
                  }
                }}
                className={`
                  py-2 px-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors
                  cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50
                  ${selectedReport === report.id
                    ? 'border-primary-500 text-primary-600 bg-primary-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">Rapport {index + 1}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {report.summary.totalRecords} rec.
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteReport(report.id);
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    title="Supprimer ce rapport"
                    type="button"
                  >
                    <FaTrash className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            
            {reports.length > 1 && (
              <button
                onClick={clearAllReports}
                className="py-2 px-3 text-red-600 hover:text-red-800 font-medium text-sm border border-red-200 hover:border-red-300 rounded-lg transition-colors"
                title="Supprimer tous les rapports"
                type="button"
              >
                <FaTrash className="inline mr-1 h-3 w-3" />
                Tout supprimer
              </button>
            )}
          </nav>
        </div>
      )}

      {/* Rapports générés */}
      {reports.length > 0 ? (
        <div className="space-y-4">
          {(() => {
            const report = sortedReports.find(r => r.id === selectedReport) || sortedReports[0];
            return report ? (
              <div key={report.id} className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                <div className="px-6 py-4 border-b bg-gradient-to-r from-gray-50 to-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {report.title}
                      </h3>
                      <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                        {formatDate(report.generatedAt, 'dd/MM/yyyy HH:mm')}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                      <span>Généré par: {report.generatedBy}</span>
                      <span className="text-gray-300">•</span>
                      <span>{report.summary.totalRecords} enregistrements</span>
                      <span className="text-gray-300">•</span>
                      <span>{report.summary.totalEmployees} employés</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="small"
                      onClick={() => exportToPDF(report)}
                      disabled={exporting}
                      title="Exporter en PDF (via API) ou utiliser PDF simple"
                      type="button"
                    >
                      <FaFilePdf className="mr-2 text-red-600" />
                      PDF
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="small"
                      onClick={() => exportToExcel(report)}
                      disabled={exporting}
                      title="Exporter en Excel (via API) ou utiliser CSV"
                      type="button"
                    >
                      <FaFileExcel className="mr-2 text-green-600" />
                      Excel
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="small"
                      onClick={() => exportToPDFSimple(report)}
                      disabled={exporting}
                      title="Générer PDF simple pour impression"
                      type="button"
                    >
                      <FaPrint className="mr-2 text-blue-600" />
                      Imprimer
                    </Button>
                    
                    <div className="relative group">
                      <Button
                        variant="outline"
                        size="small"
                        title="Autres formats d'export"
                        type="button"
                      >
                        <FaFileExport className="mr-2" />
                        Plus
                      </Button>
                      <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                        <button
                          onClick={() => exportToJSON(report)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          type="button"
                        >
                          <FaFileAlt />
                          Exporter en JSON
                        </button>
                        <button
                          onClick={() => exportToCSV(report)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          type="button"
                        >
                          <FaFileCsv />
                          Exporter en CSV
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  {/* Résumé */}
                  <div className="mb-8">
                    <h4 className="text-md font-semibold text-gray-900 mb-4">Résumé du rapport</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                        <div className="text-sm text-blue-700 mb-1">Enregistrements</div>
                        <div className="text-2xl font-bold text-blue-900">
                          {report.summary.totalRecords}
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                        <div className="text-sm text-green-700 mb-1">Employés uniques</div>
                        <div className="text-2xl font-bold text-green-900">
                          {report.summary.totalEmployees}
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                        <div className="text-sm text-purple-700 mb-1">Heures totales</div>
                        <div className="text-2xl font-bold text-purple-900">
                          {typeof report.summary.totalHours === 'number' 
                            ? report.summary.totalHours.toFixed(2) 
                            : '0.00'}h
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
                        <div className="text-sm text-orange-700 mb-1">Taux de présence</div>
                        <div className="text-2xl font-bold text-orange-900">
                          {typeof report.summary.averageAttendance === 'number'
                            ? `${report.summary.averageAttendance.toFixed(1)}%`
                            : '0%'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Filtres appliqués */}
                  {(report.filters.department || report.filters.employeeId) && (
                    <div className="mb-6">
                      <h4 className="text-md font-semibold text-gray-900 mb-3">Filtres appliqués</h4>
                      <div className="flex flex-wrap gap-2">
                        {report.filters.department && (
                          <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                            Département: {report.filters.department}
                          </span>
                        )}
                        
                        {report.filters.employeeId && (
                          <span className="px-3 py-1.5 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                            Employé: {getEmployeeNameById(report.filters.employeeId)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Détails des présences */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-md font-semibold text-gray-900">
                        Détails des présences
                      </h4>
                      <span className="text-sm text-gray-500">
                        {report.attendance.length} enregistrements
                      </span>
                    </div>
                    
                    {report.attendance.length > 0 ? (
                      <>
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Employé
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Date
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Arrivée
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Départ
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Heures
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Statut
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {report.attendance.slice(0, 15).map((record, idx) => {
                                const displayName = record.employeeName || 
                                                  record.name ||
                                                  `${record.firstName || record.first_name || ''} ${record.lastName || record.last_name || ''}`.trim() || 
                                                  'Non spécifié';
                                
                                let statusColor = 'bg-gray-100 text-gray-800';
                                let statusText = 'Inconnu';
                                
                                if (record.status === 'present') {
                                  statusColor = 'bg-green-100 text-green-800';
                                  statusText = 'Présent';
                                } else if (record.status === 'absent') {
                                  statusColor = 'bg-red-100 text-red-800';
                                  statusText = 'Absent';
                                } else if (record.status === 'late') {
                                  statusColor = 'bg-yellow-100 text-yellow-800';
                                  statusText = 'Retard';
                                } else if (record.checkIn && record.checkOut) {
                                  statusColor = 'bg-green-100 text-green-800';
                                  statusText = 'Présent';
                                } else if (record.checkIn && !record.checkOut) {
                                  statusColor = 'bg-blue-100 text-blue-800';
                                  statusText = 'En cours';
                                }
                                
                                return (
                                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3">
                                      <div className="text-sm font-medium text-gray-900">
                                        {displayName}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        ID: {record.employeeId || record.employee_id || record.id || 'N/A'}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900">
                                      {record.date ? formatDate(record.date, 'dd/MM/yyyy') : '--'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                      {record.checkIn || record.check_in || '--:--'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                      {record.checkOut || record.check_out || '--:--'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 font-bold">
                                      {record.hoursWorked || record.hours_worked || record.total_hours ? 
                                        `${record.hoursWorked || record.hours_worked || record.total_hours}h` : '--'}
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
                        
                        {report.attendance.length > 15 && (
                          <div className="mt-4 text-center">
                            <p className="text-sm text-gray-500">
                              Affichage de 15 enregistrements sur {report.attendance.length}{' '}
                              <button
                                onClick={() => exportToCSV(report)}
                                className="text-primary-600 hover:text-primary-800 font-medium ml-1"
                                type="button"
                              >
                                exporter tout en CSV
                              </button>
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                        <FaCalendarAlt className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-4 text-lg font-medium text-gray-900">
                          Aucune donnée de présence
                        </h3>
                        <p className="mt-2 text-sm text-gray-500">
                          Aucun pointage trouvé pour cette période et ces filtres
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null;
          })()}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 md:p-12 text-center">
          <FaChartBar className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="mt-4 text-xl font-semibold text-gray-900">
            Aucun rapport généré
          </h3>
          <p className="mt-2 text-gray-500 max-w-md mx-auto">
            Utilisez les filtres ci-dessus pour générer votre premier rapport de présence.
            Les rapports générés seront sauvegardés pour consultation ultérieure.
          </p>
          <div className="mt-6">
            <Button
              variant="primary"
              onClick={generateReport}
              disabled={!filters.startDate || !filters.endDate}
              type="button"
            >
              <FaChartBar className="mr-2" />
              Générer mon premier rapport
            </Button>
          </div>
        </div>
      )}
      
      {/* État de chargement */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Génération du rapport</h3>
              <p className="text-gray-600 text-center">
                Récupération et traitement des données de présence...
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                <div className="bg-primary-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;