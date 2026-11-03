const ADODB = require('node-adodb');
const config = require('./config.json');

console.log('Testing connection to:', config.db.connectionString);
const connection = ADODB.open(config.db.connectionString);

function queryPromise(sql) {
  return new Promise((resolve, reject) => {
    connection.query(sql)
      .on('done', (data) => resolve(data.records))
      .on('fail', (err) => reject(err));
  });
}

async function test() {
  try {
    const records = await queryPromise('SELECT TOP 3 MenuItemID, MenuItemText, DefaultUnitPrice FROM MenuItems');
    console.log('SUCCESS! Records received:');
    console.log(records);
  } catch (err) {
    console.error('ERROR querying DB:', err);
  }
}

test();
