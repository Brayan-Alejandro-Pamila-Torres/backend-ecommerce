// back/routes/salesRoutes2.js
const express = require("express");
const router = express.Router();
const salesController2 = require("../controllers/salesController2");
//importar el middileware de autenticacion
const authMiddleware = require("../middleware/authMiddleware");
router.post("/verificar-stock", salesController2.verificarStock);
router.post("/pagar", salesController2.pagar);
//ruta para enviar el recibo por correo
router.post("/enviarRecibo", authMiddleware.verifyToken, salesController2.enviarRecibo);
// 🚀 Nueva ruta para suscribir al usuario
router.post("/suscribir", authMiddleware.verifyToken, salesController2.suscribir);

module.exports = router;
