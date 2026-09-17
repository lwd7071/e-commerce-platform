const SENSITIVE_KEY_PATTERNS = [
  /^password$/i,
  /^otp$/i,
  /^secret$/i,
  /^token$/i,
  /^access_?token$/i,
  /^refresh_?token$/i,
  /^authorization$/i,
  /^cookie$/i,
  /^credit_?card$/i,
  /^pan$/i,
  /^cvv$/i,
  /^api_?key$/i,
  /^service_?role_?key$/i
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function redactSensitiveData<T>(obj: T, seen = new WeakSet()): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (seen.has(obj as object)) {
    return '[CIRCULAR]' as unknown as T;
  }
  seen.add(obj as object);

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item, seen)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitiveData(value, seen);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
