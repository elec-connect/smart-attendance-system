/**
 * ✅ SERVICE D'EXPORT CORRIGÉ - ADMIN VOIT TOUS LES EMPLOYÉS
 * ✅ CORRECTION: employee_id (snake_case) pour PostgreSQL
 * ✅ CORRECTION: Pas de filtre automatique sur l'utilisateur connecté
 * 
 * Problème résolu : 
 * - Bouton Excel → appelait /pdf
 * - Bouton PDF → appelait /excel
 * - Paramètre employeeId → backend attend employee_id
 * - Admin voyait seulement ses propres données
 * 
 * Correction : 
 * - Excel → /excel
 * - PDF → /pdf
 * - employee_id → snake_case
 * - Pas de filtrage automatique (c'est le backend qui gère les permissions)
 */

export class ExportService {
  // ============================================
  // ✅ UTILITAIRES DE BASE
  // ============================================

  /**
   * Récupère l'URL de base de l'API
   */
  static getBaseUrl() {
    const envUrl = import.meta.env?.VITE_API_URL || 'http://localhost:5000/api';
    // Nettoyer l'URL pour éviter les doublons /api/api/
    return envUrl.replace(/\/api\/?$/, '');
  }

  /**
   * Détermine le header Accept selon le type de fichier
   */
  static getAcceptHeader(endpoint) {
    if (endpoint.includes('.xlsx') || endpoint.includes('excel')) {
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    if (endpoint.includes('.zip') || endpoint.includes('zip')) {
      return 'application/zip';
    }
    if (endpoint.includes('.pdf') || endpoint.includes('pdf')) {
      return 'application/pdf';
    }
    if (endpoint.includes('.csv') || endpoint.includes('csv')) {
      return 'text/csv';
    }
    return 'application/octet-stream';
  }

  /**
   * Formate la taille d'un fichier
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // ============================================
  // ✅ MÉTHODE PRINCIPALE DE TÉLÉCHARGEMENT
  // ============================================

  /**
   * Télécharge un fichier depuis l'API
   */
  static async downloadFile(endpoint, params = {}, defaultFilename = 'export') {
    // 1. VÉRIFICATION DU TOKEN
    const token = localStorage.getItem('token');
    if (!token) {
      const error = new Error('Session expirée, veuillez vous reconnecter');
      error.name = 'AuthError';
      error.status = 401;
      throw error;
    }

    // 2. CONSTRUCTION DE L'URL
    const baseUrl = this.getBaseUrl();
    
    // Éviter les doubles /api/api/
    let cleanEndpoint = endpoint;
    if (baseUrl.endsWith('/api') && cleanEndpoint.startsWith('/api')) {
      cleanEndpoint = cleanEndpoint.replace('/api', '');
    }
    
    const url = new URL(`${baseUrl}${cleanEndpoint}`);
    
    // 3. AJOUT DES PARAMÈTRES
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, value);
      }
    });

    console.log('[EXPORT] Requête:', {
      endpoint: cleanEndpoint,
      url: url.toString(),
      params,
      tokenPresent: !!token
    });

    try {
      // 4. EXÉCUTION DE LA REQUÊTE
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': this.getAcceptHeader(endpoint)
        }
      });

      // 5. GESTION DES ERREURS HTTP
      if (!response.ok) {
        let errorMessage = `Erreur ${response.status}`;
        let errorData = {};
        
        try {
          errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          try {
            const textError = await response.text();
            if (textError) errorMessage = textError;
          } catch {
            // Ignorer
          }
        }
        
        const error = new Error(errorMessage);
        error.name = response.status === 401 || response.status === 403 
          ? 'AuthError' 
          : response.status === 404 
            ? 'NotFoundError' 
            : 'HttpError';
        error.status = response.status;
        error.code = errorData.code;
        
        console.error('[EXPORT] Erreur HTTP:', {
          status: response.status,
          statusText: response.statusText,
          url: url.toString(),
          errorData,
          message: errorMessage
        });
        
        throw error;
      }

      // 6. RÉCUPÉRATION DU NOM DE FICHIER
      let filename = defaultFilename;
      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
          try {
            filename = decodeURIComponent(filename);
          } catch {
            // Garder le nom original
          }
        }
      }

      // 7. RÉCUPÉRATION DU BLOB
      const blob = await response.blob();
      
      if (blob.size === 0) {
        const error = new Error('Le fichier généré est vide');
        error.name = 'EmptyFileError';
        error.status = 204;
        throw error;
      }

      // 8. CRÉATION DU LIEN DE TÉLÉCHARGEMENT
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.rel = 'noopener noreferrer';
      link.target = '_blank';
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      }, 100);

      console.log('[EXPORT] Fichier téléchargé:', {
        filename,
        size: blob.size,
        sizeFormatted: this.formatFileSize(blob.size),
        type: blob.type,
        endpoint: cleanEndpoint
      });

      return { 
        success: true,
        filename, 
        size: blob.size,
        type: blob.type,
        endpoint: cleanEndpoint
      };

    } catch (error) {
      // Gestion des erreurs réseau
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        const networkError = new Error('Erreur de connexion au serveur');
        networkError.name = 'NetworkError';
        networkError.status = 0;
        console.error('[EXPORT] Erreur réseau:', error.message);
        throw networkError;
      }
      
      console.error('[EXPORT] Erreur downloadFile:', {
        name: error.name,
        message: error.message,
        status: error.status,
        endpoint: cleanEndpoint
      });
      
      throw error;
    }
  }

  // ============================================
  // ✅ TEST DE CONNEXION
  // ============================================

  /**
   * Teste la connexion au module d'export
   */
  static async testConnection() {
    try {
      const token = localStorage.getItem('token');
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/api/exports/ping`;
      
      console.log('[EXPORT] Test de connexion:', url);
      
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const response = await fetch(url, { 
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000)
      });
      
      return response.ok;
      
    } catch (error) {
      console.error('[EXPORT] Erreur test connexion:', error.message);
      return false;
    }
  }

  // ============================================
  // ✅ EXPORT DES PRÉSENCES - POINTAGES
  // ============================================

  /**
   * ✅ EXPORT EXCEL - POINTAGES
   * URL: /api/exports/attendance/excel
   * PARAMÈTRES: startDate, endDate, department, employee_id (optionnel)
   */
  static async exportAttendanceExcel({ startDate, endDate, department, employee_id }) {
    if (!startDate || !endDate) {
      throw new Error('Les dates de début et fin sont requises');
    }

    const endpoint = '/api/exports/attendance/excel';
    const filename = `pointages_${startDate}_${endDate}.xlsx`;
    const params = { 
      startDate, 
      endDate,
      ...(department && { department }),
      ...(employee_id && { employee_id })  // ✅ Optionnel - si absent = TOUS les employés
    };
    
    console.log('[EXPORT] Export Excel pointages:', params);
    return this.downloadFile(endpoint, params, filename);
  }

  /**
   * ✅ EXPORT PDF - POINTAGES
   * URL: /api/exports/attendance/pdf
   * PARAMÈTRES: startDate, endDate, department, employee_id (optionnel)
   */
  static async exportAttendancePDF({ startDate, endDate, department, employee_id }) {
    if (!startDate || !endDate) {
      throw new Error('Les dates de début et fin sont requises');
    }

    const endpoint = '/api/exports/attendance/pdf';
    const filename = `pointages_${startDate}_${endDate}.pdf`;
    const params = { 
      startDate, 
      endDate,
      ...(department && { department }),
      ...(employee_id && { employee_id })  // ✅ Optionnel - si absent = TOUS les employés
    };
    
    console.log('[EXPORT] Export PDF pointages:', params);
    return this.downloadFile(endpoint, params, filename);
  }

  // ============================================
  // ✅ EXPORT DES EMPLOYÉS - ADMIN UNIQUEMENT
  // ============================================

  /**
   * Export de la liste des employés en Excel
   * URL: /api/exports/employees/excel
   * ✅ ADMIN UNIQUEMENT
   */
  static async exportEmployees() {
    const endpoint = '/api/exports/employees/excel';
    const date = new Date().toISOString().split('T')[0];
    const filename = `employes_${date}.xlsx`;
    
    return this.downloadFile(endpoint, {}, filename);
  }

  // ============================================
  // ✅ MOIS DISPONIBLES POUR LES FICHES DE PAIE
  // ============================================

  /**
   * Récupère la liste des mois disponibles
   */
  static async getAvailableMonths() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return [];
      
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/api/payroll/pay-months`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.months || data.data || [];
      
    } catch (error) {
      console.warn('[EXPORT] Erreur récupération des mois:', error);
      return [];
    }
  }

  // ============================================
  // ✅ EXPORT FICHE DE PAIE INDIVIDUELLE
  // ============================================

  /**
   * Export d'une fiche de paie individuelle en PDF
   * URL: /api/exports/payslip/single-pdf
   * PARAMÈTRES: employee_id, month_year
   */
  static async exportSinglePayslipPDF({ employee_id, month_year }) {
    if (!employee_id) throw new Error('ID employé requis');
    if (!month_year) throw new Error('Mois requis (format: YYYY-MM)');

    const endpoint = '/api/exports/payslip/single-pdf';
    const filename = `fiche_paie_${employee_id}_${month_year}.pdf`;
    const params = { employee_id, month_year };
    
    console.log('[EXPORT] Fiche individuelle:', params);
    return this.downloadFile(endpoint, params, filename);
  }

  // ============================================
  // ✅ EXPORT TOUTES LES FICHES DE PAIE - ADMIN
  // ============================================

  /**
   * ✅ EXPORT PDF - TOUTES LES FICHES DE PAIE
   * URL: /api/exports/payslips/pdf
   */
  static async exportAllPayslipsPDF(monthYear) {
    if (!monthYear) throw new Error('Mois requis (format: YYYY-MM)');
    
    const endpoint = '/api/exports/payslips/pdf';
    const filename = `fiches_paie_completes_${monthYear}.pdf`;
    const params = { month_year: monthYear };
    
    return this.downloadFile(endpoint, params, filename);
  }

  /**
   * ✅ EXPORT EXCEL - TOUTES LES FICHES DE PAIE
   * URL: /api/exports/payslips/excel
   */
  static async exportAllPayslipsExcel(monthYear) {
    if (!monthYear) throw new Error('Mois requis (format: YYYY-MM)');
    
    const endpoint = '/api/exports/payslips/excel';
    const filename = `fiches_paie_completes_${monthYear}.xlsx`;
    const params = { month_year: monthYear };
    
    return this.downloadFile(endpoint, params, filename);
  }

  /**
   * Export de toutes les fiches de paie en CSV
   * URL: /api/exports/payslips/csv
   */
  static async exportAllPayslipsCSV(monthYear) {
    if (!monthYear) throw new Error('Mois requis (format: YYYY-MM)');
    
    const endpoint = '/api/exports/payslips/csv';
    const filename = `fiches_paie_${monthYear}.csv`;
    const params = { month_year: monthYear };
    
    return this.downloadFile(endpoint, params, filename);
  }

  /**
   * Export de toutes les fiches de paie en ZIP standard
   * URL: /api/exports/payslips/zip
   */
  static async exportAllPayslipsZip(monthYear) {
    if (!monthYear) throw new Error('Mois requis (format: YYYY-MM)');
    
    const endpoint = '/api/exports/payslips/zip';
    const filename = `fiches_paie_completes_${monthYear}.zip`;
    const params = { month_year: monthYear };
    
    return this.downloadFile(endpoint, params, filename);
  }

  /**
   * Export de toutes les fiches de paie en ZIP avancé
   * URL: /api/exports/payslips/zip-advanced
   */
  static async exportAllPayslipsZipAdvanced(monthYear) {
    if (!monthYear) throw new Error('Mois requis (format: YYYY-MM)');
    
    const endpoint = '/api/exports/payslips/zip-advanced';
    const filename = `fiches_paie_detaillees_${monthYear}.zip`;
    const params = { month_year: monthYear };
    
    return this.downloadFile(endpoint, params, filename);
  }

  // ============================================
  // ✅ EXPORT PAR LOTS - ADMIN
  // ============================================

  /**
   * Export par lot de fiches de paie
   */
  static async exportPayslipsBatch(monthYear, batchSize = 100, offset = 0) {
    if (!monthYear) throw new Error('Mois requis (format: YYYY-MM)');
    
    const endpoint = '/api/exports/payslips/batch';
    const batchNumber = Math.floor(offset / batchSize) + 1;
    const filename = `fiches_paie_${monthYear}_lot_${batchNumber}.zip`;
    const params = { 
      month_year: monthYear,
      limit: batchSize,
      offset
    };
    
    return this.downloadFile(endpoint, params, filename);
  }

  /**
   * Récupère les informations sur les lots disponibles
   */
  static async getPayslipsBatchInfo(monthYear, batchSize = 100) {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/api/exports/payslips/batch-info?month_year=${monthYear}&batch_size=${batchSize}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) return null;
      return await response.json();
      
    } catch (error) {
      console.warn('[EXPORT] Erreur récupération info batch:', error);
      return null;
    }
  }

  /**
   * Télécharge tous les lots automatiquement
   */
  static async downloadAllBatches(monthYear, batchSize = 100, onBatchComplete) {
    try {
      const batchInfo = await this.getPayslipsBatchInfo(monthYear, batchSize);
      
      if (!batchInfo?.success) {
        throw new Error('Impossible de récupérer les informations des lots');
      }
      
      const { total_batches, total_payslips } = batchInfo.data;
      const results = [];
      
      console.log(`[EXPORT] Début téléchargement de ${total_batches} lots pour ${total_payslips} fiches`);
      
      for (let batchNumber = 1; batchNumber <= total_batches; batchNumber++) {
        try {
          const offset = (batchNumber - 1) * batchSize;
          
          if (onBatchComplete) {
            onBatchComplete({
              batchNumber,
              totalBatches: total_batches,
              progress: Math.round((batchNumber / total_batches) * 100),
              status: 'download'
            });
          }
          
          const result = await this.exportPayslipsBatch(monthYear, batchSize, offset);
          results.push(result);
          
          console.log(`[EXPORT] Lot ${batchNumber} téléchargé: ${this.formatFileSize(result.size)}`);
          
          if (onBatchComplete) {
            onBatchComplete({
              batchNumber,
              totalBatches: total_batches,
              progress: Math.round((batchNumber / total_batches) * 100),
              status: 'complete',
              fileSize: result.size,
              fileName: result.filename
            });
          }
          
          if (batchNumber < total_batches) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
        } catch (error) {
          console.error(`[EXPORT] Erreur lot ${batchNumber}:`, error);
          
          if (onBatchComplete) {
            onBatchComplete({
              batchNumber,
              totalBatches: total_batches,
              progress: Math.round((batchNumber / total_batches) * 100),
              status: 'error',
              error: error.message
            });
          }
        }
      }
      
      const totalSize = results.reduce((sum, r) => sum + r.size, 0);
      
      return {
        success: true,
        totalBatches: total_batches,
        totalFiles: results.length,
        totalSize,
        averageSize: totalSize / results.length,
        results
      };
      
    } catch (error) {
      console.error('[EXPORT] Erreur téléchargement par lots:', error);
      throw error;
    }
  }

  /**
   * Vérifie si des fiches de paie existent pour un mois
   */
  static async checkPayslipData(monthYear) {
    try {
      const token = localStorage.getItem('token');
      if (!token) return { exists: false, count: 0 };
      
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/api/exports/payslips/check?month_year=${monthYear}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) return { exists: false, count: 0 };
      return await response.json();
      
    } catch (error) {
      console.warn('[EXPORT] Erreur vérification données:', error);
      return { exists: false, count: 0 };
    }
  }

  /**
   * Récupère les informations sur l'archive ZIP
   */
  static async getPayslipZipInfo(monthYear) {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/api/exports/payslips/zip-info?month_year=${monthYear}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) return null;
      return await response.json();
      
    } catch (error) {
      console.warn('[EXPORT] Erreur récupération info ZIP:', error);
      return null;
    }
  }
}

export default ExportService;