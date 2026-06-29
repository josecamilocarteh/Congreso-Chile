export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const boletin = req.query.boletin
  const votacionId = req.query.votacionId
  const BASE = 'https://opendata.congreso.cl/wscamaradiputados.asmx'

  try {
    let url = ''
    let tipo = ''

    const proyecto = req.query.proyecto

    // Datos del proyecto desde la API del Senado
    if (proyecto) {
      const num = String(proyecto).split('-')[0]
      const urlSenado = 'https://tramitacion.senado.cl/wspublico/tramitacion.php?boletin=' + num
      const r = await fetch(urlSenado)
      if (!r.ok) return res.status(200).json({ error: 'API Senado código ' + r.status })
      const xmlS = await r.text()
      return res.status(200).json(parsearProyecto(xmlS))
    }

    // Votaciones de la Cámara por AÑO (lista por día) — API opendata.camara.cl
    if (req.query.votacionesAnio) {
      const anno = String(req.query.votacionesAnio).replace(/[^0-9]/g, '') || '2026'
      const urlA = 'https://opendata.camara.cl/camaradiputados/WServices/WSLegislativo.asmx/retornarVotacionesXAnno?prmAnno=' + anno
      const r = await fetch(urlA)
      if (!r.ok) return res.status(200).json({ error: 'API Cámara código ' + r.status })
      const xmlA = await r.text()
      return res.status(200).json(parsearAnio(xmlA))
    }

    // Detalle (votos individuales) de UNA votación, desde la API nueva del año
    // Sirve para TODOS los tipos, incluidos acuerdos y resoluciones
    if (req.query.detalleAnio) {
      const idv = String(req.query.detalleAnio).replace(/[^0-9]/g, '')
      const anno = String(req.query.anio || '2026').replace(/[^0-9]/g, '') || '2026'
      const urlD = 'https://opendata.camara.cl/camaradiputados/WServices/WSLegislativo.asmx/retornarVotacionesXAnno?prmAnno=' + anno
      const r = await fetch(urlD)
      if (!r.ok) return res.status(200).json({ error: 'API Cámara código ' + r.status })
      const xmlD = await r.text()
      return res.status(200).json(parsearDetalleAnio(xmlD, idv))
    }

    // Detalle COMPLETO desde la página web de la Cámara (votacion_detalle.aspx)
    // Trae materia, tipo y los votos diputado por diputado de TODOS los tipos
    // (proyectos de ley, acuerdos, resoluciones y votaciones de la cuenta/sala)
    if (req.query.camaraDetalle) {
      const idc = String(req.query.camaraDetalle).replace(/[^0-9]/g, '')
      const directa = 'https://www.camara.cl/legislacion/sala_sesiones/votacion_detalle.aspx?prmIdVotacion=' + idc
      const cab = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-CL,es;q=0.9',
        'Referer': 'https://www.camara.cl/legislacion/sala_sesiones/votaciones.aspx'
      }
      let htmlC = ''
      // 1) intento directo
      try { const r = await fetch(directa, { headers: cab }); if (r.ok) htmlC = await r.text() } catch (e) {}
      // 2) si el servidor está bloqueado (403), intento vía pasarela pública
      if (!htmlC || htmlC.length < 800) {
        try {
          const r2 = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(directa), { headers: cab })
          if (r2.ok) htmlC = await r2.text()
        } catch (e) {}
      }
      if (!htmlC || htmlC.length < 800) {
        return res.status(200).json({ error: 'bloqueado', url: directa, votos: [], materia: '' })
      }
      const parsed = parsearCamaraDetalle(htmlC)
      parsed.url = directa
      return res.status(200).json(parsed)
    }

    // DIAGNÓSTICO Senado: prueba varios identificadores y reporta cuál trae datos
    if (req.query.senadoLegi) {
      const cab = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-CL,es;q=0.9'
      }
      const candidatos = String(req.query.senadoLegi) === 'auto'
        ? ['462', '463', '461', '460', '374', '375', '373']
        : [String(req.query.senadoLegi).replace(/[^0-9]/g, '')]
      const resultados = []
      let muestra = ''
      for (const legi of candidatos) {
        const u = 'https://tramitacion.senado.cl/appsenado/index.php?mo=sesionessala&ac=votacionSala&legiini=' + legi
        try {
          const r = await fetch(u, { headers: cab })
          const html = await r.text()
          resultados.push({ legi: legi, status: r.status, largo: html.length })
          if (!muestra && html.length > 200) muestra = html.slice(0, 4000)
        } catch (e) {
          resultados.push({ legi: legi, error: String(e && e.message || e) })
        }
      }
      return res.status(200).json({ resultados: resultados, muestra: muestra })
    }

    // Votaciones del Senado por boletín
    if (req.query.senado) {
      const num = String(req.query.senado).split('-')[0]
      const urlV = 'https://tramitacion.senado.cl/wspublico/votaciones.php?boletin=' + num
      const r = await fetch(urlV)
      if (!r.ok) return res.status(200).json({ error: 'API Senado código ' + r.status })
      const xmlV = await r.text()
      return res.status(200).json(parsearSenado(xmlV))
    }

    if (votacionId) {
      url = BASE + '/getVotacion_Detalle?prmVotacionId=' + votacionId
      tipo = 'detalle'
    } else if (boletin) {
      url = BASE + '/getVotaciones_Boletin?prmBoletin=' + boletin
      tipo = 'boletin'
    } else {
      return res.status(400).json({ error: 'Falta el parámetro boletin, votacionId o proyecto' })
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

function limpiar(s) {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parsearAnio(xml) {
  const votaciones = tagAll(xml, 'Votacion').map(function (v) {
    // Quitar el bloque de votos individuales para aligerar y evitar tags anidados
    const vc = v.replace(/<Votos>[\s\S]*?<\/Votos>/i, '')
    const fechaRaw = limpiar(tag(vc, 'Fecha'))
    return {
      id: limpiar(tag(vc, 'Id')),
      fechaHora: fechaRaw,
      fecha: (fechaRaw.split('T')[0] || fechaRaw).slice(0, 10),
      descripcion: limpiar(tag(vc, 'Descripcion')),
      resultado: limpiar(tag(vc, 'Resultado')),
      tipo: limpiar(tag(vc, 'Tipo')),
      quorum: limpiar(tag(vc, 'Quorum')),
      totalSi: parseInt(tag(vc, 'TotalSi')) || 0,
      totalNo: parseInt(tag(vc, 'TotalNo')) || 0,
      totalAbs: parseInt(tag(vc, 'TotalAbstencion')) || 0,
      totalDisp: parseInt(tag(vc, 'TotalDispensado')) || 0
    }
  })
  votaciones.sort(function (a, b) {
    const f = (a.fechaHora || '').localeCompare(b.fechaHora || '')
    if (f !== 0) return f
    return (parseInt(a.id) || 0) - (parseInt(b.id) || 0)
  })
  return { tipo: 'anio', votaciones: votaciones }
}

function normOpcion(s) {
  const t = limpiar(s).toLowerCase()
  if (!t) return ''
  if (t.indexOf('afirm') >= 0 || t === 'si' || t === 'sí' || t.indexOf('a favor') >= 0) return 'Afirmativo'
  if (t.indexOf('contra') >= 0 || t === 'no' || t.indexOf('rechaz') >= 0) return 'En Contra'
  if (t.indexOf('absten') >= 0) return 'Abstencion'
  if (t.indexOf('no vot') >= 0) return 'No Vota'
  if (t.indexOf('dispen') >= 0) return 'Dispensado'
  if (t.indexOf('pareo') >= 0 || t.indexOf('paread') >= 0) return 'Pareo'
  return limpiar(s)
}

function parsearDetalleAnio(xml, id) {
  const bloques = tagAll(xml, 'Votacion')
  let target = ''
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i]
    const head = b.split('<Votos>')[0]
    if (limpiar(tag(head, 'Id')) === id) { target = b; break }
  }
  if (!target) return { tipo: 'detalleAnio', encontrado: false, votos: [] }
  const votosXml = (target.match(/<Votos>([\s\S]*?)<\/Votos>/i) || [])[1] || ''
  const votos = tagAll(votosXml, 'Voto').map(function (vt) {
    const dip = tag(vt, 'Diputado')
    let nombre = [tag(dip, 'Nombre'), tag(dip, 'ApellidoPaterno'), tag(dip, 'ApellidoMaterno')]
      .map(limpiar).filter(Boolean).join(' ').trim()
    if (!nombre) nombre = limpiar(dip)
    return { diputado: nombre, opcion: normOpcion(tag(vt, 'OpcionVoto')) }
  }).filter(function (x) { return x.diputado })
  return { tipo: 'detalleAnio', encontrado: true, votos: votos }
}

