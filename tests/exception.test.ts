/**
 * Tests for the exception() logging method
 */

import { assertEquals, assertExists } from "@std/assert";
import { getLogger } from "../mod.ts";

Deno.test("exception() method exists on logger", () => {
  const logger = getLogger();
  assertExists(logger.exception);
  assertEquals(typeof logger.exception, "function");
});

Deno.test("exception() logs Error stack trace without throwing", () => {
  const logger = getLogger();
  const error = new Error("Test error");

  // Should not throw
  logger.exception(error);
});

Deno.test("exception() handles Error with custom message", () => {
  const logger = getLogger();
  const error = new Error("Connection failed");

  // Should not throw
  logger.exception(error);
});

Deno.test("exception() handles non-Error string", () => {
  const logger = getLogger();

  // Should handle string without throwing
  logger.exception("string error");
});

Deno.test("exception() handles non-Error number", () => {
  const logger = getLogger();

  // Should handle number without throwing
  logger.exception(42);
});

Deno.test("exception() handles non-Error object", () => {
  const logger = getLogger();

  // Should handle object without throwing
  logger.exception({ message: "object error", code: 500 });
});

Deno.test("exception() handles null and undefined", () => {
  const logger = getLogger();

  // Should handle null/undefined without throwing
  logger.exception(null);
  logger.exception(undefined);
});

Deno.test("exception() with error() usage pattern", () => {
  const logger = getLogger();
  const tenantId = "ABC123";

  // Simulate real-world usage pattern
  try {
    throw new Error("Connection failed");
  }
  catch (error) {
    logger.error("There was an error for Tenant %s", tenantId);
    logger.exception(error);
  }
});

Deno.test("exception() with custom Error subclass", () => {
  const logger = getLogger();

  class CustomError extends Error {
    constructor(message: string, public code: number) {
      super(message);
      this.name = "CustomError";
    }
  }

  const error = new CustomError("Custom error occurred", 404);
  logger.exception(error);
});

Deno.test("exception() with Error without stack", () => {
  const logger = getLogger();

  // Create error and remove stack
  const error = new Error("No stack error");
  delete (error as { stack?: string }).stack;

  logger.exception(error);
});

Deno.test("exception() on module-specific logger", () => {
  const logger = getLogger("test-module");

  const error = new Error("Module-specific error");
  logger.exception(error);
});

Deno.test("exception() on unconfigured module logger", () => {
  const logger = getLogger("nonexistent-module");

  const error = new Error("Unconfigured module error");
  logger.exception(error);
});

Deno.test("exception() multiple times in sequence", () => {
  const logger = getLogger();

  const error1 = new Error("First error");
  const error2 = new Error("Second error");
  const error3 = new Error("Third error");

  logger.exception(error1);
  logger.exception(error2);
  logger.exception(error3);
});

Deno.test("exception() with complex error chain", () => {
  const logger = getLogger();

  try {
    try {
      throw new Error("Inner error");
    }
    catch (_innerError) {
      const outerError = new Error("Outer error");
      // In a real scenario, you might attach the inner error as a cause
      throw outerError;
    }
  }
  catch (error) {
    logger.error("Error chain occurred");
    logger.exception(error);
  }
});
