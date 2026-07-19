const ROLE_ALIASES = new Map([
  ['PLAYER', 'default'], ['PARTICIPANT', 'default'], ['DEFAULT', 'default'],
  ['MODERATOR', 'moderator'], ['ADMIN', 'admin'],
  ['OWNER', 'spec.admin'], ['SPEC.ADMIN', 'spec.admin'], ['SPEC_ADMIN', 'spec.admin'],
]);

function normalizeRole(value) {
  return ROLE_ALIASES.get(String(value || 'default').trim().toUpperCase()) || 'default';
}

function roleRank(value) {
  return { default: 1, moderator: 2, admin: 3, 'spec.admin': 4 }[normalizeRole(value)];
}

module.exports = { normalizeRole, roleRank };
