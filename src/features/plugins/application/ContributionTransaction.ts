export type ContributionDisposer = () => void | Promise<void>;

export class ContributionTransaction {
  private readonly disposers: ContributionDisposer[] = [];

  add(disposer: ContributionDisposer): void {
    this.disposers.push(disposer);
  }

  async rollback(): Promise<void> {
    const errors: unknown[] = [];
    for (const dispose of this.disposers.reverse()) {
      try {
        await dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    this.disposers.length = 0;
    if (errors.length > 0) {
      throw new Error(
        `Plugin contribution rollback failed (${errors.length} cleanup error${errors.length === 1 ? "" : "s"})`,
      );
    }
  }

  commit(): ContributionDisposer {
    const committed = [...this.disposers];
    this.disposers.length = 0;
    return async () => {
      for (const dispose of committed.reverse()) await dispose();
    };
  }
}
