# PopkinDom VPS Backend

Это замена старого Vercel-адаптера на нормальный Express backend для VPS.

## Что внутри

- `server.js` - новый основной сервер.
- `backend/index.js` - регистрация API-маршрутов.
- `backend/lib/*` - общие модули БД, cookie, сессий, admin utils.
- `backend/routes/*` - разделенные API-маршруты:
  - `auth`
  - `account`
  - `top`
  - `admin`
  - `system`
  - `news`
  - `support`

## CMS-новости и тех. поддержка

Добавлены страницы:

- `/news` - публичная лента опубликованных новостей из CMS.
- `/support` - форма обращения в тех. поддержку.
- `/admin-news` - CMS для создания, редактирования, публикации и удаления новостей.
- `/admin-support` - панель обработки обращений поддержки.

Админские API:

- `/api/admin/news` - только `ADMIN` и `OWNER` после PIN-подтверждения в админ-панели.
- `/api/admin/support` - только `ADMIN` и `OWNER` после PIN-подтверждения в админ-панели.

Публичные API:

- `/api/news` - получает только опубликованные новости.
- `/api/support` - принимает обращение, сохраняет его в БД и отправляет уведомление в Telegram, если бот настроен.

Для Telegram-бота добавьте в `/opt/popkindom/config/.env`:

```env
TELEGRAM_BOT_TOKEN=токен_бота_от_BotFather
TELEGRAM_SUPPORT_CHAT_ID=id_чата_администрации
```

После изменения `.env` перезапустите сайт:

```bash
pm2 restart popkindom-site --update-env
```

## Установка на VPS

На VPS из папки сайта:

```bash
cd /opt/popkindom/site
cp -r backend backend.backup.before-new-api 2>/dev/null || true
cp server.js server.js.backup.before-new-api
```

Затем скопируй файлы из этого архива в `/opt/popkindom/site`.

Потом:

```bash
cd /opt/popkindom/site
npm install express dotenv pg bcryptjs
node -c server.js
find backend -name "*.js" -print0 | xargs -0 -n1 node -c
pm2 restart popkindom-site --update-env
pm2 logs popkindom-site --lines 50
```

## Проверка

```bash
curl https://popkindomcraft.ru/api/health
curl https://popkindomcraft.ru/api/top
curl -i https://popkindomcraft.ru/api/me
curl https://popkindomcraft.ru/api/news
```

`/api/me` без входа должен вернуть `401 Не авторизован.` - это нормально.

## Важное изменение

`backend/lib/http.js` исправляет старую проблему: `readJson(req)` теперь сначала берет `req.body`,
который уже распарсил Express. Из-за этого регистрация и вход больше не теряют JSON-тело запроса.
