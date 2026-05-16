const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();

// --- CONFIGURACIÓN DE MERCADO PAGO ---
// REEMPLAZA CON TU ACCESS TOKEN REAL DE MERCADO PAGO CHILE
const client = new MercadoPagoConfig({ 
    accessToken: 'TU_ACCESS_TOKEN_AQUI' 
});

app.use(express.json());
app.use(cors()); 
app.use(express.static('public'));

/**
 * RUTA: Obtener catálogo de cervezas
 */
app.get('/api/cervezas', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cervezas ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error("Error DB:", err);
        res.status(500).json({ error: "Error al consultar la bodega" });
    }
});

/**
 * RUTA: Crear preferencia de Mercado Pago
 */
app.post('/api/create-preference', async (req, res) => {
    try {
        const data = req.body;
        let itemsToPay = [];

        // Normalizamos la entrada si viene un carrito (items) o un solo producto
        const rawItems = data.items && Array.isArray(data.items) ? data.items : [data];

        itemsToPay = rawItems.map(item => {
            if (!item.precio && !item.unit_price) return null;
            return {
                id: String(item.id),
                title: String(item.nombre || item.title),
                unit_price: Math.round(Number(item.precio || item.unit_price)),
                quantity: parseInt(item.quantity || 1),
                currency_id: 'CLP'
            };
        }).filter(item => item !== null);

        if (itemsToPay.length === 0) {
            return res.status(400).json({ error: "No hay productos válidos para pagar" });
        }

        const preference = new Preference(client);
        
        const response = await preference.create({
            body: {
                items: itemsToPay,
                back_urls: {
                    success: "https://kolchawwe.github.io/success", 
                    failure: "https://kolchawwe.github.io/failure",
                    pending: "https://kolchawwe.github.io/pending"
                },
                auto_return: "approved",
                statement_descriptor: "KOLCHAWWE",
            }
        });

        res.json({ init_point: response.init_point });

    } catch (error) {
        console.error("Error Mercado Pago:", error);
        res.status(500).json({ 
            error: "No se pudo crear la preferencia de pago",
            details: error.message 
        });
    }
});

/**
 * RUTA: Administración de Stock
 */
app.put('/api/admin/stock', async (req, res) => {
    const { id, precio, stock, nuevo_stock, password } = req.body;

    if (password !== "1234") {
        return res.status(403).json({ error: "Clave incorrecta" });
    }

    try {
        const cantidadFinal = stock !== undefined ? stock : nuevo_stock;
        
        if (precio !== undefined) {
            await pool.query(
                'UPDATE cervezas SET precio = $1, stock = $2 WHERE id = $3',
                [Math.round(precio), cantidadFinal, id]
            );
        } else {
            await pool.query(
                'UPDATE cervezas SET stock = $1 WHERE id = $2',
                [cantidadFinal, id]
            );
        }
        
        res.json({ message: "Inventario actualizado" });
    } catch (err) {
        console.error("Error al actualizar:", err);
        res.status(500).json({ error: "Error en base de datos" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Kolchawwe activo en puerto ${PORT}`);
});