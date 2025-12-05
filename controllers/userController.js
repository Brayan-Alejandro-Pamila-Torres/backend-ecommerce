/**
 * Controlador de ejemplo para mostrar cómo usar datos del usuario desde el token
 * Este endpoint requiere autenticación (middleware verifyToken)
 */
const getProfile = (req, res) => {
  try {
    // Los datos del usuario están en req.user (agregados por el middleware)
    // Estos datos vienen del payload del token JWT
    const { username, userId } = req.user;

    return res.status(200).json({
      success: true,
      message: 'Perfil del usuario obtenido correctamente Jean Puentes ',
      user: {
        username: username,
        userId: userId
      },
      // Esto muestra que el token fue verificado correctamente
      tokenInfo: {
        message: 'Este endpoint requiere autenticación válida ',
        verified: true
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al obtener el perfil'
    });
  }
};

module.exports = {
  getProfile
};

