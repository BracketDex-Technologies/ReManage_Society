"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import MobileBackButton from "@/components/layout/MobileBackButton";
import MobileRuntime from "@/components/mobile/MobileRuntime";
import GuardRedirect from "@/components/layout/GuardRedirect";
import FlatLinkBanner from "@/components/ux/FlatLinkBanner";
import { usePushNotifications } from "@/lib/use-push";
import { UserProvider, useUser } from "@/lib/user-context";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useUser();
  const pathname = usePathname();
  const compactMain =
    !pathname.startsWith("/dashboard") &&
    pathname !== "/emergency" &&
    !pathname.startsWith("/emergency/");

  // Auto-subscribe to push notifications
  usePushNotifications();

  const handleMenuToggle = () => {
    setSidebarOpen(true);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#FEFDDF] dark:bg-[#171717] lg:bg-surface">
      <Sidebar
        societyName={user.societyName}
        societyAddress={user.societyAddress}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userRole={user.role}
        userId={user.id}
        societyId={user.societyId}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          userName={user.name}
          userRole={user.role}
          userEmail={user.email}
          joinCode={user.joinCode}
          onMenuToggle={handleMenuToggle}
        />
        <main
          className={`flex-1 overflow-y-auto p-3 pb-28 lg:p-6 lg:pb-6${compactMain ? " page-compact" : ""}`}
        >
          <MobileBackButton />
          <FlatLinkBanner />
          {children}
        </main>
      </div>
      <BottomNav userRole={user.role} userId={user.id} societyId={user.societyId} />
      <MobileRuntime />
      <GuardRedirect />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <DashboardShell>{children}</DashboardShell>
    </UserProvider>
  );
}
