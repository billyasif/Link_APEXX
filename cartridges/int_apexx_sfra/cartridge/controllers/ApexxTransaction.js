'use strict';
var server = require('server');
var OrderMgr = require('dw/order/OrderMgr');
var Resource = require('dw/web/Resource');
var URLUtils = require('dw/web/URLUtils');
var StringUtils = require('dw/util/StringUtils');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');
var objectHelper = require('*/cartridge/scripts/util/objectHelper');
var commonHelper = require('*/cartridge/scripts/util/commonHelper');
var appPreference = require('~/cartridge/config/appPreference')();
var apexxServiceWrapper = require('*/cartridge/scripts/service/apexxServiceWrapper');
var OrderApi = require('dw/order/Order');

var Transaction = require('dw/system/Transaction');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var dworder = require('dw/order');
var PaymentMgr = require('dw/order/PaymentMgr');

server.post(
		'HostedUpdateTransaction', 
		function (req, res, next) {
			
			var PaymentMgr = require('dw/order/PaymentMgr');
			var PT = require('dw/order/PaymentTransaction');
			var Money = require('dw/value/Money');
			var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
			var httpParameterMap = request.httpParameterMap;

			var orderId=httpParameterMap.merchant_reference.getValue(); //'00001257';//
			var order = OrderMgr.getOrder(orderId);
			
			try{
			
			var paymentInstruments = order.getPaymentInstruments();
		    var apexxPaymentInstrument = null;
		    var isError;
		    var paymentInstrument =  order.getPaymentInstruments()[0];
			var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.paymentMethod).paymentProcessor;
            var saleTransactionRequestData = objectHelper.createSaleRequestObject(order,paymentInstrument,paymentProcessor);

		    var iterator = paymentInstruments.iterator();
		    var paymentInstrument = null;
		    var authAmount = commonHelper.intToFloat(httpParameterMap.amount.value);
	        var paidAmount = commonHelper.intToFloat(httpParameterMap.amount.value);
	    	var status = httpParameterMap.status.value || '';

		    //res.json({test:saleTransactionRequestData.three_ds.three_ds_required});return next();
		    while (iterator.hasNext()) {
		        paymentInstrument = iterator.next();
		        var paymentProcessorId = dworder.PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor().getID();
		        if (paymentProcessorId === 'APEXX_HOSTED') {
		            apexxPaymentInstrument = paymentInstrument.getPaymentTransaction();
		            break;
		        }
		    }
		    var paymentProcessor = PaymentMgr.getPaymentMethod(paymentProcessorId).paymentProcessor;
		    
		    if(httpParameterMap.status.value!='CAPTURED' && httpParameterMap.status.value!='AUTHORISED'){

		    	updateTransactionHistory(status, order, httpParameterMap, authAmount);
		    	Transaction.wrap(function() {
		    		order.custom.isApexxOrder = true;
		    		order.setPaymentStatus(order.PAYMENT_STATUS_NOTPAID);
		    		apexxPaymentInstrument.setPaymentProcessor(paymentProcessor);
		    	});
		     isError = true;	
		    }else{
		    	updateTransactionHistory(status, order, httpParameterMap, authAmount);
             }
		    
            //res.json({ordr:order.orderNo});
			Transaction.wrap(function() {
				//PAYMENT_STATUS_PAID
				apexxPaymentInstrument.setTransactionID(httpParameterMap._id.value);
				apexxPaymentInstrument.setPaymentProcessor(paymentProcessor);
				apexxPaymentInstrument.setAmount(new Money(authAmount, order.getCurrencyCode()));
				order.custom.isApexxOrder = true;
				order.custom.apexxTransactionStatus = httpParameterMap.status.value;
				order.custom.apexxTransactionID = httpParameterMap._id.value;
				order.custom.apexxMerchantReference = httpParameterMap.merchant_reference.value;
				order.custom.apexxAuthAmount = httpParameterMap.authorization_code.value ? parseFloat(authAmount) : 0.0;
				if(saleTransactionRequestData.capture_now){
					order.custom.apexxTransactionType = 'CAPTURE';
				}else{
					order.custom.apexxTransactionType =	'AUTH';
				}
			
				if (httpParameterMap.status.value == 'CAPTURED') {
					apexxPaymentInstrument.setType(PT.TYPE_CAPTURE);
					order.setPaymentStatus(order.PAYMENT_STATUS_PAID);
					order.custom.apexxPaidAmount = authAmount;
	            	order.custom.apexxCaptureAmount = paidAmount;
	            	COHelpers.sendConfirmationEmail(order, req.locale.id);
	            }else if (httpParameterMap.status.value == 'AUTHORISED') {
	            	apexxPaymentInstrument.setType(PT.TYPE_AUTH);
	            	order.setPaymentStatus(order.PAYMENT_STATUS_NOTPAID);
	            	COHelpers.sendConfirmationEmail(order, req.locale.id);
	            }
				var threeDSecureInfo = saleTransactionRequestData.three_ds;
				paymentInstrument.custom.apexx3dSecureStatus = threeDSecureInfo ? threeDSecureInfo.three_ds_required : null;
				paymentInstrument.custom.apexxHostedPaymentPageResponseUrl = "";

				
				if(httpParameterMap.card_number.value){
					
					paymentInstrument.custom.apexxCreditCardLastDigits = httpParameterMap.card_number.value;
					paymentInstrument.setCreditCardNumber(httpParameterMap.card_number.value);
	
					paymentInstrument.custom.apexxCardExpirationMonth = parseInt(httpParameterMap.expiry_month.value, 10);
					paymentInstrument.setCreditCardExpirationMonth(parseInt(httpParameterMap.expiry_month.value, 10));
		                
					paymentInstrument.custom.apexxCardExpirationYear = parseInt(httpParameterMap.expiry_year.value, 10);
					paymentInstrument.setCreditCardExpirationYear(parseInt(httpParameterMap.expiry_year.value, 10));
					
					paymentInstrument.custom.apexxAuthorizationCode = httpParameterMap.authorization_code.value;
				}
	     
			});
			res.render('apexx/closepopup.isml', {
				isError:isError,
				isAuth:order.custom.apexxAuthAmount,
				orderNo:order.orderNo,
				orderToken:order.orderToken
	        });
			} catch (e) {
				res.render('apexx/closepopup.isml', {
					isError:true,
		        });
		    }

		     return next();
		  }
		);

