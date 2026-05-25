import { useState } from 'react'
import { PARTIDO_COLORS } from '../data'

const VOTO_COLORS = {
  'A favor': '#10b981',
  'Afavor': '#10b981',
  'En contra': '#ef4444',
  'Abstención': '#f59e0b',
  'Abstencion': '#f59e0b',
  'Dispensado': '#94a3b8',
  'Ausente': '#e2e8f0',
}

const VOTO_LABELS = {
  'A favor': 'A favor',
  'Afavor': 'A favor',
  'En contra': 'En contra',
  'Abstención': 'Abstención',
  'Abstencion': 'Abstención',
  'Dispensado': 'Dispensado',
  'Ausente': 'Ausente',
}

export default function Votaciones() {
  const [modo, setModo] = useState('boletin') // boletin | fecha
  const [inputBoletin, setInputBoletin] = useState('')
  const [inputFecha, setInputFecha] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [votaciones, setVotaciones] = useState(null)
  const [sesiones, setSesiones] = useState(null)
  const [votacionSel, setVotacionSel] = useState(null)
  const [detalleVotos, setDetalleVotos] = useState(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [filtroVoto, setFiltroVoto] = useState('Todos')
  const [filtroPartido, setFiltroPartido] = useState('Todos')
  const [busquedaDip, setBusquedaDip] = useState('')

  async function buscarPorBoletin() {
    if (!inputBoletin.trim()) return
    setLoading(true)
    setError(null)
    setVotaciones(null)
    setVotacionSel(null)
    setDetalleVotos(null)
    try {
      const res = await fetch(`/api/votaciones?boletin=${inputBoletin.trim()}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (!data.votaciones?.length) throw new Error('No se encontraron votaciones para este boletín.')
      setVotaciones(data.votaciones)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function buscarPorFecha() {
    if (!inputFecha) return
    setLoading(true)
    setError(null)
    setSesiones(null)
    setVotaciones(null)
    setVotacionSel(null)
    setDetalleVotos(null)
    try {
      const res = await fetch(`/api/votaciones?fecha=${inputFecha}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      // Filtrar sesiones por la fecha exacta
      const fechaFiltro = inputFecha
      const sesionesFiltradas = (data.sesiones || []).filter(s => s.fecha?.startsWith(fechaFiltro))
      if (!sesionesFiltradas.length) throw new Error('No se encontraron sesiones para esa fecha.')
      setSesiones(sesionesFiltradas)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function cargarSesion(sesionId) {
    setLoading(true)
    setError(null)
    setVotaciones(null)
    setVotacionSel(null)
    setDetalleVotos(null)
    try {
      const res = await fetch(`/api/votaciones?sesionId=${sesionId}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (!data.votaciones?.length) throw new Error('Esta sesión no tiene votaciones registradas.')
      setVotaciones(data.votaciones)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function cargarDetalle(votacion) {
    setVotacionSel(votacion)
    setDetalleVotos(null)
    setFiltroVoto('Todos')
    setFiltroPartido('Todos')
    setBusquedaDip('')
    setLoadingDetalle(true)
    try {
      const res = await fetch(`/api/votaciones?votacionId=${votacion.id}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDetalleVotos(data)
    } catch (e) {
      setError(e.message)
    }
    setLoadingDetalle(false)
  }

  // Procesar votos con filtros
  const votosFiltr = detalleVotos?.votos?.filter(v => {
    const votoNorm = VOTO_LABELS[v.voto] || v.voto
    return (filtroVoto === 'Todos' || votoNorm === filtroVoto)
      && (filtroPartido === 'Todos' || v.partido === filtroPartido)
      && (busquedaDip === '' || v.diputado.toLowerCase().includes(busquedaDip.toLowerCase()))
  }) || []

  const partidosEnVotacion = detalleVotos ? [...new Set(detalleVotos.votos.map(v => v.partido).filter(Boolean))].sort() : []

  // Resumen por partido
  const resumenPartido = detalleVotos ? (() => {
    const map = {}
    detalleVotos.votos.forEach(v => {
      const p = v.partido || 'Sin partido'
      const voto = VOTO_LABELS[v.voto] || v.voto
      if (!map[p]) map[p] = { aFavor: 0, enContra: 0, abstencion: 0, otros: 0 }
      if (voto === 'A favor') map[p].aFavor++
      else if (voto === 'En contra') map[p].enContra++
      else if (voto === 'Abstención') map[p].abstencion++
      else map[p].otros++
    })
    return Object.entries(map).sort((a, b) => (b[1].aFavor + b[1].enContra) - (a[1].aFavor + a[1].enContra))
  })() : []

  return (
    <div>
      {/* BÚSQUEDA */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>🗳 Votaciones de Proyectos de Ley</div>
        <div style={styles.cardSubtitle}>Consulta cómo votó cada diputado en la Cámara. Datos en tiempo real desde la API oficial del Congreso.</div>

        {/* Tabs modo */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[['boletin', '🔢 Por boletín'], ['fecha', '📅 Por fecha de sesión']].map(([id, label]) => (
            <button key={id} onClick={() => { setModo(id); setError(null); setVotaciones(null); setSesiones(null); setVotacionSel(null); setDetalleVotos(null) }}
              style={{ ...styles.tabBtn, background: modo === id ? '#1e40af' : '#f1f5f9', color: modo === id ? 'white' : '#475569' }}>
              {label}
            </button>
          ))}
        </div>

        {modo === 'boletin' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={styles.label}>Número de boletín</label>
              <input
                value={inputBoletin}
                onChange={e => setInputBoletin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarPorBoletin()}
                placeholder="Ej: 15469-07 o 15469"
                style={styles.input}
              />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>El número aparece en el sistema de tramitación del Congreso</div>
            </div>
            <button onClick={buscarPorBoletin} disabled={loading || !inputBoletin.trim()} style={styles.btnPrimary}>
              {loading ? 'Buscando...' : 'Buscar votaciones'}
            </button>
          </div>
        )}

        {modo === 'fecha' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={styles.label}>Fecha de sesión</label>
              <input type="date" value={inputFecha} onChange={e => setInputFecha(e.target.value)}
                style={styles.input} />
            </div>
            <button onClick={buscarPorFecha} disabled={loading || !inputFecha} style={styles.btnPrimary}>
              {loading ? 'Buscando...' : 'Buscar sesiones'}
            </button>
          </div>
        )}

        {error && <div style={styles.error}>⚠️ {error}</div>}
      </div>

      {/* SESIONES por fecha */}
      {sesiones && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Sesiones del {inputFecha}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sesiones.map(s => (
              <div key={s.id} onClick={() => cargarSesion(s.id)}
                style={{ ...styles.sesionRow, cursor: 'pointer' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Sesión N° {s.numero} — {s.tipo}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{s.fecha} · ID: {s.id}</div>
                </div>
                <button style={styles.btnSecondary}>Ver votaciones →</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LISTA DE VOTACIONES */}
      {votaciones && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>{votaciones.length} votación{votaciones.length !== 1 ? 'es' : ''} encontrada{votaciones.length !== 1 ? 's' : ''}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {votaciones.map((v, i) => (
              <div key={v.id || i}
                onClick={() => cargarDetalle(v)}
                style={{
                  ...styles.votacionRow,
                  border: votacionSel?.id === v.id ? '2px solid #1e40af' : '1px solid #e2e8f0',
                  background: votacionSel?.id === v.id ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>{v.tema || 'Sin descripción'}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748b', flexWrap: 'wrap' }}>
                    {v.fecha && <span>📅 {v.fecha.split('T')[0]}</span>}
                    {v.quorum && <span>⚖️ {v.quorum}</span>}
                    {v.id && <span>ID: {v.id}</span>}
                  </div>
                </div>
                {v.resultado && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <span style={{ ...styles.votoBadge, background: '#10b981' }}>✓ {v.resultado.aFavor}</span>
                    <span style={{ ...styles.votoBadge, background: '#ef4444' }}>✗ {v.resultado.enContra}</span>
                    {v.resultado.abstencion > 0 && <span style={{ ...styles.votoBadge, background: '#f59e0b' }}>~ {v.resultado.abstencion}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DETALLE DE VOTACIÓN */}
      {votacionSel && (
        <div style={styles.card}>
          {loadingDetalle ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Cargando detalle de votación...</div>
          ) : detalleVotos ? (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={styles.cardTitle}>{detalleVotos.tema || votacionSel.tema}</div>
                {detalleVotos.fecha && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>📅 {detalleVotos.fecha.split('T')[0]}</div>}
              </div>

              {/* Resumen general */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                  { label: 'A favor', value: detalleVotos.resumen?.aFavor, color: '#10b981', icon: '✓' },
                  { label: 'En contra', value: detalleVotos.resumen?.enContra, color: '#ef4444', icon: '✗' },
                  { label: 'Abstención', value: detalleVotos.resumen?.abstencion, color: '#f59e0b', icon: '~' },
                ].map(s => (
                  <div key={s.label} style={{ background: `${s.color}15`, border: `1.5px solid ${s.color}30`, borderRadius: 10, padding: '12px 20px', textAlign: 'center', flex: 1, minWidth: 80 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.icon} {s.value}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Barra visual */}
              <div style={{ display: 'flex', height: 14, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                {detalleVotos.resumen?.aFavor > 0 && <div style={{ width: `${(detalleVotos.resumen.aFavor / detalleVotos.votos.length) * 100}%`, background: '#10b981' }} title={`A favor: ${detalleVotos.resumen.aFavor}`} />}
                {detalleVotos.resumen?.abstencion > 0 && <div style={{ width: `${(detalleVotos.resumen.abstencion / detalleVotos.votos.length) * 100}%`, background: '#f59e0b' }} title={`Abstención: ${detalleVotos.resumen.abstencion}`} />}
                {detalleVotos.resumen?.enContra > 0 && <div style={{ width: `${(detalleVotos.resumen.enContra / detalleVotos.votos.length) * 100}%`, background: '#ef4444' }} title={`En contra: ${detalleVotos.resumen.enContra}`} />}
              </div>

              {/* Resumen por partido */}
              {resumenPartido.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Desglose por partido</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {resumenPartido.map(([partido, r]) => (
                      <div key={partido} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f8fafc', borderRadius: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: PARTIDO_COLORS[partido] || '#94a3b8', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, width: 100, color: '#0f172a' }}>{partido}</span>
                        <div style={{ flex: 1, display: 'flex', gap: 4, height: 14, borderRadius: 6, overflow: 'hidden' }}>
                          {r.aFavor > 0 && <div style={{ width: `${(r.aFavor / (r.aFavor + r.enContra + r.abstencion + r.otros)) * 100}%`, background: '#10b981' }} title={`A favor: ${r.aFavor}`} />}
                          {r.abstencion > 0 && <div style={{ width: `${(r.abstencion / (r.aFavor + r.enContra + r.abstencion + r.otros)) * 100}%`, background: '#f59e0b' }} title={`Abstención: ${r.abstencion}`} />}
                          {r.enContra > 0 && <div style={{ width: `${(r.enContra / (r.aFavor + r.enContra + r.abstencion + r.otros)) * 100}%`, background: '#ef4444' }} title={`En contra: ${r.enContra}`} />}
                        </div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 12, flexShrink: 0 }}>
                          {r.aFavor > 0 && <span style={{ color: '#10b981', fontWeight: 600 }}>✓{r.aFavor}</span>}
                          {r.enContra > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>✗{r.enContra}</span>}
                          {r.abstencion > 0 && <span style={{ color: '#f59e0b', fontWeight: 600 }}>~{r.abstencion}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista individual */}
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Votos individuales</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <input placeholder="🔍 Buscar diputado..." value={busquedaDip}
                  onChange={e => setBusquedaDip(e.target.value)} style={{ ...styles.input, flex: 2, minWidth: 160 }} />
                <select value={filtroVoto} onChange={e => setFiltroVoto(e.target.value)} style={styles.select}>
                  <option value="Todos">Todos los votos</option>
                  <option value="A favor">A favor</option>
                  <option value="En contra">En contra</option>
                  <option value="Abstención">Abstención</option>
                </select>
                <select value={filtroPartido} onChange={e => setFiltroPartido(e.target.value)} style={styles.select}>
                  <option value="Todos">Todos los partidos</option>
                  {partidosEnVotacion.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{votosFiltr.length} de {detalleVotos.votos.length} votos</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6 }}>
                {votosFiltr.map((v, i) => {
                  const votoNorm = VOTO_LABELS[v.voto] || v.voto
                  const color = VOTO_COLORS[v.voto] || '#94a3b8'
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: `${color}10`, border: `1px solid ${color}30` }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: PARTIDO_COLORS[v.partido] || '#94a3b8', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.diputado}</div>
                        {v.partido && <div style={{ fontSize: 10, color: '#94a3b8' }}>{v.partido}</div>}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color, flexShrink: 0 }}>{votoNorm}</span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

const styles = {
  card: { background: 'white', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 20 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: "'Inter', sans-serif", width: '100%' },
  select: { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: "'Inter', sans-serif", background: 'white', color: '#475569' },
  btnPrimary: { padding: '10px 24px', background: '#1e40af', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: "'Inter', sans-serif', whiteSpace: 'nowrap'" },
  btnSecondary: { padding: '7px 14px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: "'Inter', sans-serif'" },
  tabBtn: { padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: "'Inter', sans-serif", transition: 'all 0.15s' },
  error: { background: '#fde8e8', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginTop: 12 },
  votacionRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, transition: 'all 0.15s', flexWrap: 'wrap' },
  sesionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' },
  votoBadge: { fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 8, color: 'white' },
}
