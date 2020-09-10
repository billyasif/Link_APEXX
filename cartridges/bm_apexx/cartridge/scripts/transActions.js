'use strict';

/**
 * Apexx Transaction Actions
 */

/* API Includes */
var OrderMgr = require('dw/order/OrderMgr');
var Transaction = require('dw/system/Transaction');
var Resource = require('dw/web/Resource');
var StringUtils = require('dw/util/StringUtils');
var Calendar = require('dw/util/Calendar');
var PaymentMgr = require('dw/order/PaymentMgr');
var apexxConstants = require('*/cartridge/scripts/util/apexxConstants');

/* Script Modules */
var Utils = require('*/cartridge/scripts/util/apexxUtils');
var LogUtils = require('*/cartridge/scripts/util/apexxLogUtils');
var log = LogUtils.getLogger('TransActions');
var apexxServiceWrapperBM = require('~/cartridge/scripts/service/apexxServiceWrapperBM');
var apexxAfterPayServiceWrapperBM = require('~/cartridge/scripts/service/apexxAfterPayServiceWrapperBM');
var Money = require('dw/value/Money');

var appPreferenceBM = require('~/cartridge/config/appPreferenceBM');



/**
 * Call action
 * @param {string} endPoint - api URL
 * @param {Object} request - request object
 * @returns {Object} response
 */
function callAction(endPoint, payLoad) {
    
    var response = apexxServiceWrapperBM.makeServiceCall(apexxConstants.TRANSACTION_TYPE_POST, endPoint, payLoad);

    return response;
}

/**
 * Call action
 * @param {string} endPoint - api URL
 * @param {Object} request - request object
 * @returns {Object} response
 */
function callActionAfterPay(endPoint, payLoad) {
    
    var response = apexxAfterPayServiceWrapperBM.makeServiceCall(apexxConstants.TRANSACTION_TYPE_POST, endPoint, payLoad);

    return response;
}

/**
 * Updates the order status
 * @param {string} orderNo - order no
 */
function updateOrderStatus(orderNo) {
    var Order = OrderMgr.getOrder(orderNo);

    try {
        Transaction.begin();
        Order.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
        Order.setStatus(Order.ORDER_STATUS_CANCELLED);
        Transaction.commit();
    } catch (e) {
        Transaction.rollback();
        log.error('Exception occured while updating the order status after Refund Transaction' + e);
    }
}

/**
 * Refund Transaction 
 * @param {string} orderNo - order no
 * @param {string} amount - refund amount
 * @returns {Object} response
 */
function refundTransaction(orderNo, amount,captureid) {
	
    var order = OrderMgr.searchOrder('orderNo = {0}', orderNo);
    //return (order.custom.apexxPaidAmount > 0.0 );
    var endPoint = appPreferenceBM.SERVICE_HTTP_REFUND;
    var status = false;
    var transactionHistory;
    var transactionID = order.getPaymentTransaction().transactionID;

    var captureID = order.custom.apexxCaptureId || '';
    var error;
    var refundAmount;
    var payLoad;
    var response;
    var paidAmount;
    var paymentInstruments = order.getPaymentInstruments()[0];
    var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstruments.paymentMethod).paymentProcessor;
   
    if(paymentProcessor.ID === apexxConstants.PROCESSOR_AFTER_PAY){
    	 //try {
        var endPoint = appPreferenceBM.SERVICE_HTTP_REFUND_AFTERPAY;

        refundAmount = amount;
        payLoad = makeAfterPayRefundRequest(order, refundAmount, transactionID, captureid);
        log.debug('Refund request: ' + JSON.stringify(payLoad));
        response = callActionAfterPay(endPoint, payLoad);
      

        if (response && response.ok === false) {
        	  status = false;
              response = JSON.stringify(response.object);
              paidAmount = order.custom.apexxPaidAmount;
              error = response;
        } else if (response && response.ok === true && response.object.status != apexxConstants.STATUS_DECLINED && response.object.status != apexxConstants.STATUS_FAILED && response.object.status != apexxConstants.INTERNAL_ERROR_SFCC ) {
            status = true;
            paidAmount = parseFloat(order.custom.apexxPaidAmount, 10) - refundAmount;
            setAfterPayOrderAttributesHistory(apexxConstants.ACTION_REFUND, order, response, paidAmount);
            updateTransactionHistory(apexxConstants.ACTION_REFUND, order, response, amount);
            if (paidAmount === 0) {
                updateOrderStatus(orderNo);
            }
        } else {
            status = false;
            response = JSON.stringify(response.object);
            error = response;
        }
//    } catch (e) {
//        log.error('Exception occurred: ' + e.message);
//
//    }
    }else{
    	 //try {
        var endPoint = appPreferenceBM.SERVICE_HTTP_REFUND;
        
        refundAmount = amount;
        payLoad = makeRefundRequest(order, refundAmount, transactionID, captureid);
        log.debug('Refund request: ' + JSON.stringify(payLoad));
        response = callAction(endPoint, payLoad);
       

        if (response && response.ok === false) {
        	  status = false;
              response = JSON.stringify(response.object);
              paidAmount = order.custom.apexxPaidAmount;
              error = response;
        } else if (response && response.ok === true && response.object.status != apexxConstants.STATUS_DECLINED && response.object.status != apexxConstants.STATUS_FAILED && response.object.status != apexxConstants.INTERNAL_ERROR_SFCC ) {
            status = true;
            paidAmount = parseFloat(order.custom.apexxPaidAmount, 10) - refundAmount;
            setOrderAttributesHistory(apexxConstants.ACTION_REFUND, order, response, paidAmount);
            updateTransactionHistory(apexxConstants.ACTION_REFUND, order, response, amount);
            if (paidAmount === 0) {
                updateOrderStatus(orderNo);
            }
        } else {
            status = false;
            response = JSON.stringify(response.object);
            error = response;
        }
//    } catch (e) {
//        log.error('Exception occurred: ' + e.message);
//
//    }
    }
    
    return {
    	payLoad:payLoad,
    	response:response,
        status: status,
        error: error
    };
}



