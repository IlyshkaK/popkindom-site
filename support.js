function supportEscapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const supportForm = document.getElementById('supportForm');
const supportMessage = document.getElementById('supportMessage');

function setSupportMessage(text, type) {
  if (!supportMessage) return;
  supportMessage.className = `auth-message ${type || ''}`;
  supportMessage.textContent = text;
}

if (supportForm) {
  supportForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = supportForm.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    setSupportMessage('Отправляем обращение…', '');

    const payload = {
      username: document.getElementById('supportUsername')?.value?.trim() || '',
      telegramUsername: document.getElementById('supportTelegram')?.value?.trim() || '',
      contact: document.getElementById('supportContact')?.value?.trim() || '',
      subject: document.getElementById('supportSubject')?.value?.trim() || '',
      message: document.getElementById('supportText')?.value?.trim() || '',
    };

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Не удалось отправить обращение.');

      setSupportMessage(`${data.message || 'Обращение отправлено.'} Номер заявки: #${data.ticketId}`, 'success');
      supportForm.reset();
    } catch (error) {
      setSupportMessage(supportEscapeHtml(error.message || 'Ошибка отправки.'), 'error');
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}
