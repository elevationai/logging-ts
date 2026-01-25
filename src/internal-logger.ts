/**
 * Internal logging for the logging-ts library itself.
 * This module avoids circular dependencies by using a setter pattern.
 */

type LogFn = (message: string) => void;

let errorFn: LogFn = (message: string) => {
  // Fallback before logger is initialized
  console.error(`[logging-ts] ${message}`);
};

let warnFn: LogFn = (message: string) => {
  // Fallback before logger is initialized
  console.warn(`[logging-ts] ${message}`);
};

/**
 * Set the internal error function. Called by logger.ts after initialization.
 */
export function setInternalErrorFn(fn: LogFn): void {
  errorFn = fn;
}

/**
 * Set the internal warning function. Called by logger.ts after initialization.
 */
export function setInternalWarnFn(fn: LogFn): void {
  warnFn = fn;
}

/**
 * Log an internal library error (for developer mistakes like wrong format specifiers).
 */
export function internalError(message: string): void {
  errorFn(message);
}

/**
 * Log an internal library warning.
 */
export function internalWarn(message: string): void {
  warnFn(message);
}
