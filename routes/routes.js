//archivo de rutasww
const express = require('express');
const router = express.Router();
const db = require('../db/conexion');
const { Resend } = require('resend');
const path = require('path');
const bcrypt = require('bcryptjs');
const authMiddleware = require("../middleware/authMiddleware");
const salesController2 = require("../controllers/salesController2");
const fs = require("fs");

// Inicializar Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// ========================
// RUTAS DE PRODUCTOS
// ========================

router.get('/productos', (req, res) =>{
    const query = 'SELECT * FROM productos';

    db.query(query, (err, results)=>{
        if(err){
            console.error('Error al obtener los productos', err);
            res.status(500).send('Error en el servidor');
            return;
        }
        res.json(results);
    });
});

// Filtrar productos por categoría
router.get('/productos/categoria/:id', (req, res) => {
    const idCategoria = req.params.id;
    const query = 'SELECT * FROM productos WHERE categoria = ?';

    db.query(query, [idCategoria], (err, results) => {
        if(err){
            console.error('Error al filtrar por categoría:', err);
            res.status(500).send('Error en el servidor');
            return;
        }
        res.json(results);
    });
});

// Agregar producto
router.post("/agregarProducto", (req, res) => {
    const { id, nombre, descripcion, precio, stock, imagen, categoria } = req.body;

    if (!id || !nombre || !descripcion || !precio || !stock || !imagen || !categoria) {
        return res.status(400).json({ message: "Todos los campos son obligatorios" });
    }

    const sql = `
        INSERT INTO productos (id, nombre, descripcion, precio, stock, imagen, categoria)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [id, nombre, descripcion, precio, stock, imagen, categoria],
        (err, result) => {
            if (err) {
                console.error("Error al agregar el producto:", err);

                if (err.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({ message: "El ID ya existe, usa otro" });
                }
                return res.status(500).json({ message: "Error del servidor" });
            }

            return res.json({
                message: "Producto agregado correctamente",
                result
            });
        }
    );
});

// Eliminar producto
router.delete('/eliminarProducto/:id', (req, res) => {
    const { id } = req.params;

    const sql = 'DELETE FROM productos WHERE id = ?';

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error("Error al eliminar el producto:", err);
            return res.status(500).json({ message: "Error del servidor al eliminar" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Producto no encontrado" });
        }

        res.json({ message: "Producto eliminado correctamente" });
    });
});

// Modificar producto
router.put('/modificarProducto/:id', (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, precio, stock, imagen, categoria } = req.body;

    if (!nombre || !descripcion || !precio || !stock || !imagen || !categoria) {
        return res.status(400).json({ message: "Todos los campos son obligatorios para modificar" });
    }

    const sql = `
        UPDATE productos 
        SET nombre = ?, descripcion = ?, precio = ?, stock = ?, imagen = ?, categoria = ?
        WHERE id = ?
    `;

    db.query(sql,[nombre, descripcion, precio, stock, imagen, categoria, id],
        (err, result) => {
            if (err) {
                console.error("Error al modificar el producto:", err);
                return res.status(500).json({ message: "Error del servidor al modificar" });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Producto no encontrado (revisa el ID)" });
            }

            res.json({ message: "Producto modificado correctamente" });
        }
    );
});

// ========================
// REGISTRO USUARIO 
// ========================

router.post('/registrarUsuario', async (req, res) => {
    const { nombre, correo, id, password } = req.body;

    if (!nombre || !correo || !id || !password) {
        return res.status(400).json({ message: "Todos los campos son obligatorios" });
    }

    const sql = `
        INSERT INTO usuarios (nombre, correo, id, password, rol) 
        VALUES (?, ?, ?, ?, 'cliente')
    `;

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    db.query(sql,[nombre, correo, id, hashedPassword], async (err, result) => {

        if (err) {
            console.error("Error al registrar el usuario:", err);

            if (err.code === "ER_DUP_ENTRY") {
                return res.status(409).json({ message: "El ID ya existe, usa otro" });
            }
            return res.status(500).json({ message: "Error del servidor" });
        }

        // LOGO BASE64
        const logoPath = path.join(__dirname, "../public/img/logo.jpg");
        const logoBase64 = fs.readFileSync(logoPath).toString("base64");

        // ENVÍO DE CORREO
        try {
            await resend.emails.send({
                from: "SneakerClon5G <onboarding@resend.dev>",
                to: correo,
                subject: "¡Bienvenido a SNEAKERCLON5G!",
                html: `
                    <div style="text-align:left;">
                        <img src="cid:logoSneakers" style="width:150px; margin-bottom:20px;" />
                    </div>
                    <h2>Hola ${nombre} 👋</h2>
                    <p>Gracias por registrarte a <b>SNEAKERCLON5G</b>.</p>
                    <p><b>EL ORIGINAL ERES TÚ</b></p>
                    <p>¡Gracias por unirte!</p>
                `,
                attachments: [
                    {
                        filename: "logo.jpg",
                        content: logoBase64,
                        cid: "logoSneakers"
                    }
                ]
            });

        } catch (mailErr) {
            console.error("Error al enviar correo con Resend:", mailErr);
        }

        return res.json({
            message: "Usuario registrado correctamente y correo enviado",
            result
        });
    });
});

// =========================================================
// RESPONDER COMENTARIO — MIGRADO A RESEND
// =========================================================

router.post('/responderComentario', async (req, res) => {
    const { correo, respuesta } = req.body;

    if (!correo || !respuesta) {
        return res.status(400).json({ message: "El correo y la respuesta son obligatorios" });
    }

    const logoPath = path.join(__dirname, "../public/img/logo.jpg");
    const logoBase64 = fs.readFileSync(logoPath).toString("base64");

    try {
        await resend.emails.send({
            from: "SneakerClon5G <onboarding@resend.dev>",
            to: correo,
            subject: "Respuesta a tu comentario - SNEAKERS CLON 5G",
            html: `
                <div style="text-align:left;">
                    <img src="cid:logoSneakers" style="width:150px; margin-bottom:20px;" />
                </div>
                <h2>Hola 👋</h2>
                <p>Gracias por ponerte en contacto con <b>Sneakers Clon 5G</b>.</p>
                <p>¡EL ORIGINAL ERES TÚ!</p>
                <h3>Tu respuesta:</h3>
                <blockquote style="border-left:3px solid #4CAF50; padding-left:10px; color:#333;">
                    <p>en breve serás atendido. Gracias por ponerte en contacto</p>
                </blockquote>
            `,
            attachments: [
                {
                    filename: "logo.jpg",
                    content: logoBase64,
                    cid: "logoSneakers"
                }
            ]
        });

        return res.json({ message: "Respuesta enviada correctamente" });
    } catch (mailErr) {
        console.error("Error al enviar correo:", mailErr);
        return res.status(500).json({ message: "Error al enviar la respuesta" });
    }
});

// =========================================================
// RECUPERAR CONTRASEÑA — MIGRADO A RESEND
// =========================================================

router.get('/verificarCorreo/:correo', async (req, res) => {
    const correo = req.params.correo;
    const sql = 'SELECT * FROM usuarios WHERE correo = ?';

    db.query(sql, [correo], async (err, results) => {
        if (err) {
            console.error('Error al verificar el correo:', err);
            return res.status(500).json({ message: 'Error del servidor' });
        }

        if (results.length === 0) {
            return res.json({ exists: false });
        }

        const codigo = Math.floor(100000 + Math.random() * 900000);

        const sqlUpdate = "UPDATE usuarios SET codigo = ? WHERE correo = ?";
        db.query(sqlUpdate, [codigo, correo], async (updateErr) => {
            if (updateErr) {
                console.error("Error al guardar el código:", updateErr);
                return res.status(500).json({ message: "Error al guardar el código" });
            }
        });

        const logoPath = path.join(__dirname, "../public/img/logo.jpg");
        const logoBase64 = fs.readFileSync(logoPath).toString("base64");

        try {
            await resend.emails.send({
                from: "SneakerClon5G <onboarding@resend.dev>",
                to: correo,
                subject: "Código de recuperación - SNEAKERS CLON 5G",
                html: `
                    <div style="text-align:left;">
                        <img src="cid:logoSneakers" style="width:150px; margin-bottom:20px;" />
                    </div>
                    <h2>Recuperación de acceso</h2>
                    <p>Tu código de verificación es:</p>
                    <h1 style="color:#4CAF50; letter-spacing:5px;">${codigo}</h1>
                    <p>Ingresa este código en la página de verificación.</p>
                `,
                attachments: [
                    {
                        filename: "logo.jpg",
                        content: logoBase64,
                        cid: "logoSneakers"
                    }
                ]
            });

            return res.json({ exists: true, codigo });

        } catch (mailErr) {
            console.error("Error al enviar código:", mailErr);
            return res.status(500).json({ message: "Error al enviar el correo" });
        }
    });
});

// =============================
// VERIFICAR CÓDIGO
// =============================

router.post('/verificarCodigo', (req, res) => {
    const {codigo } = req.body;
    const sql = 'SELECT * FROM usuarios WHERE codigo = ?';
    db.query(sql, [codigo], (err, results) => {
        if (err) {
            console.error('Error al verificar el código:', err);
            return res.status(500).json({ message: 'Error del servidor' });
        }
        if (results.length > 0) {
            return res.json({ valid: true });
        } else {
            return res.json({ valid: false });
        }
    });
});

// =============================
// ACTUALIZAR PASSWORD
// =============================

router.put('/actualizarPassword', (req, res) => {
    console.log('✅ Entró a /actualizarPassword');
    const { codigo, newPassword, newPassword2 } = req.body;

    console.log('Datos recibidos del frontend:', { codigo, newPassword, newPassword2 });

    if (newPassword !== newPassword2) {
        return res.status(400).json({ message: 'Las contraseñas no coinciden' });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const sql = 'UPDATE usuarios SET password = ? WHERE codigo = ?';
    db.query(sql, [newPassword, codigo], (err, result) => {
        if (err) {
            console.error('Error al actualizar la contraseña:', err);
            return res.status(500).json({ message: 'Error del servidor' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        return res.json({ message: 'Contraseña actualizada correctamente' });
    });
});

// =============================
// WISHLIST
// =============================

router.get('/wishlist/:userId', (req, res) => {
    const userId = req.params.userId;
    
    const query = `
        SELECT w.id, w.id_producto, w.fecha_agregado,
               p.nombre, p.precio, p.imagen, p.descripcion, p.stock
        FROM wishlist w
        INNER JOIN productos p ON w.id_producto = p.id
        WHERE w.id_usuario = ?
        ORDER BY w.fecha_agregado DESC
    `;
    
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error al obtener wishlist:', err);
            return res.status(500).json({ message: 'Error en el servidor' });
        }
        res.json(results);
    });
});

router.post('/wishlist', (req, res) => {
    const { id_usuario, id_producto } = req.body;
    
    if (!id_usuario || !id_producto) {
        return res.status(400).json({ message: 'Usuario y producto son obligatorios' });
    }
    
    const query = 'INSERT INTO wishlist (id_usuario, id_producto) VALUES (?, ?)';
    
    db.query(query, [id_usuario, id_producto], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: 'El producto ya está en favoritos' });
            }
            console.error('Error al agregar a wishlist:', err);
            return res.status(500).json({ message: 'Error en el servidor' });
        }
        res.status(201).json({ 
            message: 'Producto agregado a favoritos',
            id: result.insertId 
        });
    });
});

router.delete('/wishlist/:userId/:productId', (req, res) => {
    const { userId, productId } = req.params;
    
    const query = 'DELETE FROM wishlist WHERE id_usuario = ? AND id_producto = ?';
    
    db.query(query, [userId, productId], (err, result) => {
        if (err) {
            console.error('Error al eliminar de wishlist:', err);
            return res.status(500).json({ message: 'Error en el servidor' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Producto no encontrado en favoritos' });
        }
        
        res.json({ message: 'Producto eliminado de favoritos' });
    });
});

router.get('/wishlist/:userId/count', (req, res) => {
    const userId = req.params.userId;
    
    const query = 'SELECT COUNT(*) as total FROM wishlist WHERE id_usuario = ?';
    
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error al contar wishlist:', err);
            return res.status(500).json({ message: 'Error en el servidor' });
        }
        res.json({ count: results[0].total });
    });
});

module.exports = router;
