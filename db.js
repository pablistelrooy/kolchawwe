const { Pool } = require('pg');

/**
 * Conexión a PostgreSQL.
 * Render inyecta automáticamente DATABASE_URL si conectas la DB al servicio,
 * o puedes configurarla manualmente en el panel de Environment.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Obligatorio para Render
  }
});

module.exports = pool;