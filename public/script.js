//Establishes Web Server
document.addEventListener('DOMContentLoaded', () => {
  let ws;
  let token;
//defines variables/elements
  const chat = document.getElementById('chat');
  const input = document.getElementById('input');
  const loginSection = document.getElementById('login-section');
  const chatSection = document.getElementById('chat-section');
  const loginMessage = document.getElementById('login-message');
  const bgSelector = document.getElementById('bg-selector');

//Adds Message to Chat (backend)
  function addMessage(text, isUser) {
    const msg = document.createElement('div');
    const date = new Date();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    msg.className = 'message ' + (isUser ? 'user' : 'other');
    msg.textContent = `[${hours}:${minutes}:${seconds}] ${text}`;
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
  }
//Sends Messages
  function send() {
    const text = input.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(text);
    addMessage(`Du: ${text}`, true);
    input.value = '';
  }
  window.send = send;
//Shows the Login Messages
  function showMessage(msg, color = 'red') {
    loginMessage.style.color = color;
    loginMessage.textContent = msg;
  }
//clears login messages
  function clearMessage() {
    loginMessage.textContent = '';
  }
//Starts Live Chat
  function startChat() {
    loginSection.style.display = 'none';
    chatSection.style.display = 'flex';
    bgSelector.style.display = 'none';
    chat.innerHTML = '';
//Connects User's Actions to https
    const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
    ws = new WebSocket(`${protocol}${location.host}?token=${token}`);

    ws.onopen = () => addMessage('Verbunden mit dem Chat-Server', false);
//Connects Message Additions to Web Socket
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message') {
          addMessage(data.text, false);
        } else {
          addMessage(event.data, false);
        }
      } catch {
        addMessage(event.data, false);
      }
    };
//Sends Join/Leave Messages
    ws.onclose = () => addMessage('Verbindung zum Chat-Server getrennt', false);
    ws.onerror = () => addMessage('WebSocket Fehler', false);

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') send();
    });
  }
//Registration Function
  window.register = () => {
    clearMessage();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
      showMessage('Bitte Benutzername und Passwort eingeben.');
      return;
    }
    //Registration Post Request
    fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.text();
      })
      .then((msg) => showMessage(msg, 'green'))
      .catch((err) => showMessage(err.message));
  };
//Login Function
  window.login = () => {
    clearMessage();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
      showMessage('Bitte Benutzername und Passwort eingeben.');
      return;
    }
    //Login Post Request
    fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((data) => {
        token = data.token;
        startChat();
      })
      .catch((err) => showMessage(err.message));
  };
// logout button code (closes websocket)
  window.logout = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    token = null;
    input.value = '';
    chat.innerHTML = '';

    chatSection.style.display = 'none';
    loginSection.style.display = 'flex';
    bgSelector.style.display = 'block';
  };
 // applies custom background using Jpeg
  window.applyBackground = function() {
    const fileInput = document.getElementById('bg-input');
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      const backgroundURL = e.target.result;
      document.body.style.backgroundImage = `url(${backgroundURL})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      localStorage.setItem('customBackground', backgroundURL);
    };
    reader.readAsDataURL(file);
  };

  const savedBg = localStorage.getItem('customBackground');
  if (savedBg) {
    document.body.style.backgroundImage = `url(${savedBg})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
  }
// resets background to plain white
  window.resetBackground = function () {
    localStorage.removeItem('customBackground');
    document.body.style.backgroundImage = '';
    document.body.style.backgroundColor = '#f0f0f0';
  };
});
