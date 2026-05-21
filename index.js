const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { MercadoPagoConfig, Preference } = require("mercadopago");

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

// --- HANDLER PREFERENCIA (Unificado) ---
const handlerPreferencia = async (req, res) => {
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
        console.error("Error MP:", error);
        res.status(500).json({ error: "Error en servidor" });
    }
};

// Rutas explícitas
app.post("/api/crear-preferencia", handlerPreferencia);
app.post("/api/create-preference", handlerPreferencia);

app.get("/api/cervezas", async (req, res) => {
    try {
        const result = await pool.query("SELECT id, nombre, precio, stock FROM cervezas ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "BD Error" }); }
});

app.put("/api/admin/stock", async (req, res) => {
    const { id, precio, stock, password } = req.body;
    if (password !== CLAVE_ADMIN) return res.status(401).json({ error: "Clave errónea" });
    try {
        await pool.query("UPDATE cervezas SET precio = $1, stock = $2 WHERE id = $3", [precio, stock, id]);
        res.json({ message: "OK" });
    } catch (err) { res.status(500).json({ error: "BD Error" }); }
});

// Servir archivos estáticos AL FINAL
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor activo en puerto ${PORT}`);
    console.log("Rutas montadas: /api/cervezas, /api/crear-preferencia, /api/create-preference");
});