const express = require("express");
const router = express.Router();

const {
    getProductsByCategory,
    getTotalSales,
    getStockByProduct
} = require("../controllers/salesController");

router.get("/products-by-category", getProductsByCategory);
router.get("/total-sales", getTotalSales);
router.get("/stock-by-product", getStockByProduct);

module.exports = router;
