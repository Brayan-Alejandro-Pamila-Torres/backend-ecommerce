// controllers/authController.js
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const db = require('../db/conexion');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'clave_por_defecto';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '60'; // segundos

// parámetros del sistema de bloqueo
const MAX_ATTEMPTS = 3;     // después de 3 intentos fallidos
const LOCK_MINUTES = 5;     // bloquear 5 minutos

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    
    // -------------------- VALIDAR reCAPTCHA --------------------
    const recaptchaToken =
    req.body.captcha || req.body["g-recaptcha-response"];


    if (!recaptchaToken) {
      return res.status(400).json({
        ok: false,
        message: "Falta el token de reCAPTCHA"
      });
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    if (!secretKey) {
      return res.status(500).json({
        ok: false,
        message: "Falta la clave secreta de reCAPTCHA en el servidor (.env)"
      });
    }

    const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`;

    const googleRes = await fetch(verifyURL, { method: 'POST' });
    const googleData = await googleRes.json();

    if (!googleData.success) {
      return res.status(400).json({
        ok: false,
        message: "Falló la verificación de reCAPTCHA"
      });
    }
    // -------------------- FIN VALIDACIÓN ------------------------


    const { correo, password } = req.body || {};

    if (!correo || !password) {
      return res.status(400).json({
        ok: false,
        message: "Faltan campos 'correo' y 'password'."
      });
    }

    // Buscar usuario en la BD por correo
    const [rows] = await db.promise().query(
      `
        SELECT 
          ID,
          Nombre,
          Correo,
          Rol,
          failed_attempts, locked_until,
          \`Password\` AS Contrasena
        FROM usuarios
        WHERE Correo = ?
        LIMIT 1
      `,
      [correo]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        ok: false,
        message: 'Credenciales inválidas (correo no encontrado).'
      });
    }

    const user = rows[0];
    const now = new Date(); // para los 5 minutos fuera 
    
    //Revisar si la cuenta está bloqueada actualmente
    if (user.locked_until && now < user.locked_until) {
      const msRestantes = user.locked_until - now;
      const minutosRestantes = Math.ceil(msRestantes / 60000);

      return res.status(423).json({
        ok: false,
        message: `Tu cuenta está bloqueada por intentos fallidos. Intenta de nuevo en aproximadamente ${minutosRestantes} minuto(s).`
      });
    }
    //Si la cuenta tenía lock pero ya pasó el tiempo -> resetear contador y lock
    if (user.locked_until && now >= user.locked_until) {
      await db.promise().query( 
        'UPDATE usuarios SET failed_attempts = 0, locked_until = NULL WHERE id = ?',
        [user.ID]
      );
      user.failed_attempts = 0;
      user.locked_until = null;
    }

    // 3. Comparar contraseña usando bcrypt
    // ============================================ Logica de encripatcion de contrasebas 
    const passwordOk = await bcrypt.compare(password, user.Contrasena);
    
    if (!passwordOk) {
      const newAttempts = (user.failed_attempts || 0) + 1; // Incrementar intentos fallidos

      //  Si alcanzó el límite de intentos -> bloqueamos
      if (newAttempts >= MAX_ATTEMPTS) {
        await db.promise().query(
          'UPDATE usuarios SET failed_attempts = ?, locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?',
          [newAttempts, LOCK_MINUTES, user.ID]
        );

        return res.status(423).json({
          ok: false,
          message: `Has alcanzado el máximo de ${MAX_ATTEMPTS} intentos fallidos. Tu cuenta estará bloqueada por ${LOCK_MINUTES} minutos.`
        });
      }

      // Todavía no alcanza el límite -> solo actualizamos el contador
      await db.promise().query(
        'UPDATE usuarios SET failed_attempts = ? WHERE id = ?',
        [newAttempts, user.ID]
      );

      return res.status(401).json({
        ok: false,
        message: `Credenciales inválidas. Intentos fallidos: ${newAttempts}/${MAX_ATTEMPTS}.`
      });
    }

    //  Si la contraseña es correcta:
    //    resetear intentos y lock
    if (user.failed_attempts !== 0 || user.locked_until !== null) {
      await db.promise().query(
        'UPDATE usuarios SET failed_attempts = 0, locked_until = NULL WHERE id = ?',
        [user.ID]
      );
    }

    // Payload del token
    const payload = {
      userId: user.ID,
      nombre: user.Nombre,
      correo: user.Correo,
      rol: user.Rol
    };

    // Crear token con expiración de 1 minuto
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: `${JWT_EXPIRES_IN}s`  // "60s"
    });

    return res.status(200).json({
      ok: true,
      message: 'Login correcto',
      token,
      expiresIn: Number(JWT_EXPIRES_IN),
      user: {
        id: user.ID,
        nombre: user.Nombre,
        correo: user.Correo,
        rol: user.Rol
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error interno del servidor'
    });
  }
};
// ruta para suscribir a un usuario 
