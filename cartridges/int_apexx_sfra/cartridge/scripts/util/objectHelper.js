'use strict';

/* global dw request session customer */

var system = require('dw/system');
var commonHelper = require('*/cartridge/scripts/util/commonHelper');
var dworder = require('dw/order');
var appPreference = require('~/cartridge/config/appPreference')();


/**
 * For Card object
 * @param {Object} paymentInstrument
 * @returns
 */

function ApexxCardObject(paymentInstrument){
	var server = require('server');
    var Card_Object = appPreference.CARD_OBJECT;
    var cardObject = new Card_Object();
    var month = "";
    var year = "";

    var BillingForm = server.forms.getForm('billing').creditCardFields;
    var ObjectPaymentModel = commonHelper.convertFormToObject(BillingForm);
   
    if(ObjectPaymentModel.cardType && ObjectPaymentModel.cardNumber && ObjectPaymentModel.securityCode){
    	cardObject.setCardNumber(ObjectPaymentModel.cardNumber);
    	month =  ('0' + ObjectPaymentModel.expirationMonth).slice(-2);
    	cardObject.setExpirationMonth(month);
    	year = ObjectPaymentModel.expirationYear;
    	cardObject.setExpirationYear(year.toString().slice(-2));
    	cardObject.setCVVNumber(ObjectPaymentModel.securityCode);
    	cardObject.setToken("");
        cardObject.setCreateToken(true);
        cardObject.setSaveCard(ObjectPaymentModel.saveCard)
     }
    return { success: true, card: cardObject };

}



/**
 * For creating billing address object
 * @param {Object} Order Object 
 * @param ReadFromBasket 
 * @returns billing object
 */

function ApexxBillToObject(order, ReadFromOrder) {
    var BillTo_Object = appPreference.BILLING_OBJECT;

    var billToObject = new BillTo_Object();
    if (ReadFromOrder) {
        var address = "";
        var countryCode = "";
        var billingAddress = order.billingAddress;

        if (!empty(billingAddress) && !empty(order)) {
			/* This if condition checks if billingAddress.address1 is present only for V.Me
			* create the billToObject using billingAddress else it will create billToObject using shippingAddress
			*/
            if (!empty(billingAddress)) {
                billToObject.setFirstName(billingAddress.firstName);
                billToObject.setLastName(billingAddress.lastName);
                address  = billingAddress.address1 + ' ' + billingAddress.address2;
                billToObject.setAddress(address);
                billToObject.setCity(billingAddress.city);
                countryCode = commonHelper.isEmpty(billingAddress.countryCode) ? "" : billingAddress.countryCode;
                billToObject.setState(billingAddress.stateCode);
                billToObject.setPostalCode(billingAddress.postalCode);
                countryCode = commonHelper.isEmpty(billingAddress.countryCode) ? "" : billingAddress.countryCode;
                billToObject.setCountry(countryCode);
                billToObject.setPhoneNumber(billingAddress.phone);
                billToObject.setEmail(order.customerEmail);
            }
        }
    } 
   
    return { success: true, billing_address: billToObject };
}



/**
 * 
 * @param order
 * @param paymentInstrument
 * @returns
 */
