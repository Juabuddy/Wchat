//Defines Veriables/Elements (Mainly to establish web server)
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');

//User Data Storage + Encryption
const SECRET_KEY = 'Hasan123';
const USERS_FILE = path.join(__dirname, 'users.json');
const DB_FILE = path.join(__dirname, 'users.db');

// Initialize SQLite database
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) throw err;
  db.run(
    'CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT NOT NULL)',
    (err) => { if (err) throw err; }
  );
});

//Loads User Data from users.json
function loadUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}
//Saves User Data in users.jason
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

let users = loadUsers();
//Allows us to establish webserver
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set up storage for uploads
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, base + '-' + Date.now() + ext);
  }
});
const upload = multer({ storage });

// Serve uploads statically
app.use('/uploads', express.static(uploadDir));

// Register endpoint
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Missing username or password');
  db.get('SELECT username FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return res.status(500).send('Database error');
    if (row) return res.status(400).send('User exists');
    const hashed = bcrypt.hashSync(password, 8);
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashed], (err) => {
      if (err) return res.status(500).send('Database error');
      res.send('Registered!');
    });
  });
});

// Login endpoint
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Missing username or password');
  db.get('SELECT password FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return res.status(500).send('Database error');
    if (!row || !bcrypt.compareSync(password, row.password))
      return res.status(400).send('Invalid credentials');
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
  });
});

// Image upload endpoint
app.post('/upload/image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});
// Audio upload endpoint
app.post('/upload/audio', upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

// Add profile picture upload endpoint
app.post('/upload/profile-pic', upload.single('profilePic'), (req, res) => {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
  if (!token) return res.status(401).send('No token');
  let username;
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    username = decoded.username;
  } catch {
    return res.status(401).send('Invalid token');
  }
  if (!req.file) return res.status(400).send('No file uploaded');
  const url = `/uploads/${req.file.filename}`;
  // Save profilePic URL to users.json
  users[username] = users[username] || {};
  users[username].profilePic = url;
  saveUsers(users);
  res.json({ url });
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
  // Send profilePic for each user
  const userList = Array.from(onlineUsers).map(u => ({
    username: u,
    profilePic: (users[u] && users[u].profilePic) ? users[u].profilePic : null
  }));
  const payload = JSON.stringify({
    type: 'onlineUsers',
    users: userList
  });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}
//Security behind registration. Prevents unauthorized user access
wss.on('connection', (ws, req) => {
  const params = new URLSearchParams(req.url.replace('/?', ''));
  const token = params.get('token');

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    ws.username = decoded.username;
    // Attach profilePic to ws
    ws.profilePic = (users[ws.username] && users[ws.username].profilePic) ? users[ws.username].profilePic : null;
    onlineUsers.add(ws.username);
    broadcastOnlineUsers(); // <--- Add this line to broadcast on join
  } catch (err) {
    console.log('Invalid or missing token, closing WS connection');
    ws.close();
    return;
  }

  // Notifies others about new user
  broadcast(JSON.stringify({ type: 'message', text: `[Server]: ${ws.username} joined the chat`, username: 'Server' }), ws);

  // In the WebSocket 'message' handler, support file messages (handled on frontend by sending a JSON string with type and url/text)
  ws.on('message', (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      // fallback to text message
      data = { type: 'text', text: msg };
    }
    if (data.type === 'typing' || data.type === 'stopTyping') {
      // Broadcast typing events to all except sender
      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: data.type, username: ws.username }));
        }
      });
    } else if (data.type === 'image' || data.type === 'audio') {
      broadcast(JSON.stringify({ type: data.type, url: data.url, username: ws.username }), ws);
    } else if (data.type === 'text') {
      broadcast(JSON.stringify({ type: 'message', text: `[${ws.username}]: ${data.text || msg}`, username: ws.username }), ws);
    }
    // Do not broadcast anything else
  });

  ws.on('close', () => {
    onlineUsers.delete(ws.username);
    broadcast(JSON.stringify({ type: 'message', text: `[Server]: ${ws.username} left the chat`, username: 'Server' }), ws);
    broadcastOnlineUsers(); // <--- Add this line to broadcast on leave
  });
});
//Establishes Port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
