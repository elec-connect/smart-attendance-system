const { body, validationResult } = require('express-validator');

const validationMiddleware = {
  // Validation de la connexion
  validateLogin: [
    body('email')
      .isEmail()
      .withMessage('Veuillez fournir un email valide')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Le mot de passe doit contenir au moins 6 caractères')
  ],

  // ✅ Validation de l'employé - Version qui accepte les deux formats
  validateEmployee: [
    // Accepter soit firstName OU first_name
    body('firstName')
      .optional()
      .trim()
      .custom((value, { req }) => {
        // Si firstName n'est pas fourni mais first_name oui, c'est OK
        if (!value && req.body.first_name) return true;
        return value && value.length >= 2;
      })
      .withMessage('Le prénom doit contenir au moins 2 caractères'),
    
    body('first_name')
      .optional()
      .trim()
      .custom((value, { req }) => {
        // Si first_name n'est pas fourni mais firstName oui, c'est OK
        if (!value && req.body.firstName) return true;
        return value && value.length >= 2;
      })
      .withMessage('Le prénom doit contenir au moins 2 caractères'),

    // Accepter soit lastName OU last_name
    body('lastName')
      .optional()
      .trim()
      .custom((value, { req }) => {
        if (!value && req.body.last_name) return true;
        return value && value.length >= 2;
      })
      .withMessage('Le nom doit contenir au moins 2 caractères'),
    
    body('last_name')
      .optional()
      .trim()
      .custom((value, { req }) => {
        if (!value && req.body.lastName) return true;
        return value && value.length >= 2;
      })
      .withMessage('Le nom doit contenir au moins 2 caractères'),

    // Email (accepte les deux formats)
    body('email')
      .optional()
      .isEmail()
      .withMessage('Veuillez fournir un email valide')
      .normalizeEmail(),
    
    body('cin')
      .optional()
      .trim()
      .isLength({ min: 5, max: 20 })
      .withMessage('Le CIN doit contenir entre 5 et 20 caractères'),

    // Département (accepte les deux formats)
    body('department')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Le département ne peut pas être vide'),
    
    body('department')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Le département ne peut pas être vide'),

    // Poste (accepte les deux formats)
    body('position')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Le poste ne peut pas être vide'),

    // Téléphone
    body('phone')
      .optional()
      .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/)
      .withMessage('Numéro de téléphone invalide')
  ],

  // Validation de la présence
  validateAttendance: [
    body('employeeId')
      .trim()
      .notEmpty()
      .withMessage('L\'ID employé est requis'),
    body('date')
      .isISO8601()
      .withMessage('Format de date invalide (YYYY-MM-DD)'),
    body('checkIn')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Format d\'heure invalide (HH:mm)')
  ],

  // Middleware pour gérer les résultats de validation
  handleValidationErrors: (req, res, next) => {
    console.log('🔍 [VALIDATION] Vérification des erreurs');
    console.log('📦 Body reçu:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ [VALIDATION] Erreurs trouvées:', errors.array());
      return res.status(400).json({
        success: false,
        errors: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      });
    }
    
    console.log('✅ [VALIDATION] Validation réussie');
    next();
  }
};

module.exports = validationMiddleware;