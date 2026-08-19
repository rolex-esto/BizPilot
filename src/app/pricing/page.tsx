"use client";

import React from "react";
import {
  CheckCircle,
  Sparkles,
  Radio,
  HelpCircle,
  Check,
  Minus,
  MessageSquare,
  ShoppingBag,
  CreditCard,
  Truck,
  Package,
  Calendar,
  Users,
} from "lucide-react";
import Link from "next/link";
import { PLANS as PLAN_CONFIG } from "@/lib/plans";
import { useAuth } from "@/context/AuthContext";

interface PlanItem {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  highlight: boolean;
  badge?: string;
  accountsSummary: string;
  features: string[];
}

const PLANS: PlanItem[] = [
  {
    id: "starter",
    name: PLAN_CONFIG.STARTER.name,
    price: PLAN_CONFIG.STARTER.price,
    period: "month",
    description: "For solo online sellers just getting started.",
    highlight: false,
    accountsSummary: "1 connected social account",
    features: [
      "Up to 50 products",
      "Up to 100 orders per month",
      "1 connected social account",
      "Customer messages across supported platforms",
      "GCash, Maya & COD payment tracking",
      "Meetup & delivery scheduling",
      "Basic AI Assistant",
      "Email support",
    ],
  },
  {
    id: "business",
    name: PLAN_CONFIG.BUSINESS.name,
    price: PLAN_CONFIG.BUSINESS.price,
    period: "month",
    description: "For growing online sellers with regular customers.",
    highlight: true,
    badge: "Most Popular",
    accountsSummary: "Up to 3 connected social accounts",
    features: [
      "Unlimited products",
      "Unlimited orders",
      "Up to 3 connected social accounts",
      "Customer messages across supported platforms",
      "GCash, Maya, Bank Transfer & COD tracking",
      "Meetup, LBC, Grab & Lalamove scheduling",
      "Full AI Assistant with business insights",
      "Category management & inventory alerts",
      "Low-stock warnings",
      "Priority support",
    ],
  },
  {
    id: "pro",
    name: PLAN_CONFIG.PRO.name,
    price: PLAN_CONFIG.PRO.price,
    period: "month",
    description: "For established sellers with multiple staff or high volume.",
    highlight: false,
    accountsSummary: "Unlimited connected social accounts*",
    features: [
      "Everything in Business",
      "Unlimited connected social accounts*",
      "Up to 10 staff member accounts",
      "Advanced sales & revenue reporting",
      "Custom categories & workflows",
      "API access for integrations",
      "Dedicated support manager",
      "Priority feature requests",
    ],
  },
];

const COMPARISON_ROWS = [
  {
    feature: "Monthly Price",
    starter: "₱499/mo",
    business: "₱999/mo",
    pro: "₱1,999/mo",
    isText: true,
  },
  {
    feature: "Connected social accounts",
    starter: "1 account",
    business: "Up to 3 accounts",
    pro: "Unlimited*",
    isText: true,
    bold: true,
  },
  {
    feature: "Products",
    starter: "50",
    business: "Unlimited",
    pro: "Unlimited",
    isText: true,
  },
  {
    feature: "Orders",
    starter: "100 / month",
    business: "Unlimited",
    pro: "Unlimited",
    isText: true,
  },
  {
    feature: "Customer messages",
    starter: "Supported platforms",
    business: "Supported platforms",
    pro: "Supported platforms",
    isText: true,
  },
  {
    feature: "Payment tracking",
    starter: "GCash, Maya, COD",
    business: "GCash, Maya, Bank Transfer, COD",
    pro: "Everything in Business",
    isText: true,
  },
  {
    feature: "Delivery scheduling",
    starter: "Meetup & delivery",
    business: "Meetup, LBC, Grab & Lalamove",
    pro: "Everything in Business",
    isText: true,
  },
  {
    feature: "AI Assistant",
    starter: "Basic Assistant",
    business: "Full AI + insights",
    pro: "Advanced",
    isText: true,
  },
  {
    feature: "Staff accounts",
    starter: "—",
    business: "—",
    pro: "Up to 10",
    isText: true,
  },
  {
    feature: "Reporting & analytics",
    starter: "Basic",
    business: "Business insights",
    pro: "Advanced",
    isText: true,
  },
  {
    feature: "API access for integrations",
    starter: false,
    business: false,
    pro: true,
    isText: false,
  },
  {
    feature: "Customer support",
    starter: "Email",
    business: "Priority",
    pro: "Dedicated manager",
    isText: true,
  },
];

