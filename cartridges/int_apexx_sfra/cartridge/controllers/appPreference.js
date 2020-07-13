'use strict';
var system = require('dw/system');
var Resource = require('dw/web/Resource');
var PaymentInstrument = require('dw/order/PaymentInstrument');

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
	prefs.XAPIKEY = '9112b8801b5b4e1ea57aeffabb563142';
	prefs.ACCOUNT = prefs.Apexx_Account_Id;
	prefs.ORGANISATION = 'c7639f98175a4e3b95edf8afe096ff82';
	prefs.CAPTURE_NOW = prefs.Apexx_Capture ? prefs.Apexx_Capture :false;
	prefs.SAVE_CARD  = true;
	prefs.CUSTOMER_IP  = "192.168.1.1";
	prefs.RECURRING_TYPE  = "first";
	prefs.USER_AGENT  =  "Mozilla/5.0 (Windows; U; Windows NT 6.1; en-GB;rv  = 1.9.2.13) Gecko/20101203 Firefox/3.6.13 (.NET CLR 3.5.30729)";
	prefs.THREE_DS_REQUIRED  = prefs.Apexx_Three_Ds ? prefs.Apexx_Three_Ds :false ;
	prefs.CARD_OBJECT  =  require('~/cartridge/scripts/object/Apexx_Card_Object');
	prefs.BILLING_OBJECT  =  require('~/cartridge/scripts/object/Apexx_BillTo_Object');
	prefs.SERVICE_HTTP_BASE_API_URL  = "apexx.https.base.api.url";
	prefs.SERVICE_HTTP_DIRECT_PAY  = "apexx.https.directpay";
	prefs.SERVICE_HTTP_CAPTURE  = "apexx.https.capture";
	prefs.SERVICE_HTTP_CANCEL_CREDIT_TRANSACTION  = "apexx.https.cancelcredittransaction";
	prefs.SERVICE_HTTP_REFUND  = "apexx.https.refund";
	prefs.SERVICE_HTTP_HOSTED  = "apexx.https.hostedpay";
	prefs.HOSTED_WEB_HOOK_TRANSACTION_UPDATE   =  "https://dev.apexxfintech.com/";
	prefs.DYNAMIC_DESCRIPTOR  = prefs.Apexx_Dynamic_Descriptor;
	prefs.RETURN_URL  = prefs.Apexx_Return_Url;
	prefs.LOCALE  = prefs.Apexx_Locale;
	prefs.TRANSACTION_CSS_TEMPLATE  =  prefs.Apexx_button_style;
	
	return prefs;
};

module.exports = getPreference;

