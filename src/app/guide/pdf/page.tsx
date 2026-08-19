"use client";

import React from "react";
import { Store, Sparkles, CheckCircle2, ShieldCheck, Calendar, Package, ShoppingBag, MessageSquare, Clock, ArrowRight } from "lucide-react";

export default function PrintableGuidePdfPage() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-slate-50 min-h-screen py-10 px-4 sm:px-6 lg:px-8 text-slate-900 font-sans print:bg-white print:p-0 print:m-0">
      {/* Action Bar for Browser Printing */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span>BizPilot Owner Migration & Operations Guide (PDF Ready)</span>
        </div>
        <button
          onClick={handlePrint}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition-all flex items-center gap-2"
        >
          📄 Save / Export as PDF (Cmd + P)
        </button>
      </div>

      {/* Printable Document Container (A4 / Standard Letter Page Layout) */}
      <main className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-3xl shadow-xl border border-slate-200/80 space-y-8 print:shadow-none print:border-none print:p-6 print:rounded-none">
        
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-6 flex items-start justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-[11px] font-black uppercase tracking-wider mb-1">
              <Store className="w-3.5 h-3.5" /> BizPilot MSME Platform
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Store Owner Migration & Operations Manual
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              End-to-End Blueprint for Migrating from Manual Notebooks & Spreadsheets to an All-in-One Operations Hub
            </p>
          </div>
          <div className="text-right text-xs text-slate-400 font-mono shrink-0 hidden sm:block">
            <div>VERSION: 2.0 (2026)</div>
            <div>STATUS: DEPLOYMENT READY</div>
          </div>
        </div>

        {/* Phase 1: Store Setup */}
        <section className="space-y-3">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 border-b border-slate-200 pb-2">
            <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs font-bold">1</span>
            Phase 1: Day 1 Store Account Setup (5 Minutes)
          </h2>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs space-y-2">
            <p className="font-semibold text-slate-800">
              Navigate to <code className="bg-white px-2 py-0.5 rounded border text-purple-700">/login?mode=signup</code> to provision your store:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li><strong>Store Name:</strong> e.g., <em>TechMart Laptops PH</em></li>
              <li><strong>Owner Name:</strong> e.g., <em>Michael Reyes</em></li>
              <li><strong>Email & Password:</strong> Creates your secure, authenticated owner session</li>
              <li><strong>30-Day Free Trial:</strong> Automatically active with strict tenant database isolation</li>
            </ul>
          </div>
        </section>

        {/* Phase 2: Inventory */}
        <section className="space-y-3">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 border-b border-slate-200 pb-2">
            <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs font-bold">2</span>
            Phase 2: Inventory & Catalog Setup (10 Minutes)
          </h2>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs space-y-2">
            <p className="text-slate-700 leading-relaxed">
              Open <strong className="text-slate-900">Inventory Hub (/inventory)</strong> and register your active laptop or product inventory:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px]">SKU</span>
                <strong>LEN-T480-16G</strong>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px]">BASE PRICE</span>
                <strong>₱18,500.00</strong>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px]">INITIAL STOCK</span>
                <strong>5 Units</strong>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px]">SAFETY ALERT</span>
                <strong>≤ 2 Units</strong>
              </div>
            </div>
            <p className="text-[11px] text-purple-900 font-medium pt-1">
              ✨ <strong>Catalog Integrity:</strong> Discounts given to buyers never overwrite your official catalog price or corrupt accounting formulas.
            </p>
          </div>
        </section>

        {/* Phase 3: Channels */}
        <section className="space-y-3">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 border-b border-slate-200 pb-2">
            <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs font-bold">3</span>
            Phase 3: Connect Social Channels & Webhooks (3 Minutes)
          </h2>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs text-slate-700 space-y-2">
            <p>Connect your official communication streams under <strong>Channels Hub (/channels)</strong>:</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg font-bold text-[11px]">Facebook Messenger (Meta Graph API)</span>
              <span className="px-3 py-1 bg-pink-100 text-pink-800 rounded-lg font-bold text-[11px]">Instagram Direct (Professional Account)</span>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[11px]">WhatsApp Business Cloud API</span>
              <span className="px-3 py-1 bg-slate-200 text-slate-800 rounded-lg font-bold text-[11px]">TikTok Messaging (Enterprise Review)</span>
            </div>
            <p className="text-[11px] text-slate-500 pt-1 leading-relaxed">
              • Configure Webhook URLs (<code className="text-purple-700 font-mono">/api/webhooks/meta</code>, <code className="text-purple-700 font-mono">/api/webhooks/whatsapp</code>) with Verify Tokens in your Developer Portals. Click <strong>Test Channel</strong> to verify live connection health.
            </p>
          </div>
        </section>

        {/* Phase 4: Daily Sales Routine */}
        <section className="space-y-3">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 border-b border-slate-200 pb-2">
            <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs font-bold">4</span>
            Phase 4: The 5-Step Daily Sales & Operations Routine
          </h2>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="text-purple-600 font-mono">Step 4.1</span> Chat & Negotiate Tawad (/inbox)
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Buyer inquires about laptop. Use the <strong>Quick Negotiation Bar</strong> to enter counter-offer (e.g. ₱18,500 ➔ ₱17,500). System locks in agreed price and calculates discount automatically.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="text-purple-600 font-mono">Step 4.2</span> 1-Click Order Creation (/inbox)
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Click <strong>"1-Click Order"</strong> in the chat header. Select fulfillment: <strong>Customer Meetup</strong> (SM Megamall), <strong>LBC Shipping</strong>, or <strong>Grab Courier</strong>.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="text-purple-600 font-mono">Step 4.3</span> Operations Calendar Sync (/calendar)
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                The appointment automatically syncs to your Operations Calendar (3:00 PM Meetup). Avoid double-booking or missed customer handovers.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="text-purple-600 font-mono">Step 4.4</span> Payment Verification & Inventory Decrement (/orders)
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Meet buyer or dispatch rider. Buyer pays cash or GCash. Click <strong>"Verify Payment"</strong> (UNPAID ➔ PAID). Completing order auto-decrements stock (5 ➔ 4).
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="text-purple-600 font-mono">Step 4.5</span> Grounded AI Copilot Q&A (/copilot)
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Ask in plain English or Taglish: <em>"Magkano pa uncollected COD ko today?"</em> or <em>"Anong schedule ko tomorrow?"</em> and receive 100% database-grounded calculations.
              </p>
            </div>
          </div>
        </section>

        {/* Phase 5: Account Settings & Security */}
        <section className="space-y-3">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 border-b border-slate-200 pb-2">
            <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs font-bold">5</span>
            Phase 5: Store Control Center & Security Management (/settings)
          </h2>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs text-slate-700 space-y-2">
            <p className="font-semibold text-slate-800">
              Manage your business profile, delivery methods, payment methods, notifications, and security:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li><strong>Store Profile & Logo:</strong> Set your store name, description, category, and upload your official logo.</li>
              <li><strong>Fulfillment & Payments:</strong> Configure Customer Meetup, LBC, Grab, Lalamove, GCash, Maya, and COD.</li>
              <li><strong>Security & Sessions:</strong> Update password, verify email address, and monitor active device logins.</li>
              <li><strong>Plan & Usage:</strong> Monitor active product count, monthly orders, and 30-day free trial timeline.</li>
            </ul>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="space-y-3 pt-2">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2">
            Operations Comparison Matrix
          </h2>
          <table className="w-full text-left text-xs border-collapse border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 font-bold">
              <tr>
                <th className="p-2.5 border border-slate-200">Business Function</th>
                <th className="p-2.5 border border-slate-200 text-rose-700">Before (Notebooks & Excel)</th>
                <th className="p-2.5 border border-slate-200 text-emerald-800 bg-emerald-50/60">With BizPilot Platform</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-600 text-[11px]">
              <tr>
                <td className="p-2.5 font-bold border border-slate-200">Customer DMs</td>
                <td className="p-2.5 border border-slate-200">Scattered across 4 apps; lost chats</td>
                <td className="p-2.5 border border-slate-200 font-semibold text-emerald-900 bg-emerald-50/30">1 Centralized Unified Inbox</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold border border-slate-200">Discounts & Tawad</td>
                <td className="p-2.5 border border-slate-200">Manual calculation; breaks Excel formulas</td>
                <td className="p-2.5 border border-slate-200 font-semibold text-emerald-900 bg-emerald-50/30">1-Click Locked Price & Discount Logs</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold border border-slate-200">Meetup Scheduling</td>
                <td className="p-2.5 border border-slate-200">Forgot buyer is waiting at SM Megamall</td>
                <td className="p-2.5 border border-slate-200 font-semibold text-emerald-900 bg-emerald-50/30">Visual Operations Calendar with Reminders</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold border border-slate-200">LBC & Courier Tracking</td>
                <td className="p-2.5 border border-slate-200">Lost paper waybills & tracking slips</td>
                <td className="p-2.5 border border-slate-200 font-semibold text-emerald-900 bg-emerald-50/30">Direct In-Order Waybill Tracking Number</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold border border-slate-200">GCash & COD Reconcile</td>
                <td className="p-2.5 border border-slate-200">50 screenshots on phone; unverified</td>
                <td className="p-2.5 border border-slate-200 font-semibold text-emerald-900 bg-emerald-50/30">1-Click Verified Payment Status</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold border border-slate-200">Inventory Counts</td>
                <td className="p-2.5 border border-slate-200">Discrepancies and stock overselling</td>
                <td className="p-2.5 border border-slate-200 font-semibold text-emerald-900 bg-emerald-50/30">Automatic Transactional Stock Decrement</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Footer */}
        <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            <span className="font-bold text-slate-900">BizPilot MSME Operations Copilot</span> • Confidential Store Owner Guide
          </div>
          <div className="font-semibold text-purple-700">
            www.bizpilot.ph
          </div>
        </div>
      </main>
    </div>
  );
}
