// frontend/scripts/update-ip.js
const fs = require('fs');
const path = require('path');
const { networkInterfaces } = require('os');

/**
 * Récupère la meilleure IP locale (non interne) disponible
 * Priorité: Wi-Fi > Ethernet > autres
 */
function getBestLocalIP() {
  const nets = networkInterfaces();
  const candidates = [];
  
  console.log('\n🔍 Recherche des interfaces réseau...');
  
  for (const [name, interfaces] of Object.entries(nets)) {
    for (const net of interfaces) {
      // Cherche une IPv4 qui n'est pas interne (pas 127.0.0.1)
      if (net.family === 'IPv4' && !net.internal) {
        let priority = 999;
        
        // Donner une priorité selon le nom de l'interface
        if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wlan')) {
          priority = 1; // Wi-Fi en priorité
          console.log(`   📶 Wi-Fi détecté: ${name} -> ${net.address}`);
        } else if (name.toLowerCase().includes('ethernet') || name.toLowerCase().includes('eth')) {
          priority = 2; // Ethernet en second
          console.log(`   🔌 Ethernet détecté: ${name} -> ${net.address}`);
        } else {
          console.log(`   🖧 Autre interface: ${name} -> ${net.address}`);
        }
        
        candidates.push({
          ip: net.address,
          interface: name,
          priority: priority,
          mac: net.mac
        });
      }
    }
  }
  
  // Si aucune interface trouvée, retourner localhost
  if (candidates.length === 0) {
    console.log('⚠️  Aucune interface réseau trouvée, utilisation de localhost');
    return 'localhost';
  }
  
  // Trier par priorité (la plus petite d'abord)
  candidates.sort((a, b) => a.priority - b.priority);
  
  console.log(`\n✅ IP sélectionnée: ${candidates[0].ip} (${candidates[0].interface})`);
  return candidates[0].ip;
}

/**
 * Met à jour le fichier .env.production avec la nouvelle IP
 */
function updateEnvProduction(ip) {
  const envPath = path.join(__dirname, '..', '.env.production');
  let envContent = '';
  const timestamp = new Date().toLocaleString('fr-FR');
  
  console.log(`\n📝 Mise à jour de .env.production...`);
  
  // Lire le fichier existant s'il existe
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    console.log(`   📄 Fichier existant trouvé`);
  } else {
    console.log(`   📄 Création d'un nouveau fichier`);
  }
  
  // Nettoyer les anciennes lignes VITE_API_URL
  const lines = envContent.split('\n').filter(line => !line.startsWith('VITE_API_URL='));
  
  // Ajouter la nouvelle ligne avec l'IP détectée
  const newApiUrl = `VITE_API_URL=http://${ip}:5000/api`;
  lines.push(`# Auto-généré le ${timestamp}`);
  lines.push(newApiUrl);
  
  // Ajouter d'autres variables si nécessaire
  if (!envContent.includes('VITE_APP_NAME=')) {
    lines.push(`VITE_APP_NAME=Smart Attendance System`);
    lines.push(`VITE_APP_VERSION=1.0.0`);
  }
  
  // Écrire le fichier
  fs.writeFileSync(envPath, lines.join('\n').trim() + '\n');
  
  console.log(`   ✅ ${newApiUrl}`);
  console.log(`   ✅ Fichier mis à jour avec succès`);
}

/**
 * Met à jour ou crée .env pour le développement local
 */
function updateEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = '';
  
  console.log(`\n📝 Mise à jour de .env...`);
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  const lines = envContent.split('\n').filter(line => !line.startsWith('VITE_API_URL='));
  
  // Pour le développement local, on utilise localhost
  lines.push(`VITE_API_URL=http://localhost:5000/api`);
  lines.push(`VITE_APP_NAME=Smart Attendance System (Dev)`);
  
  fs.writeFileSync(envPath, lines.join('\n').trim() + '\n');
  console.log(`   ✅ .env mis à jour avec localhost`);
}

/**
 * Affiche un résumé des configurations
 */
function showSummary(ip) {
  console.log('\n' + '='.repeat(50));
  console.log('📊 RÉSUMÉ DE LA CONFIGURATION');
  console.log('='.repeat(50));
  console.log(`🌐 IP détectée: ${ip}`);
  console.log(`🔗 Backend URL: http://${ip}:5000/api`);
  console.log(`🌍 Frontend URL: http://${ip}:5173`);
  console.log('\n📁 Fichiers modifiés:');
  console.log(`   - .env.production (pour la production)`);
  console.log(`   - .env (pour le développement local)`);
  console.log('\n🚀 Pour lancer l\'application:');
  console.log(`   1. Démarrez le backend: cd ../backend && npm run dev`);
  console.log(`   2. Démarrez le frontend: npm run dev`);
  console.log(`   3. Accédez à: http://localhost:5173`);
  console.log('='.repeat(50) + '\n');
}

/**
 * Fonction principale
 */
function main() {
  console.log('\n🔧 GÉNÉRATEUR AUTOMATIQUE D\'IP');
  console.log('='.repeat(50));
  
  try {
    const ip = getBestLocalIP();
    updateEnvProduction(ip);
    updateEnvLocal();
    showSummary(ip);
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

// Exécuter le script
main();
