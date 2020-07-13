/*
 *	Creates custom log file for the cartridge
 */

// API Includes
var Logger = require('dw/system/Logger');
var Resource = require('dw/web/Resource');

// Global Variables
var defaultLogFilePrefix = Resource.msg('log.filename', 'apexx', null);

var LoggerUtils = {};

LoggerUtils.getLogger = function (category) {
    if (category) {
        return Logger.getLogger(defaultLogFilePrefix, category);
    } else { // eslint-disable-line no-else-return
        return Logger.getLogger(defaultLogFilePrefix);
    }
};


module.exports = LoggerUtils;
