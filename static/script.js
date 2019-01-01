
"use strict";

//----------------------------------------------------------------------------
//                              WebSocket Client
//----------------------------------------------------------------------------

let wsUrl = "ws://" + location.hostname + ":" + location.port;
let ws = new WebSocket(wsUrl);

ws.onopen = function() {
  //requestLast48Hrs();
}

ws.onclose = function() {
  alert("WebSocket closed. Please reload the page.");
}

ws.onerrer = function(e) {
  alert("WebSocket Error: " + e + ". Please reload the page.");
}

ws.onmessage = function(m) {
  let messageString = m.data;
  console.log("<- rx " + messageString);
  let message = JSON.parse(messageString);
  parseResponceToGraph(message);

}

//----------------------------------------------------------------------------
//                              Request Functions
//----------------------------------------------------------------------------

function requestRange(from, to) {
    let request_type = "range";
    let parameters = {from, to};
    let request = {request_type, parameters};
    let string = JSON.stringify(request);
    ws.send(string);
}

function requestLast48Hrs() {

}

function requestToday() {

}

function requestYesterday() {

}

function requestThisWeek() {

}

function requestLastWeek() {

}


function setup() {

}
