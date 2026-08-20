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

class RealtimeBroadcasterService {
  private listeners: Map<string, Set<Listener>> = new Map();

  /**
   * Subscribes a client listener to realtime events for a specific businessId.
   * Returns an unsubscribe function.
   */
  public subscribe(businessId: string, listener: Listener): () => void {
    if (!this.listeners.has(businessId)) {
      this.listeners.set(businessId, new Set());
    }
    const businessListeners = this.listeners.get(businessId)!;
    businessListeners.add(listener);

    return () => {
      businessListeners.delete(listener);
      if (businessListeners.size === 0) {
        this.listeners.delete(businessId);
      }
    };
  }

  /**
   * Broadcasts an event strictly to subscribers of the matching businessId.
   */
  public broadcast(event: RealtimeMessageEvent): void {
    const businessListeners = this.listeners.get(event.businessId);
    if (businessListeners && businessListeners.size > 0) {
      businessListeners.forEach((listener) => {
        try {
          listener(event);
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
    return this.listeners.get(businessId)?.size || 0;
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
