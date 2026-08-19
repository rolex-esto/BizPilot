import React from "react";
import {
  BookOpen,
  Store,
  Package,
  Inbox,
  ShoppingBag,
  CreditCard,
  Calendar,
  Sparkles,
  ArrowRight,
  Truck,
  Users,
  Radio,
  HelpCircle,
  CheckCircle,
  CheckCircle2,
  MessageSquare,
  Tag,
  Settings,
  ShieldCheck,
  Bell,
  Check,
} from "lucide-react";
import Link from "next/link";

interface GuideStep {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  link: string;
  linkLabel: string;
  tips: string[];
}

const GUIDE_STEPS: GuideStep[] = [
  {
    number: 1,
    title: "Set Up Your Business",
    description: "Start by entering your business name, description, and contact info so customers see the correct details on orders and receipts.",
    icon: <Store className="w-5 h-5" />,
    color: "text-sky-700",
    bgColor: "bg-sky-50 border-sky-200",
    link: "/settings",
    linkLabel: "Set Up Business",
    tips: [
      "No physical store needed — BizPilot supports fully online sellers",
      "Add your store name and description under Settings",
      "Upload your business logo for instant brand recognition",
    ],
  },
  {
    number: 2,
    title: "Add Products",
    description: "Add the items you sell with their prices and stock quantities. BizPilot tracks stock automatically as orders are completed.",
    icon: <Package className="w-5 h-5" />,
    color: "text-amber-700",
    bgColor: "bg-amber-50 border-amber-200",
    link: "/inventory",
    linkLabel: "Manage Products",
    tips: [
      "Enter the product name, price, and how many you have in stock",
      "Set a 'Low Stock Alert' so you know when it's time to reorder",
      "Organize items into categories for fast customer lookups",
    ],
  },
  {
    number: 3,
    title: "Connect Channels & Manage Inquiries",
    description: "Connect Facebook Messenger, Instagram Direct, WhatsApp Cloud API, and TikTok to receive and reply to all buyer inquiries in one centralized Inbox.",
    icon: <Radio className="w-5 h-5" />,
    color: "text-purple-700",
    bgColor: "bg-purple-50 border-purple-200",
    link: "/channels",
    linkLabel: "Manage Channels",
    tips: [
      "Follow real step-by-step connection guides for Meta Graph API & WhatsApp Cloud API under Channels (/channels)",
      "Set your Webhook Callback URLs (/api/webhooks/meta and /api/webhooks/whatsapp) and Verify Tokens in Meta Developers",
      "Practice chatting, negotiating, and testing 1-click orders with the Developer Simulator before going live",
      "All messages across connected accounts appear in your Unified Inbox with grounded AI reply suggestions",
    ],
  },
  {
    number: 4,
    title: "Create Orders",
    description: "Create customer orders directly from chat messages in 1-click. Select delivery methods and specify agreed pricing.",
    icon: <ShoppingBag className="w-5 h-5" />,
    color: "text-emerald-700",
    bgColor: "bg-emerald-50 border-emerald-200",
    link: "/orders",
    linkLabel: "View Orders",
    tips: [
      "Click '1-Click Order' in any chat to lock in items and customer details",
      "Discounts given to buyers are recorded without affecting official prices",
      "Choose delivery: Customer Meetup, LBC, Grab, Lalamove, or Direct Delivery",
    ],
  },
  {
    number: 5,
    title: "Verify Payments",
    description: "Keep track of customer payments via GCash, Maya, Bank Transfer, Cash, or COD with manual receipt verification.",
    icon: <CreditCard className="w-5 h-5" />,
    color: "text-indigo-700",
    bgColor: "bg-indigo-50 border-indigo-200",
    link: "/orders",
    linkLabel: "Verify Payments",
    tips: [
      "Verify GCash and Maya reference numbers before marking as Paid",
      "COD orders remain 'Unpaid' until cash is remitted by the courier",
      "Avoid lost payments with clear payment status badges",
    ],
  },
  {
    number: 6,
    title: "Schedule Business Operations",
    description: "Your Operations Calendar keeps track of scheduled customer meetups, LBC drop-off deadlines, and courier pickups.",
    icon: <Calendar className="w-5 h-5" />,
    color: "text-rose-700",
    bgColor: "bg-rose-50 border-rose-200",
    link: "/calendar",
    linkLabel: "Open Calendar",
    tips: [
      "Meetup schedules are automatically added when creating orders",
      "Set reminders for courier dispatches and LBC branch drop-offs",
      "Avoid double-booking or missing customer meetups",
    ],
  },
  {
    number: 7,
    title: "Complete Orders",
    description: "Finish orders after handover or delivery. Completing an order automatically decrements product stock safely.",
    icon: <CheckCircle2 className="w-5 h-5" />,
    color: "text-teal-700",
    bgColor: "bg-teal-50 border-teal-200",
    link: "/orders",
    linkLabel: "Track Orders",
    tips: [
      "Mark orders 'Delivered' after customer receipt",
      "Inventory is decremented safely with zero overselling risk",
      "Track your monthly order volume towards your plan limits",
    ],
  },
  {
    number: 8,
    title: "Manage Your Account & Settings",
    description: "Keep your account information, business details, notifications, login security, and plan subscription up to date.",
    icon: <Settings className="w-5 h-5" />,
    color: "text-violet-700",
    bgColor: "bg-violet-50 border-violet-200",
    link: "/settings",
    linkLabel: "Open Settings",
    tips: [
      "Check your personal account details and verified email address",
      "Update your business profile, logo, delivery, and payment options",
      "Choose which email notifications you receive",
      "Change your password and review active device logins",
      "Check your 30-day trial status and explore plan options",
    ],
  },
];

