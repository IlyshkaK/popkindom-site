const express = require('express');

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function registerBackendRoutes(app) {
  app.get('/api/health', asyncRoute(require('./routes/system/health')));

  app.post('/api/login', asyncRoute(require('./routes/auth/login')));
  app.post('/api/register', asyncRoute(require('./routes/auth/register')));
  app.post('/api/logout', asyncRoute(require('./routes/auth/logout')));
  app.post('/api/logout-all', asyncRoute(require('./routes/auth/logout-all')));

  app.get('/api/me', asyncRoute(require('./routes/account/me')));
  app.post('/api/disable-autologin', asyncRoute(require('./routes/account/disable-autologin')));
  app.post('/api/security', asyncRoute(require('./routes/account/security')));

  app.get('/api/top', asyncRoute(require('./routes/top/top')));
  app.get('/api/news', asyncRoute(require('./routes/news/news')));

  app.all('/api/admin', asyncRoute(require('./routes/admin/admin')));

  app.use('/api', (req, res) => {
    res.status(404).json({ message: 'API route not found.' });
  });
}

module.exports = {
  registerBackendRoutes,
};
