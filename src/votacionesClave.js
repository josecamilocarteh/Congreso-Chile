// ---------------------------------------------------------------------------
// Votaciones Clave — set curado manualmente (NO automático).
//
// Cómo agregar una votación nueva:
// 1. Encuentra el número de boletín del proyecto (tramitacion.senado.cl o
//    camara.cl).
// 2. Copia un bloque de abajo y cambia sus campos. `camara` debe ser la
//    cámara en la que YA se realizó la votación que quieres mostrar
//    ('senado' o 'diputados') — si un proyecto votó en ambas cámaras y
//    quieres las dos, agrega dos entradas con id distinto.
// 3. `criterioSeleccion` es obligatorio: es el texto que se muestra en la
//    página para justificar por qué esta votación se considera "clave".
//    Esto es lo que blinda la neutralidad editorial del módulo.
// 4. El componente VotacionesClave.jsx elige automáticamente, dentro del
//    boletín, la votación con mayor participación total (proxy razonable
//    de "la votación de sala", no una corrección de forma o de un artículo
//    menor). Si un proyecto tuvo varias votaciones divididas por capítulo
//    y quieres una específica, se puede fijar a mano con `votacionIdFijo`
//    (solo aplica a camara:'diputados', ya que ahí cada artículo tiene un
//    ID de votación propio).
// ---------------------------------------------------------------------------

export const CATEGORIAS_CLAVE = {
  fiscal: 'Fiscal',
  reforma_estructural: 'Reforma estructural',
  social: 'Social',
  institucionalidad: 'Institucionalidad',
  seguridad: 'Seguridad',
}

export const VOTACIONES_CLAVE = [
  {
    id: 'endeudamiento-2026',
    titulo: 'Endeudamiento Fiscal 2026',
    categoria: 'fiscal',
    camara: 'senado',
    boletin: '18296-05',
    fecha: '2026-07-07',
    criterioSeleccion:
      'Autoriza al Fisco a contraer hasta US$6.200 millones adicionales de deuda para el ejercicio 2026. Impacto fiscal directo y votación con quiebre claro oficialismo/oposición en el Senado (28 a favor, 15 en contra, 1 abstención).',
    fuenteUrl: 'https://www.24horas.cl/actualidad/politica/senado-despacha-ley-aumento-endeudamiento-fiscal-2026',
    fuenteDetalle: '24horas, 08-07-2026',
  },
  {
    id: 'mega-reforma-2026',
    titulo: 'Mega Reforma (Reconstrucción Nacional y Desarrollo Económico y Social)',
    categoria: 'reforma_estructural',
    camara: 'senado',
    boletin: '18216-05',
    fecha: '2026-07-16',
    criterioSeleccion:
      'Proyecto emblema del Gobierno de Kast: rebaja gradual del impuesto corporativo de 27% a 23%, invariabilidad tributaria e institucionalidad económica. Aprobado en particular por el margen mínimo posible en el Senado (26 a favor, 24 en contra).',
    fuenteUrl: 'https://parlamento.ai/r/reconstruccion-18216-tramitacion-completa-2026',
    fuenteDetalle: 'Tramitación oficial del Senado, Boletín 18.216-05',
  },
  {
    id: 'sae-2026',
    titulo: 'Modificación al Sistema de Admisión Escolar (SAE)',
    categoria: 'social',
    camara: 'diputados',
    boletin: '18389-04',
    fecha: '2026-08-05',
    criterioSeleccion:
      'Reemplaza el mecanismo de admisión aleatoria por un sistema mixto de Elección Mutua y Asignación Aleatoria. Alta cobertura pública y primer trámite con votación transversal en la Cámara (111 a favor, 28 en contra, 1 abstención).',
    fuenteUrl: 'https://www.eldinamo.cl/pais/2026/08/05/congreso-aprueba-reforma-al-sae-y-proyecto-que-modifica-el-sistema-de-admision-escolar-pasa-al-senado/',
    fuenteDetalle: 'El Dínamo, 05-08-2026',
  },
]

export const METODOLOGIA_TEXTO =
  'Este módulo muestra solo un conjunto reducido de votaciones seleccionadas ' +
  'manualmente por su relevancia fiscal, estructural o social — no es un ' +
  'listado automático ni exhaustivo. Para cada votación se toma, dentro del ' +
  'boletín correspondiente, la instancia de votación en sala con mayor ' +
  'participación total. La "fidelidad de bancada" mide cuántas veces un ' +
  'parlamentario votó igual que la posición mayoritaria de su propio partido ' +
  'en estas votaciones clave (no en todas las votaciones del período).'

