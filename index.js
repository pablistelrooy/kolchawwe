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
                    success: "https://kolchawwe-web.onrender.com//success", 
                    failure: "https://kolchawwe-web.onrender.com//failure",
                    pending: "https://kolchawwe-web.onrender.com//pending"
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

app.post("/api/checkout", async (req, res) => {
    try {
        const items = req.body.items;
        
        // Validamos que los items existan
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: "Datos de productos inválidos" });
        }

        const preference = new Preference(client);
        
        const result = await preference.create({
            body: {
                items: items.map(item => ({
                    title: item.nombre || "Producto",
                    unit_price: Number(item.precio || item.unit_price || 0),
                    quantity: Number(item.quantity || 1),
                    currency_id: "CLP"
                })),
                back_urls: {
                    success: "https://kolchawwe-web.onrender.com//", 
                    failure: "https://kolchawwe-web.onrender.com//",
                    pending: "https://kolchawwe-web.onrender.com//"
                },
                auto_return: "approved",
            }
        });

        res.json({ id: result.id, init_point: result.init_point });
    } catch (error) {
        console.error("Error en Mercado Pago:", error);
        res.status(500).json({ error: "Error al procesar el pago" });
    }
});
