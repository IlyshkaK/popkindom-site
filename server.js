require('dotenv').config({ path: '/opt/popkindom/config/.env' });

const express = require('express');
const path = require('path');
const { registerBackendRoutes } = require('./backend');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.set('trust proxy', true);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-App', 'PopkinDom Craft');
  next();
});

registerBackendRoutes(app);

app.use(express.static(__dirname, {
  extensions: ['html'],
  index: 'index.html',
}));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((error, req, res, next) => {
  console.error('[server]', error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    message: 'Внутренняя ошибка сервера.',
  });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`PopkinDom site started on http://127.0.0.1:${PORT}`);
});
