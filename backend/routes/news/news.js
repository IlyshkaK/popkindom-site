const { query, ensureAuthTables } = require('../../lib/db');
const { sendJson } = require('../../lib/http');

function normalizeNews(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    content: row.content,
    category: row.category,
    coverUrl: row.cover_url,
    published: row.is_published,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = async function handler(req, res) {
  await ensureAuthTables();

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { message: 'Метод не поддерживается.' });
  }

  const slug = String(req.query?.slug || '').trim().toLowerCase();

  if (slug) {
    const result = await query(
      `SELECT *
       FROM pd_news
       WHERE slug = $1 AND is_published = TRUE
       LIMIT 1;`,
      [slug]
    );

    const item = result.rows[0] || null;
    if (!item) return sendJson(res, 404, { message: 'Новость не найдена.' });
    return sendJson(res, 200, { news: normalizeNews(item) });
  }

  const result = await query(
    `SELECT *
     FROM pd_news
     WHERE is_published = TRUE
     ORDER BY COALESCE(published_at, created_at) DESC
     LIMIT 30;`
  );

  return sendJson(res, 200, { news: result.rows.map(normalizeNews) });
};
