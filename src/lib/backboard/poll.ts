/**
 * Wait for an async memory write to complete.
 *
 * Per cookbook pitfall 2: addMessage with memory="Auto" returns a
 * memory_operation_id; the actual memory write happens out of band. If a
 * subsequent read needs that memory to be visible, you must poll until
 * COMPLETED before issuing the read. Most callers in Paideia are
 * fire-and-forget and never need this — only use it when correctness
 * depends on read-after-write ordering.
 */

import { getBackboardClient } from "./client";

export async function waitForMemory(
  operation_id: string,
  timeout_ms: number = 30_000,
  poll_interval_ms: number = 1_000,
): Promise<void> {
  const client = getBackboardClient();
  const start = Date.now();

  while (Date.now() - start < timeout_ms) {
    const status = await client.getMemoryOperationStatus(operation_id);
    if (status.status === "COMPLETED") return;
    if (status.status === "FAILED") {
      throw new Error(
        `Memory operation ${operation_id} failed: ${status.status_message ?? "<no message>"}`,
      );
    }
    await new Promise((r) => setTimeout(r, poll_interval_ms));
  }

  throw new Error(
    `Memory operation ${operation_id} timed out after ${timeout_ms}ms`,
  );
}
