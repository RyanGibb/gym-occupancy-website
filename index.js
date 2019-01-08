//----------------------------------------------------------------------------
//                              File IO
//----------------------------------------------------------------------------

const fs = require('fs');
const G_output_file = 'occupancy.csv';

function writeEntry(datetime, occupancy){
  try {
    let file = G_output_file;
    // Opens appending write stream
    let writer = fs.createWriteStream(file, {flags:'a'});
    let line = datetime + ',' + occupancy;
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

function readFileRange(from, to, callback) {
  let entries = [];
  function procesEntry(datetime, occupancy, reader) {
    if (datetime >= from) {
      entries.push({datetime, occupancy});
    }
    if (to !== null && datetime >= to) {
      reader.destroy();
      return true;
    }
  }
  readFile(procesEntry, function(error) {
    callback(error, JSON.stringify(entries));
  });
}

function readFile(procesEntry, callback) {
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
        let datetime = new Date(lineSplit[0]);
        let occupancy = lineSplit[1];
        if (procesEntry(datetime, occupancy, reader)) {
          return true;
        }
      }
      catch (error) {
        console.log('Error parsing JSON from "' + G_output_file + '": ' + error);
      }
    }
  }

  reader.on('close', function () {
    callback(null);
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
      let datetime = new Date().toJSON();
      let text = cheerio('div.gym-box > h3', html).text();
      let before = 'Occupancy: ';
      let after = '%';
      let occupancy = text.substring(text.indexOf(before) + before.length, text.indexOf(after));
      writeEntry(datetime, occupancy);
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

let port = process.getuid(); // type "id" on Linux for uid value
if (port < 1024) port += 10000; // do not use privileged ports

const app = express();
const static_dir = 'static';

app.use(express.static(static_dir));

app.get('/data.json', function (req, res) {
  let from = null;
  if (req.query.from) {
    from = new Date(req.query.from);
  }
  let to = null;
  if (req.query.to) {
    to = new Date(req.query.to);
  }
  readFileRange(from, to, function(error, json) {
    if (error) {
      res.set('Content-Type', 'text/plain');
      res.send("Error reading file - " + error);
      return;
    }
    res.set('Content-Type', 'application/json');
    res.send(json);
  })
});

const httpServer = http.createServer(app);
const localhost = '127.0.0.1';

httpServer.listen(port, localhost, function () {
  console.log('Listening for HTTP requests on localhost, port ' + port);
});

//----------------------------------------------------------------------------
//                              WebSocket Server
//----------------------------------------------------------------------------

const ws = require('ws');

const wsServer = new ws.Server({server: httpServer});

wsServer.on('connection', function(ws, req) {
  //console.log('WS connection ' + req.connection.remoteAddress + ':' 
    //  + req.connection.remotePort);
  
  ws.on('close', function(code, message) {
    //console.log('WS disconnection ' + ws._socket.remoteAddress + ':' 
      //  + req.connection.remotePort + ' Code ' + code);
  });

  ws.on('message', function(data) {
    let receivedMessageString = data.toString();
    //console.log('WS -> rx ' + req.connection.remoteAddress + ':' 
      //  + req.connection.remotePort + ' ' + receivedMessageString);

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
      readFileRange(from, to, function(error, data) {
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
  //console.log('WS <- tx ' + req.connection.remoteAddress + ':' 
    //    + req.connection.remotePort + ' ' + messageString);
};

console.log('WebSocket server running');
