"use client";

import React, { useState, useEffect } from "react";
import { Clock, ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/**
 * TrialExpiredGate — a gentle access gate for expired trial users.
 * 
 * Behavior:
 * - Shows a persistent top banner when trial has expired
 * - Shows a one-time modal overlay on first visit after expiry (dismissable)
 * - Does NOT lock the user out — they can still view their data
 * - Encourages subscription with clear, friendly language
 * - Only shown to authenticated OWNER users (not ADMIN)
 * - Not shown on public pages (/pricing, /login, /guide, etc.)
 */
export function TrialExpiredGate() {
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const [trialExpired, setTrialExpired] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Public pages where the gate should not appear
  const publicPages = ["/login", "/pricing", "/guide", "/verify-email", "/simulator"];
  const isPublicPage = publicPages.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!isAuthenticated || !user || user.role === "ADMIN" || isPublicPage) {
      setTrialExpired(false);
      return;
    }

    let isMounted = true;
    async function checkSubscriptionStatus() {
      try {
        const res = await fetch("/api/subscription/status");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.status === "EXPIRED") {
          setTrialExpired(true);
          // Show modal only once per session
          const modalDismissed = sessionStorage.getItem("bizpilot_trial_modal_dismissed");
          if (!modalDismissed) {
            setShowModal(true);
          }
        }
      } catch {
        // Silent catch
      }
    }

    checkSubscriptionStatus();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user?.id, isPublicPage]);

  const handleDismissModal = () => {
    setShowModal(false);
    setDismissed(true);
    try { sessionStorage.setItem("bizpilot_trial_modal_dismissed", "true"); } catch {}
  };

  if (!trialExpired || isPublicPage) return null;

  return (
    <>
      {/* Persistent Banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-center gap-3 text-xs">
        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span className="text-amber-800 font-medium">
          Your free trial has ended. Your data is safe — choose a plan to continue using all features.
        </span>
        <Link
          href="/pricing"
          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] shrink-0 flex items-center gap-1"
        >
          View Plans <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* One-Time Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Your free trial has ended</h2>
              </div>
              <button onClick={handleDismissModal} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                Thank you for trying BizPilot! Your 30-day free trial is over, but don't worry — <strong>all your business data is safe</strong>.
              </p>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 space-y-1">
                <p className="font-semibold">Your data is still here:</p>
                <p>✓ Products, customers, orders, and messages are preserved</p>
                <p>✓ Nothing was deleted</p>
                <p>✓ Choose a plan to pick up right where you left off</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/pricing"
                onClick={handleDismissModal}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2"
              >
                View Plans & Subscribe <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={handleDismissModal}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold text-center"
              >
                I'll do this later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
