import { useState } from 'react'
import { diputados, senadores, PARTIDO_COLORS } from '../data'

const TOTAL_DIP = 155
const TOTAL_SEN = 50

const QUORUMS_DIP = [
  { id: 'ordinaria', nombre: 'Ley Ordinaria', descripcion: 'Mayoría de los miembros presentes', articulo: 'Art. 56 CPR', votos: 78, nota: 'Se aprueba por la mayoría de los diputados presentes. Con los 155 en la Sala se requieren 78 votos (mitad más uno). El quórum mínimo para sesionar es 1/3 de los diputados en ejercicio.', color: '#3b82f6', icono: '📜' },
  { id: 'calificado', nombre: 'Ley de Quórum Calificado', descripcion: 'Mayoría absoluta de los diputados en ejercicio', articulo: 'Art. 66 inc. 2° CPR', votos: 78, nota: 'Requiere 78 votos de 155 (mitad más uno). Aplica a materias como nacionalización, actividades estratégicas del Estado, seguridad nacional, entre otras.', color: '#8b5cf6', icono: '⚖️' },
  { id: 'loc', nombre: 'Ley Orgánica Constitucional', descripcion: 'Mayoría absoluta de los diputados en ejercicio', articulo: 'Art. 66 inc. 3° CPR (mod. Ley 21.773, 2024)', votos: 78, nota: 'Requiere 78 votos de 155. Rebajada de 4/7 a mayoría absoluta por la Reforma Constitucional Ley N°21.773 (2024).', color: '#f59e0b', icono: '🏛' },
  { id: 'interpretativa', nombre: 'Ley Interpretativa de la CPR', descripcion: '3/5 de los diputados en ejercicio', articulo: 'Art. 66 inc. 4° CPR', votos: 93, nota: 'Requiere 93 votos de 155. Leyes que interpretan preceptos de la Constitución.', color: '#06b6d4', icono: '📖' },
  { id: 'reforma_4_7', nombre: 'Reforma Constitucional (4/7)', descripcion: '4/7 de los diputados en ejercicio', articulo: 'Art. 127 CPR (mod. Ley 21.773, 2024)', votos: 89, nota: 'Requiere 89 votos de 155. Rebajada de 3/5 a 4/7 por Ley N°21.773 (2024). Aplica a la mayoría de los capítulos de la Constitución.', color: '#10b981', icono: '📋' },
  { id: 'reforma_3_5', nombre: 'Reforma Constitucional (3/5)', descripcion: '3/5 de los diputados en ejercicio', articulo: 'Art. 127 CPR', votos: 93, nota: 'Requiere 93 votos de 155. Aplica a capítulos especiales: I (Bases), III (Derechos), VIII (TC), XI (FFAA), XII (COSENA) y XV (Reforma).', color: '#ef4444', icono: '⚠️' },
]

const QUORUMS_SEN = [
  { id: 'ordinaria', nombre: 'Ley Ordinaria', descripcion: 'Mayoría de los miembros presentes', articulo: 'Art. 56 CPR', votos: 26, nota: 'Se aprueba por la mayoría de los senadores presentes. Con los 50 en la Sala se requieren 26 votos (mitad más uno). El quórum mínimo para sesionar es 1/3 de los senadores en ejercicio.', color: '#3b82f6', icono: '📜' },
  { id: 'calificado', nombre: 'Ley de Quórum Calificado', descripcion: 'Mayoría absoluta de los senadores en ejercicio', articulo: 'Art. 66 inc. 2° CPR', votos: 26, nota: 'Requiere 26 votos de 50 (mitad más uno). Aplica a materias como nacionalización, actividades estratégicas del Estado, seguridad nacional, entre otras.', color: '#8b5cf6', icono: '⚖️' },
  { id: 'loc', nombre: 'Ley Orgánica Constitucional', descripcion: 'Mayoría absoluta de los senadores en ejercicio', articulo: 'Art. 66 inc. 3° CPR (mod. Ley 21.773, 2024)', votos: 26, nota: 'Requiere 26 votos de 50. Rebajada de 4/7 a mayoría absoluta por la Reforma Constitucional Ley N°21.773 (2024).', color: '#f59e0b', icono: '🏛' },
  { id: 'interpretativa', nombre: 'Ley Interpretativa de la CPR', descripcion: '3/5 de los senadores en ejercicio', articulo: 'Art. 66 inc. 4° CPR', votos: 30, nota: 'Requiere 30 votos de 50. Leyes que interpretan preceptos de la Constitución.', color: '#06b6d4', icono: '📖' },
  { id: 'reforma_4_7', nombre: 'Reforma Constitucional (4/7)', descripcion: '4/7 de los senadores en ejercicio', articulo: 'Art. 127 CPR (mod. Ley 21.773, 2024)', votos: 29, nota: 'Requiere 29 votos de 50. Rebajada de 3/5 a 4/7 por Ley N°21.773 (2024). Aplica a la mayoría de los capítulos de la Constitución.', color: '#10b981', icono: '📋' },
  { id: 'reforma_3_5', nombre: 'Reforma Constitucional (3/5)', descripcion: '3/5 de los senadores en ejercicio', articulo: 'Art. 127 CPR', votos: 30, nota: 'Requiere 30 votos de 50. Aplica a capítulos especiales: I (Bases), III (Derechos), VIII (TC), XI (FFAA), XII (COSENA) y XV (Reforma).', color: '#ef4444', icono: '⚠️' },
]