const FAQ = [
  {
    q: "Can I connect more than one Facebook Page?",
    a: "It depends on your plan. Starter allows 1 connected account, Business allows up to 3, and Pro allows unlimited connected accounts, subject to platform limitations and approvals.",
  },
  {
    q: "What counts as a connected account?",
    a: "Each individual Facebook Page, Instagram account, WhatsApp Business account, TikTok account, or other supported account counts as one connected account.",
  },
  {
    q: "Can I replace my Facebook Page?",
    a: "Yes. You can connect another account and choose whether to keep your existing account or disconnect it. BizPilot will not silently disconnect your current account.",
  },
  {
    q: "What happens if I disconnect an account?",
    a: "New messages from that account will stop arriving in BizPilot, but your existing customers, conversations, orders, and historical business data remain safely available.",
  },
  {
    q: "What happens if I downgrade my plan?",
    a: "BizPilot will not delete your connected accounts or historical data. Accounts above your new plan's limit can be temporarily restricted until you choose which accounts to keep active or upgrade again.",
  },
  {
    q: "Can I upgrade later?",
    a: "Yes. You can change your plan from Account Settings. When you upgrade, previously restricted accounts may become eligible for reactivation.",
  },
  {
    q: "What happens after my 30-day trial?",
    a: "Your products, orders, customers, conversations, and historical business data remain safe. You simply choose a plan to continue using the features that require an active subscription.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. There are no lock-in contracts. You can cancel anytime and keep access according to the terms of your current billing period.",
  },
  {
    q: "Is my business data safe?",
    a: "Yes. BizPilot keeps each business's data strictly separated. Your products, orders, customers, and conversations are protected from other businesses.",
  },
  {
    q: "Can BizPilot access my personal social media conversations?",
    a: "No. BizPilot only accesses accounts and business assets that you explicitly authorize and connect. Connecting one business account does not automatically grant access to unrelated personal accounts or conversations.",
  },
];

