export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const boletin = req.query.boletin
  const votacionId = req.query.votacionId
  const BASE = 'https://opendata.congreso.cl/wscamaradiputados.asmx'

  try {
    let url = ''
    let tipo = ''

    if (votacionId) {
      url = BASE + '/getVotacion_Detalle?prmVotacionId=' + votacionId
      tipo = 'detalle'
    } else if (boletin) {
      url = BASE + '/getVotaciones_Boletin?prmBoletin=' + boletin
      tipo = 'boletin'
    } else {
      return res.status(400).json({ error: 'Falta el parámetro boletin o votacionId' })
    }

    const resp = await fetch(url)
    if (!resp.ok) {
      return res.status(200).json({ error: 'La API del Congreso respondió con código ' + resp.status })
    }

    const xml = await resp.text()
    const data = parsear(xml, tipo)
    return res.status(200).json(data)

  } catch (e) {
    return res.status(200).json({ error: 'Error al consultar: ' + e.message })
  }
}

function tag(str, name) {
  const re = new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + name + '>', 'i')
  const m = str.match(re)
  return m ? m[1].trim() : ''
}

function tagAll(str, name) {
  const re = new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + name + '>', 'gi')
  const out = []
  let m
  while ((m = re.exec(str)) !== null) out.push(m[1].trim())
  return out
}

function parsear(xml, tipo) {

  if (tipo === 'boletin') {
    let votaciones = tagAll(xml, 'Votacion').map(function (v) {
      const sesionXml = (v.match(/<Sesion[^>]*>([\s\S]*?)<\/Sesion>/i) || [])[1] || ''
      const articuloXml = (v.match(/<Articulo[^>]*>([\s\S]*?)<\/Articulo>/i) || [])[1] || ''
      const descripcion = articuloXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      return {
        id: tag(v, 'ID'),
        fechaHora: tag(v, 'Fecha'),
        fecha: tag(v, 'Fecha').split('T')[0],
        resultado: tag(v, 'Resultado'),
        quorum: tag(v, 'Quorum'),
        boletin: tag(v, 'Boletin'),
        descripcion: descripcion,
        sesionId: tag(sesionXml, 'ID'),
        totalSi: parseInt(tag(v, 'TotalAfirmativos')) || 0,
        totalNo: parseInt(tag(v, 'TotalNegativos')) || 0,
        totalAbs: parseInt(tag(v, 'TotalAbstenciones')) || 0
      }
    })
    votaciones.sort(function (a, b) { return a.fechaHora.localeCompare(b.fechaHora) })
    votaciones = votaciones.map(function (v, i) { v.numero = i + 1; return v })
    return { tipo: 'boletin', votaciones: votaciones }
  }

  if (tipo === 'detalle') {
    // Descripción y totales desde los tags XML
    const articuloXml = (xml.match(/<Articulo[^>]*>([\s\S]*?)<\/Articulo>/i) || [])[1] || ''
    const descripcion = articuloXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const fecha = tag(xml, 'Fecha').split('T')[0]
    const totalSi = parseInt(tag(xml, 'TotalAfirmativos')) || 0
    const totalNo = parseInt(tag(xml, 'TotalNegativos')) || 0
    const totalAbs = parseInt(tag(xml, 'TotalAbstenciones')) || 0

    // Los votos individuales: quitar todas las etiquetas XML y leer texto plano
    // Formato: "ID Nombre Apellido1 Apellido2 Opcion"
    const texto = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const votos = []
    const patron = /(\d{3,4})\s+((?:[A-ZÁÉÍÓÚÑÜ][a-záéíóúñüà]+(?:\s+y)?\s+)+)(Afirmativo|En Contra|Abstencion|No Vota|Dispensado|Pareo)/g
    let m
    while ((m = patron.exec(texto)) !== null) {
      votos.push({ diputado: m[2].trim(), opcion: m[3] })
    }

    return { tipo: 'detalle', descripcion: descripcion, fecha: fecha, votos: votos, resumen: { si: totalSi, no: totalNo, abs: totalAbs } }
  }

  return { error: 'Tipo desconocido' }
}
