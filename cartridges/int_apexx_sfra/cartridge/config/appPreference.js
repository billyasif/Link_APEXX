'use strict';
var system = require('dw/system');
var Resource = require('dw/web/Resource');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var URLUtils = require('dw/web/URLUtils');
var getPreference = function (inpSite) {
    var prefs = {};
    var site = inpSite || system.Site.getCurrent();

    // Site custom preferences:
    var allSitePreferences = site.getPreferences().getCustom();
    Object.keys(allSitePreferences).forEach(function (key) {
        if (key.match(/^Apexx_+/)) {
            if (typeof allSitePreferences[key] === 'object' && 'value' in allSitePreferences[key]) {
                prefs[key] = allSitePreferences[key].getValue();
            } else {
                prefs[key] = allSitePreferences[key];
            }
        }
    });
    
    
	prefs.CREDIT_CARD_DIRECT_URL= 'https://sandmgw.apexxfintech.com/mgw/payment/direct';
	prefs.XAPIKEY = prefs.Apexx_API_Key;
	prefs.ORGANISATION = prefs.Apexx_Org_Key;
	prefs.SAVE_CARD  = true;
	prefs.CUSTOMER_IP  = "10.20.0.186";
	prefs.RECURRING_TYPE  = "first";
	prefs.USER_AGENT  =  "Mozilla/5.0 (Windows; U; Windows NT 6.1; en-GB;rv  = 1.9.2.13) Gecko/20101203 Firefox/3.6.13 (.NET CLR 3.5.30729)";
	prefs.CARD_OBJECT  =  require('~/cartridge/scripts/object/Apexx_Card_Object');
	prefs.BILLING_OBJECT  =  require('~/cartridge/scripts/object/Apexx_BillTo_Object');
	prefs.SERVICE_HTTP_BASE_API_URL  = "apexx.https.base.api.url";
	prefs.SERVICE_HTTP_DIRECT_PAY  = "apexx.https.directpay";
	prefs.SERVICE_HTTP_CAPTURE  = "apexx.https.capture";
	prefs.SERVICE_HTTP_CANCEL_CREDIT_TRANSACTION  = "apexx.https.cancelcredittransaction";
	prefs.SERVICE_HTTP_REFUND  = "apexx.https.refund";
	prefs.SERVICE_HTTP_HOSTED  = "apexx.https.hostedpay";
	prefs.SERVICE_HTTP_DIRECT_AUTH  = "apexx.https.3ds.auth";
	prefs.SERVICE_HTTP_PAYPAL  = "apexx.https.paypal";


	prefs.WEB_HOOK_TRANSACTION_UPDATE = URLUtils.https('ApexxWebhook-Update').toString();
	prefs.RETURN_URL_HOSTED  = URLUtils.https('ApexxTransaction-HostedUpdateTransaction').toString();
	prefs.RETURN_URL_DIRECT_CREDIT_THREE_DS  =  URLUtils.https('ApexxTransaction-DirectCreditUpdateThreeDs').toString();
	prefs.RETURN_URL_PAY_PayPal  = URLUtils.https('ApexxTransaction-PayPal').toString();

	return prefs;
};

module.exports = getPreference;

