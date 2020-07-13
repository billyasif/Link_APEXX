'use strict';

var hostedProcessor = require('~/cartridge/scripts/apexx/hostedProcessor');


/**
 * Create Apexx Hosted payment instrument and update shipping and billing address, if the new one was given
 * @param {Object} basket Basket
 * @returns {Object} handle call result
 */
function Handle(basket, paymentInformation) {
    var result = hostedProcessor.handle(basket, paymentInformation);
    return result;
}




/**
 * Create sale transaction and handle result
 * @param {string} orderNumber Order Number
 * @param {Object} paymentInstrument Payment Instrument
 * @returns {Object} sale call result
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var result = hostedProcessor.authorize(orderNumber, paymentInstrument, paymentProcessor);
    return result;
}

exports.Handle = Handle;
exports.Authorize = Authorize;
