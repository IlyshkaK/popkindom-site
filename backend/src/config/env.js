require('dotenv').config({ path: '/opt/popkindom/config/.env' });

const env = {
  nodeEnv: process.env.NODE_ENV || 'production',
  port: Number(process.env.BACKEND_PORT || 3020),
  databaseUrl: process.env.DATABASE_URL,
  sessionSecret: process.env.SESSION_SECRET,
};

if (!env.databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

if (!env.sessionSecret) {
  throw new Error('SESSION_SECRET is not set');
}

module.exports = env;
