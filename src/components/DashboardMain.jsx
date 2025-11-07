import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import './TinkaDashboard.css';

const API = 'https://tinka-production.up.railway.app/api';
const API_TINKA = 'https://microservicioqiskit-production.up.railway.app/api';

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
  const [cargandoModelo, setCargandoModelo] = useState(false);
  const sorteosPorPagina = 15;

  // ✅ Cargar sorteos con paginación
  const cargarSorteosPaginados = async (pagina) => {
    try {
      const res = await fetch(`${API}/sorteos?page=${pagina}&limit=${sorteosPorPagina}`);
      const data = await res.json();
      setSorteos(Array.isArray(data.data) ? data.data.filter(Boolean) : []);
      setTotalPaginas(data.totalPages || 1);
    } catch (error) {
      console.error('❌ Error al cargar sorteos paginados:', error);
    }
  };

  useEffect(() => {
    cargarSorteosPaginados(paginaActual);
  }, [paginaActual]);

  // ✅ Cargar frecuencias y predicciones
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [frecRes, predRes] = await Promise.all([
          fetch(`${API}/frecuencias`),
          fetch(`${API}/predicciones`)
        ]);

        const frecData = await frecRes.json();
        const predData = await predRes.json();

        setFrecuencias(Array.isArray(frecData) ? frecData.filter(Boolean) : []);
        setPredicciones(Array.isArray(predData) ? predData.filter(Boolean) : []);
      } catch (err) {
        console.error("❌ Error cargando datos:", err);
        setFrecuencias([]);
        setPredicciones([]);
      }
    };

    cargarDatos();
  }, []);

  // ✅ Manejar inputs
  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setNuevaBola(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // ✅ Guardar o actualizar sorteo
  const guardarSorteo = async () => {
    try {
      const resExist = await fetch(`${API}/sorteos`);
      const existentes = await resExist.json();
      const existe = Array.isArray(existentes)
        && existentes.some(s => new Date(s.fecha).toISOString().slice(0, 10) === nuevaBola.fecha);

      const method = existe ? 'PUT' : 'POST';
      const confirmar = existe ? window.confirm('Ya existe un sorteo con esa fecha. ¿Deseas reemplazarlo?') : true;
      if (!confirmar) return;

      const res = await fetch(`${API}/sorteos`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevaBola)
      });

      if (res.ok) {
        alert(existe ? 'Sorteo actualizado' : 'Sorteo registrado');
        window.location.reload();
      } else {
        alert('Error guardando sorteo');
      }
    } catch (error) {
      console.error('❌ Error guardando sorteo:', error);
    }
  };

  // ✅ Ejecutar modelo cuántico
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
        alert('❌ Error al ejecutar el modelo: ' + data.error);
        return;
      }

      alert(data.detalle || data.status || '✅ Modelo ejecutado correctamente');
      if (Array.isArray(data.predicciones)) setPredicciones(data.predicciones.filter(Boolean));
      else setTimeout(obtenerPredicciones, 2000);
    } catch (error) {
      console.error('❌ Error general al ejecutar el modelo:', error);
      alert('❌ Error inesperado al ejecutar el modelo');
    } finally {
      setCargandoModelo(false);
    }
  };

  // ✅ Obtener predicciones
  const obtenerPredicciones = async () => {
    try {
      const res = await fetch(`${API}/predicciones?limit=15`);
      const data = await res.json();
      const ordenadas = Array.isArray(data)
        ? data.filter(Boolean).sort((a, b) => (b.probabilidad || 0) - (a.probabilidad || 0))
        : [];
      setPredicciones(ordenadas);
    } catch (err) {
      console.error("❌ Error obteniendo predicciones:", err);
    }
  };

  const colores = ['#6366f1', '#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="dashboard">
      <h2 className="title">📊 Registro y Predicción de Resultados de La Tinka</h2>

      {/* ==================== FORMULARIO ==================== */}
      <section className="formulario">
        <h3>Registrar nuevo sorteo</h3>
        <div className="inputs">
          <input type="date" name="fecha" value={nuevaBola.fecha} onChange={handleChange} autoComplete="off" />
          <input name="sorteo" placeholder="N° sorteo" value={nuevaBola.sorteo} onChange={handleChange} type="number" autoComplete="off" />

          {[1, 2, 3, 4, 5, 6].map(i => (
            <input key={i} name={`bola${i}`} placeholder={`Bola ${i}`} value={nuevaBola[`bola${i}`]} onChange={handleChange} type="number" min="1" max="50" autoComplete="off" />
          ))}

          <input name="boliyapa" placeholder="BoliYapa" value={nuevaBola.boliyapa} onChange={handleChange} type="number" min="1" max="50" autoComplete="off" />

          <h4>Adicionales:</h4>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <input key={i} name={`adicional${i}`} placeholder={`Adicional ${i}`} value={nuevaBola[`adicional${i}`]} onChange={handleChange} type="number" min="1" max="50" autoComplete="off" />
          ))}

          <div>
            <label>
              <input type="checkbox" name="sorteo_extra" checked={nuevaBola.sorteo_extra} onChange={handleChange} />
              Sorteo Extra
            </label>
          </div>
        </div>
        <button onClick={guardarSorteo} className="btn-guardar">Guardar Sorteo</button>
      </section>

      {/* ==================== GRÁFICO DE FRECUENCIAS ==================== */}
      <section className="grafico">
        <h3>🎯 Frecuencia de Números</h3>
        {Array.isArray(frecuencias) && frecuencias.length > 0 ? (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <BarChart width={800} height={300} data={frecuencias}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="numero" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="veces_salida" fill="#4f46e5" radius={[5, 5, 0, 0]} />
            </BarChart>
          </div>
        ) : <p>⚠️ No hay datos de frecuencia disponibles.</p>}
      </section>

      {/* ==================== TABLA DE SORTEOS ==================== */}
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
            {Array.isArray(sorteos) && sorteos.length > 0 ? (
              sorteos.map((s, idx) => (
                <tr key={s?.id || idx}>
                  <td>{s?.sorteo || '—'}</td>
                  <td>{s?.fecha ? new Date(s.fecha).toLocaleDateString() : '—'}</td>
                  <td>
                    {[s?.bola1, s?.bola2, s?.bola3, s?.bola4, s?.bola5, s?.bola6]
                      .filter(Boolean)
                      .map((n, i) => <span key={i} className="bolita">{n}</span>)}
                  </td>
                  <td>{s?.boliyapa ? <span className="bolita boliyapa">{s.boliyapa}</span> : '-'}</td>
                  <td>
                    {[s?.adicional1, s?.adicional2, s?.adicional3, s?.adicional4, s?.adicional5, s?.adicional6]
                      .filter(Boolean)
                      .map((n, i) => <span key={i} className="bolita adicional">{n}</span>)}
                  </td>
                  <td>{s?.sorteo_extra ? '✅' : '❌'}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="6">⚠️ No hay sorteos disponibles</td></tr>
            )}
          </tbody>
        </table>

        <div className="paginacion">
          <button onClick={() => setPaginaActual(p => Math.max(p - 1, 1))} disabled={paginaActual === 1}>⬅ Anterior</button>
          <span>Página {paginaActual} de {totalPaginas}</span>
          <button onClick={() => setPaginaActual(p => Math.min(p + 1, totalPaginas))} disabled={paginaActual === totalPaginas}>Siguiente ➡</button>
        </div>
      </section>

      {/* ==================== PREDICCIÓN CUÁNTICA ==================== */}
      <section className="prediccion">
        <h3>🔮 Predicción Cuántica</h3>
        {cargandoModelo ? (
          <div className="spinner">
            <img src="https://i.gifer.com/ZKZg.gif" alt="Cargando modelo..." />
            <p>Ejecutando modelo cuántico...</p>
          </div>
        ) : (
          <button onClick={ejecutarModelo} className="btn-ejecutar">Ejecutar modelo</button>
        )}
      </section>

      {/* ==================== COMBINACIONES SUGERIDAS ==================== */}
      <section className="tabla">
        <h3>✨ Combinaciones Sugeridas</h3>
        <table>
          <thead>
            <tr>
              <th>Bolas</th>
              <th>BoliYapa</th>
              <th>Probabilidad</th>
              <th>Modelo</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(predicciones) && predicciones.length > 0 ? (
              predicciones.map((p, i) => (
                <tr key={p?.id || i}>
                  <td>
                    {[p?.bola1, p?.bola2, p?.bola3, p?.bola4, p?.bola5, p?.bola6]
                      .filter(Boolean)
                      .map((n, j) => <span key={j} className="bolita">{Number(n)}</span>)}
                  </td>
                  <td>{p?.boliyapa ? <span className="bolita boliyapa">{Number(p.boliyapa)}</span> : '-'}</td>
                  <td>{typeof p?.probabilidad === 'number' ? `${(p.probabilidad * 100).toFixed(1)}%` : '—'}</td>
                  <td>{p?.modelo_version || 'Desconocido'}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="4">⚠️ No hay predicciones disponibles.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* ==================== GRÁFICOS VISUALES ==================== */}
      <section className="graficos-flex">
        <div className="grafico">
          <h3>🌌 Visualización Cuántica</h3>
          <img src="https://microservicioqiskit-production.up.railway.app/static/superposicion_colapso.png" alt="Colapso Cuántico" style={{ maxWidth: '100%', borderRadius: '8px' }} />
          <p className="nota">* Simulación visual del principio de superposición colapsando a un resultado clásico.</p>
        </div>

        <div className="grafico">
          <h3>🌀 Superposición y Colapso Cuántico (Visual)</h3>
          <PieChart width={400} height={300}>
            <Pie
              data={(Array.isArray(frecuencias) ? frecuencias.slice(0, 6) : []).map((f, i) => ({
                name: f?.numero ? `#${f.numero}` : `#${i + 1}`,
                value: f?.veces_salida || 0
              }))}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name || '—'}: ${value ?? 0}`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {(frecuencias || []).slice(0, 6).map((_, index) => (
                <Cell key={`cell-${index}`} fill={colores[index % colores.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
          <p className="nota">* Los números están en “superposición” y colapsan a uno al ser elegidos.</p>
        </div>
      </section>
    </div>
  );
};

export default TinkaDashboard;
