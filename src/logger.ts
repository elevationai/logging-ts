/**
 * Centralized logger for the CUSS2 libs
 * Automatically loads config from ./configs/logging.jsonc on first use
 */

import {
  type BaseHandler,
  ConsoleHandler,
  FileHandler,
  getLevelName,
  getLogger as getStdLogger,
  type LevelName,
  type Logger,
  type LogLevel,
  LogLevels,
  type LogRecord,
  setup,
} from "@std/log";
import { sprintf } from "@std/fmt/printf";
import type { LoggingConfig } from "./types.ts";
import { parse } from "@std/jsonc";
import { dirname, join, resolve } from "@std/path";

// Track if logger has been configured
let isConfigured = false;

// Store configured logger module names
let configuredModules: string[] = [];

/**
 * Load logging config from file synchronously
 */
function loadLoggingConfigSync(): LoggingConfig | undefined {
  try {
    const fullPath = resolve("./configs/logging.jsonc");
    const text = Deno.readTextFileSync(fullPath);
    return parse(text) as unknown as LoggingConfig;
  }
  catch {
    // File doesn't exist or can't be read - that's ok, use defaults
    return undefined;
  }
}

function formatTimestamp(format: string): string {
  const now = new Date();
  switch (format) {
    case "ISO":
      return now.toISOString();
    case "UTC":
      return now.toUTCString();
    case "LOCAL":
      return now.toLocaleString();
    case "UNIX":
      return String(Math.floor(now.getTime() / 1000));
    case "SHORT": {
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const seconds = now.getSeconds().toString().padStart(2, "0");
      return `${hours}:${minutes}:${seconds}`;
    }
    default:
      return now.toISOString();
  }
}

function formatLevel(level: number, config: { format?: { levelFormat?: string } }): string {
  const levelName = getLevelName(level as LogLevel);

  if (config.format?.levelFormat === "short") {
    switch (levelName) {
      case "DEBUG":
        return "D";
      case "INFO":
        return "I";
      case "WARN":
        return "W";
      case "ERROR":
        return "E";
      case "CRITICAL":
        return "C";
      default:
        return levelName.charAt(0);
    }
  }

  return levelName;
}

function getLevelColor(level: number): string {
  if (level >= LogLevels.ERROR) return "\x1b[31m"; // Red
  if (level >= LogLevels.WARN) return "\x1b[33m"; // Yellow
  if (level >= LogLevels.INFO) return "\x1b[36m"; // Cyan
  return "\x1b[90m"; // Gray for DEBUG
}

function resetColor(): string {
  return "\x1b[0m";
}

/**
 * Ensures the parent directory exists for a given file path
 */
function ensureDirectoryExists(filePath: string): void {
  const dir = dirname(filePath);
  try {
    Deno.mkdirSync(dir, { recursive: true });
  }
  catch (error) {
    // Ignore error if directory already exists
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }
}

// Extended logger interface with sprintf formatting support
export interface ExtendedLogger extends Omit<Logger, "debug" | "info" | "warn" | "error" | "critical"> {
  warning: (msg: string, ...args: unknown[]) => void;
  exception: (error: Error | unknown) => void;
  // Override base methods to support optional sprintf formatting
  debug: (msg: string, ...args: unknown[]) => void;
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
  critical: (msg: string, ...args: unknown[]) => void;
}

/** Resolve function arguments - calls any functions to get their values (lazy evaluation) */
function resolveArgs(args: unknown[], logError: (msg: string) => void): unknown[] {
  return args.map((arg) => {
    if (typeof arg !== "function") return arg;
    try {
      return arg();
    }
    catch (error) {
      logError(`Error evaluating lazy argument: ${error instanceof Error ? error.message : String(error)}`);
      return "[error evaluating lazy argument]";
    }
  });
}

/** Format an error for logging */
function formatError(error: Error | unknown): string {
  if (error instanceof Error) return error.stack || `${error.name}: ${error.message}`;
  return `Non-Error exception: ${String(error)}`;
}

