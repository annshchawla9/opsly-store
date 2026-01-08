// src/pages/MessageHQ.tsx
import React, { useEffect, useMemo, useState } from "react";
import { PlusCircle, RefreshCw, ChevronRight, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent } from "@/components/ui/premium-card";

type DbHQThread = {
  id: string;
  store_id: string;
  subject: string;
  status: string | null;
  created_by_user_id: string | null;
  created_at: string;
  last_message_at: string | null;
};

type DbHQMessage = {
  id: string;
  thread_id: string;
  sender_role: string; // 'store' | 'hq'
  sender_user_id: string | null;
  body: string;
  created_at: string;
  hq_read_at: string | null;
  store_read_at: string | null;
};

function formatDateTime(ts?: string | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts ?? "—";
  }
}

function explainSupabaseError(e: any) {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  const msg = e.message || e.error_description || e.details || "";
  const code = e.code ? ` (code: ${e.code})` : "";
  const hint = e.hint ? `\nHint: ${e.hint}` : "";
  return `${msg}${code}${hint}`.trim() || JSON.stringify(e);
}

export default function MessageHQ() {
  const navigate = useNavigate();
  const { user, appUser, store, loading: authLoading } = useAuth() as any;

  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeLabel, setStoreLabel] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<DbHQThread[]>([]);
  const [messages, setMessages] = useState<DbHQMessage[]>([]);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [creating, setCreating] = useState(false);

  // 1) Resolve store_id for this logged-in store user
  useEffect(() => {
    const loadStore = async () => {
      if (authLoading) return;

      const ctxStoreId = store?.id ?? null;
      if (ctxStoreId) {
        setStoreId(ctxStoreId);
        setStoreLabel(`${store?.code ?? ""} — ${store?.name ?? ""}`.trim() || ctxStoreId);
        return;
      }

      if (!appUser?.id) {
        setStoreId(null);
        setStoreLabel("");
        return;
      }

      const directStoreId = appUser?.store_id ?? null;
      if (directStoreId) {
        setStoreId(directStoreId);

        const { data: s, error: sErr } = await (supabase as any)
          .from("stores")
          .select("id, code, name")
          .eq("id", directStoreId)
          .maybeSingle();

        if (!sErr && s) setStoreLabel(`${s.code ?? ""} — ${s.name ?? ""}`.trim());
        else setStoreLabel(directStoreId);

        return;
      }

      const { data, error } = await (supabase as any)
        .from("user_store_access")
        .select("store_id, stores:store_id(id, code, name)")
        .eq("user_id", appUser.id)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Failed to load store access:", error);
        setStoreId(null);
        setStoreLabel("");
        return;
      }

      const sid = data?.store_id ?? null;
      setStoreId(sid);

      const s = data?.stores;
      const label = s ? `${s.code ?? ""} — ${s.name ?? ""}`.trim() : sid ?? "";
      setStoreLabel(label);
    };

    loadStore();
  }, [authLoading, appUser?.id, appUser?.store_id, store?.id]);

  async function loadMine() {
    if (!storeId) return;
    setLoading(true);

    try {
      const { data: tRows, error: tErr } = await (supabase as any)
  .from("hq_threads")
  .select("id,store_id,subject,status,created_by_user_id,created_at,last_message_at")
  .eq("store_id", storeId)
  .or("status.is.null,status.neq.resolved")
  .order("last_message_at", { ascending: false });

      if (tErr) throw tErr;

      const th: DbHQThread[] = (tRows || []).map((r: any) => ({
        id: r.id,
        store_id: r.store_id,
        subject: r.subject,
        status: r.status ?? null,
        created_by_user_id: r.created_by_user_id ?? null,
        created_at: r.created_at,
        last_message_at: r.last_message_at ?? null,
      }));
      setThreads(th);

      const ids = th.map((x) => x.id);
      if (!ids.length) {
        setMessages([]);
        return;
      }

      const { data: mRows, error: mErr } = await (supabase as any)
        .from("hq_messages")
        .select("id,thread_id,sender_role,sender_user_id,body,created_at,hq_read_at,store_read_at")
        .in("thread_id", ids)
        .order("created_at", { ascending: false });

      if (mErr) throw mErr;
      setMessages((mRows || []) as DbHQMessage[]);
    } catch (e: any) {
      console.error("MessageHQ load error:", e);
      setThreads([]);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!storeId) return;
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const latestByThread = useMemo(() => {
    const map = new Map<string, DbHQMessage>();
    for (const m of messages) {
      if (!map.has(m.thread_id)) map.set(m.thread_id, m);
    }
    return map;
  }, [messages]);

  const storeUnreadFromHQByThread = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of messages) {
      if (m.sender_role === "hq" && !m.store_read_at) {
        map.set(m.thread_id, (map.get(m.thread_id) || 0) + 1);
      }
    }
    return map;
  }, [messages]);

  async function createThreadAndSend() {
    if (!appUser?.id) return alert("Not logged in (no appUser).");
    if (!storeId) return alert("No store detected for this user.");

    const cleanSubject = subject.trim();
    const cleanBody = body.trim();
    if (!cleanSubject) return alert("Please add a subject.");
    if (!cleanBody) return alert("Please write a message.");

    setCreating(true);
    try {
      const now = new Date().toISOString();

      const { data: threadRow, error: tErr } = await (supabase as any)
        .from("hq_threads")
        .insert({
          store_id: storeId,
          subject: cleanSubject,
          status: "open",
          created_by_user_id: appUser.id,
          last_message_at: now,
        })
        .select("id")
        .single();

      if (tErr) throw tErr;

      const newThreadId = threadRow.id as string;

      const { error: mErr } = await (supabase as any)
        .from("hq_messages")
        .insert({
          thread_id: newThreadId,
          sender_role: "store",
          sender_user_id: appUser.id,
          body: cleanBody,
        });

      if (mErr) throw mErr;

      setSubject("");
      setBody("");
      await loadMine();

      navigate(`/message-hq/${newThreadId}`);
    } catch (e: any) {
      console.error("Create thread error:", e);
      alert(`Failed to send message to HQ.\n\n${explainSupabaseError(e)}`);
    } finally {
      setCreating(false);
    }
  }

  async function markHQMessagesRead(threadId: string) {
    const unreadIds = messages
      .filter((m) => m.thread_id === threadId && m.sender_role === "hq" && !m.store_read_at)
      .map((m) => m.id);

    if (!unreadIds.length) return;

    const { error } = await (supabase as any)
      .from("hq_messages")
      .update({ store_read_at: new Date().toISOString() })
      .in("id", unreadIds);

    if (error) console.warn("Failed to mark store_read_at:", error);
    await loadMine();
  }

  if (!user) return <div className="p-6 text-sm text-muted-foreground">Please sign in.</div>;
  if (authLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  if (!storeId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Could not detect store for this user. Make sure this user exists in <b>public.users</b> and is linked in{" "}
        <b>user_store_access</b>.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 animate-fade-in pb-24">
      {/* Header (match other tabs) */}
      <div className="pt-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">Message HQ</h1>

            {/* ✅ Fix: no overflow on long store label */}
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed break-words">
              Send a message to HQ from{" "}
              <span className="font-semibold text-foreground break-words">
                {storeLabel || storeId}
              </span>{" "}
              and track its status.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={loadMine}
            disabled={loading}
            className="shrink-0 gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* New Message (PremiumCard style like other screens) */}
      <PremiumCard className="animate-slide-up">
        <PremiumCardHeader>
          <div className="flex items-center justify-between gap-3 min-w-0">
            <PremiumCardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              New Message
            </PremiumCardTitle>
            <Badge variant="secondary" className="shrink-0">
              creates a thread
            </Badge>
          </div>
        </PremiumCardHeader>

        <PremiumCardContent className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Request for stock transfer / Issue / Question…"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Message</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Type your message to HQ…"
            />
          </div>

          <div className="flex justify-end">
            <Button
              className="gap-2"
              onClick={createThreadAndSend}
              disabled={creating || !subject.trim() || !body.trim()}
            >
              <PlusCircle className="h-4 w-4" />
              {creating ? "Sending…" : "Send to HQ"}
            </Button>
          </div>
        </PremiumCardContent>
      </PremiumCard>

      {/* Threads list */}
      <div className="animate-slide-up">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">My Threads</h2>
          {!loading && (
            <span className="text-sm text-muted-foreground">{threads.length} thread(s)</span>
          )}
        </div>

        <div className="space-y-2">
          {loading && (
            <PremiumCard className="!p-3">
              <div className="text-sm text-muted-foreground">Loading…</div>
            </PremiumCard>
          )}

          {!loading && threads.length === 0 && (
            <PremiumCard className="!p-3">
              <div className="text-sm text-muted-foreground">No messages yet. Create one above.</div>
            </PremiumCard>
          )}

          {!loading &&
            threads.map((t) => {
              const last = latestByThread.get(t.id);
              const unreadFromHQ = storeUnreadFromHQByThread.get(t.id) || 0;

              const anySeenByHQ = messages.some(
                (m) => m.thread_id === t.id && m.sender_role === "store" && !!m.hq_read_at
              );

              const anyHQReply = messages.some(
                (m) => m.thread_id === t.id && m.sender_role === "hq"
              );

              return (
                <PremiumCard
                  key={t.id}
                  hover
                  className="!p-3 cursor-pointer"
                  onClick={() => navigate(`/message-hq/${t.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-foreground truncate">
                          {t.subject}
                        </p>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>

                      {/* Badges */}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {t.status && (
                          <Badge variant="secondary" className="capitalize">
                            {t.status}
                          </Badge>
                        )}
                        <Badge variant="outline">Delivered</Badge>

                        <Badge variant={anySeenByHQ ? "secondary" : "outline"}>
                          {anySeenByHQ ? "Seen by HQ" : "Not seen yet"}
                        </Badge>

                        <Badge variant={anyHQReply ? "secondary" : "outline"}>
                          {anyHQReply ? "Replied" : "No reply yet"}
                        </Badge>

                        {unreadFromHQ > 0 && (
                          <Badge className="bg-blue-600 text-white hover:bg-blue-600">
                            {unreadFromHQ} new from HQ
                          </Badge>
                        )}
                      </div>

                      {/* Preview */}
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2 break-words">
                        {last ? last.body : "—"}
                      </p>

                      {/* Meta */}
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          Last activity: {formatDateTime(t.last_message_at || last?.created_at)}
                        </p>

                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          Created: {formatDateTime(t.created_at)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="mt-3 flex gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(`/message-hq/${t.id}`);
                          }}
                        >
                          View thread
                        </Button>

                        {unreadFromHQ > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              markHQMessagesRead(t.id);
                            }}
                          >
                            Mark HQ replies read
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </PremiumCard>
              );
            })}
        </div>
      </div>
    </div>
  );
}
