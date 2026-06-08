# PopkinDom Site для Vercel

Это версия сайта PopkinDom, переделанная под Vercel Serverless API.

## Что внутри

- HTML/CSS/JS лежат в корне проекта.
- API лежит в папке `api/`:
  - `POST /api/register`
  - `POST /api/login`
  - `POST /api/logout`
  - `GET /api/me`
- API работает с той же PostgreSQL/Supabase базой, что PopkinAuth и WebBridge.

## Переменные окружения для Vercel

В Vercel открой Project Settings → Environment Variables и добавь:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
COOKIE_NAME=pd_session
COOKIE_SECURE=true
SESSION_HOURS=48
BCRYPT_ROUNDS=12
```

Если не используешь `DATABASE_URL`, можно указать отдельно:

```env
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-password
DB_SSL=true
COOKIE_NAME=pd_session
COOKIE_SECURE=true
SESSION_HOURS=48
BCRYPT_ROUNDS=12
```

## Проверка

1. Залей проект на GitHub.
2. Импортируй репозиторий в Vercel.
3. Добавь переменные окружения.
4. Deploy.
5. Открой `https://твой-домен/register.html`.
6. Создай аккаунт.
7. Проверь, что в таблице `pd_users` появился пользователь.
8. Зайди на сервер Minecraft под этим ником — PopkinAuth должен попросить `/l пароль`.

## Важно

Minecraft-плагины PopkinAuth и WebBridge остаются на Minecraft-сервере. Vercel хранит только сайт и API, которые подключаются к общей базе.
