const { Pool } = require('pg');

// Creamos el pool de conexiones
const pool = new Pool({
  // Tomamos la URL de la variable de entorno que configuraremos en Render
  connectionString: process.env.DATABASE_URL,
  
  // CONFIGURACIÓN CRÍTICA PARA RENDER:
  // Render requiere SSL para conexiones externas e internas.
  ssl: {
    rejectUnauthorized: false // Permite la conexión aunque el certificado sea autodirmado por Render
  }
});

// Probamos la conexión al iniciar
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos de Kolchawwe:', err.stack);
  } else {
    console.log('✅ Conexión exitosa a PostgreSQL: ', res.rows[0].now);
  }
});

module.exports = pool;