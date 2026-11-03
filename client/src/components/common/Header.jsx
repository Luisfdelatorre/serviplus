import React from 'react';
import { useMenuStore } from '../../store/useMenuStore';
import { useI18n } from '../../i18n';
import { sfx } from '../../utils/audio';
import { enterFullscreen } from '../../utils/fullscreen';

export function Header() {
  const activeTab = useMenuStore((state) => state.activeTab);
  const setActiveTab = useMenuStore((state) => state.setActiveTab);
  const setKioskFullscreen = useMenuStore((state) => state.setKioskFullscreen);
  const { lang, setLang } = useI18n();

  const handleTabChange = (tab) => {
    sfx.playTap();
    setActiveTab(tab);
  };

  return (
    <header
      className="main-header"
      style={{
        height: '56px',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 100
      }}
    >
      {/* Brand Serviplus */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#da291c', letterSpacing: '-0.5px' }}>
          Serviplus
        </span>
        <span
          style={{
            background: '#ffbc0d',
            color: '#000000',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontSize: '0.72rem',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          KIOSK & KDS
        </span>
      </div>

      {/* Navigation Tabs */}
      <nav style={{ display: 'flex', gap: '6px' }}>
        {[
          { id: 'kiosk', label: '🍔 Kiosk Autoservicio' },
          { id: 'cashier', label: '💻 Front Desk Caja' },
          { id: 'kds', label: '👨‍🍳 KDS Cocina' },
          { id: 'turns', label: '📢 Monitor de Turnos' }
        ].map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
              style={{
                padding: '7px 16px',
                borderRadius: '9999px',
                border: isActive ? '1.5px solid #fecaca' : '1px solid #e2e8f0',
                background: isActive ? '#ffffff' : '#f8fafc',
                color: isActive ? '#da291c' : '#475569',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: isActive ? '0 1px 4px rgba(218, 41, 28, 0.12)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Language Switch & Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Toggle Idioma Segmentado */}
        <div
          style={{
            display: 'flex',
            background: '#f1f5f9',
            padding: '2px',
            borderRadius: '8px',
            fontSize: '0.78rem',
            fontWeight: 800
          }}
        >
          <button
            type="button"
            onClick={() => { sfx.playTap(); setLang('es'); }}
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              border: 'none',
              background: lang === 'es' ? '#ffffff' : 'transparent',
              color: lang === 'es' ? '#0f172a' : '#64748b',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: lang === 'es' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none'
            }}
          >
            ES
          </button>
          <button
            type="button"
            onClick={() => { sfx.playTap(); setLang('en'); }}
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              border: 'none',
              background: lang === 'en' ? '#ffffff' : 'transparent',
              color: lang === 'en' ? '#0f172a' : '#64748b',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: lang === 'en' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none'
            }}
          >
            EN
          </button>
        </div>

        {/* Botón Pantalla Completa 
        <button
          type="button"
          onClick={() => {
            sfx.playTap();
            enterFullscreen();
            if (activeTab === 'kiosk') {
              setKioskFullscreen(true);
            }
          }}
          title="Pantalla Completa Kiosk"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: '#f8fafc',
            border: '1.5px solid #cbd5e1',
            borderRadius: '8px',
            padding: '4px 10px',
            fontSize: '0.8rem',
            fontWeight: 800,
            color: '#1e293b',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ fontSize: '0.9rem' }}>⛶</span>
          <span>Pantalla Completa</span>
        </button>
*/}
        {/* Status Dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
          <span>En línea</span>
        </div>
      </div>
    </header>
  );
}
