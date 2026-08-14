import { useEffect, useRef } from "react";
import { buildTicketsWebSocketUrl } from "@/services/ticket.service";
import type { TicketRealtimeMessage } from "@/types/support-ticket";

const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 15000;

/** Opens (and keeps open) the live `WS /support-tickets/ws` connection for
 * either the Master console (`organizationId` omitted -- the cross-tenant,
 * every-organization connection, mirrors `ticketService.listAllOrgs()`'s
 * own no-header call) or the customer dashboard (`organizationId` set to
 * the caller's own org, mirrors `ticketService.list()`'s own
 * `X-Organization-Id` header). Fetch-then-subscribe: this only pushes
 * *incremental* `reply_created`/`ticket_updated` events on top of
 * whatever the caller already loaded via the REST list/detail endpoints --
 * it never replaces that initial fetch.
 *
 * Reconnects on drop with exponential backoff (capped at 15s, reset to 1s
 * on a successful reconnect), and always closes the socket on unmount --
 * the same "clean up on both disconnect paths" discipline the backend's
 * own `_run_live_relay` establishes on its side of this same connection.
 */
export function useSupportTicketsSocket(
  organizationId: string | null | undefined,
  onMessage: (message: TicketRealtimeMessage) => void,
  options?: { enabled?: boolean },
): void {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = INITIAL_RETRY_DELAY_MS;

    function scheduleReconnect() {
      if (cancelled) return;
      retryTimer = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
    }

    function connect() {
      if (cancelled) return;
      const url = buildTicketsWebSocketUrl(organizationId ?? undefined);
      const ws = new WebSocket(url);
      socket = ws;

      ws.onopen = () => {
        retryDelay = INITIAL_RETRY_DELAY_MS;
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as TicketRealtimeMessage;
          onMessageRef.current(data);
        } catch {
          // Malformed/unexpected frame -- ignore, the next REST refetch
          // still reflects reality (see backend _publish_live_message's
          // own "never lose the source of truth, only the live stream"
          // posture).
        }
      };
      ws.onclose = () => {
        if (socket === ws) socket = null;
        scheduleReconnect();
      };
      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
      socket = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, enabled]);
}
