"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Store, CheckCircle2, AlertCircle, RefreshCw, ArrowRight } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found. Please check your email for the correct link.");
      return;
    }

    async function verifyToken() {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token!)}`);
        const data = await res.json();

        if (data.success) {
          setStatus("success");
          setMessage(data.message || "Your email has been verified! You can now log in.");
        } else if (data.alreadyVerified) {
          // Token was already used — but that means verification succeeded before
          setStatus("success");
          setMessage("Your email has already been verified. You can log in now.");
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed. Please try again.");
        }
      } catch {
        setStatus("error");
        setMessage("We couldn't verify your email. Please check your connection and try again.");
      }
    }

    verifyToken();
  }, [token]);

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-xl border border-slate-200/80 space-y-5">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-700 mx-auto flex items-center justify-center text-white font-bold shadow-lg shadow-sky-500/20">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Email Verification</h1>
        </div>

        {/* Status Content */}
        {status === "loading" && (
          <div className="text-center py-8 space-y-3">
            <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
            <p className="text-sm text-slate-600 font-medium">Verifying your email address...</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <p className="text-sm font-bold text-emerald-900">{message}</p>
            </div>

            <p className="text-xs text-slate-500 text-center">
              Your account is now active. Log in to start your 30-day free trial.
            </p>

            <Link
              href="/login"
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition-all flex items-center justify-center gap-2"
            >
              Continue to Login
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-center space-y-2">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <p className="text-sm font-bold text-rose-900">{message}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Link
                href="/login"
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all text-center"
              >
                Go to Login
              </Link>
              <Link
                href="/login?mode=signup"
                className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition-all text-center border border-slate-200"
              >
                Create a New Account
              </Link>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 text-center">
          <Link href="/" className="text-xs text-slate-500 hover:text-purple-600 transition-colors">
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[85vh] flex items-center justify-center p-4">
          <div className="text-xs font-medium text-slate-400 animate-pulse">Loading...</div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
