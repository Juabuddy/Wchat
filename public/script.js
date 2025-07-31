document.addEventListener('DOMContentLoaded', () => {
  let ws;
  let token;

  const chat = document.getElementById('chat');
  const input = document.getElementById('input');
  const loginSection = document.getElementById('login-section');
  const chatSection = document.getElementById('chat-section');
  const loginMessage = document.getElementById('login-message');
  const bgSelector = document.getElementById('bg-selector');

  // --- Add Message to Chat ---
  function addMessage(text, isUser) {
    const msg = document.createElement('div');
    msg.className = 'message ' + (isUser ? 'user' : 'other');
    msg.textContent = text;
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
  }

  // --- Send Message ---
  function send() {
    const text = input.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(text);
    addMessage('Du: ' + text, true);
    input.value = '';
  }
  window.send = send;

  // --- Show Login Message ---
  function showMessage(msg, color = 'red') {
    loginMessage.style.color = color;
    loginMessage.textContent = msg;
  }

  function clearMessage() {
    loginMessage.textContent = '';
  }

  // --- Start Chat ---
  function startChat() {
    loginSection.style.display = 'none';
    chatSection.style.display = 'flex';
    bgSelector.style.display = 'none'; // Hide background selector
    chat.innerHTML = '';

    const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
    ws = new WebSocket(`${protocol}${location.host}?token=${token}`);

    ws.onopen = () => addMessage('Verbunden mit dem Chat-Server', false);

    ws.onmessage = (event) => {
      if (!event.data.startsWith(`Du:`)) {
        addMessage(event.data, false);
      }
    };

    ws.onclose = () => addMessage('Verbindung zum Chat-Server getrennt', false);
    ws.onerror = () => addMessage('WebSocket Fehler', false);

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') send();
    });
  }

  // --- Register ---
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

  // --- Login ---
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

  // --- Logout ---
  window.logout = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    token = null;
    input.value = '';
    chat.innerHTML = '';

    chatSection.style.display = 'none';
    loginSection.style.display = 'flex';
    bgSelector.style.display = 'block'; // Show selector again
  };

  // --- Apply Custom Background ---
  window.applyBackground = function() {
  const fileInput = document.getElementById('bg-input');
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const backgroundURL = e.target.result;

    // Set background clientside only
    document.body.style.backgroundImage = `url(${backgroundURL})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';

    // Save in localStorage for this user only
    localStorage.setItem('customBackground', backgroundURL);
  };
  reader.readAsDataURL(file);
};



  // --- Load Saved Background ---
  const savedBg = localStorage.getItem('customBackground');
  if (savedBg) {
  document.body.style.backgroundImage = `url(${savedBg})`;
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundPosition = 'center';
}

    document.body.style.backgroundImage = `url(${savedBg})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
  
  window.resetBackground = function () {
  localStorage.removeItem('customBackground');
  document.body.style.backgroundImage = '';
  document.body.style.backgroundColor = '#f0f0f0';
};
  
});