const FAQ_ITEMS = [
  {
    q: "Do I need a physical store to use BizPilot?",
    a: "No. BizPilot is designed for online sellers who use social media, meetups, couriers, and shipping — no physical shop required.",
  },
  {
    q: "What payment methods can my customers use?",
    a: "GCash, Maya, bank transfer, cash on meetup, and Cash on Delivery (COD). You can choose which methods to enable in Settings.",
  },
  {
    q: "How do I deliver orders to customers?",
    a: "You have five options: customer meetups at public locations, LBC express shipping, on-demand couriers (Grab / Lalamove), or direct delivery.",
  },
  {
    q: "Will my prices change if I give a customer a discount?",
    a: "No. Your catalog price stays the same. The discount is recorded only on that specific order, so your official prices are never affected.",
  },
  {
    q: "What if I run out of stock?",
    a: "BizPilot will show a 'Low Stock' alert on your dashboard when a product drops below your safety threshold. You can update stock in Inventory.",
  },
  {
    q: "Can other businesses see my products or customers?",
    a: "Never. Each business account has strict tenant data isolation. Your data is 100% private and accessible only to you.",
  },
  {
    q: "How do I change my password or email?",
    a: "Go to Settings (/settings). You can change your password under Security, or update your name and email under My Account with secure 2-step verification.",
  },
];

