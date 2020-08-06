'use strict';

(function ($) {
	
	$( "#apxhosted" ).click(function() {
        var billingAddressForm = $('#dwfrm_billing .billing-address-block :input').serializeArray();
        console.log(billingAddressForm);
        
        
        var newwindow;
        function createPop(url, name)
        {    
           newwindow=window.open(url,name,'width=560,height=340,toolbar=0,menubar=0,location=0');  
           if (window.focus) {newwindow.focus()}
        }
	});
    
	if($('#afterPayStatus').val() === "true" ){
		
	   //$('form  [data-method-id="APEXX_AFTERPAY"]').hide();
    }else{
 	   //$('form  [data-method-id="APEXX_AFTERPAY"]').show();

    }
	
}(jQuery));



