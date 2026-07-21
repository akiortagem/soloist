import { describe, expect, it } from "vitest";

import { RuntimePermissionPolicy } from "./RuntimePermissionPolicy";
import { validateWorkerMessage } from "./WorkerMessageValidation";

describe("runtime boundary policies", () => {
  it("allows only explicitly granted permissions", () => {
    const policy = new RuntimePermissionPolicy(new Set(["storage"]));
    expect(policy.allows("storage")).toBe(true);
    expect(() => policy.require("document:insertBlock")).toThrow(
      "Plugin permission denied: document:insertBlock",
    );
  });

  it("rejects unknown message actions and envelope fields", () => {
    expect(() =>
      validateWorkerMessage({
        type: "hostRequest",
        requestId: "1",
        action: "host.takeover",
        payload: {},
      }),
    ).toThrow("Unknown host request action");
    expect(() =>
      validateWorkerMessage({ type: "activated", requestId: "1", extra: true }),
    ).toThrow("Unknown worker message field: extra");
  });
});
