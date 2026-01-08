import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type TargetStatus = "pending" | "in_progress" | "pending_review" | "completed";

type TaskRow = {
  title: string;
  priority: "low" | "medium" | "high" | "critical";
  due_at: string | null;
  status?: string | null; // active | resolved
};

type TargetRow = {
  task_id: string;
  store_id: string;
  status: TargetStatus;
  tasks: TaskRow;
};

type DerivedStatus = TargetStatus | "overdue";

function deriveStatus(t: TargetRow): DerivedStatus {
  if (t.status === "completed") return "completed";

  const due = t.tasks?.due_at
    ? new Date(t.tasks.due_at).getTime()
    : null;

  if (due && due < Date.now() && t.status !== "pending_review") {
    return "overdue";
  }

  return t.status;
}

export function useStoreTaskSummary(storeId?: string | null) {
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId) return;

    let cancelled = false;
    setLoading(true);

    supabase
      .from("task_targets")
      .select(
        `
        task_id,
        store_id,
        status,
        tasks:tasks (
          title,
          priority,
          due_at,
          status
        )
      `
      )
      .eq("store_id", storeId)
      .then(({ data, error }) => {
        if (cancelled || error) return;

        const activeOnly = (data || []).filter(
          (r: any) => r.tasks?.status === "active"
        );

        setTargets(activeOnly as TargetRow[]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const normalized = useMemo(
    () =>
      targets.map((t) => ({
        ...t,
        derivedStatus: deriveStatus(t),
      })),
    [targets]
  );

  const completed = normalized.filter((t) => t.derivedStatus === "completed");
  const overdue = normalized.filter((t) => t.derivedStatus === "overdue");
  const pending = normalized.filter(
    (t) =>
      t.derivedStatus !== "completed" && t.derivedStatus !== "overdue"
  );

  return {
    total: normalized.length,
    completedCount: completed.length,
    pendingCount: pending.length,
    overdue,
    loading,
  };
}