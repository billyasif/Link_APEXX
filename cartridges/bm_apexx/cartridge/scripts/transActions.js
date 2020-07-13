'use strict';

/**
 * Apexx Transaction Actions
 */

/* API Includes */
var OrderMgr = require('dw/order/OrderMgr');
var Transaction = require('dw/system/Transaction');
var Resource = require('dw/web/Resource');
var StringUtils = require('dw/util/StringUtils');
var Calendar = require('dw/util/Calendar');

/* Script Modules */
var Utils = require('*/cartridge/scripts/util/apexxUtils');
var LogUtils = require('*/cartridge/scripts/util/apexxLogUtils');
var log = LogUtils.getLogger('TransActions');
var apexxServiceWrapperBM = require('~/cartridge/scripts/service/apexxServiceWrapperBM');
var appPreferenceBM = require('~/cartridge/config/appPreferenceBM');



/**
 * Call action
 * @param {string} endPoint - api URL
 * @param {Object} request - request object
 * @returns {Object} response
 */
function callAction(endPoint, payLoad) {

    var response = apexxServiceWrapperBM.makeServiceCall('POST', endPoint, payLoad);

    return response;
}

/**
 * Updates the order status
 * @param {string} orderNo - order no
 */
function updateOrderStatus(orderNo) {
    var Order = OrderMgr.getOrder(orderNo);

    try {
        Transaction.begin();
        Order.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
        Order.setStatus(Order.ORDER_STATUS_CANCELLED);
        Transaction.commit();
    } catch (e) {
        Transaction.rollback();
        log.error('Exception occured while updating the order status after Refund Transaction' + e);
    }
}

/**
 * Credit action
 * @param {string} orderNo - order no
 * @param {string} amount - refund amount
 * @returns {Object} response
 */
function refundTransaction(orderNo, amount) {
    var order = OrderMgr.searchOrder('orderNo = {0}', orderNo);
    var endPoint = appPreferenceBM.SERVICE_HTTP_REFUND;
    var status = false;
    var transactionHistory;
    var transactionID = order.getPaymentTransaction().transactionID;
    var captureID = order.custom.apexxCaptureId || '';
    var error;
    var refundAmount;
    var payLoad;
    var response;
    var paidAmount;
    
   //try {
        refundAmount = amount;
        payLoad = makeRefundRequest(order, refundAmount, transactionID, captureID);
        log.debug('Refund request: ' + JSON.stringify(payLoad));
        response = callAction(endPoint, payLoad);
       

        if (response && response.ok === false) {
        	  status = false;
              response = JSON.stringify(response.object);
              paidAmount = order.custom.apexxPaidAmount;
              error = response;
        } else if (response) {
            status = true;
            paidAmount = parseFloat(order.custom.apexxPaidAmount, 10) - refundAmount;
            setOrderAttributesHistory('refund', order, response, paidAmount);
            updateTransactionHistory('refund', order, response, amount);
            if (paidAmount === 0) {
                updateOrderStatus(orderNo);
            }
        } else {
            status = false;
            response = JSON.stringify(response.object);
            error = response;
        }
//    } catch (e) {
//        log.error('Exception occurred: ' + e.message);
//
//    }

    return {
        status: status,
        error: error
    };
}



/**
 * Cancel(void) operation
 * @param {string} orderNo - order no
 * @returns {Object} response
 */
function cancelTransaction(orderNo) {
    var order = OrderMgr.searchOrder('orderNo = {0}', orderNo);
    var endPoint = appPreferenceBM.SERVICE_HTTP_BASE_API_URL;
    var transactionID;
    var amount;
    var status;
    var error;
    var payLoad;
    var response;
    var paidAmount;
   // try {
        transactionID = order.getPaymentTransaction().transactionID;
        amount = order.custom.apexxAuthAmount || '';
        payLoad = makeCancelRequest(orderNo, transactionID);
        log.debug('cancel request: ' + JSON.stringify(payLoad));
        response = callAction(endPoint, payLoad);


        if (response && response.ok === false) {
            status = false;
            response = JSON.stringify(response.object);
            paidAmount = order.custom.apexxPaidAmount;
            error = response;
        } else if (response) {
            status = true;
            setOrderAttributesHistory('cancel', order, response, paidAmount);
            updateTransactionHistory('cancel', order, response, amount);
            updateOrderStatus(orderNo);
        } else {
            status = false;
            response = JSON.stringify(response.object);
            error = response;
        }
//    } catch (e) {
//        log.error('Exception occurred: ' + e.message);
//
//    }

    return {
        status: status,
        error: error
    };
}



/**
 * Capture action
 * @param {string} orderNo - order no
 * @param {string} amount - apture amount
 * @returns {Object} response
 */
