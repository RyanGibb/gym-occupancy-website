
"use strict";

//----------------------------------------------------------------------------
//                              WebSocket Client
//----------------------------------------------------------------------------

let wsUrl = "wss://" + location.hostname + ":" + location.port + "/gym-occupancy/";
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
  handleMessage(message);
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
  let now = Date();
  let from = new Date(now);
  from.setHours(0, 0, 0, 0);
  let to = new Date(now);
  to.setHours(23, 59, 59, 999);
  requestRange(from, to);
}

function requestYesterday() {
  let now = Date();
  let from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate()-1);
  let to = new Date(now);
  to.setHours(23, 59, 59, 999);
  to.setDate(to.getDate()-1);
  requestRange(from, to);
}

function requestThisWeek() {
  let now = new Date();
  // day of the month minus day of the week, plus one to get to monday
  let monday = now.getDate() - now.getDay() + 1;
  let sunday = monday + 6;
  let from = new Date(now);
  from.setDate(monday);
  from.setHours(0, 0, 0, 0);
  let to = new Date(now)
  to.setDate(sunday);
  to.setHours(23, 59, 59, 999);
  requestRange(from, to);
}

function requestLastWeek() {
  let now = new Date();
  // day of the month minus day of the week, plus one to get to monday, minus 7 to get to last week
  let lastMonday = now.getDate() - now.getDay() + 1 - 7;
  let lastSunday = lastMonday + 6;
  let from = new Date(now);
  from.setDate(lastMonday);
  from.setHours(0, 0, 0, 0);
  let to = new Date(now)
  to.setDate(lastSunday);
  to.setHours(23, 59, 59, 999);
  requestRange(from, to);
}

function requestThisMonth() {
  let now = new Date();
  let from = new Date(now.setDate(1));
  let to = new Date(now.setMonth(now.getMonth() + 1, 0));
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  requestRange(from, to);
}

function requestLastMonth() {
  let now = new Date();
  let from = new Date(now.setMonth(now.getMonth() - 1, 1));
  let to = new Date(now.setMonth(now.getMonth(), 0));
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  requestRange(from, to);
}

function requestAll() {
  requestRange();
}

function requestInputBoxRange() {
  let from = document.getElementById("from").value;
  let to = document.getElementById("to").value;
  requestRange(from, to);
}

//----------------------------------------------------------------------------
//                              Responce Functions
//----------------------------------------------------------------------------

function handleMessage(message) {
  if (message.responce == 'data') {
    graphData(JSON.parse(message.data), message.parameters);
  }
}

var occupancyChart;

function graphData(data, parameters) {
  let options = {
    type: 'line',
    data: {
        labels: data.map(function(element) {
          return new Date(element.datetime);
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
      elements: {
        point: {
            radius: 0 
          }
        },
      scales: {
          yAxes: [{
              ticks: {
                  beginAtZero:true,
                  max: 100
              }
          }], 
          xAxes: [{
            type: 'time',
            distribution: 'linear',
            time: {
              //displayFormats: {
              //  minute: 'h:mm a'
              //},
              min: new Date(parameters.from),
              max: new Date(parameters.to)
            },
          }]
        }
    }
  }
  if (occupancyChart) {
    occupancyChart.destroy();
  }
  let ctx = document.getElementById("occupancyChart").getContext('2d');
  occupancyChart = new Chart(ctx, options);
}
