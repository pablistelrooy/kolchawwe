const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

const app = express();
app.use(cors());
app.use(express.json());

// Configuración de Base de Datos
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Configuración Mercado Pago
const client = new MercadoPagoConfig({ 
    accessToken: "APP_USR-1855947821734593-050622-9f50f98fcb9e1820fe4cbaf438ae35af-3385175304" 
});

const CLAVE_ADMIN = "1234";

// --- HANDLER PREFERENCIA ---
const handlerPreferencia = async (req, res) => {
    try {
        const items = req.body.items;
        // Validación previa de stock antes de ir a Mercado Pago
        for (const item of items) {
            const result = await pool.query("SELECT stock FROM cervezas WHERE id = $1", [item.id]);
            if (result.rows.length === 0 || result.rows[0].stock < item.quantity) {
                return res.status(400).json({ error: `Stock insuficiente para ${item.title}` });
            }
        }

        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                items: items.map(item => ({
                    id: String(item.id),
                    title: item.title,
                    unit_price: Number(item.unit_price),
                    quantity: Number(item.quantity),
                    currency_id: "CLP"
                })),
                auto_return: "approved"
            }
        });
        res.json({ id: result.id, init_point: result.init_point });
    } catch (error) {
        console.error("Error al crear preferencia MP:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};

app.post("/api/crear-preferencia", handlerPreferencia);
app.post("/api/create-preference", handlerPreferencia);

// --- WEBHOOK: ESCUCHA PAGOS EXITOSOS Y DESCUENTA STOCK ---
app.post("/webhook", async (req, res) => {
    const { data, type } = req.body;
    
    // Mercado Pago envía eventos tipo 'payment'
    if (type === "payment" && data && data.id) {
        try {
            const payment = new Payment(client);
            const paymentData = await payment.get({ id: data.id });

            // Solo descontamos si el pago fue aprobado
            if (paymentData.status === 'approved') {
                const items = paymentData.additional_info.items;
                
                for (const item of items) {
                    // El ID de SHIPPING_FEE es interno de MP, lo ignoramos para stock
                    if (item.id !== "SHIPPING_FEE") {
                        await pool.query(
                            "UPDATE cervezas SET stock = stock - $1 WHERE id = $2", 
                            [item.quantity, item.id]
                        );
                        console.log(`Stock descontado: ${item.quantity} unidades del ID ${item.id}`);
                    }
                }
            }
        } catch (error) {
            console.error("Error al procesar el webhook:", error);
        }
    }
    // Responder 200 rápido es obligatorio para Mercado Pago
    res.sendStatus(200);
});

// --- OTRAS RUTAS ---
app.get("/api/cervezas", async (req, res) => {
    try {
        const result = await pool.query("SELECT id, nombre, precio, stock FROM cervezas ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Error en base de datos" }); }
});

app.put("/api/admin/stock", async (req, res) => {
    const { id, precio, stock, password } = req.body;
    if (password !== CLAVE_ADMIN) return res.status(401).json({ error: "Clave incorrecta" });
    try {
        await pool.query("UPDATE cervezas SET precio = $1, stock = $2 WHERE id = $3", [precio, stock, id]);
        res.json({ message: "Stock actualizado correctamente" });
    } catch (err) { res.status(500).json({ error: "Error al actualizar DB" }); }
});

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de Kolchawwe activo en puerto ${PORT}`);
});