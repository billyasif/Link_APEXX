'use strict';

/* global dw request session customer */
var system = require('dw/system');
var Transaction = require('dw/system/Transaction');
var appPreference = require('~/cartridge/config/appPreference')();
const objSite = require("dw/system/Site");
var BasketMgr = require('dw/order/BasketMgr');
var apexxConstants = require('*/cartridge/scripts/util/apexxConstants');

/**
 * Logs custom messages
 * @param {Object} message - message to log
 */
function log(message) {
    const Logger = require('dw/system/Logger');
    const logger = Logger.getLogger('Apexx', message.prefix);

    logger[message.type].call(logger, message.text);
}

/**
 * Return amount
 * @param {value} value - float
 * @return {intValue} Integer
 */

function floatToInt(value){
	var intValue = '0';
	if(value && isInt(value)){
		var floatVal = parseFloat(value);
		intValue = Math.round(floatVal * 100);
		intValue = parseInt(intValue);
	}
	return intValue;
}

/**
 * Return float
 * @param {value} value - int
 * @return {floatValue} Float
 */
function intToFloat(value){
    var floatValue = '0.0';
	
	if(value && isInt(value)){
		var intVal = parseInt(value);
		floatValue = intVal / 100;
		floatValue = parseFloat(floatValue);
	}
  return floatValue;
}

function isInt(n){
	if (isNaN(n)) {
       return false;
    }else{
      return true;
    }
    
}

function updateTransactionHistory(action, order, response, amount) {
    var transactionHistory = order.custom.apexxTransactionHistory || '[]';
    var response = (response.object) ? response.object : response;
    
    var transactionType = order.custom.apexxTransactionType || apexxConstants.NO_TRANSACTION_TYPE_FOUND;
    var merchant_reference = response.merchant_reference ? response.merchant_reference : apexxConstants.NO_REFERENCE;
    var ID = response._id ? response._id : apexxConstants.NO_ID_FOUND;
    var status = response.status || apexxConstants.PENDING_ORDER_STATUS;
    var amount = amount || '0.00';
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
 * This function is only needed to ensure compatibility of methods with SiteGenesis Forms.
 * It make object from SFRA Forms and added methods get(key) and value() to object
 * @param {Object} form - the form object
 * @returns {Object} the model with data from form fields
 */
function convertFormToObject(form) {
    if (form === null) {
        return null;
    }
    var result = formFieldsToObject(form);

    result.get = function (key) {
        var val = this[key];
        return {
            value: function () {
                return val;
            }
        };
    };

    result.getValue = function (key) {
        return this[key];
    };

    return result;
}

/**
 * Get customer payment instrument by uuid
 * @param {string} uuid uuid for PI
 * @return {dw.customer.CustomerPaymentInstrument} cutomet payment indstrument
 */
function getCustomerPaymentInstrument(uuid) {
    if (!customer.authenticated) {
        return false;
    }
    var customerPaymentInstruments = customer.getProfile().getWallet().getPaymentInstruments();
    var instrument = null;
    if (uuid === null || customerPaymentInstruments === null || customerPaymentInstruments.size() < 1) {
        return false;
    }
    var instrumentsIter = customerPaymentInstruments.iterator();
    while (instrumentsIter.hasNext()) {
        instrument = instrumentsIter.next();
        if (uuid.equals(instrument.UUID)) {
            return instrument;
        }
    }
    return false;
};

/**
 * Get the form fields and save to object
 * @param {Object} form - the form object
 * @returns {Object} the with data from form fields
 */
function formFieldsToObject(form) {
    if (form === null) {
        return {};
    }
    var result = {};
    var checkedNew = "";

    Object.keys(form).forEach(function (key) {
        if (form[key] && Object.prototype.hasOwnProperty.call(form[key], 'formType')) {
            if (form[key].formType === 'formField') {

                result[key] = form[key].value;
            }

            if (form[key].formType === 'formGroup') {
                var innerFormResult = formFieldsToObject(form[key]);
                Object.keys(innerFormResult).forEach(function (innerKey) {

                    result[innerKey] = innerFormResult[innerKey];
                });
            }
        }
    });
    return result;
}

/**
 * Creates or get logger
 *
 * @returns {Object} Object with logger
 */
function getLogger() {
    var logger = system.Logger.getLogger('Apexx', 'Apexx_General');

    return {
        error: function (msg) {
            if (msg) {
                logger.error(msg);
            }
        },
        info: function (msg) {
            if (msg) {
                logger.info(msg);
            }
        },
        warn: function (msg) {
            if (msg) {
                logger.warn(msg);
            }
        }
    };
};

function getNonGiftCertificateAmount(basket) {
    // The total redemption amount of all gift certificate payment instruments in the basket.
    var giftCertTotal = new Money(0.0, basket.getCurrencyCode());

    // Gets the list of all gift certificate payment instruments
    var gcPaymentInstrs = basket.getGiftCertificatePaymentInstruments();
    var iter = gcPaymentInstrs.iterator();
    var orderPI = null;

    // Sums the total redemption amount.
    while (iter.hasNext()) {
        orderPI = iter.next();
        giftCertTotal = giftCertTotal.add(orderPI.getPaymentTransaction().getAmount());
    }

    // Gets the order total.
    var orderTotal = basket.getTotalGrossPrice();

    // Calculates the amount to charge for the payment instrument.
    // This is the remaining open order total that must be paid.
    var amountOpen = orderTotal.subtract(giftCertTotal);

    // Returns the open amount to be paid.
    return amountOpen;
};


/**
 * Delete all apexx payment instruments from the lineItemContainer
 * @param {dw.order.LineItemCtnr} lineItemContainer Order object
 */
function deleteApexxPaymentInstruments(lineItemContainer) {
    var paymentInstruments = lineItemContainer.getPaymentInstruments();

    var iterator = paymentInstruments.iterator();
    var paymentInstrument = null;
    while (iterator.hasNext()) {
        paymentInstrument = iterator.next();

        var paymentProcessorId = dworder.PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor().getID();

        if (paymentProcessorId === 'APEXX_CREDIT' || paymentProcessorId === 'APEXX_HOSTED') {
            lineItemContainer.removePaymentInstrument(paymentInstrument);
        }
    }
};
/**
 * 
 * @param {Object} obj
 * @returns
 */
function isEmpty(obj) {
    for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
            return false;
    }

    return true;
}



