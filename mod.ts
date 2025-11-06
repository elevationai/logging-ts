/**
 * Centralized logging system for CUSS2 applications
 *
 * This library provides a flexible logging system with support for:
 * - Console and file logging
 * - Module-specific configurations
 * - Dynamic handler attachment/detachment
 * - Configurable formatting and log levels
 *
 * @module
 */

export { attachHandler, detachHandler, type ExtendedLogger, getConfiguredLoggers, getLogger } from "./src/logger.ts";

export type { ConsoleConfig, FileConfig, FormatConfig, LoggingConfig, ModuleConfig } from "./src/types.ts";
