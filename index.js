const fs = require('fs');
const G_output_file = 'occupancy.csv';

//----------------------------------------------------------------------------
//                              File IO
//----------------------------------------------------------------------------

function writeEntry(timestamp, occupancy){
  try {
    let writer = fs.createWriteStream(G_output_file, {flags:'a'}); // Opens appending write stream
    line = timestamp + ',' + occupancy;
    writer.write(line + '\n', function (error) {
      if (error) {
        console.log('Error writing to "' + G_output_file + '": ' + error);
        return;
      }
      console.log('Wrote "' + line + '" to "' + G_output_file + '"');
    })
  }
  catch (error) {
    console.log('Error writing to "' + G_output_file + '":' + error);
  }
}

//https://stackoverflow.com/questions/11874096/parse-large-json-file-in-nodejs
function readFile(from, to, callback) {
  let entries = [];
  let reader = fs.createReadStream(G_output_file);
  let buffer = '';

  reader.on('error', function(error){ 
    console.log('Error reading from "' + G_output_file + '": ' + error);
    callback('{"responce":"error"}');
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
    callback(JSON.stringify(entries));
  });
}

//----------------------------------------------------------------------------
//                              Web Scraper
//----------------------------------------------------------------------------

const rp = require('request-promise');
const cheerio = require('cheerio');

const G_source_url = 'https://www.st-andrews.ac.uk/sport/';

function scrape() {
  rp(G_source_url)
    .then(function (html) {
      let timestamp = new Date().toJSON();
      let text = cheerio('div.gym-box > h3', html).text();
      let before = 'Occupancy: ';
      let after = '%';
      let occupancy = text.substring(text.indexOf(before) + before.length, text.indexOf(after));
      writeEntry(timestamp, occupancy);
    })
    .catch(function (error) {
      console.log('Error in request promise for "' + G_source_url + '": ' + error);
    });
}

setInterval(scrape, 1000); // scrape every second 

//----------------------------------------------------------------------------
//                              HTTP Server
//----------------------------------------------------------------------------

const express = require('express');

const port = 3000
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

app.listen(port);
console.log('Listening for HTTP requests on port: ' + port);

//----------------------------------------------------------------------------
//                              WebSocket Server
//----------------------------------------------------------------------------

const http = require('http');
const ws = require('ws');

const httpServer = http.createServer(app);
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
    let receivedMessage;
    try {
      receivedMessage = JSON.parse(receivedMessageString);
    }
    catch(error) {
      console.log('Error parsing JSON message: ' + error);
      return;
    }
    
    // Dir Info
    if (receivedMessage['request'] == 'dirinfo') {
      let dirpath = receivedMessage['dirpath'];
      if(!dirpath) {
        // Could send error to client, if protocol was extended
        return;
      }
      
      //....
    }
    
    //else {
        // Could send error to client, if protocol was extended
    //}

  })
});

console.log('WebSocket server running');