function getCurrencyCode(method){
	 var currentBasket = BasketMgr.getCurrentBasket();
     
	 if (!currentBasket) {
         return false;
     }

    if(method == 'hosted'){
    	method = appPreference.Apexx_hosted_currency;
    }
    
    if(method == 'paypal'){
    	method = appPreference.Apexx_paypal_currency;
    }
    if(method == 'direct'){
    	method = appPreference.Apexx_direct_credit_currency;
    }
    if(method == 'google'){
    	method = appPreference.Apexx_GooglePay_currency;
    }
    if(method == 'hosted'){
    	method = appPreference.Apexx_hosted_currency;
    }
    if(method == 'client_side'){
    	method = appPreference.Apexx_client_side_currency;
    }
	for each(currency in method ) {
        if(currency.value == currentBasket.currencyCode){
        	return true;
        };
	
	}
	return false;
}

/**
 * Create XML string for <merchant-account-id />
 * @param {string} currencyCode - Currency Code
 * @return {string} XML <merchant-account-id>MerchantID</merchant-account-id>
 */
function isAfterPayAllowed() {
        var currentBasket = BasketMgr.getCurrentBasket();
        var arr = new Array();
        
        if(!currentBasket){
        	return true;
        }
        if(currentBasket.currencyCode && currentBasket.custom.selectedShipCountry){
   	    var orderCurrency = currentBasket.currencyCode;
   		//var BillingCountryCode = currentBasket.billingAddress.countryCode.value;
   		for each(account in appPreference.Apexx_AfterPay_Account_IDs ) {
   		        var arrSplit = account.split('_');
   		        if(currentBasket.custom.selectedShipCountry == arrSplit[0] && orderCurrency == arrSplit[1] ){
   		        	arr.push(currentBasket.custom.selectedShipCountry)
   		        }
   			}
   	    }
       
	    if(!customer.authenticated || arr.length < 1){
	    	return true;
	    }
	    
    	return false;

}

/**
 * Create XML string for <merchant-account-id />
 * @param {string} currencyCode - Currency Code
 * @return {string} XML <merchant-account-id>MerchantID</merchant-account-id>
 */
function isAfterPayAllowedOnBilling() {
        var currentBasket = BasketMgr.getCurrentBasket();
        var arr = new Array();
        
        if(!currentBasket){
        	return true;
        }
        if(currentBasket.currencyCode && currentBasket.custom.selectedShipCountry){
   	    var orderCurrency = currentBasket.currencyCode;
   		var BillingCountryCode = currentBasket.billingAddress.countryCode.value;
   		
   		for each(account in appPreference.Apexx_AfterPay_Account_IDs ) {
   		        var arrSplit = account.split('_');
   		        if(BillingCountryCode == arrSplit[0] && orderCurrency == arrSplit[1] ){
   		        	arr.push(currentBasket.custom.selectedShipCountry)
   		        }
   			}
   	    }
        
	    if(!customer.authenticated || arr.length < 1){
	    	
	    	return true;
	    }
	    
    	return false;

}



/**
 * Create XML string for <merchant-account-id />
 * @param {string} currencyCode - Currency Code
 * @return {string} XML <merchant-account-id>MerchantID</merchant-account-id>
 */
function getAfterPayAccountId(order) {
	var orderCurrency = order.getCurrencyCode();
	var countryCode = order.billingAddress.countryCode.value;
    for each(account in appPreference.Apexx_AfterPay_Account_IDs ) {
        var arrSplit = account.split('_');
        
        if(countryCode === arrSplit[0] && orderCurrency === arrSplit[1]){
        	return arrSplit[2];
        	break;
        }
	}

    return false;
}


/**
 * Checks if APEXX payment method
 *
 * @param paymentMethodID
 * @returns {boolean} true/false
 */
function isApexxPaymentMethod(paymentMethodID,processorID) {
	var PaymentMgr = require('dw/order/PaymentMgr');
	var paymentProcessorID = (PaymentMgr.getPaymentMethod(paymentMethodID)).paymentProcessor.ID
	return (processorID === paymentProcessorID) ? true : false;
}




var apexxHelper = {
    log: log,
    isEmpty:isEmpty,
    getLogger:getLogger,
    formFieldsToObject:formFieldsToObject,
    convertFormToObject:convertFormToObject,
    deleteApexxPaymentInstruments:deleteApexxPaymentInstruments,
    getNonGiftCertificateAmount:getNonGiftCertificateAmount,
    isApexxPaymentMethod:isApexxPaymentMethod,
    floatToInt:floatToInt,
    intToFloat:intToFloat,
    isInt:isInt,
    getCurrencyCode:getCurrencyCode,
    updateTransactionHistory:updateTransactionHistory,
    isAfterPayAllowed:isAfterPayAllowed,
    getAfterPayAccountId:getAfterPayAccountId,
    isAfterPayAllowedOnBilling:isAfterPayAllowedOnBilling
};

module.exports = apexxHelper;