/**
 * Cancel(void) operation
 * @param {string} orderNo - order no
 * @returns {Object} response
 */
function cancelTransaction(orderNo) {
    var order = OrderMgr.searchOrder('orderNo = {0}', orderNo);
    var transactionID;
    var amount;
    var status;
    var error;
    var payLoad;
    var response;
    var paidAmount;

    
    var paymentInstruments = order.getPaymentInstruments()[0];

    var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstruments.paymentMethod).paymentProcessor;
   
    if(paymentProcessor.ID === apexxConstants.PROCESSOR_AFTER_PAY ){
        var endPoint = appPreferenceBM.SERVICE_HTTP_CANCEL_AFTERPAY;

    	transactionID = order.getPaymentTransaction().transactionID;
        amount = order.custom.apexxAuthAmount || '';
        payLoad = makeAfterPayCancelRequest(order, transactionID);
        log.debug('cancel request: ' + JSON.stringify(payLoad));
        response = callActionAfterPay(endPoint, payLoad);
        

        if (response && response.ok === false) {
            status = false;
            response = JSON.stringify(response.object);
            paidAmount = order.custom.apexxPaidAmount;
            error = response;
        } else if (response && response.ok === true && response.object.status != apexxConstants.STATUS_DECLINED && response.object.status != apexxConstants.STATUS_FAILED && response.object.status != apexxConstants.INTERNAL_ERROR_SFCC) {
            status = true;
            setAfterPayOrderAttributesHistory(apexxConstants.ACTION_CANCEL, order, response, paidAmount);
            updateTransactionHistory(apexxConstants.ACTION_CANCEL, order, response, amount);
            updateOrderStatus(orderNo);
        } else {
            status = false;
            response = JSON.stringify(response.object);
            error = response;
        }
        
    }else{
    	// try {
        var endPoint = appPreferenceBM.SERVICE_HTTP_BASE_API_URL;

    	 transactionID = order.getPaymentTransaction().transactionID;
         amount = order.custom.apexxAuthAmount || '';
         payLoad = makeCancelRequest(orderNo, transactionID);
         log.debug('cancel request: ' + JSON.stringify(payLoad));
         response = callAction(endPoint, payLoad);
        
         if (response && response.ok === false) {
             status = false;
             response = JSON.stringify(response.object);
             paidAmount = order.custom.apexxPaidAmount;
             error = response;
         } else if (response && response.ok === true && response.object.status != apexxConstants.STATUS_DECLINED && response.object.status != apexxConstants.STATUS_FAILED && response.object.status != apexxConstants.INTERNAL_ERROR_SFCC) {
             status = true;
             setOrderAttributesHistory(apexxConstants.ACTION_CANCEL, order, response, paidAmount);
             updateTransactionHistory(apexxConstants.ACTION_CANCEL, order, response, amount);
             updateOrderStatus(orderNo);
         } else {
             status = false;
             response = JSON.stringify(response.object);
             error = response;
         }
//     } catch (e) {
//         log.error('Exception occurred: ' + e.message);
 //
//     }
    }
    
       

    return {
    	payLoad:payLoad,
    	response:response,
        status: status,
        error: error
    };
}




