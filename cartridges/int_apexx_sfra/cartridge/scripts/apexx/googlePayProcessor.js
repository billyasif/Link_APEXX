'use strict';

var ApexxHelper = require('~/cartridge/scripts/util/apexxHelper');

var apexxServiceWrapper = require('*/cartridge/scripts/service/apexxServiceWrapper');
var OrderMgr = require('dw/order/OrderMgr');
var PaymentMgr = require('dw/order/PaymentMgr');
var Transaction = require('dw/system/Transaction');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var apexxHelper = require('*/cartridge/scripts/util/apexxHelper');
var apexxConstants = require('*/cartridge/scripts/util/apexxConstants');

var commonHelper = require('*/cartridge/scripts/util/commonHelper');
var objectHelper = require('*/cartridge/scripts/util/objectHelper');
var collections = require('*/cartridge/scripts/util/collections');
var appPreference = require('~/cartridge/config/appPreference')();
var Resource = require('dw/web/Resource');
var endPoint = appPreference.SERVICE_HTTP_DIRECT_PAY;
var prefs = ApexxHelper.getPrefs();

var CONST = {
    TRANSACTION_TYPE: (appPreference.Apexx_GooglePay_Capture) ? apexxConstants.TRANSACTION_TYPE_CAPTURE : apexxConstants.TRANSACTION_TYPE_AUTH
};

/**
 * Verifies that entered credit card information is a valid card. If the information is valid a
 * credit card payment instrument is created
 * @param {dw.order.Basket} basket Current users's basket
 * @param {Object} paymentInformation - the payment information
 * @return {Object} returns an error object
 */
function handle(basket, paymentInformation) {
    var currentBasket = basket;

    var cardErrors = {};
    var serverErrors = [];
    var error = false;
    Transaction.wrap(function() {
        var paymentInstruments = currentBasket.getPaymentInstruments();

        collections.forEach(paymentInstruments, function(item) {
            currentBasket.removePaymentInstrument(item);
        });

        var paymentInstrument = currentBasket.createPaymentInstrument(apexxConstants.APEXX_GOOGLEPAY_PAYMENT_METHOD, currentBasket.totalGrossPrice);

        paymentInstrument.custom.apexxCryptogram = request.httpParameterMap.cryptogram.value;
        paymentInstrument.custom.apexxExpiryMonth = request.httpParameterMap.expiry_month.value;
        paymentInstrument.custom.apexxExpiryYear = request.httpParameterMap.expiry_year.value;

        paymentInstrument.custom.apexxDpan = request.httpParameterMap.dpan.value;
        paymentInstrument.custom.apexxEci = request.httpParameterMap.eci.value;

        paymentInstrument.custom.apexxTransactionType = CONST.TRANSACTION_TYPE;
        paymentInstrument.custom.apexxRecurringType = appPreference.Apexx_GooglePay_Recurring_Type;
        //paymentInstrument.custom.apexx3dSecureStatus = appPreference.Apexx_GooglePay_Three_Ds_Yes_No;
    });


    return {
        fieldErrors: cardErrors,
        serverErrors: serverErrors,
        error: error
    };
}


/**
 * Authorize payment function
 * @param {string} orderNo Order Number
 * @param {Object} paymentInstr Instrument
 * @returns {Object} success object
 */
function authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var order = OrderMgr.getOrder(orderNumber);
    
    try {
        if (order.orderNo) {
        	Transaction.begin();
        	order.setPaymentStatus(order.PAYMENT_STATUS_NOTPAID);
        	order.setStatus(order.CONFIRMATION_STATUS_NOTCONFIRMED);
        	order.custom.apexxTransactionStatus = apexxConstants.PENDING_ORDER_STATUS;
        	order.custom.apexxTransactionType = CONST.TRANSACTION_TYPE;
        	order.custom.isApexxOrder = true;
          paymentInstrument.custom.apexxReasonCode = apexxConstants.REASON_IN_COMPLETE;
          Transaction.commit();
        }
    } catch (error) {
        var errorObj = {
            error: true,
            errorCode: error.name,
            errorMessage: error.message,
            errorResponse: error.message
        }
        return authorizeFailedFlow(order, paymentProcessor, paymentInstrument, errorObj);
    }
    
    //try {
    	if (paymentInstrument && paymentInstrument.getPaymentTransaction().getAmount().getValue() > 0) {
      
            var saleTransactionResponseData = null;
            var saleTransactionRequestData = null;

            saleTransactionRequestData = objectHelper.createSaleRequestObject(order, paymentInstrument, paymentProcessor);
            saleTransactionResponseData = apexxServiceWrapper.makeServiceCall('POST', endPoint, saleTransactionRequestData);

            saveTransactionData(order, paymentInstrument, saleTransactionResponseData.object);

        } else if (saleTransactionResponseData.ok == true || saleTransactionResponseData.ok == false && saleTransactionResponseData.object.status == apexxConstants.STATUS_DECLINED || saleTransactionResponseData.object.status == apexxConstants.STATUS_FAILED) {
            saveTransactionData(order, paymentInstrument, saleTransactionResponseData.object);
            return {
                authorized: true
            };

        } else {
            var errorObj = {
                error: true,
                errorCode: '',
                errorMessage: '',
                errorResponse: {
                    saleTransactionRequestData: saleTransactionRequestData,
                    saleTransactionResponseData: saleTransactionResponseData
                }
            }
            return authorizeFailedFlow(order, paymentProcessor, paymentInstrument, errorObj);
        }

        return {
            authorized: true
        };
