// src/components/payroll/PayMonthModal.jsx - VERSION CORRIGÉE 
import React, { useState, useEffect, useCallback } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { toast } from 'react-hot-toast';
import { Calendar, AlertCircle, CheckCircle } from 'lucide-react';

const PayMonthModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData = null, 
  mode = 'create',
  existingMonths = [] 
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    month_year: '',
    month_name: '',
    start_date: '',
    end_date: '',
    description: '',
    status: 'draft'
  });
  const [validationErrors, setValidationErrors] = useState({});

  // Initialiser les données du formulaire
  useEffect(() => {
    if (isOpen) {
      if (initialData && mode === 'edit') {
        setFormData({
          month_year: initialData.month_year || '',
          month_name: initialData.month_name || '',
          start_date: initialData.start_date || '',
          end_date: initialData.end_date || '',
          description: initialData.description || '',
          status: initialData.status || 'draft'
        });
      } else {
        // Mode création - suggérer le mois suivant
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const monthYear = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
        const monthNames = [
          'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];
        const dates = calculateMonthDates(monthYear);
        
        // Si le mois suivant existe déjà, trouver le prochain disponible
        let finalMonthYear = monthYear;
        let monthOffset = 1;
        while (existingMonths.includes(finalMonthYear) && monthOffset <= 12) {
          const next = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
          finalMonthYear = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
          monthOffset++;
        }
        
        const finalDates = calculateMonthDates(finalMonthYear);
        const finalMonthName = generateMonthName(finalMonthYear);
        
        setFormData({
          month_year: finalMonthYear,
          month_name: finalMonthName,
          start_date: finalDates.start_date,
          end_date: finalDates.end_date,
          description: '',
          status: 'draft'
        });
      }
      
      setValidationErrors({});
    }
  }, [isOpen, initialData, mode, existingMonths]);

  // Validation du formulaire
  const validateForm = () => {
    const errors = {};
    
    if (!formData.month_year) {
      errors.month_year = 'Le mois est requis';
    } else if (!/^\d{4}-\d{2}$/.test(formData.month_year)) {
      errors.month_year = 'Format invalide (AAAA-MM requis)';
    } else if (mode === 'create' && existingMonths.includes(formData.month_year)) {
      errors.month_year = 'Ce mois existe déjà';
    }
    
    if (!formData.start_date) {
      errors.start_date = 'La date de début est requise';
    }
    
    if (!formData.end_date) {
      errors.end_date = 'La date de fin est requise';
    }
    
    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      
      if (endDate <= startDate) {
        errors.end_date = 'La date de fin doit être après la date de début';
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Gestion des changements
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  // Générer le nom du mois
  const generateMonthName = (monthYear) => {
    if (!monthYear) return '';
    
    const [year, month] = monthYear.split('-');
    const monthIndex = parseInt(month) - 1;
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${monthNames[monthIndex]} ${year}`;
    }
    
    return `Mois ${monthYear}`;
  };

  // Calculer les dates du mois
  const calculateMonthDates = (monthYear) => {
    if (!monthYear) return { start_date: '', end_date: '' };
    
    const [year, month] = monthYear.split('-').map(Number);
    if (!year || !month || month < 1 || month > 12) {
      return { start_date: '', end_date: '' };
    }
    
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    };
  };

  // Changement du mois
  const handleMonthYearChange = (e) => {
    const monthYear = e.target.value;
    const monthName = generateMonthName(monthYear);
    const dates = calculateMonthDates(monthYear);
    
    setFormData(prev => ({
      ...prev,
      month_year: monthYear,
      month_name: monthName,
      start_date: dates.start_date || prev.start_date,
      end_date: dates.end_date || prev.end_date
    }));
    
    setValidationErrors(prev => ({
      ...prev,
      month_year: undefined,
      start_date: undefined,
      end_date: undefined
    }));
  };

  // Soumission du formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Veuillez corriger les erreurs dans le formulaire', {
        icon: '⚠️',
        duration: 3000
      });
      return;
    }
    
    try {
      setLoading(true);
      
      const payload = {
        ...formData,
        month_name: formData.month_name || `Mois ${formData.month_year}`
      };
      
      await onSave(payload);
      
    } catch (error) {
      console.error('Erreur dans le modal:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculer la durée en jours
  const calculateDuration = () => {
    if (!formData.start_date || !formData.end_date) return 0;
    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  };

  const isMonthExisting = mode === 'create' && existingMonths.includes(formData.month_year);

  if (!isOpen) return null;

  const modalTitle = mode === 'create' ? 'Créer un mois de paie' : 'Modifier le mois de paie';
  const duration = calculateDuration();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{modalTitle}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {mode === 'create' 
                  ? 'Créez un nouveau mois pour calculer les salaires'
                  : 'Modifiez les informations du mois de paie'}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500 transition-colors" aria-label="Fermer">
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mois (YYYY-MM) <span className="text-red-500">*</span>
              </label>
              <input
                type="month"
                name="month_year"
                value={formData.month_year}
                onChange={handleMonthYearChange}
                className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.month_year || isMonthExisting
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300'
                }`}
                required
                disabled={mode === 'edit'}
                aria-invalid={!!validationErrors.month_year}
              />
              {validationErrors.month_year && (
                <p className="text-red-600 text-xs mt-1 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" /> {validationErrors.month_year}
                </p>
              )}
              {isMonthExisting && (
                <p className="text-amber-600 text-xs mt-1 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" /> Ce mois existe déjà dans le système
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">Format: AAAA-MM (ex: 2024-01 pour janvier 2024)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du mois</label>
              <input
                type="text"
                name="month_name"
                value={formData.month_name}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Janvier 2024"
              />
              <p className="text-xs text-gray-500 mt-1">Nom d'affichage pour le mois (généré automatiquement)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de début <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.start_date ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                required
                aria-invalid={!!validationErrors.start_date}
              />
              {validationErrors.start_date && (
                <p className="text-red-600 text-xs mt-1 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" /> {validationErrors.start_date}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">Premier jour de la période de paie</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de fin <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.end_date ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                required
                aria-invalid={!!validationErrors.end_date}
              />
              {validationErrors.end_date && (
                <p className="text-red-600 text-xs mt-1 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" /> {validationErrors.end_date}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">Dernier jour de la période de paie</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Notes optionnelles sur ce mois de paie..."
              />
            </div>

            {mode === 'edit' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="draft">Brouillon</option>
                  <option value="calculated">Calculé</option>
                  <option value="approved">Approuvé</option>
                  <option value="paid">Payé</option>
                  <option value="closed">Clôturé</option>
                </select>
              </div>
            )}

            {formData.start_date && formData.end_date && duration > 0 && (
              <Card className="p-3 bg-blue-50 border-blue-200">
                <div className="flex items-start">
                  <Calendar className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                  <div className="text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-600">Période:</span>
                      <span className="font-medium text-gray-900">
                        {new Date(formData.start_date).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short'
                        })}
                        {' - '}
                        {new Date(formData.end_date).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Durée:</span>
                      <span className="font-medium text-green-600">
                        {duration} jour{duration > 1 ? 's' : ''}
                      </span>
                    </div>
                    {mode === 'create' && !isMonthExisting && (
                      <div className="flex justify-between mt-1">
                        <span className="text-gray-600">Disponibilité:</span>
                        <span className="font-medium text-green-600 flex items-center">
                          <CheckCircle className="w-3 h-3 mr-1" /> Disponible
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end space-x-3">
            <Button type="button" onClick={onClose} variant="outline" disabled={loading}>
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || isMonthExisting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {mode === 'create' ? 'Création...' : 'Sauvegarde...'}
                </span>
              ) : mode === 'create' ? 'Créer le mois' : 'Sauvegarder'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PayMonthModal;