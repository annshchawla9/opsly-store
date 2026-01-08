import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export function useStorePerformanceSummary(storeCode?: string | null) {
  const [loading, setLoading] = useState(false);
  const [saleDate, setSaleDate] = useState<string | null>(null);
  const [achieved, setAchieved] = useState(0);
  const [target, setTarget] = useState(0);

  useEffect(() => {
    if (!storeCode) return;

    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        // 1️⃣ latest sale date
        const { data: dateRows } = await sb
          .from("daily_store_sales")
          .select("sale_date")
          .eq("store_code", storeCode)
          .order("sale_date", { ascending: false })
          .limit(1);

        if (!dateRows?.length) return;
        const latestDate = dateRows[0].sale_date;

        if (cancelled) return;
        setSaleDate(latestDate);

        // 2️⃣ achieved
        const { data: salesRows } = await sb
          .from("daily_store_sales")
          .select("net_sales")
          .eq("sale_date", latestDate)
          .eq("store_code", storeCode);

        const totalSales =
          salesRows?.reduce(
            (sum: number, r: any) => sum + (Number(r.net_sales) || 0),
            0
          ) || 0;

        // 3️⃣ target
        const { data: targetRows } = await sb
          .from("daily_store_targets")
          .select("target_amount")
          .eq("target_date", latestDate)
          .eq("store_code", storeCode)
          .limit(1);

        const targetAmt =
          targetRows?.length ? Number(targetRows[0].target_amount) || 0 : 0;

        if (cancelled) return;
        setAchieved(totalSales);
        setTarget(targetAmt);
      } catch (e) {
        console.error("Dashboard sales summary error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [storeCode]);

  const percent = useMemo(() => {
    if (!target || target <= 0) return 0;
    return Math.round((achieved / target) * 100);
  }, [achieved, target]);

  return {
    loading,
    saleDate,
    achieved,
    target,
    percent,
  };
}