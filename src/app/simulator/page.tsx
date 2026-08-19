"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Bot,
  User,
  ShieldCheck,
  Send,
  Sparkles,
  RefreshCw,
  PlusCircle,
  X,
  Tag,
  CheckCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Sliders,
  Radio,
  Clock,
  ArrowRight,
  Package,
  CreditCard,
  Truck,
  Edit2,
  Trash2,
  ShoppingBag,
  Info,
  Check,
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import {
  PERSONA_DEFINITIONS,
  CustomerPersonaType,
  PersonaDefinition,
} from "@/lib/simulator/customer-persona-engine";

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stockQuantity: number;
  category?: string;
}

interface Message {
  id: string;
  conversationId: string;
  direction: "INBOUND" | "OUTBOUND";
  textContent: string;
  aiClassification?: string | null;
  aiSuggestedReply?: string | null;
  isRead: boolean;
  sentAt: string;
  rawPayload?: string | null;
}

interface Customer {
  id: string;
  name: string;
  handle?: string | null;
  phone?: string | null;
  primaryPlatform: string;
  leadScore: number;
  leadStatus: string;
  deliveryAddress?: string | null;
  externalId?: string | null;
}

interface Conversation {
  id: string;
  platform: string;
  status: string;
  unreadCount: number;
  lastMessagePreview?: string | null;
  lastMessageAt: string;
  customer: Customer;
  messages?: Message[];
}

interface ScenarioPreset {
  id: string;
  title: string;
  productName: string;
  productPrice: number;
  stockQuantity: number;
  platform: string;
  customerName: string;
  persona: CustomerPersonaType;
  initialMessage: string;
  category: string;
  difficulty: "EASY" | "MEDIUM" | "ADVANCED" | "EDGE_CASE";
}

