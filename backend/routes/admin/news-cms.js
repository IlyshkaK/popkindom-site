const { query, ensureAuthTables } = require('../../lib/db');
const { sendJson, methodNotAllowed, readJson } = require('../../lib/http');
const { getAdminUser, isFullAdminRole } = require('../../lib/admin');

function slugify(value) {
  const base = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'e')
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return base || `news-${Date.now()}`;
}

function clean(value, max = 4000) {
  return String(value || '').trim().slice(0, max);
}

function normalize(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    content: row.content,
    category: row.category,
    coverUrl: row.cover_url,
    published: row.is_published,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireCmsAdmin(req, res) {
  const admin = await getAdminUser(req);
  if (!admin) {
    sendJson(res, 403, { message: 'Нужно подтвердить вход PIN-кодом.' });
    return null;
  }
  if (!isFullAdminRole(admin)) {
    sendJson(res, 403, { message: 'CMS-новости доступны только ADMIN и OWNER.' });
    return null;
  }
  return admin;
}

module.exports = async function handler(req, res) {
  await ensureAuthTables();
  const admin = await requireCmsAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    const result = await query(
      `SELECT *
       FROM pd_news
       ORDER BY created_at DESC
       LIMIT 80;`
    );
    return sendJson(res, 200, { news: result.rows.map(normalize) });
  }

  if (req.method !== 'POST') return methodNotAllowed(res);

  const body = await readJson(req);
  const action = String(body.action || 'save').trim().toLowerCase();
  const id = Number(body.id || 0);

  if (action === 'delete') {
    if (!Number.isInteger(id) || id <= 0) return sendJson(res, 400, { message: 'Некорректная новость.' });
    await query(`DELETE FROM pd_news WHERE id = $1;`, [id]);
    return sendJson(res, 200, { message: 'Новость удалена.' });
  }

  const title = clean(body.title, 160);
  const summary = clean(body.summary, 500);
  const content = clean(body.content, 8000);
  const category = clean(body.category || 'Объявление', 80);
  const coverUrl = clean(body.coverUrl || body.cover_url, 700);
  const published = body.published === true || body.isPublished === true || String(body.published || '').toLowerCase() === 'true';
  const slug = slugify(body.slug || title);

  if (title.length < 3) return sendJson(res, 400, { message: 'Заголовок слишком короткий.' });
  if (summary.length < 5) return sendJson(res, 400, { message: 'Краткое описание слишком короткое.' });
  if (content.length < 10) return sendJson(res, 400, { message: 'Текст новости слишком короткий.' });

  if (id > 0) {
    const result = await query(
      `UPDATE pd_news
       SET title = $1,
           slug = $2,
           summary = $3,
           content = $4,
           category = $5,
           cover_url = $6,
           is_published = $7,
           updated_by = $8,
           updated_at = NOW(),
           published_at = CASE
             WHEN $7 = TRUE AND published_at IS NULL THEN NOW()
             WHEN $7 = FALSE THEN NULL
             ELSE published_at
           END
       WHERE id = $9
       RETURNING *;`,
      [title, slug, summary, content, category, coverUrl || null, published, admin.username, id]
    );
    if (!result.rows.length) return sendJson(res, 404, { message: 'Новость не найдена.' });
    return sendJson(res, 200, { message: 'Новость обновлена.', news: normalize(result.rows[0]) });
  }

  const result = await query(
    `INSERT INTO pd_news
     (title, slug, summary, content, category, cover_url, is_published, created_by, updated_by, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, CASE WHEN $7 = TRUE THEN NOW() ELSE NULL END)
     RETURNING *;`,
    [title, slug, summary, content, category, coverUrl || null, published, admin.username]
  );

  return sendJson(res, 200, { message: 'Новость создана.', news: normalize(result.rows[0]) });
};
