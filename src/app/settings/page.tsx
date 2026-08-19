"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  User,
  Store,
  ShieldCheck,
  Bell,
  MessageSquare,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Save,
  RefreshCw,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  LogOut,
  ExternalLink,
  HelpCircle,
  Lock,
  Mail,
  Phone,
  Tag,
  MapPin,
  Sparkles,
  Package,
  ShoppingBag,
  Users,
  Clock,
  ArrowRight,
  X,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Info,
  Radio,
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { EmailChangeModal } from "@/components/EmailChangeModal";

type SettingsTab =
  | "account"
  | "business"
  | "security"
  | "notifications"
  | "communication"
  | "subscription"
  | "channels"
  | "danger";

interface SettingsData {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    businessId: string | null;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
  };
  business: {
    id: string;
    name: string;
    ownerName: string;
    email: string | null;
    contactNumber: string | null;
    address: string | null;
    currency: string;
    timezone: string;
    subscriptionStatus: string;
    isLifetimeFree?: boolean;
    planTier: string;
    trialEndsAt: string | null;
    createdAt: string;
    updatedAt: string;
    settings: {
      description: string;
      category: string;
      businessType: string;
      logoUrl: string | null;
      fulfillmentMethods: string[];
      acceptedPaymentMethods: string[];
      notifications: {
        customerMessages: boolean;
        newOrders: boolean;
        paymentUpdates: boolean;
        orderStatus: boolean;
        lowStock: boolean;
        trialReminders: boolean;
        subscription: boolean;
        securityAlerts: boolean;
      };
      communication: {
        facebook: boolean;
        instagram: boolean;
        whatsapp: boolean;
        tiktok: boolean;
      };
      pendingEmailChange?: {
        newEmail: string;
        expiresAt: string;
      } | null;
    };
  } | null;
  plan: {
    id: string;
    name: string;
    price: number;
    limits: {
      maxProducts: number | null;
      maxOrdersPerMonth: number | null;
      maxStaffAccounts: number;
      maxConnectedChannels?: number | null;
    };
    features: {
      aiAssistant: string;
      multiCourier: boolean;
      staffAccounts: boolean;
      advancedReporting: boolean;
      apiAccess: boolean;
    };
  };
  usage: {
    productCount: number;
    maxProducts: number | null;
    monthlyOrderCount: number;
    maxMonthlyOrders: number | null;
    staffCount: number;
    maxStaffAccounts: number;
    connectedChannelsCount?: number;
    maxConnectedChannels?: number | null;
    remainingChannelSlots?: number | null;
    canConnectAnotherChannel?: boolean;
  };
  sessions: {
    totalActive: number;
  };
}

const CATEGORIES = [
  "Electronics & Gadgets",
  "Fashion & Apparel",
  "Food & Beverage",
  "Health & Beauty",
  "Home & Living",
  "Sports & Outdoor",
  "Automotive & Hardware",
  "General Retail & Others",
];

const FULFILLMENT_OPTIONS = [
  { id: "MEETUP", label: "Customer Meetup", desc: "Meet the customer at an agreed public location." },
  { id: "LBC", label: "LBC Shipping", desc: "Send orders nationwide through LBC." },
  { id: "GRAB", label: "Grab Express", desc: "Book a rider to deliver the order." },
  { id: "LALAMOVE", label: "Lalamove", desc: "Use Lalamove for on-demand delivery." },
  { id: "DELIVERY", label: "Direct Delivery", desc: "In-house rider or personal delivery." },
];

