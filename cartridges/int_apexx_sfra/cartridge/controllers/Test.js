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
var Encoding = require('dw/crypto/Encoding');
var messageDigest = require('dw/crypto/MessageDigest');
var DIGEST_SHA_256 = require('dw/crypto/MessageDigest').DIGEST_SHA_256;
var Bytes = require('dw/util/Bytes');
var OrderMgr = require('dw/order/OrderMgr');
var Transaction = require('dw/system/Transaction');
var commonHelper = require('*/cartridge/scripts/util/commonHelper');
var objectHelper = require('*/cartridge/scripts/util/objectHelper');
var PaymentMgr = require('dw/order/PaymentMgr');
var StringUtils = require('dw/util/StringUtils');
var Calendar = require('dw/util/Calendar');
var StringUtils = require('dw/util/StringUtils');

var dworder = require('dw/order');
var ApexxConstants = new Object();
 ApexxConstants.TRANSACTION_TYPE_POST = '         POST           ';

 ApexxConstants.TRANSACTION_TYPE_GET = '         GET           ';


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
	

	// var CustomerPaymentInstrument =
	// require('dw/customer/CustomerPaymentInstrument');
    // var customerWallet =
	// customer.getProfile().getWallet().getPaymentInstruments()['0'].getCreditCardToken();

// var BillingForm = server.forms.getForm('billing').creditCardFields;
    // var ObjectPaymentModel = commonHelper.convertFormToObject(BillingForm);
    // var objCard = objectHelper.ApexxCardObject(ObjectPaymentModel);
	
// var service = apexxServiceWrapper.apexxServiceDirectPay;
// saleTransactionResponseData =
// apexxServiceWrapper.makeServiceCall(service,saleTransactionRequestData);

   var order  = OrderMgr.getOrder("00019803");
   var paymentInstruments = order.getPaymentInstruments()[0];
   var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstruments.paymentMethod).paymentProcessor;
   var currentBasket = BasketMgr.getCurrentBasket();
   
   // var objReq =
	// objectHelper.createSaleRequestObject(order,paymentInstruments,paymentProcessor);
   // var ObjectBilling = objectHelper.ApexxBillToObject(order, true);
   var PaymentInstrument = require('dw/order/PaymentInstrument');

   // res.json({'toccken':Object.keys(order.adjustedShippingTotalTax) });
   // var paymentInstruments =
	// order.getPaymentInstruments(PaymentInstrument.METHOD_DW_APPLE_PAY);
// var amount = 10;
// var grossAmount = order.totalGrossPrice.getValue();
// var giftCertTotal = new Money(4.00, order.currencyCode);
// var orderTotal = order.totalGrossPrice;
// var amountOpen = orderTotal.subtract(giftCertTotal);
// var paymentInstrument = order.getPaymentInstruments()[0];
// var remainCaptureAmount = grossAmount - amount ;
// var orderTotalGrossPrice = order.getTotalGrossPrice().value;
// var amount = 16.99;
// var grossAmount = order.totalGrossPrice.value;
// var remainCaptureAmount = grossAmount - amount ;
// var payload = {};
// var paymentMethod = order.getPaymentInstruments()[0].getPaymentMethod();
// var paymentMethod = order.getPaymentInstruments()[0].getPaymentMethod();
// if(remainCaptureAmount <= 0){
// payload.final_capture = true;
// }else if(remainCaptureAmount >= 0){
// payload.final_capture = false;
// }
// res.json({'InvoiceNo':order.getCapturedAmount()});
// var transactionHistory = order.custom.apexxTransactionHistory || '[]';
// //transactionHistory = JSON.parse(transactionHistory);
// transactionHistory = getCaptureReference(transactionHistory);
 // var payload =
	// {"amount":4,"endPointUrl":"1e128000f7d64425909cbfd8285da813","capture_reference":"00017407","final_capture":false};
   
   
   
