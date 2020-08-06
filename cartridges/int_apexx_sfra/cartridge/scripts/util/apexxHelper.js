'use strict';

var system = require('dw/system');
var dworder = require('dw/order');
var Resource = require('dw/web/Resource');
var Money = require('dw/value/Money');
var CustomerMgr = require('dw/customer/CustomerMgr');

var getPreference = require('~/cartridge/config/appPreference');

var ApexxHelper = {
    prefs: getPreference()
};
var prefs = ApexxHelper.prefs;

/**
 * Parse error from API call
 * @param {Object} errorResponse error response from apexx
 * @returns {string} Parsed error
 */
ApexxHelper.createErrorMessage = function (errorResponse) {
    var result = [];
    var errorMsg = null;

    /**
     * Parse error from API call
     * @param {Object} objectToBeParsed error response from apexx
     */
    function parseErrors(objectToBeParsed) {
        var obj = objectToBeParsed;
        if (typeof obj !== 'object') {
            return;
        }
        for (var name in obj) { // eslint-disable-line no-restricted-syntax
            if (String(name) === 'processorResponseText') {
                if (!obj.processorResponseCode) {
                    obj.processorResponseCode = 'unknown';
                }
                errorMsg = Resource.msg('apexx.server.processor.error.' + obj.processorResponseCode, 'locale', 'none');
                if (String(errorMsg) === 'none') {
                    errorMsg = obj.processorResponseText;
                }
                ApexxHelper.getLogger().error(Resource.msgf('apexx.server.error.forlogger', 'locale', null, obj.processorResponseCode, obj.processorResponseText));
                result.push(errorMsg);
            }
            if (String(name) === 'errors' && obj[name] instanceof Array) {
                obj[name].forEach(function (error) { // eslint-disable-line no-loop-func
                    errorMsg = Resource.msg('apexx.server.error.' + error.code, 'locale', 'none');
                    if (String(errorMsg) === 'none') {
                        errorMsg = error.message;
                    }
                    ApexxHelper.getLogger().error(Resource.msgf('apexx.server.error.forlogger', 'locale', null, error.code, error.message));
                    result.push(errorMsg);
                });
            } else {
                parseErrors(obj[name]);
            }
        }
    }

    if (!empty(errorResponse.message)) {
        result.push(errorResponse.message);
    }

    parseErrors(errorResponse);

    var filteredResult = result.filter(function (item, pos) {
        return result.indexOf(item) === pos;
    });


    return filteredResult.join('\n');
};

/**
 * All preferences of Apexx integration
 *
 * @returns {Object} Object with preferences
 */
ApexxHelper.getPrefs = function () {
    return prefs;
};

/**
 * Calculate amount of gift certificates in the order
 * @param {dw.order.Order} order Order object
 * @return {dw.value.Money} Certificates total
 */
ApexxHelper.calculateAppliedGiftCertificatesAmount = function (order) {
    var amount = new Money(0, order.getCurrencyCode());
    var paymentInstruments = order.getGiftCertificatePaymentInstruments();

    var iterator = paymentInstruments.iterator();
    var paymentInstrument = null;
    while (iterator.hasNext()) {
        paymentInstrument = iterator.next();
        amount = amount.add(paymentInstrument.getPaymentTransaction().getAmount());
    }

    return amount;
};

/**
 * Calculate order amount
 * @param {dw.order.Order} order Order object
 * @return {dw.value.Money} New Amount value
 */
ApexxHelper.getAmount = function (order) {
    var appliedGiftCertificatesAmount = ApexxHelper.calculateAppliedGiftCertificatesAmount(order);
    var amount = order.getTotalGrossPrice().subtract(appliedGiftCertificatesAmount);
    return amount;
};

/**
 * Creates or get logger
 *
 * @returns {Object} Object with logger for API operation
 */
ApexxHelper.getLogger = function () {
    var errorMode = prefs.APPEX_Logging_Mode === 'none' ? false : prefs.APEXX_Logging_Mode;
    var logger = system.Logger.getLogger('Apexx', 'Apexx_General');

    return {
        error: function (msg) {
            if (errorMode) {
                logger.error(msg);
            }
        },
        info: function (msg) {
            if (errorMode && errorMode !== 'errors') {
                logger.info(msg);
            }
        },
        warn: function (msg) {
            if (errorMode && errorMode !== 'errors') {
                logger.warn(msg);
            }
        }
    };
};

