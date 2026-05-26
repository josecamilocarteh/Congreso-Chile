export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { boletin, votacionId, sesionId, fecha } = req.query
  const BASE = 'https://opendata.congreso.cl/wscamaradiputados.asmx'

  try {
    let url = '', tipo = ''
    if (votacionId)    { url = `${BASE}/getVotacion_Detalle?prmVotacionId=${votacionId}`;  tipo = 'detalle'  }
    else if (boletin)  { url = `${BASE}/getVotaciones_Boletin?prmBoletin=${boletin}`;       tipo = 'boletin'  }
    else if (sesionId) { url = `${BASE}/getSesion_Detalle?prmSesionId=${sesionId}`;         tipo = 'sesion'   }
    else if (fecha)    { url = `${BASE}/getSesiones?prmLegislaturaID=374`;                  tipo = 'sesiones' }
    else return res.status(400).json({ error: 'Parámetro requerido' })

    const response = await fetch(url)
    if (!response.ok) return res.status(502).json({ error: `Error API Cámara: ${response.status}` })

    const xml = await response.text()
    // Strip all XML tags to get plain text, then parse
    const texto = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return res.status(200).json(parsear(texto, tipo, fecha))

  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

function parsear(texto, tipo, fechaFiltro) {

  if (tipo === 'detalle') {
    // Extraer totales: 4 números seguidos antes del primer ID de diputado
    const mTotales = texto.match(/\b(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(?=\d{3,4}\s+[A-ZÁÉÍÓÚÑÜ])/)
    const totalSi  = mTotales ? parseInt(mTotales[1]) : 0
    const totalNo  = mTotales ? parseInt(mTotales[2]) : 0
    const totalAbs = mTotales ? parseInt(mTotales[3]) : 0

    // Extraer descripción: texto entre el boletín y PRIMER TRÁMITE
    const mDesc = texto.match(/\d{4,5}-\d{2}\s+([\s\S]+?)\s+PRIMER TR[ÁA]MITE/)
    const descripcion = mDesc ? mDesc[1].trim() : ''

    // Extraer fecha
    const mFecha = texto.match(/(\d{4}-\d{2}-\d{2})T/)
    const fecha = mFecha ? mFecha[1] : ''

    // Parsear votos: ID nombre(s) opcion
    const inicioVotos = mTotales ? mTotales.index + mTotales[0].length : 0
    const votosTexto = texto.substring(inicioVotos)

    const patron = /(\d{3,4})\s+((?:[A-ZÁÉÍÓÚÑÜ][a-záéíóúñüà]+\s+)+(?:y\s+[A-ZÁÉÍÓÚÑÜ][a-záéíóúñüà]+\s+)?)(Afirmativo|En Contra|Abstencion|No Vota|Dispensado|Pareo)/g
    const votos = []
    let m
    while ((m = patron.exec(votosTexto)) !== null) {
      votos.push({
        diputado: m[2].trim(),
        opcion: m[3],
        partido: '',
      })
    }

    return { tipo: 'detalle', descripcion, fecha, votos, resumen: { si: totalSi, no: totalNo, abs: totalAbs } }
  }

  if (tipo === 'boletin') {
    // Cada votación: ID fecha tipo resultado quorum sesionID numero fecha2 fecha3 tipoSesion boletin descripcion PRIMER TRAMITE totales
    // Extraer bloques por ID de votación (5 dígitos al inicio)
    const bloques = texto.split(/(?=\b8\d{4}\s+\d{4}-\d{2}-\d{2})/).filter(b => /^8\d{4}/.test(b.trim()))
    const votaciones = bloques.map(b => {
      const partes = b.trim().split(/\s+/)
      const id = partes[0]
      const fecha = partes[1]?.split('T')[0] || ''

      // resultado: Aprobado o Rechazado
      const mResultado = b.match(/\b(Aprobado|Rechazado)\b/)
      const resultado = mResultado ? mResultado[1] : ''

      // quorum
      const mQuorum = b.match(/\b(Quorum Simple|Quorum Calificado[^,\n]*)\b/i)
      const quorum = mQuorum ? mQuorum[1] : ''

      // boletín
      const mBoletin = b.match(/\b(\d{4,5}-\d{2})\b/)
      const boletin = mBoletin ? mBoletin[1] : ''

      // descripción: entre boletín y PRIMER TRÁMITE
      const mDesc = b.match(/\d{4,5}-\d{2}\s+([\s\S]+?)\s+PRIMER TR[ÁA]MITE/)
      const descripcion = mDesc ? mDesc[1].trim() : ''

      // totales: 4 números al final antes de los votos (o al final)
      const mTot = b.match(/PRIMER INFORME\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/)
      const totalSi  = mTot ? parseInt(mTot[1]) : 0
      const totalNo  = mTot ? parseInt(mTot[2]) : 0
      const totalAbs = mTot ? parseInt(mTot[3]) : 0

      return { id, fecha, resultado, quorum, boletin, descripcion, totalSi, totalNo, totalAbs }
    })
    return { tipo: 'boletin', votaciones }
  }

  if (tipo === 'sesiones') {
    // Sesiones: ID numero fecha fechaTermino tipo estado...
    // Buscar patrones: número sesión seguido de fecha
    const sesiones = []
    const patron = /\b(\d+)\s+(\d+)\s+(\d{4}-\d{2}-\d{2})T/g
    let m
    while ((m = patron.exec(texto)) !== null) {
      sesiones.push({ id: m[1], numero: m[2], fecha: m[3], tipo: 'Ordinaria' })
    }
    const filtradas = fechaFiltro ? sesiones.filter(s => s.fecha === fechaFiltro) : sesiones
    return { tipo: 'sesiones', sesiones: filtradas }
  }

  if (tipo === 'sesion') {
    const bloques = texto.split(/(?=\b8\d{4}\s+\d{4}-\d{2}-\d{2})/).filter(b => /^8\d{4}/.test(b.trim()))
    const votaciones = bloques.map(b => {
      const partes = b.trim().split(/\s+/)
      const id = partes[0]
      const fecha = partes[1]?.split('T')[0] || ''
      const mResultado = b.match(/\b(Aprobado|Rechazado)\b/)
      const resultado = mResultado ? mResultado[1] : ''
      const mQuorum = b.match(/\b(Quorum Simple|Quorum Calificado[^,\n]*)\b/i)
      const quorum = mQuorum ? mQuorum[1] : ''
      const mDesc = b.match(/\d{4,5}-\d{2}\s+([\s\S]+?)\s+PRIMER TR[ÁA]MITE/)
      const descripcion = mDesc ? mDesc[1].trim() : ''
      const mTot = b.match(/PRIMER INFORME\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/)
      const totalSi  = mTot ? parseInt(mTot[1]) : 0
      const totalNo  = mTot ? parseInt(mTot[2]) : 0
      const totalAbs = mTot ? parseInt(mTot[3]) : 0
      return { id, fecha, resultado, quorum, descripcion, totalSi, totalNo, totalAbs }
    })
    return { tipo: 'sesion', votaciones }
  }

  return { error: 'Tipo desconocido', raw: texto.substring(0, 300) }
}
