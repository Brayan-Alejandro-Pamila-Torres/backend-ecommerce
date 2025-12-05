const SalesModel = require('../model/SalesModel');

// 1) EXISTENTE
const getProductsByCategory = async (req, res) => {
    try {
        const rows = await SalesModel.getProductsByCategory();

        const labels = rows.map(row => 
            row.categoria == 1 ? "Hombre" :
            row.categoria == 2 ? "Mujer" :
            "Niños"
        );

        const values = rows.map(row => row.ventas_totales);

        res.json({ labels, values });

    } catch (error) {
        res.status(500).json({ mensaje: "Error" });
    }
};

// 2) TOTAL DE VENTAS
const getTotalSales = async (req, res) => {
    try {
        const { total } = await SalesModel.getTotalSales();
        res.json({ total });
    } catch (error) {
        res.status(500).json({ mensaje: "Error" });
    }
};

// 3) EXISTENCIAS POR PRODUCTO
const getStockByProduct = async (req, res) => {
    try {
        const rows = await SalesModel.getStockByProduct();

        const labels = rows.map(r => r.nombre);
        const values = rows.map(r => r.stock);

        res.json({
            labels,
            values
        });

    } catch (error) {
        console.error("Error stock:", error);
        res.status(500).json({ mensaje: "Error al obtener stock" });
    }
};


module.exports = {
    getProductsByCategory,
    getTotalSales,
    getStockByProduct
};
