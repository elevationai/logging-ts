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

### Lazy Evaluation with Functions

For expensive computations, pass a function that returns the value. The function is only called if the log level is enabled:

```typescript
import { getLogger, lazyError, lazyHex } from "@eai/logging-ts";

const logger = getLogger();

// Function arguments are only called when the log level is enabled
logger.debug("expensive: %s", () => computeExpensiveValue());
logger.debug("user: %j", () => fetchUserDetails(userId));

// Multiple lazy arguments
logger.debug("%s processed %d items", () => getName(), () => countItems());
```

### `lazyHex` - Byte Array Formatting

Format byte arrays as hex strings, only when the log level is enabled:

```typescript
import { getLogger, lazyHex } from "@eai/logging-ts";

const logger = getLogger();
const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

// Space-delimited (default)
logger.debug("data: %s", lazyHex(bytes));
// Output: "de ad be ef"

// Compact (no delimiter)
logger.debug("compact: %s", lazyHex(bytes, ""));
// Output: "deadbeef"

// Custom delimiter
logger.debug("colons: %s", lazyHex(bytes, ":"));
// Output: "de:ad:be:ef"

// Truncate large buffers
logger.debug("first 16: %s", lazyHex(largeBuffer, " ", 16));
// Output: "01 02 03 04 ... [984 more bytes]"
```

Accepts `Uint8Array`, `ArrayBuffer`, or `number[]`.

### `lazyError` - Error Formatting

Format errors with stack traces, only when the log level is enabled:

```typescript
import { getLogger, lazyError } from "@eai/logging-ts";

const logger = getLogger();

try {
  riskyOperation();
}
catch (err) {
  // Full stack trace, but only formatted if DEBUG is enabled
  logger.debug("caught error: %s", lazyError(err));
}
```

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

- `%j` - JSON stringify (handles BigInt, circular refs, and throwing toJSON gracefully)
- `%h` / `%H` - Byte array as hex (lowercase/uppercase)
- `%w` - Error with stack trace
- `%v` - Default value format (calls `toString()`)
- `%T` - Type of value (via `typeof`)
- `%c` - Character from Unicode codepoint

**Other:**

- `%%` - Literal percent sign

### Type Validation for `%s`

The `%s` format specifier expects a string argument. If you pass a non-string type, the library will:

1. Log an error to the `logging-ts` logger with a suggestion for the correct format specifier
2. Output `%s:arg_not_a_string` as a placeholder in the message

```typescript
// Wrong: passing a number to %s
logger.info("Code: %s", 1006);
// Logs error: "%s format specifier received number instead of string: use %d for integers or %f for floats"
// Output: "Code: %s:arg_not_a_string"

// Wrong: passing an object to %s
logger.info("User: %s", { name: "john" });
// Logs error: "%s format specifier received object instead of string: use %j for JSON or %i for inspect"
// Output: "User: %s:arg_not_a_string"

// Correct usage:
logger.info("Code: %d", 1006); // For numbers
logger.info("User: %j", { name: "john" }); // For objects
logger.info("Active: %t", true); // For booleans
```

**Type-specific suggestions:**

| Type           | Suggestion                                   |
| -------------- | -------------------------------------------- |
| object/array   | `%j` for JSON or `%i` for inspect            |
| number/bigint  | `%d` for integers or `%f` for floats         |
| boolean        | `%t` for booleans                            |
| undefined/null | `%v` for default formatting                  |
| function       | Call the function first or use `%T` for type |

### `%h` / `%H` - Byte Array Hex Formatting

Format `Uint8Array`, `ArrayBuffer`, or `number[]` as hex strings:

```typescript
const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

// Compact (default)
logger.info("data: %h", bytes);
// Output: "deadbeef"

// Uppercase
logger.info("data: %H", bytes);
// Output: "DEADBEEF"

// Space-delimited (use space flag)
logger.info("data: % h", bytes);
// Output: "de ad be ef"

// Truncate to N bytes (use precision)
logger.info("data: %.4h", largeBuffer);
// Output: "01020304... [996 more bytes]"

// Combined: space-delimited + truncated
logger.info("data: % .4h", largeBuffer);
// Output: "01 02 03 04 ... [996 more bytes]"
```

### `%w` - Error Formatting

Format errors with full stack traces:

```typescript
try {
  riskyOperation();
}
catch (err) {
  // Full stack trace
  logger.error("caught: %w", err);
  // Output: "Error: something failed\n    at riskyOperation (file.ts:10:5)\n    ..."

  // Non-Error values are handled gracefully
  logger.error("caught: %w", "string error");
  // Output: "Non-Error exception: string error"
}
```

### `%j` - Safe JSON Formatting

The `%j` formatter handles edge cases that would normally cause `JSON.stringify` to fail:

```typescript
// BigInt values
logger.info("data: %j", { count: 9007199254740993n });
// Output: {"count":"[BigInt: 9007199254740993]"}

// Circular references
const obj = { name: "test" };
obj.self = obj;
logger.info("data: %j", obj);
// Output: {"name":"test","self":"[Circular]"}

// Objects with throwing toJSON
logger.info("data: %j", {
  toJSON() {
    throw new Error();
  },
});
// Output: [unserializable]
```

For more details on standard formatting options, see the [@std/fmt documentation](https://github.com/denoland/deno_std/blob/main/fmt/printf.ts).

## Configuration

The logger automatically loads configuration from `./configs/logging.jsonc` on first use. If the file doesn't exist, sensible defaults are used.

### Configuration File Example

Create a file at `./configs/logging.jsonc`:

```jsonc
{
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

## Internal Logging

The library uses its own logger named `logging-ts` for internal messages such as:

- Format specifier type mismatches (e.g., passing a number to `%s`)
- Errors during lazy argument evaluation
- JSON serialization failures

These messages appear separately from your application logs and are clearly identified by the `logging-ts` logger name:

```
14:57:12 [E] logging-ts: %s format specifier received number instead of string: use %d for integers or %f for floats
14:57:12 [I] MyModule: Closing connection - Code: %s:arg_not_a_string, Reason: done
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