/** Create a logger method with lazy sprintf evaluation */
function createLogMethod(logger: Logger, level: LogLevel): (msg: string, ...args: unknown[]) => void {
  const methodName = getLevelName(level).toLowerCase() as "debug" | "info" | "warn" | "error" | "critical";
  const logMethod = logger[methodName].bind(logger); // Capture before it gets wrapped

  return (msg: string, ...args: unknown[]): void => {
    if (logger.level > level) return; // Disabled level

    if (args.length === 0) {
      logMethod(msg);
      return;
    }

    const resolvedArgs = resolveArgs(args, (errMsg) => logger.error(errMsg));
    try {
      logMethod(sprintf(msg, ...resolvedArgs));
    }
    catch {
      logMethod(msg, ...resolvedArgs); // sprintf failed, pass args through
    }
  };
}

/** Create an exception logging method with lazy evaluation */
function createExceptionMethod(logger: Logger): (error: Error | unknown) => void {
  return (error: Error | unknown): void => {
    if (logger.level > LogLevels.ERROR) return;
    logger.error(formatError(error));
  };
}

/**
 * Get a logger instance with sprintf support
 * @param name Optional logger name for module-specific configuration
 */
export function getLogger(name?: string): ExtendedLogger {
  // Auto-setup if not configured yet
  if (!isConfigured) {
    setupLoggerSync();
  }

  const logger = getStdLogger(name);

  // If logger has no handlers (unconfigured name), use default logger instead
  if (logger.handlers.length === 0) {
    const defaultLogger = getStdLogger();
    return wrapLogger(defaultLogger);
  }

  return wrapLogger(logger);
}

/**
 * Wrap a logger with sprintf and lazy evaluation support
 */
function wrapLogger(logger: Logger): ExtendedLogger {
  const extLogger = logger as unknown as ExtendedLogger;

  extLogger.debug = createLogMethod(logger, LogLevels.DEBUG);
  extLogger.info = createLogMethod(logger, LogLevels.INFO);
  extLogger.warn = createLogMethod(logger, LogLevels.WARN);
  extLogger.error = createLogMethod(logger, LogLevels.ERROR);
  extLogger.critical = createLogMethod(logger, LogLevels.CRITICAL);
  extLogger.warning = extLogger.warn;
  extLogger.exception = createExceptionMethod(logger);

  return extLogger;
}

/**
 * Get list of configured logger module names
 * @returns Array of configured module names, or empty array if no custom modules configured
 */
export function getConfiguredLoggers(): string[] {
  // Auto-setup if not configured yet
  if (!isConfigured) {
    setupLoggerSync();
  }
  return [...configuredModules]; // Return copy to prevent modification
}

/**
 * Dynamically attach a handler to a logger
 * Useful for streaming logs to SSE clients or adding temporary handlers
 * @param loggerName Logger name (or undefined for default logger)
 * @param handler Handler instance to attach
 */
export function attachHandler(loggerName: string | undefined, handler: BaseHandler): void {
  // Auto-setup if not configured yet
  if (!isConfigured) {
    setupLoggerSync();
  }

  const logger = getStdLogger(loggerName);

  // If this logger has no handlers, it's unconfigured - use default instead
  // This ensures SSE attaches to the same logger that getLogger() returns
  if (logger.handlers.length === 0) {
    const defaultLogger = getStdLogger();
    defaultLogger.handlers.push(handler);
  }
  else {
    logger.handlers.push(handler);
  }
}

/**
 * Dynamically detach a handler from a logger
 * @param loggerName Logger name (or undefined for default logger)
 * @param handler Handler instance to detach
 */
export function detachHandler(loggerName: string | undefined, handler: BaseHandler): void {
  let logger = getStdLogger(loggerName);

  // If this logger has no handlers, it was unconfigured - handler was attached to default instead
  if (logger.handlers.length === 0) {
    logger = getStdLogger();
  }

  const index = logger.handlers.indexOf(handler);
  if (index !== -1) {
    logger.handlers.splice(index, 1);
  }
}

/**
 * Synchronous logger setup - loads config from ./configs/logging.jsonc or uses defaults
 */
