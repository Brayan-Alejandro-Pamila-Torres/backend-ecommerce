// routes/userRoutes.js
const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/authMiddleware');

// GET /api/users/perfil  (ruta protegida)
router.get('/perfil', verifyToken, (req, res) => {
  // req.user viene del token
  res.json({
    ok: true,
    message: 'Accediste a tu perfil con un token válido',
    user: req.user
  });
});

module.exports = router;
