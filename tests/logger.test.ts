/**
 * Tests for the logging system
 */

import { assertEquals, assertExists } from "@std/assert";
import { getAllLoggers, getLogger } from "../mod.ts";

Deno.test("getLogger returns a logger instance", () => {
  const logger = getLogger();
  assertExists(logger);
  assertExists(logger.info);
  assertExists(logger.warn);
  assertExists(logger.error);
  assertExists(logger.debug);
  assertExists(logger.critical);
});

Deno.test("getLogger returns extended logger with warning method", () => {
  const logger = getLogger();
  assertExists(logger.warning);
  assertEquals(typeof logger.warning, "function");
});

Deno.test("getLogger returns module-specific logger", () => {
  const logger = getLogger("test-module");
  assertExists(logger);
  assertExists(logger.info);
});

Deno.test("getLogger creates dynamic logger for unconfigured module", () => {
  const logger = getLogger("nonexistent-module");
  assertExists(logger);
  // Should have handlers copied from default logger
  assertExists(logger.handlers);
});

Deno.test("getAllLoggers returns array", () => {
  const modules = getAllLoggers();
  assertExists(modules);
  assertEquals(Array.isArray(modules), true);
});

Deno.test("logger can log messages without throwing", () => {
  const logger = getLogger();

  // These should not throw errors
  logger.debug("Debug message");
  logger.info("Info message");
  logger.warn("Warning message");
  logger.warning("Warning via alias");
  logger.error("Error message");
  logger.critical("Critical message");
});

Deno.test("multiple logger instances for same module", () => {
  const logger1 = getLogger("same-module");
  const logger2 = getLogger("same-module");

  assertExists(logger1);
  assertExists(logger2);

  // Both should work
  logger1.info("From logger 1");
  logger2.info("From logger 2");
});

Deno.test("logger with formatted messages", () => {
  const logger = getLogger();

  // Test with format parameters
  logger.info("User %s logged in", "john");
  logger.error("Error code: %d", 404);
});
