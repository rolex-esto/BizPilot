"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  Gift,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  X,
  ArrowRight,
  UserCheck,
  Mail,
  Trash2,
  UserX,
  ShieldAlert,
  CreditCard,
  Sparkles,
} from "lucide-react";

export type AdminApprovalActionType =
  | "GRANT_ADMIN"
  | "REVOKE_ADMIN"
  | "GRANT_LIFETIME"
  | "REVOKE_LIFETIME"
  | "DELETE_USER"
  | "DELETE_BUSINESS"
  | "CHANGE_PLAN"
  | "EXTEND_TRIAL"
  | "RESET_TRIAL"
  | "SET_SUBSCRIPTION_STATUS";

interface AdminApprovalModalProps {
  isOpen: boolean;
  initialAction?: AdminApprovalActionType;
  initialTargetEmail?: string;
  initialTargetId?: string;
  initialMetadata?: Record<string, any>;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function AdminApprovalModal({
  isOpen,
  initialAction = "GRANT_ADMIN",
  initialTargetEmail = "",
  initialTargetId = "",
  initialMetadata,
  onClose,
  onSuccess,
}: AdminApprovalModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const actionType = initialAction;
  const [targetEmail, setTargetEmail] = useState(initialTargetEmail);
  const [targetId, setTargetId] = useState(initialTargetId);

  // Plan Selection State (for CHANGE_PLAN)
  const [selectedPlan, setSelectedPlan] = useState<string>(initialMetadata?.requestedPlan || "PRO");
  const [selectedStatus, setSelectedStatus] = useState<string>(initialMetadata?.requestedStatus || "ACTIVE");
  const [extensionDays, setExtensionDays] = useState<number>(initialMetadata?.extensionDays || 14);

  // Preview & Request data
  const [preview, setPreview] = useState<any>(null);
  const [requestId, setRequestId] = useState<string>("");
  const [authorizedAdminEmail, setAuthorizedAdminEmail] = useState<string>("bizpilot.mailer@gmail.com");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  // OTP state
  const [otp, setOtp] = useState<string>("");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600); // 10 mins
  const [cooldown, setCooldown] = useState<number>(0);

