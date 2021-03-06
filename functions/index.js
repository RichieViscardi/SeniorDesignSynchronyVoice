'use strict';

// Import the Dialogflow module from the Actions on Google client library.
const {dialogflow} = require('actions-on-google');

// Import the firebase-functions package for deployment.
const functions = require('firebase-functions');

// Instantiate the Dialogflow client.
const app = dialogflow({debug: true});

const admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);

const db = admin.firestore();
const dbRef = db.collection('Cards');

var currentCardNum = '';
var currentCardPin = '';
var currentCardLocked = false;
var currentBalance='';
var currentName='';


var todayDate= new Date();
var currenttime=todayDate.getHours();
var greeting='';
var greeting_bye='';
var cardChecked=false;
var pinConfirmed=false;
var welcomed=false;


app.intent('Card Number', (conv, {number}) => {
  const theCardNumber = number.toString()
  const currRef = dbRef.doc(theCardNumber);
  return currRef.get()
  .then((snapshot) => {
    const {balance, cardNumber, cardPin, isLocked,name} = snapshot.data();
    currentCardNum = cardNumber;
    currentCardPin = cardPin;
    currentCardLocked = isLocked;
    currentBalance=balance;
    currentName=', '+name;
    conv.ask('Your card ending in ' + theCardNumber + ' has been found' + currentName +'. Please enter this cards PIN to confirm');
    cardChecked=true;
    return null;
  }).catch((e) => {
    if(cardChecked===false){
      conv.close('The card ending in ' + theCardNumber + ' has not been found.');
    }
    return null;
  });
});

app.intent('Card Pin', (conv, {number}) => {
  var response='';
  const actualPin = currentCardPin;
  const pinToCheck = number.toString();
  if ((pinToCheck === actualPin) && cardChecked) {
    response='Your PIN has been confirmed. What would you like to know about this card?';
    pinConfirmed=true;
  } else if ((pinToCheck !== actualPin) && cardChecked){
    response='The PIN you entered is incorrect. Please try again. ';
  } else {
    reponse='Oops, something went wrong. Please try again. ';
  }
  conv.ask(response);

});


app.intent('Lock Card', (conv) => {
  var fraud='You can call (860)-817-8983 if you want to report a fraud. '
  var response='';
  if (cardChecked===false){
    response='Please say the last four digits of your card. ';
  } else if (pinConfirmed===false){
    response='You cannot lock your card before entering the pin! Please say the pin number of your card first. ';
  } else if (currentCardLocked && pinConfirmed) {
    response='Your card ending in ' + currentCardNum.toString() + ' was already locked. '+ fraud + 'Is there anything else you need?';
  } else {
    const currRef = dbRef.doc(currentCardNum.toString());
    var updateSingle = currRef.update({isLocked: true});
    currentCardLocked = true;
    response='Your card ending in ' + currentCardNum.toString() + ' is now locked. '+ fraud;
  }
  conv.ask(response);
  return null;
});

app.intent('Unlock Card', (conv) => {
  var response='';
  if (cardChecked===false){
    response='Please say the last four digits of your card. ';
  } else if (pinConfirmed===false){
    response='You cannot unlock your card before entering the pin! Please say the pin number of your card first. ';
  } else if (currentCardLocked && pinConfirmed) {
    const currRef = dbRef.doc(currentCardNum.toString());
    var updateSingle = currRef.update({isLocked: false});
    currentCardLocked = false;
    response='Your card ending in ' + currentCardNum.toString() + ' is now unlocked. Is there anything else you need?';
  } else {
    response='Your card ending in ' + currentCardNum.toString() + ' was already unlocked. Is there anything else I can help with?';
  }
  conv.ask(response);
  return null;
});




