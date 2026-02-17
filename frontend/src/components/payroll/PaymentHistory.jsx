// src/components/payroll/PaymentHistory.jsx
import React, { useState, useEffect, useRef } from 'react'; 
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Solution simplifiée pour jspdf-autotable
const PDFExport = {
  // Fonction de fallback pour créer un tableau PDF manuellement
  createTable: (doc, data, startY, headers = null, options = {}) => {
    try {
      // Essayer d'utiliser autoTable si disponible
      if (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) {
        try {
          const autoTable = window.jspdf.autoTable;
          if (autoTable) {
            return autoTable(doc, {
              head: [headers || ['Mois', 'ID Employé', 'Nom', 'Département', 'Salaire Net', 'Statut', 'Date Paiement']],
              body: data,
              startY,
              theme: 'grid',
              headStyles: { 
                fillColor: [41, 128, 185], 
                textColor: 255,
                fontStyle: 'bold'
              },
              ...options
            });
          }
        } catch (error) {
          console.warn('AutoTable error, using manual table:', error);
        }
      }
    } catch (error) {
      console.warn('AutoTable check failed:', error);
    }
    
    // Fallback: créer un tableau manuellement
    return createManualPDFTable(doc, data, startY, headers, options);
  }
};

// Fonction pour créer un tableau PDF manuellement
const createManualPDFTable = (doc, data, startY, headers = null, options = {}) => {
  const pageWidth = doc.internal.pageSize.width;
  const margin = 14;
  const rowHeight = 10;
  const colWidths = headers ? 
    [35, 25, 35, 30, 30, 25, 30] : 
    [25, 20, 30, 25, 25, 20, 25];
  
  let y = startY;
  const headerLabels = headers || ['Mois', 'ID Employé', 'Nom', 'Département', 'Salaire Net', 'Statut', 'Date Paiement'];
  
  // Dessiner l'en-tête
  doc.setFillColor(41, 128, 185);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  
  let x = margin;
  for (let i = 0; i < headerLabels.length; i++) {
    doc.rect(x, y, colWidths[i], rowHeight, 'F');
    doc.text(headerLabels[i], x + 2, y + 7);
    x += colWidths[i];
  }
  
  y += rowHeight;
  
  // Dessiner les données
  doc.setFillColor(255, 255, 255);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  
  for (const row of data) {
    // Vérifier si on doit ajouter une nouvelle page
    if (y + rowHeight > doc.internal.pageSize.height - 20) {
      doc.addPage('landscape');
      y = margin;
      
      // Redessiner l'en-tête sur la nouvelle page
      x = margin;
      doc.setFillColor(41, 128, 185);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      
      for (let i = 0; i < headerLabels.length; i++) {
        doc.rect(x, y, colWidths[i], rowHeight, 'F');
        doc.text(headerLabels[i], x + 2, y + 7);
        x += colWidths[i];
      }
      
      y += rowHeight;
      doc.setFillColor(255, 255, 255);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
    }
    
    // Dessiner la ligne de données
    x = margin;
    for (let i = 0; i < row.length; i++) {
      const cellValue = row[i] || '';
      doc.text(cellValue.toString(), x + 2, y + 7);
      x += colWidths[i];
    }
    
    // Ligne séparatrice
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
    
    y += rowHeight;
  }
  
  return { finalY: y };
};

