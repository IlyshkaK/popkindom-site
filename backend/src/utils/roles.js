const ROLES = Object.freeze({
  DEFAULT: "default",
  MODERATOR: "moderator",
  ADMIN: "admin",
  SPEC_ADMIN: "spec.admin",
});

const ROLE_RANKS = Object.freeze({
  [ROLES.DEFAULT]: 0,
  [ROLES.MODERATOR]: 1,
  [ROLES.ADMIN]: 2,
  [ROLES.SPEC_ADMIN]: 3,
});

const ROLE_ALIASES = new Map([
  ["DEFAULT", ROLES.DEFAULT], ["PLAYER", ROLES.DEFAULT],
  ["PARTICIPANT", ROLES.DEFAULT], ["УЧАСТНИК", ROLES.DEFAULT], ["ИГРОК", ROLES.DEFAULT],
  ["MODERATOR", ROLES.MODERATOR], ["МОДЕР", ROLES.MODERATOR], ["МОДЕРАТОР", ROLES.MODERATOR],
  ["ADMIN", ROLES.ADMIN], ["АДМИН", ROLES.ADMIN], ["АДМИНИСТРАТОР", ROLES.ADMIN],
  ["SPEC.ADMIN", ROLES.SPEC_ADMIN], ["SPEC_ADMIN", ROLES.SPEC_ADMIN], ["OWNER", ROLES.SPEC_ADMIN],
  ["СПЕЦ.АДМИН", ROLES.SPEC_ADMIN], ["СПЕЦ. АДМИН", ROLES.SPEC_ADMIN], ["ВЛАДЕЛЕЦ", ROLES.SPEC_ADMIN],
]);

function parseRole(value) {
  return ROLE_ALIASES.get(String(value || "").trim().toUpperCase()) || null;
}

function normalizeRole(value) {
  return parseRole(value) || ROLES.DEFAULT;
}

function roleRank(value) {
  return ROLE_RANKS[normalizeRole(value)];
}

function hasRoleAtLeast(value, minimumRole) {
  return roleRank(value) >= roleRank(minimumRole);
}

module.exports = { ROLES, parseRole, normalizeRole, roleRank, hasRoleAtLeast };
