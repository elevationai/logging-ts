/**
 * Tests for sprintf-style formatting with lazy evaluation
 */

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { attachHandler, detachHandler, getLogger, lazyError, lazyHex } from "../mod.ts";
import { BaseHandler, type LogRecord } from "@std/log";

/**
 * Mock handler that captures log messages for testing
 */
class MockHandler extends BaseHandler {
  messages: string[] = [];

  override handle(logRecord: LogRecord): void {
    // Capture the raw message before formatting
    this.messages.push(logRecord.msg);
  }

  override log(_msg: string): void {
    // Required by BaseHandler but we don't use it
  }

  clear(): void {
    this.messages = [];
  }

  getLastMessage(): string | undefined {
    return this.messages[this.messages.length - 1];
  }
}

Deno.test("format methods exist on logger", () => {
  const logger = getLogger();
  assertExists(logger.debug);
  assertExists(logger.info);
  assertExists(logger.warn);
  assertExists(logger.error);
  assertExists(logger.critical);
  assertEquals(typeof logger.debug, "function");
  assertEquals(typeof logger.info, "function");
  assertEquals(typeof logger.warn, "function");
  assertEquals(typeof logger.error, "function");
  assertEquals(typeof logger.critical, "function");
});

Deno.test("info formats string correctly", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  logger.info("Hello %s", "world");
  assertEquals(mockHandler.getLastMessage(), "Hello world");

  logger.info("User %s has ID %d", "john", 123);
  assertEquals(mockHandler.getLastMessage(), "User john has ID 123");

  detachHandler(undefined, mockHandler);
});

Deno.test("info formats various types", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  // Use INFO level since default logger filters out DEBUG
  logger.info("String: %s", "test");
  assertEquals(mockHandler.getLastMessage(), "String: test");

  logger.info("Integer: %d", 42);
  assertEquals(mockHandler.getLastMessage(), "Integer: 42");

  logger.info("Float: %.2f", 3.14159);
  assertEquals(mockHandler.getLastMessage(), "Float: 3.14");

  logger.info("Hex: %x", 255);
  assertEquals(mockHandler.getLastMessage(), "Hex: ff");

  logger.info("Octal: %o", 8);
  assertEquals(mockHandler.getLastMessage(), "Octal: 10");

  detachHandler(undefined, mockHandler);
});

Deno.test("warn formats correctly", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  logger.warn("Warning: %s at line %d", "syntax error", 42);
  assertEquals(mockHandler.getLastMessage(), "Warning: syntax error at line 42");

  detachHandler(undefined, mockHandler);
});

Deno.test("error formats correctly", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  logger.error("Error code: %d - %s", 404, "Not Found");
  assertEquals(mockHandler.getLastMessage(), "Error code: 404 - Not Found");

  detachHandler(undefined, mockHandler);
});

Deno.test("critical formats correctly", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  logger.critical("Critical failure in %s: %s", "database", "connection lost");
  assertEquals(mockHandler.getLastMessage(), "Critical failure in database: connection lost");

  detachHandler(undefined, mockHandler);
});

Deno.test("format methods handle multiple arguments", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  logger.info("User %s (ID: %d) logged in from %s at %s", "alice", 456, "192.168.1.1", "2024-01-01");
  assertEquals(mockHandler.getLastMessage(), "User alice (ID: 456) logged in from 192.168.1.1 at 2024-01-01");

  detachHandler(undefined, mockHandler);
});

Deno.test("format methods work with zero format args", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  logger.info("Plain message with no formatting");
  assertEquals(mockHandler.getLastMessage(), "Plain message with no formatting");

  logger.info("Another plain message");
  assertEquals(mockHandler.getLastMessage(), "Another plain message");

  detachHandler(undefined, mockHandler);
});

Deno.test("lazy evaluation: sprintf not called when level disabled", () => {
  // All handlers are at INFO level, so DEBUG messages won't be logged.
  // The lazy evaluation checks handler levels to skip formatting when no handler will accept.
  const mockHandler = new MockHandler("INFO");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const initialCount = mockHandler.messages.length;

  // This should return immediately without calling sprintf or the underlying log method
  // No handler accepts DEBUG level, so nothing should be logged
  logger.debug("Debug message that won't be logged: %s %d %f", "test", 123, 3.14);

  // Verify no new message was logged
  assertEquals(mockHandler.messages.length, initialCount, "No message should be logged when DEBUG level is disabled");

  detachHandler(undefined, mockHandler);
});

