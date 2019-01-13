
"use strict";

//----------------------------------------------------------------------------
//                              WebSocket Client
//----------------------------------------------------------------------------

let wsUrl = "ws://" + location.hostname + ":" + location.port;
let ws = new WebSocket(wsUrl);

ws.onopen = function() {
  requestLast24Hrs();
}

ws.onclose = function() {
  alert("WebSocket closed. Please reload the page.");
}

ws.onerrer = function(e) {
  alert("WebSocket Error: " + e + ". Please reload the page.");
}

ws.onmessage = function(m) {
  let messageString = m.data;
  //console.log("<- rx " + messageString);
  let message = JSON.parse(messageString);
  handleMessage(message);
}

function sendMessage(messageString) {
  //console.log("-> tx " + messageString);
  ws.send(messageString);
}

//----------------------------------------------------------------------------
//                              Request Functions
//----------------------------------------------------------------------------

function requestRange(from, to, graphUnit, displayFormat) {
    let request = "range";
    if (graphUnit == "") {
      graphUnit = undefined;
    }
    if (displayFormat == "" || displayFormat == "default") {
      displayFormat = undefined;
    }
    let parameters = {from, to, graphUnit, displayFormat};
    let message = {request, parameters};
    let messageString = JSON.stringify(message);
    sendMessage(messageString);
    if(typeof from != "string") {
      from = from.toJSON();
    }
    if(typeof to != "string") {
      to = to.toJSON();
    }
    from = from.split("T");
    to = to.split("T");
    document.getElementById("from_date").value = from[0];
    document.getElementById("from_time").value = from[1].slice(0, -1);
    document.getElementById("to_date").value = to[0];
    document.getElementById("to_time").value = to[1].slice(0, -1);
    if (graphUnit == undefined) {
      graphUnit = "";
      displayFormat = "default";
    }
    else if (displayFormat == undefined) {
      displayFormat = "default";
    }
    document.getElementById("graph_unit").value = graphUnit;
    document.getElementById("display_format").value = displayFormat;
}

const ONE_HOUR = 60 * 60 * 1000; // ms
function requestLastNumberOfHours(numberOfHours) {
  let now = Date.now(); //ms since 1970
  let numberOfHoursAgo = now - (ONE_HOUR * numberOfHours);
  let to = new Date(now).toJSON();
  let from = new Date(numberOfHoursAgo).toJSON();
  requestRange(from, to);
}

function requestLast24Hrs() {
  requestLastNumberOfHours(24);
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
  requestRange(from, to, "hour");
}

function requestYesterday() {
  let now = Date();
  let from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate()-1);
  let to = new Date(now);
  to.setHours(23, 59, 59, 999);
  to.setDate(to.getDate()-1);
  requestRange(from, to, "hour");
}

function requestThisWeek() {
  let now = new Date();
  // day of the month minus day of the week
  let sunday = now.getDate() - now.getDay();
  let saturday = sunday + 6;
  let from = new Date(now);
  from.setDate(sunday);
  from.setHours(0, 0, 0, 0);
  let to = new Date(now)
  to.setDate(saturday);
  to.setHours(23, 59, 59, 999);
  requestRange(from, to, "day", "ddd/MMM D");
}

function requestLastWeek() {
  let now = new Date();
  // day of the month minus day of the week, minus 7 to get to last week
  let lastSunday = now.getDate() - now.getDay() - 7;
  let lastSatuday = lastSunday + 6;
  let from = new Date(now);
  from.setDate(lastSunday);
  from.setHours(0, 0, 0, 0);
  let to = new Date(now)
  to.setDate(lastSatuday);
  to.setHours(23, 59, 59, 999);
  requestRange(from, to, "day", "ddd/MMM D");
}

function requestThisMonth() {
  let now = new Date();
  let from = new Date(now);
  from.setDate(1);
  from.setHours(0, 0, 0, 0);
  let to = new Date(now);
  to.setMonth(now.getMonth() + 1, 0);
  to.setHours(23, 59, 59, 999);
  requestRange(from, to, "day");
}

function requestLastMonth() {
  let now = new Date();
  let from = new Date();
  from.setMonth(from.getMonth() - 1, 1);
  from.setHours(0, 0, 0, 0);
  let to = new Date();
  to.setMonth(now.getMonth(), 0);
  to.setHours(23, 59, 59, 999);
  requestRange(from, to, "day");
}

function requestAll() {
  requestRange();
}

function requestInputBoxRange() {
  let from = document.getElementById("from_date").value + "T" +
    document.getElementById("from_time").value + "Z";
  let to = document.getElementById("to_date").value + "T" +
    document.getElementById("to_time").value + "Z";
  let graphUnit = document.getElementById("graph_unit").value;
  let displayFormat = document.getElementById("display_format").value;
  requestRange(from, to, graphUnit, displayFormat);
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
  let graphOptions = {
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
            ticks: {
              source: 'auto'
            },
            time: {
              unit: parameters.graphUnit,
              min: new Date(parameters.from),
              max: new Date(parameters.to),
              displayFormats: {}
            },
          }]
        }
    }
  }
  if (parameters.displayFormat) {
    graphOptions.options.scales.xAxes[0].time.displayFormats[parameters.graphUnit] = parameters.displayFormat;
  }
  if (occupancyChart) {
    occupancyChart.destroy();
  }
  let ctx = document.getElementById("occupancyChart").getContext('2d');
  occupancyChart = new Chart(ctx, graphOptions);
}

//----------------------------------------------------------------------------
//                              HTML Functions
//----------------------------------------------------------------------------

function toggleGraphOptionVisibility() {
  let graphOptionsElement = document.getElementById("graph_options");
  let graphOptionsVisibilityElement = document.getElementById("graph_options_visibility");
  if (graphOptionsElement.style.display === "none") {
    graphOptionsElement.style.display = "block";
    graphOptionsVisibilityElement.innerHTML = "Hide Graph Options";
  } else {
    graphOptionsElement.style.display = "none";
    graphOptionsVisibilityElement.innerHTML = "Show Graph Options";
  }
}
