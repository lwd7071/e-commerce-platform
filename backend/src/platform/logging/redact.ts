const SENSITIVE_KEY_PATTERNS = [
  /^password$/i,
  /^passwd$/i,
  /^pass$/i,
  /^otp$/i,
  /^secret$/i,
  /^client_?secret$/i,
  /^token$/i,
  /^access_?token$/i,
  /^refresh_?token$/i,
  /^id_?token$/i,
  /^auth_?token$/i,
  /^authorization$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^credit_?card$/i,
  /^creditcard$/i,
  /^card_?number$/i,
  /^cardnumber$/i,
  /^pan$/i,
  /^cvv$/i,
  /^cvc$/i,
  /^security_?code$/i,
  /^api_?key$/i,
  /^apikey$/i,
  /^service_?role_?key$/i,
  /^private_?key$/i,
];

// Patterns for string sanitization
const URI_PASSWORD_REGEX = /(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/gi;
const JWT_REGEX = /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g;
const SUPABASE_KEY_REGEX = /\bsbp_[a-zA-Z0-9_-]{20,}\b/g;
const CARD_PAN_REGEX = /\b(?:\d{4}[ -]?){3}\d{1,7}\b/g;

export function sanitizeString(val: string): string {
  if (typeof val !== 'string') {
    return val;
  }

  let sanitized = val;

  // 1. Sanitize database connection string passwords
  sanitized = sanitized.replace(URI_PASSWORD_REGEX, '$1[REDACTED]$3');

  // 2. Sanitize JWT tokens
  sanitized = sanitized.replace(JWT_REGEX, '[REDACTED_JWT]');

  // 3. Sanitize Supabase keys
  sanitized = sanitized.replace(SUPABASE_KEY_REGEX, '[REDACTED_SECRET]');

  // 4. Sanitize payment card PANs (13-19 digits)
  sanitized = sanitized.replace(CARD_PAN_REGEX, (match) => {
    const digitsOnly = match.replace(/\D/g, '');
    if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
      return '[REDACTED_CARD]';
    }
    return match;
  });

  return sanitized;
}

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function redactSensitiveData<T>(obj: T, seen = new WeakSet()): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj) as unknown as T;
  }

  if (typeof obj !== 'object') {
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
    } else if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitiveData(value, seen);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
