const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');
// Importamos el SDK oficial de Mercado Pago
const mercadopago = require('mercadopago');

const app = express();

// Configuración de Middlewares
app.use(cors());
app.use(express.json());

// CONFIGURACIÓN DE MERCADO PAGO
// En el panel de Render, debes añadir la variable de entorno MP_ACCESS_TOKEN
mercadopago.configure({
    access_token: process.env.MP_ACCESS_TOKEN || 'APP_USR-tu-access-token-aqui'
});

// IMPORTANTE: Servir archivos estáticos desde la carpeta 'public'
// Esto permite que el navegador encuentre index.html y admin.html automáticamente
app.use(express.static(path.join(__dirname, 'public')));

// --- RUTAS DE LA API ---

// 1. OBTENER TODAS LAS CERVEZAS (Para la tienda y el panel admin)
app.get('/api/cervezas', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre, precio, stock FROM cervezas ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error("Error al consultar DB:", err);
        res.status(500).json({ error: 'Error al conectar con la base de datos' });
    }
});

// 2. CREAR PREFERENCIA DE PAGO (Pasarela de Mercado Pago)
// Esta es la ruta que soluciona el error 404 al presionar "Comprar Ahora"
app.post('/api/create-preference', async (req, res) => {
    try {
        const { title, unit_price, quantity } = req.body;

        const preference = {
            items: [
                {
                    title: title,
                    unit_price: Number(unit_price),
                    quantity: Number(quantity),
                    currency_id: 'CLP' // Moneda: Pesos Chilenos
                }
            ],
            back_urls: {
                success: "https://kolchawwe-web.onrender.com",
                failure: "https://kolchawwe-web.onrender.com",
                pending: "https://kolchawwe-web.onrender.com"
            },
            auto_return: "approved",
        };

        const response = await mercadopago.preferences.create(preference);
        
        // Retornamos el link de pago generado por Mercado Pago
        res.json({
            id: response.body.id,
            init_point: response.body.init_point
        });
    } catch (error) {
        console.error("Error en Mercado Pago:", error);
        res.status(500).json({ error: "No se pudo generar el enlace de pago" });
    }
});

// 3. ACTUALIZAR STOCK Y PRECIO (Panel de Administración)
app.put('/api/admin/stock', async (req, res) => {
    const { id, precio, stock, password } = req.body;
    const CLAVE_FIJA = "1234"; // Tu clave de acceso maestro

    // Validación de seguridad
    if (String(password).trim() !== CLAVE_FIJA) {
        return res.status(401).json({ error: 'Clave de administrador incorrecta' });
    }

    try {
        await pool.query(
            'UPDATE cervezas SET precio = $1, stock = $2 WHERE id = $3',
            [precio, stock, id]
        );
        res.json({ mensaje: '¡Datos actualizados con éxito!' });
    } catch (err) {
        console.error("Error al actualizar stock:", err);
        res.status(500).json({ error: 'Error al actualizar la base de datos' });
    }
});

// Redirección para cualquier otra ruta: Volver a la tienda principal
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Puerto dinámico para Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de Kolchawwe activo en puerto ${PORT}`);
});