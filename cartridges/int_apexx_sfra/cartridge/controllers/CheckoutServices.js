'use strict';

/* globals session */

const server = require('server');
const base = module.superModule;
server.extend(base);
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var appPreference = require('~/cartridge/config/appPreference')();
var commonHelper = require('*/cartridge/scripts/util/commonHelper');
var cardValidator = require('*/cartridge/scripts/util/cardValidator');

//API
var PaymentMgr = require('dw/order/PaymentMgr');

/**
 *  Handle Ajax payment (and billing) form submit
 */
server.replace(
    'SubmitPayment',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var PaymentManager = require('dw/order/PaymentMgr');
        var HookManager = require('dw/system/HookMgr');
        var Resource = require('dw/web/Resource');
        var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');

        var viewData = {};
        var paymentForm = server.forms.getForm('billing');
        

        
        // verify billing form data
        var billingFormErrors = COHelpers.validateBillingForm(paymentForm.addressFields);
        var contactInfoFormErrors = COHelpers.validateFields(paymentForm.contactInfoFields);

        var formFieldErrors = [];
        if (Object.keys(billingFormErrors).length) {
            formFieldErrors.push(billingFormErrors);
        } else {
            viewData.address = {
                firstName: { value: paymentForm.addressFields.firstName.value },
                lastName: { value: paymentForm.addressFields.lastName.value },
                address1: { value: paymentForm.addressFields.address1.value },
                address2: { value: paymentForm.addressFields.address2.value },
                city: { value: paymentForm.addressFields.city.value },
                postalCode: { value: paymentForm.addressFields.postalCode.value },
                countryCode: { value: paymentForm.addressFields.country.value }
            };

            if (Object.prototype.hasOwnProperty.call(paymentForm.addressFields, 'states')) {
                viewData.address.stateCode = { value: paymentForm.addressFields.states.stateCode.value };
            }
        }

        if (Object.keys(contactInfoFormErrors).length) {
            formFieldErrors.push(contactInfoFormErrors);
        } else {
            viewData.email = {
                value: paymentForm.contactInfoFields.email.value
            };

            viewData.phone = { value: paymentForm.contactInfoFields.phone.value };
        }

        
    	var paymentMethodIdValue = server.forms.getForm('billing').paymentMethod.value; 
        //res.json(paymentMethodIdValue);return next();
        if (!PaymentManager.getPaymentMethod(paymentMethodIdValue).paymentProcessor) {
            throw new Error(Resource.msg(
                'error.payment.processor.missing',
                'checkout',
                null
            ));
        }

        var paymentProcessor = PaymentManager.getPaymentMethod(paymentMethodIdValue).getPaymentProcessor();
        var paymentFormResult;
        if (HookManager.hasHook('app.payment.form.processor.' + paymentProcessor.ID.toLowerCase())) {
            paymentFormResult = HookManager.callHook('app.payment.form.processor.' + paymentProcessor.ID.toLowerCase(),
                'processForm',
                req,
                paymentForm,
                viewData
            );
        } else {
            paymentFormResult = HookManager.callHook('app.payment.form.processor.default_form_processor', 'processForm');
        }

        if (paymentFormResult.error && paymentFormResult.fieldErrors) {
            formFieldErrors.push(paymentFormResult.fieldErrors);
        }

        if (formFieldErrors.length || paymentFormResult.serverErrors) {
            // respond with form data and errors
            res.json({
                form: paymentForm,
                fieldErrors: formFieldErrors,
                serverErrors: paymentFormResult.serverErrors ? paymentFormResult.serverErrors : [],
                error: true
            });
            return next();
        }
        
     

        res.setViewData(paymentFormResult.viewData);

        this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
            var BasketMgr = require('dw/order/BasketMgr');
            var HookMgr = require('dw/system/HookMgr');
            var PaymentMgr = require('dw/order/PaymentMgr');
            var PaymentInstrument = require('dw/order/PaymentInstrument');
            var Transaction = require('dw/system/Transaction');
            var AccountModel = require('*/cartridge/models/account');
            var OrderModel = require('*/cartridge/models/order');
            var URLUtils = require('dw/web/URLUtils');
            var Locale = require('dw/util/Locale');
            var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
            var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
            var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');

            var currentBasket = BasketMgr.getCurrentBasket();

            var billingData = res.getViewData();

            if (!currentBasket) {
                delete billingData.paymentInformation;

                res.json({
                    error: true,
                    cartError: true,
                    fieldErrors: [],
                    serverErrors: [],
                    redirectUrl: URLUtils.url('Cart-Show').toString()
                });
                return;
            }

            var validatedProducts = validationHelpers.validateProducts(currentBasket);
            if (validatedProducts.error) {
                delete billingData.paymentInformation;

                res.json({
                    error: true,
                    cartError: true,
                    fieldErrors: [],
                    serverErrors: [],
                    redirectUrl: URLUtils.url('Cart-Show').toString()
                });
                return;
            }

            var billingAddress = currentBasket.billingAddress;
            var billingForm = server.forms.getForm('billing');
            var paymentMethodID = billingData.paymentMethod.value;
            var result;

            billingForm.creditCardFields.cardNumber.htmlValue = '';
            billingForm.creditCardFields.securityCode.htmlValue = '';

            Transaction.wrap(function () {
                if (!billingAddress) {
                    billingAddress = currentBasket.createBillingAddress();
                }

                billingAddress.setFirstName(billingData.address.firstName.value);
                billingAddress.setLastName(billingData.address.lastName.value);
                billingAddress.setAddress1(billingData.address.address1.value);
                billingAddress.setAddress2(billingData.address.address2.value);
                billingAddress.setCity(billingData.address.city.value);
                billingAddress.setPostalCode(billingData.address.postalCode.value);
                if (Object.prototype.hasOwnProperty.call(billingData.address, 'stateCode')) {
                    billingAddress.setStateCode(billingData.address.stateCode.value);
                }
                billingAddress.setCountryCode(billingData.address.countryCode.value);

                if (billingData.storedPaymentUUID) {
                    billingAddress.setPhone(req.currentCustomer.profile.phone);
                    currentBasket.setCustomerEmail(req.currentCustomer.profile.email);
                } else {
                    billingAddress.setPhone(billingData.phone.value);
                    currentBasket.setCustomerEmail(billingData.email.value);
                }
            });

            // if there is no selected payment option and balance is greater than zero
            if (!paymentMethodID && currentBasket.totalGrossPrice.value > 0) {
                var noPaymentMethod = {};

                noPaymentMethod[billingData.paymentMethod.htmlName] =
                    Resource.msg('error.no.selected.payment.method', 'payment', null);

                delete billingData.paymentInformation;

                res.json({
                    form: billingForm,
                    fieldErrors: [noPaymentMethod],
                    serverErrors: [],
                    error: true
                });
                return;
            }

            //Validate CSE
            var cseCardNumber;
            var cardType;
            var paymentMethodIdValue = paymentForm.paymentMethod.value;
            if(paymentMethodIdValue === "APEXX_CLIENT_SIDE"){
            	var cseCardNumber =paymentForm.creditCardClientFields.cseCardNumber.value.toString();
                var isValidCseCardNymber = cardValidator.IsValidCreditCardNumber(cseCardNumber);
                if (!isValidCseCardNymber){
                    // Invalid Payment Instrument
                    var invalidPaymentMethod = Resource.msg('error.payment.not.valid', 'checkout', null);
	                delete billingData.paymentInformation;

                    res.json({
	                    form: billingForm,
                    	fieldErrors: [],
                        serverErrors: [invalidPaymentMethod],
                        error: true
                    });
                    return;
                }
            }
            
            
            // Validate payment instrument
                var paymentMethodIdValue = paymentForm.paymentMethod.value;
	            if(paymentMethodIdValue === "CREDIT_CARD"){
	            var creditCardPaymentMethod = PaymentMgr.getPaymentMethod(PaymentInstrument.METHOD_CREDIT_CARD);
	            var paymentCard = PaymentMgr.getPaymentCard(billingData.paymentInformation.cardType.value);
	
	            var applicablePaymentCards = creditCardPaymentMethod.getApplicablePaymentCards(
	                req.currentCustomer.raw,
	                req.geolocation.countryCode,
	                null
	            );
	
	            if (!applicablePaymentCards.contains(paymentCard)) {
	                // Invalid Payment Instrument
	                var invalidPaymentMethod = Resource.msg('error.payment.not.valid', 'checkout', null);
	                delete billingData.paymentInformation;
	                res.json({
	                    form: billingForm,
	                    fieldErrors: [],
	                    serverErrors: [invalidPaymentMethod],
	                    error: true
	                });
	                return;
	            }
            }
            // check to make sure there is a payment processor
            if (!PaymentMgr.getPaymentMethod(paymentMethodID).paymentProcessor) {
                throw new Error(Resource.msg(
                    'error.payment.processor.missing',
                    'checkout',
                    null
                ));
            }

            var processor = PaymentMgr.getPaymentMethod(paymentMethodID).getPaymentProcessor();
            if (HookMgr.hasHook('app.payment.processor.' + processor.ID.toLowerCase())) {
                result = HookMgr.callHook('app.payment.processor.' + processor.ID.toLowerCase(),
                    'Handle',
                    currentBasket,
                    billingData.paymentInformation
                );

            } else {
                result = HookMgr.callHook('app.payment.processor.default', 'Handle');
            }

            // need to invalidate credit card fields
            if (result.error) {
                delete billingData.paymentInformation;

                res.json({
                    form: billingForm,
                    fieldErrors: result.fieldErrors,
                    serverErrors: result.serverErrors,
                    error: true
                });
                return;
            }

            if (HookMgr.hasHook('app.payment.form.processor.' + processor.ID.toLowerCase())) {
                HookMgr.callHook('app.payment.form.processor.' + processor.ID.toLowerCase(),
                    'savePaymentInformation',
                    req,
                    currentBasket,
                    billingData
                );
            } else {
                HookMgr.callHook('app.payment.form.processor.default', 'savePaymentInformation');
            }

            // Calculate the basket
            Transaction.wrap(function () {
                basketCalculationHelpers.calculateTotals(currentBasket);
            });

            // Re-calculate the payments.
            var calculatedPaymentTransaction = COHelpers.calculatePaymentTransaction(
                currentBasket
            );

            if (calculatedPaymentTransaction.error) {
                res.json({
                    form: paymentForm,
                    fieldErrors: [],
                    serverErrors: [Resource.msg('error.technical', 'checkout', null)],
                    error: true
                });
                return;
            }

            var usingMultiShipping = req.session.privacyCache.get('usingMultiShipping');
            if (usingMultiShipping === true && currentBasket.shipments.length < 2) {
                req.session.privacyCache.set('usingMultiShipping', false);
                usingMultiShipping = false;
            }

            hooksHelper('app.customer.subscription', 'subscribeTo', [paymentForm.subscribe.checked, paymentForm.contactInfoFields.email.htmlValue], function () {});

            var currentLocale = Locale.getLocale(req.locale.id);

            var basketModel = new OrderModel(
                currentBasket,
                { usingMultiShipping: usingMultiShipping, countryCode: currentLocale.country, containerView: 'basket' }
            );

            var accountModel = new AccountModel(req.currentCustomer);
            var renderedStoredPaymentInstrument = COHelpers.getRenderedPaymentInstruments(
                req,
                accountModel
            );

            delete billingData.paymentInformation;

            res.json({
                renderedPaymentInstruments: renderedStoredPaymentInstrument,
                customer: accountModel,
                order: basketModel,
                form: billingForm,
                paymentMethod:paymentMethodIdValue,
                error: false,
                afterPayStatus:commonHelper.isAfterPayAllowed()
            });
        });

        return next();
    }
);