Deno.test("lazy evaluation: function IS called when level enabled", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  let callCount = 0;
  const expensiveFunction = () => {
    callCount++;
    return "expensive result";
  };

  // INFO level should be enabled by default, so the function should be called
  logger.info("Info message: %s", expensiveFunction());

  // Verify the expensive function WAS called
  assertEquals(callCount, 1, "Expensive function should be called when INFO level is enabled");
  assertEquals(mockHandler.getLastMessage(), "Info message: expensive result");

  detachHandler(undefined, mockHandler);
});

Deno.test("error handling: invalid format specifier falls back gracefully", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  // Invalid format specifier - should fall back to passing args through
  logger.info("Invalid: %q", "test");

  // The message should still be logged, either with fallback behavior or the original
  assertExists(mockHandler.getLastMessage());

  detachHandler(undefined, mockHandler);
});

Deno.test("error handling: mismatched argument type", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  // Type mismatch - sprintf should handle this or fall back gracefully
  logger.info("Number: %d", "not a number");

  // Should still produce some output
  assertExists(mockHandler.getLastMessage());

  detachHandler(undefined, mockHandler);
});

Deno.test("format methods work with unconfigured logger", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger("unconfigured-module-name");

  // Should fall back to default logger
  assertExists(logger.debug);
  assertExists(logger.info);

  attachHandler("unconfigured-module-name", mockHandler);

  logger.info("Test message: %s", "working");
  assertEquals(mockHandler.getLastMessage(), "Test message: working");

  detachHandler("unconfigured-module-name", mockHandler);
});

Deno.test("all format methods produce correct output", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  // Skip debug since default logger has INFO level
  logger.info("Info: %s", "message");
  assertEquals(mockHandler.getLastMessage(), "Info: message");

  logger.warn("Warn: %s", "message");
  assertEquals(mockHandler.getLastMessage(), "Warn: message");

  logger.error("Error: %s", "message");
  assertEquals(mockHandler.getLastMessage(), "Error: message");

  logger.critical("Critical: %s", "message");
  assertEquals(mockHandler.getLastMessage(), "Critical: message");

  detachHandler(undefined, mockHandler);
});

Deno.test("format with empty string", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  logger.info("");
  assertEquals(mockHandler.getLastMessage(), "");

  detachHandler(undefined, mockHandler);
});

Deno.test("format with special characters", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  logger.info("Path: %s", "/home/user/file.txt");
  assertEquals(mockHandler.getLastMessage(), "Path: /home/user/file.txt");

  logger.info("Email: %s", "user@example.com");
  assertEquals(mockHandler.getLastMessage(), "Email: user@example.com");

  logger.info("JSON: %s", '{"key": "value"}');
  assertEquals(mockHandler.getLastMessage(), 'JSON: {"key": "value"}');

  detachHandler(undefined, mockHandler);
});

Deno.test("format with percentage escape", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  logger.info("Progress: 50%% complete");
  // sprintf keeps %% as-is when there are no format arguments
  assertEquals(mockHandler.getLastMessage(), "Progress: 50%% complete");

  detachHandler(undefined, mockHandler);
});

Deno.test("uppercase hex formatting", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  logger.info("Address: 0x%X", 255);
  assertEquals(mockHandler.getLastMessage(), "Address: 0xFF");

  detachHandler(undefined, mockHandler);
});

Deno.test("binary formatting", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  logger.info("Binary: %b", 5);
  assertEquals(mockHandler.getLastMessage(), "Binary: 101");

  detachHandler(undefined, mockHandler);
});

// Tests for lazy function argument evaluation
Deno.test("lazy evaluation: function argument is called when level enabled", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  let callCount = 0;
  const lazyValue = () => {
    callCount++;
    return "lazy result";
  };

  // INFO level is enabled, so the function should be called
  logger.info("Result: %s", lazyValue);

  assertEquals(callCount, 1, "Function should be called when level is enabled");
  assertEquals(mockHandler.getLastMessage(), "Result: lazy result");

  detachHandler(undefined, mockHandler);
});

Deno.test("lazy evaluation: function argument is NOT called when level disabled", () => {
  const mockHandler = new MockHandler("INFO");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  let callCount = 0;
  const expensiveComputation = () => {
    callCount++;
    return "expensive result";
  };

  const initialCount = mockHandler.messages.length;

  // No handler accepts DEBUG level, so function should NOT be called
  logger.debug("Debug: %s", expensiveComputation);

  assertEquals(callCount, 0, "Function should NOT be called when level is disabled");
  assertEquals(mockHandler.messages.length, initialCount, "No message should be logged");

  detachHandler(undefined, mockHandler);
});

