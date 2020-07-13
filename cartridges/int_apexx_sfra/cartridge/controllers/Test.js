var server = require('server');
/* global dw request session customer */
const LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
const apexxServiceWrapper = require('*/cartridge/scripts/service/apexxServiceWrapper');

var OrderModel = require('*/cartridge/models/order');
const cardProcessor = require('*/cartridge/scripts/apexx/cardProcessor');
const hostedProcessor = require('*/cartridge/scripts/apexx/hostedProcessor');
const appPreference = require('*/cartridge/config/appPreference')();

var endPoint = appPreference.SERVICE_HTTP_PAYPAL;

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
//	var commonHelper = require('*/cartridge/scripts/util/commonHelper');
	var objectHelper = require('*/cartridge/scripts/util/objectHelper');
	var PaymentMgr = require('dw/order/PaymentMgr');
	var StringUtils = require('dw/util/StringUtils');
	var Calendar = require('dw/util/Calendar');

//	var BillingForm = server.forms.getForm('billing').creditCardFields;
//    var ObjectPaymentModel = commonHelper.convertFormToObject(BillingForm);
//    var objCard = objectHelper.ApexxCardObject(ObjectPaymentModel);
//	var saleTransactionRequestData = {
//		"organisation": "c7639f98175a4e3b95edf8afe096ff82",
//		"currency": "GBP",
//		"amount": 100,
//		"capture_now": false,
//		"card" : {
//	        "card_number" : "4543059999999982",
//	        "cvv" : "110",
//	        "expiry_month" : "12",
//	        "expiry_year" : "23",
//	        "token" : "" ,
//	        "create_token": "true"
//	    },
//	    "billing_address":{
//	       "first_name": "FIRSTNAME", 
//	       "last_name": "LASTNAME", 
//	       "email": "EMAIL@DOMAIN.COM", 
//	       "address": "76 Roseby Avenue", 
//	       "city": "Manchester", 
//	       "state": "Greater Manchester", 
//	       "postal_code": "637", 
//	       "country": "GB", 
//	     "phone":44123456789
//		},
//		"customer_ip": "192.168.1.1",
//		"dynamic_descriptor" : "Demo Merchant Test Account",
//		"merchant_reference" : Math.round(+new Date() / 1000),
//		"recurring_type": "first",
//		"user_agent": "Mozilla/5.0 (Windows; U; Windows NT 6.1; en-GB;rv:1.9.2.13) Gecko/20101203 Firefox/3.6.13 (.NET CLR 3.5.30729)",
//		
//		"three_ds":{
//		"three_ds_required": false
//		}
//	}
////    
////	
//
//  	var service = apexxServiceWrapper.apexxServiceDirectPay;
//	saleTransactionResponseData = apexxServiceWrapper.makeServiceCall(service,saleTransactionRequestData);
   var OrderMgr = require('dw/order/OrderMgr');

   var order  = OrderMgr.getOrder("00000069");
   var paymentInstruments = order.getPaymentInstruments()[0];
   
  // res.json({'payemnt':paymentInstruments.getPaymentMethod()});return next();
  // res.json(Object.keys(paymentInstruments));return next();
   //var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstruments.paymentMethod).paymentProcessor;
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
	res.json(objReq);return next();

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