server.post(
		'DirectCreditUpdateThreeDs', 
		function (req, res, next) {
			var orderId = req.querystring.orderId;
			var order = OrderMgr.getOrder(orderId);
			var authAmount;
			var transactionId = req.querystring.transactionId;
			var payload = paramsToJson(transactionId);
			var endPoint = appPreference.SERVICE_HTTP_DIRECT_AUTH;
			var isError;
			if(payload){
				var response = apexxServiceWrapper.makeServiceCall('POST',endPoint, payload);
				if(response.object.id && response.object.status ==='AUTHORISED' || response.object.status ==='CAPTURED'){
					
				}else if (response.object.status ==='DECLINED' || response.object.status ==='FAILED'){
					Transaction.wrap(function (){ OrderMgr.failOrder(order, true); });
					authAmount = response.object.amount;
					var paymentInstrument = order.getPaymentInstruments()[0];
					//saveCustomerCreditCard(paymentInstrument, response.object);
	                saveTransactionData(order, paymentInstrument, payload, response.object);
				}
			}
	
			res.render('apexx/closepopup.isml', {
				isError:isError,
				isAuth:authAmount,
				orderNo:orderId,
				orderToken:order.orderToken
	        });
	        return next();
	});

function updateTransactionHistory(action, order, httpParameterMap, amount) {
    var transactionHistory = order.custom.apexxTransactionHistory || '[]';
    var merchant_reference = httpParameterMap.merchant_reference.value || '';
    var ID = httpParameterMap._id.value || '';
    var status = httpParameterMap.status.value || '';

    transactionHistory = JSON.parse(transactionHistory);
   
    transactionHistory.push({
        id: ID,
        merchant_reference: merchant_reference,
        status: status,
        type: order.custom.apexxTransactionType,
        amount: amount,
        action: action,
        date: (new Date()).getTime()
    });
  
    Transaction.wrap(function() {
        order.custom.apexxTransactionHistory = JSON.stringify(transactionHistory); // eslint-disable-line no-param-reassign
    });
}

/**
 * Save used credit cart as customers payment method
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument Current payment instrument
 * @param {Object} saleTransactionResponseData Response data from API call
 */
