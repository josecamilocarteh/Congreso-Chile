import { useState } from 'react'
import { diputados, PARTIDO_COLORS } from '../data'

// ---------------------------------------------------------------------------
// Votaciones de la Cámara de Diputadas y Diputados, buscadas POR BOLETÍN.
// Escribes el número del proyecto (ej: 18216-05) y aparecen todas sus
// votaciones en Sala, con el detalle voto a voto de cada una.
// ---------------------------------------------------------------------------

const OPCION_LABELS = { 'Afirmativo': 'A favor', 'En Contra': 'En contra', 'Abstencion': 'Abstención', 'No Vota': 'No vota', 'Dispensado': 'Dispensado', 'Pareo': 'Pareado' }
const OPCION_COLORS = { 'Afirmativo': '#10b981', 'En Contra': '#ef4444', 'Abstencion': '#f59e0b', 'No Vota': '#94a3b8', 'Dispensado': '#cbd5e1', 'Pareo': '#cbd5e1' }
const CONECTORES = new Set(['y', 'de', 'del', 'la', 'las', 'los'])
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function norm(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
}
function surnameDe(nombre) {
  const p = norm(nombre).split(' ').filter(Boolean)
  for (let k = p.length - 1; k >= 0; k--) if (!CONECTORES.has(p[k])) return p[k]
  return ''
}
const DIP_TOKENS = diputados.map(d => ({ person: d, toks: new Set(norm(d.nombre).split(' ')), sur: surnameDe(d.nombre) }))

// Empareja el nombre que manda la API con la lista local de diputados.
// Mandan las coincidencias de tokens; el apellido solo desempata.
function buscarDiputado(nombreApi) {
  const q = new Set(norm(nombreApi).split(' ').filter(Boolean))
  let best = null, bestScore = 0
  for (const it of DIP_TOKENS) {
    let shared = 0
    for (const t of it.toks) if (q.has(t)) shared++
    const score = shared * 10 + (it.sur && q.has(it.sur) ? 1 : 0)
    if (score > bestScore) { bestScore = score; best = it.person }
  }
  return bestScore >= 20 ? best : null
}
function apellidoDe(nombre) {
  const t = norm(nombre).split(' ').filter(Boolean)
  if (t.length < 2) return nombre
  let i = t.length - 2
  while (i > 0 && CONECTORES.has(t[i])) i--
  return t[i]
}
function fechaLarga(iso) {
  const m = String(iso || '').match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso || ''
  return parseInt(m[3], 10) + ' de ' + MESES[parseInt(m[2], 10) - 1] + ' de ' + m[1]
}
// Acepta "18216-05", "18216", "Boletín N° 18216-05", "18.216-05"
function limpiarBoletin(txt) {
  const t = String(txt || '').replace(/\./g, '').replace(/[^0-9-]/g, '')
  const m = t.match(/(\d{3,6})(?:-(\d{1,2}))?/)
  if (!m) return ''
  return m[2] ? m[1] + '-' + m[2].padStart(2, '0') : m[1]
}

