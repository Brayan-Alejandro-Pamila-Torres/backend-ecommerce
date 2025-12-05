// back/model/SalesModel.js
const db = require("../db/conexion"); // tu conexion actual

// Usaremos el modo promise para consultas
const pdb = db.promise();

exports.getProducto = async (id) => {
  const [rows] = await pdb.query("SELECT id, nombre, precio, stock, categoria FROM productos WHERE id = ?", [id]);
  return rows[0];
};

exports.descontarStock = async (id, cantidad) => {
  await pdb.query("UPDATE productos SET stock = stock - ? WHERE id = ?", [cantidad, id]);
};

exports.sumarVentaCategoria = async (categoria, cantidad) => {
  await pdb.query("UPDATE ventas_por_cat SET ventas_totales = ventas_totales + ? WHERE categoria = ?", [cantidad, categoria]);
};

exports.crearVenta = async (venta) => {
    // La consulta SQL debe coincidir exactamente con las columnas de tu imagen
    const sql = `
        INSERT INTO ventas 
        (nombre, direccion, ciudad, cp, telefono, pais, metodo_pago, subtotal, descuento, impuestos, envio, total_final, fecha) 
        VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    
    // El orden del array debe coincidir con el orden de los signos de interrogación (?) de arriba
    const [result] = await pdb.query(sql, [
        venta.nombre, 
        venta.direccion, 
        venta.ciudad, 
        venta.cp, 
        venta.telefono,
        venta.pais,
        venta.metodo_pago,
        venta.subtotal,
        venta.descuento,
        venta.impuestos,
        venta.envio,
        venta.total_final 
    ]);
    
    return result.insertId;
};
//funcion GETVENTA
exports.getVenta = async (id) => {
    // Usamos 'total_final AS total' para que en el controlador puedas usar venta.total
    const sql = `
        SELECT 
            id, 
            nombre, 
            direccion, 
            ciudad, 
            cp, 
            telefono, 
            pais,
            metodo_pago, 
            subtotal, 
            descuento, 
            impuestos, 
            envio, 
            total_final AS total,  
            fecha 
        FROM ventas 
        WHERE id = ?
    `;
    
    const [rows] = await pdb.query(sql, [id]);
    return rows[0];
};
exports.getUserByCorreo = async (correo) => {
  const [rows] = await pdb.query(
    "SELECT id, nombre, correo, suscrito FROM usuarios WHERE correo = ?",
    [correo]
  );
  return rows[0];
};
exports.suscribirUsuarioPorCorreo = async (correo) => {
  await pdb.query("UPDATE usuarios SET suscrito = 1 WHERE correo = ?", [correo]);
};