//   
// var Money = require('dw/value/Money');
// var Currency = order.getCurrencyCode();
// var grossAmount = order.totalGrossPrice.value;
// var grossAmount = new Money(grossAmount, Currency);
// var captureAmount = new Money(order.custom.apexxPaidAmount,Currency);
// var reaminAmount = grossAmount.subtract(captureAmount).value;
// var paidAmount = new Money(order.custom.apexxPaidAmount,Currency);
//
//   
// var transactionStatus;
// var Currency = order.getCurrencyCode();
// var grossAmount = order.totalGrossPrice.value;
// var grossAmount = new Money(grossAmount, Currency);
// var captureAmount = new Money(order.custom.apexxPaidAmount,Currency);
// var reaminAmount = grossAmount.subtract(captureAmount).value;
// var paidAmount = new Money(order.custom.apexxPaidAmount,Currency);


// if((grossAmount.equals(captureAmount)) === true){
// transactionStatus = apexxConstants.STATUS_PROCESSING;
// }
//   
// if(paidAmount.value){
//   	
// transactionStatus = 'dsdsdsdsdsdsd';
// }
 
   
   
  // var method ="POST";
  // var result = apexxServiceWrapperBM.makeServiceCall(method,endPoint,
	// payload)
   // res.json({'response':appPreference.Apexx_Hosted_Iframe_Width});return
	// next();
   // res.json({'paidAmt':logger.info('Hi Hello how')});return next();
   // var logger = require('dw/system/Logger').getLogger('ApexxWebHook');
	// logger.info("Webhook is being called");
	 // res.json({'order':grossAmount.compareTo(captureAmount) });return
		// next();
	// res.json({'order':captureAmount.value,'gross':grossAmount.value });
// var refund = apexxConstants.TRANSACTION_TYPE_REFUND;
// var signature = new dw.crypto.Encoding.toURI('kk');
// var encodedCustomerEmail = Encoding.toURI('ab@gmail.com');
// var sha = messageDigest(DIGEST_SHA_256);
// var stringToHash = "dsdsds"+"sdsdsds";
// var encodedKey = Encoding.toHex(sha.digestBytes(new Bytes(stringToHash)));

	 // res.json({'user':request.httpUserAgent});return next();

   // res.json({'shipment':objReq,'request':Object.keys(order)});return next();

  // res.json(Object.keys(paymentInstruments));return next();
//
// var ret = cardProcessor.authorize("00001108", paymentInstruments,
// paymentProcessor);
    // var paymentInstrument = "";
// var paymentProcessor = "";
   var Currency = order.getCurrencyCode();

   var refundAmount = new Money(100, Currency);
   var partialRefundArray = {
		   product_id:'1',
           group_id:'1',
           gross_unit_price:refundAmount.value,
           item_description:'Test',
           quantity:order.productQuantityTotal
		}
  partialRefundArray = [partialRefundArray];
   
   
   
   
    var objReq = objectHelper.createSaleRequestObject(order,paymentInstruments,paymentProcessor);
	 //res.json({'obj':paymentProcessor.getID() });return next();

    // var saleTransactionResponseData =
	// apexxServiceWrapper.makeServiceCall('POST',endPoint, objReq);

    // var BasketMgr = require('dw/order/BasketMgr');
    // var currentBasket = BasketMgr.getCurrentBasket();
    // if(currentBasket){
      // BasketMgr.deleteBasket(currentBasket);
    // }
	// parseInt("78.99");
	// Object.keys(res);
	// var authAmount = parseFloat("78.99");
	// var kk = authAmount;
   // var amount = '100';
	// res.json({'response':Object.keys(hostedProcessor)});return next();

    // var amount = '100';
    // var resp =
	// hostedProcessor.authorize("00000081",paymentInstruments,paymentProcessor);
	// res.json(objReq);return next();

	// res.json(saleTransactionResponseData);return next();

	// res.json({'kk':date});return next();


    res.json({'type': StringUtils.formatCalendar(new Calendar(new Date()), "y-m-d")});
	return next();
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
    this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line
															// no-shadow
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

