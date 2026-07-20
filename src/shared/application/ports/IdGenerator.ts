export interface IdGenerator {
  generate(prefix: string): string;
}
