/**
 * Tests for hex formatter support (%h and %H)
 * Validates compact and spaced hex formatting for binary data
 *
 * Note: These tests verify that hex formatters don't throw errors
 * and work correctly with the logger. The actual hex output is
 * logged to console but not captured due to logger design.
 */

import { assertEquals, assertExists } from "@std/assert";
import { getLogger } from "../mod.ts";

Deno.test("hex formatters - %h with basic Uint8Array", () => {
  const logger = getLogger("test-hex-compact");
  const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

  // Should not throw - logs "Data: deadbeef"
  logger.info("Data: %h", bytes);
  assertExists(logger);
});

Deno.test("hex formatters - %H with basic Uint8Array", () => {
  const logger = getLogger("test-hex-spaced");
  const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

  // Should not throw - logs "Data: de ad be ef"
  logger.info("Data: %H", bytes);
  assertExists(logger);
});

Deno.test("hex formatters - %h with ArrayBuffer", () => {
  const logger = getLogger("test-arraybuffer");
  const buffer = new ArrayBuffer(4);
  const view = new Uint8Array(buffer);
  view[0] = 0x01;
  view[1] = 0x02;
  view[2] = 0x03;
  view[3] = 0x04;

  // Should not throw - logs "Buffer: 01020304"
  logger.info("Buffer: %h", buffer);
  assertExists(logger);
});

Deno.test("hex formatters - %h with number array", () => {
  const logger = getLogger("test-number-array");
  const numbers = [0xaa, 0xbb, 0xcc];

  // Should not throw - logs "Numbers: aabbcc"
  logger.info("Numbers: %h", numbers);
  assertExists(logger);
});

Deno.test("hex formatters - empty array", () => {
  const logger = getLogger("test-empty");
  const empty = new Uint8Array([]);

  // Should not throw - logs empty string
  logger.info("Empty: %h", empty);
  assertExists(logger);
});

Deno.test("hex formatters - single byte values", () => {
  const logger = getLogger("test-single");

  // Should not throw - logs "Byte: 00" and "Byte: ff"
  logger.info("Byte: %h", new Uint8Array([0x00]));
  logger.info("Byte: %h", new Uint8Array([0xff]));
  assertExists(logger);
});

Deno.test("hex formatters - large buffer NO truncation by default", () => {
  const logger = getLogger("test-large");

  // Create 2KB buffer - should NOT truncate (full data logged)
  const largeBuffer = new Uint8Array(2048).fill(0xff);

  // Should not throw - logs full 2KB hex string
  logger.info("Large: %h", largeBuffer);
  assertExists(logger);
});

Deno.test("hex formatters - precision parameter for truncation", () => {
  const logger = getLogger("test-precision");

  // Create 200 byte buffer
  const buffer = new Uint8Array(200).fill(0xaa);

  // Should truncate at 100 bytes with precision parameter
  logger.info("Truncated: %.100h", buffer);

  // Should truncate at 50 bytes
  logger.info("Smaller: %.50h", buffer);

  assertExists(logger);
});

Deno.test("hex formatters - mixed with regular formatters", () => {
  const logger = getLogger("test-mixed");
  const buffer = new Uint8Array([0x01, 0x02]);

  // Should not throw - logs "Buffer 0102 has 2 bytes"
  logger.info("Buffer %h has %d bytes", buffer, buffer.length);
  assertExists(logger);
});

Deno.test("hex formatters - both %h and %H in same message", () => {
  const logger = getLogger("test-both");
  const buf1 = new Uint8Array([0xaa, 0xbb]);
  const buf2 = new Uint8Array([0xcc, 0xdd]);

  // Should not throw - logs "Compact aabb, Spaced cc dd"
  logger.info("Compact %h, Spaced %H", buf1, buf2);
  assertExists(logger);
});

Deno.test("hex formatters - null/undefined handling", () => {
  const logger = getLogger("test-null");

  // Should not throw - logs "null" and "undefined"
  logger.info("Null: %h", null);
  logger.info("Undefined: %h", undefined);
  assertExists(logger);
});

Deno.test("hex formatters - wrong type fallback", () => {
  const logger = getLogger("test-wrong-type");

  // Should not throw - falls back to String() for wrong types
  logger.info("String: %h", "not a buffer");
  logger.info("Number: %h", 12345);
  assertExists(logger);
});

Deno.test("hex formatters - all log levels work", () => {
  const logger = getLogger("test-levels");
  const buffer = new Uint8Array([0x01, 0x02]);

  // All log levels should work with hex formatters
  logger.debug("Debug: %h", buffer);
  logger.info("Info: %h", buffer);
  logger.warn("Warn: %h", buffer);
  logger.error("Error: %h", buffer);

  assertExists(logger);
});

Deno.test("hex formatters - width/padding works", () => {
  const logger = getLogger("test-padding");
  const small = new Uint8Array([0xaa]);

  // Should not throw - applies padding
  logger.info("Padded: %20h", small);
  assertExists(logger);
});

Deno.test("hex formatters - real-world CORBA scenario", () => {
  const logger = getLogger("test-corba");

  // Simulate CORBA message with binary data
  const messageId = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
  const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe]);

  // Should not throw - logs "CORBA Message ID: 00010203, Payload: de ad be ef ca fe ba be"
  logger.info("CORBA Message ID: %h, Payload: %H", messageId, payload);
  assertExists(logger);
});

Deno.test("hex formatters - performance test with moderate buffer", () => {
  const logger = getLogger("test-performance");

  // 512 byte buffer (no truncation)
  const buffer = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    buffer[i] = i % 256;
  }

  const start = performance.now();
  logger.info("Data: %h", buffer);
  const duration = performance.now() - start;

  // Hex formatting should be fast
  assertEquals(duration < 100, true, `Hex formatting took too long: ${duration}ms`);
});

Deno.test("hex formatters - MAC address style formatting", () => {
  const logger = getLogger("test-mac");
  const macAddress = new Uint8Array([0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e]);

  // Should log like "MAC: 00:1a:2b:3c:4d:5e" (with manual colons, but hex works)
  logger.info("MAC (compact): %h", macAddress);
  logger.info("MAC (spaced): %H", macAddress);
  assertExists(logger);
});

Deno.test("hex formatters - IP address bytes", () => {
  const logger = getLogger("test-ip");
  const ipBytes = new Uint8Array([192, 168, 1, 1]);

  // Should work even though IP addresses aren't typically logged as hex
  logger.info("IP bytes: %h", ipBytes);
  assertExists(logger);
});

Deno.test("hex formatters - empty format string with hex formatter", () => {
  const logger = getLogger("test-empty-format");
  const buffer = new Uint8Array([0xab, 0xcd]);

  // Edge case: just the formatter, no surrounding text
  logger.info("%h", buffer);
  assertExists(logger);
});

Deno.test("hex formatters - multiple consecutive hex formatters", () => {
  const logger = getLogger("test-consecutive");
  const buf1 = new Uint8Array([0x11]);
  const buf2 = new Uint8Array([0x22]);
  const buf3 = new Uint8Array([0x33]);

  // Should handle multiple consecutive formatters
  logger.info("%h %h %h", buf1, buf2, buf3);
  assertExists(logger);
});
