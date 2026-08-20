"use client";

import React, { useState, useEffect } from "react";
import {
  ShoppingBag,
  CheckCircle,
  CreditCard,
  Package,
  Truck,
  AlertCircle,
  RefreshCw,
  Clock,
  Check,
  MapPin,
  Calendar,
  Tag,
  Search,
  ExternalLink,
  Users,
} from "lucide-react";
import { ModuleIntroModal, AboutPageButton, useModuleIntro, ModuleIntroConfig } from "@/components/ModuleIntroModal";

const ORDERS_INTRO_CONFIG: ModuleIntroConfig = {
  moduleKey: "orders",
  title: "Your Orders",
  badge: "Orders",
  icon: <ShoppingBag className="w-6 h-6 text-emerald-600" />,
  subtitle: "Track your customer orders from start to finish — payment, packing, and delivery.",
  whatYouCanDo: [
    "See all your orders and check their payment status",
    "Filter orders by delivery type: meetups, LBC, courier, or all",
    "Add LBC tracking numbers and schedule meetups",
    "Confirm GCash/Maya payments or mark COD as collected",
  ],
  whyItMatters:
    "You'll always know which orders need your attention — what needs to be paid, packed, or delivered.",
  nextAction: "Check your pending orders or confirm any payments.",
};

interface OrderItem {
  id: string;
  productName: string;
  productSku: string;
  originalUnitPrice?: number;
  discount?: number;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

interface Payment {
  id: string;
  paymentMethod: string;
  amount: number;
  referenceNumber?: string;
  status: string; // UNPAID, PENDING_VERIFICATION, PAID
  verifiedAt?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  totalAmount: number;
  originalAmount?: number;
  discountAmount?: number;
  source?: string;
  fulfillmentMethod: string; // MEETUP, LBC, COURIER, PICKUP, DELIVERY, OTHER
  status: string; // PENDING, CONFIRMED, PACKED, SHIPPED, DELIVERED, CANCELLED
  deliveryAddress?: string;
  customerPhone?: string;
  courier?: string;
  trackingNumber?: string;
  courierTracking?: string;
  meetupSchedule?: string;
  meetupLocation?: string;
  meetupStatus?: string;
  pickupSchedule?: string;
  pickupLocation?: string;
  pickupStatus?: string;
  notes?: string;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    primaryPlatform: string;
    source?: string;
    phone?: string;
  };
  items: OrderItem[];
  payments: Payment[];
}

