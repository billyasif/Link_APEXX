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
var endPoint = appPreference.SERVICE_HTTP_DIRECT_PAY;
var dwSession = require("dw/system/Session");
var CONST = {
		APEXX_PAYMENT_METHOD: 'APEXX_CLIENT_SIDE'
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
        var paymentInstruments = currentBasket.getPaymentInstruments(
        	CONST.APEXX_PAYMENT_METHOD
        );
        collections.forEach(paymentInstruments, function(item) {
            currentBasket.removePaymentInstrument(item);
        });


        var paymentInstrument = currentBasket.createPaymentInstrument(
        	CONST.APEXX_PAYMENT_METHOD,currentBasket.totalGrossPrice
        );
        
        paymentInstrument.setCreditCardHolder(cseCardOwner);
        paymentInstrument.setCreditCardNumber(cseCardNumber);
        paymentInstrument.setCreditCardExpirationMonth(cseExpirationMonth);
        paymentInstrument.setCreditCardExpirationYear(cseExpirationYear);
        paymentInstrument.custom.encryptedData = cseEncryptedData;



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


    if (paymentInstrument && paymentInstrument.getPaymentTransaction().getAmount().getValue() > 0) {

        try {
            var saleTransactionRequestData = objectHelper.createSaleRequestObject(order, paymentInstrument, paymentProcessor);


            var saleTransactionResponseData = apexxServiceWrapper.makeServiceCall('POST', endPoint, saleTransactionRequestData);
          
            //return {error: true,saleTransactionRequestData:saleTransactionRequestData,saleTransactionResponseData:saleTransactionResponseData};

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
            } else {
                var errorObj = {
                    error: true,
                    errorCode: saleTransactionResponseData.object.reason_code,
                    errorMessage: saleTransactionResponseData.object.reason_message,
                    errorResponse: saleTransactionRequestData
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


        paymentInstrumentRecord.custom.apexx3dSecureStatus = appPreference.Apexx_Client_Three_Ds;
        paymentInstrumentRecord.custom.apexxAuthorizationCode = responseTransaction.authorization_code;


        if (responseTransaction.status === 'AUTHORISED') {
            paymentTransaction.setType(PT.TYPE_AUTH);
        }

        if (responseTransaction.card) {

            paymentInstrumentRecord.custom.apexxPaymentMethodToken = responseTransaction.card.token;
            paymentInstrumentRecord.custom.apexxCreditCardType = responseTransaction.card_brand;
            paymentInstrumentRecord.custom.apexxCreditCardLastDigits = responseTransaction.card.card_number;
            paymentInstrumentRecord.custom.apexxCardExpirationMonth = parseInt(responseTransaction.card.expiry_month, 10);
            paymentInstrumentRecord.custom.apexxCardExpirationYear = parseInt(responseTransaction.card.expiry_year, 10);
        }

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
exports.saveTransactionData = saveTransactionData;
exports.saveCustomerCreditCard = saveCustomerCreditCard;