//----------------------------------------------------------------------------
//                              File IO
//----------------------------------------------------------------------------

const fs = require('fs');
const G_output_file = 'occupancy.csv';

function writeEntry(dateTime, occupancy){
  try {
    let file = G_output_file;
    // Opens appending write stream
    let writer = fs.createWriteStream(file, {flags:'a'});
    let line = dateTime + ',' + occupancy;
    writer.write(line + '\n', function (error) {
      if (error) {
        console.log('Error writing to "' + file + '": ' + error);
        return;
      }
      console.log('Wrote "' + line + '" to "' + file + '"');
    })
  }
  catch (error) {
    console.log('Error writing to "' + file + '":' + error);
  }
}

function readFile(from, to, callback) {
  let entries = [];
  let file = G_output_file;

  let reader = fs.createReadStream(file);
  let buffer = '';

  reader.on('error', function(error){ 
    console.log('Error reading from "' + file + '": ' + error);
    callback(error);
   });

  reader.on('data', function(data) {
      buffer += data.toString();
      pump();
  });

  function pump() {
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          // proccess line
          if (processLine(buffer.slice(0, newlineIndex))) {
            return; // if processLine returns true stop processing buffer
          }
          buffer = buffer.slice(newlineIndex+1); // slice the processed data off the buffer
      }
  }
  
  function processLine(line) {
    if (line.length > 0) {
      try {
        lineSplit = line.split(",");
        let timestamp = new Date(lineSplit[0]);
        let occupancy = lineSplit[1];
        if (timestamp >= from) {
          entries.push({timestamp, occupancy});
        }
        if (to !== null && timestamp >= to) {
          reader.destroy();
          return true;
        }
      }
      catch (error) {
        console.log('Error parsing JSON from "' + G_output_file + '": ' + error);
      }
    }
  }

  reader.on('close', function () {
    callback(null, JSON.stringify(entries));
  });
}

//----------------------------------------------------------------------------
//                              Web Scraper
//----------------------------------------------------------------------------

const rp = require('request-promise');
const cheerio = require('cheerio');

const G_source_url = 'https://www.st-andrews.ac.uk/sport/index.php';

const numberOfTries = 3;
const waitTime = 1000 * 5; // 5 seconds (in ms)

function scrape(tries, waitTime) {
  rp(G_source_url)
    .then(function (html) {
      let dateTime = new Date().toJSON();
      let text = cheerio('div.gym-box > h3', html).text();
      let before = 'Occupancy: ';
      let after = '%';
      let occupancy = text.substring(text.indexOf(before) + before.length, text.indexOf(after));
      writeEntry(dateTime, occupancy);
    })
    .catch(function (error) {
      console.log('Error in request promise for "' + G_source_url + '": ' + error);
      if (tries > 1) {
        let triesLeft = tries - 1;
        console.log('Tries left: ' + triesLeft);
        setTimeout(function() {
          scrape(triesLeft, waitTime);
        }, waitTime);
      }
    });
}

var cron = require('node-cron');
 
var task = cron.schedule('* * * * *', () =>  { //Run every minute
  scrape(numberOfTries, waitTime);
});

//----------------------------------------------------------------------------
//                              HTTP Server
//----------------------------------------------------------------------------

const express = require('express');
const http = require('http');

const port = 5000
const app = express();
const static_dir = 'static';

app.use(express.static(static_dir));

app.get('/data.json', function (req, res) {
  res.set('Content-Type', 'application/json');
  if (!req.query.from) {
    var from = null;
  }
  else{
    var from = new Date(req.query.from);
  }
  if (!req.query.to) {
    var to = null;
  }
  else{ 
    var to = new Date(req.query.to);
  }
  readFile(from, to, function(json) {
    res.set('Content-Type', 'application/json');
    res.send(json);
  })
});

const httpServer = http.createServer(app);

httpServer.listen(port, function () {
  console.log('Listening for HTTP requests on port: ' + port);
});

//----------------------------------------------------------------------------
//                              WebSocket Server
//----------------------------------------------------------------------------

const ws = require('ws');

const wsServer = new ws.Server({server: httpServer});

wsServer.on('connection', function(ws, req) {
  console.log('WS connection ' + req.connection.remoteAddress + ':' 
      + req.connection.remotePort);
  
  ws.on('close', function(code, message) {
    console.log('WS disconnection ' + ws._socket.remoteAddress + ':' 
        + req.connection.remotePort + ' Code ' + code);
  });

  ws.on('message', function(data) {
    let receivedMessageString = data.toString();
    console.log('WS -> rx ' + req.connection.remoteAddress + ':' 
        + req.connection.remotePort + ' ' + receivedMessageString);

    try {
      var receivedMessage = JSON.parse(receivedMessageString);
    }
    catch(error) {
      respondError(ws, req, 'error parsing JSON request', error);
      return;
    }
    
    if (receivedMessage.request == 'range') {
      let from = null, to = null;
      if(receivedMessage.parameters) {
        if (receivedMessage.parameters.from) {
          from = new Date(receivedMessage.parameters.from);
        }
        if (receivedMessage.parameters.to) {
          to = new Date(receivedMessage.parameters.to);
        }
      }  
      readFile(from, to, function(error, data) {
        if (error) {
          respondError(ws, req, 'error reading file', error);
          return;
        }
        let responce = 'data';
        responceMessage = {responce, data};
        respond(ws, req, responceMessage);
      });
    }
    else {
      respondError(ws, req, 'unsupported request "' + receivedMessage.request + '"');
    }

  })
});

function respondError(ws, req, human_readable_error, error) {
  let responce = 'error';
  responceMessage = {responce, human_readable_error, error};
  respond(ws, req, responceMessage);
}

function respond(ws, req, responceMessage) {
  var messageString = JSON.stringify(responceMessage);
  ws.send(messageString);
  console.log('WS <- tx ' + req.connection.remoteAddress + ':' 
        + req.connection.remotePort + ' ' + messageString);
};

console.log('WebSocket server running');
