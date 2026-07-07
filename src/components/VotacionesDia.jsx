import { useState, useEffect } from 'react'
import { diputados, senadores, PARTIDO_COLORS } from '../data'

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
    const score = shared + (it.sur && q.has(it.sur) ? 10 : 0)   // el apellido pesa y desempata
    if (score > bestScore) { bestScore = score; best = it.person }
  }
  return bestScore >= 2 ? best : null
}
const DIP_TOKENS = diputados.map(d => ({ person: d, toks: new Set(norm(d.nombre).split(' ')), sur: surnameDe(d.nombre) }))
function buscarDiputado(nombreApi) { return matchPersona(nombreApi, DIP_TOKENS) }
const SEN_TOKENS = senadores.map(s => ({ person: s, toks: new Set(norm(s.nombre).split(' ')), sur: surnameDe(s.nombre) }))
function buscarSenador(nombreApi) { return matchPersona(nombreApi, SEN_TOKENS) }
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
function fasesDe(texto) {
  const t = (texto || '').toLowerCase()
  const out = []
  if (t.includes('general')) out.push({ label: 'Votación en general', color: '#0e7490' })
  if (t.includes('particular')) out.push({ label: 'Votación en particular', color: '#7c3aed' })
  return out
}
function categoriaDe(v, tipoCamara) {
  if (v.boletin || boletinDe(v.descripcion)) return 'ley'
  const txt = ((tipoCamara || '') + ' ' + (v.descripcion || '') + ' ' + (v.tipo || '')).toLowerCase()
  if (txt.includes('acuerdo')) return 'acuerdo'
  if (txt.includes('resoluci')) return 'resolucion'
  return 'otra'
}
const SECCIONES = [
  { key: 'ley', label: 'Proyectos de ley', color: '#0f766e', match: c => c === 'ley' },
  { key: 'ar', label: 'Proyectos de acuerdo y de resolución', color: '#b45309', match: c => c === 'acuerdo' || c === 'resolucion' },
  { key: 'otra', label: 'Otras votaciones de la sesión (cuenta y sala)', color: '#475569', match: c => c === 'otra' }
]
// Nombres femeninos que NO terminan en 'a' (para no fallar con Consuelo, Carmen, Karol, etc.)
const FEM_EXTRA = new Set(['carmen', 'beatriz', 'isabel', 'consuelo', 'maite', 'raquel', 'marisol', 'nancy', 'karen', 'nathalie', 'mercedes', 'pilar', 'ines', 'soledad', 'ruth', 'sol', 'luz', 'flor', 'karol', 'belen', 'noemi', 'jael', 'damaris', 'ester', 'esther', 'lourdes', 'dolores', 'nieves', 'cruz', 'paz', 'leonor', 'marlene'])
// Nombres masculinos que terminan en 'a' (excepciones a la regla)
const MASC_EXTRA = new Set(['joshua', 'elia', 'aldo', 'bauista'])
function inferSexo(nombre) {
  const first = norm(nombre).split(' ').filter(Boolean)[0] || ''
  if (!first) return ''
  if (FEM_EXTRA.has(first)) return 'F'
  if (MASC_EXTRA.has(first)) return 'M'
  return first.endsWith('a') ? 'F' : 'M'
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
  const [articulos, setArticulos] = useState({})      // cache por votaciónId → descripción (Articulo) del proyecto
  const [materias, setMaterias] = useState({})        // cache por votaciónId → materia (página Cámara) para votaciones sin boletín
  const [tiposCamara, setTiposCamara] = useState({})  // cache por votaciónId → tipo de votación (Acuerdo/Resolución/etc.)
  const [camara, setCamara] = useState('dip')         // 'dip' = Cámara · 'sen' = Senado
  const [senDelDia, setSenDelDia] = useState([])       // votaciones del Senado del día
  const [senLoading, setSenLoading] = useState(false)
  const [senAdvertencias, setSenAdvertencias] = useState([])  // avisos de posibles huecos/datos manuales
  const [generandoPDF, setGenerandoPDF] = useState(null)      // id de la votación cuyo PDF se está generando

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

  // Votaciones del Senado para la fecha elegida (API moderna)
  useEffect(() => {
    if (camara !== 'sen' || !fecha) return
    let activo = true
    setSenLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/votaciones?senadoDia=${fecha}`)
        const data = await res.json()
        if (activo) {
          setSenDelDia(data.votaciones || [])
          setSenAdvertencias(data.advertencias || [])
        }
      } catch { if (activo) { setSenDelDia([]); setSenAdvertencias([]) } }
      if (activo) setSenLoading(false)
    })()
    return () => { activo = false }
  }, [camara, fecha])

  const fechasConVotaciones = [...new Set(todas.map(v => v.fecha))].sort().reverse()
  const delDia = camara === 'sen'
    ? [...senDelDia]
        .sort((a, b) => (a.hora || '').localeCompare(b.hora || '') || (parseInt(a.id) || 0) - (parseInt(b.id) || 0))
        .map((v, i) => ({ ...v, numero: i + 1 }))
    : todas
        .filter(v => v.fecha === fecha)
        .sort((a, b) => (a.fechaHora || '').localeCompare(b.fechaHora || '') || (parseInt(a.id) || 0) - (parseInt(b.id) || 0))
        .map((v, i) => ({ ...v, numero: i + 1 }))

  // Para cada boletín del día: buscar el título del proyecto y el detalle por votación (general/particular/artículo)
  useEffect(() => {
    if (camara !== 'dip') return
    let activo = true
    const boletines = [...new Set(delDia.map(v => boletinDe(v.descripcion)).filter(Boolean))]
      .filter(b => titulos[b] === undefined)
    if (boletines.length === 0) return
    // marcar como "cargando" para no repetir
    setTitulos(prev => { const n = { ...prev }; boletines.forEach(b => { if (n[b] === undefined) n[b] = null }); return n })
    boletines.forEach(async (b) => {
      // Título del proyecto (API Senado)
      try {
        const res = await fetch(`/api/votaciones?proyecto=${b}`)
        const data = await res.json()
        if (activo) setTitulos(prev => ({ ...prev, [b]: (data && data.titulo) ? data.titulo : '' }))
      } catch {
        if (activo) setTitulos(prev => ({ ...prev, [b]: '' }))
      }
      // Descripción por votación: general / particular / artículo (API Cámara por boletín)
      try {
        const res2 = await fetch(`/api/votaciones?boletin=${b}`)
        const data2 = await res2.json()
        if (activo && data2 && data2.votaciones) {
          setArticulos(prev => {
            const n = { ...prev }
            data2.votaciones.forEach(vt => { if (vt.id) n[String(vt.id)] = vt.descripcion || '' })
            return n
          })
        }
      } catch { /* sin detalle por boletín */ }
    })
    return () => { activo = false }
  }, [fecha, todas])  // eslint-disable-line

  // Para votaciones SIN boletín (acuerdos, resoluciones, cuenta) el detalle por diputado
  // solo está en la web de la Cámara (bloqueada al servidor); se muestra con un botón al abrir.

  function enriquecer(votos, esSenado) {
    return (votos || []).map(voto => {
      if (esSenado) {
        const sen = buscarSenador(voto.diputado)
        return {
          ...voto,
          partido: sen?.partido || 'Sin partido',
          apellido: apellidoDe(sen?.nombre || voto.diputado),
          region: sen?.region || '',
          distrito: '',
          bloque: sen?.bloque || '',
          sexo: sen ? inferSexo(sen.nombre) : inferSexo(voto.diputado)
        }
      }
      const dip = buscarDiputado(voto.diputado)
      return {
        ...voto,
        partido: dip?.partido || 'Sin partido',
        apellido: apellidoDe(dip?.nombre || voto.diputado),
        region: dip?.region || '',
        distrito: dip?.distrito != null ? dip.distrito : '',
        bloque: dip?.bloque || '',
        sexo: dip ? inferSexo(dip.nombre) : ''
      }
    })
  }

  async function toggleDetalle(v) {
    if (expandId === v.id) { setExpandId(null); return }
    setExpandId(v.id)
    if (detalles[v.id]) return
    // Senado: los votos ya vienen incluidos en la votación del día
    if (camara === 'sen') {
      setDetalles(prev => ({ ...prev, [v.id]: { votos: enriquecer(v.votos || [], true) } }))
      return
    }
    setLoadingDet(v.id)
    try {
      // Detalle por diputado desde datos abiertos (funciona en proyectos de ley).
      // En acuerdos/resoluciones/cuenta vendrá vacío y se mostrará el botón a camara.cl.
      let votos = []
      const res = await fetch(`/api/votaciones?votacionId=${v.id}`)
      const data = await res.json()
      if (!data.error) votos = data.votos || []
      setDetalles(prev => ({ ...prev, [v.id]: { votos: enriquecer(votos) } }))
    } catch (e) {
      setDetalles(prev => ({ ...prev, [v.id]: { error: e.message } }))
    }
    setLoadingDet(null)
  }

  async function descargarPDF(v) {
    setGenerandoPDF(v.id)
    try {
      let votos = []
      if (camara === 'sen') {
        votos = enriquecer(v.votos || [], true)
      } else if (detalles[v.id]?.votos?.length) {
        votos = detalles[v.id].votos
      } else {
        try {
          const res = await fetch(`/api/votaciones?votacionId=${v.id}`)
          const data = await res.json()
          if (!data.error) votos = enriquecer(data.votos || [])
        } catch (e) { /* seguimos y generamos el PDF sin desglose individual */ }
      }
      generarPDFVotacion(v, votos, camara)
    } finally {
      setGenerandoPDF(null)
    }
  }

  function renderFila(v, idx) {
    const total = v.totalSi + v.totalNo + v.totalAbs
    const abierto = expandId === v.id
    const det = detalles[v.id]
    const bol = v.boletin || boletinDe(v.descripcion)
    const titProy = bol ? titulos[bol] : undefined
    const artic = articulos[String(v.id)]
    const materia = materias[String(v.id)]                  // materia (página Cámara) para votaciones sin boletín
    const fases = fasesDe([artic, v.tipo, v.descripcion].filter(Boolean).join(' '))
    const headline = (titProy && titProy.length) ? titProy
      : (materia && materia.length) ? materia
      : (v.descripcion || v.tipo || '(Sin descripción registrada)')
    const esManual = v.fuente === 'manual'
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
            {esManual && (
              <span title={v.fuenteDetalle || 'Cargado manualmente'} style={{ fontSize: 10, fontWeight: 800, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, padding: '2px 7px', flexShrink: 0, marginTop: 2 }}>
                ⚠ Fuente: prensa
              </span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {fases.length > 0 && (
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                  {fases.map(f => (
                    <span key={f.label} style={{ fontSize: 10.5, fontWeight: 800, color: 'white', background: f.color, borderRadius: 5, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: 0.4 }}>{f.label}</span>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600, lineHeight: 1.35 }}>{headline}</div>
              {artic && artic.length > 0 ? (
                <div style={{ fontSize: 12, color: '#334155', marginTop: 3, lineHeight: 1.4 }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Se vota: </span>{artic}
                </div>
              ) : (titProy && titProy.length && v.descripcion && v.descripcion !== headline && (
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{v.descripcion}</div>
              ))}
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {bol && <span style={{ fontWeight: 700, color: '#0f766e' }}>Boletín {bol}</span>}
                {bol && titulos[bol] === null && <span>buscando detalle…</span>}
                {!bol && materia === null && <span>buscando materia…</span>}
                {v.quorum && <span>Quórum: {v.quorum}</span>}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); descargarPDF(v) }}
              disabled={generandoPDF === v.id}
              title="Descargar esta votación en PDF"
              style={{
                fontSize: 11, fontWeight: 700, color: '#0f766e', background: '#f0fdfa',
                border: '1px solid #99f6e4', borderRadius: 6, padding: '3px 8px',
                cursor: generandoPDF === v.id ? 'default' : 'pointer', flexShrink: 0,
                opacity: generandoPDF === v.id ? 0.6 : 1, whiteSpace: 'nowrap'
              }}
            >
              {generandoPDF === v.id ? '⏳' : '📄'} PDF
            </button>
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
            ) : det?.votos && det.votos.length > 0 ? (
              <DesgloseVotos votos={det.votos} esSenado={camara === 'sen'} />
            ) : camara === 'sen' ? (
              esManual ? (
                <div style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: 10, lineHeight: 1.5 }}>
                  La API del Senado no publicó esta votación. Los totales fueron cargados a mano desde{' '}
                  {v.fuenteUrl ? (
                    <a href={v.fuenteUrl} target="_blank" rel="noreferrer" style={{ color: '#0f766e', fontWeight: 700 }}>{v.fuenteDetalle}</a>
                  ) : v.fuenteDetalle}
                  . No hay desglose por senador disponible para esta fuente.
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 10 }}>
                  No hay votos individuales registrados para esta votación.
                </div>
              )
            ) : (
              <div style={{ textAlign: 'center', padding: '6px 4px' }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }}>
                  El detalle por diputado de este tipo de votación no está en los datos abiertos. Míralo en la página oficial de la Cámara (se abre en tu navegador):
                </div>
                <a href={`https://www.camara.cl/legislacion/sala_sesiones/votacion_detalle.aspx?prmIdVotacion=${v.id}`} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-block', padding: '9px 18px', background: '#0f766e', color: 'white', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                  Ver quién votó qué en camara.cl ↗
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    )
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
        <div style={S.sub}>Lo que ya se votó. Elige cualquier fecha de 2026 · {camara === 'sen' ? 'API oficial senado.cl' : 'API oficial opendata.camara.cl'}</div>

        <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: '#f1f5f9', borderRadius: 10, marginBottom: 12 }}>
          {[['dip', '🏛 Cámara de Diputados'], ['sen', '⚖️ Senado']].map(([k, lbl]) => (
            <button key={k} onClick={() => { setCamara(k); setExpandId(null) }}
              style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: camara === k ? '#0f766e' : 'transparent', color: camara === k ? 'white' : '#475569' }}>
              {lbl}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <label style={S.label}>Fecha</label>
            <input type="date" value={fecha} min="2026-01-01" max="2026-12-31"
              onChange={e => { setFecha(e.target.value); setExpandId(null) }} style={S.input} />
          </div>
        </div>

        {!loading && camara === 'dip' && fechasConVotaciones.length > 0 && (
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
        {camara === 'sen' && (
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
            El Senado se consulta por fecha. Elige un día arriba; si no hubo votaciones, prueba otra fecha (las sesiones suelen ser martes, miércoles y jueves).
          </div>
        )}

        {error && <div style={S.error}>⚠️ {error}</div>}
      </div>

      {loading && (
        <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#64748b' }}>
          ⏳ Cargando votaciones del año...
        </div>
      )}

      {!loading && !error && camara === 'dip' && todas.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#64748b' }}>
          La API no devolvió votaciones para 2026 todavía. Puede que aún no estén cargadas en opendata.camara.cl.
        </div>
      )}

      {camara === 'sen' && senLoading && (
        <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#64748b' }}>
          ⏳ Cargando votaciones del Senado...
        </div>
      )}

      {!loading && (camara === 'sen' ? !senLoading : todas.length > 0) && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, flexWrap: 'wrap', gap: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>{formatFecha(fecha)}{camara === 'sen' ? ' · Senado' : ''}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{delDia.length} {delDia.length === 1 ? 'votación' : 'votaciones'}</div>
          </div>

          {camara === 'sen' && senAdvertencias.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#92400e', marginBottom: 4 }}>
                ⚠️ Posible dato incompleto en la fuente oficial del Senado
              </div>
              {senAdvertencias.map((a, i) => (
                <div key={i} style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5, marginTop: i > 0 ? 4 : 0 }}>{a}</div>
              ))}
            </div>
          )}

          {delDia.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 13 }}>
              {camara === 'sen'
                ? 'El Senado no registró votaciones de sala ese día. Prueba con otra fecha (martes a jueves suelen tener sesión).'
                : 'No hay votaciones registradas ese día. Prueba con uno de los días marcados arriba.'}
            </div>
          )}

          {SECCIONES.map(sec => {
            const items = delDia.filter(v => sec.match(categoriaDe(v, tiposCamara[String(v.id)])))
            if (items.length === 0) return null
            return (
              <div key={sec.key} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 10px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: sec.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: sec.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{sec.label}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{items.length}</span>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                </div>
                {items.map((v, idx) => renderFila(v, idx))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DesgloseVotos({ votos, esSenado }) {
  const [orden, setOrden] = useState('partido')
  const [filtroOpcion, setFiltroOpcion] = useState('Todos')
  const [fPartido, setFPartido] = useState('Todos')
  const [fRegion, setFRegion] = useState('Todos')
  const [fDistrito, setFDistrito] = useState('Todos')
  const [fSexo, setFSexo] = useState('Todos')
  const [fBloque, setFBloque] = useState('Todos')

  const partidos = [...new Set(votos.map(v => v.partido).filter(Boolean))].sort()
  const regiones = [...new Set(votos.map(v => v.region).filter(Boolean))].sort()
  const distritos = [...new Set(votos.map(v => v.distrito).filter(d => d !== '' && d != null))].sort((a, b) => a - b)
  const hayBloque = votos.some(v => v.bloque)
  const haySexo = votos.some(v => v.sexo)

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
  const filtrados = ordenados.filter(v =>
    (filtroOpcion === 'Todos' || v.opcion === filtroOpcion) &&
    (fPartido === 'Todos' || v.partido === fPartido) &&
    (fRegion === 'Todos' || v.region === fRegion) &&
    (fDistrito === 'Todos' || String(v.distrito) === fDistrito) &&
    (fSexo === 'Todos' || v.sexo === fSexo) &&
    (fBloque === 'Todos' || v.bloque === fBloque)
  )

  // Conteo por opción del subconjunto filtrado
  const cuenta = { Afirmativo: 0, 'En Contra': 0, Abstencion: 0, otros: 0 }
  filtrados.forEach(v => { cuenta[v.opcion] !== undefined ? cuenta[v.opcion]++ : cuenta.otros++ })
  const hayFiltro = [filtroOpcion, fPartido, fRegion, fDistrito, fSexo, fBloque].some(x => x !== 'Todos')

  function limpiar() {
    setFiltroOpcion('Todos'); setFPartido('Todos'); setFRegion('Todos'); setFDistrito('Todos'); setFSexo('Todos'); setFBloque('Todos')
  }

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

      {/* FILTROS */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <select value={fPartido} onChange={e => setFPartido(e.target.value)} style={S.select}>
            <option value="Todos">Todos los partidos</option>
            {partidos.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {hayBloque && (
            <select value={fBloque} onChange={e => setFBloque(e.target.value)} style={S.select}>
              <option value="Todos">Oficialismo y oposición</option>
              <option value="Oficialismo">Solo Oficialismo</option>
              <option value="Oposición">Solo Oposición</option>
            </select>
          )}
          <select value={fRegion} onChange={e => setFRegion(e.target.value)} style={S.select}>
            <option value="Todos">Todas las regiones</option>
            {regiones.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {distritos.length > 0 && (
            <select value={fDistrito} onChange={e => setFDistrito(e.target.value)} style={S.select}>
              <option value="Todos">Todos los distritos</option>
              {distritos.map(d => <option key={d} value={String(d)}>Distrito {d}</option>)}
            </select>
          )}
          {haySexo && (
            <select value={fSexo} onChange={e => setFSexo(e.target.value)} style={S.select}>
              <option value="Todos">Hombres y mujeres</option>
              <option value="F">Solo mujeres</option>
              <option value="M">Solo hombres</option>
            </select>
          )}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 9, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{filtrados.length} de {votos.length}</span>
          <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>✓{cuenta.Afirmativo} a favor</span>
          <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>✗{cuenta['En Contra']} en contra</span>
          {cuenta.Abstencion > 0 && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>~{cuenta.Abstencion} abst.</span>}
          {hayFiltro && <button onClick={limpiar} style={{ fontSize: 11, fontWeight: 600, color: '#0f766e', background: 'white', border: '1px solid #cbd5e1', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', marginLeft: 'auto' }}>Limpiar filtros</button>}
        </div>
      </div>

      {votos.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8' }}>No hay votos individuales para esta votación.</div>
      ) : filtrados.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 16 }}>Ningún diputado coincide con esos filtros.</div>
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
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{v.partido}{v.distrito ? ' · D' + v.distrito : ''}{v.region ? ' · ' + v.region : ''}</div>
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

// ---------------------------------------------------------------------------
// Generación de PDF por votación (usa jsPDF + jspdf-autotable cargados por
// CDN en index.html — ver window.jspdf). No depende de ningún build step.
// ---------------------------------------------------------------------------
function generarPDFVotacion(v, votos, camaraSel) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('El generador de PDF todavía está cargando. Espera un segundo y vuelve a intentarlo.')
    return
  }
  const { jsPDF } = window.jspdf
  const doc = new jsPDF()
  const total = (v.totalSi || 0) + (v.totalNo || 0) + (v.totalAbs || 0)

  doc.setFontSize(14)
  doc.setFont(undefined, 'bold')
  doc.text('Congreso Nacional de Chile 2026-2030', 14, 18)
  doc.setFontSize(11)
  doc.setFont(undefined, 'normal')
  doc.text(camaraSel === 'sen' ? 'Votación del Senado' : 'Votación de la Cámara de Diputados', 14, 25)
  doc.setDrawColor(200)
  doc.line(14, 29, 196, 29)

  let y = 38
  doc.setFontSize(12)
  doc.setFont(undefined, 'bold')
  const headline = v.descripcion || v.tipo || '(Sin descripción registrada)'
  const headlineLines = doc.splitTextToSize(headline, 182)
  doc.text(headlineLines, 14, y)
  y += headlineLines.length * 6 + 4

  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  if (v.boletin) { doc.text('Boletín: ' + v.boletin, 14, y); y += 6 }
  if (v.sesion) { doc.text('Sesión: ' + v.sesion, 14, y); y += 6 }
  if (v.fecha) { doc.text('Fecha: ' + v.fecha, 14, y); y += 6 }
  if (v.quorum) { doc.text('Quórum: ' + v.quorum, 14, y); y += 6 }
  doc.text('Resultado: ' + (v.resultado || '—'), 14, y); y += 6
  doc.text(
    'Votos - A favor: ' + (v.totalSi || 0) + '   En contra: ' + (v.totalNo || 0) +
    '   Abstención: ' + (v.totalAbs || 0) + (total ? '   (Total: ' + total + ')' : ''),
    14, y
  )
  y += 10

  if (v.fuente === 'manual') {
    doc.setTextColor(150, 90, 10)
    const nota = doc.splitTextToSize(
      'Esta votación no fue publicada por la API oficial del Senado; los totales fueron ' +
      'cargados a mano (fuente: ' + (v.fuenteDetalle || 'prensa') + ').',
      182
    )
    doc.text(nota, 14, y)
    y += nota.length * 5 + 6
    doc.setTextColor(0)
  }

  if (votos && votos.length > 0) {
    const filas = votos
      .slice()
      .sort((a, b) => (a.partido || 'ZZ').localeCompare(b.partido || 'ZZ') || (a.apellido || '').localeCompare(b.apellido || ''))
      .map(vt => [vt.diputado, vt.partido || 'Sin partido', vt.region || '', OPCION_LABELS[vt.opcion] || vt.opcion])
    doc.autoTable({
      startY: y,
      head: [['Nombre', 'Partido', 'Región', 'Voto']],
      body: filas,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 118, 110] },
      margin: { left: 14, right: 14 }
    })
  } else {
    doc.setFontSize(10)
    doc.text('No hay desglose de votos individuales disponible para esta votación.', 14, y)
  }

  doc.setFontSize(8)
  doc.setTextColor(140)
  doc.text('Generado desde congreso-chile.vercel.app', 14, 290)

  doc.save('votacion-' + camaraSel + '-' + (v.id || 'sn') + '.pdf')
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