/**
 * Capture action
 * @param {string} orderNo - order no
 * @param {string} amount - apture amount
 * @returns {Object} response
 */
function captureTransaction(orderNo, amount) {
    var order = OrderMgr.searchOrder('orderNo = {0}', orderNo);
    var status = false;
    var amount = amount;
    var paymentMethod = order.getPaymentInstruments()[0].getPaymentMethod();
    var grossAmount = (order.custom.apexxPaidAmount) ? order.totalGrossPrice.value - order.custom.apexxPaidAmount  : order.totalGrossPrice.value;
    var remainCaptureAmount = grossAmount - amount ;
    var request;
    var response;
    var error;
    var paidAmount;
    var transactionID = order.getPaymentTransaction().transactionID;
   
   var paymentInstruments = order.getPaymentInstruments()[0];

    var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstruments.paymentMethod).paymentProcessor;
   
    if(paymentProcessor.ID === apexxConstants.PROCESSOR_AFTER_PAY ){
        var endPoint = appPreferenceBM.SERVICE_HTTP_CAPTURE_AFTERPAY;
        var payLoad =  makeAfterPayCaptureRequest(order, amount , transactionID);
        // try {
        // eslint-disable-line no-param-reassign
        var response = callActionAfterPay(endPoint, payLoad);
       
        if (response && response.ok === false) {
            status = false;
            response = JSON.stringify(response.object);
            error = response;

        } else if (response && response.ok === true && response.object.status != apexxConstants.STATUS_DECLINED && response.object.status != apexxConstants.STATUS_FAILED && response.object.status != apexxConstants.INTERNAL_ERROR_SFCC) {
            status = true;
            paidAmount = parseFloat(amount);
            setAfterPayOrderAttributesHistory(apexxConstants.ACTION_CAPTURE, order, response, paidAmount);
            updateTransactionHistory(apexxConstants.ACTION_CAPTURE, order, response, amount);
        } else {
            status = false;
            response = JSON.stringify(response.object);
            error = response;
        }
//    } catch (e) {
//        log.error('Exception occurred: ' + e.message);
//    }
       
    }else{
      
      var endPoint = appPreferenceBM.SERVICE_HTTP_CAPTURE;
      var payLoad = makeCaptureRequest(order, amount , transactionID);
      // try {
      // eslint-disable-line no-param-reassign
      
      if(paymentMethod === apexxConstants.APEXX_PAYPAL_PAYMENT_METHOD && remainCaptureAmount <= 0){
    	  payLoad.final_capture = true;
    	
      }else if(paymentMethod === apexxConstants.APEXX_PAYPAL_PAYMENT_METHOD && remainCaptureAmount >= 0){
    	  payLoad.final_capture = false;
      }
     
      var response = callAction(endPoint, payLoad);
      
      if (response && response.ok === false) {
          status = false;
          response = JSON.stringify(response.object);
          error = response;

      } else if (response && response.ok === true && response.object.status != apexxConstants.STATUS_DECLINED && response.object.status != apexxConstants.STATUS_FAILED && response.object.status != apexxConstants.INTERNAL_ERROR_SFCC) {
          status = true;
          paidAmount = parseFloat(amount);
          setOrderAttributesHistory(apexxConstants.ACTION_CAPTURE, order, response, paidAmount);
          updateTransactionHistory(apexxConstants.ACTION_CAPTURE, order, response, amount);
      } else {
          status = false;
          response = JSON.stringify(response.object);
          error = response;
      }
//  } catch (e) {
//      log.error('Exception occurred: ' + e.message);
//  }
    }
 
    return {
    	payLoad:payLoad,
    	response:response,
        status: status,
        error: error
    };
}


/**
 * Generate Capture Request
 * @param {Object} order - order object
 * @param {string} amount - capture amount
 * @param {string} transactionID - transaction id
 */
function makeCaptureRequest(order, amount, transactionID) {
    var orderNo = order.orderNo;
    var transactionHistory = order.custom.apexxTransactionHistory || '[]';
    
    if(transactionHistory){
	    var captureRef = getCaptureReference(order);
	    if(captureRef){
	      var orderNo = orderNo+'-'+captureRef;	
	    }
    }
    
    return {
        amount: amount,
        capture_reference: orderNo,
        endPointUrl: transactionID,
    }
}


