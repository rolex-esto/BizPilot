"use client";

import React, { useState, useEffect, Suspense } from "react";
import { Lock, Mail, ShieldCheck, ArrowRight, Store, Sparkles, CheckCircle2, User, Phone, Tag, AlertCircle, KeyRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

/**
 * Validates that a returnTo path is safe (internal, relative path only).
 */
function isValidReturnTo(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//") || path.includes("://")) return false;
  if (path.includes("%2f") || path.includes("%2F")) return false;
  if (path === "/login" || path.startsWith("/login?")) return false;
  if (path.startsWith("/api/")) return false;
  return true;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, setUserDirectly } = useAuth();

  const initialMode = searchParams.get("mode") === "signup" ? "SIGNUP" : "SIGNIN";
  const returnTo = searchParams.get("returnTo") || null;

  const [mode, setMode] = useState<"SIGNIN" | "SIGNUP" | "FORGOT">(initialMode);

  // Sign In State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Sign Up State
  const [name, setName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  // If already authenticated, redirect away from login
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const destination = returnTo && isValidReturnTo(returnTo) ? returnTo : "/";
      router.replace(destination);
    }
  }, [isAuthenticated, isLoading, returnTo, router]);

  /**
   * Determines the correct post-login destination.
   * Priority: returnTo param > role-based default
   */
  function getPostLoginDestination(userRole: string): string {
    if (returnTo && isValidReturnTo(returnTo)) {
      return returnTo;
    }
    return userRole === "ADMIN" ? "/admin" : "/";
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setErrorMsg("");
    setUnverifiedEmail("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        setSuccessMsg(`Welcome back, ${data.user.name}!`);
        setUserDirectly(data.user);
        const destination = getPostLoginDestination(data.user.role);
        router.replace(destination);
        return;
      } else if (res.status === 403 && data.code === "EMAIL_NOT_VERIFIED") {
        setUnverifiedEmail(data.email || email.trim());
        setErrorMsg("Please verify your email before logging in. Check your inbox for the verification link.");
      } else {
        setErrorMsg(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setErrorMsg("We couldn't connect to the server. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupEmail.trim() || !signupPassword || !storeName.trim() || !name.trim()) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: signupEmail.trim(),
          password: signupPassword,
          storeName: storeName.trim(),
          contactNumber: contactNumber.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        if (data.emailFailed) {
          setErrorMsg(data.message || "Your account was created, but we couldn't send the verification email. Please try sending the verification email again.");
          setUnverifiedEmail(signupEmail.trim());
        } else {
          setSuccessMsg(data.message || "Your account has been created. Please check your email and click the verification link to activate your account.");
        }
      } else {
        if (res.status === 409) {
          setErrorMsg("An account with this email already exists. Try signing in instead.");
        } else if (res.status === 400) {
          setErrorMsg(data.error || "Please fill in all required fields: your name, store name, email, and password.");
        } else {
          setErrorMsg(data.error || "Something went wrong creating your account. Please try again.");
        }
      }
    } catch {
      setErrorMsg("We couldn't connect to the server. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;
    setResendLoading(true);
    setResendMsg("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unverifiedEmail }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setResendMsg(data.message || "A new verification link has been sent to your email.");
      } else {
        setResendMsg(data.error || "We couldn't resend the email. Please try again.");
      }
    } catch {
      setResendMsg("We couldn't resend the email. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setForgotLoading(true);
    setErrorMsg("");
    setForgotSuccess("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        setForgotSuccess(data.message || "If an account exists with that email, we've sent password reset instructions.");
      } else {
        setErrorMsg(data.error || "Could not process request. Please try again.");
      }
    } catch {
      setErrorMsg("Connection error. Please check your internet and try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  // While checking auth state, show a fast sleek loading state
  if (isLoading) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white shadow-md border border-slate-200 text-xs font-semibold text-slate-700">
          <div className="w-4 h-4 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
          <span>Checking session...</span>
        </div>
      </div>
    );
  }

  // If already authenticated, show brief signing in state while redirecting
  if (isAuthenticated) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white shadow-md border border-slate-200 text-xs font-semibold text-slate-700">
          <div className="w-4 h-4 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
          <span>Signing you in...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-xl border border-slate-200/80 space-y-5">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-700 mx-auto flex items-center justify-center text-white font-bold shadow-lg shadow-sky-500/20">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">BizPilot Platform</h1>
          <p className="text-xs text-slate-500">
            AI Operations & Business Management for Philippine MSMEs
          </p>
        </div>

        {/* Contextual message when redirected from a protected page */}
        {returnTo && !errorMsg && !successMsg && (
          <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs font-medium flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
            <span>Please log in to continue. You'll be taken right back to where you were.</span>
          </div>
        )}

        {/* Tab Switcher (shown for SIGNIN and SIGNUP) */}
        {mode !== "FORGOT" ? (
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setMode("SIGNIN");
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className={`py-2 rounded-xl transition-all ${
                mode === "SIGNIN"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("SIGNUP");
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
                mode === "SIGNUP"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-purple-700 hover:text-purple-900"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              30-Day Free Trial
            </button>
          </div>
        ) : (
          <div className="p-2 bg-purple-50 rounded-2xl text-xs font-bold text-center text-purple-900 flex items-center justify-center gap-1.5">
            <KeyRound className="w-4 h-4 text-purple-600" />
            Reset Forgotten Password
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold space-y-2">
            <p>{errorMsg}</p>
            {unverifiedEmail && (
              <div className="pt-1 border-t border-rose-200">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  className="text-xs font-bold text-purple-700 hover:text-purple-900 underline disabled:opacity-50"
                >
                  {resendLoading ? "Sending..." : "Resend verification email"}
                </button>
                {resendMsg && (
                  <p className="text-xs text-emerald-700 mt-1 font-medium">{resendMsg}</p>
                )}
              </div>
            )}
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* ─── Registration Success State ─── */}
        {successMsg && mode === "SIGNUP" ? (
          <div className="space-y-4 py-2">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <Mail className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Check Your Email</h2>
              <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                We sent a verification link to <strong>{signupEmail}</strong>. Click the link in the email to activate your account.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
              <p className="font-bold text-slate-800">What to do next:</p>
              <div className="space-y-1.5">
                <div className="flex items-start gap-2"><span className="font-bold text-emerald-600">1.</span> Open your email inbox ({signupEmail})</div>
                <div className="flex items-start gap-2"><span className="font-bold text-emerald-600">2.</span> Find the email from BizPilot</div>
                <div className="flex items-start gap-2"><span className="font-bold text-emerald-600">3.</span> Click the verification link</div>
                <div className="flex items-start gap-2"><span className="font-bold text-emerald-600">4.</span> Come back here and sign in</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Didn&apos;t get the email? Check your spam folder, or wait a minute and try signing in — you can request a new link from the sign-in page.</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setMode("SIGNIN");
                setEmail(signupEmail);
                setSuccessMsg("");
              }}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition-all flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              Go to Sign In
            </button>
          </div>
        ) : mode === "FORGOT" ? (
          /* ─── Forgot Password Mode ─── */
          forgotSuccess ? (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="text-sm font-bold text-emerald-900">{forgotSuccess}</p>
                <p className="text-xs text-slate-600">
                  Please check your inbox and click the link to set a new password.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMode("SIGNIN");
                  setForgotSuccess("");
                  setErrorMsg("");
                }}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all text-center"
              >
                Return to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-3.5">
              <p className="text-xs text-slate-600">
                Enter your registered email address and we&apos;ll send you instructions to reset your password.
              </p>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="your.email@store.ph"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all font-medium text-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={forgotLoading || !forgotEmail.trim()}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {forgotLoading ? "Sending reset link..." : "Send Reset Instructions"}
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("SIGNIN");
                  setErrorMsg("");
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all text-center"
              >
                Cancel and Return to Sign In
              </button>
            </form>
          )
        ) : mode === "SIGNIN" ? (
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="your.email@store.ph"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all font-medium text-slate-900"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setMode("FORGOT");
                    setForgotEmail(email);
                    setErrorMsg("");
                  }}
                  className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all font-medium text-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Signing you in..." : "Sign In to Your Store"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* Sign Up / 30-Day Free Trial Form */
          <form onSubmit={handleSignup} className="space-y-3">
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-[11px] text-purple-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
              <span>
                <strong>30-Day Free Trial Included:</strong> No credit card required. Full access to inbox, calendar, orders, and AI Copilot.
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Store / Business Name</label>
              <div className="relative">
                <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Mike's Laptop Hub / TechMart PH"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all font-medium text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Owner Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Michael Reyes"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all font-medium text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mobile Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="0917-xxx-xxxx"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all font-medium text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="your.email@gmail.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all font-medium text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Create Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all font-medium text-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !signupEmail || !signupPassword || !storeName || !name}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Setting Up Your Store..." : "Start 30-Day Free Trial →"}
            </button>
          </form>
        )}

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <Link href="/" className="hover:text-purple-600 transition-colors">
            ← Return to Dashboard
          </Link>
          <Link href="/pricing" className="hover:text-purple-600 transition-colors font-semibold">
            View Plans →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="text-xs font-medium text-slate-400 animate-pulse">Loading...</div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
