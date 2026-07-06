function adminExtraEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function adminExtraDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function adminExtraRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Ошибка запроса.');
  return data;
}

let cmsEditingId = 0;

async function loadAdminNewsCms() {
  const list = document.getElementById('adminNewsList');
  if (!list) return;
  try {
    const data = await adminExtraRequest('/api/admin/news');
    const items = Array.isArray(data.news) ? data.news : [];
    if (!items.length) {
      list.innerHTML = '<p class="admin-extra-empty">Новостей пока нет.</p>';
      return;
    }
    list.innerHTML = items.map((item) => `
      <article class="admin-extra-item">
        <div>
          <b>${adminExtraEscape(item.title)}</b>
          <span>${adminExtraEscape(item.category || 'Новость')} · ${item.published ? 'Опубликовано' : 'Черновик'} · ${adminExtraDate(item.createdAt)}</span>
        </div>
        <button type="button" class="admin-mini-btn" data-edit-news="${item.id}">Открыть</button>
      </article>
    `).join('');
    window.__pdNewsCmsItems = items;
  } catch (error) {
    list.innerHTML = `<p class="admin-extra-empty">${adminExtraEscape(error.message)}</p>`;
  }
}

function fillNewsForm(item) {
  cmsEditingId = Number(item?.id || 0);
  document.getElementById('cmsNewsId').value = cmsEditingId ? String(cmsEditingId) : '';
  document.getElementById('cmsNewsTitle').value = item?.title || '';
  document.getElementById('cmsNewsSlug').value = item?.slug || '';
  document.getElementById('cmsNewsCategory').value = item?.category || 'Объявление';
  document.getElementById('cmsNewsCover').value = item?.coverUrl || '';
  document.getElementById('cmsNewsSummary').value = item?.summary || '';
  document.getElementById('cmsNewsContent').value = item?.content || '';
  document.getElementById('cmsNewsPublished').checked = item?.published === true;
  const title = document.getElementById('cmsNewsFormTitle');
  if (title) title.textContent = cmsEditingId ? 'Редактирование новости' : 'Новая новость';
}

async function initAdminNewsCms() {
  const form = document.getElementById('cmsNewsForm');
  if (!form) return;
  const message = document.getElementById('cmsNewsMessage');

  await loadAdminNewsCms();

  document.getElementById('cmsNewsNew')?.addEventListener('click', () => fillNewsForm(null));
  document.getElementById('adminNewsRefresh')?.addEventListener('click', loadAdminNewsCms);

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-edit-news]');
    if (!button) return;
    const id = Number(button.dataset.editNews || 0);
    const item = (window.__pdNewsCmsItems || []).find((news) => Number(news.id) === id);
    if (item) fillNewsForm(item);
  });

  document.getElementById('cmsNewsDelete')?.addEventListener('click', async () => {
    if (!cmsEditingId) return;
    if (!confirm('Удалить эту новость?')) return;
    try {
      await adminExtraRequest('/api/admin/news', { method: 'POST', body: JSON.stringify({ action: 'delete', id: cmsEditingId }) });
      if (message) message.textContent = 'Новость удалена.';
      fillNewsForm(null);
      await loadAdminNewsCms();
    } catch (error) {
      if (message) message.textContent = error.message;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      id: cmsEditingId || undefined,
      title: document.getElementById('cmsNewsTitle').value,
      slug: document.getElementById('cmsNewsSlug').value,
      category: document.getElementById('cmsNewsCategory').value,
      coverUrl: document.getElementById('cmsNewsCover').value,
      summary: document.getElementById('cmsNewsSummary').value,
      content: document.getElementById('cmsNewsContent').value,
      published: document.getElementById('cmsNewsPublished').checked,
    };
    try {
      const data = await adminExtraRequest('/api/admin/news', { method: 'POST', body: JSON.stringify(payload) });
      if (message) message.textContent = data.message || 'Сохранено.';
      fillNewsForm(data.news || null);
      await loadAdminNewsCms();
    } catch (error) {
      if (message) message.textContent = error.message;
    }
  });
}

async function loadSupportTickets() {
  const list = document.getElementById('adminSupportList');
  if (!list) return;
  try {
    const data = await adminExtraRequest('/api/admin/support');
    const tickets = Array.isArray(data.tickets) ? data.tickets : [];
    if (!tickets.length) {
      list.innerHTML = '<p class="admin-extra-empty">Обращений пока нет.</p>';
      return;
    }
    list.innerHTML = tickets.map((ticket) => `
      <article class="admin-extra-ticket">
        <div class="admin-extra-ticket-head">
          <b>#${ticket.id} · ${adminExtraEscape(ticket.subject)}</b>
          <span>${adminExtraEscape(ticket.status)} · ${adminExtraDate(ticket.createdAt)}</span>
        </div>
        <p>${adminExtraEscape(ticket.message)}</p>
        <small>Игрок: ${adminExtraEscape(ticket.username || 'Гость')} · TG: ${ticket.telegramUsername ? '@' + adminExtraEscape(ticket.telegramUsername) : 'не указан'} · Контакт: ${adminExtraEscape(ticket.contact || 'не указан')}</small>
        ${ticket.adminReply ? `<blockquote>${adminExtraEscape(ticket.adminReply)}</blockquote>` : ''}
        <div class="admin-extra-ticket-actions">
          <select data-ticket-status="${ticket.id}">
            ${['OPEN', 'IN_PROGRESS', 'ANSWERED', 'CLOSED'].map((status) => `<option value="${status}" ${ticket.status === status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
          <input type="text" placeholder="Ответ / заметка" data-ticket-reply="${ticket.id}">
          <button type="button" class="admin-mini-btn" data-ticket-save="${ticket.id}">Сохранить</button>
        </div>
      </article>
    `).join('');
  } catch (error) {
    list.innerHTML = `<p class="admin-extra-empty">${adminExtraEscape(error.message)}</p>`;
  }
}

function initAdminSupport() {
  const list = document.getElementById('adminSupportList');
  if (!list) return;
  loadSupportTickets();
  document.getElementById('adminSupportRefresh')?.addEventListener('click', loadSupportTickets);
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-ticket-save]');
    if (!button) return;
    const id = Number(button.dataset.ticketSave || 0);
    const status = document.querySelector(`[data-ticket-status="${id}"]`)?.value || 'IN_PROGRESS';
    const reply = document.querySelector(`[data-ticket-reply="${id}"]`)?.value || '';
    try {
      await adminExtraRequest('/api/admin/support', { method: 'POST', body: JSON.stringify({ id, status, reply }) });
      await loadSupportTickets();
    } catch (error) {
      alert(error.message);
    }
  });
}

function waitForAdminDashboard(callback, attempts = 0) {
  const dashboard = document.getElementById('adminDashboard');
  if (!dashboard) return;
  if (!dashboard.hidden || attempts > 20) {
    callback();
    return;
  }
  setTimeout(() => waitForAdminDashboard(callback, attempts + 1), 500);
}

waitForAdminDashboard(() => {
  initAdminNewsCms();
  initAdminSupport();
  if (window.refreshLucideIcons) window.refreshLucideIcons();
});
