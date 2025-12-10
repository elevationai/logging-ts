/**
 * Logger configuration types for CUSS2 ecosystem
 */

import type { LevelName } from "@std/log";

export interface ModuleConfig {
  console?: ConsoleConfig;
  file?: FileConfig;
}

export interface LoggingConfig {
  console?: ConsoleConfig;
  file?: FileConfig;
  modules?: Record<string, ModuleConfig>;
  format?: FormatConfig;
}

/** @deprecated Old config format with nested "logging" key */
export interface LegacyLoggingConfig {
  logging: LoggingConfig;
}

export interface ConsoleConfig {
  enabled?: boolean; // Defaults to true if console config is present
  level?: LevelName | string; // Defaults to DEBUG
  colorized?: boolean;
  includeTimestamp?: boolean;
  timestampFormat?: "ISO" | "UTC" | "LOCAL" | "UNIX" | "SHORT";
}

export interface FileConfig {
  enabled?: boolean; // Defaults to true if file config is present
  level?: LevelName | string; // Defaults to DEBUG
  dir?: string; // Defaults to ./logs
  filename?: string; // Defaults to {module}.log
  maxBytes?: number;
  maxBackupCount?: number;
  mode?: "a" | "w" | "x"; // Defaults to "a" (append)
}

export interface FormatConfig {
  pattern?: string;
  levelFormat?: "full" | "short";
  includeLoggerName?: boolean;
}
