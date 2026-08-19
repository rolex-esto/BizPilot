import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { DashboardIntroHeader } from "@/components/DashboardIntroHeader";
import {
  TrendingUp,
  ShoppingBag,
  AlertTriangle,
  Flame,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  Package,
  CreditCard,
  Sparkles,
  CheckCircle,
  Radio,
  Plus,
  Truck,
  MapPin,
  Calendar,
  Tag,
  Users,
  Clock,
  LogIn,
  Handshake,
  Phone,
  Globe,
  ClipboardList,
  Bike,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Resolve business: strictly tenant-isolated to the logged-in user's business with targeted selects
  const business = user?.businessId
    ? await prisma.business.findUnique({
        where: { id: user.businessId },
      select: {
        id: true,
        name: true,
        ownerName: true,
        currency: true,
        planTier: true,
        isLifetimeFree: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        settingsJson: true,
        platformConnections: {
          select: {
            platform: true,
            platformAccountName: true,
            status: true,
          },
        },
        customers: {
          select: {
            leadStatus: true,
            source: true,
            primaryPlatform: true,
          },
        },
        products: {
          select: {
            isActive: true,
            stockQuantity: true,
            safetyStockThreshold: true,
          },
        },
        orders: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
            originalAmount: true,
            discountAmount: true,
            fulfillmentMethod: true,
            courier: true,
            courierTracking: true,
            meetupStatus: true,
            meetupLocation: true,
            customer: { select: { name: true } },
            payments: { select: { amount: true, status: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        leads: {
          where: { status: { in: ["NEGOTIATING", "INTERESTED", "AGREED"] } },
          select: {
            id: true,
            status: true,
            offeredPrice: true,
            customer: { select: { name: true } },
          },
        },
        calendarEvents: {
          where: { status: "SCHEDULED" },
          select: {
            id: true,
            title: true,
            startAt: true,
            location: true,
            customer: { select: { name: true } },
          },
          orderBy: { startAt: "asc" },
          take: 10,
        },
      },
    })
  : null;

  const currencySymbol = business?.currency === "PHP" ? "₱" : "₱";
  const formatPhp = (amt: number) =>
    `${currencySymbol}${amt.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const totalOrders = business?.orders.length || 0;
  const activeOrders = business?.orders.filter((o) => o.status !== "CANCELLED") || [];
  const grossSales = activeOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalCatalogValue = activeOrders.reduce((sum, o) => sum + (o.originalAmount || o.totalAmount), 0);
  const totalDiscountsGranted = activeOrders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);

  const verifiedCollected = activeOrders.flatMap((o) => o.payments)
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.amount, 0);

  const hotLeads = business?.customers.filter((c) => c.leadStatus === "HOT") || [];
  const negotiatingLeads = business?.leads.filter((l) => l.status === "NEGOTIATING") || [];
  const lowStockItems = business?.products.filter((p) => p.isActive && p.stockQuantity <= p.safetyStockThreshold) || [];
  const unpaidPayments = activeOrders.flatMap((o) => o.payments)
    .filter((p) => p.status === "UNPAID" || p.status === "PENDING_VERIFICATION");

  // Fulfillment Breakdown
  const meetupOrders = activeOrders.filter((o) => o.fulfillmentMethod === "MEETUP");
  const lbcOrders = activeOrders.filter((o) => o.fulfillmentMethod === "LBC" || o.courier === "LBC");
  const pickupOrders = activeOrders.filter((o) => o.fulfillmentMethod === "PICKUP");
  const courierOrders = activeOrders.filter((o) => o.fulfillmentMethod === "DELIVERY" || o.fulfillmentMethod === "COURIER");

  // Scheduled Meetups & In-Transit Shipments for Action Radar
  const scheduledMeetups = meetupOrders.filter((o) => o.meetupStatus === "SCHEDULED" || o.status === "PENDING" || o.status === "CONFIRMED");
  const inTransitLbc = lbcOrders.filter((o) => o.status === "SHIPPED");
  const readyToShipLbc = lbcOrders.filter((o) => o.status === "CONFIRMED" || o.status === "PACKED");

  // Dynamic channel statuses
  const connections = business?.platformConnections || [];
  const fbConn = connections.find((c) => c.platform === "FACEBOOK" && c.status === "CONNECTED");
  const igConn = connections.find((c) => c.platform === "INSTAGRAM" && c.status === "CONNECTED");
  const waConn = connections.find((c) => c.platform === "WHATSAPP" && c.status === "CONNECTED");
  const ttConn = connections.find((c) => c.platform === "TIKTOK");

  const channelList = [
    {
      name: "Facebook Messenger",
      platform: "FACEBOOK",
      connected: !!fbConn,
      accountName: fbConn?.platformAccountName,
      statusLabel: fbConn ? "● Connected" : "Not Connected",
      isPending: false,
    },
    {
      name: "Instagram Direct",
      platform: "INSTAGRAM",
      connected: !!igConn,
      accountName: igConn?.platformAccountName,
      statusLabel: igConn ? "● Connected" : "Not Connected",
      isPending: false,
    },
    {
      name: "WhatsApp Business",
      platform: "WHATSAPP",
      connected: !!waConn,
      accountName: waConn?.platformAccountName,
      statusLabel: waConn ? "● Connected" : "Not Connected",
      isPending: false,
    },
    {
      name: "TikTok Messaging",
      platform: "TIKTOK",
      connected: ttConn?.status === "CONNECTED",
      accountName: ttConn?.platformAccountName,
      statusLabel: "⚠ Requires Review",
      isPending: true,
    },
  ];

  const parsedSettings = (() => {
    try {
      return JSON.parse(business?.settingsJson || "{}");
    } catch {
      return {};
    }
  })();

  const isLifetime = Boolean((business as any)?.isLifetimeFree || business?.subscriptionStatus === "LIFETIME");
  const isTrial = business?.subscriptionStatus === "TRIAL" && !isLifetime;
  const trialEndRaw = isTrial ? ((business as any)?.trialEndsAt || parsedSettings.trialEndsAt) : null;
  const trialDaysLeft = trialEndRaw
    ? Math.max(0, Math.ceil((new Date(trialEndRaw).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="space-y-8">
      {/* Welcome & Business Snapshot */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" /> Your Business at a Glance
              </div>
              {isLifetime ? (
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition-all shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Lifetime Pro Access
                </Link>
              ) : isTrial && trialDaysLeft !== null ? (
                <Link href="/pricing" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold hover:bg-emerald-500/30 transition-colors">
                  <Clock className="w-3.5 h-3.5" /> {trialDaysLeft > 0 ? `Free Trial: ${trialDaysLeft} Days Left` : "Trial Ended"} — View Plans
                </Link>
              ) : business ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-bold">
                  ● {business.planTier} Plan
                </div>
              ) : null}
              <DashboardIntroHeader />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {business ? `Welcome back, ${business.ownerName}` : "Manage Your Online Business in One Place"}
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl">
              {business ? (
                <>
                  Track your sales, customer orders, meetups, LBC shipments, and payments for{" "}
                  <strong>{business.name}</strong>.
                </>
              ) : (
                "Keep track of your customers, orders, payments, and deliveries — all from one place."
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!business ? (
              <>
                <Link
                  href="/login?mode=signup"
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-purple-600/20 transition-all"
                >
                  <Sparkles className="w-4 h-4" /> Start 30-Day Free Trial
                </Link>
                <Link
                  href="/login"
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm border border-white/20 backdrop-blur-sm transition-all flex items-center gap-1.5"
                >
                  <LogIn className="w-4 h-4" /> Sign In
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/inbox"
                  className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-sky-500/20 transition-all"
                >
                  <MessageSquare className="w-4 h-4" /> View Messages
                </Link>
                <Link
                  href="/orders"
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm border border-white/20 backdrop-blur-sm transition-all"
                >
                  View Orders
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Actual Sales & Discounts */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sales</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{formatPhp(grossSales)}</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
              Discounts Given: <span className="font-bold text-emerald-600">{formatPhp(totalDiscountsGranted)}</span>
            </div>
          </div>
        </div>

        {/* Hot Leads & Active Negotiations */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Deals & Negotiations</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{negotiatingLeads.length} Negotiating</div>
            <p className="text-xs text-slate-500 mt-1">
              {hotLeads.length} Hot buying leads in pipeline
            </p>
          </div>
        </div>

        {/* Unpaid / Pending GCash & COD */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Awaiting Payment</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{unpaidPayments.length} Orders</div>
            <p className="text-xs text-slate-500 mt-1">GCash / Maya / COD not yet confirmed</p>
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Low Stock Warnings</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{lowStockItems.length} Products</div>
            <p className="text-xs text-slate-500 mt-1">Running low — may need restocking</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Priority Action Radar & Fulfillment Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Priority Action Radar & Fulfillment Analytics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Real-World Action Radar */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-500" /> What Needs Your Attention
                </h2>
                <p className="text-xs text-slate-500">
                  Upcoming meetups, orders to ship, customer negotiations, and payments to collect
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700">
                {scheduledMeetups.length + readyToShipLbc.length + negotiatingLeads.length + unpaidPayments.length} Things to Do
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Meetups */}
              {scheduledMeetups.length > 0 && (
                <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/60 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-lg bg-purple-600 text-white font-bold">🤝</span>
                    <div>
                      <div className="font-bold text-purple-900">
                        {scheduledMeetups.length} Physical Meetup(s) Scheduled
                      </div>
                      <div className="text-purple-700">
                        {scheduledMeetups[0].customer.name} @ {scheduledMeetups[0].meetupLocation || "Location TBD"}
                      </div>
                    </div>
                  </div>
                  <Link href="/orders" className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-[11px]">
                    View Meetups
                  </Link>
                </div>
              )}

              {/* LBC Ready to Ship */}
              {readyToShipLbc.length > 0 && (
                <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-lg bg-rose-600 text-white font-bold">📦</span>
                    <div>
                      <div className="font-bold text-rose-900">
                        {readyToShipLbc.length} LBC Order(s) Awaiting Shipment
                      </div>
                      <div className="text-rose-700">Pack parcel and enter manual tracking reference</div>
                    </div>
                  </div>
                  <Link href="/orders" className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px]">
                    Enter Tracking
                  </Link>
                </div>
              )}

              {/* In-Transit LBC */}
              {inTransitLbc.length > 0 && (
                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-lg bg-blue-600 text-white font-bold">🚚</span>
                    <div>
                      <div className="font-bold text-blue-900">
                        {inTransitLbc.length} LBC Parcel(s) In Transit
                      </div>
                      <div className="text-blue-700">Tracking: {inTransitLbc[0].courierTracking || "Manual Ref Recorded"}</div>
                    </div>
                  </div>
                  <Link href="/orders" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px]">
                    Track Parcels
                  </Link>
                </div>
              )}

              {/* Active Negotiations */}
              {negotiatingLeads.length > 0 && (
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-lg bg-amber-600 text-white font-bold">💬</span>
                    <div>
                      <div className="font-bold text-amber-900">
                        {negotiatingLeads.length} Customer(s) Actively Negotiating
                      </div>
                      <div className="text-amber-700">
                        {negotiatingLeads[0].customer.name} offering {formatPhp(negotiatingLeads[0].offeredPrice || 0)}
                      </div>
                    </div>
                  </div>
                  <Link href="/inbox" className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px]">
                    Review Offer
                  </Link>
                </div>
              )}

              {/* Pending Payments / COD */}
              {unpaidPayments.length > 0 && (
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-lg bg-emerald-600 text-white font-bold">💰</span>
                    <div>
                      <div className="font-bold text-emerald-900">
                        {unpaidPayments.length} Payment(s) Awaiting Settlement
                      </div>
                      <div className="text-emerald-700">GCash references & cash collection confirmations</div>
                    </div>
                  </div>
                  <Link href="/orders" className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px]">
                    Verify Payments
                  </Link>
                </div>
              )}

              {scheduledMeetups.length === 0 && readyToShipLbc.length === 0 && negotiatingLeads.length === 0 && unpaidPayments.length === 0 && (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <h4 className="font-bold text-slate-900 text-sm">All Operations Up to Date</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    No pending meetups, shipments, or urgent negotiations.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Today's Schedule & Appointments */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-600" /> Today's Business Operations
                </h2>
                <p className="text-xs text-slate-500">
                  Customer meetups, LBC drop-offs, on-demand courier deliveries, and follow-up reminders
                </p>
              </div>
              <Link
                href="/calendar"
                className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                Open Calendar →
              </Link>
            </div>

            {business?.calendarEvents && business.calendarEvents.length > 0 ? (
              <div className="space-y-2">
                {business.calendarEvents.slice(0, 4).map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{evt.title}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">
                          {new Date(evt.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="text-slate-500 flex items-center gap-2">
                        {evt.location && <span>📍 {evt.location}</span>}
                        {evt.customer && <span>👤 {evt.customer.name}</span>}
                      </div>
                    </div>
                    <Link
                      href="/calendar"
                      className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-[11px]"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                <span>🗓 No activities scheduled for today. </span>
                <Link href="/calendar" className="text-purple-600 font-bold underline ml-1">
                  Schedule an activity
                </Link>
              </div>
            )}
          </div>

          {/* Fulfillment Breakdown & Sales by Channel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sales by Fulfillment */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-sky-600" /> Sales by Fulfillment
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-2 rounded-lg bg-purple-50 text-purple-900 font-medium">
                  <span className="flex items-center gap-2"><Handshake className="w-4 h-4 text-purple-600" /> Customer Meetups</span>
                  <span className="font-bold">{meetupOrders.length} orders ({formatPhp(meetupOrders.reduce((s, o) => s + o.totalAmount, 0))})</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-rose-50 text-rose-900 font-medium">
                  <span className="flex items-center gap-2"><Package className="w-4 h-4 text-rose-600" /> LBC Shipping</span>
                  <span className="font-bold">{lbcOrders.length} orders ({formatPhp(lbcOrders.reduce((s, o) => s + o.totalAmount, 0))})</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-blue-50 text-blue-900 font-medium">
                  <span className="flex items-center gap-2"><Truck className="w-4 h-4 text-blue-600" /> On-Demand Couriers (Grab/Lalamove)</span>
                  <span className="font-bold">{courierOrders.length} orders ({formatPhp(courierOrders.reduce((s, o) => s + o.totalAmount, 0))})</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-50 text-emerald-900 font-medium">
                  <span className="flex items-center gap-2"><Bike className="w-4 h-4 text-emerald-600" /> Direct Deliveries</span>
                  <span className="font-bold">{activeOrders.filter(o => o.fulfillmentMethod === "DELIVERY").length} orders ({formatPhp(activeOrders.filter(o => o.fulfillmentMethod === "DELIVERY").reduce((s, o) => s + o.totalAmount, 0))})</span>
                </div>
              </div>
            </div>

            {/* Customers by Sourcing */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" /> Where Customers Found You
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 font-medium">
                  <span className="flex items-center gap-2"><Globe className="w-4 h-4 text-blue-500" /> Social Media (FB, IG, WA, TT)</span>
                  <span className="font-bold">{business?.customers.filter((c) => ["FACEBOOK", "INSTAGRAM", "WHATSAPP", "TIKTOK"].includes(c.source || c.primaryPlatform)).length || 0} buyers</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 font-medium">
                  <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-purple-500" /> Store Walk-In</span>
                  <span className="font-bold">{business?.customers.filter((c) => c.source === "WALK_IN").length || 0} buyers</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 font-medium">
                  <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-emerald-500" /> Phone Calls & Referrals</span>
                  <span className="font-bold">{business?.customers.filter((c) => c.source === "PHONE" || c.source === "REFERRAL").length || 0} buyers</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 font-medium">
                  <span className="flex items-center gap-2"><ClipboardList className="w-4 h-4 text-slate-500" /> Direct Manual POS</span>
                  <span className="font-bold">{business?.customers.filter((c) => c.source === "MANUAL" || (!c.source && c.primaryPlatform === "MANUAL")).length || 0} buyers</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Live Channel Statuses & Simulator Link */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-600" /> Your Selling Channels
              </h2>
              <Link href="/channels" className="text-xs font-semibold text-sky-600 hover:text-sky-700">
                Manage
              </Link>
            </div>

            <div className="space-y-3">
              {channelList.map((ch) => (
                <div
                  key={ch.name}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {/* Platform brand icon */}
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      {ch.platform === "FACEBOOK" && (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M24 12C24 5.373 18.627 0 12 0S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.79-4.668 4.533-4.668 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.875V12h3.328l-.532 3.469h-2.796v8.385C19.612 22.954 24 17.99 24 12z" fill="#1877F2"/></svg>
                      )}
                      {ch.platform === "INSTAGRAM" && (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><defs><radialGradient id="ig_d" cx="30%" cy="107%" r="150%"><stop offset="0%" stopColor="#fdf497"/><stop offset="5%" stopColor="#fdf497"/><stop offset="45%" stopColor="#fd5949"/><stop offset="60%" stopColor="#d6249f"/><stop offset="90%" stopColor="#285AEB"/></radialGradient></defs><rect width="24" height="24" rx="6" fill="url(#ig_d)"/><rect x="3" y="3" width="18" height="18" rx="4.5" stroke="white" strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="4" stroke="white" strokeWidth="1.5" fill="none"/><circle cx="17.5" cy="6.5" r="1.2" fill="white"/></svg>
                      )}
                      {ch.platform === "WHATSAPP" && (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2z" fill="#25D366"/><path d="M17.47 14.38c-.3-.15-1.76-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.09 3.19 5.06 4.47.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" fill="white"/></svg>
                      )}
                      {ch.platform === "TIKTOK" && (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#010101"/><path d="M16.6 8.17a4.28 4.28 0 01-2.63-.9A4.28 4.28 0 0112.8 5h-2.17v9.72a2.14 2.14 0 01-2.14 2.14 2.14 2.14 0 01-2.14-2.14 2.14 2.14 0 012.14-2.14c.23 0 .44.04.65.1V10.5a4.32 4.32 0 00-.65-.05 4.32 4.32 0 00-4.32 4.32A4.32 4.32 0 008.49 19a4.32 4.32 0 004.32-4.32V10.3a6.44 6.44 0 003.8 1.23V9.36a4.28 4.28 0 01-1.17-.3V8.17h1.17z" fill="white"/></svg>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{ch.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {ch.accountName || ch.statusLabel}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      ch.connected
                        ? "bg-emerald-100 text-emerald-800"
                        : ch.isPending
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {ch.connected ? "Active" : ch.isPending ? "Review" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>

            {/* Simulator Callout */}
            <div className="pt-2 border-t border-slate-100">
              <Link
                href="/simulator"
                className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-amber-400" /> Test Customer Messages
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
