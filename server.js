require('dotenv').config({ path: '/opt/popkindom/config/.env' });

const express = require('express');
const fs = require('fs');
const path = require('path');
const { registerBackendRoutes } = require('./backend');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SITE_ROOT = __dirname;

app.disable('x-powered-by');
app.set('trust proxy', true);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-App', 'PopkinDom Craft');
  next();
});

registerBackendRoutes(app);

function resolveHtmlFile(requestPath) {
  const cleanPath = decodeURIComponent(requestPath.split('?')[0]);
  const normalized = path.posix.normalize(cleanPath).replace(/^\/+/, '');
  const candidates = [];

  if (!normalized || normalized === '.') {
    candidates.push('index.html');
  } else if (normalized.endsWith('.html')) {
    candidates.push(normalized);
  } else if (!path.extname(normalized)) {
    candidates.push(`${normalized}.html`);
  }

  for (const candidate of candidates) {
    const absolutePath = path.resolve(SITE_ROOT, candidate);
    if (!absolutePath.startsWith(`${SITE_ROOT}${path.sep}`) && absolutePath !== path.join(SITE_ROOT, 'index.html')) {
      continue;
    }
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      return absolutePath;
    }
  }

  return null;
}

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const htmlFile = resolveHtmlFile(req.path);
  if (!htmlFile) return next();

  fs.readFile(htmlFile, 'utf8', (error, html) => {
    if (error) return next(error);
    res.type('html').send(html);
  });
});

app.use(express.static(SITE_ROOT, {
  extensions: ['html'],
  index: 'index.html',
}));

app.use((req, res, next) => {
  const indexFile = path.join(SITE_ROOT, 'index.html');
  fs.readFile(indexFile, 'utf8', (error, html) => {
    if (error) return next(error);
    res.type('html').send(html);
  });
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
