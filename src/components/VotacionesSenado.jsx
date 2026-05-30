import { useState } from 'react'
import { senadores, PARTIDO_COLORS } from '../data'

const SEL_LABELS = { 'Si': 'A favor', 'No': 'En contra', 'Abstencion': 'Abstención', 'Abstención': 'Abstención', 'Pareo': 'Pareado' }
const SEL_COLORS = { 'Si': '#10b981', 'No': '#ef4444', 'Abstencion': '#f59e0b', 'Abstención': '#f59e0b', 'Pareo': '#cbd5e1' }
const CONECTORES = new Set(['y', 'de', 'del', 'la', 'las', 'los', 'van'])
const INICIALES = new Set(['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z'])

function norm(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

const SEN_TOKENS = senadores.map(function (s) {
  return { sen: s, toks: new Set(norm(s.nombre).split(' ')) }
})

// Cruzar "Apellido P., Nombre" con la lista de senadores de data.js
function buscarSenador(nombreApi) {
  let apellido = ''
  let toks = []
  if (nombreApi.indexOf(',') !== -1) {
    const partes = nombreApi.split(',')
    const apTokens = norm(partes[0]).split(' ').filter(function (t) { return t.length > 1 })
    const nomTokens = norm(partes[1]).split(' ').filter(Boolean)
    apellido = apTokens[0] || ''
    toks = apTokens.concat(nomTokens)
  } else {
    toks = norm(nombreApi).split(' ').filter(Boolean)
  }
  let best = null, bestScore = 0
  for (const item of SEN_TOKENS) {
    let s = 0
    for (const t of toks) if (item.toks.has(t)) s++
    if (apellido && item.toks.has(apellido)) s += 2
    if (s > bestScore) { bestScore = s; best = item.sen }
  }
  return bestScore >= 3 ? best : null
}

// Apellido para ordenar: primera palabra antes de la coma
function apellidoSenado(nombreApi) {
  if (nombreApi.indexOf(',') !== -1) {
    const ap = norm(nombreApi.split(',')[0]).split(' ').filter(function (t) { return t.length > 1 })
    return ap[0] || nombreApi
  }
  return norm(nombreApi).split(' ')[0] || nombreApi
}

// Normalizar selección a Si/No/Abstencion/Pareo
function normSel(s) {
  const n = norm(s)
  if (n === 'si') return 'Si'
  if (n === 'no') return 'No'
  if (n.indexOf('absten') === 0) return 'Abstencion'
  if (n.indexOf('pareo') === 0) return 'Pareo'
  return s
}

export default function VotacionesSenado() {
  const [inputBoletin, setInputBoletin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [votaciones, setVotaciones] = useState(null)
  const [proyecto, setProyecto] = useState(null)
  const [votacionSel, setVotacionSel] = useState(null)
  const [filtroOpcion, setFiltroOpcion] = useState('Todos')
  const [filtroPartido, setFiltroPartido] = useState('Todos')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState('partido')

  async function buscar() {
    if (!inputBoletin.trim()) return
    const bol = inputBoletin.trim()
    setLoading(true); setError(null); setVotaciones(null); setVotacionSel(null); setProyecto(null)
    try {
      const res = await fetch(`/api/votaciones?senado=${encodeURIComponent(bol)}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (!data.votaciones || !data.votaciones.length) {
        throw new Error('Este proyecto no tiene votaciones registradas en el Senado (puede estar en comisión o aún no votado en sala).')
      }
      // Enriquecer votos con partido
      const enriquecidas = data.votaciones.map(function (vot) {
        const votos = (vot.votos || []).map(function (v) {
          const sen = buscarSenador(v.parlamentario)
          return {
            parlamentario: v.parlamentario,
            seleccion: normSel(v.seleccion),
            partido: sen ? sen.partido : 'Sin partido',
            apellido: apellidoSenado(v.parlamentario)
          }
        })
        return Object.assign({}, vot, { votos: votos })
      })
      setVotaciones(enriquecidas)
      // Título del proyecto en paralelo
      fetch(`/api/votaciones?proyecto=${encodeURIComponent(bol)}`)
        .then(function (r) { return r.json() })
        .then(function (p) { if (p && p.titulo) setProyecto(p) })
        .catch(function () {})
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  function abrirDetalle(v) {
    setVotacionSel(v); setFiltroOpcion('Todos'); setFiltroPartido('Todos'); setBusqueda(''); setOrden('partido')
  }

  const votosOrdenados = votacionSel ? votacionSel.votos.slice().sort(function (a, b) {
    if (orden === 'apellido') return a.apellido.localeCompare(b.apellido)
    if (orden === 'opcion') {
      const ord = { 'Si': 0, 'No': 1, 'Abstencion': 2, 'Pareo': 3 }
      return (ord[a.seleccion] != null ? ord[a.seleccion] : 9) - (ord[b.seleccion] != null ? ord[b.seleccion] : 9) || a.apellido.localeCompare(b.apellido)
    }
    return (a.partido || 'ZZ').localeCompare(b.partido || 'ZZ') || a.apellido.localeCompare(b.apellido)
  }) : []

  const partidosEnVot = votacionSel ? Array.from(new Set(votacionSel.votos.map(function (v) { return v.partido }).filter(function (p) { return p && p !== 'Sin partido' }))).sort() : []

  const votosFiltrados = votosOrdenados.filter(function (v) {
    return (filtroOpcion === 'Todos' || v.seleccion === filtroOpcion)
      && (filtroPartido === 'Todos' || v.partido === filtroPartido)
      && (busqueda === '' || v.parlamentario.toLowerCase().indexOf(busqueda.toLowerCase()) !== -1)
  })

  const resumenPartido = votacionSel ? (function () {
    const map = {}
    votacionSel.votos.forEach(function (v) {
      const p = v.partido || 'Sin partido'
      if (!map[p]) map[p] = { Si: 0, No: 0, Abs: 0, otros: 0 }
      if (v.seleccion === 'Si') map[p].Si++
      else if (v.seleccion === 'No') map[p].No++
      else if (v.seleccion === 'Abstencion') map[p].Abs++
      else map[p].otros++
    })
    return Object.entries(map).sort(function (a, b) { return (b[1].Si + b[1].No + b[1].Abs) - (a[1].Si + a[1].No + a[1].Abs) })
  })() : []

  return (
    <div>
      <div style={S.card}>
        <div style={S.title}>🏛 Votaciones del Senado</div>
        <div style={S.sub}>Datos en tiempo real · API oficial del Senado · tramitacion.senado.cl</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={S.label}>Número de boletín</label>
            <input
              value={inputBoletin}
              onChange={function (e) { setInputBoletin(e.target.value) }}
              onKeyDown={function (e) { if (e.key === 'Enter') buscar() }}
              placeholder="Ej: 15480 o 15480-13"
              style={S.input}
            />
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>Solo proyectos votados en sala del Senado</div>
          </div>
          <button onClick={buscar} disabled={loading || !inputBoletin.trim()} style={S.btnPrimary}>
            {loading ? 'Buscando...' : 'Buscar votaciones'}
          </button>
        </div>
        {error && <div style={S.error}>⚠️ {error}</div>}
      </div>

      {proyecto && !loading && (
        <div style={{ ...S.card, borderLeft: '4px solid #7c3aed' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Proyecto · Boletín {proyecto.boletin}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', lineHeight: 1.3, marginBottom: 12 }}>
            {proyecto.titulo}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {proyecto.iniciativa && <span style={S.chip}>📄 {proyecto.iniciativa}</span>}
            {proyecto.etapa && <span style={S.chip}>📍 {proyecto.etapa}</span>}
            {proyecto.estado && <span style={{ ...S.chip, background: '#dcfce7', color: '#166534' }}>{proyecto.estado}</span>}
          </div>
        </div>
      )}

      {loading && <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#64748b' }}>⏳ Consultando la API del Senado...</div>}

      {votaciones && !loading && (
        <div style={S.card}>
          <div style={S.title}>{votaciones.length} votación{votaciones.length !== 1 ? 'es' : ''} en el Senado</div>
          <div style={{ marginTop: 12 }}>
            {votaciones.map(function (v, i) {
              const total = v.si + v.no + v.abstencion + v.pareo
              const aprobado = v.si > v.no
              return (
                <div key={i} onClick={function () { abrirDetalle(v) }} style={{
                  padding: '12px 14px', borderRadius: 10, cursor: 'pointer', marginBottom: 8,
                  background: votacionSel === v ? '#faf5ff' : 'white',
                  border: votacionSel === v ? '2px solid #7c3aed' : '1px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'white', background: '#7c3aed', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>#{i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>{v.tema}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748b', flexWrap: 'wrap', marginBottom: 8, paddingLeft: 36 }}>
                    {v.fecha && <span>📅 {v.fecha}</span>}
                    {v.tipoVotacion && <span>🗳 {v.tipoVotacion}</span>}
                    {v.quorum && <span>⚖️ {v.quorum}</span>}
                    <span style={{ color: aprobado ? '#10b981' : '#ef4444', fontWeight: 600 }}>{aprobado ? '✓ Aprobado' : '✗ Rechazado'}</span>
                  </div>
                  {total > 0 && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: 36 }}>
                      <div style={{ flex: 1, height: 7, borderRadius: 8, overflow: 'hidden', background: '#f1f5f9', display: 'flex' }}>
                        {v.si > 0 && <div style={{ width: `${(v.si / total) * 100}%`, background: '#10b981' }} />}
                        {v.abstencion > 0 && <div style={{ width: `${(v.abstencion / total) * 100}%`, background: '#f59e0b' }} />}
                        {v.no > 0 && <div style={{ width: `${(v.no / total) * 100}%`, background: '#ef4444' }} />}
                      </div>
                      <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>✓{v.si}</span>
                      <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>✗{v.no}</span>
                      {v.abstencion > 0 && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>~{v.abstencion}</span>}
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
          <div style={{ marginBottom: 16 }}>
            <div style={S.title}>{votacionSel.tema}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              📅 {votacionSel.fecha} · Sesión {votacionSel.sesion} · {votacionSel.etapa}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            {[
              { label: 'A favor', value: votacionSel.si, color: '#10b981', icon: '✓' },
              { label: 'En contra', value: votacionSel.no, color: '#ef4444', icon: '✗' },
              { label: 'Abstención', value: votacionSel.abstencion, color: '#f59e0b', icon: '~' }
            ].map(function (s) {
              return (
                <div key={s.label} style={{ background: `${s.color}15`, border: `1.5px solid ${s.color}30`, borderRadius: 10, padding: '12px 20px', textAlign: 'center', flex: 1, minWidth: 80 }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.icon} {s.value}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
                </div>
              )
            })}
          </div>

          {resumenPartido.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Desglose por partido</div>
              {resumenPartido.map(function (entry) {
                const partido = entry[0], r = entry[1]
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

          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
            Votos individuales · {votosFiltrados.length} de {votacionSel.votos.length}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <input placeholder="🔍 Buscar por apellido..." value={busqueda} onChange={function (e) { setBusqueda(e.target.value) }} style={{ ...S.input, flex: 2, minWidth: 160 }} />
            <select value={filtroOpcion} onChange={function (e) { setFiltroOpcion(e.target.value) }} style={S.select}>
              <option value="Todos">Todos los votos</option>
              <option value="Si">A favor</option>
              <option value="No">En contra</option>
              <option value="Abstencion">Abstención</option>
            </select>
            <select value={filtroPartido} onChange={function (e) { setFiltroPartido(e.target.value) }} style={S.select}>
              <option value="Todos">Todos los partidos</option>
              {partidosEnVot.map(function (p) { return <option key={p}>{p}</option> })}
            </select>
            <select value={orden} onChange={function (e) { setOrden(e.target.value) }} style={S.select}>
              <option value="partido">Agrupar por partido</option>
              <option value="apellido">Orden por apellido</option>
              <option value="opcion">Ordenar por voto</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 5 }}>
            {votosFiltrados.map(function (v, i) {
              const color = SEL_COLORS[v.seleccion] || '#94a3b8'
              const label = SEL_LABELS[v.seleccion] || v.seleccion
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: `${color}12`, border: `1px solid ${color}25` }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: PARTIDO_COLORS[v.partido] || '#94a3b8', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.parlamentario}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{v.partido}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: color, flexShrink: 0 }}>{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  card:       { background: 'white', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  title:      { fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  sub:        { fontSize: 13, color: '#64748b', marginBottom: 20 },
  label:      { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:      { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box' },
  select:     { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Inter, sans-serif', background: 'white', color: '#475569' },
  btnPrimary: { padding: '10px 24px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' },
  error:      { background: '#fde8e8', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginTop: 12 },
  chip:       { fontSize: 12, fontWeight: 600, color: '#475569', background: '#f1f5f9', borderRadius: 6, padding: '4px 10px' },
}