export default function Votaciones() {
  const [inputBoletin, setInputBoletin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [votaciones, setVotaciones] = useState(null)
  const [proyecto, setProyecto] = useState(null)
  const [votacionSel, setVotacionSel] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [filtroOpcion, setFiltroOpcion] = useState('Todos')
  const [filtroPartido, setFiltroPartido] = useState('Todos')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState('partido')

  function enriquecer(votos) {
    return (votos || []).map(voto => {
      const dip = buscarDiputado(voto.diputado)
      return {
        ...voto,
        partido: dip?.partido || 'Sin partido',
        apellido: apellidoDe(dip?.nombre || voto.diputado)
      }
    })
  }

  async function buscarBoletin() {
    const bol = limpiarBoletin(inputBoletin)
    if (!bol) { setError('Escribe un número de boletín válido, por ejemplo 18216-05.'); return }
    setLoading(true); setError(null); setAviso(null)
    setVotaciones(null); setVotacionSel(null); setDetalle(null); setProyecto(null)
    try {
      const res = await fetch(`/api/votaciones?boletin=${encodeURIComponent(bol)}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (!data.votaciones || data.votaciones.length === 0) {
        throw new Error(
          'El boletín ' + bol + ' no tiene votaciones registradas en la Cámara. ' +
          'Puede que el proyecto aún no se vote en Sala, que se haya votado solo en el Senado, ' +
          'o que falte el guion del número (prueba con 18216-05 en vez de 18216).'
        )
      }
      setVotaciones(data.votaciones)
      // Datos del proyecto, en paralelo y sin bloquear la lista
      fetch(`/api/votaciones?proyecto=${encodeURIComponent(bol)}`)
        .then(r => r.json())
        .then(p => { if (p && p.titulo) setProyecto(p) })
        .catch(() => {})
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  // El servicio por boletín ya trae los votos. Si vienen vacíos, se piden aparte
  // (detalle de la votación) y, en último caso, se leen de la web de la Cámara.
  async function cargarDetalle(v) {
    setVotacionSel(v); setDetalle(null); setAviso(null)
    setFiltroOpcion('Todos'); setFiltroPartido('Todos'); setBusqueda(''); setOrden('partido')

    const base = {
      descripcion: v.descripcion,
      fecha: v.fecha,
      resumen: { si: v.totalSi, no: v.totalNo, abs: v.totalAbs, disp: v.totalDisp }
    }

    if (v.votos && v.votos.length > 0) {
      setDetalle({ ...base, votos: enriquecer(v.votos) })
      return
    }

    setLoadingDetalle(true)
    try {
      let votos = []
      const r1 = await fetch(`/api/votaciones?votacionId=${encodeURIComponent(v.id)}`)
      const d1 = await r1.json()
      if (d1.votos && d1.votos.length > 0) {
        votos = d1.votos
        if (d1.descripcion) base.descripcion = d1.descripcion
        if (d1.resumen) base.resumen = d1.resumen
      } else {
        const r2 = await fetch(`/api/votaciones?camaraDetalle=${encodeURIComponent(v.id)}`)
        const d2 = await r2.json()
        if (d2.votos && d2.votos.length > 0) {
          votos = d2.votos
          if (d2.materia) base.descripcion = d2.materia
          setAviso('Los votos se leyeron desde la ficha web de la Cámara, porque la API no los entregó.')
        }
      }
      if (votos.length === 0) {
        setAviso('La Cámara publicó los totales de esta votación, pero todavía no el detalle por diputado.')
      }
      setDetalle({ ...base, votos: enriquecer(votos) })
    } catch (e) {
      setError(e.message)
      setDetalle({ ...base, votos: [] })
    }
    setLoadingDetalle(false)
  }

  const votosOrdenados = detalle?.votos ? [...detalle.votos].sort((a, b) => {
    if (orden === 'apellido') return a.apellido.localeCompare(b.apellido)
    if (orden === 'opcion') {
      const ord = { 'Afirmativo': 0, 'En Contra': 1, 'Abstencion': 2, 'No Vota': 3 }
      return (ord[a.opcion] ?? 9) - (ord[b.opcion] ?? 9) || a.apellido.localeCompare(b.apellido)
    }
    return (a.partido || 'ZZ').localeCompare(b.partido || 'ZZ') || a.apellido.localeCompare(b.apellido)
  }) : []

  const partidosEnVot = detalle ? [...new Set(detalle.votos.map(v => v.partido).filter(p => p && p !== 'Sin partido'))].sort() : []

  const votosFiltrados = votosOrdenados.filter(v =>
    (filtroOpcion === 'Todos' || v.opcion === filtroOpcion)
    && (filtroPartido === 'Todos' || v.partido === filtroPartido)
    && (busqueda === '' || norm(v.diputado).includes(norm(busqueda)))
  )

  const resumenPartido = detalle ? (() => {
    const map = {}
    detalle.votos.forEach(v => {
      const p = v.partido || 'Sin partido'
      if (!map[p]) map[p] = { Si: 0, No: 0, Abs: 0, otros: 0 }
      if (v.opcion === 'Afirmativo') map[p].Si++
      else if (v.opcion === 'En Contra') map[p].No++
      else if (v.opcion === 'Abstencion') map[p].Abs++
      else map[p].otros++
    })
    return Object.entries(map).sort((a, b) => (b[1].Si + b[1].No + b[1].Abs) - (a[1].Si + a[1].No + a[1].Abs))
  })() : []

  return (
    <div>
      <div style={S.card}>
        <div style={S.title}>🗳 Votaciones de la Cámara por boletín</div>
        <div style={S.sub}>Escribe el número del proyecto y verás todas sus votaciones en Sala · opendata.camara.cl</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={S.label}>Número de boletín</label>
            <input
              value={inputBoletin}
              onChange={e => setInputBoletin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscarBoletin()}
              placeholder="Ej: 18216-05 o 18216"
              style={S.input}
            />
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>Si no lo recuerdas, búscalo en tramitacion.senado.cl</div>
          </div>
          <button onClick={buscarBoletin} disabled={loading || !inputBoletin.trim()} style={S.btnPrimary}>
            {loading ? 'Buscando…' : 'Buscar votaciones'}
          </button>
        </div>
        {error && <div style={S.error}>⚠️ {error}</div>}
      </div>

      {loading && (
        <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#64748b' }}>
          ⏳ Consultando la API de la Cámara…
        </div>
      )}

      {proyecto && !loading && (
        <div style={{ ...S.card, borderLeft: '4px solid #0f766e' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', letterSpacing: 0.5, marginBottom: 6 }}>
            Proyecto · Boletín {proyecto.boletin}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', lineHeight: 1.3, marginBottom: 12 }}>
            {proyecto.titulo}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {proyecto.iniciativa && <span style={S.chip}>📄 {proyecto.iniciativa}</span>}
            {proyecto.camaraOrigen && <span style={S.chip}>🏛 Origen: {proyecto.camaraOrigen}</span>}
            {proyecto.urgencia && proyecto.urgencia !== 'Sin urgencia' && <span style={{ ...S.chip, background: '#fef3c7', color: '#92400e' }}>⚡ Urgencia {proyecto.urgencia}</span>}
            {proyecto.etapa && <span style={S.chip}>📍 {proyecto.etapa}</span>}
            {proyecto.estado && <span style={{ ...S.chip, background: '#dcfce7', color: '#166534' }}>{proyecto.estado}</span>}
          </div>
        </div>
      )}

      {votaciones && !loading && (
        <div style={S.card}>
          <div style={S.title}>{votaciones.length} votación{votaciones.length !== 1 ? 'es' : ''} en la Cámara</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>Toca una votación para ver cómo votó cada diputado.</div>
          <div>
            {votaciones.map((v, i) => {
              const total = (v.totalSi || 0) + (v.totalNo || 0) + (v.totalAbs || 0)
              const sel = votacionSel?.id === v.id
              const aprobado = /aprob/i.test(v.resultado || '')
              return (
                <div key={v.id || i} onClick={() => cargarDetalle(v)} style={{
                  padding: '12px 14px', borderRadius: 10, cursor: 'pointer', marginBottom: 8,
                  background: sel ? '#f0fdfa' : 'white',
                  border: sel ? '2px solid #0f766e' : '1px solid #e2e8f0',
                }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'white', background: '#0f766e', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>
                      #{v.numero || i + 1}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', lineHeight: 1.35 }}>
                      {v.descripcion || v.tipo || '(Sin descripción)'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748b', flexWrap: 'wrap', marginBottom: total > 0 ? 8 : 0, paddingLeft: 36 }}>
                    {v.fecha && <span>📅 {fechaLarga(v.fecha)}</span>}
                    {v.sesion && <span>Sesión {v.sesion}</span>}
                    {v.tramite && <span>{v.tramite}</span>}
                    {v.quorum && <span>⚖️ {v.quorum}</span>}
                    {v.resultado && (
                      <span style={{ color: aprobado ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                        {aprobado ? '✓' : '✗'} {v.resultado}
                      </span>
                    )}
                  </div>
                  {total > 0 && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: 36 }}>
                      <div style={{ flex: 1, height: 7, borderRadius: 8, overflow: 'hidden', background: '#f1f5f9', display: 'flex' }}>
                        {v.totalSi > 0 && <div style={{ width: `${(v.totalSi / total) * 100}%`, background: '#10b981' }} />}
                        {v.totalAbs > 0 && <div style={{ width: `${(v.totalAbs / total) * 100}%`, background: '#f59e0b' }} />}
                        {v.totalNo > 0 && <div style={{ width: `${(v.totalNo / total) * 100}%`, background: '#ef4444' }} />}
                      </div>
                      <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>✓{v.totalSi}</span>
                      <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>✗{v.totalNo}</span>
                      {v.totalAbs > 0 && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>~{v.totalAbs}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {votacionSel && (
        <div style={S.card}>
          {loadingDetalle ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>⏳ Cargando votos individuales…</div>
          ) : detalle ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={S.title}>{detalle.descripcion || '(Sin descripción)'}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  {detalle.fecha ? fechaLarga(detalle.fecha) + ' · ' : ''}
                  <a href={`https://www.camara.cl/legislacion/sala_sesiones/votacion_detalle.aspx?prmIdVotacion=${votacionSel.id}`}
                    target="_blank" rel="noreferrer" style={{ color: '#0f766e' }}>ver ficha oficial</a>
                </div>
              </div>

              {aviso && <div style={S.aviso}>ℹ️ {aviso}</div>}

              <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                {[
                  { label: 'A favor', value: detalle.resumen?.si, color: '#10b981', icon: '✓' },
                  { label: 'En contra', value: detalle.resumen?.no, color: '#ef4444', icon: '✗' },
                  { label: 'Abstención', value: detalle.resumen?.abs, color: '#f59e0b', icon: '~' },
                ].map(s => (
                  <div key={s.label} style={{ background: `${s.color}15`, border: `1.5px solid ${s.color}30`, borderRadius: 10, padding: '12px 20px', textAlign: 'center', flex: 1, minWidth: 80 }}>
                    <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.icon} {s.value ?? 0}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {resumenPartido.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Desglose por partido</div>
                  {resumenPartido.map(([partido, r]) => {
                    const total = r.Si + r.No + r.Abs + r.otros
                    return (
                      <div key={partido} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f8fafc', borderRadius: 8, marginBottom: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: PARTIDO_COLORS[partido] || '#94a3b8', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, width: 110, color: '#0f172a', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{partido}</span>
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

              {detalle.votos.length > 0 && (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
                    Votos individuales · {votosFiltrados.length} de {detalle.votos.length}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <input placeholder="🔍 Buscar por apellido…" value={busqueda}
                      onChange={e => setBusqueda(e.target.value)} style={{ ...S.input, flex: 2, minWidth: 160 }} />
                    <select value={filtroOpcion} onChange={e => setFiltroOpcion(e.target.value)} style={S.select}>
                      <option value="Todos">Todos los votos</option>
                      <option value="Afirmativo">A favor</option>
                      <option value="En Contra">En contra</option>
                      <option value="Abstencion">Abstención</option>
                      <option value="No Vota">No vota</option>
                    </select>
                    <select value={filtroPartido} onChange={e => setFiltroPartido(e.target.value)} style={S.select}>
                      <option value="Todos">Todos los partidos</option>
                      {partidosEnVot.map(p => <option key={p}>{p}</option>)}
                    </select>
                    <select value={orden} onChange={e => setOrden(e.target.value)} style={S.select}>
                      <option value="partido">Agrupar por partido</option>
                      <option value="apellido">Orden por apellido</option>
                      <option value="opcion">Ordenar por voto</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 5 }}>
                    {votosFiltrados.map((v, i) => {
                      const color = OPCION_COLORS[v.opcion] || '#94a3b8'
                      const label = OPCION_LABELS[v.opcion] || v.opcion
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: `${color}12`, border: `1px solid ${color}25` }}>
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
                </>
              )}
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
  label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 5, letterSpacing: 0.5 },
  input: { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box' },
  select: { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Inter, sans-serif', background: 'white', color: '#475569' },
  btnPrimary: { padding: '10px 24px', background: '#0f766e', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' },
  error: { background: '#fde8e8', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginTop: 12, lineHeight: 1.5 },
  aviso: { background: '#eff6ff', color: '#1d4ed8', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14, lineHeight: 1.5 },
  chip: { fontSize: 12, fontWeight: 600, color: '#475569', background: '#f1f5f9', borderRadius: 6, padding: '4px 10px' },
}
