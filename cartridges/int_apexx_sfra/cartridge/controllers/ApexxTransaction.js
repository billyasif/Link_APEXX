'use strict';
var server = require('server');
var OrderMgr = require('dw/order/OrderMgr');
var Transaction = require('dw/system/Transaction');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var dworder = require('dw/order');
var PaymentMgr = require('dw/order/PaymentMgr');
var Money = require('dw/value/Money');

var cardProcessor = require('~/cartridge/scripts/apexx/cardProcessor');
var objectHelper = require('*/cartridge/scripts/util/objectHelper');
var commonHelper = require('*/cartridge/scripts/util/commonHelper');
var appPreference = require('~/cartridge/config/appPreference')();
var apexxServiceWrapper = require('*/cartridge/scripts/service/apexxServiceWrapper');
var PT = require('dw/order/PaymentTransaction');
var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var httpParameterMap = request.httpParameterMap;

var CONST = {
		STATUS_PROCESSING: 'Processing',
	    PENDING_ORDER_STATUS: 'PENDING',
	    BAD_RESPONSE:'BAD RESPONSE',
	    TYPE_AUTH:'AUTH',
	    TYPE_CAPTURE:'CAPTURE',
	    STATUS_CAPTURED:'CAPTURED',
	    STATUS_AUTHORISED:'AUTHORISED',
	    STATUS_DECLINED:'DECLINED',
	    STATUS_FAILED:'FAILED',
	    PAYMENT_METHOD_APEXX_HOSTED:'APEXX_HOSTED',
	    PAYMENT_METHOD_CREDIT_CARD:'CREDIT_CARD',
	    PAYMENT_METHOD_APEXX_CLIENT_SIDE:'APEXX_CLIENT_SIDE'
	};


