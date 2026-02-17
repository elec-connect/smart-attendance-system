const { Pool } = require("pg");
require("dotenv").config();

// ============================================
// CONFIGURATION RENDER (AJOUTEZ CES LIGNES)
// ============================================
let pool;

if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
  // Mode production sur Render avec DATABASE_URL
  console.log('🌐 Production mode: Using Render PostgreSQL');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Requis pour Render
    }
  });
} else {
 pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "smart_attendance_db",
  password: process.env.DB_PASSWORD || "Haouala18",
  port: process.env.DB_PORT || 5432,
});
}
pool.on("error", (err) => {
  console.error("Erreur inattendue sur le client idle de la base de données", err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};