import { useState } from 'react'
import { diputados, PARTIDO_COLORS } from '../data'

const REGIONES = [...new Set(diputados.map(d => d.region))].sort()
const PARTIDOS = [...new Set(diputados.map(d => d.partido))].sort()
const DISTRITOS = [...new Set(diputados.map(d => d.distrito))].sort((a,b) => a-b)

export default function Diputados() {
  const [busqueda, setBusqueda] = useState('')
  const [filtroPartido, setFiltroPartido] = useState('Todos')
  const [filtroRegion, setFiltroRegion] = useState('Todas')
  const [filtroBloque, setFiltroBloque] = useState('Todos')
  const [filtroDistrito, setFiltroDistrito] = useState('Todos')

  const filtrados = diputados.filter(d => {
    const matchBusqueda = d.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const matchPartido = filtroPartido === 'Todos' || d.partido === filtroPartido
    const matchRegion = filtroRegion === 'Todas' || d.region === filtroRegion
    const matchBloque = filtroBloque === 'Todos' || d.bloque === filtroBloque
    const matchDistrito = filtroDistrito === 'Todos' || d.distrito === parseInt(filtroDistrito)
    return matchBusqueda && matchPartido && matchRegion && matchBloque && matchDistrito
  })

  const oposicion = diputados.filter(d => d.bloque === 'Oposición').length
  const oficialismo = diputados.filter(d => d.bloque === 'Oficialismo').length
  const independiente = diputados.filter(d => d.bloque === 'Independiente').length

  // Distribución por partido
  const porPartido = PARTIDOS.map(p => ({
    partido: p,
    count: diputados.filter(d => d.partido === p).length,
    color: PARTIDO_COLORS[p] || '#94a3b8'
  })).sort((a, b) => b.count - a.count)

  return (
    <div>
      {/* STATS */}
      <div style={styles.statsRow}>
        {[
          { label: 'Total diputados', value: diputados.length, color: '#1e40af' },
          { label: 'Oposición', value: oposicion, color: '#dc2626' },
          { label: 'Oficialismo', value: oficialismo, color: '#1d6fce' },
          { label: 'Independientes', value: independiente, color: '#6b7280' },
        ].map(s => (
          <div key={s.label} style={styles.statCard}>
            <div style={{ ...styles.statNum, color: s.color }}>{s.value}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* DISTRIBUCIÓN POR PARTIDO */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Distribución por partido</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {porPartido.map(({ partido, count, color }) => (
            <div key={partido} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', borderRadius: 8, padding: '6px 12px', border: '1px solid #e2e8f0' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{partido}</span>
              <span style={{ fontSize: 13, color: '#64748b' }}>— {count}</span>
            </div>
          ))}
        </div>

        {/* Barra proporcional */}
        <div style={{ display: 'flex', height: 20, borderRadius: 10, overflow: 'hidden', marginTop: 16 }}>
          {porPartido.map(({ partido, count, color }) => (
            <div key={partido} title={`${partido}: ${count}`}
              style={{ width: `${(count / diputados.length) * 100}%`, background: color, cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseEnter={e => e.target.style.opacity = 0.7}
              onMouseLeave={e => e.target.style.opacity = 1}
            />
          ))}
        </div>
      </div>

      {/* BUSCADOR Y FILTROS */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Lista de Diputadas y Diputados</div>
        <div style={styles.filtersRow}>
          <input
            placeholder="🔍 Buscar diputado..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={styles.input}
          />
          <select value={filtroBloque} onChange={e => setFiltroBloque(e.target.value)} style={styles.select}>
            <option>Todos</option>
            <option>Oficialismo</option>
            <option>Oposición</option>
            <option>Independiente</option>
          </select>
          <select value={filtroPartido} onChange={e => setFiltroPartido(e.target.value)} style={styles.select}>
            <option value="Todos">Todos los partidos</option>
            {PARTIDOS.map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={filtroRegion} onChange={e => setFiltroRegion(e.target.value)} style={styles.select}>
            <option value="Todas">Todas las regiones</option>
            {REGIONES.map(r => <option key={r}>{r}</option>)}
          </select>
          <select value={filtroDistrito} onChange={e => setFiltroDistrito(e.target.value)} style={styles.select}>
            <option value="Todos">Todos los distritos</option>
            {DISTRITOS.map(d => <option key={d} value={d}>Distrito {d}</option>)}
          </select>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>{filtrados.length} diputados</div>
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <div style={{ flex: 2 }}>Nombre</div>
            <div>Partido</div>
            <div>Bloque</div>
            <div>Región</div>
            <div>Distrito</div>
          </div>
          {filtrados.map((d, i) => (
            <div key={i} style={{ ...styles.tableRow, background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
              <div style={{ flex: 2, fontWeight: 500, color: '#0f172a' }}>{d.nombre}</div>
              <div>
                <span style={{ ...styles.partidoBadge, background: PARTIDO_COLORS[d.partido] || '#94a3b8' }}>
                  {d.partido}
                </span>
              </div>
              <div style={{ color: d.bloque === 'Oficialismo' ? '#b45309' : d.bloque === 'Oposición' ? '#1e40af' : '#6b7280', fontWeight: 600, fontSize: 12 }}>
                {d.bloque}
              </div>
              <div style={{ color: '#64748b', fontSize: 12 }}>{d.region}</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>D{d.distrito}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles = {
  statsRow: { display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  statCard: { background: 'white', borderRadius: 10, padding: '16px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flex: 1, minWidth: 100 },
  statNum: { fontSize: 28, fontWeight: 700, lineHeight: 1 },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  card: { background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  filtersRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 },
  input: { flex: 2, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: "'Inter', sans-serif", minWidth: 180 },
  select: { padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: "'Inter', sans-serif", background: 'white', color: '#475569' },
  table: { borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' },
  tableHeader: { display: 'flex', gap: 12, padding: '10px 16px', background: '#f8fafc', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { display: 'flex', gap: 12, padding: '10px 16px', fontSize: 13, alignItems: 'center', borderTop: '1px solid #f1f5f9' },
  partidoBadge: { display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, color: 'white' },
}
