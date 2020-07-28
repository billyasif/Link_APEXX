'use strict';
var server = require('server');
var OrderMgr = require('dw/order/OrderMgr');
var Transaction = require('dw/system/Transaction');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var dworder = require('dw/order');
var PaymentMgr = require('dw/order/PaymentMgr');
var Money = require('dw/value/Money');
var httpParameterMap = request.httpParameterMap;

var cardProcessor = require('~/cartridge/scripts/apexx/cardProcessor');
var objectHelper = require('*/cartridge/scripts/util/objectHelper');
var commonHelper = require('*/cartridge/scripts/util/commonHelper');
var appPreference = require('~/cartridge/config/appPreference')();
var apexxServiceWrapper = require('*/cartridge/scripts/service/apexxServiceWrapper');
var PT = require('dw/order/PaymentTransaction');
var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');




server.post(
    'HostedUpdateTransaction',
    function(req, res, next) {
        var orderId = httpParameterMap.merchant_reference.getValue(); //'00001257';//
        var order = OrderMgr.getOrder(orderId);
        try {
            var paymentInstruments = order.getPaymentInstruments();
            var apexxPaymentInstrument = null;
            var isError;
            var paymentInstrument = order.getPaymentInstruments()[0];
            var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.paymentMethod).paymentProcessor;
            var saleTransactionRequestData = objectHelper.createSaleRequestObject(order, paymentInstrument, paymentProcessor);

            var iterator = paymentInstruments.iterator();
            var paymentInstrument = null;
            var authAmount = commonHelper.intToFloat(httpParameterMap.amount.value);
            var paidAmount = commonHelper.intToFloat(httpParameterMap.amount.value);
            var status = httpParameterMap.status.value || '';

            //res.json({test:saleTransactionRequestData.three_ds.three_ds_required});return next();
            while (iterator.hasNext()) {
                paymentInstrument = iterator.next();
                var paymentProcessorId = dworder.PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor().getID();
                if (paymentProcessorId === 'APEXX_HOSTED') {
                    apexxPaymentInstrument = paymentInstrument.getPaymentTransaction();
                    break;
                }
            }
            var paymentProcessor = PaymentMgr.getPaymentMethod(paymentProcessorId).paymentProcessor;

            if (httpParameterMap.status.value != 'CAPTURED' && httpParameterMap.status.value != 'AUTHORISED') {

                updateTransactionHistory(status, order, httpParameterMap, authAmount);
                Transaction.wrap(function() {
                    order.custom.isApexxOrder = true;
                    order.setPaymentStatus(order.PAYMENT_STATUS_NOTPAID);
                    apexxPaymentInstrument.setPaymentProcessor(paymentProcessor);
                });
                isError = true;
            } else {
                updateTransactionHistory(status, order, httpParameterMap, authAmount);
            }

            //res.json({ordr:order.orderNo});
            Transaction.wrap(function() {
                //PAYMENT_STATUS_PAID
                apexxPaymentInstrument.setTransactionID(httpParameterMap._id.value);
                apexxPaymentInstrument.setPaymentProcessor(paymentProcessor);
                apexxPaymentInstrument.setAmount(new Money(authAmount, order.getCurrencyCode()));
                order.custom.isApexxOrder = true;
                order.custom.apexxTransactionStatus = httpParameterMap.status.value;
                order.custom.apexxTransactionID = httpParameterMap._id.value;
                order.custom.apexxMerchantReference = httpParameterMap.merchant_reference.value;
                order.custom.apexxAuthAmount = httpParameterMap.authorization_code.value ? parseFloat(authAmount) : 0.0;
                if (saleTransactionRequestData.capture_now) {
                    order.custom.apexxTransactionType = 'CAPTURE';
                } else {
                    order.custom.apexxTransactionType = 'AUTH';
                }

                if (httpParameterMap.status.value == 'CAPTURED') {
                    apexxPaymentInstrument.setType(PT.TYPE_CAPTURE);
                    order.setPaymentStatus(order.PAYMENT_STATUS_PAID);
                    order.custom.apexxPaidAmount = authAmount;
                    order.custom.apexxCaptureAmount = paidAmount;
                    COHelpers.sendConfirmationEmail(order, req.locale.id);
                } else if (httpParameterMap.status.value == 'AUTHORISED') {
                    apexxPaymentInstrument.setType(PT.TYPE_AUTH);
                    order.setPaymentStatus(order.PAYMENT_STATUS_NOTPAID);
                    COHelpers.sendConfirmationEmail(order, req.locale.id);
                }
                var threeDSecureInfo = saleTransactionRequestData.three_ds;
                paymentInstrument.custom.apexx3dSecureStatus = threeDSecureInfo ? threeDSecureInfo.three_ds_required : null;
                paymentInstrument.custom.apexxHostedPaymentPageResponseUrl = "";


                if (httpParameterMap.card_number.value) {

                    paymentInstrument.custom.apexxCreditCardLastDigits = httpParameterMap.card_number.value;
                    paymentInstrument.setCreditCardNumber(httpParameterMap.card_number.value);

                    paymentInstrument.custom.apexxCardExpirationMonth = parseInt(httpParameterMap.expiry_month.value, 10);
                    paymentInstrument.setCreditCardExpirationMonth(parseInt(httpParameterMap.expiry_month.value, 10));

                    paymentInstrument.custom.apexxCardExpirationYear = parseInt(httpParameterMap.expiry_year.value, 10);
                    paymentInstrument.setCreditCardExpirationYear(parseInt(httpParameterMap.expiry_year.value, 10));

                    paymentInstrument.custom.apexxAuthorizationCode = httpParameterMap.authorization_code.value;
                }

            });
            res.render('apexx/closepopup.isml', {
                isError: isError,
                isAuth: order.custom.apexxAuthAmount,
                orderNo: order.orderNo,
                orderToken: order.orderToken
            });
        } catch (e) {
            res.render('apexx/closepopup.isml', {
                isError: true,
            });
        }

        return next();
    }
);

