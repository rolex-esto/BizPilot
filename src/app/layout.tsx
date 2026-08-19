import type { Metadata } from "next";
import "./globals.css";
import { NavigationHeader } from "@/components/NavigationHeader";
import { SessionExpiredBanner } from "@/components/SessionExpiredBanner";
import { TrialExpiredGate } from "@/components/TrialExpiredGate";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "BizPilot — Your Business in One Place",
  description: "Manage customer messages, orders, payments, inventory, and deliveries for your online business.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
        <AuthProvider>
          {/* Responsive Navigation Header */}
          <NavigationHeader />

          {/* Session Expired Banner */}
          <SessionExpiredBanner />

          {/* Trial Expired Gate */}
          <TrialExpiredGate />

          {/* Main Content Area */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>BizPilot — Your Business in One Place</span>
              <span>Made for Filipino Online Sellers</span>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
