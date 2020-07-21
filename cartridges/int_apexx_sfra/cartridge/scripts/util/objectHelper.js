'use strict';

/* global dw request session customer */

var system = require('dw/system');
var commonHelper = require('*/cartridge/scripts/util/commonHelper');
var dworder = require('dw/order');
var appPreference = require('~/cartridge/config/appPreference')();


/**
 * For Card object
 * 
 * @param {Object}
 *            paymentInstrument
 * @returns
 */

function ApexxCardObject(paymentInstrument) {
    var server = require('server');
    var Card_Object = appPreference.CARD_OBJECT;
    var cardObject = new Card_Object();
    var month = "";
    var year = "";

    var BillingForm = server.forms.getForm('billing').creditCardFields;
    var ObjectPaymentModel = commonHelper.convertFormToObject(BillingForm);
    if (ObjectPaymentModel.cardType && ObjectPaymentModel.cardNumber && ObjectPaymentModel.securityCode) {
        cardObject.setCardNumber(ObjectPaymentModel.cardNumber);
        month = ('0' + ObjectPaymentModel.expirationMonth).slice(-2);
        cardObject.setExpirationMonth(month);
        year = ObjectPaymentModel.expirationYear;
        cardObject.setExpirationYear(year.toString().slice(-2));
        cardObject.setCVVNumber(ObjectPaymentModel.securityCode);
        cardObject.setToken("");
        cardObject.setCreateToken(true);
        cardObject.setSaveCard(ObjectPaymentModel.saveCard)
    }
    return {
        success: true,
        card: cardObject
    };

}



/**
 * For creating billing address object
 * 
 * @param {Object}
 *            Order Object
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
            /*
             * This if condition checks if billingAddress.address1 is present
             * only for V.Me create the billToObject using billingAddress else
             * it will create billToObject using shippingAddress
             */
            if (!empty(billingAddress)) {
                billToObject.setFirstName(billingAddress.firstName);
                billToObject.setLastName(billingAddress.lastName);
                address = billingAddress.address1 + ' ' + billingAddress.address2;
                billToObject.setAddress(address);
                billToObject.setCity(billingAddress.city);
                billToObject.setState(billingAddress.stateCode);
                billToObject.setPostalCode(billingAddress.postalCode);
                countryCode = commonHelper.isEmpty(billingAddress.countryCode.value) ? billingAddress.countryCode.value : "";
                billToObject.setCountry(countryCode);
                billToObject.setPhoneNumber(billingAddress.phone);
                billToObject.setEmail(order.customerEmail);
            }
        }
    }

    return {
        success: true,
        billing_address: billToObject
    };
}



/**
 * 
 * @param order
 * @param paymentInstrument
 * @returns
 */
