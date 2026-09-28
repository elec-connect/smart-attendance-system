// backend/scripts/migrate-env-to-db.cjs
// Migre les comptes SMTP de .env vers la base (chiffrés AES-256-GCM)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = require('../config/db');
const { encrypt } = require('../src/utils/crypto');

async function migrate() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('   MIGRATION SMTP : .env → base de données (chiffré)');
    console.log('='.repeat(70) + '\n');

    const accounts = [];

    for (let i = 1; i <= 5; i++) {
      const host = process.env[`SMTP_HOST_${i}`] || process.env.SMTP_HOST;
      const port = process.env[`SMTP_PORT_${i}`] || process.env.SMTP_PORT || 587;
      const user = process.env[`SMTP_USER_${i}`];
      const password = process.env[`SMTP_PASSWORD_${i}`];
      const fromEmail = process.env[`EMAIL_FROM_${i}`] || user;
      const fromName = process.env.SMTP_FROM_NAME || 'Smart Attendance';

      if (user && password) {
        accounts.push({
          name: `Compte ${i}`,
          email: fromEmail,
          smtp_host: host || 'smtp.gmail.com',
          smtp_port: parseInt(port) || 587,
          smtp_secure: false,
          smtp_user: user,
          smtp_password: password,
          from_name: fromName,
          priority: i - 1,
        });
      }
    }

    if (accounts.length === 0) {
      console.log('⚠️  Aucun compte SMTP trouvé dans .env');
      console.log('   Vérifiez que SMTP_USER_1 et SMTP_PASSWORD_1 sont définis.\n');
      process.exit(0);
    }

    console.log(`📋 ${accounts.length} compte(s) à migrer:\n`);
    accounts.forEach((a, i) => console.log(`   ${i + 1}. ${a.email}`));
    console.log('');

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const acc of accounts) {
      try {
        // 🔐 Chiffrer avant insertion
        const encryptedPassword = encrypt(acc.smtp_password);

        await db.query(`
          INSERT INTO email_accounts 
          (name, email, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, from_name, priority)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (email) DO NOTHING
        `, [
          acc.name, acc.email, acc.smtp_host, acc.smtp_port,
          acc.smtp_secure, acc.smtp_user, encryptedPassword,
          acc.from_name, acc.priority
        ]);
        inserted++;
        console.log(`   ✅ ${acc.email} (password chiffré)`);
      } catch (err) {
        if (err.code === '23505') {
          skipped++;
          console.log(`   ⏭️  ${acc.email} (déjà en base)`);
        } else {
          errors++;
          console.log(`   ❌ ${acc.email} : ${err.message}`);
        }
      }
    }

    console.log(`\n📊 Résultat: ${inserted} inséré(s), ${skipped} ignoré(s), ${errors} erreur(s)`);
    console.log('\n✅ Migration terminée !\n');
    console.log('💡 Vérifiez dans l\'interface : Paramètres → Emails\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

migrate();
