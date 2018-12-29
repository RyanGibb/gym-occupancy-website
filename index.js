const fs = require('fs');
const G_output_file = 'occupancy.json';

//----------------------------------------------------------------------------
//                              File IO
//----------------------------------------------------------------------------

function writeLine(line){
  try {
    let writer = fs.createWriteStream(G_output_file, {flags:'a'}); // Opens appending write stream
    writer.write(line + "\n", function (error) {
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
          processLine(buffer.slice(0,pos)); // hand off the line
          buffer = buffer.slice(pos+1); // and slice the processed data off the buffer
      }
  }
  
  function processLine(line) { // here's where we do something with a line
      if (line[line.length-1] == '\r') line=line.substr(0,line.length-1); // discard CR (0x0D)
      if (line.length > 0) { // ignore empty lines
          try {
            var obj = JSON.parse(line); // parse the JSON
            entries.push(obj);
          }
          catch (error) {
            console.log('Error parsing JSON from "' + G_output_file + '": ' + error);
          }
      }
  }

  reader.on('end', function() {
    callback(JSON.stringify(entries));
  });
}

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
  let from = req.query.from;
  let to = req.query.to;
  readFile(from, to, function(entries) {
    res.set('Content-Type', 'application/json');
    res.send(entries);
  })
});

app.listen(port);
console.log("Listening for HTTP requests on port: " + port);

//----------------------------------------------------------------------------
//                              Web Scraper
//----------------------------------------------------------------------------

const rp = require('request-promise');
const cheerio = require('cheerio');

const G_source_url = 'https://www.st-andrews.ac.uk/sport/';

function scrape() {
  rp(G_source_url)
    .then(function (html) {
      let text = cheerio('div.gym-box > h3', html).text();
      let before = 'Occupancy: ';
      let after = '%';
      let occupancy = text.substring(text.indexOf(before) + before.length, text.indexOf(after));
      let timestamp = new Date();
      let lineObject = { timestamp, occupancy };
      let line = JSON.stringify(lineObject);
      writeLine(line);
    })
    .catch(function (error) {
      console.log('Error in request promise for "' + G_source_url + '": ' + error);
    });
}

setInterval(scrape, 1000); // scrape every second 