function SimuladorCamara() {
  const [quorumSel, setQuorumSel] = useState(null)
  const [seleccionados, setSeleccionados] = useState({})
  const [busqueda, setBusqueda] = useState('')
  const [filtroBloque, setFiltroBloque] = useState('Todos')
  const [filtroPartido, setFiltroPartido] = useState('Todos')

  const partidos = [...new Set(diputados.map(d => d.partido))].sort()

  const filtrados = diputados.filter(d => {
    const q = busqueda.toLowerCase()
    return d.nombre.toLowerCase().includes(q)
      && (filtroBloque === 'Todos' || d.bloque === filtroBloque)
      && (filtroPartido === 'Todos' || d.partido === filtroPartido)
  })

  const totalVotos = Object.values(seleccionados).filter(Boolean).length
  const necesarios = quorumSel?.votos || 0
  const faltan = Math.max(0, necesarios - totalVotos)
  const alcanza = necesarios > 0 && totalVotos >= necesarios
  const pct = necesarios > 0 ? Math.min(100, (totalVotos / necesarios) * 100) : 0

  const opVotos = diputados.filter(d => seleccionados[d.nombre] && d.bloque === 'Oposición').length
  const ofVotos = diputados.filter(d => seleccionados[d.nombre] && d.bloque === 'Oficialismo').length
  const indVotos = diputados.filter(d => seleccionados[d.nombre] && d.bloque === 'Independiente').length

  function toggle(nombre) {
    setSeleccionados(prev => ({ ...prev, [nombre]: !prev[nombre] }))
  }
  function seleccionarBloque(bloque) {
    const nuevo = { ...seleccionados }
    diputados.filter(d => d.bloque === bloque).forEach(d => { nuevo[d.nombre] = true })
    setSeleccionados(nuevo)
  }
  function limpiarBloque(bloque) {
    const nuevo = { ...seleccionados }
    diputados.filter(d => d.bloque === bloque).forEach(d => { nuevo[d.nombre] = false })
    setSeleccionados(nuevo)
  }
  function limpiarTodo() { setSeleccionados({}) }

  return (
    <div>
      {/* Tipos de ley */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>🏢 Simulador — Cámara de Diputadas y Diputados</div>
        <div style={styles.cardSubtitle}>Selecciona el tipo de ley y luego marca los diputados que votarían a favor.</div>
        <div style={styles.quorumGrid}>
          {QUORUMS_DIP.map(q => (
            <div key={q.id} onClick={() => { setQuorumSel(q); limpiarTodo() }}
              style={{ ...styles.quorumCard, border: quorumSel?.id === q.id ? `2px solid ${q.color}` : '2px solid #e2e8f0', background: quorumSel?.id === q.id ? `${q.color}15` : 'white', cursor: 'pointer' }}>
              <div style={{ fontSize: 22, marginBottom: 5 }}>{q.icono}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 4, lineHeight: 1.2 }}>{q.nombre}</div>
              <div style={{ ...styles.votosBadge, background: q.color }}>{q.votos} votos de {TOTAL_DIP}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{q.articulo}</div>
            </div>
          ))}
        </div>
      </div>

      {quorumSel && (
        <>
          {/* Resultado */}
          <div style={{ ...styles.card, border: `2px solid ${alcanza ? '#10b981' : '#f59e0b'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{quorumSel.nombre} · {quorumSel.articulo}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: alcanza ? '#10b981' : '#0f172a' }}>
                  {totalVotos} <span style={{ fontSize: 16, color: '#64748b' }}>de {necesarios} necesarios</span>
                </div>
                <div style={{ fontSize: 13, marginTop: 4, fontWeight: 600, color: alcanza ? '#10b981' : '#f59e0b' }}>
                  {alcanza ? `✅ Quórum alcanzado (sobran ${totalVotos - necesarios} votos)` : necesarios > 0 ? `⚠️ Faltan ${faltan} votos` : ''}
                </div>
              </div>
              <div style={{ fontSize: 12 }}>
                <div style={{ color: '#dc2626' }}>🔴 Oposición: {opVotos}</div>
                <div style={{ color: '#b45309' }}>🔵 Oficialismo: {ofVotos}</div>
                <div style={{ color: '#6b7280' }}>⚪ Independientes: {indVotos}</div>
              </div>
            </div>
            <div style={{ marginTop: 12, height: 10, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: alcanza ? '#10b981' : quorumSel.color, borderRadius: 10, transition: 'width 0.2s' }} />
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, fontStyle: 'italic' }}>{quorumSel.nota}</div>
          </div>

          {/* Acciones rápidas */}
          <div style={{ ...styles.card, padding: '16px 24px' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Selección rápida:</span>
              <button onClick={() => seleccionarBloque('Oposición')} style={styles.btnBloque('#dc2626')}>+ Toda la Oposición ({diputados.filter(d=>d.bloque==='Oposición').length})</button>
              <button onClick={() => limpiarBloque('Oposición')} style={styles.btnBloqueOut('#dc2626')}>− Oposición</button>
              <button onClick={() => seleccionarBloque('Oficialismo')} style={styles.btnBloque('#1d6fce')}>+ Todo el Oficialismo ({diputados.filter(d=>d.bloque==='Oficialismo').length})</button>
              <button onClick={() => limpiarBloque('Oficialismo')} style={styles.btnBloqueOut('#1d6fce')}>− Oficialismo</button>
              <button onClick={limpiarTodo} style={{ ...styles.btnSmall, background: '#fde8e8', color: '#dc2626' }}>Limpiar todo</button>
            </div>
          </div>

          {/* Lista de diputados */}
          <div style={styles.card}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <input placeholder="🔍 Buscar diputado..." value={busqueda}
                onChange={e => setBusqueda(e.target.value)} style={styles.input} />
              <select value={filtroBloque} onChange={e => setFiltroBloque(e.target.value)} style={styles.select}>
                <option>Todos</option><option>Oposición</option><option>Oficialismo</option><option>Independiente</option>
              </select>
              <select value={filtroPartido} onChange={e => setFiltroPartido(e.target.value)} style={styles.select}>
                <option value="Todos">Todos los partidos</option>
                {partidos.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{filtrados.length} diputados · {totalVotos} seleccionados</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 4 }}>
              {filtrados.map(d => (
                <div key={d.nombre}
                  onClick={() => toggle(d.nombre)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                    borderRadius: 7, cursor: 'pointer', transition: 'all 0.1s',
                    background: seleccionados[d.nombre] ? `${PARTIDO_COLORS[d.partido] || '#94a3b8'}18` : '#f8fafc',
                    border: seleccionados[d.nombre] ? `1.5px solid ${PARTIDO_COLORS[d.partido] || '#94a3b8'}` : '1.5px solid #f1f5f9',
                  }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    background: seleccionados[d.nombre] ? (PARTIDO_COLORS[d.partido] || '#94a3b8') : 'white',
                    border: `2px solid ${PARTIDO_COLORS[d.partido] || '#94a3b8'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color: 'white', fontWeight: 700,
                  }}>
                    {seleccionados[d.nombre] ? '✓' : ''}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.nombre}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{d.partido} · D{d.distrito}</div>
                  </div>
                  <div style={{ ...styles.miniBadge, background: PARTIDO_COLORS[d.partido] || '#94a3b8' }}>{d.partido}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Tabla referencia */}
      <TablaReferencia quorums={QUORUMS_DIP} total={TOTAL_DIP} />
    </div>
  )
}

