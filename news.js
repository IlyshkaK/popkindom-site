function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatNewsDate(value) {
  if (!value) return 'Без даты';
  return new Date(value).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

async function loadNews() {
  const list = document.getElementById('newsListCms');
  if (!list) return;

  try {
    const response = await fetch('/api/news', { credentials: 'include' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Не удалось загрузить новости.');

    const items = Array.isArray(data.news) ? data.news : [];
    if (!items.length) {
      list.innerHTML = `
        <article class="rule-panel-v2 news-panel good">
          <div class="news-panel-meta"><span>Объявление</span><time>Скоро</time></div>
          <div class="rule-panel-head"><i data-lucide="sparkles"></i><h2>Новости скоро появятся</h2></div>
          <p>Здесь будут публиковаться обновления сервера, технические работы, события сезона и важные изменения проекта.</p>
        </article>
      `;
      if (window.refreshLucideIcons) window.refreshLucideIcons();
      return;
    }

    list.innerHTML = items.map((item) => `
      <article class="rule-panel-v2 news-panel cms-news-card" id="${escapeHtml(item.slug || ('news-' + item.id))}">
        ${item.coverUrl ? `<img class="cms-news-cover" src="${escapeHtml(item.coverUrl)}" alt="${escapeHtml(item.title)}" loading="lazy">` : ''}
        <div class="news-panel-meta"><span>${escapeHtml(item.category || 'Новость')}</span><time>${escapeHtml(formatNewsDate(item.publishedAt || item.createdAt))}</time></div>
        <div class="rule-panel-head"><i data-lucide="newspaper"></i><h2>${escapeHtml(item.title)}</h2></div>
        <p class="cms-news-summary">${escapeHtml(item.summary)}</p>
        <div class="cms-news-content">${escapeHtml(item.content).replace(/\n/g, '<br>')}</div>
      </article>
    `).join('');
  } catch (error) {
    list.innerHTML = `
      <article class="rule-panel-v2 news-panel danger">
        <div class="rule-panel-head"><i data-lucide="wifi-off"></i><h2>Новости временно недоступны</h2></div>
        <p>${escapeHtml(error.message || 'Попробуй обновить страницу позже.')}</p>
      </article>
    `;
  }

  if (window.refreshLucideIcons) window.refreshLucideIcons();
}

loadNews();
