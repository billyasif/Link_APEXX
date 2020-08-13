var server = require('server');
/* global dw request session customer */
const LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
const apexxServiceWrapper = require('*/cartridge/scripts/service/apexxServiceWrapper');
const dwSession = require("dw/system/Session");
var OrderModel = require('*/cartridge/models/order');
const cardProcessor = require('*/cartridge/scripts/apexx/cardProcessor');
const hostedProcessor = require('*/cartridge/scripts/apexx/hostedProcessor');
const paypalProcessor = require('*/cartridge/scripts/apexx/payPalProcessor');
const objSite = require("dw/system/Site");
const appPreference = require('*/cartridge/config/appPreference')();
var BasketMgr = require('dw/order/BasketMgr');
var Money = require('dw/value/Money');
const apexxServiceWrapperBM = require('./apexxServiceWrapperBMTemp');
var logger = require('dw/system/Logger');
var endPoint = "apexx.https.capture";
var apexxConstants = require('*/cartridge/scripts/util/apexxConstants');

var Transaction = require('dw/system/Transaction');


server.get('Product', function (req, res, next) {
    var newFactory = require('*/cartridge/scripts/factories/product');
    res.json({ product: newFactory.get({ pid: req.querystring.pid, pview: req.querystring.pview }) });
    next();
});

server.get('ChildProduct', function (req, res, next) {
	var ProductMgr = require('dw/catalog/ProductMgr');
    var productObject = ProductMgr.getProduct(req.querystring.pid);
    var productIds = {};
    var allVariants = productObject.getVariationModel().getVariants();
     
    if(allVariants.length > 0){
    	var i=0;
    	for each(product in allVariants ) {
    		productIds[i] = product.ID;
    		i++;
		}
    }
    
    res.json({ childProduct:productIds});
    next();
});


server.get('NewGrid', function (req, res, next) {
    var newFactory = require('*/cartridge/scripts/factories/product');
    var products = [
        '25696638', '25593800', '25642296', '25642436', '25771342', '25589408', '25592479', '25591426', '25503603', '25593727', '25688632', '25720424', '25591911', '25593518', '25688443', '25795715', '25565616', '25744206', '25696630', '25591704', '25503585', '25592581', '25642181', '25697212',
        '78916783', '91736743', '44736828', '69309284', '21736758', '86736887', '83536828', '82916781', '25686364', '25686544', '22416787', '34536828', '73910432', '73910532', '25585429', '56736828', '72516759', '25604455', '25686395', '25604524', '25686571', '11736753', '42946931', '82516743'
    ];
    var productModels = products.map(function (product) {
        return newFactory.get({ pid: product, pview: 'tile' });
    });
    res.json({ products: productModels });
    next();
});

server.get('Form', function (req, res, next) {
    var form = server.forms.getForm('address');
    res.render('form.isml', { form: form });
    next();
});

function GetIPAddress() {
    return request.httpHeaders['x-is-remote_addr'];
}

