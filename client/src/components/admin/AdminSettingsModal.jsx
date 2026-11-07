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
            <div className="ui-icon-box-xl ui-icon-box-gold">
              <Settings size={22} />
            </div>
            <div>
              <h2>Panel de Administración • Serviplus</h2>
              <div className="ui-pill ui-pill-xs ui-pill-neutral">
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

                  <div className="form-group asmod-s-1">
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
                      className="asmod-s-2"
                    >
                      <RefreshCw size={14} className={loadingStock ? 'spin' : ''} />
                      <span>Refrescar</span>
                    </button>
                  </div>

                  <div className="asmod-s-3">
                    <input
                      type="text"
                      placeholder="Buscar plato por nombre o categoría..."
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                      className="asmod-s-4"
                    />
                  </div>

                  {loadingStock ? (
                    <div className="asmod-s-5">
                      <RefreshCw size={24} className="spin asmod-s-6" />
                      <span>Cargando productos de Aldelo...</span>
                    </div>
                  ) : (
                    <div className="asmod-s-7">
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
                              className={`asmod-stock-card ${prod.isActive ? 'active' : 'inactive'}`}
                            >
                              <div>
                                <div className="asmod-s-8">
                                  <span>{prod.categoryName}</span>
                                  <span className={`asmod-stock-price ${prod.isActive ? 'active' : 'inactive'}`}>
                                    {formatCOP(prod.price)}
                                  </span>
                                </div>
                                <h4 className={`asmod-stock-title ${prod.isActive ? 'active' : 'inactive'}`}>
                                  {prod.name}
                                </h4>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleToggleStock(prod)}
                                disabled={isToggling}
                                className={`asmod-stock-toggle-btn ${prod.isActive ? 'active' : 'inactive'}`}
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
                    <div className="asmod-s-9">
                      <button
                        type="button"
                        onClick={handleTestPrint}
                        disabled={testingPrinter}
                        className="preset-btn prod asmod-s-10"
                      >
                        {testingPrinter ? <RefreshCw className="spin" size={16} /> : <Printer size={16} />}
                        <span>{testingPrinter ? 'Imprimiendo...' : 'Imprimir Ticket de Prueba'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenDrawer}
                        disabled={openingDrawer}
                        className="preset-btn test asmod-s-10"
                      >
                        {openingDrawer ? <RefreshCw className="spin" size={16} /> : <span>🔓</span>}
                        <span>{openingDrawer ? 'Abriendo...' : 'Probar Cajón Monedero'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Estado del Dispositivo */}
                  <div className="admin-mode-card asmod-s-11">
                    <div className="asmod-s-12">
                      <div
                        className={`asmod-printer-icon-box ${installedPrinters.some(p => p.toLowerCase() === (config.printer?.printerName || 'POS-58').toLowerCase()) ? 'detected' : 'missing'}`}
                      >
                        <Printer size={22} />
                      </div>
                      <div>
                        <div className="asmod-s-13">
                          Impresora Activa: <span className="asmod-s-14">{config.printer?.printerName || 'POS-58'}</span>
                        </div>
                        <div className="asmod-s-15">
                          <span
                            className={`ui-dot lg ${installedPrinters.some(p => p.toLowerCase() === (config.printer?.printerName || 'POS-58').toLowerCase()) ? 'online' : 'amber'}`}
                          />
                          {installedPrinters.some(p => p.toLowerCase() === (config.printer?.printerName || 'POS-58').toLowerCase())
                            ? 'Detectada en el sistema (Spooler de Windows Listo)'
                            : 'Buscando impresora instalada o en cola...'}
                        </div>
                      </div>
                    </div>

                    <div className="asmod-s-16">
                      <button
                        type="button"
                        onClick={loadPrinters}
                        disabled={loadingPrinters}
                        className="preset-btn test asmod-s-17"
                      >
                        <RefreshCw className={loadingPrinters ? 'spin' : ''} size={14} />
                        <span>Actualizar Lista</span>
                      </button>
                    </div>
                  </div>

                  {/* Campos de Configuración */}
                  <div className="admin-fields-grid">
                    {/* Habilitar Impresión */}
                    <div className="form-group full-width asmod-s-18">
                      <div>
                        <label className="asmod-s-19">Habilitar Módulo de Impresión Térmica:</label>
                        <p className="asmod-s-20">Permite enviar tickets físicos a las impresoras térmicas conectadas.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.printer?.enabled !== false}
                        onChange={(e) => setConfig({
                          ...config,
                          printer: { ...(config.printer || {}), enabled: e.target.checked }
                        })}
                        className="asmod-s-21"
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
                        className="asmod-s-22"
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
                        className="asmod-s-22"
                      >
                        <option value="58">58 mm (Estándar POS-58 / 32 Columnas)</option>
                        <option value="80">80 mm (Estándar POS-80 / 48 Columnas)</option>
                      </select>
                    </div>

                    {/* Reglas de Impresión Automática */}
                    <div className="form-group asmod-s-23">
                      <div>
                        <label className="asmod-s-24">Impresión Automática en Kiosco / Caja:</label>
                        <span className="asmod-s-25">Imprime el ticket inmediatamente al confirmar la orden</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.printer?.autoPrintOrder !== false}
                        onChange={(e) => setConfig({
                          ...config,
                          printer: { ...(config.printer || {}), autoPrintOrder: e.target.checked }
                        })}
                        className="asmod-s-26"
                      />
                    </div>

                    <div className="form-group asmod-s-23">
                      <div>
                        <label className="asmod-s-24">Comanda para Cocina (Kitchen):</label>
                        <span className="asmod-s-25">Imprime comanda con modificadores para preparación</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(config.printer?.autoPrintKitchen)}
                        onChange={(e) => setConfig({
                          ...config,
                          printer: { ...(config.printer || {}), autoPrintKitchen: e.target.checked }
                        })}
                        className="asmod-s-26"
                      />
                    </div>

                    <div className="form-group asmod-s-23">
                      <div>
                        <label className="asmod-s-24">Código QR de Recibo Digital:</label>
                        <span className="asmod-s-25">Imprime QR nativo para ver la factura en el móvil</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.printer?.printDigitalReceiptQr !== false}
                        onChange={(e) => setConfig({
                          ...config,
                          printer: { ...(config.printer || {}), printDigitalReceiptQr: e.target.checked }
                        })}
                        className="asmod-s-26"
                      />
                    </div>

                    <div className="form-group asmod-s-23">
                      <div>
                        <label className="asmod-s-24">Abrir Cajón en Efectivo:</label>
                        <span className="asmod-s-25">Envía pulso a la gaveta conectada por RJ11</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(config.printer?.openCashDrawer)}
                        onChange={(e) => setConfig({
                          ...config,
                          printer: { ...(config.printer || {}), openCashDrawer: e.target.checked }
                        })}
                        className="asmod-s-26"
                      />
                    </div>

                    <div className="form-group asmod-s-23">
                      <div>
                        <label className="asmod-s-24">Corte Automático (Auto-Cut):</label>
                        <span className="asmod-s-25">Ejecuta comando GS V al terminar de imprimir</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.printer?.cutPaper !== false}
                        onChange={(e) => setConfig({
                          ...config,
                          printer: { ...(config.printer || {}), cutPaper: e.target.checked }
                        })}
                        className="asmod-s-26"
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
                        className="asmod-s-22"
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