/**
 * 
 * @param order
 * @param paymentInstrument
 * @returns
 */
function createSaleRequestObject(order, paymentInstrument, paymentProcessor) {
    var ObjectBilling = ApexxBillToObject(order, true);
    var ObjectCard = ApexxCardObject(paymentInstrument);
    var billingAddress = empty(ObjectBilling.success) ? "" : ObjectBilling.billing_address;
    
    var cardObject = empty(ObjectCard.success) ? "" : ObjectCard.card;
    var cardToken = paymentInstrument.creditCardToken ? paymentInstrument.creditCardToken : "";
    
    
    const paymentReference = order.orderNo;
    const amount = paymentInstrument.paymentTransaction.amount.value;
    var paymentProcessorId = dworder.PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor().getID();
    var orderCurrency = order.getCurrencyCode();

    if (paymentProcessorId === 'APEXX_HOSTED') {

        var commonBillingObject = {};
        // commonBillingObject.account = appPreference.Apexx_Hosted_Account_Id;
        
        commonBillingObject.organisation = appPreference.ORGANISATION;
        commonBillingObject.currency = orderCurrency;
        commonBillingObject.amount = amount;
        commonBillingObject.capture_now = appPreference.Apexx_Hosted_Capture ? true : false;
        commonBillingObject.billing_address = billingAddress;
        commonBillingObject.dynamic_descriptor = appPreference.Apexx_Hosted_Dynamic_Descriptor;
        commonBillingObject.merchant_reference = paymentReference;
        commonBillingObject.user_agent = appPreference.USER_AGENT;
        commonBillingObject.webhook_transaction_update = appPreference.WEB_HOOK_TRANSACTION_UPDATE;
        commonBillingObject.three_ds = {};
        commonBillingObject.three_ds.three_ds_required = appPreference.Apexx_hosted_3ds_true_false ? true : false;
        
        commonBillingObject.transaction_css_template = appPreference.Apexx_hosted_transaction_css_template;
        commonBillingObject.return_url = appPreference.RETURN_URL_HOSTED;
        commonBillingObject.transaction_type = appPreference.Apexx_Hosted_Recurring_Type;
        commonBillingObject.locale = appPreference.Apexx_Locale;

        commonBillingObject.show_custom_fields = {};
        commonBillingObject.show_custom_fields.card_holder_name = appPreference.Apexx_hosted_custom_fields_card_holder_name;
        commonBillingObject.show_custom_fields.address = appPreference.Apexx_hosted_custom_fields_address;
        commonBillingObject.show_custom_fields.address_required = appPreference.Apexx_hosted_custom_fields_address_required;
        commonBillingObject.show_custom_fields.display_horizontal = appPreference.Apexx_hosted_custom_fields_display_horizontal;

        commonBillingObject.show_custom_labels = {};
        commonBillingObject.show_custom_labels.expiry_date = appPreference.Apexx_hosted_show_custom_labels_expiry_date;
        commonBillingObject.show_custom_labels.cvv = appPreference.Apexx_hosted_show_custom_labels_cvv;

        commonBillingObject.show_order_summary = appPreference.Apexx_hosted_show_order_summary;

        commonBillingObject.transaction_css_template = appPreference.Apexx_hosted_transaction_css_template;

    }

    if (paymentProcessorId === 'APEXX_CREDIT') {
        var commonBillingObject = {};
        
       // commonBillingObject.account =
		// appPreference.Apexx_Direct_Credit_Account_Id;

        commonBillingObject.organisation = appPreference.ORGANISATION;
       
        commonBillingObject.currency = orderCurrency;
        commonBillingObject.amount = amount;
        commonBillingObject.capture_now = appPreference.Apexx_Direct_Capture ? true : false;
        commonBillingObject.billing_address = billingAddress;
        commonBillingObject.dynamic_descriptor = appPreference.Apexx_DirectPay_Dynamic_Descriptor;
        commonBillingObject.merchant_reference = paymentReference;
        commonBillingObject.user_agent = appPreference.USER_AGENT;
        commonBillingObject.webhook_transaction_update = appPreference.WEB_HOOK_TRANSACTION_UPDATE;
        
        if(cardToken){
        	commonBillingObject.card = {};
            commonBillingObject.three_ds = {}
            if(appPreference.Apexx_Direct_Recurring_Type == "first"){
               commonBillingObject.card.cvv = cardObject.cvv;
            }
            commonBillingObject.card.token = cardToken;
            commonBillingObject.three_ds.three_ds_required = false


        }else{
            
        	 commonBillingObject.card = cardObject;
        	 commonBillingObject.three_ds = {};
             commonBillingObject.three_ds.three_ds_required = appPreference.Apexx_Direct_Three_Ds ? true : false;
        }
        
        commonBillingObject.recurring_type = appPreference.Apexx_Direct_Recurring_Type;
        commonBillingObject.customer_ip = appPreference.CUSTOMER_IP;
       


    }


    if (paymentProcessorId === 'APEXX_PayPal') {
        var commonBillingObject = {};
        
       // commonBillingObject.account = appPreference.Apexx_PayPal_Account_Id;

        commonBillingObject.organisation = appPreference.ORGANISATION;
        commonBillingObject.capture_now = appPreference.Apexx_PayPal_Capture ? true :false;
        commonBillingObject.customer_ip = appPreference.CUSTOMER_IP;
        commonBillingObject.recurring_type = appPreference.Apexx_Paypal_Recurring_Type;
        commonBillingObject.amount = amount;
        commonBillingObject.currency = orderCurrency,
        commonBillingObject.user_agent = appPreference.USER_AGENT;
        commonBillingObject.locale = appPreference.Apexx_Locale;
        commonBillingObject.dynamic_descriptor = appPreference.Apexx_PayPal_Dynamic_Descriptor;
        commonBillingObject.merchant_reference = paymentReference;
        commonBillingObject.payment_product_type = appPreference.Apexx_PayPal_payment_product_type;
        commonBillingObject.shopper_interaction = appPreference.Apexx_PayPal_shopper_interaction;
        commonBillingObject.webhook_transaction_update = appPreference.WEB_HOOK_TRANSACTION_UPDATE;




        commonBillingObject.paypal = {};
        commonBillingObject.paypal.brand_name = appPreference.Apexx_PayPal_brand;
        commonBillingObject.paypal.customer_paypal_id = appPreference.Apexx_PayPal_customer_id;
        commonBillingObject.paypal.tax_id = appPreference.Apexx_PayPal_tax_id;
        commonBillingObject.paypal.tax_id_type = appPreference.Apexx_PayPal_tax_id_type;
        commonBillingObject.paypal.order = {};
        commonBillingObject.paypal.order.invoice_number = order.getInvoiceNo();
        commonBillingObject.paypal.order.total_tax_amount = '0';
        commonBillingObject.paypal.order.description = appPreference.Apexx_PayPal_Dynamic_Descriptor;
        commonBillingObject.paypal.order.items = new Array();
        
        var totalQuantities = 0;  
        var productIds =  new Array();
        if (order.getAllLineItems().length > 0) {

            for each(product in order.getAllLineItems()) {

                if ('productID' in product) {
                	
                	totalQuantities += product.quantityValue;
                	productIds.push(product.productID);
                }
            }
        }
        var grossPricePerProduct = ((amount * 100)/totalQuantities);
        
        if (order.getAllLineItems().length > 0) {
            
            for each(product in order.getAllLineItems()) {
            	
                if ('productID' in product && productIds.length > 1) {
                	
                    var items = {};
                    items.item_name = product.productName;
                    items.unit_amount = grossPricePerProduct * product.quantityValue;
                    items.currency = orderCurrency;
                    items.tax_currency = orderCurrency;
                    items.tax_amount = '0';
                    items.quantity = product.quantityValue;
                    items.item_description = product.getProductName();
                    items.sku = product.productID;

                    items.category = "PHYSICAL_GOODS";
                    commonBillingObject.paypal.order.items.push(items);
                }
                if ('productID' in product && productIds.length == 1) {
                	// return amount * 100;
                    var items = {};
                    items.item_name = product.productName;
                    items.unit_amount = amount * 100 ;
                    items.currency = orderCurrency;
                    items.tax_currency = orderCurrency;
                    items.tax_amount = '0';
                    items.quantity = product.quantityValue;
                    items.item_description = product.getProductName();
                    items.sku = product.productID;

                    items.category = "PHYSICAL_GOODS";
                    commonBillingObject.paypal.order.items.push(items);
                }
            }
        }



        commonBillingObject.paypal.redirection_parameters = {};
        commonBillingObject.paypal.redirection_parameters.return_url = appPreference.RETURN_URL_PAY_PayPal;

        commonBillingObject.customer = {};
        commonBillingObject.customer.first_name = order.billingAddress.getFirstName();
        commonBillingObject.customer.last_name = order.billingAddress.getLastName();
        commonBillingObject.customer.email = order.getCustomerEmail();
        commonBillingObject.customer.phone = order.billingAddress.getPhone();
        // commonBillingObject.customer.date_of_birth = "1994-08-11";
        commonBillingObject.customer.address = {};
        commonBillingObject.customer.address.address = order.billingAddress.getAddress1() + ' ' + order.billingAddress.getAddress2();
        commonBillingObject.customer.address.city = order.billingAddress.getCity();
        commonBillingObject.customer.address.state = order.billingAddress.getStateCode();
        commonBillingObject.customer.address.postal_code = order.billingAddress.getPostalCode();
        commonBillingObject.customer.address.country = billingAddress.country;



        commonBillingObject.delivery_customer = {};
        commonBillingObject.delivery_customer.first_name = billingAddress.first_name;
        commonBillingObject.delivery_customer.last_name = billingAddress.last_name;
        commonBillingObject.delivery_customer.address = {};
        commonBillingObject.delivery_customer.address.address = billingAddress.address;
        commonBillingObject.delivery_customer.address.city = billingAddress.city;
        commonBillingObject.delivery_customer.address.state = billingAddress.state;
        commonBillingObject.delivery_customer.address.postal_code = billingAddress.postal_code;
        commonBillingObject.delivery_customer.address.country = billingAddress.country;

    }
    
    if (paymentProcessorId === 'APEXX_GooglePay') {

        var commonBillingObject = {};
        commonBillingObject.account = appPreference.Apexx_GooglePay_Account_Id;

        // commonBillingObject.organisation = appPreference.ORGANISATION;
        // AllcommonBillingObject.currency = orderCurrency;

        commonBillingObject.amount = amount;
        commonBillingObject.capture_now = appPreference.Apexx_GooglePay_Capture ? true :false;
        commonBillingObject.card = {};
        commonBillingObject.card.googlepay = {};
        commonBillingObject.card.googlepay.cryptogram = paymentInstrument.custom.apexxCryptogram;
        commonBillingObject.card.googlepay.expiry_month = paymentInstrument.custom.apexxExpiryMonth;
        commonBillingObject.card.googlepay.expiry_year = paymentInstrument.custom.apexxExpiryYear;
        commonBillingObject.card.googlepay.dpan = paymentInstrument.custom.apexxDpan;
        commonBillingObject.card.googlepay.eci = paymentInstrument.custom.apexxEci;
        commonBillingObject.customer = {};
        commonBillingObject.customer.customer_id =  '';
        commonBillingObject.customer.last_name= billingAddress.last_name;
        commonBillingObject.customer.postal_code = billingAddress.postal_code;
        commonBillingObject.customer.account_number =  '';
        commonBillingObject.customer_ip = appPreference.CUSTOMER_IP;
        commonBillingObject.dynamic_descriptor = appPreference.Apexx_GooglePay_Dynamic_Descriptor;
        commonBillingObject.merchant_reference = paymentReference;
        commonBillingObject.recurring_type = appPreference.Apexx_GooglePay_Recurring_Type;
        commonBillingObject.user_agent = appPreference.USER_AGENT;
        commonBillingObject.webhook_transaction_update = appPreference.WEB_HOOK_TRANSACTION_UPDATE;
        var fraud_predictions = {};
        fraud_predictions.error_message = appPreference.Apexx_GooglePay_Fraud_Predictions_Error_Message;
        fraud_predictions.rec = appPreference.Apexx_GooglePay_Fraud_Predictions_Rec;
        fraud_predictions.rules_triggered = [];
        fraud_predictions.score = '0';
        commonBillingObject.fraud_predictions = [fraud_predictions];

        commonBillingObject.billing_address = billingAddress;
        commonBillingObject.shopper_interaction = appPreference.Apexx_GooglePay_Shopper_Interaction;
        // commonBillingObject.three_ds = {};
        // commonBillingObject.three_ds.three_ds_required =
		// appPreference.Apexx_GooglePay_Three_Ds_Yes_No ? true :false;

    }
    
    if (paymentProcessorId === 'APEXX_CLIENT_SIDE') {
	 var commonBillingObject = {};

     // commonBillingObject.account =
		// appPreference.Apexx_Client_Side_Account_Id;

     commonBillingObject.organisation = appPreference.Apexx_Org_Key;

      commonBillingObject.currency = orderCurrency;
      commonBillingObject.amount = amount;
      commonBillingObject.capture_now = appPreference.Apexx_Client_Side_Capture ? true :false;
      
      commonBillingObject.card = {};

      commonBillingObject.card.encrypted_data = paymentInstrument.custom.encryptedData;

      commonBillingObject.billing_address = billingAddress;
      commonBillingObject.dynamic_descriptor = appPreference.Apexx_Client_Side_Dynamic_Descriptor;
      commonBillingObject.merchant_reference = paymentReference;
      commonBillingObject.user_agent = appPreference.USER_AGENT;
      commonBillingObject.webhook_transaction_update = appPreference.WEB_HOOK_TRANSACTION_UPDATE;
      commonBillingObject.three_ds = {};
      commonBillingObject.three_ds.three_ds_required = appPreference.Apexx_Client_Three_Ds ? true : false;
      commonBillingObject.user_agent = appPreference.USER_AGENT;
	  commonBillingObject.customer_ip = appPreference.CUSTOMER_IP;

	  commonBillingObject.recurring_type = appPreference.Apexx_Client_Side_Recurring_Type;
	  commonBillingObject.customer_ip = appPreference.CUSTOMER_IP;
	    
    }
    
  if (paymentProcessorId === 'APEXX_AfterPay') {
  var commonBillingObject = {};
  
  
  commonBillingObject.account = commonHelper.getAfterPayAccountId(order);
  commonBillingObject.currency = "",
  commonBillingObject.merchant_reference = paymentReference;
  commonBillingObject.capture_now = appPreference.Apexx_AfterPay_Capture;
  commonBillingObject.customer_ip = appPreference.CUSTOMER_IP;
  commonBillingObject.dynamic_descriptor = appPreference.Apexx_AfterPay_Dynamic_Descriptor;
  commonBillingObject.user_agent = appPreference.USER_AGENT;
  commonBillingObject.shopper_interaction = appPreference.Apexx_AfterPay_Shopper_Interaction;
  commonBillingObject.webhook_transaction_update = appPreference.WEB_HOOK_TRANSACTION_UPDATE;


  

  commonBillingObject.billing_address = billingAddress;
  // commonBillingObject.billing_address.country = "DE";

  
  
  
  
  
  
  commonBillingObject.afterpay  = {}
  commonBillingObject.afterpay.payment_type  =  "Invoice";
  commonBillingObject.afterpay.gross_amount  =  order.totalGrossPrice.multiply(100).value;
  commonBillingObject.afterpay.net_amount  =    order.totalNetPrice.multiply(100).value;

  
  var totalQuantities = 0;  
  var productIds =  new Array();
  if (order.getAllLineItems().length > 0) {

      for each(product in order.getAllLineItems()) {

          if ('productID' in product) {
          	
          	totalQuantities += product.quantityValue;
          	productIds.push(product.productID);
          }
      }
  }
  
  var itemsArr = new Array();
  
  var grossPricePerProduct = ((amount * 100)/totalQuantities);
  
  if (order.getAllLineItems().length > 0) {
      
      for each(product in order.getAllLineItems()) {
      	
          if ('productID' in product && productIds.length > 1) {

        	  // var net_price = product.netPrice.multiply(100).value;
        	  var net_price = product.adjustedNetPrice.multiply(100).value;
        	  var gross_price = product.adjustedGrossPrice.multiply(100).value;
              var taxValue =   product.adjustedTax.multiply(100).value;
              var vatPercentage =  product.adjustedTax.multiply(100).divide(net_price).multiply(100).value;   
        	  
              var items = {};
              items.product_id = product.productID;
              items.group_id =  "1";
              items.item_description = product.productName;
              items.vat_amount = taxValue ;
              items.net_unit_price = net_price;
              items.gross_unit_price = gross_price;
              items.quantity = 1;
              items.vat_percent = vatPercentage;
              items.additional_information = product.productName;
              itemsArr.push(items);

          }
          if ('productID' in product && productIds.length == 1) {

        		  
              
              // var net_price = product.netPrice.multiply(100).value;
              var net_price = product.adjustedNetPrice.multiply(100).value;
        	  var gross_price = product.adjustedGrossPrice.multiply(100).value;
              var taxValue =   product.adjustedTax.multiply(100).value;
              var vatPercentage =  product.adjustedTax.multiply(100).divide(net_price).multiply(100).value;   

              
        	  
              var items = {};
              items.product_id = product.productID;
              items.group_id =  "1";
              items.item_description = product.productName;
              items.vat_amount = taxValue ;
              items.net_unit_price = net_price;
              items.gross_unit_price = gross_price;
              items.quantity = 1;
              items.vat_percent = vatPercentage;
              items.additional_information = product.productName;

              itemsArr.push(items);

          }
      }
  }

  
  
  if(order.shippingTotalGrossPrice.value){
	  
	  var GrossshippingPrice = order.shippingTotalGrossPrice.multiply(100).value;
	  var netUnitShipPrice = order.getShippingTotalNetPrice().multiply(100).value;
      var taxValue =   order.shippingTotalTax.multiply(100).value;
      var vatPercentage =  order.shippingTotalTax.multiply(100).divide(netUnitShipPrice).multiply(100).value;   

	  
	  
	  var items = {};
	  items.product_id = "shipping";
	  items.group_id =  "1";
	  items.item_description = "shipping";
	  items.vat_amount = taxValue;
	  items.net_unit_price = netUnitShipPrice;
	  items.gross_unit_price = GrossshippingPrice;
	  items.quantity = 1;
	  items.vat_percent =vatPercentage;
	  items.product_image_url = "https://assets.asosservices.com/storesa/images/flags/gb.png";
	  items.product_url = "https://www.asos.com/asos-4505/asos-4505-golf-high-neck-t-shirt-with-quick-dry-in-black/prd/9367200?clr=black&colourWayId=15038018&SearchQuery=4505%20golf";
	  items.additional_information = "test";
	  itemsArr.push(items);
  
  }
  
  
  commonBillingObject.afterpay.items  =  itemsArr;

  var customer = {};
  customer.salutation = "Mr";
  customer.customer_identification_number = "800119-3989";
  customer.first_name = order.billingAddress.getFirstName();
  customer.last_name = order.billingAddress.getLastName();
  customer.email = order.getCustomerEmail();
  customer.date_of_birth = "1994-08-11";
  customer.phone = order.billingAddress.getPhone();
  customer.customer_number = "124";
  customer.type = "Person";
  commonBillingObject.afterpay.customer = customer;


  delivery_customer = {};
  delivery_customer.type = "Person";
  delivery_customer.salutation = "Miss";
  delivery_customer.first_name = billingAddress.first_name;
  delivery_customer.last_name = billingAddress.last_name;
  delivery_customer.address = billingAddress.address;
  delivery_customer.city = billingAddress.city;
  delivery_customer.postal_code = billingAddress.postal_code;
  delivery_customer.country = billingAddress.country;
  // delivery_customer.country = "DE";


  delivery_customer.phone = order.billingAddress.getPhone();
  commonBillingObject.afterpay.delivery_customer = delivery_customer;


}
    
    return commonBillingObject;

}