Deno.test("lazy evaluation: mixed function and non-function arguments", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  let callCount = 0;
  const lazyName = () => {
    callCount++;
    return "Alice";
  };

  // Mix of direct value and function
  logger.info("User %s has ID %d", lazyName, 123);

  assertEquals(callCount, 1, "Function argument should be called");
  assertEquals(mockHandler.getLastMessage(), "User Alice has ID 123");

  detachHandler(undefined, mockHandler);
});

Deno.test("lazy evaluation: multiple function arguments", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  let call1 = 0, call2 = 0, call3 = 0;
  const getName = () => {
    call1++;
    return "Bob";
  };
  const getAge = () => {
    call2++;
    return 30;
  };
  const getCity = () => {
    call3++;
    return "NYC";
  };

  logger.info("%s is %d years old from %s", getName, getAge, getCity);

  assertEquals(call1, 1, "First function should be called once");
  assertEquals(call2, 1, "Second function should be called once");
  assertEquals(call3, 1, "Third function should be called once");
  assertEquals(mockHandler.getLastMessage(), "Bob is 30 years old from NYC");

  detachHandler(undefined, mockHandler);
});

Deno.test("lazy evaluation: function returning object with JSON format", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  let callCount = 0;
  const getData = () => {
    callCount++;
    return { name: "test", value: 42 };
  };

  logger.info("Data: %j", getData);

  assertEquals(callCount, 1, "Function should be called");
  assertEquals(mockHandler.getLastMessage(), 'Data: {"name":"test","value":42}');

  detachHandler(undefined, mockHandler);
});

Deno.test("lazy evaluation: function that throws is handled gracefully", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);
  mockHandler.clear();

  const throwingFn = () => {
    throw new Error("Intentional test error");
  };

  // Should not throw, should log gracefully with error placeholder
  logger.info("Result: %s", throwingFn);

  // Should have logged 2 messages: the error (via logger.error) and the info message
  assertEquals(mockHandler.messages.length, 2);
  assertEquals(mockHandler.messages[0], "Error evaluating lazy argument: Intentional test error");
  assertEquals(mockHandler.messages[1], "Result: [error evaluating lazy argument]");

  detachHandler(undefined, mockHandler);
});

// Tests for lazyHex
Deno.test("lazyHex: converts Uint8Array to hex string with default space delimiter", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
  logger.info("Bytes: %s", lazyHex(bytes));

  assertEquals(mockHandler.getLastMessage(), "Bytes: de ad be ef");

  detachHandler(undefined, mockHandler);
});

Deno.test("lazyHex: converts ArrayBuffer to hex string", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const buffer = new ArrayBuffer(4);
  new Uint8Array(buffer).set([0xca, 0xfe, 0xba, 0xbe]);
  logger.info("Buffer: %s", lazyHex(buffer));

  assertEquals(mockHandler.getLastMessage(), "Buffer: ca fe ba be");

  detachHandler(undefined, mockHandler);
});

Deno.test("lazyHex: converts number array to hex string", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const bytes = [0x01, 0x02, 0x03, 0x04];
  logger.info("Numbers: %s", lazyHex(bytes));

  assertEquals(mockHandler.getLastMessage(), "Numbers: 01 02 03 04");

  detachHandler(undefined, mockHandler);
});

Deno.test("lazyHex: empty delimiter produces compact output", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
  logger.info("Compact: %s", lazyHex(bytes, ""));

  assertEquals(mockHandler.getLastMessage(), "Compact: deadbeef");

  detachHandler(undefined, mockHandler);
});

Deno.test("lazyHex: custom delimiter", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
  logger.info("Colon: %s", lazyHex(bytes, ":"));

  assertEquals(mockHandler.getLastMessage(), "Colon: de:ad:be:ef");

  detachHandler(undefined, mockHandler);
});

Deno.test("lazyHex: maxBytes truncates output", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
  logger.info("Truncated: %s", lazyHex(bytes, " ", 4));

  assertEquals(mockHandler.getLastMessage(), "Truncated: 01 02 03 04 ... [4 more bytes]");

  detachHandler(undefined, mockHandler);
});

Deno.test("lazyHex: maxBytes with empty delimiter", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
  logger.info("Compact truncated: %s", lazyHex(bytes, "", 3));

  assertEquals(mockHandler.getLastMessage(), "Compact truncated: 010203... [3 more bytes]");

  detachHandler(undefined, mockHandler);
});

