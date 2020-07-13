/**
 * Resource helper
 *
 */
function ResourceHelper() {}

/**
 * Get the client-side resources of a given page
 * @returns {Object} An objects key key-value pairs holding the resources
 */
ResourceHelper.getResources = function () {
    var Resource = require('dw/web/Resource');

    // application resources
    var resources = {

        // Transaction operation messages
        SHOW_ACTIONS: Resource.msg('operations.show.actions', 'apexx', null),
        HIDE_ACTIONS: Resource.msg('operations.hide.actions', 'apexx', null),
        CHOOSE_ACTIONS: Resource.msg('operations.actions', 'apexx', null),
        TRANSACTION_SUCCESS: Resource.msg('transaction.success', 'apexx', null),
        TRANSACTION_FAILED: Resource.msg('transaction.failed', 'apexx', null),
        TRANSACTION_PROCESSING: Resource.msg('operations.wait', 'apexx', null),
        INVALID_CAPTURE_AMOUNT: Resource.msg('capture.amount.validation', 'apexx', null),
        INVALID_REFUND_AMOUNT: Resource.msg('refund.amount.validation', 'apexx', null),
        MAXIMUM_REFUND_AMOUNT: Resource.msg('maximum.refund.amount', 'apexx', null),
        MAXIMUM_CAPTURE_AMOUNT: Resource.msg('maximum.capture.amount', 'apexx', null)

    };
    return resources;
};

/**
 * Get the client-side URLs of a given page
 * @returns {Object} An objects key key-value pairs holding the URLs
 */
ResourceHelper.getUrls = function () {
    var URLUtils = require('dw/web/URLUtils');

    // application urls
    var urls = {
        operationActions: URLUtils.url('Operations-Action').toString()
    };
    return urls;
};

module.exports = ResourceHelper;
