// 🧪 DEMO FEATURE (features/dashboard) — safe to delete the whole folder. See README "Gỡ demo".

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type ServerEvent, type SseStatus, useServerEvents } from "@/lib/sse";
import { dashboardKeys } from "../api/dashboard-api";

type FeedItem = ServerEvent & { seq: number };

const STATUS_KEY: Record<SseStatus, `events.status.${SseStatus}`> = {
  connecting: "events.status.connecting",
  open: "events.status.open",
  reconnecting: "events.status.reconnecting",
  closed: "events.status.closed",
};

export function EventsFeed() {
  const queryClient = useQueryClient();
  const { t } = useTranslation("dashboard");
  const seqRef = useRef(0);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<SseStatus>("connecting");

  useServerEvents({
    // Reflect the real connection state even before the first event arrives.
    onOpen: () => setStatus("open"),
    onReconnecting: () => setStatus("reconnecting"),
    onClosed: () => setStatus("closed"),
    onEvent: (event) => {
      // Bump the seq in the handler (runs once per event) and keep the state
      // updater pure — mutating a ref inside it double-counts under StrictMode.
      seqRef.current += 1;
      const seq = seqRef.current;
      setItems((prev) => [{ ...event, seq }, ...prev].slice(0, 50));
    },
    onReconnect: () => {
      // refetch-bù: SSE is at-most-once, so re-pull state after a drop.
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{t("events.title")}</span>
          <span className="font-normal text-muted-foreground text-xs">
            /api/events · {t(STATUS_KEY[status])}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("events.emptyPrefix")} <code>sse:user:{"{id}"}</code> {t("events.emptySuffix")}
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {items.map((item) => (
              <li key={item.seq} className="rounded bg-muted px-2 py-1">
                <span className="font-medium">{item.event}</span>: {item.data}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
