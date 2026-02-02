let messageTimeoutId = null;

export function showMessage(text, type) {
  const el = document.getElementById('message');
  if (!el) return;

  el.className = 'message';
  if (type === 'success') el.classList.add('message--success');
  else if (type === 'error') el.classList.add('message--error');
  else el.classList.add('message--info');

  el.textContent = text;
  el.classList.add('message--visible');

  if (messageTimeoutId !== null) {
    clearTimeout(messageTimeoutId);
  }
  messageTimeoutId = setTimeout(() => {
    el.classList.remove('message--visible');
    messageTimeoutId = null;
  }, 3000);
}
