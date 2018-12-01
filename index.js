
const url = require('url');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

//----------------------------------------------------------------------------
//                              HTTP Server
//----------------------------------------------------------------------------



// https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types
const G_file_types = {
  'css': 'text/css',
  'gif': 'image/gif',
  'html': 'text/html',
  'ico': 'image/x-icon',
  'jpg': 'image/jpeg',
  'csv' : 'text/csv'
};

// default file
let G_root_file = 'output.csv';

// reply callback functions, called for any client HTTP request
function reply(request, response) {
  let filename = url.parse(request.url)['pathname'];

  if (filename == '/') { // logical root
    filename = G_root_file;
  }
  // If leading with '/'
  else if (filename[0] == '/') {
    // remove the leading '/'
    filename = filename.substring(1);
  }

  console.log('HTTP <- tx '
    + request.socket.remoteAddress
    + ':'
    + request.socket.remotePort
    + ' ' + filename);

  // read file
  fs.readFile(filename, (error, file) => {
    let code;
    let type;
    let content;
    if (error) {
      code = 404;
      type = 'text/plain';
      content = 'Unknown file: ' + filename;
      console.log('HTTP <- tx ' +
        request.socket.remoteAddress
        + ':'
        + request.socket.remotePort
        + ' unknown file: ' + filename);
    }
    else {
      code = 200;
      type = G_file_types[path.extname(filename)];
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
const G_output_file = 'output.csv';

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

setInterval(scrape, 60 * 60 * 1000); // scrape every hour
