import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMenuStore } from '../../store/useMenuStore';
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
  Search,
  Copy,
  Eye,
  EyeOff,
  Clock,
  Moon,
  DollarSign,
  Calendar,
  MessageSquare,
  HelpCircle,
  FileText,
  Sliders,
  ChevronLeft
} from 'lucide-react';
import { UpayLogo } from '../common/UpayLogo';
import './AdminSettingsView.css';

export function AdminSettingsView() {
  const navigate = useNavigate();
  const currentAdmin = useMenuStore((state) => state.currentAdmin);
  const sessionEmployee = useMenuStore((state) => state.sessionEmployee);

  // Pestaña activa dentro del panel de administración
  const [activeNavTab, setActiveNavTab] = useState('wompi');

  // Configuración del sistema
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  // Estados para pestaña de Agotados (86'd)
  const [stockProducts, setStockProducts] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const [togglingStockId, setTogglingStockId] = useState(null);

  // Estados para pestaña de Impresora Térmica
  const [installedPrinters, setInstalledPrinters] = useState([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState(false);
  const [testingKitchenPrinter, setTestingKitchenPrinter] = useState(false);
  const [openingDrawer, setOpeningDrawer] = useState(false);

  // Cargar configuración al montar la vista inmersiva
  useEffect(() => {
    loadConfig();
    loadPrinters();
  }, []);

  // Cargar stock si se cambia a la pestaña de sistema
  useEffect(() => {
    if (activeNavTab === 'system' && stockProducts.length === 0) {
      loadStockProducts();
    }
  }, [activeNavTab]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await getAdminConfig();
      // Garantizar que las ramas de configuración existan
      const populated = {
        wompi: {
          mode: 'sandbox',
          currency: 'COP',
          publicKey: '',
          privateKey: '',
          integritySecret: '',
          eventsSecret: '',
          sandbox: {
            publicKey: 'pub_test_82Z9KlLHoXDCfQ8nDCKW3hALwt23Lh62',
            privateKey: 'prv_test_1U9ImRNhUMsrHKsqQNe1GstIxGDbUPDy',
            integritySecret: 'test_integrity_rXGbWc5E5guVUx68RASrPxWNRfrYaEq3',
            eventsSecret: 'test_events_l5HJ6w0153hiCJeeBZgs77hlNgBNr2WI'
          },
          methods: { bancolombiaQr: true, wompiLink: true, cash: true }
        },
        sms: {
          provider: 'hablame',
          enabled: true,
          user: 'luis.delatorre0277@gmail.com',
          accountId: '10016115',
          apiKey: 'W7H4gqhGG1Euca6CokXO12lM2I8y2k',
          token: '63d7a2c2ff294943cabc51d87bb93ac4',
          apiUrl: 'https://api103.hablame.co/api/sms/v3/send/priority',
          template: 'Gracias por tu compra en {restaurant}. Tu recibo digital: {url}'
        },
        restaurant: {
          name: 'KEBAB & SHAWARMA',
          legalName: 'UPAYSOLUTIONS S.A.S.',
          nit: '901.234.567-8',
          address: 'Calle 72 # 45-12, Bogotá',
          phone: '+57 301 880 0358',
          dianResolution: 'Resolución DIAN No. 18764000001 del 2024',
          receiptFooter: '¡Gracias por tu compra! UPAYSOLUTIONS S.A.S.'
        },
        kiosk: {
          idleTimeoutSeconds: 900,
          idleWarningSeconds: 15,
          orderSuccessAutoCloseSeconds: 320,
          autoReturnSeconds: 900
        },
        whatsapp: {
          enabled: true,
          phoneNumberId: '1457428644110872',
          accessToken: '',
          apiVersion: 'v25.0'
        },
        printer: {
          enabled: true,
          printerName: 'POS-58',
          kitchenPrinterName: 'POS-58',
          barPrinterName: '',
          paperWidth: 58,
          kitchenPaperWidth: 58,
          autoPrintOrder: true,
          autoPrintKitchen: false,
          autoPrintCashShift: true,
          printCustomerReceipt: true,
          printKitchenComanda: true,
          printDigitalReceiptQr: true,
          openCashDrawer: false,
          copies: 1,
          feedLines: 3,
          cutPaper: true,
          ...(data?.printer || {})
        },
        ...(data || {})
      };
      setConfig(populated);
      if (data) updateKioskConfig(data);
    } catch (err) {
      console.error('Error cargando configuración:', err);
      showToast('Error cargando configuración del servidor');
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
    try { sfx.playTap(); } catch (_) {}
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

  const handleSave = async () => {
    try {
      setSaving(true);
      try { sfx.playTap(); } catch (_) {}
      await saveAdminConfig(config);
      updateKioskConfig(config);
      try { sfx.playSuccess(); } catch (_) {}
      showToast('¡Configuración guardada y aplicada con éxito!');
    } catch (err) {
      try { sfx.playBeep(); } catch (_) {}
      alert('Error al guardar configuración: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = async () => {
    try { sfx.playTap(); } catch (_) {}
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

  const handleTestKitchenPrint = async () => {
    try { sfx.playTap(); } catch (_) {}
    setTestingKitchenPrinter(true);
    try {
      const pName = config?.printer?.kitchenPrinterName || config?.printer?.printerName || 'POS-58';
      await printTestTicket(pName);
      showToast(`👨‍🍳 Comanda de prueba enviada a Cocina: "${pName}"`);
    } catch (err) {
      console.error('Error al imprimir prueba cocina:', err);
      alert('Error de impresión en cocina: ' + err.message);
    } finally {
      setTestingKitchenPrinter(false);
    }
  };

  const handleOpenDrawer = async () => {
    try { sfx.playTap(); } catch (_) {}
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

  const copyToClipboard = (text, label) => {
    if (!text) return;
    try { sfx.playTap(); } catch (_) {}
    navigator.clipboard.writeText(text);
    showToast(`Copiado: ${label}`);
  };

  // Presets rápidos
  const applyPocketbikeProdKeys = () => {
    try { sfx.playTap(); } catch (_) {}
    setConfig((prev) => ({
      ...prev,
      wompi: {
        ...prev?.wompi,
        mode: 'production',
        publicKey: 'pub_prod_MP2rh77NUHv1kyIAZ0YCUb6rDFPQeRLy',
        privateKey: 'prv_prod_y6XWiFrPIyOJSwRxtSOqjvuvdpqnk2FY',
        integritySecret: 'prod_integrity_hPr2Bn631ee2jFpthJDLsLyZeDe3SMlk',
        eventsSecret: 'prod_events_J8NGcB6ZoY5yfvf5LsZF63GEgdf7ifYJ'
      }
    }));
    showToast('Credenciales de producción Pocketbike cargadas');
  };

  const applyPocketbikeSandboxKeys = () => {
    try { sfx.playTap(); } catch (_) {}
    setConfig((prev) => ({
      ...prev,
      wompi: {
        ...prev?.wompi,
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
    try { sfx.playTap(); } catch (_) {}
    setConfig((prev) => ({
      ...prev,
      sms: {
        ...prev?.sms,
        enabled: true,
        user: 'luis.delatorre0277@gmail.com',
        accountId: '10016115',
        apiKey: 'W7H4gqhGG1Euca6CokXO12lM2I8y2k',
        token: '63d7a2c2ff294943cabc51d87bb93ac4',
        apiUrl: 'https://api103.hablame.co/api/sms/v3/send/priority',
        template: 'Gracias por tu compra en {restaurant}. Tu recibo digital: {url}'
      }
    }));
    showToast('Credenciales de SMS Háblame cargadas');
  };

  const isSandbox = config?.wompi?.mode !== 'production';
  const wompiKeys = isSandbox ? (config?.wompi?.sandbox || {}) : (config?.wompi || {});

  const handleWompiKeyChange = (field, val) => {
    setConfig((prev) => {
      const mode = prev?.wompi?.mode || 'sandbox';
      if (mode === 'production') {
        return {
          ...prev,
          wompi: {
            ...prev.wompi,
            [field]: val
          }
        };
      } else {
        return {
          ...prev,
          wompi: {
            ...prev.wompi,
            sandbox: {
              ...(prev.wompi?.sandbox || {}),
              [field]: val
            }
          }
        };
      }
    });
  };

  const handleReturnHome = () => {
    try { sfx.playTap(); } catch (_) {}
    navigate('/');
  };

  // Filtrado de stock
  const filteredStock = stockProducts.filter((p) =>
    (p.name || '').toLowerCase().includes(stockSearch.toLowerCase()) ||
    (p.categoryName || '').toLowerCase().includes(stockSearch.toLowerCase())
  );
  const outOfStockCount = stockProducts.filter((p) => !p.isActive).length;

  return (
    <div className="asv-viewport">
      {/* ==========================================================
          HEADER SUPERIOR INMERSIVO
          ========================================================== */}
      <header className="asv-header" data-purpose="header-section">
        <div className="asv-brand-group">
          {/* Logo UPAYSOLUTIONS S.A.S. */}
          <div className="asv-brand-icon">
            <UpayLogo size={32} className="asv-brand-svg" />
          </div>
          <div>
            <div className="asv-title-row">
              <h1 className="asv-main-title">Panel de Administración • Serviplus</h1>
              <span className="ui-pill ui-pill-xs ui-pill-emerald ui-pill-upper">v2.4 Pro</span>
            </div>
            <div className="asv-meta-row">
              <span className="asv-emp-indicator">
                <svg className="asview-s-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                </svg>
                {currentAdmin?.name || sessionEmployee?.name || 'Angelica N.'} <span className="asview-s-3">(Nivel Aldelo: {currentAdmin?.securityLevel || 2})</span>
              </span>
              <span className="asv-dot-sep">•</span>
              <span className="asv-company-tag">UPAYSOLUTIONS S.A.S.</span>
            </div>
          </div>
        </div>

        {/* Botón de Regreso al Hub */}
        <button
          className="asv-close-btn"
          type="button"
          onClick={handleReturnHome}
          title="Regresar a la pantalla principal"
        >
          <ChevronLeft size={16} />
          <span>Volver al Menú</span>
        </button>
      </header>

      {/* TOAST DE NOTIFICACIÓN */}
      {toastMessage && (
        <div className="asv-toast-bar">
          <Check size={18} color="#10b981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ==========================================================
          BARRA DE NAVEGACIÓN DE PESTAÑAS
          ========================================================== */}
      <nav className="asv-tabs-nav" data-purpose="tab-navigation">
        <div className="asv-tabs-track">
          {/* Pestaña: Pasarela Wompi */}
          <button
            className={`asv-tab-btn ${activeNavTab === 'wompi' ? 'active' : ''}`}
            onClick={() => { try { sfx.playTap(); } catch (_) {} setActiveNavTab('wompi'); }}
            type="button"
          >
            <CreditCard size={16} />
            <span>Pasarela Wompi (Bancolombia QR)</span>
            <span className="ui-dot ui-dot-pulse lg"></span>
          </button>

          {/* Pestaña: Operación Kiosco & POS */}
          <button
            className={`asv-tab-btn ${activeNavTab === 'kiosk' ? 'active' : ''}`}
            onClick={() => { try { sfx.playTap(); } catch (_) {} setActiveNavTab('kiosk'); }}
            type="button"
          >
            <Tv size={16} />
            <span>Operación Kiosco & POS</span>
          </button>

          {/* Pestaña: SMS & WhatsApp */}
          <button
            className={`asv-tab-btn ${activeNavTab === 'sms' ? 'active' : ''}`}
            onClick={() => { try { sfx.playTap(); } catch (_) {} setActiveNavTab('sms'); }}
            type="button"
          >
            <MessageSquare size={16} />
            <span>SMS Háblame & WhatsApp</span>
          </button>

          {/* Pestaña: Datos Fiscales DIAN */}
          <button
            className={`asv-tab-btn ${activeNavTab === 'dian' ? 'active' : ''}`}
            onClick={() => { try { sfx.playTap(); } catch (_) {} setActiveNavTab('dian'); }}
            type="button"
          >
            <Building2 size={16} />
            <span>Datos Fiscales & DIAN</span>
          </button>

          {/* Pestaña: Sistema, Hardware & Stock */}
          <button
            className={`asv-tab-btn ${activeNavTab === 'system' ? 'active' : ''}`}
            onClick={() => { try { sfx.playTap(); } catch (_) {} setActiveNavTab('system'); }}
            type="button"
          >
            <Sliders size={16} />
            <span>Sistema, Hardware & Stock</span>
            {outOfStockCount > 0 && (
              <span className="asview-s-4">
                {outOfStockCount} 86'd
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* ==========================================================
          CUERPO PRINCIPAL CON SCROLL
          ========================================================== */}
      <main className="asv-main-content">
        <div className="asv-max-w">

          {/* ----------------------------------------------------
              PESTAÑA 1: PASARELA WOMPI & BANCOLOMBIA QR
              ---------------------------------------------------- */}
          {activeNavTab === 'wompi' && (
            <>
              {/* Encabezado y presets */}
              <div className="asview-s-5">
                <div>
                  <h2 className="asview-s-6">
                    Integración Wompi (Bancolombia & Nequi)
                    <span className="asview-s-7">
                      Activo en Serviplus
                    </span>
                  </h2>
                  <p className="asview-s-8">
                    Configura las credenciales de pasarela oficial de UPAYSOLUTIONS para emitir códigos QR dinámicos e instantáneos.
                  </p>
                </div>
                <div className="asview-s-9">
                  <button className="asv-preset-btn primary" type="button" onClick={applyPocketbikeProdKeys}>
                    <Sparkles size={14} />
                    <span>Cargar Producción Pocketbike</span>
                  </button>
                  <button className="asv-preset-btn secondary" type="button" onClick={applyPocketbikeSandboxKeys}>
                    <RefreshCw size={14} />
                    <span>Cargar Sandbox Pruebas</span>
                  </button>
                </div>
              </div>

              {/* Selector de Entorno Sandbox / Producción */}
              <div className="asv-card asview-s-10">
                <div className="asview-s-11">
                  <div className="asview-s-12">
                    <QrCode size={22} />
                  </div>
                  <div>
                    <h3 className="asview-s-13">Entorno Activo de Comunicación API</h3>
                    <p className="asview-s-14">Selecciona el servidor de transacciones para el punto de venta</p>
                  </div>
                </div>

                <div className="asv-segmented-ctrl">
                  <button
                    className={`asv-segmented-btn ${isSandbox ? 'active' : ''}`}
                    type="button"
                    onClick={() => {
                      try { sfx.playTap(); } catch (_) {}
                      setConfig((prev) => ({ ...prev, wompi: { ...prev.wompi, mode: 'sandbox' } }));
                    }}
                  >
                    <span className="asview-s-15"></span>
                    Pruebas (Sandbox)
                  </button>
                  <button
                    className={`asv-segmented-btn ${!isSandbox ? 'active' : ''}`}
                    type="button"
                    onClick={() => {
                      try { sfx.playTap(); } catch (_) {}
                      setConfig((prev) => ({ ...prev, wompi: { ...prev.wompi, mode: 'production' } }));
                    }}
                  >
                    Producción Real
                  </button>
                </div>
              </div>

              {/* Llaves y Secretos Criptográficos */}
              <div className="asv-card">
                <div className="asv-card-header">
                  <div>
                    <h3>Llaves y Secretos Criptográficos</h3>
                    <p>Credenciales de autenticación para generar pagos en {isSandbox ? 'Sandbox' : 'Producción'}</p>
                  </div>
                  <span className="asview-s-16">
                    Cifrado SHA-256
                  </span>
                </div>

                <div className="asv-grid-2">
                  {/* Llave Pública */}
                  <div className="asv-field-group">
                    <label>
                      Llave Pública {isSandbox ? 'Sandbox' : 'Producción'} <span>({isSandbox ? 'Test' : 'Prod'} Public Key)</span>
                    </label>
                    <div className="asv-input-wrapper">
                      <input
                        className="asv-input mono"
                        type="text"
                        value={wompiKeys.publicKey || ''}
                        onChange={(e) => handleWompiKeyChange('publicKey', e.target.value)}
                        placeholder="pub_..."
                      />
                      <button
                        className="asv-input-addon-btn"
                        type="button"
                        onClick={() => copyToClipboard(wompiKeys.publicKey, 'Llave Pública')}
                        title="Copiar llave pública"
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Secreto de Integridad */}
                  <div className="asv-field-group">
                    <label>
                      Secreto de Integridad {isSandbox ? 'Sandbox' : 'Producción'} <span>({isSandbox ? 'Test' : 'Prod'} Integrity Secret)</span>
                    </label>
                    <div className="asv-input-wrapper">
                      <input
                        className="asv-input mono"
                        type="text"
                        value={wompiKeys.integritySecret || ''}
                        onChange={(e) => handleWompiKeyChange('integritySecret', e.target.value)}
                        placeholder="integrity_..."
                      />
                      <button
                        className="asv-input-addon-btn"
                        type="button"
                        onClick={() => copyToClipboard(wompiKeys.integritySecret, 'Secreto Integridad')}
                        title="Copiar secreto de integridad"
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Llave Privada */}
                  <div className="asv-field-group">
                    <label>
                      Llave Privada {isSandbox ? 'Sandbox' : 'Producción'} <span>({isSandbox ? 'Test' : 'Prod'} Private Key)</span>
                    </label>
                    <div className="asv-input-wrapper">
                      <input
                        className="asv-input mono"
                        type={showPrivateKey ? 'text' : 'password'}
                        value={wompiKeys.privateKey || ''}
                        onChange={(e) => handleWompiKeyChange('privateKey', e.target.value)}
                        placeholder="prv_..."
                      />
                      <button
                        className="asv-input-addon-btn"
                        type="button"
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        title={showPrivateKey ? 'Ocultar' : 'Mostrar'}
                      >
                        {showPrivateKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Secreto de Eventos */}
                  <div className="asv-field-group">
                    <label>
                      Secreto de Eventos {isSandbox ? 'Sandbox' : 'Producción'} <span>({isSandbox ? 'Test' : 'Prod'} Events Secret)</span>
                    </label>
                    <div className="asv-input-wrapper">
                      <input
                        className="asv-input mono"
                        type="text"
                        value={wompiKeys.eventsSecret || ''}
                        onChange={(e) => handleWompiKeyChange('eventsSecret', e.target.value)}
                        placeholder="events_..."
                      />
                      <button
                        className="asv-input-addon-btn"
                        type="button"
                        onClick={() => copyToClipboard(wompiKeys.eventsSecret, 'Secreto Eventos')}
                        title="Copiar secreto de eventos"
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Métodos de Pago Activos en Checkout */}
              <div className="asv-card">
                <div className="asv-card-header">
                  <div>
                    <h3>Métodos de Pago Activos en Checkout del Kiosco / POS</h3>
                    <p>Habilita los canales autorizados para recaudar pagos directos en Serviplus</p>
                  </div>
                </div>

                <div className="asv-grid-3">
                  {/* Opción 1: QR Bancolombia / Nequi */}
                  <label className={`asv-method-tile ${(config?.wompi?.methods?.bancolombiaQr ?? true) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={config?.wompi?.methods?.bancolombiaQr ?? true}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          wompi: {
                            ...prev.wompi,
                            methods: { ...(prev.wompi?.methods || {}), bancolombiaQr: e.target.checked }
                          }
                        }))
                      }
                    />
                    <div className="asv-method-icon-box">QR</div>
                    <div className="asview-s-17">
                      <span className="asview-s-18">Código QR Bancolombia / Nequi</span>
                      <span className="asview-s-19">Pago Dinámico Inmediato</span>
                    </div>
                  </label>

                  {/* Opción 2: Pago en Caja / Efectivo */}
                  <label className={`asv-method-tile ${(config?.wompi?.methods?.cash ?? true) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={config?.wompi?.methods?.cash ?? true}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          wompi: {
                            ...prev.wompi,
                            methods: { ...(prev.wompi?.methods || {}), cash: e.target.checked }
                          }
                        }))
                      }
                    />
                    <div className="asv-method-icon-box">💵</div>
                    <div className="asview-s-17">
                      <span className="asview-s-18">Pago en Caja / Efectivo</span>
                      <span className="asview-s-19">Mostrador Front Desk</span>
                    </div>
                  </label>

                  {/* Opción 3: Tarjetas Débito / Crédito Wompi */}
                  <label className={`asv-method-tile ${(config?.wompi?.methods?.wompiLink ?? true) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={config?.wompi?.methods?.wompiLink ?? true}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          wompi: {
                            ...prev.wompi,
                            methods: { ...(prev.wompi?.methods || {}), wompiLink: e.target.checked }
                          }
                        }))
                      }
                    />
                    <div className="asv-method-icon-box">💳</div>
                    <div className="asview-s-17">
                      <span className="asview-s-18">Tarjeta Débito / Crédito Wompi</span>
                      <span className="asview-s-19">Pasarela Segura Web</span>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* ----------------------------------------------------
              PESTAÑA 2: OPERACIÓN KIOSCO & RESTAURANTE
              ---------------------------------------------------- */}
          {activeNavTab === 'kiosk' && (
            <>
              <div className="asv-card">
                <div className="asv-card-header">
                  <div>
                    <h3>Configuración Operativa del Kiosco & Autoservicio</h3>
                    <p>Tiempos de inactividad, propinas y opciones de experiencia del cliente</p>
                  </div>
                  <span className="asview-s-20">
                    Kiosco Serviplus
                  </span>
                </div>

                {/* Toggles de Kiosco */}
                <div className="asv-grid-2 asview-s-21">
                  {/* Propina Voluntaria */}
                  <div className="asv-switch-box">
                    <div className="asv-switch-content">
                      <div className="asv-switch-icon asview-s-22">
                        <DollarSign size={18} />
                      </div>
                      <div>
                        <span className="asview-s-23">Permitir Propina Voluntaria</span>
                        <span className="asview-s-24">Sugerir opción de propina (10%) en pantalla final</span>
                      </div>
                    </div>
                    <label className="asv-switch-ui">
                      <input
                        type="checkbox"
                        checked={config?.kiosk?.allowTips ?? false}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            kiosk: { ...(prev.kiosk || {}), allowTips: e.target.checked }
                          }))
                        }
                      />
                      <span className="asv-slider"></span>
                    </label>
                  </div>

                  {/* Retorno Automático por Inactividad */}
                  <div className="asv-switch-box">
                    <div className="asv-switch-content">
                      <div className="asv-switch-icon asview-s-25">
                        <Clock size={18} />
                      </div>
                      <div>
                        <span className="asview-s-23">Temporizador de Inactividad</span>
                        <span className="asview-s-24">Reiniciar kiosco al abandonar pedido</span>
                      </div>
                    </div>
                    <label className="asv-switch-ui">
                      <input
                        type="checkbox"
                        checked={true}
                        readOnly
                      />
                      <span className="asv-slider"></span>
                    </label>
                  </div>
                </div>

                {/* Campos de Tiempos del Kiosco */}
                <div className="asv-grid-4">
                  {/* Tiempo de Inactividad */}
                  <div className="asv-field-group">
                    <label>Inactividad Máxima (seg)</label>
                    <div className="asv-input-wrapper">
                      <input
                        className="asv-input"
                        type="number"
                        value={config?.kiosk?.idleTimeoutSeconds ?? 120}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            kiosk: { ...(prev.kiosk || {}), idleTimeoutSeconds: Number(e.target.value) || 120 }
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* Alerta de Inactividad */}
                  <div className="asv-field-group">
                    <label>Aviso de Inactividad (seg)</label>
                    <div className="asv-input-wrapper">
                      <input
                        className="asv-input"
                        type="number"
                        value={config?.kiosk?.idleWarningSeconds ?? 15}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            kiosk: { ...(prev.kiosk || {}), idleWarningSeconds: Number(e.target.value) || 15 }
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* Cierre tras Pedido Exitoso */}
                  <div className="asv-field-group">
                    <label>Cierre tras Pago Exitoso (seg)</label>
                    <div className="asv-input-wrapper">
                      <input
                        className="asv-input"
                        type="number"
                        value={config?.kiosk?.orderSuccessAutoCloseSeconds ?? 15}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            kiosk: { ...(prev.kiosk || {}), orderSuccessAutoCloseSeconds: Number(e.target.value) || 15 }
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* Tipo de Pedido por Defecto */}
                  <div className="asv-field-group">
                    <label>Tipo Pedido por Defecto</label>
                    <select
                      className="asv-input"
                      value={config?.kiosk?.defaultOrderType || 1}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          kiosk: { ...(prev.kiosk || {}), defaultOrderType: Number(e.target.value) || 1 }
                        }))
                      }
                    >
                      <option value={1}>🍽️ Comer en Mesa (Dine In)</option>
                      <option value={2}>🛍️ Para Llevar (To Go)</option>
                    </select>
                  </div>
                </div>

                <div className="asv-grid-3 asview-s-26">
                  {/* Correo Cliente Kiosco por Defecto */}
                  <div className="asv-field-group">
                    <label>Correo Electrónico por Defecto</label>
                    <div className="asv-input-wrapper">
                      <input
                        className="asv-input"
                        type="email"
                        value={config?.kiosk?.defaultCustomerEmail || 'kiosco@serviplus.pos'}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            kiosk: { ...(prev.kiosk || {}), defaultCustomerEmail: e.target.value }
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* Moneda Principal */}
                  <div className="asv-field-group">
                    <label>Moneda del Sistema</label>
                    <select
                      className="asv-input"
                      value={config?.wompi?.currency || 'COP'}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          wompi: { ...(prev.wompi || {}), currency: e.target.value }
                        }))
                      }
                    >
                      <option value="COP">COP (Peso Colombiano)</option>
                      <option value="USD">USD (Dólar estadounidense)</option>
                    </select>
                  </div>

                  {/* Zona Horaria Servidor */}
                  <div className="asv-field-group">
                    <label>Zona Horaria Servidor</label>
                    <input
                      className="asv-input asview-s-27"
                      type="text"
                      readOnly
                      value="America/Bogota (UTC-5)"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ----------------------------------------------------
              PESTAÑA 3: SMS HÁBLAME & WHATSAPP
              ---------------------------------------------------- */}
          {activeNavTab === 'sms' && (
            <>
              {/* WhatsApp Meta Cloud API */}
              <div className="asv-card">
                <div className="asv-card-header">
                  <div>
                    <h3>WhatsApp Cloud API (Meta Oficial)</h3>
                    <p>Envío de comprobantes y recibos digitales directo a WhatsApp de los clientes</p>
                  </div>
                  <span className="asview-s-28">
                    🟢 Conectado (+57 301 8800358)
                  </span>
                </div>

                <div className="asv-grid-2">
                  <div className="asv-field-group">
                    <label>ID de Número Telefónico Meta (Phone ID)</label>
                    <input
                      className="asv-input mono"
                      type="text"
                      value={config?.whatsapp?.phoneNumberId || '1457428644110872'}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          whatsapp: { ...(prev.whatsapp || {}), phoneNumberId: e.target.value }
                        }))
                      }
                    />
                  </div>
                  <div className="asv-field-group">
                    <label>Versión API Graph</label>
                    <input
                      className="asv-input mono"
                      type="text"
                      value={config?.whatsapp?.apiVersion || 'v25.0'}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          whatsapp: { ...(prev.whatsapp || {}), apiVersion: e.target.value }
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="asv-field-group asview-s-29">
                  <label>Token de Acceso Permanente Meta Graph API</label>
                  <input
                    className="asv-input mono"
                    type="password"
                    value={config?.whatsapp?.accessToken || ''}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        whatsapp: { ...(prev.whatsapp || {}), accessToken: e.target.value }
                      }))
                    }
                    placeholder="EAAX..."
                  />
                </div>
              </div>

              {/* SMS Háblame Colombia */}
              <div className="asv-card">
                <div className="asv-card-header">
                  <div>
                    <h3>Pasarela SMS Háblame Colombia</h3>
                    <p>Envío de SMS de alta prioridad con enlace al recibo digital</p>
                  </div>
                  <button className="asv-preset-btn secondary" type="button" onClick={applyHablameCredentials}>
                    <RefreshCw size={13} />
                    <span>Cargar Háblame Oficial</span>
                  </button>
                </div>

                <div className="asv-grid-2">
                  <div className="asv-field-group">
                    <label>Usuario Registrado</label>
                    <input
                      className="asv-input"
                      type="text"
                      value={config?.sms?.user || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          sms: { ...(prev.sms || {}), user: e.target.value }
                        }))
                      }
                    />
                  </div>
                  <div className="asv-field-group">
                    <label>ID de Cuenta Háblame</label>
                    <input
                      className="asv-input mono"
                      type="text"
                      value={config?.sms?.accountId || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          sms: { ...(prev.sms || {}), accountId: e.target.value }
                        }))
                      }
                    />
                  </div>
                  <div className="asv-field-group">
                    <label>API Key</label>
                    <input
                      className="asv-input mono"
                      type="text"
                      value={config?.sms?.apiKey || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          sms: { ...(prev.sms || {}), apiKey: e.target.value }
                        }))
                      }
                    />
                  </div>
                  <div className="asv-field-group">
                    <label>Token Criptográfico</label>
                    <input
                      className="asv-input mono"
                      type="password"
                      value={config?.sms?.token || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          sms: { ...(prev.sms || {}), token: e.target.value }
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="asv-field-group asview-s-29">
                  <label>Plantilla de Mensaje SMS</label>
                  <input
                    className="asv-input"
                    type="text"
                    value={config?.sms?.template || ''}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        sms: { ...(prev.sms || {}), template: e.target.value }
                      }))
                    }
                  />
                  <span className="asview-s-30">Variables disponibles: {'{restaurant}'}, {'{url}'}</span>
                </div>
              </div>
            </>
          )}

          {/* ----------------------------------------------------
              PESTAÑA 4: DATOS FISCALES & DIAN
              ---------------------------------------------------- */}
          {activeNavTab === 'dian' && (
            <div className="asv-card">
              <div className="asv-card-header">
                <div>
                  <h3>Información Tributaria y Comercial (DIAN)</h3>
                  <p>Datos impresos en la comanda de cocina, facturas y comprobantes electrónicos</p>
                </div>
              </div>

              <div className="asv-grid-2">
                <div className="asv-field-group">
                  <label>Nombre Comercial</label>
                  <input
                    className="asv-input"
                    type="text"
                    value={config?.restaurant?.name || ''}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        restaurant: { ...(prev.restaurant || {}), name: e.target.value }
                      }))
                    }
                  />
                </div>
                <div className="asv-field-group">
                  <label>Razón Social (Legal)</label>
                  <input
                    className="asv-input"
                    type="text"
                    value={config?.restaurant?.legalName || ''}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        restaurant: { ...(prev.restaurant || {}), legalName: e.target.value }
                      }))
                    }
                  />
                </div>
                <div className="asv-field-group">
                  <label>NIT / Identificación Tributaria</label>
                  <input
                    className="asv-input"
                    type="text"
                    value={config?.restaurant?.nit || ''}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        restaurant: { ...(prev.restaurant || {}), nit: e.target.value }
                      }))
                    }
                  />
                </div>
                <div className="asv-field-group">
                  <label>Teléfono de Contacto</label>
                  <input
                    className="asv-input"
                    type="text"
                    value={config?.restaurant?.phone || ''}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        restaurant: { ...(prev.restaurant || {}), phone: e.target.value }
                      }))
                    }
                  />
                </div>
              </div>

              <div className="asv-field-group asview-s-29">
                <label>Dirección del Establecimiento</label>
                <input
                  className="asv-input"
                  type="text"
                  value={config?.restaurant?.address || ''}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      restaurant: { ...(prev.restaurant || {}), address: e.target.value }
                    }))
                  }
                />
              </div>

              <div className="asv-field-group asview-s-29">
                <label>Resolución DIAN</label>
                <input
                  className="asv-input"
                  type="text"
                  value={config?.restaurant?.dianResolution || ''}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      restaurant: { ...(prev.restaurant || {}), dianResolution: e.target.value }
                    }))
                  }
                />
              </div>

              <div className="asv-field-group asview-s-29">
                <label>Pie de Página del Ticket / Comprobante</label>
                <input
                  className="asv-input"
                  type="text"
                  value={config?.restaurant?.receiptFooter || ''}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      restaurant: { ...(prev.restaurant || {}), receiptFooter: e.target.value }
                    }))
                  }
                />
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              PESTAÑA 5: SISTEMA, HARDWARE & STOCK
              ---------------------------------------------------- */}
          {activeNavTab === 'system' && (
            <>
              {/* Impresoras de Estación (Multiestación) */}
              <div className="asv-card">
                <div className="asv-card-header">
                  <div>
                    <h3>Configuración de Impresoras (Caja, Cocina & Bar)</h3>
                    <p>Asigna cada impresora física instalada en Windows a su estación correspondiente</p>
                  </div>
                  <div className="asview-s-9">
                    <button
                      className="asv-preset-btn secondary"
                      type="button"
                      onClick={handleTestPrint}
                      disabled={testingPrinter}
                      title="Imprimir ticket de prueba en la impresora de caja"
                    >
                      <Printer size={14} />
                      <span>{testingPrinter ? 'Probando...' : 'Probar Caja'}</span>
                    </button>
                    <button
                      className="asv-preset-btn secondary"
                      type="button"
                      onClick={handleTestKitchenPrint}
                      disabled={testingKitchenPrinter}
                      title="Imprimir comanda de prueba en la impresora de cocina"
                    >
                      <span>👨‍🍳 {testingKitchenPrinter ? 'Probando...' : 'Probar Cocina'}</span>
                    </button>
                    <button
                      className="asv-preset-btn primary"
                      type="button"
                      onClick={handleOpenDrawer}
                      disabled={openingDrawer}
                    >
                      <span>{openingDrawer ? 'Abriendo...' : 'Abrir Cajón'}</span>
                    </button>
                  </div>
                </div>

                {/* Estación 1: Caja / Recibos */}
                <div className="asview-s-31">
                  <div className="asview-s-32">
                    <div className="asview-s-33">
                      <span className="asview-s-34">🧾</span>
                      <div>
                        <span className="asview-s-35">Impresora 1: Recibos & Caja (Front Desk)</span>
                        <span className="asview-s-24">Imprime las facturas, comprobantes de pago y cierres de turno</span>
                      </div>
                    </div>
                    <span className="asview-s-36">
                      Principal
                    </span>
                  </div>

                  <div className="asv-grid-2">
                    <div className="asv-field-group">
                      <label>Dispositivo Windows</label>
                      <select
                        className="asv-input"
                        value={config?.printer?.printerName || 'POS-58'}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            printer: { ...(prev.printer || {}), printerName: e.target.value }
                          }))
                        }
                      >
                        {installedPrinters.length > 0 ? (
                          installedPrinters.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))
                        ) : (
                          <option value="POS-58">POS-58 (Por defecto)</option>
                        )}
                      </select>
                    </div>

                    <div className="asv-field-group">
                      <label>Ancho de Papel</label>
                      <select
                        className="asv-input"
                        value={config?.printer?.paperWidth || 58}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            printer: { ...(prev.printer || {}), paperWidth: Number(e.target.value) }
                          }))
                        }
                      >
                        <option value={58}>58 mm (Rollo compacto)</option>
                        <option value={80}>80 mm (Estándar)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Estación 2: Cocina (Kitchen Station) */}
                <div className="asview-s-31">
                  <div className="asview-s-32">
                    <div className="asview-s-33">
                      <span className="asview-s-34">👨‍🍳</span>
                      <div>
                        <span className="asview-s-35">Impresora 2: Comanda de Cocina (Kitchen)</span>
                        <span className="asview-s-24">Imprime los pedidos para preparación con modificadores y notas</span>
                      </div>
                    </div>
                    <span className="asview-s-37">
                      Cocina
                    </span>
                  </div>

                  <div className="asv-grid-2">
                    <div className="asv-field-group">
                      <label>Dispositivo Windows para Cocina</label>
                      <select
                        className="asv-input"
                        value={config?.printer?.kitchenPrinterName || config?.printer?.printerName || 'POS-58'}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            printer: { ...(prev.printer || {}), kitchenPrinterName: e.target.value }
                          }))
                        }
                      >
                        <option value={config?.printer?.printerName || 'POS-58'}>
                          Misma que Caja ({config?.printer?.printerName || 'POS-58'})
                        </option>
                        {installedPrinters
                          .filter((p) => p !== (config?.printer?.printerName || 'POS-58'))
                          .map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                      </select>
                    </div>

                    <div className="asv-field-group">
                      <label>Ancho de Papel Cocina</label>
                      <select
                        className="asv-input"
                        value={config?.printer?.kitchenPaperWidth || 58}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            printer: { ...(prev.printer || {}), kitchenPaperWidth: Number(e.target.value) }
                          }))
                        }
                      >
                        <option value={58}>58 mm (Rollo compacto)</option>
                        <option value={80}>80 mm (Estándar)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Estación 3: Bar / Bebidas / Postres */}
                <div className="asview-s-38">
                  <div className="asview-s-32">
                    <div className="asview-s-33">
                      <span className="asview-s-34">🍹</span>
                      <div>
                        <span className="asview-s-35">Impresora 3: Bar & Bebidas (Opcional)</span>
                        <span className="asview-s-24">Envía tickets de jugos, bebidas y postres a barra</span>
                      </div>
                    </div>
                    <span className="asview-s-39">
                      Barra
                    </span>
                  </div>

                  <div className="asv-grid-2">
                    <div className="asv-field-group">
                      <label>Dispositivo Windows para Bar</label>
                      <select
                        className="asv-input"
                        value={config?.printer?.barPrinterName || ''}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            printer: { ...(prev.printer || {}), barPrinterName: e.target.value }
                          }))
                        }
                      >
                        <option value="">(Desactivada - No imprimir comanda separada)</option>
                        <option value={config?.printer?.printerName || 'POS-58'}>
                          Misma que Caja ({config?.printer?.printerName || 'POS-58'})
                        </option>
                        {installedPrinters
                          .filter((p) => p !== (config?.printer?.printerName || 'POS-58'))
                          .map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Automatizaciones y Reglas de Impresión */}
              <div className="asv-card">
                <div className="asv-card-header">
                  <div>
                    <h3>Reglas y Automatizaciones de Impresión</h3>
                    <p>Comportamiento automático tras pagos en Kiosco y Punto de Venta</p>
                  </div>
                </div>

                <div className="asv-grid-2 asview-s-40">
                  {/* Auto-imprimir Recibo de Venta */}
                  <div className="asv-switch-box">
                    <div>
                      <span className="asview-s-23">Auto-imprimir Recibo de Venta</span>
                      <span className="asview-s-24">Imprime ticket inmediatamente al completar el cobro</span>
                    </div>
                    <label className="asv-switch-ui">
                      <input
                        type="checkbox"
                        checked={config?.printer?.autoPrintOrder ?? true}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            printer: { ...(prev.printer || {}), autoPrintOrder: e.target.checked }
                          }))
                        }
                      />
                      <span className="asv-slider"></span>
                    </label>
                  </div>

                  {/* Auto-imprimir Comanda Cocina */}
                  <div className="asv-switch-box">
                    <div>
                      <span className="asview-s-23">Auto-imprimir Comanda Cocina</span>
                      <span className="asview-s-24">Envía la comanda a cocina inmediatamente</span>
                    </div>
                    <label className="asv-switch-ui">
                      <input
                        type="checkbox"
                        checked={config?.printer?.autoPrintKitchen ?? false}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            printer: { ...(prev.printer || {}), autoPrintKitchen: e.target.checked }
                          }))
                        }
                      />
                      <span className="asv-slider"></span>
                    </label>
                  </div>

                  {/* Auto-imprimir Cierre Z */}
                  <div className="asv-switch-box">
                    <div>
                      <span className="asview-s-23">Auto-imprimir Cierre Z / Turno</span>
                      <span className="asview-s-24">Emite el balance de caja al cerrar turno</span>
                    </div>
                    <label className="asv-switch-ui">
                      <input
                        type="checkbox"
                        checked={config?.printer?.autoPrintCashShift ?? true}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            printer: { ...(prev.printer || {}), autoPrintCashShift: e.target.checked }
                          }))
                        }
                      />
                      <span className="asv-slider"></span>
                    </label>
                  </div>

                  {/* Código QR de Recibo Digital */}
                  <div className="asv-switch-box">
                    <div>
                      <span className="asview-s-23">Código QR de Recibo Digital</span>
                      <span className="asview-s-24">Imprime código QR nativo para ver la factura en el móvil</span>
                    </div>
                    <label className="asv-switch-ui">
                      <input
                        type="checkbox"
                        checked={config?.printer?.printDigitalReceiptQr ?? true}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            printer: { ...(prev.printer || {}), printDigitalReceiptQr: e.target.checked }
                          }))
                        }
                      />
                      <span className="asv-slider"></span>
                    </label>
                  </div>

                  {/* Abrir Cajón en Efectivo */}
                  <div className="asv-switch-box">
                    <div>
                      <span className="asview-s-23">Abrir Cajón en Efectivo</span>
                      <span className="asview-s-24">Envía pulso RJ11 a la gaveta de dinero</span>
                    </div>
                    <label className="asv-switch-ui">
                      <input
                        type="checkbox"
                        checked={config?.printer?.openCashDrawer ?? false}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            printer: { ...(prev.printer || {}), openCashDrawer: e.target.checked }
                          }))
                        }
                      />
                      <span className="asv-slider"></span>
                    </label>
                  </div>

                  {/* Corte Automático de Papel */}
                  <div className="asv-switch-box">
                    <div>
                      <span className="asview-s-23">Corte Automático (Auto-Cut)</span>
                      <span className="asview-s-24">Ejecuta corte de guillotina al terminar</span>
                    </div>
                    <label className="asv-switch-ui">
                      <input
                        type="checkbox"
                        checked={config?.printer?.cutPaper ?? true}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            printer: { ...(prev.printer || {}), cutPaper: e.target.checked }
                          }))
                        }
                      />
                      <span className="asv-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="asv-grid-2">
                  <div className="asv-field-group">
                    <label>Número de Copias de Recibo</label>
                    <select
                      className="asv-input"
                      value={config?.printer?.copies || 1}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          printer: { ...(prev.printer || {}), copies: Number(e.target.value) || 1 }
                        }))
                      }
                    >
                      <option value={1}>1 Copia (Cliente)</option>
                      <option value={2}>2 Copias (Cliente + Comercio)</option>
                    </select>
                  </div>

                  <div className="asv-field-group">
                    <label>Líneas de avance antes del corte</label>
                    <select
                      className="asv-input"
                      value={config?.printer?.feedLines || 3}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          printer: { ...(prev.printer || {}), feedLines: Number(e.target.value) || 3 }
                        }))
                      }
                    >
                      <option value={2}>2 líneas</option>
                      <option value={3}>3 líneas (Recomendado)</option>
                      <option value={4}>4 líneas</option>
                      <option value={5}>5 líneas</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Control de Agotados (86'd) */}
              <div className="asv-card">
                <div className="asv-card-header">
                  <div>
                    <h3>Control de Productos Agotados (86'd)</h3>
                    <p>Desactiva platillos sin existencias para que no se puedan pedir en Kiosco ni Punto de Venta</p>
                  </div>
                  <div className="asv-input-wrapper asview-s-41">
                    <input
                      className="asv-input"
                      type="text"
                      placeholder="Buscar platillo..."
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                    />
                  </div>
                </div>

                {loadingStock ? (
                  <p className="asview-s-42">Cargando catálogo de productos...</p>
                ) : (
                  <div className="asv-stock-grid">
                    {filteredStock.map((prod) => (
                      <div key={prod.id} className={`asv-stock-item ${!prod.isActive ? 'is-86' : ''}`}>
                        <div>
                          <div className="asview-s-43">{prod.name}</div>
                          <div className="asview-s-24">{prod.categoryName} • {formatCOP(prod.price)}</div>
                        </div>
                        <button
                          className={`asv-stock-toggle-btn ${prod.isActive ? 'available' : 'out'}`}
                          type="button"
                          onClick={() => handleToggleStock(prod)}
                          disabled={togglingStockId === prod.id}
                        >
                          {prod.isActive ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                          <span>{prod.isActive ? 'Disponible' : 'Agotado'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </main>

      {/* ==========================================================
          FOOTER FIJO DE ACCIONES
          ========================================================== */}
      <footer className="asv-footer" data-purpose="footer-actions">
        <div className="asv-footer-status">
          <span className="asview-s-44"></span>
          <span>Conexión establecida con Wompi Gateway • Sistema UPAYSOLUTIONS S.A.S.</span>
        </div>

        <div className="asv-footer-actions">
          <button
            className="asv-close-btn"
            type="button"
            onClick={handleReturnHome}
          >
            Cerrar
          </button>
          <button
            className="asv-save-btn"
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? <RefreshCw className="spin" size={16} /> : <Save size={16} />}
            <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