function ApexxBillToObject(order, ReadFromOrder) {
    var BillTo_Object = appPreference.BILLING_OBJECT;

    var billToObject = new BillTo_Object();
    if (ReadFromOrder) {
        var address = "";
        var countryCode = "";
        var billingAddress = order.billingAddress;

        if (!empty(billingAddress) && !empty(order)) {
            /*
			 * This if condition checks if billingAddress.address1 is present
			 * only for V.Me create the billToObject using billingAddress else
			 * it will create billToObject using shippingAddress
			 */
            if (!empty(billingAddress)) {
                billToObject.setFirstName(billingAddress.firstName);
                billToObject.setLastName(billingAddress.lastName);
                address = billingAddress.address1 + ' ' + billingAddress.address2;
                billToObject.setAddress(address);
                billToObject.setCity(billingAddress.city);
                billToObject.setState(billingAddress.stateCode);
                billToObject.setPostalCode(billingAddress.postalCode);
                countryCode = commonHelper.isEmpty(billingAddress.countryCode.value) ? billingAddress.countryCode.value : "";
                billToObject.setCountry(countryCode);
                billToObject.setPhoneNumber(billingAddress.phone);
                billToObject.setEmail(order.customerEmail);
            }
        }
    }

    return {
        success: true,
        billing_address: billToObject
    };
}

