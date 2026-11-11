import React, { useState, useEffect } from 'react';
import { useCartStore } from '../../../store/useCartStore';
import { createOrder, fetchTables, sendDigitalReceipt, createWompiQr, fetchWompiTransactionStatus, sendWhatsAppMessage } from '../../../api';
import { sfx } from '../../../utils/audio';
import { socket } from '../../../socket';
import { KIOSK_CONFIG } from '../../../config/kioskConfig';
import { usePaymentMethods } from '../../../hooks/usePaymentMethods';
import { resolvePaymentMethod } from '../../../shared/paymentMethods';

import { CheckoutFlowHeader } from './CheckoutFlowHeader';
import { ReviewStep } from './ReviewStep';
import { ServiceTypeStep } from './ServiceTypeStep';
import { TableSelectStep } from './TableSelectStep';
import { PaymentStep } from './PaymentStep';
import { SuccessStep } from './SuccessStep';

import { showAlert } from '../../../store/useAlertDialogStore';
import './CheckoutView.css';

/** Orden de preferencia del kiosco cuando el método predeterminado está desactivado. */
const KIOSK_PAYMENT_ORDER = ['WOMPI_QR', 'CASH', 'CARD'];

export function CheckoutView({ isOpen = true, onClose, onOrderCompleted }) {
  // Pasos del Checkout:
  // 1: 'REVIEW' (Revisar productos y cantidades a pantalla completa)
  // 2: 'SERVICE_TYPE' (Página dedicada: ¿Dónde comerás hoy? Comer Aquí vs Para Llevar)
  // 3: 'SELECT_TABLE' (Página dedicada: Seleccionar Mesa con cuadrícula)
  // 4: 'PAYMENT' (Seleccionar método de pago: Wompi QR, Efectivo, Datáfono)
  // 5: 'SUCCESS' (Turno gigante, confirmación y opciones de recibo digital)
  const [step, setStep] = useState(1);
  const [tables, setTables] = useState([]);
  const [tableId, setTableId] = useState(null);
  const [tableGroup, setTableGroup] = useState('');
  const [orderType, setOrderType] = useState(KIOSK_CONFIG.orderDefaults.defaultOrderType); // 'EAT_IN' | 'TAKE_OUT'
  const [paymentMethod, setPaymentMethod] = useState(KIOSK_CONFIG.orderDefaults.defaultPaymentMethod);
  // Métodos habilitados en Admin: el kiosco solo ofrece esos, y arranca con el predeterminado si está activo.
  const enabledPaymentMethods = usePaymentMethods();
  useEffect(() => {
    setPaymentMethod((current) => resolvePaymentMethod(
      enabledPaymentMethods,
      current,
      [KIOSK_CONFIG.orderDefaults.defaultPaymentMethod, ...KIOSK_PAYMENT_ORDER]
    ));
  }, [enabledPaymentMethods]);
  const [createdOrderNumber, setCreatedOrderNumber] = useState(null);
  const [createdOrderId, setCreatedOrderId] = useState(null);
  const [createdReceiptCode, setCreatedReceiptCode] = useState(null);
  const [createdReceiptUrl, setCreatedReceiptUrl] = useState(null);
  const [createdReceiptFullUrl, setCreatedReceiptFullUrl] = useState(null);
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

  // Verificación Dual: WebSocket (Socket.io) + Polling de respaldo
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

    const eventName = `payment:${wompiQrData.reference}`;
    const handleSocketEvent = (eventData) => {
      if (eventData?.status === 'APPROVED') {
        onApproved(eventData);
      }
    };
    socket.on(eventName, handleSocketEvent);

    let pollTimer = null;
    if (wompiQrData.transactionId) {
      pollTimer = setInterval(async () => {
        if (isHandled) return;
        try {
          const txData = await fetchWompiTransactionStatus(wompiQrData.transactionId);
          if (txData?.status === 'APPROVED') {
            onApproved(txData);
          }
        } catch (e) {
          // Micro-corte de red
        }
      }, KIOSK_CONFIG.timeouts.wompiPollIntervalMs);
    }

    return () => {
      socket.off(eventName, handleSocketEvent);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [wompiQrData, step, paymentMethod]);

  if (!isOpen) return null;

  const handleBack = () => {
    sfx.playTap();
    if (step === 1) {
      handleClose();
    } else if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    } else if (step === 4) {
      if (orderType === 'EAT_IN') {
        setStep(3);
      } else {
        setStep(2);
      }
    } else if (step === 5) {
      handleFinish();
    }
  };

  const handleSelectEatIn = () => {
    sfx.playTap();
    setOrderType('EAT_IN');
    setTimeout(() => {
      setStep(3);
    }, KIOSK_CONFIG.timeouts.stepTransitionDelayMs);
  };

  const handleSelectTakeOut = () => {
    sfx.playTap();
    setOrderType('TAKE_OUT');
    setTableId(null);
    setTimeout(() => {
      setStep(4);
    }, KIOSK_CONFIG.timeouts.stepTransitionDelayMs);
  };

  const handleConfirmOrder = async (overrideParams = null) => {
    if (orderType === 'EAT_IN' && !tableId) {
      showAlert({ variant: 'warning', title: 'Selecciona una mesa', description: 'Elige tu mesa para continuar con el pedido.' });
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
      const rCode = res.receiptCode || res.data?.receiptCode || null;
      const rUrl = res.receiptUrl || res.data?.receiptUrl || (rCode ? `/p/${rCode}` : null);
      const rFullUrl = res.receiptFullUrl || res.data?.receiptFullUrl || (rCode ? `https://serviplus.upaysolutions.app/p/${rCode}` : null);
      setCreatedReceiptCode(rCode);
      setCreatedReceiptUrl(rUrl);
      setCreatedReceiptFullUrl(rFullUrl);
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
      showAlert({ variant: 'error', title: 'No se pudo crear la orden', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!receiptInput.trim() || receiptInput.trim().length < KIOSK_CONFIG.validation.phoneMinLength) {
      showAlert({ variant: 'warning', title: 'Número de celular no válido', description: 'Ingresa un número de celular válido para recibir tu comprobante.' });
      return;
    }
    sfx.playTap();
    setIsSendingReceipt(true);
    try {
      let cleanPhone = receiptInput.trim().replace(/\D/g, '');
      if (cleanPhone.length === 10 && cleanPhone.startsWith('3')) {
        cleanPhone = `${KIOSK_CONFIG.validation.defaultCountryCode}${cleanPhone}`;
      } else if (cleanPhone.length === 10 && (cleanPhone.startsWith('787') || cleanPhone.startsWith('939'))) {
        cleanPhone = `1${cleanPhone}`;
      } else if (cleanPhone.length === 10 && !cleanPhone.startsWith(KIOSK_CONFIG.validation.defaultCountryCode)) {
        cleanPhone = `${KIOSK_CONFIG.validation.defaultCountryCode}${cleanPhone}`;
      }

      // Siempre generar y enviar la URL pública oficial HTTPS con el código de factura para que WhatsApp la reconozca como un enlace interactivo
      const publicBase = 'https://serviplus.upaysolutions.app';
      const receiptPath = createdReceiptUrl || (createdReceiptCode ? `/p/${createdReceiptCode}` : '');
      const fullReceiptUrl = (createdReceiptFullUrl && createdReceiptFullUrl.startsWith('https://'))
        ? createdReceiptFullUrl
        : (receiptPath ? `${publicBase}${receiptPath}` : `${publicBase}/p/${createdOrderNumber || '1'}`);

      const messageBody = KIOSK_CONFIG.messages.whatsappTemplate(
        createdOrderNumber,
        fullReceiptUrl,
        KIOSK_CONFIG.restaurant.name
      );

      // Enviar directamente vía Meta Cloud API v25.0
      await sendWhatsAppMessage(cleanPhone, messageBody, {
        orderId: createdOrderId,
        orderNumber: createdOrderNumber,
        receiptUrl: fullReceiptUrl
      });

      sfx.playReadyChime();
      setReceiptSentSuccess(true);
      setReceiptDestination(cleanPhone);
    } catch (err) {
      console.error('[WhatsApp Send Error]:', err);
      showAlert({ variant: 'error', title: 'No se pudo enviar el WhatsApp', description: err.message });
    } finally {
      setIsSendingReceipt(false);
    }
  };

  const handleSendSMS = async () => {
    if (!receiptInput.trim() || receiptInput.trim().length < KIOSK_CONFIG.validation.phoneMinLength) {
      showAlert({ variant: 'warning', title: 'Número de celular no válido', description: 'Ingresa un número de celular válido para recibir tu comprobante.' });
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

  const handleFinish = () => {
    setStep(1);
    setTableId(null);
    if (onClose) onClose();
    if (onOrderCompleted) onOrderCompleted();
  };

  const handleClose = () => {
    setStep(1);
    setTableId(null);
    if (onClose) onClose();
  };

  return (
    <div className="checkout-view-immersive">
      {/* Cabecera Inmersiva Táctil */}
      <CheckoutFlowHeader
        step={step}
        orderType={orderType}
        onBack={handleBack}
        onClose={handleClose}
      />

      {/* Contenedor Principal de la Pantalla Activa */}
      <main className="checkout-immersive-main">
        {step === 1 && (
          <ReviewStep
            cart={cart}
            total={total}
            totalItems={totalItems}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            clearCart={clearCart}
            onNext={() => {
              sfx.playTap();
              setStep(2);
            }}
            onAddMore={handleClose}
          />
        )}

        {step === 2 && (
          <ServiceTypeStep
            onSelectEatIn={handleSelectEatIn}
            onSelectTakeOut={handleSelectTakeOut}
          />
        )}

        {step === 3 && (
          <TableSelectStep
            tables={tables}
            tableId={tableId}
            tableGroup={tableGroup}
            onSelectTable={(tableNum) => {
              sfx.playTap();
              setTableId(tableNum);
            }}
            onChangeService={() => {
              sfx.playTap();
              setStep(2);
            }}
            onNext={() => {
              sfx.playTap();
              setStep(4);
            }}
          />
        )}

        {step === 4 && (
          <PaymentStep
            orderType={orderType}
            tableId={tableId}
            total={total}
            paymentMethod={paymentMethod}
            enabledMethods={enabledPaymentMethods}
            onSelectPaymentMethod={(methodId) => {
              sfx.playTap();
              setPaymentMethod(methodId);
            }}
            wompiQrData={wompiQrData}
            qrLoading={qrLoading}
            qrError={qrError}
            isSubmitting={isSubmitting}
            onConfirmOrder={() => handleConfirmOrder()}
          />
        )}

        {step === 5 && (
          <SuccessStep
            createdOrderNumber={createdOrderNumber}
            createdOrderId={createdOrderId}
            tableId={tableId}
            orderType={orderType}
            finalTotal={finalTotal}
            paymentMethod={paymentMethod}
            createdReceiptCode={createdReceiptCode}
            createdReceiptUrl={createdReceiptUrl}
            createdReceiptFullUrl={createdReceiptFullUrl}
            completedOrderItems={completedOrderItems}
            activeReceiptTab={activeReceiptTab}
            setActiveReceiptTab={setActiveReceiptTab}
            receiptInput={receiptInput}
            setReceiptInput={setReceiptInput}
            receiptSentSuccess={receiptSentSuccess}
            receiptDestination={receiptDestination}
            isSendingReceipt={isSendingReceipt}
            secondsRemaining={secondsRemaining}
            onSendWhatsApp={handleSendWhatsApp}
            onSendSMS={handleSendSMS}
            onFinish={handleFinish}
          />
        )}
      </main>
    </div>
  );
}

export default CheckoutView;

