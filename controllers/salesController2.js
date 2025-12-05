// back/controllers/salesController.js
const SalesModel2 = require("../model/SalesModel2");


const SalesModel = SalesModel2;

const db = require("../db/conexion");
const pdb = db.promise(); // promesas para consultas ad-hoc
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require ('path');
const { Resend } = require("resend");


const resend = new Resend(process.env.RESEND_API_KEY);

// Verificar stock sin modificar BD
exports.verificarStock = async (req, res) => {
  try {
    const { carrito } = req.body;
    if (!Array.isArray(carrito) || carrito.length === 0) return res.json({ ok: false, message: "Carrito vacío" });

    for (const item of carrito) {
      const producto = await SalesModel.getProducto(item.id);
      if (!producto) return res.json({ ok: false, message: `Producto con id ${item.id} no encontrado` });
      if (producto.stock < item.cantidad) {
        return res.json({ ok: false, message: `No hay stock suficiente para ${producto.nombre}. Disponible: ${producto.stock}` });
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
};

// Procesar pago: crear venta, descontar stock, sumar ventas_por_cat
exports.pagar = async (req, res) => {
  try {
  
    const { carrito, metodo, envio, coupon } = req.body;
    if (!Array.isArray(carrito) || carrito.length === 0) return res.json({ ok: false, message: "Carrito vacío" });

    // 1) Verificar stock de nuevo (para evitar que se venda sin stock) y calcular subtotal
    let subtotal = 0;
    for (const item of carrito) {
      const producto = await SalesModel.getProducto(item.id);
      if (!producto) return res.json({ ok: false, message: `Producto con id ${item.id} no encontrado` });
      if (producto.stock < item.cantidad) {
        return res.json({ ok: false, message: `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}` });
      }
      // Use price from DB to avoid client tampering
      subtotal += producto.precio * item.cantidad;
    }

    // Determinar impuesto y envío según país
    const pais = (envio && envio.pais) ? envio.pais : 'Mexico';
    const taxRates = { Mexico: 0.16, USA: 0.08, Spain: 0.21, Other: 0.10 };
    const shippingFees = { Mexico: 100, USA: 400, Spain: 800, Other: 500 };
    const taxRate = taxRates[pais] ?? taxRates['Other'];
    const shipping = shippingFees[pais] ?? shippingFees['Other'];

    // Coupon
    let descuento = 0;
    //dar descuento de 100 pesos
    if(coupon === 'promo2025') descuento = 100;
    if (descuento > subtotal) descuento = subtotal;

    const impuesto = Math.round((subtotal - descuento) * taxRate);
    const total = Math.round(subtotal - descuento + impuesto + shipping);

    // 2) Crear venta resumen (guardamos los datos básicos)
    const ventaId = await SalesModel.crearVenta({
      nombre: envio.nombre,
      direccion: envio.direccion,
      ciudad: envio.ciudad,
      cp: envio.cp,
      telefono: envio.tel,
      pais: pais,
      metodo_pago: metodo,
      subtotal: subtotal,
      descuento: descuento,
      impuestos: impuesto,
      envio: shipping,
      total_final: total
    });

    // 3) Para cada item: descontar stock y sumar ventas_por_cat
    for (const item of carrito) {
      const producto = await SalesModel.getProducto(item.id);
      // descontar stock
      await SalesModel.descontarStock(item.id, item.cantidad);
      // sumar ventas por categoria
      await SalesModel.sumarVentaCategoria(producto.categoria, item.cantidad);
    }

    return res.json({ ok: true, message: "Compra procesada correctamente", ventaId, totals: { subtotal, descuento, impuesto, envio: shipping, total } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Error procesando el pago" });
  }
};
// api para mandar el recibo por correo al cliente


exports.enviarRecibo = async (req, res) => {
  try {
    const { ventaId } = req.body; 

    if (!ventaId) {
      return res.status(400).json({ ok: false, message: "Falta el ID de la venta" });
    }

    const correo = req.user.correo;

    const venta = await SalesModel.getVenta(ventaId);
    if (!venta) {
      return res.status(404).json({ ok: false, message: "Venta no encontrada" });
    }

    // ==========================
    // GENERAR PDF
    // ==========================
    const pdfPath = path.join(__dirname, `recibo_${ventaId}.pdf`);
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(pdfPath);

    doc.pipe(stream);

    const logoPath = path.join(__dirname, "../public/img/logo.jpg");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 45, { width: 60 });
    }

    doc.font('Helvetica-Bold')
      .fontSize(20)
      .text('SNEAKERS CLON 5G', 120, 55);

    doc.font('Helvetica-Oblique')
      .fontSize(10)
      .fillColor('#555555')
      .text('"EL ORIGINAL ERES TÚ"', 120, 80);

    doc.moveTo(50, 110).lineTo(550, 110).strokeColor('#aaaaaa').stroke();

    doc.moveDown(4);
    doc.fillColor('black').font('Helvetica-Bold').fontSize(16)
      .text('RECIBO DE COMPRA', { align: 'center' });
    doc.moveDown();

    doc.font('Helvetica').fontSize(12);

    doc.text(`ID de Venta: #${ventaId}`, { align: 'right' });
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, { align: 'right' });

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Información del Cliente:');
    doc.font('Helvetica').text(`Nombre: ${venta.nombre}`);
    doc.text(`Dirección: ${venta.direccion}`);
    doc.text(`Ciudad: ${venta.ciudad}, CP: ${venta.cp}`);
    doc.text(`Teléfono: ${venta.telefono}`);

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Detalles del Pago:');
    doc.font('Helvetica');
    doc.text(`Método de Pago: ${venta.metodo_pago}`);

    doc.moveDown(2);

    doc.rect(50, doc.y, 500, 30).fill('#f0f0f0');
    doc.fillColor('black');

    doc.font('Helvetica-Bold').fontSize(14)
      .text(`TOTAL PAGADO: $${venta.total} MXN`, 60, doc.y - 22, { align: 'right' });

    doc.moveDown(4);
    doc.fontSize(10).font('Helvetica-Oblique').fillColor('grey')
      .text('Gracias por tu preferencia.', { align: 'center' });

    doc.end();

    // ==========================
    // ENVÍO CON RESEND
    // ==========================
    stream.on("finish", async () => {
      try {
        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdfBase64 = pdfBuffer.toString("base64");

        await resend.emails.send({
          from: "SneakerClon5G <onboarding@resend.dev>",
          to: correo,
          subject: `Recibo de compra #${ventaId}`,
          html: `
            <h2>¡Gracias por tu compra!</h2>
            <p>Hola <b>${venta.nombre}</b>, adjuntamos tu recibo de compra.</p>
            <p><i>"EL ORIGINAL ERES TÚ"</i></p>
            <p>Atte: <b>SNEAKERS CLON 5G</b></p>
          `,
          attachments: [
            {
              filename: `recibo_${ventaId}.pdf`,
              content: pdfBase64,
              encoding: "base64"
            }
          ]
        });

        fs.unlinkSync(pdfPath);

        return res.json({ ok: true, message: "Recibo enviado correctamente al cliente" });

      } catch (err) {
        console.error("Error enviando email:", err);
        return res.status(500).json({ ok: false, message: "Error enviando el email" });
      }
    });

  } catch (err) {
    console.error("Error general en enviarRecibo:", err);
    return res.status(500).json({ ok: false, message: "Error interno procesando recibo" });
  }
};

//api para suscripcion 
exports.suscribir = async (req, res) => {
  try {
    const correo = req.user.correo;

    if (!correo) return res.status(400).json({ ok: false, message: "Usuario no válido" });

    const user = await SalesModel2.getUserByCorreo(correo);

    if (!user) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });

    if (user.suscrito === 1) {
      return res.json({ ok: false, message: "Ya estás suscrito" });
    }

    await SalesModel2.suscribirUsuarioPorCorreo(correo);

    // ==========================
    // LEER LOGO Y CUPÓN EN BASE64
    // ==========================
    const cuponPath = path.join(__dirname, "../public/img/cupon.png");
    const logoPath = path.join(__dirname, "../public/img/logo.jpg");

    const cuponBase64 = fs.readFileSync(cuponPath).toString("base64");
    const logoBase64 = fs.readFileSync(logoPath).toString("base64");


    // ==========================
    // ENVIAR CON RESEND
    // ==========================
    await resend.emails.send({
      from: "SneakerClon5G <onboarding@resend.dev>",
      to: correo,
      subject: "¡Gracias por suscribirte a SNEAKERS CLON 5G!",
      html: `
        <div style="text-align:left;">
          <img src="cid:logoSneakers" style="width:150px;margin-bottom:20px;">
        </div>
        <h2>Hola ${user.nombre} 👋</h2>
        <p>Gracias por suscribirte a <b>Sneakers Clon 5G</b>.</p>
        <p><i>"EL ORIGINAL ERES TÚ"</i></p>
        <p>Aquí tienes tu cupón exclusivo:</p>
        <p><b>🎁 CUPÓN DE DESCUENTO ESPECIAL</b></p>
      `,
      attachments: [
        {
          filename: "cupon.png",
          content: cuponBase64,
          encoding: "base64"
        },
        {
          filename: "logo.jpg",
          content: logoBase64,
          encoding: "base64"
        }
      ]
    });

    return res.json({ ok: true, message: "Suscripción activada correctamente y correo enviado" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Error en el servidor" });
  }
};

