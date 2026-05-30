export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { boletin, votacionId } = req.query
  const BASE = 'https://opendata.congreso.cl/wscamaradiputados.asmx'

  try {
    let xml = '', tipo = ''

    if (votacionId) {
      xml = await fetchGet(`${BASE}/getVotacion_Detalle?prmVotacionId=${votacionId}`)
      tipo = 'detalle'
    } else if (boletin) {
      xml = await fetchGet(`${BASE}/getVotaciones_Boletin?prmBoletin=${boletin}`)
      tipo = 'boletin'
    } else {
      return res.status(400).json({ error: 'Parámetro requerido: boletin o votacionId' })
    }

    return res.status(200).json(parsear(xml, tipo))

  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

async function fetchGet(url) {
  const r = await fetch(url, { headers: { 'Accept': 'text/xml' } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

function tag(str, name) {
  const m = str.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))
  return m ? m[1].trim() : ''
}

function tagAll(str, name) {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'gi')
  const out = []; let m
  while ((m = re.exec(str)) !== null) out.push(m[1].trim())
  return out
}

function parsear(xml, tipo) {

  if (tipo === 'boletin') {
    // Cada <Votacion> contiene: ID, Fecha, Resultado, Quorum, Sesion, Boletin, Articulo, TotalAfirmativos, TotalNegativos, TotalAbstenciones
    let votaciones = tagAll(xml, 'Votacion').map(v => {
      const sesionXml = v.match(/<Sesion[^>]*>([\s\S]*?)<\/Sesion>/i)?.[1] || ''
      const articuloXml = v.match(/<Articulo[^>]*>([\s\S]*?)<\/Articulo>/i)?.[1] || ''
      const descripcion = articuloXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      return {
        id:          tag(v, 'ID'),
        fechaHora:   tag(v, 'Fecha'),
        fecha:       tag(v, 'Fecha').split('T')[0],
        resultado:   tag(v, 'Resultado'),
        quorum:      tag(v, 'Quorum'),
        boletin:     tag(v, 'Boletin'),
        descripcion,
        sesionId:    tag(sesionXml, 'ID'),
        totalSi:     parseInt(tag(v, 'TotalAfirmativos')) || 0,
        totalNo:     parseInt(tag(v, 'TotalNegativos'))   || 0,
        totalAbs:    parseInt(tag(v, 'TotalAbstenciones'))|| 0,
      }
    })
    // Ordenar cronológicamente y numerar
    votaciones.sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
    votaciones = votaciones.map((v, i) => ({ ...v, numero: i + 1 }))
    return { tipo: 'boletin', votaciones }
  }

  if (tipo === 'detalle') {
    // Cabecera
    const descripcion = tag(xml, 'Articulo').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const fecha       = tag(xml, 'Fecha').split('T')[0]
    const totalSi     = parseInt(tag(xml, 'TotalAfirmativos')) || 0
    const totalNo     = parseInt(tag(xml, 'TotalNegativos'))   || 0
    const totalAbs    = parseInt(tag(xml, 'TotalAbstenciones'))|| 0

    // Votos individuales: cada <Voto> contiene <Diputado> y <OpcionVoto>
    const votosXml = tagAll(xml, 'Voto').filter(v => !v.includes('xsi:nil="true"'))
    const votos = votosXml.map(v => {
      const dipXml  = v.match(/<Diputado[^>]*>([\s\S]*?)<\/Diputado>/i)?.[1] || ''
      const n1      = tag(dipXml, 'Nombre')
      const n2      = tag(dipXml, 'Nombre2')
      const apP     = tag(dipXml, 'ApellidoPaterno')
      const apM     = tag(dipXml, 'ApellidoMaterno')
      const nombre  = [n1, n2].filter(Boolean).join(' ') + (apP ? ' ' + apP : '') + (apM ? ' ' + apM : '')
      const opcion  = tag(v, 'OpcionVoto')
      return { diputado: nombre.trim(), opcion }
    })

    return { tipo: 'detalle', descripcion, fecha, votos, resumen: { si: totalSi, no: totalNo, abs: totalAbs } }
  }

  return { error: 'Tipo desconocido' }
}
