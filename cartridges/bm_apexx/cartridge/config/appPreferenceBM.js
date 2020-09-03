'use strict';

module.exports = Object.freeze({
    CREDIT_CARD_DIRECT_URL: 'https://sandmgw.apexxfintech.com/mgw/payment/direct',
    XAPIKEY: '9112b8801b5b4e1ea57aeffabb563142',
    ACCOUNT:'1db380005b524103bf323f9ef63ae1cf',
    ORGANISATION:'c7639f98175a4e3b95edf8afe096ff82',
    CAPTURE_NOW:false,
    SAVE_CARD:true,
    CUSTOMER_IP:request.httpHeaders['x-is-remote_addr'],
    RECURRING_TYPE:"first",
    USER_AGENT: request.httpUserAgent,
    THREE_DS_REQUIRED:false,
    SERVICE_HTTP_BASE_API_URL:"apexx.https.base.api.url",
    SERVICE_HTTP_DIRECT_PAY:"apexx.https.directpay",
    SERVICE_HTTP_CAPTURE:"apexx.https.capture",
    SERVICE_HTTP_CANCEL_CAPTURE:"apexx.https.cancel.capture",
    SERVICE_HTTP_REFUND:"apexx.https.refund",
    SERVICE_HTTP_CAPTURE_AFTERPAY:"apexx.https.capture.afterpay",
    SERVICE_HTTP_CANCEL_AFTERPAY:"apexx.https.cancel.afterpay",
    SERVICE_HTTP_REFUND_AFTERPAY:"apexx.https.refund.afterpay",

    POST_METHOD:"POST",
    GET_METHOD:"GET"
    
});