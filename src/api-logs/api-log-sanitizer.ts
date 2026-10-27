const SENSITIVE_KEY = /password|token|authorization|cookie|secret|api.?key|credential/i;
const MAX_DEPTH = 8;
const MAX_JSON_LENGTH = 48_000;

export function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[MAX_DEPTH]';
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === 'string') {
    return value.length > 4_000 ? `${value.slice(0, 4_000)}[TRUNCATED]` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return { omitted: true, type: 'binary' };
  if (Array.isArray(value)) {
    return value.slice(0, 200).map((item) => sanitizeForLog(item, depth + 1));
  }
  if (typeof value !== 'object') return String(value);

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY.test(key)
      ? '[REDACTED]'
      : sanitizeForLog(child, depth + 1);
  }
  return result;
}

export function limitLogPayload(value: unknown): unknown {
  const sanitized = sanitizeForLog(value);
  let serialized: string;
  try {
    serialized = JSON.stringify(sanitized);
  } catch {
    return { omitted: true, reason: 'payload_not_serializable' };
  }
  if (serialized.length <= MAX_JSON_LENGTH) return sanitized;
  return {
    truncated: true,
    preview: serialized.slice(0, MAX_JSON_LENGTH),
  };
}
