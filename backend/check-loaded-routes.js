// check-loaded-routes.js
console.log('🔍 VERIFICATION DES ROUTES CHARGÉES');

// Vérifiez le server.js
const fs = require('fs');
try {
  const serverContent = fs.readFileSync('server.js', 'utf8');
  const authImport = serverContent.match(/require.*auth.*routes/g);
  console.log('Imports auth dans server.js:', authImport);
} catch (err) {
  console.log('❌ Impossible de lire server.js');
}

// Liste des fichiers routes disponibles
const routesFiles = fs.readdirSync('./routes');
console.log('Fichiers dans routes/:', routesFiles);// JavaScript source code
