"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  ShoppingBag,
  Package,
  Sparkles,
  Radio,
  Terminal,
  Store,
  Calendar,
  BookOpen,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  User,
  Settings,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function NavigationHeader() {
  const pathname = usePathname();
  const { user: currentUser, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [subInfo, setSubInfo] = useState<{ status: string; isLifetime: boolean; planTier?: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch live subscription status
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      setSubInfo(null);
      return;
    }

    let isMounted = true;
    async function loadSub() {
      try {
        const res = await fetch("/api/subscription/status");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setSubInfo({
              status: data.status,
              isLifetime: Boolean(data.isLifetime || data.status === "LIFETIME"),
              planTier: data.planTier || "PRO",
            });
          }
        }
      } catch {}
    }
    loadSub();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, currentUser]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
    await logout();
  };

  const navLinks = [
    { href: "/", label: "Dashboard", icon: <LayoutDashboard className="w-3.5 h-3.5 text-slate-500" /> },
    { href: "/inbox", label: "Messages", icon: <Inbox className="w-3.5 h-3.5 text-sky-600" /> },
    { href: "/orders", label: "Orders", icon: <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" /> },
    { href: "/calendar", label: "Calendar", icon: <Calendar className="w-3.5 h-3.5 text-purple-600" /> },
    { href: "/inventory", label: "Products", icon: <Package className="w-3.5 h-3.5 text-amber-600" /> },
    { href: "/copilot", label: "AI Copilot", icon: <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> },
    { href: "/channels", label: "Channels", icon: <Radio className="w-3.5 h-3.5 text-purple-600" /> },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15">
          
          {/* Brand & Store */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0 pr-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-600 to-indigo-700 flex items-center justify-center text-white font-bold shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <Store className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-slate-900 text-base tracking-tight leading-none">BizPilot</span>
                {subInfo?.isLifetime ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-gradient-to-r from-amber-100 to-purple-100 text-purple-900 border border-amber-300 leading-none whitespace-nowrap shadow-2xs">
                    <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                    Lifetime Pro
                  </span>
                ) : subInfo?.status === "ACTIVE" ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-purple-100 text-purple-800 leading-none whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600 inline-block" />
                    {subInfo.planTier} Plan
                  </span>
                ) : subInfo?.status === "TRIAL" ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 leading-none whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                    30-Day Trial
                  </span>
                ) : currentUser?.role === "ADMIN" ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-100 text-indigo-800 leading-none whitespace-nowrap">
                    Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-slate-100 text-slate-700 leading-none whitespace-nowrap">
                    MSME
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-medium hidden xl:block leading-tight mt-0.5">
                Philippine MSME Operations
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-slate-100 text-slate-900 font-bold shadow-xs"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Action Tools & User Menu */}
          <div className="hidden lg:flex items-center gap-1.5 shrink-0 pl-2">
            <Link
              href="/simulator"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                pathname === "/simulator"
                  ? "bg-slate-950 text-white"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Practice</span>
            </Link>

            <Link
              href="/guide"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                pathname === "/guide"
                  ? "bg-purple-100 text-purple-900 border-purple-300"
                  : "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-purple-600" />
              <span>Guide</span>
            </Link>

            {currentUser?.role === "ADMIN" && (
              <Link
                href="/admin"
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  pathname === "/admin"
                    ? "bg-indigo-100 text-indigo-900"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Admin</span>
              </Link>
            )}

            <div className="h-4 w-px bg-slate-200 mx-1" />

            {/* Authenticated User Menu Dropdown */}
            {isAuthenticated && currentUser ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className={`flex items-center gap-2 p-1.5 rounded-xl border transition-all text-left ${
                    userDropdownOpen || pathname === "/settings"
                      ? "bg-purple-50 border-purple-300 text-purple-950 ring-2 ring-purple-100"
                      : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800"
                  }`}
                >
                  <div className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div className="flex flex-col leading-tight pr-0.5">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[85px]">
                      {currentUser.name}
                    </span>
                    <span className="text-[9px] text-purple-700 font-semibold">
                      {currentUser.role === "ADMIN" ? "Admin" : "Store Owner"}
                    </span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${userDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {/* User Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3.5 py-2.5 border-b border-slate-100 space-y-0.5">
                      <p className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{currentUser.email}</p>
                    </div>

                    <div className="py-1">
                      <Link
                        href="/settings"
                        onClick={() => setUserDropdownOpen(false)}
                        className={`w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium transition-colors ${
                          pathname === "/settings"
                            ? "bg-purple-50 text-purple-700 font-bold"
                            : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <Settings className="w-4 h-4 text-purple-600" />
                        Account Settings
                      </Link>

                      <Link
                        href="/guide"
                        onClick={() => setUserDropdownOpen(false)}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      >
                        <BookOpen className="w-4 h-4 text-sky-600" />
                        Operations Guide
                      </Link>

                      <Link
                        href="/pricing"
                        onClick={() => setUserDropdownOpen(false)}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      >
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        Subscription Plans
                      </Link>
                    </div>

                    <div className="pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login?mode=signup"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Free Trial
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-1.5 lg:hidden">
            {isAuthenticated ? (
              <Link
                href="/settings"
                className={`p-2 rounded-xl border ${
                  pathname === "/settings"
                    ? "text-purple-700 bg-purple-50 border-purple-200"
                    : "text-slate-600 bg-white border-slate-200"
                }`}
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-2.5 py-1.5 rounded-lg bg-purple-600 text-white font-bold text-xs"
              >
                Sign In
              </Link>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 pt-3 pb-5 space-y-3 animate-in slide-in-from-top-2 duration-150">
          {/* Show user info on mobile */}
          {isAuthenticated && currentUser && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
              <Link
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center text-xs font-bold">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-900">{currentUser.name}</span>
                  <span className="block text-[10px] text-purple-600 font-semibold">
                    {currentUser.role === "ADMIN" ? "Administrator" : "Store Owner"}
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-slate-900 text-white font-bold shadow-xs"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
            <Link
              href="/simulator"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              Practice
            </Link>

            <Link
              href="/guide"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200"
            >
              <BookOpen className="w-3.5 h-3.5 text-purple-600" />
              Guide
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