/**
 * Generate Capture Request AfterPay
 * @param {Object} order - order object
 * @param {string} amount - capture amount
 * @param {string} transactionID - transaction id
 */
function makeAfterPayCaptureRequest(order, amount, transactionID) {
        var orderNo = order.orderNo;
        var objDate = new Date();
        var captureRequest = {};
        var invoice = apexxConstants.TRANSACTION_TYPE_INVOICE;
	    captureRequest.endPointUrl =  transactionID;

    	captureRequest.gross_amount =  order.totalGrossPrice.multiply(100).value;
    	captureRequest.net_amount  =   order.totalNetPrice.multiply(100).value;
    	var uniqueInvoiceCounter = getCaptureReference(order);
  	   
    	if(uniqueInvoiceCounter){
  	      captureRequest.invoice_number = invoice+'_'+order.getInvoiceNo()+'-'+uniqueInvoiceCounter;	
  	    }else{
  	    	captureRequest.invoice_number =  invoice+'_'+order.getInvoiceNo();
  	    }
  	    
    	captureRequest.invoice_date = StringUtils.formatCalendar(new Calendar(order.getCreationDate()), 'yyyy-MM-dd');
    	captureRequest.override_merchant_reference = true;
       
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
    
	    var itemsArr = new Array();
	    
	    
	    if (order.getAllLineItems().length > 0) {
	        
	        for each(product in order.getAllLineItems()) {
	        	
	            if ('productID' in product && productIds.length > 1) {
	            	
	            	 var net_price = product.adjustedNetPrice.multiply(100).value;
	           	     var gross_price = product.adjustedGrossPrice.multiply(100).value;
	                 var taxValue =   product.adjustedTax.multiply(100).value;
	                 var vatPercentage =  product.adjustedTax.multiply(100).divide(net_price).multiply(100).value;   
	                 var items = {};
	                
	                items.product_id = product.productID;
	                items.group_id =  apexxConstants.STATIC_GROUP_ID;
	                items.item_description = product.productName;
	                items.vat_amount = taxValue ;
	                items.net_unit_price = net_price;
	                items.gross_unit_price = gross_price;
	                items.quantity = apexxConstants.STATIC_QUANTITY ;
	                items.vat_percent = vatPercentage;
	                items.additional_information = product.productName;
	                itemsArr.push(items);
	
	            }
	            if ('productID' in product && productIds.length == 1) {
	                
	            	 var net_price = product.adjustedNetPrice.multiply(100).value;
	           	     var gross_price = product.adjustedGrossPrice.multiply(100).value;
	                 var taxValue =   product.adjustedTax.multiply(100).value;
	                 var vatPercentage =  product.adjustedTax.multiply(100).divide(net_price).multiply(100).value;   
	                 var items = {};
	                
	          	  
	                var items = {};
	                items.product_id = product.productID;
	                items.group_id =  apexxConstants.STATIC_GROUP_ID;
	                items.item_description = product.productName;
	                items.vat_amount = taxValue ;
	                items.net_unit_price = net_price;
	                items.gross_unit_price = gross_price;
	                items.quantity = apexxConstants.STATIC_QUANTITY ;
	                items.vat_percent = vatPercentage;
	                items.additional_information = product.productName;
	                
	                itemsArr.push(items);
	                
	
	            }
	        }
	    }
	
	    if(order.shippingTotalGrossPrice.value){
	  	  
	    	  var GrossshippingPrice = order.shippingTotalGrossPrice.multiply(100).value;
	    	  var netUnitShipPrice = order.getShippingTotalNetPrice().multiply(100).value;
	          var taxValue =   order.shippingTotalTax.multiply(100).value;
	          var vatPercentage =  order.shippingTotalTax.multiply(100).divide(netUnitShipPrice).multiply(100).value;   

	    	  
	    	  
	    	  var items = {};
	    	  items.product_id = apexxConstants.TYPE_SHIPPING_PRODUCT;
	    	  items.group_id =  apexxConstants.STATIC_GROUP_ID;
	    	  items.item_description = apexxConstants.TYPE_SHIPPING_PRODUCT;
	    	  items.vat_amount = taxValue;
	    	  items.net_unit_price = netUnitShipPrice;
	    	  items.gross_unit_price = GrossshippingPrice;
	    	  items.quantity = apexxConstants.STATIC_QUANTITY;
	    	  items.vat_percent =vatPercentage;
	    	  items.additional_information = apexxConstants.TYPE_SHIPPING_PRODUCT;
	  	      itemsArr.push(items);
	    
	    }
    
      captureRequest.items = itemsArr;
      return captureRequest;
}


