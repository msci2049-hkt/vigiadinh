// WHY: Type-safe in-memory event bus cho cross-module communication SYNC.
// Modules declare event payload qua module augmentation trong
// `<module>/integration-events.ts` → consumer subscribe được autocomplete +
// type-check. Tránh deep-import handler giữa các module (rule module-boundary).
//
// Khi cần ASYNC retry/persist → dùng BullMQ thay vì bus này.

import { EventEmitter } from "node:events";
import { logger } from "./logger";

// biome-ignore lint/suspicious/noEmptyInterface: extended via module augmentation
export interface DomainEvents {
  // Mỗi module thêm key qua `declare module "@/lib/events"`.
}

class TypedEventBus extends EventEmitter {
  override emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): boolean {
    logger.debug({ event, payload }, "domain.event.emit");
    return super.emit(event as string, payload);
  }

  override on<K extends keyof DomainEvents>(
    event: K,
    handler: (payload: DomainEvents[K]) => void | Promise<void>,
  ): this {
    return super.on(event as string, handler as (...args: unknown[]) => void);
  }
}

export const eventBus = new TypedEventBus();
// Default 10 → warn khi module thứ 11 subscribe. SMB project có thể vượt nhanh.
eventBus.setMaxListeners(100);
