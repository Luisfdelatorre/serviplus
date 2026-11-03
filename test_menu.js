const ADODB = require('node-adodb');
const config = require('./config.json');

const connection = ADODB.open(config.db.connectionString);

async function testMenu() {
  try {
    const items = await connection.query(`
      SELECT 
        m.MenuItemID, 
        m.MenuCategoryID, 
        c.MenuCategoryText, 
        m.MenuItemText, 
        m.DefaultUnitPrice, 
        m.ItemDelComp
      FROM MenuItems m
      LEFT JOIN MenuCategories c ON m.MenuCategoryID = c.MenuCategoryID
      WHERE m.DefaultUnitPrice > 0
      ORDER BY c.MenuCategoryText, m.MenuItemText
    `);
    console.log(`Total MenuItems found: ${items.length}`);
    console.log('Sample items:');
    console.log(items.slice(0, 5));
  } catch (err) {
    console.error('Query error:', err);
  }
}

testMenu();