ApexxHelper.isApexxButtonEnabled = function (targetPage) {
    var displayPages = prefs.APPEX_HOSTED_Button_Location.toLowerCase();
    if (displayPages === 'none' || !targetPage) {
        return false;
    }
    return displayPages.indexOf(targetPage) !== -1;
};

/**
 * Create address data
 * @param {dw.order.OrderAddress} address Address data from order
 * @return {Object} transformed data object
 */
ApexxHelper.createAddressData = function (address) {
    return {
        company: address.getCompanyName(),
        countryCodeAlpha2: address.getCountryCode().getValue().toUpperCase(),
        countryName: address.getCountryCode().getDisplayValue(),
        firstName: address.getFirstName(),
        lastName: address.getLastName(),
        locality: address.getCity(),
        postalCode: address.getPostalCode(),
        region: address.getStateCode(),
        streetAddress: address.getAddress1(),
        extendedAddress: address.getAddress2(),
        phoneNumber: address.getPhone()
    };
};

/**
 * Create customer data for API call
 * @param {dw.order.Order} order Order object
 * @return {Object} Customer data for request
 */
ApexxHelper.createCustomerData = function (order) {
    var customer = order.getCustomer();
    var result = null;
    var billingAddress = order.getBillingAddress();
    var shippingAddress = order.getDefaultShipment().getShippingAddress();
    if (customer.isRegistered()) {
        var profile = customer.getProfile();
        result = {
            id: ApexxHelper.createCustomerId(customer),
            firstName: profile.getFirstName(),
            lastName: profile.getLastName(),
            email: profile.getEmail(),
            phone: profile.getPhoneMobile() || profile.getPhoneHome() || profile.getPhoneBusiness() || billingAddress.getPhone() || shippingAddress.getPhone(),
            company: profile.getCompanyName(),
            fax: profile.getFax()
        };
    } else {
        result = {
            id: null,
            firstName: billingAddress.getFirstName(),
            lastName: billingAddress.getLastName(),
            email: order.getCustomerEmail(),
            phone: billingAddress.getPhone() || shippingAddress.getPhone(),
            company: '',
            fax: ''
        };
    }

    return result;
};

/**
 * Create customer ID for apexx based on the customer number
 * @param {dw.customer.Customer} customer  Customer object
 * @return {string} Customer ID
 */
ApexxHelper.createCustomerId = function (customer) {
    if (customer.isRegistered()) {
        var id = customer.getProfile().getCustomerNo();
        var siteName = system.Site.getCurrent().getID().toLowerCase();
        var allowNameLength = 31 - id.length;
        if (siteName.length > allowNameLength) {
            siteName = siteName.slice(0, allowNameLength);
        }
        return siteName + '_' + id;
    }
    return null;
};

/**
 * Remove underscore and capitalize first letter in payment status
 * @param {string} status payment status
 * @return {string} Formatted payment status
 */
ApexxHelper.parseStatus = function (status) {
    var result = null;
    try {
        var firstLetter = status.charAt(0);
        result = status.replace(/_/g, ' ').replace(firstLetter, firstLetter.toUpperCase());
    } catch (error) {
        ApexxHelper.getLogger().error(error);
    }

    return result;
};

/**
 * Get apexx payment instrument from array of payment instruments
 * @param {dw.order.LineItemCtnr} lineItemContainer Order object
 * @return {dw.order.OrderPaymentInstrument} Apexx Payment Instrument
 */
ApexxHelper.getApexxPaymentInstrument = function (lineItemContainer) {
    var paymentInstruments = lineItemContainer.getPaymentInstruments();
    var apexxPaymentInstrument = null;

    var iterator = paymentInstruments.iterator();
    var paymentInstrument = null;
    while (iterator.hasNext()) {
        paymentInstrument = iterator.next();
        var paymentProcessorId = dworder.PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor().getID();

        if (paymentProcessorId === 'APEXX_HOSTED') {
            apexxPaymentInstrument = paymentInstrument;
            break;
        }
    }

    return apexxPaymentInstrument;
};