server.replace('PlaceOrder', server.middleware.https, function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var OrderMgr = require('dw/order/OrderMgr');
    var Resource = require('dw/web/Resource');
    var Transaction = require('dw/system/Transaction');
    var URLUtils = require('dw/web/URLUtils');
    var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
    var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
    var addressHelpers = require('*/cartridge/scripts/helpers/addressHelpers');
    
    var currentBasket = BasketMgr.getCurrentBasket();

    if (!currentBasket) {
        res.json({
            error: true,
            cartError: true,
            fieldErrors: [],
            serverErrors: [],
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });
        return next();
    }

    var validatedProducts = validationHelpers.validateProducts(currentBasket);
    if (validatedProducts.error) {
        res.json({
            error: true,
            cartError: true,
            fieldErrors: [],
            serverErrors: [],
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });
        return next();
    }

    if (req.session.privacyCache.get('fraudDetectionStatus')) {
        res.json({
            error: true,
            cartError: true,
            redirectUrl: URLUtils.url('Error-ErrorCode', 'err', '01').toString(),
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });

        return next();
    }

    var validationOrderStatus = hooksHelper('app.validate.order', 'validateOrder', currentBasket, require('*/cartridge/scripts/hooks/validateOrder').validateOrder);
    if (validationOrderStatus.error) {
        res.json({
            error: true,
            errorMessage: validationOrderStatus.message
        });
        return next();
    }

    // Check to make sure there is a shipping address
    if (currentBasket.defaultShipment.shippingAddress === null) {
        res.json({
            error: true,
            errorStage: {
                stage: 'shipping',
                step: 'address'
            },
            errorMessage: Resource.msg('error.no.shipping.address', 'checkout', null)
        });
        return next();
    }

    // Check to make sure billing address exists
    if (!currentBasket.billingAddress) {
        res.json({
            error: true,
            errorStage: {
                stage: 'payment',
                step: 'billingAddress'
            },
            errorMessage: Resource.msg('error.no.billing.address', 'checkout', null)
        });
        return next();
    }

    // Calculate the basket
    Transaction.wrap(function () {
        basketCalculationHelpers.calculateTotals(currentBasket);
    });


    // Re-calculate the payments.
    var calculatedPaymentTransactionTotal = COHelpers.calculatePaymentTransaction(currentBasket);
    if (calculatedPaymentTransactionTotal.error) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }

    // Creates a new order.
    var order = COHelpers.createOrder(currentBasket);
   
    if (!order) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }

    // Handles payment authorization
    var handlePaymentResult = COHelpers.handlePayments(order, order.orderNo);
    
    if (handlePaymentResult.error) {
        try {
            if ('errorResponse' in handlePaymentResult) {
                if ('saleTransactionResponseData' in handlePaymentResult.errorResponse) {
                    if ('object' in handlePaymentResult.errorResponse.saleTransactionResponseData) {

                        if ('message' in handlePaymentResult.errorResponse.saleTransactionResponseData.object) {
                            res.json({
                                error: true,
                                errorMessage: handlePaymentResult.errorResponse.saleTransactionResponseData.object.message
                            });
                            return next();

                        }
                        if ('reason_message' in handlePaymentResult.errorResponse.saleTransactionResponseData.object) {
                            res.json({
                                error: true,
                                errorMessage: handlePaymentResult.errorResponse.saleTransactionResponseData.object.reason_message
                            });
                            return next();

                        }

                    }
                }
            }

            res.json({
                error: true,
                errorMessage: Resource.msg('error.technical', 'checkout', null)
            });
            return next();
        } catch (e) {
            res.json({
                error: true,
                errorMessage: e.message
            });
            return next();
        }
    }

    var fraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', currentBasket, require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection);
    if (fraudDetectionStatus.status === 'fail') {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

        // fraud detection failed
        req.session.privacyCache.set('fraudDetectionStatus', true);

        res.json({
            error: true,
            cartError: true,
            redirectUrl: URLUtils.url('Error-ErrorCode', 'err', fraudDetectionStatus.errorCode).toString(),
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });

        return next();
    }

    // Places the order
    var placeOrderResult = COHelpers.placeOrder(order, fraudDetectionStatus);
    if (placeOrderResult.error) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }

    if (req.currentCustomer.addressBook) {
        // save all used shipping addresses to address book of the logged in customer
        var allAddresses = addressHelpers.gatherShippingAddresses(order);
        allAddresses.forEach(function (address) {
            if (!addressHelpers.checkIfAddressStored(address, req.currentCustomer.addressBook.addresses)) {
                addressHelpers.saveAddress(address, req.currentCustomer, addressHelpers.generateAddressName(address));
            }
        });
    }

    if (order.getCustomerEmail()) {
        COHelpers.sendConfirmationEmail(order, req.locale.id);
    }

    // Reset usingMultiShip after successful Order placement
    req.session.privacyCache.set('usingMultiShipping', false);
    
    
    
 
