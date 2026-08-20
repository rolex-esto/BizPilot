"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Flame,
  Send,
  Sparkles,
  ShoppingBag,
  User,
  Phone,
  MapPin,
  Tag,
  CheckCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  PlusCircle,
  X,
  CreditCard,
  Truck,
  Calendar,
  DollarSign,
  ArrowLeft,
  Bot,
  ShieldCheck,
  Edit2,
  Check,
  Sliders,
  Radio,
  Terminal,
  Volume2,
  VolumeX,
  Bell,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Film,
  Music,
  Paperclip,
  Maximize2,
  Eye,
  Download,
  AlertCircle,
  Camera,
  FileText,
} from "lucide-react";
import { ModuleIntroModal, AboutPageButton, useModuleIntro, ModuleIntroConfig } from "@/components/ModuleIntroModal";
import { getPlatformCapabilities, getPlatformMetadata } from "@/lib/connectors/registry";

const INBOX_INTRO_CONFIG: ModuleIntroConfig = {
  moduleKey: "inbox",
  title: "Customer Messages",
  badge: "Messages",
  icon: <MessageSquare className="w-6 h-6 text-sky-600" />,
  subtitle: "See all your customer messages from Facebook, Instagram, WhatsApp, and TikTok in one place.",
  whatYouCanDo: [
    "Read and reply to customer messages from all your platforms",
    "See which customers are interested in buying",
    "Negotiate prices with customers (tawad)",
    "Turn a conversation into an order with one click",
  ],
  whyItMatters:
    "No more jumping between apps — all your customer conversations are here so you don't miss a sale.",
  nextAction: "Open a customer conversation to see what they're asking about.",
};

interface Customer {
  id: string;
  name: string;
  environment?: string;
  primaryPlatform: string;
  source?: string;
  handle?: string;
  phone?: string;
  email?: string;
  deliveryAddress?: string;
  preferredFulfillment?: string;
  leadScore: number;
  leadStatus: string;
  lifetimeValue: number;
  orderCount: number;
  notes?: string;
  orders?: any[];
  leads?: any[];
  identityLinks?: any[];
}

interface Message {
  id: string;
  environment?: string;
  sourceType?: string;
  direction: "INBOUND" | "OUTBOUND";
  textContent: string;
  mediaUrl?: string;
  mediaType?: string;
  aiClassification?: string;
  aiSuggestedReply?: string;
  sentAt: string;
  rawPayload?: string | null;
}

interface Conversation {
  id: string;
  environment?: string;
  sourceType?: string;
  platform: string;
  status: string;
  unreadCount: number;
  lastMessageAt: string;
  lastMessagePreview?: string;
  customer: Customer;
  messages?: Message[];
}

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  stockQuantity: number;
}

