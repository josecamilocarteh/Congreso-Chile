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
    return res.status(200).json(parsear(xml, tipo, fecha))

  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

// Extraer texto de un tag XML
function tag(str, name) {
  const m = str.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))
  return m ? m[1].trim() : ''
}
function tagAll(str, name) {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'gi')
  const out = []; let m
  while ((m = re.exec(str)) !== null) out.push(m[1].trim())
  return out
}

// Parsear votos en texto plano: "1012 Boris Barrera Moreno Afirmativo"
function parsearVotosTexto(texto) {
  const OPCIONES = ['Afirmativo', 'En Contra', 'Abstencion', 'No Vota', 'Dispensado', 'Pareo']
  const votos = []
  // Cada voto empieza con un número (ID)
  const lineas = texto.split(/(?=\d{3,4}\s+[A-ZÁÉÍÓÚÑÜ])/)
  for (const linea of lineas) {
    const l = linea.trim()
    if (!l) continue
    let opcionEncontrada = null
    let resto = l
    for (const op of OPCIONES) {
      if (l.includes(op)) {
        opcionEncontrada = op
        resto = l.substring(0, l.lastIndexOf(op)).trim()
        break
      }
    }
    if (!opcionEncontrada) continue
    // resto = "1012 Boris Barrera Moreno"
    const partes = resto.split(/\s+/)
    if (partes.length < 2) continue
    const id = partes[0]
    const nombre = partes.slice(1).join(' ')
    votos.push({ id, diputado: nombre, opcion: opcionEncontrada })
  }
  return votos
}

function parsear(xml, tipo, fechaFiltro) {

  if (tipo === 'boletin') {
    const votaciones = tagAll(xml, 'Votacion').map(v => ({
      id:          tag(v, 'Id'),
      descripcion: tag(v, 'Descripcion'),
      fecha:       tag(v, 'Fecha').split('T')[0],
      totalSi:     parseInt(tag(v, 'TotalSi'))          || 0,
      totalNo:     parseInt(tag(v, 'TotalNo'))           || 0,
      totalAbs:    parseInt(tag(v, 'TotalAbstencion'))   || 0,
      totalDisp:   parseInt(tag(v, 'TotalDispensado'))   || 0,
      quorum:      tag(v, 'Quorum'),
      resultado:   tag(v, 'Resultado'),
    }))
    return { tipo: 'boletin', votaciones }
  }

  if (tipo === 'detalle') {
    const descripcion = tag(xml, 'Descripcion')
    const fecha       = tag(xml, 'Fecha').split('T')[0]
    const totalSi     = parseInt(tag(xml, 'TotalSi'))        || 0
    const totalNo     = parseInt(tag(xml, 'TotalNo'))         || 0
    const totalAbs    = parseInt(tag(xml, 'TotalAbstencion')) || 0

    // Intentar parsear con tags XML primero
    let votos = []
    const votosXml = tagAll(xml, 'Voto').filter(v => !v.includes('xsi:nil'))

    if (votosXml.length > 0) {
      // La API devuelve tags XML estructurados
      votos = votosXml.map(v => {
        const opcion    = tag(v, 'OpcionVoto')
        const dipXml    = v.match(/<Diputado[^>]*>([\s\S]*?)<\/Diputado>/i)?.[1] || ''
        const n1        = tag(dipXml, 'Nombre')
        const n2        = tag(dipXml, 'Nombre2')
        const ap        = tag(dipXml, 'ApellidoPaterno')
        const am        = tag(dipXml, 'ApellidoMaterno')
        const milXml    = dipXml.match(/<Militancias[^>]*>([\s\S]*?)<\/Militancias>/i)?.[1] || ''
        const partido   = tag(milXml, 'Nombre')
        const nombre    = [n1, n2].filter(Boolean).join(' ').trim()
          + (ap ? ' ' + ap : '') + (am ? ' ' + am : '')
        return { diputado: nombre.trim(), partido, opcion }
      })
    } else {
      // Texto plano como fallback
      const votosSection = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
      votos = parsearVotosTexto(votosSection)
    }

    return { tipo: 'detalle', descripcion, fecha, votos, resumen: { si: totalSi, no: totalNo, abs: totalAbs } }
  }

  if (tipo === 'sesiones') {
    const sesiones = tagAll(xml, 'Sesion').map(s => ({
      id:     tag(s, 'ID') || tag(s, 'Id'),
      numero: tag(s, 'Numero'),
      fecha:  tag(s, 'Fecha').split('T')[0],
      tipo:   tag(s, 'Tipo'),
    }))
    const filtradas = fechaFiltro ? sesiones.filter(s => s.fecha === fechaFiltro) : sesiones
    return { tipo: 'sesiones', sesiones: filtradas }
  }

  if (tipo === 'sesion') {
    const votaciones = tagAll(xml, 'Votacion').map(v => ({
      id:          tag(v, 'Id'),
      descripcion: tag(v, 'Descripcion'),
      fecha:       tag(v, 'Fecha').split('T')[0],
      totalSi:     parseInt(tag(v, 'TotalSi'))        || 0,
      totalNo:     parseInt(tag(v, 'TotalNo'))         || 0,
      totalAbs:    parseInt(tag(v, 'TotalAbstencion')) || 0,
      quorum:      tag(v, 'Quorum'),
      resultado:   tag(v, 'Resultado'),
    }))
    return { tipo: 'sesion', votaciones }
  }

  return { raw: xml.substring(0, 500) }
}
