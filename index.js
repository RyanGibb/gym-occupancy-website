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

//https://stackoverflow.com/questions/11874096/parse-large-json-file-in-nodejs
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
      buffer += data.toString(); // when data is read, stash it in a string buffer
      pump(); // then process the buffer
  });

  function pump() {
      let pos;
      while ((pos = buffer.indexOf('\n')) >= 0) { // keep going while there's a newline somewhere in the buffer
          if (pos == 0) { // if there's more than one newline in a row, the buffer will now start with a newline
              buffer = buffer.slice(1); // discard it
              continue; // so that the next iteration will start with data
          }
          if (processLine(buffer.slice(0,pos))) { // hand off the line
            return; // if processLine returns true stop processing buffer
          }
          buffer = buffer.slice(pos+1); // and slice the processed data off the buffer
      }
  }
  
  function processLine(line) { // here's where we do something with a line
      //if (line[line.length-1] == '\r') line=line.substr(0,line.length-1); // discard CR (0x0D)
      if (line.length > 0) { // ignore empty lines
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

  reader.on('end', function() {
    // no more data
  });

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

const maxNumberOfTries = 3;
const waitTime = 1000 * 3; // 5 seconds (in ms)

function scrape(tries) {
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
      console.log(new Date().toJSON() + ' Error in request promise for "' + G_source_url + 
          '": ' + error);
      if (tries === undefined) {
        tries = 1;
      }
      console.log('Try number ' + tries);
      if (tries == maxNumberOfTries) {
        console.log('Max tries reached');
      }
      else {
        setTimeout(function() {
          scrape(tries+1)
        }, waitTime);
      }
    });
}

var cron = require('node-cron');
 
var task = cron.schedule('* * * * *', () =>  { //Run every minute
  scrape();
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
    
    var responceMessage;

    try {
      var receivedMessage = JSON.parse(receivedMessageString);
    }
    catch(error) {
      let responce = 'error';
      let human_readable_error = 'Error parsing JSON request'
      responceMessage = {responce, human_readable_error, error};
      respond(ws, req, responceMessage);
    }
    
    if (receivedMessage.request == 'range') {
      if(!receivedMessage.parameters) {
        // Could send error to client, if protocol was extended
        return;
      }
      let from = new Date(receivedMessage.parameters.from);
      let to = new Date(receivedMessage.parameters.to);
      // Could check for null here      
      readFile(from, to, function(error, data) {
        if (error) {
          let responce = 'error';
          let human_readable_error = 'Error reading file';
          responceMessage = {responce, human_readable_error, error};
          respond(ws, req, responceMessage);
        }
        else {
          let responce = 'data';
          responceMessage = {responce, data};
          respond(ws, req, responceMessage);
        }
      });
    }
    else {
        let responce = 'error';
        let human_readable_error = 'Unsupported request "' + receivedMessage.request + '"';
        responceMessage = {responce, human_readable_error};
        respond(ws, req, responceMessage);
    }
    
  })
});

function respond(ws, req, responceMessage) {
  var messageString = JSON.stringify(responceMessage);
  ws.send(messageString);
  console.log('WS <- tx ' + req.connection.remoteAddress + ':' 
        + req.connection.remotePort + ' ' + messageString);
};

console.log('WebSocket server running');