const PaymentHistory = () => {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [filters, setFilters] = useState({
    month_year: '',
    employee_id: '',
    status: '',
    department: '',
    date_range: 'all'
  });
  const [stats, setStats] = useState({
    total_payments: 0,
    total_amount: 0,
    paid_payments: 0,
    departments: [],
    months: []
  });
  const [exportLoading, setExportLoading] = useState(false);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [apiError, setApiError] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [hasTriedAllEndpoints, setHasTriedAllEndpoints] = useState(false);
  const tableRef = useRef(null);
  const reportRef = useRef(null);

  // ==================== INITIALISATION ====================
  useEffect(() => {
    loadPaymentHistory();
    loadAvailableFilters();
  }, []);

  // ==================== CHARGEMENT DES FILTRES ====================
  const loadAvailableFilters = async () => {
    try {
      console.log('🔄 Chargement des filtres disponibles...');
      
      // Charger les mois disponibles
      try {
        const monthsResponse = await api.get('/payroll/pay-months', {
          timeout: 3000
        });
        
        let monthsData = [];
        
        // Essayer différents formats de réponse
        if (monthsResponse.data) {
          if (monthsResponse.data.data && Array.isArray(monthsResponse.data.data)) {
            monthsData = monthsResponse.data.data;
          } else if (Array.isArray(monthsResponse.data)) {
            monthsData = monthsResponse.data;
          } else if (monthsResponse.data.payments) {
            monthsData = monthsResponse.data.payments;
          }
        }
        
        if (!Array.isArray(monthsData) || monthsData.length === 0) {
          console.warn('⚠️ Aucun mois trouvé, utilisation des valeurs par défaut');
          monthsData = generateDefaultMonths();
        }
        
        const paidMonths = monthsData
          .filter(month => month && (month.status === 'paid' || month.status === 'completed' || month.paid === true))
          .map(month => ({
            value: month.month_year || month.id || month.month || '',
            label: month.month_name || month.name || formatMonthLabel(month.month_year || month.month) || 'Mois inconnu'
          }))
          .filter(month => month.value && month.label);
        
        console.log(`📅 ${paidMonths.length} mois payés trouvés`);
        setAvailableMonths(paidMonths);
      } catch (monthsError) {
        console.warn('❌ Erreur chargement des mois:', monthsError.message);
        setAvailableMonths(generateDefaultMonths());
      }

      // Charger les départements
      try {
        // Essayer différents endpoints pour les employés
        const endpoints = ['/employees', '/payroll/employees', '/staff/employees'];
        let employeesData = [];
        
        for (const endpoint of endpoints) {
          try {
            const response = await api.get(endpoint, { 
              timeout: 2000,
              validateStatus: (status) => status < 500
            });
            
            if (response.status === 200 && response.data) {
              let data = [];
              
              if (response.data.data && Array.isArray(response.data.data)) {
                data = response.data.data;
              } else if (Array.isArray(response.data)) {
                data = response.data;
              } else if (response.data.employees) {
                data = response.data.employees;
              }
              
              if (Array.isArray(data) && data.length > 0) {
                employeesData = data;
                console.log(`✅ Employés chargés depuis ${endpoint}: ${data.length}`);
                break;
              }
            }
          } catch (error) {
            console.log(`❌ Endpoint ${endpoint} échoué:`, error.message);
          }
        }
        
        let depts = [];
        if (employeesData.length > 0) {
          depts = [...new Set(employeesData
            .map(emp => emp && (emp.department || emp.department_name || emp.dept || emp.service))
            .filter(Boolean)
            .map(dept => dept.toString().trim())
          )].sort();
        }
        
        if (depts.length === 0) {
          depts = ['IT', 'RH', 'Finance', 'Marketing', 'Production', 'Commercial', 'Logistique'];
        }
        
        console.log(`🏢 ${depts.length} départements trouvés`);
        setAvailableDepartments(depts);
      } catch (deptError) {
        console.warn('⚠️ Erreur chargement départements, valeurs par défaut utilisées');
        setAvailableDepartments(['IT', 'RH', 'Finance', 'Marketing', 'Production']);
      }

    } catch (error) {
      console.error('💥 Erreur générale chargement filtres:', error);
      // Valeurs par défaut en cas d'erreur totale
      setAvailableMonths(generateDefaultMonths());
      setAvailableDepartments(['IT', 'RH', 'Finance', 'Marketing', 'Production']);
    }
  };

  // ==================== CHARGEMENT HISTORIQUE SIMPLIFIÉ ====================
  const loadPaymentHistory = async () => {
    try {
      setLoading(true);
      setApiError(null);
      setIsDemoMode(false);
      setHasTriedAllEndpoints(false);
      
      console.log('🔄 Tentative de chargement de l\'historique...');

      // Essayer les endpoints principaux
      let paymentsData = [];
      let successfulEndpoint = null;
      
      // 1. Essayer l'endpoint principal
      try {
        console.log('🔍 Essai endpoint principal: /payroll/history');
        const response = await api.get('/payroll/history', {
          params: { limit: 100 },
          timeout: 5000
        });
        
        if (response.data) {
          const extractedData = extractPaymentsData(response.data);
          if (extractedData.length > 0) {
            paymentsData = extractedData;
            successfulEndpoint = '/payroll/history';
            console.log(`✅ ${paymentsData.length} paiements chargés depuis /payroll/history`);
          }
        }
      } catch (error) {
        console.log('❌ Endpoint /payroll/history échoué:', error.message);
      }
      
      // 2. Si échec, essayer de charger mois par mois
      if (paymentsData.length === 0) {
        console.log('🔍 Tentative de chargement mois par mois...');
        paymentsData = await loadPaymentsByMonth();
        if (paymentsData.length > 0) {
          successfulEndpoint = 'month-by-month';
          console.log(`✅ ${paymentsData.length} paiements chargés mois par mois`);
        }
      }
      
      // 3. Si toujours échec, charger depuis le cache
      if (paymentsData.length === 0) {
        console.log('🔍 Tentative de chargement depuis le cache...');
        paymentsData = loadFromCache();
        if (paymentsData.length > 0) {
          successfulEndpoint = 'cache';
          console.log(`✅ ${paymentsData.length} paiements chargés depuis le cache`);
        }
      }
      
      // 4. Si tout échoue, mode démo
      if (paymentsData.length === 0) {
        console.log('🎭 Aucune donnée disponible, chargement mode démo');
        paymentsData = generateDemoData();
        setIsDemoMode(true);
        successfulEndpoint = 'demo';
        console.log(`✅ ${paymentsData.length} paiements démo générés`);
      }
      
      // Traiter les données
      processPaymentsData(paymentsData);
      
      let message = '';
      if (successfulEndpoint === 'demo') {
        message = `🎭 Mode démo: ${paymentsData.length} paiements factices`;
        toast.info(message);
      } else if (paymentsData.length > 0) {
        message = `✅ ${paymentsData.length} paiements chargés`;
        if (successfulEndpoint && successfulEndpoint !== 'cache') {
          message += ` depuis ${successfulEndpoint}`;
        }
        toast.success(message);
      }
      
    } catch (error) {
      console.error('💥 Erreur critique chargement historique:', error);
      // En cas d'erreur critique, charger les données démo
      const demoData = generateDemoData();
      processPaymentsData(demoData);
      setIsDemoMode(true);
      toast.info(`🎭 Mode démo: ${demoData.length} paiements factices`);
    } finally {
      setLoading(false);
    }
  };

  // ==================== CHARGEMENT MOIS PAR MOIS ====================
  const loadPaymentsByMonth = async () => {
    try {
      console.log('📅 Récupération des mois payés...');
      
      let paidMonths = [];
      try {
        const monthsResponse = await api.get('/payroll/pay-months', { 
          timeout: 3000,
          validateStatus: (status) => status < 500
        });
        
        let monthsData = [];
        if (monthsResponse.data) {
          if (monthsResponse.data.data && Array.isArray(monthsResponse.data.data)) {
            monthsData = monthsResponse.data.data;
          } else if (Array.isArray(monthsResponse.data)) {
            monthsData = monthsResponse.data;
          }
        }
        
        paidMonths = monthsData.filter(m => 
          m && (m.status === 'paid' || m.status === 'completed' || m.paid === true)
        );
        
        console.log(`📊 ${paidMonths.length} mois payés trouvés`);
      } catch (error) {
        console.log('⚠️ Impossible de charger les mois:', error.message);
      }
      
      // Si pas de mois, créer des mois par défaut
      if (paidMonths.length === 0) {
        const currentDate = new Date();
        for (let i = 2; i >= 0; i--) {
          const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
          paidMonths.push({
            month_year: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`,
            month_name: date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
          });
        }
        console.log(`📅 ${paidMonths.length} mois par défaut créés`);
      }
      
      // Charger les paiements pour chaque mois
      let allPayments = [];
      const successfulMonths = [];
      
      // Limiter à 2 mois pour éviter trop de requêtes
      const monthsToLoad = paidMonths.slice(0, 2);
      
      for (const month of monthsToLoad) {
        try {
          const monthYear = month.month_year || month.month;
          if (!monthYear) continue;
          
          console.log(`🔍 Chargement du mois ${monthYear}...`);
          const response = await api.get(`/payroll/payments/${monthYear}`, { 
            timeout: 3000,
            validateStatus: (status) => status < 500
          });
          
          if (response.status === 200 && response.data) {
            let monthPayments = [];
            
            // Extraire les paiements de la réponse
            if (response.data.data && Array.isArray(response.data.data)) {
              monthPayments = response.data.data;
            } else if (response.data.payments && Array.isArray(response.data.payments)) {
              monthPayments = response.data.payments;
            } else if (Array.isArray(response.data)) {
              monthPayments = response.data;
            }
            
            if (monthPayments.length > 0) {
              // Normaliser les données
              const normalizedPayments = monthPayments.map(item => ({
                id: item.id || item._id || Math.random().toString(36).substr(2, 9),
                employee_id: item.employee_id || item.employeeId || item.employee || `EMP${Math.floor(Math.random() * 1000)}`,
                first_name: item.first_name || item.firstName || item.prenom || 'Prénom',
                last_name: item.last_name || item.lastName || item.nom || 'Nom',
                email: item.email || item.mail || '',
                department: item.department || item.department_name || item.dept || item.service || 'Non spécifié',
                position: item.position || item.poste || item.job_title || item.role || 'Non spécifié',
                base_salary: parseFloat(item.base_salary || item.base_amount || item.salary || item.base || 0),
                tax_amount: parseFloat(item.tax_amount || item.taxes || item.tax || 0),
                deduction_amount: parseFloat(item.deduction_amount || item.deductions || item.deduction || 0),
                net_salary: parseFloat(item.net_salary || item.net_amount || item.amount || item.total || 0),
                payment_status: item.payment_status || item.status || item.etat || 'pending',
                month_year: monthYear,
                month_name: month.month_name || formatMonthLabel(monthYear),
                paid_at: item.paid_at || item.paid_date || item.date_paid || item.payment_date || null,
                created_at: item.created_at || item.created_date || item.date || new Date().toISOString()
              }));
              
              allPayments = [...allPayments, ...normalizedPayments];
              successfulMonths.push(monthYear);
              console.log(`✅ Mois ${monthYear}: ${normalizedPayments.length} paiements`);
            } else {
              console.log(`⚠️ Mois ${monthYear}: aucune donnée de paiement`);
            }
          } else {
            console.log(`⚠️ Mois ${monthYear}: réponse ${response.status}`);
          }
        } catch (error) {
          console.log(`❌ Erreur chargement mois ${month.month_year}:`, error.message);
        }
      }
      
      console.log(`📊 ${successfulMonths.length}/${monthsToLoad.length} mois chargés avec succès`);
      
      // Sauvegarder dans le cache si on a des données
      if (allPayments.length > 0) {
        saveToCache(allPayments);
      }
      
      return allPayments;
      
    } catch (error) {
      console.error('💥 Erreur chargement mois par mois:', error);
      return [];
    }
  };

  // ==================== GESTION DU CACHE ====================
  const loadFromCache = () => {
    try {
      const cachedData = localStorage.getItem('payroll_history_cache');
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        
        // Vérifier si le cache n'est pas trop vieux (24 heures)
        const cacheAge = parsedData.timestamp ? 
          (new Date() - new Date(parsedData.timestamp)) / (1000 * 60 * 60) : 25;
        
        if (cacheAge < 24 && parsedData.payments && Array.isArray(parsedData.payments)) {
          console.log(`📦 ${parsedData.payments.length} paiements récupérés du cache (âge: ${cacheAge.toFixed(1)}h)`);
          return parsedData.payments;
        } else {
          console.log(`🗑️  Cache expiré ou invalide (âge: ${cacheAge.toFixed(1)}h)`);
          localStorage.removeItem('payroll_history_cache');
        }
      }
    } catch (error) {
      console.log('❌ Erreur lecture cache:', error.message);
    }
    return [];
  };

  const saveToCache = (payments) => {
    try {
      localStorage.setItem('payroll_history_cache', JSON.stringify({
        timestamp: new Date().toISOString(),
        payments: payments
      }));
      console.log('💾 Données sauvegardées dans le cache');
    } catch (error) {
      console.log('⚠️ Impossible de sauvegarder le cache:', error.message);
    }
  };

  // ==================== DONNÉES DE DÉMONSTRATION ====================
  const generateDemoData = () => {
    console.log('🎭 Génération de données de démonstration...');
    
    const departments = ['IT', 'RH', 'Finance', 'Marketing', 'Production'];
    const firstNames = ['Jean', 'Marie', 'Pierre', 'Sophie', 'Luc', 'Julie', 'Thomas', 'Emma', 'Paul', 'Claire'];
    const lastNames = ['Dupont', 'Martin', 'Bernard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Michel'];
    const positions = ['Développeur', 'Manager', 'Analyste', 'Designer', 'Comptable', 'Commercial', 'Technicien', 'Consultant'];
    
    const demoData = [];
    const currentDate = new Date();
    
    // Générer des données pour les 3 derniers mois
    for (let monthOffset = 2; monthOffset >= 0; monthOffset--) {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthOffset, 1);
      const monthYear = `${monthDate.getFullYear()}-${(monthDate.getMonth() + 1).toString().padStart(2, '0')}`;
      const monthName = monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      
      // Générer 6-8 paiements par mois
      const paymentsPerMonth = 6 + Math.floor(Math.random() * 3);
      
      for (let i = 0; i < paymentsPerMonth; i++) {
        const dept = departments[Math.floor(Math.random() * departments.length)];
        const baseSalary = 2200 + Math.random() * 2800;
        const deductions = baseSalary * (0.12 + Math.random() * 0.08);
        const taxes = baseSalary * 0.18;
        const netSalary = baseSalary - deductions - taxes;
        const paymentDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 10 + Math.floor(Math.random() * 15));
        
        demoData.push({
          id: `demo-${monthYear}-${i + 1}`,
          employee_id: `EMP${1000 + demoData.length + 1}`,
          first_name: firstNames[Math.floor(Math.random() * firstNames.length)],
          last_name: lastNames[Math.floor(Math.random() * lastNames.length)],
          email: `emp${demoData.length + 1}@entreprise.com`,
          department: dept,
          position: positions[Math.floor(Math.random() * positions.length)],
          base_salary: Math.round(baseSalary * 100) / 100,
          tax_amount: Math.round(taxes * 100) / 100,
          deduction_amount: Math.round(deductions * 100) / 100,
          net_salary: Math.round(netSalary * 100) / 100,
          payment_status: Math.random() > 0.15 ? 'paid' : 'pending',
          month_year: monthYear,
          month_name: monthName,
          paid_at: Math.random() > 0.3 ? paymentDate.toISOString() : null,
          created_at: paymentDate.toISOString(),
          approved_by: Math.random() > 0.5 ? 'admin' : 'system'
        });
      }
    }
    
    return demoData;
  };

  // ==================== FONCTIONS UTILITAIRES ====================
  const extractPaymentsData = (responseData) => {
    if (!responseData) return [];
    
    let data = [];
    
    // Format 1: { success: true, data: [...] }
    if (responseData.success && responseData.data) {
      data = Array.isArray(responseData.data) ? responseData.data : [];
    }
    // Format 2: { data: [...] }
    else if (responseData.data && Array.isArray(responseData.data)) {
      data = responseData.data;
    }
    // Format 3: { payments: [...] }
    else if (responseData.payments && Array.isArray(responseData.payments)) {
      data = responseData.payments;
    }
    // Format 4: Tableau direct
    else if (Array.isArray(responseData)) {
      data = responseData;
    }
    // Format 5: { data: { payments: [...] } }
    else if (responseData.data && responseData.data.payments) {
      data = responseData.data.payments;
    }
    
    // Normaliser les données
    return data.map(item => ({
      id: item.id || item._id || Math.random().toString(36).substr(2, 9),
      employee_id: item.employee_id || item.employeeId || item.employee || `EMP${Math.floor(Math.random() * 1000)}`,
      first_name: item.first_name || item.firstName || item.prenom || 'Prénom',
      last_name: item.last_name || item.lastName || item.nom || 'Nom',
      email: item.email || item.mail || '',
      department: item.department || item.department_name || item.dept || item.service || 'Non spécifié',
      position: item.position || item.poste || item.job_title || item.role || 'Non spécifié',
      base_salary: parseFloat(item.base_salary || item.base_amount || item.salary || item.base || 0),
      tax_amount: parseFloat(item.tax_amount || item.taxes || item.tax || 0),
      deduction_amount: parseFloat(item.deduction_amount || item.deductions || item.deduction || 0),
      net_salary: parseFloat(item.net_salary || item.net_amount || item.amount || item.total || 0),
      payment_status: item.payment_status || item.status || item.etat || 'pending',
      month_year: item.month_year || item.month || item.period || '',
      month_name: item.month_name || formatMonthLabel(item.month_year || item.month) || '',
      paid_at: item.paid_at || item.paid_date || item.date_paid || item.payment_date || null,
      created_at: item.created_at || item.created_date || item.date || new Date().toISOString()
    })).filter(item => item.employee_id); // Filtrer les entrées invalides
  };

  const formatMonthLabel = (monthYear) => {
    if (!monthYear) return '';
    
    try {
      const [year, month] = monthYear.split('-');
      if (year && month) {
        const date = new Date(year, parseInt(month) - 1, 1);
        return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      }
      return monthYear;
    } catch (error) {
      return monthYear;
    }
  };

  const generateDefaultMonths = () => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const months = [];
    
    // Générer les 6 derniers mois
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentYear, currentDate.getMonth() - i, 1);
      const monthNum = date.getMonth() + 1;
      const monthName = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      
      months.push({
        value: `${date.getFullYear()}-${monthNum.toString().padStart(2, '0')}`,
        label: monthName
      });
    }
    
    return months;
  };

  // ==================== TRAITEMENT DES DONNÉES ====================
  const processPaymentsData = (paymentsData) => {
    if (!Array.isArray(paymentsData) || paymentsData.length === 0) {
      console.warn('⚠️ Aucune donnée à traiter');
      paymentsData = [];
    }
    
    console.log(`📊 Traitement de ${paymentsData.length} paiements`);
    
    setPayments(paymentsData);
    setFilteredPayments(paymentsData);
    
    // Calculer les statistiques
    const totalAmount = paymentsData.reduce((sum, payment) => 
      sum + (payment.net_salary || 0), 0
    );

    // Statistiques par département
    const departmentsMap = new Map();
    const uniqueMonths = new Set();
    
    paymentsData.forEach(payment => {
      // Collecter les mois uniques
      if (payment.month_year) {
        uniqueMonths.add(payment.month_year);
      }
      
      // Statistiques par département
      if (payment.department) {
        if (!departmentsMap.has(payment.department)) {
          departmentsMap.set(payment.department, {
            total: 0,
            count: 0,
            employees: new Set()
          });
        }
        const dept = departmentsMap.get(payment.department);
        dept.total += payment.net_salary || 0;
        dept.count++;
        dept.employees.add(payment.employee_id);
      }
    });

    const departments = Array.from(departmentsMap.entries()).map(([name, data]) => ({
      name,
      total: data.total,
      count: data.count,
      employee_count: data.employees.size,
      average: data.count > 0 ? data.total / data.count : 0
    }));

    const paidPayments = paymentsData.filter(p => 
      p.payment_status === 'paid' || p.status === 'paid' || p.status === 'completed'
    ).length;

    setStats({
      total_payments: paymentsData.length,
      total_amount: totalAmount,
      paid_payments: paidPayments,
      departments,
      months: Array.from(uniqueMonths).map(month => ({
        value: month,
        label: formatMonthLabel(month)
      }))
    });
  };

  // ==================== GESTION DES FILTRES ====================
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    const newFilters = { ...filters, [name]: value };
    setFilters(newFilters);
    applyFilters(newFilters);
  };

  const applyFilters = (filterValues) => {
    let filtered = [...payments];
    
    if (filterValues.month_year) {
      filtered = filtered.filter(p => p?.month_year === filterValues.month_year);
    }
    
    if (filterValues.employee_id) {
      const searchTerm = filterValues.employee_id.toLowerCase();
      filtered = filtered.filter(p => 
        (p?.employee_id?.toLowerCase() || '').includes(searchTerm) ||
        `${p?.first_name || ''} ${p?.last_name || ''}`.toLowerCase().includes(searchTerm) ||
        (p?.email?.toLowerCase() || '').includes(searchTerm)
      );
    }
    
    if (filterValues.status) {
      filtered = filtered.filter(p => 
        p?.payment_status === filterValues.status || 
        p?.status === filterValues.status
      );
    }
    
    if (filterValues.department) {
      filtered = filtered.filter(p => 
        p?.department === filterValues.department
      );
    }
    
    setFilteredPayments(filtered);
  };

  const clearFilters = () => {
    const newFilters = {
      month_year: '',
      employee_id: '',
      status: '',
      department: '',
      date_range: 'all'
    };
    setFilters(newFilters);
    setFilteredPayments([...payments]);
  };

  // ==================== BADGE DE STATUT ====================
  const getStatusBadge = (status) => {
    const colors = {
      'paid': 'green',
      'pending': 'yellow',
      'approved': 'blue',
      'rejected': 'red',
      'completed': 'green',
      'failed': 'red',
      'processing': 'purple'
    };
    
    const labels = {
      'paid': 'Payé',
      'pending': 'En attente',
      'approved': 'Approuvé',
      'rejected': 'Rejeté',
      'completed': 'Terminé',
      'failed': 'Échoué',
      'processing': 'En cours'
    };
    
    const badgeStatus = status?.toLowerCase() || 'pending';
    
    return (
      <Badge color={colors[badgeStatus] || 'gray'}>
        {labels[badgeStatus] || badgeStatus}
      </Badge>
    );
  };

  // ==================== GESTION DES ERREURS ====================
  const handleRetry = () => {
    setApiError(null);
    setIsDemoMode(false);
    loadPaymentHistory();
  };

  const clearCacheAndRetry = () => {
    try {
      localStorage.removeItem('payroll_history_cache');
      console.log('🗑️ Cache local effacé');
      toast.success('Cache effacé');
    } catch (error) {
      console.log('⚠️ Impossible d\'effacer le cache:', error);
    }
    handleRetry();
  };

  // ==================== EXPORT EXCEL ====================
  const exportToExcel = () => {
    try {
      setExportLoading(true);
      
      if (!filteredPayments || filteredPayments.length === 0) {
        toast.error('❌ Aucune donnée à exporter');
        setExportLoading(false);
        return;
      }
      
      console.log(`📊 Préparation export Excel: ${filteredPayments.length} lignes`);
      
      // Préparer les données
      const excelData = filteredPayments.map(payment => ({
        'ID': payment.id || '',
        'Mois': payment.month_name || payment.month_year || 'N/A',
        'ID Employé': payment.employee_id || 'N/A',
        'Nom': `${payment.first_name || ''} ${payment.last_name || ''}`.trim() || 'N/A',
        'Email': payment.email || 'N/A',
        'Département': payment.department || 'N/A',
        'Poste': payment.position || 'N/A',
        'Salaire Base': payment.base_salary || 0,
        'Taxes': payment.tax_amount || 0,
        'Déductions': payment.deduction_amount || 0,
        'Salaire Net': payment.net_salary || 0,
        'Statut': payment.payment_status || 'N/A',
        'Date Paiement': payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('fr-FR') : 'N/A',
        'Heure Paiement': payment.paid_at ? new Date(payment.paid_at).toLocaleTimeString('fr-FR') : 'N/A',
        'Date Création': payment.created_at ? new Date(payment.created_at).toLocaleDateString('fr-FR') : 'N/A'
      }));

      // Créer le workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Formatage des colonnes
      const colWidths = [
        { wch: 10 },  // ID
        { wch: 15 },  // Mois
        { wch: 12 },  // ID Employé
        { wch: 20 },  // Nom
        { wch: 25 },  // Email
        { wch: 15 },  // Département
        { wch: 20 },  // Poste
        { wch: 12 },  // Salaire Base
        { wch: 10 },  // Taxes
        { wch: 12 },  // Déductions
        { wch: 12 },  // Salaire Net
        { wch: 10 },  // Statut
        { wch: 15 },  // Date Paiement
        { wch: 15 },  // Heure Paiement
        { wch: 15 }   // Date Création
      ];
      ws['!cols'] = colWidths;

      // Ajouter la feuille
      XLSX.utils.book_append_sheet(wb, ws, 'Historique Paiements');

      // Ajouter une feuille de statistiques
      const statsData = [
        ['Statistiques du Rapport', ''],
        ['Date Génération', new Date().toLocaleDateString('fr-FR')],
        ['Heure Génération', new Date().toLocaleTimeString('fr-FR')],
        ['Total Paiements', stats.total_payments],
        ['Montant Total', stats.total_amount.toFixed(2) + ' DT'],
        ['Paiements Payés', stats.paid_payments],
        ['Mode', isDemoMode ? 'Démonstration' : 'Production'],
        ['', ''],
        ['Statistiques par Département', '', '', '', ''],
        ['Département', 'Employés', 'Paiements', 'Total Salaire', 'Moyenne'],
        ...stats.departments.map(dept => [
          dept.name,
          dept.employee_count,
          dept.count,
          dept.total.toFixed(2) + ' DT',
          dept.average.toFixed(2) + ' DT'
        ])
      ];
      
      const wsStats = XLSX.utils.aoa_to_sheet(statsData);
      XLSX.utils.book_append_sheet(wb, wsStats, 'Statistiques');

      // Générer le fichier
      const fileName = `historique_paiements_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      console.log('✅ Export Excel terminé');
      toast.success('✅ Export Excel terminé');
      
    } catch (error) {
      console.error('💥 Erreur export Excel:', error);
      toast.error('❌ Erreur lors de l\'export Excel');
    } finally {
      setExportLoading(false);
    }
  };

  // ==================== EXPORT PDF ====================
  const exportToPDF = async () => {
    try {
      setExportLoading(true);
      
      if (!filteredPayments || filteredPayments.length === 0) {
        toast.error('❌ Aucune donnée à exporter');
        setExportLoading(false);
        return;
      }
      
      console.log(`📊 Préparation export PDF: ${filteredPayments.length} lignes`);
      
      const doc = new jsPDF('landscape');
      const currentDate = new Date().toLocaleDateString('fr-FR');
      const currentTime = new Date().toLocaleTimeString('fr-FR');
      
      // En-tête
      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.text('Rapport Historique des Paiements', 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Généré le ${currentDate} à ${currentTime}`, 14, 28);
      doc.text(`Total: ${filteredPayments.length} paiements | Montant: ${stats.total_amount.toFixed(2)} DT`, 14, 35);
      
      // Mode démo indication
      let startY = 42;
      if (isDemoMode) {
        doc.setTextColor(255, 152, 0); // Orange
        doc.text('⚠️ MODE DÉMONSTRATION - Données factices', 14, startY);
        doc.setTextColor(100, 100, 100);
        startY += 8;
      }
      
      // Filtres appliqués
      if (filters.month_year || filters.department || filters.status) {
        doc.text('Filtres appliqués:', 14, startY);
        startY += 6;
        if (filters.month_year) {
          doc.text(`• Mois: ${filters.month_year}`, 20, startY);
          startY += 6;
        }
        if (filters.department) {
          doc.text(`• Département: ${filters.department}`, 20, startY);
          startY += 6;
        }
        if (filters.status) {
          doc.text(`• Statut: ${filters.status}`, 20, startY);
          startY += 6;
        }
      }
      
      // Tableau
      const tableData = filteredPayments.map(payment => [
        payment.month_year || 'N/A',
        payment.employee_id || 'N/A',
        `${payment.first_name || ''} ${payment.last_name || ''}`.trim(),
        payment.department || 'N/A',
        payment.net_salary?.toFixed(2) || '0.00',
        payment.payment_status || 'N/A',
        payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('fr-FR') : 'N/A'
      ]);
      
      // Utiliser notre solution PDF robuste
      PDFExport.createTable(doc, tableData, startY + 5);
      
      // Statistiques par département (nouvelle page si nécessaire)
      if (stats.departments.length > 0) {
        doc.addPage('landscape');
        doc.setFontSize(14);
        doc.text('Statistiques par Département', 14, 20);
        
        const statsTableData = stats.departments.map(dept => [
          dept.name,
          dept.employee_count.toString(),
          dept.count.toString(),
          dept.total.toFixed(2),
          dept.average.toFixed(2)
        ]);
        
        PDFExport.createTable(doc, statsTableData, 30, ['Département', 'Employés', 'Paiements', 'Total Salaire', 'Moyenne']);
      }
      
      // Pied de page
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${i} / ${pageCount} • Smart Attendance System • ${currentDate}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }
      
      // Sauvegarder
      const fileName = `rapport_paiements_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      console.log('✅ Export PDF terminé');
      toast.success('✅ Export PDF terminé');
      
    } catch (error) {
      console.error('💥 Erreur export PDF:', error);
      toast.error('❌ Erreur lors de l\'export PDF');
    } finally {
      setExportLoading(false);
    }
  };

  // ==================== EXPORT HTML ====================
  const exportToHTML = () => {
    try {
      setExportLoading(true);
      
      if (!filteredPayments || filteredPayments.length === 0) {
        toast.error('❌ Aucune donnée à exporter');
        setExportLoading(false);
        return;
      }
      
      console.log(`📊 Préparation export HTML: ${filteredPayments.length} lignes`);
      
      const htmlContent = generateHTMLReport();
      
      // Créer et télécharger le fichier
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      link.href = url;
      link.download = `rapport_paiements_${new Date().toISOString().split('T')[0]}.html`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('✅ Export HTML terminé');
      toast.success('✅ Export HTML terminé');
      
    } catch (error) {
      console.error('💥 Erreur export HTML:', error);
      toast.error('❌ Erreur lors de l\'export HTML');
    } finally {
      setExportLoading(false);
    }
  };

  const generateHTMLReport = () => {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport Historique des Paiements</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f8f9fa;
            color: #333;
        }
        .report-container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 20px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #3498db;
            padding-bottom: 20px;
        }
        .header h1 {
            color: #2c3e50;
            margin: 0;
            font-size: 28px;
        }
        .header .subtitle {
            color: #7f8c8d;
            font-size: 14px;
            margin-top: 5px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .stat-card h3 {
            margin: 0;
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 10px;
        }
        .stat-card .value {
            font-size: 24px;
            font-weight: bold;
            margin: 10px 0;
        }
        .table-container {
            overflow-x: auto;
            margin: 30px 0;
            border-radius: 8px;
            border: 1px solid #e1e1e1;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
        }
        th {
            background-color: #3498db;
            color: white;
            padding: 12px 15px;
            text-align: left;
            font-weight: 600;
            position: sticky;
            top: 0;
        }
        td {
            padding: 12px 15px;
            border-bottom: 1px solid #e1e1e1;
        }
        tr:hover {
            background-color: #f5f7fa;
        }
        .status-paid { background-color: #27ae60; color: white; padding: 4px 8px; border-radius: 4px; }
        .status-pending { background-color: #f39c12; color: white; padding: 4px 8px; border-radius: 4px; }
        .status-approved { background-color: #3498db; color: white; padding: 4px 8px; border-radius: 4px; }
        .footer {
            margin-top: 30px;
            text-align: center;
            color: #7f8c8d;
            font-size: 12px;
            padding-top: 20px;
            border-top: 1px solid #e1e1e1;
        }
        .amount { text-align: right; font-weight: 600; color: #2c3e50; }
        .text-right { text-align: right; }
        .demo-warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
        }
        .demo-warning svg {
            margin-right: 10px;
            flex-shrink: 0;
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="header">
            <h1>Rapport Historique des Paiements</h1>
            <div class="subtitle">
                Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} | 
                Smart Attendance System - Module Paie
            </div>
        </div>
        
        ${isDemoMode ? `
        <div class="demo-warning">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
            </svg>
            <div>
                <strong>Mode démonstration :</strong> Ce rapport contient des données factices générées localement.
                Les API de paiements sont temporairement indisponibles.
            </div>
        </div>
        ` : ''}
        
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total Paiements</h3>
                <div class="value">${stats.total_payments}</div>
                <div>Paiements trouvés</div>
            </div>
            <div class="stat-card">
                <h3>Montant Total</h3>
                <div class="value">${stats.total_amount.toFixed(2)} DT</div>
                <div>Somme des salaires</div>
            </div>
            <div class="stat-card">
                <h3>Paiements Payés</h3>
                <div class="value">${stats.paid_payments}</div>
                <div>Terminés avec succès</div>
            </div>
            <div class="stat-card">
                <h3>Départements</h3>
                <div class="value">${stats.departments.length}</div>
                <div>Avec paiements</div>
            </div>
        </div>
        
        <h2>Détail des Paiements (${filteredPayments.length})</h2>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Mois</th>
                        <th>ID Employé</th>
                        <th>Nom</th>
                        <th>Département</th>
                        <th class="text-right">Salaire Base</th>
                        <th class="text-right">Taxes</th>
                        <th class="text-right">Déductions</th>
                        <th class="text-right">Salaire Net</th>
                        <th>Statut</th>
                        <th>Date Paiement</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredPayments.map(payment => `
                        <tr>
                            <td>${payment.month_name || payment.month_year || 'N/A'}</td>
                            <td>${payment.employee_id || 'N/A'}</td>
                            <td>${payment.first_name || ''} ${payment.last_name || ''}</td>
                            <td>${payment.department || 'N/A'}</td>
                            <td class="amount">${payment.base_salary?.toFixed(2) || '0.00'} DT</td>
                            <td class="amount">${payment.tax_amount?.toFixed(2) || '0.00'} DT</td>
                            <td class="amount">${payment.deduction_amount?.toFixed(2) || '0.00'} DT</td>
                            <td class="amount">${payment.net_salary?.toFixed(2) || '0.00'} DT</td>
                            <td><span class="status-${payment.payment_status}">${payment.payment_status || 'N/A'}</span></td>
                            <td>${payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('fr-FR') : 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        ${stats.departments.length > 0 ? `
        <h2>Statistiques par Département</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
            ${stats.departments.map(dept => `
                <div style="background: white; border: 1px solid #e1e1e1; border-radius: 8px; padding: 15px;">
                    <h3 style="margin: 0 0 10px 0; color: #2c3e50;">${dept.name}</h3>
                    <div style="margin: 10px 0;">
                        <div><strong>Employés:</strong> ${dept.employee_count}</div>
                        <div><strong>Paiements:</strong> ${dept.count}</div>
                    </div>
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin-top: 10px;">
                        <div><strong>Total Salaire:</strong> ${dept.total.toFixed(2)} DT</div>
                        <div><strong>Moyenne:</strong> ${dept.average.toFixed(2)} DT</div>
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        <div class="footer">
            <p>© ${new Date().getFullYear()} Smart Attendance System - Module Paie</p>
            <p>Document généré automatiquement • Version 2.0</p>
            <p>Confidential - Usage interne uniquement</p>
        </div>
    </div>
</body>
</html>`;
  };

  // ==================== CAPTURE D'ÉCRAN ====================
  const exportAsScreenshot = async () => {
    try {
      setExportLoading(true);
      
      if (!reportRef.current) {
        toast.error('❌ Élément de rapport non trouvé');
        return;
      }
      
      console.log('📸 Capture d\'écran en cours...');
      
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: reportRef.current.scrollWidth,
        windowHeight: reportRef.current.scrollHeight
      });
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      
      link.href = imgData;
      link.download = `capture_paiements_${new Date().toISOString().split('T')[0]}.png`;
      link.click();
      
      console.log('✅ Capture d\'écran terminée');
      toast.success('✅ Capture d\'écran exportée');
      
    } catch (error) {
      console.error('💥 Erreur capture écran:', error);
      toast.error('❌ Erreur lors de la capture');
    } finally {
      setExportLoading(false);
    }
  };

  // ==================== RENDU ====================
  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Historique des Paiements</h2>
        <div className="flex flex-col items-center justify-center h-96">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
          <div className="text-gray-600 text-lg">Chargement de l'historique...</div>
          <div className="text-gray-500 text-sm mt-2">Veuillez patienter</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6" ref={reportRef}>
      {/* Mode démonstration */}
      {isDemoMode && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <div className="font-medium text-yellow-800">Mode démonstration</div>
              <div className="text-yellow-700 text-sm mt-1">
                Les API de paiements sont temporairement indisponibles. 
                Les données affichées sont simulées pour la démonstration.
              </div>
            </div>
          </div>
          <div className="flex space-x-3 mt-3">
            <Button onClick={handleRetry} size="sm" variant="outline" className="text-yellow-700 border-yellow-300">
              Réessayer la connexion
            </Button>
            <Button onClick={clearCacheAndRetry} size="sm" variant="outline" className="text-yellow-700 border-yellow-300">
              Effacer cache et réessayer
            </Button>
          </div>
        </div>
      )}

      {/* En-tête */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Historique des Paiements</h2>
          <p className="text-gray-600 mt-1">
            Consultez l'historique complet des paiements, téléchargez les archives et suivez l'évolution des salaires.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative group">
            <Button 
              onClick={exportToExcel} 
              variant="outline"
              disabled={exportLoading || filteredPayments.length === 0}
              className="flex items-center gap-2"
            >
              {exportLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Export...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Excel
                </>
              )}
            </Button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              Exporter vers Excel
            </div>
          </div>
          
          <div className="relative group">
            <Button 
              onClick={exportToPDF} 
              variant="outline"
              disabled={exportLoading || filteredPayments.length === 0}
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF
            </Button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              Exporter vers PDF
            </div>
          </div>
          
          <div className="relative group">
            <Button 
              onClick={exportToHTML} 
              variant="outline"
              disabled={exportLoading || filteredPayments.length === 0}
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              HTML
            </Button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              Exporter vers HTML
            </div>
          </div>
          
          <div className="relative group">
            <Button 
              onClick={exportAsScreenshot} 
              variant="outline"
              disabled={exportLoading || filteredPayments.length === 0}
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Image
            </Button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              Capture d'écran
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg">
          <div className="text-sm opacity-90">Total Paiements</div>
          <div className="text-2xl font-bold mt-1">{stats.total_payments}</div>
          <div className="text-xs opacity-75 mt-2">Historique complet</div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg">
          <div className="text-sm opacity-90">Montant Total</div>
          <div className="text-2xl font-bold mt-1">
            {stats.total_amount.toFixed(2)} DT
          </div>
          <div className="text-xs opacity-75 mt-2">Somme des salaires</div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg">
          <div className="text-sm opacity-90">Paiements Payés</div>
          <div className="text-2xl font-bold mt-1">{stats.paid_payments}</div>
          <div className="text-xs opacity-75 mt-2">Terminés avec succès</div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-lg">
          <div className="text-sm opacity-90">Départements</div>
          <div className="text-2xl font-bold mt-1">{stats.departments.length}</div>
          <div className="text-xs opacity-75 mt-2">Avec paiements</div>
        </Card>
      </div>

      {/* Filtres */}
      <Card className="p-4 mb-6 border border-gray-200 shadow-sm">
        <h3 className="font-medium text-gray-900 mb-3">Filtres Avancés</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mois</label>
            <select
              name="month_year"
              value={filters.month_year}
              onChange={handleFilterChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tous les mois</option>
              {availableMonths.map(month => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
            <select
              name="department"
              value={filters.department}
              onChange={handleFilterChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tous départements</option>
              {availableDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tous statuts</option>
              <option value="paid">Payé</option>
              <option value="pending">En attente</option>
              <option value="approved">Approuvé</option>
              <option value="rejected">Rejeté</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recherche</label>
            <input
              type="text"
              name="employee_id"
              value={filters.employee_id}
              onChange={handleFilterChange}
              placeholder="ID, nom, prénom ou email..."
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-end">
            <Button 
              onClick={clearFilters} 
              variant="outline" 
              className="w-full"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Effacer filtres
            </Button>
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-600">
            {filteredPayments.length} paiement(s) trouvé(s) sur {payments.length}
          </div>
          {(filters.month_year || filters.department || filters.status || filters.employee_id) && (
            <div className="text-sm text-blue-600 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtres actifs
            </div>
          )}
        </div>
      </Card>

      {/* Tableau */}
      <Card className="overflow-hidden mb-8 border border-gray-200 shadow-sm">
        <div className="overflow-x-auto" ref={tableRef}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-800 to-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Mois
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Employé
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Département
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Salaire Base
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Déductions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Salaire Net
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Date Paiement
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="text-lg font-medium text-gray-600 mb-2">Aucun paiement trouvé</div>
                      <div className="text-sm text-gray-500">
                        {payments.length === 0 
                          ? "Aucun paiement dans l'historique" 
                          : "Aucun paiement ne correspond à vos filtres"}
                      </div>
                      {payments.length > 0 && (
                        <Button onClick={clearFilters} variant="outline" size="sm" className="mt-4">
                          Effacer les filtres
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment, index) => (
                  <tr key={payment.id || index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {payment.month_name || payment.month_year || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {payment.month_year || ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">
                            {(payment.first_name?.[0] || '') + (payment.last_name?.[0] || '') || '?'}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {payment.first_name || ''} {payment.last_name || ''}
                          </div>
                          <div className="text-xs text-gray-500">
                            {payment.employee_id || 'N/A'} • {payment.position || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{payment.department || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{payment.email || ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.base_salary?.toFixed(2) || '0.00'} DT
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.deduction_amount?.toFixed(2) || '0.00'} DT
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-green-600">
                        {payment.net_salary?.toFixed(2) || '0.00'} DT
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(payment.payment_status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payment.paid_at ? (
                        <>
                          <div>{new Date(payment.paid_at).toLocaleDateString('fr-FR')}</div>
                          <div className="text-xs">{new Date(payment.paid_at).toLocaleTimeString('fr-FR')}</div>
                        </>
                      ) : (
                        'N/A'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Statistiques par département */}
      {stats.departments.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistiques par Département</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.departments.map((dept, index) => (
              <Card key={index} className="p-4 border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{dept.name}</div>
                    <div className="text-xs text-gray-500">{dept.employee_count} employé(s)</div>
                  </div>
                  <Badge color="blue">{dept.count} paiements</Badge>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total salaire:</span>
                    <span className="font-semibold text-green-600">
                      {dept.total.toFixed(2)} DT
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Moyenne:</span>
                    <span className="font-semibold text-blue-600">
                      {dept.average.toFixed(2)} DT
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs text-gray-500">
                    Dernière mise à jour: {new Date().toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Informations de synthèse */}
      {filteredPayments.length > 0 && (
        <Card className="mt-8 p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-blue-600 mr-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-medium text-blue-900">Informations de synthèse</h4>
              <p className="text-sm text-blue-700 mt-1">
                Ce rapport contient l'historique complet des paiements salariaux. 
                Utilisez les filtres pour affiner votre recherche et les boutons d'export 
                pour télécharger les données dans différents formats.
              </p>
              <div className="mt-2 text-xs text-blue-600">
                <span className="font-medium">Conseil:</span> Pour une analyse approfondie, 
                exportez les données en Excel pour utiliser les fonctionnalités avancées de tri et de calcul.
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default PaymentHistory;