function SimuladorSenado() {
  const [quorumSel, setQuorumSel] = useState(null)
  const [seleccionados, setSeleccionados] = useState({})
  const [busqueda, setBusqueda] = useState('')
  const [filtroBloque, setFiltroBloque] = useState('Todos')

  const filtrados = senadores.filter(s => {
    const q = busqueda.toLowerCase()
    return s.nombre.toLowerCase().includes(q)
      && (filtroBloque === 'Todos' || s.bloque === filtroBloque)
  })

  const totalVotos = Object.values(seleccionados).filter(Boolean).length
  const necesarios = quorumSel?.votos || 0
  const faltan = Math.max(0, necesarios - totalVotos)
  const alcanza = necesarios > 0 && totalVotos >= necesarios
  const pct = necesarios > 0 ? Math.min(100, (totalVotos / necesarios) * 100) : 0

  const opVotos = senadores.filter(s => seleccionados[s.nombre] && s.bloque === 'Oposición').length
  const ofVotos = senadores.filter(s => seleccionados[s.nombre] && s.bloque === 'Oficialismo').length

  function toggle(nombre) { setSeleccionados(prev => ({ ...prev, [nombre]: !prev[nombre] })) }
  function seleccionarBloque(bloque) {
    const nuevo = { ...seleccionados }
    senadores.filter(s => s.bloque === bloque).forEach(s => { nuevo[s.nombre] = true })
    setSeleccionados(nuevo)
  }
  function limpiarBloque(bloque) {
    const nuevo = { ...seleccionados }
    senadores.filter(s => s.bloque === bloque).forEach(s => { nuevo[s.nombre] = false })
    setSeleccionados(nuevo)
  }
  function limpiarTodo() { setSeleccionados({}) }

  return (
    <div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>🏛 Simulador — Senado de la República</div>
        <div style={styles.cardSubtitle}>Selecciona el tipo de ley y luego marca los senadores que votarían a favor.</div>
        <div style={styles.quorumGrid}>
          {QUORUMS_SEN.map(q => (
            <div key={q.id} onClick={() => { setQuorumSel(q); limpiarTodo() }}
              style={{ ...styles.quorumCard, border: quorumSel?.id === q.id ? `2px solid ${q.color}` : '2px solid #e2e8f0', background: quorumSel?.id === q.id ? `${q.color}15` : 'white', cursor: 'pointer' }}>
              <div style={{ fontSize: 22, marginBottom: 5 }}>{q.icono}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 4, lineHeight: 1.2 }}>{q.nombre}</div>
              <div style={{ ...styles.votosBadge, background: q.color }}>{q.votos} votos de {TOTAL_SEN}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{q.articulo}</div>
            </div>
          ))}
        </div>
      </div>

      {quorumSel && (
        <>
          <div style={{ ...styles.card, border: `2px solid ${alcanza ? '#10b981' : '#f59e0b'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{quorumSel.nombre} · {quorumSel.articulo}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: alcanza ? '#10b981' : '#0f172a' }}>
                  {totalVotos} <span style={{ fontSize: 16, color: '#64748b' }}>de {necesarios} necesarios</span>
                </div>
                <div style={{ fontSize: 13, marginTop: 4, fontWeight: 600, color: alcanza ? '#10b981' : '#f59e0b' }}>
                  {alcanza ? `✅ Quórum alcanzado (sobran ${totalVotos - necesarios} votos)` : necesarios > 0 ? `⚠️ Faltan ${faltan} votos` : ''}
                </div>
              </div>
              <div style={{ fontSize: 12 }}>
                <div style={{ color: '#dc2626' }}>🔴 Oposición: {opVotos}</div>
                <div style={{ color: '#b45309' }}>🔵 Oficialismo: {ofVotos}</div>
              </div>
            </div>
            <div style={{ marginTop: 12, height: 10, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: alcanza ? '#10b981' : quorumSel.color, borderRadius: 10, transition: 'width 0.2s' }} />
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, fontStyle: 'italic' }}>{quorumSel.nota}</div>
          </div>

          <div style={{ ...styles.card, padding: '16px 24px' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Selección rápida:</span>
              <button onClick={() => seleccionarBloque('Oposición')} style={styles.btnBloque('#dc2626')}>+ Toda la Oposición ({senadores.filter(s=>s.bloque==='Oposición').length})</button>
              <button onClick={() => limpiarBloque('Oposición')} style={styles.btnBloqueOut('#dc2626')}>− Oposición</button>
              <button onClick={() => seleccionarBloque('Oficialismo')} style={styles.btnBloque('#1d6fce')}>+ Todo el Oficialismo ({senadores.filter(s=>s.bloque==='Oficialismo').length})</button>
              <button onClick={() => limpiarBloque('Oficialismo')} style={styles.btnBloqueOut('#1d6fce')}>− Oficialismo</button>
              <button onClick={limpiarTodo} style={{ ...styles.btnSmall, background: '#fde8e8', color: '#dc2626' }}>Limpiar todo</button>
            </div>
          </div>

          <div style={styles.card}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <input placeholder="🔍 Buscar senador..." value={busqueda}
                onChange={e => setBusqueda(e.target.value)} style={styles.input} />
              <select value={filtroBloque} onChange={e => setFiltroBloque(e.target.value)} style={styles.select}>
                <option>Todos</option><option>Oposición</option><option>Oficialismo</option>
              </select>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{filtrados.length} senadores · {totalVotos} seleccionados</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 4 }}>
              {filtrados.map(s => (
                <div key={s.nombre}
                  onClick={() => toggle(s.nombre)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                    borderRadius: 7, cursor: 'pointer', transition: 'all 0.1s',
                    background: seleccionados[s.nombre] ? `${PARTIDO_COLORS[s.partido] || '#94a3b8'}18` : '#f8fafc',
                    border: seleccionados[s.nombre] ? `1.5px solid ${PARTIDO_COLORS[s.partido] || '#94a3b8'}` : '1.5px solid #f1f5f9',
                  }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    background: seleccionados[s.nombre] ? (PARTIDO_COLORS[s.partido] || '#94a3b8') : 'white',
                    border: `2px solid ${PARTIDO_COLORS[s.partido] || '#94a3b8'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color: 'white', fontWeight: 700,
                  }}>
                    {seleccionados[s.nombre] ? '✓' : ''}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nombre}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{s.partido} · {s.cargo}</div>
                  </div>
                  <div style={{ ...styles.miniBadge, background: PARTIDO_COLORS[s.partido] || '#94a3b8' }}>{s.partido}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <TablaReferencia quorums={QUORUMS_SEN} total={TOTAL_SEN} />
    </div>
  )
}

