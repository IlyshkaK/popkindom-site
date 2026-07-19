const pool = require("./pool");

async function checkDatabase() {
  const result = await pool.query("SELECT NOW() AS now");
  await pool.query(`
    ALTER TABLE pd_users ALTER COLUMN role SET DEFAULT 'default';
    UPDATE pd_users
    SET role = CASE UPPER(TRIM(role))
      WHEN 'PLAYER' THEN 'default'
      WHEN 'PARTICIPANT' THEN 'default'
      WHEN 'DEFAULT' THEN 'default'
      WHEN 'MODERATOR' THEN 'moderator'
      WHEN 'ADMIN' THEN 'admin'
      WHEN 'OWNER' THEN 'spec.admin'
      WHEN 'SPEC_ADMIN' THEN 'spec.admin'
      WHEN 'SPEC.ADMIN' THEN 'spec.admin'
      ELSE 'default'
    END
    WHERE role IS NULL OR role NOT IN ('default', 'moderator', 'admin', 'spec.admin');
  `);
  console.log("[DB] Connected:", result.rows[0].now);
}

module.exports = checkDatabase;
