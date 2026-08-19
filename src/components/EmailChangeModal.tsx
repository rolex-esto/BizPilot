"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  Mail,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  X,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Lock,
} from "lucide-react";

interface EmailChangeModalProps {
  isOpen: boolean;
  currentEmail: string;
  onClose: () => void;
  onSuccess: (newEmail: string) => void;
}

export function EmailChangeModal({
  isOpen,
  currentEmail,
  onClose,
  onSuccess,
}: EmailChangeModalProps) {
  // Steps: 1 = Request Current OTP, 2 = Verify Current OTP, 3 = Enter New Email, 4 = Verify New OTP, 5 = Success
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [requestId, setRequestId] = useState<string>("");
  const [maskedCurrentEmail, setMaskedCurrentEmail] = useState<string>("");
  const [currentOtp, setCurrentOtp] = useState<string>("");
  const [newEmail, setNewEmail] = useState<string>("");
  const [maskedNewEmail, setMaskedNewEmail] = useState<string>("");
  const [newOtp, setNewOtp] = useState<string>("");
  const [finalNewEmail, setFinalNewEmail] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [cooldown, setCooldown] = useState<number>(0);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600);

  const currentOtpRef = useRef<HTMLInputElement>(null);
  const newOtpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setRequestId("");
      setMaskedCurrentEmail("");
      setCurrentOtp("");
      setNewEmail("");
      setMaskedNewEmail("");
      setNewOtp("");
      setFinalNewEmail("");
      setErrorMsg("");
      setLoading(false);
      setCooldown(0);
      setExpiresAt(null);
    }
  }, [isOpen]);

  // Expiration countdown
  useEffect(() => {
    if (!expiresAt || (step !== 2 && step !== 4)) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        setErrorMsg("The verification code has expired. Please request a new code.");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, step]);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Focus inputs on step changes
  useEffect(() => {
    if (step === 2 && currentOtpRef.current) {
      currentOtpRef.current.focus();
    } else if (step === 4 && newOtpRef.current) {
      newOtpRef.current.focus();
    }
  }, [step]);

  if (!isOpen) return null;

  // STEP 1 -> Request Current Email OTP
  const handleSendCurrentOtp = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/settings/account/email-change/request-current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.cooldownRemaining) setCooldown(data.cooldownRemaining);
        setErrorMsg(data.error || "Failed to send verification code to your current email.");
        return;
      }

      setRequestId(data.requestId);
      setMaskedCurrentEmail(data.maskedCurrentEmail || currentEmail);
      if (data.expiresAt) setExpiresAt(new Date(data.expiresAt));
      setCooldown(60);
      setStep(2);
    } catch {
      setErrorMsg("Network connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 2 -> Verify Current Email OTP
  const handleVerifyCurrentOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentOtp.trim().length !== 6) {
      setErrorMsg("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/settings/account/email-change/verify-current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          otp: currentOtp.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Incorrect verification code.");
        return;
      }

      setStep(3);
    } catch {
      setErrorMsg("Network connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 3 -> Submit New Email & Send New OTP
  const handleSendNewOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes("@")) {
      setErrorMsg("Please enter a valid new email address.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/settings/account/email-change/request-new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          newEmail: newEmail.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.cooldownRemaining) setCooldown(data.cooldownRemaining);
        setErrorMsg(data.error || "Failed to send verification code to your new email.");
        return;
      }

      setMaskedNewEmail(data.maskedNewEmail || newEmail.trim());
      if (data.expiresAt) setExpiresAt(new Date(data.expiresAt));
      setCooldown(60);
      setStep(4);
    } catch {
      setErrorMsg("Network connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 4 -> Verify New Email OTP & Finalize
  const handleVerifyNewOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newOtp.trim().length !== 6) {
      setErrorMsg("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/settings/account/email-change/verify-new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          otp: newOtp.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Incorrect verification code.");
        return;
      }

      setFinalNewEmail(data.newEmail || newEmail.trim());
      setStep(5);
      onSuccess(data.newEmail || newEmail.trim());
    } catch {
      setErrorMsg("Network connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-change-modal-title"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider block">
                {step === 1 && "Security Step 1 of 2"}
                {step === 2 && "Step 1 • Current Email OTP"}
                {step === 3 && "Security Step 2 of 2"}
                {step === 4 && "Step 2 • New Email OTP"}
                {step === 5 && "Complete"}
              </span>
              <h3 id="email-change-modal-title" className="text-base font-black text-slate-900 tracking-tight">
                {step === 1 && "Change Account Email"}
                {step === 2 && "Verify Current Email"}
                {step === 3 && "Enter New Email Address"}
                {step === 4 && "Verify New Email Address"}
                {step === 5 && "Email Change Successful!"}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Indicator */}
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-purple-600" : "bg-purple-200"}`} />
          <div className={`h-1.5 flex-1 rounded-full ${step >= 3 ? "bg-purple-600" : "bg-slate-200"}`} />
          <div className={`h-1.5 flex-1 rounded-full ${step >= 4 ? "bg-purple-600" : "bg-slate-200"}`} />
          <div className={`h-1.5 flex-1 rounded-full ${step === 5 ? "bg-emerald-500" : "bg-slate-200"}`} />
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* ─── STEP 1: INITIAL CURRENT EMAIL CHALLENGE PROMPT ─── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <p className="text-xs text-slate-700 leading-relaxed">
                To protect your business from unauthorized account takeovers, changing your login email requires <strong>2-step verification</strong>:
              </p>
              <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1 font-medium">
                <li>Verify your <strong>current email</strong> with a 6-digit code.</li>
                <li>Enter and verify your <strong>new email</strong> with a second code.</li>
              </ol>
            </div>

            <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-100 space-y-1">
              <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Current Login Email</span>
              <p className="text-xs font-mono font-bold text-purple-950">
                {currentEmail}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendCurrentOtp}
                disabled={loading}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                Send Verification Code
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: VERIFY CURRENT EMAIL OTP ─── */}
        {step === 2 && (
          <form onSubmit={handleVerifyCurrentOtp} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-100 text-xs text-purple-900 space-y-1">
              <p className="font-semibold">
                We sent a 6-digit security code to your current email:
              </p>
              <p className="font-mono font-bold text-purple-950">
                {maskedCurrentEmail || currentEmail}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <label htmlFor="currentOtpInput">Enter 6-Digit Code</label>
                <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-purple-600" />
                  Expires in {formatTimer(secondsRemaining)}
                </span>
              </div>
              <input
                ref={currentOtpRef}
                id="currentOtpInput"
                type="text"
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="123456"
                value={currentOtp}
                onChange={(e) => setCurrentOtp(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full p-3.5 text-center text-2xl font-mono font-black tracking-[0.4em] rounded-2xl border border-slate-300 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 text-slate-900 shadow-inner"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleSendCurrentOtp}
                disabled={loading || cooldown > 0}
                className="text-xs font-bold text-purple-700 hover:text-purple-900 disabled:text-slate-400 transition-colors flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </button>

              <button
                type="submit"
                disabled={loading || currentOtp.trim().length !== 6}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                Verify & Continue
              </button>
            </div>
          </form>
        )}

        {/* ─── STEP 3: ENTER NEW EMAIL ─── */}
        {step === 3 && (
          <form onSubmit={handleSendNewOtp} className="space-y-4">
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Current email verified! Now enter your new email address.</span>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="newEmailInput" className="block text-xs font-bold text-slate-700">
                New Login Email Address *
              </label>
              <input
                id="newEmailInput"
                type="email"
                required
                autoFocus
                placeholder="newowner@store.ph"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 text-xs font-semibold text-slate-900"
              />
              <p className="text-[11px] text-slate-500">
                We will send a confirmation code to this new address before making any changes.
              </p>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
              <button
                type="submit"
                disabled={loading || !newEmail.trim() || !newEmail.includes("@")}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                Send Code to New Email
              </button>
            </div>
          </form>
        )}

        {/* ─── STEP 4: VERIFY NEW EMAIL OTP ─── */}
        {step === 4 && (
          <form onSubmit={handleVerifyNewOtp} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-900 space-y-1">
              <p className="font-semibold">
                We sent a 6-digit confirmation code to your new email:
              </p>
              <p className="font-mono font-bold text-indigo-950">
                {maskedNewEmail || newEmail}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <label htmlFor="newOtpInput">Enter 6-Digit Code</label>
                <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-indigo-600" />
                  Expires in {formatTimer(secondsRemaining)}
                </span>
              </div>
              <input
                ref={newOtpRef}
                id="newOtpInput"
                type="text"
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="123456"
                value={newOtp}
                onChange={(e) => setNewOtp(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full p-3.5 text-center text-2xl font-mono font-black tracking-[0.4em] rounded-2xl border border-slate-300 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 text-slate-900 shadow-inner"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleSendNewOtp}
                disabled={loading || cooldown > 0}
                className="text-xs font-bold text-indigo-700 hover:text-indigo-900 disabled:text-slate-400 transition-colors flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>

              <button
                type="submit"
                disabled={loading || newOtp.trim().length !== 6}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Confirm & Update Email
              </button>
            </div>
          </form>
        )}

        {/* ─── STEP 5: SUCCESS ─── */}
        {step === 5 && (
          <div className="py-4 space-y-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-black text-slate-900">Email Changed Successfully!</h4>
              <p className="text-xs text-slate-500">
                Your login email address has been updated to:
              </p>
              <p className="text-sm font-mono font-black text-emerald-700 pt-0.5">
                {finalNewEmail || newEmail}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed text-left space-y-1">
              <p className="font-bold text-slate-800">What happens next:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Use this new email the next time you log into BizPilot.</li>
                <li>Your session has been updated with verified status.</li>
                <li>Store notifications will now be delivered to your new address.</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition-all"
            >
              Done & Return to Settings
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
