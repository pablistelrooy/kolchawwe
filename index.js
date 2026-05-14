const express = require('express');
const cors = require('cors');
const pool = require('./db'); // Tu conector de base de datos
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();

// --- CONFIGURACIÓN DE MERCADO PAGO ---
// Reemplaza con tu Access Token real de Mercado Pago
const client = new MercadoPagoConfig({ 
    accessToken: 'TU_ACCESS_TOKEN_AQUI' 
});

app.use(express.json());
app.use(cors()); // Permite peticiones desde tu tienda index.html
app.use(express.static('public'));

// RUTA 1: Obtener cervezas (La tienda usa esto para el catálogo)
app.get('/api/cervezas', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cervezas ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error("Error DB:", err);
        res.status(500).json({ error: "Error al consultar la bodega" });
    }
});

// RUTA 2: Crear preferencia de Mercado Pago (ESTA ES LA QUE FALTA)
app.post('/api/create-preference', async (req, res) => {
    try {
        const { items } = req.body; // El carro que viene desde index.html

        // Formatear los productos para Mercado Pago
        const itemsToPay = items.map(product => ({
            id: product.id.toString(),
            title: product.nombre,
            unit_price: Number(product.precio),
            quantity: Number(product.quantity),
            currency_id: 'CLP'
        }));

        const preference = new Preference(client);
        
        const response = await preference.create({
            body: {
                items: itemsToPay,
                back_urls: {
                    success: "https://tu-repositorio.github.io/success", // Cambia por tu URL
                    failure: "https://tu-repositorio.github.io/failure",
                    pending: "https://tu-repositorio.github.io/pending"
                },
                auto_return: "approved",
            }
        });

        // Enviamos el link de pago (init_point) a la tienda
        res.json({ init_point: response.init_point });

    } catch (error) {
        console.error("Error MP:", error);
        res.status(500).json({ error: "No se pudo crear la preferencia de pago" });
    }
});

// RUTA 3: Admin - Actualizar stock
app.put('/api/admin/stock', async (req, res) => {
    const { id, precio, stock, password } = req.body;

    if (password !== "1234") {
        return res.status(403).json({ error: "Clave incorrecta" });
    }

    try {
        await pool.query(
            'UPDATE cervezas SET precio = $1, stock = $2 WHERE id = $3',
            [precio, stock, id]
        );
        res.json({ message: "Stock actualizado correctamente" });
    } catch (err) {
        res.status(500).json({ error: "Error al actualizar la base de datos" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Kolchawwe corriendo en puerto ${PORT}`);
});