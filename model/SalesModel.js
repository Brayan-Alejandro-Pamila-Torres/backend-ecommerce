const db = require('../db/conexion');

const SalesModel = {

    // Gráfica 1: Ventas por categoría (ya la tienes)
    getProductsByCategory: () => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT categoria, ventas_totales FROM ventas_por_cat`;
            db.query(sql, (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
    },

    // Gráfica 2: Total de ventas
    getTotalSales: () => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT SUM(ventas_totales) AS total FROM ventas_por_cat`;
            db.query(sql, (err, results) => {
                if (err) return reject(err);
                resolve(results[0]);
            });
        });
    },

    // Gráfica 3: Existencias por producto
    getStockByProduct: () => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT nombre, stock
                FROM productos
                ORDER BY nombre ASC
            `;
            db.query(sql, (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
    }
};

module.exports = SalesModel;
