import { useState, useEffect, useMemo } from 'react'
import { senadores, diputados, PARTIDO_COLORS } from '../data'
import { VOTACIONES_CLAVE, METODOLOGIA_TEXTO } from '../votacionesClave'

// ---------------------------------------------------------------------------
// Utilidades de nombres (mismo patrón que Votaciones.jsx / VotacionesSenado.jsx)
// ---------------------------------------------------------------------------
const CONECTORES = new Set(['y', 'de', 'del', 'la', 'las', 'los', 'van'])

function norm(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}
function surnameDe(nombre) {
  const p = norm(nombre).split(' ').filter(Boolean)
  for (let k = p.length - 1; k >= 0; k--) if (!CONECTORES.has(p[k])) return p[k]
  return ''
}
function matchPersona(nombreApi, lista) {
  const q = new Set(norm(nombreApi).split(' ').filter(Boolean))
  let best = null, bestScore = 0
  for (const it of lista) {
    let shared = 0
    for (const t of it.toks) if (q.has(t)) shared++
    const score = shared * 10 + (it.sur && q.has(it.sur) ? 1 : 0)
    if (score > bestScore) { bestScore = score; best = it.person }
  }
  return bestScore >= 20 ? best : null
}
const SEN_TOKENS = senadores.map(s => ({ person: s, toks: new Set(norm(s.nombre).split(' ')), sur: surnameDe(s.nombre) }))
const DIP_TOKENS = diputados.map(d => ({ person: d, toks: new Set(norm(d.nombre).split(' ')), sur: surnameDe(d.nombre) }))

function boletinDe(texto) {
  const m = (texto || '').match(/(\d{4,6}-\d{2})/)
  return m ? m[1] : null
}
function posicionSimple(raw) {
  const s = norm(raw)
  if (s === 'afirmativo' || s === 'si') return 'favor'
  if (s === 'en contra' || s === 'no') return 'contra'
  return 'otro'
}
function tituloCorto(desc, max = 90) {
  const t = (desc || '').replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max).trim() + '…' : t
}

const LS_KEY = 'votacionesClaveSeleccion_v1'

// ---------------------------------------------------------------------------
// Listados de votaciones en sala
// ---------------------------------------------------------------------------
async function listarSenado(desde, hasta) {
  const res = await fetch(`/api/votaciones?senadoRango=1&desde=${desde}&hasta=${hasta}`)
  const data = await res.json()
  if (data.error) return { error: data.error, items: [] }
  const items = (data.votaciones || []).map(v => ({
    camara: 'senado',
    key: 'S-' + v.id,
    id: v.id,
    fecha: v.fecha,
    descripcion: v.descripcion,
    boletin: v.boletin || boletinDe(v.descripcion) || '',
    totalSi: v.totalSi, totalNo: v.totalNo, totalAbs: v.totalAbs,
    resultado: v.resultado,
    votosInline: v.votos || [],   // el Senado ya entrega los votos en la misma respuesta
  }))
  return { error: null, items }
}

async function listarCamara(anio) {
  const res = await fetch(`/api/votaciones?votacionesAnio=${anio}`)
  const data = await res.json()
  if (data.error) return { error: data.error, items: [] }
  const items = (data.votaciones || []).map(v => ({
    camara: 'diputados',
    key: 'D-' + v.id,
    id: v.id,
    fecha: v.fecha,
    descripcion: v.descripcion,
    boletin: boletinDe(v.descripcion) || '',
    totalSi: v.totalSi, totalNo: v.totalNo, totalAbs: v.totalAbs,
    resultado: v.resultado,
    anio,
    votosInline: null,            // la Cámara necesita un segundo fetch por votación
  }))
  items.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
  return { error: null, items }
}

async function resolverVotos(item) {
  let crudos = item.votosInline
  if (!crudos) {
    const anioItem = item.anio || (item.fecha || '').slice(0, 4) || '2026'
    const res = await fetch(`/api/votaciones?detalleAnio=${item.id}&anio=${anioItem}`)
    const data = await res.json()
    if (data.error || !data.encontrado) return { ...item, error: data.error || 'Sin detalle de votos publicado', votos: [] }
    crudos = data.votos || []
  }
  const tokens = item.camara === 'senado' ? SEN_TOKENS : DIP_TOKENS
  const votos = crudos.map(v => {
    const p = matchPersona(v.diputado, tokens)
    if (!p) return null
    return { nombre: p.nombre, partido: p.partido, bloque: p.bloque, seleccion: posicionSimple(v.opcion) }
  }).filter(Boolean)
  if (votos.length === 0) return { ...item, error: 'No se pudo cruzar ningún voto con la nómina de parlamentarios', votos: [] }
  return { ...item, error: null, votos }
}

