var fs = require('fs'),
	printer_helper = require('./node_printer.node');

var text;
var ESC = "\u001B";
var GS = "\u001D";
var InitializePrinter = ESC + "@";
var BoldOn = ESC + "E" + "\u0001";
var BoldOff = ESC + "E" + "\0";
var DoubleOn = GS + "!" + "\u0011";  // 2x sized text (double-high + double-wide)
var DoubleOff = GS + "!" + "\0";
var templateg='';
        fs.readFile('recibotemplate.txt', 'utf8', function(err, contents) {
            templateg = contents;
			     console.log(contents);
        


           templateg = templateg.replace(/mesero/g, BoldOn + 'Luis' + BoldOff);
			templateg = templateg.replace(/Dine In/g, BoldOn + 'Dine In' + BoldOff);
          // templateg = templateg.replace(/ids/g, stdata.StationID);
          // templateg = templateg.replace(/day/g, dtoday);
          // templateg = templateg.replace(/time/g, dtime);
          // templateg = templateg.replace(/oid/g, orderid);
          // templateg = templateg.replace(/tid/g, pedido.h.DineInTableText);




//printZebra("Here is some normal text.", 'POS');
printZebra(templateg, 'POS');
//printZebra(BoldOn + templateg + BoldOff, 'POS');
//printZebra(DoubleOn + "Here is some large text." + DoubleOff, 'POS');

	});
 
function printZebra(barcode_text, printer_name) {
	console.log("printed: " + barcode_text);
	 var printData = barcode_text;
	
	  try {
       printDirect({
        data: new Buffer(printData),
        printer: printer_name,
        type: "RAW",
        success: function() {
             console.log("printed: " + barcode_text);
        },
        error: function(err) {
            console.log(err);
        }
    });
	
    } catch (err) {
        console.log('status: ' + err);
    }
	
	
 
	

}


function printDirect(parameters){
    var data = parameters
        , printer
        , docname
        , type
        , options
        , success
        , error;

    if(arguments.length==1){
        //TODO: check parameters type
        //if (typeof parameters )
        data = parameters.data;
        printer = parameters.printer;
        docname = parameters.docname;
        type = parameters.type;
        options = parameters.options||{};
        success = parameters.success;
        error = parameters.error;
    }else{
        printer = arguments[1];
        type = arguments[2];
        docname = arguments[3];
        options = arguments[4];
        success = arguments[5];
        error = arguments[6];
    }

    if(!type){
        type = "RAW";
    }

    // Set default printer name
    if(!printer) {
        printer = getDefaultPrinterName();
    }

    type = type.toUpperCase();

    if(!docname){
        docname = "node print job";
    }

    if (!options){
        options = {};
    }

    //TODO: check parameters type
    if(printer_helper.printDirect){// call C++ binding
        try{
            var res = printer_helper.printDirect(data, printer, docname, type, options);
            if(res){
                success(res);
            }else{
                error(Error("Something wrong in printDirect"));
            }
        }catch (e){
            error(e);
        }
    }else{
        error("Not supported");
    }
}