export default function RealisticSimulatorPage() {
  // Data State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioPreset[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulator Controls State
  const [simulatorAutoReply, setSimulatorAutoReply] = useState<boolean>(false);
  const [selectedPersona, setSelectedPersona] = useState<CustomerPersonaType>("CURIOUS_CUSTOMER");
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSimulatingCustomer, setIsSimulatingCustomer] = useState(false);
  const [isApprovingAi, setIsApprovingAi] = useState(false);
  const [handlingToggleLoading, setHandlingToggleLoading] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Record<string, boolean>>({});

  // Modals & UI View State
  const [showNewScenarioModal, setShowNewScenarioModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [customCustomerName, setCustomCustomerName] = useState("");
  const [customPlatform, setCustomPlatform] = useState("FACEBOOK");
  const [customInitialPrompt, setCustomInitialPrompt] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConv?.messages]);

  // Fetch initial scenarios and products
  const fetchScenariosAndCatalog = async () => {
    try {
      const res = await fetch("/api/simulator/scenario-generate");
      const data = await res.json();
      if (data.status === "success") {
        setProducts(data.products || []);
        setScenarios(data.scenarios || []);
        if (data.products?.length > 0 && !selectedProductId) {
          setSelectedProductId(data.products[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching scenarios:", err);
    }
  };

  // Fetch practice conversations strictly with server-side PRACTICE environment
  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/conversations?environment=PRACTICE");
      const data = await res.json();
      if (data.status === "success") {
        const simThreads = data.conversations || [];
        setConversations(simThreads);
        if (simThreads.length > 0 && (!activeConvId || !simThreads.some((t: any) => t.id === activeConvId))) {
          setActiveConvId(simThreads[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch active conversation detail
  const fetchActiveConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (data.status === "success") {
        setActiveConv(data.conversation);
      }
    } catch (err) {
      console.error("Error fetching active conversation:", err);
    }
  };

  useEffect(() => {
    fetchScenariosAndCatalog();
    fetchConversations();
  }, []);

  useEffect(() => {
    if (activeConvId) {
      fetchActiveConversation(activeConvId);
    }
  }, [activeConvId]);

  // 1. Owner Sends Manual Reply
  const handleSendOwnerMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeConvId || !replyText.trim() || isSending) return;

    setIsSending(true);
    const messageToSend = replyText.trim();
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConvId,
          textContent: messageToSend,
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setReplyText("");
        await fetchActiveConversation(activeConvId);
        fetchConversations();

        if (simulatorAutoReply) {
          setTimeout(() => {
            handleSimulateCustomerTurn();
          }, 1200);
        }
      } else {
        alert(data.error || "Failed to send message");
      }
    } catch (err) {
      console.error("Error sending owner message:", err);
    } finally {
      setIsSending(false);
    }
  };

  // 2. Owner Approves AI Suggestion
  const handleApproveAiSuggestion = async (suggestionText: string) => {
    if (!activeConvId || !suggestionText.trim() || isApprovingAi) return;

    setIsApprovingAi(true);
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
        setDismissedSuggestions((prev) => ({ ...prev, [activeConvId]: true }));
        setReplyText("");
        await fetchActiveConversation(activeConvId);
        fetchConversations();

        if (simulatorAutoReply) {
          setTimeout(() => {
            handleSimulateCustomerTurn();
          }, 1200);
        }
      } else {
        alert(data.error || "Failed to approve suggestion");
      }
    } catch (err) {
      console.error("Error approving suggestion:", err);
    } finally {
      setIsApprovingAi(false);
    }
  };

  // 3. Simulate Next Customer Turn (Contextual Follow-up)
  const handleSimulateCustomerTurn = async (customPrompt?: string) => {
    if (!activeConvId || isSimulatingCustomer) return;

    setIsSimulatingCustomer(true);
    try {
      const res = await fetch("/api/simulator/customer-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConvId,
          persona: selectedPersona,
          customText: customPrompt,
          simulatorAutoReply,
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setDismissedSuggestions((prev) => ({ ...prev, [activeConvId]: false }));
        await fetchActiveConversation(activeConvId);
        fetchConversations();
      } else {
        alert(data.error || "Failed to simulate customer turn");
      }
    } catch (err) {
      console.error("Error simulating customer turn:", err);
    } finally {
      setIsSimulatingCustomer(false);
    }
  };

  // 4. Toggle Conversation Mode (AI Assisting vs Owner Handling)
  const handleToggleHandlingMode = async () => {
    if (!activeConvId || !activeConv || handlingToggleLoading) return;

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
      console.error("Error toggling mode:", err);
    } finally {
      setHandlingToggleLoading(false);
    }
  };

  // 5. Create New Scenario from Preset
  const handleLaunchScenarioPreset = async (preset: ScenarioPreset) => {
    setLoading(true);
    try {
      const res = await fetch("/api/simulator/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: preset.platform,
          senderName: preset.customerName,
          senderHandle: `@${preset.customerName.toLowerCase().replace(/\s+/g, "_")}`,
          textContent: preset.initialMessage,
          simulatorAutoReply,
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setSelectedPersona(preset.persona);
        setShowNewScenarioModal(false);
        await fetchConversations();
        if (data.result?.conversationId) {
          setActiveConvId(data.result.conversationId);
        }
      }
    } catch (err) {
      console.error("Error launching preset:", err);
    } finally {
      setLoading(false);
    }
  };

  // 6. Launch Custom Scenario
  const handleLaunchCustomScenario = async () => {
    const selectedProd = products.find((p) => p.id === selectedProductId) || products[0];
    const name = customCustomerName.trim() || "Juan Dela Cruz";
    const initialText =
      customInitialPrompt.trim() ||
      (selectedProd
        ? `Hi po! Magkano po ang ${selectedProd.name} at available pa po ba?`
        : "Hi, I am interested in your products.");

    setLoading(true);
    try {
      const res = await fetch("/api/simulator/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: customPlatform,
          senderName: name,
          senderHandle: `@${name.toLowerCase().replace(/\s+/g, "_")}`,
          textContent: initialText,
          simulatorAutoReply,
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setShowNewScenarioModal(false);
        setCustomCustomerName("");
        setCustomInitialPrompt("");
        await fetchConversations();
        if (data.result?.conversationId) {
          setActiveConvId(data.result.conversationId);
        }
      }
    } catch (err) {
      console.error("Error launching custom scenario:", err);
    } finally {
      setLoading(false);
    }
  };

  // 7. Reset Practice Data
  const handleResetSimulator = async () => {
    try {
      const res = await fetch("/api/simulator/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetAll: true }),
      });

      if (res.ok) {
        setShowResetModal(false);
        setActiveConv(null);
        setActiveConvId(null);
        setConversations([]);
        await fetchConversations();
        if (scenarios.length > 0) {
          handleLaunchScenarioPreset(scenarios[0]);
        }
      }
    } catch (err) {
      console.error("Error resetting simulator:", err);
    }
  };

  const lastInboundMsg = activeConv?.messages
    ? [...activeConv.messages].reverse().find((m) => m.direction === "INBOUND" && m.aiSuggestedReply)
    : null;

  const currentSuggestion =
    lastInboundMsg && activeConv && !dismissedSuggestions[activeConv.id]
      ? lastInboundMsg.aiSuggestedReply
      : null;

  const activePersonaDef: PersonaDefinition = PERSONA_DEFINITIONS[selectedPersona] || PERSONA_DEFINITIONS.CURIOUS_CUSTOMER;

  return (
    <div className="space-y-4 max-w-7xl mx-auto px-2 sm:px-4 py-4">
      {/* ─── Top Header & Practice Environment Banner ─── */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-purple-800/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/40 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-purple-300" />
              Practice / Simulator Studio
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
              Real DB Grounding Active
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
            Realistic Customer & AI Copilot Simulator
          </h1>
          <p className="text-xs text-purple-200/80 max-w-2xl leading-relaxed">
            Simulate both sides of customer communication (Customer ↔ BizPilot ↔ Owner/AI) with real catalog grounding, dynamic customer memory, and full owner approval controls.
          </p>
        </div>

        {/* Global Simulator Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* AI Auto-Reply Simulator Toggle */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 px-3 border border-white/15 flex items-center gap-2.5">
            <div className="text-right">
              <div className="text-[11px] font-bold text-white flex items-center gap-1">
                <Bot className="w-3.5 h-3.5 text-purple-300" />
                Sim Auto-Reply
              </div>
              <div className="text-[9px] text-purple-200/70">
                {simulatorAutoReply ? "Auto-answering" : "Manual Approval"}
              </div>
            </div>
            <button
              onClick={() => setSimulatorAutoReply(!simulatorAutoReply)}
              title="Toggle simulator auto-reply mode. Strictly isolated to practice mode."
              className={`w-11 h-6 rounded-full p-0.5 transition-colors relative ${
                simulatorAutoReply ? "bg-emerald-500" : "bg-slate-600"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  simulatorAutoReply ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <button
            onClick={() => setShowNewScenarioModal(true)}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            New Scenario
          </button>

          <button
            onClick={() => setShowResetModal(true)}
            title="Reset practice simulator threads"
            className="p-2 bg-white/10 hover:bg-white/20 text-purple-200 hover:text-white rounded-xl text-xs font-bold transition-colors border border-white/15"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Main 3-Column Simulator Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start min-h-[640px]">
        {/* ─── Column 1: Practice Threads & Persona Selector (3 Cols) ─── */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full max-h-[720px]">
          {/* Header */}
          <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-bold text-slate-800">Practice Threads</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
              {conversations.length} Active
            </span>
          </div>

          {/* Persona Filter / Selector */}
          <div className="p-2.5 bg-purple-50/50 border-b border-purple-100 space-y-1.5">
            <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider flex items-center justify-between">
              <span>Customer Persona:</span>
              <span className="text-[9px] text-purple-600 font-medium">Controls Next Turn</span>
            </label>
            <select
              value={selectedPersona}
              onChange={(e) => setSelectedPersona(e.target.value as CustomerPersonaType)}
              className="w-full text-xs p-1.5 rounded-lg border border-purple-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {Object.values(PERSONA_DEFINITIONS).map((p) => (
                <option key={p.type} value={p.type}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {conversations.length === 0 ? (
              <div className="p-6 text-center space-y-3">
                <User className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500">No practice conversations yet.</p>
                <button
                  onClick={() => setShowNewScenarioModal(true)}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  Generate First Scenario
                </button>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = conv.id === activeConvId;
                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`w-full text-left p-3 transition-colors flex flex-col gap-1 ${
                      isSelected ? "bg-purple-50/80 border-l-4 border-purple-600" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 truncate max-w-[130px]">
                        {conv.customer.name}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                        {conv.platform}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 line-clamp-1">
                      {conv.lastMessagePreview || "No messages yet"}
                    </p>

                    <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        {conv.status === "OWNER_HANDLING" ? (
                          <span className="text-sky-600 font-bold flex items-center gap-0.5">
                            <User className="w-2.5 h-2.5" /> Owner
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                            <Bot className="w-2.5 h-2.5" /> AI
                          </span>
                        )}
                      </span>
                      <span>
                        {new Date(conv.lastMessageAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ─── Column 2: Interactive Conversation & Multi-Actor Chat (6 Cols) ─── */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full max-h-[720px]">
          {activeConv ? (
            <>
              {/* Thread Header */}
              <div className="p-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900">
                      {activeConv.customer.name}
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded">
                      Simulated {activeConv.platform}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span>Persona:</span>
                    <span className={`font-bold px-1.5 py-0.2 rounded ${activePersonaDef.badgeColor}`}>
                      {activePersonaDef.displayName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Handling Mode Toggle */}
                  <button
                    onClick={handleToggleHandlingMode}
                    disabled={handlingToggleLoading}
                    title={
                      activeConv.status === "OWNER_HANDLING"
                        ? "Click to switch back to AI Assisting mode"
                        : "Click to take over manually"
                    }
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
                      activeConv.status === "OWNER_HANDLING"
                        ? "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"
                        : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                    }`}
                  >
                    {activeConv.status === "OWNER_HANDLING" ? (
                      <>
                        <User className="w-3.5 h-3.5 text-sky-600" />
                        <span>Owner Handling</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-3.5 h-3.5 text-purple-600" />
                        <span>AI Assisting</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Message History Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/60">
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
                  const isOwner = actor === "OWNER";

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isCustomer ? "items-start" : "items-end"}`}
                    >
                      {/* Actor Badge */}
                      <div className="text-[10px] font-bold mb-1 flex items-center gap-1.5 px-1">
                        {isCustomer ? (
                          <>
                            <User className="w-3 h-3 text-slate-400" />
                            <span className="text-slate-700 font-bold">{activeConv.customer.name} (Simulated Customer)</span>
                            <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded border border-purple-200">
                              PRACTICE
                            </span>
                          </>
                        ) : isAi ? (
                          <>
                            <Bot className="w-3 h-3 text-purple-600" />
                            <span className="text-purple-700 font-bold">BizPilot AI (Simulated Auto-Reply)</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3 h-3 text-sky-600" />
                            <span className="text-sky-700 font-bold">Store Owner (Manual)</span>
                          </>
                        )}
                      </div>

                      {/* Bubble */}
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
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-purple-700 font-bold">
                            <Sparkles className="w-3 h-3 text-purple-600" />
                            Intent: {msg.aiClassification}
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
                <div ref={messagesEndRef} />
              </div>

              {/* ─── Grounded AI Suggestion Card (Safe Approval Mode) ─── */}
              {currentSuggestion && (
                <div className="p-3 bg-gradient-to-r from-purple-50 via-indigo-50 to-sky-50 border-t border-b border-purple-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-black text-purple-950">
                        Grounded AI Suggestion (Safe Approval Mode)
                      </span>
                    </div>
                    <button
                      onClick={() => setDismissedSuggestions((prev) => ({ ...prev, [activeConv.id]: true }))}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                      title="Dismiss suggestion"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-800 bg-white/90 p-2.5 rounded-xl border border-purple-100 leading-relaxed shadow-2xs font-medium">
                    {currentSuggestion}
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-0.5">
                    <button
                      onClick={() => setReplyText(currentSuggestion)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-colors shadow-2xs"
                    >
                      <Edit2 className="w-3 h-3 text-slate-500" />
                      Edit in Composer
                    </button>
                    <button
                      onClick={() => handleApproveAiSuggestion(currentSuggestion)}
                      disabled={isApprovingAi}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
                    >
                      <Send className="w-3 h-3" />
                      {isApprovingAi ? "Sending..." : "Approve & Send"}
                    </button>
                  </div>
                </div>
              )}

              {/* ─── Simulation Next-Turn Action Bar ─── */}
              <div className="p-2.5 bg-amber-50/80 border-t border-amber-200 flex items-center justify-between gap-2 text-xs flex-wrap">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <Play className="w-3.5 h-3.5 text-amber-600" />
                  <span>Simulate Next Customer Action:</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleSimulateCustomerTurn()}
                    disabled={isSimulatingCustomer}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-black transition-colors shadow-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    <MessageSquare className="w-3 h-3" />
                    {isSimulatingCustomer ? "Simulating..." : "Simulate Customer Reply 💬"}
                  </button>

                  <button
                    onClick={() => handleSimulateCustomerTurn("Magkano po last price kung cash payment?")}
                    disabled={isSimulatingCustomer}
                    className="px-2 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold"
                  >
                    Ask Tawad
                  </button>

                  <button
                    onClick={() => handleSimulateCustomerTurn("Pwede po bang GCash ang payment?")}
                    disabled={isSimulatingCustomer}
                    className="px-2 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold"
                  >
                    Ask GCash
                  </button>

                  <button
                    onClick={() => handleSimulateCustomerTurn("Magkano shipping papuntang Davao via LBC?")}
                    disabled={isSimulatingCustomer}
                    className="px-2 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold"
                  >
                    Ask Delivery
                  </button>
                </div>
              </div>

              {/* ─── Owner Reply Composer ─── */}
              <form onSubmit={handleSendOwnerMessage} className="p-3 border-t border-slate-200 bg-white">
                <div className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    placeholder="Type your response as the Store Owner..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-1 text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !replyText.trim()}
                    className="p-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 shrink-0"
                    title="Send as Store Owner"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-slate-400">
              Select or generate a practice conversation from the left to start testing.
            </div>
          )}
        </div>

        {/* ─── Column 3: Live Grounding & Context Inspector (3 Cols) ─── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Persona Intelligence Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <User className="w-4 h-4 text-purple-600" />
                Customer Persona Profile
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activePersonaDef.badgeColor}`}>
                {activePersonaDef.displayName}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {activePersonaDef.description}
            </p>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Behavioral Traits:
              </span>
              <div className="space-y-1">
                {activePersonaDef.traits.map((t, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {activeConv && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Lead Score:</span>
                <span className="font-bold text-emerald-600">{activeConv.customer.leadScore}/100</span>
              </div>
            )}
          </div>

          {/* Real Database Grounding Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-sky-600" />
                Live Business Grounding
              </h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Verified DB
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Store Products Catalog:
                </span>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {products.map((p) => (
                    <div
                      key={p.id}
                      className="p-1.5 rounded bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px]"
                    >
                      <span className="font-bold text-slate-800 truncate max-w-[120px]">{p.name}</span>
                      <span className="font-mono text-slate-600">
                        ₱{p.price.toLocaleString("en-PH")} ({p.stockQuantity} in stock)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-slate-400" /> Payments:
                  </span>
                  <span className="font-bold text-slate-700">GCash, Maya, COD</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Truck className="w-3 h-3 text-slate-400" /> Fulfillment:
                  </span>
                  <span className="font-bold text-slate-700">LBC, Grab, Meetup</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hallucination Guard & Safety Card */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-4 shadow-sm space-y-2">
            <h3 className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Hallucination & Policy Guards
            </h3>
            <ul className="text-[11px] text-emerald-900 space-y-1 font-medium">
              <li className="flex items-start gap-1">
                <Check className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />
                <span>Zero fabricated prices (uses real DB catalog).</span>
              </li>
              <li className="flex items-start gap-1">
                <Check className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />
                <span>Out-of-policy tawad escalated to owner.</span>
              </li>
              <li className="flex items-start gap-1">
                <Check className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />
                <span>Unverified policies escalated with ESCALATE_TO_OWNER.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ─── Modal: New Scenario Generator ─── */}
      {showNewScenarioModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900">Launch Practice Customer Scenario</h2>
                <p className="text-xs text-slate-500">
                  Select a ready-made preset or customize a customer persona with real store products.
                </p>
              </div>
              <button
                onClick={() => setShowNewScenarioModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ready-to-use Scenarios */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                1-Click Grounded Presets (Real Catalog)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {scenarios.map((scen) => (
                  <button
                    key={scen.id}
                    onClick={() => handleLaunchScenarioPreset(scen)}
                    className="text-left p-3 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/40 transition-all group space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 group-hover:text-purple-700">
                        {scen.customerName}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        {scen.platform}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium line-clamp-2">
                      "{scen.initialMessage}"
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-purple-700 font-bold pt-1">
                      <span>{scen.category}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Scenario Generator */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Or Customize Your Test Customer
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">Customer Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Juan Dela Cruz"
                    value={customCustomerName}
                    onChange={(e) => setCustomCustomerName(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">Platform Channel</label>
                  <select
                    value={customPlatform}
                    onChange={(e) => setCustomPlatform(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="FACEBOOK">Facebook Practice</option>
                    <option value="INSTAGRAM">Instagram Practice</option>
                    <option value="WHATSAPP">WhatsApp Practice</option>
                    <option value="TIKTOK">TikTok Practice</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">Target Product</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ₱{p.price.toLocaleString("en-PH")} ({p.stockQuantity} in stock)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">Initial Message (Optional)</label>
                  <input
                    type="text"
                    placeholder="Leave empty for auto-generated query"
                    value={customInitialPrompt}
                    onChange={(e) => setCustomInitialPrompt(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleLaunchCustomScenario}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                >
                  Start Custom Practice Thread
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Reset Practice Data ─── */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 text-sm">Reset Practice Sessions?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will clear simulated practice threads and messages. Your real store data and live customers will remain 100% untouched.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleResetSimulator}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Reset Practice Threads
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
