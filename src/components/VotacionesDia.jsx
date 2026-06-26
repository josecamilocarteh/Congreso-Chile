import { useState, useEffect } from 'react'
import { diputados, PARTIDO_COLORS } from '../data'

const OPCION_LABELS = { 'Afirmativo': 'A favor', 'En Contra': 'En contra', 'Abstencion': 'Abstención', 'No Vota': 'No vota', 'Dispensado': 'Dispensado', 'Pareo': 'Pareado' }
const OPCION_COLORS = { 'Afirmativo': '#10b981', 'En Contra': '#ef4444', 'Abstencion': '#f59e0b', 'No Vota': '#94a3b8', 'Dispensado': '#cbd5e1', 'Pareo': '#cbd5e1' }
const CONECTORES = new Set(['y', 'de', 'del', 'la', 'las', 'los'])
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const TABLA_SEMANAL_URL = 'https://www.camara.cl/verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL'
const TABLA_DIA_URL = 'https://www.camara.cl/legislacion/sesiones_sala/sesiones_sala.aspx'

function norm(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
}
const DIP_TOKENS = diputados.map(d => ({ dip: d, toks: new Set(norm(d.nombre).split(' ')) }))
function buscarDiputado(nombreApi) {
  const toks = norm(nombreApi).split(' ').filter(Boolean)
  let best = null, bestScore = 0
  for (const { dip, toks: dt } of DIP_TOKENS) {
    let s = 0
    for (const t of toks) if (dt.has(t)) s++
    if (s > bestScore) { bestScore = s; best = dip }
  }
  return bestScore >= 2 ? best : null
}
function apellidoDe(nombre) {
  const t = norm(nombre).split(' ').filter(Boolean)
  if (t.length < 2) return nombre
  let i = t.length - 2
  while (i > 0 && CONECTORES.has(t[i])) i--
  return t[i]
}
function formatFecha(iso) {
  const p = (iso || '').split('-')
  if (p.length !== 3) return iso
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
  if (isNaN(d)) return iso
  return `${DIAS[d.getDay()]} ${Number(p[2])} de ${MESES[Number(p[1]) - 1]} de ${p[0]}`
}
function colorResultado(r) {
  const t = (r || '').toLowerCase()
  if (t.includes('aprob')) return '#10b981'
  if (t.includes('rechaz')) return '#ef4444'
  return '#64748b'
}
function boletinDe(texto) {
  const m = (texto || '').match(/(\d{4,6}-\d{2})/)
  return m ? m[1] : null
}

