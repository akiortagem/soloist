export interface SaveScheduler {
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}

export type SaveDocument = (input: {
  documentId: string;
  markdown: string;
}) => void | Promise<unknown>;

export class DocumentSaveCoordinator {
  private pending: { documentId: string; markdown: string } | null = null;
  private timer: unknown = null;

  constructor(
    private readonly save: SaveDocument,
    private readonly scheduler: SaveScheduler,
    private readonly delayMs: number,
    private readonly markPending: () => void,
    private readonly onError: (error: unknown) => void = () => undefined,
  ) {}

  request(documentId: string, markdown: string) {
    if (this.timer !== null) this.scheduler.cancel(this.timer);
    this.pending = { documentId, markdown };
    this.markPending();
    this.timer = this.scheduler.schedule(() => this.flush(), this.delayMs);
  }

  flush() {
    if (!this.pending) return;
    if (this.timer !== null) this.scheduler.cancel(this.timer);
    const pending = this.pending;
    this.pending = null;
    this.timer = null;
    void Promise.resolve(this.save(pending)).catch(this.onError);
  }

  cancel() {
    if (this.timer !== null) this.scheduler.cancel(this.timer);
    this.pending = null;
    this.timer = null;
  }
}
