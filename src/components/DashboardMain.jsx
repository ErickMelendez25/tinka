import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import "./tinka.css";

const COLORS = ["#00C49F", "#FF8042", "#FFBB28", "#0088FE", "#FF4444", "#AA00FF"];

const TinkaDashboard = () => {
  const [sorteos, setSorteos] = useState([]);
  const [predicciones, setPredicciones] = useState([]);
  const [frecuencias, setFrecuencias] = useState([]);
  const [repetidos, setRepetidos] = useState([]);

  useEffect(() => {
    const obtenerDatos = async () => {
      try {
        const baseURL = "https://tinka.grupo-digital-nextri.com/api";
        const [resSorteos, resPredicciones, resFrecuencias, resRepetidos] = await Promise.all([
          axios.get(`${baseURL}/sorteos`),
          axios.get(`${baseURL}/predicciones`),
          axios.get(`${baseURL}/frecuencias`),
          axios.get(`${baseURL}/repetidos`),
        ]);

        setSorteos(resSorteos.data || []);
        setPredicciones(resPredicciones.data || []);
        setFrecuencias(resFrecuencias.data || []);
        setRepetidos(resRepetidos.data || []);
      } catch (error) {
        console.error("❌ Error cargando datos:", error);
      }
    };

    obtenerDatos();
  }, []);

  // 🔹 Preparar datos para el gráfico
  const datosFrecuencia = (frecuencias || [])
    .filter(f => f && f.numero != null)
    .map((f, i) => ({
      name: f?.numero ? `#${f.numero}` : `#${i + 1}`,
      value: f?.veces_salida || 0,
    }));

  return (
    <div className="dashboard-container">
      <h1>📊 Panel de Análisis de Tinka</h1>

      {/* ============================ FRECUENCIAS ============================ */}
      <section>
        <h2>📈 Frecuencia de Números</h2>
        {datosFrecuencia.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={datosFrecuencia}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p>⚠️ No hay datos de frecuencia disponibles.</p>
        )}
      </section>

      {/* ============================ REPETIDOS ============================ */}
      <section>
        <h2>🔁 Números Más Repetidos</h2>
        {(repetidos || []).length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={(repetidos || [])
                  .filter(r => r && r.numero != null)
                  .map((r, i) => ({
                    name: `#${r.numero}`,
                    value: r?.veces_repetido || 0,
                  }))}
                cx="50%"
                cy="50%"
                label={({ name, value }) => `${name || "—"}: ${value ?? 0}`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {(repetidos || []).map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p>⚠️ No hay números repetidos disponibles.</p>
        )}
      </section>

      {/* ============================ SORTEOS ============================ */}
      <section>
        <h2>🎰 Últimos Sorteos</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Fecha</th>
              <th>Números</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(sorteos) && sorteos.filter(Boolean).length > 0 ? (
              sorteos.filter(Boolean).map((s, idx) => (
                <tr key={s?.id || idx}>
                  <td>{s?.sorteo || "—"}</td>
                  <td>{s?.fecha ? new Date(s.fecha).toLocaleDateString() : "—"}</td>
                  <td>
                    {[s?.bola1, s?.bola2, s?.bola3, s?.bola4, s?.bola5, s?.bola6]
                      .filter(Boolean)
                      .map((n, i) => (
                        <span key={i} className="bolita">{n}</span>
                      ))}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="3">⚠️ No hay sorteos disponibles</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* ============================ PREDICCIONES ============================ */}
      <section>
        <h2>🧠 Predicciones AI</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Números Predichos</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(predicciones) && predicciones.filter(Boolean).length > 0 ? (
              predicciones.filter(Boolean).map((p, i) => (
                <tr key={p?.id || i}>
                  <td>{p?.id || i + 1}</td>
                  <td>
                    {[p?.bola1, p?.bola2, p?.bola3, p?.bola4, p?.bola5, p?.bola6]
                      .filter(Boolean)
                      .map((n, idx) => (
                        <span key={idx} className="bolita">{n}</span>
                      ))}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="2">⚠️ No hay predicciones disponibles</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default TinkaDashboard;
