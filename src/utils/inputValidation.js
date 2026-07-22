const { AppError } = require('./errorResponder');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 1_000_000;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function parseBoundedInteger(value, name, { min, max }) {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^\d+$/.test(text.trim())) {
    throw new AppError(`${name} must be an integer`, 400);
  }
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new AppError(`${name} must be between ${min} and ${max}`, 400);
  }
  return parsed;
}

function parsePagePagination(
  query = {},
  { defaultLimit = DEFAULT_PAGE_SIZE, maxLimit = MAX_PAGE_SIZE } = {},
) {
  const page = parseBoundedInteger(query.page ?? 1, 'page', {
    min: 1,
    max: MAX_OFFSET,
  });
  const limit = parseBoundedInteger(query.limit ?? defaultLimit, 'limit', {
    min: 1,
    max: maxLimit,
  });
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(offset) || offset > MAX_OFFSET) {
    throw new AppError(`pagination offset cannot exceed ${MAX_OFFSET}`, 400);
  }
  return { page, limit, offset };
}

function parseOffsetPagination(
  query = {},
  { defaultLimit = 50, maxLimit = MAX_PAGE_SIZE } = {},
) {
  const limit = parseBoundedInteger(query.limit ?? defaultLimit, 'limit', {
    min: 1,
    max: maxLimit,
  });
  const offset = parseBoundedInteger(query.offset ?? 0, 'offset', {
    min: 0,
    max: MAX_OFFSET,
  });
  return { limit, offset };
}

module.exports = {
  normalizeEmail,
  parsePagePagination,
  parseOffsetPagination,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
};
