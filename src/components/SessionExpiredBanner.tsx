"use client";

import React from "react";
import { Clock, LogIn } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/**
 * Displays a friendly, non-technical banner when the user's session has expired.
 * Only shown when the user was previously authenticated and the session became invalid.
 * The banner includes a link to log in again with returnTo support.
 */
export function SessionExpiredBanner() {
  const { sessionExpired, clearSessionExpired } = useAuth();
  const pathname = usePathname();

  if (!sessionExpired) return null;

  // Don't show on login page
  if (pathname === "/login") return null;

  const loginUrl = `/login?returnTo=${encodeURIComponent(pathname)}`;

  return (
    <div className="fixed top-16 left-0 right-0 z-50 px-4 pt-2 animate-in slide-in-from-top-2 duration-200">
      <div className="max-w-2xl mx-auto bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-lg flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Clock className="w-4.5 h-4.5 text-amber-700" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900">Your session has expired</p>
            <p className="text-xs text-amber-700">
              Please log in again to continue. You'll be taken right back to where you were.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={clearSessionExpired}
            className="px-3 py-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-lg transition-colors"
          >
            Dismiss
          </button>
          <Link
            href={loginUrl}
            onClick={clearSessionExpired}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <LogIn className="w-3.5 h-3.5" />
            Log In Again
          </Link>
        </div>
      </div>
    </div>
  );
}
