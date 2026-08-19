"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  Send,
  Package,
  ShoppingBag,
  CreditCard,
  Calendar,
  Users,
  Radio,
  TrendingUp,
  HelpCircle,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface CopilotResponse {
  question: string;
  answer: string;
  category: string;
  dataPoints: Array<{ label: string; value: string | number }>;
  recommendedAction?: string;
  timestamp: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  data?: CopilotResponse;
}

// Follow-up suggestions based on the category of the last answer
const FOLLOW_UP_MAP: Record<string, Array<{ label: string; q: string }>> = {
  SALES: [
    { label: "Who has pending payments?", q: "Who still has pending payments?" },
    { label: "Show today's orders", q: "What orders came in today?" },
    { label: "How much discount did I give?", q: "How much total discount did I give?" },
  ],
  INVENTORY: [
    { label: "Which products sell the most?", q: "Which products generate the most sales?" },
    { label: "Show all my products", q: "How many products do I have in total?" },
    { label: "Any pending orders?", q: "Are there pending orders I need to fulfill?" },
  ],
  PAYMENTS: [
    { label: "Show COD orders", q: "Which orders are Cash on Delivery?" },
    { label: "Total sales so far", q: "How much did I sell in total?" },
    { label: "Check my schedule", q: "What's my schedule today?" },
  ],
  LEADS: [
    { label: "Show active negotiations", q: "Who am I currently negotiating with?" },
    { label: "Unanswered messages?", q: "Do I have unanswered customer messages?" },
    { label: "Check my schedule", q: "Do I have any meetups coming up?" },
  ],
  CHANNELS: [
    { label: "Who are my hot leads?", q: "Who are my hottest leads?" },
    { label: "Check inbox activity", q: "Which platform brings in the most customers?" },
    { label: "Today's schedule", q: "What's on my schedule today?" },
  ],
  GENERAL: [
    { label: "Check my sales", q: "How much did I sell in total?" },
    { label: "Low stock items?", q: "Which products are low on stock?" },
    { label: "Pending payments", q: "Who has pending payments?" },
  ],
};

const SUGGESTED_QUESTIONS = [
  { icon: "💰", label: "How are my sales?", q: "How much did I sell in total?" },
  { icon: "📦", label: "Low stock products", q: "Which products are low on stock?" },
  { icon: "💳", label: "Pending payments", q: "Who has pending payments?" },
  { icon: "🤝", label: "Today's meetups", q: "Do I have any meetups today?" },
  { icon: "📅", label: "Today's schedule", q: "What's my schedule today?" },
  { icon: "🔥", label: "Hot leads", q: "Who are my hottest leads?" },
];

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversation from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("bizpilot_copilot_history");
      if (saved) {
        setMessages(JSON.parse(saved));
      }
    } catch {}
  }, []);

  // Save conversation to localStorage whenever it changes
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem("bizpilot_copilot_history", JSON.stringify(messages));
      } catch {}
    }
  }, [messages]);

  const clearConversation = () => {
    setMessages([]);
    try {
      localStorage.removeItem("bizpilot_copilot_history");
    } catch {}
  };

  const handleAsk = async (queryText?: string) => {
    const q = queryText || input;
    if (!q.trim() || loading) return;

    const userMessage: Message = { role: "user", content: q.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/copilot/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.trim() }),
      });

      const data = await res.json();
      if (data.status === "success" && data.answer) {
        const assistantMessage: Message = {
          role: "assistant",
          content: data.answer.answer,
          data: data.answer,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error || "I couldn't process that question. Please try again." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I'm having trouble connecting right now. Please try again in a moment." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="shrink-0 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900">AI Copilot</h1>
              <p className="text-xs text-slate-500">Ask questions about your business — answers come from your real data.</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearConversation}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              Clear Chat
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 min-h-0">
        {/* Welcome State */}
        {messages.length === 0 && (
          <div className="space-y-6 pt-8">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto">
                <Sparkles className="w-7 h-7 text-indigo-600" />
              </div>
              <h2 className="text-base font-bold text-slate-900">How can I help you today?</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                I can check your sales, inventory, orders, schedule, and customer activity. All answers come directly from your BizPilot data.
              </p>
            </div>

            {/* Suggested Questions */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg mx-auto">
              {SUGGESTED_QUESTIONS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAsk(item.q)}
                  className="p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm text-left transition-all group"
                >
                  <span className="text-base">{item.icon}</span>
                  <p className="text-[11px] font-semibold text-slate-700 mt-1 group-hover:text-indigo-700">{item.label}</p>
                </button>
              ))}
            </div>

            <div className="text-center">
              <p className="text-[11px] text-slate-400">
                Try asking: "What should I focus on today?" or "How much discount did I give?"
              </p>
            </div>
          </div>
        )}

        {/* Conversation */}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "user" ? (
              <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-md bg-indigo-600 text-white text-xs font-medium">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[90%] space-y-2">
                <div className="bg-white rounded-2xl rounded-tl-md border border-slate-200 p-4 shadow-sm space-y-3">
                  {/* Answer text */}
                  <div className="text-xs text-slate-700 leading-relaxed prose prose-xs prose-slate max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>

                  {/* Data Points */}
                  {msg.data?.dataPoints && msg.data.dataPoints.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                      {msg.data.dataPoints.map((dp, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px]">
                          <span className="text-slate-500">{dp.label}:</span>{" "}
                          <span className="font-bold text-slate-800">{dp.value}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Recommended Action */}
                  {msg.data?.recommendedAction && (
                    <div className="flex items-start gap-2 text-[11px] text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{msg.data.recommendedAction}</span>
                    </div>
                  )}
                </div>

                {/* Follow-up Suggestions (only on the last assistant message) */}
                {idx === messages.length - 1 && msg.data?.category && !loading && (
                  <div className="flex flex-wrap gap-1.5 pl-1">
                    {(FOLLOW_UP_MAP[msg.data.category] || FOLLOW_UP_MAP.GENERAL).map((fq, i) => (
                      <button
                        key={i}
                        onClick={() => handleAsk(fq.q)}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 hover:border-indigo-200 transition-colors"
                      >
                        {fq.label}
                      </button>
                    ))}
                  </div>
                )}

                <p className="text-[10px] text-slate-400 pl-2">
                  Based on your BizPilot data
                </p>
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-tl-md border border-slate-200 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                Checking your data...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="shrink-0 pt-3 border-t border-slate-200">
        <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm focus-within:border-indigo-300 transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask about your sales, orders, inventory, schedule..."
            className="flex-1 px-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
            disabled={loading}
          />
          <button
            onClick={() => handleAsk()}
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs transition-all flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            Ask
          </button>
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-2">
          All answers are based on your actual business records in BizPilot.
        </p>
      </div>
    </div>
  );
}
