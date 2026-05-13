const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// IMPORTANTE: Esta línea debe ir antes de cualquier ruta personalizada
app.use(express.static(path.join(__dirname, 'public')));

// RUTA PARA OBTENER LAS CERVEZAS
app.get('/api/cervezas', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre, precio, stock FROM cervezas ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error("Error en DB:", err);
        res.status(500).json({ error: 'Error de conexión a base de datos' });
    }
});

// RUTA PARA GUARDAR CAMBIOS (ADMIN)
app.put('/api/admin/stock', async (req, res) => {
    const { id, precio, stock, password } = req.body;
    const CLAVE_FIJA = "1234";

    if (String(password).trim() !== CLAVE_FIJA) {
        return res.status(401).json({ error: 'Clave incorrecta' });
    }

    try {
        await pool.query(
            'UPDATE cervezas SET precio = $1, stock = $2 WHERE id = $3',
            [precio, stock, id]
        );
        res.json({ mensaje: '¡Guardado con éxito!' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

// Si no existe el archivo en public, mostrar error 404 claro en lugar de redirigir siempre
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🍺 Servidor activo en puerto ${PORT}`);
});