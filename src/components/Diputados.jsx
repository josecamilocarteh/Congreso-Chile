import { useState } from 'react'
import { diputados, PARTIDO_COLORS } from '../data'

const REGIONES = [...new Set(diputados.map(d => d.region))].sort()
const PARTIDOS_UNICOS = [...new Set(diputados.map(d => d.partido))].sort()
const DISTRITOS = [...new Set(diputados.map(d => d.distrito))].sort((a,b) => a-b)

// Agrupar por partido para el hemiciclo (partidos juntos)
const ORDEN_PARTIDOS_OP = ['PS', 'PPD', 'PDC', 'PC', 'FA', 'FREVS', 'Liberal', 'AH', 'DEM']
const ORDEN_PARTIDOS_OF = ['RN', 'UDI', 'Republicano', 'Evópoli', 'PNL', 'PSC']

function agruparPorPartido(lista, ordenPartidos) {
  const result = []
  ordenPartidos.forEach(p => {
    lista.filter(d => d.partido === p).forEach(d => result.push(d))
  })
  // Agregar los que no están en el orden definido
  lista.filter(d => !ordenPartidos.includes(d.partido)).forEach(d => result.push(d))
  return result
}

const opList = agruparPorPartido(diputados.filter(d => d.bloque === 'Oposición'), ORDEN_PARTIDOS_OP)
const ofList = agruparPorPartido(diputados.filter(d => d.bloque === 'Oficialismo'), ORDEN_PARTIDOS_OF)
const indList = diputados.filter(d => d.bloque === 'Independiente')

// Rows: 24+29+33+34+35 = 155  op:10+12+14+15+14=65  ind:3+3+3+3+3=15  of:11+14+16+16+18=75
const ROWS = [
  { r: 80,  total: 24, op: 10, ind: 3 },
  { r: 110, total: 29, op: 12, ind: 3 },
  { r: 140, total: 33, op: 14, ind: 3 },
  { r: 170, total: 34, op: 15, ind: 3 },
  { r: 200, total: 35, op: 14, ind: 3 },
]

const cx = 390, cy = 340

function buildCircles() {
  const circles = []
  let opI = 0, ofI = 0, indI = 0, id = 0
  ROWS.forEach(({ r, total, op, ind }) => {
    const of = total - op - ind
    for (let i = 0; i < op && opI < opList.length; i++, opI++, id++) {
      const angle = Math.PI - (i / (total - 1)) * Math.PI
      circles.push({ x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle), d: opList[opI], id })
    }
    for (let i = 0; i < ind && indI < indList.length; i++, indI++, id++) {
      const angle = Math.PI - ((op + i) / (total - 1)) * Math.PI
      circles.push({ x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle), d: indList[indI], id })
    }
    for (let i = 0; i < of && ofI < ofList.length; i++, ofI++, id++) {
      const angle = Math.PI - ((op + ind + i) / (total - 1)) * Math.PI
      circles.push({ x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle), d: ofList[ofI], id })
    }
  })
  return circles
}

const circles = buildCircles()

