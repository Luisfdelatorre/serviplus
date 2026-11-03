const ADODB = require('node-adodb');
const config = require('./config.json');

const connection = ADODB.open(config.db.connectionString);

function query(sql) {
  return new Promise((resolve, reject) => {
    connection.query(sql)
      .on('done', (data) => resolve(data ? data.records : []))
      .on('fail', (err) => reject(err));
  });
}

async function inspect() {
  try {
    const categories = await query('SELECT TOP 10 MenuCategoryID, MenuCategoryText FROM MenuCategories');
    console.log('--- Menu Categories ---');
    console.log(categories);

    const employees = await query('SELECT EmployeeID, FirstName, LastName, AccessCode FROM EmployeeFiles');
    console.log('--- Employees ---');
    console.log(employees);

    const tables = await query('SELECT TOP 5 DineInTableID, DineInTableText FROM DineInTables');
    console.log('--- Tables ---');
    console.log(tables);

    const lastOrders = await query('SELECT TOP 3 OrderID, OrderDateTime, OrderStatus, AmountDue FROM OrderHeaders ORDER BY OrderID DESC');
    console.log('--- Last Orders ---');
    console.log(lastOrders);
  } catch (err) {
    console.error(err);
  }
}

inspect();
