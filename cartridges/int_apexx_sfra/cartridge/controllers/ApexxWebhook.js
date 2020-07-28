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
var httpParameterMap = request.httpParameterMap;


server.get(
		'Update', 
		function (req, res, next) {
	        var orderId = httpParameterMap.merchant_reference.getValue();
	        var status = httpParameterMap.status.getValue(); 
            var order = OrderMgr.getOrder(orderId);

			 if(order && status){
				 
				 Transaction.wrap(function() {
					if(status == "AUTHORISED"){
						
					}
				 });
				 //var logger = require('dw/system/Logger').getLogger('ApexxWebHook');
				 //logger.info("Webhook is being called");
				// return new Status(Status.OK);
			 }

		 }
		);
module.exports = server.exports();