/**
 * Generate credit Request
 * @param {Object} order - order object
 * @param {string} amount - refund amount
 * @param {string} transactionID - transaction id
 * @returns {Object} captureID details
 */
function makeRefundRequest(order, amount, transactionID, captureID) {
    return {
        amount: amount,
        endPointUrl: transactionID,
        capture_id:captureID
    };
}


/**
 * Generate credit Request AfterPay
 * @param {Object} order - order object
 * @param {Object} transactionID - transaction id
 */
function makeAfterPayRefundRequest(order, refundAmount, transactionID, captureid) {

	var refundRequest = {};
    var itemsArr = new Array();
	var refund = apexxConstants.TRANSACTION_TYPE_REFUND;
    var uniqueInvoiceCounter = getRefundReference(order);
    var Currency = order.getCurrencyCode();
    var refundAmount = new Money(refundAmount, Currency);
    refundRequest.endPointUrl = order.custom.apexxTransactionID;
    refundRequest.capture_id = order.custom.apexxCaptureId;
    
    if (uniqueInvoiceCounter) {
        refundRequest.creditnote_number = refund + '_' + order.getInvoiceNo() + '-' + uniqueInvoiceCounter;
    } else {
        refundRequest.creditnote_number = refund + '_' + order.getInvoiceNo();
    }
    
    
    var totalQuantities = 0;
    var productIds = new Array();
    var productNames = new Array();
    var productIdsStrings;
    var productNameStrings;
    if (order.getAllLineItems().length > 0) {

        for each(product in order.getAllLineItems()) {

            if ('productID' in product) {

                totalQuantities += product.quantityValue;
                productIds.push(product.productID);
                productNames.push(product.productName);
            }
        }
        productIdsStrings = productIds.join('-');
        productNameStrings = productNames.join('-');

    }

    
    if (order.totalGrossPrice.multiply(100).value === refundAmount.multiply(100).value ) {

        if (order.getAllLineItems().length > 0) {

            for each(product in order.getAllLineItems()) {

                if ('productID' in product && productIds.length > 1) {

                    var net_price = product.adjustedNetPrice.multiply(100).value;
                    var gross_price = product.adjustedGrossPrice.multiply(100).value;
                    var taxValue = product.adjustedTax.multiply(100).value;
                    var vatPercentage = product.adjustedTax.multiply(100).divide(net_price).multiply(100).value;
                    var items = {};


                    items.product_id = product.productID;
                    items.group_id = apexxConstants.STATIC_GROUP_ID;
                    items.item_description = product.productName;
                    items.vat_amount = taxValue;
                    items.net_unit_price = net_price;
                    items.gross_unit_price = gross_price;
                    items.quantity = apexxConstants.STATIC_QUANTITY;
                    items.vat_percent = vatPercentage;
                    items.additional_information = product.productName;
                    itemsArr.push(items);

                }
                if ('productID' in product && productIds.length == 1) {

                    var net_price = product.adjustedNetPrice.multiply(100).value;
                    var gross_price = product.adjustedGrossPrice.multiply(100).value;
                    var taxValue = product.adjustedTax.multiply(100).value;
                    var vatPercentage = product.adjustedTax.multiply(100).divide(net_price).multiply(100).value;
                    var items = {};



                    var items = {};
                    items.product_id = product.productID;
                    items.group_id = apexxConstants.STATIC_GROUP_ID;
                    items.item_description = product.productName;
                    items.vat_amount = taxValue;
                    items.net_unit_price = net_price;
                    items.gross_unit_price = gross_price;
                    items.quantity = apexxConstants.STATIC_QUANTITY ;
                    items.vat_percent = vatPercentage;
                    items.additional_information = product.productName;

                    itemsArr.push(items);


                }
            }
        }

        if (order.shippingTotalGrossPrice.value) {

            var GrossshippingPrice = order.shippingTotalGrossPrice.multiply(100).value;
            var netUnitShipPrice = order.getShippingTotalNetPrice().multiply(100).value;
            var taxValue = order.shippingTotalTax.multiply(100).value;
            var vatPercentage = order.shippingTotalTax.multiply(100).divide(netUnitShipPrice).multiply(100).value;



            var items = {};
            items.product_id = apexxConstants.TYPE_SHIPPING_PRODUCT;
            items.group_id = apexxConstants.STATIC_GROUP_ID;
            items.item_description = apexxConstants.TYPE_SHIPPING_PRODUCT;
            items.vat_amount = taxValue;
            items.net_unit_price = netUnitShipPrice;
            items.gross_unit_price = GrossshippingPrice;
            items.quantity = apexxConstants.STATIC_QUANTITY ;
            items.vat_percent = vatPercentage;
            items.additional_information = apexxConstants.TYPE_SHIPPING_PRODUCT;
            itemsArr.push(items);

        }
    } else {
        // For Partial Refunds
        
        var gross_unit_price = refundAmount.multiply(100).value;
        var partialRefundArray = {
            product_id: productIdsStrings, // Product Id can not set here , so set order number
            group_id: apexxConstants.STATIC_GROUP_ID, // As of now  hard coded,instructed from team.
            gross_unit_price: gross_unit_price,
            item_description: 'Parital Refund -'+ productNameStrings, // Multiple product can not set,Description
            quantity: '1'
        }
        itemsArr = [partialRefundArray];
    }
    
	refundRequest.items = itemsArr;
    return refundRequest;
}

