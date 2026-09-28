// reset-password.cjs
// Réinitialise le mot de passe d'un utilisateur existant
const bcrypt = require('bcryptjs');
const db = require('./config/db');

async function resetPassword() {
  try {
    // ⚠️ MODIFIEZ CES VALEURS SI BESOIN
    const targetEmail = 'admin@admin.com';
    const newPassword = 'Admin123!';

    console.log('\n' + '='.repeat(60));
    console.log('   RÉINITIALISATION DU MOT DE PASSE');
    console.log('='.repeat(60));
    console.log(`   Email    : ${targetEmail}`);
    console.log(`   Password : ${newPassword}`);
    console.log('='.repeat(60) + '\n');

    // Vérifier que l'utilisateur existe
    const check = await db.query(
      'SELECT id, email, first_name, last_name, role FROM employees WHERE email = $1',
      [targetEmail]
    );

    if (check.rows.length === 0) {
      console.error(`❌ Aucun utilisateur avec email: ${targetEmail}`);
      console.log('\n📋 Comptes disponibles:');
      const all = await db.query('SELECT email, role, employee_id FROM employees ORDER BY employee_id');
      console.table(all.rows);
      process.exit(1);
    }

    const user = check.rows[0];
    console.log(`✅ Utilisateur trouvé: ${user.first_name} ${user.last_name} (${user.role})`);

    // Hasher le nouveau mot de passe
    const hash = await bcrypt.hash(newPassword, 10);
    console.log(`🔐 Hash généré: ${hash.substring(0, 30)}...`);

    // Mettre à jour
    await db.query(
      'UPDATE employees SET password_hash = $1, updated_at = NOW() WHERE email = $2',
      [hash, targetEmail]
    );

    console.log('\n✅ MOT DE PASSE RÉINITIALISÉ !\n');
    console.log('🔑 Identifiants de connexion:');
    console.log(`   Email    : ${targetEmail}`);
    console.log(`   Password : ${newPassword}\n`);
    console.log('💡 Copiez ces identifiants dans le formulaire de connexion.\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
}

resetPassword();