//*************************************APEXX PAYMENT START **************************************//
    var token,hostedUrl,objThreeDs;
    var threeDsReturnUrl;  

    // Validate Hosted Payment Token
    var paymentInstruments = order.getPaymentInstruments()[0];
    
    //Apexx mail stop for hosted
    var paymentForm = server.forms.getForm('billing');
    var paymentMethodIdValue = paymentForm.paymentMethod.value;
    var processor = PaymentMgr.getPaymentMethod(paymentMethodIdValue).getPaymentProcessor();
    
    // Apexx Iframe Hosted Setting
    
    if(paymentInstruments.custom.apexxHostedPaymentPageToken && paymentInstruments.custom.apexxHostedPaymentPageResponseUrl){
    	var token = paymentInstruments.custom.apexxHostedPaymentPageToken || '';
    	var hostedUrl = paymentInstruments.custom.apexxHostedPaymentPageResponseUrl || '';
    	
    	res.json({
            error: false,
            iframe:true,
            height:appPreference.Apexx_Hosted_Iframe_Height || '',
            width:appPreference.Apexx_Hosted_Iframe_Width || '',
            orderID: order.orderNo,
	        paymentMethod:paymentMethodIdValue,
            orderToken: order.orderToken,
	        token:token,
            continueUrl: hostedUrl
        });
        return next();
    }
   
    // Apexx PayPal Redirect Setting
    
    if(paymentInstruments.custom.apexxPayPalPaymentPageToken && paymentInstruments.custom.apexxPayPalPaymentPageResponseUrl){
    	var token = paymentInstruments.custom.apexxPayPalPaymentPageToken || '';
    	var hostedUrl = paymentInstruments.custom.apexxPayPalPaymentPageResponseUrl || '';
    	
    	res.json({
            error: false,
            iframe:false,
            orderID: order.orderNo,
            orderToken: order.orderToken,
	        token:token,
            paymentMethod:paymentMethodIdValue,
            continueUrl: paymentInstruments.custom.apexxPayPalPaymentPageResponseUrl
        });
        return next();
    }
    
   //Apexx Iframe 3DS  Window Setting 
    if('threeDsObj' in handlePaymentResult){
    	objThreeDs = handlePaymentResult.threeDsObj;
    	threeDsTransId = ('_id' in handlePaymentResult.threeDsObj) ? handlePaymentResult.threeDsObj._id : '';
    	threeDsReturnUrl = appPreference.RETURN_URL_DIRECT_CREDIT_THREE_DS + '?transactionId='+ threeDsTransId + '&orderId=' + order.orderNo+ '&method=' + paymentMethodIdValue;
    	var height,width;
    	if(processor.ID === 'APEXX_CLIENT_SIDE'){
    		height = appPreference.Apexx_3ds_Window_Height_CSC;
            width = appPreference.Apexx_3ds_Window_Width_CSC;
    	}
    	
    	if(processor.ID === 'APEXX_CREDIT'){
    		height = appPreference.Apexx_3ds_Window_Height_CCD;
            width = appPreference.Apexx_3ds_Window_Width_CCD;
    	}
    	
    	
        res.json({
            error: false,
            iframe:true,
            orderID: order.orderNo,
            orderToken: order.orderToken,
            height:height,
            width:width,
	        paymentMethod:paymentMethodIdValue,
	        threeDsData:objThreeDs,
            continueUrl: threeDsReturnUrl
        });
        return next();
    }
    
    //*************************************APEXX PAYMENT END **************************************//
    
    

    // TODO: Exposing a direct route to an Order, without at least encoding the orderID
    //  is a serious PII violation.  It enables looking up every customers orders, one at a
    //  time.
    res.json({
        error: false,
        orderID: order.orderNo,
        orderToken: order.orderToken,
        continueUrl: URLUtils.url('Order-Confirm').toString()
    });

    return next();
});


module.exports = server.exports();
