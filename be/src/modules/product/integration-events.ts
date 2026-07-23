// WHY: Public event contract của module product. Module khác subscribe
// được autocomplete + type-check. KHÔNG import handler/repo từ module này —
// dùng eventBus.on("product.created", ...) là interface duy nhất.
import "@/lib/events";

declare module "@/lib/events" {
  interface DomainEvents {
    "product.created": { productId: string; name: string; priceCents: number };
    "product.updated": { productId: string; changes: Record<string, unknown> };
    "product.deleted": { productId: string };
  }
}
