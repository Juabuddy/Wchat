const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const SECRET_KEY = 'supersecret'; // Change this for production!
const users = {}; // In-memory user store: { username: hashedPassword }

const app = express();

// Use Express's built-in JSON parser middleware
app.use(express.json());

// Serve static files (HTML, CSS, JS) from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Register new user
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Missing username or password');
  if (users[username]) return res.status(400).send('User exists');

  const hashed = bcrypt.hashSync(password, 8);
  users[username] = hashed;
  res.send('Registered!');
});

// Login existing user
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Missing username or password');

  const userPass = users[username];
  if (!userPass || !bcrypt.compareSync(password, userPass))
    return res.status(400).send('Invalid credentials');

  const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
  res.json({ token });
});

// Create HTTP server from Express app
const server = http.createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ server });

// Broadcast helper to send message to all except sender
function broadcast(message, sender) {
  wss.clients.forEach(client => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  // Parse token from query string: ws://host?token=xxx
  const params = new URLSearchParams(req.url.replace('/?', ''));
  const token = params.get('token');

  try {
    // Verify token and get username
    const decoded = jwt.verify(token, SECRET_KEY);
    ws.username = decoded.username;
  } catch (err) {
    // Close connection if invalid token
    ws.close();
    return;
  }

  broadcast(`[Server]: ${ws.username} joined the chat`, ws);

  ws.on('message', (msg) => {
    broadcast(`[${ws.username}]: ${msg}`, ws);
  });

  ws.on('close', () => {
    broadcast(`[Server]: ${ws.username} left the chat`, ws);
  });
});

// Start server on specified PORT or 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
