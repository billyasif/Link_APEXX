'use strict';

var ApexxHelper = require('~/cartridge/scripts/util/apexxHelper');
var prefs = ApexxHelper.getPrefs();

var apexxServiceWrapper = require('*/cartridge/scripts/service/apexxServiceWrapper');
var OrderMgr = require('dw/order/OrderMgr');
var PaymentMgr = require('dw/order/PaymentMgr');
var Transaction = require('dw/system/Transaction');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var PaymentInstrument = require('dw/order/PaymentInstrument');

var commonHelper = require('*/cartridge/scripts/util/commonHelper');
var objectHelper = require('*/cartridge/scripts/util/objectHelper');
var collections = require('*/cartridge/scripts/util/collections');
var appPreference = require('~/cartridge/config/appPreference')();
var Resource = require('dw/web/Resource');
var endPoint = appPreference.SERVICE_HTTP_DIRECT_PAY;
var CONST = {
		APEXX_PAYMENT_METHOD: 'APEXX_GOOGLEPAY'
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
    Transaction.wrap(function () {
        var paymentInstruments = currentBasket.getPaymentInstruments();

        collections.forEach(paymentInstruments, function(item) {
            currentBasket.removePaymentInstrument(item);
        });

        var paymentInstrument = currentBasket.createPaymentInstrument(CONST.APEXX_PAYMENT_METHOD, currentBasket.totalGrossPrice);
       
         paymentInstrument.custom.apexxCryptogram = request.httpParameterMap.cryptogram.value;
         paymentInstrument.custom.apexxExpiryMonth = request.httpParameterMap.expiry_month.value;
         paymentInstrument.custom.apexxExpiryYear = request.httpParameterMap.expiry_year.value;

         paymentInstrument.custom.apexxDpan = request.httpParameterMap.dpan.value;
         paymentInstrument.custom.apexxEci = request.httpParameterMap.eci.value;
         
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
    if (paymentInstrument && paymentInstrument.getPaymentTransaction().getAmount().getValue() > 0) {
        var saleTransactionResponseData = null;
        var saleTransactionRequestData = null;
        
        saleTransactionRequestData = objectHelper.createSaleRequestObject(order, paymentInstrument, paymentProcessor);
        //return {error: true,saleTransactionRequestData:saleTransactionRequestData};

         saleTransactionResponseData = apexxServiceWrapper.makeServiceCall('POST',endPoint, saleTransactionRequestData);
         //return {error: true,saleTransactionRequestData:saleTransactionRequestData,saleTransactionResponseData:saleTransactionResponseData};
         saveTransactionData(order, paymentInstrument, saleTransactionResponseData.object);

    } else {
            var errorObj = {
                error: true,
                errorCode: '',
                errorMessage: '',
                errorResponse: saleTransactionResponseData
            }
            return authorizeFailedFlow(order, paymentProcessor, paymentInstrument, errorObj);
        }

        return {
            authorized: true
        };
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

    Transaction.wrap(function() {
        if (responseTransaction.status == "CAPTURED") {
            orderRecord.custom.apexxTransactionType = "CAPTURE";
            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_PAID);
            orderRecord.custom.apexxPaidAmount = authAmount;
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
        commonHelper.updateTransactionHistory(responseTransaction.status, orderRecord, responseTransaction, responseTransaction.amount);


        paymentInstrumentRecord.custom.apexx3dSecureStatus = appPreference.THREE_DS_REQUIRED;
        paymentInstrumentRecord.custom.apexxAuthorizationCode = responseTransaction.authorization_code;


        if (responseTransaction.status === 'AUTHORISED') {
            paymentTransaction.setType(PT.TYPE_AUTH);
        }

    });

}
exports.handle = handle;
exports.authorize = authorize;
