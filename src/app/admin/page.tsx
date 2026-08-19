"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShieldCheck,
  Building,
  Users,
  Package,
  ShoppingBag,
  Plus,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Store,
  CreditCard,
  Layers,
  Gift,
  Search,
  Trash2,
  FileText,
  Activity,
  Lock,
  Eye,
  AlertTriangle,
  HelpCircle,
  Clock,
  Unlock,
  BookOpen,
  Check,
  X,
  Share2,
  HeartPulse,
  TrendingUp,
  ChevronRight,
  ExternalLink,
  DollarSign,
  Calendar,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { AboutPage } from "@/components/AboutPage";
import { AdminApprovalModal, AdminApprovalActionType } from "@/components/AdminApprovalModal";

type AdminTab =
  | "overview"
  | "people"
  | "businesses"
  | "products"
  | "orders"
  | "customers"
  | "subscriptions"
  | "channels"
  | "support"
  | "security"
  | "health"
  | "guide";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user: currentUser, isLoading: authLoading, isAuthenticated, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Data States
  const [stats, setStats] = useState<any>(null);
  const [attentionAlerts, setAttentionAlerts] = useState<any[]>([]);
  const [trialsEndingSoon, setTrialsEndingSoon] = useState<any[]>([]);
  const [orderStatusBreakdown, setOrderStatusBreakdown] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [channelSummary, setChannelSummary] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [supportSessions, setSupportSessions] = useState<any[]>([]);

  // Search & Filters
  const [globalSearch, setGlobalSearch] = useState("");
  const [trialFilter, setTrialFilter] = useState<"all" | "today" | "3days" | "7days">("all");
  const [logViewType, setLogViewType] = useState<"ADMIN" | "SYSTEM">("ADMIN");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Business Detail Drawer
  const [selectedBusiness, setSelectedBusiness] = useState<any | null>(null);

  // Modals & Forms
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [bizName, setBizName] = useState("");
  const [bizOwner, setBizOwner] = useState("");
  const [bizEmail, setBizEmail] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizAddress, setBizAddress] = useState("Online Hub, Metro Manila");
  const [creatingBiz, setCreatingBiz] = useState(false);

  // Support Session Request Modal
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportBizId, setSupportBizId] = useState("");
  const [supportReason, setSupportReason] = useState("");
  const [supportScope, setSupportScope] = useState("ORDERS");
  const [supportDuration, setSupportDuration] = useState(30);
  const [startingSupport, setStartingSupport] = useState(false);

  // Secure Approval Modal State (Protected Admin Actions & Plan Changes)
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<AdminApprovalActionType>("GRANT_ADMIN");
  const [approvalTargetEmail, setApprovalTargetEmail] = useState("");
  const [approvalTargetId, setApprovalTargetId] = useState("");
  const [approvalMetadata, setApprovalMetadata] = useState<Record<string, any> | undefined>(undefined);

  // Redirect non-admin users
  useEffect(() => {
    if (!authLoading && isAuthenticated && currentUser?.role !== "ADMIN") {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, currentUser, router]);

  // Load Admin Data
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [
        statsRes,
        usersRes,
        bizRes,
        prodRes,
        ordersRes,
        custRes,
        chanRes,
        auditRes,
        healthRes,
        supportRes,
      ] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/users"),
        fetch("/api/admin/businesses"),
        fetch("/api/admin/products"),
        fetch("/api/admin/orders"),
        fetch("/api/admin/customers"),
        fetch("/api/admin/channels"),
        fetch("/api/admin/audit-logs"),
        fetch("/api/admin/system-health"),
        fetch("/api/admin/support"),
      ]);

      if (statsRes.status === 403 || usersRes.status === 403) {
        router.push("/");
        return;
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
        setAttentionAlerts(statsData.attentionAlerts || []);
        setTrialsEndingSoon(statsData.trialsEndingSoon || []);
        setOrderStatusBreakdown(statsData.orderStatusBreakdown || null);
      }
      if (usersRes.ok) setUsers((await usersRes.json()).users || []);
      if (bizRes.ok) setBusinesses((await bizRes.json()).businesses || []);
      if (prodRes.ok) setProducts((await prodRes.json()).products || []);
      if (ordersRes.ok) setOrders((await ordersRes.json()).orders || []);
      if (custRes.ok) setCustomers((await custRes.json()).customers || []);
      if (chanRes.ok) {
        const chanData = await chanRes.json();
        setChannels(chanData.connections || []);
        setChannelSummary(chanData.activitySummary || null);
      }
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLogs(auditData.logs || []);
        setAdminLogs(auditData.adminLogs || []);
        setSystemLogs(auditData.systemLogs || []);
      }
      if (healthRes.ok) setHealth((await healthRes.json()).health || null);
      if (supportRes.ok) setSupportSessions((await supportRes.json()).sessions || []);
    } catch {
      setErrorMsg("Failed to load control center data. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && currentUser?.role === "ADMIN") {
      loadData();
    }
  }, [authLoading, isAuthenticated, currentUser, loadData]);

  // ─── ADMIN ACTIONS ───

  // Start Support Session
  const handleStartSupportSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportBizId || !supportReason.trim()) return;

    setStartingSupport(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: supportBizId,
          reason: supportReason.trim(),
          scope: supportScope,
          durationMinutes: supportDuration,
        }),
      });

      const json = await res.json();
      if (res.ok && json.status === "success") {
        setSuccessMsg(`✓ ${json.message}`);
        setShowSupportModal(false);
        setSupportReason("");
        await loadData();
      } else {
        setErrorMsg(json.error || "Failed to start support session");
      }
    } catch {
      setErrorMsg("Network error occurred");
    } finally {
      setStartingSupport(false);
    }
  };

  // Revoke Support Session
  const handleRevokeSupportSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to end this support session early?")) return;

    try {
      const res = await fetch(`/api/admin/support?id=${sessionId}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.status === "success") {
        setSuccessMsg(`✓ ${json.message}`);
        await loadData();
      } else {
        setErrorMsg(json.error || "Failed to end support session");
      }
    } catch {
      setErrorMsg("Network error occurred");
    }
  };

  // Grant Lifetime Free
  const handleGrantLifetime = async (bizId: string, bizName: string) => {
    if (!confirm(`Are you sure you want to grant LIFETIME FREE (PRO Tier) to "${bizName}"?`)) return;

    setUpdatingId(bizId);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/admin/businesses/${bizId}/subscription`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLifetimeFree: true }),
      });
      const json = await res.json();
      if (res.ok && json.status === "success") {
        setSuccessMsg(`✓ ${json.message}`);
        if (selectedBusiness && selectedBusiness.id === bizId) {
          setSelectedBusiness((prev: any) => ({
            ...prev,
            planTier: "PRO",
            subscriptionStatus: "ACTIVE",
            trialEndsAt: null,
          }));
        }
        await loadData();
      } else {
        setErrorMsg(json.error || "Failed to grant lifetime access");
      }
    } catch {
      setErrorMsg("Network error occurred");
    } finally {
      setUpdatingId(null);
    }
  };

  // Update Plan / Status
  const handleUpdatePlan = async (bizId: string, planTier: string, subscriptionStatus: string) => {
    setUpdatingId(bizId);
    try {
      const res = await fetch(`/api/admin/businesses/${bizId}/subscription`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier, subscriptionStatus }),
      });
      const json = await res.json();
      if (res.ok && json.status === "success") {
        setSuccessMsg(`✓ ${json.message}`);
        await loadData();
      } else {
        setErrorMsg(json.error || "Failed to update subscription");
      }
    } catch {
      setErrorMsg("Network error occurred");
    } finally {
      setUpdatingId(null);
    }
  };

  // Update User Role
  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    if (!confirm(`Are you sure you want to change this person's role to ${newRole}?`)) return;

    setUpdatingId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const json = await res.json();
      if (res.ok && json.status === "success") {
        setSuccessMsg(`✓ ${json.message}`);
        await loadData();
      } else {
        setErrorMsg(json.error || "Failed to update user role");
      }
    } catch {
      setErrorMsg("Network error occurred");
    } finally {
      setUpdatingId(null);
    }
  };

  // Delete User with Last-Admin Protection
  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete account "${email}"? This action cannot be undone.`)) return;

    setUpdatingId(userId);
    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.status === "success") {
        setSuccessMsg(`✓ ${json.message}`);
        await loadData();
      } else {
        setErrorMsg(json.error || "Failed to delete user");
      }
    } catch {
      setErrorMsg("Network error occurred");
    } finally {
      setUpdatingId(null);
    }
  };

  // Delete Business
  const handleDeleteBusiness = async (bizId: string, name: string) => {
    if (!confirm(`You're about to delete business "${name}". This will remove the store and its records. Are you sure?`)) return;

    setUpdatingId(bizId);
    try {
      const res = await fetch(`/api/admin/businesses?id=${bizId}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.status === "success") {
        setSuccessMsg(`✓ ${json.message}`);
        setSelectedBusiness(null);
        await loadData();
      } else {
        setErrorMsg(json.error || "Failed to delete business");
      }
    } catch {
      setErrorMsg("Network error occurred");
    } finally {
      setUpdatingId(null);
    }
  };

  // Create Store
  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName.trim() || !bizOwner.trim()) return;

    setCreatingBiz(true);
    try {
      const res = await fetch("/api/business/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: bizName.trim(),
          ownerName: bizOwner.trim(),
          email: bizEmail.trim(),
          contactNumber: bizPhone.trim(),
          address: bizAddress.trim(),
          operatingHours: "Daily 8:00 AM - 10:00 PM",
          fulfillmentOptions: ["MEETUP", "LBC", "GRAB", "LALAMOVE", "DELIVERY"],
          acceptedPayments: ["GCASH", "MAYA", "BANK_TRANSFER", "COD", "CASH"],
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setSuccessMsg(`✓ Store "${data.business.name}" created successfully!`);
        setShowSetupModal(false);
        setBizName("");
        setBizOwner("");
        setBizEmail("");
        setBizPhone("");
        await loadData();
      } else {
        setErrorMsg(data.error || "Failed to create store");
      }
    } catch {
      setErrorMsg("Network error occurred");
    } finally {
      setCreatingBiz(false);
    }
  };

  // Filtered Trials
  const filteredTrials = useMemo(() => {
    if (trialFilter === "today") return trialsEndingSoon.filter((t) => t.daysLeft === 0);
    if (trialFilter === "3days") return trialsEndingSoon.filter((t) => t.daysLeft <= 3);
    if (trialFilter === "7days") return trialsEndingSoon.filter((t) => t.daysLeft <= 7);
    return trialsEndingSoon;
  }, [trialsEndingSoon, trialFilter]);

  if (loading || authLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
        <p className="text-xs font-bold text-slate-500">Loading your platform command center...</p>
      </div>
    );
  }

  const activeSessionsCount = supportSessions.filter((s) => s.status === "ACTIVE").length;

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Command Center", icon: <Layers className="w-4 h-4" /> },
    { id: "people", label: "Accounts", icon: <Users className="w-4 h-4" /> },
    { id: "businesses", label: "Businesses", icon: <Building className="w-4 h-4" /> },
    { id: "products", label: "Products & Stock", icon: <Package className="w-4 h-4" /> },
    { id: "orders", label: "Orders", icon: <ShoppingBag className="w-4 h-4" /> },
    { id: "customers", label: "Customers", icon: <Store className="w-4 h-4" /> },
    { id: "subscriptions", label: "Subscriptions", icon: <CreditCard className="w-4 h-4" /> },
    { id: "channels", label: "Connections", icon: <Share2 className="w-4 h-4" /> },
    { id: "support", label: "Support", icon: <Unlock className="w-4 h-4" /> },
    { id: "security", label: "Security Logs", icon: <ShieldCheck className="w-4 h-4" /> },
    { id: "health", label: "System Health", icon: <HeartPulse className="w-4 h-4" /> },
    { id: "guide", label: "Admin Guide", icon: <BookOpen className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 px-4 sm:px-6 lg:px-8">
      {/* ─── 1. TOP ADMIN CONTROL CENTER HEADER ─── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-extrabold border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                Platform Command Center
              </div>
              {activeSessionsCount > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-extrabold border border-amber-500/30 animate-pulse">
                  <Unlock className="w-3.5 h-3.5" />
                  {activeSessionsCount} Active Support Session(s)
                </div>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">BizPilot Command Center</h1>
            <p className="text-xs text-slate-300">
              Welcome back, <strong>{currentUser?.name}</strong> ({currentUser?.email}) • Everything you need to manage BizPilot in one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab("guide")}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition-all flex items-center gap-1.5"
            >
              <BookOpen className="w-4 h-4 text-purple-300" />
              Show Admin Guide
            </button>
            <button
              onClick={() => setShowSupportModal(true)}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20 transition-all flex items-center gap-1.5"
            >
              <Unlock className="w-4 h-4" />
              Support Access
            </button>
            <button
              onClick={() => setShowSetupModal(true)}
              className="px-3.5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Setup Store
            </button>
            <Link
              href="/settings"
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/20 transition-all"
            >
              Account Settings
            </Link>
            <button
              onClick={() => logout()}
              className="px-3 py-2.5 bg-white/10 hover:bg-rose-500/30 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-white/20 transition-all flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Global Search Everything Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
        <input
          type="text"
          placeholder="🔎 Search businesses, users, orders, or subscriptions..."
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          className="w-full text-xs pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-xs focus:outline-none focus:ring-2 focus:ring-purple-600"
        />
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-700 text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg("")} className="text-rose-700 text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ─── 2. TABBED NAVIGATION ─── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setGlobalSearch("");
              }}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 ${
                isActive
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── 3. TAB CONTENT ─── */}

      {/* TAB 1: COMMAND CENTER (CENTRAL DASHBOARD) */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <AboutPage
            moduleKey="overview"
            icon={<Layers className="w-5 h-5 text-purple-600" />}
            title="Command Center Overview"
            description="Think of this page as your central control room for BizPilot. Here you can see how the platform is doing, check businesses and subscriptions, identify items needing attention, and take quick actions."
            canDoList={[
              "Monitor platform KPIs across users, stores, trials, orders, and system health",
              "Review urgent action items under 'Needs Your Attention'",
              "Track trials ending soon and grant Lifetime Free access with 1 click",
              "Access quick actions and safe system status summaries",
            ]}
            privacyNote="Aggregated platform statistics only. Private customer conversations and secrets are never displayed."
          />

          {/* 3.1 TOP SUMMARY CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("businesses")}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-300 hover:shadow-md transition-all text-left space-y-1"
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Businesses</span>
              <div className="text-xl sm:text-2xl font-black text-slate-900">{stats?.totalBusinesses || 0}</div>
              <span className="text-[10px] text-emerald-600 font-bold block">+{stats?.newBusinessesThisMonth || 0} this month</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("people")}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-sky-300 hover:shadow-md transition-all text-left space-y-1"
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Users</span>
              <div className="text-xl sm:text-2xl font-black text-slate-900">{stats?.activeUsers || 0}</div>
              <span className="text-[10px] text-slate-500 block">{stats?.totalUsers || 0} total accounts</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("subscriptions")}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-300 hover:shadow-md transition-all text-left space-y-1"
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Trials</span>
              <div className="text-xl sm:text-2xl font-black text-amber-700">{stats?.activeTrials || 0}</div>
              <span className="text-[10px] text-slate-500 block">30-day trials</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("subscriptions")}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all text-left space-y-1"
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Paid Plans</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-700">{stats?.paidSubscriptions || 0}</div>
              <span className="text-[10px] text-slate-500 block">Active subs</span>
            </button>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-left space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Platform MRR</span>
              <div className="text-xl sm:text-2xl font-black text-purple-700">₱{(stats?.platformMRR || 0).toLocaleString()}</div>
              <span className="text-[10px] text-slate-500 block">Projected monthly</span>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all text-left space-y-1"
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Orders</span>
              <div className="text-xl sm:text-2xl font-black text-slate-900">{stats?.totalOrders || 0}</div>
              <span className="text-[10px] text-slate-500 block">+{stats?.ordersThisMonth || 0} this month</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("customers")}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-teal-300 hover:shadow-md transition-all text-left space-y-1"
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Customers</span>
              <div className="text-xl sm:text-2xl font-black text-slate-900">{stats?.totalCustomers || 0}</div>
              <span className="text-[10px] text-slate-500 block">Aggregated reach</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("health")}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all text-left space-y-1"
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">System Status</span>
              <div className="text-sm font-black text-emerald-600 flex items-center gap-1.5 pt-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Operational
              </div>
              <span className="text-[10px] text-slate-500 block">All services healthy</span>
            </button>
          </div>

          {/* 3.2 NEEDS YOUR ATTENTION SECTION */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Needs Your Attention
              </h2>
              <span className="text-xs text-slate-400 font-semibold">Real-time alerts</span>
            </div>

            {attentionAlerts.length === 0 ? (
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center gap-3 text-xs text-emerald-900 font-semibold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <strong className="block font-bold">✅ Everything looks good</strong>
                  <p className="text-[11px] text-emerald-700">There are no urgent issues or expired accounts requiring attention right now.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {attentionAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-semibold ${
                      alert.type === "warning"
                        ? "bg-amber-50 border-amber-200 text-amber-900"
                        : alert.type === "alert"
                        ? "bg-rose-50 border-rose-200 text-rose-900"
                        : "bg-sky-50 border-sky-200 text-sky-900"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{alert.title}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab(alert.targetTab as AdminTab)}
                      className="px-3 py-1.5 bg-white rounded-xl shadow-2xs text-xs font-bold text-slate-900 hover:bg-slate-100 self-start sm:self-auto transition-all"
                    >
                      {alert.actionText} →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3.3 QUICK ACTIONS & PLATFORM ACTIVITY */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions Panel */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Quick Actions
              </h2>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowSetupModal(true)}
                  className="p-3 rounded-2xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50/40 transition-all text-left space-y-1 shadow-2xs"
                >
                  <Plus className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold text-slate-900 block">Setup Store</span>
                  <span className="text-[10px] text-slate-500 block">Create new tenant</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("people")}
                  className="p-3 rounded-2xl border border-slate-200 hover:border-sky-400 hover:bg-sky-50/40 transition-all text-left space-y-1 shadow-2xs"
                >
                  <Users className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-bold text-slate-900 block">Manage People</span>
                  <span className="text-[10px] text-slate-500 block">Accounts & roles</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("businesses")}
                  className="p-3 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all text-left space-y-1 shadow-2xs"
                >
                  <Building className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-900 block">Businesses</span>
                  <span className="text-[10px] text-slate-500 block">Manage stores</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("subscriptions")}
                  className="p-3 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all text-left space-y-1 shadow-2xs"
                >
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-900 block">Subscriptions</span>
                  <span className="text-[10px] text-slate-500 block">Plans & trials</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSupportModal(true)}
                  className="p-3 rounded-2xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 transition-all text-left space-y-1 shadow-2xs"
                >
                  <Unlock className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-slate-900 block">Support Store</span>
                  <span className="text-[10px] text-slate-500 block">Temporary access</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("guide")}
                  className="p-3 rounded-2xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50/40 transition-all text-left space-y-1 shadow-2xs"
                >
                  <BookOpen className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold text-slate-900 block">Admin Guide</span>
                  <span className="text-[10px] text-slate-500 block">Help & instructions</span>
                </button>
              </div>

              {/* 🔐 IMPORTANT ACCESS SECTION */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-purple-900 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-purple-600" />
                    Important Access
                  </span>
                  <span className="text-[9px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                    Approval Code Required
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Granting Admin or Lifetime access requires an approval code sent to <strong>bizpilot.mailer@gmail.com</strong>.
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setApprovalAction("GRANT_ADMIN");
                      setApprovalTargetEmail("");
                      setApprovalTargetId("");
                      setShowApprovalModal(true);
                    }}
                    className="p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-left transition-all space-y-0.5 shadow-2xs"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
                    <span className="text-[11px] font-bold block">Grant Admin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setApprovalAction("GRANT_LIFETIME");
                      setApprovalTargetEmail("");
                      setApprovalTargetId("");
                      setShowApprovalModal(true);
                    }}
                    className="p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-left transition-all space-y-0.5 shadow-2xs"
                  >
                    <Gift className="w-3.5 h-3.5 text-amber-700" />
                    <span className="text-[11px] font-bold block">Grant Lifetime</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Platform Activity & Orders Summary */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Platform Activity & Order Health
                </h2>
                <span className="text-xs text-slate-500 font-semibold">Real database orders</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Orders Today</span>
                  <div className="text-xl font-black text-slate-900">{stats?.ordersToday || 0}</div>
                  <span className="text-[10px] text-slate-500 block">Placed today</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-1">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Completed</span>
                  <div className="text-xl font-black text-emerald-900">{orderStatusBreakdown?.completed || 0}</div>
                  <span className="text-[10px] text-emerald-700 block">Delivered / Picked up</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100 space-y-1">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Pending</span>
                  <div className="text-xl font-black text-amber-900">{orderStatusBreakdown?.pending || 0}</div>
                  <span className="text-[10px] text-amber-700 block">Awaiting fulfillment</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-1">
                  <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">Store Revenue</span>
                  <div className="text-lg font-black text-purple-950">₱{(stats?.storeProcessedRevenue || 0).toLocaleString()}</div>
                  <span className="text-[10px] text-purple-700 block">Processed this month</span>
                </div>
              </div>

              {/* Service Health Quick Status */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-700">Services Status:</span>
                <span className="text-emerald-700 font-semibold">● Email (Gmail SMTP)</span>
                <span className="text-emerald-700 font-semibold">● Database (Healthy)</span>
                <span className="text-emerald-700 font-semibold">● AI Engine (Active)</span>
                <button
                  type="button"
                  onClick={() => setActiveTab("health")}
                  className="text-purple-700 font-bold hover:underline"
                >
                  View Details →
                </button>
              </div>
            </div>
          </div>

          {/* 3.4 TRIALS ENDING SOON & SUBSCRIPTIONS BREAKDOWN */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trials Ending Soon */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Gift className="w-4 h-4 text-purple-600" />
                  Trials Ending Soon ({filteredTrials.length})
                </h2>

                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setTrialFilter("all")}
                    className={`px-2 py-0.5 rounded-lg transition-all ${trialFilter === "all" ? "bg-white text-purple-700 shadow-2xs" : "text-slate-600"}`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrialFilter("3days")}
                    className={`px-2 py-0.5 rounded-lg transition-all ${trialFilter === "3days" ? "bg-white text-purple-700 shadow-2xs" : "text-slate-600"}`}
                  >
                    ≤ 3 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrialFilter("7days")}
                    className={`px-2 py-0.5 rounded-lg transition-all ${trialFilter === "7days" ? "bg-white text-purple-700 shadow-2xs" : "text-slate-600"}`}
                  >
                    ≤ 7 Days
                  </button>
                </div>
              </div>

              {filteredTrials.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">No trials matching this filter.</div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {filteredTrials.slice(0, 5).map((t) => (
                    <div key={t.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">{t.name}</span>
                        <span className="text-[11px] text-slate-500 block">Owner: {t.ownerName} • {t.planTier}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          t.daysLeft <= 3 ? "bg-rose-100 text-rose-800 animate-pulse" : "bg-amber-100 text-amber-800"
                        }`}>
                          {t.daysLeft} day{t.daysLeft === 1 ? "" : "s"} left
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const biz = businesses.find((b) => b.id === t.id);
                            if (biz) setSelectedBusiness(biz);
                          }}
                          className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-lg transition-all"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subscriptions Overview Breakdown */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-teal-600" />
                  Subscription Plans Breakdown
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab("subscriptions")}
                  className="text-xs text-purple-700 font-bold hover:underline"
                >
                  Manage Plans →
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Starter (₱499)</span>
                  <div className="text-xl font-black text-slate-900">{stats?.starterCount || 0}</div>
                  <span className="text-[10px] text-slate-500 block">Solo sellers</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-1">
                  <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Business (₱999)</span>
                  <div className="text-xl font-black text-purple-950">{stats?.businessTierCount || 0}</div>
                  <span className="text-[10px] text-purple-700 block">Growing stores</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-1">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Pro (₱1,999)</span>
                  <div className="text-xl font-black text-indigo-950">{stats?.proTierCount || 0}</div>
                  <span className="text-[10px] text-indigo-700 block">High volume & Lifetime</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 text-slate-500">
                <span>Active Trials: <strong className="text-amber-700">{stats?.activeTrials || 0}</strong></span>
                <span>Active Paid: <strong className="text-emerald-700">{stats?.paidSubscriptions || 0}</strong></span>
                <span>Suspended: <strong className="text-slate-700">{stats?.cancelledSubscriptions || 0}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACCOUNTS */}
      {activeTab === "people" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <AboutPage
            moduleKey="people"
            icon={<Users className="w-5 h-5 text-sky-600" />}
            title="Accounts Management"
            description="This is where you manage BizPilot user accounts. You can check account status, subscription, business ownership, and access. You cannot view user passwords."
            canDoList={[
              "View registered user names, emails, roles, and verification status",
              "Grant Administrator access using secure 6-digit approval code verification",
              "Safely manage account access with delete protection for the last admin",
            ]}
            privacyNote="Passwords and authentication secrets are cryptographically hashed and never displayed."
          />

          {/* Dedicated Grant Admin Card in Accounts Module */}
          <div className="p-4 sm:p-5 rounded-3xl bg-purple-50/50 border border-purple-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-2xl bg-purple-100 text-purple-800 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  Grant Admin Access
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    Approval Code Required
                  </span>
                </h3>
                <p className="text-xs text-slate-600">
                  Give another BizPilot account permission to manage the platform. BizPilot sends a 6-digit approval code to the authorized Admin email (<strong>bizpilot.mailer@gmail.com</strong>).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setApprovalAction("GRANT_ADMIN");
                setApprovalTargetEmail("");
                setApprovalTargetId("");
                setShowApprovalModal(true);
              }}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-purple-600/20 transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <ShieldCheck className="w-4 h-4" />
              Grant Admin Access
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-600" />
                  User Accounts ({users.length})
                </h2>
                <p className="text-xs text-slate-500">Manage BizPilot user accounts and administrator permissions.</p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {users
                .filter((u) => !globalSearch || u.name.toLowerCase().includes(globalSearch.toLowerCase()) || u.email.toLowerCase().includes(globalSearch.toLowerCase()))
                .map((u) => (
                  <div key={u.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{u.name}</span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          u.role === "ADMIN" ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-700"
                        }`}>
                          {u.role === "ADMIN" ? "Administrator" : "Business Owner"}
                        </span>
                        {u.emailVerified ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            Verified ✓
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                            Unverified
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{u.email}</p>
                      {u.business && (
                        <p className="text-[11px] text-purple-700 font-semibold">
                          Store: {u.business.name} ({u.business.planTier})
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {u.role === "OWNER" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setApprovalAction("GRANT_ADMIN");
                            setApprovalTargetEmail(u.email);
                            setApprovalTargetId(u.id);
                            setShowApprovalModal(true);
                          }}
                          className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all"
                        >
                          Make Admin
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setApprovalAction("REVOKE_ADMIN");
                            setApprovalTargetEmail(u.email);
                            setApprovalTargetId(u.id);
                            setShowApprovalModal(true);
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                        >
                          Make Owner
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setApprovalAction("DELETE_USER");
                          setApprovalTargetEmail(u.email);
                          setApprovalTargetId(u.id);
                          setShowApprovalModal(true);
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BUSINESSES */}
      {activeTab === "businesses" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <AboutPage
            moduleKey="businesses"
            icon={<Building className="w-5 h-5 text-indigo-600" />}
            title="Businesses on Platform"
            description="This is where you manage businesses using BizPilot. You can check their plan, trial status, and overall activity without reading their private customer conversations."
            canDoList={[
              "View business name, owner, plan tier, and creation date",
              "Grant Lifetime Access (PRO) using secure 6-digit approval code verification",
              "Update subscription plans and trial periods",
              "Request temporary Support Access when an owner needs assistance",
            ]}
            privacyNote="Store customer chats and private notes are private to the business owner."
          />

          {/* Dedicated Grant Lifetime Access Card in Businesses Module */}
          <div className="p-4 sm:p-5 rounded-3xl bg-amber-50/50 border border-amber-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-800 shrink-0">
                <Gift className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  Grant Lifetime Access
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Approval Code Required
                  </span>
                </h3>
                <p className="text-xs text-slate-600">
                  Give a business permanent PRO access without recurring renewals. BizPilot sends a 6-digit approval code to the authorized Admin email (<strong>bizpilot.mailer@gmail.com</strong>).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setApprovalAction("GRANT_LIFETIME");
                setApprovalTargetEmail("");
                setApprovalTargetId("");
                setShowApprovalModal(true);
              }}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-amber-600/20 transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <Gift className="w-4 h-4" />
              Grant Lifetime Access
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-600" />
                Stores on Platform ({businesses.length})
              </h2>
              <p className="text-xs text-slate-500">Click any store to open its summary drawer or manage its plan.</p>
            </div>

            <div className="divide-y divide-slate-100">
              {businesses
                .filter((b) => !globalSearch || b.name.toLowerCase().includes(globalSearch.toLowerCase()) || b.ownerName.toLowerCase().includes(globalSearch.toLowerCase()))
                .map((biz) => {
                  const isLifetime = biz.isLifetimeFree || biz.subscriptionStatus === "LIFETIME" || (biz.subscriptionStatus === "ACTIVE" && !biz.trialEndsAt && biz.planTier === "PRO");
                  const isUpdating = updatingId === biz.id;

                  return (
                    <div key={biz.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                      <div className="space-y-1.5 cursor-pointer" onClick={() => setSelectedBusiness(biz)}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-slate-900 hover:text-purple-700">{biz.name}</span>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                            Current Access: {biz.planTier}
                          </span>
                          {isLifetime ? (
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-purple-600 text-white shadow-xs">
                              ✨ Lifetime Free (PRO)
                            </span>
                          ) : biz.subscriptionStatus === "ACTIVE" ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              ● Active Paid
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                              30-Day Trial
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-500">
                          Owner: <strong>{biz.ownerName}</strong> ({biz.email || "No email"}) • Registered: {new Date(biz.createdAt).toLocaleDateString()}
                        </p>

                        <div className="flex items-center gap-3 text-xs text-slate-600 pt-0.5">
                          <span>📦 {biz._count.products} Products</span>
                          <span>🛒 {biz._count.orders} Orders</span>
                          <span>👥 {biz._count.customers} Customers</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
                        <button
                          type="button"
                          onClick={() => setSelectedBusiness(biz)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all"
                        >
                          Quick View
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSupportBizId(biz.id);
                            setShowSupportModal(true);
                          }}
                          className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          Support
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setApprovalAction("CHANGE_PLAN");
                            setApprovalTargetEmail(biz.email || "");
                            setApprovalTargetId(biz.id);
                            setApprovalMetadata({
                              currentPlan: biz.planTier,
                              currentStatus: biz.subscriptionStatus,
                              requestedPlan: biz.planTier === "STARTER" ? "BUSINESS" : "PRO",
                              businessName: biz.name,
                            });
                            setShowApprovalModal(true);
                          }}
                          className="px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                          <CreditCard className="w-3.5 h-3.5 text-teal-600" />
                          Change Plan
                        </button>

                        {!isLifetime ? (
                          <button
                            type="button"
                            onClick={() => {
                              setApprovalAction("GRANT_LIFETIME");
                              setApprovalTargetEmail(biz.email || "");
                              setApprovalTargetId(biz.id);
                              setApprovalMetadata({
                                currentPlan: biz.planTier,
                                currentStatus: biz.subscriptionStatus,
                                businessName: biz.name,
                              });
                              setShowApprovalModal(true);
                            }}
                            className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                          >
                            <Gift className="w-3.5 h-3.5 text-amber-300" />
                            Grant Lifetime Access
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setApprovalAction("REVOKE_LIFETIME");
                              setApprovalTargetEmail(biz.email || "");
                              setApprovalTargetId(biz.id);
                              setApprovalMetadata({
                                currentPlan: biz.planTier,
                                currentStatus: biz.subscriptionStatus,
                                businessName: biz.name,
                              });
                              setShowApprovalModal(true);
                            }}
                            className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                          >
                            Revoke Lifetime
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setApprovalAction("DELETE_BUSINESS");
                            setApprovalTargetEmail(biz.email || "");
                            setApprovalTargetId(biz.id);
                            setShowApprovalModal(true);
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          title="Delete Business"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PRODUCTS & STOCK */}
      {activeTab === "products" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <AboutPage
            moduleKey="products"
            icon={<Package className="w-5 h-5 text-amber-600" />}
            title="Products & Inventory Health (View-Only)"
            subtitle="Platform Catalog Health"
            description="This gives you a view-only overview of products and stock health across BizPilot. Product listings, pricing, and stock control belong entirely to the store owner."
            canDoList={[
              "Review catalog listings, prices, and stock levels across stores",
              "Monitor low-stock indicators across the platform",
            ]}
            privacyNote="Business owners have full ownership and control over their products and inventory. Administrators cannot alter stock or product details."
          />

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-amber-600" />
                  Product & Stock Health ({products.length})
                </h2>
                <p className="text-xs text-slate-500">View catalog listings across stores. Product and stock control belongs entirely to the store owner.</p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {products
                .filter((p) => !globalSearch || p.name.toLowerCase().includes(globalSearch.toLowerCase()) || p.sku?.toLowerCase().includes(globalSearch.toLowerCase()))
                .map((p) => (
                  <div key={p.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{p.name}</span>
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {p.sku || "NO-SKU"}
                        </span>
                        {p.stockQuantity <= (p.lowStockThreshold || 2) && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                            Low Stock
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        Store: <strong>{p.business?.name}</strong> • Category: {p.category || "General"}
                      </p>
                      <p className="text-xs font-bold text-slate-900">
                        ₱{p.price?.toLocaleString("en-PH")} • In Stock: <span className="text-purple-700">{p.stockQuantity} units</span>
                      </p>
                    </div>

                    <div className="self-start sm:self-auto">
                      <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-slate-400" />
                        Owner Managed
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ORDERS */}
      {activeTab === "orders" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <AboutPage
            moduleKey="orders"
            icon={<ShoppingBag className="w-5 h-5 text-emerald-600" />}
            title="Orders Activity"
            description="This lets you monitor order activity across BizPilot. You can check order status and payment status when helping resolve an account problem."
            canDoList={[
              "Review order numbers, amounts, and fulfillment methods",
              "Check payment reconciliation status without viewing private chat negotiations",
            ]}
            privacyNote="Customer names, phone numbers, and addresses are masked by default unless an active Support Session is open."
          />

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-600" />
                  Customer Orders ({orders.length})
                </h2>
                <p className="text-xs text-slate-500">Review business order activity. Customer private information is masked for privacy.</p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {orders
                .filter((o) => !globalSearch || o.orderNumber.toLowerCase().includes(globalSearch.toLowerCase()) || o.business?.name.toLowerCase().includes(globalSearch.toLowerCase()))
                .map((o) => (
                  <div key={o.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black text-slate-900">{o.orderNumber}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {o.status}
                        </span>
                        {o.hasSupportAccess ? (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Unlock className="w-2.5 h-2.5" /> Support Unmasked
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Privacy Protected
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600">
                        Store: <strong>{o.business?.name}</strong> • Customer: <strong>{o.customer?.name}</strong> ({o.customer?.phone})
                      </p>

                      <p className="text-xs text-slate-500">
                        Method: {o.fulfillmentMethod} • Total: <strong className="text-slate-900">₱{o.totalAmount?.toLocaleString("en-PH")}</strong> • Date: {new Date(o.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: CUSTOMERS */}
      {activeTab === "customers" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <AboutPage
            moduleKey="customers"
            icon={<Store className="w-5 h-5 text-teal-600" />}
            title="Customer Activity Summary"
            description="This gives you a limited view of customer activity. Only information needed to support the BizPilot platform is shown. Private customer information is protected."
            canDoList={[
              "Review aggregate customer counts across stores",
              "Check customer platforms (Facebook, Instagram, WhatsApp, TikTok)",
            ]}
            privacyNote="Customer full names, phone numbers, and emails are masked by default."
          />

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Store className="w-5 h-5 text-teal-600" />
                Customer Directory ({customers.length})
              </h2>
              <p className="text-xs text-slate-500">Customer records across stores with privacy masking.</p>
            </div>

            <div className="divide-y divide-slate-100">
              {customers
                .filter((c) => !globalSearch || c.name.toLowerCase().includes(globalSearch.toLowerCase()) || c.business?.name.toLowerCase().includes(globalSearch.toLowerCase()))
                .map((c) => (
                  <div key={c.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{c.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {c.primaryPlatform}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Store: <strong>{c.business?.name}</strong> • Phone: {c.phone} • LTV: ₱{c.lifetimeValue?.toLocaleString("en-PH")}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: PLANS & SUBSCRIPTIONS */}
      {activeTab === "subscriptions" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <AboutPage
            moduleKey="subscriptions"
            icon={<CreditCard className="w-5 h-5 text-teal-600" />}
            title="Plans & Subscriptions"
            description="This is where you manage plans and trial periods. You can see which plan a business is using, when its trial ends, and whether its subscription is active."
            canDoList={[
              "Monitor Starter, Business, and Pro tier distribution",
              "Track trial expiration dates and active memberships",
            ]}
            privacyNote="Subscription management never accesses private business chats."
          />

          {/* Dedicated Grant Lifetime Access Card in Subscriptions Module */}
          <div className="p-4 sm:p-5 rounded-3xl bg-amber-50/50 border border-amber-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-800 shrink-0">
                <Gift className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  Grant Lifetime Access
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Approval Code Required
                  </span>
                </h3>
                <p className="text-xs text-slate-600">
                  Give a business permanent PRO access without recurring renewals. BizPilot sends a 6-digit approval code to the authorized Admin email (<strong>bizpilot.mailer@gmail.com</strong>).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setApprovalAction("GRANT_LIFETIME");
                setApprovalTargetEmail("");
                setApprovalTargetId("");
                setShowApprovalModal(true);
              }}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-amber-600/20 transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <Gift className="w-4 h-4" />
              Grant Lifetime Access
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-teal-600" />
                Plans & Subscriptions
              </h2>
              <p className="text-xs text-slate-500">Manage trials and plan subscriptions across BizPilot stores.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Starter Tier (₱499/mo)</span>
                <div className="text-2xl font-black text-slate-900">
                  {businesses.filter((b) => b.planTier === "STARTER").length} Stores
                </div>
                <p className="text-[11px] text-slate-500">For solo online sellers getting started.</p>
              </div>

              <div className="p-5 rounded-2xl border border-purple-200 bg-purple-50/50 space-y-2">
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block">Business Tier (₱999/mo)</span>
                <div className="text-2xl font-black text-purple-950">
                  {businesses.filter((b) => b.planTier === "BUSINESS").length} Stores
                </div>
                <p className="text-[11px] text-purple-700">For growing sellers with regular orders.</p>
              </div>

              <div className="p-5 rounded-2xl border border-indigo-200 bg-indigo-50/50 space-y-2">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block">Pro Tier (₱1,999/mo)</span>
                <div className="text-2xl font-black text-indigo-950">
                  {businesses.filter((b) => b.planTier === "PRO").length} Stores
                </div>
                <p className="text-[11px] text-indigo-700">For established sellers & Lifetime Free members.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: CONNECTED CHANNELS */}
      {activeTab === "channels" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <AboutPage
            moduleKey="channels"
            icon={<Share2 className="w-5 h-5 text-pink-600" />}
            title="Communication Channels"
            description="This shows whether Facebook, Instagram, WhatsApp, and other customer communication channels are connected correctly. You can check connection health without seeing private access credentials."
            canDoList={[
              "Check platform connection health across stores (Facebook, Instagram, WhatsApp, TikTok)",
              "View safe messaging activity summaries (counts of conversations and delivery health)",
            ]}
            privacyNote="OAuth tokens, access secrets, and private customer chats are never exposed."
          />

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-pink-600" />
                Connected Messaging Channels ({channels.length})
              </h2>
              <p className="text-xs text-slate-500">Check which customer platforms are connected (sensitive credentials and private messages are hidden).</p>
            </div>

            {channelSummary && (
              <div className="p-5 border-b border-slate-100 bg-purple-50/30 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-2xl bg-white border border-purple-100 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Total Customer Inquiries Logged</span>
                  <div className="text-xl font-black text-slate-900">{channelSummary.totalConversations} Inquiries</div>
                  <span className="text-[10px] text-slate-500">Delivery Status: Operational</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-purple-100 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Total Platform Messages</span>
                  <div className="text-xl font-black text-slate-900">{channelSummary.totalMessagesLogged} Messages</div>
                  <span className="text-[10px] text-slate-500">Private content stays with owner</span>
                </div>
              </div>
            )}

            <div className="divide-y divide-slate-100">
              {channels.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No active external channel connections.</div>
              ) : (
                channels.map((ch) => (
                  <div key={ch.id} className="p-4 sm:p-5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{ch.platform}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {ch.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Store: <strong>{ch.business?.name}</strong> • Account: {ch.platformAccountName}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: SUPPORT CENTER */}
      {activeTab === "support" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <AboutPage
            moduleKey="support"
            icon={<Unlock className="w-5 h-5 text-amber-600" />}
            title="Support Center"
            description="This is where you can start a temporary, time-bound Support Access session to help a business owner resolve a problem without unnecessarily viewing their private information."
            canDoList={[
              "Start a time-bound (15-60 min) support session with an explicit reason",
              "Temporarily unmask order and stock details for troubleshooting",
              "End support access early when the issue is resolved",
            ]}
            privacyNote="All support sessions automatically expire and create an immutable audit record."
          />

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Unlock className="w-5 h-5 text-amber-600" />
                  Support Center
                </h2>
                <p className="text-xs text-slate-500">
                  Temporary, time-bound access to help store owners resolve specific technical or order issues.
                </p>
              </div>

              <button
                onClick={() => setShowSupportModal(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                New Support Session
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Active & Recent Support Sessions</h3>

              {supportSessions.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500 space-y-1">
                  <p className="font-bold text-slate-700">No active support sessions.</p>
                  <p>Private business data remains securely masked.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                  {supportSessions.map((s) => {
                    const isActive = s.status === "ACTIVE";
                    return (
                      <div key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              Store: {s.business?.name || "Business"}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isActive ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                            }`}>
                              {s.status}
                            </span>
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                              Scope: {s.scope}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">
                            Reason: <em>&quot;{s.reason}&quot;</em>
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Expires: {new Date(s.expiresAt).toLocaleTimeString()} ({s.durationMinutes} mins)
                          </p>
                        </div>

                        {isActive && (
                          <button
                            type="button"
                            onClick={() => handleRevokeSupportSession(s.id)}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all self-start sm:self-auto"
                          >
                            End Access Early
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 10: SECURITY & ACTIVITY */}
      {activeTab === "security" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <AboutPage
            moduleKey="security"
            icon={<ShieldCheck className="w-5 h-5 text-slate-600" />}
            title="Security & Activity Logs"
            description="This shows actions performed by BizPilot administrators. It helps you understand who changed important platform settings. Business-owner activity is kept separate."
            canDoList={[
              "Review administrator security activity (role changes, plan adjustments, support sessions)",
              "Inspect platform system events (email delivery, reminders)",
            ]}
            privacyNote="Store-owner day-to-day operations are strictly separated from administrator security logs."
          />

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-slate-600" />
                  Security & Activity Logs
                </h2>
                <p className="text-xs text-slate-500">Separated audit records. Administrator actions vs System operational logs.</p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setLogViewType("ADMIN")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    logViewType === "ADMIN" ? "bg-white text-purple-700 shadow-2xs" : "text-slate-600"
                  }`}
                >
                  Admin Activity ({adminLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLogViewType("SYSTEM")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    logViewType === "SYSTEM" ? "bg-white text-purple-700 shadow-2xs" : "text-slate-600"
                  }`}
                >
                  System Events ({systemLogs.length})
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {(logViewType === "ADMIN" ? adminLogs : systemLogs).length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No {logViewType.toLowerCase()} activity logs recorded yet.</div>
              ) : (
                (logViewType === "ADMIN" ? adminLogs : systemLogs).map((log) => (
                  <div key={log.id} className="p-4 sm:p-5 space-y-1 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-purple-700">{log.action}</span>
                      <span className="text-[10px] text-slate-400">• {new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-slate-700">{log.details}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 11: SYSTEM HEALTH */}
      {activeTab === "health" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <AboutPage
            moduleKey="health"
            icon={<HeartPulse className="w-5 h-5 text-emerald-600" />}
            title="System Health"
            description="This helps you check whether important BizPilot services are working. You can quickly see whether email, AI, database, and other platform services are healthy."
            canDoList={[
              "Check application status and database latency",
              "Verify transactional email delivery configuration",
              "Check AI engine status",
            ]}
            privacyNote="No raw secret keys or credentials are leaked in system health reports."
          />

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-emerald-600" />
                System Status
              </h2>
              <p className="text-xs text-slate-500">Check whether essential BizPilot services are working properly.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Application</span>
                <span className="text-sm font-extrabold text-emerald-600 block">● {health?.application || "HEALTHY"}</span>
                <span className="text-[10px] text-slate-500 block">Environment: {health?.environment}</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Database</span>
                <span className="text-sm font-extrabold text-emerald-600 block">● {health?.database?.status || "HEALTHY"}</span>
                <span className="text-[10px] text-slate-500 block">Latency: {health?.database?.latencyMs ?? 1}ms</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Transactional Email</span>
                <span className="text-sm font-extrabold text-slate-800 block">{health?.services?.smtpEmail}</span>
                <span className="text-[10px] text-slate-500 block">Sender: bizpilot.mailer@gmail.com</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">AI Engine</span>
                <span className="text-sm font-extrabold text-slate-800 block">{health?.services?.geminiAi}</span>
                <span className="text-[10px] text-slate-500 block">Status: Active</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Node.js Runtime</span>
                <span className="text-sm font-bold text-slate-800 block">{health?.metrics?.nodeVersion || process.version}</span>
                <span className="text-[10px] text-slate-500 block">Uptime: {Math.floor((health?.metrics?.uptimeSeconds || 60) / 60)} minutes</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 12: ADMIN GUIDE */}
      {activeTab === "guide" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6 animate-in fade-in duration-150">
          <div className="border-b border-slate-100 pb-4 space-y-1">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-600" />
              Administrator Guide & FAQ
            </h2>
            <p className="text-xs text-slate-500">
              Plain-language instructions for managing BizPilot while strictly protecting business owner privacy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-black text-slate-900 text-sm">1. What is the Admin Command Center?</h3>
              <p className="leading-relaxed text-slate-600">
                Think of the Admin Command Center as the central control room. You can monitor business health, track ending trials, manage subscriptions, and assist business owners when they ask for help.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-black text-slate-900 text-sm">2. What Information is Protected?</h3>
              <p className="leading-relaxed text-slate-600">
                Customer conversations, Messenger/Instagram DMs, customer addresses, phone numbers, and private owner notes are private to the store owner.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-black text-slate-900 text-sm">3. When should I use Support Access?</h3>
              <p className="leading-relaxed text-slate-600">
                Only use <strong>Support Access</strong> when a store owner explicitly reports a problem (such as an order discrepancy). Support sessions automatically expire after 30 minutes.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-black text-slate-900 text-sm">4. How do I give Free Lifetime Access?</h3>
              <p className="leading-relaxed text-slate-600">
                Find the business on the <strong>Businesses</strong> tab and click <strong>&quot;🎁 Grant Lifetime Free (PRO)&quot;</strong>. It upgrades their store to Pro with no expiration.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Business Quick View Drawer / Modal */}
      {selectedBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900">{selectedBusiness.name}</h3>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    {selectedBusiness.planTier} Plan
                  </span>
                </div>
                <p className="text-xs text-slate-500">Store Quick Overview</p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBusiness(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Owner Name</span>
                <span className="font-bold text-slate-900 block">{selectedBusiness.ownerName}</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Account Status</span>
                <span className="font-bold text-emerald-700 block">● {selectedBusiness.subscriptionStatus}</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Products Listed</span>
                <span className="font-bold text-slate-900 block">{selectedBusiness._count?.products || 0} Products</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Orders Processed</span>
                <span className="font-bold text-slate-900 block">{selectedBusiness._count?.orders || 0} Orders</span>
              </div>
            </div>

            {/* Privacy Notice */}
            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2">
              <Lock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                <strong>Privacy Protected:</strong> Private customer conversations, negotiation notes, and customer addresses are not displayed in the admin overview.
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSupportBizId(selectedBusiness.id);
                  setSelectedBusiness(null);
                  setShowSupportModal(true);
                }}
                className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Unlock className="w-3.5 h-3.5" />
                Support Store
              </button>

              <button
                type="button"
                onClick={() => {
                  const bizId = selectedBusiness.id;
                  const bizEmail = selectedBusiness.email || "";
                  setSelectedBusiness(null);
                  setApprovalAction("CHANGE_PLAN");
                  setApprovalTargetEmail(bizEmail);
                  setApprovalTargetId(bizId);
                  setApprovalMetadata({
                    currentPlan: selectedBusiness.planTier,
                    currentStatus: selectedBusiness.subscriptionStatus,
                    requestedPlan: selectedBusiness.planTier === "STARTER" ? "BUSINESS" : "PRO",
                    businessName: selectedBusiness.name,
                  });
                  setShowApprovalModal(true);
                }}
                className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5 text-teal-600" />
                Change Plan
              </button>

              {selectedBusiness.isLifetimeFree || selectedBusiness.subscriptionStatus === "LIFETIME" ? (
                <button
                  type="button"
                  onClick={() => {
                    const bizId = selectedBusiness.id;
                    const bizEmail = selectedBusiness.email || "";
                    setSelectedBusiness(null);
                    setApprovalAction("REVOKE_LIFETIME");
                    setApprovalTargetEmail(bizEmail);
                    setApprovalTargetId(bizId);
                    setApprovalMetadata({
                      currentPlan: selectedBusiness.planTier,
                      currentStatus: selectedBusiness.subscriptionStatus,
                      businessName: selectedBusiness.name,
                    });
                    setShowApprovalModal(true);
                  }}
                  className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Revoke Lifetime Access
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const bizId = selectedBusiness.id;
                    const bizEmail = selectedBusiness.email || "";
                    setSelectedBusiness(null);
                    setApprovalAction("GRANT_LIFETIME");
                    setApprovalTargetEmail(bizEmail);
                    setApprovalTargetId(bizId);
                    setApprovalMetadata({
                      currentPlan: selectedBusiness.planTier,
                      currentStatus: selectedBusiness.subscriptionStatus,
                      businessName: selectedBusiness.name,
                    });
                    setShowApprovalModal(true);
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Gift className="w-3.5 h-3.5 text-amber-300" />
                  Grant Lifetime Access
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Support Access Request Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Unlock className="w-4 h-4 text-amber-600" />
                Request Temporary Support Access
              </h3>
              <p className="text-xs text-slate-500">
                Temporarily unmasks order and product information for troubleshooting. Access automatically expires.
              </p>
            </div>

            <form onSubmit={handleStartSupportSession} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select Store *</label>
                <select
                  required
                  value={supportBizId}
                  onChange={(e) => setSupportBizId(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                >
                  <option value="">-- Choose a store --</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.ownerName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Reason for Access *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Owner requested help verifying order ORD-2026-001"
                  value={supportReason}
                  onChange={(e) => setSupportReason(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Scope</label>
                  <select
                    value={supportScope}
                    onChange={(e) => setSupportScope(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                  >
                    <option value="ORDERS">Orders only</option>
                    <option value="PRODUCTS">Products only</option>
                    <option value="GENERAL_TROUBLESHOOTING">General Support</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Duration</label>
                  <select
                    value={supportDuration}
                    onChange={(e) => setSupportDuration(Number(e.target.value))}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSupportModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={startingSupport || !supportBizId || !supportReason.trim()}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20"
                >
                  {startingSupport ? "Starting..." : "Start Support Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Store Setup Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">Configure Store Profile</h3>
              <p className="text-xs text-slate-500">Enter the business and owner details for the new store.</p>
            </div>

            <form onSubmit={handleCreateBusiness} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Manila Tech Supplies"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Owner Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mark Santos"
                    value={bizOwner}
                    onChange={(e) => setBizOwner(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Owner Email</label>
                  <input
                    type="email"
                    placeholder="owner@store.ph"
                    value={bizEmail}
                    onChange={(e) => setBizEmail(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Contact Phone</label>
                <input
                  type="text"
                  placeholder="+63 917 123 4567"
                  value={bizPhone}
                  onChange={(e) => setBizPhone(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Fulfillment Location Note</label>
                <input
                  type="text"
                  placeholder="Online Hub, Metro Manila (No Retail Storefront)"
                  value={bizAddress}
                  onChange={(e) => setBizAddress(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSetupModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingBiz || !bizName.trim() || !bizOwner.trim()}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20"
                >
                  {creatingBiz ? "Configuring..." : "Create Store"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Secure Admin & Lifetime Access Approval Modal (OTP Protected) */}
      <AdminApprovalModal
        isOpen={showApprovalModal}
        initialAction={approvalAction}
        initialTargetEmail={approvalTargetEmail}
        initialTargetId={approvalTargetId}
        initialMetadata={approvalMetadata}
        onClose={() => setShowApprovalModal(false)}
        onSuccess={(msg) => {
          setSuccessMsg(`✓ ${msg}`);
          loadData();
        }}
      />
    </div>
  );
}
