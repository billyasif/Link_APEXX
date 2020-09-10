"use strict";

var ApexxConstants = {};

// Method Names
ApexxConstants.APEXX_GOOGLEPAY_PAYMENT_METHOD = "APEXX_GOOGLEPAY";
ApexxConstants.APEXX_CLIENT_SIDE_PAYMENT_METHOD = "APEXX_CLIENT_SIDE";
ApexxConstants.APEXX_AFTERPAY_PAYMENT_METHOD = "APEXX_AFTERPAY";
ApexxConstants.APEXX_HOSTED_PAYMENT_METHOD = "APEXX_HOSTED";
ApexxConstants.APEXX_PAYPAL_PAYMENT_METHOD = "APEXX_PAYPAL";
ApexxConstants.DW_APPLE_PAY_PAYMENT_METHOD = "DW_APPLE_PAY";
ApexxConstants.CREDIT_CARD_PAYMENT_METHOD = "CREDIT_CARD";


//Processor Name
ApexxConstants.PROCESSOR_AFTER_PAY = "APEXX_AfterPay";


//  Order and Payment Status and Reson
ApexxConstants.STATUS_PROCESSING = "Processing";
ApexxConstants.STATUS_CAPTURED = "CAPTURED";
ApexxConstants.STATUS_AUTHORISED = "AUTHORISED";
ApexxConstants.STATUS_DECLINED = "DECLINED";
ApexxConstants.STATUS_FAILED = "FAILED";
ApexxConstants.TRANSACTION_TYPE_CAPTURE = "CAPTURE";
ApexxConstants.TRANSACTION_TYPE_REFUND = "REFUND";

ApexxConstants.TRANSACTION_TYPE_AUTH = "AUTH";
ApexxConstants.REASON_SUCCESS = "SUCCESS";



ApexxConstants.PENDING_ORDER_STATUS = "PENDING";
ApexxConstants.REASON_IN_COMPLETE = "Order Incomplete";

//  Other Constants

ApexxConstants.NO_REFERENCE = "NO REFERENCE FOUND";
ApexxConstants.NO_ID_FOUND = "NO ID FOUND";
ApexxConstants.NO_TRANSACTION_TYPE_FOUND = "NO TRANSACTION TYPE FOUND";	
ApexxConstants.INTERNAL_ERROR_SFCC = "SFCC_BUG";
ApexxConstants.ACTION_CANCEL = "cancel";
ApexxConstants.ACTION_REFUND = "refund";
ApexxConstants.ACTION_CAPTURE = "capture";
ApexxConstants.TYPE_SHIPPING_PRODUCT = "shipping";
ApexxConstants.STATIC_GROUP_ID = "1";
ApexxConstants.STATIC_QUANTITY = "1";




//Transaction Type

ApexxConstants.TRANSACTION_TYPE_POST = 'POST';
ApexxConstants.TRANSACTION_TYPE_GET = 'GET';

	
module.exports = ApexxConstants;
