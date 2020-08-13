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
    
    var response = apexxServiceWrapperBM.makeServiceCall('POST', endPoint, payLoad);

    return response;
}

/**
 * Call action
 * @param {string} endPoint - api URL
 * @param {Object} request - request object
 * @returns {Object} response
 */
function callActionAfterPay(endPoint, payLoad) {
    
    var response = apexxAfterPayServiceWrapperBM.makeServiceCall('POST', endPoint, payLoad);

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
   
    if(paymentProcessor.ID === 'APEXX_AfterPay'){
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
        } else if (response && response.ok === true && response.object.status != 'DECLINED' && response.object.status != 'FAILED' && response.object.status != 'SFCC_BUG') {
            status = true;
            paidAmount = parseFloat(order.custom.apexxPaidAmount, 10) - refundAmount;
            setAfterPayOrderAttributesHistory('refund', order, response, paidAmount);
            updateTransactionHistory('refund', order, response, amount);
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
        } else if (response && response.ok === true && response.object.status != 'DECLINED' && response.object.status != 'FAILED' && response.object.status != 'SFCC_BUG') {
            status = true;
            paidAmount = parseFloat(order.custom.apexxPaidAmount, 10) - refundAmount;
            setOrderAttributesHistory('refund', order, response, paidAmount);
            updateTransactionHistory('refund', order, response, amount);
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
   
    if(paymentProcessor.ID === 'APEXX_AfterPay'){
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
        } else if (response && response.ok === true && response.object.status != 'DECLINED' && response.object.status != 'FAILED' && response.object.status != 'SFCC_BUG') {
            status = true;
            setAfterPayOrderAttributesHistory('cancel', order, response, paidAmount);
            updateTransactionHistory('cancel', order, response, amount);
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
         } else if (response && response.ok === true && response.object.status != 'DECLINED' && response.object.status != 'FAILED' && response.object.status != 'SFCC_BUG') {
             status = true;
             setOrderAttributesHistory('cancel', order, response, paidAmount);
             updateTransactionHistory('cancel', order, response, amount);
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
   
    if(paymentProcessor.ID === 'APEXX_AfterPay'){
        var endPoint = appPreferenceBM.SERVICE_HTTP_CAPTURE_AFTERPAY;
        var payLoad =  makeAfterPayCaptureRequest(order, amount , transactionID);
        // try {
        // eslint-disable-line no-param-reassign
        var response = callActionAfterPay(endPoint, payLoad);
       
        if (response && response.ok === false) {
            status = false;
            response = JSON.stringify(response.object);
            error = response;

        } else if (response && response.ok === true && response.object.status != 'DECLINED' && response.object.status != 'FAILED' && response.object.status != 'SFCC_BUG') {
            status = true;
            paidAmount = parseFloat(amount);
            setAfterPayOrderAttributesHistory('capture', order, response, paidAmount);
            updateTransactionHistory('capture', order, response, amount);
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
      
      if(paymentMethod === "APEXX_PAYPAL" && remainCaptureAmount <= 0){
    	  payLoad.final_capture = true;
    	
      }else if(paymentMethod === "APEXX_PAYPAL" && remainCaptureAmount >= 0){
    	  payLoad.final_capture = false;
      }
     
      var response = callAction(endPoint, payLoad);
      
      if (response && response.ok === false) {
          status = false;
          response = JSON.stringify(response.object);
          error = response;

      } else if (response && response.ok === true && response.object.status != 'DECLINED' && response.object.status != 'FAILED' && response.object.status != 'SFCC_BUG') {
          status = true;
          paidAmount = parseFloat(amount);
          setOrderAttributesHistory('capture', order, response, paidAmount);
          updateTransactionHistory('capture', order, response, amount);
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
	    var captureRef = getCaptureReference(transactionHistory);
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
    
	    captureRequest.endPointUrl =  transactionID;

    	captureRequest.gross_amount =  order.totalGrossPrice.multiply(100).value;
    	captureRequest.net_amount  =   order.totalNetPrice.multiply(100).value;

    	captureRequest.invoice_number =  order.getInvoiceNo();
    	captureRequest.invoice_date = "2020-07-28";
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
	            	
	            	var net_price = product.netPrice.multiply(100).value;
	          	    var gross_price = product.grossPrice.multiply(100).value;
	                var taxValue =   product.tax.multiply(100).value;
	                var vatPercentage =  product.tax.multiply(100).divide(net_price).multiply(100).value;   	          	  
	                var items = {};
	                
	                items.product_id = product.productID;
	                items.group_id =  "1";
	                items.item_description = product.productName;
	                items.vat_amount = taxValue ;
	                items.net_unit_price = net_price;
	                items.gross_unit_price = gross_price;
	                items.quantity = 1;
	                items.vat_percent = vatPercentage;
	                items.additional_information = product.productName;
	                itemsArr.push(items);
	
	            }
	            if ('productID' in product && productIds.length == 1) {
	                
	            	var net_price = product.netPrice.multiply(100).value;
	          	    var gross_price = product.grossPrice.multiply(100).value;
	                var taxValue =   product.tax.multiply(100).value;
	                var vatPercentage =  product.tax.multiply(100).divide(net_price).multiply(100).value;   

	                
	          	  
	                var items = {};
	                items.product_id = product.productID;
	                items.group_id =  "1";
	                items.item_description = product.productName;
	                items.vat_amount = taxValue ;
	                items.net_unit_price = net_price;
	                items.gross_unit_price = gross_price;
	                items.quantity = 1;
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
	    	  items.product_id = "shipping";
	    	  items.group_id =  "1";
	    	  items.item_description = "shipping";
	    	  items.vat_amount = taxValue;
	    	  items.net_unit_price = netUnitShipPrice;
	    	  items.gross_unit_price = GrossshippingPrice;
	    	  items.quantity = 1;
	    	  items.vat_percent =vatPercentage;
	    	  items.additional_information = "test";
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
function makeAfterPayRefundRequest(order, transactionID) {
      var refundRequest = {};
      refundRequest.endPointUrl  = order.custom.apexxTransactionID;
      refundRequest.capture_id  = order.custom.apexxCaptureId;
      refundRequest.creditnote_number = order.getInvoiceNo();
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
	            	
	            	var net_price = product.netPrice.multiply(100).value;
	          	    var gross_price = product.grossPrice.multiply(100).value;
	                var taxValue =   product.tax.multiply(100).value;
	                var vatPercentage =  product.tax.multiply(100).divide(net_price).multiply(100).value;   	          	  
	                var items = {};
	                
	                items.product_id = product.productID;
	                items.group_id =  "1";
	                items.item_description = product.productName;
	                items.vat_amount = taxValue ;
	                items.net_unit_price = net_price;
	                items.gross_unit_price = gross_price;
	                items.quantity = 1;
	                items.vat_percent = vatPercentage;
	                items.additional_information = product.productName;
	                itemsArr.push(items);
	
	            }
	            if ('productID' in product && productIds.length == 1) {
	                
	            	var net_price = product.netPrice.multiply(100).value;
	          	    var gross_price = product.grossPrice.multiply(100).value;
	                var taxValue =   product.tax.multiply(100).value;
	                var vatPercentage =  product.tax.multiply(100).divide(net_price).multiply(100).value;   

	                
	          	  
	                var items = {};
	                items.product_id = product.productID;
	                items.group_id =  "1";
	                items.item_description = product.productName;
	                items.vat_amount = taxValue ;
	                items.net_unit_price = net_price;
	                items.gross_unit_price = gross_price;
	                items.quantity = 1;
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
	    	  items.product_id = "shipping";
	    	  items.group_id =  "1";
	    	  items.item_description = "shipping";
	    	  items.vat_amount = taxValue;
	    	  items.net_unit_price = netUnitShipPrice;
	    	  items.gross_unit_price = GrossshippingPrice;
	    	  items.quantity = 1;
	    	  items.vat_percent =vatPercentage;
	    	  items.additional_information = "test";
	  	      itemsArr.push(items);
	    
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

    if (action === 'capture') {
        // eslint-disable-next-line
        amount = response.amount ? parseFloat(response.amount) : 0.0;
        captureAmount += amount;
        paidAmount = order.custom.apexxPaidAmount + paidAmount; // eslint-disable-line no-param-reassign
    } else {
        amount = response.amount ? response.amount : 0.0;
    }

    if (action === 'capture') {
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

    if (action === 'cancel') {
        var transactionStatus = response.status ? response.status : "";
        var cancelAmount = (paidAmount - amount) ? paidAmount - amount : 0.0;
        Transaction.wrap(function() {
            order.custom.apexxTransactionStatus = transactionStatus || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxPaidAmount = cancelAmount; // eslint-disable-line no-param-reassign
        });
    }
    
    if (action === 'refund') {
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

    if (action === 'capture') {
        // eslint-disable-next-line
        amount = response.captured_amount ? parseFloat(response.captured_amount) : 0.0;
        captureAmount += amount;
        paidAmount = order.custom.apexxPaidAmount + paidAmount; // eslint-disable-line no-param-reassign
    } else if (action === 'refund'){
        amount = response.total_refunded_amount ? response.total_refunded_amount : 0.0;
    }else if (action === 'cancel'){
        amount = response.amount ? response.amount : 0.0;
    }

    if (action === 'capture' && captureAmount) {
        var transactionStatus = (response.status && captureAmount < authAmount) ? apexxConstants.PAYMENT_STATUS_PARTPAID : apexxConstants.STATUS_PROCESSING;
        Transaction.wrap(function() {
            order.custom.apexxCaptureId = response._id || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxMerchantReference = response.merchant_reference || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxTransactionStatus = transactionStatus || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxCaptureAmount = captureAmount; // eslint-disable-line no-param-reassign
            order.custom.apexxPaidAmount = paidAmount; // eslint-disable-line no-param-reassign
        });
    };

    if (action === 'cancel') {
        var transactionStatus = response.status ? response.status : "";
        var cancelAmount = (paidAmount - amount) ? paidAmount - amount : 0.0;
        Transaction.wrap(function() {
            order.custom.apexxTransactionStatus = transactionStatus || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxPaidAmount = cancelAmount; // eslint-disable-line no-param-reassign
        });
    }
   
    if (action === 'refund') {
        var transactionStatus = response.status ? response.status : "";
        Transaction.wrap(function() {
            order.custom.apexxTransactionStatus = transactionStatus || ''; // eslint-disable-line no-param-reassign
            order.custom.apexxPaidAmount = paidAmount; // eslint-disable-line no-param-reassign
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

		var amount = (action === 'cancel') ? order.totalGrossPrice.value : amount;
	    var transactionHistory = order.custom.apexxTransactionHistory || '[]';
	    var response = response.object;
	    var transactionType = action.toUpperCase() || '';
	    var status = response.status || '';
	    var merchant_reference = response.merchant_reference ? response.merchant_reference : order.orderNo;
	    var ID = response._id ? response._id : '';
	
	    if(order.custom.apexxTransactionStatus === apexxConstants.PAYMENT_STATUS_PARTPAID && action ==='capture'){
	    	status = apexxConstants.PAYMENT_STATUS_PARTPAID;
	    }
	    if(order.custom.apexxTransactionStatus === apexxConstants.STATUS_PROCESSING && action ==='capture'){
	    	status = apexxConstants.STATUS_PROCESSING;
	    }
	    
	    if(order.custom.apexxTransactionStatus === apexxConstants.REFUND_STATUS_PARTPAID && action ==='refund'){
	    	status = apexxConstants.REFUND_STATUS_PARTPAID;
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

function getCaptureReference(transactionHistory){
	
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

function getRefundReference(transactionHistory){
	
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