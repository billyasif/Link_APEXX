'use strict';

/**
 * Defines a module to wrap all API calls to ACI
 */

var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var appPreferenceBM = require('~/cartridge/config/appPreferenceBM');
var apexxUtils = require('~/cartridge/scripts/util/apexxUtils');
const server_error = "Internal Server Error";


/**
 * Local Services Framework service definition
 * @type dw.svc.Service
 */

var serviceWraper = function(endpoint) {
var service = LocalServiceRegistry.createService(endpoint, {

	/**
	 * Callback to configure HTTP request parameters before
	 * a call is made to ACI service
	 *
	 */
	createRequest: function (svc: HTTPService, requestParams) {
		svc.addHeader("Content-Type", "application/json");
        svc.addHeader("X-APIKEY", appPreferenceBM.XAPIKEY);

		return JSON.stringify(requestParams);
	},
	parseResponse: function (svc: HTTPService, client: HTTPClient) {
		return client;
	},
	filterLogMessage: function (msg: String) {
		return msg;
	},
	mockCall: function (svc, params) {
		var options = {}

		return {
			statusCode: 200,
			statusMessage: "Success",
			text: options
		};
	},
	getResponseLogMessage: function (response: Object) {
		var responseMsg = 'Status Code: ' + response.statusCode +
			'\n Status Message  : ' + response.statusMessage +
			'\n Response : ' + response.text +
			'\n Error : ' + response.errorText +
			'\n Response Headers : ' + response.responseHeaders +
			'\n Timeout : ' + response.timeout
		return responseMsg;
	}
 });

    return service;
}


/**
 * Forms the authentication  part of the URL query string for prepare checkout API call
 *
 * @returns {String} URL query string
 */
var makeServiceCall = function(method,endPoint, payload) {
	var response = {};
	
   
	var svc = serviceWraper(endPoint);
	if(payload.endPointUrl){
		var svcURL = svc.getURL();
		var newURL = svcURL + payload.endPointUrl;
	    svc.setURL(newURL);
	   delete payload.endPointUrl;
	}
	if(method){
		svc.setRequestMethod(method);
	}
	 
	if(payload.amount){
			var requestAmount = apexxUtils.floatToInt(payload.amount);
		    if(apexxUtils.isInt(requestAmount)){
		    	payload.amount = requestAmount ;
			}
	}
	
	try {
		var result = svc.call(payload);
		if (result == null || result.status === dw.svc.Result.SERVICE_UNAVAILABLE || (!result.ok && !result.object)) {
			response.ok = false;
			response.object = result && 'errorMessage' in result ? replaceAllBackSlash(result.errorMessage) : "SERVICE_UNAVAILABLE";
		} else {
			response.ok = true;
			response.object = replaceAllBackSlash(result.object.text);
			
		}
	} catch (e) {
		response.ok = false;
		response.object = replaceAllBackSlash(e.message);
	}

	if(response.object.amount){
		var responseAmount = apexxUtils.intToFloat(response.object.amount);
		response.object.amount = responseAmount;
	}
	
	
	return response;
}

function replaceAllBackSlash(targetStr){
	
	try {
	    var index = targetStr.indexOf("\\");
	    while (index >= 0) {
	        targetStr = targetStr.replace("\\", "");
	        index = targetStr.indexOf("\\");
	    }

	    return JSON.parse(targetStr);
	} catch (e) {
	    return {
	        "ok": false,
	        "message":server_error,
	        "object":{"status":'SFCC_BUG'}
	    }
	}
}

function isObject(val) {
    if (val === null) {
        return false;
    }
    return ((typeof val === 'function') || (typeof val === 'object'));
}

/*
 * Module Exports
 */

module.exports = {
		makeServiceCall:makeServiceCall
};
