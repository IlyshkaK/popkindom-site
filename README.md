# PopkinDom VPS Backend

Это замена старого Vercel-адаптера на нормальный Express backend для VPS.

## Что внутри

- `server.js` — новый основной сервер.
- `backend/index.js` — регистрация API-маршрутов.
- `backend/lib/*` — общие модули БД, cookie, сессий, admin utils.
- `backend/routes/*` — разделенные API-маршруты:
  - `auth`
  - `account`
  - `top`
  - `admin`
  - `system`

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
```

`/api/me` без входа должен вернуть `401 Не авторизован.` — это нормально.

## Важное изменение

`backend/lib/http.js` исправляет старую проблему: `readJson(req)` теперь сначала берет `req.body`,
который уже распарсил Express. Из-за этого регистрация и вход больше не теряют JSON-тело запроса.
