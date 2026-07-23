// WHY: redlock@5.0.0-beta.2 package.json "exports" KHÔNG trỏ đến .d.ts → tsc
// không resolve types. Re-declare minimum API surface tự dùng (Redlock class
// + ResourceLockedError) — tránh `export * from "redlock/dist"` bị
// verbatimModuleSyntax block.
declare module "redlock" {
  import { EventEmitter } from "node:events";
  import type { Redis } from "ioredis";

  export interface Settings {
    driftFactor?: number;
    retryCount?: number;
    retryDelay?: number;
    retryJitter?: number;
    automaticExtensionThreshold?: number;
  }

  export class ResourceLockedError extends Error {}
  export class ExecutionError extends Error {}
  export class Lock {
    release(): Promise<void>;
    extend(duration: number): Promise<Lock>;
  }

  export default class Redlock extends EventEmitter {
    constructor(clients: ReadonlyArray<Redis>, settings?: Settings);
    acquire(resources: string[], duration: number, settings?: Settings): Promise<Lock>;
    using<T>(
      resources: string[],
      duration: number,
      routine: (signal: AbortSignal) => Promise<T>,
    ): Promise<T>;
  }
}
