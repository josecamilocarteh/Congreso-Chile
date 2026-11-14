import { useState, useEffect } from 'react'
import { DesgloseVotos, enriquecerVotos, formatFecha, boletinDe, colorResultado, generarPDFVotacion } from './VotacionesDia'
import BotonEnlace from './BotonEnlace'
import { codigoVotacion } from '../enlaces'

// Página pública de UNA votación, abierta desde un enlace permanente:
//   /votacion/camara/AAAA-MM-DD/ID   ·   /votacion/senado/AAAA-MM-DD/ID
// Muestra los datos de la votación, el desglose por partido y el voto de cada parlamentario.
export default function VotacionPermalink({ camara, fecha, id, onVolver }) {
  const esSenado = camara === 'senado'
  const [estado, setEstado] = useState('cargando')   // cargando | ok | noencontrada | error
  const [error, setError] = useState('')
  const [vot, setVot] = useState(null)
  const [votos, setVotos] = useState([])
  const [aviso, setAviso] = useState('')
  const [proyecto, setProyecto] = useState(null)
  const [articulo, setArticulo] = useState('')

  useEffect(() => {
    let activo = true
    ;(async () => {
      setEstado('cargando'); setError(''); setAviso('')
      try {
        if (esSenado) {
          const r = await fetch(`/api/votaciones?senadoDia=${fecha}`)
          const d = await r.json()
          const v = (d.votaciones || []).find(x => String(x.id) === String(id))
          if (!activo) return
          if (!v && d.error) throw new Error('La fuente oficial del Senado no respondió (' + d.error + ').')
          if (!v) { setEstado('noencontrada'); return }
          setVot(v)
          setVotos(enriquecerVotos(v.votos || [], true))
          setEstado('ok')
          cargarProyecto(v.boletin || boletinDe(v.descripcion), false)
          return
        }

        // Cámara: cabecera desde la lista del año + votos individuales en paralelo
        const anio = fecha.slice(0, 4)
        const [rA, rV] = await Promise.all([
          fetch(`/api/votaciones?votacionesAnio=${anio}`),
          fetch(`/api/votaciones?votacionId=${encodeURIComponent(id)}`)
        ])
        const dA = await rA.json()
        const dV = await rV.json().catch(() => ({}))
        if (!activo) return
        let v = (dA.votaciones || []).find(x => String(x.id) === String(id))
        if (!v && dV && dV.votos && dV.votos.length) {
          // No está en la lista del año (raro): se arma con lo que trajo el detalle
          v = {
            id, fecha: dV.fecha || fecha, descripcion: dV.descripcion || '',
            totalSi: dV.resumen?.si || 0, totalNo: dV.resumen?.no || 0, totalAbs: dV.resumen?.abs || 0
          }
        }
        if (!v) { setEstado('noencontrada'); return }

        let lista = (dV && dV.votos) || []
        if (lista.length === 0) {
          // Respaldo 1: votos desde la API del año
          try {
            const r2 = await fetch(`/api/votaciones?detalleAnio=${encodeURIComponent(id)}&anio=${anio}`)
            const d2 = await r2.json()
            if (d2.votos && d2.votos.length) lista = d2.votos
          } catch (e) { /* sigue */ }
        }
        if (lista.length === 0) {
          // Respaldo 2: ficha web de la Cámara
          try {
            const r3 = await fetch(`/api/votaciones?camaraDetalle=${encodeURIComponent(id)}`)
            const d3 = await r3.json()
            if (d3.votos && d3.votos.length) {
              lista = d3.votos
              if (d3.materia && !v.descripcion) v = { ...v, descripcion: d3.materia }
            }
          } catch (e) { /* sigue */ }
        }
        if (!activo) return
        if (lista.length === 0) setAviso('La Cámara publicó los totales de esta votación, pero el detalle por diputado no está en los datos abiertos. Puedes verlo en la ficha oficial.')
        setVot(v)
        setVotos(enriquecerVotos(lista, false))
        setEstado('ok')
        cargarProyecto(v.boletin || boletinDe(v.descripcion), true)
      } catch (e) {
        if (activo) { setError(e.message); setEstado('error') }
      }
    })()

    async function cargarProyecto(bol, buscarArticulo) {
      if (!bol) return
      try {
        const r = await fetch(`/api/votaciones?proyecto=${encodeURIComponent(bol)}`)
        const p = await r.json()
        if (activo && p && p.titulo) setProyecto(p)
      } catch (e) { /* opcional */ }
      if (!buscarArticulo) return
      try {
        const r = await fetch(`/api/votaciones?boletin=${encodeURIComponent(bol)}`)
        const d = await r.json()
        const m = (d.votaciones || []).find(x => String(x.id) === String(id))
        if (activo && m && m.descripcion) setArticulo(m.descripcion)
      } catch (e) { /* opcional */ }
    }

    return () => { activo = false }
  }, [camara, fecha, id])  // eslint-disable-line

  // Título de la pestaña del navegador
  useEffect(() => {
    const base = 'Congreso Nacional de Chile 2026–2030'
    if (estado === 'ok' && vot) {
      const t = proyecto?.titulo || vot.descripcion || 'Votación'
      document.title = `${codigoVotacion(camara, id)} · ${t.slice(0, 80)} — ${base}`
    }
    return () => { document.title = base }
  }, [estado, vot, proyecto, camara, id])

  const codigo = codigoVotacion(camara, id)
  const fichaOficial = esSenado
    ? 'https://www.senado.cl/actividad-legislativa/sala/votaciones'
    : `https://www.camara.cl/legislacion/sala_sesiones/votacion_detalle.aspx?prmIdVotacion=${encodeURIComponent(id)}`

  return (
    <div>
      <button onClick={onVolver} style={S.volver}>← Ir a la plataforma completa</button>

      {estado === 'cargando' && (
        <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#64748b' }}>
          ⏳ Cargando la votación {codigo} desde la fuente oficial…
        </div>
      )}

      {estado === 'error' && (
        <div style={S.card}>
          <div style={S.titulo}>No se pudo cargar la votación</div>
          <div style={S.err}>⚠️ {error}</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 10 }}>Intenta recargar la página en unos segundos.</div>
        </div>
      )}

      {estado === 'noencontrada' && (
        <div style={S.card}>
          <div style={S.titulo}>No encontramos la votación {codigo}</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginTop: 6 }}>
            No aparece en los registros oficiales del {esSenado ? 'Senado' : 'la Cámara'} para el {formatFecha(fecha)}.
            Revisa que el enlace esté completo{esSenado ? '' : ', o consulta la ficha oficial'}.
          </div>
          {!esSenado && <a href={fichaOficial} target="_blank" rel="noreferrer" style={{ ...S.btn, marginTop: 14 }}>Ver ficha oficial en camara.cl ↗</a>}
        </div>
      )}

      {estado === 'ok' && vot && (() => {
        const total = (vot.totalSi || 0) + (vot.totalNo || 0) + (vot.totalAbs || 0)
        const bol = vot.boletin || boletinDe(vot.descripcion)
        const titulo = proyecto?.titulo || vot.descripcion || vot.tipo || 'Votación'
        const seVota = articulo || (proyecto?.titulo && vot.descripcion !== titulo ? vot.descripcion : '')
        const cifras = [
          { label: 'A favor', n: vot.totalSi || 0, color: '#10b981' },
          { label: 'En contra', n: vot.totalNo || 0, color: '#ef4444' },
          { label: 'Abstención', n: vot.totalAbs || 0, color: '#eab308' },
        ]
        if (vot.totalDisp) cifras.push({ label: esSenado ? 'Pareos' : 'Dispensados', n: vot.totalDisp, color: '#94a3b8' })
        return (
          <>
            <div style={{ ...S.card, borderTop: '4px solid #1e3a8a' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                <span style={S.codigo}>Votación {codigo}</span>
                <span style={S.chip}>{esSenado ? '⚖️ Senado' : '🏛 Cámara de Diputadas y Diputados'}</span>
                {vot.resultado && <span style={{ ...S.chip, background: colorResultado(vot.resultado), color: 'white' }}>{vot.resultado}</span>}
                {vot.fuente === 'manual' && <span style={{ ...S.chip, background: '#fef9c3', color: '#854d0e' }}>⚠ Totales cargados desde prensa</span>}
              </div>

              <h2 style={S.h2}>{titulo}</h2>
              {seVota && (
                <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.5, marginTop: 6 }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Se vota: </span>{seVota}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: '#475569', marginTop: 12 }}>
                <span>📅 {formatFecha(vot.fecha || fecha).replace(/^./, c => c.toUpperCase())}</span>
                {bol && <span style={{ fontWeight: 700, color: '#1e3a8a' }}>Boletín {bol}</span>}
                {vot.sesion && <span>Sesión {vot.sesion}</span>}
                {vot.quorum && <span>⚖️ Quórum: {vot.quorum}</span>}
                {vot.tipo && !esSenado && <span>{vot.tipo}</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginTop: 18 }}>
                {cifras.map(c => (
                  <div key={c.label} style={{ background: `${c.color}14`, border: `1.5px solid ${c.color}40`, borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.n}</div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 4, fontWeight: 600 }}>{c.label}</div>
                  </div>
                ))}
              </div>
              {total > 0 && (
                <div style={{ height: 9, borderRadius: 8, overflow: 'hidden', background: '#f1f5f9', display: 'flex', marginTop: 12 }}>
                  {vot.totalSi > 0 && <div style={{ width: `${(vot.totalSi / total) * 100}%`, background: '#10b981' }} />}
                  {vot.totalAbs > 0 && <div style={{ width: `${(vot.totalAbs / total) * 100}%`, background: '#eab308' }} />}
                  {vot.totalNo > 0 && <div style={{ width: `${(vot.totalNo / total) * 100}%`, background: '#ef4444' }} />}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18, alignItems: 'center' }}>
                <BotonEnlace camara={camara} fecha={vot.fecha || fecha} id={id} grande />
                {votos.length > 0 && (
                  <button onClick={() => generarPDFVotacion(vot, votos, esSenado ? 'sen' : 'dip')} style={S.btnSec}>📄 Descargar PDF</button>
                )}
                {!esSenado && <a href={fichaOficial} target="_blank" rel="noreferrer" style={S.btnSec}>Ficha oficial en camara.cl ↗</a>}
                {vot.fuenteUrl && <a href={vot.fuenteUrl} target="_blank" rel="noreferrer" style={S.btnSec}>Fuente: {vot.fuenteDetalle} ↗</a>}
              </div>
            </div>

            <div style={S.card}>
              <div style={S.titulo}>Cómo votó cada partido y cada {esSenado ? 'senador' : 'diputado'}</div>
              <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14 }}>
                Fuente: {esSenado ? 'API oficial senado.cl' : 'datos abiertos de la Cámara (opendata.camara.cl)'}. Usa los filtros para ver un partido, región o distrito.
              </div>
              {aviso && <div style={S.aviso}>{aviso}</div>}
              {votos.length > 0
                ? <DesgloseVotos votos={votos} esSenado={esSenado} />
                : !aviso && <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: 16 }}>No hay votos individuales registrados para esta votación.</div>}
            </div>
          </>
        )
      })()}
    </div>
  )
}

const S = {
  card:   { background: 'white', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  titulo: { fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  h2:     { fontSize: 20, fontWeight: 700, color: '#0f172a', lineHeight: 1.3, fontFamily: "'Inter', sans-serif" },
  codigo: { fontSize: 12, fontWeight: 800, color: 'white', background: '#1e3a8a', borderRadius: 6, padding: '4px 10px', letterSpacing: 0.4 },
  chip:   { fontSize: 12, fontWeight: 700, color: '#334155', background: '#f1f5f9', borderRadius: 6, padding: '4px 10px' },
  btn:    { display: 'inline-block', padding: '9px 16px', background: '#1e40af', color: 'white', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' },
  btnSec: { display: 'inline-block', padding: '8px 14px', background: 'white', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: 'none', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  volver: { background: 'none', border: 'none', color: '#1e40af', fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 14, fontFamily: "'Inter', sans-serif" },
  err:    { background: '#fde8e8', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginTop: 10 },
  aviso:  { background: '#fefce8', border: '1px solid #fde047', color: '#713f12', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12, lineHeight: 1.5 },
}
