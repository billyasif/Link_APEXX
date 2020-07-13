'use strict';

var server = require('server');

var apexxServiceWrapper = require('*/cartridge/scripts/service/apexxServiceWrapper');
var objectHelper = require('*/cartridge/scripts/util/objectHelper');
var OrderMgr = require('dw/order/OrderMgr');
var Resource = require('dw/web/Resource');
var URLUtils = require('dw/web/URLUtils');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');
var Transaction = require('dw/system/Transaction');
var appPreference = require('~/cartridge/config/appPreference')();
var PaymentMgr = require('dw/order/PaymentMgr');
var endPoint  = appPreference.SERVICE_HTTP_HOSTED;



server.post(
    'Get',
    function (req, res, next) {
    	var orderId = req.form.orderID;
    	var order = OrderMgr.getOrder(orderId);
    	var paymentInstruments = order.getPaymentInstruments()[0];
    	var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstruments.paymentMethod).paymentProcessor;
     	var saleTransactionRequestData = objectHelper.createSaleRequestObject(order,paymentInstruments,paymentProcessor);
     	var responseFromHosted = apexxServiceWrapper.makeServiceCall('POST',endPoint,saleTransactionRequestData);
        res.json(responseFromHosted);return next();
    }
);



module.exports = server.exports();
