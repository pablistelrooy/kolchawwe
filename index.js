const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { MercadoPagoConfig, Preference } = require("mercadopago");

const app = express();
app.use(express.json());
app.use(cors());

// ESTA LÍNEA ES CRUCIAL: Permite que Render sirva tu index.html y admin.html desde la carpeta /public
app.use(express.static("public"));

// 1. CONFIGURACIÓN DE BASE DE DATOS (POSTGRESQL)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 2. CONFIGURACIÓN DE MERCADO PAGO CON TU TOKEN
const client = new MercadoPagoConfig({ 
    accessToken: "APP_USR-1855947821734593-050622-9f50f98fcb9e1820fe4cbaf438ae35af-3385175304" 
});

const CLAVE_ADMIN = "1234";

// --- RUTAS DE LA TIENDA ---

// Obtener todas las cervezas de la DB
app.get("/api/cervezas", async (req, res) => {
    try {
        const result = await pool.query("SELECT id, nombre, precio, stock FROM cervezas ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) {
        console.error("Error en DB:", err);
        res.status(500).json({ error: "Error al conectar con la base de datos" });
    }
});

// Crear preferencia de Mercado Pago
app.post("/api/create-preference", async (req, res) => {
    try {
        const { items } = req.body; 

        if (!items || items.length === 0) {
            return res.status(400).json({ error: "El carrito está vacío" });
        }

        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                items: items.map(item => ({
                    id: item.id.toString(),
                    title: item.nombre || item.title,
                    unit_price: Number(item.precio || item.unit_price),
                    quantity: Number(item.quantity),
                    currency_id: "CLP"
                })),
                back_urls: {
                    success: "https://tu-sitio.com/success", 
                    failure: "https://tu-sitio.com/failure",
                    pending: "https://tu-sitio.com/pending"
                },
                auto_return: "approved",
            }
        });

        res.json({ id: result.id, init_point: result.init_point });
    } catch (error) {
        console.error("Error Mercado Pago Detail:", error);
        res.status(500).json({ error: "Error con Mercado Pago." });
    }
});

// --- RUTAS DE ADMINISTRACIÓN ---
app.put("/api/admin/stock", async (req, res) => {
    const { id, precio, stock, password } = req.body;

    if (password !== CLAVE_ADMIN) {
        return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    try {
        await pool.query(
            "UPDATE cervezas SET precio = $1, stock = $2 WHERE id = $3",
            [precio, stock, id]
        );
        res.json({ message: "Actualizado correctamente" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al actualizar en la base de datos" });
    }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Kolchawwe activo en puerto ${PORT}`);
});


// --- WEBHOOK PARA RECIBIR NOTIFICACIONES DE PAGO ---
app.post("/webhook", async (req, res) => {
    const payment = req.query;

    if (payment.topic === "payment") {
        try {
            // 1. Obtener detalles del pago desde Mercado Pago
            const paymentData = await new MercadoPagoConfig({ accessToken: "TU_ACCESS_TOKEN" }).payment.get({ id: payment.id });

            if (paymentData.status === 'approved') {
                // 2. Extraer los items y cantidades (esto debe venir en el 'external_reference' o 'metadata')
                const items = paymentData.additional_info.items; 

                // 3. Descontar stock en DB
                for (const item of items) {
                    await pool.query(
                        "UPDATE cervezas SET stock = stock - $1 WHERE id = $2",
                        [item.quantity, item.id]
                    );
                }
            }
        } catch (err) {
            console.error("Error en Webhook:", err);
        }
    }
    res.status(200).send("OK");
});
```

### 2. Modificar la creación de la Preferencia (`index.js`)
Para que el webhook sepa qué descontar, debes pasar el ID del producto y la cantidad dentro de la preferencia de pago.

```javascript
// En tu ruta app.post("/api/crear-preferencia")
const preference = new Preference(client);
const result = await preference.create({
    body: {
        items: req.body.items.map(item => ({
            id: String(item.id), // Asegura que el ID sea string
            title: item.nombre,
            unit_price: Number(item.precio),
            quantity: Number(item.quantity),
            currency_id: "CLP"
        })),
        // Es vital que el back-end reciba el ID real de tu DB
    }
});