function TablaReferencia({ quorums, total }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Tabla de referencia de quórums</div>
      <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', padding: '10px 16px', background: '#f8fafc', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          <div style={{ flex: 2 }}>Tipo de ley</div>
          <div style={{ width: 80 }}>Votos</div>
          <div style={{ flex: 2 }}>Base constitucional</div>
        </div>
        {quorums.map((q, i) => (
          <div key={q.id} style={{ display: 'flex', padding: '10px 16px', fontSize: 13, alignItems: 'center', background: i % 2 === 0 ? 'white' : '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{q.icono}</span>
              <span style={{ fontWeight: 500 }}>{q.nombre}</span>
            </div>
            <div style={{ width: 80 }}>
              <span style={{ ...styles.votosBadge, background: q.color }}>{q.votos} / {total}</span>
            </div>
            <div style={{ flex: 2, fontSize: 12, color: '#94a3b8' }}>{q.articulo}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SimuladorQuorum() {
  const [camara, setCamara] = useState('diputados')

  return (
    <div>
      <div style={{ ...styles.card, padding: '16px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setCamara('diputados')}
            style={{ ...styles.tabBtn, background: camara === 'diputados' ? '#1e40af' : '#f1f5f9', color: camara === 'diputados' ? 'white' : '#475569' }}>
            🏢 Cámara de Diputados
          </button>
          <button onClick={() => setCamara('senado')}
            style={{ ...styles.tabBtn, background: camara === 'senado' ? '#1e40af' : '#f1f5f9', color: camara === 'senado' ? 'white' : '#475569' }}>
            🏛 Senado
          </button>
        </div>
      </div>
      {camara === 'diputados' ? <SimuladorCamara /> : <SimuladorSenado />}
    </div>
  )
}

const styles = {
  card: { background: 'white', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 20 },
  quorumGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 },
  quorumCard: { borderRadius: 10, padding: '14px 12px', textAlign: 'center', transition: 'all 0.15s' },
  votosBadge: { display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, color: 'white' },
  miniBadge: { display: 'inline-block', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 6, color: 'white', flexShrink: 0 },
  input: { flex: 2, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: "'Inter', sans-serif", minWidth: 180 },
  select: { padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: "'Inter', sans-serif", background: 'white', color: '#475569' },
  btnSmall: { padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif" },
  tabBtn: { padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: "'Inter', sans-serif", transition: 'all 0.15s' },
  btnBloque: (color) => ({ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: color, color: 'white', fontFamily: "'Inter', sans-serif" }),
  btnBloqueOut: (color) => ({ padding: '5px 12px', borderRadius: 6, border: `1.5px solid ${color}`, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'white', color: color, fontFamily: "'Inter', sans-serif" }),
}
