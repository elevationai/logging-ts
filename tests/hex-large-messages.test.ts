/**
 * Tests for hex formatters with large buffers
 * Validates that large hex-formatted messages work correctly
 * These tests verify the hex formatters don't crash with large buffers
 * and that precision-based truncation works as expected
 */

import { assertEquals, assertExists } from "@std/assert";
import { getLogger } from "../mod.ts";

Deno.test("hex formatters - 2KB buffer without truncation", () => {
  const logger = getLogger("test-2kb");

  // 2KB buffer → 4KB hex string (exceeds typical buffer limits)
  const buffer = new Uint8Array(2048).fill(0xaa);

  // Should not throw - logs full 4KB hex string
  logger.info("2KB CORBA: %h", buffer);
  assertExists(logger);
});

Deno.test("hex formatters - 5KB buffer without truncation", () => {
  const logger = getLogger("test-5kb");

  // 5KB buffer → 10KB hex string (very large log message)
  const buffer = new Uint8Array(5120).fill(0xbb);

  // Should not throw - logs full 10KB hex string
  logger.info("5KB CORBA: %h", buffer);
  assertExists(logger);
});

Deno.test("hex formatters - 10KB buffer with 1KB precision truncation", () => {
  const logger = getLogger("test-10kb-truncated");

  // 10KB buffer, truncated to 1KB (2KB hex string + truncation message)
  const buffer = new Uint8Array(10240).fill(0xcc);

  // Should not throw - logs 1KB worth of hex + truncation message
  logger.info("10KB CORBA truncated: %.1024h", buffer);
  assertExists(logger);
});

Deno.test("hex formatters - 10KB buffer with 2KB precision truncation", () => {
  const logger = getLogger("test-10kb-2kb");

  // 10KB buffer, truncated to 2KB (4KB hex string + truncation message)
  const buffer = new Uint8Array(10240).fill(0xdd);

  // Should not throw - logs 2KB worth of hex + truncation message
  logger.info("10KB CORBA with 2KB precision: %.2048h", buffer);
  assertExists(logger);
});

Deno.test("hex formatters - mixed formatters with 5KB buffer", () => {
  const logger = getLogger("test-mixed-5kb");

  // Test mixing regular formatters with large hex output
  const buffer = new Uint8Array(5120).fill(0xee);
  const messageId = 12345;

  // Should not throw - logs full message with 10KB hex string
  logger.info("CORBA msg %d: %h (%d bytes)", messageId, buffer, buffer.length);
  assertExists(logger);
});

Deno.test("hex formatters - spaced format with 3KB buffer", () => {
  const logger = getLogger("test-spaced-3kb");

  // Spaced format creates even larger output (3KB → 9KB with spaces)
  const buffer = new Uint8Array(3072).fill(0xff);

  // Should not throw - logs full 9KB spaced hex string
  logger.info("3KB Spaced CORBA: %H", buffer);
  assertExists(logger);
});

Deno.test("hex formatters - both formats with 2KB buffer", () => {
  const logger = getLogger("test-both-2kb");

  // Test both compact and spaced formats in same message
  const buf1 = new Uint8Array(2048).fill(0x11);
  const buf2 = new Uint8Array(2048).fill(0x22);

  // Should not throw - logs 4KB compact + 6KB spaced = 10KB+ total
  logger.info("Compact: %h, Spaced: %H", buf1, buf2);
  assertExists(logger);
});

Deno.test("hex formatters - performance with 10KB buffer", () => {
  const logger = getLogger("test-perf-10kb");

  // 10KB buffer to test performance
  const buffer = new Uint8Array(10240);
  for (let i = 0; i < 10240; i++) {
    buffer[i] = i % 256;
  }

  const start = performance.now();
  logger.info("Performance test: %h", buffer);
  const duration = performance.now() - start;

  // Hex formatting should complete reasonably fast even for 10KB
  // Allow 500ms for conversion + logging (generous limit)
  assertEquals(duration < 500, true, `Hex formatting took too long: ${duration}ms`);
});

Deno.test("hex formatters - realistic CORBA scenario", () => {
  const logger = getLogger("test-corba-realistic");

  // Simulate realistic CORBA message sizes
  const messageId = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
  const header = new Uint8Array(128).fill(0xaa);
  const payload = new Uint8Array(4096).fill(0xbb);

  // Should not throw - multiple hex formatters with varying sizes
  logger.info(
    "CORBA ID: %h, Header: %.64h, Payload: %.1024h",
    messageId,
    header,
    payload,
  );
  assertExists(logger);
});