function calcularCelda(votos, partido) {
  const miembros = votos.filter(v => v.partido === partido && v.seleccion !== 'otro')
  if (miembros.length === 0) return null
  const favor = miembros.filter(v => v.seleccion === 'favor').length
  const contra = miembros.length - favor
  const mayoria = favor >= contra ? 'favor' : 'contra'
  const cohesion = Math.round((Math.max(favor, contra) / miembros.length) * 100)
  return { mayoria, cohesion, disidentes: miembros.filter(v => v.seleccion !== mayoria), favor, contra, total: miembros.length }
}

export default function VotacionesClave() {
  const [camaraSel, setCamaraSel] = useState('senado')
  const [desde, setDesde] = useState('2026-03-01')
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10))
  const [anio, setAnio] = useState('2026')
  const [lista, setLista] = useState([])
  const [listaError, setListaError] = useState(null)
  const [cargandoLista, setCargandoLista] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [soloLeyes, setSoloLeyes] = useState(true)
  const [seleccion, setSeleccion] = useState({})
  const [analisis, setAnalisis] = useState(null)
  const [generando, setGenerando] = useState(false)
  const [vista, setVista] = useState('partido')
  const [legisladorSel, setLegisladorSel] = useState('')
  const [celdaAbierta, setCeldaAbierta] = useState(null)
  const [panelAbierto, setPanelAbierto] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setSeleccion(JSON.parse(raw))
    } catch (e) { /* almacenamiento no disponible */ }
  }, [])
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(seleccion)) } catch (e) { /* ignorar */ }
  }, [seleccion])

  async function buscar() {
    setCargandoLista(true); setListaError(null)
    const r = camaraSel === 'senado' ? await listarSenado(desde, hasta) : await listarCamara(anio)
    setLista(r.items); setListaError(r.error); setCargandoLista(false)
  }

  const listaFiltrada = useMemo(() => {
    const q = norm(busqueda)
    return lista.filter(it => {
      if (soloLeyes && !it.boletin) return false
      if (!q) return true
      return norm(it.descripcion).includes(q) || (it.boletin || '').includes(busqueda.trim())
    })
  }, [lista, busqueda, soloLeyes])

  const seleccionadas = Object.values(seleccion)

  function toggle(item) {
    setSeleccion(prev => {
      const next = { ...prev }
      if (next[item.key]) delete next[item.key]
      else next[item.key] = item
      return next
    })
  }

  async function generarAnalisis() {
    if (seleccionadas.length === 0) return
    setGenerando(true); setAnalisis(null); setCeldaAbierta(null)
    const resueltas = await Promise.all(seleccionadas.map(resolverVotos))
    resueltas.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
    setAnalisis(resueltas)
    setGenerando(false)
    setPanelAbierto(false)
  }

  function cargarPreset() {
    const nuevos = {}
    VOTACIONES_CLAVE.filter(e => e.camara === camaraSel).forEach(e => {
      const candidatas = lista.filter(it => it.boletin === e.boletin)
      if (candidatas.length === 0) return
      const mejor = candidatas.reduce((a, b) =>
        (b.totalSi + b.totalNo + b.totalAbs) > (a.totalSi + a.totalNo + a.totalAbs) ? b : a)
      nuevos[mejor.key] = mejor
    })
    if (Object.keys(nuevos).length === 0) {
      alert('No se encontraron los boletines del set curado dentro del período buscado. Amplía el rango de fechas y vuelve a intentar.')
      return
    }
    setSeleccion(prev => ({ ...prev, ...nuevos }))
  }

  const validas = (analisis || []).filter(a => !a.error)

  const partidosPresentes = useMemo(() => {
    const set = new Set()
    validas.forEach(r => r.votos.forEach(v => set.add(v.partido)))
    return Object.keys(PARTIDO_COLORS).filter(p => set.has(p))
  }, [analisis]) // eslint-disable-line react-hooks/exhaustive-deps

  const camaraAnalisis = validas.length ? validas[0].camara : camaraSel
  const listaLegisladores = camaraAnalisis === 'senado' ? senadores : diputados

  function fidelidadDe(nombre, partido) {
    let coincide = 0, total = 0
    const detalle = []
    validas.forEach(r => {
      const voto = r.votos.find(v => v.nombre === nombre)
      if (!voto || voto.seleccion === 'otro') return
      const celda = calcularCelda(r.votos, partido)
      if (!celda) return
      total++
      const ok = voto.seleccion === celda.mayoria
      if (ok) coincide++
      detalle.push({ item: r, suVoto: voto.seleccion, posicionPartido: celda.mayoria, coincide: ok })
    })
    return { fidelidad: total ? Math.round((coincide / total) * 100) : null, total, detalle }
  }

  const legisladorInfo = listaLegisladores.find(p => p.nombre === legisladorSel) || null
  const fid = legisladorInfo ? fidelidadDe(legisladorInfo.nombre, legisladorInfo.partido) : null

  const minVotos = Math.max(2, Math.ceil(validas.length / 2))
  const ranking = useMemo(() => {
    if (!validas.length) return []
    const nombres = new Set()
    validas.forEach(r => r.votos.forEach(v => nombres.add(v.nombre)))
    const out = []
    nombres.forEach(n => {
      const persona = listaLegisladores.find(p => p.nombre === n)
      if (!persona) return
      const f = fidelidadDe(n, persona.partido)
      if (f.total >= minVotos) out.push({ nombre: n, partido: persona.partido, fidelidad: f.fidelidad, total: f.total })
    })
    return out.sort((a, b) => a.fidelidad - b.fidelidad).slice(0, 10)
  }, [analisis]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {/* ---------------- PANEL DE SELECCIÓN ---------------- */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={S.title}>🎯 Votaciones Clave</div>
            <div style={{ ...S.sub, marginBottom: 0 }}>Busca proyectos votados en sala, marca los que te interesan y genera el análisis de fidelidad de bancada.</div>
          </div>
          <button style={S.btnLight} onClick={() => setPanelAbierto(!panelAbierto)}>
            {panelAbierto ? '▲ Ocultar buscador' : '▼ Mostrar buscador'}
          </button>
        </div>

        {panelAbierto && (
          <>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 12, flexWrap: 'wrap' }}>
              {[['senado', '🏛 Senado'], ['diputados', '🏢 Cámara de Diputados']].map(([k, label]) => (
                <button key={k} onClick={() => { setCamaraSel(k); setLista([]); setListaError(null) }} style={{
                  padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13.5,
                  background: camaraSel === k ? '#0f172a' : '#f1f5f9', color: camaraSel === k ? 'white' : '#475569',
                }}>{label}</button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {camaraSel === 'senado' ? (
                <>
                  <Campo label="Desde"><input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={S.input} /></Campo>
                  <Campo label="Hasta"><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={S.input} /></Campo>
                </>
              ) : (
                <Campo label="Año"><input type="number" value={anio} onChange={e => setAnio(e.target.value)} style={{ ...S.input, width: 110 }} /></Campo>
              )}
              <button style={S.btnPrimary} onClick={buscar} disabled={cargandoLista}>
                {cargandoLista ? 'Buscando…' : '🔍 Buscar votaciones'}
              </button>
              {lista.length > 0 && (
                <button style={S.btnLight} onClick={cargarPreset} title="Marca automáticamente los boletines del set curado de votacionesClave.js">
                  ⭐ Cargar set curado
                </button>
              )}
            </div>

            {listaError && <div style={S.error}>⚠️ {listaError}</div>}

            {lista.length > 0 && (
              <>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
                  <input
                    placeholder="Filtrar por palabra o boletín (ej: pensiones, 18296-05)…"
                    value={busqueda} onChange={e => setBusqueda(e.target.value)}
                    style={{ ...S.input, flex: '1 1 260px', minWidth: 200 }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', cursor: 'pointer' }}>
                    <input type="checkbox" checked={soloLeyes} onChange={e => setSoloLeyes(e.target.checked)} />
                    Solo proyectos de ley
                  </label>
                  <span style={{ fontSize: 12.5, color: '#64748b' }}>{listaFiltrada.length} votaciones</span>
                </div>

                <div style={S.listaScroll}>
                  {listaFiltrada.slice(0, 400).map(it => {
                    const marcada = !!seleccion[it.key]
                    return (
                      <label key={it.key} style={{ ...S.itemFila, background: marcada ? '#fdf2f6' : 'transparent' }}>
                        <input type="checkbox" checked={marcada} onChange={() => toggle(it)} style={{ marginTop: 3, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: '#0f172a', lineHeight: 1.35 }}>{tituloCorto(it.descripcion, 150)}</div>
                          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 3 }}>
                            {it.fecha}{it.boletin ? ' · Boletín ' + it.boletin : ''} · {it.totalSi}-{it.totalNo}-{it.totalAbs} · {it.resultado}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                  {listaFiltrada.length > 400 && (
                    <div style={{ padding: 10, fontSize: 12, color: '#94a3b8' }}>Mostrando las primeras 400. Afina el filtro para ver más.</div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {seleccionadas.length > 0 && (
          <div style={S.barraSeleccion}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <b style={{ fontSize: 13.5 }}>{seleccionadas.length} votación(es) seleccionada(s)</b>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
                {seleccionadas.slice(0, 3).map(s => tituloCorto(s.descripcion, 40)).join(' · ')}
                {seleccionadas.length > 3 ? ` · +${seleccionadas.length - 3} más` : ''}
              </div>
            </div>
            <button style={S.btnLight} onClick={() => { setSeleccion({}); setAnalisis(null) }}>Limpiar</button>
            <button style={S.btnPrimary} onClick={generarAnalisis} disabled={generando}>
              {generando ? 'Calculando…' : '📊 Generar análisis'}
            </button>
          </div>
        )}

        <div style={S.methodology}>{METODOLOGIA_TEXTO}</div>
      </div>

      {/* ---------------- RESULTADO ---------------- */}
      {analisis && analisis.some(a => a.error) && (
        <div style={{ ...S.card, borderLeft: '4px solid #f59e0b' }}>
          <b style={{ fontSize: 13.5 }}>Algunas votaciones no pudieron incluirse:</b>
          {analisis.filter(a => a.error).map(a => (
            <div key={a.key} style={{ fontSize: 12.5, color: '#64748b', marginTop: 6 }}>
              • {tituloCorto(a.descripcion, 80)} — {a.error}
            </div>
          ))}
        </div>
      )}

      {analisis && validas.length > 0 && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={S.title}>Análisis de fidelidad — {validas.length} votación(es)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 9, padding: 3 }}>
                {[['partido', 'Por partido'], ['legislador', 'Por legislador'], ['ranking', 'Díscolos']].map(([k, l]) => (
                  <div key={k} onClick={() => setVista(k)} style={{
                    padding: '7px 13px', borderRadius: 7, fontWeight: 600, fontSize: 12.5, cursor: 'pointer',
                    background: vista === k ? 'white' : 'transparent', color: vista === k ? '#0f172a' : '#64748b',
                    boxShadow: vista === k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}>{l}</div>
                ))}
              </div>
              <button style={S.btnDark} onClick={() => generarPDFMatriz(camaraAnalisis, validas, partidosPresentes)}>⬇ PDF</button>
            </div>
          </div>

          {vista === 'partido' && (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={S.th}>Partido</th>
                      {validas.map(r => (
                        <th key={r.key} style={{ ...S.th, minWidth: 155 }}>
                          {tituloCorto(r.descripcion, 55)}
                          <div style={{ fontSize: 10, fontWeight: 400, color: '#94a3b8', textTransform: 'none', marginTop: 3 }}>
                            {r.fecha} · {r.totalSi}-{r.totalNo}-{r.totalAbs}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {partidosPresentes.map(partido => (
                      <tr key={partido}>
                        <td style={S.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#0f172a' }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: PARTIDO_COLORS[partido] || '#94a3b8', flexShrink: 0 }} />
                            {partido}
                          </div>
                        </td>
                        {validas.map(r => {
                          const celda = calcularCelda(r.votos, partido)
                          const key = partido + '__' + r.key
                          return (
                            <td key={r.key} style={S.td}>
                              <CeldaMatriz celda={celda} activa={celdaAbierta === key}
                                onClick={() => setCeldaAbierta(celdaAbierta === key ? null : key)} />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16, fontSize: 12, color: '#64748b' }}>
                <Legend color="#10b981" bg="#e5f6ea" label="Mayoría a favor (≥80%)" />
                <Legend color="#dc2626" bg="#fbe6e5" label="Mayoría en contra (≥80%)" />
                <Legend color="#b8860b" bg="#fbf3d9" label="Bancada dividida (<80%)" />
                <Legend color="#94a3b8" bg="#f0f1f4" label="Sin votos favor/contra" />
              </div>

              {celdaAbierta && (() => {
                const idx = celdaAbierta.indexOf('__')
                const partido = celdaAbierta.slice(0, idx)
                const rk = celdaAbierta.slice(idx + 2)
                const r = validas.find(x => x.key === rk)
                const celda = r ? calcularCelda(r.votos, partido) : null
                if (!celda) return null
                return (
                  <div style={S.detail}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{partido} — {tituloCorto(r.descripcion, 90)}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                      Posición mayoritaria: <b style={{ color: celda.mayoria === 'favor' ? '#10b981' : '#dc2626' }}>{celda.mayoria === 'favor' ? 'A favor' : 'En contra'}</b>
                      {' '}({celda.favor} a favor, {celda.contra} en contra · {celda.cohesion}% cohesión)
                    </div>
                    {celda.disidentes.length === 0
                      ? <div style={{ fontSize: 13, color: '#94a3b8' }}>Sin disidencias en esta bancada.</div>
                      : celda.disidentes.map(d => (
                        <div key={d.nombre} style={S.filaDetalle}>
                          <span>{d.nombre}</span>
                          <Badge tipo={d.seleccion} />
                        </div>
                      ))}
                  </div>
                )
              })()}
            </>
          )}

          {vista === 'legislador' && (
            <>
              <select value={legisladorSel} onChange={e => setLegisladorSel(e.target.value)} style={{ ...S.input, minWidth: 250, marginBottom: 14 }}>
                <option value="">Selecciona un parlamentario…</option>
                {listaLegisladores.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map(p => (
                  <option key={p.nombre} value={p.nombre}>{p.nombre} ({p.partido})</option>
                ))}
              </select>

              {legisladorInfo && fid && fid.total > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                      {legisladorInfo.partido} · {legisladorInfo.bloque} · {legisladorInfo.region}
                    </div>
                    <button style={S.btnDark} onClick={() => generarPDFFicha(legisladorInfo, fid)}>⬇ Ficha PDF</button>
                  </div>
                  <div style={S.fidscore}>
                    <div style={{ fontSize: 30, fontWeight: 700, color: '#be123c', fontFamily: "'Playfair Display', serif" }}>{fid.fidelidad}%</div>
                    <div style={{ fontSize: 12.5, color: '#9f1239' }}>
                      Fidelidad de bancada en las votaciones seleccionadas<br />
                      ({fid.detalle.filter(d => d.coincide).length} de {fid.total} coinciden con {legisladorInfo.partido})
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead><tr>
                        <th style={S.th}>Votación</th><th style={S.th}>Fecha</th>
                        <th style={S.th}>Su voto</th><th style={S.th}>Bancada</th><th style={S.th}>¿Coincide?</th>
                      </tr></thead>
                      <tbody>
                        {fid.detalle.map(d => (
                          <tr key={d.item.key}>
                            <td style={S.td}>{tituloCorto(d.item.descripcion, 70)}</td>
                            <td style={S.td}>{d.item.fecha}</td>
                            <td style={S.td}><Badge tipo={d.suVoto} /></td>
                            <td style={S.td}><Badge tipo={d.posicionPartido} /></td>
                            <td style={S.td}>{d.coincide ? '✅' : '❌'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {legisladorInfo && (!fid || fid.total === 0) && (
                <div style={{ fontSize: 13, color: '#64748b' }}>Sin votos favor/contra en las votaciones seleccionadas.</div>
              )}
            </>
          )}

          {vista === 'ranking' && (
            <>
              <div style={{ ...S.sub, marginBottom: 12 }}>
                Quiénes más se apartaron de su bancada en las votaciones seleccionadas
                (requiere al menos {minVotos} votos válidos para aparecer).
              </div>
              {ranking.length === 0
                ? <div style={{ fontSize: 13, color: '#64748b' }}>Selecciona más votaciones para que el ranking sea significativo.</div>
                : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr>
                      <th style={S.th}>#</th><th style={S.th}>Parlamentario</th>
                      <th style={S.th}>Partido</th><th style={S.th}>Fidelidad</th><th style={S.th}>Votos</th>
                    </tr></thead>
                    <tbody>
                      {ranking.map((r, i) => (
                        <tr key={r.nombre}>
                          <td style={S.td}>{i + 1}</td>
                          <td style={{ ...S.td, fontWeight: 600 }}>{r.nombre}</td>
                          <td style={S.td}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 9, height: 9, borderRadius: '50%', background: PARTIDO_COLORS[r.partido] || '#94a3b8' }} />
                              {r.partido}
                            </span>
                          </td>
                          <td style={{ ...S.td, fontWeight: 700, color: r.fidelidad < 70 ? '#dc2626' : r.fidelidad < 90 ? '#b8860b' : '#10b981' }}>{r.fidelidad}%</td>
                          <td style={S.td}>{r.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Campo({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      {children}
    </div>
  )
}

function CeldaMatriz({ celda, activa, onClick }) {
  if (!celda) return <div style={{ textAlign: 'center', padding: '8px 6px', borderRadius: 9, background: '#f0f1f4', color: '#94a3b8', fontSize: 12 }}>—</div>
  const esFavor = celda.mayoria === 'favor'
  const dividida = celda.cohesion < 80
  const bg = dividida ? '#fbf3d9' : (esFavor ? '#e5f6ea' : '#fbe6e5')
  const color = dividida ? '#b8860b' : (esFavor ? '#10b981' : '#dc2626')
  return (
    <button onClick={onClick} style={{
      width: '100%', border: activa ? `2px solid ${color}` : 'none', cursor: 'pointer', borderRadius: 9,
      padding: '8px 6px', fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5, background: bg, color,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    }}>
      <span>{dividida ? 'Dividida' : (esFavor ? 'A favor' : 'En contra')}</span>
      <span style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.85 }}>{celda.cohesion}% · {celda.disidentes.length} disid.</span>
    </button>
  )
}

function Badge({ tipo }) {
  const esFavor = tipo === 'favor'
  return <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: esFavor ? '#e5f6ea' : '#fbe6e5', color: esFavor ? '#10b981' : '#dc2626' }}>{esFavor ? 'A favor' : 'En contra'}</span>
}

function Legend({ color, bg, label }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <span style={{ width: 11, height: 11, borderRadius: 4, background: bg, border: `1px solid ${color}` }} />{label}
  </span>
}

// ---------------------------------------------------------------------------
// PDFs (jsPDF vía CDN, igual que en Votaciones.jsx)
// ---------------------------------------------------------------------------
function pdfBase() {
  if (!window.jspdf || !window.jspdf.jsPDF) { alert('El generador de PDF aún está cargando. Intenta de nuevo en un segundo.'); return null }
  const { jsPDF } = window.jspdf
  const doc = new jsPDF()
  doc.setFontSize(14); doc.setFont(undefined, 'bold')
  doc.text('Congreso Nacional de Chile 2026-2030', 14, 18)
  return doc
}

function generarPDFMatriz(camara, validas, partidos) {
  const doc = pdfBase(); if (!doc) return
  try {
    doc.setFontSize(11); doc.setFont(undefined, 'normal')
    doc.text('Votaciones Clave — Fidelidad de bancada · ' + (camara === 'senado' ? 'Senado' : 'Cámara de Diputados'), 14, 25)
    doc.setDrawColor(200); doc.line(14, 29, 196, 29)

    doc.setFontSize(8); doc.setTextColor(90)
    let y = 35
    doc.text('Votaciones incluidas en este análisis:', 14, y); y += 4
    validas.forEach((r, i) => {
      const linea = `${i + 1}. ${tituloCorto(r.descripcion, 105)} (${r.fecha}${r.boletin ? ', Bol. ' + r.boletin : ''})`
      doc.splitTextToSize(linea, 180).forEach(l => { doc.text(l, 14, y); y += 4 })
    })
    doc.setTextColor(0)

    const head = [['Partido', ...validas.map((r, i) => String(i + 1))]]
    const body = partidos.map(p => [p, ...validas.map(r => {
      const c = calcularCelda(r.votos, p)
      if (!c) return '—'
      const label = c.cohesion < 80 ? 'Dividida' : (c.mayoria === 'favor' ? 'A favor' : 'En contra')
      return `${label} (${c.cohesion}%)`
    })])

    doc.autoTable({ startY: y + 4, head, body, styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [190, 18, 60] }, margin: { left: 14, right: 14 } })
    doc.setFontSize(7.5); doc.setTextColor(140)
    doc.text('Las columnas están numeradas según el listado de arriba. Generado desde congreso-chile.vercel.app', 14, 290)
    doc.save('votaciones-clave-' + camara + '.pdf')
  } catch (e) { alert('No se pudo generar el PDF: ' + e.message) }
}

function generarPDFFicha(legislador, fid) {
  const doc = pdfBase(); if (!doc) return
  try {
    doc.setFontSize(12); doc.setFont(undefined, 'normal')
    doc.text('Ficha de Fidelidad Legislativa', 14, 25)
    doc.setDrawColor(200); doc.line(14, 29, 196, 29)
    doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text(legislador.nombre, 14, 40)
    doc.setFontSize(10); doc.setFont(undefined, 'normal')
    doc.text(`${legislador.partido} · ${legislador.bloque} · ${legislador.region}`, 14, 47)
    doc.setFontSize(11); doc.setFont(undefined, 'bold')
    doc.text(`Fidelidad de bancada: ${fid.fidelidad}%`, 14, 58)
    doc.setFontSize(9); doc.setFont(undefined, 'normal')
    doc.text(`(${fid.detalle.filter(d => d.coincide).length} de ${fid.total} votos coinciden con su partido)`, 14, 64)

    doc.autoTable({
      startY: 72,
      head: [['Votación', 'Fecha', 'Su voto', 'Bancada', '¿Coincide?']],
      body: fid.detalle.map(d => [
        tituloCorto(d.item.descripcion, 60), d.item.fecha,
        d.suVoto === 'favor' ? 'A favor' : 'En contra',
        d.posicionPartido === 'favor' ? 'A favor' : 'En contra',
        d.coincide ? 'Sí' : 'No',
      ]),
      styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [190, 18, 60] }, margin: { left: 14, right: 14 },
    })
    doc.setFontSize(7.5); doc.setTextColor(140)
    doc.text('Generado desde congreso-chile.vercel.app', 14, 290)
    doc.save('ficha-fidelidad-' + norm(legislador.nombre).replace(/\s+/g, '-') + '.pdf')
  } catch (e) { alert('No se pudo generar el PDF: ' + e.message) }
}

const S = {
  card: { background: 'white', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  title: { fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  sub: { fontSize: 13, color: '#64748b', marginBottom: 16 },
  input: { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Inter, sans-serif', background: 'white', color: '#334155' },
  btnPrimary: { padding: '10px 18px', background: '#be123c', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13.5, fontFamily: 'Inter, sans-serif' },
  btnDark: { padding: '9px 16px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' },
  btnLight: { padding: '9px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' },
  error: { marginTop: 12, padding: '10px 14px', background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 },
  listaScroll: { maxHeight: 380, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 10, marginTop: 10 },
  itemFila: { display: 'flex', gap: 10, padding: '10px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', alignItems: 'flex-start' },
  barraSeleccion: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 16, padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 },
  methodology: { fontSize: 12, color: '#5b21b6', background: '#f5f0ff', borderRadius: 9, padding: '10px 14px', marginTop: 14, lineHeight: 1.5 },
  th: { textAlign: 'left', fontSize: 10.5, letterSpacing: 0.3, color: '#64748b', textTransform: 'uppercase', padding: '8px 10px', borderBottom: '1px solid #e2e8f0', verticalAlign: 'bottom' },
  td: { padding: '8px 10px', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' },
  detail: { marginTop: 16, padding: '14px 16px', background: '#fbfbfd', border: '1px dashed #e2e8f0', borderRadius: 10, fontSize: 13 },
  filaDetalle: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #e2e8f0', fontSize: 13 },
  fidscore: { display: 'flex', alignItems: 'center', gap: 14, background: '#fdf2f6', padding: '12px 16px', borderRadius: 10, margin: '14px 0 16px' },
}
