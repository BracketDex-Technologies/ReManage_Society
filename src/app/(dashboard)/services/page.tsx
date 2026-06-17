"use client";

import {
  Briefcase,
  Building2,
  Car,
  ClipboardList,
  CreditCard,
  FileBadge,
  MessageCircleMore,
  Package,
  Phone,
  ShoppingBag,
  Wrench,
} from "lucide-react";
import MobileHubPage from "@/components/mobile/MobileHubPage";
import { useI18n } from "@/lib/i18n";
import { useUser } from "@/lib/user-context";
import { canUseResidentSelfService } from "@/lib/roles";

const RESIDENT_ONLY_HREFS = new Set([
  "/move-wizard",
  "/noc",
  "/my-bills",
  "/my-visitors",
  "/amenities",
  "/marketplace",
  "/parking/marketplace",
]);

export default function ServicesPage() {
  const { t } = useI18n();
  const { user } = useUser();
  const canUseResidentFeatures = canUseResidentSelfService(user?.role);

  const links = [
    {
      href: "/move-wizard",
      label: t("Move-In / Out"),
      description: t("Upload documents, pay shifting fee, get gate pass"),
      icon: ClipboardList,
      accent: "bg-[#F5F3FF] text-[#8B5CF6]",
    },
    {
      href: "/noc",
      label: t("Society NOC"),
      description: t("Instant clearance certificate when dues are zero"),
      icon: FileBadge,
      accent: "bg-[#ECFDF5] text-[#059669]",
    },
    {
      href: "/my-bills",
      label: t("My Bills"),
      description: t("Pay maintenance and view dues"),
      icon: CreditCard,
      accent: "bg-[#EFF6FF] text-[#2563EB]",
    },
    {
      href: "/amenities",
      label: t("Amenity Booking"),
      description: t("Book clubhouse, gym, and facilities"),
      icon: Building2,
      accent: "bg-[#F5F3FF] text-[#8B5CF6]",
    },
    {
      href: "/staff",
      label: t("Staff & Daily Help"),
      description: t("Domestic help and staff payments"),
      icon: Briefcase,
      accent: "bg-[#ECFDF5] text-[#059669]",
    },
    {
      href: "/packages",
      label: t("Parcel Desk"),
      description: t("Track deliveries and pickups"),
      icon: Package,
      accent: "bg-[#FEF2F2] text-[#EF4444]",
    },
    {
      href: "/parking",
      label: t("Parking"),
      description: t("Parking slots and marketplace"),
      icon: Car,
      accent: "bg-[#EFF6FF] text-[#2563EB]",
    },
    {
      href: "/marketplace",
      label: t("Buy & Sell"),
      description: t("Community marketplace listings"),
      icon: ShoppingBag,
      accent: "bg-[#FFF7ED] text-[#F97316]",
    },
    {
      href: "/complaints",
      label: t("Helpdesk"),
      description: t("Complaints and requests"),
      icon: Wrench,
      accent: "bg-[#FEF3C7] text-[#D97706]",
    },
    {
      href: "/emergency",
      label: t("SOS & Safety"),
      description: t("Emergency contacts and SOS"),
      icon: Phone,
      accent: "bg-[#FEF2F2] text-[#DC2626]",
    },
  ].filter((link) => canUseResidentFeatures || !RESIDENT_ONLY_HREFS.has(link.href));

  return (
    <MobileHubPage
      title={t("Services")}
      subtitle={t("Bookings, help, and daily society services")}
      icon={MessageCircleMore}
      iconAccent="bg-[#FFF7ED] text-[#F97316]"
      links={links}
    />
  );
}
