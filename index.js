const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/cervezas', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre, stock, precio FROM cervezas ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error("Error en DB:", err);
        res.status(500).json({ error: 'Error de base de datos' });
    }
});

app.put('/api/admin/stock', async (req, res) => {
    const { id, nombre, precio, stock, password } = req.body;
    
    // 1. Obtenemos la clave de Render y limpiamos cualquier espacio invisible
    const rawEnvPass = process.env.ADMIN_PASSWORD || "";
    const correctPassword = rawEnvPass.trim();

    // LOG DE DIAGNÓSTICO (Míralo en la pestaña Logs de Render)
    console.log(`--- Intento de actualización ID ${id} ---`);
    console.log(`¿Variable configurada en Render?: ${correctPassword ? "SÍ" : "NO"}`);
    
    // Validación de seguridad
    if (!correctPassword) {
        return res.status(500).json({ error: 'El servidor no tiene configurada la clave ADMIN_PASSWORD' });
    }

    if (String(password).trim() !== correctPassword) {
        console.warn(`⚠️ Clave incorrecta. Recibida: "${password.trim()}" | Esperada: (longitud ${correctPassword.length})`);
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    try {
        const result = await pool.query(
            'UPDATE cervezas SET nombre = $1, precio = $2, stock = $3 WHERE id = $4 RETURNING *', 
            [nombre, precio, stock, id]
        );
        
        if (result.rowCount === 0) return res.status(404).json({ error: 'No se encontró el ID' });
        
        console.log(`✅ ID ${id} actualizado con éxito.`);
        res.json({ mensaje: 'Actualizado correctamente', producto: result.rows[0] });
    } catch (err) {
        console.error("Error SQL:", err);
        res.status(500).json({ error: 'Error al guardar cambios' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🍺 Kolchawwe activo en puerto ${PORT}`);
});