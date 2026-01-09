import React, { useEffect, useMemo, useState } from "react";
import { TrendingUp, Target, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import {
  PremiumCard,
  PremiumCardHeader,
  PremiumCardTitle,
  PremiumCardContent,
} from "@/components/ui/premium-card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Progress } from "@/components/ui/progress";

const sb = supabase as any;

type SalesmanRow = {
  salesman_no: number | string;
  salesman_name: string;
  net_sales: number;
  qty: number;
  bill_count: number;
};

function safePercent(achieved: number, target: number) {
  if (!target || target <= 0) return 0;
  return Math.round((achieved / target) * 100);
}

function clamp100(x: number) {
  return Math.max(0, Math.min(100, x));
}

function msUntilNext2050(bufferSeconds = 30) {
  const now = new Date();
  const next = new Date(now);

  const m = now.getMinutes();
  const s = now.getSeconds();
  const ms = now.getMilliseconds();

  const bufferMs = bufferSeconds * 1000;
  const elapsedMs = s * 1000 + ms;

  if (m < 20 || (m === 20 && elapsedMs < bufferMs)) {
    next.setMinutes(20, 0, 0);
  } else if (m < 50 || (m === 50 && elapsedMs < bufferMs)) {
    next.setMinutes(50, 0, 0);
  } else {
    next.setHours(now.getHours() + 1);
    next.setMinutes(20, 0, 0);
  }

  const targetMs = next.getTime() + bufferMs;
  return Math.max(500, targetMs - now.getTime());
}

// ✅ IMPORTANT: use latest loaded sale_date from daily_store_sales (not "today" IST)
async function getLatestSalesDateForStore(
  storeCode: string
): Promise<string | null> {
  const { data, error } = await sb
    .from("daily_store_sales")
    .select("sale_date")
    .eq("store_code", storeCode)
    .order("sale_date", { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data?.length) return null;

  return data[0].sale_date as string;
}

// ✅ SAME AS HQ: format IST time label from TIME string "HH:MM(:SS)"
function formatIstTimeFromTimeString(hhmmss: string) {
  const [hStr, mStr] = String(hhmmss).split(":");
  const h = Number(hStr || 0);
  const m = Number(mStr || 0);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh12 = ((h + 11) % 12) + 1;
  return `${String(hh12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ✅ Pull "sales till" from daily_sales_meta for the given saleDate
async function fetchSalesTillTimeLabelForDate(
  saleDate: string
): Promise<string | null> {
  if (!saleDate) return null;

  const { data, error } = await sb
    .from("daily_sales_meta")
    .select("sales_till, sales_till_ts")
    .eq("sale_date", saleDate)
    .limit(1);

  if (error) throw error;
  if (!data?.length) return null;

  const t = data[0]?.sales_till;
  if (t) return formatIstTimeFromTimeString(t);

  const ts = data[0]?.sales_till_ts;
  if (ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  return null;
}

const Performance: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [storeCode, setStoreCode] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);

  const [saleDate, setSaleDate] = useState<string>("");

  const [salesTillLabel, setSalesTillLabel] = useState<string | null>(null);

  const [salesAchieved, setSalesAchieved] = useState(0);
  const [salesTarget, setSalesTarget] = useState(0);

  const [salespersons, setSalespersons] = useState<SalesmanRow[]>([]);
  const [salesmanTargetMap, setSalesmanTargetMap] = useState<Map<string, number>>(
    new Map()
  );

  const salesPercent = useMemo(
    () => safePercent(salesAchieved, salesTarget),
    [salesAchieved, salesTarget]
  );

  const getPercentColor = (percent: number) => {
    if (percent >= 100) return "text-success";
    if (percent >= 80) return "text-warning";
    return "text-destructive";
  };

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;

    async function load() {
      setLoading(true);

      try {
        // 1) Auth user
        const { data: authData, error: authErr } = await sb.auth.getUser();
        if (authErr) throw authErr;

        const authUserId = authData?.user?.id;
        if (!authUserId) throw new Error("No auth user");

        // 2) App user row
        const { data: appUser, error: appUserErr } = await sb
          .from("users")
          .select("id, role")
          .eq("auth_user_id", authUserId)
          .single();

        if (appUserErr) throw appUserErr;

        // 3) Resolve store for store_manager (first mapped store)
        const { data: accessRows, error: accessErr } = await sb
          .from("user_store_access")
          .select("store:stores(id, code, name, region)")
          .eq("user_id", appUser.id);

        if (accessErr) throw accessErr;

        const stores = (accessRows ?? []).map((r: any) => r.store).filter(Boolean);
        const primaryStore = stores?.[0];

        if (!primaryStore?.code) {
          if (!alive) return;
          setStoreCode(null);
          setStoreName(null);
          setSaleDate("");
          setSalesTillLabel(null);
          setSalesAchieved(0);
          setSalesTarget(0);
          setSalespersons([]);
          setSalesmanTargetMap(new Map());
          return;
        }

        const code = primaryStore.code as string;

        if (!alive) return;
        setStoreCode(code);
        setStoreName(primaryStore.name ?? code);

        // 4) Get latest sale_date that exists for THIS store
        const latestDate = await getLatestSalesDateForStore(code);

        if (!latestDate) {
          if (!alive) return;
          setSaleDate("");
          setSalesTillLabel(null);
          setSalesAchieved(0);
          setSalesTarget(0);
          setSalespersons([]);
          setSalesmanTargetMap(new Map());
          return;
        }

        if (!alive) return;
        setSaleDate(latestDate);

        // ✅ sales till label
        try {
          const till = await fetchSalesTillTimeLabelForDate(latestDate);
          if (alive) setSalesTillLabel(till);
        } catch (e) {
          console.warn("Sales till fetch failed:", e);
          if (alive) setSalesTillLabel(null);
        }

        // 5) Store sales for latestDate
        const { data: storeSalesRows, error: storeSalesErr } = await sb
          .from("daily_store_sales")
          .select("net_sales")
          .eq("sale_date", latestDate)
          .eq("store_code", code);

        if (storeSalesErr) throw storeSalesErr;

        const totalSales =
          (storeSalesRows ?? []).reduce(
            (sum: number, r: any) => sum + (Number(r.net_sales) || 0),
            0
          ) || 0;

        // ✅ 6) Store target for latestDate
        const { data: storeTargetRows, error: storeTargetErr } = await sb
          .from("daily_store_targets")
          .select("target_amount")
          .eq("target_date", latestDate)
          .eq("store_code", code)
          .limit(1);

        const storeTarget =
          storeTargetErr || !storeTargetRows?.length
            ? 0
            : Number(storeTargetRows[0].target_amount) || 0;

        // 7) Salesman sales for latestDate
        const { data: salesmanRows, error: salesmanErr } = await sb
          .from("daily_salesman_sales")
          .select("salesman_no, salesman_name, net_sales, qty, bill_count")
          .eq("sale_date", latestDate)
          .eq("store_code", code)
          .order("net_sales", { ascending: false });

        if (salesmanErr) throw salesmanErr;

        // ✅ 8) Salesman targets for latestDate
        const { data: salesmanTargetRows, error: salesmanTargetErr } = await sb
          .from("daily_salesman_targets")
          .select("salesman_no, target_amount")
          .eq("target_date", latestDate)
          .eq("store_code", code);

        const map = new Map<string, number>();
        if (!salesmanTargetErr) {
          for (const r of salesmanTargetRows ?? []) {
            const key = String(r.salesman_no);
            map.set(key, Number(r.target_amount) || 0);
          }
        }

        if (!alive) return;
        setSalesAchieved(totalSales);
        setSalesTarget(storeTarget);
        setSalespersons((salesmanRows ?? []) as SalesmanRow[]);
        setSalesmanTargetMap(map);
      } catch (e) {
        console.error("Store performance load error:", e);
        if (!alive) return;
        setSaleDate("");
        setSalesTillLabel(null);
        setSalesAchieved(0);
        setSalesTarget(0);
        setSalespersons([]);
        setSalesmanTargetMap(new Map());
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    // ✅ initial load immediately
    load();

    // ✅ then smart refresh after :05/:35 forever
    const schedule = () => {
      if (!alive) return;
      const wait = msUntilNext2050(30); // refresh at :05:20 and :35:20
      timer = window.setTimeout(async () => {
        if (!alive) return;
        await load();
        schedule();
      }, wait);
    };

    schedule();

    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const headline = loading
    ? "Loading..."
    : storeName
    ? `${storeName}`
    : "No store assigned";

  return (
    <div className="p-4 space-y-5">
      <div className="pt-2 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Performance</h1>
        <p className="text-muted-foreground mt-1">
          {headline} {storeCode ? `• (${storeCode})` : ""}{" "}
          {saleDate ? (
            <>
              • Sales date: {saleDate}
              {salesTillLabel ? ` • Sales till: ${salesTillLabel}` : ""}
            </>
          ) : (
            ""
          )}
        </p>
      </div>

      {/* Store Total */}
      <PremiumCard className="animate-slide-up">
        <PremiumCardHeader>
          <PremiumCardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Store Sales Today
          </PremiumCardTitle>
        </PremiumCardHeader>
        <PremiumCardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-foreground">
                ₹{Math.round(salesAchieved).toLocaleString("en-IN")}
              </p>

              <p className="text-sm text-muted-foreground mt-1">
                of ₹{Math.round(salesTarget).toLocaleString("en-IN")} target
              </p>

              {salesTarget <= 0 ? (
                <p className="text-sm font-medium mt-2 text-muted-foreground">
                  Target is not set yet.
                </p>
              ) : (
                <p className="text-sm font-medium mt-2 text-muted-foreground">
                  Achievement: {salesPercent}%
                </p>
              )}
            </div>

            <ProgressRing
              progress={clamp100(salesPercent)}
              size={100}
              variant="accent"
            />
          </div>
        </PremiumCardContent>
      </PremiumCard>

      {/* Salesperson Breakdown */}
      <div className="animate-slide-up">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Team Performance (Today)
          </h2>
        </div>

        <div className="space-y-2">
          {!loading && salespersons.length === 0 ? (
            <PremiumCard className="!p-3">
              <p className="text-sm text-muted-foreground">
                No salesman sales found for {saleDate || "today"}.
              </p>
            </PremiumCard>
          ) : (
            salespersons.map((person, idx) => {
              const key = String(person.salesman_no);
              const target = salesmanTargetMap.get(key) ?? 0;
              const achieved = Number(person.net_sales) || 0;
              const percent = safePercent(achieved, target);

              return (
                <PremiumCard key={idx} className="!p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm">
                      {person.salesman_name}{" "}
                      <span className="text-xs text-muted-foreground">
                        (#{person.salesman_no})
                      </span>
                    </p>

                    <span className={`text-sm font-bold ${getPercentColor(percent)}`}>
                      {percent}%
                    </span>
                  </div>

                  <Progress value={clamp100(percent)} className="h-2" />

                  <div className="flex justify-between mt-1.5">
                    <span className="text-2xs text-muted-foreground">
                      ₹{Math.round(achieved).toLocaleString("en-IN")}
                      {target > 0
                        ? ` / ₹${Math.round(target).toLocaleString("en-IN")}`
                        : " / Target not set"}
                    </span>
                    <span className="text-2xs text-muted-foreground">
                      Bills: {person.bill_count ?? 0} • Qty: {person.qty ?? 0}
                    </span>
                  </div>
                </PremiumCard>
              );
            })
          )}
        </div>
      </div>

      {/* Focus Goals */}
      <div className="animate-slide-up">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground">Focus Goals</h2>
        </div>
        <PremiumCard variant="accent" className="!p-3">
          <p className="text-sm text-muted-foreground">
            (Optional) We can connect this to DB later.
          </p>
        </PremiumCard>
      </div>
    </div>
  );
};

export default Performance;