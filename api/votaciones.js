export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { boletin, votacionId, sesionId, fecha } = req.query
  const BASE = 'https://opendata.congreso.cl/wscamaradiputados.asmx'

  try {
    let xml = '', tipo = ''

    if (votacionId) {
      xml = await fetchGet(`${BASE}/getVotacion_Detalle?prmVotacionId=${votacionId}`)
      tipo = 'detalle'
    } else if (boletin) {
      xml = await fetchGet(`${BASE}/getVotaciones_Boletin?prmBoletin=${boletin}`)
      tipo = 'boletin'
    } else if (sesionId) {
      xml = await fetchGet(`${BASE}/getSesion_Detalle?prmSesionId=${sesionId}`)
      tipo = 'sesion'
    } else { else {
      return res.status(400).json({ error: 'Parámetro requerido' })
    }

    const texto = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const resultado = parsear(texto, tipo, fecha)
    // Para debug: si no se parseó nada, devolver muestra del texto
    if ((tipo === 'sesiones' && !resultado.sesiones?.length) ||
        (tipo === 'boletin' && !resultado.votaciones?.length)) {
      resultado.debug = texto.substring(0, 400)
    }
    return res.status(200).json(resultado)

  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

async function fetchGet(url) {
  const r = await fetch(url, { headers: { 'Accept': 'text/xml' } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

function parsear(texto, tipo, fechaFiltro) {

  if (tipo === 'detalle') {
    const mTot = texto.match(/\b(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(?=\d{3,4}\s+[A-ZÁÉÍÓÚÑÜ])/)
    const totalSi  = mTot ? parseInt(mTot[1]) : 0
    const totalNo  = mTot ? parseInt(mTot[2]) : 0
    const totalAbs = mTot ? parseInt(mTot[3]) : 0

    const mDesc = texto.match(/\d{4,5}-\d{2}\s+([\s\S]+?)\s+PRIMER TR[ÁA]MITE/)
    const descripcion = mDesc ? mDesc[1].trim() : ''
    const mFecha = texto.match(/(\d{4}-\d{2}-\d{2})T/)
    const fecha = mFecha ? mFecha[1] : ''

    const inicioVotos = mTot ? mTot.index + mTot[0].length : 0
    const votosTexto = texto.substring(inicioVotos)
    const patron = /(\d{3,4})\s+((?:[A-ZÁÉÍÓÚÑÜ][a-záéíóúñüà]+(?:\s+y)?\s+)+)(Afirmativo|En Contra|Abstencion|No Vota|Dispensado|Pareo)/g
    const votos = []
    let m
    while ((m = patron.exec(votosTexto)) !== null) {
      votos.push({ diputado: m[2].trim(), opcion: m[3] })
    }
    return { tipo: 'detalle', descripcion, fecha, votos, resumen: { si: totalSi, no: totalNo, abs: totalAbs } }
  }

  if (tipo === 'boletin' || tipo === 'sesion') {
    const bloques = texto.split(/(?=\b8\d{4}\s+\d{4}-\d{2}-\d{2})/).filter(b => /^8\d{4}/.test(b.trim()))
    let votaciones = bloques.map(b => {
      const partes = b.trim().split(/\s+/)
      const id = partes[0]
      const fechaHora = partes[1] || ''
      const fecha = fechaHora.split('T')[0]
      const mRes  = b.match(/\b(Aprobado|Rechazado)\b/)
      const mQ    = b.match(/Quorum\s+(Simple|Calificado[^0-9]*)/i)
      const mBol  = b.match(/\b(\d{4,5}-\d{2})\b/)
      const mDesc = b.match(/\d{4,5}-\d{2}\s+([\s\S]+?)\s+PRIMER TR[ÁA]MITE/)
      const mTot  = b.match(/PRIMER INFORME\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/)
      return {
        id, fechaHora, fecha,
        resultado:   mRes  ? mRes[1]  : '',
        quorum:      mQ    ? `Quórum ${mQ[1].trim()}` : '',
        boletin:     mBol  ? mBol[1]  : '',
        descripcion: mDesc ? mDesc[1].trim() : '',
        totalSi:     mTot  ? parseInt(mTot[1]) : 0,
        totalNo:     mTot  ? parseInt(mTot[2]) : 0,
        totalAbs:    mTot  ? parseInt(mTot[3]) : 0,
      }
    })
    // Ordenar cronológicamente (más antigua primero) y numerar
    votaciones.sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
    votaciones = votaciones.map((v, i) => ({ ...v, numero: i + 1 }))
    return { tipo, votaciones }
  }

  return { error: 'Tipo desconocido' }
}