function saveCustomerCreditCard(paymentInstrument, saleTransactionResponseData) {
    var customerWallet = customer.getProfile().getWallet();
    var card = {
        expirationMonth: saleTransactionResponseData.card.expiry_month,
        expirationYear: saleTransactionResponseData.card.expiry_year,
        number: saleTransactionResponseData.card.card_number,
        type: paymentInstrument.creditCardType,
        owner: paymentInstrument.creditCardHolder,
        paymentMethodToken: createToken()
    };

    Transaction.wrap(function() {
        var customerPaymentInstrument = customerWallet.createPaymentInstrument(paymentInstrument.paymentMethod);
        customerPaymentInstrument.setCreditCardHolder(card.owner);
        customerPaymentInstrument.setCreditCardNumber(card.number);
        customerPaymentInstrument.setCreditCardExpirationMonth(parseInt(card.expirationMonth, 10));
        customerPaymentInstrument.setCreditCardExpirationYear(parseInt(card.expirationYear, 10));
        customerPaymentInstrument.setCreditCardType(card.type);
        customerPaymentInstrument.custom.braintreePaymentMethodToken = card.paymentMethodToken;
    });
}
/**
 * Save result of the success sale transaction
 * @param {dw.order.Order} orderRecord Current order
 * @param {dw.order.OrderPaymentInstrument} paymentInstrumentRecord Current payment instrument
 * @param {Object} responseTransaction Response data from API call
 */
function saveTransactionData(orderRecord, paymentInstrumentRecord, saleTransactionRequestData, responseTransaction) {
    var PT = require('dw/order/PaymentTransaction');
    var PaymentMgr = require('dw/order/PaymentMgr');
    var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrumentRecord.paymentMethod).paymentProcessor;
    var authAmount = parseFloat(responseTransaction.amount);
    var paidAmount = parseFloat(responseTransaction.amount);
    var paymentTransaction = paymentInstrumentRecord.getPaymentTransaction();
    var customer = orderRecord.getCustomer();
    var Money = require('dw/value/Money');

    Transaction.wrap(function() {
    if (responseTransaction.capture_now == true) { 
    	orderRecord.custom.apexxTransactionType = "CAPTURE";
    	orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_PAID);
        orderRecord.custom.apexxPaidAmount = authAmount ;
        orderRecord.custom.apexxCaptureAmount = paidAmount;

    } else {
    	orderRecord.custom.apexxTransactionType = "AUTH";
        orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
    }

        paymentTransaction.setTransactionID(responseTransaction._id);
        paymentTransaction.setPaymentProcessor(paymentProcessor);
        paymentTransaction.setAmount(new Money(responseTransaction.amount, orderRecord.getCurrencyCode()));

        orderRecord.custom.isApexxOrder = true;
        orderRecord.custom.apexxTransactionStatus = responseTransaction.status;
        orderRecord.custom.apexxAuthAmount = responseTransaction.authorization_code ? authAmount : 0.0;
        orderRecord.custom.apexxTransactionID = responseTransaction._id;
        orderRecord.custom.apexxMerchantReference = responseTransaction.merchant_reference;
        commonHelper.updateTransactionHistory(responseTransaction.status,orderRecord,responseTransaction,responseTransaction.amount);

        
        var threeDSecureInfo = responseTransaction.three_ds;
        paymentInstrumentRecord.custom.apexx3dSecureStatus = threeDSecureInfo ? threeDSecureInfo.three_ds_required : null;
        paymentInstrumentRecord.custom.apexxAuthorizationCode = responseTransaction.authorization_code || '';


        if (responseTransaction.status === 'AUTHORISED') {
            paymentTransaction.setType(PT.TYPE_AUTH);
        }

        if (responseTransaction.card) {

            paymentInstrumentRecord.custom.apexxPaymentMethodToken = responseTransaction.card.token || '';
            paymentInstrumentRecord.custom.apexxCreditCardType = responseTransaction.card_brand;
            paymentInstrumentRecord.custom.apexxCreditCardLastDigits = responseTransaction.card.card_number;
            paymentInstrumentRecord.setCreditCardNumber(responseTransaction.card.card_number);
            paymentInstrumentRecord.custom.apexxCardExpirationMonth = parseInt(responseTransaction.card.expiry_month, 10);
            paymentInstrumentRecord.setCreditCardExpirationMonth(parseInt(responseTransaction.card.expiry_month, 10));
            paymentInstrumentRecord.custom.apexxCardExpirationYear = parseInt(responseTransaction.card.expiry_year, 10);
            paymentInstrumentRecord.setCreditCardExpirationYear(parseInt(responseTransaction.card.expiry_year, 10));
        }

    });
}

/**
 * Creates a token. This should be replaced by utilizing a tokenization provider
 * @returns {string} a token
 */
function createToken() {
    return Math.random().toString(36).substr(2);
}

/**
 * Render JSON from GET-url parameters
 */
function paramsToJson(transactionId) {
    var paramNames = request.httpParameterMap.getParameterNames();
    var data = {'_id':transactionId};
    for (var i = 0; i < paramNames.length; i++) {
        var name = paramNames[i];
        data[name] = request.httpParameterMap.get(name).getStringValue();
    }
    return data;
}
module.exports = server.exports();