export default function OrdersPage() {
  const { isOpen: isIntroOpen, openIntro, closeIntro } = useModuleIntro("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ALL" | "MEETUP" | "LBC" | "PICKUP" | "DELIVERY">("ALL");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [notification, setNotification] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [trackingModalOrder, setTrackingModalOrder] = useState<Order | null>(null);
  const [manualTrackingInput, setManualTrackingInput] = useState("");

  const formatPhp = (amt: number) =>
    `₱${amt.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (data.status === "success") {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleConfirmOrder = async (orderId: string, orderNumber: string) => {
    setActionInProgress(orderId);
    try {
      const res = await fetch("/api/orders/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setNotification(`Order ${orderNumber} confirmed & inventory decremented successfully!`);
        setTimeout(() => setNotification(""), 4000);
        fetchOrders();
      } else {
        alert(data.error || "Failed to confirm order");
      }
    } catch (err) {
      console.error("Confirmation error:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleVerifyPayment = async (paymentId: string, orderNumber: string, method: string) => {
    setActionInProgress(paymentId);
    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, status: "PAID" }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setNotification(`${method} payment verified for ${orderNumber}!`);
        setTimeout(() => setNotification(""), 4000);
        fetchOrders();
      } else {
        alert(data.error || "Failed to verify payment");
      }
    } catch (err) {
      console.error("Payment verification error:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, patchData: any, successMsg: string) => {
    setActionInProgress(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchData),
      });

      const data = await res.json();
      if (data.status === "success") {
        setNotification(successMsg);
        setTimeout(() => setNotification(""), 4000);
        setTrackingModalOrder(null);
        setManualTrackingInput("");
        fetchOrders();
      } else {
        alert(data.error || "Failed to update order");
      }
    } catch (err) {
      console.error("Order update error:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesTab =
      activeTab === "ALL" ||
      (activeTab === "MEETUP" && o.fulfillmentMethod === "MEETUP") ||
      (activeTab === "LBC" && (o.fulfillmentMethod === "LBC" || o.courier === "LBC")) ||
      (activeTab === "PICKUP" && o.fulfillmentMethod === "PICKUP") ||
      (activeTab === "DELIVERY" && (o.fulfillmentMethod === "DELIVERY" || o.fulfillmentMethod === "COURIER"));

    const matchesSearch =
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.items.some((i) => i.productName.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesTab && matchesSearch;
  });

  const getFulfillmentBadge = (method: string) => {
    switch (method) {
      case "MEETUP":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">🤝 Customer Meetup</span>;
      case "LBC":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">📦 LBC Shipping</span>;
      case "COURIER":
      case "DELIVERY":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">🚚 On-Demand Courier</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">🛵 Direct Delivery</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">Confirmed</span>;
      case "SHIPPED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">Shipped / In Transit</span>;
      case "DELIVERED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">Completed</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Pending Confirmation</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <ShoppingBag className="w-6 h-6 text-sky-600" />
              Orders & Operations Fulfillment Hub
            </h1>
            <AboutPageButton onClick={openIntro} />
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track negotiated sales, customer meetups, manual LBC tracking, on-demand couriers (Grab/Lalamove), and GCash/Cash payments
          </p>
        </div>

        <button
          onClick={fetchOrders}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <ModuleIntroModal config={ORDERS_INTRO_CONFIG} isOpen={isIntroOpen} onClose={closeIntro} />

      {notification && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          {notification}
        </div>
      )}

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === "ALL" ? "bg-white text-slate-900 font-bold shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Orders ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab("MEETUP")}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === "MEETUP" ? "bg-white text-purple-700 font-bold shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🤝 Customer Meetups ({orders.filter((o) => o.fulfillmentMethod === "MEETUP").length})
          </button>
          <button
            onClick={() => setActiveTab("LBC")}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === "LBC" ? "bg-white text-rose-700 font-bold shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            📦 LBC Shipping ({orders.filter((o) => o.fulfillmentMethod === "LBC" || o.courier === "LBC").length})
          </button>
          <button
            onClick={() => setActiveTab("DELIVERY")}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === "DELIVERY" ? "bg-white text-blue-700 font-bold shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🚚 Couriers (Grab/Lalamove) ({orders.filter((o) => o.fulfillmentMethod === "DELIVERY" || o.fulfillmentMethod === "COURIER").length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by order #, customer, item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-sky-500 mb-2" />
          Loading orders and fulfillment status...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">No orders found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {activeTab === "MEETUP"
              ? "No scheduled meetups. Select 'Meetup' as the delivery method when creating an order."
              : activeTab === "LBC"
              ? "No LBC shipments recorded. You can choose 'LBC' and enter manual tracking references."
              : activeTab === "PICKUP"
              ? "No store pickups pending."
              : "Orders created from chat negotiations or manual walk-in sales will appear here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredOrders.map((order) => {
            const payment = order.payments[0];
            const hasDiscount = (order.discountAmount || 0) > 0;

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-slate-300 transition-all"
              >
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                      {order.orderNumber}
                    </span>
                    {getFulfillmentBadge(order.fulfillmentMethod)}
                    {getStatusBadge(order.status)}
                  </div>

                  <div className="text-xs text-slate-400">
                    {new Date(order.createdAt).toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </div>

                {/* Customer & Fulfillment Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                  <div>
                    <div className="text-slate-400 font-medium mb-1">Customer / Buyer</div>
                    <div className="font-bold text-slate-900 text-sm">{order.customer.name}</div>
                    <div className="text-slate-500">
                      Source: <span className="font-semibold text-slate-700">{order.customer.source || order.customer.primaryPlatform}</span>
                      {order.customerPhone && ` • ${order.customerPhone}`}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-400 font-medium mb-1">Fulfillment Details</div>
                    {order.fulfillmentMethod === "MEETUP" ? (
                      <div className="space-y-0.5">
                        <div className="font-semibold text-purple-900 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-purple-600" />
                          {order.meetupLocation || "Location to be arranged"}
                        </div>
                        <div className="text-slate-600 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-purple-600" />
                          {order.meetupSchedule
                            ? new Date(order.meetupSchedule).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })
                            : "Schedule TBD"}
                          {order.meetupStatus && ` (${order.meetupStatus})`}
                        </div>
                      </div>
                    ) : order.fulfillmentMethod === "LBC" ? (
                      <div className="space-y-0.5">
                        <div className="font-semibold text-rose-900">
                          Manual Tracking: <span className="font-mono bg-rose-50 px-1 rounded">{order.courierTracking || order.trackingNumber || "Pending Dispatch"}</span>
                        </div>
                        <div className="text-slate-500">{order.deliveryAddress || "Address on file"}</div>
                      </div>
                    ) : order.fulfillmentMethod === "PICKUP" ? (
                      <div className="space-y-0.5">
                        <div className="font-semibold text-amber-900">
                          {order.pickupLocation || "Store Main Counter"}
                        </div>
                        <div className="text-slate-600">Status: {order.pickupStatus || "READY_FOR_PICKUP"}</div>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="font-semibold text-blue-900">Courier: {order.courier || "Lalamove"}</div>
                        <div className="text-slate-500">{order.deliveryAddress || "Standard delivery"}</div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-slate-400 font-medium mb-1">Payment Method</div>
                    <div className="font-bold text-slate-900">{payment?.paymentMethod || "GCASH"}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          payment?.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800"
                            : payment?.status === "PENDING_VERIFICATION"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {payment?.status === "PAID"
                          ? "PAID"
                          : payment?.status === "PENDING_VERIFICATION"
                          ? "PENDING VERIFICATION"
                          : "UNPAID"}
                      </span>
                      {payment?.referenceNumber && (
                        <span className="text-slate-400 font-mono text-[10px]">({payment.referenceNumber})</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Items & Negotiated Pricing Breakdown */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-500">Ordered Items</div>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                    {order.items.map((item) => (
                      <div key={item.id} className="p-3 bg-white flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-900">{item.productName}</div>
                          <div className="text-slate-400 font-mono text-[11px]">{item.productSku} • Qty: {item.quantity}</div>
                        </div>

                        <div className="text-right">
                          {item.originalUnitPrice && item.originalUnitPrice > item.unitPrice ? (
                            <div>
                              <span className="line-through text-slate-400 mr-2">{formatPhp(item.originalUnitPrice)}</span>
                              <span className="font-bold text-slate-900">{formatPhp(item.unitPrice)}</span>
                              <div className="text-[10px] font-semibold text-emerald-600">
                                Negotiated Discount: -{formatPhp(item.originalUnitPrice - item.unitPrice)}
                              </div>
                            </div>
                          ) : (
                            <div className="font-bold text-slate-900">{formatPhp(item.unitPrice * item.quantity)}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial Summary & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div>
                    {hasDiscount && (
                      <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-emerald-600" />
                        Original: <span className="line-through">{formatPhp(order.originalAmount || order.totalAmount)}</span>
                        <span className="font-bold text-emerald-600">(-{formatPhp(order.discountAmount || 0)} Discount)</span>
                      </div>
                    )}
                    <div className="text-sm font-bold text-slate-900">
                      Final Agreed Total: <span className="text-base text-sky-700">{formatPhp(order.totalAmount)}</span>
                    </div>
                  </div>

                  {/* Contextual Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Order Confirmation */}
                    {order.status === "PENDING" && (
                      <button
                        onClick={() => handleConfirmOrder(order.id, order.orderNumber)}
                        disabled={actionInProgress === order.id}
                        className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {actionInProgress === order.id ? "Processing..." : "Confirm & Decrement Stock"}
                      </button>
                    )}

                    {/* Meetup Action */}
                    {order.fulfillmentMethod === "MEETUP" && order.meetupStatus !== "COMPLETED" && (
                      <button
                        onClick={() =>
                          handleUpdateOrderStatus(
                            order.id,
                            { meetupStatus: "COMPLETED", status: "DELIVERED" },
                            `Meetup marked completed for ${order.orderNumber}!`
                          )
                        }
                        disabled={actionInProgress === order.id}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        Mark Meetup Met
                      </button>
                    )}

                    {/* LBC Shipping Tracking Update */}
                    {(order.fulfillmentMethod === "LBC" || order.courier === "LBC") && (
                      <button
                        onClick={() => {
                          setTrackingModalOrder(order);
                          setManualTrackingInput(order.courierTracking || order.trackingNumber || "");
                        }}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        Update LBC Tracking #
                      </button>
                    )}

                    {/* Store Pickup Action */}
                    {order.fulfillmentMethod === "PICKUP" && order.pickupStatus !== "PICKED_UP" && (
                      <button
                        onClick={() =>
                          handleUpdateOrderStatus(
                            order.id,
                            { pickupStatus: "PICKED_UP", status: "DELIVERED" },
                            `Order ${order.orderNumber} marked picked up!`
                          )
                        }
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        Mark Picked Up
                      </button>
                    )}

                    {/* Payment Verification / Cash Collection */}
                    {payment && payment.status !== "PAID" && (
                      <button
                        onClick={() => handleVerifyPayment(payment.id, order.orderNumber, payment.paymentMethod)}
                        disabled={actionInProgress === payment.id}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        {payment.paymentMethod === "CASH" || payment.paymentMethod === "COD"
                          ? "Confirm Payment Collected"
                          : "Verify Payment"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual LBC Tracking Modal */}
      {trackingModalOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-rose-600" />
              Manual LBC Tracking Reference
            </h3>
            <p className="text-xs text-slate-500">
              Enter the manual reference or waybill number from your LBC receipt for{" "}
              <span className="font-semibold text-slate-800">{trackingModalOrder.orderNumber}</span>.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">LBC Tracking / Waybill #</label>
              <input
                type="text"
                placeholder="e.g. LBC-987654321"
                value={manualTrackingInput}
                onChange={(e) => setManualTrackingInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <p className="text-[10px] text-slate-400">Note: Manual tracking entry for store record keeping.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setTrackingModalOrder(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleUpdateOrderStatus(
                    trackingModalOrder.id,
                    { courierTracking: manualTrackingInput, status: "SHIPPED" },
                    `LBC tracking updated and marked shipped for ${trackingModalOrder.orderNumber}!`
                  )
                }
                disabled={!manualTrackingInput.trim() || actionInProgress === trackingModalOrder.id}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Save & Mark Shipped
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
