// src/materiaVotacion.js
// Lee el texto "Se vota…" de una votación y extrae etiquetas cortas
// (Partida, Capítulo, Programa, Artículo, Indicación, etc.) para identificarla
// de un vistazo. Sirve para TODOS los proyectos de ley, no solo Presupuestos.

const PATRONES = [
  [/partida\s+(?:n[°ºo.]*\s*)?(\d{1,3})/i, m => `Partida ${m[1]}`],
  [/cap[ií]tulo\s+(?:n[°ºo.]*\s*)?(\d{1,3})/i, m => `Capítulo ${m[1]}`],
  [/programa\s+(?:n[°ºo.]*\s*)?(\d{1,3})/i, m => `Programa ${m[1]}`],
  [/art[ií]culos?\s+(?:n[°ºo.]*\s*)?(\d+[°º]?(?:\s*(?:,|y|al|a)\s*\d+[°º]?)*(?:\s+(?:bis|ter|transitorio))?)/i, m => `Art. ${m[1].replace(/\s+/g, ' ').trim()}`],
  [/indicaci[oó]n(?:es)?\s*(?:n[°ºo.]*\s*)?(\d+)?/i, m => (m[1] ? `Indicación ${m[1]}` : 'Indicación')],
  [/votaci[oó]n\s+separada/i, () => 'Votación separada'],
  [/inadmisib/i, () => 'Inadmisibilidad'],
  [/reserva\s+de\s+constitucionalidad/i, () => 'Reserva de constitucionalidad'],
  [/comisi[oó]n\s+mixta/i, () => 'Comisión mixta'],
  [/veto/i, () => 'Veto'],
  [/tercer\s+tr[aá]mite/i, () => 'Tercer trámite'],
]

export function resumirMateria(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim()
  const etiquetas = []
  for (const [re, fn] of PATRONES) {
    const m = t.match(re)
    if (m) {
      const e = fn(m)
      if (!etiquetas.includes(e)) etiquetas.push(e)
    }
  }
  return { texto: t, etiquetas: etiquetas.slice(0, 5) }
}

// Enlace general a la Sala de la Cámara (la minuta de cada sesión está ahí,
// pero no tiene URL estable por votación; se enlaza a la página de la Sala).
export const URL_SALA_CAMARA = 'https://www.camara.cl/sala/default.aspx'
