// ===============================
// STORE APP — Tasks (COPY-PASTE)
// Hides resolved tasks by reading tasks.status in the join
// and filtering to only tasks.status === 'active'.
// ===============================

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Filter,
  Upload,
  PlayCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { PremiumCard } from "@/components/ui/premium-card";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const sb = supabase as any;

type TaskPriority = "low" | "medium" | "high" | "critical";
type TargetStatus = "pending" | "in_progress" | "pending_review" | "completed";
type DerivedStatus = TargetStatus | "overdue";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  due_at: string | null;
  requires_proof: boolean | null;

  // ✅ NEW: so we can hide resolved tasks
  status?: string | null; // 'active' | 'resolved'
};

type TargetRow = {
  task_id: string;
  store_id: string;
  status: TargetStatus;
  completed_at: string | null;
  review_note: string | null;
  tasks: TaskRow; // joined
};

function deriveStatus(target: TargetRow): DerivedStatus {
  if (target.status === "completed") return "completed";
  const due = target.tasks?.due_at
    ? new Date(target.tasks.due_at).getTime()
    : null;
  if (due && due < Date.now() && target.status !== "pending_review")
    return "overdue";
  return target.status;
}

function formatDue(target: TargetRow, derived: DerivedStatus) {
  const dueAt = target.tasks?.due_at
    ? new Date(target.tasks.due_at).getTime()
    : null;
  if (!dueAt) return "No due date";

  if (derived === "overdue") {
    const hours = Math.round((Date.now() - dueAt) / (60 * 60 * 1000));
    return hours >= 24
      ? `Overdue by ${Math.round(hours / 24)} day(s)`
      : `Overdue by ${hours}h`;
  }

  const hours = Math.round((dueAt - Date.now()) / (60 * 60 * 1000));
  return hours >= 24 ? `Due in ${Math.round(hours / 24)} day(s)` : `Due in ${hours}h`;
}

function badgeStatus(
  s: DerivedStatus | TargetStatus
): "pending" | "in_progress" | "completed" | "overdue" {
  if (s === "pending_review") return "in_progress";
  return s as any;
}

