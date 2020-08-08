'use strict';

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
var dwSession = require("dw/system/Session");
var apexxConstants = require('*/cartridge/scripts/util/apexxConstants');
var apexxHelper = require('*/cartridge/scripts/util/apexxHelper');

var endPoint = appPreference.SERVICE_HTTP_DIRECT_PAY;

var CONST = {
    TRANSACTION_TYPE: appPreference.Apexx_Client_Side_Capture == true ? apexxConstants.TRANSACTION_TYPE_CAPTURE : apexxConstants.TRANSACTION_TYPE_AUTH
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

    var cseCardOwner = paymentInformation.cseCardOwner.value;
    var cseCardNumber = paymentInformation.cseCardNumber.value;
    var cseSecurityCode = paymentInformation.cseSecurityCode.value;
    var cseExpirationMonth = paymentInformation.cseExpirationMonth.value;
    var cseExpirationYear = paymentInformation.cseExpirationYear.value;
    var cseEncryptedData = paymentInformation.cseEncryptedData.value;
    var serverErrors = [];
    var creditCardStatus;

    //var cardType = paymentInformation.cardType.value;
    //var paymentCard = PaymentMgr.getPaymentCard(cardType);


    Transaction.wrap(function() {
        var paymentInstruments = currentBasket.getPaymentInstruments();

        collections.forEach(paymentInstruments, function(item) {
            currentBasket.removePaymentInstrument(item);
        });


        var paymentInstrument = currentBasket.createPaymentInstrument(
        		apexxConstants.APEXX_CLIENT_SIDE_PAYMENT_METHOD, currentBasket.totalGrossPrice
        );

        paymentInstrument.setCreditCardHolder(cseCardOwner);
        paymentInstrument.setCreditCardNumber(cseCardNumber);
        paymentInstrument.setCreditCardExpirationMonth(cseExpirationMonth);
        paymentInstrument.setCreditCardExpirationYear(cseExpirationYear);
        if (cseEncryptedData != false) {
            paymentInstrument.custom.encryptedData = cseEncryptedData;
        }
        paymentInstrument.custom.apexxTransactionType = CONST.TRANSACTION_TYPE;
        paymentInstrument.custom.apexxRecurringType = appPreference.Apexx_Client_Side_Recurring_Type;
        paymentInstrument.custom.apexx3dSecureStatus = appPreference.Apexx_Client_Three_Ds;



    });

    return {
        fieldErrors: cardErrors,
        serverErrors: serverErrors,
        error: false
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

    if (paymentInstrument && paymentInstrument.getPaymentTransaction().getAmount().getValue() > 0) {

        // try {
        var saleTransactionRequestData = objectHelper.createSaleRequestObject(order, paymentInstrument, paymentProcessor);


        var saleTransactionResponseData = apexxServiceWrapper.makeServiceCall('POST', endPoint, saleTransactionRequestData);

        var logger = require('dw/system/Logger').getLogger('APEXX_CLIENT_SIDE_LOGGER');
        logger.info("logged");

        //      return {
        //    	  error:true,
        //          saleTransactionRequestData: saleTransactionRequestData,
        //          saleTransactionResponseData: saleTransactionResponseData
        //        }

        if (saleTransactionResponseData.ok == true && saleTransactionResponseData.object.authorization_code) {

            saveTransactionData(order, paymentInstrument, saleTransactionResponseData.object);

            if (saleTransactionRequestData.three_ds.three_ds_required == true) {
                updateSaveCardStatus(saleTransactionRequestData, paymentInstrument);
            }

            return {

                authorized: true
            };

        } else if (saleTransactionResponseData.ok == true && saleTransactionRequestData.three_ds.three_ds_required == true) {

            return {
                authorized: true,
                threeDsObj: saleTransactionResponseData.object

            };
        } else if (saleTransactionResponseData.ok == true || saleTransactionResponseData.ok == false && saleTransactionResponseData.object.code) {
            saveTransactionData(order, paymentInstrument, saleTransactionResponseData.object);
            return {

                authorized: true
            }
        } else if (saleTransactionResponseData.object.status !== apexxConstants.STATUS_AUTHORISED || saleTransactionResponseData.object.status !== apexxConstants.STATUS_CAPTURED) {
            saveTransactionData(order, paymentInstrument, saleTransactionResponseData.object);
            return {

                authorized: true
            };
        } else {
            var errorObj = {
                error: true,
                errorCode: saleTransactionResponseData.object.reason_code,
                errorMessage: saleTransactionResponseData.object.reason_message,
                errorResponse: {
                    saleTransactionRequestData: saleTransactionRequestData,
                    saleTransactionResponseData: saleTransactionResponseData
                }
            };
            return authorizeFailedFlow(order, paymentProcessor, paymentInstrument, errorObj);
        }

        //    } catch (error) {
        //      var errorObj = {
        //        error: true,
        //        errorCode: error.name,
        //        errorMessage: error.message,
        //        errorResponse: error.message
        //      }
        //      return authorizeFailedFlow(order, paymentProcessor, paymentInstrument, errorObj);
        //    }

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
        paymentInstrumentRecord.custom.apexxCreditCardMakeDefault = false;

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
            paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message;

        } else if (paymentInstrumentRecord.custom.apexxTransactionType == false && responseTransaction.status == apexxConstants.STATUS_AUTHORISED) {
            paymentTransaction.setType(PT.TYPE_AUTH);
            orderRecord.custom.apexxTransactionType = CONST.TRANSACTION_TYPE;
            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
            paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message;

        } else if (responseTransaction.status == apexxConstants.STATUS_DECLINED) {
            orderRecord.custom.apexxTransactionType = CONST.TRANSACTION_TYPE;

            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
            paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message;
        } else if (responseTransaction.status == apexxConstants.STATUS_FAILED) {
            orderRecord.custom.apexxTransactionType = CONST.TRANSACTION_TYPE;
            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
            paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message;

        }

        paymentTransaction.setTransactionID(responseTransaction._id);
        paymentTransaction.setPaymentProcessor(paymentProcessor);
        if (responseTransaction.amount) {
            paymentTransaction.setAmount(new Money(responseTransaction.amount, orderRecord.getCurrencyCode()));
        }
        orderRecord.custom.apexxTransactionStatus = (responseTransaction.status === apexxConstants.STATUS_CAPTURED ) ? apexxConstants.STATUS_PROCESSING : responseTransaction.status;

        orderRecord.custom.isApexxOrder = true;
        orderRecord.custom.apexxTransactionType = CONST.TRANSACTION_TYPE;
        orderRecord.custom.apexxAuthAmount = responseTransaction.authorization_code ? authAmount : 0.0;
        orderRecord.custom.apexxTransactionID = responseTransaction._id;
        orderRecord.custom.apexxMerchantReference = responseTransaction.merchant_reference;


        paymentInstrumentRecord.custom.apexx3dSecureStatus = appPreference.Apexx_Client_Three_Ds;
        paymentInstrumentRecord.custom.apexxAuthorizationCode = responseTransaction.authorization_code;

        if (responseTransaction.card) {
            paymentInstrumentRecord.custom.apexxPaymentMethodToken = responseTransaction.card.token;
            paymentInstrumentRecord.custom.apexxCreditCardType = responseTransaction.card_brand;
            paymentInstrumentRecord.custom.apexxCreditCardLastDigits = responseTransaction.card.card_number;
            paymentInstrumentRecord.custom.apexxCardExpirationMonth = parseInt(responseTransaction.card.expiry_month, 10);
            paymentInstrumentRecord.custom.apexxCardExpirationYear = parseInt(responseTransaction.card.expiry_year, 10);
        }

        commonHelper.updateTransactionHistory(responseTransaction.status, orderRecord, responseTransaction, responseTransaction.amount);

    });

}

exports.handle = handle;
exports.authorize = authorize;
exports.saveTransactionData = saveTransactionData;