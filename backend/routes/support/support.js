const https = require('https');
const { query, ensureAuthTables } = require('../../lib/db');
const { sendJson, readJson } = require('../../lib/http');
const { getUserBySession } = require('../../lib/security');

function clean(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function escapeTelegram(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_SUPPORT_CHAT_ID;
  if (!token || !chatId) return Promise.resolve(false);

  const payload = JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 7000,
    }, (tgRes) => {
      tgRes.resume();
      tgRes.on('end', () => resolve(tgRes.statusCode >= 200 && tgRes.statusCode < 300));
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.write(payload);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  await ensureAuthTables();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { message: 'Метод не поддерживается.' });
  }

  const user = await getUserBySession(req);
  const body = await readJson(req);

  const subject = clean(body.subject, 120);
  const message = clean(body.message, 2000);
  const contact = clean(body.contact, 120);
  const telegramUsername = clean(body.telegramUsername || body.telegram, 64).replace(/^@+/, '');

  if (subject.length < 3) return sendJson(res, 400, { message: 'Укажи тему обращения.' });
  if (message.length < 10) return sendJson(res, 400, { message: 'Опиши проблему подробнее.' });
  if (!user && !contact && !telegramUsername) {
    return sendJson(res, 400, { message: 'Для ответа оставь Telegram или другой контакт.' });
  }

  const result = await query(
    `INSERT INTO pd_support_tickets
     (user_id, username, contact, telegram_username, subject, message, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')
     RETURNING id, created_at;`,
    [user?.id || null, user?.username || clean(body.username, 16) || null, contact || null, telegramUsername || null, subject, message]
  );

  const ticket = result.rows[0];
  const ticketId = Number(ticket.id);
  const tgSent = await sendTelegramMessage(
    `<b>🛠 Новое обращение #${ticketId}</b>\n` +
    `<b>Игрок:</b> ${escapeTelegram(user?.username || clean(body.username, 16) || 'Гость')}\n` +
    `<b>Telegram:</b> ${telegramUsername ? '@' + escapeTelegram(telegramUsername) : 'не указан'}\n` +
    `<b>Контакт:</b> ${escapeTelegram(contact || 'не указан')}\n` +
    `<b>Тема:</b> ${escapeTelegram(subject)}\n\n` +
    `${escapeTelegram(message)}`
  );

  return sendJson(res, 200, {
    ok: true,
    ticketId,
    telegramSent: tgSent,
    message: tgSent
      ? 'Обращение отправлено администрации.'
      : 'Обращение сохранено. Telegram-бот не настроен или временно недоступен.',
  });
};
