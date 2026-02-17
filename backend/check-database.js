// backend/check-database.js
const db = require('./config/db');

async function checkDatabase() {
  console.log('🔍 INSPECTION BASE DE DONNÉES\n');
  
  try {
    // 1. Vérifier les tables
    console.log('1. 📋 TABLES DISPONIBLES:');
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    tables.rows.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });
    
    // 2. Vérifier la table employees
    console.log('\n2. 👥 TABLE EMPLOYEES:');
    const employeesColumns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'employees'
      ORDER BY ordinal_position
    `);
    
    console.log(`   ${employeesColumns.rows.length} colonnes:`);
    employeesColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
    
    // 3. Vérifier les données dans employees
    console.log('\n3. 📊 DONNÉES EMPLOYEES:');
    const employeesData = await db.query('SELECT COUNT(*) as count FROM employees');
    console.log(`   Total enregistrements: ${employeesData.rows[0].count}`);
    
    if (parseInt(employeesData.rows[0].count) > 0) {
      const users = await db.query(`
        SELECT 
          id, 
          employee_id, 
          email, 
          first_name, 
          last_name,
          role,
          password_hash IS NOT NULL as has_password,
          password_hash,
          created_at::date as created
        FROM employees 
        ORDER BY id
        LIMIT 10
      `);
      
      console.log('\n   Derniers utilisateurs:');
      users.rows.forEach(user => {
        console.log(`   👤 ID: ${user.id} | ${user.employee_id}`);
        console.log(`      Nom: ${user.first_name} ${user.last_name}`);
        console.log(`      Email: ${user.email}`);
        console.log(`      Rôle: ${user.role || 'Non défini'}`);
        console.log(`      Mot de passe: ${user.has_password ? 'Défini' : 'Non défini'}`);
        console.log(`      Hash (début): ${user.password_hash ? user.password_hash.substring(0, 30) + '...' : 'NULL'}`);
        console.log(`      Créé: ${user.created}`);
        console.log('');
      });
    }
    
    // 4. Chercher spécifiquement haouala18@gmail.com
    console.log('4. 🔎 RECHERCHE haouala18@gmail.com:');
    const specificUser = await db.query(`
      SELECT * FROM employees WHERE email = $1
    `, ['haouala18@gmail.com']);
    
    if (specificUser.rows.length === 0) {
      console.log('   ❌ Utilisateur NON TROUVÉ');
      
      // Vérifier s'il existe avec un email différent
      const allEmails = await db.query(`
        SELECT email FROM employees ORDER BY email
      `);
      
      if (allEmails.rows.length > 0) {
        console.log('\n   📧 Emails existants:');
        allEmails.rows.forEach((row, i) => {
          console.log(`   ${i + 1}. ${row.email}`);
        });
      }
    } else {
      const user = specificUser.rows[0];
      console.log('   ✅ Utilisateur TROUVÉ:');
      console.log(`      ID: ${user.id}`);
      console.log(`      Employee ID: ${user.employee_id}`);
      console.log(`      Nom: ${user.first_name} ${user.last_name}`);
      console.log(`      Rôle: ${user.role || 'NULL'}`);
      console.log(`      Département: ${user.department || 'NULL'}`);
      console.log(`      Hash mot de passe: ${user.password_hash ? 'PRÉSENT' : 'ABSENT'}`);
      if (user.password_hash) {
        console.log(`      Hash (60 premiers): ${user.password_hash.substring(0, 60)}`);
      }
    }
    
    // 5. Vérifier la table users (au cas où)
    console.log('\n5. 🔎 TABLE USERS (si existe):');
    try {
      const usersTableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'users'
        )
      `);
      
      if (usersTableCheck.rows[0].exists) {
        const usersData = await db.query(`
          SELECT table_name, column_name, data_type
          FROM information_schema.columns 
          WHERE table_name = 'users'
          ORDER BY ordinal_position
        `);
        
        console.log(`   Table users existe (${usersData.rows.length} colonnes)`);
        usersData.rows.forEach(col => {
          console.log(`   - ${col.column_name} (${col.data_type})`);
        });
        
        // Vérifier les données
        const usersCount = await db.query('SELECT COUNT(*) as count FROM users');
        console.log(`   ${usersCount.rows[0].count} enregistrement(s) dans users`);
      } else {
        console.log('   Table users n\'existe pas');
      }
    } catch (error) {
      console.log('   ❌ Erreur vérification table users:', error.message);
    }
    
  } catch (error) {
    console.error('💥 ERREUR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await db.end();
    console.log('\n🔌 Connexion fermée');
  }
}

checkDatabase();// JavaScript source code