/**
 * For Card object
 * 
 * @param {Object}
 *            paymentInstrument
 * @returns
 */

function ApexxCardObject(paymentInstrument) {
    var server = require('server');
    var Card_Object = appPreference.CARD_OBJECT;
    var cardObject = new Card_Object();
    var month = "";
    var year = "";

    var BillingForm = server.forms.getForm('billing').creditCardFields;
    var ObjectPaymentModel = commonHelper.convertFormToObject(BillingForm);
    if (ObjectPaymentModel.cardType && ObjectPaymentModel.cardNumber && ObjectPaymentModel.securityCode) {
        cardObject.setCardNumber(ObjectPaymentModel.cardNumber);
        month = ('0' + ObjectPaymentModel.expirationMonth).slice(-2);
        cardObject.setExpirationMonth(month);
        year = ObjectPaymentModel.expirationYear;
        cardObject.setExpirationYear(year.toString().slice(-2));
        cardObject.setCVVNumber(ObjectPaymentModel.securityCode);
        cardObject.setToken("");
        cardObject.setCreateToken(appPreference.Apexx_Direct_Create_Token);
        cardObject.setSaveCard(ObjectPaymentModel.saveCard)
    }
    return {
        success: true,
        card: cardObject
    };

}


/**
 * Get Request IP Address
 */
function GetIPAddress() {
    return request.httpHeaders['x-is-remote_addr'];
}

module.exports = server.exports();
