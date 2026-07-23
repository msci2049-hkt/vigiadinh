// SSE hook bound to this app's BE origin. Feature code keeps importing
// "@/lib/sse" and never passes the base URL.
import { type UseServerEventsOptions, useServerEvents as useServerEventsCore } from "@repo/core";
import { env } from "./env";

export type { ServerEvent, SseStatus } from "@repo/core";
export { isFatalStatus, nextBackoff } from "@repo/core";

export function useServerEvents(options: Omit<UseServerEventsOptions, "baseUrl"> = {}): void {
  useServerEventsCore({ ...options, baseUrl: env.VITE_API_URL });
}
