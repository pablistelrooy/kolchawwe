const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

const app = express();
app.use(express.json());
app.use(cors());

// Servir archivos estáticos desde la carpeta public
app.use(express.static("public"));

// Configuración de Base de Datos
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Configuración de Mercado Pago
const client = new MercadoPagoConfig({ 
    accessToken: "APP_USR-1855947821734593-050622-9f50f98fcb9e1820fe4cbaf438ae35af-3385175304" 
});

const CLAVE_ADMIN = "1234";

// --- RUTA DEL WEBHOOK (Para descontar stock automáticamente) ---
app.post("/webhook", async (req, res) => {
    const payment = req.query;

    if (payment.topic === "payment" && payment.id) {
        try {
            const paymentApi = new Payment(client);
            const paymentData = await paymentApi.get({ id: payment.id });

            if (paymentData.status === 'approved') {
                const items = paymentData.additional_info.items; 

                for (const item of items) {
                    // Descontar stock basado en el ID que enviaste en la preferencia
                    await pool.query(
                        "UPDATE cervezas SET stock = stock - $1 WHERE id = $2",
                        [item.quantity, item.id]
                    );
                }
                console.log(`Stock actualizado vía Webhook para Pago: ${payment.id}`);
            }
        } catch (err) {
            console.error("Error en Webhook:", err);
            return res.status(500).send("Error interno");
        }
    }
    res.status(200).send("OK");
});

// --- RUTA PARA CREAR PREFERENCIA ---
app.post("/api/crear-preferencia", async (req, res) => {
    try {
        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                items: req.body.items.map(item => ({
                    id: String(item.id),
                    title: item.nombre,
                    unit_price: Number(item.precio),
                    quantity: Number(item.quantity),
                    currency_id: "CLP"
                })),
                auto_return: "approved"
            }
        });
        res.json({ id: result.id, init_point: result.init_point });
    } catch (error) {
        console.error("Error creando preferencia:", error);
        res.status(500).json({ error: "No se pudo crear la orden." });
    }
});

// --- RUTAS DE ADMINISTRACIÓN ---
app.get("/api/cervezas", async (req, res) => {
    try {
        const result = await pool.query("SELECT id, nombre, precio, stock FROM cervezas ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Error al obtener cervezas" });
    }
});

app.put("/api/admin/stock", async (req, res) => {
    const { id, precio, stock, password } = req.body;
    if (password !== CLAVE_ADMIN) return res.status(401).json({ error: "Contraseña incorrecta" });

    try {
        await pool.query("UPDATE cervezas SET precio = $1, stock = $2 WHERE id = $3", [precio, stock, id]);
        res.json({ message: "Éxito" });
    } catch (err) {
        res.status(500).json({ error: "Error en base de datos" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));