  import nodemailer from 'nodemailer';
  import express from 'express';
  import mysql from 'mysql2';
  import bcrypt from 'bcryptjs';
  import cors from 'cors';
  import multer from 'multer';
  import path from 'path';
  import fs from 'fs';
  import jwt from 'jsonwebtoken';
  import bodyParser from 'body-parser';
  import dotenv from 'dotenv';
  import { Server as SocketIO } from 'socket.io'

  import { spawn } from 'child_process';



  dotenv.config({ path: './.env', override: true });
  console.log('🔧 DB_HOST:', process.env.DB_HOST);
  console.log('🔧 DB_PORT:', process.env.DB_PORT);
  console.log('🔧 DB_USER:', process.env.DB_USER);
  console.log('🔧 DB_NAME:', process.env.DB_NAME);

  //para la conexion con arduino
  import { SerialPort } from 'serialport';
  import { ReadlineParser } from '@serialport/parser-readline';
  import { WebSocketServer } from 'ws';
  import http from 'http';

  const app = express();

  const server = http.createServer(app); // ✅ Aquí creas el server
  // WebSocket Server
  const wss = new WebSocketServer({ server });


  const io = new SocketIO(server, {
    cors: { origin: '*' },
  });


  wss.on('connection', (ws) => {
    console.log('Cliente conectado via WebSocket');

    ws.on('message', (message) => {
      console.log('Mensaje recibido:', message);
    });

    ws.send(JSON.stringify({ estado: "libre", cochera: 3 }));

  });


  // Variable para manejar el estado de conexión del puerto COM14
  let cocheraConectada = false;

  // Solo ejecutar esto si **NO** estamos en producción
  if (process.env.NODE_ENV !== 'production') {
    console.log('✅ Ambiente local detectado: habilitando puertos COM');

    // ⬇️ COM14 - Cochera
    const portSerial = new SerialPort({ path: 'COM14', baudRate: 9600 }, (err) => {
      if (err) {
        console.error('❌ No se pudo abrir COM14:', err.message);
      } else {
        console.log('✅ COM14 conectado');

        const parser = portSerial.pipe(new ReadlineParser({ delimiter: '\n' }));

        parser.on('data', data => {
          const estado = data.trim().toUpperCase();
          if (estado === "OCUPADO" || estado === "LIBRE") {
            console.log(`Estado recibido: ${estado}`);
            wss.clients.forEach(client => {
              if (client.readyState === 1) {
                client.send(JSON.stringify({ sensorId: 1, estado }));
              }
            });
          }
        });

        portSerial.on('close', () => {
          console.log('❌ COM14 desconectado');
        });
      }
    });

    // ⬇️ COM15 - Paciente
    const manejarArduinoPaciente = (path) => {
      const port = new SerialPort({ path, baudRate: 9600 });
      const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

      parser.on('data', data => {
        const estado = data.trim().toUpperCase();
        if (estado === 'LLAMANDO' || estado === 'LIBRE') {
          console.log(`Paciente dice: ${estado}`);
          wss.clients.forEach(client => {
            if (client.readyState === 1) {
              client.send(JSON.stringify({ tipo: 'paciente', estado }));
            }
          });
        }
      });

      port.on('error', err => console.error(`❌ Error paciente:`, err.message));
    };

    manejarArduinoPaciente('COM15');

    // ⬇️ COM16 - Riego
    const manejarArduinoRiego = (path) => {
      const port = new SerialPort({ path, baudRate: 9600 });
      const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

      parser.on('data', data => {
        const estado = data.trim().toUpperCase();
        if (estado === 'RIEGO' || estado === 'OK') {
          console.log(`Riego: ${estado}`);
          wss.clients.forEach(client => {
            if (client.readyState === 1) {
              client.send(JSON.stringify({ tipo: 'riego', estado }));
            }
          });
        }
      });

      port.on('error', err => console.error(`❌ Error riego:`, err.message));
    };

    manejarArduinoRiego('COM16');

  } else {
    console.log('🌐 Producción detectada: conexiones COM deshabilitadas');
  }







  const port = process.env.PORT ||8080;

  const __dirname = path.resolve();  // Obtener la ruta del directorio actual (correcto para Windows)

  // Configura CORS para permitir solicitudes solo desde tu frontend
  const corsOptions = {
    origin: ['https://tinka.grupo-digital-nextri.com', 'http://localhost:5173', 'https://tinka.grupo-digital-nextri.com','http://localhost:5000','http://localhost:8000'],
    methods: 'GET, POST, PUT, DELETE',
    allowedHeaders: 'Content-Type, Authorization',
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.use(express.json());
  app.use(bodyParser.json());

  // Verificar si la carpeta 'uploads' existe, si no, crearla
  const terrenosDirectory  = path.join(__dirname, 'terrenos');
  if (!fs.existsSync(terrenosDirectory)) {
    fs.mkdirSync(terrenosDirectory, { recursive: true });
  }

  // Configuración de Multer
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'terrenos/');
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });

  const upload = multer({ storage: storage });

  app.use('/terrenos', express.static(terrenosDirectory)); // Servir archivos estáticos desde 'uploads'



  // Configuración de la base de datos
  const db = mysql.createPool({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port:     Number(process.env.DB_PORT),
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
  });

  // Verificar la conexión inicial
  db.getConnection((err, connection) => {
    if (err) {
      console.error('Error al conectar a la base de datos:', err.stack);
      return;
    }
    console.log('Conexión a la base de datos exitosa');
    connection.release();
  });

  // ✅ Manejo de errores global del pool (agrega aquí)
  db.on('error', (err) => {
    console.error('🛑 Error en el pool de conexiones MySQL:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.warn('⚠️ Conexión perdida con MySQL. Intentando reconectar...');
      // No hace falta reconectar manualmente, el pool se encarga
    } else {
      throw err;
    }
  });


  // Función para generar el token
  const generateToken = (user) => {
    const payload = { correo: user.correo, rol: user.rol };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });  // Usar la variable de entorno para la clave secreta
  };

  // Middleware para verificar el token de autenticación
  const verificarToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];  // Obtenemos el token del header

    if (!token) {
      return res.status(403).json({ message: 'Token no proporcionado' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: 'Token no válido' });
      }
      req.user = decoded;  // Agregamos los datos del usuario decodificados
      next();
    });
  };



  ///CONEXION QISKITTT-------------////////////////////////////////////////////////////////////////////
  // Conexión WebSocket
  io.on('connection', (socket) => {
    console.log('Cliente conectado via WebSocket');
    socket.on('disconnect', () => console.log('Cliente desconectado'));
  });

  //io.emit('modelo_ejecutado', {
    //zona_id,
    
    //resultado: JSON.parse(resultado)
  //});


  // API: Zonas agrícolas
  // Traer zonas incluyendo región, provincia y distrito
  // API: Zonas agrícolas con IDs completos
  app.get('/api/zonas', (req, res) => {
    const sql = `
      SELECT 
        z.*,
        d.id AS distrito_id,
        d.nombre AS distrito,
        p.id AS provincia_id,
        p.nombre AS provincia,
        r.id AS region_id,
        r.nombre AS region
      FROM zonas_agricolas z
      LEFT JOIN distritos d ON z.distrito_id = d.id
      LEFT JOIN provincias p ON d.provincia_id = p.id
      LEFT JOIN regiones r ON p.region_id = r.id
    `;

    db.query(sql, (err, rows) => {
      if (err) {
        console.error('Error al consultar zonas:', err);
        return res.status(500).json({ message: 'Error al consultar zonas' });
      }
      res.json(rows);
    });
  });


  app.get('/api/zonas/:id', (req, res) => {
    const { id } = req.params;
    if (!Number(id)) return res.status(400).json({ message: 'ID inválido' });
    db.query('SELECT * FROM zonas_agricolas WHERE id = ?', [id], (err, rows) => {
      if (err) return res.status(500).json({ message: 'Error al consultar zona' });
      if (rows.length === 0) return res.status(404).json({ message: 'Zona no encontrada' });
      res.json(rows[0]);
    });
  });

  // API: Sensores
  app.get('/api/sensores', (req, res) => {
    db.query('SELECT * FROM sensores', (err, rows) => {
      if (err) return res.status(500).json({ message: 'Error al consultar sensores' });
      res.json(rows);
    });
  });

  // API: Nueva lectura desde Arduino o ESP32
  app.post('/api/sensores/nueva-lectura', (req, res) => {
    const { dispositivo_id, valor } = req.body;
    if (!dispositivo_id || !valor) return res.status(400).json({ message: 'Datos incompletos' });

    const sql = `INSERT INTO lecturas_sensor (dispositivo_id, valor, timestamp) VALUES (?, ?, NOW())`;
    db.query(sql, [dispositivo_id, valor], (err) => {
      if (err) return res.status(500).json({ message: 'Error al guardar lectura' });
      io.emit('nueva_lectura', { dispositivo_id, valor });
      res.json({ message: 'Lectura registrada y emitida en tiempo real' });
    });
  });

  // API: Consultar lecturas por zona
  app.get('/api/lecturas/:zona_id', (req, res) => {
    const { zona_id } = req.params;
    if (!Number(zona_id)) return res.status(400).json({ message: 'ID inválido' });

    const sql = `
      SELECT l.id, s.tipo AS tipo_sensor, l.valor, l.timestamp
      FROM lecturas_sensor l
      JOIN dispositivos_sensor d ON l.dispositivo_id = d.id
      JOIN sensores s ON d.sensor_id = s.id
      WHERE d.zona_id = ?
      ORDER BY l.timestamp DESC
    `;

    db.query(sql, [zona_id], (err, rows) => {
      if (err) return res.status(500).json({ message: 'Error al consultar lecturas' });
      res.json(rows);
    });
  });

  // Obtener últimos valores de sensores para una zona
  app.get('/api/zonas/:zona_id/indicadores', (req, res) => {
    const { zona_id } = req.params;
    const sql = `
      SELECT tipo_sensor, valor, timestamp
      FROM vista_ultimas_lecturas_por_zona
      WHERE zona_id = ?
      ORDER BY tipo_sensor
    `;

    db.query(sql, [zona_id], (err, rows) => {
      if (err) {
        console.error('Error al consultar indicadores:', err);
        return res.status(500).json({ message: 'Error al consultar indicadores' });
      }

      res.json(rows);
    });
  });



  app.get('/api/zonas/:zona_id/ultimas-lecturas', (req, res) => {
    const { zona_id } = req.params;
    const sql = `
      SELECT tipo_sensor, valor, timestamp
      FROM vista_tres_ultimas_lecturas_por_zona
      WHERE zona_id = ?
      ORDER BY tipo_sensor, timestamp DESC
    `;

    db.query(sql, [zona_id], (err, rows) => {
      if (err) {
        console.error('Error al consultar lecturas:', err);
        return res.status(500).json({ message: 'Error al consultar lecturas por zona' });
      }
      res.json(rows);
    });
  });



  //////
  // API: Listar regiones
  app.get('/api/regiones', (req, res) => {
    db.query('SELECT id, nombre FROM regiones ORDER BY nombre', (err, rows) => {
      if (err) return res.status(500).json({ message: 'Error al consultar regiones' });
      res.json(rows);
    });
  });

  // API: Listar provincias por región
  app.get('/api/provincias/:region_id', (req, res) => {
    db.query(
      'SELECT id, nombre FROM provincias WHERE region_id = ? ORDER BY nombre',
      [req.params.region_id],
      (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error al consultar provincias' });
        res.json(rows);
      }
    );
  });

  // API: Listar distritos por provincia
  app.get('/api/distritos/:provincia_id', (req, res) => {
    db.query(
      'SELECT id, nombre FROM distritos WHERE provincia_id = ? ORDER BY nombre',
      [req.params.provincia_id],
      (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error al consultar distritos' });
        res.json(rows);
      }
    );
  });



  // API: Modelos cuánticos disponibles
  app.get('/api/modelos', (req, res) => {
    db.query('SELECT * FROM modelos_cuanticos', (err, rows) => {
      if (err) return res.status(500).json({ message: 'Error al consultar modelos' });
      res.json(rows);
    });
  });



  // Ejecutar modelo cuántico (ejecuta script Python con Qiskit)



  // Endpoint de autenticación con Google
 app.post('/auth', (req, res) => {
  const { google_id, nombre, correo, imagen_perfil } = req.body;

  if (!google_id || !correo) {
    return res.status(400).json({ message: 'Faltan datos requeridos' });
  }

  db.query('SELECT * FROM usuarios WHERE correo = ?', [correo], (err, result) => {
    if (err) {
      console.error('❌ Error al consultar el usuario:', err);
      return res.status(500).json({ message: 'Error en el servidor', detalle: err.message });
    }

    let usuario;

    if (result.length === 0) {
      // Insertar nuevo usuario
      db.query(
        'INSERT INTO usuarios (google_id, nombre, correo, imagen_perfil, tipo) VALUES (?, ?, ?, ?, ?)',
        [google_id, nombre, correo, imagen_perfil, 'comprador'],
        (err, insertResult) => {
          if (err) {
            console.error('❌ Error al insertar el nuevo usuario:', err);
            return res.status(500).json({ message: 'Error en el servidor', detalle: err.message });
          }

          // Volver a consultar para obtener el usuario recién insertado
          db.query('SELECT * FROM usuarios WHERE correo = ?', [correo], (err, newUserResult) => {
            if (err) {
              console.error('❌ Error al consultar el nuevo usuario:', err);
              return res.status(500).json({ message: 'Error en el servidor', detalle: err.message });
            }

            usuario = newUserResult[0];
            const token = jwt.sign({ id: usuario.id, correo: usuario.correo }, process.env.JWT_SECRET, { expiresIn: '7d' });

            return res.status(200).json({ token, usuario });
          });
        }
      );
    } else {
      // Usuario ya existe
      usuario = result[0];
      const token = jwt.sign({ id: usuario.id, correo: usuario.correo }, process.env.JWT_SECRET, { expiresIn: '7d' });

      return res.status(200).json({ token, usuario });
    }
  });
});






  // Ruta de login
  app.post('/login', (req, res) => {
    const { correo, password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({ message: 'Correo y contraseña son requeridos' });
    }

    db.query('SELECT * FROM usuarios WHERE correo = ?', [correo], (err, result) => {
      if (err) {
        console.error('Error al consultar el usuario:', err);
        return res.status(500).json({ message: 'Error en el servidor' });
      }

      if (result.length === 0) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const user = result[0];

      bcrypt.compare(password, user.contraseña, (err, isMatch) => {
        if (err) {
          console.error('Error al comparar las contraseñas:', err);
          return res.status(500).json({ message: 'Error en el servidor' });
        }

        if (!isMatch) {
          return res.status(400).json({ message: 'Contraseña incorrecta' });
        }

        const token = generateToken(user); // Tu función para generar token JWT

        const baseUsuario = {
          correo: user.correo,
          rol: user.rol,
          nombre: user.nombre,
          imagen_perfil: user.imagen_perfil || null,
        };

        // Inicializamos IDs
        let id_estudiante = null;
        let id_asesor = null;
        let id_revisor = null;

        // Rol: revisor
        if (user.rol === 'revisor') {
          db.query('SELECT id FROM revisores WHERE correo = ?', [user.correo], (err, revisorResult) => {
            if (err) return res.status(500).json({ message: 'Error en el servidor' });

            id_revisor = revisorResult.length > 0 ? revisorResult[0].id : null;
            return res.status(200).json({
              message: 'Login exitoso',
              token,
              usuario: { ...baseUsuario, id_estudiante, id_asesor, id_revisor }
            });
          });

        // Rol: asesor
        } else if (user.rol === 'asesor') {
          db.query('SELECT id FROM asesores WHERE correo = ?', [user.correo], (err, asesorResult) => {
            if (err) return res.status(500).json({ message: 'Error en el servidor' });

            id_asesor = asesorResult.length > 0 ? asesorResult[0].id : null;

            db.query('SELECT id FROM estudiantes WHERE correo = ?', [user.correo], (err, studentResult) => {
              if (err) return res.status(500).json({ message: 'Error en el servidor' });

              id_estudiante = studentResult.length > 0 ? studentResult[0].id : null;

              return res.status(200).json({
                message: 'Login exitoso',
                token,
                usuario: { ...baseUsuario, id_estudiante, id_asesor, id_revisor: null }
              });
            });
          });

        // Otros roles
        } else {
          db.query('SELECT id FROM usuarios WHERE correo = ?', [user.correo], (err, studentResult) => {
            if (err) return res.status(500).json({ message: 'Error en el servidor' });

            id_estudiante = studentResult.length > 0 ? studentResult[0].id : null;

            return res.status(200).json({
              message: 'Login exitoso',
              token,
              usuario: { ...baseUsuario, id_estudiante, id_asesor: null, id_revisor: null }
            });
          });
        }
      });
    });
  });


  // Rutas de usuarios y terrenos con autorización
  app.get('/api/usuarios', async (req, res) => {
    try {
      // Usamos db.query en lugar de connection.execute
      db.query('SELECT * FROM usuarios', (err, rows) => {
        if (err) {
          // Manejo de errores si la consulta falla
          console.error('Error al obtener usuarios:', err);
          return res.status(500).json({ message: 'Error al obtener usuarios', error: err.message });
        }
        
        // Si no hay errores, devolvemos los usuarios obtenidos
        res.json(rows);
      });
    } catch (error) {
      // Si ocurre un error inesperado
      console.error('Error inesperado al obtener usuarios:', error);
      res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
  });

  ///TINKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA--------------------------------
// GET /api/sorteos?page=1&limit=15
  app.get('/api/sorteos', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;

    const sqlData = `
      SELECT id, sorteo, fecha, bola1, bola2, bola3, bola4, bola5, bola6,
            boliyapa, adicional1, adicional2, adicional3,
            adicional4, adicional5, adicional6, sorteo_extra
      FROM sorteos
      ORDER BY fecha DESC
      LIMIT ? OFFSET ?
    `;

    const sqlTotal = `SELECT COUNT(*) AS total FROM sorteos`;

    db.query(sqlTotal, (err, totalResult) => {
      if (err) return res.status(500).json({ error: 'Error al contar sorteos' });
      const total = totalResult[0].total;

      db.query(sqlData, [limit, offset], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error al cargar sorteos paginados' });

        res.json({
          data: rows,
          total,
          page,
          totalPages: Math.ceil(total / limit)
        });
      });
    });
  });


  // Obtener frecuencias
  app.get('/api/frecuencias', async (req, res) => {
    try {
      const frecuencias = await db.query(`
        SELECT numero, COUNT(*) AS veces_salida
        FROM (
          SELECT bola1 AS numero FROM sorteos
          UNION ALL
          SELECT bola2 FROM sorteos
          UNION ALL
          SELECT bola3 FROM sorteos
          UNION ALL
          SELECT bola4 FROM sorteos
          UNION ALL
          SELECT bola5 FROM sorteos
          UNION ALL
          SELECT bola6 FROM sorteos
        ) AS todas_bolas
        GROUP BY numero
        ORDER BY veces_salida DESC
      `);

      res.json(frecuencias);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener frecuencias' });
    }
  });


  // Obtener predicciones recientes
  app.get('/api/predicciones', async (req, res) => {
    try {
      const predicciones = await db.query(
        'SELECT * FROM predicciones ORDER BY id DESC LIMIT 10'
      );
      res.json(predicciones);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener predicciones' });
    }
  });



  app.post('/api/sorteos', (req, res) => {
    const {
      fecha, sorteo, bola1, bola2, bola3, bola4, bola5, bola6,
      boliyapa, adicional1, adicional2, adicional3,
      adicional4, adicional5, adicional6, sorteo_extra
    } = req.body;

    const sql = `
      INSERT INTO sorteos (
        fecha, sorteo, bola1, bola2, bola3, bola4, bola5, bola6,
        boliyapa, adicional1, adicional2, adicional3,
        adicional4, adicional5, adicional6, sorteo_extra
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      fecha, sorteo, bola1, bola2, bola3, bola4, bola5, bola6,
      boliyapa, adicional1, adicional2, adicional3,
      adicional4, adicional5, adicional6, sorteo_extra
    ];

    db.query(sql, values, (err, result) => {
      if (err) {
        console.error('Error al insertar sorteo:', err);
        return res.status(500).json({ error: 'Error al insertar sorteo' });
      }

      res.json({ message: 'Sorteo agregado exitosamente', id: result.insertId });
    });
  });


  app.put('/api/sorteos', (req, res) => {
  const {
    fecha, sorteo, bola1, bola2, bola3, bola4, bola5, bola6,
    boliyapa, adicional1, adicional2, adicional3,
    adicional4, adicional5, adicional6, sorteo_extra
  } = req.body;

  const sql = `
    UPDATE sorteos SET
      sorteo = ?, bola1 = ?, bola2 = ?, bola3 = ?, bola4 = ?, bola5 = ?, bola6 = ?,
      boliyapa = ?, adicional1 = ?, adicional2 = ?, adicional3 = ?, adicional4 = ?, adicional5 = ?, adicional6 = ?, sorteo_extra = ?
    WHERE fecha = ?
  `;

  const values = [
    sorteo, bola1, bola2, bola3, bola4, bola5, bola6,
    boliyapa, adicional1, adicional2, adicional3, adicional4, adicional5, adicional6,
    sorteo_extra, fecha
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error actualizando sorteo:', err);
      return res.status(500).json({ error: 'Error al actualizar sorteo' });
    }

    res.json({ message: 'Sorteo actualizado correctamente' });
  });
});

  app.get('/api/predicciones', (req, res) => {
    const limit = parseInt(req.query.limit) || 15;
    db.query('SELECT * FROM predicciones ORDER BY id DESC LIMIT ?', [limit], (err, resultados) => {
      if (err) return res.status(500).json({ error: 'Error al consultar predicciones' });
      res.json(resultados);
    });
  });






  app.get('/api/terrenos', async (req, res) => {
    try {
      // Ejecutamos la consulta con db.query
      db.query('SELECT * FROM terrenos', (err, rows) => {
        if (err) {
          // Manejo de errores si algo sale mal
          console.error('Error al consultar los terrenos:', err);
          return res.status(500).json({ message: 'Error en el servidor' });
        }

        // Enviamos los resultados de la consulta como respuesta
        res.json(rows);
      });
    } catch (error) {
      // Si hay algún error inesperado
      console.error('Error al obtener terrenos:', error);
      res.status(500).json({ message: 'Error en el servidor' });
    }
  });

  // Ruta para obtener los detalles de un terreno por ID
  app.get('/api/terrenos/:id', async (req, res) => {
    const { id } = req.params;

    try {
      // Usamos db.query en lugar de connection.execute
      db.query('SELECT * FROM terrenos WHERE id = ?', [id], (err, rows) => {
        if (err) {
          // Manejo de errores si la consulta falla
          console.error('Error al obtener el terreno:', err);
          return res.status(500).json({ message: 'Error en el servidor', error: err.message });
        }

        // Si no se encuentra el terreno, devolvemos 404
        if (rows.length === 0) {
          return res.status(404).json({ message: 'Terreno no encontrado' });
        }

        // Devolvemos el primer terreno encontrado
        res.json(rows[0]);
      });
    } catch (error) {
      // Si ocurre algún error inesperado
      console.error('Error inesperado al obtener el terreno:', error);
      res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
  });


  // Ruta para obtener un usuario por ID
  app.get('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;

    try {
      // Usamos db.query en lugar de connection.execute
      db.query('SELECT * FROM usuarios WHERE id = ?', [id], (err, rows) => {
        if (err) {
          // Manejo de errores si la consulta falla
          console.error('Error al obtener el usuario:', err);
          return res.status(500).json({ message: 'Error en el servidor', error: err.message });
        }

        // Si no se encuentra el usuario, devolvemos 404
        if (rows.length === 0) {
          return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Devolvemos el primer usuario encontrado
        res.json(rows[0]);
      });
    } catch (error) {
      // Si ocurre algún error inesperado
      console.error('Error inesperado al obtener el usuario:', error);
      res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
  });

  app.post('/Createterrenos',
    upload.fields([
      { name: 'imagenes', maxCount: 1 },
      { name: 'imagen_2', maxCount: 1 },
      { name: 'imagen_3', maxCount: 1 },
      { name: 'imagen_4', maxCount: 1 },
      { name: 'video', maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        const {
          titulo, descripcion, precio,
          ubicacion_lat, ubicacion_lon,
          metros_cuadrados, estado, usuario_id
        } = req.body;

        const files = req.files;

        const imagen = files?.imagenes?.[0]?.filename || null;
        const imagen2 = files?.imagen_2?.[0]?.filename || null;
        const imagen3 = files?.imagen_3?.[0]?.filename || null;
        const imagen4 = files?.imagen_4?.[0]?.filename || null;
        const video = files?.video?.[0]?.filename || null;

        if (!titulo || !descripcion || !precio || !ubicacion_lat || !ubicacion_lon || !metros_cuadrados || !estado || !usuario_id) {
          console.error('Faltan campos en el formulario:', req.body);
          return res.status(400).json({ message: 'Todos los campos son requeridos' });
        }

        console.log('Datos recibidos:', req.body);
        console.log('Archivos recibidos:', files);

        const query = `
          INSERT INTO terrenos
          (titulo, descripcion, precio, ubicacion_lat, ubicacion_lon, metros_cuadrados, imagenes, imagen_2, imagen_3, imagen_4, video, estado, usuario_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        db.query(query, [
          titulo, descripcion, precio,
          ubicacion_lat, ubicacion_lon,
          metros_cuadrados, imagen, imagen2, imagen3, imagen4, video,
          estado, usuario_id
        ], (err, result) => {
          if (err) {
            console.error('Error al crear el terreno:', err);
            return res.status(500).json({ message: 'Error en el servidor', error: err.message });
          }

          res.status(201).json({
            message: 'Terreno creado exitosamente',
            terrenoId: result.insertId,
          });
        });

      } catch (error) {
        console.error('Error al crear el terreno:', error);
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
      }
  });

  app.put('/UpdateTerreno/:id',
    upload.fields([
      { name: 'imagenes', maxCount: 1 },
      { name: 'imagen_2', maxCount: 1 },
      { name: 'imagen_3', maxCount: 1 },
      { name: 'imagen_4', maxCount: 1 },
      { name: 'video', maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        const { id } = req.params;  // Obtener el ID del terreno desde la URL
        const {
          titulo, descripcion, precio,
          ubicacion_lat, ubicacion_lon,
          metros_cuadrados, estado, usuario_id
        } = req.body;

        const files = req.files;

        // Verificar si hay archivos y asignarlos
        const imagen = files?.imagenes?.[0]?.filename || null;
        const imagen2 = files?.imagen_2?.[0]?.filename || null;
        const imagen3 = files?.imagen_3?.[0]?.filename || null;
        const imagen4 = files?.imagen_4?.[0]?.filename || null;
        const video = files?.video?.[0]?.filename || null;

        if (!titulo || !descripcion || !precio || !ubicacion_lat || !ubicacion_lon || !metros_cuadrados || !estado || !usuario_id) {
          console.error('Faltan campos en el formulario:', req.body);
          return res.status(400).json({ message: 'Todos los campos son requeridos' });
        }

        console.log('Datos recibidos:', req.body);
        console.log('Archivos recibidos:', files);

        // Consulta SQL para actualizar el terreno
        const query = `
          UPDATE terrenos
          SET 
            titulo = ?, descripcion = ?, precio = ?, 
            ubicacion_lat = ?, ubicacion_lon = ?, 
            metros_cuadrados = ?, imagenes = ?, imagen_2 = ?, 
            imagen_3 = ?, imagen_4 = ?, video = ?, 
            estado = ?, usuario_id = ?
          WHERE id = ?`;

        db.query(query, [
          titulo, descripcion, precio,
          ubicacion_lat, ubicacion_lon,
          metros_cuadrados, imagen, imagen2, imagen3, imagen4, video,
          estado, usuario_id, id  // ID del terreno para actualizar
        ], (err, result) => {
          if (err) {
            console.error('Error al actualizar el terreno:', err);
            return res.status(500).json({ message: 'Error en el servidor', error: err.message });
          }

          if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Terreno no encontrado' });
          }

          res.status(200).json({
            message: 'Terreno actualizado exitosamente',
            terrenoId: id,
          });
        });

      } catch (error) {
        console.error('Error al actualizar el terreno:', error);
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
      }
    });

    app.delete('/DeleteTerreno/:id', async (req, res) => {
      try {
        const { id } = req.params;  // Obtener el ID del terreno desde la URL
    
        // Consulta SQL para eliminar el terreno
        const query = `DELETE FROM terrenos WHERE id = ?`;
    
        db.query(query, [id], (err, result) => {
          if (err) {
            console.error('Error al eliminar el terreno:', err);
            return res.status(500).json({ message: 'Error en el servidor', error: err.message });
          }
    
          if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Terreno no encontrado' });
          }
    
          res.status(200).json({
            message: 'Terreno eliminado exitosamente',
            terrenoId: id,
          });
        });
    
      } catch (error) {
        console.error('Error al eliminar el terreno:', error);
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
      }
    });


    app.post('/api/solicitud', (req, res) => {
      console.log('Datos recibidos en el servidor:', req.body);
      const { nombre, usuario_id, correo, tipo_documento, numero_documento, consentimiento } = req.body;
    
      // Validación de los datos
      if (!nombre || !usuario_id || !correo || !tipo_documento || !numero_documento || consentimiento === undefined) {
        return res.status(400).json({ message: 'Faltan datos obligatorios' });
      }
    
      // Agregar los datos a la base de datos
      const query = `
        INSERT INTO solicitudes_vendedor (nombre, usuario_id, correo, tipo_documento, numero_documento)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      db.query(query, [nombre, usuario_id, correo, tipo_documento, numero_documento, consentimiento], (err, result) => {
        if (err) {
          console.error('Error al agregar la solicitud:', err);
          return res.status(500).json({ message: 'Error en el servidor', error: err.message });
        }
    
        console.log('Solicitud agregada correctamente a la base de datos:', result);
    
        // Enviar el correo después de insertar los datos en la base de datos
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.EMAIL_USER, // ejemplo: 'tucorreo@gmail.com'
              pass: process.env.EMAIL_PASS, // contraseña generada de aplicación
            }
          });
    
          const mailOptions = {
            from: correo,
            to: ['72848846@continental.edu.pe', correo], // correo del administrador
            subject: `Solicitud-Vendedor de ${nombre}`,
            text: `📝 *Solicitud para ser Vendedor*\n\n👤 *Nombre del Solicitante:* ${nombre}\n📧 *Correo Electrónico:* ${correo}\n🆔 *Tipo de Documento:* ${tipo_documento}\n🔢 *Número de Documento:* ${numero_documento}\n🆔 *ID de Vendedor:* ${usuario_id}\n✅ *Consentimiento:* ${consentimiento ? "Otorgado" : "No otorgado"}\n\nPor favor revise esta solicitud y proceda con la validación correspondiente.\n\n🔗 *Validar solicitud:* http://localhost:5173/dashboard/vender`
          };
    
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error('Error al enviar el correo:', error);
              return res.status(500).json({ message: 'Error al enviar el correo', error: error.message });
            }
    
            console.log('Correo enviado correctamente:', info.response);
            res.status(200).json({ message: 'Solicitud agregada y correo enviado correctamente' });
          });
          
        } catch (error) {
          console.error('Error al enviar el correo:', error);
          res.status(500).json({ message: 'Error al enviar el correo', error: error.message });
        }
      });
    });
    

    app.get('/api/solicitudes', (req, res) => {
      db.query('SELECT * FROM solicitudes_vendedor', (err, results) => {
        if (err) {
          console.error('Error al obtener solicitudes:', err);
          return res.status(500).json({ message: 'Error en el servidor', error: err.message });
        }
        res.json(results); // Respuesta en JSON correcta
      });
    });

    app.put('/api/verificarsolicitud', (req, res) => {
      const { solicitud_id, estado } = req.body;
    
      // Verifica que el estado sea válido
      if (estado !== 'aprobada' && estado !== 'rechazada') {
        return res.status(400).json({ error: 'Estado inválido, debe ser "aprobada" o "rechazada".' });
      }
    
      // Actualizar el estado en la base de datos
      db.query(
        'UPDATE solicitudes_vendedor SET estado = ? WHERE id = ?',
        [estado, solicitud_id],
        (error, results) => {
          if (error) {
            console.error('Error al actualizar el estado de la solicitud:', error);
            return res.status(500).json({ error: 'Error al actualizar el estado de la solicitud.' });
          }
    
          // Obtener la información del comprador para enviar el correo y actualizar tipo si es necesario
          db.query(
            'SELECT * FROM solicitudes_vendedor WHERE id = ?',
            [solicitud_id],
            (err, rows) => {
              if (err || rows.length === 0) {
                return res.status(404).json({ error: 'Solicitud no encontrada.' });
              }
    
              const solicitud = rows[0];
              const { nombre, correo, usuario_id } = solicitud;
    
              console.log('usuario_id extraído de la base de datos:', usuario_id); // Log para verificar el id_usuario
    
              // Si está aprobada, actualizar tipo del usuario a 'vendedor'
              if (estado === 'aprobada') {
                console.log('Intentando actualizar tipo de usuario con id:', usuario_id);
    
                db.query(
                  'UPDATE usuarios SET tipo = ? WHERE id = ?',
                  ['vendedor', usuario_id],
                  (errUpdate, resultsUpdate) => {
                    if (errUpdate) {
                      console.error('Error al actualizar tipo de usuario:', errUpdate);
                      return res.status(500).json({ error: 'Error al actualizar el tipo de usuario.' });
                    }
    
                    console.log('Resultados del UPDATE tipo de usuario:', resultsUpdate); // Log para ver los resultados de la consulta UPDATE
    
                    // Enviar el correo después de la actualización
                    enviarCorreoYResponder(nombre, correo);
                  }
                );
              } else {
                // Si fue rechazada, solo enviar correo
                enviarCorreoYResponder(nombre, correo);
              }
    
              // Función para enviar el correo y devolver la respuesta
              function enviarCorreoYResponder(nombre, correo) {
                const transporter = nodemailer.createTransport({
                  service: 'gmail',
                  auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                  },
                });
    
                let asunto = '';
                let mensaje = '';
    
                if (estado === 'aprobada') {
                  asunto = '🎉 ¡Felicidades! Has sido aprobado como vendedor en SatelitePeru';
                  mensaje = `Hola ${nombre},\n\n¡Estamos muy felices de darte la bienvenida a nuestro equipo de vendedores en SatelitePeru! 🎊🎉\n\nTu solicitud ha sido *aprobada* y ahora puedes comenzar a disfrutar de todos los beneficios de nuestra plataforma.\n\nGracias por confiar en nosotros. Estamos seguros de que juntos lograremos grandes cosas.\n\n¡Bienvenido a bordo!\n\nEl equipo de SatelitePeru 🌐 inicia sesion paraver los cambios https://sateliterrreno-production.up.railway.app/`;
                } else {
                  asunto = 'Resultado de tu solicitud en SatelitePeru';
                  mensaje = `Hola ${nombre},\n\nLamentamos informarte que, tras una revisión detallada, tu solicitud para ser vendedor en SatelitePeru ha sido *rechazada*.\n\nSabemos que esta noticia puede no ser la esperada, pero queremos animarte a seguir preparándote y no rendirte. Puedes volver a postular más adelante si lo deseas.\n\nGracias por tu interés y por confiar en SatelitePeru. ¡Te esperamos pronto!\n\nEl equipo de SatelitePeru 💙`;
                }
    
                const mailOptions = {
                  from: process.env.EMAIL_USER,
                  to: correo,
                  subject: asunto,
                  text: mensaje,
                };
    
                transporter.sendMail(mailOptions, (mailError, info) => {
                  if (mailError) {
                    console.error(mailError);
                    return res.status(500).json({ error: 'Error al enviar el correo de notificación.' });
                  }
    
                  return res.status(200).json({ message: 'Estado actualizado y correo enviado correctamente.' });
                });
              }
            }
          );
        }
      );
    });
    

    //api para escuchar arduino
    app.get('/sensor/estado', (req, res) => {
      res.json({ estado: estadoSensor });
    });
    


  //PROYECTO QISKIT VALIDACIONES EN BACKEND ------------------------1111111111111111111111/////////////////////////////////////////////////////////////////////////////////




  // Para cualquier otra ruta, servir el index.html
  app.use(express.static(path.join(__dirname, 'dist')));

  // Ruta principal
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });

  server.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
  });
