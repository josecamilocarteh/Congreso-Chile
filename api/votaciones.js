// Vercel Serverless Function — proxy para la API de la Cámara de Diputados
// Evita problemas de CORS llamando al web service SOAP desde el servidor

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { boletin, votacionId, sesionId, fecha } = req.query

  try {
    let url = ''
    let tipo = ''

    if (votacionId) {
      // Detalle de una votación específica (votos por diputado)
      url = `https://opendata.camara.cl/wscamaradiputados.asmx/getVotacion_Detalle?prmVotacionId=${votacionId}`
      tipo = 'detalle'
    } else if (boletin) {
      // Votaciones de un proyecto por boletín
      url = `https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin?prmBoletin=${boletin}`
      tipo = 'boletin'
    } else if (sesionId) {
      // Detalle de sesión (incluye votaciones)
      url = `https://opendata.camara.cl/wscamaradiputados.asmx/getSesion_Detalle?prmSesionId=${sesionId}`
      tipo = 'sesion'
    } else if (fecha) {
      // Sesiones por fecha (YYYY-MM-DD)
      const [anio] = fecha.split('-')
      url = `https://opendata.camara.cl/wscamaradiputados.asmx/getSesiones_Anio?prmAnio=${anio}`
      tipo = 'sesiones'
    } else {
      return res.status(400).json({ error: 'Parámetro requerido: boletin, votacionId, sesionId o fecha' })
    }

    const response = await fetch(url, {
      headers: { 'Accept': 'text/xml', 'Content-Type': 'text/xml' }
    })

    if (!response.ok) {
      return res.status(502).json({ error: `Error al consultar la API de la Cámara: ${response.status}` })
    }

    const xmlText = await response.text()

    // Parse XML a JSON
    const data = parseXML(xmlText, tipo)
    return res.status(200).json(data)

  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

function parseXML(xml, tipo) {
  // Helper para extraer valor de tag
  const get = (str, tag) => {
    const match = str.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
    return match ? match[1].trim() : ''
  }
  const getAll = (str, tag) => {
    const results = []
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
    let m
    while ((m = re.exec(str)) !== null) results.push(m[1].trim())
    return results
  }

  if (tipo === 'boletin') {
    const votaciones = getAll(xml, 'Votacion').map(v => ({
      id: get(v, 'ID'),
      fecha: get(v, 'Fecha'),
      tema: get(v, 'Tema') || get(v, 'DescripcionVotacion'),
      resultado: get(v, 'TotalAfavor') ? {
        aFavor: parseInt(get(v, 'TotalAfavor')) || 0,
        enContra: parseInt(get(v, 'TotalEnContra')) || 0,
        abstencion: parseInt(get(v, 'TotalAbstencion')) || 0,
        dispensados: parseInt(get(v, 'TotalDispensado')) || 0,
      } : null,
      quorum: get(v, 'Quorum'),
      boletin: get(v, 'Boletin'),
    }))
    return { tipo: 'boletin', votaciones }
  }

  if (tipo === 'detalle') {
    const votos = getAll(xml, 'Voto').map(v => ({
      diputado: get(v, 'Nombre') || `${get(v, 'Nombres')} ${get(v, 'Apellidos')}`.trim(),
      partido: get(v, 'Partido'),
      voto: get(v, 'Opcion') || get(v, 'opcion'),
    }))
    const tema = get(xml, 'Tema') || get(xml, 'DescripcionVotacion')
    const fecha = get(xml, 'Fecha')
    const aFavor = votos.filter(v => v.voto === 'A favor' || v.voto === 'Afavor').length
    const enContra = votos.filter(v => v.voto === 'En contra').length
    const abstencion = votos.filter(v => v.voto === 'Abstención' || v.voto === 'Abstencion').length
    return { tipo: 'detalle', tema, fecha, votos, resumen: { aFavor, enContra, abstencion } }
  }

  if (tipo === 'sesiones') {
    const sesiones = getAll(xml, 'Sesion').map(s => ({
      id: get(s, 'ID'),
      numero: get(s, 'Numero'),
      fecha: get(s, 'Fecha'),
      tipo: get(s, 'Tipo'),
      legislatura: get(s, 'Legislatura'),
    }))
    return { tipo: 'sesiones', sesiones }
  }

  if (tipo === 'sesion') {
    const votaciones = getAll(xml, 'Votacion').map(v => ({
      id: get(v, 'ID'),
      tema: get(v, 'Tema') || get(v, 'DescripcionVotacion'),
      resultado: {
        aFavor: parseInt(get(v, 'TotalAfavor')) || 0,
        enContra: parseInt(get(v, 'TotalEnContra')) || 0,
        abstencion: parseInt(get(v, 'TotalAbstencion')) || 0,
      }
    }))
    return { tipo: 'sesion', fecha: get(xml, 'Fecha'), numero: get(xml, 'Numero'), votaciones }
  }

  return { raw: xml }
}