Deno.test("lazyHex: is not called when log level disabled", () => {
  const mockHandler = new MockHandler("INFO");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  let callCount = 0;
  const bytes = new Uint8Array([0xde, 0xad]);

  // Wrap lazyHex in a function that counts calls
  const trackedLazyHex = () => {
    callCount++;
    return lazyHex(bytes)();
  };

  const initialCount = mockHandler.messages.length;

  // No handler accepts DEBUG level
  logger.debug("Debug bytes: %s", trackedLazyHex);

  assertEquals(callCount, 0, "lazyHex should not be called when level is disabled");
  assertEquals(mockHandler.messages.length, initialCount);

  detachHandler(undefined, mockHandler);
});

Deno.test("lazyHex: handles empty array", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const bytes = new Uint8Array([]);
  logger.info("Empty: %s", lazyHex(bytes));

  assertEquals(mockHandler.getLastMessage(), "Empty: ");

  detachHandler(undefined, mockHandler);
});

// Tests for lazyError
Deno.test("lazyError: formats Error with stack trace", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();
  attachHandler(undefined, mockHandler);

  const error = new Error("test error");
  logger.info("caught: %s", lazyError(error));

  const msg = mockHandler.getLastMessage()!;
  assertStringIncludes(msg, "caught: Error: test error");
  assertStringIncludes(msg, "at "); // has stack trace

  detachHandler(undefined, mockHandler);
});

Deno.test("lazyError: formats Error without stack", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();
  attachHandler(undefined, mockHandler);

  const error = new Error("no stack");
  error.stack = undefined;
  logger.info("caught: %s", lazyError(error));

  assertEquals(mockHandler.getLastMessage(), "caught: Error: no stack");

  detachHandler(undefined, mockHandler);
});

Deno.test("lazyError: formats non-Error values", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();
  attachHandler(undefined, mockHandler);

  logger.info("string: %s", lazyError("oops"));
  assertEquals(mockHandler.getLastMessage(), "string: Non-Error exception: oops");

  logger.info("number: %s", lazyError(42));
  assertEquals(mockHandler.getLastMessage(), "number: Non-Error exception: 42");

  logger.info("null: %s", lazyError(null));
  assertEquals(mockHandler.getLastMessage(), "null: Non-Error exception: null");

  detachHandler(undefined, mockHandler);
});

Deno.test("lazyError: is not called when log level disabled", () => {
  const mockHandler = new MockHandler("INFO");
  const logger = getLogger();
  attachHandler(undefined, mockHandler);

  let callCount = 0;
  const trackedLazyError = () => {
    callCount++;
    return lazyError(new Error("test"))();
  };

  const initialCount = mockHandler.messages.length;
  logger.debug("Debug error: %s", trackedLazyError); // No handler accepts DEBUG level

  assertEquals(callCount, 0, "lazyError should not be called when level is disabled");
  assertEquals(mockHandler.messages.length, initialCount);

  detachHandler(undefined, mockHandler);
});

// Test for BigInt handling in %j format
Deno.test("format %j: handles BigInt values in objects", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const objWithBigInt = {
    name: "test",
    count: 9007199254740993n, // BigInt that exceeds Number.MAX_SAFE_INTEGER
    nested: {
      value: 123n,
    },
  };

  logger.info("Data: %j", objWithBigInt);

  const msg = mockHandler.getLastMessage()!;
  // Should serialize successfully with BigInt converted to string representation
  assertStringIncludes(msg, "Data:");
  assertStringIncludes(msg, '"name":"test"');
  assertStringIncludes(msg, "9007199254740993"); // BigInt value should appear
  assertStringIncludes(msg, "123"); // Nested BigInt should appear

  detachHandler(undefined, mockHandler);
});

Deno.test("format %j: handles circular references", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  // deno-lint-ignore no-explicit-any
  const circular: any = { name: "root", value: 42 };
  circular.self = circular;

  logger.info("Circular: %j", circular);

  const msg = mockHandler.getLastMessage()!;
  // Should serialize successfully with circular ref replaced
  assertStringIncludes(msg, "Circular:");
  assertStringIncludes(msg, '"name":"root"');
  assertStringIncludes(msg, '"value":42');
  assertStringIncludes(msg, "[Circular]"); // Circular reference marker

  detachHandler(undefined, mockHandler);
});