/**
 * Delete all apexx payment instruments from the lineItemContainer
 * @param {dw.order.LineItemCtnr} lineItemContainer Order object
 */
ApexxHelper.deleteApexxhostedPaymentInstruments = function (lineItemContainer) {
    var paymentInstruments = lineItemContainer.getPaymentInstruments();

    var iterator = paymentInstruments.iterator();
    var paymentInstrument = null;
    while (iterator.hasNext()) {
        paymentInstrument = iterator.next();

        var paymentProcessorId = 'APEXX_HOSTED';
        if (paymentProcessorId === 'APEXX_HOSTED') {
            lineItemContainer.removePaymentInstrument(paymentInstrument);
        }
    }
};

/**
 * Parse customer name from single string
 * @param {string} name name string
 * @return {Object} name object
 */
ApexxHelper.createFullName = function (name) {
    var names = name.trim().replace(/\s\s+/g, ' ').split(' ');
    var firstName = names[0];
    var secondName = null;
    var lastName = null;

    if (names.length === 3) {
        secondName = names[1];
        lastName = names[2];
    } else if (names.length === 2) {
        lastName = names[1];
    } else {
        firstName = name;
    }

    return {
        firstName: firstName,
        secondName: secondName,
        lastName: lastName
    };
};

/**
 * Get customer payment instrument by uuid
 * @param {string} uuid uuid for PI
 * @return {dw.customer.CustomerPaymentInstrument} cutomet payment indstrument
 */
