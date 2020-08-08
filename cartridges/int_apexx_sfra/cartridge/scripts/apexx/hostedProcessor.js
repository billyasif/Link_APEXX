'use strict';

var ApexxHelper = require('~/cartridge/scripts/util/apexxHelper');
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
var apexxHelper = require('*/cartridge/scripts/util/apexxHelper');
var apexxConstants = require('*/cartridge/scripts/util/apexxConstants');

var endPoint = appPreference.SERVICE_HTTP_HOSTED;
var transactionType = (appPreference.Apexx_Hosted_Capture) ? apexxConstants.TRANSACTION_TYPE_CAPTURE : apexxConstants.TRANSACTION_TYPE_AUTH;
var prefs = ApexxHelper.getPrefs();

var CONST = {
		TRANSACTION_TYPE: (appPreference.Apexx_Hosted_Capture) ? apexxConstants.TRANSACTION_TYPE_CAPTURE : apexxConstants.TRANSACTION_TYPE_AUTH
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

    try {
        Transaction.wrap(function() {

            var paymentInstruments = currentBasket.getPaymentInstruments();
            collections.forEach(paymentInstruments, function(item) {
                currentBasket.removePaymentInstrument(item);
            });
            var iter = paymentInstruments.iterator();
            var currentPi = null;
            while (iter.hasNext()) {
                currentPi = iter.next();
                var paymentMethod = currentPi.paymentMethod;
                if (paymentMethod != null && typeof paymentMethod !== 'undefined' && commonHelper.isApexxPaymentMethod(paymentMethod, apexxConstants.APEXX_HOSTED_PAYMENT_METHOD)) {
                    currentBasket.removePaymentInstrument(currentPi);
                }
            }
            paymentInstrument = currentBasket.createPaymentInstrument(paymentInformation.paymentMethodID, currentBasket.totalGrossPrice);

            paymentInstrument.custom.apexxTransactionType = CONST.TRANSACTION_TYPE;
            paymentInstrument.custom.apexxRecurringType = appPreference.Apexx_Hosted_Recurring_Type;
            paymentInstrument.custom.apexx3dSecureStatus = appPreference.Apexx_hosted_3ds_true_false;
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

    // Pending Transaction Update
    try {

        if (order) {
    	       Transaction.begin();
                order.setPaymentStatus(order.PAYMENT_STATUS_NOTPAID);
                order.custom.isApexxOrder = true;
                order.custom.apexxTransactionStatus = apexxConstants.PENDING_ORDER_STATUS;
                order.custom.apexxTransactionType = CONST.TRANSACTION_TYPE;
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




    if (paymentInstrument && paymentInstrument.getPaymentTransaction().getAmount().getValue() > 0) {
     try   {
        var saleTransactionResponseData = null;
        var saleTransactionRequestData = null;

        saleTransactionRequestData = objectHelper.createSaleRequestObject(order, paymentInstrument, paymentProcessor);

        saleTransactionResponseData = apexxServiceWrapper.makeServiceCall('POST', endPoint, saleTransactionRequestData);

        var logger = require('dw/system/Logger').getLogger('APEXX_HOSTED_LOGGER');
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
            } catch (error) {
                var errorObj = {
                    error: true,
                    errorCode: error.name,
                    errorMessage: error.message,
                    errorResponse: error.message
                }
                return authorizeFailedFlow(order, paymentProcessor, paymentInstrument, errorObj);
            }
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
        paymentInstrumentRecord.custom.apexxFailReason = apexxError.errorMessage || '';

    });
    return {
        error: apexxError.error || '',
        errorCode: apexxError.errorCode || '',
        errorMessage: apexxError.errorMessage || '',
        errorResponse: apexxError.errorResponse || ''
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
    var transactionType = saleTransactionRequestData.capture_now;
    
    var Money = require('dw/value/Money');
    var threeDSecureInfo;

    if (('status' in responseTransaction) === false && ('url' in responseTransaction) === false) {
        commonHelper.updateTransactionHistory(responseTransaction.status, orderRecord, responseTransaction, responseTransaction.amount);
        apexxHelper.badResponseUpdate(orderRecord,paymentTransaction,paymentInstrumentRecord,responseTransaction,CONST.TRANSACTION_TYPE)
        return;
    }
    
    Transaction.wrap(function() {
        if (responseTransaction.status == "CAPTURED") {
            paymentTransaction.setType(PT.TYPE_CAPTURE);
            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_PAID);
            orderRecord.custom.apexxPaidAmount = authAmount;
            orderRecord.custom.apexxCaptureAmount = paidAmount;
            orderRecord.custom.apexxTransactionStatus = (responseTransaction.status === "CAPTURED") ? apexxConstants.STATUS_PROCESSING : responseTransaction.status;

            paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message;

        } else if (responseTransaction.status == "AUTHORISED") {
            paymentTransaction.setType(PT.TYPE_AUTH);
            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
            paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message;
            orderRecord.custom.apexxTransactionStatus = responseTransaction.status;


        } else if (responseTransaction.status == "DECLINED") {
            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
            paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message;
            orderRecord.custom.apexxTransactionStatus = responseTransaction.status;

        } else if (responseTransaction.status == "FAILED") {
            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
            paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message ;
            orderRecord.custom.apexxTransactionStatus = responseTransaction.status;

        }
       
        paymentTransaction.setPaymentProcessor(paymentProcessor);

        if (saleTransactionRequestData.amount) {
            paymentTransaction.setAmount(new Money(saleTransactionRequestData.amount, orderRecord.getCurrencyCode()));
        }

        threeDSecureInfo = saleTransactionRequestData.three_ds;
        paymentInstrumentRecord.custom.apexx3dSecureStatus = threeDSecureInfo ? threeDSecureInfo.three_ds_required : null;
        orderRecord.custom.isApexxOrder = true;
        paymentInstrumentRecord.custom.apexxHostedPaymentPageToken = responseTransaction._id;
        paymentInstrumentRecord.custom.apexxHostedPaymentPageResponseUrl = responseTransaction.url;


    });
}
exports.handle = handle;
exports.authorize = authorize;