export default function Tasks() {
  const { store, appUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const [targets, setTargets] = useState<TargetRow[]>([]);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<
    (TargetRow & { derivedStatus?: DerivedStatus }) | null
  >(null);

  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const uploadSectionRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function fetchTargets() {
    if (!store?.id) return;
    setLoading(true);
    try {
      const { data, error } = await sb
        .from("task_targets")
        .select(
          `
          task_id,
          store_id,
          status,
          completed_at,
          review_note,
          tasks:tasks (
            id,
            title,
            description,
            priority,
            due_at,
            requires_proof,
            status
          )
        `
        )
        .eq("store_id", store.id);

      if (error) throw error;

      // ✅ Hide resolved tasks (HQ resolves -> disappears here)
      const onlyActive = ((data || []) as TargetRow[]).filter(
        (r) => (r as any).tasks?.status === "active"
      );

      const rows = onlyActive.sort((a, b) => {
        const da = a.tasks?.due_at
          ? new Date(a.tasks.due_at).getTime()
          : Number.MAX_SAFE_INTEGER;
        const db = b.tasks?.due_at
          ? new Date(b.tasks.due_at).getTime()
          : Number.MAX_SAFE_INTEGER;
        return da - db;
      });

      setTargets(rows);
    } catch (e) {
      console.error("Store tasks fetch error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTargets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  const normalized = useMemo(() => {
    return targets.map((t) => ({
      ...t,
      derivedStatus: deriveStatus(t),
    }));
  }, [targets]);

  const overdue = useMemo(
    () => normalized.filter((t) => t.derivedStatus === "overdue"),
    [normalized]
  );

  const dueToday = useMemo(
    () =>
      normalized.filter(
        (t) =>
          t.derivedStatus !== "overdue" && t.derivedStatus !== "completed"
      ),
    [normalized]
  );

  const completed = useMemo(
    () => normalized.filter((t) => t.derivedStatus === "completed"),
    [normalized]
  );

  const needsAction = useMemo(
    () =>
      normalized.filter(
        (t) => t.status === "in_progress" && Boolean((t.review_note || "").trim())
      ),
    [normalized]
  );

  function patchLocalTarget(task_id: string, patch: Partial<TargetRow>) {
    setTargets((prev) =>
      prev.map((t) =>
        t.task_id === task_id && t.store_id === store?.id
          ? ({ ...t, ...patch } as any)
          : t
      )
    );
  }

  async function setStatus(task_id: string, newStatus: TargetStatus) {
    if (!store?.id) return;

    try {
      patchLocalTarget(task_id, { status: newStatus } as any);

      const payload: any = { status: newStatus };
      if (newStatus === "completed") payload.completed_at = new Date().toISOString();

      const { error } = await sb
        .from("task_targets")
        .update(payload)
        .eq("task_id", task_id)
        .eq("store_id", store.id);

      if (error) throw error;

      await fetchTargets();
    } catch (e) {
      console.error("Update status error:", e);
      await fetchTargets();
    }
  }

  async function setPendingReview(task_id: string) {
    if (!store?.id) return;

    try {
      patchLocalTarget(task_id, { status: "pending_review", review_note: null } as any);

      const { error } = await sb
        .from("task_targets")
        .update({
          status: "pending_review",
          completed_at: null,
          review_note: null,
        })
        .eq("task_id", task_id)
        .eq("store_id", store.id);

      if (error) throw error;

      await fetchTargets();
    } catch (e) {
      console.error("Set pending_review error:", e);
      await fetchTargets();
    }
  }

  async function uploadProofAndSubmit() {
    if (!store?.id || !active || !appUser?.id) return;

    const requiresProof = Boolean(active.tasks.requires_proof);
    if (requiresProof && proofFiles.length === 0) return;

    setSubmitting(true);
    try {
      for (const file of proofFiles) {
        const safeName = file.name.replace(/\s+/g, "_");
        const path = `${active.task_id}/${store.id}/${Date.now()}_${safeName}`;

        const { error: upErr } = await supabase.storage
          .from("task_proofs")
          .upload(path, file, { upsert: false, contentType: file.type });

        if (upErr) throw upErr;

        const { error: insErr } = await sb.from("task_proofs").insert({
          task_id: active.task_id,
          store_id: store.id,
          image_url: path,
          approved: null,
          reviewed_by: null,
        });

        if (insErr) throw insErr;
      }

      if (requiresProof) {
        await setPendingReview(active.task_id);
      } else {
        await setStatus(active.task_id, "completed");
      }

      setOpen(false);
      setActive(null);
      setProofFiles([]);
      setComment("");
      await fetchTargets();
    } catch (e) {
      console.error("Upload proof error:", e);
      alert("Upload failed. Check console.");
    } finally {
      setSubmitting(false);
    }
  }

  const TaskCard = ({
    t,
  }: {
    t: TargetRow & { derivedStatus: DerivedStatus };
  }) => {
    const actionRequired =
      t.status === "in_progress" && Boolean((t.review_note || "").trim());

    return (
      <PremiumCard
        hover
        variant={
          t.derivedStatus === "overdue"
            ? "warning"
            : actionRequired
            ? "warning"
            : "default"
        }
        className="!p-3 cursor-pointer"
        onClick={() => {
          setActive(t);
          setProofFiles([]);
          setComment("");
          setOpen(true);
        }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="font-medium text-sm text-foreground">{t.tasks.title}</p>
          <PriorityBadge priority={t.tasks.priority} />
        </div>

        {t.tasks.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {t.tasks.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={badgeStatus(
              t.derivedStatus === "overdue" ? "overdue" : t.status
            )}
          />

          {t.status === "pending_review" && (
            <Badge variant="secondary">Pending review</Badge>
          )}
          {actionRequired && (
            <Badge className="bg-destructive/10 text-destructive">
              Action required
            </Badge>
          )}

          {t.tasks.requires_proof && (
            <span className="text-2xs text-muted-foreground">
              Proof required
            </span>
          )}

          <span
            className={cn(
              "text-2xs",
              t.derivedStatus === "overdue" || actionRequired
                ? "text-destructive"
                : "text-muted-foreground"
            )}
          >
            {formatDue(t, t.derivedStatus)}
          </span>
        </div>
      </PremiumCard>
    );
  };

  return (
    <div className="p-4 space-y-5">
      <div className="pt-2 flex items-start justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground mt-1">
            {store ? `Manage your daily work — ${store.code}` : "Manage your daily work"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCompleted(!showCompleted)}
        >
          <Filter className="h-4 w-4 mr-1" />
          {showCompleted ? "Hide Done" : "Show Done"}
        </Button>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading tasks…</div>}

      {!loading && needsAction.length > 0 && (
        <div className="animate-slide-up">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-semibold text-destructive">
              ACTION REQUIRED ({needsAction.length})
            </h2>
          </div>
          <div className="space-y-2">
            {needsAction.map((t) => (
              <TaskCard key={`${t.task_id}-${t.store_id}`} t={t as any} />
            ))}
          </div>
        </div>
      )}

      {!loading && overdue.length > 0 && (
        <div className="animate-slide-up">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-semibold text-destructive">
              OVERDUE ({overdue.length})
            </h2>
          </div>
          <div className="space-y-2">
            {overdue.map((t) => (
              <TaskCard key={`${t.task_id}-${t.store_id}`} t={t as any} />
            ))}
          </div>
        </div>
      )}

      {!loading && dueToday.length > 0 && (
        <div className="animate-slide-up">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-primary">
              DUE TODAY ({dueToday.length})
            </h2>
          </div>
          <div className="space-y-2">
            {dueToday.map((t) => (
              <TaskCard key={`${t.task_id}-${t.store_id}`} t={t as any} />
            ))}
          </div>
        </div>
      )}

      {showCompleted && !loading && completed.length > 0 && (
        <div className="animate-slide-up">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <h2 className="text-sm font-semibold text-success">
              COMPLETED ({completed.length})
            </h2>
          </div>
          <div className="space-y-2 opacity-70">
            {completed.map((t) => (
              <TaskCard key={`${t.task_id}-${t.store_id}`} t={t as any} />
            ))}
          </div>
        </div>
      )}

      {!loading && normalized.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-10">
          No tasks assigned yet.
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setActive(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{active?.tasks?.title || "Task"}</DialogTitle>
          </DialogHeader>

          {active && (
            <div className="space-y-4">
              {active.tasks.description && (
                <p className="text-sm text-muted-foreground">{active.tasks.description}</p>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <PriorityBadge priority={active.tasks.priority} />
                <StatusBadge
                  status={badgeStatus(
                    deriveStatus(active) === "overdue" ? "overdue" : active.status
                  )}
                />
                {active.status === "pending_review" && (
                  <Badge variant="secondary">Pending review</Badge>
                )}
                {active.status === "in_progress" &&
                  Boolean((active.review_note || "").trim()) && (
                    <Badge className="bg-destructive/10 text-destructive">
                      Action required
                    </Badge>
                  )}
                {active.tasks.requires_proof && (
                  <Badge variant="outline">Proof required</Badge>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                {formatDue(active, deriveStatus(active))}
              </div>

              {Boolean((active.review_note || "").trim()) && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div className="text-sm font-semibold text-destructive mb-1">
                    HQ requested changes
                  </div>
                  <div className="text-sm whitespace-pre-wrap text-foreground">
                    {active.review_note}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Please upload new proof after fixing this.
                  </div>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {active.status === "pending" && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setStatus(active.task_id, "in_progress")}
                  >
                    <PlayCircle className="h-4 w-4" /> Start
                  </Button>
                )}

                {active.tasks.requires_proof ? (
                  <Button
                    className="gap-2"
                    onClick={() => {
                      uploadSectionRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                      setTimeout(() => fileInputRef.current?.click(), 250);
                    }}
                  >
                    <Upload className="h-4 w-4" /> Submit Proof
                  </Button>
                ) : (
                  active.status !== "completed" && (
                    <Button
                      className="gap-2"
                      onClick={() => setStatus(active.task_id, "completed")}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Mark Complete
                    </Button>
                  )
                )}
              </div>

              {Boolean(active.tasks.requires_proof) &&
                active.status !== "completed" && (
                  <div
                    ref={uploadSectionRef}
                    className="space-y-2 border rounded-lg p-3"
                  >
                    <div className="text-sm font-medium">Upload photo proof</div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="block w-full text-sm"
                      onChange={(e) =>
                        setProofFiles(Array.from(e.target.files || []))
                      }
                    />

                    {proofFiles.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Selected: <b>{proofFiles.length}</b> image(s)
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      After submitting, status becomes <b>pending_review</b> for
                      HQ approval.
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Comment (optional)</div>
                      <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Any note for HQ?"
                      />
                      <div className="text-[11px] text-muted-foreground">
                        (Comment UI only for now — your DB table doesn't store comment yet.)
                      </div>
                    </div>

                    <Button
                      onClick={uploadProofAndSubmit}
                      disabled={
                        submitting ||
                        (Boolean(active.tasks.requires_proof) &&
                          proofFiles.length === 0)
                      }
                      className="w-full"
                    >
                      {submitting ? "Submitting..." : "Submit Proof"}
                    </Button>
                  </div>
                )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}