app.intent('Search Transaction', (conv, {Product}) => {

  if (cardChecked===false){
    conv.ask('Please say the last four digits of your card first. ');
    return null;
  } else if (pinConfirmed===false){
    conv.ask('You cannot search transaction before entering the pin! Please say the pin number of your card first. ');
  } else if  (currentCardLocked) {
    conv.ask('You card ending in ' +currentCardNum.toString() + ' is locked. Please unlock your card first, to search your transaction. ');
  }else{
    var totalSpending=0;
    const theProduct = Product.toLowerCase()
    const currRef = dbRef.doc(currentCardNum.toString()).collection('Transactions');
    var theResponse = '';
    return currRef.where('Item', '==', theProduct).get()
    .then((snapshot) => {
      if (snapshot.empty) {
        conv.ask('Hmm. It looks like there are no recent purchases on ' + theProduct + '. Anything else you need? ');
        return null;
      }


      snapshot.forEach(doc => {
        const {Date, Item, Price, Timestamp} = doc.data();
        totalSpending=totalSpending+Price;
        theResponse = theResponse + 'There was a transaction on ' + Date + ' for $' + Price + '. ';
      });
      var totalSpent='You spent $'+ totalSpending+ ' on ' + Product+'. ';
      theResponse = totalSpent+ theResponse + ' Anything else you need help with?';
      conv.ask(theResponse);
      return null;
    }).catch((e) => {
      console.log('error:', e);
      conv.close('There was an error, please try again.');
      return null;
    });
  }
});


app.intent('Current Balance', (conv) => {
  if (cardChecked===false){
    conv.ask('Please say the last four digits of your card. ');
  } else if (pinConfirmed===false){
    conv.ask('You cannot check your balance before entering the pin! Please say the pin number of your card first. ');
  } else if  (currentCardLocked) {
    conv.ask('You card ending in ' +currentCardNum.toString() + ' is locked. Please unlock your card first, to check your balance. ');
  }else {
    if(currentBalance.toString() !== ''){
      conv.ask('You owe $' + currentBalance.toString() + '. What would you like to do' + currentName + '?');
    }else{
      conv.close('Sorry, there was an error, please try again.');
    }
    return null;
  }
});

app.intent('SearchByDate', (conv, {theNumber, DateString}) => {
  if (cardChecked===false){
    conv.ask('Please say the last four digits of your card. ');
  } else if (pinConfirmed===false){
    conv.ask('You cannot check your balance before entering the pin! Please say the pin number of your card first. ');
  } else if  (currentCardLocked) {
    conv.ask('You card ending in ' +currentCardNum.toString() + ' is locked. Please unlock your card first, to check your transactions. ');
  }else {
    var today = new Date();
    var currTimeStamp = Math.round((new Date()).getTime() / 1000);
    var dd = today.getDate();
    var mm = today.getMonth();
    var timeToCheck = currTimeStamp;
    var theResponse = 'In regards to that time frame: ';

    console.log(theNumber);
    console.log(DateString);

    if (DateString === 'day' || DateString === 'night') {
      timeToCheck = timeToCheck - 24*60*60;
    }
    if (DateString === 'week') {
      timeToCheck = timeToCheck - 24*60*60*7;
    }
    if (DateString === 'month') {
      timeToCheck = timeToCheck - 24*60*60*7*4;
    }

    if (DateString === 'days' || DateString === 'nights') {
      timeToCheck = timeToCheck - 24*60*60*theNumber;
    }
    if (DateString === 'weeks') {
      timeToCheck = timeToCheck - 24*60*60*7*theNumber;
    }
    if (DateString === 'months') {
      timeToCheck = timeToCheck - 24*60*60*7*4*theNumber;
    }


    const currRef = dbRef.doc(currentCardNum.toString()).collection('Transactions');
    return currRef.where('Timestamp', '>=', timeToCheck).get()
    .then((snapshot) => {
      if (snapshot.empty) {
        conv.ask('The card ending in ' + currentCardNum.toString() + ' has no transactions in that timeframe. ');
        return null;
      }

      snapshot.forEach(doc => {
        const {Date, Item, Price, Timestamp} = doc.data();
        theResponse = theResponse + 'There was a transaction on ' + Date + ' for $' + Price + '. ';
      });

      theResponse = theResponse + 'Anything else I can help with?';
      conv.ask(theResponse);
      return null;
    }).catch((e) => {
      console.log('error:', e);
      conv.close('There was an error, please try again' + currentName + '.');
      return null;
    });

  }

});



