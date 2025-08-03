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
  const onlineUsersBtn = document.getElementById('online-users-btn');
  const onlineUsersList = document.getElementById('online-users-list');
  let onlineUsersVisible = false;
  const typingIndicator = document.getElementById('typing-indicator');
  let typingTimeout = null;
  let isTyping = false;
  let typingUsers = new Set();

  if (onlineUsersBtn && onlineUsersList) {
    onlineUsersBtn.addEventListener('click', (e) => {
      onlineUsersVisible = !onlineUsersVisible;
      onlineUsersList.style.display = onlineUsersVisible ? 'block' : 'none';
      if (onlineUsersVisible) {
        // Position the list below the button
        const rect = onlineUsersBtn.getBoundingClientRect();
        onlineUsersList.style.top = (rect.bottom + window.scrollY + 5) + 'px';
        onlineUsersList.style.left = (rect.left + window.scrollX) + 'px';
      }
    });
    // Hide list when clicking outside
    document.addEventListener('mousedown', (event) => {
      if (onlineUsersVisible && !onlineUsersList.contains(event.target) && event.target !== onlineUsersBtn) {
        onlineUsersList.style.display = 'none';
        onlineUsersVisible = false;
      }
    });
  }

//Adds Message to Chat (backend)
  // Utility: Generate a color from a string (username)
  function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = `hsl(${hash % 360}, 70%, 55%)`;
    return color;
  }

  // Utility: Get initials from username
  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  // Profile picture logic (revert to initials/color only)
  let myUsername = null;
  // Remove profilePicInput and upload logic

  // Helper: Render avatar HTML (initials and color only)
  function renderAvatar(username) {
    const color = stringToColor(username);
    return `<span class="avatar" style="background:${color}">${getInitials(username)}</span>`;
  }

  // Enhanced addMessage to support avatars and styled timestamp
  function addMessage(text, isUser, type, url, username) {
    const msg = document.createElement('div');
    const date = new Date();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    msg.className = 'message ' + (isUser ? 'user' : 'other');
    let user = username || (isUser ? 'Du' : '');
    let avatarHTML = user ? renderAvatar(user) : '';
    let mainContent = '';
    if (type === 'image') {
      mainContent = (user ? user + ': ' : '') + '<img src="' + url + '" style="max-width:200px; max-height:150px; display:block; margin:5px 0;"/>';
    } else if (type === 'audio') {
      mainContent = (user ? user + ': ' : '') + '<audio controls src="' + url + '" style="display:block; margin:5px 0;"></audio>';
    } else {
      mainContent = (user ? '' : '') + text;
    }
    // Timestamp below message
    let timestampHTML = `<span class='timestamp'>${hours}:${minutes}:${seconds}</span>`;
    msg.innerHTML = avatarHTML + '<div style="display:inline-block;vertical-align:top;max-width:calc(100% - 46px);"><div>' + mainContent + '</div>' + timestampHTML + '</div>';
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
  }

  // Update all avatars in chat and online users list (after profile pic change)
  function updateAllAvatars() {
    // No-op (no profile pics to update)
  }

  // Store username after login
  const origStartChat = startChat;
  startChat = function() {
    // Get username from login input
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
      myUsername = usernameInput.value.trim();
    }
    origStartChat();
  };

  // Render online users list with avatars
  function renderOnlineUsersList(data) {
    window._lastOnlineUsersData = data;
    if (onlineUsersList) {
      onlineUsersList.innerHTML = '<b>Online:</b><ul style="list-style:none;padding:0;margin:0;">' +
        (data.users.map ? data.users.map(uobj => {
          let u = uobj.username || uobj;
          let avatar = renderAvatar(u);
          return `<li>${avatar}<span>${u}</span><span class=\"avatar-badge\"></span></li>`;
        }).join('') : '') + '</ul>';
    }
  }

//Sends Messages
  // Update send to use addMessage with type
  function send() {
    const text = input.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(text);
    addMessage(`Du: ${text}`, true, 'text', undefined, myUsername);
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
          addMessage(data.text, false, 'text', undefined, data.username);
        } else if (data.type === 'image') {
          addMessage('', false, 'image', data.url, data.username);
        } else if (data.type === 'audio') {
          addMessage('', false, 'audio', data.url, data.username);
        } else if (data.type === 'onlineUsers') {
          renderOnlineUsersList(data);
        } else if (data.type === 'typing') {
          if (data.username && data.username !== myUsername) {
            typingUsers.add(data.username);
            updateTypingIndicator();
          }
        } else if (data.type === 'stopTyping') {
          if (data.username && typingUsers.has(data.username)) {
            typingUsers.delete(data.username);
            updateTypingIndicator();
          }
        } // else: ignore unknown types
      } catch {
        // Ignore non-JSON or malformed events
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
          addMessage('Du hast ein Bild gesendet.', true, 'image', data.url, myUsername);
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
          addMessage('Du hast eine Audiodatei gesendet.', true, 'audio', data.url, myUsername);
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
            addMessage('Du hast eine Audioaufnahme gesendet.', true, 'audio', data.url, myUsername);
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

  // Typing indicator logic
  if (input) {
    input.addEventListener('input', () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (!isTyping) {
        ws.send(JSON.stringify({ type: 'typing', username: myUsername }));
        isTyping = true;
      }
      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        ws.send(JSON.stringify({ type: 'stopTyping', username: myUsername }));
        isTyping = false;
      }, 1200);
    });
    input.addEventListener('blur', () => {
      if (isTyping && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stopTyping', username: myUsername }));
        isTyping = false;
      }
    });
  }

  function updateTypingIndicator() {
    const indicator = typingIndicator;
    const names = Array.from(typingUsers).filter(u => u !== myUsername);
    if (names.length === 0) {
      indicator.classList.remove('active');
      indicator.innerHTML = '';
    } else {
      indicator.classList.add('active');
      let text = '';
      if (names.length === 1) {
        text = `${names[0]} is typing`;
      } else {
        text = `${names.join(', ')} are typing`;
      }
      indicator.innerHTML =
        `<span>${text}</span><span class="typing-dots"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span>`;
    }
  }
});
