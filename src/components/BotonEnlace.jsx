import { useState } from 'react'
import { enlaceVotacion, copiarTexto } from '../enlaces'

// Botón "Copiar enlace" para una votación. Copia la URL permanente al portapapeles.
// Si el navegador no deja copiar, muestra la URL para copiarla a mano.
export default function BotonEnlace({ camara, fecha, id, grande = false }) {
  const [estado, setEstado] = useState('')   // '' | 'ok' | 'error'
  if (!fecha || id === undefined || id === null || id === '') return null
  const url = enlaceVotacion(camara, fecha, id)

  async function copiar(e) {
    e.stopPropagation()
    const ok = await copiarTexto(url)
    if (ok) {
      setEstado('ok')
      setTimeout(() => setEstado(''), 2000)
    } else {
      setEstado('error')
      window.prompt('Copia este enlace:', url)
      setEstado('')
    }
  }

  const ok = estado === 'ok'
  return (
    <button
      onClick={copiar}
      title={'Copiar enlace a esta votación\n' + url}
      style={{
        fontSize: grande ? 13 : 11, fontWeight: 700,
        color: ok ? 'white' : '#1e3a8a',
        background: ok ? '#1e40af' : '#eff6ff',
        border: '1px solid ' + (ok ? '#1e40af' : '#bfdbfe'),
        borderRadius: grande ? 8 : 6,
        padding: grande ? '8px 14px' : '3px 8px',
        cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
        fontFamily: "'Inter', sans-serif"
      }}
    >
      {ok ? '✓ Enlace copiado' : '🔗 Copiar enlace'}
    </button>
  )
}
