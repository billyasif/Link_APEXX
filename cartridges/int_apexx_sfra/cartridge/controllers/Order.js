'use strict';

var server = require('server');
server.extend(module.superModule);

var Resource = require('dw/web/Resource');
var URLUtils = require('dw/web/URLUtils');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');

server.replace(
    'Confirm',
    consentTracking.consent,
    server.middleware.https,
    csrfProtection.generateToken,
    function (req, res, next) {
        var reportingUrlsHelper = require('*/cartridge/scripts/reportingUrls');
        var OrderMgr = require('dw/order/OrderMgr');
        var OrderModel = require('*/cartridge/models/order');
        var Locale = require('dw/util/Locale');
        var order = OrderMgr.getOrder(req.querystring.ID);
        var token = req.querystring.token ? req.querystring.token : null;
        var paymentInstruments = order.getPaymentInstruments()[0];
        var paymentTransaction = paymentInstruments.getPaymentTransaction();


        //res.json({'status':order.custom.apexxTransactionStatus});return next();

        if (!order
            || !token
            || token !== order.orderToken
            || order.customer.ID !== req.currentCustomer.raw.ID
        ) {
            res.render('/error', {
                message: Resource.msg('error.confirmation.error', 'confirmation', null)
            });

            return next();
        }
        var lastOrderID = Object.prototype.hasOwnProperty.call(req.session.raw.custom, 'orderID') ? req.session.raw.custom.orderID : null;
        if (lastOrderID === req.querystring.ID) {
            res.redirect(URLUtils.url('Home-Show'));
            return next();
        }

        var config = {
            numberOfLineItems: '*'
        };

        var currentLocale = Locale.getLocale(req.locale.id);

        var orderModel = new OrderModel(
            order,
            { config: config, countryCode: currentLocale.country, containerView: 'order' }
        );
        var passwordForm;

        var reportingURLs = reportingUrlsHelper.getOrderReportingURLs(order);

        var CustomerMgr = require('dw/customer/CustomerMgr');
        var profile = CustomerMgr.searchProfile('email={0}', orderModel.orderEmail);
        if (profile) {
            var Transaction = require('dw/system/Transaction');
            Transaction.wrap(function () {
                order.setCustomer(profile.getCustomer());
            });
        }

        if (!req.currentCustomer.profile && !profile) {
            passwordForm = server.forms.getForm('newPasswords');
            passwordForm.clear();
            res.render('checkout/confirmation/confirmation', {
                order: orderModel,
                returningCustomer: false,
                passwordForm: passwordForm,
                reportingURLs: reportingURLs,
                status:order.custom.apexxTransactionStatus,
                reason:paymentInstruments.custom.apexxReasonCode,
                transactionId : paymentTransaction.getTransactionID()


            });
        } else {
            res.render('checkout/confirmation/confirmation', {
                order: orderModel,
                returningCustomer: true,
                reportingURLs: reportingURLs,
                status:order.custom.apexxTransactionStatus,
                reason:paymentInstruments.custom.apexxReasonCode,
                transactionId : paymentTransaction.getTransactionID()

            });
        }
        req.session.raw.custom.orderID = req.querystring.ID; // eslint-disable-line no-param-reassign
        return next();
    }
);

module.exports = server.exports();