function setupLoggerSync() {
  if (isConfigured) {
    return;
  }

  const finalConfig = loadLoggingConfigSync();

  const loggingConfig = finalConfig?.logging || {
    console: {
      enabled: true,
      level: "DEBUG",
      colorized: true,
      includeTimestamp: true,
      timestampFormat: "ISO",
    },
  };

  const handlers: Record<string, BaseHandler> = {};

  // Default console and file configs (used as fallbacks)
  const defaultConsoleConfig = loggingConfig.console || { enabled: true, level: "DEBUG" };
  const defaultFileConfig = loggingConfig.file;

  // Create console formatter function
  const createConsoleFormatter = (consoleConfig: typeof defaultConsoleConfig) => (logRecord: LogRecord) => {
    let output = "";

    // Add timestamp if configured
    if (consoleConfig.includeTimestamp !== false) {
      const timestamp = formatTimestamp(consoleConfig.timestampFormat || "ISO");
      output += `${timestamp} `;
    }

    // Add colored level if configured
    const level = formatLevel(logRecord.level as number, loggingConfig);
    if (consoleConfig.colorized !== false) {
      const levelColor = getLevelColor(logRecord.level);
      output += `${levelColor}[${level}]${resetColor()} `;
    }
    else {
      output += `[${level}] `;
    }

    // Add logger name if configured
    if (loggingConfig.format?.includeLoggerName !== false && logRecord.loggerName) {
      output += `${logRecord.loggerName}: `;
    }

    // Add message
    output += logRecord.msg;

    return output;
  };

  // Create file formatter function
  const createFileFormatter = () => (logRecord: LogRecord) => {
    const timestamp = formatTimestamp("ISO");
    const level = formatLevel(logRecord.level as number, loggingConfig);
    let output = `${timestamp} [${level}]`;

    if (logRecord.loggerName) {
      output += ` ${logRecord.loggerName}:`;
    }

    output += ` ${logRecord.msg}`;
    return output;
  };

  // Setup default console handler if enabled
  if (defaultConsoleConfig.enabled !== false) {
    handlers.console = new ConsoleHandler((defaultConsoleConfig.level as LevelName) || "DEBUG", {
      formatter: createConsoleFormatter(defaultConsoleConfig),
    });
  }

  // Setup default file handler if configured and enabled
  if (defaultFileConfig && defaultFileConfig.enabled !== false) {
    const dir = defaultFileConfig.dir || "./logs";
    const filename = defaultFileConfig.filename || "app.log";
    const filePath = join(dir, filename);
    ensureDirectoryExists(filePath);
    handlers.file = new FileHandler((defaultFileConfig.level as LevelName) || "DEBUG", {
      filename: filePath,
      mode: defaultFileConfig.mode || "a",
      formatter: createFileFormatter(),
      bufferSize: 0, // Immediate writes without buffering
    });
  }

  // Setup loggers with module-specific configurations
  const loggers: Record<string, { level: LevelName; handlers: string[] }> = {
    default: {
      level: "INFO" as LevelName,
      handlers: Object.keys(handlers),
    },
  };

  // Add module-specific loggers if configured
  if (loggingConfig.modules) {
    // Store configured module names
    configuredModules = Object.keys(loggingConfig.modules);

    for (const [module, config] of Object.entries(loggingConfig.modules)) {
      const moduleHandlers: string[] = [];
      let minLevel: LevelName = "DEBUG";

      // Handle module-specific console config
      if (config.console) {
        const consoleEnabled = config.console.enabled !== false;
        if (consoleEnabled) {
          const handlerName = `console_${module}`;
          const consoleLevel = (config.console.level as LevelName) || "DEBUG";
          const consoleConfig = { ...defaultConsoleConfig, ...config.console };

          handlers[handlerName] = new ConsoleHandler(consoleLevel, {
            formatter: createConsoleFormatter(consoleConfig),
          });
          moduleHandlers.push(handlerName);

          // Track minimum level
          if (LogLevels[consoleLevel] < LogLevels[minLevel]) {
            minLevel = consoleLevel;
          }
        }
      }
      else if (handlers.console) {
        // Use default console handler
        moduleHandlers.push("console");
      }

      // Handle module-specific file config
      if (config.file) {
        const fileEnabled = config.file.enabled !== false;
        if (fileEnabled) {
          const handlerName = `file_${module}`;
          const fileLevel = (config.file.level as LevelName) || "DEBUG";
          const dir = config.file.dir || "./logs";
          const filename = config.file.filename || `${module}.log`;
          const filePath = join(dir, filename);
          const fileMode = config.file.mode || "a";

          ensureDirectoryExists(filePath);
          handlers[handlerName] = new FileHandler(fileLevel, {
            filename: filePath,
            mode: fileMode,
            formatter: createFileFormatter(),
            bufferSize: 0, // Immediate writes without buffering
          });
          moduleHandlers.push(handlerName);

          // Track minimum level
          if (LogLevels[fileLevel] < LogLevels[minLevel]) {
            minLevel = fileLevel;
          }
        }
      }
      else if (handlers.file) {
        // Use default file handler
        moduleHandlers.push("file");
      }

      loggers[module] = {
        level: minLevel,
        handlers: moduleHandlers,
      };
    }
  }

  setup({
    handlers,
    loggers,
  });

  isConfigured = true;
}