function captureTransaction(orderNo, amount) {
    var order = OrderMgr.searchOrder('orderNo = {0}', orderNo);
    var status = false;
    var amount = amount;
    var transactionID = order.getPaymentTransaction().transactionID;
    var endPoint = appPreferenceBM.SERVICE_HTTP_CAPTURE;
    var payLoad = makeCaptureRequest(order, amount , transactionID);

    var request;
    var response;
    var error;
    var paidAmount;
   // try {
        // eslint-disable-line no-param-reassign
        var response = callAction(endPoint, payLoad);
        
        if (response && response.ok === false) {
            status = false;
            response = JSON.stringify(response.object);
            error = response;

        } else if (response && response.object.status != 'DECLINED') {
            status = true;
            paidAmount = parseFloat(amount);
            setOrderAttributesHistory('capture', order, response, paidAmount);
            updateTransactionHistory('capture', order, response, amount);
        } else {
            status = false;
            response = JSON.stringify(response.object);
            error = response;
        }
//    } catch (e) {
//        log.error('Exception occurred: ' + e.message);
//    }

    return {
        status: status,
        error: error
    };
}


/**
 * Generate Capture Request
 * @param {Object} order - order object
 * @param {string} amount - capture amount
 * @param {string} transactionID - transaction id
 * @returns {Object} transaction details
 */
function makeCaptureRequest(order, amount, transactionID) {
    var orderNo = order.orderNo;
    return {
        amount: amount,
        capture_reference: orderNo,
        endPointUrl: transactionID,
    }
}

/**
 * Generate credit Request
 * @param {Object} order - order object
 * @param {string} amount - refund amount
 * @param {string} transactionID - transaction id
 * @returns {Object} transaction details
 */
function makeRefundRequest(order, amount, transactionID, captureID) {
    return {
        amount: amount,
        endPointUrl: transactionID
    };
}

/**
 * generate Void Request
 * @param {string} captureID - Capture ID
 * @returns {Object} Capture object
 */
function makeCancelRequest(orderNo, transactionID) {
    var endPointUrl = transactionID + '/cancel';
    return {
        endPointUrl: endPointUrl || '',
        cancel_capture_reference: orderNo
    };
}


/**
 * Keeps the transaction details in order custom attributes and history
 * @param {string} action - transaction action
 * @param {Object} order - order object
 * @param {Object} response -response object
 * @param {string} paidAmount - paid amount
 */
function setOrderAttributesHistory(action, order, response, paidAmount) {
    var transactionHistory = order.custom.apexxTransactionHistory || '[]';
    var captureAmount = order.custom.apexxCaptureAmount;
    var authAmount = Utils.round(order.custom.apexxAuthAmount || 0.0);

    var response = response.object;
    var amount;

    if (action === 'capture') {
        // eslint-disable-next-line
        amount = response.amount ? parseFloat(response.amount) : 0.0;
        captureAmount += amount;
        paidAmount = order.custom.apexxPaidAmount + paidAmount; // eslint-disable-line no-param-reassign
    } else {
        amount = response.amount ? response.amount : 0.0;
    }

    if (action === 'capture') {
        var transactionStatus = (response.status && captureAmount < authAmount) ? "PAYMENT_STATUS_PARTPAID" : response.status;
        Transaction.wrap(function() {
            order.custom.apexxCaptureId = response._id || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxMerchantReference = response.merchant_reference || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxTransactionStatus = transactionStatus || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxCaptureAmount = captureAmount; // eslint-disable-line no-param-reassign
            order.custom.apexxPaidAmount = paidAmount; // eslint-disable-line no-param-reassign
        });
    };

    if (action === 'cancel') {
        var transactionStatus = response.status ? response.status : "";
        var cancelAmount = (paidAmount - amount) ? paidAmount - amount : 0.0;
        Transaction.wrap(function() {
            order.custom.apexxTransactionStatus = transactionStatus || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxPaidAmount = cancelAmount; // eslint-disable-line no-param-reassign
        });
    }
    return action;
    if (action === 'refund') {
        var transactionStatus = response.status ? response.status : "";
        Transaction.wrap(function() {
            order.custom.apexxTransactionStatus = transactionStatus || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxPaidAmount = paidAmount; // eslint-disable-line no-param-reassign
        });
    }


    return true;

}


function updateTransactionHistory(action, order, response, amount) {
	
    var transactionHistory = order.custom.apexxTransactionHistory || '[]';
    var response = response.object;
    var transactionType = action.toUpperCase() || '';
    
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




function getDateFormat(format) {

    var date = StringUtils.formatCalendar(new Calendar(new Date()), format);
    return date;
}


exports.captureTransaction = function(orderNo, amount) {
    return captureTransaction(orderNo, amount);
};
exports.refundTransaction = function(orderNo, amount) {
    return refundTransaction(orderNo, amount);
};
exports.cancelTransaction = function(orderNo) {
    return cancelTransaction(orderNo);
};