/**
 * generate Void Request
 * @param {string} orderNo - orderNo
 * @param {string} transactionID - transaction id
 */
function makeCancelRequest(orderNo, transactionID) {
    var endPointUrl = transactionID + '/cancel';
    return {
        endPointUrl: endPointUrl || '',
        cancel_capture_reference: orderNo
    };
}


/**
 * generate Void Request For AfterPay
 * @param {string} captureID - Capture ID
 * @returns {Object} Capture object
 */
function makeAfterPayCancelRequest(order, transactionID) {
    return {
    	endPointUrl:transactionID,
    	merchant_reference: order.custom.apexxMerchantReference,
    	gross_amount: order.totalGrossPrice.multiply(100).value
    };
}





/**
 * Keeps the transaction details in order custom attributes and history
 * @param {string} action - transaction action
 * @param {Object} order - order object
 * @param {Object} response -response object
 * @param {string} paidAmount - paid amount
 */
function setOrderAttributesHistory(action, order, response, paidAmount) {
    var transactionHistory = order.custom.apexxTransactionHistory || '[]';
    var captureAmount = order.custom.apexxCaptureAmount;
    var authAmount = Utils.round(order.custom.apexxAuthAmount || 0.0);
    var grossAmount = (order.custom.apexxPaidAmount) ? order.totalGrossPrice.value - order.custom.apexxPaidAmount  : order.totalGrossPrice.value;
    var response = response.object;
    var amount;

    if (action === apexxConstants.ACTION_CAPTURE) {
        // eslint-disable-next-line
        amount = response.amount ? parseFloat(response.amount) : 0.0;
        captureAmount += amount;
        paidAmount = order.custom.apexxPaidAmount + paidAmount; // eslint-disable-line no-param-reassign
    } else {
        amount = response.amount ? response.amount : 0.0;
    }

    if (action === apexxConstants.ACTION_CAPTURE) {
        var transactionStatus = (response.status === apexxConstants.STATUS_CAPTURED) ? apexxConstants.STATUS_PROCESSING : response.status ;
        
        Transaction.wrap(function() {
            order.custom.apexxCaptureId = response._id || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxMerchantReference = response.merchant_reference || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxTransactionStatus = transactionStatus || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxCaptureAmount = captureAmount; // eslint-disable-line no-param-reassign
            order.custom.apexxPaidAmount = paidAmount; // eslint-disable-line no-param-reassign
        });
       
        var Currency = order.getCurrencyCode();
        var grossAmount = order.totalGrossPrice.value;
        var grossAmount = new Money(grossAmount, Currency);
        var captureAmount = new Money(order.custom.apexxPaidAmount,Currency);
        var reaminAmount = grossAmount.subtract(captureAmount).value;


        if((grossAmount.equals(captureAmount)) === true){
        	transactionStatus = apexxConstants.STATUS_PROCESSING;
        }
        
        if((grossAmount.equals(captureAmount)) === false){
        	
        	transactionStatus = apexxConstants.PAYMENT_STATUS_PARTPAID;
        }
        
        
        
        Transaction.wrap(function() {
            order.custom.apexxTransactionStatus = transactionStatus || ''; // eslint-disable-line no-param-reassign
        });
    };

    if (action === apexxConstants.ACTION_CANCEL) {
        var transactionStatus = response.status ? response.status : "";
        var cancelAmount = (paidAmount - amount) ? paidAmount - amount : 0.0;
        Transaction.wrap(function() {
            order.custom.apexxTransactionStatus = transactionStatus || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxPaidAmount = cancelAmount; // eslint-disable-line no-param-reassign
        });
    }
    
    if (action === apexxConstants.ACTION_REFUND) {
        var transactionStatus = response.status ? response.status : "";
        Transaction.wrap(function() {
	        order.custom.apexxTransactionStatus = transactionStatus || ''; // eslint-disable-line no-param-reassign
	        order.custom.apexxPaidAmount = paidAmount; // eslint-disable-line no-param-reassign
	    });

        
        var paidAmount = new Money(order.custom.apexxPaidAmount,Currency);

        
        if(paidAmount.value){
        	transactionStatus = apexxConstants.REFUND_STATUS_PARTPAID;
        }
        
        Transaction.wrap(function() {
            order.custom.apexxTransactionStatus = transactionStatus;
        });
    }


    return true;

}



