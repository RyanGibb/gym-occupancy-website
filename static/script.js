
"use strict";

//----------------------------------------------------------------------------
//                              WebSocket Client
//----------------------------------------------------------------------------

let wsUrl = "ws://" + location.hostname + ":" + location.port;
let ws = new WebSocket(wsUrl);

ws.onopen = function() {
  requestLast48Hrs();
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
  handleResponce(message);
}

function sendMessage(messageString) {
  console.log("-> tx " + messageString);
  ws.send(messageString);
}

//----------------------------------------------------------------------------
//                              Request Functions
//----------------------------------------------------------------------------

function requestRange(from, to) {
    let request = "range";
    let parameters = {from, to};
    let message = {request, parameters};
    let messageString = JSON.stringify(message);
    sendMessage(messageString);
}

const ONE_HOUR = 60 * 60 * 1000; // ms
function requestLastNumberOfHours(numberOfHours) {
  let now = Date.now(); //ms since 1970
  let numberOfHoursAgo = now - (ONE_HOUR * numberOfHours);
  let to = new Date(now).toJSON();
  let from = new Date(numberOfHoursAgo).toJSON();
  requestRange(from, to);
}

function requestLast48Hrs() {
  requestLastNumberOfHours(48);
}

function requestToday() {

}

function requestYesterday() {

}

function requestThisWeek() {

}

function requestLastWeek() {

}

//----------------------------------------------------------------------------
//                              Responce Functions
//----------------------------------------------------------------------------

function handleResponce(message) {
  if (message.responce == 'data') {
    graphData(JSON.parse(message.data));
  }
}

function graphData(data) {
  var ctx = document.getElementById("myChart").getContext('2d');
  var myChart = new Chart(ctx, {
      type: 'line',
      data: {
          labels: data.map(function(element) {
            return new Date(element.timestamp).toLocaleString();
          }),
          datasets: [{
              label: 'Occupancy (%)',
              data: data.map(function(element) {
                return element.occupancy;
              }),
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              borderColor: 'rgba(4, 162, 235, 1)',
              borderWidth: 1
          }]
      },
      options: {
          scales: {
              yAxes: [{
                  ticks: {
                      beginAtZero:true,
                      max: 100
                  }
              }],
              xAxes: [{
                type: 'time',
                time: {
                  displayFormats: {
                    minute: 'h:mm a'
                  }
                }
            }]
          }
      }
  });
}
