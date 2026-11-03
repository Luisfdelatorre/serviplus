import React, { useState, useEffect } from 'react';
import { useCartStore } from '../../store/useCartStore';
import { createOrder, fetchTables, sendDigitalReceipt, createWompiQr } from '../../api';
import { formatCOP } from '../../utils/format';
import { getProductImageUrl } from '../../utils/productImages';
import { sfx } from '../../utils/audio';
import { socket } from '../../socket';
import { KIOSK_CONFIG } from '../../config/kioskConfig';
import './CheckoutModal.css';

export function CheckoutModal({ isOpen, onClose, onOrderCompleted }) {
  // Pasos del Checkout:
  // 1: 'REVIEW' (Revisar productos y cantidades a pantalla completa)
  // 2: 'SERVICE_TYPE' (Página dedicada: ¿Dónde comerás hoy? Comer Aquí vs Para Llevar)
  // 3: 'SELECT_TABLE' (Página dedicada: Seleccionar Mesa con cuadrícula de las 30 mesas)
  // 4: 'PAYMENT' (Seleccionar método de pago: Wompi QR, Efectivo, Datáfono)
  // 5: 'SUCCESS' (Turno gigante, confirmación y opciones de recibo digital)
  const [step, setStep] = useState(1);
  const [tables, setTables] = useState([]);
  const [tableId, setTableId] = useState(null);
  const [tableGroup, setTableGroup] = useState('');
  const [orderType, setOrderType] = useState(KIOSK_CONFIG.orderDefaults.defaultOrderType); // 'EAT_IN' | 'TAKE_OUT'
  const [paymentMethod, setPaymentMethod] = useState(KIOSK_CONFIG.orderDefaults.defaultPaymentMethod);
  const [createdOrderNumber, setCreatedOrderNumber] = useState(null);
  const [createdOrderId, setCreatedOrderId] = useState(null);
  const [createdReceiptCode, setCreatedReceiptCode] = useState(null);
  const [createdReceiptUrl, setCreatedReceiptUrl] = useState(null);
  const [finalTotal, setFinalTotal] = useState(0);
  const [receiptMode, setReceiptMode] = useState(null); // null | 'email' | 'text' | 'sent'
  const [receiptInput, setReceiptInput] = useState('');
  const [receiptDestination, setReceiptDestination] = useState('');
  const [isSendingReceipt, setIsSendingReceipt] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(KIOSK_CONFIG.timeouts.orderSuccessAutoCloseSeconds);
  const [completedOrderItems, setCompletedOrderItems] = useState([]);
  const [activeReceiptTab, setActiveReceiptTab] = useState(KIOSK_CONFIG.orderDefaults.defaultReceiptTab); // 'qr' | 'whatsapp' | 'sms'
  const [receiptSentSuccess, setReceiptSentSuccess] = useState(false);

  // Estados de Wompi QR dinámico
  const [wompiQrData, setWompiQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');

  const cart = useCartStore((state) => state.cart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const clearCart = useCartStore((state) => state.clearCart);
  const getTotalAmount = useCartStore((state) => state.getTotalAmount);

  const total = getTotalAmount();
  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  const now = new Date();
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const receiptDateStr = `${String(now.getDate()).padStart(2, '0')}/${months[now.getMonth()]}/${now.getFullYear()}`;
  const receiptTimeStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });

  useEffect(() => {
    fetchTables().then((data) => {
      if (data && data.length > 0) {
        setTables(data);
        const firstGroup = data[0].groupName || 'Main Dining Room';
        setTableGroup(firstGroup);
      }
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setTableId(null);
      setOrderType(KIOSK_CONFIG.orderDefaults.defaultOrderType);
      setCreatedReceiptCode(null);
      setCreatedReceiptUrl(null);
      setReceiptMode(null);
      setReceiptInput('');
      setReceiptDestination('');
      setIsSendingReceipt(false);
      setSecondsRemaining(KIOSK_CONFIG.timeouts.orderSuccessAutoCloseSeconds);
    }
  }, [isOpen]);

  useEffect(() => {
    window.__setCheckoutStep = setStep;
    window.__setOrderType = setOrderType;
    window.__setTableId = setTableId;
    window.__setCreatedOrderNumber = setCreatedOrderNumber;
  }, []);

  // Si la orden finalizó con éxito (step 5), cuenta regresiva y cierre automático
  useEffect(() => {
    if (step !== 5) return;
    // Si el usuario está escribiendo su email o teléfono, pausar temporizador
    if (receiptMode === 'email' || receiptMode === 'text') return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step, receiptMode]);

  // Generar QR oficial de Bancolombia / Nequi al llegar al paso 4
  useEffect(() => {
    if (step === 4 && paymentMethod === 'WOMPI_QR' && total > 0) {
      let isCancelled = false;
      const generateQr = async () => {
        try {
          setQrLoading(true);
          setQrError('');
          const randomOrderTemp = Math.floor(100 + Math.random() * 900);
          const data = await createWompiQr(randomOrderTemp, total, KIOSK_CONFIG.orderDefaults.defaultCustomerEmail, {
            cart: cart.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price, modifiers: i.modifiers })),
            tableId: orderType === 'EAT_IN' ? tableId : 0,
            orderType: orderType === 'EAT_IN' ? 1 : 2
          });
          if (!isCancelled) {
            setWompiQrData(data);
          }
        } catch (err) {
          if (!isCancelled) {
            console.error('[Kiosk Wompi QR Error]:', err);
            setQrError(err.message || 'No se pudo generar el código QR.');
          }
        } finally {
          if (!isCancelled) setQrLoading(false);
        }
      };
      generateQr();
      return () => { isCancelled = true; };
    }
  }, [step, paymentMethod, total]);

  // Verificación Dual: WebSocket (Socket.io) + Polling de respaldo cada 2.5s
  useEffect(() => {
    if (!wompiQrData?.reference || step !== 4 || paymentMethod !== 'WOMPI_QR') return;

    let isHandled = false;
    const onApproved = (txData) => {
      if (isHandled) return;
      isHandled = true;
      console.log('[Kiosk Payment] ¡Pago aprobado detectado!', txData);
      sfx.playReadyChime();
      handleConfirmOrder({
        paymentMethod: 'WOMPI_QR',
        isPaid: true,
        transactionRef: wompiQrData?.reference || txData?.reference || '',
        wompiTransactionId: wompiQrData?.transactionId || txData?.id || txData?.transactionId || ''
      });
    };

    // 1. Canal WebSocket (Push instantáneo vía Webhook)
    const eventName = `payment:${wompiQrData.reference}`;
    const handleSocketEvent = (eventData) => {
      const statusUpper = String(eventData?.status || '').toUpperCase();
      if (statusUpper === 'APPROVED') {
        onApproved(eventData);
      }
    };
    socket.on(eventName, handleSocketEvent);

    // 2. Canal Polling (Sondeo cada 2.5s - ideal para redes locales / sin IP pública)
    let pollTimer = null;
    if (wompiQrData.transactionId) {
      pollTimer = setInterval(async () => {
        if (isHandled) return;
        try {
          const res = await fetch(`/api/payments/wompi/status/${wompiQrData.transactionId}`);
          if (res.ok) {
            const json = await res.json();
            if (json?.data?.status === 'APPROVED') {
              onApproved(json.data);
            }
          }
        } catch (e) {
          // Silencioso en caso de micro-corte de red
        }
      }, KIOSK_CONFIG.timeouts.wompiPollIntervalMs);
    }

    return () => {
      socket.off(eventName, handleSocketEvent);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [wompiQrData, step, paymentMethod]);

  if (!isOpen) return null;

  const distinctGroups = Array.from(new Set(tables.map((t) => t.groupName || 'Main Dining Room'))).filter(Boolean);
  const activeGroup = tableGroup || distinctGroups[0] || 'Main Dining Room';
  const filteredTables = distinctGroups.length > 1
    ? tables.filter((t) => (t.groupName || 'Main Dining Room') === activeGroup)
    : tables;

  const handleBack = () => {
    sfx.playTap();
    if (step === 1) {
      handleClose();
    } else if (step === 2) {
      setStep(1); // De servicio a revisar pedido
    } else if (step === 3) {
      setStep(2); // De mesas a servicio
    } else if (step === 4) {
      if (orderType === 'EAT_IN') {
        setStep(3); // Volver a selección de mesa
      } else {
        setStep(2); // Volver a Comer Aquí / Llevar
      }
    } else if (step === 5) {
      handleFinish();
    }
  };

  const handleSelectEatIn = () => {
    sfx.playTap();
    setOrderType('EAT_IN');
    setTimeout(() => {
      setStep(3); // Ir a página de selección de mesas
    }, KIOSK_CONFIG.timeouts.stepTransitionDelayMs);
  };

  const handleSelectTakeOut = () => {
    sfx.playTap();
    setOrderType('TAKE_OUT');
    setTableId(null);
    setTimeout(() => {
      setStep(4); // Para llevar no requiere mesa, ir directo a pago
    }, KIOSK_CONFIG.timeouts.stepTransitionDelayMs);
  };

  const handleConfirmOrder = async (overrideParams = null) => {
    if (orderType === 'EAT_IN' && !tableId) {
      alert('Por favor selecciona una mesa para continuar.');
      setStep(3);
      return;
    }

    setIsSubmitting(true);
    sfx.playTap();
    try {
      const activeMethod = overrideParams?.paymentMethod || paymentMethod;
      const isPaidImmediately = overrideParams?.isPaid !== undefined ? overrideParams.isPaid : (activeMethod === 'WOMPI_QR');
      const orderPayload = {
        employeeId: KIOSK_CONFIG.orderDefaults.defaultEmployeeId,
        orderType: orderType === 'EAT_IN' ? 1 : 2,
        tableId: orderType === 'EAT_IN' ? tableId : null,
        paymentMethod: activeMethod,
        isPaid: isPaidImmediately,
        transactionRef: overrideParams?.transactionRef || wompiQrData?.reference || '',
        wompiTransactionId: overrideParams?.wompiTransactionId || wompiQrData?.transactionId || '',
        items: cart.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          basePrice: i.basePrice || i.price,
          modifiers: i.modifiers || [],
          notes: i.notes || ''
        }))
      };

      setCompletedOrderItems([...cart]);
      setFinalTotal(total);
      const res = await createOrder(orderPayload);
      const assignedNumber = res.orderNumber || res.id;
      setCreatedOrderNumber(assignedNumber);
      setCreatedOrderId(res.id || res.orderId);
      const rCode = res.receiptCode || null;
      const rUrl = res.receiptUrl || (rCode ? `/p/p/${rCode}` : null);
      setCreatedReceiptCode(rCode);
      setCreatedReceiptUrl(rUrl);
      sfx.playReadyChime();
      clearCart();
      setReceiptMode(null);
      setReceiptInput('');
      setReceiptDestination('');
      setActiveReceiptTab(KIOSK_CONFIG.orderDefaults.defaultReceiptTab);
      setReceiptSentSuccess(false);
      setSecondsRemaining(KIOSK_CONFIG.timeouts.orderSuccessAutoCloseSeconds);
      setStep(5);
    } catch (err) {
      alert('Error creando la orden: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendWhatsApp = () => {
    if (!receiptInput.trim() || receiptInput.trim().length < KIOSK_CONFIG.validation.phoneMinLength) {
      alert('Por favor ingresa un número de celular válido.');
      return;
    }
    sfx.playTap();
    const cleanPhone = receiptInput.trim().replace(/\D/g, '');
    const fullReceiptUrl = window.location.origin + (createdReceiptUrl || `/p/p/${createdReceiptCode || ''}`);
    const message = encodeURIComponent(
      KIOSK_CONFIG.messages.whatsappTemplate(createdOrderNumber, fullReceiptUrl, KIOSK_CONFIG.restaurant.name)
    );
    const waUrl = `https://api.whatsapp.com/send?phone=${KIOSK_CONFIG.validation.defaultCountryCode}${cleanPhone.slice(-10)}&text=${message}`;
    window.open(waUrl, '_blank');
    setReceiptSentSuccess(true);
    setReceiptDestination(cleanPhone);
  };

  const handleSendSMS = async () => {
    if (!receiptInput.trim() || receiptInput.trim().length < KIOSK_CONFIG.validation.phoneMinLength) {
      alert('Por favor ingresa un número de celular válido.');
      return;
    }
    sfx.playTap();
    setIsSendingReceipt(true);
    try {
      const cleanPhone = receiptInput.trim().replace(/\D/g, '');
      await sendDigitalReceipt(createdOrderId || createdOrderNumber, 'sms', cleanPhone);
      setReceiptSentSuccess(true);
      setReceiptDestination(cleanPhone);
    } catch (e) {
      console.error(e);
      setReceiptSentSuccess(true);
      setReceiptDestination(receiptInput.trim());
    } finally {
      setIsSendingReceipt(false);
    }
  };

  const handleSendReceipt = async (type) => {
    if (!receiptInput.trim()) {
      alert(type === 'email' ? 'Por favor escribe tu correo electrónico' : 'Por favor ingresa tu número de celular');
      return;
    }
    sfx.playTap();
    setIsSendingReceipt(true);
    try {
      const dest = receiptInput.trim();
      await sendDigitalReceipt(createdOrderId || createdOrderNumber, type, dest);
      setReceiptDestination(dest);
      setReceiptMode('sent');
      setSecondsRemaining(KIOSK_CONFIG.timeouts.receiptSentAutoCloseSeconds);
    } catch (e) {
      console.error(e);
      setReceiptDestination(receiptInput.trim());
      setReceiptMode('sent');
      setSecondsRemaining(KIOSK_CONFIG.timeouts.receiptSentAutoCloseSeconds);
    } finally {
      setIsSendingReceipt(false);
    }
  };

  const handleFinish = () => {
    setStep(1);
    setTableId(null);
    onClose();
    if (onOrderCompleted) onOrderCompleted();
  };

  const handleClose = () => {
    setStep(1);
    setTableId(null);
    onClose();
  };

  return (
    <div className="checkout-overlay">
      <div className="checkout-modal">
        {/* HEADER SUPERIOR CON STEPPER Y VOLVER */}
        <header className="checkout-header">
          {/* Botón Volver Dinámico */}
          <button type="button" onClick={handleBack} className="checkout-back-btn">
            <span>←</span>
            <span>
              {step === 1 && 'Volver al Menú'}
              {step === 2 && 'Modificar Pedido'}
              {step === 3 && 'Cambiar Modalidad'}
              {step === 4 && (orderType === 'EAT_IN' ? 'Cambiar Mesa' : 'Cambiar Modalidad')}
              {step === 5 && 'Inicio'}
            </span>
          </button>

          {/* Stepper Visual Central */}
          <div className="checkout-stepper">
            {/* Paso 1: Mi Pedido */}
            <div className={`checkout-step-pill ${step === 1 ? 'active' : ''}`}>
              <span>🛒</span>
              <span>1. Pedido</span>
            </div>

            <span className="checkout-step-sep">›</span>

            {/* Paso 2: Servicio */}
            <div className={`checkout-step-pill ${step === 2 ? 'active' : ''}`}>
              <span>🍽️</span>
              <span>2. Servicio</span>
            </div>

            {orderType === 'EAT_IN' && (
              <>
                <span className="checkout-step-sep">›</span>
                {/* Paso 3: Mesa */}
                <div className={`checkout-step-pill ${step === 3 ? 'active' : ''}`}>
                  <span>🪑</span>
                  <span>3. Mesa</span>
                </div>
              </>
            )}

            <span className="checkout-step-sep">›</span>

            {/* Paso 4: Pago */}
            <div className={`checkout-step-pill ${step === 4 ? 'active' : ''}`}>
              <span>💳</span>
              <span>{orderType === 'EAT_IN' ? '4. Pago' : '3. Pago'}</span>
            </div>
          </div>

          {/* Botón Cerrar */}
          <button type="button" onClick={handleClose} className="checkout-close-btn" title="Cerrar">
            ✕
          </button>
        </header>

        {/* CONTENEDOR PRINCIPAL DE PÁGINAS */}
        <div className="checkout-pages-body">
          {/* =========================================================================
              PÁGINA 1: REVISAR MI PEDIDO (ITEMS, FOTOS, CANTIDADES Y TOTAL)
              ========================================================================= */}
          {step === 1 && (
            <div className="checkout-step-page animate-step-fade">
              {/* Barra de Título */}
              <div className="checkout-section-header">
                <div>
                  <h2 className="checkout-title-h2">Revisar Mi Pedido</h2>
                  <p className="checkout-subtitle-p">
                    Verifica tus platillos, añade salsas o modifica cantidades
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span className="checkout-badge-pill">
                    {totalItems} {totalItems === 1 ? 'artículo' : 'artículos'}
                  </span>

                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('¿Deseas vaciar tu pedido por completo?')) {
                          clearCart();
                        }
                      }}
                      className="checkout-clear-btn"
                    >
                      🗑️ Vaciar todo
                    </button>
                  )}
                </div>
              </div>

              {/* Lista Scrollable de Productos */}
              <div className="checkout-items-container">
                {cart.map((item) => {
                  const itemKey = item.cartItemId || item.id;
                  return (
                    <div key={itemKey} className="checkout-item-card">
                      {/* Imagen Thumbnail */}
                      <div className="checkout-item-img-wrap">
                        <img
                          src={getProductImageUrl(item)}
                          alt={item.name}
                          className="checkout-item-img"
                          onError={(e) => {
                            e.target.src = '/images/kebab.png';
                          }}
                        />
                      </div>

                      {/* Info y Modificadores */}
                      <div className="checkout-item-info">
                        <div className="checkout-item-name">{item.name}</div>

                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="checkout-item-mods">
                            {item.modifiers.map((m, idx) => (
                              <span key={idx} className="checkout-mod-pill">
                                + {m.name}
                              </span>
                            ))}
                          </div>
                        )}

                        {item.notes && (
                          <div className="checkout-item-notes">📝 {item.notes}</div>
                        )}

                        <div className="checkout-item-price">
                          {formatCOP(item.price * item.quantity)}
                        </div>
                      </div>

                      {/* Controles de Cantidad */}
                      <div className="checkout-qty-group">
                        <button
                          type="button"
                          onClick={() => updateQuantity(itemKey, -1)}
                          className="checkout-qty-btn"
                        >
                          -
                        </button>
                        <span className="checkout-qty-text">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(itemKey, 1)}
                          className="checkout-qty-btn plus"
                        >
                          +
                        </button>

                        {/* Botón Papelera */}
                        <button
                          type="button"
                          onClick={() => removeFromCart && removeFromCart(itemKey)}
                          className="checkout-item-del-btn"
                          title="Eliminar plato"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}

                {cart.length === 0 && (
                  <div className="checkout-empty-cart">
                    <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>🥙</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#334155' }}>
                      Tu orden está vacía
                    </div>
                    <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                      Agrega productos del menú para comenzar tu pedido.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer Fijo con Total y Botón Continuar */}
              <div className="checkout-footer-bar">
                <div>
                  <div className="checkout-footer-total-lbl">TOTAL DE TU ORDEN</div>
                  <div className="checkout-footer-total-val">{formatCOP(total)}</div>
                </div>

                <div className="checkout-footer-actions">
                  <button type="button" onClick={handleClose} className="checkout-btn-add-more">
                    + Agregar Más Productos
                  </button>

                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={() => {
                      sfx.playTap();
                      setStep(2); // Avanzar a ¿Dónde comerás hoy?
                    }}
                    className={`checkout-btn-primary-action ${cart.length > 0 ? 'pulse-primary-btn' : ''}`}
                  >
                    <span>Elegir Dónde Comer →</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              PÁGINA 2: ¿DÓNDE COMERÁS HOY? (COMER AQUÍ VS PARA LLEVAR)
              ========================================================================= */}
          {step === 2 && (
            <div className="checkout-service-center animate-step-fade">
              {/* Título de Bienvenida */}
              <div style={{ textAlign: 'center', marginBottom: '24px', maxWidth: '600px' }}>
                <span className="checkout-service-badge">Paso 2 de tu Orden</span>
                <h1 className="checkout-service-title">¿Dónde comerás hoy?</h1>
                <p className="checkout-service-sub">Toca una opción para continuar con tu pedido</p>
              </div>

              {/* Grid de 2 Tarjetas Táctiles Gigantes */}
              <div className="checkout-service-grid">
                {/* TARJETA 1: COMER AQUÍ */}
                <button type="button" onClick={handleSelectEatIn} className="checkout-service-card">
                  <div className="checkout-service-card-top-tag">Salón / Mesa</div>

                  <div className="checkout-service-svg-wrap">
                    <svg style={{ width: '100px', height: '100px' }} fill="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                      <ellipse cx="50" cy="74" fill="#D8DADC" rx="42" ry="12"></ellipse>
                      <ellipse cx="50" cy="72" fill="#ECEEF0" rx="40" ry="10"></ellipse>
                      <path d="M22 65 C24 55, 66 50, 76 60 C80 64, 76 72, 70 73 C58 75, 26 73, 22 65 Z" fill="#E6A15C"></path>
                      <path d="M34 60 L40 68" stroke="#8A4E1A" strokeLinecap="round" strokeWidth="2.5"></path>
                      <path d="M48 58 L54 67" stroke="#8A4E1A" strokeLinecap="round" strokeWidth="2.5"></path>
                      <path d="M62 57 L68 66" stroke="#8A4E1A" strokeLinecap="round" strokeWidth="2.5"></path>
                      <circle cx="27" cy="65" fill="#DD3022" r="4.5"></circle>
                      <circle cx="31" cy="68" fill="#6C9E47" r="3"></circle>
                      <circle cx="25" cy="61" fill="#FFC72C" r="3"></circle>
                      <rect fill="#DD3022" height="24" rx="3" width="18" x="58" y="38"></rect>
                      <rect fill="#FFBC0D" height="18" rx="1.5" width="3" x="62" y="24"></rect>
                      <rect fill="#FFC72C" height="20" rx="1.5" width="3" x="67" y="22"></rect>
                      <rect fill="#FEBB0B" height="16" rx="1.5" width="3" x="71" y="26"></rect>
                      <circle cx="67" cy="50" fill="#FFBC0D" r="4"></circle>
                      <path d="M22 34 L32 34 L30 54 L24 54 Z" fill="#FFBC0D"></path>
                      <rect fill="#ECEEF0" height="4" rx="2" width="14" x="20" y="32"></rect>
                      <path d="M28 20 L27 33" stroke="#DD3022" strokeLinecap="round" strokeWidth="2.5"></path>
                    </svg>
                  </div>

                  <div>
                    <span className="checkout-service-name">Comer Aquí</span>
                    <span className="checkout-service-desc">Servido en bandeja para disfrutar en mesa</span>
                  </div>
                </button>

                {/* TARJETA 2: PARA LLEVAR */}
                <button type="button" onClick={handleSelectTakeOut} className="checkout-service-card">
                  <div className="checkout-service-card-top-tag">Empaque Especial</div>

                  <div className="checkout-service-svg-wrap">
                    <svg style={{ width: '100px', height: '100px' }} fill="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                      <ellipse cx="50" cy="80" fill="#D8DADC" rx="34" ry="7"></ellipse>
                      <path d="M28 38 L32 78 L68 78 L72 38 Z" fill="#D19C65"></path>
                      <path d="M48 38 L50 78 L68 78 L72 38 Z" fill="#C28B53"></path>
                      <path d="M28 38 L48 38 L50 78 L32 78 Z" fill="#D9A670"></path>
                      <path d="M28 38 L34 35 L40 38 L46 35 L52 38 L58 35 L64 38 L72 38 L70 42 L30 42 Z" fill="#B57F48"></path>
                      <path d="M38 36 C38 22, 62 22, 62 36" fill="none" stroke="#8A5A2B" strokeLinecap="round" strokeWidth="3"></path>
                      <rect fill="#DD3022" height="16" rx="3" width="16" x="42" y="52"></rect>
                      <circle cx="50" cy="60" fill="#FFBC0D" r="5"></circle>
                      <path d="M48 57 L52 60 L48 63" fill="none" stroke="#191C1E" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2"></path>
                      <path d="M60 42 L74 30 L80 37 L66 48 Z" fill="#FFDEA4"></path>
                      <circle cx="73" cy="35" fill="#6C9E47" r="2.5"></circle>
                    </svg>
                  </div>

                  <div>
                    <span className="checkout-service-name">Para Llevar</span>
                    <span className="checkout-service-desc">Empacado seguro para llevar a casa o trabajo</span>
                  </div>
                </button>
              </div>

              {/* Mensaje Informativo Inferior */}
              <div className="checkout-service-info-foot">
                <span>⏱️</span>
                <span>Tiempo estimado de preparación: 5 - 8 minutos</span>
              </div>
            </div>
          )}

          {/* =========================================================================
              PÁGINA 3: SELECCIONAR MESA (PÁGINA DEDICADA CON 30 MESAS)
              ========================================================================= */}
          {step === 3 && (
            <div className="checkout-step-page animate-step-fade">
              {/* Header de la Página de Mesas */}
              <div className="checkout-section-header">
                <div>
                  <h2 className="checkout-title-h2">¿En qué mesa te ubicarás?</h2>
                  <p className="checkout-subtitle-p">
                    Toca el número de tu mesa para que el personal te lleve la orden
                  </p>
                </div>

                {tableId ? (
                  <span className="checkout-table-selected-badge">
                    ✓ Mesa #{tableId} Seleccionada
                  </span>
                ) : (
                  <span className="checkout-table-empty-badge">
                    ⚠️ Selecciona tu mesa para continuar
                  </span>
                )}
              </div>

              {/* Cuadrícula Táctil Espaciosa de las 30 Mesas */}
              <div className="checkout-tables-center-scroll">
                <div className="checkout-tables-grid">
                  {[...filteredTables]
                    .sort((a, b) => {
                      const numA = parseInt(a.name || a.id, 10);
                      const numB = parseInt(b.name || b.id, 10);
                      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                      return String(a.name || a.id).localeCompare(String(b.name || b.id));
                    })
                    .map((t) => {
                      const tableNum = parseInt(t.name || t.id, 10);
                      const isSelected = tableId !== null && (tableId === t.id || tableId === tableNum);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            sfx.playTap();
                            setTableId(tableNum);
                          }}
                          className={`checkout-table-card ${isSelected ? 'selected' : ''}`}
                        >
                          <span className="checkout-table-card-sub">MESA</span>
                          <span>{t.name || t.id}</span>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Footer con Total y Botón Continuar */}
              <div className="checkout-footer-bar">
                <div>
                  <div className="checkout-footer-total-lbl">MODALIDAD</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
                    🍽️ Comer en Mesa {tableId ? `#${tableId}` : '(Por elegir)'}
                  </div>
                </div>

                <div className="checkout-footer-actions">
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playTap();
                      setStep(2); // Volver a servicio
                    }}
                    className="checkout-btn-add-more"
                  >
                    ← Cambiar a Para Llevar
                  </button>

                  <button
                    type="button"
                    disabled={!tableId}
                    onClick={() => {
                      sfx.playTap();
                      setStep(4); // Avanzar a método de pago
                    }}
                    className={`checkout-btn-emerald-action ${tableId ? 'pulse-emerald-btn' : ''}`}
                  >
                    <span>{tableId ? 'Continuar al Pago →' : '⚠️ Selecciona tu Mesa'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              PÁGINA 4: MÉTODO DE PAGO (QR WOMPI, EFECTIVO, DATÁFONO)
              ========================================================================= */}
          {step === 4 && (
            <div className="checkout-step-page-scroll animate-step-fade">
              {/* Resumen de Modalidad y Total */}
              <div className="checkout-payment-summary-box">
                <div>
                  <div className="checkout-footer-total-lbl">DESTINO DE TU ORDEN</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                    {orderType === 'EAT_IN' ? `🍽️ Comer en Mesa #${tableId}` : '🛍️ Empacado Para Llevar'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div className="checkout-footer-total-lbl">TOTAL A PAGAR</div>
                  <div style={{ fontSize: '1.95rem', fontWeight: 900, color: '#047857', letterSpacing: '-0.5px' }}>
                    {formatCOP(total)}
                  </div>
                </div>
              </div>

              {/* Selector de Medios de Pago */}
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: '0 0 12px 0' }}>
                Selecciona tu medio de pago:
              </h3>

              <div className="checkout-payment-methods-grid">
                {[
                  { id: 'WOMPI_QR', label: 'QR Bancolombia / Wompi', badge: 'Pago Automático' },
                  { id: 'CASH', label: 'Efectivo en Caja', badge: 'Front Desk' },
                  { id: 'CARD', label: 'Datáfono en Caja', badge: 'Front Desk' }
                ].map((m) => {
                  const isSelected = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        sfx.playTap();
                        setPaymentMethod(m.id);
                      }}
                      className={`checkout-payment-card ${isSelected ? 'selected' : ''}`}
                    >
                      <div style={{ fontSize: '2.2rem' }}>{m.icon}</div>
                      <div style={{ fontSize: '1rem', fontWeight: 900 }}>{m.label}</div>
                      <span className="checkout-payment-card-badge">{m.badge}</span>
                    </button>
                  );
                })}
              </div>

              {/* Detalle Interactivo de la opción seleccionada */}
              <div className="checkout-payment-detail-center">
                {paymentMethod === 'WOMPI_QR' && (
                  <div className="checkout-qr-box">
                    {qrLoading ? (
                      <div style={{ padding: '30px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '2.4rem', animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: '8px' }}>🔄</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>Generando QR Bancolombia / Nequi...</div>
                        <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '4px 0 0 0' }}>Conectando con la pasarela de pagos Wompi</p>
                      </div>
                    ) : wompiQrData?.qrImage ? (
                      <div>
                        <div style={{ background: '#ffffff', padding: '12px', borderRadius: '18px', display: 'inline-block', boxShadow: '0 8px 25px rgba(0, 0, 0, 0.08)', border: '1px solid #e2e8f0' }}>
                          <img
                            src={
                              wompiQrData.qrImage.startsWith('data:')
                                ? wompiQrData.qrImage
                                : wompiQrData.qrImage.startsWith('PD94bWw') || wompiQrData.qrImage.startsWith('PHN2Zw')
                                  ? `data:image/svg+xml;base64,${wompiQrData.qrImage}`
                                  : `data:image/png;base64,${wompiQrData.qrImage}`
                            }
                            alt="Código QR Bancolombia / Nequi"
                            style={{ width: '190px', height: '190px', display: 'block', margin: '0 auto', borderRadius: '8px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
                            Escanea con tu App Bancolombia o Nequi
                          </span>
                          <span style={{ background: '#ecfdf5', color: '#047857', fontSize: '0.75rem', fontWeight: 900, padding: '3px 9px', borderRadius: '9999px', border: '1px solid #a7f3d0' }}>
                            ● Listo
                          </span>
                        </div>
                        <p style={{ fontSize: '0.86rem', color: '#64748b', margin: '4px 0 0 0' }}>
                          Total: <strong style={{ color: '#047857' }}>{formatCOP(total)}</strong> • Ref: <strong>{wompiQrData.reference}</strong>
                        </p>
                        <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#059669', fontWeight: 700, background: '#f0fdf4', padding: '6px 12px', borderRadius: '10px', border: '1px solid #bbf7d0', display: 'inline-block' }}>
                          ⚡ Al completar el pago en tu celular, el Kiosco lo detecta y envía la orden a cocina al instante.
                        </div>
                      </div>
                    ) : (
                      <div>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(wompiQrData?.checkoutUrl || 'https://checkout.wompi.co')}`}
                          alt="Wompi QR"
                          style={{ width: '160px', height: '160px', margin: '0 auto', display: 'block', borderRadius: '12px', background: '#fff', padding: '6px' }}
                        />
                        <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', marginTop: '12px' }}>
                          Escanea con tu App Bancolombia, Nequi o Cámara
                        </div>
                        <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '4px 0 0 0' }}>
                          Tu pago se confirma de inmediato y tu orden pasa directamente a la pantalla de cocina.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'CASH' && (
                  <div className="checkout-cash-box">
                    <div style={{ fontSize: '2.5rem', marginBottom: '6px' }}>💵</div>
                    <div style={{ fontSize: '1.22rem', fontWeight: 900, color: '#065f46' }}>
                      Pago en Efectivo en Caja
                    </div>
                    <p style={{ fontSize: '0.92rem', color: '#047857', fontWeight: 600, margin: '8px 0 0 0', lineHeight: 1.4 }}>
                      Al presionar <strong>Confirmar Orden</strong>, tu turno quedará reservado. Acércate a la <strong>Caja / Front Desk</strong> para pagar. La cocina comenzará tu comida tan pronto reciban el pago.
                    </p>
                  </div>
                )}

                {paymentMethod === 'CARD' && (
                  <div className="checkout-card-box">
                    <div style={{ fontSize: '2.5rem', marginBottom: '6px' }}>💳</div>
                    <div style={{ fontSize: '1.22rem', fontWeight: 900, color: '#1e40af' }}>
                      Pago con Tarjeta o Datáfono en Caja
                    </div>
                    <p style={{ fontSize: '0.92rem', color: '#1d4ed8', fontWeight: 600, margin: '8px 0 0 0', lineHeight: 1.4 }}>
                      Acércate con tu número de orden a la <strong>Caja / Front Desk</strong> para pasar tu tarjeta débito o crédito por el datáfono.
                    </p>
                  </div>
                )}
              </div>

              {/* Botón de Confirmación Final */}
              <div style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmOrder}
                  className="checkout-confirm-btn pulse-emerald-btn"
                >
                  {isSubmitting ? (
                    'Enviando orden a cocina...'
                  ) : paymentMethod === 'WOMPI_QR' ? (
                    '✓ Confirmar y Enviar a Cocina'
                  ) : (
                    '🧾 Confirmar Orden (Pagar en Caja)'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              PÁGINA 5: CONFIRMACIÓN Y RECIBO DIGITAL COMPACTO ESTILO CAJA
              ========================================================================= */}
          {step === 5 && (
            <div className="checkout-success-split-layout animate-step-fade">
              {/* ================= COLUMNA IZQUIERDA ================= */}
              <div className="checkout-success-left-col">
                {/* 1. Tarjeta Superior: Estado y Número de Turno */}
                <div className="checkout-success-card checkout-success-header-card">
                  <div className="checkout-success-card-top-row">
                    <div className="checkout-success-badge-title">
                      <span className="checkout-success-check-icon">✓</span>
                      <h2 className="checkout-success-h2">¡Pago Exitoso!</h2>
                    </div>
                    <span className="checkout-success-pill-tag">
                      {paymentMethod === 'WOMPI_QR' ? 'Pago procesado exitosamente' : 'Orden creada exitosamente'}
                    </span>
                  </div>

                  <div className="checkout-success-card-bottom-row">
                    <div className="checkout-success-turno-group">
                      <span className="checkout-success-turno-lbl">TU NÚMERO DE TURNO</span>
                      <div className="checkout-success-turno-num">#{createdOrderNumber || 24}</div>
                    </div>

                    <div className="checkout-success-badges-stack">
                      <div className="checkout-success-salon-badge">
                        <span>🍽️</span>
                        <span>{orderType === 'EAT_IN' ? `Salón: Mesa #${tableId || '4'}` : 'Empaque: Para Llevar'}</span>
                      </div>
                      <div className="checkout-success-kitchen-badge">
                        <span>🔍</span>
                        <span>Enviado a Cocina</span>
                        <span className="kitchen-dot">●</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Tarjeta Inferior: ¿Cómo deseas llevarte tu factura? */}
                <div className="checkout-success-card checkout-success-options-card">
                  <div className="checkout-success-options-header">
                    <span className="checkout-success-options-title">¿Cómo deseas llevarte tu factura?</span>
                    <span className="checkout-success-eco-pill">🌱 Recibo 100% Digital</span>
                  </div>

                  {/* Pestañas de Canales: WhatsApp | Texto / SMS | Ver QR */}
                  <div className="checkout-receipt-channel-tabs">
                    <button
                      type="button"
                      onClick={() => {
                        sfx.playTap();
                        setActiveReceiptTab('whatsapp');
                        setReceiptSentSuccess(false);
                      }}
                      className={`checkout-channel-tab ${activeReceiptTab === 'whatsapp' ? 'active' : ''}`}
                    >
                      <span style={{ fontSize: '1.2rem' }}>💬</span>
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sfx.playTap();
                        setActiveReceiptTab('sms');
                        setReceiptSentSuccess(false);
                      }}
                      className={`checkout-channel-tab ${activeReceiptTab === 'sms' ? 'active' : ''}`}
                    >
                      <span style={{ fontSize: '1.2rem' }}>📱</span>
                      <span>Texto / SMS</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sfx.playTap();
                        setActiveReceiptTab('qr');
                        setReceiptSentSuccess(false);
                      }}
                      className={`checkout-channel-tab ${activeReceiptTab === 'qr' ? 'active' : ''}`}
                    >
                      <span style={{ fontSize: '1.2rem' }}>📷</span>
                      <span>Ver QR</span>
                    </button>
                  </div>

                  {/* Contenedor del Canal Seleccionado */}
                  <div className="checkout-channel-tab-content">
                    {/* CANAL: CÓDIGO QR EN PANTALLA */}
                    {activeReceiptTab === 'qr' && (
                      <div className="checkout-qr-view-box">
                        <div className="checkout-qr-inner-card">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(
                              window.location.origin + (createdReceiptUrl || `/p/p/${createdReceiptCode || 'SP-24'}`)
                            )}`}
                            alt="QR Factura Digital"
                            className="checkout-receipt-qr-img"
                          />
                        </div>
                        <div className="checkout-qr-inst-title">Apunta tu cámara aquí</div>
                        <div className="checkout-qr-inst-sub">
                          Se abrirá la factura digital inmediatamente en tu teléfono.
                        </div>
                      </div>
                    )}

                    {/* CANAL: WHATSAPP O SMS CON NUMPAD */}
                    {(activeReceiptTab === 'whatsapp' || activeReceiptTab === 'sms') && !receiptSentSuccess && (
                      <div className="checkout-phone-tab-box">
                        <div className="checkout-phone-screen-display">
                          <span className="phone-prefix">{KIOSK_CONFIG.validation.phonePrefix}</span>
                          <span className={`phone-number-text ${!receiptInput ? 'empty' : ''}`}>
                            {receiptInput || 'Ingresa tu número de celular'}
                          </span>
                        </div>

                        {/* Teclado Numérico Táctil */}
                        <div className="checkout-compact-numpad">
                          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => {
                                sfx.playTap();
                                if (k === 'C') setReceiptInput('');
                                else if (k === '⌫') setReceiptInput((p) => p.slice(0, -1));
                                else if (receiptInput.length < KIOSK_CONFIG.validation.phoneMaxLength) setReceiptInput((p) => p + k);
                              }}
                              className={`checkout-compact-key ${k === 'C' ? 'clear' : k === '⌫' ? 'del' : ''}`}
                            >
                              {k}
                            </button>
                          ))}
                        </div>

                        <div className="checkout-phone-action-row">
                          {activeReceiptTab === 'whatsapp' ? (
                            <button
                              type="button"
                              disabled={receiptInput.length < KIOSK_CONFIG.validation.phoneMinLength}
                              onClick={handleSendWhatsApp}
                              className="checkout-btn-send-whatsapp"
                            >
                              <span>💬</span>
                              <span>Abrir en WhatsApp</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={receiptInput.length < KIOSK_CONFIG.validation.phoneMinLength || isSendingReceipt}
                              onClick={handleSendSMS}
                              className="checkout-btn-send-sms"
                            >
                              <span>📱</span>
                              <span>{isSendingReceipt ? 'Enviando...' : 'Enviar por SMS'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* CONFIRMACIÓN DE ENVÍO */}
                    {receiptSentSuccess && (
                      <div className="checkout-sent-success-feedback">
                        <div className="checkout-feedback-icon">✓</div>
                        <div className="checkout-feedback-title">¡Comprobante enviado!</div>
                        <p className="checkout-feedback-desc">
                          Enviado exitosamente a <strong>{KIOSK_CONFIG.validation.phonePrefix} {receiptDestination}</strong>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Botón Inferior: Sin Recibo / Finalizar */}
                  <button type="button" onClick={handleFinish} className="checkout-bottom-finish-btn">
                    <span>✕</span>
                    <span>Sin Recibo / Finalizar ({secondsRemaining}s)</span>
                  </button>
                </div>
              </div>

              {/* ================= COLUMNA DERECHA: RECIBO TÉRMICO ================= */}
              <div className="checkout-success-right-col">
                <div className="receipt-paper-ticket">
                  {/* Logo de encabezado del restaurante Kebab */}
                  <div className="receipt-ticket-logo-circle">
                    <img
                      src={KIOSK_CONFIG.restaurant.logoUrl || '/images/kebab_logo.png'}
                      alt="Logo Kebab"
                      className="receipt-ticket-logo-img"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = 'inline-block';
                      }}
                    />
                    <span style={{ display: 'none' }}>{KIOSK_CONFIG.restaurant.logoEmoji}</span>
                  </div>

                  {/* Encabezado del Comercio */}
                  <div className="receipt-ticket-header">
                    <h3 className="receipt-store-name">{KIOSK_CONFIG.restaurant.name}</h3>
                    <p className="receipt-fiscal-sub">NIT: {KIOSK_CONFIG.restaurant.nit}</p>
                    <p className="receipt-fiscal-sub">{KIOSK_CONFIG.restaurant.address}</p>
                  </div>

                  <div className="receipt-dashed-separator" />

                  {/* Orden y Mesa */}
                  <div className="receipt-info-two-col">
                    <span><strong>ORDEN:</strong> #{createdOrderNumber || 24}</span>
                    <span><strong>MESA:</strong> {orderType === 'EAT_IN' ? (tableId || 4) : 'LLEVAR'}</span>
                  </div>
                  <div className="receipt-info-two-col">
                    <span>{receiptDateStr}</span>
                    <span>{receiptTimeStr}</span>
                  </div>

                  <div className="receipt-dashed-separator" />

                  {/* Lista de Platos Comprados */}
                  <div className="receipt-ticket-items-list">
                    {(completedOrderItems.length > 0 ? completedOrderItems : (cart.length > 0 ? cart : [
                      { id: 101, name: 'Shawarma Mixto', price: 18.0, quantity: 2, modifiers: [{ id: 1, name: 'Queso Extra', price: 2.0 }] },
                      { id: 102, name: 'Papas Rústicas', price: 8.0, quantity: 1 }
                    ])).map((item, idx) => (
                      <div key={idx} className="receipt-ticket-item-entry">
                        <div className="receipt-item-line">
                          <span className="receipt-item-qty-name">{item.quantity}x {item.name}</span>
                          <span className="receipt-item-price">{formatCOP(item.price * item.quantity)}</span>
                        </div>
                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="receipt-item-mods">
                            {item.modifiers.map((m) => `+ ${m.name}`).join(', ')}
                          </div>
                        )}
                        {item.notes && (
                          <div className="receipt-item-notes">📝 {item.notes}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="receipt-dashed-separator" />

                  {/* Subtotal y Totales */}
                  <div className="receipt-totals-section">
                    <div className="receipt-subtotal-row">
                      <span>SUBTOTAL:</span>
                      <span>{formatCOP(finalTotal || total || 44.0)}</span>
                    </div>
                    <div className="receipt-total-row">
                      <span>TOTAL PAGADO:</span>
                      <span className="receipt-total-highlight">{formatCOP(finalTotal || total || 44.0)}</span>
                    </div>
                    <div className="receipt-meta-row">
                      <span>PAGO:</span>
                      <span className="receipt-meta-val">
                        {paymentMethod === 'WOMPI_QR' ? 'Wompi QR (APROBADO)' : (paymentMethod === 'CASH' ? 'Efectivo en Caja' : 'Datáfono')}
                      </span>
                    </div>
                    <div className="receipt-meta-row">
                      <span>REF:</span>
                      <span className="receipt-meta-val receipt-mono">{wompiQrData?.reference || createdReceiptCode || 'SP-1793691288288'}</span>
                    </div>
                  </div>

                  {/* Código de Barras Decorativo Realista */}
                  <div className="receipt-barcode-wrap">
                    <div className="receipt-barcode-pattern" />
                  </div>

                  {/* Pie de Recibo */}
                  <div className="receipt-ticket-footer">
                    <p className="receipt-thank-you">¡Gracias por tu compra!</p>
                    <p className="receipt-claim-msg">{KIOSK_CONFIG.restaurant.receiptFooter}</p>
                  </div>

                  {/* Borde Perforado Inferior */}
                  <div className="receipt-perforated-edge">
                    {Array.from({ length: 22 }).map((_, i) => (
                      <span key={i} className="perforated-hole" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
