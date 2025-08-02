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
  let mediaRecorder = null;
  let audioChunks = [];
  const recordBtn = document.getElementById('record-audio-btn');

//Adds Message to Chat (backend)
  // Enhanced addMessage to support images and audio
  function addMessage(text, isUser, type, url, username) {
    const msg = document.createElement('div');
    const date = new Date();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    msg.className = 'message ' + (isUser ? 'user' : 'other');
    let content = `[${hours}:${minutes}:${seconds}] `;
    if (type === 'image') {
      content += (username ? username + ': ' : '') + '<img src="' + url + '" style="max-width:200px; max-height:150px; display:block; margin:5px 0;"/>';
      msg.innerHTML = content;
    } else if (type === 'audio') {
      content += (username ? username + ': ' : '') + '<audio controls src="' + url + '" style="display:block; margin:5px 0;"></audio>';
      msg.innerHTML = content;
    } else {
      msg.textContent = content + text;
    }
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
  }
//Sends Messages
  // Update send to use addMessage with type
  function send() {
    const text = input.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(text);
    addMessage(`Du: ${text}`, true, 'text');
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
          addMessage(data.text, false, 'text');
        } else if (data.type === 'image') {
          addMessage('', false, 'image', data.url, data.username);
        } else if (data.type === 'audio') {
          addMessage('', false, 'audio', data.url, data.username);
        } else {
          addMessage(event.data, false, 'text');
        }
      } catch {
        addMessage(event.data, false, 'text');
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

  // Image upload logic
  window.uploadImage = function() {
    const fileInput = document.getElementById('image-upload');
    const file = fileInput.files[0];
    if (!file) return alert('Bitte wählen Sie ein Bild aus.');
    const btn = event.target;
    btn.disabled = true;
    const formData = new FormData();
    formData.append('image', file);
    fetch('/upload/image', { method: 'POST', body: formData })
      .then(res => {
        btn.disabled = false;
        if (!res.ok) throw new Error('Upload fehlgeschlagen');
        return res.json();
      })
      .then(data => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'image', url: data.url }));
          addMessage('Du hast ein Bild gesendet.', true, 'image', data.url, 'Du');
        }
        fileInput.value = '';
      })
      .catch(err => {
        btn.disabled = false;
        alert('Bild-Upload fehlgeschlagen: ' + err.message);
      });
  };
  // Audio upload logic
  window.uploadAudio = function() {
    const fileInput = document.getElementById('audio-upload');
    const file = fileInput.files[0];
    if (!file) return alert('Bitte wählen Sie eine Audiodatei aus.');
    const btn = event.target;
    btn.disabled = true;
    const formData = new FormData();
    formData.append('audio', file);
    fetch('/upload/audio', { method: 'POST', body: formData })
      .then(res => {
        btn.disabled = false;
        if (!res.ok) throw new Error('Upload fehlgeschlagen');
        return res.json();
      })
      .then(data => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'audio', url: data.url }));
          addMessage('Du hast eine Audiodatei gesendet.', true, 'audio', data.url, 'Du');
        }
        fileInput.value = '';
      })
      .catch(err => {
        btn.disabled = false;
        alert('Audio-Upload fehlgeschlagen: ' + err.message);
      });
  };

  window.toggleRecording = async function() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      recordBtn.textContent = '🎤 Aufnahme starten';
      recordBtn.disabled = true;
      return;
    }
    // Start recording
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Audioaufnahme wird von diesem Browser nicht unterstützt.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        try {
          const res = await fetch('/upload/audio', { method: 'POST', body: formData });
          if (!res.ok) throw new Error('Upload fehlgeschlagen');
          const data = await res.json();
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'audio', url: data.url }));
            addMessage('Du hast eine Audioaufnahme gesendet.', true, 'audio', data.url, 'Du');
          }
        } catch (err) {
          alert('Audio-Upload fehlgeschlagen: ' + err.message);
        }
        recordBtn.disabled = false;
      };
      mediaRecorder.start();
      recordBtn.textContent = '⏹️ Aufnahme stoppen';
    } catch (err) {
      alert('Mikrofonzugriff verweigert oder nicht verfügbar.');
    }
  };
});
