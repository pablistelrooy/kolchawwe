const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { MercadoPagoConfig, Preference } = require("mercadopago");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const client = new MercadoPagoConfig({ 
    accessToken: "APP_USR-1855947821734593-050622-9f50f98fcb9e1820fe4cbaf438ae35af-3385175304" 
});

const CLAVE_ADMIN = "1234";

// --- RUTA UNIFICADA PARA PREFERENCIA ---
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
        console.error("Error Mercado Pago:", error);
        res.status(500).json({ error: "Error interno de servidor" });
    }
};

// Definimos ambas rutas explícitamente para evitar el error 404
app.post("/api/crear-preferencia", handlerPreferencia);
app.post("/api/create-preference", handlerPreferencia);

// --- OTRAS RUTAS ---
app.get("/api/cervezas", async (req, res) => {
    try {
        const result = await pool.query("SELECT id, nombre, precio, stock FROM cervezas ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Error BD" }); }
});

app.put("/api/admin/stock", async (req, res) => {
    const { id, precio, stock, password } = req.body;
    if (password !== CLAVE_ADMIN) return res.status(401).json({ error: "Clave incorrecta" });
    try {
        await pool.query("UPDATE cervezas SET precio = $1, stock = $2 WHERE id = $3", [precio, stock, id]);
        res.json({ message: "Éxito" });
    } catch (err) { res.status(500).json({ error: "Error BD" }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));