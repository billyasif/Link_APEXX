'use strict';

var ApexxHelper = require('~/cartridge/scripts/util/apexxHelper');
var prefs = ApexxHelper.getPrefs();

var apexxServiceWrapper = require('*/cartridge/scripts/service/apexxServiceWrapper');
var OrderMgr = require('dw/order/OrderMgr');
var PaymentMgr = require('dw/order/PaymentMgr');
var Transaction = require('dw/system/Transaction');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var PaymentInstrument = require('dw/order/PaymentInstrument');

var commonHelper = require('*/cartridge/scripts/util/commonHelper');
var objectHelper = require('*/cartridge/scripts/util/objectHelper');
var collections = require('*/cartridge/scripts/util/collections');
var appPreference = require('~/cartridge/config/appPreference')();
var Resource = require('dw/web/Resource');
var endPoint = appPreference.SERVICE_HTTP_DIRECT_PAY;
var CONST = {
  APEXX_PAYMENT_METHOD: 'DW_APPLE_PAY',
  STATUS_PROCESSING: 'Processing'
};


/**
  *
  * @param {Object} responseBillingAddress billing data from apple response
  */
function setBillingAddress(responseBillingAddress) {
  var billingForm = server.forms.getForm('billing');
  var billingAddress = {
    firstName: responseBillingAddress.givenName,
    lastName: responseBillingAddress.lastName,
    address1: responseBillingAddress.addressLines[0],
    address2: responseBillingAddress.addressLines[1] ? responseBillingAddress.addressLines[1] : '',
    city: responseBillingAddress.locality,
    stateCode: responseBillingAddress.administrativeArea,
    postalCode: responseBillingAddress.postalCode,
    country: responseBillingAddress.countryCode,
    paymentMethod: paymentMethodID
  };
  billingForm.copyFrom(billingAddress);
}

/**
  *
  * @param {Object} responseShippingAddress billing data from apple response
  */
function setShippingAddress(responseShippingAddress) {
  var shippingForm = server.forms.getForm('shipping');
  var shippingAddress = {
    firstName: responseShippingAddress.givenName,
    lastName: responseShippingAddress.lastName,
    address1: responseShippingAddress.addressLines[0],
    address2: responseShippingAddress.addressLines[1] ? responseShippingAddress.addressLines[1] : '',
    city: responseShippingAddress.locality,
    stateCode: responseShippingAddress.administrativeArea,
    postalCode: responseShippingAddress.postalCode,
    country: responseShippingAddress.countryCode,
    phone: responseShippingAddress.phoneNumber
  };
  shippingForm.copyFrom(shippingAddress);
}

/**
  * Verifies that entered credit card information is a valid card. If the information is valid a
  * credit card payment instrument is created
  * @param {dw.order.Basket} basket Current users's basket
  * @param {Object} paymentInformation - the payment information
  * @return {Object} returns an error object
  */
function handle(basket, paymentInformation) {
  var currentBasket = basket;
  var transactionType = appPreference.Apexx_Direct_Capture == true ? "CAPTURE" : "AUTH";

  var cardErrors = {};
  var serverErrors = [];
  var error = false;
  Transaction.wrap(function() {
    var paymentInstruments = currentBasket.getPaymentInstruments();

    collections.forEach(paymentInstruments, function(item) {
      currentBasket.removePaymentInstrument(item);
    });

    var paymentInstrument = currentBasket.createPaymentInstrument(CONST.APEXX_PAYMENT_METHOD, currentBasket.totalGrossPrice);


  });


  return {
    fieldErrors: cardErrors,
    serverErrors: serverErrors,
    error: error
  };
}


/**
  * Authorize payment function
  * @param {string} orderNo Order Number
  * @param {Object} paymentInstr Instrument
  * @returns {Object} success object
  */
function authorize(orderNumber, paymentInstrument, paymentProcessor) {
  return {
    authorized: true
  };
}

