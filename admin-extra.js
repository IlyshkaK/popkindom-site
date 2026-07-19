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
  if (window.refreshLucideIcons) window.refreshLucideIcons();
});
