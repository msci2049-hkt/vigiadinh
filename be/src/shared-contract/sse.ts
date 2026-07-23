// Contract SSE (GET /api/events, kênh sse:user:{id}) — at-most-once, FE phải
// refetch-bù khi reconnect. Domain event thêm dần vào SSE_DOMAIN_EVENTS khi
// dựng indexer/notifications thật (sync FE theo docs/CONTRACT-SYNC.md).
export const SSE_SYSTEM_EVENTS = ["connected", "ping"] as const;
export type SseSystemEvent = (typeof SSE_SYSTEM_EVENTS)[number];

export const SSE_DOMAIN_EVENTS = [] as const;
