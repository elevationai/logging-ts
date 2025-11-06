# Logging-TS

Centralized logging system for CUSS2 applications built with Deno.

## Overview

This library provides a flexible and configurable logging system with support for:

- Console and file logging
- Module-specific configurations
- Dynamic handler attachment/detachment for streaming logs
- Configurable formatting and log levels
- Automatic configuration loading from JSONC files
- Immediate flush file handler to prevent log loss on crashes

## Installation

### From GitHub (Raw URL)

```json
{
  "imports": {
    "logging-ts": "https://raw.githubusercontent.com/elevationai/logging-ts/v1.0.0/mod.ts"
  }
}
```

### Local Development

```json
{
  "imports": {
    "logging-ts": "../logging-ts/mod.ts"
  }
}
```

## Quick Start

### Basic Usage

```typescript
import { getLogger } from "logging-ts";

const logger = getLogger();
logger.info("Application started");
logger.warn("This is a warning");
logger.error("An error occurred");
```

### Module-Specific Loggers

```typescript
import { getLogger } from "logging-ts";

const dbLogger = getLogger("database");
const apiLogger = getLogger("api");

dbLogger.info("Connected to database");
apiLogger.info("API server started on port 8080");
```

## Configuration

The logger automatically loads configuration from `./configs/logging.jsonc` on first use. If the file doesn't exist, sensible defaults are used.

### Configuration File Example

Create a file at `./configs/logging.jsonc`:

```jsonc
{
  "logging": {
    // Default console configuration
    "console": {
      "enabled": true,
      "level": "DEBUG",
      "colorized": true,
      "includeTimestamp": true,
      "timestampFormat": "ISO" // Options: "ISO", "UTC", "LOCAL", "UNIX", "SHORT"
    },

    // Default file configuration
    "file": {
      "enabled": true,
      "level": "INFO",
      "dir": "./logs",
      "filename": "app.log",
      "mode": "a" // append mode
    },

    // Global format settings
    "format": {
      "levelFormat": "full", // Options: "full", "short" (D, I, W, E, C)
      "includeLoggerName": true
    },

    // Module-specific configurations
    "modules": {
      "database": {
        "console": {
          "enabled": true,
          "level": "DEBUG"
        },
        "file": {
          "enabled": true,
          "level": "DEBUG",
          "filename": "database.log"
        }
      },
      "api": {
        "console": {
          "enabled": true,
          "level": "INFO"
        },
        "file": {
          "enabled": true,
          "level": "WARN",
          "filename": "api.log"
        }
      }
    }
  }
}
```

## API Reference

### `getLogger(name?: string): ExtendedLogger`

Get a logger instance. If `name` is provided, returns a module-specific logger if configured, otherwise returns the default logger.

```typescript
const logger = getLogger(); // Default logger
const dbLogger = getLogger("database"); // Module-specific logger
```

### `getConfiguredLoggers(): string[]`

Get a list of all configured module names.

```typescript
const modules = getConfiguredLoggers();
console.log(modules); // ["database", "api"]
```

### `attachHandler(loggerName: string | undefined, handler: BaseHandler): void`

Dynamically attach a handler to a logger. Useful for streaming logs to SSE clients or adding temporary handlers.

```typescript
import { attachHandler, getLogger } from "logging-ts";
import { ConsoleHandler } from "@std/log";

const customHandler = new ConsoleHandler("DEBUG");
attachHandler("api", customHandler);
```

### `detachHandler(loggerName: string | undefined, handler: BaseHandler): void`

Dynamically detach a handler from a logger.

```typescript
import { detachHandler } from "logging-ts";

detachHandler("api", customHandler);
```

## Log Levels

The following log levels are supported (from lowest to highest priority):

- `DEBUG` - Detailed information for debugging
- `INFO` - General informational messages
- `WARN` - Warning messages for potentially harmful situations
- `ERROR` - Error messages for error events
- `CRITICAL` - Critical messages for severe error events

## Extended Logger

The `ExtendedLogger` interface includes an additional `warning()` method as an alias for `warn()` for compatibility:

```typescript
logger.warn("This is a warning");
logger.warning("This is also a warning"); // Same as warn()
```

## Features

### Immediate Flush File Handler

The library includes a custom `ImmediateFlushFileHandler` that flushes logs immediately after each write. This is crucial for critical logs that need to be written before crashes.

### Automatic Directory Creation

Log directories are automatically created if they don't exist.

### Configurable Formatting

Customize timestamp formats, level formats (full or short), and whether to include logger names.

### Color-Coded Console Output

Console logs are color-coded by level:

- DEBUG: Gray
- INFO: Cyan
- WARN: Yellow
- ERROR/CRITICAL: Red

## Development

### Running Tests

```bash
deno task test
```

### Formatting Code

```bash
deno fmt
```

### Linting

```bash
deno lint
```

## TypeScript Types

The library exports the following TypeScript types:

- `ExtendedLogger` - Logger interface with warning method
- `LoggingConfig` - Complete configuration structure
- `ConsoleConfig` - Console handler configuration
- `FileConfig` - File handler configuration
- `FormatConfig` - Formatting configuration
- `ModuleConfig` - Module-specific configuration

## License

UNLICENSED - Private/Proprietary
