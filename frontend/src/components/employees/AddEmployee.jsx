import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { employeeService } from '../../services/api';
import { isValidEmail } from '../../utils/helpers';
import Button from '../common/Button';
import Input from '../common/Input';
import { 
  FaUser, 
  FaEnvelope, 
  FaPhone, 
  FaBriefcase,
  FaCalendar,
  FaLock,
  FaEdit
} from 'react-icons/fa';

const AddEmployee = ({ employee, onSuccess }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    hireDate: new Date().toISOString().split('T')[0],
    status: 'active'
  });
  
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: ''
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  useEffect(() => {
    if (employee) {
      setIsEditMode(true);
      setFormData({
        firstName: employee.firstName || '',
        lastName: employee.lastName || '',
        email: employee.email || '',
        phone: employee.phone || '',
        department: employee.department || '',
        position: employee.position || '',
        hireDate: employee.hireDate || new Date().toISOString().split('T')[0],
        status: employee.status || 'active'
      });
    }
  }, [employee]);

  const departments = [
    'IT',
    'RH',
    'Finance',
    'Marketing',
    'Ventes',
    'Production',
    'Logistique',
    'Administration'
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Le prénom est requis';
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Le nom est requis';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'L\'email est requis';
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = 'Email invalide';
    }
    
    if (!formData.department) {
      newErrors.department = 'Le département est requis';
    }
    
    if (!formData.position.trim()) {
      newErrors.position = 'Le poste est requis';
    }
    
    // Validation du mot de passe uniquement si on est en mode modification ET les champs sont affichés
    if (showPasswordFields) {
      if (!passwordData.password) {
        newErrors.password = 'Le mot de passe est requis';
      } else if (passwordData.password.length < 6) {
        newErrors.password = 'Le mot de passe doit contenir au moins 6 caractères';
      }
      
      if (passwordData.password !== passwordData.confirmPassword) {
        newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
      }
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setLoading(true);
    
    try {
      const employeeData = { ...formData };
      
      // Si on est en mode édition et qu'on veut changer le mot de passe
      if (isEditMode && showPasswordFields && passwordData.password) {
        employeeData.password = passwordData.password;
      }
      
      // Ne pas envoyer les champs vides
      if (!employeeData.phone) delete employeeData.phone;
      if (!employeeData.hireDate) delete employeeData.hireDate;
      
      let response;
      if (isEditMode) {
        response = await employeeService.updateEmployee(employee.id, employeeData);
      } else {
        // En création, pas besoin d'envoyer de mot de passe
        response = await employeeService.createEmployee(employeeData);
      }
      
      if (response.success) {
        let successMessage = isEditMode ? 
          'Employé mis à jour avec succès' : 
          'Employé créé avec succès';
        
        // Ajouter une info sur le mot de passe par défaut
        if (!isEditMode) {
          successMessage += `. Mot de passe par défaut: ${formData.firstName.toLowerCase()}123`;
        } else if (showPasswordFields && passwordData.password) {
          successMessage += ' (Mot de passe mis à jour)';
        }
        
        toast.success(successMessage);
        
        // Réinitialiser les champs mot de passe
        if (showPasswordFields) {
          setPasswordData({
            password: '',
            confirmPassword: ''
          });
          setShowPasswordFields(false);
        }
        
        onSuccess();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 
        (isEditMode ? 
          'Erreur lors de la mise à jour de l\'employé' : 
          'Erreur lors de la création de l\'employé'
        );
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Prénom"
          name="firstName"
          value={formData.firstName}
          onChange={handleChange}
          error={errors.firstName}
          required
          icon={FaUser}
        />
        
        <Input
          label="Nom"
          name="lastName"
          value={formData.lastName}
          onChange={handleChange}
          error={errors.lastName}
          required
          icon={FaUser}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
          required
          icon={FaEnvelope}
        />
        
        <Input
          label="Téléphone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          icon={FaPhone}
          placeholder="+33 1 23 45 67 89"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Département *
          </label>
          <select
            name="department"
            value={formData.department}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          >
            <option value="">Sélectionnez un département</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          {errors.department && (
            <p className="mt-1 text-sm text-red-600">{errors.department}</p>
          )}
        </div>
        
        <Input
          label="Poste"
          name="position"
          value={formData.position}
          onChange={handleChange}
          error={errors.position}
          required
          icon={FaBriefcase}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Date d'embauche"
          name="hireDate"
          type="date"
          value={formData.hireDate}
          onChange={handleChange}
          icon={FaCalendar}
        />
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Statut
          </label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
            <option value="on_leave">En congé</option>
          </select>
        </div>
      </div>
      
      {/* Section Mot de passe - Visible uniquement en mode édition et quand on clique sur "Modifier mot de passe" */}
      {isEditMode && (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Modifier le mot de passe
            </h3>
            <button
              type="button"
              onClick={() => setShowPasswordFields(!showPasswordFields)}
              className="flex items-center gap-2 text-primary-600 hover:text-primary-700"
            >
              <FaEdit />
              {showPasswordFields ? 'Masquer' : 'Modifier le mot de passe'}
            </button>
          </div>
          
          {showPasswordFields && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nouveau mot de passe"
                name="password"
                type="password"
                value={passwordData.password}
                onChange={handlePasswordChange}
                error={errors.password}
                required={showPasswordFields}
                icon={FaLock}
                placeholder="Laisser vide pour garder l'actuel"
              />
              
              <Input
                label="Confirmer le nouveau mot de passe"
                name="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                error={errors.confirmPassword}
                required={showPasswordFields}
                icon={FaLock}
              />
            </div>
          )}
        </div>
      )}
      
      <div className="flex justify-end space-x-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => onSuccess()}
        >
          Annuler
        </Button>
        
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={loading}
        >
          {isEditMode ? 'Mettre à jour' : 'Créer l\'employé'}
        </Button>
      </div>
      
      {/* Message d'information pour la création */}
      {!isEditMode && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Information :</strong> Le mot de passe par défaut sera généré automatiquement : <code>{formData.firstName ? `${formData.firstName.toLowerCase()}123` : 'prénom123'}</code>
          </p>
        </div>
      )}
    </form>
  );
};

export default AddEmployee;