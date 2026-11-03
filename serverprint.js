var express = require('express'),
    bodyparser = require('body-parser'),
	printer = require('printer');




var app = express();

var ESC = "\u001B";
var GS = "\u001D";
var InitializePrinter = ESC + "@";
var BoldOn = ESC + "E" + "\u0001";
var BoldOff = ESC + "E" + "\0";
var DoubleOn = GS + "!" + "\u0011";  // 2x sized text (double-high + double-wide)
var DoubleOff = GS + "!" + "\0";


app.use(bodyparser.urlencoded({
    extended: false
}));
app.use(bodyparser.json());

app.get('/print', function(req, res) {
	var q=req.url.split('?');
	var q2=q[1].split('&');
	var q21=q2[0].split('=');
	var q22=q2[1].split('=');
	var text=BoldOff+decodeURIComponent(q21[1]);
	//text = text.replace(/nper/g, BoldOn + '5' + BoldOff);
	 
	//printZebra(InitializePrinter, decodeURIComponent(q22[1]));
	printZebra(text, decodeURIComponent(q22[1]));
	
  res.send("Message received.");
   res.end();

});

app.listen(1000, function() {

});
String.prototype.toBytes = function() {
        var arr = []
        for (var i=0; i < this.length; i++) {
            arr.push(this[i].charCodeAt(0))
        }
        return arr;
    }

   
//var printData = barcode_text.toBytes().concat([0x1b, 0x45, 0x01]);

function printZebra(barcode_text, printer_name) {
	//console.log("printed: " + barcode_text);
	 var printData = barcode_text;
	
	  try {
       printer.printDirect({
        data: new Buffer(printData),
        printer: printer_name,
        type: "RAW",
        success: function() {
            // console.log("printed: " + barcode_text);
        },
        error: function(err) {
           // console.log(err);
        }
    });
	
    } catch (err) {
        console.log('status: ' + err);
    }
	
	
 
	

}







