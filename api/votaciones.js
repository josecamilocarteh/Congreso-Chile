export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { boletin, votacionId, sesionId, fecha } = req.query
  const BASE = 'https://opendata.congreso.cl/wscamaradiputados.asmx'

  try {
    let url = ''
    let tipo = ''

    if (votacionId) {
      url = `${BASE}/getVotacion_Detalle?prmVotacionId=${votacionId}`
      tipo = 'detalle'
    } else if (boletin) {
      url = `${BASE}/getVotaciones_Boletin?prmBoletin=${boletin}`
      tipo = 'boletin'
    } else if (sesionId) {
      url = `${BASE}/getSesion_Detalle?prmSesionId=${sesionId}`
      tipo = 'sesion'
    } else if (fecha) {
      // Buscar sesiones de la legislatura actual (374) y filtrar por fecha
      url = `${BASE}/getSesiones?prmLegislaturaID=374`
      tipo = 'sesiones'
    } else {
      return res.status(400).json({ error: 'Parámetro requerido: boletin, votacionId, sesionId o fecha' })
    }

    const response = await fetch(url)
    if (!response.ok) {
      return res.status(502).json({ error: `Error API Cámara: ${response.status}` })
    }

    const xmlText = await response.text()
    const data = parseXML(xmlText, tipo, fecha)
    return res.status(200).json(data)

  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

function get(str, tag) {
  const m = str.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return m ? m[1].trim() : ''
}

function getAll(str, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  const out = []; let m
  while ((m = re.exec(str)) !== null) out.push(m[1].trim())
  return out
}

function parseXML(xml, tipo, fechaFiltro) {

  if (tipo === 'boletin') {
    const votaciones = getAll(xml, 'Votacion').map(v => ({
      id: get(v, 'Id'),
      descripcion: get(v, 'Descripcion'),
      fecha: get(v, 'Fecha')?.split('T')[0],
      totalSi: parseInt(get(v, 'TotalSi')) || 0,
      totalNo: parseInt(get(v, 'TotalNo')) || 0,
      totalAbstencion: parseInt(get(v, 'TotalAbstencion')) || 0,
      totalDispensado: parseInt(get(v, 'TotalDispensado')) || 0,
      quorum: get(v, 'Quorum'),
      resultado: get(v, 'Resultado'),
    }))
    return { tipo: 'boletin', votaciones }
  }

  if (tipo === 'detalle') {
    const votosRaw = getAll(xml, 'Voto').filter(v => !v.includes('xsi:nil'))
    const votos = votosRaw.map(v => {
      const opcion = get(v, 'OpcionVoto')
      // Extract Diputado block
      const dipBlock = v.match(/<Diputado(?:\s[^>]*)?>([\s\S]*?)<\/Diputado>/i)?.[1] || ''
      const nombre1 = get(dipBlock, 'Nombre')
      const nombre2 = get(dipBlock, 'Nombre2')
      const apPaterno = get(dipBlock, 'ApellidoPaterno')
      const apMaterno = get(dipBlock, 'ApellidoMaterno')
      const nombreCompleto = [nombre1, nombre2].filter(Boolean).join(' ').trim()
        + ' ' + [apPaterno, apMaterno].filter(Boolean).join(' ').trim()
      // Partido from Militancias
      const milBlock = dipBlock.match(/<Militancias(?:\s[^>]*)?>([\s\S]*?)<\/Militancias>/i)?.[1] || ''
      const partido = get(milBlock, 'Nombre')
      return { diputado: nombreCompleto.trim(), partido, opcion }
    })

    const descripcion = get(xml, 'Descripcion')
    const fecha = get(xml, 'Fecha')?.split('T')[0]
    const totalSi = parseInt(get(xml, 'TotalSi')) || votos.filter(v => v.opcion === 'Si').length
    const totalNo = parseInt(get(xml, 'TotalNo')) || votos.filter(v => v.opcion === 'No').length
    const totalAbstencion = parseInt(get(xml, 'TotalAbstencion')) || votos.filter(v => v.opcion === 'Abstencion').length

    return { tipo: 'detalle', descripcion, fecha, votos, resumen: { si: totalSi, no: totalNo, abstencion: totalAbstencion } }
  }

  if (tipo === 'sesiones') {
    const todasSesiones = getAll(xml, 'Sesion').map(s => ({
      id: get(s, 'ID') || get(s, 'Id'),
      numero: get(s, 'Numero'),
      fecha: get(s, 'Fecha')?.split('T')[0],
      tipo: get(s, 'Tipo'),
    }))
    // Filter by date if provided
    const sesiones = fechaFiltro
      ? todasSesiones.filter(s => s.fecha === fechaFiltro)
      : todasSesiones
    if (fechaFiltro && sesiones.length === 0) {
      return { tipo: 'sesiones', sesiones: [], mensaje: `No se encontraron sesiones el ${fechaFiltro}` }
    }
    return { tipo: 'sesiones', sesiones }
  }

  if (tipo === 'sesion') {
    const votaciones = getAll(xml, 'Votacion').map(v => ({
      id: get(v, 'Id'),
      descripcion: get(v, 'Descripcion'),
      fecha: get(v, 'Fecha')?.split('T')[0],
      totalSi: parseInt(get(v, 'TotalSi')) || 0,
      totalNo: parseInt(get(v, 'TotalNo')) || 0,
      totalAbstencion: parseInt(get(v, 'TotalAbstencion')) || 0,
      quorum: get(v, 'Quorum'),
      resultado: get(v, 'Resultado'),
    }))
    return { tipo: 'sesion', fecha: get(xml, 'Fecha')?.split('T')[0], numero: get(xml, 'Numero'), votaciones }
  }

  return { raw: xml.substring(0, 1000) }
}
