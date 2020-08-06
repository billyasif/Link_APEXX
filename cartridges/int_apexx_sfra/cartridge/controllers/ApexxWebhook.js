'use strict';
var server = require('server');
var OrderMgr = require('dw/order/OrderMgr');
var JSONHelper = require('*/cartridge/scripts/util/JSONHelper');
var PT = require('dw/order/PaymentTransaction');
var Money = require('dw/value/Money');
var PaymentMgr = require('dw/order/PaymentMgr');
var logger = require('dw/system/Logger').getLogger('ApexxWebHookUpdate');
var Transaction = require('dw/system/Transaction');
var PaymentInstrument = require('dw/order/PaymentInstrument');


server.use(
    'Update',
    function(req, res, next) {
        var data, status, order;

        var data = JSONHelper.parse(request.httpParameterMap.requestBodyAsString);
        if ('merchant_reference' in data)
            var orderId = data.merchant_reference;
        if ('status' in data)
            var status = data.status;
            var order = OrderMgr.getOrder(orderId);
           // res.json({'status':true,'message':'order has been updated,payment has been updated'});return next();


        if (order && status) {
            var paymentInstruments = order.getPaymentInstruments()[0];
            var paymentTransaction = paymentInstruments.getPaymentTransaction();
            var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstruments.paymentMethod).paymentProcessor;

            Transaction.wrap(function() {
                order.custom.isApexxOrder = true;

                if (status == "CAPTURED") {
                    order.custom.apexxTransactionType = "CAPTURE";
                    order.setPaymentStatus(order.PAYMENT_STATUS_PAID);

                    if ('amount' in data)
                    var apexxPaidAmount = data.amount /100;	
                    var apexxAuthAmount = data.amount /100;	

                    order.custom.apexxPaidAmount = apexxPaidAmount.toFixed(2);
                    order.custom.apexxAuthAmount = apexxAuthAmount.toFixed(2);

                } else {
                	
                    order.custom.apexxTransactionType = "AUTH";
                    order.setPaymentStatus(order.PAYMENT_STATUS_NOTPAID);
                }

                if ('_id' in data)
                    paymentTransaction.setTransactionID(data._id);
                    paymentTransaction.setPaymentProcessor(paymentProcessor);
                    order.custom.apexxTransactionID = data._id;

                if ('amount' in data)
                    var amount = data.amount / 100;

                    order.custom.apexxAuthAmount = amount.toFixed(2);
                	paymentTransaction.setAmount(new Money(amount, order.getCurrencyCode()));

                if ('status' in data)
                    var transactionStatus = data.status == "CAPTURED"  ? "Processing" : data.status;
                    order.custom.apexxTransactionStatus = transactionStatus;
                	paymentTransaction.setType(PT.TYPE_AUTH);

                if ('merchant_reference' in data)

                    order.custom.apexxMerchantReference = data.merchant_reference;

                if ('reason_code' in data)
                    paymentInstruments.custom.apexxReasonCode = data.reason_code

                if ('authorization_code' in data)
                    paymentInstruments.custom.apexxAuthorizationCode = data.authorization_code;


                if ('cvv_result' in data)
                	paymentInstruments.custom.apexxCvvResult = data.cvv_result;

                if ('avs_result' in data)
                	paymentInstruments.custom.apexxAvsResult = data.avs_result;

                if ('card' in data) {
                    if ('token' in data.card)
                        paymentInstruments.custom.apexxPaymentMethodToken = data.card.token;
                    if ('card_brand' in data.card)
                        paymentInstruments.custom.apexxCreditCardType = data.card_brand;
                    if ('card_number' in data.card)
                        paymentInstruments.custom.apexxCreditCardLastDigits = data.card.card_number;
                    if ('expiry_month' in data.card)
                        paymentInstruments.custom.apexxCardExpirationMonth = parseInt(data.card.expiry_month, 10);
                    if ('expiry_year' in data.card)
                        paymentInstruments.custom.apexxCardExpirationYear = parseInt(data.card.expiry_year, 10);
                }

                if ('three_ds' in data)
                    if ('three_ds' in data.three_ds)
                        paymentInstruments.custom.apexx3dSecureStatus = data.three_ds.three_ds_required;

            });
            logger.info(data);
            res.json({'status':true,'message':'order has been updated,payment has been updated'});return next();

        }else{
            logger.info(data);
            res.json({'status':false,'message':'order not found,status update failed'});return next();
        }
    }
);


module.exports = server.exports();