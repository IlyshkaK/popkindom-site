const { query, ensureAuthTables } = require('./_lib/db');
const { sendJson, methodNotAllowed } = require('./_lib/http');
const { getUserBySession, publicUser } = require('./_lib/security');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  await ensureAuthTables();

  try {
    const user = await getUserBySession(req);

    if (!user) {
      return sendJson(res, 401, { message: 'Не авторизован.' });
    }

    const playerResult = await query(
      `SELECT * FROM players WHERE auth_user_id = $1 ORDER BY updated_at DESC LIMIT 1;`,
      [user.id]
    );

    const statsResult = await query(
      `SELECT * FROM player_stats WHERE auth_user_id = $1 ORDER BY updated_at DESC LIMIT 1;`,
      [user.id]
    );

    const blocksResult = await query(
      `SELECT block_type, amount, updated_at
       FROM player_blocks
       WHERE auth_user_id = $1
       ORDER BY amount DESC
       LIMIT 12;`,
      [user.id]
    );

    const craftsResult = await query(
      `SELECT item_type, amount, updated_at
       FROM player_crafts
       WHERE auth_user_id = $1
       ORDER BY amount DESC
       LIMIT 12;`,
      [user.id]
    );

    const enchantmentsResult = await query(
      `SELECT levels_spent, enchant_count, updated_at
       FROM player_enchantments
       WHERE auth_user_id = $1
       ORDER BY updated_at DESC
       LIMIT 1;`,
      [user.id]
    );

    const inventoryResult = await query(
      `SELECT inventory_json, armor_json, offhand_json, ender_chest_json, updated_at
       FROM player_inventory
       WHERE auth_user_id = $1
       ORDER BY updated_at DESC
       LIMIT 1;`,
      [user.id]
    );

    const onlineResult = await query(
      `SELECT nickname, online, updated_at
       FROM players
       ORDER BY online DESC, updated_at DESC
       LIMIT 8;`
    );

    const logsResult = await query(
      `SELECT action, details, ip_address, created_at
       FROM pd_security_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20;`,
      [user.id]
    );

    return sendJson(res, 200, {
      user: {
        ...publicUser(user),
        autoLoginEnabled: user.auto_login_enabled !== false,
      },
      player: playerResult.rows[0] || null,
      stats: statsResult.rows[0] || null,
      blocks: blocksResult.rows,
      crafts: craftsResult.rows,
      enchantments: enchantmentsResult.rows[0] || null,
      inventory: inventoryResult.rows[0] || null,
      onlinePlayers: onlineResult.rows,
      securityLogs: logsResult.rows,
    });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Ошибка получения аккаунта.' });
  }
};
