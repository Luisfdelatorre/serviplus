import React, { useState, useEffect } from 'react';
import {
  getAdminConfig,
  saveAdminConfig,
  fetchAdminProducts,
  toggleProductActive,
  fetchPrinterList,
  printTestTicket,
  openCashDrawer
} from '../../api';
import { sfx } from '../../utils/audio';
import { formatCOP } from '../../utils/format';
import { KIOSK_CONFIG, updateKioskConfig } from '../../config/kioskConfig';
import {
  Settings,
  CreditCard,
  MessageSquare,
  Building2,
  Tv,
  Printer,
  Check,
  Save,
  X,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  QrCode,
  Package,
  CheckCircle2,
  XCircle,
  Search
} from 'lucide-react';

export function AdminSettingsModal({ isOpen, onClose, currentAdmin }) {
  const [activeTab, setActiveTab] = useState('wompi');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Estados para pestaña de Agotados (86'd)
  const [stockProducts, setStockProducts] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const [togglingStockId, setTogglingStockId] = useState(null);

  // Estados para pestaña de Impresora Térmica
  const [installedPrinters, setInstalledPrinters] = useState([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState(false);
  const [openingDrawer, setOpeningDrawer] = useState(false);

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
      if (data) updateKioskConfig(data);
    } catch (err) {
      console.error('Error loading config:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPrinters = async () => {
    try {
      setLoadingPrinters(true);
      const list = await fetchPrinterList();
      setInstalledPrinters(list || []);
    } catch (err) {
      console.warn('Error loading printers:', err);
    } finally {
      setLoadingPrinters(false);
    }
  };

  const handleTestPrint = async () => {
    sfx.playTap();
    setTestingPrinter(true);
    try {
      const pName = config?.printer?.printerName || 'POS-58';
      await printTestTicket(pName);
      showToast(`🖨️ Ticket de prueba enviado a "${pName}"`);
    } catch (err) {
      console.error('Error al imprimir prueba:', err);
      alert('Error de impresión: ' + err.message);
    } finally {
      setTestingPrinter(false);
    }
  };

  const handleOpenDrawer = async () => {
    sfx.playTap();
    setOpeningDrawer(true);
    try {
      const pName = config?.printer?.printerName || 'POS-58';
      await openCashDrawer(pName);
      showToast('🔓 Pulso de apertura enviado al cajón monedero');
    } catch (err) {
      console.error('Error abriendo cajón:', err);
      alert('Error al abrir cajón: ' + err.message);
    } finally {
      setOpeningDrawer(false);
    }
  };

  const loadStockProducts = async () => {
    try {
      setLoadingStock(true);
      const data = await fetchAdminProducts();
      setStockProducts(data || []);
    } catch (err) {
      console.error('Error cargando stock:', err);
    } finally {
      setLoadingStock(false);
    }
  };

  const handleToggleStock = async (prod) => {
    const nextState = !prod.isActive;
    setTogglingStockId(prod.id);
    sfx.playTap();
    try {
      await toggleProductActive(prod.id, nextState);
      setStockProducts((prev) =>
        prev.map((p) => (p.id === prod.id ? { ...p, isActive: nextState } : p))
      );
      showToast(nextState ? `🟢 "${prod.name}" marcado como DISPONIBLE` : `🔴 "${prod.name}" marcado como AGOTADO`);
    } catch (err) {
      console.error('Error actualizando stock:', err);
      alert('Error: ' + err.message);
    } finally {
      setTogglingStockId(null);
    }
  };

  if (!isOpen) return null;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), KIOSK_CONFIG.timeouts.toastTimeoutMs);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      sfx.playTap();
      await saveAdminConfig(config);
      updateKioskConfig(config);
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
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'stock' ? 'active' : ''}`}
            onClick={() => { sfx.playTap(); setActiveTab('stock'); loadStockProducts(); }}
          >
            <Package size={18} />
            <span>Disponibilidad (86'd)</span>
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'printer' ? 'active' : ''}`}
            onClick={() => { sfx.playTap(); setActiveTab('printer'); loadPrinters(); }}
          >
            <Printer size={18} />
            <span>Impresora Térmica POS</span>
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
                        value={config.kiosk?.idleTimeoutSeconds || config.kiosk?.autoReturnSeconds || 90}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 90;
                          setConfig({
                            ...config,
                            kiosk: { ...config.kiosk, idleTimeoutSeconds: val, autoReturnSeconds: val }
                          });
                        }}
                      />
                      <small className="help-text">Tiempo de inactividad antes de regresar a la pantalla de bienvenida (por defecto 90s).</small>
                    </div>

                    <div className="form-group">
                      <label>Segundos en pantalla de confirmación (Paso 5):</label>
                      <input
                        type="number"
                        min="5"
                        max="180"
                        value={config.kiosk?.orderSuccessAutoCloseSeconds || 20}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 20;
                          setConfig({
                            ...config,
                            kiosk: { ...config.kiosk, orderSuccessAutoCloseSeconds: val }
                          });
                        }}
                      />
                      <small className="help-text">Cuenta regresiva antes de cerrar automáticamente tras pago exitoso (por defecto 20s).</small>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: DISPONIBILIDAD Y AGOTADOS (86'd) */}
              {activeTab === 'stock' && (
                <div className="admin-form-section">
                  <div className="admin-section-header">
                    <div>
                      <h3>Control de Platos Agotados (Stock 86'd)</h3>
                      <p>Desactiva platos temporalmente cuando se agoten los ingredientes. Se actualiza en vivo en el Kiosco y en Aldelo.</p>
                    </div>
                    <button
                      type="button"
                      onClick={loadStockProducts}
                      disabled={loadingStock}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        background: '#334155',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#f8fafc',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      <RefreshCw size={14} className={loadingStock ? 'spin' : ''} />
                      <span>Refrescar</span>
                    </button>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <input
                      type="text"
                      placeholder="Buscar plato por nombre o categoría..."
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>

                  {loadingStock ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                      <span>Cargando productos de Aldelo...</span>
                    </div>
                  ) : (
                    <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                      {stockProducts
                        .filter((p) => {
                          const q = stockSearch.toLowerCase().trim();
                          return !q || p.name.toLowerCase().includes(q) || (p.categoryName && p.categoryName.toLowerCase().includes(q));
                        })
                        .map((prod) => {
                          const isToggling = togglingStockId === prod.id;
                          return (
                            <div
                              key={prod.id}
                              style={{
                                background: prod.isActive ? '#1e293b' : '#3f1a1a',
                                border: prod.isActive ? '1px solid #334155' : '1px solid #ef4444',
                                borderRadius: '8px',
                                padding: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                gap: '8px'
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                                  <span>{prod.categoryName}</span>
                                  <span style={{ fontWeight: 600, color: prod.isActive ? '#38bdf8' : '#94a3b8' }}>
                                    {formatCOP(prod.price)}
                                  </span>
                                </div>
                                <h4 style={{ margin: '4px 0 0 0', fontSize: '0.95rem', color: prod.isActive ? '#f8fafc' : '#fca5a5' }}>
                                  {prod.name}
                                </h4>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleToggleStock(prod)}
                                disabled={isToggling}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  fontWeight: 600,
                                  fontSize: '0.8rem',
                                  background: prod.isActive ? '#065f46' : '#991b1b',
                                  color: '#fff'
                                }}
                              >
                                {prod.isActive ? (
                                  <>
                                    <CheckCircle2 size={14} />
                                    <span>Disponible</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle size={14} />
                                    <span>Agotado</span>
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: IMPRESORA TÉRMICA POS */}
              {activeTab === 'printer' && (
                <div className="admin-form-section">
                  <div className="admin-section-header">
                    <div>
                      <h3>Impresora Térmica ESC/POS (Tickets & Comandas)</h3>
                      <p>Configuración directa de tickets en impresoras de 58mm / 80mm y cajón monedero.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleTestPrint}
                        disabled={testingPrinter}
                        className="preset-btn prod"
                        style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {testingPrinter ? <RefreshCw className="spin" size={16} /> : <Printer size={16} />}
                        <span>{testingPrinter ? 'Imprimiendo...' : 'Imprimir Ticket de Prueba'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenDrawer}
                        disabled={openingDrawer}
                        className="preset-btn test"
                        style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {openingDrawer ? <RefreshCw className="spin" size={16} /> : <span>🔓</span>}
                        <span>{openingDrawer ? 'Abriendo...' : 'Probar Cajón Monedero'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Estado del Dispositivo */}
                  <div className="admin-mode-card" style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '12px',
                          background: installedPrinters.some(p => p.toLowerCase() === (config.printer?.printerName || 'POS-58').toLowerCase()) ? '#ecfdf5' : '#fef2f2',
                          color: installedPrinters.some(p => p.toLowerCase() === (config.printer?.printerName || 'POS-58').toLowerCase()) ? '#059669' : '#dc2626',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Printer size={22} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                          Impresora Activa: <span style={{ color: '#da291c' }}>{config.printer?.printerName || 'POS-58'}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: installedPrinters.some(p => p.toLowerCase() === (config.printer?.printerName || 'POS-58').toLowerCase()) ? '#10b981' : '#f59e0b',
                              display: 'inline-block'
                            }}
                          />
                          {installedPrinters.some(p => p.toLowerCase() === (config.printer?.printerName || 'POS-58').toLowerCase())
                            ? 'Detectada en el sistema (Spooler de Windows Listo)'
                            : 'Buscando impresora instalada o en cola...'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={loadPrinters}
                        disabled={loadingPrinters}
                        className="preset-btn test"
                        style={{ padding: '6px 12px' }}
                      >
                        <RefreshCw className={loadingPrinters ? 'spin' : ''} size={14} />
                        <span>Actualizar Lista</span>
                      </button>
                    </div>
                  </div>

                  {/* Campos de Configuración */}
                  <div className="admin-fields-grid">
                    {/* Habilitar Impresión */}
                    <div className="form-group full-width" style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <label style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>Habilitar Módulo de Impresión Térmica:</label>
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>Permite enviar tickets físicos a las impresoras térmicas conectadas.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.printer?.enabled !== false}
                        onChange={(e) => setConfig({
                          ...config,
                          printer: { ...(config.printer || {}), enabled: e.target.checked }
                        })}
                        style={{ width: '22px', height: '22px', cursor: 'pointer' }}
                      />
                    </div>

                    {/* Selector de Impresora */}
                    <div className="form-group">
                      <label>Seleccionar Impresora en Windows:</label>
                      <select
                        value={config.printer?.printerName || 'POS-58'}
                        onChange={(e) => setConfig({
                          ...config,
                          printer: { ...(config.printer || {}), printerName: e.target.value }
                        })}
                        style={{ padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 600, width: '100%', background: '#fff' }}
                      >
                        {installedPrinters.length > 0 ? (
                          installedPrinters.map((prn) => (
                            <option key={prn} value={prn}>
                              {prn} {prn.toLowerCase().includes('pos') || prn.toLowerCase().includes('58') ? '⭐ (Térmica POS)' : ''}
                            </option>
                          ))
                        ) : (
                          <option value="POS-58">POS-58 (Predeterminada)</option>
                        )}
                      </select>
                    </div>

                    {/* Ancho del Papel */}
                    <div className="form-group">
                      <label>Ancho de Papel del Rollo:</label>
                      <select
                        value={config.printer?.paperWidth || 58}
                        onChange={(e) => setConfig({
                          ...config,
                          printer: { ...(config.printer || {}), paperWidth: parseInt(e.target.value, 10) }
                        })}
                        style={{ padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 600, width: '100%', background: '#fff' }}
                      >
                        <option value="58">58 mm (Estándar POS-58 / 32 Columnas)</option>
                        <option value="80">80 mm (Estándar POS-80 / 48 Columnas)</option>
                      </select>
                    </div>

                    {/* Reglas de Impresión Automática */}
                    <div className="form-group" style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <label style={{ margin: 0, fontSize: '0.86rem', fontWeight: 700 }}>Impresión Automática en Kiosco / Caja:</label>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Imprime el ticket inmediatamente al confirmar la orden</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.printer?.autoPrintOrder !== false}
                        onChange={(e) => setConfig({
                          ...config,
                          printer: { ...(config.printer || {}), autoPrintOrder: e.target.checked }
                        })}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    </div>

                    <div className="form-group" style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <label style={{ margin: 0, fontSize: '0.86rem', fontWeight: 700 }}>Comanda para Cocina (Kitchen):</label>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Imprime comanda con modificadores para preparación</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(config.printer?.autoPrintKitchen)}
                        onChange={(e) => setConfig({
                          ...config,
                          printer: { ...(config.printer || {}), autoPrintKitchen: e.target.checked }
                        })}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    </div>

                    <div className="form-group" style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <label style={{ margin: 0, fontSize: '0.86rem', fontWeight: 700 }}>Código QR de Recibo Digital:</label>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Imprime QR nativo para ver la factura en el móvil</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.printer?.printDigitalReceiptQr !== false}
                        onChange={(e) => setConfig({
                          ...config,
                          printer: { ...(config.printer || {}), printDigitalReceiptQr: e.target.checked }
                        })}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    </div>

                    <div className="form-group" style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <label style={{ margin: 0, fontSize: '0.86rem', fontWeight: 700 }}>Abrir Cajón en Efectivo:</label>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Envía pulso a la gaveta conectada por RJ11</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(config.printer?.openCashDrawer)}
                        onChange={(e) => setConfig({
                          ...config,
                          printer: { ...(config.printer || {}), openCashDrawer: e.target.checked }
                        })}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    </div>

                    <div className="form-group" style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <label style={{ margin: 0, fontSize: '0.86rem', fontWeight: 700 }}>Corte Automático (Auto-Cut):</label>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Ejecuta comando GS V al terminar de imprimir</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.printer?.cutPaper !== false}
                        onChange={(e) => setConfig({
                          ...config,
                          printer: { ...(config.printer || {}), cutPaper: e.target.checked }
                        })}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    </div>

                    <div className="form-group">
                      <label>Número de Copias de Recibo:</label>
                      <select
                        value={config.printer?.copies || 1}
                        onChange={(e) => setConfig({
                          ...config,
                          printer: { ...(config.printer || {}), copies: parseInt(e.target.value, 10) }
                        })}
                        style={{ padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 600, width: '100%', background: '#fff' }}
                      >
                        <option value="1">1 Copia (Cliente)</option>
                        <option value="2">2 Copias (Cliente + Comercio)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Líneas de avance antes del corte:</label>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        value={config.printer?.feedLines || 3}
                        onChange={(e) => setConfig({
                          ...config,
                          printer: { ...(config.printer || {}), feedLines: parseInt(e.target.value, 10) || 3 }
                        })}
                      />
                    </div>

                    <div className="form-group full-width">
                      <label>Mensaje de Despedida / Pie de Ticket:</label>
                      <input
                        type="text"
                        value={config.printer?.customFooter || '¡Gracias por su compra!'}
                        onChange={(e) => setConfig({
                          ...config,
                          printer: { ...(config.printer || {}), customFooter: e.target.value }
                        })}
                        placeholder="¡Gracias por su compra! Vuelva pronto..."
                      />
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

