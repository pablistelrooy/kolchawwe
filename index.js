const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

const app = express();

// Configuración de CORS estricta y funcional
app.use(cors());
app.use(express.json());
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

// --- RUTA WEBHOOK (Stock) ---
app.post("/webhook", async (req, res) => {
    const payment = req.query;
    if (payment.topic === "payment" && payment.id) {
        try {
            const paymentApi = new Payment(client);
            const paymentData = await paymentApi.get({ id: payment.id });
            if (paymentData.status === 'approved') {
                for (const item of paymentData.additional_info.items) {
                    await pool.query("UPDATE cervezas SET stock = stock - $1 WHERE id = $2", [item.quantity, item.id]);
                }
            }
        } catch (err) { console.error("Error Webhook:", err); }
    }
    res.status(200).send("OK");
});

// --- RUTA PREFERENCIA ---
app.post("/api/crear-preferencia", async (req, res) => {
    try {
        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                items: req.body.items.map(i => ({
                    id: String(i.id),
                    title: i.nombre,
                    unit_price: Number(i.precio),
                    quantity: Number(i.quantity),
                    currency_id: "CLP"
                })),
                auto_return: "approved"
            }
        });
        res.json({ id: result.id, init_point: result.init_point });
    } catch (error) {
        res.status(500).json({ error: "Error en Mercado Pago" });
    }
});

// --- RUTAS ADMIN ---
app.get("/api/cervezas", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM cervezas ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Error BD" }); }
});

app.put("/api/admin/stock", async (req, res) => {
    const { id, precio, stock, password } = req.body;
    if (password !== CLAVE_ADMIN) return res.status(401).json({ error: "Clave errónea" });
    try {
        await pool.query("UPDATE cervezas SET precio = $1, stock = $2 WHERE id = $3", [precio, stock, id]);
        res.json({ message: "OK" });
    } catch (err) { res.status(500).json({ error: "Error BD" }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));