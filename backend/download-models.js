// download-models.js - VERSION COMPLÈTE
const fs = require('fs');
const path = require('path');
const https = require('https');

const models = [
    // === MODÈLES SSD (déjà présents) ===
    {
        name: 'ssd_mobilenetv1_model-weights_manifest.json',
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/ssd_mobilenetv1_model-weights_manifest.json'
    },
    {
        name: 'ssd_mobilenetv1_model-shard1',
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/ssd_mobilenetv1_model-shard1'
    },
    {
        name: 'ssd_mobilenetv1_model-shard2',
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/ssd_mobilenetv1_model-shard2'
    },
    
    // === MODÈLES FACE LANDMARK 68 (normaux) ===
    {
        name: 'face_landmark_68_model-weights_manifest.json',
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-weights_manifest.json'
    },
    {
        name: 'face_landmark_68_model-shard1',
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-shard1'
    },
    
    // === MODÈLES RECONNAISSANCE FACIALE ===
    {
        name: 'face_recognition_model-weights_manifest.json',
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-weights_manifest.json'
    },
    {
        name: 'face_recognition_model-shard1',
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard1'
    },
    {
        name: 'face_recognition_model-shard2',
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard2'
    },
    
    // === MODÈLES TINY (ULTRA RAPIDES) - NOUVEAUX ===
    {
        name: 'tiny_face_detector_model-weights_manifest.json',
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-weights_manifest.json'
    },
    {
        name: 'tiny_face_detector_model-shard1',
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-shard1'
    },
    {
        name: 'face_landmark_68_tiny_model-weights_manifest.json',
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_tiny_model-weights_manifest.json'
    },
    {
        name: 'face_landmark_68_tiny_model-shard1',
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_tiny_model-shard1'
    },
    
    // === MODÈLES ALTERNATIFS (optionnels) ===
    {
        name: 'mtcnn_model-weights_manifest.json',
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/mtcnn_model-weights_manifest.json'
    },
    {
        name: 'mtcnn_model-shard1',
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/mtcnn_model-shard1'
    },
    {
        name: 'mtcnn_model-shard2',
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/mtcnn_model-shard2'
    }
];

const modelsDir = path.join(__dirname, 'models');

if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
    console.log(`📁 Dossier créé: ${modelsDir}`);
}

function downloadFile(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        console.log(`⬇️  Téléchargement: ${path.basename(filepath)}`);
        
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Échec ${url}: ${response.statusCode}`));
                return;
            }
            
            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloaded = 0;
            
            response.on('data', (chunk) => {
                downloaded += chunk.length;
                if (totalSize) {
                    const percent = ((downloaded / totalSize) * 100).toFixed(1);
                    process.stdout.write(`\r📥 ${path.basename(filepath)}: ${percent}% (${(downloaded / 1024 / 1024).toFixed(2)} MB)`);
                }
            });
            
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`\n✅ ${path.basename(filepath)} téléchargé`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
        });
    });
}

async function downloadAllModels() {
    console.log('🚀 Téléchargement de TOUS les modèles face-api.js');
    console.log(`📁 Destination: ${modelsDir}`);
    console.log(`📦 Total: ${models.length} fichiers\n`);
    
    const downloaded = [];
    const failed = [];
    
    for (const model of models) {
        const filepath = path.join(modelsDir, model.name);
        
        // Vérifier si le fichier existe déjà
        if (fs.existsSync(filepath)) {
            console.log(`📄 Existe déjà: ${model.name}`);
            downloaded.push(model.name);
            continue;
        }
        
        try {
            await downloadFile(model.url, filepath);
            downloaded.push(model.name);
            
            // Pause pour éviter les requêtes trop rapides
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
            console.error(`\n❌ Erreur ${model.name}:`, error.message);
            failed.push(model.name);
        }
    }
    
    // Résumé
    console.log('\n' + '='.repeat(50));
    console.log('📊 RÉSUMÉ DU TÉLÉCHARGEMENT');
    console.log('='.repeat(50));
    console.log(`✅ Téléchargés avec succès: ${downloaded.length}`);
    console.log(`❌ Échecs: ${failed.length}`);
    
    if (downloaded.length > 0) {
        console.log('\n📁 Fichiers téléchargés:');
        downloaded.forEach(file => console.log(`   • ${file}`));
    }
    
    if (failed.length > 0) {
        console.log('\n⚠️  Fichiers en échec:');
        failed.forEach(file => console.log(`   • ${file}`));
    }
    
    // Vérification des modèles essentiels
    console.log('\n🔍 VÉRIFICATION DES MODÈLES ESSENTIELS:');
    const essentialModels = [
        'ssd_mobilenetv1_model-weights_manifest.json',
        'face_landmark_68_model-weights_manifest.json',
        'face_recognition_model-weights_manifest.json',
        'tiny_face_detector_model-weights_manifest.json',
        'face_landmark_68_tiny_model-weights_manifest.json'
    ];
    
    essentialModels.forEach(model => {
        const exists = fs.existsSync(path.join(modelsDir, model));
        console.log(`${exists ? '✅' : '❌'} ${model}`);
    });
    
    console.log('\n🎉 Téléchargement terminé !');
    console.log('➡️  Redémarrez votre serveur avec: npm run dev');
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (error) => {
    console.error('❌ Erreur non gérée:', error);
    process.exit(1);
});

// Exécution
downloadAllModels();