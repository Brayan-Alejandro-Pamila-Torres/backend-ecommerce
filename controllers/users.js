const db = require('../db/conexion');

exports.login = (req, res) => {
    const { correo, password } = req.body;

    if (!correo || !password) {
        return res.status(400).json({ ok: false, msg: "Faltan datos" });
    }

    // IMPORTANTE: tu tabla usa "Correo" y "Contraseña"
    const query = "SELECT * FROM usuarios WHERE Correo = ? AND Contraseña = ? LIMIT 1";

    db.query(query, [correo, password], (err, results) => {
        if (err) {
            console.error("Error en login:", err);
            return res.status(500).json({ ok: false, msg: "Error en el servidor" });
        }

        if (results.length === 0) {
            return res.status(401).json({ ok: false, msg: "Credenciales incorrectas" });
        }

        const user = results[0];

        return res.json({
            ok: true,
            id: user.ID,
            nombre: user.Nombre,
            correo: user.Correo,
            rol: user.Rol
        });
    });
};
