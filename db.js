const { Pool } = require('pg');

// Render proporciona automáticamente la variable DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Requerido para conexiones seguras en Render/Heroku
  }
});

module.exports = pool;