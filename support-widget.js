(function () {
  const path = String(window.location.pathname || '').toLowerCase();
  const adminPage = /\/(admin|admin-news|admin-support)(\.html)?$/.test(path);
  if (adminPage || window.__pdSupportWidgetLoaded) return;
  window.__pdSupportWidgetLoaded = true;

  // Полностью удаляем старую поддержку в виде отдельного блока/модального окна.
  document.querySelectorAll(
    '#supportModal, .support-modal, .support-landing, .support-page-coldclan, #supportOpenBtn'
  ).forEach((element) => {
    if (element === document.body) return;
    element.remove();
  });
  document.body.classList.remove('support-page-coldclan', 'support-modal-open');

  // Виджет сам подключает стили. Отдельный <link> в HTML больше не обязателен.
  if (!document.querySelector('link[data-pd-support-widget]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/support-widget.css?v=6';
    stylesheet.dataset.pdSupportWidget = 'true';
    document.head.appendChild(stylesheet);
  }

  function icon(name, fallback) {
    return `<span class="pd-support-icon-fallback" aria-hidden="true">${fallback}</span><i data-lucide="${name}"></i>`;
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ attrs: { 'stroke-width': 2.3 } });
      document.querySelectorAll('.pd-support-icon-fallback').forEach((item) => {
        item.style.display = 'none';
      });
    }
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || 'Ошибка запроса.');
    return data;
  }

  const widget = document.createElement('div');
  widget.className = 'pd-support-widget';
  widget.innerHTML = `
    <section class="pd-support-panel" aria-hidden="true" aria-label="Чат поддержки">
      <header class="pd-support-header">
        <div class="pd-support-avatar">${icon('messages-square', '💬')}</div>
        <div class="pd-support-header-copy">
          <b>Поддержка PopkinDom</b>
          <span>Оставь сообщение администрации</span>
        </div>
        <button type="button" class="pd-support-close" aria-label="Закрыть чат">${icon('x', '×')}</button>
      </header>

      <div class="pd-support-body">
        <div class="pd-support-welcome">
          Привет! Опиши проблему — обращение сохранится на сайте и отправится администрации в Telegram.
        </div>

        <form class="pd-support-form">
          <div class="pd-support-form-row">
            <div class="pd-support-field">
              <label>Ник</label>
              <input name="username" maxlength="16" placeholder="Ник в Minecraft">
            </div>
            <div class="pd-support-field">
              <label>Telegram</label>
              <input name="telegramUsername" maxlength="64" placeholder="@username">
            </div>
          </div>

          <div class="pd-support-field">
            <label>Тема</label>
            <input name="subject" maxlength="120" placeholder="Например: проблема со входом" required>
          </div>

          <div class="pd-support-field">
            <label>Сообщение</label>
            <textarea name="message" maxlength="2000" placeholder="Расскажи подробнее, что произошло" required></textarea>
          </div>

          <button type="submit" class="pd-support-submit">
            ${icon('send', '➤')}<span>Отправить</span>
          </button>
          <p class="pd-support-message"></p>
        </form>

        <div class="pd-support-success">
          <div class="pd-support-success-icon">${icon('check', '✓')}</div>
          <h3>Обращение отправлено</h3>
          <p class="pd-support-success-text">Администрация получила сообщение.</p>
        </div>
      </div>
    </section>

    <button type="button" class="pd-support-toggle" aria-label="Открыть поддержку">
      ${icon('message-circle-more', '💬')}
    </button>
  `;
  document.body.appendChild(widget);

  const panel = widget.querySelector('.pd-support-panel');
  const toggle = widget.querySelector('.pd-support-toggle');
  const close = widget.querySelector('.pd-support-close');
  const form = widget.querySelector('.pd-support-form');
  const message = widget.querySelector('.pd-support-message');
  const submit = widget.querySelector('.pd-support-submit');
  const success = widget.querySelector('.pd-support-success');
  const successText = widget.querySelector('.pd-support-success-text');

  function resetState() {
    success.classList.remove('show');
    form.classList.remove('hidden');
    message.textContent = '';
    message.className = 'pd-support-message';
  }

  function openChat() {
    resetState();
    widget.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => form.querySelector('[name="subject"]')?.focus(), 180);
  }

  function closeChat() {
    widget.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }

  toggle.addEventListener('click', () => {
    if (widget.classList.contains('open')) closeChat();
    else openChat();
  });
  close.addEventListener('click', closeChat);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeChat();
  });

  // Старые ссылки поддержки больше не ведут на отдельную страницу.
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href="/support"], a[href="/support.html"], a[href^="/support?"]');
    if (!link) return;
    event.preventDefault();
    openChat();
  });

  (async () => {
    try {
      const me = await api('/api/me?summary=1');
      const input = form.querySelector('[name="username"]');
      if (me?.user?.username && input) input.value = me.user.username;
    } catch {}
  })();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = 'Отправляем…';
    message.className = 'pd-support-message';
    submit.disabled = true;

    const data = new FormData(form);
    const payload = {
      username: String(data.get('username') || '').trim(),
      telegramUsername: String(data.get('telegramUsername') || '').trim(),
      subject: String(data.get('subject') || '').trim(),
      message: String(data.get('message') || '').trim(),
      contact: ''
    };

    try {
      const result = await api('/api/support', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      form.classList.add('hidden');
      success.classList.add('show');
      successText.textContent =
        (result.message || 'Администрация получила сообщение.') +
        (result.ticketId ? ` Номер обращения: #${result.ticketId}.` : '');
      form.querySelector('[name="subject"]').value = '';
      form.querySelector('[name="message"]').value = '';
      refreshIcons();
    } catch (error) {
      message.textContent = error.message;
      message.className = 'pd-support-message error';
    } finally {
      submit.disabled = false;
    }
  });

  if (new URLSearchParams(window.location.search).get('support') === '1') {
    window.setTimeout(openChat, 250);
  }

  refreshIcons();
})();
