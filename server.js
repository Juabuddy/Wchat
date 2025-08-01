const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

const SECRET_KEY = 'supersecret'; // Change for production!
const USERS_FILE = path.join(__dirname, 'users.json');

function loadUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

let users = loadUsers();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Register endpoint
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Missing username or password');
  if (users[username]) return res.status(400).send('User exists');

  const hashed = bcrypt.hashSync(password, 8);
  users[username] = hashed;
  saveUsers(users);

  res.send('Registered!');
});

// Login endpoint
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Missing username or password');

  const userPass = users[username];
  if (!userPass || !bcrypt.compareSync(password, userPass))
    return res.status(400).send('Invalid credentials');

  const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
  res.json({ token });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const onlineUsers = new Set();

// Broadcast to all clients except sender
function broadcast(message, sender) {
  wss.clients.forEach(client => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Send updated online users to everyone
function broadcastOnlineUsers() {
  const payload = JSON.stringify({
    type: 'onlineUsers',
    users: Array.from(onlineUsers),
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on('connection', (ws, req) => {
  const params = new URLSearchParams(req.url.replace('/?', ''));
  const token = params.get('token');

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    ws.username = decoded.username;
    onlineUsers.add(ws.username);
    broadcastOnlineUsers();
  } catch (err) {
    console.log('Invalid or missing token, closing WS connection');
    ws.close();
    return;
  }

  // Notify others about new user
  broadcast(JSON.stringify({ type: 'message', text: `[Server]: ${ws.username} joined the chat` }), ws);

  ws.on('message', (msg) => {
    broadcast(JSON.stringify({ type: 'message', text: `[${ws.username}]: ${msg}` }), ws);
  });

  ws.on('close', () => {
    onlineUsers.delete(ws.username);
    broadcastOnlineUsers();
    broadcast(JSON.stringify({ type: 'message', text: `[Server]: ${ws.username} left the chat` }), ws);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
