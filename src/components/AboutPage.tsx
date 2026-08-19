"use client";

import React, { useState, useEffect } from "react";
import { Lock, Info, X, Check, HelpCircle } from "lucide-react";

export interface AboutPageProps {
  moduleKey: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  description: string;
  canDoList: string[];
  privacyNote?: string;
}

/**
 * Reusable Beginner-Friendly "About This Page" Component for Admin Modules.
 * Remembers dismissal preference in localStorage with "Show explanation" toggle.
 */
export function AboutPage({
  moduleKey,
  icon,
  title,
  subtitle,
  description,
  canDoList,
  privacyNote = "Passwords, private messages, and customer contact details are protected.",
}: AboutPageProps) {
  const storageKey = `bizpilot_admin_guide_${moduleKey}`;
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const seen = localStorage.getItem(storageKey);
    if (seen === "true") {
      setIsOpen(false);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    setIsOpen(false);
    localStorage.setItem(storageKey, "true");
  };

  const handleReopen = () => {
    setIsOpen(true);
    localStorage.removeItem(storageKey);
  };

  if (!mounted) return null;

  if (!isOpen) {
    return (
      <div className="flex justify-end pb-1">
        <button
          type="button"
          onClick={handleReopen}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-purple-700 hover:bg-purple-50/70 border border-slate-200 transition-all shadow-2xs"
          title="Explain this page"
        >
          <HelpCircle className="w-3.5 h-3.5 text-purple-600" />
          <span>About this page</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-50 via-purple-50/30 to-indigo-50/30 border border-purple-100/80 shadow-xs space-y-4 animate-in fade-in duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-white text-purple-700 shadow-xs border border-purple-100">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
                {subtitle || "About this page"}
              </span>
            </div>
            <h3 className="text-base font-black text-slate-900">{title}</h3>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl transition-all"
          title="Dismiss explanation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
        {description}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-100 space-y-1.5 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-800 block">What you can do here:</span>
          <ul className="space-y-1">
            {canDoList.map((item, idx) => (
              <li key={idx} className="text-xs text-slate-600 flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {privacyNote && (
          <div className="p-3.5 rounded-2xl bg-white border border-slate-100 space-y-1.5 shadow-2xs">
            <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-600" />
              Privacy & Data Protection:
            </span>
            <p className="text-xs text-slate-600 leading-relaxed">
              {privacyNote}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end pt-1">
        <button
          type="button"
          onClick={handleDismiss}
          className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
