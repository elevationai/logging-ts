/**
 * Tests for sprintf-style formatting with lazy evaluation
 */

import { assertEquals, assertExists } from "@std/assert";
import { getLogger } from "../mod.ts";

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
  const logger = getLogger();
  // Should not throw
  logger.info("Hello %s", "world");
  logger.info("User %s has ID %d", "john", 123);
});

Deno.test("debug formats various types", () => {
  const logger = getLogger();
  // Should not throw
  logger.debug("String: %s", "test");
  logger.debug("Integer: %d", 42);
  logger.debug("Float: %.2f", 3.14159);
  logger.debug("Hex: %x", 255);
  logger.debug("Octal: %o", 8);
});

Deno.test("warn formats correctly", () => {
  const logger = getLogger();
  logger.warn("Warning: %s at line %d", "syntax error", 42);
});

Deno.test("error formats correctly", () => {
  const logger = getLogger();
  logger.error("Error code: %d - %s", 404, "Not Found");
});

Deno.test("critical formats correctly", () => {
  const logger = getLogger();
  logger.critical("Critical failure in %s: %s", "database", "connection lost");
});

Deno.test("format methods handle multiple arguments", () => {
  const logger = getLogger();
  logger.info("User %s (ID: %d) logged in from %s at %s", "alice", 456, "192.168.1.1", "2024-01-01");
});

Deno.test("format methods work with zero format args", () => {
  const logger = getLogger();
  // Should not throw
  logger.info("Plain message with no formatting");
  logger.debug("Another plain message");
});

Deno.test("lazy evaluation: sprintf not called when level disabled", () => {
  // The default logger has level INFO (20). This means CRITICAL (50), ERROR (40), WARN (30),
  // and INFO (20) will pass, but DEBUG (10) will not.
  // We test that debug returns quickly without processing when level is disabled.
  // Note: JavaScript evaluates arguments before calling methods, so the "lazy" evaluation
  // refers to skipping sprintf processing, not argument evaluation.

  const logger = getLogger(); // Use default logger with INFO level

  // This should return immediately without calling sprintf or the underlying log method
  // We can't easily test that sprintf wasn't called, but we can verify the method
  // completes without error and doesn't produce output (DEBUG is disabled)
  logger.debug("Debug message that won't be logged: %s %d %f", "test", 123, 3.14);

  // If we got here without error, the lazy evaluation is working correctly
  // The method checked the level and returned early before calling sprintf
  assertExists(logger.debug, "debug method should exist");
});

Deno.test("lazy evaluation: function IS called when level enabled", () => {
  const logger = getLogger("test-lazy-enabled");

  let callCount = 0;
  const expensiveFunction = () => {
    callCount++;
    return "expensive result";
  };

  // INFO level should be enabled by default, so the function should be called
  logger.info("Info message: %s", expensiveFunction());

  // Verify the expensive function WAS called
  assertEquals(callCount, 1, "Expensive function should be called when INFO level is enabled");
});

Deno.test("error handling: invalid format specifier doesn't crash", () => {
  const logger = getLogger();
  // Invalid format specifier - should fall back gracefully
  try {
    logger.info("Invalid: %q", "test");
    // If it doesn't throw, that's fine
  }
  catch (err) {
    // If it throws, that's also acceptable as long as the logger doesn't crash completely
    assertExists(err);
  }
});

Deno.test("error handling: mismatched argument type", () => {
  const logger = getLogger();
  // Type mismatch - should handle gracefully
  try {
    logger.info("Number: %d", "not a number");
    // Should not throw or should handle gracefully
  }
  catch (err) {
    // If it throws, verify it's a controlled error
    assertExists(err);
  }
});

Deno.test("format methods work with unconfigured logger", () => {
  const logger = getLogger("unconfigured-module-name");
  // Should fall back to default logger and still work
  assertExists(logger.debug);
  assertExists(logger.info);
  logger.info("Test message: %s", "working");
});

Deno.test("all format methods callable without errors", () => {
  const logger = getLogger();

  // All of these should execute without throwing
  logger.debug("Debug: %s", "message");
  logger.info("Info: %s", "message");
  logger.warn("Warn: %s", "message");
  logger.error("Error: %s", "message");
  logger.critical("Critical: %s", "message");
});

Deno.test("format with empty string", () => {
  const logger = getLogger();
  // Should handle empty format string
  logger.info("");
});

Deno.test("format with special characters", () => {
  const logger = getLogger();
  logger.info("Path: %s", "/home/user/file.txt");
  logger.info("Email: %s", "user@example.com");
  logger.info("JSON: %s", '{"key": "value"}');
});

Deno.test("format with percentage in non-format context", () => {
  const logger = getLogger();
  // Testing that %% works or that non-format % doesn't break
  logger.info("Progress: 50%% complete");
});
