import { useState } from 'react'
import { senadores, PARTIDO_COLORS } from '../data'

const REGIONES = [...new Set(senadores.map(s => s.region))].sort()
const PARTIDOS = [...new Set(senadores.map(s => s.partido))].sort()

export default function Senado() {
  const [busqueda, setBusqueda] = useState('')
  const [filtroPartido, setFiltroPartido] = useState('Todos')
  const [filtroRegion, setFiltroRegion] = useState('Todas')
  const [filtroBloque, setFiltroBloque] = useState('Todos')
  const [seleccionado, setSeleccionado] = useState(null)

  const filtrados = senadores.filter(s => {
    const matchBusqueda = s.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const matchPartido = filtroPartido === 'Todos' || s.partido === filtroPartido
    const matchRegion = filtroRegion === 'Todas' || s.region === filtroRegion
    const matchBloque = filtroBloque === 'Todos' || s.bloque === filtroBloque
    return matchBusqueda && matchPartido && matchRegion && matchBloque
  })

  // Hemiciclo
  const oposicion = senadores.filter(s => s.bloque === 'Oposición')
  const oficialismo = senadores.filter(s => s.bloque === 'Oficialismo')
  const cx = 300, cy = 290
  const circles = []
  const rows = [
    { r: 95, totalSeats: 15, opSeats: 8 },
    { r: 130, totalSeats: 17, opSeats: 8 },
    { r: 165, totalSeats: 18, opSeats: 9 },
  ]
  let opIdx = 0, ofIdx = 0, globalId = 0
  rows.forEach(({ r, totalSeats, opSeats }) => {
    const ofSeats = totalSeats - opSeats
    for (let i = 0; i < opSeats && opIdx < oposicion.length; i++, opIdx++, globalId++) {
      const angle = Math.PI - (i / (totalSeats - 1)) * Math.PI
      circles.push({ x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle), senador: oposicion[opIdx], id: globalId })
    }
    for (let i = 0; i < ofSeats && ofIdx < oficialismo.length; i++, ofIdx++, globalId++) {
      const angle = Math.PI - ((opSeats + i) / (totalSeats - 1)) * Math.PI
      circles.push({ x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle), senador: oficialismo[ofIdx], id: globalId })
    }
  })

  return (
    <div>
      {/* STATS */}
      <div style={styles.statsRow}>
        {[
          { label: 'Total senadores', value: 50, color: '#1e40af' },
          { label: 'Oposición', value: oposicion.length, color: '#dc2626' },
          { label: 'Oficialismo', value: oficialismo.length, color: '#1d6fce' },
        ].map(s => (
          <div key={s.label} style={styles.statCard}>
            <div style={{ ...styles.statNum, color: s.color }}>{s.value}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* HEMICICLO */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Hemiciclo del Senado</div>
        <div style={styles.cardSubtitle}>Haz clic en un escaño para ver al senador</div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' }}>
          <div style={{ overflowX: 'auto' }}>
            <svg width="600" height="310" viewBox="0 0 600 310" style={{ overflow: 'visible' }}>
              <path d={`M ${cx-195} ${cy} A 195 195 0 0 1 ${cx+195} ${cy}`} fill="none" stroke="#e2e8f0" strokeWidth="2"/>
              <line x1={cx} y1={cy-75} x2={cx} y2={cy-180} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="5,3"/>
              {circles.map(({ x, y, senador, id }) => (
                <circle key={id} cx={x} cy={y}
                  r={seleccionado?.id === id ? 12 : 9}
                  fill={PARTIDO_COLORS[senador.partido] || '#94a3b8'}
                  stroke={seleccionado?.id === id ? '#0f172a' : 'white'}
                  strokeWidth={seleccionado?.id === id ? 2.5 : 1.5}
                  style={{ cursor: 'pointer', transition: 'r 0.15s' }}
                  onClick={() => setSeleccionado(seleccionado?.id === id ? null : { ...senador, id })}
                />
              ))}
              <text x="80" y="300" fill="#1e40af" fontSize="11" textAnchor="middle" fontWeight="700">OPOSICIÓN</text>
              <text x="80" y="312" fill="#64748b" fontSize="10" textAnchor="middle">{oposicion.length} escaños</text>
              <text x="520" y="300" fill="#b45309" fontSize="11" textAnchor="middle" fontWeight="700">OFICIALISMO</text>
              <text x="520" y="312" fill="#64748b" fontSize="10" textAnchor="middle">{oficialismo.length} escaños</text>
              <text x={cx} y="300" fill="#0f172a" fontSize="13" textAnchor="middle" fontWeight="700">50</text>
              <text x={cx} y="312" fill="#64748b" fontSize="10" textAnchor="middle">escaños</text>
            </svg>
          </div>

          {/* Panel senador seleccionado */}
          <div style={{ width: 200, paddingTop: 20, flexShrink: 0 }}>
            {seleccionado ? (
              <div style={styles.infoCard}>
                <div style={{ ...styles.partidoBadge, background: PARTIDO_COLORS[seleccionado.partido] || '#94a3b8' }}>
                  {seleccionado.partido}
                </div>
                <div style={styles.infoNombre}>{seleccionado.nombre}</div>
                <div style={styles.infoCargo}>{seleccionado.cargo}</div>
                <div style={styles.infoRegion}>📍 {seleccionado.region}</div>
                <div style={{ ...styles.infoBloque, color: seleccionado.bloque === 'Oficialismo' ? '#b45309' : '#1e40af' }}>
                  {seleccionado.bloque === 'Oficialismo' ? '🔵' : '🔴'} {seleccionado.bloque}
                </div>
                <button onClick={() => setSeleccionado(null)} style={styles.closeBtn}>✕ Cerrar</button>
              </div>
            ) : (
              <div style={styles.emptyPanel}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏛</div>
                <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>Haz clic en<br />un escaño</div>
              </div>
            )}
          </div>
        </div>

        {/* Leyenda */}
        <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(PARTIDO_COLORS).filter(([p]) => senadores.some(s => s.partido === p)).map(([partido, color]) => (
            <div key={partido} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#475569' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, border: color === '#e5e7eb' ? '1px solid #ccc' : 'none' }} />
              {partido}
            </div>
          ))}
        </div>
      </div>

      {/* BUSCADOR Y FILTROS */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Lista de Senadores</div>
        <div style={styles.filtersRow}>
          <input
            placeholder="🔍 Buscar senador..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={styles.input}
          />
          <select value={filtroBloque} onChange={e => setFiltroBloque(e.target.value)} style={styles.select}>
            <option>Todos</option>
            <option>Oficialismo</option>
            <option>Oposición</option>
          </select>
          <select value={filtroPartido} onChange={e => setFiltroPartido(e.target.value)} style={styles.select}>
            <option value="Todos">Todos los partidos</option>
            {PARTIDOS.map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={filtroRegion} onChange={e => setFiltroRegion(e.target.value)} style={styles.select}>
            <option value="Todas">Todas las regiones</option>
            {REGIONES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>{filtrados.length} senadores</div>
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <div style={{ flex: 2 }}>Nombre</div>
            <div>Partido</div>
            <div>Bloque</div>
            <div>Región</div>
          </div>
          {filtrados.map((s, i) => (
            <div key={i} style={{ ...styles.tableRow, background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
              <div style={{ flex: 2, fontWeight: 500, color: '#0f172a' }}>{s.nombre}</div>
              <div>
                <span style={{ ...styles.partidoBadge, background: PARTIDO_COLORS[s.partido] || '#94a3b8', fontSize: 11 }}>
                  {s.partido}
                </span>
              </div>
              <div style={{ color: s.bloque === 'Oficialismo' ? '#b45309' : '#1e40af', fontWeight: 600, fontSize: 12 }}>
                {s.bloque}
              </div>
              <div style={{ color: '#64748b', fontSize: 12 }}>{s.region}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles = {
  statsRow: { display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  statCard: { background: 'white', borderRadius: 10, padding: '16px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flex: 1, minWidth: 120 },
  statNum: { fontSize: 28, fontWeight: 700, lineHeight: 1 },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  card: { background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, color: '#94a3b8', marginBottom: 16 },
  infoCard: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 14px' },
  emptyPanel: { height: 140, border: '1.5px dashed #e2e8f0', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  partidoBadge: { display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, color: 'white', marginBottom: 8 },
  infoNombre: { fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.3, marginBottom: 4 },
  infoCargo: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  infoRegion: { fontSize: 12, color: '#475569', marginBottom: 4 },
  infoBloque: { fontSize: 11, fontWeight: 700, marginBottom: 10 },
  closeBtn: { background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '5px 12px', color: '#64748b', cursor: 'pointer', fontSize: 11, width: '100%' },
  filtersRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 },
  input: { flex: 2, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: "'Inter', sans-serif", minWidth: 180 },
  select: { padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: "'Inter', sans-serif", background: 'white', color: '#475569' },
  table: { borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' },
  tableHeader: { display: 'flex', gap: 12, padding: '10px 16px', background: '#f8fafc', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { display: 'flex', gap: 12, padding: '10px 16px', fontSize: 13, alignItems: 'center', borderTop: '1px solid #f1f5f9' },
}