export default function PricingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="space-y-12 max-w-5xl mx-auto pb-20 px-4 sm:px-6">
      {/* ─── Page Header ─── */}
      <div className="text-center space-y-3 pt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Simple, Transparent Plans for Philippine MSMEs
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Choose the plan that fits your business
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
          Start with a <strong>30-day free trial</strong> with full access to Business-tier features. No credit card required. Upgrade whenever you&apos;re ready.
        </p>
      </div>

      {/* ─── 30-Day Trial Banner ─── */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-md border border-purple-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/10">
            <Sparkles className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-sm sm:text-base">30-Day Free Trial for New Stores</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Business-Tier Access
              </span>
            </div>
            <p className="text-xs text-purple-200/90 mt-0.5">
              Try BizPilot with 3 connected accounts, unlimited products, and full AI insights. No credit card required.
            </p>
          </div>
        </div>
        <Link
          href={isAuthenticated ? "/settings" : "/login?mode=signup"}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5 self-start sm:self-auto shrink-0"
        >
          {isAuthenticated ? "Check Trial Status" : "Start 30-Day Free Trial"}
        </Link>
      </div>

      {/* ─── Plans Grid ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white rounded-3xl border p-6 sm:p-7 space-y-5 relative flex flex-col justify-between transition-all ${
              plan.highlight
                ? "border-purple-400 shadow-xl shadow-purple-500/10 ring-2 ring-purple-300"
                : "border-slate-200 shadow-xs hover:border-slate-300"
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-sm">
                {plan.badge}
              </span>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <h3 className="text-xl font-black text-slate-900">{plan.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed min-h-[32px]">{plan.description}</p>
              </div>

              <div className="flex items-baseline gap-1 pt-1">
                <span className="text-3xl font-black text-slate-900">₱{plan.price.toLocaleString("en-PH")}</span>
                <span className="text-xs text-slate-500 font-semibold">/{plan.period}</span>
              </div>

              {/* Connected Accounts Callout Badge */}
              <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 flex items-center gap-2">
                <Radio className="w-4 h-4 text-purple-600 shrink-0" />
                <span className="text-xs font-bold text-purple-950">{plan.accountsSummary}</span>
              </div>

              <Link
                href={isAuthenticated ? "/settings" : "/login?mode=signup"}
                className={`block w-full py-3 rounded-xl text-xs font-bold text-center transition-all ${
                  plan.highlight
                    ? "bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20"
                    : "bg-slate-900 hover:bg-slate-800 text-white"
                }`}
              >
                {isAuthenticated ? "Select Plan in Settings" : "Start Free Trial"}
              </Link>

              <div className="space-y-2.5 pt-4 border-t border-slate-100">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-slate-700">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 text-center font-medium">
              Manual GCash / Maya / Bank Transfer
            </div>
          </div>
        ))}
      </div>

      {/* Pro Plan Footnote */}
      <p className="text-center text-[11px] text-slate-500 max-w-2xl mx-auto -mt-4">
        *Unlimited connected accounts are subject to the actual limits, permissions, and approval requirements of each supported platform.
      </p>

      {/* ─── Simple Explanation for MSME Users ─── */}
      <div className="bg-gradient-to-br from-slate-50 to-purple-50/40 rounded-3xl border border-purple-100 p-6 sm:p-7 space-y-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              What counts as a connected account?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
              Each individual Facebook Page, Instagram account, WhatsApp Business account, TikTok account, or other supported account connected to BizPilot counts as one connected account.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Example Scenario:</span>
            <div className="space-y-1 text-xs text-slate-700 font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <span>Facebook Page A (Main Store)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <span>Facebook Page B (Outlet Branch)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Instagram Account A (@mystore)</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 text-xs font-bold text-purple-700">
              = 3 connected accounts <span className="font-normal text-slate-500">(across 2 platforms)</span>
            </div>
          </div>

          <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Account Switching vs Adding:</span>
            <p className="text-xs text-slate-600 leading-relaxed">
              Replacing a disconnected page with a new page does not require a plan upgrade. You only need a higher tier if you want multiple accounts active simultaneously.
            </p>
            <div className="pt-2 border-t border-slate-100 text-xs text-emerald-700 font-bold">
              ✓ Disconnecting frees up your account slot immediately.
            </div>
          </div>
        </div>
      </div>

      {/* ─── Plan Comparison Table ─── */}
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-black text-slate-900">Compare Plan Features</h2>
          <p className="text-xs text-slate-500">A detailed breakdown of limits and capabilities across all plans.</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75">
                  <th className="py-3.5 px-4 font-bold text-slate-900 w-2/5">Feature</th>
                  <th className="py-3.5 px-4 font-bold text-slate-900 text-center w-1/5">Starter</th>
                  <th className="py-3.5 px-4 font-bold text-purple-900 bg-purple-50/50 text-center w-1/5">Business</th>
                  <th className="py-3.5 px-4 font-bold text-slate-900 text-center w-1/5">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr key={idx} className={row.bold ? "bg-purple-50/30" : "hover:bg-slate-50/50 transition-colors"}>
                    <td className={`py-3 px-4 ${row.bold ? "font-bold text-purple-950" : "font-medium text-slate-700"}`}>
                      {row.feature}
                    </td>

                    {/* Starter */}
                    <td className={`py-3 px-4 text-center ${row.bold ? "font-bold text-slate-900" : "text-slate-600"}`}>
                      {row.isText ? (
                        row.starter
                      ) : row.starter ? (
                        <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <Minus className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>

                    {/* Business */}
                    <td className={`py-3 px-4 text-center bg-purple-50/20 ${row.bold ? "font-bold text-purple-900" : "text-slate-800 font-semibold"}`}>
                      {row.isText ? (
                        row.business
                      ) : row.business ? (
                        <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <Minus className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>

                    {/* Pro */}
                    <td className={`py-3 px-4 text-center ${row.bold ? "font-bold text-slate-900" : "text-slate-600"}`}>
                      {row.isText ? (
                        row.pro
                      ) : row.pro ? (
                        <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <Minus className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── Every BizPilot Plan Includes ─── */}
      <div className="bg-slate-50 rounded-3xl border border-slate-200 p-6 sm:p-7 space-y-4 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 text-center">Every BizPilot plan includes:</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-700">
          <div className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100 shadow-xs">
            <MessageSquare className="w-4 h-4 text-sky-500 shrink-0" />
            <span className="font-semibold">Customer messages</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100 shadow-xs">
            <ShoppingBag className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-semibold">Order management</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100 shadow-xs">
            <CreditCard className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="font-semibold">Payment tracking</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100 shadow-xs">
            <Truck className="w-4 h-4 text-purple-500 shrink-0" />
            <span className="font-semibold">Delivery scheduling</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100 shadow-xs">
            <Package className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold">Product inventory</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100 shadow-xs">
            <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="font-semibold">Operations calendar</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100 shadow-xs">
            <Users className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="font-semibold">Customer profiles</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100 shadow-xs">
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="font-semibold">AI Copilot</span>
          </div>
        </div>
      </div>

      {/* ─── Frequently Asked Questions (10 Comprehensive Items) ─── */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900 text-center flex items-center justify-center gap-2">
          <HelpCircle className="w-5 h-5 text-purple-600" /> Frequently Asked Questions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {FAQ.map((item, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-1.5 shadow-xs">
              <p className="text-xs font-bold text-slate-900">{item.q}</p>
              <p className="text-xs text-slate-600 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Call to Action ─── */}
      <div className="text-center space-y-3 pt-2">
        <p className="text-xs sm:text-sm text-slate-600 font-medium">Ready to organize your Philippine MSME?</p>
        <Link
          href={isAuthenticated ? "/settings" : "/login?mode=signup"}
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-purple-600/20 transition-all hover:scale-[1.02]"
        >
          <Sparkles className="w-4 h-4" />
          {isAuthenticated ? "Manage Your Plan in Settings" : "Start Your 30-Day Free Trial"}
        </Link>
        <p className="text-[11px] text-slate-400">No credit card required. Cancel anytime.</p>
      </div>
    </div>
  );
}
