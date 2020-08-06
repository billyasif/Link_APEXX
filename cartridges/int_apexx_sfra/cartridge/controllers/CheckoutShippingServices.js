'use strict';

var server = require('server');
server.extend(module.superModule);
var BasketMgr = require('dw/order/BasketMgr');
var Transaction = require('dw/system/Transaction');
var commonHelper = require('*/cartridge/scripts/util/commonHelper');

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');



/**
 * Handle Ajax shipping form submit
 */
server.append(
    'SubmitShipping',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
                var form = server.forms.getForm('shipping');
                var currentBasket = BasketMgr.getCurrentBasket();
                Transaction.wrap(function() {
                    currentBasket.custom.selectedShipCountry = form.shippingAddress.addressFields.country.value;
                });
                
                res.json({'afterPayStatus':commonHelper.isAfterPayAllowed()});
                return next();
            });

module.exports = server.exports();
