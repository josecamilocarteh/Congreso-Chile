import { useState } from 'react'
import { PARTIDO_COLORS } from '../data'

const OPCION_LABELS = { 'Si': 'A favor', 'No': 'En contra', 'Abstencion': 'Abstención', 'Pareo': 'Pareado', 'Dispensado': 'Dispensado' }
const OPCION_COLORS = { 'Si': '#10b981', 'No': '#ef4444', 'Abstencion': '#f59e0b', 'Pareo': '#94a3b8', 'Dispensado': '#e2e8f0' }

export default function Votaciones() {
  const [modo, setModo] = useState('boletin')
  const [inputBoletin, setInputBoletin] = useState('')
  const [inputFecha, setInputFecha] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [votaciones, setVotaciones] = useState(null)
  const [sesiones, setSesiones] = useState(null)
  const [votacionSel, setVotacionSel] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [filtroOpcion, setFiltroOpcion] = useState('Todos')
  const [filtroPartido, setFiltroPartido] = useState('Todos')
  const [busqueda, setBusqueda] = useState('')

  async function buscarBoletin() {
    if (!inputBoletin.trim()) return
    setLoading(true); setError(null); setVotaciones(null); setVotacionSel(null); setDetalle(null); setSesiones(null)
    try {
      const res = await fetch(`/api/votaciones?boletin=${encodeURIComponent(inputBoletin.trim())}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (!data.votaciones?.length) throw new Error('No se encontraron votaciones para este boletín. Verifica el número.')
      setVotaciones(data.votaciones)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  async function buscarFecha() {
    if (!inputFecha) return
    setLoading(true); setError(null); setSesiones(null); setVotaciones(null); setVotacionSel(null); setDetalle(null)
    try {
      const res = await fetch(`/api/votaciones?fecha=${inputFecha}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (!data.sesiones?.length) throw new Error(data.mensaje || `No hubo sesión de sala el ${inputFecha}. La Cámara sesiona generalmente martes, miércoles y jueves.`)
      setSesiones(data.sesiones)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  async function cargarSesion(sesionId) {
    setLoading(true); setError(null); setVotaciones(null); setVotacionSel(null); setDetalle(null)
    try {
      const res = await fetch(`/api/votaciones?sesionId=${sesionId}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (!data.votaciones?.length) throw new Error('Esta sesión no tiene votaciones registradas.')
      setVotaciones(data.votaciones)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  async function cargarDetalle(v) {
    setVotacionSel(v); setDetalle(null); setFiltroOpcion('Todos'); setFiltroPartido('Todos'); setBusqueda('')
    setLoadingDetalle(true)
    try {
      const res = await fetch(`/api/votaciones?votacionId=${v.id}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDetalle(data)
    } catch (e) { setError(e.message) }
    setLoadingDetalle(false)
  }

  const votosFiltr = detalle?.votos?.filter(v =>
    (filtroOpcion === 'Todos' || v.opcion === filtroOpcion)
    && (filtroPartido === 'Todos' || v.partido === filtroPartido)
    && (busqueda === '' || v.diputado.toLowerCase().includes(busqueda.toLowerCase()))
  ) || []

  const partidosEnVot = detalle ? [...new Set(detalle.votos.map(v => v.partido).filter(Boolean))].sort() : []

  const resumenPartido = detalle ? (() => {
    const map = {}
    detalle.votos.forEach(v => {
      const p = v.partido || 'Sin partido'
      if (!map[p]) map[p] = { Si: 0, No: 0, Abstencion: 0, otros: 0 }
      if (v.opcion === 'Si') map[p].Si++
      else if (v.opcion === 'No') map[p].No++
      else if (v.opcion === 'Abstencion') map[p].Abstencion++
      else map[p].otros++
    })
    return Object.entries(map).sort((a, b) => (b[1].Si + b[1].No) - (a[1].Si + a[1].No))
  })() : []

  return (
    <div>
      {/* BÚSQUEDA */}
      <div style={S.card}>
        <div style={S.title}>🗳 Votaciones de la Cámara de Diputadas y Diputados</div>
        <div style={S.sub}>Datos en tiempo real · API oficial del Congreso Nacional · opendata.congreso.cl</div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[['boletin', '🔢 Por boletín'], ['fecha', '📅 Por fecha de sesión']].map(([id, label]) => (
            <button key={id} onClick={() => {
              setModo(id); setError(null); setVotaciones(null)
              setSesiones(null); setVotacionSel(null); setDetalle(null)
            }} style={{ ...S.tabBtn, background: modo === id ? '#0f766e' : '#f1f5f9', color: modo === id ? 'white' : '#475569' }}>
              {label}
            </button>
          ))}
        </div>

        {modo === 'boletin' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={S.label}>Número de boletín</label>
              <input value={inputBoletin} onChange={e => setInputBoletin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarBoletin()}
                placeholder="Ej: 18216-05 o 18216" style={S.input} />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                Busca el boletín en <strong>tramitacion.senado.cl</strong>
              </div>
            </div>
            <button onClick={buscarBoletin} disabled={loading || !inputBoletin.trim()} style={S.btnPrimary}>
              {loading ? 'Buscando...' : 'Buscar votaciones'}
            </button>
          </div>
        )}

        {modo === 'fecha' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={S.label}>Fecha de sesión de sala</label>
              <input type="date" value={inputFecha} onChange={e => setInputFecha(e.target.value)} style={{ ...S.input, width: 'auto' }} />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>La Cámara sesiona generalmente martes, miércoles y jueves</div>
            </div>
            <button onClick={buscarFecha} disabled={loading || !inputFecha} style={S.btnPrimary}>
              {loading ? 'Buscando...' : 'Buscar sesiones'}
            </button>
          </div>
        )}

        {error && <div style={S.error}>⚠️ {error}</div>}
      </div>

      {/* SESIONES */}
      {sesiones && !loading && (
        <div style={S.card}>
          <div style={S.title}>Sesiones del {inputFecha}</div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sesiones.map(s => (
              <div key={s.id} style={S.row}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Sesión N° {s.numero}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{s.tipo} · ID: {s.id}</div>
                </div>
                <button onClick={() => cargarSesion(s.id)} style={S.btnSec}>Ver votaciones →</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LISTA VOTACIONES */}
      {loading && <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#64748b' }}>⏳ Consultando la API del Congreso...</div>}

      {votaciones && !loading && (
        <div style={S.card}>
          <div style={S.title}>{votaciones.length} votación{votaciones.length !== 1 ? 'es' : ''}</div>
          <div style={{ marginTop: 12 }}>
            {votaciones.map((v, i) => {
              const total = (v.totalSi || 0) + (v.totalNo || 0) + (v.totalAbstencion || 0)
              return (
                <div key={v.id || i} onClick={() => cargarDetalle(v)}
                  style={{
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer', marginBottom: 8,
                    background: votacionSel?.id === v.id ? '#f0fdfa' : 'white',
                    border: votacionSel?.id === v.id ? '2px solid #0f766e' : '1px solid #e2e8f0',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 5 }}>
                    {v.descripcion || '(Sin descripción)'}
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748b', flexWrap: 'wrap', marginBottom: total > 0 ? 8 : 0 }}>
                    {v.fecha && <span>📅 {v.fecha}</span>}
                    {v.quorum && <span>⚖️ {v.quorum}</span>}
                    {v.resultado && <span style={{ color: v.resultado === 'Aprobado' ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                      {v.resultado === 'Aprobado' ? '✓' : '✗'} {v.resultado}
                    </span>}
                  </div>
                  {total > 0 && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <div style={{ flex: 1, height: 8, borderRadius: 8, overflow: 'hidden', background: '#f1f5f9', display: 'flex' }}>
                        {v.totalSi > 0 && <div style={{ width: `${(v.totalSi/total)*100}%`, background: '#10b981' }} />}
                        {v.totalAbstencion > 0 && <div style={{ width: `${(v.totalAbstencion/total)*100}%`, background: '#f59e0b' }} />}
                        {v.totalNo > 0 && <div style={{ width: `${(v.totalNo/total)*100}%`, background: '#ef4444' }} />}
                      </div>
                      <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>✓{v.totalSi}</span>
                      <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>✗{v.totalNo}</span>
                      {v.totalAbstencion > 0 && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>~{v.totalAbstencion}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* DETALLE VOTACIÓN */}
      {votacionSel && (
        <div style={S.card}>
          {loadingDetalle ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>⏳ Cargando votos individuales...</div>
          ) : detalle ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={S.title}>{detalle.descripcion || votacionSel.descripcion || '(Sin descripción)'}</div>
                {detalle.fecha && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>📅 {detalle.fecha}</div>}
              </div>

              {/* Totales */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                {[
                  { label: 'A favor', value: detalle.resumen?.si, color: '#10b981', icon: '✓' },
                  { label: 'En contra', value: detalle.resumen?.no, color: '#ef4444', icon: '✗' },
                  { label: 'Abstención', value: detalle.resumen?.abstencion, color: '#f59e0b', icon: '~' },
                ].map(s => (
                  <div key={s.label} style={{ background: `${s.color}15`, border: `1.5px solid ${s.color}30`, borderRadius: 10, padding: '12px 20px', textAlign: 'center', flex: 1, minWidth: 80 }}>
                    <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.icon} {s.value ?? 0}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Barra global */}
              {detalle.votos.length > 0 && (() => {
                const t = detalle.votos.length
                const si = detalle.votos.filter(v => v.opcion === 'Si').length
                const no = detalle.votos.filter(v => v.opcion === 'No').length
                const abs = detalle.votos.filter(v => v.opcion === 'Abstencion').length
                return (
                  <div style={{ height: 12, borderRadius: 10, overflow: 'hidden', display: 'flex', marginBottom: 16 }}>
                    <div style={{ width: `${(si/t)*100}%`, background: '#10b981' }} />
                    <div style={{ width: `${(abs/t)*100}%`, background: '#f59e0b' }} />
                    <div style={{ width: `${(no/t)*100}%`, background: '#ef4444' }} />
                  </div>
                )
              })()}

              {/* Por partido */}
              {resumenPartido.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Desglose por partido</div>
                  {resumenPartido.map(([partido, r]) => {
                    const total = r.Si + r.No + r.Abstencion + r.otros
                    return (
                      <div key={partido} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f8fafc', borderRadius: 8, marginBottom: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: PARTIDO_COLORS[partido] || '#94a3b8', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, width: 110, color: '#0f172a', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{partido}</span>
                        <div style={{ flex: 1, height: 10, borderRadius: 6, overflow: 'hidden', display: 'flex', background: '#e2e8f0' }}>
                          {r.Si > 0 && <div style={{ width: `${(r.Si/total)*100}%`, background: '#10b981' }} />}
                          {r.Abstencion > 0 && <div style={{ width: `${(r.Abstencion/total)*100}%`, background: '#f59e0b' }} />}
                          {r.No > 0 && <div style={{ width: `${(r.No/total)*100}%`, background: '#ef4444' }} />}
                        </div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 12, flexShrink: 0 }}>
                          {r.Si > 0 && <span style={{ color: '#10b981', fontWeight: 700 }}>✓{r.Si}</span>}
                          {r.No > 0 && <span style={{ color: '#ef4444', fontWeight: 700 }}>✗{r.No}</span>}
                          {r.Abstencion > 0 && <span style={{ color: '#f59e0b', fontWeight: 700 }}>~{r.Abstencion}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Votos individuales */}
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Votos individuales</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <input placeholder="🔍 Buscar por apellido..." value={busqueda}
                  onChange={e => setBusqueda(e.target.value)} style={{ ...S.input, flex: 2, minWidth: 160 }} />
                <select value={filtroOpcion} onChange={e => setFiltroOpcion(e.target.value)} style={S.select}>
                  <option value="Todos">Todos los votos</option>
                  <option value="Si">A favor</option>
                  <option value="No">En contra</option>
                  <option value="Abstencion">Abstención</option>
                </select>
                <select value={filtroPartido} onChange={e => setFiltroPartido(e.target.value)} style={S.select}>
                  <option value="Todos">Todos los partidos</option>
                  {partidosEnVot.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{votosFiltr.length} de {detalle.votos.length} votos</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 5 }}>
                {votosFiltr.map((v, i) => {
                  const color = OPCION_COLORS[v.opcion] || '#94a3b8'
                  const label = OPCION_LABELS[v.opcion] || v.opcion
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: `${color}12`, border: `1px solid ${color}25` }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: PARTIDO_COLORS[v.partido] || '#94a3b8', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.diputado}</div>
                        {v.partido && <div style={{ fontSize: 10, color: '#94a3b8' }}>{v.partido}</div>}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color, flexShrink: 0 }}>{label}</span>
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

const S = {
  card: { background: 'white', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  title: { fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  sub: { fontSize: 13, color: '#64748b', marginBottom: 20 },
  label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: "'Inter', sans-serif", width: '100%', boxSizing: 'border-box' },
  select: { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: "'Inter', sans-serif", background: 'white', color: '#475569' },
  btnPrimary: { padding: '10px 24px', background: '#0f766e', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap' },
  btnSec: { padding: '7px 14px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  tabBtn: { padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: "'Inter', sans-serif", transition: 'all 0.15s' },
  error: { background: '#fde8e8', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginTop: 12 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' },
}