Deno.test("format %j: handles nested circular references", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  // deno-lint-ignore no-explicit-any
  const obj: any = {
    level1: {
      level2: {
        value: "deep",
      },
    },
  };
  obj.level1.level2.backToRoot = obj;
  obj.level1.level2.backToLevel1 = obj.level1;

  logger.info("Nested circular: %j", obj);

  const msg = mockHandler.getLastMessage()!;
  assertStringIncludes(msg, "Nested circular:");
  assertStringIncludes(msg, '"value":"deep"');
  assertStringIncludes(msg, "[Circular]");

  detachHandler(undefined, mockHandler);
});

Deno.test("format %j: handles object with throwing toJSON", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const badObj = {
    name: "test",
    toJSON() {
      throw new Error("toJSON exploded");
    },
  };

  logger.info("Bad toJSON: %j", badObj);

  const msg = mockHandler.getLastMessage()!;
  // Should handle gracefully - either serialize what it can or show an error marker
  assertStringIncludes(msg, "Bad toJSON:");
  // The message should not be the raw format string
  assertEquals(msg.includes("%j"), false, "Should not contain raw %j format specifier");

  detachHandler(undefined, mockHandler);
});

// Tests for %h/%H (byte hex formatting)
Deno.test("format %h: formats Uint8Array as lowercase hex", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
  logger.info("Bytes: %h", bytes);

  assertEquals(mockHandler.getLastMessage(), "Bytes: deadbeef");

  detachHandler(undefined, mockHandler);
});

Deno.test("format %H: formats Uint8Array as uppercase hex", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
  logger.info("Bytes: %H", bytes);

  assertEquals(mockHandler.getLastMessage(), "Bytes: DEADBEEF");

  detachHandler(undefined, mockHandler);
});

Deno.test("format % h: formats with space delimiter", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
  logger.info("Bytes: % h", bytes);

  assertEquals(mockHandler.getLastMessage(), "Bytes: de ad be ef");

  detachHandler(undefined, mockHandler);
});

Deno.test("format %.4h: truncates to precision bytes", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
  logger.info("Truncated: %.4h", bytes);

  assertEquals(mockHandler.getLastMessage(), "Truncated: 01020304... [4 more bytes]");

  detachHandler(undefined, mockHandler);
});

Deno.test("format %h: formats ArrayBuffer", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const buffer = new ArrayBuffer(4);
  new Uint8Array(buffer).set([0xca, 0xfe, 0xba, 0xbe]);
  logger.info("Buffer: %h", buffer);

  assertEquals(mockHandler.getLastMessage(), "Buffer: cafebabe");

  detachHandler(undefined, mockHandler);
});

Deno.test("format %h: formats number array", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const bytes = [0x01, 0x02, 0x03, 0x04];
  logger.info("Numbers: %h", bytes);

  assertEquals(mockHandler.getLastMessage(), "Numbers: 01020304");

  detachHandler(undefined, mockHandler);
});

// Tests for %w (error formatting)
Deno.test("format %w: formats Error with stack trace", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const error = new Error("test error");
  logger.info("caught: %w", error);

  const msg = mockHandler.getLastMessage()!;
  assertStringIncludes(msg, "caught: Error: test error");
  assertStringIncludes(msg, "at "); // has stack trace

  detachHandler(undefined, mockHandler);
});

Deno.test("format %w: formats Error without stack", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const error = new Error("no stack");
  error.stack = undefined;
  logger.info("caught: %w", error);

  assertEquals(mockHandler.getLastMessage(), "caught: Error: no stack");

  detachHandler(undefined, mockHandler);
});

Deno.test("format %w: formats non-Error values", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  logger.info("string: %w", "oops");
  assertEquals(mockHandler.getLastMessage(), "string: Non-Error exception: oops");

  logger.info("number: %w", 42);
  assertEquals(mockHandler.getLastMessage(), "number: Non-Error exception: 42");

  logger.info("null: %w", null);
  assertEquals(mockHandler.getLastMessage(), "null: Non-Error exception: null");

  detachHandler(undefined, mockHandler);
});

// Test that lazy evaluation still works with new sprintf integration
Deno.test("sprintf lazy evaluation: function is called during formatting", () => {
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  let callCount = 0;
  const lazyValue = () => {
    callCount++;
    return "lazy result";
  };

  logger.info("Value: %s", lazyValue);

  assertEquals(callCount, 1, "Function should be called during sprintf");
  assertEquals(mockHandler.getLastMessage(), "Value: lazy result");

  detachHandler(undefined, mockHandler);
});
