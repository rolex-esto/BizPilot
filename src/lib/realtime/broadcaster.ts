/**
 * BizPilot Realtime Event Broadcaster
 * 
 * In-process event bridge supporting Server-Sent Events (SSE) subscriptions.
 * Enforces strict multi-tenant isolation: events are routed exclusively to
 * subscriber streams matching the specific businessId.
 */

export interface RealtimeMessageEvent {
  type: "message.created" | "message.updated" | "conversation.updated";
  businessId: string;
  conversationId: string;
  messageId?: string;
  platform: string;
  environment: "LIVE" | "PRACTICE" | "TEST";
  direction?: "INBOUND" | "OUTBOUND";
  preview?: string;
  senderName?: string;
  sentAt?: string;
  unreadCount?: number;
}

type Listener = (event: RealtimeMessageEvent) => void;
interface Subscription {
  listener: Listener;
  environment: "LIVE" | "PRACTICE" | "ALL";
}

class RealtimeBroadcasterService {
  private subscriptions: Map<string, Set<Subscription>> = new Map();

  /**
   * Subscribes a client listener to realtime events for a specific businessId and environment.
   * Returns an unsubscribe function.
   */
  public subscribe(
    businessId: string,
    listener: Listener,
    environment: "LIVE" | "PRACTICE" | "ALL" = "ALL"
  ): () => void {
    if (!this.subscriptions.has(businessId)) {
      this.subscriptions.set(businessId, new Set());
    }
    const businessSubs = this.subscriptions.get(businessId)!;
    const sub: Subscription = { listener, environment };
    businessSubs.add(sub);

    return () => {
      businessSubs.delete(sub);
      if (businessSubs.size === 0) {
        this.subscriptions.delete(businessId);
      }
    };
  }

  /**
   * Broadcasts an event strictly to subscribers of the matching businessId and environment.
   */
  public broadcast(event: RealtimeMessageEvent): void {
    const businessSubs = this.subscriptions.get(event.businessId);
    if (businessSubs && businessSubs.size > 0) {
      businessSubs.forEach((sub) => {
        // Enforce strict environment matching
        if (sub.environment !== "ALL" && event.environment && sub.environment !== event.environment) {
          return;
        }
        try {
          sub.listener(event);
        } catch (err) {
          console.error("[REALTIME][BROADCASTER] Listener error:", err);
        }
      });
    }
  }

  /**
   * Returns count of active listeners for a business.
   */
  public getSubscriberCount(businessId: string): number {
    return this.subscriptions.get(businessId)?.size || 0;
  }
}

// Global singleton instance across Next.js API routes
const globalForRealtime = globalThis as unknown as {
  bizPilotRealtimeBroadcaster?: RealtimeBroadcasterService;
};

export const RealtimeBroadcaster =
  globalForRealtime.bizPilotRealtimeBroadcaster || new RealtimeBroadcasterService();

if (process.env.NODE_ENV !== "production") {
  globalForRealtime.bizPilotRealtimeBroadcaster = RealtimeBroadcaster;
}
