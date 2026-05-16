const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db'); // Importa la conexión configurada en db.js

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// CLAVE DE SEGURIDAD PARA EL PANEL ADMIN
const CLAVE_ADMIN = "1234";

/**
 * ENDPOINT: Obtener todas las cervezas desde Postgres
 */
app.get('/api/cervezas', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cervezas ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error("Error al obtener productos:", err);
        res.status(500).json({ error: "Error en el servidor de base de datos" });
    }
});

/**
 * ENDPOINT: Actualizar Stock y Precio (Admin)
 */
app.put('/api/admin/stock', async (req, res) => {
    const { id, precio, stock, password } = req.body;

    if (password !== CLAVE_ADMIN) {
        return res.status(401).json({ error: "Clave de administración incorrecta" });
    }

    try {
        const query = 'UPDATE cervezas SET precio = $1, stock = $2 WHERE id = $3 RETURNING *';
        const values = [parseInt(precio), parseInt(stock), id];
        const result = await pool.query(query, values);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Variedad no encontrada" });
        }

        res.json({ message: "Stock actualizado correctamente", data: result.rows[0] });
    } catch (err) {
        console.error("Error al actualizar stock:", err);
        res.status(500).json({ error: "Error al procesar la actualización" });
    }
});

// Iniciar Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Kolchawwe operativo en puerto ${PORT}`);
});