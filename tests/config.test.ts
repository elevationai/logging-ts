/**
 * Tests for configuration loading
 */

import { assertEquals, assertExists } from "@std/assert";
import { getLogger } from "../mod.ts";

Deno.test("logger works without config file", () => {
  // This test assumes no config file exists in test context
  const logger = getLogger();
  assertExists(logger);
  assertExists(logger.handlers);

  // Should have at least one handler (console by default)
  assertEquals(logger.handlers.length > 0, true);
});

Deno.test("logger can be called multiple times", () => {
  const logger1 = getLogger();
  const logger2 = getLogger();
  const logger3 = getLogger("module1");

  assertExists(logger1);
  assertExists(logger2);
  assertExists(logger3);

  // All should be functional
  logger1.info("Message 1");
  logger2.info("Message 2");
  logger3.info("Message 3");
});

Deno.test("logger handles module names with special characters", () => {
  const logger1 = getLogger("module-with-dashes");
  const logger2 = getLogger("module_with_underscores");
  const logger3 = getLogger("ModuleWithCamelCase");

  assertExists(logger1);
  assertExists(logger2);
  assertExists(logger3);

  logger1.info("Test");
  logger2.info("Test");
  logger3.info("Test");
});
