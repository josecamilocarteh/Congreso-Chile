
import { useState, useEffect, useMemo } from 'react'
import { senadores, diputados, PARTIDO_COLORS } from '../data'
import { VOTACIONES_CLAVE, CATEGORIAS_CLAVE, METODOLOGIA_TEXTO } from '../votacionesClave'

// ---------------------------------------------------------------------------
// Cruce de nombres API -> ficha de parlamentario (mismo patrón usado en
// Votaciones.jsx y VotacionesSenado.jsx, reescrito aquí para que este
// componente no dependa de imports internos de otros componentes).
// ---------------------------------------------------------------------------
const CONECTORES = new Set(['y', 'de', 'del', 'la', 'las', 'los', 'van'])

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
    const score = shared * 10 + (it.sur && q.has(it.sur) ? 1 : 0)
    if (score > bestScore) { bestScore = score; best = it.person }
  }
  return bestScore >= 20 ? best : null
}
const SEN_TOKENS = senadores.map(s => ({ person: s, toks: new Set(norm(s.nombre).split(' ')), sur: surnameDe(s.nombre) }))
const DIP_TOKENS = diputados.map(d => ({ person: d, toks: new Set(norm(d.nombre).split(' ')), sur: surnameDe(d.nombre) }))
function buscarSenador(nombreApi) { return matchPersona(nombreApi, SEN_TOKENS) }
function buscarDiputado(nombreApi) { return matchPersona(nombreApi, DIP_TOKENS) }

// Normaliza la selección/opción cruda de cada API a 'favor' | 'contra' | 'otro'
function posicionSimple(raw, camara) {
  const s = norm(raw)
  if (camara === 'senado') {
    if (s === 'si') return 'favor'
    if (s === 'no') return 'contra'
    return 'otro' // abstencion, pareo
  }
  if (s === 'afirmativo') return 'favor'
  if (s === 'en contra') return 'contra'
  return 'otro' // abstencion, no vota, dispensado, pareo
}

// ---------------------------------------------------------------------------
// Carga de una votación clave: consulta la API oficial (vía /api/votaciones,
// el mismo proxy que ya usan Votaciones.jsx y VotacionesSenado.jsx) y la
// reduce a una lista de {nombre, partido, bloque, seleccion}.
// ---------------------------------------------------------------------------
async function cargarVotacionClave(entrada) {
  try {
    if (entrada.camara === 'senado') {
      const res = await fetch(`/api/votaciones?senado=${encodeURIComponent(entrada.boletin)}`)
      const data = await res.json()
      if (data.error) return { entrada, error: data.error }
      if (!data.votaciones || !data.votaciones.length) return { entrada, error: 'Sin votaciones registradas para este boletín en el Senado.' }

      const principal = data.votaciones.reduce((a, b) => {
        const totalA = (a.si || 0) + (a.no || 0) + (a.abstencion || 0)
        const totalB = (b.si || 0) + (b.no || 0) + (b.abstencion || 0)
        return totalB > totalA ? b : a
      })

      const votos = (principal.votos || [])
        .map(v => {
          const sen = buscarSenador(v.parlamentario)
          if (!sen) return null
          return { nombre: sen.nombre, partido: sen.partido, bloque: sen.bloque, seleccion: posicionSimple(v.seleccion, 'senado') }
        })
        .filter(Boolean)

      return {
        entrada, error: null, votos,
        resumen: { si: principal.si || 0, no: principal.no || 0, abstencion: principal.abstencion || 0 },
        fechaVotacion: principal.fecha || entrada.fecha,
        resultado: (principal.si || 0) > (principal.no || 0) ? 'Aprobado' : 'Rechazado',
      }
    }

    // Cámara de Diputados: primero listar votaciones del boletín...
    const resLista = await fetch(`/api/votaciones?boletin=${encodeURIComponent(entrada.boletin)}`)
    const dataLista = await resLista.json()
    if (dataLista.error) return { entrada, error: dataLista.error }
    if (!dataLista.votaciones || !dataLista.votaciones.length) return { entrada, error: 'Sin votaciones registradas para este boletín en la Cámara.' }

    const principal = entrada.votacionIdFijo
      ? dataLista.votaciones.find(v => String(v.id) === String(entrada.votacionIdFijo)) || dataLista.votaciones[0]
      : dataLista.votaciones.reduce((a, b) => {
          const totalA = (a.totalSi || 0) + (a.totalNo || 0) + (a.totalAbs || 0)
          const totalB = (b.totalSi || 0) + (b.totalNo || 0) + (b.totalAbs || 0)
          return totalB > totalA ? b : a
        })

    // ...luego pedir el detalle voto-por-voto de esa votación específica.
    const resDetalle = await fetch(`/api/votaciones?votacionId=${encodeURIComponent(principal.id)}`)
    const detalle = await resDetalle.json()
    if (detalle.error) return { entrada, error: detalle.error }

    const votos = (detalle.votos || [])
      .map(v => {
        const dip = buscarDiputado(v.diputado)
        if (!dip) return null
        return { nombre: dip.nombre, partido: dip.partido, bloque: dip.bloque, seleccion: posicionSimple(v.opcion, 'diputados') }
      })
      .filter(Boolean)

    return {
      entrada, error: null, votos,
      resumen: { si: principal.totalSi || 0, no: principal.totalNo || 0, abstencion: principal.totalAbs || 0 },
      fechaVotacion: principal.fecha || entrada.fecha,
      resultado: principal.resultado || ((principal.totalSi || 0) > (principal.totalNo || 0) ? 'Aprobado' : 'Rechazado'),
    }
  } catch (e) {
    return { entrada, error: 'Error de red al consultar la API: ' + e.message }
  }
}

