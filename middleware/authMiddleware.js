// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'clave_por_defecto';

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization']; // "Bearer <token>"

  if (!authHeader) {
    return res.status(401).json({
      ok: false,
      message: 'No se proporcionó token (header Authorization faltante).'
    });
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      ok: false,
      message: 'Formato inválido. Usa: Bearer <token>.'
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // guardamos usuario en req.user
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Error verificando token:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        ok: false,
        message: 'Token expirado'
      });
    }

    return res.status(401).json({
      ok: false,
      message: 'Token inválido'
    });
  }
};
