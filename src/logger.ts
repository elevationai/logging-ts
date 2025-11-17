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

// ===== Hex Formatter Utilities =====

/**
 * Convert byte array to compact hex string (no spaces)
 * @param data Uint8Array, ArrayBuffer, or number array
 * @param maxBytes Optional maximum bytes to output (truncates if exceeded, no limit by default)
 * @returns Hex string like "deadbeef"
 */
function toHexCompact(data: Uint8Array | ArrayBuffer | number[], maxBytes?: number): string {
  if (!data) return String(data); // Handle null/undefined

  try {
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : Array.isArray(data) ? new Uint8Array(data) : data;

    // Truncate if maxBytes specified and exceeded
    if (maxBytes !== undefined && bytes.length > maxBytes) {
      const truncated = Array.from(bytes.slice(0, maxBytes))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return `${truncated}... [truncated, ${bytes.length - maxBytes} more bytes]`;
    }

    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  catch {
    // Fallback for wrong types
    return String(data);
  }
}

/**
 * Convert byte array to spaced hex string (with spaces for readability)
 * @param data Uint8Array, ArrayBuffer, or number array
 * @param maxBytes Optional maximum bytes to output (truncates if exceeded, no limit by default)
 * @returns Hex string like "de ad be ef"
 */
function toHexSpaced(data: Uint8Array | ArrayBuffer | number[], maxBytes?: number): string {
  if (!data) return String(data);

  try {
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : Array.isArray(data) ? new Uint8Array(data) : data;

    // Truncate if maxBytes specified and exceeded
    if (maxBytes !== undefined && bytes.length > maxBytes) {
      const truncated = Array.from(bytes.slice(0, maxBytes))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
      return `${truncated} ... [truncated, ${bytes.length - maxBytes} more bytes]`;
    }

    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
  }
  catch {
    return String(data);
  }
}

// Cached regex for performance
const HEX_FORMAT_REGEX = /%([-+0 #]*)(\d+|\*)?(?:\.(\d+|\*))?([hH])/g;

/**
 * Preprocess format string to convert %h/%H to %s with hex-converted args
 * Supports optional precision parameter to control truncation:
 * - %h or %H: No truncation (full data)
 * - %.100h or %.100H: Truncate at 100 bytes
 * - %.1024h or %.1024H: Truncate at 1024 bytes
 * @param msg Format string potentially containing %h or %H
 * @param args Arguments to format
 * @returns Tuple of [processed format string, processed args]
 */
function preprocessHexFormatters(msg: string, args: unknown[]): [string, unknown[]] {
  // Fast path: skip if no hex formatters present (check for 'h' or 'H' after %)
  if (!msg.includes("h") && !msg.includes("H")) {
    return [msg, args];
  }

  const processedArgs: unknown[] = [];
  let argIndex = 0;

  const processedMsg = msg.replace(HEX_FORMAT_REGEX, (match, flags, width, precision, specifier) => {
    if (argIndex >= args.length) {
      // Not enough args provided
      return match;
    }

    const arg = args[argIndex++];

    // Parse precision as max bytes (undefined = no limit)
    const maxBytes = precision ? parseInt(precision, 10) : undefined;

    // Handle type checking and conversion
    let hexString: string;
    try {
      hexString = specifier === "h"
        ? toHexCompact(arg as Uint8Array | ArrayBuffer | number[], maxBytes)
        : toHexSpaced(arg as Uint8Array | ArrayBuffer | number[], maxBytes);
    }
    catch {
      // Fallback for wrong types
      hexString = String(arg);
    }

    processedArgs.push(hexString);

    // Replace with %s, preserving any flags/width (but NOT precision since we used it)
    const flagStr = flags || "";
    const widthStr = width || "";
    return `%${flagStr}${widthStr}s`;
  });

  // Add any remaining args that weren't consumed by hex formatters
  processedArgs.push(...args.slice(argIndex));

  return [processedMsg, processedArgs];
}

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

<<<<<<< HEAD
/**
 * Extended logger interface with Python-style sprintf formatting support
 * Includes custom hex formatters for binary data logging
 */
=======
// Extended logger interface with sprintf formatting support
>>>>>>> bug/overflow
export interface ExtendedLogger extends Omit<Logger, "debug" | "info" | "warn" | "error" | "critical"> {
  /**
   * Alias for warn() for compatibility
   */
  warning: (msg: string, ...args: unknown[]) => void;

  /**
   * Log debug message with sprintf-style formatting
   * @param msg Format string supporting:
   *   - Standard: %s (string), %d (number), %f (float), %x (hex number)
   *   - Custom: %h (compact hex), %H (spaced hex) - no truncation by default
   *   - Precision: %.100h or %.100H truncates at 100 bytes
   * @param args Values to format. Hex formatters (%h,%H) accept Uint8Array|ArrayBuffer|number[]
   * @example
   *   logger.debug("Data: %h", new Uint8Array([0xde, 0xad, 0xbe, 0xef])); // "Data: deadbeef" (full data)
   *   logger.debug("Data: %H", new Uint8Array([0xde, 0xad])); // "Data: de ad" (full data)
   *   logger.debug("Data: %.100h", largeBuffer); // Truncates at 100 bytes
   *   logger.debug("Buffer %h has %d bytes", buffer, buffer.length); // Mixed formatters
   */
  debug: (msg: string, ...args: unknown[]) => void;

  /**
   * Log info message with sprintf-style formatting
   * @param msg Format string supporting:
   *   - Standard: %s (string), %d (number), %f (float), %x (hex number)
   *   - Custom: %h (compact hex), %H (spaced hex) - no truncation by default
   *   - Precision: %.100h or %.100H truncates at 100 bytes
   * @param args Values to format. Hex formatters (%h,%H) accept Uint8Array|ArrayBuffer|number[]
   */
  info: (msg: string, ...args: unknown[]) => void;

  /**
   * Log warning message with sprintf-style formatting
   * @param msg Format string supporting:
   *   - Standard: %s (string), %d (number), %f (float), %x (hex number)
   *   - Custom: %h (compact hex), %H (spaced hex) - no truncation by default
   *   - Precision: %.100h or %.100H truncates at 100 bytes
   * @param args Values to format. Hex formatters (%h,%H) accept Uint8Array|ArrayBuffer|number[]
   */
  warn: (msg: string, ...args: unknown[]) => void;

  /**
   * Log error message with sprintf-style formatting
   * @param msg Format string supporting:
   *   - Standard: %s (string), %d (number), %f (float), %x (hex number)
   *   - Custom: %h (compact hex), %H (spaced hex) - no truncation by default
   *   - Precision: %.100h or %.100H truncates at 100 bytes
   * @param args Values to format. Hex formatters (%h,%H) accept Uint8Array|ArrayBuffer|number[]
   */
  error: (msg: string, ...args: unknown[]) => void;

  /**
   * Log critical message with sprintf-style formatting
   * @param msg Format string supporting:
   *   - Standard: %s (string), %d (number), %f (float), %x (hex number)
   *   - Custom: %h (compact hex), %H (spaced hex) - no truncation by default
   *   - Precision: %.100h or %.100H truncates at 100 bytes
   * @param args Values to format. Hex formatters (%h,%H) accept Uint8Array|ArrayBuffer|number[]
   */
  critical: (msg: string, ...args: unknown[]) => void;
}

/**
<<<<<<< HEAD
 * Create a Python-style logger method with lazy sprintf evaluation
 * Supports custom hex formatters: %h (compact) and %H (spaced)
=======
 * Create a logger method with lazy sprintf evaluation
>>>>>>> bug/overflow
 */
function createLogMethod(
  originalMethod: (msg: string, ...args: unknown[]) => void,
  level: LogLevel,
  loggerLevel: LogLevel,
): (msg: string, ...args: unknown[]) => void {
  return function (this: unknown, msg: string, ...args: unknown[]): void {
    // Early return if log level is disabled (lazy evaluation)
    if (loggerLevel > level) return;

    // If no args provided, call original method directly
    if (args.length === 0) {
      originalMethod.call(this, msg);
      return;
    }

    // Try sprintf formatting with args
    try {
      // Preprocess hex formatters (%h, %H) before sprintf
      const [processedMsg, processedArgs] = preprocessHexFormatters(msg, args);
      const formatted = sprintf(processedMsg, ...processedArgs);
      originalMethod.call(this, formatted);
    }
    catch (_err) {
      // If sprintf fails, fall back to original behavior (pass args through)
      originalMethod.call(this, msg, ...args);
    }
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

    // Store original methods
    const origDebug = defaultLogger.debug.bind(defaultLogger);
    const origInfo = defaultLogger.info.bind(defaultLogger);
    const origWarn = defaultLogger.warn.bind(defaultLogger);
    const origError = defaultLogger.error.bind(defaultLogger);
    const origCritical = defaultLogger.critical.bind(defaultLogger);

    // Create extended logger object
    const extLogger = defaultLogger as unknown as ExtendedLogger;

    // Replace methods with sprintf versions
    extLogger.debug = createLogMethod(origDebug, LogLevels.DEBUG, defaultLogger.level);
    extLogger.info = createLogMethod(origInfo, LogLevels.INFO, defaultLogger.level);
    extLogger.warn = createLogMethod(origWarn, LogLevels.WARN, defaultLogger.level);
    extLogger.error = createLogMethod(origError, LogLevels.ERROR, defaultLogger.level);
    extLogger.critical = createLogMethod(origCritical, LogLevels.CRITICAL, defaultLogger.level);
    extLogger.warning = extLogger.warn; // Alias for compatibility

    return extLogger;
  }

  // Store original methods
  const origDebug = logger.debug.bind(logger);
  const origInfo = logger.info.bind(logger);
  const origWarn = logger.warn.bind(logger);
  const origError = logger.error.bind(logger);
  const origCritical = logger.critical.bind(logger);

  // Create extended logger object
  const extLogger = logger as unknown as ExtendedLogger;

  // Replace methods with sprintf versions
  extLogger.debug = createLogMethod(origDebug, LogLevels.DEBUG, logger.level);
  extLogger.info = createLogMethod(origInfo, LogLevels.INFO, logger.level);
  extLogger.warn = createLogMethod(origWarn, LogLevels.WARN, logger.level);
  extLogger.error = createLogMethod(origError, LogLevels.ERROR, logger.level);
  extLogger.critical = createLogMethod(origCritical, LogLevels.CRITICAL, logger.level);
  extLogger.warning = extLogger.warn; // Alias for compatibility

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
