const pool = require("./pool");

async function checkDatabase() {
  const result = await pool.query("SELECT NOW() AS now");
  console.log("[DB] Connected:", result.rows[0].now);
}

module.exports = checkDatabase;