/**
 * Keeps the transaction details in order custom attributes and history For AfterPay
 * @param {string} action - transaction action
 * @param {Object} order - order object
 * @param {Object} response -response object
 * @param {string} paidAmount - paid amount
 */
function setAfterPayOrderAttributesHistory(action, order, response, paidAmount) {
    var transactionHistory = order.custom.apexxTransactionHistory || '[]';
    var captureAmount = order.custom.apexxCaptureAmount;
    var authAmount = Utils.round(order.custom.apexxAuthAmount || 0.0);

    var response = response.object;
    var amount;

    if (action === apexxConstants.ACTION_CAPTURE) {
        // eslint-disable-next-line
        amount = response.captured_amount ? parseFloat(response.captured_amount) : 0.0;
        captureAmount += amount;
        paidAmount = order.custom.apexxPaidAmount + paidAmount; // eslint-disable-line no-param-reassign
    } else if (action === apexxConstants.ACTION_REFUND){
        amount = response.total_refunded_amount ? response.total_refunded_amount : 0.0;
    }else if (action === apexxConstants.ACTION_CANCEL){
        amount = response.amount ? response.amount : 0.0;
    }

    if (action === apexxConstants.ACTION_CAPTURE && captureAmount) {
        var transactionStatus = (response.status && captureAmount < authAmount) ? apexxConstants.PAYMENT_STATUS_PARTPAID : apexxConstants.STATUS_PROCESSING;
        Transaction.wrap(function() {
            order.custom.apexxCaptureId = response._id || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxMerchantReference = response.merchant_reference || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxTransactionStatus = transactionStatus || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxCaptureAmount = captureAmount; // eslint-disable-line no-param-reassign
            order.custom.apexxPaidAmount = paidAmount; // eslint-disable-line no-param-reassign
        });
        
        var Currency = order.getCurrencyCode();
        var grossAmount = order.totalGrossPrice.value;
        var grossAmount = new Money(grossAmount, Currency);
        var captureAmount = new Money(order.custom.apexxPaidAmount,Currency);
        var reaminAmount = grossAmount.subtract(captureAmount).value;


        if((grossAmount.equals(captureAmount)) === true){
        	transactionStatus = apexxConstants.STATUS_PROCESSING;
        }
        
        if((grossAmount.equals(captureAmount)) === false){
        	
        	transactionStatus = apexxConstants.PAYMENT_STATUS_PARTPAID;
        }
        
        
        
        Transaction.wrap(function() {
            order.custom.apexxTransactionStatus = transactionStatus || ''; // eslint-disable-line no-param-reassign
        });
    };

    if (action === apexxConstants.ACTION_CANCEL) {
        var transactionStatus = response.status ? response.status : "";
        var cancelAmount = (paidAmount - amount) ? paidAmount - amount : 0.0;
        Transaction.wrap(function() {
            order.custom.apexxTransactionStatus = transactionStatus || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxPaidAmount = cancelAmount; // eslint-disable-line no-param-reassign
        });
    }
   
    if (action === apexxConstants.ACTION_REFUND) {
        var transactionStatus = response.status ? response.status : "";
        Transaction.wrap(function() {
            order.custom.apexxTransactionStatus = transactionStatus || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxPaidAmount = paidAmount; // eslint-disable-line no-param-reassign
        });
        var paidAmount = new Money(order.custom.apexxPaidAmount,Currency);
        
        if(paidAmount.value){
        	transactionStatus = apexxConstants.REFUND_STATUS_PARTPAID;
        }
        
        Transaction.wrap(function() {
            order.custom.apexxTransactionStatus = transactionStatus;
        });
    }


    return true;

}

