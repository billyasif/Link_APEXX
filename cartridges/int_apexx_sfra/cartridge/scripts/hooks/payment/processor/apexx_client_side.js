'use strict';
var clientSideProcessor = require('*/cartridge/scripts/apexx/clientSideProcessor');


/**
 * Create Apexx payment instrument and update shipping and billing address, if the new one was given
 * @param {Object} basket Arguments of the HTTP call
 * @returns {Object} handle call result
 */
function Handle(basket, paymentInformation) {
    var result = clientSideProcessor.handle(basket, paymentInformation);
    return result;
}

/**
 * Create sale transaction and handle result
 * @param {string} orderNumber Order Number
 * @param {Object} paymentInstrument Payment Instrument
 * @returns {Object} sale call result
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var result = clientSideProcessor.authorize(orderNumber, paymentInstrument, paymentProcessor);
    return result;
}



exports.Handle = Handle;
exports.Authorize = Authorize;
