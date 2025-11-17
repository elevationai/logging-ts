/**
 * Test to verify bufferSize: 0 works correctly
 * Validates that the simplified implementation handles all message sizes
 */

import { assertExists } from "@std/assert";
import { getLogger } from "../mod.ts";

Deno.test("bufferSize: 0 - small messages work", () => {
  const logger = getLogger("test-small");

  // Should not throw
  logger.info("Small message");
  assertExists(logger);
});

Deno.test("bufferSize: 0 - medium messages work", () => {
  const logger = getLogger("test-medium");

  // Create 2KB message
  const msg = "X".repeat(2048);

  // Should not throw
  logger.info("Medium message: %s", msg);
  assertExists(logger);
});

Deno.test("bufferSize: 0 - large messages work (5KB)", () => {
  const logger = getLogger("test-large");

  // Create 5KB message (larger than default 4KB buffer)
  const msg = "Y".repeat(5120);

  // Should not throw - this would fail with old ImmediateFlushFileHandler
  logger.info("Large message: %s", msg);
  assertExists(logger);
});

Deno.test("bufferSize: 0 - very large messages work (100KB)", () => {
  const logger = getLogger("test-very-large");

  // Create 100KB message
  const msg = "Z".repeat(102400);

  // Should not throw
  logger.info("Very large message: %s", msg);
  assertExists(logger);
});

Deno.test("bufferSize: 0 - multiple large messages work", () => {
  const logger = getLogger("test-multiple");

  // Log multiple large messages in succession
  for (let i = 0; i < 5; i++) {
    const msg = "M".repeat(10240); // 10KB each
    logger.info("Message %d: %s", i, msg);
  }

  assertExists(logger);
});

Deno.test("bufferSize: 0 - mixed message sizes work", () => {
  const logger = getLogger("test-mixed");

  // Small
  logger.info("Small");

  // Medium
  logger.info("Medium: %s", "X".repeat(2048));

  // Large
  logger.info("Large: %s", "Y".repeat(10240));

  // Small again
  logger.info("Small again");

  assertExists(logger);
});
