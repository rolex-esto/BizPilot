"use client";

import React from "react";
import { LayoutDashboard } from "lucide-react";
import { ModuleIntroModal, AboutPageButton, useModuleIntro, ModuleIntroConfig } from "./ModuleIntroModal";

const DASHBOARD_CONFIG: ModuleIntroConfig = {
  moduleKey: "dashboard",
  title: "Your Business Dashboard",
  badge: "Overview",
  icon: <LayoutDashboard className="w-6 h-6 text-purple-600" />,
  subtitle: "See what's happening in your business today without checking everything one by one.",
  whatYouCanDo: [
    "See today's sales and any discounts you've given",
    "Check what needs your attention — orders, meetups, deliveries",
    "View today's schedule (customer meetups, LBC drop-offs, courier pickups)",
    "See how your sales are split between meetups, LBC, and courier deliveries",
  ],
  whyItMatters:
    "Start your day here so you know exactly what needs your attention — no need to check multiple apps or spreadsheets.",
  nextAction: "Check today's schedule or review your pending orders.",
  nextActionLink: "/orders",
  nextActionLabel: "View Orders",
};

export function DashboardIntroHeader() {
  const { isOpen, openIntro, closeIntro } = useModuleIntro("dashboard");

  return (
    <>
      <AboutPageButton onClick={openIntro} />
      <ModuleIntroModal config={DASHBOARD_CONFIG} isOpen={isOpen} onClose={closeIntro} />
    </>
  );
}
