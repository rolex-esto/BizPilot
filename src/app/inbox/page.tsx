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
} from "lucide-react";
import { ModuleIntroModal, AboutPageButton, useModuleIntro, ModuleIntroConfig } from "@/components/ModuleIntroModal";

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

  const knownTimestampsRef = useRef<Record<string, number>>({});
  const initialLoadDoneRef = useRef(false);
  const lastActiveMsgCountRef = useRef<Record<string, number>>({});

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

  const fetchConversations = async () => {
    try {
      const res = await fetch(`/api/conversations?environment=${inboxMode}&platform=${platformFilter}&leadStatus=${leadFilter}`);
      const data = await res.json();
      if (data.status === "success") {
        const convList = data.conversations as Conversation[];
        setConversations(convList);
        if (!activeConvId && convList.length > 0) {
          setActiveConvId(convList[0].id);
        }

        // Check for new inbound customer message
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

          if (initialLoadDoneRef.current && prevTime !== undefined && lastTime > prevTime) {
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
    } catch (err) {
      console.error("Error fetching conversations:", err);
    } finally {
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

  const fetchActiveConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (data.status === "success") {
        const conv = data.conversation as Conversation;
        setActiveConv(conv);
        setOrderAddress(conv.customer.deliveryAddress || "");
        setOrderPhone(conv.customer.phone || "");

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
    } catch (err) {
      console.error("Error fetching conversation details:", err);
    }
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
      const res = await fetch("/api/channels/sync", { method: "POST" });
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
        await fetchConversations();
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

  useEffect(() => {
    fetchConversations();
    fetchProducts();

    // Auto-poll conversations every 3 seconds for real-time incoming messages
    const convInterval = setInterval(() => {
      fetchConversations();
    }, 3000);

    return () => clearInterval(convInterval);
  }, [inboxMode, platformFilter, leadFilter]);

  useEffect(() => {
    if (activeConvId) {
      fetchActiveConversation(activeConvId);

      // Reset document title once conversation is active
      if (typeof document !== "undefined") {
        document.title = "BizPilot - Customer Messages";
      }

      // Auto-poll the active chat thread every 2.5 seconds for instant real-time message stream
      const chatInterval = setInterval(() => {
        fetchActiveConversation(activeConvId);
      }, 2500);

      return () => clearInterval(chatInterval);
    }
  }, [activeConvId]);

  // Event-Driven Real-time Stream (SSE) with Graceful Polling Fallback
  useEffect(() => {
    let eventSource: EventSource | null = null;

    if (typeof window !== "undefined" && "EventSource" in window) {
      try {
        eventSource = new EventSource("/api/realtime");

        eventSource.onmessage = (e) => {
          try {
            const event = JSON.parse(e.data);
            if (event.type === "message.created") {
              // Instantly refresh conversations list
              fetchConversations();

              // If event belongs to currently active conversation, refresh message stream immediately
              if (activeConvId && event.conversationId === activeConvId) {
                fetchActiveConversation(activeConvId);
              }

              // Play notification chime & trigger toast for incoming messages
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
            // Heartbeat/ping ignore
          }
        };

        eventSource.onerror = () => {
          // Fallback interval polling continues seamlessly
          eventSource?.close();
        };
      } catch {
        // Fallback polling active
      }
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [activeConvId]);

  // Smooth auto-scroll to bottom whenever new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages?.length, activeConvId, aiSuggestionMinimized]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeConvId) return;

    setSending(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConvId,
          textContent: replyText,
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setReplyText("");
        fetchActiveConversation(activeConvId);
        fetchConversations();
      } else {
        alert(data.error || "Failed to send message");
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
              onClick={() => { setInboxMode("LIVE"); setActiveConvId(null); }}
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
              onClick={() => { setInboxMode("PRACTICE"); setActiveConvId(null); }}
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
              <button onClick={fetchConversations} className="text-slate-400 hover:text-slate-600 p-0.5" title="Refresh local inbox">
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
                    onClick={() => setActiveConvId(conv.id)}
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
                    onClick={() => setActiveConvId(null)}
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

              {/* Reply Input Box */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white">
                <div className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    placeholder="Type your response to the buyer..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-1 text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={sending || !replyText.trim()}
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
                setActiveConvId(activeToast.convId);
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
    </div>
  );
}
