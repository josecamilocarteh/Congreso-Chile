import { useState, useEffect } from 'react'
import Senado from './components/Senado'
import Diputados from './components/Diputados'
import SimuladorQuorum from './components/SimuladorQuorum'
import Votaciones from './components/Votaciones'
import VotacionesSenado from './components/VotacionesSenado'
import VotacionesDia from './components/VotacionesDia'

function useIsMobile() {
  const [mobile, setMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 720 : false)
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 720)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return mobile
}

export default function App() {
  const [tab, setTab] = useState('senado')
  const isMobile = useIsMobile()

  const TABS = [
    ['senado', '🏛 Senado', '#1e40af'],
    ['diputados', '🏢 Cámara de Diputados', '#1e40af'],
    ['simulador', '⚖️ Simulador de Quórums', '#7c3aed'],
    ['votaciones', '🗳 Votaciones Cámara', '#0f766e'],
    ['votsenado', '🏛 Votaciones Senado', '#7c3aed'],
    ['votdia', '🗓 Votaciones por día', '#0f766e'],
  ]

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", minHeight: '100vh', background: '#f1f5f9', overflowX: 'hidden' }}>
      <header style={styles.header}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '16px 14px' : '20px' }}>
          {/* Fila superior: título + logo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={styles.eyebrow}>República de Chile</div>
              <h1 style={{ ...styles.title, fontSize: isMobile ? 20 : 24 }}>Congreso Nacional</h1>
              <div style={styles.subtitle}>Período Legislativo 2026–2030</div>
            </div>
            {/* LOGO / firma */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <img
                src="/logo-jcc.png"
                alt="José Camilo Carte Hernández — Asesor Legislativo"
                style={{ height: isMobile ? 34 : 42, width: 'auto', display: 'block' }}
              />
            </div>
          </div>
          {/* Fila de pestañas */}
          <div style={{ display: 'flex', gap: isMobile ? 6 : 8, flexWrap: 'wrap', marginTop: isMobile ? 14 : 16 }}>
            {TABS.map(([key, label, color]) => {
              const active = tab === key
              return (
                <button key={key} onClick={() => setTab(key)} style={{
                  padding: isMobile ? '8px 12px' : '9px 20px',
                  borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
                  fontSize: isMobile ? 12.5 : 14, fontFamily: "'Inter', sans-serif",
                  flex: isMobile ? '1 1 calc(50% - 6px)' : '0 0 auto',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  background: active ? color : '#f1f5f9',
                  color: active ? 'white' : '#475569',
                  boxShadow: active ? '0 2px 8px rgba(30,64,175,0.25)' : 'none',
                }}>
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '20px 12px 48px' : '32px 20px 60px' }}>
        {tab === 'senado' ? <Senado /> : tab === 'diputados' ? <Diputados /> : tab === 'simulador' ? <SimuladorQuorum /> : tab === 'votaciones' ? <Votaciones /> : tab === 'votsenado' ? <VotacionesSenado /> : <VotacionesDia />}
      </main>

      <footer style={styles.footer}>
        Sitio creado por José Camilo Carte Hernández, Asesor Legislativo.
      </footer>
    </div>
  )
}

const styles = {
  header: { background: 'white', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' },
  eyebrow: { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#64748b', marginBottom: 2, fontWeight: 600 },
  title: { fontWeight: 700, color: '#0f172a', fontFamily: "'Playfair Display', serif" },
  subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  footer: { textAlign: 'center', padding: '24px 20px 32px', fontSize: 13, color: '#94a3b8', borderTop: '1px solid #e2e8f0' },
}
