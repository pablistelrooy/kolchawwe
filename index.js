const express = require('express');
const cors = require('cors');
const path = require('path'); // Librería nativa para manejar rutas de archivos
const pool = require('./db'); // Tu conexión a Postgres

const app = express();

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());

// --- SERVIR ARCHIVOS ESTÁTICOS ---
// Esto le dice a Render que todos los archivos en la carpeta 'public' 
// (index.html, admin.html, imágenes, etc.) son públicos.
app.use(express.static(path.join(__dirname, 'public')));

// --- RUTAS DE LA API ---

// 1. Ruta para obtener todas las cervezas (GET)
app.get('/api/cervezas', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre, stock, precio FROM cervezas ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al consultar la base de datos' });
    }
});

// 2. Ruta para actualizar el stock (PUT)
app.put('/api/admin/stock', async (req, res) => {
    const { id, nuevo_stock, password } = req.body;
    
    // Validación de contraseña usando variables de entorno en Render
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    try {
        const result = await pool.query(
            'UPDATE cervezas SET stock = $1 WHERE id = $2 RETURNING *', 
            [nuevo_stock, id]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Cerveza no encontrada' });
        }
        
        res.json({ mensaje: 'Stock actualizado con éxito', producto: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar la base de datos' });
    }
});

// --- RUTA COMPLEMENTARIA ---
// Si el usuario entra a una ruta que no existe, lo mandamos al index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de Kolchawwe corriendo en puerto ${PORT}`);
    console.log(`Acceso local: http://localhost:${PORT}`);
});