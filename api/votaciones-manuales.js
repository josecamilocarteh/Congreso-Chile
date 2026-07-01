// Votaciones que la API del Senado (web-back.senado.cl) nunca publicó,
// cargadas a mano y con fuente citada, para que la app no muestre
// datos incompletos sin avisar.
//
// Cómo agregar una nueva entrada:
// 1. Confirma con al menos una fuente de prensa los totales (Sí/No/Abst.)
// 2. Copia el bloque de abajo, cambia fecha/boletin/descripcion/totales/fuente
// 3. Si tienes el detalle voto por voto, agrégalo en "votos"; si no, deja votos: []
//
// El backend (api/votaciones.js) mezcla automáticamente estas entradas
// con lo que devuelva la API oficial para la misma fecha, evitando duplicados
// por (boletin + descripcion).

export const VOTACIONES_MANUALES = [
  {
    id: 'manual-2738-01-cap2',
    fecha: '2026-06-30',                 // YYYY-MM-DD
    hora: '30/06/2026 18:19',            // interpolado entre Cap.1 (18:19:32) y Cap.3 (18:20:15)
    sesion: 39,
    boletin: '2738-01',
    descripcion: 'Votación del Capítulo 2 de la acusación constitucional en contra del ex Ministro de Hacienda, señor Nicolás Grau',
    quorum: 'Q.C.',
    totalSi: 9,
    totalNo: 32,
    totalAbs: 2,
    totalDisp: 0,
    resultado: 'Rechazado',
    votos: [],                            // sin desglose individual confirmado por senador
    fuente: 'manual',
    fuenteDetalle: 'BioBioChile, 30-06-2026',
    fuenteUrl: 'https://www.biobiochile.cl/noticias/nacional/chile/2026/06/30/senado-rechaza-acusacion-constitucional-contra-exministro-nicolas-grau.shtml'
  }
]
