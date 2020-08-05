'use strict';

var ApexxHelper = require('~/cartridge/scripts/util/apexxHelper');
var prefs = ApexxHelper.getPrefs();

var apexxServiceWrapper = require('*/cartridge/scripts/service/apexxServiceWrapper');
var OrderMgr = require('dw/order/OrderMgr');
var PaymentMgr = require('dw/order/PaymentMgr');
var Transaction = require('dw/system/Transaction');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var commonHelper = require('*/cartridge/scripts/util/commonHelper');
var objectHelper = require('*/cartridge/scripts/util/objectHelper');
var collections = require('*/cartridge/scripts/util/collections');
var appPreference = require('~/cartridge/config/appPreference')();
var Resource = require('dw/web/Resource');
var endPoint = appPreference.SERVICE_HTTP_PAYPAL;
var CONST = {
    APEXX_PAYPAL: 'APEXX_PAYPAL'
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
    var paymentInstrument;
    var cardErrors = {};
    var serverErrors = [];
    var error = false;
    var transactionType = appPreference.Apexx_PayPal_Capture == true ? "CAPTURE" : "AUTH";

    try {
        Transaction.wrap(function() {
            var paymentInstruments = currentBasket.getPaymentInstruments();
            var iter = paymentInstruments.iterator();
            var currentPi = null;
            while (iter.hasNext()) {
                currentPi = iter.next();
                var paymentMethod = currentPi.paymentMethod;
                if (paymentMethod != null && typeof paymentMethod !== 'undefined' && commonHelper.isApexxPaymentMethod(paymentMethod, CONST.APEXX_PAYPAL)) {
                    currentBasket.removePaymentInstrument(currentPi);
                }
            }
            paymentInstrument = currentBasket.createPaymentInstrument(paymentInformation.paymentMethodID, currentBasket.totalGrossPrice);
            paymentInstrument.custom.apexxTransactionType = transactionType;
            paymentInstrument.custom.apexxRecurringType = appPreference.Apexx_Paypal_Recurring_Type;
        });
    } catch (e) {
        error = true;
        commonHelper.getLogger().error('[Handle] Error message is ' + e.message);
        serverErrors.push(
            Resource.msg('error.technical', 'checkout', null)
        );
    }

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

        saleTransactionResponseData = apexxServiceWrapper.makeServiceCall('POST', endPoint, saleTransactionRequestData);
        
        var logger = require('dw/system/Logger').getLogger('APEXX_PAYPAL_LOGGER');
        logger.info("logged");
        
        if (saleTransactionResponseData.ok == true && saleTransactionResponseData.object._id && saleTransactionResponseData.object.url) {
            saveTransactionData(order, paymentInstrument, saleTransactionRequestData, saleTransactionResponseData.object);
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
function saveTransactionData(orderRecord, paymentInstrumentRecord, saleTransactionRequestData, responseTransaction) {
    var PT = require('dw/order/PaymentTransaction');
    var PaymentMgr = require('dw/order/PaymentMgr');
    var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrumentRecord.paymentMethod).paymentProcessor;
    var paymentTransaction = paymentInstrumentRecord.getPaymentTransaction();
    var customer = orderRecord.getCustomer();
    var Money = require('dw/value/Money');
    var threeDSecureInfo;

    Transaction.wrap(function() {
        if (saleTransactionRequestData.capture_now == true) {

            orderRecord.custom.apexxTransactionType = "CAPTURE";

        } else {

            orderRecord.custom.apexxTransactionType = "AUTH";
        }

        paymentTransaction.setPaymentProcessor(paymentProcessor);
        if(saleTransactionRequestData.amount){
           paymentTransaction.setAmount(new Money(saleTransactionRequestData.amount, orderRecord.getCurrencyCode()));
        }
        threeDSecureInfo = saleTransactionRequestData.three_ds;
        paymentInstrumentRecord.custom.apexx3dSecureStatus = threeDSecureInfo ? threeDSecureInfo.three_ds_required : null;
        orderRecord.custom.isApexxOrder = true;
        orderRecord.custom.apexxTransactionID = responseTransaction._id;

        paymentInstrumentRecord.custom.apexxPayPalPaymentPageToken = responseTransaction._id;
        paymentInstrumentRecord.custom.apexxPayPalPaymentPageResponseUrl = responseTransaction.url;


    });
}

exports.handle = handle;
exports.authorize = authorize;