/**
 * For order history updates
 * @param {string} action - transaction action
 * @param {Object} order - order object
 * @param {Object} response -response object
 * @param {string} amount - amount
 */
function updateTransactionHistory(action, order, response, amount) {
	try {

		var amount = (action === apexxConstants.ACTION_CANCEL) ? order.totalGrossPrice.value : amount;
	    var transactionHistory = order.custom.apexxTransactionHistory || '[]';
	    var response = response.object;
	    var transactionType = action.toUpperCase() || '';
	    var status = response.status || '';
	    var merchant_reference = response.merchant_reference ? response.merchant_reference : order.orderNo;
	    var ID = response._id ? response._id : '';
	    var paymentInstruments = order.getPaymentInstruments()[0];
	    var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstruments.paymentMethod).paymentProcessor;

	    var paymentMethod = paymentInstruments.paymentMethod;
	    if(order.custom.apexxTransactionStatus === apexxConstants.PAYMENT_STATUS_PARTPAID && action === apexxConstants.ACTION_CAPTURE){
	    	status = apexxConstants.PAYMENT_STATUS_PARTPAID;
	    }
	    if(order.custom.apexxTransactionStatus === apexxConstants.STATUS_PROCESSING && action === apexxConstants.ACTION_CAPTURE){
	    	status = apexxConstants.STATUS_PROCESSING;
	    }
	    
	    if(order.custom.apexxTransactionStatus === apexxConstants.REFUND_STATUS_PARTPAID && action === apexxConstants.ACTION_REFUND){
	    	status = apexxConstants.REFUND_STATUS_PARTPAID;
	    }
	    
	    if(action ==='refund' && paymentProcessor.getID === "APEXX_AFTERPAY" && response.refund_numbers ){
	    	merchant_reference = response.refund_numbers[0];
	    }
	    
	    transactionHistory = JSON.parse(transactionHistory);
	   
	    transactionHistory.push({
	        id: ID,
	        merchant_reference: merchant_reference || '',
	        status: status,
	        type: transactionType,
	        amount: amount,
	        action: action,
	        date: (new Date()).getTime()
	    });
	  
	    Transaction.wrap(function() {
	        order.custom.apexxTransactionHistory = JSON.stringify(transactionHistory); // eslint-disable-line no-param-reassign
	    });
	} catch (e) {
        log.error('UpdateHistory' + e);
    }
}



/**
 * For date format
 * @param {Object} Date
 */

function getDateFormat(format) {

    var date = StringUtils.formatCalendar(new Calendar(new Date()), format);
    return date;
}

function getCaptureReference(order){
    var transactionHistory = order.custom.apexxTransactionHistory || '[]';

	if(transactionHistory){
	    transactionHistory = JSON.parse(transactionHistory);

	    var count = new Array();
	    for(var i = 0; i < transactionHistory.length; i++) {
	    	if(transactionHistory[i].status === apexxConstants.PAYMENT_STATUS_PARTPAID){
	    		count.push(apexxConstants.PAYMENT_STATUS_PARTPAID);
	    	}
	    }
	}
	return count.length;

}

function getRefundReference(order){
    var transactionHistory = order.custom.apexxTransactionHistory || '[]';

	if(transactionHistory){
	    transactionHistory = JSON.parse(transactionHistory);

	    var count = new Array();
	    for(var i = 0; i < transactionHistory.length; i++) {
	    	if(transactionHistory[i].status === apexxConstants.REFUND_STATUS_PARTPAID){
	    		count.push(apexxConstants.REFUND_STATUS_PARTPAID);
	    	}
	    }
	}
	return count.length;

}

exports.captureTransaction = function(orderNo, amount) {
    return captureTransaction(orderNo, amount);
};
exports.refundTransaction = function(orderNo, amount,captureid) {
    return refundTransaction(orderNo, amount,captureid);
};
exports.cancelTransaction = function(orderNo) {
    return cancelTransaction(orderNo);
};