export default function Diputados() {
  const [sel, setSel] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroPartido, setFiltroPartido] = useState('Todos')
  const [filtroRegion, setFiltroRegion] = useState('Todas')
  const [filtroBloque, setFiltroBloque] = useState('Todos')
  const [filtroDistrito, setFiltroDistrito] = useState('Todos')

  const filtrados = diputados.filter(d => {
    const q = busqueda.toLowerCase()
    return d.nombre.toLowerCase().includes(q)
      && (filtroPartido === 'Todos' || d.partido === filtroPartido)
      && (filtroRegion === 'Todas' || d.region === filtroRegion)
      && (filtroBloque === 'Todos' || d.bloque === filtroBloque)
      && (filtroDistrito === 'Todos' || d.distrito === parseInt(filtroDistrito))
  })

  const porPartido = PARTIDOS_UNICOS.map(p => ({
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
          { label: 'Oposición', value: opList.length, color: '#dc2626' },
          { label: 'Oficialismo', value: ofList.length, color: '#1d6fce' },
          { label: 'Independientes', value: indList.length, color: '#6b7280' },
        ].map(s => (
          <div key={s.label} style={styles.statCard}>
            <div style={{ ...styles.statNum, color: s.color }}>{s.value}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* HEMICICLO */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Hemiciclo de la Cámara de Diputadas y Diputados</div>
        <div style={styles.cardSubtitle}>Haz clic en un escaño para ver al diputado · Partidos agrupados · Oposición izquierda · Oficialismo derecha</div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' }}>
          <div style={{ overflowX: 'auto' }}>
            <svg width="780" height="355" viewBox="0 0 780 355" style={{ overflow: 'visible' }}>
              <path d={`M ${cx-225} ${cy} A 225 225 0 0 1 ${cx+225} ${cy}`}
                fill="none" stroke="#e2e8f0" strokeWidth="2" />
              <line x1={cx} y1={cy-70} x2={cx} y2={cy-220}
                stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="5,3" />

              {circles.map(({ x, y, d, id }) => (
                <circle key={id} cx={x} cy={y}
                  r={sel?.id === id ? 9 : 6}
                  fill={PARTIDO_COLORS[d.partido] || '#94a3b8'}
                  stroke={sel?.id === id ? '#0f172a' : 'white'}
                  strokeWidth={sel?.id === id ? 2.5 : 1}
                  style={{ cursor: 'pointer', transition: 'r 0.15s' }}
                  onClick={() => setSel(sel?.id === id ? null : { ...d, id })}
                />
              ))}

              <text x="70" y="332" fill="#1e40af" fontSize="11" textAnchor="middle" fontWeight="700">OPOSICIÓN</text>
              <text x="70" y="344" fill="#64748b" fontSize="10" textAnchor="middle">{opList.length} escaños</text>
              <text x="710" y="332" fill="#b45309" fontSize="11" textAnchor="middle" fontWeight="700">OFICIALISMO</text>
              <text x="710" y="344" fill="#64748b" fontSize="10" textAnchor="middle">{ofList.length} escaños</text>
              <text x={cx} y="332" fill="#0f172a" fontSize="13" textAnchor="middle" fontWeight="700">{diputados.length}</text>
              <text x={cx} y="344" fill="#64748b" fontSize="10" textAnchor="middle">escaños</text>
            </svg>
          </div>

          {/* Panel info */}
          <div style={{ width: 210, paddingTop: 20, flexShrink: 0 }}>
            {sel ? (
              <div style={styles.infoCard}>
                <div style={{ ...styles.partidoBadge, background: PARTIDO_COLORS[sel.partido] || '#94a3b8' }}>
                  {sel.partido}
                </div>
                <div style={styles.infoNombre}>{sel.nombre}</div>
                <div style={styles.infoSub}>📍 {sel.region}</div>
                <div style={styles.infoSub}>Distrito {sel.distrito}</div>
                <div style={{ ...styles.infoBloque, color: sel.bloque === 'Oficialismo' ? '#b45309' : sel.bloque === 'Oposición' ? '#1e40af' : '#6b7280' }}>
                  {sel.bloque === 'Oficialismo' ? '🔵' : sel.bloque === 'Oposición' ? '🔴' : '⚪'} {sel.bloque}
                </div>
                {sel.votos && (
                  <div style={styles.infoVotos}>
                    🗳 {sel.votos.toLocaleString('es-CL')} votos · {sel.porcentaje}
                  </div>
                )}
                <button onClick={() => setSel(null)} style={styles.closeBtn}>✕ Cerrar</button>
              </div>
            ) : (
              <div style={styles.emptyPanel}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏢</div>
                <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>Haz clic en<br />un escaño</div>
              </div>
            )}
          </div>
        </div>

        {/* Leyenda */}
        <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(PARTIDO_COLORS)
            .filter(([p]) => diputados.some(d => d.partido === p))
            .map(([partido, color]) => (
              <div key={partido} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#475569' }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, border: color === '#e5e7eb' ? '1px solid #ccc' : 'none' }} />
                {partido}
              </div>
            ))}
        </div>
      </div>

      {/* DISTRIBUCIÓN */}
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

      {/* TABLA */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Lista de Diputadas y Diputados</div>
        <div style={styles.filtersRow}>
          <input placeholder="🔍 Buscar diputado..." value={busqueda}
            onChange={e => setBusqueda(e.target.value)} style={styles.input} />
          <select value={filtroBloque} onChange={e => setFiltroBloque(e.target.value)} style={styles.select}>
            <option>Todos</option><option>Oficialismo</option><option>Oposición</option><option>Independiente</option>
          </select>
          <select value={filtroPartido} onChange={e => setFiltroPartido(e.target.value)} style={styles.select}>
            <option value="Todos">Todos los partidos</option>
            {PARTIDOS_UNICOS.map(p => <option key={p}>{p}</option>)}
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
            <div>D°</div>
            <div>Votos</div>
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
              <div style={{ color: '#64748b', fontSize: 11 }}>{d.votos?.toLocaleString('es-CL')} ({d.porcentaje})</div>
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
  cardSubtitle: { fontSize: 12, color: '#94a3b8', marginBottom: 16 },
  infoCard: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 14px' },
  emptyPanel: { height: 160, border: '1.5px dashed #e2e8f0', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  partidoBadge: { display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, color: 'white', marginBottom: 8 },
  infoNombre: { fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.3, marginBottom: 6 },
  infoSub: { fontSize: 12, color: '#475569', marginBottom: 3 },
  infoBloque: { fontSize: 11, fontWeight: 700, marginBottom: 6, marginTop: 4 },
  infoVotos: { fontSize: 12, color: '#059669', fontWeight: 600, background: '#f0fdf4', padding: '4px 8px', borderRadius: 6, marginBottom: 10 },
  closeBtn: { background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '5px 12px', color: '#64748b', cursor: 'pointer', fontSize: 11, width: '100%', marginTop: 4 },
  filtersRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 },
  input: { flex: 2, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: "'Inter', sans-serif", minWidth: 180 },
  select: { padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: "'Inter', sans-serif", background: 'white', color: '#475569' },
  table: { borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' },
  tableHeader: { display: 'flex', gap: 12, padding: '10px 16px', background: '#f8fafc', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { display: 'flex', gap: 12, padding: '10px 16px', fontSize: 13, alignItems: 'center', borderTop: '1px solid #f1f5f9' },
}
