document.addEventListener('DOMContentLoaded', () => {
  const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
  const ws = new WebSocket(protocol + location.host);
  const chat = document.getElementById('chat');
  const input = document.getElementById('input');

  function addMessage(text, isUser) {
    const msg = document.createElement('div');
    msg.className = 'message ' + (isUser ? 'user' : 'other');
    msg.textContent = text;
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
  }

  function send() {
    const text = input.value.trim();
    if (text) {
      ws.send(text);
      addMessage('Du: ' + text, true);
      input.value = '';
    }
  }

  ws.onmessage = (event) => addMessage(event.data, false);
  input.addEventListener('keypress', (e) => { if (e.key === 'Enter') send(); });

  // make send accessible to the button onclick
  window.send = send;
});
