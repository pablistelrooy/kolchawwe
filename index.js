const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');
// Importamos el SDK v2 de Mercado Pago que ya teníamos configurado
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();

app.use(cors());
app.use(express.json());

// CONFIGURACIÓN DE MERCADO PAGO
// Usamos el cliente v2 con tu variable 'MP_ACCESS_TOKEN' de Render
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN || '' 
});

// IMPORTANTE: Servir archivos estáticos de la carpeta public
app.use(express.static(path.join(__dirname, 'public')));

// --- RUTAS DE LA API ---

// 1. OBTENER LAS CERVEZAS (Tienda y Admin)
app.get('/api/cervezas', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre, precio, stock FROM cervezas ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error("Error en DB:", err);
        res.status(500).json({ error: 'Error de conexión a base de datos' });
    }
});

// 2. CREAR PREFERENCIA DE PAGO (Aquí estaba el error 404)
app.post('/api/create-preference', async (req, res) => {
    try {
        const { title, unit_price, quantity } = req.body;

        // Validación de seguridad por si falla la variable de entorno
        if (!process.env.MP_ACCESS_TOKEN) {
            console.error("ERROR: Variable MP_ACCESS_TOKEN no encontrada en Render");
            return res.status(500).json({ error: "Configuración de pagos incompleta" });
        }

        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                items: [
                    {
                        title: title,
                        unit_price: Number(unit_price),
                        quantity: Number(quantity),
                        currency_id: 'CLP'
                    }
                ],
                back_urls: {
                    success: "https://kolchawwe-web.onrender.com",
                    failure: "https://kolchawwe-web.onrender.com",
                    pending: "https://kolchawwe-web.onrender.com"
                },
                auto_return: "approved",
            }
        });

        // Enviamos el ID y el link de pago al frontend
        res.json({
            id: result.id,
            init_point: result.init_point
        });
    } catch (error) {
        console.error("Error Mercado Pago:", error);
        res.status(500).json({ error: "No se pudo generar el enlace de pago" });
    }
});

// 3. ACTUALIZAR STOCK Y PRECIO (ADMIN)
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
        console.error("Error al actualizar:", err);
        res.status(500).json({ error: 'Error al actualizar en la base de datos' });
    }
});

// Redirección por defecto a la tienda
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🍺 Servidor de Kolchawwe activo en puerto ${PORT}`);
});