function parsearCamaraDetalle(html) {
  // --- Materia y Tipo desde el texto plano ---
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í').replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú').replace(/&ntilde;/gi, 'ñ').replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ').trim()
  function entre(a, b, max) {
    const i = txt.indexOf(a); if (i < 0) return ''
    const desde = i + a.length
    const j = b ? txt.indexOf(b, desde) : -1
    return txt.slice(desde, (j > 0 && j - desde < (max || 1200)) ? j : desde + (max || 1200)).trim()
  }
  const materia = entre('Materia:', 'Sesión:') || entre('Materia:', 'Tipo de Votación')
  let tipo = entre('Tipo de Votación', 'Resultado', 60)
  if (!tipo) tipo = entre('Tipo:', 'Resultado', 60)

  // --- Votos: ubicar secciones y asignar cada diputado a su opción ---
  const marcas = []
  const secs = [
    { re: />\s*A Favor\s*</gi, op: 'Afirmativo' },
    { re: />\s*En Contra\s*</gi, op: 'En Contra' },
    { re: />\s*Abstenci[oó&][^<]*</gi, op: 'Abstencion' },
    { re: />\s*Dispensad[oa]s?\s*</gi, op: 'Dispensado' }
  ]
  secs.forEach(function (s) { let m; while ((m = s.re.exec(html)) !== null) marcas.push({ pos: m.index, op: s.op }) })
  marcas.sort(function (a, b) { return a.pos - b.pos })

  const votos = []
  const linkRe = /detalle\/mociones\.aspx\?prmID=\d+[^>]*>([^<]+)<\/a>/gi
  let lm
  while ((lm = linkRe.exec(html)) !== null) {
    const pos = lm.index
    let op = ''
    for (let k = 0; k < marcas.length; k++) { if (marcas[k].pos < pos) op = marcas[k].op; else break }
    if (!op) continue
    let nombre = lm[1].replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim()
    if (nombre.indexOf(',') >= 0) {
      const p = nombre.split(',')
      nombre = (p[1] + ' ' + p[0]).replace(/\s+/g, ' ').trim()  // "Apellidos, Nombre" → "Nombre Apellidos"
    }
    if (nombre) votos.push({ diputado: nombre, opcion: op })
  }

  return { tipo: 'camaraDetalle', materia: materia, tipoVotacion: tipo, votos: votos }
}

