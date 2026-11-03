const ADODB = require('node-adodb');
const config = require('./config.json');

const connection = ADODB.open(config.db.connectionString);

async function testQuery() {
  try {
    const q1 = await connection.query(`
      SELECT 
        h.OrderID, 
        h.OrderDateTime, 
        h.OrderStatus, 
        h.AmountDue, 
        h.GuestNumber,
        h.DineInTableID,
        h.EmployeeID
      FROM OrderHeaders h
      ORDER BY h.OrderID DESC
    `);
    console.log('q1 success! Records:', q1.length);
  } catch (err) {
    console.error('q1 failed:', err);
  }
}

testQuery();
