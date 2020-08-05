'use strict';
var applePayProcessor = require('*/cartridge/scripts/apexx/applePayProcessor');


/**
 * Create Apexx payment instrument and update shipping and billing address, if the new one was given
 * @param {Object} basket Arguments of the HTTP call
 * @returns {Object} handle call result
 */
function Handle(basket, paymentInformation) {
    var result = applePayProcessor.handle(basket, paymentInformation);
    return result;
}

/**
 * Create sale transaction and handle result
 * @param {string} orderNumber Order Number
 * @param {Object} paymentInstrument Payment Instrument
 * @returns {Object} sale call result
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var result = applePayProcessor.authorize(orderNumber, paymentInstrument, paymentProcessor);
    return result;
}



exports.Handle = Handle;
exports.Authorize = Authorize;