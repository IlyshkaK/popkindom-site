const { Pool } = require("pg");

require("dotenv").config({
  path: "/opt/popkindom/config/.env",
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true"
    ? { rejectUnauthorized: false }
    : false,
  max: Number(process.env.DB_POOL_MAX || 10),
});

pool.on("error", (err) => {
  console.error("[PostgreSQL]", err);
});

module.exports = pool;
