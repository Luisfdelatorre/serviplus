const aldeloService = require('./server/aldeloService');

async function testCreate() {
  try {
    console.log('--- Testing createOrder ---');
    const newOrder = await aldeloService.createOrder({
      employeeId: 5, // Lenyi
      items: [
        { id: 365, name: 'Pura Agua $3', price: 3, quantity: 1, notes: 'Test Kiosk' }
      ],
      paymentMethod: 'WOMPI_QR',
      notes: 'Prueba Kiosk Automático'
    });
    console.log('Order created successfully in Aldelo DB:', newOrder);

    // Verify it appears in active orders
    const active = await aldeloService.getActiveOrders();
    console.log('Latest active order in DB:', active[0]);

    // Test updating status to '2' (SettledOrder)
    await aldeloService.updateOrderStatus(newOrder.orderId, '2');
    console.log(`Order ${newOrder.orderId} updated to status 2 (SettledOrder - Pagada y Cerrada)`);
  } catch (err) {
    console.error('Error creating order:', err);
  }
}

testCreate();
