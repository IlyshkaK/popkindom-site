/* PopkinDom CMS News frontend */
(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  function setMessage(element, text, type = '') {
    if (!element) return;
    element.textContent = text || '';
    element.className = `auth-message ${type}`;
  }

  function isFullAdmin(user) {
    return ['admin', 'spec.admin'].includes(String(user?.role || '').toLowerCase());
  }

  async function requireFullAdmin() {
    const data = await api('/api/me?summary=1');
    if (!isFullAdmin(data.user)) {
      window.location.href = '/account';
      return null;
    }
    return data.user;
  }

  function renderNewsCard(item) {
    const date = formatDate(item.publishedAt || item.createdAt);
    const cover = item.coverUrl ? `<img class="cms-news-cover" src="${escapeHtml(item.coverUrl)}" alt="${escapeHtml(item.title)}" loading="lazy">` : '';
    return `
      <article class="rule-panel-v2 news-panel cms-news-public-card">
        ${cover}
        <div class="news-panel-meta"><span>${escapeHtml(item.category || 'Новость')}</span><time>${date}</time></div>
        <div class="rule-panel-head"><i data-lucide="newspaper"></i><h2>${escapeHtml(item.title)}</h2></div>
        <p class="cms-news-summary">${escapeHtml(item.summary || '')}</p>
        <div class="cms-news-content">${escapeHtml(item.content || '').replace(/\n/g, '<br>')}</div>
      </article>
    `;
  }

  async function initPublicNews() {
    const list = $('#publicNewsList');
    if (!list) return;
    try {
      const data = await api('/api/news');
      const items = Array.isArray(data.news) ? data.news : [];
      if (!items.length) {
        list.innerHTML = `
          <article class="rule-panel-v2 news-panel good">
            <div class="news-panel-meta"><span>Объявление</span><time>Скоро</time></div>
            <div class="rule-panel-head"><i data-lucide="sparkles"></i><h2>Новости скоро появятся</h2></div>
            <p>Здесь будут публиковаться обновления сервера, технические работы, события сезона и важные изменения проекта.</p>
          </article>`;
      } else {
        list.innerHTML = items.map(renderNewsCard).join('');
      }
    } catch (error) {
      list.innerHTML = `<article class="rule-panel-v2 news-panel"><p>${escapeHtml(error.message)}</p></article>`;
    }
    if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2.4 } });
  }

  let cmsEditingId = 0;

  function cmsFormPayload() {
    return {
      id: cmsEditingId || undefined,
      title: $('#cmsTitle')?.value?.trim(),
      slug: $('#cmsSlug')?.value?.trim(),
      summary: $('#cmsSummary')?.value?.trim(),
      content: $('#cmsContent')?.value?.trim(),
      category: $('#cmsCategory')?.value?.trim() || 'Объявление',
      coverUrl: $('#cmsCoverUrl')?.value?.trim(),
      published: $('#cmsPublished')?.checked === true
    };
  }

  function fillCmsForm(item = {}) {
    cmsEditingId = Number(item.id || 0);
    if ($('#cmsTitle')) $('#cmsTitle').value = item.title || '';
    if ($('#cmsSlug')) $('#cmsSlug').value = item.slug || '';
    if ($('#cmsSummary')) $('#cmsSummary').value = item.summary || '';
    if ($('#cmsContent')) $('#cmsContent').value = item.content || '';
    if ($('#cmsCategory')) $('#cmsCategory').value = item.category || 'Объявление';
    if ($('#cmsCoverUrl')) $('#cmsCoverUrl').value = item.coverUrl || '';
    if ($('#cmsPublished')) $('#cmsPublished').checked = item.published === true;
    if ($('#cmsSubmitText')) $('#cmsSubmitText').textContent = cmsEditingId ? 'Сохранить изменения' : 'Создать новость';
  }

  function renderCmsItem(item) {
    return `
      <article class="admin-extra-item" data-news-id="${item.id}">
        <div>
          <b>${escapeHtml(item.title)}</b>
          <span>${escapeHtml(item.category || 'Новость')} · ${item.published ? 'Опубликована' : 'Черновик'} · ${formatDate(item.publishedAt || item.createdAt)}</span>
        </div>
        <div class="admin-extra-actions">
          <button type="button" class="admin-mini-btn" data-cms-edit="${item.id}"><i data-lucide="pencil"></i> Открыть</button>
          <button type="button" class="admin-mini-btn danger" data-cms-delete="${item.id}"><i data-lucide="trash-2"></i> Удалить</button>
        </div>
      </article>`;
  }

  async function loadCmsNews() {
    const list = $('#cmsNewsList');
    if (!list) return;
    list.innerHTML = '<div class="admin-extra-empty">Загрузка новостей…</div>';
    try {
      const data = await api('/api/admin/news');
      const items = Array.isArray(data.news) ? data.news : [];
      window.__pdCmsNews = items;
      list.innerHTML = items.length ? items.map(renderCmsItem).join('') : '<div class="admin-extra-empty">Новостей пока нет.</div>';
      if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2.4 } });
    } catch (error) {
      if (/PIN|код|доступ/i.test(error.message)) {
        list.innerHTML = '<div class="admin-extra-empty">Нужно открыть админ-панель и подтвердить PIN-код.</div>';
      } else {
        list.innerHTML = `<div class="admin-extra-empty">${escapeHtml(error.message)}</div>`;
      }
    }
  }

  async function initCmsAdmin() {
    const form = $('#cmsNewsForm');
    if (!form) return;
    await requireFullAdmin();
    const message = $('#cmsNewsMessage');
    await loadCmsNews();

    $('#cmsNewBtn')?.addEventListener('click', () => {
      fillCmsForm({});
      setMessage(message, '', '');
    });

    $('#cmsRefreshBtn')?.addEventListener('click', loadCmsNews);

    $('#cmsNewsList')?.addEventListener('click', async (event) => {
      const editBtn = event.target.closest('[data-cms-edit]');
      const deleteBtn = event.target.closest('[data-cms-delete]');
      if (editBtn) {
        const id = Number(editBtn.dataset.cmsEdit);
        const item = (window.__pdCmsNews || []).find((news) => Number(news.id) === id);
        if (item) fillCmsForm(item);
      }
      if (deleteBtn) {
        const id = Number(deleteBtn.dataset.cmsDelete);
        if (!confirm('Удалить эту новость?')) return;
        try {
          await api('/api/admin/news', { method: 'POST', body: JSON.stringify({ action: 'delete', id }) });
          if (cmsEditingId === id) fillCmsForm({});
          await loadCmsNews();
          setMessage(message, 'Новость удалена.', 'success');
        } catch (error) {
          setMessage(message, error.message, 'error');
        }
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setMessage(message, 'Сохраняем новость…', '');
      try {
        const data = await api('/api/admin/news', { method: 'POST', body: JSON.stringify(cmsFormPayload()) });
        fillCmsForm(data.news || {});
        await loadCmsNews();
        setMessage(message, data.message || 'Новость сохранена.', 'success');
      } catch (error) {
        setMessage(message, error.message, 'error');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initPublicNews();
    initCmsAdmin();
  });
})();