app.intent('Change Pin', (conv, {theNumber}) => {
  var response='';
  if (cardChecked===false){
    response='Please say the last four digits of your card. ';
  } else if (pinConfirmed===false){
    response='You cannot change your pin before entering the current one! Please say the pin number of your card first. ';
  }else if  (currentCardLocked) {
    response='You card ending in ' +currentCardNum.toString() + ' is locked. Please unlock your card first, to change your pin. ';
  }else {
    const currRef = dbRef.doc(currentCardNum.toString());
    if(theNumber.toString() !== ''){
      var updateSingle = currRef.update({cardPin: theNumber.toString()});
      response='Your pin has been changed to ' + theNumber.toString() +'. Is there anything else you need' + currentName +'?';
    }else{
      response="Oops, sorry I didn't get that! Please say something like 'Change pin to 1234'. ";
    }
  }
  conv.ask(response);
  return null;
});



app.intent('Make Payment', (conv, {number})=> {
  var response='';
  if (cardChecked===false){
    response='Please say the last four digits of your card first. ';
  } else if (pinConfirmed===false){
    response='You cannot make a payment without saying your cards PIN! Please say the PIN number of your card.';
  }else if (currentCardLocked) {
    response='You card ending in ' +currentCardNum.toString() + ' is locked. Please unlock your card first, to make a payment. ';
  }else if (number !== ''){
    const currRef = dbRef.doc(currentCardNum.toString());
    var minPay= Math.min(25,currentBalance);
    response='Your total balance is $' + String(currentBalance) + '. Your minimum payment is $' +String(minPay) + '. ';
    const amountPaid = number.toString();
    var newBal=Number(currentBalance) - Number(number);
    newBal=newBal.toFixed(2);
    var updateSingle = currRef.update({balance: newBal.toString()});
    currentBalance=newBal;
    response=response+ 'Your payment of $' + amountPaid.toString() + ' has been issued. Your new current balance is $' + newBal.toString()+'. ';
    response=response+' Thank you for your payment. What else would you like to do?';
  }else{
    response="Sorry! I didn't catch that. Please say something like, 'I want to make a payment of $25'.";
  }
  conv.ask(response);
  return null;
});


app.intent('Help', (conv, {Help_input})=> {
  var response='';
  if(welcomed===false){
    response=greeting;
  }
  if (Help_input !== '') {
    response= response +"I'm Ouni, I'm a virtual financial assistant." +
    " I'm always here to answer your questions, help you stay on top of your finances and make everyday baking easier.. ";
  }
  response=response + 'I can help with things like making a payment, checking your balance, locking or unlocking your card, or checking your past transactions. ';
  response=response+ "You can say something like 'pay my bill' to make a payment or 'How much I spent on gas?' to check your recent gas purchases. ";
  response=response+ 'What would you like to do'+ currentName + '?';
  conv.ask(response);
});

app.intent('Default Welcome Intent', (conv) => {
  //var debugmsg='this is for debugging, time is '+ time.toString()+' . ';
  if (currenttime < 5){
    greeting=' Hello! ';
  } else if(currenttime < 12){
    greeting=' Good morning! ';
  }else if(currenttime <18){
    greeting=' Good afternoon! ';
  }else if(currenttime <23){
    greeting=' Good evening! ';
  }else{
    greeting=' Hi! ';
  }
  welcomed=true;
  conv.ask(greeting+'Please say the last four digits of your card number. ');
});


app.intent('Good bye', (conv) =>{
  if (currenttime < 5){
    greeting_bye=' Bye for now.. ';
  } else if(currenttime < 10){
    greeting_bye=' Have a good day! ';
  }else if(currenttime <19){
    greeting_bye=' Enjoy the rest of your day! ';
  }else if(currenttime <23){
    greeting_bye=' Have a good night! ';
  }else{
    greeting_bye=' Until next time.. ';
  }

  currentCardNum = '';
  currentCardPin = '';
  currentCardLocked = false;
  currentBalance='';
  currentName='';
  cardChecked=false;
  pinConfirmed=false;
  welcomed=false;
  conv.close(greeting_bye);
});
//console.log(currenttime);


// Set the DialogflowApp object to handle the HTTPS POST request.
exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);
