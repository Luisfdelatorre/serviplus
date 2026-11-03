const express = require("express"),
  bodyparser = require("body-parser");
const cors = require('cors');

const moment = require('moment');
const config = require("./config.json"); // Import the config file
const ADODB = require("./node_modules/node-adodb/lib/client");
const app = express();
app.use(cors()); // Enable CORS for all routes

const connection = ADODB.open(config.db.connectionString);
ADODB.debug = true;

app.use(bodyparser.json());

app.get("/report", async (req, res) => {
  try {
    const dateParam = req.query.date || 0;
    const date = new Date();
    const startDate = new Date(1900, 0, 1);
    const millisecondsInDay = 86400000;
    const diff = date - startDate;
    const initime = Math.floor(diff / millisecondsInDay) + 2 - dateParam;
    const finitime = Math.floor(diff / millisecondsInDay) + 2 - dateParam + 1;
    // SQL Query
    const SQL = `
          SELECT 
            OrderTransactions.OrderTransactionID, 
            OrderHeaders.OrderDateTime, 
            OrderTransactions.MenuItemID, 
            OrderHeaders.EmployeeID, 
            OrderHeaders.OrderStatus, 
            MenuItems.MenuItemText, 
            MenuItems.DefaultUnitPrice, 
            OrderTransactions.OrderID, 
            EmployeeFiles.FirstName, 
            EmployeeFiles.LastName, 
            MenuItems.ItemDelComp 
          FROM 
            EmployeeFiles 
            INNER JOIN (OrderHeaders 
              INNER JOIN (MenuItems 
                INNER JOIN OrderTransactions 
                ON MenuItems.MenuItemID = OrderTransactions.MenuItemID) 
              ON OrderHeaders.OrderID = OrderTransactions.OrderID) 
            ON EmployeeFiles.EmployeeID = OrderHeaders.EmployeeID 
            WHERE OrderHeaders.OrderDateTime >= ${initime} AND OrderHeaders.OrderDateTime < ${finitime}`;
    let datamap = {};
    console.log("Executing SQL:", SQL);

    connection.query(SQL).on("done", function (data) {
      if (data && data.records) {
        let temdata = data.records;
        let profit = 0;
        if (temdata.length > 0) {
          temdata.forEach(function (record) {
            record.OrderDateTime = moment.utc(record.OrderDateTime).local().format('MM-DD HH:mm');
            if (!datamap[record.EmployeeID])
              datamap[record.EmployeeID] = { "name": '', "total": 0, "pay": 0, "list": [] };
            datamap[record.EmployeeID].list.push(record);
            datamap[record.EmployeeID].total += record.DefaultUnitPrice;
            datamap[record.EmployeeID].pay += record.ItemDelComp;
            datamap[record.EmployeeID].name = `${record.FirstName} ${record.LastName}`
            profit += record.DefaultUnitPrice - record.ItemDelComp;
          })
        }

        res.json({ code: 1, profit: profit, response: datamap });
      } else {
        res.json({ code: 1, response: [] });
      }
    });
    // res.json({ code: 1, response: [] });
  } catch (err) {
    console.error("Error fetching report:", err);
    res.status(500).json({ code: 1, response: 0 });
  }
});

const PORT = 8088;
app.use(express.static(__dirname + "/public")).listen(PORT, function () {
  console.log(`Server running on port ${PORT}`);
});

function ordenes() {

}
