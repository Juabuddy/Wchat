document.addEventListener('DOMContentLoaded', () => {
  let ws;
  let token;

  const chat = document.getElementById('chat');
  const input = document.getElementById('input');
  const loginSection = document.getElementById('login-section');
  const chatSection = document.getElementById('chat-section');
  const loginMessage = document.getElementById('login-message');
  const bgSelector = document.getElementById('bg-selector');
  const usersList = document.getElementById('users-list');

  function addMessage(text, isUser) {
    const msg = document.createElement('div');
    const timestamp = Date.now();
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const time24h = `${hours}:${minutes}:${seconds}`;
    msg.className = 'message ' + (isUser ? 'user' : 'other');
    msg.textContent = `[${time24h}] ${text}`;
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
  }

  function send() {
    const text = input.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(text);
    addMessage(`Du: ${text}`, true);
    input.value = '';
  }
  window.send = send;

  function showMessage(msg, color = 'red') {
    loginMessage.style.color = color;
    loginMessage.textContent = msg;
  }

  function clearMessage() {
    loginMessage.textContent = '';
  }

  function startChat() {
    loginSection.style.display = 'none';
    chatSection.style.display = 'flex';
    bgSelector.style.display = 'none';
    chat.innerHTML = '';

    const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
    ws = new WebSocket(`${protocol}${location.host}?token=${token}`);

    ws.onopen = () => addMessage('Verbunden mit dem Chat-Server', false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'onlineUsers') {
          updateOnlineUsers(data.users);
        } else if (data.type === 'message') {
          addMessage(data.text, false);
        } else {
          addMessage(event.data, false);
        }
      } catch {
        addMessage(event.data, false);
      }
    };

    ws.onclose = () => addMessage('Verbindung zum Chat-Server getrennt', false);
    ws.onerror = () => addMessage('WebSocket Fehler', false);

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') send();
    });
  }

  window.register = () => {
    clearMessage();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
      showMessage('Bitte Benutzername und Passwort eingeben.');
      return;
    }

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

  window.login = () => {
    clearMessage();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
      showMessage('Bitte Benutzername und Passwort eingeben.');
      return;
    }

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

  window.resetBackground = function () {
    localStorage.removeItem('customBackground');
    document.body.style.backgroundImage = '';
    document.body.style.backgroundColor = '#f0f0f0';
  };
});
