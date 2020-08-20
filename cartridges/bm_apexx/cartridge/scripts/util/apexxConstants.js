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



//  Order and Payment Status and Reson
ApexxConstants.STATUS_PROCESSING = "Processing";
ApexxConstants.STATUS_CAPTURED = "CAPTURED";
ApexxConstants.STATUS_AUTHORISED = "AUTHORISED";
ApexxConstants.STATUS_DECLINED = "DECLINED";
ApexxConstants.STATUS_FAILED = "FAILED";
ApexxConstants.TRANSACTION_TYPE_CAPTURE = "CAPTURE";
ApexxConstants.TRANSACTION_TYPE_AUTH = "AUTH";
ApexxConstants.PAYMENT_STATUS_PARTPAID ="PARTIAL_CAPTURE";
ApexxConstants.REFUND_STATUS_PARTPAID ="PARTIAL_REFUND";
ApexxConstants.PENDING_ORDER_STATUS = "PENDING";
ApexxConstants.REASON_IN_COMPLETE = "Order Incomplete";
ApexxConstants.TRANSACTION_TYPE_REFUND = "REFUND";
ApexxConstants.TRANSACTION_TYPE_INVOICE = "INVOICE";



// Status Label
ApexxConstants.LABEL_STATUS_PROCESSING = "Processing";
ApexxConstants.LABEL_STATUS_CAPTURED = "Captured";
ApexxConstants.LABEL_STATUS_AUTHORISED = "Authorised";
ApexxConstants.LABEL_STATUS_DECLINED = "Declined";
ApexxConstants.LABEL_STATUS_FAILED = "Failed";
ApexxConstants.LABEL_TRANSACTION_TYPE_CAPTURE = "Capture";
ApexxConstants.LABEL_TRANSACTION_TYPE_AUTH = "Auth";
ApexxConstants.LABEL_PAYMENT_STATUS_PARTPAID ="Partial Capture";
ApexxConstants.LABEL_REFUND_STATUS_PARTPAID ="Partial Refund";
ApexxConstants.LABEL_PENDING_ORDER_STATUS = "Pending";
ApexxConstants.LABEL_REASON_IN_COMPLETE = "Order Incomplete";
//  Other Constants

ApexxConstants.NO_REFERENCE = "NO REFERENCE FOUND";
ApexxConstants.NO_ID_FOUND = "NO ID FOUND";
ApexxConstants.NO_TRANSACTION_TYPE_FOUND = "NO TRANSACTION TYPE FOUND";	
	
	
	
module.exports = ApexxConstants;
