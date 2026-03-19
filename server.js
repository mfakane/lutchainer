const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  const file = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      const ext = path.extname(file);
      const mimes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.map': 'application/json'
      };
      res.writeHead(200, { 'Content-Type': mimes[ext] || 'text/plain' });
      res.end(data);
    }
  });
});

server.listen(8000, 'localhost');
console.log('Server running on http://localhost:8000');
