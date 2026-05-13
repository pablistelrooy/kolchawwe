const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db'); // Importamos el conector que creamos arriba

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// RUTA PARA OBTENER LAS CERVEZAS DESDE LA DB
app.get('/api/cervezas', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre, precio, stock FROM cervezas ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error("Error en DB:", err);
        res.status(500).json({ error: 'No se pudo conectar con la base de datos' });
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
        const result = await pool.query(
            'UPDATE cervezas SET precio = $1, stock = $2 WHERE id = $3 RETURNING *',
            [precio, stock, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Variedad no encontrada' });
        }

        res.json({ mensaje: '¡Cambios guardados en la base de datos!', producto: result.rows[0] });
    } catch (err) {
        console.error("Error al actualizar:", err);
        res.status(500).json({ error: 'Error al guardar en la base de datos' });
    }
});

// Servir la web principal
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🍺 Servidor Kolchawwe Conectado en puerto ${PORT}`);
});