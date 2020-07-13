/**
 * Utility functions for the cartridge
 */

/* API Includes */
var Site = require('dw/system/Site');
var System = require('dw/system/System');
var Transaction = require('dw/system/Transaction');
var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var Mac = require('dw/crypto/Mac');
var Encoding = require('dw/crypto/Encoding');

/* Script Includes */
var LogUtils = require('~/cartridge/scripts/util/apexxLogUtils');

var Utils = {};

Utils.log = LogUtils.getLogger('ApexxUtils');


/**
 * Returns round value of a number in Apexx order details page
 * @param {number} value - number
 * @returns {number} round number
 */
Utils.round = function (value) {
    var num = Math.round(value * 100) / 100;
    if (Math.abs(num) < 0.0001) {
        return 0.0;
    } else { // eslint-disable-line no-else-return
        return num;
    }
};

/**
 * Return amount
 * @param {value} value - float
 * @return {intValue} Integer
 */

Utils.floatToInt = function(value){
	
	var intValue = '0';
	if(value && Utils.isInt(value)){
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
Utils.intToFloat = function(value){
    var floatValue = '0.0';
	
	if(value &&  Utils.isInt(value)){
		var intVal = parseInt(value);
		floatValue = intVal / 100;
		floatValue = parseFloat(floatValue);
	}
  return floatValue;
}

/**
 * Return parsed string
 * @param {value} value - string
 * @return {val} Parsed String
 */
Utils.stringParse = function(value){
	var val;
	if(value){
		val = parseInt(value)
	}
	return val;
}

/**
 * Read the Hook Request from custom object if Hook called earlier than the order creation and update order
 * @param {Object} order - order object
 * @param {Object} req - req object
 */
Utils.updateOrderHookRequest = function (order, req) {
    if (order.custom.apexxTransactionID !== req.id || order.custom.apexxTransactionReference !== req.reference || order.custom.apexxTransactionType !== req.type || order.custom.apexxTransactionStatus !== req.status) {
        var transactionHistory = order.custom.apexxTransactionHistory || '[]';
        var amount = req.amount ? req.amount / 100 : 0.0;
        var captureAmount = 0.0;
        var refundAmount = 0.0;

        transactionHistory = JSON.parse(transactionHistory);

        if (req.type === 'capture' || req.type === 'payment') {
            // Take the amount from last capture action. Capture hook response contains order amount which is wrong for partial capture
            for (var i = 0; i < transactionHistory.length; i++) {
                if (transactionHistory[i].action && transactionHistory[i].action === 'capture') {
                    amount = transactionHistory[i].amount;
                    captureAmount += transactionHistory[i].amount;
                }
            }
        }

        for (var j = 0; j < transactionHistory.length; j++) {
            if (transactionHistory[j].action && transactionHistory[j].action === 'credit') {
                refundAmount += transactionHistory[j].amount;
            }
        }

        transactionHistory.push({
            id: req.id,
            reference: req.reference,
            type: req.type,
            status: req.status,
            amount: amount,
            date: (new Date()).getTime()
        });

        Transaction.begin();
        order.custom.apexxTransactionID = req.id;
        order.custom.apexxTransactionReference = req.reference;
        order.custom.apexxTransactionType = req.type;
        order.custom.apexxTransactionStatus = req.status;
        order.custom.apexxTransactionHistory = JSON.stringify(transactionHistory);

        if (req.type === 'payment') {
            order.custom.apexxPaidAmount = amount;
            order.custom.apexxCaptureAmount = captureAmount;
        } else if (req.type === 'capture') {
            order.custom.apexxPaidAmount = captureAmount - refundAmount;
            order.custom.apexxCaptureAmount = captureAmount;
        }

        if (req.type === 'auth') {
            order.custom.apexxAuthAmount = amount;
        }
        Transaction.commit();

        Utils.log.debug('Hook call updated the status of order ' + order.custom.apexxDWLinkOrderID);
    } else {
        Utils.log.debug('Hook skipped for order ' + order.custom.apexxDWLinkOrderID + ' since no status change.');
    }
};

/**
 * Converts state name to state code
 * @param {string} countryCode - country code
 * @param {string} stateName - state name
 * @returns {string} state code or state name
 */
Utils.getStateCode = function (countryCode, stateName) {
    var stateCodeList = require('~/cartridge/scripts/util/stateCodeList');
    var countries = stateCodeList.countries || [];
    var stateCode = '';
    var states = [];

    for (var i = 0; i < countries.length; i++) {
        if (countries[i].code && countries[i].code === countryCode) {
            states = countries[i].states || [];
            for (var j = 0; j < states.length; j++) {
                if (states[j].name && states[j].name === stateName) {
                    stateCode = states[j].code || '';
                }
            }
        }
    }

    return stateCode || stateName;
};

/**
 * Checks whether a system preference is defined or not.
 * return the preference value if defined, otherwise null
 * @param {string} preferenceID - global custom preference id
 * @returns {Object} global custom preference
 */
Utils.getSystemPreference = function (preferenceID) {
    if (!(preferenceID in System.getPreferences().getCustom())) {
        return null;
    }
    return System.getPreferences().getCustom()[preferenceID];
};

Utils.isInt =  function (n){
	if (isNaN(n)) {
       return false;
    }else{
      return true;
    }
    
}



module.exports = Utils;
