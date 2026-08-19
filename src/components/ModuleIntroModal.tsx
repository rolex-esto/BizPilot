"use client";

import React, { useState, useEffect } from "react";
import { X, HelpCircle, ArrowRight, CheckCircle, Sparkles } from "lucide-react";
import Link from "next/link";

export interface ModuleIntroConfig {
  moduleKey: string;
  title: string;
  badge?: string;
  icon: React.ReactNode;
  subtitle: string;
  whatYouCanDo: string[];
  whyItMatters: string;
  nextAction: string;
  nextActionLink?: string;
  nextActionLabel?: string;
}

interface ModuleIntroModalProps {
  config: ModuleIntroConfig;
  isOpen: boolean;
  onClose: () => void;
}

export function ModuleIntroModal({ config, isOpen, onClose }: ModuleIntroModalProps) {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDismissForever = () => {
    try {
      localStorage.setItem(`bizpilot_intro_dismissed_${config.moduleKey}`, "true");
    } catch {
      // Ignore
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 relative max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="module-intro-title"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Close introduction modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Icon & Title */}
        <div className="flex items-start gap-3.5 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0 shadow-sm">
            {config.icon}
          </div>
          <div className="space-y-0.5">
            {config.badge && (
              <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-800 uppercase tracking-wide mb-1">
                {config.badge}
              </span>
            )}
            <h2 id="module-intro-title" className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              {config.title}
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">{config.subtitle}</p>
          </div>
        </div>

        {/* What you can do here */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 space-y-2.5">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            What you can do here:
          </h3>
          <ul className="space-y-1.5 text-xs text-slate-600">
            {config.whatYouCanDo.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-purple-600 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Why it matters */}
        <div className="bg-indigo-50/50 rounded-2xl p-3.5 border border-indigo-100 text-xs text-indigo-950 space-y-1">
          <div className="font-bold flex items-center gap-1 text-indigo-900">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            Why it matters to your business:
          </div>
          <p className="text-[11px] leading-relaxed text-indigo-900/80">{config.whyItMatters}</p>
        </div>

        {/* Next Action Box */}
        <div className="bg-amber-50/60 rounded-2xl p-3 border border-amber-200/70 text-xs text-amber-950 flex items-start gap-2">
          <span className="text-base leading-none">👉</span>
          <div className="space-y-0.5 flex-1">
            <span className="font-bold text-amber-900">Recommended Next Step: </span>
            <span className="text-[11px] text-amber-800">{config.nextAction}</span>
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <button
            onClick={handleDismissForever}
            className="text-xs font-medium text-slate-400 hover:text-slate-600 py-1 transition-colors text-center sm:text-left"
          >
            Don't show again
          </button>

          <div className="flex items-center gap-2 justify-end">
            {config.nextActionLink && config.nextActionLabel ? (
              <Link
                href={config.nextActionLink}
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                {config.nextActionLabel}
              </Link>
            ) : null}

            <button
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition-all text-center"
            >
              Got it, let's go!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Reusable Hook to automatically show modal on first visit and provide open/close controls
 */
export function useModuleIntro(moduleKey: string) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(`bizpilot_intro_dismissed_${moduleKey}`);
      if (!dismissed) {
        setIsOpen(true);
      }
    } catch {
      // Ignore
    }
  }, [moduleKey]);

  return {
    isOpen,
    openIntro: () => setIsOpen(true),
    closeIntro: () => setIsOpen(false),
  };
}

/**
 * Accessible "ⓘ About this page" button to place beside any page header
 */
export function AboutPageButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-purple-700 bg-slate-100 hover:bg-purple-50 rounded-lg border border-slate-200 hover:border-purple-200 transition-colors shadow-xs"
      title="Learn what you can do on this page"
      aria-label="About this page"
    >
      <HelpCircle className="w-3.5 h-3.5 text-purple-600" />
      <span>About this page</span>
    </button>
  );
}
