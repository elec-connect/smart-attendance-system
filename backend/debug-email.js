// debug-email.js
require('dotenv').config({ path: '.env' });

console.log('🔍 DEBUG EMAIL CONFIGURATION');
console.log('=============================');
console.log('');

// Lister TOUTES les variables d'environnement email
const envVars = process.env;
let emailVars = {};

for (const key in envVars) {
  if (key.includes('EMAIL') || key.includes('SMTP') || key.includes('MAIL')) {
    emailVars[key] = envVars[key];
  }
}

console.log('📧 VARIABLES EMAIL TROUVÉES:');
Object.keys(emailVars).forEach(key => {
  const value = emailVars[key];
  const masked = key.includes('PASS') ? '****' + value.slice(-4) : value;
  console.log(`  ${key}: ${masked}`);
});

console.log('');
console.log('🔧 CONFIGURATION DÉDUITE:');
console.log('-------------------------');

const config = {
  host: emailVars.EMAIL_HOST || emailVars.SMTP_HOST,
  port: parseInt(emailVars.EMAIL_PORT || emailVars.SMTP_PORT || 587),
  secure: (emailVars.EMAIL_SECURE || emailVars.SMTP_SECURE || 'false') === 'true',
  user: emailVars.EMAIL_USER || emailVars.SMTP_USER,
  pass: emailVars.EMAIL_PASS || emailVars.SMTP_PASSWORD
};

console.log('Host:', config.host || 'NON DÉFINI');
console.log('Port:', config.port);
console.log('Secure:', config.secure);
console.log('User:', config.user || 'NON DÉFINI');
console.log('Pass défini:', config.pass ? 'OUI (' + config.pass.substring(0, 4) + '...)' : 'NON');

// Test direct avec nodemailer
console.log('');
console.log('🚀 TEST DIRECT NODEMAILER...');

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: config.host,
  port: config.port,
  secure: config.secure,
  auth: {
    user: config.user,
    pass: config.pass
  },
  tls: {
    rejectUnauthorized: false
  }
});

transporter.verify(function(error, success) {
  if (error) {
    console.log('❌ ERREUR CONNEXION SMTP:');
    console.log('   Message:', error.message);
    console.log('   Code:', error.code);
    console.log('');
    console.log('💡 SOLUTIONS:');
    console.log('   1. Vérifier que 2FA est activé sur le compte Google');
    console.log('   2. Générer un nouveau mot de passe d\'application:');
    console.log('      https://myaccount.google.com/apppasswords');
    console.log('   3. Vérifier que le mot de passe ne contient PAS d\'espaces');
  } else {
    console.log('✅ CONNEXION SMTP RÉUSSIE!');
    console.log('Le serveur est prêt à envoyer des emails');
  }
});
