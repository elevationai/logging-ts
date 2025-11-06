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

/**
 * FileHandler that flushes immediately after each write
 * Used for critical logs like CORBA-bytes that need to be written before crashes
 */
class ImmediateFlushFileHandler extends FileHandler {
  override log(msg: string): void {
    super.log(msg);
    // Call the flush() method to write buffered logs immediately
    this.flush();
  }
}

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

// Extended logger interface to add warning method for compatibility
export interface ExtendedLogger extends Logger {
  warning: (msg: string, ...args: unknown[]) => void;
}

/**
 * Get a logger instance
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
    (defaultLogger as ExtendedLogger).warning = (msg: string, ...args: unknown[]) => defaultLogger.warn(msg, ...args);
    return defaultLogger as ExtendedLogger;
  }

  // Add warning as an alias for warn for compatibility
  (logger as ExtendedLogger).warning = (msg: string, ...args: unknown[]) => logger.warn(msg, ...args);
  return logger as ExtendedLogger;
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
    handlers.file = new ImmediateFlushFileHandler((defaultFileConfig.level as LevelName) || "DEBUG", {
      filename: filePath,
      mode: defaultFileConfig.mode || "a",
      formatter: createFileFormatter(),
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
          handlers[handlerName] = new ImmediateFlushFileHandler(fileLevel, {
            filename: filePath,
            mode: fileMode,
            formatter: createFileFormatter(),
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
