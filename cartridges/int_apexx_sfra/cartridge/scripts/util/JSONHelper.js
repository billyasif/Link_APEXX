'use strict';

/**
 * Tries to parse a string into a JSON, returns the object if successful, false otherwise
 *
 * @param str {String} the string to parse
 * @return {Object} the object or false if unsuccessful
 */
exports.parse = function parse(jsonString, defaultValue) {
    try {
        var obj = JSON.parse(jsonString);

        // Handle non-exception-throwing cases:
        // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
        // but... JSON.parse(null) returns 'null', and typeof null === "object",
        // so we must check for that, too.
        if (obj && typeof obj === 'object' && obj !== null) {
            return obj;
        }
    } catch (e) {
        require('dw/system/Logger').debug('Failed to parse the given string: {0}', e);
        return defaultValue;
    }

    return defaultValue;
};