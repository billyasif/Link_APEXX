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
		APEXX_PAYPAL: 'APEXX_AFTERPAY'
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
        Transaction.wrap(function () {
            var paymentInstruments = currentBasket.getPaymentInstruments();
            collections.forEach(paymentInstruments, function(item) {
                currentBasket.removePaymentInstrument(item);
            });

            currentBasket.createPaymentInstrument(paymentInformation.paymentMethodID, currentBasket.totalGrossPrice);
        });
    } catch (e) {
        error = true;
        commonHelper.getLogger().error('[Handle] Error message is ' + e.message);
        serverErrors.push(
            Resource.msg('error.technical', 'checkout', null)
        );
    }

    
    if(commonHelper.isAfterPayAllowed(currentBasket) == false){
    	serverErrors.push(
                Resource.msg('afterpay.not.allowed', 'general', null)
            );
    	error = true;
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
        //return {error:true,saleTransactionRequestData:saleTransactionRequestData};

        saleTransactionResponseData = apexxAfterPayServiceWrapper.makeServiceCall('POST',endPoint, saleTransactionRequestData);
        
        //return {error:true,saleTransactionRequestData:saleTransactionRequestData,saleTransactionResponseData:saleTransactionResponseData};

        //return {error:true,saleTransactionRequestData:saleTransactionRequestData,saleTransactionResponseData:saleTransactionResponseData};

        if (saleTransactionResponseData.ok == true && saleTransactionResponseData.object._id ) {
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
    
    Transaction.wrap(function() {
        
        orderRecord.custom.apexxTransactionType = "AUTH";
        orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
        paymentTransaction.setTransactionID(responseTransaction._id);
        paymentTransaction.setPaymentProcessor(paymentProcessor);
        paymentTransaction.setAmount(new Money(responseTransaction.afterpay.gross_amount, orderRecord.getCurrencyCode()));

        orderRecord.custom.isApexxOrder = true;
        orderRecord.custom.apexxTransactionStatus = responseTransaction.status;
        orderRecord.custom.apexxAuthAmount = (responseTransaction.status == 'AUTHORISED')  ? authAmount : 0.0;
        orderRecord.custom.apexxTransactionID = responseTransaction._id;
        orderRecord.custom.apexxMerchantReference = responseTransaction.merchant_reference;
        updateTransactionHistory(responseTransaction.status, orderRecord, responseTransaction, responseTransaction.afterpay.gross_amount);

        if (responseTransaction.status === 'AUTHORISED') {
            paymentTransaction.setType(PT.TYPE_AUTH);
        }



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
