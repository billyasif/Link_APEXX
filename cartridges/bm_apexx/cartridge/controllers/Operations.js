'use strict';

/**
 * Controller for backoffice transaction
 *
 */

/**
 * redirects to specific actions
 * */
function performAction() {
    var action = request.httpParameterMap.action.value; // eslint-disable-line no-undef
    var orderNo = request.httpParameterMap.orderno.value; // eslint-disable-line no-undef
    var amount = request.httpParameterMap.amount.value; // eslint-disable-line no-undef
    var transActions = require('~/cartridge/scripts/transActions');
    var result;
  
    
    switch (action) { // eslint-disable-line default-case
    case 'capture':
        result = transActions.captureTransaction(orderNo, amount);
        break;
    case 'cancel':
        result = transActions.cancelTransaction(orderNo);
        break;
    case 'refund':
        result = transActions.refundTransaction(orderNo, amount);
        break;
    }
   
    var r = require('~/cartridge/scripts/util/response');
    r.renderJSON(result);

}

/*
 * Exposed web methods
 */
performAction.public = true;

exports.Action = performAction;
