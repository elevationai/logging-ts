/**
 * Tests for large message handling in ImmediateFlushFileHandler
 * Validates that the logger can handle messages >4KB without buffer overflow
 */

import { assertEquals, assertExists } from "@std/assert";
import { getLogger } from "../mod.ts";

// Helper to create large test messages
function createLargeMessage(sizeInKB: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const targetSize = sizeInKB * 1024;
  let message = "";
  while (message.length < targetSize) {
    message += chars.repeat(100);
  }
  return message.substring(0, targetSize);
}

Deno.test("logger handles 5KB message without error", () => {
  const logger = getLogger("test-5kb");
  const largeMessage = createLargeMessage(5);

  // This should not throw - the key test is that no RangeError occurs
  logger.info("Large message test: %s", largeMessage);

  // If we got here without throwing, the test passes
  assertExists(logger);
});

Deno.test("logger handles 10KB message without error", () => {
  const logger = getLogger("test-10kb");
  const largeMessage = createLargeMessage(10);

  // This should not throw
  logger.info("Large message: %s", largeMessage);

  assertExists(logger);
});

Deno.test("logger handles 100KB message without error", () => {
  const logger = getLogger("test-100kb");
  const largeMessage = createLargeMessage(100);

  // This should not throw - simulates large binary data in JSON
  logger.info("Very large message: %s", largeMessage);

  assertExists(logger);
});

Deno.test("logger handles 500KB message without error", () => {
  const logger = getLogger("test-500kb");
  const largeMessage = createLargeMessage(500);

  // This should not throw - tests extreme case
  logger.info("Extremely large message: %s", largeMessage);

  assertExists(logger);
});

Deno.test("logger handles multiple large messages in sequence", () => {
  const logger = getLogger("test-multiple");

  // Log multiple large messages - this should not throw
  for (let i = 0; i < 5; i++) {
    const largeMessage = createLargeMessage(10);
    logger.info("Message %d: %s", i, largeMessage);
  }

  assertExists(logger);
});

Deno.test("logger handles mix of small and large messages", () => {
  const logger = getLogger("test-mixed");

  // Small message
  logger.info("Small message 1");

  // Large message
  const largeMessage = createLargeMessage(10);
  logger.info("Large: %s", largeMessage);

  // Another small message
  logger.info("Small message 2");

  // Another large message
  const largeMessage2 = createLargeMessage(15);
  logger.info("Large 2: %s", largeMessage2);

  // Verify no errors occurred
  assertExists(logger);
});

Deno.test("logger handles message with JSON containing binary data", () => {
  const logger = getLogger("test-json");

  // Simulate a CUSS2 message with large dataRecords (like barcode scans)
  const mockDataRecords = Array.from({ length: 100 }, (_, i) => ({
    key: `barcode_${i}`,
    value: createLargeMessage(1), // 1KB per record = 100KB total
  }));

  const jsonMessage = JSON.stringify({
    messageType: "PERIPHERAL_QUERY_RESPONSE",
    dataRecords: mockDataRecords,
  });

  // This should not throw - this is the real-world scenario from the bug report
  logger.info("Response: %s", jsonMessage);

  assertEquals(jsonMessage.length > 100000, true, "JSON should be >100KB");
});

Deno.test("logger survives repeated large message stress test", () => {
  const logger = getLogger("test-stress");

  // Stress test: rapid fire large messages
  for (let i = 0; i < 20; i++) {
    const size = 5 + (i % 10); // Vary size from 5KB to 15KB
    const largeMessage = createLargeMessage(size);
    logger.info("Stress test %d: %s", i, largeMessage);
  }

  assertExists(logger);
});
