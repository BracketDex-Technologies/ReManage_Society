"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import { Users, Search, Phone, Mail, Car, Home, ChevronDown, ChevronUp } from "lucide-react";
import { ModuleEmptyState, ModulePageHeader } from "@/components/ux/ModulePageKit";

interface DirectoryEntry {
  flatNumber: string;
  wing: string | null;
  floor: number | null;
  ownerName: string;
  tenantName: string | null;
  currentOccupant: string | null;
  flatType: string | null;
  vehicleNumber: string | null;
  contact: string | null;
  email: string | null;
  members: Array<{ name: string; role: string; phone: string | null; email: string | null }>;
}

export default function DirectoryPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [wings, setWings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedWing, setSelectedWing] = useState("all");
  const [expandedFlat, setExpandedFlat] = useState<string | null>(null);

  const fetchDirectory = useCallback(() => {
    setLoading(true);
    fetch("/api/directory")
      .then((r) => r.json())
      .then((d) => {
        setDirectory(d.directory || []);
        setWings(d.wings || []);
      })
      .catch(() => toastT.error("Failed to load directory"))
      .finally(() => setLoading(false));
  }, [toastT]);

  useEffect(() => { 
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDirectory(); 
  }, [fetchDirectory]);

  const filtered = directory.filter((d) => {
    if (selectedWing !== "all" && (d.wing || "General") !== selectedWing) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.flatNumber.toLowerCase().includes(q) ||
        d.ownerName.toLowerCase().includes(q) ||
        (d.tenantName || "").toLowerCase().includes(q) ||
        (d.contact || "").includes(q);
    }
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 px-4 sm:px-6 lg:px-0 pb-20">
      <ModulePageHeader
        icon={Users}
        title={t("Resident Directory")}
        description={t("Find residents, occupants, vehicles, and verified contact details.")}
        meta={`${directory.length} ${t("flats")}`}
        tone="blue"
      />

      <div className="rounded-[1.5rem] border border-border/60 bg-white p-3 shadow-sm sm:p-4 dark:bg-[#1E1E1E]">
        <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input className="input !rounded-xl !bg-surface/50 !border-border/60 !pl-11 pr-4 py-2.5 text-xs sm:text-sm font-semibold w-full" placeholder={t("Search by name, flat, phone...")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setSelectedWing("all")} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${selectedWing === "all" ? "bg-primary text-white" : "bg-surface text-text-secondary hover:bg-primary/5"}`}>{t("All Wings")}</button>
          {wings.map((w) => (
            <button key={w} onClick={() => setSelectedWing(w)} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${selectedWing === w ? "bg-primary text-white" : "bg-surface text-text-secondary hover:bg-primary/5"}`}>{w}</button>
          ))}
        </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4"><div className="spinner !w-8 !h-8" /></div>
      ) : filtered.length === 0 ? (
        <ModuleEmptyState
          icon={Users}
          title={t("No residents found")}
          description={t("Try a different search term or wing filter.")}
          tone="blue"
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => {
            const key = `${entry.wing}-${entry.flatNumber}`;
            const isExpanded = expandedFlat === key;
            return (
              <div key={key} className="bg-white rounded-2xl border border-border/50 overflow-hidden transition-all hover:shadow-sm">
                <button onClick={() => setExpandedFlat(isExpanded ? null : key)} className="w-full flex items-center justify-between p-4 sm:p-5 text-left">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {entry.wing ? `${entry.wing}-` : ""}{entry.flatNumber}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-text-primary truncate">{entry.ownerName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {entry.currentOccupant === "tenant" && entry.tenantName && (
                          <span className="text-[10px] text-violet-600 font-medium bg-violet-50 px-2 py-0.5 rounded-full">{t("Tenant")}: {entry.tenantName}</span>
                        )}
                        {entry.flatType && <span className="text-[10px] text-text-tertiary">{entry.flatType}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {entry.contact && (
                      <a href={`tel:${entry.contact}`} onClick={(e) => e.stopPropagation()} className="p-2 rounded-lg hover:bg-primary/5 text-primary">
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-text-tertiary" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 pt-0 border-t border-border/30 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      {entry.contact && (
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          <Phone className="w-3.5 h-3.5 text-text-tertiary" /> {entry.contact}
                        </div>
                      )}
                      {entry.email && (
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          <Mail className="w-3.5 h-3.5 text-text-tertiary" /> {entry.email}
                        </div>
                      )}
                      {entry.vehicleNumber && (
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          <Car className="w-3.5 h-3.5 text-text-tertiary" /> {entry.vehicleNumber}
                        </div>
                      )}
                      {entry.floor && (
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          <Home className="w-3.5 h-3.5 text-text-tertiary" /> {t("Floor")} {entry.floor}
                        </div>
                      )}
                    </div>
                    {entry.members.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2">{t("MEMBERS")}</p>
                        {entry.members.map((m, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-text-primary">{m.name}</span>
                              <span className="text-[9px] text-text-tertiary bg-surface px-1.5 py-0.5 rounded">{t(m.role)}</span>
                            </div>
                            {m.phone && <span className="text-[10px] text-text-secondary font-mono">{m.phone}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
