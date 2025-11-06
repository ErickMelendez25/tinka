// 1. Agrega un nuevo endpoint en tu backend (por ejemplo en Express):
// GET /api/predicciones -> para obtener las combinaciones sugeridas más recientes

// --- En tu backend Node (ejemplo): ---
// app.get('/api/predicciones', async (req, res) => {
//   const predicciones = await db.query('SELECT * FROM predicciones ORDER BY id DESC LIMIT 10');
//   res.json(predicciones);
// });

// 2. Ahora agrega esta sección en tu componente React para mostrar combinaciones sugeridas y superposición:

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import './TinkaDashboard.css';

const API = 'https://tinka-production.up.railway.app/api';        // API de tu backend Node.js
const API_TINKA = 'https://microservicioqiskit-production.up.railway.app/api';      // API del modelo cuántico (FastAPI)



//const //API// = 'http://localhost:5000/api';        // API de tu backend Node.js

//const //API_TINKA// = 'http://127.0.0.1:8000/api';      /// API del modelo cuántico (FastAPI


const TinkaDashboard = () => {
const [nuevaBola, setNuevaBola] = useState({
    fecha: '',
    sorteo: '',
    bola1: '',
    bola2: '',
    bola3: '',
    bola4: '',
    bola5: '',
    bola6: '',
    boliyapa: '',
    adicional1: '',
    adicional2: '',
    adicional3: '',
    adicional4: '',
    adicional5: '',
    adicional6: '',
    sorteo_extra: false
  });

  const [frecuencias, setFrecuencias] = useState([]);
  const [sorteos, setSorteos] = useState([]);
  const [predicciones, setPredicciones] = useState([]);

  
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const sorteosPorPagina = 15;
  const [cargandoModelo, setCargandoModelo] = useState(false);


  const cargarSorteosPaginados = async (pagina) => {
  try {
      const res = await fetch(`${API}/sorteos?page=${pagina}&limit=${sorteosPorPagina}`);
      const data = await res.json();
      setSorteos(data.data);
      setTotalPaginas(data.totalPages);
    } catch (error) {
      console.error('Error al cargar sorteos paginados:', error);
    }
  };

  useEffect(() => {
    cargarSorteosPaginados(paginaActual);
  }, [paginaActual]);


  

  useEffect(() => {

    fetch(`${API}/frecuencias`).then(res => res.json()).then(setFrecuencias);
    fetch(`${API}/predicciones`).then(res => res.json()).then(setPredicciones);
  }, []);

  const handleChange = e => {
    const { name, value } = e.target;
    setNuevaBola(prev => ({ ...prev, [name]: value }));
  };

const guardarSorteo = async () => {
  const check = await fetch(`${API}/sorteos`); // Trae todos los sorteos
  const existentes = await check.json();
  const existe = existentes.some(s => new Date(s.fecha).toISOString().slice(0, 10) === nuevaBola.fecha);

  if (existe) {
    const confirmar = window.confirm('Ya existe un sorteo con esa fecha. ¿Deseas reemplazarlo?');
    if (!confirmar) return;

    // PUT
    const res = await fetch(`${API}/sorteos`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevaBola)
    });
    if (res.ok) {
      alert('Sorteo actualizado');
      window.location.reload();
    } else {
      alert('Error actualizando sorteo');
    }
  } else {
    // POST
    const res = await fetch(`${API}/sorteos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevaBola)
    });
    if (res.ok) {
      alert('Sorteo registrado');
      window.location.reload();
    } else {
      alert('Error guardando sorteo');
    }
  }
};


const ejecutarModelo = async () => {
  try {
    setCargandoModelo(true);

    const res = await fetch(`${API_TINKA}/ejecutarmodelos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ejecutar: true })
    });

    const data = await res.json();

    if (data.error) {
      console.error('⚠️ Error desde el backend:', data.error);
      alert('❌ Error al ejecutar el modelo: ' + data.error);
      return;
    }

    console.log('[DEBUG] Respuesta del modelo:', data);
    alert(data.detalle || data.status || '✅ Modelo ejecutado correctamente');

    if (data.predicciones) {
      setPredicciones(data.predicciones);
    } else {
      setTimeout(() => obtenerPredicciones(), 2000);
    }

  } catch (error) {
    console.error('❌ Error general al ejecutar el modelo:', error);
    alert('❌ Error inesperado al ejecutar el modelo');
  } finally {
    setCargandoModelo(false);
  }
};





  const obtenerPredicciones = async () => {
    const res = await fetch(`${API}/predicciones?limit=15`);
    const data = await res.json();

      // Ordenar por probabilidad descendente
    const ordenadas = data.sort((a, b) => b.probabilidad - a.probabilidad);
    setPredicciones(data);
  };


  useEffect(() => {
    obtenerPredicciones();
  }, []);


  const colores = ['#6366f1', '#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="dashboard">
      <h2 className="title">📊 Registro y Predicción de Resultados de La Tinka</h2>

      <section className="formulario">
        <h3>Registrar nuevo sorteo</h3>
        <div className="inputs">
        <input type="date" name="fecha" value={nuevaBola.fecha} onChange={handleChange} />
        <input name="sorteo" placeholder="N° sorteo" value={nuevaBola.sorteo} onChange={handleChange} type="number" />

        {[1, 2, 3, 4, 5, 6].map(i => (
          <input key={i} name={`bola${i}`} placeholder={`Bola ${i}`} value={nuevaBola[`bola${i}`]} onChange={handleChange} type="number" min="1" max="50" />
        ))}

        <input name="boliyapa" placeholder="BoliYapa" value={nuevaBola.boliyapa} onChange={handleChange} type="number" min="1" max="50" />

        <h4>Adicionales:</h4>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <input key={i} name={`adicional${i}`} placeholder={`Adicional ${i}`} value={nuevaBola[`adicional${i}`]} onChange={handleChange} type="number" min="1" max="50" />
        ))}

        <div>
          <label>
            <input
              type="checkbox"
              name="sorteo_extra"
              checked={nuevaBola.sorteo_extra}
              onChange={e => setNuevaBola(prev => ({ ...prev, sorteo_extra: e.target.checked }))}
            />
            Sorteo Extra
          </label>
        </div>
        </div>
        <button onClick={guardarSorteo} className="btn-guardar">Guardar Sorteo</button>
      </section>

      <section className="grafico">
        <h3>🎯 Frecuencia de Números</h3>
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <BarChart width={800} height={300} data={frecuencias}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="numero" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="veces_salida" fill="#4f46e5" radius={[5, 5, 0, 0]} />
            </BarChart>
          </div>

      </section>

      <section className="tabla">
        <h3>📅 Histórico de Sorteos</h3>
        <table>
        <thead>
          <tr>
            <th>Sorteo</th>
            <th>Fecha</th>
            <th>Bolas</th>
            <th>BoliYapa</th>
            <th>Adicionales</th>
            <th>Sorteo Extra</th>
          </tr>
        </thead>
        <tbody>
          {sorteos.map(s => (
            <tr key={s.id}>
              <td>{s.sorteo}</td>
              <td>{new Date(s.fecha).toLocaleDateString()}</td>
              <td>
                {[s.bola1, s.bola2, s.bola3, s.bola4, s.bola5, s.bola6].map((n, i) => (
                  <span key={i} className="bolita">{n}</span>
                ))}
              </td>
              <td>{s.boliyapa && <span className="bolita boliyapa">{s.boliyapa}</span>}</td>
              <td>
                {[s.adicional1, s.adicional2, s.adicional3, s.adicional4, s.adicional5, s.adicional6]
                  .filter(n => n !== null)
                  .map((n, i) => (
                    <span key={i} className="bolita adicional">{n}</span>
                ))}
              </td>
              <td>{s.sorteo_extra ? '✅' : '❌'}</td>
            </tr>
          ))}
        </tbody>
        </table>
        <div className="paginacion">
        <button
          onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))}
          disabled={paginaActual === 1}
        >
          ⬅ Anterior
        </button>
        <span>Página {paginaActual} de {totalPaginas}</span>
        <button
          onClick={() => setPaginaActual(prev => Math.min(prev + 1, totalPaginas))}
          disabled={paginaActual === totalPaginas}
        >
          Siguiente ➡
        </button>
      </div>

      </section>


      <section className="prediccion">
        <h3>🔮 Predicción Cuántica</h3>
        {cargandoModelo ? (
          <div className="spinner">
            <img src="https://i.gifer.com/ZKZg.gif" alt="Cargando modelo..." />
            <p>Ejecutando modelo cuántico...</p>
          </div>
        ) : (
          <button onClick={ejecutarModelo} className="btn-ejecutar">
            Ejecutar modelo
          </button>
        )}
      </section>

      <section className="tabla">
  <h3>✨ Combinaciones Sugeridas</h3>
  <table>
    <thead>
      <tr>
        <th style={{ width: '300px' }}>Bolas</th>
        <th style={{ width: '60px' }}>BoliYapa</th>

        <th style={{ width: '60px' }}>Probabilidad</th>

        <th style={{ width: '180px' }}>Modelo</th>

      </tr>
    </thead>
    <tbody>
          {predicciones.map((p, i) => (
            <tr key={i}>
              <td>
                {[p.bola1, p.bola2, p.bola3, p.bola4, p.bola5, p.bola6].map((n, i) =>
                  n ? <span key={i} className="bolita">{Number(n)}</span> : null
                )}
              </td>
              <td>{p.boliyapa ? <span className="bolita boliyapa">{Number(p.boliyapa)}</span> : '-'}</td>


              <td>{(p.probabilidad * 100).toFixed(1)}%</td>

              <td>{p.modelo_version}</td>              
            </tr>
          ))}
        </tbody>
      </table>
    </section>
    <section className="graficos-flex">
      <div className="grafico">
        <h3>🌌 Visualización Cuántica: Superposición y Colapso</h3>
        <img src="https://microservicioqiskit-production.up.railway.app/static/superposicion_colapso.png" alt="Colapso Cuántico" style={{ maxWidth: '100%', borderRadius: '8px' }} />
        <p className="nota">* Simulación visual del principio de superposición colapsando a un resultado clásico.</p>
      </div>

      <div className="grafico">
        <h3>🌀 Superposición y Colapso Cuántico (Visual)</h3>
        <PieChart width={400} height={300}>
          <Pie
            data={Array.isArray(frecuencias)
              ? frecuencias.slice(0, 6).map((f, i) => ({
                  name: f?.numero ? `#${f.numero}` : `#${i + 1}`,
                  value: f?.veces_salida || 0
                }))
              : []}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {Array.isArray(frecuencias)
              ? frecuencias.slice(0, 6).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colores[index % colores.length]} />
                ))
              : null}
          </Pie>
          <Tooltip />
        </PieChart>

        <p className="nota">* Esto simula la idea de que los números pueden estar en "superposición" y luego se "colapsan" a uno al ser elegidos.</p>
      </div>
    </section>




    </div>

  );
};

export default TinkaDashboard;
