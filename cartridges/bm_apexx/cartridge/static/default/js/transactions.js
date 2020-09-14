'use strict';

var j = jQuery.noConflict();

function isObject(val) {
    if (val === null) {
        return false;
    }
    return ((typeof val === 'function') || (typeof val === 'object'));
}

var trans = {
    init: function() {
        if (j('.apexx-module .operations-holder').length) {
            this.transOperationsEvents();
        }
    },
    transOperationsEvents: function() {
        j('.operations-holder input[type=text]').on('focus', function() {
            j(this).closest('tr').find('input[type=radio]').prop('checked', true);
        });

        j('.transaction-actions').on('click', function() {
            j('.operations-holder').toggle();
            j(this).text(j.trim(j(this).text()) === Resources.SHOW_ACTIONS ? Resources.HIDE_ACTIONS : Resources.SHOW_ACTIONS);
            j('.operations-holder button[name=submit]').focus();
        });

        j('.operations-holder button').on('click', function() {
            var button = j(this),
                buttonLabel = button.text(),
                action = j('input[name=operation]:checked').val(),
                orderno = j('input[name=orderno]').val(),
                maxCaptureAmount = parseFloat(j('input[name=maxcaptureamount]').val(), 10),
                maxRefundAmount = parseFloat(j('input[name=maxrefundamount]').val(), 10),
                captureid = j('input[name=captureid]').val(),
                paymentMethod = j('input[name=paymentMethod]').val(),

                url, postData, amount;

            if (!action) {
                j('.operations-holder .error').text(Resources.CHOOSE_ACTIONS);
                return false;
            }

            if (action == "settle" && j('input[name=settleamount]').val() == "") {
                j('.operations-holder .error').text(Resources.INVALID_CAPTURE_AMOUNT);
                return false;
            }

            if (action == "refund" && j('input[name=refundamount]').val() == "") {
                j('.operations-holder .error').text(Resources.INVALID_REFUND_AMOUNT);
                return false;
            }

            amount = action == "capture" ? parseFloat(j('input[name=captureamount]').val(), 10) : parseFloat(j('input[name=refundamount]').val(), 10);

            if (action == "capture") {
                if (amount <= 0.0) {
                    j('.operations-holder .error').text(Resources.INVALID_CAPTURE_AMOUNT);
                    return false;
                } else if (amount > maxCaptureAmount) {
                    j('.operations-holder .error').text(Resources.MAXIMUM_CAPTURE_AMOUNT + maxCaptureAmount);
                    return false;
                }
            }

            if (action == "refund") {
                if (amount <= 0.0) {
                    j('.operations-holder .error').text(Resources.INVALID_REFUND_AMOUNT);
                    return false;
                } else if (amount > maxRefundAmount) {
                    j('.operations-holder .error').text(Resources.MAXIMUM_REFUND_AMOUNT + maxRefundAmount);
                    return false;
                }
            }

            j('.operations-holder .error').text("");
            url = Urls.operationActions;
            postData = {
                action: action,
                orderno: orderno,
                amount: amount,
                captureid: captureid,
                paymentMethod,
                paymentMethod
            };

            button.prop("disabled", true);
            button.text(Resources.TRANSACTION_PROCESSING);

            j.post(url, postData, function(result) {
                button.prop("disabled", false);
                button.text(buttonLabel);

                if (result && result.status) {
                    try {
                        if (isObject(result)) {
                            var response = result.response.object;
                            if ('reason_message' in response && isObject(response)) {
                                alert(response.reason_message);
                                window.location.reload();
                            } else {
                                alert(Resources.TRANSACTION_SUCCESS);
                                window.location.reload();
                            }
                        } else {
                            alert(Resources.TRANSACTION_BAD_RESPONSE);
                        }
                        console.log(result);

                    } catch (err) {
                        alert(err);
                    }

                } else {
                    try {
                        if (isObject(result)) {
                            var response = JSON.parse(result.response);

                            if ('message' in response && isObject(response)) {
                                alert(response.message);
                            } else if ('reason_message' in response && isObject(response)) {
                                alert(response.reason_message);
                            }
                        } else {
                            alert(Resources.TRANSACTION_BAD_RESPONSE);
                        }

                    } catch (err) {
                        alert(err);
                    }
                    console.log(result);
                }
            });
        });

        j('.operations-holder input[type=text]').on('keypress', function(e) {
            var code = e.which,
                input = j(this);

            if (code == 46) {
                if (input.val() == "") {
                    input.val("0.");
                    e.preventDefault();
                } else if (input.val().indexOf('.') >= 0) {
                    e.preventDefault();
                }
            } else if (code != 0 && code != 8 && (code < 48 || code > 57)) {
                e.preventDefault();
            }
        }).on('blur', function() {
            var input = j(this);

            if (input.val() != "") {
                if (this.name !== 'captureid') {
                    input.val(parseFloat(input.val(), 10));
                }
            } else if (input.val().indexOf('.') == 0) {
                if (this.name !== 'captureid') {
                    input.val("0" + input.val());
                }
            }
        });
    }
};

//initialize app
j(document).ready(function() {
    trans.init();
});