ApexxHelper.getCustomerPaymentInstrument = function (uuid) {
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
 * Return specific payment method from customers payment methods list
 * @param {string} paymentMethodName Name of the payment method
 * @param {string} customerId Customer id
 * @return {Object} Payment method from customers payment methods list
 */
ApexxHelper.getCustomerPaymentInstruments = function (paymentMethodName, customerId) {
    var profile = null;

    if (customerId) {
        profile = CustomerMgr.getProfile(customerId.indexOf('_') >= 0 ? customerId.split('_')[1] : customerId);
    } else {
        profile = customer.authenticated ? customer.getProfile() : null;
    }
    if (!profile) {
        return null;
    }
    return profile.getWallet().getPaymentInstruments(paymentMethodName);
};

/**
 * Get default customer Apexx payment instrument
 * @param {string} customerId Apexx customer id or dw cusomer id. If customer id is null, returns payment instruments of current customer
 * @return {dw.customer.CustomerPaymentInstrument} payment instrument
 */
ApexxHelper.getDefaultCustomerApexxPaymentInstrument = function (customerId) {
    var instruments = ApexxHelper.getCustomerPaymentInstruments(prefs.apexxMethodName, customerId);
    if (instruments) {
        var iterator = instruments.iterator();
        var instrument = null;
        while (iterator.hasNext()) {
            instrument = iterator.next();
            if (instrument.custom.apexxDefaultCard) {
                return instrument;
            }
        }
    }
    return instruments && instruments.length ? instruments[0] : null;
};

/**
 * Get saved Apexx customer payment method instrument
 * @param {string} email Apexx account email
 * @return {dw.util.Collection} payment instruments
 */
ApexxHelper.getApexxCustomerApexxInstrumentByEmail = function (email) {
    var customerPaymentInstruments = ApexxHelper.getCustomerPaymentInstruments(prefs.apexxMethodName);
    if (customerPaymentInstruments) {
        var iterator = customerPaymentInstruments.iterator();
        var paymentInst = null;
        while (iterator.hasNext()) {
            paymentInst = iterator.next();
            if (paymentInst.custom.apexxApexxAccountEmail === email) {
                return paymentInst;
            }
        }
    }

    return null;
};

/**
 * isCountryCodesUpperCase()
 * true - if SiteGenesis uses uppercase for country code values
 * false - if SiteGenesis uses lowercase for country code values
 *
 * @returns {boolean} is country upper case
 */
ApexxHelper.isCountryCodesUpperCase = function () {
    var countryOptions = null;
    var billingForm = session.forms.billing;
    var isCountryUpperCase = true;
    if (billingForm && billingForm.billingAddress && billingForm.billingAddress.addressFields && billingForm.billingAddress.addressFields.country) {
        countryOptions = billingForm.billingAddress.addressFields.country.getOptions();
        for (var optionName in countryOptions) {
            var option = countryOptions[optionName];
            if (option.value && option.value.trim() !== '' && option.value === option.value.toLowerCase()) {
                isCountryUpperCase = false;
                break;
            }
        }
    }
    return isCountryUpperCase;
};

/**
 * Apply default shipping method for current cart
 * @param {dw.order.Basket} basket Active basket
 */
ApexxHelper.addDefaultShipping = function (basket) {
    if (!basket.getDefaultShipment().shippingMethod) {
        var shippingMethod = dworder.ShippingMgr.getDefaultShippingMethod();
        system.Transaction.wrap(function () {
            basket.getDefaultShipment().setShippingMethod(shippingMethod);
            dworder.ShippingMgr.applyShippingCost(basket);
            system.HookMgr.callHook(Resource.msg('apexx.basketCalculateHookName', 'preferences', 'dw.order.calculate'), 'calculate', basket);
        });
    }
};

/**
 * Returns a prepared custom fields string
 * @param {dw.order.Order} order Order
 * @return {string} custom fields string
 */
ApexxHelper.getCustomFields = function (order) {
    var paymentInstrument = ApexxHelper.getApexxPaymentInstrument(order);
    var paymentProcessorId = dworder.PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor().getID();
    var prefsCustomFields = [];
    var hookMethodName = 'credit';
    if(paymentProcessorId=='APEXX_HOSTED'){
    	prefsCustomFields = prefs.APPEX_HOSTED_Custom_Fields;
        hookMethodName = 'APEXX_HOSTED';
    }

    var cfObject = {};
    var piCfs = null;
    for (var fName in prefsCustomFields) {
        var f = prefsCustomFields[fName];
        var fArr = f.split(':');
        cfObject[fArr[0]] = fArr[1];
    }
    if (system.HookMgr.hasHook('apexx.customFields')) {
        var cfs = system.HookMgr.callHook('apexx.customFields', hookMethodName, { order: order, paymentInstrument: paymentInstrument });
        for (var field in cfs) {
            cfObject[field] = cfs[field];
        }
    }
    try {
        piCfs = JSON.parse(paymentInstrument.custom.apexxCustomFields);
    } catch (error) {
        piCfs = {};
    }
    for (var field1 in piCfs) {
        if (cfObject[field1] === undefined) {
            cfObject[field1] = piCfs[field1];
        }
    }
    var resultStr = '';
    for (var field2 in cfObject) {
        resultStr += '<' + field2 + '>' + cfObject[field2] + '</' + field2 + '>';
    }
    return resultStr;
};

ApexxHelper.getNonGiftCertificateAmount = function (basket) {
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
 * Save credit cart as customer payment method
 * @param {Object} createPaymentMethodResponseData Responce data from createPaymentMethod API call
 * @param {string} creditType card type
 * @param {string} creditOwner Credit card owner
 * @return {Object} Object with cart data
 */
ApexxHelper.saveCustomerCreditCard = function (createPaymentMethodResponseData, creditType, creditOwner) {
    var card = {
        expirationMonth: createPaymentMethodResponseData.creditCard.expirationMonth,
        expirationYear: createPaymentMethodResponseData.creditCard.expirationYear,
        number: Date.now().toString().substr(0, 11) + createPaymentMethodResponseData.creditCard.last4,
        type: creditType,
        owner: creditOwner,
        paymentMethodToken: createPaymentMethodResponseData.creditCard.token
    };
    try {
        system.Transaction.begin();
        var customerPaymentInstrument = customer.getProfile().getWallet().createPaymentInstrument(dworder.PaymentInstrument.METHOD_CREDIT_CARD);
        customerPaymentInstrument.setCreditCardHolder(card.owner);
        customerPaymentInstrument.setCreditCardNumber(card.number);
        customerPaymentInstrument.setCreditCardExpirationMonth(parseInt(card.expirationMonth, 10));
        customerPaymentInstrument.setCreditCardExpirationYear(parseInt(card.expirationYear, 10));
        customerPaymentInstrument.setCreditCardType(card.type);
        customerPaymentInstrument.custom.apexxPaymentMethodToken = card.paymentMethodToken;
        system.Transaction.commit();
    } catch (error) {
        system.Transaction.rollback();
        card = {
            error: error.customMessage ? error.customMessage : error.message
        };
    }
    return card;
};

/** Returns a three-letter abbreviation for this Locale's country, or an empty string if no country has been specified for the Locale
 *
 * @param {string} localeId locale id
 * @return {string} a three-letter abbreviation for this lLocale's country, or an empty string
 */
ApexxHelper.getISO3Country = function (localeId) {
    return require('dw/util/Locale').getLocale(localeId).getISO3Country();
};

/**
 * Gets the order discount amount by subtracting the basket's total including the discount from
 * the basket's total excluding the order discount.
 *
 * @param {dw.order.LineItemCtnr} lineItemContainer - Current users's basket
 * @returns {string} string that contains the value order discount
 */
ApexxHelper.getOrderLevelDiscountTotal = function (lineItemContainer) {
    return lineItemContainer.getAdjustedMerchandizeTotalPrice(false).subtract(lineItemContainer.getAdjustedMerchandizeTotalPrice(true)).getDecimalValue().toString();
};

/**
 * Gets required Level3 line items
 *
 * @param {dw.order.LineItemCtnr} dataLineItems - Current users's basket
 * @returns {Object} an object with required fields
 */
ApexxHelper.getLineItems = function (dataLineItems) {
    return dataLineItems.toArray().map(function (value) {
        return {
            name: value.getProductName().substring(0, 30),
            kind: 'debit',
            quantity: value.getQuantityValue(),
            unitAmount: value.getProduct().getPriceModel().getPrice().toNumberString(),
            unitOfMeasure: value.getProduct().custom.unitOfMeasure || '',
            totalAmount: value.getPrice().toNumberString(),
            taxAmount: value.getTax().toNumberString(),
            discountAmount: value.getPrice().subtract(value.getProratedPrice()).getDecimalValue().toString(),
            productCode: value.getProduct().getUPC(),
            commodityCode: value.getProduct().custom.commodityCode || ''
        };
    });
};

ApexxHelper.updateData = function (method, dataObject) {
    var customerProfile;
    if (method === 'removeCustomer' || method === 'bindCustomer') {
        var customerNumber = dataObject.customerId.substring(dataObject.customerId.indexOf('_') + 1);
        customerProfile = CustomerMgr.getProfile(customerNumber);
        system.Transaction.wrap(function () {
            customerProfile.custom.isApexxhosted = (method === 'bindCustomer');
        });
    } else if (method === 'updatePaymentMethod') {
        if (dataObject.deleteBillingAddress && dataObject.billingAddressId && dataObject.customerId) {
            var apexxApiCalls = require('~/cartridge/scripts/apexxhoste/apexxApiCalls');
            apexxApiCalls.deleteBillingAddress(dataObject.customerId, dataObject.billingAddressId);
        }
    } else if (method === 'deletePaymentMethod' && !empty(dataObject.customerId)) {
        var customerPaymentInstruments = ApexxHelper.getCustomerPaymentInstruments(dworder.PaymentInstrument.METHOD_CREDIT_CARD);
        customerProfile = CustomerMgr.getProfile(dataObject.customerId);
        if (!customerPaymentInstruments) {
            return;
        }
        var iterator = customerPaymentInstruments.iterator();
        var paymentInst = null;
        while (iterator.hasNext()) {
            paymentInst = iterator.next();
            if (dataObject.token === paymentInst.custom.apexxPaymentMethodToken) {
                try {
                    customerProfile.getWallet().removePaymentInstrument(paymentInst);
                } catch (error) {
                    throw new Error(error);
                }
            }
        }
    }
};


function IsApexxApplicable(){
	
	var basket = BasketMgr.getCurrentBasket();
	
	return true;
}

module.exports = ApexxHelper;
