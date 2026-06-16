"use client";

import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import { useEffect, useState, useCallback } from "react";
import { useUser } from "@/lib/user-context";
import { Plus, Vote, BarChart3, Lock, Share2, Calendar, User, Info, CheckCircle2, X } from "lucide-react";
import { useAppDialog } from "@/components/ui/AppDialogProvider";
import { ModuleEmptyState, ModulePageHeader } from "@/components/ux/ModulePageKit";

interface Poll {
  id: string;
  title: string;
  description: string | null;
  options: string;
  votes: string;
  voters: string;
  createdBy: string;
  status: string;
  closesAt: string | null;
  createdAt: string;
}

export default function PollsPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const { confirm } = useAppDialog();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useUser();
  const [form, setForm] = useState({ title: "", description: "", options: ["", ""], closesAt: "" });

  const isAdmin = user?.role === "chairman" || user?.role === "secretary" || user?.role === "treasurer";
  const myFlat = user?.flatNumber || "";

  const fetchPolls = useCallback(() => {
    setLoading(true);
    fetch("/api/polls")
      .then((r) => r.json())
      .then((d) => setPolls(d.polls || []))
      .catch(() => toastT.error("Failed to load polls"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchPolls(); }, [fetchPolls]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = form.options.filter((o) => o.trim());
    if (validOptions.length < 2) {
      toastT.error("At least 2 valid options are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, options: validOptions }),
      });
      if (res.ok) {
        toastT.success("Poll published across society");
        setShowForm(false);
        setForm({ title: "", description: "", options: ["", ""], closesAt: "" });
        fetchPolls();
      } else {
        const d = await res.json();
        toastT.error(d.error || "Failed to create poll");
      }
    } catch { toastT.error("Something went wrong"); }
    finally { setSaving(false); }
  };

  const handleVote = async (pollId: string, optionIndex: number) => {
    if (!myFlat) {
      toastT.error("You must have an assigned flat to vote");
      return;
    }
    try {
      const res = await fetch(`/api/polls/${pollId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: optionIndex, flatNumber: myFlat }),
      });
      if (res.ok) {
        toastT.success("Your vote has been recorded!");
        fetchPolls();
      } else {
        const d = await res.json();
        toastT.error(d.error || "Voting failed");
      }
    } catch { toastT.error("Something went wrong"); }
  };

  const closePoll = async (id: string) => {
    const ok = await confirm({
      title: "Close Poll",
      message: "Finalize and close this poll? Residents will no longer be able to vote.",
      confirmLabel: "Close Poll",
    });
    if (!ok) return;
    await fetch(`/api/polls/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    });
    toastT.success("Poll concluded");
    fetchPolls();
  };

  const addOption = () => setForm({ ...form, options: [...form.options, ""] });
  const removeOption = (i: number) => setForm({ ...form, options: form.options.filter((_, idx) => idx !== i) });
  const updateOption = (i: number, val: string) => {
    const updated = [...form.options];
    updated[i] = val;
    setForm({ ...form, options: updated });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <ModulePageHeader
        icon={Vote}
        title={t("Society Voice")}
        description={t("Create governance polls, vote once per flat, and review live participation.")}
        meta={`${polls.length} ${t("polls")}`}
        tone="violet"
        actions={isAdmin && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary gap-2 px-8 py-3 rounded-xl font-black shadow-lg shadow-primary/20 flex items-center">
            <Plus className="w-5 h-5" /> Start New Poll
          </button>
        )}
      />

      {!isAdmin && (
         <div className="bg-gradient-to-r from-indigo-50 to-white p-6 rounded-2xl border border-indigo-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
                  <CheckCircle2 className="w-5 h-5" />
               </div>
               <div>
                  <p className="text-sm font-bold text-text-primary">Identity Verified</p>
                  <p className="text-xs text-text-secondary italic">Voting as member from Flat <strong>{myFlat || 'N/A'}</strong></p>
               </div>
            </div>
            {!myFlat && (
               <p className="text-xs font-black text-danger uppercase tracking-[0.1em] flex items-center gap-2 bg-red-50 px-4 py-2 rounded-lg">
                  <Info className="w-4 h-4" /> Please complete your profile to vote
               </p>
            )}
         </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="spinner !w-10 !h-10" />
          <p className="text-xs font-black text-text-secondary tracking-[0.2em] uppercase tracking-widest">Collecting Votes...</p>
        </div>
      ) : polls.length === 0 ? (
        <ModuleEmptyState
          icon={BarChart3}
          title="No active polls found"
          description="Society management will post new questions here when collective input is needed."
          tone="violet"
        />
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {polls.map((poll) => {
            const options: string[] = JSON.parse(poll.options);
            const votes: Record<string, number> = JSON.parse(poll.votes);
            const voters: string[] = JSON.parse(poll.voters);
            const totalVotes = Object.values(votes).reduce((s, v) => s + v, 0);
            const hasVoted = myFlat && voters.includes(myFlat);
            const isClosed = poll.status === "closed";
            const showResults = isClosed || hasVoted || isAdmin;

            const shareOnWhatsApp = () => {
              const optionsList = options.map((o, i) => `${i + 1}. ${o}`).join("\n");
              const text = `*Society Poll: ${poll.title}*\n${poll.description ? `\n_${poll.description}_\n` : "\n"}Options:\n${optionsList}\n\nCast your vote here: ${window.location.origin}/polls`;
              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
            };

            return (
              <div key={poll.id} className={`card !p-0 border-border group overflow-hidden rounded-[2rem] transition-all hover:border-primary/20 ${isClosed ? 'bg-surface/30 grayscale-[0.3]' : 'bg-white hover:shadow-2xl'}`}>
                <div className="p-8 md:p-10">
                   <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
                      <div className="flex-1">
                         <div className="flex items-center gap-3 mb-4">
                            {isClosed ? (
                              <span className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-black uppercase tracking-wider"><Lock className="w-3 h-3" /> Concluded</span>
                            ) : (
                              <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Currently Active</span>
                            )}
                            <span className="text-[10px] font-black text-text-tertiary uppercase tracking-wider">Ref: #{poll.id.slice(-4)}</span>
                         </div>
                         
                         <h3 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight mb-4 leading-tight">{poll.title}</h3>
                         {poll.description && <p className="text-base text-text-secondary leading-relaxed font-medium mb-6 italic">&ldquo;{poll.description}&rdquo;</p>}
                         
                         <div className="flex flex-wrap items-center gap-6 pt-6 -mx-1">
                            <div className="flex items-center gap-2">
                               <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-primary font-black text-[10px]">{poll.createdBy?.charAt(0)}</div>
                               <div>
                                  <p className="text-[9px] font-black text-text-tertiary uppercase tracking-tighter">Initiator</p>
                                  <p className="text-xs font-bold text-text-primary">{poll.createdBy}</p>
                               </div>
                            </div>
                            <div className="flex items-center gap-2">
                               <Calendar className="w-4 h-4 text-text-tertiary" />
                               <div>
                                  <p className="text-[9px] font-black text-text-tertiary uppercase tracking-tighter">Ends At</p>
                                  <p className="text-xs font-bold text-text-primary">{poll.closesAt ? new Date(poll.closesAt).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' }) : "Open Ended"}</p>
                               </div>
                            </div>
                            <div className="flex items-center gap-2">
                               <User className="w-4 h-4 text-text-tertiary" />
                               <div>
                                  <p className="text-[9px] font-black text-text-tertiary uppercase tracking-tighter">Participation</p>
                                  <p className="text-xs font-bold text-text-primary">{totalVotes} Total Votes</p>
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="flex gap-2 shrink-0 self-start">
                         <button onClick={shareOnWhatsApp} className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-text-tertiary hover:text-green-600 hover:border-green-200 transition-all shadow-sm">
                            <Share2 className="w-4 h-4" />
                         </button>
                         {isAdmin && !isClosed && (
                           <button onClick={() => closePoll(poll.id)} className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-text-tertiary hover:text-danger hover:border-danger transition-all shadow-sm">
                              <Lock className="w-4 h-4" />
                           </button>
                         )}
                      </div>
                   </div>

                   <div className="grid grid-cols-1 gap-3">
                      {options.map((option, i) => {
                        const voteCount = votes[i.toString()] || 0;
                        const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                        const isWinner = isClosed && voteCount > 0 && voteCount === Math.max(...Object.values(votes));

                        return (
                          <div key={i} className="relative">
                            {showResults ? (
                              <div className={`rounded-2xl border-2 p-5 transition-all relative overflow-hidden group ${isWinner ? "border-primary bg-primary/5" : "border-border/50 bg-white"}`}>
                                 <div 
                                    className={`absolute left-0 top-0 bottom-0 ${isWinner ? 'bg-primary/10' : 'bg-surface'} transition-all duration-1000 ease-out z-0`} 
                                    style={{ width: `${percentage}%` }}
                                 />
                                 <div className="relative z-10 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                       {isWinner && <CheckCircle2 className="w-5 h-5 text-primary" />}
                                       <span className={`text-base font-black ${isWinner ? "text-primary" : "text-text-primary"}`}>{option}</span>
                                    </div>
                                    <div className="text-right">
                                       <p className="text-xl font-black text-text-primary">{percentage}%</p>
                                       <p className="text-[10px] font-black text-text-tertiary uppercase tracking-wider">{voteCount} votes</p>
                                    </div>
                                 </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleVote(poll.id, i)}
                                disabled={!myFlat}
                                className="w-full text-left rounded-2xl border-2 border-border/50 p-6 hover:border-primary hover:bg-primary/5 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-between group shadow-sm bg-white"
                              >
                                <span className="text-lg font-black text-text-primary group-hover:text-primary transition-colors">{option}</span>
                                <div className="w-8 h-8 rounded-full bg-surface group-hover:bg-primary group-hover:text-white flex items-center justify-center transition-all">
                                   <div className="w-2 h-2 rounded-full border-2 border-current" />
                                </div>
                              </button>
                            )}
                          </div>
                        );
                      })}
                   </div>
                   
                   {hasVoted && !isClosed && (
                     <div className="mt-8 flex items-center gap-2 text-emerald-600 font-black text-xs uppercase tracking-widest bg-emerald-50 px-4 py-2 rounded-lg w-fit">
                        <CheckCircle2 className="w-4 h-4" /> You&apos;ve already cast your vote
                     </div>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Poll Modal */}
      {showForm && (
        <div className="modal-overlay !bg-black/40 backdrop-blur-sm z-[100]" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] !p-10 shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-10">
               <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Vote className="w-8 h-8" />
               </div>
               <div>
                  <h3 className="text-3xl font-black text-text-primary tracking-tighter">Opinion Poll</h3>
                  <p className="text-sm font-medium text-text-secondary mt-1">Gather collective insight from the community</p>
               </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                 <label className="text-[10px] font-black uppercase tracking-widest text-text-tertiary ml-1 mb-2 block">Poll Question *</label>
                 <input className="input !rounded-2xl !bg-surface/50 font-black h-16 text-lg" placeholder="e.g. Should we renovate the clubhouse?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              
              <div>
                 <label className="text-[10px] font-black uppercase tracking-widest text-text-tertiary ml-1 mb-2 block">Supporting Context</label>
                 <textarea className="input !rounded-2xl !bg-surface/50 !h-auto min-h-[100px] font-medium resize-none" placeholder="Provide more details about why this poll is being conducted..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-text-tertiary ml-1 mb-4 block">Voting Options *</label>
                <div className="space-y-3">
                   {form.options.map((o, i) => (
                     <div key={i} className="flex gap-2 group">
                        <input className="input !rounded-xl !bg-surface/50 font-bold" placeholder={`Option ${i + 1}`} value={o} onChange={(e) => updateOption(i, e.target.value)} required />
                        {form.options.length > 2 && (
                          <button type="button" onClick={() => removeOption(i)} className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100"><X className="w-4 h-4" /></button>
                        )}
                     </div>
                   ))}
                </div>
                <button type="button" onClick={addOption} className="mt-4 flex items-center gap-2 text-xs font-black text-primary uppercase tracking-widest hover:underline px-1">+ Add Additional Choice</button>
              </div>

              <div>
                 <label className="text-[10px] font-black uppercase tracking-widest text-text-tertiary ml-1 mb-2 block">Closing Date</label>
                 <input type="date" min={new Date().toISOString().split("T")[0]} className="input !rounded-2xl !bg-surface/50 font-black" value={form.closesAt} onChange={(e) => setForm({ ...form, closesAt: e.target.value })} />
              </div>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn btn-secondary !rounded-[1.25rem] py-4 font-black">Discard</button>
                <button type="submit" disabled={saving} className="flex-[2] btn btn-primary !rounded-[1.25rem] py-4 font-black shadow-xl shadow-primary/30">
                  {saving ? "Publishing..." : "Publish Poll"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
