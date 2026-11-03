const aldeloService = require('./server/aldeloService');

async function test() {
  try {
    console.log('--- Testing getMenu ---');
    const menu = await aldeloService.getMenu();
    console.log(`Categories found: ${menu.length}`);
    menu.forEach(c => console.log(`Category: ${c.name} (${c.items.length} items)`));

    console.log('\n--- Testing getEmployees ---');
    const employees = await aldeloService.getEmployees();
    console.log(`Employees found: ${employees.length}`);

    console.log('\n--- Testing getActiveOrders ---');
    const orders = await aldeloService.getActiveOrders();
    console.log(`Active orders found: ${orders.length}`);
    if (orders.length > 0) {
      console.log('Sample order:', orders[0]);
    }
    console.log('\nALL ALDELO SERVICE TESTS PASSED!');
  } catch (err) {
    console.error('Test error:', err);
  }
}

test();