server.post(
    'HostedUpdateTransaction',
    function(req, res, next) {
        var orderId = httpParameterMap.merchant_reference.getValue(); //'00001257';//
        var transactionType = appPreference.Apexx_Hosted_Capture == true  ? CONST.TYPE_CAPTURE : CONST.TYPE_AUTH;

        var order = OrderMgr.getOrder(orderId);
        //try {
        if(order){
            var paymentInstrumentsOBJ = order.getPaymentInstruments()[0];
            var paymentTransaction = paymentInstrumentsOBJ.getPaymentTransaction();
            var paymentInstruments = order.getPaymentInstruments();
            var apexxPaymentInstrument = null;
            var isError;
            var paymentInstrument = order.getPaymentInstruments()[0];
            var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.paymentMethod).paymentProcessor;
            var saleTransactionRequestData = objectHelper.createSaleRequestObject(order, paymentInstrument, paymentProcessor);

            var iterator = paymentInstruments.iterator();
            var paymentInstrument = null;
            var authAmount = commonHelper.intToFloat(httpParameterMap.amount.value);
            var paidAmount = commonHelper.intToFloat(httpParameterMap.amount.value);
            var status = httpParameterMap.status.value || "";
            
            while (iterator.hasNext()) {
                paymentInstrument = iterator.next();
                var paymentProcessorId = dworder.PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor().getID();
                if (paymentProcessorId === CONST.PAYMENT_METHOD_APEXX_HOSTED) {
                    apexxPaymentInstrument = paymentInstrument.getPaymentTransaction();
                    break;
                }
            }
            var paymentProcessor = PaymentMgr.getPaymentMethod(paymentProcessorId).paymentProcessor;

            if (httpParameterMap.status.value != CONST.STATUS_CAPTURED && httpParameterMap.status.value != CONST.STATUS_AUTHORISED) {

                Transaction.wrap(function() {
                    order.custom.isApexxOrder = true;
                    order.setPaymentStatus(order.PAYMENT_STATUS_NOTPAID);
                    apexxPaymentInstrument.setPaymentProcessor(paymentProcessor);
                });
                updateTransactionHistory(status, order, httpParameterMap, authAmount,transactionType);

                isError = true;
            } else {
                updateTransactionHistory(status, order, httpParameterMap, authAmount,transactionType);
            }

            Transaction.wrap(function() {
                //PAYMENT_STATUS_PAID
                apexxPaymentInstrument.setTransactionID(httpParameterMap._id.value);
                apexxPaymentInstrument.setPaymentProcessor(paymentProcessor);
                
                if(authAmount){
                   apexxPaymentInstrument.setAmount(new Money(authAmount, order.getCurrencyCode()));
                }
                order.custom.isApexxOrder = true;
                order.custom.apexxTransactionID = httpParameterMap._id.value;
                order.custom.apexxMerchantReference = httpParameterMap.merchant_reference.value;
                order.custom.apexxAuthAmount = httpParameterMap.authorization_code.value ? parseFloat(authAmount) : 0.0;
                if (httpParameterMap.status.value == CONST.STATUS_CAPTURED) {
                    order.setPaymentStatus(order.PAYMENT_STATUS_PAID);
                    order.custom.apexxPaidAmount = authAmount;
                    paymentInstrumentsOBJ.custom.apexxReasonCode = httpParameterMap.reason_message.value || "";
                    order.custom.apexxCaptureAmount = paidAmount;
                    COHelpers.sendConfirmationEmail(order, req.locale.id);
                    order.custom.apexxTransactionStatus = (status === CONST.STATUS_CAPTURED) ? CONST.STATUS_PROCESSING : status;

                } else if (httpParameterMap.status.value == CONST.STATUS_AUTHORISED) {
                    order.setPaymentStatus(order.PAYMENT_STATUS_NOTPAID);
                    paymentInstrumentsOBJ.custom.apexxReasonCode = httpParameterMap.reason_message.value || "";
                    COHelpers.sendConfirmationEmail(order, req.locale.id);
                    order.custom.apexxTransactionStatus = status;

                }else if (httpParameterMap.status.value == CONST.STATUS_DECLINED) {
                	order.setPaymentStatus(order.PAYMENT_STATUS_NOTPAID);
                	paymentInstrumentsOBJ.custom.apexxReasonCode = httpParameterMap.reason_message.value || "";
                    order.custom.apexxTransactionStatus = status;

                }else if (httpParameterMap.status.value == CONST.STATUS_FAILED) {
                	order.setPaymentStatus(order.PAYMENT_STATUS_NOTPAID);
                	paymentInstrumentsOBJ.custom.apexxReasonCode = httpParameterMap.reason_message.value || "";
                    order.custom.apexxTransactionStatus = status;
                }
                
                
	                var responseTransaction = paramsToJson('Transaction');
	                if (!status ) {
	                	order.custom.isApexxOrder = true;
	                	order.setPaymentStatus(order.PAYMENT_STATUS_NOTPAID);
	                	order.custom.apexxTransactionType = transactionType;
	                    order.custom.apexxTransactionStatus = CONST.PENDING_ORDER_STATUS;
	                    if(responseTransaction._id){
	                        paymentTransaction.setTransactionID(responseTransaction._id);
	                   	}
	                    if(responseTransaction.message){
	                    	paymentInstrumentsOBJ.custom.apexxReasonCode  = responseTransaction.message || "";
	                    }
	                    return;
	                }
               
                

            	order.custom.apexxTransactionType = transactionType;
                var threeDSecureInfo = saleTransactionRequestData.three_ds;
                paymentInstrument.custom.apexx3dSecureStatus = threeDSecureInfo ? threeDSecureInfo.three_ds_required : null;
                paymentInstrument.custom.apexxHostedPaymentPageResponseUrl = "";


                if (httpParameterMap.card_number.value) {

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
                isError: isError,
                isAuth: order.custom.apexxAuthAmount,
                orderNo: order.orderNo,
                orderToken: order.orderToken
            });
        }
            else{
	        	  res.render('apexx/closepopup.isml', {
	        		  isError: true
		            });
	          }   
//        } catch (e) {
//            res.render('apexx/closepopup.isml', {
//                isError: true,
//            });
//        }

        return next();
    });

