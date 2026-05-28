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
    accessToken: "APP_USR-6243179757932439-051819-fbc10886bcfae80699d1d0862fe16b3c-3409594471" 
});

const CLAVE_ADMIN = "1234";

// --- HANDLER PREFERENCIA ---
const handlerPreferencia = async (req, res) => {
    try {
        const items = req.body.items;
        // Validación previa de stock
        for (const item of items) {
            // Solo validamos stock si el ID no es SHIPPING_FEE
            if (item.id !== "SHIPPING_FEE") {
                const result = await pool.query("SELECT stock FROM cervezas WHERE id = $1", [item.id]);
                if (result.rows.length === 0 || result.rows[0].stock < item.quantity) {
                    return res.status(400).json({ error: `Stock insuficiente para ${item.title}` });
                }
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
                // Definimos las URLs de retorno requeridas por Mercado Pago
                back_urls: {
                    success: "https://kolchawwe-web.onrender.com/success",
                    failure: "https://kolchawwe-web.onrender.com/failure",
                    pending: "https://kolchawwe-web.onrender.com/pending"
                },
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

// --- WEBHOOK CORREGIDO ---
app.post("/webhook", async (req, res) => {
    const { data, type } = req.body;
    
    if (type === "payment" && data && data.id) {
        try {
            const payment = new Payment(client);
            const paymentData = await payment.get({ id: data.id });

            if (paymentData.status === 'approved') {
                const items = paymentData.additional_info?.items || [];
                
                for (const item of items) {
                    // Ignoramos cargos de envío y validamos que el ID sea numérico
                    const esProductoValido = item.id && item.id !== "SHIPPING_FEE" && !isNaN(item.id);
                    
                    if (esProductoValido) {
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






//   FALTANTE PARA PRUEBA GUARDAR CLIENTE

// --- RUTA PARA REGISTRAR CLIENTE ---
app.post("/api/registrar-cliente", async (req, res) => {
    const { nombre, telefono, rut, direccion } = req.body;
    
    // Validar que los campos no vengan vacíos
    if (!nombre || !rut || !direccion) {
        return res.status(400).json({ error: "Datos incompletos" });
    }

    try {
        await pool.query(
            "INSERT INTO clientes (nombre, telefono, rut, direccion) VALUES ($1, $2, $3, $4)",
            [nombre, telefono, rut, direccion]
        );
        res.json({ success: true, message: "Cliente registrado con éxito" });
    } catch (err) {
        console.error("Error al guardar cliente:", err);
        res.status(500).json({ error: "Error interno al guardar en base de datos" });
    }
});






app.listen(PORT, () => {
    console.log(`Servidor activo en puerto ${PORT}`);
});


app.get('/api/clientes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clientes ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fallo en lectura" });
  }
});
