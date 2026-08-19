"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Radio,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Plus,
  X,
  Check,
  Terminal,
  Wifi,
  WifiOff,
  MessageSquare,
  Settings,
  ArrowRight,
  ArrowLeft,
  HelpCircle,
  Zap,
  Globe,
  BookOpen,
  Send,
  Clock,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  Users,
  Inbox,
  Circle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { ModuleIntroModal, AboutPageButton, useModuleIntro, ModuleIntroConfig } from "@/components/ModuleIntroModal";
import { FacebookLogo, InstagramLogo, WhatsAppLogo, TikTokLogo } from "@/components/BrandLogos";

// ═══════════════════════════════════════════════════════════════════
// MODULE INTRO CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const CHANNELS_INTRO_CONFIG: ModuleIntroConfig = {
  moduleKey: "channels",
  title: "Your Selling Channels",
  badge: "Channels",
  icon: <Radio className="w-6 h-6 text-purple-600" />,
  subtitle: "Connect the messaging platforms where your customers contact you.",
  whatYouCanDo: [
    "Connect Facebook Messenger, Instagram, WhatsApp, and TikTok to your Messages inbox",
    "See which platforms are connected and working",
    "Test your connections to make sure messages are coming through",
    "Disconnect or reconnect platforms at any time",
  ],
  whyItMatters:
    "When channels are connected, customer messages from those platforms automatically appear in your Messages — so you can respond from one place instead of switching between apps.",
  nextAction: "Connect your first platform or check the status of existing connections.",
};

// ═══════════════════════════════════════════════════════════════════
// PLATFORM DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

interface PlatformDef {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  features: string[];
  requirements: string[];
  approvalRequired: boolean;
  connectionGuide: { title: string; steps: string[] };
  troubleshooting: { problem: string; solutions: string[] }[];
  permissionExplanation: string;
}

