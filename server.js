const http = require('http');
const fs = require('fs');
const path = require('path');

const clients = [];

const server = http.createServer((req, res) => {
  // Statische Dateien bereitstellen
  let filePath = './public' + (req.url === '/' ? '/index.html' : req.url);
  const extname = String(path.extname(filePath)).toLowerCase();

  const contentType = {
    '.html': 'text/html',
    '.js': 'application/javascript',
  }[extname] || 'text/plain';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(500);
      res.end('Serverfehler');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.on('upgrade', (req, socket) => {
  // Einfache WebSocket-Handshake
  if (req.headers['upgrade'] !== 'websocket') {
    socket.end('HTTP/1.1 400 Bad Request');
    return;
  }

  const key = req.headers['sec-websocket-key'];
  const acceptKey = generateAcceptValue(key);

  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
  ];

  socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');
  clients.push(socket);

  socket.on('data', (buffer) => {
    const message = decodeWebSocketMessage(buffer);
    if (message) {
      const encoded = encodeWebSocketMessage(message);
      for (const client of clients) {
        if (client !== socket) client.write(encoded);
      }
    }
  });

  socket.on('end', () => {
    const index = clients.indexOf(socket);
    if (index !== -1) clients.splice(index, 1);
  });
});

const os = require('os');

server.listen(3000, '0.0.0.0', () => {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (let iface of Object.values(interfaces)) {
    for (let info of iface) {
      if (info.family === 'IPv4' && !info.internal) {
        addresses.push(info.address);
      }
    }
  }

  console.log('Server läuft auf den folgenden Adressen:');
  for (let addr of addresses) {
    console.log(`→ http://${addr}:3000`);
  }
});




// --- Hilfsfunktionen für WebSocket ---

function generateAcceptValue(key) {
  return require('crypto')
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
}

function decodeWebSocketMessage(buffer) {
  const secondByte = buffer[1];
  const length = secondByte & 127;
  const mask = buffer.slice(2, 6);
  const data = buffer.slice(6, 6 + length);
  const unmasked = data.map((byte, i) => byte ^ mask[i % 4]);
  return Buffer.from(unmasked).toString('utf8');
}

function encodeWebSocketMessage(str) {
  const msgBuffer = Buffer.from(str);
  const len = msgBuffer.length;
  const buffer = Buffer.alloc(len + 2);
  buffer[0] = 129;
  buffer[1] = len;
  msgBuffer.copy(buffer, 2);
  return buffer;
}