function createSaleRequestObject(order,paymentInstrument,paymentProcessor) {

	var ObjectBilling = ApexxBillToObject(order,true);
    var ObjectCard = ApexxCardObject(paymentInstrument);
   
    var billingAddress = empty(ObjectBilling.success) ? "" : ObjectBilling.billing_address;
    var cardObject = empty(ObjectCard.success) ? "" : ObjectCard.card;
    const paymentReference = order.orderNo;
    const amount = paymentInstrument.paymentTransaction.amount.value;
    var paymentProcessorId = dworder.PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor().getID();
	//"currency": system.Site.getCurrent().getDefaultCurrency(),
     
 	
 	if(paymentProcessorId === 'APEXX_HOSTED') {
 		
		var commonBillingObject = {};  

 		commonBillingObject.currency = system.Site.getCurrent().getDefaultCurrency();
 		commonBillingObject.amount = amount ;
 		commonBillingObject.capture_now =  appPreference.CAPTURE_NOW;
 		commonBillingObject.billing_address = billingAddress ;
 		commonBillingObject.dynamic_descriptor =  "Demo Merchant Test Account";
 		commonBillingObject.merchant_reference = paymentReference;
 		commonBillingObject.user_agent =  appPreference.USER_AGENT;
 		commonBillingObject.webhook_transaction_update = appPreference.WEB_HOOK_TRANSACTION_UPDATE ;
 		commonBillingObject.three_ds = {};
 		commonBillingObject.three_ds.three_ds_required = appPreference.APEXX_HOSTED_3DS_TRUE_FALSE;
	
 		
 		commonBillingObject.account = appPreference.ACCOUNT;

 		commonBillingObject.transaction_css_template = appPreference.TRANSACTION_CSS_TEMPLATE;
		commonBillingObject.return_url = appPreference.RETURN_URL_HOSTED;
		commonBillingObject.transaction_type = "first";
		commonBillingObject.locale = appPreference.LOCALE;
		
		commonBillingObject.show_custom_fields = {};
		commonBillingObject.show_custom_fields.card_holder_name = appPreference.APEXX_HOSTED_CUSTOM_FIELDS_CARD_HOLDER_NAME;
		commonBillingObject.show_custom_fields.address = appPreference.APEXX_HOSTED_CUSTOM_FIELDS_ADDRESS;
		commonBillingObject.show_custom_fields.address_required = appPreference.APEXX_HOSTED_CUSTOM_FIELDS_ADDRESS_REQUIRED;
		commonBillingObject.show_custom_fields.display_horizontal = appPreference.APEXX_HOSTED_CUSTOM_FIELDS_DISPLAY_HORIZONTAL;
		
		commonBillingObject.show_custom_labels = {};
		commonBillingObject.show_custom_labels.expiry_date = appPreference.APEXX_HOSTED_SHOW_CUSTOM_LABELS_EXPIRY_DATE;
        commonBillingObject.show_custom_labels.cvv = appPreference.APEXX_HOSTED_SHOW_CUSTOM_LABELS_CVV;
        
		commonBillingObject.show_order_summary = appPreference.APEXX_HOSTED_SHOW_ORDER_SUMMARY;
		
		commonBillingObject.transaction_css_template = appPreference.APEXX_HOSTED_TRANSACTION_CSS_TEMPLATE;

      }
 	
	  if(paymentProcessorId === 'APEXX_CREDIT') {
		var commonBillingObject = {};
		///commonBillingObject.organisation = appPreference.ORGANISATION;

		commonBillingObject.currency = system.Site.getCurrent().getDefaultCurrency();
		commonBillingObject.amount = amount ;
		commonBillingObject.capture_now =  appPreference.CAPTURE_NOW;
		commonBillingObject.billing_address = billingAddress ;
		commonBillingObject.dynamic_descriptor =  "Demo Merchant Test Account";
		commonBillingObject.merchant_reference = paymentReference;
		commonBillingObject.user_agent =  appPreference.USER_AGENT;
		commonBillingObject.webhook_transaction_update = appPreference.WEB_HOOK_TRANSACTION_UPDATE ;
		commonBillingObject.three_ds = {};
		commonBillingObject.three_ds.three_ds_required = appPreference.APEXX_HOSTED_3DS_TRUE_FALSE;
	    commonBillingObject.account = appPreference.ACCOUNT;

        commonBillingObject.card = cardObject;
		commonBillingObject.user_agent = appPreference.USER_AGENT;
		commonBillingObject.recurring_type =  appPreference.RECURRING_TYPE;
		commonBillingObject.customer_ip = appPreference.CUSTOMER_IP;
	 	commonBillingObject.three_ds = {three_ds_required: appPreference.THREE_DS_REQUIRED};

	
	}	
    
	  
 	  if(paymentProcessorId === 'APEXX_PayPal') 
	  {
 			var commonBillingObject = {};  

 			commonBillingObject.account =  "71eafe8d7b3f476b9e6d34fd3a53b9a2";
 			commonBillingObject.organisation = "";
 			commonBillingObject.capture_now = false;
 			commonBillingObject.customer_ip = "10.20.0.186";
 			commonBillingObject.recurring_type = "first";
 			commonBillingObject.amount = "1";
 			commonBillingObject.currency = "",
 			commonBillingObject.user_agent = "Mozilla/5.0 (Windows; U; Windows NT 6.1; en-GB;rv:1.9.2.13) Gecko/20101203 Firefox/3.6.13 (.NET CLR 3.5.30729)";
 			commonBillingObject.locale = "en_GB";
 			commonBillingObject.dynamic_descriptor = "First Card transaction";
 			commonBillingObject.merchant_reference = "PAYPALTestRequest215";
 			commonBillingObject.payment_product_type = "paypal";
 			commonBillingObject.shopper_interaction = "ecommerce";
 			
 			
 			
 			
 			commonBillingObject.paypal =  {};
 			commonBillingObject.paypal.brand_name = "paypal_brand";
 			commonBillingObject.paypal.customer_paypal_id  = "A82A672GURYSG";
 			commonBillingObject.paypal.tax_id = "26062019122";
 			commonBillingObject.paypal.tax_id_type = "BR_CPF";
 			commonBillingObject.paypal.order = {};
 			commonBillingObject.paypal.order.invoice_number = "PK2806";
 			commonBillingObject.paypal.order.total_tax_amount = "0";
 			commonBillingObject.paypal.order.description = "First Create Order Payment";
 			commonBillingObject.paypal.order.items =  {};
 			commonBillingObject.paypal.order.items.item_name = "Flower Bouquet";
 			commonBillingObject.paypal.order.items.unit_amount = "100";
 			commonBillingObject.paypal.order.items.currency  = "USD";
 			commonBillingObject.paypal.order.items.tax_currency  = "USD";
 			commonBillingObject.paypal.order.items.tax_amount = "0";
 			commonBillingObject.paypal.order.items.quantity  = "1";
 			commonBillingObject.paypal.order.items.item_description  = "First Order Item";
 			commonBillingObject.paypal.order.items.sku  = "HQAHMC001";
 			commonBillingObject.paypal.order.items.category  = "PHYSICAL_GOODS";
 			commonBillingObject.paypal.order.items = [commonBillingObject.paypal.order.items];
			commonBillingObject.paypal.order.redirection_parameters  = {};
			commonBillingObject.paypal.order.redirection_parameters.return_url = "https://qaigate.apexxfintech.com/mgw/return";
 				
			commonBillingObject.customer  =  {};
			commonBillingObject.customer.first_name  = "kirtee";
			commonBillingObject.customer.last_name  = "chaudhary";
			commonBillingObject.customer.email  = "kirtee.chaudhary@apexxfintech.com";
			commonBillingObject.customer.phone  = "9638910853";
			commonBillingObject.customer.date_of_birth  = "1994-08-11";
			commonBillingObject.customer.address = {};
			commonBillingObject.customer.address.address = "173 Drury Lane";
			commonBillingObject.customer.address.city = "Los Angeles";
			commonBillingObject.customer.address.state = "CA";
			commonBillingObject.customer.address.postal_code = "90002";
			commonBillingObject.customer.address.country = "US";
 				
 			
 			
			commonBillingObject.delivery_customer =  {};
			commonBillingObject.delivery_customer.first_name = "kushal";
			commonBillingObject.delivery_customer.last_name = "shah";
			commonBillingObject.delivery_customer.address =  {};
			commonBillingObject.delivery_customer.address.address = "421 E Commerce";
			commonBillingObject.delivery_customer.address.city = "San Antonio";
			commonBillingObject.delivery_customer.address.state = "CA";
			commonBillingObject.delivery_customer.address.postal_code = "90002";
			commonBillingObject.delivery_customer.address.country = "US";
 		
	  
  } 	  
	  
	  
    return commonBillingObject;

}

var objectHelper = {
	createSaleRequestObject:createSaleRequestObject,
    ApexxBillToObject:ApexxBillToObject,
    ApexxCardObject:ApexxCardObject
};

module.exports = objectHelper;