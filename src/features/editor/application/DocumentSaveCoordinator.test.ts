import { describe, expect, it, vi } from "vitest";
import {
  DocumentSaveCoordinator,
  type SaveScheduler,
} from "./DocumentSaveCoordinator";

function harness(save = vi.fn()) {
  let callback: (() => void) | null = null;
  const scheduler: SaveScheduler = {
    schedule(next) {
      callback = next;
      return 1;
    },
    cancel: vi.fn(),
  };
  const markPending = vi.fn();
  const onError = vi.fn();
  const coordinator = new DocumentSaveCoordinator(
    save,
    scheduler,
    600,
    markPending,
    onError,
  );
  return { coordinator, save, markPending, onError, run: () => callback?.() };
}

describe("DocumentSaveCoordinator", () => {
  it("debounces to the latest document content", () => {
    const { coordinator, save, markPending, run } = harness();
    coordinator.request("doc-1", "first");
    coordinator.request("doc-1", "latest");
    run();
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith({
      documentId: "doc-1",
      markdown: "latest",
    });
    expect(markPending).toHaveBeenCalledTimes(2);
  });

  it("flushes pending content during teardown", () => {
    const { coordinator, save } = harness();
    coordinator.request("doc-1", "draft");
    coordinator.flush();
    coordinator.flush();
    expect(save).toHaveBeenCalledOnce();
  });

  it("cancels pending content without saving", () => {
    const { coordinator, save } = harness();
    coordinator.request("doc-1", "draft");
    coordinator.cancel();
    coordinator.flush();
    expect(save).not.toHaveBeenCalled();
  });

  it("reports asynchronous save failures", async () => {
    const failure = new Error("save failed");
    const { coordinator, onError } = harness(
      vi.fn().mockRejectedValue(failure),
    );
    coordinator.request("doc-1", "draft");
    coordinator.flush();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(failure));
  });
});
