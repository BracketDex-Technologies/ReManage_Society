"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export interface HubLink {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
}

interface MobileHubPageProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  iconAccent: string;
  links: HubLink[];
}

export default function MobileHubPage({
  title,
  subtitle,
  icon: Icon,
  iconAccent,
  links,
}: MobileHubPageProps) {
  return (
    <div className="mx-auto max-w-[420px] space-y-5 pb-24 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconAccent}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-black text-text-primary">{title}</h1>
          <p className="text-xs font-semibold text-text-secondary">{subtitle}</p>
        </div>
      </div>

      <div className="grid gap-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center gap-3 rounded-2xl border border-[#FED7AA]/60 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 dark:border-[#303030] dark:bg-[#1E1E1E]"
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${link.accent}`}>
              <link.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-text-primary">{link.label}</p>
              <p className="text-xs font-medium text-text-secondary">{link.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
