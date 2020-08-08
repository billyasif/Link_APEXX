'use strict';

var apexxServiceWrapper = require('*/cartridge/scripts/service/apexxServiceWrapper');
var OrderMgr = require('dw/order/OrderMgr');
var PaymentMgr = require('dw/order/PaymentMgr');
var Transaction = require('dw/system/Transaction');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var commonHelper = require('*/cartridge/scripts/util/commonHelper');
var objectHelper = require('*/cartridge/scripts/util/objectHelper');
var apexxHelper = require('*/cartridge/scripts/util/apexxHelper');
var collections = require('*/cartridge/scripts/util/collections');
var appPreference = require('~/cartridge/config/appPreference')();
var Resource = require('dw/web/Resource');
var dwSession = require("dw/system/Session");

var apexxConstants = require('*/cartridge/scripts/util/apexxConstants');

var transactionType = (appPreference.Apexx_Direct_Capture) ? apexxConstants.TRANSACTION_TYPE_CAPTURE : apexxConstants.TRANSACTION_TYPE_AUTH; 
var endPoint = appPreference.SERVICE_HTTP_DIRECT_PAY;

var CONST = {
    TRANSACTION_TYPE:transactionType
};
/**
 * Creates a token. This should be replaced by utilizing a tokenization provider
 * @returns {string} a token
 */
