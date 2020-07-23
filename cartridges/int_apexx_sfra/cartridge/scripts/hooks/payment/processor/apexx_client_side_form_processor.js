'use strict';
/* globals request, session */

var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');

/**
 * Verifies the required information for billing form is provided.
 * @param {Object} req - The request object
 * @param {Object} paymentForm - the payment form
 * @param {Object} viewFormData - object contains billing form data
 * @returns {Object} an object that has error information or payment information
 */
function processForm(req, paymentForm, viewFormData) {
    var array = require('*/cartridge/scripts/util/array');
    var viewData = viewFormData;
    var creditCardErrors = {};

    if (!req.form.storedPaymentUUID) {
        // verify credit card form data
        creditCardErrors = COHelpers.validateCreditCard(paymentForm);
    }
    
    if (Object.keys(creditCardErrors).length) {
        return {
            fieldErrors: creditCardErrors,
            error: true
        };
    }

    viewData.paymentMethod = {
        value: paymentForm.paymentMethod.value,
        htmlName: paymentForm.paymentMethod.value
    };

    viewData.paymentInformation = {
    	
        cseCardOwner: {
            value: paymentForm.creditCardClientFields.cseCardOwner.value,
            htmlName: paymentForm.creditCardClientFields.cseCardOwner.htmlName
        },
        cseCardNumber: {
            value: paymentForm.creditCardClientFields.cseCardNumber.value,
            htmlName: paymentForm.creditCardClientFields.cseCardNumber.htmlName
        },
        cseSecurityCode: {
            value: paymentForm.creditCardClientFields.cseSecurityCode.value,
            htmlName: paymentForm.creditCardClientFields.cseSecurityCode.htmlName
        },
        cseExpirationMonth: {
            value: parseInt(paymentForm.creditCardClientFields.cseExpirationMonth.value, 10),
            htmlName: paymentForm.creditCardClientFields.cseExpirationMonth.htmlName
        },
        cseExpirationYear: {
            value: parseInt(paymentForm.creditCardClientFields.cseExpirationYear.value, 10),
            htmlName: paymentForm.creditCardClientFields.cseExpirationYear.htmlName
        },
        cseEncryptedData: {
            value: paymentForm.creditCardClientFields.cseEncryptedData.value,
            htmlName: paymentForm.creditCardClientFields.cseEncryptedData.htmlName
        }
    };

    return {
        error: false,
        viewData: viewData
    };
}


exports.processForm = processForm;
