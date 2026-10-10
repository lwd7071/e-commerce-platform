import { redactSensitiveData, sanitizeString } from './redact.ts';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogContext {
  request_id?: string;
  method?: string;
  route?: string;
  status?: number;
  duration_ms?: number;
  user_id?: string;
  role?: string;
  error_code?: string | null;
  [key: string]: unknown;
}

export interface PlatformLogger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
}

export function createPlatformLogger(
  service = 'payload-api',
  outputWriter: (line: string) => void = (line) => process.stdout.write(line + '\n')
): PlatformLogger {
  function log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const cleanContext = context ? redactSensitiveData(context) : {};

    const logEntry = {
      timestamp,
      level,
      service,
      environment: process.env.NODE_ENV || 'development',
      message: sanitizeString(message),
      ...cleanContext
    };

    outputWriter(JSON.stringify(logEntry));
  }

  return {
    info: (msg, ctx) => log('info', msg, ctx),
    warn: (msg, ctx) => log('warn', msg, ctx),
    error: (msg, ctx) => log('error', msg, ctx),
    debug: (msg, ctx) => log('debug', msg, ctx)
  };
}

export const logger = createPlatformLogger();
