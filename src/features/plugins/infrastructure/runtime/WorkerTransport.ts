export interface WorkerTransport {
  create(source: string): Worker;
}

export class BrowserWorkerTransport implements WorkerTransport {
  create(source: string): Worker {
    if (typeof Worker === "undefined" || typeof Blob === "undefined")
      throw new Error("Script plugin runtime requires Worker support");
    const url = URL.createObjectURL(
      new Blob([source], { type: "application/javascript" }),
    );
    try {
      return new Worker(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
