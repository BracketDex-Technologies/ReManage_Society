"use client";

import {
  BookOpen,
  Building2,
  FileText,
  Megaphone,
  MessageSquare,
  Users,
  Vote,
} from "lucide-react";
import MobileHubPage from "@/components/mobile/MobileHubPage";
import { useI18n } from "@/lib/i18n";

export default function MySocietyPage() {
  const { t } = useI18n();

  return (
    <MobileHubPage
      title={t("My Society")}
      subtitle={t("Community updates, governance, and neighbours")}
      icon={Building2}
      iconAccent="bg-[#FFF7ED] text-[#F97316]"
      links={[
        {
          href: "/notices",
          label: t("Announcements"),
          description: t("Society updates"),
          icon: Megaphone,
          accent: "bg-[#FFF7ED] text-[#F97316]",
        },
        {
          href: "/forum",
          label: t("Discussion Forum"),
          description: t("Connect with neighbours"),
          icon: MessageSquare,
          accent: "bg-[#EFF6FF] text-[#2563EB]",
        },
        {
          href: "/events",
          label: t("Events & Calendar"),
          description: t("Upcoming society events"),
          icon: FileText,
          accent: "bg-[#F5F3FF] text-[#8B5CF6]",
        },
        {
          href: "/meetings",
          label: t("Meetings"),
          description: t("AGM, notices, and resolutions"),
          icon: FileText,
          accent: "bg-[#FEF3C7] text-[#D97706]",
        },
        {
          href: "/polls",
          label: t("Polls & Voting"),
          description: t("Participate in society polls"),
          icon: Vote,
          accent: "bg-[#ECFDF5] text-[#059669]",
        },
        {
          href: "/documents",
          label: t("Document Vault"),
          description: t("Society documents and records"),
          icon: BookOpen,
          accent: "bg-[#F3F4F6] text-[#374151]",
        },
        {
          href: "/directory",
          label: t("Resident Directory"),
          description: t("Find neighbours and contacts"),
          icon: Users,
          accent: "bg-[#EFF6FF] text-[#2563EB]",
        },
      ]}
    />
  );
}