server.post(
	    'DirectCreditUpdateThreeDs',
	    function(req, res, next) {
         // res.json();return next();
	       try {
		    	var isError,isAuth,orderNo,orderToken;
	            var orderId = req.querystring.orderId;
	            var order = OrderMgr.getOrder(orderId);
	            if(order){
	            var authAmount;
	            var transactionId = req.querystring.transactionId;
	            var method = req.querystring.method;
	            var transactionType = (appPreference.Apexx_Hosted_Capture)  ? CONST.TYPE_CAPTURE : CONST.TYPE_AUTH;

	            var threeDsResponse = paramsToJson(transactionId);
	            var payLoad = {};
	            payLoad._id = ('_id' in threeDsResponse) ? threeDsResponse._id : "";
	            
	            if(!payLoad._id){
		           
	            	payLoad._id = ('id' in threeDsResponse) ? threeDsResponse.id : "";

	            }
	            
	            payLoad.paRes = ('PaRes' in threeDsResponse) ? threeDsResponse.PaRes : "";
	            var endPoint = appPreference.SERVICE_HTTP_DIRECT_AUTH;
	            var paymentInstrument = order.getPaymentInstruments()[0];
	            var status;
	            var paymentTransaction = paymentInstrument.getPaymentTransaction();

	            var isError;
	            if (payLoad) {
	                var response = apexxServiceWrapper.makeServiceCall('POST', endPoint, payLoad);
	                //res.json(response);
	                //return next();

	                if (response.object._id && response.object.status === CONST.STATUS_AUTHORISED || response.object.status === CONST.STATUS_CAPTURED) {
	                    var paymentInstrument = order.getPaymentInstruments()[0];
	                    var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.paymentMethod).paymentProcessor;
	                    cardProcessor.saveTransactionData(order, paymentInstrument, response.object);

	                    if (paymentInstrument.custom.apexxSaveCreditCard == true) {

	                        cardProcessor.saveCustomerCreditCard(paymentInstrument, response.object);

	                    }

	                } else if (response.object.status === CONST.STATUS_DECLINED || response.object.status === CONST.STATUS_FAILED) {


	                    authAmount = response.object.amount;

	                    var paymentInstrument = order.getPaymentInstruments()[0];
	                    cardProcessor.saveTransactionData(order, paymentInstrument, response.object);
	                }
	            }
	            
	            status = response.object.status;
	            Transaction.wrap(function() {
		            var responseTransaction = paramsToJson('Transaction');
		            if (!status ) {
	                	order.setPaymentStatus(order.PAYMENT_STATUS_NOTPAID);
	                	order.custom.apexxTransactionType = transactionType;
	                	order.custom.apexxTransactionStatus = CONST.STATUS_FAILED;
	                	order.custom.isApexxOrder = true;
	                    if(responseTransaction._id){
	                        paymentTransaction.setTransactionID(responseTransaction._id);
	                   	}
	                    if(responseTransaction.message){
	                        paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.message || "";
	                    }
	                    return;
	                }
	            }); 
	            
	            res.render('apexx/closepopup.isml', {
	            	    isError: isError,
		                isAuth: authAmount,
		                orderNo: orderId,
		                orderToken: order.orderToken
	            });
	          }else{
	        	  res.render('apexx/closepopup.isml', {
	        		  isError: true
		            });
	          }   

	        } catch (e) {
	            res.render('apexx/closepopup.isml', {
	                isError: true
	            });
	        }
	        return next();
	    });


