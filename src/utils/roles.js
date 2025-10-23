function parseRolesCsv(csv) {
  if (!csv) return [];
  return String(csv)
    .split(',')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
}

function serializeRolesCsv(roles) {
  if (!Array.isArray(roles)) return '';
  return roles
    .map((r) => String(r).trim())
    .filter(Boolean)
    .join(',');
}

module.exports = { parseRolesCsv, serializeRolesCsv };
