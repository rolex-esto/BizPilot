"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  Search,
  Info,
  Plus,
  Loader2,
  CheckCheck,
} from "lucide-react";
import { ModuleIntroModal, AboutPageButton, useModuleIntro, ModuleIntroConfig } from "@/components/ModuleIntroModal";
import { getPlatformCapabilities, getPlatformMetadata } from "@/lib/connectors/registry";
import { SupportedPlatform } from "@/lib/connectors/types";

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
  status?: "PENDING" | "SENDING" | "SENT" | "FAILED";
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

interface PendingAttachment {
  id: string;
  file: File;
  localPreviewUrl: string;
  mediaType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  filename: string;
  sizeBytes: number;
  formattedSize: string;
  status: "PENDING" | "UPLOADING" | "SENDING" | "FAILED";
  errorMessage?: string;
}

const MAX_IMAGE_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_DOC_BYTES = 25 * 1024 * 1024;   // 25MB

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
  const [searchQuery, setSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  // Local-First Pending Attachment & Menu State
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // Lightbox Media State
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
  const [orderFulfillment, setOrderFulfillment] = useState("COURIER");
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

  // AI Suggestions & Handling Mode State
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

  // ─── Polling & Caching Refs ──────────────────────────────────────────────────
  const knownTimestampsRef = useRef<Record<string, number>>({});
  const initialLoadDoneRef = useRef(false);
  const lastActiveMsgCountRef = useRef<Record<string, number>>({});
  const convMessagesCacheRef = useRef<Map<string, Message[]>>(new Map());

  // Dedicated Active Thread Delta Cursor
  const lastKnownActiveMsgTimestampRef = useRef<string | null>(null);
  const isFetchingActiveThreadRef = useRef(false);
  const isFetchingConvsRef = useRef(false);
  const isAutoReconcilingRef = useRef(false);
  const activeConvRequestIdRef = useRef(0);

  const activeConvIdRef = useRef<string | null>(null);
  activeConvIdRef.current = activeConvId;

  const lastKnownServerTimestampRef = useRef<string | null>(null);
  const convFetchAbortRef = useRef<AbortController | null>(null);
  const activeFetchAbortRef = useRef<AbortController | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Close Attachment Menu on Outside Click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    if (showAttachMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAttachMenu]);

  // Web Audio API Pop Chime
  const playNotificationChime = useCallback(() => {
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
      // AudioContext blocked or unsupported
    }
  }, [soundEnabled]);

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

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Mode Switch
  const switchInboxMode = (newMode: "LIVE" | "PRACTICE") => {
    if (newMode === inboxMode) return;

    if (convFetchAbortRef.current) {
      convFetchAbortRef.current.abort();
      convFetchAbortRef.current = null;
    }
    if (activeFetchAbortRef.current) {
      activeFetchAbortRef.current.abort();
      activeFetchAbortRef.current = null;
    }
    isFetchingConvsRef.current = false;
    isFetchingActiveThreadRef.current = false;

    setConversations([]);
    setActiveConvId(null);
    setActiveConv(null);
    knownTimestampsRef.current = {};
    initialLoadDoneRef.current = false;
    lastActiveMsgCountRef.current = {};
    lastKnownServerTimestampRef.current = null;
    lastKnownActiveMsgTimestampRef.current = null;
    convMessagesCacheRef.current.clear();
    cleanupPendingAttachment();

    setInboxMode(newMode);
  };

  // Channel Sync Handler (Multi-Platform)
  const [syncStatusToast, setSyncStatusToast] = useState<{
    message: string;
    platforms?: Record<string, any>;
  } | null>(null);

  const isAutoSyncingRef = useRef(false);

  // Background Auto-Sync Reconciler (Runs silently without blocking UI)
  const triggerBackgroundChannelSync = async () => {
    if (isAutoSyncingRef.current || inboxMode !== "LIVE") return;
    isAutoSyncingRef.current = true;
    try {
      const res = await fetch("/api/channels/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "ALL",
          environment: "LIVE",
          background: true,
          pullFromMeta: true,
          limit: 10,
        }),
      });
      const data = await res.json();
      if (data.success && data.syncedCount > 0) {
        fetchConversations(true);
        if (activeConvIdRef.current) {
          fetchActiveConversation(activeConvIdRef.current, true);
        }
      }
    } catch {
      // Silent catch for background reconciler
    } finally {
      isAutoSyncingRef.current = false;
    }
  };

  const handleSyncChannels = async (targetPlatform?: string) => {
    if (syncingChannels || inboxMode !== "LIVE") return;
    setSyncingChannels(true);
    try {
      const platformToSync = targetPlatform || platformFilter || "ALL";
      const res = await fetch("/api/channels/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platformToSync,
          environment: "LIVE",
          pullFromMeta: true,
          limit: 10,
        }),
      });
      const data = await res.json();
      if (data.success || data.status === "success") {
        const syncMsg = data.message || (data.syncedCount > 0 ? `Synced ${data.syncedCount} new message(s).` : "All channels are up to date.");
        setSyncStatusToast({
          message: syncMsg,
          platforms: data.platforms,
        });
        setTimeout(() => setSyncStatusToast(null), 5000);

        fetchConversations(false);
        if (activeConvIdRef.current) {
          fetchActiveConversation(activeConvIdRef.current, true);
        }
      }
    } catch (err) {
      console.error("Channel sync error:", err);
    } finally {
      setSyncingChannels(false);
    }
  };

  // Fetch Conversations List (Delta / Full)
  const fetchConversations = async (isBackgroundPoll = false) => {
    if (isFetchingConvsRef.current) return;
    isFetchingConvsRef.current = true;

    if (!isBackgroundPoll) {
      if (convFetchAbortRef.current) {
        convFetchAbortRef.current.abort();
        convFetchAbortRef.current = null;
      }
    }

    const abortController = new AbortController();
    convFetchAbortRef.current = abortController;

    try {
      const params = new URLSearchParams();
      params.append("environment", inboxMode);
      if (platformFilter !== "ALL") params.append("platform", platformFilter);
      if (leadFilter !== "ALL") params.append("leadStatus", leadFilter);

      const since = lastKnownServerTimestampRef.current;
      if (isBackgroundPoll && since) {
        params.append("since", since);
        params.append("deltaOnly", "true");
      }

      const res = await fetch(`/api/conversations?${params.toString()}`, {
        signal: abortController.signal,
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (abortController.signal.aborted) return;

      const data = await res.json();

      if (data.serverTimestamp) {
        lastKnownServerTimestampRef.current = data.serverTimestamp;
      }

      if (data.status === "success") {
        if (isBackgroundPoll && data.hasUpdates === false) {
          return;
        }

        const freshConvs: Conversation[] = data.conversations || [];
        let activeConvHasUpdates = false;

        // Check for new inbound messages & brand new customer discovery
        if (initialLoadDoneRef.current) {
          freshConvs.forEach((conv) => {
            const currentMs = new Date(conv.lastMessageAt).getTime();
            const prevMs = knownTimestampsRef.current[conv.id];
            const isBrandNewCustomer = prevMs === undefined;
            const isExistingUpdated = prevMs !== undefined && currentMs > prevMs;

            if (isBrandNewCustomer || isExistingUpdated) {
              if (conv.id === activeConvIdRef.current) {
                activeConvHasUpdates = true;
              }

              const lastMsg = conv.messages && conv.messages[0];
              const isOutbound = lastMsg && lastMsg.direction === "OUTBOUND";

              if (!isOutbound) {
                playNotificationChime();
                setActiveToast({
                  id: `${conv.id}-${currentMs}`,
                  name: conv.customer?.name || "Customer",
                  platform: conv.platform,
                  preview: conv.lastMessagePreview || (isBrandNewCustomer ? "New customer conversation" : "Sent a new message"),
                  convId: conv.id,
                });
              }
            }
          });
        }

        const updatedTimestamps: Record<string, number> = { ...knownTimestampsRef.current };
        freshConvs.forEach((c) => {
          updatedTimestamps[c.id] = new Date(c.lastMessageAt).getTime();
        });
        knownTimestampsRef.current = updatedTimestamps;
        initialLoadDoneRef.current = true;

        // Deterministic immutable state merge to prevent dropping existing records during delta returns
        setConversations((prevConvs) => {
          if (!isBackgroundPoll || prevConvs.length === 0) {
            return freshConvs;
          }
          const map = new Map<string, Conversation>();
          prevConvs.forEach((c) => map.set(c.id, c));
          freshConvs.forEach((c) => map.set(c.id, c));
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
          );
        });

        // Pre-populate cache
        freshConvs.forEach((conv) => {
          if (conv.messages && conv.messages.length > 0 && !convMessagesCacheRef.current.has(conv.id)) {
            convMessagesCacheRef.current.set(conv.id, conv.messages);
          }
        });

        // Trigger immediate active thread delta sync if current conversation had updates
        if (activeConvHasUpdates && activeConvIdRef.current) {
          fetchActiveConversation(activeConvIdRef.current, true);
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("Error fetching conversations:", err);
    } finally {
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

  // ─── fetchActiveConversation (Full & Delta) ──────────────────────────────────
  const fetchActiveConversation = async (
    id: string,
    isDelta = false,
    forcedRequestId?: number
  ) => {
    if (!id) return;
    if (isFetchingActiveThreadRef.current && isDelta) return;

    const requestId = forcedRequestId ?? (isDelta ? activeConvRequestIdRef.current : ++activeConvRequestIdRef.current);
    isFetchingActiveThreadRef.current = true;

    // For full fetches, abort previous in-flight request
    if (!isDelta) {
      if (activeFetchAbortRef.current) {
        activeFetchAbortRef.current.abort();
        activeFetchAbortRef.current = null;
      }
    }

    const abortController = new AbortController();
    if (!isDelta) {
      activeFetchAbortRef.current = abortController;
    }

    try {
      let url = `/api/conversations/${id}`;
      const since = lastKnownActiveMsgTimestampRef.current;
      if (isDelta && since) {
        url += `?since=${encodeURIComponent(since)}&deltaOnly=true`;
      }

      const res = await fetch(url, {
        signal: abortController.signal,
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (abortController.signal.aborted) return;

      const data = await res.json();

      // Generation & Active Conv Guard
      if (activeConvIdRef.current !== id) {
        return;
      }

      if (!isDelta && requestId !== activeConvRequestIdRef.current) {
        return;
      }

      if (data.status === "success") {
        if (isDelta) {
          // Delta Update Mode
          if (data.hasUpdates && data.newMessages && data.newMessages.length > 0) {
            const incoming: Message[] = data.newMessages;

            setActiveConv((prev) => {
              if (!prev || prev.id !== id) return prev;
              const existing = prev.messages || [];

              // Merge deduplicated by id, replacing any matching temp optimistic IDs
              const existingMap = new Map<string, Message>();
              existing.forEach((m) => existingMap.set(m.id, m));

              incoming.forEach((msg) => {
                existingMap.set(msg.id, msg);
              });

              // Filter out temp optimistic messages that have same textContent as recent incoming outbound message
              const merged = Array.from(existingMap.values()).sort(
                (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
              );

              convMessagesCacheRef.current.set(id, merged);
              return { ...prev, messages: merged, unreadCount: 0 };
            });

            const lastIncoming = incoming[incoming.length - 1];
            if (lastIncoming?.sentAt) {
              lastKnownActiveMsgTimestampRef.current = lastIncoming.sentAt;
            }

            if (incoming.some((m) => m.direction === "INBOUND")) {
              playNotificationChime();
            }
          }
        } else {
          // Full Load Mode
          const conv = data.conversation as Conversation;
          const messages = conv.messages || [];

          convMessagesCacheRef.current.set(id, messages);
          if (messages.length > 0) {
            lastKnownActiveMsgTimestampRef.current = messages[messages.length - 1].sentAt;
          }

          setActiveConv(conv);
          setOrderAddress(conv.customer?.deliveryAddress || "");
          setOrderPhone(conv.customer?.phone || "");
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("Error fetching active conversation:", err);
    } finally {
      if (activeFetchAbortRef.current === abortController) {
        activeFetchAbortRef.current = null;
      }
      isFetchingActiveThreadRef.current = false;
    }
  };

  // ─── Fast & Responsive Customer Selection ────────────────────────────────────
  const handleSelectConversation = (conv: Conversation) => {
    if (!conv?.id) return;
    if (activeConvId === conv.id) return;

    const nextGen = ++activeConvRequestIdRef.current;

    // 1. Immediately abort previous active request
    if (activeFetchAbortRef.current) {
      activeFetchAbortRef.current.abort();
      activeFetchAbortRef.current = null;
    }

    // 2. Immediately update active state
    activeConvIdRef.current = conv.id;
    setActiveConvId(conv.id);
    lastKnownActiveMsgTimestampRef.current = null;

    // 3. Instant Cache Retrieval (0ms UI latency)
    const cachedMessages = convMessagesCacheRef.current.get(conv.id) || conv.messages || [];
    if (cachedMessages.length > 0) {
      lastKnownActiveMsgTimestampRef.current = cachedMessages[cachedMessages.length - 1].sentAt;
    }

    setActiveConv({
      ...conv,
      messages: cachedMessages,
    });
    setReplyText("");
    cleanupPendingAttachment();

    // 4. Launch full fresh thread & order details fetch
    fetchActiveConversation(conv.id, false, nextGen);
  };

  // ─── Local-First Attachment Lifecycle ────────────────────────────────────────
  const cleanupPendingAttachment = () => {
    setPendingAttachment((prev) => {
      if (prev?.localPreviewUrl && prev.localPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(prev.localPreviewUrl);
      }
      return null;
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachMenu(false);

    // Local validation
    let mediaType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" = "DOCUMENT";
    if (file.type.startsWith("image/")) mediaType = "IMAGE";
    else if (file.type.startsWith("video/")) mediaType = "VIDEO";
    else if (file.type.startsWith("audio/")) mediaType = "AUDIO";
    else if (file.type === "application/pdf" || file.type.includes("word") || file.type === "text/plain") mediaType = "DOCUMENT";

    const maxBytes = (mediaType === "IMAGE" || mediaType === "AUDIO") ? MAX_IMAGE_AUDIO_BYTES : MAX_VIDEO_DOC_BYTES;
    if (file.size > maxBytes) {
      alert(`File size exceeds the ${formatBytes(maxBytes)} limit for ${mediaType.toLowerCase()}s.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Check active platform capability
    if (activeConv?.platform) {
      const caps = getPlatformCapabilities(activeConv.platform);
      if (mediaType === "IMAGE" && !caps.outbound.image) {
        alert(`Image sending is not supported on ${activeConv.platform}.`);
        return;
      }
      if (mediaType === "VIDEO" && !caps.outbound.video) {
        alert(`Video sending is not supported on ${activeConv.platform}.`);
        return;
      }
      if (mediaType === "AUDIO" && !caps.outbound.audio) {
        alert(`Audio voice note sending is not supported on ${activeConv.platform}.`);
        return;
      }
      if (mediaType === "DOCUMENT" && !caps.outbound.document) {
        alert(`Document attachment sending is not supported on ${activeConv.platform}.`);
        return;
      }
    }

    // Generate fast local object URL preview (NO server upload yet!)
    const localUrl = URL.createObjectURL(file);

    cleanupPendingAttachment();

    setPendingAttachment({
      id: `pending_${Date.now()}`,
      file,
      localPreviewUrl: localUrl,
      mediaType,
      filename: file.name,
      sizeBytes: file.size,
      formattedSize: formatBytes(file.size),
      status: "PENDING",
    });
  };

  const triggerFilePicker = (acceptType: string) => {
    setShowAttachMenu(false);
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    fileInputRef.current.accept = acceptType;
    fileInputRef.current.click();
  };

  // ─── Send Message with Optimistic UI & Immediate State Update ────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasText = Boolean(replyText.trim());
    const hasAttachment = Boolean(pendingAttachment);

    if ((!hasText && !hasAttachment) || !activeConvId) return;

    const sendingConvId = activeConvId;
    const outboundText = replyText.trim();
    const tempMessageId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // 1. Optimistic Immediate Insertion (0ms Latency!)
    const optimisticMsg: Message = {
      id: tempMessageId,
      direction: "OUTBOUND",
      textContent: outboundText,
      mediaUrl: pendingAttachment?.localPreviewUrl,
      mediaType: pendingAttachment?.mediaType,
      sentAt: new Date().toISOString(),
      status: "SENDING",
    };

    setActiveConv((prev) => {
      if (!prev || prev.id !== sendingConvId) return prev;
      const updatedMessages = [...(prev.messages || []), optimisticMsg];
      convMessagesCacheRef.current.set(sendingConvId, updatedMessages);
      return {
        ...prev,
        messages: updatedMessages,
        lastMessageAt: optimisticMsg.sentAt,
        lastMessagePreview: outboundText || `Sent a ${pendingAttachment?.mediaType?.toLowerCase() || "file"}`,
      };
    });

    // Clear input & staged preview immediately
    setReplyText("");
    const stagedFile = pendingAttachment?.file;
    const stagedMediaType = pendingAttachment?.mediaType;
    const stagedFilename = pendingAttachment?.filename;
    cleanupPendingAttachment();

    setSending(true);

    let uploadedUrl: string | undefined;
    let uploadedMediaType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | undefined;
    let uploadedFilename: string | undefined;

    try {
      // Step A: Upload file if attachment existed
      if (stagedFile) {
        const formData = new FormData();
        formData.append("file", stagedFile);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || uploadData.status !== "success") {
          throw new Error(uploadData.error || "Failed to upload attachment.");
        }

        uploadedUrl = uploadData.url;
        uploadedMediaType = uploadData.mediaType || stagedMediaType;
        uploadedFilename = uploadData.filename || stagedFilename;
      }

      // Step B: Send Message via API
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: sendingConvId,
          textContent: outboundText,
          mediaUrl: uploadedUrl,
          mediaType: uploadedMediaType,
          filename: uploadedFilename,
        }),
      });

      const data = await res.json();
      if (data.status === "success" && data.message) {
        const persistedMsg: Message = data.message;

        // Reconcile optimistic message with authoritative database record
        setActiveConv((prev) => {
          if (!prev || prev.id !== sendingConvId) return prev;
          const updatedMessages = (prev.messages || []).map((m) =>
            m.id === tempMessageId ? { ...persistedMsg, status: "SENT" as const } : m
          );
          convMessagesCacheRef.current.set(sendingConvId, updatedMessages);
          return { ...prev, messages: updatedMessages };
        });

        lastKnownActiveMsgTimestampRef.current = persistedMsg.sentAt;

        // Broadcast across tabs
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({ type: "MESSAGE_SENT", convId: sendingConvId });
        }

        // Silent delta refresh of conversation list
        fetchConversations(true);
      } else {
        throw new Error(data.error || data.message || "Failed to send message");
      }
    } catch (err: any) {
      console.error("Error sending message:", err);

      // Mark optimistic message as FAILED
      setActiveConv((prev) => {
        if (!prev || prev.id !== sendingConvId) return prev;
        const updatedMessages = (prev.messages || []).map((m) =>
          m.id === tempMessageId ? { ...m, status: "FAILED" as const } : m
        );
        convMessagesCacheRef.current.set(sendingConvId, updatedMessages);
        return { ...prev, messages: updatedMessages };
      });

      alert(err.message || "Error sending message.");
    } finally {
      setSending(false);
    }
  };

  // ─── AI Suggestion Approval ──────────────────────────────────────────────────
  const handleApproveSuggestion = async (suggestionText: string) => {
    if (!activeConvId || !suggestionText.trim()) return;
    setAiApprovalSending(true);

    const sendingConvId = activeConvId;
    const tempId = `temp_ai_${Date.now()}`;

    const optimisticMsg: Message = {
      id: tempId,
      direction: "OUTBOUND",
      textContent: suggestionText.trim(),
      sentAt: new Date().toISOString(),
      status: "SENDING",
    };

    setActiveConv((prev) => {
      if (!prev || prev.id !== sendingConvId) return prev;
      const updatedMessages = [...(prev.messages || []), optimisticMsg];
      convMessagesCacheRef.current.set(sendingConvId, updatedMessages);
      return { ...prev, messages: updatedMessages };
    });

    setReplyText("");
    setDismissedSuggestions((prev) => ({ ...prev, [sendingConvId]: true }));

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: sendingConvId,
          textContent: suggestionText.trim(),
        }),
      });
      const data = await res.json();
      if (data.status === "success" && data.message) {
        const persistedMsg = data.message;
        setActiveConv((prev) => {
          if (!prev || prev.id !== sendingConvId) return prev;
          const updated = (prev.messages || []).map((m) =>
            m.id === tempId ? { ...persistedMsg, status: "SENT" as const } : m
          );
          convMessagesCacheRef.current.set(sendingConvId, updated);
          return { ...prev, messages: updated };
        });
        fetchConversations(true);
      } else {
        alert(data.error || "Failed to send AI approved response");
      }
    } catch (err) {
      console.error("Error sending approved suggestion:", err);
    } finally {
      setAiApprovalSending(false);
    }
  };

  // ─── Quick Negotiation (Tawad) ───────────────────────────────────────────────
  const handleQuickNegotiation = async (action: "ACCEPT_OFFER" | "COUNTER_OFFER") => {
    if (!activeConvId || !activeConv) return;
    const latestLead = activeConv.customer?.leads?.[0];
    if (!latestLead) {
      alert("No active price negotiation lead detected for this customer.");
      return;
    }

    setNegotiatingAction(true);
    try {
      const counterAmount = action === "COUNTER_OFFER" ? parseFloat(customOfferInput) : undefined;
      if (action === "COUNTER_OFFER" && (!counterAmount || isNaN(counterAmount) || counterAmount <= 0)) {
        alert("Please enter a valid counter-offer price in PHP.");
        setNegotiatingAction(false);
        return;
      }

      const res = await fetch("/api/leads/negotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: latestLead.id,
          action,
          counterAmount,
          party: "OWNER",
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setCustomOfferInput("");
        fetchActiveConversation(activeConvId, false);
        if (data.outboundMessageText) {
          setReplyText(data.outboundMessageText);
        }
      } else {
        alert(data.error || "Failed to update negotiation");
      }
    } catch (err) {
      console.error("Negotiation error:", err);
    } finally {
      setNegotiatingAction(false);
    }
  };

  // ─── 1-Click Order Creation ──────────────────────────────────────────────────
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
          conversationId: activeConv.id,
          customerId: activeConv.customer.id,
          environment: activeConv.environment || "LIVE",
          source: activeConv.customer.source || activeConv.platform,
          fulfillmentMethod: orderFulfillment,
          courier: orderFulfillment === "COURIER" ? orderCourier : undefined,
          courierTracking: orderFulfillment === "LBC" ? orderLbcTracking : undefined,
          deliveryAddress: orderAddress,
          customerPhone: orderPhone,
          meetupLocation: orderFulfillment === "MEETUP" ? orderMeetupLocation : undefined,
          meetupSchedule: orderFulfillment === "MEETUP" && orderMeetupSchedule ? new Date(orderMeetupSchedule).toISOString() : undefined,
          pickupLocation: orderFulfillment === "PICKUP" ? orderPickupLocation : undefined,
          paymentMethod: orderPaymentMethod,
          items: [
            {
              productId: chosenProduct?.id,
              productName: chosenProduct?.name,
              productSku: chosenProduct?.sku,
              originalUnitPrice: catalogPrice,
              unitPrice: agreedPrice,
              quantity: Number(orderQuantity),
            },
          ],
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setOrderSuccessMessage(`🎉 Order ${data.order?.orderNumber || "Created"} successfully!`);
        setTimeout(() => {
          setShowOrderModal(false);
          setOrderSuccessMessage("");
          fetchActiveConversation(activeConv.id, false);
        }, 1200);
      } else {
        alert(data.error || "Failed to create order");
      }
    } catch (err) {
      console.error("Order creation error:", err);
      alert("Error creating order");
    } finally {
      setCreatingOrder(false);
    }
  };

  // ─── Multi-Tab Broadcast & Visibility Lifecycle ──────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        const bc = new BroadcastChannel("bizpilot_inbox_sync");
        broadcastChannelRef.current = bc;
        bc.onmessage = (event) => {
          if (event.data?.type === "MESSAGE_SENT" || event.data?.type === "INBOX_UPDATE") {
            fetchConversations(true);
            if (activeConvIdRef.current) {
              fetchActiveConversation(activeConvIdRef.current, true);
            }
          }
        };
      } catch {
        // BroadcastChannel unavailable
      }
    }

    const handleWakeupSync = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        // Tab restored / app focused / network restored -> immediate delta sync + channel sync
        fetchConversations(true);
        if (activeConvIdRef.current) {
          fetchActiveConversation(activeConvIdRef.current, true);
        }
        if (inboxMode === "LIVE") {
          triggerBackgroundChannelSync();
        }
      }
    };

    document.addEventListener("visibilitychange", handleWakeupSync);
    window.addEventListener("focus", handleWakeupSync);
    window.addEventListener("pageshow", handleWakeupSync);
    window.addEventListener("online", handleWakeupSync);

    return () => {
      document.removeEventListener("visibilitychange", handleWakeupSync);
      window.removeEventListener("focus", handleWakeupSync);
      window.removeEventListener("pageshow", handleWakeupSync);
      window.removeEventListener("online", handleWakeupSync);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, [inboxMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial Load & Channel Bootstrap
  useEffect(() => {
    fetchConversations(false);
    fetchProducts();
    if (inboxMode === "LIVE") {
      triggerBackgroundChannelSync();
    }
  }, [inboxMode, platformFilter, leadFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Dedicated Active Thread Delta Poller (1.5s interval) ───────────────────
  useEffect(() => {
    if (!activeConvId) return;

    if (typeof document !== "undefined") {
      document.title = "BizPilot - Customer Messages";
    }

    const targetConvId = activeConvId;

    const chatInterval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (activeConvIdRef.current !== targetConvId) return;
      fetchActiveConversation(targetConvId, true);
    }, 1500);

    return () => clearInterval(chatInterval);
  }, [activeConvId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Background Delta Polling for Conversations List (2.0s interval) ─────────
  useEffect(() => {
    const listInterval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchConversations(true);
    }, 2000);

    return () => clearInterval(listInterval);
  }, [inboxMode, platformFilter, leadFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Background Channel Sync (8.0s interval) ─────────────────────────────────
  useEffect(() => {
    if (inboxMode !== "LIVE") return;

    const channelSyncInterval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      triggerBackgroundChannelSync();
    }, 8000);

    return () => clearInterval(channelSyncInterval);
  }, [inboxMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages?.length, activeConvId, aiSuggestionMinimized]);

  // Filtered Conversations Search
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase().trim();
    return conversations.filter(
      (c) =>
        c.customer.name.toLowerCase().includes(q) ||
        (c.customer.phone && c.customer.phone.includes(q)) ||
        (c.lastMessagePreview && c.lastMessagePreview.toLowerCase().includes(q))
    );
  }, [conversations, searchQuery]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto px-2 sm:px-4 py-3">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">Customer Messages</h1>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                  inboxMode === "LIVE"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-purple-50 text-purple-700 border border-purple-200"
                }`}
              >
                {inboxMode === "LIVE" ? "● LIVE INBOX" : "● SIMULATOR"}
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Unified multi-channel customer communications across Facebook, Instagram, WhatsApp, and TikTok
            </p>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => switchInboxMode("LIVE")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 ${
                inboxMode === "LIVE"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-emerald-600" />
              Live Inbox
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

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playNotificationChime();
            }}
            title={soundEnabled ? "Chime sound is ON" : "Chime sound is MUTED"}
            className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              soundEnabled
                ? "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100 shadow-2xs"
                : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-sky-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </div>

      {inboxMode === "PRACTICE" && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-purple-900">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-purple-600 shrink-0" />
            <span>
              <strong>Practice Simulator Mode:</strong> You are viewing simulated sandbox conversations. These are safely isolated from your live customer accounts.
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

      {/* 3-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-210px)] min-h-[580px]">
        {/* Column 1: Conversations List (Full width on mobile when no active conversation selected) */}
        <div
          className={`${
            activeConvId ? "hidden lg:flex" : "flex"
          } lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-xs flex-col overflow-hidden`}
        >
          {/* Top Platform Filter Tabs */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Inbox ({conversations.length})</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleSyncChannels()}
                  disabled={syncingChannels}
                  className="px-2 py-0.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded text-[10px] font-bold inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                  title={
                    platformFilter !== "ALL"
                      ? `Sync ${platformFilter.charAt(0) + platformFilter.slice(1).toLowerCase()} messages`
                      : "Sync connected social channels"
                  }
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${syncingChannels ? "animate-spin" : ""}`} />
                  {syncingChannels ? "Syncing..." : platformFilter !== "ALL" ? `Sync ${platformFilter === "FACEBOOK" ? "FB" : platformFilter === "INSTAGRAM" ? "IG" : platformFilter === "WHATSAPP" ? "WA" : "TT"}` : "Sync Channels"}
                </button>
                <button onClick={() => fetchConversations(false)} className="text-slate-400 hover:text-slate-600 p-0.5" title="Refresh local inbox">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Sync Feedback Toast */}
            {syncStatusToast && (
              <div className="p-2 bg-sky-100 text-sky-950 border border-sky-200 rounded-lg text-[11px] flex items-center justify-between gap-1.5 animate-in fade-in">
                <div className="flex items-center gap-1 min-w-0">
                  <CheckCircle className="w-3 h-3 text-sky-600 shrink-0" />
                  <span className="font-semibold truncate">{syncStatusToast.message}</span>
                </div>
                <button onClick={() => setSyncStatusToast(null)} className="text-sky-600 hover:text-sky-800 p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Platform Filter Badges */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {[
                { id: "ALL", label: "All" },
                { id: "FACEBOOK", label: "FB", color: "text-blue-600" },
                { id: "INSTAGRAM", label: "IG", color: "text-pink-600" },
                { id: "WHATSAPP", label: "WA", color: "text-emerald-600" },
                { id: "TIKTOK", label: "TT", color: "text-slate-900" },
              ].map((tab) => {
                const isActive = platformFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPlatformFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 ${
                      isActive
                        ? "bg-sky-600 text-white shadow-2xs"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Conversation List Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading inbox...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No conversations found. Inbound messages will appear here.
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === activeConvId;
                const isHot = conv.customer.leadScore >= 80;

                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`w-full text-left p-3 transition-colors flex items-start gap-3 ${
                      isSelected ? "bg-sky-50/90 border-l-4 border-sky-600" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">
                        {conv.customer.name.charAt(0)}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold text-white shadow-2xs ${
                          conv.platform === "FACEBOOK"
                            ? "bg-blue-600"
                            : conv.platform === "INSTAGRAM"
                            ? "bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600"
                            : conv.platform === "WHATSAPP"
                            ? "bg-emerald-600"
                            : "bg-black"
                        }`}
                        title={conv.platform}
                      >
                        {conv.platform === "FACEBOOK"
                          ? "F"
                          : conv.platform === "INSTAGRAM"
                          ? "I"
                          : conv.platform === "WHATSAPP"
                          ? "W"
                          : "T"}
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

                      <p className="text-xs text-slate-500 truncate mb-1">
                        {conv.lastMessagePreview || "No messages yet"}
                      </p>

                      <div className="flex items-center gap-1.5">
                        {isHot && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded text-[9px] font-bold border border-rose-200">
                            <Flame className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
                            HOT
                          </span>
                        )}
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                          {conv.platform}
                        </span>
                        {conv.unreadCount > 0 && (
                          <span className="ml-auto w-4 h-4 bg-sky-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                            {conv.unreadCount}
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

        {/* Column 2: Active Chat Thread (Full width on mobile when selected) */}
        <div
          className={`${
            activeConvId ? "flex" : "hidden lg:flex"
          } lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs flex-col overflow-hidden relative`}
        >
          {activeConv ? (
            <>
              {/* Active Conversation Header */}
              <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Mobile Back Button */}
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
                    title="Back to inbox list"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">
                      {activeConv.customer.name.charAt(0)}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full text-[7px] flex items-center justify-center font-bold text-white ${
                        activeConv.platform === "FACEBOOK"
                          ? "bg-blue-600"
                          : activeConv.platform === "INSTAGRAM"
                          ? "bg-pink-600"
                          : activeConv.platform === "WHATSAPP"
                          ? "bg-emerald-600"
                          : "bg-black"
                      }`}
                    >
                      {activeConv.platform.charAt(0)}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-slate-900 truncate">{activeConv.customer.name}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          activeConv.customer.leadScore >= 80
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {activeConv.customer.leadStatus}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {activeConv.platform} • {activeConv.customer.phone || activeConv.customer.handle || "Online"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setShowOrderModal(true)}
                    className="px-2.5 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">1-Click Order</span>
                  </button>

                  <button
                    onClick={() => setShowMobileProfile(true)}
                    className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-200"
                    title="View customer profile"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Message Thread History */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/50">
                {activeConv.messages?.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400">
                    No messages in this thread yet. Send a message below.
                  </div>
                ) : (
                  activeConv.messages?.map((msg) => {
                    const isCustomer = msg.direction === "INBOUND";
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isCustomer ? "items-start" : "items-end"}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 text-xs shadow-2xs break-words ${
                            isCustomer
                              ? "bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs"
                              : "bg-sky-600 text-white rounded-tr-xs"
                          }`}
                        >
                          {/* Rich Media Rendering */}
                          {(() => {
                            if (!msg.mediaUrl) return null;
                            const mediaUrl = msg.mediaUrl;
                            const mediaType = msg.mediaType;

                            if (mediaType === "IMAGE" || /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(mediaUrl) || mediaUrl.startsWith("data:image/") || mediaUrl.startsWith("blob:")) {
                              const proxyUrl = `/api/media/proxy?messageId=${msg.id}`;
                              return (
                                <div className="mb-2 relative group overflow-hidden rounded-xl border border-slate-200/60 bg-black/5">
                                  <img
                                    src={mediaUrl}
                                    alt="Attachment"
                                    referrerPolicy="no-referrer"
                                    onClick={() => setLightboxMedia({ url: mediaUrl, title: isCustomer ? activeConv.customer.name : "Store Owner", type: "IMAGE" })}
                                    className="max-h-60 w-full object-cover rounded-xl cursor-zoom-in transition-transform duration-200 group-hover:scale-102"
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      if (target.src !== window.location.origin + proxyUrl && !target.src.includes("/api/media/proxy")) {
                                        target.src = proxyUrl;
                                      } else {
                                        target.style.display = "none";
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setLightboxMedia({ url: mediaUrl, title: isCustomer ? activeConv.customer.name : "Store Owner", type: "IMAGE" })}
                                    className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] font-bold px-1.5"
                                  >
                                    <Maximize2 className="w-3 h-3" />
                                    Full View
                                  </button>
                                </div>
                              );
                            }

                            if (mediaType === "VIDEO" || /\.(mp4|webm|mov)($|\?)/i.test(mediaUrl) || mediaUrl.startsWith("data:video/") || mediaUrl.startsWith("blob:")) {
                              return (
                                <div className="mb-2 overflow-hidden rounded-xl border border-slate-200/60 bg-black">
                                  <video
                                    src={mediaUrl}
                                    controls
                                    preload="metadata"
                                    className="max-h-60 w-full rounded-xl"
                                  />
                                </div>
                              );
                            }

                            if (mediaType === "AUDIO" || /\.(mp3|ogg|wav|m4a|aac)($|\?)/i.test(mediaUrl) || mediaUrl.startsWith("data:audio/") || mediaUrl.startsWith("blob:")) {
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

                            if (mediaType === "DOCUMENT" || /\.(pdf|doc|docx|txt)($|\?)/i.test(mediaUrl) || mediaUrl.startsWith("data:application/")) {
                              return (
                                <div className="mb-2 p-2.5 bg-slate-100 dark:bg-white/10 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 text-slate-800 dark:text-white">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileText className="w-5 h-5 text-sky-600 shrink-0" />
                                    <div className="min-w-0">
                                      <p className="font-bold text-xs truncate">Document Attachment</p>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-300">Protected Document</p>
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

                            return null;
                          })()}

                          {/* Message Text Content */}
                          {msg.textContent}

                          {isCustomer && msg.aiClassification && (
                            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-purple-700 font-semibold">
                              <Sparkles className="w-3 h-3 text-purple-600" />
                              Detected: {msg.aiClassification}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 mt-1 px-1 text-[9px] text-slate-400">
                          <span>
                            {new Date(msg.sentAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {!isCustomer && (
                            <span>
                              {msg.status === "SENDING" ? "• Sending..." : msg.status === "FAILED" ? "• Failed" : "✓"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Grounded AI Reply Suggestion */}
              {(() => {
                const lastInbound = activeConv.messages
                  ? [...activeConv.messages].reverse().find((m) => m.direction === "INBOUND" && m.aiSuggestedReply)
                  : null;
                const suggestion = lastInbound && !dismissedSuggestions[activeConv.id] ? lastInbound.aiSuggestedReply : null;

                if (!suggestion) return null;

                if (aiSuggestionMinimized) {
                  return (
                    <div className="px-3 py-1.5 bg-purple-50 border-t border-purple-200 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <Bot className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span className="text-[11px] font-bold text-purple-950">AI Reply:</span>
                        <span className="text-[11px] text-slate-600 truncate italic">"{suggestion}"</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAiSuggestionMinimized(false)}
                        className="px-2 py-0.5 bg-white text-purple-900 border border-purple-200 rounded text-[10px] font-bold"
                      >
                        View
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-t border-purple-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-purple-900 font-bold text-xs">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        Copilot Smart Reply
                      </div>
                      <button
                        type="button"
                        onClick={() => setAiSuggestionMinimized(true)}
                        className="text-purple-600 hover:text-purple-800 text-[10px] font-bold"
                      >
                        Minimize
                      </button>
                    </div>
                    <p className="text-xs text-slate-700 bg-white/80 p-2.5 rounded-lg border border-purple-100 italic">
                      "{suggestion}"
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDismissedSuggestions((prev) => ({ ...prev, [activeConv.id]: true }))}
                        className="px-2.5 py-1 text-slate-500 hover:text-slate-700 text-xs font-semibold"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyText(suggestion)}
                        className="px-2.5 py-1 bg-white text-purple-700 border border-purple-200 rounded-lg text-xs font-bold hover:bg-purple-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveSuggestion(suggestion)}
                        disabled={aiApprovalSending}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        {aiApprovalSending ? "Sending..." : "Approve & Send"}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Chat Composer & Local-First Pending Attachment Card */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white relative">
                {/* Local-First Pending Attachment Card (Pre-Upload Preview) */}
                {pendingAttachment && (
                  <div className="mb-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {pendingAttachment.mediaType === "IMAGE" ? (
                        <img
                          src={pendingAttachment.localPreviewUrl}
                          alt="Local preview"
                          className="w-12 h-12 object-cover rounded-lg border border-slate-300 shrink-0"
                        />
                      ) : pendingAttachment.mediaType === "VIDEO" ? (
                        <div className="w-12 h-12 bg-slate-900 text-white flex items-center justify-center rounded-lg shrink-0">
                          <Film className="w-5 h-5 text-sky-400" />
                        </div>
                      ) : pendingAttachment.mediaType === "AUDIO" ? (
                        <div className="w-12 h-12 bg-purple-100 text-purple-700 flex items-center justify-center rounded-lg shrink-0">
                          <Music className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-sky-100 text-sky-700 flex items-center justify-center rounded-lg shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{pendingAttachment.filename}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <span>{pendingAttachment.formattedSize}</span>
                          <span>•</span>
                          <span
                            className={`font-semibold ${
                              pendingAttachment.status === "FAILED"
                                ? "text-rose-600"
                                : pendingAttachment.status === "UPLOADING" || pendingAttachment.status === "SENDING"
                                ? "text-sky-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {pendingAttachment.status === "PENDING"
                              ? "Ready to send (Not uploaded yet)"
                              : pendingAttachment.status === "UPLOADING"
                              ? "Uploading file..."
                              : pendingAttachment.status === "SENDING"
                              ? "Sending message..."
                              : "Upload failed"}
                          </span>
                        </div>
                        {pendingAttachment.errorMessage && (
                          <p className="text-[10px] text-rose-600 truncate">{pendingAttachment.errorMessage}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {pendingAttachment.status === "FAILED" && (
                        <button
                          type="button"
                          onClick={handleSendMessage}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold rounded-lg border border-rose-200"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={cleanupPendingAttachment}
                        disabled={pendingAttachment.status === "UPLOADING" || pendingAttachment.status === "SENDING"}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                        title="Remove attachment"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Attachment Selector Popup Menu */}
                {showAttachMenu && (
                  <div
                    ref={attachMenuRef}
                    className="absolute bottom-16 left-3 z-30 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 w-56 flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-2"
                  >
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Attach Media
                    </div>

                    {(() => {
                      const caps = getPlatformCapabilities(activeConv.platform);
                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => triggerFilePicker("image/jpeg,image/png,image/webp,image/gif")}
                            disabled={!caps.outbound.image}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                              caps.outbound.image ? "hover:bg-sky-50 text-slate-700 hover:text-sky-700" : "opacity-40 cursor-not-allowed text-slate-400"
                            }`}
                          >
                            <Camera className="w-4 h-4 text-sky-600" />
                            <span>Photo / Image</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => triggerFilePicker("video/mp4,video/webm,video/quicktime")}
                            disabled={!caps.outbound.video}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                              caps.outbound.video ? "hover:bg-purple-50 text-slate-700 hover:text-purple-700" : "opacity-40 cursor-not-allowed text-slate-400"
                            }`}
                          >
                            <Film className="w-4 h-4 text-purple-600" />
                            <span>Video</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => triggerFilePicker("audio/mpeg,audio/ogg,audio/wav,audio/aac")}
                            disabled={!caps.outbound.audio}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                              caps.outbound.audio ? "hover:bg-emerald-50 text-slate-700 hover:text-emerald-700" : "opacity-40 cursor-not-allowed text-slate-400"
                            }`}
                          >
                            <Music className="w-4 h-4 text-emerald-600" />
                            <span>Voice / Audio</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => triggerFilePicker("application/pdf,application/msword,text/plain")}
                            disabled={!caps.outbound.document}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                              caps.outbound.document ? "hover:bg-amber-50 text-slate-700 hover:text-amber-700" : "opacity-40 cursor-not-allowed text-slate-400"
                            }`}
                          >
                            <FileText className="w-4 h-4 text-amber-600" />
                            <span>Document / File</span>
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Input Controls Bar */}
                <div className="flex items-end gap-2">
                  {/* Plus / Attach Button */}
                  <button
                    type="button"
                    onClick={() => setShowAttachMenu((prev) => !prev)}
                    className={`p-2.5 rounded-xl border transition-all ${
                      showAttachMenu
                        ? "bg-sky-100 text-sky-700 border-sky-300"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                    title="Attach photo, video, audio, or document"
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  <textarea
                    rows={2}
                    placeholder={
                      pendingAttachment
                        ? "Add an optional caption for this attachment..."
                        : "Type your response to the buyer..."
                    }
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={sending}
                    className="flex-1 text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none disabled:bg-slate-50"
                  />

                  <button
                    type="submit"
                    disabled={sending || (!replyText.trim() && !pendingAttachment)}
                    className="p-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 shrink-0"
                    title="Send message"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
        <div
          className={`${
            showMobileProfile ? "fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" : "hidden lg:flex"
          } lg:static lg:bg-transparent lg:p-0 lg:col-span-3`}
        >
          <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-200 shadow-xl lg:shadow-xs p-5 lg:p-4 w-full max-w-md lg:max-w-none flex flex-col gap-4 overflow-y-auto max-h-[85vh] lg:max-h-none">
            {activeConv ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customer Profile</h3>
                    <div className="font-bold text-sm text-slate-900">{activeConv.customer.name}</div>
                    <div className="text-xs text-slate-500">
                      Channel: <span className="font-semibold text-slate-700">{activeConv.platform}</span>
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
                    <span className="font-bold text-slate-900">{formatPhp(activeConv.customer.lifetimeValue || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Completed Orders</span>
                    <span className="font-bold text-slate-900">{activeConv.customer.orderCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lead Score</span>
                    <span className="font-bold text-sky-600">{activeConv.customer.leadScore || 50}/100</span>
                  </div>
                </div>

                {/* Quick Negotiation (Tawad) Block */}
                {(() => {
                  const lead = activeConv.customer?.leads?.[0];
                  if (!lead) return null;

                  return (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-2">
                      <div className="font-bold text-amber-900 flex items-center justify-between">
                        <span>Price Negotiation</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-200 rounded font-semibold text-amber-950">
                          {lead.status}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Customer Offer:</span>
                        <span className="font-bold text-slate-900">{formatPhp(lead.offeredPrice || 0)}</span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleQuickNegotiation("ACCEPT_OFFER")}
                          disabled={negotiatingAction}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => {
                            const counter = prompt("Enter counter-offer in PHP:");
                            if (counter) {
                              setCustomOfferInput(counter);
                              handleQuickNegotiation("COUNTER_OFFER");
                            }
                          }}
                          disabled={negotiatingAction}
                          className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50"
                        >
                          Counter
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400">
                Select a conversation to see customer profile and intelligence.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Media Modal */}
      {lightboxMedia && (
        <div
          onClick={() => setLightboxMedia(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="p-3 bg-slate-800/80 flex items-center justify-between text-white border-b border-slate-700">
              <span className="text-xs font-bold truncate">{lightboxMedia.title || "Media Preview"}</span>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxMedia.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold inline-flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
                <button
                  onClick={() => setLightboxMedia(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-2 flex items-center justify-center overflow-auto max-h-[80vh]">
              {lightboxMedia.type === "VIDEO" ? (
                <video src={lightboxMedia.url} controls autoPlay className="max-h-[75vh] w-auto rounded-lg" />
              ) : (
                <img src={lightboxMedia.url} alt="Full preview" className="max-h-[75vh] w-auto object-contain rounded-lg" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1-Click Order Modal */}
      {showOrderModal && activeConv && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-slate-900 text-sm">1-Click Order for {activeConv.customer.name}</h3>
              </div>
              <button onClick={() => setShowOrderModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {orderSuccessMessage ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-center font-bold text-sm">
                {orderSuccessMessage}
              </div>
            ) : (
              <form onSubmit={handleCreateOrder} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Product</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      setSelectedProductId(e.target.value);
                      const prod = products.find((p) => p.id === e.target.value);
                      if (prod) setOrderNegotiatedPrice(prod.price);
                    }}
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                    required
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatPhp(p.price)} ({p.stockQuantity} in stock)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      min={1}
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Agreed Price (PHP)</label>
                    <input
                      type="number"
                      value={orderNegotiatedPrice}
                      onChange={(e) => setOrderNegotiatedPrice(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fulfillment Method</label>
                  <select
                    value={orderFulfillment}
                    onChange={(e) => setOrderFulfillment(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="COURIER">Courier Delivery (Grab, Lalamove)</option>
                    <option value="LBC">LBC / Regional Logistics</option>
                    <option value="MEETUP">Physical Meetup</option>
                    <option value="PICKUP">Store Pickup</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Delivery Address</label>
                  <input
                    type="text"
                    value={orderAddress}
                    onChange={(e) => setOrderAddress(e.target.value)}
                    placeholder="Customer delivery address"
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowOrderModal(false)}
                    className="px-3 py-1.5 text-slate-600 hover:text-slate-800 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingOrder}
                    className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    {creatingOrder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Confirm Order
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
