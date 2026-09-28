// backend/middleware/licenseMiddleware.js
const fs = require('fs');
const path = require('path');

// ⚠️ DOIT ÊTRE IDENTIQUE À CELUI DANS activation.iss
const SECRET_KEY = 'SmartAttendance_Pro_2026_Haouala_Super_Secure_Key_789456123';
const TRIAL_DAYS = 30;

// ==================== FONCTIONS HASH (IDENTIQUES À Inno Setup) ====================

function simpleHash(data) {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5) - hash) + data.charCodeAt(i);
        hash = hash >>> 0;
    }
    return hash.toString(16).toUpperCase().padStart(8, '0');
}

function generateSignature(company, expirationDate) {
    const data = `${company}|${expirationDate}`;
    return simpleHash(data + SECRET_KEY);
}

// ==================== VALIDATION DE LICENCE ====================

function validateLicenseKey(licenseKey) {
    const parts = licenseKey.split('|');
    if (parts.length !== 3) {
        return { valid: false, error: 'Format invalide' };
    }

    const [company, expirationDate, providedSignature] = parts;
    const expectedSignature = generateSignature(company, expirationDate);

    const isValidSignature = providedSignature === expectedSignature;

    const today = new Date().toISOString().split('T')[0];
    const isExpired = expirationDate < today;

    return {
        valid: isValidSignature && !isExpired,
        signatureValid: isValidSignature,
        expired: isExpired,
        company: company,
        expires: expirationDate,
        daysLeft: !isExpired ? Math.ceil((new Date(expirationDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0
    };
}

// ==================== GESTION DES FICHIERS ====================

function getLicenseFilePath() {
    return path.join(__dirname, '..', 'license.dat');
}

function getTrialFilePath() {
    return path.join(__dirname, '..', '.trial');
}

function getCurrentDateISO() {
    return new Date().toISOString().split('T')[0];
}

function addDaysToDate(dateISO, days) {
    const date = new Date(dateISO);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

function daysBetween(dateISO1, dateISO2) {
    const d1 = new Date(dateISO1);
    const d2 = new Date(dateISO2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ==================== PÉRIODE D'ESSAI ====================

function checkTrialPeriod() {
    const trialFile = getTrialFilePath();
    
    if (!fs.existsSync(trialFile)) {
        const firstRun = getCurrentDateISO();
        fs.writeFileSync(trialFile, firstRun, 'utf8');
        
        return {
            isActivated: false,
            isTrial: true,
            daysUsed: 0,
            daysLeft: TRIAL_DAYS,
            expirationDate: addDaysToDate(firstRun, TRIAL_DAYS),
            companyName: "Période d'essai"
        };
    }
    
    const firstRun = fs.readFileSync(trialFile, 'utf8').trim();
    const currentDate = getCurrentDateISO();
    const daysUsed = daysBetween(firstRun, currentDate);
    const daysLeft = TRIAL_DAYS - daysUsed;
    
    return {
        isActivated: false,
        isTrial: true,
        daysUsed: daysUsed,
        daysLeft: daysLeft,
        expirationDate: addDaysToDate(firstRun, TRIAL_DAYS),
        companyName: "Période d'essai"
    };
}

// ==================== FONCTION PRINCIPALE ====================

function getLicenseStatus() {
    const licenseFile = getLicenseFilePath();
    
    // Vérifier la licence existante
    if (fs.existsSync(licenseFile)) {
        const licenseKey = fs.readFileSync(licenseFile, 'utf8').trim();
        const validation = validateLicenseKey(licenseKey);
        
        if (validation.valid) {
            return {
                isValid: true,
                isActivated: true,
                isTrial: false,
                companyName: validation.company,
                expirationDate: validation.expires,
                daysLeft: validation.daysLeft,
                message: `Licence valide pour ${validation.company} jusqu'au ${validation.expires}`
            };
        }
    }
    
    // Vérifier la période d'essai
    const trial = checkTrialPeriod();
    
    if (trial.daysLeft > 0) {
        return {
            isValid: true,
            isActivated: false,
            isTrial: true,
            companyName: trial.companyName,
            expirationDate: trial.expirationDate,
            daysUsed: trial.daysUsed,
            daysLeft: trial.daysLeft,
            message: `Période d'essai: ${trial.daysLeft} jours restants`
        };
    }
    
    return {
        isValid: false,
        isActivated: false,
        isTrial: false,
        daysLeft: 0,
        message: 'Licence expirée ou invalide'
    };
}

// ==================== MIDDLEWARE EXPRESS ====================

function licenseMiddleware(req, res, next) {
    // Routes publiques qui ne nécessitent pas de licence
    const publicRoutes = [
        '/api/health',
        '/api/ping',
        '/api/test-cors',
        '/api/license-status',
        '/api/activate',
        '/api/network-info'
    ];
    
    if (publicRoutes.some(route => req.path === route)) {
        return next();
    }
    
    const status = getLicenseStatus();
    
    if (!status.isValid) {
        return res.status(403).json({
            success: false,
            error: 'LICENSE_REQUIRED',
            message: 'Licence expirée ou invalide. Veuillez activer le logiciel.',
            license: status
        });
    }
    
    // Ajouter les infos de licence à la requête
    req.license = status;
    next();
}

// ==================== ROUTE D'ACTIVATION ====================

function setupActivationRoute(app) {
    app.post('/api/activate', (req, res) => {
        const { licenseKey } = req.body;
        
        if (!licenseKey) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_LICENSE_KEY',
                message: 'Veuillez fournir une clé de licence'
            });
        }
        
        const validation = validateLicenseKey(licenseKey);
        
        if (validation.valid) {
            // Sauvegarder la licence
            const licenseFile = getLicenseFilePath();
            fs.writeFileSync(licenseFile, licenseKey, 'utf8');
            
            // Supprimer le fichier d'essai si existant
            const trialFile = getTrialFilePath();
            if (fs.existsSync(trialFile)) {
                fs.unlinkSync(trialFile);
            }
            
            return res.json({
                success: true,
                message: 'Licence activée avec succès',
                license: {
                    company: validation.company,
                    expires: validation.expires,
                    daysLeft: validation.daysLeft
                }
            });
        } else {
            return res.status(400).json({
                success: false,
                error: 'INVALID_LICENSE_KEY',
                message: 'Clé de licence invalide',
                details: validation
            });
        }
    });
    
    app.get('/api/license-status', (req, res) => {
        const status = getLicenseStatus();
        res.json({
            success: true,
            license: status
        });
    });
}

module.exports = {
    licenseMiddleware,
    setupActivationRoute,
    getLicenseStatus,
    validateLicenseKey
};