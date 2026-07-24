// Router event (PHA 4.2) — THUẦN: map kind (topic đầu của contract event / tên
// event pipeline) → cách xử lý. `recovery.vetoed` ƯU TIÊN CAO NHẤT (pipeline §4):
// batch được SORT theo priority trước khi áp — veto invalidate trước mọi thứ khác.
export type RoutedEvent = {
  kind: string;
  /** Số nhỏ = xử lý trước. Veto = 0. */
  priority: number;
  /** Template thông báo cho CHỦ VÍ (render ICU theo locale người nhận — 4.3). */
  notifyTemplate: string | null;
  /** Có được biết đến không — unknown vẫn lưu (không mất dữ liệu), không notify. */
  known: boolean;
  /** Event registry on-chain: MỌI ví chung MỘT contractId (registry) — ví nằm ở
   * topics[1], applyEvent match bằng wallets.stellarAddress thay vì contractId. */
  walletFromTopic?: boolean;
};

const VETO_PRIORITY = 0;
const HIGH = 10;
const NORMAL = 50;

/** Bảng định tuyến — event pipeline (BE tự phát) + event contract (on-chain). */
const ROUTES: Record<string, Omit<RoutedEvent, "kind">> = {
  // Khẩn — invalidate ngay, trước mọi hàng đợi.
  "recovery.vetoed": { priority: VETO_PRIORITY, notifyTemplate: "recovery.vetoed", known: true },
  // Pipeline intent (9 event, vi-backend-pipeline §4).
  "intent.created": { priority: NORMAL, notifyTemplate: null, known: true },
  "policy.evaluated": { priority: NORMAL, notifyTemplate: null, known: true },
  "approval.requested": { priority: HIGH, notifyTemplate: "approval.requested", known: true },
  "guardian.approved": { priority: HIGH, notifyTemplate: "approval.approved", known: true },
  "signature.completed": { priority: NORMAL, notifyTemplate: null, known: true },
  "transaction.settled": { priority: NORMAL, notifyTemplate: "transaction.settled", known: true },
  "guardian.health_changed": { priority: NORMAL, notifyTemplate: null, known: true },
  "care.revoked": { priority: HIGH, notifyTemplate: "care.revoked", known: true },
  // Event THẬT của recovery registry (PHA 5.2) — topic symbol_short ≤9 ký tự,
  // đọc từ chain, bảng đối chiếu: docs/ONCHAIN-EVENTS.md. `cancel` = veto on-chain
  // → cùng priority 0 với recovery.vetoed (pipeline).
  register: { priority: NORMAL, notifyTemplate: null, known: true, walletFromTopic: true },
  g_add: { priority: NORMAL, notifyTemplate: null, known: true, walletFromTopic: true },
  g_remove: { priority: NORMAL, notifyTemplate: null, known: true, walletFromTopic: true },
  initiate: {
    priority: HIGH,
    notifyTemplate: "recovery.initiated",
    known: true,
    walletFromTopic: true,
  },
  approve: {
    priority: HIGH,
    notifyTemplate: "recovery.approved",
    known: true,
    walletFromTopic: true,
  },
  cancel: {
    priority: VETO_PRIORITY,
    notifyTemplate: "recovery.vetoed",
    known: true,
    walletFromTopic: true,
  },
  finalize: {
    priority: HIGH,
    notifyTemplate: "recovery.finalized",
    known: true,
    walletFromTopic: true,
  },
  // Event contract (heartbeat / thừa kế / di chúc — PHA 5+ phát thật).
  heartbeat: { priority: NORMAL, notifyTemplate: null, known: true },
  inheritance_opened: {
    priority: HIGH,
    notifyTemplate: "inheritance.opened",
    known: true,
  },
  inheritance_claimed: {
    priority: HIGH,
    notifyTemplate: "inheritance.claimed",
    known: true,
  },
  will_hash_anchored: { priority: NORMAL, notifyTemplate: null, known: true },
};

export function routeEvent(kind: string): RoutedEvent {
  const route = ROUTES[kind];
  if (!route) {
    // Không biết ≠ vứt: vẫn lưu mirror để điều tra, không notify bừa.
    return { kind, priority: NORMAL, notifyTemplate: null, known: false };
  }
  return { kind, ...route };
}

/** Sort batch theo priority (veto trước) — giữ thứ tự ledger trong cùng priority. */
export function orderByPriority<T extends { kind: string; ledger: number }>(
  events: readonly T[],
): T[] {
  return [...events].sort((a, b) => {
    const pa = routeEvent(a.kind).priority;
    const pb = routeEvent(b.kind).priority;
    return pa === pb ? a.ledger - b.ledger : pa - pb;
  });
}