server.get('API',function(req,res,next){
	var commonHelper = require('*/cartridge/scripts/util/commonHelper');
	var objectHelper = require('*/cartridge/scripts/util/objectHelper');
	var PaymentMgr = require('dw/order/PaymentMgr');
	var StringUtils = require('dw/util/StringUtils');
	var Calendar = require('dw/util/Calendar');
	//var CustomerPaymentInstrument = require('dw/customer/CustomerPaymentInstrument');
    //var customerWallet = customer.getProfile().getWallet().getPaymentInstruments()['0'].getCreditCardToken();

//	var BillingForm = server.forms.getForm('billing').creditCardFields;
    //var ObjectPaymentModel = commonHelper.convertFormToObject(BillingForm);
    //var objCard = objectHelper.ApexxCardObject(ObjectPaymentModel);
	
//  var service = apexxServiceWrapper.apexxServiceDirectPay;
//	saleTransactionResponseData = apexxServiceWrapper.makeServiceCall(service,saleTransactionRequestData);
   var OrderMgr = require('dw/order/OrderMgr');
   var order  = OrderMgr.getOrder("00017611");
   var paymentInstruments = order.getPaymentInstruments()[0];
   var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstruments.paymentMethod).paymentProcessor;
   var currentBasket = BasketMgr.getCurrentBasket();

   //var objReq = objectHelper.createSaleRequestObject(order,paymentInstruments,paymentProcessor);
   //var ObjectBilling = objectHelper.ApexxBillToObject(order, true);
   var PaymentInstrument = require('dw/order/PaymentInstrument');

   
   //res.json({'toccken':Object.keys(order.adjustedShippingTotalTax) });
   //var paymentInstruments = order.getPaymentInstruments(PaymentInstrument.METHOD_DW_APPLE_PAY);
//   var amount = 10;
//   var grossAmount = order.totalGrossPrice.getValue();
//   var giftCertTotal = new Money(4.00, order.currencyCode);
//   var orderTotal = order.totalGrossPrice;
//   var amountOpen = orderTotal.subtract(giftCertTotal);
//   var paymentInstrument = order.getPaymentInstruments()[0];
//   var remainCaptureAmount = grossAmount - amount ;
//   var orderTotalGrossPrice = order.getTotalGrossPrice().value;
//   var amount = 16.99;
//   var grossAmount = order.totalGrossPrice.value;
//   var remainCaptureAmount = grossAmount - amount ;
//    var payload = {}; 
//    var paymentMethod = order.getPaymentInstruments()[0].getPaymentMethod();
//    var paymentMethod = order.getPaymentInstruments()[0].getPaymentMethod();
//   if(remainCaptureAmount <= 0){
// 	  payload.final_capture = true;
//   }else if(remainCaptureAmount >= 0){
// 	  payload.final_capture = false;
//   }
//   res.json({'InvoiceNo':order.getCapturedAmount()});
//   var transactionHistory = order.custom.apexxTransactionHistory || '[]';
//   //transactionHistory = JSON.parse(transactionHistory);
//   transactionHistory = getCaptureReference(transactionHistory);
   var payload = {"amount":4,"endPointUrl":"1e128000f7d64425909cbfd8285da813","capture_reference":"00017407","final_capture":false};
   
   
   
   
   var Money = require('dw/value/Money');
   var Currency = order.getCurrencyCode();
   var grossAmount = order.totalGrossPrice.value;
   var grossAmount = new Money(grossAmount, Currency);
   var captureAmount = new Money(order.custom.apexxPaidAmount,Currency);
   var reaminAmount = grossAmount.subtract(captureAmount).value;
   var paidAmount = new Money(order.custom.apexxPaidAmount,Currency);

   
   var transactionStatus;
   var Currency = order.getCurrencyCode();
   var grossAmount = order.totalGrossPrice.value;
   var grossAmount = new Money(grossAmount, Currency);
   var captureAmount = new Money(order.custom.apexxPaidAmount,Currency);
   var reaminAmount = grossAmount.subtract(captureAmount).value;
   var paidAmount = new Money(order.custom.apexxPaidAmount,Currency);


//   if((grossAmount.equals(captureAmount)) === true){
//   	transactionStatus = apexxConstants.STATUS_PROCESSING;
//   }
   
   if(paidAmount.value){
   	
   	transactionStatus = 'dsdsdsdsdsdsd';
   }
 
   
   
  // var method ="POST";
  // var result = apexxServiceWrapperBM.makeServiceCall(method,endPoint, payload)
   //res.json({'response':appPreference.Apexx_Hosted_Iframe_Width});return next();
   //res.json({'paidAmt':logger.info('Hi Hello how')});return next();
   //var logger = require('dw/system/Logger').getLogger('ApexxWebHook');
	// logger.info("Webhook is being called");
	 //res.json({'order':grossAmount.compareTo(captureAmount) });return next();
	// res.json({'order':captureAmount.value,'gross':grossAmount.value });
	 
	 res.json({'response':order.getInvoiceNo()});return next();

   //res.json({'shipment':objReq,'request':Object.keys(order)});return next();

  // res.json(Object.keys(paymentInstruments));return next();
//
//    var ret = cardProcessor.authorize("00001108", paymentInstruments, paymentProcessor);
    //    var paymentInstrument =  "";
//    var paymentProcessor = "";

    //var objReq = objectHelper.createSaleRequestObject(order,paymentInstruments,paymentProcessor);
    //var saleTransactionResponseData = apexxServiceWrapper.makeServiceCall('POST',endPoint, objReq);

    //var BasketMgr = require('dw/order/BasketMgr');
    //var currentBasket = BasketMgr.getCurrentBasket();
    //if(currentBasket){
      //BasketMgr.deleteBasket(currentBasket);
    //}
	//parseInt("78.99");
	//Object.keys(res);
	//var authAmount = parseFloat("78.99");
	//var kk = authAmount;
   // var  amount = '100';
	//res.json({'response':Object.keys(hostedProcessor)});return next();

    //var amount = '100';
    // var resp = hostedProcessor.authorize("00000081",paymentInstruments,paymentProcessor);
	//res.json(objReq);return next();

	//res.json(saleTransactionResponseData);return next();

	//res.json({'kk':date});return next();


   
});