function createToken() {
    return Math.random().toString(36).substr(2);
}




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
    var cardNumber = paymentInformation.cardNumber.value;
    var cardSecurityCode = paymentInformation.securityCode.value;
    var expirationMonth = paymentInformation.expirationMonth.value;
    var expirationYear = paymentInformation.expirationYear.value;

    var serverErrors = [];
    var creditCardStatus;

    var cardType = paymentInformation.cardType.value;
    var paymentCard = PaymentMgr.getPaymentCard(cardType);


    Transaction.wrap(function() {

        var paymentInstruments = currentBasket.getPaymentInstruments();
        collections.forEach(paymentInstruments, function(item) {
            currentBasket.removePaymentInstrument(item);
        });

        var paymentInstruments = currentBasket.getPaymentInstruments(
            PaymentInstrument.METHOD_CREDIT_CARD
        );
        collections.forEach(paymentInstruments, function(item) {
            currentBasket.removePaymentInstrument(item);
        });

        var token = paymentInformation.creditCardToken ? paymentInformation.creditCardToken : "";

        var paymentInstrument = currentBasket.createPaymentInstrument(
            PaymentInstrument.METHOD_CREDIT_CARD, currentBasket.totalGrossPrice
        );
        paymentInstrument.setCreditCardHolder(currentBasket.billingAddress.fullName);
        paymentInstrument.setCreditCardType(cardType);
        paymentInstrument.setCreditCardHolder(currentBasket.billingAddress.fullName);
        paymentInstrument.setCreditCardNumber(cardNumber);
        paymentInstrument.setCreditCardExpirationMonth(expirationMonth);
        paymentInstrument.setCreditCardExpirationYear(expirationYear);

        paymentInstrument.custom.apexxSaveCreditCard = request.httpParameterMap.saveCard.booleanValue;
        paymentInstrument.custom.apexxTransactionType = transactionType;
        paymentInstrument.custom.apexxRecurringType = appPreference.Apexx_Direct_Recurring_Type;
        paymentInstrument.custom.apexx3dSecureStatus = appPreference.Apexx_Direct_Three_Ds;
        paymentInstrument.custom.apexxSaveCreditCard = request.httpParameterMap.saveCard.booleanValue;

        if (token) {
            paymentInstrument.setCreditCardToken(token);
        }


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

        try {
            var saleTransactionRequestData = objectHelper.createSaleRequestObject(order, paymentInstrument, paymentProcessor);

            var saleTransactionResponseData = apexxServiceWrapper.makeServiceCall('POST', endPoint, saleTransactionRequestData);
            var logger = require('dw/system/Logger').getLogger('APEXX_CREDIT_LOGGER');
            
            logger.info("logged");

            //return {error:true,saleTransactionRequestData:saleTransactionRequestData,saleTransactionResponseData:saleTransactionResponseData}


            if (saleTransactionResponseData.ok == true && saleTransactionResponseData.object.authorization_code) {

                saveTransactionData(order, paymentInstrument, saleTransactionResponseData.object);

                if (saleTransactionRequestData.three_ds.three_ds_required == true) {
                    updateSaveCardStatus(saleTransactionRequestData, paymentInstrument);
                }

                if (saleTransactionRequestData.card.saveCard == true) {
                    saveCustomerCreditCard(paymentInstrument, saleTransactionResponseData.object);
                }


                return {
                    authorized: true
                };

            } else if (saleTransactionResponseData.ok == true && saleTransactionRequestData.three_ds.three_ds_required == true) {
                updateSaveCardStatus(saleTransactionRequestData, paymentInstrument);

                return {
                    authorized: true,
                    threeDsObj: saleTransactionResponseData.object

                };
            } else if (saleTransactionResponseData.object.status !== "AUTHORIZED" || saleTransactionResponseData.object.status !== "CAPTURED") {
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
 * Save used credit cart as customers payment method
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument Current payment instrument
 * @param {Object} saleTransactionResponseData Response data from API call
 */
function saveCustomerCreditCard(paymentInstrument, saleTransactionResponseData) {
    if (saleTransactionResponseData.card.token) {
        var customerWallet = customer.getProfile().getWallet();
        var card = {
            expirationMonth: saleTransactionResponseData.card.expiry_month,
            expirationYear: saleTransactionResponseData.card.expiry_year,
            number: saleTransactionResponseData.card.card_number,
            type: paymentInstrument.creditCardType,
            owner: paymentInstrument.creditCardHolder,
            token: saleTransactionResponseData.card.token
        };

        Transaction.wrap(function() {

            var customerPaymentInstrument = customerWallet.createPaymentInstrument(paymentInstrument.getPaymentMethod());
            customerPaymentInstrument.setCreditCardHolder(card.owner);
            customerPaymentInstrument.setCreditCardNumber(card.number);
            customerPaymentInstrument.setCreditCardExpirationMonth(parseInt(card.expirationMonth, 10));
            customerPaymentInstrument.setCreditCardExpirationYear(parseInt(card.expirationYear, 10));
            customerPaymentInstrument.setCreditCardType(card.type);
            customerPaymentInstrument.setCreditCardToken(card.token);
        });
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
    
    if (responseTransaction.status === apexxConstants.STATUS_CAPTURED) {
        Transaction.wrap(function() {
            paymentTransaction.setType(PT.TYPE_CAPTURE);
            orderRecord.custom.apexxTransactionType = CONST.TRANSACTION_TYPE;
            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_PAID);
            orderRecord.custom.apexxPaidAmount = authAmount;
            orderRecord.custom.apexxCaptureAmount = paidAmount;
            paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message;
        });
    } else if (responseTransaction.status === apexxConstants.STATUS_AUTHORISED) {
        Transaction.wrap(function() {
            paymentTransaction.setType(PT.TYPE_AUTH);
            orderRecord.custom.apexxTransactionType = CONST.TRANSACTION_TYPE;
            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
            paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message;
        });
    } else if (responseTransaction.status === apexxConstants.STATUS_DECLINED) {
        Transaction.wrap(function() {
            orderRecord.custom.apexxTransactionType = CONST.TRANSACTION_TYPE;
            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
            paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message;
        });
    } else if (responseTransaction.status === apexxConstants.STATUS_FAILED) {
        Transaction.wrap(function() {
            orderRecord.custom.apexxTransactionType = CONST.TRANSACTION_TYPE;
            orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
            paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message;
        });
    }
  
    Transaction.wrap(function() {
        paymentTransaction.setTransactionID(responseTransaction._id);
        paymentTransaction.setPaymentProcessor(paymentProcessor);
        if (responseTransaction.amount) {
            paymentTransaction.setAmount(new Money(responseTransaction.amount, orderRecord.getCurrencyCode()));
        }
        orderRecord.custom.apexxTransactionStatus = (responseTransaction.status === apexxConstants.STATUS_CAPTURED) ? apexxConstants.STATUS_PROCESSING : responseTransaction.status;

        orderRecord.custom.isApexxOrder = true;
        orderRecord.custom.apexxAuthAmount = responseTransaction.authorization_code ? authAmount : 0.0;
        orderRecord.custom.apexxTransactionID = responseTransaction._id;
        orderRecord.custom.apexxMerchantReference = responseTransaction.merchant_reference;


        paymentInstrumentRecord.custom.apexx3dSecureStatus = appPreference.Apexx_Direct_Three_Ds;
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

function updateSaveCardStatus(saleTransactionRequestData, paymentInstrument) {
    var status = false;;

    if (saleTransactionRequestData.card.saveCard == true) {
        status = true;
    }

    Transaction.wrap(function() {
        paymentInstrument.custom.apexxSaveCreditCard = status;
    });

}
exports.handle = handle;
exports.authorize = authorize;
exports.createToken = createToken;
exports.saveTransactionData = saveTransactionData;
exports.saveCustomerCreditCard = saveCustomerCreditCard;