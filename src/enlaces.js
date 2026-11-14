// Enlaces permanentes a una votación.
// Formato:  /votacion/camara/AAAA-MM-DD/ID   ·   /votacion/senado/AAAA-MM-DD/ID
// La fecha va en el enlace porque las APIs oficiales se consultan por año (Cámara)
// o por día (Senado); con ella la página puede encontrar la votación sin buscar a ciegas.

export function rutaVotacion(camara, fecha, id) {
  const c = camara === 'sen' || camara === 'senado' ? 'senado' : 'camara'
  return `/votacion/${c}/${fecha}/${encodeURIComponent(String(id))}`
}

export function enlaceVotacion(camara, fecha, id) {
  const origen = typeof window !== 'undefined' ? window.location.origin : 'https://congreso-chile.vercel.app'
  return origen + rutaVotacion(camara, fecha, id)
}

// Código corto y legible para citar en un informe: C-12345 (Cámara) / S-12345 (Senado)
export function codigoVotacion(camara, id) {
  const c = camara === 'sen' || camara === 'senado' ? 'S' : 'C'
  return `${c}-${id}`
}

// Lee la ruta actual. Devuelve { camara: 'camara'|'senado', fecha, id } o null.
export function leerRutaVotacion(pathname) {
  const m = String(pathname || '').match(/^\/votacion\/(camara|senado)\/(\d{4}-\d{2}-\d{2})\/([^/?#]+)\/?$/i)
  if (!m) return null
  return { camara: m[1].toLowerCase(), fecha: m[2], id: decodeURIComponent(m[3]) }
}

export async function copiarTexto(texto) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto)
      return true
    }
  } catch (e) { /* se intenta el método antiguo */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = texto
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch (e) {
    return false
  }
}
