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

### From JSR

```json
{
  "imports": {
    "@eai/logging-ts": "jsr:@eai/logging-ts@^1.0.0"
  }
}
```

### Local Development

```json
{
  "imports": {
    "@eai/logging-ts": "../logging-ts/mod.ts"
  }
}
```

## Quick Start

### Basic Usage

```typescript
import { getLogger } from "@eai/logging-ts";

const logger = getLogger();
logger.info("Application started");
logger.warn("This is a warning");
logger.error("An error occurred");
```

### Module-Specific Loggers

```typescript
import { getLogger } from "@eai/logging-ts";

const dbLogger = getLogger("database");
const apiLogger = getLogger("api");

dbLogger.info("Connected to database");
apiLogger.info("API server started on port 8080");
```

### sprintf Formatting

The logger supports printf/sprintf formatting with lazy evaluation for optimal performance:

```typescript
import { getLogger } from "logging-ts";

const logger = getLogger();

// Simple message (no formatting)
logger.info("Application started");

// String formatting
logger.info("User %s logged in", "john");

// Number formatting
logger.info("Processing %d items", 42);

// Float formatting
logger.info("Price: $%.2f", 19.99);

// Hex formatting
logger.debug("Memory address: 0x%x", 255);

// JSON formatting (automatic stringify)
logger.info("User data: %j", { name: "alice", id: 123 });

// Multiple arguments
logger.info("User %s (ID: %d) logged in from %s", "alice", 123, "192.168.1.1");
```

**Performance Benefits - Lazy Evaluation:**

All logger methods implement lazy evaluation - they check the log level BEFORE calling sprintf to format the string. This means if a log level is disabled, the sprintf processing is completely skipped:

```typescript
// Better: use %j formatter instead of JSON.stringify()
logger.debug("Complex data: %j", largeObject);

// Avoid: JSON.stringify is called even if DEBUG is disabled
logger.debug("Complex data: %s", JSON.stringify(largeObject));
```

**Important:** JavaScript evaluates function arguments before calling the function, so expensive operations like `JSON.stringify()` will execute even if the log level is disabled. Use the `%j` formatter instead, which only stringifies when the log level is enabled.

**Automatic Detection:**

The logger automatically detects when format arguments are provided:

- `logger.info("Simple message")` - No formatting, passes through directly
- `logger.info("User: %s", name)` - sprintf formatting applied
- `logger.info("Data:", obj)` - Falls back to standard behavior if sprintf fails

**Supported Format Specifiers:**

**Basic Types:**

- `%s` - String
- `%d` / `%i` - Integer
- `%f` - Float with decimal point (use `%.2f` for precision)
- `%e` / `%E` - Scientific notation (lowercase/uppercase)
- `%g` / `%G` - Adaptive float format (uses %e or %f based on magnitude)
- `%t` - Boolean (`true` or `false`)

**Number Bases:**

- `%b` - Binary
- `%o` - Octal
- `%x` / `%X` - Hexadecimal (lowercase/uppercase)

**Special Formatters:**

- `%j` - JSON stringify (useful for objects without manual JSON.stringify)
- `%v` - Default value format (calls `toString()`)
- `%T` - Type of value (via `typeof`)
- `%c` - Character from Unicode codepoint

**Other:**

- `%%` - Literal percent sign

For more details and advanced formatting options, see the [@std/fmt documentation](https://github.com/denoland/deno_std/blob/main/fmt/printf.ts).

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
import { attachHandler, getLogger } from "@eai/logging-ts";
import { ConsoleHandler } from "@std/log";

const customHandler = new ConsoleHandler("DEBUG");
attachHandler("api", customHandler);
```

### `detachHandler(loggerName: string | undefined, handler: BaseHandler): void`

Dynamically detach a handler from a logger.

```typescript
import { detachHandler } from "@eai/logging-ts";

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

The `ExtendedLogger` interface extends the standard logger with sprintf formatting:

### All Methods Support Optional Formatting

All logger methods accept optional format arguments:

```typescript
logger.debug(msg: string, ...args: unknown[]): void
logger.info(msg: string, ...args: unknown[]): void
logger.warn(msg: string, ...args: unknown[]): void
logger.error(msg: string, ...args: unknown[]): void
logger.critical(msg: string, ...args: unknown[]): void
```

### Compatibility Alias

```typescript
logger.warn("This is a warning");
logger.warning("This is also a warning"); // Same as warn()
```

**Key Features:**

- **Lazy Evaluation**: sprintf is only called if the log level is enabled
- **Automatic Detection**: Works with or without format arguments
- **Graceful Fallback**: Falls back to standard behavior if sprintf fails

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

MIT
