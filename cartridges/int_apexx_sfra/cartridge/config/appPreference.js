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
	prefs.XAPIKEY = '9112b8801b5b4e1ea57aeffabb563142';
	prefs.ACCOUNT = "1db380005b524103bf323f9ef63ae1cf";
	prefs.ORGANISATION = 'c7639f98175a4e3b95edf8afe096ff82';
	prefs.CAPTURE_NOW = prefs.Apexx_Capture ? prefs.Apexx_Capture :false;
	prefs.SAVE_CARD  = true;
	prefs.CUSTOMER_IP  = "10.20.0.186";
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
	prefs.SERVICE_HTTP_DIRECT_AUTH  = "apexx.https.3ds.auth";
	prefs.SERVICE_HTTP_PAYPAL  = "apexx.https.paypal";


	prefs.WEB_HOOK_TRANSACTION_UPDATE = URLUtils.https('ApexxWebhook-Update').toString();
	prefs.RETURN_URL_HOSTED  = URLUtils.https('ApexxTransaction-HostedUpdateTransaction').toString();
	prefs.RETURN_URL_DIRECT_CREDIT_THREE_DS  =  URLUtils.https('ApexxTransaction-DirectCreditUpdateThreeDs').toString();

	prefs.LOCALE  = prefs.Apexx_Locale;
	prefs.TRANSACTION_CSS_TEMPLATE  =  prefs.Apexx_button_style;
	prefs.DYNAMIC_DESCRIPTOR  = prefs.Apexx_Dynamic_Descriptor;

	prefs.APEXX_HOSTED_3DS_TRUE_FALSE  =  prefs.Apexx_hosted_3ds_true_false;
	prefs.APEXX_HOSTED_CUSTOM_FIELDS_CARD_HOLDER_NAME  =  prefs.Apexx_hosted_custom_fields_card_holder_name;
	prefs.APEXX_HOSTED_CUSTOM_FIELDS_ADDRESS  =  prefs.Apexx_hosted_custom_fields_address;
	prefs.APEXX_HOSTED_CUSTOM_FIELDS_ADDRESS_REQUIRED  =  prefs.Apexx_hosted_custom_fields_address_required;
	prefs.APEXX_HOSTED_CUSTOM_FIELDS_DISPLAY_HORIZONTAL  =  prefs.Apexx_hosted_custom_fields_display_horizontal;
	prefs.APEXX_HOSTED_SHOW_ORDER_SUMMARY  =  prefs.Apexx_hosted_show_order_summary;
	prefs.APEXX_HOSTED_SHOW_CUSTOM_LABELS_EXPIRY_DATE  =  prefs.Apexx_hosted_show_custom_labels_expiry_date;
	prefs.APEXX_HOSTED_SHOW_CUSTOM_LABELS_CVV  =  prefs.Apexx_hosted_show_custom_labels_cvv;
	prefs.APEXX_HOSTED_TRANSACTION_CSS_TEMPLATE  =  prefs.Apexx_hosted_transaction_css_template;

	
	
	return prefs;
};

module.exports = getPreference;

