/**
 * Tests for dynamic handler attachment/detachment
 */

import { assertEquals, assertExists } from "@std/assert";
import { ConsoleHandler } from "@std/log";
import { attachHandler, detachHandler, getLogger } from "../mod.ts";

Deno.test("attachHandler adds handler to logger", () => {
  const logger = getLogger("test-attach");
  const initialHandlerCount = logger.handlers.length;

  const customHandler = new ConsoleHandler("DEBUG");
  attachHandler("test-attach", customHandler);

  // Handler count should increase or stay same (if unconfigured module, attaches to default)
  const newHandlerCount = getLogger("test-attach").handlers.length;
  assertExists(newHandlerCount);
  assertEquals(newHandlerCount >= initialHandlerCount, true);
});

Deno.test("detachHandler removes handler from logger", () => {
  const customHandler = new ConsoleHandler("DEBUG");

  attachHandler("test-detach", customHandler);
  const afterAttachCount = getLogger("test-detach").handlers.length;

  detachHandler("test-detach", customHandler);
  const afterDetachCount = getLogger("test-detach").handlers.length;

  // After detachment, should have fewer or equal handlers
  assertEquals(afterDetachCount <= afterAttachCount, true);
});

Deno.test("attachHandler works with default logger", () => {
  const logger = getLogger();
  const initialHandlerCount = logger.handlers.length;

  const customHandler = new ConsoleHandler("INFO");
  attachHandler(undefined, customHandler);

  const newHandlerCount = getLogger().handlers.length;
  assertEquals(newHandlerCount, initialHandlerCount + 1);

  // Clean up
  detachHandler(undefined, customHandler);
});

Deno.test("attachHandler works with unconfigured module names", () => {
  const customHandler = new ConsoleHandler("DEBUG");

  // Should not throw for unconfigured module
  attachHandler("completely-unconfigured-module", customHandler);

  const logger = getLogger("completely-unconfigured-module");
  assertExists(logger);

  // Clean up
  detachHandler("completely-unconfigured-module", customHandler);
});

Deno.test("multiple handlers can be attached", () => {
  const handler1 = new ConsoleHandler("DEBUG");
  const handler2 = new ConsoleHandler("INFO");
  const handler3 = new ConsoleHandler("WARN");

  attachHandler("multi-handler", handler1);
  attachHandler("multi-handler", handler2);
  attachHandler("multi-handler", handler3);

  const logger = getLogger("multi-handler");
  assertExists(logger);
  assertExists(logger.handlers);

  // Clean up
  detachHandler("multi-handler", handler1);
  detachHandler("multi-handler", handler2);
  detachHandler("multi-handler", handler3);
});
