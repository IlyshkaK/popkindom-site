const topRepository = require("../repositories/topRepository");

const META = {
  playtime: ["Время в игре", "Топ игроков по общему времени в игре.", "ticks"],
  blocks: ["Сломано блоков", "Топ игроков по общему количеству добытых блоков.", "number"],
  mobs: ["Убийства мобов", "Топ игроков по количеству убитых мобов.", "number"],
  deaths: ["Смерти", "Топ игроков по количеству смертей.", "number"],
  damage_dealt: ["Нанесено урона", "Топ игроков по нанесённому урону.", "damage"],
  damage_taken: ["Получено урона", "Топ игроков по полученному урону.", "damage"],
  jumps: ["Прыжки", "Топ игроков по количеству прыжков.", "number"],
  crafts: ["Скрафчено предметов", "Топ игроков по общему количеству скрафченных предметов.", "number"],
  achievements: ["Достижения", "Топ игроков по количеству полученных достижений.", "number"],
  titles: ["Получено титулов", "Топ игроков по количеству полученных титулов.", "number"],
  enchants: ["Потрачено уровней", "Топ игроков по уровням, потраченным на зачарования.", "number"],
};

const CACHE = new Map();
const CACHE_MS = 30000;

function sanitizeRows(rows) {
  const used = new Set();

  return rows
    .map((row) => ({
      username: String(row.username || "Игрок"),
      value: Number(row.value || 0),
      activeTitleId: row.active_title_id || null,
      role: row.role || null,
    }))
    .filter((row) => row.value > 0)
    .filter((row) => {
      const key = row.username.toLowerCase();
      if (used.has(key)) return false;
      used.add(key);
      return true;
    });
}

async function getTop(categoryRaw) {
  const category = META[categoryRaw] ? categoryRaw : "playtime";
  const cached = CACHE.get(category);

  if (cached && Date.now() - cached.time < CACHE_MS) {
    return cached.payload;
  }

  const [label, description, format] = META[category];
  const rows = await topRepository.getTopRows(category);

  const payload = {
    category,
    label,
    description,
    format,
    players: sanitizeRows(rows),
  };

  CACHE.set(category, {
    time: Date.now(),
    payload,
  });

  return payload;
}

module.exports = {
  getTop,
};