server.post(
    'DirectCreditUpdateThreeDs',
    function(req, res, next) {
        var orderId = req.querystring.orderId;
        var order = OrderMgr.getOrder(orderId);
        var authAmount;
        var transactionId = req.querystring.transactionId;
        var threeDsResponse = paramsToJson(transactionId);

        var payLoad = {};
        payLoad._id = ('_id' in threeDsResponse) ? threeDsResponse._id : "";
        payLoad.paRes = ('PaRes' in threeDsResponse) ? threeDsResponse.PaRes : "";

        var endPoint = appPreference.SERVICE_HTTP_DIRECT_AUTH;
        var isError;
        if (payLoad) {
            var response = apexxServiceWrapper.makeServiceCall('POST', endPoint, payLoad);

            if (response.object._id && response.object.status === 'AUTHORISED' || response.object.status === 'CAPTURED') {
                var paymentInstrument = order.getPaymentInstruments()[0];
                var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.paymentMethod).paymentProcessor;
                cardProcessor.saveTransactionData(order, paymentInstrument, response.object);

                if (paymentInstrument.custom.apexxSaveCreditCard == true) {

                    cardProcessor.saveCustomerCreditCard(paymentInstrument, response.object);

                }

            } else if (response.object.status === 'DECLINED' || response.object.status === 'FAILED') {

                Transaction.wrap(function() {
                    OrderMgr.failOrder(order, true);
                });

                authAmount = response.object.amount;

                var paymentInstrument = order.getPaymentInstruments()[0];
                cardProcessor.saveTransactionData(order, paymentInstrument, response.object);
            }
        }

        res.render('apexx/closepopup.isml', {
            isError: isError,
            isAuth: authAmount,
            orderNo: orderId,
            orderToken: order.orderToken
        });
        return next();
    });

server.post(
    'PayPal',
    function(req, res, next) {
        var reason_code = httpParameterMap.reason_code.value;
        var amount = httpParameterMap.amount.value / 100;
        var merchant_reference = httpParameterMap.merchant_reference.value;
        var _id = httpParameterMap._id.value;
        var status = httpParameterMap.status.value;
        var orderRecord = OrderMgr.searchOrder('custom.apexxTransactionID = {0}', _id);
        updateTransactionHistory(status, orderRecord, httpParameterMap, amount);

        var isError;

        if (_id) {
            if (status != 'DECLINED' || status != 'FAILED') {
                var paymentInstrument = orderRecord.getPaymentInstruments()[0];
                var paymentTransaction = paymentInstrument.getPaymentTransaction();
                var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.paymentMethod).paymentProcessor;

                Transaction.wrap(function() {
                    OrderMgr.failOrder(orderRecord, true);
                });
                Transaction.wrap(function() {
                    if (status === "CAPTURED") {
                        orderRecord.custom.apexxTransactionType = "CAPTURE";
                        orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_PAID);
                        orderRecord.custom.apexxPaidAmount = amount;
                        orderRecord.custom.apexxCaptureAmount = amount;

                    } else {
                        orderRecord.custom.apexxTransactionType = "AUTH";
                        orderRecord.setPaymentStatus(orderRecord.PAYMENT_STATUS_NOTPAID);
                    }

                    paymentTransaction.setTransactionID(_id);
                    paymentTransaction.setPaymentProcessor(paymentProcessor);
                    paymentTransaction.setAmount(new Money(amount, orderRecord.getCurrencyCode()));

                    orderRecord.custom.isApexxOrder = true;
                    orderRecord.custom.apexxTransactionStatus = status;
                    orderRecord.custom.apexxAuthAmount = amount;
                    orderRecord.custom.apexxTransactionID = _id;
                    orderRecord.custom.apexxMerchantReference = merchant_reference;

                    if (status === 'AUTHORISED') {
                        paymentTransaction.setType(PT.TYPE_AUTH);
                    }
                });

            }
        }

        res.render('apexx/closepopup.isml', {
            isError: isError,
            isAuth: amount,
            orderNo: orderRecord.orderNo,
            orderToken: orderRecord.orderToken
        });
        return next();
    });

function updateTransactionHistory(action, order, httpParameterMap, amount) {
    var transactionHistory = order.custom.apexxTransactionHistory || '[]';
    var merchant_reference = httpParameterMap.merchant_reference.value || '';
    var ID = httpParameterMap._id.value || '';
    var status = httpParameterMap.status.value || '';

    transactionHistory = JSON.parse(transactionHistory);

    transactionHistory.push({
        id: ID,
        merchant_reference: merchant_reference,
        status: status,
        type: order.custom.apexxTransactionType,
        amount: amount,
        action: action,
        date: (new Date()).getTime()
    });

    Transaction.wrap(function() {
        order.custom.apexxTransactionHistory = JSON.stringify(transactionHistory); // eslint-disable-line no-param-reassign
    });
}


/**
 * Render JSON from GET-url parameters
 */
function paramsToJson(transactionId) {
    var paramNames = request.httpParameterMap.getParameterNames();
    var data = {
        '_id': transactionId
    };
    for (var i = 0; i < paramNames.length; i++) {
        var name = paramNames[i];
        data[name] = request.httpParameterMap.get(name).getStringValue();
    }
    return data;
}
module.exports = server.exports();