export default function GuidePage() {
  return (
    <div className="space-y-8 pb-16 max-w-4xl mx-auto px-4 sm:px-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-sky-600 via-indigo-700 to-purple-800 text-white p-6 sm:p-8 rounded-3xl shadow-lg">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-bold border border-white/20">
            <BookOpen className="w-3.5 h-3.5" /> BizPilot Owner Operations Guide
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Welcome to BizPilot
          </h1>
          <p className="text-xs sm:text-sm text-white/90 leading-relaxed max-w-2xl">
            BizPilot helps Philippine MSMEs and online sellers manage conversations, products, orders, payments, deliveries, and settings — all in one simple hub.
          </p>
        </div>
      </div>

      {/* Quick Overview */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          What You Can Do with BizPilot
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {[
            "Set up your store identity, logo, delivery, and payment options",
            "Manage products and track inventory with automatic stock decrements",
            "Receive customer inquiries from Facebook, Instagram, WhatsApp in one Inbox",
            "Negotiate prices and give discounts without breaking official catalog prices",
            "Create orders in 1-click directly from chat conversations",
            "Track payments (GCash, Maya, Bank Transfer, Cash, COD)",
            "Schedule customer meetups and deliveries on your Operations Calendar",
            "Protect your account with secure password and session settings",
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-slate-700">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 8-Step Main Guide */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-sky-600" />
            Step-by-Step: How to Run Your Store on BizPilot (8 Steps)
          </h2>
          <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
            Complete Operations Roadmap
          </span>
        </div>

        <div className="space-y-4">
          {GUIDE_STEPS.map((step) => (
            <div
              key={step.number}
              id={`step-${step.number}`}
              className={`bg-white rounded-2xl border p-5 shadow-xs space-y-3 ${step.bgColor}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${step.bgColor} flex items-center justify-center ${step.color}`}>
                    {step.icon}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase">Step {step.number}</p>
                    <h3 className="text-sm font-bold text-slate-900">{step.title}</h3>
                  </div>
                </div>
                <Link
                  href={step.link}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${step.color} ${step.bgColor} hover:opacity-80 flex items-center gap-1 shrink-0 border`}
                >
                  {step.linkLabel} <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed pl-[52px]">
                {step.description}
              </p>

              <div className="pl-[52px] space-y-1.5">
                {step.tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-slate-600">
                    <span className="text-slate-400 mt-0.5">•</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── STEP 8 DEEP DIVE & SETTINGS WALKTHROUGH ─── */}
      <div className="bg-white rounded-3xl border border-purple-200 p-6 sm:p-7 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-extrabold uppercase">
              <Settings className="w-3 h-3" /> Step 8 Walkthrough
            </div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight mt-1">
              Step 8 — Set Up Your Account & Settings
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Once your business is running, Settings helps you keep your account information, business details, notifications, and plan up to date.
            </p>
          </div>

          <Link
            href="/settings"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-sm"
          >
            <Settings className="w-3.5 h-3.5" />
            Open Settings Hub
          </Link>
        </div>

        {/* What Should I Do First Guide */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-purple-950">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>If you&apos;re new to BizPilot: What to configure first</span>
          </div>
          <p className="text-purple-900/90 text-[11px] leading-relaxed">
            You don&apos;t need to configure everything all at once. Follow this simple order:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-purple-900 font-medium pt-1">
            <li><strong>Complete My Business:</strong> Enter your store name and bio.</li>
            <li><strong>Add your logo:</strong> Upload a clear photo so buyers recognize your store.</li>
            <li><strong>Choose how customers pay:</strong> Select GCash, Maya, Bank Transfer, Cash, or COD.</li>
            <li><strong>Choose how you deliver orders:</strong> Select Meetup, LBC, Grab, or Lalamove.</li>
            <li><strong>Check Notifications:</strong> Pick which email updates you want.</li>
            <li><strong>Check Security:</strong> Create a strong password.</li>
            <li><strong>Review your Plan:</strong> See when your 30-day free trial ends.</li>
          </ol>
        </div>

        {/* Detailed Subsections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <span className="text-purple-600 font-extrabold">8.1</span> My Account
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Check your name, email, phone number, and email verification. Changing your email address sends a verification link to prevent unauthorized changes.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <span className="text-purple-600 font-extrabold">8.2</span> My Business
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Keep your business name, description, category, logo, and contact information updated. Online businesses do not need a physical shop address.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <span className="text-purple-600 font-extrabold">8.3</span> How You Deliver Orders
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Choose whether you normally use Customer Meetups, LBC nationwide shipping, Grab Express, Lalamove on-demand courier, or direct delivery.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <span className="text-purple-600 font-extrabold">8.4</span> How Customers Pay
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Select the payment methods you accept from buyers, such as GCash, Maya, Bank Transfer, Cash on meetup, or Cash on Delivery (COD).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <span className="text-purple-600 font-extrabold">8.5</span> Notifications
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Choose which business updates you want to receive (new orders, payments, messages, low stock alerts). Important security and billing emails remain enabled.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <span className="text-purple-600 font-extrabold">8.6</span> Security
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Change your password whenever you need to, review active device logins, and sign out of other devices with one click to keep your account safe.
            </p>
          </div>
        </div>

        {/* Subsection 8.7 */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
          <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
            <span className="text-purple-600 font-extrabold">8.7</span> My Plan & Live Resource Usage
          </h3>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Check your 30-day trial status, current plan (Starter, Business, Pro), and live product/order limits. Upgrades are manually verified via GCash, Maya, or bank deposit.
          </p>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-purple-600" />
          Frequently Asked Questions
        </h2>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <p className="text-xs font-bold text-slate-900">{item.q}</p>
              <p className="text-xs text-slate-600 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Help & Practice Footer */}
      <div className="text-center space-y-4 pt-2">
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-bold text-purple-900">Want to practice first?</p>
          <p className="text-xs text-purple-700 max-w-lg mx-auto leading-relaxed">
            Try a complete customer order without using real business data. You&apos;ll play both the customer and the owner.
          </p>
          <Link
            href="/simulator"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm"
          >
            <Users className="w-3.5 h-3.5" /> Open Practice Simulator
          </Link>
        </div>

        <p className="text-xs text-slate-500">
          Need more help? Your AI Assistant can answer questions about your business anytime.
        </p>
        <Link
          href="/copilot"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5" /> Ask AI Assistant
        </Link>
      </div>
    </div>
  );
}
