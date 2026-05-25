import { useState } from 'react'
import { diputados, PARTIDO_COLORS } from '../data'

const TOTAL = 155

const QUORUMS = [
  {
    id: 'ordinaria',
    nombre: 'Ley Ordinaria',
    descripcion: 'Mayoría de los diputados presentes en sala',
    articulo: 'Art. 66 inc. 1° CPR',
    votos: Math.ceil(TOTAL / 2) + 1,
    nota: 'Requiere mayoría simple de los presentes. El quórum de sala es 1/3 de los diputados en ejercicio (52). En la práctica se vota con los presentes.',
    color: '#3b82f6',
    icono: '📜',
  },
  {
    id: 'calificado',
    nombre: 'Ley de Quórum Calificado',
    descripcion: 'Mayoría absoluta de los diputados en ejercicio',
    articulo: 'Art. 66 inc. 2° CPR',
    votos: Math.ceil(TOTAL / 2) + 1,
    nota: 'Materias como actividades estratégicas del Estado, seguridad nacional, etc. Requiere 78 votos de 155.',
    color: '#8b5cf6',
    icono: '⚖️',
  },
  {
    id: 'loc',
    nombre: 'Ley Orgánica Constitucional',
    descripcion: '4/7 de los diputados en ejercicio',
    articulo: 'Art. 66 inc. 3° CPR',
    votos: Math.ceil(TOTAL * 4 / 7),
    nota: 'Requiere 89 votos de 155. Aplica a leyes sobre el Congreso, Tribunal Constitucional, Fuerzas Armadas, etc.',
    color: '#f59e0b',
    icono: '🏛',
  },
  {
    id: 'interpretativa',
    nombre: 'Ley Interpretativa de la CPR',
    descripcion: '3/5 de los diputados en ejercicio',
    articulo: 'Art. 66 inc. 4° CPR',
    votos: Math.ceil(TOTAL * 3 / 5),
    nota: 'Requiere 93 votos de 155. Leyes que interpretan preceptos de la Constitución.',
    color: '#06b6d4',
    icono: '📖',
  },
  {
    id: 'reforma_3_5',
    nombre: 'Reforma Constitucional (3/5)',
    descripcion: '3/5 de los diputados en ejercicio',
    articulo: 'Art. 127 CPR',
    votos: Math.ceil(TOTAL * 3 / 5),
    nota: 'Requiere 93 votos. Aplica a la mayoría de los capítulos de la Constitución.',
    color: '#10b981',
    icono: '📋',
  },
  {
    id: 'reforma_2_3',
    nombre: 'Reforma Constitucional (2/3)',
    descripcion: '2/3 de los diputados en ejercicio',
    articulo: 'Art. 127 CPR',
    votos: Math.ceil(TOTAL * 2 / 3),
    nota: 'Requiere 104 votos. Aplica a capítulos I, III, VIII, XI, XII y XV de la Constitución.',
    color: '#ef4444',
    icono: '⚠️',
  },
]

const PARTIDOS_OP = ['PS', 'PPD', 'PDC', 'PC', 'FA', 'FREVS', 'Liberal', 'AH', 'DEM']
const PARTIDOS_OF = ['RN', 'UDI', 'Republicano', 'Evópoli', 'PNL', 'PSC']
const PARTIDOS_IND = ['PDG', 'Independiente']

function getByPartido(partido) {
  return diputados.filter(d => d.partido === partido).length
}

