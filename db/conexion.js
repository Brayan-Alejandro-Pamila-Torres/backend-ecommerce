const mysql = require('mysql2');
const dotenv = require('dotenv');

//cargar variables de entorno
dotenv.config();
//crear la conexion a la base de datos
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT //    <---- para que reconozca el puerto de railway 
});
db.connect((err) => {
    if (err) {
        console.error(' Error al conectar la base de datos:', err);
        return;
    }
    console.log(' Conexión a la base de datos exitosa (desde módulo db)');
    console.log("🔌 Conectando a la base de datos:", db.config.database);
});

module.exports = db;