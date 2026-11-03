const ADODB = require('node-adodb');
const config = require('./config.json');

const connection = ADODB.open(config.db.connectionString);

async function checkOrders() {
  try {
    const orders = await connection.query(`
      SELECT TOP 5 
        h.OrderID, 
        h.OrderDateTime, 
        h.OrderStatus, 
        h.AmountDue, 
        h.DineInTableID, 
        h.EmployeeID
      FROM OrderHeaders h
      ORDER BY h.OrderID DESC
    `);
    console.log('--- Last 5 OrderHeaders ---');
    console.log(orders);

    if (orders.length > 0) {
      const orderId = orders[0].OrderID;
      const items = await connection.query(`
        SELECT 
          t.OrderTransactionID, 
          t.OrderID, 
          t.MenuItemID, 
          t.MenuItemUnitPrice, 
          t.Quantity, 
          t.ExtendedPrice,
          m.MenuItemText
        FROM OrderTransactions t
        LEFT JOIN MenuItems m ON t.MenuItemID = m.MenuItemID
        WHERE t.OrderID = ${orderId}
      `);
      console.log(`--- Items for OrderID ${orderId} ---`);
      console.log(items);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

checkOrders();