var round = function (value) {
    var num = Math.round(value * 100) / 100;
    if (Math.abs(num) < 0.0001) {
        return 0.0;
    } else { // eslint-disable-line no-else-return
        return num;
    }
};


function unixTime(unixtime) {

    var u = new Date(unixtime*1000);

      return u.getUTCFullYear() +
        '-' + ('0' + u.getUTCMonth()).slice(-2) +
        '-' + ('0' + u.getUTCDate()).slice(-2) + 
        ' ' + ('0' + u.getUTCHours()).slice(-2) +
        ':' + ('0' + u.getUTCMinutes()).slice(-2) +
        ':' + ('0' + u.getUTCSeconds()).slice(-2) +
        '.' + (u.getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5) 
    };

function round(value) {
    var num = Math.round(value * 100) / 100;
    if (Math.abs(num) < 0.0001) {
        return 0.0;
    } else { // eslint-disable-line no-else-return
        return num;
    }
};

function getCaptureReference(transactionHistory){
	
	if(transactionHistory){
	    transactionHistory = JSON.parse(transactionHistory);

	    var count = new Array();
	    for(var i = 0; i < transactionHistory.length; i++) {
	    	if(transactionHistory[i].status === 'PAYMENT_STATUS_PARTPAID'){
	    		count.push('PAYMENT_STATUS_PARTPAID');
	    	}
	    }
	}
	return count.length;

}

function camelcase(str) {
    try {
        str = str.trim();
        str = str.toLowerCase();
        var res = new Array();
        const arrOfWords = str.split(" ");
        const arrOfWordsCased = [];
        if (arrOfWords.length > 1) {

            for (let i = 0; i < arrOfWords.length; i++) {
                var char;
                char = arrOfWords[i].split("");
                char[0] = char[0].toUpperCase();

                res.push(char.join(""));
            }
            return res.join(" ");
        } else {
            str =  str.charAt(0).toUpperCase() + str.slice(1)
            return str;
        }
    } catch (e) {
        return e.message;
    }
}

server.post('Submit', function (req, res, next) {
    this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
        var form = server.forms.getForm('address');
        if (!form.valid) {
            res.setStatusCode(500);
        }
        res.json({ form: server.forms.getForm('address') });
    });
    next();
});


var myFTPService = LocalServiceRegistry.createService("apexx.https.directpay", {
    mockExec : function(svc:FTPService, params) {
        return [
            { "name": "file1", "timestamp": new Date(2011, 02, 21)},
            { "name": "file2", "timestamp": new Date(2012, 02, 21)},
            { "name": "file3", "timestamp": new Date(2013, 02, 21)}
        ];
    },
    createRequest: function(svc:FTPService, params) {
        svc.setOperation("list", "/");
    },
    parseResponse : function(svc:FTPService, listOutput) {
        var x : Array = [];
        var resp : Array = listOutput;
        for(var i = 0; i < resp.length; i++) {
            var f = resp[i];
            x.push( { "name": f['name'], "timestamp": f['timestamp'] } );
        }
        return x;
    }
});



function saveTransactionData(orderRecord, paymentInstrumentRecord, responseTransaction) {
var PT = require('dw/order/PaymentTransaction');
var PaymentMgr = require('dw/order/PaymentMgr');

var paymentTransaction = paymentInstrumentRecord.getPaymentTransaction();
var customer = orderRecord.getCustomer();
var Money = require('dw/value/Money');

var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrumentRecord.paymentMethod).paymentProcessor;

Transaction.wrap(function () {
  paymentTransaction.setTransactionID(responseTransaction.id);
  paymentTransaction.setPaymentProcessor(paymentProcessor);
  paymentTransaction.setAmount(new Money(responseTransaction.amount, orderRecord.getCurrencyCode()));

  orderRecord.custom.isApexx = true;
  orderRecord.custom.apexxPaymentStatus = responseTransaction.status;

  var threeDSecureInfo = responseTransaction.three_ds;
  paymentInstrumentRecord.custom.apexx3dSecureStatus = threeDSecureInfo ? threeDSecureInfo.three_ds_required : null;


  if (responseTransaction.status === 'authorized') {
      paymentTransaction.setType(PT.TYPE_AUTH);
  } 

  if (responseTransaction.creditCard) {
      paymentInstrumentRecord.custom.apexxPaymentMethodToken = responseTransaction.card.token;
      paymentInstrumentRecord.setCreditCardNumber(responseTransaction.card_number);
      paymentInstrumentRecord.setCreditCardExpirationMonth(parseInt(responseTransaction.card.expiry_month, 10));
      paymentInstrumentRecord.setCreditCardExpirationYear(parseInt(responseTransaction.card.expiry_year, 10));
  }

 });
}

module.exports = server.exports();