function createSaleRequestObject(order, paymentInstrument, paymentProcessor) {
    var ObjectBilling = ApexxBillToObject(order, true);
    var ObjectCard = ApexxCardObject(paymentInstrument);
    var billingAddress = empty(ObjectBilling.success) ? "" : ObjectBilling.billing_address;
    
    var cardObject = empty(ObjectCard.success) ? "" : ObjectCard.card;
    var cardToken = paymentInstrument.creditCardToken ? paymentInstrument.creditCardToken : "";
    
    
    const paymentReference = order.orderNo;
    const amount = paymentInstrument.paymentTransaction.amount.value;
    var paymentProcessorId = dworder.PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor().getID();
    var orderCurrency = order.getCurrencyCode();


    if (paymentProcessorId === 'APEXX_HOSTED') {

        var commonBillingObject = {};
        commonBillingObject.account = appPreference.Apexx_Hosted_Account_Id;
        
        // commonBillingObject.organisation = appPreference.ORGANISATION;
        
        commonBillingObject.currency = orderCurrency;
        commonBillingObject.amount = amount;
        commonBillingObject.capture_now = appPreference.CAPTURE_NOW;
        commonBillingObject.billing_address = billingAddress;
        commonBillingObject.dynamic_descriptor = "Demo Merchant Test Account";
        commonBillingObject.merchant_reference = paymentReference;
        commonBillingObject.user_agent = appPreference.USER_AGENT;
        commonBillingObject.webhook_transaction_update = appPreference.WEB_HOOK_TRANSACTION_UPDATE;
        commonBillingObject.three_ds = {};
        commonBillingObject.three_ds.three_ds_required = appPreference.APEXX_HOSTED_3DS_TRUE_FALSE;
        
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

    if (paymentProcessorId === 'APEXX_CREDIT') {
        var commonBillingObject = {};
        
       commonBillingObject.account = appPreference.Apexx_Direct_Credit_Account_Id;

       //commonBillingObject.account = appPreference.ACCOUNT;
       // commonBillingObject.organisation = appPreference.ORGANISATION;
       
        commonBillingObject.currency = orderCurrency;
        commonBillingObject.amount = amount;
        commonBillingObject.capture_now = appPreference.CAPTURE_NOW;
        commonBillingObject.billing_address = billingAddress;
        commonBillingObject.dynamic_descriptor = "Demo Merchant Test Account";
        commonBillingObject.merchant_reference = paymentReference;
        commonBillingObject.user_agent = appPreference.USER_AGENT;
        commonBillingObject.webhook_transaction_update = appPreference.WEB_HOOK_TRANSACTION_UPDATE;
        commonBillingObject.three_ds = {};
        commonBillingObject.three_ds.three_ds_required = appPreference.APEXX_HOSTED_3DS_TRUE_FALSE;
        if(cardToken){
        	commonBillingObject.card = {};
            commonBillingObject.card.cvv = cardObject.cvv;
            commonBillingObject.card.token = cardToken;

        }else{
        	
        	commonBillingObject.card = cardObject;
        }
        
        commonBillingObject.user_agent = appPreference.USER_AGENT;
        commonBillingObject.recurring_type = appPreference.RECURRING_TYPE;
        commonBillingObject.customer_ip = appPreference.CUSTOMER_IP;
        commonBillingObject.three_ds = {
            three_ds_required: appPreference.THREE_DS_REQUIRED
        };


    }


    if (paymentProcessorId === 'APEXX_PayPal') {
        var commonBillingObject = {};
        
        //commonBillingObject.account = appPreference.ACCOUNT;
       // commonBillingObject.organisation = appPreference.ORGANISATION;
        
        
        commonBillingObject.account = appPreference.Apexx_PayPal_Account_Id;

     
        commonBillingObject.capture_now = appPreference.CAPTURE_NOW;
        commonBillingObject.customer_ip = appPreference.CUSTOMER_IP;
        commonBillingObject.recurring_type = appPreference.RECURRING_TYPE;
        commonBillingObject.amount = amount;
        commonBillingObject.currency = orderCurrency,
        commonBillingObject.user_agent = appPreference.USER_AGENT;
        commonBillingObject.locale = appPreference.LOCALE;
        commonBillingObject.dynamic_descriptor = "First Card transaction";
        commonBillingObject.merchant_reference = "PURCHASE" + paymentReference;
        commonBillingObject.payment_product_type = "paypal";
        commonBillingObject.shopper_interaction = "ecommerce";




        commonBillingObject.paypal = {};
        commonBillingObject.paypal.brand_name = "paypal_brand";
        commonBillingObject.paypal.customer_paypal_id = "A82A672GURYSG";
        commonBillingObject.paypal.tax_id = "26062019122";
        commonBillingObject.paypal.tax_id_type = "BR_CPF";
        commonBillingObject.paypal.order = {};
        commonBillingObject.paypal.order.invoice_number = order.getInvoiceNo();
        commonBillingObject.paypal.order.total_tax_amount = '0';
        commonBillingObject.paypal.order.description = "First Create Order Payment";
        commonBillingObject.paypal.order.items = new Array();
        
        var totalQuantities = 0;  
        var productIds =  new Array();
        if (order.getAllLineItems().length > 0) {

            for each(product in order.getAllLineItems()) {

                if ('productID' in product) {
                	
                	totalQuantities += product.quantityValue;
                	productIds.push(product.productID);
                }
            }
        }
        var grossPricePerProduct = ((amount * 100)/totalQuantities);
        
        if (order.getAllLineItems().length > 0) {
            
            for each(product in order.getAllLineItems()) {
            	
                if ('productID' in product && productIds.length > 1) {
                	
                    var items = {};
                    items.item_name = product.productName;
                    items.unit_amount = grossPricePerProduct * product.quantityValue;
                    items.currency = orderCurrency;
                    items.tax_currency = orderCurrency;
                    items.tax_amount = '0';
                    items.quantity = product.quantityValue;
                    items.item_description = product.getProductName();
                    items.sku = product.productID;

                    items.category = "PHYSICAL_GOODS";
                    commonBillingObject.paypal.order.items.push(items);
                }
                if ('productID' in product && productIds.length == 1) {
                	//return amount * 100;
                    var items = {};
                    items.item_name = product.productName;
                    items.unit_amount = amount * 100 ;
                    items.currency = orderCurrency;
                    items.tax_currency = orderCurrency;
                    items.tax_amount = '0';
                    items.quantity = product.quantityValue;
                    items.item_description = product.getProductName();
                    items.sku = product.productID;

                    items.category = "PHYSICAL_GOODS";
                    commonBillingObject.paypal.order.items.push(items);
                }
            }
        }



        commonBillingObject.paypal.redirection_parameters = {};
        commonBillingObject.paypal.redirection_parameters.return_url = appPreference.RETURN_URL_PAY_PayPal;

        commonBillingObject.customer = {};
        commonBillingObject.customer.first_name = order.billingAddress.getFirstName();
        commonBillingObject.customer.last_name = order.billingAddress.getLastName();
        commonBillingObject.customer.email = order.getCustomerEmail();
        commonBillingObject.customer.phone = order.billingAddress.getPhone();
        commonBillingObject.customer.date_of_birth = "1994-08-11";
        commonBillingObject.customer.address = {};
        commonBillingObject.customer.address.address = order.billingAddress.getAddress1() + ' ' + order.billingAddress.getAddress2();
        commonBillingObject.customer.address.city = order.billingAddress.getCity();
        commonBillingObject.customer.address.state = order.billingAddress.getStateCode();
        commonBillingObject.customer.address.postal_code = order.billingAddress.getPostalCode();
        commonBillingObject.customer.address.country = "US";



        commonBillingObject.delivery_customer = {};
        commonBillingObject.delivery_customer.first_name = billingAddress.first_name;
        commonBillingObject.delivery_customer.last_name = billingAddress.last_name;
        commonBillingObject.delivery_customer.address = {};
        commonBillingObject.delivery_customer.address.address = billingAddress.address;
        commonBillingObject.delivery_customer.address.city = billingAddress.city;
        commonBillingObject.delivery_customer.address.state = billingAddress.state;
        commonBillingObject.delivery_customer.address.postal_code = billingAddress.postal_code;
        commonBillingObject.delivery_customer.address.country = "US";

    }
    
    if (paymentProcessorId === 'APEXX_GooglePay') {

        var commonBillingObject = {};
        
        commonBillingObject.account = appPreference.Apexx_GooglePay_Account_Id;
        commonBillingObject.amount = amount;
        commonBillingObject.capture_now = appPreference.Apexx_GooglePay_Capture;
        commonBillingObject.card = {};
        commonBillingObject.card.googlepay = {};
        commonBillingObject.card.googlepay.cryptogram = paymentInstrument.custom.apexxCryptogram;
        commonBillingObject.card.googlepay.expiry_month = paymentInstrument.custom.apexxExpiryMonth;
        commonBillingObject.card.googlepay.expiry_year = paymentInstrument.custom.apexxExpiryYear;
        commonBillingObject.card.googlepay.dpan = paymentInstrument.custom.apexxDpan;
        commonBillingObject.card.googlepay.eci = paymentInstrument.custom.apexxEci;
        commonBillingObject.customer = {};
        commonBillingObject.customer.customer_id = "";
        commonBillingObject.customer.last_name= billingAddress.last_name;
        commonBillingObject.customer.postal_code = billingAddress.postal_code;
        commonBillingObject.customer.account_number = "";
        commonBillingObject.customer_ip = appPreference.CUSTOMER_IP;
        commonBillingObject.dynamic_descriptor = appPreference.Apexx_GooglePay_Dynamic_Descriptor;
        commonBillingObject.merchant_reference = "PURCHASE" + paymentReference;
        commonBillingObject.recurring_type = appPreference.Apexx_GooglePay_Recurring_Type;
        commonBillingObject.user_agent = appPreference.USER_AGENT;
        //commonBillingObject.webhook_transaction_update = appPreference.WEB_HOOK_TRANSACTION_UPDATE;
        var fraud_predictions = {};
        fraud_predictions.error_message = appPreference.Apexx_GooglePay_Fraud_Predictions_Error_Message;
        fraud_predictions.rec = appPreference.Apexx_GooglePay_Fraud_Predictions_Rec;
        fraud_predictions.rules_triggered = [];
        fraud_predictions.score = '0';
        commonBillingObject.fraud_predictions = [fraud_predictions];

        commonBillingObject.billing_address = billingAddress;
        commonBillingObject.shopper_interaction = appPreference.Apexx_GooglePay_Shopper_Interaction;
        commonBillingObject.three_ds = {};
        commonBillingObject.three_ds.three_ds_required = appPreference.Apexx_GooglePay_Three_Ds_Yes_No;

    }
    
    return commonBillingObject;

}

var objectHelper = {
    createSaleRequestObject: createSaleRequestObject,
    ApexxBillToObject: ApexxBillToObject,
    ApexxCardObject: ApexxCardObject
};

module.exports = objectHelper;