export default function UnifiedInboxPage() {
  const { isOpen: isIntroOpen, openIntro, closeIntro } = useModuleIntro("inbox");
  const [inboxMode, setInboxMode] = useState<"LIVE" | "PRACTICE">("LIVE");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [showMobileProfile, setShowMobileProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncingChannels, setSyncingChannels] = useState(false);
  const [platformFilter, setPlatformFilter] = useState("ALL");
  const [leadFilter, setLeadFilter] = useState("ALL");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  // Rich Media Composer & Lightbox State
  const [stagedMedia, setStagedMedia] = useState<{
    file?: File;
    previewUrl: string;
    mediaType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
    filename: string;
  } | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxMedia, setLightboxMedia] = useState<{
    url: string;
    title?: string;
    type?: "IMAGE" | "VIDEO";
  } | null>(null);

  // 1-Click Order Modal State
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderNegotiatedPrice, setOrderNegotiatedPrice] = useState<number | string>("");
  const [orderFulfillment, setOrderFulfillment] = useState("COURIER"); // MEETUP, LBC, COURIER, DELIVERY
  const [orderCourier, setOrderCourier] = useState("Grab Express");
  const [orderMeetupLocation, setOrderMeetupLocation] = useState("");
  const [orderMeetupSchedule, setOrderMeetupSchedule] = useState("");
  const [orderLbcTracking, setOrderLbcTracking] = useState("");
  const [orderPickupLocation, setOrderPickupLocation] = useState("");
  const [orderAddress, setOrderAddress] = useState("");
  const [orderPhone, setOrderPhone] = useState("");
  const [orderPaymentMethod, setOrderPaymentMethod] = useState("GCASH");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState("");

  // Negotiation Quick State
  const [customOfferInput, setCustomOfferInput] = useState<string>("");
  const [negotiatingAction, setNegotiatingAction] = useState(false);

  // AI Suggestions & Conversation Handling Mode State
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Record<string, boolean>>({});
  const [aiApprovalSending, setAiApprovalSending] = useState(false);
  const [handlingToggleLoading, setHandlingToggleLoading] = useState(false);
  const [aiSuggestionMinimized, setAiSuggestionMinimized] = useState(false);

  // Real-time Sound & Pop-up Notification State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeToast, setActiveToast] = useState<{
    id: string;
    name: string;
    platform: string;
    preview: string;
    convId: string;
  } | null>(null);

  // ─── Polling Refs ────────────────────────────────────────────────────────────
  // knownTimestampsRef: tracks the last-seen lastMessageAt per conversation for
  // notification detection. Reset on mode-switch to prevent false positives.
  const knownTimestampsRef = useRef<Record<string, number>>({});
  const initialLoadDoneRef = useRef(false);
  const lastActiveMsgCountRef = useRef<Record<string, number>>({});

  // Concurrency & Generation Control:
  // Independent controllers & counters guarantee that conversation list polling,
  // active conversation details, and background reconciliation never block or corrupt one another.
  const isFetchingConvsRef = useRef(false);
  const isAutoReconcilingRef = useRef(false);
  const activeConvRequestIdRef = useRef(0);

  // Stable ref for activeConvId — allows reconciliation effect to read the current
  // conversation ID without taking it as a dependency (which would reset the timer).
  const activeConvIdRef = useRef<string | null>(null);
  activeConvIdRef.current = activeConvId;

  // Delta polling cursor — stores the server-provided timestamp from the last
  // successful full/delta fetch. Background polls pass this as `since` so only
  // conversations updated after this point are returned.
  // Using the SERVER timestamp (not the browser clock) prevents clock-skew issues.
  const lastKnownServerTimestampRef = useRef<string | null>(null);

  // AbortController refs — each fetch creates a new controller; previous one is
  // aborted when a mode-switch or conversation-switch invalidates the request.
  const convFetchAbortRef = useRef<AbortController | null>(null);
  const activeFetchAbortRef = useRef<AbortController | null>(null);

  // ─── Audio Notification ──────────────────────────────────────────────────────
  // High-fidelity Web Audio API chime pop
  const playNotificationChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Note 1: Bright bell (587.33Hz D5 -> 880Hz A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.08);

      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.3, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      // Note 2: Warm harmonic pop (880Hz A5 -> 1174.66Hz D6)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(880, now + 0.08);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.2);

      gain2.gain.setValueAtTime(0, now + 0.08);
      gain2.gain.linearRampToValueAtTime(0.22, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.36);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.43);
    } catch {
      // AudioContext blocked or not supported - fails safely
    }
  };

  // Auto-dismiss toast notification after 6 seconds
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [activeToast]);

  const formatPhp = (amt: number) =>
    `₱${amt.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  // ─── Mode Switch ─────────────────────────────────────────────────────────────
  const switchInboxMode = (newMode: "LIVE" | "PRACTICE") => {
    if (newMode === inboxMode) return;

    // 1. Cancel any in-flight conversation fetch for the old mode
    if (convFetchAbortRef.current) {
      convFetchAbortRef.current.abort();
      convFetchAbortRef.current = null;
    }
    isFetchingConvsRef.current = false; // reset lock so new fetch can proceed

    // 2. Immediately wipe all conversation & chat state so stale data vanishes instantly
    setConversations([]);
    setActiveConvId(null);
    setActiveConv(null);
    setReplyText("");
    setActiveToast(null);
    knownTimestampsRef.current = {};
    initialLoadDoneRef.current = false;
    lastActiveMsgCountRef.current = {};
    lastKnownServerTimestampRef.current = null; // reset delta cursor on mode switch
    setLoading(true);

    // 3. Switch mode and fetch fresh full data (no delta cursor)
    setInboxMode(newMode);
    fetchConversations({ targetMode: newMode, forceFull: true });
  };

  // ─── fetchConversations ──────────────────────────────────────────────────────
  /**
   * Fetches the conversation list from Neon DB.
   *
   * FULL fetch (forceFull=true or no cursor):
   *   Used on initial load and mode-switch. Returns all conversations.
   *
   * DELTA fetch (default for background polls):
   *   Passes since=<lastKnownServerTimestamp>&deltaOnly=true.
   *   Server returns { hasUpdates: false, conversations: [] } when nothing changed,
   *   saving bandwidth. When hasUpdates=true, full list is re-fetched to keep state
   *   consistent (avoids partial-merge complexity).
   *
   * NOTIFICATION RULE: Only fires chime/toast when:
   *   - NOT the initial load
   *   - lastMessageAt on a conversation increased since last poll
   *   - The conversation has unreadCount > 0 (meaning the new message is INBOUND)
   */
  const fetchConversations = async (opts?: {
    targetMode?: "LIVE" | "PRACTICE";
    forceFull?: boolean;
    signal?: AbortSignal;
  }) => {
    if (isFetchingConvsRef.current) return;
    isFetchingConvsRef.current = true;

    const currentMode = opts?.targetMode || inboxMode;
    const forceFull = opts?.forceFull ?? false;

    // Create a new AbortController for this request
    const abortController = new AbortController();
    convFetchAbortRef.current = abortController;
    const signal = abortController.signal;

    try {
      // Step 1: Check if there are any updates (delta check)
      const cursor = lastKnownServerTimestampRef.current;
      const useDelta = !forceFull && cursor !== null && initialLoadDoneRef.current;

      if (useDelta) {
        // Fast delta check: only fetch full list if something actually changed
        const deltaUrl = `/api/conversations?environment=${currentMode}&platform=${platformFilter}&leadStatus=${leadFilter}&since=${encodeURIComponent(cursor!)}&deltaOnly=true`;
        const deltaRes = await fetch(deltaUrl, { signal });

        if (signal.aborted) return;

        const deltaData = await deltaRes.json();
        // Update cursor regardless (server always returns a fresh serverTimestamp)
        if (deltaData.serverTimestamp) {
          lastKnownServerTimestampRef.current = deltaData.serverTimestamp;
        }

        // No updates in DB → skip the full fetch entirely
        if (deltaData.hasUpdates === false) {
          return;
        }
        // hasUpdates=true → fall through to full fetch below
      }

      // Step 2: Full conversation fetch (no since param)
      const fullUrl = `/api/conversations?environment=${currentMode}&platform=${platformFilter}&leadStatus=${leadFilter}`;
      const res = await fetch(fullUrl, { signal });

      if (signal.aborted) return;

      const data = await res.json();

      if (data.status === "success") {
        // Update cursor with authoritative server timestamp
        if (data.serverTimestamp) {
          lastKnownServerTimestampRef.current = data.serverTimestamp;
        }

        const convList = (data.conversations as Conversation[]) || [];
        setConversations(convList);
        setActiveConvId((prev) => {
          if (!prev || !convList.some((c) => c.id === prev)) {
            return convList.length > 0 ? convList[0].id : null;
          }
          return prev;
        });

        // ── Notification detection ──────────────────────────────────────────
        // Only fire for INBOUND messages (conversations where unreadCount > 0
        // AND lastMessageAt has increased since our last baseline).
        let hasNewInbound = false;
        let incomingToast: {
          id: string;
          name: string;
          platform: string;
          preview: string;
          convId: string;
        } | null = null;

        convList.forEach((conv) => {
          const lastTime = new Date(conv.lastMessageAt).getTime();
          const prevTime = knownTimestampsRef.current[conv.id];

          if (
            initialLoadDoneRef.current &&
            prevTime !== undefined &&
            lastTime > prevTime &&
            conv.unreadCount > 0  // only INBOUND messages increment unreadCount
          ) {
            hasNewInbound = true;
            incomingToast = {
              id: conv.id,
              name: conv.customer?.name || "Customer",
              platform: conv.platform,
              preview: conv.lastMessagePreview || "Sent a new message",
              convId: conv.id,
            };
          }
          knownTimestampsRef.current[conv.id] = lastTime;
        });

        if (!initialLoadDoneRef.current) {
          initialLoadDoneRef.current = true;
        } else if (hasNewInbound) {
          playNotificationChime();
          if (incomingToast) {
            setActiveToast(incomingToast);
          }
          if (typeof document !== "undefined") {
            document.title = "🔔 (1) New Message - BizPilot";
          }
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return; // request was intentionally cancelled
      console.error("Error fetching conversations:", err);
    } finally {
      // Only release lock if this is still the active controller
      if (convFetchAbortRef.current === abortController) {
        convFetchAbortRef.current = null;
      }
      isFetchingConvsRef.current = false;
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      if (data.status === "success") {
        setProducts(data.products);
        if (data.products.length > 0) {
          setSelectedProductId(data.products[0].id);
          setOrderNegotiatedPrice(data.products[0].price);
        }
      }
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  // ─── fetchActiveConversation ─────────────────────────────────────────────────
  /**
   * Fetches the full message thread for the active conversation.
   *
   * Generation tracking + AbortController guarantee that:
   * 1. Rapid switching A -> B -> C immediately cancels in-flight requests.
   * 2. Late responses from slow requests are immediately discarded
   *    and never overwrite the current active conversation.
   * 3. Response latency telemetry is recorded with high precision.
   */
  const fetchActiveConversation = async (
    id: string,
    forcedRequestId?: number,
    startTimeMs?: number
  ) => {
    const requestId = forcedRequestId ?? ++activeConvRequestIdRef.current;
    const start = startTimeMs ?? performance.now();

    // Abort previous in-flight active request
    if (activeFetchAbortRef.current) {
      activeFetchAbortRef.current.abort();
      activeFetchAbortRef.current = null;
    }

    const abortController = new AbortController();
    activeFetchAbortRef.current = abortController;

    try {
      const res = await fetch(`/api/conversations/${id}`, { signal: abortController.signal });

      if (abortController.signal.aborted) return;

      const data = await res.json();
      if (data.status === "success") {
        const conv = data.conversation as Conversation;

        // Strict Generation Guard:
        // Discard response if another switch occurred or active conversation changed
        if (requestId !== activeConvRequestIdRef.current || activeConvIdRef.current !== id) {
          console.log(`[INBOX][SWITCH] Stale response discarded for conv=${id} (gen=${requestId}, currentGen=${activeConvRequestIdRef.current})`);
          return;
        }

        const elapsed = Math.round(performance.now() - start);
        console.log(`[INBOX][PERF] Conversation ${id} loaded in ${elapsed}ms (msgs=${conv.messages?.length || 0})`);

        setActiveConv(conv);
        setOrderAddress(conv.customer?.deliveryAddress || "");
        setOrderPhone(conv.customer?.phone || "");

        const messages = conv.messages || [];
        const msgCount = messages.length;
        const prevCount = lastActiveMsgCountRef.current[id];
        if (prevCount !== undefined && msgCount > prevCount) {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg && lastMsg.direction === "INBOUND") {
            playNotificationChime();
          }
        }
        lastActiveMsgCountRef.current[id] = msgCount;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("Error fetching conversation details:", err);
    } finally {
      if (activeFetchAbortRef.current === abortController) {
        activeFetchAbortRef.current = null;
      }
    }
  };

  /**
   * Fast & Responsive Customer Selection Handler:
   * 1. Cancels previous in-flight requests immediately.
   * 2. Immediately updates active conversation ID and optimistic state (0ms UI lag).
   * 3. Launches dedicated thread fetch with monotonic generation counter.
   */
  const handleSelectConversation = (conv: Conversation) => {
    if (!conv?.id) return;
    if (activeConvId === conv.id) return;

    const start = performance.now();
    const nextGen = ++activeConvRequestIdRef.current;

    // 1. Immediately abort previous active request
    if (activeFetchAbortRef.current) {
      activeFetchAbortRef.current.abort();
      activeFetchAbortRef.current = null;
    }

    // 2. Immediately update state references
    activeConvIdRef.current = conv.id;
    setActiveConvId(conv.id);

    // 3. Optimistic Immediate Update:
    // Update customer profile & basic thread info instantly without waiting for network
    setActiveConv({
      ...conv,
      messages: conv.messages || [],
    });
    setReplyText("");
    setStagedMedia(null);

    // 4. Immediately launch fresh fetch with high-resolution generation tracking
    fetchActiveConversation(conv.id, nextGen, start);
  };

  const handleApproveSuggestion = async (suggestionText: string) => {
    if (!activeConvId || !suggestionText.trim()) return;
    setAiApprovalSending(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConvId,
          textContent: suggestionText.trim(),
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setReplyText("");
        setDismissedSuggestions((prev) => ({ ...prev, [activeConvId]: true }));
        fetchActiveConversation(activeConvId);
        fetchConversations();
      } else {
        alert(data.error || "Failed to send AI approved response");
      }
    } catch (err) {
      console.error("Error sending approved suggestion:", err);
    } finally {
      setAiApprovalSending(false);
    }
  };

  const handleEditSuggestion = (suggestionText: string) => {
    setReplyText(suggestionText);
  };

  const handleDismissSuggestion = () => {
    if (activeConvId) {
      setDismissedSuggestions((prev) => ({ ...prev, [activeConvId]: true }));
      setReplyText("");
    }
  };

  const handleToggleHandlingMode = async () => {
    if (!activeConvId || !activeConv) return;
    setHandlingToggleLoading(true);
    const newStatus = activeConv.status === "OWNER_HANDLING" ? "ACTIVE" : "OWNER_HANDLING";
    try {
      const res = await fetch(`/api/conversations/${activeConvId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setActiveConv((prev) => (prev ? { ...prev, status: newStatus } : null));
        fetchConversations();
      }
    } catch (err) {
      console.error("Error toggling conversation handling mode:", err);
    } finally {
      setHandlingToggleLoading(false);
    }
  };

  const handleSyncChannels = async () => {
    setSyncingChannels(true);
    try {
      const res = await fetch("/api/channels/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // explicit sync — no background flag
      });
      const data = await res.json();
      if (data.success) {
        if (data.syncedCount > 0) {
          playNotificationChime();
          setActiveToast({
            id: "sync_toast",
            name: "Channel Sync",
            platform: "FACEBOOK",
            preview: data.message,
            convId: activeConvId || "",
          });
        }
        // Force full re-fetch after manual sync (reset cursor)
        lastKnownServerTimestampRef.current = null;
        await fetchConversations({ forceFull: true });
        if (activeConvId) {
          await fetchActiveConversation(activeConvId);
        }
      } else {
        alert(data.message || data.error || "Channel sync failed");
      }
    } catch (err: any) {
      console.error("Error syncing channels:", err);
    } finally {
      setSyncingChannels(false);
    }
  };

  // ─── Effect 1: Conversation polling ─────────────────────────────────────────
  // Runs when inboxMode, platformFilter, or leadFilter changes.
  // Initial load: full fetch. Background interval: delta fetch.
  // Visibility handling: pause when hidden, immediately re-fetch when visible.
  useEffect(() => {
    // Full fetch on mount/mode-switch
    fetchConversations({ forceFull: true });
    fetchProducts();

    let convInterval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (convInterval) return; // already running
      convInterval = setInterval(() => {
        // Skip poll when tab is hidden — avoids wasting Vercel function invocations
        if (typeof document !== "undefined" && document.hidden) return;
        fetchConversations(); // delta poll (uses lastKnownServerTimestampRef)
      }, 2000);
    };

    const stopPolling = () => {
      if (convInterval) {
        clearInterval(convInterval);
        convInterval = null;
      }
    };

    // Start polling immediately
    startPolling();

    // Visibility change handler:
    // - Hidden: stop interval (pause)
    // - Visible: immediately fetch + restart interval
    const handleVisibilityChange = () => {
      if (typeof document === "undefined") return;
      if (document.hidden) {
        stopPolling();
      } else {
        // Immediate refresh on restore; then restart interval
        fetchConversations({ forceFull: false });
        startPolling();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      stopPolling();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [inboxMode, platformFilter, leadFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Effect 2: Active conversation thread polling ────────────────────────────
  useEffect(() => {
    if (!activeConvId) return;

    if (typeof document !== "undefined") {
      document.title = "BizPilot - Customer Messages";
    }

    const capturedConvId = activeConvId;
    const capturedGen = activeConvRequestIdRef.current;

    // Background interval polls the active thread every 2 seconds
    const chatInterval = setInterval(() => {
      // Ignore if tab is hidden or the conversation changed
      if (typeof document !== "undefined" && document.hidden) return;
      if (activeConvIdRef.current !== capturedConvId) return;
      fetchActiveConversation(capturedConvId, capturedGen);
    }, 2000);

    return () => clearInterval(chatInterval);
  }, [activeConvId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Effect 3: Background Meta reconciliation (LIVE mode only) ───────────────
  //
  // BUG FIX: `activeConvId` was previously in the dependency array, which caused
  // the 18s reconciliation timer to reset every time the user clicked a conversation.
  // Now `activeConvId` is accessed via `activeConvIdRef` (a stable ref) inside the
  // effect — so the timer only resets when inboxMode changes.
  //
  // MULTI-TAB COORDINATION: Uses BroadcastChannel to elect a single "leader" tab.
  // Only the leader fires POST /api/channels/sync. Other tabs rely on DB polling.
  // Leadership expires after 30 seconds; any tab can take over on leader failure.
  useEffect(() => {
    if (inboxMode !== "LIVE") return;

    // BroadcastChannel leader election — gracefully falls back if unavailable
    let bc: BroadcastChannel | null = null;
    let isLeader = false;
    let leaderHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let leaderCheckTimer: ReturnType<typeof setInterval> | null = null;
    let lastLeaderHeartbeat = 0;
    const LEADER_TIMEOUT_MS = 30_000; // assume leader dead after 30s of silence
    const HEARTBEAT_INTERVAL_MS = 10_000;

    const tryBecomeLeader = () => {
      if (isLeader) return;
      const now = Date.now();
      if (now - lastLeaderHeartbeat > LEADER_TIMEOUT_MS) {
        isLeader = true;
        bc?.postMessage({ type: "LEADER_ELECTED" });
      }
    };

    if (typeof BroadcastChannel !== "undefined") {
      try {
        bc = new BroadcastChannel("bizpilot_reconcile_leader");
        bc.onmessage = (e) => {
          if (e.data?.type === "LEADER_HEARTBEAT") {
            lastLeaderHeartbeat = Date.now();
            isLeader = false; // yield leadership to the active heartbeat sender
          } else if (e.data?.type === "LEADER_ELECTED") {
            lastLeaderHeartbeat = Date.now();
            isLeader = false;
          }
        };

        // Wait one full timeout before competing for leadership
        // (so the existing leader can announce itself first)
        const electTimer = setTimeout(tryBecomeLeader, LEADER_TIMEOUT_MS);

        leaderCheckTimer = setInterval(tryBecomeLeader, LEADER_TIMEOUT_MS);

        leaderHeartbeatTimer = setInterval(() => {
          if (isLeader) {
            bc?.postMessage({ type: "LEADER_HEARTBEAT" });
          }
        }, HEARTBEAT_INTERVAL_MS);

        // Cleanup elect timer on effect teardown
        return () => {
          clearTimeout(electTimer);
          clearInterval(leaderHeartbeatTimer!);
          clearInterval(leaderCheckTimer!);
          bc?.close();
        };
      } catch {
        // BroadcastChannel failed — become leader unconditionally (safe, DB is idempotent)
        isLeader = true;
      }
    } else {
      // No BroadcastChannel support — become leader unconditionally
      isLeader = true;
    }

    const runAutoReconciliation = async () => {
      if (!isLeader) return; // non-leader tabs skip Meta API calls
      if (isAutoReconcilingRef.current) return;
      isAutoReconcilingRef.current = true;
      try {
        const res = await fetch("/api/channels/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ background: true }),
        });
        const data = await res.json();
        if (data.success && data.syncedCount > 0) {
          console.log(`[AUTO-RECONCILE] Ingested ${data.syncedCount} new message(s).`);
          // New messages in DB → trigger immediate full fetch (bypass delta cursor)
          lastKnownServerTimestampRef.current = null;
          fetchConversations({ targetMode: "LIVE", forceFull: true });
          const currentActiveId = activeConvIdRef.current;
          if (currentActiveId) {
            fetchActiveConversation(currentActiveId);
          }
        }
      } catch {
        // Graceful silent fallback — next interval will retry
      } finally {
        isAutoReconcilingRef.current = false;
      }
    };

    // Run after 3s initially (give webhook path a chance), then every 20s
    const initialTimer = setTimeout(runAutoReconciliation, 3000);
    const reconInterval = setInterval(runAutoReconciliation, 20000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(reconInterval);
      if (leaderHeartbeatTimer) clearInterval(leaderHeartbeatTimer);
      if (leaderCheckTimer) clearInterval(leaderCheckTimer);
      bc?.close();
    };
  }, [inboxMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Effect 4: SSE (optional fast-path) ─────────────────────────────────────
  // SSE is NOT the authoritative delivery path on Vercel serverless. The in-memory
  // broadcaster cannot bridge across Lambda invocations. SSE is kept as a best-effort
  // latency optimization: when it works (same-process), it triggers an immediate
  // fetch. When it fails (different instance), DB polling recovers the message.
  useEffect(() => {
    let eventSource: EventSource | null = null;

    if (typeof window !== "undefined" && "EventSource" in window) {
      try {
        eventSource = new EventSource(`/api/realtime?environment=${inboxMode}`);

        eventSource.onmessage = (e) => {
          try {
            const event = JSON.parse(e.data);
            if (event.type === "message.created") {
              // Safety: ignore cross-environment events
              if (event.environment && event.environment !== inboxMode) {
                return;
              }

              // SSE event → force an immediate full fetch (bypass delta cursor)
              lastKnownServerTimestampRef.current = null;
              fetchConversations({ targetMode: inboxMode, forceFull: true });

              // If event belongs to currently active conversation, refresh thread
              const currentActiveId = activeConvIdRef.current;
              if (currentActiveId && event.conversationId === currentActiveId) {
                fetchActiveConversation(currentActiveId);
              }

              // Notification: only for INBOUND events (SSE provides direction field)
              if (event.direction === "INBOUND") {
                playNotificationChime();
                setActiveToast({
                  id: event.conversationId,
                  name: event.senderName || "Customer",
                  platform: event.platform,
                  preview: event.preview || "Sent a message",
                  convId: event.conversationId,
                });
                if (typeof document !== "undefined") {
                  document.title = "🔔 (1) New Message - BizPilot";
                }
              }
            }
          } catch {
            // Heartbeat/ping — ignore parse errors
          }
        };

        eventSource.onerror = () => {
          // DB polling continues seamlessly — SSE failure is non-fatal
          eventSource?.close();
        };
      } catch {
        // SSE unavailable — polling is the fallback
      }
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [inboxMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Smooth auto-scroll to bottom whenever new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages?.length, activeConvId, aiSuggestionMinimized]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.status === "success") {
        setStagedMedia({
          file,
          previewUrl: data.url,
          mediaType: data.mediaType,
          filename: data.filename || file.name,
        });
      } else {
        alert(data.error || "Failed to upload file");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      alert("Error uploading media file");
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const triggerMediaUpload = (acceptType: string) => {
    if (!fileInputRef.current) return;
    fileInputRef.current.accept = acceptType;
    fileInputRef.current.click();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasText = Boolean(replyText.trim());
    const hasMedia = Boolean(stagedMedia?.previewUrl);

    if ((!hasText && !hasMedia) || !activeConvId) return;

    setSending(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConvId,
          textContent: replyText.trim(),
          mediaUrl: stagedMedia?.previewUrl,
          mediaType: stagedMedia?.mediaType,
          filename: stagedMedia?.filename,
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setReplyText("");
        setStagedMedia(null);
        fetchActiveConversation(activeConvId);
        fetchConversations();
      } else {
        alert(data.error || data.message || "Failed to send message");
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || !selectedProductId) return;

    setCreatingOrder(true);
    setOrderSuccessMessage("");

    const chosenProduct = products.find((p) => p.id === selectedProductId);
    const catalogPrice = chosenProduct?.price || 0;
    const agreedPrice = orderNegotiatedPrice ? Number(orderNegotiatedPrice) : catalogPrice;

    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: activeConv.customer.id,
          conversationId: activeConv.id,
          environment: inboxMode,
          fulfillmentMethod: orderFulfillment,
          source: activeConv.customer.source || activeConv.platform,
          items: [
            {
              productId: selectedProductId,
              quantity: orderQuantity,
              agreedUnitPrice: agreedPrice,
            },
          ],
          paymentMethod: orderPaymentMethod,
          shippingFee: 0,
          deliveryAddress: orderAddress,
          customerPhone: orderPhone,
          courier: orderCourier,
          courierTracking: orderLbcTracking,
          meetupLocation: orderMeetupLocation,
          meetupSchedule: orderMeetupSchedule,
          pickupLocation: orderPickupLocation,
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setOrderSuccessMessage(`Order ${data.order.orderNumber} successfully created!`);
        setTimeout(() => {
          setShowOrderModal(false);
          setOrderSuccessMessage("");
        }, 1800);
        fetchActiveConversation(activeConv.id);
        fetchConversations();
      } else {
        alert(data.error || "Failed to create order");
      }
    } catch (err) {
      console.error("Error creating order:", err);
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleQuickNegotiation = async (type: "ACCEPT" | "COUNTER" | "REJECT" | "ACCEPT_OFFER" | "COUNTER_OFFER", counterAmount?: number) => {
    if (!activeConv || !activeConv.customer.leads || activeConv.customer.leads.length === 0) return;
    const lead = activeConv.customer.leads[0];

    const action = type === "ACCEPT_OFFER" ? "ACCEPT" : type === "COUNTER_OFFER" ? "COUNTER" : type;
    const effectiveCounter = counterAmount !== undefined ? counterAmount : (customOfferInput ? Number(customOfferInput) : undefined);

    setNegotiatingAction(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/negotiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          counterPrice: effectiveCounter,
          notes: `Quick action from Inbox: ${action}`,
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        if (type === "ACCEPT_OFFER" && customOfferInput) {
          setOrderNegotiatedPrice(Number(customOfferInput));
          setShowOrderModal(true);
        }
        fetchActiveConversation(activeConv.id);
        fetchConversations();
        setCustomOfferInput("");
      }
    } catch (err) {
      console.error("Negotiation error:", err);
    } finally {
      setNegotiatingAction(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const catalogPrice = selectedProduct?.price || 0;
  const currentAgreedPrice = orderNegotiatedPrice !== "" ? Number(orderNegotiatedPrice) : catalogPrice;
  const unitDiscount = Math.max(0, catalogPrice - currentAgreedPrice);
  const totalOrderAmount = currentAgreedPrice * orderQuantity;

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-sky-600" />
              Unified Business Inbox & Sales Hub
            </h1>
            <AboutPageButton onClick={openIntro} />
          </div>
          <p className="text-xs text-slate-500">
            Omnichannel customer conversations, real-time negotiation, and physical fulfillment orders
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Environment Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => switchInboxMode("LIVE")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 ${
                inboxMode === "LIVE"
                  ? "bg-white text-slate-900 shadow-2xs border border-slate-200/60"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Live Channels
            </button>
            <button
              onClick={() => switchInboxMode("PRACTICE")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 ${
                inboxMode === "PRACTICE"
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Practice Simulator
            </button>
          </div>

          {/* Platform Filter */}
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">All Platforms</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="TIKTOK">TikTok</option>
          </select>

          {/* Lead Filter */}
          <select
            value={leadFilter}
            onChange={(e) => setLeadFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">All Lead Types</option>
            <option value="HOT">🔥 Hot Leads</option>
            <option value="WARM">⚡ Warm Leads</option>
            <option value="CONVERTED">✅ Converted Buyers</option>
          </select>

          {/* Notification Chime Sound Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playNotificationChime();
            }}
            title={soundEnabled ? "Pop chime sound is ON (Click to mute)" : "Pop chime sound is MUTED (Click to unmute)"}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              soundEnabled
                ? "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100 shadow-2xs"
                : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
            }`}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-sky-600 animate-pulse" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden sm:inline">{soundEnabled ? "Sound ON" : "Muted"}</span>
          </button>
        </div>
      </div>

      {inboxMode === "PRACTICE" && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-purple-900">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-purple-600 shrink-0" />
            <span>
              <strong>Practice Simulator Mode:</strong> You are viewing simulated practice conversations. These are isolated from your live Facebook, Instagram, WhatsApp, and TikTok channels.
            </span>
          </div>
          <Link
            href="/simulator"
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg shrink-0 transition-colors inline-flex items-center gap-1"
          >
            Open Simulator Studio
          </Link>
        </div>
      )}

      <ModuleIntroModal config={INBOX_INTRO_CONFIG} isOpen={isIntroOpen} onClose={closeIntro} />

      {/* 3-Column Layout (Responsive Mobile & Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-210px)] min-h-[580px]">
        {/* Column 1: Conversations List */}
        <div className={`${activeConvId ? "hidden lg:flex" : "flex"} lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm flex-col overflow-hidden`}>
          <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Inbox ({conversations.length})</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSyncChannels}
                disabled={syncingChannels}
                className="px-2 py-0.5 bg-sky-50 text-sky-600 hover:bg-sky-100 border border-sky-200 rounded text-[10px] font-bold inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                title="Pull and fetch latest messages directly from connected Facebook Page"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${syncingChannels ? "animate-spin" : ""}`} />
                {syncingChannels ? "Syncing..." : "Sync FB"}
              </button>
              <button onClick={() => fetchConversations()} className="text-slate-400 hover:text-slate-600 p-0.5" title="Refresh local inbox">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading inbox...</div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No conversations found. Inbound chats or simulator events will appear here.
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = conv.id === activeConvId;
                const isHot = conv.customer.leadScore >= 80;

                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`w-full text-left p-3 transition-colors flex items-start gap-3 ${
                      isSelected ? "bg-sky-50/80 border-l-4 border-sky-600" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                        {conv.customer.name.charAt(0)}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-[8px] flex items-center justify-center font-bold text-white ${
                          conv.platform === "FACEBOOK"
                            ? "bg-blue-600"
                            : conv.platform === "INSTAGRAM"
                            ? "bg-pink-600"
                            : conv.platform === "WHATSAPP"
                            ? "bg-emerald-600"
                            : "bg-black"
                        }`}
                      >
                        {conv.platform.charAt(0)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {conv.customer.name}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(conv.lastMessageAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 truncate mb-1.5">
                        {conv.lastMessagePreview || "No preview"}
                      </p>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isHot
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {conv.customer.leadScore} pts • {conv.customer.leadStatus}
                        </span>
                        {conv.customer.orderCount > 0 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            {conv.customer.orderCount} Order(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Chat & Negotiation Thread */}
        <div className={`${!activeConvId ? "hidden lg:flex" : "flex"} lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm flex-col overflow-hidden`}>
          {activeConv ? (
            <>
              {/* Thread Header */}
              <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (activeFetchAbortRef.current) {
                        activeFetchAbortRef.current.abort();
                        activeFetchAbortRef.current = null;
                      }
                      activeConvIdRef.current = null;
                      setActiveConvId(null);
                      setActiveConv(null);
                    }}
                    className="lg:hidden p-1.5 -ml-1 rounded-lg hover:bg-slate-200 text-slate-600"
                    title="Back to inbox"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-slate-900 truncate max-w-[130px] sm:max-w-[200px]">
                        {activeConv.customer.name}
                      </span>
                      {activeConv.platform === "MANUAL" || activeConv.platform === "SIMULATOR" ? (
                        <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded font-bold">
                          Practice Mode
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-semibold">
                          {activeConv.platform}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Conversation Mode / Owner Takeover Toggle */}
                  <button
                    onClick={handleToggleHandlingMode}
                    disabled={handlingToggleLoading}
                    title={activeConv.status === "OWNER_HANDLING" ? "Click to enable AI assistance" : "Click to take over manually"}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-colors shadow-2xs ${
                      activeConv.status === "OWNER_HANDLING"
                        ? "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"
                        : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                    }`}
                  >
                    {activeConv.status === "OWNER_HANDLING" ? (
                      <>
                        <User className="w-3 h-3 text-sky-600" />
                        <span>Owner Handling</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-3 h-3 text-purple-600" />
                        <span>AI Assisting</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setShowMobileProfile(true)}
                    className="lg:hidden px-2.5 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1"
                  >
                    <User className="w-3.5 h-3.5 text-purple-600" />
                    Details
                  </button>

                  <button
                    onClick={() => setShowOrderModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">1-Click</span> Order
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
                {activeConv.messages?.map((msg) => {
                  let actor: "CUSTOMER" | "OWNER" | "AI" = "OWNER";
                  if (msg.direction === "INBOUND") {
                    actor = "CUSTOMER";
                  } else if (msg.rawPayload) {
                    try {
                      const payload = typeof msg.rawPayload === "string" ? JSON.parse(msg.rawPayload) : msg.rawPayload;
                      if (payload.actorType === "AI" || payload.senderRole === "AI" || payload.isAiAutoReply) {
                        actor = "AI";
                      } else if (payload.actorType === "CUSTOMER" || payload.senderRole === "CUSTOMER") {
                        actor = "CUSTOMER";
                      } else {
                        actor = "OWNER";
                      }
                    } catch {
                      actor = "OWNER";
                    }
                  }

                  const isCustomer = actor === "CUSTOMER";
                  const isAi = actor === "AI";

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isCustomer ? "items-start" : "items-end"}`}
                    >
                      {/* Actor Label */}
                      <div className="text-[10px] font-bold mb-1 flex items-center gap-1.5 px-1">
                        {isCustomer ? (
                          <>
                            <User className="w-3 h-3 text-slate-400" />
                            <span className="text-slate-800 font-bold">{activeConv.customer.name}</span>
                            <span className="text-[9px] text-slate-400 font-normal">({activeConv.platform})</span>
                          </>
                        ) : isAi ? (
                          <>
                            <Bot className="w-3 h-3 text-purple-600" />
                            <span className="text-purple-700 font-bold">BizPilot AI (Auto-Reply)</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3 h-3 text-sky-600" />
                            <span className="text-sky-700 font-bold">Store Owner</span>
                          </>
                        )}
                      </div>

                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm ${
                          isCustomer
                            ? "bg-white text-slate-900 border border-slate-200 rounded-bl-xs"
                            : isAi
                            ? "bg-gradient-to-r from-purple-700 to-indigo-700 text-white rounded-br-xs"
                            : "bg-sky-600 text-white rounded-br-xs"
                        }`}
                      >
                        {/* Rich Media Previews (Image, Video, Audio, Document, Location, Sticker) */}
                        {(() => {
                          const mediaUrl = msg.mediaUrl;
                          let mediaType = (msg.mediaType || "").toUpperCase();
                          let parsedPayload: any = {};
                          if (msg.rawPayload) {
                            try {
                              parsedPayload = typeof msg.rawPayload === "string" ? JSON.parse(msg.rawPayload) : msg.rawPayload;
                              if (!mediaType && parsedPayload.messageType) {
                                mediaType = parsedPayload.messageType;
                              }
                            } catch {}
                          }

                          if (!mediaUrl && !parsedPayload.locationMetadata) return null;

                          if (mediaUrl && (mediaType === "IMAGE" || /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(mediaUrl))) {
                            const imgUrl: string = mediaUrl;
                            return (
                              <div className="mb-2 relative group overflow-hidden rounded-xl border border-slate-200/60 bg-black/5">
                                <img
                                  src={imgUrl}
                                  alt="Attachment"
                                  onClick={() => setLightboxMedia({ url: imgUrl, title: isCustomer ? activeConv.customer.name : "Store Owner", type: "IMAGE" })}
                                  className="max-h-64 max-w-full rounded-xl object-cover cursor-zoom-in transition-transform duration-200 group-hover:scale-102"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => setLightboxMedia({ url: imgUrl, title: isCustomer ? activeConv.customer.name : "Store Owner", type: "IMAGE" })}
                                  className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] font-bold px-1.5"
                                >
                                  <Maximize2 className="w-3 h-3" />
                                  Full View
                                </button>
                              </div>
                            );
                          }

                          if (mediaType === "VIDEO" || (mediaUrl && /\.(mp4|webm|mov)($|\?)/i.test(mediaUrl))) {
                            return (
                              <div className="mb-2 overflow-hidden rounded-xl border border-slate-200/60 bg-black">
                                <video
                                  src={mediaUrl}
                                  controls
                                  preload="metadata"
                                  className="max-h-64 w-full rounded-xl"
                                />
                              </div>
                            );
                          }

                          if (mediaType === "AUDIO" || (mediaUrl && /\.(mp3|ogg|wav|m4a|aac)($|\?)/i.test(mediaUrl))) {
                            return (
                              <div className="mb-2 p-2 bg-white/10 rounded-xl border border-white/20">
                                <div className="flex items-center gap-1.5 mb-1 text-[11px] font-bold">
                                  <Music className="w-3.5 h-3.5" />
                                  <span>Voice / Audio Message</span>
                                </div>
                                <audio src={mediaUrl} controls className="w-full h-8" />
                              </div>
                            );
                          }

                          if (mediaType === "DOCUMENT" || (mediaUrl && /\.(pdf|doc|docx|txt)($|\?)/i.test(mediaUrl))) {
                            const filename = parsedPayload.mediaMetadata?.filename || parsedPayload.filename || "Attached Document";
                            return (
                              <div className="mb-2 p-2.5 bg-slate-100 dark:bg-white/10 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 text-slate-800 dark:text-white">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-5 h-5 text-sky-600 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-bold text-xs truncate">{filename}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-300">Document Attachment</p>
                                  </div>
                                </div>
                                <a
                                  href={`/api/media/proxy?messageId=${msg.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1 shrink-0 shadow-2xs"
                                >
                                  <Download className="w-3 h-3" />
                                  View
                                </a>
                              </div>
                            );
                          }

                          if (parsedPayload.locationMetadata) {
                            const loc = parsedPayload.locationMetadata;
                            return (
                              <div className="mb-2 p-2.5 bg-emerald-50 text-emerald-950 rounded-xl border border-emerald-200">
                                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                                  <MapPin className="w-4 h-4 text-emerald-600" />
                                  <span>{loc.name || "Shared Location"}</span>
                                </div>
                                {loc.address && <p className="text-[11px] text-slate-600 mb-1.5">{loc.address}</p>}
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-bold text-emerald-700 hover:underline inline-flex items-center gap-1"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Open in Google Maps
                                </a>
                              </div>
                            );
                          }

                          return null;
                        })()}

                        {/* Text message content */}
                        {msg.textContent}

                        {isCustomer && msg.aiClassification && (
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-purple-700 font-semibold">
                            <Sparkles className="w-3 h-3 text-purple-600" />
                            Detected: {msg.aiClassification}
                          </div>
                        )}
                      </div>

                      <span className="text-[9px] text-slate-400 mt-1 px-1">
                        {new Date(msg.sentAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  );
                })}
                {/* Auto-scroll anchor to guarantee newest message is always in full view */}
                <div ref={messagesEndRef} />
              </div>

              {/* Grounded AI Suggestion Card (Safe Approval Mode - Collapsible & Non-Intrusive) */}
              {(() => {
                const lastInbound = activeConv.messages
                  ? [...activeConv.messages].reverse().find((m) => m.direction === "INBOUND" && m.aiSuggestedReply)
                  : null;
                const suggestion = (lastInbound && !dismissedSuggestions[activeConv.id]) ? lastInbound.aiSuggestedReply : null;

                if (!suggestion) return null;

                if (aiSuggestionMinimized) {
                  return (
                    <div className="px-3 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 border-t border-purple-200 flex items-center justify-between gap-2 shadow-2xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-purple-600 text-white shrink-0 shadow-2xs">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[11px] font-bold text-purple-950 shrink-0">AI Reply Ready:</span>
                          <span className="text-[11px] text-slate-600 truncate italic">"{suggestion}"</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setAiSuggestionMinimized(false)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-slate-100 text-purple-900 border border-purple-200 rounded-md text-[11px] font-bold shadow-2xs transition-colors"
                        >
                          <ChevronUp className="w-3 h-3 text-purple-600" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveSuggestion(suggestion)}
                          disabled={aiApprovalSending}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-[11px] font-bold shadow-2xs transition-colors disabled:opacity-50"
                        >
                          <Send className="w-2.5 h-2.5" />
                          {aiApprovalSending ? "Sending..." : "Approve"}
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="p-2.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-sky-50 border-t border-purple-200 space-y-1.5 shadow-2xs transition-all animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-purple-600" />
                        <span className="text-xs font-black text-purple-950">
                          Grounded AI Suggestion (Safe Approval Mode)
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setAiSuggestionMinimized(true)}
                          className="text-slate-500 hover:text-slate-800 p-1 rounded hover:bg-purple-100/60 transition-colors flex items-center gap-1 text-[11px] font-medium"
                          title="Minimize AI card"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Minimize</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDismissSuggestion}
                          className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-purple-100/60 transition-colors"
                          title="Dismiss suggestion"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-24 overflow-y-auto pr-1">
                      <p className="text-xs text-slate-800 bg-white/90 p-2 rounded-lg border border-purple-100 leading-relaxed shadow-2xs font-medium">
                        {suggestion}
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleEditSuggestion(suggestion)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-bold transition-colors shadow-2xs"
                      >
                        <Edit2 className="w-3 h-3 text-slate-500" />
                        Edit in Composer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveSuggestion(suggestion)}
                        disabled={aiApprovalSending}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold transition-colors shadow-sm disabled:opacity-50"
                      >
                        <Send className="w-3 h-3" />
                        {aiApprovalSending ? "Sending..." : "Approve & Send"}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Quick Negotiation Bar */}
              <div className="p-2.5 bg-amber-50/70 border-t border-amber-200 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1 text-amber-900 font-bold">
                  <Tag className="w-3.5 h-3.5 text-amber-600" />
                  Negotiate:
                </div>
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    type="number"
                    placeholder="Offer (₱)"
                    value={customOfferInput}
                    onChange={(e) => setCustomOfferInput(e.target.value)}
                    className="w-24 px-2 py-1 border border-amber-300 rounded bg-white text-xs font-mono"
                  />
                  <button
                    onClick={() => handleQuickNegotiation("ACCEPT_OFFER")}
                    disabled={!customOfferInput || negotiatingAction}
                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition-colors disabled:opacity-50"
                  >
                    Accept Offer
                  </button>
                  <button
                    onClick={() => handleQuickNegotiation("COUNTER_OFFER")}
                    disabled={!customOfferInput || negotiatingAction}
                    className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold transition-colors disabled:opacity-50"
                  >
                    Counter
                  </button>
                </div>
              </div>

              {/* Reply Input Box & Multi-Type Media Attachment */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white">
                {/* Staged Media Attachment Preview */}
                {stagedMedia && (
                  <div className="mb-2 p-2 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2 min-w-0">
                      {stagedMedia.mediaType === "IMAGE" ? (
                        <img src={stagedMedia.previewUrl} alt="Staged" className="w-10 h-10 object-cover rounded-lg border border-sky-300 shrink-0" />
                      ) : stagedMedia.mediaType === "VIDEO" ? (
                        <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center rounded-lg shrink-0">
                          <Film className="w-5 h-5 text-sky-400" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-sky-100 text-sky-700 flex items-center justify-center rounded-lg shrink-0">
                          <FileText className="w-5 h-5 text-sky-600" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{stagedMedia.filename}</p>
                        <p className="text-[10px] text-sky-700 font-medium">{stagedMedia.mediaType} ready to send</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStagedMedia(null)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-sky-100"
                      title="Remove attachment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Hidden Multi-Type File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="flex items-end gap-2">
                  {/* Dynamic Capability-Driven Media Action Buttons */}
                  {(() => {
                    const caps = getPlatformCapabilities(activeConv.platform);
                    return (
                      <div className="flex items-center gap-1 pb-1">
                        {/* Attach Photo Button */}
                        <button
                          type="button"
                          onClick={() => triggerMediaUpload("image/jpeg,image/png,image/webp,image/gif")}
                          disabled={uploadingMedia || !caps.outbound.image}
                          title={caps.outbound.image ? "Attach photo / image" : `Image sending not supported on ${activeConv.platform}`}
                          className={`p-2 rounded-xl transition-colors ${
                            caps.outbound.image
                              ? "text-slate-500 hover:text-sky-600 hover:bg-sky-50 border border-slate-200"
                              : "text-slate-300 border border-slate-100 cursor-not-allowed opacity-50"
                          }`}
                        >
                          <Camera className="w-4 h-4" />
                        </button>

                        {/* Attach Video Button */}
                        <button
                          type="button"
                          onClick={() => triggerMediaUpload("video/mp4,video/webm,video/quicktime")}
                          disabled={uploadingMedia || !caps.outbound.video}
                          title={caps.outbound.video ? "Attach video" : `Video sending not supported on ${activeConv.platform}`}
                          className={`p-2 rounded-xl transition-colors ${
                            caps.outbound.video
                              ? "text-slate-500 hover:text-sky-600 hover:bg-sky-50 border border-slate-200"
                              : "text-slate-300 border border-slate-100 cursor-not-allowed opacity-50"
                          }`}
                        >
                          <Film className="w-4 h-4" />
                        </button>

                        {/* Attach File Button */}
                        <button
                          type="button"
                          onClick={() => triggerMediaUpload("application/pdf,application/msword,text/plain")}
                          disabled={uploadingMedia || !caps.outbound.document}
                          title={caps.outbound.document ? "Attach document" : `Document sending not supported on ${activeConv.platform}`}
                          className={`p-2 rounded-xl transition-colors ${
                            caps.outbound.document
                              ? "text-slate-500 hover:text-sky-600 hover:bg-sky-50 border border-slate-200"
                              : "text-slate-300 border border-slate-100 cursor-not-allowed opacity-50"
                          }`}
                        >
                          <Paperclip className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })()}

                  <textarea
                    rows={2}
                    placeholder={uploadingMedia ? "Uploading attachment..." : "Type your response to the buyer..."}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={uploadingMedia}
                    className="flex-1 text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none disabled:bg-slate-50"
                  />

                  <button
                    type="submit"
                    disabled={sending || uploadingMedia || (!replyText.trim() && !stagedMedia)}
                    className="p-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-slate-400">
              Select a conversation from the left to start chatting and negotiating.
            </div>
          )}
        </div>

        {/* Column 3: Customer Intelligence & History (Desktop Sidebar + Mobile Drawer) */}
        <div className={`
          ${showMobileProfile ? "fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" : "hidden lg:flex"}
          lg:static lg:bg-transparent lg:p-0 lg:col-span-3
        `}>
          <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-200 shadow-xl lg:shadow-sm p-5 lg:p-4 w-full max-w-md lg:max-w-none flex flex-col gap-4 overflow-y-auto max-h-[85vh] lg:max-h-none">
            {activeConv ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Customer Profile
                    </h3>
                    <div className="font-bold text-sm text-slate-900">{activeConv.customer.name}</div>
                    <div className="text-xs text-slate-500">
                      Source: <span className="font-semibold text-slate-700">{activeConv.customer.source || activeConv.customer.primaryPlatform}</span>
                    </div>
                  </div>
                  {showMobileProfile && (
                    <button
                      onClick={() => setShowMobileProfile(false)}
                      className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lifetime Value</span>
                    <span className="font-bold text-slate-900">{formatPhp(activeConv.customer.lifetimeValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Completed Orders</span>
                    <span className="font-bold text-slate-900">{activeConv.customer.orderCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lead Score</span>
                    <span className="font-bold text-rose-600">{activeConv.customer.leadScore}/100</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-1.5">Contact & Delivery</h4>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {activeConv.customer.phone || "No phone registered"}
                    </div>
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      {activeConv.customer.deliveryAddress || "No address on file"}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-1.5">Preferred Fulfillment</h4>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-100 text-purple-800">
                    {activeConv.customer.preferredFulfillment || "Meetup / Courier"}
                  </span>
                </div>

                {showMobileProfile && (
                  <button
                    onClick={() => setShowMobileProfile(false)}
                    className="lg:hidden w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors mt-2"
                  >
                    Close Profile Details
                  </button>
                )}
              </>
            ) : (
              <div className="text-center text-xs text-slate-400 py-12">
                Select a customer to view buying history and intelligence.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 1-Click Order Creation Modal with Negotiation & Fulfillment */}
      {showOrderModal && activeConv && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">Create Negotiated Order</h3>
              </div>
              <button onClick={() => setShowOrderModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {orderSuccessMessage ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-center font-bold text-sm">
                {orderSuccessMessage}
              </div>
            ) : (
              <form onSubmit={handleCreateOrder} className="space-y-4">
                {/* Product Selection */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Select Product</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      setSelectedProductId(e.target.value);
                      const p = products.find((prod) => prod.id === e.target.value);
                      if (p) setOrderNegotiatedPrice(p.price);
                    }}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) — Catalog: {formatPhp(p.price)} (Stock: {p.stockQuantity})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price & Quantity & Negotiated Discount */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Catalog Price</label>
                    <div className="p-2.5 bg-slate-100 rounded-xl text-xs font-mono text-slate-600">
                      {formatPhp(catalogPrice)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Agreed Unit Price</label>
                    <input
                      type="number"
                      value={orderNegotiatedPrice}
                      onChange={(e) => setOrderNegotiatedPrice(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Quantity</label>
                    <input
                      type="number"
                      min={1}
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 1)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {/* Discount Feedback */}
                {unitDiscount > 0 && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex justify-between font-semibold">
                    <span>Negotiated Unit Discount: -{formatPhp(unitDiscount)}</span>
                    <span>Total Savings: -{formatPhp(unitDiscount * orderQuantity)}</span>
                  </div>
                )}

                {/* Fulfillment Selection */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Fulfillment Method</label>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {[
                      { id: "MEETUP", label: "🤝 Meetup" },
                      { id: "LBC", label: "📦 LBC" },
                      { id: "COURIER", label: "🚚 Courier" },
                      { id: "DELIVERY", label: "🛵 Direct" },
                    ].map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setOrderFulfillment(m.id)}
                        className={`py-2 px-2 rounded-xl font-bold border transition-colors ${
                          orderFulfillment === m.id
                            ? "bg-sky-50 border-sky-600 text-sky-700"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contextual Fulfillment Fields */}
                {orderFulfillment === "MEETUP" && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-purple-50/50 rounded-xl border border-purple-200">
                    <div>
                      <label className="text-xs font-bold text-purple-900">Agreed Meetup Location</label>
                      <input
                        type="text"
                        placeholder="e.g. SM Fairview, Trinoma, MRT Station"
                        value={orderMeetupLocation}
                        onChange={(e) => setOrderMeetupLocation(e.target.value)}
                        className="w-full text-xs p-2 border border-purple-200 rounded-lg bg-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-purple-900">Meetup Date</label>
                      <input
                        type="date"
                        value={orderMeetupSchedule}
                        onChange={(e) => setOrderMeetupSchedule(e.target.value)}
                        className="w-full text-xs p-2 border border-purple-200 rounded-lg bg-white mt-1"
                      />
                    </div>
                  </div>
                )}

                {orderFulfillment === "LBC" && (
                  <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200 space-y-2">
                    <label className="text-xs font-bold text-rose-900">Manual LBC Tracking / Waybill #</label>
                    <input
                      type="text"
                      placeholder="e.g. LBC-987654321"
                      value={orderLbcTracking}
                      onChange={(e) => setOrderLbcTracking(e.target.value)}
                      className="w-full text-xs p-2 border border-rose-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                )}

                {(orderFulfillment === "COURIER" || orderFulfillment === "DELIVERY") && (
                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2">
                    <label className="text-xs font-bold text-blue-900">Courier / Dispatch Service</label>
                    <input
                      type="text"
                      placeholder="e.g. Grab Express, Lalamove, Direct Dispatch"
                      value={orderCourier}
                      onChange={(e) => setOrderCourier(e.target.value)}
                      className="w-full text-xs p-2 border border-blue-200 rounded-lg bg-white"
                    />
                  </div>
                )}

                {/* Delivery & Contact Details */}
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Delivery Address</label>
                    <input
                      type="text"
                      placeholder="Street, Barangay, City"
                      value={orderAddress}
                      onChange={(e) => setOrderAddress(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Contact Number</label>
                    <input
                      type="text"
                      placeholder="0917-000-0000"
                      value={orderPhone}
                      onChange={(e) => setOrderPhone(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white mt-1"
                    />
                  </div>
                </div>

                {/* Payment Method */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Payment Method</label>
                  <select
                    value={orderPaymentMethod}
                    onChange={(e) => setOrderPaymentMethod(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                  >
                    <option value="GCASH">GCash</option>
                    <option value="MAYA">Maya</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash (Immediate or Meetup Settlement)</option>
                    <option value="COD">Cash on Delivery (COD)</option>
                  </select>
                </div>

                {/* Grand Total */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Total Order Amount:</span>
                  <span className="text-lg font-bold text-sky-700">{formatPhp(totalOrderAmount)}</span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowOrderModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingOrder}
                    className="px-5 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-sm transition-colors disabled:opacity-50"
                  >
                    {creatingOrder ? "Creating Order..." : "Confirm & Create Order"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Floating Real-time Inbound Message Pop-up Toast */}
      {activeToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 shadow-2xl rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-400 shrink-0">
                <Bell className="w-5 h-5 animate-bounce" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-100 truncate">{activeToast.name}</h4>
                  <span className="text-[10px] font-semibold bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded-md border border-sky-400/30 shrink-0">
                    {activeToast.platform}
                  </span>
                </div>
                <p className="text-xs text-slate-300 line-clamp-1 mt-0.5">
                  {activeToast.preview}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors shrink-0"
              title="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              onClick={() => setActiveToast(null)}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Dismiss
            </button>
            <button
              onClick={() => {
                const targetConv = conversations.find((c) => c.id === activeToast.convId);
                if (targetConv) {
                  handleSelectConversation(targetConv);
                } else {
                  activeConvIdRef.current = activeToast.convId;
                  setActiveConvId(activeToast.convId);
                  fetchActiveConversation(activeToast.convId);
                }
                setActiveToast(null);
                if (typeof document !== "undefined") {
                  document.title = "BizPilot - Customer Messages";
                }
              }}
              className="px-3 py-1 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Open Chat
            </button>
          </div>
        </div>
      )}

      {/* Full-Screen Media Lightbox Modal */}
      {lightboxMedia && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <div className="w-full flex items-center justify-between text-white mb-2 px-1">
              <span className="text-xs font-bold text-slate-300">
                {lightboxMedia.title || "Photo Preview"}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxMedia.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-xs font-bold flex items-center gap-1 transition-colors"
                  title="Open original"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxMedia(null)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                  title="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {lightboxMedia.type === "VIDEO" ? (
              <video
                src={lightboxMedia.url}
                controls
                autoPlay
                className="max-h-[80vh] max-w-full rounded-2xl shadow-2xl border border-white/10"
              />
            ) : (
              <img
                src={lightboxMedia.url}
                alt="Full preview"
                className="max-h-[80vh] max-w-full rounded-2xl shadow-2xl object-contain border border-white/10"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