// Posición mayoritaria + cohesión de UN partido en UNA votación ya cargada
function calcularCelda(votos, partido) {
  const miembros = votos.filter(v => v.partido === partido && v.seleccion !== 'otro')
  if (miembros.length === 0) return null
  const favor = miembros.filter(v => v.seleccion === 'favor').length
  const contra = miembros.length - favor
  const mayoria = favor >= contra ? 'favor' : 'contra'
  const cohesion = Math.round((Math.max(favor, contra) / miembros.length) * 100)
  const disidentes = miembros.filter(v => v.seleccion !== mayoria)
  return { mayoria, cohesion, disidentes, favor, contra, total: miembros.length }
}

export default function VotacionesClave() {
  const [camaraSel, setCamaraSel] = useState('senado')
  const [vista, setVista] = useState('partido')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas')
  const [cache, setCache] = useState({})
  const [loading, setLoading] = useState(false)
  const [legisladorSel, setLegisladorSel] = useState('')
  const [celdaAbierta, setCeldaAbierta] = useState(null)

  const entradasCamara = useMemo(
    () => VOTACIONES_CLAVE.filter(e => e.camara === camaraSel),
    [camaraSel]
  )
  const entradasFiltradas = useMemo(
    () => entradasCamara.filter(e => categoriaFiltro === 'todas' || e.categoria === categoriaFiltro),
    [entradasCamara, categoriaFiltro]
  )

  // Carga (con cache) todas las votaciones de la cámara seleccionada
  useEffect(() => {
    const faltantes = entradasCamara.filter(e => !cache[e.id])
    if (faltantes.length === 0) return
    setLoading(true)
    Promise.all(faltantes.map(cargarVotacionClave)).then(resultados => {
      setCache(prev => {
        const next = { ...prev }
        resultados.forEach(r => { next[r.entrada.id] = r })
        return next
      })
      setLoading(false)
    })
  }, [camaraSel]) // eslint-disable-line react-hooks/exhaustive-deps

  const cargadas = entradasFiltradas.map(e => cache[e.id]).filter(Boolean)
  const cargando = loading || entradasFiltradas.some(e => !cache[e.id])

  // Partidos presentes en los datos ya cargados, en el orden de PARTIDO_COLORS
  const partidosPresentes = useMemo(() => {
    const set = new Set()
    cargadas.forEach(r => (r.votos || []).forEach(v => set.add(v.partido)))
    return Object.keys(PARTIDO_COLORS).filter(p => set.has(p))
  }, [cargadas])

  const listaLegisladores = camaraSel === 'senado' ? senadores : diputados

  function fidelidadDe(nombreLegislador, partido) {
    let coincide = 0, total = 0
    const detalle = []
    cargadas.forEach(r => {
      const voto = (r.votos || []).find(v => v.nombre === nombreLegislador)
      if (!voto || voto.seleccion === 'otro') return
      const celda = calcularCelda(r.votos, partido)
      if (!celda) return
      total++
      const ok = voto.seleccion === celda.mayoria
      if (ok) coincide++
      detalle.push({ entrada: r.entrada, suVoto: voto.seleccion, posicionPartido: celda.mayoria, coincide: ok })
    })
    return { fidelidad: total ? Math.round((coincide / total) * 100) : null, total, detalle }
  }

  const legisladorInfo = listaLegisladores.find(p => p.nombre === legisladorSel) || null
  const fid = legisladorInfo ? fidelidadDe(legisladorInfo.nombre, legisladorInfo.partido) : null

  return (
    <div>
      <div style={S.card}>
        <div style={S.title}>🎯 Votaciones Clave</div>
        <div style={S.sub}>Fidelidad de bancada en votaciones seleccionadas por su relevancia · Datos en tiempo real desde las APIs oficiales</div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[['senado', '🏛 Senado'], ['diputados', '🏢 Cámara de Diputados']].map(([key, label]) => (
            <button key={key} onClick={() => { setCamaraSel(key); setVista('partido'); setLegisladorSel(''); setCeldaAbierta(null) }} style={{
              padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13.5,
              background: camaraSel === key ? '#0f172a' : '#f1f5f9', color: camaraSel === key ? 'white' : '#475569',
            }}>{label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 9, padding: 3 }}>
            {[['partido', 'Vista por partido'], ['legislador', 'Vista por legislador']].map(([key, label]) => (
              <div key={key} onClick={() => setVista(key)} style={{
                padding: '7px 14px', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                background: vista === key ? 'white' : 'transparent', color: vista === key ? '#0f172a' : '#64748b',
                boxShadow: vista === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>{label}</div>
            ))}
          </div>
          <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)} style={S.select}>
            <option value="todas">Todas las categorías</option>
            {Object.entries(CATEGORIAS_CLAVE).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          {vista === 'legislador' && (
            <select value={legisladorSel} onChange={e => setLegisladorSel(e.target.value)} style={{ ...S.select, minWidth: 220 }}>
              <option value="">Selecciona un{camaraSel === 'senado' ? ' senador/a' : ' diputado/a'}...</option>
              {listaLegisladores.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map(p => (
                <option key={p.nombre} value={p.nombre}>{p.nombre} ({p.partido})</option>
              ))}
            </select>
          )}
        </div>

        <div style={S.methodology}>{METODOLOGIA_TEXTO}</div>

        {entradasFiltradas.length === 0 && (
          <div style={{ ...S.sub, marginTop: 14 }}>No hay votaciones clave curadas para esta cámara/categoría todavía.</div>
        )}

        {cargando && entradasFiltradas.length > 0 && (
          <div style={{ padding: '14px 0', fontSize: 13, color: '#64748b' }}>⏳ Consultando la API oficial para {entradasFiltradas.length} votación(es)...</div>
        )}
      </div>

      {!cargando && vista === 'partido' && cargadas.length > 0 && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
            <div style={S.title}>Matriz de fidelidad — {camaraSel === 'senado' ? 'Senado' : 'Cámara de Diputados'}</div>
            <button style={S.btnDark} onClick={() => generarPDFMatriz(camaraSel, cargadas, partidosPresentes)}>⬇ Descargar radiografía comparada (PDF)</button>
          </div>

          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={S.th}>Partido</th>
                  {cargadas.map(r => (
                    <th key={r.entrada.id} style={{ ...S.th, minWidth: 150 }}>
                      {r.error
                        ? <span style={{ color: '#dc2626' }}>{r.entrada.titulo}</span>
                        : <a href={r.entrada.fuenteUrl} target="_blank" rel="noreferrer" style={{ color: '#0f172a', textDecoration: 'none' }}>{r.entrada.titulo}</a>}
                      {!r.error && r.resumen && (
                        <div style={{ fontSize: 10, fontWeight: 400, color: '#94a3b8', textTransform: 'none', marginTop: 3 }}>
                          {r.resumen.si}-{r.resumen.no}-{r.resumen.abstencion} · {r.fechaVotacion}
                        </div>
                      )}
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
                    {cargadas.map(r => {
                      if (r.error) return <td key={r.entrada.id} style={S.td}><CeldaVacia /></td>
                      const celda = calcularCelda(r.votos, partido)
                      const key = partido + '__' + r.entrada.id
                      return (
                        <td key={r.entrada.id} style={S.td}>
                          <CeldaMatriz celda={celda} activa={celdaAbierta === key} onClick={() => setCeldaAbierta(celdaAbierta === key ? null : key)} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16, fontSize: 12, color: '#64748b' }}>
            <Legend color="#10b981" bg="#e5f6ea" label="Mayoría a favor (≥80% cohesión)" />
            <Legend color="#dc2626" bg="#fbe6e5" label="Mayoría en contra (≥80% cohesión)" />
            <Legend color="#b8860b" bg="#fbf3d9" label="Bancada dividida (<80% cohesión)" />
            <Legend color="#94a3b8" bg="#f0f1f4" label="Sin integrantes que votaran favor/contra" />
          </div>

          {celdaAbierta && (() => {
            const [partido, entradaId] = celdaAbierta.split('__')
            const r = cargadas.find(x => x.entrada.id === entradaId)
            const celda = r && !r.error ? calcularCelda(r.votos, partido) : null
            if (!celda) return null
            return (
              <div style={S.detail}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{partido} — {r.entrada.titulo}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                  Posición mayoritaria: <b style={{ color: celda.mayoria === 'favor' ? '#10b981' : '#dc2626' }}>{celda.mayoria === 'favor' ? 'A favor' : 'En contra'}</b>{' '}
                  ({celda.favor} a favor, {celda.contra} en contra · {celda.cohesion}% de cohesión)
                </div>
                {celda.disidentes.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>Sin disidencias dentro de la bancada en esta votación.</div>
                ) : (
                  celda.disidentes.map(d => (
                    <div key={d.nombre} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #e2e8f0', fontSize: 13 }}>
                      <span>{d.nombre}</span>
                      <span style={{ fontWeight: 700, color: d.seleccion === 'favor' ? '#10b981' : '#dc2626' }}>{d.seleccion === 'favor' ? 'A favor' : 'En contra'}</span>
                    </div>
                  ))
                )}
              </div>
            )
          })()}
        </div>
      )}

      {!cargando && vista === 'legislador' && (
        <div style={S.card}>
          {!legisladorInfo ? (
            <div style={S.sub}>Selecciona un{camaraSel === 'senado' ? ' senador/a' : ' diputado/a'} arriba para ver su historial en las votaciones clave.</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <div>
                  <div style={S.title}>{legisladorInfo.nombre}</div>
                  <div style={S.sub}>{legisladorInfo.partido} · {legisladorInfo.bloque} · {legisladorInfo.region}{legisladorInfo.cargo ? ' · ' + legisladorInfo.cargo : ''}</div>
                </div>
                {fid && fid.total > 0 && (
                  <button style={S.btnDark} onClick={() => generarPDFFicha(legisladorInfo, fid, camaraSel)}>⬇ Descargar ficha de fidelidad (PDF)</button>
                )}
              </div>

              {!fid || fid.total === 0 ? (
                <div style={{ ...S.sub, fontSize: 13 }}>Este parlamentario no registra votos válidos (favor/contra) en las votaciones clave cargadas.</div>
              ) : (
                <>
                  <div style={S.fidscore}>
                    <div style={{ fontSize: 30, fontWeight: 700, color: '#6d28d9', fontFamily: "'Playfair Display', serif" }}>{fid.fidelidad}%</div>
                    <div style={{ fontSize: 12.5, color: '#6d28d9' }}>
                      Índice de fidelidad de bancada en votaciones clave<br />
                      ({fid.detalle.filter(d => d.coincide).length} de {fid.total} votos coinciden con la posición mayoritaria de {legisladorInfo.partido})
                    </div>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={S.th}>Votación</th>
                        <th style={S.th}>Fecha</th>
                        <th style={S.th}>Su voto</th>
                        <th style={S.th}>Voto de su bancada</th>
                        <th style={S.th}>¿Coincide?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fid.detalle.map(d => (
                        <tr key={d.entrada.id}>
                          <td style={S.td}>{d.entrada.titulo}</td>
                          <td style={S.td}>{d.entrada.fecha}</td>
                          <td style={S.td}><Badge tipo={d.suVoto} /></td>
                          <td style={S.td}><Badge tipo={d.posicionPartido} /></td>
                          <td style={S.td}>{d.coincide ? '✅' : '❌'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function CeldaVacia() {
  return <div style={{ textAlign: 'center', fontSize: 12, color: '#cbd5e1' }}>Error al cargar</div>
}

function CeldaMatriz({ celda, activa, onClick }) {
  if (!celda) {
    return <div style={{ textAlign: 'center', padding: '8px 6px', borderRadius: 9, background: '#f0f1f4', color: '#94a3b8', fontSize: 12 }}>—</div>
  }
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
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: esFavor ? '#e5f6ea' : '#fbe6e5', color: esFavor ? '#10b981' : '#dc2626' }}>
      {esFavor ? 'A favor' : 'En contra'}
    </span>
  )
}

function Legend({ color, bg, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 11, height: 11, borderRadius: 4, background: bg, border: `1px solid ${color}` }} />
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// PDF: matriz comparada (usa jsPDF + autotable cargados por CDN, ver index.html)
// ---------------------------------------------------------------------------
function generarPDFMatriz(camaraSel, cargadas, partidos) {
  if (!window.jspdf || !window.jspdf.jsPDF) { alert('El generador de PDF todavía está cargando. Intenta de nuevo en un segundo.'); return }
  try {
    const { jsPDF } = window.jspdf
    const doc = new jsPDF()
    doc.setFontSize(14); doc.setFont(undefined, 'bold')
    doc.text('Congreso Nacional de Chile 2026-2030', 14, 18)
    doc.setFontSize(11); doc.setFont(undefined, 'normal')
    doc.text('Votaciones Clave — Radiografía comparada · ' + (camaraSel === 'senado' ? 'Senado' : 'Cámara de Diputados'), 14, 25)
    doc.setDrawColor(200); doc.line(14, 29, 196, 29)

    const head = [['Partido', ...cargadas.map(r => r.entrada.titulo)]]
    const body = partidos.map(partido => [
      partido,
      ...cargadas.map(r => {
        if (r.error) return 'Sin datos'
        const celda = calcularCelda(r.votos, partido)
        if (!celda) return '—'
        const label = celda.cohesion < 80 ? 'Dividida' : (celda.mayoria === 'favor' ? 'A favor' : 'En contra')
        return `${label} (${celda.cohesion}%)`
      }),
    ])

    doc.autoTable({ startY: 36, head, body, styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [124, 58, 237] }, margin: { left: 14, right: 14 } })

    doc.setFontSize(8); doc.setTextColor(140)
    doc.text('Metodología: ver texto en congreso-chile.vercel.app · Generado desde congreso-chile.vercel.app', 14, 290)
    doc.save('votaciones-clave-' + camaraSel + '.pdf')
  } catch (e) { alert('No se pudo generar el PDF: ' + e.message) }
}

// PDF: ficha de fidelidad de un legislador
function generarPDFFicha(legislador, fid, camaraSel) {
  if (!window.jspdf || !window.jspdf.jsPDF) { alert('El generador de PDF todavía está cargando. Intenta de nuevo en un segundo.'); return }
  try {
    const { jsPDF } = window.jspdf
    const doc = new jsPDF()
    doc.setFontSize(14); doc.setFont(undefined, 'bold')
    doc.text('Congreso Nacional de Chile 2026-2030', 14, 18)
    doc.setFontSize(12); doc.setFont(undefined, 'normal')
    doc.text('Ficha de Fidelidad Legislativa', 14, 25)
    doc.setDrawColor(200); doc.line(14, 29, 196, 29)

    doc.setFontSize(12); doc.setFont(undefined, 'bold')
    doc.text(legislador.nombre, 14, 40)
    doc.setFontSize(10); doc.setFont(undefined, 'normal')
    doc.text(`${legislador.partido} · ${legislador.bloque} · ${legislador.region}`, 14, 47)

    doc.setFontSize(11); doc.setFont(undefined, 'bold')
    doc.text(`Índice de fidelidad de bancada: ${fid.fidelidad}%`, 14, 58)
    doc.setFontSize(9); doc.setFont(undefined, 'normal')
    doc.text(`(${fid.detalle.filter(d => d.coincide).length} de ${fid.total} votos coinciden con la posición mayoritaria de su partido)`, 14, 64)

    const body = fid.detalle.map(d => [
      d.entrada.titulo, d.entrada.fecha,
      d.suVoto === 'favor' ? 'A favor' : 'En contra',
      d.posicionPartido === 'favor' ? 'A favor' : 'En contra',
      d.coincide ? 'Sí' : 'No',
    ])
    doc.autoTable({
      startY: 72,
      head: [['Votación', 'Fecha', 'Su voto', 'Voto de su bancada', '¿Coincide?']],
      body, styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [124, 58, 237] }, margin: { left: 14, right: 14 },
    })

    doc.setFontSize(8); doc.setTextColor(140)
    doc.text('Metodología: ver texto en congreso-chile.vercel.app · Generado desde congreso-chile.vercel.app', 14, 290)
    doc.save('ficha-fidelidad-' + norm(legislador.nombre).replace(/\s+/g, '-') + '.pdf')
  } catch (e) { alert('No se pudo generar el PDF: ' + e.message) }
}

const S = {
  card: { background: 'white', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  title: { fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  sub: { fontSize: 13, color: '#64748b', marginBottom: 16 },
  select: { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Inter, sans-serif', background: 'white', color: '#475569' },
  methodology: { fontSize: 12, color: '#5b21b6', background: '#f5f0ff', borderRadius: 9, padding: '10px 14px', marginTop: 6, lineHeight: 1.5 },
  th: { textAlign: 'left', fontSize: 10.5, letterSpacing: 0.3, color: '#64748b', textTransform: 'uppercase', padding: '8px 10px', borderBottom: '1px solid #e2e8f0', verticalAlign: 'bottom' },
  td: { padding: '8px 10px', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' },
  btnDark: { padding: '9px 16px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' },
  detail: { marginTop: 16, padding: '14px 16px', background: '#fbfbfd', border: '1px dashed #e2e8f0', borderRadius: 10, fontSize: 13 },
  fidscore: { display: 'flex', alignItems: 'center', gap: 14, background: '#f5f0ff', padding: '12px 16px', borderRadius: 10, marginBottom: 16 },
}