const PLATFORM_INFO: Record<string, PlatformDef> = {
  FACEBOOK: {
    icon: <FacebookLogo className="w-7 h-7" />,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    description: "Receive and reply to customer messages from your official Facebook Business Page directly inside BizPilot.",
    features: [
      "Receive customer Messenger chats in Unified Inbox",
      "Reply directly to buyers from BizPilot",
      "1-Click Order creation from Facebook chats",
      "Grounded AI product & price suggestions",
    ],
    requirements: [
      "A Facebook account with Admin access to your Business Page",
      "Meta for Developers App with Messenger product enabled (developers.facebook.com)",
      "Page Access Token with 'pages_messaging' and 'pages_show_list' permissions",
      "Webhook configured with Callback URL: /api/webhooks/meta",
    ],
    approvalRequired: false,
    connectionGuide: {
      title: "How to connect Facebook Messenger",
      steps: [
        "Go to Meta for Developers (developers.facebook.com) and create or select your App.",
        "Add the 'Messenger' product and navigate to Messenger → API Setup.",
        "Select your Facebook Business Page and generate a Page Access Token.",
        "In BizPilot, click Connect Facebook and enter your Page Name and Page ID.",
        "Configure your Webhook in Meta: Set Callback URL to 'https://your-domain.com/api/webhooks/meta' and Verify Token to 'mtb_fb_verify_token_2026'.",
        "Subscribe your Page to 'messages' and 'messaging_postbacks' webhook events.",
        "Click 'Test Channel' in BizPilot to verify live Graph API connectivity and webhook handshake.",
        "Send a test message from a customer account to your Facebook Page to verify it appears in your Unified Inbox!",
      ],
    },
    troubleshooting: [
      {
        problem: "Facebook Page isn't connecting or returns authentication error",
        solutions: [
          "Confirm you have Admin rights on the Facebook Business Page.",
          "Ensure your Page Access Token has not expired or been revoked.",
          "Check that 'pages_messaging' permission is enabled on your Meta App.",
          "Try disconnecting and reconnecting with a fresh token.",
          "Click 'Test Channel' to diagnose specific Graph API error codes.",
        ],
      },
      {
        problem: "Messages from buyers are not appearing in BizPilot Inbox",
        solutions: [
          "Verify the Webhook Callback URL is set to 'https://your-domain.com/api/webhooks/meta'.",
          "Ensure your Page is subscribed to 'messages' in your Meta App Webhook settings.",
          "Confirm your Verify Token matches 'mtb_fb_verify_token_2026'.",
          "Send a test message to your connected Page and refresh your Inbox.",
        ],
      },
    ],
    permissionExplanation: "BizPilot requests permission only to receive incoming messages and dispatch replies on your behalf. Personal Facebook accounts and unrelated assets remain completely private.",
  },
  INSTAGRAM: {
    icon: <InstagramLogo className="w-7 h-7" />,
    color: "text-pink-700",
    bgColor: "bg-pink-50",
    borderColor: "border-pink-200",
    description: "Receive and manage Instagram Direct Messages (DMs) from customers in your BizPilot Unified Inbox.",
    features: [
      "Receive Instagram DMs from prospective buyers",
      "Reply to Instagram inquiries directly from BizPilot",
      "Create orders and schedule meetups from Instagram chats",
      "Separate business chats from personal Instagram DMs",
    ],
    requirements: [
      "An Instagram Professional Account (Business or Creator, not Personal)",
      "Instagram account linked to your Facebook Business Page in Meta Business Suite",
      "'Allow Access to Messages' enabled in Instagram App Settings → Privacy → Messages",
      "Meta App with 'instagram_manage_messages' permission enabled",
    ],
    approvalRequired: false,
    connectionGuide: {
      title: "How to connect Instagram Direct",
      steps: [
        "In the Instagram mobile app, switch your account to a Professional Account (Business or Creator).",
        "Open Meta Business Suite (business.facebook.com) and link your Instagram account to your Facebook Page.",
        "In Instagram App Settings → Privacy → Messages → Connected Tools, toggle ON 'Allow Access to Messages'.",
        "In Meta for Developers, ensure your App has 'instagram_manage_messages' and 'instagram_basic' permissions.",
        "In BizPilot, click Connect Instagram and enter your Instagram handle and Account ID.",
        "Configure your Meta Webhook to subscribe to the 'instagram' object with 'messages' field.",
        "Click 'Test Channel' to verify token validity and webhook routing.",
        "Send a test DM to your Instagram Business account to confirm it appears in your Unified Inbox!",
      ],
    },
    troubleshooting: [
      {
        problem: "Instagram connection returns 'Permission Denied'",
        solutions: [
          "Verify your Instagram account is set to Business or Creator (Personal accounts cannot use the Messaging API).",
          "Confirm 'Allow Access to Messages' is toggled ON under Instagram App Settings → Privacy → Messages.",
          "Ensure your Instagram account is linked to your Facebook Page in Meta Business Suite.",
          "Run 'Test Channel' to check token expiration or missing scope errors.",
        ],
      },
      {
        problem: "DMs not appearing in BizPilot Messages",
        solutions: [
          "Check that your Meta Webhook is subscribed to the 'instagram' object with 'messages' selected.",
          "Ensure the Webhook URL points to 'https://your-domain.com/api/webhooks/meta'.",
          "Wait 15 seconds after sending a test DM and refresh your Unified Inbox.",
        ],
      },
    ],
    permissionExplanation: "BizPilot only requests permission to receive customer direct messages from your Instagram Business profile. Your personal photos, feed, and personal DMs remain private.",
  },
  WHATSAPP: {
    icon: <WhatsAppLogo className="w-7 h-7" />,
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    description: "Connect WhatsApp Business Cloud API to handle customer chats, order inquiries, and payment proofs in BizPilot.",
    features: [
      "Receive WhatsApp customer inquiries in real time",
      "Reply to buyers via official Meta WhatsApp Cloud API",
      "Process GCash/Maya payment proof attachments",
      "Centralized conversation threading with customer phone numbers",
    ],
    requirements: [
      "A Meta Business Portfolio (business.facebook.com)",
      "WhatsApp Business Cloud API setup in Meta for Developers",
      "A dedicated Business Phone Number and Phone Number ID",
      "System User Access Token with 'whatsapp_business_messaging' scope",
    ],
    approvalRequired: false,
    connectionGuide: {
      title: "How to connect WhatsApp Business Cloud API",
      steps: [
        "Go to Meta for Developers (developers.facebook.com) and create an App of type 'Business'.",
        "Add the 'WhatsApp' product and open WhatsApp → API Setup.",
        "Copy your Phone Number ID and WhatsApp Business Account ID (WABA ID).",
        "In Meta Business Manager, create a System User and generate a permanent Access Token with 'whatsapp_business_messaging' permission.",
        "Set Webhook Callback URL to 'https://your-domain.com/api/webhooks/whatsapp' and Verify Token to 'mtb_wa_verify_token_2026'.",
        "Subscribe to the 'messages' field in your WhatsApp Webhook configuration.",
        "In BizPilot, click Connect WhatsApp, enter your Phone Number ID and Token, then click Connect.",
        "Click 'Test Channel' to verify Cloud API communication, then send a test WhatsApp message to your business number!",
      ],
    },
    troubleshooting: [
      {
        problem: "WhatsApp returns 'Invalid Phone Number ID' or token error",
        solutions: [
          "Make sure you copied the Phone Number ID (not the WABA ID or phone number itself).",
          "Ensure your System User token in Meta Business Manager has not been revoked.",
          "Check that your WhatsApp Cloud API app is associated with an active Meta Business Portfolio.",
          "Run 'Test Channel' to check token connectivity.",
        ],
      },
      {
        problem: "Inbound WhatsApp messages not appearing",
        solutions: [
          "Confirm Webhook Callback URL is set to 'https://your-domain.com/api/webhooks/whatsapp'.",
          "Ensure the 'messages' field is subscribed in your WhatsApp Webhook configuration.",
          "Check that your business phone number is capable of receiving international WhatsApp messages.",
        ],
      },
    ],
    permissionExplanation: "BizPilot only accesses messages sent to your designated WhatsApp Business phone number. Your private personal WhatsApp chats are never accessed.",
  },
  TIKTOK: {
    icon: <TikTokLogo className="w-7 h-7" />,
    color: "text-slate-700",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    description: "Connect TikTok Business Messaging to manage buyer inquiries and sound-test questions in BizPilot.",
    features: [
      "Receive customer inquiries from TikTok Shop and bio links (when approved)",
      "Convert TikTok leads into orders in your Unified Inbox",
      "Developer Simulator available for offline testing",
    ],
    requirements: [
      "A verified TikTok for Business account",
      "Approved ByteDance Commercial Developer Application",
      "TikTok Business Messaging API enterprise developer whitelisting",
      "TikTok App Review and commercial messaging permission grant",
    ],
    approvalRequired: true,
    connectionGuide: {
      title: "How to connect TikTok Business Messaging",
      steps: [
        "Ensure you have an active TikTok for Business account verified in the TikTok Business Center.",
        "Apply for Developer access on the TikTok for Business Developer Portal.",
        "Request the 'business.message' enterprise messaging scope for your commercial application.",
        "Complete ByteDance's commercial app review and security compliance review.",
        "Once approved by TikTok, enter your Client Key and Access Token in BizPilot.",
        "Set Webhook Callback URL to 'https://your-domain.com/api/webhooks/tiktok'.",
        "Click 'Test Channel' to verify live message routing.",
        "Note: While awaiting ByteDance approval, use the Developer Simulator to test Philippine MSME TikTok order inquiries safely!",
      ],
    },
    troubleshooting: [
      {
        problem: "Status shows 'BLOCKED — Enterprise Approval Required'",
        solutions: [
          "ByteDance restricts direct messaging APIs to verified Enterprise commercial partners.",
          "Check your TikTok for Business Developer Portal for application review status.",
          "BizPilot cannot bypass ByteDance platform review requirements.",
          "You can safely use the Developer Simulator in BizPilot to practice processing TikTok inquiries.",
        ],
      },
      {
        problem: "Connected but messages not syncing",
        solutions: [
          "Verify that your TikTok App has been approved for production messaging scopes.",
          "Ensure your Webhook URL points to 'https://your-domain.com/api/webhooks/tiktok'.",
          "Run 'Test Channel' to check token status.",
        ],
      },
    ],
    permissionExplanation: "BizPilot requires ByteDance enterprise approval to receive customer direct messages. Your personal TikTok account and videos remain completely private.",
  },
};

// ═══════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════

interface ChannelInfo {
  platform: string;
  name: string;
  officialProduct: string;
  capabilities: {
    messaging: boolean;
    webhooks: boolean;
    signatureVerification: boolean;
    rateLimitPerMinute: number;
    requiresAppReview: boolean;
    productionReady: boolean;
    statusNotes: string;
  };
  connectedAccounts?: {
    id: string;
    platformAccountId: string;
    platformAccountName: string;
    status: string;
    statusMessage?: string;
    lastSyncAt?: string;
    createdAt?: string;
  }[];
  activeCount?: number;
  needsReauthCount?: number;
  disconnectedCount?: number;
  aggregateStatus?: string;
  isAllowedByPlan?: boolean;
  minPlanTier?: string;
  connection: {
    id: string;
    platformAccountId: string;
    platformAccountName: string;
    status: string;
    statusMessage?: string;
    webhookVerifyToken?: string;
    lastSyncAt?: string;
    createdAt?: string;
  } | null;
}

