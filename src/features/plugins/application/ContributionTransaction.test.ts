import { describe, expect, it, vi } from "vitest";

import { ContributionTransaction } from "./ContributionTransaction";

describe("ContributionTransaction", () => {
  it("rolls every completed contribution back in reverse order", async () => {
    const calls: string[] = [];
    const transaction = new ContributionTransaction();
    transaction.add(() => void calls.push("slash"));
    transaction.add(() => void calls.push("oracle"));
    transaction.add(() => void calls.push("template"));

    await transaction.rollback();

    expect(calls).toEqual(["template", "oracle", "slash"]);
  });

  it("continues rollback when one cleanup fails", async () => {
    const finalCleanup = vi.fn();
    const transaction = new ContributionTransaction();
    transaction.add(finalCleanup);
    transaction.add(() => {
      throw new Error("cleanup failed");
    });

    await expect(transaction.rollback()).rejects.toThrow(
      "Plugin contribution rollback failed",
    );
    expect(finalCleanup).toHaveBeenCalledOnce();
  });
});
