const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

const SECRET_KEY = 'supersecret'; // Change for production!
const USERS_FILE = path.join(__dirname, 'users.json');

// Helper: Load users from file
function loadUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return {}; // If no file, start empty
  }
}

// Helper: Save users to file
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

let users = loadUsers();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Register
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Missing username or password');
  if (users[username]) return res.status(400).send('User exists');

  const hashed = bcrypt.hashSync(password, 8);
  users[username] = hashed;
  saveUsers(users);

  res.send('Registered!');
});

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Missing username or password');

  const userPass = users[username];
  if (!userPass || !bcrypt.compareSync(password, userPass))
    return res.status(400).send('Invalid credentials');

  const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
  res.json({ token });
});

// WebSocket setup
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function broadcast(message, sender) {
  wss.clients.forEach(client => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', (ws, req) => {
  const params = new URLSearchParams(req.url.replace('/?', ''));
  const token = params.get('token');

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    ws.username = decoded.username;
  } catch (err) {
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
