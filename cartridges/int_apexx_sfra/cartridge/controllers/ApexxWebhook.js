'use strict';
var server = require('server');
var OrderMgr = require('dw/order/OrderMgr');
var Resource = require('dw/web/Resource');
var URLUtils = require('dw/web/URLUtils');
var StringUtils = require('dw/util/StringUtils');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');
var objectHelper = require('*/cartridge/scripts/util/objectHelper');
var Transaction = require('dw/system/Transaction');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var dworder = require('dw/order');
var Status = require('dw/system/Status');


server.get(
		'Update', 
		function (req, res, next) {
			
			// var order  = dw.order.OrderMgr.getOrder("00000081");
			 var logger = require('dw/system/Logger').getLogger('ApexxWebHook');
			 logger.info("Webhook is being called");
			 return new Status(Status.OK);
//		    Transaction.wrap(function() {
//		    	order.custom.apexxTransactionHistory = "test11111111";
//		    });
//		    res.json();return next();
		    
//			var PaymentMgr = require('dw/order/PaymentMgr');
//			var PT = require('dw/order/PaymentTransaction');
//			var Money = require('dw/value/Money');
//			var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
//			var httpParameterMap = request.httpParameterMap;
//		    res.json({test:httpParameterMap.reason_code.value});return next();
//			res.json({
//		        error: false,
//		        orderID: order.orderNo,
//		        orderToken: order.orderToken,
//		        continueUrl: URLUtils.url('Order-Confirm').toString()
//		    });
//			return next();
		 }
		);
module.exports = server.exports();