server.post(
	    'PayPal',
	    function(req, res, next) {
	        //try {
	            var reason_code = httpParameterMap.reason_code.value || "";
	            var amount = httpParameterMap.amount.value / 100;
	            var merchant_reference = httpParameterMap.merchant_reference.value;
	            var _id = httpParameterMap._id.value;
	            var status = httpParameterMap.status.value;

	            var orderRecord = OrderMgr.searchOrder('custom.apexxTransactionID = {0}', _id);
	            var transactionType = appPreference.Apexx_PayPal_Capture == true ? CONST.TYPE_CAPTURE : CONST.TYPE_AUTH;

	            var isError;

	            if (_id && orderRecord) {
	                if (status && _id) {
	                    var paymentInstrument = orderRecord.getPaymentInstruments()[0];
	                    var paymentTransaction = paymentInstrument.getPaymentTransaction();
	                    var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.paymentMethod).paymentProcessor;

	                    Transaction.wrap(function() {
	                        OrderMgr.failOrder(orderRecord, true);
	                    });
	                    Transaction.wrap(function() {
	                        if (status === CONST.STATUS_CAPTURED) {
	                            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_PAID);
	                            orderRecord.custom.apexxPaidAmount = amount;
	                            orderRecord.custom.apexxCaptureAmount = amount;
	                            paymentTransaction.setType(PT.TYPE_CAPTURE);


	                        } else if (status === CONST.STATUS_AUTHORISED) {
	                            paymentTransaction.setType(PT.TYPE_AUTH);
	                            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);

	                        } else if (status === CONST.STATUS_DECLINED) {
	                            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
	                            paymentInstrumentRecord.custom.apexxReasonCode = reason_code || "";

	                        } else if (responseTransaction.status === CONST.STATUS_FAILED) {
	                            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
	                            paymentInstrumentRecord.custom.apexxReasonCode = reason_code || "";

	                        }
	                        
	                        Transaction.wrap(function() { 
		                        var responseTransaction = paramsToJson('Transaction');
		                        if (!status) {
		                            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
		                            orderRecord.custom.apexxTransactionType = transactionType;
		                            orderRecord.custom.apexxTransactionStatus = CONST.STATUS_FAILED;
		                            orderRecord.custom.isApexxOrder = true;
		                            if(responseTransaction._id){
		                                paymentTransaction.setTransactionID(responseTransaction._id);
		                           	}
		                            if(responseTransaction.message){
		                                paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.message || "";
		                            }
		                            return;
		                        }
	                        });  
	                        
	                        orderRecord.custom.apexxTransactionType = transactionType;

	                        paymentTransaction.setTransactionID(_id);
	                        paymentTransaction.setPaymentProcessor(paymentProcessor);
	                        if (amount) {
	                            paymentTransaction.setAmount(new Money(amount, orderRecord.getCurrencyCode()));
	                        }
	                        orderRecord.custom.apexxTransactionStatus = (httpParameterMap.status.value === CONST.STATUS_CAPTURED ) ? CONST.STATUS_PROCESSING : httpParameterMap.status.value;

	                        orderRecord.custom.isApexxOrder = true;
	                        orderRecord.custom.apexxAuthAmount = amount;
	                        orderRecord.custom.apexxTransactionID = _id;
	                        orderRecord.custom.apexxMerchantReference = merchant_reference;
	                        updateTransactionHistory(status, orderRecord, httpParameterMap, amount,transactionType);

	                    });

	                }
	                res.render('apexx/closepopup.isml', {
		                isError: isError,
		                isAuth: amount,
		                orderNo: orderRecord.orderNo,
		                orderToken: orderRecord.orderToken
		            });
	            }else{
	            	 res.render('apexx/closepopup.isml', {
	 	                isError: true,
	 	            });
	            }

	           
//	        } catch (e) {
//	            res.render('apexx/closepopup.isml', {
//	                isError: true,
//	            });
//	        }
	        return next();
	    });


function updateTransactionHistory(action, order, httpParameterMap, amount,transactionType) {
    var transactionHistory = order.custom.apexxTransactionHistory || '[]';
    var merchant_reference = httpParameterMap.merchant_reference.value || "";
    var status = httpParameterMap.status.value ||'';
    var ID = httpParameterMap._id.value || "";
    
    var status = (status === CONST.STATUS_CAPTURED) ? CONST.STATUS_PROCESSING : (status) ? status : CONST.PENDING_ORDER_STATUS;
    var transactionType = transactionType || CONST.BAD_RESPONSE;

    transactionHistory = JSON.parse(transactionHistory);

    transactionHistory.push({
        id: ID,
        merchant_reference: merchant_reference,
        status: status,
        type: transactionType,
        amount: amount,
        action: action,
        date: (new Date()).getTime()
    });

    Transaction.wrap(function() {
        order.custom.apexxTransactionHistory = JSON.stringify(transactionHistory); // eslint-disable-line no-param-reassign
    });
}


/**
 * Render JSON from GET-url parameters
 */
function paramsToJson(transactionId) {
    var paramNames = request.httpParameterMap.getParameterNames();
    var data = {
        '_id': transactionId
    };
    for (var i = 0; i < paramNames.length; i++) {
        var name = paramNames[i];
        data[name] = request.httpParameterMap.get(name).getStringValue();
    }
    return data;
}
module.exports = server.exports();