/** Valid byte array types for hex conversion */
export type ByteArrayLike = Uint8Array | ArrayBuffer | number[];

/** Convert byte array to hex string */
function toHex(data: ByteArrayLike, delimiter: string, maxBytes?: number): string {
  if (!data) {
    throw new TypeError(`Invalid hex formatter argument: expected Uint8Array, ArrayBuffer, or number[], got ${data}`);
  }

  let bytes: Uint8Array;
  try {
    if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
    else if (Array.isArray(data)) bytes = new Uint8Array(data);
    else if (data instanceof Uint8Array) bytes = data;
    else throw new TypeError(`Invalid hex formatter argument: expected Uint8Array, ArrayBuffer, or number[], got ${typeof data}`);
  }
  catch (error) {
    if (error instanceof TypeError) throw error;
    throw new TypeError(`Failed to convert argument to Uint8Array: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (maxBytes !== undefined && bytes.length > maxBytes) {
    const truncated = Array.from(bytes.slice(0, maxBytes)).map((b) => b.toString(16).padStart(2, "0")).join(delimiter);
    return `${truncated}${delimiter}... [${bytes.length - maxBytes} more bytes]`;
  }

  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(delimiter);
}

/**
 * Create a lazy hex formatter for byte arrays.
 * Returns a function that converts bytes to hex only when called.
 * Use with the logger's lazy evaluation feature to avoid formatting
 * bytes when the log level is disabled.
 *
 * @example
 * ```typescript
 * import { getLogger, lazyHex } from "@eai/logging-ts";
 *
 * const logger = getLogger();
 * const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
 *
 * // Only converts to hex if DEBUG level is enabled (space-delimited by default)
 * logger.debug("Received bytes: %s", lazyHex(bytes));
 * // Output: "de ad be ef"
 *
 * // Compact format (no delimiter)
 * logger.debug("Compact: %s", lazyHex(bytes, ""));
 * // Output: "deadbeef"
 *
 * // Truncate large buffers
 * logger.debug("First 16: %s", lazyHex(largeBuffer, " ", 16));
 * // Output: "01 02 03 ... [984 more bytes]"
 * ```
 *
 * @param data Uint8Array, ArrayBuffer, or number array
 * @param delimiter String between bytes (defaults to single space)
 * @param maxBytes Maximum bytes to output before truncating (no limit by default)
 * @returns A function that returns the hex string when called
 */
export function lazyHex(data: ByteArrayLike, delimiter: string = " ", maxBytes?: number): () => string {
  return () => toHex(data, delimiter, maxBytes);
}

/**
 * Create a lazy error formatter. Returns a function that formats the error only when called.
 * Use with the logger's lazy evaluation feature to avoid formatting errors when the log level is disabled.
 *
 * @example
 * ```typescript
 * logger.debug("caught error: %s", lazyError(err));
 * logger.debug("with context: %s - %s", "operation failed", lazyError(err));
 * ```
 *
 * @param error The error to format (Error object or any value)
 * @returns A function that returns the formatted error string when called
 */
export function lazyError(error: Error | unknown): () => string {
  return () => formatError(error);
}