function authorizeOrderPayment(order, responseData) {
  try {
    var status = Status.ERROR;
    var authResponseStatus;
    var paymentMethod = require('dw/order/PaymentMgr').getPaymentMethod(paymentMethodID);

    setBillingAddress(responseData.payment.billingContact);
    setShippingAddress(responseData.payment.shippingContact);
    Transaction.wrap(function() {
      //  lineItemCtnr.paymentInstrument field is deprecated.  Get default payment method.
      var paymentInstrument = null;
      if (!empty(order.getPaymentInstruments())) {
        paymentInstrument = order.getPaymentInstruments()[0];
        paymentInstrument.paymentTransaction.paymentProcessor = paymentMethod.getPaymentProcessor();
      } else {
        return new Status(status);
      }
      paymentInstrument.paymentTransaction.paymentProcessor = paymentMethod.getPaymentProcessor();
    });
    authResponseStatus = require('~/cartridge/scripts/mobilepayments/adapter/MobilePaymentsAdapter').processPayment(order);


    if (CardHelper.HandleCardResponse(authResponseStatus.ServiceResponse.serviceResponse).authorized || CardHelper.HandleCardResponse(authResponseStatus.ServiceResponse.serviceResponse).review) {
      status = Status.OK;
    }

    return new Status(status);
  } catch (error) {
    var errorObj = {
      error: true,
      errorCode: error.name,
      errorMessage: error.message,
      errorResponse: error.message
    }
    return authorizeFailedFlow(order, paymentProcessor, paymentInstrument, errorObj);
  }
};




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

  });
  return {
    error: apexxError.error,
    errorCode: apexxError.errorCode,
    errorMessage: apexxError.errorMessage,
    errorResponse: apexxError.errorResponse
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
  var transactionType = appPreference.Apexx_Direct_Capture == true ? "CAPTURE" : "AUTH";

  Transaction.wrap(function() {

    if (responseTransaction.status == "CAPTURED") {
      paymentTransaction.setType(PT.TYPE_CAPTURE);
      orderRecord.custom.apexxTransactionType = transactionType;
      orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_PAID);
      orderRecord.custom.apexxPaidAmount = authAmount;
      orderRecord.custom.apexxCaptureAmount = paidAmount;
      paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message;

    } else if (responseTransaction.status == "AUTHORISED") {
      paymentTransaction.setType(PT.TYPE_AUTH);
      orderRecord.custom.apexxTransactionType = transactionType;
      orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
      paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message;

    } else if (responseTransaction.status == "DECLINED") {
      orderRecord.custom.apexxTransactionType = transactionType;
      orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
      paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message;

    } else if (responseTransaction.status == "FAILED") {
      orderRecord.custom.apexxTransactionType = transactionType;
      orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
      paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.reason_message;

    }

    if (('status' in responseTransaction) === false) {
      if (responseTransaction._id) {
        paymentTransaction.setTransactionID(responseTransaction._id);
      }
      paymentInstrumentRecord.custom.apexxReasonCode = responseTransaction.message;
      orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
      orderRecord.custom.apexxTransactionType = transactionType;
      orderRecord.custom.apexxTransactionStatus = "FAILED";
      orderRecord.custom.isApexxOrder = true;

      return;
    }
    paymentTransaction.setTransactionID(responseTransaction._id);
    paymentTransaction.setPaymentProcessor(paymentProcessor);


    if (responseTransaction.amount) {
      paymentTransaction.setAmount(new Money(responseTransaction.amount, orderRecord.getCurrencyCode()));
    }

    orderRecord.custom.apexxTransactionStatus = (responseTransaction.status === "CAPTURED") ? CONST.STATUS_PROCESSING : responseTransaction.status;

    orderRecord.custom.isApexxOrder = true;
    orderRecord.custom.apexxAuthAmount = responseTransaction.authorization_code ? authAmount : 0.0;
    orderRecord.custom.apexxTransactionID = responseTransaction._id;
    orderRecord.custom.apexxMerchantReference = responseTransaction.merchant_reference;
    paymentInstrumentRecord.custom.apexx3dSecureStatus = appPreference.Apexx_GooglePay_Three_Ds_Yes_No;
    paymentInstrumentRecord.custom.apexxAuthorizationCode = responseTransaction.authorization_code;

    commonHelper.updateTransactionHistory(responseTransaction.status, orderRecord, responseTransaction, responseTransaction.amount);


  });

}
exports.handle = handle;
exports.authorizeOrderPayment = authorizeOrderPayment;
exports.authorize = authorize;