export default function SimuladorQuorum() {
  const [quorumSel, setQuorumSel] = useState(null)
  const [votosOp, setVotosOp] = useState({})
  const [votosOf, setVotosOf] = useState({})
  const [votosInd, setVotosInd] = useState({})

  const totalOp = diputados.filter(d => d.bloque === 'Oposición').length
  const totalOf = diputados.filter(d => d.bloque === 'Oficialismo').length
  const totalInd = diputados.filter(d => d.bloque === 'Independiente').length

  // Sumar votos ingresados
  const sumaOp = Object.values(votosOp).reduce((a, b) => a + (parseInt(b) || 0), 0)
  const sumaOf = Object.values(votosOf).reduce((a, b) => a + (parseInt(b) || 0), 0)
  const sumaInd = Object.values(votosInd).reduce((a, b) => a + (parseInt(b) || 0), 0)
  const totalVotos = sumaOp + sumaOf + sumaInd

  const necesarios = quorumSel?.votos || 0
  const faltan = Math.max(0, necesarios - totalVotos)
  const alcanza = totalVotos >= necesarios

  function handleVoto(bloque, partido, valor) {
    const max = getByPartido(partido)
    const v = Math.min(Math.max(0, parseInt(valor) || 0), max)
    if (bloque === 'op') setVotosOp(prev => ({ ...prev, [partido]: v }))
    else if (bloque === 'of') setVotosOf(prev => ({ ...prev, [partido]: v }))
    else setVotosInd(prev => ({ ...prev, [partido]: v }))
  }

  function resetear() {
    setVotosOp({})
    setVotosOf({})
    setVotosInd({})
  }

  function completarBloque(bloque) {
    if (bloque === 'op') {
      const nuevo = {}
      PARTIDOS_OP.forEach(p => { if (getByPartido(p) > 0) nuevo[p] = getByPartido(p) })
      setVotosOp(nuevo)
    } else if (bloque === 'of') {
      const nuevo = {}
      PARTIDOS_OF.forEach(p => { if (getByPartido(p) > 0) nuevo[p] = getByPartido(p) })
      setVotosOf(nuevo)
    }
  }

  const pct = necesarios > 0 ? Math.min(100, (totalVotos / necesarios) * 100) : 0

  return (
    <div>
      {/* HEADER */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>⚖️ Simulador de Quórums Legislativos</div>
        <div style={styles.cardSubtitle}>
          Selecciona el tipo de ley, luego indica cuántos diputados de cada partido votarían a favor para calcular si se alcanza el quórum.
        </div>

        {/* TIPOS DE LEY */}
        <div style={styles.quorumGrid}>
          {QUORUMS.map(q => (
            <div key={q.id}
              onClick={() => { setQuorumSel(q); resetear() }}
              style={{
                ...styles.quorumCard,
                border: quorumSel?.id === q.id ? `2px solid ${q.color}` : '2px solid #e2e8f0',
                background: quorumSel?.id === q.id ? `${q.color}10` : 'white',
                cursor: 'pointer',
              }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{q.icono}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4, lineHeight: 1.2 }}>{q.nombre}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{q.descripcion}</div>
              <div style={{ ...styles.votosBadge, background: q.color }}>
                {q.votos} votos de {TOTAL}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{q.articulo}</div>
            </div>
          ))}
        </div>
      </div>

      {quorumSel && (
        <>
          {/* RESULTADO */}
          <div style={{ ...styles.card, border: `2px solid ${alcanza ? '#10b981' : '#f59e0b'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>{quorumSel.nombre} · {quorumSel.articulo}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: alcanza ? '#10b981' : '#0f172a' }}>
                  {totalVotos} <span style={{ fontSize: 16, color: '#64748b' }}>de {necesarios} necesarios</span>
                </div>
                <div style={{ fontSize: 13, marginTop: 4, color: alcanza ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                  {alcanza ? `✅ Quórum alcanzado (sobran ${totalVotos - necesarios} votos)` : `⚠️ Faltan ${faltan} votos para alcanzar el quórum`}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Composición de votos</div>
                <div style={{ fontSize: 12, color: '#dc2626' }}>🔴 Oposición: {sumaOp}</div>
                <div style={{ fontSize: 12, color: '#b45309' }}>🔵 Oficialismo: {sumaOf}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>⚪ Independientes: {sumaInd}</div>
              </div>
            </div>

            {/* Barra de progreso */}
            <div style={{ marginTop: 16, height: 12, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: alcanza ? '#10b981' : quorumSel.color,
                borderRadius: 10,
                transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
              <span>0</span>
              <span>{necesarios} (quórum)</span>
              <span>{TOTAL}</span>
            </div>

            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, fontStyle: 'italic' }}>{quorumSel.nota}</div>
          </div>

          {/* INGRESO DE VOTOS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

            {/* OPOSICIÓN */}
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ ...styles.cardTitle, color: '#1e40af' }}>🔴 Oposición</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{totalOp} diputados · {sumaOp} seleccionados</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => completarBloque('op')} style={styles.btnSmall}>Todos</button>
                  <button onClick={() => setVotosOp({})} style={{ ...styles.btnSmall, background: '#fde8e8', color: '#dc2626' }}>Limpiar</button>
                </div>
              </div>
              {PARTIDOS_OP.filter(p => getByPartido(p) > 0).map(p => (
                <div key={p} style={styles.partidoRow}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: PARTIDO_COLORS[p] || '#94a3b8', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>{p}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>({getByPartido(p)})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number" min="0" max={getByPartido(p)}
                      value={votosOp[p] ?? ''}
                      onChange={e => handleVoto('op', p, e.target.value)}
                      style={styles.inputNum}
                      placeholder="0"
                    />
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>/ {getByPartido(p)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* OFICIALISMO */}
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ ...styles.cardTitle, color: '#b45309' }}>🔵 Oficialismo</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{totalOf} diputados · {sumaOf} seleccionados</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => completarBloque('of')} style={styles.btnSmall}>Todos</button>
                  <button onClick={() => setVotosOf({})} style={{ ...styles.btnSmall, background: '#fde8e8', color: '#dc2626' }}>Limpiar</button>
                </div>
              </div>
              {PARTIDOS_OF.filter(p => getByPartido(p) > 0).map(p => (
                <div key={p} style={styles.partidoRow}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: PARTIDO_COLORS[p] || '#94a3b8', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>{p}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>({getByPartido(p)})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number" min="0" max={getByPartido(p)}
                      value={votosOf[p] ?? ''}
                      onChange={e => handleVoto('of', p, e.target.value)}
                      style={styles.inputNum}
                      placeholder="0"
                    />
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>/ {getByPartido(p)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* INDEPENDIENTES */}
          <div style={{ ...styles.card, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ ...styles.cardTitle, color: '#6b7280' }}>⚪ Independientes y PDG</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{totalInd} diputados · {sumaInd} seleccionados</div>
              </div>
              <button onClick={() => setVotosInd({})} style={{ ...styles.btnSmall, background: '#fde8e8', color: '#dc2626' }}>Limpiar</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {PARTIDOS_IND.filter(p => getByPartido(p) > 0).map(p => (
                <div key={p} style={styles.partidoRow}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: PARTIDO_COLORS[p] || '#94a3b8', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>{p}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>({getByPartido(p)})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number" min="0" max={getByPartido(p)}
                      value={votosInd[p] ?? ''}
                      onChange={e => handleVoto('ind', p, e.target.value)}
                      style={styles.inputNum}
                      placeholder="0"
                    />
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>/ {getByPartido(p)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* TABLA REFERENCIA */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Tabla de referencia de quórums</div>
        <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', padding: '10px 16px', background: '#f8fafc', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <div style={{ flex: 2 }}>Tipo de ley</div>
            <div style={{ width: 100 }}>Fracción</div>
            <div style={{ width: 80 }}>Votos</div>
            <div style={{ flex: 2 }}>Base constitucional</div>
          </div>
          {QUORUMS.map((q, i) => (
            <div key={q.id} style={{ display: 'flex', padding: '10px 16px', fontSize: 13, alignItems: 'center', background: i % 2 === 0 ? 'white' : '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{q.icono}</span>
                <span style={{ fontWeight: 500 }}>{q.nombre}</span>
              </div>
              <div style={{ width: 100, color: '#64748b' }}>{q.descripcion.split(' ')[0] === 'Mayoría' ? 'Mayoría' : q.descripcion.split(' ')[0]}</div>
              <div style={{ width: 80 }}>
                <span style={{ ...styles.votosBadge, background: q.color }}>{q.votos}</span>
              </div>
              <div style={{ flex: 2, fontSize: 12, color: '#94a3b8' }}>{q.articulo}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles = {
  card: { background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 20 },
  quorumGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 },
  quorumCard: { borderRadius: 10, padding: '16px 14px', textAlign: 'center', transition: 'all 0.15s' },
  votosBadge: { display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, color: 'white' },
  partidoRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' },
  inputNum: { width: 56, padding: '5px 8px', borderRadius: 6, border: '1.5px solid #e2e8f0', fontSize: 14, textAlign: 'center', fontFamily: "'Inter', sans-serif" },
  btnSmall: { padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#475569', fontFamily: "'Inter', sans-serif" },
}
