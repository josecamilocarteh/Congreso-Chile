// Vercel Serverless Function — proxy para la API de la Cámara de Diputados
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { boletin, votacionId, sesionId, anio } = req.query

  try {
    let url = ''
    let tipo = ''

    if (votacionId) {
      url = `https://opendata.congreso.cl/wscamaradiputados.asmx/getVotacion_Detalle?prmVotacionId=${votacionId}`
      tipo = 'detalle'
    } else if (boletin) {
      url = `https://opendata.congreso.cl/wscamaradiputados.asmx/getVotaciones_Boletin?prmBoletin=${boletin}`
      tipo = 'boletin'
    } else if (sesionId) {
      url = `https://opendata.congreso.cl/wscamaradiputados.asmx/getSesion_Detalle?prmSesionId=${sesionId}`
      tipo = 'sesion'
    } else if (anio) {
      url = `https://opendata.congreso.cl/wscamaradiputados.asmx/getSesiones_Anio?prmAnio=${anio}`
      tipo = 'sesiones'
    } else {
      return res.status(400).json({ error: 'Parámetro requerido: boletin, votacionId, sesionId o anio' })
    }

    const response = await fetch(url)
    if (!response.ok) {
      return res.status(502).json({ error: `Error al consultar la API de la Cámara: ${response.status}` })
    }

    const xmlText = await response.text()
    const data = parseXML(xmlText, tipo)
    return res.status(200).json(data)

  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

function getText(str, tag) {
  const m = str.match(new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return m ? m[1].trim() : ''
}

function getAttr(str, tag, attr) {
  const m = str.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i'))
  return m ? m[1].trim() : ''
}

function getAll(str, tag) {
  const results = []
  const re = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  let m
  while ((m = re.exec(str)) !== null) results.push(m[1].trim())
  return results
}

function parseXML(xml, tipo) {

  if (tipo === 'boletin') {
    const votaciones = getAll(xml, 'Votacion').map(v => ({
      id: getText(v, 'Id'),
      descripcion: getText(v, 'Descripcion'),
      fecha: getText(v, 'Fecha')?.split('T')[0],
      totalSi: parseInt(getText(v, 'TotalSi')) || 0,
      totalNo: parseInt(getText(v, 'TotalNo')) || 0,
      totalAbstencion: parseInt(getText(v, 'TotalAbstencion')) || 0,
      totalDispensado: parseInt(getText(v, 'TotalDispensado')) || 0,
      quorum: getText(v, 'Quorum'),
      resultado: getText(v, 'Resultado'),
    }))
    return { tipo: 'boletin', votaciones }
  }

  if (tipo === 'detalle') {
    // Parse each Voto: OpcionVoto (text) + Diputado sub-elements
    const votosRaw = getAll(xml, 'Voto').filter(v => !v.includes('xsi:nil'))
    const votos = votosRaw.map(v => {
      const opcion = getText(v, 'OpcionVoto')
      const dipRaw = v.match(/<Diputado[^>]*>([\s\S]*?)<\/Diputado>/i)?.[1] || ''
      const nombre = getText(dipRaw, 'Nombre')
      const nombre2 = getText(dipRaw, 'Nombre2')
      const apellidoPaterno = getText(dipRaw, 'ApellidoPaterno')
      const apellidoMaterno = getText(dipRaw, 'ApellidoMaterno')
      const nombreCompleto = [nombre, nombre2].filter(Boolean).join(' ') + ' ' + [apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ')
      // Partido from Militancias
      const militanciasRaw = dipRaw.match(/<Militancias[^>]*>([\s\S]*?)<\/Militancias>/i)?.[1] || ''
      const partido = getText(militanciasRaw, 'Nombre') || getText(militanciasRaw, 'Partido')
      return {
        diputado: nombreCompleto.trim(),
        partido,
        opcion,
      }
    })

    const descripcion = getText(xml, 'Descripcion')
    const fecha = getText(xml, 'Fecha')?.split('T')[0]
    const totalSi = parseInt(getText(xml, 'TotalSi')) || votos.filter(v => v.opcion === 'Si').length
    const totalNo = parseInt(getText(xml, 'TotalNo')) || votos.filter(v => v.opcion === 'No').length
    const totalAbstencion = parseInt(getText(xml, 'TotalAbstencion')) || votos.filter(v => v.opcion === 'Abstencion').length

    return {
      tipo: 'detalle',
      descripcion,
      fecha,
      votos,
      resumen: { si: totalSi, no: totalNo, abstencion: totalAbstencion }
    }
  }

  if (tipo === 'sesiones') {
    const sesiones = getAll(xml, 'Sesion').map(s => ({
      id: getText(s, 'Id'),
      numero: getText(s, 'Numero'),
      fecha: getText(s, 'Fecha')?.split('T')[0],
      tipo: getText(s, 'Tipo'),
      legislatura: getText(s, 'Legislatura'),
    }))
    return { tipo: 'sesiones', sesiones }
  }

  if (tipo === 'sesion') {
    const votaciones = getAll(xml, 'Votacion').map(v => ({
      id: getText(v, 'Id'),
      descripcion: getText(v, 'Descripcion'),
      fecha: getText(v, 'Fecha')?.split('T')[0],
      totalSi: parseInt(getText(v, 'TotalSi')) || 0,
      totalNo: parseInt(getText(v, 'TotalNo')) || 0,
      totalAbstencion: parseInt(getText(v, 'TotalAbstencion')) || 0,
      quorum: getText(v, 'Quorum'),
      resultado: getText(v, 'Resultado'),
    }))
    return {
      tipo: 'sesion',
      fecha: getText(xml, 'Fecha')?.split('T')[0],
      numero: getText(xml, 'Numero'),
      votaciones
    }
  }

  return { raw: xml.substring(0, 500) }
}
