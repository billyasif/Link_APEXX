'use strict';

var ApexxHelper = require('~/cartridge/scripts/util/apexxHelper');
var prefs = ApexxHelper.getPrefs();

var apexxAfterPayServiceWrapper = require('*/cartridge/scripts/service/apexxAfterPayServiceWrapper');
var OrderMgr = require('dw/order/OrderMgr');
var PaymentMgr = require('dw/order/PaymentMgr');
var Transaction = require('dw/system/Transaction');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var commonHelper = require('*/cartridge/scripts/util/commonHelper');
var objectHelper = require('*/cartridge/scripts/util/objectHelper');
var collections = require('*/cartridge/scripts/util/collections');
var appPreference = require('~/cartridge/config/appPreference')();
var Resource = require('dw/web/Resource');

var endPoint = appPreference.SERVICE_HTTP_AFTERPAY;
var CONST = {
    APEXX_AFTERPAY: 'APEXX_AFTERPAY',
    STATUS_PROCESSING: 'Processing'
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
    try {
        Transaction.wrap(function() {
            var paymentInstruments = currentBasket.getPaymentInstruments();
            var iter = paymentInstruments.iterator();
            var currentPi = null;
            while (iter.hasNext()) {
                currentPi = iter.next();
                var paymentMethod = currentPi.paymentMethod;
                if (paymentMethod != null && typeof paymentMethod !== 'undefined' && commonHelper.isApexxPaymentMethod(paymentMethod, CONST.APEXX_AFTERPAY)) {
                    currentBasket.removePaymentInstrument(currentPi);
                }
            }

            paymentInstrument = currentBasket.createPaymentInstrument(paymentInformation.paymentMethodID, currentBasket.totalGrossPrice);
        });
    } catch (e) {
        error = true;
        commonHelper.getLogger().error('[Handle] Error message is ' + e.message);
        serverErrors.push(
            Resource.msg('error.technical', 'checkout', null)
        );
    }


//    if (commonHelper.isAfterPayAllowed() == false) {
//        serverErrors.push(
//            Resource.msg('afterpay.not.allowed', 'general', null)
//        );
//        error = true;
//    }
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

        saleTransactionResponseData = apexxAfterPayServiceWrapper.makeServiceCall('POST', endPoint, saleTransactionRequestData);
        var logger = require('dw/system/Logger').getLogger('APF');
        logger.info("logged");

        if (saleTransactionResponseData.ok == true && saleTransactionResponseData.object._id) {
            saveTransactionData(order, paymentInstrument, saleTransactionResponseData.object);
        } else if (saleTransactionResponseData.object.status !== "AUTHORIZED" || saleTransactionResponseData.object.status !== "CAPTURED") {
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
    }


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
    var authAmount = parseFloat(responseTransaction.afterpay.gross_amount);
    var paidAmount = parseFloat(responseTransaction.afterpay.gross_amount);
    var paymentTransaction = paymentInstrumentRecord.getPaymentTransaction();
    var customer = orderRecord.getCustomer();
    var Money = require('dw/value/Money');
    var transactionType = "AUTHORISED";

    Transaction.wrap(function() {

        if (responseTransaction.status == "AUTHORISED") {

            paymentTransaction.setType(PT.TYPE_AUTH);
            orderRecord.custom.apexxTransactionType = responseTransaction.status;
            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
            if (responseTransaction.reason_message)
                paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message || '';
            if (responseTransaction._id)
                paymentTransaction.setTransactionID(responseTransaction._id);
            if (paymentProcessor)
                paymentTransaction.setPaymentProcessor(paymentProcessor);
            if (responseTransaction.status)
                orderRecord.custom.apexxAuthAmount = (responseTransaction.status == 'AUTHORISED') ? authAmount : 0.0;

        } else if (responseTransaction.status == "DECLINED") {
            orderRecord.custom.apexxTransactionType = responseTransaction.status;
            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
            paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message || '';
            if (responseTransaction._id)
                paymentTransaction.setTransactionID(responseTransaction._id);
            if (paymentProcessor)
                paymentTransaction.setPaymentProcessor(paymentProcessor);
            if (transactionType)
                paymentTransaction.setType(PT.TYPE_AUTH);


        } else if (responseTransaction.status == "FAILED") {
            orderRecord.custom.apexxTransactionType = responseTransaction.status;
            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
            paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message || '';
            if (responseTransaction._id)
                paymentTransaction.setTransactionID(responseTransaction._id);
            if (paymentProcessor)
                paymentTransaction.setPaymentProcessor(paymentProcessor);
            if (transactionType)
                paymentTransaction.setType(PT.TYPE_AUTH);
        }

        if (responseTransaction.afterpay.gross_amount) {
            paymentTransaction.setAmount(new Money(responseTransaction.afterpay.gross_amount, orderRecord.getCurrencyCode()));
        }
        orderRecord.custom.isApexxOrder = true;
        orderRecord.custom.apexxTransactionStatus = (responseTransaction.status === "CAPTURED") ? CONST.STATUS_PROCESSING : responseTransaction.status;
        orderRecord.custom.apexxTransactionID = responseTransaction._id || '';
        orderRecord.custom.apexxMerchantReference = responseTransaction.merchant_reference || '';
        updateTransactionHistory(responseTransaction.status, orderRecord, responseTransaction, responseTransaction.afterpay.gross_amount);

    });

}


function updateTransactionHistory(action, order, response, amount) {
    var transactionHistory = order.custom.apexxTransactionHistory || '[]';
    var response = (response.object) ? response.object : response;
    var transactionType = order.custom.apexxTransactionType || '';
    var merchant_reference = response.merchant_reference ? response.merchant_reference : order.orderNo;
    var ID = response._id ? response._id : '';
    var status = response.status || '';

    transactionHistory = JSON.parse(transactionHistory);

    transactionHistory.push({
        id: ID,
        merchant_reference: merchant_reference || '',
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



exports.handle = handle;
exports.authorize = authorize;