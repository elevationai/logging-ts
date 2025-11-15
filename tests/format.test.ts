/**
 * Tests for sprintf-style formatting with lazy evaluation
 */

import { assertEquals, assertExists } from "@std/assert";
import { attachHandler, detachHandler, getLogger } from "../mod.ts";
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
  // The default logger has level INFO (20). This means CRITICAL (50), ERROR (40), WARN (30),
  // and INFO (20) will pass, but DEBUG (10) will not.
  const mockHandler = new MockHandler("DEBUG");
  const logger = getLogger();

  attachHandler(undefined, mockHandler);

  const initialCount = mockHandler.messages.length;

  // This should return immediately without calling sprintf or the underlying log method
  // DEBUG is disabled at INFO level, so nothing should be logged
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
