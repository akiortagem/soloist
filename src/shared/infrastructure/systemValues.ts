import type { Clock } from "../application/ports/Clock";
import type { IdGenerator } from "../application/ports/IdGenerator";

export class SystemClock implements Clock {
  now() {
    return new Date();
  }
}

export class CryptoIdGenerator implements IdGenerator {
  generate(prefix: string) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
}

const systemClock = new SystemClock();
const cryptoIds = new CryptoIdGenerator();

export function createId(prefix: string) {
  return cryptoIds.generate(prefix);
}

export function nowIso() {
  return systemClock.now().toISOString();
}