function parsearSenado(xml) {
  const votaciones = tagAll(xml, 'votacion').map(function (v) {
    const detalleXml = (v.match(/<DETALLE_VOTACION>([\s\S]*?)<\/DETALLE_VOTACION>/i) || [])[1] || ''
    const votos = tagAll(detalleXml, 'VOTO').map(function (vt) {
      return {
        parlamentario: limpiar(tag(vt, 'PARLAMENTARIO')),
        seleccion: limpiar(tag(vt, 'SELECCION'))
      }
    })
    return {
      sesion: limpiar(tag(v, 'SESION')),
      fecha: limpiar(tag(v, 'FECHA')),
      tema: limpiar(tag(v, 'TEMA')),
      si: parseInt(tag(v, 'SI')) || 0,
      no: parseInt(tag(v, 'NO')) || 0,
      abstencion: parseInt(tag(v, 'ABSTENCION')) || 0,
      pareo: parseInt(tag(v, 'PAREO')) || 0,
      quorum: limpiar(tag(v, 'QUORUM')),
      tipoVotacion: limpiar(tag(v, 'TIPOVOTACION')),
      etapa: limpiar(tag(v, 'ETAPA')),
      votos: votos
    }
  })
  return { tipo: 'senado', votaciones: votaciones }
}

function parsearProyecto(xml) {
  // Solo el primer <descripcion> (datos del proyecto)
  const desc = (xml.match(/<descripcion>([\s\S]*?)<\/descripcion>/i) || [])[1] || ''
  return {
    tipo: 'proyecto',
    boletin: limpiar(tag(desc, 'boletin')),
    titulo: limpiar(tag(desc, 'titulo')),
    fechaIngreso: limpiar(tag(desc, 'fecha_ingreso')),
    iniciativa: limpiar(tag(desc, 'iniciativa')),
    camaraOrigen: limpiar(tag(desc, 'camara_origen')),
    urgencia: limpiar(tag(desc, 'urgencia_actual')),
    etapa: limpiar(tag(desc, 'etapa')),
    subetapa: limpiar(tag(desc, 'subetapa')),
    estado: limpiar(tag(desc, 'estado')),
  }
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

    // 1) Intentar leer los votos desde la estructura XML real <Votos><Voto><Diputado/><Opcion/></Voto>
    let votos = []
    const votosXml = (xml.match(/<Votos>([\s\S]*?)<\/Votos>/i) || [])[1] || ''
    if (votosXml) {
      votos = tagAll(votosXml, 'Voto').map(function (vt) {
        const dip = tag(vt, 'Diputado')
        let nombre = [
          tag(dip, 'Nombre'),
          tag(dip, 'Apellido_Paterno') || tag(dip, 'ApellidoPaterno'),
          tag(dip, 'Apellido_Materno') || tag(dip, 'ApellidoMaterno')
        ].map(limpiar).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
        if (!nombre) nombre = limpiar(dip).replace(/^\d+\s*/, '').trim()  // quitar Id inicial si vino plano
        const opcion = normOpcion(tag(vt, 'Opcion') || tag(vt, 'OpcionVoto') || tag(vt, 'Seleccion'))
        return { diputado: nombre, opcion: opcion }
      }).filter(function (x) { return x.diputado && x.opcion })
    }

    // 2) Fallback: texto plano "ID Nombre Apellido1 Apellido2 Opcion" (formato antiguo)
    if (votos.length === 0) {
      const texto = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const patron = /(\d{3,4})\s+((?:[A-ZÁÉÍÓÚÑÜ][a-záéíóúñüà]+(?:\s+y)?\s+)+)(Afirmativo|En Contra|Abstencion|No Vota|Dispensado|Pareo)/g
      let m
      while ((m = patron.exec(texto)) !== null) {
        votos.push({ diputado: m[2].trim(), opcion: m[3] })
      }
    }

    return { tipo: 'detalle', descripcion: descripcion, fecha: fecha, votos: votos, resumen: { si: totalSi, no: totalNo, abs: totalAbs } }
  }

  return { error: 'Tipo desconocido' }
}
