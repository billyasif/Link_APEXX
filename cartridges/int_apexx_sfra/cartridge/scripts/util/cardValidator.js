"use strict";

function AmexCardnumber(inputtxt) {
	  var cardno = /^(?:3[47][0-9]{13})$/;
	  return cardno.test(inputtxt);
	}

	function VisaCardnumber(inputtxt) {
	  var cardno = /^4[0-9]{12}(?:[0-9]{3})?$/;
	  return cardno.test(inputtxt);
	}

	function MasterCardnumber(inputtxt) {
	  var cardno = /^(5[1-5][0-9]{14}|2(22[1-9][0-9]{12}|2[3-9][0-9]{13}|[3-6][0-9]{14}|7[0-1][0-9]{13}|720[0-9]{12}))$/;
	  return cardno.test(inputtxt);
	}

	function DiscoverCardnumber(inputtxt) {
	  var cardno = /^65[4-9][0-9]{13}|64[4-9][0-9]{13}|6011[0-9]{12}|(622(?:12[6-9]|1[3-9][0-9]|[2-8][0-9][0-9]|9[01][0-9]|92[0-5])[0-9]{10})$/;
	  return cardno.test(inputtxt);
	}

	function DinerClubCardnumber(inputtxt) {
	  var cardno = /^3(?:0[0-5]|[68][0-9])[0-9]{11}$/;
	  return cardno.test(inputtxt);
	}

	function JCBCardnumber(inputtxt) {
	  var cardno = /^(?:2131|1800|35\d{3})\d{11}$/;
	  return cardno.test(inputtxt);
	}

	function IsValidCreditCardNumber(cardNumber) {
	  
	  cardNumber = cardNumber.trim();	
	  var length = cardNumber.split(" ").length;
	  if(length > 1){
		  cardNumber =  cardNumber.split(" ").join('');
	  }
	  
	  var cardType = null;
	  if (VisaCardnumber(cardNumber)) {
	    cardType = "visa";
	  } else if (MasterCardnumber(cardNumber)) {
	    cardType = "mastercard";
	  } else if (AmexCardnumber(cardNumber)) {
	    cardType = "americanexpress";
	  } else if (DiscoverCardnumber(cardNumber)) {
	    cardType = "discover";
	  } else if (DinerClubCardnumber(cardNumber)) {
	    cardType = "dinerclub";
	  } else if (JCBCardnumber(cardNumber)) {
	    cardType = "jcb";
	  }

	  return cardType;
	}
	
	
	var cardFunction = {
			IsValidCreditCardNumber: IsValidCreditCardNumber
		};	
module.exports = cardFunction;