export default function VotacionesDia() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [todas, setTodas] = useState([])
  const [fecha, setFecha] = useState('')
  const [expandId, setExpandId] = useState(null)
  const [detalles, setDetalles] = useState({})        // cache por id
  const [loadingDet, setLoadingDet] = useState(null)
  const [titulos, setTitulos] = useState({})          // cache por boletín → título

  useEffect(() => {
    let activo = true
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const res = await fetch('/api/votaciones?votacionesAnio=2026')
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        if (!activo) return
        const vs = data.votaciones || []
        setTodas(vs)
        const fechasU = [...new Set(vs.map(v => v.fecha))].sort()
        if (fechasU.length) setFecha(fechasU[fechasU.length - 1])   // día más reciente
      } catch (e) { if (activo) setError(e.message) }
      if (activo) setLoading(false)
    })()
    return () => { activo = false }
  }, [])

  const fechasConVotaciones = [...new Set(todas.map(v => v.fecha))].sort().reverse()
  const delDia = todas
    .filter(v => v.fecha === fecha)
    .sort((a, b) => (a.fechaHora || '').localeCompare(b.fechaHora || '') || (parseInt(a.id) || 0) - (parseInt(b.id) || 0))
    .map((v, i) => ({ ...v, numero: i + 1 }))

  // Buscar el título del proyecto (por boletín) de las votaciones del día
  useEffect(() => {
    let activo = true
    const boletines = [...new Set(delDia.map(v => boletinDe(v.descripcion)).filter(Boolean))]
      .filter(b => titulos[b] === undefined)
    if (boletines.length === 0) return
    // marcar como "cargando" para no repetir
    setTitulos(prev => { const n = { ...prev }; boletines.forEach(b => { if (n[b] === undefined) n[b] = null }); return n })
    boletines.forEach(async (b) => {
      try {
        const res = await fetch(`/api/votaciones?proyecto=${b}`)
        const data = await res.json()
        if (!activo) return
        setTitulos(prev => ({ ...prev, [b]: (data && data.titulo) ? data.titulo : '' }))
      } catch {
        if (activo) setTitulos(prev => ({ ...prev, [b]: '' }))
      }
    })
    return () => { activo = false }
  }, [fecha, todas])  // eslint-disable-line

  function enriquecer(votos) {
    return (votos || []).map(voto => {
      const dip = buscarDiputado(voto.diputado)
      return { ...voto, partido: dip?.partido || 'Sin partido', apellido: apellidoDe(dip?.nombre || voto.diputado) }
    })
  }

  async function toggleDetalle(v) {
    if (expandId === v.id) { setExpandId(null); return }
    setExpandId(v.id)
    if (detalles[v.id]) return
    setLoadingDet(v.id)
    try {
      // 1) Intentar la API de detalle (votaciones de ley)
      let votos = []
      try {
        const res = await fetch(`/api/votaciones?votacionId=${v.id}`)
        const data = await res.json()
        if (!data.error) votos = data.votos || []
      } catch { /* sigue al fallback */ }
      // 2) Si no hay votos (ej. acuerdos/resoluciones), usar la API nueva del año
      if (votos.length === 0) {
        const año = (v.fecha || '2026').slice(0, 4)
        const res2 = await fetch(`/api/votaciones?detalleAnio=${v.id}&anio=${año}`)
        const data2 = await res2.json()
        if (!data2.error) votos = data2.votos || []
      }
      setDetalles(prev => ({ ...prev, [v.id]: { votos: enriquecer(votos) } }))
    } catch (e) {
      setDetalles(prev => ({ ...prev, [v.id]: { error: e.message } }))
    }
    setLoadingDet(null)
  }

  return (
    <div>
      {/* AGENDA / TABLAS */}
      <div style={{ ...S.card, borderLeft: '4px solid #0f766e' }}>
        <div style={S.title}>🗓 Agenda · Lo que se va a votar</div>
        <div style={S.sub}>La agenda oficial se publica por sesión y por semana (no como dato por fecha arbitraria). Aquí tienes los dos documentos oficiales de la Cámara:</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href={TABLA_SEMANAL_URL} target="_blank" rel="noreferrer" style={S.btnLink}>📅 Tabla Semanal →</a>
          <a href={TABLA_DIA_URL} target="_blank" rel="noreferrer" style={{ ...S.btnLink, background: '#0e7490' }}>📄 Tabla y Orden del Día por sesión →</a>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>La "Tabla y Orden del Día por sesión" abre la página oficial de sesiones de sala, donde cada sesión tiene su tabla, cuenta y documentos del día.</div>
      </div>

      {/* VOTACIONES POR DÍA */}
      <div style={S.card}>
        <div style={S.title}>🗳 Votaciones por día</div>
        <div style={S.sub}>Lo que ya se votó. Elige cualquier fecha de 2026 · API oficial opendata.camara.cl</div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <label style={S.label}>Fecha</label>
            <input type="date" value={fecha} min="2026-01-01" max="2026-12-31"
              onChange={e => { setFecha(e.target.value); setExpandId(null) }} style={S.input} />
          </div>
        </div>

        {!loading && fechasConVotaciones.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ ...S.label, marginBottom: 6 }}>Días con votaciones registradas</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {fechasConVotaciones.slice(0, 24).map(f => (
                <button key={f} onClick={() => { setFecha(f); setExpandId(null) }}
                  style={{ ...S.chip, cursor: 'pointer', border: f === fecha ? '1.5px solid #0f766e' : '1.5px solid transparent', color: f === fecha ? '#0f766e' : '#475569', fontWeight: f === fecha ? 700 : 600 }}>
                  {Number(f.split('-')[2])}/{Number(f.split('-')[1])}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div style={S.error}>⚠️ {error}</div>}
      </div>

      {loading && (
        <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#64748b' }}>
          ⏳ Cargando votaciones del año...
        </div>
      )}

      {!loading && !error && todas.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#64748b' }}>
          La API no devolvió votaciones para 2026 todavía. Puede que aún no estén cargadas en opendata.camara.cl.
        </div>
      )}

      {!loading && todas.length > 0 && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, flexWrap: 'wrap', gap: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>{formatFecha(fecha)}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{delDia.length} {delDia.length === 1 ? 'votación' : 'votaciones'}</div>
          </div>

          {delDia.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 13 }}>
              No hay votaciones registradas ese día. Prueba con uno de los días marcados arriba.
            </div>
          )}

          {delDia.map((v, idx) => {
            const total = v.totalSi + v.totalNo + v.totalAbs
            const abierto = expandId === v.id
            const det = detalles[v.id]
            const bol = boletinDe(v.descripcion)
            const titProy = bol ? titulos[bol] : undefined
            const headline = (titProy && titProy.length) ? titProy : (v.descripcion || v.tipo || '(Sin descripción registrada)')
            return (
              <div key={v.id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
                <div onClick={() => toggleDetalle(v)} style={{ padding: '12px 14px', cursor: 'pointer', background: abierto ? '#f8fafc' : 'white' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#0f766e', background: '#ccfbf1', borderRadius: 6, padding: '2px 8px', flexShrink: 0, marginTop: 2, minWidth: 26, textAlign: 'center' }}>
                      #{v.numero}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'white', background: colorResultado(v.resultado), borderRadius: 6, padding: '2px 8px', flexShrink: 0, marginTop: 2 }}>
                      {v.resultado || '—'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600, lineHeight: 1.35 }}>{headline}</div>
                      {titProy && titProy.length && v.descripcion && v.descripcion !== headline && (
                        <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{v.descripcion}</div>
                      )}
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {bol && <span style={{ fontWeight: 700, color: '#0f766e' }}>Boletín {bol}</span>}
                        {bol && titulos[bol] === null && <span>buscando título…</span>}
                        {v.tipo && <span>{v.tipo}</span>}
                        {v.quorum && <span>Quórum: {v.quorum}</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: 14, color: '#94a3b8', flexShrink: 0 }}>{abierto ? '▲' : '▼'}</span>
                  </div>
                  {total > 0 && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
                      <div style={{ flex: 1, height: 7, borderRadius: 8, overflow: 'hidden', background: '#f1f5f9', display: 'flex' }}>
                        {v.totalSi > 0 && <div style={{ width: `${(v.totalSi / total) * 100}%`, background: '#10b981' }} />}
                        {v.totalAbs > 0 && <div style={{ width: `${(v.totalAbs / total) * 100}%`, background: '#f59e0b' }} />}
                        {v.totalNo > 0 && <div style={{ width: `${(v.totalNo / total) * 100}%`, background: '#ef4444' }} />}
                      </div>
                      <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>✓{v.totalSi}</span>
                      <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>✗{v.totalNo}</span>
                      {v.totalAbs > 0 && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>~{v.totalAbs}</span>}
                      {v.totalDisp > 0 && <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>·{v.totalDisp}</span>}
                    </div>
                  )}
                </div>

                {abierto && (
                  <div style={{ padding: '12px 14px', borderTop: '1px solid #e2e8f0', background: '#fbfcfe' }}>
                    {loadingDet === v.id ? (
                      <div style={{ textAlign: 'center', padding: 20, color: '#64748b', fontSize: 13 }}>⏳ Cargando votos individuales...</div>
                    ) : det?.error ? (
                      <div style={{ fontSize: 12, color: '#dc2626' }}>No se pudieron cargar los votos: {det.error}</div>
                    ) : det?.votos ? (
                      <DesgloseVotos votos={det.votos} />
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DesgloseVotos({ votos }) {
  const [orden, setOrden] = useState('partido')
  const [filtroOpcion, setFiltroOpcion] = useState('Todos')

  const resumenPartido = (() => {
    const map = {}
    votos.forEach(v => {
      const p = v.partido || 'Sin partido'
      if (!map[p]) map[p] = { Si: 0, No: 0, Abs: 0, otros: 0 }
      if (v.opcion === 'Afirmativo') map[p].Si++
      else if (v.opcion === 'En Contra') map[p].No++
      else if (v.opcion === 'Abstencion') map[p].Abs++
      else map[p].otros++
    })
    return Object.entries(map).sort((a, b) => (b[1].Si + b[1].No + b[1].Abs) - (a[1].Si + a[1].No + a[1].Abs))
  })()

  const ordenados = [...votos].sort((a, b) => {
    if (orden === 'apellido') return a.apellido.localeCompare(b.apellido)
    if (orden === 'opcion') {
      const o = { 'Afirmativo': 0, 'En Contra': 1, 'Abstencion': 2, 'No Vota': 3 }
      return (o[a.opcion] ?? 9) - (o[b.opcion] ?? 9) || a.apellido.localeCompare(b.apellido)
    }
    return (a.partido || 'ZZ').localeCompare(b.partido || 'ZZ') || a.apellido.localeCompare(b.apellido)
  })
  const filtrados = ordenados.filter(v => filtroOpcion === 'Todos' || v.opcion === filtroOpcion)

  return (
    <div>
      {resumenPartido.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {resumenPartido.map(([partido, r]) => {
            const total = r.Si + r.No + r.Abs + r.otros
            return (
              <div key={partido} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'white', borderRadius: 8, marginBottom: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: PARTIDO_COLORS[partido] || '#94a3b8', flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, width: 100, color: '#0f172a', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{partido}</span>
                <div style={{ flex: 1, height: 10, borderRadius: 6, overflow: 'hidden', display: 'flex', background: '#e2e8f0' }}>
                  {r.Si > 0 && <div style={{ width: `${(r.Si / total) * 100}%`, background: '#10b981' }} />}
                  {r.Abs > 0 && <div style={{ width: `${(r.Abs / total) * 100}%`, background: '#f59e0b' }} />}
                  {r.No > 0 && <div style={{ width: `${(r.No / total) * 100}%`, background: '#ef4444' }} />}
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 12, flexShrink: 0 }}>
                  {r.Si > 0 && <span style={{ color: '#10b981', fontWeight: 700 }}>✓{r.Si}</span>}
                  {r.No > 0 && <span style={{ color: '#ef4444', fontWeight: 700 }}>✗{r.No}</span>}
                  {r.Abs > 0 && <span style={{ color: '#f59e0b', fontWeight: 700 }}>~{r.Abs}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <select value={filtroOpcion} onChange={e => setFiltroOpcion(e.target.value)} style={S.select}>
          <option value="Todos">Todos los votos</option>
          <option value="Afirmativo">A favor</option>
          <option value="En Contra">En contra</option>
          <option value="Abstencion">Abstención</option>
          <option value="No Vota">No vota</option>
        </select>
        <select value={orden} onChange={e => setOrden(e.target.value)} style={S.select}>
          <option value="partido">Agrupar por partido</option>
          <option value="apellido">Orden por apellido</option>
          <option value="opcion">Ordenar por voto</option>
        </select>
      </div>

      {votos.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8' }}>No hay votos individuales para esta votación.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 5 }}>
          {filtrados.map((v, i) => {
            const color = OPCION_COLORS[v.opcion] || '#94a3b8'
            const label = OPCION_LABELS[v.opcion] || v.opcion
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 8, background: `${color}12`, border: `1px solid ${color}25` }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: PARTIDO_COLORS[v.partido] || '#94a3b8', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.diputado}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{v.partido}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color, flexShrink: 0 }}>{label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const S = {
  card:       { background: 'white', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  title:      { fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  sub:        { fontSize: 13, color: '#64748b', marginBottom: 16 },
  label:      { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:      { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' },
  select:     { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Inter, sans-serif', background: 'white', color: '#475569' },
  btnLink:    { display: 'inline-block', padding: '10px 20px', background: '#0f766e', color: 'white', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' },
  error:      { background: '#fde8e8', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginTop: 12 },
  chip:       { fontSize: 12, fontWeight: 600, color: '#475569', background: '#f1f5f9', borderRadius: 6, padding: '4px 10px' },
}