interface TestResultData {
  step: string;
  passed: boolean;
  message: string;
}

interface TestResponse {
  status: string;
  platform: string;
  overallPassed: boolean;
  connectionStatus?: string;
  healthCategory?: string;
  results: TestResultData[];
  friendlyMessage: string;
  connectionInfo?: {
    id?: string;
    accountName: string;
    accountId?: string;
    connectedAt: string | Date;
    lastSync: string | Date;
    tokenConfigured?: boolean;
    status?: string;
  };
}

interface DisconnectTarget {
  connectionId?: string;
  accountName: string;
  platform: string;
}

type WizardStep = "info" | "requirements" | "connect" | "verifying" | "success" | "error";
type ModalView = "wizard" | "guide" | "troubleshooting" | "setupGuide" | "testResult" | null;

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function ChannelsPage() {
  const { isOpen: isIntroOpen, openIntro, closeIntro } = useModuleIntro("channels");
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [entitlement, setEntitlement] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Wizard state
  const [wizardChannel, setWizardChannel] = useState<ChannelInfo | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>("info");
  const [formData, setFormData] = useState({ accountName: "", accountId: "", accessToken: "" });
  const [saving, setSaving] = useState(false);

  // Modal views
  const [modalView, setModalView] = useState<ModalView>(null);
  const [activeChannel, setActiveChannel] = useState<ChannelInfo | null>(null);

  // Disconnect confirmation
  const [disconnectTarget, setDisconnectTarget] = useState<DisconnectTarget | null>(null);

  // Test connection
  const [testingPlatform, setTestingPlatform] = useState<string | null>(null);
  const [testResponse, setTestResponse] = useState<TestResponse | null>(null);

  // Messages
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Setup guide visibility
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);

  // ─── Data Fetching ───

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/channels");
      const data = await res.json();
      if (data.status === "success") {
        setChannels(data.channels);
        setEntitlement(data.entitlement);
      }
    } catch {
      // Fail silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // ─── Wizard Handlers ───

  const openWizard = (ch: ChannelInfo, initialName = "", initialId = "", initialToken = "") => {
    let cleanId = initialId;
    let cleanToken = initialToken;
    if (!cleanToken && cleanId.startsWith("EAA")) {
      cleanToken = cleanId;
      cleanId = "";
    }
    setWizardChannel(ch);
    setWizardStep("info");
    setFormData({ accountName: initialName, accountId: cleanId, accessToken: cleanToken });
    setErrorMsg("");
    setModalView("wizard");
  };

  const handleWizardConnect = async () => {
    if (!wizardChannel || !formData.accountName.trim()) return;
    setSaving(true);
    setWizardStep("verifying");

    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: wizardChannel.platform,
          platformAccountId: formData.accountId.trim() || `${wizardChannel.platform.toLowerCase()}_${Date.now()}`,
          platformAccountName: formData.accountName.trim(),
          accessToken: formData.accessToken.trim() || undefined,
          webhookVerifyToken: `bizpilot_${wizardChannel.platform.toLowerCase()}_${Date.now()}`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === "success" && data.connection?.status === "CONNECTED") {
        await new Promise((r) => setTimeout(r, 1200));
        setWizardStep("success");
        fetchChannels();
      } else {
        setErrorMsg(
          data.connection?.statusMessage ||
          data.error ||
          "Live Meta validation failed. Please check your Page Access Token."
        );
        setWizardStep("error");
        fetchChannels();
      }
    } catch {
      setErrorMsg("We couldn't connect to the server. Please check your internet and try again.");
      setWizardStep("error");
    } finally {
      setSaving(false);
    }
  };

  // ─── Disconnect Handler ───

  const handleDisconnect = async () => {
    if (!disconnectTarget) return;
    setSaving(true);
    try {
      const url = disconnectTarget.connectionId
        ? `/api/channels?connectionId=${disconnectTarget.connectionId}`
        : `/api/channels?platform=${disconnectTarget.platform}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();
      if (data.status === "success") {
        setSuccessMsg(`${disconnectTarget.accountName} has been disconnected. Existing conversations & customer history remain safely preserved.`);
        setDisconnectTarget(null);
        fetchChannels();
        setTimeout(() => setSuccessMsg(""), 5000);
      } else {
        setErrorMsg(data.error || "Failed to disconnect account.");
      }
    } catch {
      setErrorMsg("Failed to disconnect. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveRecord = async (connectionId: string, accountName: string) => {
    try {
      const res = await fetch(`/api/channels?connectionId=${connectionId}&deleteRecord=true`, { method: "DELETE" });
      const data = await res.json();
      if (data.status === "success") {
        setSuccessMsg(`Obsolete record "${accountName}" removed.`);
        fetchChannels();
        setTimeout(() => setSuccessMsg(""), 4000);
      } else {
        setErrorMsg(data.error || "Failed to remove record.");
      }
    } catch {
      setErrorMsg("Failed to remove record.");
    }
  };

  // ─── Test Connection Handler (Exact Connection-Targeted) ───

  const handleTestConnection = async (ch: ChannelInfo, connectionId?: string) => {
    const testKey = connectionId ? `${ch.platform}_${connectionId}` : ch.platform;
    setTestingPlatform(testKey);
    setTestResponse(null);
    try {
      const res = await fetch("/api/channels/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: ch.platform,
          ...(connectionId ? { connectionId } : {}),
        }),
      });
      const data: TestResponse = await res.json();
      setTestResponse(data);
      setActiveChannel(ch);
      setModalView("testResult");
      // Instantaneously refresh channels list from server truth
      await fetchChannels();
    } catch {
      setTestResponse({
        status: "failed",
        platform: ch.platform,
        overallPassed: false,
        results: [{ step: "Connection test", passed: false, message: "Could not reach the server. Please try again." }],
        friendlyMessage: "The test couldn't run. Please check your internet connection and try again.",
      });
      setActiveChannel(ch);
      setModalView("testResult");
    } finally {
      setTestingPlatform(null);
    }
  };

  // ─── Guide / Troubleshooting Handlers ───

  const openGuide = (ch: ChannelInfo) => {
    setActiveChannel(ch);
    setModalView("guide");
  };

  const openTroubleshooting = (ch: ChannelInfo) => {
    setActiveChannel(ch);
    setModalView("troubleshooting");
  };

  const closeModal = () => {
    setModalView(null);
    setActiveChannel(null);
    setWizardChannel(null);
    setTestResponse(null);
  };

  // ─── Status Badge (Derived from Authoritative Multi-Account Truth) ───

  const getStatusBadge = (ch: ChannelInfo) => {
    const status = ch.aggregateStatus || (ch.connection?.status === "CONNECTED" ? "CONNECTED" : ch.connection?.status);
    if (status === "CONNECTED") {
      return (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1.5" aria-label="Connected & Verified">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" /> Connected & Verified
        </span>
      );
    }
    if (status === "PARTIALLY_CONNECTED") {
      return (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1.5" aria-label="Action Needed">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Action Needed ({ch.needsReauthCount} need reauth)
        </span>
      );
    }
    if (status === "NEEDS_REAUTH") {
      return (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1.5" aria-label="Reauthentication Required">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Reauthentication Required
        </span>
      );
    }
    if (status === "ACCOUNT_MISMATCH") {
      return (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1.5" aria-label="Account Mismatch">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Account Mismatch
        </span>
      );
    }
    if (status === "MISSING_PERMISSION") {
      return (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1.5" aria-label="Permission Required">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Permission Required
        </span>
      );
    }
    if (status === "PENDING_VALIDATION") {
      return (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 flex items-center gap-1.5" aria-label="Validating">
          <Loader2 className="w-3 h-3 animate-spin text-blue-600" /> Validating...
        </span>
      );
    }
    if (status === "PENDING_APPROVAL" || PLATFORM_INFO[ch.platform]?.approvalRequired) {
      return (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1.5" aria-label="Approval Required">
          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> Approval Required
        </span>
      );
    }
    if (status === "ERROR") {
      return (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1.5" aria-label="Connection Error">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Connection Error
        </span>
      );
    }
    if (status === "DISCONNECTED") {
      return (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1.5" aria-label="Disconnected">
          <Circle className="w-3 h-3" aria-hidden="true" /> Disconnected
        </span>
      );
    }
    return (
      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1.5" aria-label="Not Connected">
        <Circle className="w-3 h-3" aria-hidden="true" /> Not Connected
      </span>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-0">
      {/* ─── Page Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Radio className="w-5 h-5 text-purple-600" aria-hidden="true" />
              Communication Channels
            </h1>
            <AboutPageButton onClick={openIntro} />
          </div>
          <p className="text-sm text-slate-600 mt-1.5 max-w-xl leading-relaxed">
            Connect the places where your customers talk to you. Once connected, customer messages appear in one inbox so you don&apos;t have to keep checking different apps.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start flex-wrap">
          <button
            onClick={() => setShowSetupGuide(true)}
            className="px-3 py-2 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100 flex items-center gap-1.5 transition-colors"
            aria-label="Open channel setup guide"
          >
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" /> Setup Guide
          </button>
          <button
            onClick={fetchChannels}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
            aria-label="Refresh channels"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Refresh
          </button>
          <Link
            href="/simulator"
            className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
            aria-label="Open simulator"
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" /> Simulator
          </Link>
        </div>
      </div>

      {/* ─── Entitlement & Plan Channels Usage Banner ─── */}
      {entitlement && (
        <div className="bg-gradient-to-r from-purple-950 via-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-sm border border-purple-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/10">
              <Radio className="w-5 h-5 text-purple-300" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm tracking-tight">{entitlement.planName} Plan Channels</span>
                <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30">
                  {entitlement.subscriptionStatus}
                </span>
              </div>
              <p className="text-xs text-purple-200/90 mt-1">
                Using <strong className="text-white font-bold">{entitlement.connectedCount}</strong> of{" "}
                <strong className="text-white font-bold">{entitlement.maxAllowed ?? "Unlimited"}</strong> connected account slot(s)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {entitlement.maxAllowed !== null && entitlement.connectedCount >= entitlement.maxAllowed ? (
              <Link
                href="/pricing"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" /> Upgrade for More Accounts
              </Link>
            ) : (
              <span className="text-xs text-purple-200/80 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 font-medium">
                {entitlement.remainingSlots !== null ? `${entitlement.remainingSlots} slot(s) available` : "Unlimited slots"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── Tip: Connect only what you use ─── */}
      <div className="bg-purple-50/60 rounded-xl p-3 border border-purple-100 text-xs text-purple-800 flex items-start gap-2.5">
        <HelpCircle className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" aria-hidden="true" />
        <span><strong>Multi-Account Support:</strong> You can connect multiple Facebook Pages, Instagram accounts, or WhatsApp numbers to BizPilot according to your plan limits.</span>
      </div>

      <ModuleIntroModal config={CHANNELS_INTRO_CONFIG} isOpen={isIntroOpen} onClose={closeIntro} />

      {/* ─── Success / Error Messages ─── */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2" role="alert">
          <CheckCircle className="w-4 h-4 shrink-0" aria-hidden="true" /> {successMsg}
          <button onClick={() => setSuccessMsg("")} className="ml-auto text-emerald-500 hover:text-emerald-700" aria-label="Dismiss message"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" /> {errorMsg}
          <button onClick={() => setErrorMsg("")} className="ml-auto text-rose-500 hover:text-rose-700" aria-label="Dismiss error"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ─── Loading State ─── */}
      {loading ? (
        <div className="py-16 text-center" aria-live="polite">
          <Loader2 className="w-6 h-6 text-purple-600 animate-spin mx-auto" aria-hidden="true" />
          <p className="text-sm text-slate-400 mt-3">Loading your channels...</p>
        </div>
      ) : (
        <>
          {/* ═══ Platform Cards ═══ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels.map((ch) => {
              const info = PLATFORM_INFO[ch.platform];
              const connectedAccounts = ch.connectedAccounts || (ch.connection ? [ch.connection] : []);
              const activeCount = connectedAccounts.filter((c: any) => c.status === "CONNECTED").length;
              const isConnected = activeCount > 0;
              const isPending = ch.connection?.status === "PENDING_APPROVAL" || info?.approvalRequired;
              const isPlanBlocked = entitlement && !entitlement.allowedPlatforms.includes(ch.platform);
              const canAddAnother = entitlement?.canConnectAnother && !isPlanBlocked;

              return (
                <article
                  key={ch.platform}
                  className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 transition-all hover:shadow-md ${
                    isConnected ? "border-emerald-200" : isPending ? "border-amber-200" : isPlanBlocked ? "border-slate-200 opacity-90" : "border-slate-200"
                  }`}
                  aria-label={`${ch.name} channel card`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl ${info?.bgColor || "bg-slate-50"} flex items-center justify-center shrink-0`} aria-hidden="true">
                        {info?.icon || <MessageSquare className="w-5 h-5 text-slate-400" />}
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-bold text-slate-900 text-sm">{ch.name}</h2>
                        <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                          {info?.description || ch.officialProduct}
                        </p>
                      </div>
                    </div>
                    {isPlanBlocked ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                        {ch.minPlanTier} Plan Required
                      </span>
                    ) : (
                      getStatusBadge(ch)
                    )}
                  </div>

                  {/* Connected Accounts List */}
                  {connectedAccounts.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                        Connected Accounts ({connectedAccounts.length}):
                      </p>
                      <div className="space-y-2">
                        {connectedAccounts.map((acc: any) => {
                          const isReauth = acc.status === "NEEDS_REAUTH";
                          const isMismatch = acc.status === "ACCOUNT_MISMATCH";
                          const isMissingPerm = acc.status === "MISSING_PERMISSION";
                          const isPendingValidation = acc.status === "PENDING_VALIDATION";
                          const isPendingApproval = acc.status === "PENDING_APPROVAL";
                          const isError = acc.status === "ERROR";
                          const isSuspended = acc.status === "SUSPENDED_BY_PLAN";
                          const isActive = acc.status === "CONNECTED";
                          const isDisconnected = acc.status === "DISCONNECTED";
                          const isTestingThisAcc = testingPlatform === `${ch.platform}_${acc.id}`;
                          const isAttentionNeeded = isReauth || isMismatch || isMissingPerm || isError;

                          return (
                            <div
                              key={acc.id}
                              className={`rounded-xl p-3 border space-y-2 ${
                                isAttentionNeeded
                                  ? "bg-rose-50/70 border-rose-200"
                                  : isPendingApproval || isSuspended
                                  ? "bg-amber-50/70 border-amber-200"
                                  : isPendingValidation
                                  ? "bg-blue-50/70 border-blue-200"
                                  : isDisconnected
                                  ? "bg-slate-50 border-slate-200 opacity-80"
                                  : "bg-emerald-50/60 border-emerald-100"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    {isAttentionNeeded ? (
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" aria-hidden="true" />
                                    ) : isPendingApproval || isSuspended ? (
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                                    ) : isPendingValidation ? (
                                      <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" aria-hidden="true" />
                                    ) : isActive ? (
                                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                                    ) : (
                                      <Circle className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                                    )}
                                    <span className={`font-bold text-xs truncate ${isAttentionNeeded ? "text-rose-950" : isActive ? "text-emerald-950" : "text-slate-800"}`}>
                                      {acc.platformAccountName}
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        isActive
                                          ? "bg-emerald-200/60 text-emerald-800"
                                          : isReauth
                                          ? "bg-rose-200 text-rose-900 border border-rose-300"
                                          : isMismatch
                                          ? "bg-amber-200 text-amber-900 border border-amber-300"
                                          : isMissingPerm
                                          ? "bg-amber-200 text-amber-900 border border-amber-300"
                                          : isPendingValidation
                                          ? "bg-blue-200 text-blue-900"
                                          : isPendingApproval
                                          ? "bg-amber-200 text-amber-800"
                                          : isError
                                          ? "bg-rose-200 text-rose-900 border border-rose-300"
                                          : isSuspended
                                          ? "bg-amber-200 text-amber-800"
                                          : isDisconnected
                                          ? "bg-slate-200 text-slate-700"
                                          : "bg-slate-200 text-slate-700"
                                      }`}
                                    >
                                      {isActive
                                        ? "Connected & Verified"
                                        : isReauth
                                        ? "Reauthentication Required"
                                        : isMismatch
                                        ? "Account Mismatch"
                                        : isMissingPerm
                                        ? "Permission Required"
                                        : isPendingValidation
                                        ? "Validating..."
                                        : isPendingApproval
                                        ? "Approval Required"
                                        : isError
                                        ? "Connection Error"
                                        : isSuspended
                                        ? "Plan Suspended"
                                        : isDisconnected
                                        ? "Disconnected"
                                        : acc.status}
                                    </span>
                                  </div>
                                  <div className={`flex items-center gap-3 text-[10px] mt-1 pl-5 ${isAttentionNeeded ? "text-rose-700" : isActive ? "text-emerald-700" : "text-slate-500"}`}>
                                    <span>ID: {acc.platformAccountId}</span>
                                    {acc.lastSyncAt && (
                                      <span>Last Checked: {new Date(acc.lastSyncAt).toLocaleString()}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Per-Account Test Button */}
                                  {!isDisconnected && (
                                    <button
                                      onClick={() => handleTestConnection(ch, acc.id)}
                                      disabled={isTestingThisAcc}
                                      className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold px-2.5 py-1 rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                                      aria-label={`Test connection for ${acc.platformAccountName}`}
                                    >
                                      {isTestingThisAcc ? (
                                        <><Loader2 className="w-3 h-3 animate-spin" /> Testing</>
                                      ) : (
                                        <><Wifi className="w-3 h-3" /> Test</>
                                      )}
                                    </button>
                                  )}

                                  {/* Reconnect Button */}
                                  {(isAttentionNeeded || isDisconnected) && (
                                    <button
                                      onClick={() => openWizard(ch, acc.platformAccountName, acc.platformAccountId)}
                                      className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1 rounded shadow-sm transition-colors flex items-center gap-1"
                                      aria-label={`Reconnect ${acc.platformAccountName}`}
                                    >
                                      <RefreshCw className="w-3 h-3" /> Reconnect
                                    </button>
                                  )}

                                  {/* Disconnect or Remove Button */}
                                  {!isDisconnected ? (
                                    <button
                                      onClick={() =>
                                        setDisconnectTarget({
                                          connectionId: acc.id,
                                          accountName: acc.platformAccountName,
                                          platform: ch.platform,
                                        })
                                      }
                                      className="text-xs text-slate-500 hover:text-rose-600 font-semibold px-2 py-1 rounded border border-slate-200 hover:border-rose-200 hover:bg-rose-50 transition-colors"
                                      aria-label={`Disconnect ${acc.platformAccountName}`}
                                    >
                                      Disconnect
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleRemoveRecord(acc.id, acc.platformAccountName)}
                                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded border border-rose-200 hover:bg-rose-50 transition-colors"
                                      aria-label={`Remove record for ${acc.platformAccountName}`}
                                    >
                                      Remove Record
                                    </button>
                                  )}
                                </div>
                              </div>

                              {isAttentionNeeded && (
                                <p className="text-[11px] text-rose-800 font-medium pl-5">
                                  {acc.statusMessage || (isMismatch
                                    ? "Meta account identity does not match this connection record. Reconnect to sync."
                                    : isMissingPerm
                                    ? "Required permissions missing. Reconnect and grant requested scopes."
                                    : "Your platform access token is invalid or expired. Reconnect your account to restore live API access.")}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Features: What you can do */}
                  {info && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">What you can do:</p>
                      {info.features.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
                          {f}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
                    {isPlanBlocked ? (
                      <Link
                        href="/pricing"
                        className="w-full px-3 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5" /> Upgrade to {ch.minPlanTier} Plan
                      </Link>
                    ) : isConnected ? (
                      <>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTestConnection(ch, ch.connection?.id)}
                            disabled={Boolean(testingPlatform === ch.platform || (ch.connection?.id && testingPlatform === `${ch.platform}_${ch.connection?.id}`))}
                            className="flex-1 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                            aria-label={`Test ${ch.name} connection`}
                          >
                            {testingPlatform === ch.platform || (ch.connection?.id && testingPlatform === `${ch.platform}_${ch.connection?.id}`) ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Testing...</>
                            ) : (
                              <><Wifi className="w-3.5 h-3.5" aria-hidden="true" /> Test Connection</>
                            )}
                          </button>
                          <Link
                            href="/inbox"
                            className="px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold hover:bg-purple-100 flex items-center gap-1.5 transition-colors"
                            aria-label="Open Messages"
                          >
                            <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" /> Messages
                          </Link>
                        </div>
                        {canAddAnother && (
                          <button
                            onClick={() => openWizard(ch)}
                            className="w-full px-3 py-2 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-xs font-bold hover:bg-purple-100 flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" /> Connect Another {ch.name.split("/")[0].trim()} Account
                          </button>
                        )}
                      </>
                    ) : isPending ? (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => openGuide(ch)}
                          className="w-full px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 flex items-center justify-center gap-1.5 transition-colors"
                          aria-label={`Learn about ${ch.name} requirements`}
                        >
                          <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" /> Learn About Requirements
                        </button>
                        <button
                          onClick={() => openWizard(ch)}
                          className="w-full px-3 py-2.5 rounded-lg border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-50 flex items-center justify-center gap-1.5 transition-colors"
                          aria-label={`Check eligibility for ${ch.name}`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> Check Eligibility
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => openWizard(ch)}
                          className="w-full px-3 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                          aria-label={`Connect ${ch.name}`}
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Connect {ch.name}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* ═══ How Messages Become Orders ═══ */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <button
              onClick={() => setShowWorkflow(!showWorkflow)}
              className="w-full flex items-center justify-between text-left"
              aria-expanded={showWorkflow}
              aria-controls="workflow-section"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center" aria-hidden="true">
                  <ShoppingCart className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">How your messages become orders</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Understand why connecting channels matters for your business</p>
                </div>
              </div>
              {showWorkflow ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>

            {showWorkflow && (
              <div id="workflow-section" className="mt-4 pt-4 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { icon: <Send className="w-4 h-4" />, label: "Customer sends message", desc: "Via Facebook, Instagram, WhatsApp, or TikTok", color: "bg-blue-50 text-blue-600" },
                    { icon: <Inbox className="w-4 h-4" />, label: "Message appears in BizPilot", desc: "In your Messages inbox, organized by customer", color: "bg-purple-50 text-purple-600" },
                    { icon: <Users className="w-4 h-4" />, label: "You reply & confirm", desc: "Answer questions, confirm availability, negotiate", color: "bg-emerald-50 text-emerald-600" },
                    { icon: <ShoppingCart className="w-4 h-4" />, label: "Create order", desc: "Convert conversation into a tracked order", color: "bg-amber-50 text-amber-600" },
                  ].map((step, i) => (
                    <div key={i} className="relative p-3 rounded-xl bg-slate-50 border border-slate-100 text-center space-y-2">
                      <div className={`w-8 h-8 rounded-lg ${step.color} flex items-center justify-center mx-auto`} aria-hidden="true">
                        {step.icon}
                      </div>
                      <p className="text-xs font-bold text-slate-800">{step.label}</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{step.desc}</p>
                      {i < 3 && (
                        <ArrowRight className="w-4 h-4 text-slate-300 absolute -right-3.5 top-1/2 -translate-y-1/2 hidden lg:block" aria-hidden="true" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ═══ Simulator Callout ═══ */}
          <div className="bg-slate-900 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-white">
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold">Test without real connections</p>
                <p className="text-xs text-slate-400">Use the Simulator to practice with test messages. Simulator data is clearly labeled and separate from real conversations.</p>
              </div>
            </div>
            <Link href="/simulator" className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition-colors shrink-0">
              Open Simulator
            </Link>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════════════════════════ */}

      {/* ─── CONNECTION WIZARD MODAL ─── */}
      {modalView === "wizard" && wizardChannel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={`Connect ${wizardChannel.name}`}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 my-8">

            {/* Wizard Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${PLATFORM_INFO[wizardChannel.platform]?.bgColor || "bg-slate-50"} flex items-center justify-center`} aria-hidden="true">
                  {PLATFORM_INFO[wizardChannel.platform]?.icon || <MessageSquare className="w-5 h-5 text-slate-400" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {wizardStep === "success" ? `${wizardChannel.name} Connected!` : `Connect ${wizardChannel.name}`}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {wizardStep === "info" && "Step 1 — Let's get your account ready"}
                    {wizardStep === "requirements" && "Step 2 — What you need"}
                    {wizardStep === "connect" && "Step 3 — Connect your platform"}
                    {wizardStep === "verifying" && "Setting up connection..."}
                    {wizardStep === "success" && "Connection successful!"}
                    {wizardStep === "error" && "Connection couldn't be completed"}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close wizard"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Progress Indicator */}
            {["info", "requirements", "connect"].includes(wizardStep) && (
              <div className="flex gap-1.5" aria-label="Progress">
                {["info", "requirements", "connect"].map((step, i) => (
                  <div
                    key={step}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i <= ["info", "requirements", "connect"].indexOf(wizardStep) ? "bg-purple-500" : "bg-slate-200"
                    }`}
                    aria-hidden="true"
                  />
                ))}
              </div>
            )}

            {/* Step: Info */}
            {wizardStep === "info" && (
              <div className="space-y-4">
                <div className={`p-4 rounded-xl ${PLATFORM_INFO[wizardChannel.platform]?.bgColor || "bg-slate-50"} border ${PLATFORM_INFO[wizardChannel.platform]?.borderColor || "border-slate-200"}`}>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    {PLATFORM_INFO[wizardChannel.platform]?.description}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-700 mb-2">What BizPilot can do with this channel:</p>
                  <div className="space-y-1.5">
                    {PLATFORM_INFO[wizardChannel.platform]?.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" /> {f}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Permission explanation */}
                <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-800 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{PLATFORM_INFO[wizardChannel.platform]?.permissionExplanation}</span>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button onClick={closeModal} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button onClick={() => setWizardStep("requirements")} className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5">
                    Continue <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {/* Step: Requirements */}
            {wizardStep === "requirements" && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold text-slate-700 mb-2">Before you connect, make sure you have:</p>
                  <div className="space-y-2">
                    {PLATFORM_INFO[wizardChannel.platform]?.requirements.map((r, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-slate-700 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</div>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {PLATFORM_INFO[wizardChannel.platform]?.approvalRequired && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> Platform Approval Required</p>
                    <p className="mt-1">This integration requires approval from the platform before it can be connected. The process may take several days.</p>
                  </div>
                )}

                <div className="flex justify-between gap-2 pt-2 border-t border-slate-100">
                  <button onClick={() => setWizardStep("info")} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1">
                    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back
                  </button>
                  <button onClick={() => setWizardStep("connect")} className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5">
                    {PLATFORM_INFO[wizardChannel.platform]?.approvalRequired ? "Continue Anyway" : "I\u0027m Ready"} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {/* Step: Connect */}
            {wizardStep === "connect" && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-800 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>BizPilot only requests the permissions needed to receive messages. Your data stays private.</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="accountName" className="block text-xs font-semibold text-slate-700 mb-1">Your Account or Page Name *</label>
                    <input
                      id="accountName"
                      type="text"
                      required
                      placeholder={`e.g. ${wizardChannel.name === "WhatsApp Business" ? "My Business +63 912 345 6789" : "BizPilot"}`}
                      value={formData.accountName}
                      onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      aria-required="true"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">The name of your business Page or account on this platform.</p>
                  </div>

                  <div>
                    <label htmlFor="accessToken" className="block text-xs font-semibold text-slate-700 mb-1">
                      {wizardChannel.platform === "FACEBOOK" || wizardChannel.platform === "INSTAGRAM" ? "Page Access Token" : "Platform Access Token"}
                    </label>
                    <input
                      id="accessToken"
                      type="password"
                      placeholder="Paste token (starts with EAAB... or sim_ for test mode)"
                      value={formData.accessToken}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, accessToken: val });
                      }}
                      className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Generated from Meta Developer portal (Messenger → API Setup → Generate Token).</p>
                  </div>

                  <details className="group">
                    <summary className="text-[11px] font-semibold text-slate-500 cursor-pointer hover:text-purple-600 flex items-center gap-1 list-none">
                      <Settings className="w-3 h-3" aria-hidden="true" /> Advanced: Account / Page ID (optional)
                    </summary>
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="Leave blank for auto-detection from token"
                        value={formData.accountId}
                        onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        aria-label="Platform account ID"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Automatically discovered if your Page Access Token is provided.</p>
                    </div>
                  </details>
                </div>

                <div className="flex justify-between gap-2 pt-2 border-t border-slate-100">
                  <button onClick={() => setWizardStep("requirements")} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1">
                    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back
                  </button>
                  <button
                    onClick={handleWizardConnect}
                    disabled={saving || !formData.accountName.trim()}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                    aria-label="Connect now"
                  >
                    <Zap className="w-3.5 h-3.5" aria-hidden="true" /> Connect Now
                  </button>
                </div>
              </div>
            )}

            {/* Step: Verifying */}
            {wizardStep === "verifying" && (
              <div className="py-6 space-y-4 text-center" aria-live="polite">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" aria-hidden="true" />
                <div className="space-y-2 text-xs text-slate-600">
                  <p className="font-semibold text-slate-800">Setting up your connection...</p>
                  <div className="space-y-2 text-left max-w-xs mx-auto">
                    <div className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" /> <span>Account identified</span></div>
                    <div className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" /> <span>Configuring webhook</span></div>
                    <div className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 text-purple-500 animate-spin" aria-hidden="true" /> <span>Verifying connection</span></div>
                    <div className="flex items-center gap-2 text-slate-400"><Circle className="w-3.5 h-3.5" aria-hidden="true" /> <span>Testing message receiving</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* Step: Success */}
            {wizardStep === "success" && (
              <div className="py-4 space-y-4 text-center" aria-live="polite">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-7 h-7 text-emerald-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{wizardChannel.name} is now connected!</p>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">Customer messages from this platform will appear in your Messages.</p>
                </div>

                {/* Next steps */}
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 text-left space-y-1.5">
                  <p className="font-bold">What to do next:</p>
                  <div className="flex items-start gap-2"><span className="font-bold text-emerald-600">1.</span> Send a test message from {wizardChannel.name.split("/")[0].trim()} to your connected account.</div>
                  <div className="flex items-start gap-2"><span className="font-bold text-emerald-600">2.</span> Open Messages in BizPilot and confirm it appears.</div>
                  <div className="flex items-start gap-2"><span className="font-bold text-emerald-600">3.</span> Start responding to customers from one place!</div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Link
                    href="/inbox"
                    onClick={closeModal}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg text-center flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" /> Go to Messages
                  </Link>
                  <button
                    onClick={closeModal}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* Step: Error */}
            {wizardStep === "error" && (
              <div className="py-4 space-y-4 text-center" aria-live="polite">
                <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-7 h-7 text-rose-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Connection couldn&apos;t be completed</p>
                  <p className="text-xs text-rose-600 font-medium mt-1 leading-relaxed px-2">
                    {errorMsg || "Something went wrong. Please try again."}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 text-left space-y-2">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-purple-600" /> Actionable Fix:
                  </p>
                  {errorMsg.toLowerCase().includes("pages_read_engagement") || errorMsg.toLowerCase().includes("permission") || errorMsg.toLowerCase().includes("#100") ? (
                    <div className="space-y-1 text-slate-600">
                      <p>• In Meta Developer Portal, go to <strong>Messenger → API Setup</strong>.</p>
                      <p>• Under <strong>Generate access tokens</strong>, click <strong>Generate</strong> next to your Page.</p>
                      <p>• Copy and paste the freshly generated Page Token into BizPilot.</p>
                    </div>
                  ) : errorMsg.toLowerCase().includes("oauth") || errorMsg.toLowerCase().includes("token") || errorMsg.toLowerCase().includes("signature") ? (
                    <div className="space-y-1 text-slate-600">
                      <p>• Your Page Access Token is invalid, expired, or malformed.</p>
                      <p>• Generate a fresh Page token from Meta Developer App (Messenger API Setup).</p>
                      <p>• Ensure the full token string starting with <code>EAA...</code> is pasted.</p>
                    </div>
                  ) : (
                    <div className="space-y-1 text-slate-600">
                      <p>• Verify your Page numeric ID and token in Meta App Dashboard.</p>
                      <p>• Check that your user account has Admin/Owner role on the Facebook Page.</p>
                      <p>• Click Try Again to re-run live validation.</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setWizardStep("connect")} className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors">
                    Try Again
                  </button>
                  <button onClick={closeModal} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── CONNECTION GUIDE MODAL ─── */}
      {modalView === "guide" && activeChannel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={`Connection guide for ${activeChannel.name}`}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 my-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${PLATFORM_INFO[activeChannel.platform]?.bgColor || "bg-slate-50"} flex items-center justify-center`} aria-hidden="true">
                  {PLATFORM_INFO[activeChannel.platform]?.icon}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{PLATFORM_INFO[activeChannel.platform]?.connectionGuide.title}</h3>
                  <p className="text-[11px] text-slate-500">Step-by-step guide</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Close guide">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {PLATFORM_INFO[activeChannel.platform]?.connectionGuide.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed pt-0.5">{step}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button onClick={closeModal} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
                Close
              </button>
              <button
                onClick={() => { closeModal(); openWizard(activeChannel); }}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" aria-hidden="true" /> Start Connecting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TROUBLESHOOTING MODAL ─── */}
      {modalView === "troubleshooting" && activeChannel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={`Troubleshooting for ${activeChannel.name}`}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 my-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${PLATFORM_INFO[activeChannel.platform]?.bgColor || "bg-slate-50"} flex items-center justify-center`} aria-hidden="true">
                  {PLATFORM_INFO[activeChannel.platform]?.icon}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Troubleshooting {activeChannel.name}</h3>
                  <p className="text-[11px] text-slate-500">Common problems and solutions</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Close troubleshooting">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {PLATFORM_INFO[activeChannel.platform]?.troubleshooting.map((item, i) => (
                <div key={i} className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                    {item.problem}
                  </h4>
                  <div className="space-y-1.5 pl-5">
                    {item.solutions.map((sol, j) => (
                      <div key={j} className="flex items-start gap-2 text-xs text-slate-600">
                        <span className="font-bold text-slate-400 shrink-0">{j + 1}.</span>
                        <span>{sol}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { closeModal(); openWizard(activeChannel); }}
                  className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Try Reconnecting
                </button>
                <button
                  onClick={() => { closeModal(); handleTestConnection(activeChannel); }}
                  className="flex-1 px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  Test Connection
                </button>
              </div>
              <button onClick={closeModal} className="w-full px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TEST RESULT MODAL ─── */}
      {modalView === "testResult" && activeChannel && testResponse && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={`Test results for ${activeChannel.name}`}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 my-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${testResponse.overallPassed ? "bg-emerald-50" : "bg-amber-50"} flex items-center justify-center`} aria-hidden="true">
                  {testResponse.overallPassed ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {testResponse.overallPassed ? "Connection Healthy" : "Connection Needs Attention"}
                  </h3>
                  <p className="text-[11px] text-slate-500">{activeChannel.name} test results</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Close test results">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Friendly message */}
            <div className={`p-3 rounded-lg text-xs ${testResponse.overallPassed ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-amber-50 border border-amber-200 text-amber-800"}`}>
              <p className="font-semibold">{testResponse.friendlyMessage}</p>
            </div>

            {/* Test steps */}
            <div className="space-y-2">
              {testResponse.results.map((r, i) => (
                <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${r.passed ? "bg-emerald-50/50 border-emerald-100" : "bg-rose-50/50 border-rose-100"}`}>
                  {r.passed ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <div>
                    <p className={`text-xs font-semibold ${r.passed ? "text-emerald-800" : "text-rose-800"}`}>{r.step}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">{r.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Send test message suggestion */}
            {testResponse.overallPassed && (
              <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-xs text-purple-800">
                <p className="font-bold">Want to fully verify?</p>
                <p className="mt-1">Send a message from {activeChannel.name.split("/")[0].trim()} to your connected account, then check Messages in BizPilot.</p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
              {!testResponse.overallPassed ? (
                <>
                  <button
                    onClick={() => {
                      closeModal();
                      openWizard(activeChannel, testResponse.connectionInfo?.accountName, testResponse.connectionInfo?.accountId);
                    }}
                    className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reconnect {activeChannel.name.split("/")[0].trim()}
                  </button>
                  <button
                    onClick={() => { closeModal(); openTroubleshooting(activeChannel); }}
                    className="px-3 py-2.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    Troubleshooting
                  </button>
                </>
              ) : (
                <Link
                  href="/inbox"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg text-center transition-colors"
                >
                  Open Messages
                </Link>
              )}
              <button onClick={closeModal} className="px-4 py-2.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CHANNEL SETUP GUIDE MODAL ─── */}
      {showSetupGuide && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Channel Setup Guide">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 my-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center" aria-hidden="true">
                  <BookOpen className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Channel Setup Guide</h3>
                  <p className="text-[11px] text-slate-500">How to connect a messaging platform to BizPilot</p>
                </div>
              </div>
              <button onClick={() => setShowSetupGuide(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Close setup guide">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {[
                { step: 1, title: "Choose your platform", desc: "Pick where your customers message you: Facebook, Instagram, WhatsApp, or TikTok." },
                { step: 2, title: "Check the requirements", desc: "Make sure you have access to your business account on that platform." },
                { step: 3, title: "Connect the platform", desc: "Click the Connect button and enter your account name." },
                { step: 4, title: "Approve permissions", desc: "BizPilot will only request what it needs to receive your messages." },
                { step: 5, title: "Test the connection", desc: "Click Test Connection to verify everything is working." },
                { step: 6, title: "Send a test message", desc: "Send a message from the platform to your connected account." },
                { step: 7, title: "Confirm in Messages", desc: "Open Messages in BizPilot and confirm the test message appeared." },
                { step: 8, title: "Start managing conversations", desc: "All future customer messages will appear in your BizPilot inbox." },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{item.title}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button onClick={() => setShowSetupGuide(false)} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors">
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DISCONNECT CONFIRMATION MODAL ─── */}
      {disconnectTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Disconnect ${disconnectTarget.accountName}`}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${PLATFORM_INFO[disconnectTarget.platform]?.bgColor || "bg-slate-50"} flex items-center justify-center`} aria-hidden="true">
                {PLATFORM_INFO[disconnectTarget.platform]?.icon}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Disconnect {disconnectTarget.accountName}?</h3>
                <p className="text-[11px] text-slate-500">{PLATFORM_INFO[disconnectTarget.platform]?.description || disconnectTarget.platform}</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-2">
              <p className="font-semibold">What happens when you disconnect:</p>
              <ul className="space-y-1 pl-4 list-disc text-amber-700">
                <li>BizPilot will stop receiving new messages from this account</li>
                <li>Your existing conversations, messages, and orders remain safely in BizPilot</li>
                <li>Customer history and CRM links are not deleted</li>
                <li>Frees 1 channel slot on your subscription plan</li>
                <li>You can reconnect this account at any time</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setDisconnectTarget(null)} className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={saving}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
              >
                {saving ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