  // Loading & error
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [executionResult, setExecutionResult] = useState<any>(null);

  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTargetEmail(initialTargetEmail);
      setTargetId(initialTargetId);
      setSelectedPlan(initialMetadata?.requestedPlan || "PRO");
      setSelectedStatus(initialMetadata?.requestedStatus || "ACTIVE");
      setExtensionDays(initialMetadata?.extensionDays || 14);
      setStep(1);
      setErrorMsg("");
      setSuccessMsg("");
      setExecutionResult(null);
      setOtp("");
      setPreview(null);
      setRequestId("");
    }
  }, [isOpen, initialAction, initialTargetEmail, initialTargetId, initialMetadata]);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (step !== 3 || !expiresAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        setErrorMsg("The approval code has expired. Please request a new code.");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [step, expiresAt]);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Focus OTP input on step 3
  useEffect(() => {
    if (step === 3 && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  if (!isOpen) return null;

  const getActionDetails = () => {
    switch (actionType) {
      case "CHANGE_PLAN":
        return {
          title: "Change Business Plan",
          icon: <CreditCard className="w-5 h-5" />,
          badgeColor: "bg-teal-100 text-teal-800",
          desc: "This changes the business's access to BizPilot features and tier limits. Because this affects subscription access, an additional security check is required.",
          inputLabel: "Business Owner Email *",
          inputPlaceholder: "owner@store.ph",
          inputHelper: "Enter the email associated with the business store.",
          btnColor: "bg-teal-600 hover:bg-teal-700 shadow-teal-600/20",
        };
      case "EXTEND_TRIAL":
        return {
          title: "Extend Trial Period",
          icon: <Clock className="w-5 h-5" />,
          badgeColor: "bg-sky-100 text-sky-800",
          desc: "Grant extra trial days to this business before subscription renewal is required.",
          inputLabel: "Business Owner Email *",
          inputPlaceholder: "owner@store.ph",
          inputHelper: "Enter the email of the business to extend trial.",
          btnColor: "bg-sky-600 hover:bg-sky-700 shadow-sky-600/20",
        };
      case "GRANT_ADMIN":
        return {
          title: "Grant Admin Access",
          icon: <ShieldCheck className="w-5 h-5" />,
          badgeColor: "bg-purple-100 text-purple-800",
          desc: "Give another BizPilot account permission to manage the platform. This is a sensitive action and requires email approval from the administrator.",
          inputLabel: "Recipient Account Email *",
          inputPlaceholder: "user@example.com",
          inputHelper: "Enter the registered email of the user you want to promote to Administrator.",
          btnColor: "bg-purple-600 hover:bg-purple-700 shadow-purple-600/20",
        };
      case "REVOKE_ADMIN":
        return {
          title: "Revoke Admin Access",
          icon: <UserX className="w-5 h-5" />,
          badgeColor: "bg-rose-100 text-rose-800",
          desc: "Demote an administrator account back to a standard Business Owner role.",
          inputLabel: "Administrator Account Email *",
          inputPlaceholder: "admin@example.com",
          inputHelper: "Enter the administrator email you want to demote to Business Owner.",
          btnColor: "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20",
        };
      case "GRANT_LIFETIME":
        return {
          title: "Grant Lifetime Access",
          icon: <Gift className="w-5 h-5" />,
          badgeColor: "bg-amber-100 text-amber-800",
          desc: "Give a business permanent access to BizPilot Pro features without a recurring subscription.",
          inputLabel: "Business Owner Email *",
          inputPlaceholder: "owner@store.ph",
          inputHelper: "Enter the email of the store owner to grant permanent Lifetime Access (PRO).",
          btnColor: "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20",
        };
      case "REVOKE_LIFETIME":
        return {
          title: "Revoke Lifetime Access",
          icon: <ShieldAlert className="w-5 h-5" />,
          badgeColor: "bg-amber-100 text-amber-800",
          desc: "Remove lifetime access and reset the store to a standard subscription plan.",
          inputLabel: "Business Owner Email *",
          inputPlaceholder: "owner@store.ph",
          inputHelper: "Enter the email of the store to remove lifetime access.",
          btnColor: "bg-amber-700 hover:bg-amber-800 shadow-amber-700/20",
        };
      case "DELETE_USER":
        return {
          title: "Delete User Account",
          icon: <Trash2 className="w-5 h-5" />,
          badgeColor: "bg-rose-100 text-rose-800",
          desc: "Permanently delete a user account and terminate all active login sessions.",
          inputLabel: "User Account Email *",
          inputPlaceholder: "user@example.com",
          inputHelper: "Enter the email of the user account to delete.",
          btnColor: "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20",
        };
      case "DELETE_BUSINESS":
        return {
          title: "Delete Store & Data",
          icon: <Trash2 className="w-5 h-5" />,
          badgeColor: "bg-rose-100 text-rose-800",
          desc: "Permanently delete a business tenant, catalog listings, orders, and customer records.",
          inputLabel: "Business Contact Email *",
          inputPlaceholder: "owner@store.ph",
          inputHelper: "Enter the store email to permanently delete.",
          btnColor: "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20",
        };
      default:
        return {
          title: "Admin Approval",
          icon: <KeyRound className="w-5 h-5" />,
          badgeColor: "bg-slate-100 text-slate-800",
          desc: "Protected administrative action requiring email security code verification.",
          inputLabel: "Target Email *",
          inputPlaceholder: "user@example.com",
          inputHelper: "Enter target email address.",
          btnColor: "bg-slate-900 hover:bg-slate-800",
        };
    }
  };

  const currentAction = getActionDetails();

  // Step 1 -> Request Approval & Send OTP
  const handleRequestApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmail.trim()) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const metaPayload: Record<string, any> = {
      ...(initialMetadata || {}),
    };

    if (actionType === "CHANGE_PLAN") {
      metaPayload.requestedPlan = selectedPlan;
      metaPayload.requestedStatus = selectedStatus;
    } else if (actionType === "EXTEND_TRIAL") {
      metaPayload.extensionDays = extensionDays;
    }

    try {
      const res = await fetch("/api/admin/approval/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType,
          targetEmail: targetEmail.trim(),
          targetId: targetId || undefined,
          metadata: metaPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.cooldownRemaining) {
          setCooldown(data.cooldownRemaining);
        }
        setErrorMsg(data.error || "Failed to initiate approval request.");
        return;
      }

      setPreview(data.preview);
      setRequestId(data.requestId);
      setAuthorizedAdminEmail(data.authorizedAdminEmail || "bizpilot.mailer@gmail.com");
      if (data.expiresAt) setExpiresAt(new Date(data.expiresAt));
      setCooldown(60);
      setStep(2);
    } catch {
      setErrorMsg("Network connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 -> Advance to OTP entry
  const handleProceedToOtp = () => {
    setStep(3);
    setErrorMsg("");
  };

  // Step 3 -> Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      setErrorMsg("Please enter the complete 6-digit approval code.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/admin/approval/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          otp: otp.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Invalid approval code.");
        return;
      }

      setStep(4);
    } catch {
      setErrorMsg("Network connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 4 -> Execute Action
  const handleExecuteConfirmedAction = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/admin/approval/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to execute approved action.");
        return;
      }

      setSuccessMsg(data.message || "Action completed successfully!");
      setExecutionResult(data);
      setStep(5);
      onSuccess(data.message);
    } catch {
      setErrorMsg("Network connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    setErrorMsg("");

    const metaPayload: Record<string, any> = {
      ...(initialMetadata || {}),
    };
    if (actionType === "CHANGE_PLAN") {
      metaPayload.requestedPlan = selectedPlan;
      metaPayload.requestedStatus = selectedStatus;
    }

    try {
      const res = await fetch("/api/admin/approval/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType,
          targetEmail: targetEmail.trim(),
          targetId: targetId || undefined,
          metadata: metaPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to resend approval code.");
        return;
      }

      setRequestId(data.requestId);
      if (data.expiresAt) setExpiresAt(new Date(data.expiresAt));
      setCooldown(60);
      setOtp("");
      setErrorMsg("");
    } catch {
      setErrorMsg("Network connection error.");
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${currentAction.badgeColor}`}>
              {currentAction.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                  Step {step} of 4 • Admin Security Check
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-900">
                {currentAction.title}
              </h3>
            </div>
          </div>

          {step !== 5 && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ─── STEP 1: Plan Selection / Target Entry ─── */}
        {step === 1 && (
          <form onSubmit={handleRequestApproval} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <p className="text-xs text-slate-600 leading-relaxed">
                {currentAction.desc}
              </p>
            </div>

            {actionType === "CHANGE_PLAN" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Choose New Subscription Plan *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPlan("STARTER")}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        selectedPlan === "STARTER"
                          ? "border-purple-600 bg-purple-50/80 ring-2 ring-purple-600/20 text-purple-950 font-bold"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <span className="text-xs font-black block">Starter</span>
                      <span className="text-[10px] text-slate-500 block">₱499/mo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPlan("BUSINESS")}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        selectedPlan === "BUSINESS"
                          ? "border-purple-600 bg-purple-50/80 ring-2 ring-purple-600/20 text-purple-950 font-bold"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <span className="text-xs font-black block">Business</span>
                      <span className="text-[10px] text-slate-500 block">₱999/mo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPlan("PRO")}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        selectedPlan === "PRO"
                          ? "border-purple-600 bg-purple-50/80 ring-2 ring-purple-600/20 text-purple-950 font-bold"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <span className="text-xs font-black block">Pro</span>
                      <span className="text-[10px] text-slate-500 block">₱1,999/mo</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Subscription Status *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedStatus("ACTIVE")}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                        selectedStatus === "ACTIVE"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-600/20"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      ● Active Paid
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedStatus("TRIAL")}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                        selectedStatus === "TRIAL"
                          ? "border-sky-600 bg-sky-50 text-sky-950 ring-2 ring-sky-600/20"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      30-Day Trial
                    </button>
                  </div>
                </div>
              </div>
            )}

            {actionType === "EXTEND_TRIAL" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Extension Duration *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[7, 14, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setExtensionDays(days)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                        extensionDays === days
                          ? "border-sky-600 bg-sky-50 text-sky-950 ring-2 ring-sky-600/20"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      +{days} Days
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                {currentAction.inputLabel}
              </label>
              <input
                type="email"
                required
                placeholder={currentAction.inputPlaceholder}
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                className="w-full text-xs p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
              <p className="text-[11px] text-slate-500">
                {currentAction.inputHelper}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 text-xs text-purple-950 flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-purple-900">Administrator Security Code Verification</strong>
                <span className="text-[11px] text-purple-800">
                  BizPilot sends a 6-digit security code to the authorized Administrator email:
                </span>
                <span className="block font-mono font-bold text-purple-900 pt-0.5">
                  bizpilot.mailer@gmail.com
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !targetEmail.trim()}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md shadow-slate-900/10 flex items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Checking Target...
                  </>
                ) : (
                  <>
                    Continue to Security Check <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ─── STEP 2: Review Preview ─── */}
        {step === 2 && preview && (
          <div className="space-y-4 animate-in fade-in">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Target Entity Preview
              </span>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Business / Store:</span>
                  <strong className="text-slate-900">{preview.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Contact Email:</span>
                  <strong className="text-slate-900">{preview.email}</strong>
                </div>
                {preview.currentPlan && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Current Plan:</span>
                    <span className="font-bold text-slate-700">{preview.currentPlan}</span>
                  </div>
                )}
                {preview.requestedPlan && (
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="text-slate-700 font-bold">New Requested Plan:</span>
                    <span className="font-extrabold text-teal-700">{preview.requestedPlan} ({preview.requestedStatus || "ACTIVE"})</span>
                  </div>
                )}
                {preview.extensionDays && (
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="text-slate-700 font-bold">Trial Extension:</span>
                    <span className="font-extrabold text-sky-700">+{preview.extensionDays} Additional Days</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Security Notice:</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Clicking below sends a one-time approval code to <strong>bizpilot.mailer@gmail.com</strong>.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Back
              </button>

              <button
                type="button"
                onClick={handleProceedToOtp}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Send Approval Code →
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Enter Security Code ─── */}
        {step === 3 && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in fade-in">
            <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-1 text-center">
              <span className="text-xs font-black text-purple-950 block">Security Check</span>
              <p className="text-xs text-slate-600">
                We sent a verification code to the BizPilot administrator email:
              </p>
              <p className="text-xs font-mono font-bold text-purple-800">bizpilot.mailer@gmail.com</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-center">
                <input
                  ref={otpInputRef}
                  type="text"
                  maxLength={6}
                  required
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="w-48 text-center text-2xl font-mono font-black tracking-widest py-3 border-2 border-purple-300 focus:border-purple-600 rounded-2xl bg-white shadow-xs focus:outline-none focus:ring-4 focus:ring-purple-600/10"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Code expires in: <strong>{formatTimer(secondsRemaining)}</strong>
                </span>

                <button
                  type="button"
                  disabled={cooldown > 0 || loading}
                  onClick={handleResendOtp}
                  className="text-purple-700 font-bold hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Back
              </button>

              <button
                type="submit"
                disabled={loading || otp.trim().length !== 6 || secondsRemaining <= 0}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md shadow-slate-900/10 flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify & Continue →
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ─── STEP 4: Final Confirmation ─── */}
        {step === 4 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>✓ Security code verified. Please confirm below.</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <h4 className="font-black text-slate-900 text-sm">
                Confirm {currentAction.title}
              </h4>

              <div className="space-y-1 text-slate-700">
                <p>Target: <strong className="text-slate-900">{preview?.name}</strong> ({preview?.email})</p>
                {preview?.currentPlan && (
                  <p className="text-slate-600">Current: <span className="font-bold text-slate-800">{preview?.currentPlan}</span></p>
                )}
                {preview?.requestedPlan && (
                  <p className="text-teal-700 font-bold">New Plan: {preview?.requestedPlan} ({preview?.requestedStatus || "ACTIVE"})</p>
                )}
                {preview?.extensionDays && (
                  <p className="text-sky-700 font-bold">Extension: +{preview?.extensionDays} Days</p>
                )}
                <p className="text-slate-500 text-[11px] pt-1">
                  This action will take effect immediately and create an immutable security audit entry.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleExecuteConfirmedAction}
                className={`px-5 py-2.5 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 ${currentAction.btnColor}`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    Confirm & Execute
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 5: Success ─── */}
        {step === 5 && (
          <div className="text-center py-6 space-y-4 animate-in fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-black text-slate-900">
                ✓ Plan Updated
              </h4>
              <p className="text-xs text-slate-600">{successMsg}</p>
            </div>

            {executionResult?.previousPlan && executionResult?.newPlan && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs max-w-xs mx-auto space-y-1 text-left">
                <div className="flex justify-between">
                  <span className="text-slate-500">Previous Plan:</span>
                  <span className="font-bold text-slate-700">{executionResult.previousPlan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">New Plan:</span>
                  <span className="font-black text-emerald-700">{executionResult.newPlan}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Effective:</span>
                  <span className="font-bold text-slate-800">Immediately</span>
                </div>
              </div>
            )}

            <div className="pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
