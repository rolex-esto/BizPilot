"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
  ShoppingBag,
  MessageSquare,
  Sparkles,
  Check,
  X,
  Radio,
  Truck,
  CreditCard,
  Tag,
  Phone,
  Handshake,
  Package,
  Wallet,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { ModuleIntroModal, AboutPageButton, useModuleIntro, ModuleIntroConfig } from "@/components/ModuleIntroModal";

const CALENDAR_INTRO_CONFIG: ModuleIntroConfig = {
  moduleKey: "calendar",
  title: "Your Business Schedule",
  badge: "Schedule",
  icon: <CalendarIcon className="w-6 h-6 text-purple-600" />,
  subtitle: "See your upcoming customer meetups, LBC drop-offs, courier pickups, and other business activities.",
  whatYouCanDo: [
    "View scheduled customer meetups with locations (e.g. SM Megamall, Trinoma)",
    "See reminders for LBC parcel drop-offs and tracking numbers",
    "Schedule Grab/Lalamove rider pickups with customer addresses",
    "Set follow-up reminders for customers you need to contact",
  ],
  whyItMatters:
    "Never miss a customer meetup, delivery deadline, or follow-up — everything is in one calendar.",
  nextAction: "Check today's schedule to see what needs to be done.",
};

interface Customer {
  id: string;
  name: string;
  phone?: string;
  deliveryAddress?: string;
  source?: string;
  primaryPlatform?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  totalAmount: number;
  fulfillmentMethod: string;
  status: string;
  items?: Array<{ id: string; productName: string; quantity: number; unitPrice: number }>;
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  eventType: string; // CUSTOMER_MEETUP, STORE_PICKUP, DELIVERY, FOLLOW_UP, PAYMENT_COLLECTION, LBC_SHIPMENT, NEGOTIATION_FOLLOW_UP, OTHER
  startAt: string;
  endAt?: string;
  location?: string;
  status: string; // SCHEDULED, COMPLETED, CANCELLED
  reminderMinutes: number;
  calendarProvider?: string;
  externalEventId?: string;
  sourceType?: string;
  sourceId?: string;
  customer?: Customer;
  order?: Order;
}

interface CalendarConnection {
  id: string;
  provider: string;
  accountEmail: string;
  accountName?: string;
  status: string;
}

// ─── Activity Type Custom Dropdown (SVG icons instead of emojis) ───

const ACTIVITY_TYPES = [
  { value: "CUSTOMER_MEETUP", label: "Customer Meetup", icon: <Handshake className="w-4 h-4 text-purple-600" />, color: "bg-purple-50" },
  { value: "LBC_SHIPMENT", label: "LBC Drop-off / Shipment", icon: <Package className="w-4 h-4 text-rose-600" />, color: "bg-rose-50" },
  { value: "DELIVERY", label: "On-Demand Courier (Grab/Lalamove)", icon: <Truck className="w-4 h-4 text-blue-600" />, color: "bg-blue-50" },
  { value: "FOLLOW_UP", label: "Customer Follow-up", icon: <MessageSquare className="w-4 h-4 text-sky-600" />, color: "bg-sky-50" },
  { value: "NEGOTIATION_FOLLOW_UP", label: "Negotiation Follow-up", icon: <Handshake className="w-4 h-4 text-indigo-600" />, color: "bg-indigo-50" },
  { value: "PAYMENT_COLLECTION", label: "Payment / COD Collection", icon: <Wallet className="w-4 h-4 text-emerald-600" />, color: "bg-emerald-50" },
  { value: "OTHER", label: "Other Operations Task", icon: <ClipboardList className="w-4 h-4 text-slate-600" />, color: "bg-slate-50" },
];

function ActivityTypeSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = ACTIVITY_TYPES.find((t) => t.value === value) || ACTIVITY_TYPES[0];

  return (
    <div className="relative mt-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50 hover:bg-white transition-colors text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`w-7 h-7 rounded-lg ${selected.color} flex items-center justify-center shrink-0`}>
          {selected.icon}
        </span>
        <span className="font-semibold text-slate-800 flex-1">{selected.label}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden py-1"
          role="listbox"
          aria-label="Activity type options"
        >
          {ACTIVITY_TYPES.map((type) => (
            <li key={type.value}>
              <button
                type="button"
                onClick={() => { onChange(type.value); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left hover:bg-purple-50 transition-colors ${
                  value === type.value ? "bg-purple-50 font-bold" : ""
                }`}
                role="option"
                aria-selected={value === type.value}
              >
                <span className={`w-7 h-7 rounded-lg ${type.color} flex items-center justify-center shrink-0`}>
                  {type.icon}
                </span>
                <span className="text-slate-800">{type.label}</span>
                {value === type.value && <Check className="w-3.5 h-3.5 text-purple-600 ml-auto" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const { isOpen: isIntroOpen, openIntro, closeIntro } = useModuleIntro("calendar");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"MONTH" | "WEEK" | "DAY" | "AGENDA">("MONTH");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [notification, setNotification] = useState("");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Selected event modal
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Create Event modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("CUSTOMER_MEETUP");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newTime, setNewTime] = useState("15:00");
  const [newLocation, setNewLocation] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newReminderMin, setNewReminderMin] = useState(30);

  // Connect Calendar modal
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");

  const formatPhp = (amt: number) =>
    `₱${amt.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const fetchEvents = async () => {
    try {
      const res = await fetch(`/api/calendar/events?type=${typeFilter}`);
      const data = await res.json();
      if (data.status === "success") {
        setEvents(data.events);
      }
    } catch (err) {
      console.error("Error fetching calendar events:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConnections = async () => {
    try {
      const res = await fetch("/api/calendar/connect");
      const data = await res.json();
      if (data.status === "success") {
        setConnections(data.connections);
      }
    } catch (err) {
      console.error("Error fetching connections:", err);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchConnections();
  }, [typeFilter]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate || !newTime) return;

    setActionInProgress("creating");
    const startAt = new Date(`${newDate}T${newTime}:00`);

    try {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          eventType: newType,
          startAt: startAt.toISOString(),
          location: newLocation,
          description: newDescription,
          reminderMinutes: newReminderMin,
          sourceType: "MANUAL",
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setNotification(`Event "${newTitle}" scheduled on your calendar!`);
        setTimeout(() => setNotification(""), 4000);
        setShowCreateModal(false);
        setNewTitle("");
        setNewLocation("");
        setNewDescription("");
        fetchEvents();
      } else {
        alert(data.error || "Failed to schedule event");
      }
    } catch (err) {
      console.error("Error creating event:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleUpdateStatus = async (eventId: string, status: "COMPLETED" | "CANCELLED") => {
    setActionInProgress(eventId);
    try {
      const res = await fetch(`/api/calendar/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setNotification(`Event marked as ${status.toLowerCase()}!`);
        setTimeout(() => setNotification(""), 4000);
        setSelectedEvent(null);
        fetchEvents();
      }
    } catch (err) {
      console.error("Error updating event status:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSyncToGoogle = async (eventId: string) => {
    setActionInProgress(`sync_${eventId}`);
    try {
      const res = await fetch(`/api/calendar/events/${eventId}/sync`, {
        method: "POST",
      });

      const data = await res.json();
      if (data.status === "success") {
        setNotification(data.message);
        setTimeout(() => setNotification(""), 4000);
        fetchEvents();
      } else {
        if (!data.connected) {
          setShowConnectModal(true);
        } else {
          alert(data.message || "Failed to sync to calendar");
        }
      }
    } catch (err) {
      console.error("Error syncing event:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleConnectGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmail.trim()) return;

    try {
      const res = await fetch("/api/calendar/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "GOOGLE",
          accountEmail: googleEmail,
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setNotification(`Google Calendar (${googleEmail}) connected successfully!`);
        setTimeout(() => setNotification(""), 4000);
        setShowConnectModal(false);
        setGoogleEmail("");
        fetchConnections();
      }
    } catch (err) {
      console.error("Error connecting calendar:", err);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      const res = await fetch("/api/calendar/connect?provider=GOOGLE", { method: "DELETE" });
      const data = await res.json();
      if (data.status === "success") {
        setNotification("Google Calendar disconnected.");
        setTimeout(() => setNotification(""), 4000);
        fetchConnections();
      }
    } catch (err) {
      console.error("Error disconnecting calendar:", err);
    }
  };

  const googleConn = connections.find((c) => c.provider === "GOOGLE" && c.status === "CONNECTED");

  const getEventBadge = (type: string) => {
    switch (type) {
      case "CUSTOMER_MEETUP":
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 inline-flex items-center gap-1"><Handshake className="w-3 h-3" /> Customer Meetup</span>;
      case "LBC_SHIPMENT":
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 inline-flex items-center gap-1"><Package className="w-3 h-3" /> LBC Drop-off</span>;
      case "DELIVERY":
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 inline-flex items-center gap-1"><Truck className="w-3 h-3" /> On-Demand Courier</span>;
      case "PAYMENT_COLLECTION":
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 inline-flex items-center gap-1"><Wallet className="w-3 h-3" /> Payment / COD Follow-up</span>;
      case "FOLLOW_UP":
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-800 inline-flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Customer Follow-up</span>;
      case "NEGOTIATION_FOLLOW_UP":
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800 inline-flex items-center gap-1"><Handshake className="w-3 h-3" /> Negotiation Follow-up</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 inline-flex items-center gap-1"><ClipboardList className="w-3 h-3" /> Operations Task</span>;
    }
  };

  // Month navigation helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Filter events for a given day in Month View
  const getEventsForDay = (day: number) => {
    return events.filter((e) => {
      const d = new Date(e.startAt);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <CalendarIcon className="w-6 h-6 text-purple-600" />
              Online MSME Operations Calendar
            </h1>
            <AboutPageButton onClick={openIntro} />
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Customer meetups, LBC drop-offs, on-demand courier deliveries, and negotiation follow-ups
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {googleConn ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Google Calendar ({googleConn.accountEmail})
              <button
                onClick={handleDisconnectGoogle}
                className="text-slate-400 hover:text-rose-600 ml-1 text-[10px]"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConnectModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <Radio className="w-3.5 h-3.5 text-slate-500" />
              Connect Google Calendar
            </button>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            + Schedule Activity / Follow-up
          </button>
        </div>
      </div>

      <ModuleIntroModal config={CALENDAR_INTRO_CONFIG} isOpen={isIntroOpen} onClose={closeIntro} />

      {notification && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          {notification}
        </div>
      )}

      {/* Navigation & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        {/* Month Navigation */}
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-slate-900 min-w-44">{monthName}</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToToday}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View & Category Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="ALL">All Categories ({events.length})</option>
            <option value="MEETUP">Customer Meetups</option>
            <option value="LBC">LBC Shipping &amp; Drop-offs</option>
            <option value="DELIVERY">On-Demand Courier / Delivery</option>
            <option value="FOLLOWUP">Customer &amp; Negotiation Follow-ups</option>
            <option value="PAYMENT">Payment &amp; COD Collections</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            {(["MONTH", "AGENDA"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setActiveView(v)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  activeView === v
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {v === "MONTH" ? "Month Grid" : "Agenda Feed"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Calendar View */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-500 mb-2" />
          Loading business operations calendar...
        </div>
      ) : events.length === 0 && activeView === "AGENDA" ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
          <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">Your operations calendar is clear.</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No scheduled customer meetups, LBC drop-offs, courier deliveries, or follow-ups recorded yet.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <button
              onClick={() => {
                setNewType("CUSTOMER_MEETUP");
                setShowCreateModal(true);
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold"
            >
              + Schedule Meetup
            </button>
            <Link
              href="/orders"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
            >
              View Orders
            </Link>
          </div>
        </div>
      ) : activeView === "MONTH" ? (
        /* Month Grid (Responsive Scroll on Mobile) */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="min-w-[600px] sm:min-w-full">
            {/* Day Names */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center py-2.5 text-xs font-bold text-slate-600">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 text-xs">
            {/* Blank leading days */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`blank-${i}`} className="min-h-24 p-2 bg-slate-50/40 text-slate-300" />
            ))}

            {/* Days of Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dayEvents = getEventsForDay(dayNum);
              const isToday =
                new Date().getFullYear() === year &&
                new Date().getMonth() === month &&
                new Date().getDate() === dayNum;

              return (
                <div
                  key={`day-${dayNum}`}
                  className={`min-h-24 p-2 transition-colors flex flex-col justify-between ${
                    isToday ? "bg-purple-50/30 font-bold" : "hover:bg-slate-50/60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`w-6 h-6 flex items-center justify-center rounded-full text-xs ${
                        isToday ? "bg-purple-600 text-white font-bold" : "text-slate-700 font-medium"
                      }`}
                    >
                      {dayNum}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded-full">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 flex-1 overflow-y-auto max-h-20">
                    {dayEvents.map((evt) => (
                      <button
                        key={evt.id}
                        onClick={() => setSelectedEvent(evt)}
                        className={`w-full text-left p-1 rounded text-[10px] truncate block font-medium transition-transform hover:scale-[1.02] ${
                          evt.eventType === "CUSTOMER_MEETUP"
                            ? "bg-purple-100 text-purple-900 border-l-2 border-purple-600"
                            : evt.eventType === "STORE_PICKUP"
                            ? "bg-amber-100 text-amber-900 border-l-2 border-amber-600"
                            : evt.eventType === "LBC_SHIPMENT"
                            ? "bg-rose-100 text-rose-900 border-l-2 border-rose-600"
                            : evt.eventType === "PAYMENT_COLLECTION"
                            ? "bg-emerald-100 text-emerald-900 border-l-2 border-emerald-600"
                            : "bg-sky-100 text-sky-900 border-l-2 border-sky-600"
                        }`}
                      >
                        {new Date(evt.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} {evt.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      ) : (
        /* Agenda Feed */
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 divide-y divide-slate-100">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {getEventBadge(evt.eventType)}
                  <span className="font-bold text-sm text-slate-900">{evt.title}</span>
                  {evt.status === "COMPLETED" && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      Completed
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <Clock className="w-3.5 h-3.5 text-purple-600" />
                    {new Date(evt.startAt).toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>

                  {evt.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {evt.location}
                    </span>
                  )}

                  {evt.customer && (
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {evt.customer.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setSelectedEvent(evt)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                >
                  View Details
                </button>
                {evt.status !== "COMPLETED" && (
                  <button
                    onClick={() => handleUpdateStatus(evt.id, "COMPLETED")}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    Mark Complete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                {getEventBadge(selectedEvent.eventType)}
                <h3 className="text-base font-bold text-slate-900">{selectedEvent.title}</h3>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Date & Time */}
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 space-y-1">
                <div className="font-bold text-purple-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-purple-600" />
                  {new Date(selectedEvent.startAt).toLocaleString("en-PH", {
                    dateStyle: "full",
                    timeStyle: "short",
                  })}
                </div>
                {selectedEvent.location && (
                  <div className="text-purple-700 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-purple-600" />
                    {selectedEvent.location}
                  </div>
                )}
              </div>

              {/* Linked Customer / Order info */}
              {selectedEvent.customer && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>Customer: {selectedEvent.customer.name}</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Source: {selectedEvent.customer.source || selectedEvent.customer.primaryPlatform}
                    </span>
                  </div>
                  {selectedEvent.customer.phone && (
                    <div className="text-slate-600 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {selectedEvent.customer.phone}
                    </div>
                  )}
                </div>
              )}

              {selectedEvent.order && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>Order: {selectedEvent.order.orderNumber}</span>
                    <span className="font-bold text-sky-700">{formatPhp(selectedEvent.order.totalAmount)}</span>
                  </div>
                  <div className="text-slate-500">
                    Fulfillment: {selectedEvent.order.fulfillmentMethod} • Status: {selectedEvent.order.status}
                  </div>
                </div>
              )}

              {selectedEvent.description && (
                <div>
                  <div className="font-bold text-slate-700 mb-0.5">Notes:</div>
                  <p className="text-slate-600">{selectedEvent.description}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <div>
                {!selectedEvent.externalEventId ? (
                  <button
                    onClick={() => handleSyncToGoogle(selectedEvent.id)}
                    disabled={actionInProgress === `sync_${selectedEvent.id}`}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Add to Google Calendar
                  </button>
                ) : (
                  <span className="text-emerald-700 text-xs font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Synced to Google Calendar
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedEvent.order && (
                  <Link
                    href="/orders"
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                  >
                    View Order
                  </Link>
                )}
                {selectedEvent.status !== "COMPLETED" && (
                  <button
                    onClick={() => handleUpdateStatus(selectedEvent.id, "COMPLETED")}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                  >
                    Mark Completed
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Event / Follow-Up Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-purple-600" />
                Schedule Business Activity
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Meetup with John Cruz @ SM Fairview"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700">Activity Type</label>
                  <ActivityTypeSelector value={newType} onChange={setNewType} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Reminder</label>
                  <select
                    value={newReminderMin}
                    onChange={(e) => setNewReminderMin(Number(e.target.value))}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50 mt-1"
                  >
                    <option value={15}>15 mins before</option>
                    <option value={30}>30 mins before</option>
                    <option value={60}>1 hour before</option>
                    <option value={1440}>1 day before</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700">Date *</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Time *</label>
                  <input
                    type="time"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Meeting / Delivery Location</label>
                <input
                  type="text"
                  placeholder="e.g. SM Fairview, Trinoma, MRT Station, Coffee Shop"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Bring extra charger and receipt"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-xl bg-white mt-1 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionInProgress === "creating" || !newTitle.trim()}
                  className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {actionInProgress === "creating" ? "Saving..." : "Save Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Connect Google Calendar Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-600" />
                Connect Google Calendar
              </h3>
              <button onClick={() => setShowConnectModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Synchronize customer meetups and shipment reminders with your Google Calendar account.
            </p>

            <form onSubmit={handleConnectGoogle} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Google Account Email</label>
                <input
                  type="email"
                  required
                  placeholder="owner@gmail.com"
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white mt-1"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!googleEmail.trim()}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-colors"
                >
                  Connect Calendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
