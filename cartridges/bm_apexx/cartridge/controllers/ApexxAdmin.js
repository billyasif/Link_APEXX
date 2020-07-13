'use strict';

/**
 * Controller for Order management pages
 *
 */

/* API Includes */
var OrderMgr = require('dw/order/OrderMgr');
var ISML = require('dw/template/ISML');

/**
 * Apexx Order List page
 * */
function orderList() {
    var pageSize = request.httpParameterMap.pagesize.value; // eslint-disable-line no-undef
    var pageNumber = request.httpParameterMap.pagenumber.value; // eslint-disable-line no-undef
    var orderNumber = request.httpParameterMap.ordernumber.value || ''; // eslint-disable-line no-undef
  
    pageSize = pageSize ? parseInt(pageSize, 10) : 10;
    pageNumber = pageNumber ? parseInt(pageNumber, 10) : 1;

    orderListResponse = require('~/cartridge/scripts/getOrders').output({
        pageSize: pageSize,
        pageNumber: pageNumber,
        orderNumber: orderNumber
    });

    ISML.renderTemplate('application/orderlist', orderListResponse);
}

/**
 * Apexx Order Details page
 * */
function orderDetails() {
    var resourceHelper = require('~/cartridge/scripts/util/resource');
    var utils = require('*/cartridge/scripts/util/apexxUtils');
    var orderNo = request.httpParameterMap.OrderNo.stringValue; // eslint-disable-line no-undef
    var order = OrderMgr.searchOrder('orderNo = {0}', orderNo);
    var dueAmount = utils.round(order.getTotalGrossPrice().value - (order.custom.apexxPaidAmount || 0.0));
    var paidAmount = utils.round(order.custom.apexxPaidAmount || 0.0);
    var authAmount = utils.round(order.custom.apexxAuthAmount || 0.0);
    var captureAmount = utils.round(order.custom.apexxAuthAmount - order.custom.apexxCaptureAmount) || 0.0;
    var transactionHistory = order.custom.apexxTransactionHistory || '[]';
   
    var transType =  order.custom.apexxTransactionType?order.custom.apexxTransactionType.toUpperCase():"";
    var transStatus = order.custom.apexxTransactionStatus?order.custom.apexxTransactionStatus.toUpperCase():"";
    var canCapture;
    var canRefund;
    var canCancel;
    
   if(transType == 'AUTH' && (transStatus == 'AUTHORISED' || transStatus == 'PAYMENT_STATUS_PARTPAID') || ((transStatus == 'COMPLETED' || transStatus == 'AUTHORISED') && captureAmount > 0)){
    	var canCapture = "canCapture";
    }
    if((transType == 'PAYMENT' && transStatus == 'COMPLETED') || (transType == 'CAPTURE' && transStatus == 'COMPLETED') || (paidAmount > 0 &&  dueAmount < order.getTotalGrossPrice().getValue())){
    	var canRefund = "canRefund";
    }
    if(transType == "AUTH" && transStatus == 'AUTHORISED' ){
    	
    	var canCancel = "canCancel";
    }
    
    
    transactionHistory = sortHistory(transactionHistory);
//var r = require('~/cartridge/scripts/util/response');
//return r.renderJSON({transactionHistory:transactionHistory});
    
    ISML.renderTemplate('application/orderdetails', {
        resourceHelper: resourceHelper,
        order: order,
        transactionHistory: transactionHistory,
        dueAmount: dueAmount,
        paidAmount: paidAmount,
        authAmount: authAmount,
        captureAmount: captureAmount,
        canCapture:canCapture,
        canRefund:canRefund,
        canCancel:canCancel
        
        
    });
}



// For Sorting History

function sortHistory(transactionHistory){
	
	if(transactionHistory){
	    transactionHistory = JSON.parse(transactionHistory);
	    transactionHistory.sort(function(a,b){ return b.date - a.date;});
	    transactionHistory = JSON.stringify(transactionHistory);
	}
	return transactionHistory;

}


/**
 * Exposed web methods
 */
orderList.public = true;
orderDetails.public = true;

exports.OrderList = orderList;
exports.OrderDetails = orderDetails;
