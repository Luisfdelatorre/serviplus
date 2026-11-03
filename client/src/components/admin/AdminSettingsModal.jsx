import React, { useState, useEffect } from 'react';
import { getAdminConfig, saveAdminConfig } from '../../api';
import { sfx } from '../../utils/audio';
import {
  Settings,
  CreditCard,
  MessageSquare,
  Building2,
  Tv,
  Check,
  Save,
  X,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  QrCode
} from 'lucide-react';

export function AdminSettingsModal({ isOpen, onClose, currentAdmin }) {
  const [activeTab, setActiveTab] = useState('wompi');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await getAdminConfig();
      setConfig(data);
    } catch (err) {
      console.error('Error loading config:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      sfx.playTap();
      await saveAdminConfig(config);
      sfx.playSuccess();
      showToast('¡Configuración guardada y aplicada con éxito!');
    } catch (err) {
      sfx.playBeep();
      alert('Error al guardar configuración: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Presets rápidos para producción y sandbox
  const applyPocketbikeProdKeys = () => {
    sfx.playTap();
    setConfig((prev) => ({
      ...prev,
      wompi: {
        ...prev.wompi,
        mode: 'production',
        publicKey: 'pub_prod_afhk5iNPzbNXgRh3DrI8rFaQfT1xnpe2',
        privateKey: 'prv_prod_LbjaEDeBegEqUXHEvKkHImhxatgraWBz',
        integritySecret: 'prod_integrity_KDL6nq4DfUHaXwwVYqLC3SvWy5sTMksZ',
        eventsSecret: 'prod_events_TpPLiX3mc0PxEzquqhT5t2WaSZeaDzer'
      }
    }));
    showToast('Credenciales de producción Pocketbike cargadas');
  };

  const applyPocketbikeSandboxKeys = () => {
    sfx.playTap();
    setConfig((prev) => ({
      ...prev,
      wompi: {
        ...prev.wompi,
        mode: 'sandbox',
        sandbox: {
          publicKey: 'pub_test_82Z9KlLHoXDCfQ8nDCKW3hALwt23Lh62',
          privateKey: 'prv_test_1U9ImRNhUMsrHKsqQNe1GstIxGDbUPDy',
          integritySecret: 'test_integrity_rXGbWc5E5guVUx68RASrPxWNRfrYaEq3',
          eventsSecret: 'test_events_l5HJ6w0153hiCJeeBZgs77hlNgBNr2WI'
        }
      }
    }));
    showToast('Credenciales de Sandbox pruebas cargadas');
  };

  const applyHablameCredentials = () => {
    sfx.playTap();
    setConfig((prev) => ({
      ...prev,
      sms: {
        ...prev.sms,
        enabled: true,
        user: 'luis.delatorre0277@gmail.com',
        accountId: '10016115',
        apiKey: 'W7H4gqhGG1Euca6CokXO12lM2I8y2k',
        token: '63d7a2c2ff294943cabc51d87bb93ac4',
        apiUrl: 'https://api103.hablame.co/api/sms/v3/send/priority'
      }
    }));
    showToast('Credenciales de SMS Hablame cargadas');
  };

  return (
    <div className="admin-modal-overlay">
      <div className="admin-settings-container">
        {/* Barra Superior */}
        <div className="admin-settings-header">
          <div className="admin-settings-title-group">
            <div className="admin-header-badge">
              <Settings size={22} />
            </div>
            <div>
              <h2>Panel de Administración • Serviplus</h2>
              <div className="admin-user-pill">
                <ShieldCheck size={14} />
                <span>{currentAdmin?.name || 'Administrador'} (Nivel Aldelo: {currentAdmin?.securityLevel || 1})</span>
              </div>
            </div>
          </div>
          <button className="admin-close-btn" onClick={onClose} aria-label="Cerrar">
            <X size={22} />
          </button>
        </div>

        {/* Notificación Toast */}
        {toastMessage && (
          <div className="admin-toast-banner">
            <Check size={18} />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Navegación por Pestañas */}
        <div className="admin-tabs-nav">
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'wompi' ? 'active' : ''}`}
            onClick={() => { sfx.playTap(); setActiveTab('wompi'); }}
          >
            <CreditCard size={18} />
            <span>Pasarela Wompi (Bancolombia QR)</span>
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'sms' ? 'active' : ''}`}
            onClick={() => { sfx.playTap(); setActiveTab('sms'); }}
          >
            <MessageSquare size={18} />
            <span>SMS Hablame & Recibos</span>
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'restaurant' ? 'active' : ''}`}
            onClick={() => { sfx.playTap(); setActiveTab('restaurant'); }}
          >
            <Building2 size={18} />
            <span>Datos Fiscales & DIAN</span>
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'kiosk' ? 'active' : ''}`}
            onClick={() => { sfx.playTap(); setActiveTab('kiosk'); }}
          >
            <Tv size={18} />
            <span>Kiosco & Pantalla</span>
          </button>
        </div>

        {/* Contenido de Pestañas */}
        <div className="admin-tab-content">
          {loading ? (
            <div className="admin-loading-state">
              <RefreshCw className="spin" size={28} />
              <span>Cargando configuración...</span>
            </div>
          ) : !config ? (
            <div className="admin-error-state">
              <AlertTriangle size={32} />
              <p>No se pudo conectar con la configuración del servidor.</p>
            </div>
          ) : (
            <>
              {/* TAB 1: WOMPI & BANCOLOMBIA */}
              {activeTab === 'wompi' && (
                <div className="admin-form-section">
                  <div className="admin-section-header">
                    <div>
                      <h3>Integración Wompi (Bancolombia & Nequi)</h3>
                      <p>Configura las credenciales de la pasarela para generar el QR dinámico en pantalla.</p>
                    </div>
                    <div className="admin-preset-actions">
                      <button type="button" className="preset-btn prod" onClick={applyPocketbikeProdKeys}>
                        <Sparkles size={14} />
                        Cargar Producción Pocketbike
                      </button>
                      <button type="button" className="preset-btn test" onClick={applyPocketbikeSandboxKeys}>
                        Cargar Sandbox Pruebas
                      </button>
                    </div>
                  </div>

                  {/* Selector de Modo */}
                  <div className="admin-mode-card">
                    <span className="mode-label">Entorno Activo:</span>
                    <div className="admin-mode-toggle">
                      <button
                        type="button"
                        className={config.wompi?.mode === 'sandbox' ? 'active-test' : ''}
                        onClick={() => {
                          sfx.playTap();
                          setConfig({ ...config, wompi: { ...config.wompi, mode: 'sandbox' } });
                        }}
                      >
                        Pruebas (Sandbox)
                      </button>
                      <button
                        type="button"
                        className={config.wompi?.mode === 'production' ? 'active-prod' : ''}
                        onClick={() => {
                          sfx.playTap();
                          setConfig({ ...config, wompi: { ...config.wompi, mode: 'production' } });
                        }}
                      >
                        Producción Real
                      </button>
                    </div>
                  </div>

                  {/* Campos de Llaves según el modo activo */}
                  {config.wompi?.mode === 'production' ? (
                    <div className="admin-fields-grid">
                      <div className="form-group">
                        <label>Llave Pública de Producción (Public Key):</label>
                        <input
                          type="text"
                          value={config.wompi?.publicKey || ''}
                          onChange={(e) => setConfig({
                            ...config,
                            wompi: { ...config.wompi, publicKey: e.target.value }
                          })}
                          placeholder="pub_prod_..."
                        />
                      </div>
                      <div className="form-group">
                        <label>Secreto de Integridad (Integrity Secret):</label>
                        <input
                          type="text"
                          value={config.wompi?.integritySecret || ''}
                          onChange={(e) => setConfig({
                            ...config,
                            wompi: { ...config.wompi, integritySecret: e.target.value }
                          })}
                          placeholder="prod_integrity_..."
                        />
                      </div>
                      <div className="form-group">
                        <label>Llave Privada (Private Key):</label>
                        <input
                          type="password"
                          value={config.wompi?.privateKey || ''}
                          onChange={(e) => setConfig({
                            ...config,
                            wompi: { ...config.wompi, privateKey: e.target.value }
                          })}
                          placeholder="prv_prod_..."
                        />
                      </div>
                      <div className="form-group">
                        <label>Secreto de Eventos Webhook (Events Secret):</label>
                        <input
                          type="text"
                          value={config.wompi?.eventsSecret || ''}
                          onChange={(e) => setConfig({
                            ...config,
                            wompi: { ...config.wompi, eventsSecret: e.target.value }
                          })}
                          placeholder="prod_events_..."
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="admin-fields-grid">
                      <div className="form-group">
                        <label>Llave Pública Sandbox (Test Public Key):</label>
                        <input
                          type="text"
                          value={config.wompi?.sandbox?.publicKey || ''}
                          onChange={(e) => setConfig({
                            ...config,
                            wompi: {
                              ...config.wompi,
                              sandbox: { ...config.wompi?.sandbox, publicKey: e.target.value }
                            }
                          })}
                          placeholder="pub_test_..."
                        />
                      </div>
                      <div className="form-group">
                        <label>Secreto de Integridad Sandbox (Test Integrity Secret):</label>
                        <input
                          type="text"
                          value={config.wompi?.sandbox?.integritySecret || ''}
                          onChange={(e) => setConfig({
                            ...config,
                            wompi: {
                              ...config.wompi,
                              sandbox: { ...config.wompi?.sandbox, integritySecret: e.target.value }
                            }
                          })}
                          placeholder="test_integrity_..."
                        />
                      </div>
                      <div className="form-group">
                        <label>Llave Privada Sandbox (Test Private Key):</label>
                        <input
                          type="password"
                          value={config.wompi?.sandbox?.privateKey || ''}
                          onChange={(e) => setConfig({
                            ...config,
                            wompi: {
                              ...config.wompi,
                              sandbox: { ...config.wompi?.sandbox, privateKey: e.target.value }
                            }
                          })}
                          placeholder="prv_test_..."
                        />
                      </div>
                      <div className="form-group">
                        <label>Secreto de Eventos Sandbox (Test Events Secret):</label>
                        <input
                          type="text"
                          value={config.wompi?.sandbox?.eventsSecret || ''}
                          onChange={(e) => setConfig({
                            ...config,
                            wompi: {
                              ...config.wompi,
                              sandbox: { ...config.wompi?.sandbox, eventsSecret: e.target.value }
                            }
                          })}
                          placeholder="test_events_..."
                        />
                      </div>
                    </div>
                  )}

                  {/* Métodos de Pago Activos en Kiosco */}
                  <div className="admin-subcard">
                    <h4>Métodos de Pago Activos en Checkout del Kiosco</h4>
                    <div className="admin-checkboxes-row">
                      <label className="admin-checkbox-label">
                        <input
                          type="checkbox"
                          checked={config.wompi?.methods?.bancolombiaQr !== false}
                          onChange={(e) => setConfig({
                            ...config,
                            wompi: {
                              ...config.wompi,
                              methods: { ...config.wompi?.methods, bancolombiaQr: e.target.checked }
                            }
                          })}
                        />
                        <QrCode size={18} />
                        <span>Código QR Bancolombia / Nequi en Pantalla</span>
                      </label>
                      <label className="admin-checkbox-label">
                        <input
                          type="checkbox"
                          checked={config.wompi?.methods?.cash !== false}
                          onChange={(e) => setConfig({
                            ...config,
                            wompi: {
                              ...config.wompi,
                              methods: { ...config.wompi?.methods, cash: e.target.checked }
                            }
                          })}
                        />
                        <span>💵 Pago en Caja / Efectivo</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SMS HABLAME & RECIBOS */}
              {activeTab === 'sms' && (
                <div className="admin-form-section">
                  <div className="admin-section-header">
                    <div>
                      <h3>Servicio de Envío de SMS (Hablame Colombia)</h3>
                      <p>Envía automáticamente el enlace del recibo digital por SMS al celular del cliente.</p>
                    </div>
                    <button type="button" className="preset-btn prod" onClick={applyHablameCredentials}>
                      <Sparkles size={14} />
                      Cargar Credenciales Hablame
                    </button>
                  </div>

                  <div className="admin-switch-row">
                    <div>
                      <span className="switch-title">Envío de SMS en Kiosco</span>
                      <span className="switch-desc">Si está desactivado, el sistema simula el envío sin consumir saldo.</span>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={!!config.sms?.enabled}
                        onChange={(e) => setConfig({
                          ...config,
                          sms: { ...config.sms, enabled: e.target.checked }
                        })}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="admin-fields-grid">
                    <div className="form-group">
                      <label>Usuario / Email Hablame:</label>
                      <input
                        type="text"
                        value={config.sms?.user || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          sms: { ...config.sms, user: e.target.value }
                        })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Account ID:</label>
                      <input
                        type="text"
                        value={config.sms?.accountId || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          sms: { ...config.sms, accountId: e.target.value }
                        })}
                      />
                    </div>
                    <div className="form-group">
                      <label>API Key:</label>
                      <input
                        type="text"
                        value={config.sms?.apiKey || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          sms: { ...config.sms, apiKey: e.target.value }
                        })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Token de Autenticación:</label>
                      <input
                        type="password"
                        value={config.sms?.token || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          sms: { ...config.sms, token: e.target.value }
                        })}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label>Plantilla del Mensaje de Texto (SMS):</label>
                    <input
                      type="text"
                      value={config.sms?.template || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        sms: { ...config.sms, template: e.target.value }
                      })}
                      placeholder="Gracias por tu compra en {restaurant}. Tu recibo digital: {url}"
                    />
                    <small className="help-text">Variables disponibles: <code>{'{restaurant}'}</code>, <code>{'{url}'}</code></small>
                  </div>
                </div>
              )}

              {/* TAB 3: DATOS FISCALES & DIAN */}
              {activeTab === 'restaurant' && (
                <div className="admin-form-section">
                  <div className="admin-section-header">
                    <div>
                      <h3>Datos del Restaurante y Facturación Digital</h3>
                      <p>Esta información se imprime en el encabezado y pie del Recibo Digital web.</p>
                    </div>
                  </div>

                  <div className="admin-fields-grid">
                    <div className="form-group">
                      <label>Nombre Comercial:</label>
                      <input
                        type="text"
                        value={config.restaurant?.name || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          restaurant: { ...config.restaurant, name: e.target.value }
                        })}
                        placeholder="Ej: Kebab & Shawarma"
                      />
                    </div>
                    <div className="form-group">
                      <label>Razón Social (Legal):</label>
                      <input
                        type="text"
                        value={config.restaurant?.legalName || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          restaurant: { ...config.restaurant, legalName: e.target.value }
                        })}
                        placeholder="Ej: Serviplus SAS"
                      />
                    </div>
                    <div className="form-group">
                      <label>NIT / Identificación Tributaria:</label>
                      <input
                        type="text"
                        value={config.restaurant?.nit || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          restaurant: { ...config.restaurant, nit: e.target.value }
                        })}
                        placeholder="Ej: 900.123.456-7"
                      />
                    </div>
                    <div className="form-group">
                      <label>Teléfono de Contacto:</label>
                      <input
                        type="text"
                        value={config.restaurant?.phone || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          restaurant: { ...config.restaurant, phone: e.target.value }
                        })}
                        placeholder="+57 (300) 123-4567"
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>Dirección del Establecimiento:</label>
                      <input
                        type="text"
                        value={config.restaurant?.address || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          restaurant: { ...config.restaurant, address: e.target.value }
                        })}
                        placeholder="Cra. 7 #45-12, Cartagena, Colombia"
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>Texto de Resolución DIAN (Factura POS):</label>
                      <input
                        type="text"
                        value={config.restaurant?.dianResolution || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          restaurant: { ...config.restaurant, dianResolution: e.target.value }
                        })}
                        placeholder="Resolución DIAN No. 18764000001 del 2024..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: KIOSCO & PANTALLA */}
              {activeTab === 'kiosk' && (
                <div className="admin-form-section">
                  <div className="admin-section-header">
                    <div>
                      <h3>Configuración de Operación del Kiosco</h3>
                      <p>Comportamiento de tiempo de espera y flujo de autoservicio.</p>
                    </div>
                  </div>

                  <div className="admin-fields-grid">
                    <div className="form-group">
                      <label>Segundos de inactividad para reiniciar carrito:</label>
                      <input
                        type="number"
                        min="15"
                        max="300"
                        value={config.kiosk?.autoReturnSeconds || 30}
                        onChange={(e) => setConfig({
                          ...config,
                          kiosk: { ...config.kiosk, autoReturnSeconds: parseInt(e.target.value, 10) || 30 }
                        })}
                      />
                      <small className="help-text">Tiempo antes de regresar a la pantalla de bienvenida si no hay interacción.</small>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer con Acciones */}
        <div className="admin-settings-footer">
          <button type="button" className="admin-cancel-btn" onClick={onClose} disabled={saving}>
            Cerrar
          </button>
          <button type="button" className="admin-save-btn" onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <RefreshCw className="spin" size={18} />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save size={18} />
                <span>Guardar Cambios</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
