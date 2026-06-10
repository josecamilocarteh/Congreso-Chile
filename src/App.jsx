import { useState } from 'react'
import Senado from './components/Senado'
import Diputados from './components/Diputados'
import SimuladorQuorum from './components/SimuladorQuorum'
import Votaciones from './components/Votaciones'
import VotacionesSenado from './components/VotacionesSenado'
import VotacionesDia from './components/VotacionesDia'

export default function App() {
  const [tab, setTab] = useState('senado')

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", minHeight: '100vh', background: '#f1f5f9' }}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div>
            <div style={styles.eyebrow}>República de Chile</div>
            <h1 style={styles.title}>Congreso Nacional</h1>
            <div style={styles.subtitle}>Período Legislativo 2026–2030</div>
          </div>
          <div style={styles.tabs}>
            <button
              onClick={() => setTab('senado')}
              style={{ ...styles.tabBtn, ...(tab === 'senado' ? styles.tabActive : styles.tabInactive) }}>
              🏛 Senado
            </button>
            <button
              onClick={() => setTab('diputados')}
              style={{ ...styles.tabBtn, ...(tab === 'diputados' ? styles.tabActive : styles.tabInactive) }}>
              🏢 Cámara de Diputados
            </button>
            <button
              onClick={() => setTab('simulador')}
              style={{ ...styles.tabBtn, ...(tab === 'simulador' ? { ...styles.tabActive, background: '#7c3aed' } : styles.tabInactive) }}>
              ⚖️ Simulador de Quórums
            </button>
            <button
              onClick={() => setTab('votaciones')}
              style={{ ...styles.tabBtn, ...(tab === 'votaciones' ? { ...styles.tabActive, background: '#0f766e' } : styles.tabInactive) }}>
              🗳 Votaciones Cámara
            </button>
            <button
              onClick={() => setTab('votsenado')}
              style={{ ...styles.tabBtn, ...(tab === 'votsenado' ? { ...styles.tabActive, background: '#7c3aed' } : styles.tabInactive) }}>
              🏛 Votaciones Senado
            </button>
            <button
              onClick={() => setTab('votdia')}
              style={{ ...styles.tabBtn, ...(tab === 'votdia' ? { ...styles.tabActive, background: '#0f766e' } : styles.tabInactive) }}>
              🗓 Votaciones por día
            </button>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 60px' }}>
        {tab === 'senado' ? <Senado /> : tab === 'diputados' ? <Diputados /> : tab === 'simulador' ? <SimuladorQuorum /> : tab === 'votaciones' ? <Votaciones /> : tab === 'votsenado' ? <VotacionesSenado /> : <VotacionesDia />}
      </main>

      {/* FOOTER */}
      <footer style={styles.footer}>
        Sitio creado por José Camilo Carte Hernández, Asesor Legislativo.
      </footer>
    </div>
  )
}

const styles = {
  header: { background: 'white', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' },
  headerInner: { maxWidth: 1100, margin: '0 auto', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
  eyebrow: { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#64748b', marginBottom: 2, fontWeight: 600 },
  title: { fontSize: 24, fontWeight: 700, color: '#0f172a', fontFamily: "'Playfair Display', serif" },
  subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  tabs: { display: 'flex', gap: 8 },
  tabBtn: { padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: "'Inter', sans-serif", transition: 'all 0.15s' },
  tabActive: { background: '#1e40af', color: 'white', boxShadow: '0 2px 8px rgba(30,64,175,0.3)' },
  tabInactive: { background: '#f1f5f9', color: '#475569' },
  footer: { textAlign: 'center', padding: '24px 20px 32px', fontSize: 13, color: '#94a3b8', borderTop: '1px solid #e2e8f0' },
}