const PAYMENT_OPTIONS = [
  { id: "GCASH", label: "GCash", desc: "Direct e-wallet QR or mobile number transfer" },
  { id: "MAYA", label: "Maya", desc: "Maya e-wallet or card payment transfer" },
  { id: "BANK_TRANSFER", label: "Bank Transfer", desc: "BDO, BPI, UnionBank, or other bank transfers" },
  { id: "CASH", label: "Cash", desc: "Direct cash settlement on meetup or pickup" },
  { id: "COD", label: "Cash on Delivery (COD)", desc: "Payment collected by courier upon delivery" },
];

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: currentUser, isLoading: authLoading, isAuthenticated, logout, refreshAuth } = useAuth();

  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Collapsible Help States per section
  const [showSectionHelp, setShowSectionHelp] = useState<Record<string, boolean>>({
    intro: false,
    account: false,
    business: false,
    security: false,
    notifications: false,
    communication: false,
    subscription: false,
    danger: false,
  });

  const toggleSectionHelp = (section: string) => {
    setShowSectionHelp((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Form State: Account
  const [accountName, setAccountName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPhone, setAccountPhone] = useState("");

  // Form State: Business Profile
  const [bizName, setBizName] = useState("");
  const [bizDesc, setBizDesc] = useState("");
  const [bizCategory, setBizCategory] = useState("Electronics & Gadgets");
  const [bizType, setBizType] = useState("ONLINE_ONLY");
  const [bizPhone, setBizPhone] = useState("");
  const [bizEmail, setBizEmail] = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [bizLogoUrl, setBizLogoUrl] = useState<string | null>(null);
  const [bizFulfillment, setBizFulfillment] = useState<string[]>([]);
  const [bizPayments, setBizPayments] = useState<string[]>([]);

  // Form State: Security / Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Form State: Notifications
  const [notifCustomerMsgs, setNotifCustomerMsgs] = useState(true);
  const [notifNewOrders, setNotifNewOrders] = useState(true);
  const [notifPaymentUpdates, setNotifPaymentUpdates] = useState(true);
  const [notifOrderStatus, setNotifOrderStatus] = useState(true);
  const [notifLowStock, setNotifLowStock] = useState(true);

  // Form State: Communication
  const [commFacebook, setCommFacebook] = useState(true);
  const [commInstagram, setCommInstagram] = useState(true);
  const [commWhatsapp, setCommWhatsapp] = useState(true);
  const [commTiktok, setCommTiktok] = useState(false);

  // Logo Upload State
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Account Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Email Change Modal State (2-Step Verification)
  const [showEmailChangeModal, setShowEmailChangeModal] = useState(false);

  // Unsaved Changes Tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Protect route
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login?returnTo=/settings");
    }
  }, [authLoading, isAuthenticated, router]);

  // Load settings data
  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings");
      if (res.status === 401) {
        router.replace("/login?returnTo=/settings");
        return;
      }

      const json = await res.json();
      if (res.ok && json.status === "success") {
        setData(json);
        populateForm(json);
      } else {
        setFeedback({ type: "error", message: json.error || "We couldn't load your settings. Please try again." });
      }
    } catch {
      setFeedback({ type: "error", message: "We couldn't connect to the server. Please check your internet." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadSettings();
    }
  }, [isAuthenticated]);

  // Check URL params for verification status
  useEffect(() => {
    const emailUpdated = searchParams.get("emailUpdated");
    const errorParam = searchParams.get("error");

    if (emailUpdated === "true") {
      setFeedback({ type: "success", message: "✓ Your new email address has been verified and updated." });
    } else if (errorParam === "invalid_token" || errorParam === "expired_token") {
      setFeedback({ type: "error", message: "The email verification link is invalid or has expired." });
    } else if (errorParam === "email_taken") {
      setFeedback({ type: "error", message: "That email address is already in use by another account." });
    }
  }, [searchParams]);

  const populateForm = (loadedData: SettingsData) => {
    // Account
    setAccountName(loadedData.user.name || "");
    setAccountEmail(loadedData.user.email || "");
    setAccountPhone(loadedData.business?.contactNumber || "");

    // Business
    if (loadedData.business) {
      setBizName(loadedData.business.name || "");
      setBizDesc(loadedData.business.settings.description || "");
      setBizCategory(loadedData.business.settings.category || "Electronics & Gadgets");
      setBizType(loadedData.business.settings.businessType || "ONLINE_ONLY");
      setBizPhone(loadedData.business.contactNumber || "");
      setBizEmail(loadedData.business.email || "");
      setBizAddress(loadedData.business.address || "");
      setBizLogoUrl(loadedData.business.settings.logoUrl || null);
      setBizFulfillment(loadedData.business.settings.fulfillmentMethods || ["MEETUP", "LBC", "GRAB"]);
      setBizPayments(loadedData.business.settings.acceptedPaymentMethods || ["GCASH", "MAYA", "BANK_TRANSFER"]);

      // Notifications
      const notifs = loadedData.business.settings.notifications;
      setNotifCustomerMsgs(notifs?.customerMessages ?? true);
      setNotifNewOrders(notifs?.newOrders ?? true);
      setNotifPaymentUpdates(notifs?.paymentUpdates ?? true);
      setNotifOrderStatus(notifs?.orderStatus ?? true);
      setNotifLowStock(notifs?.lowStock ?? true);

      // Communication
      const comms = loadedData.business.settings.communication;
      setCommFacebook(comms?.facebook ?? true);
      setCommInstagram(comms?.instagram ?? true);
      setCommWhatsapp(comms?.whatsapp ?? true);
      setCommTiktok(comms?.tiktok ?? false);
    }

    setHasUnsavedChanges(false);
  };

  // Check unsaved changes
  useEffect(() => {
    if (!data) return;

    let modified = false;

    if (activeTab === "account") {
      modified =
        accountName !== data.user.name ||
        accountEmail !== data.user.email ||
        accountPhone !== (data.business?.contactNumber || "");
    } else if (activeTab === "business") {
      modified =
        bizName !== (data.business?.name || "") ||
        bizDesc !== (data.business?.settings.description || "") ||
        bizCategory !== (data.business?.settings.category || "Electronics & Gadgets") ||
        bizType !== (data.business?.settings.businessType || "ONLINE_ONLY") ||
        bizPhone !== (data.business?.contactNumber || "") ||
        bizEmail !== (data.business?.email || "") ||
        bizAddress !== (data.business?.address || "") ||
        bizLogoUrl !== (data.business?.settings.logoUrl || null) ||
        JSON.stringify(bizFulfillment.sort()) !== JSON.stringify((data.business?.settings.fulfillmentMethods || []).sort()) ||
        JSON.stringify(bizPayments.sort()) !== JSON.stringify((data.business?.settings.acceptedPaymentMethods || []).sort());
    } else if (activeTab === "notifications") {
      const orig = data.business?.settings.notifications;
      modified =
        notifCustomerMsgs !== (orig?.customerMessages ?? true) ||
        notifNewOrders !== (orig?.newOrders ?? true) ||
        notifPaymentUpdates !== (orig?.paymentUpdates ?? true) ||
        notifOrderStatus !== (orig?.orderStatus ?? true) ||
        notifLowStock !== (orig?.lowStock ?? true);
    } else if (activeTab === "communication") {
      const orig = data.business?.settings.communication;
      modified =
        commFacebook !== (orig?.facebook ?? true) ||
        commInstagram !== (orig?.instagram ?? true) ||
        commWhatsapp !== (orig?.whatsapp ?? true) ||
        commTiktok !== (orig?.tiktok ?? false);
    }

    setHasUnsavedChanges(modified);
  }, [
    activeTab,
    accountName,
    accountEmail,
    accountPhone,
    bizName,
    bizDesc,
    bizCategory,
    bizType,
    bizPhone,
    bizEmail,
    bizAddress,
    bizLogoUrl,
    bizFulfillment,
    bizPayments,
    notifCustomerMsgs,
    notifNewOrders,
    notifPaymentUpdates,
    notifOrderStatus,
    notifLowStock,
    commFacebook,
    commInstagram,
    commWhatsapp,
    commTiktok,
    data,
  ]);

  const handleDiscardChanges = () => {
    if (data) {
      populateForm(data);
      setFeedback(null);
    }
  };

  // Logo Upload
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: "error", message: "Please choose an image under 5MB (JPG, PNG, or WebP)." });
      return;
    }

    setUploadingLogo(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const resData = await res.json();
      if (res.ok && resData.url) {
        setBizLogoUrl(resData.url);
        setFeedback({ type: "success", message: "Photo uploaded. Click 'Save Changes' to update your store." });
      } else {
        setFeedback({ type: "error", message: resData.error || "Failed to upload photo." });
      }
    } catch {
      setFeedback({ type: "error", message: "We couldn't upload your photo. Please try again." });
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Save Account
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) {
      setFeedback({ type: "error", message: "Please enter your name." });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/settings/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: accountName.trim(),
          email: accountEmail.trim(),
          contactNumber: accountPhone.trim(),
        }),
      });

      const json = await res.json();
      if (res.ok && json.status === "success") {
        setFeedback({ type: "success", message: "✓ " + json.message });
        await refreshAuth();
        await loadSettings();
      } else {
        setFeedback({ type: "error", message: json.error || "We couldn't save your changes. Please try again." });
      }
    } catch {
      setFeedback({ type: "error", message: "We couldn't save your changes. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  // Save Business
  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName.trim()) {
      setFeedback({ type: "error", message: "Please enter your business name." });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/settings/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: bizName.trim(),
          description: bizDesc.trim(),
          category: bizCategory,
          businessType: bizType,
          contactNumber: bizPhone.trim(),
          email: bizEmail.trim(),
          address: bizAddress.trim(),
          logoUrl: bizLogoUrl,
          fulfillmentMethods: bizFulfillment,
          acceptedPaymentMethods: bizPayments,
        }),
      });

      const json = await res.json();
      if (res.ok && json.status === "success") {
        setFeedback({ type: "success", message: "✓ Your business information has been updated." });
        await loadSettings();
      } else {
        setFeedback({ type: "error", message: json.error || "We couldn't save your changes. Please try again." });
      }
    } catch {
      setFeedback({ type: "error", message: "We couldn't save your changes. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setFeedback({ type: "error", message: "Please fill in all password fields." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback({ type: "error", message: "New passwords do not match. Please re-enter." });
      return;
    }

    if (newPassword.length < 6) {
      setFeedback({ type: "error", message: "Your new password must be at least 6 characters long." });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/settings/security/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const json = await res.json();
      if (res.ok && json.status === "success") {
        setFeedback({ type: "success", message: "✓ Your password has been successfully updated." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setFeedback({ type: "error", message: json.error || "We couldn't change your password. Please check your current password." });
      }
    } catch {
      setFeedback({ type: "error", message: "We couldn't save your changes. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  // Sign out of all devices
  const handleSignOutAll = async () => {
    if (!confirm("Are you sure you want to sign out of all active devices? You will need to sign in again.")) {
      return;
    }

    try {
      await fetch("/api/settings/security/sign-out-all", { method: "POST" });
      await logout();
    } catch {
      setFeedback({ type: "error", message: "Failed to sign out of all devices." });
    }
  };

  // Save Notifications
  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifications: {
            customerMessages: notifCustomerMsgs,
            newOrders: notifNewOrders,
            paymentUpdates: notifPaymentUpdates,
            orderStatus: notifOrderStatus,
            lowStock: notifLowStock,
          },
        }),
      });

      const json = await res.json();
      if (res.ok && json.status === "success") {
        setFeedback({ type: "success", message: "✓ Your notification preferences have been saved." });
        await loadSettings();
      } else {
        setFeedback({ type: "error", message: json.error || "We couldn't save your notification preferences." });
      }
    } catch {
      setFeedback({ type: "error", message: "We couldn't save your changes. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  // Save Communication
  const handleSaveCommunication = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/settings/communication", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communication: {
            facebook: commFacebook,
            instagram: commInstagram,
            whatsapp: commWhatsapp,
            tiktok: commTiktok,
          },
        }),
      });

      const json = await res.json();
      if (res.ok && json.status === "success") {
        setFeedback({ type: "success", message: "✓ Your customer communication preferences have been saved." });
        await loadSettings();
      } else {
        setFeedback({ type: "error", message: json.error || "We couldn't save your preferences." });
      }
    } catch {
      setFeedback({ type: "error", message: "We couldn't save your changes. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  // Delete Account
  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) {
      setFeedback({ type: "error", message: "Please enter your password to confirm." });
      return;
    }
    if (deleteConfirmText !== "DELETE") {
      setFeedback({ type: "error", message: 'Please type "DELETE" in capital letters to confirm.' });
      return;
    }

    setDeletingAccount(true);

    try {
      const res = await fetch("/api/settings/danger/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: deletePassword,
          confirmationText: deleteConfirmText,
        }),
      });

      const json = await res.json();
      if (res.ok && json.status === "success") {
        alert("Your BizPilot business account and data have been permanently deleted.");
        await logout();
      } else {
        setFeedback({ type: "error", message: json.error || "Could not delete account. Please verify your password." });
        setDeletingAccount(false);
      }
    } catch {
      setFeedback({ type: "error", message: "Failed to connect to server." });
      setDeletingAccount(false);
    }
  };

  if (authLoading || (loading && !data)) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 space-y-3">
        <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-600">Loading your account settings...</p>
      </div>
    );
  }

  if (!data) return null;

  // Days left in trial
  let daysLeftInTrial = 0;
  const isLifetime = Boolean(data.business?.isLifetimeFree || data.business?.subscriptionStatus === "LIFETIME");
  if (data.business?.trialEndsAt && !isLifetime && data.business?.subscriptionStatus === "TRIAL") {
    const end = new Date(data.business.trialEndsAt).getTime();
    const now = Date.now();
    daysLeftInTrial = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
  }

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: "account", label: "My Account", icon: <User className="w-4 h-4 text-purple-600" /> },
    { id: "business", label: "My Business", icon: <Store className="w-4 h-4 text-sky-600" /> },
    { id: "security", label: "Security", icon: <ShieldCheck className="w-4 h-4 text-emerald-600" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4 text-amber-600" /> },
    { id: "communication", label: "Communication", icon: <MessageSquare className="w-4 h-4 text-indigo-600" /> },
    {
      id: "subscription",
      label: "My Plan",
      icon: <CreditCard className="w-4 h-4 text-purple-600" />,
      badge: isLifetime
        ? "Lifetime"
        : data.business?.subscriptionStatus === "TRIAL"
        ? "Trial"
        : undefined,
    },
    { id: "channels", label: "Connected Channels", icon: <Radio className="w-4 h-4 text-purple-600" /> },
    { id: "danger", label: "Danger Zone", icon: <AlertTriangle className="w-4 h-4 text-rose-600" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24">
      {/* ─── 1. CONTROL CENTER HEADER ─── */}
      <div className="bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Settings</h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">
                  {data.user.role === "ADMIN" ? "Administrator" : "Store Owner"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Manage your account, business information, security, notifications, and plan — all in one place.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/guide"
                className="px-3.5 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                View Guide
              </Link>
              <Link
                href="/"
                className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* ─── 2. "WHAT IS THIS?" BEGINNER INTRODUCTION CARD ─── */}
        <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg relative overflow-hidden">
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-bold text-purple-200 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              Your BizPilot Control Center
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Welcome to your Account Settings
            </h2>

            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-3xl">
              Think of this as the control panel for your BizPilot account. You can update your business information, protect your account, choose what notifications you receive, and check your plan.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <span className="text-xs text-purple-200 font-semibold">New to BizPilot?</span>
              <Link
                href="/guide"
                className="px-4 py-2 bg-white text-purple-950 hover:bg-purple-50 rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-purple-700" />
                Learn how Settings works in the Guide →
              </Link>
              <button
                type="button"
                onClick={() => toggleSectionHelp("intro")}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                {showSectionHelp.intro ? "Hide Quick Tip" : "What should I do first?"}
              </button>
            </div>

            {showSectionHelp.intro && (
              <div className="mt-4 p-4 rounded-2xl bg-white/10 border border-white/20 text-xs space-y-2 animate-in fade-in duration-150">
                <p className="font-bold text-white">Recommended order for first-time store owners:</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-200">
                  <li><strong>My Business:</strong> Enter your store name, description, and upload a logo.</li>
                  <li><strong>Delivery & Payments:</strong> Tell BizPilot how you deliver (e.g. LBC, Meetup) and accept payments (e.g. GCash, Maya).</li>
                  <li><strong>Notifications:</strong> Select which alerts you want to receive.</li>
                  <li><strong>Security:</strong> Set a strong password.</li>
                  <li><strong>My Plan:</strong> Review your 30-day trial status and limits.</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
              feedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Navigation Sidebar (Desktop) / Tab Pills (Mobile) */}
          <div className="lg:col-span-1">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 p-2 space-y-1 shadow-xs sticky top-24">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setFeedback(null);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                      isActive
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={isActive ? "text-white" : ""}>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </div>
                    {tab.badge && (
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                          isActive ? "bg-white/20 text-white" : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Mobile Horizontal Tab Selector */}
            <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setFeedback(null);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                      isActive
                        ? "bg-purple-600 text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className={isActive ? "text-white" : ""}>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Content Panel */}
          <div className="lg:col-span-3">
            {/* ─── TAB 1: MY ACCOUNT ─── */}
            {activeTab === "account" && (
              <div className="space-y-6">
                {/* Section Header & Explanations */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-purple-600" />
                        <h2 className="text-lg font-black text-slate-900">My Account</h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Keep your personal account information up to date.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleSectionHelp("account")}
                      className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {showSectionHelp.account ? "Hide info" : "What's this?"}
                    </button>
                  </div>

                  {/* "What can I do here?" Checklist */}
                  <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100 space-y-1.5 text-xs text-purple-950">
                    <p className="font-bold text-purple-900">What you can do here:</p>
                    <ul className="space-y-1 text-purple-800 text-[11px]">
                      <li>• Change your name</li>
                      <li>• Update your contact phone number</li>
                      <li>• Check your email address and verification status</li>
                      <li>• Request an email address update safely with verification</li>
                    </ul>
                  </div>

                  {showSectionHelp.account && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1 animate-in fade-in duration-150">
                      <p className="font-bold text-slate-800">Why your account email matters:</p>
                      <p className="text-[11px] leading-relaxed">
                        Your email is used for signing in and receiving important BizPilot messages (order alerts, password resets, and receipts). Changing your email will send a confirmation link to your new address before switching.
                      </p>
                    </div>
                  )}

                  <form onSubmit={handleSaveAccount} className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Full Name</label>
                        <div className="relative">
                          <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="text"
                            required
                            value={accountName}
                            onChange={(e) => setAccountName(e.target.value)}
                            className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 font-medium text-slate-900"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number</label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="text"
                            placeholder="0917-xxx-xxxx"
                            value={accountPhone}
                            onChange={(e) => setAccountPhone(e.target.value)}
                            className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 font-medium text-slate-900"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700">Account Login Email</label>
                        <div className="flex items-center gap-2">
                          {data.user.emailVerified ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Verified ✓
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              Unverified
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowEmailChangeModal(true)}
                            className="px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            Change Email
                          </button>
                        </div>
                      </div>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="email"
                          disabled
                          readOnly
                          value={data.user.email}
                          className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-100/80 font-mono font-medium text-slate-700 cursor-not-allowed select-all"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-purple-600" />
                        Changing your email requires secure 2-step verification. Click &quot;Change Email&quot; above to begin.
                      </p>
                    </div>

                    {/* Account Metadata Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Account Role</span>
                        <span className="text-xs font-bold text-slate-800 capitalize mt-0.5 block">
                          {data.user.role === "ADMIN" ? "System Administrator" : "Store Owner & Manager"}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Account Created</span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                          {new Date(data.user.createdAt).toLocaleDateString("en-PH", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Save className="w-4 h-4" />
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ─── TAB 2: MY BUSINESS ─── */}
            {activeTab === "business" && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Store className="w-5 h-5 text-sky-600" />
                        <h2 className="text-lg font-black text-slate-900">My Business</h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        This is the information customers and BizPilot use to understand your business.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleSectionHelp("business")}
                      className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {showSectionHelp.business ? "Hide info" : "What's this?"}
                    </button>
                  </div>

                  {/* "What can I do here?" Checklist */}
                  <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-100 space-y-1.5 text-xs text-sky-950">
                    <p className="font-bold text-sky-900">What you can do here:</p>
                    <ul className="space-y-1 text-sky-800 text-[11px]">
                      <li>• Update your store name, description, and category</li>
                      <li>• Upload or change your business logo</li>
                      <li>• Set whether you operate as an online-only business or physical store</li>
                      <li>• Choose how you deliver orders (Meetup, LBC, Grab, Lalamove, Delivery)</li>
                      <li>• Choose payment methods you accept (GCash, Maya, Bank Transfer, Cash, COD)</li>
                    </ul>
                  </div>

                  {showSectionHelp.business && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1 animate-in fade-in duration-150">
                      <p className="font-bold text-slate-800">Support for Online-Only Businesses:</p>
                      <p className="text-[11px] leading-relaxed">
                        If you sell online via social media, you do not need a physical shop address or counter. Simply choose "Online Business" below.
                      </p>
                    </div>
                  )}

                  <form onSubmit={handleSaveBusiness} className="space-y-6 pt-2">
                    {/* Logo Section */}
                    <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3">
                      <div>
                        <label className="text-xs font-bold text-slate-900 block">Business Logo</label>
                        <p className="text-[11px] text-slate-500">
                          Add a photo or logo so you can easily recognize your business.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                          {bizLogoUrl ? (
                            <img
                              src={bizLogoUrl}
                              alt="Store Logo"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Store className="w-8 h-8 text-slate-400" />
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              ref={fileInputRef}
                              accept="image/jpeg,image/png,image/webp"
                              onChange={handleLogoFileChange}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadingLogo}
                              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              {uploadingLogo ? "Uploading..." : bizLogoUrl ? "Change Photo" : "Upload Photo"}
                            </button>

                            {bizLogoUrl && (
                              <button
                                type="button"
                                onClick={() => setBizLogoUrl(null)}
                                className="px-3 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove Photo
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Use a clear JPG, PNG, or WebP image under 5MB.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Business Name</label>
                        <div className="relative">
                          <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="text"
                            required
                            value={bizName}
                            onChange={(e) => setBizName(e.target.value)}
                            className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600 font-medium text-slate-900"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Business Category</label>
                        <div className="relative">
                          <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <select
                            value={bizCategory}
                            onChange={(e) => setBizCategory(e.target.value)}
                            className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600 font-medium text-slate-900 appearance-none"
                          >
                            {CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Business Description</label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Quality laptop and electronics store based in Manila offering premium refurbished devices."
                        value={bizDesc}
                        onChange={(e) => setBizDesc(e.target.value)}
                        className="w-full text-xs p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600 font-medium text-slate-900"
                      />
                    </div>

                    {/* Store Type Selection */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-2">Business Type</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                            bizType === "ONLINE_ONLY"
                              ? "bg-sky-50 border-sky-500 text-sky-950 font-bold"
                              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <input
                            type="radio"
                            name="bizType"
                            value="ONLINE_ONLY"
                            checked={bizType === "ONLINE_ONLY"}
                            onChange={(e) => setBizType(e.target.value)}
                            className="sr-only"
                          />
                          <span className="block text-xs font-bold">Online Business</span>
                          <span className="block text-[10px] text-slate-500 mt-0.5">
                            Social media & deliveries (No physical shop)
                          </span>
                        </label>

                        <label
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                            bizType === "PHYSICAL_STORE"
                              ? "bg-sky-50 border-sky-500 text-sky-950 font-bold"
                              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <input
                            type="radio"
                            name="bizType"
                            value="PHYSICAL_STORE"
                            checked={bizType === "PHYSICAL_STORE"}
                            onChange={(e) => setBizType(e.target.value)}
                            className="sr-only"
                          />
                          <span className="block text-xs font-bold">Physical Store</span>
                          <span className="block text-[10px] text-slate-500 mt-0.5">
                            Store counter with walk-in customers
                          </span>
                        </label>

                        <label
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                            bizType === "HYBRID"
                              ? "bg-sky-50 border-sky-500 text-sky-950 font-bold"
                              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <input
                            type="radio"
                            name="bizType"
                            value="HYBRID"
                            checked={bizType === "HYBRID"}
                            onChange={(e) => setBizType(e.target.value)}
                            className="sr-only"
                          />
                          <span className="block text-xs font-bold">Hybrid Business</span>
                          <span className="block text-[10px] text-slate-500 mt-0.5">
                            Both online messaging and walk-in counter
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Business Phone</label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="text"
                            placeholder="0917-xxx-xxxx"
                            value={bizPhone}
                            onChange={(e) => setBizPhone(e.target.value)}
                            className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600 font-medium text-slate-900"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Business Email</label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="email"
                            placeholder="support@yourstore.ph"
                            value={bizEmail}
                            onChange={(e) => setBizEmail(e.target.value)}
                            className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600 font-medium text-slate-900"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Operations Hub / Return Address {bizType === "ONLINE_ONLY" && "(Optional for Online Sellers)"}
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          placeholder="e.g. Quezon City Hub / Metro Manila"
                          value={bizAddress}
                          onChange={(e) => setBizAddress(e.target.value)}
                          className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600 font-medium text-slate-900"
                        />
                      </div>
                    </div>

                    {/* ─── 8. FULFILLMENT SETTINGS ─── */}
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">How You Deliver Orders</h3>
                        <p className="text-xs text-slate-500">
                          Tell BizPilot how you normally get orders to your customers.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {FULFILLMENT_OPTIONS.map((opt) => {
                          const isChecked = bizFulfillment.includes(opt.id);
                          return (
                            <label
                              key={opt.id}
                              className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                                isChecked
                                  ? "bg-sky-50/70 border-sky-400 text-sky-950"
                                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setBizFulfillment([...bizFulfillment, opt.id]);
                                  } else {
                                    setBizFulfillment(bizFulfillment.filter((id) => id !== opt.id));
                                  }
                                }}
                                className="mt-0.5 rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                              />
                              <div>
                                <span className="block text-xs font-bold text-slate-900">{opt.label}</span>
                                <span className="block text-[11px] text-slate-500 mt-0.5">{opt.desc}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* ─── 9. PAYMENT SETTINGS ─── */}
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">How Customers Pay</h3>
                        <p className="text-xs text-slate-500">
                          Choose the payment methods your customers can use.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {PAYMENT_OPTIONS.map((opt) => {
                          const isChecked = bizPayments.includes(opt.id);
                          return (
                            <label
                              key={opt.id}
                              className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                                isChecked
                                  ? "bg-emerald-50/70 border-emerald-400 text-emerald-950"
                                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setBizPayments([...bizPayments, opt.id]);
                                  } else {
                                    setBizPayments(bizPayments.filter((id) => id !== opt.id));
                                  }
                                }}
                                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                              />
                              <div>
                                <span className="block text-xs font-bold text-slate-900">{opt.label}</span>
                                <span className="block text-[11px] text-slate-500 mt-0.5">{opt.desc}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Save className="w-4 h-4" />
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ─── TAB 3: SECURITY ─── */}
            {activeTab === "security" && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        <h2 className="text-lg font-black text-slate-900">Keep Your Account Safe</h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Protect your BizPilot account and make sure only you can access it.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleSectionHelp("security")}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {showSectionHelp.security ? "Hide info" : "What's this?"}
                    </button>
                  </div>

                  {/* "What can I do here?" Checklist */}
                  <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-1.5 text-xs text-emerald-950">
                    <p className="font-bold text-emerald-900">What you can do here:</p>
                    <ul className="space-y-1 text-emerald-800 text-[11px]">
                      <li>• Change your password whenever you want</li>
                      <li>• Request a password reset if you ever forget your password</li>
                      <li>• See how many devices are currently signed in</li>
                      <li>• Sign out of all other devices with one click</li>
                    </ul>
                  </div>

                  {/* ─── 11. SIMPLE SECURITY TIP CARD ─── */}
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Security Tip:</strong>
                      <span className="text-[11px] text-amber-800 leading-relaxed">
                        Never share your BizPilot password with anyone. BizPilot support will never ask you for your password.
                      </span>
                    </div>
                  </div>

                  {/* Change Password Form */}
                  <div className="pt-2 space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
                      <p className="text-xs text-slate-500">
                        Use this if you want to create a new password.
                      </p>
                    </div>

                    <form onSubmit={handleChangePassword} className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-slate-700">Current Password</label>
                          <Link
                            href="/login"
                            className="text-[11px] font-semibold text-purple-700 hover:text-purple-900"
                          >
                            Forgot Password?
                          </Link>
                        </div>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type={showCurrentPw ? "text" : "password"}
                            required
                            placeholder="Enter your current password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full text-xs pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPw(!showCurrentPw)}
                            className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                          >
                            {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">New Password</label>
                          <div className="relative">
                            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                            <input
                              type={showNewPw ? "text" : "password"}
                              required
                              placeholder="Minimum 6 characters"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full text-xs pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium text-slate-900"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPw(!showNewPw)}
                              className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                            >
                              {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Confirm New Password</label>
                          <div className="relative">
                            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                            <input
                              type={showNewPw ? "text" : "password"}
                              required
                              placeholder="Re-type new password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium text-slate-900"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="submit"
                          disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Lock className="w-4 h-4" />
                          {saving ? "Updating..." : "Update Password"}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Sessions Display */}
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Active Login Sessions</h3>
                        <p className="text-xs text-slate-500">
                          See your active sessions and sign out of other devices if needed.
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        ● {data.sessions.totalActive} Active Device(s)
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Current Device</span>
                        <span className="text-[11px] text-slate-500 block">Signed in on this browser</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleSignOutAll}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign Out of All Devices
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── TAB 4: NOTIFICATIONS ─── */}
            {activeTab === "notifications" && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-amber-600" />
                        <h2 className="text-lg font-black text-slate-900">Business Notifications</h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Choose which updates you want BizPilot to send you.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleSectionHelp("notifications")}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {showSectionHelp.notifications ? "Hide info" : "What's this?"}
                    </button>
                  </div>

                  {/* "What can I do here?" Checklist */}
                  <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-100 space-y-1.5 text-xs text-amber-950">
                    <p className="font-bold text-amber-900">What you can do here:</p>
                    <ul className="space-y-1 text-amber-800 text-[11px]">
                      <li>• Turn on/off email alerts for customer messages</li>
                      <li>• Get notified when you receive new orders</li>
                      <li>• Receive updates when payments are verified</li>
                      <li>• Get low-stock warnings before you run out of products</li>
                    </ul>
                  </div>

                  <form onSubmit={handleSaveNotifications} className="space-y-6 pt-2">
                    {/* Optional Notifications */}
                    <div className="space-y-3">
                      <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={notifCustomerMsgs}
                          onChange={(e) => setNotifCustomerMsgs(e.target.checked)}
                          className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                        />
                        <div>
                          <span className="block text-xs font-bold text-slate-900">Customer message</span>
                          <span className="block text-[11px] text-slate-500">
                            Receive an email when a customer asks a question or sends a message.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={notifNewOrders}
                          onChange={(e) => setNotifNewOrders(e.target.checked)}
                          className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                        />
                        <div>
                          <span className="block text-xs font-bold text-slate-900">New order</span>
                          <span className="block text-[11px] text-slate-500">
                            Receive an alert whenever a new order is placed or created.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={notifPaymentUpdates}
                          onChange={(e) => setNotifPaymentUpdates(e.target.checked)}
                          className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                        />
                        <div>
                          <span className="block text-xs font-bold text-slate-900">Payment received</span>
                          <span className="block text-[11px] text-slate-500">
                            Alerts when customer GCash, Maya, or bank payments are recorded.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={notifOrderStatus}
                          onChange={(e) => setNotifOrderStatus(e.target.checked)}
                          className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                        />
                        <div>
                          <span className="block text-xs font-bold text-slate-900">Order status update</span>
                          <span className="block text-[11px] text-slate-500">
                            Updates when orders are booked for delivery, shipped, or marked completed.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={notifLowStock}
                          onChange={(e) => setNotifLowStock(e.target.checked)}
                          className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                        />
                        <div>
                          <span className="block text-xs font-bold text-slate-900">Low stock</span>
                          <span className="block text-[11px] text-slate-500">
                            Early warning alerts when product stock reaches your safety threshold.
                          </span>
                        </div>
                      </label>
                    </div>

                    {/* Important Account Notifications */}
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Important Account Notifications</h3>
                        <p className="text-xs text-slate-500">
                          These essential messages keep your account and billing secure.
                        </p>
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">Trial ending & reminders</span>
                            <span className="text-[11px] text-slate-500 block">
                              Notices when your free trial has 7 days, 3 days, and 1 day remaining.
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-200 text-slate-700">Always On</span>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">Subscription update & receipts</span>
                            <span className="text-[11px] text-slate-500 block">
                              Payment receipts and plan renewal confirmations.
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-200 text-slate-700">Always On</span>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">Security alerts</span>
                            <span className="text-[11px] text-slate-500 block">
                              Password changes and email verification requests.
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-200 text-slate-700">Always On</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Save className="w-4 h-4" />
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ─── TAB 5: COMMUNICATION ─── */}
            {activeTab === "communication" && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-lg font-black text-slate-900">Customer Communication</h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Choose how BizPilot keeps you informed about customer conversations.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleSectionHelp("communication")}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {showSectionHelp.communication ? "Hide info" : "What's this?"}
                    </button>
                  </div>

                  {/* "What can I do here?" Checklist */}
                  <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-1.5 text-xs text-indigo-950">
                    <p className="font-bold text-indigo-900">What you can do here:</p>
                    <ul className="space-y-1 text-indigo-800 text-[11px]">
                      <li>• Toggle notification alerts for Facebook, Instagram, WhatsApp, and TikTok</li>
                      <li>• Check connection guidance for social messaging channels</li>
                    </ul>
                  </div>

                  {/* Connect Channels Prompt */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Need to connect a platform?</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Connect Facebook Messenger, Instagram, WhatsApp, or TikTok to sync customer chats with your Inbox.
                      </span>
                    </div>

                    <Link
                      href="/channels"
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-sm"
                    >
                      Go to Communication Channels
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <form onSubmit={handleSaveCommunication} className="space-y-4 pt-2">
                    <div className="space-y-3">
                      <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={commFacebook}
                          onChange={(e) => setCommFacebook(e.target.checked)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <div>
                          <span className="block text-xs font-bold text-slate-900">Facebook / Messenger Alerts</span>
                          <span className="block text-[11px] text-slate-500">
                            Receive notifications for inquiries on your Facebook Page.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={commInstagram}
                          onChange={(e) => setCommInstagram(e.target.checked)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <div>
                          <span className="block text-xs font-bold text-slate-900">Instagram Direct Alerts</span>
                          <span className="block text-[11px] text-slate-500">
                            Receive notifications for customer direct messages on Instagram.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={commWhatsapp}
                          onChange={(e) => setCommWhatsapp(e.target.checked)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <div>
                          <span className="block text-xs font-bold text-slate-900">WhatsApp Alerts</span>
                          <span className="block text-[11px] text-slate-500">
                            Receive notifications for messages sent to your WhatsApp Business number.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={commTiktok}
                          onChange={(e) => setCommTiktok(e.target.checked)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <div>
                          <span className="block text-xs font-bold text-slate-900">TikTok Alerts</span>
                          <span className="block text-[11px] text-slate-500">
                            Receive notifications for customer messages on TikTok.
                          </span>
                        </div>
                      </label>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Save className="w-4 h-4" />
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ─── TAB 6: MY PLAN ─── */}
            {activeTab === "subscription" && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-purple-600" />
                        <h2 className="text-lg font-black text-slate-900">My BizPilot Plan</h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        See what plan you&apos;re using and what features are available to your business.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleSectionHelp("subscription")}
                      className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {showSectionHelp.subscription ? "Hide info" : "What's this?"}
                    </button>
                  </div>

                  {/* "What can I do here?" Checklist */}
                  <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100 space-y-1.5 text-xs text-purple-950">
                    <p className="font-bold text-purple-900">What you can do here:</p>
                    <ul className="space-y-1 text-purple-800 text-[11px]">
                      <li>• Check your current plan and monthly price</li>
                      <li>• See how many days remain in your 30-day free trial</li>
                      <li>• View your live product, order, and staff limits</li>
                      <li>• Compare plans and request an upgrade</li>
                    </ul>
                  </div>

                  {/* Plan Summary Banner */}
                  <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white rounded-2xl p-6 shadow-md space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block">Current Plan</span>
                        <h3 className="text-2xl font-black tracking-tight">{data.plan.name}</h3>
                        <p className="text-xs text-slate-300 mt-0.5">
                          {(data.business?.isLifetimeFree || data.business?.subscriptionStatus === "LIFETIME")
                            ? "₱0 / month (Permanent Lifetime Pro Access)"
                            : `₱${data.plan.price.toLocaleString("en-PH")}/month`}
                        </p>
                      </div>

                      <div className="self-start sm:self-auto">
                        {isLifetime ? (
                          <div className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/30 to-purple-500/30 border border-amber-400/50 text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            ✨ Lifetime Access (PRO)
                          </div>
                        ) : data.business?.subscriptionStatus === "TRIAL" ? (
                          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4" />
                            30-Day Free Trial ({daysLeftInTrial} days left)
                          </div>
                        ) : (
                          <div className="px-3.5 py-1.5 rounded-xl bg-purple-500/20 border border-purple-400/40 text-purple-300 text-xs font-bold">
                            ● {data.business?.subscriptionStatus}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Connected Accounts Quick Stat */}
                    <div className="p-3 bg-white/10 rounded-xl text-xs text-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4 text-purple-300 shrink-0" />
                        <span>
                          Connected Accounts:{" "}
                          <strong>
                            {data.usage.connectedChannelsCount ?? 0} /{" "}
                            {data.usage.maxConnectedChannels === null
                              ? "Unlimited"
                              : data.usage.maxConnectedChannels ?? 1}{" "}
                            used
                          </strong>
                          {data.usage.remainingChannelSlots !== null && (
                            <span className="text-purple-300 ml-1.5">
                              ({data.usage.remainingChannelSlots} remaining)
                            </span>
                          )}
                        </span>
                      </div>
                      <Link
                        href="/channels"
                        className="text-xs font-bold text-purple-300 hover:text-white underline"
                      >
                        Manage Channels →
                      </Link>
                    </div>

                    {data.business?.trialEndsAt && !isLifetime && data.business.subscriptionStatus === "TRIAL" && (
                      <div className="p-3 bg-white/10 rounded-xl text-xs text-slate-200 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-purple-300 shrink-0" />
                        <span>
                          Trial ends on:{" "}
                          <strong>
                            {new Date(data.business.trialEndsAt).toLocaleDateString("en-PH", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </strong>
                        </span>
                      </div>
                    )}

                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <Link
                        href="/pricing"
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        View All Plans & Upgrade
                      </Link>
                    </div>
                  </div>

                  {/* ─── 15. PLAN EXPLANATION FOR BEGINNERS ─── */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">What does my plan mean?</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Your BizPilot plan determines how many products, orders, connected social accounts, staff members, and advanced features you can use.
                      </span>
                    </div>

                    <Link
                      href="/pricing"
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all self-start sm:self-auto shrink-0"
                    >
                      Compare Plans
                    </Link>
                  </div>

                  {/* Usage Summary */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">Plan Usage</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Connected Social Accounts Meter */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 flex items-center gap-1.5">
                            <Radio className="w-4 h-4 text-purple-600" />
                            Connected Accounts
                          </span>
                          <span className="font-extrabold text-slate-900">
                            {data.usage.connectedChannelsCount ?? 0} /{" "}
                            {data.usage.maxConnectedChannels === null
                              ? "Unlimited"
                              : data.usage.maxConnectedChannels ?? 1}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-purple-600 h-full rounded-full transition-all"
                            style={{
                              width:
                                data.usage.maxConnectedChannels === null
                                  ? `${Math.min(100, ((data.usage.connectedChannelsCount ?? 0) / 5) * 100)}%`
                                  : `${Math.min(
                                      100,
                                      ((data.usage.connectedChannelsCount ?? 0) /
                                        (data.usage.maxConnectedChannels ?? 1)) *
                                        100
                                    )}%`,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                          <span>
                            {data.usage.remainingChannelSlots !== null
                              ? `${data.usage.remainingChannelSlots} slot(s) remaining`
                              : "Unlimited plan*"}
                          </span>
                          <Link href="/channels" className="text-purple-600 font-bold hover:underline">
                            Manage →
                          </Link>
                        </div>
                      </div>

                      {/* Products Meter */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 flex items-center gap-1.5">
                            <Package className="w-4 h-4 text-amber-600" />
                            Products
                          </span>
                          <span className="font-extrabold text-slate-900">
                            {data.usage.productCount} / {data.usage.maxProducts === null ? "Unlimited" : data.usage.maxProducts}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all"
                            style={{
                              width:
                                data.usage.maxProducts === null
                                  ? `${Math.min(100, (data.usage.productCount / 50) * 100)}%`
                                  : `${Math.min(100, (data.usage.productCount / data.usage.maxProducts) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Monthly Orders Meter */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 flex items-center gap-1.5">
                            <ShoppingBag className="w-4 h-4 text-emerald-600" />
                            Orders this month
                          </span>
                          <span className="font-extrabold text-slate-900">
                            {data.usage.monthlyOrderCount} / {data.usage.maxMonthlyOrders === null ? "Unlimited" : data.usage.maxMonthlyOrders}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all"
                            style={{
                              width:
                                data.usage.maxMonthlyOrders === null
                                  ? `${Math.min(100, (data.usage.monthlyOrderCount / 100) * 100)}%`
                                  : `${Math.min(100, (data.usage.monthlyOrderCount / data.usage.maxMonthlyOrders) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Staff Accounts Meter */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-purple-600" />
                            Staff
                          </span>
                          <span className="font-extrabold text-slate-900">
                            {data.usage.staffCount} / {data.usage.maxStaffAccounts}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-purple-500 h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, (data.usage.staffCount / data.usage.maxStaffAccounts) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Manual Billing Notice */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                    <p className="font-bold text-slate-800">Philippine Payment & Invoices</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Plan upgrades and renewals are manually processed and verified via GCash, Maya, or Philippine bank deposits. No surprise automatic card charges.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ─── TAB: CONNECTED CHANNELS ─── */}
            {activeTab === "channels" && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Radio className="w-5 h-5 text-purple-600" />
                        <h2 className="text-lg font-black text-slate-900">Connected Channels</h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Connect and manage customer messaging channels across Facebook, Instagram, WhatsApp, and TikTok.
                      </p>
                    </div>

                    <Link
                      href="/channels"
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition-all flex items-center gap-1.5 shrink-0"
                    >
                      <span>Manage Channels</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {/* Channel Entitlement Overview */}
                  <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-purple-950">
                    <div className="space-y-1">
                      <span className="font-extrabold text-purple-900 block">
                        Channel Capacity: {data.usage.connectedChannelsCount ?? 0} of {data.usage.maxConnectedChannels === null ? "Unlimited" : data.usage.maxConnectedChannels ?? 1} Used
                      </span>
                      <p className="text-[11px] text-purple-800">
                        {data.usage.remainingChannelSlots !== null
                          ? `You have ${data.usage.remainingChannelSlots} available channel slot(s) on your current plan.`
                          : "Your Pro plan includes unlimited connected pages and accounts."}
                      </p>
                    </div>

                    <Link
                      href="/pricing"
                      className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all self-start sm:self-auto shrink-0"
                    >
                      Upgrade Slots
                    </Link>
                  </div>

                  {/* Platforms Summary Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Facebook */}
                    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                          Facebook Messenger
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          Meta Official
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Connect Facebook Pages to automatically receive inquiries and confirm orders.
                      </p>
                    </div>

                    {/* Instagram */}
                    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-pink-600" />
                          Instagram Direct
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200">
                          Meta Graph API
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Sync customer DMs, product inquiries, and photo proof of payments.
                      </p>
                    </div>

                    {/* WhatsApp */}
                    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                          WhatsApp Cloud API
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Business Cloud
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Send automated order receipts and delivery updates to WhatsApp customers.
                      </p>
                    </div>

                    {/* TikTok */}
                    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                          TikTok Shop & DMs
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                          Commercial API
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Engage buyers commenting on viral video listings and live shopping streams.
                      </p>
                    </div>
                  </div>

                  {/* Channel Action Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Looking to add a new Facebook page or WhatsApp number?
                    </span>
                    <Link
                      href="/channels"
                      className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                    >
                      Open Channels Hub →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* ─── TAB 7: DANGER ZONE ─── */}
            {activeTab === "danger" && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-xs space-y-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-rose-600" />
                        <h2 className="text-lg font-black text-slate-900">Account & Data</h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Manage signing out and permanent account actions.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleSectionHelp("danger")}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {showSectionHelp.danger ? "Hide info" : "What's this?"}
                    </button>
                  </div>

                  {/* "What can I do here?" Checklist */}
                  <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-100 space-y-1.5 text-xs text-rose-950">
                    <p className="font-bold text-rose-900">What you can do here:</p>
                    <ul className="space-y-1 text-rose-800 text-[11px]">
                      <li>• Sign out of your BizPilot account on this device</li>
                      <li>• Permanently delete your business account and records</li>
                    </ul>
                  </div>

                  {/* Sign Out Card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Sign Out</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Log out of your current session on this device.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => logout()}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>

                  {/* Delete Account Card */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-rose-900">Delete Account</h3>
                      <p className="text-xs text-slate-600 max-w-lg leading-relaxed">
                        Deleting your account permanently removes your BizPilot account and associated business data. This cannot be undone.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setDeleteModalOpen(true);
                        setDeletePassword("");
                        setDeleteConfirmText("");
                      }}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Unsaved Changes Banner */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 animate-in slide-in-from-bottom-4 duration-200">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>You have unsaved changes.</span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleDiscardChanges}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                Discard Changes
              </button>
              <button
                type="button"
                onClick={(e) => {
                  if (activeTab === "account") handleSaveAccount(e);
                  else if (activeTab === "business") handleSaveBusiness(e);
                  else if (activeTab === "notifications") handleSaveNotifications(e);
                  else if (activeTab === "communication") handleSaveCommunication(e);
                }}
                disabled={saving}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900">Delete Account & Data?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Deleting your account permanently removes your BizPilot account and associated business data. This cannot be undone:
              </p>
              <ul className="text-xs text-rose-800 bg-rose-50 p-3 rounded-xl space-y-1 list-disc list-inside font-medium">
                <li>All product listings and stock records</li>
                <li>All orders, receipts, and customer messages</li>
                <li>All scheduled calendar meetups and deliveries</li>
              </ul>
            </div>

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Type <span className="text-rose-600 font-extrabold">&quot;DELETE&quot;</span> in capital letters:
                </label>
                <input
                  type="text"
                  required
                  placeholder="DELETE"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-600 font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Enter Your Password:
                </label>
                <input
                  type="password"
                  required
                  placeholder="Your account password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-600 font-medium text-slate-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={deletingAccount}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deletingAccount || deleteConfirmText !== "DELETE" || !deletePassword}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  {deletingAccount ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Change 2-Step Verification Modal */}
      <EmailChangeModal
        isOpen={showEmailChangeModal}
        currentEmail={data.user.email}
        onClose={() => setShowEmailChangeModal(false)}
        onSuccess={(newEmail) => {
          setAccountEmail(newEmail);
          setFeedback({
            type: "success",
            message: `✓ Your login email has been successfully updated to ${newEmail}.`,
          });
          refreshAuth();
          loadSettings();
        }}
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 space-y-3">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-600">Loading settings...</p>
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}
