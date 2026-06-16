"use client";

import { useMemo, useState } from "react";
import {
  Home,
  Plus,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Minus,
  X,
  Mail,
  Phone,
} from "lucide-react";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import {
  generateFlatCandidates,
  generateFloorRange,
  nextWingLabel,
} from "@/lib/flat-numbering";

export interface FlatLinkedUser {
  id: string;
  role: string;
  name: string;
  email: string;
  phone: string | null;
}

export interface FlatSetupItem {
  id: string;
  flatNumber: string;
  wing: string | null;
  floor: number | null;
  ownerName: string | null;
  contact: string | null;
  isActive: boolean;
  hasAccount: boolean;
  tenantName?: string | null;
  users: FlatLinkedUser[];
}

interface FlatSetupSectionProps {
  flats: FlatSetupItem[];
  flatsLoading: boolean;
  onRefresh: () => void;
}

type StatusFilter = "all" | "linked" | "open";

export default function FlatSetupSection({ flats, flatsLoading, onRefresh }: FlatSetupSectionProps) {
  const toastT = useTranslatedToast();
  const [flatsSaving, setFlatsSaving] = useState(false);
  const [showGenerator, setShowGenerator] = useState(true);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [selectedFlat, setSelectedFlat] = useState<FlatSetupItem | null>(null);

  const [wings, setWings] = useState<string[]>(["A"]);
  const [floorStart, setFloorStart] = useState("1");
  const [floorEnd, setFloorEnd] = useState("4");
  const [flatsPerFloor, setFlatsPerFloor] = useState("4");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [wingFilter, setWingFilter] = useState<string>("all");

  const [manualFlat, setManualFlat] = useState({ flatNumber: "", wing: "", floor: "" });

  const floorRange = useMemo(() => {
    const start = Number(floorStart);
    const end = Number(floorEnd);
    return generateFloorRange(start, end);
  }, [floorStart, floorEnd]);

  const candidates = useMemo(() => {
    const count = Number(flatsPerFloor);
    if (!wings.length || !floorRange.length || count < 1) return [];
    return generateFlatCandidates(wings, floorRange, count);
  }, [wings, floorRange, flatsPerFloor]);

  const existingNumbers = useMemo(() => new Set(flats.map((flat) => flat.flatNumber)), [flats]);
  const newCandidates = useMemo(
    () => candidates.filter((candidate) => !existingNumbers.has(candidate.flatNumber)),
    [candidates, existingNumbers]
  );

  const previewSamples = useMemo(() => {
    if (!candidates.length) return [];
    const samples = candidates.slice(0, 6);
    if (candidates.length > 8) {
      samples.push(...candidates.slice(-2));
    } else if (candidates.length > 6) {
      samples.push(...candidates.slice(6));
    }
    return samples;
  }, [candidates]);

  const wingOptions = useMemo(() => {
    const values = new Set<string>();
    for (const flat of flats) {
      if (flat.wing) values.add(flat.wing);
    }
    return Array.from(values).sort();
  }, [flats]);

  const stats = useMemo(() => {
    const linked = flats.filter((flat) => flat.hasAccount).length;
    return { total: flats.length, linked, open: flats.length - linked };
  }, [flats]);

  const filteredFlats = useMemo(() => {
    const query = search.trim().toLowerCase();
    return flats.filter((flat) => {
      if (statusFilter === "linked" && !flat.hasAccount) return false;
      if (statusFilter === "open" && flat.hasAccount) return false;
      if (wingFilter !== "all" && flat.wing !== wingFilter) return false;
      if (!query) return true;
      const haystack = [
        flat.flatNumber,
        flat.wing,
        flat.ownerName,
        flat.contact,
        ...flat.users.map((user) => `${user.name} ${user.email} ${user.phone}`),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [flats, search, statusFilter, wingFilter]);

  const groupedFlats = useMemo(() => {
    const groups = new Map<string, FlatSetupItem[]>();
    for (const flat of filteredFlats) {
      const key = flat.wing || "Other";
      const list = groups.get(key) || [];
      list.push(flat);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredFlats]);

  const addWing = () => {
    setWings((current) => [...current, nextWingLabel(current)]);
  };

  const removeWing = (index: number) => {
    setWings((current) => (current.length <= 1 ? current : current.filter((_, i) => i !== index)));
  };

  const updateWing = (index: number, value: string) => {
    setWings((current) => current.map((wing, i) => (i === index ? value.toUpperCase() : wing)));
  };

  const adjustFlatsPerFloor = (delta: number) => {
    setFlatsPerFloor((current) => {
      const next = Math.min(50, Math.max(1, Number(current || 1) + delta));
      return String(next);
    });
  };

  const createFlats = async () => {
    if (!newCandidates.length) {
      toastT.error("No new flats to create. Adjust settings or all flats already exist.");
      return;
    }
    setFlatsSaving(true);
    try {
      const res = await fetch("/api/settings/flats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wings: wings.join(","),
          floors: floorRange.join(","),
          flatsPerFloor,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toastT.success(`Created ${data.created} flats${data.skipped ? ` (${data.skipped} already existed)` : ""}`);
        onRefresh();
        if (flats.length + data.created > 0) setShowGenerator(false);
      } else {
        toastT.error(data.error || "Failed to create flats");
      }
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setFlatsSaving(false);
    }
  };

  const addManualFlat = async () => {
    const flatNumber = manualFlat.flatNumber.trim();
    if (!flatNumber) {
      toastT.error("Enter a flat number");
      return;
    }
    setFlatsSaving(true);
    try {
      const res = await fetch("/api/settings/flats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "single",
          flatNumber,
          wing: manualFlat.wing.trim() || undefined,
          floor: manualFlat.floor.trim() ? Number(manualFlat.floor) : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toastT.success("Flat added");
        setManualFlat({ flatNumber: "", wing: "", floor: "" });
        onRefresh();
      } else {
        toastT.error(data.error || "Failed to add flat");
      }
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setFlatsSaving(false);
    }
  };

  const setupValid = wings.every(Boolean) && floorRange.length > 0 && Number(flatsPerFloor) >= 1;

  return (
    <div className="space-y-6">
      {stats.total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total flats", value: stats.total },
            { label: "Linked", value: stats.linked },
            { label: "Available", value: stats.open },
          ].map((item) => (
            <div key={item.label} className="stat-card !p-4 text-center">
              <p className="text-2xl font-black text-text-primary">{item.value}</p>
              <p className="text-[11px] font-semibold text-text-secondary mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <button
          type="button"
          onClick={() => setShowGenerator((open) => !open)}
          className="w-full flex items-center justify-between gap-4 text-left"
        >
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Home className="w-4 h-4 text-primary" />
              {stats.total > 0 ? "Add More Flats" : "Set Up Your Flats"}
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              {stats.total > 0
                ? "Generate additional flats using your building layout."
                : "Tell us your building layout and we will create all flat numbers automatically."}
            </p>
          </div>
          {showGenerator ? <ChevronUp className="w-5 h-5 text-text-secondary shrink-0" /> : <ChevronDown className="w-5 h-5 text-text-secondary shrink-0" />}
        </button>

        {showGenerator && (
          <div className="mt-5 pt-5 border-t border-border space-y-5">
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className="label !mb-0">Wings / Blocks</label>
                <button type="button" onClick={addWing} className="btn btn-secondary btn-sm">
                  <Plus className="w-3.5 h-3.5" />
                  Add wing
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {wings.map((wing, index) => (
                  <div key={index} className="flex items-center gap-1 rounded-lg border border-border bg-surface pl-2 pr-1 py-1">
                    <input
                      className="!w-14 !p-1 !border-0 !bg-transparent !shadow-none text-sm font-bold uppercase text-center"
                      value={wing}
                      maxLength={4}
                      onChange={(e) => updateWing(index, e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                      aria-label={`Wing ${index + 1}`}
                    />
                    {wings.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeWing(index)}
                        className="p-1 rounded-md hover:bg-white text-text-secondary"
                        aria-label="Remove wing"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-text-secondary mt-2">
                Single-building societies can keep one wing, e.g. A or MAIN.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Floor from</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  value={floorStart}
                  onChange={(e) => setFloorStart(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Floor to</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  value={floorEnd}
                  onChange={(e) => setFloorEnd(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Flats per floor</label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => adjustFlatsPerFloor(-1)} className="btn btn-secondary btn-sm !px-2.5">
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    className="input text-center"
                    value={flatsPerFloor}
                    onChange={(e) => setFlatsPerFloor(e.target.value)}
                  />
                  <button type="button" onClick={() => adjustFlatsPerFloor(1)} className="btn btn-secondary btn-sm !px-2.5">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {setupValid && (
              <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
                <p className="text-sm font-semibold text-text-primary">
                  {candidates.length} flats total
                  {existingNumbers.size > 0 && (
                    <span className="text-text-secondary font-normal">
                      {" "}
                      · {newCandidates.length} new · {candidates.length - newCandidates.length} already exist
                    </span>
                  )}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  {wings.length} wing{wings.length > 1 ? "s" : ""} × {floorRange.length} floor
                  {floorRange.length > 1 ? "s" : ""} × {flatsPerFloor} flats per floor
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {previewSamples.map((flat) => (
                    <span
                      key={flat.flatNumber}
                      className={`px-2 py-1 rounded-md text-xs font-bold border ${
                        existingNumbers.has(flat.flatNumber)
                          ? "bg-surface text-text-secondary border-border line-through"
                          : "bg-white text-text-primary border-border"
                      }`}
                    >
                      {flat.flatNumber}
                    </span>
                  ))}
                  {candidates.length > previewSamples.length && (
                    <span className="px-2 py-1 text-xs text-text-secondary">+{candidates.length - previewSamples.length} more</span>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={createFlats}
              disabled={flatsSaving || !setupValid || !newCandidates.length}
              className="btn btn-primary"
            >
              {flatsSaving ? (
                <div className="spinner !w-4 !h-4 !border-white/30 !border-t-white" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {newCandidates.length ? `Create ${newCandidates.length} Flats` : "All flats already exist"}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <button
          type="button"
          onClick={() => setShowManualAdd((open) => !open)}
          className="w-full flex items-center justify-between gap-4 text-left"
        >
          <div>
            <h3 className="font-semibold text-sm">Add Individual Flat</h3>
            <p className="text-xs text-text-secondary mt-1">
              For shops, penthouses, or flats that do not fit the standard layout.
            </p>
          </div>
          {showManualAdd ? <ChevronUp className="w-5 h-5 text-text-secondary shrink-0" /> : <ChevronDown className="w-5 h-5 text-text-secondary shrink-0" />}
        </button>

        {showManualAdd && (
          <div className="mt-5 pt-5 border-t border-border">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Flat number *</label>
                <input
                  className="input"
                  placeholder="A-501 or SHOP-01"
                  value={manualFlat.flatNumber}
                  onChange={(e) => setManualFlat({ ...manualFlat, flatNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Wing (optional)</label>
                <input
                  className="input"
                  placeholder="A"
                  value={manualFlat.wing}
                  onChange={(e) => setManualFlat({ ...manualFlat, wing: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <label className="label">Floor (optional)</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  placeholder="5"
                  value={manualFlat.floor}
                  onChange={(e) => setManualFlat({ ...manualFlat, floor: e.target.value })}
                />
              </div>
            </div>
            <button onClick={addManualFlat} disabled={flatsSaving} className="btn btn-secondary mt-4">
              <Plus className="w-4 h-4" />
              Add Flat
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold text-sm">Your Flats</h3>
            <p className="text-xs text-text-secondary mt-1">
              Click a linked flat to view resident details.
            </p>
          </div>
          <button onClick={onRefresh} className="btn btn-secondary btn-sm self-start sm:self-auto">
            <RefreshCw className={`w-4 h-4 ${flatsLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {flats.length > 0 && (
          <div className="space-y-3 mb-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                className="input !pl-9"
                placeholder="Search flat number, owner, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "linked", "open"] as StatusFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    statusFilter === filter ? "bg-primary text-white" : "bg-surface text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {filter === "all" ? "All" : filter === "linked" ? "Linked" : "Available"}
                </button>
              ))}
              {wingOptions.length > 1 &&
                wingOptions.map((wing) => (
                  <button
                    key={wing}
                    type="button"
                    onClick={() => setWingFilter((current) => (current === wing ? "all" : wing))}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                      wingFilter === wing ? "bg-primary text-white" : "bg-surface text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    Wing {wing}
                  </button>
                ))}
            </div>
          </div>
        )}

        {flatsLoading && flats.length === 0 ? (
          <div className="flex justify-center py-10">
            <div className="spinner" />
          </div>
        ) : flats.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-border rounded-xl">
            <Home className="w-8 h-8 mx-auto text-text-tertiary opacity-40 mb-3" />
            <p className="text-sm font-medium text-text-primary">No flats yet</p>
            <p className="text-xs text-text-secondary mt-1">Use the setup section above to generate your flat list.</p>
          </div>
        ) : filteredFlats.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-border rounded-xl">
            <Search className="w-8 h-8 mx-auto text-text-tertiary opacity-40 mb-3" />
            <p className="text-sm font-medium text-text-primary">No flats match your filters</p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setWingFilter("all");
              }}
              className="btn btn-secondary btn-sm mt-3"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-5 max-h-[32rem] overflow-y-auto pr-1">
            {groupedFlats.map(([wing, wingFlats]) => (
              <div key={wing}>
                {groupedFlats.length > 1 && (
                  <p className="text-[11px] font-bold uppercase tracking-widest text-text-secondary mb-2">
                    Wing {wing} · {wingFlats.length}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {wingFlats.map((flat) => (
                    <button
                      key={flat.id}
                      type="button"
                      onClick={() => flat.hasAccount && setSelectedFlat(flat)}
                      className={`rounded-lg border p-3 bg-white text-left transition-colors ${
                        flat.hasAccount
                          ? "border-primary/20 hover:border-primary hover:bg-primary/5 cursor-pointer"
                          : "border-border cursor-default"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-text-primary">{flat.flatNumber}</p>
                          {flat.floor !== null && (
                            <p className="text-[10px] text-text-tertiary mt-0.5">Floor {flat.floor}</p>
                          )}
                          {flat.hasAccount ? (
                            <>
                              <p className="text-[11px] font-semibold text-text-primary mt-1 truncate">
                                {flat.ownerName || flat.users[0]?.name || "Linked resident"}
                              </p>
                              <p className="text-[10px] text-text-secondary mt-0.5 truncate">
                                {flat.contact || flat.users[0]?.phone || flat.users[0]?.email || "Contact not added"}
                              </p>
                            </>
                          ) : (
                            <p className="text-[10px] text-text-secondary mt-1">Ready for resident to join</p>
                          )}
                        </div>
                        <span
                          className={`text-[9px] font-bold px-2 py-1 rounded-full shrink-0 ${
                            flat.hasAccount ? "bg-success-bg text-success" : "bg-surface text-text-secondary"
                          }`}
                        >
                          {flat.hasAccount ? "Linked" : "Open"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedFlat && (
        <div className="modal-overlay" onClick={() => setSelectedFlat(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Flat Details</p>
                <h3 className="text-xl font-black text-text-primary mt-1">{selectedFlat.flatNumber}</h3>
                <p className="text-xs text-text-secondary mt-1">
                  Wing {selectedFlat.wing || "-"} {selectedFlat.floor !== null ? `· Floor ${selectedFlat.floor}` : ""}
                </p>
              </div>
              <button onClick={() => setSelectedFlat(null)} className="p-2 rounded-lg hover:bg-surface text-text-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {selectedFlat.users.length > 0 ? (
                selectedFlat.users.map((resident) => (
                  <div key={resident.id} className="rounded-xl border border-border p-4 bg-surface/40">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-bold text-text-primary">{resident.name}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{resident.role}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-success-bg text-success">
                        Account linked
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <Mail className="w-4 h-4 text-text-tertiary" />
                        <span className="font-medium text-text-primary break-all">{resident.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <Phone className="w-4 h-4 text-text-tertiary" />
                        <span className="font-medium text-text-primary">{resident.phone || "Phone not added"}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <Home className="w-8 h-8 mx-auto text-text-tertiary opacity-40 mb-2" />
                  <p className="text-sm font-medium text-text-primary">No account linked yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
