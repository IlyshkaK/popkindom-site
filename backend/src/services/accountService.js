const accountRepository = require("../repositories/accountRepository");

function ticksToHours(ticks) {
  return Math.floor(Number(ticks || 0) / 20 / 60 / 60);
}

async function getAccount(userId) {
const [
  account,
  player,
  stats,
  blocks,
  crafts,
  enchantments,
  recentAchievements,
  achievementsCount,
  recentDeaths,
  onlinePlayers,
] = await Promise.all([
  accountRepository.findAccountById(userId),
  accountRepository.findPlayerByUserId(userId),
  accountRepository.findStatsByUserId(userId),
  accountRepository.findBlocksByUserId(userId),
  accountRepository.findCraftsByUserId(userId),
  accountRepository.findEnchantmentsByUserId(userId),
  accountRepository.findAdvancementsByUserId(userId),
  accountRepository.countAdvancementsByUserId(userId),
  accountRepository.findDeathHistoryByUserId(userId),
  accountRepository.findOnlinePlayers(),
]);

  if (!account) return null;

  const safePlayer = player || {};
  const safeStats = stats || {};

  const playerData = {
    uuid: safePlayer.uuid || null,
    nickname: safePlayer.nickname || account.nickname,
    username: safePlayer.nickname || account.nickname,

    online: safePlayer.online === true,

    first_join: safePlayer.first_join || null,
    first_join_at: safePlayer.first_join || null,
    last_join: safePlayer.last_join || null,
    last_login_at: safePlayer.last_join || account.last_server_login || null,

    play_time_ticks: safeStats.play_time_ticks || safePlayer.play_time_ticks || 0,
    deaths: safeStats.deaths || safePlayer.deaths || 0,
    mob_kills: safeStats.mob_kills || safePlayer.mob_kills || 0,

    xp_level: safePlayer.xp_level || 0,
    total_experience: safePlayer.total_experience || 0,
    exp_progress: safePlayer.exp_progress || 0,

    role: account.role,
  };

  const statsData = {
    play_time_ticks: safeStats.play_time_ticks || safePlayer.play_time_ticks || 0,
    playTimeTicks: safeStats.play_time_ticks || safePlayer.play_time_ticks || 0,

    deaths: safeStats.deaths || safePlayer.deaths || 0,
    mob_kills: safeStats.mob_kills || safePlayer.mob_kills || 0,
    mobKills: safeStats.mob_kills || safePlayer.mob_kills || 0,

    walk_distance: safeStats.walk_distance || 0,
    walkDistance: safeStats.walk_distance || 0,

    fly_distance: safeStats.fly_distance || 0,
    flyDistance: safeStats.fly_distance || 0,

    jump_count: safeStats.jump_count || 0,
    jumpCount: safeStats.jump_count || 0,

    damage_dealt: safeStats.damage_dealt || 0,
    damageDealt: safeStats.damage_dealt || 0,

    damage_taken: safeStats.damage_taken || 0,
    damageTaken: safeStats.damage_taken || 0,

    sleep_count: safeStats.sleep_count || 0,
    sleepCount: safeStats.sleep_count || 0,

    open_chest: safeStats.open_chest || 0,
    openChest: safeStats.open_chest || 0,

    updated_at: safeStats.updated_at || null,
    updatedAt: safeStats.updated_at || null,

    playTimeHours: ticksToHours(safeStats.play_time_ticks || safePlayer.play_time_ticks),
  };

  const userData = {
    id: account.id,
    username: account.nickname,
    nickname: account.nickname,
    role: account.role,

    registered_at: account.registered_at,
    registeredAt: account.registered_at,

    last_server_login: safePlayer.last_join || account.last_server_login,
    lastServerLogin: safePlayer.last_join || account.last_server_login,

    last_web_login: account.last_web_login,
    lastWebLogin: account.last_web_login,

    autoLoginEnabled: account.auto_login_enabled,
    adminPanelEnabled: account.admin_panel_enabled,
    hasPin: Boolean(account.pin_hash),
  };

  const securityData = {
    autoLoginEnabled: account.auto_login_enabled,
    adminPanelEnabled: account.admin_panel_enabled,
    pinEnabled: Boolean(account.pin_hash),
    hasPin: Boolean(account.pin_hash),
    lockedUntil: account.locked_until,
    pinLockedUntil: account.pin_locked_until,
  };

  return {
    user: userData,
    account: {
      id: account.id,
      nickname: account.nickname,
      username: account.nickname,
      role: account.role,
      registered_at: account.registered_at,
      registeredAt: account.registered_at,
      last_server_login: account.last_server_login,
      lastServerLogin: account.last_server_login,
      last_web_login: account.last_web_login,
      lastWebLogin: account.last_web_login,
    },
    player: playerData,
    stats: statsData,
    security: securityData,

blocks: blocks || [],
crafts: crafts || [],enchantments: enchantments
  ? {
      levels_spent: Number(enchantments.levels_spent || 0),
      enchant_count: Number(enchantments.enchant_count || 0),
      updated_at: enchantments.updated_at || null,
    }
  : {
      levels_spent: 0,
      enchant_count: 0,
      updated_at: null,
    },

recentDeaths: recentDeaths || [],
deathsHistory: recentDeaths || [],

recentAchievements: recentAchievements || [],
achievements: recentAchievements || [],

achievements_count: achievementsCount || 0,
achievementsCount: achievementsCount || 0,

onlinePlayers: onlinePlayers || [],
    meta: {
      updatedAt: statsData.updated_at || account.last_server_login || account.last_web_login || null,
    },
  };
}

module.exports = {
  getAccount,
};
