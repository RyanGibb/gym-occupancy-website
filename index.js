
const url = require('url');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

//----------------------------------------------------------------------------
//                              HTTP Server
//----------------------------------------------------------------------------

let G_output_file = 'output.csv';

// reply callback functions, called for any client HTTP request
function reply(request, response) {
  //let filename = url.parse(request.url)['pathname'];

  console.log('HTTP <- tx '
    + request.socket.remoteAddress
    + ':'
    + request.socket.remotePort);

  // read file
  fs.readFile(G_output_file, (error, file) => {
    let code;
    let type;
    let content;
    if (error) {
      code = 404;
      type = 'text/plain';
      contetn = error;
      console.log('HTTP <- tx ' +
        request.socket.remoteAddress
        + ':'
        + request.socket.remotePort
        + ' unknown file: ' + filename);
    }
    else {
      code = 200;
      type = 'text/plain';
      content = file;
    }
    response.writeHead(code, type);
    response.write(content);
    response.end();
  });
}

let myPort = process.getuid(); /** type 'id' on Linux for uid value **/
if (myPort < 1024) myPort += 10000; // do not use privileged ports

hostname = os.hostname();

let httpServer = http.createServer(reply);

httpServer.listen(myPort);
console.log('listening for HTTP requests: ' + hostname + ':' + myPort);

httpServer.on('clientError', (error, socket) => {
  console.log(error);
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

//----------------------------------------------------------------------------
//                              Web Scraper
//----------------------------------------------------------------------------

//const express = require('express');
const rp = require('request-promise');
const cheerio = require('cheerio');

const G_source_url = 'https://www.st-andrews.ac.uk/sport/';

let writer = fs.createWriteStream(G_output_file, {flags:'a'}); // Opens appending write stream 

function scrape() {
  rp(G_source_url)
    .then(function (html) {
      let text = cheerio('div.gym-box > h3', html).text();
      let before = 'Occupancy: ';
      let after = '%';
      let occupancy = text.substring(text.indexOf(before) + before.length, text.indexOf(after));
      let timestamp = new Date();
      let line = timestamp + "," + occupancy;
      writer.write(line + "\n", function (error) {
        if (error) {
          console.log('Error writing to "' + G_output_file + '": ' + error);
          return;
        }
        console.log('Wrote "' + line + '" to "' + G_output_file + '"');
      })
    })
    .catch(function (err) {
      //handle error
    });
}

setInterval(scrape, 1000); // scrape every second 