//    } catch (error) {
//        var errorObj = {
//            error: true,
//            errorCode: error.name,
//            errorMessage: error.message,
//            errorResponse: error.message
//        }
//        return authorizeFailedFlow(order, paymentProcessor, paymentInstrument, errorObj);
//    }
}



/**
 * 
 * @param orderRecord
 * @param paymentProcessor
 * @param paymentInstrumentRecord
 * @param braintreeError
 * @returns
 */
function authorizeFailedFlow(orderRecord, paymentProcessor, paymentInstrumentRecord, apexxError) {
    var paymentTransaction = paymentInstrumentRecord.getPaymentTransaction();
    var customer = orderRecord.getCustomer();
    var BasketMgr = require('dw/order/BasketMgr');


    Transaction.wrap(function() {
        paymentTransaction.setPaymentProcessor(paymentProcessor);
        orderRecord.custom.isApexxOrder = true;
        paymentInstrumentRecord.custom.apexxFailReason = apexxError.errorMessage;

    });
    return {
        error: apexxError.error,
        errorCode: apexxError.errorCode,
        errorMessage: apexxError.errorMessage,
        errorResponse: apexxError.errorResponse
    }
}


/**
 * Save result of the success sale transaction
 * @param {dw.order.Order} orderRecord Current order
 * @param {dw.order.OrderPaymentInstrument} paymentInstrumentRecord Current payment instrument
 * @param {Object} responseTransaction Response data from API call
 */
function saveTransactionData(orderRecord, paymentInstrumentRecord, responseTransaction) {
    var PT = require('dw/order/PaymentTransaction');
    var PaymentMgr = require('dw/order/PaymentMgr');
    var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrumentRecord.paymentMethod).paymentProcessor;
    var authAmount = parseFloat(responseTransaction.amount);
    var paidAmount = parseFloat(responseTransaction.amount);
    var paymentTransaction = paymentInstrumentRecord.getPaymentTransaction();
    var customer = orderRecord.getCustomer();
    var Money = require('dw/value/Money');
    
    if (('status' in responseTransaction) === false ) {
        commonHelper.updateTransactionHistory(responseTransaction.status, orderRecord, responseTransaction, responseTransaction.amount);
    	apexxHelper.badResponseUpdate(orderRecord,paymentTransaction,paymentInstrumentRecord,responseTransaction,CONST.TRANSACTION_TYPE)
    	return;
    }
    
    Transaction.wrap(function() {

        if (responseTransaction.status == apexxConstants.STATUS_CAPTURED) {
            paymentTransaction.setType(PT.TYPE_CAPTURE);
            orderRecord.custom.apexxTransactionType = CONST.TRANSACTION_TYPE;
            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_PAID);
            orderRecord.custom.apexxPaidAmount = authAmount;
            orderRecord.custom.apexxCaptureAmount = paidAmount;
            paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message || '';
            orderRecord.custom.apexxTransactionStatus = apexxConstants.STATUS_PROCESSING;

        } else if (responseTransaction.status == apexxConstants.STATUS_AUTHORISED ) {
            paymentTransaction.setType(PT.TYPE_AUTH);
            orderRecord.custom.apexxTransactionType = CONST.TRANSACTION_TYPE;
            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
            paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message || '';
            orderRecord.custom.apexxTransactionStatus = apexxConstants.STATUS_AUTHORISED;

        } else if (responseTransaction.status == apexxConstants.STATUS_DECLINED ) {
            orderRecord.custom.apexxTransactionType = CONST.TRANSACTION_TYPE;
            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
            paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message || '';
            orderRecord.custom.apexxTransactionStatus = apexxConstants.STATUS_DECLINED;

        } else if (responseTransaction.status == apexxConstants.STATUS_FAILED ) {
            orderRecord.custom.apexxTransactionType = CONST.TRANSACTION_TYPE;
            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
            paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message || '';
            orderRecord.custom.apexxTransactionStatus = apexxConstants.STATUS_FAILED;

        }


        paymentTransaction.setTransactionID(responseTransaction._id);
        paymentTransaction.setPaymentProcessor(paymentProcessor);


        if (responseTransaction.amount) {
            paymentTransaction.setAmount(new Money(responseTransaction.amount, orderRecord.getCurrencyCode()));
        }


        orderRecord.custom.isApexxOrder = true;
        orderRecord.custom.apexxAuthAmount = responseTransaction.authorization_code ? authAmount : 0.0;
        orderRecord.custom.apexxTransactionID = responseTransaction._id;
        orderRecord.custom.apexxMerchantReference = responseTransaction.merchant_reference;
        //paymentInstrumentRecord.custom.apexx3dSecureStatus = appPreference.Apexx_GooglePay_Three_Ds_Yes_No;
        paymentInstrumentRecord.custom.apexxAuthorizationCode = responseTransaction.authorization_code;

        commonHelper.updateTransactionHistory(responseTransaction.status, orderRecord, responseTransaction, responseTransaction.amount);


    });

}
exports.handle = handle;
exports.authorize = authorize;